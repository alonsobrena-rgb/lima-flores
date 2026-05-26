// db/index.js — wrapper minimal sobre pg para Railway Postgres.
// Auto-ejecuta migraciones al primer require. Si no hay DATABASE_URL,
// expone un modo "disabled" que falla con un error claro (el endpoint
// /api/order responderá 503 en vez de crashear el server).
'use strict';

const { Pool } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || '';
const enabled = !!DATABASE_URL;

let pool = null;
let migrated = false;

if (enabled) {
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
