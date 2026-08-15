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
