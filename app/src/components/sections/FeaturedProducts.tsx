import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import featured from '@/data/featured.json';
import { money } from '@/lib/cart';
import { Seccion, Encabezado } from './Seccion';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * El catálogo de la portada.
 *
 * Los cambios son de ficha, no de grilla: el nombre pasa a la itálica del
 * sistema, el precio deja de competir con él (era más grande que el nombre) y
 * baja a la misma línea de la categoría, y cada ficha se apoya en un filete en
 * vez de flotar. La foto ya no vive sobre un recuadro gris: se acerca un poco al
 * pasar el mouse y nada más.
 */
export const FeaturedProducts = () => (
  <Seccion id="catalogo">
    <Encabezado
      rotulo="El catálogo"
      titulo={<>Nuestra <em>colección de flores.</em></>}
      enlace={{ texto: 'Ver todo el catálogo', a: '/catalogo' }}
      className="mb-11"
    />

    <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 md:gap-x-8 lg:grid-cols-4 lg:gap-x-10 lg:gap-y-16">
      {featured.map((p, i) => (
        <motion.div
          key={p.id}
          // En móvil mostramos solo 8 (las demás aparecen desde md+); el resto se
          // ve en "Ver todo el catálogo".
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
                  {p.category}
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
