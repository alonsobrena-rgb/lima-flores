// scripts/seed-products.js — siembra la tabla products desde db/products.seed.json.
// Idempotente: solo inserta si la tabla está vacía (ON CONFLICT DO NOTHING).
// Uso:  node scripts/seed-products.js
// Requiere DATABASE_URL (local apuntando a la Postgres de Railway, o en Railway).
'use strict';

// Carga .env si existe (mismo loader minimal que usa el server).
try { require('../integrations/urbaner/load-env')(); } catch { /* opcional */ }

const db = require('../db');
const store = require('../db/products-store');

(async () => {
  if (!db.enabled) {
    console.error('✗ DATABASE_URL no configurado. Exporta la connection string de Railway y reintenta.');
    process.exit(1);
  }
  try {
    await db.migrate();
    const before = (await db.query('SELECT COUNT(*)::int AS n FROM products')).rows[0].n;
    await store.ensureSeeded();
    const after = (await db.query('SELECT COUNT(*)::int AS n FROM products')).rows[0].n;
    console.log(`✓ products: ${before} → ${after} filas (${after - before} insertadas).`);
    process.exit(0);
  } catch (e) {
    console.error('✗ Error sembrando productos:', e.message);
    process.exit(1);
  }
})();
