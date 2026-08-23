// Qué es cada pieza según sus píxeles: post del feed o historia.
//
// La decisión se **mide**, no se lee de una etiqueta. `ads.json` trae un campo
// `placement` que dice «Historias y Reels · 9:16», pero es texto que escribe
// quien redacta el anuncio: si alguien cambia la plantilla y olvida la línea,
// la pieza vuelve al feed y sale recortada sin que nada avise. El JPEG, en
// cambio, no puede mentir sobre cuánto mide.
//
// Es la misma regla que ya sigue el pipeline gráfico: el encuadre se mide con
// una sonda del navegador y el build revienta si no coincide con lo declarado.
'use strict';

/**
 * Ancho y alto de un JPEG, leídos de su marcador SOF. `null` si no es un JPEG
 * o si no aparece el marcador.
 *
 * Basta con la cabecera: el SOF va siempre antes del SOS (los datos de la
 * imagen), así que no hace falta el archivo entero — por eso la reparación de
 * la cola puede pedirle a Postgres solo los primeros kilobytes de cada fila en
 * vez de traerse los blobs completos.
 */
function medidasJpeg(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 4) return null;
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;   // sin SOI no es JPEG

  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xFF) { i += 1; continue; }
    const marcador = buf[i + 1];

    // SOS: de acá en adelante son datos comprimidos, y el SOF ya tendría que
    // haber aparecido. Seguir buscando sería leer ruido.
    if (marcador === 0xDA) return null;

    // SOF0–SOF15 llevan las medidas. Quedan fuera tres marcadores que caen en
    // ese rango y no son SOF: DHT (C4), JPG (C8) y DAC (CC).
    if (marcador >= 0xC0 && marcador <= 0xCF
        && marcador !== 0xC4 && marcador !== 0xC8 && marcador !== 0xCC) {
      return { alto: buf.readUInt16BE(i + 5), ancho: buf.readUInt16BE(i + 7) };
    }

    // Marcadores sueltos, sin bloque de datos detrás.
    if (marcador === 0x01 || marcador === 0xD8 || (marcador >= 0xD0 && marcador <= 0xD7)) {
      i += 2;
      continue;
    }

    const largo = buf.readUInt16BE(i + 2);
    if (largo < 2) return null;                          // cabecera corrupta
    i += 2 + largo;
  }
  return null;
}

// El feed de Instagram acepta de 4:5 (1,25 de alto por ancho) a 1.91:1. Más
// alto que 4:5 **lo recorta Meta**, no hay ajuste que valga: una pieza 9:16
// (1,78) pierde el 30% por arriba y por abajo, que es donde suele estar el
// titular y el logotipo. Esas van a historias, que es su sitio.
const ALTO_MAXIMO_FEED = 1.25;
// Un pelo de aire: 1350/1080 da 1,25 exacto y no se puede quedar fuera por el
// último bit de un float.
const HOLGURA = 0.01;

/** ¿Esta imagen es más alta de lo que el feed admite sin recortar? */
function esVertical(medidas) {
  if (!medidas || !medidas.ancho || !medidas.alto) return false;
  return medidas.alto / medidas.ancho > ALTO_MAXIMO_FEED + HOLGURA;
}

/**
 * El `kind` de una imagen a partir de sus bytes: 'story' si no entra en el
 * feed, 'image' si entra. Sin medidas legibles se queda en 'image', que es lo
 * que hacía antes: ante la duda, no cambiar de sitio una pieza sola.
 */
function kindDeImagen(buf) {
  return esVertical(medidasJpeg(buf)) ? 'story' : 'image';
}

module.exports = { medidasJpeg, esVertical, kindDeImagen, ALTO_MAXIMO_FEED };
