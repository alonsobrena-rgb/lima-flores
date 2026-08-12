import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CONTACTO } from '@/lib/tienda';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * El herbario — hero alternativo, sobre la referencia «Leandra Isler».
 *
 * Es otra dirección, no el sistema Florencia: acá el lienzo es vellum (#f4e6cd)
 * de borde a borde con el lavado vertical cálido, la tipografía hace todo el
 * trabajo estructural (de 14 px a ~158 px en una sola familia) y no hay ni una
 * caja: los enlaces son un subrayado de 1 px, nunca una píldora rellena.
 *
 * Tres decisiones que conviene tener a la vista:
 *
 * 1. Los tokens de la referencia viven en el `style` de la sección, no en
 *    florencia.css ni en Tailwind. Si esta dirección no se aprueba, se borra el
 *    archivo y no queda un solo color suelto en el sistema.
 * 2. La referencia pide PP Neue Montreal. No está licenciada acá, así que va
 *    Jost —la sans que el sitio ya carga— antes que sumar una tercera familia
 *    por una prueba. Lo que define la referencia es la escala, no la letra.
 * 3. La foto es la del catálogo (`orquideas-grandes-en-maceta-2`), recortada
 *    contra el vellum desde el calado de `bloom/` —que es la misma toma, a 2,6×
 *    de resolución— y con el cartelito de la vara borrado, que en el calado
 *    original había quedado como un fantasma translúcido.
 */
const VELLUM = {
  '--vellum': '#f4e6cd',
  '--tinta': '#1e211e',
  '--bronce': '#8f774b',
  '--heno': '#ba9d6a',
  '--trigo': '#d6bd97',
} as CSSProperties;

/** Todo sale del catálogo, del checkout o de `tienda.ts`. Nada inventado. */
const DATOS = [
  { valor: 'Desde S/ 200', nota: 'Orquídeas en maceta' },
  { valor: 'Al día siguiente', nota: '24 h de anticipación' },
  { valor: 'Lima Metropolitana', nota: 'Entrega a domicilio' },
];

/** Enlace subrayado: el único elemento interactivo de la referencia. */
const enlace =
  'inline-block text-[16px] leading-none text-[var(--tinta)] underline decoration-[1.5px] ' +
  'underline-offset-[6px] transition-[text-decoration-thickness] hover:decoration-[2.5px]';

export const HeroHerbario = () => (
  <section
    style={VELLUM}
    className="relative isolate overflow-hidden bg-[var(--vellum)] font-sans"
  >
    {/* El lavado de vellum: la única profundidad del sistema. 184deg, cuatro
        paradas. Va en una banda de alto fijo y no al 100% de la sección: en
        móvil la sección es mucho más alta y un degradado en porcentajes teñía
        media pantalla de bronce. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[clamp(240px,40vh,520px)] bg-[linear-gradient(184deg,#8f774b_0%,#ba9d6a_12%,#d6bd97_34%,#d6bd9700_68%)] opacity-[0.7]"
    />

    <div className="relative z-10 flex min-h-[84vh] flex-col px-6 pb-10 pt-10 sm:px-8 lg:min-h-[min(92vh,920px)] lg:px-12 lg:pb-10 lg:pt-12">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease }}
        className="text-[14px] uppercase tracking-[0.14em] text-[var(--tinta)]"
      >
        Orquídeas Phalaenopsis
      </motion.p>

      {/* Sin max-width y sin columna centrada: el titular sangra de borde a
          borde, que es la firma de la referencia. */}
      <motion.h1
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease }}
        className="mt-7 text-[clamp(3rem,9.2vw,158px)] font-medium leading-[0.9] tracking-[-0.045em] text-black lg:mt-8"
      >
        Orquídeas
        <br />
        Phalaenopsis
        <br />
        en maceta
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.12, ease }}
        className="mt-auto pt-12 lg:pt-10 lg:w-[42%]"
      >
        <p className="max-w-[65ch] text-[18px] leading-[1.5] text-[var(--tinta)]">
          En maceta decorativa, con tarjeta de dedicatoria e instrucciones de
          mantenimiento. Eliges el día y una franja de treinta minutos, con
          veinticuatro horas de anticipación.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-x-10 gap-y-4">
          <Link to="/catalogo?cat=orquideas" className={enlace}>
            Ver las orquídeas <span aria-hidden="true">↗</span>
          </Link>
          <a
            href={CONTACTO.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className={enlace}
          >
            Escribir por WhatsApp <span aria-hidden="true">↗</span>
          </a>
        </div>

      </motion.div>

      {/* El espécimen. Sin marco, sin sombra y sin recuadro: apoyado sobre el
          vellum y saliéndose por abajo, como una planta prensada sobre el papel.
          De lg para arriba se ancla abajo a la derecha y el texto le deja la
          mitad libre. En móvil entra en el flujo —sangrando de borde a borde—
          entre los enlaces y el filete: si iba al final, la foto quedaba a
          pantalla y media de scroll y el hero era puro texto. */}
      <motion.div
        initial={{ opacity: 0, scale: 1.015 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease }}
        className="relative z-0 -mx-6 mt-12 sm:-mx-8 lg:absolute lg:bottom-0 lg:right-0 lg:mx-0 lg:mt-0 lg:w-[54%]"
      >
        <img
          src="/hero/orquideas-herbario.webp"
          alt="Cuatro orquídeas Phalaenopsis en maceta: amarilla, fucsia, crema con líneas y rosada"
          className="block w-full translate-y-[3%] select-none"
          width={1314}
          height={857}
          fetchPriority="high"
        />
      </motion.div>

      {/* El único elemento estructural: un filete de 1 px. Nada de tarjetas. */}
      <motion.dl
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.2, ease }}
        className="mt-10 grid gap-x-6 gap-y-6 border-t border-[var(--tinta)] pt-8 sm:grid-cols-3 lg:mt-10 lg:w-[42%] lg:pt-7"
      >
        {DATOS.map((d) => (
          <div key={d.valor}>
            <dt className="text-[14px] font-medium leading-[1.4] text-[var(--tinta)]">{d.valor}</dt>
            <dd className="mt-1 text-[14px] leading-[1.5] text-[#1e211e]/65">{d.nota}</dd>
          </div>
        ))}
      </motion.dl>
    </div>
  </section>
);
