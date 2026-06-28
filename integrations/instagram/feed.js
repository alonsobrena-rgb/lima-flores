// Lima Flores — feed de Instagram (Instagram Graph API, sobre Meta Graph).
// Trae los posts recientes de la cuenta @lima_flores para la galería de la landing.
//
// La Instagram Basic Display API quedó deprecada (dic 2024): usamos la
// Instagram Graph API, que requiere una cuenta de Instagram BUSINESS/CREATOR
// conectada a una página de Facebook, y un token de acceso de larga duración.
//
// Variables de entorno:
//   IG_USER_ID        id numérico de la cuenta de Instagram Business (NO el @).
//   IG_ACCESS_TOKEN   token de larga duración con permiso instagram_basic.
//                     Si no está, cae a WA_TOKEN (mismo System User de Meta), por
//                     si el token de WhatsApp ya tiene acceso a la cuenta de IG.
//   WA_GRAPH_VERSION  versión del Graph (default v21.0), compartida con WhatsApp.
'use strict';

// Reutilizamos el cargador de .env de WhatsApp (mismo proveedor: Meta Graph).
try { require('../whatsapp/load-env')(); } catch { /* opcional */ }

const VER = process.env.WA_GRAPH_VERSION || 'v21.0';
const BASE = `https://graph.facebook.com/${VER}`;

const userId = () => process.env.IG_USER_ID || '';
const token = () => process.env.IG_ACCESS_TOKEN || process.env.WA_TOKEN || '';

function isConfigured() { return !!(userId() && token()); }

// Cache en memoria: una llamada al Graph cada CACHE_MS como mucho (evita pegarle
// a Meta en cada visita y respeta los límites de la API).
const CACHE_MS = 10 * 60 * 1000; // 10 min
let _cache = null;
let _cacheAt = 0;

// Normaliza un item de media a lo que consume la galería. Para VIDEO/REELS usa
// el thumbnail como imagen (media_url de un video apunta al .mp4).
function normalize(m) {
  const isVideo = m.media_type === 'VIDEO';
  const image = isVideo ? (m.thumbnail_url || m.media_url) : m.media_url;
  if (!image || !m.permalink) return null;
  return {
    id: m.id,
    image,
    permalink: m.permalink,
    caption: (m.caption || '').slice(0, 140),
    type: m.media_type || 'IMAGE',
    timestamp: m.timestamp || null,
  };
}

// Trae los `limit` posts más recientes (cacheado). Devuelve [] si no está
// configurado o si el Graph falla — la galería decide el fallback.
async function getMedia(limit = 12) {
  if (!isConfigured()) return [];
  if (_cache && Date.now() - _cacheAt < CACHE_MS) return _cache.slice(0, limit);

  const fields = 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp';
  const url = `${BASE}/${userId()}/media?fields=${fields}&limit=${Math.min(25, limit)}&access_token=${encodeURIComponent(token())}`;
  try {
    const r = await fetch(url);
    const json = await r.json().catch(() => ({}));
    if (!r.ok) {
      const msg = (json && json.error && (json.error.message || json.error.error_user_msg)) || `HTTP ${r.status}`;
      console.error('[instagram] Graph error:', msg);
      // No tumbamos la cache previa si la había (mejor mostrar algo viejo que nada).
      return _cache ? _cache.slice(0, limit) : [];
    }
    const posts = (Array.isArray(json.data) ? json.data : []).map(normalize).filter(Boolean);
    _cache = posts; _cacheAt = Date.now();
    return posts.slice(0, limit);
  } catch (e) {
    console.error('[instagram] fetch failed:', e.message);
    return _cache ? _cache.slice(0, limit) : [];
  }
}

module.exports = { isConfigured, getMedia };
