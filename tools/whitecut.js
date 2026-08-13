// Quita el fondo BLANCO (conectado a los bordes) de una imagen con flood-fill,
// dejando transparencia y CONSERVANDO las macetas blancas interiores (no tocan el borde).
// Sin IA, sin créditos. Uso: node tools/whitecut.js <urlLocal> <salida.png> [umbral]
'use strict';
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

(async () => {
  const url = process.argv[2] || 'http://localhost:3000/assets/orquideas-completa.png';
  const out = process.argv[3] || path.join(__dirname, '..', 'app', 'public', 'bloom', 'orquideas-completa-cut.png');
  const thr = Number(process.argv[4]) || 232;
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded' });
  const dataUrl = await p.evaluate(async (url, thr) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('img load fail')); img.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, w, h); const d = id.data;
    const isWhite = i => d[i] >= thr && d[i+1] >= thr && d[i+2] >= thr;
    const visited = new Uint8Array(w * h);
    const stack = [];
    const pushEdge = (x, y) => { const k = y*w+x; if (!visited[k]) { stack.push(k); } };
    for (let x = 0; x < w; x++) { pushEdge(x, 0); pushEdge(x, h-1); }
    for (let y = 0; y < h; y++) { pushEdge(0, y); pushEdge(w-1, y); }
    while (stack.length) {
      const k = stack.pop(); if (visited[k]) continue; visited[k] = 1;
      const i = k * 4; if (!isWhite(i)) continue;
      d[i+3] = 0; // transparente
      const x = k % w, y = (k / w) | 0;
      if (x > 0) stack.push(k-1); if (x < w-1) stack.push(k+1);
      if (y > 0) stack.push(k-w); if (y < h-1) stack.push(k+w);
    }
    // suavizado de borde: pixeles semi-blancos vecinos de transparentes → alpha parcial
    ctx.putImageData(id, 0, 0);
    return c.toDataURL('image/png');
  }, url, thr);
  const base64 = dataUrl.split(',')[1];
  fs.writeFileSync(out, Buffer.from(base64, 'base64'));
  const buf = fs.readFileSync(out);
  console.log('✓', out, buf.readUInt32BE(16)+'x'+buf.readUInt32BE(20), 'colorType='+buf[25], Math.round(buf.length/1024)+'KB');
  await b.close();
})().catch(e => { console.error('ERROR', e.message); process.exit(1); });
