// /api/diag-cabify — endpoint temporal para inspeccionar la respuesta cruda
// de Cabify. Útil al activar la cuenta para confirmar shape de los responses.
// QUITAR una vez confirmado que /api/quote funciona en vivo.
'use strict';

const { getToken, shippingTypes, estimate } = require('../integrations/cabify/client');

const ATELIER_LATLON = process.env.URBANER_PICKUP_LATLON || '-12.122272,-77.035838';
const [PLAT, PLON] = ATELIER_LATLON.split(',').map(Number);

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

  const lat = Number(q.lat || -12.097200); // San Isidro como default
  const lng = Number(q.lng || -77.036300);

  const out = {
    env: {
      CABIFY_ENV: process.env.CABIFY_ENV || '(no seteada → default sandbox)',
      has_CABIFY_CLIENT_ID: !!process.env.CABIFY_CLIENT_ID,
      has_CABIFY_CLIENT_SECRET: !!process.env.CABIFY_CLIENT_SECRET,
      client_id_prefix: (process.env.CABIFY_CLIENT_ID || '').slice(0, 8) + '…',
    },
    pickup: { lat: PLAT, lng: PLON },
    dropoff: { lat, lng },
    steps: {},
  };

  // Paso 1: token
  try {
    const t = await getToken();
    out.steps.token = { ok: true, prefix: (t || '').slice(0, 16) + '…', length: (t || '').length };
  } catch (e) {
    out.steps.token = { ok: false, error: e.message };
    return send(200, out); // si el token falla, no tiene sentido seguir
  }

  // Paso 2: shipping types en la ubicación del cliente
  try {
    const types = await shippingTypes(lat, lng);
    out.steps.shipping_types = { ok: true, raw: types };
  } catch (e) {
    out.steps.shipping_types = { ok: false, error: e.message };
  }

  // Paso 3: estimate con el primer shipping type encontrado
  try {
    const types = out.steps.shipping_types?.raw;
    const list = Array.isArray(types) ? types : (types?.shipping_types || types?.data || []);
    const chosen = list[0];
    if (!chosen) {
      out.steps.estimate = { ok: false, error: 'No hay shipping_types disponibles para elegir' };
    } else {
      const est = await estimate({
        shippingTypeId: chosen.id || chosen.shipping_type_id,
        pickup: { latitude: PLAT, longitude: PLON },
        dropoff: { latitude: lat, longitude: lng },
        dimensions: { height: 30, length: 40, width: 30 },
        weight: { value: 3000 },
      });
      out.steps.estimate = { ok: true, chosen_shipping_type: chosen, raw: est };
    }
  } catch (e) {
    out.steps.estimate = { ok: false, error: e.message };
  }

  return send(200, out);
};
