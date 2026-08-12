// scripts/dedupe-categories.js — encuentra y borra categorías repetidas.
//
// Dos categorías con etiquetas distintas pueden ser la misma cosa para quien
// mira el catálogo: «Accesorios» y «accesorios », o «Condolencias» creada dos
// veces con slugs distintos. La tabla solo impide repetir el *slug*, no la
// etiqueta, así que un duplicado así entra sin que nada se queje y aparece dos
// veces en los chips del catálogo y en el pie.
//
// Uso:
//   node scripts/dedupe-categories.js            # solo informa, no toca nada
//   node scripts/dedupe-categories.js --aplicar  # mueve productos y borra
//
// Requiere DATABASE_URL (en Railway ya está; en local, la connection string).
//
// Qué se queda y qué se va, cuando hay repetidas:
//   1. Gana la que tiene productos. Si las dos tienen, gana la de más.
//   2. A igualdad, gana la de menor sort_order — la que ya estaba ordenada.
//   3. Los productos de las perdedoras se mueven a la ganadora ANTES de borrar,
//      así no queda ningún producto apuntando a una categoría que ya no existe.
'use strict';

try { require('../integrations/urbaner/load-env')(); } catch { /* opcional */ }

const db = require('../db');

// Misma normalización que usa el ojo: sin tildes, sin mayúsculas, sin espacios
// de sobra. Es la que decide qué cuenta como «la misma categoría».
const norm = (s) => String(s || '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();

(async () => {
  if (!db.enabled) {
    console.error('✗ DATABASE_URL no configurado. Exporta la connection string de Railway y reintenta.');
    process.exit(1);
  }
  const aplicar = process.argv.includes('--aplicar');

  try {
    const { rows } = await db.query(`
      SELECT c.slug, c.label, c.sort_order, c.active, COALESCE(p.n, 0)::int AS productos
      FROM categories c
      LEFT JOIN (SELECT category, COUNT(*) AS n FROM products GROUP BY category) p
        ON p.category = c.slug
      ORDER BY c.sort_order, c.slug`);

    const grupos = new Map();
    for (const r of rows) {
      const k = norm(r.label);
      if (!grupos.has(k)) grupos.set(k, []);
      grupos.get(k).push(r);
    }
    const repetidas = [...grupos.values()].filter((g) => g.length > 1);

    console.log(`${rows.length} categorías en la base.`);
    if (!repetidas.length) {
      console.log('✓ No hay etiquetas repetidas. Nada que hacer.');
      process.exit(0);
    }

    for (const grupo of repetidas) {
      const orden = [...grupo].sort((a, b) => b.productos - a.productos || a.sort_order - b.sort_order);
      const [gana, ...pierden] = orden;
      console.log(`\n«${gana.label}» está ${grupo.length} veces:`);
      for (const c of orden) {
        const marca = c === gana ? '  se queda' : '  se borra';
        console.log(`${marca}  slug=${c.slug.padEnd(18)} orden=${String(c.sort_order).padStart(2)}  productos=${c.productos}  ${c.active ? 'activa' : 'oculta'}`);
      }

      if (!aplicar) continue;

      for (const c of pierden) {
        if (c.productos > 0) {
          const { rowCount } = await db.query('UPDATE products SET category = $1 WHERE category = $2', [gana.slug, c.slug]);
          console.log(`  → ${rowCount} producto(s) movidos de ${c.slug} a ${gana.slug}`);
        }
        await db.query('DELETE FROM categories WHERE slug = $1', [c.slug]);
        console.log(`  → borrada ${c.slug}`);
      }
    }

    if (!aplicar) {
      console.log('\nEsto fue solo un informe. Para aplicarlo:');
      console.log('  node scripts/dedupe-categories.js --aplicar');
    } else {
      console.log('\n✓ Listo.');
    }
    process.exit(0);
  } catch (e) {
    console.error('✗', e.message);
    process.exit(1);
  }
})();
