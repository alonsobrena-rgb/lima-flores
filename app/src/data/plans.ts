// Planes de suscripción — compartidos entre /suscripcion y el teaser del home.
export type Plan = {
  name: string;
  period: string;
  price: number;
  note: string;
  tagline: string;
  features: string[];
  featured?: boolean;
  value?: boolean;
};

export const plans: Plan[] = [
  { name: 'Mensual', period: '1 mes · 2 entregas', price: 190, note: '≈ S/ 190 al mes', tagline: 'Para probar, sin compromiso.', features: ['2 entregas al mes · flores de estación', 'Ramo armado a mano, siempre distinto', 'Entrega a domicilio en Lima', 'Pausa o cancela cuando quieras'] },
  { name: 'Trimestral', period: '3 meses · 6 entregas', price: 540, note: '≈ S/ 180 al mes · ahorra 5%', tagline: 'Tres meses de flores frescas.', features: ['Todo lo del plan Mensual', '6 entregas · flores de estación', 'Tarjeta escrita a mano en cada envío'] },
  { name: 'Semestral', period: '6 meses · 12 entregas', price: 1020, note: '≈ S/ 170 al mes · ahorra 11%', tagline: 'Seis meses, el ritmo ideal.', featured: true, features: ['Todo lo del plan Trimestral', '12 entregas · flores de estación', 'Florero de cerámica de regalo', 'Cambia tu día de entrega cuando quieras'] },
  { name: 'Anual', period: '12 meses · 24 entregas', price: 1920, note: '≈ S/ 160 al mes · ahorra 16%', tagline: 'Un año entero de estación.', value: true, features: ['Todo lo del plan Semestral', '24 entregas · flores de estación', 'Prioridad en San Valentín y Día de la Madre'] },
];
