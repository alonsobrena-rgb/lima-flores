import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import featured from '@/data/featured.json';
import { money } from '@/lib/cart';

const ease = [0.22, 1, 0.36, 1] as const;

export const FeaturedProducts = () => (
  <section id="catalogo" className="bg-transparent px-6 py-24 md:px-12 md:py-32">
    <div className="mx-auto max-w-7xl">
      <header className="mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6, ease }}
            className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45"
          >
            — No. 02 · El catálogo
          </motion.span>
          <motion.h2
            initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, ease }}
            className="mt-3 font-display text-[2.5rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[3.75rem]"
          >
            Hecho a mano, <em className="italic text-rosa-500">tallo por tallo.</em>
          </motion.h2>
        </div>
        <Link to="/catalogo" className="group inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.18em] text-ink-900">
          Ver todo el catálogo
          <span className="transition-transform group-hover:translate-x-1">→</span>
        </Link>
      </header>

      <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4 lg:gap-x-7">
        {featured.map((p, i) => (
          <motion.div
            key={p.id}
            // En móvil mostramos solo 8 (las demás aparecen desde md+); el resto se
            // ve en "Ver todo el catálogo".
            className={i >= 8 ? 'max-md:hidden' : undefined}
            initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease, delay: (i % 4) * 0.08 }}
          >
            <Link to={`/producto/${p.id}`} className="group block">
              <div className="relative overflow-hidden bg-ivory-200">
                <img src={p.image} alt={p.name} className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
              </div>
              <div className="mt-4 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/45">{p.category}</p>
                  <h3 className="mt-1 font-display text-xl font-medium text-ink-900">{p.name}</h3>
                </div>
                <span className="shrink-0 font-display text-lg italic text-ink-700">{money(p.price)}</span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
