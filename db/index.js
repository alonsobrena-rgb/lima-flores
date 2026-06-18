// db/index.js — wrapper minimal sobre pg para Railway Postgres.
// Auto-ejecuta migraciones al primer require. Si no hay DATABASE_URL,
// expone un modo "disabled" que falla con un error claro (el endpoint
// /api/order responderá 503 en vez de crashear el server).
'use strict';

const DATABASE_URL = process.env.DATABASE_URL || '';
// PG_MEM=1 → Postgres en memoria (pg-mem) para desarrollo/pruebas sin servidor.
// Carga perezosa: en producción nunca se importa pg-mem.
const USE_PG_MEM = process.env.PG_MEM === '1';
const enabled = !!DATABASE_URL || USE_PG_MEM;

let pool = null;
let migrated = false;

if (USE_PG_MEM) {
  const { newDb } = require('pg-mem');
  const mem = newDb();
  const pg = mem.adapters.createPg();
  pool = new pg.Pool();
  console.log('[db] usando pg-mem (Postgres en memoria) — solo dev/pruebas');
} else if (DATABASE_URL) {
  const { Pool } = require('pg');
  // Railway expone DATABASE_URL con SSL requerido. Aceptamos cert no verificado
  // porque es comunicación intra-Railway, no internet expuesto.
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 5,
  });
  pool.on('error', (err) => {
    console.error('[db] pool error:', err.message);
  });
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id              TEXT PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status          TEXT NOT NULL DEFAULT 'pending',

  buyer_name      TEXT,
  buyer_email     TEXT,
  buyer_phone     TEXT,

  recipient_name        TEXT,
  recipient_phone       TEXT,
  recipient_address     TEXT,
  recipient_address_ref TEXT,
  recipient_lat         NUMERIC,
  recipient_lng         NUMERIC,
  recipient_apt         TEXT,
  recipient_has_reception BOOLEAN,

  delivery_date   DATE,
  delivery_time   TEXT,

  invoice_type    TEXT,
  invoice_doc     TEXT,
  invoice_name    TEXT,

  payment_method  TEXT,
  card_note       TEXT,

  items           JSONB,
  subtotal        NUMERIC,
  shipping_fee    NUMERIC,
  shipping_provider TEXT,
  shipping_label  TEXT,
  total           NUMERIC,

  cabify_order_id TEXT,
  cabify_response JSONB,
  dispatched_at   TIMESTAMPTZ,
  dispatch_error  TEXT
);

CREATE INDEX IF NOT EXISTS orders_status_idx     ON orders (status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON orders (created_at DESC);

-- Tarjeta de regalo plegada autogenerada a partir de card_note.
-- card_png = previsualización (caras apiladas) · card_pdf = lámina para imprenta.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_template     TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_png          BYTEA;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_pdf          BYTEA;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_generated_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_error        TEXT;

-- Catálogo editable desde el admin. Se siembra una vez desde db/products.seed.json
-- (ver db/products-store.js → ensureSeeded). Tras la siembra, esta tabla es la
-- fuente de verdad; el JSON queda solo como snapshot inicial.
CREATE TABLE IF NOT EXISTS products (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  category        TEXT,
  category_label  TEXT,
  price           NUMERIC,
  image           TEXT,           -- imagen principal (ruta /products/x.jpg o URL absoluta)
  images          JSONB,          -- galería (array de rutas)
  palette         TEXT,
  short_desc      TEXT,
  description     TEXT,
  tags            JSONB,
  badge           TEXT,
  details         JSONB,
  active          BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS products_active_idx ON products (active);
CREATE INDEX IF NOT EXISTS products_sort_idx   ON products (sort_order, created_at);

-- Imágenes subidas desde el admin. En Railway el disco es efímero, así que el
-- binario vive en la BD y se sirve por GET /api/products/img/:id.
CREATE TABLE IF NOT EXISTS product_images (
  id          TEXT PRIMARY KEY,
  product_id  TEXT,
  data        BYTEA NOT NULL,
  mime        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ads generados con Higgsfield (Marketing Studio). El binario (PNG/MP4) vive en
-- la BD por la misma razón que las imágenes. Ver integrations/higgsfield/studio.js.
CREATE TABLE IF NOT EXISTS marketing_assets (
  id          TEXT PRIMARY KEY,
  product_id  TEXT,
  kind        TEXT,        -- 'image' | 'video'
  size        TEXT,        -- 'square' | 'vertical'
  vibe        TEXT,
  prompt      TEXT,
  job_set_id  TEXT,
  status      TEXT NOT NULL DEFAULT 'generating',  -- generating | completed | failed
  error       TEXT,
  media       BYTEA,
  mime        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS marketing_assets_product_idx ON marketing_assets (product_id, created_at DESC);
`;

async function migrate() {
  if (!enabled || migrated) return;
  await pool.query(SCHEMA);
  migrated = true;
  console.log('[db] schema OK');
}

async function query(text, params) {
  if (!enabled) throw new Error('DATABASE_URL no configurado — la persistencia está deshabilitada.');
  await migrate();
  return pool.query(text, params);
}

module.exports = { enabled, query, migrate };
