// "N maneras de regalar belleza" — categorías (vivas, ordenables) → /catalogo?cat=slug.
import { useRef, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion/Reveal';
import { useCategories } from '@/lib/categories';
import { useProducts } from '@/lib/cart';
import { Seccion, Encabezado } from './Seccion';

// Portadas curadas por categoría; para categorías nuevas se usa la imagen del
// primer producto de esa categoría (o una por defecto).
const COVERS: Record<string, string> = {
  orquideas: '/products/orquideas-grandes-de-dos-varas-en-maceta.jpg',
  arreglos: '/products/box-de-luxe.jpg',
  floreros: '/products/florero-de-20-tulipanes-2.jpg',
  ramos: '/products/ramo-de-24-rosas.jpg',
  plantas: '/products/anturios-rojos-en-maceta.jpg',
  funebre: '/products/funebre-corona-eternidad.jpg',
};

const NUM = ['', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce'];

/**
 * Las categorías, ahora en una tira que se arrastra de lado.
 *
 * Era una grilla de ocho miniaturas: en móvil, dos columnas de fotos del tamaño
 * de un sello, y en escritorio cuatro. Ninguna de las dos daba para ver de qué
 * era cada categoría — y esta sección es la que decide a dónde entra el
 * visitante. Ahora cada tarjeta ocupa casi la pantalla y se pasan de lado, como
 * un estante: se ve una foto grande, se adivina la siguiente por el borde, y ese
 * borde es lo que invita a empujar.
 *
 * Detalles que la hacen funcionar y no son adorno:
 *
 * - **Sangra por los dos lados** (`-mx` que anulan el margen de la sección) y
 *   lleva un relleno del mismo tamaño, así la primera tarjeta arranca alineada
 *   con el titular y la última puede llegar hasta el filo del papel.
 * - **Imán de scroll** (`snap-x`) en el borde izquierdo de cada tarjeta: se
 *   suelta el dedo y la tarjeta queda encuadrada, no a medias.
 * - **La barra se esconde** (`.tira-lateral`), que en escritorio es una franja
 *   gris debajo de las fotos, pero el gesto y el teclado siguen funcionando.
 * - **Las flechas solo aparecen de lg para arriba**, que es donde no hay dedo, y
 *   se apagan solas al llegar a cada punta.
 */
const Ficha = ({ label, nota, children }: { label: string; nota: string; children: React.ReactNode }) => (
  <>
    <div className="overflow-hidden bg-secondary">{children}</div>
    <div className="mt-4 border-t border-border pt-3.5">
      <h3 className="display text-[clamp(24px,3.4vw,34px)] leading-snug text-ink-900">{label}</h3>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">{nota}</p>
    </div>
  </>
);

const Flecha = ({ hacia, onClick, activa }: { hacia: 'izq' | 'der'; onClick: () => void; activa: boolean }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!activa}
    aria-label={hacia === 'izq' ? 'Ver las categorías anteriores' : 'Ver las siguientes categorías'}
    className="press flex h-11 w-11 items-center justify-center rounded-pill border border-ivory-400 text-ink-900 transition-colors hover:border-ink-900 disabled:pointer-events-none disabled:opacity-25"
  >
    <span aria-hidden="true" className="text-[17px] leading-none">{hacia === 'izq' ? '←' : '→'}</span>
  </button>
);

export const Categories = () => {
  const { categories } = useCategories();
  const { products } = useProducts();
  const coverFor = (slug: string) => COVERS[slug] || products.find((p) => p.category === slug)?.image || COVERS.arreglos;
  const word = NUM[categories.length] || String(categories.length);

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
  }, [categories.length]);

  // Se avanza una tarjeta, no una pantalla: el ancho de la primera es la medida.
  const empujar = (signo: 1 | -1) => {
    const el = tira.current;
    if (!el) return;
    const paso = (el.firstElementChild as HTMLElement | null)?.offsetWidth ?? el.clientWidth * 0.8;
    el.scrollBy({ left: signo * (paso + 24), behavior: 'smooth' });
  };

  return (
    <Seccion>
      <Encabezado
        rotulo="Categorías"
        titulo={<>{word} maneras<br />de regalar <em>belleza.</em></>}
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
          /* `scroll-pl` va junto al `px`: sin él el imán encuadra la tarjeta
             contra el borde del contenedor y se come el relleno, así que la
             primera quedaba pegada al filo de la pantalla y desalineada del
             titular. */
          className="tira-lateral -mx-6 flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth scroll-pl-6 px-6 pb-2 sm:-mx-8 sm:scroll-pl-8 sm:px-8 lg:-mx-12 lg:gap-8 lg:scroll-pl-12 lg:px-12"
        >
          {categories.map((c) => {
            const vacia = (c.count ?? 0) === 0 && !COVERS[c.slug];
            return (
              <Link
                key={c.slug}
                to={`/catalogo?cat=${c.slug}`}
                className="group w-[76vw] shrink-0 snap-start sm:w-[52vw] lg:w-[34vw] xl:w-[28vw]"
              >
                {vacia ? (
                  /* Una categoría recién creada no tiene productos ni portada.
                     Antes caía a la foto de Arreglos, así que «Tierras y
                     sustratos» se anunciaba con una caja de rosas: la tarjeta
                     prometía algo que no existe. Mientras no haya producto, la
                     tarjeta lo dice. */
                  <Ficha label={c.label} nota="Muy pronto">
                    <div className="aspect-[4/5] w-full bg-secondary" />
                  </Ficha>
                ) : (
                  <Ficha
                    label={c.label}
                    /* El conteo solo si lo hay: sin base de datos la API devuelve
                       0 y «0 diseños» debajo de una foto llena de rosas se lee
                       como un error, no como un dato. */
                    nota={c.count ? `${c.count} ${c.count === 1 ? 'diseño' : 'diseños'}` : 'Ver categoría'}
                  >
                    <img
                      src={coverFor(c.slug)}
                      alt={c.label}
                      loading="lazy"
                      className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  </Ficha>
                )}
              </Link>
            );
          })}
        </div>
      </Reveal>
    </Seccion>
  );
};
