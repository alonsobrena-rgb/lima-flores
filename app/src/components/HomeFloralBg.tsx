// Fondo floral fijo para toda la landing (detrás de todo, -z-10). Una sola
// imagen generada con Higgsfield (flores clásicas y coloridas) que se mantiene
// mientras se hace scroll → un "mundo floral" cohesivo bajo las secciones.
// El hero la cubre con su propio video; el resto de secciones flotan encima
// con un velo ivory (ver Home) que mantiene la legibilidad sin tapar las flores.

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

interface Props {
  src: string;
}

export const HomeFloralBg = ({ src }: Props) => (
  <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-ivory-100">
    <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" />
    {/* Velo ivory ligero para asentar el color de las flores */}
    <div className="absolute inset-0 bg-ivory-100/20" />
    {/* Grano editorial sutil */}
    <div className="absolute inset-0 opacity-[0.04] mix-blend-multiply" style={{ backgroundImage: GRAIN, backgroundSize: '160px 160px' }} />
  </div>
);
