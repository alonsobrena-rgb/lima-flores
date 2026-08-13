import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CONTACTO } from '@/lib/tienda';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * El herbario — la mecánica de la referencia «Leandra Isler», vestida con
 * Florencia.
 *
 * El movimiento que define al hero es uno solo: **la planta pasa por delante
 * del titular**. El texto no se corre para dejarle sitio, se deja tapar. Por eso
 * la foto va en `z-20` sobre el titular en `z-10`, y el titular está centrado y
 * dimensionado para que la línea de abajo quede cruzada por las varas — si la
 * planta no muerde el texto, el efecto no existe.
 *
 * De Florencia sale todo lo demás, sin inventar un solo token: blanco total,
 * Cormorant Garamond en itálica peso 500 con el `<em>` en rosa del ramo, Jost
 * para el resto, filetes en #E6E5E3 y el pie de datos con el patrón de la
 * portada.
 *
 * El pie va **debajo** del cartel, en su propia banda con filete: metido dentro
 * quedaba tapado por las hojas, y un enlace que la foto esconde no es un enlace.
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

const enlace =
  'link-underline press inline-block border-b border-ivory-400 pb-1.5 text-[15px] ' +
  'font-medium tracking-[0.02em] text-ink-900';

export const HeroHerbario = () => (
  <>
    <section className="relative isolate overflow-hidden bg-background">
      {/* Lo que queda del lavado de la referencia: un velo de pesca en el borde
          de arriba, apagándose antes de la mitad. Nada de manchas de acuarela
          detrás de todo — eso ya se sacó del sitio una vez. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[clamp(220px,38vh,480px)] bg-[linear-gradient(184deg,#FBF0DE_0%,#FDF7EC_26%,#FFFFFF00_72%)]"
      />

      <div className="relative z-10 flex min-h-[78vh] flex-col px-6 pt-10 sm:px-8 lg:min-h-[min(92vh,900px)] lg:px-12 lg:pt-12">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease }}
          className="rotulo"
        >
          Orquídeas Phalaenopsis
        </motion.p>

        {/* Sin ancho máximo y sin caja: el titular sangra de borde a borde y se
            deja cruzar por las varas. */}
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease }}
          className="display mb-[12vh] mt-auto text-center text-[clamp(2.9rem,9vw,150px)] leading-[0.94] text-ink-900 lg:mb-[13vh]"
        >
          Orquídeas
          <br />
          <em>Phalaenopsis</em>
          <br />
          en maceta
        </motion.h1>
      </div>

      {/* El espécimen, por delante del texto. Sin marco, sin sombra y sin
          recuadro: apoyado sobre el papel, saliéndose por abajo y mordiendo el
          titular. */}
      <motion.div
        initial={{ opacity: 0, scale: 1.015 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center"
      >
        <img
          src="/hero/orquideas-herbario.webp"
          alt="Cuatro orquídeas Phalaenopsis en maceta: amarilla, fucsia, crema con líneas y rosada"
          className="w-[190%] max-w-none translate-y-[10%] select-none sm:w-[128%] lg:w-[80%] lg:translate-y-[7%] xl:w-[74%]"
          width={1314}
          height={857}
          fetchPriority="high"
        />
      </motion.div>
    </section>

    {/* El pie del cartel: la letra chica, los enlaces y los tres datos. Va en su
        propia banda con filete arriba, no encima de la foto. */}
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease }}
      className="relative z-30 border-t border-border bg-background px-6 py-8 sm:px-8 lg:px-12"
    >
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-16">
        <div className="grid gap-8 sm:grid-cols-[minmax(0,26rem)_auto] sm:items-start sm:gap-12">
          <p className="max-w-[52ch] text-[16px] leading-relaxed text-ink-700">
            En maceta decorativa, con tarjeta de dedicatoria e instrucciones de
            mantenimiento. Eliges el día y una franja de treinta minutos, con
            veinticuatro horas de anticipación.
          </p>
          <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
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
        </div>

        <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-3 lg:justify-items-end lg:text-right">
          {DATOS.map((d) => (
            <div key={d.valor}>
              <dt className="display text-[19px] leading-snug text-ink-900">{d.valor}</dt>
              <dd className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">
                {d.nota}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.div>
  </>
);
