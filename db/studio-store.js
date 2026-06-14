// db/studio-store.js — acceso a marketing_assets (ads generados con Higgsfield).
// El binario (PNG/MP4) vive en la BD (Railway borra el disco en cada deploy).
'use strict';

const crypto = require('crypto');
const db = require('./index');

async function createAsset({ productId, kind, size, vibe, prompt, jobSetId = null }) {
  const id = crypto.randomBytes(8).toString('hex');
  await db.query(
    `INSERT INTO marketing_assets (id, product_id, kind, size, vibe, prompt, job_set_id, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'generating')`,
    [id, productId || null, kind, size, vibe || null, prompt || null, jobSetId]
  );
  return id;
}

async function setJob(id, jobSetId) {
  await db.query(`UPDATE marketing_assets SET job_set_id = $1 WHERE id = $2`, [jobSetId, id]);
}

async function markCompleted(id, { media, mime }) {
  await db.query(
    `UPDATE marketing_assets SET status = 'completed', media = $1, mime = $2, error = NULL WHERE id = $3`,
    [media, mime, id]
  );
}

async function markFailed(id, error) {
  await db.query(
    `UPDATE marketing_assets SET status = 'failed', error = $1 WHERE id = $2`,
    [String(error).slice(0, 500), id]
  );
}

// Metadatos (sin el binario, que es pesado).
async function getMeta(id) {
  const { rows } = await db.query(
    `SELECT id, product_id, kind, size, vibe, prompt, status, error, mime, created_at
       FROM marketing_assets WHERE id = $1`, [id]
  );
  return rows[0] || null;
}

async function getMedia(id) {
  const { rows } = await db.query(`SELECT media, mime FROM marketing_assets WHERE id = $1`, [id]);
  return rows.length && rows[0].media ? rows[0] : null;
}

async function listByProduct(productId) {
  const { rows } = await db.query(
    `SELECT id, product_id, kind, size, vibe, status, mime, created_at
       FROM marketing_assets WHERE product_id = $1 ORDER BY created_at DESC LIMIT 60`,
    [productId]
  );
  return rows;
}

module.exports = { createAsset, setJob, markCompleted, markFailed, getMeta, getMedia, listByProduct };
