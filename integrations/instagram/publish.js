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
// Variables de entorno (las mismas que el feed de la galería):
//   IG_USER_ID        id numérico de la cuenta de Instagram Business/Creator.
//   IG_ACCESS_TOKEN   token de larga duración. Permisos que hacen falta:
//                     instagram_basic + instagram_content_publish +
//                     pages_read_engagement (sobre la página de Facebook ligada).
//   PUBLIC_BASE_URL   https://limaflores.pe — de dónde baja Meta el archivo.
'use strict';

try { require('../whatsapp/load-env')(); } catch { /* opcional */ }

const VER = process.env.WA_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${VER}`;

const userId = () => process.env.IG_USER_ID || '';
const token = () => process.env.IG_ACCESS_TOKEN || process.env.WA_TOKEN || '';
const publicBase = () => (process.env.PUBLIC_BASE_URL || '').replace(/\/+$/, '');

/** Qué falta para poder publicar. Vacío = todo listo. */
function faltantes() {
  const falta = [];
  if (!userId()) falta.push('IG_USER_ID');
  if (!token()) falta.push('IG_ACCESS_TOKEN');
  const base = publicBase();
  if (!base) falta.push('PUBLIC_BASE_URL');
  else if (!/^https:\/\//i.test(base)) falta.push('PUBLIC_BASE_URL con https (Meta no baja de http)');
  return falta;
}
const configurado = () => faltantes().length === 0;

/** La URL desde la que Meta va a bajar la pieza. */
const urlDeMedia = (id) => `${publicBase()}/api/ig/media/${id}`;

async function graph(ruta, cuerpo) {
  const r = await fetch(`${BASE}/${ruta}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify({ ...cuerpo, access_token: token() }) : undefined,
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
async function esperarContenedor(creationId, { maxMs = 5 * 60 * 1000 } = {}) {
  const hasta = Date.now() + maxMs;
  let ultimo = '';
  while (Date.now() < hasta) {
    const r = await graph(`${creationId}?fields=status_code,status&access_token=${encodeURIComponent(token())}`);
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
 * Publica una pieza ya encolada. `kind` es 'image' o 'reel'.
 * Devuelve { igMediaId, permalink }.
 */
async function publicar({ id, kind, caption }) {
  const falta = faltantes();
  if (falta.length) throw new Error(`Sin configurar: falta ${falta.join(', ')}.`);

  const url = urlDeMedia(id);
  const contenedor = kind === 'reel'
    ? { media_type: 'REELS', video_url: url, caption }
    : { image_url: url, caption };

  const { id: creationId } = await graph(`${userId()}/media`, contenedor);
  if (!creationId) throw new Error('Meta no devolvió creation_id.');

  if (kind === 'reel') await esperarContenedor(creationId);

  const { id: igMediaId } = await graph(`${userId()}/media_publish`, { creation_id: creationId });
  if (!igMediaId) throw new Error('Meta no devolvió el id de la publicación.');

  // El permalink es un lujo: si falla, la pieza ya está publicada igual.
  let permalink = null;
  try {
    const info = await graph(`${igMediaId}?fields=permalink&access_token=${encodeURIComponent(token())}`);
    permalink = info.permalink || null;
  } catch { /* se queda sin enlace y ya */ }

  return { igMediaId, permalink };
}

/** Cuántas publicaciones le quedan a la cuenta en la ventana de 24 h de Meta. */
async function cupoRestante() {
  if (!configurado()) return null;
  try {
    const r = await graph(`${userId()}/content_publishing_limit?fields=quota_usage,config&access_token=${encodeURIComponent(token())}`);
    const d = (r.data && r.data[0]) || {};
    const tope = (d.config && d.config.quota_total) || 50;
    return { usado: d.quota_usage || 0, tope };
  } catch { return null; }
}

module.exports = { publicar, configurado, faltantes, urlDeMedia, cupoRestante };
