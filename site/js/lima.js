// Lima Flores — runtime shared logic
(function() {
  'use strict';

  const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ─── Header scroll state ─────────────────────────
  const header = document.querySelector('.header');
  const setHeaderState = () => {
    if (!header) return;
    header.dataset.scrolled = (window.scrollY > 40) ? 'true' : 'false';
  };
  setHeaderState();
  window.addEventListener('scroll', setHeaderState, { passive: true });

  // ─── Mobile menu toggle ──────────────────────────
  const menuBtn = document.querySelector('.header__menu');
  if (header && menuBtn) {
    const setMenu = (open) => {
      header.dataset.menu = open ? 'open' : 'closed';
      document.body.style.overflow = open ? 'hidden' : '';
    };
    menuBtn.addEventListener('click', () => setMenu(header.dataset.menu !== 'open'));
    header.querySelectorAll('.header__nav a').forEach((a) =>
      a.addEventListener('click', () => setMenu(false)));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 900) setMenu(false); });
  }

  // ─── LF Header: sticky translúcido + menú móvil + barra de progreso ───
  const lfHeader = document.getElementById('lfHeader');
  if (lfHeader) {
    const lfProgress = document.getElementById('lfProgress');
    const onLfScroll = () => {
      lfHeader.classList.toggle('is-scrolled', window.scrollY > 16);
      if (lfProgress) {
        const h = document.documentElement;
        const max = h.scrollHeight - h.clientHeight;
        lfProgress.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
      }
    };
    window.addEventListener('scroll', onLfScroll, { passive: true });
    onLfScroll();

    const lfBurger = document.getElementById('lfBurger');
    const lfNav = document.getElementById('lfNav');
    if (lfBurger) {
      const setMenu = (open) => {
        lfHeader.classList.toggle('is-menu-open', open);
        lfBurger.setAttribute('aria-expanded', open ? 'true' : 'false');
        document.body.style.overflow = open ? 'hidden' : '';
      };
      lfBurger.addEventListener('click', () => setMenu(!lfHeader.classList.contains('is-menu-open')));
      if (lfNav) lfNav.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
      window.addEventListener('resize', () => { if (window.innerWidth > 880) setMenu(false); });
    }
  }

  // ─── Botones magnéticos (desktop) ────────────────
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReduced) {
    document.querySelectorAll('.lf-btn, .btn--primary').forEach((btn) => {
      btn.addEventListener('mousemove', (e) => {
        const r = btn.getBoundingClientRect();
        const mx = e.clientX - r.left - r.width / 2;
        const my = e.clientY - r.top - r.height / 2;
        btn.style.transform = `translate(${mx * 0.12}px, ${my * 0.18}px)`;
      });
      btn.addEventListener('mouseleave', () => { btn.style.transform = ''; });
    });
  }

  // ─── Reveal on scroll (IntersectionObserver) ─────
  if (!prefersReduced && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          // For staggered groups, set i index
          if (e.target.hasAttribute('data-reveal-stagger')) {
            [...e.target.children].forEach((c, i) => c.style.setProperty('--i', Math.min(i, 8)));
          }
          io.unobserve(e.target);
        }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });

    document.querySelectorAll('[data-reveal], [data-reveal-stagger]').forEach((el) => io.observe(el));

    // Reveal lines split — for elements with .reveal-line and data-text
    document.querySelectorAll('[data-split]').forEach((el) => {
      const text = el.textContent;
      el.innerHTML = '';
      // Split by <br> placeholder or by literal newline character isn't simple - assume single-line; wrap whole text in one line
      // We'll let authors use multiple .reveal-line spans manually for multi-line
      const wrap = document.createElement('span');
      wrap.className = 'reveal-line';
      const inner = document.createElement('span');
      inner.textContent = text;
      wrap.appendChild(inner);
      el.appendChild(wrap);
    });
    document.querySelectorAll('.reveal-line').forEach((el) => io.observe(el));
  } else {
    document.querySelectorAll('[data-reveal], [data-reveal-stagger], .reveal-line').forEach((el) => el.classList.add('is-in'));
  }

  // ─── Parallax (data-parallax="0.2") ──────────────
  if (!prefersReduced) {
    const els = [...document.querySelectorAll('[data-parallax]')];
    if (els.length) {
      const update = () => {
        const vh = window.innerHeight;
        els.forEach((el) => {
          const r = el.getBoundingClientRect();
          const center = r.top + r.height / 2;
          const fromMid = (center - vh / 2) / vh;
          const strength = parseFloat(el.dataset.parallax) || 0.15;
          el.style.transform = `translate3d(0, ${fromMid * strength * 100}px, 0)`;
        });
      };
      window.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    }
  }

  // ─── Flor del manifiesto (No. 02) — animación ligada al scroll ───
  // JS puro: se mueve en todos los navegadores (no depende de animation-timeline:view()).
  const bloomImg = document.querySelector('.philosophy__bloom img');
  if (bloomImg) {
    const bloomSec = bloomImg.closest('#philosophy') || bloomImg.closest('.section') || bloomImg.parentElement;
    let bloomTick = false;
    const applyBloom = () => {
      bloomTick = false;
      const r = bloomSec.getBoundingClientRect();
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const prog = Math.max(0, Math.min(1, (vh - r.top) / (vh + r.height)));
      const ty = 70 - prog * 140;    // 70px  → -70px
      const rot = -7 + prog * 14;    // -7deg → 7deg
      const sc = 0.9 + prog * 0.18;  // 0.90  → 1.08
      bloomImg.style.transform = `translateY(${ty}px) rotate(${rot}deg) scale(${sc})`;
    };
    const onBloom = () => { if (!bloomTick) { bloomTick = true; requestAnimationFrame(applyBloom); } };
    window.addEventListener('scroll', onBloom, { passive: true });
    window.addEventListener('resize', onBloom, { passive: true });
    applyBloom();
  }

  // ─── Hero video: avance ligado al scroll (scroll-scrubbing) ───
  const heroVideo = document.querySelector('video[data-scrub]');
  if (heroVideo) {
    let vdur = 0, vtick = false;
    const setDur = () => { vdur = heroVideo.duration || 0; };
    heroVideo.addEventListener('loadedmetadata', setDur);
    if (heroVideo.readyState >= 1) setDur();
    const scrub = () => {
      vtick = false;
      if (!vdur) return;
      const vh = window.innerHeight || 800;
      const prog = Math.max(0, Math.min(1, window.scrollY / (vh * 1.15)));
      const t = prog * Math.max(0, vdur - 0.05);
      if (Math.abs(heroVideo.currentTime - t) > 0.015) { try { heroVideo.currentTime = t; } catch (e) {} }
    };
    const onScrub = () => { if (!vtick) { vtick = true; requestAnimationFrame(scrub); } };
    window.addEventListener('scroll', onScrub, { passive: true });
    // "Prime" el decodificado (móvil) y deja el primer frame listo
    heroVideo.addEventListener('loadeddata', () => {
      const pr = heroVideo.play();
      if (pr && pr.then) pr.then(() => { heroVideo.pause(); scrub(); }).catch(() => scrub());
      else { try { heroVideo.pause(); } catch (e) {} scrub(); }
    });
  }

  // ─── Videos en loop (franjas + firma): play sólo en viewport ───
  const loopVideos = document.querySelectorAll('video[data-inview]');
  if (loopVideos.length && 'IntersectionObserver' in window) {
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const v = e.target;
        if (e.isIntersecting) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
        else { v.pause(); }
      });
    }, { threshold: 0.15 });
    loopVideos.forEach((v) => vio.observe(v));
  } else {
    loopVideos.forEach((v) => { const p = v.play && v.play(); if (p && p.catch) p.catch(() => {}); });
  }

  // ─── Counters ────────────────────────────────────
  document.querySelectorAll('[data-counter]').forEach((el) => {
    const target = +el.dataset.counter;
    const dur = +el.dataset.dur || 1800;
    const suffix = el.dataset.suffix || '';
    let started = false;
    const animate = () => {
      const start = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - start) / dur);
        const eased = 1 - Math.pow(1 - p, 3);
        const v = Math.round(target * eased);
        el.textContent = v.toLocaleString('es-PE') + suffix;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if ('IntersectionObserver' in window) {
      const io2 = new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting && !started) { started = true; animate(); io2.unobserve(el); }
        });
      }, { threshold: 0.3 });
      io2.observe(el);
    } else { animate(); }
  });

  // ─── Cursor accent (desktop only) ────────────────
  if (matchMedia('(hover: hover) and (pointer: fine)').matches && !prefersReduced) {
    const c = document.createElement('div');
    c.className = 'cursor';
    document.body.appendChild(c);
    let x = window.innerWidth/2, y = window.innerHeight/2;
    let tx = x, ty = y;
    window.addEventListener('mousemove', (e) => { tx = e.clientX; ty = e.clientY; });
    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      c.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      requestAnimationFrame(loop);
    };
    loop();
    document.addEventListener('mouseover', (e) => {
      const t = e.target;
      if (t && t.closest && t.closest('a, button, .product-card, .cat-card, [data-cursor="link"]')) {
        c.classList.add('is-link');
      } else c.classList.remove('is-link');
    });
  }

  // ─── Cart system ─────────────────────────────────
  const CART_KEY = 'lima-cart-v1';
  const readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; } catch { return []; } };
  const writeCart = (c) => localStorage.setItem(CART_KEY, JSON.stringify(c));

  window.LimaCart = {
    items: readCart(),
    save() { writeCart(this.items); this.render(); this.updateBadge(); },
    add(id, qty = 1) {
      const p = LIMA.products.find(x => x.id === id);
      if (!p) return;
      const existing = this.items.find(x => x.id === id);
      if (existing) existing.qty += qty;
      else this.items.push({ id, qty });
      this.save();
      this.open();
    },
    setQty(id, qty) {
      const it = this.items.find(x => x.id === id);
      if (!it) return;
      if (qty <= 0) this.items = this.items.filter(x => x.id !== id);
      else it.qty = qty;
      this.save();
    },
    remove(id) {
      this.items = this.items.filter(x => x.id !== id);
      this.save();
    },
    count() { return this.items.reduce((s, x) => s + x.qty, 0); },
    subtotal() {
      return this.items.reduce((s, it) => {
        const p = LIMA.products.find(x => x.id === it.id);
        return p ? s + p.price * it.qty : s;
      }, 0);
    },
    open() {
      document.getElementById('cart-drawer')?.classList.add('is-open');
      document.getElementById('cart-overlay')?.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    },
    close() {
      document.getElementById('cart-drawer')?.classList.remove('is-open');
      document.getElementById('cart-overlay')?.classList.remove('is-open');
      document.body.style.overflow = '';
    },
    updateBadge() {
      const badge = document.querySelector('[data-cart-count]');
      if (!badge) return;
      const n = this.count();
      badge.textContent = n;
      badge.hidden = n === 0;
    },
    render() {
      const body = document.getElementById('cart-body');
      const foot = document.getElementById('cart-foot');
      if (!body) return;
      if (this.items.length === 0) {
        body.innerHTML = '<div class="drawer__empty">Aún sin flores en el carrito.</div>';
        if (foot) foot.innerHTML = '';
        return;
      }
      body.innerHTML = this.items.map(it => {
        const p = LIMA.products.find(x => x.id === it.id);
        if (!p) return '';
        const media = p.image
          ? `<img src="${p.image}" alt="${p.name}"/>`
          : placeholderSVG(p);
        return `
          <div class="drawer__item">
            <div class="mini">${media}</div>
            <div>
              <div class="nm">${p.name}</div>
              <div class="qty-row">
                <button onclick="LimaCart.setQty('${p.id}', ${it.qty-1})">−</button>
                <span>${it.qty}</span>
                <button onclick="LimaCart.setQty('${p.id}', ${it.qty+1})">+</button>
              </div>
              <button class="rm" onclick="LimaCart.remove('${p.id}')">Quitar</button>
            </div>
            <div class="pr">${formatSoles(p.price * it.qty)}</div>
          </div>`;
      }).join('');
      if (foot) {
        foot.innerHTML = `
          <div style="display:flex; justify-content:space-between; margin-bottom:20px; font-family:var(--f-display); font-size:1.25rem;">
            <span>Subtotal</span><span>${formatSoles(this.subtotal())}</span>
          </div>
          <a href="checkout.html" class="btn btn--ink btn--block">Ir a checkout <span class="arrow">→</span></a>
          <button onclick="LimaCart.close()" style="display:block;margin:16px auto 0;font-size:var(--fs-nano);letter-spacing:var(--tr-label);text-transform:uppercase;color:var(--ink-soft)">Seguir explorando</button>
        `;
      }
    }
  };

  // Init cart UI
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-cart-open]')) { e.preventDefault(); LimaCart.open(); }
    if (e.target.closest('[data-cart-close]')) { e.preventDefault(); LimaCart.close(); }
    if (e.target.closest('#cart-overlay')) { LimaCart.close(); }
  });
  LimaCart.render();
  LimaCart.updateBadge();

  // ─── Smooth anchor scroll w/ offset ──────────────
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id.length < 2) return;
      const el = document.querySelector(id);
      if (!el) return;
      e.preventDefault();
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: 'smooth' });
    });
  });

  // ─── Year ────────────────────────────────────────
  document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());

})();
