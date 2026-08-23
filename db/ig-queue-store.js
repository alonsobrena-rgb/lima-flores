// db/ig-queue-store.js — la cola del publicador de Instagram.
//
// El binario (JPG del post, MP4 del reel) vive en la BD y no en disco: Railway
// borra el disco en cada deploy, y una pieza programada para el jueves tiene que
// sobrevivir a los deploys del miércoles. Mismo criterio que marketing_assets.
'use strict';

const crypto = require('crypto');
const db = require('./index');

// Todo menos el binario: la lista del panel no necesita bajarse los MP4. El
// tamaño va en su columna y no en un octet_length(media): calcularlo al listar
// obliga a leer los blobs enteros, que es justo lo que se quiere evitar.
const CAMPOS = `id, kind, origen, caption, mime, bytes, scheduled_at, status,
                ig_media_id, permalink, error, attempts, published_at, created_at,
                cuenta_id, caption_editado`;

async function encolar({ kind, origen, caption, media, mime, scheduledAt, cuentaId = null }) {
  const id = crypto.randomBytes(8).toString('hex');
  await db.query(
    `INSERT INTO ig_queue (id, kind, origen, caption, media, mime, bytes, scheduled_at, cuenta_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [id, kind, origen || 'manual', caption || '', media, mime, media.length, scheduledAt, cuentaId],
  );
  return id;
}

async function listar({ limite = 200 } = {}) {
  const { rows } = await db.query(
    `SELECT ${CAMPOS} FROM ig_queue ORDER BY scheduled_at ASC LIMIT $1`, [limite],
  );
  return rows;
}

async function obtener(id) {
  const { rows } = await db.query(`SELECT ${CAMPOS} FROM ig_queue WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** El binario, para servirlo a Meta. Aparte del resto porque pesa. */
async function media(id) {
  const { rows } = await db.query(`SELECT media, mime FROM ig_queue WHERE id = $1`, [id]);
  return rows[0] || null;
}

/**
 * Los códigos de galería ya encolados **para esa cuenta**.
 *
 * Por cuenta y no en general: la misma pieza sí puede ir a dos cuentas distintas
 * —para eso se agregan varias—, lo que no puede es ir dos veces a la misma.
 */
async function origenesUsados(cuentaId = null) {
  const { rows } = await db.query(
    `SELECT DISTINCT origen FROM ig_queue
      WHERE origen IS NOT NULL AND origen <> 'manual'
        AND cuenta_id IS NOT DISTINCT FROM $1`, [cuentaId],
  );
  return new Set(rows.map((r) => r.origen));
}

/**
 * Toma UNA pieza vencida y la marca 'publishing' en el mismo UPDATE.
 *
 * El candado es el `AND status = 'queued'` de la línea de abajo, no el SELECT:
 * si dos instancias del servidor despiertan a la vez, las dos eligen la misma
 * fila, pero la segunda vuelve a evaluar la condición cuando se libera el
 * bloqueo, ya no se cumple, y se lleva cero filas. Sin eso, el mismo reel se
 * publica dos veces — que es el error caro de todo esto.
 */
async function tomarVencida() {
  const { rows } = await db.query(
    `UPDATE ig_queue SET status = 'publishing', attempts = attempts + 1
      WHERE id = (
        SELECT id FROM ig_queue
         WHERE status = 'queued' AND scheduled_at <= NOW()
         ORDER BY scheduled_at ASC
         LIMIT 1
      )
        AND status = 'queued'
      RETURNING id, kind, origen, caption, mime, attempts, cuenta_id`,
  );
  return rows[0] || null;
}

async function marcarPublicada(id, { igMediaId, permalink }) {
  await db.query(
    `UPDATE ig_queue SET status = 'published', ig_media_id = $1, permalink = $2,
            error = NULL, published_at = NOW()
      WHERE id = $3`,
    [igMediaId || null, permalink || null, id],
  );
}

/**
 * Falló. Con menos de 3 intentos vuelve a la cola —media hora más tarde, que los
 * errores del Graph suelen ser temporales— y al tercero se queda en 'failed'
 * esperando a una persona.
 */
async function marcarFallida(id, error, { intentos }) {
  const reintenta = intentos < 3;
  await db.query(
    `UPDATE ig_queue
        SET status = $1,
            error = $2,
            scheduled_at = CASE WHEN $3 THEN NOW() + INTERVAL '30 minutes' ELSE scheduled_at END
      WHERE id = $4`,
    [reintenta ? 'queued' : 'failed', String(error).slice(0, 500), reintenta, id],
  );
  return reintenta;
}

async function actualizar(id, { caption, scheduledAt, status }) {
  const sets = [];
  const vals = [];
  // Editar el caption a mano lo marca: el resincronizado respeta ese texto y no
  // lo pisa con el del repo.
  if (caption !== undefined) { vals.push(caption); sets.push(`caption = $${vals.length}`, 'caption_editado = TRUE'); }
  if (scheduledAt !== undefined) { vals.push(scheduledAt); sets.push(`scheduled_at = $${vals.length}`); }
  if (status !== undefined) { vals.push(status); sets.push(`status = $${vals.length}`, `error = NULL`); }
  if (!sets.length) return obtener(id);
  vals.push(id);
  await db.query(`UPDATE ig_queue SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  return obtener(id);
}

/**
 * Las piezas de la cola que salieron del repo y todavía se pueden tocar.
 *
 * Con el binario incluido, porque el resincronizado compara: fuera quedan las ya
 * publicadas —su archivo es historia y su post en Meta ya salió— y las que están
 * publicándose en este momento, que es la fila que el vigía tiene tomada.
 */
async function pendientesDelRepo() {
  const { rows } = await db.query(
    `SELECT id, origen, kind, caption, caption_editado, mime, media
       FROM ig_queue
      WHERE origen IS NOT NULL AND origen <> 'manual'
        AND status IN ('queued', 'paused', 'failed')
      ORDER BY scheduled_at ASC`,
  );
  return rows;
}

/**
 * Las piezas todavía sin publicar marcadas como post del feed, con **solo la
 * cabecera** del binario.
 *
 * 64 kB alcanzan para el marcador SOF de un JPEG y evitan traerse los blobs
 * enteros: son 24 piezas de medio mega cada una y esto corre al arrancar.
 */
async function cabecerasPendientes(bytes = 65536) {
  const { rows } = await db.query(
    `SELECT id, origen, substring(media from 1 for $1) AS cabecera
       FROM ig_queue
      WHERE kind = 'image' AND status IN ('queued','paused')`,
    [bytes],
  );
  return rows;
}

/**
 * Reemplaza el archivo (y opcionalmente el tipo y el texto) de una pieza en cola.
 *
 * El `kind` viaja con el archivo porque depende de él: si un creativo se rehizo
 * de 4:5 a 9:16, deja de ser un post y pasa a ser historia. Reemplazar el JPEG
 * sin mover el tipo lo mandaría al feed para que Meta lo recorte, que es
 * justamente lo que arregló `formato.js`.
 *
 * El `status IN (...)` del WHERE es el mismo candado que `tomarVencida`: si el
 * vigía se llevó la fila entre el SELECT y este UPDATE, acá se lleva cero filas
 * y la pieza sale publicada con el archivo que ya tenía. Cambiarle el binario a
 * algo que Meta está descargando en ese instante es la forma de que el reel
 * quede a medias.
 */
async function reemplazarMedia(id, { media, mime, kind, caption }) {
  const sets = ['media = $1', 'mime = $2', 'bytes = $3'];
  const vals = [media, mime, media.length];
  if (kind !== undefined) { vals.push(kind); sets.push(`kind = $${vals.length}`); }
  if (caption !== undefined) { vals.push(caption); sets.push(`caption = $${vals.length}`); }
  vals.push(id);
  const { rowCount } = await db.query(
    `UPDATE ig_queue SET ${sets.join(', ')}
      WHERE id = $${vals.length} AND status IN ('queued', 'paused', 'failed')`, vals,
  );
  return rowCount > 0;
}

/** Cambia el tipo de una pieza. Solo lo usa la reparación de formatos. */
async function cambiarKind(id, kind) {
  const { rowCount } = await db.query(`UPDATE ig_queue SET kind = $1 WHERE id = $2`, [kind, id]);
  return rowCount > 0;
}

async function borrar(id) {
  const { rowCount } = await db.query(`DELETE FROM ig_queue WHERE id = $1`, [id]);
  return rowCount > 0;
}

/**
 * Adelanta a ahora las `cuantas` piezas en cola que van primero.
 *
 * No publica: mueve la hora y deja que el vigía las tome, que es lo mismo que
 * hace `publicar-ya` con una sola pieza. Por eso sigue respetando el
 * interruptor y el tope diario — adelantar no es una puerta de atrás para
 * publicar con el publicador apagado.
 *
 * Solo toca las `queued`: una pausada está pausada a propósito y una fallida
 * espera a que alguien mire el error.
 *
 * `cuentaId` nulo significa **todas las cuentas**, no «las piezas sin cuenta»;
 * por eso el filtro va con `$2::text IS NULL` y no con `IS NOT DISTINCT FROM`.
 */
async function adelantar(cuantas, cuentaId = null) {
  const n = Math.max(1, Math.min(25, Number(cuantas) || 1));
  const { rows } = await db.query(
    `UPDATE ig_queue SET scheduled_at = NOW()
      WHERE id IN (
        SELECT id FROM ig_queue
         WHERE status = 'queued'
           AND ($2::text IS NULL OR cuenta_id = $2)
         ORDER BY scheduled_at ASC
         LIMIT $1
      )
      RETURNING id, kind, origen, cuenta_id`,
    [n, cuentaId],
  );
  return rows;
}

/**
 * La última hora ya ocupada por esa cuenta: desde ahí se sigue agendando.
 *
 * Por cuenta: dos cuentas publican en paralelo, así que la agenda de una no
 * tiene por qué empujar a la otra.
 */
async function ultimaAgendada(cuentaId = null) {
  const { rows } = await db.query(
    `SELECT MAX(scheduled_at) AS ultima FROM ig_queue
      WHERE status IN ('queued','publishing','published')
        AND cuenta_id IS NOT DISTINCT FROM $1`, [cuentaId],
  );
  return rows[0] && rows[0].ultima ? new Date(rows[0].ultima) : null;
}

/* ── Cuentas ──────────────────────────────────────────────────────────────
   El token NO vive acá: la fila guarda el nombre de la variable de entorno que
   lo contiene. Ver integrations/instagram/publish.js → tokenDe(). */

const COLS_CUENTA = 'id, ig_user_id, usuario, etiqueta, token_env, activa, created_at';

async function listarCuentas() {
  const { rows } = await db.query(`SELECT ${COLS_CUENTA} FROM ig_cuentas ORDER BY created_at ASC`);
  return rows;
}

async function cuenta(id) {
  if (!id) return null;
  const { rows } = await db.query(`SELECT ${COLS_CUENTA} FROM ig_cuentas WHERE id = $1`, [id]);
  return rows[0] || null;
}

/** La cuenta de una pieza sin cuenta asignada: la primera activa. */
async function cuentaPorDefecto() {
  const { rows } = await db.query(
    `SELECT ${COLS_CUENTA} FROM ig_cuentas WHERE activa = TRUE ORDER BY created_at ASC LIMIT 1`,
  );
  return rows[0] || null;
}

async function crearCuenta({ igUserId, usuario, etiqueta, tokenEnv }) {
  const id = crypto.randomBytes(6).toString('hex');
  await db.query(
    `INSERT INTO ig_cuentas (id, ig_user_id, usuario, etiqueta, token_env)
     VALUES ($1,$2,$3,$4,$5)`,
    [id, String(igUserId).trim(), usuario || null, etiqueta || null, tokenEnv || 'IG_ACCESS_TOKEN'],
  );
  return cuenta(id);
}

async function actualizarCuenta(id, { usuario, etiqueta, tokenEnv, activa }) {
  const sets = []; const vals = [];
  if (usuario !== undefined) { vals.push(usuario); sets.push(`usuario = $${vals.length}`); }
  if (etiqueta !== undefined) { vals.push(etiqueta); sets.push(`etiqueta = $${vals.length}`); }
  if (tokenEnv !== undefined) { vals.push(tokenEnv); sets.push(`token_env = $${vals.length}`); }
  if (activa !== undefined) { vals.push(!!activa); sets.push(`activa = $${vals.length}`); }
  if (!sets.length) return cuenta(id);
  vals.push(id);
  await db.query(`UPDATE ig_cuentas SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  return cuenta(id);
}

/** Borra la cuenta. Lo que ya publicó se queda: es historia, no se toca. */
async function borrarCuenta(id) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM ig_queue WHERE cuenta_id = $1 AND status IN ('queued','publishing','paused')`, [id],
  );
  if (rows[0].n) throw new Error(`Esa cuenta tiene ${rows[0].n} pieza(s) en cola. Quítalas o pásalas a otra cuenta primero.`);
  const { rowCount } = await db.query(`DELETE FROM ig_cuentas WHERE id = $1`, [id]);
  return rowCount > 0;
}

const COLS_AJUSTES = 'id, activo, por_dia, horas, updated_at';

async function ajustes() {
  const { rows } = await db.query(`SELECT ${COLS_AJUSTES} FROM ig_settings WHERE id = 'ig'`);
  if (rows[0]) return rows[0];
  await db.query(`INSERT INTO ig_settings (id) VALUES ('ig') ON CONFLICT (id) DO NOTHING`);
  const { rows: r2 } = await db.query(`SELECT ${COLS_AJUSTES} FROM ig_settings WHERE id = 'ig'`);
  return r2[0] || { id: 'ig', activo: false, por_dia: 5, horas: '9,12,15,18,21' };
}

async function guardarAjustes({ activo, porDia, horas }) {
  const a = await ajustes();
  await db.query(
    `UPDATE ig_settings SET activo = $1, por_dia = $2, horas = $3, updated_at = NOW() WHERE id = 'ig'`,
    [activo === undefined ? a.activo : !!activo,
     porDia === undefined ? a.por_dia : Math.max(1, Math.min(25, Number(porDia) || a.por_dia)),
     horas === undefined ? a.horas : String(horas)],
  );
  return ajustes();
}

/** Cuántas se publicaron en las últimas 24 h — el tope de Meta es 50. */
async function publicadasHoy() {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS n FROM ig_queue
      WHERE status = 'published' AND published_at > NOW() - INTERVAL '24 hours'`,
  );
  return rows[0].n;
}

module.exports = {
  pendientesDelRepo, reemplazarMedia,
  encolar, listar, obtener, media, origenesUsados, tomarVencida,
  cabecerasPendientes, cambiarKind,
  marcarPublicada, marcarFallida, actualizar, borrar, ultimaAgendada,
  ajustes, guardarAjustes, publicadasHoy, adelantar,
  listarCuentas, cuenta, cuentaPorDefecto, crearCuenta, actualizarCuenta, borrarCuenta,
};
