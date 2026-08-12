import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CONTACTO } from '@/lib/tienda';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * El herbario — la estructura de la referencia «Leandra Isler», vestida con
 * Florencia.
 *
 * De la referencia se toma la mecánica, que es lo que la hace funcionar: el
 * lienzo de borde a borde sin columna centrada, la escala como única jerarquía
 * (de 12 px de rótulo a ~168 px de titular), la planta apoyada sobre el papel
 * sin marco ni sombra, el filete de 1 px como único elemento estructural y los
 * enlaces subrayados en vez de píldoras rellenas.
 *
 * De Florencia sale todo lo demás, y sin inventar un solo token:
 *
 * - **Blanco total.** El vellum de la referencia era su marca, no la nuestra.
 *   Del lavado cálido queda un velo de `pesca-100` en el borde de arriba —el
 *   color de fondo más cálido que tiene el sistema— apagado antes de la mitad
 *   del hero. Si molesta, se borra el div y el hero queda en blanco puro.
 * - **Cormorant Garamond en itálica peso 500** para el display (clase
 *   `.display`), con el `<em>` en rosa del ramo, que es como el sistema marca
 *   la palabra que manda. Jost para todo lo demás.
 * - **Filetes en `border`** (#E6E5E3), no en tinta: en la referencia el filete
 *   es casi negro porque el papel es oscuro; sobre blanco eso es un tajo.
 * - La fila de datos usa el patrón de la portada —valor en itálica, nota en
 *   versalita espaciada— para que el hero se lea como parte de la tienda.
 *
 * La foto es la del catálogo (`orquideas-grandes-en-maceta-2`), recortada desde
 * el calado de `bloom/` —la misma toma, a 2,6× de resolución— y con el
 * cartelito de la vara borrado, que en el calado había quedado como un fantasma
 * translúcido.
 */

/** Todo sale del catálogo, del checkout o de `tienda.ts`. Nada inventado. */
const DATOS = [
  { valor: 'Desde S/ 200', nota: 'Orquídeas en maceta' },
  { valor: 'Al día siguiente', nota: '24 h de anticipación' },
  { valor: 'Lima Metropolitana', nota: 'Entrega a domicilio' },
];

/**
 * Enlace subrayado: el único elemento interactivo de la referencia, en la
 * versión del sistema. El filete queda siempre puesto y `.link-underline` pasa
 * el rosa por encima al pasar el mouse.
 */
const enlace =
  'link-underline press inline-block border-b border-ivory-400 pb-1.5 text-[15px] ' +
  'font-medium tracking-[0.02em] text-ink-900';

export const HeroHerbario = () => (
  <section className="relative isolate overflow-hidden bg-background">
    {/* Lo que queda del lavado de la referencia: un velo de pesca en el borde
        de arriba, apagándose antes de la mitad. Nada de manchas de acuarela
        detrás de todo — eso ya se sacó del sitio una vez. */}
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[clamp(220px,38vh,480px)] bg-[linear-gradient(184deg,#FBF0DE_0%,#FDF7EC_26%,#FFFFFF00_72%)]"
    />

    <div className="relative z-10 flex min-h-[84vh] flex-col px-6 pb-10 pt-10 sm:px-8 lg:min-h-[min(92vh,920px)] lg:px-12 lg:pb-10 lg:pt-12">
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.7, ease }}
        className="rotulo"
      >
        Orquídeas Phalaenopsis
      </motion.p>

      {/* Sin max-width y sin columna centrada: el titular sangra de borde a
          borde, que es la firma de la referencia. La caja de Cormorant es más
          angosta que la de una grotesca, así que aguanta un par de vw más antes
          de llegar a la foto. */}
      <motion.h1
        initial={{ opacity: 0, y: 22 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease }}
        className="display mt-7 text-[clamp(3.1rem,9.7vw,158px)] leading-[0.92] text-ink-900 lg:mt-8"
      >
        Orquídeas
        <br />
        <em>Phalaenopsis</em>
        <br />
        en maceta
      </motion.h1>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, delay: 0.12, ease }}
        className="mt-auto pt-12 lg:pt-10 lg:w-[42%]"
      >
        <p className="max-w-[65ch] text-[17px] leading-relaxed text-ink-700">
          En maceta decorativa, con tarjeta de dedicatoria e instrucciones de
          mantenimiento. Eliges el día y una franja de treinta minutos, con
          veinticuatro horas de anticipación.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-x-10 gap-y-4">
          <Link to="/catalogo?cat=orquideas" className={enlace}>
            Ver las orquídeas <span aria-hidden="true">→</span>
          </Link>
          <a
            href={CONTACTO.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className={enlace}
          >
            Escribir por WhatsApp <span aria-hidden="true">→</span>
          </a>
        </div>
      </motion.div>

      {/* El espécimen. Sin marco, sin sombra y sin recuadro: apoyado sobre el
          papel y saliéndose por abajo. De lg para arriba se ancla abajo a la
          derecha y el texto le deja la mitad libre. En móvil entra en el flujo
          —sangrando de borde a borde— entre los enlaces y el filete: si iba al
          final, la foto quedaba a pantalla y media de scroll. */}
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
        className="mt-10 grid gap-x-6 gap-y-5 border-t border-border pt-8 sm:grid-cols-3 lg:mt-10 lg:w-[42%] lg:pt-7"
      >
        {DATOS.map((d) => (
          <div key={d.valor}>
            <dt className="display text-[19px] leading-snug text-ink-900">{d.valor}</dt>
            <dd className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
              {d.nota}
            </dd>
          </div>
        ))}
      </motion.dl>
    </div>
  </section>
);
