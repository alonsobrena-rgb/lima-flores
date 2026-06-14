// Botón "Agregar" con feedback: morfa a "✓ Agregado" por ~1.4s.
import { useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '@/lib/cart';

type Props = {
  id: string;
  qty?: number;
  /** abre el drawer al agregar (default false en catálogo, true en ficha) */
  openDrawer?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export const AddToCart = ({ id, qty = 1, openDrawer = false, className, children }: Props) => {
  const { add, open } = useCart();
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onClick = () => {
    add(id, qty);
    if (openDrawer) open();
    setDone(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setDone(false), 1400);
  };

  return (
    <button
      onClick={onClick}
      aria-label="Agregar al carrito"
      className={`press relative overflow-hidden ${done ? 'bg-verde-700 text-ivory-50' : ''} ${className || ''}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        {done ? (
          <motion.span key="ok" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.22 }} className="flex items-center justify-center gap-1.5">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Agregado
          </motion.span>
        ) : (
          <motion.span key="add" initial={{ y: 14, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -14, opacity: 0 }} transition={{ duration: 0.22 }} className="block">
            {children || 'Agregar'}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
};
