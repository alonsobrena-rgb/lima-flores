// "N maneras de regalar belleza" — categorías (vivas, ordenables) → /catalogo?cat=slug.
import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { useCategories } from '@/lib/categories';
import { useProducts } from '@/lib/cart';

// Portadas curadas por categoría; para categorías nuevas se usa la imagen del
// primer producto de esa categoría (o una por defecto).
const COVERS: Record<string, string> = {
  orquideas: '/products/orquideas-grandes-de-dos-varas-en-maceta.jpg',
  arreglos: '/products/box-de-luxe.jpg',
  floreros: '/products/florero-de-20-tulipanes-2.jpg',
  ramos: '/products/ramo-de-24-rosas.jpg',
  plantas: '/products/anturios-rojos-en-maceta.jpg',
  funebre: '/products/funebre-corona-eternidad.jpg',
};

/**
 * Una categoría recién creada no tiene productos ni portada. Antes caía a la
 * foto de Arreglos, así que «Tierras y sustratos» se anunciaba con una caja de
 * rosas: la tarjeta prometía algo que no existe. Mientras no haya producto, la
 * tarjeta lo dice — se ve como parte del sistema y no como un hueco roto.
 */
const Proxima = ({ label }: { label: string }) => (
  <div className="flex aspect-[3/4] flex-col justify-end rounded-md bg-secondary p-5 ring-1 ring-inset ring-border">
    <span className="font-display text-2xl font-medium italic leading-tight text-ink-900">{label}</span>
    <span className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-ink-500">Muy pronto</span>
  </div>
);
const NUM = ['', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce'];

export const Categories = () => {
  const { categories } = useCategories();
  const { products } = useProducts();
  const coverFor = (slug: string) => COVERS[slug] || products.find((p) => p.category === slug)?.image || COVERS.arreglos;
  const word = NUM[categories.length] || String(categories.length);

  return (
    <section className="relative bg-transparent px-6 py-24 md:px-12 md:py-32">
      <div className="mx-auto max-w-7xl">
        <header className="mb-14 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <span className="rotulo">No. 03 · Categorías</span>
            <h2 className="display mt-4 text-[2.5rem] text-ink-900 md:text-[3.75rem]">
              {word} maneras<br />de regalar <em>belleza.</em>
            </h2>
          </Reveal>
          <Link to="/catalogo" className="group inline-flex items-center gap-2 whitespace-nowrap text-[13px] font-medium uppercase tracking-[0.18em] text-ink-900">
            Ver todo el catálogo <span className="transition-transform group-hover:translate-x-1">→</span>
          </Link>
        </header>

        <Stagger key={categories.map((c) => c.slug).join(',')} className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
          {categories.map((c) => (
            <StaggerItem key={c.slug}>
              <Link to={`/catalogo?cat=${c.slug}`} className="group block">
                {(c.count ?? 0) === 0 && !COVERS[c.slug] ? (
                  <Proxima label={c.label} />
                ) : (
                  <div className="relative overflow-hidden rounded-md bg-secondary">
                    <img src={coverFor(c.slug)} alt={c.label} className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink-900/60 via-ink-900/5 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <h3 className="font-display text-2xl font-medium italic leading-tight text-white">{c.label}</h3>
                      {/* El conteo solo si lo hay: sin base de datos la API
                          devuelve 0 y «0 diseños» debajo de una foto llena de
                          rosas se lee como un error, no como un dato. */}
                      <p className="mt-1 text-[11px] font-medium uppercase tracking-[0.18em] text-white/75">
                        {c.count ? `${c.count} ${c.count === 1 ? 'diseño' : 'diseños'} ` : 'Ver '}→
                      </p>
                    </div>
                  </div>
                )}
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  );
};
