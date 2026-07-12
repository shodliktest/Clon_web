/* ══════════════════════════════════════════════════════════════
   TESTPRO — UMUMIY JS MODULI (Nova Deck)
   Barcha sahifalarda ishlatiladigan: mavzu (theme), toast,
   professional cheksiz karusel dvigateli, spotlight-hover,
   umumiy konstantalar. js/api.js dan KEYIN ulanadi.
   ══════════════════════════════════════════════════════════════ */

/* Eslatma: esc() funksiyasi js/api.js faylida allaqachon aniqlangan
   va bu fayldan OLDIN yuklanadi, shuning uchun bu yerda qayta
   e'lon qilinmaydi — ikkalanish (duplicate declaration) oldini olish uchun. */

/* ── TOAST ── */
function toast(msg, type){
  const t = document.createElement('div');
  t.className = 'toast' + (type ? ' ' + type : '');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

/* ── THEME ── */
const TH = {
  get(){ return localStorage.getItem('tp_theme') || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'); },
  set(t){
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('tp_theme', t);
    document.querySelectorAll('#tbtn').forEach(b => b.textContent = t === 'dark' ? '☀️' : '🌙');
    document.querySelectorAll('#sw1, #sw2').forEach(s => { s.checked = t === 'dark'; });
  },
  toggle(){ this.set(this.get() === 'dark' ? 'light' : 'dark'); }
};
TH.set(TH.get());
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#tbtn').forEach(b => b.onclick = () => TH.toggle());
  document.querySelectorAll('#sw1, #sw2').forEach(s => s.onchange = () => TH.toggle());
});

/* ── FAN IKONKALARI (barcha sahifalarda bir xil) ── */
const ICON = {
  english:'🇬🇧', arabic:'🕌', russian:'🇷🇺', turkish:'🇹🇷', math:'🧮',
  it:'💻', science:'🔬', religion:'📖', other:'📚',
  history:'🏛️', biology:'🧬', physics:'⚛️'
};

const CAT_DESC = {
  math:"Mantiqiy fikrlash, aniq hisob-kitoblar, formulalar bilan ishlash tezligi hamda qiyin darajadagi misollarni yechish qobiliyatini sinovdan o'tkazuvchi modul.",
  english:"Xalqaro standartlar asosida tuzilgan bo'lib, grammatika, so'z boyligi (vocabulary) hamda gap tuzish qismlari bo'yicha bilimingizni tekshiradi.",
  it:"Algoritmlar strukturasi, kod sintaksisi, logik xatolar va zamonaviy dasturlash prinsiplari bo'yicha bilimingizni nazorat qiluvchi test.",
  physics:"Fizik qonuniyatlar, formulalar va amaliy masalalarni yechish qobiliyatingizni chuqur baholaydi.",
  biology:"Tirik organizmlar, jarayonlar va biologik tizimlar haqidagi bilimingizni har tomonlama tekshiradi.",
  history:"Tarixiy voqealar, sanalar va sabab-oqibat bog'lanishlarini qanchalik bilishingizni aniqlaydi.",
  religion:"Diniy bilimlar va qadriyatlar bo'yicha tushunchangizni sinovdan o'tkazadi.",
  russian:"Rus tili grammatikasi va lug'at boyligi bo'yicha bilim darajangizni aniqlaydi.",
  arabic:"Arab tili grammatikasi va o'qish-yozish ko'nikmalaringizni sinaydi.",
  turkish:"Turk tili grammatikasi va so'z boyligi bo'yicha bilimingizni tekshiradi.",
  science:"Tabiiy fanlar bo'yicha umumiy bilim va tushunchalaringizni baholaydi.",
  other:"Bilim darajangizni har tomonlama sinab ko'rish va kamchiliklaringizni aniqlash uchun tayyorlangan test."
};

/* ── SPOTLIGHT HOVER (delegatsiyalangan, GPU-yengil) ── */
document.addEventListener('pointermove', function(e){
  const el = e.target.closest('.card, .li');
  if(!el) return;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
  el.style.setProperty('--my', (e.clientY - r.top) + 'px');
}, {passive:true});

/* ══════════════════════════════════════════════════════════
   INFINITE CAROUSEL — professional rAF-based engine.
   Har bir instansiya mustaqil o'lchanadi va mustaqil
   harakatlanadi — bir nechtasi bitta sahifada bo'lsa ham
   hech biri boshqasiga ta'sir qilmaydi.
   ══════════════════════════════════════════════════════════ */
const Carousel = (function(){
  const rig = new Set();
  let rafId = null, lastT = null;
  const SPEED = 32, RESUME_DELAY = 2200;

  function cloneForLoop(el){
    if (el._ready) return;
    const originals = Array.from(el.children);
    if (originals.length < 2) return;
    for (let rep = 0; rep < 2; rep++){
      for (const c of originals){
        const clone = c.cloneNode(true);
        clone.onclick = c.onclick;
        const origBtns = c.querySelectorAll('button, .card-view, .li-btn');
        const cloneBtns = clone.querySelectorAll('button, .card-view, .li-btn');
        origBtns.forEach((b, idx) => { if(cloneBtns[idx]) cloneBtns[idx].onclick = b.onclick; });
        clone.setAttribute('aria-hidden', 'true');
        clone.tabIndex = -1;
        el.appendChild(clone);
      }
    }
    el._setCount = originals.length;
    el._ready = true;
  }

  function measure(el){
    const n = el._setCount;
    if (!n || el.children.length < n*2+1) return false;
    const bw = el.children[n].offsetLeft - el.children[0].offsetLeft;
    if (bw <= 0) return false;
    el._blockWidth = bw;
    if (!el._initialized){
      el.scrollLeft = bw + (el.scrollLeft % bw || 0);
      el._initialized = true;
    }
    return true;
  }

  function normalize(el){
    const bw = el._blockWidth;
    if (!bw) return;
    while (el.scrollLeft < bw*0.5) el.scrollLeft += bw;
    while (el.scrollLeft >= bw*1.5) el.scrollLeft -= bw;
  }

  function frame(t){
    rafId = requestAnimationFrame(frame);
    if (lastT == null){ lastT = t; return; }
    const dt = Math.min(64, t - lastT);
    lastT = t;
    for (const el of rig){
      if (!el.isConnected){ rig.delete(el); continue; }
      if (el._hover || el._dragging) continue;
      if (el._resumeAt && t < el._resumeAt) continue;
      if (!el._blockWidth && !measure(el)) continue;
      el.scrollLeft += (SPEED*dt)/1000;
      normalize(el);
    }
  }

  function pauseInteraction(el){ el._resumeAt = performance.now() + RESUME_DELAY; }

  function register(el){
    if (el.scrollWidth <= el.clientWidth + 4) return; // sig'adigan bo'lsa karusel shart emas
    cloneForLoop(el);
    el._blockWidth = 0;
    el._initialized = false;
    el.addEventListener('pointerenter', function(){ el._hover = true; }, {passive:true});
    el.addEventListener('pointerleave', function(){ el._hover = false; pauseInteraction(el); }, {passive:true});
    el.addEventListener('pointerdown',  function(){ el._dragging = true; }, {passive:true});
    window.addEventListener('pointerup', function(){
      if (el._dragging){ el._dragging = false; pauseInteraction(el); }
    }, {passive:true});
    el.addEventListener('wheel',      function(){ pauseInteraction(el); }, {passive:true});
    el.addEventListener('touchstart', function(){ el._dragging = true; }, {passive:true});
    el.addEventListener('touchend',   function(){ el._dragging = false; pauseInteraction(el); }, {passive:true});
    rig.add(el);
    let tries = 0;
    (function tryMeasure(){
      if (measure(el) || ++tries > 24) return;
      requestAnimationFrame(tryMeasure);
    })();
    if (rafId == null) rafId = requestAnimationFrame(frame);
  }

  window.addEventListener('resize', function(){
    for (const el of rig){ el._blockWidth = 0; el._initialized = false; }
  });

  return { register: register };
})();

/* ── SIDE MENU (dashboard, profile va h.k. uchun umumiy ochish/yopish) ── */
function initSideMenu(){
  const panel = document.getElementById('panel');
  const ov = document.getElementById('ov');
  const mbtn = document.getElementById('mbtn');
  const pcl = document.getElementById('pcl');
  if(!panel || !ov) return;
  function openMenu(){ panel.classList.add('on'); ov.classList.add('on'); }
  function closeMenu(){ panel.classList.remove('on'); ov.classList.remove('on'); }
  if(mbtn) mbtn.onclick = openMenu;
  if(pcl) pcl.onclick = closeMenu;
  ov.onclick = closeMenu;
  window.closeMenu = closeMenu;
  window.openMenu = openMenu;
}
document.addEventListener('DOMContentLoaded', initSideMenu);

/* ── AVATAR ── */
function setAva(id, name, photo){
  const el = document.getElementById(id);
  if(!el) return;
  if(photo){ el.innerHTML = '<img src="'+photo+'" alt=""/>'; }
  else{ el.textContent = (name||'U')[0].toUpperCase(); }
}

/* ── BOOK PREVIEW MODAL (index/dashboard'da testni "Ko'rish" tugmasi) ──
   openBookPreview(testId, testObject) chaqirilganda ochiladi,
   "Sinovni boshlash" bosilganda test.html?id=... ga o'tkazadi. ── */
function openBookPreview(tid, t){
  if(!t) return;
  const elBadge = document.getElementById('book-badge');
  const elCoverTitle = document.getElementById('book-cover-title');
  const elTitle = document.getElementById('book-title');
  const elAuthor = document.getElementById('book-author');
  const elQ = document.getElementById('book-qcount');
  const elTime = document.getElementById('book-time');
  const elSolves = document.getElementById('book-solves');
  const elDesc = document.getElementById('book-desc-text');
  const startBtn = document.getElementById('book-start-btn');
  const bg = document.getElementById('book-modal-bg');
  if(!bg) return;

  const cat = t.category || t.subject || 'other';
  const sub = (typeof getSubject === 'function') ? getSubject(cat) : {label: cat};

  if(elBadge) elBadge.textContent = sub.label || 'Umumiy';
  if(elCoverTitle) elCoverTitle.textContent = t.title;
  if(elTitle) elTitle.textContent = t.title;
  if(elAuthor) elAuthor.textContent = t.creator_name || t.authorName || 'Anonim';
  if(elQ) elQ.textContent = (t.question_count||0) + ' ta savol';
  if(elTime) elTime.textContent = t.time_limit ? (t.time_limit+' daqiqa') : 'Cheksiz';
  if(elSolves) elSolves.textContent = (t.solve_count||0) + ' marta';
  if(elDesc) elDesc.textContent = CAT_DESC[cat] || CAT_DESC.other;
  if(startBtn) startBtn.onclick = function(){ closeBookModal(); goTo('test.html?id='+tid); };

  bg.style.display = 'flex';
  bg.classList.add('on');
}
function closeBookModal(){
  const bg = document.getElementById('book-modal-bg');
  if(bg){ bg.classList.remove('on'); bg.style.display = 'none'; }
}
document.addEventListener('DOMContentLoaded', function(){
  const bg = document.getElementById('book-modal-bg');
  if(bg) bg.addEventListener('click', function(e){ if(e.target === this) closeBookModal(); });
});

/* ── COUNT-UP STAT ANIMATSIYASI ── */
function animateCount(el, target){
  if(!el) return;
  let cur = 0;
  const step = Math.max(1, Math.ceil(target/36));
  const iv = setInterval(function(){
    cur += step;
    if(cur >= target){ cur = target; clearInterval(iv); }
    el.textContent = cur;
  }, 26);
}
