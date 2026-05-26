// 99minutos — cliente mínimo (OAuth client_credentials + tarifas + crear envío + tracking)
// Docs: https://developers.99minutos.com/  ·  llms.txt: https://developers.99minutos.com/llms.txt
// Node 18+ (fetch nativo, sin dependencias)
'use strict';

// 99minutos usa la MISMA base para sandbox y producción.
// La separación es por credenciales (creas cuentas independientes para cada entorno).
const BASE = process.env.NINETYNINE_BASE_URL || 'https://delivery.99minutos.com';
const ENV  = process.env.NINETYNINE_ENV === 'production' ? 'production' : 'sandbox';

// ─── OAuth client_credentials ──────────────────────────
// POST {BASE}/api/v3/oauth/token  (form-urlencoded estándar OAuth 2.0)
let _token = null, _exp = 0;
async function getToken() {
  const now = Date.now();
  if (_token && now < _exp - 60_000) return _token;

  const id     = process.env.NINETYNINE_CLIENT_ID;
  const secret = process.env.NINETYNINE_CLIENT_SECRET;
  if (!id || !secret) {
    throw new Error('Falta NINETYNINE_CLIENT_ID / NINETYNINE_CLIENT_SECRET — copia .env.example a .env y complétalo.');
  }

  // La doc acepta JSON o form-urlencoded; usamos form (más estándar para OAuth2).
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: id,
    client_secret: secret,
  });

  const res = await fetch(`${BASE}/api/v3/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) throw new Error(`99minutos OAuth falló (${res.status}): ${await res.text()}`);

  const data = await res.json();
  _token = data.access_token;
  _exp = now + (Number(data.expires_in) || 3600) * 1000;
  if (!_token) throw new Error(`99minutos OAuth: respuesta sin access_token: ${JSON.stringify(data)}`);
  return _token;
}

async function api(path, { method = 'GET', body } = {}) {
  const token = await getToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return json;
}

// ─── Cotización ────────────────────────────────────────
// POST /api/v3/shipping/rates
// "Estimate shipping cost and validate coverage based on origin and destination,
//  package dimensions, and weight."
//
// Estructura típica del body (confirmar campos exactos con tu cuenta):
//   {
//     origin:      { country, zipcode?, address?, lat?, lng? },
//     destination: { country, zipcode?, address?, lat?, lng? },
//     package:     { weight, height, width, length }  // gramos / cm
//   }
function rates(payload) {
  return api('/api/v3/shipping/rates', { method: 'POST', body: payload });
}

// Variante GET por coordenadas (útil para previews rápidos):
// GET /api/v3/shipping/rates/coordinates/{origin_country}/{origin_lat}/{origin_lng}/
//     {destination_country}/{destination_lat}/{destination_lng}/{weight}/{height}/{width}/{length}
function ratesByCoords({ origin, destination, weight, height, width, length }) {
  const p = [
    'coordinates',
    origin.country, origin.lat, origin.lng,
    destination.country, destination.lat, destination.lng,
    weight, height, width, length,
  ].join('/');
  return api(`/api/v3/shipping/rates/${p}`);
}

// ─── Crear envío ───────────────────────────────────────
// POST /api/v3/orders
function createOrder(order) {
  return api('/api/v3/orders', { method: 'POST', body: order });
}

// ─── Tracking ──────────────────────────────────────────
// GET /api/v3/shipments/tracking?identifiers={trackingId}
function tracking(identifier) {
  return api(`/api/v3/shipments/tracking?identifiers=${encodeURIComponent(identifier)}`);
}

// GET /api/v3/shipments/tracking/batch?identifiers=a&identifiers=b
function trackingBatch(identifiers = []) {
  const qs = identifiers.map((id) => `identifiers=${encodeURIComponent(id)}`).join('&');
  return api(`/api/v3/shipments/tracking/batch?${qs}`);
}

module.exports = { ENV, BASE, getToken, rates, ratesByCoords, createOrder, tracking, trackingBatch, api };
