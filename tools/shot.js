// Capturas headless de las páginas del sitio (desktop + móvil) para iterar el diseño.
// Uso:  node tools/shot.js [pagina ...]   (sin args = todas)
'use strict';
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const BASE = process.env.SHOT_BASE || 'http://localhost:3000';
const OUT = path.join(__dirname, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const ALL = [
  ['index', '/index.html'],
  ['catalogo', '/catalogo.html'],
  ['producto', '/producto.html?id=box-rogelia'],
  ['suscripcion', '/suscripcion.html'],
  ['checkout', '/checkout.html'],
  ['confirmacion', '/confirmacion.html'],
];

const VIEWPORTS = [
  ['desktop', 1440, 900, 1],
  ['mobile', 390, 844, 2],
];

(async () => {
  const pick = process.argv.slice(2);
  const pages = pick.length ? ALL.filter(([n]) => pick.includes(n)) : ALL;

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  for (const [name, route] of pages) {
    for (const [vp, w, h, dsf] of VIEWPORTS) {
      const page = await browser.newPage();
      await page.setViewport({ width: w, height: h, deviceScaleFactor: dsf });
      try {
        await page.goto(BASE + route, { waitUntil: 'networkidle2', timeout: 30000 });
      } catch (e) {
        console.error(`! ${name} ${vp}: ${e.message}`);
      }
      // Recorrer la página para disparar los IntersectionObservers (reveals)
      await page.evaluate(async () => {
        await new Promise((resolve) => {
          let y = 0;
          const step = Math.round(window.innerHeight * 0.8);
          const timer = setInterval(() => {
            window.scrollTo(0, y);
            y += step;
            if (y >= document.body.scrollHeight) { clearInterval(timer); window.scrollTo(0, 0); resolve(); }
          }, 90);
        });
      });
      // dar tiempo a fuentes + animaciones de entrada
      await new Promise((r) => setTimeout(r, 1200));
      const file = path.join(OUT, `${name}-${vp}.png`);
      await page.screenshot({ path: file, fullPage: true });
      console.log(`✓ ${file}`);
      await page.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
