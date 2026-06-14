// /api/admin/* — endpoints protegidos por cookie de sesión (o Basic Auth como fallback).
// Credenciales: ADMIN_USER + ADMIN_PASS en env vars (Railway).
//
// Rutas:
//   POST /api/admin/login                   → valida user/pass y emite cookie de sesión
//   POST /api/admin/logout                  → limpia la cookie
//   GET  /api/admin/me                      → 200 si la sesión es válida (sirve para el front)
//   GET  /api/admin/orders                  → lista pedidos (default: pending)
//   GET  /api/admin/orders/:id              → detalle del pedido
//   POST /api/admin/orders/:id/dispatch     → crea el parcel en Cabify y marca como 'dispatched'
//   POST /api/admin/orders/:id/cancel       → marca como 'cancelled'
'use strict';

const db = require('../db');
const {
  checkAdminAuth,
  credentialsMatch,
  issueSessionCookie,
  clearSessionCookie,
} = require('../lib/basic-auth');
const {
  shippingTypes: cabifyShippingTypes,
  createParcel: cabifyCreateParcel,
} = require('../integrations/cabify/client');
const { generateAndStoreCard } = require('../integrations/cards/order-card');
const products = require('../db/products-store');
const adminStudio = require('./admin-studio');

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

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

// El PNG de la tarjeta (bytea) no debe viajar en los JSON de listado/detalle:
// es pesado y se sirve por su propia ruta. Lo sustituimos por un flag has_card.
function stripCardPng(row) {
  if (!row) return row;
  const { card_png, ...rest } = row;
  rest.has_card = !!card_png;
  return rest;
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
    return send(res, 200, { orders: rows.map(stripCardPng) });
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
    return send(res, 200, stripCardPng(rows[0]));
  } catch (e) {
    return send(res, 500, { error: e.message });
  }
}

// ─── Tarjeta de regalo (PNG) ────────────────────────────
// GET  → devuelve el PNG (lo genera al vuelo si aún no existe).
// POST → fuerza regenerar (nueva plantilla al azar).
async function getCard(req, res, id, { force = false } = {}) {
  let order;
  try {
    const { rows } = await db.query(`SELECT * FROM orders WHERE id = $1`, [id]);
    if (!rows.length) return send(res, 404, { error: 'No existe ese pedido' });
    order = rows[0];
  } catch (e) {
    return send(res, 500, { error: e.message });
  }

  if (!order.card_note || !order.card_note.trim()) {
    return send(res, 404, { error: 'Este pedido no tiene mensaje de tarjeta.' });
  }

  // Si no hay PNG todavía (o se pide regenerar), lo generamos ahora.
  if (force || !order.card_png) {
    const r = await generateAndStoreCard(order);
    if (!r.ok) return send(res, 502, { error: 'No se pudo generar la tarjeta: ' + r.error });
    const png = r.buffer;
    res.writeHead(200, {
      'Content-Type': 'image/png',
      'Content-Length': png.length,
      'Cache-Control': 'no-store',
      'Content-Disposition': `inline; filename="tarjeta-${id}.png"`,
    });
    return res.end(png);
  }

  const png = order.card_png; // bytea → Buffer vía pg
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Content-Length': png.length,
    'Cache-Control': 'no-store',
    'Content-Disposition': `inline; filename="tarjeta-${id}.png"`,
  });
  return res.end(png);
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

// ─── Login / Logout (cookie de sesión) ──────────────────
function readJsonBody(req, limit = 4 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function login(req, res) {
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
    return send(res, 503, { error: 'Admin no configurado — falta ADMIN_USER/ADMIN_PASS.' });
  }
  let body;
  try { body = await readJsonBody(req); }
  catch (e) { return send(res, 400, { error: e.message }); }
  const user = String(body.user || body.username || '').trim();
  const pass = String(body.pass || body.password || '');
  if (!user || !pass) return send(res, 400, { error: 'Faltan credenciales.' });
  if (!credentialsMatch(user, pass)) {
    return send(res, 401, { error: 'Credenciales inválidas.' });
  }
  issueSessionCookie(req, res, user);
  return send(res, 200, { ok: true });
}

function logout(req, res) {
  clearSessionCookie(req, res);
  return send(res, 200, { ok: true });
}

// ─── Productos (CRUD) ───────────────────────────────────
async function listProducts(req, res) {
  try { return send(res, 200, { products: await products.listAll() }); }
  catch (e) { return send(res, 500, { error: e.message }); }
}

async function getProductAdmin(req, res, id) {
  try {
    const p = await products.getById(id, { internal: true });
    return p ? send(res, 200, p) : send(res, 404, { error: 'No existe ese producto' });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

async function createProduct(req, res) {
  let body;
  try { body = await readJsonBody(req, 256 * 1024); }
  catch (e) { return send(res, 400, { error: e.message }); }
  try { return send(res, 201, await products.create(body)); }
  catch (e) { return send(res, 400, { error: e.message }); }
}

async function updateProduct(req, res, id) {
  let body;
  try { body = await readJsonBody(req, 256 * 1024); }
  catch (e) { return send(res, 400, { error: e.message }); }
  try {
    const p = await products.update(id, body);
    return p ? send(res, 200, p) : send(res, 404, { error: 'No existe ese producto' });
  } catch (e) { return send(res, 400, { error: e.message }); }
}

async function deleteProduct(req, res, id) {
  try {
    const ok = await products.remove(id);
    return ok ? send(res, 200, { id, deleted: true }) : send(res, 404, { error: 'No existe ese producto' });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

// POST /api/admin/products/upload-image  body: { dataBase64, mime, productId? }
// Guarda el binario en product_images y devuelve una URL absoluta servible.
async function uploadProductImage(req, res) {
  let body;
  try { body = await readJsonBody(req, 12 * 1024 * 1024); }
  catch (e) { return send(res, 400, { error: e.message }); }
  let { dataBase64, mime, productId } = body || {};
  if (!dataBase64) return send(res, 400, { error: 'Falta dataBase64.' });
  // Acepta data URLs (data:image/png;base64,....).
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataBase64);
  if (m) { mime = mime || m[1]; dataBase64 = m[2]; }
  let buf;
  try { buf = Buffer.from(dataBase64, 'base64'); }
  catch { return send(res, 400, { error: 'base64 inválido.' }); }
  if (!buf.length) return send(res, 400, { error: 'Imagen vacía.' });
  if (buf.length > 10 * 1024 * 1024) return send(res, 413, { error: 'Imagen demasiado grande (máx 10MB).' });
  try {
    const id = await products.saveImage({ productId: productId || null, data: buf, mime: mime || 'image/jpeg' });
    const rel = `/api/products/img/${id}`;
    return send(res, 201, { id, url: PUBLIC_BASE_URL ? PUBLIC_BASE_URL + rel : rel, path: rel });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

// ─── Router ─────────────────────────────────────────────
module.exports = async (req, res, urlObj) => {
  const p = urlObj.pathname;

  // Login es público (es donde se obtienen las credenciales).
  if (p === '/api/admin/login' && req.method === 'POST') return login(req, res);
  // Logout no requiere auth (es idempotente y solo borra la cookie).
  if (p === '/api/admin/logout' && req.method === 'POST') return logout(req, res);

  // El resto exige sesión válida.
  if (!checkAdminAuth(req, res)) return;

  // Endpoint barato para que el front sepa si la sesión sigue viva.
  if (p === '/api/admin/me' && req.method === 'GET') return send(res, 200, { ok: true });

  if (!db.enabled) return send(res, 503, { error: 'DB no configurada en el servidor.' });

  if (p === '/api/admin/orders' && req.method === 'GET') return listOrders(req, res, urlObj);

  // ── Marketing Studio ──
  if (p.startsWith('/api/admin/studio/')) return adminStudio(req, res, urlObj);

  // ── Productos ──
  if (p === '/api/admin/products' && req.method === 'GET')  return listProducts(req, res);
  if (p === '/api/admin/products' && req.method === 'POST') return createProduct(req, res);
  if (p === '/api/admin/products/upload-image' && req.method === 'POST') return uploadProductImage(req, res);
  const pm = p.match(/^\/api\/admin\/products\/([^/]+)$/);
  if (pm) {
    const pid = decodeURIComponent(pm[1]);
    if (req.method === 'GET')    return getProductAdmin(req, res, pid);
    if (req.method === 'PUT')    return updateProduct(req, res, pid);
    if (req.method === 'PATCH')  return updateProduct(req, res, pid);
    if (req.method === 'DELETE') return deleteProduct(req, res, pid);
  }

  const m = p.match(/^\/api\/admin\/orders\/([A-Za-z0-9_\-]+)(?:\/(dispatch|cancel|card))?$/);
  if (m) {
    const id = m[1];
    const action = m[2];
    if (!action && req.method === 'GET')                 return getOrder(req, res, id);
    if (action === 'dispatch' && req.method === 'POST')  return dispatchOrder(req, res, id);
    if (action === 'cancel'   && req.method === 'POST')  return cancelOrder(req, res, id);
    if (action === 'card'     && req.method === 'GET')   return getCard(req, res, id);
    if (action === 'card'     && req.method === 'POST')  return getCard(req, res, id, { force: true });
  }

  return send(res, 404, { error: 'admin route not found' });
};
