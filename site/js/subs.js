// Lima Flores — planes de suscripción (render + interacción)
(function () {
  'use strict';
  if (!window.LIMA || !Array.isArray(LIMA.plans) || !LIMA.plans.length) return;

  const fmt = window.formatSoles || ((n) => 'S/ ' + n);
  const wa = (LIMA.info && LIMA.info.whatsapp) || '51999479855';
  const monthsLabel = (n) => n + (n === 1 ? ' mes' : ' meses');

  // Ahorro % respecto al precio mensual del primer plan
  const base = LIMA.plans[0].perMonth;
  const savePct = (plan) => Math.round(((base - plan.perMonth) / base) * 100);

  function cardHTML(plan, mode) {
    const pct = savePct(plan);
    const tag = plan.tag ? `<span class="plan__tag">${plan.tag}</span>` : '';
    const save = pct > 0 ? ` · <span class="plan__save">ahorra ${pct}%</span>` : '';
    const perks = (plan.perks || []).map((p) => `<li>${p}</li>`).join('');
    const cta = mode === 'page'
      ? `<button class="btn btn--ghost btn--block" data-plan-pick="${plan.id}">Elegir este plan</button>`
      : `<a class="btn btn--ghost btn--block" href="suscripcion.html?plan=${plan.id}">Suscribirme <span class="arrow">→</span></a>`;
    return `
      <article class="plan${plan.featured ? ' plan--featured' : ''}" data-plan="${plan.id}">
        ${tag}
        <div class="plan__head">
          <h3 class="plan__name">${plan.name}</h3>
          <span class="plan__term">${monthsLabel(plan.months)} · ${plan.deliveries} entregas</span>
        </div>
        <div class="plan__price">
          <span class="cur">S/</span><span class="amt">${plan.total.toLocaleString('es-PE')}</span>
        </div>
        <span class="plan__per">≈ ${fmt(plan.perMonth)} al mes${save}</span>
        <p class="plan__blurb">${plan.blurb || ''}</p>
        <ul class="plan__list">${perks}</ul>
        ${cta}
      </article>`;
  }

  // Render de todos los contenedores de planes
  document.querySelectorAll('[data-plans]').forEach((box) => {
    const mode = box.getAttribute('data-plans') === 'page' ? 'page' : 'home';
    box.innerHTML = LIMA.plans.map((p) => cardHTML(p, mode)).join('');
  });

  // Interacción solo en la página de suscripción
  const pageBox = document.querySelector('[data-plans="page"]');
  if (!pageBox) return;

  const summary = document.querySelector('[data-sub-summary]');
  const waLink = document.querySelector('[data-sub-whatsapp]');

  function select(id) {
    const plan = LIMA.plans.find((p) => p.id === id) || LIMA.plans[0];
    pageBox.querySelectorAll('.plan').forEach((el) =>
      el.classList.toggle('is-selected', el.dataset.plan === plan.id));

    if (summary) {
      summary.innerHTML = `
        <span class="sub-cta__plan">Plan ${plan.name}</span>
        <span class="sub-cta__detail">${monthsLabel(plan.months)} · ${plan.deliveries} entregas · flores de estación 2× al mes</span>
        <span class="sub-cta__price">${fmt(plan.total)} <em>· ≈ ${fmt(plan.perMonth)}/mes</em></span>`;
    }
    if (waLink) {
      const msg = `Hola Lima Flores 🌿 Quiero suscribirme al plan ${plan.name} (${monthsLabel(plan.months)}, ${plan.deliveries} entregas, ${fmt(plan.total)}). ¿Cómo continúo?`;
      waLink.href = `https://wa.me/${wa}?text=${encodeURIComponent(msg)}`;
    }
  }

  pageBox.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-plan-pick]');
    if (!btn) return;
    select(btn.getAttribute('data-plan-pick'));
    const cta = document.querySelector('[data-sub-cta]');
    if (cta) cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Preselección desde ?plan=… o el plan destacado
  const q = new URLSearchParams(location.search).get('plan');
  const initial = (q && LIMA.plans.find((p) => p.id === q)) ||
                  LIMA.plans.find((p) => p.featured) || LIMA.plans[0];
  select(initial.id);
})();
