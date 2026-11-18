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
    id: 'p2-precio',
    pagina: 2,
    // Precio dictado por el cliente el 18 de noviembre de 2026: las coronas
    // navideñas no están en la tienda. «Desde» porque hay más tamaños; el
    // tamaño base (30 cm) va al lado para que el precio no prometa de más.
    rect: [60, 1225, 750, 1300],
    borrar: [],
    max: 46,
    html: '<p style="font-weight:500">Desde S/ 115 <span style="font-weight:400">(30 cm)</span></p>',
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
    id: 'portada',
    // Portada nueva con una corona real del taller (18 nov 2026); la de Canva
    // era un árbol desenfocado con «CATALOGO» sin tilde. navidad.py la pone
    // en lugar de la página 1 original.
    despues_de: 0,
    tipo: 'portada',
    foto: 'fotos/portada-corona.jpg',
  },
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
    id: 'centro-mesa',
    // Tras la corona de adviento. Foto de internet que mandó el cliente,
    // editada con Seedream para que tenga tres velas y, en una segunda
    // versión, velas doradas. El cliente eligió mostrar las dos (18 de
    // noviembre de 2026): van como referenciales. Sin precio hasta que lo dé.
    despues_de: 6,
    tipo: 'galeria',
    titulo: 'Centros de mesa <em>navideños</em>',
    items: [
      // S/ 160 el de tres velas: precio dictado por el cliente (18 nov 2026).
      { foto: 'fotos/centro-mesa-rojas.jpg', nombre: 'Con tres velas <em>rojas</em>', precio: 160 },
      { foto: 'fotos/centro-mesa-doradas.jpg', nombre: 'Con tres velas <em>doradas</em>', precio: 160 },
      // Tercera opción: foto de internet que mandó el cliente, con la caja gris
      // pasada a negra con Seedream y el moño dorado real del cliente pegado
      // encima (fotografiado aparte). Se probó fondo marfil: se veía falso.
      // S/ 115 el de caja negra con dos velas: precio dictado por el cliente.
      { foto: 'fotos/centro-mesa-caja-negra.jpg', nombre: 'En caja negra, con dos velas <em>doradas</em>', precio: 115 },
    ],
    nota: 'Imágenes referenciales',
  },
  {
    id: 'centro-mesa-taller',
    // Centro de mesa del taller, fotos reales (18 nov 2026): la de estudio con
    // velas doradas y la de velas blancas. Nombre, precio y aviso de colores
    // dictados por el cliente. Sin «referencial»: las fotos no se editaron.
    despues_de: 7,
    tipo: 'galeria',
    titulo: 'Centro de mesa<br>de <em>ciprés con estrellas</em>',
    tamTitulo: 78,
    vertical: true,
    items: [
      { foto: 'fotos/centro-cipres-doradas.jpg', nombre: 'Con velas <em>doradas</em>', precio: 145 },
      { foto: 'fotos/centro-cipres-blancas.jpg', nombre: 'Con velas <em>blancas</em>', precio: 145 },
    ],
    nota: '¡Pregunta por nuestros colores de velas!',
  },
  {
    id: 'complementos',
    // Colgadores y piñas juntos en una página (pedido del cliente, 18 de
    // noviembre de 2026); antes tenían una cada uno. Precios y detalles
    // dictados por el cliente: no están en la tienda. La foto de las piñas
    // es de banco de imágenes (referencial); la de los colgadores es del
    // producto. El bowl de las piñas no se nombra: nadie dijo que venga.
    despues_de: 8,
    tipo: 'galeria',
    titulo: 'Complementos <em>navideños</em>',
    items: [
      { foto: 'fotos/colgadores.jpg', nombre: 'Colgadores para <em>puerta</em>', detalle: 'Dorado o negro', precio: 30, desde: true },
      { foto: 'fotos/pinas-referencial.jpg', nombre: 'Piñas <em>naturales</em>', detalle: '24 piñas', precio: 32, nota: 'Imagen referencial' },
    ],
  },
  {
    id: 'mas-regalos',
    // Tras Regalos corporativos (Cajita Noelia): el cliente pidió más opciones
    // de precio el 18 de noviembre de 2026. Nombre, precio, descripción y foto
    // salen de la tienda (db/products.seed.json, app/public/products), no de acá.
    despues_de: 14,
    tipo: 'opciones',
    // «corporativos» en el título: es la continuación de Regalos corporativos.
    titulo: 'Más regalos <em>corporativos</em>',
    // Cajita Jimena (S/ 70, de la tienda) entra el 18 nov 2026 a pedido del
    // cliente, con su foto real; van de menor a mayor precio.
    productos: ['cajita-jimena', 'box-de-madera-rafaela', 'box-chococafe'],
    // Rafaela con decoración navideña como la Cajita Noelia (pedido del
    // cliente, 18 de noviembre de 2026): la toma de 2000 px que mandó el
    // cliente (fotos/box-rafaela.jpg) editada con Seedream para agregar pino,
    // pepitas rojas, piñas y moño verde. Los productos son los reales; la
    // decoración es generada, por eso la nota.
    fotos: { 'box-de-madera-rafaela': 'fotos/box-rafaela-navidad.jpg', 'cajita-jimena': 'fotos/cajita-jimena.jpg' },
    notas: { 'box-de-madera-rafaela': 'Imagen referencial' },
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
.ref{font-size:15px !important;letter-spacing:.14em !important;opacity:.6 !important}
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
    if (p.tipo === 'portada') {
      const img = fs.readFileSync(path.join(HERE, p.foto)).toString('base64');
      const logo = fs.readFileSync(path.join(RAIZ, 'marketing/ig-ads/marca/logo.png')).toString('base64');
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${fonts}${ESTILO}
        body{width:1080px;height:1920px;background:${FONDO_NAVIDAD};color:${VERDE_NAVIDAD};text-align:center}
        .foto{display:block;width:1080px;height:1440px;object-fit:cover}
        .logo{height:92px;margin-top:70px}
        h1{font-size:118px;margin-top:26px}
        .anio{font-family:'Jost',sans-serif;font-weight:500;font-size:30px;letter-spacing:.32em;margin-top:22px}
        </style><img class="foto" src="data:image/jpeg;base64,${img}"><img class="logo" src="data:image/png;base64,${logo}">
        <h1>Catálogo de <em>Navidad</em></h1><div class="anio">2026</div>`);
      await page.evaluate(() => document.fonts.ready);
      const out = path.join(SALIDA, `${p.id}.pdf`);
      await page.pdf({ path: out, width: '1080px', height: '1920px', printBackground: true, pageRanges: '1' });
      await page.close();
      console.log(`  página ${p.id}  → ${path.relative(RAIZ, out)}`);
      continue;
    }
    if (p.tipo === 'galeria') {
      // Dos fotos en zigzag, cada una con su nombre al costado.
      const filas = p.items.map((it, i) => {
        const img = fs.readFileSync(path.join(HERE, it.foto)).toString('base64');
        return `<div class="fila ${i % 2 ? 'inv' : ''}"><img src="data:image/jpeg;base64,${img}"><div><h2>${it.nombre}</h2>${it.detalle ? `<div class="detalle-g">${it.detalle}</div>` : ''}${it.precio ? `<div class="precio-g">${it.desde ? 'Desde ' : ''}S/ ${it.precio}</div>` : ''}${it.nota ? `<div class="nota-g ref">${it.nota}</div>` : ''}</div></div>`;
      }).join('');
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${fonts}${ESTILO}
        body{width:1080px;height:1920px;background:${FONDO_NAVIDAD};color:${VERDE_NAVIDAD};padding:140px 60px 0;position:relative}
        h1{font-size:${p.tamTitulo || 96}px;text-align:center;margin-bottom:${p.items.length > 2 ? 50 : (p.vertical ? 50 : 80)}px}
        .fila{display:flex;align-items:center;gap:48px;margin-bottom:${p.items.length > 2 ? 34 : 60}px}
        .fila.inv{flex-direction:row-reverse;text-align:right}
        .fila img{width:${p.vertical ? 500 : (p.items.length > 2 ? 470 : 640)}px;height:${p.vertical ? 667 : (p.items.length > 2 ? 470 : 640)}px;object-fit:cover;flex:none}
        h2{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:62px;line-height:1.05}
        h2 em{font-style:italic}
        .detalle-g{font-family:'Jost',sans-serif;font-size:32px;margin-top:16px}
        .nota-g{font-family:'Jost',sans-serif;font-size:20px;letter-spacing:.18em;text-transform:uppercase;margin-top:16px;opacity:.8}
        .precio-g{font-family:'Jost',sans-serif;font-weight:500;font-size:40px;margin-top:18px}
        .nota{position:absolute;left:0;right:0;bottom:90px;text-align:center;font-family:'Jost',sans-serif;font-size:24px;letter-spacing:.18em;text-transform:uppercase;opacity:.8}
        </style><h1>${p.titulo}</h1>${filas}${p.nota ? `<div class="nota${/referencial/i.test(p.nota) ? ' ref' : ''}">${p.nota}</div>` : ''}`);
      await page.evaluate(() => document.fonts.ready);
      const out = path.join(SALIDA, `${p.id}.pdf`);
      await page.pdf({ path: out, width: '1080px', height: '1920px', printBackground: true, pageRanges: '1' });
      await page.close();
      console.log(`  página ${p.id}  → ${path.relative(RAIZ, out)}`);
      continue;
    }
    if (p.tipo === 'opciones') {
      let conAlcohol = false;
      const n3 = p.productos.length > 2;
      const filas = p.productos.map((id) => {
        const prod = tienda.find((x) => x.id === id);
        if (!prod) throw new Error(`${p.id}: «${id}» ya no está en la tienda`);
        // La advertencia legal va una sola vez al pie, no repetida en cada caja.
        let desc = prod.description.replace(/\s*prohibida la venta.*$/is, '').trim().replace(/\s+,/g, ',');
        if (desc.length < prod.description.trim().length) conAlcohol = true;
        const img = fs.readFileSync(p.fotos?.[id] ? path.join(HERE, p.fotos[id]) : path.join(RAIZ, 'app/public', prod.image));
        return `<div class="fila"><img src="data:image/jpeg;base64,${img.toString('base64')}">
          <div class="ficha"><h2>${prod.name.replace(/\s+/g, ' ')}</h2><div class="precio">S/ ${prod.price}</div><p>${desc}</p>${p.notas?.[id] ? `<div class="nota-opc ref">${p.notas[id]}</div>` : ''}</div></div>`;
      }).join('');
      await page.setContent(`<!doctype html><meta charset="utf-8"><style>${fonts}${ESTILO}
        body{width:1080px;height:1920px;background:${FONDO_NAVIDAD};color:${VERDE_NAVIDAD};padding:150px 60px 0}
        h1{font-size:92px;text-align:center;margin-bottom:${n3 ? 60 : 90}px}
        .fila{display:flex;gap:48px;align-items:center;margin-bottom:${n3 ? 40 : 80}px}
        .fila img{width:${n3 ? 380 : 500}px;height:${n3 ? 380 : 500}px;object-fit:cover;flex:none}
        h2{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:64px;line-height:1}
        .precio{font-family:'Jost',sans-serif;font-weight:500;font-size:38px;margin:16px 0 18px}
        .ficha p{font-size:27px;line-height:1.42}
        .nota-opc{font-family:'Jost',sans-serif;font-size:20px;letter-spacing:.18em;text-transform:uppercase;margin-top:18px;opacity:.8}
        .legal{position:absolute;left:60px;right:60px;bottom:${n3 ? 36 : 110}px;text-align:center;font-family:'Jost',sans-serif;font-size:24px}
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
      h1{font-size:${p.tamTitulo || 108}px;margin-top:${p.tamTitulo ? 100 : 120}px}
      .precio{font-family:'Jost',sans-serif;font-size:44px;font-weight:500;margin-top:36px}
      .nota{font-family:'Jost',sans-serif;font-size:26px;letter-spacing:.18em;text-transform:uppercase;margin-top:56px;opacity:.8}
      </style><img src="${foto}"><h1>${p.titulo}</h1>${p.detalle ? `<div class="detalle">${p.detalle}</div>` : ''}${p.precio ? `<div class="precio">${p.desde ? 'Desde ' : ''}S/ ${p.precio}</div>` : ''}${p.nota ? `<div class="nota${/referencial/i.test(p.nota) ? ' ref' : ''}">${p.nota}</div>` : ''}`);
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
