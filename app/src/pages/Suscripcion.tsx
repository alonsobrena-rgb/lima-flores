import { useState, useEffect } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { money } from '@/lib/cart';
import { plans, type Plan } from '@/data/plans';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';
import { FloatingFlowers } from '@/components/motion/FloatingFlowers';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
const CULQI_PK = (import.meta.env.VITE_CULQI_PUBLIC_KEY as string | undefined) || '';
const CULQI_JS = 'https://checkout.culqi.com/js/v4';
const WHATSAPP = 'https://wa.me/51999479855';

// Carga el script de Culqi v4 una sola vez.
let culqiLoading: Promise<void> | null = null;
function loadCulqi(): Promise<void> {
  const w = window as any;
  if (w.Culqi) return Promise.resolve();
  if (culqiLoading) return culqiLoading;
  culqiLoading = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = CULQI_JS; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => { culqiLoading = null; reject(new Error('No se pudo cargar Culqi.')); };
    document.body.appendChild(s);
  });
  return culqiLoading;
}

const PHOTOS = [
  { src: '/suscripcion/estacion-2.webp', alt: 'Ramo de estación en tonos fucsia y rosa' },
  { src: '/suscripcion/estacion-3.webp', alt: 'Ramo de estación con rosas amarillas y morados' },
  { src: '/suscripcion/estacion-4.webp', alt: 'Ramo de estación magenta con girasoles pequeños' },
  { src: '/suscripcion/estacion-1.webp', alt: 'Ramo de estación con statice morado y flores amarillas' },
];

const CheckIcon = () => (
  <svg className="mt-0.5 h-4 w-4 shrink-0 text-rosa-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
);

type Model = 'A' | 'B';

export default function Suscripcion() {
  const [model, setModel] = useState<Model>('A');
  const [openPlan, setOpenPlan] = useState<Plan | null>(null);
  // ¿Los planes ya están aprovisionados en Culqi? Si no, el flujo coordina por WA.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch(`${API_BASE}/api/culqi/plans-status`).then((r) => r.json()).then((d) => setReady(!!d.ready)).catch(() => setReady(false));
  }, []);

  const priceFor = (p: Plan) =>
    model === 'A' || p.months === 1
      ? { big: money(p.monthly), small: '/ mes' }
      : { big: money(p.monthly * p.months), small: `S/${p.monthly}/mes · ${p.months} meses` };

  return (
    <div className="relative min-h-screen">
      {/* Fondo: carretilla de flores en Milán (Higgsfield) con velo ivory. */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <img src="/bg/suscripcion-milan.webp" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ivory-100/88 via-ivory-100/68 to-ivory-100/80" />
        <div className="absolute inset-0 backdrop-blur-[1.5px]" />
      </div>

      <FloatingFlowers />

      <div className="relative z-10">
        <SiteHeader />

        <header className="mx-auto max-w-7xl px-6 pb-12 pt-16 md:px-12 md:pt-20">
          <div className="relative inline-block max-w-3xl rounded-[2px] border border-white/60 bg-ivory-50/[0.93] px-7 py-8 shadow-[0_28px_70px_-34px_rgba(42,38,35,0.5)] backdrop-blur-lg md:px-12 md:py-11">
            <span className="text-[12px] font-medium uppercase tracking-[0.28em] text-ink-500">— Suscripción</span>
            <h1 className="mt-3 font-display text-[2.75rem] font-light leading-[1.02] tracking-tight text-ink-900 md:text-[4rem]">
              Flores frescas en casa, <em className="italic text-rosa-500">todo el mes.</em>
            </h1>
            <p className="mt-5 max-w-xl text-ink-700">Un mismo precio — <strong>S/130 al mes</strong> — y dos entregas mensuales de flores de estación, seleccionadas y armadas a mano. Pausa o cancela cuando quieras.</p>
          </div>
        </header>

        {/* ── Flores de estación: galería de entregas reales ── */}
        <section className="mx-auto max-w-7xl px-6 pb-4 md:px-12">
          <div className="max-w-2xl">
            <span className="text-[12px] font-medium uppercase tracking-[0.24em] text-rosa-500">Flores de estación</span>
            <h2 className="mt-2 font-display text-[2rem] font-light leading-[1.05] tracking-tight text-ink-900 md:text-[2.75rem]">Siempre distintas, siempre de temporada.</h2>
            <p className="mt-4 leading-relaxed text-ink-700">
              No trabajamos con catálogos fijos: cada semana elegimos las flores que están en su <strong>mejor momento</strong> en el mercado y nuestras floristas arman cada ramo <strong>a mano</strong>. Por eso ninguna entrega es igual a la anterior — recibes lo más fresco y bonito de la estación. Estas son entregas reales de nuestras suscripciones.
            </p>
          </div>
          <Stagger className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-5">
            {PHOTOS.map((ph) => (
              <StaggerItem key={ph.src}>
                <div className="group relative aspect-[3/4] overflow-hidden rounded-[2px] border border-white/50 shadow-[0_18px_44px_-26px_rgba(42,38,35,0.5)]">
                  <img src={ph.src} alt={ph.alt} loading="lazy" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.05]" />
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-3 text-[12px] italic text-ink-600">Entregas reales · flores de estación armadas a mano.</p>
        </section>

        {/* ── Planes ── */}
        <section className="mx-auto max-w-7xl px-6 pb-24 pt-12 md:px-12 md:pb-32">
          {/* Toggle de forma de pago A/B */}
          <div className="mb-9 flex flex-col items-center gap-3">
            <span className="text-[12px] uppercase tracking-[0.18em] text-foreground/50">¿Cómo prefieres pagar?</span>
            <div className="inline-flex rounded-full border border-border bg-ivory-50/90 p-1 backdrop-blur">
              <button onClick={() => setModel('A')} className={`rounded-full px-5 py-2 text-[13px] font-medium tracking-[0.04em] transition-colors ${model === 'A' ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:text-ink-900'}`}>Mensual · S/130/mes</button>
              <button onClick={() => setModel('B')} className={`rounded-full px-5 py-2 text-[13px] font-medium tracking-[0.04em] transition-colors ${model === 'B' ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:text-ink-900'}`}>Pago adelantado</button>
            </div>
            <span className="text-[12px] text-foreground/55">{model === 'A' ? 'Se cobra S/130 cada mes automáticamente.' : 'Pagas el periodo completo por adelantado (S/130/mes).'}</span>
          </div>

          <Stagger className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p) => {
              const pr = priceFor(p);
              return (
                <StaggerItem key={p.tier} className="h-full">
                  <div className={`group relative flex h-full flex-col p-7 transition-all duration-500 hover:-translate-y-1.5 ${
                    p.featured
                      ? 'frost border border-rosa-500 shadow-[0_30px_70px_-30px_rgba(158,43,94,0.45)] md:scale-[1.03]'
                      : 'frost border border-border hover:border-rosa-300'}`}>
                    {(p.featured || p.value) && (
                      <span className="absolute -top-3 right-6 bg-rosa-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-50">{p.featured ? 'Más popular' : 'Mejor valor'}</span>
                    )}
                    <h3 className="font-display text-2xl font-medium text-ink-900">{p.name}</h3>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-foreground/45">{p.period}</p>
                    <p className="mt-5 font-display text-4xl text-ink-900">{pr.big}</p>
                    <p className="mt-1 text-[12px] text-foreground/55">{pr.small}</p>
                    <p className="mt-4 font-display italic text-ink-600">{p.tagline}</p>
                    <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-700">
                      {p.features.map((f) => (
                        <li key={f} className="flex gap-2.5"><CheckIcon /><span>{f}</span></li>
                      ))}
                    </ul>
                    <button onClick={() => { setOpenPlan(p); }}
                      className={`press mt-7 flex items-center justify-center py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] transition-colors ${p.featured ? 'bg-rosa-500 text-ivory-50 hover:bg-rosa-600' : 'border border-ink-900/20 text-ink-900 hover:bg-ink-900 hover:text-ivory-50'}`}>
                      Suscribirme →
                    </button>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
          <p className="mt-10 text-center text-[12px] uppercase tracking-[0.14em] text-ivory-50 drop-shadow-[0_1px_6px_rgba(0,0,0,0.55)]">Todas las suscripciones incluyen entrega a domicilio dentro de Lima Metropolitana.</p>
        </section>

        <SiteFooter />
      </div>

      {openPlan && (
        <SubscribeModal plan={openPlan} model={model} ready={ready} onClose={() => setOpenPlan(null)} />
      )}
    </div>
  );
}

// ─── Modal de suscripción ──────────────────────────────────────────────────────
function SubscribeModal({ plan, model, ready, onClose }: { plan: Plan; model: Model; ready: boolean; onClose: () => void }) {
  const [f, setF] = useState({ buyerName: '', email: '', buyerPhone: '', recipientName: '', recipientPhone: '', address: '', district: '', deliveryPref: '', tyc: false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<null | 'ok' | 'wa'>(null);

  const planKey = model === 'A' ? plan.keyA : plan.keyB;
  const totalSoles = model === 'A' || plan.months === 1 ? plan.monthly : plan.monthly * plan.months;
  const set = (k: keyof typeof f, v: any) => setF((s) => ({ ...s, [k]: v }));
  const field = 'mt-1.5 w-full border border-border bg-surface px-4 py-2.5 text-ink-900 outline-none transition-colors focus:border-rosa-500';
  const label = 'text-[12px] font-medium uppercase tracking-[0.12em] text-foreground/55';

  const submit = async () => {
    setErr('');
    if (!f.buyerName.trim() || !f.email.includes('@') || !f.buyerPhone.trim() || !f.recipientName.trim() || !f.recipientPhone.trim() || !f.address.trim()) {
      setErr('Completa los campos obligatorios.'); return;
    }
    if (!f.tyc) { setErr('Acepta los términos para continuar.'); return; }
    // Sin Culqi configurado o planes aún no aprovisionados → coordinamos por WhatsApp
    // (no abrimos el modal de tarjeta para no pedir datos de tarjeta en vano).
    if (!CULQI_PK || !ready) { setDone('wa'); return; }

    setBusy(true);
    try {
      await loadCulqi();
      const w = window as any; const Culqi = w.Culqi;
      Culqi.publicKey = CULQI_PK;
      Culqi.settings({ title: 'Lima Flores — Suscripción', currency: 'PEN', amount: Math.round(totalSoles * 100) });
      Culqi.options({ lang: 'auto', installments: false, paymentMethods: { tarjeta: true, yape: false, bancaMovil: false, agente: false, billetera: false, cuotealo: false } });
      w.culqi = async () => {
        if (Culqi.token && Culqi.token.id) {
          try {
            const r = await fetch(`${API_BASE}/api/culqi/subscribe`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                token: Culqi.token.id, email: f.email, plan_key: planKey, tyc: true,
                buyer_name: f.buyerName, buyer_phone: f.buyerPhone,
                recipient_name: f.recipientName, recipient_phone: f.recipientPhone,
                recipient_address: f.address, recipient_district: f.district || null,
                delivery_pref: f.deliveryPref || null,
              }),
            });
            const d = await r.json().catch(() => ({}));
            if (r.status === 503) { setDone('wa'); return; } // planes aún no aprovisionados
            if (!r.ok || !d.ok) throw new Error(d.error || 'No se pudo crear la suscripción.');
            setDone('ok');
          } catch (e: any) { setErr(e?.message || 'No se pudo crear la suscripción.'); }
          finally { setBusy(false); }
        } else if (Culqi.error) { setErr(Culqi.error.user_message || Culqi.error.merchant_message || 'No se pudo procesar el pago.'); setBusy(false); }
        else { setBusy(false); }
      };
      Culqi.open();
    } catch (e: any) { setErr(e?.message || 'No se pudo iniciar el pago.'); setBusy(false); }
  };

  const waText = encodeURIComponent(`Hola Lima Flores, quiero suscribirme al plan ${plan.name} (${model === 'A' ? 'mensual S/130' : `pago adelantado S/${totalSoles}`}).`);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto bg-ivory-50 p-7 shadow-2xl sm:rounded-[3px]" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="py-4 text-center">
            <h3 className="font-display text-2xl text-ink-900">{done === 'ok' ? '¡Suscripción creada! 🌸' : 'Casi listo'}</h3>
            <p className="mt-3 text-ink-700">
              {done === 'ok'
                ? `Tu plan ${plan.name} quedó activo. Te contactaremos para coordinar tu primera entrega.`
                : 'Para activar tu suscripción coordinamos el pago por WhatsApp (toma un momento).'}
            </p>
            {done === 'wa' && (
              <a href={`${WHATSAPP}?text=${waText}`} target="_blank" rel="noopener noreferrer" className="press mt-5 inline-flex items-center justify-center bg-rosa-500 px-6 py-3 text-[13px] font-medium uppercase tracking-[0.16em] text-ivory-50 hover:bg-rosa-600">Coordinar por WhatsApp →</a>
            )}
            <button onClick={onClose} className="mt-5 block w-full text-[13px] uppercase tracking-[0.14em] text-foreground/55 hover:text-ink-900">Cerrar</button>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-rosa-500">Suscripción · {plan.name}</span>
                <h3 className="mt-1 font-display text-2xl text-ink-900">{money(totalSoles)} <span className="text-base text-foreground/55">{model === 'A' || plan.months === 1 ? '/ mes' : `· ${plan.months} meses`}</span></h3>
                <p className="text-[12px] text-foreground/55">{plan.period} · flores de estación</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="text-2xl leading-none text-foreground/40 hover:text-ink-900">×</button>
            </div>

            <div className="mt-5 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={label}>Tu nombre *</label><input className={field} value={f.buyerName} onChange={(e) => set('buyerName', e.target.value)} /></div>
                <div><label className={label}>Email *</label><input type="email" className={field} value={f.email} onChange={(e) => set('email', e.target.value)} /></div>
                <div><label className={label}>Tu teléfono *</label><input className={field} value={f.buyerPhone} onChange={(e) => set('buyerPhone', e.target.value)} /></div>
                <div><label className={label}>Distrito de entrega</label><input className={field} value={f.district} onChange={(e) => set('district', e.target.value)} placeholder="Miraflores" /></div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div><label className={label}>Quién recibe *</label><input className={field} value={f.recipientName} onChange={(e) => set('recipientName', e.target.value)} /></div>
                <div><label className={label}>Teléfono de quien recibe *</label><input className={field} value={f.recipientPhone} onChange={(e) => set('recipientPhone', e.target.value)} /></div>
              </div>
              <div><label className={label}>Dirección de entrega *</label><input className={field} value={f.address} onChange={(e) => set('address', e.target.value)} placeholder="Av. ... 123, dpto ..." /></div>
              <div><label className={label}>Día/horario preferido (opcional)</label><input className={field} value={f.deliveryPref} onChange={(e) => set('deliveryPref', e.target.value)} placeholder="Sábados por la mañana" /></div>

              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-700">
                <input type="checkbox" checked={f.tyc} onChange={(e) => set('tyc', e.target.checked)} className="mt-0.5 h-4 w-4 accent-rosa-500" />
                <span>Acepto los términos. Entiendo que {model === 'A' ? 'se cobrará S/130 cada mes' : `se cobrará S/${totalSoles} por adelantado`} a mi tarjeta y que puedo pausar o cancelar cuando quiera.</span>
              </label>

              {err && <p className="bg-red-100 px-3 py-2.5 text-sm text-red-800">{err}</p>}

              <button disabled={busy} onClick={submit} className="press w-full bg-rosa-500 py-3.5 text-[13px] font-medium uppercase tracking-[0.16em] text-ivory-50 transition-colors hover:bg-rosa-600 disabled:opacity-50">
                {busy ? 'Procesando…' : ready ? `Pagar ${money(totalSoles)} con tarjeta` : 'Continuar →'}
              </button>
              <p className="text-center text-[11px] text-foreground/45">{ready ? 'Pago seguro con Culqi · tu tarjeta nunca pasa por nuestros servidores.' : 'Coordinamos tu suscripción por WhatsApp.'}</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
