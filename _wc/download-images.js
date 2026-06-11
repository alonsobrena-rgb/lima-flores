// Descarga las imágenes de WooCommerce → site/assets/products/<slug>.jpg
// Concurrencia 6 para no saturar el server de Fiorella.
'use strict';
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Readable } = require('stream');

const items = require('./migrated-full.json');
const OUT_DIR = path.join(__dirname, '..', 'site', 'assets', 'products');
fs.mkdirSync(OUT_DIR, { recursive: true });

const CONCURRENCY = 6;

async function downloadOne(item) {
  const dest = path.join(OUT_DIR, `${item.id}.jpg`);
  if (fs.existsSync(dest)) {
    return { id: item.id, status: 'skip', bytes: fs.statSync(dest).size };
  }
  try {
    const res = await fetch(item._wc_image_src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return { id: item.id, status: 'ok', bytes: buf.length };
  } catch (e) {
    return { id: item.id, status: 'err', error: e.message };
  }
}

(async () => {
  const queue = [...items];
  const results = [];
  let inFlight = 0;
  let done = 0;

  await new Promise((resolve) => {
    const next = () => {
      while (inFlight < CONCURRENCY && queue.length) {
        const item = queue.shift();
        inFlight++;
        downloadOne(item).then((r) => {
          results.push(r);
          done++;
          const mark = r.status === 'ok' ? '✓' : r.status === 'skip' ? '·' : '✗';
          const size = r.bytes ? `${Math.round(r.bytes / 1024)}KB` : r.error;
          console.log(`  ${mark} ${done.toString().padStart(2)}/${items.length} ${r.id} (${size})`);
          inFlight--;
          if (done === items.length) return resolve();
          next();
        });
      }
    };
    next();
  });

  const ok = results.filter(r => r.status === 'ok').length;
  const skip = results.filter(r => r.status === 'skip').length;
  const err = results.filter(r => r.status === 'err');
  const totalBytes = results.reduce((a, r) => a + (r.bytes || 0), 0);
  console.log(`\nResumen: ${ok} bajadas + ${skip} ya existían + ${err.length} errores · total ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  if (err.length) err.forEach(e => console.log(`  ERR ${e.id}: ${e.error}`));
})();
