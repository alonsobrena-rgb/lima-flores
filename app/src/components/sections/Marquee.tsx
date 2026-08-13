// Marquee de especies — loop infinito (dos copias, translateX -50%).
//
// Era un panel `frost`: fondo translúcido con blur y sombra interior, pensado
// para flotar sobre el wash de acuarela que el sitio ya no tiene. Sobre blanco
// total, un panel esmerilado es un rectángulo gris sin motivo. Queda la tira
// desnuda entre dos filetes, que es lo que la sección siempre quiso ser.
const flowers = ['Phalaenopsis', 'Hortensias', 'Claveles', 'Girasoles', 'Eucalipto'];

export const Marquee = () => {
  const items = [...flowers, ...flowers];
  return (
    <div aria-hidden className="overflow-hidden border-y border-border bg-background py-6">
      <div className="flex w-max animate-marquee gap-0">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center">
            {items.map((f, i) => (
              <span
                key={half + '-' + i}
                className="display flex items-center text-[26px] text-ink-400 md:text-[32px]"
              >
                <span className="px-8">{f}</span>
                <span className="h-1 w-1 shrink-0 rounded-full bg-rosa-300" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
