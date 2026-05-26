// /api/quote — endpoint serverless (Vercel) que cotiza envío con Urbaner.
// El front llama: GET /api/quote?lat=-12.0972&lng=-77.0363
// Devuelve:      { price, currency, distance_m, duration_s, order_type }
//
// Credenciales: URBANER_EMAIL / URBANER_PASSWORD configurados en Vercel
// (Project Settings → Environment Variables). Nunca se exponen al navegador.
'use strict';

const { price } = require('../integrations/urbaner/client');

// Atelier Lima Flores · Calle Francia 823, Miraflores
const ATELIER_LATLON = process.env.URBANER_PICKUP_LATLON || '-12.122550,-77.029700';

module.exports = async (req, res) => {
  // CORS por si en algún momento se llama desde otro dominio (mismo origen no lo necesita).
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 min — la tarifa cambia poco
  res.setHeader('Content-Type', 'application/json');

  try {
    const lat = req.query?.lat ?? new URL(req.url, 'http://x').searchParams.get('lat');
    const lng = req.query?.lng ?? new URL(req.url, 'http://x').searchParams.get('lng');
    if (!lat || !lng) {
      return res.status(400).end(JSON.stringify({ error: 'Faltan lat / lng en la query string.' }));
    }

    const dropoff = `${lat},${lng}`;
    const out = await price({
      destinations: [{ latlon: ATELIER_LATLON }, { latlon: dropoff }],
      vehicleTypeId: Number(process.env.URBANER_VEHICLE_ID || 2), // 2 = auto
      isReturn: false,
    });

    // Preferimos NEXTDAY (encaja con el flujo de +24 h del checkout).
    // Si Urbaner no ofrece NEXTDAY para ese destino, caemos a EXPRESS.
    const prices = Array.isArray(out?.prices) ? out.prices : [];
    const chosen = prices.find((p) => p.order_type === 'NEXTDAY') || prices[0] || null;

    if (!chosen) {
      return res.status(404).end(JSON.stringify({ error: 'Sin cobertura Urbaner para ese destino.' }));
    }

    return res.status(200).end(JSON.stringify({
      price: chosen.price,
      currency: 'PEN',
      order_type: chosen.order_type,
      distance_m: out.distance,
      duration_s: out.duration,
    }));
  } catch (e) {
    return res.status(500).end(JSON.stringify({ error: e.message }));
  }
};
