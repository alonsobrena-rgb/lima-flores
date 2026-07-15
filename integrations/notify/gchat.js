// Notificaciones a Google Chat por webhook entrante.
//
// Crear el webhook: en el espacio de Google Chat → (⋮) → "Aplicaciones e
// integraciones" → "Webhooks" → "Agregar webhook" → copiar la URL. Pegarla en la
// env var GCHAT_WEBHOOK_URL (en el servicio Node de Railway).
//
// Sin la env var, todo queda como no-op silencioso (no rompe el pedido).
'use strict';

function webhookUrl() {
  return process.env.GCHAT_WEBHOOK_URL || process.env.GOOGLE_CHAT_WEBHOOK || '';
}
function isConfigured() { return !!webhookUrl(); }

// POST del mensaje al webhook. Soporta http (para pruebas locales) y https.
// Nunca lanza: resuelve true/false y loguea el error. Fire-and-forget.
function post(message) {
  return new Promise((resolve) => {
    const url = webhookUrl();
    if (!url) return resolve(false);
    let u;
    try { u = new URL(url); } catch { console.error('[gchat] URL inválida'); return resolve(false); }
    const lib = u.protocol === 'http:' ? require('http') : require('https');
    const body = Buffer.from(JSON.stringify(message), 'utf8');
    const req = lib.request({
      hostname: u.hostname,
      port: u.port || (u.protocol === 'http:' ? 80 : 443),
      path: u.pathname + u.search,
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Content-Length': body.length },
    }, (r) => {
      let d = ''; r.on('data', (c) => (d += c));
      r.on('end', () => {
        const ok = r.statusCode >= 200 && r.statusCode < 300;
        if (!ok) console.error(`[gchat] HTTP ${r.statusCode}: ${d.slice(0, 200)}`);
        resolve(ok);
      });
    });
    req.on('error', (e) => { console.error('[gchat] error:', e.message); resolve(false); });
    req.write(body); req.end();
  });
}

function sendText(text) { return post({ text }); }

// ─── Formato ───────────────────────────────────────────────────────────────────
const money = (n) => `S/ ${Number(n || 0).toFixed(2)}`;

function orderAddress(o) {
  const apt = o.recipient_apt ? ` (Dpto/Int. ${o.recipient_apt})` : '';
  return `${o.recipient_address || 's/dirección'}${apt}`;
}

// Notifica un pedido nuevo. `o` = fila/payload con los campos del checkout.
function notifyNewOrder(o) {
  if (!isConfigured()) return Promise.resolve(false);
  const items = Array.isArray(o.items) && o.items.length
    ? o.items.map((it) => `   • ${it.qty || 1}× ${it.name || it.id}`).join('\n')
    : '   • (sin detalle)';
  const lines = [
    `🌸 *Nuevo pedido* — ${o.id}`,
    `👤 Compra: ${o.buyer_name || 's/n'}${o.buyer_phone ? ` · ${o.buyer_phone}` : ''}`,
    `🎁 Para: ${o.recipient_name || 's/n'}${o.recipient_phone ? ` · ${o.recipient_phone}` : ''}`,
    `📍 ${orderAddress(o)}`,
    `🗓️ Entrega: ${o.delivery_date || 's/fecha'} · ${o.delivery_time || 's/horario'}`,
    `🛒\n${items}`,
    `💳 ${o.payment_method || 's/método'} · Total ${money(o.total)}`,
  ];
  return sendText(lines.join('\n'));
}

// Notifica una suscripción nueva (mensual recurrente o pago único "full").
// `s` = { id, recurring, planKey, planLabel, model, amount(soles), buyerName,
//         buyerEmail, buyerPhone, recipientName, recipientPhone,
//         recipientAddress, recipientDistrict }.
function notifyNewSubscription(s) {
  if (!isConfigured()) return Promise.resolve(false);
  const tipo = s.recurring ? 'recurrente' : 'pago único (full)';
  const cobro = s.recurring ? `${money(s.amount)} / mes` : `${money(s.amount)} (un solo pago)`;
  const lines = [
    `💐 *Nueva suscripción* — ${s.id || 's/id'}`,
    `📦 ${s.planLabel || s.planKey || 's/plan'} · ${tipo}`,
    `👤 Suscriptor: ${s.buyerName || 's/n'}${s.buyerPhone ? ` · ${s.buyerPhone}` : ''}${s.buyerEmail ? ` · ${s.buyerEmail}` : ''}`,
    `🎁 Recibe: ${s.recipientName || 's/n'}${s.recipientPhone ? ` · ${s.recipientPhone}` : ''}`,
    `📍 ${s.recipientAddress || 's/dirección'}${s.recipientDistrict ? ` · ${s.recipientDistrict}` : ''}`,
    `💳 ${cobro}`,
  ];
  return sendText(lines.join('\n'));
}

// Notifica el inicio de una franja horaria con sus pedidos de hoy.
// `orders` = filas { id, recipient_name, recipient_address, recipient_apt }.
function notifySlotStart(slot, orders, dateStr) {
  if (!isConfigured()) return Promise.resolve(false);
  const n = orders.length;
  const list = orders
    .map((o) => `   • ${o.id} — ${o.recipient_name || 's/n'} · ${orderAddress(o)}`)
    .join('\n');
  const text = [
    `🚚 *Inicia la franja ${slot}* (${dateStr})`,
    `${n} ${n === 1 ? 'pedido por entregar' : 'pedidos por entregar'}:`,
    list,
  ].join('\n');
  return sendText(text);
}

module.exports = { isConfigured, post, sendText, notifyNewOrder, notifyNewSubscription, notifySlotStart };
