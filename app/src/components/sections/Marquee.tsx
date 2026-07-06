// Marquee de especies — loop infinito (dos copias, translateX -50%).
const flowers = ['Phalaenopsis', 'Hortensias', 'Ranúnculos', 'Eucalipto'];

export const Marquee = () => {
  const items = [...flowers, ...flowers];
  return (
    <div aria-hidden className="frost overflow-hidden border-y border-border/70 py-5">
      <div className="flex w-max animate-marquee gap-0">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center">
            {items.map((f, i) => (
              <span key={half + '-' + i} className="flex items-center font-display text-2xl font-light italic text-ink-900/55 md:text-3xl">
                <span className="px-7">{f}</span>
                <svg className="h-3.5 w-3.5 shrink-0 text-rosa-500/70" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c1.2 2.4 1.2 4.4 0 6 1.6-1.2 3.6-1.2 6 0-2.4 1.2-4.4 1.2-6 0 1.2 1.6 1.2 3.6 0 6-1.2-2.4-1.2-4.4 0-6-1.6 1.2-3.6 1.2-6 0 2.4-1.2 4.4-1.2 6 0-1.2-1.6-1.2-3.6 0-6Z"/><circle cx="12" cy="12" r="1.6"/></svg>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
