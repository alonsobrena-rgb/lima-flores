import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

export const Manifesto = () => (
  <section className="relative overflow-hidden bg-transparent px-6 pt-24 pb-16 md:px-12 md:pt-36 md:pb-20">
    <div className="relative mx-auto grid max-w-6xl items-center gap-10 md:grid-cols-[5fr_7fr] md:gap-16">
      {/* Columna izquierda: eyebrow + flor (recorte Higgsfield) que llena el vacío.
          En móvil va DESPUÉS del texto (la imagen al final); en desktop, igual. */}
      <div className="relative order-2 md:order-1">
        <motion.span
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}
          className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45"
        >
          — No. 01 · Manifiesto
        </motion.span>

        {/* Flor: ramo de tulipanes de colores (motivo del hero), flotando */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.96 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 1, ease }}
          className="relative mt-8 block"
        >
          {/* wash cálido detrás de las orquídeas */}
          <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-[130%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle, rgba(231,184,198,0.5) 0%, rgba(240,217,181,0.28) 48%, transparent 72%)', filter: 'blur(10px)' }} />
          <motion.img
            src="/bloom/bloom-orquideas-completa.webp"
            alt="Orquídeas multicolor en maceta — la firma de Lima Flores"
            animate={{ y: [0, -12, 0], rotate: [0, 1, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
            className="mx-auto w-full max-w-[430px] drop-shadow-[0_24px_42px_rgba(42,38,35,0.20)]"
          />
        </motion.div>
      </div>

      <div className="order-1 md:order-2">
        <motion.h2
          initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease }}
          className="font-display text-[2.5rem] font-light leading-[1.04] tracking-tight text-ink-900 md:text-[4rem]"
        >
          No vendemos flores.<br />
          Vendemos <em className="italic text-rosa-500">pequeños momentos</em> de calma y belleza.
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay: 0.1, ease }}
          className="mt-8 max-w-xl text-base leading-relaxed text-ink-700"
        >
          Cada arreglo lo armamos a mano, con flores que recibimos frescas tres veces por semana. Nada de stock, nada de
          plantillas — flores de estación pensadas tallo por tallo y entregadas en Lima.
        </motion.p>
      </div>
    </div>
  </section>
);
