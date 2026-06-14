// db/products-store.js — acceso a datos del catálogo (tabla products) y a las
// imágenes subidas (product_images). Compartido por api/products.js (público)
// y api/admin.js (CRUD protegido).
//
// La tabla se siembra una sola vez desde db/products.seed.json (snapshot del app
// React). Tras la siembra, la BD es la fuente de verdad.
'use strict';

const path = require('path');
const crypto = require('crypto');
const db = require('./index');

const SEED_FILE = path.join(__dirname, 'products.seed.json');

// ─── Mapeo fila BD → objeto producto (shape de products.json del app) ──────────
function rowToProduct(r, { internal = false } = {}) {
  if (!r) return null;
  const p = {
    id: r.id,
    name: r.name,
    category: r.category || undefined,
    categoryLabel: r.category_label || undefined,
    price: r.price == null ? null : Number(r.price),
    image: r.image || undefined,
    images: Array.isArray(r.images) && r.images.length ? r.images : undefined,
    palette: r.palette || undefined,
    shortDesc: r.short_desc || undefined,
    description: r.description || undefined,
    tags: Array.isArray(r.tags) && r.tags.length ? r.tags : undefined,
    badge: r.badge || undefined,
    details: r.details || undefined,
  };
  if (internal) {
    p.active = r.active;
    p.sortOrder = r.sort_order;
    p.updatedAt = r.updated_at;
  }
  return p;
}

// ─── Slug a partir del nombre (para ids de productos nuevos) ───────────────────
function slugify(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'producto';
}

async function uniqueId(base) {
  let id = base;
  for (let i = 0; i < 50; i++) {
    const { rows } = await db.query('SELECT 1 FROM products WHERE id = $1', [id]);
    if (!rows.length) return id;
    id = `${base}-${i + 2}`;
  }
  return `${base}-${Date.now()}`;
}

// ─── Siembra inicial (idempotente) ─────────────────────────────────────────────
let seeded = false;
async function ensureSeeded() {
  if (seeded || !db.enabled) return;
  const { rows } = await db.query('SELECT COUNT(*)::int AS n FROM products');
  if (rows[0].n > 0) { seeded = true; return; }
  let seed = [];
  try { seed = require(SEED_FILE); } catch { seed = []; }
  for (let i = 0; i < seed.length; i++) {
    const p = seed[i];
    await db.query(
      `INSERT INTO products
         (id, name, category, category_label, price, image, images, palette,
          short_desc, description, tags, badge, details, sort_order, active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,TRUE)
       ON CONFLICT (id) DO NOTHING`,
      [
        p.id || slugify(p.name), p.name, p.category || null, p.categoryLabel || null,
        p.price ?? null, p.image || null, JSON.stringify(p.images || null), p.palette || null,
        p.shortDesc || null, p.description || null, JSON.stringify(p.tags || null),
        p.badge || null, JSON.stringify(p.details || null), i,
      ]
    );
  }
  seeded = true;
  console.log(`[products] sembrados ${seed.length} productos`);
}

// ─── Lecturas ──────────────────────────────────────────────────────────────────
async function listPublic() {
  await ensureSeeded();
  const { rows } = await db.query(
    `SELECT * FROM products WHERE active = TRUE ORDER BY sort_order ASC, created_at ASC`
  );
  return rows.map((r) => rowToProduct(r));
}

async function listAll() {
  await ensureSeeded();
  const { rows } = await db.query(
    `SELECT * FROM products ORDER BY sort_order ASC, created_at ASC`
  );
  return rows.map((r) => rowToProduct(r, { internal: true }));
}

async function getById(id, { internal = false } = {}) {
  const { rows } = await db.query(`SELECT * FROM products WHERE id = $1`, [id]);
  return rows.length ? rowToProduct(rows[0], { internal }) : null;
}

// ─── Escrituras (admin) ────────────────────────────────────────────────────────
// Campos editables y su columna. price y sort_order se castean a número.
const FIELD_COLS = {
  name: 'name', category: 'category', categoryLabel: 'category_label',
  price: 'price', image: 'image', images: 'images', palette: 'palette',
  shortDesc: 'short_desc', description: 'description', tags: 'tags',
  badge: 'badge', details: 'details', active: 'active', sortOrder: 'sort_order',
};
const JSON_FIELDS = new Set(['images', 'tags', 'details']);

function coerce(field, value) {
  if (value === undefined) return undefined;
  if (JSON_FIELDS.has(field)) return value == null ? null : JSON.stringify(value);
  if (field === 'price') return value === '' || value == null ? null : Number(value);
  if (field === 'sortOrder') return value == null ? 0 : Number(value);
  if (field === 'active') return !!value;
  return value;
}

async function create(input) {
  await ensureSeeded();
  if (!input || !input.name || !String(input.name).trim()) {
    throw new Error('El nombre es obligatorio.');
  }
  const base = input.id ? slugify(input.id) : slugify(input.name);
  const id = await uniqueId(base);
  const { rows: maxRows } = await db.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM products');
  const sortOrder = input.sortOrder != null ? Number(input.sortOrder) : maxRows[0].next;

  await db.query(
    `INSERT INTO products
       (id, name, category, category_label, price, image, images, palette,
        short_desc, description, tags, badge, details, active, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [
      id, String(input.name).trim(), input.category || null, input.categoryLabel || null,
      coerce('price', input.price), input.image || null, coerce('images', input.images || null),
      input.palette || null, input.shortDesc || null, input.description || null,
      coerce('tags', input.tags || null), input.badge || null, coerce('details', input.details || null),
      input.active === false ? false : true, sortOrder,
    ]
  );
  return getById(id, { internal: true });
}

async function update(id, patch) {
  await ensureSeeded();
  const sets = [];
  const vals = [];
  let i = 1;
  for (const [field, col] of Object.entries(FIELD_COLS)) {
    if (!(field in patch)) continue;
    const v = coerce(field, patch[field]);
    if (v === undefined) continue;
    sets.push(`${col} = $${i++}`);
    vals.push(v);
  }
  if (!sets.length) return getById(id, { internal: true });
  sets.push(`updated_at = NOW()`);
  vals.push(id);
  const { rowCount } = await db.query(
    `UPDATE products SET ${sets.join(', ')} WHERE id = $${i}`, vals
  );
  if (!rowCount) return null;
  return getById(id, { internal: true });
}

async function remove(id) {
  const { rowCount } = await db.query('DELETE FROM products WHERE id = $1', [id]);
  return rowCount > 0;
}

// ─── Imágenes subidas (BYTEA en product_images) ────────────────────────────────
async function saveImage({ productId = null, data, mime }) {
  const id = crypto.randomBytes(8).toString('hex');
  await db.query(
    `INSERT INTO product_images (id, product_id, data, mime) VALUES ($1,$2,$3,$4)`,
    [id, productId, data, mime || 'image/jpeg']
  );
  return id;
}

async function getImage(id) {
  const { rows } = await db.query('SELECT data, mime FROM product_images WHERE id = $1', [id]);
  return rows.length ? rows[0] : null;
}

module.exports = {
  rowToProduct, slugify, ensureSeeded,
  listPublic, listAll, getById,
  create, update, remove,
  saveImage, getImage,
};
