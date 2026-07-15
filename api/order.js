// POST /api/order — recibe el form de checkout y persiste la orden con status='pending'.
// El despacho a Cabify es manual desde /admin (no se auto-dispara).
'use strict';

const db = require('../db');
const { generateAndStoreCard } = require('../integrations/cards/order-card');
const gchat = require('../integrations/notify/gchat');
const { computeAmountCents, getCharge } = require('../integrations/culqi/charges');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    // Acumulamos Buffers y decodificamos UTF-8 al final con Buffer.concat. Hacer
    // `raw += chunk` decodifica cada chunk por separado y rompe los caracteres
    // multibyte (ñ, tildes, emojis) si quedan partidos en el límite de un chunk
    // de red → "Breña" se corrompía a "Bre�a". (api/admin.js ya lo hacía así.)
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 1e6) { reject(new Error('payload demasiado grande')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch (e) { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

// Valida + normaliza el body. Devuelve { ok, value, error }.
function validate(b) {
  const req = (v) => typeof v === 'string' && v.trim().length > 0;
  const missing = [];
  if (!req(b.buyer_name))         missing.push('buyer_name');
  if (!req(b.buyer_email))        missing.push('buyer_email');
  if (!req(b.buyer_phone))        missing.push('buyer_phone');
  if (!req(b.recipient_name))     missing.push('recipient_name');
  if (!req(b.recipient_phone))    missing.push('recipient_phone');
  if (!req(b.recipient_address))  missing.push('recipient_address');
  if (typeof b.recipient_lat !== 'number' || isNaN(b.recipient_lat)) missing.push('recipient_lat');
  if (typeof b.recipient_lng !== 'number' || isNaN(b.recipient_lng)) missing.push('recipient_lng');
  if (!req(b.delivery_date))      missing.push('delivery_date');
  if (!req(b.delivery_time))      missing.push('delivery_time');
  if (!Array.isArray(b.items) || b.items.length === 0) missing.push('items');
  if (typeof b.subtotal !== 'number') missing.push('subtotal');
  if (typeof b.total !== 'number')    missing.push('total');
  if (missing.length) return { ok: false, error: `Faltan campos: ${missing.join(', ')}` };
  return { ok: true, value: b };
}

function newOrderId() {
  return 'LF-' + Date.now().toString(36).toUpperCase()
       + '-' + Math.random().toString(36).slice(2, 5).toUpperCase();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (!db.enabled) return send(res, 503, { error: 'Persistencia no configurada — falta DATABASE_URL en el servidor.' });

  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return send(res, 400, { error: e.message }); }

  const v = validate(body);
  if (!v.ok) return send(res, 400, { error: v.error });

  const id = newOrderId();
  const b = v.value;

  // ── Verificación de pago (anti-fraude) ──────────────────────────────────────
  // Si el pedido dice estar pagado con tarjeta (culqi_charge_id), NO confiamos en
  // el total del cliente: confirmamos contra Culqi que el cargo existe, cubre el
  // monto recalculado en el servidor (precios reales de la BD) y no se usó ya en
  // otro pedido. Sin esto, un atacante cobraría S/1 y registraría un pedido de S/500.
  let paymentWarning = null;
  const chargeId = typeof b.culqi_charge_id === 'string' ? b.culqi_charge_id.trim() : '';
  if (chargeId) {
    // 1) Anti-replay: un mismo cargo no puede pagar dos pedidos.
    try {
      const dup = await db.query(`SELECT id FROM orders WHERE culqi_charge_id = $1 LIMIT 1`, [chargeId]);
      if (dup.rows.length) return send(res, 409, { error: 'Este pago ya está asociado a otro pedido.' });
    } catch (e) { console.error('[order] dup charge check:', e.message); }

    // 2) Monto esperado recalculado en el servidor (precios reales, no del cliente).
    let expectedCents;
    try { expectedCents = await computeAmountCents({ items: b.items, shipping_fee: b.shipping_fee }); }
    catch (e) { return send(res, 400, { error: 'No pudimos validar el pedido: ' + e.message }); }

    // 3) Verificar el cargo contra Culqi.
    if (!process.env.CULQI_SECRET_KEY) {
      // Sin llave no se puede verificar; no perdemos el pedido pero lo marcamos.
      paymentWarning = 'PAGO NO VERIFICADO (Culqi no configurado) — confirmar antes de despachar.';
    } else {
      try {
        const ch = await getCharge(chargeId);
        const j = ch.json;
        if (!(ch.status === 200 && j && j.object === 'charge')) {
          return send(res, 402, { error: 'No pudimos verificar el pago. Contáctanos por WhatsApp.' });
        }
        const paidCents = Number(j.amount) || 0;
        const currency = String(j.currency_code || j.currency || '').toUpperCase();
        if (currency !== 'PEN') return send(res, 402, { error: 'Moneda de pago inválida.' });
        // El cargo debe cubrir el total del pedido (2 céntimos de tolerancia por redondeo).
        if (paidCents + 2 < expectedCents) {
          console.warn(`[order] cargo insuficiente rechazado: charge=${chargeId} pago=${paidCents} esperado=${expectedCents}`);
          return send(res, 402, { error: 'El pago no cubre el total del pedido.' });
        }
      } catch (e) {
        // Culqi no respondió: el cargo probablemente ocurrió (el front trae un
        // charge_id de un cobro exitoso). No perdemos el pedido, pero lo marcamos.
        console.error('[order] getCharge error:', e.message);
        paymentWarning = 'PAGO NO VERIFICADO (Culqi no respondió) — confirmar antes de despachar.';
      }
    }
  }

  try {
    await db.query(
      `INSERT INTO orders (
        id, status,
        buyer_name, buyer_email, buyer_phone,
        recipient_name, recipient_phone, recipient_address, recipient_address_ref,
        recipient_lat, recipient_lng, recipient_apt, recipient_has_reception,
        delivery_date, delivery_time,
        invoice_type, invoice_doc, invoice_name,
        payment_method, card_note,
        items, subtotal, shipping_fee, shipping_provider, shipping_label, total,
        culqi_charge_id, card_anonymous
      ) VALUES (
        $1, 'pending',
        $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14,
        $15, $16, $17,
        $18, $19,
        $20, $21, $22, $23, $24, $25,
        $26, $27
      )`,
      [
        id,
        b.buyer_name, b.buyer_email, b.buyer_phone,
        b.recipient_name, b.recipient_phone, b.recipient_address, b.recipient_address_ref || null,
        b.recipient_lat, b.recipient_lng, b.recipient_apt || null, !!b.recipient_has_reception,
        b.delivery_date, b.delivery_time,
        b.invoice_type || null, b.invoice_doc || null, b.invoice_name || null,
        b.payment_method || null, b.card_note || null,
        JSON.stringify(b.items),
        b.subtotal, b.shipping_fee ?? null, b.shipping_provider || null, b.shipping_label || null, b.total,
        b.culqi_charge_id || null, !!b.card_anonymous,
      ]
    );
    // Si el pago no se pudo verificar (Culqi caído / no configurado), dejamos un
    // aviso visible en el panel para que se confirme antes de despachar.
    if (paymentWarning) {
      try { await db.query(`UPDATE orders SET dispatch_error = $1 WHERE id = $2`, [paymentWarning, id]); }
      catch (e) { console.error('[order] set payment warning:', e.message); }
    }
    // Respondemos al cliente de inmediato; la tarjeta se rasteriza en segundo
    // plano (Puppeteer tarda ~1-2s) y se guarda en orders.card_png cuando está
    // lista. Si falla, no afecta al pedido — queda registrado en card_error.
    if (b.card_note && String(b.card_note).trim()) {
      setImmediate(() => {
        generateAndStoreCard({
          id,
          card_note: b.card_note,
          recipient_name: b.recipient_name,
          buyer_name: b.buyer_name,
          card_anonymous: !!b.card_anonymous,
        }).catch((err) => console.error('[order] card bg error:', err.message));
      });
    }

    // Aviso de pedido nuevo a Google Chat (fire-and-forget; no bloquea ni rompe
    // el pedido si el webhook falla o no está configurado).
    setImmediate(() => {
      gchat.notifyNewOrder({ id, ...b }).catch((err) => console.error('[order] gchat error:', err.message));
    });

    return send(res, 201, { id, status: 'pending' });
  } catch (e) {
    console.error('[order] insert error:', e.message);
    return send(res, 500, { error: 'No pudimos guardar el pedido. Intenta de nuevo en un momento.' });
  }
};
