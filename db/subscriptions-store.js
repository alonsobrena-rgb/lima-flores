// Acceso a la tabla `subscriptions` + bitácora `culqi_events`.
// La tabla se crea en db/index.js (migración idempotente).
'use strict';

const db = require('./index');

function rowToSub(r) {
  if (!r) return null;
  return {
    id: r.id,
    createdAt: r.created_at,
    status: r.status,
    planKey: r.plan_key,
    planId: r.plan_id,
    model: r.model,
    tier: r.tier,
    amount: r.amount == null ? null : Number(r.amount),
    intervalCount: r.interval_count,
    customerId: r.customer_id,
    cardId: r.card_id,
    buyer: { name: r.buyer_name, email: r.buyer_email, phone: r.buyer_phone },
    recipient: { name: r.recipient_name, phone: r.recipient_phone, address: r.recipient_address, district: r.recipient_district },
    deliveryPref: r.delivery_pref,
    notes: r.notes,
    lastEvent: r.last_event,
    lastEventAt: r.last_event_at,
  };
}

// Inserta una suscripción ya creada en Culqi (id = sxn_).
async function create(s) {
  await db.query(
    `INSERT INTO subscriptions (
       id, status, plan_key, plan_id, model, tier, amount, interval_count,
       customer_id, card_id,
       buyer_name, buyer_email, buyer_phone,
       recipient_name, recipient_phone, recipient_address, recipient_district,
       delivery_pref, notes
     ) VALUES (
       $1, 'active', $2, $3, $4, $5, $6, $7,
       $8, $9,
       $10, $11, $12,
       $13, $14, $15, $16,
       $17, $18
     )`,
    [
      s.id, s.planKey, s.planId, s.model, s.tier, s.amount, s.intervalCount,
      s.customerId, s.cardId,
      s.buyerName, s.buyerEmail, s.buyerPhone,
      s.recipientName, s.recipientPhone, s.recipientAddress, s.recipientDistrict,
      s.deliveryPref || null, s.notes || null,
    ]
  );
  return s.id;
}

async function listAll() {
  const { rows } = await db.query('SELECT * FROM subscriptions ORDER BY created_at DESC');
  return rows.map(rowToSub);
}

async function getById(id) {
  const { rows } = await db.query('SELECT * FROM subscriptions WHERE id = $1', [id]);
  return rowToSub(rows[0]);
}

async function setStatus(id, status) {
  await db.query('UPDATE subscriptions SET status = $2 WHERE id = $1', [id, status]);
}

async function markEvent(id, eventType, at) {
  await db.query('UPDATE subscriptions SET last_event = $2, last_event_at = $3 WHERE id = $1', [id, eventType, at || new Date()]);
}

// Bitácora de eventos de Culqi (webhook).
async function recordEvent({ id, type, subscriptionId, payload }) {
  await db.query(
    `INSERT INTO culqi_events (id, type, subscription_id, payload)
     VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING`,
    [id, type || null, subscriptionId || null, payload ? JSON.stringify(payload) : null]
  );
}

module.exports = { create, listAll, getById, setStatus, markEvent, recordEvent, rowToSub };
