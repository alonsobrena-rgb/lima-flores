import { useEffect, useState } from 'react';
import { adminGet, adminSend, AuthError } from '@/lib/admin-api';

type Sub = {
  id: string;
  createdAt: string;
  status: string;
  planKey: string;
  model: string;
  tier: string;
  amount: number;
  intervalCount: number;
  buyer: { name: string; email: string; phone: string };
  recipient: { name: string; phone: string; address: string; district: string | null };
  deliveryPref: string | null;
  lastEvent: string | null;
  lastEventAt: string | null;
};

const soles = (n: any) => 'S/ ' + (Number(n) || 0).toFixed(0);
const fmtDate = (iso: any) => { if (!iso) return '—'; try { return new Date(iso).toLocaleDateString('es-PE', { dateStyle: 'medium' }); } catch { return String(iso); } };
const billing = (s: Sub) => s.intervalCount === 1 ? `${soles(s.amount)} / mes` : `${soles(s.amount)} cada ${s.intervalCount} meses`;

const STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  paused: 'bg-amber-100 text-amber-800',
  cancelled: 'bg-red-100 text-red-700',
};

export function AdminSubscriptions({ onAuthError }: { onAuthError: () => void }) {
  const [subs, setSubs] = useState<Sub[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const d = await adminGet('/api/admin/subscriptions');
        setSubs((d as any).subscriptions || []);
      } catch (e) {
        if (e instanceof AuthError) onAuthError();
        else setErr((e as any)?.message || 'No se pudieron cargar las suscripciones.');
      } finally { setLoading(false); }
    })();
  }, [onAuthError]);

  const [canceling, setCanceling] = useState<string | null>(null);
  const cancel = async (id: string) => {
    if (!window.confirm('¿Cancelar esta suscripción? Dejará de cobrarse el próximo periodo (no reembolsa cobros ya hechos).')) return;
    setCanceling(id);
    try {
      await adminSend(`/api/admin/subscriptions/${id}/cancel`, 'POST');
      setSubs((list) => list.map((s) => (s.id === id ? { ...s, status: 'cancelled' } : s)));
    } catch (e) {
      if (e instanceof AuthError) onAuthError();
      else window.alert((e as any)?.message || 'No se pudo cancelar.');
    } finally { setCanceling(null); }
  };

  const active = subs.filter((s) => s.status === 'active').length;

  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">{subs.length} suscripción(es) · {active} activa(s)</p>
        <p className="text-[12px] text-foreground/45">Las respuestas de los suscriptores las atiendes tú — aquí solo se listan.</p>
      </div>

      {loading && <p className="py-10 text-center italic text-foreground/40">Cargando…</p>}
      {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}

      {!loading && !err && (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[820px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/50">
                <th className="px-3 py-2.5">Suscriptor</th>
                <th className="px-3 py-2.5">Plan</th>
                <th className="px-3 py-2.5">Cobro</th>
                <th className="px-3 py-2.5">Entrega</th>
                <th className="px-3 py-2.5">Estado</th>
                <th className="px-3 py-2.5">Alta</th>
                <th className="px-3 py-2.5">Último evento</th>
                <th className="px-3 py-2.5">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {!subs.length && <tr><td colSpan={8} className="px-3 py-12 text-center italic text-foreground/40">Aún no hay suscripciones.</td></tr>}
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-border/60 align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium text-ink-900">{s.buyer.name || '—'}</p>
                    <p className="text-[12px] text-foreground/55">{s.buyer.email}</p>
                    <p className="text-[12px] text-foreground/55">{s.buyer.phone}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="capitalize text-ink-900">{s.tier}</p>
                    <p className="text-[12px] text-foreground/50">Modelo {s.model}</p>
                  </td>
                  <td className="px-3 py-3 text-ink-800">{billing(s)}</td>
                  <td className="px-3 py-3">
                    <p className="text-ink-900">{s.recipient.name || '—'}</p>
                    <p className="text-[12px] text-foreground/55">{s.recipient.district || ''}</p>
                    {s.deliveryPref && <p className="text-[12px] text-foreground/45">{s.deliveryPref}</p>}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLE[s.status] || 'bg-ivory-200 text-foreground/60'}`}>{s.status}</span>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-foreground/60">{fmtDate(s.createdAt)}</td>
                  <td className="px-3 py-3 text-[12px] text-foreground/60">{s.lastEvent ? <>{s.lastEvent}<br /><span className="text-foreground/40">{fmtDate(s.lastEventAt)}</span></> : '—'}</td>
                  <td className="px-3 py-3">
                    {s.status === 'active'
                      ? <button disabled={canceling === s.id} onClick={() => cancel(s.id)} className="rounded border border-red-300 px-2.5 py-1 text-[12px] font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50">{canceling === s.id ? 'Cancelando…' : 'Cancelar'}</button>
                      : <span className="text-[12px] text-foreground/40">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
