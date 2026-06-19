// Vigía de franjas de entrega: cada minuto revisa la hora de Lima y, al iniciar
// una franja horaria (09:00 / 13:00 / 17:00), avisa por Google Chat los pedidos
// de hoy en esa franja. Se dispara una vez por franja por día (guard en memoria).
'use strict';

const db = require('../../db');
const gchat = require('./gchat');

// Franja → hora de inicio (Lima, 24h). Debe calzar con los timeSlots del checkout.
const SLOT_START_HOUR = {
  '09:00 – 13:00': 9,
  '13:00 – 17:00': 13,
  '17:00 – 20:00': 17,
};

// Fecha (YYYY-MM-DD) y hora actuales en America/Lima (UTC-5, sin DST).
function limaNow() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Lima',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value;
  let hour = Number(get('hour'));
  if (hour === 24) hour = 0; // algunos entornos devuelven '24' a medianoche
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour };
}

const fired = new Set(); // claves `${date}|${slot}` ya notificadas

async function tick() {
  if (!gchat.isConfigured() || !db.enabled) return;
  const { date, hour } = limaNow();
  for (const [slot, startHour] of Object.entries(SLOT_START_HOUR)) {
    // Disparamos en cualquier momento de la hora de inicio (robusto a drift del
    // intervalo y a reinicios dentro de esa hora), una sola vez por día/franja.
    if (hour !== startHour) continue;
    const key = `${date}|${slot}`;
    if (fired.has(key)) continue;
    fired.add(key);
    try {
      const { rows } = await db.query(
        `SELECT id, recipient_name, recipient_address, recipient_apt
           FROM orders
          WHERE delivery_date = $1 AND delivery_time = $2 AND status <> 'cancelled'
          ORDER BY created_at ASC`,
        [date, slot]
      );
      if (rows.length) {
        await gchat.notifySlotStart(slot, rows, date);
        console.log(`[delivery-watch] aviso franja ${slot} (${date}): ${rows.length} pedido(s)`);
      }
    } catch (e) {
      console.error('[delivery-watch] error:', e.message);
      fired.delete(key); // reintentar en el próximo tick
    }
  }
  if (fired.size > 60) fired.clear(); // poda; las claves viejas ya no importan
}

function start() {
  if (!gchat.isConfigured()) {
    console.log('[delivery-watch] sin GCHAT_WEBHOOK_URL — desactivado');
    return;
  }
  setInterval(tick, 60 * 1000);
  tick(); // primera pasada inmediata
  console.log('[delivery-watch] activo (revisa cada minuto, hora Lima)');
}

module.exports = { start, tick, limaNow, SLOT_START_HOUR };
