// Tarjeta de producto "flotante" — foto + nombre + precio que bobea suave,
// con sombra de pétalo y hover-lift. Click → ficha del producto.
// Pensada para zonas vacías del hero / secciones. Decorativa pero usable.
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { money, useProducts } from '@/lib/cart';

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  id: string;
  className?: string;
  /** amplitud del bob en px (default 10) */
  bob?: number;
  /** desfase para que no floten en sincronía */
  delay?: number;
  /** rotación base de la tarjeta */
  tilt?: number;
  label?: string;
};

export const FloatingProduct = ({ id, className, bob = 10, delay = 0, tilt = 0, label }: Props) => {
  const { products } = useProducts();
  const p = products.find((x) => x.id === id);
  if (!p) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.9, ease, delay }}
      className={className}
      style={{ rotate: tilt }}
    >
      <motion.div
        animate={{ y: [0, -bob, 0] }}
        transition={{ duration: 6 + bob * 0.18, repeat: Infinity, ease: 'easeInOut', delay }}
      >
        <Link
          to={`/producto/${id}`}
          className="group block w-[150px] rounded-md bg-surface p-2.5 shadow-[0_22px_50px_-22px_rgba(42,38,35,0.5)] ring-1 ring-black/[0.04] transition-transform duration-500 hover:-translate-y-1.5 sm:w-[168px]"
        >
          <div className="overflow-hidden rounded-sm bg-ivory-200">
            <img src={p.image} alt={p.name} className="aspect-[4/5] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
          </div>
          <div className="px-1 pb-0.5 pt-2.5">
            {label && <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-rosa-500">{label}</p>}
            <p className="truncate font-display text-[15px] font-medium leading-tight text-ink-900">{p.name}</p>
            <p className="mt-0.5 font-display text-sm italic text-ink-700">{money(p.price)}</p>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
};
