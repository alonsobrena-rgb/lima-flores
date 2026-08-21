// Lima Flores — WhatsApp Cloud API (Meta Graph).
// Envía mensajes de marketing con PLANTILLAS aprobadas por Meta y permite crearlas
// desde el panel (header con foto + cuerpo con variable {{1}} = nombre).
//
// Usa fetch/FormData/Blob nativos de Node 18+ (igual que el resto del proyecto).
//
// **El mismo token que Instagram.** WhatsApp y el publicador de Instagram viven
// los dos en el Graph de Meta: si el número y la cuenta de Instagram cuelgan del
// mismo Business, un solo token de System User sirve para los dos. Por eso la
// conexión guarda el **nombre de la variable de entorno** del token —que por
// defecto es `IG_ACCESS_TOKEN`, la de Instagram— y no el token en sí. Mismo
// criterio que `ig_cuentas`: una base con tokens dentro es una base que no se
// puede volcar, ni copiar a local, ni mirar en un backup.
//
// Ojo con los permisos: publicar en Instagram e enviar por WhatsApp no piden lo
// mismo. Al token le hacen falta además `whatsapp_business_messaging` y
// `whatsapp_business_management`; si no los tiene, `probar()` lo dice claro en
// vez de fallar recién en el primer envío.
//
// La conexión (ids del número, de la WABA y de la app) se configura desde el
// panel y vive en la tabla `wa_conexion`. Las variables de entorno siguen
// valiendo como respaldo, para no romper lo que ya estaba puesto:
//   WA_TOKEN            token propio de WhatsApp (si no se quiere el de IG)
//   WA_PHONE_NUMBER_ID  id del número emisor (Cloud API)
//   WA_WABA_ID          id de la WhatsApp Business Account
//   WA_APP_ID           id de la app de Meta (para el resumable upload del header)
//   WA_GRAPH_VERSION    versión del Graph (default v21.0)
'use strict';

require('./load-env')();

const VER = process.env.WA_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${VER}`;

// Solo se aceptan variables que empiecen por IG_ o WA_: el nombre lo escribe
// quien administra el panel, y sin ese cerrojo la conexión podría apuntar a
// DATABASE_URL y mandársela a Meta como token.
const ENV_VALIDA = /^(IG|WA)_[A-Z0-9_]*$/;
const TOKEN_ENV_POR_DEFECTO = 'IG_ACCESS_TOKEN';

/** El token de la conexión, leído del entorno. Nunca de la base. */
function tokenDe(conexion) {
  const nombre = (conexion && conexion.token_env) || TOKEN_ENV_POR_DEFECTO;
  if (!ENV_VALIDA.test(nombre)) return '';
  if (process.env[nombre]) return process.env[nombre];
  // Solo la variable por defecto se cae a la otra, para que quien tenía puesto
  // WA_TOKEN de antes siga enviando sin tocar nada. Un nombre escrito a mano no
  // se sustituye por otro token a escondidas.
  return nombre === TOKEN_ENV_POR_DEFECTO ? process.env.WA_TOKEN || '' : '';
}

/**
 * Resuelve la configuración efectiva: lo que dice la fila del panel, y si algo
 * falta, la variable de entorno equivalente.
 */
function config(conexion) {
  const c = conexion || {};
  return {
    tokenEnv: c.token_env || TOKEN_ENV_POR_DEFECTO,
    token: tokenDe(c),
    phoneNumberId: String(c.phone_number_id || process.env.WA_PHONE_NUMBER_ID || '').trim(),
    wabaId: String(c.waba_id || process.env.WA_WABA_ID || '').trim(),
    appId: String(c.app_id || process.env.WA_APP_ID || '').trim(),
  };
}

/** Qué falta para poder enviar. Vacío = todo listo. */
function faltantes(conexion) {
  const cfg = config(conexion);
  const falta = [];
  if (!cfg.token) falta.push(`${cfg.tokenEnv} en el servidor`);
  if (!cfg.phoneNumberId) falta.push('el ID del número de WhatsApp');
  if (!cfg.wabaId) falta.push('el ID de la cuenta de WhatsApp Business (WABA)');
  return falta;
}

const isConfigured = (conexion) => faltantes(conexion).length === 0;

/** Crear plantillas con foto necesita además el id de la app. */
function canCreateTemplates(conexion) {
  const cfg = config(conexion);
  return !!(cfg.token && cfg.wabaId && cfg.appId);
}

// Mensaje de error legible a partir de la respuesta de Graph.
function graphError(json, fallback) {
  const e = json && json.error;
  if (!e) return fallback || 'Error desconocido de Meta';
  return e.error_user_msg || e.message || fallback || 'Error de Meta';
}

async function graphJson(cfg, method, pathname, body) {
  const r = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      'Authorization': `Bearer ${cfg.token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(graphError(json, `HTTP ${r.status} ${pathname}`));
  return json;
}

// ─── Probar la conexión ───────────────────────────────────────────────────────
// Pregunta a Meta por el número y por la WABA con el token elegido. Es la única
// forma honesta de saber si el token de Instagram sirve también para WhatsApp:
// los permisos son distintos y el error recién saldría en el primer envío.
async function probar(conexion) {
  const cfg = config(conexion);
  const falta = faltantes(conexion);
  if (falta.length) return { ok: false, error: 'Falta ' + falta.join(', ') + '.' };

  const out = { ok: true, numero: null, nombre: null, waba: null, calidad: null };
  try {
    const num = await graphJson(cfg, 'GET', `/${cfg.phoneNumberId}?fields=display_phone_number,verified_name,quality_rating`);
    out.numero = num.display_phone_number || null;
    out.nombre = num.verified_name || null;
    out.calidad = num.quality_rating || null;
  } catch (e) {
    return { ok: false, error: `El ID del número no responde con ese token: ${e.message}` };
  }
  try {
    const waba = await graphJson(cfg, 'GET', `/${cfg.wabaId}?fields=name`);
    out.waba = waba.name || null;
  } catch (e) {
    // El número contesta pero la WABA no: se puede enviar, no crear plantillas.
    out.aviso = `El número responde, pero la cuenta de WhatsApp Business no: ${e.message}. `
      + 'Suele ser que al token le falta whatsapp_business_management.';
  }
  return out;
}

// ─── Resumable upload: bytes → header_handle (para crear plantilla con foto) ──
// Doc Meta: 1) crear sesión en /{APP_ID}/uploads  2) subir bytes a /{session_id}.
async function uploadResumable(conexion, { buffer, mime, filename = 'header' }) {
  const cfg = config(conexion);
  if (!cfg.appId) throw new Error('Falta el ID de la app de Meta para subir la imagen del header.');
  // 1. Crear sesión.
  const qs = new URLSearchParams({
    file_length: String(buffer.length),
    file_type: mime || 'image/jpeg',
    file_name: filename,
    access_token: cfg.token,
  });
  const sessRes = await fetch(`${BASE}/${cfg.appId}/uploads?${qs}`, { method: 'POST' });
  const sess = await sessRes.json().catch(() => ({}));
  if (!sessRes.ok || !sess.id) throw new Error(graphError(sess, 'No se pudo iniciar la subida del header.'));

  // 2. Subir los bytes.
  const upRes = await fetch(`${BASE}/${sess.id}`, {
    method: 'POST',
    headers: { 'Authorization': `OAuth ${cfg.token}`, 'file_offset': '0' },
    body: buffer,
  });
  const up = await upRes.json().catch(() => ({}));
  if (!upRes.ok || !up.h) throw new Error(graphError(up, 'No se pudo subir la imagen del header.'));
  return up.h; // handle
}

// ─── Crear plantilla en Meta ─────────────────────────────────────────────────
// headerHandle: opcional (handle del resumable upload, para header tipo imagen).
// bodyText: usa {{1}} para el nombre. bodyExample: valor de muestra para {{1}}.
// footerText: opcional, el pie en gris chico. Meta lo corta en 60 caracteres.
// buttons: array opcional [{type:'URL'|'QUICK_REPLY'|'PHONE_NUMBER', text, url?, phone_number?}].
async function createTemplate(conexion, { name, language = 'es', category = 'MARKETING', bodyText, bodyExample, headerHandle, footerText, buttons }) {
  const cfg = config(conexion);
  const components = [];
  if (headerHandle) {
    components.push({ type: 'HEADER', format: 'IMAGE', example: { header_handle: [headerHandle] } });
  }
  const body = { type: 'BODY', text: bodyText };
  if (/\{\{1\}\}/.test(bodyText || '')) {
    body.example = { body_text: [[bodyExample || 'Ana']] };
  }
  components.push(body);
  // El orden importa: Meta espera HEADER, BODY, FOOTER, BUTTONS. Mandado en
  // otro orden responde un 100 sin decir cuál de los componentes le molestó.
  if (footerText) {
    const pie = String(footerText).trim();
    if (pie.length > 60) {
      throw new Error(`El pie tiene ${pie.length} caracteres y Meta acepta 60: «${pie}».`);
    }
    components.push({ type: 'FOOTER', text: pie });
  }
  if (Array.isArray(buttons) && buttons.length) {
    components.push({ type: 'BUTTONS', buttons });
  }
  const json = await graphJson(cfg, 'POST', `/${cfg.wabaId}/message_templates`, {
    name, language, category, components,
  });
  return { id: json.id, status: json.status || 'PENDING' };
}

// ─── Listar plantillas (para sincronizar estados de aprobación) ───────────────
async function listTemplates(conexion) {
  const cfg = config(conexion);
  const json = await graphJson(
    cfg, 'GET',
    `/${cfg.wabaId}/message_templates?fields=name,status,id,category,language,rejected_reason&limit=200`
  );
  return Array.isArray(json.data) ? json.data : [];
}

// ─── Subir media al número (devuelve media id para el header al enviar) ───────
async function uploadMedia(conexion, { buffer, mime, filename = 'header' }) {
  const cfg = config(conexion);
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', mime || 'image/jpeg');
  form.append('file', new Blob([buffer], { type: mime || 'image/jpeg' }), filename);
  const r = await fetch(`${BASE}/${cfg.phoneNumberId}/media`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${cfg.token}` },
    body: form,
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok || !json.id) throw new Error(graphError(json, 'No se pudo subir la imagen al número.'));
  return json.id;
}

// ─── Enviar un mensaje de plantilla ───────────────────────────────────────────
// headerMediaId: media id (opcional, solo si la plantilla tiene header de imagen).
// bodyParams: array de strings que llenan {{1}}, {{2}}, ...
async function sendTemplate(conexion, { to, templateName, language = 'es', headerMediaId, bodyParams }) {
  const cfg = config(conexion);
  const components = [];
  if (headerMediaId) {
    components.push({ type: 'header', parameters: [{ type: 'image', image: { id: headerMediaId } }] });
  }
  if (Array.isArray(bodyParams) && bodyParams.length) {
    components.push({ type: 'body', parameters: bodyParams.map((t) => ({ type: 'text', text: String(t) })) });
  }
  const template = { name: templateName, language: { code: language } };
  if (components.length) template.components = components;
  const json = await graphJson(cfg, 'POST', `/${cfg.phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template,
  });
  const id = json && json.messages && json.messages[0] && json.messages[0].id;
  return { id: id || null, raw: json };
}

module.exports = {
  ENV_VALIDA, TOKEN_ENV_POR_DEFECTO,
  config, tokenDe, faltantes, isConfigured, canCreateTemplates, probar,
  uploadResumable, createTemplate, listTemplates, uploadMedia, sendTemplate,
};
