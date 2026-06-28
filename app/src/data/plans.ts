// Planes de suscripción — compartidos entre /suscripcion y el teaser del home.
// Precio único: S/130 al mes. Dos formas de pago (se eligen en /suscripcion):
//   A — mensual automático (S/130/mes)   ·   B — total del periodo por adelantado.
// keyA/keyB mapean al catálogo del backend (integrations/culqi/plans-catalog.js).
export const MONTHLY_PRICE = 130;

export type Plan = {
  tier: 'mensual' | 'trimestral' | 'semestral' | 'anual' | 'prueba';
  name: string;
  months: number;
  deliveries: number;
  monthly: number;     // S/130
  keyA: string;        // plan_key modelo A (mensual)
  keyB: string;        // plan_key modelo B (adelantado)
  // Compat con el teaser del home:
  period: string;
  price: number;       // = monthly
  note: string;
  tagline: string;
  features: string[];
  featured?: boolean;
  value?: boolean;
};

export const plans: Plan[] = [
  {
    tier: 'mensual', name: 'Mensual', months: 1, deliveries: 2, monthly: MONTHLY_PRICE,
    keyA: 'mensual', keyB: 'mensual',
    period: '1 mes · 2 entregas', price: MONTHLY_PRICE, note: 'S/130 al mes · sin permanencia',
    tagline: 'Para probar, sin compromiso.',
    features: ['2 entregas al mes · flores de estación', 'Ramo armado a mano, siempre distinto', 'Entrega a domicilio en Lima', 'Pausa o cancela cuando quieras'],
  },
  {
    tier: 'trimestral', name: 'Trimestral', months: 3, deliveries: 6, monthly: MONTHLY_PRICE,
    keyA: 'a_trimestral', keyB: 'b_trimestral',
    period: '3 meses · 6 entregas', price: MONTHLY_PRICE, note: 'S/130 al mes · 3 meses',
    tagline: 'Tres meses de flores frescas.',
    features: ['Todo lo del plan Mensual', '6 entregas · flores de estación', 'Tarjeta escrita a mano en cada envío'],
  },
  {
    tier: 'semestral', name: 'Semestral', months: 6, deliveries: 12, monthly: MONTHLY_PRICE,
    keyA: 'a_semestral', keyB: 'b_semestral',
    period: '6 meses · 12 entregas', price: MONTHLY_PRICE, note: 'S/130 al mes · 6 meses', featured: true,
    tagline: 'Seis meses, el ritmo ideal.',
    features: ['Todo lo del plan Trimestral', '12 entregas · flores de estación', 'Florero de cerámica de regalo', 'Cambia tu día de entrega cuando quieras'],
  },
  {
    tier: 'anual', name: 'Anual', months: 12, deliveries: 24, monthly: MONTHLY_PRICE,
    keyA: 'a_anual', keyB: 'b_anual',
    period: '12 meses · 24 entregas', price: MONTHLY_PRICE, note: 'S/130 al mes · 12 meses', value: true,
    tagline: 'Un año entero de estación.',
    features: ['Todo lo del plan Semestral', '24 entregas · flores de estación', 'Prioridad en San Valentín y Día de la Madre'],
  },
  // ⚠️ TEMPORAL — plan de PRUEBA de pago. Aparece en AMBOS toggles: "Mes a mes"
  // (recurrente S/3/mes, keyA=a_prueba) y "Pago único" (S/2, keyB=b_prueba). Culqi
  // no permite suscripciones < S/3, por eso el recurrente es S/3 y el único S/2.
  // `monthly` = monto recurrente (modelo A); `price` = monto pago único (modelo B).
  // Borrar tras verificar Culqi (junto con a_prueba/b_prueba en plans-catalog.js).
  {
    tier: 'prueba', name: 'Prueba', months: 1, deliveries: 1, monthly: 3,
    keyA: 'a_prueba', keyB: 'b_prueba',
    period: 'Prueba de pago · 1 entrega', price: 2, note: 'Cargo de prueba',
    tagline: 'Plan de prueba del pago.',
    features: ['Mes a mes: S/3/mes (recurrente)', 'Pago único: S/2 (un solo cargo)', 'Solo para verificar el pago — se elimina luego'],
  },
];
