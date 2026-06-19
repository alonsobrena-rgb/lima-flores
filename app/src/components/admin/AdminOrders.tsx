import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGet, adminSend, adminGetBlob, adminPostBlob, AuthError } from '@/lib/admin-api';

type Order = Record<string, any>;
const STATUSES = [
  { key: 'pending', label: 'Pendientes' },
  { key: 'dispatched', label: 'Despachados' },
  { key: 'cancelled', label: 'Cancelados' },
  { key: 'all', label: 'Todos' },
];

const soles = (n: any) => 'S/ ' + (Number(n) || 0).toFixed(2);
const fmtDate = (iso: any) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' }); } catch { return String(iso); } };
const badgeCls: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  dispatched: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-red-100 text-red-800',
};

export function AdminOrders({ onAuthError }: { onAuthError: () => void }) {
  const [status, setStatus] = useState('pending');
  const [orders, setOrders] = useState<Order[]>([]);
  const [meta, setMeta] = useState('cargando…');
  const statusRef = useRef(status);
  statusRef.current = status;

  const load = useCallback(async (st: string) => {
    setMeta('cargando…');
    try {
      const data = await adminGet('/api/admin/orders?status=' + encodeURIComponent(st));
      const list: Order[] = data.orders || [];
      setOrders(list);
      setMeta(`${list.length} pedido${list.length === 1 ? '' : 's'} · ${st}`);
    } catch (e: any) {
      if (e instanceof AuthError) { onAuthError(); return; }
      setMeta('error: ' + e.message);
      setOrders([]);
    }
  }, [onAuthError]);

  useEffect(() => { load(status); }, [status, load]);

  // auto-refresh cada 30s
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) load(statusRef.current); }, 30000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (id: string, action: 'dispatch' | 'cancel', confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    try {
      const data = await adminSend(`/api/admin/orders/${encodeURIComponent(id)}/${action}`, 'POST');
      if (action === 'dispatch') alert(`Despachado.\nCabify ID: ${data.cabify_order_id || '(sin id)'}`);
      load(statusRef.current);
    } catch (e: any) {
      if (e instanceof AuthError) { onAuthError(); return; }
      alert('Error: ' + e.message);
    }
  };

  return (
    <>
      <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">{meta}</p>

      <div className="mt-5 flex gap-1 border-b border-border">
        {STATUSES.map((s) => (
          <button key={s.key} onClick={() => setStatus(s.key)}
            className={`border-b-2 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.08em] transition-colors ${status === s.key ? 'border-rosa-500 text-ink-900' : 'border-transparent text-foreground/50 hover:text-ink-900'}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {orders.length === 0 ? (
          <div className="py-20 text-center font-display text-xl italic text-foreground/50">No hay pedidos {status === 'all' ? 'todavía' : 'en este estado'}.</div>
        ) : orders.map((o) => (
          <div key={o.id} className="grid gap-5 border border-border bg-surface-card p-5 sm:grid-cols-[1fr_auto] sm:p-6">
            <div className="min-w-0">
              <div className="break-words font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50">
                {o.id} · <span className={`rounded px-2 py-0.5 ${badgeCls[o.status] || 'bg-ivory-200'}`}>{o.status}</span> · {fmtDate(o.created_at)}
              </div>
              <h3 className="mt-2 font-display text-2xl italic text-ink-900">Para {o.recipient_name}</h3>
              <dl className="mt-3 grid gap-1 text-sm">
                <Row k="Entrega" v={`${o.delivery_date ?? '—'} · ${o.delivery_time ?? ''}`} />
                <Row k="Dirección" v={o.recipient_address} />
                <Row k="Tel. recibe" v={o.recipient_phone} />
                {o.card_note && <Row k="Tarjeta" v={`"${o.card_note}"`} />}
                {o.card_anonymous && <Row k="Firma" v={<span className="rounded bg-amber-100 px-2 py-0.5 text-[12px] font-medium text-amber-800">🕶 Anónimo · no incluir nombre de quien envía</span>} />}
                <Row k="Comprador" v={`${o.buyer_name ?? ''} · ${o.buyer_email ?? ''} · ${o.buyer_phone ?? ''}`} />
                <Row k="Pago" v={o.payment_method} />
              </dl>
              <div className="mt-3 border-t border-dashed border-border pt-3">
                {(Array.isArray(o.items) ? o.items : []).map((it: any, i: number) => (
                  <div key={i} className="flex justify-between py-0.5 text-sm"><span>{it.name || it.id} × {it.qty}</span><span>{soles((Number(it.price) || 0) * (Number(it.qty) || 0))}</span></div>
                ))}
                <div className="mt-1.5 flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>{soles(o.total)}</span></div>
              </div>
            </div>
            <div className="flex min-w-[170px] flex-col gap-2.5">
              {o.status === 'pending' && (
                <>
                  <button onClick={() => act(o.id, 'dispatch', `¿Despachar pedido ${o.id} a Cabify? Crea la orden REAL.`)} className="bg-ink-900 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-500">Despachar a Cabify</button>
                  <button onClick={() => act(o.id, 'cancel', `¿Cancelar pedido ${o.id}? No se puede deshacer.`)} className="border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/60 hover:border-red-700 hover:text-red-700">Cancelar pedido</button>
                </>
              )}
              {(o.recipient_lat && o.recipient_lng) && (
                <a href={`https://www.google.com/maps?q=${o.recipient_lat},${o.recipient_lng}`} target="_blank" rel="noopener noreferrer" className="border border-border px-4 py-2.5 text-center text-sm text-foreground/70 hover:border-ink-900 hover:text-ink-900">📍 Ver en mapa</a>
              )}
              {o.card_note && <OrderCard order={o} onAuthError={onAuthError} />}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// Tarjeta de regalo PLEGADA: previsualización (caras apiladas) renderizada en el
// servidor + descarga del PDF de 2 páginas listo para imprimir y doblar.
function OrderCard({ order, onAuthError }: { order: Order; onAuthError: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tpl, setTpl] = useState(order.card_template || '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);       // descarga PDF
  const [redoing, setRedoing] = useState(false); // rediseñar
  const [zoom, setZoom] = useState(false);
  const urlRef = useRef<string | null>(null);

  const showBlob = (b: Blob, template?: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const u = URL.createObjectURL(b);
    urlRef.current = u;
    setPreviewUrl(u);
    if (template) setTpl(template);
  };

  useEffect(() => {
    let alive = true;
    setErr('');
    setPreviewUrl(null);
    setTpl(order.card_template || '');
    adminGetBlob(`/api/admin/orders/${order.id}/card?format=png`)
      .then((b) => { if (alive) showBlob(b); })
      .catch((e) => { if (!alive) return; if (e instanceof AuthError) onAuthError(); else setErr(e.message || 'No se pudo generar la tarjeta'); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, order.card_note, order.recipient_name, order.buyer_name, order.card_template, onAuthError]);

  // Libera el último objectURL al desmontar.
  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setZoom(false); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [zoom]);

  // Rediseña: el servidor elige un estilo NUEVO al azar y reemplaza el cache.
  const redesign = async () => {
    setRedoing(true); setErr('');
    try {
      const { blob, headers } = await adminPostBlob(`/api/admin/orders/${order.id}/card?format=png`);
      showBlob(blob, headers.get('X-Card-Template'));
    } catch (e: any) {
      if (e instanceof AuthError) onAuthError(); else setErr(e.message || 'No se pudo rediseñar la tarjeta');
    } finally { setRedoing(false); }
  };

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const b = await adminGetBlob(`/api/admin/orders/${order.id}/card?format=pdf`);
      const url = URL.createObjectURL(b);
      const a = document.createElement('a');
      a.href = url; a.download = `tarjeta-${order.id}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      if (e instanceof AuthError) onAuthError(); else setErr(e.message || 'No se pudo descargar el PDF');
    } finally { setBusy(false); }
  };

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-sm border border-border bg-surface p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-foreground/45">Tarjeta plegada{tpl ? ` · ${tpl}` : ''}</span>
      {err ? (
        <p className="text-[11px] text-red-600">{err}</p>
      ) : previewUrl ? (
        <button type="button" onClick={() => setZoom(true)} title="Click para ampliar"
          className="group relative self-center overflow-hidden rounded-sm border border-border shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-rosa-500">
          <img src={previewUrl} alt={`Tarjeta ${order.id}`} className="block w-full max-w-[150px]" />
          {redoing && <span className="absolute inset-0 flex items-center justify-center bg-ivory-50/70 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-900">rediseñando…</span>}
          <span className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink-900/55 to-transparent pb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-ivory-50 opacity-0 transition-opacity group-hover:opacity-100">⤢ Ampliar</span>
        </button>
      ) : (
        <div className="self-center text-[11px] text-foreground/45">generando…</div>
      )}
      <div className="flex gap-2">
        <button onClick={redesign} disabled={redoing || !previewUrl} title="Elige un estilo nuevo al azar"
          className="flex-1 border border-ink-900 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-900 hover:bg-ink-900 hover:text-ivory-50 disabled:opacity-40">{redoing ? '…' : '↻ Rediseñar'}</button>
        <button onClick={downloadPdf} disabled={busy} className="flex-1 bg-ink-900 px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ivory-50 hover:bg-rosa-500 disabled:opacity-50">{busy ? '…' : '⬇ PDF'}</button>
      </div>

      {zoom && previewUrl && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-900/85 p-4 md:p-8" onClick={() => setZoom(false)} role="dialog" aria-modal="true" aria-label={`Tarjeta del pedido ${order.id}`}>
          <button type="button" onClick={() => setZoom(false)} aria-label="Cerrar" className="absolute right-5 top-5 text-2xl text-ivory-50/80 hover:text-ivory-50">✕</button>
          <div className="flex max-h-full flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <img src={previewUrl} alt={`Tarjeta ${order.id}`} className="max-h-[78vh] w-auto rounded-sm shadow-2xl" />
            <div className="flex gap-3">
              <button onClick={redesign} disabled={redoing} className="border border-ivory-50/70 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ivory-50 hover:bg-ivory-50 hover:text-ink-900 disabled:opacity-50">{redoing ? 'rediseñando…' : '↻ Rediseñar'}</button>
              <button onClick={downloadPdf} disabled={busy} className="bg-rosa-500 px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ivory-50 hover:bg-rosa-600 disabled:opacity-50">{busy ? 'preparando…' : '⬇ Descargar PDF'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const Row = ({ k, v }: { k: string; v: any }) => (
  <div className="grid grid-cols-[92px_1fr] gap-3">
    <dt className="font-mono text-[11px] uppercase tracking-[0.06em] text-foreground/50">{k}</dt>
    {/* min-w-0 + break-words: tokens largos sin espacios (email, id) se cortan y
        no se salen de la tarjeta en móvil. */}
    <dd className="min-w-0 break-words text-ink-800">{v || '—'}</dd>
  </div>
);
