#!/usr/bin/env node
// Arma la pieza de "Jueves de Flores" (suscripción mensual, 2 ramos al mes).
//
// No es un anuncio del catálogo — no vende un producto de db/products.seed.json,
// vende un plan — así que vive fuera de marketing/ig-ads/ads.json: es HTML
// suelto con los tokens del sistema, mismo criterio que cualquier pieza que no
// es un anuncio (.claude/skills/piezas-graficas/SKILL.md, sección "¿pieza o
// plantilla?").
//
// Lo único verificado contra el código es el precio y el número de entregas
// (app/src/data/plans.ts: MONTHLY_PRICE = 130, plan mensual → deliveries: 2).
// El día y la franja ("jueves, 1 a 4 pm"), los cinco distritos y "cupos
// limitados" son contenido que dio el negocio para esta pieza puntual — no
// están en app/src/lib/delivery.ts, que lista 42 distritos y otras franjas
// horarias. Quedan anotados acá para quien vuelva a mirar esto en seis meses.
//
//   node marketing/suscripcion/build.mjs            # estática, 4:5 y 9:16
//   node marketing/suscripcion/build.mjs --video     # + el sello animado (mp4)
//
// El mp4 es para WhatsApp: necesita H.264, y si el ffmpeg del sistema no lo
// trae (pasa en contenedores mínimos), `pip install imageio-ffmpeg` deja uno
// completo. Sin H.264 a mano, el video sale en .webm — no se ve bien en un
// chat, así que el build lo avisa por consola en vez de fallar en silencio.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TMP = path.join(HERE, '.tmp');
fs.mkdirSync(TMP, { recursive: true });

/* ── el sistema, leído del CSS como en marketing/ig-ads/build.mjs ── */
const TOKENS = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, 'design/direcciones/florencia.css'), 'utf8')
    .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]),
);
const C = {
  fondo: TOKENS['--bg-page'], ink: TOKENS['--text-strong'],
  body: TOKENS['--text-body'], muted: TOKENS['--text-muted'],
  rosa: TOKENS['--accent'], linea: TOKENS['--border'],
};

const FUENTES = fs.readdirSync(path.join(ROOT, 'app/public/fonts'))
  .filter((f) => f.endsWith('.woff2'))
  .map((f) => {
    const fam = f.startsWith('cormorant') ? 'Cormorant Garamond' : 'Jost';
    const peso = f.match(/-(\d+)i?\./)[1];
    const italica = f.includes('i.woff2');
    const b64 = fs.readFileSync(path.join(ROOT, 'app/public/fonts', f)).toString('base64');
    return `@font-face{font-family:'${fam}';font-style:${italica ? 'italic' : 'normal'};font-weight:${peso};`
      + `src:url(data:font/woff2;base64,${b64}) format('woff2')}`;
  }).join('\n');

const LOGO = fs.readFileSync(path.join(ROOT, 'marketing/ig-ads/marca/logo.png')).toString('base64');

// Cuatro ramos reales, no uno solo: la suscripción manda uno distinto cada
// vez —el punto es la variedad, no un producto fijo— así que la pieza lo
// muestra en vez de prometer un ramo puntual que después no coincide con el
// que llega. Cada `pos` está elegida a mano para que el recorte a cuadrado no
// se lleve la flor principal de esa foto.
const RAMOS = [
  { archivo: 'ramo-1.jpg', pos: '50% 40%' },
  { archivo: 'ramo-2.jpg', pos: '50% 45%' },
  { archivo: 'ramo-3.jpg', pos: '50% 45%' },
  { archivo: 'ramo-4.jpg', pos: '50% 38%' },
].map((r) => ({ ...r, b64: fs.readFileSync(path.join(HERE, 'fotos', r.archivo)).toString('base64') }));

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

// El video es para WhatsApp, no para Reels: tiene que ser un .mp4 con H.264,
// que es lo único que reproduce sin rarezas en un chat. El ffmpeg que trae
// Playwright para grabar video solo sabe codificar VP8/webm (ver más abajo);
// si hay uno completo (con libx264) se prefiere siempre. `pip install
// imageio-ffmpeg` deja uno en dist-packages y es la forma más simple de
// conseguirlo en un contenedor que no tiene ffmpeg del sistema.
function ffmpegBin() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) return process.env.FFMPEG_PATH;
  try {
    const py = execFileSync('python3', ['-c', 'import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8' }).trim();
    if (py && fs.existsSync(py)) return py;
  } catch { /* no está instalado, seguimos */ }
  try {
    const p = execFileSync('which', ['ffmpeg'], { encoding: 'utf8' }).trim();
    if (p) return p;
  } catch { /* no hay uno del sistema, seguimos */ }
  const pw = '/opt/pw-browsers/ffmpeg-1011/ffmpeg-linux';
  if (fs.existsSync(pw)) return pw;
  throw new Error('No encontré ffmpeg. Exporta FFMPEG_PATH=/ruta/a/ffmpeg');
}

let _h264;
/** Si el ffmpeg resuelto sabe codificar H.264 (libx264). Se cachea porque
 * `-encoders` lista cientos de líneas y no cambia entre llamadas. */
function tieneH264() {
  if (_h264 !== undefined) return _h264;
  const salida = execFileSync(ffmpegBin(), ['-encoders'], { encoding: 'utf8' });
  return (_h264 = /\blibx264\b/.test(salida));
}

/* ── copy de la pieza (ver nota de cabecera sobre qué está verificado) ── */
const V = {
  eyebrow: 'Suscripción de flores',
  headline: 'Jueves de <em>Flores</em>',
  seal: '2 ramos',
  price: 'S/130',
  priceLine: '2 ramos al mes · S/130',
  sub: 'Ramo de temporada, a mano, que llega cerrado y florece en tu hogar.',
  info1: '🚚 Delivery incluido &nbsp;·&nbsp; 📅 Jueves, 1 a 4 pm',
  info2: '📍 Miraflores · Barranco · San Isidro · Magdalena del Mar · Chorrillos',
  urgency: 'Cupos limitados',
  cta: 'Escríbeme y separamos tus flores 🌸',
};

/* ── layout ───────────────────────────────────────────────────────────────
   Foto entera arriba —toma de ambiente, la mesa y las flores llenan el
   encuadre, no hay ciclorama que recortar, así que `cover` no se lleva nada
   que importe— y un panel plano debajo. Nunca una tarjeta con esquinas
   redondeadas ni una sombra flotando sobre el fondo del host: el filete de 1px
   es el único separador. El sello del precio es el mismo círculo apoyado
   directo sobre la foto que usa `sello` en marketing/ig-ads/build.mjs, a
   caballo entre la foto y el panel.
   `glint` (0..1 o null) ubica el barrido de brillo para el video; en la
   pieza estática no existe. */
function pagina(w, h, fotoAlto, glint) {
  const R = 128;
  const cx = w - 76 - R;
  const cy = fotoAlto;
  const brillo = glint == null ? '' : (() => {
    // Barrido diagonal: -1.3R a 3.3R a lo largo del eje del gradiente, para
    // que entre y salga completo del círculo (que lo recorta con overflow:hidden).
    const recorrido = R * 4.6;
    const x = -1.3 * R + glint * recorrido;
    return `<div style="position:absolute;inset:0;overflow:hidden;border-radius:50%">
      <div style="position:absolute;top:-40%;bottom:-40%;left:${x}px;width:${R * 0.9}px;
                  transform:rotate(22deg);
                  background:linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,.55) 50%,rgba(255,255,255,0) 100%)"></div>
    </div>`;
  })();
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
${FUENTES}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;background:${C.fondo};overflow:hidden}
body{font-family:'Jost',sans-serif;-webkit-font-smoothing:antialiased}
#lienzo{position:absolute;top:0;left:0;width:${w}px;height:${h}px;background:${C.fondo};overflow:hidden}
.d{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;letter-spacing:-.018em;color:${C.ink}}
.d em{font-style:italic;color:${C.rosa}}
.mono{font-weight:600;letter-spacing:.16em;text-transform:uppercase}
</style></head><body><div id="lienzo">
  <div style="position:absolute;top:0;left:0;width:${w}px;height:${fotoAlto}px;overflow:hidden;
              display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;background:${C.fondo}">
    ${RAMOS.map((r) => `<div style="overflow:hidden">
      <img src="data:image/jpeg;base64,${r.b64}" style="width:100%;height:100%;object-fit:cover;object-position:${r.pos};display:block">
    </div>`).join('')}
  </div>
  <div style="position:absolute;left:${cx}px;top:${cy - R}px;width:${R * 2}px;height:${R * 2}px;
              border-radius:50%;background:${C.rosa};color:#fff;
              display:flex;flex-direction:column;align-items:center;justify-content:center;
              box-shadow:0 0 0 6px ${C.fondo};overflow:hidden">
    <span class="mono" style="font-size:15px;opacity:.85">${V.seal}</span>
    <span class="d" style="font-size:56px;font-weight:400;margin-top:4px;font-style:normal;color:#fff">${V.price}</span>
    ${brillo}
  </div>
  <div style="position:absolute;left:0;right:0;top:${fotoAlto}px;bottom:0;
              display:flex;flex-direction:column;justify-content:center;padding:0 76px">
    <span class="mono" style="display:block;font-size:22px;color:${C.rosa}">${V.eyebrow}</span>
    <h1 class="d" style="font-size:104px;margin-top:12px;line-height:.96">${V.headline}</h1>
    <p style="font-family:'Jost',sans-serif;font-weight:700;font-size:36px;color:${C.rosa};margin-top:18px">${V.priceLine}</p>
    <p class="d" style="font-size:34px;font-weight:500;color:${C.body};margin-top:22px;max-width:26ch;line-height:1.3">${V.sub}</p>
    <div style="height:1px;background:${C.linea};margin:30px 0 0"></div>
    <p style="font-size:29px;color:${C.ink};margin-top:26px;line-height:1.5">${V.info1}</p>
    <p style="font-size:25px;color:${C.muted};margin-top:9px;line-height:1.5">${V.info2}</p>
    <p class="mono" style="font-size:20px;color:${C.rosa};margin-top:30px">${V.urgency}</p>
    <p style="font-size:31px;color:${C.ink};font-weight:600;margin-top:9px">${V.cta}</p>
    <div style="height:1px;background:${C.linea};margin:34px 0 0"></div>
    <img src="data:image/png;base64,${LOGO}" style="height:104px;display:block;margin:26px auto 0">
  </div>
</div></body></html>`;
}

/** Ancho y alto de un JPEG, leídos de su primer marcador SOF. Chromium escribe
 * el screenshot en JPEG cuando el destino termina en `.jpg` — no hace falta
 * pasar por ffmpeg para eso, y es mejor así: el ffmpeg de este entorno es el
 * que trae Playwright para grabar video (`--enable-decoder=mjpeg` y poco más),
 * no trae decodificador de PNG ni encoder de JPEG/H.264. */
function medidaJpg(archivo) {
  const b = fs.readFileSync(archivo);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marcador = b[i + 1];
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; // [ancho, alto]
    }
    const largo = b.readUInt16BE(i + 2);
    i += 2 + largo;
  }
  throw new Error(`${archivo}: no encontré el SOF del JPEG`);
}

/** Renderiza `html` (una caja exacta de w×h, ver nota de `#lienzo` en
 * marketing/video/build.mjs sobre por qué todo va anclado a un contenedor y
 * no al viewport) directo a JPEG y comprueba que mida lo que tiene que medir. */
function capturar(html, w, h, destino) {
  const nombre = path.basename(destino, path.extname(destino));
  const archivo = path.join(TMP, `${nombre}.html`);
  fs.writeFileSync(archivo, html);
  execFileSync(chromium(), [
    '--headless', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--window-size=${w},${h}`,
    `--screenshot=${destino}`, `file://${archivo}`,
  ], { stdio: 'pipe' });
  const [ancho, alto] = medidaJpg(destino);
  if (ancho !== w || alto !== h) throw new Error(`${nombre}: salió ${ancho}×${alto} y tiene que ser ${w}×${h}`);
}

const FORMATOS = [
  { nombre: '4x5', w: 1080, h: 1350, fotoAlto: 420 },
  { nombre: '9x16', w: 1080, h: 1920, fotoAlto: 980 },
];

function estatica() {
  for (const f of FORMATOS) {
    const jpg = path.join(HERE, `jueves-de-flores-${f.nombre}.jpg`);
    capturar(pagina(f.w, f.h, f.fotoAlto, null), f.w, f.h, jpg);
    console.log(`  ✓ jueves-de-flores-${f.nombre}.jpg   ${f.w}×${f.h}`);
  }
}

/** El barrido de brillo sobre el sello: 18 fotogramas para que entre y salga
 * del círculo, sostenido después 18 fotogramas más — no un loop que se
 * reinicia de golpe, sino un tintineo que pasa una vez y se queda quieto.
 *
 * Es para mandar por WhatsApp, así que tiene que ser .mp4/H.264 — un .webm
 * no se reproduce bien ahí. Si el ffmpeg resuelto trae libx264 (lo normal en
 * cualquier máquina con ffmpeg del sistema, o con `pip install
 * imageio-ffmpeg`) sale en mp4; si solo está el que trae Playwright para
 * grabar video —sin encoder de H.264, solo VP8— cae a .webm y avisa. */
function video(f) {
  const N = 18;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const jpg = path.join(TMP, `sello-${f.nombre}-${String(i).padStart(3, '0')}.jpg`);
    capturar(pagina(f.w, f.h, f.fotoAlto, t), f.w, f.h, jpg);
  }
  // sostiene el último fotograma copiándolo en vez de re-renderizarlo
  const ultimo = path.join(TMP, `sello-${f.nombre}-${String(N - 1).padStart(3, '0')}.jpg`);
  for (let i = N; i < N * 2; i++) {
    fs.copyFileSync(ultimo, path.join(TMP, `sello-${f.nombre}-${String(i).padStart(3, '0')}.jpg`));
  }
  const h264 = tieneH264();
  const destino = path.join(HERE, `jueves-de-flores-sello-${f.nombre}.${h264 ? 'mp4' : 'webm'}`);
  // Se manda por stdin (`image2pipe`) y no como patrón `%03d` porque el
  // ffmpeg de Playwright solo trae ese demuxer habilitado, no `image2`; con
  // un ffmpeg completo funciona igual, así que se deja un solo camino.
  const entrada = Array.from({ length: N * 2 }, (_, i) => path.join(TMP, `sello-${f.nombre}-${String(i).padStart(3, '0')}.jpg`))
    .map((p) => fs.readFileSync(p));
  const args = h264
    ? ['-c:v', 'libx264', '-profile:v', 'high', '-crf', '19', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
    : ['-c:v', 'libvpx', '-pix_fmt', 'yuv420p', '-b:v', '3M']; // nombre real del encoder en el build de Playwright: `libvpx`, no `libvpx_vp8`
  execFileSync(ffmpegBin(), [
    '-y', '-v', 'error', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '12', '-i', 'pipe:0',
    ...args, destino,
  ], { input: Buffer.concat(entrada), stdio: ['pipe', 'pipe', 'pipe'] });
  console.log(`  ✓ ${path.basename(destino)}   ${f.w}×${f.h}${h264 ? '' : '  (sin H.264 a mano — avisa antes de mandarlo por WhatsApp)'}`);
}

estatica();
if (process.argv.includes('--video')) {
  for (const f of FORMATOS) video(f);
}
