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

    dateInput.addEventListener('change', () => { populateSlots(); updatePreview(); });
    timeSelect.addEventListener('change', updatePreview);
    populateSlots();
  }

  // ─── Envío: cotización real con Urbaner vía /api/quote ──
  // Si subtotal ≥ S/200, envío gratis (lo absorbe Lima Flores).
  // Si no, llamamos a /api/quote?lat=…&lng=… (función serverless en Vercel
  // que internamente consulta a Urbaner). Cacheamos por distrito para no
  // re-cotizar cada vez que el cliente vuelva a abrir el select.
  const shipLabel = document.getElementById('summary-shipping');
  const totalLabel = document.getElementById('summary-total');
  const FREE_THRESHOLD = 200;
  const quoteCache = Object.create(null);
  let currentShip = { fee: 0, label: '— por calcular' };

  const renderTotals = () => {
    shipLabel.textContent = currentShip.label;
    totalLabel.textContent = formatSoles(subtotal + currentShip.fee);
  };

  const setShipFromQuote = ({ price, order_type }) => {
    currentShip = {
      fee: Number(price),
      label: `${formatSoles(price)} · Urbaner ${order_type || 'NEXTDAY'}`,
    };
    renderTotals();
  };

  const setShipManual = (label) => {
    currentShip = { fee: 0, label };
    renderTotals();
  };

  async function quoteDistrict(latlon) {
    if (subtotal === 0) { setShipManual('— agrega un arreglo'); return; }
    if (subtotal >= FREE_THRESHOLD) { setShipManual('Gratis · supera S/ 200'); return; }
    if (!latlon) { setShipManual('— por calcular'); return; }
    if (latlon === 'other') { setShipManual('Coordinamos por WhatsApp'); return; }
    if (quoteCache[latlon]) { setShipFromQuote(quoteCache[latlon]); return; }

    setShipManual('Calculando…');
    const [lat, lng] = latlon.split(',');
    try {
      const r = await fetch(`/api/quote?lat=${lat}&lng=${lng}`, { headers: { Accept: 'application/json' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!data || data.error || data.price == null) throw new Error(data?.error || 'sin precio');
      quoteCache[latlon] = data;
      setShipFromQuote(data);
    } catch (_) {
      // En GitHub Pages (sin /api) o sin cobertura → fallback gracioso.
      setShipManual('Coordinamos por WhatsApp');
    }
  }

  const districtSel = document.getElementById('address-district');
  districtSel.addEventListener('change', (e) => quoteDistrict(e.target.value));
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

  // Submit
  document.getElementById('checkout-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (items.length === 0) {
      alert('Tu carrito está vacío. Agrega algo desde el catálogo.');
      return;
    }
    const required = ['address-street','address-district','delivery-date','delivery-time','recipient-name','recipient-phone','invoice-doc','buyer-name','buyer-email','buyer-phone'];
    for (const id of required) {
      const el = document.getElementById(id);
      if (!el.value.trim()) { el.focus(); el.style.borderColor = 'var(--error)'; return; }
    }
    // Save order id
    const orderId = 'LF-' + Date.now().toString(36).toUpperCase();
    sessionStorage.setItem('lima-last-order', JSON.stringify({
      id: orderId,
      total: subtotal + currentShip.fee,
      recipient: document.getElementById('recipient-name').value,
      items
    }));
    LimaCart.items = [];
    LimaCart.save();
    location.href = 'confirmacion.html?id=' + orderId;
  });
})();
