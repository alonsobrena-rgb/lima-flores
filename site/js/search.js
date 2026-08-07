// Búsqueda del header — filtra el catálogo por nombre.
//
// El panel se inyecta desde acá y no desde el HTML: va en las seis páginas y
// duplicarlo seis veces era pedir que se desincronizara. Los datos salen de
// window.LIMA.products (js/data.js), que ya se carga en todas.
(function () {
  'use strict';

  const btn = document.querySelector('[data-search-open]');
  const productos = (window.LIMA && window.LIMA.products) || [];
  if (!btn || !productos.length) return;

  const MAX = 8;

  // Sin tildes y en minúsculas, para que «orquidea» encuentre «Orquídea».
  const normaliza = (s) =>
    String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

  const escapa = (s) =>
    String(s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Índice precalculado: son ~60 productos, pero así el filtrado por tecla no
  // repite el normalizado de cada nombre.
  const indice = productos.map((p) => ({ p, buscable: normaliza(p.name) }));

  /* ─────────────────────────────  panel  ───────────────────────────── */

  const panel = document.createElement('div');
  panel.className = 'lf-search';
  panel.id = 'lfSearch';
  panel.hidden = true;
  panel.innerHTML = `
    <div class="lf-search__backdrop" data-search-close></div>
    <div class="lf-search__panel" role="dialog" aria-modal="true" aria-label="Buscar productos">
      <div class="lf-search__bar">
        <svg class="lf-search__icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7"/><line x1="16.2" y1="16.2" x2="21" y2="21"/>
        </svg>
        <input class="lf-search__input" id="lfSearchInput" type="search" autocomplete="off"
               placeholder="Buscar por nombre…" aria-label="Buscar productos por nombre"
               aria-controls="lfSearchResults" />
        <button class="lf-search__close" type="button" data-search-close aria-label="Cerrar búsqueda">✕</button>
      </div>
      <div class="lf-search__results" id="lfSearchResults" role="listbox" aria-label="Resultados"></div>
    </div>`;
  document.body.appendChild(panel);

  const input = panel.querySelector('#lfSearchInput');
  const salida = panel.querySelector('#lfSearchResults');

  /* ────────────────────────────  resultados  ───────────────────────── */

  let resultados = [];
  let activo = -1;

  // Resalta en el nombre el tramo que coincide con lo tecleado.
  const resaltar = (nombre, termino) => {
    if (!termino) return escapa(nombre);
    const i = normaliza(nombre).indexOf(termino);
    if (i < 0) return escapa(nombre);
    return escapa(nombre.slice(0, i)) +
      '<mark>' + escapa(nombre.slice(i, i + termino.length)) + '</mark>' +
      escapa(nombre.slice(i + termino.length));
  };

  const pinta = (q) => {
    const consulta = normaliza(q);
    if (!consulta) {
      resultados = [];
      activo = -1;
      salida.innerHTML =
        `<p class="lf-search__hint">Escribe para buscar entre ${productos.length} productos.</p>`;
      return;
    }

    // Todas las palabras tienen que aparecer: así «rosas rojas» no trae
    // cualquier cosa que tenga «rosas».
    const palabras = consulta.split(/\s+/);
    const todos = indice.filter((e) => palabras.every((w) => e.buscable.includes(w)));
    resultados = todos.slice(0, MAX).map((e) => e.p);
    activo = -1;

    if (!resultados.length) {
      salida.innerHTML =
        `<p class="lf-search__hint">Nada con «${escapa(q.trim())}». Prueba con una palabra suelta: rosas, tulipanes, orquídea.</p>`;
      return;
    }

    const primera = palabras[0];
    salida.innerHTML = resultados.map((p, i) => `
      <a class="lf-search__item" role="option" id="lfSearchItem${i}" aria-selected="false"
         href="producto.html?id=${encodeURIComponent(p.id)}">
        <span class="lf-search__thumb">${
          p.image ? `<img src="${escapa(p.image)}" alt="" loading="lazy" />` : ''
        }</span>
        <span class="lf-search__texts">
          <span class="lf-search__name">${resaltar(p.name, primera)}</span>
          <span class="lf-search__cat">${escapa(p.categoryLabel || '')}</span>
        </span>
        <span class="lf-search__price">${window.formatSoles ? window.formatSoles(p.price) : 'S/ ' + p.price}</span>
      </a>`).join('') +
      (todos.length > MAX
        ? `<p class="lf-search__more">y ${todos.length - MAX} más — afina la búsqueda</p>`
        : '');
  };

  const marcaActivo = () => {
    salida.querySelectorAll('.lf-search__item').forEach((el, i) => {
      const on = i === activo;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) el.scrollIntoView({ block: 'nearest' });
    });
  };

  /* ──────────────────────────  abrir y cerrar  ─────────────────────── */

  let scrollPrevio = '';

  const abrir = () => {
    panel.hidden = false;
    scrollPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    btn.setAttribute('aria-expanded', 'true');
    pinta('');
    // El foco tiene que esperar a que el panel sea visible.
    requestAnimationFrame(() => {
      panel.classList.add('is-open');
      input.focus();
      input.select();
    });
  };

  const cerrar = () => {
    panel.classList.remove('is-open');
    panel.hidden = true;
    document.body.style.overflow = scrollPrevio;
    btn.setAttribute('aria-expanded', 'false');
    input.value = '';
    btn.focus();
  };

  btn.addEventListener('click', () => (panel.hidden ? abrir() : cerrar()));
  panel.addEventListener('click', (e) => {
    if (e.target.closest('[data-search-close]')) cerrar();
  });

  input.addEventListener('input', () => pinta(input.value));

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!resultados.length) return;
      e.preventDefault();
      const paso = e.key === 'ArrowDown' ? 1 : -1;
      activo = (activo + paso + resultados.length + 1) % (resultados.length + 1);
      if (activo === resultados.length) activo = -1;
      marcaActivo();
      return;
    }
    if (e.key === 'Enter') {
      // Sin nada resaltado, Enter abre el primer resultado.
      const p = resultados[activo >= 0 ? activo : 0];
      if (p) {
        e.preventDefault();
        location.href = 'producto.html?id=' + encodeURIComponent(p.id);
      }
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) cerrar();
  });
})();
