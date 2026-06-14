// integrations/cards/order-card.js
// Pegamento entre el pedido y el generador de tarjetas: genera el PNG a partir
// de card_note y lo guarda en la columna orders.card_png. Pensado para correr
// en segundo plano tras crear el pedido (no bloquea la respuesta al cliente) y
// también bajo demanda desde el panel /admin.
'use strict';

const db = require('../../db');
const { generateCardPng } = require('./generate');

/**
 * Genera la tarjeta de un pedido y la persiste en BD. Idempotente-ish: cada
 * llamada regenera (eligiendo plantilla al azar salvo que se fije `template`).
 *
 * @param {object} order  Fila del pedido (al menos id, card_note, recipient_name, buyer_name).
 * @param {object} [opts]
 * @param {string} [opts.template]  Forzar plantilla concreta (para regenerar igual).
 * @returns {Promise<{ ok: boolean, template?: string, error?: string }>}
 */
async function generateAndStoreCard(order, opts = {}) {
  if (!order || !order.id) return { ok: false, error: 'pedido sin id' };
  const note = (order.card_note || '').trim();
  if (!note) return { ok: false, error: 'sin mensaje de tarjeta' };

  try {
    const { buffer, template } = await generateCardPng({
      note,
      recipientName: order.recipient_name,
      buyerName: order.buyer_name,
      template: opts.template,
    });

    if (db.enabled) {
      await db.query(
        `UPDATE orders
            SET card_png = $1, card_template = $2,
                card_generated_at = NOW(), card_error = NULL
          WHERE id = $3`,
        [buffer, template, order.id]
      );
    }
    return { ok: true, template, buffer };
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    console.error(`[card] generación falló para ${order.id}:`, msg);
    if (db.enabled) {
      try {
        await db.query(`UPDATE orders SET card_error = $1 WHERE id = $2`, [msg, order.id]);
      } catch (_) { /* swallow */ }
    }
    return { ok: false, error: msg };
  }
}

module.exports = { generateAndStoreCard };
