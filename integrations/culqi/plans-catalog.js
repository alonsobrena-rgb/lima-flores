// Catálogo de planes de suscripción de Lima Flores para Culqi (recurrencia).
// Fuente única de verdad: define los planes A y B. El script create-plans.js los
// crea en Culqi (POST /v2/plans) y guarda los pln_ resultantes en plans.json.
// El endpoint /api/culqi/subscribe resuelve el pln_ SIEMPRE en el servidor desde
// el plan_key (nunca se confía en el cliente), igual que el cobro recalcula montos.
//
// Dos modelos (ambos disponibles para el suscriptor):
//   A — Cobro MENSUAL automático. Todos cobran cada mes; trimestral/semestral/
//       anual = precio mensual menor (el "compromiso" lo maneja nuestra política
//       de cancelación, Culqi cobra mes a mes indefinidamente).
//   B — Cobro del TOTAL del periodo cada N meses (intervalo mensual × N).
//
// "mensual" es idéntico en A y B (S/190 cada mes) → un solo plan compartido.
'use strict';

// Culqi: interval_unit_time es el código del periodo del cobro. El ejemplo oficial
// usa interval_unit_time:1 con interval_count:1 para un cobro periódico. Modelamos
// TODO con unidad mensual y variamos interval_count (1 / 3 / 6 / 12), así solo
// dependemos de un código. ⚠️ Confirmar el entero "mes" contra apidocs.culqi.com
// al primer aprovisionamiento (un solo lugar que cambiar si fuera otro valor).
const INTERVAL_MONTH = 1;
const CURRENCY = 'PEN';

// soles → céntimos (Culqi cobra en céntimos, igual que /v2/charges).
const cents = (soles) => Math.round(Number(soles) * 100);

// Cada entrada: key estable, modelo, tier, precio (soles) del cobro y cada cuántos
// meses se cobra (interval_count). `monthlyHint` es solo informativo para la UI.
const PLANS = [
  // Compartido por A y B (mensual es mensual en ambos).
  { key: 'mensual',     models: ['A', 'B'], tier: 'mensual',    label: 'Mensual',    amountSoles: 190,  intervalCount: 1,  monthlyHint: 190 },

  // Modelo A — cobro mensual al precio mensual con descuento del tier.
  { key: 'a_trimestral', models: ['A'], tier: 'trimestral', label: 'Trimestral',  amountSoles: 180,  intervalCount: 1,  monthlyHint: 180 },
  { key: 'a_semestral',  models: ['A'], tier: 'semestral',  label: 'Semestral',   amountSoles: 170,  intervalCount: 1,  monthlyHint: 170 },
  { key: 'a_anual',      models: ['A'], tier: 'anual',      label: 'Anual',       amountSoles: 160,  intervalCount: 1,  monthlyHint: 160 },

  // Modelo B — cobro del total del periodo cada N meses.
  { key: 'b_trimestral', models: ['B'], tier: 'trimestral', label: 'Trimestral',  amountSoles: 540,  intervalCount: 3,  monthlyHint: 180 },
  { key: 'b_semestral',  models: ['B'], tier: 'semestral',  label: 'Semestral',   amountSoles: 1020, intervalCount: 6,  monthlyHint: 170 },
  { key: 'b_anual',      models: ['B'], tier: 'anual',      label: 'Anual',       amountSoles: 1920, intervalCount: 12, monthlyHint: 160 },
];

const byKey = (key) => PLANS.find((p) => p.key === key) || null;

// Construye el body para POST /v2/plans a partir de una entrada del catálogo.
function planBody(entry) {
  const intervalLabel = entry.intervalCount === 1
    ? 'mensual'
    : `cada ${entry.intervalCount} meses`;
  return {
    name: `Lima Flores — ${entry.label} (${entry.models.join('/')})`,
    short_name: `lf-${entry.key}`.replace(/_/g, '-'),
    description: `Suscripción de flores Lima Flores · ${entry.label} · cobro ${intervalLabel}.`,
    amount: cents(entry.amountSoles),
    currency: CURRENCY, // el ejemplo de planes de Culqi usa "currency" (no "currency_code")
    interval_unit_time: INTERVAL_MONTH,
    interval_count: entry.intervalCount,
    initial_cycles: { count: 0, has_initial_charge: false, amount: 0, interval_unit_time: INTERVAL_MONTH },
    metadata: { plan_key: entry.key, model: entry.models.join('/'), tier: entry.tier },
  };
}

module.exports = { PLANS, byKey, planBody, cents, INTERVAL_MONTH, CURRENCY };
