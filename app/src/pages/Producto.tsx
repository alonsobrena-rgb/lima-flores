import { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { AddToCart } from '@/components/AddToCart';
import { money, useProducts } from '@/lib/cart';

export default function Producto() {
  const { id } = useParams();
  const { products, loading } = useProducts();
  const product = products.find((p) => p.id === id);
  const [qty, setQty] = useState(1);

  // Mientras carga el catálogo desde la API, evitamos el flash de "no existe"
  // (importa para productos creados en el admin que no están en el bundle).
  if (!product && loading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto flex max-w-3xl items-center justify-center px-6 py-32 text-center font-display text-2xl italic text-foreground/50">
          Cargando…
        </div>
        <SiteFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-32 text-center">
          <h1 className="font-display text-4xl text-ink-900">No encontramos ese producto.</h1>
          <Link to="/catalogo" className="text-sm font-medium uppercase tracking-[0.16em] text-rosa-500 hover:text-rosa-600">Volver al catálogo →</Link>
        </div>
        <SiteFooter />
      </div>
    );
  }

  const related = products.filter((p) => p.category === product.category && p.id !== product.id).slice(0, 4);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-6 py-12 md:px-12 md:py-16">
        <nav className="mb-8 text-[12px] uppercase tracking-[0.16em] text-foreground/45">
          <Link to="/catalogo" className="hover:text-foreground">Catálogo</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground/70">{product.categoryLabel}</span>
        </nav>

        <div className="grid gap-10 md:grid-cols-2 md:gap-16">
          <Gallery
            images={('images' in product && product.images?.length ? product.images : [product.image]) as string[]}
            name={product.name}
          />

          <div className="flex flex-col md:sticky md:top-24 md:self-start md:py-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.24em] text-foreground/45">{product.categoryLabel}</p>
            <h1 className="mt-3 font-display text-[2.5rem] font-light leading-[1.04] tracking-tight text-ink-900 md:text-[3.25rem]">{product.name}</h1>
            <p className="mt-5 font-display text-3xl italic text-ink-800">{money(product.price)}</p>
            <p className="mt-6 max-w-md leading-relaxed text-ink-700">{product.description || product.shortDesc}</p>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-full border border-border bg-surface/60">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Menos" className="press px-4 py-3 text-foreground/60 hover:text-foreground">−</button>
                <span className="min-w-[28px] text-center">{qty}</span>
                <button onClick={() => setQty((q) => q + 1)} aria-label="Más" className="press px-4 py-3 text-foreground/60 hover:text-foreground">+</button>
              </div>
              <AddToCart
                id={product.id}
                qty={qty}
                openDrawer
                className="flex-1 bg-rosa-500 px-8 py-4 text-sm font-medium uppercase tracking-[0.18em] text-ivory-50 transition-colors hover:bg-rosa-600"
              >
                Agregar al carrito
              </AddToCart>
            </div>

            <ul className="mt-10 space-y-2.5 border-t border-border pt-6 text-sm text-ink-600">
              <li>· Entrega a domicilio en Lima Metropolitana.</li>
              <li>· Armado a mano con flores frescas de la semana.</li>
              <li>· Incluye tarjeta de dedicatoria sin costo.</li>
            </ul>
          </div>
        </div>

        {related.length > 0 && (
          <section className="mt-24">
            <h2 className="mb-8 font-display text-2xl text-ink-900">También te puede gustar</h2>
            <div className="grid grid-cols-2 gap-x-5 gap-y-8 md:grid-cols-4">
              {related.map((p) => (
                <Link key={p.id} to={`/producto/${p.id}`} className="group block">
                  <div className="overflow-hidden bg-ivory-200">
                    <img src={p.image} alt={p.name} className="aspect-[4/5] w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
                  </div>
                  <h3 className="mt-3 font-display text-base font-medium text-ink-900">{p.name}</h3>
                  <span className="text-sm italic text-ink-600">{money(p.price)}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}

// ─── Galería: imagen principal + miniaturas + lightbox ──────────────────────
function Gallery({ images, name }: { images: string[]; name: string }) {
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState(false);
  const multi = images.length > 1;

  // Si por algún motivo cambia el set de imágenes, vuelve a la primera.
  useEffect(() => { setActive(0); }, [images]);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setZoom(true)}
        aria-label="Ampliar imagen"
        className="group relative block overflow-hidden rounded-sm bg-ivory-200 shadow-[0_30px_70px_-36px_rgba(42,38,35,0.5)] ring-1 ring-black/[0.04]"
      >
        <img src={images[active]} alt={name} className="aspect-[4/5] w-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.03]" />
        <span className="pointer-events-none absolute bottom-3 right-3 rounded-full bg-ink-900/70 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-ivory-50 opacity-0 transition-opacity group-hover:opacity-100">
          {multi ? `Ampliar · ${images.length} fotos` : 'Ampliar'}
        </span>
      </button>

      {multi && (
        <div className="flex flex-wrap gap-2.5">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`Foto ${i + 1}`}
              aria-pressed={i === active}
              className={`h-20 w-20 shrink-0 overflow-hidden bg-ivory-200 transition-all ${
                i === active ? 'ring-2 ring-rosa-500 ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'
              }`}
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <Lightbox images={images} index={active} name={name} onIndex={setActive} onClose={() => setZoom(false)} />
      )}
    </div>
  );
}

// ─── Lightbox modal con teclado (←/→/Esc) ───────────────────────────────────
function Lightbox({
  images, index, name, onIndex, onClose,
}: {
  images: string[]; index: number; name: string;
  onIndex: (i: number) => void; onClose: () => void;
}) {
  const multi = images.length > 1;
  const next = useCallback(() => onIndex((index + 1) % images.length), [index, images.length, onIndex]);
  const prev = useCallback(() => onIndex((index - 1 + images.length) % images.length), [index, images.length, onIndex]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [next, prev, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/90 p-4 md:p-10"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Galería de ${name}`}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="absolute right-5 top-5 text-2xl text-ivory-50/80 hover:text-ivory-50"
      >
        ✕
      </button>

      {multi && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); prev(); }}
            aria-label="Anterior"
            className="absolute left-3 top-1/2 -translate-y-1/2 px-3 text-4xl text-ivory-50/70 hover:text-ivory-50 md:left-8"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); next(); }}
            aria-label="Siguiente"
            className="absolute right-3 top-1/2 -translate-y-1/2 px-3 text-4xl text-ivory-50/70 hover:text-ivory-50 md:right-8"
          >
            ›
          </button>
        </>
      )}

      <figure className="flex max-h-full max-w-full flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
        <img src={images[index]} alt={name} className="max-h-[82vh] max-w-full object-contain" />
        {multi && (
          <figcaption className="text-[12px] uppercase tracking-[0.18em] text-ivory-50/70">
            {index + 1} / {images.length}
          </figcaption>
        )}
      </figure>
    </div>
  );
}
