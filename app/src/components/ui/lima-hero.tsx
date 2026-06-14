import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCart } from '@/lib/cart';
import { MobileNav } from '@/components/MobileNav';

type NavLink = { label: string; href: string };
type Social = { label: string; href: string };

interface LimaHeroProps {
  imageSrc: string;
  imageAlt: string;
  navLinks: NavLink[];
  socials: Social[];
  locationText?: string;
}

const ease = [0.22, 1, 0.36, 1] as const;

/* ── iconos inline (lucide v1 quitó varias marcas; SVGs propios) ── */
const Icon = {
  grid: (c: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="1.6"/><circle cx="12" cy="5" r="1.6"/><circle cx="19" cy="5" r="1.6"/><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/><circle cx="5" cy="19" r="1.6"/><circle cx="12" cy="19" r="1.6"/><circle cx="19" cy="19" r="1.6"/></svg>
  ),
  search: (c: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
  ),
  heart: (c: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>
  ),
  bag: (c: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
  ),
  user: (c: string) => (
    <svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
  ),
  arrowL: (c: string) => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>),
  arrowR: (c: string) => (<svg className={c} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6"/></svg>),
};

export const LimaHero = ({ imageSrc, imageAlt, navLinks, socials, locationText = 'Miraflores · Lima' }: LimaHeroProps) => {
  const { open: openCart, count } = useCart();
  // Parallax editorial al hacer scroll: la figura sube despacio, el texto
  // (capa de atrás) baja un poco — sensación de profundidad sutil.
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const figureY = useTransform(scrollYProgress, [0, 1], ['0%', '-9%']);
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '18%']);
  const textOpacity = useTransform(scrollYProgress, [0, 0.7], [1, 0.25]);
  return (
    <section ref={sectionRef} className="relative h-screen min-h-[620px] w-full overflow-hidden bg-transparent">
      {/* ── Barra superior ── */}
      <motion.header
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }}
        className="absolute inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-5 md:px-12"
      >
        <div className="flex items-center gap-3">
          <MobileNav />
          <Link to="/" aria-label="Lima Flores · Inicio" className="flex items-center">
            <img src="/assets/logo.png" alt="Lima Flores" className="h-11 w-auto md:h-14" />
          </Link>
        </div>
        <nav className="hidden items-center gap-9 md:flex">
          {navLinks.map((l) => (
            l.href.startsWith('/')
              ? <Link key={l.label} to={l.href} className="text-[13px] font-medium uppercase tracking-[0.18em] text-foreground/55 transition-colors hover:text-foreground">{l.label}</Link>
              : <a key={l.label} href={l.href} className="text-[13px] font-medium uppercase tracking-[0.18em] text-foreground/55 transition-colors hover:text-foreground">{l.label}</a>
          ))}
        </nav>
        <div className="flex items-center gap-5 text-foreground/70">
          <button aria-label="Buscar" className="transition-colors hover:text-foreground">{Icon.search('h-[18px] w-[18px]')}</button>
          <button aria-label="Favoritos" className="hidden transition-colors hover:text-foreground sm:block">{Icon.heart('h-[18px] w-[18px]')}</button>
          <button onClick={openCart} aria-label="Carrito" className="relative transition-colors hover:text-foreground">
            {Icon.bag('h-[18px] w-[18px]')}
            {count > 0 && <span className="absolute -right-2 -top-2 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rosa-500 px-1 text-[9px] font-semibold text-ivory-50">{count}</span>}
          </button>
          <button aria-label="Cuenta" className="hidden transition-colors hover:text-foreground sm:block">{Icon.user('h-[18px] w-[18px]')}</button>
        </div>
      </motion.header>

      {/* ── Labels sociales verticales (izquierda) ── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col items-center gap-10 lg:flex"
      >
        {socials.map((s) => (
          <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer"
             style={{ writingMode: 'vertical-rl' }}
             className="rotate-180 text-[11px] font-medium uppercase tracking-[0.32em] text-foreground/45 transition-colors hover:text-foreground">{s.label}</a>
        ))}
        <span className="mt-2 h-16 w-px bg-foreground/20" />
      </motion.div>

      {/* ── Escenario central: texto gigante + figura ── */}
      <div className="absolute inset-0">
        {/* Texto serif escalonado — móvil: arriba centrado; desktop: derecha, detrás de la figura.
            El wrapper lleva el parallax de scroll (baja + se desvanece); el h1 la entrada. */}
        <motion.div
          style={{ y: textY, opacity: textOpacity }}
          className="pointer-events-none absolute inset-x-4 top-[9%] z-10 select-none md:inset-y-0 md:inset-x-auto md:right-[3%] md:top-0 md:w-[58%]"
        >
          <motion.h1
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.3 }}
            className="flex flex-col items-center text-center font-display font-medium leading-[0.86] text-ink-900 md:h-full md:items-end md:justify-center md:text-right"
          >
            <span className="text-[15vw] md:text-[13vw] lg:text-[160px]">Flores</span>
            <span className="-mt-[1vw] text-[10vw] italic text-rosa-500 md:text-[8vw] lg:text-[96px]">dan</span>
            <span className="-mt-[1vw] text-[15vw] md:text-[13vw] lg:text-[160px]">Amor</span>
          </motion.h1>
        </motion.div>

        {/* Figura: la mujer con nuestros tulipanes (recorte transparente, sin círculo).
            El wrapper externo maneja posición/centrado (Tailwind transform); la capa
            intermedia lleva el parallax de scroll; la img solo anima opacidad+y de
            entrada — así nadie pisa el translate-x del centrado.
            móvil: centrada abajo; desktop: izquierda, grande */}
        <div className="absolute bottom-0 left-1/2 z-20 h-[52%] -translate-x-1/2 sm:h-[58%] md:left-[3%] md:h-[82%] md:translate-x-0 lg:h-[88%]">
          <motion.div style={{ y: figureY }} className="h-full">
            <motion.img
              src={imageSrc} alt={imageAlt}
              initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.1, ease, delay: 0.2 }}
              className="h-full w-auto max-w-none object-contain object-bottom drop-shadow-[0_24px_40px_rgba(42,38,35,0.10)]"
            />
          </motion.div>
        </div>
      </div>

      {/* ── Texto inferior izquierdo + paginación ── */}
      <div className="absolute bottom-5 left-6 z-30 hidden text-[12px] font-medium uppercase tracking-[0.2em] text-foreground/55 md:left-12 md:block">{locationText}</div>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.8 }}
        className="absolute bottom-5 right-6 z-30 hidden items-center gap-5 md:right-12 md:flex"
      >
        <span className="text-sm tracking-[0.15em] text-foreground">01</span>
        <span className="h-px w-12 bg-foreground/30" />
        <span className="text-sm tracking-[0.15em] text-foreground/40">03</span>
        <button aria-label="Anterior" className="ml-2 text-foreground/60 transition-colors hover:text-foreground">{Icon.arrowL('h-5 w-5')}</button>
        <button aria-label="Siguiente" className="text-foreground/60 transition-colors hover:text-foreground">{Icon.arrowR('h-5 w-5')}</button>
      </motion.div>
    </section>
  );
};
