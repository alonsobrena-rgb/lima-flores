// Foto enmarcada (NO recorte transparente) de "Orquídeas grandes en maceta".
// La tarjeta de marca es blanca sobre fondo blanco: no se puede keyear. En vez
// de transparencia, rellenamos el fondo a BLANCO uniforme (flood-fill desde los
// bordes) y recortamos al contenido → foto limpia para enmarcar en la sección.
// La tarjeta "Lima Flores" queda intacta (su blanco coincide con el fondo).
// Requiere el dev server en localhost:5173 (same-origin para el canvas).
//   node tools/photo-orq-grandes.js [threshold] [salida.webp] [fuente.jpg]
'use strict';
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const thr = Number(process.argv[2]) || 64;
  const outName = process.argv[3] || 'orquideas-grandes-maceta-foto.webp';
  const srcFile = process.argv[4] || 'orquideas-grandes-en-maceta-3.jpg';
  const out = path.join(__dirname, '..', 'app', 'public', 'bloom', outName);
  const src = 'http://localhost:5173/products/' + srcFile;

  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  const dataUrl = await p.evaluate(async (url, thr) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('img load fail')); img.src = url; });
    const tw = Math.min(1400, img.naturalWidth);
    const w = tw, h = Math.round(img.naturalHeight * tw / img.naturalWidth);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h); const d = id.data;

    // Fondo muestreado en esquinas + borde superior.
    const samples = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w >> 1, 2], [w >> 2, 2], [(3 * w) >> 2, 2]];
    let br = 0, bgg = 0, bb = 0;
    for (const [x, y] of samples) { const i = (y * w + x) * 4; br += d[i]; bgg += d[i + 1]; bb += d[i + 2]; }
    br /= samples.length; bgg /= samples.length; bb /= samples.length;
    const tol = thr;
    const isBg = (i) => {
      const dr = d[i] - br, dg = d[i + 1] - bgg, db = d[i + 2] - bb;
      return (dr * dr + dg * dg + db * db) <= tol * tol;
    };
    // Flood-fill desde los bordes → pinta el fondo de BLANCO puro (no transparente).
    const visited = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
    const mark = new Uint8Array(w * h); // 1 = fondo alcanzado
    while (stack.length) {
      const k = stack.pop(); if (visited[k]) continue; visited[k] = 1;
      const i = k * 4; if (!isBg(i)) continue;
      mark[k] = 1;
      const x = k % w, y = (k / w) | 0;
      if (x > 0) stack.push(k - 1); if (x < w - 1) stack.push(k + 1);
      if (y > 0) stack.push(k - w); if (y < h - 1) stack.push(k + w);
    }
    for (let k = 0; k < w * h; k++) {
      if (mark[k]) { const i = k * 4; d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = 255; }
    }

    // bbox del contenido (lo que NO es fondo alcanzado) para recortar.
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!mark[y * w + x]) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    // Padding generoso para que respire como una foto enmarcada.
    const padX = Math.round((maxX - minX) * 0.10) + 24;
    const padY = Math.round((maxY - minY) * 0.06) + 24;
    minX = Math.max(0, minX - padX); minY = Math.max(0, minY - padY);
    maxX = Math.min(w - 1, maxX + padX); maxY = Math.min(h - 1, maxY + padY);
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    ctx.putImageData(id, 0, 0);
    const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
    const cx2 = c2.getContext('2d');
    cx2.fillStyle = '#ffffff'; cx2.fillRect(0, 0, cw, ch); // base blanca por si acaso
    cx2.drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
    return c2.toDataURL('image/webp', 0.92);
  }, src, thr);

  const base64 = dataUrl.split(',')[1];
  fs.writeFileSync(out, Buffer.from(base64, 'base64'));
  console.log('✓', out, Math.round(fs.statSync(out).size / 1024) + 'KB');
  await b.close();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
