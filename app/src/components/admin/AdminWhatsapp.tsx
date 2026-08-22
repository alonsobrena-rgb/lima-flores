import { useCallback, useEffect, useRef, useState } from 'react';
import { adminGet, adminSend, apiUrl, AuthError, fileToDataUrl, resolveImg } from '@/lib/admin-api';
import { useProducts, type Product } from '@/lib/cart';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Contact = { id: string; name: string | null; phone: string; opted_out: boolean; created_at: string };
type Counts = { total: number; active: number };
type Template = {
  id: string; meta_id: string | null; name: string; language: string; category: string;
  status: string; body_text: string | null; header_kind: string | null; has_header: boolean;
  rejected_reason: string | null; created_at: string;
};
type Campaign = {
  id: string; name: string | null; template_id: string; template_name?: string;
  status: string; total: number; sent: number; failed: number; created_at: string;
  directo?: boolean;
};
type CampaignMsg = { id: string; phone: string; status: string; error: string | null; contact_name: string | null };
type CampaignDetail = Campaign & { messages: CampaignMsg[] };
type Conexion = {
  phoneNumberId: string; wabaId: string; appId: string; tokenEnv: string;
  numero: string; etiqueta: string; tokenPuesto: boolean;
};
type Estado = { conexion: Conexion; configurado: boolean; falta: string[]; puedeCrearPlantillas: boolean };
type Prueba = { ok: boolean; error?: string; aviso?: string; numero?: string | null; nombre?: string | null; waba?: string | null; calidad?: string | null };

// Los contactos son de Lima. El número se guarda tal cual si viene con `+`, y
// si no se le pone el +51 — antes había un desplegable de países acá y se
// quitó: era un paso más en cada alta, siempre en Perú, y uno que se podía
// dejar mal puesto sin notarlo. La regla vive en db/whatsapp-store.js.

// Clases compartidas (mismo lenguaje visual que AdminStudio).
const field = 'mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rosa-500';
const label = 'block text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/55';
const seg = (active: boolean) => `px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] border ${active ? 'border-rosa-500 bg-rosa-500 text-ivory-50' : 'border-border text-foreground/60 hover:border-ink-900 hover:text-ink-900'}`;

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cls = s === 'APPROVED' || s === 'DONE'
    ? 'bg-green-100 text-green-800'
    : s === 'REJECTED' || s === 'FAILED'
      ? 'bg-red-100 text-red-800'
      : 'bg-amber-100 text-amber-800';
  return <span className={`inline-block flex-shrink-0 whitespace-nowrap rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${cls}`}>{status}</span>;
}

type Sub = 'conexion' | 'contacts' | 'templates' | 'campaigns';

export function AdminWhatsapp({ onAuthError }: { onAuthError: () => void }) {
  const [sub, setSub] = useState<Sub>('contacts');
  const [estado, setEstado] = useState<Estado | null>(null);
  const fail = useCallback((e: unknown) => { if (e instanceof AuthError) { onAuthError(); return true; } return false; }, [onAuthError]);

  // Sin número conectado no se puede enviar nada: la primera pestaña que se abre
  // es la que hay que resolver.
  const cargarEstado = useCallback(async () => {
    try { return (await adminGet('/api/admin/wa/estado')) as Estado; }
    catch (e) { fail(e); return null; }
  }, [fail]);
  useEffect(() => {
    let vivo = true;
    cargarEstado().then((d) => {
      if (!vivo || !d) return;
      setEstado(d);
      if (!d.configurado) setSub('conexion');
    });
    return () => { vivo = false; };
  }, [cargarEstado]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2">
        {([['conexion', 'Conexión'], ['contacts', 'Contactos'], ['templates', 'Plantillas'], ['campaigns', 'Campañas']] as [Sub, string][]).map(([k, l]) => (
          <button key={k} onClick={() => setSub(k)} className={seg(sub === k) + ' rounded-sm'}>
            {l}{k === 'conexion' && estado && !estado.configurado ? ' ·' : ''}
          </button>
        ))}
      </div>
      {estado && !estado.configurado && sub !== 'conexion' && (
        <p className="mb-4 bg-amber-100 px-3 py-2.5 text-sm text-amber-900">
          WhatsApp todavía no está conectado: falta {estado.falta.join(', ')}. Se arregla en <strong>Conexión</strong>.
        </p>
      )}
      {sub === 'conexion' && <Conexion fail={fail} onSaved={(d) => setEstado(d)} />}
      {sub === 'contacts' && <Contacts fail={fail} />}
      {sub === 'templates' && <Templates fail={fail} />}
      {sub === 'campaigns' && <Campaigns fail={fail} />}
    </div>
  );
}

// ─── Conexión ─────────────────────────────────────────────────────────────────
// El número emisor y de qué variable de Railway sale el token. Por defecto es la
// misma de Instagram (IG_ACCESS_TOKEN): si las dos cuentas cuelgan del mismo
// Business de Meta, un solo token de System User sirve para las dos.
function Conexion({ fail, onSaved }: { fail: (e: unknown) => boolean; onSaved: (e: Estado) => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [form, setForm] = useState<Conexion | null>(null);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [prueba, setPrueba] = useState<Prueba | null>(null);

  const load = useCallback(async () => {
    try { const d = (await adminGet('/api/admin/wa/estado')) as Estado; setEstado(d); setForm(d.conexion); }
    catch (e) { if (!fail(e)) setErr((e as Error).message); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  if (!form || !estado) return <p className="py-10 text-center italic text-foreground/40">Cargando…</p>;
  const set = (k: keyof Conexion) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  const guardar = async () => {
    setErr(''); setNote(''); setPrueba(null); setBusy(true);
    try {
      const d = await adminSend('/api/admin/wa/conexion', 'POST', {
        phoneNumberId: form.phoneNumberId, wabaId: form.wabaId, appId: form.appId,
        tokenEnv: form.tokenEnv, numero: form.numero, etiqueta: form.etiqueta,
      });
      const nuevo = (await adminGet('/api/admin/wa/estado')) as Estado;
      setEstado(nuevo); setForm(nuevo.conexion); onSaved(nuevo);
      setNote(d.aviso || 'Conexión guardada.');
    } catch (e) { if (!fail(e)) setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const probar = async () => {
    setErr(''); setNote(''); setPrueba(null); setBusy(true);
    try { setPrueba(await adminSend('/api/admin/wa/conexion/probar', 'POST')); }
    catch (e) { if (!fail(e)) setPrueba({ ok: false, error: (e as Error).message }); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,460px)_1fr]">
      <div className="space-y-4">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50">El número que envía</p>

        <div>
          <label className={label}>ID del número de WhatsApp</label>
          <input value={form.phoneNumberId} onChange={set('phoneNumberId')} className={field + ' font-mono'} placeholder="1234567890123456" />
          <p className="mt-1 text-[11px] text-foreground/45">WhatsApp Manager → API Setup → <em>Phone number ID</em>. Son solo dígitos, no el +51.</p>
        </div>

        <div>
          <label className={label}>ID de la cuenta de WhatsApp Business (WABA)</label>
          <input value={form.wabaId} onChange={set('wabaId')} className={field + ' font-mono'} placeholder="1234567890123456" />
          <p className="mt-1 text-[11px] text-foreground/45">De ahí cuelgan las plantillas: sin esto no se pueden crear ni sincronizar.</p>
        </div>

        <div>
          <label className={label}>ID de la app de Meta (opcional)</label>
          <input value={form.appId} onChange={set('appId')} className={field + ' font-mono'} placeholder="1234567890123456" />
          <p className="mt-1 text-[11px] text-foreground/45">Solo hace falta para subir la <strong>foto</strong> del encabezado al crear una plantilla.</p>
        </div>

        <div>
          <label className={label}>Variable del token</label>
          <input value={form.tokenEnv} onChange={(e) => setForm({ ...form, tokenEnv: e.target.value.toUpperCase() })} className={field + ' font-mono'} placeholder="IG_ACCESS_TOKEN" />
          <p className="mt-1 text-[11px] leading-relaxed text-foreground/45">
            El token <strong>no se guarda en la base</strong>: acá va el nombre de la variable de Railway que lo contiene.
            Por defecto es <span className="font-mono">IG_ACCESS_TOKEN</span>, el mismo de Instagram. Tiene que empezar por <span className="font-mono">IG_</span> o <span className="font-mono">WA_</span>.
          </p>
          <p className={`mt-1.5 font-mono text-[11px] ${estado.conexion.tokenPuesto ? 'text-green-700' : 'text-red-700'}`}>
            {estado.conexion.tokenPuesto ? `✓ ${estado.conexion.tokenEnv} está puesta en el servidor` : `✕ ${estado.conexion.tokenEnv} no está puesta en el servidor`}
          </p>
        </div>

        <div className="flex gap-3">
          <div className="flex-1"><label className={label}>Número (solo para reconocerlo)</label><input value={form.numero} onChange={set('numero')} className={field} placeholder="+51 987 654 321" /></div>
          <div className="flex-1"><label className={label}>Etiqueta</label><input value={form.etiqueta} onChange={set('etiqueta')} className={field} placeholder="el de la tienda" /></div>
        </div>

        <div className="flex gap-2">
          <button onClick={guardar} disabled={busy} className="flex-1 bg-ink-900 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-ivory-50 hover:bg-rosa-500 disabled:opacity-50">{busy ? 'Guardando…' : 'Guardar conexión'}</button>
          <button onClick={probar} disabled={busy} className="border border-rosa-500 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.1em] text-rosa-600 hover:bg-rosa-500 hover:text-ivory-50 disabled:opacity-50">Probar</button>
        </div>
        {note && <p className="bg-green-100 px-3 py-2.5 text-sm text-green-800">{note}</p>}
        {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}
        {prueba && (
          prueba.ok
            ? <div className="bg-green-100 px-3 py-2.5 text-sm text-green-800">
                <p>✓ Meta contesta con ese token.</p>
                <p className="mt-1 font-mono text-[12px]">{prueba.numero || '—'} · {prueba.nombre || 'sin nombre verificado'}{prueba.calidad ? ` · calidad ${prueba.calidad}` : ''}</p>
                {prueba.waba && <p className="mt-0.5 font-mono text-[12px]">WABA: {prueba.waba}</p>}
                {prueba.aviso && <p className="mt-1 text-amber-900">{prueba.aviso}</p>}
              </div>
            : <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">✕ {prueba.error}</p>
        )}
      </div>

      <div className="space-y-4 border border-border bg-surface/40 p-5 text-[13px] leading-relaxed text-foreground/70">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50">El mismo token que Instagram</p>
        <p>
          WhatsApp e Instagram viven los dos en el Graph de Meta. Si el número y la cuenta de Instagram
          cuelgan del <strong>mismo Business</strong>, el token de System User que ya publica en Instagram
          sirve también acá: se deja <span className="font-mono">IG_ACCESS_TOKEN</span> y no hay que
          agregar ninguna variable nueva.
        </p>
        <p>
          Lo que <strong>no</strong> se hereda son los permisos. Al token le hacen falta además
          <span className="font-mono"> whatsapp_business_messaging</span> y
          <span className="font-mono"> whatsapp_business_management</span>; se agregan en
          <em> Business Settings → System Users</em> y se regenera el token. Por eso está el botón
          <strong> Probar</strong>: pregunta a Meta antes de que falle el primer envío.
        </p>
        <p>
          Si el número está en otro Business, crea su propio token, ponlo en Railway con un nombre que
          empiece por <span className="font-mono">WA_</span> y escríbelo arriba.
        </p>
        <p className="border-t border-border pt-3 text-foreground/55">
          Meta solo deja enviar <strong>plantillas aprobadas</strong> y solo a quien dio su
          consentimiento. La primera vez, una plantilla nueva tarda de minutos a horas en aprobarse.
        </p>
      </div>
    </div>
  );
}

// ─── Contactos ────────────────────────────────────────────────────────────────
function parseContactsText(text: string): { name: string; phone: string }[] {
  const out: { name: string; phone: string }[] = [];
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(/[,;\t]/).map((c) => c.trim());
    // Salta una posible fila de cabecera.
    if (i === 0 && /nombre|name|tel|phone|celular|whats/i.test(lines[i]) && !/\d{6,}/.test(lines[i])) continue;
    if (cols.length === 1) { out.push({ name: '', phone: cols[0] }); continue; }
    // Detecta cuál columna es el teléfono (la más "numérica").
    const digits = (s: string) => (s.match(/\d/g) || []).length;
    if (digits(cols[0]) > digits(cols[1])) out.push({ name: cols[1] || '', phone: cols[0] });
    else out.push({ name: cols[0] || '', phone: cols[1] });
  }
  return out.filter((c) => c.phone);
}

function Contacts({ fail }: { fail: (e: unknown) => boolean }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [counts, setCounts] = useState<Counts>({ total: 0, active: 0 });
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [paste, setPaste] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  // Envío suelto: cuál se está enviando y cómo salió cada uno.
  const [enviando, setEnviando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Record<string, { ok: boolean; msg: string }>>({});
  // Edición en la propia fila.
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const load = useCallback(async () => {
    try {
      const [c, t] = await Promise.all([
        adminGet('/api/admin/wa/contacts'),
        adminGet('/api/admin/wa/templates'),
      ]);
      setContacts(c.contacts || []); setCounts(c.counts || { total: 0, active: 0 });
      setTemplates((t.templates || []).filter((x: Template) => x.status === 'APPROVED'));
    } catch (e) { if (!fail(e)) setErr((e as Error).message); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!phone.trim()) { setErr('Ingresa un teléfono.'); return; }
    setErr(''); setBusy(true);
    try { await adminSend('/api/admin/wa/contacts', 'POST', { name: name.trim(), phone: phone.trim() }); setName(''); setPhone(''); await load(); }
    catch (e) { if (!fail(e)) setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const parsed = paste.trim() ? parseContactsText(paste) : [];
  const importPasted = async () => {
    if (!parsed.length) return;
    setErr(''); setBusy(true); setNote('');
    try { const r = await adminSend('/api/admin/wa/contacts/import', 'POST', { contacts: parsed }); setNote(`Importados ${r.added} · omitidos ${r.skipped}`); setPaste(''); await load(); }
    catch (e) { if (!fail(e)) setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    const text = await f.text();
    setPaste(text);
    e.target.value = '';
  };

  const del = async (id: string) => {
    try { await adminSend('/api/admin/wa/contacts/' + id, 'DELETE'); await load(); }
    catch (e) { if (!fail(e)) setErr((e as Error).message); }
  };

  const abrirEdicion = (c: Contact) => { setEditId(c.id); setEditName(c.name || ''); setEditPhone(c.phone); };
  const guardarEdicion = async (id: string) => {
    setErr('');
    try {
      await adminSend('/api/admin/wa/contacts/' + id, 'PATCH', { name: editName.trim(), phone: editPhone.trim() });
      setEditId(null); await load();
    } catch (e) { if (!fail(e)) setErr((e as Error).message); }
  };

  const tpl = templates.find((t) => t.id === templateId);
  // Enviar es hacia afuera y no se deshace: se confirma con nombre y número a la vista.
  const enviar = async (c: Contact) => {
    if (!templateId) { setErr('Elige primero la plantilla que quieres enviar.'); return; }
    const quien = c.name ? `${c.name} (${c.phone})` : c.phone;
    if (!window.confirm(`Enviar la plantilla «${tpl?.name}» a ${quien}?`)) return;
    setErr(''); setEnviando(c.id);
    setResultado((r) => { const n = { ...r }; delete n[c.id]; return n; });
    try {
      await adminSend('/api/admin/wa/contacts/' + c.id + '/enviar', 'POST', { templateId });
      setResultado((r) => ({ ...r, [c.id]: { ok: true, msg: 'Enviado' } }));
    } catch (e) {
      if (!fail(e)) setResultado((r) => ({ ...r, [c.id]: { ok: false, msg: (e as Error).message } }));
    } finally { setEnviando(null); }
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,360px)_1fr]">
      {/* Alta + importación */}
      <div className="min-w-0 space-y-7">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50">Agregar contacto</p>
          <div className="mt-2 space-y-2">
            <div><label className={label}>Nombre</label><input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="Ana Pérez" /></div>
            <div>
              <label className={label}>Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
                className="mt-1.5 w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rosa-500"
                placeholder="987654321" />
              <p className="mt-1 text-[11px] text-foreground/45">Queda como <span className="font-mono">+51…</span>. Si escribes el número con <span className="font-mono">+</span> adelante, manda lo que escribiste.</p>
            </div>
            <button onClick={add} disabled={busy} className="w-full bg-ink-900 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-500 disabled:opacity-50">Agregar</button>
          </div>
        </div>

        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50">Importar en lote</p>
          <p className="mt-1 text-[12px] leading-relaxed text-foreground/55">
            Sube un CSV o pega filas <span className="font-mono">nombre, teléfono</span> (una por línea).
            Los que no traigan <span className="font-mono">+</span> entran como <span className="font-mono">+51</span>.
          </p>
          <label className="mt-2 inline-block cursor-pointer border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900">
            Elegir CSV…<input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
          </label>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className={field + ' mt-2 font-mono text-[12px]'} placeholder={'Ana Pérez, 987654321\nLuis Díaz, 999888777'} />
          {parsed.length > 0 && <p className="mt-1.5 text-[12px] text-foreground/60">{parsed.length} contacto(s) detectado(s).</p>}
          <button onClick={importPasted} disabled={busy || !parsed.length} className="mt-2 w-full border border-rosa-500 py-2.5 font-mono text-[11px] uppercase tracking-[0.1em] text-rosa-600 hover:bg-rosa-500 hover:text-ivory-50 disabled:opacity-50">Importar {parsed.length || ''}</button>
          {note && <p className="mt-2 bg-green-100 px-3 py-2 text-sm text-green-800">{note}</p>}
        </div>
        {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}
      </div>

      {/* Tabla + envío suelto */}
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">{counts.total} contacto(s) · {counts.active} activos</p>
          <div className="w-full sm:w-auto sm:min-w-[240px]">
            <label className={label}>Plantilla para enviar</label>
            {templates.length
              ? <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={field}>
                  <option value="">— elegir —</option>
                  {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              : <p className="mt-1.5 text-[12px] text-foreground/55">No hay plantillas aprobadas. Crea una en <strong>Plantillas</strong>.</p>}
          </div>
        </div>

        {tpl && (
          <div className="mb-3 flex items-start gap-3 border border-border bg-surface/40 p-3">
            {tpl.has_header && <img src={apiUrl('/api/admin/wa/templates/' + tpl.id + '/header')} alt="" className="h-14 w-14 flex-shrink-0 rounded-sm object-cover" />}
            <p className="line-clamp-3 text-[12px] leading-snug text-foreground/65">{tpl.body_text?.replace(/\{\{1\}\}/g, 'nombre del contacto')}</p>
          </div>
        )}

        {/* overflow-auto, no solo -y: la tabla lleva celdas whitespace-nowrap con
            tres botones por fila, así que su min-content no baja de ~400px. Con el
            scroll solo vertical ese ancho empujaba el documento y aparecía una
            barra horizontal en toda la página. */}
        <div className="max-h-[560px] overflow-auto border border-border">
          {/* Ancho mínimo para que, al desplazarse dentro de su caja, las columnas
              no se aplasten: sin esto el nombre se partía en cuatro líneas mientras
              los botones quedaban cortados. */}
          <table className="w-full min-w-[420px] text-sm">
            <thead className="sticky top-0 bg-surface text-left text-[11px] uppercase tracking-[0.08em] text-foreground/50">
              <tr><th className="px-3 py-2 font-medium">Nombre</th><th className="px-3 py-2 font-medium">Teléfono</th><th className="px-3 py-2"></th></tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const r = resultado[c.id];
                return editId === c.id ? (
                  <tr key={c.id} className="border-t border-border bg-ivory-100">
                    <td className="px-3 py-2"><input value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full border border-border bg-background px-2 py-1 text-sm outline-none focus:border-rosa-500" /></td>
                    <td className="px-3 py-2"><input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="w-full border border-border bg-background px-2 py-1 font-mono text-[13px] outline-none focus:border-rosa-500" /></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button onClick={() => guardarEdicion(c.id)} className="font-mono text-[10px] uppercase tracking-[0.08em] text-rosa-600 hover:text-rosa-500">Guardar</button>
                      <button onClick={() => setEditId(null)} className="ml-3 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 hover:text-ink-900">Cancelar</button>
                    </td>
                  </tr>
                ) : (
                  <tr key={c.id} className="border-t border-border">
                    <td className="min-w-[130px] px-3 py-2 text-ink-800">
                      {c.name || <span className="text-foreground/40">—</span>}
                      {r && <span className={`ml-2 font-mono text-[10px] uppercase tracking-[0.08em] ${r.ok ? 'text-green-700' : 'text-red-700'}`}>{r.ok ? '✓ enviado' : '✕ ' + r.msg}</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-[13px] text-ink-800">{c.phone}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <button onClick={() => enviar(c)} disabled={!templateId || enviando === c.id}
                        className="border border-rosa-500 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-rosa-600 hover:bg-rosa-500 hover:text-ivory-50 disabled:cursor-not-allowed disabled:opacity-35">
                        {enviando === c.id ? 'Enviando…' : 'Enviar'}
                      </button>
                      <button onClick={() => abrirEdicion(c)} className="ml-3 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 hover:text-ink-900">Editar</button>
                      <button onClick={() => del(c.id)} className="ml-3 font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 hover:text-red-700">Eliminar</button>
                    </td>
                  </tr>
                );
              })}
              {!contacts.length && <tr><td colSpan={3} className="px-3 py-10 text-center italic text-foreground/40">Aún no hay contactos.</td></tr>}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-foreground/45">
          <strong>Enviar</strong> manda la plantilla elegida a ese contacto en el momento, con su nombre puesto en <span className="font-mono">{'{{1}}'}</span>.
          Para mandarla a varios a la vez, usa <strong>Campañas</strong>.
        </p>
      </div>
    </div>
  );
}

// ─── Plantillas ───────────────────────────────────────────────────────────────
type HeaderSel = { kind: 'none' } | { kind: 'upload'; dataUrl: string } | { kind: 'asset'; assetId: string; thumb: string };

function Templates({ fail }: { fail: (e: unknown) => boolean }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { const d = await adminGet('/api/admin/wa/templates'); setTemplates(d.templates || []); }
    catch (e) { if (!fail(e)) setErr((e as Error).message); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const sync = async () => {
    setErr(''); setBusy(true);
    try { const d = await adminSend('/api/admin/wa/templates/sync', 'POST'); setTemplates(d.templates || []); }
    catch (e) { if (!fail(e)) setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">{templates.length} plantilla(s)</p>
        <div className="flex gap-2">
          <button onClick={sync} disabled={busy} className="border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900 disabled:opacity-50">↻ Sincronizar estados</button>
          <button onClick={() => setShowForm((v) => !v)} className="bg-ink-900 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-500">{showForm ? 'Cerrar' : '+ Nueva plantilla'}</button>
        </div>
      </div>
      {err && <p className="mb-4 bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}

      {showForm && <TemplateForm fail={fail} onCreated={() => { setShowForm(false); load(); }} />}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {templates.map((t) => (
          <div key={t.id} className="flex min-w-0 gap-3 border border-border p-3">
            {t.has_header
              ? <img src={apiUrl('/api/admin/wa/templates/' + t.id + '/header')} alt="" className="h-20 w-20 flex-shrink-0 rounded-sm object-cover" />
              : <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-sm bg-ivory-200 text-[10px] text-foreground/40">sin foto</div>}
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="min-w-0 truncate font-mono text-[12px] text-ink-900">{t.name}</p>
                <StatusBadge status={t.status} />
              </div>
              <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-foreground/60">{t.body_text}</p>
              {t.rejected_reason && t.rejected_reason.toUpperCase() !== 'NONE'
                && <p className="mt-1 break-words text-[11px] text-red-700">{t.rejected_reason}</p>}
            </div>
          </div>
        ))}
        {!templates.length && !showForm && <p className="col-span-full py-10 text-center italic text-foreground/40">Aún no hay plantillas. Crea una para empezar.</p>}
      </div>
    </div>
  );
}

function TemplateForm({ fail, onCreated }: { fail: (e: unknown) => boolean; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [language, setLanguage] = useState('es');
  const [body, setBody] = useState('Hola {{1}}, en Lima Flores tenemos una promoción especial para ti 🌸');
  const [example, setExample] = useState('Ana');
  const [header, setHeader] = useState<HeaderSel>({ kind: 'none' });
  const [picker, setPicker] = useState<'upload' | 'asset'>('upload');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const insertVar = () => {
    const el = bodyRef.current; if (!el) { setBody((b) => b + '{{1}}'); return; }
    const s = el.selectionStart ?? body.length, e = el.selectionEnd ?? body.length;
    const next = body.slice(0, s) + '{{1}}' + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + 5; });
  };

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const dataUrl = await fileToDataUrl(f); setHeader({ kind: 'upload', dataUrl }); }
    catch { setErr('No se pudo leer la imagen.'); }
    e.target.value = '';
  };

  const preview = body.replace(/\{\{1\}\}/g, example || 'Ana');
  const headerThumb = header.kind === 'upload' ? header.dataUrl : header.kind === 'asset' ? header.thumb : '';

  const submit = async () => {
    if (!name.trim()) { setErr('Ponle un nombre a la plantilla.'); return; }
    if (!body.trim()) { setErr('El cuerpo del mensaje es obligatorio.'); return; }
    setErr(''); setBusy(true);
    const headerPayload =
      header.kind === 'upload' ? { dataBase64: header.dataUrl }
      : header.kind === 'asset' ? { assetId: header.assetId }
      : undefined;
    try {
      await adminSend('/api/admin/wa/templates', 'POST', {
        name: name.trim(), language, bodyText: body, bodyExample: example || 'Ana', header: headerPayload,
      });
      onCreated();
    } catch (e) { if (!fail(e)) setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-7 border border-border bg-surface/40 p-5 lg:grid-cols-[1fr_minmax(0,300px)]">
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1"><label className={label}>Nombre (se convierte a snake_case)</label><input value={name} onChange={(e) => setName(e.target.value)} className={field} placeholder="promo_dia_madre" /></div>
          <div className="w-24"><label className={label}>Idioma</label><input value={language} onChange={(e) => setLanguage(e.target.value)} className={field} /></div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className={label}>Cuerpo del mensaje</label>
            <button onClick={insertVar} className="font-mono text-[10px] uppercase tracking-[0.08em] text-rosa-500 hover:text-rosa-600">+ Insertar {'{nombre}'}</button>
          </div>
          <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} rows={5} className={field} />
          <p className="mt-1 text-[11px] text-foreground/45">Usa <span className="font-mono">{'{{1}}'}</span> donde quieras el nombre del cliente. Meta requiere un ejemplo:</p>
          <input value={example} onChange={(e) => setExample(e.target.value)} className={field + ' max-w-[200px]'} placeholder="Ejemplo para {{1}}" />
        </div>

        {/* Header con foto */}
        <div>
          <label className={label}>Foto del encabezado (opcional)</label>
          <div className="mt-1.5 flex">
            <button onClick={() => setPicker('upload')} className={seg(picker === 'upload') + ' rounded-l-sm'}>Subir</button>
            <button onClick={() => setPicker('asset')} className={seg(picker === 'asset') + ' -ml-px rounded-r-sm'}>Imagen IA (Studio)</button>
          </div>
          {picker === 'upload' && (
            <label className="mt-2 inline-block cursor-pointer border border-border px-3 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900">
              Elegir imagen…<input type="file" accept="image/*" onChange={onUpload} className="hidden" />
            </label>
          )}
          {picker === 'asset' && <StudioPicker fail={fail} onPick={(assetId, thumb) => setHeader({ kind: 'asset', assetId, thumb })} />}
          {header.kind !== 'none' && (
            <div className="mt-2 flex items-center gap-2">
              <img src={headerThumb} alt="" className="h-14 w-14 rounded-sm object-cover" />
              <button onClick={() => setHeader({ kind: 'none' })} className="font-mono text-[10px] uppercase tracking-[0.08em] text-foreground/40 hover:text-red-700">Quitar foto</button>
            </div>
          )}
        </div>

        <button onClick={submit} disabled={busy} className="w-full bg-rosa-500 py-3 font-mono text-[12px] uppercase tracking-[0.12em] text-ivory-50 hover:bg-rosa-600 disabled:opacity-50">{busy ? 'Creando…' : 'Crear plantilla en Meta'}</button>
        {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}
        <p className="text-[11px] leading-relaxed text-foreground/45">Meta revisa cada plantilla de marketing (de minutos a horas). Quedará en <strong>PENDING</strong> hasta su aprobación; usa “Sincronizar estados”.</p>
      </div>

      {/* Vista previa estilo WhatsApp */}
      <div>
        <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/50">Vista previa</p>
        <div className="rounded-lg p-4" style={{ background: '#ECE5DD' }}>
          <div className="ml-auto max-w-[260px] overflow-hidden rounded-lg bg-white shadow-sm">
            {headerThumb && <img src={headerThumb} alt="" className="h-36 w-full object-cover" />}
            <p className="whitespace-pre-wrap px-3 py-2 text-[13px] leading-snug text-ink-900">{preview}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Selector de imágenes IA del Marketing Studio: primero un producto, luego sus ads.
function StudioPicker({ fail, onPick }: { fail: (e: unknown) => boolean; onPick: (assetId: string, thumb: string) => void }) {
  const { products } = useProducts();
  const [pid, setPid] = useState<string | null>(null);
  const [assets, setAssets] = useState<{ id: string; status: string; kind: string }[]>([]);

  const loadAssets = useCallback(async (id: string) => {
    try { const d = await adminGet('/api/admin/studio/assets?productId=' + encodeURIComponent(id)); setAssets((d.assets || []).filter((a: { kind: string; status: string }) => a.kind === 'image' && a.status === 'completed')); }
    catch (e) { if (!fail(e)) setAssets([]); }
  }, [fail]);

  return (
    <div className="mt-2 space-y-2">
      <div className="grid max-h-[120px] grid-cols-6 gap-1.5 overflow-y-auto border border-border p-1.5">
        {(products as Product[]).map((p) => (
          <button key={p.id} onClick={() => { setPid(p.id); loadAssets(p.id); }} title={p.name}
            className={`aspect-square overflow-hidden rounded-sm border-2 ${pid === p.id ? 'border-rosa-500' : 'border-transparent hover:border-border'}`}>
            <img src={resolveImg(p.image)} alt={p.name} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {pid && (
        assets.length
          ? <div className="flex flex-wrap gap-1.5">
              {assets.map((a) => {
                const thumb = apiUrl('/api/admin/studio/asset/' + a.id + '?raw=1');
                return <button key={a.id} onClick={() => onPick(a.id, thumb)} className="h-14 w-14 overflow-hidden rounded-sm border border-border hover:border-rosa-500"><img src={thumb} alt="" className="h-full w-full object-cover" /></button>;
              })}
            </div>
          : <p className="text-[11px] text-foreground/45">Este producto no tiene imágenes IA generadas en el Studio.</p>
      )}
    </div>
  );
}

// ─── Campañas ─────────────────────────────────────────────────────────────────
function Campaigns({ fail }: { fail: (e: unknown) => boolean }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [campName, setCampName] = useState('');
  const [audMode, setAudMode] = useState<'all' | 'pick'>('all');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<CampaignDetail | null>(null);

  const load = useCallback(async () => {
    try {
      const [t, c, cp] = await Promise.all([
        adminGet('/api/admin/wa/templates'),
        adminGet('/api/admin/wa/contacts'),
        adminGet('/api/admin/wa/campaigns'),
      ]);
      setTemplates((t.templates || []).filter((x: Template) => x.status === 'APPROVED'));
      setContacts(c.contacts || []);
      setCampaigns(cp.campaigns || []);
    } catch (e) { if (!fail(e)) setErr((e as Error).message); }
  }, [fail]);
  useEffect(() => { load(); }, [load]);

  const tpl = templates.find((t) => t.id === templateId);
  const activeContacts = contacts.filter((c) => !c.opted_out);
  const audienceIds = audMode === 'all' ? activeContacts.map((c) => c.id) : [...picked];
  const sampleName = (audMode === 'pick' ? activeContacts.find((c) => picked.has(c.id)) : activeContacts[0])?.name || 'Ana';
  const previewBody = tpl?.body_text?.replace(/\{\{1\}\}/g, sampleName) || '';

  const togglePick = (id: string) => setPicked((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const pollCampaign = async (id: string) => {
    for (let i = 0; i < 600; i++) {
      const d: CampaignDetail = await adminGet('/api/admin/wa/campaigns/' + id);
      setProgress(d);
      if (d.status === 'done' || d.status === 'failed') return d;
      await sleep(2000);
    }
    return null;
  };

  const send = async () => {
    if (!templateId) { setErr('Elige una plantilla aprobada.'); return; }
    const audience = audMode === 'all' ? 'all' : [...picked];
    if (audMode === 'pick' && !picked.size) { setErr('Elige al menos un contacto.'); return; }
    setErr(''); setBusy(true); setProgress(null);
    try {
      const r = await adminSend('/api/admin/wa/campaigns', 'POST', { name: campName.trim() || undefined, templateId, audience });
      await pollCampaign(r.campaignId);
      await load();
    } catch (e) { if (!fail(e)) setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const pct = progress && progress.total ? Math.round(((progress.sent + progress.failed) / progress.total) * 100) : 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
      {/* Crear campaña */}
      <div className="space-y-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-foreground/50">Nueva campaña</p>

        <div>
          <label className={label}>Plantilla aprobada</label>
          {templates.length
            ? <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={field}>
                <option value="">— elegir —</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            : <p className="mt-1.5 text-[12px] text-foreground/55">No hay plantillas aprobadas todavía. Crea una en la pestaña <strong>Plantillas</strong> y espera la aprobación de Meta.</p>}
        </div>

        <div><label className={label}>Nombre de la campaña (opcional)</label><input value={campName} onChange={(e) => setCampName(e.target.value)} className={field} placeholder="Promo Día de la Madre" /></div>

        <div>
          <label className={label}>Audiencia</label>
          <div className="mt-1.5 flex">
            <button onClick={() => setAudMode('all')} className={seg(audMode === 'all') + ' rounded-l-sm'}>Todos ({activeContacts.length})</button>
            <button onClick={() => setAudMode('pick')} className={seg(audMode === 'pick') + ' -ml-px rounded-r-sm'}>Elegir</button>
          </div>
          {audMode === 'pick' && (
            <div className="mt-2 max-h-[220px] overflow-y-auto border border-border">
              {activeContacts.map((c) => (
                <label key={c.id} className="flex cursor-pointer items-center gap-2 border-b border-border px-3 py-1.5 text-sm last:border-0 hover:bg-ivory-100">
                  <input type="checkbox" checked={picked.has(c.id)} onChange={() => togglePick(c.id)} />
                  <span className="text-ink-800">{c.name || '—'}</span>
                  <span className="ml-auto font-mono text-[12px] text-foreground/55">{c.phone}</span>
                </label>
              ))}
              {!activeContacts.length && <p className="px-3 py-6 text-center italic text-foreground/40">Sin contactos.</p>}
            </div>
          )}
        </div>

        {tpl && (
          <div>
            <p className="mb-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/50">Vista previa (para {sampleName})</p>
            <div className="overflow-hidden rounded-lg bg-white shadow-sm" style={{ maxWidth: 280 }}>
              {tpl.has_header && <img src={apiUrl('/api/admin/wa/templates/' + tpl.id + '/header')} alt="" className="h-32 w-full object-cover" />}
              <p className="whitespace-pre-wrap px-3 py-2 text-[13px] leading-snug text-ink-900">{previewBody}</p>
            </div>
          </div>
        )}

        <button onClick={send} disabled={busy || !templateId} className="w-full bg-ink-900 py-3.5 font-mono text-[12px] uppercase tracking-[0.12em] text-ivory-50 hover:bg-rosa-500 disabled:opacity-50">
          {busy ? 'Enviando…' : `Enviar a ${audienceIds.length} contacto(s)`}
        </button>
        {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}

        {progress && (
          <div className="border border-border p-3">
            <div className="flex items-center justify-between text-[12px]"><span className="text-ink-800">{progress.status === 'sending' ? 'Enviando…' : progress.status === 'done' ? 'Completada' : 'Con errores'}</span><span className="font-mono text-foreground/55">{progress.sent + progress.failed}/{progress.total}</span></div>
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ivory-200"><div className="h-full bg-rosa-500 transition-all" style={{ width: pct + '%' }} /></div>
            <p className="mt-1.5 font-mono text-[11px] text-foreground/55">✓ {progress.sent} enviados · ✕ {progress.failed} fallidos</p>
          </div>
        )}
      </div>

      {/* Historial */}
      <div>
        <p className="mb-3 font-mono text-xs uppercase tracking-[0.08em] text-foreground/50">Campañas recientes</p>
        <div className="space-y-2">
          {campaigns.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 border border-border px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink-900">{c.name || c.template_name || c.id}</p>
                <p className="font-mono text-[11px] text-foreground/50">{new Date(c.created_at).toLocaleString('es-PE')} · {c.template_name}{c.directo ? ' · envío directo' : ''}</p>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span className="font-mono text-[12px] text-foreground/60">✓ {c.sent} · ✕ {c.failed} / {c.total}</span>
                <StatusBadge status={c.status} />
              </div>
            </div>
          ))}
          {!campaigns.length && <p className="py-10 text-center italic text-foreground/40">Aún no se han enviado campañas.</p>}
        </div>
      </div>
    </div>
  );
}
