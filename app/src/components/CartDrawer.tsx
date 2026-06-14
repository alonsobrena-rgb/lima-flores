import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart, money } from '@/lib/cart';

const ease = [0.22, 1, 0.36, 1] as const;

export const CartDrawer = () => {
  const { isOpen, close, items, productById, setQty, remove, subtotal, count } = useCart();
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close} className="absolute inset-0 bg-ink-900/45 backdrop-blur-sm"
          />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.45, ease }}
            className="absolute right-0 top-0 flex h-full w-full max-w-[420px] flex-col bg-background shadow-[-30px_0_60px_-30px_rgba(42,38,35,0.4)]"
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-5">
              <h2 className="font-display text-2xl font-medium text-ink-900">Tu carrito {count > 0 && <span className="text-foreground/40">({count})</span>}</h2>
              <button onClick={close} aria-label="Cerrar" className="text-foreground/60 hover:text-foreground">
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
                <p className="text-foreground/60">Tu carrito está vacío.</p>
                <Link to="/catalogo" onClick={close} className="text-sm font-medium uppercase tracking-[0.16em] text-rosa-500 hover:text-rosa-600">Ver el catálogo →</Link>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {items.map((it) => {
                    const p = productById(it.id); if (!p) return null;
                    return (
                      <div key={it.id} className="flex gap-4 border-b border-border/60 py-4">
                        <img src={p.image} alt={p.name} className="h-24 w-20 shrink-0 rounded-sm object-cover" />
                        <div className="flex flex-1 flex-col">
                          <p className="font-display text-base font-medium leading-tight text-ink-900">{p.name}</p>
                          <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-foreground/45">{p.categoryLabel}</p>
                          <div className="mt-auto flex items-center justify-between">
                            <div className="flex items-center rounded-full border border-border">
                              <button onClick={() => setQty(it.id, it.qty - 1)} aria-label="Menos" className="px-2.5 py-1 text-foreground/60 hover:text-foreground">−</button>
                              <span className="min-w-[20px] text-center text-sm">{it.qty}</span>
                              <button onClick={() => setQty(it.id, it.qty + 1)} aria-label="Más" className="px-2.5 py-1 text-foreground/60 hover:text-foreground">+</button>
                            </div>
                            <span className="font-display italic text-ink-800">{money(p.price * it.qty)}</span>
                          </div>
                        </div>
                        <button onClick={() => remove(it.id)} aria-label="Quitar" className="self-start text-foreground/35 transition-colors hover:text-rosa-500">
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
                        </button>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-border px-6 py-5">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-sm uppercase tracking-[0.16em] text-foreground/55">Subtotal</span>
                    <span className="font-display text-2xl text-ink-900">{money(subtotal)}</span>
                  </div>
                  <Link to="/checkout" onClick={close} className="press flex w-full items-center justify-center bg-rosa-500 py-4 text-sm font-medium uppercase tracking-[0.18em] text-ivory-50 transition-colors hover:bg-rosa-600">
                    Ir a pagar →
                  </Link>
                </div>
              </>
            )}
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
};
