// /api/culqi/* — pasarela de pago Culqi (https://culqi.com).
//
//   POST /api/culqi/order    → crea la orden que Yape exige para poder abrirse.
//   POST /api/culqi/charge   → cobra con un token de Culqi.js v4 (tarjeta o Yape).
//
// Flujo (la tarjeta NUNCA toca este servidor):
//   0. Si el método es Yape, el checkout pide primero una orden acá. Culqi.js
//      solo ofrece tarjeta si se abre sin orden; con cualquier otro método
//      responde CCKT-400 antes de pedir siquiera el código de aprobación.
//   1. El checkout abre el modal de Culqi (https://checkout.culqi.com/js/v4) con
//      la LLAVE PÚBLICA. El cliente paga; Culqi maneja 3-D Secure y devuelve un
//      token: tkn_... si pagó con tarjeta, ype_... si pagó con Yape (celular +
//      código de aprobación). Ambos se cobran igual, como source_id.
//   2. El front manda { token, email, items, shipping_fee } acá.
//   3. Recalculamos el monto en el servidor (precios desde la BD — nunca se
//      confía en el monto del cliente) y creamos el cargo con la LLAVE SECRETA:
//        POST https://api.culqi.com/v2/charges   Authorization: Bearer sk_...
//   4. Si Culqi aprueba, respondemos { ok, charge_id, amount }. El checkout
//      recién entonces registra el pedido en /api/order con el charge_id.
//
// La llave secreta vive SOLO en el servidor (env CULQI_SECRET_KEY en Railway).
//
// Banca móvil, agente y billetera siguen PENDIENTES: además de la orden, el
// cliente paga después (en un banco o bodega), así que el pedido solo puede
// darse por bueno cuando llega el webhook. Yape no — se paga en el acto y
// devuelve token, que es el camino ya implementado.
'use strict';

const https = require('https');
const fs = require('fs');
const path = require('path');
const catalog = require('../integrations/culqi/plans-catalog');
const subsStore = require('../db/subscriptions-store');
const { safeEqStr } = require('../lib/security');
const { computeAmountCents } = require('../integrations/culqi/charges');
const gchat = require('../integrations/notify/gchat');

const CULQI_HOST = 'api.culqi.com';
const SECRET = () => process.env.CULQI_SECRET_KEY || '';

// /v2/charges acepta tokens con prefijo distinto según el método: tarjeta genera
// tkn_..., Yape genera ype_test_... / ype_live_.... El checkout puede devolver
// cualquiera de los dos, así que el cargo admite ambos. (No aceptamos crd_ —
// tarjeta ya guardada en un customer — porque el checkout nunca lo produce.)
const CHARGE_TOKEN = /^(tkn|ype)_/;

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

// computeAmountCents ahora vive en integrations/culqi/charges.js (compartido con
// api/order.js para que la verificación del pedido use el mismo cálculo).

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
  if (!token || !CHARGE_TOKEN.test(token)) return send(res, 400, { error: 'Token de pago inválido.' });
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

// ─── Órdenes (lo que Yape exige antes de abrir el modal) ─────────────────────
// El Checkout v4 abierto "a secas" solo sabe cobrar con tarjeta. Para habilitar
// Yape —y banca móvil, agente o billetera— hay que crear ANTES una orden y
// pasársela como Culqi.settings({ order: 'ord_...' }). Sin ella el checkout
// aborta con CCKT-400 ("Ups! Algo salió mal") sin llegar a pedir el código de
// aprobación, así que el fallo no se parece en nada a su causa.
//
//   POST /api/culqi/order  { items, shipping_fee, email, name, phone }
//     → { ok, order_id, amount }
//
// El monto se recalcula acá con computeAmountCents (el mismo que usa el cargo),
// nunca se toma del cliente: la orden es lo que Culqi le muestra al comprador.

// Yape topa en S/ 2000 por operación y solo acepta soles.
const YAPE_MAX_CENTS = 200000;

// Culqi exige order_number único por comercio — repetir uno hace fallar la orden.
function newOrderNumber() {
  return 'LF' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
}

async function createOrder(req, res) {
  if (!SECRET()) return send(res, 503, { error: 'Pago no configurado (falta CULQI_SECRET_KEY).' });

  let b;
  try { b = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!email || !email.includes('@')) return send(res, 400, { error: 'Email inválido.' });

  let amount;
  try { amount = await computeAmountCents(b); }
  catch (e) { return send(res, 400, { error: e.message }); }
  if (amount < 100) return send(res, 400, { error: 'El monto mínimo es S/ 1.00.' });
  // Mejor decirlo acá que dejar que el modal falle sin explicar por qué.
  if (amount > YAPE_MAX_CENTS) {
    return send(res, 400, { error: 'Yape admite hasta S/ 2000 por pago. Usa tarjeta para este pedido.' });
  }

  const { first, last } = splitName(b.name);
  try {
    const { status, json } = await culqiPost('/v2/orders', {
      amount,
      currency_code: 'PEN',
      description: culqiText('Pedido Lima Flores', 80, 'Pedido Lima Flores'),
      order_number: newOrderNumber(),
      client_details: {
        first_name: culqiText(first, 50, 'Cliente'),
        last_name: culqiText(last, 50, 'Lima Flores'),
        email,
        phone_number: String(b.phone || '').replace(/\D/g, '').slice(0, 15) || '999999999',
      },
      // Unix en SEGUNDOS y en el futuro. 24 h sobra para un pago con Yape y no
      // arriesga rechazos por una expiración demasiado corta.
      expiration_date: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      confirm: false,
    });
    const id = json && (json.id || json.order_id);
    if ((status === 200 || status === 201) && id) return send(res, 200, { ok: true, order_id: id, amount });
    // Volcamos la respuesta cruda: si Culqi discute el formato de algún campo
    // (expiration_date es el sospechoso habitual), acá queda dicho cuál.
    console.error('[culqi] orden rechazada:', status, JSON.stringify(json));
    return send(res, 402, { ok: false, error: culqiError(json), code: json && json.code });
  } catch (e) {
    console.error('[culqi] order error:', e.message);
    return send(res, 502, { ok: false, error: 'No pudimos comunicarnos con el procesador de pagos. Intenta de nuevo.' });
  }
}

// ─── Suscripciones recurrentes ───────────────────────────────────────────────
// Mapa { plan_key: pln_id } generado por integrations/culqi/create-plans.js.
// Se lee perezosamente y se cachea; si el archivo no existe, no hay planes
// aprovisionados todavía y /subscribe responde 503 con un mensaje claro.
let _planMap = null;
function planMap() {
  if (_planMap == null) {
    // Los pln_ de test y live son distintos (viven en entornos separados de Culqi).
    // En modo test (sk_test) cargamos plans.test.json; en live, plans.json. Así no
    // hay swaps manuales y cambiar de modo no rompe el otro.
    const dir = path.join(__dirname, '..', 'integrations', 'culqi');
    const file = SECRET().startsWith('sk_test') ? 'plans.test.json' : 'plans.json';
    try { _planMap = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); }
    catch {
      // Sin archivo del modo actual → intentamos el live como último recurso.
      try { _planMap = JSON.parse(fs.readFileSync(path.join(dir, 'plans.json'), 'utf8')); }
      catch { _planMap = {}; }
    }
  }
  return _planMap;
}
function planIdFor(key) { return planMap()[key] || null; }

// GET /api/culqi/plans-status → { ready } : true si hay planes aprovisionados y
// la llave secreta está configurada (el front decide si abre Culqi o coordina por WA).
function plansStatus(req, res) {
  const ready = !!SECRET() && Object.keys(planMap()).length > 0;
  return send(res, 200, { ready });
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] || 'Cliente', last: 'Lima Flores' };
  return { first: parts.slice(0, -1).join(' '), last: parts[parts.length - 1] };
}

// Culqi rechaza acentos/caracteres especiales en varios campos → texto ASCII simple.
// (La dirección real, con tildes y todo, queda intacta en nuestra tabla subscriptions.)
function culqiText(s, max, fallback) {
  const out = String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 -]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  return out.length ? out : (fallback || 'NA');
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
  // Campos de comprador/entrega comunes a ambos flujos (recurrente y pago único).
  const baseRecord = {
    planKey, model, tier: entry.tier, amount: entry.amountSoles, intervalCount: entry.intervalCount,
    buyerName: b.buyer_name, buyerEmail: email, buyerPhone: b.buyer_phone,
    recipientName: b.recipient_name, recipientPhone: b.recipient_phone,
    recipientAddress: b.recipient_address, recipientDistrict: b.recipient_district || null,
    recipientAddressRef: b.recipient_address_ref || null, recipientApt: b.recipient_apt || null,
    recipientLat: typeof b.recipient_lat === 'number' ? b.recipient_lat : null,
    recipientLng: typeof b.recipient_lng === 'number' ? b.recipient_lng : null,
    recipientHasReception: typeof b.recipient_has_reception === 'boolean' ? b.recipient_has_reception : null,
    deliveryTime: b.delivery_time || null,
    deliveryPref: b.delivery_pref || b.delivery_time || null, notes: b.notes || null,
  };

  // ── Planes recurrentes (mensual, a_prueba) crean suscripción en Culqi; el resto
  //    (trimestral/semestral/anual, b_prueba) es PAGO ÚNICO (un solo cargo). ────────
  if (!entry.recurring) {
    const amountCents = Math.round(entry.amountSoles * 100);
    if (amountCents < 100) return send(res, 400, { error: 'Monto inválido.' });
    try {
      const ch = await culqiPost('/v2/charges', {
        amount: amountCents, currency_code: 'PEN', email, source_id: token,
        description: culqiText(`Lima Flores prepago ${entry.label || entry.tier}`, 80, 'Lima Flores prepago'),
        metadata: { plan_key: planKey, tier: entry.tier, source: 'web-suscripcion-prepago' },
      });
      if (!((ch.status === 200 || ch.status === 201) && ch.json && ch.json.object === 'charge')) {
        return send(res, 402, { ok: false, error: culqiError(ch.json), code: ch.json && ch.json.code });
      }
      const chargeId = ch.json.id;
      try {
        await subsStore.create({ id: chargeId, planId: null, customerId: null, cardId: null, recurring: false, chargeId, ...baseRecord });
      } catch (e) { console.error('[culqi] prepay persist error:', e.message); }
      // Aviso a Google Chat (fire-and-forget; no bloquea ni rompe la suscripción).
      setImmediate(() => gchat.notifyNewSubscription({ id: chargeId, recurring: false, planLabel: entry.label || entry.tier, ...baseRecord }).catch((e) => console.error('[culqi] gchat sub error:', e.message)));
      return send(res, 200, { ok: true, charge_id: chargeId, plan_key: planKey, amount: entry.amountSoles, prepaid: true });
    } catch (e) {
      console.error('[culqi] prepay error:', e.message);
      return send(res, 502, { ok: false, error: 'No pudimos comunicarnos con el procesador de pagos. Intenta de nuevo.' });
    }
  }

  // ── Suscripción mensual recurrente (customer + card + subscription en Culqi). ──
  const planId = planIdFor(planKey);
  if (!planId) return send(res, 503, { error: 'Este plan aún no está disponible (planes no aprovisionados en Culqi).' });

  try {
    // 1) Customer
    const cust = await culqiPost('/v2/customers', {
      first_name: culqiText(first, 50, 'Cliente'),
      last_name: culqiText(last, 50, 'Lima Flores'),
      email,
      address: culqiText(b.recipient_address, 100, 'Lima'),
      address_city: culqiText(b.recipient_district || 'Lima', 30, 'Lima'),
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
    const sub = await culqiPost('/v2/recurrent/subscriptions/create', {
      card_id: cardId, plan_id: planId, tyc: true,
      metadata: { plan_key: planKey, model, source: 'web-suscripcion' },
    });
    const subId = sub.json && (sub.json.id || sub.json.subscription_id);
    if (!((sub.status === 200 || sub.status === 201) && subId)) {
      return send(res, 402, { ok: false, error: culqiError(sub.json) || 'No se pudo crear la suscripción.' });
    }

    // Persistimos (no bloquea la respuesta si la BD falla).
    try {
      await subsStore.create({ id: subId, planId, customerId, cardId, recurring: true, chargeId: null, ...baseRecord });
    } catch (e) { console.error('[culqi] subscribe persist error:', e.message); }

    // Aviso a Google Chat (fire-and-forget; no bloquea ni rompe la suscripción).
    setImmediate(() => gchat.notifyNewSubscription({ id: subId, recurring: true, planLabel: entry.label || entry.tier, ...baseRecord }).catch((e) => console.error('[culqi] gchat sub error:', e.message)));

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
  // Fail-safe: sin secreto configurado NO procesamos el evento. Un webhook abierto
  // permitiría a cualquiera cancelar suscripciones ajenas (setStatus más abajo) o
  // inundar la tabla de eventos. Respondemos 200 para que Culqi no reintente en
  // bucle, pero ignoramos el contenido hasta que se configure CULQI_WEBHOOK_SECRET.
  if (!need) {
    console.warn('[culqi] webhook recibido sin CULQI_WEBHOOK_SECRET configurado — evento ignorado por seguridad.');
    return send(res, 200, { ok: true, ignored: true });
  }
  // Secreto por cabecera (preferido) o query (compat), en tiempo constante.
  const provided = String(req.headers['x-culqi-secret'] || (parsed.searchParams && parsed.searchParams.get('secret')) || '');
  if (!safeEqStr(provided, need)) return send(res, 401, { error: 'unauthorized' });

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
  if (p === '/api/culqi/plans-status' && req.method === 'GET') return plansStatus(req, res);
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });
  if (p === '/api/culqi/order') return createOrder(req, res);
  if (p === '/api/culqi/charge') return charge(req, res);
  if (p === '/api/culqi/subscribe') return subscribe(req, res);
  if (p === '/api/culqi/webhook') return webhook(req, res, parsed);
  return send(res, 404, { error: 'culqi route not found' });
};
