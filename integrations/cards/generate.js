// integrations/cards/generate.js
// Genera la tarjeta de regalo PLEGADA con Puppeteer + Chromium headless:
// un PDF de 2 páginas (96×136 mm, para imprimir y doblar) + un PNG de
// previsualización (caras apiladas en orientación de lectura).
//
// API:
//   const { generateCard } = require('./generate');
//   const { pdf, png, template } = await generateCard({ recipientName, buyerName, note });
//
// CLI (previsualizar):
//   node integrations/cards/generate.js --all                 → genera los 5 estilos
//   node integrations/cards/generate.js "Mensaje" "Para" "De" → uno al azar
'use strict';

const fs = require('fs');
const path = require('path');
const {
  renderFoldedDoc,
  randomStyle,
  STYLE_KEYS,
  NOTE_MAX,
} = require('./folded');

// Compat: nombres antiguos esperados por otros módulos / CLI.
const TEMPLATE_KEYS = STYLE_KEYS;
const CARD_NOTE_MAX = NOTE_MAX;
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

// Candidatos de ejecutable de Chromium, en orden de preferencia. Probamos cada
// uno hasta que UNO ARRANCA de verdad: así, si un binario existe pero está roto
// (p. ej. el stub de snap en /usr/bin/chromium-browser, que pide `snap install
// chromium`), seguimos con el siguiente en vez de fallar. `undefined` = el
// Chrome que trae puppeteer (bundleado en dev local).
function chromiumCandidates() {
  const fs = require('fs');
  const exists = (p) => { try { return typeof p === 'string' && p.length > 0 && fs.existsSync(p); } catch { return false; } };
  const out = [];
  const push = (p) => { if (p && !out.includes(p)) out.push(p); };

  if (process.env.PUPPETEER_EXECUTABLE_PATH) push(process.env.PUPPETEER_EXECUTABLE_PATH);
  // Chromium "real" del sistema (Nixpacks en Railway lo instala aquí).
  for (const c of ['/usr/bin/chromium', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome']) {
    if (exists(c)) push(c);
  }
  // El Chrome bundleado de puppeteer (si se descargó).
  try { const p = puppeteer().executablePath(); if (exists(p)) push(p); } catch { /* ignore */ }
  out.push(undefined); // deja que puppeteer decida
  // Último recurso: el stub de snap (suele estar roto, por eso va al final).
  if (exists('/usr/bin/chromium-browser')) push('/usr/bin/chromium-browser');
  return out;
}

// Navegador compartido entre llamadas (arranque ~1s; reusarlo abarata cada tarjeta).
let _browser = null;
let _browserPromise = null;
async function getBrowser() {
  if (_browser && _browser.connected !== false) return _browser;
  if (_browserPromise) return _browserPromise;
  _browserPromise = (async () => {
    const args = ['--no-sandbox', '--disable-dev-shm-usage'];
    let lastErr;
    for (const executablePath of chromiumCandidates()) {
      try {
        const b = await puppeteer().launch({ headless: 'new', executablePath, args });
        b.on('disconnected', () => { _browser = null; });
        _browser = b;
        return b;
      } catch (e) {
        lastErr = e;
        // Probar el siguiente candidato.
      }
    }
    throw new Error(
      'No se pudo arrancar Chromium para generar la tarjeta. Instala un Chromium ' +
      'funcional (p. ej. `apt-get install -y chromium`) o define PUPPETEER_EXECUTABLE_PATH. ' +
      'Detalle: ' + (lastErr && lastErr.message ? lastErr.message.split('\n')[0] : 'desconocido')
    );
  })().finally(() => { _browserPromise = null; });
  return _browserPromise;
}

async function closeBrowser() {
  if (_browser) { try { await _browser.close(); } catch (_) {} _browser = null; }
}

/**
 * Genera la tarjeta PLEGADA de un pedido: un PDF de 2 páginas listo para
 * imprenta (exterior + interior, impuesto para doblar) y un PNG de
 * previsualización (las dos caras en orientación de lectura, apiladas).
 *
 * @param {object} opts
 * @param {string} [opts.recipientName] "Para …"
 * @param {string} [opts.buyerName]     firma
 * @param {string} opts.note            mensaje de la tarjeta
 * @param {string} [opts.template]      clave de estilo; al azar si se omite
 * @returns {Promise<{ pdf: Buffer, png: Buffer, template: string }>}
 */
async function generateCard(opts = {}) {
  const template = TEMPLATE_KEYS.includes(opts.template) ? opts.template : randomStyle();
  const note = String(opts.note || '').slice(0, CARD_NOTE_MAX);
  const common = { style: template, recipient: opts.recipientName, buyer: opts.buyerName, note };

  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // 1) PDF imprenta (impuesto para doblar) — 2 páginas de 96×136 mm.
    await page.setContent(renderFoldedDoc({ ...common, mode: 'print' }), { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
    await page.waitForFunction('window.__cardReady === true', { timeout: 5000 }).catch(() => {});
    const pdf = await page.pdf({ width: '96mm', height: '136mm', printBackground: true, pageRanges: '1-2' });

    // 2) PNG de previsualización (orientación de lectura) — caras apiladas.
    await page.setContent(renderFoldedDoc({ ...common, mode: 'view' }), { waitUntil: 'load', timeout: 20000 });
    await page.evaluate(async () => { if (document.fonts) await document.fonts.ready; });
    await page.waitForFunction('window.__cardReady === true', { timeout: 5000 }).catch(() => {});
    await page.setViewport({ width: 363, height: 1028, deviceScaleFactor: SCALE });
    const png = await page.screenshot({ type: 'png', fullPage: true });

    return { pdf: Buffer.from(pdf), png: Buffer.from(png), template };
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { generateCard, closeBrowser };

// ─── CLI ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  (async () => {
    const outDir = path.join(__dirname, 'out');
    fs.mkdirSync(outDir, { recursive: true });
    const args = process.argv.slice(2);

    if (args[0] === '--all') {
      const sample = 'Que cada pétalo te recuerde lo mucho que te quiero. Feliz cumpleaños, mi vida.';
      for (const key of TEMPLATE_KEYS) {
        const { pdf, png } = await generateCard({
          template: key, note: sample, recipientName: 'Valentina', buyerName: 'Alonso',
        });
        fs.writeFileSync(path.join(outDir, `card-${key}.pdf`), pdf);
        fs.writeFileSync(path.join(outDir, `card-${key}.png`), png);
        console.log('✓', `card-${key}.pdf / .png`);
      }
    } else {
      const note = args[0] || 'Con todo mi cariño en este día tan especial.';
      const recipientName = args[1] || 'Valentina';
      const buyerName = args[2] || 'Alonso';
      const { pdf, png, template } = await generateCard({ note, recipientName, buyerName });
      fs.writeFileSync(path.join(outDir, `card-${template}.pdf`), pdf);
      fs.writeFileSync(path.join(outDir, `card-${template}.png`), png);
      console.log('✓', `card-${template}.pdf / .png`, `(estilo: ${template})`);
    }

    await closeBrowser();
    process.exit(0);
  })().catch((e) => { console.error('✗', e.message); process.exit(1); });
}
