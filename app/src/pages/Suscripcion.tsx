import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { money } from '@/lib/cart';
import { plans } from '@/data/plans';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';
import { FloatingFlowers } from '@/components/motion/FloatingFlowers';

const CheckIcon = () => (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-rosa-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
);

export default function Suscripcion() {
  return (
    <div className="relative min-h-screen">
      {/* Fondo: carretilla de flores en Milán (Higgsfield) con velo ivory para legibilidad.
          Velo más fuerte arriba (donde va el texto del header) y más translúcido en el
          centro/abajo para que la carretilla se lea en toda la página. */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <img src="/bg/suscripcion-milan.webp" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ivory-100/88 via-ivory-100/68 to-ivory-100/80" />
        <div className="absolute inset-0 backdrop-blur-[1.5px]" />
      </div>

      {/* Flores flotantes (recortes transparentes) sobre el fondo, detrás del contenido */}
      <FloatingFlowers />

      <div className="relative z-10">
      <SiteHeader />
      <header className="mx-auto max-w-7xl px-6 pb-12 pt-16 md:px-12 md:pt-20">
        {/* Plinth esmerilado: da al texto un fondo ivory propio para legibilidad
            sobre la carretilla (zona oscura), sin tapar el fondo alrededor. */}
        <div className="relative inline-block max-w-3xl rounded-[2px] border border-white/60 bg-ivory-50/[0.93] px-7 py-8 shadow-[0_28px_70px_-34px_rgba(42,38,35,0.5)] backdrop-blur-lg md:px-12 md:py-11">
          <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-ink-500">— Suscripción</span>
          <h1 className="mt-3 font-display text-[2.75rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[4rem]">
            Flores frescas en casa, <em className="italic text-rosa-500">todo el mes.</em>
          </h1>
          <p className="mt-5 max-w-xl text-ink-700">Elige tu plan y recibe flores de estación dos veces al mes — seleccionadas y armadas a mano, siempre distintas. Pausa o cancela cuando quieras.</p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pb-24 md:px-12 md:pb-32">
        <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => (
            <StaggerItem key={p.name} className="h-full">
              <div className={`group relative flex h-full flex-col p-7 transition-all duration-500 hover:-translate-y-1.5 ${
                p.featured
                  ? 'frost border border-rosa-500 shadow-[0_30px_70px_-30px_rgba(158,43,94,0.45)] md:scale-[1.03]'
                  : 'frost border border-border hover:border-rosa-300'}`}>
                {(p.featured || p.value) && (
                  <span className="absolute -top-3 right-6 bg-rosa-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-50">{p.featured ? 'Más popular' : 'Mejor valor'}</span>
                )}
                <h2 className="font-display text-2xl font-medium text-ink-900">{p.name}</h2>
                <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-foreground/45">{p.period}</p>
                <p className="mt-5 font-display text-4xl text-ink-900">{money(p.price)}</p>
                <p className="mt-1 text-[12px] text-foreground/55">{p.note}</p>
                <p className="mt-4 font-display italic text-ink-600">{p.tagline}</p>
                <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-700">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5"><CheckIcon /><span>{f}</span></li>
                  ))}
                </ul>
                <a href="https://wa.me/51999479855" target="_blank" rel="noopener noreferrer"
                   className={`press mt-7 flex items-center justify-center py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] transition-colors ${p.featured ? 'bg-rosa-500 text-ivory-50 hover:bg-rosa-600' : 'border border-ink-900/20 text-ink-900 hover:bg-ink-900 hover:text-ivory-50'}`}>
                  Suscribirme →
                </a>
              </div>
            </StaggerItem>
          ))}
        </Stagger>
        <p className="mt-10 text-center text-[12px] uppercase tracking-[0.14em] text-ivory-50 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">Todas las suscripciones incluyen entrega a domicilio dentro de Lima Metropolitana.</p>
      </section>
      <SiteFooter />
      </div>
    </div>
  );
}
