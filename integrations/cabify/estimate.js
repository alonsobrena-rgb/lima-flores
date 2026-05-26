// Prueba de cotización de envío con Cabify Logistics.
// Uso:  node integrations/cabify/estimate.js
// Requiere: integrations/cabify/.env  (copiar de .env.example y completar credenciales)
'use strict';

// Carga simple de .env (sin dependencias)
require('./load-env')();

const { ENV, shippingTypes, estimate } = require('./client');

// Punto de recojo: atelier Lima Flores — Calle Francia 823, Miraflores (coords aprox.)
const PICKUP = {
  latitude: Number(process.env.LF_PICKUP_LAT || -12.1219),
  longitude: Number(process.env.LF_PICKUP_LON || -77.0297),
};
// Dirección de entrega de ejemplo (cliente). Ajusta a una real para probar de verdad.
const DROPOFF = {
  latitude: Number(process.env.LF_DROPOFF_LAT || -12.1000),
  longitude: Number(process.env.LF_DROPOFF_LON || -77.0200),
};

const money = (p) => (p ? `${(Number(p.amount) / 100).toFixed(2)} ${p.currency}` : '—');

(async () => {
  console.log(`\nCabify Logistics · entorno: ${ENV}`);
  console.log(`Recojo (atelier):  ${PICKUP.latitude}, ${PICKUP.longitude}`);
  console.log(`Entrega (ejemplo): ${DROPOFF.latitude}, ${DROPOFF.longitude}\n`);

  console.log('1) Tipos de envío disponibles para el atelier…');
  const types = await shippingTypes(PICKUP.latitude, PICKUP.longitude);
  const list = Array.isArray(types) ? types : (types.shipping_types || types.data || []);
  console.log(JSON.stringify(list, null, 2));

  if (!list.length) {
    console.log('\nNo se devolvieron tipos de envío para esa ubicación.');
    return;
  }

  console.log('\n2) Cotizando cada tipo (revisa "vehículo" para ver si es auto/van):\n');
  for (const t of list) {
    try {
      const q = await estimate({
        shippingTypeId: t.id,
        pickup: PICKUP,
        dropoff: DROPOFF,
        dimensions: { height: 60, length: 40, width: 40 }, // arreglo alto → favorece auto/van
        weight: { value: 3000 }, // 3 kg
      });
      const est = (q.deliveries && q.deliveries[0] && q.deliveries[0].estimation) || {};
      console.log(
        `• ${t.name} (${t.modality}) → ${money(est.price)} · vehículo: ${est.asset_kind || '—'} · entrega aprox: ${est.eta_to_delivery || '—'}`
      );
    } catch (e) {
      console.log(`• ${t.name} (${t.modality}) → error: ${e.message}`);
    }
  }
  console.log('');
})().catch((e) => {
  console.error('\nERROR:', e.message, '\n');
  process.exit(1);
});
