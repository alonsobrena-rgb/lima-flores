// /api/quote — endpoint serverless que cotiza envío con Urbaner.
// Portable: corre en Vercel (Node serverless) y en Node http nativo (Railway).
//
// Llamada: GET /api/quote?lat=-12.0972&lng=-77.0363
// Respuesta: { price, currency, distance_m, duration_s, order_type }
//
// Credenciales: URBANER_EMAIL / URBANER_PASSWORD inyectadas por el host
// (Vercel Project Settings → Environment Variables, o Railway → Variables).
// Nunca llegan al navegador.
'use strict';

const { price } = require('../integrations/urbaner/client');

// Atelier Lima Flores · Calle Francia 823, Miraflores
// Centroide de Calle Francia (Nominatim). Precisión ~50-100 m de la altura 823 real.
// Para mayor precisión, setea URBANER_PICKUP_LATLON en Railway con el pin exacto
// de Google Maps (right-click sobre el local → copiar coords).
const ATELIER_LATLON = process.env.URBANER_PICKUP_LATLON || '-12.122272,-77.035838';

module.exports = async (req, res) => {
  // Helper portable (Vercel res.status() no existe en http nativo).
  const send = (code, payload) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min
    res.end(typeof payload === 'string' ? payload : JSON.stringify(payload));
  };

  try {
    // req.query lo prepara el host (Vercel o nuestro server.js); fallback por si no.
    const q = req.query || (() => {
      const u = new URL(req.url, `http://${req.headers?.host || 'localhost'}`);
      return Object.fromEntries(u.searchParams.entries());
    })();

    const lat = q.lat, lng = q.lng;
    if (!lat || !lng) return send(400, { error: 'Faltan lat / lng en la query string.' });

    const dropoff = `${lat},${lng}`;
    // vehicle_type_id en Urbaner (confirmado empíricamente):
    //   1 = AUTO  — solo NEXTDAY (programado), precio ~2x moto. Encaja con
    //               nuestro modelo de +24h de antelación. Default correcto
    //               para flores: no caben en mochila de moto sin dañarse.
    //   2 = MOTO  — EXPRESS + NEXTDAY, precio bajo. Solo conviene para
    //               envíos pequeños/planos (sobres, ramos diminutos).
    //   3 = CAMIONETA — precio ~igual a auto, para cargas voluminosas.
    // Sobrescribir con URBANER_VEHICLE_ID en Railway si necesitas otro.
    const out = await price({
      destinations: [{ latlon: ATELIER_LATLON }, { latlon: dropoff }],
      vehicleTypeId: Number(process.env.URBANER_VEHICLE_ID || 1),
      isReturn: false,
    });

    // Preferimos NEXTDAY (encaja con el flujo de +24 h del checkout).
    // Si Urbaner no ofrece NEXTDAY para ese destino, caemos a EXPRESS.
    const prices = Array.isArray(out?.prices) ? out.prices : [];
    const chosen = prices.find((p) => p.order_type === 'NEXTDAY') || prices[0] || null;

    if (!chosen) return send(404, { error: 'Sin cobertura Urbaner para ese destino.' });

    return send(200, {
      price: chosen.price,
      currency: 'PEN',
      order_type: chosen.order_type,
      distance_m: out.distance,
      duration_s: out.duration,
    });
  } catch (e) {
    return send(500, { error: e.message });
  }
};
