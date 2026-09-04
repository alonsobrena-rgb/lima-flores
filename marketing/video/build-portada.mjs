#!/usr/bin/env node
// La portada del Reel-catálogo: la misma foto de tulipanes que ya usa
// VID-CATALOGO (la más vistosa, a pedido del cliente), con el mismo marco y
// el mismo logotipo, pero en vez del nombre+precio de un producto lleva el
// nombre de la colección. No es un producto —no hay nada que "no inventar"
// acá, el nombre de la colección lo puso el cliente— así que no lleva precio
// ni ficha técnica, solo la marca.
//
//   node marketing/video/build-portada.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ADS = path.join(ROOT, 'marketing/ig-ads');
const OUT = path.join(HERE, 'creativos');
const TMP = path.join(HERE, '.tmp/portada');

const W = 1080;
const H = 1920;
const SEGURO = 372;

const TOKENS = Object.fromEntries(
  [...fs.readFileSync(path.join(ROOT, 'design/direcciones/florencia.css'), 'utf8')
    .matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((m) => [m[1], m[2].trim()]),
);
const C = {
  fondo: TOKENS['--bg-page'], ink: TOKENS['--text-strong'],
  body: TOKENS['--text-body'], muted: TOKENS['--text-muted'], rosa: TOKENS['--accent'],
  verde: TOKENS['--leaf'],
};

const LOGO_H = 150;                        // más grande que en los tramos de producto: acá es portada
const CAJA_TOP = SEGURO + LOGO_H + 32;
const CAJA_ALTO = 700;
const CAJA_MARGEN = 50;
const MARCO_PAD = 20;

const MARCA = `data:image/png;base64,${fs.readFileSync(path.join(ADS, 'marca/logo.png')).toString('base64')}`;

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

function medidaPng(archivo) {
  const b = fs.readFileSync(archivo);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

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
    throw new Error(`${nombre}: la portada salió ${ancho}×${alto} y tiene que ser ${W}×${H}`);
  }
}

// Recorte de tulipanes: mismo bulto, mismo archivo que usa el ítem
// "tulipanes" en catalogo.json — la foto manda, no se retoca para la portada.
const CROP = [68, 232, 2437, 1930];
const FONDO = '#F5F3F5';
const FOTO_ORIGINAL = path.join(ROOT, 'app/public/products/florero-de-10-tulipanes-2-3.jpg');

function recorte() {
  const destino = path.join(TMP, 'tulipanes-recorte.jpg');
  const [x, y, w, h] = CROP;
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', FOTO_ORIGINAL, '-vf', `crop=${w}:${h}:${x}:${y}`, destino], { stdio: 'pipe' });
  return destino;
}

fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

const src = `data:image/jpeg;base64,${fs.readFileSync(recorte()).toString('base64')}`;

const html = `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
${FUENTES}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;background:transparent;overflow:hidden}
body{font-family:'Jost',sans-serif;-webkit-font-smoothing:antialiased}
#lienzo{position:absolute;top:0;left:0;width:${W}px;height:${H}px;background:${FONDO};overflow:hidden}
.d{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;letter-spacing:-.018em;line-height:1.05;color:${C.ink}}
.mono{font-weight:500;letter-spacing:.2em;text-transform:uppercase}
</style></head><body><div id="lienzo">
<div style="position:absolute;top:${CAJA_TOP}px;left:${CAJA_MARGEN}px;right:${CAJA_MARGEN}px;height:${CAJA_ALTO}px;
     display:flex;align-items:center;justify-content:center">
  <img src="${src}" style="max-width:100%;max-height:100%;display:block">
</div>
<div style="position:absolute;top:${CAJA_TOP - MARCO_PAD}px;left:${CAJA_MARGEN - MARCO_PAD}px;
     right:${CAJA_MARGEN - MARCO_PAD}px;height:${CAJA_ALTO + MARCO_PAD * 2}px;
     border:3px solid ${C.verde}"></div>
<!-- El sello: se apoya en la esquina del marco, como un timbre sobre un
     sobre —no flota suelto en medio de la foto—, y es rosa acento, el único
     color nuevo que la regla del sistema permite: el que ya manda en el
     titular. -->
<div style="position:absolute;top:${CAJA_TOP - MARCO_PAD - 92}px;right:20px;
     width:184px;height:184px;border-radius:50%;background:${C.rosa};
     transform:rotate(-10deg);display:flex;align-items:center;justify-content:center;
     box-shadow:0 8px 24px rgba(0,0,0,.18)">
  <p class="mono" style="font-size:26px;line-height:1.35;color:#fff;text-align:center">ORDENA<br>AHORA</p>
</div>
<div style="position:absolute;top:${SEGURO}px;left:76px">
  <img src="${MARCA}" style="height:${LOGO_H}px;display:block">
</div>
<div style="position:absolute;left:0;right:0;bottom:${SEGURO}px;padding:0 76px">
  <p class="mono" style="font-size:30px;color:${C.rosa}">COLECCIÓN LIMA FLORES</p>
  <h1 class="d" style="font-size:88px;margin-top:14px">Primavera 2026</h1>
  <p class="d" style="font-size:44px;margin-top:26px">999 479 855 <span class="mono" style="font-size:22px;color:${C.muted};letter-spacing:.2em">· DELIVERY</span></p>
</div>
</div></body></html>`;

const destino = path.join(OUT, 'VID-CATALOGO-portada.jpg');
const pngTmp = path.join(TMP, 'portada.png');
png(html, pngTmp);
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', pngTmp, '-q:v', '2', destino], { stdio: 'pipe' });
console.log(`✓ Portada → marketing/video/creativos/${path.basename(destino)}`);
