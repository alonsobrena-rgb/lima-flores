// /api/admin/wa/* — Promociones por WhatsApp (Meta Cloud API). Protegido: la auth
// ya la validó api/admin.js antes de delegar aquí.
//
// Conexión (el número emisor y de dónde sale el token):
//   GET    /api/admin/wa/estado              → conexión + qué falta + si el token está puesto
//   POST   /api/admin/wa/conexion            → { phoneNumberId, wabaId, appId, tokenEnv, numero, etiqueta }
//   POST   /api/admin/wa/conexion/probar     → le pregunta a Meta si ese token abre ese número
// Contactos:
//   GET    /api/admin/wa/contacts            → lista + conteo
//   POST   /api/admin/wa/contacts            → alta individual { name, phone }
//   PATCH  /api/admin/wa/contacts/:id        → { name, phone, optedOut }
//   POST   /api/admin/wa/contacts/import     → bulk { contacts: [{name, phone}] }
//   POST   /api/admin/wa/contacts/:id/enviar → una plantilla a ese contacto, ahora
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

// Lo que falta, en una frase para mostrar tal cual en el panel.
const faltaMsg = (cx) => `WhatsApp sin conectar: falta ${wa.faltantes(cx).join(', ')}. Configúralo en la pestaña «Conexión».`;

// ─── Conexión ────────────────────────────────────────────────────────────────
// Nunca se devuelve el token: solo si la variable que lo nombra existe en el
// servidor. Mismo criterio que el publicador de Instagram.
function conexionPublica(cx) {
  const cfg = wa.config(cx);
  return {
    phoneNumberId: cfg.phoneNumberId || '',
    wabaId: cfg.wabaId || '',
    appId: cfg.appId || '',
    tokenEnv: cfg.tokenEnv,
    numero: cx.numero || '',
    etiqueta: cx.etiqueta || '',
    tokenPuesto: !!cfg.token,
  };
}

async function estado(req, res) {
  try {
    const cx = await waStore.conexion();
    return send(res, 200, {
      conexion: conexionPublica(cx),
      configurado: wa.isConfigured(cx),
      falta: wa.faltantes(cx),
      puedeCrearPlantillas: wa.canCreateTemplates(cx),
    });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

async function guardarConexion(req, res) {
  let body; try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }

  if (body.phoneNumberId !== undefined) {
    const id = String(body.phoneNumberId || '').trim();
    if (id && !/^\d{5,}$/.test(id)) {
      return send(res, 400, { error: 'El ID del número es el número que da Meta (solo dígitos), no el +51…' });
    }
    body.phoneNumberId = id;
  }
  for (const campo of ['wabaId', 'appId']) {
    if (body[campo] === undefined) continue;
    const v = String(body[campo] || '').trim();
    if (v && !/^\d{5,}$/.test(v)) return send(res, 400, { error: `El ${campo === 'wabaId' ? 'ID de la cuenta de WhatsApp Business' : 'ID de la app de Meta'} son solo dígitos.` });
    body[campo] = v;
  }
  if (body.tokenEnv !== undefined) {
    const t = String(body.tokenEnv || '').trim().toUpperCase() || wa.TOKEN_ENV_POR_DEFECTO;
    if (!wa.ENV_VALIDA.test(t)) {
      return send(res, 400, { error: 'La variable del token tiene que empezar por IG_ o WA_ (p. ej. IG_ACCESS_TOKEN).' });
    }
    body.tokenEnv = t;
  }

  try {
    const cx = await waStore.guardarConexion(body);
    return send(res, 200, {
      conexion: conexionPublica(cx),
      configurado: wa.isConfigured(cx),
      falta: wa.faltantes(cx),
      // Guardar los ids no hace que el token exista: si no está puesto en
      // Railway, mejor decirlo acá que dejar al usuario mirando un envío que falla.
      aviso: wa.faltantes(cx).length ? faltaMsg(cx) : null,
    });
  } catch (e) { return send(res, 500, { error: e.message }); }
}

async function probarConexion(req, res) {
  try {
    const cx = await waStore.conexion();
    const r = await wa.probar(cx);
    return send(res, r.ok ? 200 : 400, r);
  } catch (e) { return send(res, 502, { ok: false, error: e.message }); }
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

async function patchContact(req, res, id) {
  let body; try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  try {
    const c = await waStore.updateContact(id, {
      name: body.name, phone: body.phone, optedOut: body.optedOut,
    });
    return c ? send(res, 200, c) : send(res, 404, { error: 'No existe ese contacto.' });
  } catch (e) {
    const dup = /duplicate|unique/i.test(e.message);
    return send(res, dup ? 409 : 400, { error: dup ? 'Ya hay otro contacto con ese teléfono.' : e.message });
  }
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
  const cx = await waStore.conexion();
  if (!wa.isConfigured(cx)) return send(res, 503, { error: faltaMsg(cx) });
  let body; try { body = await readJsonBody(req, 12 * 1024 * 1024); } catch (e) { return send(res, 400, { error: e.message }); }

  const name = slugTemplateName(body.name);
  const language = (body.language || 'es').trim();
  const bodyText = String(body.bodyText || '').trim();
  if (!bodyText) return send(res, 400, { error: 'El cuerpo del mensaje es obligatorio.' });

  const wantsImage = !!(body.header && (body.header.assetId || body.header.productImageId || body.header.dataBase64));
  if (wantsImage && !wa.canCreateTemplates(cx)) {
    return send(res, 503, { error: 'Falta el ID de la app de Meta para subir la foto del header al crear la plantilla.' });
  }

  // 1. Resolver + subir la foto del header (si hay).
  let headerHandle = null, headerImage = null, headerMime = null;
  try {
    const img = await resolveHeaderImage(body.header);
    if (img) {
      headerImage = img.buffer; headerMime = img.mime;
      headerHandle = await wa.uploadResumable(cx, { buffer: img.buffer, mime: img.mime, filename: name });
    }
  } catch (e) { return send(res, 400, { error: e.message }); }

  // 2. Crear la plantilla en Meta.
  let meta;
  try {
    meta = await wa.createTemplate(cx, {
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

// Meta manda `rejected_reason: 'NONE'` cuando la plantilla no fue rechazada.
// Guardado tal cual, el panel lo pintaba en rojo debajo de cada plantilla como
// si todas tuvieran un problema. Sin motivo real, se guarda NULL.
const motivoReal = (r) => (r && String(r).toUpperCase() !== 'NONE' ? r : null);

async function syncTemplates(req, res) {
  const cx = await waStore.conexion();
  if (!wa.isConfigured(cx)) return send(res, 503, { error: faltaMsg(cx) });
  try {
    const remote = await wa.listTemplates(cx);
    // Importa además de actualizar: lo creado desde WhatsApp Manager o desde
    // marketing/whatsapp/crear.js nunca pasó por acá, y antes quedaba invisible
    // en el panel aunque estuviera aprobado en Meta.
    let importadas = 0, conFoto = 0;
    for (const t of remote) {
      const c = wa.parseComponents(t.components);
      // La foto solo se baja si acá no la tenemos: la URL de muestra viene
      // firmada y caduca, así que se guarda el binario, no el enlace. Si la
      // descarga falla la plantilla entra igual, solo que sin poder enviarse.
      let foto = null;
      if (c.headerKind === 'image' && c.headerUrl && await waStore.faltaHeader(t.name, t.language)) {
        foto = await wa.fetchHeaderSample(c.headerUrl);
        if (foto) conFoto++;
      }
      const r = await waStore.upsertTemplateDesdeMeta({
        name: t.name, language: t.language, metaId: t.id, status: t.status,
        reason: motivoReal(t.rejected_reason), category: t.category,
        bodyText: c.bodyText, headerKind: c.headerKind, buttons: c.buttons,
        headerImage: foto ? foto.buffer : null, headerMime: foto ? foto.mime : null,
      });
      if (r === 'importada') importadas++;
    }
    return send(res, 200, { templates: await waStore.listTemplates(), synced: remote.length, importadas, conFoto });
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

// ─── Envíos ──────────────────────────────────────────────────────────────────
// Sube el header una vez y envía a cada contacto de la campaña. Lo usan tanto la
// campaña (en segundo plano) como el envío suelto a un contacto (esperando).
async function runCampaign(campaignId, templateId, cx) {
  const template = await waStore.getTemplateFull(templateId);
  const camp = await waStore.getCampaign(campaignId);
  if (!template || !camp) return;
  const hasVar = /\{\{1\}\}/.test(template.body_text || '');

  // Red de seguridad. El sync baja la foto de muestra de Meta, así que esto no
  // debería pasar; pasa si esa descarga falló (URL caducada, red) y la fila
  // quedó con header de imagen y sin binario. Sin esto se enviaba sin cabecera
  // y Meta contestaba un error de componentes que no apunta al problema real.
  if (template.header_kind === 'image' && !template.header_image) {
    const falta = 'Esta plantilla tiene cabecera de imagen y su foto no está guardada acá.'
      + ' Dale a «Sincronizar estados» para que se baje de Meta, o vuelve a crearla desde el panel.';
    for (const m of camp.messages) await waStore.markMessage(m.id, { status: 'failed', error: falta });
    await waStore.bumpCampaign(campaignId, { failed: camp.messages.length });
    await waStore.finishCampaign(campaignId, 'failed');
    return;
  }

  let headerMediaId = null;
  if (template.header_kind === 'image' && template.header_image) {
    try { headerMediaId = await wa.uploadMedia(cx, { buffer: template.header_image, mime: template.header_mime || 'image/jpeg', filename: template.name }); }
    catch (e) {
      for (const m of camp.messages) await waStore.markMessage(m.id, { status: 'failed', error: 'Header: ' + e.message });
      await waStore.bumpCampaign(campaignId, { failed: camp.messages.length });
      await waStore.finishCampaign(campaignId, 'failed');
      return;
    }
  }

  for (const m of camp.messages) {
    try {
      const r = await wa.sendTemplate(cx, {
        to: m.phone, templateName: template.name, language: template.language,
        headerMediaId, bodyParams: hasVar ? [m.contact_name || 'cliente'] : [],
      });
      await waStore.markMessage(m.id, { status: 'sent', waId: r.id });
      await waStore.bumpCampaign(campaignId, { sent: 1 });
    } catch (e) {
      await waStore.markMessage(m.id, { status: 'failed', error: e.message });
      await waStore.bumpCampaign(campaignId, { failed: 1 });
    }
    if (camp.messages.length > 1) await sleep(300); // ritmo suave para no toparse con rate limits
  }
  await waStore.finishCampaign(campaignId, 'done');
}

// Una plantilla a un contacto, ahora mismo. Se espera el resultado (es un solo
// mensaje) para poder decir en el panel si salió o por qué no.
async function enviarAContacto(req, res, contactId) {
  const cx = await waStore.conexion();
  if (!wa.isConfigured(cx)) return send(res, 503, { error: faltaMsg(cx) });
  let body; try { body = await readJsonBody(req); } catch (e) { return send(res, 400, { error: e.message }); }
  if (!body.templateId) return send(res, 400, { error: 'Elige una plantilla.' });

  const contacto = await waStore.getContact(contactId);
  if (!contacto) return send(res, 404, { error: 'No existe ese contacto.' });
  if (contacto.opted_out) return send(res, 409, { error: 'Ese contacto pidió no recibir mensajes.' });

  const template = await waStore.getTemplateMeta(body.templateId);
  if (!template) return send(res, 404, { error: 'La plantilla no existe.' });
  if (template.status !== 'APPROVED') return send(res, 409, { error: `La plantilla está "${template.status}". Solo se pueden enviar plantillas APPROVED.` });

  let campaignId;
  try {
    campaignId = await waStore.createCampaign({
      name: `${template.name} → ${contacto.name || contacto.phone}`,
      templateId: template.id, total: 1, directo: true,
    });
    await waStore.queueMessages(campaignId, [contacto]);
  } catch (e) { return send(res, 500, { error: e.message }); }

  await runCampaign(campaignId, template.id, cx);
  const camp = await waStore.getCampaign(campaignId);
  const msg = camp && camp.messages && camp.messages[0];
  if (msg && msg.status === 'sent') return send(res, 200, { ok: true, campaignId, phone: msg.phone });
  return send(res, 502, { ok: false, error: (msg && msg.error) || 'Meta no aceptó el mensaje.', campaignId });
}

async function createCampaign(req, res) {
  const cx = await waStore.conexion();
  if (!wa.isConfigured(cx)) return send(res, 503, { error: faltaMsg(cx) });
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

  setImmediate(() => runCampaign(campaignId, template.id, cx).catch((e) => console.error('[wa] campaign error:', e.message)));
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

  // Conexión
  if (p === '/api/admin/wa/estado' && req.method === 'GET') return estado(req, res);
  if (p === '/api/admin/wa/conexion' && req.method === 'POST') return guardarConexion(req, res);
  if (p === '/api/admin/wa/conexion/probar' && req.method === 'POST') return probarConexion(req, res);

  // Contactos
  if (p === '/api/admin/wa/contacts' && req.method === 'GET')  return listContacts(req, res);
  if (p === '/api/admin/wa/contacts' && req.method === 'POST') return addContact(req, res);
  if (p === '/api/admin/wa/contacts/import' && req.method === 'POST') return importContacts(req, res);
  const em = p.match(/^\/api\/admin\/wa\/contacts\/([A-Za-z0-9_-]+)\/enviar$/);
  if (em && req.method === 'POST') return enviarAContacto(req, res, em[1]);
  const cm = p.match(/^\/api\/admin\/wa\/contacts\/([A-Za-z0-9_-]+)$/);
  if (cm && req.method === 'PATCH') return patchContact(req, res, cm[1]);
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
