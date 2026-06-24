// db/categories-store.js — categorías del catálogo (tabla categories).
// Editable desde el admin: alta, edición de etiqueta, activar/ocultar, borrar y
// REORDENAR (el orden define cómo aparecen los chips en /catalogo y la sección de
// categorías del home). La tabla se siembra una vez desde categories.seed.json.
'use strict';

const path = require('path');
const db = require('./index');

const SEED_FILE = path.join(__dirname, 'categories.seed.json');

function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'categoria';
}

async function uniqueSlug(base) {
  let slug = base;
  for (let i = 0; i < 50; i++) {
    const { rows } = await db.query('SELECT 1 FROM categories WHERE slug = $1', [slug]);
    if (!rows.length) return slug;
    slug = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now()}`;
}

let seeded = false;
async function ensureSeeded() {
  if (seeded || !db.enabled) return;
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM categories');
  if (rows[0].n > 0) { seeded = true; return; }
  let seed = [];
  try { seed = require(SEED_FILE); } catch { seed = []; }
  for (let i = 0; i < seed.length; i++) {
    const c = seed[i];
    await db.query(
      `INSERT INTO categories (slug, label, sort_order, active)
       VALUES ($1, $2, $3, TRUE) ON CONFLICT (slug) DO NOTHING`,
      [c.slug || slugify(c.label), c.label, i]
    );
  }
  seeded = true;
  if (seed.length) console.log(`[categories] sembradas ${seed.length} categorías`);
}

// Cada categoría con su número de productos ACTIVOS (para "X diseños").
const SELECT_WITH_COUNT = `
  SELECT c.slug, c.label, c.sort_order, c.active, COALESCE(cnt.n, 0)::int AS count
  FROM categories c
  LEFT JOIN (SELECT category, COUNT(*) AS n FROM products WHERE active = TRUE GROUP BY category) cnt
    ON cnt.category = c.slug`;

function rowToCat(r) {
  return { slug: r.slug, label: r.label, sortOrder: r.sort_order, active: r.active, count: Number(r.count) || 0 };
}

async function listPublic() {
  await ensureSeeded();
  const { rows } = await db.query(`${SELECT_WITH_COUNT} WHERE c.active = TRUE ORDER BY c.sort_order ASC, c.created_at ASC`);
  return rows.map(rowToCat);
}

async function listAll() {
  await ensureSeeded();
  const { rows } = await db.query(`${SELECT_WITH_COUNT} ORDER BY c.sort_order ASC, c.created_at ASC`);
  return rows.map(rowToCat);
}

async function create({ label, slug } = {}) {
  await ensureSeeded();
  if (!label || !String(label).trim()) throw new Error('La etiqueta es obligatoria.');
  const base = slug ? slugify(slug) : slugify(label);
  const finalSlug = await uniqueSlug(base);
  const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM categories');
  await db.query(
    `INSERT INTO categories (slug, label, sort_order, active) VALUES ($1, $2, $3, TRUE)`,
    [finalSlug, String(label).trim(), maxRows[0].next]
  );
  return { slug: finalSlug, label: String(label).trim(), sortOrder: maxRows[0].next, active: true, count: 0 };
}

async function update(slug, patch = {}) {
  await ensureSeeded();
  const sets = [];
  const vals = [];
  let i = 1;
  if (patch.label != null && String(patch.label).trim()) { sets.push(`label = $${i++}`); vals.push(String(patch.label).trim()); }
  if (typeof patch.active === 'boolean') { sets.push(`active = $${i++}`); vals.push(patch.active); }
  if (!sets.length) { const { rows } = await db.query(`${SELECT_WITH_COUNT} WHERE c.slug = $1`, [slug]); return rows.length ? rowToCat(rows[0]) : null; }
  vals.push(slug);
  const { rowCount } = await db.query(`UPDATE categories SET ${sets.join(', ')} WHERE slug = $${i}`, vals);
  if (!rowCount) return null;
  // Renombrar la categoría: propaga la etiqueta a los productos (denormalizada).
  if (patch.label != null && String(patch.label).trim()) {
    await db.query('UPDATE products SET category_label = $2 WHERE category = $1', [slug, String(patch.label).trim()]);
  }
  const { rows } = await db.query(`${SELECT_WITH_COUNT} WHERE c.slug = $1`, [slug]);
  return rows.length ? rowToCat(rows[0]) : null;
}

async function remove(slug) {
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM products WHERE category = $1', [slug]);
  if (rows[0].n > 0) {
    const e = new Error(`No se puede borrar: ${rows[0].n} producto(s) usan esta categoría. Muévelos primero.`);
    e.code = 'HAS_PRODUCTS';
    throw e;
  }
  const { rowCount } = await db.query('DELETE FROM categories WHERE slug = $1', [slug]);
  return rowCount > 0;
}

// Reordena según el array de slugs recibido (índice → sort_order).
async function reorder(slugs) {
  await ensureSeeded();
  if (!Array.isArray(slugs)) throw new Error('Orden inválido.');
  for (let i = 0; i < slugs.length; i++) {
    await db.query('UPDATE categories SET sort_order = $2 WHERE slug = $1', [slugs[i], i]);
  }
  return listAll();
}

module.exports = { ensureSeeded, listPublic, listAll, create, update, remove, reorder, slugify };
