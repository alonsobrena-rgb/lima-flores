// "Nosotros" — cada ramo es una obra de arte (foto de la florista + manifiesto).
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Reveal } from '@/components/motion/Reveal';

export const AtelierStory = () => {
  const mediaRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: mediaRef, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <section className="relative overflow-hidden bg-transparent px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-6xl">
        <header className="mb-14">
          <Reveal>
            <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45">— No. 05 · Nosotros</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-3 max-w-3xl font-display text-[2.5rem] font-light leading-[1.04] tracking-tight text-ink-900 md:text-[3.75rem]">
              Cada uno de nuestros ramos son una <em className="italic text-rosa-500">obra de arte</em>, creada con amor y dedicación.
            </h2>
          </Reveal>
        </header>

        <div className="grid items-center gap-12 md:grid-cols-[1.1fr_0.9fr] md:gap-16">
          <div ref={mediaRef} className="relative overflow-hidden">
            <motion.img
              src="/about/florista.webp" alt="Florista de Lima Flores armando un ramo en el taller"
              style={{ y: imgY }}
              className="aspect-[4/3] w-full scale-[1.13] object-cover"
            />
            <span className="absolute bottom-4 left-4 bg-ivory-50/90 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-700">
              Miraflores · Hecho a mano
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <Reveal>
              <p className="leading-relaxed text-ink-700">
                Somos <strong className="font-medium text-ink-900">Lima Flores</strong>, comprometidos a ofrecer los mejores arreglos de flores y
                regalos, respaldados por un servicio amigable y rápido.
              </p>
            </Reveal>
            <Reveal delay={0.12}>
              <p className="mt-5 leading-relaxed text-ink-700">
                Promovemos el uso de flores en todo momento: desde la llegada de un bebé, un cumpleaños, una graduación,
                una boda, un aniversario, un «recupérate pronto» o para despedir a un ser querido.
              </p>
            </Reveal>
            <Reveal delay={0.2}>
              <blockquote className="mt-10 border-l-2 border-rosa-500 pl-6 font-display text-2xl font-light italic leading-snug text-ink-900 md:text-3xl">
                Una flor bien elegida dice más que un discurso preparado.
              </blockquote>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
};
