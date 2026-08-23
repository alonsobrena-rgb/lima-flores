#!/usr/bin/env node
// Genera los creativos de la campaña de Instagram a partir de marketing/ig-ads/ads.json.
//
//   node marketing/ig-ads/build.mjs
//
// Renderiza cada anuncio como HTML y lo fotografía con Chromium headless al tamaño
// exacto que pide Meta (1080×1350 para feed, 1080×1920 para historias). Las fotos
// salen del catálogo real: app/public/products/.
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
const PHOTOS = path.join(ROOT, 'app/public/products');
const OUT = path.join(HERE, 'creativos');
const CACHE = path.join(HERE, '.fontcache');

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Jost:wght@300;400;500;600&display=swap';

// La paleta no se escribe acá: se lee del sistema de diseño Florencia, que a su
// vez sale de medir el ramo del logotipo. Si el sistema cambia de fondo o de
// acento, los 32 anuncios cambian con él sin tocar este archivo.
const TOKENS = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, 'design/direcciones/florencia.css'), 'utf8')
      .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)]
    .map((m) => [m[1], m[2].trim()]),
);
const tk = (nombre) => {
  const v = TOKENS[nombre];
  if (!v) throw new Error(`falta el token ${nombre} en florencia.css`);
  return v;
};

const C = {
  fondo: tk('--bg-page'),        // blanco total
  alt: tk('--bg-alt'),           // gris de sección
  ink: tk('--text-strong'),
  body: tk('--text-body'),
  muted: tk('--text-muted'),
  faint: tk('--text-faint'),     // el gris del logotipo
  line: tk('--border'),
  rosa: tk('--accent'),
  rosaHonda: tk('--accent-hover'),
  verde: tk('--leaf'),
  radio: tk('--radius-sm'),      // el pie del arco, para que no quede en punta
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

// fotos/prep-fotos.py deja recortada al producto cada toma que tenía fondo de
// sobra, y anota su color. Con eso la foto entra con `contain` sobre un
// contenedor del mismo color: el producto nunca se corta y tampoco flota en
// medio del vacío. Las que ya llenan el encuadre siguen entrando a sangre.
const ENCUADRES = JSON.parse(fs.readFileSync(path.join(HERE, 'fotos/encuadres.json'), 'utf8'));

// Los recortes al ras que usa la tira — fotos/prep-tira.py. Van aparte porque la
// regla es distinta: ahí se recorta siempre, aunque el recorte gane poco, para
// que tres fotos vecinas entren del mismo tamaño.
const TIRA = fs.existsSync(path.join(HERE, 'fotos/tira/encuadres.json'))
  ? JSON.parse(fs.readFileSync(path.join(HERE, 'fotos/tira/encuadres.json'), 'utf8'))
  : {};
const fotoTira = (file) => {
  if (!TIRA[file]) throw new Error(`falta el recorte de ${file}: corre fotos/prep-tira.py`);
  return {
    uri: `data:image/jpeg;base64,${fs.readFileSync(path.join(HERE, 'fotos/tira', file)).toString('base64')}`,
    bg: TIRA[file].fondo,
  };
};

const foto = (file) => {
  const enc = ENCUADRES[file] || { fondo: '#FFFFFF', recortada: false };
  const src = enc.recortada ? path.join(HERE, 'fotos', file) : path.join(PHOTOS, file);
  return {
    uri: `data:image/jpeg;base64,${fs.readFileSync(src).toString('base64')}`,
    // La original hace falta donde la foto entra en una franja mucho más ancha
    // que alta: ahí el recorte, que suele ser vertical, quedaría minúsculo.
    uriOrig: `data:image/jpeg;base64,${fs.readFileSync(path.join(PHOTOS, file)).toString('base64')}`,
    bg: enc.fondo,
    recortada: enc.recortada,
  };
};

// El logo de la página (app/public/assets/logo.png), en sus dos versiones —
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

/* ── velos ───────────────────────────────────────────────────────────────
   Un velo es lo que vuelve legible un texto sobre foto. El problema es que un
   `linear-gradient(a, transparent)` tiene la derivada rota justo donde arranca:
   la opacidad cae en línea recta y de golpe deja de caer. El ojo lee esa
   esquina de la curva como el canto de un recuadro — aunque no haya recuadro.
   Con foto clara detrás se ve peor todavía, porque el velo blanco no aclara
   nada y lo único que queda visible es su propio borde.

   Estos paros aproximan una smoothstep: entra y sale en cero, sin cantos. Y el
   velo va siempre a sangre por los tres lados que toca el lienzo, así que el
   único borde recto que existe es el del propio anuncio. */
// El velo se pide en rgb y el sistema da hex. Se convierte acá, en vez de
// escribir el rgb a mano: así el velo no se queda con el color viejo cuando el
// token cambia. Pasó — el marfil `251,248,241` sobrevivió al paso a blanco
// total y se veía como una banda amarillenta al pie de las citas.
const rgb = (hex) => hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16)).join(',');
// Luminancia percibida, para comparar fondos de fotos entre si.
const lum = (hex) => {
  const [r, g, b] = hex.replace('#', '').match(/../g).map((h) => parseInt(h, 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const PASOS = [[0, 1], [12, .972], [24, .896], [36, .776], [48, .62], [60, .448],
  [72, .28], [82, .152], [91, .06], [100, 0]];
const velo = (dir, rgb, alfa = 1) =>
  `linear-gradient(${dir},${PASOS.map(([p, a]) => `rgba(${rgb},${(a * alfa).toFixed(3)}) ${p}%`).join(',')})`;
// Versión radial, para cuando el texto se apoya en una esquina: una elipse
// anclada fuera del lienzo no tiene ni un lado recto.
const veloEsquina = (at, rgb, alfa = 1, tam = '118% 86%') =>
  `radial-gradient(${tam} at ${at},${PASOS.map(([p, a]) => `rgba(${rgb},${(a * alfa).toFixed(3)}) ${p}%`).join(',')})`;

const base = (fonts, w, h, body) => `<!doctype html><meta charset="utf-8"><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;background:${C.fondo};font-family:'Jost',-apple-system,sans-serif;color:${C.body};
  -webkit-font-smoothing:antialiased}
/* El sistema fija el tamaño display en itálica peso 500 — guidelines/
   type-display.html. Con todo en itálica, el acento se distingue por color y
   no por estilo, que además es más elegante. */
.d{font-family:'Cormorant Garamond',Georgia,serif;font-style:italic;font-weight:500;
  letter-spacing:-.018em;line-height:.98}
.d em{font-style:italic;font-weight:500;color:var(--em,${C.rosa})}
/* No hay mono en el sistema: los rótulos son Jost en versalita muy espaciada,
   como manda type-eyebrow-script.html. */
.mono{font-family:'Jost',sans-serif;font-weight:500;text-transform:uppercase;
  letter-spacing:.22em}
.rule{height:1px;background:${C.line}}
.shot{width:100%;height:100%;object-fit:cover;display:block}
/* Las alas de un contain — ver img(). Cada una estira la franja de borde de la
   propia foto: 6000% anclado al filo muestra 1/60 de la imagen ocupando el ala
   entera. El degradado del ciclorama sigue fila por fila y la union no existe,
   porque el ala arranca con los mismos pixeles que el borde. Van de a dos, cada
   una de la mitad, y se juntan en el centro — que con contain siempre queda
   tapado por la foto, este el hueco a los lados o arriba y abajo. La geometria
   va en linea porque depende del eje; aca solo queda lo comun.
   Ojo con el orden de pintado: un elemento posicionado pinta ENCIMA del
   contenido en flujo aunque vaya antes en el HTML, asi que las dos alas
   tapaban la foto entera. Se arregla posicionando tambien la foto — no con un
   z-index negativo, que la mandaba detras del fondo de la ventana. */
.ala{position:absolute;background-repeat:no-repeat}
</style>${body}
<!-- La sonda de la regla 1 (ver revisaRecorte): mide cuánto se come el cover
     de cada foto y lo deja en el título, que es lo que lee --dump-dom. No
     pinta nada, así que viaja en la misma pieza que se fotografía. -->
<script>addEventListener('load',()=>{
  const r=[...document.querySelectorAll('img.shot')].map((im)=>{
    const b=im.getBoundingClientRect();
    if(!im.naturalWidth) return null;
    const fit=getComputedStyle(im).objectFit;
    const caja=[Math.round(b.width),Math.round(b.height)];
    const foto=[im.naturalWidth,im.naturalHeight];
    if(fit==='cover'){
      const s=Math.max(b.width/im.naturalWidth,b.height/im.naturalHeight);
      return {x:+(1-b.width/(im.naturalWidth*s)).toFixed(4),
              y:+(1-b.height/(im.naturalHeight*s)).toFixed(4),caja,foto};
    }
    const ala=im.previousElementSibling;
    if(fit==='contain'&&ala&&ala.className==='ala'){
      // Cada ala estira un borde distinto, así que el eje declarado tiene que
      // coincidir con el lado por donde quedó el hueco. Si no, se ven partidas
      // por el medio. Se compara lo declarado (el ala ocupa medio ancho o media
      // altura) contra el hueco que midió el navegador.
      const s=Math.min(b.width/im.naturalWidth,b.height/im.naturalHeight);
      const r=ala.getBoundingClientRect();
      const eje=r.width<b.width*0.9?'h':'v';
      const hueco=im.naturalWidth*s<b.width-1?'h':(im.naturalHeight*s<b.height-1?'v':null);
      return {x:0,y:0,caja,foto,alas:eje,hueco};
    }
    return null;
  }).filter(Boolean);
  document.title='RECORTE'+JSON.stringify(r);
});</script>`;

// Geometría absoluta a propósito: con flex, un titular de una línea más rompía
// el encuadre y el precio se salía del lienzo sin que el render avisara.
// `banda` la piden las plantillas cuyo hueco de foto es mucho más ancho que
// alto: ahí conviene la toma original a sangre, porque el recorte vertical
// entraría contenido y se vería diminuto.
const img = (a, ph, banda) => {
  const fit = ph.recortada && !banda ? 'contain' : (a.creative.fit || 'cover');
  // La toma original solo tiene sentido en una franja que va a sangre. Si el
  // anuncio pide `contain` para que el producto entre entero, conviene la
  // recortada: misma foto, menos ciclorama, y por lo tanto producto más grande
  // dentro de la misma caja (en IG-35, 682px de ancho en vez de 521).
  const usaOrig = banda && ph.recortada && fit === 'cover';
  const pos = a.creative.position || '50% 50%';
  const src = usaOrig ? ph.uriOrig : ph.uri;

  // `sangra` recorta un % por lado DESPUÉS de encajar la foto. Está para las
  // tomas cuyo borde no es fondo: `tulipanes-de-amor` termina en la mesa, y al
  // entrar entera esa mesa caía justo contra el relleno de abajo y se leía como
  // una línea recta cruzando la pieza. Un 4% se lleva la mesa y no toca el ramo,
  // que empieza al 6% de la altura.
  const sg = Number(a.creative.sangra) || 0;
  const crecida = 100 + 2 * sg;

  // `alas` rellena el hueco del contain con la propia foto en vez del color
  // medido. Hace falta cuando el fondo de la toma es un ciclorama en degradado:
  // contra un relleno plano el filo se ve como el recuadro que prohíbe la regla
  // 2 — en IG-25 el salto era de 18 niveles a la derecha, y en IG-26 el hueco de
  // arriba se leía como una franja blanca. Es el truco de cabeceras.py.
  //
  // Hay que decir por dónde queda el hueco, porque cada ala estira un borde
  // distinto: `true` (o 'h') para los costados, 'v' para arriba y abajo. No se
  // puede adivinar desde acá —depende de la caja que da la plantilla— pero
  // tampoco queda a la buena fe: la sonda compara lo declarado contra lo que
  // midió el navegador y revienta el build si no coinciden.
  //
  // El contain automático de las fotos recortadas no lleva alas y no le hacen
  // falta: prep-fotos.py deja el borde de la foto en el mismo color que midió.
  const eje = a.creative.alas === 'v' ? 'v' : (a.creative.alas ? 'h' : null);
  const conAlas = fit === 'contain' && !!eje;

  const caja = conAlas || sg
    ? `;position:absolute;left:${-sg}%;top:${-sg}%;width:${crecida}%;height:${crecida}%`
    : '';
  const foto = `<img src="${src}" class="shot"
       style="object-fit:${fit};object-position:${pos}${caja}">`;
  if (!conAlas) return foto;

  const ala = (lado) => {
    const geo = eje === 'h'
      ? `top:0;bottom:0;width:50%;${lado ? 'right' : 'left'}:0`
      : `left:0;right:0;height:50%;${lado ? 'bottom' : 'top'}:0`;
    const tam = eje === 'h' ? `6000% ${crecida}%` : `${crecida}% 6000%`;
    const anc = eje === 'h' ? `${lado * 100}% 50%` : `50% ${lado * 100}%`;
    return `<div class="ala" style="${geo};background-image:url(${src});`
      + `background-size:${tam};background-position:${anc}"></div>`;
  };
  return `${ala(0)}${ala(1)}${foto}`;
};

// A · Editorial: foto grande, titular abajo. Para público frío.
const editorial = (a, ph) => `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <div style="position:absolute;top:60px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center">
    <span class="mono" style="font-size:19px;color:${C.rosa}">${a.creative.eyebrow}</span>
    ${logo(74)}
  </div>
  <div class="rule" style="position:absolute;top:126px;left:72px;right:72px"></div>
  <!-- De borde a borde. Metido 72 px de cada lado se le ve el canto al bloque
       cuando la foto no es sobre blanco, y eso se lee como un marco. -->
  <div style="position:absolute;top:150px;left:0;right:0;height:892px;background:${ph.bg};overflow:hidden">
    ${img(a, ph)}
  </div>
  <!-- Titular, bajada y precio en un mismo flujo anclado abajo. Anclados por
       separado, una bajada de dos lineas le pisa el precio. -->
  <div style="position:absolute;left:72px;right:72px;bottom:46px">
    <h1 class="d" style="font-size:${a.creative.hlSize || 82}px">${a.creative.headline}</h1>
    <p style="font-size:24px;font-weight:300;line-height:1.4;color:${C.body};margin-top:12px;max-width:860px">${a.creative.sub}</p>
    <div style="margin-top:20px;display:flex;justify-content:space-between;align-items:center">
      <span class="d" style="font-size:46px;font-weight:400">${a.creative.price}</span>
      <span class="mono" style="font-size:17px;color:${C.muted}">${a.creative.footer}</span>
    </div>
  </div>
</div>`;

// B · Split: panel oscuro con la lista de entregables + foto a sangre. Objeciones.
const split = (a, ph) => `
<div style="position:absolute;inset:0">
  <div style="position:absolute;top:0;bottom:0;left:0;width:486px;background:${C.alt};color:${C.ink}">
    <span class="mono" style="position:absolute;top:64px;left:52px;font-size:17px;color:${C.rosa}">${a.creative.eyebrow}</span>
    <h1 class="d" style="position:absolute;top:112px;left:52px;right:52px;font-size:${a.creative.hlSize || 82}px">${a.creative.headline}</h1>
    <ul style="position:absolute;left:52px;right:52px;bottom:214px;list-style:none;
               border-top:1px solid ${C.line}">
      ${a.creative.items
        .map(
          (t) => `<li style="display:flex;gap:16px;align-items:flex-start;padding:19px 0;
              border-bottom:1px solid ${C.line};font-size:24px;font-weight:400;line-height:1.34;color:${C.body}">
            <span style="color:${C.verde};font-size:18px;line-height:1.75">—</span><span>${t}</span></li>`,
        )
        .join('')}
    </ul>
    <div style="position:absolute;left:52px;bottom:64px">
      <div class="d" style="font-size:64px;color:${C.rosa}">${a.creative.price}</div>
      <div class="mono" style="font-size:15px;color:${C.muted};margin-top:12px">${a.creative.footer}</div>
    </div>
  </div>
  <div style="position:absolute;top:0;bottom:0;left:486px;right:0;background:${ph.bg};overflow:hidden">
    ${img(a, ph)}
    <div style="position:absolute;top:40px;right:40px">${logo(72)}</div>
  </div>
</div>`;

// C · Cita: prueba social o manifiesto arriba, foto abajo. Para consideración.
const quote = (a, ph) => `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <div style="position:absolute;top:70px;left:76px;right:76px;display:flex;justify-content:space-between;align-items:center">
    <span style="font-size:23px;letter-spacing:.42em;color:${C.rosa}">★★★★★</span>
    ${logo(72)}
  </div>
  <!-- La cita y la firma van en un mismo flujo, no cada una anclada por su
       cuenta: la cita puede salir de dos lineas o de cuatro, y ancladas por
       separado la firma se le monta encima cuando crece. -->
  <!-- Debajo de la cabecera, no a su misma altura. La cita ocupa el ancho
       completo, asi que arrancando a 112 px su primera linea le pasa por debajo
       al logotipo — en IG-08 «pequenos» quedaba encima de la marca. -->
  <div style="position:absolute;top:206px;left:76px;right:76px">
    <blockquote class="d" style="font-size:${a.creative.hlSize || 62}px;line-height:1.06">«${a.creative.quote}»</blockquote>
    <div style="display:flex;align-items:center;gap:18px;margin-top:30px">
      <span style="width:44px;height:1px;background:${C.line}"></span>
      <span style="font-size:23px;font-weight:400">${a.creative.author}</span>
    </div>
    <div class="mono" style="font-size:15px;color:${C.muted};margin-top:11px;margin-left:62px">${a.creative.meta}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:${a.creative.fotoH || 800}px;background:${ph.bg};
              overflow:hidden">
    ${img(a, ph)}
    <div style="position:absolute;left:0;right:0;bottom:0;height:330px;padding:0 76px 40px;
                display:flex;justify-content:space-between;align-items:flex-end;
                background:${velo('to top', rgb(C.fondo), .98)}">
      <span class="d" style="font-size:44px;font-weight:400">${a.creative.price}</span>
      <span class="mono" style="font-size:16px;color:${C.muted}">${a.creative.footer}</span>
    </div>
  </div>
</div>`;

// S · Historia 9:16. Todo el texto vive entre los 250px de arriba y los 372px de
// abajo que tapan la interfaz de Instagram.
const story = (a, ph) => `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <!-- La franja llega hasta los 1180 px y el producto se apoya en su borde de
       abajo. Antes eran 1010 a sangre: lo que sobraba se perdia por arriba, que
       es justo donde esta la flor. -->
  <div style="position:absolute;top:0;left:0;right:0;height:1120px;background:${ph.bg};overflow:hidden">
    ${img(a, ph)}
  </div>
  <!-- Todo el pie en un mismo flujo, anclado a la zona segura de abajo. Con el
       texto y el boton anclados por separado, una bajada de tres lineas se le
       mete debajo al boton y se corta. -->
  <div style="position:absolute;left:78px;right:78px;bottom:372px">
    <span class="mono" style="font-size:18px;color:${C.rosa}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || 84}px;margin-top:18px">${a.creative.headline}</h1>
    <p style="font-size:26px;font-weight:300;line-height:1.38;color:${C.body};margin-top:16px;max-width:920px">${a.creative.sub}</p>
    <div style="margin-top:26px;display:flex;justify-content:space-between;align-items:center">
      <span style="display:inline-flex;align-items:center;gap:18px;background:${C.rosa};color:#fff;
                   padding:24px 44px;border-radius:999px">
        <span style="font-size:26px;font-weight:500">${a.creative.pill}</span>
        <span style="font-size:24px">→</span>
      </span>
      ${logo(72)}
    </div>
  </div>
</div>`;

/* ── formatos sin caja: la foto es el anuncio y el texto vive encima ────── */

// P · Puro: foto a sangre, un titular y nada más. `tone:'light'` para fotos
// oscuras (texto blanco sobre un degradado suave, no sobre un recuadro).
const puro = (a, ph, w, h) => {
  const light = a.creative.tone === 'light';
  const fg = light ? '#fff' : C.ink;
  const mut = light ? 'rgba(255,255,255,.8)' : '${C.body}';
  const safe = h === 1920 ? 372 : 76;
  // `anchor:'top'` para fotos cuyo aire está arriba: el texto se apoya en el
  // vacío de la propia toma en vez de caer sobre el producto.
  const top = a.creative.anchor === 'top';
  const textPos = top ? `top:${h === 1920 ? 286 : 76}px` : `bottom:${safe}px`;
  const markPos = top ? `bottom:${safe}px` : `top:${h === 1920 ? 272 : 66}px`;
  // `franja` reserva una banda para el texto, del color de fondo de la foto: el
  // titular nunca cae sobre el producto y la unión no se ve. Se activa por
  // anuncio, no por foto — un macro quiere el texto encima, una toma de estudio no.
  const franja = a.creative.franja ? (h === 1920 ? 470 : 300) : 0;
  const fotoPos = top ? `top:${franja}px;bottom:0` : `top:0;bottom:${franja}px`;
  return `
<div style="position:absolute;inset:0;background:${a.creative.bg || ph.bg};overflow:hidden;
            --em:${light ? '#F0BFCB' : C.rosa}">
  <div style="position:absolute;left:0;right:0;${fotoPos};overflow:hidden">${img(a, ph)}</div>
  ${light
    ? `<div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(h * 0.74)}px;
         background:${velo('to top', '10,7,6', .86)}"></div>`
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
//
// `zona` decide dónde vive el pie de texto, y con eso si hace falta velo:
//
//   'ancho' (por defecto) — bloque a todo el ancho, con el velo al pie. Es lo
//             que necesitan IG-23 e IG-34: debajo del titular hay maceta y caja,
//             no vacío, así que ahí el velo sí está protegiendo texto.
//   'izq'   — columna angosta abajo a la izquierda, SIN velo. Para las tomas
//             que ya traen su propio vacío. En IG-11 el velo cubría el 62% de
//             la pieza para sostener un titular a todo el ancho, y de paso
//             dejaba las rosas de abajo detrás de una niebla. Encuadrando la
//             foto al ras izquierdo aparece un vacío de estudio de 585 × 225
//             (luminancia 239 uniforme, medida): el titular cabe entero ahí y
//             ninguna flor queda tapada.
const sello = (a, ph, w, h) => {
  // Con `tone:'light'` el degradado es oscuro y el texto blanco; sobre fotos de
  // fondo claro se invierte, porque un velo negro ahí se ve como un parche.
  const onDark = a.creative.tone === 'light';
  const fg = onDark ? '#fff' : C.ink;
  const mut = onDark ? 'rgba(255,255,255,.8)' : C.body;
  const tinte = onDark ? '10,7,6' : rgb(C.fondo);
  const izq = a.creative.zona === 'izq';
  return `
<div style="position:absolute;inset:0;background:${ph.bg};overflow:hidden;--em:${onDark ? '#F0BFCB' : C.rosa}">
  ${img(a, ph)}
  ${izq ? '' : `<div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(h * 0.62)}px;
       background:${velo('to top', tinte, onDark ? .8 : .95)}"></div>`}
  <div style="position:absolute;top:${h === 1920 ? 300 : 74}px;right:74px;width:244px;height:244px;
              background:${C.rosa};border-radius:50%;color:#fff;
              display:flex;flex-direction:column;align-items:center;justify-content:center">
    <span class="d" style="font-size:64px;font-weight:400;line-height:1">${a.creative.price}</span>
    <span class="mono" style="font-size:12px;color:rgba(255,255,255,.78);margin-top:12px">${a.creative.seal}</span>
  </div>
  ${izq ? `
  <!-- El titular lleva ancho máximo propio: el vacío es una cuña que se abre
       hacia abajo, así que las líneas de arriba tienen que ser las cortas. -->
  <div style="position:absolute;left:72px;bottom:${h === 1920 ? 372 : 46}px;color:${fg}">
    <h1 class="d" style="font-size:${a.creative.hlSize || 96}px;max-width:${a.creative.hlAncho || 300}px">${a.creative.headline}</h1>
    <span class="mono" style="display:block;font-size:15px;color:${mut};margin-top:24px">${a.creative.footer}</span>
    <div style="margin-top:22px">${logo(52, onDark)}</div>
  </div>` : `
  <div style="position:absolute;left:76px;right:76px;bottom:${h === 1920 ? 372 : 76}px;color:${fg}">
    <h1 class="d" style="font-size:${a.creative.hlSize || 96}px">${a.creative.headline}</h1>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:28px">
      <span class="mono" style="font-size:15px;color:${mut}">${a.creative.footer}</span>
      ${logo(72, onDark)}
    </div>
  </div>`}
</div>`;
};

// C2 · Cuadro 1:1: la foto ocupa el lienzo y el texto se apoya en el vacío que
// la propia foto deja a un costado.
//
// Sin velo, a propósito. Había uno radial anclado en la esquina superior
// derecha y era la nube blanca que se veía tapando el producto: en estas tomas
// esa esquina ya es fondo de estudio, así que el velo no aclaraba nada que
// hiciera falta aclarar — lo único que lograba era lavar el globo de IG-30 y el
// respaldo del sofá de IG-16. Regla 6: si el texto ya cae sobre vacío, el velo
// sobra y solo está tapando foto.
//
// A cambio, dónde cae el texto deja de ser fijo, porque el vacío no está en el
// mismo sitio en las tres. `zona`:
//
//   'der'   — columna a la derecha, alineada a la derecha. Es el vacío de las
//             tomas de estudio: medido sobre la foto ya encuadrada, el 5%
//             más oscuro de esa caja da 231 de luminancia en IG-22 y 174 en
//             IG-30 (el globo pasa cerca, pero por debajo del texto).
//   'banda' — franja al tope, alineada a la izquierda. Para las tomas de
//             ambiente, que no dejan columna: en IG-16 la derecha es el brazo
//             de madera de la silla (p5 68, casi negro) y el único vacío real
//             es el respaldo del sofá — ancho, claro y bajo.
const cuadro = (a, ph) => {
  const precio = `<span class="d" style="font-size:40px;font-weight:400">${a.creative.price}</span>`;
  const cuerpo = a.creative.zona === 'banda' ? `
  <!-- Franja: todo en una línea, porque el vacío de las tomas de ambiente es
       ancho y bajo. Corta en 820px, que es donde arranca el brazo de madera de
       la silla en IG-16; y no baja de 170px, que es donde sube la punta del
       papel. Apilar el precio debajo del titular lo metía sobre el celofán. -->
  <div style="position:absolute;top:48px;left:56px;right:260px;
              display:flex;justify-content:space-between;align-items:center;gap:40px">
    <div style="min-width:0">
      ${a.creative.eyebrow ? `<span class="mono" style="display:block;font-size:15px;color:${C.muted};margin-bottom:14px">${a.creative.eyebrow}</span>` : ''}
      <h1 class="d" style="font-size:${a.creative.hlSize || 52}px">${a.creative.headline}</h1>
    </div>
    <div style="display:flex;align-items:center;gap:18px;flex:none">${logo(58)}${precio}</div>
  </div>` : `
  <div style="position:absolute;top:62px;right:58px;left:498px;text-align:right">
    <span class="mono" style="font-size:15px;color:${C.muted}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || 60}px;margin-top:${a.creative.eyebrow ? 20 : 0}px">${a.creative.headline}</h1>
    <div style="height:1px;background:${C.line};margin:24px 0 0 auto;width:180px"></div>
    <div style="margin-top:22px;display:flex;justify-content:flex-end;align-items:center;gap:20px">
      ${logo(52)}${precio}
    </div>
  </div>`;
  return `
<div style="position:absolute;inset:0;background:${ph.bg};overflow:hidden">
  ${img(a, ph)}
  ${cuerpo}
</div>`;
};

// T · Titular: aquí manda la tipografía y la foto entra como una franja al pie.
const titular = (a, ph, w, h) => {
  const tall = h === 1920;
  // La franja sube y crece: antes empezaba a media pieza y dejaba el resto en
  // blanco, con el titular solo arriba.
  const bandTop = tall ? 766 : 520;
  const bandH = tall ? 782 : 830;
  return `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <div style="position:absolute;top:${tall ? 262 : 60}px;left:76px">${logo(80)}</div>
  <!-- Rotulo, titular y precio en un mismo flujo, anclado al borde de la franja.
       Anclados por separado, un titular de dos lineas le pisa el precio y el
       precio se mete debajo de la foto. -->
  <div style="position:absolute;left:76px;right:76px;bottom:${h - bandTop + 26}px">
    <span class="mono" style="display:block;font-size:18px;color:${C.rosa}">${a.creative.eyebrow}</span>
    <h1 class="d" style="margin-top:${tall ? 22 : 18}px;
        font-size:${a.creative.hlSize || (tall ? 112 : 104)}px">${a.creative.headline}</h1>
    <div style="margin-top:${tall ? 26 : 20}px;display:flex;justify-content:space-between;align-items:baseline">
      <span class="d" style="font-size:44px;font-weight:400">${a.creative.price}</span>
      <span class="mono" style="font-size:16px;color:${C.muted}">${a.creative.footer}</span>
    </div>
  </div>
  <div style="position:absolute;left:0;right:0;top:${bandTop}px;height:${bandH}px;background:${ph.bg};overflow:hidden">
    ${img(a, ph, true)}
  </div>
</div>`;
};

// PC · Postal: simétrica y centrada. Era una lámina con margen ancho y filete;
// el filete se lee como un marco y el margen dejaba el producto chico, así que
// la foto pasa a ir de borde a borde y lo simétrico lo sostiene el texto.
const postal = (a, ph, w, h) => {
  const tall = h === 1920;
  const fotoY = tall ? 396 : 176;
  const fotoH = tall ? 848 : 856;
  return `
<div style="position:absolute;inset:0;background:${C.fondo};text-align:center">
  <div style="position:absolute;top:${tall ? 274 : 62}px;left:0;right:0;display:flex;justify-content:center">${logo(84)}</div>
  <div style="position:absolute;left:0;right:0;top:${fotoY}px;height:${fotoH}px;
              background:${ph.bg};overflow:hidden">${img(a, ph)}</div>
  <!-- Titular, bajada y precio en un mismo flujo: anclados por separado, una
       bajada de dos lineas se lleva el precio fuera del lienzo. -->
  <div style="position:absolute;left:64px;right:64px;bottom:${tall ? 372 : 56}px">
    <h1 class="d" style="font-size:${a.creative.hlSize || 66}px">${a.creative.headline}</h1>
    <p style="font-size:24px;font-weight:300;line-height:1.4;color:${C.body};margin-top:14px">${a.creative.sub}</p>
    <div style="margin-top:18px;display:flex;justify-content:center;align-items:baseline;gap:20px">
      <span class="d" style="font-size:42px;font-weight:400">${a.creative.price}</span>
      <span class="mono" style="font-size:15px;color:${C.muted}">${a.creative.footer}</span>
    </div>
  </div>
</div>`;
};

/* ── tres formatos nuevos ────────────────────────────────────────────────
   Los nueve de arriba resuelven el mismo problema de nueve maneras: una foto,
   un titular y un precio. Estos tres cambian la pregunta. */

// V · Vitrina: la foto dentro de un arco, apoyada en la repisa. Es la puerta de
// una florería europea — el encargo de la marca, dicho con una sola forma. El
// arco es la única figura del sistema que no es un rectángulo, así que se gana
// la atención sin gritar y sin tapar nada de la foto.
const vitrina = (a, ph, w, h) => {
  const tall = h === 1920;
  // En 9:16 el arco no puede crecer a gusto: entre los 250 px de arriba y los
  // 372 de abajo que tapa Instagram quedan 1298, y abajo del arco todavía van
  // titular, bajada y precio. El arco se queda con poco más de la mitad.
  const arcoW = tall ? 700 : 640;
  const arcoH = tall ? 706 : 754;
  const arcoY = tall ? 394 : 206;
  const x = Math.round((w - arcoW) / 2);
  const repisa = arcoY + arcoH;
  return `
<div style="position:absolute;inset:0;background:${C.fondo};text-align:center">
  <div style="position:absolute;top:${tall ? 268 : 62}px;left:0;right:0;display:flex;justify-content:center">${logo(tall ? 62 : 70)}</div>
  <span class="mono" style="position:absolute;top:${tall ? 348 : 158}px;left:0;right:0;
        font-size:16px;color:${C.rosa}">${a.creative.eyebrow}</span>
  <div style="position:absolute;left:${x}px;top:${arcoY}px;width:${arcoW}px;height:${arcoH}px;
              background:${ph.bg};overflow:hidden;
              /* Casi todas las tomas son de estudio sobre blanco, así que sin
                 este filete el arco no existe: se funde con la página y la foto
                 queda flotando. El filete es la ventana, no un recuadro sobre la
                 foto — por eso va en el borde de la forma y no encima de nada. */
              box-shadow:inset 0 0 0 1px ${C.line};
              border-radius:${arcoW / 2}px ${arcoW / 2}px ${C.radio} ${C.radio}">
    ${img(a, ph)}
  </div>
  <div class="rule" style="position:absolute;left:${tall ? 96 : 76}px;right:${tall ? 96 : 76}px;top:${repisa}px"></div>
  <div style="position:absolute;left:76px;right:76px;top:${repisa + (tall ? 46 : 44)}px">
    <h1 class="d" style="font-size:${a.creative.hlSize || (tall ? 82 : 68)}px">${a.creative.headline}</h1>
    ${a.creative.sub
      ? `<p style="font-size:${tall ? 28 : 25}px;font-weight:300;line-height:1.42;color:${C.body};
           margin:${tall ? 22 : 20}px auto 0;max-width:${tall ? 780 : 700}px">${a.creative.sub}</p>`
      : ''}
  </div>
  <div style="position:absolute;left:76px;right:76px;bottom:${tall ? 372 : 74}px;display:flex;
              justify-content:center;align-items:baseline;gap:22px">
    <span class="d" style="font-size:44px;font-weight:400">${a.creative.price}</span>
    <span class="mono" style="font-size:15px;color:${C.muted}">${a.creative.footer}</span>
  </div>
</div>`;
};

// TR · Tira: tres piezas del catálogo en columnas, con su nombre y su precio.
// El único formato que no vende un producto sino un surtido — es lo que hace
// una carretilla de flores, que no ofrece una flor sino para elegir. Sirve
// donde un carrusel no cabe: una sola imagen que ya muestra el rango de precio.
const tira = (a, ph, w, h) => {
  const tall = h === 1920;
  const m = 72;
  const gap = 20;
  const piezas = a.creative.piezas;
  // El taller no fotografio todo sobre el mismo fondo: hay tomas sobre blanco y
  // tomas sobre un gris de estudio. En cualquier otra plantilla da igual, porque
  // se ve una sola foto; en la tira las tres se ven juntas y la del fondo mas
  // oscuro aparece como un recuadro gris al lado de dos que se funden con la
  // pagina. No es un problema de maquetacion — no hay relleno que empareje un
  // fondo que ya viene quemado en el JPEG — asi que se avisa al armar, que es
  // cuando todavia se puede cambiar el producto por otro del mismo catalogo.
  const lums = piezas.map((p) => lum(fotoTira(p.photo).bg));
  const salto = Math.max(...lums) - Math.min(...lums);
  if (salto > 12) {
    const peor = piezas[lums.indexOf(Math.min(...lums))];
    console.warn(`  ! ${a.code}: los fondos de las fotos no empatan (salto ${Math.round(salto)}).`
      + ` ${peor.photo} se va a ver como un recuadro gris — cambiala por otra tomada sobre blanco.`);
  }
  const colW = Math.round((w - m * 2 - gap * (piezas.length - 1)) / piezas.length);
  // Tres columnas en 1080 dan paneles de 298 px: si además se hacen altos, la
  // relación queda en 1:2 y no hay foto de ramo que entre sin perder los lados.
  // Se los deja casi cuadrados y entran a sangre — lo que se recorta es fondo.
  const panelY = tall ? 906 : 496;
  const panelH = tall ? 620 : 534;
  return `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <div style="position:absolute;top:${tall ? 274 : 60}px;left:${m}px;right:${m}px;display:flex;
              justify-content:space-between;align-items:center">
    <span class="mono" style="font-size:17px;color:${C.rosa}">${a.creative.eyebrow}</span>
    ${logo(70)}
  </div>
  <!-- Anclado por abajo, no por arriba: el titular puede salir de una línea o de
       dos y anclado por arriba el hueco contra los paneles cambia de tamaño. -->
  <h1 class="d" style="position:absolute;bottom:${h - panelY + (tall ? 46 : 38)}px;left:${m}px;right:${m}px;
      font-size:${a.creative.hlSize || (tall ? 104 : 84)}px">${a.creative.headline}</h1>
  ${piezas
    .map((p, i) => {
      const fx = fotoTira(p.photo);
      const left = m + i * (colW + gap);
      return `
  <div style="position:absolute;left:${left}px;top:${panelY}px;width:${colW}px;height:${panelH}px;
              background:${fx.bg};overflow:hidden">
    <!-- Siempre contenidas, nunca a sangre: en una tira lo que se compara son
         los productos entre si, asi que ninguno se recorta y las tres entran
         igual. Y sobre el recorte al ras de prep-tira.py, no sobre la toma del
         catalogo: con \`contain\` el navegador ajusta el cuadro, no el producto,
         asi que la foto que trae mas aire alrededor rinde el producto mas
         chico aunque el panel mida lo mismo. Apoyadas en el borde de abajo,
         ademas: cada recorte tiene su propia proporcion y centradas quedan
         flotando a tres alturas distintas. Contra el piso comparten repisa. -->
    <img src="${fx.uri}" class="shot" style="object-fit:contain;
         object-position:${p.position || '50% 100%'}">
  </div>
  <div style="position:absolute;left:${left}px;top:${panelY + panelH + 20}px;width:${colW}px">
    <div class="rule" style="margin-bottom:14px"></div>
    <div style="font-size:19px;font-weight:400;color:${C.ink};line-height:1.25;min-height:48px">${p.name}</div>
    <div class="d" style="font-size:34px;font-weight:400;color:${C.rosa};margin-top:6px">${p.price}</div>
  </div>`;
    })
    .join('')}
  <div style="position:absolute;left:${m}px;right:${m}px;bottom:${tall ? 372 : 74}px;display:flex;
              justify-content:space-between;align-items:baseline">
    <span style="font-size:24px;font-weight:300;color:${C.body}">${a.creative.sub}</span>
    <span class="mono" style="font-size:15px;color:${C.muted}">${a.creative.footer}</span>
  </div>
</div>`;
};

// CF · Cifra: el precio a tamaño de titular. Los otros ocho lo dicen en letra
// chica al pie; acá el número es el anuncio. Para el final del embudo, donde
// quien mira ya vio el producto y lo único que le falta saber es cuánto cuesta.
const cifra = (a, ph, w, h) => {
  const tall = h === 1920;
  // La foto sangra hasta el borde de arriba tambien en 9:16. Los 250 px que tapa
  // Instagram limitan el texto y el logotipo, no la imagen: dejarlos en blanco
  // parte la pieza en dos con un canto recto de lado a lado, y se lee como si el
  // anuncio estuviera recortado. Todas las demas plantillas verticales sangran.
  const fotoH = tall ? 1190 : 852;
  const m = 76;
  return `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <div style="position:absolute;left:0;right:0;top:0;height:${fotoH}px;
              background:${ph.bg};overflow:hidden">
    <!-- A sangre, y por eso el encuadre lo fija el anuncio con \`position\`. Aca
         no sirve entrar contenida: el fondo de estas tomas no es un color plano
         sino un degradado de estudio, asi que las franjas del relleno se ven
         como una costura vertical contra la foto. Llenando la banda no hay
         relleno que se note — pero se recorta, y el recorte por defecto va al
         centro y le come la punta a lo que sea alto. De ahi que cada anuncio
         diga desde donde recortar. -->
    ${img(a, ph, true)}
    <!-- Solo lo justo para que el logotipo gris se lea: una elipse chica pegada
         a su esquina, no un velo sobre media foto. -->
    <div style="position:absolute;inset:0;pointer-events:none;
         background:${veloEsquina('7% 3%', rgb(C.fondo), .82, '46% 26%')}"></div>
    <!-- Arriba del todo, con el mismo margen en los dos formatos: si la foto
         sangra hasta el borde y el logotipo se queda 300 px mas abajo, queda
         flotando en el medio de la nada. Ojo con esto en historias — ahi
         Instagram monta la cabecera del perfil sobre los primeros 250 px y le
         pasa por encima. En feed vertical y en reels no lo tapa nada. -->
    <div style="position:absolute;top:${tall ? 64 : 56}px;left:${m}px">${logo(70)}</div>
  </div>
  <div style="position:absolute;left:${m}px;right:${m}px;top:${fotoH}px;
              bottom:${tall ? 372 : 0}px;
              display:flex;align-items:center;justify-content:space-between;gap:36px">
    <div>
      <span class="mono" style="font-size:15px;color:${C.rosa};display:block;margin-bottom:${tall ? 14 : 8}px">${a.creative.eyebrow}</span>
      <span class="d" style="font-size:${tall ? 176 : 148}px;color:${C.rosa};display:block;line-height:.82">${a.creative.price}</span>
    </div>
    <div style="text-align:right;padding-bottom:${tall ? 16 : 10}px;max-width:${tall ? 520 : 470}px">
      <h1 class="d" style="font-size:${a.creative.hlSize || (tall ? 62 : 52)}px">${a.creative.headline}</h1>
      <div class="rule" style="margin:${tall ? 20 : 16}px 0 0;margin-left:auto;width:150px"></div>
      <span class="mono" style="font-size:14px;color:${C.muted};display:block;margin-top:${tall ? 18 : 14}px">${a.creative.footer}</span>
    </div>
  </div>
</div>`;
};

/* ── tres formatos que llevan la dirección ───────────────────────────────
   Los doce de arriba venden el producto y se callan dónde está. En el feed el
   enlace vive en el pie del anuncio, fuera de la imagen; en un post orgánico
   de Instagram el pie ni siquiera es clicable. Si la pieza no dice la
   dirección, quien la quiere tiene que buscarla — y no la busca. */

// La dirección se arma con la ruta real del sitio: `/producto/:id` de
// app/src/App.tsx, con el `id` del catálogo. Ojo, no es la que traen los
// `landing` viejos de ads.json (`/producto.html?id=…`): esa lleva extensión,
// así que el servidor no la manda al fallback del React y responde 404.
const LINK_BASE = 'limaflores.pe/producto/';

// El catálogo, para comprobar los slugs. Un link mal escrito no se nota al
// mirar el JPEG —se ve perfecto— sino cuando alguien lo teclea y cae en la
// home. Se valida antes de rendir y el build revienta, que es la única forma
// de que no llegue impreso a un anuncio pagado.
const CATALOGO = new Set(
  JSON.parse(fs.readFileSync(path.join(ROOT, 'db/products.seed.json'), 'utf8')).map((p) => p.id),
);

// El único texto de la casa que NO usa `.mono`. El rótulo del sistema fuerza
// mayúsculas y la ruta sí distingue: el React resuelve /producto/:id
// comparando `p.id === id`, así que LIMAFLORES.PE/PRODUCTO/FLORERO-FORTI no
// abre nada. Va en minúsculas y el slug en peso 500, para que se lea de un
// vistazo dónde termina el dominio y empieza el producto.
const lineaLink = (a, onDark) => `<span
  style="font-family:'Jost',sans-serif;font-weight:300;text-transform:none;
         letter-spacing:.015em;font-size:${a.creative.linkSize || 25}px;
         color:${onDark ? 'rgba(255,255,255,.72)' : C.muted};white-space:nowrap"
  >${LINK_BASE}<span style="font-weight:500;color:${onDark ? '#fff' : C.ink}">${a.link}</span></span>`;

// EN · Enlace: foto a sangre y, al pie, el titular y la dirección tecleable.
// Es `puro` con una pregunta más: no «qué es esto» sino «dónde lo compro».
const enlace = (a, ph, w, h) => {
  const tall = h === 1920;
  const onDark = a.creative.tone === 'light';
  const fg = onDark ? '#fff' : C.ink;
  const mut = onDark ? 'rgba(255,255,255,.78)' : C.body;
  const m = 76;
  return `
<div style="position:absolute;inset:0;background:${ph.bg};overflow:hidden;--em:${onDark ? '#F0BFCB' : C.rosa}">
  ${img(a, ph)}
  <!-- El velo existe para que se lea el pie, y por eso llega justo hasta donde
       empieza el pie. A sangre por los tres lados que toca, sin canto propio. -->
  <div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(h * 0.56)}px;
       background:${velo('to top', onDark ? '10,7,6' : rgb(C.fondo), onDark ? .84 : .97)}"></div>
  <div style="position:absolute;top:${tall ? 272 : 64}px;left:${m}px">${logo(74, onDark)}</div>
  <!-- Rótulo, titular, bajada, filete y dirección en un mismo flujo anclado
       abajo: con la dirección anclada por su cuenta, un titular de tres líneas
       se le monta encima. -->
  <div style="position:absolute;left:${m}px;right:${m}px;bottom:${tall ? 372 : 74}px;color:${fg}">
    <span class="mono" style="display:block;font-size:17px;color:${onDark ? '#F0BFCB' : C.rosa}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || (tall ? 96 : 86)}px;margin-top:18px">${a.creative.headline}</h1>
    ${a.creative.sub
      ? `<p style="font-size:${tall ? 28 : 26}px;font-weight:300;line-height:1.4;color:${mut};
           margin-top:18px;max-width:${tall ? 860 : 800}px">${a.creative.sub}</p>`
      : ''}
    <div class="rule" style="margin-top:30px;background:${onDark ? 'rgba(255,255,255,.3)' : C.line}"></div>
    <div style="margin-top:24px;display:flex;justify-content:space-between;align-items:baseline;gap:26px">
      ${lineaLink(a, onDark)}
      <span class="d" style="font-size:44px;font-weight:400;color:${fg}">${a.creative.price}</span>
    </div>
  </div>
</div>`;
};

// FI · Ficha: los datos del producto como campos, con su rótulo y su valor.
// Las otras doce afirman una cosa; ésta afirma cuatro, y cada una se puede
// citar de `db/products.seed.json`. Para quien ya está decidiendo y lo que le
// falta es saber qué le llega exactamente. `split` también lista, pero son
// argumentos sobre un panel de tinta; acá son campos sobre la página.
const ficha = (a, ph, w, h) => {
  const m = 76;
  const fotoH = a.creative.fotoH || Math.round(h * 0.53);
  const filaY = a.creative.filaY || 13;
  const valorSize = a.creative.valorSize || 21;
  const pieBottom = h === 1920 ? 372 : 58;
  // La tabla cuelga de la foto y crece hacia abajo; el pie está anclado abajo.
  // Los dos flujos no se ven venir: con la banda a 640 en 1:1, «Una tacita de
  // expreso» le quedó montado encima a la dirección y el JPEG salió igual, sin
  // una queja. Se estima el alto acá y se avisa, que es cuando todavía se puede
  // quitar un campo o bajar la banda.
  const altoTabla = 30 + 18 + 12 + (a.creative.hlSize || 58)
    + (a.creative.tablaTop || 24)
    + a.creative.campos.length * (2 * filaY + Math.round(valorSize * 1.3) + 1);
  const pieTop = h - pieBottom - 46;
  if (fotoH + altoTabla > pieTop - 16) {
    console.warn(`  ! ${a.code}: la tabla llega a ${fotoH + altoTabla}px y el pie arranca en ${pieTop}px`
      + ` — se van a pisar. Baja \`fotoH\`, quita un campo o pasa la pieza a 4:5.`);
  }
  return `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <!-- La banda es mucho más ancha que alta, así que la foto entra a sangre con
       la toma original: contenida dejaría dos franjas de relleno a los lados. -->
  <div style="position:absolute;left:0;right:0;top:0;height:${fotoH}px;background:${ph.bg};overflow:hidden">
    ${img(a, ph, true)}
    <div style="position:absolute;inset:0;pointer-events:none;
         background:${veloEsquina('8% 5%', rgb(C.fondo), .82, '48% 34%')}"></div>
    <div style="position:absolute;top:${h === 1920 ? 64 : 46}px;left:${m}px">${logo(64)}</div>
  </div>
  <!-- Rótulo, nombre y tabla cuelgan del borde de la foto; el pie va anclado
       abajo. Los dos flujos no se tocan: la tabla crece hacia abajo y el pie
       está fijo, así que una fila de más se ve enseguida en el render. -->
  <div style="position:absolute;left:${m}px;right:${m}px;top:${fotoH + 30}px">
    <span class="mono" style="display:block;font-size:14px;color:${C.rosa}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || 58}px;margin-top:12px">${a.creative.headline}</h1>
    <div style="margin-top:${a.creative.tablaTop || 24}px;border-top:1px solid ${C.line}">
      ${a.creative.campos
        .map(
          ([k, v]) => `<div style="display:flex;justify-content:space-between;align-items:baseline;
             gap:28px;padding:${filaY}px 0;border-bottom:1px solid ${C.line}">
          <span class="mono" style="font-size:13px;color:${C.muted};flex:none">${k}</span>
          <span style="font-size:${valorSize}px;font-weight:300;line-height:1.3;
                color:${C.body};text-align:right">${v}</span></div>`,
        )
        .join('')}
    </div>
  </div>
  <div style="position:absolute;left:${m}px;right:${m}px;bottom:${pieBottom}px;
              display:flex;justify-content:space-between;align-items:baseline;gap:26px">
    ${lineaLink(a)}
    <span class="d" style="font-size:42px;font-weight:400">${a.creative.price}</span>
  </div>
</div>`;
};

// DO · Doble: dos tomas del mismo producto, lado a lado. `tira` pone tres
// productos distintos y contesta «cuál elijo»; ésta pone el mismo dos veces y
// contesta otra cosa — «cómo se ve de verdad», que es la duda que frena una
// compra por foto única. Casi todo el catálogo tiene segunda toma y ninguna
// plantilla la estaba usando.
const doble = (a, ph, w, h) => {
  const ph2 = foto(a.creative.foto2);
  // Los paneles son angostos —media pieza— así que mandan el alto: pasado cierto
  // punto una toma cuadrada ya no cabe y `cover` le come media caja. 0.56 del
  // lienzo es lo que aguanta un cuadrado entrando contenido sin letterbox feo.
  const panelH = a.creative.panelH || Math.round(h * (h === 1920 ? 0.53 : 0.56));
  const col = Math.floor(w / 2);
  const m = 78;
  // Repite la regla de `img()` en vez de llamarlo: `img()` lee el encuadre del
  // anuncio, y acá hay dos fotos con el suyo. Una recortada entra contenida
  // sobre su propio fondo medido; una intacta llena el panel.
  const panel = (p, fit, pos) => `<img src="${p.uri}" class="shot"
    style="object-fit:${p.recortada ? 'contain' : fit || 'cover'};object-position:${pos || '50% 50%'}">`;
  return `
<div style="position:absolute;inset:0;background:${C.fondo}">
  <!-- Las dos sangran hasta el borde de arriba. En 9:16 dejar los 250 px que
       tapa Instagram en blanco parte la pieza con un canto recto de lado a
       lado y se lee como si el anuncio estuviera cortado. -->
  <div style="position:absolute;left:0;top:0;width:${col}px;height:${panelH}px;
              background:${ph.bg};overflow:hidden">
    ${panel(ph, a.creative.fit, a.creative.position)}
  </div>
  <div style="position:absolute;left:${col}px;right:0;top:0;height:${panelH}px;
              background:${ph2.bg};overflow:hidden">
    ${panel(ph2, a.creative.fit2, a.creative.position2)}
  </div>
  <!-- El filete es la juntura, no un marco: un solo píxel, y sólo entre los dos
       paneles. Sin él, dos fondos de estudio casi iguales se funden y el
       díptico parece una foto sola mal encuadrada. -->
  <div style="position:absolute;left:${col}px;top:0;width:1px;height:${panelH}px;background:${C.line}"></div>
  <!-- El logotipo se apoya en el panel de estudio, que es el que tiene aire
       arriba. Abajo no cabe: el pie ya lleva filete, dirección, precio y rótulo. -->
  <div style="position:absolute;top:${a.creative.logoY || 40}px;left:${m - 18}px">${logo(62)}</div>
  <div style="position:absolute;left:${m}px;right:${m}px;bottom:${h === 1920 ? 372 : 56}px">
    <span class="mono" style="display:block;font-size:17px;color:${C.rosa}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || 78}px;margin-top:16px">${a.creative.headline}</h1>
    ${a.creative.sub
      ? `<p style="font-size:26px;font-weight:300;line-height:1.4;color:${C.body};
           margin-top:16px;max-width:900px">${a.creative.sub}</p>`
      : ''}
    <div class="rule" style="margin-top:26px"></div>
    <div style="margin-top:22px;display:flex;justify-content:space-between;align-items:center;gap:24px">
      ${lineaLink(a)}
      <span class="d" style="font-size:42px;font-weight:400">${a.creative.price}</span>
    </div>
    <span class="mono" style="display:block;margin-top:20px;font-size:14px;color:${C.muted}">${a.creative.footer}</span>
  </div>
</div>`;
};

const TEMPLATES = { editorial, split, quote, story, puro, sello, cuadro, titular, postal,
  vitrina, tira, cifra, enlace, ficha, doble };
const FORMATS = { '4:5': [1080, 1350], '1:1': [1080, 1080], '9:16': [1080, 1920] };

/* ──────────────────────────────  render  ─────────────────────────────── */

// Regla 1 de la casa —el producto entero— comprobada por el navegador y no de
// memoria. `cover` recorta por definición. Está bien cuando el encuadre ES la
// foto (un macro, una toma de ambiente) y está mal cuando la foto es un objeto
// sobre ciclorama: ahí `cover` le come un pedazo al producto y el JPEG sale
// impecable igual. Fue IG-25, con la maceta cortada al ras de la ventana.
//
// Cuánto recorta no se puede adivinar desde Node: depende de la caja que le da
// la plantilla, y esa solo la sabe el navegador. Así que lo mide él, con la
// misma pieza que se va a fotografiar — la sonda viaja en `base()` y el número
// sale por el título, en la misma pasada del `--screenshot`. Gratis.
const TOLERA = 0.04;   // hasta un 4% es aire del ciclorama, no producto

function recorteDe(dom) {
  const m = dom.match(/<title>RECORTE(\[.*?\])<\/title>/s);
  if (!m) return null;                       // sin sonda: no se inventa un veredicto
  try { return JSON.parse(m[1]); } catch { return null; }
}

/**
 * Anota la pieza si recorta el producto sin haberlo declarado. No revienta en el
 * acto: se juntan todas y se revientan juntas al final. Un anuncio por corrida
 * son diez corridas para enterarse de diez problemas, y además el JPEG ya está
 * en disco, que es justamente lo que hay que mirar para decidir cada caso.
 */
function revisaRecorte(ad, dom, sinDeclarar) {
  const partes = recorteDe(dom);
  if (!partes) return;
  const mal = partes.find((p) => p.alas && p.alas !== p.hueco);
  if (mal) {
    throw new Error(mal.hueco
      ? `${ad.code}: las alas están declaradas ${mal.alas === 'h' ? 'a los costados' : 'arriba y abajo'} `
        + `y el hueco del contain quedó ${mal.hueco === 'h' ? 'a los costados' : 'arriba y abajo'}.\n`
        + `  Así se ven partidas por el medio. Pon "alas": ${mal.hueco === 'v' ? '"v"' : 'true'} en su creative.`
      : `${ad.code}: la foto llena la ventana justa (${mal.caja.join('×')}), así que el contain no deja hueco.\n`
        + '  Las alas no pintan nada: quítalas.');
  }
  const peor = partes.reduce((a, p) => Math.max(a, p.x, p.y), 0);
  if (peor <= TOLERA) return;
  const pct = Math.round(peor * 100);
  if (ad.creative.recorte) console.log(`      recorta ${pct}% a propósito — ${ad.creative.recorte}`);
  else {
    const p = partes.find((q) => Math.max(q.x, q.y) === peor);
    sinDeclarar.push(`${ad.code} · ${ad.photo} ${p.foto.join('×')} en ventana ${p.caja.join('×')} · se come el ${pct}%`);
  }
}

function reventaRecortes(sinDeclarar) {
  if (!sinDeclarar.length) return;
  throw new Error(
    `El cover se come un pedazo de estas piezas y el producto puede salir cortado:\n`
    + sinDeclarar.map((x) => `  ${x}`).join('\n')
    + '\n\nDos salidas, una por pieza:\n'
    + '  · Foto de un objeto sobre ciclorama → "fit": "contain" en su creative. La ventana ya\n'
    + '    está pintada del color medido del fondo, así que no se ve ninguna costura.\n'
    + '  · Recorte a propósito (un macro, una toma de ambiente) → el motivo en creative.recorte.\n'
    + 'Los JPEG quedaron escritos: míralos antes de decidir cuál es cuál.',
  );
}

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
  L.push('python3 marketing/ig-ads/galeria.py # rearma galeria.html');
  L.push('```');
  L.push('');
  L.push('La galería lleva también el carril de video (`marketing/video/`, `videos.json`). El MP4');
  L.push('es lo único que no va embebido: son 7 MB que en base64 se vuelven 10 y habría que bajarlos');
  L.push('enteros antes de ver la primera pieza. Va por su propia URL —`/galeria/VID-01.mp4`, que');
  L.push('`server.js` sirve con soporte de Range porque sin eso iOS no reproduce— así que ese');
  L.push('archivo tiene que estar desplegado junto a la página.');
  L.push('');
  L.push('La galería se sirve en **`limaflores.pe/galeria`** — una URL que se puede mandar,');
  L.push('sin login. Va con `noindex`, así que no la encuentra Google: es para compartirla,');
  L.push('no para posicionarla. La sirve `server.js` leyendo `galeria.html` tal cual, así que');
  L.push('para actualizarla hay que rearmarla con `galeria.py` y volver a desplegar.');
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
  L.push('## De dónde sale cada dato');
  L.push('');
  L.push('Todo lo que afirma el copy sale de una de estas tres fuentes. Nada es de conocimiento');
  L.push('general ni supuesto.');
  L.push('');
  L.push('| Afirmación | Fuente | Texto de origen |');
  L.push('| --- | --- | --- |');
  L.push('| «Eliges el día y la hora» | `app/src/pages/Checkout.tsx` | la fecha mínima es mañana (`minDate = hoy + 1`); las franjas salen de `app/src/lib/delivery.ts` |');
  L.push('| «Entrega en Lima Metropolitana» | landing | «entrega a domicilio dentro de Lima Metropolitana» |');
  L.push('| «Flores frescas los lunes, miércoles y viernes» | landing | «recibe flores frescas los lunes, miércoles y viernes» |');
  L.push('| «Si algo se acaba, te avisamos en menos de una hora» | landing | textual |');
  L.push('| «No vendemos flores. Vendemos pequeños momentos de calma» | landing | textual (manifiesto) |');
  L.push('| «Armado a mano» · «Atelier de Miraflores desde 2017» | landing | «Cada arreglo lo armamos nosotros, a mano» · «Atelier desde 2017» |');
  L.push('| Reseña de Diego V. (IG-05) | landing · reseñas verificadas 2025 | textual, recortada — ver abajo |');
  L.push('| Florero de vidrio, tarjeta, colores, 30×50 cm, composición floral | `db/products.seed.json` | descripción de cada producto |');
  L.push('| Reseña de Camila R. (IG-21) | landing · reseñas verificadas 2025 | textual |');
  L.push('| «Prohibida la venta a menores. Tomar bebidas alcohólicas en exceso es dañino» (IG-28) | `db/products.seed.json` | textual, de la ficha del Box Yani |');
  L.push('');
  L.push('### Piezas retiradas');
  L.push('');
  L.push('IG-01 a IG-04 se retiraron a pedido. Los códigos **no se renumeraron**, para que las');
  L.push('referencias ya usadas sigan valiendo: la numeración empieza en IG-05. Con IG-04 se fue la');
  L.push('única afirmación que quedaba pendiente de confirmar («8 a 12 semanas»), así que hoy todo el');
  L.push('copy sale de una fuente del proyecto, sin extrapolaciones.');
  L.push('');
  L.push('El «Florero con tulipanes lilas» salió del deck porque sus tres piezas eran IG-01 a IG-03.');
  L.push('Los archivos siguen en el historial de git si hicieran falta.');
  L.push('');
  L.push('### Cumplimiento: IG-28 lleva alcohol');
  L.push('');
  L.push('El Box Yani incluye una botella de Riccadona de 200 ml, así que ese anuncio cae en la categoría');
  L.push('de alcohol de Meta: necesita segmentación de edad **+18** en el conjunto de anuncios y lleva la');
  L.push('advertencia legal en el texto. Sin la restricción de edad, Meta lo rechaza.');
  L.push('');
  L.push('### Hallazgos del catálogo');
  L.push('');
  L.push('Tres cosas que aparecieron al elegir los productos y conviene arreglar en `db/products.seed.json`:');
  L.push('');
  L.push('- **`box-lupita`** — la descripción dice «Box blanco con 12 rosas amarillas y 12 rosas lilas»,');
  L.push('  pero la foto muestra un balde de zinc con rosas amarillas e hortensias blancas y verdes. La');
  L.push('  descripción parece copiada de `box-simona`. Quedó fuera del set por eso.');
  L.push('- **`14536` (Arreglo Florencia)** — su única imagen no es una foto de producto: es una pieza');
  L.push('  gráfica con el nombre, la descripción y el precio ya impresos. No sirve para un creativo.');
  L.push('- **`box-chococafe`** — la descripción menciona «toques azules» que no se ven en la foto. El copy');
  L.push('  del anuncio los omite.');
  L.push('');
  L.push('- **Catálogo agotado a esta resolución.** Con estos 23 productos se acabaron los que tienen');
  L.push('  foto de 1000 px o más. Los que quedan son de 500×500: en un lienzo de 1080 se ven blandos,');
  L.push('  así que no entraron. Si el taller sube fotos más grandes, la campaña puede seguir creciendo.');
  L.push('');
  L.push('Los cinco productos de la categoría Fúnebre siguen sin foto en el repositorio, así que ninguno');
  L.push('puede entrar a la campaña.');
  L.push('');
  L.push('### Qué se quitó y por qué');
  L.push('');
  L.push('- **Entrega el mismo día.** Estaba en seis piezas. La landing dice «Te las llevamos hoy», pero');
  L.push('  el checkout exige 24 horas de anticipación: manda el código, no la landing. Reemplazado por');
  L.push('  «eliges el día y la hora», que además es un argumento más fuerte y es verdad.');
  L.push('- **«Tarjeta escrita a mano».** El catálogo dice «tarjeta de dedicatoria». Lo de escrita a mano');
  L.push('  lo había agregado yo.');
  L.push('- **«Los tulipanes siguen creciendo dentro del florero».** Era el gancho de IG-14 y no salía de');
  L.push('  ninguna fuente del proyecto: es cierto en botánica, pero no es un dato del negocio. La pieza');
  L.push('  ahora usa el manifiesto de la landing.');
  L.push('- **«Foto tomada con un celular, sin retoque, en la casa a la que llegó»** (IG-16). Yo no sé');
  L.push('  cómo se tomó esa foto. El copy ahora solo describe lo que se ve: un ramo en una sala.');
  L.push('- **Cifras de duración** («un ramo dura 8 días», «los tulipanes duran una semana»). Eran mías.');
  L.push('- **La mitad de la reseña de Diego V.** («Pedí a las 11 am, llegaron a las 5:30 pm»). Es textual');
  L.push('  del sitio, pero promete entrega el mismo día. Se cita solo la parte de la duración.');
  L.push('');
  L.push('Meta pide poder respaldar los testimonios: conviene tener a mano de dónde salió la reseña de');
  L.push('Diego V. antes de publicar IG-05.');
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
  L.push('| `split` | Panel claro con la lista de entregables + foto a sangre. | Desarmar objeciones de precio: convierte el ticket en una lista. |');
  L.push('| `quote` | Cita grande arriba, foto abajo. | Prueba social o manifiesto de marca. |');
  L.push('| `story` | Banda de foto arriba, texto y botón en zona segura. | Historias de retargeting con llamada a la acción. |');
  L.push('');
  L.push('### Tres más, todavía en prueba');
  L.push('');
  L.push('`vitrina` (la foto dentro de un arco), `tira` (tres productos con su precio, apoyados en');
  L.push('la misma repisa) y `cifra` (el precio a tamaño de titular). Viven en un carril aparte,');
  L.push('`pruebas.json`, y se rinden en `pruebas/` sin tocar la campaña:');
  L.push('');
  L.push('```');
  L.push('python3 marketing/ig-ads/fotos/prep-tira.py  # recortes al ras para las tiras');
  L.push('node marketing/ig-ads/build.mjs --pruebas    # dos piezas de cada formato nuevo');
  L.push('python3 marketing/ig-ads/pruebas.py          # la hoja para decidir cuáles entran');
  L.push('```');
  L.push('');
  L.push('**La tira pide fotos parejas, y ahí el catálogo aprieta.** Las tres se ven juntas, así que');
  L.push('cualquier diferencia entre las tomas salta: la que no tenía recorte llenaba el panel y');
  L.push('salía cortada al lado de dos contenidas, y la tomada sobre el gris de estudio aparecía');
  L.push('como un recuadro gris al lado de dos sobre blanco. Lo primero se arregla en la maqueta —');
  L.push('todas contenidas, sobre el recorte al ras de `prep-tira.py`, porque `contain` ajusta el');
  L.push('cuadro y no el producto, y la foto con más aire alrededor rinde el producto más chico. Lo');
  L.push('segundo no: un fondo ya quemado en el JPEG no se empareja con relleno. El generador avisa');
  L.push('cuando las luminancias se separan más de 12, que es cuando todavía se puede cambiar el');
  L.push('producto. Consecuencia: hoy no hay tira posible de tres **ramos** — solo dos están');
  L.push('fotografiados sobre blanco.');
  L.push('');
  L.push('**`cifra` recorta a propósito.** Su banda es más ancha que alta, así que la foto entra a');
  L.push('sangre: contenida dejaría dos franjas de relleno que contra el degradado del ciclorama se');
  L.push('ven como una costura vertical. Al ir a sangre hay que decidir por dónde recortar, y eso lo');
  L.push('dice cada anuncio con `position`. Sin eso el recorte cae al centro y le come la punta a');
  L.push('todo lo que sea alto — le pasó a la orquídea de dos varas.');
  L.push('');
  L.push('Cuando uno se apruebe, pasa a `ads.json` con su copy, su objetivo y su público, igual que');
  L.push('los otros nueve, y desde ahí entra a la galería de la campaña.');
  L.push('');
  L.push('### Los velos no llevan canto');
  L.push('');
  L.push('Un `linear-gradient(color, transparent)` tiene la derivada rota justo donde arranca: la');
  L.push('opacidad cae en línea recta y de golpe deja de caer, y el ojo lee esa esquina de la curva');
  L.push('como el borde de un recuadro aunque no haya recuadro. Sobre foto clara se ve peor todavía,');
  L.push('porque el velo blanco no aclara nada y lo único que queda visible es su propio borde: eso');
  L.push('era el rectángulo con fade de IG-22 y IG-30. Los velos van por `velo()` y `veloEsquina()`,');
  L.push('que aproximan una smoothstep y siempre llegan a sangre, así que el único borde recto que');
  L.push('existe es el del lienzo.');
  L.push('');
  L.push('De paso apareció otro: el marfil `251,248,241` del velo de las citas era de la paleta');
  L.push('anterior y sobrevivió al paso a blanco total, así que al pie de IG-05, IG-08 e IG-19 había');
  L.push('una banda amarillenta. Ahora el velo saca su color del token, no de un rgb escrito a mano.');
  L.push('');
  L.push('### El producto entero lo comprueba el navegador');
  L.push('');
  L.push('`cover` recorta por definición. Está bien cuando el encuadre ES la foto —un macro, una');
  L.push('toma de ambiente— y está mal cuando la foto es un objeto sobre ciclorama: ahí se come un');
  L.push('pedazo del producto y el JPEG sale impecable igual. Se fue así IG-25, con la maceta');
  L.push('cortada al ras de la ventana, y con ella catorce piezas más que nadie había mirado de');
  L.push('cerca: la base del ramo, el filo de la caja, el borde del florero.');
  L.push('');
  L.push('Cuánto recorta no se puede adivinar desde Node, porque depende de la caja que le da la');
  L.push('plantilla. Así que lo mide el navegador, con la misma pieza que se va a fotografiar: una');
  L.push('sonda en `base()` compara el tamaño natural de la foto contra su caja y deja el número en');
  L.push('el título, que vuelve por `--dump-dom` en la misma corrida del `--screenshot`. Sale gratis.');
  L.push('Pasado el 4%, el build **revienta** y nombra las piezas. Dos salidas, una por pieza:');
  L.push('');
  L.push('- **`"fit": "contain"`** si la foto es un objeto sobre fondo. Entra entera.');
  L.push('- **`creative.recorte`** con el motivo, si el recorte es a propósito. Queda escrito en el');
  L.push('  anuncio, que es donde se puede volver a leer dentro de seis meses.');
  L.push('');
  L.push('**Las alas.** Un `contain` deja dos franjas vacías a los lados, y pintarlas del color');
  L.push('medido no alcanza: el ciclorama de estas tomas es un degradado, así que contra un relleno');
  L.push('plano el filo de la foto se ve como el recuadro que prohíbe la regla 2 — en IG-25 el salto');
  L.push('era de 18 niveles en el lado derecho. Con `"alas": true` el relleno sale de la propia foto:');
  L.push('cada ala estira su franja de borde, el degradado sigue fila por fila y la unión no existe.');
  L.push('Es el mismo hallazgo que `marketing/whatsapp/cabeceras.py`.');
  L.push('');
  L.push('Hay que decir por dónde queda el hueco, porque cada ala estira un borde distinto:');
  L.push('`"alas": true` para los costados y `"alas": "v"` para arriba y abajo, que es el caso de');
  L.push('IG-26 — ahí el hueco se leía como una franja blanca al tope. No se puede adivinar desde');
  L.push('Node, porque depende de la caja que da la plantilla, pero tampoco queda a la buena fe: la');
  L.push('sonda compara lo declarado contra lo que midió el navegador y revienta el build si no');
  L.push('coinciden. El `contain` de las fotos ya recortadas no lleva alas y no le hacen falta:');
  L.push('`prep-fotos.py` deja el borde de la foto en el mismo color que midió.');
  L.push('');
  L.push('**Y `sangra`, para cuando el borde de la foto no es fondo.** `tulipanes-de-amor` termina');
  L.push('en la mesa: al entrar entera, ese degradado caía justo contra el relleno de abajo y se');
  L.push('leía como una línea recta cruzando la pieza, detrás del titular de IG-13. `"sangra": 4`');
  L.push('recorta un 4% por lado *después* de encajar la foto — se lleva la mesa y no toca el ramo,');
  L.push('que empieza al 6% de la altura. Vale para la foto y para las alas, así que las dos siguen');
  L.push('mostrando el mismo borde.');
  L.push('');
  L.push('### El mejor velo es el que no está');
  L.push('');
  L.push('La otra mitad de la regla: un velo existe para que se lea un texto encima. Si debajo no');
  L.push('hay texto, no está protegiendo nada — está tapando el producto. `cuadro` arrastraba un');
  L.push('velo radial en la esquina superior derecha que cubría media pieza, y en las tres tomas que');
  L.push('usan la plantilla esa esquina ya era fondo de estudio: no aclaraba nada y sí lavaba el');
  L.push('globo morado de IG-30 y el respaldo del sofá de IG-16. Se fue entero.');
  L.push('');
  L.push('Sin velo, el texto ya no puede caer siempre en el mismo sitio, así que dónde cae pasó a');
  L.push('ser un dato del anuncio (`zona`) y se decide midiendo la foto ya encuadrada, no a ojo:');
  L.push('');
  L.push('| Anuncio | Dónde va el texto | Lo que dice la foto |');
  L.push('| --- | --- | --- |');
  L.push('| `IG-22` | columna derecha (por defecto) | el 5% más oscuro de esa caja está en 231 de luminancia: fondo de estudio puro |');
  L.push('| `IG-30` | columna derecha | 174; el globo pasa por debajo del bloque, no por dentro |');
  L.push('| `IG-16` | franja al tope (`zona: banda`) | a la derecha está el brazo de madera de la silla, en 68 — casi negro. El único vacío es el respaldo del sofá: ancho y bajo, así que el bloque se acuesta en una línea |');
  L.push('| `IG-11` | columna abajo a la izquierda (`zona: izq`, en `sello`) | centrada no había vacío; al ras izquierdo aparece uno de 585 × 225 en 239 uniforme |');
  L.push('');
  L.push('IG-11 era el caso extremo: el velo tapaba el 62% de la pieza para sostener un titular a');
  L.push('todo el ancho, y de paso dejaba las rosas de abajo detrás de una niebla. Cambiando el');
  L.push('encuadre a `0% 50%` el titular cabe entero sobre el fondo del estudio y ninguna flor queda');
  L.push('debajo de nada. El velo de `sello` sigue existiendo para IG-23 e IG-34, donde bajo el');
  L.push('titular hay maceta y caja y sí hace falta.');
  L.push('');
  L.push('En IG-16 el logotipo queda sobre tela y no sobre blanco. Es lo mejor que da la toma: la');
  L.push('mancha más clara y más plana de esa franja está justo ahí (media 227), medida barriendo');
  L.push('la franja entera con una caja del tamaño del grupo.');
  L.push('');
  L.push('Para agregar un anuncio basta con otra entrada en `ads.json`: la plantilla, la foto del');
  L.push('catálogo y el encuadre (`fit`, `position`). El formato sale del campo `format` —');
  L.push('`4:5`, `1:1` o `9:16`.');
  L.push('');
  L.push('## Notas de producción');
  L.push('');
  // La frase de las fotos sale de los datos y no cableada: la regla de la casa es
  // que la foto de producto no se genera con IA, pero el cliente puede pedirlo. Si
  // alguna pieza lleva `generada: true`, el README lo dice con nombre y apellido
  // en vez de afirmar en falso que no hay ninguna.
  const generadas = ads.filter((a) => a.generada).map((a) => a.code);
  L.push(generadas.length
    ? `- Fotos: las del catálogo (\`app/public/products/\`), salvo ${generadas.length === 1 ? 'la de' : 'las de'} ${generadas.join(', ')}, generada${generadas.length === 1 ? '' : 's'} con IA a pedido del cliente.`
    : '- Fotos: las del catálogo (`app/public/products/`). No se generó ninguna imagen con IA.');
  L.push('- Encuadre: `fotos/prep-fotos.py` detecta el fondo de cada toma y el recuadro que ocupa el');
  L.push('  producto, y guarda una versión recortada a ese recuadro. El generador la mete con `contain`');
  L.push('  sobre un contenedor pintado del mismo color de fondo, así el producto entra completo, ocupa');
  L.push('  lo más posible y no se ve ninguna costura. Un recorte que conserva más del 85% del área se');
  L.push('  descarta: no daba aire y sí cambiaba el encuadre. Las franjas mucho más anchas que altas');
  L.push('  (`titular`, `quote`) usan la toma original a sangre, porque ahí un recorte vertical entraría');
  L.push('  contenido y se vería diminuto.');
  L.push('- Tipografías y paleta: **no se eligen acá**. Se leen del sistema de diseño Florencia');
  L.push('  (`design/direcciones/florencia.css`), que a su vez saca sus colores de medir el ramo del');
  L.push('  logotipo. Hoy: blanco total `#FFFFFF`, tinta cálida `#2A2623`, rosa `#9E2B5E`, y');
  L.push('  Cormorant Garamond en itálica 500 para los titulares con Jost para todo lo demás. Si el');
  L.push('  sistema cambia, los 32 creativos cambian con él sin tocar `build.mjs`.');
  L.push('- Marca: el logo original de la página (`app/public/assets/logo.png`) va en los 18 creativos.');
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
  const campana = JSON.parse(fs.readFileSync(path.join(HERE, 'ads.json'), 'utf8'));
  // `node build.mjs IG-22 IG-30` rehace solo esas. Sirve para mirar un cambio de
  // plantilla sin esperar los 32 renders; el README solo se reescribe cuando se
  // rehace la campaña entera, para que no quede describiendo media galería.
  const solo = process.argv.slice(2).filter((x) => x !== '--pruebas');
  // `--pruebas` rinde `pruebas.json` en `pruebas/`: es el banco donde se mira un
  // formato nuevo antes de que exista un solo anuncio con él. No toca la
  // campaña ni el README, así que se puede probar sin comprometer nada.
  const banco = process.argv.includes('--pruebas');
  const data = banco ? JSON.parse(fs.readFileSync(path.join(HERE, 'pruebas.json'), 'utf8')) : campana;
  const salida = banco ? path.join(HERE, 'pruebas') : OUT;
  const ads = solo.length ? data.ads.filter((a) => solo.includes(a.code)) : data.ads;
  if (solo.length && !ads.length) throw new Error(`no existe ninguna de: ${solo.join(', ')}`);

  // Las plantillas que imprimen la dirección la sacan de `link`, y un slug que
  // no existe se ve perfecto en el JPEG: no falla hasta que alguien lo teclea.
  // Se comprueba contra el catálogo antes de rendir nada.
  for (const ad of ads) {
    const pide = ['enlace', 'ficha', 'doble'].includes(ad.template);
    if (pide && !ad.link) throw new Error(`${ad.code}: la plantilla \`${ad.template}\` imprime la dirección y falta \`link\``);
    if (ad.link && !CATALOGO.has(ad.link)) {
      throw new Error(`${ad.code}: /producto/${ad.link} no existe en db/products.seed.json`);
    }
  }
  const chrome = findChromium();
  const fonts = await fontCss();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-ads-'));
  const sinDeclarar = [];
  fs.mkdirSync(salida, { recursive: true });

  for (const ad of ads) {
    const [w, h] = FORMATS[ad.format || (ad.template === 'story' ? '9:16' : '4:5')];
    const html = path.join(tmp, `${ad.code}.html`);
    const png = path.join(tmp, `${ad.code}.png`);
    const jpg = path.join(salida, `${ad.code}.jpg`);

    fs.writeFileSync(html, base(fonts, w, h, TEMPLATES[ad.template](ad, foto(ad.photo), w, h)));
    // `--screenshot` y `--dump-dom` conviven en la misma corrida: el PNG se
    // escribe igual y de yapa vuelve el DOM con la medida de la sonda.
    const dom = execFileSync(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--virtual-time-budget=8000',
      `--window-size=${w},${h + 200}`, `--screenshot=${png}`, '--dump-dom', `file://${html}`,
    ], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    revisaRecorte(ad, dom, sinDeclarar);

    let final = jpg;
    if (!toJpeg(chrome, png, jpg, tmp, w, h)) {
      final = path.join(salida, `${ad.code}.png`);
      fs.copyFileSync(png, final);
      console.warn(`  ! ${ad.code}: no pude reencodear a JPEG, dejo el PNG.`);
    }
    const kb = Math.round(fs.statSync(final).size / 1024);
    console.log(`  ✓ ${ad.code}  ${w}×${h}  ${path.basename(final)}  ${kb} KB  — ${ad.title}`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  reventaRecortes(sinDeclarar);
  if (!solo.length && !banco) writeDeck(data);
  console.log(`\n${ads.length} creativos en ${path.relative(ROOT, salida)}/`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
