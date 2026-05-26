// Checkout logic
(function() {
  const items = LimaCart.items;

  // Render summary
  const list = document.getElementById('summary-items');
  let subtotal = 0;
  if (items.length === 0) {
    list.innerHTML = '<p style="font-family:var(--f-display); font-style:italic; color:var(--ink-soft); padding: 16px 0">Tu carrito está vacío.</p>';
  } else {
    list.innerHTML = items.map(it => {
      const p = LIMA.products.find(x => x.id === it.id);
      if (!p) return '';
      subtotal += p.price * it.qty;
      const media = p.image ? `<img src="${p.image}" alt="${p.name}"/>` : placeholderSVG(p);
      return `
        <div class="summary__item">
          <div class="mini">${media}</div>
          <div>
            <div class="nm">${p.name}</div>
            <div class="qty">Cantidad · ${it.qty}</div>
          </div>
          <div class="pr">${formatSoles(p.price * it.qty)}</div>
        </div>`;
    }).join('');
  }
  document.getElementById('summary-subtotal').textContent = formatSoles(subtotal);

  // ─── Fecha + hora objetivo (mín. +24 h, slots cada 30 min, ventana ±30) ──
  const ATELIER_OPEN = 9;     // 9:00
  const ATELIER_CLOSE = 19;   // 19:00 (último slot 18:30)
  const SLOT_MIN = 30;
  const LEAD_MS = 24 * 60 * 60 * 1000;
  const PAD = (n) => String(n).padStart(2, '0');
  const localISODate = (d) => `${d.getFullYear()}-${PAD(d.getMonth() + 1)}-${PAD(d.getDate())}`;
  const earliestDate = () => localISODate(new Date(Date.now() + LEAD_MS));

  const dateInput = document.getElementById('delivery-date');
  const timeSelect = document.getElementById('delivery-time');
  const previewBox = document.getElementById('delivery-window-preview');
  const wFrom = document.getElementById('window-from');
  const wTo = document.getElementById('window-to');

  if (dateInput && timeSelect) {
    const minDate = earliestDate();
    dateInput.min = minDate;
    if (!dateInput.value || dateInput.value < minDate) dateInput.value = minDate;

    const populateSlots = (depth = 0) => {
      timeSelect.innerHTML = '<option value="" selected>—</option>';
      const dateStr = dateInput.value;
      if (!dateStr || depth > 7) return;
      const now = Date.now();
      for (let h = ATELIER_OPEN; h < ATELIER_CLOSE; h++) {
        for (let m = 0; m < 60; m += SLOT_MIN) {
          const t = new Date(`${dateStr}T${PAD(h)}:${PAD(m)}:00`);
          if (t.getTime() - now < LEAD_MS) continue;
          const opt = document.createElement('option');
          opt.value = `${PAD(h)}:${PAD(m)}`;
          opt.textContent = `${PAD(h)}:${PAD(m)}`;
          timeSelect.appendChild(opt);
        }
      }
      // Si no hubo slots válidos hoy → avanzar al día siguiente
      if (timeSelect.children.length === 1) {
        const next = new Date(`${dateStr}T00:00:00`);
        next.setDate(next.getDate() + 1);
        dateInput.value = localISODate(next);
        populateSlots(depth + 1);
      }
    };

    const updatePreview = () => {
      if (!timeSelect.value || !dateInput.value) { previewBox.style.display = 'none'; return; }
      const [hh, mm] = timeSelect.value.split(':').map(Number);
      const center = new Date(`${dateInput.value}T${PAD(hh)}:${PAD(mm)}:00`);
      const from = new Date(center.getTime() - 30 * 60000);
      const to   = new Date(center.getTime() + 30 * 60000);
      wFrom.textContent = `${PAD(from.getHours())}:${PAD(from.getMinutes())}`;
      wTo.textContent   = `${PAD(to.getHours())}:${PAD(to.getMinutes())}`;
      previewBox.style.display = '';
    };

    dateInput.addEventListener('change', () => { populateSlots(); updatePreview(); requoteIfPlace(); });
    timeSelect.addEventListener('change', () => { updatePreview(); requoteIfPlace(); });
    populateSlots();
  }

  // Construye RFC3339 (UTC) a partir de fecha+hora del form. Si falta alguna → null.
  function buildPickupTime() {
    if (!dateInput || !timeSelect) return null;
    if (!dateInput.value || !timeSelect.value) return null;
    const [hh, mm] = timeSelect.value.split(':').map(Number);
    const d = new Date(`${dateInput.value}T${PAD(hh)}:${PAD(mm)}:00`);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  }

  // Re-cotiza si ya tenemos coords precisas (autocomplete o pin arrastrado).
  // Se llama al cambiar fecha/hora para que el precio refleje ese momento.
  function requoteIfPlace() {
    if (!precisePlace) return;
    quoteByCoords(precisePlace.lat, precisePlace.lng, {
      precise: true,
      cacheKey: precisePlace.placeId || `${precisePlace.lat},${precisePlace.lng}`,
    });
  }

  // ─── Envío: cotización real con Cabify (Urbaner fallback) vía /api/quote ──
  // El cliente busca su dirección con Google Places. Al elegir una sugerencia
  // tenemos lat/lng exactos. La cotización va contra esas coords. Si Google
  // Maps no carga, mostramos "Coordinamos por WhatsApp".
  const shipLabel = document.getElementById('summary-shipping');
  const shipNote = document.getElementById('summary-shipping-note');
  const totalLabel = document.getElementById('summary-total');
  const addressHint = document.getElementById('address-hint');
  const quoteCache = Object.create(null);
  let currentShip = { fee: 0, label: '— por calcular' };
  let precisePlace = null; // { lat, lng, district, formatted } cuando hay autocomplete

  const renderTotals = () => {
    shipLabel.textContent = currentShip.label;
    totalLabel.textContent = formatSoles(subtotal + currentShip.fee);
  };

  const setShipFromQuote = ({ price, order_type, distance_m, duration_s, provider, asset_kind }, precise, scheduled) => {
    const km  = distance_m != null ? `${(distance_m / 1000).toFixed(1)} km` : null;
    const min = duration_s != null ? `${Math.round(duration_s / 60)} min` : null;
    const detail = [km, min].filter(Boolean).join(' · ');
    // Etiqueta del courier. Si es Cabify, mostramos "Cabify · AUTO". Si es
    // Urbaner (fallback), mostramos "Urbaner NEXTDAY".
    const courierLabel = provider === 'cabify'
      ? `Cabify · ${order_type || 'AUTO'}`
      : `Urbaner ${order_type || 'NEXTDAY'}`;
    const timeTag = scheduled ? ' · para tu hora' : (precise ? ' · estimado para ahora' : ' · aprox.');
    currentShip = {
      fee: Number(price),
      label: `${formatSoles(price)} · ${courierLabel}${detail ? ' · ' + detail : ''}${timeTag}`,
    };
    renderTotals();

    // Nota condicional. Con Cabify ya no aplica la rareza de "tarifa mínima
    // local" de Urbaner, así que solo la mostramos si el fallback se disparó.
    if (shipNote) {
      const isUrbanerMinFare = provider === 'urbaner' && Number(price) >= 15 && distance_m != null && distance_m < 3500;
      if (isUrbanerMinFare) {
        shipNote.textContent = 'Tarifa mínima del courier para entregas cercanas. Cabify no estuvo disponible en este momento; usamos Urbaner como respaldo.';
        shipNote.hidden = false;
      } else {
        shipNote.hidden = true;
      }
    }
  };

  const setShipManual = (label) => {
    currentShip = { fee: 0, label };
    renderTotals();
    if (shipNote) shipNote.hidden = true;
  };

  const setHint = (text, kind) => {
    if (!addressHint) return;
    addressHint.textContent = text;
    addressHint.classList.remove('is-error', 'is-ok');
    if (kind) addressHint.classList.add(`is-${kind}`);
  };

  async function quoteByCoords(lat, lng, { precise = false, cacheKey = null } = {}) {
    if (subtotal === 0) { setShipManual('— agrega un arreglo'); return; }
    const pickupTime = buildPickupTime();
    const baseKey = cacheKey || `${lat},${lng}`;
    const key = `${baseKey}|${pickupTime || 'now'}`;
    if (quoteCache[key]) { setShipFromQuote(quoteCache[key], precise, !!pickupTime); return; }

    setShipManual('Calculando…');
    try {
      const url = `/api/quote?lat=${lat}&lng=${lng}` + (pickupTime ? `&at=${encodeURIComponent(pickupTime)}` : '');
      const r = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!data || data.error || data.price == null) throw new Error(data?.error || 'sin precio');
      quoteCache[key] = data;
      setShipFromQuote(data, precise, !!pickupTime);
    } catch (_) {
      setShipManual('Coordinamos por WhatsApp');
    }
  }

  const streetInput = document.getElementById('address-street');

  // Móvil — al enfocar la calle, scrollear el input al tope de la pantalla
  // para que el teclado virtual no tape el dropdown de Google Places.
  // Espera 300ms a que el teclado abra antes de scrollear.
  streetInput.addEventListener('focus', () => {
    if (window.innerWidth <= 768) {
      setTimeout(() => {
        streetInput.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }, 300);
    }
  });

  // Si el cliente edita el campo a mano DESPUÉS de elegir una sugerencia,
  // invalidamos las coords precisas para no engañarlo con un precio que ya no corresponde.
  streetInput.addEventListener('input', () => {
    if (precisePlace && streetInput.value !== precisePlace.formatted) {
      precisePlace = null;
      hideMap();
      setHint('Elige otra sugerencia de Google Maps para recalcular el envío.', null);
      setShipManual('— por calcular');
    }
  });

  // ─── Mapa con pin (usa el SDK ya cargado por geocoder.js) ──
  // showMap(lat, lng) muestra/centra el mapa en esas coords con un marker
  // draggable. Al soltar el pin, re-cotizamos con las coords nuevas.
  let _map = null;
  let _marker = null;
  const mapWrap = document.getElementById('address-map');
  const mapCanvas = document.getElementById('address-map-canvas');
  const mapToggleBtn = document.getElementById('address-map-toggle');
  const pinNote = document.getElementById('pin-note');

  function showMap(lat, lng, formatted) {
    if (!mapCanvas || !window.google || !window.google.maps) return;
    const pos = { lat: Number(lat), lng: Number(lng) };
    mapWrap.hidden = false;
    if (pinNote) pinNote.hidden = false;

    if (!_map) {
      _map = new google.maps.Map(mapCanvas, {
        center: pos,
        zoom: 17,
        mapTypeId: 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: 'cooperative',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
      });
      _marker = new google.maps.Marker({
        map: _map,
        position: pos,
        draggable: true,
        animation: google.maps.Animation.DROP,
        title: formatted || 'Dirección de entrega',
      });
      _marker.addListener('dragend', () => {
        const p = _marker.getPosition();
        const newLat = p.lat();
        const newLng = p.lng();
        if (precisePlace) {
          precisePlace = { ...precisePlace, lat: newLat, lng: newLng };
        }
        setHint(`📍 Pin ajustado · ${formatted || ''}`.trim(), 'ok');
        quoteByCoords(newLat, newLng, { precise: true, cacheKey: `${newLat.toFixed(6)},${newLng.toFixed(6)}` });
      });

      // Toggle satélite ↔ mapa
      if (mapToggleBtn) {
        mapToggleBtn.addEventListener('click', () => {
          const now = _map.getMapTypeId();
          const next = now === 'satellite' || now === 'hybrid' ? 'roadmap' : 'hybrid';
          _map.setMapTypeId(next);
          mapToggleBtn.textContent = next === 'roadmap' ? '🛰️ Satélite' : '🗺️ Mapa';
          mapToggleBtn.setAttribute('aria-label', next === 'roadmap' ? 'Cambiar a vista satélite' : 'Cambiar a vista mapa');
        });
      }
    } else {
      _map.setCenter(pos);
      _marker.setPosition(pos);
      _marker.setTitle(formatted || 'Dirección de entrega');
    }
  }

  function hideMap() {
    if (mapWrap) mapWrap.hidden = true;
    if (pinNote) pinNote.hidden = true;
  }

  // Coords precisas desde Google Places Autocomplete.
  if (window.LimaGeo) {
    LimaGeo.attach(streetInput, (place) => {
      precisePlace = place;
      streetInput.value = place.formatted;
      setHint(`📍 ${place.formatted}`, 'ok');
      quoteByCoords(place.lat, place.lng, { precise: true, cacheKey: place.placeId || `${place.lat},${place.lng}` });
      showMap(place.lat, place.lng, place.formatted);
    }).then((ac) => {
      if (!ac && LimaGeo.disabledReason) {
        setHint('Google Maps no se cargó. Coordinamos el envío por WhatsApp.', 'error');
        setShipManual('Coordinamos por WhatsApp');
      }
    });
  }

  renderTotals(); // estado inicial

  // ─── Reception toggle controls apartment field visibility ──
  const aptWrap = document.getElementById('apt-field-wrap');
  const aptInput = document.getElementById('apt-number');
  const updateApt = () => {
    const yes = document.getElementById('rec-yes').checked;
    aptWrap.style.display = yes ? '' : 'none';
    if (!yes) aptInput.value = '';
  };
  document.querySelectorAll('input[name="reception"]').forEach(el => el.addEventListener('change', updateApt));
  updateApt();

  // ─── Invoice type swaps DNI ↔ RUC ───────────────
  const docLabel = document.getElementById('doc-label');
  const invoiceNameLabel = document.getElementById('invoice-name-label');
  const docInput = document.getElementById('invoice-doc');
  const invoiceNameInput = document.getElementById('invoice-name');
  const updateInvoice = () => {
    const factura = document.querySelector('input[name="invoice"]:checked').value === 'factura';
    docLabel.textContent = factura ? 'RUC' : 'DNI';
    docInput.maxLength = factura ? 11 : 8;
    docInput.setAttribute('pattern', factura ? '[0-9]{11}' : '[0-9]{8}');
    invoiceNameLabel.textContent = factura ? 'Razón social' : 'Nombre completo (opcional)';
    if (factura) invoiceNameInput.setAttribute('required', '');
    else invoiceNameInput.removeAttribute('required');
  };
  document.querySelectorAll('input[name="invoice"]').forEach(el => el.addEventListener('change', updateInvoice));
  updateInvoice();

  // Submit — POST a /api/order, persiste en BD como 'pending'.
  // El despacho a Cabify lo dispara el atelier desde /admin (no automático).
  document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Tu carrito está vacío. Agrega algo desde el catálogo.');
      return;
    }
    const required = ['address-street','delivery-date','delivery-time','recipient-name','recipient-phone','invoice-doc','buyer-name','buyer-email','buyer-phone'];
    for (const id of required) {
      const el = document.getElementById(id);
      if (!el.value.trim()) { el.focus(); el.style.borderColor = 'var(--error)'; return; }
    }
    if (!precisePlace || precisePlace.lat == null) {
      alert('Elige tu dirección de la lista de Google Maps para fijar el pin antes de confirmar.');
      document.getElementById('address-street').focus();
      return;
    }

    // Enriquecer items con precio/nombre (server confía pero queda registrado).
    const fullItems = items.map((it) => {
      const p = LIMA.products.find((x) => x.id === it.id);
      return { id: it.id, qty: it.qty, name: p?.name || it.id, price: p?.price || 0 };
    });

    const payload = {
      buyer_name:  document.getElementById('buyer-name').value.trim(),
      buyer_email: document.getElementById('buyer-email').value.trim(),
      buyer_phone: document.getElementById('buyer-phone').value.trim(),

      recipient_name:        document.getElementById('recipient-name').value.trim(),
      recipient_phone:       document.getElementById('recipient-phone').value.trim(),
      recipient_address:     precisePlace.formatted || document.getElementById('address-street').value.trim(),
      recipient_address_ref: document.getElementById('address-ref').value.trim() || null,
      recipient_lat:         Number(precisePlace.lat),
      recipient_lng:         Number(precisePlace.lng),
      recipient_apt:         document.getElementById('apt-number').value.trim() || null,
      recipient_has_reception: document.getElementById('rec-yes').checked,

      delivery_date: document.getElementById('delivery-date').value,
      delivery_time: document.getElementById('delivery-time').value,

      invoice_type: document.querySelector('input[name="invoice"]:checked')?.value || 'boleta',
      invoice_doc:  document.getElementById('invoice-doc').value.trim(),
      invoice_name: document.getElementById('invoice-name').value.trim() || null,

      payment_method: document.querySelector('input[name="payment"]:checked')?.value || 'yape',
      card_note:      document.getElementById('note').value.trim() || null,

      items: fullItems,
      subtotal,
      shipping_fee: Number(currentShip.fee) || 0,
      shipping_provider: currentShip.label || null,
      shipping_label:    currentShip.label || null,
      total: subtotal + (Number(currentShip.fee) || 0),
    };

    const submitBtn = document.getElementById('submit-btn');
    const origText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = 'Enviando…';

    try {
      const r = await fetch('/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || `HTTP ${r.status}`);

      sessionStorage.setItem('lima-last-order', JSON.stringify({
        id: data.id,
        total: payload.total,
        recipient: payload.recipient_name,
        items,
      }));
      LimaCart.items = [];
      LimaCart.save();
      location.href = 'confirmacion.html?id=' + encodeURIComponent(data.id);
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origText;
      alert('No pudimos guardar tu pedido: ' + err.message + '\n\nSi el problema persiste, escríbenos por WhatsApp.');
    }
  });
})();
