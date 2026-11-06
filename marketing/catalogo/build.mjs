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
const SANGRA = 2; // % de cada borde de la foto que se descarta (ver el script de la página)

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
// El verde del texto lo pidió el cliente (6-nov-2026) y NO es un token de
// Florencia: es el marco del catálogo anterior, medido sobre su página de
// Box Yani. El verde del ramo (--leaf, #88A65C) se probó primero y sobre el
// ciclorama da contraste 2,4 —ilegible en la descripción—; este da 7,3.
const VERDE = '#41542B';

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

// La tarjeta de dedicatoria va en todos los pedidos (PROMESAS, en el sitio): se
// lee de ahí y no de la memoria de quien arma la página, para que si la promesa
// cambia en la tienda cambie también en el catálogo.
const TARJETA = (() => {
  const ts = fs.readFileSync(path.join(ROOT, 'app/src/lib/tienda.ts'), 'utf8');
  const bloque = ts.slice(ts.indexOf('export const PROMESAS'));
  const linea = [...bloque.matchAll(/'([^']+)'/g)].map((m) => m[1]).find((t) => /tarjeta de dedicatoria/i.test(t));
  if (!linea) throw new Error('PROMESAS ya no habla de la tarjeta de dedicatoria: revisa el catálogo antes de imprimir');
  return linea;
})();

const precio = (n) => `S/ ${Number.isInteger(n) ? n : n.toFixed(2)}`;

function html({ prod, pag, fonts, fotoUri, logoUri }) {
  let desc = prod.description;
  for (const [mal, bien] of Object.entries(pag.erratas || {})) desc = desc.replaceAll(mal, bien);
  // Los cambios que decidió el cliente van aparte de las erratas y con su
  // motivo: no salen del catálogo de la tienda, y sin el motivo escrito nadie
  // sabría después de dónde vino el dato. Si el texto de la tienda cambia y
  // ya no aparece, se avisa en vez de imprimir la versión vieja.
  for (const c of pag.cambios || []) {
    if (!c.por) throw new Error(`${pag.id}: un cambio sin motivo («${c.de}»)`);
    if (!desc.includes(c.de)) throw new Error(`${pag.id}: «${c.de}» ya no está en la descripción de la tienda`);
    desc = desc.replaceAll(c.de, c.a);
  }
  let { cuerpo, legal } = partirTexto(desc);
  if (!/dedicatoria/i.test(cuerpo)) cuerpo += ` ${TARJETA}`;
  // El catálogo de la tienda trae nombres con dobles espacios («Box  Rogelia»).
  const nombre = prod.name.replace(/\s+/g, ' ').trim();
  return `<!doctype html><meta charset="utf-8"><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#fff}
/* Todo dentro de una caja del tamaño exacto: nada se ancla al viewport, que en
   Chromium headless no mide lo que se le pide. */
#lienzo{position:relative;width:${W}px;height:${H}px;overflow:hidden;font-family:'Jost',sans-serif;color:${C.ink}}
canvas{position:absolute;inset:0}
/* Centrada, como pidió el cliente: logotipo, ficha y producto sobre el mismo
   eje. Todo el texto en el verde del catálogo anterior (ver VERDE). */
#logo{position:absolute;left:50%;transform:translateX(-50%);top:${MARGEN - 16}px;height:64px}
#ficha{position:absolute;left:${MARGEN}px;right:${MARGEN}px;bottom:${MARGEN}px;
  text-align:center;color:${VERDE}}
.filete{width:120px;height:0;border-top:1px solid ${VERDE};opacity:.45;margin:0 auto 22px}
.rotulo{font-weight:500;font-size:19px;letter-spacing:.22em;text-transform:uppercase}
h1{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;
  font-size:88px;line-height:.96;letter-spacing:-.018em;margin-top:12px}
/* El precio nunca más grande que el nombre (DESIGN.md, ficha de producto). */
.precio{font-weight:500;font-size:30px;letter-spacing:.02em;margin-top:12px}
.cuerpo{font-size:24px;line-height:1.48;margin:16px auto 0;max-width:840px}
.legal{font-size:16px;line-height:1.4;margin-top:16px;letter-spacing:.01em;opacity:.8}
</style><div id="lienzo">
<canvas id="c" width="${W}" height="${H}"></canvas>
<img id="logo" src="${logoUri}">
<div id="ficha">
  <div class="filete"></div>
  <div class="rotulo">${esc(prod.categoryLabel)}</div>
  <h1>${esc(nombre)}</h1>
  <div class="precio">${precio(prod.price)}</div>
  <p class="cuerpo">${esc(cuerpo)}</p>
  ${legal ? `<p class="legal">${esc(legal)}</p>` : ''}
</div></div>
<script>
// La foto entra a lo ancho y se coloca sola: se mide dónde está el producto y
// se lo centra en el hueco que dejan el logotipo y la ficha. Así no hay un
// número mágico por foto que se desajusta cuando cambia la toma. Lo que la foto
// no alcanza a cubrir, arriba o abajo, se rellena estirando su propia primera o
// última fila, para que el degradado del ciclorama siga y no haya unión
// visible —un relleno plano se lee como el recuadro que el sistema prohíbe.
const ancho = ${W}, alto = ${H};

// Caja del producto, medida contra el color del borde de cada fila: el
// ciclorama es un degradado y un color fijo daría falsos positivos.
function medir(d, w, h) {
  let y0 = -1, y1 = -1, x0 = w, x1 = -1;
  for (let y = 0; y < h; y++) {
    // El fondo de cada píxel es la recta entre el borde izquierdo y el derecho
    // de su fila: el ciclorama también se oscurece de lado a lado (viñeteado), y
    // contra un solo borde la mitad opuesta de la foto se leía como producto.
    const borde = (x0) => { let r = 0, g = 0, b = 0; for (let x = x0; x < x0 + 12; x++) { const i = (y * w + x) * 4; r += d[i]; g += d[i+1]; b += d[i+2]; } return [r / 12, g / 12, b / 12]; };
    const L = borde(0), R = borde(w - 12);
    let n = 0, xa = w, xb = -1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, f = x / (w - 1);
      const dif = Math.abs(d[i] - (L[0] + (R[0] - L[0]) * f)) + Math.abs(d[i+1] - (L[1] + (R[1] - L[1]) * f)) + Math.abs(d[i+2] - (L[2] + (R[2] - L[2]) * f));
      if (dif > 45) { n++; xa = Math.min(xa, x); xb = x; }
    }
    if (n > w * 0.004) { if (y0 < 0) y0 = y; y1 = y; x0 = Math.min(x0, xa); x1 = Math.max(x1, xb); }
  }
  return { top: y0, bottom: y1, left: x0, right: x1 };
}
const caja = (el) => { const r = document.getElementById(el).getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };

window.listo = new Promise((ok) => {
  const img = new Image();
  img.onload = async () => {
    await document.fonts.ready;
    // Primera pasada, fuera de la página: dónde cae el producto con la foto a
    // todo el ancho.
    const tira = (w, h, dibujar) => { const c = document.createElement('canvas'); c.width = w; c.height = h; dibujar(c.getContext('2d')); return c; };
    // Se descarta el ${SANGRA}% de cada borde antes de nada: las tomas de estudio
    // se oscurecen en el filo (viñeteado) y, al estirar esa fila para rellenar,
    // en Box Gaby Café quedaba una franja oscura cruzando la página detrás del
    // nombre. Solo se va ciclorama: si el producto toca el filo, la sonda avisa.
    const sx = img.width * ${SANGRA} / 100, sy = img.height * ${SANGRA} / 100;
    const sw = img.width - 2 * sx, sh = img.height - 2 * sy;
    const src = tira(Math.round(sw), Math.round(sh), (t) => t.drawImage(img, sx, sy, sw, sh, 0, 0, Math.round(sw), Math.round(sh)));
    let altoFoto = Math.round(src.height * ancho / src.width);
    let foto = tira(ancho, altoFoto, (t) => t.drawImage(src, 0, 0, ancho, altoFoto));
    let enFoto = medir(foto.getContext('2d').getImageData(0, 0, ancho, altoFoto).data, ancho, altoFoto);
    const alFilo = enFoto.top <= 1 || enFoto.bottom >= altoFoto - 2 || enFoto.left <= 1 || enFoto.right >= ancho - 2;

    const logo = caja('logo'), ficha = caja('ficha');
    const libreArriba = logo.bottom + 24, libreAbajo = ficha.top - 24, libre = libreAbajo - libreArriba;

    // Si a todo el ancho el producto no entra en el hueco, se achica la foto
    // —nunca se recorta— y los costados se completan estirando la columna de
    // borde de la propia foto: el mismo truco de las filas, de lado.
    const reduce = Math.min(1, libre / (enFoto.bottom - enFoto.top + 1));
    if (reduce < 1) {
      const w = Math.round(ancho * reduce), h = Math.round(altoFoto * reduce), x = Math.round((ancho - w) / 2);
      foto = tira(ancho, h, (t) => {
        t.drawImage(src, x, 0, w, h);
        t.drawImage(src, 0, 0, 2, src.height, 0, 0, x + 1, h);
        t.drawImage(src, src.width - 2, 0, 2, src.height, x + w - 1, 0, ancho - x - w + 1, h);
      });
      altoFoto = h;
      enFoto = medir(foto.getContext('2d').getImageData(0, 0, ancho, altoFoto).data, ancho, altoFoto);
    }

    const centro = (enFoto.top + enFoto.bottom) / 2;
    const top = Math.round((libreArriba + libreAbajo) / 2 - centro);
    const ctx = document.getElementById('c').getContext('2d');
    ctx.drawImage(foto, 0, top);
    if (top > 0) ctx.drawImage(foto, 0, 0, ancho, 2, 0, 0, ancho, top + 1);
    const pie = top + altoFoto;
    if (pie < alto) ctx.drawImage(foto, 0, altoFoto - 2, ancho, 2, 0, pie - 1, ancho, alto - pie + 1);

    // Sonda: se vuelve a medir sobre la página ya armada, que es lo que se entrega.
    const producto = medir(ctx.getImageData(0, 0, ancho, alto).data, ancho, alto);
    ok({ enFoto, altoFoto, reduce, alFilo, producto, logo, ficha, top, cabe: enFoto.bottom - enFoto.top <= libre + 2 });
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
  const fallas = [];

  for (const pag of paginas) {
    const prod = seed.find((p) => p.id === pag.id);
    if (!prod) throw new Error(`${pag.id} no está en db/products.seed.json: no se imprime lo que no se vende`);
    // Una foto del catálogo de la tienda, o una propia del catálogo impreso
    // (marketing/catalogo/fotos/) cuando la de la tienda no es la mejor toma.
    const fotoPath = pag.foto.startsWith('fotos/') ? path.join(HERE, pag.foto) : path.join(PHOTOS, pag.foto);
    const fotoUri = b64(fotoPath, 'image/jpeg');
    // Una página nueva por producto: setContent reusa el mismo `window`, el
    // script de la segunda falla al redeclarar sus constantes y la sonda
    // devolvía en silencio las medidas de la primera foto.
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    await page.setContent(html({ prod, pag, fonts, fotoUri, logoUri }));
    const s = await page.evaluate(() => window.listo);

    // Lo que la sonda no deja pasar: producto cortado por un borde, o pisado
    // por el logotipo o por el texto. Revienta en vez de entregar.
    const p = s.producto, holgura = 12;
    if (p.top <= 0 || p.left <= 0 || p.right >= W - 1) fallas.push(`${pag.id}: el producto toca el borde (${JSON.stringify(p)})`);
    if (p.top < s.logo.bottom + holgura && p.left < s.logo.right + holgura) fallas.push(`${pag.id}: el logotipo pisa el producto`);
    if (p.bottom > s.ficha.top - holgura) fallas.push(`${pag.id}: el texto pisa el producto (producto hasta ${p.bottom}, texto desde ${Math.round(s.ficha.top)})`);
    if (s.alFilo) fallas.push(`${pag.id}: el producto llega al borde de la foto; recortar el filo se lo comería`);
    if (!s.cabe) fallas.push(`${pag.id}: el producto es más alto que el hueco libre; prueba otra toma`);
    if (s.ficha.top < 0) fallas.push(`${pag.id}: el texto no entra en la página`);

    const out = path.join(SALIDA, `${pag.id}.jpg`);
    await page.screenshot({ path: out, type: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H } });
    if (process.env.DEPURAR) console.log(JSON.stringify(s));
    console.log(`  ${pag.id}  producto y ${p.top}–${p.bottom}  texto desde ${Math.round(s.ficha.top)}  → ${path.relative(ROOT, out)}`);
    await page.close();
  }
  await browser.close();
  if (fallas.length) {
    console.error('\n✗ Páginas que no se entregan:\n  ' + fallas.join('\n  '));
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
