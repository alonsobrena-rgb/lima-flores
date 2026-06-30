import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { money } from '@/lib/cart';

const ease = [0.22, 1, 0.36, 1] as const;

// Resumen del último pedido (lo guarda el checkout en localStorage antes de limpiar
// el carrito). Si no hay, simplemente no mostramos el resumen.
type LastOrder = {
  items: { name?: string; price?: number; qty: number }[];
  subtotal: number; shipping_fee: number; shipping_label?: string; total: number;
  delivery_type?: 'envio' | 'recojo'; address?: string; date?: string; time?: string; payment_method?: string;
};
function readLastOrder(): LastOrder | null {
  try { const raw = localStorage.getItem('lf_last_order'); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
const PETAL_COLORS = ['#E7AFC2', '#D584A1', '#F0D9B5', '#E7B8C6', '#B6C2A7'];

// Estallido de pétalos one-shot que cae desde el sello superior.
function Burst() {
  const petals = useMemo(() => {
    let s = 13; const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    return Array.from({ length: 26 }, (_, i) => ({
      i,
      x: (rnd() * 2 - 1) * 280,
      yEnd: 180 + rnd() * 320,
      rot: (rnd() * 2 - 1) * 320,
      size: 9 + rnd() * 13,
      delay: rnd() * 0.5,
      dur: 1.8 + rnd() * 1.6,
      color: PETAL_COLORS[(rnd() * PETAL_COLORS.length) | 0],
    }));
  }, []);
  return (
    <div aria-hidden className="pointer-events-none absolute left-1/2 top-0 h-0 w-0">
      {petals.map((p) => (
        <motion.span
          key={p.i}
          initial={{ x: 0, y: -10, rotate: 0, opacity: 0 }}
          animate={{ x: p.x, y: p.yEnd, rotate: p.rot, opacity: [0, 1, 1, 0] }}
          transition={{ duration: p.dur, delay: p.delay, ease: 'easeIn' }}
          style={{ position: 'absolute', width: p.size, height: p.size * 1.25, color: p.color }}
        >
          <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor"><path d="M12 1c5 4 6.5 9 5 14.5C15.6 20.5 13.8 23 12 23S8.4 20.5 7 15.5C5.5 10 7 5 12 1Z" /></svg>
        </motion.span>
      ))}
    </div>
  );
}

export default function Confirmacion() {
  const order = useMemo(readLastOrder, []);
  const recojo = order?.delivery_type === 'recojo';
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="relative mx-auto max-w-2xl px-6 py-24 text-center md:py-32">
        <div className="relative mx-auto inline-flex">
          <Burst />
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 240, damping: 16, delay: 0.1 }}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-rosa-500 text-ivory-50 shadow-[0_18px_40px_-12px_rgba(158,43,94,0.5)]"
          >
            <svg className="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </motion.div>
        </div>

        <motion.span
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, ease }}
          className="mt-8 block text-[12px] font-medium uppercase tracking-[0.28em] text-rosa-500"
        >
          Pedido recibido
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38, ease }}
          className="mt-3 font-display text-[2.75rem] font-light italic leading-[1.04] tracking-tight text-ink-900 md:text-[3.5rem]"
        >
          Gracias — ya empezamos<br />a pensar tus flores.
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.46, ease }}
          className="mx-auto mt-6 max-w-md leading-relaxed text-ink-700"
        >
          Te escribiremos por WhatsApp para coordinar {recojo ? 'el recojo en el taller' : 'la entrega'}.
          Mientras tanto, alguien del atelier ya elige los tallos que van a entrar en tu pedido.
        </motion.p>

        {order && Array.isArray(order.items) && (
          <motion.div
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, ease }}
            className="frost mx-auto mt-10 max-w-md p-6 text-left"
          >
            <h2 className="font-display text-lg text-ink-900">Resumen del pedido</h2>
            <ul className="mt-4 space-y-2">
              {order.items.map((it, i) => (
                <li key={i} className="flex justify-between gap-3 text-sm text-ink-700">
                  <span>{it.name} <span className="text-foreground/45">× {it.qty}</span></span>
                  <span className="shrink-0 italic">{money((it.price || 0) * it.qty)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between text-ink-600"><dt>Subtotal</dt><dd>{money(order.subtotal)}</dd></div>
              <div className="flex justify-between text-ink-600"><dt>{recojo ? 'Recojo en taller' : 'Envío'}</dt><dd>{order.shipping_fee ? money(order.shipping_fee) : 'Gratis'}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 font-display text-lg text-ink-900"><dt>Total</dt><dd>{money(order.total)}</dd></div>
            </dl>
            <div className="mt-4 space-y-1 border-t border-border pt-3 text-[13px] text-ink-600">
              {order.address && <p><span className="text-foreground/50">{recojo ? 'Recojo en:' : 'Entrega en:'}</span> {order.address}</p>}
              {(order.date || order.time) && <p><span className="text-foreground/50">Cuándo:</span> {order.date}{order.time ? ` · ${order.time}` : ''}</p>}
              {order.payment_method && <p><span className="text-foreground/50">Pago:</span> {order.payment_method}</p>}
            </div>
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.54, ease }}
          className="mt-10 flex flex-wrap justify-center gap-4"
        >
          <a href="https://wa.me/51999479855" target="_blank" rel="noopener noreferrer" className="press bg-rosa-500 px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-ivory-50 transition-colors hover:bg-rosa-600">Abrir WhatsApp</a>
          <Link to="/catalogo" className="press border border-ink-900/20 px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-ink-900 transition-colors hover:bg-ink-900 hover:text-ivory-50">Seguir viendo flores</Link>
        </motion.div>
      </div>
      <SiteFooter />
    </div>
  );
}
