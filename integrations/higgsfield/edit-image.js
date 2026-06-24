// Lima Flores — edición de imagen con Higgsfield (platform REST, keys con saldo).
// Sube una imagen y la pasa por un modelo de EDICIÓN (instrucción) para quitar/cambiar
// algo conservando el resto. Descarga el resultado.
//
//   node integrations/higgsfield/edit-image.js <model_id> <inputPath> <outName> "<prompt>"
//
// Flujo (igual que el SDK oficial higgsfield-client):
//   POST /files/generate-upload-url {content_type} -> {public_url, upload_url}
//   PUT upload_url (bytes)          -> archivo público en public_url
//   POST /{model_id} {arguments}    -> {request_id, status_url}
//   GET  /requests/{id}/status      -> hasta completed -> images[0].url
'use strict';
require('./load-env')();
const fs = require('fs');
const path = require('path');
const https = require('https');

const KEY = process.env.HF_API_KEY, SECRET = process.env.HF_API_SECRET;
const HOST = 'platform.higgsfield.ai';
if (!KEY || !SECRET) { console.error('Faltan HF_API_KEY / HF_API_SECRET'); process.exit(1); }
const AUTH = `Key ${KEY}:${SECRET}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(__dirname, 'out');

function req(method, pathOrUrl, { json, headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    let opts;
    if (/^https?:\/\//.test(pathOrUrl)) {
      const u = new URL(pathOrUrl);
      opts = { hostname: u.hostname, path: u.pathname + u.search, method, headers: { ...headers } };
    } else {
      opts = { hostname: HOST, path: pathOrUrl, method, headers: { Authorization: AUTH, Accept: 'application/json', ...headers } };
    }
    let payload = body || null;
    if (json !== undefined) { payload = JSON.stringify(json); opts.headers['Content-Type'] = 'application/json'; opts.headers['Content-Length'] = Buffer.byteLength(payload); }
    else if (body) { opts.headers['Content-Length'] = Buffer.byteLength(body); }
    const r = https.request(opts, (res) => {
      let d = []; res.on('data', (c) => d.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(d);
        const txt = buf.toString('utf8');
        let j; try { j = JSON.parse(txt); } catch { j = txt; }
        resolve({ status: res.statusCode, json: j, text: txt });
      });
    });
    r.on('error', reject);
    if (payload) r.write(payload);
    r.end();
  });
}

function download(url, dest, depth = 0) {
  return new Promise((resolve, reject) => {
    if (depth > 5) return reject(new Error('too many redirects'));
    https.get(url, (r) => {
      if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location) { r.resume(); return resolve(download(r.headers.location, dest, depth + 1)); }
      if (r.statusCode !== 200) { r.resume(); return reject(new Error('HTTP ' + r.statusCode + ' al descargar')); }
      const f = fs.createWriteStream(dest); r.pipe(f);
      f.on('finish', () => f.close(() => resolve())); f.on('error', (e) => fs.unlink(dest, () => reject(e)));
    }).on('error', reject);
  });
}

async function uploadImage(filePath) {
  const ct = filePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const u = await req('POST', '/files/generate-upload-url', { json: { content_type: ct } });
  if (u.status < 200 || u.status >= 300) throw new Error(`generate-upload-url HTTP ${u.status}: ${u.text.slice(0, 300)}`);
  const { public_url, upload_url } = u.json;
  const bytes = fs.readFileSync(filePath);
  const put = await req('PUT', upload_url, { body: bytes, headers: { 'Content-Type': ct } });
  if (put.status < 200 || put.status >= 300) throw new Error(`PUT upload HTTP ${put.status}: ${put.text.slice(0, 200)}`);
  return public_url;
}

function resultUrlOf(st) {
  for (const a of [st.images, st.results, st.outputs, st.assets].filter(Array.isArray))
    for (const it of a) { if (typeof it === 'string') return it; if (it && (it.url || (it.image && it.image.url))) return it.url || it.image.url; }
  if (st.image && st.image.url) return st.image.url;
  if (typeof st.url === 'string') return st.url;
  return null;
}

async function poll(statusUrl) {
  for (let i = 0; i < 150; i++) {
    await sleep(4000);
    const s = await req('GET', statusUrl);
    const st = s.json || {};
    process.stdout.write(`\r  estado: ${st.status || s.status}        `);
    if (st.status === 'completed') { process.stdout.write('\n'); const u = resultUrlOf(st); if (!u) throw new Error('completed sin URL: ' + JSON.stringify(st).slice(0, 500)); return u; }
    if (st.status === 'failed' || st.status === 'nsfw' || st.status === 'canceled') { process.stdout.write('\n'); throw new Error('Generación ' + st.status + ' :: ' + JSON.stringify(st).slice(0, 300)); }
  }
  throw new Error('Timeout');
}

(async () => {
  const [model, inputPath, outName, prompt] = process.argv.slice(2);
  if (!model || !inputPath || !outName || !prompt) { console.error('Uso: node edit-image.js <model_id> <inputPath> <outName> "<prompt>"'); process.exit(1); }
  console.log('▸ subiendo imagen…');
  const imgUrl = await uploadImage(inputPath);
  console.log('  public_url:', imgUrl);

  // Campo de imagen por defecto: image_urls (estilo Seedream/fal). Para otros
  // modelos, pasa el esquema completo por HF_ARGS (JSON) usando {{IMG}} como
  // marcador de la URL subida, o añade/parchea campos con HF_EXTRA (JSON).
  let args;
  if (process.env.HF_ARGS) {
    args = JSON.parse(process.env.HF_ARGS.replace(/\{\{IMG\}\}/g, imgUrl));
  } else {
    const field = process.env.HF_IMG_FIELD || 'image_urls'; // reve/edit usa 'image_url' (string)
    args = { prompt };
    args[field] = process.env.HF_IMG_ARRAY === '0' ? imgUrl : [imgUrl];
  }
  if (process.env.HF_EXTRA) Object.assign(args, JSON.parse(process.env.HF_EXTRA));
  console.log('  args keys:', Object.keys(args).join(', '));

  console.log(`▸ submit ${model} …`);
  const sub = await req('POST', '/' + model, { json: args });
  if (sub.status < 200 || sub.status >= 300) { console.error(`SUBMIT HTTP ${sub.status}: ${sub.text.slice(0, 500)}`); process.exit(2); }
  const statusUrl = (sub.json.status_url) || `/requests/${sub.json.request_id}/status`;
  console.log('  request_id:', sub.json.request_id);
  const url = await poll(statusUrl.replace('https://' + HOST, ''));
  console.log('  result:', url);
  fs.mkdirSync(outDir, { recursive: true });
  const ext = (url.split('?')[0].match(/\.(png|jpe?g|webp)$/i) || [, 'jpg'])[1].toLowerCase();
  const out = path.join(outDir, `${outName}.${ext}`);
  await download(url, out);
  console.log(`✓ ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
})().catch((e) => { console.error('ERROR:', e && e.message ? e.message : e); process.exit(1); });
