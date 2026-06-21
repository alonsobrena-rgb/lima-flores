import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCart } from '@/lib/cart';
import { MobileNav } from '@/components/MobileNav';

type NavLink = { label: string; href: string };
type Social = { label: string; href: string };

interface LimaHeroProps {
  navLinks: NavLink[];
  socials: Social[];
  locationText?: string;
  videoSrc: string;
  poster: string;
}

const ease = [0.22, 1, 0.36, 1] as const;

/* ── iconos inline (lucide v1 quitó varias marcas; SVGs propios) ── */
const Icon = {
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

// El hero lleva su PROPIO video (mujer recibiendo flores) reproduciéndose en
// loop, confinado a esta sección. El resto de la landing tiene un fondo floral
// fijo aparte (<HomeFloralBg/>). Encima del video van la barra, el titular y
// los labels, con un velo ivory para que el titular oscuro se lea.
export const LimaHero = ({ navLinks, socials, locationText = 'Miraflores · Lima', videoSrc, poster }: LimaHeroProps) => {
  const { open: openCart, count } = useCart();
  const sectionRef = useRef<HTMLElement>(null);
  // Parallax/fade sutil del titular y del hint al hacer scroll.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'] });
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '16%']);
  const textOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.4]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.25], [1, 0]);

  return (
    <section ref={sectionRef} className="relative h-screen min-h-[620px] w-full overflow-hidden bg-ivory-100">
      {/* ── Video de fondo del hero (loop, confinado a esta sección) ── */}
      <video
        className="absolute inset-0 h-full w-full object-cover"
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      {/* Velo ivory para asentar el video y que el titular oscuro se lea (más
          denso a la derecha, donde cae "Flores dan Amor") */}
      <div className="absolute inset-0 bg-gradient-to-r from-ivory-100/10 via-transparent to-ivory-100/45" />
      <div className="absolute inset-0 bg-gradient-to-b from-ivory-100/15 via-transparent to-ivory-100/30" />

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

      {/* ── Titular gigante "Flores dan Amor" sobre el video ── */}
      <motion.div
        style={{ y: textY, opacity: textOpacity }}
        className="pointer-events-none absolute inset-4 z-30 select-none md:inset-y-0 md:inset-x-auto md:right-[5%] md:w-[56%]"
      >
        <motion.h1
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.3 }}
          className="flex h-full flex-col items-center justify-center text-center font-display font-medium leading-[0.86] text-ink-900 [text-shadow:0_2px_30px_rgba(246,243,236,0.7)] md:items-end md:text-right"
        >
          {/* En móvil va un panel blanco translúcido ligero para que el titular se
              lea bien sobre el video; en desktop no lleva panel (queda igual). */}
          <span className="flex flex-col items-center rounded-[1.75rem] bg-white/25 px-6 py-4 backdrop-blur-[3px] md:items-end md:rounded-none md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
            <span className="text-[15vw] md:text-[13vw] lg:text-[160px]">Flores</span>
            <span className="-mt-[1vw] text-[10vw] italic text-rosa-500 md:text-[8vw] lg:text-[96px]">dan</span>
            <span className="-mt-[1vw] text-[15vw] md:text-[13vw] lg:text-[160px]">Amor</span>
          </span>
        </motion.h1>
      </motion.div>

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

      {/* Hint de scroll */}
      <motion.div
        style={{ opacity: hintOpacity }}
        className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 text-[11px] font-medium uppercase tracking-[0.24em] text-foreground/50"
      >
        <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} className="inline-block">Desliza ↓</motion.span>
      </motion.div>
    </section>
  );
};
