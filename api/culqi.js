// /api/culqi/* — pasarela de pago Culqi (https://culqi.com).
//
//   POST /api/culqi/charge   → cobra una tarjeta con un token de Culqi.js v4.
//
// Flujo (la tarjeta NUNCA toca este servidor):
//   1. El checkout abre el modal de Culqi (https://checkout.culqi.com/js/v4) con
//      la LLAVE PÚBLICA. El cliente paga; Culqi maneja 3-D Secure y devuelve un
//      token (tkn_...).
//   2. El front manda { token, email, items, shipping_fee } acá.
//   3. Recalculamos el monto en el servidor (precios desde la BD — nunca se
//      confía en el monto del cliente) y creamos el cargo con la LLAVE SECRETA:
//        POST https://api.culqi.com/v2/charges   Authorization: Bearer sk_...
//   4. Si Culqi aprueba, respondemos { ok, charge_id, amount }. El checkout
//      recién entonces registra el pedido en /api/order con el charge_id.
//
// La llave secreta vive SOLO en el servidor (env CULQI_SECRET_KEY en Railway).
// Yape/billeteras requieren además el flujo de Órdenes + webhook (pendiente).
'use strict';

const https = require('https');
const store = require('../db/products-store');

const CULQI_HOST = 'api.culqi.com';
const SECRET = () => process.env.CULQI_SECRET_KEY || '';

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > 1e6) { reject(new Error('payload demasiado grande')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { reject(new Error('JSON inválido')); }
    });
    req.on('error', reject);
  });
}

// POST a la API de Culqi con Bearer secreto. Resuelve { status, json }.
function culqiPost(pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const req = https.request({
      hostname: CULQI_HOST, path: pathname, method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET()}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json',
      },
    }, (r) => {
      let d = ''; r.on('data', (c) => (d += c));
      r.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; } resolve({ status: r.statusCode, json: j }); });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

// Recalcula el monto a cobrar desde la BD (no se confía en el cliente).
// Devuelve céntimos (entero) = (Σ precio·cantidad + envío) · 100.
async function computeAmountCents({ items, shipping_fee }) {
  if (!Array.isArray(items) || !items.length) throw new Error('Carrito vacío.');
  // Garantiza que el catálogo esté en la BD antes de consultar precios (BD fresca
  // o productos curados aún no insertados).
  await store.ensureSeeded();
  await store.ensureExtras();
  let soles = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    const p = await store.getById(String(it.id));
    if (!p || p.price == null) throw new Error(`Producto no disponible: ${it.id}`);
    soles += Number(p.price) * qty;
  }
  const ship = Math.max(0, Number(shipping_fee) || 0);
  soles += ship;
  return Math.round(soles * 100);
}

// Mensaje legible a partir del error de Culqi.
function culqiError(json) {
  if (!json || typeof json !== 'object') return 'No se pudo procesar el pago.';
  return json.user_message || json.merchant_message || json.message || 'Pago rechazado.';
}

async function charge(req, res) {
  if (!SECRET()) return send(res, 503, { error: 'Pago con tarjeta no configurado (falta CULQI_SECRET_KEY).' });

  let body;
  try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!token || !token.startsWith('tkn_')) return send(res, 400, { error: 'Token de pago inválido.' });
  if (!email || !email.includes('@')) return send(res, 400, { error: 'Email inválido.' });

  let amount;
  try { amount = await computeAmountCents(body); }
  catch (e) { return send(res, 400, { error: e.message }); }
  // Culqi exige montos >= S/ 1.00 (100 céntimos) en PEN.
  if (amount < 100) return send(res, 400, { error: 'El monto mínimo es S/ 1.00.' });

  try {
    const { status, json } = await culqiPost('/v2/charges', {
      amount,
      currency_code: 'PEN',
      email,
      source_id: token,
      description: 'Pedido Lima Flores',
      metadata: { source: 'web-checkout' },
    });
    // Cargo aprobado.
    if ((status === 200 || status === 201) && json && json.object === 'charge') {
      return send(res, 200, { ok: true, charge_id: json.id, amount, outcome: (json.outcome && json.outcome.type) || 'sale' });
    }
    // Rechazo / error de Culqi → 402 con mensaje legible.
    return send(res, 402, { ok: false, error: culqiError(json), code: json && json.code });
  } catch (e) {
    console.error('[culqi] charge error:', e.message);
    return send(res, 502, { ok: false, error: 'No pudimos comunicarnos con el procesador de pagos. Intenta de nuevo.' });
  }
}

module.exports = async (req, res, parsed) => {
  const p = parsed.pathname;
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (p === '/api/culqi/charge') return charge(req, res);
  return send(res, 404, { error: 'culqi route not found' });
};
