// /api/admin/wa/* — Promociones por WhatsApp (Meta Cloud API). Protegido: la auth
// ya la validó api/admin.js antes de delegar aquí.
//
// Contactos:
//   GET    /api/admin/wa/contacts            → lista + conteo
//   POST   /api/admin/wa/contacts            → alta individual { name, phone }
//   POST   /api/admin/wa/contacts/import     → bulk { contacts: [{name, phone}] }
//   DELETE /api/admin/wa/contacts/:id
// Plantillas:
//   GET    /api/admin/wa/templates           → lista
//   POST   /api/admin/wa/templates           → crea en Meta { name, bodyText, header... }
//   POST   /api/admin/wa/templates/sync      → refresca estados desde Meta
//   GET    /api/admin/wa/templates/:id/header→ PNG/JPG del header (preview)
// Campañas:
//   POST   /api/admin/wa/campaigns           → crea + envía en background
//   GET    /api/admin/wa/campaigns           → lista
//   GET    /api/admin/wa/campaigns/:id        → detalle + estados por mensaje
'use strict';

const waStore = require('../db/whatsapp-store');
const wa = require('../integrations/whatsapp/client');
const studioStore = require('./../db/studio-store');
const products = require('../db/products-store');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function send(res, code, payload) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

function readJsonBody(req, limit = 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('body too large')); req.destroy(); return; } chunks.push(c); });
    req.on('end', () => { const raw = Buffer.concat(chunks).toString('utf8'); if (!raw) return resolve({}); try { resolve(JSON.parse(raw)); } catch { reject(new Error('invalid JSON')); } });
    req.on('error', reject);
  });
}

// snake_case + minúsculas, requerido por Meta para el nombre de plantilla.
function slugTemplateName(s) {
  return String(s || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    .slice(0, 60) || 'plantilla';
}

// ─── Contactos ────────────────────────────────────────────────────────────────
async function listContacts(req, res) {
  try {
    const [contacts, counts] = await Promise.all([waStore.listContacts(), waStore.countContacts()]);
    return send(res, 200, { contacts, counts });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

async function addContact(req, res) {
  let body; try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  if (!body.phone) return send(res, 400, { error: 'Falta el teléfono.' });
  try { return send(res, 201, await waStore.addContact({ name: body.name, phone: body.phone })); }
  catch (e) { return send(res, 400, { error: e.message }); }
}

async function importContacts(req, res) {
  let body; try { body = await readJsonBody(req, 4 * 1024 * 1024); } catch (e) { return send(res, 400, { error: e.message }); }
  const list = Array.isArray(body.contacts) ? body.contacts : [];
  if (!list.length) return send(res, 400, { error: 'No hay contactos para importar.' });
  try { return send(res, 200, await waStore.importContacts(list)); }
  catch (e) { return send(res, 500, { error: e.message }); }
}

async function deleteContact(req, res, id) {
  try {
    const ok = await waStore.deleteContact(id);
    return ok ? send(res, 200, { id, deleted: true }) : send(res, 404, { error: 'No existe ese contacto.' });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

// ─── Plantillas ──────────────────────────────────────────────────────────────
// Resuelve los bytes de la foto del header desde la fuente elegida.
//   header = { assetId }            → imagen IA del Marketing Studio
//   header = { dataBase64, mime }   → subida o foto de producto (codificada en el front)
async function resolveHeaderImage(header) {
  if (!header) return null;
  if (header.assetId) {
    const row = await studioStore.getMedia(header.assetId);
    if (!row) throw new Error('La imagen del Studio no está lista o no existe.');
    return { buffer: row.media, mime: row.mime || 'image/jpeg' };
  }
  if (header.productImageId) {
    const row = await products.getImage(header.productImageId);
    if (!row) throw new Error('La imagen de producto no existe.');
    return { buffer: row.data, mime: row.mime || 'image/jpeg' };
  }
  if (header.dataBase64) {
    let { dataBase64, mime } = header;
    const m = /^data:([^;]+);base64,(.*)$/s.exec(dataBase64);
    if (m) { mime = mime || m[1]; dataBase64 = m[2]; }
    const buf = Buffer.from(dataBase64, 'base64');
    if (!buf.length) throw new Error('Imagen vacía.');
    if (buf.length > 10 * 1024 * 1024) throw new Error('Imagen demasiado grande (máx 10MB).');
    return { buffer: buf, mime: mime || 'image/jpeg' };
  }
  return null;
}

async function createTemplate(req, res) {
  if (!wa.isConfigured()) return send(res, 503, { error: 'WhatsApp no configurado: faltan credenciales de Meta (WA_TOKEN / WA_PHONE_NUMBER_ID / WA_WABA_ID).' });
  let body; try { body = await readJsonBody(req, 12 * 1024 * 1024); } catch (e) { return send(res, 400, { error: e.message }); }

  const name = slugTemplateName(body.name);
  const language = (body.language || 'es').trim();
  const bodyText = String(body.bodyText || '').trim();
  if (!bodyText) return send(res, 400, { error: 'El cuerpo del mensaje es obligatorio.' });

  const wantsImage = !!(body.header && (body.header.assetId || body.header.productImageId || body.header.dataBase64));
  if (wantsImage && !wa.canCreateTemplates()) {
    return send(res, 503, { error: 'Falta WA_APP_ID para subir la foto del header al crear la plantilla.' });
  }

  // 1. Resolver + subir la foto del header (si hay).
  let headerHandle = null, headerImage = null, headerMime = null;
  try {
    const img = await resolveHeaderImage(body.header);
    if (img) {
      headerImage = img.buffer; headerMime = img.mime;
      headerHandle = await wa.uploadResumable({ buffer: img.buffer, mime: img.mime, filename: name });
    }
  } catch (e) { return send(res, 400, { error: e.message }); }

  // 2. Crear la plantilla en Meta.
  let meta;
  try {
    meta = await wa.createTemplate({
      name, language, category: 'MARKETING',
      bodyText, bodyExample: body.bodyExample || 'Ana',
      headerHandle, buttons: body.buttons,
    });
  } catch (e) { return send(res, 502, { error: 'Meta rechazó la plantilla: ' + e.message }); }

  // 3. Persistir localmente (guardamos el header para re-subirlo al enviar).
  try {
    const saved = await waStore.createTemplate({
      metaId: meta.id, name, language, category: 'MARKETING', status: meta.status || 'PENDING',
      bodyText, headerKind: headerHandle ? 'image' : 'none', headerImage, headerMime,
      buttons: body.buttons || null,
    });
    return send(res, 201, saved);
  } catch (e) { return send(res, 500, { error: e.message }); }
}

async function listTemplates(req, res) {
  try { return send(res, 200, { templates: await waStore.listTemplates() }); }
  catch (e) { return send(res, 500, { error: e.message }); }
}

async function syncTemplates(req, res) {
  if (!wa.isConfigured()) return send(res, 503, { error: 'WhatsApp no configurado.' });
  try {
    const remote = await wa.listTemplates();
    for (const t of remote) {
      await waStore.updateTemplateStatus({
        name: t.name, language: t.language, metaId: t.id, status: t.status, reason: t.rejected_reason,
      });
    }
    return send(res, 200, { templates: await waStore.listTemplates(), synced: remote.length });
  } catch (e) { return send(res, 502, { error: 'No se pudo sincronizar con Meta: ' + e.message }); }
}

async function templateHeader(req, res, id) {
  try {
    const row = await waStore.getTemplateHeader(id);
    if (!row) return send(res, 404, { error: 'Sin header.' });
    res.writeHead(200, { 'Content-Type': row.mime || 'image/jpeg', 'Content-Length': row.data.length, 'Cache-Control': 'no-store' });
    return res.end(row.data);
  } catch (e) { return send(res, 500, { error: e.message }); }
}

// ─── Campañas ────────────────────────────────────────────────────────────────
// Corre en segundo plano: sube el header una vez y envía a cada contacto.
async function runCampaign(campaignId, templateId) {
  const template = await waStore.getTemplateFull(templateId);
  const camp = await waStore.getCampaign(campaignId);
  if (!template || !camp) return;
  const hasVar = /\{\{1\}\}/.test(template.body_text || '');

  let headerMediaId = null;
  if (template.header_kind === 'image' && template.header_image) {
    try { headerMediaId = await wa.uploadMedia({ buffer: template.header_image, mime: template.header_mime || 'image/jpeg', filename: template.name }); }
    catch (e) {
      for (const m of camp.messages) await waStore.markMessage(m.id, { status: 'failed', error: 'Header: ' + e.message });
      await waStore.bumpCampaign(campaignId, { failed: camp.messages.length });
      await waStore.finishCampaign(campaignId, 'failed');
      return;
    }
  }

  for (const m of camp.messages) {
    try {
      const r = await wa.sendTemplate({
        to: m.phone, templateName: template.name, language: template.language,
        headerMediaId, bodyParams: hasVar ? [m.contact_name || 'cliente'] : [],
      });
      await waStore.markMessage(m.id, { status: 'sent', waId: r.id });
      await waStore.bumpCampaign(campaignId, { sent: 1 });
    } catch (e) {
      await waStore.markMessage(m.id, { status: 'failed', error: e.message });
      await waStore.bumpCampaign(campaignId, { failed: 1 });
    }
    await sleep(300); // ritmo suave para no toparse con rate limits
  }
  await waStore.finishCampaign(campaignId, 'done');
}

async function createCampaign(req, res) {
  if (!wa.isConfigured()) return send(res, 503, { error: 'WhatsApp no configurado: faltan credenciales de Meta.' });
  let body; try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  if (!body.templateId) return send(res, 400, { error: 'Elige una plantilla.' });

  const template = await waStore.getTemplateMeta(body.templateId);
  if (!template) return send(res, 404, { error: 'La plantilla no existe.' });
  if (template.status !== 'APPROVED') return send(res, 409, { error: `La plantilla está "${template.status}". Solo se pueden enviar plantillas APPROVED.` });

  const audience = body.audience === 'all' ? 'all' : (Array.isArray(body.audience) ? body.audience : 'all');
  let contacts;
  try { contacts = await waStore.getContacts(audience); } catch (e) { return send(res, 500, { error: e.message }); }
  if (!contacts.length) return send(res, 400, { error: 'No hay contactos en la audiencia (¿todos con opt-out?).' });

  let campaignId;
  try {
    campaignId = await waStore.createCampaign({ name: body.name || template.name, templateId: template.id, total: contacts.length });
    await waStore.queueMessages(campaignId, contacts);
  } catch (e) { return send(res, 500, { error: e.message }); }

  setImmediate(() => runCampaign(campaignId, template.id).catch((e) => console.error('[wa] campaign error:', e.message)));
  return send(res, 202, { campaignId, total: contacts.length, status: 'sending' });
}

async function listCampaigns(req, res) {
  try { return send(res, 200, { campaigns: await waStore.listCampaigns() }); }
  catch (e) { return send(res, 500, { error: e.message }); }
}

async function getCampaign(req, res, id) {
  try {
    const c = await waStore.getCampaign(id);
    return c ? send(res, 200, c) : send(res, 404, { error: 'No existe esa campaña.' });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

// ─── Router ──────────────────────────────────────────────────────────────────
module.exports = async (req, res, urlObj) => {
  const p = urlObj.pathname;

  // Contactos
  if (p === '/api/admin/wa/contacts' && req.method === 'GET')  return listContacts(req, res);
  if (p === '/api/admin/wa/contacts' && req.method === 'POST') return addContact(req, res);
  if (p === '/api/admin/wa/contacts/import' && req.method === 'POST') return importContacts(req, res);
  const cm = p.match(/^\/api\/admin\/wa\/contacts\/([A-Za-z0-9_-]+)$/);
  if (cm && req.method === 'DELETE') return deleteContact(req, res, cm[1]);

  // Plantillas
  if (p === '/api/admin/wa/templates' && req.method === 'GET')  return listTemplates(req, res);
  if (p === '/api/admin/wa/templates' && req.method === 'POST') return createTemplate(req, res);
  if (p === '/api/admin/wa/templates/sync' && req.method === 'POST') return syncTemplates(req, res);
  const hm = p.match(/^\/api\/admin\/wa\/templates\/([A-Za-z0-9_-]+)\/header$/);
  if (hm && req.method === 'GET') return templateHeader(req, res, hm[1]);

  // Campañas
  if (p === '/api/admin/wa/campaigns' && req.method === 'GET')  return listCampaigns(req, res);
  if (p === '/api/admin/wa/campaigns' && req.method === 'POST') return createCampaign(req, res);
  const gm = p.match(/^\/api\/admin\/wa\/campaigns\/([A-Za-z0-9_-]+)$/);
  if (gm && req.method === 'GET') return getCampaign(req, res, gm[1]);

  return send(res, 404, { error: 'whatsapp route not found' });
};
