import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import bundledProducts from '@/data/products.json';

// Tipo de producto = shape del JSON bundleado (con extras opcionales que puede
// añadir el admin: badge, active). El JSON bundleado es el fallback si la API
// no responde (dev sin backend, o caída de red).
export type Product = (typeof bundledProducts)[number] & {
  badge?: string;
  active?: boolean;
  details?: unknown;
};
type CartItem = { id: string; qty: number };

// Mismo patrón que el admin: si el app se sirve aparte, VITE_API_BASE apunta al
// backend Node. Vacío = mismo origen.
const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';

type CartCtxType = {
  items: CartItem[];
  add: (id: string, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  productById: (id: string) => Product | undefined;
  products: Product[];
  loadingProducts: boolean;
};

const CartCtx = createContext<CartCtxType | null>(null);
const KEY = 'lf_cart';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  });
  const [isOpen, setIsOpen] = useState(false);
  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  // ── Catálogo en vivo ──
  // Arranca con el snapshot bundleado (render instantáneo, sin parpadeo) y se
  // refresca desde /api/products. Si la API falla, se queda con el bundle.
  const [products, setProducts] = useState<Product[]>(bundledProducts as Product[]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch(API_BASE + '/api/products')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((list) => {
        if (!alive || !Array.isArray(list) || !list.length) return;
        const live = list as Product[];
        // Red de seguridad para la línea Fúnebre: mientras el backend no haya
        // sembrado estos productos en su BD (deploys separados), la API responde
        // sin ellos y, al reemplazar el bundle, la página Fúnebre quedaría vacía.
        // Sumamos los fúnebres del bundle que aún no estén en la respuesta en vivo
        // (dedup por id; lo que venga de la API manda). Una vez sembrados, esto no
        // añade nada.
        const liveIds = new Set(live.map((p) => p.id));
        const fallbackFunebre = (bundledProducts as Product[]).filter(
          (p) => p.category === 'funebre' && !liveIds.has(p.id)
        );
        setProducts([...live, ...fallbackFunebre]);
      })
      .catch(() => { /* se mantiene el bundle */ })
      .finally(() => { if (alive) setLoadingProducts(false); });
    return () => { alive = false; };
  }, []);

  const productById = (id: string) => products.find((p) => p.id === id);
  const add = (id: string, qty = 1) => {
    setItems((prev) => {
      const found = prev.find((i) => i.id === id);
      if (found) return prev.map((i) => (i.id === id ? { ...i, qty: i.qty + qty } : i));
      return [...prev, { id, qty }];
    });
    setIsOpen(true);
  };
  const remove = (id: string) => setItems((prev) => prev.filter((i) => i.id !== id));
  const setQty = (id: string, qty: number) =>
    setItems((prev) => (qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => (i.id === id ? { ...i, qty } : i))));
  const clear = () => setItems([]);
  const count = items.reduce((s, i) => s + i.qty, 0);
  const subtotal = items.reduce((s, i) => { const p = productById(i.id); return s + (p ? p.price * i.qty : 0); }, 0);

  return (
    <CartCtx.Provider value={{ items, add, remove, setQty, clear, count, subtotal, isOpen, open: () => setIsOpen(true), close: () => setIsOpen(false), productById, products, loadingProducts }}>
      {children}
    </CartCtx.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useCart = () => {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart must be used within CartProvider');
  return c;
};

// Hook de conveniencia para páginas que solo necesitan el catálogo.
// eslint-disable-next-line react-refresh/only-export-components
export const useProducts = () => {
  const { products, loadingProducts } = useCart();
  return { products, loading: loadingProducts };
};

export const money = (n: number) => `S/ ${n}`;
