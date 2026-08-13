// Lima Flores — genera la tanda de videos de la landing (Fase 1) y los guarda en integrations/higgsfield/out/video/.
'use strict';
require('./load-env')();
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.HF_API_KEY, SECRET = process.env.HF_API_SECRET, HOST = 'platform.higgsfield.ai';
const MODEL = process.argv[2] || 'dop-turbo';
const OUT = path.join(__dirname, 'out', 'video');
fs.mkdirSync(OUT, { recursive: true });

// Prompts: el HERO necesita movimiento continuo/progresivo (para scrubbing con scroll);
// el resto son loops ambientales (brisa suave).
const SCRUB = 'Extremely slow, smooth, continuous cinematic camera push-in; petals gradually and gently unfurl; steady even motion with no abrupt changes; soft warm natural light; shallow depth of field; elegant and minimal';
const LOOP = 'Gentle continuous soft breeze; petals and leaves sway slowly and subtly; smooth seamless ambient motion; soft warm natural light; shallow depth of field; cinematic and elegant';

const JOBS = [
  { name: 'hero-orquideas', image: 'https://limaflores.pe/wp-content/uploads/2026/04/lm-cuadrado-13-1-scaled.jpg', prompt: SCRUB },
  { name: 'firma-orquideas', image: 'https://limaflores.pe/wp-content/uploads/2024/02/9.6.jpg', prompt: LOOP },
  { name: 'franja-ramo', image: 'https://limaflores.pe/wp-content/uploads/2024/02/Luciana_d.jpg', prompt: LOOP },
  { name: 'franja-box', image: 'https://limaflores.pe/wp-content/uploads/2026/04/lm-verticale-4-scaled.jpg', prompt: LOOP },
  { name: 'franja-tulipanes', image: 'https://limaflores.pe/wp-content/uploads/2024/02/Untitled-Catalog2582-scaled.jpg', prompt: LOOP },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function api(method, pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = { 'Authorization': `Key ${KEY}:${SECRET}`, 'Accept': 'application/json' };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    const req = https.request({ hostname: HOST, path: pathname, method, headers }, (r) => {
      let d = ''; r.on('data', (c) => d += c);
      r.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; }
        (r.statusCode >= 200 && r.statusCode < 300) ? resolve(j) : reject(new Error(`HTTP ${r.statusCode} ${pathname} :: ${typeof j === 'string' ? j : JSON.stringify(j)}`)); });
    });
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}
function download(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('redirects'));
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return resolve(download(r.headers.location, dest, depth + 1)); }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode)); }
      const f = fs.createWriteStream(dest); r.pipe(f);
      f.on('finish', () => f.close(() => resolve())); f.on('error', (e) => { fs.unlink(dest, () => reject(e)); });
    }).on('error', reject);
  });
}
async function poll(id) {
  for (let i = 0; i < 200; i++) {
    await sleep(4000);
    const st = await api('GET', `/requests/${id}/status`);
    if (st.status === 'completed') return st.video && st.video.url;
    if (st.status === 'failed' || st.status === 'nsfw') throw new Error('estado ' + st.status);
  }
  throw new Error('timeout');
}

(async () => {
  console.log(`Modelo: ${MODEL} · ${JOBS.length} videos → ${OUT}\n`);
  for (const job of JOBS) {
    try {
      console.log(`▸ ${job.name} …`);
      const created = await api('POST', '/v1/image2video/dop', {
        params: { model: MODEL, prompt: job.prompt, input_images: [{ type: 'image_url', image_url: job.image }], enhance_prompt: true },
      });
      const id = created.id; if (!id) throw new Error('sin id: ' + JSON.stringify(created));
      const url = await poll(id);
      if (!url) throw new Error('sin url');
      const dest = path.join(OUT, job.name + '.mp4');
      await download(url, dest);
      console.log(`  ✓ ${job.name}.mp4 (${(fs.statSync(dest).size / 1024).toFixed(0)} KB)  job=${id}`);
    } catch (e) {
      console.error(`  ✗ ${job.name}: ${e.message}`);
    }
  }
  console.log('\nListo.');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
