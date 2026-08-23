// Cargar la galería a la cola: los creativos ya hechos, con su copy.
//
// Las piezas y su texto viven en el repo y llegan con el deploy:
//   marketing/ig-ads/ads.json   + creativos/IG-xx.jpg   → posts 4:5 e historias 9:16
//   marketing/video/videos.json + creativos/VID-xx.mp4  → reels 9:16
//
// Post o historia lo decide el tamaño del JPEG, no el `placement` de
// `ads.json`: ver `formato.js`.
//
// El caption NO se inventa acá: es el `primaryText` que ya se escribió para cada
// anuncio más sus hashtags. Si mañana cambia el copy en el JSON, cambia el
// caption — una sola fuente, como manda el pipeline de piezas gráficas.
'use strict';

const fs = require('fs');
const path = require('path');

const formato = require('./formato');

const RAIZ = path.resolve(__dirname, '../..');
const ADS = path.join(RAIZ, 'marketing/ig-ads');
const VIDEO = path.join(RAIZ, 'marketing/video');

const LIMITE_CAPTION = 2200;   // el tope de Instagram
const LIMITE_HASHTAGS = 30;    // el otro tope de Instagram

function caption(pieza) {
  const cuerpo = (pieza.primaryText || pieza.headline || '').trim();
  const tags = (pieza.hashtags || []).slice(0, LIMITE_HASHTAGS).join(' ');
  return `${cuerpo}${tags ? `\n\n${tags}` : ''}`.slice(0, LIMITE_CAPTION);
}

function leerJson(archivo) {
  try { return JSON.parse(fs.readFileSync(archivo, 'utf8')); }
  catch { return null; }
}

/**
 * Todas las piezas del repo, por código. Es la fuente única: la galería pública
 * (`marketing/ig-ads/galeria.py`) arma su página con estos mismos archivos, así
 * que lo que se ve en `limaflores.pe/galeria` y lo que se encola es lo mismo.
 *
 * El binario se lee cada vez a propósito, sin cachear: `resincronizar` existe
 * justamente para volver a leerlo después de un deploy que rehízo una pieza.
 */
function porCodigo() {
  const mapa = new Map();

  const ads = leerJson(path.join(ADS, 'ads.json'));
  for (const a of (ads && ads.ads) || []) {
    const archivo = path.join(ADS, 'creativos', `${a.code}.jpg`);
    if (!fs.existsSync(archivo)) continue;
    const media = fs.readFileSync(archivo);
    mapa.set(a.code, {
      origen: a.code,
      // Medido sobre el archivo: nueve de los creativos son 9:16 y en el feed
      // los recorta Meta. Van a historias.
      kind: formato.kindDeImagen(media),
      mime: 'image/jpeg',
      titulo: a.title || a.code,
      caption: caption(a),
      media,
    });
  }

  const videos = leerJson(path.join(VIDEO, 'videos.json'));
  for (const v of (videos && videos.videos) || []) {
    const archivo = path.join(VIDEO, 'creativos', `${v.code}.mp4`);
    if (!fs.existsSync(archivo)) continue;
    mapa.set(v.code, {
      origen: v.code,
      kind: 'reel',
      mime: 'video/mp4',
      titulo: v.title || v.code,
      caption: caption(v),
      media: fs.readFileSync(archivo),
    });
  }

  return mapa;
}

/**
 * Qué hay disponible para encolar.
 * `saltar` es el conjunto de códigos que ya están en la cola.
 */
function disponibles({ saltar = new Set() } = {}) {
  const salida = [...porCodigo().values()].filter((p) => !saltar.has(p.origen));

  // Los reels primero: rinden más que un post fijo y son los que menos hay.
  // Después los posts, y al final las historias, que duran 24 h y no compiten
  // por el mismo sitio del perfil.
  //
  // Con rangos y no con un ternario: el `a.kind === 'reel' ? -1 : 1` de antes
  // decía «después» para los dos órdenes al comparar una historia con un post,
  // y un comparador así no es un orden — con dos tipos daba igual y con tres
  // deja la lista a merced de cómo entren los elementos.
  const RANGO = { reel: 0, image: 1, story: 2 };
  salida.sort((a, b) => (RANGO[a.kind] ?? 9) - (RANGO[b.kind] ?? 9));
  return salida;
}

module.exports = { disponibles, porCodigo, caption };
