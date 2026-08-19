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
                ig_media_id, permalink, error, attempts, published_at, created_at`;

async function encolar({ kind, origen, caption, media, mime, scheduledAt }) {
  const id = crypto.randomBytes(8).toString('hex');
  await db.query(
    `INSERT INTO ig_queue (id, kind, origen, caption, media, mime, bytes, scheduled_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, kind, origen || 'manual', caption || '', media, mime, media.length, scheduledAt],
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

/** Los códigos de galería ya encolados: para no cargar dos veces lo mismo. */
async function origenesUsados() {
  const { rows } = await db.query(
    `SELECT DISTINCT origen FROM ig_queue WHERE origen IS NOT NULL AND origen <> 'manual'`,
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
      RETURNING id, kind, origen, caption, mime, attempts`,
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
  if (caption !== undefined) { vals.push(caption); sets.push(`caption = $${vals.length}`); }
  if (scheduledAt !== undefined) { vals.push(scheduledAt); sets.push(`scheduled_at = $${vals.length}`); }
  if (status !== undefined) { vals.push(status); sets.push(`status = $${vals.length}`, `error = NULL`); }
  if (!sets.length) return obtener(id);
  vals.push(id);
  await db.query(`UPDATE ig_queue SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
  return obtener(id);
}

async function borrar(id) {
  const { rowCount } = await db.query(`DELETE FROM ig_queue WHERE id = $1`, [id]);
  return rowCount > 0;
}

/** La última hora ya ocupada: desde ahí se sigue agendando. */
async function ultimaAgendada() {
  const { rows } = await db.query(
    `SELECT MAX(scheduled_at) AS ultima FROM ig_queue WHERE status IN ('queued','publishing','published')`,
  );
  return rows[0] && rows[0].ultima ? new Date(rows[0].ultima) : null;
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
  encolar, listar, obtener, media, origenesUsados, tomarVencida,
  marcarPublicada, marcarFallida, actualizar, borrar, ultimaAgendada,
  ajustes, guardarAjustes, publicadasHoy,
};
