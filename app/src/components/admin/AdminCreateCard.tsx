import { useEffect, useRef, useState } from 'react';
import { adminPostBlob, AuthError } from '@/lib/admin-api';

const NOTE_MAX = 220;
const TEMPLATES: { key: string; label: string }[] = [
  { key: 'atelier', label: 'Atelier' },
  { key: 'minimal', label: 'Minimal' },
  { key: 'jardin', label: 'Jardín' },
  { key: 'botanica', label: 'Botánica' },
  { key: 'blush', label: 'Blush' },
];
const TPL_LABEL: Record<string, string> = Object.fromEntries(TEMPLATES.map((t) => [t.key, t.label]));

// Crea una tarjeta de regalo a la medida (sin pedido). El estilo es opcional:
// si se deja en "Aleatorio", el servidor elige uno al azar.
export function AdminCreateCard({ onAuthError }: { onAuthError: () => void }) {
  const [recipient, setRecipient] = useState('');
  const [buyer, setBuyer] = useState('');
  const [note, setNote] = useState('');
  const [template, setTemplate] = useState(''); // '' = aleatorio
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [usedTemplate, setUsedTemplate] = useState('');
  const [busy, setBusy] = useState(false);
  const [busyPdf, setBusyPdf] = useState(false);
  const [err, setErr] = useState('');
  const urlRef = useRef<string | null>(null);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  const body = () => ({ note: note.trim(), recipient: recipient.trim(), buyer: buyer.trim(), template: template || undefined });

  const generate = async () => {
    if (!note.trim()) { setErr('Escribe el mensaje de la tarjeta.'); return; }
    setBusy(true); setErr('');
    try {
      const { blob, headers } = await adminPostBlob('/api/admin/card?format=png', body());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setPreviewUrl(url);
      setUsedTemplate(headers.get('X-Card-Template') || '');
    } catch (e: any) {
      if (e instanceof AuthError) onAuthError(); else setErr(e.message || 'No se pudo generar la tarjeta.');
    } finally { setBusy(false); }
  };

  const downloadPdf = async () => {
    if (!note.trim()) { setErr('Escribe el mensaje de la tarjeta.'); return; }
    setBusyPdf(true); setErr('');
    try {
      // Si ya hay una preview, reusamos su mismo estilo para que el PDF coincida.
      const { blob } = await adminPostBlob('/api/admin/card?format=pdf', { ...body(), template: (template || usedTemplate) || undefined });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const who = recipient.trim() ? '-' + recipient.trim().toLowerCase().replace(/\s+/g, '-') : '';
      a.href = url; a.download = `tarjeta${who}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: any) {
      if (e instanceof AuthError) onAuthError(); else setErr(e.message || 'No se pudo descargar el PDF.');
    } finally { setBusyPdf(false); }
  };

  const labelCls = 'block text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/55';
  const inputCls = 'mt-1.5 w-full border border-border bg-background px-4 py-3 outline-none focus:border-rosa-500';

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_300px]">
      {/* Formulario */}
      <div className="border border-border bg-surface-card p-6">
        <h2 className="font-display text-2xl font-medium italic text-ink-900">Nueva tarjeta</h2>
        <p className="mt-1 text-sm text-foreground/60">Completa los datos y genera una tarjeta de regalo plegada (PDF de 2 caras, lista para imprimir y doblar).</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Para (destinatario)</label>
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Valentina" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>De (firma)</label>
            <input value={buyer} onChange={(e) => setBuyer(e.target.value)} placeholder="Alonso" className={inputCls} />
          </div>
        </div>

        <div className="mt-4">
          <label className={labelCls}>Mensaje</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, NOTE_MAX))}
            rows={4}
            placeholder="Que cada pétalo te recuerde lo mucho que te quiero."
            className={inputCls + ' resize-none'}
          />
          <div className="mt-1 text-right font-mono text-[10px] text-foreground/40">{note.length} / {NOTE_MAX}</div>
        </div>

        <div className="mt-2">
          <label className={labelCls}>Estilo</label>
          <select value={template} onChange={(e) => setTemplate(e.target.value)} className={inputCls}>
            <option value="">Aleatorio</option>
            {TEMPLATES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button onClick={generate} disabled={busy} className="bg-ink-900 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ivory-50 hover:bg-rosa-500 disabled:opacity-50">
            {busy ? 'Generando…' : 'Generar tarjeta'}
          </button>
          <button onClick={downloadPdf} disabled={busyPdf} className="border border-ink-900 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-900 hover:bg-ink-900 hover:text-ivory-50 disabled:opacity-50">
            {busyPdf ? 'Preparando…' : '⬇ Descargar PDF'}
          </button>
        </div>

        {err && <p className="mt-4 bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}
      </div>

      {/* Previsualización */}
      <div className="border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground/45">Previsualización</span>
          {usedTemplate && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-rosa-500">{TPL_LABEL[usedTemplate] || usedTemplate}</span>}
        </div>
        {previewUrl ? (
          <img src={previewUrl} alt="Tarjeta" className="mt-3 w-full rounded-sm border border-border shadow-sm" />
        ) : (
          <div className="mt-3 flex aspect-[363/1028] items-center justify-center rounded-sm border border-dashed border-border text-center text-[11px] text-foreground/40">
            Genera una tarjeta<br />para verla aquí
          </div>
        )}
        {previewUrl && <p className="mt-2 text-[10px] text-foreground/40">Arriba: exterior (portada + datos). Abajo: interior con el mensaje.</p>}
      </div>
    </div>
  );
}
