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

const quoteHandler = require('./api/quote');
const orderHandler = require('./api/order');
const adminHandler = require('./api/admin');

const SITE_DIR = path.join(__dirname, 'site');
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
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

  // ─── /api/admin/* — listar/despachar/cancelar (Basic Auth) ───
  if (parsed.pathname.startsWith('/api/admin/')) {
    return adminHandler(req, res, parsed);
  }

  // ─── /admin · /admin.html — panel del atelier ───
  // El HTML es público; el login se hace con un formulario propio que llama
  // a /api/admin/login y emite una cookie de sesión firmada. Así evitamos el
  // popup nativo de Basic Auth, que es buggy en móviles y autofill.
  if (parsed.pathname === '/admin' || parsed.pathname === '/admin.html') {
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
  if (parsed.pathname === '/checkout.html' || parsed.pathname === '/checkout') {
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

  // ─── Estáticos desde site/ ───
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  // Protección contra traversal
  const filePath = path.normalize(path.join(SITE_DIR, pathname));
  if (!filePath.startsWith(SITE_DIR)) return send(res, 403, 'forbidden');

  fs.stat(filePath, (err, stat) => {
    if (err || stat.isDirectory()) {
      // 404 → servir index.html con 404 para SPAs amigables; aquí devolvemos texto plano.
      return send(res, 404, `not found: ${pathname}`);
    }
    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    // HTML/CSS/JS siempre revalidan (evita que el navegador muestre versiones viejas);
    // imágenes/fuentes/videos sí se cachean (son grandes y casi nunca cambian).
    const noCache = ext === '.html' || ext === '.css' || ext === '.js' || ext === '.json';
    const cacheCtl = noCache ? 'no-cache' : 'public, max-age=3600';

    // ─── Soporte de HTTP Range (necesario para hacer "seek"/scrubbing de video) ───
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
  });
});

server.listen(PORT, () => {
  console.log(`Lima Flores → http://localhost:${PORT}`);
});
