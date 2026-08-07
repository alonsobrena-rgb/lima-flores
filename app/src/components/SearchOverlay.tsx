// Buscador del header: filtra el catálogo por nombre.
//
// El estado vive en un contexto porque el botón que lo abre está en dos sitios
// distintos (el header del hero en la home y el SiteHeader del resto de
// páginas) y el panel se monta una sola vez, junto al CartDrawer.
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { money, useProducts, type Product } from '@/lib/cart';

const ease = [0.22, 1, 0.36, 1] as const;
const MAX = 8;

// Sin tildes y en minúsculas, para que «orquidea» encuentre «Orquídea».
const normaliza = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const SearchCtx = createContext<{ open: () => void } | null>(null);

export const useSearch = () => {
  const ctx = useContext(SearchCtx);
  if (!ctx) throw new Error('useSearch fuera de <SearchProvider>');
  return ctx;
};

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const abrir = useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <SearchCtx.Provider value={abrir}>
      {children}
      <SearchOverlay isOpen={isOpen} close={() => setOpen(false)} />
    </SearchCtx.Provider>
  );
}

function SearchOverlay({ isOpen, close }: { isOpen: boolean; close: () => void }) {
  const { products } = useProducts();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [activo, setActivo] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  // El índice se recalcula solo si cambia el catálogo, no en cada tecla.
  const indice = useMemo(
    () => products.map((p) => ({ p, buscable: normaliza(p.name) })),
    [products],
  );

  const { visibles, total } = useMemo(() => {
    const consulta = normaliza(q);
    if (!consulta) return { visibles: [] as Product[], total: 0 };
    // Todas las palabras tienen que aparecer: así «box lila» no trae todo lo
    // que empieza con «box».
    const palabras = consulta.split(/\s+/);
    const todos = indice.filter((e) => palabras.every((w) => e.buscable.includes(w)));
    return { visibles: todos.slice(0, MAX).map((e) => e.p), total: todos.length };
  }, [q, indice]);

  useEffect(() => { setActivo(-1); }, [q]);

  useEffect(() => {
    if (!isOpen) return;
    setQ('');
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    return () => { clearTimeout(t); document.body.style.overflow = ''; };
  }, [isOpen]);

  const irA = (p: Product) => { close(); navigate(`/producto/${p.id}`); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (!visibles.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      setActivo((i) => {
        const n = i + paso;
        if (n < -1) return visibles.length - 1;
        if (n >= visibles.length) return -1;
        return n;
      });
      return;
    }
    if (e.key === 'Enter') {
      // Sin nada resaltado, Enter abre el primer resultado.
      e.preventDefault();
      irA(visibles[activo >= 0 ? activo : 0]);
    }
  };

  // Resalta en el nombre el tramo que coincide con lo tecleado.
  const resaltar = (nombre: string) => {
    const termino = normaliza(q).split(/\s+/)[0];
    if (!termino) return nombre;
    const i = normaliza(nombre).indexOf(termino);
    if (i < 0) return nombre;
    return (
      <>
        {nombre.slice(0, i)}
        <mark className="bg-transparent font-semibold text-rosa-500">{nombre.slice(i, i + termino.length)}</mark>
        {nombre.slice(i + termino.length)}
      </>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[12vh] md:pt-[14vh]">
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={close} className="absolute inset-0 bg-ink-900/45 backdrop-blur-sm"
          />
          <motion.div
            role="dialog" aria-modal="true" aria-label="Buscar productos"
            initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.28, ease }}
            onKeyDown={onKeyDown}
            className="relative flex max-h-[72vh] w-full max-w-[620px] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[0_30px_70px_-30px_rgba(42,38,35,0.55)]"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <svg className="h-[18px] w-[18px] shrink-0 text-foreground/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
                <circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
                type="search" autoComplete="off" placeholder="Buscar por nombre…"
                aria-label="Buscar productos por nombre"
                className="min-w-0 flex-1 bg-transparent py-1 text-[17px] text-ink-900 outline-none placeholder:text-foreground/40 [&::-webkit-search-cancel-button]:hidden"
              />
              <button onClick={close} aria-label="Cerrar búsqueda" className="shrink-0 rounded-full p-1.5 text-foreground/50 transition-colors hover:bg-ink-900/5 hover:text-foreground">
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
              </button>
            </div>

            <div className="overflow-y-auto p-1.5">
              {!q.trim() && (
                <p className="px-4 py-4 text-[14px] text-foreground/55">
                  Escribe para buscar entre {products.length} productos.
                </p>
              )}

              {q.trim() && !visibles.length && (
                <p className="px-4 py-4 text-[14px] text-foreground/55">
                  Nada con «{q.trim()}». Prueba con una palabra suelta: rosas, tulipanes, orquídea.
                </p>
              )}

              {visibles.map((p, i) => (
                <button
                  key={p.id} onClick={() => irA(p)} onMouseEnter={() => setActivo(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${i === activo ? 'bg-rosa-500/10' : 'hover:bg-ink-900/5'}`}
                >
                  <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-md bg-ivory-100">
                    {p.image && <img src={p.image} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] text-ink-900">{resaltar(p.name)}</span>
                    <span className="block text-[11px] font-medium uppercase tracking-[0.18em] text-foreground/45">{p.categoryLabel}</span>
                  </span>
                  <span className="shrink-0 text-[14px] font-medium tabular-nums text-ink-900">{money(p.price)}</span>
                </button>
              ))}

              {total > MAX && (
                <p className="px-4 pb-2 pt-1 text-center text-[13px] text-foreground/50">
                  y {total - MAX} más — afina la búsqueda
                </p>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
