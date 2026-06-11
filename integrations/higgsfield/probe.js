// Descubre el endpoint de estado del job set probando candidatos.
'use strict';
require('./load-env')();
const https = require('https');
const KEY = process.env.HF_API_KEY, SECRET = process.env.HF_API_SECRET;
const id = process.argv[2];
if (!id) { console.error('Uso: node probe.js <jobSetId>'); process.exit(1); }

const candidates = [
  `/v1/image2video/dop/${id}`,
  `/v1/job-sets/${id}`,
  `/v1/job_sets/${id}`,
  `/v1/jobs/${id}`,
  `/v1/requests/${id}`,
  `/requests/${id}/status`,
  `/requests/${id}`,
  `/v1/generations/${id}`,
];

function get(pathname) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'platform.higgsfield.ai', path: pathname, method: 'GET',
      headers: { 'Authorization': `Key ${KEY}:${SECRET}`, 'Accept': 'application/json' },
    }, (r) => {
      let data = ''; r.on('data', (c) => data += c);
      r.on('end', () => resolve({ pathname, code: r.statusCode, body: data.slice(0, 300) }));
    });
    req.on('error', (e) => resolve({ pathname, code: 'ERR', body: e.message }));
    req.end();
  });
}

(async () => {
  for (const c of candidates) {
    const r = await get(c);
    console.log(`[${r.code}] ${r.pathname}\n   ${r.body.replace(/\s+/g, ' ')}\n`);
  }
})();
