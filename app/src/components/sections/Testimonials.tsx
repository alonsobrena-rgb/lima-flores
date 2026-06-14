// "Tres cartas que guardamos" — reseñas (portado de site/index.html).
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';

const voices = [
  {
    quote: 'El ramo llegó armado como si fuera para una portada de revista. Mi mamá lloró cuando lo vio. No se les escapa un solo detalle.',
    name: 'Camila R.',
    line: 'Surco · Día de la madre 2025',
  },
  {
    quote: 'Pedí a las 11 am, llegaron a las 5:30 pm con el arreglo perfecto. Las orquídeas siguen vivas dos meses después. Recomiendo cerrando los ojos.',
    name: 'Diego V.',
    line: 'San Isidro · Cumpleaños',
  },
  {
    quote: 'Llevo cinco años pidiéndoles para clientes y para mi casa. Es el único florista en Lima que entiende que las flores son un gesto, no un producto.',
    name: 'Lucía P.',
    line: 'Miraflores · Cliente desde 2019',
  },
];

export const Testimonials = () => (
  <section className="bg-transparent px-6 py-24 md:px-12 md:py-32">
    <div className="mx-auto max-w-7xl">
      <header className="mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Reveal>
          <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45">— No. 06 · Lo que dicen</span>
          <h2 className="mt-3 font-display text-[2.5rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[3.75rem]">
            Tres cartas<br />que <em className="italic text-rosa-500">guardamos.</em>
          </h2>
        </Reveal>
        <span className="text-[12px] uppercase tracking-[0.14em] text-foreground/45">— Reseñas verificadas, 2025</span>
      </header>

      <Stagger className="grid gap-6 md:grid-cols-3">
        {voices.map((v) => (
          <StaggerItem key={v.name}>
            <article className="flex h-full flex-col border border-border bg-surface p-8">
              <span className="text-sm tracking-[0.3em] text-rosa-500">★ ★ ★ ★ ★</span>
              <p className="mt-5 flex-1 font-display text-xl font-light italic leading-relaxed text-ink-900">
                “{v.quote}”
              </p>
              <footer className="mt-7 border-t border-border pt-4">
                <p className="text-sm font-medium text-ink-900">{v.name}</p>
                <p className="mt-0.5 text-[12px] uppercase tracking-[0.12em] text-foreground/50">{v.line}</p>
              </footer>
            </article>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  </section>
);
