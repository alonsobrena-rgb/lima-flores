// Teaser de suscripción en el home → /suscripcion (datos compartidos).
import { Link } from 'react-router-dom';
import { money } from '@/lib/cart';
import { plans } from '@/data/plans';
import { Reveal } from '@/components/motion/Reveal';
import { Seccion, Encabezado, enlaceTexto } from './Seccion';

/**
 * Era una tarjeta con borde, una etiqueta rosa colgando de la esquina («Más
 * popular») y el precio adentro — y una sola tarjeta en una grilla, así que la
 * caja no separaba nada de nada: encerraba un plan solo. Ahora el plan se
 * presenta como lo que es: un precio grande, lo que incluye en una lista de
 * filetes, y un enlace. Sin caja, sin borde y sin etiqueta.
 */
const PLAN = plans.find((p) => p.tier === 'mensual');

export const SubscriptionTeaser = () => {
  if (!PLAN) return null;
  return (
    <Seccion>
      <Encabezado
        rotulo="Suscripción"
        titulo={<>Flores frescas en casa,<br />todo el <em>mes.</em></>}
        enlace={{ texto: 'Ver cómo funciona', a: '/suscripcion' }}
        className="mb-16"
      />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,42ch)_minmax(0,1fr)] lg:gap-24">
        <Reveal>
          <p className="text-[17px] leading-relaxed text-ink-700">
            Elige tu plan y recibe flores de estación{' '}
            <strong className="font-medium text-ink-900">dos veces al mes</strong> —
            seleccionadas y armadas a mano, siempre distintas. Pausa o cancela cuando
            quieras.
          </p>
          <p className="mt-8 text-[13px] text-ink-500">
            Todas las suscripciones incluyen entrega a domicilio en Lima Metropolitana.
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <Link to="/suscripcion" className="group block border-t border-border pt-8">
            <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
              <h3 className="display text-[clamp(2.6rem,4.4vw,3.6rem)] leading-none text-ink-900">
                {money(PLAN.price)}
                <span className="ml-3 align-middle font-sans text-[13px] font-normal not-italic tracking-[0.02em] text-ink-500">
                  al mes
                </span>
              </h3>
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">
                {PLAN.period}
              </span>
            </div>

            <ul className="mt-8 grid gap-0 sm:grid-cols-2">
              {PLAN.features.map((f) => (
                <li
                  key={f}
                  className="border-t border-border py-3.5 text-[15px] leading-snug text-ink-700"
                >
                  {f}
                </li>
              ))}
            </ul>

            <span className={`${enlaceTexto} mt-8`}>
              Suscribirme <span aria-hidden="true">→</span>
            </span>
          </Link>
        </Reveal>
      </div>
    </Seccion>
  );
};
