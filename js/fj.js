/* ════════════════════════════════════════════════════════════
   Majburiy obuna — to'liq ekran oyna (TestPro web)
   Server (/api/proxy) obunani HAR SO'ROVDA tekshiradi; bu fayl faqat foydalanuvchiga
   "avval obuna bo'ling" oynasini ko'rsatadi va "Tekshirish" tugmasini beradi.
   ════════════════════════════════════════════════════════════ */
(function () {
  if (window.FJ) return;
  const API = '/api/proxy';
  let el = null, _uid = '';

  function hdrs() {
    const h = {};
    try { const u = _uid || (window.TGAuth && TGAuth.uid && TGAuth.uid()) || ''; if (u) h['X-TG-ID'] = String(u); } catch (e) {}
    try { const tg = window.Telegram && Telegram.WebApp; if (tg && tg.initData) h['X-TG-INIT'] = tg.initData; } catch (e) {}
    return h;
  }
  function openLink(url) {
    try {
      const tg = window.Telegram && Telegram.WebApp;
      if (tg && tg.openTelegramLink && /^https:\/\/t\.me\//.test(url)) { tg.openTelegramLink(url); return; }
    } catch (e) {}
    window.open(url, '_blank');
  }
  function esc(s) { const d = document.createElement('div'); d.textContent = String(s == null ? '' : s); return d.innerHTML; }

  async function check(uid, fresh) {
    if (uid) _uid = String(uid);
    try {
      const r = await fetch(API + '?endpoint=fj/check' + (fresh ? '&fresh=1' : '') + (_uid ? '&uid=' + encodeURIComponent(_uid) : ''),
        { headers: hdrs(), cache: 'no-store' });
      const j = await r.json();
      return { ok: j.ok !== false, channels: j.channels || [] };
    } catch (e) { return { ok: true, channels: [] }; }          // tarmoq xatosida foydalanuvchini bloklamaymiz
  }

  function hide() { if (el) { el.remove(); el = null; } }

  function show(channels) {
    if (el) return;
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    el = document.createElement('div');
    el.id = 'fj-overlay';
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;background:rgba(15,23,42,.72);display:flex;align-items:center;justify-content:center;padding:18px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif';
    const card = 'background:' + (dark ? '#1f2937' : '#fff') + ';color:' + (dark ? '#f3f4f6' : '#111827') + ';border-radius:18px;padding:22px 18px;max-width:380px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.4);text-align:center';
    const btn = 'display:block;width:100%;box-sizing:border-box;margin:8px 0;padding:12px 14px;border:0;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;';
    const chs = (channels || []).map(function (c, i) {
      return '<button data-i="' + i + '" style="' + btn + 'background:' + (dark ? '#374151' : '#eef2ff') + ';color:' + (dark ? '#e5e7eb' : '#3730a3') + '">📢 ' + esc(c.title) + (c.url ? '' : ' (havola yo\'q)') + '</button>';
    }).join('');
    el.innerHTML = '<div style="' + card + '">' +
      '<div style="font-size:42px;margin-bottom:6px">🔒</div>' +
      '<div style="font-size:18px;font-weight:700;margin-bottom:6px">Avval obuna bo\'ling</div>' +
      '<div style="font-size:14px;opacity:.8;margin-bottom:10px;line-height:1.45">Testlardan foydalanish uchun quyidagi kanallarga a\'zo bo\'ling, so\'ng «Tekshirish» tugmasini bosing.</div>' +
      chs +
      '<button id="fj-check" style="' + btn + 'background:#2563eb;color:#fff;margin-top:14px">✅ Obuna bo\'ldim — tekshirish</button>' +
      '<div id="fj-msg" style="font-size:13px;color:#dc2626;min-height:18px;margin-top:4px"></div></div>';
    document.body.appendChild(el);
    el.querySelectorAll('button[data-i]').forEach(function (b) {
      b.onclick = function () { const c = channels[+b.getAttribute('data-i')]; if (c && c.url) openLink(c.url); };
    });
    el.querySelector('#fj-check').onclick = async function () {
      const b = this, msg = el.querySelector('#fj-msg');
      b.disabled = true; b.textContent = '⏳ Tekshirilmoqda...';
      const r = await check(_uid, true);
      if (r.ok) { try { sessionStorage.removeItem('tp_fj_' + _uid); } catch (e) {} hide(); location.reload(); return; }
      b.disabled = false; b.textContent = '✅ Obuna bo\'ldim — tekshirish';
      msg.textContent = 'Hali hamma kanalga a\'zo emassiz. Obuna bo\'lib, qayta urinib ko\'ring.';
    };
  }

  /** Sahifa ochilganda chaqiriladi. true — ruxsat; false — oyna ko'rsatildi. 60 soniya keshlanadi. */
  async function gate(uid) {
    if (uid) _uid = String(uid);
    const key = 'tp_fj_' + _uid;
    try { const t = +sessionStorage.getItem(key); if (t && Date.now() - t < 60000) return true; } catch (e) {}
    const r = await check(_uid, false);
    if (r.ok) { try { sessionStorage.setItem(key, String(Date.now())); } catch (e) {} return true; }
    show(r.channels);
    return false;
  }

  window.FJ = { check: check, show: show, hide: hide, gate: gate, setUid: function (u) { _uid = String(u || ''); } };
})();
