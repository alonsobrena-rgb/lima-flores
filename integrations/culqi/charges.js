// Helpers compartidos de cobros Culqi, usados por:
//   - api/culqi.js   (crear el cargo)          → computeAmountCents
//   - api/order.js   (verificar el cargo)       → computeAmountCents + getCharge
// Compartir el cálculo garantiza que la verificación del pedido use EXACTAMENTE el
// mismo monto que se cobró (si divergieran, se rechazarían pedidos legítimos).
'use strict';

const https = require('https');
const store = require('../../db/products-store');

const CULQI_HOST = 'api.culqi.com';
const SECRET = () => process.env.CULQI_SECRET_KEY || '';

// Recalcula el monto a cobrar (en céntimos) desde la BD. NUNCA confía en el precio
// del cliente: cada ítem se re-cotiza por su id contra el catálogo real.
async function computeAmountCents({ items, shipping_fee }) {
  if (!Array.isArray(items) || !items.length) throw new Error('Carrito vacío.');
  await store.ensureSeeded();
  await store.ensureExtras();
  let soles = 0;
  for (const it of items) {
    const qty = Math.max(1, Math.floor(Number(it.qty) || 1));
    const p = await store.getById(String(it.id));
    if (!p || p.price == null) throw new Error(`Producto no disponible: ${it.id}`);
    soles += Number(p.price) * qty;
  }
  soles += Math.max(0, Number(shipping_fee) || 0);
  return Math.round(soles * 100);
}

// GET /v2/charges/{id} — trae un cargo para verificar monto/estado en el servidor.
function getCharge(id) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: CULQI_HOST,
      path: `/v2/charges/${encodeURIComponent(String(id))}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${SECRET()}`, Accept: 'application/json' },
    }, (r) => {
      let d = '';
      r.on('data', (c) => (d += c));
      r.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; } resolve({ status: r.statusCode, json: j }); });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = { computeAmountCents, getCharge };
