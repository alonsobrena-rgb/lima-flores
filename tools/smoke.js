// Smoke test funcional: carrito (badge + drawer) y lightbox de producto.
'use strict';
const puppeteer = require('puppeteer');
const BASE = 'http://localhost:3000';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const results = [];
  const page = await browser.newPage();

  // 1) Carrito en el home
  await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2' });
  await page.evaluate(() => LimaCart.add('orquideas-grandes-de-dos-varas-en-maceta'));
  await new Promise((r) => setTimeout(r, 400));
  const badge = await page.$eval('[data-cart-count]', (b) => ({ text: b.textContent, hidden: b.hidden }));
  const drawerOpen = await page.$eval('#cart-drawer', (d) => d.classList.contains('is-open'));
  results.push(`carrito badge="${badge.text}" hidden=${badge.hidden} drawerOpen=${drawerOpen}`);

  // 2) Lightbox en producto con varias fotos
  await page.goto(BASE + '/producto.html?id=box-rogelia', { waitUntil: 'networkidle2' });
  const thumbs = await page.$$eval('.pd-thumb', (els) => els.length);
  await page.click('.pd-zoom');
  await new Promise((r) => setTimeout(r, 400));
  const lbOpen = await page.$eval('#pd-lightbox', (l) => l.classList.contains('is-open')).catch(() => false);
  results.push(`producto thumbs=${thumbs} lightboxOpen=${lbOpen}`);

  // 3) Fuentes aplicadas (Jost en body)
  await page.goto(BASE + '/catalogo.html', { waitUntil: 'networkidle2' });
  const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  const accent = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim());
  results.push(`bodyFont="${bodyFont}" accent="${accent}"`);

  await browser.close();
  console.log(results.join('\n'));
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
