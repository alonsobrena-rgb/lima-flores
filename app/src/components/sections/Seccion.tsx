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
 * Encabezado con el producto calado por delante del título.
 *
 * La misma mecánica de la portada, aplicada a las páginas interiores: **el
 * producto pasa por delante del texto**, sin fondo y sin recuadro, apoyado sobre
 * el blanco. Antes acá había una foto rectangular en su columna, al lado del
 * título; lo que se pidió es lo otro — que la flor y las letras se mezclen, como
 * en la referencia.
 *
 * Tres cosas la sostienen:
 *
 * - **El calado, no la foto.** Los archivos de `calados/` son la misma foto de
 *   catálogo con el fondo del estudio quitado (`design/calar.py`). Sobre blanco
 *   no hay borde ni sombra que delate el recorte, y el titular se puede leer por
 *   los huecos del ramo.
 * - **El texto se deja tapar, pero no borrar.** El titular sangra hasta el borde
 *   y el calado le muerde el final; lo que no puede pasar es que una línea entera
 *   quede debajo del bulto, así que en escritorio el texto vive en el 60 % de la
 *   izquierda y el calado ocupa el resto.
 * - **En móvil el calado va abajo a la derecha**, con su hueco reservado
 *   (`pb`) para que no se le eche encima a los datos: ahí solo cruza el titular.
 *
 * En escritorio el calado **cuelga del borde de arriba** y se mide en alto, no en
 * ancho: anclado abajo se salía por la cabecera del sitio y la corona aparecía
 * descabezada. `medida` y `hueco` son las dos perillas —cada producto tiene su
 * silueta, una corona sobre trípode es alta y fina y un ramo es ancho y bajo— y
 * si las cambias, mira las dos pantallas antes de darlas por buenas.
 */
export const EncabezadoCalado = ({
  rotulo,
  titulo,
  foto,
  alt,
  medida = 'w-[62vw] max-w-[300px] lg:h-[56vh] lg:max-h-[560px] lg:w-auto lg:max-w-none',
  hueco = 'pb-[38vh]',
  children,
}: {
  rotulo: string;
  titulo: ReactNode;
  foto: string;
  alt: string;
  medida?: string;
  hueco?: string;
  children?: ReactNode;
}) => (
  <div className="relative isolate">
    {/* El hueco de abajo es el sitio del calado en móvil. */}
    <div className={`relative lg:pb-0 ${hueco}`}>
      {/* El titular llega hasta el 80 %: lo justo para que el calado le muerda el
          final. Los datos de abajo se quedan en el 62 %, que ahí no puede tapar. */}
      <Reveal className="relative z-10 lg:max-w-[80%]">
        <p className="rotulo">{rotulo}</p>
        <h1 className="display mt-4 text-[clamp(2.7rem,6.4vw,5.4rem)] leading-[0.95] text-ink-900">
          {titulo}
        </h1>
      </Reveal>

      {/* Por delante del titular, pegado al borde derecho del papel. */}
      <Reveal
        delay={0.1}
        className="pointer-events-none absolute bottom-0 right-0 z-20 -mr-6 sm:-mr-8 lg:bottom-auto lg:top-0 lg:-mr-12"
      >
        <img src={foto} alt={alt} loading="eager" className={`select-none ${medida}`} />
      </Reveal>
    </div>

    {children && (
      <Reveal delay={0.08} className="relative z-10 lg:max-w-[62%]">
        <div className="mt-8 border-t border-border pt-7 lg:mt-10">{children}</div>
      </Reveal>
    )}
  </div>
);
