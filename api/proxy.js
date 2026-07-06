/**
 * TestPro — Vercel Edge Proxy (Supabase Edition, REST/fetch asosida)
 * ================================================================
 * MUHIM TUZATISH: bu versiya @supabase/supabase-js kutubxonasini
 * ISHLATMAYDI. Sabab: o'sha kutubxona ichida Realtime (WebSocket)
 * moduli bor, u Vercel Edge Runtime'da (to'liq Node.js emas,
 * cheklangan V8 muhit) ishlamaydi va "Error: internal error" kabi
 * noaniq xatoga olib keladi.
 *
 * Shu sabab bu yerda Supabase'ning REST API'siga (PostgREST)
 * to'g'ridan-to'g'ri fetch() orqali murojaat qilinadi — bu Edge
 * Runtime bilan 100% mos, hech qanday tashqi kutubxona kerak emas.
 *
 * Kerakli Vercel Environment Variables (.env.example ga qarang):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — Supabase ulanishi
 *   BOT_TOKEN, STORAGE_CHANNEL_ID            — faqat rasm yuklash uchun
 *   ADMIN_IDS, ADMIN_PASSWORD                — admin panel kirishi
 */

export const config = { runtime: 'edge' };

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BOT_TOKEN     = process.env.BOT_TOKEN || '';
const CHANNEL_ID    = process.env.STORAGE_CHANNEL_ID || '';
const ADMIN_IDS     = (process.env.ADMIN_IDS || '').split(',').map(s => s.trim()).filter(Boolean);
const ADMIN_PASS    = process.env.ADMIN_PASSWORD || 'admin123';
const TG            = `https://api.telegram.org/bot${BOT_TOKEN}`;
const REST          = `${SUPABASE_URL}/rest/v1`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-TG-ID',
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

// ══ Supabase REST (PostgREST) — xom fetch orqali ═══════════════
function pgHeaders(extra = {}) {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

async function pgFetch(path, opts = {}) {
  const res = await fetch(`${REST}${path}`, { ...opts, headers: pgHeaders(opts.headers) });
  if (!res.ok) {
    let detail = '';
    try { detail = await res.text(); } catch {}
    throw new Error(`Supabase ${res.status}: ${detail.slice(0, 300) || res.statusText}`);
  }
  return res;
}

const db = {
  /** filters: {col: value} → col=eq.value. columns: "a,b,c" yoki "*" */
  async select(table, { columns = '*', filters = {}, limit = null, order = null } = {}) {
    const qs = new URLSearchParams();
    qs.set('select', columns);
    for (const [k, v] of Object.entries(filters)) qs.set(k, `eq.${v}`);
    if (limit) qs.set('limit', String(limit));
    if (order) qs.set('order', order);
    const res = await pgFetch(`/${table}?${qs.toString()}`);
    return res.json();
  },
  async selectOne(table, filters, columns = '*') {
    const rows = await db.select(table, { columns, filters, limit: 1 });
    return rows[0] || null;
  },
  async insert(table, row) {
    const res = await pgFetch(`/${table}`, {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(row),
    });
    const data = await res.json();
    return data[0];
  },
  async update(table, filters, patch) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) qs.set(k, `eq.${v}`);
    const res = await pgFetch(`/${table}?${qs.toString()}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(patch),
    });
    return res.json();
  },
  async upsert(table, row, onConflict) {
    const qs = onConflict ? `?on_conflict=${onConflict}` : '';
    const res = await pgFetch(`/${table}${qs}`, {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(row),
    });
    return res.json();
  },
  async delete(table, filters) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) qs.set(k, `eq.${v}`);
    await pgFetch(`/${table}?${qs.toString()}`, { method: 'DELETE' });
    return true;
  },
  /** Content-Range header orqali aniq sonini o'qiydi (jadval bo'ylab HEAD so'rov) */
  async count(table, filters = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) qs.set(k, `eq.${v}`);
    qs.set('select', 'test_id');
    const res = await fetch(`${REST}/${table}?${qs.toString()}`, {
      method: 'HEAD',
      headers: pgHeaders({ Prefer: 'count=exact' }),
    });
    if (!res.ok) return null;
    const range = res.headers.get('content-range'); // masalan "0-0/123"
    if (!range) return null;
    const total = range.split('/')[1];
    return total === '*' ? null : parseInt(total, 10);
  },
};

// ══ FORMAT KONVERTATSIYA (bot <-> web savol formati) ═══════════
function webToBot(q) {
  const opts   = (q.options || []).map(String);
  const labels = ['A','B','C','D','E','F','G','H'];
  const fmtOpts = opts.map((o, i) => {
    const lbl = labels[i] || String.fromCharCode(65 + i);
    return /^[A-H]\s*[).]/.test(o) ? o : `${lbl}) ${o}`;
  });
  let correctStr = '';
  if (typeof q.correct === 'number') {
    correctStr = fmtOpts[q.correct] || fmtOpts[0] || '';
  } else if (typeof q.correct === 'string') {
    correctStr = q.correct;
  }
  const typeMap = { multiple: 'multiple_choice', truefalse: 'true_false', 'true_false': 'true_false', multiple_choice: 'multiple_choice' };
  const photoId = q.photo || q.image || null;
  const result = {
    type:        typeMap[q.type] || q.type || 'multiple_choice',
    question:    q.question || q.text || '',
    options:     fmtOpts,
    correct:     correctStr,
    explanation: q.explanation || '',
    points:      q.points || 1,
    poll_time:   q.poll_time || 30,
  };
  if (photoId && !photoId.startsWith('data:')) {
    result.photo = photoId;
  }
  return result;
}

function botToWeb(q, idx) {
  const opts = (q.options || []).map(String);
  const typeMap = { multiple_choice: 'multiple', true_false: 'truefalse', truefalse: 'truefalse', multiple: 'multiple' };
  let correctIdx = 0;
  if (typeof q.correct === 'number') {
    correctIdx = q.correct;
  } else if (typeof q.correct === 'string') {
    const m = q.correct.match(/^([A-H])\s*[).]/i);
    if (m) {
      correctIdx = m[1].toUpperCase().charCodeAt(0) - 65;
    } else {
      const ci = opts.findIndex(o => o === q.correct || o.includes(q.correct) || q.correct.includes(o.replace(/^[A-H][).] */, '')));
      correctIdx = ci >= 0 ? ci : 0;
    }
  }
  return {
    type:        typeMap[q.type] || q.type || 'multiple',
    text:        q.text || q.question || '',
    question:    q.text || q.question || '',
    options:     opts,
    correct:     correctIdx,
    explanation: q.explanation || '',
    points:      q.points || 1,
    poll_time:   q.poll_time || 30,
    photo:       q.photo || null,
    image:       q.image || null,
  };
}

function normMeta(t) {
  const out = { ...t };
  delete out.questions;
  out.id              = out.id             || out.test_id;
  out.test_id         = out.test_id        || out.id;
  out.authorId        = out.authorId       || String(out.creator_id || '');
  out.subject         = out.subject        || out.category  || 'other';
  out.category        = out.category       || out.subject   || 'other';
  out.creator_name    = out.creator_name   || out.authorName || '';
  out.is_active       = out.is_active      !== false;
  out.is_paused       = out.is_paused      || false;
  out.question_count  = out.question_count || out.questionCount || 0;
  out.passing_score   = parseInt(out.passing_score || out.passScore || 60);
  out.time_limit      = parseInt(out.time_limit    || out.timeLimit  || 0);
  out.max_attempts    = parseInt(out.max_attempts  || 0);
  out.ref_required    = !!(out.ref_required || false);
  out.ref_count       = parseInt(out.ref_count || 0);
  out.shuffle_questions = !!(out.shuffle_questions || out.shuffleQuestions || false);
  return out;
}

function rowToFull(row) {
  const full = { ...(row.meta || {}) };
  full.test_id        = row.test_id;
  full.title           = row.title || full.title || '';
  full.questions        = row.questions || [];
  full.question_count   = row.question_count ?? full.questions.length;
  full.is_active       = row.is_active ?? true;
  full.is_paused       = row.is_paused ?? false;
  full.solve_count      = row.solve_count ?? 0;
  full.avg_score        = Number(row.avg_score || 0);
  return full;
}
function rowToMeta(row) {
  const f = rowToFull(row);
  delete f.questions;
  return f;
}

// ── Rasm — Telegramni bepul CDN sifatida ishlatamiz ─────────────
async function tgPost(method, body) {
  const res = await fetch(`${TG}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}
async function getPhotoUrl(fileId) {
  if (!fileId || typeof fileId !== 'string') return null;
  try {
    const f = await tgPost('getFile', { file_id: fileId });
    const p = f?.result?.file_path;
    if (!p) return null;
    return `https://api.telegram.org/file/bot${BOT_TOKEN}/${p}`;
  } catch { return null; }
}

// ════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════
export default async function handler(request) {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(request.url);
  const ep  = url.searchParams.get('endpoint') || '';

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    if (ep !== 'config' && ep !== 'debug') {
      return jsonResp({ error: 'Supabase sozlanmagan (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)' }, 500);
    }
  }

  let body = null;
  if (request.method === 'POST') {
    try { body = await request.json(); } catch {}
  }

  try {
    // ── config ──────────────────────────────────────────────────
    if (ep === 'config') {
      return jsonResp({ backend: 'supabase-rest', ok: true });
    }

    // ── debug ───────────────────────────────────────────────────
    if (ep === 'debug') {
      let testsCount = null, err = null;
      if (SUPABASE_URL && SUPABASE_KEY) {
        try { testsCount = await db.count('tests'); }
        catch (e) { err = String(e?.message || e); }
      }
      return jsonResp({
        supabase_url_set: !!SUPABASE_URL,
        supabase_key_set: !!SUPABASE_KEY,
        bot_token_set:    !!BOT_TOKEN,
        tests_count:      testsCount,
        error:            err,
      });
    }

    // ── tests/public ────────────────────────────────────────────
    if (ep === 'tests/public') {
      const data = await db.select('tests', {
        columns: 'test_id,title,meta,question_count,is_active,is_paused,solve_count,avg_score',
        filters: { is_active: true, is_paused: false },
      });
      const metas = (data || [])
        .map(rowToMeta)
        .filter(t => !t.is_deleted && (t.visibility || 'public') === 'public')
        .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return jsonResp(metas);
    }

    // ── tests/my ────────────────────────────────────────────────
    if (ep === 'tests/my') {
      const uid = url.searchParams.get('uid') || '';
      const data = await db.select('tests', {
        columns: 'test_id,title,meta,question_count,is_active,is_paused,solve_count,avg_score',
      });
      const mine = (data || [])
        .map(rowToMeta)
        .filter(t => !t.is_deleted && String(t.creator_id) === uid);
      return jsonResp(mine);
    }

    // ── test/{id}/full ──────────────────────────────────────────
    if (ep.match(/^test\/[^/]+\/full$/)) {
      const tid = ep.split('/')[1];
      const data = await db.selectOne('tests', { test_id: tid });
      if (!data || data.meta?.is_deleted) return jsonResp({ error: `Test topilmadi: ${tid}` }, 404);
      const full  = rowToFull(data);
      const webQs = (full.questions || []).map((q, i) => botToWeb(q, i));
      const t = normMeta(full);
      t.id = t.id || tid; t.test_id = t.test_id || tid;
      return jsonResp({ testData: t, questions: webQs, total: webQs.length });
    }

    // ── test/{id}/meta ──────────────────────────────────────────
    if (ep.match(/^test\/[^/]+\/meta$/)) {
      const tid = ep.split('/')[1];
      const data = await db.selectOne('tests', { test_id: tid },
        'test_id,title,meta,question_count,is_active,is_paused,solve_count,avg_score');
      if (!data || data.meta?.is_deleted) return jsonResp({ error: 'Topilmadi' }, 404);
      return jsonResp(rowToMeta(data));
    }

    // ── test/{id} (yalang'och GET) ──────────────────────────────
    if (ep.match(/^test\/[^/]+$/) && request.method === 'GET') {
      const tid = ep.split('/')[1];
      const data = await db.selectOne('tests', { test_id: tid },
        'test_id,title,meta,question_count,is_active,is_paused,solve_count,avg_score');
      if (!data || data.meta?.is_deleted) return jsonResp({ error: 'Topilmadi' }, 404);
      return jsonResp(rowToMeta(data));
    }

    // ── test/{id}/questions (GET) ───────────────────────────────
    if (ep.match(/^test\/[^/]+\/questions$/) && request.method === 'GET') {
      const tid = ep.split('/')[1];
      const data = await db.selectOne('tests', { test_id: tid }, 'questions');
      if (!data) return jsonResp([]);
      return jsonResp((data.questions || []).map((q, i) => botToWeb(q, i)));
    }

    // ── test/{id}/questions (POST) — savollarni saqlash ─────────
    if (ep.match(/^test\/[^/]+\/questions$/) && request.method === 'POST') {
      const tid = ep.split('/')[1];
      const old = await db.selectOne('tests', { test_id: tid });
      if (!old) return jsonResp({ error: 'Test topilmadi' }, 404);
      const questions = (body?.questions || []).map(q => webToBot(q));
      await db.update('tests', { test_id: tid }, {
        questions,
        question_count: questions.length,
      });
      return jsonResp({ ok: true, question_count: questions.length, old_count: (old.questions || []).length });
    }

    // ── test/{id}/update — meta yangilash ───────────────────────
    if (ep.match(/^test\/[^/]+\/update$/) && request.method === 'POST') {
      const tid = ep.split('/')[1];
      const old = await db.selectOne('tests', { test_id: tid }, 'meta,is_active');
      if (!old) return jsonResp({ error: 'Test topilmadi' }, 404);

      const allowedMeta = ['title','category','subject','difficulty','visibility','time_limit',
                            'poll_time','passing_score','max_attempts','shuffle_questions',
                            'show_result','ref_required','ref_count'];
      const metaPatch = {};
      for (const k of allowedMeta) {
        if (body && k in body) metaPatch[k] = body[k];
      }
      const newMeta = { ...(old.meta || {}), ...metaPatch };

      const topPatch = {};
      if (body && 'title' in body)      topPatch.title      = body.title;
      if (body && 'is_active' in body)  topPatch.is_active  = !!body.is_active;
      if (body && 'is_paused' in body)  topPatch.is_paused  = !!body.is_paused;

      await db.update('tests', { test_id: tid }, { meta: newMeta, ...topPatch });
      return jsonResp({ ok: true, updates: { ...metaPatch, ...topPatch } });
    }

    // ── test/{id}/delete — YARATUVCHI o'chirishi (SOFT DELETE) ──
    if (ep.match(/^test\/[^/]+\/delete$/) && request.method === 'POST') {
      const tid = ep.split('/')[1];
      const old = await db.selectOne('tests', { test_id: tid }, 'meta');
      if (!old) return jsonResp({ error: 'Test topilmadi' }, 404);
      const newMeta = { ...(old.meta || {}), is_deleted: true };
      await db.update('tests', { test_id: tid }, { meta: newMeta });
      return jsonResp({ ok: true, deleted: tid, soft: true });
    }

    // ── test/{id}/split — testni bo'laklarga bo'lish ────────────
    if (ep.match(/^test\/[^/]+\/split$/) && request.method === 'POST') {
      const tid = ep.split('/')[1];
      const row = await db.selectOne('tests', { test_id: tid });
      if (!row) return jsonResp({ error: 'Test topilmadi' }, 404);
      const full = rowToFull(row);
      if (!full.questions?.length) return jsonResp({ error: 'Savollar topilmadi' }, 404);

      let parts = body?.parts;
      if (!parts || !parts.length) {
        const mid = Math.ceil(full.questions.length / 2);
        parts = [{ from: 1, to: mid }, { from: mid + 1, to: full.questions.length }];
      }

      const D = {'0':'0️⃣','1':'1️⃣','2':'2️⃣','3':'3️⃣','4':'4️⃣','5':'5️⃣','6':'6️⃣','7':'7️⃣','8':'8️⃣','9':'9️⃣'};
      function numEmoji(n) {
        if (n === 10) return '🔟';
        if (n === 100) return '💯';
        return String(n).split('').map(c => D[c] || c).join('');
      }

      const created = [];
      for (const p of parts) {
        const chunk = full.questions.slice(p.from - 1, p.to);
        if (!chunk.length) continue;
        const partTitle = `${full.title || tid} ${numEmoji(p.from)}➖${numEmoji(p.to)}`;
        const newTid = Array.from(crypto.getRandomValues(new Uint8Array(4)))
          .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

        const newMeta = { ...(row.meta || {}) };
        delete newMeta.is_deleted;
        newMeta.title  = partTitle;
        newMeta.source = 'web_split';

        try {
          await db.insert('tests', {
            test_id:        newTid,
            title:          partTitle,
            meta:           newMeta,
            questions:      chunk,
            question_count: chunk.length,
            is_active:      true,
            is_paused:      false,
            solve_count:    0,
            avg_score:      0,
          });
          created.push({ tid: newTid, title: partTitle, count: chunk.length });
        } catch { continue; }
      }

      if (!created.length) return jsonResp({ error: "Hech qaysi qism saqlanmadi" }, 500);
      return jsonResp({ ok: true, created, parts: created });
    }

    // ── test/create ─────────────────────────────────────────────
    if (ep === 'test/create' && request.method === 'POST') {
      const { authorId, title, description, subject, category, visibility,
              timeLimit, passScore, shuffleQuestions, showResult, questionCount,
              authorName, questions, difficulty, poll_time, max_attempts } = body || {};
      if (!title) return jsonResp({ error: 'Title kerak' }, 400);
      const tid = Array.from(crypto.getRandomValues(new Uint8Array(4)))
        .map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase();

      const qs = (questions || []).map(q => webToBot(q));
      const meta = {
        creator_id:       parseInt(authorId) || 0,
        creator_name:     authorName || '',
        category:         category || subject || 'Boshqa',
        subject:          subject || category || 'Boshqa',
        difficulty:       difficulty || 'medium',
        visibility:       visibility || 'public',
        time_limit:       parseInt(timeLimit) || 0,
        poll_time:        parseInt(poll_time) || 30,
        passing_score:    parseInt(passScore) || 60,
        max_attempts:     parseInt(max_attempts) || 0,
        description:      description || '',
        shuffle_questions: !!shuffleQuestions,
        show_result:      showResult !== false,
        source:           'web',
        created_at:       new Date().toISOString(),
      };

      await db.insert('tests', {
        test_id:        tid,
        title:          title || 'Nomsiz',
        meta,
        questions:      qs,
        question_count: qs.length || parseInt(questionCount) || 0,
        is_active:      true,
        is_paused:      false,
        solve_count:    0,
        avg_score:      0,
      });
      return jsonResp({ ok: true, id: tid, test_id: tid });
    }

    // ── user/{uid} ──────────────────────────────────────────────
    if (ep.startsWith('user/') && ep.split('/').length === 2) {
      const uid = ep.split('/')[1];
      if (!/^\d+$/.test(uid)) return jsonResp({ error: "Noto'g'ri ID" }, 400);
      const isAdmin = ADMIN_IDS.includes(uid);
      const data = await db.selectOne('users', { tg_id: uid }, 'tg_id,is_blocked,data');
      const d = data?.data || {};
      return jsonResp({
        id: uid, uid,
        name:       d.name || d.first_name || `User${uid}`,
        username:   d.username || '',
        is_blocked: data?.is_blocked || false,
        is_admin:   isAdmin || d.role === 'admin',
        role:       isAdmin || d.role === 'admin' ? 'admin' : (d.role || 'user'),
      });
    }

    // ── admin/login ─────────────────────────────────────────────
    if (ep === 'admin/login') {
      if (!ADMIN_IDS.includes(String(body?.uid))) return jsonResp({ ok: false, error: 'Admin emassiz' });
      if (body?.password !== ADMIN_PASS)          return jsonResp({ ok: false, error: "Parol noto'g'ri" });
      return jsonResp({ ok: true });
    }

    // ── admin/tests ─────────────────────────────────────────────
    if (ep === 'admin/tests') {
      const data = await db.select('tests', {
        columns: 'test_id,title,meta,question_count,is_active,is_paused,solve_count,avg_score',
      });
      return jsonResp((data || []).map(rowToMeta));
    }

    // ── admin/stats ─────────────────────────────────────────────
    if (ep === 'admin/stats') {
      const data = await db.select('tests', {
        columns: 'test_id,title,meta,question_count,is_active,is_paused,solve_count,avg_score,created_at',
      });
      const tests  = (data || []).map(rowToMeta).filter(t => !t.is_deleted);
      const active = tests.filter(t => t.is_active !== false);
      const pub    = active.filter(t => t.visibility === 'public');
      const totalSolve = tests.reduce((s, t) => s + (t.solve_count || 0), 0);
      const scored = tests.filter(t => t.avg_score);
      const avgScore = scored.length ? Math.round(scored.reduce((s,t) => s+t.avg_score, 0) / scored.length) : 0;
      const byCategory = {};
      tests.forEach(t => {
        const cat = t.category || t.subject || 'other';
        if (!byCategory[cat]) byCategory[cat] = { count: 0, solves: 0, avg: [] };
        byCategory[cat].count++; byCategory[cat].solves += t.solve_count || 0;
        if (t.avg_score) byCategory[cat].avg.push(t.avg_score);
      });
      const categories = Object.entries(byCategory).map(([name, d]) => ({
        name, count: d.count, solves: d.solves,
        avg: d.avg.length ? Math.round(d.avg.reduce((a,b)=>a+b)/d.avg.length) : 0,
      })).sort((a,b) => b.solves - a.solves);
      const now   = Date.now();
      const days7 = Array.from({length:7},(_,i) => new Date(now-i*86400000).toISOString().slice(0,10)).reverse();
      const byDay = {}; days7.forEach(d => { byDay[d] = {created:0,solves:0}; });
      tests.forEach(t => { const d=(t.created_at||'').slice(0,10); if(byDay[d]){byDay[d].created++;byDay[d].solves+=t.solve_count||0;} });
      return jsonResp({
        totalTests: tests.length, activeTests: active.length, pubTests: pub.length,
        totalSolve, avgScore, categories,
        topTests: [...active].sort((a,b)=>(b.solve_count||0)-(a.solve_count||0)).slice(0,5),
        timeline: days7.map(d=>({date:d,...byDay[d]})),
      });
    }

    // ── admin/test/{id}/pause ───────────────────────────────────
    if (ep.match(/^admin\/test\/.+\/pause$/)) {
      const tid = ep.split('/')[2];
      const data = await db.selectOne('tests', { test_id: tid }, 'is_paused');
      if (!data) return jsonResp({ error: 'Topilmadi' }, 404);
      const newVal = !data.is_paused;
      await db.update('tests', { test_id: tid }, { is_paused: newVal });
      return jsonResp({ ok: true, is_paused: newVal });
    }

    // ── admin/test/{id}/delete — SOFT DELETE ────────────────────
    if (ep.match(/^admin\/test\/.+\/delete$/)) {
      const tid = ep.split('/')[2];
      const data = await db.selectOne('tests', { test_id: tid }, 'meta');
      if (!data) return jsonResp({ error: 'Topilmadi' }, 404);
      const newMeta = { ...(data.meta || {}), is_deleted: true };
      await db.update('tests', { test_id: tid }, { meta: newMeta });
      return jsonResp({ ok: true, soft: true });
    }

    // ── result/save ─────────────────────────────────────────────
    if (ep === 'result/save' && request.method === 'POST') {
      const {
        userId, user_id, testId, testTitle, subject,
        userName, user_name, userUsername, user_username,
        score, correct, total, percentage, passing_score, passed,
        elapsed, detailed_results, userAnswers, completedAt, source
      } = body || {};

      const finalUid = String(userId || user_id || '0');
      if (!finalUid || finalUid === '0' || !testId) {
        return jsonResp({ error: 'userId va testId kerak' });
      }
      const pct = parseFloat(percentage ?? score ?? 0);
      const rid = `${finalUid}_${testId}_${Date.now()}`;

      await db.insert('results', {
        result_id:        rid,
        user_id:          finalUid,
        user_name:        userName || user_name || ('User' + finalUid),
        user_username:    userUsername || user_username || '',
        test_id:          testId,
        test_title:       testTitle || testId,
        subject:          subject || '',
        source:           source || 'web',
        score:            parseFloat(score ?? pct ?? 0),
        correct:          parseInt(correct || 0),
        total:            parseInt(total || 0),
        percentage:       pct,
        passing_score:    parseFloat(passing_score || 60),
        passed:           passed ?? (pct >= parseFloat(passing_score || 60)),
        elapsed:          parseInt(elapsed || 0),
        detailed_results: detailed_results || userAnswers || [],
        completed_at:     completedAt || new Date().toISOString(),
      });

      const t = await db.selectOne('tests', { test_id: testId }, 'solve_count,avg_score');
      if (t) {
        const sc  = (t.solve_count || 0) + 1;
        const avg = Math.round((((t.avg_score || 0) * (sc - 1)) + pct) / sc * 10) / 10;
        await db.update('tests', { test_id: testId }, { solve_count: sc, avg_score: avg });
      }

      return jsonResp({ ok: true, result_id: rid });
    }

    // ── results/{uid} ───────────────────────────────────────────
    if (ep.match(/^results\/\d+/)) {
      const uid = ep.split('/')[1];
      const data = await db.select('results', {
        filters: { user_id: uid }, order: 'completed_at.desc', limit: 200,
      });
      return jsonResp(data || []);
    }

    // ══ LIVE MONITOR ═════════════════════════════════════════════
    if (ep === 'live/start' && request.method === 'POST') {
      const { uid, tid, title, total_q } = body || {};
      if (!uid || !tid) return jsonResp({ ok: false });
      await db.upsert('live_sessions', {
        session_id: `web_${uid}_${tid}`,
        user_id:    String(uid),
        test_id:    tid,
        test_title: title || tid,
        source:     'web',
        idx:        0,
        total_q:    total_q || 0,
        started_at: new Date().toISOString(),
        last_seen:  new Date().toISOString(),
      }, 'session_id');
      return jsonResp({ ok: true });
    }

    if (ep === 'live/update' && request.method === 'POST') {
      const { uid, tid, idx } = body || {};
      if (!uid || !tid) return jsonResp({ ok: false });
      await db.update('live_sessions', { session_id: `web_${uid}_${tid}` }, {
        idx: idx || 0,
        last_seen: new Date().toISOString(),
      });
      return jsonResp({ ok: true });
    }

    if (ep === 'live/end' && request.method === 'POST') {
      const { uid, tid } = body || {};
      if (uid && tid) {
        await db.delete('live_sessions', { session_id: `web_${uid}_${tid}` });
      }
      return jsonResp({ ok: true });
    }

    // ── photo/upload ────────────────────────────────────────────
    if (ep === 'photo/upload' && request.method === 'POST') {
      const { image_b64, filename } = body || {};
      if (!image_b64) return jsonResp({ error: 'image_b64 kerak' }, 400);
      const b64data = image_b64.replace(/^data:image\/\w+;base64,/, '');
      const mime    = image_b64.startsWith('data:image/png') ? 'image/png'
                    : image_b64.startsWith('data:image/gif') ? 'image/gif'
                    : 'image/jpeg';
      const ext  = mime.split('/')[1];
      const name = filename || ('photo_' + Date.now() + '.' + ext);
      const binaryStr = atob(b64data);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: mime });
      const form = new FormData();
      form.append('chat_id', CHANNEL_ID);
      form.append('photo', blob, name);
      form.append('disable_notification', 'true');
      const res  = await fetch(`${TG}/sendPhoto`, { method: 'POST', body: form });
      const data = await res.json();
      if (!data?.ok) return jsonResp({ error: 'TG xato: ' + (data?.description || JSON.stringify(data)) }, 500);
      const photos  = data.result.photo || [];
      const biggest = photos[photos.length - 1];
      return jsonResp({ ok: true, file_id: biggest?.file_id || '', message_id: data.result.message_id });
    }

    // ── photo/url ───────────────────────────────────────────────
    if (ep === 'photo/url' && request.method === 'POST') {
      const { file_id } = body || {};
      if (!file_id) return jsonResp({ error: 'file_id kerak' }, 400);
      const purl = await getPhotoUrl(file_id);
      if (!purl) return jsonResp({ error: 'URL topilmadi' }, 404);
      return jsonResp({ ok: true, url: purl });
    }

    // ── photo/stream ────────────────────────────────────────────
    if (ep === 'photo/stream') {
      const fid = url.searchParams.get('fid');
      if (!fid) return new Response('fid kerak', { status: 400 });
      const purl = await getPhotoUrl(fid);
      if (!purl) return new Response('Topilmadi', { status: 404 });
      return Response.redirect(purl, 302);
    }

    // ── otp/verify ──────────────────────────────────────────────
    if (ep === 'otp/verify') {
      const code = (body?.code || '').toUpperCase().trim();
      if (!code) return jsonResp({ ok: false, error: 'Kod kerak' });
      const parts = code.split(':');
      if (parts.length !== 3) return jsonResp({ ok: false, error: "Noto'g'ri format" });
      const [testId, ts, hash] = parts;
      if (Date.now() - parseInt(ts) > 600_000) return jsonResp({ ok: false, error: 'Muddati tugagan' });
      const buf = new TextEncoder().encode(`${testId}:${ts}:${BOT_TOKEN.slice(-8)}`);
      const hb  = await crypto.subtle.digest('SHA-256', buf);
      const exp = Array.from(new Uint8Array(hb)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,8).toUpperCase();
      if (exp !== hash) return jsonResp({ ok: false, error: "Noto'g'ri kod" });
      const data = await db.selectOne('tests', { test_id: testId },
        'test_id,title,meta,question_count,is_active,is_paused,solve_count,avg_score');
      return jsonResp({ ok: true, test_id: testId, meta: data ? rowToMeta(data) : {} });
    }

    return jsonResp({ error: "Noma'lum endpoint" }, 404);

  } catch (e) {
    // Har qanday kutilmagan xato endi ANIQ matn bilan qaytadi —
    // "internal error" kabi noaniq xabar YO'Q.
    return jsonResp({ error: String(e?.message || e) }, 500);
  }
}
