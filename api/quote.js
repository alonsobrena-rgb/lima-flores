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

  // 3. Cotiza con dimensiones "arreglo grande" — fuerza a Cabify a asignar AUTO.
  // (Confirmado empíricamente: 30x40x30/3kg → moped, 60x50x50/8kg → car.)
  // Sobrescribibles con env vars LF_PARCEL_* si necesitas ajustar el default.
  const est = await cabifyEstimate({
    shippingTypeId,
    pickup: { lat: PICKUP_LAT, lon: PICKUP_LON },
    dropoff: { lat: Number(lat), lon: Number(lng) },
    dimensions: {
      height: Number(process.env.LF_PARCEL_HEIGHT_CM || 60),
      length: Number(process.env.LF_PARCEL_LENGTH_CM || 50),
      width:  Number(process.env.LF_PARCEL_WIDTH_CM  || 50),
      unit: 'cm',
    },
    weight: {
      value: Number(process.env.LF_PARCEL_WEIGHT_G || 8000),
      unit: 'g',
    },
  });

  // 4. Parsear la respuesta. Shape real (confirmada empíricamente):
  //    { deliveries: [{ estimation: { asset_kind, price:{amount,currency}, eta_to_pickup, eta_to_delivery } }] }
  const estimation = est?.deliveries?.[0]?.estimation;
  if (!estimation) throw new Error('Cabify: respuesta sin deliveries[0].estimation');

  const amount = estimation.price?.amount;
  if (typeof amount !== 'number') throw new Error('Cabify: respuesta sin price.amount numérico');

  // Cabify devuelve el precio en céntimos para PEN.
  const priceSoles = amount / 100;
  const currency = estimation.price?.currency || 'PEN';

  // No devuelven distance/duration directos, pero sí ETAs (RFC3339).
  // Duración del trip = eta_to_delivery - eta_to_pickup (aproximación).
  let duration_s = null;
  try {
    const tPickup = new Date(estimation.eta_to_pickup).getTime();
    const tDeliver = new Date(estimation.eta_to_delivery).getTime();
    if (tPickup && tDeliver && tDeliver > tPickup) {
      duration_s = Math.round((tDeliver - tPickup) / 1000);
    }
  } catch { /* ignore */ }

  // Map asset_kind → display name español
  const assetKindLabel = {
    car: 'AUTO',
    moped: 'MOTO',
    motorcycle: 'MOTO',
    van: 'VAN',
    truck: 'CAMIÓN',
    bicycle: 'BICI',
  }[estimation.asset_kind] || (estimation.asset_kind || 'CABIFY').toUpperCase();

  return {
    price: priceSoles,
    currency,
    order_type: assetKindLabel,
    distance_m: null, // Cabify no lo expone en el estimate
    duration_s,
    provider: 'cabify',
    asset_kind: estimation.asset_kind || null,
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
