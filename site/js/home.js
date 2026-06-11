// Home page interactions
(function() {
  // ─── Render categories track ─────────────────────
  const track = document.getElementById('cats-track');
  if (track) {
    const counts = {};
    LIMA.products.forEach(p => counts[p.category] = (counts[p.category] || 0) + 1);
    track.innerHTML = LIMA.categories.map((c, i) => {
      const featured = LIMA.products.find(p => p.category === c.id);
      const num = String(i + 1).padStart(2, '0');
      let media;
      if (featured && featured.image) {
        media = `<img src="${featured.image}" alt="${c.label}" />`;
      } else if (featured) {
        media = placeholderSVG(featured);
      } else {
        media = placeholderSVG({ name: c.label, categoryLabel: c.label, palette: c.palette[0] });
      }
      return `
      <a href="catalogo.html?cat=${c.id}" class="cat-card" data-cursor="link">
        <div class="cat-card__media">${media}</div>
        <div class="cat-card__overlay"></div>
        <div class="cat-card__head">
          <span class="cat-card__num">${num}</span>
          <span class="cat-card__count">${counts[c.id] || 0} piezas</span>
        </div>
        <div class="cat-card__foot">
          <h3>${c.label}<br/><span style="font-family:var(--f-body); font-size:0.8125rem; letter-spacing:0.12em; text-transform:uppercase; color:rgba(244,239,229,0.7); font-weight:400;">${c.subtitle}</span></h3>
          <span class="arrow">→</span>
        </div>
      </a>`;
    }).join('');
  }

  // ─── Compose sticky stepper ──────────────────────
  const steps = [...document.querySelectorAll('.compose__step')];
  const frames = [...document.querySelectorAll('.compose__sticky-stack .frame')];
  if (steps.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = +e.target.dataset.step;
          steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
          frames.forEach((f, i) => f.classList.toggle('is-active', i === idx));
        }
      });
    }, { threshold: 0.45, rootMargin: '-30% 0px -30% 0px' });
    steps.forEach(s => io.observe(s));
  }

  // ─── Instagram gallery — feed real con fotos de productos ─────
  const igGrid = document.getElementById('ig-grid');
  if (igGrid) {
    const captions = [
      'La firma de la casa', 'Sábado en el atelier', 'Recién cortadas',
      'Para alguien especial', 'Hecho a mano', 'Provence en Lima',
      'Detalle · macro', 'Mesa de trabajo', 'Envuelto en papel',
      'De temporada', 'Luz del taller', 'Listo para entregar'
    ];
    // Repartir 12 productos con foto a lo largo del catálogo
    const withImg = LIMA.products.filter((p) => p.image);
    const pick = [];
    const stepN = Math.max(1, Math.floor(withImg.length / 12));
    for (let i = 0; i < withImg.length && pick.length < 12; i += stepN) pick.push(withImg[i]);

    igGrid.innerHTML = pick.map((p, i) => {
      const likes = 96 + ((i * 53) % 240);
      return `
        <a href="producto.html?id=${p.id}" class="ig-tile" data-cursor="link" style="--i:${i}">
          <img src="${p.image}" alt="${p.name}" loading="lazy" />
          <div class="ig-tile__overlay">
            <div class="ig-tile__top">
              <span>${String(i + 1).padStart(2, '0')} / ${String(pick.length).padStart(2, '0')}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>
            </div>
            <div class="ig-tile__bottom">
              <div class="ig-tile__likes">♡ ${likes}</div>
              ${captions[i % captions.length]}
            </div>
          </div>
        </a>`;
    }).join('');
    [...igGrid.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
  }
})();
