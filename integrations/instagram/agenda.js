// La agenda del publicador: cinco piezas al día, a horas fijas de Lima.
//
// Instagram **no programa por API** — el Graph publica en el momento en que se
// le pide. Así que la programación es nuestra: cada pieza entra a la cola con su
// hora y el vigía (publisher.js) la publica cuando vence.
//
// Las horas son de Lima (UTC−5 todo el año, Perú no cambia de horario). Se
// guarda en UTC, como todo lo demás en la BD.
'use strict';

const OFFSET_LIMA = -5;

/** Fecha UTC del día `dia` (en Lima) a la hora `hora` (en Lima). */
function enLima(dia, hora) {
  const d = new Date(Date.UTC(dia.getUTCFullYear(), dia.getUTCMonth(), dia.getUTCDate(), hora - OFFSET_LIMA, 0, 0, 0));
  return d;
}

/** El día de Lima al que pertenece un instante. */
function diaLima(fecha) {
  const l = new Date(fecha.getTime() + OFFSET_LIMA * 3600 * 1000);
  return new Date(Date.UTC(l.getUTCFullYear(), l.getUTCMonth(), l.getUTCDate()));
}

function parseHoras(txt, porDia) {
  const horas = String(txt || '')
    .split(',')
    .map((h) => Number(String(h).trim()))
    .filter((h) => Number.isInteger(h) && h >= 0 && h <= 23);
  const base = horas.length ? horas : [9, 12, 15, 18, 21];
  return [...new Set(base)].sort((a, b) => a - b).slice(0, porDia);
}

/**
 * Devuelve `cuantas` horas de publicación, empezando después de `desde`.
 *
 * `desde` es la última pieza ya agendada (o ahora, si la cola está vacía), y por
 * eso cargar la galería dos veces no amontona piezas en el mismo hueco: la
 * segunda tanda sigue donde terminó la primera.
 */
function proximasHoras(cuantas, { desde = new Date(), porDia = 5, horas = '9,12,15,18,21' } = {}) {
  const lista = parseHoras(horas, porDia);
  const salida = [];
  let dia = diaLima(desde);
  // Un año de margen: si alguien encola 2 000 piezas, que reviente el bucle es
  // peor que agendarlas lejos.
  for (let i = 0; i < 400 && salida.length < cuantas; i += 1) {
    for (const h of lista) {
      const cuando = enLima(dia, h);
      if (cuando > desde) salida.push(cuando);
      if (salida.length >= cuantas) break;
    }
    dia = new Date(dia.getTime() + 24 * 3600 * 1000);
  }
  return salida;
}

module.exports = { proximasHoras, parseHoras };
