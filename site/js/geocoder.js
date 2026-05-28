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

  // Debug panel visible si ?debug=1 en la URL — útil para móvil sin DevTools
  const debugOn = /[?&]debug=1/.test(global.location?.search || '');
  let _dbgEl = null;
  function dbg(msg) {
    if (!debugOn) return;
    if (!_dbgEl) {
      _dbgEl = document.createElement('div');
      _dbgEl.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(0,0,0,0.88);color:#7fff7f;font:11px/1.4 ui-monospace,monospace;padding:10px 12px;z-index:9999999;max-height:50vh;overflow-y:auto;white-space:pre-wrap;border-bottom:2px solid #7fff7f';
      _dbgEl.innerHTML = '<b style="color:#fff">[debug] LimaGeo</b><br>';
      (document.body || document.documentElement).appendChild(_dbgEl);
    }
    const t = new Date().toISOString().slice(11, 19);
    _dbgEl.innerHTML += `${t}  ${msg}<br>`;
    _dbgEl.scrollTop = _dbgEl.scrollHeight;
    try { console.log('[LimaGeo]', msg); } catch {}
  }
  // Lo expongo para que checkout.js también lo use
  global._LFDebug = { on: debugOn, log: dbg };

  // Lima Metropolitana bounding box (incluye Callao y balnearios sur).
  const LIMA_BOUNDS = { sw: { lat: -12.50, lng: -77.25 }, ne: { lat: -11.75, lng: -76.65 } };

  function loadConfig() {
    dbg('fetch /api/config…');
    return fetch('/api/config', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then((r) => {
        dbg('/api/config → HTTP ' + r.status);
        return r.ok ? r.json() : { googleMapsKey: '' };
      })
      .then((cfg) => {
        dbg('config: googleMapsKey ' + (cfg.googleMapsKey ? 'present (len=' + cfg.googleMapsKey.length + ')' : 'MISSING'));
        return cfg;
      })
      .catch((e) => {
        dbg('config fetch failed: ' + e.message);
        return { googleMapsKey: '' };
      });
  }

  function loadSDK(apiKey) {
    if (window.google && window.google.maps && window.google.maps.places) {
      dbg('SDK ya cargado');
      return Promise.resolve(window.google);
    }
    if (_sdkPromise) return _sdkPromise;
    _sdkPromise = new Promise((resolve, reject) => {
      const cbName = '_gmaps_loaded_' + Date.now().toString(36);
      window[cbName] = function () {
        dbg('SDK callback OK — google.maps.places=' + !!(window.google?.maps?.places));
        delete window[cbName];
        resolve(window.google);
      };
      const s = document.createElement('script');
      s.src = 'https://maps.googleapis.com/maps/api/js'
            + '?key=' + encodeURIComponent(apiKey)
            + '&libraries=places&v=weekly&loading=async&callback=' + cbName;
      s.async = true; s.defer = true;
      s.onerror = (e) => {
        dbg('SDK script onerror — probable: API key rechazada / red / referer');
        reject(new Error('No se pudo cargar el SDK de Google Maps'));
      };
      // Captura errores que Google logguea silenciosamente (deprecation warnings, billing, etc.)
      const origErr = window.console?.error;
      if (origErr && !window._lfErrPatched) {
        window._lfErrPatched = true;
        window.console.error = function (...args) {
          const msg = args.map(a => typeof a === 'string' ? a : (a?.message || JSON.stringify(a).slice(0, 200))).join(' ');
          if (/google|maps|places|api|billing|referer/i.test(msg)) dbg('console.error: ' + msg.slice(0, 300));
          return origErr.apply(this, args);
        };
      }
      dbg('inyectando script Maps SDK…');
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

  // Fix mobile: en Android Chrome el dropdown .pac-container queda oculto detrás
  // del teclado virtual porque Google lo posiciona justo debajo del input, y al
  // abrirse el teclado el input queda pegado al borde superior del teclado, sin
  // espacio debajo. Lo reposicionamos con `position: fixed` usando la
  // visualViewport API para que siempre quede en el área visible.
  let _mobileFixDone = false;
  function setupMobileDropdownFix(inputEl) {
    if (_mobileFixDone) return;
    _mobileFixDone = true;

    const isMobile =
      window.matchMedia('(max-width: 768px)').matches ||
      (window.matchMedia('(pointer: coarse)').matches && window.innerWidth <= 900);
    if (!isMobile) return;
    dbg('aplicando fix de dropdown móvil (visualViewport)');

    function getPac() {
      const list = document.querySelectorAll('.pac-container');
      return list[list.length - 1] || null;
    }

    function position() {
      const pac = getPac();
      if (!pac) return;
      const vv = window.visualViewport;
      const vvTop    = vv ? vv.offsetTop : 0;
      const vvHeight = vv ? vv.height    : window.innerHeight;
      const vvWidth  = vv ? vv.width     : document.documentElement.clientWidth;
      const inputRect = inputEl.getBoundingClientRect();
      const margin = 8;
      const minHeight = 160;

      const spaceBelow = (vvTop + vvHeight) - inputRect.bottom - margin;
      const spaceAbove = inputRect.top - vvTop - margin;

      // Estilos base con !important — Google reescribe estos inline.
      pac.style.setProperty('position', 'fixed', 'important');
      pac.style.setProperty('left', (margin) + 'px', 'important');
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

    // El .pac-container se crea de forma diferida la primera vez que el usuario
    // escribe. Reintentamos brevemente al recibir foco hasta encontrarlo.
    let retry = null;
    function chase() {
      if (retry) clearInterval(retry);
      let n = 0;
      retry = setInterval(() => {
        position();
        if (++n > 12) { clearInterval(retry); retry = null; }
      }, 80);
    }
    inputEl.addEventListener('focus', chase);
    inputEl.addEventListener('input', () => requestAnimationFrame(position));
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', position);
      window.visualViewport.addEventListener('scroll', position);
    }
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, { passive: true });

    // Bug histórico: al tocar una sugerencia, el blur del input dispara antes
    // que el click y Google esconde el dropdown. Prevenir el mousedown evita
    // que el input pierda foco antes de procesar el tap.
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (n.nodeType === 1 && n.classList && n.classList.contains('pac-container')) {
            n.addEventListener('mousedown', (e) => e.preventDefault());
            position();
          }
        }
      }
    });
    obs.observe(document.body, { childList: true });
  }

  // attach(inputEl, onPlace) — inicializa Autocomplete sobre el input dado.
  // onPlace recibe { lat, lng, district, formatted, placeId }.
  // Devuelve una Promise que resuelve cuando el SDK está listo (o se descarta).
  async function attach(inputEl, onPlace) {
    if (!inputEl) return;
    dbg('attach() inputEl OK, mobile=' + (window.innerWidth <= 768));
    const cfg = await loadConfig();
    if (!cfg.googleMapsKey) {
      _disabledReason = 'no-key';
      dbg('SIN KEY → autocomplete desactivado');
      return;
    }

    let google;
    try { google = await loadSDK(cfg.googleMapsKey); }
    catch (e) { _disabledReason = 'sdk-fail'; dbg('SDK FAIL: ' + e.message); return; }

    dbg('creando Autocomplete widget…');
    const ac = new google.maps.places.Autocomplete(inputEl, {
      componentRestrictions: { country: 'pe' },
      fields: ['geometry', 'formatted_address', 'address_components', 'place_id'],
      types: ['address'],
      bounds: new google.maps.LatLngBounds(LIMA_BOUNDS.sw, LIMA_BOUNDS.ne),
      strictBounds: false,
    });
    setupMobileDropdownFix(inputEl);
    dbg('Autocomplete listo. Tipea para ver sugerencias.');

    ac.addListener('place_changed', () => {
      dbg('place_changed disparado');
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
