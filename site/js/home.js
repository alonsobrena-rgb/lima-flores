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

  // ─── Instagram gallery ───────────────────────────
  const igGrid = document.getElementById('ig-grid');
  if (igGrid) {
    // Mix one real photo + 5 SVG placeholders themed as IG posts
    const posts = [
      { real: true,  caption: 'Orquídeas Multicolor · La firma de la casa', likes: 248 },
      { palette: '#C99CA9', name: 'Peonías de domingo', caption: 'Peonías y eucalipto · Sábado', likes: 156 },
      { palette: '#B6855E', name: 'Lunes en el atelier', caption: 'Mesa de trabajo · 7:00 am', likes: 192 },
      { palette: '#4F5C3F', name: 'Olivo + lavanda', caption: 'Provence en San Isidro', likes: 134 },
      { palette: '#D4A5B5', name: 'Detalle ranúnculos', caption: 'Macro · ranúnculo crema', likes: 211 },
      { palette: '#A57F45', name: 'Cinta de algodón', caption: 'Envoltorio para una entrega', likes: 98 },
      { palette: '#E8DDD0', name: 'Caja Toscana', caption: 'Girasoles + trigo seco', likes: 167 },
      { palette: '#5C6B4E', name: 'Hortensias azules', caption: 'Amalfi en vidrio soplado', likes: 223 },
      { real: true,  caption: 'Misma serie · luz del taller', likes: 142 },
      { palette: '#A8453C', name: 'Rosas rojas París', caption: 'Doce tallos · papel craft', likes: 305 },
      { palette: '#B8935A', name: 'Bohemia', caption: 'Statice + craspedia + olivo', likes: 178 },
      { palette: '#C89B7E', name: 'Eucalipto baby', caption: 'Detalle de hoja · macro', likes: 89 }
    ];
    igGrid.innerHTML = posts.map((p, i) => {
      const media = p.real
        ? `<img src="assets/orquideas.jpg" alt="${p.caption}" loading="lazy" />`
        : placeholderSVG({ name: p.name, categoryLabel: '@lima_flores', palette: p.palette });
      return `
        <a href="https://instagram.com/lima_flores" target="_blank" rel="noopener" class="ig-tile" data-cursor="link" style="--i:${i}">
          ${media}
          <div class="ig-tile__overlay">
            <div class="ig-tile__top">
              <span>${String(i + 1).padStart(2, '0')} / ${String(posts.length).padStart(2, '0')}</span>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" stroke="none"/></svg>
            </div>
            <div class="ig-tile__bottom">
              <div class="ig-tile__likes">♡ ${p.likes}</div>
              ${p.caption}
            </div>
          </div>
        </a>`;
    }).join('');
    [...igGrid.children].forEach((c, i) => c.style.setProperty('--i', i));
  }
})();
