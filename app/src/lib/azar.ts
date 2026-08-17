/**
 * El barajado de la portada, en un solo sitio.
 *
 * Dos secciones muestran productos al azar —la tira que se arrastra y la grilla
 * de abajo— y si cada una echara su propio azar, el mismo ramo saldría dos veces
 * en la misma pantalla. Acá se baraja **una vez por visita** y cada sección se
 * lleva su tramo: la tira los primeros, la grilla los que siguen.
 *
 * La semilla vive en el módulo, no en un estado de React: así el orden no cambia
 * al volver a montar una sección (abrir el carrito, cambiar de ruta y volver),
 * pero sí en la siguiente visita, que es lo que se pedía.
 */
const SEMILLA = Math.floor(Math.random() * 233280);

/** Baraja una copia de la lista con un generador sembrado, sin tocar el original. */
export function barajar<T>(lista: readonly T[], semilla = SEMILLA): T[] {
  let x = semilla;
  const azar = () => {
    x = (x * 9301 + 49297) % 233280;
    return x / 233280;
  };
  return lista
    .map((v) => ({ v, k: azar() }))
    .sort((a, b) => a.k - b.k)
    .map(({ v }) => v);
}
