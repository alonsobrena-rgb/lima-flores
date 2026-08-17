import { useRef, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion/Reveal';
import { money, useProducts } from '@/lib/cart';
import { barajar } from '@/lib/azar';
import { Seccion, Encabezado } from './Seccion';

const CUANTOS = 8;

/**
 * La tira de productos — lo primero que se ve después del cartel.
 *
 * Es un estante: cada ficha ocupa casi la pantalla, se pasan de lado y el borde
 * de la siguiente asoma para que se note que hay más. Va con producto al azar y
 * no con una selección fija porque la portada tiene que cambiar sola: quien
 * vuelve a los dos días ve otras flores.
 *
 * Los productos salen barajados de `lib/azar.ts`, que es el mismo barajado que
 * usa la grilla de abajo: la tira se lleva los primeros ocho y la grilla los
 * siguientes, así ninguno sale dos veces en la misma pantalla.
 *
 * Detalles que la hacen funcionar y no son adorno:
 *
 * - **Sangra por los dos lados** (`-mx` que anulan el margen de la sección) con
 *   un relleno del mismo tamaño: la primera ficha arranca alineada con el
 *   titular y la última llega hasta el filo del papel.
 * - **Imán de scroll** (`snap-x`) en el borde izquierdo de cada ficha: se suelta
 *   el dedo y la ficha queda encuadrada, no a medias. El `scroll-pl` va junto al
 *   `px` — sin él el imán encuadra contra el borde del contenedor, se come el
 *   relleno y la primera ficha queda pegada al filo de la pantalla.
 * - **La barra se esconde** (`.tira-lateral`); el gesto, la rueda y el teclado
 *   siguen funcionando.
 * - **Las flechas solo de lg para arriba**, que es donde no hay dedo, y se apagan
 *   solas al llegar a cada punta.
 */
const Flecha = ({ hacia, onClick, activa }: { hacia: 'izq' | 'der'; onClick: () => void; activa: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!activa}
    aria-label={hacia === 'izq' ? 'Ver los productos anteriores' : 'Ver los siguientes productos'}
    className="press flex h-11 w-11 items-center justify-center rounded-pill border border-ivory-400 text-ink-900 transition-colors hover:border-ink-900 disabled:pointer-events-none disabled:opacity-25"
  >
    <span aria-hidden="true" className="text-[17px] leading-none">{hacia === 'izq' ? '←' : '→'}</span>
  </button>
);

export const ProductStrip = () => {
  const { products } = useProducts();
  const lista = useMemo(
    () => barajar(products.filter((p) => p.active !== false && p.image)).slice(0, CUANTOS),
    [products],
  );

  const tira = useRef<HTMLDivElement>(null);
  const [puede, setPuede] = useState({ izq: false, der: true });

  // Se mira en cada scroll y en cada cambio de ancho: con las flechas siempre
  // encendidas, una de las dos no hace nada y el usuario no sabe cuál.
  useEffect(() => {
    const el = tira.current;
    if (!el) return;
    const mirar = () => setPuede({
      izq: el.scrollLeft > 8,
      der: el.scrollLeft + el.clientWidth < el.scrollWidth - 8,
    });
    mirar();
    el.addEventListener('scroll', mirar, { passive: true });
    window.addEventListener('resize', mirar);
    return () => {
      el.removeEventListener('scroll', mirar);
      window.removeEventListener('resize', mirar);
    };
  }, [lista.length]);

  // Se avanza una ficha, no una pantalla: el ancho de la primera es la medida.
  const empujar = (signo: 1 | -1) => {
    const el = tira.current;
    if (!el) return;
    const paso = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth * 0.8;
    el.scrollBy({ left: signo * (paso + 24), behavior: 'smooth' });
  };

  if (!lista.length) return null;

  return (
    <Seccion>
      <Encabezado
        /* El rótulo dice la verdad de lo que es: una selección al azar del
           catálogo. «Recién armados» o «lo que sale hoy del taller» sonaba mejor
           y afirmaba algo que nadie puede sostener — estos ocho no se armaron
           hoy, salieron de un barajado. */
        rotulo="Al azar"
        titulo={<>Una vuelta <em>por el catálogo.</em></>}
        enlace={{ texto: 'Ver todo el catálogo', a: '/catalogo' }}
        className="mb-9"
      />

      <div className="mb-6 hidden justify-end gap-3 lg:flex">
        <Flecha hacia="izq" onClick={() => empujar(-1)} activa={puede.izq} />
        <Flecha hacia="der" onClick={() => empujar(1)} activa={puede.der} />
      </div>

      <Reveal>
        <div
          ref={tira}
          className="tira-lateral -mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth scroll-pl-6 px-6 pb-2 sm:-mx-8 sm:scroll-pl-8 sm:px-8 lg:-mx-12 lg:gap-8 lg:scroll-pl-12 lg:px-12"
        >
          {lista.map((p) => (
            <Link
              key={p.id}
              to={`/producto/${p.id}`}
              className="group w-[76vw] shrink-0 snap-start sm:w-[52vw] lg:w-[34vw] xl:w-[28vw]"
            >
              <div className="overflow-hidden bg-secondary">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
              <div className="mt-4 border-t border-border pt-3.5">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">
                    {p.categoryLabel}
                  </p>
                  <span className="shrink-0 text-[13px] font-medium tabular-nums text-ink-700">
                    {money(p.price)}
                  </span>
                </div>
                <h3 className="display mt-1.5 text-[clamp(24px,3.4vw,34px)] leading-snug text-ink-900">
                  {p.name}
                </h3>
              </div>
            </Link>
          ))}
        </div>
      </Reveal>
    </Seccion>
  );
};
