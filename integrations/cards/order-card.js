// integrations/cards/order-card.js
// Pegamento entre el pedido y el generador de tarjetas: genera la tarjeta plegada
// a partir de card_note (PDF para imprenta + PNG de previsualización) y la guarda
// en orders.card_pdf / orders.card_png. Pensado para correr en segundo plano tras
// crear el pedido (no bloquea la respuesta al cliente) y bajo demanda desde /admin.
'use strict';

const db = require('../../db');
const { generateCard } = require('./generate');

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
    const { pdf, png, template } = await generateCard({
      note,
      recipientName: order.recipient_name,
      buyerName: order.buyer_name,
      template: opts.template,
    });

    if (db.enabled) {
      await db.query(
        `UPDATE orders
            SET card_png = $1, card_pdf = $2, card_template = $3,
                card_generated_at = NOW(), card_error = NULL
          WHERE id = $4`,
        [png, pdf, template, order.id]
      );
    }
    return { ok: true, template, png, pdf };
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
