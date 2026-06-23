// Aprovisiona los planes de suscripción en Culqi (una sola vez).
// Crea cada plan del catálogo (POST https://api.culqi.com/v2/plans) con la LLAVE
// SECRETA y guarda el mapeo { plan_key: pln_id } en integrations/culqi/plans.json.
// Es idempotente: salta los keys que ya estén en plans.json.
//
//   CULQI_SECRET_KEY=sk_live_xxx node integrations/culqi/create-plans.js
//   node integrations/culqi/create-plans.js --dry-run   # imprime los bodies, no llama a Culqi
//
// La llave NUNCA se commitea: pásala por env (o integrations/culqi/.env local).
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { PLANS, planBody } = require('./plans-catalog');

// Carga opcional de integrations/culqi/.env (solo para provisionar en local).
(function loadEnv() {
  const file = path.join(__dirname, '.env');
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const k = line.slice(0, eq).trim();
    let v = line.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const DRY = process.argv.includes('--dry-run');
const SECRET = process.env.CULQI_SECRET_KEY || '';
const PLANS_FILE = path.join(__dirname, 'plans.json');

function culqiPost(pathname, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const req = https.request({
      hostname: 'api.culqi.com', path: pathname, method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Accept': 'application/json',
      },
    }, (r) => {
      let d = ''; r.on('data', (c) => (d += c));
      r.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; } resolve({ status: r.statusCode, json: j }); });
    });
    req.on('error', reject);
    req.write(body); req.end();
  });
}

function readMap() {
  try { return JSON.parse(fs.readFileSync(PLANS_FILE, 'utf8')); } catch { return {}; }
}
function writeMap(map) {
  fs.writeFileSync(PLANS_FILE, JSON.stringify(map, null, 2) + '\n');
}

(async () => {
  console.log(`Catálogo: ${PLANS.length} planes${DRY ? '  (DRY-RUN)' : ''}\n`);

  if (DRY) {
    for (const entry of PLANS) {
      console.log(`▸ ${entry.key}  ·  modelo ${entry.models.join('/')}  ·  S/ ${entry.amountSoles}  ·  cada ${entry.intervalCount} mes(es)`);
      console.log(JSON.stringify(planBody(entry), null, 2));
      console.log('');
    }
    console.log('DRY-RUN: no se llamó a Culqi. Quita --dry-run (con CULQI_SECRET_KEY) para crear los planes.');
    return;
  }

  if (!SECRET) { console.error('Falta CULQI_SECRET_KEY (env o integrations/culqi/.env).'); process.exit(1); }

  const map = readMap();
  for (const entry of PLANS) {
    if (map[entry.key]) { console.log(`= ${entry.key} ya existe (${map[entry.key]}) — salto.`); continue; }
    process.stdout.write(`▸ creando ${entry.key} … `);
    const { status, json } = await culqiPost('/v2/plans', planBody(entry));
    const id = json && (json.id || json.plan_id);
    if ((status === 200 || status === 201) && id) {
      map[entry.key] = id;
      writeMap(map); // persistimos tras cada uno para no perder progreso
      console.log(`OK ${id}`);
    } else {
      console.error(`FALLÓ (HTTP ${status}): ${JSON.stringify(json).slice(0, 300)}`);
      console.error('Revisa el body (interval_unit_time / currency) y reintenta; los ya creados quedaron en plans.json.');
      process.exit(1);
    }
  }
  console.log(`\n✓ Planes listos → ${PLANS_FILE}`);
})().catch((e) => { console.error('ERROR:', e && e.message ? e.message : e); process.exit(1); });
