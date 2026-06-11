// Captura "estática": fuerza los reveals a su estado visible para ver el layout real
// (sin el artefacto de IntersectionObserver en headless). Corta en slices legibles.
// Uso: node tools/shot-static.js [ruta] [ancho] [alto]
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';
let route = process.argv[2] || 'index.html';
if (!route.startsWith('/')) route = '/' + route;
const W = Number(process.argv[3]) || 1440;
const H = Number(process.argv[4]) || 1600;
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const tag = 'st-' + (route.split('?')[0].replace(/[\/.]/g, '') || 'page');

const FORCE = `
  [data-reveal], [data-reveal-stagger] > * { opacity:1 !important; transform:none !important; }
  .reveal-line > span { transform:none !important; }
`;

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 30000 });
  await page.addStyleTag({ content: FORCE });
  // disparar JS que puebla grids (cats/ig/plans) por si depende de scroll
  await page.evaluate(async () => {
    await new Promise((res) => { let y=0,s=Math.round(innerHeight*0.8);
      const t=setInterval(()=>{scrollTo(0,y);y+=s;if(y>=document.body.scrollHeight){clearInterval(t);scrollTo(0,0);res();}},50); });
  });
  await page.addStyleTag({ content: FORCE });
  await new Promise((r) => setTimeout(r, 900));
  const total = await page.evaluate(() => document.body.scrollHeight);
  const n = Math.ceil(total / H);
  console.log(`alto total: ${total}px → ${n} slices`);
  for (let i = 0; i < n; i++) {
    await page.evaluate((y) => scrollTo(0, y), i * H);
    await new Promise((r) => setTimeout(r, 350));
    const f = path.join(OUT, `${tag}-${String(i).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    console.log('✓ ' + f);
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
