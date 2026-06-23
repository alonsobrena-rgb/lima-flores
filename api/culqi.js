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
const fs = require('fs');
const path = require('path');
const store = require('../db/products-store');
const catalog = require('../integrations/culqi/plans-catalog');
const subsStore = require('../db/subscriptions-store');

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

// ─── Suscripciones recurrentes ───────────────────────────────────────────────
// Mapa { plan_key: pln_id } generado por integrations/culqi/create-plans.js.
// Se lee perezosamente y se cachea; si el archivo no existe, no hay planes
// aprovisionados todavía y /subscribe responde 503 con un mensaje claro.
let _planMap = null;
function planIdFor(key) {
  if (_planMap == null) {
    try { _planMap = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'integrations', 'culqi', 'plans.json'), 'utf8')); }
    catch { _planMap = {}; }
  }
  return _planMap[key] || null;
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] || 'Cliente', last: 'Lima Flores' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

// POST /api/culqi/subscribe — crea customer + card + subscription en Culqi.
// La tarjeta nunca toca el server (llega como token tkn_ del modal v4).
async function subscribe(req, res) {
  if (!SECRET()) return send(res, 503, { error: 'Suscripciones no configuradas (falta CULQI_SECRET_KEY).' });

  let b;
  try { b = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const token = typeof b.token === 'string' ? b.token.trim() : '';
  const email = typeof b.email === 'string' ? b.email.trim() : '';
  const planKey = typeof b.plan_key === 'string' ? b.plan_key.trim() : '';
  if (!token || !token.startsWith('tkn_')) return send(res, 400, { error: 'Token de pago inválido.' });
  if (!email || !email.includes('@')) return send(res, 400, { error: 'Email inválido.' });
  if (b.tyc !== true) return send(res, 400, { error: 'Debes aceptar los términos y condiciones.' });

  // Plan resuelto SIEMPRE en el servidor (nunca se confía en montos del cliente).
  const entry = catalog.byKey(planKey);
  if (!entry) return send(res, 400, { error: 'Plan no válido.' });
  const planId = planIdFor(planKey);
  if (!planId) return send(res, 503, { error: 'Este plan aún no está disponible (planes no aprovisionados en Culqi).' });

  // Datos mínimos del suscriptor / entrega.
  const reqStr = (v) => typeof v === 'string' && v.trim().length > 0;
  const missing = [];
  if (!reqStr(b.buyer_name)) missing.push('buyer_name');
  if (!reqStr(b.buyer_phone)) missing.push('buyer_phone');
  if (!reqStr(b.recipient_name)) missing.push('recipient_name');
  if (!reqStr(b.recipient_phone)) missing.push('recipient_phone');
  if (!reqStr(b.recipient_address)) missing.push('recipient_address');
  if (missing.length) return send(res, 400, { error: `Faltan datos: ${missing.join(', ')}` });

  const { first, last } = splitName(b.buyer_name);
  const model = entry.models[0]; // 'A' o 'B' (mensual queda como su primer modelo)

  try {
    // 1) Customer
    const cust = await culqiPost('/v2/customers', {
      first_name: first, last_name: last, email,
      address: String(b.recipient_address).slice(0, 100),
      address_city: String(b.recipient_district || 'Lima').slice(0, 30),
      country_code: 'PE',
      phone_number: String(b.buyer_phone).replace(/[^\d+]/g, '').slice(0, 15),
    });
    const customerId = cust.json && (cust.json.id || cust.json.customer_id);
    if (!((cust.status === 200 || cust.status === 201) && customerId)) {
      return send(res, 402, { ok: false, error: culqiError(cust.json) || 'No se pudo registrar el cliente.' });
    }

    // 2) Card (a partir del token)
    const card = await culqiPost('/v2/cards', { customer_id: customerId, token_id: token });
    const cardId = card.json && (card.json.id || card.json.card_id);
    if (!((card.status === 200 || card.status === 201) && cardId)) {
      return send(res, 402, { ok: false, error: culqiError(card.json) || 'No se pudo registrar la tarjeta.' });
    }

    // 3) Subscription
    const sub = await culqiPost('/v2/subscriptions', {
      card_id: cardId, plan_id: planId, tyc: true,
      metadata: { plan_key: planKey, model, source: 'web-suscripcion' },
    });
    const subId = sub.json && (sub.json.id || sub.json.subscription_id);
    if (!((sub.status === 200 || sub.status === 201) && subId)) {
      return send(res, 402, { ok: false, error: culqiError(sub.json) || 'No se pudo crear la suscripción.' });
    }

    // Persistimos (no bloquea la respuesta si la BD falla).
    try {
      await subsStore.create({
        id: subId, planKey, planId, model, tier: entry.tier,
        amount: entry.amountSoles, intervalCount: entry.intervalCount,
        customerId, cardId,
        buyerName: b.buyer_name, buyerEmail: email, buyerPhone: b.buyer_phone,
        recipientName: b.recipient_name, recipientPhone: b.recipient_phone,
        recipientAddress: b.recipient_address, recipientDistrict: b.recipient_district || null,
        deliveryPref: b.delivery_pref || null, notes: b.notes || null,
      });
    } catch (e) { console.error('[culqi] subscribe persist error:', e.message); }

    return send(res, 200, { ok: true, subscription_id: subId, plan_key: planKey, amount: entry.amountSoles });
  } catch (e) {
    console.error('[culqi] subscribe error:', e.message);
    return send(res, 502, { ok: false, error: 'No pudimos comunicarnos con el procesador de pagos. Intenta de nuevo.' });
  }
}

// POST /api/culqi/webhook — recibe eventos de recurrencia de Culqi y los registra.
// Guard opcional: si CULQI_WEBHOOK_SECRET está definido, exige ?secret= que coincida.
async function webhook(req, res, parsed) {
  const need = process.env.CULQI_WEBHOOK_SECRET || '';
  if (need && (!parsed.searchParams || parsed.searchParams.get('secret') !== need)) return send(res, 401, { error: 'unauthorized' });

  let ev;
  try { ev = await readJsonBody(req); } catch { ev = {}; }
  const id = (ev && (ev.id || ev.event_id)) || ('evt_' + Date.now().toString(36));
  const type = (ev && (ev.type || ev.event)) || null;
  // El sxn_ puede venir en data.subscription_id / object.subscription / metadata.
  const data = (ev && (ev.data || ev.object)) || {};
  const subId = data.subscription_id || data.subscription || (data.metadata && data.metadata.subscription_id) || null;

  try {
    await subsStore.recordEvent({ id: String(id), type, subscriptionId: subId, payload: ev });
    if (subId) {
      await subsStore.markEvent(subId, type, new Date());
      if (type && /cancel/i.test(type)) await subsStore.setStatus(subId, 'cancelled');
    }
  } catch (e) { console.error('[culqi] webhook persist error:', e.message); }

  // Siempre 200 para que Culqi no reintente en bucle.
  return send(res, 200, { ok: true });
}

module.exports = async (req, res, parsed) => {
  const p = parsed.pathname;
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (p === '/api/culqi/charge') return charge(req, res);
  if (p === '/api/culqi/subscribe') return subscribe(req, res);
  if (p === '/api/culqi/webhook') return webhook(req, res, parsed);
  return send(res, 404, { error: 'culqi route not found' });
};
