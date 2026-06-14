// /api/products — catálogo público (solo lectura).
//   GET /api/products        → lista de productos activos (shape de products.json)
//   GET /api/products/:id     → detalle de un producto
//   GET /api/products/img/:id → binario de una imagen subida (product_images)
//
// Si la BD no está configurada, cae al snapshot db/products.seed.json para que
// el storefront siga funcionando.
'use strict';

const db = require('../db');
const store = require('../db/products-store');

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function seedFallback() {
  try { return require('../db/products.seed.json'); }
  catch { return []; }
}

module.exports = async (req, res, parsed) => {
  const p = parsed.pathname;
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });

  // Imagen subida (BYTEA) — debe ir antes del match de :id.
  const imgMatch = /^\/api\/products\/img\/([A-Za-z0-9_-]+)$/.exec(p);
  if (imgMatch) {
    if (!db.enabled) return send(res, 404, { error: 'sin BD' });
    try {
      const row = await store.getImage(imgMatch[1]);
      if (!row) return send(res, 404, { error: 'imagen no encontrada' });
      res.writeHead(200, {
        'Content-Type': row.mime || 'image/jpeg',
        'Content-Length': row.data.length,
        'Cache-Control': 'public, max-age=31536000, immutable',
      });
      return res.end(row.data);
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  // Lista completa.
  if (p === '/api/products') {
    try {
      if (!db.enabled) return send(res, 200, seedFallback());
      return send(res, 200, await store.listPublic());
    } catch (e) {
      console.error('[products] list error:', e.message);
      return send(res, 200, seedFallback()); // degradación elegante
    }
  }

  // Detalle.
  const idMatch = /^\/api\/products\/([^/]+)$/.exec(p);
  if (idMatch) {
    const id = decodeURIComponent(idMatch[1]);
    try {
      if (!db.enabled) {
        const found = seedFallback().find((x) => x.id === id);
        return found ? send(res, 200, found) : send(res, 404, { error: 'no existe' });
      }
      const prod = await store.getById(id);
      return prod ? send(res, 200, prod) : send(res, 404, { error: 'no existe' });
    } catch (e) {
      return send(res, 500, { error: e.message });
    }
  }

  return send(res, 404, { error: 'products route not found' });
};
