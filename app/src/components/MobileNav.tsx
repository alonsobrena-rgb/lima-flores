// Burger + sheet de navegación móvil — compartido por el hero del home y el
// SiteHeader de las páginas internas. Maneja su propio estado.
import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;
const nav = [
  { label: 'Inicio', to: '/' },
  { label: 'Catálogo', to: '/catalogo' },
  { label: 'Suscripción', to: '/suscripcion' },
];

export const MobileNav = ({ tone = 'ink' }: { tone?: 'ink' | 'light' }) => {
  const [menu, setMenu] = useState(false);
  const color = tone === 'light' ? 'text-ivory-50' : 'text-foreground/75';
  return (
    <>
      <button onClick={() => setMenu(true)} aria-label="Abrir menú" className={`press -ml-1 transition-colors hover:text-foreground md:hidden ${color}`}>
        <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round"><line x1="4" y1="8" x2="20" y2="8" /><line x1="4" y1="14" x2="15" y2="14" /></svg>
      </button>

      <AnimatePresence>
        {menu && (
          <div className="fixed inset-0 z-[80] md:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMenu(false)} className="absolute inset-0 bg-ink-900/45 backdrop-blur-sm"
            />
            <motion.nav
              initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.4, ease }}
              className="absolute left-0 top-0 flex h-full w-[78%] max-w-[330px] flex-col bg-background px-7 py-7 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <img src="/assets/logo.png" alt="Lima Flores" className="h-10 w-auto" />
                <button onClick={() => setMenu(false)} aria-label="Cerrar menú" className="press text-foreground/60 hover:text-foreground">
                  <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                </button>
              </div>
              <div className="mt-12 flex flex-col gap-1">
                {nav.map((n, i) => (
                  <motion.div key={n.label} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12 + i * 0.06, ease }}>
                    <NavLink
                      to={n.to} onClick={() => setMenu(false)}
                      className={({ isActive }) => `block border-b border-border/60 py-4 font-display text-3xl ${isActive ? 'text-rosa-500 italic' : 'text-ink-900'}`}
                    >
                      {n.label}
                    </NavLink>
                  </motion.div>
                ))}
                <motion.a
                  href="https://wa.me/51999479855" target="_blank" rel="noopener noreferrer"
                  initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, ease }}
                  className="block border-b border-border/60 py-4 font-display text-3xl text-ink-900"
                >
                  Contacto
                </motion.a>
              </div>
              <p className="mt-auto text-[12px] uppercase tracking-[0.2em] text-foreground/45">Miraflores · Lima</p>
            </motion.nav>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
