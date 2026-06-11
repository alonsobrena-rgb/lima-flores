// Construye site/js/data.js con los 57 productos reales migrados de WC.
'use strict';
const fs = require('fs');
const path = require('path');

const migrated = require('./migrated-full.json');

// Limpiar campos internos + agregar array images[] (principal + extras)
const products = migrated.map((p) => {
  const { _wc_id, _wc_image_src, _wc_images_extra, ...clean } = p;
  const extras = (_wc_images_extra || []).map((_, i) => `assets/products/${p.id}-${i + 2}.jpg`);
  clean.images = [clean.image, ...extras];
  return clean;
});

// Función para escapar string en JS object literal (single quotes)
function jsStr(s) {
  if (s == null) return "''";
  return "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, ' ').replace(/\r/g, '').replace(/\s+/g, ' ').trim() + "'";
}

// Genera el JS object literal con formato bonito
function formatProduct(p, isLast) {
  const lines = [];
  lines.push('    {');
  lines.push(`      id: ${jsStr(p.id)}, name: ${jsStr(p.name)},`);
  lines.push(`      category: ${jsStr(p.category)}, categoryLabel: ${jsStr(p.categoryLabel)},`);
  lines.push(`      price: ${p.price}, image: ${jsStr(p.image)}, palette: ${jsStr(p.palette)},`);
  if (p.images && p.images.length > 1) lines.push(`      images: [${p.images.map(jsStr).join(', ')}],`);
  if (p.tags && p.tags.length) lines.push(`      tags: [${p.tags.map(jsStr).join(', ')}],`);
  if (p.shortDesc) lines.push(`      shortDesc: ${jsStr(p.shortDesc)},`);
  if (p.description && p.description !== p.shortDesc) lines.push(`      description: ${jsStr(p.description)},`);
  if (p.details && p.details.length) {
    lines.push('      details: [');
    p.details.forEach(([k, v]) => lines.push(`        [${jsStr(k)}, ${jsStr(v)}],`));
    lines.push('      ],');
  }
  lines.push('    }' + (isLast ? '' : ','));
  return lines.join('\n');
}

const header = `// Lima Flores — catálogo (datos)
// Generado automáticamente desde WooCommerce el ${new Date().toISOString().slice(0, 10)}.
// 57 productos migrados desde limaflores.pe via WC REST API.
window.LIMA = {
  info: {
    name: 'Lima Flores',
    tagline: 'Atelier botánico · desde 2017',
    whatsapp: '51999479855',
    phone: '999 479 855',
    phone2: '944 257 806',
    email: 'hola@limaflores.pe',
    instagram: 'lima_flores',
    facebook: 'limafloresperu',
    address: 'Calle Francia 823, Miraflores · Lima'
  },
  categories: [
    { id: 'arreglos', label: 'Arreglos', subtitle: 'Composiciones en caja o base', palette: ['#B6855E', '#ECE4D2'] },
    { id: 'ramos',    label: 'Ramos',    subtitle: 'Hechos a mano, papel artesanal', palette: ['#C99CA9', '#F4EFE5'] },
    { id: 'floreros', label: 'Floreros', subtitle: 'Cerámica y vidrio soplado',      palette: ['#4F5C3F', '#ECE4D2'] },
    { id: 'plantas',  label: 'Plantas',  subtitle: 'Orquídeas y suculentas',         palette: ['#A57F45', '#F4EFE5'] }
  ],
  products: [
`;

const body = products.map((p, i) => formatProduct(p, i === products.length - 1)).join('\n');

const footer = `
  ],
  // ─── Planes de suscripción · flores de estación, 2 entregas/mes ──
  plans: [
    { id: 'mensual', name: 'Mensual', months: 1, deliveries: 2, total: 190, perMonth: 190,
      blurb: 'Para probar, sin compromiso.',
      perks: ['2 entregas al mes · flores de estación', 'Ramo armado a mano, siempre distinto', 'Entrega a domicilio en Lima', 'Pausa o cancela cuando quieras'] },
    { id: 'trimestral', name: 'Trimestral', months: 3, deliveries: 6, total: 540, perMonth: 180,
      blurb: 'Tres meses de flores frescas.',
      perks: ['Todo lo del plan Mensual', '6 entregas · flores de estación', 'Tarjeta escrita a mano en cada envío'] },
    { id: 'semestral', name: 'Semestral', months: 6, deliveries: 12, total: 1020, perMonth: 170, featured: true, tag: 'Más popular',
      blurb: 'Seis meses, el ritmo ideal.',
      perks: ['Todo lo del plan Trimestral', '12 entregas · flores de estación', 'Florero de cerámica de regalo', 'Cambia tu día de entrega cuando quieras'] },
    { id: 'anual', name: 'Anual', months: 12, deliveries: 24, total: 1920, perMonth: 160, tag: 'Mejor valor',
      blurb: 'Un año entero de estación.',
      perks: ['Todo lo del plan Semestral', '24 entregas · flores de estación', 'Prioridad en San Valentín y Día de la Madre'] }
  ]
};

// Genera un placeholder SVG elegante para productos sin foto
window.placeholderSVG = function(product) {
  const palette = product.palette || '#C89B7E';
  const name = product.name || '';
  const cat = (product.categoryLabel || '').toUpperCase();
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  return \`
  <svg viewBox="0 0 400 500" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" role="img" aria-label="\${name}">
    <defs>
      <linearGradient id="bg-\${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="\${palette}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="\${palette}" stop-opacity="0.32"/>
      </linearGradient>
      <pattern id="lines-\${id}" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="6" stroke="\${palette}" stroke-opacity="0.10" stroke-width="1"/>
      </pattern>
      <radialGradient id="rg-\${id}" cx="50%" cy="42%" r="50%">
        <stop offset="0%" stop-color="\${palette}" stop-opacity="0.5"/>
        <stop offset="100%" stop-color="\${palette}" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="400" height="500" fill="#FBF8F1"/>
    <rect width="400" height="500" fill="url(#bg-\${id})"/>
    <rect width="400" height="500" fill="url(#lines-\${id})"/>
    <rect width="400" height="500" fill="url(#rg-\${id})"/>
    <g stroke="\${palette}" stroke-opacity="0.55" fill="none" stroke-width="1.4" stroke-linecap="round">
      <path d="M200 380 C 200 320, 200 260, 200 200" />
      <ellipse cx="200" cy="190" rx="14" ry="22" fill="\${palette}" fill-opacity="0.35"/>
      <ellipse cx="148" cy="218" rx="11" ry="18" fill="\${palette}" fill-opacity="0.28" transform="rotate(-22 148 218)"/>
      <ellipse cx="258" cy="188" rx="11" ry="18" fill="\${palette}" fill-opacity="0.32" transform="rotate(22 258 188)"/>
    </g>
    <text x="32" y="32" font-family="Inter, sans-serif" font-size="10" letter-spacing="2.4" fill="#5E5A52">\${cat}</text>
    <text x="32" y="468" font-family="'Cormorant Garamond', serif" font-style="italic" font-size="26" fill="#1B1A17">\${name}</text>
  </svg>\`;
};

window.formatSoles = (n) => 'S/ ' + (Math.round(n * 100) / 100).toFixed(2).replace(/\\.00$/, '');
`;

const fullJs = header + body + footer;
const outPath = path.join(__dirname, '..', 'site', 'js', 'data.js');
fs.writeFileSync(outPath, fullJs);

console.log(`Escrito ${outPath}`);
console.log(`Tamaño: ${(fullJs.length / 1024).toFixed(1)} KB`);
console.log(`Productos: ${products.length}`);
