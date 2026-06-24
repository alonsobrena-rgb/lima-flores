// Categorías del catálogo en vivo (DB vía /api/categories) con el snapshot
// bundleado como respaldo para pintado instantáneo / si la API falla.
import { useEffect, useState } from 'react';
import bundled from '@/data/categories.json';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';

export type Category = { slug: string; label: string; sortOrder?: number; active?: boolean; count?: number };

const FALLBACK: Category[] = (bundled as any[]).map((c, i) => ({ slug: c.slug, label: c.label, count: c.count, sortOrder: i, active: true }));

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>(FALLBACK);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetch(API_BASE + '/api/categories')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('HTTP ' + r.status))))
      .then((list) => { if (alive && Array.isArray(list) && list.length) setCategories(list as Category[]); })
      .catch(() => { /* se queda con el bundle */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);
  return { categories, loading };
}
