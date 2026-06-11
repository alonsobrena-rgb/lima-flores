// Descarga las fotos EXTRA de cada producto → site/assets/products/<slug>-N.jpg (N=2,3,...)
'use strict';
const fs = require('fs');
const path = require('path');

const items = require('./migrated-full.json');
const OUT_DIR = path.join(__dirname, '..', 'site', 'assets', 'products');
const CONCURRENCY = 6;

const jobs = [];
for (const item of items) {
  const extras = item._wc_images_extra || [];
  extras.forEach((src, i) => {
    jobs.push({ id: item.id, n: i + 2, src });
  });
}

async function downloadOne(job) {
  const dest = path.join(OUT_DIR, `${job.id}-${job.n}.jpg`);
  if (fs.existsSync(dest)) return { ...job, status: 'skip', bytes: fs.statSync(dest).size };
  try {
    const res = await fetch(job.src);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    fs.writeFileSync(dest, buf);
    return { ...job, status: 'ok', bytes: buf.length };
  } catch (e) {
    return { ...job, status: 'err', error: e.message };
  }
}

(async () => {
  console.log(`Bajando ${jobs.length} fotos extras…`);
  const results = [];
  let inFlight = 0, done = 0;
  await new Promise((resolve) => {
    const next = () => {
      while (inFlight < CONCURRENCY && jobs.length) {
        const job = jobs.shift();
        inFlight++;
        downloadOne(job).then((r) => {
          results.push(r);
          done++;
          const mark = r.status === 'ok' ? '✓' : r.status === 'skip' ? '·' : '✗';
          const size = r.bytes ? `${Math.round(r.bytes / 1024)}KB` : r.error;
          console.log(`  ${mark} ${done.toString().padStart(3)} ${r.id}-${r.n} (${size})`);
          inFlight--;
          if (done === results.length + jobs.length) return resolve();
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
  console.log(`\nResumen: ${ok} bajadas + ${skip} ya existían + ${err.length} errores · ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
  if (err.length) err.forEach(e => console.log(`  ERR ${e.id}-${e.n}: ${e.error}`));
})();
