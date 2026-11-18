// Textos que se reescriben sobre el catálogo de Navidad del año pasado.
//
//   node marketing/catalogo/textos-navidad.mjs
//
// Cada texto sale como un PDF vectorial del tamaño exacto de su hueco, y
// navidad.py lo coloca sobre la página después de borrar el texto original.
// Se hace así, y no con una imagen, para que el texto siga siendo texto: nítido
// al imprimir y seleccionable en el PDF.
//
// Las tipografías son las del catálogo nuevo (Cormorant itálica y Jost, ver
// DESIGN.md) en vez de la monoespaciada de Canva: el cliente pidió mejorar las
// letras de la página 2. El verde es el del propio catálogo de Navidad, medido
// sobre su texto (#105B34), para que la página siga combinando con las demás.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SALIDA = path.join(HERE, 'navidad', 'textos');
const VERDE_NAVIDAD = '#105B34';

// rect: [x0, y0, x1, y1] en puntos sobre la página del PDF original (810 × 1440).
// max: tamaño de letra máximo en px; el texto se achica si no entra.
// borrar: los rectángulos donde está el texto viejo que hay que quitar.
export const TEXTOS = [
  {
    id: 'p2-titulo',
    pagina: 2,
    rect: [40, 470, 770, 655],
    borrar: [[150, 437, 710, 656]],
    max: 104, // px: más grande compite con el logotipo de arriba
    html: '<h1>Crea magia con nuestras <em>coronas navideñas</em></h1>',
  },
  {
    id: 'p2-frase',
    pagina: 2,
    rect: [60, 1050, 750, 1210],
    borrar: [[27, 1027, 783, 1268]],
    max: 58,
    // Sin «coronas»: la palabra se repetía en casi todas las páginas (pedido del
    // cliente, 18 de noviembre de 2026). El ciprés es lo que se ve en las fotos.
    html: '<p>Ciprés natural que le dará a tu casa un delicioso olor navideño.</p>',
  },
  {
    id: 'p3-texto',
    pagina: 3,
    // Misma Space Mono y mismo justificado de Canva, para que la página no
    // cambie de cara. Se reescribe para no repetir «coronas» y para no decir
    // «elige la que más te guste», que es el titular de la página 5. La corona
    // de esa página es de flores secas lilas, no de ciprés: no nombrar material.
    rect: [31, 794, 779, 1129],
    borrar: [[25, 790, 785, 1135]],
    max: 61,
    html: `<div class="mono" style="text-align:left">
      <h2>PARA TU PUERTA</h2>
      <p class="just">CELEBRA ESTA NAVIDAD CON LO NATURAL Y RECÍBELO EN CASA</p>
    </div>`,
  },
  {
    id: 'p4-titulo',
    pagina: 4,
    // Lo que se ve en la foto de esa corona; antes decía «coronas navideñas».
    rect: [60, 1316, 750, 1400],
    borrar: [[120, 1310, 725, 1405]],
    max: 75,
    html: '<div class="mono"><h2>CANELA Y CIPRÉS</h2></div>',
  },
  {
    id: 'p13-noelia',
    pagina: 13,
    // Regalos corporativos: el párrafo viejo hablaba de flores y la foto es la
    // Cajita Noelia. Nombre, precio y contenido los dictó el cliente el 17 de
    // noviembre de 2026; la caja aún no está en la tienda. El hueco termina
    // donde empieza el adorno dorado de la derecha (y 794).
    rect: [351, 560, 780, 790],
    borrar: [[351, 561, 776, 825]],
    max: 60,
    html: `<div style="text-align:left">
      <h1 style="font-size:1.6em">Cajita <em>Noelia</em></h1>
      <p style="font-weight:500;margin:.35em 0 .55em">S/ 250</p>
      <p>Cidra en botella de vidrio de 750 ml · Miel pura de abeja Selva del Cusco, 120 ml, con mini servidor · Queso tilsit · Sal de Maras, frasco de 200 g, con servidor de madera · Tabla rectangular de madera</p>
    </div>`,
  },
  {
    id: 'p13-legal',
    pagina: 13,
    // Bajo la foto de la caja navideña, que trae una cidra: la ley pide la
    // advertencia en toda publicidad de alcohol. El texto es el mismo de la
    // tienda (db/products.seed.json); no se redacta uno propio.
    // Bajo la foto, hasta donde empieza el adorno dorado (x 575). Abajo va la
    // caja armada. El cliente la pidió bien visible: a 15 px no se notaba.
    rect: [20, 958, 565, 1040],
    borrar: [],
    max: 24,
    html: '<p class="legal">Prohibida la venta a menores de edad. Tomar bebidas alcohólicas en exceso es dañino.</p>',
  },
];

// Páginas enteras nuevas, con el estilo de la página 2 reescrita. Salen como
// PDF vectorial de 810 × 1440 pt (el tamaño del original) y navidad.py las mete
// después de la página indicada, contada sobre el PDF ya armado.
export const PAGINAS = [
  {
    id: 'corona-adviento',
    despues_de: 5, // tras «Escoge la que más te guste», cierra el bloque de coronas
    foto: 'fotos/corona-adviento-referencial.jpg',
    titulo: 'Coronas de <em>adviento</em>',
    // La foto es generada con IA (Higgsfield, Seedream) sobre una imagen que
    // trajo el cliente; no es una corona hecha en el taller. Lo pidió el
    // cliente el 17 de noviembre de 2026, con la condición de que lo diga.
    // El precio lo dio el cliente el 17 de noviembre de 2026; la corona todavía
    // no está en la tienda. Cuando se cargue, que salga de ahí y no de acá.
    // La composición no se escribe: nadie la confirmó.
    precio: 120,
    nota: 'Imagen referencial',
  },
  {
    id: 'colgadores',
    // Tras la corona de adviento, antes de las piñas: completan las coronas.
    despues_de: 6,
    foto: 'fotos/colgadores.jpg',
    titulo: 'Colgadores para <em>puerta</em>',
    // Foto del producto (fondo blanco) que mandó el cliente. «Desde S/ 30» y
    // los colores (los dos de la foto) los dio el cliente el 17 de noviembre
    // de 2026; no están en la tienda.
    detalle: 'Dorado o negro',
    precio: 30,
    desde: true,
  },
  {
    id: 'pinas',
    // Tras los colgadores (Pinos y Centros de mesa salieron). Cuenta sobre el
    // PDF con las páginas anteriores ya metidas: se insertan en orden.
    despues_de: 7,
    foto: 'fotos/pinas-referencial.jpg',
    titulo: 'Piñas <em>naturales</em>',
    // Cantidad y precio dictados por el cliente el 17 de noviembre de 2026; no
    // están en la tienda. La foto no es del taller (bowl y escena de banco de
    // imágenes): va como referencial y el bowl no se nombra, nadie dijo que
    // venga incluido.
    detalle: '24 piñas',
    precio: 32,
    nota: 'Imagen referencial',
  },
  {
    id: 'mas-regalos',
    // Tras Regalos corporativos (Cajita Noelia): el cliente pidió más opciones
    // de precio el 18 de noviembre de 2026. Nombre, precio, descripción y foto
    // salen de la tienda (db/products.seed.json, app/public/products), no de acá.
    despues_de: 13,
    tipo: 'opciones',
    titulo: 'Más opciones <em>para regalar</em>',
    productos: ['box-de-madera-rafaela', 'box-chococafe'],
    // La foto de la tienda de Rafaela mide 500 px y se ve borrosa impresa; el
    // cliente mandó la misma toma en 2000 px.
    fotos: { 'box-de-madera-rafaela': 'fotos/box-rafaela.jpg' },
  },
];

const FONDO_NAVIDAD = '#EDE9E3'; // el fondo de las páginas de Canva, medido

const mono = (peso, archivo) => {
  const f = path.join(HERE, '.fontcache', archivo);
  return fs.existsSync(f) ? `@font-face{font-family:'Space Mono';font-weight:${peso};src:url(data:font/ttf;base64,${fs.readFileSync(f).toString('base64')})}` : '';
};
// Las bajan navidad.py (Regular) y el README (Bold); si faltan, el texto sale en otra letra.
const MONO = mono(400, 'SpaceMono-Regular.ttf') + mono(700, 'SpaceMono-Bold.ttf');

const ESTILO = MONO + `
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:transparent}
.caja{display:flex;align-items:center;justify-content:center;text-align:center;color:${VERDE_NAVIDAD};overflow:hidden}
h1{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;line-height:1;letter-spacing:-.018em}
h1 em{font-style:italic}
p{font-family:'Jost',sans-serif;font-weight:400;line-height:1.38}
.mono h2,.mono p{font-family:'Space Mono',monospace;color:inherit}
.mono h2{font-weight:700;font-size:1.13em;line-height:1.4}
.mono p{font-weight:400;font-size:1em;line-height:1.4}
.mono .just{text-align:justify;text-align-last:left}
p.legal{line-height:1.25}
`;

async function main() {
  const require = createRequire(import.meta.url);
  const { chromium } = require('playwright');
  const fuentes = path.join(HERE, '.fontcache', 'fonts.css');
  if (!fs.existsSync(fuentes)) throw new Error('faltan las fuentes: corre antes node marketing/catalogo/build.mjs');
  const fonts = fs.readFileSync(fuentes, 'utf8');
  fs.mkdirSync(SALIDA, { recursive: true });
  const browser = await chromium.launch();

  for (const t of TEXTOS) {
    // 1 pt = 4/3 px: el PDF de Chromium mide en px CSS.
    const w = (t.rect[2] - t.rect[0]) * 4 / 3, h = (t.rect[3] - t.rect[1]) * 4 / 3;
    const page = await browser.newPage();
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${fonts}${ESTILO}
      .caja{width:${w}px;height:${h}px}</style><div class="caja"><div id="t">${t.html}</div></div>`);
    await page.evaluate(() => document.fonts.ready);
    // El tamaño se ajusta solo: el más grande que entra en el hueco. Así un
    // texto más largo no se sale ni hay que adivinar un número por bloque.
    const tam = await page.evaluate(([w, h, max]) => {
      const el = document.querySelector('#t').firstElementChild;
      let lo = 10, hi = max;
      while (hi - lo > 0.5) {
        const m = (lo + hi) / 2;
        el.style.fontSize = m + 'px';
        const r = el.getBoundingClientRect();
        if (el.scrollWidth <= w && r.height <= h) lo = m; else hi = m;
      }
      el.style.fontSize = lo + 'px';
      return lo;
    }, [w, h, t.max]);
    const out = path.join(SALIDA, `${t.id}.pdf`);
    await page.pdf({ path: out, width: `${w}px`, height: `${h}px`, printBackground: false, pageRanges: '1' });
    await page.close();
    console.log(`  ${t.id}  ${Math.round(tam)} px  → ${path.relative(path.resolve(HERE, '../..'), out)}`);
  }
  const RAIZ = path.resolve(HERE, '../..');
  const seed = JSON.parse(fs.readFileSync(path.join(RAIZ, 'db/products.seed.json'), 'utf8'));
  const tienda = Array.isArray(seed) ? seed : seed.products;
  const LEGAL = 'Prohibida la venta a menores de edad. Tomar bebidas alcohólicas en exceso es dañino.';
  for (const p of PAGINAS) {
    const page = await browser.newPage();
    if (p.tipo === 'opciones') {
      let conAlcohol = false;
      const filas = p.productos.map((id) => {
        const prod = tienda.find((x) => x.id === id);
        if (!prod) throw new Error(`${p.id}: «${id}» ya no está en la tienda`);
        // La advertencia legal va una sola vez al pie, no repetida en cada caja.
        let desc = prod.description.replace(/\s*prohibida la venta.*$/is, '').trim().replace(/\s+,/g, ',');
        if (desc.length < prod.description.trim().length) conAlcohol = true;
        const img = fs.readFileSync(p.fotos?.[id] ? path.join(HERE, p.fotos[id]) : path.join(RAIZ, 'app/public', prod.image));
        return `<div class="fila"><img src="data:image/jpeg;base64,${img.toString('base64')}">
          <div class="ficha"><h2>${prod.name.replace(/\s+/g, ' ')}</h2><div class="precio">S/ ${prod.price}</div><p>${desc}</p></div></div>`;
      }).join('');
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${fonts}${ESTILO}
        body{width:1080px;height:1920px;background:${FONDO_NAVIDAD};color:${VERDE_NAVIDAD};padding:150px 60px 0}
        h1{font-size:92px;text-align:center;margin-bottom:90px}
        .fila{display:flex;gap:48px;align-items:center;margin-bottom:80px}
        .fila img{width:500px;height:500px;object-fit:cover;flex:none}
        h2{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:64px;line-height:1}
        .precio{font-family:'Jost',sans-serif;font-weight:500;font-size:38px;margin:16px 0 18px}
        .ficha p{font-size:27px;line-height:1.42}
        .legal{position:absolute;left:60px;right:60px;bottom:110px;text-align:center;font-family:'Jost',sans-serif;font-size:24px}
        </style><h1>${p.titulo}</h1>${filas}${conAlcohol ? `<div class="legal">${LEGAL}</div>` : ''}`);
      await page.evaluate(() => document.fonts.ready);
      const out = path.join(SALIDA, `${p.id}.pdf`);
      await page.pdf({ path: out, width: '1080px', height: '1920px', printBackground: true, pageRanges: '1' });
      await page.close();
      console.log(`  página ${p.id}  → ${path.relative(RAIZ, out)}`);
      continue;
    }
    const foto = `data:image/jpeg;base64,${fs.readFileSync(path.join(HERE, p.foto)).toString('base64')}`;
    await page.setContent(`<!doctype html><meta charset="utf-8"><style>${fonts}${ESTILO}
      body{width:1080px;height:1920px;background:${FONDO_NAVIDAD};color:${VERDE_NAVIDAD};text-align:center}
      img{display:block;width:1080px;height:auto;max-height:1440px;object-fit:cover}
      .detalle{font-family:'Jost',sans-serif;font-size:36px;margin-top:28px}
      h1{font-size:108px;margin-top:120px}
      .precio{font-family:'Jost',sans-serif;font-size:44px;font-weight:500;margin-top:36px}
      .nota{font-family:'Jost',sans-serif;font-size:26px;letter-spacing:.18em;text-transform:uppercase;margin-top:56px;opacity:.8}
      </style><img src="${foto}"><h1>${p.titulo}</h1>${p.detalle ? `<div class="detalle">${p.detalle}</div>` : ''}${p.precio ? `<div class="precio">${p.desde ? 'Desde ' : ''}S/ ${p.precio}</div>` : ''}${p.nota ? `<div class="nota">${p.nota}</div>` : ''}`);
    await page.evaluate(() => document.fonts.ready);
    const out = path.join(SALIDA, `${p.id}.pdf`);
    await page.pdf({ path: out, width: '1080px', height: '1920px', printBackground: true, pageRanges: '1' });
    await page.close();
    console.log(`  página ${p.id}  → ${path.relative(path.resolve(HERE, '../..'), out)}`);
  }
  fs.writeFileSync(path.join(SALIDA, 'paginas.json'), JSON.stringify(PAGINAS.map(({ id, despues_de }) => ({ id, despues_de })), null, 2));
  fs.writeFileSync(path.join(SALIDA, 'textos.json'), JSON.stringify(TEXTOS.map(({ html, ...r }) => r), null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
