// "Lo más querido de la casa" — momento editorial con fotos de producto
// flotando a distintas alturas sobre el wash floral. Banda de 6 polaroids con
// bob + parallax + escalonado vertical (en lg) que se mantiene ordenada en
// md (3 col) y móvil (2 col). Decorativo y comprable.
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Reveal } from '@/components/motion/Reveal';
import { FloatingProduct } from '@/components/motion/FloatingProduct';

// 6 piezas con buena variedad de categoría. `mt` solo escalona en lg (en md/móvil
// la grilla queda limpia). `tilt` da el aire "puesto a mano".
const picks = [
  { id: 'box-de-luxe', label: 'Arreglos', bob: 12, tilt: -4, mt: 'lg:mt-0' },
  { id: 'florero-de-20-tulipanes-2', label: 'Floreros', bob: 9, tilt: 3, mt: 'lg:mt-10' },
  { id: 'ramo-de-24-rosas', label: 'Ramos', bob: 11, tilt: 5, mt: 'lg:mt-3' },
  { id: 'orquidea-sunrise-de-dos-varas', label: 'Plantas', bob: 10, tilt: -3, mt: 'lg:mt-12' },
  { id: 'box-sensacion', label: 'Arreglos', bob: 13, tilt: 4, mt: 'lg:mt-2' },
  { id: 'ramo-de-flores-vintage', label: 'Ramos', bob: 9, tilt: -2, mt: 'lg:mt-8' },
];

export const FloatingShowcase = () => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const yA = useTransform(scrollYProgress, [0, 1], [28, -28]);
  const yB = useTransform(scrollYProgress, [0, 1], [48, -48]);

  return (
    <section className="relative overflow-hidden bg-transparent px-6 pb-24 pt-12 md:px-12 md:pb-32 md:pt-16">
      <div className="mx-auto max-w-7xl">
        {/* Encabezado: copy a la izquierda, intro + link a la derecha */}
        <div className="mb-12 flex flex-col gap-5 md:mb-16 md:flex-row md:items-end md:justify-between">
          <div>
            <Reveal>
              <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45">— Selección de la casa</span>
            </Reveal>
            <Reveal delay={0.08}>
              <h2 className="mt-3 font-display text-[2.5rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[3.5rem]">
                Lo más querido<br />de <em className="italic text-rosa-500">esta semana.</em>
              </h2>
            </Reveal>
          </div>
          <Reveal delay={0.16}>
            <div className="md:max-w-xs md:text-right">
              <p className="leading-relaxed text-ink-700">
                Seis piezas que salen del taller casi a diario — armadas a mano con lo más fresco que llega. Tócalas para ver el detalle.
              </p>
              <Link to="/catalogo" className="group mt-5 inline-flex items-center gap-2 text-[13px] font-medium uppercase tracking-[0.18em] text-ink-900 link-underline">
                Ver la colección <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </Reveal>
        </div>

        {/* Banda flotante: 6 polaroids con parallax + bob (escalonadas en lg) */}
        <div ref={ref} className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-8 md:grid-cols-3 md:gap-y-12 lg:grid-cols-6 lg:gap-x-5">
          {picks.map((p, i) => (
            <motion.div key={p.id} style={{ y: i % 2 ? yB : yA }} className={`flex justify-center ${p.mt}`}>
              <FloatingProduct id={p.id} label={p.label} bob={p.bob} tilt={p.tilt} delay={(i % 3) * 0.12} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};
