/* ══════════════════════════════════════════════════════════════
   TESTPRO — js/bottomnav.js
   Umumiy pastki navigatsiya menyusi (Magic Navigation uslubida).
   js/api.js dan KEYIN, css/bottomnav.css ulangandan keyin qo'shiladi.
   Har bir ichki sahifa oxiriga shuni qo'shish kifoya:
     <link rel="stylesheet" href="css/bottomnav.css">
     <script src="js/bottomnav.js"></script>
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

  function render(){
    const items = buildItems();
    const file = currentFile();

    const wrap = document.createElement('div');
    wrap.id = 'tp-bn-wrap';
    const bar = document.createElement('div');
    bar.className = 'tp-bn';

    items.forEach((it) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'tp-bn-item' + (it.main ? ' main' : '') + (it.page === file ? ' on' : '');
      btn.dataset.page = it.page;
      btn.innerHTML =
        '<span class="tp-bn-ico">' + ICONS[it.icon] + '</span>' +
        '<span class="tp-bn-lbl">' + it.label + '</span>';
      btn.addEventListener('click', () => navigate(it.page, items, file));
      bar.appendChild(btn);
    });

    wrap.appendChild(bar);
    document.body.classList.add('tp-has-bn');
    document.body.appendChild(wrap);
    return items;
  }

  function navigate(targetPage, items, file){
    if (targetPage === file) return;
    const from = items.findIndex(i => i.page === file);
    const to   = items.findIndex(i => i.page === targetPage);
    const dir  = (to > from) ? 'left' : 'right';
    slideOutAndGo(targetPage, dir);
  }

  /* ── SAHIFA WRAPPER: fixed bo'lmagan elementlarni bitta konteynerga yig'ish ── */
  function wrapContent(){
    if (document.getElementById('tp-slide-wrap')) return document.getElementById('tp-slide-wrap');
    const body = document.body;
    const wrapper = document.createElement('div');
    wrapper.id = 'tp-slide-wrap';

    const kids = Array.from(body.childNodes);
    const toMove = [];
    kids.forEach(node => {
      if (node.nodeType === 1) {
        if (node.tagName === 'SCRIPT' || node.id === 'tp-bn-wrap') return;
        const cs = window.getComputedStyle(node);
        if (cs.position === 'fixed') return;
      }
      toMove.push(node);
    });
    toMove.forEach(n => wrapper.appendChild(n));
    body.appendChild(wrapper);
    return wrapper;
  }

  function slideOutAndGo(targetPage, dir){
    const wrapper = wrapContent();
    const distance = dir === 'left' ? '-32px' : '32px';
    wrapper.style.transform = 'translateX(' + distance + ')';
    wrapper.style.opacity = '0';
    try{ sessionStorage.setItem('tp_nav_dir', dir); }catch(e){}
    setTimeout(() => { window.location.href = basePath() + targetPage; }, 220);
  }

  function playEntrance(){
    let dir = null;
    try{ dir = sessionStorage.getItem('tp_nav_dir'); sessionStorage.removeItem('tp_nav_dir'); }catch(e){}
    const wrapper = wrapContent();
    if (!dir) return;
    const from = dir === 'left' ? '32px' : '-32px';
    wrapper.style.transition = 'none';
    wrapper.style.transform = 'translateX(' + from + ')';
    wrapper.style.opacity = '0';
    // reflow
    void wrapper.offsetWidth;
    requestAnimationFrame(() => {
      wrapper.style.transition = '';
      wrapper.style.transform = 'translateX(0)';
      wrapper.style.opacity = '1';
    });
  }

  /* ── BARMOQ BILAN SURISH (SWIPE) ── */
  function initSwipe(items, file){
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

      // ichki gorizontal skroll (karusel) ustida bo'lsa, sahifa surishni bekor qilamiz
      let el = startEl;
      while (el && el !== document.body) {
        if (el.scrollWidth > el.clientWidth + 4) {
          const cs = window.getComputedStyle(el);
          if (/(auto|scroll)/.test(cs.overflowX)) return;
        }
        el = el.parentElement;
      }

      const from = items.findIndex(i => i.page === file);
      if (from === -1) return;
      if (dx < 0 && from < items.length - 1) {
        slideOutAndGo(items[from + 1].page, 'left');
      } else if (dx > 0 && from > 0) {
        slideOutAndGo(items[from - 1].page, 'right');
      }
    }, { passive:true });
  }

  function init(){
    const items = render();
    const file = currentFile();
    playEntrance();
    initSwipe(items, file);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
