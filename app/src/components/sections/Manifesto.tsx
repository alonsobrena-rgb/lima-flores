import { Reveal } from '@/components/motion/Reveal';
import { Seccion } from './Seccion';

/**
 * El manifiesto — la tesis de la casa.
 *
 * Antes eran tres bloques de texto seguidos: el título, y debajo dos párrafos
 * que decían casi lo mismo con otras palabras. Entre el cartel del hero y las
 * fotos del catálogo eso es un muro: el visitante viene a ver flores, no a leer.
 * Queda la frase a tamaño de cartel —que a esa escala funciona como imagen, no
 * como texto— y una sola línea al lado. Los dos párrafos se fundieron en uno.
 */
export const Manifesto = () => (
  <Seccion filete={false} className="py-[clamp(64px,8vh,104px)]">
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,34ch)] lg:items-end lg:gap-20">
      <Reveal>
        <p className="display max-w-[15ch] text-[clamp(2.4rem,6.4vw,5.6rem)] leading-[0.98] text-ink-900">
          Hay emociones que merecen <em>algo más</em> que un mensaje.
        </p>
      </Reveal>
      <Reveal delay={0.1}>
        <p className="border-t border-border pt-6 text-[16px] leading-relaxed text-ink-700">
          En Lima Flores elegimos cada detalle para ayudarte a expresar amor,
          cariño, gratitud o apoyo cuando las palabras no son suficientes.
        </p>
      </Reveal>
    </div>
  </Seccion>
);
