// Lima Flores — WhatsApp Cloud API (Meta Graph).
// Envía mensajes de marketing con PLANTILLAS aprobadas por Meta y permite crearlas
// desde el panel (header con foto + cuerpo con variable {{1}} = nombre).
//
// Usa fetch/FormData/Blob nativos de Node 18+ (igual que el resto del proyecto).
//
// Variables de entorno (ver .env.example):
//   WA_TOKEN            token permanente (System User)
//   WA_PHONE_NUMBER_ID  id del número emisor (Cloud API)
//   WA_WABA_ID          id de la WhatsApp Business Account
//   WA_APP_ID           id de la app de Meta (para el resumable upload del header)
//   WA_GRAPH_VERSION    versión del Graph (default v21.0)
'use strict';

require('./load-env')();

const TOKEN = process.env.WA_TOKEN || '';
const PHONE_NUMBER_ID = process.env.WA_PHONE_NUMBER_ID || '';
const WABA_ID = process.env.WA_WABA_ID || '';
const APP_ID = process.env.WA_APP_ID || '';
const VER = process.env.WA_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${VER}`;

function isConfigured() { return !!(TOKEN && PHONE_NUMBER_ID && WABA_ID); }
function canCreateTemplates() { return !!(TOKEN && WABA_ID && APP_ID); }

// Mensaje de error legible a partir de la respuesta de Graph.
function graphError(json, fallback) {
  const e = json && json.error;
  if (!e) return fallback || 'Error desconocido de Meta';
  return e.error_user_msg || e.message || fallback || 'Error de Meta';
}

async function graphJson(method, pathname, body) {
  const r = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(graphError(json, `HTTP ${r.status} ${pathname}`));
  return json;
}

// ─── Resumable upload: bytes → header_handle (para crear plantilla con foto) ──
// Doc Meta: 1) crear sesión en /{APP_ID}/uploads  2) subir bytes a /{session_id}.
async function uploadResumable({ buffer, mime, filename = 'header' }) {
  if (!APP_ID) throw new Error('Falta WA_APP_ID para subir la imagen del header.');
  // 1. Crear sesión.
  const qs = new URLSearchParams({
    file_length: String(buffer.length),
    file_type: mime || 'image/jpeg',
    file_name: filename,
    access_token: TOKEN,
  });
  const sessRes = await fetch(`${BASE}/${APP_ID}/uploads?${qs}`, { method: 'POST' });
  const sess = await sessRes.json().catch(() => ({}));
  if (!sessRes.ok || !sess.id) throw new Error(graphError(sess, 'No se pudo iniciar la subida del header.'));

  // 2. Subir los bytes.
  const upRes = await fetch(`${BASE}/${sess.id}`, {
    method: 'POST',
    headers: { 'Authorization': `OAuth ${TOKEN}`, 'file_offset': '0' },
    body: buffer,
  });
  const up = await upRes.json().catch(() => ({}));
  if (!upRes.ok || !up.h) throw new Error(graphError(up, 'No se pudo subir la imagen del header.'));
  return up.h; // handle
}

// ─── Crear plantilla en Meta ─────────────────────────────────────────────────
// headerHandle: opcional (handle del resumable upload, para header tipo imagen).
// bodyText: usa {{1}} para el nombre. bodyExample: valor de muestra para {{1}}.
// buttons: array opcional [{type:'URL'|'QUICK_REPLY'|'PHONE_NUMBER', text, url?, phone_number?}].
async function createTemplate({ name, language = 'es', category = 'MARKETING', bodyText, bodyExample, headerHandle, buttons }) {
  const components = [];
  if (headerHandle) {
    components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerHandle] } });
  }
  const body = { type: 'BODY', text: bodyText };
  if (/\{\{1\}\}/.test(bodyText || '')) {
    body.example = { body_text: [[bodyExample || 'Ana']] };
  }
  components.push(body);
  if (Array.isArray(buttons) && buttons.length) {
    components.push({ type: 'BUTTONS', buttons });
  }
  const json = await graphJson('POST', `/${WABA_ID}/message_templates`, {
    name, language, category, components,
  });
  return { id: json.id, status: json.status || 'PENDING' };
}

// ─── Listar plantillas (para sincronizar estados de aprobación) ───────────────
async function listTemplates() {
  const json = await graphJson(
    'GET',
    `/${WABA_ID}/message_templates?fields=name,status,id,category,language,rejected_reason&limit=200`
  );
  return Array.isArray(json.data) ? json.data : [];
}

// ─── Subir media al número (devuelve media id para el header al enviar) ───────
async function uploadMedia({ buffer, mime, filename = 'header' }) {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime || 'image/jpeg');
  form.append('file', new Blob([buffer], { type: mime || 'image/jpeg' }), filename);
  const r = await fetch(`${BASE}/${PHONE_NUMBER_ID}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}` },
    body: form,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.id) throw new Error(graphError(json, 'No se pudo subir la imagen al número.'));
  return json.id;
}

// ─── Enviar un mensaje de plantilla ───────────────────────────────────────────
// headerMediaId: media id (opcional, solo si la plantilla tiene header de imagen).
// bodyParams: array de strings que llenan {{1}}, {{2}}, ...
async function sendTemplate({ to, templateName, language = 'es', headerMediaId, bodyParams }) {
  const components = [];
  if (headerMediaId) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { id: headerMediaId } }] });
  }
  if (Array.isArray(bodyParams) && bodyParams.length) {
    components.push({ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t) })) });
  }
  const template = { name: templateName, language: { code: language } };
  if (components.length) template.components = components;
  const json = await graphJson('POST', `/${PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template,
  });
  const id = json && json.messages && json.messages[0] && json.messages[0].id;
  return { id: id || null, raw: json };
}

module.exports = {
  isConfigured, canCreateTemplates,
  uploadResumable, createTemplate, listTemplates, uploadMedia, sendTemplate,
};
