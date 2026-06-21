import { useRef, useState, useEffect } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useCart } from '@/lib/cart';
import { MobileNav } from '@/components/MobileNav';

type NavLink = { label: string; href: string };
type Social = { label: string; href: string };

interface LimaHeroProps {
  /** Video del hero (mujer recibiendo flores). Se "scrubea" con el scroll en
   *  desktop y se reproduce en loop en móvil / reduced-motion. */
  videoSrc: string;
  videoWebm?: string;
  poster: string;
  imageAlt: string;
  navLinks: NavLink[];
  socials: Social[];
  locationText?: string;
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

export const LimaHero = ({ videoSrc, videoWebm, poster, imageAlt, navLinks, socials, locationText = 'Miraflores · Lima' }: LimaHeroProps) => {
  const { open: openCart, count } = useCart();
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Modo "scrub": el video avanza con el scroll. Solo en desktop con puntero fino
  // y sin reduced-motion (en móvil el seek de video es poco confiable → loop).
  const [scrub, setScrub] = useState(false);
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    setScrub(!reduce && fine && window.innerWidth >= 768);
  }, []);

  // Progreso de scroll sobre la sección alta (pin). 0 = arriba, 1 = abajo.
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  // Parallax sutil del titular durante el pin. Se mantiene visible (solo recede
  // un poco) porque el usuario quiere conservar "Flores dan Amor" sobre el video.
  const textY = useTransform(scrollYProgress, [0, 1], ['0%', '12%']);
  const textOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.45]);
  // El hint "Desliza ↓" desaparece apenas se empieza a scrollear.
  const hintOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  // Scrub: mapear progreso → currentTime del video.
  useMotionValueEvent(scrollYProgress, 'change', (p) => {
    const v = videoRef.current;
    if (!scrub || !v || !v.duration || Number.isNaN(v.duration)) return;
    const t = Math.max(0, Math.min(v.duration - 0.05, p * v.duration));
    if (Math.abs(v.currentTime - t) > 0.015) v.currentTime = t;
  });

  // Scrub → pausado (lo movemos a mano). Loop → autoplay.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (scrub) { v.pause(); v.currentTime = 0; }
    else { const pr = v.play(); if (pr && pr.catch) pr.catch(() => {}); }
  }, [scrub]);

  return (
    <section
      ref={sectionRef}
      className={scrub ? 'relative w-full bg-transparent' : 'relative h-screen min-h-[620px] w-full overflow-hidden bg-transparent'}
      style={scrub ? { height: '200vh' } : undefined}
    >
      {/* Contenedor pineado (desktop) / a pantalla (móvil) */}
      <div className={scrub ? 'sticky top-0 h-screen w-full overflow-hidden' : 'absolute inset-0'}>
        {/* ── Video: mujer recibiendo flores ── */}
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          poster={poster}
          muted
          playsInline
          preload="auto"
          loop={!scrub}
          autoPlay={!scrub}
          aria-label={imageAlt}
        >
          {videoWebm && <source src={videoWebm} type="video/webm" />}
          <source src={videoSrc} type="video/mp4" />
        </video>

        {/* Velo ivory para que el titular oscuro se lea sobre el video */}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-ivory-100/55 via-ivory-100/40 to-ivory-100/68" />
        <div aria-hidden className="absolute inset-0" style={{ background: 'radial-gradient(120% 75% at 50% 100%, rgba(246,243,236,0.35) 0%, transparent 60%)' }} />

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
          className="pointer-events-none absolute inset-x-4 top-[14%] z-30 select-none md:inset-y-0 md:inset-x-auto md:right-[5%] md:top-0 md:w-[56%]"
        >
          <motion.h1
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 0.3 }}
            className="flex flex-col items-center text-center font-display font-medium leading-[0.86] text-ink-900 [text-shadow:0_2px_30px_rgba(246,243,236,0.6)] md:h-full md:items-end md:justify-center md:text-right"
          >
            <span className="text-[15vw] md:text-[13vw] lg:text-[160px]">Flores</span>
            <span className="-mt-[1vw] text-[10vw] italic text-rosa-500 md:text-[8vw] lg:text-[96px]">dan</span>
            <span className="-mt-[1vw] text-[15vw] md:text-[13vw] lg:text-[160px]">Amor</span>
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

        {/* Hint de scroll (solo en modo scrub) */}
        {scrub && (
          <motion.div
            style={{ opacity: hintOpacity }}
            className="absolute bottom-6 left-1/2 z-30 -translate-x-1/2 text-[11px] font-medium uppercase tracking-[0.24em] text-foreground/50"
          >
            <motion.span animate={{ y: [0, 6, 0] }} transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }} className="inline-block">Desliza ↓</motion.span>
          </motion.div>
        )}
      </div>
    </section>
  );
};
