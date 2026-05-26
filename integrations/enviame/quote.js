// Prueba de cotización con Envíame v2 (/api/s2/v2/rates).
// Uso:  node integrations/enviame/quote.js
// Requiere: integrations/enviame/.env  con ENVIAME_API_KEY y los parámetros de prueba.
'use strict';

require('./load-env')();
const { ENV, rates } = require('./client');

// Los nombres exactos de los parámetros para Perú dependen de la cuenta.
// Defínelos en .env como ENVIAME_RATES_PARAMS (JSON) — ejemplo:
//   ENVIAME_RATES_PARAMS={"origin_place":"PE-LIMA-MIRAFLORES","destination_place":"PE-LIMA-SAN-ISIDRO","weight":3}
const params = JSON.parse(process.env.ENVIAME_RATES_PARAMS || '{}');

(async () => {
  console.log(`\nEnvíame · entorno: ${ENV}`);
  console.log('Parámetros enviados a /rates:');
  console.log(JSON.stringify(params, null, 2));
  console.log('\nConsultando…\n');
  const out = await rates(params);
  console.log(JSON.stringify(out, null, 2));
  console.log('');
})().catch((e) => {
  console.error('\nERROR:', e.message, '\n');
  process.exit(1);
});
