import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

export const Manifesto = () => (
  <section className="relative overflow-hidden bg-transparent px-6 pt-24 pb-16 md:px-12 md:pt-36 md:pb-20">
    <div className="relative mx-auto max-w-3xl">
      <motion.span
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.6, ease }}
        className="block text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45"
      >
        — No. 01 · Manifiesto
      </motion.span>
      <motion.h2
        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease }}
        className="mt-5 font-display text-[2.5rem] font-light leading-[1.04] tracking-tight text-ink-900 md:text-[4rem]"
      >
        No vendemos flores.<br />
        Vendemos <em className="italic text-rosa-500">pequeños momentos</em> de felicidad, amor y agradecimiento.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay: 0.1, ease }}
        className="mt-8 max-w-xl text-base leading-relaxed text-ink-700"
      >
        Cada arreglo lo armamos a mano, con flores que recibimos frescas tres veces por semana. Nada de stock, nada de
        plantillas — flores de estación pensadas tallo por tallo y entregadas en Lima.
      </motion.p>
    </div>
  </section>
);
