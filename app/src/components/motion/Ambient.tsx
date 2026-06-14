// Fondo ambiental floral — vive una sola vez detrás de todo (fixed, z-0).
// 3 capas: manchas de acuarela que respiran + lluvia sutil de pétalos +
// grano de papel. Todo transform/opacity (GPU), oculto con reduced-motion.
// La densidad se adapta a la ruta: 'rich' en páginas de contenido, 'soft'
// (sin pétalos) en flujos de formulario. Marca: ivory + rosa/pesca/verde/blush.
import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

// Grano de papel: feTurbulence en data-URI, muy tenue. Da textura editorial.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Pétalo (teardrop suave) y hoja, como SVG inline para colorear con currentColor.
const Petal = ({ leaf = false }: { leaf?: boolean }) =>
  leaf ? (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor" aria-hidden="true">
      <path d="M21 3C11 4 4 11 3 21c10-1 17-8 18-18Z" opacity="0.9" />
      <path d="M7 17 17 7" stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" fill="none" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" className="h-full w-full" fill="currentColor" aria-hidden="true">
      <path d="M12 1c5 4 6.5 9 5 14.5C15.6 20.5 13.8 23 12 23S8.4 20.5 7 15.5C5.5 10 7 5 12 1Z" />
    </svg>
  );

const PETAL_COLORS = ['#E7AFC2', '#D584A1', '#F0D9B5', '#E7B8C6', '#C9A8BC'];
const LEAF_COLOR = '#B6C2A7';

type Variant = 'rich' | 'soft' | 'none';

function makePetals(count: number) {
  // Pseudo-aleatorio determinista (no se baraja entre renders).
  let s = 7;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return Array.from({ length: count }, (_, i) => {
    const leaf = rnd() > 0.78;
    const size = 10 + rnd() * 14;
    const dur = 20 + rnd() * 18;
    return {
      i,
      leaf,
      size,
      left: rnd() * 100,
      dur,
      delay: -rnd() * dur, // negativo → ya en vuelo al cargar
      drift: (rnd() * 2 - 1) * 120,
      spin: (rnd() * 2 - 1) * 320,
      opacity: 0.28 + rnd() * 0.34,
      color: leaf ? LEAF_COLOR : PETAL_COLORS[(rnd() * PETAL_COLORS.length) | 0],
    };
  });
}

export const Ambient = () => {
  const { pathname } = useLocation();
  const variant: Variant =
    // /suscripcion y /catalogo traen su propio fondo (carretilla de Milán) → sin Ambient.
    (pathname.startsWith('/admin') || pathname.startsWith('/suscripcion') || pathname.startsWith('/catalogo')) ? 'none'
    : (pathname.startsWith('/checkout') || pathname.startsWith('/confirmacion')) ? 'soft'
    : 'rich';

  const petals = useMemo(() => makePetals(16), []);
  if (variant === 'none') return null;
  const washA = variant === 'rich' ? 0.5 : 0.32;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      {/* Base ivory cálida (asegura color aun si el body cambia) */}
      <div className="absolute inset-0 bg-ivory-100" />

      {/* Manchas de acuarela que respiran lento */}
      <div
        className="lf-wash"
        style={{ top: '-12%', left: '-8%', width: '46vw', height: '46vw', background: '#E7B8C6', opacity: washA, animation: 'lf-wash-a 34s ease-in-out infinite' }}
      />
      <div
        className="lf-wash"
        style={{ top: '28%', right: '-12%', width: '50vw', height: '50vw', background: '#F0D9B5', opacity: washA * 0.9, animation: 'lf-wash-b 42s ease-in-out infinite' }}
      />
      <div
        className="lf-wash"
        style={{ bottom: '-18%', left: '20%', width: '44vw', height: '44vw', background: '#D9E0CE', opacity: washA * 0.85, animation: 'lf-wash-c 38s ease-in-out infinite' }}
      />
      {/* Toque rosa muy puntual (un solo acento, según marca — usado con mesura) */}
      <div
        className="lf-wash"
        style={{ top: '58%', left: '6%', width: '20vw', height: '20vw', background: '#D584A1', opacity: washA * 0.26, animation: 'lf-wash-a 46s ease-in-out infinite' }}
      />

      {/* Flores grandes y tenues asomando en las esquinas (lectura "fondo de
          flores" sin recargar). Derivan muy lento. Solo variante rica + desktop. */}
      {variant === 'rich' && (
        <div className="hidden lg:block">
          <motion.img
            src="/bloom/bloom-ramo-de-flores-vintage.png" alt=""
            animate={{ y: [0, -22, 0], rotate: [0, 2.5, 0] }}
            transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -left-24 -top-20 w-[34vw] max-w-[520px] opacity-[0.12] blur-[1px] saturate-[0.85]"
          />
          <motion.img
            src="/bloom/bloom-orquidea-amarilla-centro-fucsia.png" alt=""
            animate={{ y: [0, 26, 0], rotate: [0, -3, 0] }}
            transition={{ duration: 32, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -bottom-28 -right-20 w-[30vw] max-w-[460px] opacity-[0.12] blur-[1px] saturate-[0.85]"
          />
        </div>
      )}

      {/* Lluvia de pétalos (solo variante rica) */}
      {variant === 'rich' && (
        <div className="absolute inset-0">
          {petals.map((p) => (
            <span
              key={p.i}
              className="lf-petal"
              style={{
                left: `${p.left}%`,
                width: p.size,
                height: p.size * 1.25,
                color: p.color,
                animationDuration: `${p.dur}s`,
                animationDelay: `${p.delay}s`,
                ['--petal-drift' as string]: `${p.drift}px`,
                ['--petal-spin' as string]: `${p.spin}deg`,
                ['--petal-opacity' as string]: p.opacity,
              }}
            >
              <Petal leaf={p.leaf} />
            </span>
          ))}
        </div>
      )}

      {/* Grano de papel + viñeta cálida para dar profundidad */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 0%, transparent 55%, rgba(42,38,35,0.05) 100%)' }} />
    </div>
  );
};
