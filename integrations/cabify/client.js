// Cabify Logistics — cliente mínimo (auth + tipos de envío + cotización)
// Docs: https://cabify-api.readme.io/  ·  Node 18+ (usa fetch nativo, sin dependencias)
'use strict';

const ENV = process.env.CABIFY_ENV === 'production' ? 'production' : 'sandbox';

const BASES = {
  sandbox: {
    auth: 'https://cabify-sandbox.com',
    logistics: 'https://logistics.api.cabify-sandbox.com',
  },
  production: {
    // Confirmar las URLs de producción con Cabify al activar la cuenta.
    auth: process.env.CABIFY_AUTH_BASE || 'https://cabify.com',
    logistics: process.env.CABIFY_LOGISTICS_BASE || 'https://logistics.api.cabify.com',
  },
};
const base = BASES[ENV];

let _token = null;
let _tokenExp = 0;

// OAuth client_credentials → access_token (dura ~30 días; lo cacheamos)
async function getToken() {
  const now = Date.now();
  if (_token && now < _tokenExp - 60_000) return _token;

  const id = process.env.CABIFY_CLIENT_ID;
  const secret = process.env.CABIFY_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('Falta CABIFY_CLIENT_ID / CABIFY_CLIENT_SECRET — copia .env.example a .env y complétalo.');
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: id,
    client_secret: secret,
  });

  const res = await fetch(`${base.auth}/auth/api/authorization`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`Auth falló (${res.status}): ${await res.text()}`);

  const data = await res.json();
  _token = data.access_token;
  _tokenExp = now + (Number(data.expires_in) || 0) * 1000;
  return _token;
}

async function api(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  const res = await fetch(`${base.logistics}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return json;
}

// GET /v1/shipping_types/available?location=lat,lon
function shippingTypes(lat, lon) {
  return api(`/v1/shipping_types/available?location=${lat},${lon}`);
}

// POST /v3/parcels/estimate
// pickup / dropoff: { latitude, longitude }  ó  { address: "..." }
// dimensions (cm): { height, length, width }   weight (g): { value }
function estimate({ shippingTypeId, pickup, dropoff, dimensions, weight, pickupTime }) {
  const parcel = {
    external_id: 'lima-flores-test',
    pickup_location: pickup,
    dropoff_location: dropoff,
  };
  if (dimensions) parcel.dimensions = dimensions;
  if (weight) parcel.weight = weight;

  const body = { shipping_type_id: shippingTypeId, parcels: [parcel] };
  if (pickupTime) body.pickup_time = pickupTime; // RFC3339 → para entrega programada

  return api('/v3/parcels/estimate', { method: 'POST', body });
}

module.exports = { ENV, base, getToken, shippingTypes, estimate, api };
