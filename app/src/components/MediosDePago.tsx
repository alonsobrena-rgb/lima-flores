import { PAGOS } from '@/lib/tienda';

/**
 * Los medios de pago aceptados. Dos presentaciones del mismo dato:
 *
 * - `linea` para el pie y el checkout, donde ya se decidió comprar y solo hace
 *   falta confirmar que el método propio entra.
 * - `bloque` para la ficha de producto, donde todavía se está decidiendo y el
 *   dato es un argumento de venta.
 *
 * Sin logotipos de marcas: no tenemos los archivos y ponerlos redibujados a
 * mano es peor que no ponerlos.
 */
export const MediosDePago = ({ variante = 'bloque' }: { variante?: 'bloque' | 'linea' }) => {
  if (variante === 'linea') {
    return (
      // Sin color propio: en el pie va sobre tinta y en el checkout sobre
      // blanco, así que el color lo pone quien lo usa.
      <p className="text-[13px] leading-relaxed">
        <span className="font-medium">Aceptamos </span>
        {PAGOS.map((p) => p.label).join(' · ')}.
      </p>
    );
  }

  return (
    <section aria-label="Medios de pago" className="rounded-md border border-border bg-secondary/60 p-5">
      <h3 className="rotulo">Medios de pago</h3>
      <ul className="mt-3.5 grid gap-2.5 sm:grid-cols-2">
        {PAGOS.map((p) => (
          <li key={p.label} className="flex items-baseline gap-2.5 text-[14px] leading-snug">
            <span aria-hidden="true" className="mt-[7px] h-[5px] w-[5px] shrink-0 rounded-pill bg-rosa-500" />
            <span>
              <span className="text-foreground/85">{p.label}</span>
              <span className="block text-[12px] text-foreground/45">{p.nota}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
};
