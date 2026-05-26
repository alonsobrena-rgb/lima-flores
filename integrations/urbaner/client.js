// Urbaner — cliente mínimo (login → token + cotización + crear orden + tracking)
// Docs: https://developers.urbaner.com/  ·  Node 18+ (fetch nativo)
//
// Auth de Urbaner = login email+password que devuelve un `auth_token`.
// El token se envía después como `Authorization: token <auth_token>`.
'use strict';

const ENV = process.env.URBANER_ENV === 'production' ? 'production' : 'sandbox';

const BASES = {
  sandbox:    { root: 'https://api.sandbox.urbaner.com/api' },
  production: { root: 'https://middleware.urbaner.com/api' },
};
const base = BASES[ENV];

// ─── Auth ──────────────────────────────────────────────
// POST {root}/client/authenticate/ → { auth_token, ... }
// Urbaner no documenta TTL del token; lo cacheamos en memoria y se refresca
// si el endpoint responde 401 (re-login transparente).
let _token = null;
async function login() {
  const email = process.env.URBANER_EMAIL;
  const password = process.env.URBANER_PASSWORD;
  if (!email || !password) {
    throw new Error('Falta URBANER_EMAIL / URBANER_PASSWORD — copia .env.example a .env y complétalo.');
  }
  const res = await fetch(`${base.root}/client/authenticate/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Urbaner login falló (${res.status}): ${await res.text()}`);
  const data = await res.json();
  _token = data.auth_token || data.token;
  if (!_token) throw new Error(`Urbaner login: respuesta sin auth_token: ${JSON.stringify(data)}`);
  return _token;
}

async function getToken() {
  if (_token) return _token;
  return login();
}

async function api(path, { method = 'GET', body, retry = true } = {}) {
  const token = await getToken();
  const res = await fetch(`${base.root}${path}`, {
    method,
    headers: {
      Authorization: `token ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && retry) {
    _token = null; // token expirado/inválido → re-login una sola vez
    return api(path, { method, body, retry: false });
  }
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return json;
}

// ─── Cotización ────────────────────────────────────────
// POST /cli/price/
// destinations: [{ latlon: "-12.119,-77.037" }, { latlon: "-12.081,-77.071" }]
// vehicle_type_id: 1=moto, 2=auto (confirmar IDs reales con tu cuenta)
// is_return: true = ida y vuelta
function price({ destinations, vehicleTypeId = 2, isReturn = false }) {
  if (!Array.isArray(destinations) || destinations.length < 2) {
    throw new Error('price: pasa al menos 2 destinos como [{latlon:"lat,lon"}, ...].');
  }
  return api('/cli/price/', {
    method: 'POST',
    body: { destinations, vehicle_type_id: vehicleTypeId, is_return: isReturn },
  });
}

// ─── Crear envío ───────────────────────────────────────
// POST /cli/order/
// destinations: [origen, destino1, destino2…] con contact_person, phone, address, latlon, interior
// payment.backend: "purse" (saldo Urbaner) | "card" (según cuenta)
function createOrder({ destinations, vehicleId = 2, description = '', payment = { backend: 'purse' }, isReturn = false, type = '1' }) {
  return api('/cli/order/', {
    method: 'POST',
    body: {
      type,
      destinations,
      vehicle_id: String(vehicleId),
      description,
      payment,
      is_return: isReturn,
    },
  });
}

// ─── Tracking ──────────────────────────────────────────
// GET /client/orders/{id}/ → estado de la orden
// (La URL pública de tracking suele venir en la respuesta de createOrder.)
function getOrder(id) {
  return api(`/client/orders/${id}/`);
}

module.exports = { ENV, base, login, getToken, price, createOrder, getOrder, api };
