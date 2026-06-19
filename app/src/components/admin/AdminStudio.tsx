import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { adminGet, adminSend, apiUrl, AuthError, resolveImg } from '@/lib/admin-api';
import { useProducts, type Product } from '@/lib/cart';
import { renderAd, renderPromoAd, loadImage, downloadCanvas, AD_DIMS, PROMO_DIMS, SAFE, type AdSize, type AdTheme, type TextPlacement } from '@/lib/ad-canvas';

type Template = 'simple' | 'promo';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Vibe = { key: string; label: string; lead: string; surface: string; extra: string };
const VIBES: Vibe[] = [
  { key: 'romantic', label: 'Romántico / San Valentín', lead: 'Romantic Valentine', surface: 'deep red and blush tones over dark moody marble', extra: 'velvety petals, candlelight warmth' },
  { key: 'mothers', label: 'Día de la Madre', lead: "Tender Mother's Day", surface: 'soft pastel linen with warm morning light', extra: 'gentle, heartfelt, fresh' },
  { key: 'luxury', label: 'Minimal lujo', lead: 'Minimal luxury', surface: 'clean beige stucco and white marble', extra: 'negative space, sophisticated, understated' },
  { key: 'birthday', label: 'Cumpleaños festivo', lead: 'Festive birthday', surface: 'bright cheerful backdrop with soft confetti bokeh', extra: 'joyful, vibrant, celebratory' },
  { key: 'sympathy', label: 'Condolencias sobrio', lead: 'Sober respectful sympathy', surface: 'muted greys and whites with soft diffused light', extra: 'calm, dignified, serene' },
];

function buildPrompt(p: Product, vibeKey: string, size: AdSize, template: Template = 'simple'): string {
  const v = VIBES.find((x) => x.key === vibeKey) || VIBES[0];
  const sizeRule = template === 'promo'
    ? 'Square 1:1 framing. Place the flower arrangement clearly on the LEFT side of the frame; keep the RIGHT 45% as clean, simple negative space (soft wall or surface) so a text panel can sit there.'
    : size === 'vertical'
    ? 'Vertical 9:16 framing; keep the top 15% and bottom 20% as clean negative space for text and platform UI.'
    : 'Balanced 1:1 framing with comfortable breathing room on all edges.';
  // Prompt de edición para Seedream: conserva el arreglo REAL de la foto de
  // referencia y solo recompone el entorno/luz/escena (no reinventa el ramo).
  return `${v.lead} editorial advertising photo for a luxury Peruvian boutique florist (Lima Flores). Keep the EXACT same flower arrangement from the reference image ("${p.name}") — identical flowers, colors, shapes and composition, completely unchanged; do NOT redesign, replace or add flowers. Only restyle the scene around it: ${v.surface}. Soft natural directional light, ${v.extra}, elegant editorial styling, arrangement centered and fully visible. ${sizeRule} Refined, aspirational, true-to-life colors, shallow depth of field, high-end commercial advertising photography, 8k.`;
}

export function AdminStudio({ onAuthError }: { onAuthError: () => void }) {
  const { products } = useProducts();
  const [selected, setSelected] = useState<Product | null>(null);
  const [kind, setKind] = useState<'image' | 'video'>('image');
  const [size, setSize] = useState<AdSize>('vertical');
  const [template, setTemplate] = useState<Template>('simple');
  const [vibe, setVibe] = useState('romantic');
  const [prompt, setPrompt] = useState('');

  // Campos de la plantilla promocional (tarjeta de oferta)
  const [promoTag, setPromoTag] = useState('FLORES FRESCAS CADA 15 DÍAS');
  const [promoCategory, setPromoCategory] = useState('FLORES DE ESTACIÓN · LIMA');
  const [promoSubline, setPromoSubline] = useState('');
  const [promoPriceLabel, setPromoPriceLabel] = useState('FLORES FRESCAS CADA 15 DÍAS');
  const [promoNote, setPromoNote] = useState('2 ramos al mes · Delivery Incluido');
  const [promoBullets, setPromoBullets] = useState('Siempre frescas, siempre distintas\nSe abren en tu casa\nDuran cerca de 2 semanas\nRamo diferente cada 15 días');
  const [promoCta, setPromoCta] = useState('¡Suscríbete este mes!');
  const [promoZones, setPromoZones] = useState('Miraflores, Barranco, San Isidro, Magdalena del Mar, Chorrillos');

  // Composición (ad completo)
  const [headline, setHeadline] = useState('');
  const [subtitle, setSubtitle] = useState('Entrega en todo Lima Metropolitana');
  const [cta, setCta] = useState('Pide hoy');
  const [price, setPrice] = useState('');
  const [placement, setPlacement] = useState<TextPlacement>('bottom');
  const [theme, setTheme] = useState<AdTheme>('dark');
  const [showGuides, setShowGuides] = useState(true);

  const [bgImg, setBgImg] = useState<HTMLImageElement | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genStatus, setGenStatus] = useState('');
  const [err, setErr] = useState('');
  const [gallery, setGallery] = useState<any[]>([]);
  const [allAssets, setAllAssets] = useState<any[]>([]);
  const [lightbox, setLightbox] = useState<{ id: string; kind: string; size?: AdSize } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const productById = useMemo(() => new Map((products as Product[]).map((p) => [p.id, p])), [products]);

  const fail = useCallback((e: any) => { if (e instanceof AuthError) { onAuthError(); return true; } return false; }, [onAuthError]);

  const loadGallery = useCallback(async (pid: string) => {
    try { const d = await adminGet('/api/admin/studio/assets?productId=' + encodeURIComponent(pid)); setGallery(d.assets || []); }
    catch (e) { if (!fail(e)) setGallery([]); }
  }, [fail]);

  // Galería global: todos los ads de todos los productos.
  const loadAllAssets = useCallback(async () => {
    try { const d = await adminGet('/api/admin/studio/assets'); setAllAssets(d.assets || []); }
    catch (e) { if (!fail(e)) setAllAssets([]); }
  }, [fail]);

  useEffect(() => { loadAllAssets(); }, [loadAllAssets]);

  // Al elegir producto: prefill prompt/titular/precio + foto como fondo base.
  const pick = useCallback(async (p: Product) => {
    setSelected(p); setErr(''); setVideoUrl(null);
    setHeadline(p.name); setPrice('S/ ' + p.price);
    setPrompt(buildPrompt(p, vibe, size, template));
    try { const img = await loadImage(resolveImg(p.image)); setBgImg(img); } catch { setBgImg(null); }
    loadGallery(p.id);
  }, [vibe, size, template, loadGallery]);

  // Reconstruir prompt al cambiar vibe/size/plantilla (mantiene editable después).
  useEffect(() => { if (selected) setPrompt(buildPrompt(selected, vibe, size, template)); /* eslint-disable-next-line */ }, [vibe, size, template]);

  // Contenido de la plantilla promocional a partir de los campos del editor.
  const promoContent = useCallback(() => ({
    bg: bgImg, brand: 'LIMA FLORES', tag: promoTag, headline, category: promoCategory,
    subline: promoSubline, priceLabel: promoPriceLabel, price, priceNote: promoNote,
    bullets: promoBullets.split('\n'), cta: promoCta, zonesLabel: 'ZONAS DE DELIVERY',
    zones: promoZones.split(','),
  }), [bgImg, promoTag, headline, promoCategory, promoSubline, promoPriceLabel, price, promoNote, promoBullets, promoCta, promoZones]);

  // Re-render del canvas cuando cambian fondo o textos (solo modo imagen).
  useEffect(() => {
    if (kind !== 'image' || !canvasRef.current) return;
    if (template === 'promo') { renderPromoAd(canvasRef.current, promoContent()).catch(() => {}); return; }
    renderAd(canvasRef.current, { size, bg: bgImg, headline, subtitle, price, cta, placement, theme, showGuides }).catch(() => {});
  }, [template, promoContent, kind, size, bgImg, headline, subtitle, price, cta, placement, theme, showGuides]);

  async function pollAsset(assetId: string): Promise<{ dataUrl: string; kind: string }> {
    for (let i = 0; i < 90; i++) {
      await sleep(4000);
      const s = await adminGet('/api/admin/studio/status/' + assetId);
      setGenStatus('estado: ' + s.status);
      if (s.status === 'completed') return await adminGet('/api/admin/studio/asset/' + assetId);
      if (s.status === 'failed') throw new Error(s.error || 'La generación falló');
    }
    throw new Error('Tiempo de espera agotado');
  }

  const generate = async () => {
    if (!selected) { setErr('Elige un producto primero.'); return; }
    setGenerating(true); setErr(''); setGenStatus('enviando…'); setVideoUrl(null);
    try {
      const genSize: AdSize = template === 'promo' ? 'square' : size;
      const r = await adminSend('/api/admin/studio/generate', 'POST', { productId: selected.id, kind, size: genSize, vibe, prompt });
      setGenStatus('generando… (1–3 min)');
      const result = await pollAsset(r.assetId);
      if (kind === 'video') setVideoUrl(result.dataUrl);
      else { const img = await loadImage(result.dataUrl); setBgImg(img); }
      loadGallery(selected.id);
      loadAllAssets();
    } catch (e: any) { if (!fail(e)) setErr(e.message); }
    finally { setGenerating(false); setGenStatus(''); }
  };

  // Carga un ad en el editor (para componer texto/precio encima).
  const openAsset = async (a: any) => {
    try {
      const d = await adminGet('/api/admin/studio/asset/' + a.id);
      setSize(a.size); setKind(a.kind);
      if (a.kind === 'video') setVideoUrl(d.dataUrl);
      else { const img = await loadImage(d.dataUrl); setBgImg(img); setVideoUrl(null); }
      // Prefill con la info del producto del ad (titular + precio), igual que al
      // elegir un producto — así el editor sale listo para componer.
      const p = a.product_id ? productById.get(a.product_id) : null;
      if (p) {
        setSelected(p);
        setHeadline(p.name);
        setPrice('S/ ' + p.price);
      }
    } catch (e) { if (!fail(e)) setErr((e as Error).message); }
  };

  // Abre un ad ampliado en el visor (lightbox).
  const enlarge = (a: any) => { if (a.status === 'completed') setLightbox({ id: a.id, kind: a.kind, size: a.size }); };

  const download = async () => {
    if (kind === 'video' && videoUrl) {
      const a = document.createElement('a'); a.href = videoUrl; a.download = `lima-ad-${size}.mp4`; document.body.appendChild(a); a.click(); a.remove();
      return;
    }
    if (!bgImg) return;
    // Exportar SIEMPRE sin las guías de safe-zone (son solo ayuda visual del
    // editor). Render a una canvas temporal limpia → no toca el preview.
    const tmp = document.createElement('canvas');
    if (template === 'promo') {
      await renderPromoAd(tmp, promoContent());
      downloadCanvas(tmp, `lima-promo-${selected?.id || 'producto'}.png`);
      return;
    }
    await renderAd(tmp, { size, bg: bgImg, headline, subtitle, price, cta, placement, theme, showGuides: false });
    downloadCanvas(tmp, `lima-ad-${selected?.id || 'producto'}-${size}.png`);
  };

  const seg = (active: boolean) => `px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] border ${active ? 'border-rosa-500 bg-rosa-500 text-ivory-50' : 'border-border text-foreground/60 hover:border-ink-900 hover:text-ink-900'}`;
  const field = 'mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rosa-500';
  const label = 'block text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/55';

  const dims = template === 'promo' ? PROMO_DIMS : AD_DIMS[size];
  const previewMaxH = 560;
  const isPromo = template === 'promo';

  return (
    <div className="space-y-10">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,380px)_1fr]">
      {/* ── Controles ── */}
      <div className="space-y-6">
        {/* Producto */}
        <div>
          <label className={label}>Producto</label>
          <div className="mt-2 grid max-h-[200px] grid-cols-4 gap-2 overflow-y-auto rounded-sm border border-border p-2 sm:grid-cols-5">
            {(products as Product[]).map((p) => (
              <button key={p.id} onClick={() => pick(p)} title={p.name}
                className={`relative aspect-square overflow-hidden rounded-sm border-2 ${selected?.id === p.id ? 'border-rosa-500' : 'border-transparent hover:border-border'}`}>
                <img src={resolveImg(p.image)} alt={p.name} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
          {selected && <p className="mt-1.5 truncate text-sm text-ink-800">{selected.name} · <span className="text-foreground/55">S/ {selected.price}</span></p>}
        </div>

        {/* Plantilla */}
        <div>
          <label className={label}>Plantilla</label>
          <div className="mt-1.5 flex">
            <button onClick={() => setTemplate('simple')} className={seg(template === 'simple') + ' rounded-l-sm'}>Anuncio simple</button>
            <button onClick={() => { setTemplate('promo'); setKind('image'); setSize('square'); }} className={seg(template === 'promo') + ' -ml-px rounded-r-sm'}>Promoción / oferta</button>
          </div>
          {isPromo && <p className="mt-1.5 text-[11px] leading-relaxed text-foreground/45">Tarjeta cuadrada (1080×1080): foto a la izquierda + panel con precio, beneficios, CTA y zonas de delivery.</p>}
        </div>

        {/* Formato + tamaño (no aplican en promo: siempre foto cuadrada) */}
        {!isPromo && (
        <div className="flex flex-wrap gap-4">
          <div>
            <label className={label}>Formato</label>
            <div className="mt-1.5 flex">
              <button onClick={() => setKind('image')} className={seg(kind === 'image') + ' rounded-l-sm'}>Foto</button>
              <button onClick={() => setKind('video')} className={seg(kind === 'video') + ' -ml-px rounded-r-sm'}>Video</button>
            </div>
          </div>
          <div>
            <label className={label}>Tamaño</label>
            <div className="mt-1.5 flex">
              <button onClick={() => setSize('square')} className={seg(size === 'square') + ' rounded-l-sm'}>Cuadrado 1:1</button>
              <button onClick={() => setSize('vertical')} className={seg(size === 'vertical') + ' -ml-px rounded-r-sm'}>Vertical 9:16</button>
            </div>
          </div>
        </div>
        )}

        {/* Vibe */}
        <div>
          <label className={label}>Estilo (vibe)</label>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {VIBES.map((v) => (
              <button key={v.key} onClick={() => setVibe(v.key)}
                className={`rounded-full border px-3 py-1.5 text-[12px] ${vibe === v.key ? 'border-rosa-500 bg-rosa-500/10 text-rosa-600' : 'border-border text-foreground/60 hover:border-ink-900 hover:text-ink-900'}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prompt */}
        <div>
          <div className="flex items-center justify-between">
            <label className={label}>Prompt (editable)</label>
            {selected && <button onClick={() => setPrompt(buildPrompt(selected, vibe, size))} className="font-mono text-[10px] uppercase tracking-[0.08em] text-rosa-500 hover:text-rosa-600">↻ Regenerar</button>}
          </div>
          <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={5} className={field + ' font-mono text-[12px] leading-relaxed'} placeholder="Elige un producto para sugerir un prompt…" />
        </div>

        <button onClick={generate} disabled={generating || !selected}
          className="w-full bg-ink-900 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-ivory-50 transition-colors hover:bg-rosa-500 disabled:opacity-50">
          {generating ? (genStatus || 'Generando…') : '✦ Generar con Higgsfield'}
        </button>
        {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}
        <p className="text-[11px] leading-relaxed text-foreground/45">
          Consume créditos de Higgsfield (Seedream 4.5). Parte de la foto real del producto y conserva el arreglo; solo recompone la escena, con espacio limpio para las safe zones de Meta. El texto/precio se compone encima (abajo).
        </p>
      </div>

      {/* ── Preview + composición ── */}
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">Vista previa · {dims.w}×{dims.h}{showGuides ? ' · con guías' : ''}</p>
          <div className="flex flex-wrap gap-2">
            {!isPromo && <label className="flex items-center gap-1.5 text-xs text-ink-800"><input type="checkbox" checked={showGuides} onChange={(e) => setShowGuides(e.target.checked)} /> Guías safe-zone</label>}
            {!isPromo && <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900">Texto: {theme === 'dark' ? 'claro' : 'oscuro'}</button>}
            {!isPromo && <button onClick={() => setPlacement(placement === 'bottom' ? 'top' : 'bottom')} className="border border-border px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900">Texto: {placement === 'bottom' ? 'abajo' : 'arriba'}</button>}
            <button onClick={download} className="bg-rosa-500 px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-600">⬇ Descargar</button>
          </div>
        </div>

        <div className="flex flex-col items-start gap-6 lg:flex-row">
          {/* Lienzo / video */}
          <div className="flex justify-center" style={{ minWidth: 0 }}>
            {kind === 'video' ? (
              videoUrl ? (
                <div className="relative" style={{ height: previewMaxH, aspectRatio: `${dims.w} / ${dims.h}` }}>
                  <video src={videoUrl} controls loop autoPlay muted className="h-full w-full bg-ink-900 object-cover" />
                  {showGuides && <VideoGuides size={size} />}
                </div>
              ) : (
                <div className="flex items-center justify-center border border-dashed border-border text-center text-sm text-foreground/45" style={{ height: previewMaxH, aspectRatio: `${dims.w} / ${dims.h}` }}>
                  Genera un video para verlo aquí.
                </div>
              )
            ) : (
              <canvas ref={canvasRef} className="border border-border bg-ivory-200 shadow-lg" style={{ maxHeight: previewMaxH, maxWidth: '100%', height: 'auto', width: 'auto' }} />
            )}
          </div>

          {/* Campos de composición — anuncio simple */}
          {kind === 'image' && !isPromo && (
            <div className="w-full max-w-xs space-y-3">
              <div><label className={label}>Titular</label><input value={headline} onChange={(e) => setHeadline(e.target.value)} className={field} /></div>
              <div><label className={label}>Subtítulo</label><input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className={field} /></div>
              <div><label className={label}>Precio</label><input value={price} onChange={(e) => setPrice(e.target.value)} className={field} /></div>
              <div><label className={label}>CTA</label><input value={cta} onChange={(e) => setCta(e.target.value)} className={field} /></div>
              <p className="text-[11px] leading-relaxed text-foreground/45">El bloque de texto se mantiene dentro de la zona segura (las bandas rojas marcan dónde la UI de Meta tapa el contenido).</p>
            </div>
          )}

          {/* Campos de composición — promoción / oferta */}
          {isPromo && (
            <div className="w-full max-w-xs space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/45">Lado foto (izquierda)</p>
              <div><label className={label}>Etiqueta (píldora)</label><input value={promoTag} onChange={(e) => setPromoTag(e.target.value)} className={field} /></div>
              <div><label className={label}>Titular</label><input value={headline} onChange={(e) => setHeadline(e.target.value)} className={field} /></div>
              <div><label className={label}>Categoría</label><input value={promoCategory} onChange={(e) => setPromoCategory(e.target.value)} className={field} /></div>
              <div><label className={label}>Sublínea</label><input value={promoSubline} onChange={(e) => setPromoSubline(e.target.value)} className={field} placeholder="2 ramos frescos al mes · S/ 130" /></div>
              <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/45">Panel (derecha)</p>
              <div><label className={label}>Etiqueta del panel</label><input value={promoPriceLabel} onChange={(e) => setPromoPriceLabel(e.target.value)} className={field} /></div>
              <div><label className={label}>Precio</label><input value={price} onChange={(e) => setPrice(e.target.value)} className={field} placeholder="S/ 130" /></div>
              <div><label className={label}>Nota del precio</label><input value={promoNote} onChange={(e) => setPromoNote(e.target.value)} className={field} /></div>
              <div><label className={label}>Beneficios (uno por línea)</label><textarea value={promoBullets} onChange={(e) => setPromoBullets(e.target.value)} rows={4} className={field + ' text-[13px]'} /></div>
              <div><label className={label}>Botón (CTA)</label><input value={promoCta} onChange={(e) => setPromoCta(e.target.value)} className={field} /></div>
              <div><label className={label}>Zonas de delivery (separadas por coma)</label><input value={promoZones} onChange={(e) => setPromoZones(e.target.value)} className={field} /></div>
            </div>
          )}
        </div>

        {/* Galería de ads del producto */}
        {gallery.length > 0 && (
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/50">Ads de este producto · toca para ampliar</p>
            <div className="flex flex-wrap gap-2">
              {gallery.map((a) => (
                <button key={a.id} onClick={() => enlarge(a)} disabled={a.status !== 'completed'} title={`${a.kind} · ${a.size} · ${a.status} — ampliar`}
                  className={`relative h-16 w-16 overflow-hidden rounded-sm border border-border ${a.status === 'completed' ? 'hover:border-rosa-500' : 'opacity-50'}`}>
                  <Thumb a={a} />
                  {a.kind === 'video' && a.status === 'completed' && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-ivory-50 drop-shadow">▶</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* ── Galería global: todos los anuncios ── */}
      <div>
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">
            Todos los anuncios{allAssets.length ? ` · ${allAssets.length}` : ''}
          </p>
          <button onClick={loadAllAssets} className="font-mono text-[10px] uppercase tracking-[0.08em] text-rosa-500 hover:text-rosa-600">↻ Actualizar</button>
        </div>
        {allAssets.length === 0 ? (
          <p className="border border-dashed border-border px-4 py-6 text-center text-sm text-foreground/45">
            Aún no hay anuncios generados. Genera el primero arriba.
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {allAssets.map((a) => {
              const p = a.product_id ? productById.get(a.product_id) : null;
              return (
                <button key={a.id} onClick={() => enlarge(a)} disabled={a.status !== 'completed'}
                  title={`${p ? p.name + ' · ' : ''}${a.kind} · ${a.size} · ${a.status} — ampliar`}
                  className={`group relative overflow-hidden rounded-sm border border-border ${a.status === 'completed' ? 'hover:border-rosa-500' : 'opacity-60'}`}>
                  <div className="aspect-square w-full bg-ivory-200">
                    <Thumb a={a} name={p?.name} />
                  </div>
                  <span className="absolute left-1 top-1 rounded-sm bg-ink-900/70 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.06em] text-ivory-50">
                    {a.kind === 'video' ? '▶' : '◧'} {a.size === 'vertical' ? '9:16' : '1:1'}
                  </span>
                  {p && (
                    <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-ink-900/80 to-transparent px-1.5 pb-1 pt-3 text-left text-[10px] text-ivory-50">
                      {p.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Lightbox: ampliar un anuncio ── */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/85 p-4 backdrop-blur-sm" onClick={() => setLightbox(null)}>
          <div className="relative flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {lightbox.kind === 'video'
              ? <video src={apiUrl('/api/admin/studio/asset/' + lightbox.id + '?raw=1')} controls autoPlay loop muted playsInline className="max-h-[80vh] max-w-full rounded-sm bg-ink-900 shadow-2xl" />
              : <img src={apiUrl('/api/admin/studio/asset/' + lightbox.id + '?raw=1')} alt="" className="max-h-[80vh] max-w-full rounded-sm shadow-2xl" />}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <a href={apiUrl('/api/admin/studio/asset/' + lightbox.id + '?raw=1&download=1')} download
                className="bg-rosa-500 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-600">⬇ Descargar</a>
              <button onClick={() => { const lb = lightbox; setLightbox(null); openAsset(lb); }}
                className="border border-ivory-50/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:border-ivory-50">✎ Usar en editor</button>
              <button onClick={() => setLightbox(null)}
                className="border border-ivory-50/40 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:border-ivory-50">Cerrar ✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Miniatura de un asset en las galerías. Un <img> no puede renderizar un mp4
// (salía en blanco): para video usamos <video> (muestra el primer fotograma).
function Thumb({ a, name }: { a: any; name?: string }) {
  if (a.status !== 'completed') {
    return <span className="flex h-full w-full items-center justify-center text-[10px] text-foreground/50">{a.status === 'failed' ? '✕' : '…'}</span>;
  }
  const src = apiUrl('/api/admin/studio/asset/' + a.id + '?raw=1');
  return a.kind === 'video'
    ? <video src={src} muted playsInline preload="metadata" className="pointer-events-none h-full w-full object-cover" />
    : <img src={src} alt={name || ''} loading="lazy" className="h-full w-full object-cover" />;
}

// Overlay de safe zones para el preview de VIDEO (el video no se compone en
// canvas en v1; el texto se añade desde Meta o usando la versión foto).
function VideoGuides({ size }: { size: AdSize }) {
  const d = AD_DIMS[size]; const s = SAFE[size];
  const pct = (v: number, total: number) => (v / total) * 100 + '%';
  return (
    <div className="pointer-events-none absolute inset-0">
      <div className="absolute inset-x-0 top-0 bg-red-600/20" style={{ height: pct(s.top, d.h) }} />
      <div className="absolute inset-x-0 bottom-0 bg-red-600/20" style={{ height: pct(s.bottom, d.h) }} />
      <div className="absolute inset-0 border-2 border-dashed border-white/70" style={{ top: pct(s.top, d.h), bottom: pct(s.bottom, d.h), left: pct(s.left, d.w), right: pct(s.right, d.w) }} />
    </div>
  );
}
