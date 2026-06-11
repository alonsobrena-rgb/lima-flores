// Captura cortes legibles (viewport) de una página, bajando en pasos.
// Uso: node tools/slice.js [ruta] [ancho] [alto]
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
let route = process.argv[2] || 'index.html';
if (!route.startsWith('/')) route = '/' + route;
const W = Number(process.argv[3]) || 1440;
const H = Number(process.argv[4]) || 1800;
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const tag = (route.split('?')[0].replace(/[\/.]/g, '') || 'page');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 30000 });
  // recorrer para disparar reveals
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let y = 0; const step = Math.round(window.innerHeight * 0.8);
      const t = setInterval(() => { window.scrollTo(0, y); y += step;
        if (y >= document.body.scrollHeight) { clearInterval(t); resolve(); } }, 70);
    });
  });
  const total = await page.evaluate(() => document.body.scrollHeight);
  const n = Math.ceil(total / H);
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * H);
    await new Promise((r) => setTimeout(r, 500));
    const f = path.join(OUT, `slice-${tag}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    console.log('✓ ' + f);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
