// Product detail page
(function() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || 'orquideas-multicolor';
  const p = LIMA.products.find(x => x.id === id) || LIMA.products[0];

  if (!p) return;

  // Set DOM
  document.title = p.name + ' — Lima Flores';
  document.getElementById('bc-cat').textContent = p.name;
  document.getElementById('pd-cat').textContent = p.categoryLabel;
  document.getElementById('pd-title').innerHTML = p.name.replace(/\s(\w+)$/, ' <em>$1</em>') + '.';
  document.getElementById('pd-price').innerHTML = `
    <span class="cur">S/</span>
    <span class="amt">${p.price}</span>
    <span style="font-family:var(--f-body); font-size:var(--fs-nano); letter-spacing:var(--tr-eyebrow); text-transform:uppercase; color:var(--ink-soft); margin-left:8px">Entrega el mismo día</span>
  `;
  document.getElementById('pd-desc').textContent = p.description;

  const mediaEl = document.getElementById('pd-media');
  if (p.image) mediaEl.innerHTML = `<img src="${p.image}" alt="${p.name}" />`;
  else mediaEl.innerHTML = placeholderSVG(p);

  document.getElementById('pd-details').innerHTML = p.details.map(([k, v]) =>
    `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');

  // Quantity
  let qty = 1;
  const qtyEl = document.getElementById('qty-value');
  document.getElementById('qty-minus').addEventListener('click', () => { qty = Math.max(1, qty - 1); qtyEl.textContent = qty; });
  document.getElementById('qty-plus').addEventListener('click', () => { qty = Math.min(20, qty + 1); qtyEl.textContent = qty; });

  document.getElementById('add-to-cart').addEventListener('click', () => LimaCart.add(p.id, qty));
  document.getElementById('buy-now').addEventListener('click', (e) => {
    e.preventDefault();
    LimaCart.add(p.id, qty);
    setTimeout(() => location.href = 'checkout.html', 350);
  });

  // More from atelier — 3 other products
  const more = LIMA.products.filter(x => x.id !== p.id).slice(0, 3);
  const moreGrid = document.getElementById('more-grid');
  if (moreGrid) {
    moreGrid.innerHTML = more.map((m, i) => {
      const media = m.image ? `<img src="${m.image}" alt="${m.name}" loading="lazy" />` : placeholderSVG(m);
      const badge = m.badge ? `<span class="product-card__badge">${m.badge}</span>` : '';
      const num = String(i + 1).padStart(2, '0');
      return `
        <a href="producto.html?id=${m.id}" class="product-card" data-cursor="link" style="--i:${i}">
          <div class="product-card__media">
            ${media}
            ${badge}
            <button class="product-card__quick" onclick="event.preventDefault(); event.stopPropagation(); LimaCart.add('${m.id}')">+ Agregar</button>
          </div>
          <div class="product-card__row">
            <div>
              <span class="product-card__cat">${num} · ${m.categoryLabel}</span>
              <div class="product-card__name">${m.name}</div>
            </div>
            <span class="product-card__price">${formatSoles(m.price)}</span>
          </div>
          <p class="product-card__desc">${m.shortDesc}</p>
        </a>`;
    }).join('');
  }
})();
