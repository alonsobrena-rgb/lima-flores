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
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {/* Intro · Condolencias */}
      <header className="mx-auto max-w-3xl px-6 pb-12 pt-16 text-center md:pt-24">
        <span className="text-[12px] font-medium uppercase tracking-[0.3em] text-ink-500">— Condolencias</span>
        <h1 className="mt-4 font-display text-[2.6rem] font-light leading-[1.05] tracking-tight text-ink-900 md:text-[3.75rem]">
          Acompañamos tu adiós <em className="italic text-rosa-500">con flores.</em>
        </h1>
        <p className="mx-auto mt-6 max-w-xl leading-relaxed text-ink-700">
          Coronas, lágrimas y arreglos fúnebres hechos a mano para honrar y despedir a quien partió.
          Cada pieza se arma con flores frescas de la semana, incluye tarjeta de dedicatoria y se
          entrega el mismo día en Lima. Estamos contigo en este momento. Las imágenes son referenciales.
        </p>
        <p className="mt-5 text-[13px] uppercase tracking-[0.18em] text-foreground/50">
          ¿Necesitas ayuda? <a href="https://wa.me/51999479855" target="_blank" rel="noopener noreferrer" className="text-rosa-500 hover:text-rosa-600">Escríbenos por WhatsApp →</a>
        </p>
      </header>

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
                  <span className="shrink-0 font-display text-base italic text-ink-700">{money(p.price)}</span>
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

      <SiteFooter />
    </div>
  );
}
