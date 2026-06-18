// db/whatsapp-store.js — acceso a datos de "Promociones por WhatsApp".
// Tablas: wa_contacts, wa_templates, wa_campaigns, wa_messages.
// El binario del header de cada plantilla vive en BYTEA (Railway borra el disco).
'use strict';

const crypto = require('crypto');
const db = require('./index');

const newId = () => crypto.randomBytes(8).toString('hex');

// ─── Normalización de teléfono a E.164 (foco Perú) ──────────────────────────
// Limpia espacios/guiones/paréntesis. Si llega un celular peruano de 9 dígitos
// sin código de país, antepone +51. Si ya trae código, respeta el +.
function normalizePhone(raw) {
  if (!raw) return '';
  let s = String(raw).trim().replace(/[\s\-().]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  if (s.startsWith('+')) return '+' + s.slice(1).replace(/\D/g, '');
  s = s.replace(/\D/g, '');
  if (s.length === 9) return '+51' + s;          // celular PE sin código
  if (s.length === 11 && s.startsWith('51')) return '+' + s; // 51 + 9 dígitos
  return '+' + s;
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

async function addContact({ name, phone }) {
  const norm = normalizePhone(phone);
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
async function importContacts(list) {
  let added = 0, skipped = 0;
  for (const row of Array.isArray(list) ? list : []) {
    const norm = normalizePhone(row && row.phone);
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
async function createCampaign({ name, templateId, total }) {
  const id = newId();
  await db.query(
    `INSERT INTO wa_campaigns (id, name, template_id, total, status)
     VALUES ($1,$2,$3,$4,'sending')`,
    [id, name || null, templateId, total || 0]
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
  normalizePhone,
  // contactos
  listContacts, countContacts, addContact, importContacts, deleteContact, getContacts,
  // plantillas
  createTemplate, getTemplateMeta, listTemplates, getTemplateFull, getTemplateHeader,
  updateTemplateStatus,
  // campañas
  createCampaign, queueMessages, markMessage, bumpCampaign, finishCampaign,
  listCampaigns, getCampaign,
};
