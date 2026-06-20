// "Cuatro maneras de regalar belleza" — categorías → /catalogo?cat=slug.
import { Link } from 'react-router-dom';
import categories from '@/data/categories.json';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';

const cover: Record<string, string> = {
  plantas: '/products/orquideas-grandes-de-dos-varas-en-maceta.jpg',
  arreglos: '/products/box-de-luxe.jpg',
  floreros: '/products/florero-de-20-tulipanes-2.jpg',
  ramos: '/products/ramo-de-24-rosas.jpg',
  funebre: '/products/funebre-corona-eternidad.jpg',
};

export const Categories = () => (
  <section className="relative bg-transparent px-6 py-24 md:px-12 md:py-32">
    <div className="mx-auto max-w-7xl">
      <header className="mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <Reveal>
          <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45">— No. 03 · Categorías</span>
          <h2 className="mt-3 font-display text-[2.5rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[3.75rem]">
            Cinco maneras<br />de regalar <em className="italic text-rosa-500">belleza.</em>
          </h2>
        </Reveal>
        <Link to="/catalogo" className="group inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.18em] text-ink-900">
          Ver todo el catálogo <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </header>

      <Stagger className="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-6 lg:grid-cols-5">
        {categories.map((c) => (
          <StaggerItem key={c.slug}>
            <Link to={`/catalogo?cat=${c.slug}`} className="group block">
              <div className="relative overflow-hidden bg-ivory-200">
                <img src={cover[c.slug]} alt={c.label} className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink-900/55 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <h3 className="font-display text-2xl font-medium italic text-ivory-50">{c.label}</h3>
                  <p className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ivory-100/75">{c.count} diseños →</p>
                </div>
              </div>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </div>
  </section>
);
