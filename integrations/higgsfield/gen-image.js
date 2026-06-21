// Lima Flores — text → image con Higgsfield Soul (platform.higgsfield.ai).
// Genera una imagen a partir de SOLO texto (sin foto de referencia) y la descarga.
//
//   node integrations/higgsfield/gen-image.js "<prompt>" <nombre> [WxH] [quality]
//
// Tamaños (width_and_height): 2048x1152 (16:9) · 1152x2048 (9:16) · 1536x1536 (1:1)
'use strict';
require('./load-env')();
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.HF_API_KEY;
const SECRET = process.env.HF_API_SECRET;
const HOST = 'platform.higgsfield.ai';
if (!KEY || !SECRET) { console.error('Faltan HF_API_KEY / HF_API_SECRET'); process.exit(1); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, 'out');

function api(method, pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = { 'Authorization': `Key ${KEY}:${SECRET}`, 'Accept': 'application/json' };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    const req = https.request({ hostname: HOST, path: pathname, method, headers }, (r) => {
      let d = ''; r.on('data', (c) => (d += c));
      r.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; }
        (r.statusCode >= 200 && r.statusCode < 300) ? resolve(j)
          : reject(new Error(`HTTP ${r.statusCode} ${pathname} :: ${typeof j === 'string' ? j : JSON.stringify(j)}`)); });
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}

function download(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Demasiados redirects'));
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return resolve(download(r.headers.location, dest, depth + 1)); }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode + ' al descargar')); }
      const f = fs.createWriteStream(dest); r.pipe(f);
      f.on('finish', () => f.close(() => resolve())); f.on('error', (e) => { fs.unlink(dest, () => reject(e)); });
    }).on('error', reject);
  });
}

function resultUrlOf(st) {
  if (!st) return null;
  if (st.image && st.image.url) return st.image.url;
  if (st.video && st.video.url) return st.video.url;
  const arrs = [st.images, st.results, st.outputs, st.assets].filter(Array.isArray);
  for (const a of arrs) for (const it of a) {
    if (typeof it === 'string') return it;
    if (it && (it.url || (it.image && it.image.url))) return it.url || it.image.url;
  }
  if (typeof st.url === 'string') return st.url;
  return null;
}

async function poll(id) {
  for (let i = 0; i < 200; i++) {
    await sleep(4000);
    const st = await api('GET', `/requests/${id}/status`);
    process.stdout.write(`\r  estado: ${st.status}        `);
    if (st.status === 'completed') { process.stdout.write('\n'); const u = resultUrlOf(st); if (!u) throw new Error('completed sin URL: ' + JSON.stringify(st).slice(0, 400)); return u; }
    if (st.status === 'failed' || st.status === 'nsfw') { process.stdout.write('\n'); throw new Error('Generación ' + st.status); }
  }
  throw new Error('Timeout');
}

(async () => {
  const prompt = process.argv[2];
  const name = process.argv[3] || 'img-' + Date.now();
  const size = process.argv[4] || '2048x1152';
  const quality = process.argv[5] || '1080p'; // Soul: '720p' | '1080p'
  if (!prompt) { console.error('Uso: node gen-image.js "<prompt>" <nombre> [WxH] [quality]'); process.exit(1); }
  console.log(`▸ Soul ${size} q=${quality}\n▸ ${prompt}\nCreando job…`);
  const created = await api('POST', '/v1/text2image/soul', {
    params: { prompt, width_and_height: size, quality, enhance_prompt: true },
  });
  const id = created.id || (created.job_set && created.job_set.id);
  if (!id) throw new Error('Sin id: ' + JSON.stringify(created));
  console.log('Job:', id, '— esperando…');
  const url = await poll(id);
  console.log('Image URL:', url);
  fs.mkdirSync(outDir, { recursive: true });
  const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp)$/i) || [, 'png'])[1].toLowerCase();
  const out = path.join(outDir, `${name}.${ext}`);
  await download(url, out);
  console.log(`✓ ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
})().catch((e) => { console.error('ERROR:', e && e.message ? e.message : e); process.exit(1); });
