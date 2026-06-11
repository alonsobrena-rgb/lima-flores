const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1100, deviceScaleFactor: 1 });
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2' });
  await p.addStyleTag({ content: '[data-reveal],[data-reveal-stagger]>*{opacity:1!important;transform:none!important}.reveal-line>span{transform:none!important}' });
  await new Promise(r => setTimeout(r, 400));
  const m = await p.evaluate(() => {
    const mark = document.querySelector('#philosophy .index-mark');
    const h2 = document.querySelector('#philosophy .philosophy__right h2');
    const sec = document.querySelector('#philosophy');
    const r = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top + scrollY), left: Math.round(b.left), h: Math.round(b.height) }; };
    return { mark: r(mark), h2: r(h2), secTop: Math.round(sec.getBoundingClientRect().top + scrollY) };
  });
  console.log('index-mark top:', m.mark.top, '| h2 top:', m.h2.top, '| diff(mark-h2):', m.mark.top - m.h2.top, 'px');
  // screenshot the section
  await p.evaluate((y) => scrollTo(0, y - 60), m.secTop);
  await new Promise(r => setTimeout(r, 300));
  const el = await p.$('#philosophy');
  await el.screenshot({ path: require('path').join(__dirname, 'shots', 'philo-section.png') });
  console.log('saved tools/shots/philo-section.png');
  await b.close();
})();
