// integrations/cards/generate.js
// Rasteriza una tarjeta (1080×1350) a PNG usando Puppeteer + Chromium headless.
//
// API:
//   const { generateCardPng } = require('./generate');
//   const { buffer, template } = await generateCardPng({ recipientName, buyerName, note });
//
// CLI (previsualizar):
//   node integrations/cards/generate.js --all                 → genera las 5 plantillas
//   node integrations/cards/generate.js "Mensaje" "Para" "De" → una al azar
'use strict';

const fs = require('fs');
const path = require('path');
const {
  renderCard,
  randomTemplateKey,
  TEMPLATE_KEYS,
  CARD_NOTE_MAX,
} = require('./templates');

const CARD_W = 1080;
const CARD_H = 1350;
const SCALE = 2; // deviceScaleFactor → PNG nítido para impresión / pantalla retina

// Lazy require: si Puppeteer no está instalado (p. ej. en un entorno mínimo),
// la función falla de forma controlada en vez de tumbar el require del módulo.
let _puppeteer = null;
function puppeteer() {
  if (_puppeteer) return _puppeteer;
  try { _puppeteer = require('puppeteer'); }
  catch (e) {
    throw new Error('Puppeteer no está instalado. Ejecuta `npm i puppeteer` para generar tarjetas.');
  }
  return _puppeteer;
}

// Ruta al Chromium a usar. En Railway no descargamos el Chrome de puppeteer
// (ver .npmrc → puppeteer_skip_download), así que usamos el chromium del sistema
// que instala Nixpacks. En local, si no hay ninguno, devolvemos undefined y
// puppeteer usa su Chrome bundleado.
function resolveChromium() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH;
  const fs = require('fs');
  for (const c of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']) {
    try { if (fs.existsSync(c)) return c; } catch { /* ignore */ }
  }
  return undefined; // puppeteer usará su Chrome bundleado (dev local)
}

// Navegador compartido entre llamadas (arranque ~1s; reusarlo abarata cada tarjeta).
let _browser = null;
let _browserPromise = null;
async function getBrowser() {
  if (_browser && _browser.connected !== false) return _browser;
  if (_browserPromise) return _browserPromise;
  _browserPromise = puppeteer()
    .launch({ headless: 'new', executablePath: resolveChromium(), args: ['--no-sandbox', '--disable-dev-shm-usage'] })
    .then((b) => {
      _browser = b;
      b.on('disconnected', () => { _browser = null; });
      return b;
    })
    .finally(() => { _browserPromise = null; });
  return _browserPromise;
}

async function closeBrowser() {
  if (_browser) { try { await _browser.close(); } catch (_) {} _browser = null; }
}

/**
 * Genera el PNG de una tarjeta.
 * @param {object} opts
 * @param {string} [opts.recipientName] "Para …"
 * @param {string} [opts.buyerName]     firma
 * @param {string} opts.note            mensaje de la tarjeta
 * @param {string} [opts.template]      clave de plantilla; al azar si se omite
 * @returns {Promise<{ buffer: Buffer, template: string }>}
 */
async function generateCardPng(opts = {}) {
  const template = TEMPLATE_KEYS.includes(opts.template) ? opts.template : randomTemplateKey();
  const note = String(opts.note || '').slice(0, CARD_NOTE_MAX);
  const html = renderCard(template, {
    recipientName: opts.recipientName,
    buyerName: opts.buyerName,
    note,
  });

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setViewport({ width: CARD_W, height: CARD_H, deviceScaleFactor: SCALE });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 20000 });
    // Espera a que el script de auto-ajuste termine de medir/encoger el texto.
    await page.waitForFunction('window.__cardReady === true', { timeout: 5000 }).catch(() => {});
    const el = await page.$('.card');
    const buffer = await (el || page).screenshot({ type: 'png' });
    return { buffer, template };
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { generateCardPng, closeBrowser, CARD_W, CARD_H };

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const outDir = path.join(__dirname, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const args = process.argv.slice(2);

    if (args[0] === '--all') {
      const sample = 'Que cada pétalo te recuerde lo mucho que te quiero. Feliz cumpleaños, mi vida.';
      for (const key of TEMPLATE_KEYS) {
        const { buffer } = await generateCardPng({
          template: key, note: sample, recipientName: 'Valentina', buyerName: 'Alonso',
        });
        const file = path.join(outDir, `card-${key}.png`);
        fs.writeFileSync(file, buffer);
        console.log('✓', file);
      }
    } else {
      const note = args[0] || 'Con todo mi cariño en este día tan especial.';
      const recipientName = args[1] || 'Valentina';
      const buyerName = args[2] || 'Alonso';
      const { buffer, template } = await generateCardPng({ note, recipientName, buyerName });
      const file = path.join(outDir, `card-${template}.png`);
      fs.writeFileSync(file, buffer);
      console.log('✓', file, `(plantilla: ${template})`);
    }

    await closeBrowser();
    process.exit(0);
  })().catch((e) => { console.error('✗', e.message); process.exit(1); });
}
