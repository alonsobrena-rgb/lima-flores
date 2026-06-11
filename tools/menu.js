// Verifica el menú móvil: abre la hamburguesa y captura.
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 390, height: 800, deviceScaleFactor: 2 });
  await page.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2' });
  await page.click('#lfBurger');
  await new Promise((r) => setTimeout(r, 700));
  const f = path.join(__dirname, 'shots', 'menu-open.png');
  await page.screenshot({ path: f });
  console.log('✓ ' + f);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
