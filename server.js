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
