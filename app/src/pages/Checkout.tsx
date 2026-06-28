import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteHeader } from '@/components/SiteHeader';
import { useCart, money } from '@/lib/cart';
import { attachAutocomplete, geocodeText, mapsAvailable, DISTRICT_CENTROIDS, type PlaceResult } from '@/lib/maps';
import { districts, timeSlots } from '@/lib/delivery';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
// Llave pública de Culqi (segura de exponer). Sin ella, "Tarjeta" no aparece y
// el pago se coordina manualmente como Yape/Plin.
const CULQI_PK = (import.meta.env.VITE_CULQI_PUBLIC_KEY as string | undefined) || '';
const CULQI_JS = 'https://checkout.culqi.com/js/v4';

// Carga el script de Culqi v4 una sola vez. Resuelve cuando window.Culqi existe.
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
// Solo 2 métodos, ambos cobran en línea con Culqi (si hay llave pública): Yape y
// Tarjeta. Sin llave pública caen al flujo manual (coordinar por WhatsApp).
const payments = ['Yape', 'Tarjeta'];

type Place = { lat: number; lng: number; district: string | null; formatted: string };
type Shipping = { fee: number | null; provider: string | null; label: string };

// Recordamos los datos del checkout en localStorage para precargarlos en la
// próxima compra. NO guardamos fecha, hora, el mensaje de la tarjeta ni "enviar
// como anónimo" — son específicos de cada pedido.
const CHECKOUT_KEY = 'lf_checkout';
type SavedCheckout = {
  buyer?: { name: string; email: string; phone: string };
  recip?: { name: string; phone: string; ref: string; apt: string };
  district?: string;
  payment?: string;
  reception?: boolean;
  place?: Place | null;
  addressText?: string;
};
function loadCheckout(): SavedCheckout {
  try { return JSON.parse(localStorage.getItem(CHECKOUT_KEY) || '{}') || {}; } catch { return {}; }
}

export default function Checkout() {
  const { items, productById, subtotal, clear, remove } = useCart();
  const navigate = useNavigate();

  // form state — algunos campos se precargan con lo guardado de una compra previa
  // (CHECKOUT_KEY). Fecha, hora, mensaje de tarjeta y "anónimo" NO se recuerdan.
  const [saved] = useState(loadCheckout);
  const [buyer, setBuyer] = useState(saved.buyer ?? { name: '', email: '', phone: '' });
  const [recip, setRecip] = useState(saved.recip ?? { name: '', phone: '', ref: '', apt: '' });
  const [district, setDistrict] = useState(saved.district ?? '');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [payment, setPayment] = useState(saved.payment ?? '');
  const [reception, setReception] = useState(saved.reception ?? true);
  const [cardNote, setCardNote] = useState('');
  const [cardAnon, setCardAnon] = useState(false);
  const [place, setPlace] = useState<Place | null>(saved.place ?? null);
  const [shipping, setShipping] = useState<Shipping>({ fee: null, provider: null, label: 'Por calcular' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const addressRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);

  // Guarda los datos reutilizables del checkout (todo menos fecha/hora/mensaje de
  // tarjeta/anónimo) para precargarlos la próxima compra.
  const persistCheckout = () => {
    const data: SavedCheckout = {
      buyer, recip, district, payment, reception, place,
      addressText: place?.formatted || addressRef.current?.value || '',
    };
    try { localStorage.setItem(CHECKOUT_KEY, JSON.stringify(data)); } catch { /* storage no disponible */ }
  };
  useEffect(() => {
    persistCheckout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyer, recip, district, payment, reception, place]);

  // cotización real de envío por coordenadas (Cabify/Urbaner). Sin coords no hay
  // monto: el envío queda "por calcular" hasta que el usuario ponga su ubicación.
  const quoteByCoords = async (lat: number, lng: number) => {
    try {
      const r = await fetch(`${API_BASE}/api/quote?lat=${lat}&lng=${lng}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d.price === 'number') setShipping({ fee: d.price, provider: d.provider || null, label: d.provider ? `vía ${d.provider}` : 'Cotizado' });
    } catch { /* sin CORS/red → se mantiene "por calcular" */ }
  };

  // Match tolerante de distrito: cualquier candidato de Google vs nuestra lista
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
    quoteByCoords(loc.lat, loc.lng);
  };

  // Autocomplete de Google Places (con fixes móvil/tap portados del vanilla).
  // El input SIEMPRE acepta texto libre: si el usuario no elige sugerencia,
  // onSubmit geocodifica el texto (o usa el centroide del distrito).
  useEffect(() => {
    let ac: any; let cancelled = false;
    if (!addressRef.current) return;
    // Restaura la dirección escrita de una compra previa (input no controlado).
    if (saved.addressText && !addressRef.current.value) addressRef.current.value = saved.addressText;
    attachAutocomplete(addressRef.current, (loc) => { if (!cancelled) applyPlace(loc); })
      .then((widget) => { ac = widget; })
      .catch(() => { /* sin key/referrer → input de texto normal */ });
    return () => { cancelled = true; const w = window as any; if (ac && w.google) w.google.maps.event.clearInstanceListeners(ac); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mapa con marcador arrastrable
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
        quoteByCoords(lat, lng);
      });
    } else { mapObj.current.setCenter(pos); markerObj.current.setPosition(pos); }
  }, [place]);

  if (items.length === 0) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 px-6 py-32 text-center">
          <h1 className="font-display text-4xl text-ink-900">Tu carrito está vacío.</h1>
          <Link to="/catalogo" className="text-sm font-medium uppercase tracking-[0.16em] text-rosa-500 hover:text-rosa-600">Ir al catálogo →</Link>
        </div>
      </div>
    );
  }

  const total = shipping.fee !== null ? subtotal + shipping.fee : null;
  // Fecha mínima seleccionable = mañana (hora local): no se permiten fechas
  // pasadas ni el mismo día.
  const minDate = (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('en-CA'); })();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (!payment) { setError('Elige un método de pago.'); return; }
    setSending(true);
    // Coordenadas: lugar elegido → geocodificar el texto libre → centroide del
    // distrito. El pedido SIEMPRE lleva lat/lng numéricos (la API los exige) y
    // escribir a mano nunca bloquea el envío.
    let coords: { lat: number; lng: number } | null = place ? { lat: place.lat, lng: place.lng } : null;
    const addressText = addressRef.current?.value?.trim() || '';
    if (!coords && addressText) {
      const geo = await geocodeText(`${addressText}, ${district && district !== 'Otro' ? district + ', ' : ''}Lima, Perú`);
      if (geo) coords = { lat: geo.lat, lng: geo.lng };
    }
    if (!coords) coords = DISTRICT_CENTROIDS[district] || DISTRICT_CENTROIDS['Otro'];
    const payload = {
      buyer_name: buyer.name, buyer_email: buyer.email, buyer_phone: buyer.phone,
      recipient_name: recip.name, recipient_phone: recip.phone,
      recipient_address: place?.formatted || addressText,
      recipient_address_ref: recip.ref || null, recipient_apt: recip.apt || null, recipient_has_reception: reception,
      recipient_lat: coords.lat, recipient_lng: coords.lng,
      delivery_date: date, delivery_time: time,
      payment_method: payment, card_note: cardNote || null, card_anonymous: cardAnon,
      items: items.map((it) => { const p = productById(it.id); return { id: it.id, name: p?.name, price: p?.price, qty: it.qty }; }),
      subtotal, shipping_fee: shipping.fee ?? 0, shipping_provider: shipping.provider, shipping_label: shipping.label, total: total ?? subtotal,
      culqi_charge_id: null as string | null,
    };

    // Tarjeta o Yape → cobramos en línea con Culqi ANTES de registrar el pedido.
    if ((payment === 'Tarjeta' || payment === 'Yape') && CULQI_PK) {
      try { await payWithCulqi(payload, payment); }
      catch (err: any) { setError(err?.message || 'No se pudo procesar el pago.'); setSending(false); }
      return; // el flujo continúa en el callback del modal de Culqi
    }

    // Resto de métodos (Plin/transferencia/efectivo): registramos el pedido y
    // coordinamos el pago por WhatsApp.
    await placeOrder(payload);
  };

  // Registra el pedido en el backend. Comparte el manejo de errores entre el
  // flujo manual (Yape/Plin/…) y el de tarjeta (tras el cobro aprobado).
  const placeOrder = async (payload: Record<string, unknown>) => {
    try {
      const r = await fetch(`${API_BASE}/api/order`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (r.ok) { clear(); navigate('/confirmacion'); return; }
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || ('HTTP ' + r.status));
    } catch (err: any) {
      // Falla de red/CORS (backend sin desplegar) → completamos el flujo en cliente.
      if (err instanceof TypeError) { clear(); navigate('/confirmacion'); return; }
      setError(err.message || 'No pudimos guardar el pedido.');
    } finally { setSending(false); }
  };

  // Abre el modal de Culqi (tarjeta o Yape), cobra vía /api/culqi/charge y, si
  // aprueba, registra el pedido con el charge_id. Tarjeta/Yape generan un token
  // en el dispositivo del cliente; sus datos nunca pasan por nuestro server. Yape
  // se cobra igual que tarjeta (token → /v2/charges con source_id).
  const payWithCulqi = async (payload: Record<string, unknown>, method: 'Tarjeta' | 'Yape') => {
    await loadCulqi();
    const w = window as any;
    const Culqi = w.Culqi;
    const amountCents = Math.round((total ?? subtotal) * 100);
    Culqi.publicKey = CULQI_PK;
    Culqi.settings({ title: 'Lima Flores', currency: 'PEN', amount: amountCents });
    const paymentMethods = method === 'Yape'
      ? { tarjeta: false, yape: true, bancaMovil: false, agente: false, billetera: false, cuotealo: false }
      : { tarjeta: true, yape: false, bancaMovil: false, agente: false, billetera: false, cuotealo: false };
    Culqi.options({ lang: 'auto', installments: false, paymentMethods });

    w.culqi = async () => {
      if (Culqi.token && Culqi.token.id) {
        try {
          const r = await fetch(`${API_BASE}/api/culqi/charge`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: Culqi.token.id, email: buyer.email, items: payload.items, shipping_fee: payload.shipping_fee }),
          });
          const d = await r.json().catch(() => ({}));
          if (!r.ok || !d.ok) throw new Error(d.error || 'El pago fue rechazado.');
          await placeOrder({ ...payload, payment_method: `${method} (Culqi)`, culqi_charge_id: d.charge_id });
        } catch (err: any) {
          setError(err?.message || 'No se pudo procesar el pago.'); setSending(false);
        }
      } else if (Culqi.error) {
        setError(Culqi.error.user_message || Culqi.error.merchant_message || 'No se pudo procesar el pago.'); setSending(false);
      } else {
        // Modal cerrado sin completar.
        setSending(false);
      }
    };

    Culqi.open();
  };

  const field = 'mt-1.5 w-full border border-border bg-surface px-4 py-3 text-ink-900 outline-none transition-colors focus:border-rosa-500';
  const label = 'text-[12px] font-medium uppercase tracking-[0.14em] text-foreground/55';
  // Campos sobre la tarjeta verde oscuro (claro sobre verde). color-scheme:dark
  // hace que el ícono del date/select nativo salga claro y legible.
  const darkField = 'mt-1.5 w-full rounded border border-ivory-100/25 bg-ivory-100/10 px-4 py-3 text-ivory-50 outline-none transition-colors placeholder:text-ivory-100/40 [color-scheme:dark] focus:border-ivory-100 focus:bg-ivory-100/20';
  const darkLabel = 'text-[12px] font-medium uppercase tracking-[0.14em] text-ivory-100/70';
  // Aclaración (nota) dentro de la tarjeta verde: borde-acento + texto claro.
  const note = 'border-l-[3px] bg-ivory-100/10 px-4 py-3.5 text-[13px] leading-relaxed text-ivory-100/90';

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
        <h1 className="font-display text-[2.5rem] font-light leading-none tracking-tight text-ink-900 md:text-5xl">Finaliza tu pedido</h1>
        <div className="mt-12 grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-12">
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Comprador */}
            <fieldset className="frost space-y-5 p-6 md:p-8">
              <div className="mb-3 flex items-baseline gap-3 px-1">
                <span className="font-display text-2xl italic text-rosa-500">01</span>
                <span className="font-display text-xl text-ink-900">Tus datos (quien compra)</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Nombre completo</label><input required value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className={field} placeholder="Ej. María Pérez" /></div>
                <div><label className={label}>Teléfono / WhatsApp</label><input required type="tel" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} className={field} placeholder="999 999 999" /></div>
              </div>
              <div><label className={label}>Email</label><input required type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} className={field} placeholder="tu@correo.com" /></div>
            </fieldset>

            {/* Destinatario + entrega — toda la info de quien recibe sobre una
                tarjeta verde oscuro, con sus aclaraciones. */}
            <fieldset className="space-y-5 rounded-lg border border-ivory-100/10 bg-[#2F3925] p-6 text-ivory-100 shadow-[0_24px_56px_-16px_rgba(47,57,37,0.45)] md:p-8">
              <div className="mb-1 flex flex-wrap items-center gap-3 px-1">
                <span className="font-display text-2xl italic text-[#E7AFC2]">02</span>
                <span className="rounded-sm bg-[#B6855E] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#2F3925]">Para</span>
                <span className="font-display text-xl text-ivory-50">Quien recibe las flores</span>
              </div>
              <p className="px-1 text-sm leading-relaxed text-ivory-100/80">Estos son los datos de la persona que abrirá la puerta — su ubicación exacta, su nombre y su teléfono.</p>

              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={darkLabel}>Nombre de quien recibe</label><input required value={recip.name} onChange={(e) => setRecip({ ...recip, name: e.target.value })} className={darkField} placeholder="Ej. Ana Torres" /></div>
                <div><label className={darkLabel}>Teléfono de quien recibe</label><input required type="tel" value={recip.phone} onChange={(e) => setRecip({ ...recip, phone: e.target.value })} className={darkField} placeholder="999 999 999" /></div>
              </div>

              {/* Aclaración · el teléfono es del destinatario */}
              <div className={`${note} border-ivory-50/80`}>
                <strong className="block font-display italic text-ivory-50">Importante · este teléfono es de quien recibe las flores</strong>
                Usamos el número de quien recibirá el pedido (no el tuyo) solo al momento de la entrega, para coordinar si no podemos dejar el paquete en la puerta. No es para confirmaciones previas ni spam.
              </div>

              <div>
                <label className={darkLabel}>Dirección {mapsAvailable() && <span className="ml-2 normal-case tracking-normal text-[#E7AFC2]">· elige una sugerencia o escríbela completa</span>}</label>
                <input ref={addressRef} required onBlur={persistCheckout} className={darkField} placeholder="Av. / Calle, número, distrito…" autoComplete="off" />
              </div>
              {place && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm text-ivory-100/85">
                    <svg className="h-4 w-4 shrink-0 text-[#E7AFC2]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                    {place.formatted}
                  </p>
                  <div ref={mapRef} className="h-52 w-full overflow-hidden rounded-sm border border-ivory-100/20" />
                  {/* Aclaración · el pin manda */}
                  <div className={`mt-2 flex gap-3 rounded-r-sm ${note} border-[#B6855E]`}>
                    <span className="shrink-0 text-base leading-none">📍</span>
                    <span><strong className="block font-display italic text-ivory-50">Las flores se entregan exactamente donde está el pin.</strong>Si no coincide con la puerta del edificio o casa, arrástralo. La dirección escrita es solo referencia — lo que cuenta es la posición del mapa.</span>
                  </div>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={darkLabel}>Referencia (opcional)</label><input value={recip.ref} onChange={(e) => setRecip({ ...recip, ref: e.target.value })} className={darkField} placeholder="Casa blanca, reja negra…" /></div>
                <div><label className={darkLabel}>Dpto / Interior (opcional)</label><input value={recip.apt} onChange={(e) => setRecip({ ...recip, apt: e.target.value })} className={darkField} placeholder="301" /></div>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className={darkLabel}>Distrito</label>
                  <select required className={`${darkField} dark-select`} value={district} onChange={(e) => setDistrict(e.target.value)}>
                    <option value="" disabled>Selecciona…</option>
                    {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label className={darkLabel}>Fecha</label><input required type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} className={darkField} /></div>
                <div>
                  <label className={darkLabel}>Horario</label>
                  <select required className={`${darkField} dark-select`} value={time} onChange={(e) => setTime(e.target.value)}>
                    <option value="" disabled>Selecciona…</option>
                    {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-ivory-100/90">
                <input type="checkbox" checked={reception} onChange={(e) => setReception(e.target.checked)} className="h-4 w-4 accent-[#B6855E]" />
                Hay recepción
              </label>

              {/* Mensaje de la tarjeta — va con quien recibe */}
              <div className="border-t border-dashed border-ivory-100/20 pt-5">
                <label className={darkLabel}>Mensaje en la tarjeta (opcional)</label>
                <textarea rows={3} maxLength={220} value={cardNote} onChange={(e) => setCardNote(e.target.value)} className={darkField} placeholder="Lo que quieras que escribamos a mano…" />
                <p className="mt-1.5 text-[12px] text-ivory-100/55">Lo imprimimos en una tarjeta que acompaña tu arreglo. {cardNote.length}/220</p>
                <label className="mt-3 flex items-center gap-2.5 text-sm text-ivory-100/90">
                  <input type="checkbox" checked={cardAnon} onChange={(e) => setCardAnon(e.target.checked)} className="h-4 w-4 accent-[#B6855E]" />
                  Enviar como anónimo — no incluir mi nombre en la tarjeta
                </label>
              </div>
            </fieldset>

            {/* Pago */}
            <fieldset className="frost space-y-5 p-6 md:p-8">
              <div className="mb-3 flex items-baseline gap-3 px-1">
                <span className="font-display text-2xl italic text-rosa-500">03</span>
                <span className="font-display text-xl text-ink-900">Pago</span>
              </div>
              <div>
                <label className={label}>Método de pago</label>
                <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
                  {payments.map((p) => {
                    const active = payment === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPayment(p)}
                        aria-pressed={active}
                        className={`flex items-center gap-3 border px-4 py-3 text-left transition-colors ${active ? 'border-rosa-500 bg-rosa-50' : 'border-border bg-surface hover:border-rosa-300'}`}
                      >
                        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${active ? 'border-rosa-500' : 'border-border'}`}>
                          {active && <span className="h-2.5 w-2.5 rounded-full bg-rosa-500" />}
                        </span>
                        <span className="text-sm font-medium text-ink-900">{p}</span>
                      </button>
                    );
                  })}
                </div>
                {CULQI_PK && payment === 'Tarjeta' && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-foreground/55">
                    <svg className="h-3.5 w-3.5 shrink-0 text-verde-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    Pago seguro con tarjeta vía Culqi (con verificación 3-D Secure). Se cobra al confirmar.
                  </p>
                )}
                {CULQI_PK && payment === 'Yape' && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-foreground/55">
                    <svg className="h-3.5 w-3.5 shrink-0 text-verde-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    Pago con Yape vía Culqi. Ten a la mano el <strong>código de aprobación</strong> de tu app Yape. Se cobra al confirmar.
                  </p>
                )}
                {!CULQI_PK && (payment === 'Yape' || payment === 'Tarjeta') && (
                  <p className="mt-2 text-[12px] text-foreground/55">Coordinamos el pago por {payment} al confirmar el pedido.</p>
                )}
              </div>
            </fieldset>

            {error && <p className="bg-red-100 px-4 py-3 text-sm text-red-800">{error}</p>}
            <button disabled={sending} className="press w-full bg-rosa-500 py-4 text-sm font-medium uppercase tracking-[0.18em] text-ivory-50 transition-colors hover:bg-rosa-600 disabled:opacity-60">
              {sending ? 'Procesando…' : CULQI_PK && (payment === 'Tarjeta' || payment === 'Yape') && total !== null ? `Pagar con ${payment} · ${money(total)}` : total !== null ? `Confirmar pedido · ${money(total)}` : 'Confirmar pedido'}
            </button>
            <p className="text-center text-[12px] text-foreground/50">Al confirmar, te contactamos por WhatsApp en menos de 30 min para coordinar el pago y la entrega.</p>
          </form>

          {/* Resumen */}
          <aside className="frost h-fit p-6 md:sticky md:top-24">
            <h2 className="mb-5 font-display text-xl text-ink-900">Tu pedido</h2>
            <div className="space-y-4">
              {items.map((it) => {
                const p = productById(it.id); if (!p) return null;
                return (
                  <div key={it.id} className="flex gap-3">
                    <img src={p.image} alt={p.name} className="h-16 w-14 shrink-0 rounded-sm object-cover" />
                    <div className="flex flex-1 items-start justify-between gap-2">
                      <div>
                        <p className="font-display text-sm font-medium leading-tight text-ink-900">{p.name}</p>
                        <p className="text-[12px] text-foreground/50">Cantidad: {it.qty}</p>
                        <button
                          type="button"
                          onClick={() => remove(it.id)}
                          className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.12em] text-foreground/45 transition-colors hover:text-rosa-500"
                        >
                          <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                          Quitar
                        </button>
                      </div>
                      <span className="shrink-0 text-sm italic text-ink-700">{money(p.price * it.qty)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-ink-600"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
              <div className="flex justify-between text-ink-600"><dt>Envío {shipping.provider && <span className="text-[11px] text-foreground/45">({shipping.label})</span>}</dt><dd>{shipping.fee !== null ? money(shipping.fee) : <span className="text-foreground/45">— por calcular</span>}</dd></div>
              <div className="flex justify-between border-t border-border pt-3 font-display text-xl text-ink-900"><dt>Total</dt><dd>{total !== null ? money(total) : <span className="text-base font-normal text-foreground/45">— por calcular</span>}</dd></div>
            </dl>
            <a
              href={`https://wa.me/51999479855?text=${encodeURIComponent('Hola, necesito ayuda con mi pedido en Lima Flores')}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Pedir ayuda por WhatsApp"
              className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-5 text-[12px] font-medium uppercase tracking-[0.14em] text-rosa-500 transition-colors hover:text-rosa-600"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
              </svg>
              ¿Necesitas ayuda? · WhatsApp
            </a>
          </aside>
        </div>
      </div>
    </div>
  );
}
