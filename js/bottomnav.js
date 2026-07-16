/* ══════════════════════════════════════════════════════════════
   TESTPRO — js/bottomnav.js
   Umumiy pastki navigatsiya (Magic Navigation, notch+blob) +
   sahifa o'tishlarini "bir butun" ko'rsatish uchun parda (curtain)
   va boshqa sahifalarni prefetch qilish.

   MUHIM: bu skript <script src="js/api.js"> DAN DARHOL KEYIN,
   sahifaning yuqori qismida chaqiriladi (body oxirida emas!) —
   shu sabab navbar sahifa hali to'liq parse bo'lmasidanoq chiziladi
   va "keyin paydo bo'lib qolish" muammosi yo'qoladi.
   ══════════════════════════════════════════════════════════════ */

(function(){

  const ICONS = {
    home:   '<svg viewBox="0 0 24 24"><path d="M4 11.5 12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h4v-6h2v6h4a1 1 0 0 0 1-1v-9"/></svg>',
    grid:   '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
    plus:   '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    clock:  '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    user:   '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3.5 5 6v6c0 4.5 3 7 7 8.5 4-1.5 7-4 7-8.5V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  };

  const NAV_ITEMS = [
    { key:'index',     page:'index.html',     label:'Bosh sahifa', icon:'home'   },
    { key:'dashboard', page:'dashboard.html', label:'Dashboard',   icon:'grid'   },
    { key:'create',    page:'create.html',    label:'Yangi test',  icon:'plus',  main:true },
    { key:'history',   page:'history.html',   label:'Tarix',       icon:'clock'  },
    { key:'profile',   page:'profile.html',   label:'Profil',      icon:'user'   },
    { key:'admin',     page:'admin.html',     label:'Admin',       icon:'shield', adminOnly:true },
  ];

  function isAdminUser(){
    try{
      const u = (typeof TGAuth !== 'undefined') ? TGAuth.get() : null;
      return !!(u && (u.is_admin || u.role === 'admin'));
    }catch(e){ return false; }
  }

  function currentFile(){
    const p = window.location.pathname;
    const last = p.substring(p.lastIndexOf('/') + 1);
    return last || 'index.html';
  }

  function basePath(){
    if (typeof BASE_PATH !== 'undefined') return BASE_PATH;
    const p = window.location.pathname;
    return p.substring(0, p.lastIndexOf('/') + 1);
  }

  function buildItems(){
    const admin = isAdminUser();
    return NAV_ITEMS.filter(it => !it.adminOnly || admin);
  }

  function easeInOutCubic(t){
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  }

  /* ══════════ 0. PARDA (CURTAIN) — sahifa o'tishini "bir butun" qilib ko'rsatadi ══════════ */
  let curtainEl = null;

  function ensureCurtain(){
    if (curtainEl) return curtainEl;
    curtainEl = document.createElement('div');
    curtainEl.id = 'tp-curtain';
    curtainEl.style.cssText =
      'position:fixed;inset:0;z-index:1500;' +
      'background:var(--bg,#F5F3FF);' +
      'opacity:1;pointer-events:none;' +
      'transition:opacity .22s ease;';
    // body hali yo'q bo'lishi mumkin emas — bu skript body ichida ishlaydi
    document.body.appendChild(curtainEl);
    return curtainEl;
  }

  function hideCurtain(delay){
    const c = ensureCurtain();
    setTimeout(() => { c.style.opacity = '0'; }, delay || 0);
  }

  function showCurtain(){
    const c = ensureCurtain();
    c.style.transition = 'none';
    void c.offsetWidth;
    c.style.transition = 'opacity .18s ease';
    c.style.opacity = '1';
  }

  // Darhol (parse vaqtida) qopqoqni ko'rsatamiz — shu bilan navbar/kontent
  // hali tayyor bo'lmagan payt umuman ko'rinmaydi.
  ensureCurtain();

  /* ══════════ 1. NAV BAR — DARHOL CHIZILADI ══════════ */
  let barEl, blobEl, blobIcoEl, itemEls = [], items = [], activeIdx = -1;

  function renderNav(){
    items = buildItems();
    const file = currentFile();

    const wrap = document.createElement('div');
    wrap.id = 'tp-bn-wrap';

    barEl = document.createElement('div');
    barEl.className = 'tp-bn';

    const surface = document.createElement('div');
    surface.className = 'tp-bn-surface';

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'tp-bn-items';

    itemEls = items.map((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tp-bn-item' + (it.main ? ' main' : '');
      btn.dataset.page = it.page;
      btn.innerHTML = ICONS[it.icon] + '<span class="tp-bn-lbl">' + it.label + '</span>';
      btn.addEventListener('click', () => onTabTap(idx));
      itemsWrap.appendChild(btn);
      if (it.page === file) activeIdx = idx;
      return btn;
    });
    if (activeIdx === -1) activeIdx = 0;
    itemEls[activeIdx].classList.add('on');

    blobEl = document.createElement('div');
    blobEl.className = 'tp-bn-blob';
    blobIcoEl = document.createElement('span');
    blobIcoEl.className = 'tp-bn-blob-ico';
    blobIcoEl.innerHTML = ICONS[items[activeIdx].icon];
    blobEl.appendChild(blobIcoEl);

    barEl.appendChild(surface);
    barEl.appendChild(blobEl);
    barEl.appendChild(itemsWrap);
    wrap.appendChild(barEl);

    document.body.classList.add('tp-has-bn');
    document.body.appendChild(wrap);
    // parda navbardan HAM tepada turishi kerak — qayta oxiriga o'tkazamiz
    if (curtainEl) document.body.appendChild(curtainEl);

    requestAnimationFrame(() => positionAt(activeIdx));
    prefetchOthers(file);
  }

  function prefetchOthers(file){
    try{
      items.forEach(it => {
        if (it.page === file) return;
        if (document.querySelector('link[data-tp-prefetch="' + it.page + '"]')) return;
        const l = document.createElement('link');
        l.rel = 'prefetch';
        l.href = basePath() + it.page;
        l.setAttribute('data-tp-prefetch', it.page);
        document.head.appendChild(l);
      });
    }catch(e){}
  }

  function centerXOf(idx){
    const btn = itemEls[idx];
    const barRect = barEl.getBoundingClientRect();
    const r = btn.getBoundingClientRect();
    return (r.left - barRect.left) + r.width / 2;
  }

  function setX(x){
    barEl.style.setProperty('--tpnx', x + 'px');
    const r = parseFloat(getComputedStyle(barEl).getPropertyValue('--tpr')) || 32;
    const blobW = r * 1.62;
    blobEl.style.transform = 'translate(' + (x - blobW/2) + 'px, -22px)';
  }

  function positionAt(idx){
    setX(centerXOf(idx));
  }

  let animating = false;
  function glideTo(idx, done){
    if (idx === activeIdx || animating) { if (done) done(); return; }
    animating = true;
    const fromX = centerXOf(activeIdx);
    const toX = centerXOf(idx);
    const dur = 300;
    const t0 = performance.now();

    itemEls[activeIdx].classList.remove('on');
    itemEls[idx].classList.add('on');

    blobIcoEl.classList.add('out');
    let swapped = false;

    function step(now){
      const t = Math.min(1, (now - t0) / dur);
      const e = easeInOutCubic(t);
      const x = fromX + (toX - fromX) * e;
      const lift = -22 - Math.sin(Math.PI * t) * 7;
      barEl.style.setProperty('--tpnx', x + 'px');
      const r = parseFloat(getComputedStyle(barEl).getPropertyValue('--tpr')) || 32;
      const blobW = r * 1.62;
      blobEl.style.transform = 'translate(' + (x - blobW/2) + 'px, ' + lift + 'px)';

      if (!swapped && t >= 0.5) {
        swapped = true;
        blobIcoEl.innerHTML = ICONS[items[idx].icon];
        blobIcoEl.classList.remove('out');
        blobIcoEl.classList.add('in');
        setTimeout(() => blobIcoEl.classList.remove('in'), 200);
      }
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        activeIdx = idx;
        animating = false;
        if (done) done();
      }
    }
    requestAnimationFrame(step);
  }

  function onTabTap(idx){
    const file = currentFile();
    if (items[idx].page === file) return;
    goToTab(idx);
  }

  function goToTab(idx){
    const targetPage = items[idx].page;
    const dir = idx > activeIdx ? 'left' : 'right';
    glideTo(idx);
    showCurtain();
    try{ sessionStorage.setItem('tp_nav_dir', dir); }catch(e){}
    setTimeout(() => { window.location.href = basePath() + targetPage; }, 230);
  }

  /* ══════════ 2. QOLGAN QISM: DOMContentLoaded'DA ══════════ */
  function wrapContent(){
    const existing = document.getElementById('tp-slide-wrap');
    if (existing) return existing;

    const body = document.body;
    const wrapper = document.createElement('div');
    wrapper.id = 'tp-slide-wrap';

    const ALWAYS_FIXED_SELECTOR = 'nav.nav, .grain, .mesh-extra, .ov, .book-modal-bg, #tp-bn-wrap, #tp-curtain';

    const kids = Array.from(body.childNodes);
    const toMove = [];
    kids.forEach(node => {
      if (node.nodeType === 1) {
        if (node.tagName === 'SCRIPT' || node.id === 'tp-bn-wrap' || node.id === 'tp-curtain') return;
        if (node.matches && node.matches(ALWAYS_FIXED_SELECTOR)) return;
        const cs = window.getComputedStyle(node);
        if (cs.position === 'fixed') return;
      }
      toMove.push(node);
    });
    toMove.forEach(n => wrapper.appendChild(n));
    body.insertBefore(wrapper, body.firstChild);
    return wrapper;
  }

  function finalizeEntrance(){
    let dir = null;
    try{ dir = sessionStorage.getItem('tp_nav_dir'); sessionStorage.removeItem('tp_nav_dir'); }catch(e){}
    const wrapper = wrapContent();
    if (dir) {
      const from = dir === 'left' ? '18px' : '-18px';
      wrapper.style.transition = 'none';
      wrapper.style.transform = 'translateX(' + from + ')';
      void wrapper.offsetWidth;
      requestAnimationFrame(() => {
        wrapper.style.transition = 'transform .28s cubic-bezier(.4,0,.2,1)';
        wrapper.style.transform = 'translateX(0)';
        setTimeout(() => { wrapper.style.transform = ''; wrapper.style.transition = ''; }, 320);
      });
    }
    // Kontent joyiga tushgach, pardani ochamiz — foydalanuvchi hech qanday
    // "yig'ilish"ni ko'rmaydi, faqat silliq fade.
    hideCurtain(60);
  }

  function initSwipe(){
    let sx = 0, sy = 0, tracking = false, startEl = null;
    const THRESHOLD = 70;

    document.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY;
      startEl = e.target;
      tracking = true;
    }, { passive:true });

    document.addEventListener('touchend', (e) => {
      if (!tracking) return;
      tracking = false;
      const t = e.changedTouches[0];
      const dx = t.clientX - sx;
      const dy = t.clientY - sy;
      if (Math.abs(dx) < THRESHOLD || Math.abs(dy) > Math.abs(dx) * 0.6) return;

      let el = startEl;
      while (el && el !== document.body) {
        if (el.scrollWidth > el.clientWidth + 4) {
          const cs = window.getComputedStyle(el);
          if (/(auto|scroll)/.test(cs.overflowX)) return;
        }
        el = el.parentElement;
      }

      if (dx < 0 && activeIdx < items.length - 1) {
        goToTab(activeIdx + 1);
      } else if (dx > 0 && activeIdx > 0) {
        goToTab(activeIdx - 1);
      }
    }, { passive:true });
  }

  function deferredInit(){
    finalizeEntrance();
    initSwipe();
    window.addEventListener('resize', () => { if (!animating) positionAt(activeIdx); });
  }

  // ── ISHGA TUSHIRISH ──
  renderNav(); // darhol — sahifa hali to'liq parse bo'lmagan bo'lsa ham

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', deferredInit);
  } else {
    deferredInit();
  }

  // Har ehtimolga qarshi: agar biror sabab bilan yuklanish uzoq cho'zilsa,
  // parda abadiy osilib qolmasin.
  window.addEventListener('load', () => hideCurtain(0));
  setTimeout(() => hideCurtain(0), 2500);
})();
