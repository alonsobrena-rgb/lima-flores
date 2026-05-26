// Geocoder — wrapper de Google Places Autocomplete.
// Uso:
//   LimaGeo.attach(inputElement, ({ lat, lng, district, formatted }) => { ... });
//
// - Carga el SDK de Maps JS bajo demanda (con la key que sirve /api/config).
// - Si no hay key configurada, hace no-op (el checkout cae al fallback de centroide).
// - Sesga sugerencias a Lima Metropolitana pero no las restringe (strictBounds:false).
'use strict';

(function (global) {
  let _sdkPromise = null;
  let _disabledReason = null;

  // Lima Metropolitana bounding box (incluye Callao y balnearios sur).
  const LIMA_BOUNDS = { sw: { lat: -12.50, lng: -77.25 }, ne: { lat: -11.75, lng: -76.65 } };

  function loadConfig() {
    return fetch('/api/config', { headers: { Accept: 'application/json' } })
      .then((r) => r.ok ? r.json() : { googleMapsKey: '' })
      .catch(() => ({ googleMapsKey: '' }));
  }

  function loadSDK(apiKey) {
    if (window.google && window.google.maps && window.google.maps.places) {
      return Promise.resolve(window.google);
    }
    if (_sdkPromise) return _sdkPromise;
    _sdkPromise = new Promise((resolve, reject) => {
      const cbName = '_gmaps_loaded_' + Date.now().toString(36);
      window[cbName] = function () { delete window[cbName]; resolve(window.google); };
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js'
            + '?key=' + encodeURIComponent(apiKey)
            + '&libraries=places&v=weekly&loading=async&callback=' + cbName;
      s.async = true; s.defer = true;
      s.onerror = () => reject(new Error('No se pudo cargar el SDK de Google Maps'));
      document.head.appendChild(s);
    });
    return _sdkPromise;
  }

  // Devuelve TODOS los nombres candidatos a "distrito" que aparezcan en el
  // address_components, en orden de prioridad. Esto es porque Google no
  // siempre devuelve el distrito en el mismo campo: para Lima a veces es
  // administrative_area_level_3 (el más correcto), otras veces sublocality,
  // y a veces el campo locality contiene la ciudad ("Lima") en vez del distrito.
  function extractDistrictCandidates(addressComponents) {
    if (!Array.isArray(addressComponents)) return [];
    const wanted = [
      'administrative_area_level_3', // distrito en Perú (lo más preciso)
      'sublocality_level_1',
      'sublocality',
      'locality',
      'administrative_area_level_2', // provincia (Lima) — fallback débil
    ];
    const out = [];
    for (const want of wanted) {
      for (const c of addressComponents) {
        if (!(c.types || []).includes(want)) continue;
        if (c.long_name && !out.includes(c.long_name)) out.push(c.long_name);
        if (c.short_name && !out.includes(c.short_name)) out.push(c.short_name);
      }
    }
    return out;
  }

  // attach(inputEl, onPlace) — inicializa Autocomplete sobre el input dado.
  // onPlace recibe { lat, lng, district, formatted, placeId }.
  // Devuelve una Promise que resuelve cuando el SDK está listo (o se descarta).
  async function attach(inputEl, onPlace) {
    if (!inputEl) return;
    const cfg = await loadConfig();
    if (!cfg.googleMapsKey) {
      _disabledReason = 'no-key';
      console.info('[geocoder] sin GOOGLE_MAPS_API_KEY — autocomplete desactivado (fallback al centroide del distrito).');
      return;
    }

    let google;
    try { google = await loadSDK(cfg.googleMapsKey); }
    catch (e) { _disabledReason = 'sdk-fail'; console.warn('[geocoder]', e.message); return; }

    const ac = new google.maps.places.Autocomplete(inputEl, {
      componentRestrictions: { country: 'pe' },
      fields: ['geometry', 'formatted_address', 'address_components', 'place_id'],
      types: ['address'],
      bounds: new google.maps.LatLngBounds(LIMA_BOUNDS.sw, LIMA_BOUNDS.ne),
      strictBounds: false,
    });

    ac.addListener('place_changed', () => {
      const place = ac.getPlace();
      if (!place || !place.geometry || !place.geometry.location) {
        // El usuario apretó Enter sin elegir sugerencia → ignoramos; el fallback de distrito sigue activo.
        return;
      }
      const candidates = extractDistrictCandidates(place.address_components);
      onPlace({
        lat: place.geometry.location.lat(),
        lng: place.geometry.location.lng(),
        district: candidates[0] || null,           // el mejor candidato (compat con código previo)
        districtCandidates: candidates,             // lista completa para matcher tolerante
        formatted: place.formatted_address || inputEl.value,
        placeId: place.place_id,
      });
    });

    return ac;
  }

  global.LimaGeo = { attach, get disabledReason() { return _disabledReason; } };
})(window);
