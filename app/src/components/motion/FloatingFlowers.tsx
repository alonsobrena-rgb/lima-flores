// Flores recortadas (PNG transparente) flotando perpetuamente sobre la página.
// Decorativas: dispersas en posiciones absolutas, con bob + deriva + rotación
// lenta y desfasada. Solo transform/opacity. reduced-motion las deja quietas.
import { motion } from 'framer-motion';

type Flower = {
  src: string;
  className: string;   // posición (top/left/right) + tamaño (w-*)
  bob: number;         // px de balanceo vertical
  rot: number;         // grados de oscilación
  dur: number;         // segundos del loop
  delay: number;
  opacity?: number;
};

// 8 recortes dispersos (desktop). El subconjunto `md:hidden`/`hidden md:block`
// controla cuáles se ven en móvil para no saturar.
const FLOWERS: (Flower & { mobile?: boolean })[] = [
  { src: '/bloom/bloom-ramo-de-20-tulipanes-de-colores.png', className: 'left-[2%] top-[12%] w-28 lg:w-40', bob: 16, rot: 4, dur: 9, delay: 0, mobile: true },
  { src: '/bloom/bloom-orquidea-amarilla-centro-fucsia.png', className: 'right-[1%] top-[8%] w-24 lg:w-36', bob: 20, rot: -5, dur: 11, delay: 0.6 },
  { src: '/bloom/bloom-ramo-de-24-rosas.png', className: 'left-[5%] top-[58%] w-24 lg:w-36', bob: 14, rot: 5, dur: 10, delay: 1.1, mobile: true },
  { src: '/bloom/bloom-florero-de-20-tulipanes.png', className: 'right-[4%] top-[52%] w-24 lg:w-32', bob: 18, rot: -4, dur: 12, delay: 0.3 },
  { src: '/bloom/bloom-ramo-de-flores-vintage.png', className: 'left-[44%] top-[2%] w-20 lg:w-28', bob: 22, rot: 6, dur: 13, delay: 1.6 },
  { src: '/bloom/bloom-box-sensacion.png', className: 'right-[16%] bottom-[6%] w-24 lg:w-32', bob: 15, rot: -6, dur: 11, delay: 0.9, mobile: true },
  { src: '/bloom/bloom-ramo-de-20-tulipanes-de-colores.png', className: 'left-[12%] bottom-[4%] w-20 lg:w-28', bob: 17, rot: -3, dur: 12, delay: 2.0 },
  { src: '/bloom/bloom-orquidea-amarilla-centro-fucsia.png', className: 'left-[68%] top-[34%] w-16 lg:w-24', bob: 19, rot: 5, dur: 14, delay: 1.3 },
];

export const FloatingFlowers = () => (
  <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
    {FLOWERS.map((f, i) => (
      <motion.img
        key={i}
        src={f.src}
        alt=""
        loading="lazy"
        animate={{ y: [0, -f.bob, 0], rotate: [0, f.rot, 0] }}
        transition={{ duration: f.dur, repeat: Infinity, ease: 'easeInOut', delay: f.delay }}
        style={{ opacity: f.opacity ?? 0.92 }}
        className={`absolute drop-shadow-[0_18px_34px_rgba(42,38,35,0.18)] ${f.className} ${f.mobile ? '' : 'hidden md:block'}`}
      />
    ))}
  </div>
);
