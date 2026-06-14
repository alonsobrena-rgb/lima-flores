// integrations/cards/templates.js
// Cinco plantillas de tarjeta de regalo para Lima Flores. Cada una devuelve un
// documento HTML completo de 1080×1350 px (4:5, vertical) listo para rasterizar
// a PNG con Puppeteer (ver ./generate.js).
//
// Paleta y tipografía heredadas del design system del sitio (site/css/lima.css):
//   bone #F4EFE5 · paper #FBF8F1 · ink #1B1A17 · moss-deep #2F3925
//   rosa #9E2B5E · gold #A57F45 · terra #B6855E · bloom #C99CA9
//   display: Cormorant Garamond · body/labels: Jost
'use strict';

// ─── Límite de caracteres del mensaje ───────────────────────────────────────
// Una tarjeta física que acompaña al arreglo se lee de un vistazo. Más de ~220
// caracteres obliga a tipografía pequeña y rompe la elegancia del diseño. Es el
// punto en el que un mensaje cálido sigue cabiendo holgado y la fuente respira.
const CARD_NOTE_MAX = 220;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Convierte saltos de línea del mensaje en <br> (tras escapar).
function noteHtml(note) {
  const clean = String(note || '').slice(0, CARD_NOTE_MAX).trim();
  return esc(clean).replace(/\r?\n/g, '<br>');
}

// Etiquetas "Para …" / firma "— …" — opcionales y elegantes.
function paraLine(name) {
  return name ? `<div class="para">Para ${esc(name)}</div>` : '';
}
function firmaLine(name, word = '—') {
  return name ? `<div class="firma">${word} ${esc(name)}</div>` : '';
}

// ─── SVG ornamentales (trazo fino, botánicos) ───────────────────────────────
const SPRIG = (stroke) => `
<svg class="sprig" viewBox="0 0 120 60" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M60 58 C60 40 60 20 60 4" stroke="${stroke}" stroke-width="1.2" stroke-linecap="round"/>
  <path d="M60 44 C46 40 38 30 36 18 C50 22 58 32 60 44Z" stroke="${stroke}" stroke-width="1.1"/>
  <path d="M60 44 C74 40 82 30 84 18 C70 22 62 32 60 44Z" stroke="${stroke}" stroke-width="1.1"/>
  <path d="M60 30 C50 27 44 20 42 11 C52 14 58 21 60 30Z" stroke="${stroke}" stroke-width="1.1"/>
  <path d="M60 30 C70 27 76 20 78 11 C68 14 62 21 60 30Z" stroke="${stroke}" stroke-width="1.1"/>
</svg>`;

const BLOOM = (stroke, fill) => `
<svg class="bloom" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
  <g stroke="${stroke}" stroke-width="1.2">
    <circle cx="40" cy="40" r="6" fill="${fill}"/>
    <ellipse cx="40" cy="20" rx="7" ry="13"/>
    <ellipse cx="40" cy="60" rx="7" ry="13"/>
    <ellipse cx="20" cy="40" rx="13" ry="7"/>
    <ellipse cx="60" cy="40" rx="13" ry="7"/>
    <ellipse cx="26" cy="26" rx="11" ry="6" transform="rotate(45 26 26)"/>
    <ellipse cx="54" cy="54" rx="11" ry="6" transform="rotate(45 54 54)"/>
    <ellipse cx="54" cy="26" rx="11" ry="6" transform="rotate(-45 54 26)"/>
    <ellipse cx="26" cy="54" rx="11" ry="6" transform="rotate(-45 26 54)"/>
  </g>
</svg>`;

const FLOURISH = (stroke) => `
<svg class="flourish" viewBox="0 0 200 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 12 H78" stroke="${stroke}" stroke-width="1"/>
  <path d="M198 12 H122" stroke="${stroke}" stroke-width="1"/>
  <path d="M100 4 C92 8 92 16 100 20 C108 16 108 8 100 4Z" stroke="${stroke}" stroke-width="1.1"/>
  <circle cx="84" cy="12" r="1.6" fill="${stroke}"/>
  <circle cx="116" cy="12" r="1.6" fill="${stroke}"/>
</svg>`;

// ─── Shell común ────────────────────────────────────────────────────────────
// El <script> de auto-ajuste reduce el tamaño de la fuente del mensaje hasta
// que cabe sin desbordar — así un "Te amo" y un párrafo de 220 caracteres se
// ven igual de equilibrados. generate.js espera a window.__cardReady.
function shell({ key, css, body }) {
  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&family=Jost:wght@300;400;500&family=Italiana&display=swap" rel="stylesheet">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1080px; height:1350px; }
  .card {
    position:relative; width:1080px; height:1350px; overflow:hidden;
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    text-align:center; -webkit-font-smoothing:antialiased;
  }
  .wordmark {
    font-family:'Italiana',serif; letter-spacing:.18em; text-transform:uppercase;
    font-size:36px;
  }
  .para {
    font-family:'Jost',sans-serif; font-weight:400; letter-spacing:.34em;
    text-transform:uppercase; font-size:30px; margin-bottom:54px;
  }
  .message {
    font-family:'Cormorant Garamond',serif; font-weight:300; font-style:italic;
    line-height:1.18; max-width:820px;
  }
  .firma {
    font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:400;
    font-size:50px; margin-top:54px;
  }
  .sprig { width:120px; height:60px; }
  .bloom { width:80px; height:80px; }
  .flourish { width:200px; height:24px; }
  ${css}
</style></head>
<body>
  <div class="card" data-key="${key}">${body}</div>
  <script>
    (function () {
      var el = document.querySelector('.message');
      function fit() {
        if (!el) return;
        var box = el.getBoundingClientRect();
        var maxH = ${'${MAX_MSG_HEIGHT}'};
        var size = 98;                       // tamaño base (px) para textos cortos
        var len = el.textContent.trim().length;
        if (len > 60)  size = 84;
        if (len > 110) size = 72;
        if (len > 160) size = 60;
        el.style.fontSize = size + 'px';
        // Ajuste fino: encoge hasta que no desborde su contenedor vertical.
        var guard = 0;
        while (el.scrollHeight > el.clientHeight + 2 && size > 30 && guard < 60) {
          size -= 2; el.style.fontSize = size + 'px'; guard++;
        }
      }
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () { fit(); window.__cardReady = true; });
      } else { fit(); window.__cardReady = true; }
      setTimeout(function () { window.__cardReady = true; }, 2500); // failsafe
    })();
  </script>
</body></html>`.replace(/\$\{MAX_MSG_HEIGHT\}/g, '480');
}

// ─── Las 5 plantillas ───────────────────────────────────────────────────────

// 1 · ATELIER — crema, marco rosa fino, clásica de atelier.
function atelier(d) {
  return shell({
    key: 'atelier',
    css: `
      .card { background:#FBF8F1; color:#1B1A17; padding:96px; }
      .frame { position:absolute; inset:46px; border:1.5px solid #9E2B5E; }
      .frame::before { content:''; position:absolute; inset:10px; border:.5px solid #E7AFC2; }
      .wordmark { color:#9E2B5E; position:absolute; top:104px; left:0; right:0; }
      .para { color:#9A9389; }
      .firma { color:#9E2B5E; }
      .top-sprig { position:absolute; top:150px; left:0; right:0; display:flex; justify-content:center; }
      .top-sprig .sprig path { opacity:.85; }
    `,
    body: `
      <div class="frame"></div>
      <div class="wordmark">Lima Flores</div>
      <div class="top-sprig">${SPRIG('#9E2B5E')}</div>
      ${paraLine(d.recipientName)}
      <div class="message">${noteHtml(d.note)}</div>
      ${firmaLine(d.buyerName, 'Con cariño,')}
    `,
  });
}

// 2 · JARDÍN — verde musgo profundo, hilo dorado, romántica nocturna.
function jardin(d) {
  return shell({
    key: 'jardin',
    css: `
      .card { background:radial-gradient(120% 80% at 50% 0%, #3a472d 0%, #2F3925 60%, #232b1c 100%); color:#F4EFE5; padding:110px; }
      .frame { position:absolute; inset:54px; border:1px solid rgba(165,127,69,.55); }
      .wordmark { color:#C9A96A; position:absolute; top:112px; left:0; right:0; }
      .para { color:#bcae8d; opacity:.9; }
      .message { color:#F4EFE5; font-weight:300; }
      .firma { color:#C9A96A; }
      .top-bloom { position:absolute; top:150px; left:0; right:0; display:flex; justify-content:center; }
    `,
    body: `
      <div class="frame"></div>
      <div class="wordmark">Lima Flores</div>
      <div class="top-bloom">${BLOOM('#C9A96A', 'rgba(201,169,106,.18)')}</div>
      ${paraLine(d.recipientName)}
      <div class="message">${noteHtml(d.note)}</div>
      ${firmaLine(d.buyerName, '—')}
    `,
  });
}

// 3 · BLUSH — rosa empolvado, dulce y femenina.
function blush(d) {
  return shell({
    key: 'blush',
    css: `
      .card { background:linear-gradient(160deg, #FBEEF2 0%, #F7DCE6 55%, #F0C9D8 100%); color:#6A1A3B; padding:104px; }
      .frame { position:absolute; inset:50px; border:1px solid rgba(158,43,94,.35); border-radius:8px; }
      .wordmark { color:#9E2B5E; position:absolute; top:108px; left:0; right:0; }
      .para { color:#9E2B5E; opacity:.8; }
      .message { color:#6A1A3B; }
      .firma { color:#9E2B5E; }
      .heart { position:absolute; top:148px; left:0; right:0; display:flex; justify-content:center; }
      .heart svg { width:58px; height:54px; }
      .bottom-flourish { position:absolute; bottom:150px; left:0; right:0; display:flex; justify-content:center; }
    `,
    body: `
      <div class="frame"></div>
      <div class="wordmark">Lima Flores</div>
      <div class="heart"><svg viewBox="0 0 58 54" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M29 50 C8 34 4 22 12 13 C19 5 29 11 29 18 C29 11 39 5 46 13 C54 22 50 34 29 50Z" stroke="#9E2B5E" stroke-width="1.4" fill="rgba(158,43,94,.08)"/></svg></div>
      ${paraLine(d.recipientName)}
      <div class="message">${noteHtml(d.note)}</div>
      ${firmaLine(d.buyerName, 'Con amor,')}
      <div class="bottom-flourish">${FLOURISH('#9E2B5E')}</div>
    `,
  });
}

// 4 · BOTÁNICA — crema editorial, ramas en las esquinas, acentos terracota.
function botanica(d) {
  return shell({
    key: 'botanica',
    css: `
      .card { background:#F4EFE5; color:#2F3925; padding:120px 110px; }
      .wordmark { color:#B6855E; position:absolute; top:108px; left:0; right:0; letter-spacing:.22em; }
      .para { color:#8A9477; }
      .message { color:#2F3925; }
      .firma { color:#B6855E; }
      .corner { position:absolute; width:200px; height:200px; opacity:.9; }
      .corner svg { width:100%; height:100%; }
      .c-tl { top:60px; left:60px; transform:rotate(0deg); }
      .c-br { bottom:60px; right:60px; transform:rotate(180deg); }
      .rule { position:absolute; bottom:150px; left:0; right:0; display:flex; justify-content:center; }
    `,
    body: `
      ${corner('c-tl', '#8A9477')}
      ${corner('c-br', '#8A9477')}
      <div class="wordmark">Lima Flores</div>
      ${paraLine(d.recipientName)}
      <div class="message">${noteHtml(d.note)}</div>
      ${firmaLine(d.buyerName, '—')}
      <div class="rule">${FLOURISH('#B6855E')}</div>
    `,
  });
}

function corner(cls, stroke) {
  return `<div class="corner ${cls}"><svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M14 14 C70 30 110 70 150 150" stroke="${stroke}" stroke-width="1.3" stroke-linecap="round"/>
    <path d="M60 38 C50 50 48 64 54 78 C70 72 74 56 70 42 Z" stroke="${stroke}" stroke-width="1.1"/>
    <path d="M96 78 C86 90 84 104 90 118 C106 112 110 96 106 82 Z" stroke="${stroke}" stroke-width="1.1"/>
    <path d="M130 120 C120 132 118 146 124 160 C140 154 144 138 140 124 Z" stroke="${stroke}" stroke-width="1.1"/>
  </svg></div>`;
}

// 5 · MINIMAL — blanco puro, un solo punto rosa, modernísima y aireada.
function minimal(d) {
  return shell({
    key: 'minimal',
    css: `
      .card { background:#FFFFFF; color:#1B1A17; padding:140px; justify-content:flex-start; }
      .dot { width:12px; height:12px; border-radius:50%; background:#9E2B5E; margin-top:120px; margin-bottom:120px; }
      .para { color:#9A9389; letter-spacing:.4em; }
      .message { color:#1B1A17; font-style:italic; font-weight:300; }
      .firma { color:#1B1A17; opacity:.85; }
      .wordmark { color:#9A9389; position:absolute; bottom:96px; left:0; right:0; font-size:28px; letter-spacing:.34em; }
      .center { display:flex; flex-direction:column; align-items:center; justify-content:center; flex:1; }
    `,
    body: `
      <div class="dot"></div>
      <div class="center">
        ${paraLine(d.recipientName)}
        <div class="message">${noteHtml(d.note)}</div>
        ${firmaLine(d.buyerName, '—')}
      </div>
      <div class="wordmark">Lima Flores</div>
    `,
  });
}

const TEMPLATES = {
  atelier:  { name: 'Atelier',  render: atelier },
  jardin:   { name: 'Jardín',   render: jardin },
  blush:    { name: 'Blush',    render: blush },
  botanica: { name: 'Botánica', render: botanica },
  minimal:  { name: 'Minimal',  render: minimal },
};

const TEMPLATE_KEYS = Object.keys(TEMPLATES);

// Elige una plantilla al azar (clave).
function randomTemplateKey() {
  return TEMPLATE_KEYS[Math.floor(Math.random() * TEMPLATE_KEYS.length)];
}

// Renderiza el HTML de una tarjeta. data = { recipientName, buyerName, note }.
function renderCard(templateKey, data) {
  const tpl = TEMPLATES[templateKey] || TEMPLATES[randomTemplateKey()];
  return tpl.render(data || {});
}

module.exports = {
  CARD_NOTE_MAX,
  TEMPLATES,
  TEMPLATE_KEYS,
  randomTemplateKey,
  renderCard,
};
