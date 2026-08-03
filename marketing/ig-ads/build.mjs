#!/usr/bin/env node
// Genera los creativos de la campaña de Instagram a partir de marketing/ig-ads/ads.json.
//
//   node marketing/ig-ads/build.mjs
//
// Renderiza cada anuncio como HTML y lo fotografía con Chromium headless al tamaño
// exacto que pide Meta (1080×1350 para feed, 1080×1920 para historias). Las fotos
// salen del catálogo real: site/assets/products/.
//
// Dependencias: solo un Chromium en el sistema. Las tipografías (Cormorant Garamond,
// Jost, JetBrains Mono) se bajan una vez de Google Fonts y quedan cacheadas en
// .fontcache/ — ver FONT_CSS_URL. Sin red, el build usa las serif/sans del sistema.

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const PHOTOS = path.join(ROOT, 'site/assets/products');
const OUT = path.join(HERE, 'creativos');
const CACHE = path.join(HERE, '.fontcache');

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Jost:wght@300;400;500&family=JetBrains+Mono:wght@400;500&display=swap';

// Paleta del sitio — site/css/lima.css
const C = {
  bone: '#F4EFE5',
  paper: '#FBF8F1',
  ink: '#1B1A17',
  line: '#DCD4C2',
  moss: '#4F5C3F',
  terra: '#B6855E',
  gold: '#A57F45',
  rosa: '#9E2B5E',
};

/* ─────────────────────────────  utilidades  ───────────────────────────── */

function findChromium() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const globs = [
    '/opt/pw-browsers',
    path.join(os.homedir(), '.cache/ms-playwright'),
    path.join(os.homedir(), '.cache/puppeteer'),
  ];
  for (const base of globs) {
    if (!fs.existsSync(base)) continue;
    for (const dir of fs.readdirSync(base)) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
        const p = path.join(base, dir, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  for (const bin of ['google-chrome', 'chromium', 'chromium-browser']) {
    try {
      return execFileSync('which', [bin], { encoding: 'utf8' }).trim();
    } catch { /* seguimos buscando */ }
  }
  throw new Error('No encontré Chromium. Exporta CHROME_PATH=/ruta/al/chrome');
}

// Baja Google Fonts y devuelve un bloque @font-face con las woff2 embebidas en
// base64: así el render no depende de la red ni del orden de carga de fuentes.
async function fontCss() {
  const cached = path.join(CACHE, 'fonts.css');
  if (fs.existsSync(cached)) return fs.readFileSync(cached, 'utf8');

  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
  let css;
  try {
    const res = await fetch(FONT_CSS_URL, { headers: { 'User-Agent': ua } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    css = await res.text();
  } catch (err) {
    console.warn(`  ! Google Fonts no disponible (${err.message}); uso las fuentes del sistema.`);
    return '';
  }

  // Nos quedamos solo con el subset latino: es el único que usa el copy.
  const blocks = css.split('/*').filter((b) => b.startsWith(' latin */'));
  const out = [];
  for (const block of blocks) {
    const url = block.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
    if (!url) continue;
    const family = block.match(/font-family:\s*'([^']+)'/)[1];
    const style = block.match(/font-style:\s*(\w+)/)[1];
    const weight = block.match(/font-weight:\s*(\d+)/)[1];
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': ua } })).arrayBuffer());
    out.push(
      `@font-face{font-family:'${family}';font-style:${style};font-weight:${weight};` +
        `src:url(data:font/woff2;base64,${buf.toString('base64')}) format('woff2')}`,
    );
  }
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, out.join('\n'));
  return out.join('\n');
}

const dataUri = (file) =>
  `data:image/jpeg;base64,${fs.readFileSync(path.join(PHOTOS, file)).toString('base64')}`;

/* ─────────────────────────────  plantillas  ───────────────────────────── */

const base = (fonts, w, h, body) => `<!doctype html><meta charset="utf-8"><style>
${fonts}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{position:relative;background:${C.bone};font-family:'Jost',-apple-system,'Helvetica Neue',sans-serif;color:${C.ink};
  -webkit-font-smoothing:antialiased}
.d{font-family:'Cormorant Garamond','EB Garamond',Georgia,serif;font-weight:300;letter-spacing:-.022em;line-height:.94}
.d em{font-style:italic;font-weight:400;color:${C.rosa}}
.mono{font-family:'JetBrains Mono',ui-monospace,monospace;text-transform:uppercase;letter-spacing:.24em}
.rule{height:1px;background:${C.line}}
.mark{font-family:'Cormorant Garamond',Georgia,serif;font-weight:400;letter-spacing:.34em;text-transform:uppercase}
.shot{width:100%;height:100%;object-fit:cover;display:block}
</style>${body}`;

// Geometría absoluta a propósito: con flex, un titular de una línea más rompía
// el encuadre y el precio se salía del lienzo sin que el render avisara.
const img = (a, photo) =>
  `<img src="${photo}" class="shot" style="object-fit:${a.creative.fit};` +
  `object-position:${a.creative.position || '50% 50%'}">`;

// A · Editorial: foto grande, titular abajo. Para público frío.
const editorial = (a, photo) => `
<div style="position:absolute;inset:0;background:${C.bone}">
  <div style="position:absolute;top:60px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:baseline">
    <span class="mono" style="font-size:19px;color:${C.gold}">${a.creative.eyebrow}</span>
    <span class="mark" style="font-size:22px">Lima Flores</span>
  </div>
  <div class="rule" style="position:absolute;top:126px;left:72px;right:72px"></div>
  <div style="position:absolute;top:162px;left:72px;width:936px;height:700px;background:#fff;overflow:hidden">
    ${img(a, photo)}
  </div>
  <div style="position:absolute;top:902px;left:72px;right:72px;height:320px">
    <h1 class="d" style="font-size:${a.creative.hlSize || 100}px">${a.creative.headline}</h1>
    <p style="font-size:27px;font-weight:300;line-height:1.42;color:#4A473F;margin-top:24px;max-width:820px">${a.creative.sub}</p>
  </div>
  <div class="rule" style="position:absolute;top:1236px;left:72px;right:72px"></div>
  <div style="position:absolute;top:1258px;left:72px;right:72px;display:flex;justify-content:space-between;align-items:center">
    <span class="d" style="font-size:46px;font-weight:400">${a.creative.price}</span>
    <span class="mono" style="font-size:17px;color:${C.moss}">${a.creative.footer}</span>
  </div>
</div>`;

// B · Split: panel oscuro con la lista de entregables + foto a sangre. Objeciones.
const split = (a, photo) => `
<div style="position:absolute;inset:0">
  <div style="position:absolute;top:0;bottom:0;left:0;width:486px;background:${C.ink};color:${C.bone}">
    <span class="mono" style="position:absolute;top:64px;left:52px;font-size:17px;color:${C.terra}">${a.creative.eyebrow}</span>
    <h1 class="d" style="position:absolute;top:112px;left:52px;right:52px;font-size:${a.creative.hlSize || 82}px">${a.creative.headline}</h1>
    <ul style="position:absolute;left:52px;right:52px;bottom:214px;list-style:none;
               border-top:1px solid rgba(244,239,229,.28)">
      ${a.creative.items
        .map(
          (t) => `<li style="display:flex;gap:16px;align-items:flex-start;padding:19px 0;
              border-bottom:1px solid rgba(244,239,229,.14);font-size:24px;font-weight:300;line-height:1.34">
            <span style="color:${C.terra};font-size:18px;line-height:1.75">—</span><span>${t}</span></li>`,
        )
        .join('')}
    </ul>
    <div style="position:absolute;left:52px;bottom:64px">
      <div class="d" style="font-size:64px;font-weight:400;color:#fff">${a.creative.price}</div>
      <div class="mono" style="font-size:15px;color:rgba(244,239,229,.6);margin-top:12px">${a.creative.footer}</div>
    </div>
  </div>
  <div style="position:absolute;top:0;bottom:0;left:486px;right:0;background:#fff;overflow:hidden">
    ${img(a, photo)}
    <span class="mark" style="position:absolute;top:44px;right:44px;font-size:20px">Lima Flores</span>
  </div>
</div>`;

// C · Cita: prueba social o manifiesto arriba, foto abajo. Para consideración.
const quote = (a, photo) => `
<div style="position:absolute;inset:0;background:${C.paper}">
  <div style="position:absolute;top:70px;left:76px;right:76px;display:flex;justify-content:space-between;align-items:baseline">
    <span style="font-size:23px;letter-spacing:.42em;color:${C.gold}">★★★★★</span>
    <span class="mark" style="font-size:21px">Lima Flores</span>
  </div>
  <blockquote class="d" style="position:absolute;top:148px;left:76px;right:76px;
              font-size:${a.creative.hlSize || 74}px;line-height:1.04">«${a.creative.quote}»</blockquote>
  <div style="position:absolute;left:76px;bottom:648px">
    <div style="display:flex;align-items:center;gap:18px">
      <span style="width:44px;height:1px;background:${C.line}"></span>
      <span style="font-size:23px;font-weight:400">${a.creative.author}</span>
    </div>
    <div class="mono" style="font-size:15px;color:${C.moss};margin-top:14px;margin-left:62px">${a.creative.meta}</div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;height:620px;background:#fff;
              border-top:1px solid ${C.line};overflow:hidden">
    ${img(a, photo)}
    <div style="position:absolute;left:0;right:0;bottom:0;padding:40px 76px;display:flex;
                justify-content:space-between;align-items:center;
                background:linear-gradient(to top,rgba(251,248,241,.97) 40%,rgba(251,248,241,0))">
      <span class="d" style="font-size:44px;font-weight:400">${a.creative.price}</span>
      <span class="mono" style="font-size:16px;color:${C.moss}">${a.creative.footer}</span>
    </div>
  </div>
</div>`;

// S · Historia 9:16. Todo el texto vive entre los 250px de arriba y los 372px de
// abajo que tapan la interfaz de Instagram.
const story = (a, photo) => `
<div style="position:absolute;inset:0;background:${C.bone}">
  <div style="position:absolute;top:0;left:0;right:0;height:1010px;background:#fff;overflow:hidden">
    ${img(a, photo)}
    <div style="position:absolute;left:0;right:0;bottom:0;height:240px;
                background:linear-gradient(to top,${C.bone},rgba(244,239,229,0))"></div>
  </div>
  <div style="position:absolute;left:78px;right:78px;top:1064px;height:376px">
    <span class="mono" style="font-size:18px;color:${C.gold}">${a.creative.eyebrow}</span>
    <h1 class="d" style="font-size:${a.creative.hlSize || 96}px;margin-top:24px">${a.creative.headline}</h1>
    <p style="font-size:30px;font-weight:300;line-height:1.4;color:#4A473F;margin-top:26px;max-width:860px">${a.creative.sub}</p>
  </div>
  <div style="position:absolute;left:78px;right:78px;bottom:372px;display:flex;justify-content:space-between;align-items:center">
    <span style="display:inline-flex;align-items:center;gap:18px;background:${C.ink};color:${C.bone};
                 padding:26px 46px;border-radius:999px">
      <span style="font-size:26px;font-weight:400">${a.creative.pill}</span>
      <span style="font-size:24px;color:${C.terra}">→</span>
    </span>
    <span class="mark" style="font-size:21px">Lima Flores</span>
  </div>
</div>`;

const TEMPLATES = { editorial, split, quote, story };

/* ──────────────────────────────  render  ─────────────────────────────── */

// Chromium solo escribe PNG, y su viewport headless es unos 78px más bajo que el
// --window-size que le pides: por eso renderizamos con holgura y recortamos aquí
// al lienzo exacto, en la misma pasada que reencoda a JPEG.
function toJpeg(chrome, pngPath, jpgPath, tmpDir, w, h) {
  const html = path.join(tmpDir, 'enc.html');
  fs.writeFileSync(
    html,
    `<!doctype html><meta charset="utf-8"><body><img id="i" src="data:image/png;base64,${fs
      .readFileSync(pngPath)
      .toString('base64')}"><script>
      const i=document.getElementById('i');
      i.onload=()=>{const c=document.createElement('canvas');c.width=${w};c.height=${h};
        c.getContext('2d').drawImage(i,0,0,${w},${h},0,0,${w},${h});
        document.title=c.toDataURL('image/jpeg',.92);};
    </script>`,
  );
  const dom = execFileSync(
    chrome,
    ['--headless=new', '--no-sandbox', '--disable-gpu', '--virtual-time-budget=8000', '--dump-dom', `file://${html}`],
    { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
  );
  const b64 = dom.match(/<title>data:image\/jpeg;base64,([A-Za-z0-9+/=]+)<\/title>/)?.[1];
  if (!b64) return false;
  fs.writeFileSync(jpgPath, Buffer.from(b64, 'base64'));
  return true;
}

/* ───────────────────────────────  deck  ──────────────────────────────── */

// El README es un derivado de ads.json, nunca al revés: el copy que se pega en
// el administrador de anuncios y el que se imprime en el creativo salen de la
// misma fuente, así no se desincronizan a la tercera ronda de cambios.
function writeDeck({ campaign, products, ads }) {
  const L = [];
  L.push('# Campaña de Instagram · Lima Flores');
  L.push('');
  L.push(`3 productos del catálogo, 3 anuncios cada uno. Copy y creativos hechos íntegramente con Claude.`);
  L.push('');
  L.push('```');
  L.push('node marketing/ig-ads/build.mjs     # regenera los 9 creativos y este README');
  L.push('```');
  L.push('');
  L.push('| Anuncio | Producto | Etapa | Formato | Titular |');
  L.push('| --- | --- | --- | --- | --- |');
  for (const a of ads) {
    const p = products.find((x) => x.id === a.product);
    L.push(`| \`${a.code}\` | ${p.name} | ${a.funnel} | ${a.template === 'story' ? '9:16' : '4:5'} | ${a.headline} |`);
  }
  L.push('');

  for (const p of products) {
    L.push('---');
    L.push('');
    L.push(`## ${p.num} · ${p.name} — S/${p.price}`);
    L.push('');
    L.push(`**Categoría** ${p.categoryLabel} · **Ángulo** ${p.angle}`);
    L.push('');
    L.push(`**Público** ${p.audience}`);
    L.push('');
    L.push(`**Destino** \`${p.landing}\``);
    L.push('');
    for (const a of ads.filter((x) => x.product === p.id)) {
      L.push(`### ${a.code} · ${a.title}`);
      L.push('');
      L.push(`![${a.title}](creativos/${a.code}.jpg)`);
      L.push('');
      L.push(`- **Objetivo** ${a.objective} · **Etapa** ${a.funnel}`);
      L.push(`- **Ubicación** ${a.placement}`);
      L.push(`- **Botón** ${a.cta}`);
      L.push('');
      L.push('**Texto principal**');
      L.push('');
      L.push(a.primaryText.split('\n').map((l) => `> ${l}`).join('\n>\n').replace(/> \n>\n/g, ''));
      L.push('');
      L.push(`**Titular** ${a.headline}`);
      L.push('');
      L.push(`**Descripción** ${a.description}`);
      L.push('');
      L.push(`**Hashtags** ${a.hashtags.join(' ')}`);
      L.push('');
      L.push(`**Por qué funciona** ${a.why}`);
      L.push('');
    }
  }

  L.push('---');
  L.push('');
  L.push('## Antes de publicar');
  L.push('');
  L.push('Tres datos del copy salen de la landing y conviene confirmarlos con el taller:');
  L.push('');
  L.push('1. **«Entrega hoy»** (IG-01, IG-03, IG-06, IG-09). La landing dice «Te las llevamos hoy» y una');
  L.push('   reseña habla de un pedido a las 11 am entregado a las 5:30 pm, pero no hay hora de corte');
  L.push('   publicada. Si existe (por ejemplo, pedidos antes de las 2 pm), conviene decirla: sube la');
  L.push('   conversión y evita reclamos.');
  L.push('2. **«8 a 12 semanas»** (IG-04). El dato está en la landing referido a las Orquídeas Multicolor.');
  L.push('   Se está aplicando a las Phalaenopsis en maceta, que es la misma especie, pero vale confirmarlo.');
  L.push('3. **Color de la orquídea** (IG-04, IG-05, IG-06). Las fotos del catálogo muestran ejemplares');
  L.push('   ámbar y magenta. Si el color no se puede elegir, la ficha debería decir «color según');
  L.push('   disponibilidad» para que el creativo no prometa uno en particular.');
  L.push('');
  L.push('Además: la reseña de Diego V. que se cita en IG-05 aparece como verificada en la landing.');
  L.push('Meta pide poder respaldar los testimonios, así que hay que tener a mano de dónde salió.');
  L.push('');
  L.push('## Notas de producción');
  L.push('');
  L.push('- Fotos: las del catálogo (`site/assets/products/`). No se generó ninguna imagen con IA.');
  L.push('- Tipografías y paleta: las del sitio (`site/css/lima.css`) — Cormorant Garamond, Jost,');
  L.push('  JetBrains Mono sobre hueso `#F4EFE5` y tinta `#1B1A17`.');
  L.push('- Los creativos usan el logotipo tipográfico del sitio nuevo, no el logo de acuarela de');
  L.push('  `site/assets/logo.png`, que pertenece a la identidad anterior.');
  L.push('- En las historias, los 250px de arriba y los 372px de abajo quedan libres: ahí Instagram');
  L.push('  monta el header del perfil y la barra de respuesta.');
  L.push('- El rubro fúnebre quedó fuera del sorteo: ninguno de sus 5 productos tiene foto en el repo.');
  L.push('');

  fs.writeFileSync(path.join(HERE, 'README.md'), L.join('\n'));
}

/* ───────────────────────────────  main  ──────────────────────────────── */

const main = async () => {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, 'ads.json'), 'utf8'));
  const { ads } = data;
  const chrome = findChromium();
  const fonts = await fontCss();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ig-ads-'));
  fs.mkdirSync(OUT, { recursive: true });

  for (const ad of ads) {
    const isStory = ad.template === 'story';
    const [w, h] = isStory ? [1080, 1920] : [1080, 1350];
    const html = path.join(tmp, `${ad.code}.html`);
    const png = path.join(tmp, `${ad.code}.png`);
    const jpg = path.join(OUT, `${ad.code}.jpg`);

    fs.writeFileSync(html, base(fonts, w, h, TEMPLATES[ad.template](ad, dataUri(ad.photo))));
    execFileSync(chrome, [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--virtual-time-budget=8000',
      `--window-size=${w},${h + 200}`, `--screenshot=${png}`, `file://${html}`,
    ]);

    let final = jpg;
    if (!toJpeg(chrome, png, jpg, tmp, w, h)) {
      final = path.join(OUT, `${ad.code}.png`);
      fs.copyFileSync(png, final);
      console.warn(`  ! ${ad.code}: no pude reencodear a JPEG, dejo el PNG.`);
    }
    const kb = Math.round(fs.statSync(final).size / 1024);
    console.log(`  ✓ ${ad.code}  ${w}×${h}  ${path.basename(final)}  ${kb} KB  — ${ad.title}`);
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  writeDeck(data);
  console.log(`\n${ads.length} creativos en ${path.relative(ROOT, OUT)}/ + README.md`);
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
