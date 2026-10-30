#!/usr/bin/env node
// Arma los anuncios en video a partir de marketing/video/videos.json.
//
//   node marketing/video/build.mjs            # todos
//   node marketing/video/build.mjs VID-01     # solo ese
//
// Mismo criterio que los creativos fijos (marketing/ig-ads/build.mjs): la toma
// manda, el diseño va encima y nada se inventa. Lo que cambia es cómo se pinta
// el texto — ffmpeg no sabe de Cormorant en itálica, así que los rótulos se
// dibujan en HTML con Chromium, se guardan como PNG transparente y se superponen.
//
// Dependencias: un Chromium en el sistema (CHROME_PATH si no lo encuentra),
// ffmpeg en el PATH y numpy para la música (`python3 marketing/video/musica.py`).

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ADS = path.join(ROOT, 'marketing/ig-ads');
const OUT = path.join(HERE, 'creativos');
const TMP = path.join(HERE, '.tmp');

const W = 1080;
const H = 1920;
const SEGURO = 372;      // lo que tapa la UI de Instagram arriba y abajo — 9:16
const CIERRE = 2.6;      // segundos de la placa final, si el video no pide otro

/* ── el sistema, leído del CSS como en los creativos fijos ── */
const TOKENS = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, 'design/direcciones/florencia.css'), 'utf8')
    .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]),
);
const C = {
  fondo: TOKENS['--bg-page'], ink: TOKENS['--text-strong'],
  body: TOKENS['--text-body'], muted: TOKENS['--text-muted'], rosa: TOKENS['--accent'],
};

/* ── velos ────────────────────────────────────────────────────────────────
   La misma smoothstep que `marketing/ig-ads/build.mjs`, y por la misma razón:
   un tramo lineal tiene la derivada rota en sus dos puntas, y el ojo lee esa
   esquina como el borde de un recuadro aunque no haya recuadro. En el video se
   nota todavía más, porque la toma de abajo se mueve y la línea se queda quieta.

   Se paga dos veces en la misma banda: donde el blanco sólido empieza a caer y
   donde la caída se corta. Esta última tiene que llegar a alfa 0 exacta — un
   velo que termina en .2 deja una raya recta cruzando el anuncio. */
const PASOS = [[0, 1], [12, .972], [24, .896], [36, .776], [48, .62], [60, .448],
  [72, .28], [82, .152], [91, .06], [100, 0]];

// Ojo con la subida: `1 - a` ya da la curva al revés, así que las paradas salen
// en orden ascendente y NO hay que darles la vuelta. Volteándolas, las
// posiciones quedan decrecientes, CSS las aplasta todas contra la última y el
// velo aparece de golpe — 237 niveles en un píxel, justo lo que se venía a
// arreglar. Lo cazó la medición del alfa, no el ojo.
/** Subida de 0 a `alfa` en `largo` px desde el borde de arriba de la caja. */
const sube = (largo, alfa) => PASOS
  .map(([p, a]) => `rgba(255,255,255,${((1 - a) * alfa).toFixed(3)}) ${(p * largo / 100).toFixed(1)}px`)
  .join(',');

/** Bajada de `alfa` a 0 en los últimos `largo` px de la caja. */
const baja = (largo, alfa) => PASOS
  .map(([p, a]) => `rgba(255,255,255,${(a * alfa).toFixed(3)}) calc(100% - ${(largo - p * largo / 100).toFixed(1)}px)`)
  .join(',');

const MARCA = Object.fromEntries(['logo', 'logo-claro'].map((n) => [
  n, `data:image/png;base64,${fs.readFileSync(path.join(ADS, 'marca', `${n}.png`)).toString('base64')}`,
]));

// Las fuentes van embebidas: el render no debe depender de la red. Se reusan las
// que ya sirve el sitio (app/public/fonts), que son las mismas del sistema.
const FUENTES = fs.readdirSync(path.join(ROOT, 'app/public/fonts'))
  .filter((f) => f.endsWith('.woff2'))
  .map((f) => {
    const [fam, peso] = [f.startsWith('cormorant') ? 'Cormorant Garamond' : 'Jost', f.match(/-(\d+)i?\./)[1]];
    const italica = f.includes('i.woff2');
    const b64 = fs.readFileSync(path.join(ROOT, 'app/public/fonts', f)).toString('base64');
    return `@font-face{font-family:'${fam}';font-style:${italica ? 'italic' : 'normal'};font-weight:${peso};`
      + `src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');

function chromium() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  for (const base of ['/opt/pw-browsers', path.join(os.homedir(), '.cache/ms-playwright')]) {
    if (!fs.existsSync(base)) continue;
    for (const dir of ['', ...fs.readdirSync(base)]) {
      for (const rel of ['chromium', 'chrome-linux/chrome', 'chrome-linux64/chrome']) {
        const p = path.join(base, dir, rel);
        if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
      }
    }
  }
  for (const bin of ['chromium', 'google-chrome', 'chromium-browser']) {
    try { return execFileSync('which', [bin], { encoding: 'utf8' }).trim(); } catch { /* seguimos */ }
  }
  throw new Error('No encontré Chromium. Exporta CHROME_PATH=/ruta/al/chrome');
}

// Todo el dibujo vive dentro de `#lienzo`, una caja de 1080×1920 posicionada:
// así `bottom:0` es el borde del video y no el del viewport de Chromium, que
// llega más corto que el `--window-size` que se pide. Anclado al viewport, el
// velo de abajo terminaba 105 px antes del filo y quedaba una franja de video
// crudo debajo, con un corte recto. Se ve horrible y no se puede repetir.
const pagina = (cuerpo, fondo) => `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
${FUENTES}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
body{font-family:'Jost',sans-serif;-webkit-font-smoothing:antialiased}
#lienzo{position:absolute;top:0;left:0;width:${W}px;height:${H}px;background:${fondo};overflow:hidden}
.d{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;letter-spacing:-.018em;line-height:1.03;color:${C.ink}}
.d em{font-style:italic;color:${C.rosa}}
.mono{font-weight:500;letter-spacing:.2em;text-transform:uppercase}
</style></head><body><div id="lienzo">${cuerpo}</div></body></html>`;

// Rótulo sobre el video: logo arriba y el bloque de texto abajo, los dos dentro
// del área segura. El texto se apoya en un velo que sube desde el borde — una
// tarjeta con borde acá se ve como un banner pegado encima de la toma.
const rotulo = (v) => pagina(`
<!-- Arriba no va ningún velo. Había uno para que el logotipo se apoyara en un
     campo limpio y era exactamente la banda inventada que la regla del logotipo
     prohíbe: no cubría texto, solo tapaba el producto. El logotipo va directo
     sobre la toma, y para eso se sostiene solo. -->
<div style="position:absolute;top:${SEGURO}px;left:76px">
  <img src="${MARCA[v.tono === 'claro' ? 'logo-claro' : 'logo']}" style="height:84px;display:block">
</div>
<!-- El velo es una banda pegada al texto, no un degradado que sube desde el filo.
     Cubriendo desde abajo pasaba una de dos: flojo, los pétalos se veían por
     detrás de las letras; fuerte, se tragaba la caja del arreglo y abajo solo
     quedaban las flores. Atado al bloque de texto tapa lo que tiene que tapar
     —las dos líneas— y suelta lo de abajo: la base de la caja y el banco vuelven
     a verse. Va dentro del contenedor del texto para que crezca con la copia y
     no haya que recalcular píxeles si el titular pasa a dos líneas.

     Las dos puntas van por smoothstep y la de abajo muere en alfa 0. Con tramos
     lineales se veían dos rayas rectas cruzando el anuncio: una donde el blanco
     dejaba de ser sólido y otra donde el velo se cortaba, que terminaba en .2 y
     de ahí saltaba a nada. La zona sólida no se mueve — sigue empezando y
     terminando donde estaba, lo único que cambia es la forma de las caídas. -->
<div style="position:absolute;left:0;right:0;bottom:${SEGURO}px">
  <div style="position:absolute;left:0;right:0;top:-150px;bottom:-170px;
       background:linear-gradient(to bottom,${sube(150, .93)},
         rgba(255,255,255,.93) 150px,
         rgba(255,255,255,.93) calc(100% - 170px),${baja(170, .93)})"></div>
  <div style="position:relative;padding:0 76px">
    <h1 class="d" style="font-size:${v.hlSize || 92}px">${v.headline}</h1>
    ${v.sub ? `<p style="font-size:30px;font-weight:300;line-height:1.4;color:${C.body};margin-top:22px">${v.sub}</p>` : ''}
    <div style="margin-top:28px;display:flex;align-items:baseline;gap:22px">
      <span class="d" style="font-size:46px;font-weight:400">${v.price}</span>
      <span class="mono" style="font-size:16px;color:${C.muted}">${v.footer}</span>
    </div>
  </div>
</div>`, 'transparent');

// Rótulo arriba, para los videos armados con fotos (`fotos` en videos.json).
// Ahí la foto va a todo el ancho y el ramo ocupa casi todo su alto: no queda
// ninguna franja abajo donde apoyar texto sin taparlo, y una banda blanca encima
// del ramo es justo lo que la regla del producto prohíbe. Arriba, en cambio, la
// lámina deja un campo de pared desenfocada (ver `lamina`) que es vacío de
// verdad, así que el texto se apoya ahí sin velo. Una línea de titular con el
// logotipo al lado y una de precio: con más, el bloque bajaba hasta los ramos.
//
// Todo pensado para el celular, que es donde se ve: 1080 px se muestran a unos
// 390 puntos, al 36 %. El rótulo en versalitas de 18 px que llevaba al lado del
// precio quedaba en 6,5 pt y no lo leía nadie; ningún texto baja de 34 px.
const rotuloArriba = (v) => pagina(`
<div style="position:absolute;top:${SEGURO}px;left:76px;right:76px;display:flex;align-items:flex-end;justify-content:space-between;gap:24px">
  <h1 class="d" style="font-size:${v.hlSize || 112}px;white-space:nowrap">${v.headline}</h1>
  <img src="${MARCA[v.tono === 'claro' ? 'logo-claro' : 'logo']}" style="height:84px;display:block;margin-bottom:10px">
</div>
<p style="position:absolute;top:${SEGURO + Math.round((v.hlSize || 112) * 1.03) + 10}px;left:76px;font-size:50px;font-weight:500;color:${C.rosa}">${v.price}</p>`, 'transparent');

// Una foto 3:4 dentro del 9:16, sin recortar el ramo. La foto entra a todo el
// ancho y pegada abajo; los ${H - 1440} px de arriba se llenan con la franja
// superior de la MISMA foto —la pared— estirada y desenfocada. Se probó antes
// estirar el borde tal cual (fillborders=smear, el truco de las alas de los
// fijos) y en un hueco de 480 px dejaba rayas verticales que se leían como
// persianas; desenfocado, la franja se vuelve un campo liso del color de la
// pared. La unión con la foto es una máscara por smoothstep (PASOS): con un
// corte recto, o con ffmpeg y su geq, quedaba una raya horizontal oscura.
const FUNDIDO = 110;     // px de la máscara; el ramo más alto empieza ~108 px dentro de la foto

// Cada foto puede venir como nombre suelto o como objeto, para dos ajustes que
// salieron de medir la luz debajo del texto, no de mirar:
//   bajar  — px que la foto baja respecto de pegarla abajo. Solo sirve si el ramo
//            deja aire debajo; si no, el filo de abajo se lo come la UI.
//   campo  — [desde, hasta] en fracción del ancho: qué tramo de la franja superior
//            se estira para el campo. En jueves-3 la mitad derecha de la franja
//            es un mueble de madera y el logotipo caía sobre luminancia 44;
//            tomando solo la pared de la izquierda, el campo sale claro entero.
function lamina(foto) {
  const f = typeof foto === 'string' ? { archivo: foto } : foto;
  const archivo = path.join(HERE, 'fotos', f.archivo);
  const ext = path.extname(archivo).slice(1).replace('jpg', 'jpeg');
  const src = `data:image/${ext};base64,${fs.readFileSync(archivo).toString('base64')}`;
  const alto = Math.round(W * 4 / 3);
  const tope = H - alto + (f.bajar || 0);
  const [c0, c1] = f.campo || [0, 1];
  const franja = 60;                    // px de la foto (a 1080 de ancho) que se estiran
  const k = (tope + FUNDIDO + 80) / franja;
  const ancho = (W + 120) / (c1 - c0);
  const mascara = PASOS.map(([p, a]) => `rgba(0,0,0,${(1 - a).toFixed(3)}) ${(p * FUNDIDO / 100).toFixed(1)}px`).join(',');
  return pagina(`
<div style="position:absolute;top:0;left:0;width:${W}px;height:${tope + FUNDIDO + 40}px;overflow:hidden">
  <div style="position:absolute;left:${Math.round(-60 - c0 * ancho)}px;top:-60px;width:${Math.round(ancho)}px;height:${Math.round(alto * k)}px;
       background:url(${src}) 0 0/100% 100% no-repeat;filter:blur(38px)"></div>
</div>
<div style="position:absolute;left:0;top:${tope}px;width:${W}px;height:${alto}px;
     -webkit-mask-image:linear-gradient(to bottom,${mascara})">
  <img src="${src}" style="width:100%;height:100%;display:block">
</div>`, C.fondo);
}

/** Las fotos de `v.fotos` en una toma: cada una `porFoto` s, con fundido entre ellas. */
function tomaDeFotos(v) {
  const seg = v.porFoto || 2.4;
  const cruce = 0.4;     // con 0,6 un tercio de cada lámina era doble exposición
  const laminas = v.fotos.map((f, i) => {
    const destino = path.join(TMP, `${v.code}-lamina-${i + 1}.png`);
    png(lamina(f), destino);
    return destino;
  });
  const entradas = laminas.flatMap((l) => ['-i', l]);
  // Cada lámina se acerca un 3 % mientras está en pantalla: con las fotos quietas
  // el video se leía como un carrusel. El acercamiento se ancla abajo y al centro
  // —lo que se pierde es campo de pared arriba y 16 px por lado— porque anclado
  // al medio se comía la base del ramo que llega hasta el filo (jueves-5). Se
  // escala al doble antes del zoompan: a tamaño real redondea la posición a
  // píxeles enteros y la imagen tiembla.
  const cuadros = Math.round(seg * 30);
  const cadena = laminas.map((_, i) => `[${i}:v]scale=${W * 2}:${H * 2},zoompan=z='1+0.03*on/${cuadros}'`
    + `:x='iw/2-iw/zoom/2':y='ih-ih/zoom':d=${cuadros}:s=${W}x${H}:fps=30,setsar=1[l${i}]`);
  let previo = '[l0]';
  laminas.slice(1).forEach((_, i) => {
    const sale = i === laminas.length - 2 ? '[v]' : `[x${i}]`;
    const offset = ((i + 1) * (seg - cruce)).toFixed(2);
    cadena.push(`${previo}[l${i + 1}]xfade=transition=fade:duration=${cruce}:offset=${offset}${sale}`);
    previo = sale;
  });
  if (laminas.length === 1) cadena.push('[l0]null[v]');
  const destino = path.join(TMP, `${v.code}-toma.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', ...entradas,
    '-filter_complex', cadena.join(';'),
    '-map', '[v]', '-r', '30', '-c:v', 'libx264', '-crf', '14', '-pix_fmt', 'yuv420p', destino,
  ], { stdio: 'pipe' });
  return destino;
}

// Placa de cierre: blanco, logo y el dato. Es la única pantalla del anuncio que
// no es la toma, y por eso no lleva nada más que lo que hace falta para comprar.
const cierre = (v) => pagina(`
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px">
  <img src="${MARCA.logo}" style="height:150px;display:block">
  <div style="text-align:center">
    <h1 class="d" style="font-size:78px">${v.cierre}</h1>
    <p style="font-size:30px;font-weight:300;line-height:1.5;color:${C.body};margin-top:24px">${v.cierreSub}</p>
  </div>
  <span class="mono" style="font-size:17px;color:${C.muted}">${v.cierreFooter || `${v.footer} · ${v.price}`}</span>
</div>`, C.fondo);

// La portada del servicio como placa final (`portada` en videos.json). Sigue el
// orden del flyer que hizo la dueña para Jueves de Flores —rótulo, nombre, precio,
// filete, entrega, cupos, llamado— para que quien vio el flyer reconozca el
// anuncio y al revés. Lo que no se copia es el círculo rosa del precio: el
// sistema no lleva plaquitas, y el precio ya manda en rosa debajo del nombre.
// Va alineada a la izquierda, dentro del área segura de arriba y de abajo.
//
// En el celular manda el llamado: el número de WhatsApp es lo más grande después
// del nombre, porque es lo que alguien copia o recuerda para comprar. Nada baja
// de 34 px (≈ 12 pt en pantalla), y la columna deja 170 px libres a la derecha,
// que es donde Reels apila los botones de me gusta, comentar y compartir.
const portada = (v) => {
  const p = v.portada;
  return pagina(`
<div style="position:absolute;left:76px;right:170px;top:${SEGURO}px;bottom:${SEGURO}px;display:flex;flex-direction:column;justify-content:center">
  <img src="${MARCA.logo}" style="height:84px;display:block;align-self:flex-start;margin-bottom:34px">
  <span class="mono" style="font-size:30px;color:${C.rosa}">${p.rotulo}</span>
  <h1 class="d" style="font-size:150px;margin-top:14px;white-space:nowrap">${v.headline}</h1>
  <p style="font-size:56px;font-weight:500;color:${C.rosa};margin-top:12px">${p.precio}</p>
  <div style="height:1px;background:#E6E5E3;margin:36px 0 30px"></div>
  ${p.datos.map((d) => `<p style="font-size:42px;font-weight:400;line-height:1.4;color:${C.ink}">${d}</p>`).join('')}
  <p style="font-size:36px;font-weight:300;line-height:1.4;color:${C.body};margin-top:10px">${p.zona}</p>
  <div style="height:1px;background:#E6E5E3;margin:34px 0 30px"></div>
  <span class="mono" style="font-size:30px;color:${C.rosa}">${p.cupos}</span>
  <p style="font-size:46px;font-weight:500;line-height:1.25;color:${C.ink};margin-top:12px">${p.llamado}</p>
  <p style="font-size:34px;font-weight:400;color:${C.body};margin-top:22px">${p.canal}</p>
  <p style="font-size:84px;font-weight:500;letter-spacing:.01em;line-height:1;color:${C.rosa};margin-top:6px">${p.numero}</p>
</div>`, C.fondo);
};

// Se pide una ventana más alta de la cuenta —Chromium se queda unos 100 px por
// debajo del `--window-size`— y después se recorta al lienzo exacto. Al final se
// comprueba el tamaño: un PNG que no mida 1080×1920 deja una franja del video
// sin cubrir, y eso tiene que reventar el build, no salir en el anuncio.
function png(html, destino) {
  const nombre = path.basename(destino, '.png');
  const archivo = path.join(TMP, `${nombre}.html`);
  const crudo = path.join(TMP, `${nombre}-crudo.png`);
  fs.writeFileSync(archivo, html);
  execFileSync(chromium(), [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--default-background-color=00000000', '--force-device-scale-factor=1',
    `--window-size=${W},${H + 200}`, `--screenshot=${crudo}`, `file://${archivo}`,
  ], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', crudo, '-vf', `crop=${W}:${H}:0:0`, destino], { stdio: 'pipe' });

  const [ancho, alto] = medidaPng(destino);
  if (ancho !== W || alto !== H) {
    throw new Error(`${nombre}: el rótulo salió ${ancho}×${alto} y tiene que ser ${W}×${H}`);
  }
}

/** Ancho y alto de un PNG, leídos de su cabecera IHDR. */
function medidaPng(archivo) {
  const b = fs.readFileSync(archivo);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

function musica(segundos, estilo) {
  const wav = path.join(HERE, 'musica', `cama${estilo ? `-${estilo}` : ''}-${segundos}s.wav`);
  if (!fs.existsSync(wav)) {
    execFileSync('python3', [path.join(HERE, 'musica.py'), String(segundos), ...(estilo ? ['--estilo', estilo] : [])], { stdio: 'pipe' });
  }
  return wav;
}

// El largo se saca de lo que ffmpeg escribe en stderr y no con ffprobe: hay
// instalaciones (la de pip, imageio-ffmpeg) que traen el codificador y no la
// herramienta de sondeo, y por un dato así no vale la pena pedir otro binario.
function dur(archivo) {
  let salida = '';
  try {
    execFileSync('ffmpeg', ['-i', archivo], { stdio: 'pipe' });
  } catch (err) {
    salida = String(err.stderr || '');
  }
  const m = salida.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error(`no pude leer el largo de ${archivo}`);
  return (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
}

function render(v) {
  const clip = v.fotos ? tomaDeFotos(v) : path.join(HERE, 'clips', v.clip);
  if (!fs.existsSync(clip)) throw new Error(`falta el clip ${v.clip} en marketing/video/clips/`);
  const largo = dur(clip);
  const fin = v.cierreSeg || CIERRE;
  const total = Math.round((largo + fin) * 10) / 10;

  const pRotulo = path.join(TMP, `${v.code}-rotulo.png`);
  const pCierre = path.join(TMP, `${v.code}-cierre.png`);
  png((v.plantilla === 'arriba' ? rotuloArriba : rotulo)(v), pRotulo);
  png((v.portada ? portada : cierre)(v), pCierre);
  const wav = musica(total, v.musica);
  const destino = path.join(OUT, `${v.code}.mp4`);

  // Un solo paso de ffmpeg: escalar la toma, encimar el rótulo, pegar la placa
  // de cierre y montar la música. El fundido del rótulo entra al segundo, que es
  // cuando el ojo ya vio el ramo.
  const filtro = [
    `[0:v]scale=${W}:${H}:flags=lanczos,fps=30,setsar=1[toma]`,
    // El rótulo entra en bucle y con duración: como imagen suelta, ffmpeg lo
    // congela en su único fotograma —el del arranque del fundido, con alfa 0— y
    // el rótulo no aparece nunca.
    `[1:v]format=rgba,fade=in:st=${v.rotuloEntra ?? 1}:d=0.7:alpha=1,setpts=PTS-STARTPTS[rot]`,
    `[toma][rot]overlay=0:0[conRotulo]`,
    `[2:v]scale=${W}:${H},fps=30,setsar=1,format=yuv420p,fade=in:st=0:d=0.5[placa]`,
    `[conRotulo]format=yuv420p[a]`,
    `[a][placa]concat=n=2:v=1:a=0[v]`,
    `[3:a]atrim=0:${total},afade=t=in:st=0:d=${v.musica ? 0.2 : 1.2},afade=t=out:st=${(total - 2.2).toFixed(2)}:d=2.2[a]`,
  ].join(';');

  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', clip,
    '-loop', '1', '-t', String(largo), '-i', pRotulo,
    '-loop', '1', '-t', String(fin), '-i', pCierre,
    '-i', wav,
    '-filter_complex', filtro,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '19', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-movflags', '+faststart',
    destino,
  ], { stdio: 'pipe' });

  const kb = Math.round(fs.statSync(destino).size / 1024);
  console.log(`  ✓ ${v.code}  ${W}×${H}  ${total.toFixed(1)}s  ${kb} KB  — ${v.title}`);
}

const VIDEOS = JSON.parse(fs.readFileSync(path.join(HERE, 'videos.json'), 'utf8')).videos;
const pedidos = process.argv.slice(2);
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(TMP, { recursive: true });
const lista = pedidos.length ? VIDEOS.filter((v) => pedidos.includes(v.code)) : VIDEOS;
if (!lista.length) throw new Error(`sin coincidencias para ${pedidos.join(', ')}`);
for (const v of lista) render(v);
console.log(`\n${lista.length} video(s) en marketing/video/creativos/`);
