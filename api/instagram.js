// /api/instagram — posts recientes de @lima_flores para la galería de la landing.
//   GET /api/instagram → { ok, configured, posts: [...] }
// Siempre responde 200: si no hay token configurado o el Graph falla, devuelve
// posts:[] y el front muestra su galería de respaldo. Cacheado en el cliente y
// en el servidor (ver integrations/instagram/feed.js).
'use strict';

const feed = require('../integrations/instagram/feed');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
  }
  let posts = [];
  try { posts = await feed.getMedia(12); } catch { posts = []; }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  // Cache de borde/navegador corto: la galería no necesita ser tiempo real.
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.end(JSON.stringify({ ok: true, configured: feed.isConfigured(), posts }));
};
