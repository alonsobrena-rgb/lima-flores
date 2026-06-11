// Lima Flores — generador de video con Higgsfield Cloud (image → video).
// API REST directa (platform.higgsfield.ai). Auth: "Authorization: Key ID:SECRET".
//
// Generar:
//   node integrations/higgsfield/generate-video.js "<prompt>" "<imageUrl pública>" [nombre] [modelo]
// Descargar un job ya terminado:
//   node integrations/higgsfield/generate-video.js --fetch <jobSetId> [nombre]
//
// Modelos: dop-lite (más barato) · dop-turbo (rápido) · dop-standard (mejor calidad)
// La imagen DEBE ser una URL pública (la plataforma no llega a localhost).
'use strict';
require('./load-env')();
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.HF_API_KEY;
const SECRET = process.env.HF_API_SECRET;
const HOST = 'platform.higgsfield.ai';
if (!KEY || !SECRET) {
  console.error('Faltan HF_API_KEY / HF_API_SECRET en integrations/higgsfield/.env');
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, 'out');

function api(method, pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = { 'Authorization': `Key ${KEY}:${SECRET}`, 'Accept': 'application/json' };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    const req = https.request({ hostname: HOST, path: pathname, method, headers }, (r) => {
      let d = ''; r.on('data', (c) => d += c);
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

function download(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('Demasiados redirects'));
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) {
        r.resume(); return resolve(download(r.headers.location, dest, depth + 1));
      }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode + ' al descargar')); }
      const file = fs.createWriteStream(dest);
      r.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
      file.on('error', (err) => { fs.unlink(dest, () => reject(err)); });
    }).on('error', reject);
  });
}

async function poll(id) {
  for (let i = 0; i < 200; i++) {
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
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log(`✓ Guardado: ${outPath} (${kb} KB)`);
  return outPath;
}

(async () => {
  // Modo --fetch: descarga un job ya terminado
  if (process.argv[2] === '--fetch') {
    const id = process.argv[3];
    const name = process.argv[4] || ('video-' + id.slice(0, 8));
    if (!id) { console.error('Uso: --fetch <jobSetId> [nombre]'); process.exit(1); }
    const st = await api('GET', `/requests/${id}/status`);
    console.log('Estado:', st.status);
    if (st.status !== 'completed' || !st.video || !st.video.url) {
      console.error('Aún no está listo o falló:', JSON.stringify(st)); process.exit(1);
    }
    console.log('Video URL:', st.video.url);
    await save(st.video.url, name);
    return;
  }

  // Modo normal: crear + poll + descargar
  const prompt = process.argv[2];
  const imageUrl = process.argv[3];
  const name = process.argv[4] || 'video-' + Date.now();
  const model = process.argv[5] || process.env.HF_MODEL || 'dop-lite';
  if (!prompt || !imageUrl) {
    console.error('Uso: node generate-video.js "<prompt>" "<imageUrl pública>" [nombre] [modelo]');
    process.exit(1);
  }
  console.log(`▸ Modelo: ${model}\n▸ Imagen: ${imageUrl}\n▸ Prompt: ${prompt}\nCreando job…`);
  const created = await api('POST', '/v1/image2video/dop', {
    params: { model, prompt, input_images: [{ type: 'image_url', image_url: imageUrl }], enhance_prompt: true },
  });
  const id = created.id || (created.job_set && created.job_set.id);
  if (!id) throw new Error('Sin id en la respuesta: ' + JSON.stringify(created));
  console.log('Job set:', id, '— esperando (1–3 min)…');
  const url = await poll(id);
  if (!url) throw new Error('Sin URL de video');
  console.log('Video URL:', url);
  await save(url, name);
})().catch((e) => { console.error('ERROR:', e && e.message ? e.message : e); process.exit(1); });
