// Migración WooCommerce → Lima Flores data.js
'use strict';
const fs = require('fs');
const path = require('path');

const prods = require('./productos.json');

// ─── Mapeo de categorías ─────────────────────────────────
// 8 categorías de WC → 4 principales del nuevo sitio + tags
const CAT_MAP = {
  'Arreglos':           { cat: 'arreglos', label: 'Arreglos' },
  'Boxes':              { cat: 'arreglos', label: 'Arreglos' },  // boxes son subtipo de arreglo
  'Florero':            { cat: 'floreros', label: 'Floreros' },
  'Macetas y plantas':  { cat: 'plantas',  label: 'Plantas'  },
  'Ramos':              { cat: 'ramos',    label: 'Ramos'    },
  'Regalos':            { cat: 'arreglos', label: 'Arreglos' },  // sin categoría dedicada, default arreglos
};
const TAG_MAP = {
  'Celebra el Amor': 'amor',
  'Feliz Día Mamá':  'mama',
  'Regalos':         'regalos',
  'Suscripciones':   'suscripcion',
};

// Inferir categoría principal cuando solo viene en estacional
function inferCategoryFromName(name) {
  const n = name.toLowerCase();
  if (/orqu[ií]dea|maceta|planta|anturio/i.test(n)) return { cat: 'plantas',  label: 'Plantas'  };
  if (/florero|vaso/i.test(n))                       return { cat: 'floreros', label: 'Floreros' };
  if (/\bramo\b/i.test(n))                           return { cat: 'ramos',    label: 'Ramos'    };
  return { cat: 'arreglos', label: 'Arreglos' };  // default
}

// Palette por categoría (consistencia visual en el catálogo)
const PALETTE_BY_CAT = {
  arreglos: '#B6855E',  // terra
  ramos:    '#C99CA9',  // bloom
  floreros: '#4F5C3F',  // moss
  plantas:  '#A57F45',  // gold
};

// HTML → texto plano, decodifica entidades comunes
function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é').replace(/&iacute;/g, 'í').replace(/&oacute;/g, 'ó').replace(/&uacute;/g, 'ú')
    .replace(/&ntilde;/g, 'ñ').replace(/&Ntilde;/g, 'Ñ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(s, n) {
  if (!s || s.length <= n) return s;
  return s.slice(0, n - 1).trim() + '…';
}

// Filtrar productos sin imagen
const withImg = prods.filter(p => p.images && p.images.length > 0);
console.log(`Productos con imagen: ${withImg.length} / ${prods.length}`);

// Procesar cada uno
const migrated = withImg.map((p) => {
  const catsRaw = p.categories.map(c => c.name);

  // Categoría principal: primera que esté en CAT_MAP, o inferir del nombre
  let catInfo = null;
  for (const c of catsRaw) {
    if (CAT_MAP[c]) { catInfo = CAT_MAP[c]; break; }
  }
  if (!catInfo) catInfo = inferCategoryFromName(p.name);

  // Tags: las que estén en TAG_MAP
  const tags = catsRaw.map(c => TAG_MAP[c]).filter(Boolean);

  // Descripción corta limpia
  const shortDesc = truncate(stripHtml(p.short_description || p.description || ''), 200);
  const description = stripHtml(p.description || p.short_description || '');

  // Detalles desde attributes (rara vez los hay)
  const details = (p.attributes || [])
    .filter(a => a.options && a.options.length)
    .map(a => [a.name, a.options.join(', ')]);

  return {
    id: p.slug,
    name: p.name.trim(),
    category: catInfo.cat,
    categoryLabel: catInfo.label,
    price: Number(p.price) || 0,
    image: `assets/products/${p.slug}.jpg`,
    palette: PALETTE_BY_CAT[catInfo.cat] || '#B6855E',
    tags,
    shortDesc,
    description,
    details,
    // metadata útil para descarga + tracking
    _wc_id: p.id,
    _wc_image_src: p.images[0].src,
    _wc_images_extra: p.images.slice(1).map(i => i.src),
  };
});

// Estadísticas
const byCat = {};
migrated.forEach(p => { byCat[p.category] = (byCat[p.category] || 0) + 1; });
console.log('\nDistribución final por categoría nueva:');
Object.entries(byCat).sort((a,b) => b[1]-a[1]).forEach(([c, n]) => console.log(`  ${n.toString().padStart(3)} · ${c}`));

const withTags = migrated.filter(p => p.tags.length > 0).length;
console.log(`\nProductos con tags: ${withTags}`);

// Guardar el output completo (con metadata _wc_*) para los siguientes pasos
fs.writeFileSync(path.join(__dirname, 'migrated-full.json'), JSON.stringify(migrated, null, 2));
console.log(`\nGuardado en _wc/migrated-full.json (${migrated.length} productos)`);
