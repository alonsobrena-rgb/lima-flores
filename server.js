// Lima Flores · servidor Node minimal (zero-dependencies).
// Sirve el build de la tienda React (app/dist) y monta /api/quote → integrations/urbaner.
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
const { applySecurityHeaders, clientIp, rateLimit } = require('./lib/security');

// Resultado cacheado del probe de Chromium (evita relanzar el navegador en cada hit).
let _chromiumProbe = null;
let _chromiumProbeAt = 0;

// El frontend es el build de la tienda React. El sitio vanilla que vivía en
// site/ —y que hacía de respaldo y de fuente de /assets— ya no existe: sus fotos
// estaban duplicadas en app/public (md5 idéntico, 107 archivos) y esa es ahora la
// única copia. Si el build falla no hay a qué caer, que es lo correcto: mejor un
// 404 visible que servir en silencio una tienda de hace seis meses.
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

  // Cabeceras de seguridad en TODAS las respuestas (se fijan con setHeader, así
  // que sobreviven a los writeHead posteriores de los handlers y de serveFile).
  applySecurityHeaders(req, res);

  // ─── CORS + preflight para /api/* ───
  if (parsed.pathname.startsWith('/api/')) {
    applyCors(req, res);
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  }

  // ─── Rate limiting de endpoints sensibles (anti fuerza-bruta / spam) ───
  // Login del admin: pocos intentos por IP. Creación de pedidos: evita que se
  // inunde la BD y se disparen renders de Puppeteer sin control.
  if (parsed.pathname === '/api/admin/login' && req.method === 'POST') {
    const rl = rateLimit(`login:${clientIp(req)}`, 8, 15 * 60 * 1000);
    if (!rl.ok) { res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(rl.retryAfterSec) }); return res.end(JSON.stringify({ error: 'Demasiados intentos. Espera unos minutos.' })); }
  }
  if (parsed.pathname === '/api/order' && req.method === 'POST') {
    const rl = rateLimit(`order:${clientIp(req)}`, 20, 10 * 60 * 1000);
    if (!rl.ok) { res.writeHead(429, { 'Content-Type': 'application/json; charset=utf-8', 'Retry-After': String(rl.retryAfterSec) }); return res.end(JSON.stringify({ error: 'Demasiadas solicitudes. Intenta de nuevo en unos minutos.' })); }
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

  // ─── /api/categories — categorías del catálogo (solo lectura) ───
  if (parsed.pathname === '/api/categories') {
    return require('./api/categories')(req, res, parsed);
  }

  // ─── /api/instagram — feed de posts de @lima_flores (galería de la landing) ───
  if (parsed.pathname === '/api/instagram') {
    return require('./api/instagram')(req, res, parsed);
  }

  // ─── /api/ig/media/:id — el archivo que Meta descarga al publicar ───
  // Público a propósito: Instagram baja el JPG/MP4 él mismo y no se autentica.
  if (parsed.pathname.startsWith('/api/ig/media/')) {
    return require('./api/ig-media')(req, res, parsed);
  }

  // ─── /api/culqi/* — pasarela de pago Culqi (cobro de tarjeta) ───
  if (parsed.pathname.startsWith('/api/culqi/')) {
    return require('./api/culqi')(req, res, parsed);
  }

  // ─── /api/admin/* — listar/despachar/cancelar (Basic Auth) ───
  if (parsed.pathname.startsWith('/api/admin/')) {
    return adminHandler(req, res, parsed);
  }

  // ─── /admin → /admin/orders ───
  // Cada sección del panel tiene su propia URL; /admin redirige a la sección por
  // defecto (Pedidos) del lado del servidor, para que la URL quede canónica al
  // instante (sin parpadeo) y al recargar se mantenga.
  if (APP_DIST_EXISTS && (parsed.pathname === '/admin' || parsed.pathname === '/admin/' || parsed.pathname === '/admin.html')) {
    res.writeHead(302, { Location: '/admin/orders', 'Cache-Control': 'no-store' });
    return res.end();
  }

  // ─── /api/config — keys públicas (legacy) ───
  // La tienda React no lo usa: Vite hornea VITE_GOOGLE_MAPS_KEY en el build. Se
  // deja como red de seguridad por si algún cliente viejo todavía lo llama.
  if (parsed.pathname === '/api/config') {
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    return res.end(JSON.stringify({
      googleMapsKey: process.env.GOOGLE_MAPS_API_KEY || '',
    }));
  }

  // ─── Estáticos: app/dist (React) → SPA fallback ───
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';

  if (APP_DIST_EXISTS) {
    const fp = path.normalize(path.join(APP_DIST, pathname));
    if (fp.startsWith(APP_DIST)) { // anti-traversal
      let stat;
      try { stat = fs.statSync(fp); } catch { stat = null; }
      if (stat && stat.isFile()) return serveFile(req, res, fp, stat);
    }
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
  // Vigía de franjas de entrega → avisos por Google Chat al iniciar cada horario.
  try { require('./integrations/notify/delivery-watch').start(); }
  catch (e) { console.error('[delivery-watch] no se pudo iniciar:', e.message); }
  // Publicador de Instagram: mira la cola cada minuto. No publica nada mientras
  // el interruptor del panel esté apagado — encenderlo es un acto de una persona.
  try { require('./integrations/instagram/publisher').start(); }
  catch (e) { console.error('[ig] no se pudo iniciar el publicador:', e.message); }
  // Agenda de WhatsApp: las reglas «el día N de cada mes a tal hora». Mismo
  // criterio que arriba — con el interruptor apagado no manda nada.
  try { require('./integrations/whatsapp/vigia').start(); }
  catch (e) { console.error('[wa] no se pudo iniciar la agenda:', e.message); }
});
