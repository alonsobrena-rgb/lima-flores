// Borra planes de Culqi por plan_key y los quita de plans.json.
//   node integrations/culqi/delete-plan.js <key> [key...]
'use strict';
const fs = require('fs');
const path = require('path');
const https = require('https');

(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const raw of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const l = raw.trim(); if (!l || l.startsWith('#')) continue;
    const i = l.indexOf('='); if (i < 0) continue;
    const k = l.slice(0, i).trim(); const v = l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '');
    if (!(k in process.env)) process.env[k] = v;
  }
})();

const SECRET = process.env.CULQI_SECRET_KEY || '';
const FILE = path.join(__dirname, 'plans.json');

function del(p) {
  return new Promise((resolve, reject) => {
    const r = https.request({ hostname: 'api.culqi.com', path: p, method: 'DELETE',
      headers: { Authorization: `Bearer ${SECRET}`, Accept: 'application/json' } },
      (rr) => { let d = ''; rr.on('data', (c) => (d += c)); rr.on('end', () => { let j; try { j = JSON.parse(d); } catch { j = d; } resolve({ status: rr.statusCode, json: j }); }); });
    r.on('error', reject); r.end();
  });
}

(async () => {
  const keys = process.argv.slice(2);
  if (!keys.length) { console.error('Uso: node delete-plan.js <key> [key...]'); process.exit(1); }
  if (!SECRET) { console.error('Falta CULQI_SECRET_KEY en integrations/culqi/.env'); process.exit(1); }
  let map = {}; try { map = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  for (const k of keys) {
    const id = map[k];
    if (!id) { console.log(`= ${k} no está en plans.json — salto`); continue; }
    process.stdout.write(`▸ borrando ${k} (${id}) … `);
    const { status, json } = await del(`/v2/recurrent/plans/${id}`);
    if (status >= 200 && status < 300) { delete map[k]; fs.writeFileSync(FILE, JSON.stringify(map, null, 2) + '\n'); console.log('OK'); }
    else { console.error(`FALLÓ (HTTP ${status}): ${JSON.stringify(json).slice(0, 200)}`); }
  }
  console.log('Listo. plans.json actualizado.');
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
