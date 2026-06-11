// Captura la landing ENTERA en un solo PNG, con reveals forzados.
'use strict';
const path = require('path');
const puppeteer = require('puppeteer');
(async () => {
  const w = Number(process.argv[2]) || 1440;
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: w, height: 1200, deviceScaleFactor: 1 });
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await p.addStyleTag({ content: '[data-reveal],[data-reveal-stagger]>*{opacity:1!important;transform:none!important}.reveal-line>span{transform:none!important}' });
  await p.evaluate(async () => { await new Promise(r => { let y=0,s=600; const t=setInterval(()=>{scrollTo(0,y);y+=s;if(y>=document.body.scrollHeight){clearInterval(t);scrollTo(0,0);r();}},40); }); });
  await new Promise(r => setTimeout(r, 1000));
  const f = path.join(__dirname, 'shots', `full-${w}.png`);
  await p.screenshot({ path: f, fullPage: true });
  console.log('✓ ' + f);
  await b.close();
})().catch(e => { console.error(e.message); process.exit(1); });
