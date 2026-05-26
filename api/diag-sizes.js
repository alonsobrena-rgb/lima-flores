// /api/diag-sizes — sondea Cabify con varios tamaños de paquete al mismo
// destino para encontrar el sweet spot: tamaño más chico que aún resulta
// en asset_kind='car' con el precio más bajo.
// Temporal — quitar tras tunear LF_PARCEL_*.
'use strict';

const { shippingTypes, estimate } = require('../integrations/cabify/client');

const ATELIER_LATLON = process.env.URBANER_PICKUP_LATLON || '-12.122272,-77.035838';
const [PLAT, PLON] = ATELIER_LATLON.split(',').map(Number);

const SIZES = [
  { name: 'real_flor_2kg',  h: 30, l: 35, w: 25, wg: 2000 },  // ramo real
  { name: 'med_3kg',        h: 35, l: 40, w: 30, wg: 3000 },
  { name: 'large_4kg',      h: 40, l: 45, w: 35, wg: 4000 },
  { name: 'large_5kg',      h: 45, l: 45, w: 40, wg: 5000 },
  { name: 'xl_6kg',         h: 50, l: 50, w: 45, wg: 6000 },
  { name: 'xxl_8kg',        h: 60, l: 50, w: 50, wg: 8000 },  // lo que tenemos hoy
];

module.exports = async (req, res) => {
  const send = (code, payload) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload, null, 2));
  };

  const q = req.query || (() => {
    const u = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
    return Object.fromEntries(u.searchParams.entries());
  })();
  const lat = Number(q.lat || -12.097200);
  const lng = Number(q.lng || -77.036300);

  // 1. Pick Express shipping type
  let chosen = null;
  try {
    const types = await shippingTypes(lat, lng);
    const list = types?.available_shipping_types || types?.shipping_types || types?.data || [];
    chosen = list.find(t => /express/i.test(t.name || '') && !/comida|food/i.test(t.name || '')) || list[0];
    if (!chosen) return send(500, { error: 'no shipping_types' });
  } catch (e) {
    return send(500, { error: 'shippingTypes: ' + e.message });
  }

  // 2. Test each size
  const results = [];
  for (const s of SIZES) {
    try {
      const est = await estimate({
        shippingTypeId: chosen.id,
        pickup: { lat: PLAT, lon: PLON },
        dropoff: { lat, lon: lng },
        dimensions: { height: s.h, length: s.l, width: s.w, unit: 'cm' },
        weight: { value: s.wg, unit: 'g' },
      });
      const e = est?.deliveries?.[0]?.estimation;
      results.push({
        size: s.name,
        dims: `${s.h}x${s.l}x${s.w}cm/${s.wg}g`,
        asset_kind: e?.asset_kind || '?',
        price_soles: e?.price?.amount != null ? e.price.amount / 100 : null,
      });
    } catch (err) {
      results.push({ size: s.name, error: err.message });
    }
  }

  return send(200, { destination: { lat, lng }, shipping_type: chosen.name, results });
};
