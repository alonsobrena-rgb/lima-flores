// Dejar la cola igual que el repo. Corre solo en cada arranque.
//
// La cola guarda una COPIA del binario, no una referencia: al encolar IG-25 se
// copió el JPEG de ese momento. Eso es lo correcto para publicar —una pieza
// programada para el jueves tiene que aguantar los deploys del miércoles, y una
// subida a mano no está en ningún repo— pero deja una trampa: rehacer un
// creativo y desplegarlo cambia la galería pública, que lee los archivos, y NO
// cambia la cola.
//
// Eso pasó con VID-01. Se arregló la raya de la banda, se desplegó, la galería
// mostró el video bueno y el panel siguió enseñando el viejo durante días. La
// primera versión de esto era un botón en el panel, y un botón que alguien tiene
// que acordarse de apretar no es «estar conectados»: es la misma trampa con un
// paso más. Por eso ahora corre al arrancar, que es justo cuando el disco acaba
// de cambiar.
//
// El botón sigue existiendo para hacerlo sin esperar a un deploy.
'use strict';

const cola = require('../../db/ig-queue-store');
const galeria = require('./galeria');

/**
 * Vuelve a leer del repo las piezas en cola que cambiaron.
 *
 * Devuelve el detalle de lo que tocó, que es lo que el panel enseña y lo que se
 * escribe en el registro al arrancar.
 */
async function sincronizar() {
  const repo = galeria.porCodigo();
  const filas = await cola.pendientesDelRepo();

  const archivos = [];
  const captions = [];
  const tipos = [];
  const huerfanas = [];

  for (const fila of filas) {
    const pieza = repo.get(fila.origen);
    // Una pieza que ya no está en el repo se deja como está: puede ser un
    // anuncio retirado que todavía se quiere publicar. Se informa y se decide
    // desde el panel, que para eso está el botón de quitar.
    if (!pieza) { huerfanas.push(fila.origen); continue; }

    // El SHA de la fila viene de la columna, no de leer el blob. Solo las filas
    // encoladas antes de que la columna existiera obligan a bajarlo, y se
    // guarda al vuelo para que este arranque sea el último que lo haga.
    let sha = fila.media_sha;
    if (!sha) {
      const guardado = await cola.media(fila.id);
      if (!guardado || !guardado.media) continue;
      sha = cola.sha256(guardado.media);
      await cola.guardarSha(fila.id, sha);
    }

    const distintoArchivo = sha !== cola.sha256(pieza.media);
    // El caption solo si nadie lo reescribió desde el panel. Pisar un texto que
    // escribió una persona, y encima en silencio y al arrancar, sería peor que
    // el problema que esto viene a resolver.
    const distintoTexto = !fila.caption_editado && fila.caption !== pieza.caption;
    // El tipo va con el archivo: un creativo rehecho de 4:5 a 9:16 deja de ser
    // post y pasa a historia, y publicarlo en el feed lo recorta Meta.
    const distintoTipo = fila.kind !== pieza.kind;
    if (!distintoArchivo && !distintoTexto && !distintoTipo) continue;

    const ok = await cola.reemplazarMedia(fila.id, {
      media: pieza.media,
      mime: pieza.mime,
      kind: distintoTipo ? pieza.kind : undefined,
      caption: distintoTexto ? pieza.caption : undefined,
    });
    if (!ok) continue;                       // el vigía se la llevó a publicar
    if (distintoArchivo) archivos.push(fila.origen);
    if (distintoTexto) captions.push(fila.origen);
    if (distintoTipo) tipos.push(`${fila.origen} → ${pieza.kind}`);
  }

  return {
    revisadas: filas.length,
    archivos: archivos.length,
    captions: captions.length,
    tipos,
    codigos: [...new Set([...archivos, ...captions])].sort(),
    huerfanas: [...new Set(huerfanas)].sort(),
  };
}

/** La pasada del arranque: la misma, pero que no tumbe el servidor si falla. */
async function alArrancar() {
  try {
    const r = await sincronizar();
    if (r.archivos || r.captions || r.tipos.length) {
      console.log(`[ig] cola al día con el repo: ${r.archivos} archivo(s), `
        + `${r.captions} caption(s)${r.tipos.length ? `, tipo de ${r.tipos.join(', ')}` : ''}`
        + ` — ${r.codigos.join(', ')}`);
    }
    if (r.huerfanas.length) {
      console.log(`[ig] en cola pero ya no en el repo: ${r.huerfanas.join(', ')}`);
    }
    return r;
  } catch (e) {
    console.error('[ig] no pude poner la cola al día con el repo:', e.message);
    return null;
  }
}

module.exports = { sincronizar, alArrancar };
