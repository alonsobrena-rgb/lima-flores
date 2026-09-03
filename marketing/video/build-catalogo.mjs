#!/usr/bin/env node
// Arma VID-CATALOGO a partir de marketing/video/catalogo.json: un solo Reel que
// recorre varios productos —cada uno con su nombre y su precio— en vez del
// molde de build.mjs, que es una toma real por video. No hay tomas de video
// para orquídeas, arreglos, boxes, tulipanes ni ramo —solo la foto de
// catálogo—, así que la "toma" de cada producto es esa misma foto con un
// Ken Burns suave (zoompan de ffmpeg), nunca una imagen generada: la regla de
// `.claude/skills/piezas-graficas/SKILL.md` sigue siendo "el catálogo es
// fotografía real".
//
//   node marketing/video/build-catalogo.mjs
//
// El logotipo, las fuentes y los velos —cuando hacen falta— son el mismo
// sistema de marketing/video/build.mjs; ver ese README antes de tocar esto.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ADS = path.join(ROOT, 'marketing/ig-ads');
const OUT = path.join(HERE, 'creativos');
const TMP = path.join(HERE, '.tmp/catalogo');

const W = 1080;
const H = 1920;
const SEGURO = 372;
const FPS = 30;
const CODE = 'VID-CATALOGO';

/* ── el sistema, leído del CSS como en build.mjs ── */
const TOKENS = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, 'design/direcciones/florencia.css'), 'utf8')
    .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]),
);
const C = {
  fondo: TOKENS['--bg-page'], ink: TOKENS['--text-strong'],
  body: TOKENS['--text-body'], muted: TOKENS['--text-muted'], rosa: TOKENS['--accent'],
  verde: TOKENS['--leaf'],   // el verde del propio ramo del logotipo, no uno inventado
};

/* ── el marco: mismas coordenadas que la caja de la foto (ver fotoContenida),
   para que el borde quede pegado a la foto y no suelto en el aire ── */
const CAJA_TOP = SEGURO + 84 + 36;   // debajo del logo
const CAJA_ALTO = 780;               // deja margen antes del bloque de texto
const CAJA_MARGEN = 50;              // izquierda/derecha
const MARCO_PAD = 20;                // aire entre la foto y el filete

/* ── velos: la misma smoothstep de build.mjs, para el único tramo (la
   suscripción) que va a foto de ambiente en vez de contenedor plano ── */
const PASOS = [[0, 1], [12, .972], [24, .896], [36, .776], [48, .62], [60, .448],
  [72, .28], [82, .152], [91, .06], [100, 0]];
const baja = (largo, alfa) => PASOS
  .map(([p, a]) => `rgba(255,255,255,${(a * alfa).toFixed(3)}) calc(100% - ${(largo - p * largo / 100).toFixed(1)}px)`)
  .join(',');

const MARCA = Object.fromEntries(['logo', 'logo-claro'].map((n) => [
  n, `data:image/png;base64,${fs.readFileSync(path.join(ADS, 'marca', `${n}.png`)).toString('base64')}`,
]));

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

// Todo dentro de #lienzo, de medidas fijas: la trampa de siempre es anclar al
// viewport de Chromium, que llega más corto que el --window-size pedido.
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

// Se pide una ventana más alta de la cuenta y se recorta al lienzo exacto;
// después se comprueba la medida del PNG, igual que en build.mjs.
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

/* ── logo + bloque de texto, el mismo rótulo de build.mjs pero sin precio
   suelto en la esquina: acá el precio es la mitad de la noticia ── */
function rotulo(item, { veil = false } = {}) {
  const bloque = `
<div style="position:relative;padding:0 76px">
  <p class="mono" style="font-size:24px;color:${C.rosa}">${item.tag}</p>
  <h1 class="d" style="font-size:${item.hlSize}px;margin-top:14px">${item.name}</h1>
  <p class="d" style="font-size:60px;font-weight:400;margin-top:22px">${item.price}</p>
</div>`;
  return pagina(`
${veil ? '' : `<div style="position:absolute;top:${CAJA_TOP - MARCO_PAD}px;left:${CAJA_MARGEN - MARCO_PAD}px;
     right:${CAJA_MARGEN - MARCO_PAD}px;height:${CAJA_ALTO + MARCO_PAD * 2}px;
     border:3px solid ${C.verde}"></div>`}
<div style="position:absolute;top:${SEGURO}px;left:76px">
  <img src="${MARCA.logo}" style="height:84px;display:block">
</div>
<div style="position:absolute;left:0;right:0;bottom:${SEGURO}px">
  ${veil ? `<div style="position:absolute;left:0;right:0;top:-190px;bottom:-170px;
       background:linear-gradient(to bottom,transparent,transparent 190px,
         rgba(255,255,255,.94) calc(100% - 170px),${baja(170, .94)})"></div>` : ''}
  ${bloque}
</div>`, 'transparent');
}

/** Recorta la foto de catálogo al bulto real del producto —la toma de estudio
    trae mucho fondo de sobra alrededor de un objeto angosto y alto, y sin
    achicar ese sobrante el producto sale chico en el video aunque la caja de
    destino sea grande—. El recorte es manual, mirado uno por uno (los cuatro
    bordes del producto, con margen), no una detección automática: un bbox
    calculado mal corta producto, que es exactamente lo que la regla 1 de
    piezas-gráficas prohíbe. */
function recorte(item) {
  if (!item.crop) return path.join(ROOT, item.image);
  const destino = path.join(TMP, `${item.code}-recorte.jpg`);
  const [x, y, w, h] = item.crop;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', path.join(ROOT, item.image),
    '-vf', `crop=${w}:${h}:${x}:${y}`, destino,
  ], { stdio: 'pipe' });
  return destino;
}

/** La toma de un producto sin video: la foto de catálogo (ya recortada al
    bulto), contenida entera dentro de una caja fija —nunca recortada de
    nuevo— sobre el color medido de su propio fondo de estudio. Esto es lo que
    pide la regla 1 de piezas-gráficas para una composición "contain": nada de
    producto se pierde, y el color de relleno sale de la propia foto, no de un
    gris inventado. */
function fotoContenida(item) {
  const src = `data:image/jpeg;base64,${fs.readFileSync(recorte(item)).toString('base64')}`;
  return pagina(`
<div style="position:absolute;top:${CAJA_TOP}px;left:${CAJA_MARGEN}px;right:${CAJA_MARGEN}px;height:${CAJA_ALTO}px;
     display:flex;align-items:center;justify-content:center">
  <img src="${src}" style="max-width:100%;max-height:100%;display:block">
</div>`, item.fondo);
}

/** Placa estática: logo, titular y bajada. Usada en la intro y en el cierre —
    las dos pantallas del video que no son una foto de producto. */
function placa({ headline, sub, footer }) {
  return pagina(`
<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:48px">
  <img src="${MARCA.logo}" style="height:150px;display:block">
  <div style="text-align:center;padding:0 90px">
    <h1 class="d" style="font-size:72px">${headline}</h1>
    ${sub ? `<p style="font-size:30px;font-weight:300;color:${C.body};margin-top:24px">${sub}</p>` : ''}
  </div>
  ${footer ? `<span class="mono" style="font-size:17px;color:${C.muted}">${footer}</span>` : ''}
</div>`, C.fondo);
}

/** Ken Burns: zoom lento y parejo hacia el centro, nunca hacia una esquina —
    así lo que se recorta primero es el margen de relleno, no el producto. Con
    `-loop 1` más `d=1` el contador `on` de zoompan no se reinicia en cada
    cuadro de entrada, así que el zoom avanza continuo en vez de saltar cada
    vez que zoompan pide el siguiente cuadro de la foto repetida. */
function kenBurns(entrada, destino, segundos, { zoomHasta = 1.06, prefiltro = '' } = {}) {
  const cuadros = Math.round(segundos * FPS);
  const paso = (zoomHasta - 1) / cuadros;
  const zoompan = `zoompan=z='min(zoom+${paso.toFixed(6)},${zoomHasta})':d=1:s=${W}x${H}:fps=${FPS}:`
    + `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`;
  const vf = prefiltro ? `${prefiltro},${zoompan}` : zoompan;
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-loop', '1', '-i', entrada,
    '-vf', vf, '-t', String(segundos), '-r', String(FPS),
    '-pix_fmt', 'yuv420p', destino,
  ], { stdio: 'pipe' });
}

/** Plano estático (intro y cierre): sin Ken Burns, solo estirado a duración. */
function estatico(entrada, destino, segundos) {
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-loop', '1', '-i', entrada,
    '-t', String(segundos), '-r', String(FPS), '-vf', `format=yuv420p`,
    destino,
  ], { stdio: 'pipe' });
}

/** Superpone el rótulo (transparente, con fundido de entrada) sobre una toma
    ya renderizada. */
function conRotulo(toma, rotuloPng, destino, segundos, { entrada = 0.35 } = {}) {
  const filtro = [
    `[0:v]format=yuv420p[base]`,
    `[1:v]format=rgba,fade=in:st=${entrada}:d=0.5:alpha=1,setpts=PTS-STARTPTS[rot]`,
    `[base][rot]overlay=0:0:format=auto,format=yuv420p[v]`,
  ].join(';');
  // El rótulo tiene que entrar en bucle y con duración: una imagen suelta es
  // un único fotograma para ffmpeg, y el fundido no tiene sobre qué animar —
  // se queda congelado en el alfa de su único cuadro. Mismo bug que ya
  // documentó build.mjs.
  execFileSync('ffmpeg', [
    '-y', '-v', 'error', '-i', toma,
    '-loop', '1', '-t', String(segundos), '-i', rotuloPng,
    '-filter_complex', filtro, '-map', '[v]', destino,
  ], { stdio: 'pipe' });
}

function main() {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(TMP, { recursive: true });

  const data = JSON.parse(fs.readFileSync(path.join(HERE, 'catalogo.json'), 'utf8'));
  const clips = [];

  // 1) Intro: la misma promesa del hero del sitio, no una frase nueva.
  const introPng = path.join(TMP, 'intro.png');
  const introMp4 = path.join(TMP, 'intro.mp4');
  png(placa(data.intro), introPng);
  estatico(introPng, introMp4, data.intro.duration);
  clips.push(introMp4);

  // 2) Un tramo por producto: la foto de catálogo con Ken Burns + su rótulo.
  data.items.forEach((item, i) => {
    const base = path.join(TMP, `item-${i}-base.png`);
    const toma = path.join(TMP, `item-${i}-toma.mp4`);
    const rot = path.join(TMP, `item-${i}-rotulo.png`);
    const final = path.join(TMP, `item-${i}-final.mp4`);

    if (item.fit === 'cover') {
      // La única foto de ambiente: el recorte es el punto (rule 1, excepción
      // explícita), así que va a sangre y con velo detrás del texto.
      const original = path.join(ROOT, item.image);
      kenBurns(original, toma, item.duration, {
        prefiltro: `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
      });
      png(rotulo(item, { veil: true }), rot);
    } else {
      png(fotoContenida(item), base);
      kenBurns(base, toma, item.duration);
      png(rotulo(item, { veil: false }), rot);
    }
    conRotulo(toma, rot, final, item.duration);
    clips.push(final);
  });

  // 3) Cierre: logo, invitación a escribir y el handle. Nada de precio —ya
  // se vio seis veces— y nada nuevo: mismo tono que el cierre de VID-01.
  const cierrePng = path.join(TMP, 'cierre.png');
  const cierreMp4 = path.join(TMP, 'cierre.mp4');
  png(placa(data.cierre), cierrePng);
  estatico(cierrePng, cierreMp4, data.cierre.duration);
  clips.push(cierreMp4);

  // 4) Concat + música. Un solo paso de ffmpeg para las N tomas ya montadas.
  const total = Math.round((data.intro.duration
    + data.items.reduce((s, it) => s + it.duration, 0)
    + data.cierre.duration) * 10) / 10;
  const wav = musica(total);
  const destino = path.join(OUT, `${CODE}.mp4`);

  const inputs = clips.flatMap((c) => ['-i', c]);
  const streams = clips.map((_, i) => `[${i}:v]`).join('');
  const filtro = [
    `${streams}concat=n=${clips.length}:v=1:a=0[v]`,
    `[${clips.length}:a]atrim=0:${total},afade=t=in:st=0:d=1.2,afade=t=out:st=${(total - 2.2).toFixed(2)}:d=2.2[a]`,
  ].join(';');

  execFileSync('ffmpeg', [
    '-y', '-v', 'error', ...inputs, '-i', wav,
    '-filter_complex', filtro, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-profile:v', 'high', '-crf', '19', '-preset', 'slow', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-ar', '44100', '-movflags', '+faststart',
    destino,
  ], { stdio: 'pipe' });

  const kb = Math.round(fs.statSync(destino).size / 1024);
  console.log(`✓ ${CODE}  ${W}×${H}  ${total.toFixed(1)}s  ${kb} KB  → marketing/video/creativos/${CODE}.mp4`);
}

main();
