import { useState, useEffect, useRef } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { money } from '@/lib/cart';
import { plans, type Plan } from '@/data/plans';
import { Stagger, StaggerItem } from '@/components/motion/Reveal';
import { attachAutocomplete, geocodeText, mapsAvailable, DISTRICT_CENTROIDS, type PlaceResult } from '@/lib/maps';
import { districts, timeSlots } from '@/lib/delivery';

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

  // Modelo A = mensual (S/130/mes); modelo B = total del periodo por adelantado.
  const priceFor = (p: Plan) => (
    model === 'A'
      ? { big: money(p.monthly), small: '/ mes' }
      : { big: money(p.monthly * p.months), small: `S/${p.monthly}/mes · ${p.months} meses` }
  );

  // Mes a mes (A) = suscripción recurrente (solo Mensual). Pago único (B) = los
  // planes por periodo (trimestral / semestral / anual).
  const visiblePlans = model === 'A'
    ? plans.filter((p) => p.tier === 'mensual')
    : plans.filter((p) => p.tier !== 'mensual');
  const single = visiblePlans.length === 1;

  return (
    <div className="relative min-h-screen">
      {/* Fondo: carretilla de flores en Milán (Higgsfield) con velo ivory. */}
      <div aria-hidden className="fixed inset-0 -z-10">
        <img src="/bg/suscripcion-milan.webp" alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ivory-100/88 via-ivory-100/68 to-ivory-100/80" />
        <div className="absolute inset-0 backdrop-blur-[1.5px]" />
      </div>

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
          <div className="max-w-2xl rounded-[2px] border border-white/60 bg-ivory-50/[0.93] px-7 py-7 shadow-[0_24px_60px_-34px_rgba(42,38,35,0.5)] backdrop-blur-lg md:px-9 md:py-8">
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
          <p className="mt-3 text-[12px] italic text-ivory-50 drop-shadow-[0_1px_6px_rgba(0,0,0,0.6)]">Entregas reales · flores de estación armadas a mano.</p>
        </section>

        {/* ── Planes ── */}
        <section className="mx-auto max-w-7xl px-6 pb-24 pt-12 md:px-12 md:pb-32">
          {/* Toggle de forma de pago A/B (en panel esmerilado para legibilidad) */}
          <div className="mx-auto mb-10 flex max-w-md flex-col items-center gap-3 rounded-2xl border border-white/55 bg-ivory-50/[0.93] px-6 py-5 text-center shadow-[0_24px_60px_-34px_rgba(42,38,35,0.5)] backdrop-blur-lg">
            <span className="text-[12px] uppercase tracking-[0.18em] text-ink-500">¿Cómo prefieres pagar?</span>
            <div className="inline-flex rounded-full border border-border bg-ivory-100 p-1">
              <button onClick={() => setModel('A')} className={`rounded-full px-5 py-2 text-[13px] font-medium tracking-[0.04em] transition-colors ${model === 'A' ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:text-ink-900'}`}>Mes a mes</button>
              <button onClick={() => setModel('B')} className={`rounded-full px-5 py-2 text-[13px] font-medium tracking-[0.04em] transition-colors ${model === 'B' ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:text-ink-900'}`}>Pago único</button>
            </div>
            <span className="text-[12px] text-ink-600">{model === 'A' ? 'Suscripción: S/130 cada mes, sin permanencia (pausa o cancela cuando quieras).' : 'Un solo pago por todo el periodo (S/130/mes · 3, 6 o 12 meses). No es suscripción: no se renueva.'}</span>
          </div>

          {/* key={model}: al alternar A/B cambian las tarjetas; sin remount, los
              StaggerItem nuevos montan bajo un Stagger cuyo whileInView ya disparó
              (once) y se quedan en opacity:0 (invisibles). Remontar re-anima. */}
          <Stagger key={model} className={single ? 'mx-auto max-w-sm' : 'mx-auto grid max-w-5xl gap-6 sm:grid-cols-2 lg:grid-cols-3'}>
            {visiblePlans.map((p) => {
              const pr = priceFor(p);
              return (
                <StaggerItem key={p.tier} className="h-full">
                  <div className={`group relative flex h-full flex-col p-7 transition-all duration-500 hover:-translate-y-1.5 ${
                    p.featured
                      ? 'bg-card border border-rosa-500 shadow-[0_30px_70px_-30px_rgba(158,43,94,0.45)] md:scale-[1.03]'
                      : 'bg-card border border-border shadow-[0_18px_50px_-28px_rgba(42,38,35,0.28)] hover:border-rosa-300'}`}>
                    {(p.featured || p.value) && (
                      <span className="absolute -top-3 right-6 bg-rosa-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-ivory-50">{p.featured ? 'Más popular' : 'Mejor valor'}</span>
                    )}
                    <h3 className="font-display text-2xl font-medium text-ink-900">{p.name}</h3>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-foreground/45">{p.period}</p>
                    <p className="mt-5 font-display text-4xl text-ink-900">{pr.big}</p>
                    <p className="mt-1 text-[12px] text-foreground/55">{pr.small}</p>
                    {model === 'B' && (
                      <span className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-rosa-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-rosa-600">
                        Pago único · no se renueva
                      </span>
                    )}
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
// Pide los MISMOS datos que el checkout (comprador + quien recibe con dirección,
// mapa, referencia, dpto, distrito, horario y recepción), excepto los datos
// "de la tarjeta": el mensaje de la tarjeta y la fecha de envío (en una suscripción
// las entregas son recurrentes, no una fecha única).
function SubscribeModal({ plan, model, ready, onClose }: { plan: Plan; model: Model; ready: boolean; onClose: () => void }) {
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' });
  const [recip, setRecip] = useState({ name: '', phone: '', ref: '', apt: '' });
  const [district, setDistrict] = useState('');
  const [time, setTime] = useState('');
  const [reception, setReception] = useState(true);
  const [place, setPlace] = useState<{ lat: number; lng: number; district: string | null; formatted: string } | null>(null);
  const [tyc, setTyc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState<null | 'ok' | 'wa'>(null);

  const addressRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);

  const planKey = model === 'A' ? plan.keyA : plan.keyB;
  const totalSoles = model === 'A' ? plan.monthly : plan.monthly * plan.months;

  const matchDistrict = (candidates: string[]) => {
    for (const cand of candidates) {
      const m = districts.find((x) => x.toLowerCase() === cand.toLowerCase() || cand.toLowerCase().includes(x.toLowerCase()));
      if (m) return m;
    }
    return candidates.length ? 'Otro' : '';
  };
  const applyPlace = (loc: PlaceResult) => {
    setPlace({ lat: loc.lat, lng: loc.lng, district: loc.district, formatted: loc.formatted });
    const m = matchDistrict(loc.districtCandidates);
    if (m) setDistrict(m);
    if (addressRef.current && loc.formatted) addressRef.current.value = loc.formatted;
  };

  // Autocomplete de Google Places sobre el campo de dirección (igual que el checkout).
  useEffect(() => {
    let ac: any; let cancelled = false;
    if (!addressRef.current) return;
    attachAutocomplete(addressRef.current, (loc) => { if (!cancelled) applyPlace(loc); })
      .then((widget) => { ac = widget; })
      .catch(() => { /* sin key/referrer → input de texto normal */ });
    return () => { cancelled = true; const w = window as any; if (ac && w.google) w.google.maps.event.clearInstanceListeners(ac); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mapa con marcador arrastrable (el pin manda).
  useEffect(() => {
    const w = window as any;
    if (!place || !mapRef.current || !w.google) return;
    const g = w.google; const pos = { lat: place.lat, lng: place.lng };
    if (!mapObj.current) {
      mapObj.current = new g.maps.Map(mapRef.current, { center: pos, zoom: 16, disableDefaultUI: true, zoomControl: true, gestureHandling: 'cooperative' });
      markerObj.current = new g.maps.Marker({ map: mapObj.current, position: pos, draggable: true });
      markerObj.current.addListener('dragend', (e: any) => {
        const lat = e.latLng.lat(), lng = e.latLng.lng();
        setPlace((pp) => (pp ? { ...pp, lat, lng } : pp));
      });
    } else { mapObj.current.setCenter(pos); markerObj.current.setPosition(pos); }
  }, [place]);

  const field = 'mt-1.5 w-full border border-border bg-surface px-4 py-2.5 text-ink-900 outline-none transition-colors focus:border-rosa-500';
  const label = 'text-[12px] font-medium uppercase tracking-[0.12em] text-foreground/55';
  const darkField = 'mt-1.5 w-full rounded border border-ivory-100/25 bg-ivory-100/10 px-4 py-2.5 text-ivory-50 outline-none transition-colors placeholder:text-ivory-100/40 [color-scheme:dark] focus:border-ivory-100 focus:bg-ivory-100/20';
  const darkLabel = 'text-[12px] font-medium uppercase tracking-[0.12em] text-ivory-100/70';

  const submit = async () => {
    setErr('');
    const addressText = addressRef.current?.value?.trim() || '';
    if (!buyer.name.trim() || !buyer.email.includes('@') || !buyer.phone.trim() || !recip.name.trim() || !recip.phone.trim() || !addressText || !district) {
      setErr('Completa los campos obligatorios.'); return;
    }
    if (!tyc) { setErr('Acepta los términos para continuar.'); return; }

    // Coordenadas (igual que checkout): lugar elegido → geocodificar el texto →
    // centroide del distrito. Siempre mandamos lat/lng numéricos.
    let coords: { lat: number; lng: number } | null = place ? { lat: place.lat, lng: place.lng } : null;
    if (!coords && addressText) {
      const geo = await geocodeText(`${addressText}, ${district && district !== 'Otro' ? district + ', ' : ''}Lima, Perú`);
      if (geo) coords = { lat: geo.lat, lng: geo.lng };
    }
    if (!coords) coords = DISTRICT_CENTROIDS[district] || DISTRICT_CENTROIDS['Otro'];

    const payload = {
      token: '', email: buyer.email, plan_key: planKey, tyc: true,
      buyer_name: buyer.name, buyer_phone: buyer.phone,
      recipient_name: recip.name, recipient_phone: recip.phone,
      recipient_address: place?.formatted || addressText,
      recipient_district: district || null,
      recipient_address_ref: recip.ref || null, recipient_apt: recip.apt || null,
      recipient_lat: coords?.lat ?? null, recipient_lng: coords?.lng ?? null,
      recipient_has_reception: reception,
      delivery_time: time || null, delivery_pref: time || null,
    };

    // Sin Culqi configurado o planes aún no aprovisionados → coordinamos por WhatsApp.
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
          // El modal de Culqi v4 no se cierra solo tras generar el token —
          // lo cerramos nosotros y procesamos la suscripción de fondo.
          setBusy(true); // ahora sí: creando la suscripción contra el backend.
          try { Culqi.close(); } catch { /* noop */ }
          try {
            const r = await fetch(`${API_BASE}/api/culqi/subscribe`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...payload, token: Culqi.token.id }),
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
      // Culqi v4 NO llama a w.culqi al cerrar el modal con la X → si dejamos el
      // botón en "procesando" queda bloqueado. El modal tapa toda la pantalla, así
      // que reactivamos el botón ya; el callback de arriba vuelve a poner "busy"
      // cuando hay token y se está creando la suscripción.
      setBusy(false);
    } catch (e: any) { setErr(e?.message || 'No se pudo iniciar el pago.'); setBusy(false); }
  };

  const waText = encodeURIComponent(`Hola Lima Flores, quiero el plan ${plan.name} (${model === 'A' ? `suscripción ${money(totalSoles)}/mes` : `pago único ${money(totalSoles)}`}).`);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto bg-ivory-50 p-6 shadow-2xl sm:rounded-[3px] md:p-8" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="py-4 text-center">
            <h3 className="font-display text-2xl text-ink-900">{done === 'ok' ? (model === 'A' ? '¡Suscripción creada! 🌸' : '¡Pago realizado! 🌸') : 'Casi listo'}</h3>
            <p className="mt-3 text-ink-700">
              {done === 'ok'
                ? `${model === 'A' ? `Tu suscripción ${plan.name} quedó activa` : `Tu paquete ${plan.name} (pago único) quedó listo`}. Te contactaremos para coordinar tu primera entrega.`
                : 'Para activar tu plan coordinamos el pago por WhatsApp (toma un momento).'}
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
                <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-rosa-500">{model === 'A' ? 'Suscripción' : 'Pago único'} · {plan.name}</span>
                <h3 className="mt-1 font-display text-2xl text-ink-900">{money(totalSoles)} <span className="text-base text-foreground/55">{model === 'A' ? '/ mes' : 'pago único'}</span></h3>
                <p className="text-[12px] text-foreground/55">{model === 'A' ? `${plan.period} · flores de estación` : `${plan.period} · un solo pago, no se renueva`}</p>
              </div>
              <button onClick={onClose} aria-label="Cerrar" className="text-2xl leading-none text-foreground/40 hover:text-ink-900">×</button>
            </div>

            <div className="mt-6 space-y-6">
              {/* 01 · Comprador */}
              <fieldset className="space-y-4">
                <div className="flex items-baseline gap-3"><span className="font-display text-xl italic text-rosa-500">01</span><span className="font-display text-lg text-ink-900">Tus datos (quien compra)</span></div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={label}>Nombre completo *</label><input className={field} value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} placeholder="Ej. María Pérez" /></div>
                  <div><label className={label}>Teléfono / WhatsApp *</label><input type="tel" className={field} value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} placeholder="999 999 999" /></div>
                </div>
                <div><label className={label}>Email *</label><input type="email" className={field} value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} placeholder="tu@correo.com" /></div>
              </fieldset>

              {/* 02 · Quien recibe + entrega (tarjeta verde, como el checkout) */}
              <fieldset className="space-y-4 rounded-lg border border-ivory-100/10 bg-[#2F3925] p-5 text-ivory-100 md:p-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-display text-xl italic text-[#E7AFC2]">02</span>
                  <span className="rounded-sm bg-[#B6855E] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#2F3925]">Para</span>
                  <span className="font-display text-lg text-ivory-50">Quien recibe las flores</span>
                </div>
                <p className="text-[13px] leading-relaxed text-ivory-100/80">Cada entrega de tu suscripción llega a esta persona y dirección.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={darkLabel}>Nombre de quien recibe *</label><input className={darkField} value={recip.name} onChange={(e) => setRecip({ ...recip, name: e.target.value })} placeholder="Ej. Ana Torres" /></div>
                  <div><label className={darkLabel}>Teléfono de quien recibe *</label><input type="tel" className={darkField} value={recip.phone} onChange={(e) => setRecip({ ...recip, phone: e.target.value })} placeholder="999 999 999" /></div>
                </div>
                <div>
                  <label className={darkLabel}>Dirección *{mapsAvailable() && <span className="ml-2 normal-case tracking-normal text-[#E7AFC2]">· elige una sugerencia o escríbela completa</span>}</label>
                  <input ref={addressRef} className={darkField} placeholder="Av. / Calle, número, distrito…" autoComplete="off" />
                </div>
                {place && (
                  <div>
                    <p className="mb-2 flex items-center gap-1.5 text-[13px] text-ivory-100/85">
                      <svg className="h-4 w-4 shrink-0 text-[#E7AFC2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                      {place.formatted}
                    </p>
                    <div ref={mapRef} className="h-48 w-full overflow-hidden rounded-sm border border-ivory-100/20" />
                    <p className="mt-2 border-l-[3px] border-[#B6855E] bg-ivory-100/10 px-3 py-2.5 text-[12px] leading-relaxed text-ivory-100/90">📍 Las flores se entregan donde está el pin. Si no coincide con la puerta, arrástralo.</p>
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div><label className={darkLabel}>Referencia (opcional)</label><input className={darkField} value={recip.ref} onChange={(e) => setRecip({ ...recip, ref: e.target.value })} placeholder="Casa blanca, reja negra…" /></div>
                  <div><label className={darkLabel}>Dpto / Interior (opcional)</label><input className={darkField} value={recip.apt} onChange={(e) => setRecip({ ...recip, apt: e.target.value })} placeholder="301" /></div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={darkLabel}>Distrito *</label>
                    <select className={`${darkField} dark-select`} value={district} onChange={(e) => setDistrict(e.target.value)}>
                      <option value="" disabled>Selecciona…</option>
                      {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={darkLabel}>Horario preferido</label>
                    <select className={`${darkField} dark-select`} value={time} onChange={(e) => setTime(e.target.value)}>
                      <option value="">Sin preferencia</option>
                      {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
                <label className="flex items-center gap-2.5 text-[13px] text-ivory-100/90">
                  <input type="checkbox" checked={reception} onChange={(e) => setReception(e.target.checked)} className="h-4 w-4 accent-[#B6855E]" />
                  Hay recepción
                </label>
              </fieldset>

              <label className="flex cursor-pointer items-start gap-2.5 text-[13px] text-ink-700">
                <input type="checkbox" checked={tyc} onChange={(e) => setTyc(e.target.checked)} className="mt-0.5 h-4 w-4 accent-rosa-500" />
                <span>Acepto los términos. {model === 'A' ? `Entiendo que se cobrará ${money(totalSoles)} cada mes a mi tarjeta y que puedo pausar o cancelar cuando quiera.` : `Entiendo que se cobrará ${money(totalSoles)} en un solo pago a mi tarjeta (no es una suscripción, no se renueva).`}</span>
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
