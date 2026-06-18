// Lima Flores · servidor Node minimal (zero-dependencies).
// Sirve los estáticos de site/ y monta /api/quote → integrations/urbaner.
// Pensado para Railway (Node 18+ con fetch nativo).
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

// Carga .env local si existe (en Railway las vars las inyecta el dashboard).
require('./integrations/urbaner/load-env')();
// Credenciales Higgsfield para el Marketing Studio (HF_API_KEY / HF_API_SECRET).
try { require('./integrations/higgsfield/load-env')(); } catch { /* opcional */ }
// Credenciales Meta para Promociones por WhatsApp (WA_TOKEN / WA_PHONE_NUMBER_ID…).
try { require('./integrations/whatsapp/load-env')(); } catch { /* opcional */ }

const quoteHandler = require('./api/quote');
const orderHandler = require('./api/order');
const adminHandler = require('./api/admin');
const productsHandler = require('./api/products');
const cardGen = require('./integrations/cards/generate');

// Resultado cacheado del probe de Chromium (evita relanzar el navegador en cada hit).
let _chromiumProbe = null;
let _chromiumProbeAt = 0;

const SITE_DIR = path.join(__dirname, 'site');
// Build del panel/tienda React (app/dist). Si existe, es el frontend principal y
// el sitio vanilla queda solo como respaldo + fuente de /assets (fotos de producto
// que usa el Studio). Si NO existe (build falló), cae al sitio vanilla → nunca se
// cae el deploy por esto.
const APP_DIST = path.join(__dirname, 'app', 'dist');
const APP_DIST_EXISTS = fs.existsSync(path.join(APP_DIST, 'index.html'));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html':  'text/html; charset=utf-8',
  '.css':   'text/css; charset=utf-8',
  '.js':    'application/javascript; charset=utf-8',
  '.json':  'application/json; charset=utf-8',
  '.svg':   'image/svg+xml',
  '.png':   'image/png',
  '.jpg':   'image/jpeg',
  '.jpeg':  'image/jpeg',
  '.webp':  'image/webp',
  '.gif':   'image/gif',
  '.ico':   'image/x-icon',
  '.woff':  'font/woff',
  '.woff2': 'font/woff2',
  '.ttf':   'font/ttf',
  '.txt':   'text/plain; charset=utf-8',
  '.xml':   'application/xml; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

// ─── CORS para el app React (deploy aparte) ───
// Solo afecta peticiones cross-origin desde orígenes permitidos; el sitio vanilla
// es same-origin y no se ve afectado. Configurable con CORS_ORIGINS (coma-sep).
const CORS_ORIGINS = new Set(
  (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
    .split(',').map((s) => s.trim()).filter(Boolean)
);
function applyCors(req, res) {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}

const server = http.createServer(async (req, res) => {
  let parsed;
  try { parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return send(res, 400, 'bad url'); }

  // ─── CORS + preflight para /api/* ───
  if (parsed.pathname.startsWith('/api/')) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }

  // ─── /api/* → función serverless adaptada ───
  if (parsed.pathname === '/api/quote') {
    // El handler usa req.query y req.url, ya viene preparado.
    req.query = Object.fromEntries(parsed.searchParams.entries());
    return quoteHandler(req, res);
  }

  // ─── POST /api/order — crea pedido en BD (status: pending) ───
  if (parsed.pathname === '/api/order') {
    return orderHandler(req, res);
  }

  // ─── GET /api/diag/chromium — auto-test de Chromium (para verificar el deploy) ───
  // Resultado cacheado: como mucho un render cada 5 min, sin importar el tráfico
  // (no hay bypass), para que no se pueda abusar relanzando el navegador.
  if (parsed.pathname === '/api/diag/chromium') {
    const respond = (probe) => {
      res.writeHead(probe.ok ? 200 : 503, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(probe, null, 2));
    };
    if (_chromiumProbe && Date.now() - _chromiumProbeAt < 5 * 60 * 1000) return respond(_chromiumProbe);
    cardGen.probeChromium()
      .then((probe) => { _chromiumProbe = probe; _chromiumProbeAt = Date.now(); respond(probe); })
      .catch((e) => respond({ ok: false, error: String(e && e.message || e) }));
    return;
  }

  // ─── /api/products* — catálogo público (solo lectura) ───
  if (parsed.pathname === '/api/products' || parsed.pathname.startsWith('/api/products/')) {
    return productsHandler(req, res, parsed);
  }

  // ─── /api/admin/* — listar/despachar/cancelar (Basic Auth) ───
  if (parsed.pathname.startsWith('/api/admin/')) {
    return adminHandler(req, res, parsed);
  }

  // ─── /admin · /admin.html — panel vanilla (solo si NO hay build React) ───
  // Con el panel React activo (app/dist), /admin lo maneja el SPA (más abajo).
  if (!APP_DIST_EXISTS && (parsed.pathname === '/admin' || parsed.pathname === '/admin.html')) {
    const adminFile = path.join(SITE_DIR, 'admin.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return fs.createReadStream(adminFile).pipe(res);
  }

  // ─── /api/config — keys públicas (legacy, kept for backward compat) ───
  // El checkout ya no depende de esto: el HTML se sirve con la key inlineada
  // (ver bloque /checkout.html abajo). Este endpoint sigue como red de
  // seguridad por si algún cliente viejo todavía lo llama.
  if (parsed.pathname === '/api/config') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    return res.end(JSON.stringify({
      googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
    }));
  }

  // ─── /checkout.html — HTML con la API key de Maps inlineada ───
  // Substituimos un placeholder por la key en cada request. Así no existe un
  // endpoint separado que el navegador pueda cachear con valor vacío: la key
  // viaja junto al HTML, que ya tiene Cache-Control: no-cache. Resultado:
  // cualquier cambio de GOOGLE_MAPS_API_KEY en Railway es visible al instante,
  // sin caches intermedios ni necesidad de hard-refresh.
  if (!APP_DIST_EXISTS && (parsed.pathname === '/checkout.html' || parsed.pathname === '/checkout')) {
    const filePath = path.join(SITE_DIR, 'checkout.html');
    return fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) return send(res, 500, 'read error');
      const key = process.env.GOOGLE_MAPS_API_KEY || '';
      // Escapar el valor para evitar romper el contexto de string JS o inyectar código.
      const safeKey = JSON.stringify(key).slice(1, -1);
      const out = html.replace(/__LIMA_GMAPS_KEY_PLACEHOLDER__/g, safeKey);
      res.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      });
      res.end(out);
    });
  }

  // ─── Estáticos: app/dist (React) → site/ (assets/legacy) → SPA fallback ───
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  // Roots a probar en orden. Con build React, va primero; site/ aporta /assets/*
  // (fotos de producto que usa el Studio) y el resto del sitio vanilla legacy.
  const roots = APP_DIST_EXISTS ? [APP_DIST, SITE_DIR] : [SITE_DIR];
  for (const root of roots) {
    const fp = path.normalize(path.join(root, pathname));
    if (!fp.startsWith(root)) continue; // anti-traversal
    let stat;
    try { stat = fs.statSync(fp); } catch { stat = null; }
    if (stat && stat.isFile()) return serveFile(req, res, fp, stat);
  }

  // SPA fallback: rutas de cliente del React (sin extensión) → index.html.
  if (APP_DIST_EXISTS && !path.extname(pathname)) {
    const indexFp = path.join(APP_DIST, 'index.html');
    try { return serveFile(req, res, indexFp, fs.statSync(indexFp)); }
    catch { /* cae a 404 */ }
  }

  return send(res, 404, `not found: ${pathname}`);
});

// Sirve un archivo estático con cache y soporte de HTTP Range (seek de video).
function serveFile(req, res, filePath, stat) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  // HTML/CSS/JS revalidan (evita versiones viejas); imágenes/fuentes/videos se cachean.
  const noCache = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.json';
  const cacheCtl = noCache ? 'no-cache' : 'public, max-age=3600';

  const range = req.headers.range;
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      let start = m[1] === '' ? undefined : parseInt(m[1], 10);
      let end = m[2] === '' ? undefined : parseInt(m[2], 10);
      if (start === undefined) { start = Math.max(0, stat.size - (end || 0)); end = stat.size - 1; }
      else if (end === undefined || end >= stat.size) { end = stat.size - 1; }
      if (Number.isNaN(start) || start > end || start >= stat.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${stat.size}`, 'Accept-Ranges': 'bytes' });
        return res.end();
      }
      res.writeHead(206, {
        'Content-Type': type,
        'Content-Range': `bytes ${start}-${end}/${stat.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Cache-Control': cacheCtl,
      });
      return fs.createReadStream(filePath, { start, end }).pipe(res);
    }
  }

  res.writeHead(200, {
    'Content-Type': type,
    'Content-Length': stat.size,
    'Accept-Ranges': 'bytes',
    'Cache-Control': cacheCtl,
  });
  fs.createReadStream(filePath).pipe(res);
}

server.listen(PORT, () => {
  console.log(`Lima Flores → http://localhost:${PORT}`);
});
