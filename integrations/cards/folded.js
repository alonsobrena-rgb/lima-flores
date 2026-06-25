// integrations/cards/folded.js
// Diseño de la tarjeta de regalo PLEGADA (díptico que se dobla por la mitad).
// El mensaje del cliente va impreso ADENTRO; la portada lleva la marca.
//
// Formato: cerrada 90×65 mm (apaisada) · abierta 90×130 mm (retrato) · DOBLEZ
// SUPERIOR (se abre una mitad sobre la otra). El panel de atrás va girado 180° en
// la lámina para que quede derecho al doblar.
//
// Devuelve un documento HTML de 2 páginas (96×136 mm c/u, con 3 mm de sangrado):
//   mode 'print' → impuesto para doblar (marcas de corte/doblez, paneles girados).
//   mode 'view'  → todo derecho, para previsualizar.
// Se rasteriza/Imprime con Puppeteer en ./generate.js.
'use strict';

const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, 'assets');
const dataUrl = (f, mime) =>
  `data:${mime};base64,` + fs.readFileSync(path.join(ASSETS, f)).toString('base64');
const LOGO = dataUrl('logo.png', 'image/png');
const BOUQUET = dataUrl('bouquet.png', 'image/png');

// Tope de caracteres del mensaje: una tarjeta se lee de un vistazo.
const NOTE_MAX = 220;

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function noteHtml(note) {
  return esc(String(note || '').slice(0, NOTE_MAX).trim()).replace(/\r?\n/g, '<br>');
}

// ---- Contacto (de la tarjeta de referencia) ----
const C = {
  web: 'www.limaflores.pe', ig: 'lima_flores',
  mail: 'ventas@limaflores.pe', tel: '999 479 855 · 942 212 668',
};

// ---- Iconos de línea fina ----
const ic = {
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>`,
  ig: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" stroke="none"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>`,
  tel: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3.5h3l1.6 4-2 1.4a12 12 0 0 0 5.5 5.5l1.4-2 4 1.6v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 3 6.7 2 2 0 0 1 5 3.5Z"/></svg>`,
};

// ---- Botánicas de línea ----
const sprig = (w = 60, color = '#B6C2A7') => `
<svg width="${w}" viewBox="0 0 120 40" fill="none" stroke="${color}" stroke-width="1.3" stroke-linecap="round">
  <path d="M4 20 C 30 8, 70 8, 116 20"/>
  <g fill="${color}" stroke="none" opacity="0.9">
    <ellipse cx="24" cy="13.5" rx="6" ry="2.6" transform="rotate(-22 24 13.5)"/>
    <ellipse cx="44" cy="10.5" rx="6.5" ry="2.7" transform="rotate(-12 44 10.5)"/>
    <ellipse cx="66" cy="10" rx="6.5" ry="2.7" transform="rotate(8 66 10)"/>
    <ellipse cx="86" cy="12.5" rx="6" ry="2.6" transform="rotate(20 86 12.5)"/>
    <ellipse cx="34" cy="18" rx="5" ry="2.2" transform="rotate(18 34 18)"/>
    <ellipse cx="76" cy="18.5" rx="5" ry="2.2" transform="rotate(-18 76 18.5)"/>
  </g>
</svg>`;

const corner = (s = 90, color = '#C7B9A0') => `
<svg width="${s}" viewBox="0 0 140 140" fill="none" stroke="${color}" stroke-width="1.2" stroke-linecap="round">
  <path d="M6 6 C 40 18, 70 40, 92 78 C 102 96, 110 116, 116 134"/>
  <g fill="${color}" stroke="none" opacity="0.9">
    <ellipse cx="30" cy="16" rx="7" ry="3" transform="rotate(20 30 16)"/>
    <ellipse cx="52" cy="30" rx="7.5" ry="3.1" transform="rotate(35 52 30)"/>
    <ellipse cx="72" cy="52" rx="7.5" ry="3.1" transform="rotate(52 72 52)"/>
    <ellipse cx="88" cy="78" rx="7" ry="3" transform="rotate(66 88 78)"/>
    <ellipse cx="20" cy="30" rx="5.5" ry="2.4" transform="rotate(60 20 30)"/>
    <ellipse cx="40" cy="48" rx="5.5" ry="2.4" transform="rotate(70 40 48)"/>
    <ellipse cx="62" cy="72" rx="5.5" ry="2.4" transform="rotate(80 62 72)"/>
  </g>
</svg>`;

const contact = (cls = '') => `
<ul class="contact ${cls}">
  <li>${ic.globe}<span>${C.web}</span></li>
  <li>${ic.ig}<span>${C.ig}</span></li>
  <li>${ic.mail}<span>${C.mail}</span></li>
  <li>${ic.tel}<span>${C.tel}</span></li>
</ul>`;

// ============================================================
//  5 estilos. Cada uno define el EXTERIOR (portada + contraportada) y la cara
//  interna izquierda (marca de agua). El mensaje (interna derecha) se compone
//  aparte con los datos del pedido.
//  Las claves coinciden con las plantillas guardadas en BD (orders.card_template).
// ============================================================
const SIG = {
  atelier: 'Con cariño,', jardin: '—', blush: 'Con amor,', botanica: '—', minimal: '—',
};

// Todas las PORTADAS usan el logo real de Lima Flores (img), centrado y con aire.
// El cuerpo (contraportada/interior) varía fuentes y acentos por estilo.
const STYLES = {
  // 1 · ATELIER — papel blanco, acento rosa.
  atelier: {
    ground: '#FFFFFF', tint: 'ink',
    front: `<div class="pad center mid">
        <img class="logo" src="${LOGO}">
        <div class="eyebrow rosa mt3">para alguien especial</div>
      </div>`,
    back: `<div class="pad center mid gapped">
        <div class="script rosa">grazie</div>
        ${contact('mini')}
      </div>`,
    inside: `<div class="pad center mid"><img class="bq-watermark" src="${BOUQUET}"></div>`,
  },

  // 2 · MINIMAL — papel blanco, sobrio, un filete fino.
  minimal: {
    ground: '#FFFFFF', tint: 'ink',
    front: `<div class="pad center mid">
        <img class="logo" src="${LOGO}">
        <div class="rule mt3"></div>
        <div class="eyebrow rosa mt">lima · perú</div>
      </div>`,
    back: `<div class="pad center mid gapped">
        ${contact('mini')}
        <div>${sprig(58, '#C7B9A0')}</div>
      </div>`,
    inside: `<div class="pad center mid"><div class="dot rosa"></div></div>`,
  },

  // 3 · JARDÍN — fresco, guirnalda botánica fina.
  jardin: {
    ground: '#FFFFFF', tint: 'verde',
    front: `<div class="pad center mid">
        <img class="logo" src="${LOGO}">
        <div class="eyebrow verde mt2">flores frescas · de temporada</div>
        <div class="garland">${sprig(72, '#A9B894')}</div>
      </div>`,
    back: `<div class="pad center mid gapped">
        <div class="script rosa">con flores</div>
        ${contact('mini')}
        <div>${sprig(58, '#A9B894')}</div>
      </div>`,
    inside: `<div class="pad center mid"><div class="sprig-soft">${sprig(64, '#C9D3BC')}</div></div>`,
  },

  // 4 · BOTÁNICA — papel blanco, ramas en esquinas opuestas, logo centrado.
  botanica: {
    ground: '#FFFFFF', tint: 'ink',
    front: `<div class="pad center mid">
        <div class="corner tl">${corner(64)}</div>
        <div class="corner br flip">${corner(64)}</div>
        <img class="logo" src="${LOGO}">
        <div class="eyebrow ink2 mt3">hecho a mano · de temporada</div>
      </div>`,
    back: `<div class="pad center mid">
        <div class="corner tl">${corner(58)}</div>
        <div class="corner br flip">${corner(58)}</div>
        ${contact('mini')}
      </div>`,
    inside: `<div class="pad center mid"><div class="corner tl">${corner(56, '#D7CBB6')}</div></div>`,
  },

  // 5 · BLUSH — papel blanco, acento rosa fuerte.
  blush: {
    ground: '#FFFFFF', tint: 'rosa',
    front: `<div class="pad center mid">
        <img class="logo" src="${LOGO}">
        <div class="eyebrow rosa mt3">con todo nuestro cariño</div>
      </div>`,
    back: `<div class="pad center mid gapped">
        <div class="script rosa">grazie</div>
        ${contact('mini rosa-ink')}
      </div>`,
    inside: `<div class="pad center mid"><img class="bq-watermark soft" src="${BOUQUET}"></div>`,
  },
};

const STYLE_KEYS = Object.keys(STYLES);
function randomStyle() { return STYLE_KEYS[Math.floor(Math.random() * STYLE_KEYS.length)]; }

// Panel del mensaje (cara interna derecha) con los datos del pedido.
function messagePanel(style, d) {
  const tint = STYLES[style].tint;
  const sigWord = SIG[style] || 'Con cariño,';
  const note = noteHtml(d.note);
  const para = d.recipient ? `<div class="eyebrow para">Para ${esc(d.recipient)}</div>` : '';
  const firma = d.buyer ? `<div class="firma">${sigWord} ${esc(d.buyer)}</div>` : '';
  return `<div class="pad msg center mid t-${tint}">
      <div class="msg-sprig">${sprig(42, '#C2CBB2')}</div>
      ${para}
      <div class="message">${note}</div>
      ${firma}
    </div>`;
}

// ============================================================
//  CSS
// ============================================================
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500;1,600&family=Jost:wght@300;400;500;600&family=Pinyon+Script&display=swap');
:root{
  --ivory-50:#FBF9F4; --ivory-100:#F6F3EC; --ivory-300:#E4DDD0;
  --ink-900:#2A2623; --ink-500:#6E6862; --ink-400:#8E8A86; --ink-300:#B4ADA4;
  --rosa-500:#9E2B5E; --rosa-600:#842049; --rosa-700:#6A1A3B; --verde-500:#7E8E6E; --verde-300:#B6C2A7;
}
*{box-sizing:border-box; -webkit-print-color-adjust:exact; print-color-adjust:exact;}
html,body{margin:0;padding:0;}
.page{position:relative; width:96mm; height:136mm; overflow:hidden; background:#fff; page-break-after:always;}
.page:last-child{page-break-after:auto;}
.bleed{position:absolute; inset:0;}
.trim{position:absolute; left:3mm; top:3mm; width:90mm; height:130mm; display:flex; flex-direction:column;}
.panel{width:90mm; height:65mm; position:relative; overflow:hidden;}
.panel.rot{transform:rotate(180deg);}

.mark{position:absolute; background:#C9C2B6;}
.cm-h{height:.22mm; width:2.6mm;}
.cm-v{width:.22mm; height:2.6mm;}
.fold{background:#9E2B5E; opacity:.5;}

.pad{position:absolute; inset:5mm; display:flex; flex-direction:column;}
.center{align-items:center; text-align:center;}
.mid{justify-content:center;}
.between{justify-content:space-between;}
.mt{margin-top:1.4mm;} .mt2{margin-top:2.5mm;} .mt3{margin-top:3.5mm;}
.gapped{gap:4mm;}

.script{font-family:'Pinyon Script',cursive; font-size:22pt; line-height:1;}
.script.rosa{color:var(--rosa-500);}
.eyebrow{font-family:'Jost',sans-serif; font-weight:400; text-transform:uppercase; letter-spacing:.28em; font-size:5pt; color:var(--ink-400);}
.eyebrow.ink{color:var(--ink-500);} .eyebrow.ink2{color:var(--ink-400);}
.eyebrow.rosa{color:var(--rosa-500);} .eyebrow.verde{color:var(--verde-500);}

.logo{width:46mm; height:auto;}
.bq-watermark{width:44mm; height:auto; opacity:.14;}
.bq-watermark.soft{opacity:.2;}
.garland{margin-top:3mm;}
.sprig-soft{opacity:.5;}

.contact{list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:1.4mm;}
.contact li{display:flex; align-items:center; gap:1.6mm; font-family:'Jost',sans-serif; font-weight:400; font-size:6pt; color:var(--ink-500); letter-spacing:.02em;}
.contact svg{width:3.1mm; height:3.1mm; color:var(--verde-500); flex:0 0 auto;}
.contact.rosa-ink li{color:var(--rosa-700);}
.contact.rosa-ink svg{color:var(--rosa-500);}
.contact.stack{align-items:flex-start;}
.contact.mini li{font-size:5.6pt;}

.rule{width:18mm; height:.3mm; background:var(--ink-300); margin:0;}
.rule.mt3{margin-top:3.5mm;}
.msg-sprig{margin-bottom:3.5mm;}
.dot{width:1.6mm; height:1.6mm; border-radius:50%;}
.dot.rosa{background:var(--rosa-500);}
.corner{position:absolute;}
.corner.tl{top:2mm; left:2mm;}
.corner.br{bottom:2mm; right:2mm;}
.corner.flip{transform:rotate(180deg);}

/* Mensaje impreso (cara interna) */
.msg{justify-content:center; padding:9mm 7mm;}
.msg .para{margin-bottom:3.5mm; color:var(--ink-400);}
.message{font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:400;
  line-height:1.18; color:var(--ink-900); font-size:19pt; max-width:74mm;
  overflow-wrap:break-word; word-break:break-word;}
.firma{font-family:'Cormorant Garamond',serif; font-style:italic; font-weight:500;
  font-size:13pt; margin-top:4.5mm; color:var(--ink-500);}
.msg.t-rosa .message{color:var(--rosa-700);} .msg.t-rosa .firma{color:var(--rosa-600);} .msg.t-rosa .para{color:var(--rosa-500);}
.msg.t-verde .message{color:#33402a;} .msg.t-verde .firma{color:var(--verde-500);}
`;

// Construye una página (un lado) con panel superior + inferior + marcas.
function pageHtml(ground, topHtml, topRot, botHtml, botRot, marksOn) {
  const marks = marksOn ? `
    <div class="mark cm-h" style="left:0;top:3mm"></div>
    <div class="mark cm-v" style="left:3mm;top:0"></div>
    <div class="mark cm-h" style="right:0;top:3mm"></div>
    <div class="mark cm-v" style="right:3mm;top:0"></div>
    <div class="mark cm-h" style="left:0;bottom:3mm"></div>
    <div class="mark cm-v" style="left:3mm;bottom:0"></div>
    <div class="mark cm-h" style="right:0;bottom:3mm"></div>
    <div class="mark cm-v" style="right:3mm;bottom:0"></div>
    <div class="mark fold cm-h" style="left:0;top:50%;transform:translateY(-50%)"></div>
    <div class="mark fold cm-h" style="right:0;top:50%;transform:translateY(-50%)"></div>` : '';
  return `<div class="page">
    <div class="bleed" style="background:${ground}"></div>
    <div class="trim">
      <div class="panel${topRot ? ' rot' : ''}">${topHtml}</div>
      <div class="panel${botRot ? ' rot' : ''}">${botHtml}</div>
    </div>
    ${marks}
  </div>`;
}

// Script que reduce el tamaño del mensaje hasta que el bloque cabe en el panel
// (que tiene overflow:hidden) — así un "Te amo" se ve grande y 220 caracteres
// siguen entrando sin recortarse ni pegarse a los bordes.
const FIT_SCRIPT = `
<script>(function(){
  var msg=document.querySelector('.message');
  var pad=msg&&msg.closest('.pad.msg');
  function fit(){
    if(!msg||!pad) return;
    var len=(msg.textContent||'').trim().length;
    var size= len>160?13: len>110?15: len>60?17: 20;   // pt
    msg.style.fontSize=size+'pt';
    var guard=0;
    while(pad.scrollHeight>pad.clientHeight+1 && size>8 && guard<80){ size-=0.5; msg.style.fontSize=size+'pt'; guard++; }
  }
  if(document.fonts&&document.fonts.ready){document.fonts.ready.then(function(){fit();window.__cardReady=true;});}
  else{fit();window.__cardReady=true;}
  setTimeout(function(){fit();window.__cardReady=true;},2500);
})();</script>`;

/**
 * Documento HTML de la tarjeta plegada.
 * El DISEÑO COMPLETO (exterior + interior) siempre está definido aquí; `faces`
 * solo decide qué se rasteriza:
 *   'both'  → 2 páginas: exterior (portada+contraportada) + interior (mensaje+cara interna).
 *   'inner' → 1 página: solo la CARA INTERNA (la "segunda hoja").
 * @param {object} o
 * @param {string} o.style     clave de estilo (atelier|minimal|jardin|botanica|blush)
 * @param {'print'|'view'} o.mode
 * @param {'both'|'inner'} [o.faces] qué caras renderizar (por defecto 'both')
 * @param {string} [o.recipient] "Para …"
 * @param {string} [o.note]      mensaje
 * @param {string} [o.buyer]     firma
 */
function renderFoldedDoc(o = {}) {
  const style = STYLES[o.style] ? o.style : randomStyle();
  const s = STYLES[style];
  const mode = o.mode === 'view' ? 'view' : 'print';
  const faces = o.faces === 'inner' ? 'inner' : 'both';
  const msg = messagePanel(style, o);
  let p1, p2;
  if (mode === 'print') {
    // Panel de arriba girado 180° en ambas caras → derecho al doblar.
    p1 = pageHtml(s.ground, s.back, true, s.front, false, true);
    p2 = pageHtml(s.ground, msg, true, s.inside, true, true);
  } else {
    p1 = pageHtml(s.ground, s.front, false, s.back, false, false);
    p2 = pageHtml(s.ground, msg, false, s.inside, false, false);
  }
  // De momento se imprime/genera solo la cara interna (p2); el exterior (p1) sigue
  // guardado en el diseño por si se quiere volver a la tarjeta completa.
  const body = faces === 'inner' ? p2 : (p1 + p2);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${CSS}</style></head>
  <body>${body}${FIT_SCRIPT}</body></html>`;
}

module.exports = { renderFoldedDoc, STYLE_KEYS, randomStyle, NOTE_MAX };
