import { useCallback, useEffect, useState } from 'react';
import { adminGet, adminSend, apiUrl, AuthError } from '@/lib/admin-api';

/**
 * Publicador de Instagram.
 *
 * Lo que hace por debajo: la cola vive en la BD (`ig_queue`), un vigía del
 * servidor la mira cada minuto y publica lo que venció por la Content Publishing
 * API de Meta. Instagram **no programa por API** — la hora la ponemos nosotros.
 *
 * Dos cosas de esta pantalla son decisiones, no adorno:
 *
 * - **El interruptor arranca apagado y se enciende a mano.** Publicar es hacia
 *   afuera; que un deploy encienda solo una cuenta pública es exactamente lo que
 *   no debe pasar. Mientras está apagado, la cola se llena y no sale nada.
 * - **El caption se edita acá y se ve entero.** Sale del copy que ya está escrito
 *   en `ads.json` / `videos.json`, pero lo último que se publica tiene que poder
 *   mirarse antes, como cualquier pieza.
 */
type Item = {
  id: string; kind: 'image' | 'reel'; origen: string | null; caption: string;
  mime: string; bytes: number; scheduled_at: string; status: string;
  permalink: string | null; error: string | null; attempts: number;
  cuenta_id: string | null;
};
type Cuenta = {
  id: string; ig_user_id: string; usuario: string | null; etiqueta: string | null;
  token_env: string; activa: boolean; tokenPuesto: boolean;
};
type Estado = {
  configurado: boolean; falta: string[];
  ajustes: { activo: boolean; porDia: number; horas: string };
  cupo: { usado: number; tope: number } | null;
  resumen: {
    enCola: number; publicando: number; publicadas: number; fallidas: number;
    pausadas: number; proxima: string | null; publicadas24h: number;
  };
  sinCargar: number;
  cuentas: Cuenta[];
};

const field = 'w-full border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-rosa-500';
const label = 'block text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/55';
const boton = 'press border border-border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/70 hover:border-ink-900 hover:text-ink-900 disabled:opacity-40';

// Las horas se guardan en UTC y el negocio vive en Lima: se muestra siempre en
// hora de Lima, con el día, para que «mañana 9 a. m.» se lea como eso.
const enLima = (iso: string) => new Date(iso).toLocaleString('es-PE', {
  timeZone: 'America/Lima', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
});

/** El valor para <input type="datetime-local">, en hora de Lima. */
const paraInput = (iso: string) => {
  const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000);
  return d.toISOString().slice(0, 16);
};
/** Y de vuelta: lo que escribe el usuario es hora de Lima. */
const desdeInput = (v: string) => new Date(new Date(v + ':00Z').getTime() + 5 * 3600 * 1000).toISOString();

function Insignia({ status }: { status: string }) {
  const cls = status === 'published' ? 'bg-green-100 text-green-800'
    : status === 'failed' ? 'bg-red-100 text-red-800'
    : status === 'publishing' ? 'bg-blue-100 text-blue-800'
    : status === 'paused' ? 'bg-gray-200 text-gray-700'
    : 'bg-amber-100 text-amber-800';
  const txt = { queued: 'En cola', publishing: 'Publicando', published: 'Publicada', failed: 'Falló', paused: 'Pausada' }[status] || status;
  return <span className={`inline-block rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${cls}`}>{txt}</span>;
}

export function AdminPublicador({ onAuthError }: { onAuthError: () => void }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [cola, setCola] = useState<Item[]>([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState('');
  const [aviso, setAviso] = useState('');
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  const [nueva, setNueva] = useState({ igUserId: '', usuario: '', etiqueta: '', tokenEnv: 'IG_ACCESS_TOKEN' });
  const [destino, setDestino] = useState<string>('');

  const fail = useCallback((e: unknown) => {
    if (e instanceof AuthError) { onAuthError(); return; }
    setErr(e instanceof Error ? e.message : String(e));
  }, [onAuthError]);

  const refrescar = useCallback(async () => {
    try {
      const [e, c] = await Promise.all([adminGet('/api/admin/ig/estado'), adminGet('/api/admin/ig/cola')]);
      setEstado(e as Estado);
      setCola((c as { cola: Item[] }).cola);
      setErr('');
    } catch (e) { fail(e); }
    finally { setCargando(false); }
  }, [fail]);

  useEffect(() => { refrescar(); }, [refrescar]);
  // Mientras haya algo publicándose, la pantalla se refresca sola: un reel tarda
  // un par de minutos en procesarse del lado de Meta.
  useEffect(() => {
    if (!estado?.resumen.publicando) return;
    const t = setInterval(refrescar, 15000);
    return () => clearInterval(t);
  }, [estado?.resumen.publicando, refrescar]);

  const accion = async (fn: () => Promise<unknown>) => {
    try { await fn(); await refrescar(); } catch (e) { fail(e); }
  };

  if (cargando) return <p className="text-sm text-foreground/50">Cargando el publicador…</p>;
  if (!estado) return <p className="text-sm text-red-700">{err || 'No se pudo leer el estado.'}</p>;

  const { ajustes, resumen } = estado;

  return (
    <div className="space-y-8">
      {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}
      {aviso && <p className="bg-amber-100 px-3 py-2.5 text-sm text-amber-900">{aviso}</p>}

      {/* ── Estado y el interruptor ── */}
      <section className="border border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl italic text-ink-900">Publicador de Instagram</h2>
            <p className="mt-1 text-sm text-foreground/60">
              {ajustes.porDia} al día · {ajustes.horas.split(',').map((h) => `${h}:00`).join(' · ')} (hora de Lima)
            </p>
          </div>
          <button
            onClick={() => accion(async () => {
              const r = await adminSend('/api/admin/ig/ajustes', 'POST', { activo: !ajustes.activo }) as { aviso?: string };
              setAviso(r.aviso || '');
            })}
            className={`press px-5 py-3 font-mono text-[12px] uppercase tracking-[0.1em] ${ajustes.activo ? 'bg-green-700 text-white' : 'border border-border text-foreground/70 hover:border-ink-900'}`}
          >
            {ajustes.activo ? '● Publicando automáticamente' : '○ Apagado — encender'}
          </button>
        </div>

        {!estado.configurado && (
          <p className="mt-4 bg-amber-100 px-3 py-2.5 text-sm text-amber-900">
            Falta configurar en el servidor: <strong>{estado.falta.join(', ')}</strong>. Sin eso la cola
            se llena pero no sale nada. IG_USER_ID e IG_ACCESS_TOKEN salen de la cuenta de Instagram
            Business conectada a la página de Facebook; el token necesita el permiso
            <code className="mx-1 bg-black/5 px-1">instagram_content_publish</code>.
          </p>
        )}

        <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ['En cola', resumen.enCola],
            ['Publicadas', resumen.publicadas],
            ['Fallidas', resumen.fallidas],
            ['Últimas 24 h', `${resumen.publicadas24h}${estado.cupo ? ` / ${estado.cupo.tope}` : ''}`],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <dt className={label}>{k}</dt>
              <dd className="font-display text-2xl text-ink-900">{v}</dd>
            </div>
          ))}
        </dl>

        {resumen.proxima && (
          <p className="mt-4 text-sm text-foreground/60">
            La siguiente sale el <strong className="text-ink-900">{enLima(resumen.proxima)}</strong>.
          </p>
        )}
      </section>

      {/* ── Cuentas ── */}
      <section className="border border-border p-5">
        <h3 className="font-display text-xl italic text-ink-900">Cuentas</h3>
        <p className="mt-1 max-w-2xl text-sm text-foreground/60">
          Puedes publicar en varias. De cada cuenta se guarda acá el id numérico que da Meta;
          <strong className="text-ink-900"> el token no se guarda en la base de datos</strong> — la
          fila solo dice en qué variable del servidor está. Si todas las cuentas son del mismo
          Business de Meta, el mismo <code className="bg-black/5 px-1">IG_ACCESS_TOKEN</code> sirve
          para todas.
        </p>

        {!!estado.cuentas.length && (
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {estado.cuentas.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                <span className="font-display text-lg text-ink-900">{c.usuario || c.ig_user_id}</span>
                {c.etiqueta && <span className="text-sm text-foreground/55">{c.etiqueta}</span>}
                <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/45">
                  id {c.ig_user_id} · {c.token_env}
                </span>
                <span className={`rounded-sm px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${c.tokenPuesto ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-900'}`}>
                  {c.tokenPuesto ? 'token puesto' : 'falta el token'}
                </span>
                <span className="ml-auto flex gap-2">
                  <button className={boton} onClick={() => accion(() => adminSend(`/api/admin/ig/cuentas/${c.id}`, 'PATCH', { activa: !c.activa }))}>
                    {c.activa ? 'Activa' : 'Pausada'}
                  </button>
                  <button className={boton} onClick={() => { if (confirm(`¿Quitar ${c.usuario || c.ig_user_id}?`)) accion(() => adminSend(`/api/admin/ig/cuentas/${c.id}`, 'DELETE')); }}>Quitar</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <div>
            <label className={label}>Id de Meta</label>
            <input value={nueva.igUserId} onChange={(e) => setNueva({ ...nueva, igUserId: e.target.value })} placeholder="178414…" className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className={label}>Usuario</label>
            <input value={nueva.usuario} onChange={(e) => setNueva({ ...nueva, usuario: e.target.value })} placeholder="@lima_flores" className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className={label}>Etiqueta</label>
            <input value={nueva.etiqueta} onChange={(e) => setNueva({ ...nueva, etiqueta: e.target.value })} placeholder="la principal" className={`${field} mt-1.5`} />
          </div>
          <div>
            <label className={label}>Variable del token</label>
            <input value={nueva.tokenEnv} onChange={(e) => setNueva({ ...nueva, tokenEnv: e.target.value })} className={`${field} mt-1.5 font-mono text-[12px]`} />
          </div>
          <button
            className="press mt-6 border border-border px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/70 hover:border-ink-900 hover:text-ink-900"
            onClick={() => accion(async () => {
              await adminSend('/api/admin/ig/cuentas', 'POST', nueva);
              setNueva({ igUserId: '', usuario: '', etiqueta: '', tokenEnv: 'IG_ACCESS_TOKEN' });
            })}
          >Agregar</button>
        </div>
      </section>

      {/* ── Cargar la galería ── */}
      <section className="border border-border p-5">
        <h3 className="font-display text-xl italic text-ink-900">Cargar la galería</h3>
        <p className="mt-1 max-w-2xl text-sm text-foreground/60">
          Toma los creativos que ya están hechos —los anuncios de <code className="bg-black/5 px-1">marketing/ig-ads/</code>{' '}
          y los reels de <code className="bg-black/5 px-1">marketing/video/</code>— con el copy que
          se escribió para cada uno, y los agenda a continuación de lo que ya hay. Lo que ya está en
          la cola no se vuelve a cargar.
        </p>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className={label}>¿A qué cuenta?</label>
            <select value={destino} onChange={(e) => setDestino(e.target.value)} className={`${field} mt-1.5 w-auto`}>
              <option value="">La primera activa</option>
              {estado.cuentas.filter((c) => c.activa).map((c) => (
                <option key={c.id} value={c.id}>{c.usuario || c.ig_user_id}</option>
              ))}
              <option value="__todas">Todas las activas</option>
            </select>
          </div>
          <button
            disabled={!estado.cuentas.some((c) => c.activa)}
            onClick={() => accion(async () => {
              const cuerpo = destino === '__todas' ? { todas: true } : destino ? { cuentaId: destino } : {};
              const r = await adminSend('/api/admin/ig/cargar-galeria', 'POST', cuerpo) as { encoladas: number; hasta?: string; mensaje?: string };
              setAviso(r.encoladas ? `Encoladas ${r.encoladas} piezas, hasta el ${r.hasta ? enLima(r.hasta) : '—'}.` : (r.mensaje || 'No había nada nuevo.'));
            })}
            className="press bg-rosa-500 px-5 py-3 font-mono text-[12px] uppercase tracking-[0.1em] text-ivory-50 hover:bg-rosa-600 disabled:opacity-40"
          >
            Cargar la galería
          </button>
          {!estado.cuentas.length
            ? <span className="text-sm text-amber-800">Agrega una cuenta arriba para poder cargar.</span>
            : !estado.sinCargar && <span className="text-sm text-foreground/50">La cuenta por defecto ya tiene todo el repo en cola.</span>}
        </div>
      </section>

      {/* ── La cola ── */}
      <section>
        <h3 className="mb-3 font-display text-xl italic text-ink-900">La cola ({cola.length})</h3>
        {!cola.length && <p className="text-sm text-foreground/50">Vacía. Carga la galería para llenarla.</p>}

        <div className="space-y-3">
          {cola.map((it) => (
            <article key={it.id} className="grid gap-4 border border-border p-4 sm:grid-cols-[128px_minmax(0,1fr)]">
              <a href={apiUrl(`/api/ig/media/${it.id}`)} target="_blank" rel="noopener noreferrer" className="block">
                {it.kind === 'reel'
                  /* El `#t=0.1` no es un adorno: sin él el navegador deja el
                     video en negro hasta que alguien le da al play, y la cola se
                     ve como una fila de cuadros grises. Con el fragmento salta
                     al primer fotograma y hace de portada. */
                  /* `object-contain`, no `-cover`: la cola lleva piezas 4:5, 1:1 y
                     9:16, y con `cover` dentro de una caja 4:5 a las cuadradas se
                     les comía los lados y a las verticales la mitad. La caja se
                     queda para que la lista no baile; lo que cambia es que la
                     pieza entra entera dentro de ella. */
                  ? <video src={apiUrl(`/api/ig/media/${it.id}#t=0.1`)} className="aspect-[4/5] w-full bg-secondary object-contain" muted playsInline preload="metadata" />
                  : <img src={apiUrl(`/api/ig/media/${it.id}`)} alt="" className="aspect-[4/5] w-full bg-secondary object-contain" />}
              </a>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <Insignia status={it.status} />
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/55">
                    {it.kind === 'reel' ? 'Reel' : 'Post'} · {it.origen || 'manual'} · {Math.round(it.bytes / 1024)} kB
                    {' · '}
                    {(() => {
                      const c = estado.cuentas.find((x) => x.id === it.cuenta_id);
                      return c ? (c.usuario || c.ig_user_id) : 'cuenta por defecto';
                    })()}
                  </span>
                  {it.permalink && (
                    <a href={it.permalink} target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] uppercase tracking-[0.08em] text-rosa-500 hover:underline">Ver en Instagram →</a>
                  )}
                </div>

                {it.status !== 'published' && (
                  <div className="mt-3 flex flex-wrap items-end gap-3">
                    <div>
                      <label className={label}>Sale el (hora de Lima)</label>
                      <input
                        type="datetime-local"
                        defaultValue={paraInput(it.scheduled_at)}
                        onChange={(e) => e.target.value && accion(() => adminSend(`/api/admin/ig/cola/${it.id}`, 'PATCH', { scheduledAt: desdeInput(e.target.value) }))}
                        className={`${field} mt-1.5 w-auto`}
                      />
                    </div>
                    <button className={boton} onClick={() => accion(() => adminSend(`/api/admin/ig/cola/${it.id}`, 'PATCH', { status: it.status === 'paused' ? 'queued' : 'paused' }))}>
                      {it.status === 'paused' ? 'Reanudar' : 'Pausar'}
                    </button>
                    <button className={boton} onClick={() => accion(() => adminSend(`/api/admin/ig/cola/${it.id}/publicar-ya`, 'POST'))}>Publicar ya</button>
                    <button className={boton} onClick={() => { if (confirm('¿Sacar esta pieza de la cola?')) accion(() => adminSend(`/api/admin/ig/cola/${it.id}`, 'DELETE')); }}>Quitar</button>
                  </div>
                )}

                <div className="mt-3">
                  <label className={label}>Caption</label>
                  {editando === it.id ? (
                    <div className="mt-1.5">
                      <textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} rows={6} className={field} />
                      <div className="mt-2 flex items-center gap-3">
                        <button className={boton} onClick={() => accion(async () => { await adminSend(`/api/admin/ig/cola/${it.id}`, 'PATCH', { caption: borrador }); setEditando(null); })}>Guardar</button>
                        <button className={boton} onClick={() => setEditando(null)}>Cancelar</button>
                        <span className="font-mono text-[11px] text-foreground/45">{borrador.length} / 2200</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 flex items-start gap-3">
                      <p className="min-w-0 flex-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/75">{it.caption}</p>
                      {it.status !== 'published' && (
                        <button className={boton} onClick={() => { setEditando(it.id); setBorrador(it.caption); }}>Editar</button>
                      )}
                    </div>
                  )}
                </div>

                {it.error && (
                  <p className="mt-3 bg-red-100 px-3 py-2 text-sm text-red-800">
                    {it.error} {it.attempts > 0 && <span className="opacity-70">· intento {it.attempts}</span>}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
