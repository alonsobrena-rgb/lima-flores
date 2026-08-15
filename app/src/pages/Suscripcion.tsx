import { useState, useEffect, useRef } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/sections/SiteFooter';
import { money } from '@/lib/cart';
import { plans, MONTHLY_PRICE, type Plan } from '@/data/plans';
import { Reveal, Stagger, StaggerItem } from '@/components/motion/Reveal';
import { Seccion, Encabezado } from '@/components/sections/Seccion';
import { attachAutocomplete, geocodeText, mapsAvailable, onMapsAuthFailure, DISTRICT_CENTROIDS, type PlaceResult } from '@/lib/maps';
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
    <div className="min-h-screen bg-background">
      <div>
        <SiteHeader />

        <Seccion filete={false} className="pb-0 pt-[clamp(40px,6vh,72px)]">
          <Encabezado
            rotulo="Suscripción"
            titulo={<>Flores frescas en casa, <em>todo el mes.</em></>}
            className="mb-10"
          />
          {/* La entrada y los tres datos en una sola fila: el párrafo solo dejaba
              media pantalla en blanco a su derecha. Mismo patrón que el pie del
              hero de la portada. */}
          <div className="grid gap-8 border-t border-border pt-8 lg:grid-cols-[minmax(0,52ch)_auto] lg:gap-16">
            <p className="text-[17px] leading-relaxed text-ink-700">
              Un mismo precio — <strong className="font-medium text-ink-900">S/130 al mes</strong> —
              y dos entregas mensuales de flores de estación, seleccionadas y armadas a
              mano. Pausa o cancela cuando quieras.
            </p>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-5 sm:gap-x-10 lg:justify-items-end lg:text-right">
              {[
                { valor: money(MONTHLY_PRICE), nota: 'Al mes' },
                { valor: 'Dos entregas', nota: 'Cada mes' },
                { valor: 'Sin permanencia', nota: 'Pausa cuando quieras' },
              ].map((d) => (
                <div key={d.valor}>
                  <dt className="display text-[15px] leading-snug text-ink-900 sm:text-[19px]">{d.valor}</dt>
                  <dd className="mt-1 text-[9px] font-medium uppercase leading-tight tracking-[0.16em] text-ink-500 sm:mt-1.5 sm:text-[11px] sm:tracking-[0.18em]">{d.nota}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Seccion>

        {/* ── Flores de estación: galería de entregas reales ──
            Las fotos son el argumento de esta sección: son entregas de verdad, no
            un catálogo. Antes vivían debajo de un panel esmerilado y a un cuarto
            de ancho; ahora ocupan la fila entera y el texto se retira al lado. */}
        <Seccion filete={false} className="pt-[clamp(40px,6vh,72px)]">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,46ch)] lg:items-end lg:gap-16">
            <Reveal>
              <p className="rotulo">Flores de estación</p>
              <h2 className="display mt-4 text-[clamp(2.1rem,4.6vw,3.6rem)] leading-[0.98] text-ink-900">
                Siempre distintas,<br />siempre de <em>temporada.</em>
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="text-[16px] leading-relaxed text-ink-700">
                No trabajamos con catálogos fijos: cada semana elegimos las flores que
                están en su <strong className="font-medium text-ink-900">mejor momento</strong> y
                nuestras floristas arman cada ramo <strong className="font-medium text-ink-900">a mano</strong>.
                Ninguna entrega es igual a la anterior.
              </p>
            </Reveal>
          </div>
          <Stagger className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">
            {PHOTOS.map((ph) => (
              <StaggerItem key={ph.src}>
                <div className="group overflow-hidden bg-secondary">
                  <img src={ph.src} alt={ph.alt} loading="lazy" className="aspect-[3/4] w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <p className="mt-4 border-t border-border pt-3.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">
            Entregas reales · flores de estación armadas a mano
          </p>
        </Seccion>

        {/* ── Planes ── */}
        <Seccion className="pb-[clamp(64px,9vh,120px)]">
          {/* El conmutador de pago, sin el panel esmerilado que lo sostenía sobre
              la foto: sobre blanco no hace falta nada debajo. */}
          <div className="mb-10 flex flex-col items-start gap-3 border-b border-border pb-8 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-ink-500">¿Cómo prefieres pagar?</span>
            <div className="inline-flex rounded-full border border-border bg-ivory-100 p-1">
              <button onClick={() => setModel('A')} className={`rounded-full px-5 py-2 text-[13px] font-medium tracking-[0.04em] transition-colors ${model === 'A' ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:text-ink-900'}`}>Mes a mes</button>
              <button onClick={() => setModel('B')} className={`rounded-full px-5 py-2 text-[13px] font-medium tracking-[0.04em] transition-colors ${model === 'B' ? 'bg-rosa-500 text-ivory-50' : 'text-ink-700 hover:text-ink-900'}`}>Pago único</button>
            </div>
          </div>
          <p className="mb-10 max-w-[62ch] text-[15px] leading-relaxed text-ink-500">{model === 'A' ? 'Suscripción: S/130 cada mes, sin permanencia — pausa o cancela cuando quieras.' : 'Un solo pago por todo el periodo (S/130/mes · 3, 6 o 12 meses). No es suscripción: no se renueva.'}</p>

          {/* key={model}: al alternar A/B cambian las tarjetas; sin remount, los
              StaggerItem nuevos montan bajo un Stagger cuyo whileInView ya disparó
              (once) y se quedan en opacity:0 (invisibles). Remontar re-anima. */}
          <Stagger key={model} className={single ? '' : 'grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3'}>
            {visiblePlans.map((p) => {
              const pr = priceFor(p);
              return (
                <StaggerItem key={p.tier} className="h-full">
                  {/* Sin tarjeta: un filete arriba y el precio mandando. El plan
                      destacado se marca con el filete en rosa, no con sombra,
                      escala y una etiqueta colgando de la esquina. */}
                  {/* Con un solo plan (mes a mes) la columna angosta dejaba media
                      pantalla vacía a su derecha; ahí se abre en dos y lo que
                      incluye pasa al lado, en dos columnas. Con tres planes, cada
                      uno es una columna y manda el precio. */}
                  <div className={`h-full border-t pt-6 ${p.featured ? 'border-rosa-500' : 'border-border'} ${single ? 'lg:grid lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] lg:gap-20' : 'flex flex-col'}`}>
                    <div>
                      <div className="flex items-baseline justify-between gap-3">
                        <h3 className="display text-[22px] leading-none text-ink-900">{p.name}</h3>
                        {(p.featured || p.value) && (
                          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-rosa-500">{p.featured ? 'Más popular' : 'Mejor valor'}</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">{p.period}</p>

                      <p className="display mt-6 text-[clamp(2.4rem,3.4vw,3rem)] leading-none text-ink-900">{pr.big}</p>
                      <p className="mt-2 text-[13px] text-ink-500">{pr.small}</p>
                      {model === 'B' && (
                        <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.18em] text-rosa-500">Pago único · no se renueva</p>
                      )}
                      <p className="display mt-5 text-[19px] leading-snug text-ink-700">{p.tagline}</p>
                    </div>

                    <div className={single ? 'mt-8 lg:mt-0' : 'flex flex-1 flex-col'}>
                      <ul className={`mt-6 flex-1 lg:mt-0 ${single ? 'sm:grid sm:grid-cols-2 sm:gap-x-12' : ''}`}>
                        {p.features.map((f) => (
                          <li key={f} className="flex gap-2.5 border-t border-border py-3 text-[15px] leading-snug text-ink-700"><CheckIcon /><span>{f}</span></li>
                        ))}
                      </ul>
                      <button onClick={() => { setOpenPlan(p); }}
                        className={`press mt-7 rounded-pill py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] transition-colors ${single ? 'w-full sm:w-auto sm:px-12' : 'w-full'} ${p.featured ? 'bg-rosa-500 text-white hover:bg-rosa-600' : 'border border-ivory-400 text-ink-900 hover:border-rosa-500 hover:bg-rosa-500 hover:text-white'}`}>
                        Suscribirme →
                      </button>
                    </div>
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
          <p className="mt-12 border-t border-border pt-5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink-500">Todas las suscripciones incluyen entrega a domicilio dentro de Lima Metropolitana</p>
        </Seccion>

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
  const [sinSugerencias, setSinSugerencias] = useState(false);
  // Si Google rechaza la llave (referrer no autorizado, llave inválida), las
  // sugerencias no van a llegar nunca: la pista del campo deja de prometerlas.
  useEffect(() => onMapsAuthFailure(() => setSinSugerencias(true)), []);

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
                  <label className={darkLabel}>Dirección *{mapsAvailable() && (
                      <span className="ml-2 normal-case tracking-normal text-[#E7AFC2]">
                        {sinSugerencias ? '· escríbela completa, con distrito' : '· elige una sugerencia o escríbela completa'}
                      </span>
                    )}</label>
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
