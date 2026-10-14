#!/usr/bin/env node
// Arma la pieza de "Jueves de Flores a la Carta" — menú de tallos sueltos
// (rosas, mini rosas, astromelias) y follaje (eucalipto) que el cliente
// combina a su gusto. No es un anuncio del catálogo — no vende un producto
// de db/products.seed.json, vende una carta de opciones — así que vive
// fuera de marketing/ig-ads/ads.json, igual criterio que
// marketing/suscripcion/: HTML suelto con los tokens del sistema
// (.claude/skills/piezas-graficas/SKILL.md, sección "¿pieza o plantilla?").
//
// Todo el copy (productos, tallos, longitudes, colores, precios) sale tal
// cual de JUEVES_DE_FLORES_A_LA_CARTA_V2_.docx que mandó el cliente — nada
// inventado. Las fotos son reales, mandadas por WhatsApp para esta pieza
// puntual (marketing/flores-a-la-carta/fotos/).
//
//   node marketing/flores-a-la-carta/build.mjs

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const TMP = path.join(HERE, '.tmp');
fs.mkdirSync(TMP, { recursive: true });

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

function foto(nombre) {
  const archivo = path.join(HERE, 'fotos', nombre);
  const ext = path.extname(nombre).slice(1);
  const mime = ext === 'webp' ? 'webp' : ext === 'png' ? 'png' : 'jpeg';
  return `data:image/${mime};base64,${fs.readFileSync(archivo).toString('base64')}`;
}

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

/** Ancho y alto de un JPEG, leídos de su primer marcador SOF. */
function medidaJpg(archivo) {
  const b = fs.readFileSync(archivo);
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marcador = b[i + 1];
    if (marcador >= 0xc0 && marcador <= 0xcf && marcador !== 0xc4 && marcador !== 0xc8 && marcador !== 0xcc) {
      return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
    }
    const largo = b.readUInt16BE(i + 2);
    i += 2 + largo;
  }
  throw new Error(`${archivo}: no encontré el SOF del JPEG`);
}

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

/* ── copy: tal cual JUEVES_DE_FLORES_A_LA_CARTA_V2_.docx ── */
const ITEMS = [
  {
    foto: 'rosas-24.webp', nombre: 'Paquete de 24 Rosas',
    detalle: '24 tallos · 60 cm', colores: 'Blanco, Ivory, amarillo, rojo y fucsia',
    precio: 'S/80',
  },
  {
    foto: 'mini-rosas.webp', nombre: 'Paquete de Mini Rosas',
    detalle: '12 tallos · 30 a 35 cm', colores: 'Blanco, amarillo, anaranjado y fucsia',
    precio: 'S/60',
  },
  {
    foto: 'astromelias.png', nombre: 'Paquete de Astromelias 🌼',
    detalle: '24 tallos · 50 cm', colores: 'Blanco, amarillo, anaranjado y fucsia · uno o dos colores',
    precio: 'S/30',
  },
  {
    foto: 'eucalipto-corto.png', nombre: 'Eucalipto Silver Dólar 🌿',
    detalle: 'Corto: +15 tallos · 40 cm aprox. · Largo: +5 tallos ramificados · 89 cm aprox.',
    colores: 'Follaje fresco, para complementar o dar volumen',
    precio: 'S/30 corto · S/42 largo',
  },
];

const PASOS = [
  'Elige tus flores favoritas de la carta.',
  'Combínalas con tu follaje preferido.',
  'Recibe tus flores frescas y arma tu ramo a tu gusto.',
];

function filete(margin = '36px 0 0') {
  return `<div style="height:1px;background:${C.linea};margin:${margin}"></div>`;
}

function pagina(w, h) {
  const fila = (it) => `
  <div style="display:flex;gap:36px;align-items:flex-start;padding:40px 0">
    <img src="${foto(it.foto)}" style="width:280px;height:280px;object-fit:cover;flex:none;display:block">
    <div style="min-width:0">
      <h2 class="d" style="font-size:44px;font-weight:500;font-style:normal;color:${C.ink};margin:0">${it.nombre}</h2>
      <p style="font-size:26px;color:${C.body};margin-top:10px;line-height:1.4">${it.detalle}</p>
      <p style="font-size:24px;color:${C.muted};margin-top:8px;line-height:1.4">${it.colores}</p>
      <p style="font-family:'Jost',sans-serif;font-weight:800;font-size:40px;color:${C.rosa};margin-top:16px">${it.precio}</p>
    </div>
  </div>`;

  const paso = (texto, i) => `
  <div style="display:flex;gap:24px;align-items:baseline;margin-top:${i === 0 ? 0 : 20}px">
    <span class="d" style="font-size:40px;font-weight:500;color:${C.rosa};flex:none;width:52px">${i + 1}</span>
    <p style="font-size:30px;color:${C.ink};line-height:1.4;margin:0">${texto}</p>
  </div>`;

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<style>
${FUENTES}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;background:${C.fondo}}
body{font-family:'Jost',sans-serif;-webkit-font-smoothing:antialiased;padding:64px 76px}
.d{font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;letter-spacing:-.018em;color:${C.ink}}
.d em{font-style:italic;color:${C.rosa}}
.mono{font-weight:600;letter-spacing:.16em;text-transform:uppercase}
</style></head><body>

  <span class="mono" style="display:block;font-size:28px;color:${C.rosa}">Jueves de flores</span>
  <h1 class="d" style="font-size:132px;margin-top:14px;line-height:.94">A la <em>Carta</em></h1>
  <p style="font-size:34px;color:${C.body};margin-top:24px;line-height:1.38;max-width:26ch">
    Arma tu combinación ideal: <strong style="color:${C.ink}">flores + follaje = tu ramo a tu manera</strong> ✨
  </p>
  ${filete('44px 0 0')}

  ${ITEMS.map((it, i) => it !== ITEMS[0] ? filete() + fila(it) : fila(it)).join('')}

  ${filete('8px 0 0')}
  <p class="mono" style="font-size:28px;color:${C.rosa};margin-top:48px">¿Cómo funciona?</p>
  <div style="margin-top:22px">
    ${PASOS.map(paso).join('')}
  </div>

  ${filete('48px 0 0')}
  <p style="font-size:30px;color:${C.ink};margin-top:32px">
    📱 Pedidos por WhatsApp: <strong>999 479 855</strong>
  </p>
  <p style="font-size:26px;color:${C.muted};margin-top:10px">🚚 Delivery disponible</p>

  ${filete('40px 0 0')}
  <img src="data:image/png;base64,${LOGO}" style="height:112px;display:block;margin:28px auto 0">

</body></html>`;
}

function estatica() {
  const w = 1080;
  // Normal flow (nada de position:absolute para el layout): se arma en el
  // orden en que aparece y se mide con el mismo truco que marketing/
  // suscripcion/build.mjs — un recorte exacto del borde inferior — en vez
  // de calcular alturas a mano, que es lo que salió mal ahí la primera vez.
  let h = 2760;
  const jpg = path.join(HERE, 'flores-a-la-carta.jpg');
  capturar(pagina(w, h), w, h, jpg);
  console.log(`  ✓ flores-a-la-carta.jpg   ${w}×${h}`);
}

estatica();
