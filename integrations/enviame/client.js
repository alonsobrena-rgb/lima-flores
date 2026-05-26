// Envíame — cliente mínimo (v2 tarifas con api-key + v3 envíos/tracking con OAuth)
// Docs: https://docs.enviame.io/  ·  Node 18+ (fetch nativo)
'use strict';

const ENV = process.env.ENVIAME_ENV === 'production' ? 'production' : 'stage';

const BASES = {
  stage:      { root: 'https://stage.api.enviame.io' },
  production: { root: 'https://api.enviame.io' },
};
const base = BASES[ENV];

const API_KEY = process.env.ENVIAME_API_KEY; // header `api-key` para v2

// ─── v3 · OAuth (Auth0 client_credentials) ─────────────
// Soporte de Envíame te entrega: ENVIAME_AUTH_URL, ENVIAME_AUDIENCE, ENVIAME_CLIENT_ID, ENVIAME_CLIENT_SECRET
let _token = null, _exp = 0;
async function getOAuthToken() {
  const now = Date.now();
  if (_token && now < _exp - 60_000) return _token;

  const url      = process.env.ENVIAME_AUTH_URL;
  const id       = process.env.ENVIAME_CLIENT_ID;
  const secret   = process.env.ENVIAME_CLIENT_SECRET;
  const audience = process.env.ENVIAME_AUDIENCE;
  if (!url || !id || !secret) {
    throw new Error('Falta ENVIAME_AUTH_URL / ENVIAME_CLIENT_ID / ENVIAME_CLIENT_SECRET (lo entrega soporte de Envíame).');
  }

  const body = { grant_type: 'client_credentials', client_id: id, client_secret: secret };
  if (audience) body.audience = audience;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Auth0 falló (${res.status}): ${await res.text()}`);

  const data = await res.json();
  _token = data.access_token;
  _exp = now + (Number(data.expires_in) || 0) * 1000;
  return _token;
}

// ─── v2 · cotización de tarifas (header api-key) ───────
// GET {root}/api/s2/v2/rates?params
// Los nombres exactos de parámetros (origin_place, destination_place, weight, etc.)
// dependen de la cuenta/país — confirmar en tu doc de Envíame.
async function rates(params = {}) {
  if (!API_KEY) throw new Error('Falta ENVIAME_API_KEY (header api-key de v2).');
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${base.root}/api/s2/v2/rates${qs ? `?${qs}` : ''}`, {
    headers: { 'api-key': API_KEY, Accept: 'application/json' },
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`rates → ${res.status}: ${text}`);
  return json;
}

// ─── v3 · crear envío + tracking (Bearer) ──────────────
async function v3(path, { method = 'GET', body } = {}) {
  const token = await getOAuthToken();
  const res = await fetch(`${base.root}/v3${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json; try { json = text ? JSON.parse(text) : null; } catch { json = text; }
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return json;
}

// POST /v3/companies/{company_id}/deliveries
function createDelivery(companyId, delivery) {
  return v3(`/companies/${companyId}/deliveries`, { method: 'POST', body: delivery });
}

// GET /v3/deliveries/{identifier}/tracking  (identifier = delivery_id | imported_id | tracking_number)
function tracking(identifier) {
  return v3(`/deliveries/${identifier}/tracking`);
}

module.exports = { ENV, base, rates, createDelivery, tracking, getOAuthToken };
