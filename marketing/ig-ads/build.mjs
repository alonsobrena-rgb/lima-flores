#!/usr/bin/env node
// Genera los creativos de la campaña de Instagram a partir de marketing/ig-ads/ads.json.
//
//   node marketing/ig-ads/build.mjs
//
// Renderiza cada anuncio como HTML y lo fotografía con Chromium headless al tamaño
// exacto que pide Meta (1080×1350 para feed, 1080×1920 para historias). Las fotos
// salen del catálogo real: site/assets/products/.
//
// Dependencias: solo un Chromium en el sistema. Las tipografías (Cormorant Garamond,
// Jost, JetBrains Mono) se bajan una vez de Google Fonts y quedan cacheadas en
// .fontcache/ — ver FONT_CSS_URL. Sin red, el build usa las serif/sans del sistema.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PHOTOS = path.join(ROOT, 'site/assets/products');
const OUT = path.join(HERE, 'creativos');
const CACHE = path.join(HERE, '.fontcache');

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap';

// Paleta del sitio — site/css/lima.css
const C = {
  bone: '#F4EFE5',
  paper: '#FBF8F1',
  ink: '#1B1A17',
  line: '#DCD4C2',
  moss: '#4F5C3F',
  terra: '#B6855E',
  gold: '#A57F45',
  rosa: '#9E2B5E',
};

/* ─────────────────────────────  utilidades  ───────────────────────────── */

function findChromium() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const globs = [
    '/opt/pw-browsers',
    path.join(os.homedir(), '.cache/ms-playwright'),
    path.join(os.homedir(), '.cache/puppeteer'),
  ];
  for (const base of globs) {
    if (!fs.existsSync(base)) continue;
    for (const dir of fs.readdirSync(base)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(base, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      return execFileSync('which', [bin], { encoding: 'utf8' }).trim();
    } catch { /* seguimos buscando */ }
  }
  throw new Error('No encontré Chromium. Exporta CHROME_PATH=/ruta/al/chrome');
}

// Baja Google Fonts y devuelve un bloque @font-face con las woff2 embebidas en
// base64: así el render no depende de la red ni del orden de carga de fuentes.
async function fontCss() {
  const cached = path.join(CACHE, 'fonts.css');
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');

  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
  let css;
  try {
    const res = await fetch(FONT_CSS_URL, { headers: { 'User-Agent': ua } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    css = await res.text();
  } catch (err) {
    console.warn(`  ! Google Fonts no disponible (${err.message}); uso las fuentes del sistema.`);
    return '';
  }

  // Nos quedamos solo con el subset latino: es el único que usa el copy.
  const blocks = css.split('/*').filter((b) => b.startsWith(' latin */'));
  const out = [];
  for (const block of blocks) {
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    const family = block.match(/font-family:\s*'([^']+)'/)[1];
    const style = block.match(/font-style:\s*(\w+)/)[1];
    const weight = block.match(/font-weight:\s*(\d+)/)[1];
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': ua } })).arrayBuffer());
    out.push(
      `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};` +
        `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')}`,
    );
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, out.join('\n'));
  return out.join('\n');
}

const dataUri = (file) =>
  `data:image/jpeg;base64,${fs.readFileSync(path.join(PHOTOS, file)).toString('base64')}`;

// El logo de la página (site/assets/logo.png), en sus dos versiones —
// ver marca/prep-logo.py.
const MARCA = Object.fromEntries(
  ['logo', 'logo-claro'].map((n) => [
    n,
    `data:image/png;base64,${fs.readFileSync(path.join(HERE, 'marca', `${n}.png`)).toString('base64')}`,
  ]),
);

// `onDark` cambia la caligrafía gris por la versión en hueso, que es la única
// que se lee sobre foto oscura o sobre el panel de tinta.
const logo = (h, onDark) =>
  `<img src="${MARCA[onDark ? 'logo-claro' : 'logo']}" alt="Lima Flores"
        style="height:${h}px;width:auto;display:block">`;

/* ─────────────────────────────  plantillas  ───────────────────────────── */

const base = (fonts, w, h, body) => `<!doctype html><meta charset="utf-8"><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;background:${C.bone};font-family:'Jost',-apple-system,'Helvetica Neue',sans-serif;color:${C.ink};
  -webkit-font-smoothing:antialiased}
.d{font-family:'Cormorant Garamond','EB Garamond',Georgia,serif;font-weight:300;letter-spacing:-.022em;line-height:.94}
.d em{font-style:italic;font-weight:400;color:var(--em,${C.rosa})}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.24em}
.rule{height:1px;background:${C.line}}
.shot{width:100%;height:100%;object-fit:cover;display:block}
</style>${body}`;

// Geometría absoluta a propósito: con flex, un titular de una línea más rompía
// el encuadre y el precio se salía del lienzo sin que el render avisara.
const img = (a, photo) =>
  `<img src="${photo}" class="shot" style="object-fit:${a.creative.fit};` +
  `object-position:${a.creative.position || '50% 50%'}">`;

// A · Editorial: foto grande, titular abajo. Para público frío.
const editorial = (a, photo) => `
<div style="position:absolute;inset:0;background:${C.bone}">
  <div style="position:absolute;top:60px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center">
    <span class="mono" style="font-size:19px;color:${C.gold}">${a.creative.eyebrow}</span>
    ${logo(74)}
  </div>
  <div class="rule" style="position:absolute;top:126px;left:72px;right:72px"></div>
  <div style="position:absolute;top:162px;left:72px;width:936px;height:700px;background:#fff;overflow:hidden">
    ${img(a, photo)}
  </div>
  <div style="position:absolute;top:902px;left:72px;right:72px;height:320px">
    <h1 class="d" style="font-size:${a.creative.hlSize || 100}px">${a.creative.headline}</h1>
    <p style="font-size:27px;font-weight:300;line-height:1.42;color:#4A473F;margin-top:24px;max-width:820px">${a.creative.sub}</p>
  </div>
  <div class="rule" style="position:absolute;top:1236px;left:72px;right:72px"></div>
  <div style="position:absolute;top:1258px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center">
    <span class="d" style="font-size:46px;font-weight:400">${a.creative.price}</span>
    <span class="mono" style="font-size:17px;color:${C.moss}">${a.creative.footer}</span>
  </div>
</div>`;

// B · Split: panel oscuro con la lista de entregables + foto a sangre. Objeciones.
const split = (a, photo) => `
<div style="position:absolute;inset:0">
  <div style="position:absolute;top:0;bottom:0;left:0;width:486px;background:${C.ink};color:${C.bone}">
    <span class="mono" style="position:absolute;top:64px;left:52px;font-size:17px;color:${C.terra}">${a.creative.eyebrow}</span>
    <h1 class="d" style="position:absolute;top:112px;left:52px;right:52px;font-size:${a.creative.hlSize || 82}px">${a.creative.headline}</h1>
    <ul style="position:absolute;left:52px;right:52px;bottom:214px;list-style:none;
               border-top:1px solid rgba(244,239,229,.28)">
      ${a.creative.items
        .map(
          (t) => `<li style="display:flex;gap:16px;align-items:flex-start;padding:19px 0;
              border-bottom:1px solid rgba(244,239,229,.14);font-size:24px;font-weight:300;line-height:1.34">
            <span style="color:${C.terra};font-size:18px;line-height:1.75">—</span><span>${t}</span></li>`,
        )
        .join('')}
    </ul>
    <div style="position:absolute;left:52px;bottom:64px">
      <div class="d" style="font-size:64px;font-weight:400;color:#fff">${a.creative.price}</div>
      <div class="mono" style="font-size:15px;color:rgba(244,239,229,.6);margin-top:12px">${a.creative.footer}</div>
    </div>
  </div>
  <div style="position:absolute;top:0;bottom:0;left:486px;right:0;background:#fff;overflow:hidden">
    ${img(a, photo)}
    <div style="position:absolute;top:40px;right:40px">${logo(72)}</div>
  </div>
</div>`;

// C · Cita: prueba social o manifiesto arriba, foto abajo. Para consideración.
const quote = (a, photo) => `
<div style="position:absolute;inset:0;background:${C.paper}">
  <div style="position:absolute;top:70px;left:76px;right:76px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:23px;letter-spacing:.42em;color:${C.gold}">★★★★★</span>
    ${logo(72)}
  </div>
  <blockquote class="d" style="position:absolute;top:148px;left:76px;right:76px;
              font-size:${a.creative.hlSize || 74}px;line-height:1.04">«${a.creative.quote}»</blockquote>
  <div style="position:absolute;left:76px;bottom:648px">
    <div style="display:flex;align-items:center;gap:18px">
      <span style="width:44px;height:1px;background:${C.line}"></span>
      <span style="font-size:23px;font-weight:400">${a.creative.author}</span>
    </div>
    <div class="mono" style="font-size:15px;color:${C.moss};margin-top:14px;margin-left:62px">${a.creative.meta}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:620px;background:#fff;
              border-top:1px solid ${C.line};overflow:hidden">
    ${img(a, photo)}
    <div style="position:absolute;left:0;right:0;bottom:0;padding:40px 76px;display:flex;
                justify-content:space-between;align-items:center;
                background:linear-gradient(to top,rgba(251,248,241,.97) 40%,rgba(251,248,241,0))">
      <span class="d" style="font-size:44px;font-weight:400">${a.creative.price}</span>
      <span class="mono" style="font-size:16px;color:${C.moss}">${a.creative.footer}</span>
    </div>
  </div>
</div>`;

// S · Historia 9:16. Todo el texto vive entre los 250px de arriba y los 372px de
// abajo que tapan la interfaz de Instagram.
const story = (a, photo) => `
<div style="position:absolute;inset:0;background:${C.bone}">
  <div style="position:absolute;top:0;left:0;right:0;height:1010px;background:#fff;overflow:hidden">
    ${img(a, photo)}
    <div style="position:absolute;left:0;right:0;bottom:0;height:240px;
                background:linear-gradient(to top,${C.bone},rgba(244,239,229,0))"></div>
  </div>
  <div style="position:absolute;left:78px;right:78px;top:1064px;height:376px">
    <span class="mono" style="font-size:18px;color:${C.gold}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || 96}px;margin-top:24px">${a.creative.headline}</h1>
    <p style="font-size:30px;font-weight:300;line-height:1.4;color:#4A473F;margin-top:26px;max-width:860px">${a.creative.sub}</p>
  </div>
  <div style="position:absolute;left:78px;right:78px;bottom:372px;display:flex;justify-content:space-between;align-items:center">
    <span style="display:inline-flex;align-items:center;gap:18px;background:${C.ink};color:${C.bone};
                 padding:26px 46px;border-radius:999px">
      <span style="font-size:26px;font-weight:400">${a.creative.pill}</span>
      <span style="font-size:24px;color:${C.terra}">→</span>
    </span>
    ${logo(72)}
  </div>
</div>`;

/* ── formatos sin caja: la foto es el anuncio y el texto vive encima ────── */

// P · Puro: foto a sangre, un titular y nada más. `tone:'light'` para fotos
// oscuras (texto blanco sobre un degradado suave, no sobre un recuadro).
const puro = (a, photo, w, h) => {
  const light = a.creative.tone === 'light';
  const fg = light ? '#fff' : C.ink;
  const mut = light ? 'rgba(255,255,255,.8)' : '#4A473F';
  const safe = h === 1920 ? 372 : 76;
  // `anchor:'top'` para fotos cuyo aire está arriba: el texto se apoya en el
  // vacío de la propia toma en vez de caer sobre el producto.
  const top = a.creative.anchor === 'top';
  const textPos = top ? `top:${h === 1920 ? 296 : 76}px` : `bottom:${safe}px`;
  const markPos = top ? `bottom:${safe}px` : `top:${h === 1920 ? 272 : 66}px`;
  return `
<div style="position:absolute;inset:0;background:${a.creative.bg || '#fff'};overflow:hidden;
            --em:${light ? '#F0BFCB' : C.rosa}">
  ${img(a, photo)}
  ${light
    ? `<div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(h * 0.68)}px;
         background:linear-gradient(to top,rgba(10,7,6,.84),rgba(10,7,6,.3) 46%,rgba(10,7,6,0))"></div>`
    : ''}
  <div style="position:absolute;${markPos};left:76px">${logo(74, light)}</div>
  <div style="position:absolute;left:76px;right:76px;${textPos}">
    <h1 class="d" style="font-size:${a.creative.hlSize || 104}px;color:${fg}">${a.creative.headline}</h1>
    ${a.creative.sub
      ? `<p style="font-size:29px;font-weight:300;line-height:1.4;color:${mut};margin-top:24px;max-width:790px">${a.creative.sub}</p>`
      : ''}
    <div style="margin-top:32px;display:flex;align-items:baseline;gap:22px">
      <span class="d" style="font-size:44px;font-weight:400;color:${fg}">${a.creative.price}</span>
      <span class="mono" style="font-size:15px;color:${mut}">${a.creative.footer}</span>
    </div>
  </div>
</div>`;
};

// S2 · Sello: foto a sangre y un sello de precio, como la etiqueta de una tienda.
const sello = (a, photo, w, h) => `
<div style="position:absolute;inset:0;background:#fff;overflow:hidden;--em:#F0BFCB">
  ${img(a, photo)}
  <div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(h * 0.5)}px;
       background:linear-gradient(to top,rgba(10,7,6,.78),rgba(10,7,6,0))"></div>
  <div style="position:absolute;top:${h === 1920 ? 300 : 74}px;right:74px;width:244px;height:244px;
              background:${C.bone};border-radius:50%;color:${C.ink};
              display:flex;flex-direction:column;align-items:center;justify-content:center">
    <span class="d" style="font-size:64px;font-weight:400;line-height:1">${a.creative.price}</span>
    <span class="mono" style="font-size:12px;color:${C.moss};margin-top:12px">${a.creative.seal}</span>
  </div>
  <div style="position:absolute;left:76px;right:76px;bottom:${h === 1920 ? 372 : 76}px;color:#fff">
    <h1 class="d" style="font-size:${a.creative.hlSize || 96}px">${a.creative.headline}</h1>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:28px">
      <span class="mono" style="font-size:15px;color:rgba(255,255,255,.8)">${a.creative.footer}</span>
      ${logo(72, true)}
    </div>
  </div>
</div>`;

// C2 · Cuadro 1:1: la foto ocupa el lienzo y el texto se apoya en el vacío que
// la propia foto deja a un costado.
const cuadro = (a, photo) => `
<div style="position:absolute;inset:0;background:#fff;overflow:hidden">
  ${img(a, photo)}
  <div style="position:absolute;top:62px;right:58px;width:476px;text-align:right">
    <span class="mono" style="font-size:15px;color:${C.moss}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || 60}px;margin-top:20px">${a.creative.headline}</h1>
    <div style="height:1px;background:${C.line};margin:24px 0 0;margin-left:auto;width:180px"></div>
    <div style="margin-top:22px;display:flex;justify-content:flex-end;align-items:center;gap:20px">
      ${logo(52)}
      <span class="d" style="font-size:40px;font-weight:400">${a.creative.price}</span>
    </div>
  </div>
</div>`;

// T · Titular: aquí manda la tipografía y la foto entra como una franja al pie.
const titular = (a, photo, w, h) => {
  const tall = h === 1920;
  const bandTop = tall ? 1010 : 762;
  const bandH = tall ? 538 : 588;
  return `
<div style="position:absolute;inset:0;background:${C.bone}">
  <div style="position:absolute;top:${tall ? 262 : 60}px;left:76px">${logo(80)}</div>
  <span class="mono" style="position:absolute;top:${tall ? 372 : 170}px;left:76px;font-size:18px;color:${C.gold}">${a.creative.eyebrow}</span>
  <h1 class="d" style="position:absolute;top:${tall ? 418 : 214}px;left:76px;right:76px;
      font-size:${a.creative.hlSize || (tall ? 128 : 122)}px">${a.creative.headline}</h1>
  <div style="position:absolute;left:76px;right:76px;top:${bandTop - 74}px;display:flex;
              justify-content:space-between;align-items:baseline">
    <span class="d" style="font-size:44px;font-weight:400">${a.creative.price}</span>
    <span class="mono" style="font-size:16px;color:${C.moss}">${a.creative.footer}</span>
  </div>
  <div style="position:absolute;left:0;right:0;top:${bandTop}px;height:${bandH}px;background:#fff;overflow:hidden">
    ${img(a, photo)}
  </div>
</div>`;
};

// PC · Postal: margen amplio y la foto montada como una lámina. Simétrica.
const postal = (a, photo, w, h) => {
  const tall = h === 1920;
  const side = tall ? 140 : 130;
  const box = w - side * 2;
  const top = tall ? 424 : 158;
  return `
<div style="position:absolute;inset:0;background:${C.paper};text-align:center">
  <div style="position:absolute;top:${tall ? 276 : 66}px;left:0;right:0;display:flex;justify-content:center">${logo(86)}</div>
  <div style="position:absolute;left:${side}px;top:${top}px;width:${box}px;height:${box}px;
              background:#fff;border:1px solid ${C.line};overflow:hidden">${img(a, photo)}</div>
  <div style="position:absolute;left:${side}px;right:${side}px;top:${top + box + 46}px">
    <h1 class="d" style="font-size:${a.creative.hlSize || 70}px">${a.creative.headline}</h1>
    <p style="font-size:25px;font-weight:300;line-height:1.4;color:#4A473F;margin-top:20px">${a.creative.sub}</p>
    <div style="margin-top:22px;display:flex;justify-content:center;align-items:baseline;gap:20px">
      <span class="d" style="font-size:42px;font-weight:400">${a.creative.price}</span>
      <span class="mono" style="font-size:15px;color:${C.moss}">${a.creative.footer}</span>
    </div>
  </div>
</div>`;
};

const TEMPLATES = { editorial, split, quote, story, puro, sello, cuadro, titular, postal };
const FORMATS = { '4:5': [1080, 1350], '1:1': [1080, 1080], '9:16': [1080, 1920] };

/* ──────────────────────────────  render  ─────────────────────────────── */

// Chromium solo escribe PNG, y su viewport headless es unos 78px más bajo que el
// --window-size que le pides: por eso renderizamos con holgura y recortamos aquí
// al lienzo exacto, en la misma pasada que reencoda a JPEG.
function toJpeg(chrome, pngPath, jpgPath, tmpDir, w, h) {
  const html = path.join(tmpDir, 'enc.html');
  fs.writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><body><img id="i" src="data:image/png;base64,${fs
      .readFileSync(pngPath)
      .toString('base64')}"><script>
      const i=document.getElementById('i');
      i.onload=()=>{const c=document.createElement('canvas');c.width=${w};c.height=${h};
        c.getContext('2d').drawImage(i,0,0,${w},${h},0,0,${w},${h});
        document.title=c.toDataURL('image/jpeg',.92);};
    </script>`,
  );
  const dom = execFileSync(
    chrome,
    ['--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', `file://${html}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  const b64 = dom.match(/<title>data:image\/jpeg;base64,([A-Za-z0-9+/=]+)<\/title>/)?.[1];
  if (!b64) return false;
  fs.writeFileSync(jpgPath, Buffer.from(b64, 'base64'));
  return true;
}

/* ───────────────────────────────  deck  ──────────────────────────────── */

// El README es un derivado de ads.json, nunca al revés: el copy que se pega en
// el administrador de anuncios y el que se imprime en el creativo salen de la
// misma fuente, así no se desincronizan a la tercera ronda de cambios.
function writeDeck({ campaign, products, ads }) {
  const L = [];
  L.push('# Campaña de Instagram · Lima Flores');
  L.push('');
  L.push(`3 productos del catálogo, 3 anuncios cada uno. Copy y creativos hechos íntegramente con Claude.`);
  L.push('');
  L.push('```');
  L.push('node marketing/ig-ads/build.mjs     # regenera los 9 creativos y este README');
  L.push('```');
  L.push('');
  L.push('| Anuncio | Producto | Etapa | Formato | Titular |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const a of ads) {
    const p = products.find((x) => x.id === a.product);
    L.push(`| \`${a.code}\` | ${p.name} | ${a.funnel} | ${a.format || (a.template === 'story' ? '9:16' : '4:5')} | ${a.headline} |`);
  }
  L.push('');

  for (const p of products) {
    L.push('---');
    L.push('');
    L.push(`## ${p.num} · ${p.name} — S/${p.price}`);
    L.push('');
    L.push(`**Categoría** ${p.categoryLabel} · **Ángulo** ${p.angle}`);
    L.push('');
    L.push(`**Público** ${p.audience}`);
    L.push('');
    L.push(`**Destino** \`${p.landing}\``);
    L.push('');
    for (const a of ads.filter((x) => x.product === p.id)) {
      L.push(`### ${a.code} · ${a.title}`);
      L.push('');
      L.push(`![${a.title}](creativos/${a.code}.jpg)`);
      L.push('');
      L.push(`- **Objetivo** ${a.objective} · **Etapa** ${a.funnel}`);
      L.push(`- **Ubicación** ${a.placement}`);
      L.push(`- **Botón** ${a.cta}`);
      L.push('');
      L.push('**Texto principal**');
      L.push('');
      L.push(a.primaryText.split('\n').map((l) => `> ${l}`).join('\n>\n').replace(/> \n>\n/g, ''));
      L.push('');
      L.push(`**Titular** ${a.headline}`);
      L.push('');
      L.push(`**Descripción** ${a.description}`);
      L.push('');
      L.push(`**Hashtags** ${a.hashtags.join(' ')}`);
      L.push('');
      L.push(`**Por qué funciona** ${a.why}`);
      L.push('');
    }
  }

  L.push('---');
  L.push('');
  L.push('## Antes de publicar');
  L.push('');
  L.push('Tres datos del copy salen de la landing y conviene confirmarlos con el taller:');
  L.push('');
  L.push('1. **«Entrega hoy»** (IG-01, IG-03, IG-06, IG-09). La landing dice «Te las llevamos hoy» y una');
  L.push('   reseña habla de un pedido a las 11 am entregado a las 5:30 pm, pero no hay hora de corte');
  L.push('   publicada. Si existe (por ejemplo, pedidos antes de las 2 pm), conviene decirla: sube la');
  L.push('   conversión y evita reclamos.');
  L.push('2. **«8 a 12 semanas»** (IG-04). El dato está en la landing referido a las Orquídeas Multicolor.');
  L.push('   Se está aplicando a las Phalaenopsis en maceta, que es la misma especie, pero vale confirmarlo.');
  L.push('3. **Color de la orquídea** (IG-04, IG-05, IG-06). Las fotos del catálogo muestran ejemplares');
  L.push('   ámbar y magenta. Si el color no se puede elegir, la ficha debería decir «color según');
  L.push('   disponibilidad» para que el creativo no prometa uno en particular.');
  L.push('');
  L.push('Además: la reseña de Diego V. que se cita en IG-05 aparece como verificada en la landing.');
  L.push('Meta pide poder respaldar los testimonios, así que hay que tener a mano de dónde salió.');
  L.push('');
  L.push('## Los nueve formatos');
  L.push('');
  L.push('| Plantilla | Qué hace | Cuándo conviene |');
  L.push('| --- | --- | --- |');
  L.push('| `puro` | Foto a sangre y un titular encima. Sin cajas. | Público frío: compite con imagen, no con texto. |');
  L.push('| `sello` | Foto a sangre con un sello de precio, como etiqueta de tienda. | Retargeting: quien ya vio el producto solo necesita el número. |');
  L.push('| `cuadro` | 1:1, la foto entera y el texto apoyado en su zona vacía. | Fotos de celular o de casa, que no parecen anuncio. |');
  L.push('| `titular` | Manda la tipografía; la foto entra como franja al pie. | Rompe el patrón visual cuando el resto del conjunto es todo foto. |');
  L.push('| `postal` | Margen amplio y la foto montada como lámina. Simétrica. | Fotos que no aguantan ir a sangre por resolución o encuadre. |');
  L.push('| `editorial` | Foto grande arriba, titular abajo, filetes finos. | Presentación de producto en público frío. |');
  L.push('| `split` | Panel oscuro con la lista de entregables + foto a sangre. | Desarmar objeciones de precio: convierte el ticket en una lista. |');
  L.push('| `quote` | Cita grande arriba, foto abajo. | Prueba social o manifiesto de marca. |');
  L.push('| `story` | Banda de foto arriba, texto y botón en zona segura. | Historias de retargeting con llamada a la acción. |');
  L.push('');
  L.push('Para agregar un anuncio basta con otra entrada en `ads.json`: la plantilla, la foto del');
  L.push('catálogo y el encuadre (`fit`, `position`). El formato sale del campo `format` —');
  L.push('`4:5`, `1:1` o `9:16`.');
  L.push('');
  L.push('## Notas de producción');
  L.push('');
  L.push('- Fotos: las del catálogo (`site/assets/products/`). No se generó ninguna imagen con IA.');
  L.push('- Tipografías y paleta: las del sitio (`site/css/lima.css`) — Cormorant Garamond, Jost,');
  L.push('  JetBrains Mono sobre hueso `#F4EFE5` y tinta `#1B1A17`.');
  L.push('- Marca: el logo original de la página (`site/assets/logo.png`) va en los 18 creativos.');
  L.push('  En `marca/` hay dos versiones, generadas con `marca/prep-logo.py`: `logo.png` para');
  L.push('  fondos claros y `logo-claro.png` para fondos oscuros, donde la caligrafía gris del');
  L.push('  original desaparecería. La versión clara solo cambia el color de la caligrafía; la');
  L.push('  acuarela queda intacta.');
  L.push('- En las historias, los 250px de arriba y los 372px de abajo quedan libres: ahí Instagram');
  L.push('  monta el header del perfil y la barra de respuesta.');
  L.push('- El rubro fúnebre quedó fuera del sorteo: ninguno de sus 5 productos tiene foto en el repo.');
  L.push('');

  fs.writeFileSync(path.join(HERE, 'README.md'), L.join('\n'));
}

/* ───────────────────────────────  main  ──────────────────────────────── */

const main = async () => {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, 'ads.json'), 'utf8'));
  const { ads } = data;
  const chrome = findChromium();
  const fonts = await fontCss();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-ads-'));
  fs.mkdirSync(OUT, { recursive: true });

  for (const ad of ads) {
    const [w, h] = FORMATS[ad.format || (ad.template === 'story' ? '9:16' : '4:5')];
    const html = path.join(tmp, `${ad.code}.html`);
    const png = path.join(tmp, `${ad.code}.png`);
    const jpg = path.join(OUT, `${ad.code}.jpg`);

    fs.writeFileSync(html, base(fonts, w, h, TEMPLATES[ad.template](ad, dataUri(ad.photo), w, h)));
    execFileSync(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--virtual-time-budget=8000',
      `--window-size=${w},${h + 200}`, `--screenshot=${png}`, `file://${html}`,
    ]);

    let final = jpg;
    if (!toJpeg(chrome, png, jpg, tmp, w, h)) {
      final = path.join(OUT, `${ad.code}.png`);
      fs.copyFileSync(png, final);
      console.warn(`  ! ${ad.code}: no pude reencodear a JPEG, dejo el PNG.`);
    }
    const kb = Math.round(fs.statSync(final).size / 1024);
    console.log(`  ✓ ${ad.code}  ${w}×${h}  ${path.basename(final)}  ${kb} KB  — ${ad.title}`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  writeDeck(data);
  console.log(`\n${ads.length} creativos en ${path.relative(ROOT, OUT)}/ + README.md`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
