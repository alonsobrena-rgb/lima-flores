import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { AddToCart } from '@/components/AddToCart';
import { useCategories } from '@/lib/categories';
import { money, useProducts } from '@/lib/cart';

// Rangos de precio (filtro). Se combinan con la categoría; ambos viven en la URL.
const PRICE_RANGES = [
  { key: 'all', label: 'Cualquier precio', test: (_n: number) => true },
  { key: 'u150', label: 'Hasta S/150', test: (n: number) => n <= 150 },
  { key: '150-250', label: 'S/150 – 250', test: (n: number) => n > 150 && n <= 250 },
  { key: '250-350', label: 'S/250 – 350', test: (n: number) => n > 250 && n <= 350 },
  { key: 'o350', label: 'Más de S/350', test: (n: number) => n > 350 },
];

/** Cierra el panel al hacer clic afuera o al apretar Escape. */
function useCerrarAlSalir(abierto: boolean, cerrar: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const enDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cerrar();
    };
    const enTecla = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', enDoc);
    document.addEventListener('keydown', enTecla);
    return () => {
      document.removeEventListener('mousedown', enDoc);
      document.removeEventListener('keydown', enTecla);
    };
  }, [abierto, cerrar]);
  return ref;
}

const disparador =
  'flex items-center gap-2 rounded-full border border-ink-900/15 bg-ivory-50/80 px-4 py-1.5 ' +
  'text-[12px] font-medium tracking-[0.03em] text-ink-900 transition-colors hover:border-ink-900/40';

const Chevron = ({ abierto }: { abierto: boolean }) => (
  <svg className={`h-3.5 w-3.5 transition-transform ${abierto ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
);

const Tilde = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-3 w-3"><path d="M20 6 9 17l-5-5" /></svg>
);

/**
 * Categorías como desplegable, no como fila de píldoras.
 *
 * Ocho categorías en píldoras eran tres filas envueltas —media pantalla de
 * móvil en botones antes de la primera flor—, y en una sola fila deslizable las
 * de la derecha quedaban escondidas: el filtro no se puede leer de un vistazo si
 * hay que arrastrarlo. Acá el disparador ocupa una línea y el panel las muestra
 * **todas a la vez**, en dos columnas y sin scroll, con su conteo al lado.
 *
 * El botón «Varias» cambia el modo del panel sin cambiar de control:
 *
 * - **Apagado** (lo normal): elegir una categoría reemplaza la anterior y cierra
 *   el panel. Es lo que hace el 90 % de la gente y no debería costar dos toques.
 * - **Encendido**: cada categoría se marca o se desmarca y el panel se queda
 *   abierto, para armar la combinación de una sentada.
 *
 * Se enciende solo si la URL ya trae más de una — así un enlace compartido con
 * dos categorías abre el panel en el modo en que se armó.
 */
function CategoryDropdown({
  categorias, seleccion, onChange,
}: {
  categorias: { slug: string; label: string; count?: number }[];
  seleccion: string[];
  onChange: (slugs: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [varias, setVarias] = useState(seleccion.length > 1);
  const ref = useCerrarAlSalir(open, () => setOpen(false));
  const elegidas = new Set(seleccion);

  const etiqueta =
    seleccion.length === 0
      ? 'Todos'
      : seleccion.length === 1
        ? categorias.find((c) => c.slug === seleccion[0])?.label ?? 'Todos'
        : `${seleccion.length} categorías`;

  const tocar = (slug: string) => {
    if (!varias) { onChange([slug]); setOpen(false); return; }
    onChange(elegidas.has(slug) ? seleccion.filter((s) => s !== slug) : [...seleccion, slug]);
  };

  return (
    /* `static` a propósito: el panel se posiciona contra la fila de filtros, no
       contra el botón — ver el comentario de la fila. */
    <div ref={ref} className="static">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={disparador}
      >
        {etiqueta}
        <Chevron abierto={open} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-30 mt-2 w-[min(92vw,440px)] rounded-md border border-ink-900/10 bg-ivory-50 p-1.5 shadow-[0_24px_60px_-28px_rgba(42,38,35,0.6)]"
        >
          <div className="flex items-center justify-between gap-2 px-2 pb-2 pt-1">
            <button
              onClick={() => { onChange([]); if (!varias) setOpen(false); }}
              className={`rounded px-1.5 py-1 text-[13px] transition-colors ${
                seleccion.length === 0 ? 'font-medium text-rosa-500' : 'text-ink-700 hover:text-ink-900'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                const siguiente = !varias;
                setVarias(siguiente);
                // Al apagarlo, una sola combinación no puede sobrevivir: se queda
                // la primera, que es la que el disparador ya venía mostrando.
                if (!siguiente && seleccion.length > 1) onChange([seleccion[0]]);
              }}
              aria-pressed={varias}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] transition-colors ${
                varias
                  ? 'border-rosa-500 bg-rosa-500 text-ivory-50'
                  : 'border-ink-900/15 text-ink-500 hover:border-ink-900/40 hover:text-ink-900'
              }`}
            >
              {varias && <Tilde />}
              Varias
            </button>
          </div>

          <div className="grid grid-cols-2 gap-0.5 border-t border-ink-900/10 pt-1.5">
            {categorias.map((c) => {
              const activa = elegidas.has(c.slug);
              return (
                <button
                  key={c.slug}
                  role={varias ? 'menuitemcheckbox' : 'menuitem'}
                  aria-checked={varias ? activa : undefined}
                  onClick={() => tocar(c.slug)}
                  className={`flex items-center justify-between gap-1.5 rounded px-2.5 py-2 text-left text-[13px] leading-snug transition-colors ${
                    activa ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:bg-ink-900/5'
                  }`}
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {varias && (
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border ${
                          activa ? 'border-ivory-50 bg-ivory-50 text-rosa-500' : 'border-ink-900/25'
                        }`}
                      >
                        {activa && <Tilde />}
                      </span>
                    )}
                    <span className="truncate">{c.label}</span>
                  </span>
                  {c.count ? (
                    <span className={`shrink-0 text-[10px] tabular-nums ${activa ? 'text-ivory-50/70' : 'text-ink-500'}`}>
                      {c.count}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Filtro de precio como dropdown: las opciones predefinidas + un campo para
// escribir un precio máximo personalizado (se guarda en la URL como `maxNNN`).
function PriceDropdown({ value, label, onSelect }: { value: string; label: string; onSelect: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const m = /^max(\d+)$/.exec(value);
    if (m) setCustom(m[1]);
  }, [value]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const applyCustom = () => {
    const n = parseInt(custom, 10);
    if (Number.isFinite(n) && n > 0) { onSelect(`max${n}`); setOpen(false); }
  };
  return (
    <div ref={ref} className="static">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={disparador}
      >
        {label}
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-md border border-ink-900/10 bg-ivory-50 p-1.5 shadow-[0_24px_60px_-28px_rgba(42,38,35,0.6)]">
          {PRICE_RANGES.map((r) => (
            <button
              key={r.key} onClick={() => { onSelect(r.key); setOpen(false); }}
              className={`block w-full rounded px-3 py-2 text-left text-[13px] transition-colors ${value === r.key ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:bg-ink-900/5'}`}
            >
              {r.label}
            </button>
          ))}
          <div className="mt-1.5 border-t border-ink-900/10 px-2 pb-1 pt-2.5">
            <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-ink-500">Precio máximo</label>
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[13px] text-ink-500">S/</span>
              <input
                type="number" min="1" inputMode="numeric" value={custom}
                onChange={(e) => setCustom(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') applyCustom(); }}
                placeholder="Ej. 300"
                className="w-full rounded border border-ink-900/15 bg-white px-2 py-1.5 text-[13px] text-ink-900 outline-none focus:border-rosa-500"
              />
              <button onClick={applyCustom} className="shrink-0 rounded bg-ink-900 px-3 py-1.5 text-[12px] font-medium text-ivory-50 transition-colors hover:bg-rosa-500">Aplicar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Catalogo() {
  const { products } = useProducts();
  const { categories } = useCategories();
  // Filtros en la URL (?cat=ramos,arreglos&precio=150-250) — compartible y
  // navegable con back/forward. Las categorías llegan así desde la sección del
  // home, con un solo slug; varias van separadas por coma. Se filtran contra las
  // categorías reales para que una URL vieja o rota no deje el catálogo vacío.
  const [params, setParams] = useSearchParams();
  const validas = new Set(categories.map((c) => c.slug));
  const sel = (params.get('cat') || '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => validas.has(s));
  const rawPrice = params.get('precio') || 'all';
  const isPreset = PRICE_RANGES.some((r) => r.key === rawPrice);
  const customMax = !isPreset ? /^max(\d+)$/.exec(rawPrice) : null;
  const activePrice = isPreset ? rawPrice : customMax ? rawPrice : 'all';
  const priceTest = (n: number) =>
    customMax ? n <= Number(customMax[1]) : (PRICE_RANGES.find((r) => r.key === activePrice) ?? PRICE_RANGES[0]).test(n);
  const priceLabel = customMax ? `Hasta S/${customMax[1]}` : (PRICE_RANGES.find((r) => r.key === activePrice) ?? PRICE_RANGES[0]).label;
  const setParam = (key: string, val: string) => {
    const next = new URLSearchParams(params);
    if (!val || val === 'all') next.delete(key); else next.set(key, val);
    setParams(next, { replace: true });
  };
  const setCats = (slugs: string[]) => setParam('cat', slugs.join(','));
  const setPrice = (key: string) => setParam('precio', key);
  const elegidas = new Set(sel);
  const list = products.filter(
    (p) => (elegidas.size === 0 || elegidas.has(p.category)) && priceTest(Number(p.price) || 0)
  );

  // Blanco y aire. Antes había una foto de carretilla fija detrás de toda la
  // página, con velo y desenfoque, y el título dentro de un panel esmerilado para
  // poder leerse encima: dos parches para un fondo que competía con las fotos de
  // producto, que son lo que tiene que mandar.
  return (
    <div className="relative min-h-screen bg-background">
      <div className="relative">
      <SiteHeader />
      {/* En móvil esta cabecera ocupaba la pantalla entera: al entrar al catálogo
          no se veía ni una foto, había que hacer scroll para llegar al producto.
          Se achica todo lo que sobra —el aire de arriba, el titular, el conteo—
          y las ocho categorías, que eran tres filas de píldoras, se recogen en un
          desplegable. De md para arriba se achica menos: ahí sobraba pantalla. */}
      <header className="relative z-30 mx-auto max-w-7xl px-6 pb-6 pt-7 md:px-12 md:pb-12 md:pt-24">
        {/* Título y producto entrelazados, como en la portada: el Florero Forti
            calado —la foto real del catálogo sin el fondo del estudio— pasa por
            delante del titular. En móvil la cabecera va sin imagen: ahí lo que
            hace falta es llegar a la grilla, no otra flor antes de las de verdad. */}
        <div className="relative">
          <div className="relative z-10 max-w-3xl lg:max-w-[64%]">
            <span className="rotulo">El catálogo</span>
            <h1 className="display mt-2.5 text-[2rem] text-ink-900 sm:text-[2.75rem] md:mt-4 md:text-[4.5rem]">
              Flores de estación, <em>frescas y del día.</em>
            </h1>
          </div>
          <img
            src="/calados/florero-forti.webp"
            alt="Florero Forti: ramo de girasoles, rosas blancas y eucalipto en papel verde"
            className="pointer-events-none absolute right-0 top-0 z-20 hidden h-[34vh] max-h-[360px] w-auto select-none lg:-mr-12 lg:block"
          />
        </div>

        {/* Los dos filtros en una línea, cada uno con su panel. El conteo va al
            final: era un párrafo suelto y es un dato de una línea. */}
        <div className="relative mt-5 flex flex-wrap items-center gap-x-2.5 gap-y-3 border-t border-border pt-5 md:mt-10 md:pt-8">
          {/* Rótulo y disparador van juntos: sueltos, al envolverse quedaba
              «Precio» al final de una línea y su botón al principio de la otra. */}
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">Categoría</span>
            <CategoryDropdown categorias={categories} seleccion={sel} onChange={setCats} />
          </div>
          <div className="flex items-center gap-2.5 md:ml-2">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">Precio</span>
            <PriceDropdown value={activePrice} label={priceLabel} onSelect={setPrice} />
          </div>
          {/* El conteo iba pegado al filo derecho y ahí es justo donde cuelga el
              calado: se leía «…ACIONES» tapado por el ramo. Ahora va detrás de los
              filtros, con un respiro. */}
          <span className="ml-auto text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500 lg:ml-8">
            {list.length} {list.length === 1 ? 'creación' : 'creaciones'}
          </span>
        </div>
      </header>

      {/* La grilla lleva su propio velo ivory (se desvanece desde el header) para
          que las etiquetas se lean nítidas; la carretilla asoma arriba y queda
          como presencia cálida y suave detrás de los productos. */}
      <div className="relative">
        <section className="relative mx-auto max-w-7xl px-6 pb-24 md:px-12 md:pb-32">
        <div className="grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3 md:gap-x-7 lg:grid-cols-4">
          {list.map((p, i) => (
            <motion.div
              key={p.id} layout
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, delay: (i % 8) * 0.04 }}
              className="group"
            >
              <Link to={`/producto/${p.id}`} className="block">
                {/* Filete en vez de sombra: casi todas las fotos son de estudio
                    sobre blanco, así que sin filete el producto flota sin borde
                    y la tarjeta no existe. */}
                <div className="relative overflow-hidden rounded-md bg-secondary ring-1 ring-border transition-all duration-500 group-hover:ring-ink-900/25">
                  <img src={p.image} alt={p.name} className="aspect-square w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                </div>
              </Link>
              <div className="mt-3.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-foreground/45">{p.categoryLabel}</p>
                <div className="mt-1 flex items-start justify-between gap-2">
                  <Link to={`/producto/${p.id}`} className="font-display text-[17px] font-medium leading-tight text-ink-900 transition-colors hover:text-rosa-500">{p.name}</Link>
                  <span className="shrink-0 font-display text-xl italic text-ink-900">{money(p.price)}</span>
                </div>
                <AddToCart
                  id={p.id}
                  className="mt-3.5 w-full rounded-pill border border-border py-2.5 text-[12px] font-medium uppercase tracking-[0.16em] text-ink-900 transition-colors hover:border-rosa-500 hover:bg-rosa-500 hover:text-white data-[done=true]:border-verde-700"
                />
              </div>
            </motion.div>
          ))}
        </div>
        {list.length === 0 && (
          <div className="py-24 text-center">
            <p className="font-display text-2xl italic text-ink-700">No hay creaciones con esos filtros.</p>
            <button onClick={() => setParams({}, { replace: true })} className="mt-4 text-[13px] font-medium uppercase tracking-[0.14em] text-rosa-500 hover:text-rosa-600">Limpiar filtros</button>
          </div>
        )}
      </section>
      </div>
      <SiteFooter />
      </div>
    </div>
  );
}
