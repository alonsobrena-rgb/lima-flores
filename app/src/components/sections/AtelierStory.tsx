// "Haciendo arte con flores desde 2017" — historia del atelier con parallax.
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Reveal, ParallaxBloom } from '@/components/motion/Reveal';

export const AtelierStory = () => {
  const mediaRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: mediaRef, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <section className="relative overflow-hidden bg-transparent px-6 py-24 md:px-12 md:py-32">
      <ParallaxBloom src="/bloom/bloom-ramo-de-24-rosas.png" side="left" drift={70} />
      <div className="mx-auto max-w-6xl">
        <header className="mb-14">
          <Reveal>
            <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-foreground/45">— No. 05 · El atelier</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-3 max-w-xl font-display text-[2.5rem] font-light leading-[1.04] tracking-tight text-ink-900 md:text-[3.75rem]">
              Haciendo <em className="italic text-rosa-500">arte</em><br />con flores desde 2017.
            </h2>
          </Reveal>
        </header>

        <div className="grid gap-12 md:grid-cols-[6fr_5fr] md:gap-16">
          <div ref={mediaRef} className="relative overflow-hidden">
            <motion.img
              src="/products/arreglo-andrea.jpg" alt="Arreglo Andrea — rosas naranjas, claveles y eucalipto"
              style={{ y: imgY }}
              className="aspect-[4/5] w-full scale-[1.13] object-cover"
            />
            <span className="absolute bottom-4 left-4 bg-ivory-50/90 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-700">
              Miraflores · Hecho a mano
            </span>
          </div>
          <div className="flex flex-col justify-center">
            <Reveal>
              <div className="flex items-baseline gap-4">
                <span className="text-[11px] uppercase tracking-[0.2em] text-foreground/45">Atelier desde</span>
                <span className="font-display text-7xl font-light text-rosa-500">2017</span>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-8 leading-relaxed text-ink-700">
                Lima Flores nació en una cocina pequeña de San Isidro, con tres baldes de agua y dos tijeras buenas.
                La idea era simple — que comprar flores en Lima debería sentirse como pararse frente a una carretilla
                florista en una callecita de París o Lisboa.
              </p>
            </Reveal>
            <Reveal delay={0.18}>
              <p className="mt-5 leading-relaxed text-ink-700">
                Hoy somos un atelier que recibe flores frescas los lunes, miércoles y viernes. Lo que ves disponible
                es lo que tenemos esa semana — si algo se acaba, te avisamos en menos de una hora.
              </p>
            </Reveal>
            <Reveal delay={0.26}>
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
