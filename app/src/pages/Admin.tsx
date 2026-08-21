import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { apiUrl, adminGet, AuthError } from '@/lib/admin-api';
import { AdminOrders } from '@/components/admin/AdminOrders';
import { AdminProducts } from '@/components/admin/AdminProducts';
import { AdminStudio } from '@/components/admin/AdminStudio';
import { AdminWhatsapp } from '@/components/admin/AdminWhatsapp';
import { AdminCreateCard } from '@/components/admin/AdminCreateCard';
import { AdminSubscriptions } from '@/components/admin/AdminSubscriptions';
import { AdminPublicador } from '@/components/admin/AdminPublicador';

const EASE = [0.22, 1, 0.36, 1] as const;

type Section = 'orders' | 'subscriptions' | 'cards' | 'products' | 'studio' | 'instagram' | 'whatsapp';
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'orders', label: 'Pedidos' },
  { key: 'subscriptions', label: 'Suscripciones' },
  { key: 'cards', label: 'Tarjetas' },
  { key: 'products', label: 'Productos' },
  { key: 'studio', label: 'Marketing Studio' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'whatsapp', label: 'Promociones WhatsApp' },
];

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  // La sección activa vive en la URL (/admin/:section), así al recargar se
  // mantiene. Si la sub-ruta falta o es inválida, normalizamos a /admin/orders.
  const { section: sectionParam } = useParams();
  const navigate = useNavigate();
  const section: Section = SECTIONS.find((s) => s.key === sectionParam)?.key ?? 'orders';
  const actual = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];
  useEffect(() => {
    if (!SECTIONS.some((s) => s.key === sectionParam)) navigate('/admin/orders', { replace: true });
  }, [sectionParam, navigate]);
  const goto = (key: Section) => navigate('/admin/' + key);

  // En el móvil las siete secciones no entran en una tira: se apretaban una
  // contra otra hasta quedar ilegibles. Ahí la navegación pasa a un cajón
  // lateral; de `md` para arriba siguen siendo pestañas, que es lo cómodo con
  // sitio de sobra.
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    if (!menu) return;
    const cerrar = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(false); };
    window.addEventListener('keydown', cerrar);
    // Con el cajón abierto, el panel de atrás no se arrastra.
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', cerrar); document.body.style.overflow = previo; };
  }, [menu]);

  // Sesión: una llamada barata a /api/admin/me al montar.
  const checkSession = useCallback(async () => {
    try { await adminGet('/api/admin/me'); setAuthed(true); }
    catch (e) { if (e instanceof AuthError) setAuthed(false); else setAuthed(false); }
  }, []);
  useEffect(() => { checkSession(); }, [checkSession]);

  const onAuthError = useCallback(() => setAuthed(false), []);

  const logout = async () => {
    try { await fetch(apiUrl('/api/admin/logout'), { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
    setAuthed(false);
  };

  if (authed === null) {
    return <div className="flex min-h-screen items-center justify-center bg-background font-display text-xl italic text-foreground/40">Cargando…</div>;
  }
  if (!authed) return <LoginForm onSuccess={() => setAuthed(true)} />;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-8 md:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="font-display text-3xl font-medium italic text-ink-900 md:text-4xl">Admin · <span className="text-rosa-500">Lima Flores</span></h1>
          <div className="flex items-center gap-3">
            <a href="https://logistics.cabify.com/parcels?group=all&history=actives" target="_blank" rel="noopener noreferrer" className="font-mono text-xs uppercase tracking-[0.08em] text-foreground/55 hover:text-foreground">Dashboard Cabify →</a>
            <button onClick={logout} className="border border-border px-3.5 py-2 font-mono text-[11px] uppercase tracking-[0.08em] text-foreground/60 hover:border-ink-900 hover:text-ink-900">Salir</button>
          </div>
        </div>

        {/* Navegación de secciones — pestañas en escritorio */}
        <div className="mt-6 hidden gap-2 border-b border-border md:flex">
          {SECTIONS.map((s) => (
            <button key={s.key} onClick={() => goto(s.key)}
              className={`-mb-px border-b-2 px-4 py-3 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors ${section === s.key ? 'border-rosa-500 text-ink-900' : 'border-transparent text-foreground/45 hover:text-ink-900'}`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* …y en móvil, la sección actual con el botón que abre el cajón */}
        <button onClick={() => setMenu(true)} aria-label="Abrir menú de secciones" aria-expanded={menu}
          className="mt-6 flex w-full items-center justify-between border border-border px-4 py-3 md:hidden">
          <span className="font-mono text-[12px] uppercase tracking-[0.1em] text-ink-900">{actual.label}</span>
          <svg className="h-5 w-5 text-foreground/55" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="14" y2="17" />
          </svg>
        </button>

        {createPortal(
          <AnimatePresence>
            {menu && (
              <div className="fixed inset-0 z-[120] md:hidden">
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setMenu(false)} className="absolute inset-0 bg-ink-900/45 backdrop-blur-sm"
                />
                <motion.nav
                  initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }} transition={{ duration: 0.32, ease: EASE }}
                  className="absolute left-0 top-0 flex h-full w-[80%] max-w-[320px] flex-col bg-background px-6 py-6 shadow-2xl"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/50">Secciones</p>
                    <button onClick={() => setMenu(false)} aria-label="Cerrar menú" className="text-foreground/55 hover:text-foreground">
                      <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
                    </button>
                  </div>

                  <div className="mt-6 flex flex-col overflow-y-auto">
                    {SECTIONS.map((s) => (
                      <button key={s.key} onClick={() => { goto(s.key); setMenu(false); }}
                        className={`border-l-2 border-b border-b-border/60 py-3.5 pl-4 text-left font-mono text-[12px] uppercase tracking-[0.1em] transition-colors ${section === s.key ? 'border-l-rosa-500 text-rosa-600' : 'border-l-transparent text-foreground/60'}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <p className="mt-auto pt-6 font-mono text-[11px] uppercase tracking-[0.14em] text-foreground/40">Lima Flores · Admin</p>
                </motion.nav>
              </div>
            )}
          </AnimatePresence>,
          document.body,
        )}

        <div className="mt-7">
          {section === 'orders' && <AdminOrders onAuthError={onAuthError} />}
          {section === 'subscriptions' && <AdminSubscriptions />}
          {section === 'cards' && <AdminCreateCard onAuthError={onAuthError} />}
          {section === 'products' && <AdminProducts onAuthError={onAuthError} />}
          {section === 'studio' && <AdminStudio onAuthError={onAuthError} />}
          {section === 'instagram' && <AdminPublicador onAuthError={onAuthError} />}
          {section === 'whatsapp' && <AdminWhatsapp onAuthError={onAuthError} />}
        </div>
      </div>
    </div>
  );
}

// ─── Login ──────────────────────────────────────────────────────────────────
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const onLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !pass) { setErr('Ingresa usuario y contraseña.'); return; }
    setBusy(true); setErr('');
    try {
      const r = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ user: user.trim(), pass }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((data as any).error || ('HTTP ' + r.status));
      setPass('');
      onSuccess();
    } catch (e: any) { setErr(e.message || 'No se pudo iniciar sesión.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-5">
      <form onSubmit={onLogin} className="w-full max-w-sm border border-border bg-surface p-9 shadow-sm">
        <h2 className="font-display text-3xl font-medium text-ink-900">Admin · <em className="italic text-rosa-500">Lima Flores</em></h2>
        <p className="mt-1.5 text-sm text-foreground/60">Ingresa tus credenciales para administrar la tienda.</p>
        <label className="mt-6 block text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/55">Usuario</label>
        <input value={user} onChange={(e) => setUser(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} className="mt-1.5 w-full border border-border bg-background px-4 py-3 outline-none focus:border-rosa-500" />
        <label className="mt-4 block text-[11px] font-medium uppercase tracking-[0.14em] text-foreground/55">Contraseña</label>
        <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} className="mt-1.5 w-full border border-border bg-background px-4 py-3 outline-none focus:border-rosa-500" />
        <button disabled={busy} className="mt-6 w-full bg-rosa-500 py-3.5 text-sm font-medium uppercase tracking-[0.16em] text-ivory-50 transition-colors hover:bg-rosa-600 disabled:opacity-50">{busy ? 'Entrando…' : 'Entrar'}</button>
        {err && <p className="mt-4 bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}
      </form>
    </div>
  );
}
