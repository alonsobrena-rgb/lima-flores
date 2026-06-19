// Lima Flores · Motion (motion.dev) — animaciones sutiles / editoriales sobre el DOM (sin React).
// "Framer Motion" en vanilla: mismo motor de springs y scroll, cero build.
//
// Pase 1: parallax suave de las flores flotantes. Cada flor se desplaza apenas en Y
// mientras su sección cruza el viewport → sensación "flotando", elegante, no mareadora.
// Respeta prefers-reduced-motion y solo corre en desktop (las flores se ocultan ≤900px).
import { scroll, animate } from 'https://cdn.jsdelivr.net/npm/motion@11/+esm';

const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const isWide = matchMedia('(min-width: 901px)').matches;

if (!prefersReduced && isWide) {
  // Liga una animación translateY al progreso de scroll de la sección que contiene la flor.
  const parallax = (el, range) => {
    scroll(
      animate(el, { y: [range, -range] }, { ease: 'linear' }),
      { target: el, offset: ['start end', 'end start'] }
    );
  };

  // Hero: la orquídea se mueve apenas (más sutil que el resto).
  document.querySelectorAll('.lf-hero__orchids').forEach((el) => parallax(el, 16));

  // Flores de sección + manifiesto: rango variado para dar ritmo entre secciones.
  const ranges = [26, 20, 32, 22, 30, 24];
  document.querySelectorAll('.section-bloom, .philosophy__bloom').forEach((el, i) => {
    parallax(el, ranges[i % ranges.length]);
  });
}
