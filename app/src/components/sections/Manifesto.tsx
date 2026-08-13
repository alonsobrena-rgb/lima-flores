import { Reveal } from '@/components/motion/Reveal';
import { Seccion } from './Seccion';

/**
 * El manifiesto — la tesis de la casa, y el único sitio de la portada donde el
 * texto es el producto.
 *
 * Antes era una columna de 768 px centrada con el título y los dos párrafos
 * apilados debajo, del mismo tamaño que cualquier otra sección. Ahora la frase
 * ocupa el ancho completo a tamaño de cartel y la prosa se retira a una columna
 * angosta a la derecha: el contraste de escala es la jerarquía, que es la misma
 * regla del hero.
 */
export const Manifesto = () => (
  <Seccion filete={false} className="pt-[clamp(88px,14vh,168px)]">
    <Reveal>
      <p className="display max-w-[16ch] text-[clamp(2.6rem,7.6vw,7rem)] leading-[0.96] text-ink-900">
        Hay emociones que merecen <em>algo más</em> que un mensaje.
      </p>
    </Reveal>

    <div className="mt-14 grid gap-10 border-t border-border pt-10 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-16 lg:mt-20 lg:grid-cols-[1fr_minmax(0,44ch)] lg:pt-12">
      <Reveal delay={0.06}>
        <p className="max-w-[42ch] text-[17px] leading-relaxed text-ink-700">
          Las flores tienen una forma única de expresar lo que muchas veces no
          sabemos decir con palabras.
        </p>
      </Reveal>
      <Reveal delay={0.14}>
        <p className="max-w-[44ch] text-[17px] leading-relaxed text-ink-700">
          En Lima Flores diseñamos arreglos de flores y elegimos cada detalle para
          ayudarte a expresar amor, cariño, gratitud, admiración o apoyo cuando las
          palabras no son suficientes.
        </p>
      </Reveal>
    </div>
  </Seccion>
);
