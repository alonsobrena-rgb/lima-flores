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
// Precio único: S/130 al mes para todos los planes. El modelo B cobra el total
// del periodo por adelantado (130 × meses): trimestral 390, semestral 780, anual 1560.
const MONTHLY = 130;
// Modelo A = una sola suscripción mensual (Mensual). Modelo B = pago adelantado
// del periodo (130 × meses). No hay planes A por tier (trimestral/semestral/anual).
const PLANS = [
  // Mensual: A (cobro mensual) y también la base de B con periodo 1.
  // recurring:true → /subscribe crea una suscripción recurrente en Culqi (no un cargo único).
  { key: 'mensual',     models: ['A', 'B'], tier: 'mensual',    label: 'Mensual',    amountSoles: MONTHLY,      intervalCount: 1,  monthlyHint: MONTHLY, recurring: true },

  // Modelo B — cobro del total del periodo (130 × meses) cada N meses.
  { key: 'b_trimestral', models: ['B'], tier: 'trimestral', label: 'Trimestral',  amountSoles: MONTHLY * 3,  intervalCount: 3,  monthlyHint: MONTHLY },
  { key: 'b_semestral',  models: ['B'], tier: 'semestral',  label: 'Semestral',   amountSoles: MONTHLY * 6,  intervalCount: 6,  monthlyHint: MONTHLY },
  { key: 'b_anual',      models: ['B'], tier: 'anual',      label: 'Anual',       amountSoles: MONTHLY * 12, intervalCount: 12, monthlyHint: MONTHLY },

  // ⚠️ TEMPORAL — planes de PRUEBA de pago S/2 (uno por cada modelo). Borrar tras
  // verificar Culqi. b_prueba = cargo único (full); a_prueba = suscripción mensual
  // recurrente (mes a mes) — requiere su pln_ en plans.json (provisión en Culqi).
  { key: 'b_prueba',     models: ['B'], tier: 'prueba',     label: 'Prueba',      amountSoles: 2,            intervalCount: 1,  monthlyHint: 2 },
  { key: 'a_prueba',     models: ['A'], tier: 'prueba',     label: 'Prueba',      amountSoles: 3,            intervalCount: 1,  monthlyHint: 3, recurring: true },
];

const byKey = (key) => PLANS.find((p) => p.key === key) || null;

// Construye el body para POST /v2/plans a partir de una entrada del catálogo.
function planBody(entry) {
  const intervalLabel = entry.intervalCount === 1
    ? 'mensual'
    : `cada ${entry.intervalCount} meses`;
  // Culqi rechaza caracteres especiales/no-ASCII en name/description → texto plano.
  return {
    name: `Lima Flores ${entry.label} ${entry.models.join('-')}`,
    short_name: `lf-${entry.key}`.replace(/_/g, '-'),
    description: `Suscripcion de flores de estacion Lima Flores plan ${entry.label} cobro ${intervalLabel}`,
    amount: cents(entry.amountSoles),
    currency: CURRENCY, // planes de Culqi usan "currency" (no "currency_code")
    interval_unit_time: INTERVAL_MONTH, // 1 = mensual (confirmado en SDK de Culqi)
    interval_count: entry.intervalCount,
    initial_cycles: { count: 0, has_initial_charge: false, amount: 0, interval_unit_time: INTERVAL_MONTH },
    metadata: { plan_key: entry.key, model: entry.models.join('-'), tier: entry.tier },
  };
}

module.exports = { PLANS, byKey, planBody, cents, INTERVAL_MONTH, CURRENCY };
