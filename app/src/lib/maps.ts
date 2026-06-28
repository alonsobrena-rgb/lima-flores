// Google Maps (Places) loader + helpers para el checkout.
// La key viene de VITE_GOOGLE_MAPS_KEY (ver .env.local). Sin key → no-op.
// Portado de site/js/geocoder.js (misma estrategia de Autocomplete + distrito).

const KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY as string | undefined;

// Lima Metropolitana bounding box (incluye Callao y balnearios sur).
export const LIMA_BOUNDS = { sw: { lat: -12.50, lng: -77.25 }, ne: { lat: -11.75, lng: -76.65 } };

export const mapsAvailable = () => !!KEY;

let sdkPromise: Promise<any> | null = null;

export function loadMaps(): Promise<any> {
  const w = window as any;
  if (w.google?.maps?.places) return Promise.resolve(w.google);
  if (sdkPromise) return sdkPromise;
  if (!KEY) return Promise.reject(new Error('no-key'));
  sdkPromise = new Promise((resolve, reject) => {
    const cb = '_gmaps_cb_' + Date.now().toString(36);
    w[cb] = () => { delete w[cb]; resolve(w.google); };
    const s = document.createElement('script');
    s.src = 'https://maps.googleapis.com/maps/api/js?key=' + encodeURIComponent(KEY) +
            '&libraries=places&v=weekly&loading=async&callback=' + cb;
    s.async = true; s.defer = true;
    s.onerror = () => reject(new Error('sdk-fail'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}

// Google no devuelve el distrito siempre en el mismo campo: devolvemos TODOS
// los candidatos en orden de prioridad para hacer match tolerante.
export function extractDistrictCandidates(components: any[]): string[] {
  if (!Array.isArray(components)) return [];
  const wanted = ['administrative_area_level_3', 'sublocality_level_1', 'sublocality', 'locality', 'administrative_area_level_2'];
  const out: string[] = [];
  for (const want of wanted) {
    for (const c of components) {
      if (!(c.types || []).includes(want)) continue;
      if (c.long_name && !out.includes(c.long_name)) out.push(c.long_name);
      if (c.short_name && !out.includes(c.short_name)) out.push(c.short_name);
    }
  }
  return out;
}

export function extractDistrict(components: any[]): string | null {
  return extractDistrictCandidates(components)[0] || null;
}

export type PlaceResult = {
  lat: number;
  lng: number;
  district: string | null;
  districtCandidates: string[];
  formatted: string;
  placeId?: string;
};

// ── Fix móvil del autocomplete ──
// En táctil el .pac-container queda tras el teclado y, peor, la API legacy de
// Google ya NO selecciona con eventos sintéticos (ignora isTrusted=false): el
// viejo truco del mousedown sintético dejó de funcionar. Reposicionamos con
// visualViewport y, al tocar una sugerencia, la resolvemos nosotros vía Places
// API (ver selectTappedSuggestion / resolveByPlacesQuery).
// Resuelve una sugerencia TOCADA (táctil) sin depender de la selección interna de
// Google: la API legacy ya ignora los eventos sintéticos (no confiables), así que
// leemos el texto del .pac-item, lo geocodificamos y lo entregamos por el callback
// (mismo camino que el fallback de texto libre del checkout).
async function selectTappedSuggestion(inputEl: HTMLInputElement, item: HTMLElement) {
  const query = (item.querySelector('.pac-item-query')?.textContent || '').replace(/\s+/g, ' ').trim();
  const full = (item.textContent || '').replace(/\s+/g, ' ').trim();
  const secondary = query && full.startsWith(query) ? full.slice(query.length).trim() : '';
  const text = secondary ? `${query}, ${secondary}` : (query || full);
  if (!text) return;
  inputEl.value = text;
  // Cierra el dropdown ya (Google lo recrea al seguir escribiendo).
  document.querySelectorAll<HTMLElement>('.pac-container').forEach((c) => c.style.setProperty('display', 'none', 'important'));
  // Resolvemos coordenadas con la Places API (siempre activa si el autocomplete
  // carga); si fallara, caemos a Geocoding (texto libre).
  const place = (await resolveByPlacesQuery(text)) || (await geocodeText(text));
  const cb = (inputEl as any)._lfOnPlace as ((p: PlaceResult) => void) | undefined;
  if (place && cb) { inputEl.value = place.formatted; cb(place); }
}

// Resuelve un texto a un lugar con la Places API (AutocompleteService → getDetails),
// sin depender de la Geocoding API. Devuelve coords + distrito + dirección formateada.
async function resolveByPlacesQuery(text: string): Promise<PlaceResult | null> {
  let g: any;
  try { g = await loadMaps(); } catch { return null; }
  try {
    const svc = new g.maps.places.AutocompleteService();
    const predictions: any[] = await new Promise((resolve) => {
      svc.getPlacePredictions(
        { input: text, componentRestrictions: { country: 'pe' }, bounds: new g.maps.LatLngBounds(LIMA_BOUNDS.sw, LIMA_BOUNDS.ne) },
        (res: any[], status: string) => resolve(status === 'OK' && Array.isArray(res) ? res : []),
      );
    });
    const placeId = predictions[0]?.place_id;
    if (!placeId) return null;
    const places = new g.maps.places.PlacesService(document.createElement('div'));
    return await new Promise<PlaceResult | null>((resolve) => {
      places.getDetails(
        { placeId, fields: ['geometry', 'formatted_address', 'address_components', 'name', 'place_id'] },
        (place: any, status: string) => {
          if (status !== 'OK' || !place?.geometry?.location) return resolve(null);
          const candidates = extractDistrictCandidates(place.address_components);
          const name = place.name as string | undefined;
          const addr = place.formatted_address || '';
          const formatted = name && addr && !addr.toLowerCase().startsWith(name.toLowerCase())
            ? `${name}, ${addr}` : (addr || name || text);
          resolve({
            lat: place.geometry.location.lat(), lng: place.geometry.location.lng(),
            district: candidates[0] || null, districtCandidates: candidates,
            formatted, placeId: place.place_id,
          });
        },
      );
    });
  } catch { return null; }
}

// Rastreamos el input de dirección ACTIVO (por foco): en una SPA hay varios
// (checkout y modal de suscripción) y el .pac-container es compartido. Sin esto,
// un singleton capturaría el primer input para siempre y escribiría en el equivocado.
let activeInput: HTMLInputElement | null = null;
let _globalDropdownObs = false;
let touchingPac = false;

function isMobileEnv(): boolean {
  return window.matchMedia('(max-width: 768px)').matches ||
    (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900);
}

function lastPac(): HTMLElement | null {
  const list = document.querySelectorAll<HTMLElement>('.pac-container');
  return list[list.length - 1] || null;
}

// Reposiciona el dropdown respecto al input activo, esquivando el teclado virtual.
function positionPac() {
  if (touchingPac) return;
  const input = activeInput;
  const pac = lastPac();
  if (!input || !pac) return;
  const vv = window.visualViewport;
  const vvTop = vv ? vv.offsetTop : 0;
  const vvHeight = vv ? vv.height : window.innerHeight;
  const vvWidth = vv ? vv.width : document.documentElement.clientWidth;
  const inputRect = input.getBoundingClientRect();
  const margin = 8;
  const minHeight = 160;
  const spaceBelow = (vvTop + vvHeight) - inputRect.bottom - margin;
  const spaceAbove = inputRect.top - vvTop - margin;
  pac.style.setProperty('position', 'fixed', 'important');
  pac.style.setProperty('left', margin + 'px', 'important');
  pac.style.setProperty('width', (vvWidth - margin * 2) + 'px', 'important');
  pac.style.setProperty('max-width', 'none', 'important');
  pac.style.setProperty('z-index', '999999', 'important');
  pac.style.setProperty('overflow-y', 'auto', 'important');
  if (spaceBelow >= minHeight || spaceBelow >= spaceAbove) {
    pac.style.setProperty('top', (inputRect.bottom + 4) + 'px', 'important');
    pac.style.setProperty('bottom', 'auto', 'important');
    pac.style.setProperty('max-height', Math.max(spaceBelow, minHeight) + 'px', 'important');
  } else {
    pac.style.setProperty('top', 'auto', 'important');
    pac.style.setProperty('bottom', (window.innerHeight - inputRect.top + 4) + 'px', 'important');
    pac.style.setProperty('max-height', Math.max(spaceAbove, minHeight) + 'px', 'important');
  }
}

// El .pac-container se crea diferido al escribir; lo perseguimos un rato.
let _chaseTimer: ReturnType<typeof setInterval> | null = null;
function chasePac() {
  if (_chaseTimer) clearInterval(_chaseTimer);
  let n = 0;
  _chaseTimer = setInterval(() => {
    positionPac();
    if (++n > 12 && _chaseTimer) { clearInterval(_chaseTimer); _chaseTimer = null; }
  }, 80);
}

// Listeners GLOBALES (una sola vez): observa la aparición del .pac-container y, en
// táctil, resuelve la sugerencia tocada nosotros mismos (Google ya ignora los
// eventos sintéticos, así que el viejo mousedown sintético no sirve).
function setupGlobalDropdown() {
  if (_globalDropdownObs) return;
  _globalDropdownObs = true;
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', positionPac);
    window.visualViewport.addEventListener('scroll', positionPac);
  }
  window.addEventListener('resize', positionPac);
  window.addEventListener('scroll', positionPac, { passive: true });
  const obs = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (n.nodeType === 1 && (n as HTMLElement).classList?.contains('pac-container')) {
          const pac = n as HTMLElement;
          pac.addEventListener('mousedown', (e) => e.preventDefault());
          pac.addEventListener('touchstart', (e) => {
            const item = (e.target as HTMLElement).closest('.pac-item') as HTMLElement | null;
            if (!item || !activeInput) return;
            touchingPac = true;
            e.preventDefault(); // evita el blur del input y el ghost-click sobre lo de atrás
            void selectTappedSuggestion(activeInput, item);
          }, { passive: false });
          pac.addEventListener('touchend', () => { setTimeout(() => { touchingPac = false; }, 50); }, { passive: true });
          pac.addEventListener('touchcancel', () => { touchingPac = false; }, { passive: true });
          positionPac();
        }
      }
    }
  });
  obs.observe(document.body, { childList: true });
}

// Por input (una vez por campo): marca cuál autocomplete está activo y reposiciona.
// Solo en móvil — en desktop Google maneja el click nativo (confiable), no tocamos.
function setupMobileDropdownFix(inputEl: HTMLInputElement) {
  if (!isMobileEnv()) return;
  inputEl.addEventListener('focus', () => { activeInput = inputEl; chasePac(); });
  inputEl.addEventListener('input', () => { activeInput = inputEl; requestAnimationFrame(positionPac); });
  setupGlobalDropdown();
}

// attachAutocomplete(inputEl, onPlace) — Autocomplete + fixes móvil/tap.
// Devuelve el widget (o null si Maps no está disponible).
export async function attachAutocomplete(
  inputEl: HTMLInputElement,
  onPlace: (p: PlaceResult) => void,
): Promise<any | null> {
  // Idempotente: React StrictMode (dev) monta el efecto dos veces y la versión
  // async hace que el cleanup corra antes de que `ac` exista → se enganchaban
  // dos Autocomplete y aparecían dos .pac-container superpuestos. Reusamos el
  // widget si el input ya tiene uno.
  const existing = (inputEl as any)._lfAutocomplete;
  if (existing) { (inputEl as any)._lfOnPlace = onPlace; return existing; }

  let g: any;
  try { g = await loadMaps(); } catch { return null; }
  // Si otra invocación (StrictMode) creó el widget mientras esperábamos el SDK,
  // reusamos ese pero ACTUALIZANDO el callback al más reciente. Olvidarlo dejaba
  // el callback del primer montaje (ya `cancelled`) → place_changed disparaba
  // pero applyPlace/setPlace nunca corría (el input se llenaba, el mapa no).
  if ((inputEl as any)._lfAutocomplete) {
    (inputEl as any)._lfOnPlace = onPlace;
    return (inputEl as any)._lfAutocomplete;
  }
  const ac = new g.maps.places.Autocomplete(inputEl, {
    componentRestrictions: { country: 'pe' },
    fields: ['geometry', 'formatted_address', 'address_components', 'place_id', 'name'],
    // Sin `types` → Autocomplete devuelve TODO: direcciones + establecimientos
    // (colegios, hospitales, locales, parques, etc.). Restringir a ['address']
    // ocultaba esos lugares. Mezclar 'establishment'+'geocode' explícitamente no
    // está permitido en el widget legacy, así que lo omitimos por completo.
    bounds: new g.maps.LatLngBounds(LIMA_BOUNDS.sw, LIMA_BOUNDS.ne),
    strictBounds: false,
  });
  (inputEl as any)._lfAutocomplete = ac;
  (inputEl as any)._lfOnPlace = onPlace;
  setupMobileDropdownFix(inputEl);
  ac.addListener('place_changed', () => {
    const place = ac.getPlace();
    if (!place?.geometry?.location) return; // Enter sin elegir sugerencia → ignorar
    const candidates = extractDistrictCandidates(place.address_components);
    const cb = (inputEl as any)._lfOnPlace || onPlace; // usa el callback más reciente
    // Para establecimientos (colegio, hospital…) anteponemos el nombre del lugar
    // a la dirección: "Hospital Rebagliati, Av. Rebagliati 490, Jesús María".
    const placeName = (place as any).name as string | undefined;
    const addr = place.formatted_address || '';
    const formatted = placeName && addr && !addr.toLowerCase().startsWith(placeName.toLowerCase())
      ? `${placeName}, ${addr}`
      : (addr || placeName || inputEl.value);
    cb({
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      district: candidates[0] || null,
      districtCandidates: candidates,
      formatted,
      placeId: place.place_id,
    });
  });
  return ac;
}

// Geocodifica texto libre (fallback cuando el usuario no eligió sugerencia).
export async function geocodeText(text: string): Promise<PlaceResult | null> {
  let g: any;
  try { g = await loadMaps(); } catch { return null; }
  return new Promise((resolve) => {
    new g.maps.Geocoder().geocode(
      {
        address: text,
        componentRestrictions: { country: 'PE' },
        bounds: new g.maps.LatLngBounds(LIMA_BOUNDS.sw, LIMA_BOUNDS.ne),
      },
      (results: any[], status: string) => {
        const r = status === 'OK' && results && results[0];
        if (!r?.geometry?.location) return resolve(null);
        const candidates = extractDistrictCandidates(r.address_components);
        resolve({
          lat: r.geometry.location.lat(),
          lng: r.geometry.location.lng(),
          district: candidates[0] || null,
          districtCandidates: candidates,
          formatted: r.formatted_address || text,
          placeId: r.place_id,
        });
      },
    );
  });
}

// Centroides aproximados por distrito — último recurso para que el pedido
// siempre lleve lat/lng numéricos (api/order los exige).
export const DISTRICT_CENTROIDS: Record<string, { lat: number; lng: number }> = {
  'Ancón': { lat: -11.7758, lng: -77.1769 },
  'Ate': { lat: -12.0264, lng: -76.9180 },
  'Barranco': { lat: -12.1409, lng: -77.0204 },
  'Breña': { lat: -12.0589, lng: -77.0497 },
  'Carabayllo': { lat: -11.8983, lng: -77.0356 },
  'Chaclacayo': { lat: -11.9819, lng: -76.7686 },
  'Chorrillos': { lat: -12.1744, lng: -77.0150 },
  'Cieneguilla': { lat: -12.1167, lng: -76.8167 },
  'Comas': { lat: -11.9381, lng: -77.0481 },
  'El Agustino': { lat: -12.0428, lng: -76.9956 },
  'Independencia': { lat: -11.9897, lng: -77.0531 },
  'Jesús María': { lat: -12.0768, lng: -77.0479 },
  'La Molina': { lat: -12.0856, lng: -76.9479 },
  'La Victoria': { lat: -12.0681, lng: -77.0167 },
  'Lima': { lat: -12.0464, lng: -77.0428 },
  'Lince': { lat: -12.0833, lng: -77.0333 },
  'Los Olivos': { lat: -11.9714, lng: -77.0703 },
  'Lurigancho-Chosica': { lat: -11.9406, lng: -76.7050 },
  'Lurín': { lat: -12.2719, lng: -76.8728 },
  'Magdalena del Mar': { lat: -12.0908, lng: -77.0709 },
  'Miraflores': { lat: -12.1211, lng: -77.0297 },
  'Pachacámac': { lat: -12.2294, lng: -76.8472 },
  'Pucusana': { lat: -12.4806, lng: -76.7950 },
  'Pueblo Libre': { lat: -12.0719, lng: -77.0631 },
  'Puente Piedra': { lat: -11.8628, lng: -77.0772 },
  'Punta Hermosa': { lat: -12.3375, lng: -76.8222 },
  'Punta Negra': { lat: -12.3636, lng: -76.7969 },
  'Rímac': { lat: -12.0294, lng: -77.0294 },
  'San Bartolo': { lat: -12.3883, lng: -76.7783 },
  'San Borja': { lat: -12.1066, lng: -76.9990 },
  'San Isidro': { lat: -12.0976, lng: -77.0365 },
  'San Juan de Lurigancho': { lat: -11.9986, lng: -76.9967 },
  'San Juan de Miraflores': { lat: -12.1592, lng: -76.9719 },
  'San Luis': { lat: -12.0750, lng: -76.9981 },
  'San Martín de Porres': { lat: -12.0289, lng: -77.0856 },
  'San Miguel': { lat: -12.0772, lng: -77.0908 },
  'Santa Anita': { lat: -12.0431, lng: -76.9719 },
  'Santa María del Mar': { lat: -12.4083, lng: -76.7681 },
  'Santa Rosa': { lat: -11.7969, lng: -77.1639 },
  'Santiago de Surco': { lat: -12.1359, lng: -76.9933 },
  'Surquillo': { lat: -12.1119, lng: -77.0186 },
  'Villa El Salvador': { lat: -12.2136, lng: -76.9381 },
  'Villa María del Triunfo': { lat: -12.1614, lng: -76.9381 },
  'Otro': { lat: -12.0464, lng: -77.0428 }, // centro de Lima
};
