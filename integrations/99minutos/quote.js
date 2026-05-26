// Prueba de cotización con 99minutos (POST /api/v3/shipping/rates).
// Uso:  node integrations/99minutos/quote.js
// Requiere: integrations/99minutos/.env con CLIENT_ID + CLIENT_SECRET
'use strict';

require('./load-env')();
const { ENV, BASE, ratesByCoords } = require('./client');

// Defaults: atelier Lima Flores (Miraflores) → cliente en San Isidro, 3 kg, 30×30×40 cm
const params = {
  origin:      { country: 'PE', lat: -12.122550, lng: -77.029700 }, // Miraflores
  destination: { country: 'PE', lat: -12.097200, lng: -77.036300 }, // San Isidro
  weight: Number(process.env.NINETYNINE_WEIGHT_G  || 3000), // gramos
  height: Number(process.env.NINETYNINE_HEIGHT_CM || 30),
  width:  Number(process.env.NINETYNINE_WIDTH_CM  || 30),
  length: Number(process.env.NINETYNINE_LENGTH_CM || 40),
};

(async () => {
  console.log(`\n99minutos · entorno: ${ENV}`);
  console.log(`Base: ${BASE}`);
  console.log('Parámetros:');
  console.log(JSON.stringify(params, null, 2));
  console.log('\nConsultando /api/v3/shipping/rates/coordinates/… …\n');
  const out = await ratesByCoords(params);
  console.log(JSON.stringify(out, null, 2));
  console.log('');
})().catch((e) => {
  console.error('\nERROR:', e.message, '\n');
  process.exit(1);
});
