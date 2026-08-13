// "Nosotros" — cada ramo es una obra de arte (foto de la florista + manifiesto).
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Reveal } from '@/components/motion/Reveal';
import { Seccion, Encabezado } from './Seccion';

/**
 * La foto del taller pasa a mandar: va a sangre por la izquierda y ocupa más de
 * la mitad, en vez de entrar recortada dentro de la columna centrada. El
 * parallax se queda —es sutil y le da aire— pero el rótulo que iba encima de la
 * foto en una plaquita blanca ahora es un pie de foto, debajo, con su filete.
 * Una plaquita flotando sobre la imagen es justo la caja que el sistema no usa.
 */
export const AtelierStory = () => {
  const mediaRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: mediaRef, offset: ['start end', 'end start'] });
  const imgY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%']);

  return (
    <Seccion>
      <Encabezado
        rotulo="Nosotros"
        titulo={<>Cada ramo es una <em>obra de arte</em>, hecha a mano.</>}
        className="mb-16 max-w-[22ch] sm:max-w-none"
      />

      <div className="grid items-start gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
        <div>
          <div ref={mediaRef} className="overflow-hidden">
            <motion.img
              src="/about/florista.webp"
              alt="Florista de Lima Flores armando un ramo en el taller"
              style={{ y: imgY }}
              loading="lazy"
              className="aspect-[4/3] w-full scale-[1.13] object-cover"
            />
          </div>
          <p className="mt-4 border-t border-border pt-3.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">
            El taller · Miraflores
          </p>
        </div>

        <div className="lg:pt-4">
          <Reveal>
            <p className="text-[17px] leading-relaxed text-ink-700">
              Somos <strong className="font-medium text-ink-900">Lima Flores</strong>, comprometidos
              a ofrecer los mejores arreglos de flores y regalos, respaldados por un
              servicio amigable y rápido.
            </p>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="mt-6 text-[17px] leading-relaxed text-ink-700">
              Promovemos el uso de flores en todo momento: desde la llegada de un bebé,
              un cumpleaños, una graduación, una boda, un aniversario, un «recupérate
              pronto» o para despedir a un ser querido.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <blockquote className="display mt-12 border-t border-border pt-8 text-[clamp(1.7rem,2.6vw,2.4rem)] leading-[1.1] text-ink-900">
              Una flor bien elegida dice más que un discurso preparado.
            </blockquote>
          </Reveal>
        </div>
      </div>
    </Seccion>
  );
};
