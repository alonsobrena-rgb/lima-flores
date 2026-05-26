// Helper compartido para HTTP Basic Auth.
// Usa ADMIN_USER + ADMIN_PASS env vars. Si no están configurados → 503.
'use strict';

function unauthorized(res, status, message) {
  res.statusCode = status;
  res.setHeader('WWW-Authenticate', 'Basic realm="Lima Flores Admin"');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: message }));
}

// Devuelve true si pasa, false si no (y ya respondió el res).
function checkBasicAuth(req, res) {
  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  if (!user || !pass) {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ error: 'Admin no configurado — falta ADMIN_USER/ADMIN_PASS.' }));
    return false;
  }
  const header = req.headers.authorization || '';
  if (!header.startsWith('Basic ')) {
    unauthorized(res, 401, 'Auth requerida');
    return false;
  }
  let decoded;
  try { decoded = Buffer.from(header.slice(6), 'base64').toString('utf8'); }
  catch { decoded = ''; }
  const idx = decoded.indexOf(':');
  const u = idx >= 0 ? decoded.slice(0, idx) : decoded;
  const p = idx >= 0 ? decoded.slice(idx + 1) : '';
  if (u !== user || p !== pass) {
    unauthorized(res, 401, 'Credenciales inválidas');
    return false;
  }
  return true;
}

module.exports = { checkBasicAuth };
