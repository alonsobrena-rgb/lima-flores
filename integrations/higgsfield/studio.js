// Lima Flores — Marketing Studio (Higgsfield Cloud).
// Genera el VISUAL de un ad (imagen o video) a partir de la foto de un producto,
// en el tamaño correcto (cuadrado 1:1 o vertical 9:16) y con "aire" arriba/abajo
// para que la UI de Meta (perfil, botones, caption, CTA) no tape el contenido.
//
// API REST directa (platform.higgsfield.ai), misma auth que generate-video.js:
//   Authorization: Key HF_API_KEY:HF_API_SECRET
//
// La imagen del producto DEBE ser una URL pública (la plataforma no llega a
// localhost) → se construye con PUBLIC_BASE_URL.
'use strict';

require('./load-env')();
const https = require('https');

const KEY = process.env.HF_API_KEY;
const SECRET = process.env.HF_API_SECRET;
const HOST = 'platform.higgsfield.ai';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Tamaños soportados por Soul que corresponden a los formatos de Meta.
const SIZE_MAP = {
  square: '1536x1536',   // 1:1  feed
  vertical: '1152x2048', // 9:16 stories / reels
};

// Seedream usa aspect_ratio (no width_and_height). Mapeo a los formatos de Meta.
const SEEDREAM_ASPECT = {
  square: '1:1',    // feed
  vertical: '9:16', // stories / reels
};

function isConfigured() { return !!(KEY && SECRET); }

function api(method, pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = { 'Authorization': `Key ${KEY}:${SECRET}`, 'Accept': 'application/json' };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    const req = https.request({ hostname: HOST, path: pathname, method, headers }, (r) => {
      let d = ''; r.on('data', (c) => (d += c));
      r.on('end', () => {
        let j; try { j = JSON.parse(d); } catch { j = d; }
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(j);
        else reject(new Error(`HTTP ${r.statusCode} ${pathname} :: ${typeof j === 'string' ? j : JSON.stringify(j)}`));
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

// Descarga binaria (sigue redirects). Devuelve { buffer, mime }.
function download(url, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Demasiados redirects'));
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume(); return resolve(download(r.headers.location, depth + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode + ' al descargar')); }
      const chunks = [];
      r.on('data', (c) => chunks.push(c));
      r.on('end', () => resolve({ buffer: Buffer.concat(chunks), mime: r.headers['content-type'] || 'application/octet-stream' }));
      r.on('error', reject);
    }).on('error', reject);
  });
}

function jobIdOf(created) {
  return created && (created.id || (created.job_set && created.job_set.id) || created.job_set_id || null);
}

// Extrae la URL del resultado de un status, tolerando varias formas de la API.
function resultUrlOf(st) {
  if (!st) return null;
  if (st.video && st.video.url) return st.video.url;
  if (st.image && st.image.url) return st.image.url;
  const arrs = [st.images, st.results, st.outputs, st.assets].filter(Array.isArray);
  for (const a of arrs) {
    for (const it of a) {
      if (typeof it === 'string') return it;
      if (it && (it.url || (it.image && it.image.url))) return it.url || it.image.url;
    }
  }
  if (typeof st.url === 'string') return st.url;
  return null;
}

// Espera a que el job termine. Devuelve la URL del resultado.
async function poll(id, { onTick } = {}) {
  for (let i = 0; i < 200; i++) {
    await sleep(4000);
    const st = await api('GET', `/requests/${id}/status`);
    if (onTick) onTick(st.status);
    if (st.status === 'completed') {
      const url = resultUrlOf(st);
      if (!url) throw new Error('completed pero sin URL de resultado: ' + JSON.stringify(st).slice(0, 400));
      return url;
    }
    if (st.status === 'failed' || st.status === 'nsfw') throw new Error('Generación ' + st.status);
  }
  throw new Error('Timeout esperando la generación');
}

// ─── Generadores ───────────────────────────────────────────────────────────────
// Seedream 4.5: modelo de edición/transformación que PARTE de la foto real del
// producto (input_images) y la conserva — el arreglo de flores sale idéntico, solo
// cambia el entorno/luz/escena según el prompt. (Soul usaba la foto solo como
// referencia de estilo e inventaba un arreglo distinto.)
async function createImageJob({ productImageUrl, prompt, size = 'square', quality = 'high' }) {
  if (!productImageUrl) {
    throw new Error('Seedream necesita la foto del producto (input_images). Falta la URL pública.');
  }
  const params = {
    prompt,
    input_images: [{ type: 'image_url', image_url: productImageUrl }],
    aspect_ratio: SEEDREAM_ASPECT[size] || SEEDREAM_ASPECT.square,
    quality, // 'basic' | 'high'
  };
  const created = await api('POST', '/v1/text2image/seedream', { params });
  const id = jobIdOf(created);
  if (!id) throw new Error('Sin id en la respuesta de text2image/seedream: ' + JSON.stringify(created).slice(0, 300));
  return id;
}

async function createVideoJob({ imageUrl, prompt, model = process.env.HF_MODEL || 'dop-lite' }) {
  const created = await api('POST', '/v1/image2video/dop', {
    params: { model, prompt, input_images: [{ type: 'image_url', image_url: imageUrl }], enhance_prompt: true },
  });
  const id = jobIdOf(created);
  if (!id) throw new Error('Sin id en la respuesta de image2video/dop: ' + JSON.stringify(created).slice(0, 300));
  return id;
}

module.exports = {
  isConfigured, SIZE_MAP,
  createImageJob, createVideoJob, poll, download, resultUrlOf,
};
