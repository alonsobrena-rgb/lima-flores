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
const CIERRE = 2.6;      // segundos de la placa final

/* ── el sistema, leído del CSS como en los creativos fijos ── */
const TOKENS = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, 'design/direcciones/florencia.css'), 'utf8')
    .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]),
);
const C = {
  fondo: TOKENS['--bg-page'], ink: TOKENS['--text-strong'],
  body: TOKENS['--text-body'], muted: TOKENS['--text-muted'], rosa: TOKENS['--accent'],
};

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
<!-- Un lavado suave arriba: el rótulo está quieto y la toma se mueve, así que
     sin él el logotipo caía unas veces sobre la pared y otras sobre la tarjeta
     del propio arreglo —que ya lleva el logotipo impreso— y se leían dos. -->
<div style="position:absolute;left:0;right:0;top:0;height:${Math.round(H * 0.3)}px;
     background:linear-gradient(to bottom, rgba(255,255,255,.82) 0%, rgba(255,255,255,.6) 55%, rgba(255,255,255,0) 100%)"></div>
<div style="position:absolute;top:${SEGURO}px;left:76px">
  <img src="${MARCA[v.tono === 'claro' ? 'logo-claro' : 'logo']}" style="height:74px;display:block">
</div>
<div style="position:absolute;left:0;right:0;bottom:0;height:${Math.round(H * 0.38)}px;
     background:linear-gradient(to top, rgba(255,255,255,.9) 0%, rgba(255,255,255,.74) 46%, rgba(255,255,255,0) 100%)"></div>
<div style="position:absolute;left:76px;right:76px;bottom:${SEGURO}px">
  <h1 class="d" style="font-size:${v.hlSize || 92}px">${v.headline}</h1>
  ${v.sub ? `<p style="font-size:30px;font-weight:300;line-height:1.4;color:${C.body};margin-top:22px">${v.sub}</p>` : ''}
  <div style="margin-top:28px;display:flex;align-items:baseline;gap:22px">
    <span class="d" style="font-size:46px;font-weight:400">${v.price}</span>
    <span class="mono" style="font-size:16px;color:${C.muted}">${v.footer}</span>
  </div>
</div>`, 'transparent');

// Placa de cierre: blanco, logo y el dato. Es la única pantalla del anuncio que
// no es la toma, y por eso no lleva nada más que lo que hace falta para comprar.
const cierre = (v) => pagina(`
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:56px">
  <img src="${MARCA.logo}" style="height:150px;display:block">
  <div style="text-align:center">
    <h1 class="d" style="font-size:78px">${v.cierre}</h1>
    <p style="font-size:30px;font-weight:300;color:${C.body};margin-top:24px">${v.cierreSub}</p>
  </div>
  <span class="mono" style="font-size:17px;color:${C.muted}">${v.footer} · ${v.price}</span>
</div>`, C.fondo);

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

function musica(segundos) {
  const wav = path.join(HERE, 'musica', `cama-${segundos}s.wav`);
  if (!fs.existsSync(wav)) {
    execFileSync('python3', [path.join(HERE, 'musica.py'), String(segundos)], { stdio: 'pipe' });
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
  const clip = path.join(HERE, 'clips', v.clip);
  if (!fs.existsSync(clip)) throw new Error(`falta el clip ${v.clip} en marketing/video/clips/`);
  const largo = dur(clip);
  const total = Math.round((largo + CIERRE) * 10) / 10;

  const pRotulo = path.join(TMP, `${v.code}-rotulo.png`);
  const pCierre = path.join(TMP, `${v.code}-cierre.png`);
  png(rotulo(v), pRotulo);
  png(cierre(v), pCierre);
  const wav = musica(total);
  const destino = path.join(OUT, `${v.code}.mp4`);

  // Un solo paso de ffmpeg: escalar la toma, encimar el rótulo, pegar la placa
  // de cierre y montar la música. El fundido del rótulo entra al segundo, que es
  // cuando el ojo ya vio el ramo.
  const filtro = [
    `[0:v]scale=${W}:${H}:flags=lanczos,fps=30,setsar=1[toma]`,
    // El rótulo entra en bucle y con duración: como imagen suelta, ffmpeg lo
    // congela en su único fotograma —el del arranque del fundido, con alfa 0— y
    // el rótulo no aparece nunca.
    `[1:v]format=rgba,fade=in:st=1:d=0.7:alpha=1,setpts=PTS-STARTPTS[rot]`,
    `[toma][rot]overlay=0:0[conRotulo]`,
    `[2:v]scale=${W}:${H},fps=30,setsar=1,format=yuv420p,fade=in:st=0:d=0.5[placa]`,
    `[conRotulo]format=yuv420p[a]`,
    `[a][placa]concat=n=2:v=1:a=0[v]`,
    `[3:a]atrim=0:${total},afade=t=in:st=0:d=1.2,afade=t=out:st=${(total - 2.2).toFixed(2)}:d=2.2[a]`,
  ].join(';');

  execFileSync('ffmpeg', [
    '-y', '-v', 'error',
    '-i', clip,
    '-loop', '1', '-t', String(largo), '-i', pRotulo,
    '-loop', '1', '-t', String(CIERRE), '-i', pCierre,
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
