// /api/quote — cotización con Cabify como principal y Urbaner como fallback.
// Portable: corre en Vercel (Node serverless) y en Node http nativo (Railway).
//
// Llamada: GET /api/quote?lat=-12.0972&lng=-77.0363
// Respuesta: { price, currency, distance_m, duration_s, order_type, provider }
//
// Estrategia:
//   1. Intenta Cabify (principal).
//   2. Si Cabify falla por cualquier razón → cae a Urbaner.
//   3. Si Urbaner también falla → 500 al front, que muestra "Coordinamos por WhatsApp".
'use strict';

const { price: urbanerPrice } = require('../integrations/urbaner/client');
const { shippingTypes: cabifyShippingTypes, estimate: cabifyEstimate } = require('../integrations/cabify/client');

// Atelier Lima Flores · Calle Francia 823, Miraflores (centroide ~50-100m).
const ATELIER_LATLON = process.env.URBANER_PICKUP_LATLON || '-12.122272,-77.035838';
const [PICKUP_LAT_STR, PICKUP_LON_STR] = ATELIER_LATLON.split(',');
const PICKUP_LAT = Number(PICKUP_LAT_STR);
const PICKUP_LON = Number(PICKUP_LON_STR);

// ─── Cabify (principal) ─────────────────────────────────
async function quoteCabify(lat, lng) {
  // 1. Lista tipos de envío disponibles en la ubicación del cliente.
  const types = await cabifyShippingTypes(Number(lat), Number(lng));
  const list = Array.isArray(types)
    ? types
    : (types?.available_shipping_types || types?.shipping_types || types?.data || []);

  // 2. Elegir el shipping_type. Cabify Logistics PE no expone vehículo explícito —
  // su flota de drivers (heredada de ride-hailing) es predominantemente auto en Lima.
  // Estrategia:
  //   a) Si hay CABIFY_SHIPPING_TYPE_ID en env → usar ese (control fino).
  //   b) Si no → preferir nombres con "express|standard|envío" y descartar los de
  //      "comida|food" (que son para repartos de restaurante, otro caso de uso).
  //   c) Si nada matchea → primer item de la lista.
  let chosen = null;
  const forcedId = process.env.CABIFY_SHIPPING_TYPE_ID;
  if (forcedId) {
    chosen = list.find((t) => (t.id || t.shipping_type_id) === forcedId);
  }
  if (!chosen) {
    chosen = list.find((t) => {
      const nm = (t.name || t.label || '').toString().toLowerCase();
      if (/comida|food/.test(nm)) return false;
      return /express|standard|standar|env[íi]o/.test(nm);
    });
  }
  if (!chosen) chosen = list[0];
  if (!chosen) throw new Error('Cabify: no hay shipping_types disponibles en esa ubicación');
  const shippingTypeId = chosen.id || chosen.shipping_type_id;
  if (!shippingTypeId) throw new Error('Cabify: el shipping_type elegido no tiene id');

  // 3. Cotiza.
  const est = await cabifyEstimate({
    shippingTypeId,
    pickup: { lat: PICKUP_LAT, lon: PICKUP_LON },
    dropoff: { lat: Number(lat), lon: Number(lng) },
    dimensions: { height: 30, length: 40, width: 30 }, // cm — paquete de flor promedio
    weight: { value: 3000 },                           // gramos — ramo mediano
  });

  // 4. Parseo defensivo: la doc no fija un solo shape, probamos varios paths.
  const parcels = Array.isArray(est?.parcels) ? est.parcels : [];
  const p0 = parcels[0] || est?.parcel || est;

  let priceNum = null, currency = 'PEN';
  const priceCandidates = [
    p0?.estimated_price, p0?.price, p0?.fare, p0?.cost, p0?.amount,
    est?.estimated_price, est?.price, est?.fare,
  ];
  for (const c of priceCandidates) {
    if (c == null) continue;
    if (typeof c === 'number') { priceNum = c; break; }
    if (typeof c === 'object') {
      if (typeof c.value === 'number') { priceNum = c.value; currency = c.currency || currency; break; }
      if (typeof c.amount === 'number') { priceNum = c.amount; currency = c.currency || currency; break; }
      if (typeof c.total === 'number') { priceNum = c.total; currency = c.currency || currency; break; }
    }
  }
  if (priceNum == null) throw new Error(`Cabify: no encontré precio en la respuesta — keys: ${Object.keys(est || {}).join(',')}`);

  // Algunas APIs devuelven en céntimos (1850 = S/18.50). Heurística: si > 200 y la
  // moneda es PEN, probablemente está en céntimos. Esto se puede afinar al testear.
  if (priceNum > 200 && (currency === 'PEN' || currency === 'PE')) priceNum = priceNum / 100;

  const distance = p0?.distance ?? p0?.distance_m ?? est?.distance ?? null;
  const duration = p0?.duration ?? p0?.duration_s ?? est?.duration ?? null;

  return {
    price: priceNum,
    currency,
    order_type: chosen.name || 'AUTO',
    distance_m: typeof distance === 'number' ? distance : null,
    duration_s: typeof duration === 'number' ? duration : null,
    provider: 'cabify',
  };
}

// ─── Urbaner (fallback) ─────────────────────────────────
async function quoteUrbaner(lat, lng) {
  const dropoff = `${lat},${lng}`;
  const out = await urbanerPrice({
    destinations: [{ latlon: ATELIER_LATLON }, { latlon: dropoff }],
    vehicleTypeId: Number(process.env.URBANER_VEHICLE_ID || 1),
    isReturn: false,
  });
  const prices = Array.isArray(out?.prices) ? out.prices : [];
  const chosen = prices.find((p) => p.order_type === 'NEXTDAY') || prices[0] || null;
  if (!chosen) throw new Error('Urbaner: sin cobertura para ese destino');
  return {
    price: chosen.price,
    currency: 'PEN',
    order_type: chosen.order_type,
    distance_m: out.distance,
    duration_s: out.duration,
    provider: 'urbaner',
  };
}

// ─── Handler ────────────────────────────────────────────
module.exports = async (req, res) => {
  const send = (code, payload) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
  };

  try {
    const q = req.query || (() => {
      const u = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      return Object.fromEntries(u.searchParams.entries());
    })();
    const lat = q.lat, lng = q.lng;
    if (!lat || !lng) return send(400, { error: 'Faltan lat / lng en la query string.' });

    // 1. Intento Cabify.
    try {
      const r = await quoteCabify(lat, lng);
      return send(200, r);
    } catch (cabifyErr) {
      console.warn('[quote] Cabify falló, fallback a Urbaner:', cabifyErr.message);

      // 2. Fallback a Urbaner.
      try {
        const r = await quoteUrbaner(lat, lng);
        return send(200, r);
      } catch (urbanerErr) {
        console.error('[quote] Ambos couriers fallaron. Cabify:', cabifyErr.message, '| Urbaner:', urbanerErr.message);
        return send(502, { error: 'No pudimos cotizar el envío. Te contactamos por WhatsApp.' });
      }
    }
  } catch (e) {
    return send(500, { error: e.message });
  }
};
