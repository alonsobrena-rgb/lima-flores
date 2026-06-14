const col = (title: string, items: { label: string; href: string }[]) => (
  <div>
    <h4 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-ivory-100/50">{title}</h4>
    <ul className="mt-5 space-y-3">
      {items.map((it) => (
        <li key={it.label}>
          <a href={it.href} className="link-underline text-sm text-ivory-100/80 transition-colors hover:text-ivory-50">{it.label}</a>
        </li>
      ))}
    </ul>
  </div>
);

export const SiteFooter = () => (
  <footer className="relative overflow-hidden bg-ink-900 px-6 pb-10 pt-20 text-ivory-100 md:px-12 md:pt-28">
    {/* Bloom tenue asomando en la esquina */}
    <img src="/bloom/bloom-ramo-de-20-tulipanes-de-colores.png" alt="" aria-hidden="true"
         className="pointer-events-none absolute -right-16 -top-10 hidden w-72 opacity-[0.16] saturate-[0.8] md:block" />
    <div className="relative mx-auto max-w-7xl">
      <div className="grid gap-12 md:grid-cols-[2fr_1fr_1.4fr_1fr]">
        <div>
          <p className="font-display text-3xl font-light leading-none">
            Lima <em className="italic text-rosa-300">Flores.</em>
          </p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-ivory-100/70">
            Atelier botánico de Miraflores. Arte hecho a mano con flores de estación desde 2017.
          </p>
        </div>
        {col('Catálogo', [
          { label: 'Ramos', href: '#' },
          { label: 'Arreglos', href: '#' },
          { label: 'Floreros', href: '#' },
          { label: 'Plantas', href: '#' },
        ])}
        {col('Contacto', [
          { label: 'WhatsApp · 999 479 855', href: 'https://wa.me/51999479855' },
          { label: 'hola@limaflores.pe', href: 'mailto:hola@limaflores.pe' },
          { label: 'Miraflores · Lima', href: '#' },
        ])}
        {col('Síguenos', [
          { label: 'Instagram', href: 'https://instagram.com/lima_flores' },
          { label: 'Facebook', href: 'https://facebook.com/limafloresperu' },
        ])}
      </div>

      <div className="mt-16 flex flex-col gap-3 border-t border-ivory-100/15 pt-6 text-[12px] text-ivory-100/50 sm:flex-row sm:items-center sm:justify-between">
        <span>© {new Date().getFullYear()} Lima Flores · Todos los derechos reservados</span>
        <span>Hecho a mano en Lima 🌷</span>
      </div>
    </div>
  </footer>
);
