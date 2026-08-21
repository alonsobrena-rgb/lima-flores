// db/whatsapp-store.js — acceso a datos de "Promociones por WhatsApp".
// Tablas: wa_conexion, wa_contacts, wa_templates, wa_campaigns, wa_messages.
// El binario del header de cada plantilla vive en BYTEA (Railway borra el disco).
// El TOKEN NO VIVE ACÁ: wa_conexion solo guarda el nombre de la variable de
// entorno que lo contiene. Ver integrations/whatsapp/client.js → tokenDe().
'use strict';

const crypto = require('crypto');
const db = require('./index');

const newId = () => crypto.randomBytes(8).toString('hex');

// ─── Normalización de teléfono a E.164 ──────────────────────────────────────
// Limpia espacios/guiones/paréntesis y deja el número en formato +<código><nº>.
//
// El código de país lo elige quien carga el contacto —Perú (51) por defecto,
// que es la enorme mayoría—, pero lo que el número traiga escrito manda sobre
// esa elección: un `+` o un `00` adelante se respetan tal cual. Antes se asumía
// Perú siempre, así que un celular chileno de nueve dígitos entraba como
// peruano sin avisar.
const PAIS_POR_DEFECTO = '51'; // Perú

function normalizePhone(raw, codigoPais = PAIS_POR_DEFECTO) {
  if (!raw) return '';
  let s = String(raw).trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) return '+' + s.slice(1).replace(/\D/g, '');
  s = s.replace(/\D/g, '');
  if (!s) return '';
  const cc = String(codigoPais || PAIS_POR_DEFECTO).replace(/\D/g, '') || PAIS_POR_DEFECTO;
  // Si ya viene con el código adelante (51987654321), no se duplica. El margen
  // de cinco dígitos evita confundir un número nacional que empieza igual que
  // su propio código con uno que ya lo trae.
  if (s.startsWith(cc) && s.length > cc.length + 5) return '+' + s;
  return '+' + cc + s;
}

// ─── Conexión con el número de WhatsApp ─────────────────────────────────────
// Una sola fila (id='wa'). Lo que se guarda son ids públicos de Meta y el
// NOMBRE de la variable del token, nunca el token.
const COLS_CONEXION = 'phone_number_id, waba_id, app_id, token_env, numero, etiqueta, updated_at';

async function conexion() {
  const { rows } = await db.query(`SELECT ${COLS_CONEXION} FROM wa_conexion WHERE id = 'wa'`);
  if (rows.length) return rows[0];
  // Primer arranque tras la migración: la fila se crea sola en el esquema, pero
  // si alguien la borró no vale la pena reventar — se devuelve vacía.
  return { phone_number_id: null, waba_id: null, app_id: null, token_env: 'IG_ACCESS_TOKEN', numero: null, etiqueta: null };
}

async function guardarConexion({ phoneNumberId, wabaId, appId, tokenEnv, numero, etiqueta }) {
  const sets = [];
  const vals = [];
  const set = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if (phoneNumberId !== undefined) set('phone_number_id', String(phoneNumberId || '').trim() || null);
  if (wabaId !== undefined) set('waba_id', String(wabaId || '').trim() || null);
  if (appId !== undefined) set('app_id', String(appId || '').trim() || null);
  if (tokenEnv !== undefined) set('token_env', String(tokenEnv || 'IG_ACCESS_TOKEN').trim());
  if (numero !== undefined) set('numero', String(numero || '').trim() || null);
  if (etiqueta !== undefined) set('etiqueta', String(etiqueta || '').trim() || null);
  if (!sets.length) return conexion();
  sets.push('updated_at = NOW()');
  await db.query(
    `INSERT INTO wa_conexion (id) VALUES ('wa') ON CONFLICT (id) DO NOTHING`
  );
  await db.query(`UPDATE wa_conexion SET ${sets.join(', ')} WHERE id = 'wa'`, vals);
  return conexion();
}

// ─── Contactos ──────────────────────────────────────────────────────────────
async function listContacts() {
  const { rows } = await db.query(
    `SELECT id, name, phone, opted_out, created_at FROM wa_contacts ORDER BY created_at DESC`
  );
  return rows;
}

async function countContacts() {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE opted_out = FALSE)::int AS active
       FROM wa_contacts`
  );
  return rows[0] || { total: 0, active: 0 };
}

async function addContact({ name, phone, countryCode }) {
  const norm = normalizePhone(phone, countryCode);
  if (!norm || norm.replace(/\D/g, '').length < 8) throw new Error('Teléfono inválido.');
  const id = newId();
  const { rows } = await db.query(
    `INSERT INTO wa_contacts (id, name, phone, phone_raw)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, wa_contacts.name)
     RETURNING id, name, phone, opted_out, created_at`,
    [id, name || null, norm, String(phone || '')]
  );
  return rows[0];
}

// Bulk import. Devuelve { added, skipped }. Dedupe por teléfono (ON CONFLICT).
// El código de país es el mismo para todo el lote: cada fila puede saltárselo
// escribiendo el suyo con +.
async function importContacts(list, countryCode) {
  let added = 0, skipped = 0;
  for (const row of Array.isArray(list) ? list : []) {
    const norm = normalizePhone(row && row.phone, countryCode);
    if (!norm || norm.replace(/\D/g, '').length < 8) { skipped++; continue; }
    try {
      await db.query(
        `INSERT INTO wa_contacts (id, name, phone, phone_raw)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (phone) DO UPDATE SET name = COALESCE(EXCLUDED.name, wa_contacts.name)`,
        [newId(), (row.name || '').trim() || null, norm, String(row.phone || '')]
      );
      added++;
    } catch { skipped++; }
  }
  return { added, skipped };
}

async function getContact(id) {
  const { rows } = await db.query(
    `SELECT id, name, phone, opted_out FROM wa_contacts WHERE id = $1`, [id]
  );
  return rows[0] || null;
}

// Renombrar / cambiar el teléfono de un contacto ya guardado.
async function updateContact(id, { name, phone, optedOut, countryCode }) {
  const sets = [];
  const vals = [];
  const set = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };
  if (name !== undefined) set('name', String(name || '').trim() || null);
  if (phone !== undefined) {
    const norm = normalizePhone(phone, countryCode);
    if (!norm || norm.replace(/\D/g, '').length < 8) throw new Error('Teléfono inválido.');
    set('phone', norm);
    set('phone_raw', String(phone || ''));
  }
  if (optedOut !== undefined) set('opted_out', !!optedOut);
  if (!sets.length) return getContact(id);
  vals.push(id);
  const { rows } = await db.query(
    `UPDATE wa_contacts SET ${sets.join(', ')} WHERE id = $${vals.length}
     RETURNING id, name, phone, opted_out, created_at`, vals
  );
  return rows[0] || null;
}

async function deleteContact(id) {
  const { rowCount } = await db.query(`DELETE FROM wa_contacts WHERE id = $1`, [id]);
  return rowCount > 0;
}

async function getContacts(audience) {
  if (audience === 'all' || !Array.isArray(audience)) {
    const { rows } = await db.query(
      `SELECT id, name, phone FROM wa_contacts WHERE opted_out = FALSE ORDER BY created_at DESC`
    );
    return rows;
  }
  if (!audience.length) return [];
  const { rows } = await db.query(
    `SELECT id, name, phone FROM wa_contacts WHERE id = ANY($1) AND opted_out = FALSE`,
    [audience]
  );
  return rows;
}

// ─── Plantillas ──────────────────────────────────────────────────────────────
async function createTemplate(t) {
  const id = newId();
  await db.query(
    `INSERT INTO wa_templates
       (id, meta_id, name, language, category, status, body_text, header_kind,
        header_image, header_mime, buttons)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      id, t.metaId || null, t.name, t.language || 'es', t.category || 'MARKETING',
      t.status || 'PENDING', t.bodyText || null, t.headerKind || 'none',
      t.headerImage || null, t.headerMime || null, JSON.stringify(t.buttons || null),
    ]
  );
  return getTemplateMeta(id);
}

// Metadatos sin el BYTEA del header (que es pesado).
async function getTemplateMeta(id) {
  const { rows } = await db.query(
    `SELECT id, meta_id, name, language, category, status, body_text, header_kind,
            header_mime, buttons, rejected_reason, created_at,
            (header_image IS NOT NULL) AS has_header
       FROM wa_templates WHERE id = $1`, [id]
  );
  return rows[0] || null;
}

async function listTemplates() {
  const { rows } = await db.query(
    `SELECT id, meta_id, name, language, category, status, body_text, header_kind,
            header_mime, buttons, rejected_reason, created_at,
            (header_image IS NOT NULL) AS has_header
       FROM wa_templates ORDER BY created_at DESC`
  );
  return rows;
}

// Con el binario del header (para subir al enviar).
async function getTemplateFull(id) {
  const { rows } = await db.query(`SELECT * FROM wa_templates WHERE id = $1`, [id]);
  return rows[0] || null;
}

// El binario del header por id (para servir en el preview del admin).
async function getTemplateHeader(id) {
  const { rows } = await db.query(
    `SELECT header_image, header_mime FROM wa_templates WHERE id = $1`, [id]
  );
  return rows.length && rows[0].header_image
    ? { data: rows[0].header_image, mime: rows[0].header_mime }
    : null;
}

// Sincroniza estado por nombre+idioma (lo que devuelve la lista de Meta).
async function updateTemplateStatus({ name, language, metaId, status, reason }) {
  await db.query(
    `UPDATE wa_templates
        SET status = $1, rejected_reason = $2, meta_id = COALESCE($3, meta_id)
      WHERE name = $4 AND language = $5`,
    [status, reason || null, metaId || null, name, language]
  );
}

// ─── Campañas + mensajes ──────────────────────────────────────────────────────
async function createCampaign({ name, templateId, total, directo = false }) {
  const id = newId();
  await db.query(
    `INSERT INTO wa_campaigns (id, name, template_id, total, status, directo)
     VALUES ($1,$2,$3,$4,'sending',$5)`,
    [id, name || null, templateId, total || 0, !!directo]
  );
  return id;
}

async function queueMessages(campaignId, contacts) {
  for (const c of contacts) {
    await db.query(
      `INSERT INTO wa_messages (id, campaign_id, contact_id, phone, status)
       VALUES ($1,$2,$3,$4,'queued')`,
      [newId(), campaignId, c.id, c.phone]
    );
  }
}

async function markMessage(id, { status, waId, error }) {
  await db.query(
    `UPDATE wa_messages SET status = $1, wa_message_id = $2, error = $3 WHERE id = $4`,
    [status, waId || null, error ? String(error).slice(0, 400) : null, id]
  );
}

async function bumpCampaign(id, { sent = 0, failed = 0 }) {
  await db.query(
    `UPDATE wa_campaigns SET sent = sent + $1, failed = failed + $2 WHERE id = $3`,
    [sent, failed, id]
  );
}

async function finishCampaign(id, status) {
  await db.query(`UPDATE wa_campaigns SET status = $1 WHERE id = $2`, [status, id]);
}

async function listCampaigns() {
  const { rows } = await db.query(
    `SELECT c.*, t.name AS template_name
       FROM wa_campaigns c LEFT JOIN wa_templates t ON t.id = c.template_id
      ORDER BY c.created_at DESC LIMIT 50`
  );
  return rows;
}

async function getCampaign(id) {
  const { rows } = await db.query(
    `SELECT c.*, t.name AS template_name
       FROM wa_campaigns c LEFT JOIN wa_templates t ON t.id = c.template_id
      WHERE c.id = $1`, [id]
  );
  if (!rows.length) return null;
  const { rows: msgs } = await db.query(
    `SELECT m.id, m.phone, m.status, m.error, m.wa_message_id, c.name AS contact_name
       FROM wa_messages m LEFT JOIN wa_contacts c ON c.id = m.contact_id
      WHERE m.campaign_id = $1 ORDER BY m.created_at`, [id]
  );
  return { ...rows[0], messages: msgs };
}

module.exports = {
  normalizePhone, PAIS_POR_DEFECTO,
  // conexión
  conexion, guardarConexion,
  // contactos
  listContacts, countContacts, addContact, importContacts, getContact, updateContact,
  deleteContact, getContacts,
  // plantillas
  createTemplate, getTemplateMeta, listTemplates, getTemplateFull, getTemplateHeader,
  updateTemplateStatus,
  // campañas
  createCampaign, queueMessages, markMessage, bumpCampaign, finishCampaign,
  listCampaigns, getCampaign,
};
