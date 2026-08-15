import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { AddToCart } from '@/components/AddToCart';
import { Seccion, Encabezado, enlaceTexto } from '@/components/sections/Seccion';
import { money, useProducts } from '@/lib/cart';

// Orden de presentación pedido por la florería (coronas, lágrima y box).
const ORDER = [
  'funebre-corona-eternidad',
  'funebre-lagrima-esperanza',
  'funebre-corona-perpetua',
  'funebre-corona-buen-viaje',
  'funebre-box-rayo-de-luz',
];

/**
 * Condolencias, ya dentro del sistema.
 *
 * Esta página se quedó con el traje viejo cuando la portada cambió, y era la que
 * peor lo llevaba: un cementerio de banco de imágenes **fijo detrás de todo**,
 * con un velo en degradado encima para poder leer, y el texto dentro de un
 * plinto blanco translúcido con sombra y `backdrop-blur`. Tres parches para
 * sostener un fondo que nadie pidió — y en la página más delicada de la tienda.
 *
 * Fuera el fondo, el velo y el plinto. Manda lo mismo que en el resto del sitio:
 * blanco, el filete de 1 px y las fotos de los arreglos, que además son las
 * únicas imágenes honestas acá (las de verdad, no una escena comprada).
 *
 * El texto vuelve a la izquierda: centrado era el único bloque del sitio que no
 * colgaba del mismo margen.
 */
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

      <Seccion filete={false} className="pb-0 pt-[clamp(40px,6vh,72px)]">
        <Encabezado
          rotulo="Condolencias"
          titulo={<>Acompañamos tu adiós <em>con flores.</em></>}
          className="mb-10"
        />
        <div className="grid gap-8 border-t border-border pt-8 lg:grid-cols-[minmax(0,58ch)_auto] lg:items-start lg:gap-16">
          <p className="text-[17px] leading-relaxed text-ink-700">
            Coronas, lágrimas y arreglos fúnebres hechos a mano para honrar y despedir
            a quien partió. Cada pieza se arma con flores frescas de la semana, incluye
            tarjeta de dedicatoria y la entregamos en Lima. Estamos contigo en este
            momento. Las imágenes son referenciales.
          </p>
          <a
            href="https://wa.me/51999479855"
            target="_blank"
            rel="noopener noreferrer"
            className={enlaceTexto}
          >
            ¿Necesitas ayuda? Escríbenos <span aria-hidden="true">→</span>
          </a>
        </div>
      </Seccion>

      <Seccion filete={false} className="pt-[clamp(40px,6vh,72px)]">
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 md:gap-x-8 lg:gap-y-16">
          {list.map((p, i) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: (i % 6) * 0.05 }}
              className="group"
            >
              {/* La misma ficha que el catálogo: foto sin recuadro, filete debajo,
                  categoría y precio en la misma línea y el nombre en itálica. */}
              <Link to={`/producto/${p.id}`} className="block overflow-hidden">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </Link>
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">
                    {p.categoryLabel}
                  </p>
                  <span className="shrink-0 text-[13px] font-medium tabular-nums text-ink-700">
                    {money(p.price)}
                  </span>
                </div>
                <Link to={`/producto/${p.id}`} className="display mt-2 block text-[22px] leading-snug text-ink-900 transition-colors hover:text-rosa-500">
                  {p.name}
                </Link>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-500">{p.shortDesc}</p>
                <AddToCart
                  id={p.id}
                  className="press mt-4 w-full rounded-pill border border-ivory-400 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-900 transition-colors hover:border-rosa-500 hover:bg-rosa-500 hover:text-white data-[done=true]:border-verde-700"
                />
              </div>
            </motion.div>
          ))}
        </div>

        {list.length === 0 && (
          <p className="display py-16 text-[22px] text-ink-500">
            Pronto sumaremos nuestros arreglos fúnebres.
          </p>
        )}
      </Seccion>

      <SiteFooter />
    </div>
  );
}
