// Product detail page — incluye galería con thumbs + lightbox.
(function() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id') || (LIMA.products[0] && LIMA.products[0].id);
  const p = LIMA.products.find(x => x.id === id) || LIMA.products[0];
  if (!p) return;

  // ─── DOM básico ────────────────────────────────
  document.title = p.name + ' — Lima Flores';
  document.getElementById('bc-cat').textContent = p.name;
  document.getElementById('pd-cat').textContent = p.categoryLabel;
  document.getElementById('pd-title').innerHTML = p.name.replace(/\s(\w+)$/, ' <em>$1</em>') + '.';
  document.getElementById('pd-price').innerHTML = `
    <span class="cur">S/</span>
    <span class="amt">${p.price}</span>
    <span style="font-family:var(--f-body); font-size:var(--fs-nano); letter-spacing:var(--tr-eyebrow); text-transform:uppercase; color:var(--ink-soft); margin-left:8px">Entrega el mismo día</span>
  `;
  document.getElementById('pd-desc').textContent = p.description || p.shortDesc || '';

  // ─── Galería ───────────────────────────────────
  const mediaEl = document.getElementById('pd-media');
  const images = Array.isArray(p.images) && p.images.length ? p.images : (p.image ? [p.image] : []);

  if (images.length === 0) {
    mediaEl.innerHTML = placeholderSVG(p);
  } else if (images.length === 1) {
    mediaEl.innerHTML = `
      <button class="pd-zoom" type="button" data-zoom="0" aria-label="Ampliar imagen">
        <img src="${images[0]}" alt="${p.name}" />
        <span class="pd-zoom__hint">Click para ampliar</span>
      </button>
    `;
  } else {
    mediaEl.innerHTML = `
      <button class="pd-zoom pd-zoom--main" type="button" data-zoom="0" aria-label="Ampliar imagen">
        <img id="pd-main-img" src="${images[0]}" alt="${p.name}" />
        <span class="pd-zoom__hint">Click para ampliar · ${images.length} fotos</span>
      </button>
      <div class="pd-thumbs" role="tablist" aria-label="Galería">
        ${images.map((src, i) => `
          <button class="pd-thumb${i === 0 ? ' is-active' : ''}" type="button" data-i="${i}" role="tab" aria-selected="${i === 0}" aria-label="Foto ${i + 1}">
            <img src="${src}" alt="" loading="lazy" />
          </button>
        `).join('')}
      </div>
    `;

    // Cambiar imagen principal al click de thumb
    const mainImg = document.getElementById('pd-main-img');
    const mainBtn = mediaEl.querySelector('.pd-zoom--main');
    mediaEl.querySelectorAll('.pd-thumb').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.i);
        mainImg.src = images[idx];
        mainBtn.dataset.zoom = String(idx);
        mediaEl.querySelectorAll('.pd-thumb').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('is-active', on);
          b.setAttribute('aria-selected', on ? 'true' : 'false');
        });
      });
    });
  }

  // Lightbox al click en la imagen principal
  mediaEl.querySelectorAll('[data-zoom]').forEach((el) => {
    el.addEventListener('click', () => openLightbox(images, Number(el.dataset.zoom) || 0, p.name));
  });

  // ─── Detalles ──────────────────────────────────
  const detailsEl = document.getElementById('pd-details');
  if (detailsEl) {
    detailsEl.innerHTML = (p.details || []).map(([k, v]) =>
      `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  }

  // ─── Cantidad + carrito ─────────────────────────
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

  // ─── More from atelier (3 productos al azar) ───
  const more = LIMA.products.filter(x => x.id !== p.id).sort(() => Math.random() - 0.5).slice(0, 3);
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

  // ─── Lightbox global ──────────────────────────
  // Construye una vez, lo reusamos. Cierra con Esc, click fuera, o el botón X.
  function openLightbox(imgs, startIdx, altName) {
    let cur = startIdx || 0;
    let box = document.getElementById('pd-lightbox');
    if (!box) {
      box = document.createElement('div');
      box.id = 'pd-lightbox';
      box.className = 'pd-lightbox';
      box.innerHTML = `
        <button class="pd-lightbox__close" type="button" aria-label="Cerrar">✕</button>
        <button class="pd-lightbox__nav pd-lightbox__nav--prev" type="button" aria-label="Anterior">‹</button>
        <button class="pd-lightbox__nav pd-lightbox__nav--next" type="button" aria-label="Siguiente">›</button>
        <figure class="pd-lightbox__figure">
          <img class="pd-lightbox__img" src="" alt="" />
          <figcaption class="pd-lightbox__caption"></figcaption>
        </figure>
      `;
      document.body.appendChild(box);
    }
    const imgEl = box.querySelector('.pd-lightbox__img');
    const capEl = box.querySelector('.pd-lightbox__caption');
    const prevBtn = box.querySelector('.pd-lightbox__nav--prev');
    const nextBtn = box.querySelector('.pd-lightbox__nav--next');
    const closeBtn = box.querySelector('.pd-lightbox__close');

    const update = () => {
      imgEl.src = imgs[cur];
      imgEl.alt = altName;
      capEl.textContent = imgs.length > 1 ? `${cur + 1} / ${imgs.length}` : '';
      prevBtn.style.visibility = nextBtn.style.visibility = imgs.length > 1 ? 'visible' : 'hidden';
    };
    const close = () => {
      box.classList.remove('is-open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
    const next = () => { cur = (cur + 1) % imgs.length; update(); };
    const prev = () => { cur = (cur - 1 + imgs.length) % imgs.length; update(); };
    const onKey = (e) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
    };

    // Reset listeners (clonando los botones)
    closeBtn.onclick = close;
    prevBtn.onclick = (e) => { e.stopPropagation(); prev(); };
    nextBtn.onclick = (e) => { e.stopPropagation(); next(); };
    box.onclick = (e) => { if (e.target === box || e.target.classList.contains('pd-lightbox__figure')) close(); };
    document.addEventListener('keydown', onKey);

    update();
    box.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }
})();
