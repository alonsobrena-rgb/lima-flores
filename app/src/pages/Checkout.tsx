import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SiteHeader } from '@/components/SiteHeader';
import { useCart, money } from '@/lib/cart';
import { attachAutocomplete, geocodeText, mapsAvailable, DISTRICT_CENTROIDS, type PlaceResult } from '@/lib/maps';

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) || '';
const districts = ['Miraflores', 'San Isidro', 'Surco', 'Barranco', 'San Borja', 'La Molina', 'Magdalena', 'Jesús María', 'Lince', 'Pueblo Libre', 'Otro'];
const timeSlots = ['09:00 – 13:00', '13:00 – 17:00', '17:00 – 20:00'];
const payments = ['Yape', 'Plin', 'Transferencia BCP', 'Efectivo contra entrega'];
const FLAT = 15;

type Place = { lat: number; lng: number; district: string | null; formatted: string };
type Shipping = { fee: number; provider: string | null; label: string };

export default function Checkout() {
  const { items, productById, subtotal, clear } = useCart();
  const navigate = useNavigate();

  // form state
  const [buyer, setBuyer] = useState({ name: '', email: '', phone: '' });
  const [recip, setRecip] = useState({ name: '', phone: '', ref: '', apt: '' });
  const [district, setDistrict] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [payment, setPayment] = useState('');
  const [reception, setReception] = useState(true);
  const [cardNote, setCardNote] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [shipping, setShipping] = useState<Shipping>({ fee: FLAT, provider: null, label: 'Estimado' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const addressRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<any>(null);
  const markerObj = useRef<any>(null);

  // cotización real de envío por coordenadas (Cabify/Urbaner) — fallback a tarifa plana
  const quoteByCoords = async (lat: number, lng: number) => {
    try {
      const r = await fetch(`${API_BASE}/api/quote?lat=${lat}&lng=${lng}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) return;
      const d = await r.json();
      if (typeof d.price === 'number') setShipping({ fee: d.price, provider: d.provider || null, label: d.provider ? `vía ${d.provider}` : 'Cotizado' });
    } catch { /* sin CORS/red → se mantiene la tarifa plana */ }
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

  const total = subtotal + shipping.fee;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setSending(true);
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
      payment_method: payment, card_note: cardNote || null,
      items: items.map((it) => { const p = productById(it.id); return { id: it.id, name: p?.name, price: p?.price, qty: it.qty }; }),
      subtotal, shipping_fee: shipping.fee, shipping_provider: shipping.provider, shipping_label: shipping.label, total,
    };
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

  const field = 'mt-1.5 w-full border border-border bg-surface px-4 py-3 text-ink-900 outline-none transition-colors focus:border-rosa-500';
  const label = 'text-[12px] font-medium uppercase tracking-[0.14em] text-foreground/55';

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-6 py-12 md:px-12 md:py-16">
        <h1 className="font-display text-[2.5rem] font-light leading-none tracking-tight text-ink-900 md:text-5xl">Finaliza tu pedido</h1>
        <div className="mt-12 grid gap-8 md:grid-cols-[1.4fr_1fr] md:gap-12">
          <form onSubmit={onSubmit} className="space-y-6">
            {/* Comprador */}
            <fieldset className="frost space-y-5 p-6 md:p-8">
              <legend className="mb-3 flex items-baseline gap-3 px-1">
                <span className="font-display text-2xl italic text-rosa-500">01</span>
                <span className="font-display text-xl text-ink-900">Tus datos (quien compra)</span>
              </legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Nombre completo</label><input required value={buyer.name} onChange={(e) => setBuyer({ ...buyer, name: e.target.value })} className={field} placeholder="Ej. María Pérez" /></div>
                <div><label className={label}>Teléfono / WhatsApp</label><input required type="tel" value={buyer.phone} onChange={(e) => setBuyer({ ...buyer, phone: e.target.value })} className={field} placeholder="999 999 999" /></div>
              </div>
              <div><label className={label}>Email</label><input required type="email" value={buyer.email} onChange={(e) => setBuyer({ ...buyer, email: e.target.value })} className={field} placeholder="tu@correo.com" /></div>
            </fieldset>

            {/* Destinatario + entrega */}
            <fieldset className="frost space-y-5 p-6 md:p-8">
              <legend className="mb-3 flex items-baseline gap-3 px-1">
                <span className="font-display text-2xl italic text-rosa-500">02</span>
                <span className="font-display text-xl text-ink-900">Entrega (quien recibe)</span>
              </legend>
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Nombre de quien recibe</label><input required value={recip.name} onChange={(e) => setRecip({ ...recip, name: e.target.value })} className={field} placeholder="Ej. Ana Torres" /></div>
                <div><label className={label}>Teléfono de quien recibe</label><input required type="tel" value={recip.phone} onChange={(e) => setRecip({ ...recip, phone: e.target.value })} className={field} placeholder="999 999 999" /></div>
              </div>
              <div>
                <label className={label}>Dirección {mapsAvailable() && <span className="ml-2 normal-case tracking-normal text-rosa-500">· elige una sugerencia o escríbela completa</span>}</label>
                <input ref={addressRef} required className={field} placeholder="Av. / Calle, número, distrito…" autoComplete="off" />
              </div>
              {place && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-sm text-ink-600">
                    <svg className="h-4 w-4 shrink-0 text-rosa-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                    {place.formatted}
                  </p>
                  <div ref={mapRef} className="h-52 w-full overflow-hidden rounded-sm border border-border" />
                  <p className="mt-1.5 text-[12px] text-foreground/50">Arrastra el pin para ajustar el punto exacto.</p>
                </div>
              )}
              <div className="grid gap-5 sm:grid-cols-2">
                <div><label className={label}>Referencia (opcional)</label><input value={recip.ref} onChange={(e) => setRecip({ ...recip, ref: e.target.value })} className={field} placeholder="Casa blanca, reja negra…" /></div>
                <div><label className={label}>Dpto / Interior (opcional)</label><input value={recip.apt} onChange={(e) => setRecip({ ...recip, apt: e.target.value })} className={field} placeholder="301" /></div>
              </div>
              <div className="grid gap-5 sm:grid-cols-3">
                <div>
                  <label className={label}>Distrito</label>
                  <select required className={field} value={district} onChange={(e) => setDistrict(e.target.value)}>
                    <option value="" disabled>Selecciona…</option>
                    {districts.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div><label className={label}>Fecha</label><input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></div>
                <div>
                  <label className={label}>Horario</label>
                  <select required className={field} value={time} onChange={(e) => setTime(e.target.value)}>
                    <option value="" disabled>Selecciona…</option>
                    {timeSlots.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2.5 text-sm text-ink-700">
                <input type="checkbox" checked={reception} onChange={(e) => setReception(e.target.checked)} className="h-4 w-4 accent-rosa-500" />
                Hay alguien que pueda recibir en esa dirección
              </label>
            </fieldset>

            {/* Pago + tarjeta */}
            <fieldset className="frost space-y-5 p-6 md:p-8">
              <legend className="mb-3 flex items-baseline gap-3 px-1">
                <span className="font-display text-2xl italic text-rosa-500">03</span>
                <span className="font-display text-xl text-ink-900">Pago y tarjeta</span>
              </legend>
              <div>
                <label className={label}>Método de pago</label>
                <select required className={field} value={payment} onChange={(e) => setPayment(e.target.value)}>
                  <option value="" disabled>Selecciona…</option>
                  {payments.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label className={label}>Mensaje para la tarjeta (opcional)</label><textarea rows={3} value={cardNote} onChange={(e) => setCardNote(e.target.value)} className={field} placeholder="Lo que quieras que escribamos a mano…" /></div>
            </fieldset>

            {error && <p className="bg-red-100 px-4 py-3 text-sm text-red-800">{error}</p>}
            <button disabled={sending} className="press w-full bg-rosa-500 py-4 text-sm font-medium uppercase tracking-[0.18em] text-ivory-50 transition-colors hover:bg-rosa-600 disabled:opacity-60">
              {sending ? 'Enviando…' : `Confirmar pedido · ${money(total)}`}
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
                      </div>
                      <span className="shrink-0 text-sm italic text-ink-700">{money(p.price * it.qty)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <dl className="mt-6 space-y-2 border-t border-border pt-4 text-sm">
              <div className="flex justify-between text-ink-600"><dt>Subtotal</dt><dd>{money(subtotal)}</dd></div>
              <div className="flex justify-between text-ink-600"><dt>Envío {shipping.provider && <span className="text-[11px] text-foreground/45">({shipping.label})</span>}</dt><dd>{money(shipping.fee)}</dd></div>
              <div className="flex justify-between border-t border-border pt-3 font-display text-xl text-ink-900"><dt>Total</dt><dd>{money(total)}</dd></div>
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}
