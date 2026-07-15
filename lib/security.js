// Utilidades de seguridad sin dependencias externas:
//   - applySecurityHeaders: cabeceras defensivas para TODAS las respuestas.
//   - clientIp: IP real detrás del proxy de Railway (x-forwarded-for).
//   - rateLimit: limitador en memoria (ventana fija) por clave.
//   - safeEqStr: comparación en tiempo constante de strings (anti-timing).
'use strict';

const crypto = require('crypto');

function isSecureRequest(req) {
  if (req.socket && req.socket.encrypted) return true;
  const xfp = req.headers['x-forwarded-proto'];
  if (typeof xfp === 'string' && xfp.split(',')[0].trim() === 'https') return true;
  return false;
}

// Cabeceras de seguridad aplicables a todas las respuestas. No incluimos una CSP
// estricta para no romper el frontend (Culqi/Maps cargan scripts externos); las
// cabeceras de aquí no rompen nada y suben bastante el piso de seguridad.
function applySecurityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), payment=(self)');
  if (isSecureRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

// IP del cliente. Detrás del proxy de Railway la real viene en x-forwarded-for
// (primer hop). Sin proxy, cae al remoteAddress del socket.
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return (req.socket && req.socket.remoteAddress) || 'unknown';
}

// ─── Rate limiting en memoria (ventana fija por clave) ───
// Suficiente para un solo proceso Node (el caso de Railway). Se reinicia con el
// deploy; no persiste. No sustituye a un WAF, pero corta fuerza bruta y spam.
const _buckets = new Map();
let _lastSweep = 0;

function rateLimit(key, limit, windowMs) {
  const now = Date.now();
  // Limpieza perezosa para que el Map no crezca sin límite.
  if (now - _lastSweep > 5 * 60 * 1000) {
    for (const [k, b] of _buckets) if (now - b.start > windowMs && now - b.start > 60 * 60 * 1000) _buckets.delete(k);
    _lastSweep = now;
  }
  let b = _buckets.get(key);
  if (!b || now - b.start >= windowMs) { b = { start: now, count: 0 }; _buckets.set(key, b); }
  b.count++;
  if (b.count > limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((b.start + windowMs - now) / 1000)) };
  }
  return { ok: true, remaining: limit - b.count };
}

function safeEqStr(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
  catch { return false; }
}

module.exports = { applySecurityHeaders, clientIp, rateLimit, isSecureRequest, safeEqStr };
