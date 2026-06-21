import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { AddToCart } from '@/components/AddToCart';
import { money, useProducts } from '@/lib/cart';

// Orden de presentación pedido por la florería (coronas, lágrima y box).
const ORDER = [
  'funebre-corona-eternidad',
  'funebre-lagrima-esperanza',
  'funebre-corona-perpetua',
  'funebre-corona-buen-viaje',
  'funebre-box-rayo-de-luz',
];

export default function Funebre() {
  const { products } = useProducts();
  // Productos de la categoría fúnebre, en el orden curado de arriba; cualquier
  // otro producto fúnebre que se cree luego se agrega al final.
  const funebre = products.filter((p) => p.category === 'funebre');
  const list = [
    ...ORDER.map((id) => funebre.find((p) => p.id === id)).filter(Boolean),
    ...funebre.filter((p) => !ORDER.includes(p.id)),
  ] as typeof funebre;

  return (
    <div className="relative min-h-screen">
      {/* Fondo: cementerio de día (generado con Higgsfield) con velo ivory suave.
          La legibilidad la garantizan el plinto esmerilado del intro y el degradado
          a ivory de la grilla (abajo) — no el velo — así el cementerio se ve nítido. */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <img src="/bg/funebre-cementerio-2.webp" alt="" className="h-full w-full object-cover" />
        {/* Velo muy suave arriba (el cementerio se ve nítido en el hero) y se va
            cerrando hacia abajo; la legibilidad de la grilla la da su propio
            degradado a ivory, así que aquí podemos dejar la imagen clara. */}
        <div className="absolute inset-0 bg-gradient-to-b from-ivory-100/10 via-ivory-100/25 to-ivory-100/60" />
      </div>

      <div className="relative z-10">
      <SiteHeader />

      {/* Intro · Condolencias — sobre un plinto ivory esmerilado para que el texto
          se lea nítido sobre el cementerio. */}
      <header className="mx-auto max-w-3xl px-6 pb-12 pt-12 md:pt-20">
        <div className="mx-auto max-w-2xl rounded-[2px] border border-white/60 bg-ivory-50/[0.93] px-7 py-9 text-center shadow-[0_28px_70px_-34px_rgba(42,38,35,0.5)] backdrop-blur-lg md:px-11 md:py-11">
          <span className="text-[12px] font-medium uppercase tracking-[0.3em] text-ink-500">— Condolencias</span>
          <h1 className="mt-4 font-display text-[2.4rem] font-light leading-[1.05] tracking-tight text-ink-900 md:text-[3.4rem]">
            Acompañamos tu adiós <em className="italic text-rosa-500">con flores.</em>
          </h1>
          <p className="mx-auto mt-5 max-w-xl leading-relaxed text-ink-700">
            Coronas, lágrimas y arreglos fúnebres hechos a mano para honrar y despedir a quien partió.
            Cada pieza se arma con flores frescas de la semana, incluye tarjeta de dedicatoria y la
            entregamos en Lima. Estamos contigo en este momento. Las imágenes son referenciales.
          </p>
          <p className="mt-5 text-[13px] uppercase tracking-[0.18em] text-foreground/55">
            ¿Necesitas ayuda? <a href="https://wa.me/51999479855" target="_blank" rel="noopener noreferrer" className="text-rosa-500 hover:text-rosa-600">Escríbenos por WhatsApp →</a>
          </p>
        </div>
      </header>

      {/* La grilla lleva su propio velo ivory (se desvanece desde el intro) para que
          los nombres, precios y descripciones se lean nítidos sobre el cementerio. */}
      <div className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10" style={{ background: 'linear-gradient(to bottom, rgba(246,243,236,0) 0px, rgba(246,243,236,0.92) 320px)' }} />
        <section className="mx-auto max-w-7xl px-6 pb-24 md:px-12 md:pb-32">
        <div className="grid grid-cols-1 gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: (i % 6) * 0.05 }}
              className="group"
            >
              <Link to={`/producto/${p.id}`} className="block">
                <div className="relative overflow-hidden rounded-sm bg-ivory-200 shadow-[0_10px_30px_-18px_rgba(42,38,35,0.4)] transition-shadow duration-500 group-hover:shadow-[0_28px_55px_-26px_rgba(42,38,35,0.5)]">
                  <img src={p.image} alt={p.name} className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/15 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </div>
              </Link>
              <div className="mt-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/45">{p.categoryLabel}</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <Link to={`/producto/${p.id}`} className="font-display text-[19px] font-medium leading-tight text-ink-900 transition-colors hover:text-rosa-500">{p.name}</Link>
                  <span className="shrink-0 font-display text-lg italic text-ink-700">{money(p.price)}</span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-600">{p.shortDesc}</p>
                <AddToCart
                  id={p.id}
                  className="mt-4 w-full border border-ink-900/15 py-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:border-rosa-500 hover:bg-rosa-500 hover:text-ivory-50 data-[done=true]:border-verde-700"
                />
              </div>
            </motion.div>
          ))}
        </div>

        {list.length === 0 && (
          <p className="py-24 text-center font-display text-2xl italic text-ink-700">Pronto sumaremos nuestros arreglos fúnebres.</p>
        )}
        </section>
      </div>

      <SiteFooter />
      </div>
    </div>
  );
}
