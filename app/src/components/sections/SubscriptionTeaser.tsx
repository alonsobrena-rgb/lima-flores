// Teaser de suscripción en el home → /suscripcion (datos compartidos).
import { Link } from 'react-router-dom';
import { money } from '@/lib/cart';
import { plans } from '@/data/plans';
import { Reveal, Stagger, StaggerItem, ParallaxBloom } from '@/components/motion/Reveal';

export const SubscriptionTeaser = () => (
  <section className="relative overflow-hidden bg-transparent px-6 py-24 md:px-12 md:py-32">
    <ParallaxBloom src="/bloom/bloom-florero-de-20-tulipanes.png" side="right" drift={60} />
    <div className="mx-auto max-w-7xl">
      <header className="mb-14 max-w-2xl">
        <Reveal>
          <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45">— No. 07 · Suscripción</span>
          <h2 className="mt-3 font-display text-[2.5rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[3.75rem]">
            Flores frescas en casa,<br />todo el <em className="italic text-rosa-500">mes.</em>
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-5 leading-relaxed text-ink-700">
            Elige tu plan y recibe flores de estación <strong>dos veces al mes</strong> — seleccionadas y armadas a mano,
            siempre distintas. Pausa o cancela cuando quieras.
          </p>
        </Reveal>
      </header>

      <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {plans.map((p) => (
          <StaggerItem key={p.name} className="h-full">
            <Link to="/suscripcion" className={`group relative flex h-full flex-col border bg-surface p-6 transition-colors hover:border-rosa-500 ${p.featured ? 'border-rosa-500' : 'border-border'}`}>
              {(p.featured || p.value) && (
                <span className="absolute -top-3 right-5 bg-rosa-500 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ivory-50">
                  {p.featured ? 'Más popular' : 'Mejor valor'}
                </span>
              )}
              <h3 className="font-display text-xl font-medium text-ink-900">{p.name}</h3>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.16em] text-foreground/45">{p.period}</p>
              <p className="mt-4 font-display text-3xl text-ink-900">{money(p.price)}</p>
              <p className="mt-1 flex-1 text-[12px] text-foreground/55">{p.note}</p>
              <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] font-medium uppercase tracking-[0.14em] text-rosa-500">
                Ver plan <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>

      <Reveal delay={0.1}>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <span className="text-[12px] uppercase tracking-[0.14em] text-foreground/45">Todas las suscripciones incluyen entrega a domicilio en Lima Metropolitana.</span>
          <Link to="/suscripcion" className="group inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-ink-900">
            Ver cómo funciona <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </div>
      </Reveal>
    </div>
  </section>
);
