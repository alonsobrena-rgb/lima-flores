// Datos de la tienda que se repiten en varias pantallas. Viven acá y no
// copiados en cada componente: la letra chica de un producto tiene que decir lo
// mismo en la ficha, en el checkout y en el pie, o deja de ser letra chica y
// pasa a ser una contradicción.

/** Redes sociales de la marca. */
export const REDES = [
  { label: 'Instagram', usuario: '@lima_flores', href: 'https://instagram.com/lima_flores' },
  { label: 'Facebook', usuario: 'Lima Flores Perú', href: 'https://facebook.com/limafloresperu' },
] as const;

export const CONTACTO = {
  whatsapp: { label: 'WhatsApp · 999 479 855', href: 'https://wa.me/51999479855' },
  correo: { label: 'ventas@limaflores.pe', href: 'mailto:ventas@limaflores.pe' },
  lugar: 'Atelier en Miraflores · Lima',
} as const;

/**
 * Medios de pago aceptados. El orden es el de uso real en Lima: primero las
 * tarjetas, después la transferencia, y las billeteras al final porque son las
 * que más se buscan por nombre.
 */
export const PAGOS = [
  { label: 'Tarjeta de crédito', nota: 'Visa · Mastercard · Amex' },
  { label: 'Tarjeta de débito', nota: 'Visa · Mastercard' },
  { label: 'Transferencia bancaria inmediata', nota: 'Acreditación en el momento' },
  { label: 'Yape y Plin', nota: 'Billeteras digitales' },
] as const;

/**
 * La letra chica que acompaña a todo producto. Va en la ficha y en el checkout.
 * No es relleno legal: una flor no es una pieza de fábrica y conviene decirlo
 * antes de la compra, no después.
 */
export const AVISOS_PRODUCTO = [
  'Las fotos son referenciales. Las variedades o colores pueden variar ligeramente según disponibilidad.',
  'Cada flor es una especie única en la naturaleza.',
] as const;

/** Lo que sí está garantizado, y que sale de checkout.js y de la landing. */
export const PROMESAS = [
  'Entrega a domicilio en Lima Metropolitana.',
  'Eliges el día y una franja de 30 minutos, con 24 horas de anticipación.',
  'Armado a mano con flores frescas de la semana.',
  'Incluye tarjeta de dedicatoria sin costo.',
] as const;
