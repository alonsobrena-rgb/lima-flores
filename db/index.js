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

-- Pago con tarjeta vía Culqi: id del cargo aprobado (charge_id) para conciliar.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS culqi_charge_id   TEXT;

-- Tarjeta anónima: el comprador pidió NO incluir su nombre (sin firma).
ALTER TABLE orders ADD COLUMN IF NOT EXISTS card_anonymous    BOOLEAN DEFAULT FALSE;

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

-- ─── Promociones por WhatsApp (Meta Cloud API) ──────────────────────────────
-- Base de clientes para campañas de marketing por plantillas aprobadas por Meta.
CREATE TABLE IF NOT EXISTS wa_contacts (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  phone       TEXT NOT NULL UNIQUE,   -- E.164 normalizado (+51...)
  phone_raw   TEXT,
  opted_out   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Plantillas de mensaje creadas/sincronizadas con Meta. El binario del header
-- (foto) vive en la BD para re-subirlo al enviar (Railway borra el disco).
CREATE TABLE IF NOT EXISTS wa_templates (
  id              TEXT PRIMARY KEY,
  meta_id         TEXT,                            -- id de la plantilla en Meta
  name            TEXT NOT NULL,                   -- snake_case, requerido por Meta
  language        TEXT NOT NULL DEFAULT 'es',
  category        TEXT NOT NULL DEFAULT 'MARKETING',
  status          TEXT NOT NULL DEFAULT 'PENDING', -- PENDING|APPROVED|REJECTED|...
  body_text       TEXT,                            -- con {{1}} para el nombre
  header_kind     TEXT,                            -- 'image' | 'none'
  header_image    BYTEA,                           -- bytes del header (subir al enviar)
  header_mime     TEXT,
  buttons         JSONB,
  rejected_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Campañas de envío (un envío masivo de una plantilla a una audiencia).
CREATE TABLE IF NOT EXISTS wa_campaigns (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  template_id TEXT,
  status      TEXT NOT NULL DEFAULT 'draft',       -- draft|sending|done|failed
  total       INTEGER NOT NULL DEFAULT 0,
  sent        INTEGER NOT NULL DEFAULT 0,
  failed      INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un registro por destinatario de cada campaña (estado de entrega).
CREATE TABLE IF NOT EXISTS wa_messages (
  id            TEXT PRIMARY KEY,
  campaign_id   TEXT,
  contact_id    TEXT,
  phone         TEXT,
  status        TEXT NOT NULL DEFAULT 'queued',    -- queued|sent|failed
  wa_message_id TEXT,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS wa_messages_campaign_idx ON wa_messages (campaign_id, created_at);

-- ─── Suscripciones recurrentes (Culqi) ──────────────────────────────────────
-- Una fila por suscripción activa de flores. id = sxn_ de Culqi. Culqi cobra
-- automáticamente cada periodo; los eventos llegan por webhook (culqi_events).
CREATE TABLE IF NOT EXISTS subscriptions (
  id                 TEXT PRIMARY KEY,                 -- sxn_ de Culqi
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status             TEXT NOT NULL DEFAULT 'active',   -- active|paused|cancelled
  plan_key           TEXT,                             -- clave del catálogo (mensual, b_anual…)
  plan_id            TEXT,                             -- pln_ de Culqi
  model              TEXT,                             -- 'A' | 'B'
  tier               TEXT,                             -- mensual|trimestral|semestral|anual
  amount             NUMERIC,                          -- soles del cobro por periodo
  interval_count     INTEGER,                          -- cada cuántos meses cobra

  customer_id        TEXT,                             -- cus_ de Culqi
  card_id            TEXT,                             -- crd_ de Culqi

  buyer_name         TEXT,
  buyer_email        TEXT,
  buyer_phone        TEXT,

  recipient_name     TEXT,
  recipient_phone    TEXT,
  recipient_address  TEXT,
  recipient_district TEXT,
  delivery_pref      TEXT,                             -- día/horario preferido de entrega
  notes              TEXT,

  last_event         TEXT,
  last_event_at      TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx     ON subscriptions (status);
CREATE INDEX IF NOT EXISTS subscriptions_created_at_idx ON subscriptions (created_at DESC);

-- Datos de entrega equivalentes al checkout (la suscripción pide los mismos datos,
-- excepto el mensaje de la tarjeta y la fecha de envío): referencia, dpto, pin del
-- mapa, recepción y horario preferido.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recipient_address_ref   TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recipient_apt           TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recipient_lat           NUMERIC;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recipient_lng           NUMERIC;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recipient_has_reception BOOLEAN;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS delivery_time           TEXT;

-- Solo la mensual es una suscripción recurrente (Culqi sxn_). Trimestral/semestral/
-- anual son un PAGO ÚNICO (un cargo Culqi chr_): recurring=false + charge_id.
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS recurring               BOOLEAN DEFAULT TRUE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS charge_id               TEXT;

-- Bitácora de eventos de Culqi (webhook): cobros de recurrencia, cancelaciones, etc.
CREATE TABLE IF NOT EXISTS culqi_events (
  id              TEXT PRIMARY KEY,                    -- id del evento (o uuid local)
  type            TEXT,                                -- p.ej. charge.creation, subscription.*
  subscription_id TEXT,                                -- sxn_ relacionado (si aplica)
  payload         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS culqi_events_sub_idx ON culqi_events (subscription_id, created_at DESC);
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
