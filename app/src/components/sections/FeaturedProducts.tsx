import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import featured from '@/data/featured.json';
import { money, useProducts } from '@/lib/cart';
import { barajar } from '@/lib/azar';
import { Seccion, Encabezado } from './Seccion';

const ease = [0.22, 1, 0.36, 1] as const;
const CUANTOS = 12;
// Los que ya se llevó la tira de arriba: acá se empieza después de ellos.
const EN_LA_TIRA = 8;

/** Lo único que la ficha necesita, venga de la API o del respaldo. */
type Ficha = { id: string; name: string; price: number; image: string; etiqueta: string };

/**
 * El catálogo de la portada, ahora barajado.
 *
 * Era una lista fija de dieciséis (`data/featured.json`), siempre en el mismo
 * orden: quien volvía a la portada veía exactamente lo mismo, y la mitad del
 * catálogo no aparecía nunca. Ahora se toman doce productos al azar de los que
 * están vivos en la tienda, así que la portada cambia sola y todo el catálogo
 * tiene turno.
 *
 * El barajado es el de `lib/azar.ts`, el mismo que usa la tira de arriba: se
 * echa una vez por visita y cada sección se lleva su tramo —la tira los primeros
 * ocho, esta grilla los doce que siguen—, así ningún ramo sale dos veces en la
 * misma pantalla.
 *
 * `featured.json` se queda como respaldo: si la API no responde, la sección
 * muestra la selección de siempre en vez de un hueco.
 */
export const FeaturedProducts = () => {
  const { products } = useProducts();

  const lista: Ficha[] = useMemo(() => {
    const vivos = products.filter((p) => p.active !== false && p.image);
    if (vivos.length < EN_LA_TIRA + CUANTOS) {
      return featured.slice(0, CUANTOS).map((p) => ({ ...p, etiqueta: p.category }));
    }
    return barajar(vivos)
      .slice(EN_LA_TIRA, EN_LA_TIRA + CUANTOS)
      .map((p) => ({ id: p.id, name: p.name, price: p.price, image: p.image, etiqueta: p.categoryLabel }));
  }, [products]);

  return (
    <Seccion id="catalogo">
      <Encabezado
        rotulo="El catálogo"
        titulo={<>Nuestra <em>colección de flores.</em></>}
        enlace={{ texto: 'Ver todo el catálogo', a: '/catalogo' }}
        className="mb-11"
      />

      <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-16">
        {lista.map((p, i) => (
          <motion.div
            key={p.id}
            // En móvil mostramos solo 8 (las demás aparecen desde md+); el resto
            // se ve en "Ver todo el catálogo".
            className={i >= 8 ? 'max-md:hidden' : undefined}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.6, ease, delay: (i % 4) * 0.08 }}
          >
            <Link to={`/producto/${p.id}`} className="group block">
              <div className="overflow-hidden">
                <img
                  src={p.image}
                  alt={p.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                />
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">
                    {p.etiqueta}
                  </p>
                  <span className="shrink-0 text-[13px] font-medium tabular-nums text-ink-700">
                    {money(p.price)}
                  </span>
                </div>
                <h3 className="display mt-2 text-[22px] leading-snug text-ink-900">{p.name}</h3>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </Seccion>
  );
};
