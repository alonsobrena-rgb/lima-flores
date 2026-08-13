// "La firma de la casa" — Orquídeas grandes en maceta (Phalaenopsis).
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart, money } from '@/lib/cart';
import { Reveal, ease } from '@/components/motion/Reveal';
import { enlaceTextoClaro } from './Seccion';

const ID = 'orquideas-grandes-en-maceta';

/**
 * La única sección oscura de la portada, y por eso la que más se notaba fuera
 * del sistema. Dos arreglos:
 *
 * 1. **El fondo era `#5E4A55`**, un morado agrisado que no sale del logotipo ni
 *    de `florencia.css`: un color inventado para una sola sección. Va la tinta
 *    del sistema (#2A2623), que es el mismo negro cálido del pie, así que la
 *    página cierra con el mismo tono con el que respira a la mitad.
 * 2. **La ficha decía cosas que no están en el catálogo.** «Florece entre ocho
 *    y doce semanas», «60–70 cm», «maceta de cerámica», «1 vara»: nada de eso
 *    sale de `products.seed.json`, de la landing ni del checkout. Quedan los
 *    datos que sí existen. Inventar una medida es exactamente el error que la
 *    regla de la casa prohíbe.
 */
const FICHA = [
  ['Especie', 'Phalaenopsis'],
  ['Presentación', 'En maceta decorativa'],
  ['Incluye', 'Tarjeta de dedicatoria'],
  ['Entrega', 'Al día siguiente'],
];

export const SignatureProduct = () => {
  const { add, open } = useCart();
  return (
    <section className="relative overflow-hidden bg-ink-900 px-6 py-[clamp(76px,11vh,132px)] text-ivory-100 sm:px-8 lg:px-12">
      <div className="grid items-center gap-14 lg:grid-cols-[5fr_6fr] lg:gap-20">
        <motion.div
          initial={{ opacity: 0, x: -40 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease }}
          className="relative mx-auto w-full max-w-sm lg:mx-0 lg:max-w-md"
        >
          {/* Foto sobre fondo blanco uniforme: la tarjeta de marca es blanca sobre
              blanco y no se puede recortar, así que en vez de un cutout
              transparente la mostramos como una impresión sobre la tinta. Sin
              sombra: el sistema no tiene elevación. */}
          <img
            src="/bloom/orquideas-grandes-maceta-foto.webp"
            alt="Orquídea Phalaenopsis magenta en maceta, con la tarjeta de Lima Flores"
            loading="lazy"
            className="block w-full bg-white"
          />
        </motion.div>

        <div>
          <Reveal>
            <p className="rotulo text-rosa-300">La firma de la casa</p>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="display mt-4 text-[clamp(2.3rem,5.4vw,4.6rem)] leading-[0.98] text-ivory-100">
              Orquídeas<br /><span className="text-rosa-300">en maceta.</span>
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-8 max-w-[46ch] text-[17px] leading-relaxed text-ivory-100/70">
              Phalaenopsis en maceta decorativa, con tarjeta de dedicatoria e
              instrucciones de mantenimiento. Eliges el día y una franja de treinta
              minutos, con veinticuatro horas de anticipación.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-ivory-100/20 pt-8 sm:grid-cols-4">
              {FICHA.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] font-medium uppercase tracking-[0.2em] text-ivory-100/50">{k}</dt>
                  <dd className="display mt-2 text-[19px] leading-snug text-ivory-100">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.26}>
            <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
              <span className="display text-[44px] leading-none text-ivory-100">{money(200)}</span>
              {/* El único botón relleno de la portada. Un enlace subrayado sirve
                  para «ver más»; para meter algo al carrito hace falta un botón
                  que se vea como un botón. */}
              <button
                onClick={() => { add(ID); open(); }}
                className="press rounded-pill bg-ivory-50 px-8 py-4 text-[13px] font-medium uppercase tracking-[0.18em] text-ink-900 transition-colors hover:bg-rosa-100"
              >
                Agregar al carrito
              </button>
              <Link to="/catalogo?cat=orquideas" className={enlaceTextoClaro}>
                Ver orquídeas <span aria-hidden="true">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
