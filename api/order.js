// POST /api/order — recibe el form de checkout y persiste la orden con status='pending'.
// El despacho a Cabify es manual desde /admin (no se auto-dispara).
'use strict';

const db = require('../db');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) { reject(new Error('payload demasiado grande')); req.destroy(); }
    });
    req.on('end', () => {
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
        items, subtotal, shipping_fee, shipping_provider, shipping_label, total
      ) VALUES (
        $1, 'pending',
        $2, $3, $4,
        $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14,
        $15, $16, $17,
        $18, $19,
        $20, $21, $22, $23, $24, $25
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
      ]
    );
    return send(res, 201, { id, status: 'pending' });
  } catch (e) {
    console.error('[order] insert error:', e.message);
    return send(res, 500, { error: 'No pudimos guardar el pedido. Intenta de nuevo en un momento.' });
  }
};
