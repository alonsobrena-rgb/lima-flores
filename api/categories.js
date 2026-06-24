// /api/categories — categorías del catálogo (solo lectura, público).
//   GET /api/categories → categorías activas, ordenadas, con conteo de productos.
// Si la BD no está configurada, cae al snapshot db/categories.seed.json.
'use strict';

const db = require('../db');
const store = require('../db/categories-store');

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function seedFallback() {
  try { return require('../db/categories.seed.json').map((c, i) => ({ ...c, sortOrder: i, active: true, count: 0 })); }
  catch { return []; }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Method not allowed' });
  try {
    if (!db.enabled) return send(res, 200, seedFallback());
    return send(res, 200, await store.listPublic());
  } catch (e) {
    console.error('[categories] list error:', e.message);
    return send(res, 200, seedFallback());
  }
};
