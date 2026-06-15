import { useCallback, useEffect, useMemo, useState } from 'react';
import { adminGet, adminSend, AuthError, apiUrl, resolveImg, fileToDataUrl } from '@/lib/admin-api';
import categories from '@/data/categories.json';

type Product = Record<string, any>;

const soles = (n: any) => 'S/ ' + (Number(n) || 0).toFixed(2);
const CAT_OPTIONS = categories as { slug: string; label: string }[];

export function AdminProducts({ onAuthError }: { onAuthError: () => void }) {
  const [list, setList] = useState<Product[]>([]);
  const [meta, setMeta] = useState('cargando…');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [isNew, setIsNew] = useState(false);

  const fail = useCallback((e: any) => {
    if (e instanceof AuthError) { onAuthError(); return true; }
    return false;
  }, [onAuthError]);

  const load = useCallback(async () => {
    setMeta('cargando…');
    try {
      const data = await adminGet('/api/admin/products');
      const arr: Product[] = data.products || [];
      setList(arr);
      setMeta(`${arr.length} producto${arr.length === 1 ? '' : 's'} · ${arr.filter((p) => p.active !== false).length} activos`);
    } catch (e: any) {
      if (fail(e)) return;
      setList([]);
      setMeta('error: ' + e.message + ' — ¿hay DATABASE_URL configurado en el backend?');
    }
  }, [fail]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter((p) => (p.name || '').toLowerCase().includes(s) || (p.id || '').toLowerCase().includes(s) || (p.categoryLabel || '').toLowerCase().includes(s));
  }, [list, q]);

  const toggleActive = async (p: Product) => {
    try {
      await adminSend(`/api/admin/products/${encodeURIComponent(p.id)}`, 'PUT', { active: p.active === false });
      load();
    } catch (e) { if (!fail(e)) alert('Error: ' + (e as Error).message); }
  };

  const del = async (p: Product) => {
    if (!confirm(`¿Eliminar "${p.name}"? No se puede deshacer.\n(Tip: si solo quieres ocultarlo, usa el toggle Activo.)`)) return;
    try {
      await adminSend(`/api/admin/products/${encodeURIComponent(p.id)}`, 'DELETE');
      load();
    } catch (e) { if (!fail(e)) alert('Error: ' + (e as Error).message); }
  };

  const startNew = () => {
    setIsNew(true);
    setEditing({ name: '', category: CAT_OPTIONS[0]?.slug || '', categoryLabel: CAT_OPTIONS[0]?.label || '', price: 0, images: [], tags: [], active: true });
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">{meta}</p>
        <div className="flex items-center gap-2.5">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar…"
            className="w-48 border border-border bg-background px-3 py-2 text-sm outline-none focus:border-rosa-500" />
          <button onClick={startNew} className="bg-rosa-500 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-600">+ Nuevo</button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {filtered.map((p) => (
          <div key={p.id} className={`group flex flex-col border border-border bg-surface-card ${p.active === false ? 'opacity-55' : ''}`}>
            <div className="relative aspect-[4/5] overflow-hidden bg-ivory-200">
              {p.image ? <img src={resolveImg(p.image)} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs text-foreground/40">sin imagen</div>}
              {p.badge && <span className="absolute left-2 top-2 bg-ink-900/80 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-ivory-50">{p.badge}</span>}
              {p.active === false && <span className="absolute right-2 top-2 bg-red-700/90 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-ivory-50">Oculto</span>}
            </div>
            <div className="flex flex-1 flex-col p-3">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-foreground/45">{p.categoryLabel || p.category}</p>
              <h3 className="mt-0.5 line-clamp-2 font-display text-[15px] font-medium leading-tight text-ink-900">{p.name}</h3>
              <p className="mt-1 font-display text-sm italic text-ink-700">{soles(p.price)}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <button onClick={() => { setIsNew(false); setEditing(p); }} className="flex-1 border border-ink-900/15 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-900 hover:border-rosa-500 hover:text-rosa-500">Editar</button>
                <button onClick={() => toggleActive(p)} title="Mostrar/ocultar en la tienda" className="border border-ink-900/15 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900">{p.active === false ? 'Mostrar' : 'Ocultar'}</button>
                <button onClick={() => del(p)} title="Eliminar" className="border border-ink-900/15 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/50 hover:border-red-700 hover:text-red-700">✕</button>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="col-span-full py-20 text-center font-display text-xl italic text-foreground/50">Sin productos.</div>}
      </div>

      {editing && (
        <ProductEditor
          product={editing}
          isNew={isNew}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
          onAuthError={onAuthError}
        />
      )}
    </>
  );
}

// ─── Editor (modal) ────────────────────────────────────────────────────────────
function ProductEditor({ product, isNew, onClose, onSaved, onAuthError }: {
  product: Product; isNew: boolean; onClose: () => void; onSaved: () => void; onAuthError: () => void;
}) {
  const [f, setF] = useState<Product>(() => ({
    ...product,
    images: Array.isArray(product.images) ? product.images : (product.image ? [product.image] : []),
    tags: Array.isArray(product.tags) ? product.tags : [],
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const onCatChange = (slug: string) => {
    const c = CAT_OPTIONS.find((x) => x.slug === slug);
    setF((p) => ({ ...p, category: slug, categoryLabel: c?.label || p.categoryLabel }));
  };

  const upload = async (file: File) => {
    setUploading(true); setErr('');
    try {
      const dataUrl = await fileToDataUrl(file);
      const r = await fetch(apiUrl('/api/admin/products/upload-image'), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataBase64: dataUrl, productId: f.id || null }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 401 || r.status === 403) { onAuthError(); return; }
      if (!r.ok) throw new Error(data.error || ('HTTP ' + r.status));
      const url = data.url || data.path;
      setF((p) => {
        const images = [...(p.images || []), url];
        return { ...p, images, image: images[0] }; // la primera = principal
      });
    } catch (e: any) { setErr('Subida: ' + e.message); }
    finally { setUploading(false); }
  };

  const removeImg = (src: string) => setF((p) => {
    const images = (p.images || []).filter((x: string) => x !== src);
    return { ...p, images, image: images[0] || '' };
  });

  // Reordena la galería arrastrando. La primera siempre es la principal (image).
  const moveImage = (from: number, to: number) => setF((p) => {
    const images = [...(p.images || [])];
    if (from < 0 || to < 0 || from >= images.length || to >= images.length || from === to) return p;
    const [moved] = images.splice(from, 1);
    images.splice(to, 0, moved);
    return { ...p, images, image: images[0] || '' };
  });

  const save = async () => {
    if (!f.name || !String(f.name).trim()) { setErr('El nombre es obligatorio.'); return; }
    setBusy(true); setErr('');
    const payload: Product = {
      name: f.name, category: f.category, categoryLabel: f.categoryLabel,
      price: f.price === '' ? null : Number(f.price),
      image: (f.images || [])[0] || f.image || null,
      images: f.images || [],
      shortDesc: f.shortDesc || null, description: f.description || null,
      tags: f.tags || [], badge: f.badge || null, palette: f.palette || null,
      active: f.active !== false,
    };
    try {
      if (isNew) await adminSend('/api/admin/products', 'POST', payload);
      else await adminSend(`/api/admin/products/${encodeURIComponent(f.id)}`, 'PUT', payload);
      onSaved();
    } catch (e: any) {
      if (e instanceof AuthError) { onAuthError(); return; }
      setErr(e.message);
    } finally { setBusy(false); }
  };

  const field = 'mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rosa-500';
  const label = 'block text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/55';

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto bg-ink-900/70 p-4 py-10" onClick={onClose}>
      <div className="w-full max-w-2xl border border-border bg-surface p-6 shadow-xl md:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl italic text-ink-900">{isNew ? 'Nuevo producto' : 'Editar producto'}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="text-xl text-foreground/50 hover:text-ink-900">✕</button>
        </div>
        {!isNew && <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/45">{f.id}</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={label}>Nombre *</label>
            <input value={f.name || ''} onChange={(e) => set('name', e.target.value)} className={field} />
          </div>
          <div>
            <label className={label}>Categoría</label>
            <select value={f.category || ''} onChange={(e) => onCatChange(e.target.value)} className={field}>
              {CAT_OPTIONS.map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Precio (S/)</label>
            <input type="number" inputMode="decimal" value={f.price ?? ''} onChange={(e) => set('price', e.target.value)} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Descripción corta</label>
            <input value={f.shortDesc || ''} onChange={(e) => set('shortDesc', e.target.value)} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label className={label}>Descripción larga</label>
            <textarea value={f.description || ''} onChange={(e) => set('description', e.target.value)} rows={3} className={field} />
          </div>
          <div>
            <label className={label}>Tags (separados por coma)</label>
            <input value={(f.tags || []).join(', ')} onChange={(e) => set('tags', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} className={field} />
          </div>
          <div>
            <label className={label}>Badge (opcional)</label>
            <input value={f.badge || ''} onChange={(e) => set('badge', e.target.value)} className={field} placeholder="Ej: Nuevo" />
          </div>
        </div>

        {/* Galería */}
        <div className="mt-6">
          <label className={label}>Imágenes</label>
          <div className="mt-2 flex flex-wrap gap-3">
            {(f.images || []).map((src: string, i: number) => (
              <div key={src}
                draggable
                onDragStart={() => setDragIdx(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); if (dragIdx !== null) moveImage(dragIdx, i); setDragIdx(null); }}
                onDragEnd={() => setDragIdx(null)}
                title="Arrastra para reordenar"
                className={`relative h-24 w-20 cursor-move overflow-hidden rounded-sm border-2 transition-opacity ${i === 0 ? 'border-rosa-500' : 'border-border'} ${dragIdx === i ? 'opacity-40' : ''}`}>
                <img src={resolveImg(src)} alt="" draggable={false} className="h-full w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-ink-900/70 px-1 py-0.5">
                  <button type="button" title="Ampliar" onClick={() => setZoom(resolveImg(src))} className="text-[11px] leading-none text-ivory-50/90 hover:text-rosa-300">⤢</button>
                  <button type="button" title="Quitar" onClick={() => removeImg(src)} className="text-[11px] leading-none text-ivory-50/90 hover:text-red-300">✕</button>
                </div>
                {i === 0 && <span className="absolute left-0 top-0 bg-rosa-500 px-1 text-[8px] uppercase tracking-wide text-ivory-50">Main</span>}
              </div>
            ))}
            <label className="flex h-24 w-20 cursor-pointer flex-col items-center justify-center rounded-sm border-2 border-dashed border-border text-center text-[10px] text-foreground/50 hover:border-rosa-500 hover:text-rosa-500">
              {uploading ? '…' : '+ Subir'}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) upload(file); e.target.value = ''; }} />
            </label>
          </div>
          <p className="mt-1.5 text-[11px] text-foreground/45">Arrastra para reordenar — <strong className="font-medium text-foreground/60">la primera es la principal</strong>. ⤢ amplía · ✕ quita.</p>
        </div>

        {err && <p className="mt-4 bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}

        <div className="mt-6 flex items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-sm text-ink-800">
            <input type="checkbox" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> Visible en la tienda
          </label>
          <div className="flex gap-2.5">
            <button onClick={onClose} className="border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900">Cancelar</button>
            <button onClick={save} disabled={busy} className="bg-ink-900 px-6 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-500 disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>
      </div>

      {/* Lightbox: ampliar imagen del producto */}
      {zoom && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-ink-900/85 p-6"
          onClick={(e) => { e.stopPropagation(); setZoom(null); }}>
          <img src={zoom} alt="" className="max-h-[90vh] max-w-[92vw] rounded-sm object-contain shadow-2xl" />
          <button onClick={(e) => { e.stopPropagation(); setZoom(null); }}
            className="absolute right-4 top-4 bg-ink-900/60 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-ink-900">Cerrar ✕</button>
        </div>
      )}
    </div>
  );
}
