import { Link, NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '@/lib/cart';
import { MobileNav } from '@/components/MobileNav';

const nav = [
  { label: 'Inicio', to: '/' },
  { label: 'Catálogo', to: '/catalogo' },
  { label: 'Suscripción', to: '/suscripcion' },
];

export const SiteHeader = () => {
  const { count, open } = useCart();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border/50 bg-background/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3.5 md:px-12">
          <MobileNav />

          <Link to="/" aria-label="Lima Flores · Inicio" className="flex items-center md:flex-none">
            <img src="/assets/logo.png" alt="Lima Flores" className="h-9 w-auto md:h-11" />
          </Link>

          <nav className="hidden items-center gap-9 md:flex">
            {nav.map((n) => (
              <NavLink
                key={n.label} to={n.to}
                className={({ isActive }) =>
                  `link-underline text-[13px] font-medium uppercase tracking-[0.18em] transition-colors hover:text-foreground ${isActive ? 'text-foreground [background-size:100%_1.5px]' : 'text-foreground/55'}`}
              >
                {n.label}
              </NavLink>
            ))}
            <a href="https://wa.me/51999479855" target="_blank" rel="noopener noreferrer" className="link-underline text-[13px] font-medium uppercase tracking-[0.18em] text-foreground/55 transition-colors hover:text-foreground">Contacto</a>
          </nav>

          <button onClick={open} aria-label="Abrir carrito" className="press relative text-foreground/75 transition-colors hover:text-foreground">
            <svg className="h-[22px] w-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className="absolute -right-2 -top-2 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rosa-500 px-1 text-[10px] font-semibold text-ivory-50"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>
      </header>
    </>
  );
};
