// Kit de animaciones editoriales Lima Flores.
// Reveal: fade+rise al entrar al viewport. Stagger/StaggerItem: cascada.
// ParallaxBloom: flor decorativa con parallax sutil al hacer scroll.
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, type ReactNode } from 'react';

export const ease = [0.22, 1, 0.36, 1] as const;

type RevealProps = {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  margin?: string;
};

export const Reveal = ({ children, delay = 0, y = 24, className, margin = '-70px' }: RevealProps) => (
  <motion.div
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: margin as any }}
    transition={{ duration: 0.7, delay, ease }}
    className={className}
  >
    {children}
  </motion.div>
);

export const Stagger = ({ children, className, stagger = 0.09 }: { children: ReactNode; className?: string; stagger?: number }) => (
  <motion.div
    initial="hidden"
    whileInView="show"
    viewport={{ once: true, margin: '-60px' }}
    variants={{ hidden: {}, show: { transition: { staggerChildren: stagger } } }}
    className={className}
  >
    {children}
  </motion.div>
);

export const StaggerItem = ({ children, className, y = 28 }: { children: ReactNode; className?: string; y?: number }) => (
  <motion.div
    variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.65, ease } } }}
    className={className}
  >
    {children}
  </motion.div>
);

// Flor recortada decorativa que "flota" con el scroll (parallax sutil).
// side: a qué borde se pega. drift: px totales de recorrido vertical.
export const ParallaxBloom = ({ src, side = 'right', drift = 60, className }: { src: string; side?: 'left' | 'right'; drift?: number; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const yMove = useTransform(scrollYProgress, [0, 1], [drift, -drift]);
  const rotate = useTransform(scrollYProgress, [0, 1], [-2, 3]);
  return (
    <div ref={ref} aria-hidden className={`pointer-events-none absolute top-1/2 hidden -translate-y-1/2 lg:block ${side === 'right' ? '-right-16' : '-left-16'} ${className || ''}`}>
      <motion.img src={src} alt="" style={{ y: yMove, rotate }} className="w-56 opacity-[0.55] saturate-[0.92] xl:w-72" />
    </div>
  );
};
