// Captura un elemento (sección) por selector, con reveals forzados.
// Uso: node tools/shot-section.js "<selector>" [nombre]
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');
(async () => {
  const sel = process.argv[2] || '#categorias';
  const name = process.argv[3] || sel.replace(/[^a-z0-9]/gi, '');
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1200, deviceScaleFactor: 1 });
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.addStyleTag({ content: '[data-reveal],[data-reveal-stagger]>*{opacity:1!important;transform:none!important}.reveal-line>span{transform:none!important}' });
  // poblar grids
  await p.evaluate(async () => { await new Promise(r => { let y=0,s=600; const t=setInterval(()=>{scrollTo(0,y);y+=s;if(y>=document.body.scrollHeight){clearInterval(t);scrollTo(0,0);r();}},40); }); });
  await new Promise(r => setTimeout(r, 800));
  const el = await p.$(sel);
  await el.scrollIntoView();
  await new Promise(r => setTimeout(r, 300));
  const f = path.join(__dirname, 'shots', 'sec-' + name + '.png');
  await el.screenshot({ path: f });
  console.log('✓ ' + f);
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
