// "N maneras de regalar belleza" — categorías (vivas, ordenables) → /catalogo?cat=slug.
import { Link } from 'react-router-dom';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';
import { useCategories } from '@/lib/categories';
import { useProducts } from '@/lib/cart';
import { Seccion, Encabezado } from './Seccion';

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
 * El nombre de la categoría bajaba de la foto.
 *
 * Iba encima, en blanco, sobre un degradado negro al 60 % que se comía el tercio
 * inferior de la imagen: la foto de producto —que es lo que tiene que mandar—
 * quedaba oscurecida para poder leer dos palabras. Ahora el nombre va debajo,
 * sobre el blanco, y la foto se ve entera. De paso desaparece el único negro de
 * la portada que no era tipografía.
 */
const Ficha = ({ label, nota, children }: { label: string; nota: string; children: React.ReactNode }) => (
  <>
    <div className="overflow-hidden bg-secondary">{children}</div>
    <div className="mt-4 border-t border-border pt-3.5">
      <h3 className="display text-[22px] leading-snug text-ink-900">{label}</h3>
      <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">{nota}</p>
    </div>
  </>
);

const NUM = ['', 'Una', 'Dos', 'Tres', 'Cuatro', 'Cinco', 'Seis', 'Siete', 'Ocho', 'Nueve', 'Diez', 'Once', 'Doce'];

export const Categories = () => {
  const { categories } = useCategories();
  const { products } = useProducts();
  const coverFor = (slug: string) => COVERS[slug] || products.find((p) => p.category === slug)?.image || COVERS.arreglos;
  const word = NUM[categories.length] || String(categories.length);

  return (
    <Seccion>
      <Encabezado
        rotulo="Categorías"
        titulo={<>{word} maneras<br />de regalar <em>belleza.</em></>}
        enlace={{ texto: 'Ver todo el catálogo', a: '/catalogo' }}
        className="mb-16"
      />

      <Stagger
        key={categories.map((c) => c.slug).join(',')}
        className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4 md:gap-x-8"
      >
        {categories.map((c) => (
          <StaggerItem key={c.slug}>
            <Link to={`/catalogo?cat=${c.slug}`} className="group block">
              {(c.count ?? 0) === 0 && !COVERS[c.slug] ? (
                /* Una categoría recién creada no tiene productos ni portada. Antes
                   caía a la foto de Arreglos, así que «Tierras y sustratos» se
                   anunciaba con una caja de rosas: la tarjeta prometía algo que no
                   existe. Mientras no haya producto, la tarjeta lo dice. */
                <Ficha label={c.label} nota="Muy pronto">
                  <div className="aspect-[3/4] w-full bg-secondary" />
                </Ficha>
              ) : (
                <Ficha
                  label={c.label}
                  /* El conteo solo si lo hay: sin base de datos la API devuelve 0 y
                     «0 diseños» debajo de una foto llena de rosas se lee como un
                     error, no como un dato. */
                  nota={c.count ? `${c.count} ${c.count === 1 ? 'diseño' : 'diseños'}` : 'Ver categoría'}
                >
                  <img
                    src={coverFor(c.slug)}
                    alt={c.label}
                    loading="lazy"
                    className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                  />
                </Ficha>
              )}
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </Seccion>
  );
};
