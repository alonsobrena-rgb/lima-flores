const puppeteer = require('puppeteer');
(async () => {
  const b = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const p = await b.newPage();
  await p.setViewport({ width: 1440, height: 1500, deviceScaleFactor: 1 });
  await p.goto('http://localhost:3000/index.html', { waitUntil: 'networkidle2' });
  const data = await p.evaluate(() => {
    const sec = (el) => { while (el && !(el.matches && el.matches('section,div.lf-thumbs,div.marquee,footer'))) el = el.parentElement; return el; };
    const blooms = [...document.querySelectorAll('.section-bloom img, .philosophy__bloom img, .signature__media img, .lf-hero__orchids')];
    return blooms.map(im => {
      const r = im.getBoundingClientRect();
      const host = sec(im);
      const hr = host ? host.getBoundingClientRect() : null;
      const inside = hr ? (r.top >= hr.top - 2 && r.bottom <= hr.bottom + 2) : null;
      return {
        img: (im.getAttribute('src')||'').split('/').pop(),
        host: host ? (host.id || host.className.split(' ')[0]) : '?',
        y: Math.round(r.top), h: Math.round(r.height), w: Math.round(r.width),
        hostY: hr ? Math.round(hr.top) : null, hostBot: hr ? Math.round(hr.bottom) : null,
        inside
      };
    });
  });
  console.log(JSON.stringify(data, null, 1));
  await b.close();
})();
