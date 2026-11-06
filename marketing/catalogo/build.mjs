// Páginas del catálogo: una por producto, 1080 × 1350 (4:5), la misma medida que
// el feed de Instagram para que una página sirva tal cual en el feed y en WhatsApp.
//
//   node marketing/catalogo/build.mjs              # todas las de catalogo.json
//   node marketing/catalogo/build.mjs box-yani     # solo esa, para iterar
//
// El catálogo del año pasado ponía la foto dentro de un marco verde, sobre marfil,
// con la advertencia de alcohol girada encima del ciclorama. Las tres cosas las
// prohíbe el sistema (DESIGN.md): el marco es la «cajita», el marfil es el fondo
// viejo y un texto girado sobre la foto no lo lee nadie. Acá la foto va a sangre,
// el texto se apoya donde la foto ya está vacía y la advertencia baja al pie.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PHOTOS = path.join(ROOT, 'app/public/products');
const SALIDA = path.join(HERE, 'paginas');
const CACHE = path.join(HERE, '.fontcache');
const W = 1080;
const H = 1350;
const MARGEN = 76; // área segura del feed: la misma página se publica

// Los colores se leen del sistema, no se copian: si Florencia cambia, el
// catálogo cambia con él.
const TOKENS = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, 'design/direcciones/florencia.css'), 'utf8')
    .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]),
);
const tk = (n) => {
  if (!TOKENS[n]) throw new Error(`falta el token ${n} en florencia.css`);
  return TOKENS[n];
};
const C = {
  ink: tk('--text-strong'),
  body: tk('--text-body'),
  muted: tk('--text-muted'),
  rosa: tk('--accent'),
  // Sobre el ciclorama (~#EEF0F3) el filete normal #E6E5E3 desaparece: va el fuerte.
  filete: tk('--border-strong'),
};

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,500&family=Jost:wght@400;500&display=swap';

// Las fuentes van embebidas: sin eso el screenshot a veces sale antes de que
// carguen y la página queda en Times.
async function fontCss() {
  const cached = path.join(CACHE, 'fonts.css');
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
  const css = await (await fetch(FONT_CSS_URL, { headers: { 'User-Agent': ua } })).text();
  const out = [];
  for (const block of css.split('/*').filter((b) => b.startsWith(' latin */'))) {
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    const family = block.match(/font-family:\s*'([^']+)'/)[1];
    const style = block.match(/font-style:\s*(\w+)/)[1];
    const weight = block.match(/font-weight:\s*(\d+)/)[1];
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': ua } })).arrayBuffer());
    out.push(`@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};` +
      `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')}`);
  }
  if (!out.length) throw new Error('Google Fonts no devolvió fuentes: sin ellas la página sale en Times');
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, out.join('\n'));
  return out.join('\n');
}

const b64 = (file, mime) => `data:${mime};base64,${fs.readFileSync(file).toString('base64')}`;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// La advertencia de alcohol vive pegada a la descripción en el catálogo de la
// tienda. En la página se separa: la ley pide que esté, no que compita con el
// producto, y mezclada en el párrafo parecía parte de la composición.
function partirTexto(desc) {
  const i = desc.search(/Prohibida la venta/i);
  if (i < 0) return { cuerpo: desc.trim(), legal: null };
  let legal = desc.slice(i).trim();
  if (!/[.!]$/.test(legal)) legal += '.';
  return { cuerpo: desc.slice(0, i).trim(), legal };
}

const precio = (n) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;

function html({ prod, pag, fonts, fotoUri, logoUri }) {
  let desc = prod.description;
  for (const [mal, bien] of Object.entries(pag.erratas || {})) desc = desc.replaceAll(mal, bien);
  const { cuerpo, legal } = partirTexto(desc);
  return `<!doctype html><meta charset="utf-8"><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#fff}
/* Todo dentro de una caja del tamaño exacto: nada se ancla al viewport, que en
   Chromium headless no mide lo que se le pide. */
#lienzo{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:'Jost',sans-serif;color:${C.ink}}
canvas{position:absolute;inset:0}
#logo{position:absolute;left:${MARGEN}px;top:${MARGEN - 16}px;height:64px}
#ficha{position:absolute;left:${MARGEN}px;right:${MARGEN}px;bottom:${MARGEN}px}
.fila{display:flex;justify-content:space-between;align-items:baseline;
  border-top:1px solid ${C.filete};padding-top:22px}
.rotulo{font-weight:500;font-size:19px;letter-spacing:.22em;text-transform:uppercase;color:${C.rosa}}
/* El precio nunca más grande que el nombre (DESIGN.md, ficha de producto). */
.precio{font-weight:500;font-size:30px;letter-spacing:.02em;color:${C.ink}}
h1{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:92px;line-height:.96;letter-spacing:-.018em;margin-top:14px}
.cuerpo{font-size:25px;line-height:1.48;color:${C.body};margin-top:18px;max-width:880px}
.legal{font-size:16px;line-height:1.4;color:${C.muted};margin-top:20px;letter-spacing:.01em}
</style><div id="lienzo">
<canvas id="c" width="${W}" height="${H}"></canvas>
<img id="logo" src="${logoUri}">
<div id="ficha">
  <div class="fila"><span class="rotulo">${esc(prod.categoryLabel)}</span><span class="precio">${precio(prod.price)}</span></div>
  <h1>${esc(prod.name)}</h1>
  <p class="cuerpo">${esc(cuerpo)}</p>
  ${legal ? `<p class="legal">${esc(legal)}</p>` : ''}
</div></div>
<script>
// La foto entra a lo ancho, subida ${pag.subir}px (se va ciclorama, no producto:
// lo verifica la sonda). El hueco de abajo se rellena estirando la última fila
// de la propia foto, para que el degradado del ciclorama siga y no haya unión
// visible —un relleno plano se lee como el recuadro que el sistema prohíbe.
window.listo = new Promise((ok) => {
  const img = new Image();
  img.onload = async () => {
    await document.fonts.ready;
    const ctx = document.getElementById('c').getContext('2d');
    const esc = ${W} / img.width, alto = img.height * esc, top = -${pag.subir};
    ctx.drawImage(img, 0, top, ${W}, alto);
    const pie = top + alto;
    if (pie < ${H}) ctx.drawImage(img, 0, img.height - 2, img.width, 2, 0, pie - 1, ${W}, ${H} - pie + 1);

    // Sonda: dónde está el producto, medido contra el color del borde de cada
    // fila (el ciclorama es un degradado: un color fijo daría falsos positivos).
    const d = ctx.getImageData(0, 0, ${W}, ${H}).data;
    let y0 = -1, y1 = -1, x0 = ${W}, x1 = -1;
    for (let y = 0; y < ${H}; y++) {
      let r = 0, g = 0, b = 0;
      for (let x = 0; x < 16; x++) { const i = (y * ${W} + x) * 4; r += d[i]; g += d[i+1]; b += d[i+2]; }
      r /= 16; g /= 16; b /= 16;
      let n = 0, xa = ${W}, xb = -1;
      for (let x = 0; x < ${W}; x++) {
        const i = (y * ${W} + x) * 4;
        if (Math.abs(d[i]-r) + Math.abs(d[i+1]-g) + Math.abs(d[i+2]-b) > 45) { n++; xa = Math.min(xa, x); xb = x; }
      }
      if (n > ${W} * 0.004) { if (y0 < 0) y0 = y; y1 = y; x0 = Math.min(x0, xa); x1 = Math.max(x1, xb); }
    }
    const caja = (el) => { const r = document.getElementById(el).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
    ok({ producto: { top: y0, bottom: y1, left: x0, right: x1 }, logo: caja('logo'), ficha: caja('ficha'), corte: top + 0 });
  };
  img.src = ${JSON.stringify(fotoUri)};
});
</script>`;
}

async function main() {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'db/products.seed.json'), 'utf8'));
  const cat = JSON.parse(fs.readFileSync(path.join(HERE, 'catalogo.json'), 'utf8'));
  const pedidas = process.argv.slice(2);
  const paginas = cat.paginas.filter((p) => !pedidas.length || pedidas.includes(p.id));
  if (pedidas.length && paginas.length !== pedidas.length) throw new Error('alguna id pedida no está en catalogo.json');

  const fonts = await fontCss();
  const logoUri = b64(path.join(ROOT, 'marketing/ig-ads/marca/logo.png'), 'image/png');
  fs.mkdirSync(SALIDA, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const fallas = [];

  for (const pag of paginas) {
    const prod = seed.find((p) => p.id === pag.id);
    if (!prod) throw new Error(`${pag.id} no está en db/products.seed.json: no se imprime lo que no se vende`);
    const fotoUri = b64(path.join(PHOTOS, pag.foto), 'image/jpeg');
    await page.setContent(html({ prod, pag, fonts, fotoUri, logoUri }));
    const s = await page.evaluate(() => window.listo);

    // Lo que la sonda no deja pasar: producto cortado por un borde, o pisado
    // por el logotipo o por el texto. Revienta en vez de entregar.
    const p = s.producto, holgura = 12;
    if (p.top <= 0 || p.left <= 0 || p.right >= W - 1) fallas.push(`${pag.id}: el producto toca el borde (${JSON.stringify(p)})`);
    if (p.top < s.logo.bottom + holgura && p.left < s.logo.right + holgura) fallas.push(`${pag.id}: el logotipo pisa el producto`);
    if (p.bottom > s.ficha.top - holgura) fallas.push(`${pag.id}: el texto pisa el producto (producto hasta ${p.bottom}, texto desde ${Math.round(s.ficha.top)})`);
    if (s.ficha.top < 0) fallas.push(`${pag.id}: el texto no entra en la página`);

    const out = path.join(SALIDA, `${pag.id}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H } });
    console.log(`  ${pag.id}  producto y ${p.top}–${p.bottom}  texto desde ${Math.round(s.ficha.top)}  → ${path.relative(ROOT, out)}`);
  }
  await browser.close();
  if (fallas.length) {
    console.error('\n✗ Páginas que no se entregan:\n  ' + fallas.join('\n  '));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
