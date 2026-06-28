// Lima Flores — generador de video con Higgsfield Kling v2.1 (image → video).
// Es el mejor modelo disponible con nuestras keys REST (cinematográfico, alta
// calidad). Endpoint: POST /v1/image2video/kling.
//   params: { model, prompt, input_image:{ type:'image_url', image_url } }
//   model: 'kling-v2-1-master' (máxima calidad) | 'kling-v2-1'
//
//   node integrations/higgsfield/generate-kling.js "<prompt>" "<imageUrl pública>" [nombre] [modelo]
//   node integrations/higgsfield/generate-kling.js --fetch <jobSetId> [nombre]
'use strict';
require('./load-env')();
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.HF_API_KEY, SECRET = process.env.HF_API_SECRET;
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
      let d = ''; r.on('data', (c) => d += c);
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
      const file = fs.createWriteStream(dest); r.pipe(file);
      file.on('finish', () => file.close(() => resolve())); file.on('error', (err) => { fs.unlink(dest, () => reject(err)); });
    }).on('error', reject);
  });
}

async function poll(id) {
  for (let i = 0; i < 250; i++) {
    await sleep(4000);
    const st = await api('GET', `/requests/${id}/status`);
    process.stdout.write(`\r  estado: ${st.status}        `);
    if (st.status === 'completed') { process.stdout.write('\n'); return st.video && st.video.url; }
    if (st.status === 'failed' || st.status === 'nsfw') { process.stdout.write('\n'); throw new Error('Generación ' + st.status); }
  }
  throw new Error('Timeout esperando el video');
}

async function save(url, name) {
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, (name.endsWith('.mp4') ? name : name + '.mp4'));
  await download(url, outPath);
  console.log(`✓ Guardado: ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(0)} KB)`);
  return outPath;
}

(async () => {
  if (process.argv[2] === '--fetch') {
    const id = process.argv[3]; const name = process.argv[4] || ('kling-' + id.slice(0, 8));
    const st = await api('GET', `/requests/${id}/status`);
    console.log('Estado:', st.status);
    if (st.status !== 'completed' || !st.video || !st.video.url) { console.error('No listo:', JSON.stringify(st)); process.exit(1); }
    console.log('Video URL:', st.video.url); await save(st.video.url, name); return;
  }
  const prompt = process.argv[2], imageUrl = process.argv[3];
  const name = process.argv[4] || 'kling-' + Date.now();
  const model = process.argv[5] || 'kling-v2-1-master';
  if (!prompt || !imageUrl) { console.error('Uso: generate-kling.js "<prompt>" "<imageUrl>" [nombre] [modelo]'); process.exit(1); }
  console.log(`▸ Modelo: ${model}\n▸ Imagen: ${imageUrl}\n▸ Prompt: ${prompt}\nCreando job…`);
  const created = await api('POST', '/v1/image2video/kling', {
    params: { model, prompt, input_image: { type: 'image_url', image_url: imageUrl } },
  });
  const id = created.id || (created.job_set && created.job_set.id);
  if (!id) throw new Error('Sin id: ' + JSON.stringify(created));
  console.log('Job set:', id, '— esperando (2–5 min)…');
  const url = await poll(id);
  if (!url) throw new Error('Sin URL de video');
  console.log('Video URL:', url);
  await save(url, name);
})().catch((e) => { console.error('ERROR:', e && e.message ? e.message : e); process.exit(1); });
