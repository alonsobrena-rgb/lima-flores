// /api/admin/* — endpoints protegidos con HTTP Basic Auth.
// Credenciales: ADMIN_USER + ADMIN_PASS en env vars (Railway).
//
// Rutas:
//   GET  /api/admin/orders                  → lista pedidos (default: pending)
//   GET  /api/admin/orders/:id              → detalle del pedido
//   POST /api/admin/orders/:id/dispatch     → crea el parcel en Cabify y marca como 'dispatched'
//   POST /api/admin/orders/:id/cancel       → marca como 'cancelled'
'use strict';

const db = require('../db');
const { checkBasicAuth } = require('../lib/basic-auth');
const {
  shippingTypes: cabifyShippingTypes,
  createParcel: cabifyCreateParcel,
} = require('../integrations/cabify/client');

const ATELIER_LATLON = process.env.URBANER_PICKUP_LATLON || '-12.122272,-77.035838';
const [PICKUP_LAT_STR, PICKUP_LON_STR] = ATELIER_LATLON.split(',');
const PICKUP_LAT = Number(PICKUP_LAT_STR);
const PICKUP_LON = Number(PICKUP_LON_STR);

const ATELIER_NAME    = process.env.ATELIER_NAME    || 'Lima Flores · Atelier';
const ATELIER_PHONE   = process.env.ATELIER_PHONE   || '+51999479855';
const ATELIER_ADDRESS = process.env.ATELIER_ADDRESS || 'Calle Francia 823, Miraflores, Lima';

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

// ─── Listar pedidos ─────────────────────────────────────
async function listOrders(req, res, urlObj) {
  const status = urlObj.searchParams.get('status') || 'pending';
  const limit = Math.min(Number(urlObj.searchParams.get('limit')) || 50, 200);
  try {
    const { rows } = await db.query(
      status === 'all'
        ? `SELECT * FROM orders ORDER BY created_at DESC LIMIT $1`
        : `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC LIMIT $2`,
      status === 'all' ? [limit] : [status, limit]
    );
    return send(res, 200, { orders: rows });
  } catch (e) {
    console.error('[admin] listOrders error:', e.message);
    return send(res, 500, { error: e.message });
  }
}

// ─── Detalle de un pedido ───────────────────────────────
async function getOrder(req, res, id) {
  try {
    const { rows } = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    if (!rows.length) return send(res, 404, { error: 'No existe ese pedido' });
    return send(res, 200, rows[0]);
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}

// ─── Despachar (crear parcel en Cabify) ─────────────────
async function dispatchOrder(req, res, id) {
  let order;
  try {
    const { rows } = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    if (!rows.length) return send(res, 404, { error: 'No existe ese pedido' });
    order = rows[0];
  } catch (e) {
    return send(res, 500, { error: e.message });
  }

  if (order.status !== 'pending') {
    return send(res, 409, { error: `Pedido ya está en estado "${order.status}"` });
  }

  // 1. Buscar shipping_type disponible para la dirección destino.
  let shippingTypeId;
  try {
    const types = await cabifyShippingTypes(Number(order.recipient_lat), Number(order.recipient_lng));
    const list = Array.isArray(types)
      ? types
      : (types?.available_shipping_types || types?.shipping_types || types?.data || []);
    const forcedId = process.env.CABIFY_SHIPPING_TYPE_ID;
    let chosen = forcedId ? list.find((t) => (t.id || t.shipping_type_id) === forcedId) : null;
    if (!chosen) chosen = list.find((t) => {
      const nm = (t.name || t.label || '').toString().toLowerCase();
      if (/comida|food/.test(nm)) return false;
      return /express|standard|standar|env[íi]o/.test(nm);
    });
    if (!chosen) chosen = list[0];
    if (!chosen) throw new Error('Cabify: sin shipping_types en esa zona');
    shippingTypeId = chosen.id || chosen.shipping_type_id;
  } catch (e) {
    await markDispatchError(id, `Cabify shippingTypes: ${e.message}`);
    return send(res, 502, { error: 'Cabify rechazó el destino: ' + e.message });
  }

  // 2. Crear el parcel real.
  const recipientPhone = String(order.recipient_phone || '').replace(/\s+/g, '');
  const buyerPhone     = String(order.buyer_phone || '').replace(/\s+/g, '');
  const dropoffNotes = [
    order.recipient_apt   ? `Dpto/piso: ${order.recipient_apt}` : null,
    order.recipient_address_ref ? `Ref: ${order.recipient_address_ref}` : null,
    order.recipient_has_reception ? 'Hay recepción' : 'No hay recepción',
    order.card_note       ? `Tarjeta: "${order.card_note}"` : null,
  ].filter(Boolean).join(' · ');

  let cabifyResp;
  try {
    cabifyResp = await cabifyCreateParcel({
      shippingTypeId,
      externalId: order.id,
      pickup: {
        location: { lat: PICKUP_LAT, lon: PICKUP_LON },
        address: ATELIER_ADDRESS,
        contact: { name: ATELIER_NAME, phone: ATELIER_PHONE },
        instructions: 'Recoger arreglo de flores listo para entrega.',
      },
      dropoff: {
        location: { lat: Number(order.recipient_lat), lon: Number(order.recipient_lng) },
        address: order.recipient_address || undefined,
        contact: { name: order.recipient_name, phone: recipientPhone },
        instructions: dropoffNotes || undefined,
      },
      dimensions: {
        height: Number(process.env.LF_PARCEL_HEIGHT_CM || 50),
        length: Number(process.env.LF_PARCEL_LENGTH_CM || 50),
        width:  Number(process.env.LF_PARCEL_WIDTH_CM  || 45),
        unit: 'cm',
      },
      weight: {
        value: Number(process.env.LF_PARCEL_WEIGHT_G || 6000),
        unit: 'g',
      },
      description: `Lima Flores ${order.id} — ${order.recipient_name}`,
    });
  } catch (e) {
    await markDispatchError(id, `Cabify createParcel: ${e.message}`);
    return send(res, 502, { error: 'Cabify no aceptó la orden: ' + e.message });
  }

  // 3. Persistir en BD.
  const cabifyId = cabifyResp?.parcels?.[0]?.id
                || cabifyResp?.id
                || cabifyResp?.parcel_id
                || null;
  try {
    await db.query(
      `UPDATE orders
         SET status = 'dispatched',
             cabify_order_id = $1,
             cabify_response = $2,
             dispatched_at = NOW(),
             dispatch_error = NULL
       WHERE id = $3`,
      [cabifyId, JSON.stringify(cabifyResp), id]
    );
  } catch (e) {
    console.error('[admin] update post-dispatch error:', e.message);
    // Cabify ya creó la orden — devolvemos OK pero loggeamos.
  }

  return send(res, 200, { id, status: 'dispatched', cabify_order_id: cabifyId, cabify: cabifyResp });
}

async function markDispatchError(id, msg) {
  try {
    await db.query(`UPDATE orders SET dispatch_error = $1 WHERE id = $2`, [msg, id]);
  } catch (_) { /* swallow */ }
}

// ─── Cancelar ───────────────────────────────────────────
async function cancelOrder(req, res, id) {
  try {
    const { rowCount } = await db.query(
      `UPDATE orders SET status = 'cancelled' WHERE id = $1 AND status = 'pending'`,
      [id]
    );
    if (!rowCount) return send(res, 409, { error: 'No se pudo cancelar (puede que ya esté despachado)' });
    return send(res, 200, { id, status: 'cancelled' });
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}

// ─── Router ─────────────────────────────────────────────
module.exports = async (req, res, urlObj) => {
  if (!checkBasicAuth(req, res)) return;
  if (!db.enabled) return send(res, 503, { error: 'DB no configurada en el servidor.' });

  const p = urlObj.pathname;

  if (p === '/api/admin/orders' && req.method === 'GET') return listOrders(req, res, urlObj);

  const m = p.match(/^\/api\/admin\/orders\/([A-Za-z0-9_\-]+)(?:\/(dispatch|cancel))?$/);
  if (m) {
    const id = m[1];
    const action = m[2];
    if (!action && req.method === 'GET')                 return getOrder(req, res, id);
    if (action === 'dispatch' && req.method === 'POST')  return dispatchOrder(req, res, id);
    if (action === 'cancel'   && req.method === 'POST')  return cancelOrder(req, res, id);
  }

  return send(res, 404, { error: 'admin route not found' });
};
