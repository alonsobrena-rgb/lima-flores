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
  // porque es comunicación intra-Railway, no internet expuesto. Contra un
  // Postgres local (pruebas) se va sin SSL: uno recién instalado no lo trae, y
  // exigirlo dejaba el modo «BD de verdad en el portátil» sin usar.
  const local = /@(localhost|127\.0\.0\.1)[:/]/.test(DATABASE_URL);
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: local ? false : { rejectUnauthorized: false },
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

-- Categorías del catálogo, editables desde el admin (alta, edición, orden). Se
-- siembran una vez desde db/categories.seed.json; tras eso, esta tabla es la
-- fuente de verdad del orden de los chips y de la sección de categorías.
CREATE TABLE IF NOT EXISTS categories (
  slug        TEXT PRIMARY KEY,
  label       TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS categories_sort_idx ON categories (sort_order, created_at);

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

-- La conexión con el número de WhatsApp (Cloud API). Una sola fila (id='wa'),
-- igual que ig_settings. Se configura desde el panel y **el token NO vive acá**:
-- la fila solo guarda el NOMBRE de la variable de entorno que lo contiene, que
-- por defecto es la misma de Instagram (IG_ACCESS_TOKEN). Si las dos cuentas
-- están en el mismo Business de Meta, un token de System User sirve para las dos.
CREATE TABLE IF NOT EXISTS wa_conexion (
  id              TEXT PRIMARY KEY,                    -- siempre 'wa'
  phone_number_id TEXT,                                -- el ID del número emisor (Cloud API)
  waba_id         TEXT,                                -- id de la WhatsApp Business Account
  app_id          TEXT,                                -- app de Meta (subir la foto del header)
  token_env       TEXT NOT NULL DEFAULT 'IG_ACCESS_TOKEN',
  numero          TEXT,                                -- +51…, solo para reconocerlo
  etiqueta        TEXT,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO wa_conexion (id) VALUES ('wa') ON CONFLICT (id) DO NOTHING;

-- Un envío suelto (una plantilla a un contacto, desde la lista) también se
-- guarda como campaña de uno: así el historial no tiene dos formas de contar lo
-- mismo. La marca sirve para distinguirlo en el panel.
ALTER TABLE wa_campaigns ADD COLUMN IF NOT EXISTS directo BOOLEAN NOT NULL DEFAULT FALSE;

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

-- ─── Publicador de Instagram ────────────────────────────────────────────────
-- La cola de piezas por publicar. El binario vive acá y no en disco porque
-- Railway borra el disco en cada deploy — mismo motivo que marketing_assets.
-- Instagram descarga el archivo por URL, así que además hay que servirlo:
-- /api/ig/media/:id (público, sin sesión, es la única forma de que Meta lo lea).
CREATE TABLE IF NOT EXISTS ig_queue (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL,                       -- 'image' | 'reel'
  origen        TEXT,                                -- código de la galería (IG-37, VID-01) o 'manual'
  caption       TEXT NOT NULL DEFAULT '',
  media         BYTEA NOT NULL,
  mime          TEXT NOT NULL,
  bytes         INT NOT NULL DEFAULT 0,           -- tamaño, guardado al encolar

  scheduled_at  TIMESTAMPTZ NOT NULL,
  status        TEXT NOT NULL DEFAULT 'queued',      -- queued | publishing | published | failed | paused
  ig_media_id   TEXT,
  permalink     TEXT,
  error         TEXT,
  attempts      INT NOT NULL DEFAULT 0,
  published_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ig_queue_agenda_idx ON ig_queue (status, scheduled_at);

-- Las cuentas de Instagram donde se publica. Se agregan desde el panel; el
-- TOKEN NO SE GUARDA ACÁ: en la fila solo va el NOMBRE de la variable de entorno
-- que lo contiene (Railway). Una base de datos con tokens dentro es una base de
-- datos que no se puede volcar, ni copiar a local, ni mirar en un backup.
CREATE TABLE IF NOT EXISTS ig_cuentas (
  id            TEXT PRIMARY KEY,
  ig_user_id    TEXT NOT NULL,                      -- id numérico de la cuenta Business
  usuario       TEXT,                               -- @handle, solo para reconocerla
  etiqueta      TEXT,                               -- «la principal», «condolencias»…
  token_env     TEXT NOT NULL DEFAULT 'IG_ACCESS_TOKEN',
  activa        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS ig_cuentas_user_idx ON ig_cuentas (ig_user_id);

-- Ajustes del publicador. Una sola fila (id='ig'). El interruptor arranca
-- APAGADO a propósito: publicar es hacia afuera y no se enciende solo con un
-- deploy — lo enciende una persona desde el panel.
CREATE TABLE IF NOT EXISTS ig_settings (
  id            TEXT PRIMARY KEY,
  activo        BOOLEAN NOT NULL DEFAULT FALSE,
  por_dia       INT NOT NULL DEFAULT 5,
  horas         TEXT NOT NULL DEFAULT '9,12,15,18,21', -- hora local de Lima
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO ig_settings (id) VALUES ('ig') ON CONFLICT (id) DO NOTHING;

-- Cada pieza sabe a qué cuenta va. Nula = la primera cuenta activa, que es lo
-- que había antes de que hubiera varias.
ALTER TABLE ig_queue ADD COLUMN IF NOT EXISTS cuenta_id TEXT;
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
