// Config oficial de Puppeteer (la lee su script de instalación).
// skipDownload: NO descargar Chrome durante `npm ci`. Esa descarga es flaky y
// rompía el build de Railway (extracción de Chrome v149 falla en el builder de
// Nixpacks). En runtime usamos el chromium del sistema que Nixpacks instala vía
// apt — ver integrations/cards/generate.js → resolveChromium().
// En local, si quieres regenerar tarjetas y no tienes chromium del sistema,
// corre: `node node_modules/puppeteer/install.mjs` con PUPPETEER_SKIP_DOWNLOAD=0.
module.exports = {
  skipDownload: true,
};
