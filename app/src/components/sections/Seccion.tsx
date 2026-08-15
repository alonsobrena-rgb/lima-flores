import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Reveal } from '@/components/motion/Reveal';

/**
 * El molde de las secciones de la portada.
 *
 * Antes cada sección se dibujaba su propio traje: una usaba `mx-auto max-w-7xl`
 * y otra `max-w-6xl`, los títulos iban en `font-display font-light` recto acá y
 * en la itálica del sistema allá, los rótulos eran gris en una sección y rosa en
 * la siguiente, y la numeración «— No. 02 · …» arrancaba en el 2, saltaba el 1 y
 * no correspondía a ninguna secuencia real. Siete secciones distintas, una
 * abajo de la otra, se leen como siete sitios.
 *
 * Acá viven las tres decisiones que las vuelven una sola página:
 *
 * - **El mismo margen que el hero.** Nada de columna centrada: todo cuelga del
 *   mismo borde izquierdo (`px-6 / sm:px-8 / lg:px-12`), así el ojo baja por una
 *   línea vertical y no por un acordeón de anchos.
 * - **El filete de 1 px separa, no una caja.** Las secciones no tienen fondo
 *   propio ni tarjeta: se separan con aire y una línea. El aire está medido:
 *   `clamp(52px, 7vh, 92px)`. Era casi el doble y la página se leía vacía —
 *   entre una sección y otra cabía una pantalla de blanco sin nada que mirar.
 * - **Un solo tamaño de título** y un solo rótulo, en la itálica y el rosa del
 *   sistema.
 */
export const Seccion = ({
  id,
  filete = true,
  className = '',
  children,
}: {
  id?: string;
  filete?: boolean;
  className?: string;
  children: ReactNode;
}) => (
  <section
    id={id}
    className={`px-6 py-[clamp(52px,7vh,92px)] sm:px-8 lg:px-12 ${
      filete ? 'border-t border-border' : ''
    } ${className}`}
  >
    {children}
  </section>
);

/** El enlace de texto del sistema: filete puesto, rosa al pasar por encima. */
export const enlaceTexto =
  'link-underline press inline-block border-b border-ivory-400 pb-1.5 text-[14px] ' +
  'font-medium tracking-[0.02em] text-ink-900';

/** El mismo enlace, para cuando la sección va sobre tinta. */
export const enlaceTextoClaro =
  'press inline-block border-b border-ivory-100/35 pb-1.5 text-[14px] font-medium ' +
  'tracking-[0.02em] text-ivory-100 transition-colors hover:border-ivory-100';

export const Encabezado = ({
  rotulo,
  titulo,
  enlace,
  claro = false,
  className = '',
}: {
  rotulo: string;
  titulo: ReactNode;
  enlace?: { texto: string; a: string };
  claro?: boolean;
  className?: string;
}) => (
  <header className={`grid gap-8 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-12 ${className}`}>
    <Reveal>
      <p className={claro ? 'rotulo text-rosa-300' : 'rotulo'}>{rotulo}</p>
      <h2
        className={`display mt-4 text-[clamp(2.3rem,5.4vw,4.6rem)] leading-[0.98] ${
          claro ? 'text-ivory-100' : 'text-ink-900'
        }`}
      >
        {titulo}
      </h2>
    </Reveal>
    {enlace && (
      <Reveal delay={0.1} className="sm:pb-2">
        <Link to={enlace.a} className={claro ? enlaceTextoClaro : enlaceTexto}>
          {enlace.texto} <span aria-hidden="true">→</span>
        </Link>
      </Reveal>
    )}
  </header>
);

/**
 * Encabezado con foto de producto entrelazada.
 *
 * El pedido: que las páginas interiores no abran con un bloque de texto solo,
 * sino con una foto **mezclada** con el título — como el hero, pero sin que el
 * texto quede detrás de la imagen.
 *
 * Cómo se resuelve el «mezclado» sin tapar nada: la foto vive en su columna a la
 * derecha, **se sale por el borde de la página** (los `-mr` que anulan el
 * `px` de la sección) y ocupa las dos filas del texto — arranca por encima de la
 * línea del rótulo (`-mt`) y termina por debajo del filete (`-mb`). El bloque de
 * texto y la imagen comparten altura y se entrelazan en el ojo, pero nunca en el
 * mismo punto: el título se lee entero, siempre.
 *
 * En móvil no hay ancho para poner la foto al lado, así que se mete **entre el
 * título y el texto** —no debajo de todo— y también sale por el borde derecho.
 * El orden queda: título, foto, datos. La foto se ve al abrir, sin scroll, y el
 * texto se lee alrededor de ella y no antes de ella.
 *
 * El sangrado va con `-mr` y no con `w-screen`: la sección no recorta, así que
 * basta con anular su propio margen para llegar al filo del papel.
 */
export const EncabezadoFoto = ({
  rotulo,
  titulo,
  foto,
  alt,
  children,
}: {
  rotulo: string;
  titulo: ReactNode;
  foto: string;
  alt: string;
  children?: ReactNode;
}) => (
  <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(0,31%)] lg:items-start lg:gap-12">
    <Reveal className="lg:col-start-1 lg:row-start-1">
      <p className="rotulo">{rotulo}</p>
      <h1 className="display mt-4 text-[clamp(2.6rem,6vw,5.2rem)] leading-[0.96] text-ink-900">
        {titulo}
      </h1>
    </Reveal>

    {/* La foto sale del papel por la derecha y ocupa las dos filas del texto:
        eso es lo que la mezcla con el título y con los datos de abajo. */}
    <Reveal
      delay={0.12}
      className="-mr-6 sm:-mr-8 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:-mr-12 lg:-mb-[9vh] lg:-mt-[7vh] lg:pl-2"
    >
      <img
        src={foto}
        alt={alt}
        loading="eager"
        className="aspect-[5/4] w-full object-cover sm:aspect-[16/9] lg:aspect-[3/4]"
      />
    </Reveal>

    {children && (
      <Reveal delay={0.08} className="lg:col-start-1 lg:row-start-2">
        <div className="border-t border-border pt-7">{children}</div>
      </Reveal>
    )}
  </div>
);
