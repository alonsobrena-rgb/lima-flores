import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

export const Manifesto = () => (
  <section className="relative overflow-hidden bg-transparent px-6 pt-24 pb-16 md:px-12 md:pt-36 md:pb-20">
    <div className="relative mx-auto max-w-3xl">
      <motion.h2
        initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.7, ease }}
        className="font-display text-[2.5rem] font-light leading-[1.04] tracking-tight text-ink-900 md:text-[4rem]"
      >
        Hay emociones que merecen algo más que un mensaje de texto.
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay: 0.1, ease }}
        className="mt-8 max-w-xl text-base leading-relaxed text-ink-700"
      >
        Las flores tienen una forma única de expresar lo que muchas veces no sabemos decir con palabras.
      </motion.p>
      <motion.p
        initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay: 0.2, ease }}
        className="mt-4 max-w-xl text-base leading-relaxed text-ink-700"
      >
        En Lima Flores diseñamos arreglos de flores y elegimos cada detalle para ayudarte a expresar amor, cariño,
        gratitud, admiración o apoyo cuando las palabras no son suficientes.
      </motion.p>
    </div>
  </section>
);
