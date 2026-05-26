// Prueba de cotización con Urbaner (POST /cli/price/).
// Uso:  node integrations/urbaner/quote.js
// Requiere: integrations/urbaner/.env con URBANER_EMAIL y URBANER_PASSWORD
'use strict';

require('./load-env')();
const { ENV, price } = require('./client');

// Defaults: atelier Lima Flores (Calle Francia 823, Miraflores) → cliente en San Isidro
// Sobreescribibles vía .env:
//   URBANER_PICKUP_LATLON, URBANER_DROPOFF_LATLON, URBANER_VEHICLE_ID
const pickup   = process.env.URBANER_PICKUP_LATLON   || '-12.122272,-77.035838'; // Calle Francia (centroide), Miraflores
const dropoff  = process.env.URBANER_DROPOFF_LATLON  || '-12.097200,-77.036300'; // San Isidro ref.
const vehicle  = Number(process.env.URBANER_VEHICLE_ID || 1); // 1=auto, 2=moto, 3=camioneta (confirmado empíricamente)

(async () => {
  console.log(`\nUrbaner · entorno: ${ENV}`);
  console.log(`Origen:  ${pickup}`);
  console.log(`Destino: ${dropoff}`);
  console.log(`Vehículo: ${vehicle}\n`);
  console.log('Consultando /cli/price/ …\n');
  const out = await price({
    destinations: [{ latlon: pickup }, { latlon: dropoff }],
    vehicleTypeId: vehicle,
    isReturn: false,
  });
  console.log(JSON.stringify(out, null, 2));
  console.log('');
})().catch((e) => {
  console.error('\nERROR:', e.message, '\n');
  process.exit(1);
});
