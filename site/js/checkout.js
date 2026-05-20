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

  // Set min date (today)
  const dateInput = document.getElementById('delivery-date');
  if (dateInput) {
    const d = new Date();
    dateInput.min = d.toISOString().slice(0, 10);
    dateInput.value = dateInput.min;
  }

  // Shipping estimate logic — based on subtotal (placeholder)
  const calcShip = () => {
    if (subtotal === 0) return { fee: 0, free: false };
    if (subtotal >= 200) return { fee: 0, free: true };
    return { fee: 18, free: false };
  };
  const ship = calcShip();
  document.getElementById('summary-shipping').textContent = ship.free ? 'Gratis · estimado' : formatSoles(ship.fee);
  document.getElementById('summary-total').textContent = formatSoles(subtotal + ship.fee);

  // Re-evaluate when district filled
  document.getElementById('address-district').addEventListener('blur', (e) => {
    if (e.target.value.trim().length > 2 && subtotal > 0 && subtotal < 200) {
      document.getElementById('summary-shipping').textContent = formatSoles(ship.fee);
    }
  });

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
    const required = ['address-street','address-district','delivery-date','recipient-name','recipient-phone','invoice-doc','buyer-name','buyer-email','buyer-phone'];
    for (const id of required) {
      const el = document.getElementById(id);
      if (!el.value.trim()) { el.focus(); el.style.borderColor = 'var(--error)'; return; }
    }
    // Save order id
    const orderId = 'LF-' + Date.now().toString(36).toUpperCase();
    sessionStorage.setItem('lima-last-order', JSON.stringify({
      id: orderId,
      total: subtotal + ship.fee,
      recipient: document.getElementById('recipient-name').value,
      items
    }));
    LimaCart.items = [];
    LimaCart.save();
    location.href = 'confirmacion.html?id=' + orderId;
  });
})();
