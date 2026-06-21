// Fondo de video de la landing: el clip (mujer recibiendo flores) vive FIJO
// detrás de toda la página y se mantiene hasta abajo. En desktop se "scrubea"
// con el scroll en la primera parte (la animación arranca en el hero) y luego
// retiene el último frame como telón. En móvil / reduced-motion va en loop.
// Lleva un velo ivory para que el contenido de las secciones se lea.
import { useRef, useState, useEffect } from 'react';

interface Props {
  videoSrc: string;
  poster: string;
}

export const HomeVideoBg = ({ videoSrc, poster }: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scrub, setScrub] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = window.matchMedia('(pointer: fine)').matches;
    setScrub(!reduce && fine && window.innerWidth >= 768);
  }, []);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (!scrub) {
      const pr = v.play();
      if (pr && pr.catch) pr.catch(() => {});
      return;
    }
    v.pause();
    let raf = 0;
    const apply = () => {
      raf = 0;
      if (!v.duration || Number.isNaN(v.duration)) return;
      // La animación completa en ~1.35 pantallas; luego retiene el último frame.
      const dist = Math.max(1, window.innerHeight * 1.35);
      const t = Math.max(0, Math.min(v.duration - 0.05, (window.scrollY / dist) * v.duration));
      if (Math.abs(v.currentTime - t) > 0.015) v.currentTime = t;
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(apply); };
    apply();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [scrub]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full object-cover"
        poster={poster}
        muted
        playsInline
        preload="auto"
        loop={!scrub}
        autoPlay={!scrub}
      >
        <source src={videoSrc} type="video/mp4" />
      </video>
      {/* Velo ivory ligero: el hero queda vívido. La legibilidad del resto la
          refuerza el wash de las secciones (ver Home), no este velo. */}
      <div className="absolute inset-0 bg-gradient-to-b from-ivory-100/28 via-ivory-100/34 to-ivory-100/40" />
      {/* Grano sutil para ligar con la estética editorial */}
      <div className="absolute inset-0 opacity-[0.04] mix-blend-multiply" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")", backgroundSize: '160px 160px' }} />
    </div>
  );
};
