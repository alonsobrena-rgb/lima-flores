import { Link } from 'react-router-dom';
import { useCategories } from '@/lib/categories';
import { MediosDePago } from '@/components/MediosDePago';
import { CONTACTO, REDES } from '@/lib/tienda';

// Los iconos van dibujados acá y no como imágenes: son dos, pesan nada, y
// heredan el color del texto sin pedir un archivo por estado.
const IconoInstagram = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" className="h-[18px] w-[18px]">
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);
const IconoFacebook = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true" className="h-[18px] w-[18px]">
    <path d="M14.5 8.5h2.2V5.6h-2.6c-2.2 0-3.6 1.4-3.6 3.7v1.9H8.3v3h2.2V21h3.1v-6.8h2.3l.4-3h-2.7v-1.5c0-.8.3-1.2.9-1.2Z" />
  </svg>
);
const ICONOS: Record<string, React.ComponentType> = { Instagram: IconoInstagram, Facebook: IconoFacebook };

const Rotulo = ({ children }: { children: React.ReactNode }) => (
  <h4 className="text-[11px] font-medium uppercase tracking-[0.24em] text-ivory-100/45">{children}</h4>
);

export const SiteFooter = () => {
  const { categories } = useCategories();

  return (
    <footer className="relative overflow-hidden bg-ink-900 px-6 pb-10 pt-20 text-ivory-100 md:px-12 md:pt-28">
      <div className="relative mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-[1.5fr_1fr_1.3fr] lg:gap-16">
          <div>
            {/* Sobre fondo oscuro el logotipo va en blanco plano, no la acuarela
                — brand-logo.html del sistema. */}
            <img
              src="/assets/logo.png"
              alt="Lima Flores"
              className="h-20 w-auto brightness-0 invert"
            />
            <p className="mt-6 max-w-xs text-[14.5px] leading-relaxed text-ivory-100/65">
              Atelier botánico en Miraflores. Cada arreglo se arma a mano, con flores
              frescas de la semana, desde 2017.
            </p>
          </div>

          <nav aria-label="Catálogo">
            <Rotulo>Catálogo</Rotulo>
            <ul className="mt-5 space-y-3">
              {categories.map((c) => (
                <li key={c.slug}>
                  <Link
                    to={`/catalogo?cat=${c.slug}`}
                    className="link-underline text-[14.5px] text-ivory-100/75 transition-colors hover:text-ivory-50"
                  >
                    {c.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Contacto y redes juntos: quien busca cómo escribirnos no distingue
              entre un WhatsApp y un Instagram, busca por dónde llegar. */}
          <div>
            <Rotulo>Contacto</Rotulo>
            <ul className="mt-5 space-y-3">
              <li>
                <a href={CONTACTO.whatsapp.href} target="_blank" rel="noopener noreferrer"
                   className="link-underline text-[14.5px] text-ivory-100/75 transition-colors hover:text-ivory-50">
                  {CONTACTO.whatsapp.label}
                </a>
              </li>
              <li>
                <a href={CONTACTO.correo.href}
                   className="link-underline text-[14.5px] text-ivory-100/75 transition-colors hover:text-ivory-50">
                  {CONTACTO.correo.label}
                </a>
              </li>
              <li className="text-[14.5px] text-ivory-100/55">{CONTACTO.lugar}</li>
            </ul>

            <div className="mt-7 flex flex-wrap gap-2.5">
              {REDES.map((r) => {
                const Icono = ICONOS[r.label];
                return (
                  <a
                    key={r.label}
                    href={r.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${r.label} · ${r.usuario}`}
                    className="press inline-flex items-center gap-2.5 rounded-pill border border-ivory-100/20 px-4 py-2.5 text-[13px] text-ivory-100/80 transition-colors hover:border-ivory-100/45 hover:text-ivory-50"
                  >
                    {Icono ? <Icono /> : null}
                    {r.usuario}
                  </a>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-16 border-t border-ivory-100/15 pt-8">
          <Rotulo>Medios de pago</Rotulo>
          <div className="mt-4 text-ivory-100/70">
            <MediosDePago variante="linea" />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-ivory-100/15 pt-6 text-[12px] text-ivory-100/45 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Lima Flores · Todos los derechos reservados</span>
          <div className="flex items-center gap-6">
            <span>Hecho a mano en Lima</span>
            {/* La puerta del panel, siempre en el pie. Va discreta —del tamaño de
                la letra chica y en el gris del pie— porque es para la casa, no
                para el cliente: quien no tiene clave se topa con el login. */}
            <Link
              to="/admin"
              className="press rounded-pill border border-ivory-100/25 px-4 py-2 text-[11px] font-medium uppercase tracking-[0.18em] text-ivory-100/70 transition-colors hover:border-ivory-100/60 hover:text-ivory-50"
            >
              Panel
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};
