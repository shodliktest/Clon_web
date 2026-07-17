/* ══════════════════════════════════════════════════════════════
   TESTPRO — js/bottomnav.js
   Uchta rejimda ishlaydi:

   1) SHELL   — shell.html'da. Navbar shu yerda BIR MARTA yaratiladi
      va hech qachon yo'q qilinmaydi. Tab bosilganda / swipe qilinganda
      faqat ICHKI iframe'ning src'i o'zgaradi — navbar joyidan jilmaydi.

   2) EMBEDDED — index/dashboard/create/history/profile/admin.html
      shell.html'ning iframe'i ICHIDA ochilganda. Bu holda o'z navbarini
      chizmaydi (shell allaqachon bor), faqat swipe'ni ushlab, shell'ga
      postMessage orqali xabar beradi.

   3) STANDALONE — bu sahifalar iframe'siz, to'g'ridan-to'g'ri ochilganda
      (masalan shell.html hali ulanmagan bo'lsa). Bu — oldingi, to'liq
      ishlaydigan xulq-atvor (parda + darhol-render + prefetch), ORQAGA
      MOSLIK uchun saqlanadi. Hech narsa buzilmaydi.
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

  const DEFAULT_TARGET = 'dashboard.html';
  const FRAMES_CONTAINER_ID = 'tp-frames';

  function isAdminUser(){
    try{
      const u = (typeof TGAuth !== 'undefined') ? TGAuth.get() : null;
      return !!(u && (u.is_admin || u.role === 'admin'));
    }catch(e){ return false; }
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

  /* ══════════════════════════════════════════════════════════════
     NAVBAR DOM QURUVCHISI — SHELL va STANDALONE ikkalasida ham
     ishlatiladi. onNavigate(idx) — tab tanlanganda chaqiriladi.
     ══════════════════════════════════════════════════════════════ */
  function createNavController(activeFile, onNavigate){
    const items = buildItems();
    let activeIdx = items.findIndex(it => it.page === activeFile);
    if (activeIdx === -1) activeIdx = 0;

    const wrap = document.createElement('div');
    wrap.id = 'tp-bn-wrap';

    const barEl = document.createElement('div');
    barEl.className = 'tp-bn';

    const surface = document.createElement('div');
    surface.className = 'tp-bn-surface';

    const itemsWrap = document.createElement('div');
    itemsWrap.className = 'tp-bn-items';

    const itemEls = items.map((it, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tp-bn-item' + (it.main ? ' main' : '');
      btn.dataset.page = it.page;
      btn.innerHTML = ICONS[it.icon] + '<span class="tp-bn-lbl">' + it.label + '</span>';
      btn.addEventListener('click', () => { if (idx !== activeIdx) onNavigate(idx); });
      itemsWrap.appendChild(btn);
      return btn;
    });
    itemEls[activeIdx].classList.add('on');

    const blobEl = document.createElement('div');
    blobEl.className = 'tp-bn-blob';
    const blobIcoEl = document.createElement('span');
    blobIcoEl.className = 'tp-bn-blob-ico';
    blobIcoEl.innerHTML = ICONS[items[activeIdx].icon];
    blobEl.appendChild(blobIcoEl);

    barEl.appendChild(surface);
    barEl.appendChild(blobEl);
    barEl.appendChild(itemsWrap);
    wrap.appendChild(barEl);

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

    function positionAt(idx){ setX(centerXOf(idx)); }

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

    // tashqi navigatsiya (masalan iframe ichidagi havola orqali) bo'lganda
    // navbar holatini qayta sinxronlash uchun
    function syncTo(file){
      const idx = items.findIndex(it => it.page === file);
      if (idx === -1 || idx === activeIdx) return;
      itemEls[activeIdx].classList.remove('on');
      itemEls[idx].classList.add('on');
      blobIcoEl.innerHTML = ICONS[items[idx].icon];
      activeIdx = idx;
      requestAnimationFrame(() => positionAt(activeIdx));
    }

    requestAnimationFrame(() => positionAt(activeIdx));
    window.addEventListener('resize', () => { if (!animating) positionAt(activeIdx); });

    return { wrap, items, glideTo, positionAt, syncTo, get activeIdx(){ return activeIdx; } };
  }

  function prefetchOthers(head, items, file){
    try{
      items.forEach(it => {
        if (it.page === file) return;
        if (head.querySelector('link[data-tp-prefetch="' + it.page + '"]')) return;
        const l = document.createElement('link');
        l.rel = 'prefetch';
        l.href = basePath() + it.page;
        l.setAttribute('data-tp-prefetch', it.page);
        head.appendChild(l);
      });
    }catch(e){}
  }

  /* ══════════════════════════════════════════════════════════════
     1) SHELL REJIMI — HAMMASI OLDINDAN YUKLANADI
     Har bir tab uchun alohida, mustaqil iframe yaratiladi va DARHOL
     yuklana boshlaydi (parallel). Tab almashtirish — faqat ko'rsatish/
     yashirish, tarmoq so'rovisiz, zumda.
     ══════════════════════════════════════════════════════════════ */
  function initShell(framesEl){
    const qs = new URLSearchParams(window.location.search);
    const target = qs.get('target') || DEFAULT_TARGET;
    qs.delete('target');
    const forward = qs.toString(); // uid/auto/name — HAR BIR iframe'ga uzatiladi

    const items = buildItems();
    const frames = {};

    items.forEach(it => {
      const f = document.createElement('iframe');
      f.title = it.label;
      f.className = 'tp-hidden';
      f.src = basePath() + it.page + (forward ? '?' + forward : '');
      framesEl.appendChild(f);
      frames[it.page] = f;
    });

    let activeFile = frames[target] ? target : items[0].page;
    frames[activeFile].classList.remove('tp-hidden');

    const nav = createNavController(activeFile, (idx) => navigateTo(idx));
    document.body.appendChild(nav.wrap);

    function navigateTo(idx){
      const targetPage = nav.items[idx].page;
      if (targetPage === activeFile || !frames[targetPage]) return;
      nav.glideTo(idx);
      frames[activeFile].classList.add('tp-hidden');
      activeFile = targetPage;
      frames[activeFile].classList.remove('tp-hidden');
    }

    // ichkaridagi (embedded) sahifalardan kelgan xabarlarni qabul qilish:
    // - swipe: chapga/o'ngga surish
    // - switchTab: ichki havola (masalan avatar) orqali boshqa tab'ga o'tish so'rovi
    window.addEventListener('message', (e) => {
      if (e.origin !== window.location.origin) return;
      const d = e.data;
      if (!d || d.source !== 'tp-embedded') return;
      if (d.type === 'swipe') {
        const cur = nav.activeIdx;
        if (d.dir === 'left' && cur < nav.items.length - 1) navigateTo(cur + 1);
        else if (d.dir === 'right' && cur > 0) navigateTo(cur - 1);
      } else if (d.type === 'switchTab') {
        const idx = nav.items.findIndex(it => it.page === d.page);
        if (idx !== -1) navigateTo(idx);
      }
    });
  }

  /* ══════════════════════════════════════════════════════════════
     2) EMBEDDED REJIMI (shell'ning bitta "yorlig'i"ga bog'langan
     iframe'i ichida). Har bir iframe FAQAT o'ziga tegishli sahifaga
     bag'ishlangan — shu sabab ICHKI havolalar (masalan "Profil"
     rasmiga bosish) o'sha iframe ichida haqiqiy navigatsiya qilmasligi
     kerak (aks holda o'sha tab doimiy buzilib qoladi). Shuning uchun
     global goTo() funksiyasini shell bilan gaplashadigan qilib o'raymiz:
       - agar maqsad sahifa navbar tab'laridan biri bo'lsa → shell'dan
         o'sha tab'ni ko'rsatishni so'raymiz (zumda, qayta yuklamasdan);
       - aks holda (edit.html, review.html, test.html va h.k.) → shu
         iframe faqat bitta tab uchun ekanini buzmaslik uchun ENG
         YUQORI darajaga (window.top) chiqib ochamiz.
     ══════════════════════════════════════════════════════════════ */
  function initEmbedded(){
    document.body.classList.add('tp-has-bn'); // pastda joy qoldirish (shell navbari uchun)

    if (typeof window.goTo === 'function' && !window.goTo.__tpWrapped) {
      const originalGoTo = window.goTo;
      const tabPages = NAV_ITEMS.map(it => it.page);
      const wrapped = function(page){
        const fname = page.split('?')[0].split('/').pop();
        if (tabPages.indexOf(fname) !== -1) {
          try{
            window.parent.postMessage({ source:'tp-embedded', type:'switchTab', page: fname }, window.location.origin);
            return;
          }catch(e){}
        }
        try{
          window.top.location.href = (typeof BASE_PATH !== 'undefined' ? BASE_PATH : basePath()) + page;
        }catch(e){ originalGoTo(page); }
      };
      wrapped.__tpWrapped = true;
      window.goTo = wrapped;
    }

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
      try{
        // window.parent (eng yaqin ota — shell.html), window.top EMAS:
        // Telegram ba'zan Mini App'ni o'zining iframe'iga o'rab yuboradi,
        // bu holda window.top shell emas, Telegram oynasiga ishora qilardi.
        window.parent.postMessage({ source:'tp-embedded', type:'swipe', dir: dx < 0 ? 'left' : 'right' }, window.location.origin);
      }catch(e){}
    }, { passive:true });
  }

  /* ══════════════════════════════════════════════════════════════
     3) STANDALONE REJIMI — oldingi to'liq xulq-atvor (fallback)
     ══════════════════════════════════════════════════════════════ */
  let curtainEl = null;
  function ensureCurtain(){
    if (curtainEl) return curtainEl;
    curtainEl = document.createElement('div');
    curtainEl.id = 'tp-curtain';
    curtainEl.style.cssText =
      'position:fixed;inset:0;z-index:1500;background:var(--bg,#F5F3FF);' +
      'opacity:1;pointer-events:none;transition:opacity .22s ease;';
    document.body.appendChild(curtainEl);
    return curtainEl;
  }
  function hideCurtain(delay){ const c = ensureCurtain(); setTimeout(() => { c.style.opacity = '0'; }, delay || 0); }
  function showCurtain(){
    const c = ensureCurtain();
    c.style.transition = 'none'; void c.offsetWidth; c.style.transition = 'opacity .18s ease'; c.style.opacity = '1';
  }

  function currentFile(){
    const p = window.location.pathname;
    return p.substring(p.lastIndexOf('/') + 1) || 'index.html';
  }

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

  function initStandalone(){
    ensureCurtain();
    const file = currentFile();
    const nav = createNavController(file, (idx) => goToTab(idx));
    document.body.classList.add('tp-has-bn');
    document.body.appendChild(nav.wrap);
    if (curtainEl) document.body.appendChild(curtainEl);
    prefetchOthers(document.head, nav.items, file);

    function goToTab(idx){
      const targetPage = nav.items[idx].page;
      nav.glideTo(idx);
      showCurtain();
      const dir = idx > nav.activeIdx ? 'left' : 'right';
      try{ sessionStorage.setItem('tp_nav_dir', dir); }catch(e){}
      setTimeout(() => { window.location.href = basePath() + targetPage; }, 230);
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
        const cur = nav.activeIdx;
        if (dx < 0 && cur < nav.items.length - 1) goToTab(cur + 1);
        else if (dx > 0 && cur > 0) goToTab(cur - 1);
      }, { passive:true });
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { finalizeEntrance(); initSwipe(); });
    } else {
      finalizeEntrance(); initSwipe();
    }
    window.addEventListener('load', () => hideCurtain(0));
    setTimeout(() => hideCurtain(0), 2500);
  }

  /* ══════════════════════════════════════════════════════════════
     ISHGA TUSHIRISH — qaysi rejimda ekanini aniqlaydi
     ══════════════════════════════════════════════════════════════ */
  const framesEl = document.getElementById(FRAMES_CONTAINER_ID);
  if (framesEl) {
    initShell(framesEl);
  } else if (window.top !== window.self) {
    initEmbedded();
  } else {
    initStandalone();
  }
})();
