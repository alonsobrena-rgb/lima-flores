// Recorta el fondo claro de la foto del producto "Orquídeas grandes en maceta"
// (imagen 2: 4 orquídeas multicolor en maceta) → webp con alpha para la sección
// de orquídeas de la landing. Flood-fill desde los bordes (conserva las macetas).
// Requiere el dev server en localhost:5173 (same-origin para el canvas).
//   node tools/cutout-orq-grandes.js [threshold] [salida.webp]
'use strict';
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const thr = Number(process.argv[2]) || 224;
  const outName = process.argv[3] || 'bloom-orquideas-grandes-maceta.webp';
  const srcFile = process.argv[4] || 'orquideas-grandes-en-maceta-2.jpg';
  const out = path.join(__dirname, '..', 'app', 'public', 'bloom', outName);
  const src = 'http://localhost:5173/products/' + srcFile;

  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('http://localhost:5173/', { waitUntil: 'domcontentloaded' });
  const dataUrl = await p.evaluate(async (url, thr) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('img load fail')); img.src = url; });
    // downscale a ~1400px de ancho
    const tw = Math.min(1400, img.naturalWidth);
    const w = tw, h = Math.round(img.naturalHeight * tw / img.naturalWidth);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const id = ctx.getImageData(0, 0, w, h); const d = id.data;

    // Color de fondo muestreado en las esquinas y borde superior (promedio).
    const samples = [[2, 2], [w - 3, 2], [2, h - 3], [w - 3, h - 3], [w >> 1, 2], [w >> 2, 2], [(3 * w) >> 2, 2]];
    let br = 0, bgg = 0, bb = 0;
    for (const [x, y] of samples) { const i = (y * w + x) * 4; br += d[i]; bgg += d[i + 1]; bb += d[i + 2]; }
    br /= samples.length; bgg /= samples.length; bb /= samples.length;
    // tolerancia: thr se reinterpreta como distancia (Euclídea RGB) al fondo.
    const tol = thr;
    const isBg = (i) => {
      const dr = d[i] - br, dg = d[i + 1] - bgg, db = d[i + 2] - bb;
      return (dr * dr + dg * dg + db * db) <= tol * tol;
    };
    const visited = new Uint8Array(w * h);
    const stack = [];
    for (let x = 0; x < w; x++) { stack.push(x); stack.push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { stack.push(y * w); stack.push(y * w + w - 1); }
    while (stack.length) {
      const k = stack.pop(); if (visited[k]) continue; visited[k] = 1;
      const i = k * 4; if (!isBg(i)) continue;
      d[i + 3] = 0;
      const x = k % w, y = (k / w) | 0;
      if (x > 0) stack.push(k - 1); if (x < w - 1) stack.push(k + 1);
      if (y > 0) stack.push(k - w); if (y < h - 1) stack.push(k + w);
    }
    // feather 1px: pixel opaco casi-blanco con vecino transparente → alpha parcial
    const a0 = new Uint8Array(w * h);
    for (let k = 0; k < w * h; k++) a0[k] = d[k * 4 + 3];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const k = y * w + x, i = k * 4;
      if (a0[k] === 0) continue;
      const dr = d[i] - br, dg = d[i + 1] - bgg, db = d[i + 2] - bb;
      const dist2 = dr * dr + dg * dg + db * db;
      // Borde claro (halo blanco) junto a un transparente → erode (alpha 0) para
      // matar el fleco; solo afecta pixeles cercanos al fondo, no el sujeto saturado.
      if (dist2 <= (tol * 1.45) * (tol * 1.45)) {
        if (!a0[k - 1] || !a0[k + 1] || !a0[k - w] || !a0[k + w]) d[i + 3] = 0;
      }
    }
    // Protege la tarjeta "Lima Flores" (cartulina blanca clavada en la maceta):
    // su fondo blanco cae en el mismo rango que el del flood-fill y se borraba.
    // Restauramos alpha pleno en su rectángulo (coords normalizadas del original).
    const PR = [0.503, 0.430, 0.620, 0.520]; // x0,y0,x1,y1
    const px0 = Math.max(0, (PR[0] * w) | 0), py0 = Math.max(0, (PR[1] * h) | 0);
    const px1 = Math.min(w - 1, (PR[2] * w) | 0), py1 = Math.min(h - 1, (PR[3] * h) | 0);
    for (let y = py0; y <= py1; y++) for (let x = px0; x <= px1; x++) d[(y * w + x) * 4 + 3] = 255;

    // bounding box de lo opaco para recortar márgenes
    let minX = w, minY = h, maxX = 0, maxY = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (d[(y * w + x) * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    const pad = 6;
    minX = Math.max(0, minX - pad); minY = Math.max(0, minY - pad);
    maxX = Math.min(w - 1, maxX + pad); maxY = Math.min(h - 1, maxY + pad);
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    ctx.putImageData(id, 0, 0);
    const c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
    c2.getContext('2d').drawImage(c, minX, minY, cw, ch, 0, 0, cw, ch);
    return c2.toDataURL('image/webp', 0.92);
  }, src, thr);

  const base64 = dataUrl.split(',')[1];
  fs.writeFileSync(out, Buffer.from(base64, 'base64'));
  console.log('✓', out, Math.round(fs.statSync(out).size / 1024) + 'KB');
  await b.close();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
