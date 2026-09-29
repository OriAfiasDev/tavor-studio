/* סטודיו תבור — main.js
   One rAF-throttled scroll loop drives every scroll-linked effect via CSS custom properties.
   No libraries. Everything degrades: without JS the page is fully readable. */
(function () {
  'use strict';
  const doc = document.documentElement;
  doc.classList.add('js');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp01 = (v) => Math.min(1, Math.max(0, v));

  /* ------------------------------------------------------------------
     1. Scroll progress driver
     [data-progress="pin"]  → 0..1 across the element's own scroll length (sticky sections)
     [data-progress="view"] → 0..1 as the element travels from the bottom of the viewport
                              to ~35% from the top
     ------------------------------------------------------------------ */
  const driven = $$('[data-progress]').map((el) => ({ el, mode: el.dataset.progress, top: 0, len: 1 }));
  const nav = $('#nav');
  let ticking = false;

  function measure() {
    const vh = window.innerHeight;
    measureGallery();
    driven.forEach((d) => {
      const r = d.el.getBoundingClientRect();
      d.top = r.top + window.scrollY;
      d.len = d.mode === 'pin' ? Math.max(1, d.el.offsetHeight - vh) : vh * 0.65;
    });
    measureHero();
  }

  function update() {
    ticking = false;
    const y = window.scrollY;
    const vh = window.innerHeight;
    if (!reduceMotion) {
      driven.forEach((d) => {
        let p;
        if (d.mode === 'pin') p = (y - d.top) / d.len;
        else p = (vh - (d.top - y)) / d.len;
        d.el.style.setProperty('--p', clamp01(p).toFixed(4));
      });
    }
    if (nav) nav.classList.toggle('is-solid', y > vh * 0.6);
  }

  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  /* ------------------------------------------------------------------
     2. Hero: measure the giant line so it ends exactly at the far edge
     ------------------------------------------------------------------ */
  const hero = $('.hero');
  const track = $('#heroTrack');
  const lock = $('.hero .lock');
  function measureHero() {
    if (!hero || !track) return;
    const vw = window.innerWidth;
    const trackW = track.scrollWidth;
    // The track's right edge starts 4vw from the right. At p=1 the locked phrase
    // («תופס רגעים.») should sit centred in the viewport.
    let travel = trackW - (vw - vw * 0.08);
    if (lock) {
      hero.style.setProperty('--travel', '0px');       // measure the untranslated layout
      const r = lock.getBoundingClientRect();
      travel = (vw - r.width) / 2 - r.left;
    }
    hero.style.setProperty('--travel', Math.max(0, travel) + 'px');
  }

  /* ------------------------------------------------------------------
     2b. Gallery: vertical scroll slides the strip sideways, 1px : 1px.
     Section height = strip overflow + one viewport; the inner block pins.
     ------------------------------------------------------------------ */
  const gallery = $('.gallery');
  const strip = $('#strip');
  function measureGallery() {
    if (!gallery || !strip || reduceMotion) return;
    const items = $$('.strip__item', strip);
    if (!items.length) return;
    const first = items[0].getBoundingClientRect();
    const last = items[items.length - 1].getBoundingClientRect();
    const cs = getComputedStyle(strip);
    const pad = parseFloat(cs.paddingInlineStart) + parseFloat(cs.paddingInlineEnd);
    const content = Math.abs(first.right - last.left) + pad;   // RTL: first item is rightmost
    const travel = Math.max(0, content - window.innerWidth);
    gallery.style.setProperty('--strip-travel', travel + 'px');
    gallery.style.height = (travel + window.innerHeight) + 'px';
  }

  /* ------------------------------------------------------------------
     3. Manifesto: split into words, each lit by scroll position
     ------------------------------------------------------------------ */
  $$('[data-words]').forEach((p) => {
    const accent = ['בצחוק,', 'לבד.'];
    const words = p.textContent.trim().split(/\s+/);
    p.textContent = '';
    words.forEach((w, i) => {
      const s = document.createElement('span');
      s.className = 'w' + (accent.includes(w) ? ' w--accent' : '');
      s.style.setProperty('--i', i);
      s.textContent = w;
      p.appendChild(s);
      if (i < words.length - 1) p.appendChild(document.createTextNode(' '));
    });
    p.style.setProperty('--n', words.length);
  });

  /* ------------------------------------------------------------------
     4. Nav: mobile menu
     ------------------------------------------------------------------ */
  const burger = $('.nav__burger');
  if (burger && nav) {
    const setOpen = (open) => {
      nav.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(!nav.classList.contains('is-open')));
    $$('.nav__menu a').forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setOpen(false); });
  }

  /* ------------------------------------------------------------------
     5. Reveal on enter (small distance, short duration)
     ------------------------------------------------------------------ */
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.reveal').forEach((el) => io.observe(el));

    /* Process: the step crossing the middle of the viewport is active */
    const steps = $$('.step');
    const counter = $('#stepNow');
    const stepIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          steps.forEach((s) => s.classList.toggle('is-active', s === e.target));
          if (counter) counter.textContent = e.target.dataset.step;
        }
      });
    }, { rootMargin: '-42% 0px -42% 0px', threshold: 0 });
    steps.forEach((s) => stepIO.observe(s));
    if (steps[0]) steps[0].classList.add('is-active');
  } else {
    $$('.reveal').forEach((el) => el.classList.add('is-in'));
    $$('.step').forEach((el) => el.classList.add('is-active'));
  }

  /* ------------------------------------------------------------------
     6. Availability calendar — reads assets/availability.json
     ------------------------------------------------------------------ */
  const cal = $('#cal');
  if (cal) {
    const MONTHS = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
    const WD = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    const WD_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
    const monthsEl = $('#calMonths');
    const titleEl = $('#calTitle');
    const prevBtn = $('#calPrev');
    const nextBtn = $('#calNext');
    const pick = $('#datePick');
    const pickLabel = $('#pickLabel');
    const pickWa = $('#pickWa');
    const MAX_AHEAD = 18; // months

    const today = new Date(); today.setHours(0, 0, 0, 0);
    let view = new Date(today.getFullYear(), today.getMonth(), 1);
    let booked = new Set();
    let selected = null;

    const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const monthsBetween = (a, b) => (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());

    function renderMonth(first) {
      const wrap = document.createElement('div');
      wrap.className = 'month';

      const grid = document.createElement('div');
      grid.className = 'month__grid';
      grid.setAttribute('role', 'grid');
      WD.forEach((w) => { const h = document.createElement('div'); h.className = 'month__wd'; h.textContent = w; grid.appendChild(h); });
      for (let i = 0; i < first.getDay(); i++) grid.appendChild(document.createElement('div'));

      const days = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
      for (let d = 1; d <= days; d++) {
        const date = new Date(first.getFullYear(), first.getMonth(), d);
        const key = iso(date);
        const isPast = date < today;
        const isSat = date.getDay() === 6;
        const isBooked = booked.has(key);
        let el;
        if (isPast || isSat || isBooked) {
          el = document.createElement('span');
          el.className = 'day ' + (isPast ? 'day--past' : isSat ? 'day--closed' : 'day--booked');
          el.setAttribute('aria-label', `${d} ${MONTHS[first.getMonth()]} — ${isPast ? 'עבר' : isSat ? 'שבת, סגור' : 'תפוס'}`);
        } else {
          el = document.createElement('button');
          el.type = 'button';
          el.className = 'day day--free bracket';
          el.dataset.date = key;
          el.setAttribute('aria-label', `${d} ${MONTHS[first.getMonth()]}, פנוי — לבחירה`);
          if (selected === key) el.classList.add('day--selected');
          el.addEventListener('click', () => select(date, el));
        }
        if (key === iso(today)) el.classList.add('day--today');
        el.textContent = d;
        grid.appendChild(el);
      }
      wrap.appendChild(grid);
      return wrap;
    }

    function render() {
      monthsEl.textContent = '';
      monthsEl.appendChild(renderMonth(view));
      titleEl.textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
      prevBtn.disabled = monthsBetween(today, view) <= 0;
      nextBtn.disabled = monthsBetween(today, view) >= MAX_AHEAD;
    }

    function select(date, el) {
      selected = iso(date);
      $$('.day--selected', monthsEl).forEach((d) => d.classList.remove('day--selected'));
      el.classList.add('day--selected');
      const human = `יום ${WD_LONG[date.getDay()]}, ${date.getDate()} ב${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
      const short = `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
      pickLabel.textContent = human;
      const msg = `היי, אנחנו מתחתנים ב-${short} (יום ${WD_LONG[date.getDay()]}). התאריך פנוי?`;
      pickWa.href = 'https://wa.me/972500000000?text=' + encodeURIComponent(msg);
      pick.hidden = false;
    }

    prevBtn.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); render(); });
    nextBtn.addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); render(); });

    fetch('assets/availability.json', { cache: 'no-cache' })
      .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then((data) => {
        booked = new Set(Array.isArray(data.booked) ? data.booked : []);
        render();
      })
      .catch(() => {
        // Never show an all-free calendar by mistake: hide it and point to WhatsApp.
        $('.cal__nav').hidden = true;
        monthsEl.innerHTML = '<p class="cal__noscript">הלוח לא נטען. שלחו את התאריך בוואטסאפ ותקבלו תשובה מהר.</p>';
      });
  }

  /* ------------------------------------------------------------------
     boot
     ------------------------------------------------------------------ */
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });
  window.addEventListener('load', () => { measure(); update(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); update(); });
  measure(); update();
})();
