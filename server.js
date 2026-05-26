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
const { checkBasicAuth } = require('./lib/basic-auth');

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

const server = http.createServer(async (req, res) => {
  let parsed;
  try { parsed = new URL(req.url, `http://${req.headers.host || 'localhost'}`); }
  catch { return send(res, 400, 'bad url'); }

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

  // ─── /admin · /admin.html — panel del atelier (Basic Auth) ───
  // Protegemos el HTML para que el browser popee el diálogo de credenciales
  // y las reuse en los XHR a /api/admin/*.
  if (parsed.pathname === '/admin' || parsed.pathname === '/admin.html') {
    if (!checkBasicAuth(req, res)) return;
    const adminFile = path.join(SITE_DIR, 'admin.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
    return fs.createReadStream(adminFile).pipe(res);
  }

  // ─── /api/config — keys públicas del front (Maps JS, etc.) ───
  // La key de Google Maps JS es client-side por diseño; la seguridad se hace
  // restringiendo HTTP referrer en Google Cloud Console, no ocultándola.
  if (parsed.pathname === '/api/config') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    });
    return res.end(JSON.stringify({
      googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
    }));
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
    res.writeHead(200, {
      'Content-Type': type,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600',
    });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Lima Flores → http://localhost:${PORT}`);
});
