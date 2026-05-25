// Catalog page logic
(function() {
  const grid = document.getElementById('catalog-grid');
  const chips = document.querySelectorAll('#chips .chip');
  const countEl = document.getElementById('cat-count');
  if (!grid) return;

  const toolbar = document.querySelector('.cat-toolbar');
  const toggle = document.getElementById('filter-toggle');
  const currentLabel = document.getElementById('filter-current');
  const closeFilters = () => {
    if (!toolbar) return;
    toolbar.classList.remove('is-open');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  };

  // Read ?cat=
  const params = new URLSearchParams(location.search);
  const initialCat = params.get('cat') || 'all';

  const render = (cat) => {
    const items = cat === 'all' ? LIMA.products : LIMA.products.filter(p => p.category === cat);
    countEl.textContent = items.length + (items.length === 1 ? ' pieza' : ' piezas');
    grid.classList.remove('is-in');
    grid.innerHTML = items.map((p, i) => {
      const media = p.image
        ? `<img src="${p.image}" alt="${p.name}" loading="lazy" />`
        : placeholderSVG(p);
      const badge = p.badge ? `<span class="product-card__badge">${p.badge}</span>` : '';
      const num = String(i + 1).padStart(2, '0');
      return `
        <a href="producto.html?id=${p.id}" class="product-card" data-cursor="link" style="--i:${i}">
          <div class="product-card__media">
            ${media}
            ${badge}
            <button class="product-card__quick" onclick="event.preventDefault(); event.stopPropagation(); LimaCart.add('${p.id}')">+ Agregar</button>
          </div>
          <div class="product-card__row">
            <div>
              <span class="product-card__cat">${num} · ${p.categoryLabel}</span>
              <div class="product-card__name">${p.name}</div>
            </div>
            <span class="product-card__price">${formatSoles(p.price)}</span>
          </div>
          <p class="product-card__desc">${p.shortDesc}</p>
        </a>`;
    }).join('');
    // Re-trigger stagger reveal
    [...grid.children].forEach((c, i) => c.style.setProperty('--i', i));
    requestAnimationFrame(() => grid.classList.add('is-in'));
  };

  // Setup chip handlers
  chips.forEach(c => {
    c.classList.toggle('is-active', c.dataset.cat === initialCat);
    c.addEventListener('click', () => {
      chips.forEach(x => x.classList.remove('is-active'));
      c.classList.add('is-active');
      render(c.dataset.cat);
      if (currentLabel) currentLabel.textContent = c.textContent.trim();
      closeFilters();
      const url = new URL(location.href);
      if (c.dataset.cat === 'all') url.searchParams.delete('cat');
      else url.searchParams.set('cat', c.dataset.cat);
      history.replaceState({}, '', url);
    });
  });

  // Dropdown de filtros (móvil)
  if (toggle && toolbar) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = toolbar.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.cat-toolbar__inner')) closeFilters();
    });
  }
  const activeChip = [...chips].find((c) => c.dataset.cat === initialCat) || chips[0];
  if (currentLabel && activeChip) currentLabel.textContent = activeChip.textContent.trim();

  render(initialCat);
})();
