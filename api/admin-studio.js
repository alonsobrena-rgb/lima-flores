// /api/admin/studio/* — Marketing Studio (Higgsfield). Protegido: la auth ya la
// validó api/admin.js antes de delegar aquí.
//
//   POST /api/admin/studio/generate        → { productId, kind, size, vibe, prompt } → { assetId }
//   GET  /api/admin/studio/status/:id       → { status, error?, ... }
//   GET  /api/admin/studio/asset/:id        → { dataUrl, mime, kind }  (?raw=1 → binario)
//   GET  /api/admin/studio/assets?productId → galería de ads del producto
'use strict';

const products = require('../db/products-store');
const studioStore = require('../db/studio-store');
const studio = require('../integrations/higgsfield/studio');

const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function readJsonBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('body too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { const raw = Buffer.concat(chunks).toString('utf8'); if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

// URL pública de la foto del producto para que Higgsfield la pueda leer.
function publicProductImageUrl(product) {
  const img = product.image || (Array.isArray(product.images) && product.images[0]);
  if (!img) return null;
  if (/^https?:\/\//i.test(img)) return img;
  if (!PUBLIC_BASE_URL) return null;
  if (img.startsWith('/api/')) return PUBLIC_BASE_URL + img;
  // /products/x.jpg | assets/products/x.jpg → el server Node sirve /assets/products/<file>
  const file = img.split('/').pop();
  return PUBLIC_BASE_URL + '/assets/products/' + file;
}

// Prompt de respaldo (el front manda uno editable; esto es por si llega vacío).
const VIBE_LEAD = {
  romantic: 'Romantic Valentine',
  mothers: "Mother's Day, tender",
  luxury: 'Minimal luxury',
  birthday: 'Festive birthday',
  sympathy: 'Sober, respectful sympathy',
};
function buildFallbackPrompt(product, vibe, size) {
  const lead = VIBE_LEAD[vibe] || 'Elegant';
  const sizeRule = size === 'vertical'
    ? 'Vertical 9:16 framing with generous empty space in the top 15% and bottom 20% for text and platform UI.'
    : 'Balanced 1:1 framing with comfortable breathing room on all edges.';
  // Prompt de edición para Seedream: conserva el arreglo real de la foto.
  return `${lead} editorial advertising photo for a luxury Peruvian boutique florist (Lima Flores). Keep the EXACT same flower arrangement from the reference image (${product.name}) — identical flowers, colors, shapes and composition, completely unchanged; do NOT redesign, replace or add flowers. Only restyle the scene around it with a marble or warm linen surface, soft natural directional light, elegant editorial composition, arrangement centered and fully visible. ${sizeRule} Refined, aspirational, true-to-life colors, shallow depth of field, high-end commercial advertising photography, 8k.`;
}

// Corre la generación en segundo plano (1–3 min) y persiste el resultado.
async function runGeneration(assetId, { kind, size, prompt, imageUrl }) {
  try {
    const jobId = kind === 'video'
      ? await studio.createVideoJob({ imageUrl, prompt })
      : await studio.createImageJob({ productImageUrl: imageUrl, prompt, size });
    await studioStore.setJob(assetId, jobId);
    const url = await studio.poll(jobId);
    const { buffer, mime } = await studio.download(url);
    await studioStore.markCompleted(assetId, { media: buffer, mime });
    console.log(`[studio] ${assetId} completado (${kind}, ${(buffer.length / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.error(`[studio] ${assetId} falló:`, e.message);
    await studioStore.markFailed(assetId, e.message);
  }
}

async function generate(req, res) {
  let body;
  try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  const kind = body.kind === 'video' ? 'video' : 'image';
  const size = body.size === 'vertical' ? 'vertical' : 'square';
  const vibe = body.vibe || null;

  if (!studio.isConfigured()) {
    return send(res, 503, { error: 'Higgsfield no configurado: falta HF_API_KEY / HF_API_SECRET en el servidor.' });
  }
  let product;
  try { product = await products.getById(body.productId, { internal: true }); }
  catch (e) { return send(res, 500, { error: e.message }); }
  if (!product) return send(res, 404, { error: 'Producto no encontrado.' });

  const imageUrl = publicProductImageUrl(product);
  if (!imageUrl) {
    return send(res, 400, { error: 'No pude armar la URL pública de la foto. Configura PUBLIC_BASE_URL en el servidor (dominio público de Railway).' });
  }
  const prompt = (body.prompt && String(body.prompt).trim()) || buildFallbackPrompt(product, vibe, size);

  let assetId;
  try { assetId = await studioStore.createAsset({ productId: product.id, kind, size, vibe, prompt }); }
  catch (e) { return send(res, 500, { error: e.message }); }

  setImmediate(() => runGeneration(assetId, { kind, size, prompt, imageUrl }));
  return send(res, 202, { assetId, status: 'generating', prompt });
}

async function status(req, res, id) {
  try {
    const m = await studioStore.getMeta(id);
    if (!m) return send(res, 404, { error: 'No existe ese asset.' });
    return send(res, 200, {
      id: m.id, status: m.status, kind: m.kind, size: m.size, vibe: m.vibe,
      error: m.error || undefined, prompt: m.prompt || undefined,
    });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

async function asset(req, res, id, urlObj) {
  try {
    const row = await studioStore.getMedia(id);
    if (!row) return send(res, 404, { error: 'Aún no está listo o no existe.' });
    const meta = await studioStore.getMeta(id);
    if (urlObj.searchParams.get('raw') === '1') {
      const mime = row.mime || 'application/octet-stream';
      const ext = mime.includes('mp4') ? 'mp4' : mime.includes('webp') ? 'webp' : mime.includes('png') ? 'png' : 'jpg';
      const total = row.media.length;
      // Por defecto inline (para mostrar <img>/<video> en el panel); attachment
      // solo con ?download=1 (botón "Descargar").
      const disposition = `${urlObj.searchParams.get('download') === '1' ? 'attachment' : 'inline'}; filename="lima-ad-${id}.${ext}"`;
      // Soporte de Range (206) — el navegador lo necesita para reproducir <video>.
      const range = req.headers.range;
      const m = range && /^bytes=(\d*)-(\d*)$/.exec(range.trim());
      if (m) {
        let start = m[1] === '' ? 0 : parseInt(m[1], 10);
        let end = m[2] === '' ? total - 1 : parseInt(m[2], 10);
        if (!Number.isFinite(start) || start < 0) start = 0;
        if (!Number.isFinite(end) || end >= total) end = total - 1;
        if (start > end) {
          res.writeHead(416, { 'Content-Range': `bytes */${total}`, 'Accept-Ranges': 'bytes' });
          return res.end();
        }
        const chunk = row.media.subarray(start, end + 1);
        res.writeHead(206, {
          'Content-Type': mime,
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': chunk.length,
          'Cache-Control': 'no-store',
          'Content-Disposition': disposition,
        });
        return res.end(chunk);
      }
      res.writeHead(200, {
        'Content-Type': mime,
        'Content-Length': total,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-store',
        'Content-Disposition': disposition,
      });
      return res.end(row.media);
    }
    const dataUrl = `data:${row.mime};base64,${row.media.toString('base64')}`;
    return send(res, 200, { id, kind: meta && meta.kind, mime: row.mime, dataUrl });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

async function listAssets(req, res, urlObj) {
  try {
    const productId = urlObj.searchParams.get('productId');
    // Sin productId → galería global (todos los ads de todos los productos).
    const assets = productId
      ? await studioStore.listByProduct(productId)
      : await studioStore.listAll();
    return send(res, 200, { assets });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

module.exports = async (req, res, urlObj) => {
  const p = urlObj.pathname;
  if (p === '/api/admin/studio/generate' && req.method === 'POST') return generate(req, res);
  if (p === '/api/admin/studio/assets' && req.method === 'GET') return listAssets(req, res, urlObj);
  const sm = p.match(/^\/api\/admin\/studio\/status\/([A-Za-z0-9_-]+)$/);
  if (sm && req.method === 'GET') return status(req, res, sm[1]);
  const am = p.match(/^\/api\/admin\/studio\/asset\/([A-Za-z0-9_-]+)$/);
  if (am && req.method === 'GET') return asset(req, res, am[1], urlObj);
  return send(res, 404, { error: 'studio route not found' });
};
