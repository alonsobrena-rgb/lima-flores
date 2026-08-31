import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { CONTACTO } from '@/lib/tienda';

const ease = [0.22, 1, 0.36, 1] as const;

/**
 * El herbario — la mecánica de la referencia «Leandra Isler», vestida con
 * Florencia.
 *
 * El movimiento que define al hero es uno solo: **la planta pasa por delante
 * del titular**. El texto no se corre para dejarle sitio, se deja tapar. Por eso
 * la foto va en `z-20` sobre el titular en `z-10`, y el titular está centrado y
 * dimensionado para que quede cruzado por las varas — si la planta no muerde el
 * texto, el efecto no existe.
 *
 * La frase, el tamaño de la letra y el ancho de la foto **se mueven juntos**: el
 * texto tiene que caer en la franja donde la planta es fina —tallos, no pétalos—,
 * así que una frase más larga pide letra más chica y planta más grande. Si
 * cambias la frase, revisa las tres cosas a la vez y mira el resultado en móvil,
 * que es donde el margen es estrecho.
 *
 * **En móvil el titular va escalonado y la planta entera.** Una línea arriba a la
 * izquierda, la otra abajo a la derecha, y las cuatro orquídeas dentro del cuadro
 * (146 % de ancho: se recortan los bordes exteriores de la primera y la última,
 * no la planta). Se probaron siete repartos: centrado con la planta al 250 %
 * dejaba solo dos flores; con el titular más abajo, los pétalos se comían la
 * primera línea; a 14 vw la segunda línea perdía la «S» debajo de la orquídea
 * crema y el punto final se iba fuera del papel. El que quedó —12,6 vw y la
 * segunda línea a 27 vh— es el más grande que se lee entero: cada línea cae en un
 * hueco distinto de la foto y la de abajo la cruzan los tallos, no los pétalos.
 * De lg para arriba se mantiene el mismo reparto —una línea a cada lado— pero sin
 * el salto vertical: ahí sobra ancho y las dos caben una debajo de la otra.
 *
 * De Florencia sale todo lo demás, sin inventar un solo token: blanco total,
 * Cormorant Garamond en itálica peso 500 con el `<em>` en rosa del ramo, Jost
 * para el resto, filetes en #E6E5E3 y el pie de datos con el patrón de la
 * portada.
 *
 * El pie va **debajo** del cartel, en su propia banda con filete: metido dentro
 * quedaba tapado por las hojas, y un enlace que la foto esconde no es un enlace.
 * Es una sola línea: dos enlaces y tres datos. El párrafo que había acá repetía
 * lo que ya dicen los datos («al día siguiente», «24 h de anticipación») y lo
 * que la ficha del producto cuenta mejor — entre el cartel y las fotos del
 * catálogo no debería haber un muro de texto.
 *
 * La foto es la del catálogo (`orquideas-grandes-en-maceta-2`), recortada desde
 * el calado de `bloom/` —la misma toma, a 2,6× de resolución— y con el
 * cartelito de la vara borrado, que en el calado había quedado como un fantasma
 * translúcido.
 */

/** Todo sale del catálogo, del checkout o de `tienda.ts`. Nada inventado. */
const DATOS = [
  { valor: 'Desde S/ 200', nota: 'Orquídeas en maceta' },
  { valor: 'Al día siguiente', nota: '24 h de anticipación' },
  { valor: 'Lima Metropolitana', nota: 'Entrega a domicilio' },
];

const enlace =
  'link-underline press inline-block border-b border-ivory-400 pb-1.5 text-[15px] ' +
  'font-medium tracking-[0.02em] text-ink-900';

export const HeroHerbario = () => (
  <>
    <section className="relative isolate overflow-hidden bg-background">
      {/* Lo que queda del lavado de la referencia: un velo de pesca en el borde
          de arriba, apagándose antes de la mitad. Nada de manchas de acuarela
          detrás de todo — eso ya se sacó del sitio una vez. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[clamp(220px,38vh,480px)] bg-[linear-gradient(184deg,#FBF0DE_0%,#FDF7EC_26%,#FFFFFF00_72%)]"
      />

      <div className="relative z-10 flex min-h-[72vh] flex-col px-6 pt-10 sm:px-8 lg:min-h-[min(92vh,900px)] lg:px-12 lg:pt-12">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, ease }}
          className="rotulo"
        >
          Orquídeas Phalaenopsis
        </motion.p>

        {/* Sin ancho máximo y sin caja: el titular sangra de borde a borde y se
            deja cruzar por las varas. */}
        <motion.h1
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease }}
          className="display mb-[9vh] mt-[2vh] flex flex-col justify-between text-[clamp(3.3rem,12.6vw,145px)] leading-[0.88] text-ink-900 lg:mb-[10vh] lg:mt-auto lg:block lg:text-[clamp(2.9rem,9vw,150px)] lg:leading-[0.94]"
        >
          <span className="block text-left">Las flores más lindas</span>
          <em className="mt-[27vh] block text-right lg:mt-0">están <br className="lg:hidden" />aquí.</em>
        </motion.h1>
      </div>

      {/* El espécimen, por delante del texto. Sin marco, sin sombra y sin
          recuadro: apoyado sobre el papel, saliéndose por abajo y mordiendo el
          titular. */}
      <motion.div
        initial={{ opacity: 0, scale: 1.015 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.1, ease }}
        className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex justify-center"
      >
        <img
          src="/hero/orquideas-herbario.webp"
          alt="Cuatro orquídeas Phalaenopsis en maceta: amarilla, fucsia, crema con líneas y rosada"
          className="w-[146%] max-w-none translate-y-[3%] select-none sm:w-[124%] lg:w-[80%] lg:translate-y-[7%] xl:w-[74%]"
          width={1314}
          height={857}
          fetchPriority="high"
        />
      </motion.div>
    </section>

    {/* El pie del cartel: la letra chica, los enlaces y los tres datos. Va en su
        propia banda con filete arriba, no encima de la foto. */}
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: 0.2, ease }}
      className="relative z-30 border-t border-border bg-background px-6 py-8 sm:px-8 lg:px-12"
    >
      <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-16">
        <div className="flex flex-wrap items-start gap-x-10 gap-y-4">
          <Link to="/catalogo?cat=orquideas" className={enlace}>
            Ver las orquídeas <span aria-hidden="true">→</span>
          </Link>
          <a
            href={CONTACTO.whatsapp.href}
            target="_blank"
            rel="noopener noreferrer"
            className={enlace}
          >
            Escribir por WhatsApp <span aria-hidden="true">→</span>
          </a>
        </div>

        {/* Tres columnas también en móvil: apilados eran tres bloques y media
            pantalla de texto entre el cartel y las fotos. */}
        <dl className="grid grid-cols-3 gap-x-5 gap-y-5 sm:gap-x-10 lg:justify-items-end lg:text-right">
          {DATOS.map((d) => (
            <div key={d.valor}>
              <dt className="display text-[15px] leading-snug text-ink-900 sm:text-[19px]">{d.valor}</dt>
              <dd className="mt-1 text-[9px] font-medium uppercase leading-tight tracking-[0.16em] text-ink-500 sm:mt-1.5 sm:text-[11px] sm:tracking-[0.18em]">
                {d.nota}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </motion.div>
  </>
);
