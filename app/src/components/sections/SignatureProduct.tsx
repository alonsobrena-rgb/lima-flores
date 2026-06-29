// "La firma de la casa" — Orquídeas grandes en maceta (Phalaenopsis).
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useCart, money } from '@/lib/cart';
import { Reveal, ease } from '@/components/motion/Reveal';

const ID = 'orquideas-grandes-en-maceta';

export const SignatureProduct = () => {
  const { add, open } = useCart();
  return (
    <section className="relative overflow-hidden bg-[#5E4A55] px-6 py-24 text-ivory-100 md:px-12 md:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-[5fr_6fr] md:gap-20">
        <motion.div
          initial={{ opacity: 0, x: -40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.9, ease }}
          className="relative mx-auto w-full max-w-sm"
        >
          {/* Foto enmarcada (fondo blanco uniforme): la tarjeta de marca es blanca
              sobre blanco y no se puede recortar, así que en vez de un cutout
              transparente la mostramos como una impresión sobre la sección oscura. */}
          <div className="overflow-hidden rounded-lg bg-white shadow-[0_34px_70px_-22px_rgba(0,0,0,0.5)]">
            <img src="/bloom/orquideas-grandes-maceta-foto.webp" alt="Orquídea Phalaenopsis magenta en maceta de cerámica"
                 className="block w-full" />
          </div>
        </motion.div>
        <div>
          <Reveal>
            <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-ivory-100/60">— No. 04 · La firma de la casa</span>
          </Reveal>
          <Reveal delay={0.08}>
            <h2 className="mt-4 font-display text-[2.75rem] font-light leading-[1.02] tracking-tight md:text-[3.75rem]">
              Orquídeas<br /><em className="italic text-rosa-300">en maceta.</em>
            </h2>
          </Reveal>
          <Reveal delay={0.14}>
            <p className="mt-6 max-w-md leading-relaxed text-ivory-100/75">
              Una Phalaenopsis de tallo largo y flor magenta, seleccionada a mano y montada en maceta decorativa de
              cerámica. Florece entre ocho y doce semanas con riego mínimo. Incluye tarjeta con dedicatoria.
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-ivory-100/20 pt-6 text-sm sm:grid-cols-4">
              {[['Especie', 'Phalaenopsis'], ['Vara', '1 — larga'], ['Altura', '60–70 cm'], ['Maceta', 'Cerámica']].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-[0.18em] text-ivory-100/55">{k}</dt>
                  <dd className="mt-1 text-ivory-100/90">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>
          <Reveal delay={0.26}>
            <div className="mt-8 flex items-baseline gap-3">
              <span className="font-display text-5xl">{money(200)}</span>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <button
                onClick={() => { add(ID); open(); }}
                className="bg-rosa-500 px-7 py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] text-ivory-50 transition-colors hover:bg-rosa-600"
              >
                Agregar al carrito
              </button>
              <Link to="/catalogo?cat=orquideas" className="group inline-flex items-center gap-2 border border-ivory-100/25 px-7 py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] text-ivory-100 transition-colors hover:border-ivory-100/60">
                Ver orquídeas <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
};
