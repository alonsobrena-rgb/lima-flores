// Edita una imagen con reve/edit (cuenta cloud / API keys) y descarga el PNG.
// Uso: node tools/reve-edit.js "<prompt>" "<image_url pública>" <salida.png>
'use strict';
require('../integrations/higgsfield/load-env')();
const https = require('https');
const fs = require('fs');
const path = require('path');
const KEY = process.env.HF_API_KEY, SECRET = process.env.HF_API_SECRET;
const HOST = 'platform.higgsfield.ai';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function req(method, pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = bodyObj ? JSON.stringify(bodyObj) : null;
    const headers = { 'Authorization': `Key ${KEY}:${SECRET}`, 'Accept': 'application/json' };
    if (body) { headers['Content-Type'] = 'application/json'; headers['Content-Length'] = Buffer.byteLength(body); }
    const r = https.request({ hostname: HOST, path: pathname, method, headers }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; } (res.statusCode>=200&&res.statusCode<300)?resolve(j):reject(new Error(res.statusCode+' '+d)); });
    });
    r.on('error', reject); if (body) r.write(body); r.end();
  });
}
function download(url, dest, depth=0){return new Promise((resolve,reject)=>{if(depth>5)return reject(new Error('redirects'));https.get(url,r=>{if(r.statusCode>=300&&r.statusCode<400&&r.headers.location){r.resume();return resolve(download(r.headers.location,dest,depth+1));}if(r.statusCode!==200){r.resume();return reject(new Error('dl '+r.statusCode));}const f=fs.createWriteStream(dest);r.pipe(f);f.on('finish',()=>f.close(()=>resolve()));f.on('error',e=>{fs.unlink(dest,()=>reject(e));});}).on('error',reject);});}

(async () => {
  const [prompt, imageUrl, outName] = process.argv.slice(2);
  if (!prompt || !imageUrl) { console.error('uso: reve-edit.js "<prompt>" "<imageUrl>" [salida.png]'); process.exit(1); }
  const out = path.join(__dirname, 'hero-try', outName || ('reve-' + Date.now() + '.png'));
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const created = await req('POST', '/reve/edit', { prompt, image_url: imageUrl });
  const id = created.request_id; console.log('job:', id);
  let url;
  for (let i = 0; i < 40; i++) {
    await sleep(4000);
    const st = await req('GET', `/requests/${id}/status`);
    process.stdout.write('\r  ' + st.status + '    ');
    if (st.status === 'completed') { url = st.images && st.images[0] && st.images[0].url; break; }
    if (st.status === 'failed' || st.status === 'nsfw') throw new Error('estado ' + st.status);
  }
  process.stdout.write('\n');
  if (!url) throw new Error('sin url');
  await download(url, out);
  const b = fs.readFileSync(out);
  console.log('✓', out, b.readUInt32BE(16)+'x'+b.readUInt32BE(20), 'colorType='+b[25]);
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
