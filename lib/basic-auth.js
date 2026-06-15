// Auth para el panel admin.
// Soporta dos modos:
//   1. Cookie de sesión firmada (HMAC-SHA256) — usada por el login HTML.
//   2. HTTP Basic Auth — fallback retro-compat (curl, scripts, etc.).
//
// Credenciales: ADMIN_USER + ADMIN_PASS en env vars (Railway).
// Secreto de firma: ADMIN_SESSION_SECRET (opcional). Si no está, se deriva de ADMIN_PASS.
'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'lf_admin';
// Duración de la sesión admin. Por defecto 300 días (el admin no quiere reloguear
// cada rato). Override con ADMIN_SESSION_TTL_DAYS. (Chrome topa cookies a 400 días.)
const SESSION_TTL_DAYS = Number(process.env.ADMIN_SESSION_TTL_DAYS) || 300;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;

function getSecret() {
  return process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_PASS || '';
}

// Lista de usuarios admin permitidos. El principal es ADMIN_USER/ADMIN_PASS;
// se pueden añadir más con ADMIN_USER2/ADMIN_PASS2, ADMIN_USER3/ADMIN_PASS3…
function adminUsers() {
  const list = [];
  const add = (u, p) => { if (u && p) list.push({ user: u, pass: p }); };
  add(process.env.ADMIN_USER, process.env.ADMIN_PASS);
  add(process.env.ADMIN_USER2, process.env.ADMIN_PASS2);
  add(process.env.ADMIN_USER3, process.env.ADMIN_PASS3);
  return list;
}

// ¿El username corresponde a un admin? (la firma de la cookie es la barrera real).
function isAdminUser(user) {
  return adminUsers().some((c) => c.user === user);
}

function safeEq(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
  catch { return false; }
}

function signSession(user, expiresAt) {
  const payload = `${user}|${expiresAt}`;
  const sig = crypto.createHmac('sha256', getSecret()).update(payload).digest('hex');
  return `${payload}|${sig}`;
}

function verifySession(cookieValue) {
  if (!cookieValue) return null;
  const parts = cookieValue.split('|');
  if (parts.length !== 3) return null;
  const [user, expStr, sig] = parts;
  const expiresAt = Number(expStr);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return null;
  if (!isAdminUser(user)) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(`${user}|${expStr}`).digest('hex');
  if (!safeEq(expected, sig)) return null;
  return { user, expiresAt };
}

function parseCookie(header, name) {
  if (!header) return null;
  const parts = header.split(';');
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq < 0) continue;
    const k = p.slice(0, eq).trim();
    if (k === name) {
      try { return decodeURIComponent(p.slice(eq + 1).trim()); }
      catch { return null; }
    }
  }
  return null;
}

function isSecureRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  const xfp = req.headers['x-forwarded-proto'];
  if (typeof xfp === 'string' && xfp.split(',')[0].trim() === 'https') return true;
  return false;
}

function buildSetCookie(value, { maxAgeMs, secure, clear = false } = {}) {
  // Admin cross-origin (app React en otro dominio): la cookie debe viajar en
  // peticiones cross-site, lo que exige SameSite=None; Secure. Se activa con
  // CROSS_ORIGIN_ADMIN=1. Por defecto queda SameSite=Strict (same-origin, seguro).
  const crossOrigin = process.env.CROSS_ORIGIN_ADMIN === '1';
  const sameSite = crossOrigin ? 'None' : 'Strict';
  const parts = [`${COOKIE_NAME}=${value}`, 'Path=/', 'HttpOnly', `SameSite=${sameSite}`];
  if (clear) {
    parts.push('Max-Age=0');
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  } else if (maxAgeMs) {
    parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  }
  if (secure || crossOrigin) parts.push('Secure'); // SameSite=None obliga Secure
  return parts.join('; ');
}

function issueSessionCookie(req, res, user) {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const value = signSession(user, expiresAt);
  res.setHeader('Set-Cookie', buildSetCookie(value, {
    maxAgeMs: SESSION_TTL_MS,
    secure: isSecureRequest(req),
  }));
}

function clearSessionCookie(req, res) {
  res.setHeader('Set-Cookie', buildSetCookie('', {
    clear: true,
    secure: isSecureRequest(req),
  }));
}

// Verifica credenciales contra la lista de admins (comparación en tiempo constante).
function credentialsMatch(user, pass) {
  let ok = false;
  for (const c of adminUsers()) {
    // Sin short-circuit: evaluamos todos para no filtrar por timing cuál coincidió.
    if (safeEq(user, c.user) && safeEq(pass, c.pass)) ok = true;
  }
  return ok;
}

// Comprueba auth en una request entrante.
// Retorna true si pasa; si no, responde con JSON (sin WWW-Authenticate) y retorna false.
function checkAdminAuth(req, res) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Admin no configurado — falta ADMIN_USER/ADMIN_PASS.' }));
    return false;
  }

  // 1) Cookie de sesión firmada.
  const cookie = parseCookie(req.headers.cookie, COOKIE_NAME);
  if (cookie && verifySession(cookie)) return true;

  // 2) Basic Auth (retro-compat con curl/scripts).
  const header = req.headers.authorization || '';
  if (header.startsWith('Basic ')) {
    let decoded = '';
    try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); }
    catch { decoded = ''; }
    const idx = decoded.indexOf(':');
    const u = idx >= 0 ? decoded.slice(0, idx) : decoded;
    const p = idx >= 0 ? decoded.slice(idx + 1) : '';
    if (credentialsMatch(u, p)) return true;
  }

  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Auth requerida' }));
  return false;
}

module.exports = {
  checkAdminAuth,
  credentialsMatch,
  issueSessionCookie,
  clearSessionCookie,
  // Alias legacy (por si algún script externo lo importa).
  checkBasicAuth: checkAdminAuth,
};
