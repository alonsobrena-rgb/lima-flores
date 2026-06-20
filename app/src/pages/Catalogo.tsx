import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { AddToCart } from '@/components/AddToCart';
import categories from '@/data/categories.json';
import { money, useProducts } from '@/lib/cart';

const chips = [{ slug: 'all', label: 'Todos' }, ...categories];

// Rangos de precio (filtro). Se combinan con la categoría; ambos viven en la URL.
const PRICE_RANGES = [
  { key: 'all', label: 'Cualquier precio', test: (_n: number) => true },
  { key: 'u150', label: 'Hasta S/150', test: (n: number) => n <= 150 },
  { key: '150-250', label: 'S/150 – 250', test: (n: number) => n > 150 && n <= 250 },
  { key: '250-350', label: 'S/250 – 350', test: (n: number) => n > 250 && n <= 350 },
  { key: 'o350', label: 'Más de S/350', test: (n: number) => n > 350 },
];

export default function Catalogo() {
  const { products } = useProducts();
  // Filtros en la URL (?cat=ramos&precio=150-250) — compartible/navegable con
  // back/forward; las categorías llegan así desde la sección del home.
  const [params, setParams] = useSearchParams();
  const raw = params.get('cat') || 'all';
  const cat = chips.some((c) => c.slug === raw) ? raw : 'all';
  const rawPrice = params.get('precio') || 'all';
  const priceKey = PRICE_RANGES.some((r) => r.key === rawPrice) ? rawPrice : 'all';
  const priceRange = PRICE_RANGES.find((r) => r.key === priceKey)!;
  const setParam = (key: string, val: string) => {
    const next = new URLSearchParams(params);
    if (!val || val === 'all') next.delete(key); else next.set(key, val);
    setParams(next, { replace: true });
  };
  const setCat = (slug: string) => setParam('cat', slug);
  const setPrice = (key: string) => setParam('precio', key);
  const list = products.filter(
    (p) => (cat === 'all' || p.category === cat) && priceRange.test(Number(p.price) || 0)
  );

  return (
    <div className="relative min-h-screen">
      {/* Fondo: carretilla de flores en Milán al mediodía (Higgsfield) con velo
          ivory para legibilidad. El header lleva un plinth esmerilado; la carretilla
          + la florista se ven alrededor y en toda la página. */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <img src="/bg/catalogo-milan-mediodia.webp" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ivory-100/76 via-ivory-100/66 to-ivory-100/72" />
        <div className="absolute inset-0 backdrop-blur-[1.5px]" />
      </div>

      <div className="relative z-10">
      <SiteHeader />
      <header className="mx-auto max-w-7xl px-6 pb-10 pt-16 md:px-12 md:pt-20">
        {/* Plinth esmerilado: fondo ivory propio para que el título y los filtros
            se lean sobre la carretilla. */}
        <div className="relative inline-block max-w-2xl rounded-[2px] border border-white/60 bg-ivory-50/[0.93] px-7 py-8 shadow-[0_28px_70px_-34px_rgba(42,38,35,0.5)] backdrop-blur-lg md:px-11 md:py-10">
          <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-ink-500">— El catálogo</span>
          <h1 className="mt-3 font-display text-[2.75rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[4rem]">
            Flores de estación, <em className="italic text-rosa-500">hechas a mano.</em>
          </h1>
          <p className="mt-5 max-w-md text-ink-700">
            {cat === 'all' && priceKey === 'all'
              ? `${products.length} creaciones, armadas tallo por tallo y entregadas en Lima.`
              : `${list.length} ${list.length === 1 ? 'creación' : 'creaciones'} con estos filtros.`}
          </p>

          <div className="mt-8 flex flex-wrap gap-2.5">
            {chips.map((c) => (
              <button
                key={c.slug} onClick={() => setCat(c.slug)}
                className={`rounded-full border px-5 py-2 text-[13px] font-medium uppercase tracking-[0.14em] transition-colors ${
                  cat === c.slug ? 'border-rosa-500 bg-rosa-500 text-ivory-50' : 'border-ink-900/15 text-ink-700 hover:border-ink-900/40 hover:text-ink-900'}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Filtro de precio */}
          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">Precio</span>
            {PRICE_RANGES.map((r) => (
              <button
                key={r.key} onClick={() => setPrice(r.key)}
                className={`rounded-full border px-4 py-1.5 text-[12px] font-medium tracking-[0.03em] transition-colors ${
                  priceKey === r.key ? 'border-rosa-500 bg-rosa-500 text-ivory-50' : 'border-ink-900/15 text-ink-700 hover:border-ink-900/40 hover:text-ink-900'}`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* La grilla lleva su propio velo ivory (se desvanece desde el header) para
          que las etiquetas se lean nítidas; la carretilla asoma arriba y queda
          como presencia cálida y suave detrás de los productos. */}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'linear-gradient(to bottom, rgba(246,243,236,0) 0px, rgba(246,243,236,0.82) 400px)' }} />
        <section className="relative mx-auto max-w-7xl px-6 pb-24 md:px-12 md:pb-32">
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 md:gap-x-7 lg:grid-cols-4">
          {list.map((p, i) => (
            <motion.div
              key={p.id} layout
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: (i % 8) * 0.04 }}
              className="group"
            >
              <Link to={`/producto/${p.id}`} className="block">
                <div className="relative overflow-hidden rounded-sm bg-ivory-200 shadow-[0_10px_30px_-18px_rgba(42,38,35,0.4)] transition-shadow duration-500 group-hover:shadow-[0_28px_55px_-26px_rgba(42,38,35,0.5)]">
                  <img src={p.image} alt={p.name} className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/15 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
              </Link>
              <div className="mt-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/45">{p.categoryLabel}</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <Link to={`/producto/${p.id}`} className="font-display text-[17px] font-medium leading-tight text-ink-900 transition-colors hover:text-rosa-500">{p.name}</Link>
                  <span className="shrink-0 font-display text-base italic text-ink-700">{money(p.price)}</span>
                </div>
                <AddToCart
                  id={p.id}
                  className="mt-3 w-full border border-ink-900/15 py-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:border-rosa-500 hover:bg-rosa-500 hover:text-ivory-50 data-[done=true]:border-verde-700"
                />
              </div>
            </motion.div>
          ))}
        </div>
        {list.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-display text-2xl italic text-ink-700">No hay creaciones con esos filtros.</p>
            <button onClick={() => setParams({}, { replace: true })} className="mt-4 text-[13px] font-medium uppercase tracking-[0.14em] text-rosa-500 hover:text-rosa-600">Limpiar filtros</button>
          </div>
        )}
      </section>
      </div>
      <SiteFooter />
      </div>
    </div>
  );
}
