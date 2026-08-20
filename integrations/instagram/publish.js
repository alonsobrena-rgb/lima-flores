// Publicar en Instagram — Content Publishing API (Instagram Graph API).
//
// El flujo de Meta son siempre dos pasos, y para video tres:
//
//   1. POST /{ig-user-id}/media          → devuelve un `creation_id` (contenedor)
//   2. (solo video) GET /{creation_id}?fields=status_code hasta FINISHED
//   3. POST /{ig-user-id}/media_publish  → publica el contenedor
//
// **Meta descarga el archivo él mismo**, así que `image_url` / `video_url` tienen
// que ser URLs públicas y accesibles desde internet. De ahí que la cola sirva el
// binario en /api/ig/media/:id y que haga falta PUBLIC_BASE_URL con el dominio
// de producción: desde localhost esto no puede funcionar, y no es un bug.
//
// **Varias cuentas, un token por cuenta, y ningún token en la base de datos.**
// Las cuentas se agregan desde el panel y viven en `ig_cuentas`; de cada una se
// guarda el id numérico y el **nombre de la variable de entorno** que tiene su
// token — el valor se queda en Railway. Una base con tokens dentro es una base
// que no se puede volcar, ni copiar a local, ni mirar en un backup.
//
// Si todas las cuentas están en el mismo Business de Meta, un solo token de
// System User sirve para todas: se deja `IG_ACCESS_TOKEN` en las tres y listo.
// Si son negocios distintos, cada una apunta a su variable
// (`IG_ACCESS_TOKEN_CONDOLENCIAS`, etc.).
//
// Variables de entorno:
//   IG_ACCESS_TOKEN   token de larga duración por defecto. Permisos que hacen
//                     falta: instagram_basic + instagram_content_publish +
//                     pages_read_engagement (sobre la página de Facebook ligada).
//   IG_USER_ID        respaldo: la cuenta única de antes de que hubiera tabla.
//   PUBLIC_BASE_URL   https://limaflores.pe — de dónde baja Meta el archivo.
'use strict';

try { require('../whatsapp/load-env')(); } catch { /* opcional */ }

const VER = process.env.WA_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${VER}`;

const publicBase = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

/**
 * El token de una cuenta, leído del entorno.
 *
 * Solo se aceptan variables que empiecen por `IG_`: el nombre lo escribe quien
 * administra el panel, y sin ese cerrojo una cuenta podría apuntar a
 * `DATABASE_URL` y mandársela a Meta como token.
 */
function tokenDe(cuenta) {
  const nombre = (cuenta && cuenta.token_env) || 'IG_ACCESS_TOKEN';
  if (!/^IG_[A-Z0-9_]*$/.test(nombre)) return '';
  return process.env[nombre] || (nombre === 'IG_ACCESS_TOKEN' ? process.env.WA_TOKEN || '' : '');
}

/** La cuenta «de toda la vida», la de las variables sueltas, si no hay tabla. */
function cuentaDelEntorno() {
  const id = process.env.IG_USER_ID || '';
  return id ? { id: null, ig_user_id: id, usuario: null, token_env: 'IG_ACCESS_TOKEN' } : null;
}

/** Qué falta para poder publicar en esa cuenta. Vacío = todo listo. */
function faltantes(cuenta) {
  const falta = [];
  const c = cuenta || cuentaDelEntorno();
  if (!c || !c.ig_user_id) falta.push('una cuenta de Instagram (se agregan en el panel)');
  if (!tokenDe(c)) falta.push(`${(c && c.token_env) || 'IG_ACCESS_TOKEN'} en el servidor`);
  const base = publicBase();
  if (!base) falta.push('PUBLIC_BASE_URL');
  else if (!/^https:\/\//i.test(base)) falta.push('PUBLIC_BASE_URL con https (Meta no baja de http)');
  return falta;
}
const configurado = (cuenta) => faltantes(cuenta).length === 0;

/** La URL desde la que Meta va a bajar la pieza. */
const urlDeMedia = (id) => `${publicBase()}/api/ig/media/${id}`;

async function graph(ruta, cuerpo, token) {
  const r = await fetch(`${BASE}/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify({ ...cuerpo, access_token: token }) : undefined,
  });
  const crudo = await r.text();
  let json = {};
  try { json = JSON.parse(crudo); } catch { /* no era JSON: lo dice el texto crudo */ }
  if (!r.ok || json.error) {
    const e = json.error || {};
    // El mensaje de Meta es lo único que dice qué pasó de verdad; se conserva
    // entero en el error de la cola para no tener que adivinar desde el panel.
    // Cuando no hay `error.message` —un proxy o un balanceador que responde por
    // Meta— vale más el cuerpo crudo que un «error» a secas.
    const detalle = e.message
      ? `${e.message}${e.error_user_msg ? ` — ${e.error_user_msg}` : ''}`
      : (crudo || '').trim().slice(0, 200) || 'sin cuerpo';
    throw new Error(`Graph ${r.status}: ${detalle}`);
  }
  return json;
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Espera a que Meta termine de procesar el video del reel.
 *
 * No es opcional: si se publica el contenedor antes de FINISHED, el Graph
 * responde que el media no está listo. Un reel de 15 s suele tardar menos de un
 * minuto; el tope de 5 minutos es para no quedarse colgado si algo va mal.
 */
async function esperarContenedor(creationId, token, { maxMs = 5 * 60 * 1000 } = {}) {
  const hasta = Date.now() + maxMs;
  let ultimo = '';
  while (Date.now() < hasta) {
    const r = await graph(`${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`);
    ultimo = r.status_code || '';
    if (ultimo === 'FINISHED') return;
    if (ultimo === 'ERROR' || ultimo === 'EXPIRED') {
      throw new Error(`Meta no pudo procesar el video (${ultimo}${r.status ? `: ${r.status}` : ''}).`);
    }
    await espera(5000);
  }
  throw new Error(`El video sigue en ${ultimo || 'IN_PROGRESS'} después de 5 minutos.`);
}

/**
 * Publica una pieza ya encolada en `cuenta`. `kind` es 'image' o 'reel'.
 * Devuelve { igMediaId, permalink }.
 */
async function publicar({ id, kind, caption }, cuenta) {
  const c = cuenta || cuentaDelEntorno();
  const falta = faltantes(c);
  if (falta.length) throw new Error(`Sin configurar: falta ${falta.join(', ')}.`);
  const token = tokenDe(c);
  const uid = c.ig_user_id;

  const url = urlDeMedia(id);
  const contenedor = kind === 'reel'
    ? { media_type: 'REELS', video_url: url, caption }
    : { image_url: url, caption };

  const { id: creationId } = await graph(`${uid}/media`, contenedor, token);
  if (!creationId) throw new Error('Meta no devolvió creation_id.');

  if (kind === 'reel') await esperarContenedor(creationId, token);

  const { id: igMediaId } = await graph(`${uid}/media_publish`, { creation_id: creationId }, token);
  if (!igMediaId) throw new Error('Meta no devolvió el id de la publicación.');

  // El permalink es un lujo: si falla, la pieza ya está publicada igual.
  let permalink = null;
  try {
    const info = await graph(`${igMediaId}?fields=permalink&access_token=${encodeURIComponent(token)}`);
    permalink = info.permalink || null;
  } catch { /* se queda sin enlace y ya */ }

  return { igMediaId, permalink };
}

/** Cuántas publicaciones le quedan a esa cuenta en la ventana de 24 h de Meta. */
async function cupoRestante(cuenta) {
  const c = cuenta || cuentaDelEntorno();
  if (!configurado(c)) return null;
  try {
    const token = tokenDe(c);
    const r = await graph(`${c.ig_user_id}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token)}`);
    const d = (r.data && r.data[0]) || {};
    const tope = (d.config && d.config.quota_total) || 50;
    return { usado: d.quota_usage || 0, tope };
  } catch { return null; }
}

module.exports = { publicar, configurado, faltantes, urlDeMedia, cupoRestante, tokenDe, cuentaDelEntorno };
