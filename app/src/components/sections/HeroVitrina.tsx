import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CONTACTO } from '@/lib/tienda';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * La vitrina — el hero del sistema Florencia.
 *
 * Reemplaza al hero anterior, que era un video de banco de imágenes a pantalla
 * completa: una mujer rubia con tulipanes, sin relación con el catálogo ni con
 * el taller. Era exactamente el «genérico sin personalidad» del diagnóstico.
 *
 * Acá manda una foto real del catálogo, sangrando por la derecha, con el
 * titular apoyado en el blanco de la izquierda. La proporción es la del sistema
 * (1.05fr / 1fr) y la foto entra contenida sobre su propio fondo medido, así que
 * el ramo se ve entero y no aparece ningún filete alrededor.
 */
const DATOS = [
  { valor: 'Desde 2017', nota: 'Atelier en Miraflores' },
  { valor: 'Lunes, miércoles y viernes', nota: 'Llegada de flor fresca' },
  { valor: 'Lima Metropolitana', nota: 'Entrega a domicilio' },
];

export const HeroVitrina = () => (
  <section className="relative overflow-hidden bg-background">
    <div className="mx-auto grid max-w-[1400px] items-center gap-10 px-6 pb-16 pt-14 md:grid-cols-[1.05fr_1fr] md:gap-4 md:px-0 md:pb-24 md:pt-20 md:pl-12 lg:pl-20">
      <motion.div
        initial={{ opacity: 0, y: 26 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease }}
        className="relative z-10 md:pr-10"
      >
        <span className="rotulo">Flores y diseño · Lima</span>

        <h1 className="display mt-6 text-[3.1rem] leading-[1.02] text-ink-900 sm:text-[3.8rem] lg:text-[4.9rem]">
          No vendemos flores.<br />
          Vendemos <em>pequeños<br className="hidden sm:block" /> momentos de calma.</em>
        </h1>

        <p className="mt-8 max-w-md text-[17px] leading-relaxed text-ink-700">
          Cada arreglo se arma a mano en el atelier, con la flor que llegó esa
          semana. Eliges el día y una franja de treinta minutos, y lo llevamos
          a la puerta.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3.5">
          <Link
            to="/catalogo"
            className="press inline-flex items-center gap-3 rounded-pill bg-rosa-500 px-8 py-4 text-[13px] font-medium uppercase tracking-[0.18em] text-white transition-colors hover:bg-rosa-600"
          >
            Ver el catálogo <span aria-hidden="true">→</span>
          </Link>
          <a
            href={CONTACTO.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex items-center rounded-pill border border-border px-7 py-4 text-[13px] font-medium uppercase tracking-[0.18em] text-ink-900 transition-colors hover:border-ink-900/40"
          >
            Escribir por WhatsApp
          </a>
        </div>

        <dl className="mt-12 grid gap-x-8 gap-y-5 border-t border-border pt-8 sm:grid-cols-3">
          {DATOS.map((d) => (
            <div key={d.valor}>
              <dt className="font-display text-[19px] font-medium italic leading-snug text-ink-900">{d.valor}</dt>
              <dd className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">{d.nota}</dd>
            </div>
          ))}
        </dl>
      </motion.div>

      {/* La foto sangra por la derecha: es la vitrina, y una vitrina no tiene
          borde del lado de la calle. */}
      <motion.div
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease }}
        className="relative -mx-6 md:mx-0 md:h-[min(76vh,760px)]"
      >
        <img
          src="/products/tulipanes-de-amor.jpg"
          alt="Tulipanes de colores envueltos a mano, en florero de vidrio"
          className="h-full w-full rounded-none object-cover object-center md:rounded-l-lg"
        />
      </motion.div>
    </div>
  </section>
);
