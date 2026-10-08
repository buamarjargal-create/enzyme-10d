/* ENZYME — багшийн самбар (4 шат, бодит цаг) */
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
var qsa = function (sel, el) { return Array.prototype.slice.call((el || document).querySelectorAll(sel)); };

/* ---------- төлөв ---------- */
var ST = null, OFF = 0, TAB = 'live', sock = null, poll = null, entered = false, sigs = {}, modalKind = null, ansTimer = null;
var qf = { stage: '', type: '', txt: '' }, ui = { prev: false, nav: false };
var CHAT = { 1: [], 2: [], 3: [], 4: [] }, chatOpen = false, chatTeam = 1, chatAll = false, seen = { 1: 0, 2: 0, 3: 0, 4: 0 };
try { var _t = localStorage.getItem('enzT_tab'); if (_t) TAB = _t; var _s = JSON.parse(localStorage.getItem('enzT_seen') || 'null'); if (_s) seen = _s; } catch (e) {}

var KINDS = { q: ['ind', 'rev'], write: ['team'], peer: ['peer', 'rev'], duel: ['ind', 'team', 'rev'], final: ['team', 'rev'] };
var PHL = { ind: 'Хувийн хариулт', team: 'Багийн хэлэлцүүлэг', peer: 'Өөр багийг үнэлэх', rev: 'Үр дүн, тайлбар' };
var KINDL = { q: 'Асуулт', write: 'Багийн хариулт бичих', peer: 'Бусдын хариултыг шалгах', duel: 'Ферментийн тулаан', final: 'Эцсийн сорил' };
var TYPEL = { mcq: 'Нэг сонголт', multi: 'Олон сонголт', tf: 'Үнэн / Худал', order: 'Дараалал', match: 'Тааруулах', short: 'Богино хариулт' };
var RATEL = { ok: '✅ Зөв', partial: '🟡 Хэсэгчлэн', wrong: '❌ Буруу' };
var ABC = 'АБВГДЕЖЗ';
var ICON = {
  live: '<path d="M3 12h4l2.5-6 4 12 2.5-6H21"/>',
  questions: '<rect x="4" y="3.5" width="16" height="17" rx="4"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  students: '<circle cx="9" cy="8.5" r="3.2"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><circle cx="16.8" cy="9.5" r="2.4"/><path d="M15.8 14.2c2.4.1 4.1 1.7 4.7 4.3"/>',
  results: '<path d="M5 20V12M10 20V6M15 20v-9M20 20V9"/>',
  disc: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  chat: '<path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z"/><path d="M8.5 9.5h7M8.5 12.5h4"/>',
  proj: '<rect x="3" y="5" width="18" height="11" rx="2.5"/><path d="M12 16v3M8 20h8"/>',
  out: '<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14M10 8l-4 4 4 4M6 12h9"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>'
};
var ico = function (n, sz) { return '<svg class="ico" width="' + (sz || 20) + '" height="' + (sz || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON[n] + '</svg>'; };
var TABS = [['live', 'Шууд явц'], ['questions', 'Асуултууд'], ['students', 'Сурагч · Баг'], ['results', 'Дүн'], ['disc', 'Ярилцлага'], ['settings', 'Тохиргоо']];
var TABICON = { live: 'live', questions: 'questions', students: 'students', results: 'results', disc: 'disc', settings: 'settings' };

/* ---------- туслах ---------- */
function post(u, b) { return api(u, { body: b || {} }).then(function (j) { if (!j.ok) { if (j._status === 401) { showLogin(); toast('Нэвтрэлт дууссан. Дахин нэвтэрнэ үү.', 'bad'); } else toast(j.err || 'Алдаа гарлаа.', 'bad'); } return j; }).catch(function () { toast('Сүлжээний алдаа. Дахин оролдоно уу.', 'bad'); return { ok: false }; }); }
function get(u) { return api(u); }
function tname(t) { return (ST && ST.settings.teams[t - 1] && ST.settings.teams[t - 1].name) || ('Баг ' + t); }
function tcol(t) { return TEAMCOL[t] || CH.lilac; }
function areaName(a) { return (ST && ST.settings.areas && ST.settings.areas[a]) || ''; }
function stageOf(n) { return (ST && ST.stages && ST.stages[n - 1]) || { name: 'Шат ' + n, icon: '', title: '', desc: '' }; }
function qById(id) { return ST ? ST.questions.filter(function (q) { return q.id === id; })[0] : null; }
function hhmm(t) { var d = new Date(t); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
function hhmmss(t) { var d = new Date(t); return hhmm(t) + ':' + ('0' + d.getSeconds()).slice(-2); }
function mmss(sec) { sec = Math.round(sec); var m = Math.floor(sec / 60), s = sec % 60; return m + ' мин' + (s ? ' ' + s + ' сек' : ''); }
function teamTag(t) { return '<span class="ttag" style="--tc:' + tcol(t) + '">' + esc(tname(t)) + '</span>'; }
function store(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
function remaining() { var t = ST.t; if (t.phase !== 'live') return 0; return t.paused ? (t.left || 0) : Math.max(0, (t.endsAt || 0) - (Date.now() + OFF)); }
function curStep() { return ST && ST.t.phase === 'live' ? ST.script[ST.t.step] : null; }

/* сигнатурт суурилсан дахин зурах: фокустай болон засагдсан (dirty) талбарын утгыг хадгална */
function paint(el, key, sig, fn) {
  if (!el) return; if (sigs[key] === sig) return;
  var ae = document.activeElement;
  if (sigs[key] !== undefined && ae && el.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.type !== 'checkbox') return;
  var keep = {}; qsa('[data-k]', el).forEach(function (n) { if (n.dataset.dirty) keep[n.dataset.k] = n.type === 'checkbox' ? n.checked : n.value; });
  var sc = el.scrollTop; sigs[key] = sig; el.innerHTML = fn(); el.scrollTop = sc;
  Object.keys(keep).forEach(function (k) { var n = el.querySelector('[data-k="' + k + '"]'); if (n) { if (n.type === 'checkbox') n.checked = keep[k]; else n.value = keep[k]; n.dataset.dirty = '1'; } });
}
document.addEventListener('input', function (ev) { var n = ev.target; if (n && n.dataset && n.dataset.k) n.dataset.dirty = '1'; });
document.addEventListener('change', function (ev) { var n = ev.target; if (n && n.dataset && n.dataset.k) n.dataset.dirty = '1'; });

/* ---------- нэвтрэх ---------- */
function showLogin(user) {
  $('app').classList.add('hide'); $('login').classList.remove('hide'); closeModal();
  if (poll) { clearInterval(poll); poll = null; }
  if (user && !$('lu').value) $('lu').value = user; setTimeout(function () { ($('lu').value ? $('lp') : $('lu')).focus(); }, 50);
}
api('/api/teacher/me').then(function (j) { if (j.ok) enter(); else showLogin(j.user); }).catch(function () { showLogin(); });
$('loginForm').addEventListener('submit', function (ev) {
  ev.preventDefault(); var b = $('lbtn'); if (b.classList.contains('busy')) return; b.classList.add('busy'); $('lerr').classList.add('hide');
  api('/api/teacher/login', { body: { username: $('lu').value, password: $('lp').value } }).then(function (j) {
    b.classList.remove('busy');
    if (!j.ok) { $('lerr').textContent = j.err || 'Нэвтэрч чадсангүй.'; $('lerr').classList.remove('hide'); return; }
    $('lp').value = ''; toast('Амжилттай нэвтэрлээ.', 'ok'); enter(true);
  }).catch(function () { b.classList.remove('busy'); $('lerr').textContent = 'Сүлжээний алдаа. Дахин оролдоно уу.'; $('lerr').classList.remove('hide'); });
});

function connect() {
  return connectWS(function () { return 'role=teacher'; }, {
    open: function () { $('conn').classList.add('hide'); if (poll) { clearInterval(poll); poll = null; } },
    close: function () { if (!entered) return; $('conn').classList.remove('hide'); if (!poll) poll = setInterval(refresh, 3000); },
    denied: function () { sock = null; showLogin(); },
    msg: function (e, d) { if (e === 'tstate') apply(d); else if (e === 'chat') onChat(d); }
  });
}
function refresh() {
  get('/api/t/state').then(function (j) {
    if (j._status === 401) { showLogin(); return; }
    if (j.ok) { apply(j.state); if (poll) $('conn').classList.add('hide'); }
  }).catch(function () { $('conn').classList.remove('hide'); });
}
function enter(relogin) {
  $('login').classList.add('hide'); $('app').classList.remove('hide');
  if (!entered) {
    entered = true; buildStatic();
    setInterval(tickTimer, 250);
  }
  if (!sock || relogin) { try { sock && sock.close(); } catch (e) {} sock = connect(); }
  refresh();
}

/* ---------- үндсэн бүтэц ---------- */
function buildStatic() {
  var nav = TABS.map(function (t) { return '<button class="navb" type="button" data-tab="' + t[0] + '"><span class="ni">' + ico(TABICON[t[0]]) + '</span><span class="nl">' + t[1] + '</span></button>'; }).join('');
  $('side').innerHTML = '<div class="sbrand"><span class="sdna">' + dna(30) + '</span><div><b>ENZYME</b><small id="sideCls"></small></div></div>' +
    '<div class="slabel">ҮНДСЭН ЦЭС</div><div class="snav">' + nav + '</div>' +
    '<div class="sstk">' + stk('lab', 74, 'float') + '</div>' +
    '<div class="sfoot"><a class="navb" href="/projector" target="_blank" rel="noopener"><span class="ni">' + ico('proj') + '</span><span class="nl">Проектор нээх</span></a>' +
    '<button class="navb" type="button" data-a="logout"><span class="ni">' + ico('out') + '</span><span class="nl">Гарах</span></button></div>';
  $('side').addEventListener('click', function (ev) { var b = ev.target.closest('[data-tab]'); if (!b) return; setTab(b.dataset.tab); ui.nav = false; renderMbar(); document.body.classList.remove('navopen'); });
  $('chatFab').addEventListener('click', function () { toggleChat(!chatOpen); });
  buildDrawer();
}
function setTab(t) { if (!TABS.some(function (x) { return x[0] === t; })) t = 'live'; TAB = t; store('enzT_tab', t); sigs = {}; $('main').dataset.tab = ''; renderAll(); window.scrollTo(0, 0); }

function apply(s) {
  ST = s; OFF = s.t.now - Date.now();
  if (s.chat) [1, 2, 3, 4].forEach(function (t) { CHAT[t] = (s.chat[t] || []).slice(); });
  renderAll();
}
function renderAll() {
  if (!ST) return;
  if (!TABS.some(function (x) { return x[0] === TAB; })) TAB = 'live';
  qsa('#side [data-tab]').forEach(function (b) { b.classList.toggle('on', b.dataset.tab === TAB); });
  document.body.className = document.body.className.replace(/\btab-\S+/g, '').trim() + ' tab-' + TAB;
  $('sideCls').textContent = ST.settings.className + ' · ' + ST.settings.topic;
  renderMbar(); renderHdr(); renderPath(); renderTab(); renderChat(); tickTimer();
}

/* ---------- цаг ---------- */
function timerText() { var t = ST.t; if (t.phase === 'lobby') return '--:--'; if (t.phase === 'done') return '00:00'; return fmt(remaining()); }
function tickTimer() {
  if (!ST) return; var t = ST.t, ms = remaining(), txt = timerText();
  qsa('.js-timer').forEach(function (el) {
    if (el.textContent !== txt) el.textContent = txt;
    var p = el.closest('.timer'); if (p) { p.classList.toggle('pause', !!t.paused); p.classList.toggle('low', t.phase === 'live' && !t.paused && ms < 10000); }
  });
  var bar = $('tbar'); if (bar) { var tot = (t.totalSec || 1) * 1000; bar.style.width = (t.phase === 'live' ? Math.max(0, Math.min(100, 100 - ms / tot * 100)) : t.phase === 'done' ? 100 : 0) + '%'; }
}

/* ---------- утасны дээд мөр ---------- */
function renderMbar() {
  var t = ST ? ST.t : { phase: 'lobby' }, cur = TABS.filter(function (x) { return x[0] === TAB; })[0];
  var quick = '';
  if (t.phase === 'live') quick = (t.paused ? '<button class="ibtn" data-a="resume" aria-label="Үргэлжлүүлэх">▶</button>' : '<button class="ibtn" data-a="pause" aria-label="Түр зогсоох">⏸</button>') + '<button class="ibtn" data-a="next" aria-label="Дараагийн үе">⏭</button>';
  var o = '<div class="mrow1"><span class="sdna">' + dna(26) + '</span><b class="mtitle">' + esc(cur ? cur[1] : '') + '</b><span class="sp"></span><span class="timer mini"><span class="js-timer">' + (ST ? timerText() : '--:--') + '</span></span>' + quick + '<button class="ibtn" data-a="nav" aria-label="Цэс" aria-expanded="' + (ui.nav ? 'true' : 'false') + '">' + ico('menu', 22) + '</button></div>';
  if ($('mbar').dataset.h !== o) { $('mbar').dataset.h = o; $('mbar').innerHTML = o; }
  document.body.classList.toggle('navopen', ui.nav);
}

/* ---------- толгой: анги, шат, цаг, удирдлага ---------- */
function phaseInfo() {
  var t = ST.t, st = curStep();
  if (t.phase === 'lobby') return { chip: '<span class="pill white">🌸 Бэлтгэл</span>', line: 'Сурагчид нэвтэрч байна · ' + ST.onlineCount + '/' + ST.total + ' онлайн' };
  if (t.phase === 'done') return { chip: '<span class="pill butter">🏁 Дууссан</span>', line: 'Сорилт дууслаа. Дүн табаас дүнг харна уу.' };
  var sg = stageOf(t.stage);
  return { chip: '<span class="stagechip s' + t.stage + '">' + esc(sg.icon || '') + ' ' + t.stage + '-р шат · ' + esc(sg.name) + '</span>', line: 'Алхам ' + (t.step + 1) + '/' + t.stepCount + ' · ' + esc(st ? st.label : '') + ' · <b>' + esc(PHL[t.ph] || '') + '</b> <span class="muted">(үе ' + ((t.phIndex || 0) + 1) + '/' + (t.phCount || 1) + ')</span>' };
}
function nextLabel() {
  var t = ST.t, st = curStep(); if (!st) return 'Дараагийн үе';
  var phs = KINDS[st.kind] || []; if (t.phIndex + 1 < phs.length) return 'Дараах: ' + PHL[phs[t.phIndex + 1]];
  var nx = ST.script[t.step + 1]; return nx ? 'Дараах: ' + nx.label : 'Дуусгах';
}
function renderHdr() {
  var s = ST, t = s.t, pi = phaseInfo();
  var sig = JSON.stringify([t.phase, t.step, t.ph, t.phIndex, t.paused, t.locked, t.stage, s.chatOff, s.settings.className, s.settings.topic, s.settings.subject, s.onlineCount, s.total, t.stepCount, (curStep() || {}).label]);
  paint($('hdr'), 'hdr', sig, function () {
    var b = function (a, l, c, title) { return '<button class="btn ' + (c || '') + '" type="button" data-a="' + a + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + l + '</button>'; };
    var c = '';
    if (t.phase === 'lobby') c += b('start', '▶ Эхлүүлэх', 'primary lg');
    if (t.phase === 'live') {
      c += t.paused ? b('resume', '▶ Үргэлжлүүлэх', 'primary') : b('pause', '⏸ Түр зогсоох', 'butter');
      c += b('next', '⏭ Дараагийн үе', 'dark', nextLabel());
      c += '<span class="seg">' + b('sub30', '−30с', 'sm') + b('add30', '+30с', 'sm') + '</span>';
      c += t.locked ? b('unlock', '🔓 Хариулт нээх', 'lilac') : b('lock', '🔒 Хариулт түгжих');
    }
    c += s.chatOff ? b('chaton', '💬 Чат нээх', 'lilac') : b('chatoff', '🔕 Чат хаах');
    if (t.phase === 'live') c += b('end', '🏁 Дуусгах', 'danger');
    if (t.phase !== 'lobby') c += b('reset', '♻ Шинээр эхлүүлэх', 'danger ghostd');
    var flags = (t.paused ? '<span class="pill butter">⏸ Түр зогссон</span>' : '') + (t.locked ? '<span class="pill pink">🔒 Хариулт түгжигдсэн</span>' : '') + (s.chatOff ? '<span class="pill white">🔕 Чат хаалттай</span>' : '');
    return '<div class="hrow"><div class="htitle"><div class="hcls">' + stk('flask', 46, 'hstk') + '<div><h1>' + esc(s.settings.className) + ' · ' + esc(s.settings.topic) + '</h1><div class="muted small">' + esc(s.settings.subject || 'Биологи') + ' · бодит цагийн анги-сорилт</div></div></div>' +
      '<div class="hstat">' + pi.chip + flags + '</div><div class="hline">' + pi.line + '</div></div>' +
      '<div class="htime"><div class="timer big"><span class="js-timer">' + timerText() + '</span></div><div class="progress"><i id="tbar"></i></div><div class="small muted tsmall">' + (t.phase === 'live' ? esc(PHL[t.ph] || '') + ' · ' + (t.totalSec || 0) + ' сек' : t.phase === 'lobby' ? 'Эхлэхэд бэлэн' : 'Дууссан') + '</div></div></div>' +
      '<div class="ctrl">' + c + '</div>';
  });
}

/* ---------- алхмын зам (шатаар бүлэглэсэн) ---------- */
function previewScript() {
  var a = function (st) { return ST.questions.filter(function (q) { return q.active && q.stage === st; }).sort(function (x, y) { return x.slot - y.slot || x.order - y.order; }); };
  var sc = []; a(1).forEach(function (q, i) { sc.push({ stage: 1, kind: 'q', label: 'Асуулт ' + (i + 1) }); });
  if (a(2).length) { sc.push({ stage: 2, kind: 'write', label: 'Багийн хариулт' }); sc.push({ stage: 2, kind: 'peer', label: 'Шалгалт' }); }
  if (a(3).length) sc.push({ stage: 3, kind: 'duel', label: 'Тулаан' });
  if (a(4).length) sc.push({ stage: 4, kind: 'final', label: 'Эцсийн сорил' });
  return sc;
}
function renderPath() {
  var t = ST.t, live = t.phase === 'live', sc = ST.script && ST.script.length ? ST.script : previewScript();
  var sig = JSON.stringify([t.phase, t.step, t.phIndex, sc.map(function (x) { return [x.label, x.stage, x.revealed]; })]);
  paint($('path'), 'path', sig, function () {
    var o = '';
    [1, 2, 3, 4].forEach(function (n) {
      var items = []; sc.forEach(function (x, i) { if (x.stage === n) items.push([x, i]); }); if (!items.length) return;
      var sg = stageOf(n), on = live && t.stage === n, done = t.phase === 'done' || (live && t.stage > n);
      o += '<div class="pgrp' + (on ? ' on' : '') + (done ? ' done' : '') + '"><div class="pghead"><span class="pnum s' + n + '">' + n + '</span><span>' + esc(sg.name) + '</span></div><div class="pchips">';
      items.forEach(function (it) {
        var x = it[0], i = it[1], cls = 'pchip', inner = esc(x.label);
        if (t.phase === 'done' || (live && i < t.step)) cls += ' done';
        if (live && i === t.step) { cls += ' on'; inner += '<span class="phdots">' + (KINDS[x.kind] || []).map(function (p, k) { return '<i class="' + (k < t.phIndex ? 'd' : k === t.phIndex ? 'c' : '') + '" title="' + esc(PHL[p]) + '"></i>'; }).join('') + '</span>'; }
        o += live ? '<button type="button" class="' + cls + '" data-goto="' + i + '" title="Энэ алхам руу шилжих">' + inner + '</button>' : '<span class="' + cls + '">' + inner + '</span>';
      });
      o += '</div></div>';
    });
    return o || '<span class="muted small">Идэвхтэй асуулт алга. «Асуултууд» табаас асуулт шатанд оноогоорой.</span>';
  });
}
$('path').addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-goto]'); if (!b) return; var i = +b.dataset.goto, x = ST.script[i]; if (!x) return;
  ask({ title: 'Алхам руу шилжих', text: '«' + stageOf(x.stage).name + ' · ' + x.label + '» алхам руу шилжих уу? Одоогийн үе дуусч, багийн хариултууд түгжигдэнэ.', ok: 'Шилжих' }).then(function (y) { if (y) ctl('goto', { step: i }); });
});

/* ---------- үйлдлүүд ---------- */
function ctl(action, extra) { return post('/api/t/control', Object.assign({ action: action }, extra || {})); }
document.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-a]'); if (!b) return; var a = b.dataset.a;
  if (a === 'nav') { ui.nav = !ui.nav; renderMbar(); return; }
  if (a === 'start') ctl('start').then(function (j) { j.ok && toast('Сорилт эхэллээ. Амжилт! 🌸', 'ok'); });
  else if (a === 'pause' || a === 'resume' || a === 'lock' || a === 'unlock' || a === 'chatoff' || a === 'chaton') ctl(a);
  else if (a === 'next') ctl('next');
  else if (a === 'add30') ctl('addtime', { sec: 30 }); else if (a === 'sub30') ctl('addtime', { sec: -30 });
  else if (a === 'end') ask({ title: 'Сорилтыг дуусгах', text: 'Сорилтыг одоо дуусгаж эцсийн дүнг гаргах уу? Бүх алхмын үр дүн нээгдэнэ.', ok: '🏁 Дуусгах', danger: true }).then(function (y) { if (y) ctl('end'); });
  else if (a === 'reset') resetFlow();
  else if (a === 'logout') post('/api/teacher/logout').then(function () { location.reload(); });
  else if (a === 'tab') setTab(b.dataset.t);
  else if (a === 'ans') openAnswers(b.dataset.q);
  else if (a === 'present') post('/api/t/present', { kind: b.dataset.k, qid: b.dataset.q || '', text: b.dataset.text || '', title: b.dataset.title || '' }).then(function (j) { j.ok && toast('Проектор дээр харууллаа.', 'ok'); });
  else if (a === 'clearp') post('/api/t/present', { kind: 'clear' }).then(function (j) { j.ok && toast('Проектор цэвэр боллоо.', 'ok'); });
  else if (a === 'board') post('/api/t/present', { kind: 'board' }).then(function (j) { j.ok && toast('Багуудын байрыг проектор дээр харууллаа.', 'ok'); });
  else if (a === 'prev') { ui.prev = !ui.prev; sigs.live = null; renderTab(); }
  else if (a === 'rate') post('/api/t/rate', { team: +b.dataset.t, rating: b.dataset.r }).then(function (j) { j.ok && toast(b.dataset.r ? 'Үнэлгээ хадгалагдлаа.' : 'Автомат үнэлгээ рүү буцлаа.', 'ok'); });
  else if (a === 'award') openAward(b.dataset.s ? { sid: b.dataset.s, name: b.dataset.n } : { team: +b.dataset.t });
  else if (a === 'copy') { var txt = b.dataset.text; (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Хуулагдлаа.', 'ok'); }).catch(function () { toast(txt); }); }
});
function resetFlow() {
  ask({ title: 'Шинээр эхлүүлэх', text: 'Бүх хариулт, оноо, чат устаж, сорилт эхлэхэд бэлэн болно. Сурагч, асуулт, тохиргоо хэвээр үлдэнэ. Өмнөх төлөв автоматаар нөөцлөгдөнө.', ok: 'Үргэлжлүүлэх', danger: true }).then(function (y) {
    if (!y) return;
    ask({ title: 'Дахин баталгаажуулах', text: 'Үнэхээр шинээр эхлүүлэх үү? Баталгаажуулахын тулд доор ШИНЭ гэж бичнэ үү.', ok: '♻ Шинээр эхлүүлэх', danger: true, word: 'ШИНЭ' }).then(function (y2) {
      if (y2) ctl('reset').then(function (j) { if (j.ok) { toast('Сорилт шинэчлэгдлээ.', 'ok'); seen = { 1: 0, 2: 0, 3: 0, 4: 0 }; store('enzT_seen', seen); } });
    });
  });
}

/* ---------- табын агуулга ---------- */
function renderTab() {
  var m = $('main');
  if (m.dataset.tab !== TAB) { m.dataset.tab = TAB; m.innerHTML = ''; sigs.live = sigs.q = sigs.qbar = sigs.st = sigs.res = sigs.disc = undefined; m.dataset.drawn = ''; }
  ({ live: rLive, questions: rQuestions, students: rStudents, results: rResults, disc: rDisc, settings: rSettings })[TAB]();
}

/* асуултыг багшид бүтнээр (зөв хариутай) харуулах */
function qFull(q, opt) {
  opt = opt || {}; if (!q) return '';
  var o = '<div class="qfull">';
  if (!opt.noText) o += '<div class="qtext">' + esc(q.text) + '</div>';
  if (q.image) o += '<img class="qimg" src="/img/q/' + encodeURIComponent(q.image) + '" alt="Асуултын зураг" style="max-height:260px">';
  if (q.graph) o += graphSVG(q.graph);
  if (q.type === 'mcq' || q.type === 'multi') {
    o += '<div class="olist">' + (q.options || []).map(function (t, i) { var ok = q.type === 'mcq' ? q.correct === i : (q.correct || []).indexOf(i) >= 0; return '<div class="oli' + (ok ? ' ok' : '') + '"><span class="k">' + ABC[i] + '</span><span>' + esc(t) + '</span>' + (ok ? '<b class="okm">✓ зөв</b>' : '') + '</div>'; }).join('') + '</div>';
  } else if (q.type === 'tf') o += '<div class="ans">Зөв хариулт: ' + (q.correct ? 'Үнэн' : 'Худал') + '</div>';
  else if (q.type === 'order') o += '<div class="olist">' + (q.items || []).map(function (t, i) { return '<div class="oli ok"><span class="k">' + (i + 1) + '</span><span>' + esc(t) + '</span></div>'; }).join('') + '</div><div class="small muted">Зөв дараалал</div>';
  else if (q.type === 'match') o += '<div class="olist">' + (q.pairs || []).map(function (p) { return '<div class="oli ok"><span>' + esc(p.l) + '</span><b class="arrow">⇒</b><span>' + esc(p.r) + '</span></div>'; }).join('') + '</div>';
  else if (q.type === 'short') { if (q.keywords && q.keywords.length) o += '<div class="kws"><span class="small muted">Түлхүүр үгс:</span> ' + q.keywords.map(function (g) { return '<span class="pill butter">' + esc(g.join(' / ')) + '</span>'; }).join(' ') + '</div>'; }
  if (!opt.noExpl) {
    if (q.explanation) o += '<div class="expl"><h4>' + (q.type === 'short' ? 'Загвар хариулт' : 'Тайлбар') + '</h4><div class="pre">' + esc(q.explanation) + '</div></div>';
    if (q.misconception) o += '<div class="expl mis"><h4>Түгээмэл буруу ойлголт</h4><div class="pre">' + esc(q.misconception) + '</div></div>';
    if (q.discussion) o += '<div class="expl disc"><h4>Ярилцах асуулт</h4><div class="pre">' + esc(q.discussion) + '</div></div>';
  }
  return o + '</div>';
}
function presentBtns(qid, sm) {
  var c = 'btn sm' + (sm ? ' ghost' : '');
  return '<span class="seg pseg"><span class="segl">📽</span><button class="' + c + '" data-a="present" data-k="q" data-q="' + qid + '" title="Асуултыг проектор дээр">Асуулт</button><button class="' + c + '" data-a="present" data-k="a" data-q="' + qid + '" title="Зөв хариултыг проектор дээр">Хариулт</button><button class="' + c + '" data-a="present" data-k="e" data-q="' + qid + '" title="Тайлбарыг проектор дээр">Тайлбар</button><button class="' + c + '" data-a="present" data-k="d" data-q="' + qid + '" title="Ярилцлагын асуултыг проектор дээр">Ярилцлага</button></span>';
}

/* ================= ШУУД ЯВЦ ================= */
function liveCounts() {
  var L = ST.live, st = curStep(); if (!L || !st) return null;
  var tot = 0, ans = 0, teamsDone = 0;
  L.teams.forEach(function (r) { tot += r.members.length; ans += r.members.filter(function (m) { return m.answered; }).length; if (r.tans) teamsDone++; });
  var teamMode = st.kind === 'write' || st.kind === 'final' || (st.kind === 'duel' && ST.t.ph === 'team');
  return teamMode ? { k: 'Багийн хариулт', v: teamsDone + '/4', p: teamsDone / 4 } : { k: st.kind === 'peer' ? 'Үнэлгээ өгсөн' : 'Хариулсан', v: ans + '/' + tot, p: tot ? ans / tot : 0 };
}
function rLive() {
  var s = ST, t = s.t;
  var sig = JSON.stringify([t.phase, t.step, t.ph, t.locked, t.paused, s.live, s.teams, s.writeAnswers, s.writeQ, s.students.map(function (x) { return [x.id, x.online, x.team, x.name]; }), s.feed.length && s.feed[s.feed.length - 1].t, s.onlineCount, s.join, s.tunnel && [s.tunnel.url, s.tunnel.qr && s.tunnel.qr.length], s.siteUrl, s.settings.code, s.firstPw, ui.prev, s.settings.teams, s.settings.areas]);
  paint($('main'), 'live', sig, function () {
    var o = '';
    if (s.firstPw) o += '<div class="warnbox">⚠ Та анхны нууц үгээ ашиглаж байна. <button class="linkb" data-a="tab" data-t="settings">Тохиргоо</button> хэсэгт очиж нууц үгээ солино уу.</div>';
    o += liveTiles();
    o += '<div class="lgrid"><div class="lmain">' + curTaskCard() + (t.phase === 'live' && (t.kind === 'write' || t.kind === 'peer') ? writePanel() : '') + teamCards() + '</div>';
    o += '<div class="lside">' + joinCard() + boardCard() + feedCard() + '</div></div>';
    return o;
  });
}
function liveTiles() {
  var s = ST, t = s.t, lc = liveCounts(), sg = stageOf(t.stage);
  var tile = function (cls, k, v, sub, img) { return '<div class="tile ' + cls + '">' + (img ? stk(img, 40, 'tstk') : '') + '<div class="k">' + k + '</div><div class="v">' + v + '</div>' + (sub ? '<div class="tsub">' + sub + '</div>' : '') + '</div>'; };
  var o = '<div class="tiles">';
  o += tile('pink', 'Онлайн сурагч', s.onlineCount + '<small>/' + s.total + '</small>', s.total - s.onlineCount ? (s.total - s.onlineCount) + ' сурагч хүлээгдэж байна' : 'Бүгд холбогдсон 💖', 'tongue');
  o += tile('lilac', 'Шат', t.phase === 'live' ? t.stage + '<small>/4</small>' : t.phase === 'done' ? '🏁' : '0<small>/4</small>', t.phase === 'live' ? esc(sg.name) : t.phase === 'done' ? 'Бүх шат дууссан' : 'Эхлээгүй байна');
  o += tile('butter', 'Үе', '<span class="vt">' + (t.phase === 'live' ? esc(PHL[t.ph] || '') : t.phase === 'done' ? 'Дууссан' : 'Бэлтгэл') + '</span>', t.phase === 'live' ? 'Алхам ' + (t.step + 1) + '/' + t.stepCount + ' · ' + esc((curStep() || {}).label || '') : (previewScript().length + ' алхам'));
  o += tile('white', lc ? lc.k : 'Хариулсан', lc ? lc.v : '—', lc ? '<span class="progress"><i style="width:' + Math.round(lc.p * 100) + '%"></i></span>' : 'Одоогоор даалгавар алга');
  return o + '</div>';
}
function curTaskCard() {
  var s = ST, t = s.t, st = curStep(), o = '<div class="card tint-pink task">';
  if (t.phase === 'lobby') {
    o += '<div class="taskhead"><div><h2>Сорилт эхлэхэд бэлэн 🌸</h2><p class="muted">Сурагчид хичээлийн кодоор нэвтэрч байна. Бүгд ормогц «Эхлүүлэх» товчийг дарна уу.</p></div>' + stk('egg', 86, 'float') + '</div>';
    o += '<div class="stgrid">' + s.stages.map(function (g) { return '<div class="stcard s' + g.id + '"><div class="sthead"><span class="pnum s' + g.id + '">' + g.id + '</span><b>' + esc(g.name) + '</b></div><div class="small">' + esc(g.title) + '</div><div class="small muted clamp3">' + esc(g.desc) + '</div></div>'; }).join('') + '</div>';
    o += '<div class="row" style="margin-top:14px"><button class="btn primary lg" data-a="start">▶ Сорилтыг эхлүүлэх</button><span class="muted small">' + s.onlineCount + '/' + s.total + ' сурагч онлайн</span></div>';
    return o + '</div>';
  }
  if (t.phase === 'done') {
    o += '<div class="taskhead"><div><h2>Сорилт дууслаа! 🏁</h2><p class="muted">' + esc(cutePick('done', s.settings.className)) + '</p><div class="row"><button class="btn primary" data-a="tab" data-t="results">📊 Дүн харах</button><button class="btn" data-a="board">📽 Байрыг проектор дээр</button></div></div>' + stk('dance', 96, 'float') + '</div>';
    return o + '</div>';
  }
  var sg = stageOf(t.stage), L = s.live || { teams: [] }, q = (st.kind === 'q' || st.kind === 'write' || st.kind === 'peer') && L.teams[0] ? qById(L.teams[0].qid) : null;
  o += '<div class="taskhead"><div class="tt"><div class="muted small">ОДООГИЙН ДААЛГАВАР</div><h2>' + esc(KINDL[st.kind] || '') + (st.kind === 'q' ? ' · ' + esc(st.label) : '') + '</h2><div class="row" style="gap:8px"><span class="stagechip s' + t.stage + '">' + esc(sg.icon || '') + ' ' + esc(sg.name) + '</span><span class="pill white">' + esc(PHL[t.ph] || '') + '</span>' + (q ? '<span class="pill">' + esc(TYPEL[q.type]) + '</span>' + (q.concept ? '<span class="pill butter">' + esc(q.concept) + '</span>' : '') : '') + '</div></div>' + stk(pick('science', st.id), 64, 'float d1') + '</div>';
  o += '<p class="small muted clamp2" style="margin:8px 0 0">' + esc(sg.title) + ' — ' + esc(sg.desc) + '</p>';
  if (q) {
    o += '<div class="qbox">' + (ui.prev ? qFull(q) : '<div class="qtext">' + esc(q.text) + '</div>' + (q.image ? '<img class="qimg" src="/img/q/' + encodeURIComponent(q.image) + '" alt="" style="max-height:180px">' : '') + (q.graph ? '<div class="small muted">📈 График бүхий асуулт — «Бүтнээр харах» дарна уу.</div>' : '')) + '</div>';
    o += '<div class="row tbtns"><button class="btn sm lilac" data-a="prev">' + (ui.prev ? '🙈 Хураах' : '👁 Бүтнээр харах (зөв хариутай)') + '</button>' + (st.kind === 'q' ? '<button class="btn sm" data-a="ans" data-q="' + q.id + '">📊 Хариултууд</button>' : '') + presentBtns(q.id) + '<button class="btn sm ghost" data-a="clearp">Проектор цэвэрлэх</button></div>';
  } else {
    o += '<div class="qbox"><div class="small"><b>Баг бүр өөр асуулттай.</b> Доорх багийн картууд дээр асуулт, хариулт нь харагдана.</div></div>';
    o += '<div class="row tbtns"><button class="btn sm lilac" data-a="prev">' + (ui.prev ? '🙈 Хураах' : '👁 Асуултуудыг бүтнээр харах') + '</button><button class="btn sm ghost" data-a="clearp">Проектор цэвэрлэх</button></div>';
  }
  return o + '</div>';
}
function memberChips(list) {
  return '<div class="mchips">' + list.map(function (m) { return '<span class="mchip ' + (m.answered ? 'ans' : 'wait') + (m.online ? '' : ' off') + '" title="' + esc(m.name) + (m.online ? '' : ' · офлайн') + '">' + (m.answered ? '✓ ' : '') + esc(m.name) + '</span>'; }).join('') + '</div>';
}
function tansBox(ta, kind, ph) {
  if (!ta) return '<div class="tans empty">' + (kind === 'write' || ph === 'team' || kind === 'final' ? '✎ Багийн хариулт хараахан ирээгүй' : 'Багийн хариулт байхгүй') + '</div>';
  var st = ta.auto ? '<span class="pill">🤖 Автомат (олонх)</span>' : ta.locked ? '<span class="pill pink">🔒 Түгжигдсэн</span>' : '<span class="pill white">✎ Ноорог</span>';
  var res = ta.ok === true ? '<span class="pill mint">✓ Зөв</span>' : ta.ok === false ? '<span class="pill rosep">✗ Буруу</span>' : '';
  return '<div class="tans"><div class="tansh"><b>Багийн хариулт</b>' + st + res + '</div><div class="pre tatext">' + esc(ta.text || ta.desc || '') + '</div>' + (ta.by ? '<div class="small muted">' + esc(ta.by) + (ta.t ? ' · ' + hhmm(ta.t) : '') + '</div>' : '') + '</div>';
}
function teamCards() {
  var s = ST, t = s.t, st = curStep(), L = s.live, o = '<div class="tgrid">';
  var teamsBy = {}; s.teams.forEach(function (x) { teamsBy[x.team] = x; });
  [1, 2, 3, 4].forEach(function (k) {
    var tm = teamsBy[k] || { score: 0, rank: '-' }, row = L && L.teams ? L.teams[k - 1] : null, mis = (s.settings.teams[k - 1] || {}).mission || '';
    var mem = row ? row.members : s.students.filter(function (m) { return m.team === k; }).map(function (m) { return { id: m.id, name: m.name, online: m.online, answered: false }; });
    var ansN = mem.filter(function (m) { return m.answered; }).length, onN = mem.filter(function (m) { return m.online; }).length;
    o += '<div class="tcard" style="--tc:' + tcol(k) + '"><div class="tchead">' + stk(TEAMIMG[k], 46, 'tcstk') + '<div class="tcn"><b>' + esc(tname(k)) + '</b><small>' + esc(mis) + '</small></div><div class="tcs"><span class="rk">#' + tm.rank + '</span><b>' + tm.score + '</b><small>оноо</small></div></div>';
    if (st && row) {
      var q = qById(row.qid);
      if ((st.kind === 'duel' || st.kind === 'final') && q) {
        o += '<div class="tq">' + (st.kind === 'final' ? '<div class="small"><span class="pill butter">Сэдэв: ' + esc(areaName(row.area) || ('#' + row.area)) + '</span></div>' : '') + (ui.prev ? qFull(q, { noExpl: true }) : '<div class="small clamp2"><b>' + esc(q.id) + '.</b> ' + esc(q.text) + '</div>') + '<div class="row" style="gap:6px;margin-top:6px">' + (st.kind === 'duel' ? '<button class="btn sm" data-a="ans" data-q="' + q.id + '">📊 Хариултууд</button>' : '') + '<button class="btn sm ghost" data-a="present" data-k="q" data-q="' + q.id + '">📽 Асуулт</button></div></div>';
      }
      if (st.kind === 'peer') {
        var rv = ((k + 2) % 4) + 1;
        o += '<div class="tq small">🔍 <b>' + esc(tname(row.target)) + '</b>-ийн хариултыг шалгаж байна<br><span class="muted">Энэ багийн хариултыг ' + esc(tname(rv)) + ' шалгана · үнэлгээ: </span>' + (row.rating ? '<b>' + RATEL[row.rating] + '</b>' + (row.manual ? ' <span class="pill white">багш</span>' : '') : '<span class="muted">хүлээгдэж байна</span>') + '</div>';
      }
      var lbl = st.kind === 'peer' ? 'Үнэлгээ өгсөн' : (st.kind === 'write' || st.kind === 'final' || t.ph === 'team') ? 'Хувийн хариулт' : 'Хариулсан';
      if (!(st.kind === 'write' || st.kind === 'final')) o += '<div class="tprog"><span class="small">' + lbl + ' <b>' + ansN + '/' + mem.length + '</b></span><span class="progress"><i style="width:' + (mem.length ? ansN / mem.length * 100 : 0) + '%"></i></span></div>';
      else o += '<div class="tprog"><span class="small">Онлайн <b>' + onN + '/' + mem.length + '</b></span></div>';
      o += memberChips(mem);
      if (st.kind !== 'q') o += tansBox(row.tans, st.kind, t.ph);
    } else {
      o += '<div class="tprog"><span class="small">Онлайн <b>' + onN + '/' + mem.length + '</b></span><span class="progress"><i style="width:' + (mem.length ? onN / mem.length * 100 : 0) + '%"></i></span></div>';
      o += '<div class="mchips">' + mem.map(function (m) { return '<span class="mchip ' + (m.online ? 'ans' : 'wait off') + '">' + esc(m.name) + '</span>'; }).join('') + '</div>';
    }
    o += '</div>';
  });
  return o + '</div>';
}
function writePanel() {
  var s = ST, W = s.writeAnswers, Q = s.writeQ; if (!W || !Q) return '';
  var o = '<div class="card tint-butter wpanel"><div class="taskhead"><div><div class="muted small">2-Р ШАТ · PEER CHECK</div><h2>✍ Багуудын бичсэн хариулт</h2></div>' + stk('pencil', 54) + '</div>';
  o += '<div class="qbox"><div class="qtext">' + esc(Q.text) + '</div>' + (Q.model ? '<div class="expl"><h4>Загвар хариулт</h4><div class="pre">' + esc(Q.model) + '</div></div>' : '') + (Q.keywords && Q.keywords.length ? '<div class="kws"><span class="small muted">Түлхүүр үгс:</span> ' + Q.keywords.map(function (g) { return '<span class="pill butter">' + esc(g.join(' / ')) + '</span>'; }).join(' ') + '</div>' : '') + '</div>';
  o += '<div class="wgrid">' + W.map(function (w) {
    var a = w.ans;
    var btn = function (r, l) { return '<button class="btn sm rbtn' + (w.manual === r ? ' on' : '') + '" data-a="rate" data-t="' + w.team + '" data-r="' + r + '">' + l + '</button>'; };
    return '<div class="wcard" style="--tc:' + tcol(w.team) + '"><div class="row" style="gap:8px">' + teamTag(w.team) + (a ? (a.locked ? '<span class="pill pink">🔒 Түгжигдсэн</span>' : '<span class="pill white">✎ Бичиж байна</span>') : '<span class="pill white">Хариулт ирээгүй</span>') + '</div>' +
      '<div class="pre wtext">' + (a ? esc(a.text || a.desc || '') : '<span class="muted">—</span>') + '</div>' + (a && a.by ? '<div class="small muted">' + esc(a.by) + '</div>' : '') +
      '<div class="small wrate">Автомат: <b>' + (w.auto ? RATEL[w.auto] : '—') + '</b> · Одоогийн: <b>' + (w.rating ? RATEL[w.rating] : '—') + '</b>' + (w.manual ? ' <span class="pill white">багшийн</span>' : '') + '</div>' +
      '<div class="row rrow">' + btn('ok', '✅') + btn('partial', '🟡') + btn('wrong', '❌') + '<button class="btn sm ghost' + (!w.manual ? ' on' : '') + '" data-a="rate" data-t="' + w.team + '" data-r="">🤖 Автомат</button></div></div>';
  }).join('') + '</div>';
  return o + '</div>';
}
function joinUrl() { var s = ST; return (s.join && s.join.url) || s.siteUrl || location.origin; }
function joinCard() {
  var s = ST, url = joinUrl(), qr = s.join && s.join.qr;
  return '<div class="card tint-lilac join"><div class="taskhead"><h3>Сурагчид орох</h3>' + stk('bubble', 44) + '</div>' +
    '<div class="jbox">' + (qr ? '<img class="qr" alt="Нэвтрэх QR код" src="' + esc(qr) + '">' : '') + '<div class="jinfo"><div class="small muted">Хичээлийн код</div><div class="code">' + esc(s.settings.code) + '</div><div class="small muted" style="margin-top:8px">Хаяг</div><div class="jurl">' + esc(url) + '</div>' +
    '<div class="row" style="gap:6px;margin-top:8px"><button class="btn sm" data-a="copy" data-text="' + esc(url + '  ·  код: ' + s.settings.code) + '">📋 Хуулах</button><a class="btn sm ghost" href="/projector" target="_blank" rel="noopener">📽 Проектор</a></div></div></div></div>';
}
function boardCard() {
  var s = ST, rows = s.teams.slice().sort(function (a, b) { return a.rank - b.rank; });
  return '<div class="card board"><div class="taskhead"><h3>Багуудын байр</h3><button class="btn sm ghost" data-a="board" title="Проектор дээр харуулах">📽</button></div>' +
    Charts.stacked(rows.map(function (r) { return { name: '#' + r.rank + ' ' + r.name, color: tcol(r.team), stages: r.stages, score: r.score }; })) +
    '<div class="small muted" style="margin-top:8px">' + (s.settings.scoreMode === 'sum' ? 'Гишүүдийн оноог нэмж' : 'Гишүүдийн дундаж оноо') + ' + багийн оноо</div></div>';
}
function feedCard() {
  var f = ST.feed.slice(-40).reverse();
  return '<div class="card"><h3>Идэвх</h3><div class="feed">' + (f.length ? f.map(function (x) { return '<div class="fi ' + esc(x.kind || '') + '"><time>' + hhmmss(x.t) + '</time><span>' + esc(x.text) + '</span></div>'; }).join('') : '<div class="empty">' + stk('mouse2', 60) + '<div class="muted small">Одоохондоо идэвх алга</div></div>') + '</div></div>';
}

/* ================= МОДАЛ ================= */
function openModal(html, kind, wide) { modalKind = kind; $('mbox').className = 'mbox' + (wide ? ' wide' : ''); $('mbox').innerHTML = html; $('modal').classList.remove('hide'); document.body.classList.add('modalopen'); }
function closeModal() { if (!modalKind && $('modal').classList.contains('hide')) return; var k = modalKind; modalKind = null; clearInterval(ansTimer); $('modal').classList.add('hide'); $('mbox').innerHTML = ''; document.body.classList.remove('modalopen'); if (k === 'ask' && askRes) { var r = askRes; askRes = null; r(false); } }
$('modal').addEventListener('mousedown', function (ev) { if (ev.target === $('modal') && modalKind !== 'edit') closeModal(); });
document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') { if (modalKind) closeModal(); else if (chatOpen) toggleChat(false); else if (ui.nav) { ui.nav = false; renderMbar(); } } });
$('mbox').addEventListener('click', function (ev) { var b = ev.target.closest('[data-m]'); if (b && b.dataset.m === 'close') closeModal(); });
var askRes = null;
function ask(o) {
  return new Promise(function (res) {
    var h = '<div class="askbox">' + stk(o.danger ? 'strawberry' : 'egg', 70) + '<h2>' + esc(o.title) + '</h2><p>' + esc(o.text) + '</p>' + (o.word ? '<input type="text" id="askw" autocomplete="off" placeholder="' + esc(o.word) + '">' : '') +
      '<div class="row askbtns"><button class="btn" data-m="close" type="button">Болих</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" id="askok" type="button"' + (o.word ? ' disabled' : '') + '>' + esc(o.ok || 'Тийм') + '</button></div></div>';
    openModal(h, 'ask'); askRes = res;
    if (o.word) { var w = $('askw'); w.focus(); w.addEventListener('input', function () { $('askok').disabled = w.value.trim().toUpperCase() !== o.word; }); w.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !$('askok').disabled) $('askok').click(); }); } else $('askok').focus();
    $('askok').addEventListener('click', function () { var r = askRes; askRes = null; closeModal(); r && r(true); });
  });
}

/* ---------- хариултын цонх ---------- */
function openAnswers(qid) {
  var first = true;
  var load = function () {
    get('/api/t/answers?qid=' + encodeURIComponent(qid)).then(function (j) {
      if (!j.ok) { if (first) toast(j.err || 'Хариулт ачаалж чадсангүй.', 'bad'); return; }
      if (!first && modalKind !== 'ans:' + qid) return;
      var q = j.q, full = qById(q.id), done = j.rows.filter(function (r) { return r.answered; }).length;
      var badge = function (r) { return !r.answered ? '<span class="badge off">Хариулаагүй</span>' : r.ok === true ? '<span class="badge on">✓ Зөв</span>' : r.ok === false ? '<span class="badge bad">✗ Буруу</span>' : r.ok === 'partial' ? '<span class="badge part">◐ Хэсэгчлэн</span>' : '<span class="badge part">— Үнэлгээгүй</span>'; };
      var o = '<div class="mhead"><div><div class="muted small">' + esc(q.id) + ' · ' + esc(TYPEL[q.type] || '') + '</div><h2>Хариултууд</h2></div><button class="btn sm" data-m="close">✕ Хаах</button></div>';
      o += '<div class="agrid"><div>' + qFull(full || q, { noExpl: false }) + '</div><div class="card achart"><h3>Тархалт</h3>' + (j.dist ? Charts.dist(j.dist) : '') + '<p class="small muted">' + done + ' / ' + j.rows.length + ' сурагч хариулсан</p>' + presentBtns(q.id) + '</div></div>';
      if (j.teamRows && j.teamRows.length) o += '<h3>Багийн хариултууд</h3><div class="tbl-wrap"><table><thead><tr><th>Баг</th><th>Хариулт</th><th>Хэн</th><th>Төлөв</th></tr></thead><tbody>' + j.teamRows.map(function (r) { return '<tr><td>' + teamTag(r.team) + '</td><td class="pre">' + esc(r.text) + '</td><td>' + esc(r.by || '') + '</td><td>' + (r.auto ? '<span class="pill">🤖 Автомат</span> ' : '') + (r.locked ? '<span class="pill pink">🔒</span> ' : '<span class="pill white">✎</span> ') + (r.ok === true ? '<span class="badge on">✓ Зөв</span>' : r.ok === false ? '<span class="badge bad">✗ Буруу</span>' : '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
      o += '<h3 style="margin-top:14px">Хүн бүрийн хариулт</h3><div class="tbl-wrap"><table class="atbl"><thead><tr><th>Сурагч</th><th>Баг</th><th>Хариулт</th><th>Төлөв</th><th>Хугацаа</th><th>Оноо</th><th>Бонус</th></tr></thead><tbody>' +
        j.rows.slice().sort(function (a, b) { return a.team - b.team || (b.answered - a.answered); }).map(function (r) {
          return '<tr class="' + (r.answered ? '' : 'dim') + '"><td><b>' + esc(r.name) + '</b></td><td>' + teamTag(r.team) + '</td><td class="pre">' + esc(r.text) + (r.why ? '<div class="small muted">Яагаад: ' + esc(r.why) + '</div>' : '') + '</td><td>' + badge(r) + '</td><td>' + (r.sec != null ? r.sec + 'с' : '') + '</td><td><b>' + ((r.pts || 0) + (r.bonus || 0)) + '</b>' + (r.bonus ? ' <small class="muted">(+' + r.bonus + ')</small>' : '') + '</td><td class="nowrap">' + (r.answered ? '<button class="btn sm" data-bonus="' + (r.bonus ? 0 : 5) + '" data-s="' + esc(r.sid) + '" data-q="' + esc(q.id) + '">' + (r.bonus ? '↺ 0' : '+5') + '</button>' : '') + '</td></tr>';
        }).join('') + '</tbody></table></div>';
      var mb = $('mbox'), sc = mb.parentNode.scrollTop;
      if (first) openModal(o, 'ans:' + qid, true); else mb.innerHTML = o;
      mb.parentNode.scrollTop = sc; first = false;
    });
  };
  load(); clearInterval(ansTimer); ansTimer = setInterval(function () { if (modalKind === 'ans:' + qid) load(); else clearInterval(ansTimer); }, 4000);
}
$('mbox').addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-bonus]'); if (!b) return; var q = b.dataset.q;
  post('/api/t/grade', { sid: b.dataset.s, qid: q, bonus: +b.dataset.bonus }).then(function (j) { if (j.ok) { toast(+b.dataset.bonus ? 'Бонус +5 нэмэгдлээ.' : 'Бонус арилгалаа.', 'ok'); openAnswers(q); } });
});

/* ---------- оноо нэмэх/хасах ---------- */
function openAward(tg) {
  var who = tg.sid ? esc(tg.name || '') : esc(tname(tg.team));
  var h = '<div class="askbox">' + stk('dance', 66) + '<h2>Оноо нэмэх / хасах</h2><p><b>' + who + '</b>' + (tg.sid ? ' (сурагч)' : ' (баг)') + '</p><div class="row qd">' + [-10, -5, 5, 10].map(function (d) { return '<button class="btn sm' + (d > 0 ? ' primary' : '') + '" type="button" data-d="' + d + '">' + (d > 0 ? '+' : '') + d + '</button>'; }).join('') + '</div>' +
    '<label for="aw_d">Оноо (−200 … 200)</label><input id="aw_d" type="number" min="-200" max="200" value="5"><label for="aw_r">Шалтгаан</label><input id="aw_r" type="text" maxlength="100" value="Онцгой сайн тайлбар">' +
    '<div class="row askbtns"><button class="btn" data-m="close" type="button">Болих</button><button class="btn primary" id="aw_ok" type="button">Хадгалах</button></div></div>';
  openModal(h, 'award');
  qsa('[data-d]', $('mbox')).forEach(function (b) { b.addEventListener('click', function () { $('aw_d').value = b.dataset.d; }); });
  $('aw_ok').addEventListener('click', function () {
    var d = parseInt($('aw_d').value, 10); if (!d) { toast('0-ээс ялгаатай тоо оруулна уу.', 'bad'); return; }
    var body = { delta: d, reason: $('aw_r').value }; if (tg.sid) body.sid = tg.sid; else body.team = tg.team;
    post('/api/t/award', body).then(function (j) { if (j.ok) { closeModal(); toast('Оноо тохирууллаа.', 'ok'); } });
  });
}

/* ================= АСУУЛТУУД ================= */
var STAGE_GROUPS = [[1, '1 · Team vs Team', 'Бүх багт ижил асуултууд дарааллаар (slot) гарна.'], [2, '2 · Peer Check', 'Багууд нэг бичгэн хариулт өгч, өөр баг үнэлнэ. Эхний идэвхтэй асуулт ашиглагдана.'], [3, '3 · Enzyme Duel', 'Баг тус бүр өөрийн асуулттай (баг = 1..4).'], [4, '4 · Save Your Team', 'Сэдэв тус бүрийн асуулт: багийн хамгийн сул сэдвээр сонгогдоно.'], [0, 'Сан · ярилцлага', 'Сорилтод ордоггүй, ярилцлагад ашиглах асуултууд.']];
function rQuestions() {
  var s = ST, m = $('main');
  if (!$('qbar')) {
    m.innerHTML = '<div id="qwarn"></div><div class="card qtool" id="qbar"></div><div id="qlist"></div>';
    sigs.qbar = undefined;
  }
  paint($('qwarn'), 'qwarn', String(s.t.phase), function () { return s.t.phase === 'live' ? '<div class="warnbox">⚠ Сорилт явагдаж байна. Асуултыг засах, идэвхгүй болгох, шат солих нь явагдаж буй алхамд нөлөөлж болно — болгоомжтой засна уу.</div>' : ''; });
  paint($('qbar'), 'qbar', String(s.questions.length), function () {
    var sel = function (f, label, val, opts) { return '<div class="fld"><label for="qf_' + f + '">' + label + '</label><select id="qf_' + f + '" data-f="' + f + '"><option value="">Бүгд</option>' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(val) === String(o[0]) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select></div>'; };
    return '<div class="taskhead"><div><h2>Асуултын сан <span class="muted small">(' + s.questions.length + ')</span></h2><div class="muted small">Шат, дугаар (slot), сэдэв, багаар оноож сорилтын урсгалыг бүрдүүлнэ.</div></div><button class="btn primary" data-qa="new">＋ Асуулт нэмэх</button></div>' +
      '<div class="filters">' + sel('stage', 'Шат', qf.stage, STAGE_GROUPS.map(function (g) { return [g[0], g[1]]; })) + sel('type', 'Төрөл', qf.type, Object.keys(TYPEL).map(function (k) { return [k, TYPEL[k]]; })) +
      '<div class="fld grow"><label for="qf_txt">Хайх</label><input type="search" id="qf_txt" data-f="txt" value="' + esc(qf.txt) + '" placeholder="Текст, ойлголт, ID…"></div></div>';
  });
  var sig = JSON.stringify([s.questions, s.qstats, qf, s.settings.areas, s.settings.teams, s.t.phase, s.stages]);
  paint($('qlist'), 'q', sig, function () {
    var txt = qf.txt.toLowerCase();
    var list = s.questions.filter(function (q) { return (qf.stage === '' || q.stage === +qf.stage) && (qf.type === '' || q.type === qf.type) && (!txt || (q.id + ' ' + q.text + ' ' + (q.concept || '')).toLowerCase().indexOf(txt) >= 0); });
    var o = '';
    STAGE_GROUPS.forEach(function (g) {
      var items = list.filter(function (q) { return q.stage === g[0]; }).sort(function (a, b) { return (a.slot - b.slot) || (a.team - b.team) || (a.area - b.area) || (a.order - b.order); });
      if (!items.length && (qf.stage !== '' || txt || qf.type)) return;
      var act = items.filter(function (q) { return q.active; }).length;
      o += '<section class="qgrp"><div class="qghead"><span class="pnum s' + (g[0] || 0) + '">' + (g[0] || '∞') + '</span><div><h3>' + esc(g[1]) + ' <span class="muted small">' + act + ' идэвхтэй / ' + items.length + '</span></h3><div class="small muted">' + esc(g[2]) + '</div></div></div>';
      o += items.length ? items.map(qItem).join('') : '<div class="empty card">' + stk('bread', 56) + '<div class="muted small">Энэ шатанд асуулт алга</div></div>';
      o += '</section>';
    });
    return o || '<div class="empty card">' + stk('mouse', 70) + '<div class="muted">Шүүлтүүрт тохирох асуулт олдсонгүй.</div></div>';
  });
}
function qItem(q) {
  var c = ST.qstats[q.id] || { answered: 0, correct: 0, wrong: 0, partial: 0, pending: 0, expected: 0 }, tot = Math.max(1, c.answered);
  var meta = '<span class="pill white">' + esc(q.id) + '</span><span class="pill">' + esc(TYPEL[q.type] || q.type) + '</span>' + (q.area ? '<span class="pill butter" title="Сэдвийн бүлэг">◆ ' + esc(areaName(q.area) || q.area) + '</span>' : '') + (q.team ? teamTag(q.team) : '') + (q.concept ? '<span class="pill pink">' + esc(q.concept) + '</span>' : '') + (q.image ? '<span class="pill white" title="Зурагтай">🖼</span>' : '') + (q.graph ? '<span class="pill white" title="Графиктай">📈</span>' : '') + '<span class="diff" title="Түвшин ' + q.difficulty + '">' + '●'.repeat(q.difficulty || 1) + '<i>' + '●'.repeat(3 - (q.difficulty || 1)) + '</i></span>';
  var stat = c.answered ? '<div class="qstat"><span class="meter"><i class="m-ok" style="width:' + c.correct / tot * 100 + '%"></i><i class="m-pe" style="width:' + (c.partial + c.pending) / tot * 100 + '%"></i><i class="m-no" style="width:' + c.wrong / tot * 100 + '%"></i></span><span class="small"><b>' + c.answered + '</b> хариулт · ✓' + c.correct + ' ✗' + c.wrong + (c.partial + c.pending ? ' ◐' + (c.partial + c.pending) : '') + '</span></div>' : '<div class="qstat small muted">Хариулт алга</div>';
  return '<div class="qitem' + (q.active ? '' : ' off') + '"><div class="qslot" title="Дугаар (slot)">' + (q.slot || '–') + '</div><div class="qbody"><div class="qmeta">' + meta + '</div><div class="qtxt">' + esc(q.text) + '</div>' + stat + '</div>' +
    '<div class="qact"><button class="tgl' + (q.active ? ' on' : '') + '" data-qa="toggle" data-id="' + q.id + '" role="switch" aria-checked="' + (q.active ? 'true' : 'false') + '" title="' + (q.active ? 'Идэвхтэй' : 'Идэвхгүй') + '"><i></i><span>' + (q.active ? 'Идэвхтэй' : 'Идэвхгүй') + '</span></button>' +
    '<button class="btn sm primary" data-qa="edit" data-id="' + q.id + '">✎ Засах</button><button class="btn sm" data-a="ans" data-q="' + q.id + '">📊 Хариулт</button><button class="btn sm" data-qa="dup" data-id="' + q.id + '" title="Хуулах">⧉</button><span class="seg"><button class="btn sm" data-qa="up" data-id="' + q.id + '" aria-label="Дээш">▲</button><button class="btn sm" data-qa="dn" data-id="' + q.id + '" aria-label="Доош">▼</button></span>' + '<button class="btn sm danger" data-qa="del" data-id="' + q.id + '" aria-label="Устгах">🗑</button>' + presentBtns(q.id, true) + '</div></div>';
}
$('main').addEventListener('change', function (ev) { var b = ev.target; if (TAB === 'questions' && b.dataset && b.dataset.f && b.dataset.f !== 'txt') { qf[b.dataset.f] = b.value; rQuestions(); } });
$('main').addEventListener('input', function (ev) { var b = ev.target; if (TAB === 'questions' && b.dataset && b.dataset.f === 'txt') { qf.txt = b.value; clearTimeout(rQuestions.t); rQuestions.t = setTimeout(rQuestions, 220); } });
$('main').addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-qa]'); if (!b || TAB !== 'questions') return; var a = b.dataset.qa, id = b.dataset.id;
  if (a === 'new') editQ(null); else if (a === 'edit') editQ(qById(id));
  else if (a === 'toggle') post('/api/t/question/toggle', { id: id });
  else if (a === 'dup') post('/api/t/question/duplicate', { id: id }).then(function (j) { j.ok && toast('Хуулагдлаа (' + j.id + ').', 'ok'); });
  else if (a === 'up' || a === 'dn') post('/api/t/question/move', { id: id, dir: a === 'up' ? -1 : 1 });
  else if (a === 'del') ask({ title: 'Асуулт устгах', text: id + ' асуултыг устгах уу? Түүний бүх хариулт хамт устана.', ok: '🗑 Устгах', danger: true }).then(function (y) { if (y) post('/api/t/question/delete', { id: id }).then(function (j) { j.ok && toast('Устгагдлаа.', 'ok'); }); });
});

/* ---------- асуулт засах modal ---------- */
function editQ(q0) {
  var s = ST, n = !q0;
  var q = JSON.parse(JSON.stringify(q0 || { stage: 1, slot: 0, area: 0, team: 0, type: 'mcq', text: '', difficulty: 2, concept: '', active: true, options: ['', '', '', ''], correct: 0, explanation: '', misconception: '', discussion: '' }));
  var opt = function (v, l, cur) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + esc(l) + '</option>'; };
  var stOpts = [0, 1, 2, 3, 4].map(function (k) { return opt(k, k ? k + ' · ' + stageOf(k).name : 'Сан (ярилцлага)', q.stage); }).join('');
  var arOpts = [0, 1, 2, 3, 4].map(function (k) { return opt(k, k ? k + ' · ' + (areaName(k) || ('Сэдэв ' + k)) : '— Сэдэвгүй', q.area); }).join('');
  var tmOpts = [0, 1, 2, 3, 4].map(function (k) { return opt(k, k ? tname(k) : 'Бүх баг', q.team); }).join('');
  var tyOpts = Object.keys(TYPEL).map(function (k) { return opt(k, TYPEL[k], q.type); }).join('');
  var picOpts = opt('', '— Зураггүй', q.image || '') + (s.pics || []).map(function (p) { return opt(p, p, q.image || ''); }).join('');
  var o = '<div class="mhead"><div><div class="muted small">' + (n ? 'ШИНЭ АСУУЛТ' : esc(q.id) + ' · ЗАСАХ') + '</div><h2>' + (n ? 'Асуулт нэмэх' : 'Асуулт засах') + '</h2></div><button class="btn sm" data-m="close" type="button">✕</button></div>';
  if (s.t.phase === 'live') o += '<div class="warnbox">⚠ Сорилт явагдаж байна. Явагдаж буй асуултыг засвал сурагчдын харж буй асуулт, оноо өөрчлөгдөж болно.</div>';
  o += '<div class="frm">' +
    '<div><label for="e_stage">Шат</label><select id="e_stage">' + stOpts + '</select></div>' +
    '<div><label for="e_slot">Дугаар (slot, 0–12)</label><input id="e_slot" type="number" min="0" max="12" value="' + (q.slot || 0) + '"></div>' +
    '<div><label for="e_area">Сэдвийн бүлэг</label><select id="e_area">' + arOpts + '</select></div>' +
    '<div><label for="e_team">Баг (3-р шатанд)</label><select id="e_team">' + tmOpts + '</select></div>' +
    '<div><label for="e_type">Төрөл</label><select id="e_type">' + tyOpts + '</select></div>' +
    '<div><label for="e_diff">Түвшин</label><select id="e_diff">' + opt(1, '1 · хөнгөн', q.difficulty) + opt(2, '2 · дунд', q.difficulty) + opt(3, '3 · хүнд', q.difficulty) + '</select></div>' +
    '<div><label for="e_concept">Ойлголт (concept)</label><input id="e_concept" type="text" maxlength="80" value="' + esc(q.concept || '') + '"></div>' +
    '<div class="checks"><label class="chk"><input id="e_act" type="checkbox"' + (q.active !== false ? ' checked' : '') + '> Идэвхтэй</label><label class="chk"><input id="e_why" type="checkbox"' + (q.askWhy ? ' checked' : '') + '> «Яагаад?» асуух</label><label class="chk"><input id="e_just" type="checkbox"' + (q.askJustify ? ' checked' : '') + '> Үндэслэл бичүүлэх</label></div>' +
    '<div class="full"><label for="e_text">Асуултын текст</label><textarea id="e_text" rows="3" maxlength="1500">' + esc(q.text) + '</textarea></div>' +
    '<div class="full picrow"><div class="grow"><label for="e_img">Зураг</label><select id="e_img">' + picOpts + '</select><div class="small muted">Зургийг public/img/q хавтсанд хуулж оруулна.</div></div><div class="picprev" id="e_imgp"></div></div>' +
    '<div class="full" id="b_opt"><label>Сонголтууд <span class="muted small">(зөвийг тэмдэглэнэ)</span></label><div id="e_opts" class="oped"></div><button class="btn sm" type="button" id="e_addo">＋ Сонголт нэмэх</button></div>' +
    '<div class="full" id="b_tf"><label for="e_tf">Зөв хариулт</label><select id="e_tf">' + opt(1, 'Үнэн', q.correct === true ? 1 : q.correct === false ? 0 : 1) + opt(0, 'Худал', q.correct === false ? 0 : 1) + '</select></div>' +
    '<div class="full" id="b_ord"><label for="e_items">Зөв дарааллаар — мөр тутамд нэг алхам</label><textarea id="e_items" rows="5">' + esc((q.items || []).join('\n')) + '</textarea></div>' +
    '<div class="full" id="b_mat"><label>Хосууд (зүүн ⇒ баруун)</label><div id="e_pairs" class="oped"></div><button class="btn sm" type="button" id="e_addp">＋ Хос нэмэх</button></div>' +
    '<div class="full" id="b_sh"><label for="e_kw">Түлхүүр үгс — мөр тутамд нэг ойлголт, ижил утгатайг таслалаар</label><textarea id="e_kw" rows="3" placeholder="идэвхит төв, active site&#10;субстрат">' + esc((q.keywords || []).map(function (g) { return g.join(', '); }).join('\n')) + '</textarea></div>' +
    '<div class="full"><label for="e_graph">График (заавал биш, JSON)</label><textarea id="e_graph" rows="3" class="mono" placeholder=\'{"title":"…","xlabel":"…","ylabel":"…","series":[{"name":"…","points":[[0,0],[10,5]]}]}\'>' + esc(q.graph ? JSON.stringify(q.graph) : '') + '</textarea><div id="e_gprev"></div></div>' +
    '<div class="full"><label for="e_exp">Тайлбар / загвар хариулт</label><textarea id="e_exp" rows="3">' + esc(q.explanation || '') + '</textarea></div>' +
    '<div><label for="e_mis">Түгээмэл буруу ойлголт</label><textarea id="e_mis" rows="2">' + esc(q.misconception || '') + '</textarea></div>' +
    '<div><label for="e_disc">Ярилцлагын асуулт</label><textarea id="e_disc" rows="2">' + esc(q.discussion || '') + '</textarea></div>' +
    '</div><p id="e_err" class="err hide" role="alert"></p><div class="row mfoot"><button class="btn" data-m="close" type="button">Болих</button><button class="btn primary" id="e_save" type="button">💾 Хадгалах</button></div>';
  openModal(o, 'edit', true);
  var opts = (q.options && q.options.length ? q.options : ['', '', '', '']).map(function (t, i) { return { t: t, c: q.type === 'multi' ? (q.correct || []).indexOf(i) >= 0 : q.correct === i }; });
  var pairs = (q.pairs && q.pairs.length ? q.pairs : [{ l: '', r: '' }, { l: '', r: '' }]).map(function (p) { return { l: p.l, r: p.r }; });
  var readOpts = function () { qsa('#e_opts .oprow').forEach(function (r, i) { opts[i].t = r.querySelector('.ot').value; opts[i].c = r.querySelector('.oc').checked; }); };
  var readPairs = function () { qsa('#e_pairs .oprow').forEach(function (r, i) { pairs[i].l = r.querySelector('.pl').value; pairs[i].r = r.querySelector('.pr').value; }); };
  var drawOpts = function () {
    var multi = $('e_type').value === 'multi';
    $('e_opts').innerHTML = opts.map(function (x, i) { return '<div class="oprow"><label class="okc" title="Зөв хариулт"><input class="oc" type="' + (multi ? 'checkbox' : 'radio') + '" name="e_cor"' + (x.c ? ' checked' : '') + '><span>' + ABC[i] + '</span></label><input class="ot" type="text" maxlength="400" value="' + esc(x.t) + '" placeholder="Сонголт ' + ABC[i] + '"><button class="btn sm ghost" type="button" data-rmo="' + i + '" aria-label="Устгах">✕</button></div>'; }).join('');
  };
  var drawPairs = function () { $('e_pairs').innerHTML = pairs.map(function (p, i) { return '<div class="oprow"><input class="pl" type="text" maxlength="200" value="' + esc(p.l) + '" placeholder="Зүүн"><b class="arrow">⇒</b><input class="pr" type="text" maxlength="300" value="' + esc(p.r) + '" placeholder="Баруун"><button class="btn sm ghost" type="button" data-rmp="' + i + '" aria-label="Устгах">✕</button></div>'; }).join(''); };
  var sync = function () { var t = $('e_type').value; $('b_opt').classList.toggle('hide', t !== 'mcq' && t !== 'multi'); $('b_tf').classList.toggle('hide', t !== 'tf'); $('b_ord').classList.toggle('hide', t !== 'order'); $('b_mat').classList.toggle('hide', t !== 'match'); $('b_sh').classList.toggle('hide', t !== 'short'); readOpts(); if (t === 'mcq') { var f = false; opts.forEach(function (x) { if (x.c && !f) f = true; else x.c = false; }); } drawOpts(); };
  var pic = function () { var v = $('e_img').value; $('e_imgp').innerHTML = v ? '<img src="/img/q/' + encodeURIComponent(v) + '" alt="Урьдчилан харах">' : '<div class="nopic">' + stk('pencil', 40) + '<span class="small muted">Зураггүй</span></div>'; };
  var gprev = function () { var v = $('e_graph').value.trim(), el = $('e_gprev'); if (!v) { el.innerHTML = ''; return; } try { var g = JSON.parse(v); el.innerHTML = graphSVG(g) || '<div class="small err">series хоосон байна.</div>'; } catch (e) { el.innerHTML = '<div class="small err">JSON буруу байна.</div>'; } };
  $('e_type').addEventListener('change', sync); $('e_img').addEventListener('change', pic); $('e_graph').addEventListener('input', gprev);
  $('e_addo').addEventListener('click', function () { readOpts(); if (opts.length >= 8) { toast('Хамгийн ихдээ 8 сонголт.', 'bad'); return; } opts.push({ t: '', c: false }); drawOpts(); });
  $('e_addp').addEventListener('click', function () { readPairs(); if (pairs.length >= 8) { toast('Хамгийн ихдээ 8 хос.', 'bad'); return; } pairs.push({ l: '', r: '' }); drawPairs(); });
  $('e_opts').addEventListener('click', function (ev) { var b = ev.target.closest('[data-rmo]'); if (!b) return; readOpts(); if (opts.length <= 2) { toast('Хамгийн багадаа 2 сонголт.', 'bad'); return; } opts.splice(+b.dataset.rmo, 1); drawOpts(); });
  $('e_pairs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-rmp]'); if (!b) return; readPairs(); if (pairs.length <= 2) { toast('Хамгийн багадаа 2 хос.', 'bad'); return; } pairs.splice(+b.dataset.rmp, 1); drawPairs(); });
  sync(); drawPairs(); pic(); gprev();
  var err = function (m) { var e = $('e_err'); e.textContent = m; e.classList.remove('hide'); e.scrollIntoView({ block: 'nearest' }); };
  $('e_save').addEventListener('click', function () {
    var t = $('e_type').value;
    var b = { id: q.id, stage: +$('e_stage').value, slot: +$('e_slot').value || 0, area: +$('e_area').value, team: +$('e_team').value, type: t, text: $('e_text').value, difficulty: +$('e_diff').value, concept: $('e_concept').value, active: $('e_act').checked, askWhy: $('e_why').checked, askJustify: $('e_just').checked, explanation: $('e_exp').value, misconception: $('e_mis').value, discussion: $('e_disc').value };
    if ($('e_img').value) b.image = $('e_img').value;
    var lines = function (id) { return $(id).value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean); };
    if (t === 'mcq' || t === 'multi') {
      readOpts(); var keep = opts.filter(function (x) { return x.t.trim(); });
      b.options = keep.map(function (x) { return x.t.trim(); });
      var cor = []; keep.forEach(function (x, i) { if (x.c) cor.push(i); });
      if (!cor.length) return err('Зөв хариултыг тэмдэглэнэ үү.');
      b.correct = t === 'mcq' ? cor[0] : cor;
    }
    if (t === 'tf') b.correct = $('e_tf').value === '1';
    if (t === 'order') b.items = lines('e_items');
    if (t === 'match') { readPairs(); b.pairs = pairs.filter(function (p) { return p.l.trim() && p.r.trim(); }).map(function (p) { return { l: p.l.trim(), r: p.r.trim() }; }); }
    if (t === 'short') b.keywords = lines('e_kw').map(function (l) { return l.split(',').map(function (x) { return x.trim(); }).filter(Boolean); });
    var gj = $('e_graph').value.trim(); if (gj) { try { b.graph = JSON.parse(gj); } catch (e) { return err('Графикийн JSON буруу байна.'); } }
    var btn = $('e_save'); btn.classList.add('busy');
    api('/api/t/question', { body: b }).then(function (j) {
      btn.classList.remove('busy');
      if (!j.ok) { if (j._status === 401) { showLogin(); return; } return err(j.err || 'Хадгалж чадсангүй.'); }
      closeModal(); toast('Хадгалагдлаа.', 'ok');
      var c = ST.qstats[q.id]; if (!n && c && c.answered && t !== 'short') ask({ title: 'Дахин шалгах уу?', text: 'Энэ асуултад өмнө ирсэн ' + c.answered + ' хариултыг шинэ зөв хариултаар дахин шалгах уу?', ok: 'Дахин шалгах' }).then(function (y) { if (y) post('/api/t/question/regrade', { id: q.id }).then(function (r) { r.ok && toast(r.n + ' хариулт дахин шалгагдлаа.', 'ok'); }); });
    }).catch(function () { btn.classList.remove('busy'); err('Сүлжээний алдаа.'); });
  });
  setTimeout(function () { $('e_text').focus(); }, 30);
}

/* ================= СУРАГЧ · БАГ ================= */
function rStudents() {
  var s = ST, m = $('main');
  if (!$('stTop')) { m.innerHTML = '<div id="stTop"></div><div class="lgrid"><div class="lmain"><div class="card" id="stList"></div></div><div class="lside"><div class="card tint-butter" id="stAdd"></div><div class="card" id="stTeams"></div></div></div>'; }
  var cnt = [0, 0, 0, 0], on = [0, 0, 0, 0]; s.students.forEach(function (x) { if (x.team >= 1 && x.team <= 4) { cnt[x.team - 1]++; if (x.online) on[x.team - 1]++; } });
  paint($('stTop'), 'stTop', JSON.stringify([cnt, on, s.settings.teams]), function () {
    return '<div class="tiles">' + [1, 2, 3, 4].map(function (k) { return '<div class="tile ttile" style="--tc:' + tcol(k) + '">' + stk(TEAMIMG[k], 40, 'tstk') + '<div class="k">' + esc(tname(k)) + '</div><div class="v">' + cnt[k - 1] + '<small> гишүүн</small></div><div class="tsub">' + on[k - 1] + ' онлайн · ' + esc((s.settings.teams[k - 1] || {}).mission || '') + '</div></div>'; }).join('') + '</div>';
  });
  paint($('stList'), 'st', JSON.stringify([s.students, s.settings.teams, s.settings.pinEnabled]), function () {
    var rows = s.students.slice().sort(function (a, b) { return a.team - b.team || a.name.localeCompare(b.name, 'mn'); });
    return '<div class="taskhead"><div><h2>Сурагчид <span class="muted small">(' + s.students.length + ')</span></h2><div class="small muted">Нэр, баг, PIN-ийг засаад «Хадгалах» дарна.' + (s.settings.pinEnabled ? ' PIN шаардлагатай горим идэвхтэй.' : ' PIN горим унтраалттай (Тохиргоо).') + '</div></div><button class="btn lilac nowrap" data-s="shuffle">🔀 Санамсаргүй хуваарилах</button></div>' +
      '<div class="tbl-wrap"><table class="stbl"><thead><tr><th>Нэр</th><th>Баг</th><th>PIN</th><th>Төлөв</th><th>Оноо</th><th></th></tr></thead><tbody>' + rows.map(function (x) {
        return '<tr data-id="' + esc(x.id) + '" style="--tc:' + tcol(x.team) + '"><td><input type="text" class="sn" data-k="sn-' + esc(x.id) + '" value="' + esc(x.name) + '" maxlength="40" aria-label="Нэр"></td><td><select class="sg" data-k="sg-' + esc(x.id) + '" aria-label="Баг">' + [1, 2, 3, 4].map(function (t) { return '<option value="' + t + '"' + (x.team === t ? ' selected' : '') + '>' + esc(tname(t)) + '</option>'; }).join('') + '</select></td><td><input type="text" class="spin" data-k="sp-' + esc(x.id) + '" value="' + esc(x.pin) + '" maxlength="12" placeholder="—" aria-label="PIN"></td><td class="nowrap"><span class="dot' + (x.online ? ' on' : '') + '"></span>' + (x.online ? 'Онлайн' : 'Офлайн') + '</td><td><b>' + x.score + '</b></td><td class="nowrap"><button class="btn sm primary" data-s="save" title="Хадгалах">💾 Хадгалах</button> <button class="btn sm" data-s="kick" title="Төхөөрөмжийг салгах" aria-label="Салгах">⏏</button> <button class="btn sm danger" data-s="del" aria-label="Устгах">🗑</button></td></tr>';
      }).join('') + '</tbody></table></div>';
  });
  paint($('stAdd'), 'stAdd', JSON.stringify(s.settings.teams.map(function (t) { return t.name; })), function () {
    return '<div class="taskhead"><h3>Сурагч нэмэх</h3>' + stk('pencil', 44) + '</div><label for="ns_name">Нэр</label><input type="text" id="ns_name" maxlength="40" placeholder="Сурагчийн нэр"><label for="ns_team">Баг</label><select id="ns_team"><option value="">Автомат (цөөн гишүүнтэй баг)</option>' + [1, 2, 3, 4].map(function (t) { return '<option value="' + t + '">' + esc(tname(t)) + '</option>'; }).join('') + '</select><button class="btn primary wide" data-s="add" style="margin-top:12px">＋ Нэмэх</button>';
  });
  paint($('stTeams'), 'stTeams', JSON.stringify(s.settings.teams), function () { return '<h3>Багийн нэр, сэдэв</h3>' + teamEditor('st'); });
}
function teamEditor(p) {
  return ST.settings.teams.map(function (t, i) { return '<div class="tedit" style="--tc:' + tcol(i + 1) + '"><div class="row" style="gap:8px">' + stk(TEAMIMG[i + 1], 30) + '<b>Баг ' + (i + 1) + '</b></div><label for="' + p + 'tn' + i + '">Нэр</label><input type="text" id="' + p + 'tn' + i + '" class="tn" data-k="' + p + 'tn' + i + '" maxlength="40" value="' + esc(t.name) + '"><label for="' + p + 'tm' + i + '">Багийн сэдэв (даалгавар)</label><input type="text" id="' + p + 'tm' + i + '" class="tm" data-k="' + p + 'tm' + i + '" maxlength="80" value="' + esc(t.mission || '') + '"><label for="' + p + 'tf' + i + '">Анхаарах ойлголтууд</label><input type="text" id="' + p + 'tf' + i + '" class="tf" data-k="' + p + 'tf' + i + '" maxlength="300" value="' + esc(t.focus || '') + '"></div>'; }).join('') + '<button class="btn primary wide" type="button" data-teams="' + p + '" style="margin-top:12px">💾 Багуудыг хадгалах</button>';
}
function saveTeams(p) {
  var teams = [0, 1, 2, 3].map(function (i) { return { name: $(p + 'tn' + i).value, mission: $(p + 'tm' + i).value, focus: $(p + 'tf' + i).value }; });
  return post('/api/t/settings', { teams: teams }).then(function (j) { if (j.ok) { qsa('[data-k^="' + p + 't"]').forEach(function (n) { delete n.dataset.dirty; }); toast('Багууд хадгалагдлаа.', 'ok'); } return j; });
}
document.addEventListener('click', function (ev) { var b = ev.target.closest('[data-teams]'); if (b) saveTeams(b.dataset.teams).then(function (j) { if (j.ok && TAB === 'settings') { $('main').dataset.drawn = ''; rSettings(); } }); });
$('main').addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-s]'); if (!b || TAB !== 'students') return; var a = b.dataset.s, tr = b.closest('tr'), id = tr && tr.dataset.id;
  var clean = function () { if (tr) qsa('[data-k]', tr).forEach(function (n) { delete n.dataset.dirty; }); };
  if (a === 'save') post('/api/t/student', { id: id, name: tr.querySelector('.sn').value, team: +tr.querySelector('.sg').value, pin: tr.querySelector('.spin').value }).then(function (j) { if (j.ok) { clean(); sigs.st = null; toast('Хадгалагдлаа.', 'ok'); } });
  else if (a === 'del') ask({ title: 'Сурагч устгах', text: '«' + tr.querySelector('.sn').value + '»-г устгах уу? Түүний хариултууд хамт устана.', ok: '🗑 Устгах', danger: true }).then(function (y) { if (y) post('/api/t/student/delete', { id: id }).then(function (j) { j.ok && toast('Устгагдлаа.', 'ok'); }); });
  else if (a === 'kick') post('/api/t/student/kick', { id: id }).then(function (j) { j.ok && toast('Төхөөрөмж салгагдлаа.', 'ok'); });
  else if (a === 'add') { var nm = $('ns_name').value.trim(); if (!nm) { toast('Нэр оруулна уу.', 'bad'); return; } post('/api/t/student', { name: nm, team: $('ns_team').value }).then(function (j) { if (j.ok) { $('ns_name').value = ''; toast('Нэмэгдлээ.', 'ok'); } }); }
  else if (a === 'shuffle') ask({ title: 'Санамсаргүй хуваарилах', text: 'Бүх сурагчийг ' + (ST.students.length === 26 ? '7/7/6/6' : 'тэнцүү') + ' харьцаагаар 4 багт санамсаргүй дахин хуваарилах уу?', ok: '🔀 Хуваарилах' }).then(function (y) { if (y) post('/api/t/teams/shuffle').then(function (j) { j.ok && toast('Багууд дахин хуваарилагдлаа.', 'ok'); }); });
});

/* ================= ДҮН ================= */
function rResults() {
  var s = ST;
  var sig = JSON.stringify([s.teams, s.students, s.charts, s.settings.scoreMode, s.t.phase, s.writeAnswers, s.writeQ, s.qstats, s.settings.teams]);
  paint($('main'), 'res', sig, function () {
    var rank = s.teams.slice().sort(function (a, b) { return a.rank - b.rank; });
    var o = '<div class="printh">ENZYME · ' + esc(s.settings.className) + ' · ' + esc(s.settings.topic) + ' — дүнгийн хураангуй (' + new Date().toLocaleDateString() + ')</div>';
    o += '<div class="card restool noprint"><div class="taskhead"><div><h2>Дүн ба диаграмм</h2><div class="small muted">' + (s.t.phase === 'done' ? 'Сорилт дууссан — эцсийн дүн.' : s.t.phase === 'live' ? 'Сорилт явагдаж байна — дүн шууд шинэчлэгдэнэ (багшид бүх оноо харагдана).' : 'Сорилт эхлээгүй байна.') + '</div></div><div class="row"><a class="btn" href="/api/t/export.csv">⬇ CSV татах</a><button class="btn" data-r="print">🖨 Хэвлэх</button><button class="btn lilac" data-a="board">📽 Байрыг проектор дээр</button></div></div></div>';
    // багийн жагсаалт: podium tile
    o += '<div class="tiles podium">' + rank.map(function (t) { return '<div class="tile ttile" style="--tc:' + tcol(t.team) + '">' + stk(TEAMIMG[t.team], 42, 'tstk') + '<div class="k">#' + t.rank + ' · ' + esc(t.name) + '</div><div class="v">' + t.score + '<small> оноо</small></div><div class="tsub">Дундаж ' + t.avg + ' · багийн ' + t.teamPts + ' · нарийвчлал ' + t.accuracy + '%</div></div>'; }).join('') + '</div>';
    o += '<div class="rgrid"><div class="card"><h3>Шат бүрийн оноо</h3>' + Charts.stacked(rank.map(function (r) { return { name: r.name, color: tcol(r.team), stages: r.stages, score: r.score }; })) + '</div>';
    o += '<div class="card"><h3>Багийн нийт оноо</h3>' + Charts.columns([1, 2, 3, 4].map(function (k) { var t = s.teams[k - 1]; return { label: t.name, value: Math.max(0, t.score), text: t.score, color: tcol(k) }; }), { height: 210 }) + '</div></div>';
    o += '<div class="card"><h3>Багийн дүн</h3><div class="tbl-wrap"><table><thead><tr><th>#</th><th>Баг</th><th>Нийт</th><th>Дундаж</th><th>Багийн</th><th>Ш1</th><th>Ш2</th><th>Ш3</th><th>Ш4</th><th class="noprint"></th></tr></thead><tbody>' + rank.map(function (t) { return '<tr><td class="rk">' + t.rank + '</td><td class="nowrap">' + teamTag(t.team) + ' <span class="small muted">' + t.members + ' гишүүн</span></td><td><b>' + t.score + '</b></td><td>' + t.avg + '</td><td>' + t.teamPts + '</td><td>' + t.stages[1] + '</td><td>' + t.stages[2] + '</td><td>' + t.stages[3] + '</td><td>' + t.stages[4] + '</td><td class="noprint"><button class="btn sm" data-a="award" data-t="' + t.team + '">± оноо</button></td></tr>'; }).join('') + '</tbody></table></div><div class="small muted">' + (s.settings.scoreMode === 'sum' ? 'Гишүүдийн нийлбэр оноо' : 'Гишүүдийн дундаж оноо (7 ба 6 гишүүнтэй багт шударга)') + ' + багийн оноо.</div></div>';
    // асуулт тус бүр
    var perQ = (s.charts && s.charts.perQ) || [];
    var extra = s.questions.filter(function (q) { return q.stage === 3 && (s.qstats[q.id] || {}).answered; });
    if (perQ.length || extra.length) {
      o += '<div class="card"><div class="taskhead"><h3>Асуулт тус бүрийн зөв / буруу</h3><span class="small muted">Дарж хүн бүрийн хариултыг харна</span></div><div class="dgrid">';
      perQ.forEach(function (p, i) { o += donutCard(p.id, '1-р шат · А' + (i + 1), p.text, p.dist.correct, p.dist.wrong, p.dist.partial || 0, Math.max(0, p.dist.total - p.dist.answered)); });
      extra.forEach(function (q) { var c = s.qstats[q.id]; o += donutCard(q.id, '3-р шат · ' + tname(q.team || 1), q.text, c.correct, c.wrong, c.partial + c.pending, 0); });
      o += '</div>' + Charts.legend([{ label: 'Зөв', color: CH.mint }, { label: 'Буруу', color: CH.rose }, { label: 'Хэсэгчлэн / үнэлгээгүй', color: CH.butter }, { label: 'Хариулаагүй', color: CH.track }]) + '</div>';
    }
    var con = (s.charts && s.charts.concepts) || [];
    o += '<div class="card"><h3>Сэдэв / ойлголтоор</h3>' + (con.length ? Charts.hbars(con.map(function (c) { return { label: c.name, value: c.pct, text: c.pct + '% · ' + c.n, color: c.pct >= 70 ? CH.mint : c.pct >= 40 ? CH.butter : CH.pink }; }), { max: 100 }) + '<div class="small muted" style="margin-top:8px">Хамгийн сул ойлголт дээрээ. Ярилцлагад эндээс эхлээрэй.</div>' : '<div class="empty">' + stk('mol', 60) + '<div class="muted small">Хариулт ирэхэд энд гарна</div></div>') + '</div>';
    if (s.writeQ) o += '<div class="noprint">' + writePanel() + '</div>';
    o += '<div class="card"><h3>Сурагчдын дүн</h3><div class="tbl-wrap"><table><thead><tr><th>#</th><th>Сурагч</th><th>Баг</th><th>Нийт</th><th>Хувийн</th><th>Peer</th><th>Зөв</th><th>Хариулт</th><th class="noprint"></th></tr></thead><tbody>' + s.students.slice().sort(function (a, b) { return b.score - a.score || a.name.localeCompare(b.name, 'mn'); }).map(function (x, i) { return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(x.name) + '</b></td><td>' + teamTag(x.team) + '</td><td><b>' + x.score + '</b></td><td>' + x.ind + '</td><td>' + x.peer + '</td><td>' + x.correct + '</td><td>' + x.answers + '</td><td class="noprint"><button class="btn sm" data-a="award" data-s="' + esc(x.id) + '" data-n="' + esc(x.name) + '">± оноо</button></td></tr>'; }).join('') + '</tbody></table></div></div>';
    return o;
  });
}
function donutCard(qid, label, text, ok, no, part, none) {
  var tot = ok + no + part + none, ans = ok + no + part;
  return '<button class="dcard" type="button" data-a="ans" data-q="' + esc(qid) + '">' + Charts.donut([{ value: ok, color: CH.mint }, { value: no, color: CH.rose }, { value: part, color: CH.butter }, { value: none, color: CH.track }], { center: ans ? Math.round(ok / ans * 100) + '%' : '–', sub: 'зөв', size: 112, label: label }) + '<div class="dl"><b>' + esc(label) + '</b><span class="clamp2 small">' + esc(text) + '</span><span class="small muted">✓' + ok + ' ✗' + no + (part ? ' ◐' + part : '') + (none ? ' · ' + none + ' хариулаагүй' : '') + (tot ? '' : ' —') + '</span></div></button>';
}
$('main').addEventListener('click', function (ev) { var b = ev.target.closest('[data-r]'); if (!b || TAB !== 'results') return; if (b.dataset.r === 'print') { var old = document.title; document.title = 'ENZYME ' + ST.settings.className + ' — дүн'; window.print(); document.title = old; } });

/* ================= ЯРИЛЦЛАГА ================= */
function rDisc() {
  var s = ST;
  paint($('main'), 'disc', JSON.stringify([s.questions, s.settings.discussion, s.stages]), function () {
    var o = '<div class="card tint-lilac"><div class="taskhead"><div><h2>Ярилцлагын горим (60 минут)</h2><div class="muted small">Асуулт, зөв хариулт, тайлбар, буруу ойлголт, ярилцлагын асуултыг 📽 товчоор проектор дээр гаргана.</div></div>' + stk('bubble', 60) + '</div><div class="row"><a class="btn primary" href="/projector" target="_blank" rel="noopener">📽 Проектор нээх</a><button class="btn" data-a="board">🏆 Байр харуулах</button><button class="btn ghost" data-a="clearp">Проекторыг цэвэрлэх</button></div></div>';
    o += '<h3 class="sech">Хичээлийн төлөвлөгөө</h3><div class="dplan">' + s.settings.discussion.map(function (d, i) {
      return '<div class="card dcardp"><div class="row" style="justify-content:space-between"><span class="pill butter">⏱ ' + esc(d.min) + ' мин</span><span class="pill white">' + (i + 1) + '/' + s.settings.discussion.length + '</span></div><h3 style="margin:8px 0">' + esc(d.title) + '</h3>' +
        d.prompts.map(function (p) { return '<div class="dprompt"><button class="btn sm" data-a="present" data-k="text" data-text="' + esc(p) + '" data-title="' + esc(d.title) + '" title="Проектор дээр харуулах">📽</button><span>' + esc(p) + '</span></div>'; }).join('') +
        '<details class="dedit"><summary class="small muted">✎ Асуултуудыг засах</summary><textarea class="dp" data-k="dp' + i + '" data-i="' + i + '" rows="5">' + esc(d.prompts.join('\n')) + '</textarea><button class="btn sm primary" data-d="save" data-i="' + i + '">Хадгалах</button></details></div>';
    }).join('') + '</div>';
    o += '<h3 class="sech">Асуултууд: хариулт, тайлбар, буруу ойлголт</h3>';
    [1, 2, 3, 4, 0].forEach(function (st) {
      var qs = s.questions.filter(function (q) { return q.stage === st && q.active; }).sort(function (a, b) { return a.slot - b.slot || a.order - b.order; }); if (!qs.length) return;
      o += '<div class="dgh"><span class="pnum s' + st + '">' + (st || '∞') + '</span><b>' + (st ? esc(stageOf(st).name) : 'Сан') + '</b></div>';
      o += qs.map(function (q) { return '<div class="card dq"><div class="row" style="justify-content:space-between;gap:8px"><div class="qmeta"><span class="pill white">' + esc(q.id) + '</span>' + (q.team ? teamTag(q.team) : '') + (q.concept ? '<span class="pill pink">' + esc(q.concept) + '</span>' : '') + '</div>' + presentBtns(q.id) + '</div>' + qFull(q) + '</div>'; }).join('');
    });
    return o;
  });
}
$('main').addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-d]'); if (!b || TAB !== 'disc') return; var i = +b.dataset.i;
  var d = ST.settings.discussion.map(function (x) { return { min: x.min, title: x.title, prompts: x.prompts.slice() }; });
  var ta = document.querySelector('.dp[data-i="' + i + '"]'); d[i].prompts = ta.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  post('/api/t/settings', { discussion: d }).then(function (j) { if (j.ok) { delete ta.dataset.dirty; sigs.disc = null; toast('Хадгалагдлаа.', 'ok'); } });
});

/* ================= ТОХИРГОО ================= */
var SCORE_INFO = [['ind', 'Хувийн зөв хариулт', '1, 3-р шатанд сурагч бүр зөв хариулбал авна.'], ['teamQ', 'Багийн зөв хариулт', '1-р шатанд багийн олонх зөв, 2-р шатанд багийн хариулт «Зөв», 3, 4-р шатанд түгжсэн хариулт зөв бол багт өгнө.'], ['teamPartial', 'Багийн хэсэгчлэн зөв', '2-р шатанд багийн бичсэн хариулт «Хэсэгчлэн зөв» гэж үнэлэгдвэл.'], ['peerHit', 'Peer Check — яг таарсан', 'Өөр багийн хариултыг эцсийн үнэлгээтэй яг ижил үнэлсэн сурагч бүрт.'], ['peerNear', 'Peer Check — ойролцоо', 'Үнэлгээ нь нэг шатаар зөрсөн (жишээ нь Зөв ↔ Хэсэгчлэн) сурагчид.']];
var TIME_INFO = [['q', '1-р шат · асуулт бүр', { ind: 'Хувийн хариулт', rev: 'Үр дүн, тайлбар' }], ['write', '2-р шат · багийн хариулт', { team: 'Багийн хариулт бичих' }], ['peer', '2-р шат · Peer Check', { peer: 'Өөр багийг үнэлэх', rev: 'Үр дүн' }], ['duel', '3-р шат · Enzyme Duel', { ind: 'Хувийн хариулт', team: 'Багийн хэлэлцүүлэг, түгжих', rev: 'Үр дүн' }], ['final', '4-р шат · Save Your Team', { team: 'Багийн хариулт', rev: 'Үр дүн' }]];
function rSettings() {
  var m = $('main'); if (m.dataset.drawn === 'set') return; m.dataset.drawn = 'set';
  var s = ST.settings, chk = function (id, v, l, d) { return '<label class="chk big"><input id="' + id + '" type="checkbox"' + (v ? ' checked' : '') + '><span><b>' + l + '</b>' + (d ? '<small>' + d + '</small>' : '') + '</span></label>'; };
  var o = '<div class="setgrid">';
  o += '<div class="card"><div class="taskhead"><h3>Хичээл ба нэвтрэлт</h3>' + stk('atom', 44) + '</div><div class="frm"><div><label for="c_class">Ангийн нэр</label><input id="c_class" type="text" maxlength="40" value="' + esc(s.className) + '"></div><div><label for="c_topic">Сэдэв</label><input id="c_topic" type="text" maxlength="60" value="' + esc(s.topic) + '"></div><div><label for="c_subj">Хичээл</label><input id="c_subj" type="text" maxlength="60" value="' + esc(s.subject || '') + '"></div><div><label for="c_code">Хичээлийн код (сурагчид оруулна)</label><input id="c_code" type="text" maxlength="30" value="' + esc(s.code) + '"></div><div class="full"><label for="c_user">Багшийн нэвтрэх нэр</label><input id="c_user" type="text" maxlength="60" autocomplete="off" value="' + esc(s.teacherUser) + '"></div>' +
    '<div class="full"><label for="c_sm">Багийн онооны горим</label><select id="c_sm"><option value="avg"' + (s.scoreMode === 'avg' ? ' selected' : '') + '>Гишүүдийн дундаж + багийн оноо (7 ба 6 гишүүнтэй багт шударга)</option><option value="sum"' + (s.scoreMode === 'sum' ? ' selected' : '') + '>Гишүүдийн нийлбэр + багийн оноо</option></select></div></div>' +
    '<div class="checks col2">' + chk('c_pin', s.pinEnabled, 'Сурагчийн PIN шаардах', 'Сурагч·Баг табаас PIN онооно') + chk('c_auto', s.autoAdvance, 'Автомат урсгал', 'Үр дүнгийн үе дуусахад дараагийн алхам руу автоматаар шилжинэ') + chk('c_chat', s.chatOn, 'Багийн чат нээлттэй', 'Сурагчид багийнхантайгаа бичилцэнэ') + '</div>' +
    '<button class="btn primary" type="button" id="c_save">💾 Хадгалах</button></div>';
  o += '<div class="card"><div class="taskhead"><h3>Оноо</h3>' + stk('egg', 44) + '</div>' + SCORE_INFO.map(function (x) { return '<div class="srow"><div><b>' + x[1] + '</b><div class="small muted">' + x[2] + '</div></div><input type="number" min="0" max="100" class="sc" data-key="' + x[0] + '" value="' + (s.scoring[x[0]] != null ? s.scoring[x[0]] : 0) + '" aria-label="' + esc(x[1]) + '"></div>'; }).join('') + '<button class="btn primary" type="button" id="c_save_sc">💾 Оноо хадгалах</button></div>';
  o += '<div class="card"><div class="taskhead"><h3>Хугацаа (секунд)</h3>' + stk('bread', 44) + '</div>' + TIME_INFO.map(function (x) { var tm = s.timing[x[0]] || {}; return '<div class="tgrp"><div class="tgh"><b>' + x[1] + '</b><span class="pill white js-sub" data-kind="' + x[0] + '"></span></div><div class="trow">' + Object.keys(x[2]).map(function (p) { return '<div><label for="tm_' + x[0] + p + '">' + x[2][p] + '</label><input id="tm_' + x[0] + p + '" type="number" min="5" max="900" class="tm_in" data-kind="' + x[0] + '" data-ph="' + p + '" value="' + (tm[p] != null ? tm[p] : 30) + '"></div>'; }).join('') + '</div></div>'; }).join('') + '<div class="ttotal" id="t_total"></div><button class="btn primary" type="button" id="c_save_tm">💾 Хугацаа хадгалах</button></div>';
  o += '<div class="card"><div class="taskhead"><h3>Багууд</h3>' + stk('purple', 44) + '</div>' + teamEditor('se') + '</div>';
  o += '<div class="card"><div class="taskhead"><h3>Нууц үг солих</h3>' + stk('mouse', 44) + '</div><label for="p_cur">Одоогийн нууц үг</label><input id="p_cur" type="password" autocomplete="current-password"><label for="p_new">Шинэ нууц үг (8+ тэмдэгт)</label><input id="p_new" type="password" autocomplete="new-password"><label for="p_con">Шинэ нууц үг давтах</label><input id="p_con" type="password" autocomplete="new-password"><p id="p_err" class="err hide" role="alert"></p><button class="btn primary" type="button" id="p_save" style="margin-top:12px">🔑 Нууц үг солих</button></div>';
  o += '<div class="card"><div class="taskhead"><h3>Нөөцлөлт</h3>' + stk('dna', 44) + '</div><p class="small muted">Бүх сурагч, асуулт, оноо, тохиргоог нэг файлд татаж хадгална. Сорилт эхлэх, дуусах, шинэчлэхийн өмнө систем өөрөө автомат нөөц хийдэг.</p><div class="row"><a class="btn" href="/api/t/backup.json">⬇ Нөөц файл татах</a><label class="btn lilac fileb">⬆ Нөөцөөс сэргээх<input type="file" id="b_file" accept="application/json,.json" class="hide"></label></div>' +
    '<div class="dzone"><h3>Шинээр эхлүүлэх</h3><p class="small muted">Бүх хариулт, оноо, чатыг устгаж сорилтыг эхлэхэд бэлэн болгоно. Сурагч, асуулт, тохиргоо хэвээр үлдэнэ.</p><button class="btn danger" type="button" data-a="reset">♻ Шинээр эхлүүлэх</button></div></div>';
  o += '</div>';
  m.innerHTML = o;
  var calc = function () {
    var v = function (k, p) { var e = document.querySelector('.tm_in[data-kind="' + k + '"][data-ph="' + p + '"]'); return e ? (+e.value || 0) : 0; };
    var act = function (st) { return ST.questions.filter(function (q) { return q.active && q.stage === st; }).length; };
    var n1 = act(1), hasW = act(2) > 0, hasD = act(3) > 0, hasF = act(4) > 0;
    var sub = { q: v('q', 'ind') + v('q', 'rev'), write: v('write', 'team'), peer: v('peer', 'peer') + v('peer', 'rev'), duel: v('duel', 'ind') + v('duel', 'team') + v('duel', 'rev'), final: v('final', 'team') + v('final', 'rev') };
    var tot = n1 * sub.q + (hasW ? sub.write + sub.peer : 0) + (hasD ? sub.duel : 0) + (hasF ? sub.final : 0);
    qsa('.js-sub').forEach(function (e) { var k = e.dataset.kind; e.textContent = k === 'q' ? n1 + ' × ' + sub.q + 'с = ' + mmss(n1 * sub.q) : mmss(sub[k]); });
    $('t_total').innerHTML = '<span>Сорилтын нийт хугацаа</span><b>≈ ' + mmss(tot) + '</b><small>1-р шат ' + n1 + ' асуулт · ' + (hasW ? '2-р шат ✓' : '2-р шат асуултгүй') + ' · ' + (hasD ? '3-р шат ✓' : '3-р шат асуултгүй') + ' · ' + (hasF ? '4-р шат ✓' : '4-р шат асуултгүй') + '</small>';
  };
  qsa('.tm_in').forEach(function (e) { e.addEventListener('input', calc); }); calc();
  var redraw = function () { m.dataset.drawn = ''; setTimeout(rSettings, 0); };
  $('c_save').onclick = function () { post('/api/t/settings', { className: $('c_class').value, topic: $('c_topic').value, subject: $('c_subj').value, code: $('c_code').value, teacherUser: $('c_user').value, scoreMode: $('c_sm').value, pinEnabled: $('c_pin').checked, autoAdvance: $('c_auto').checked, chatOn: $('c_chat').checked }).then(function (j) { if (j.ok) { toast('Тохиргоо хадгалагдлаа.', 'ok'); redraw(); } }); };
  $('c_save_sc').onclick = function () { var sc = {}; qsa('.sc').forEach(function (e) { sc[e.dataset.key] = +e.value; }); post('/api/t/settings', { scoring: sc }).then(function (j) { if (j.ok) { toast('Оноо хадгалагдлаа.', 'ok'); redraw(); } }); };
  $('c_save_tm').onclick = function () { var tm = {}; qsa('.tm_in').forEach(function (e) { (tm[e.dataset.kind] = tm[e.dataset.kind] || {})[e.dataset.ph] = +e.value; }); post('/api/t/settings', { timing: tm }).then(function (j) { if (j.ok) { toast('Хугацаа хадгалагдлаа.', 'ok'); redraw(); } }); };
  $('p_save').onclick = function () { var e = $('p_err'); e.classList.add('hide'); if ($('p_new').value !== $('p_con').value) { e.textContent = 'Шинэ нууц үг давтахтай таарахгүй байна.'; e.classList.remove('hide'); return; } api('/api/t/password', { body: { current: $('p_cur').value, next: $('p_new').value, confirm: $('p_con').value } }).then(function (j) { if (!j.ok) { e.textContent = j.err || 'Алдаа гарлаа.'; e.classList.remove('hide'); return; } toast('Нууц үг амжилттай солигдлоо.', 'ok'); $('p_cur').value = $('p_new').value = $('p_con').value = ''; }); };
  $('b_file').onchange = function () { var f = this.files[0], inp = this; if (!f) return; var rd = new FileReader(); rd.onload = function () { var d; try { d = JSON.parse(rd.result); } catch (e) { toast('Файл буруу байна.', 'bad'); inp.value = ''; return; } ask({ title: 'Нөөцөөс сэргээх', text: 'Одоогийн бүх өгөгдлийг «' + f.name + '» нөөцөөр солих уу? Одоогийн төлөв автоматаар нөөцлөгдөнө.', ok: '⬆ Сэргээх', danger: true }).then(function (y) { inp.value = ''; if (y) post('/api/t/restore', { data: d }).then(function (j) { if (j.ok) { toast('Сэргээгдлээ.', 'ok'); redraw(); } }); }); }; rd.readAsText(f); };
}

/* ================= БАГИЙН ЧАТ ================= */
function buildDrawer() {
  $('drawer').innerHTML = '<div class="dhead"><span class="dhi">' + ico('chat', 22) + '</span><div class="dht"><b>Багийн чат</b><small id="chState"></small></div><span class="sp"></span><button class="btn sm" id="chToggle" type="button"></button><button class="ibtn" id="chClose" type="button" aria-label="Хаах">✕</button></div>' +
    '<div class="dtabs" id="chTabs" role="tablist"></div><div class="dlog" id="chLog" aria-live="polite"></div>' +
    '<form class="dform" id="chForm"><div class="dto"><button type="button" class="dtob on" data-to="team" id="chToTeam">Энэ багт</button><button type="button" class="dtob" data-to="all" id="chToAll">Бүх багт</button></div><div class="dinp"><input id="chInput" type="text" maxlength="300" autocomplete="off" placeholder="Багшийн нэрээр бичих…"><button class="btn primary" type="submit">Илгээх</button></div></form>';
  $('chClose').addEventListener('click', function () { toggleChat(false); });
  $('chToggle').addEventListener('click', function () { ctl(ST && ST.chatOff ? 'chaton' : 'chatoff'); });
  $('chTabs').addEventListener('click', function (ev) { var b = ev.target.closest('[data-ct]'); if (!b) return; chatTeam = +b.dataset.ct; sigs.chlog = null; markSeen(); renderChat(); scrollChat(true); });
  $('chForm').addEventListener('click', function (ev) { var b = ev.target.closest('[data-to]'); if (!b) return; chatAll = b.dataset.to === 'all'; $('chToTeam').classList.toggle('on', !chatAll); $('chToAll').classList.toggle('on', chatAll); $('chInput').placeholder = chatAll ? 'Бүх 4 багт зэрэг илгээнэ…' : tname(chatTeam) + '-д багшийн нэрээр…'; });
  $('chForm').addEventListener('submit', function (ev) {
    ev.preventDefault(); var i = $('chInput'), txt = i.value.trim(); if (!txt) return;
    post('/api/t/chat', { team: chatAll ? 0 : chatTeam, text: txt }).then(function (j) { if (j.ok) { i.value = ''; i.focus(); } });
  });
  $('chLog').addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-del]'); if (!b) return;
    post('/api/t/chat/delete', { team: chatTeam, id: b.dataset.del }).then(function (j) { if (j.ok) { CHAT[chatTeam] = CHAT[chatTeam].filter(function (m) { return m.id !== b.dataset.del; }); sigs.chlog = null; renderChat(); toast('Мессеж устгагдлаа.', 'ok'); } });
  });
}
function onChat(d) {
  if (!d || !d.team || !d.msg) return; var arr = CHAT[d.team] = CHAT[d.team] || [];
  if (!arr.some(function (m) { return m.id === d.msg.id; })) arr.push(d.msg);
  if (chatOpen && d.team === chatTeam) markSeen(); renderChat();
}
function unread(t) { return (CHAT[t] || []).filter(function (m) { return !m.teacher && m.t > (seen[t] || 0); }).length; }
function markSeen() { var a = CHAT[chatTeam] || []; var mx = a.length ? a[a.length - 1].t : 0; if (mx > (seen[chatTeam] || 0)) { seen[chatTeam] = mx; store('enzT_seen', seen); } }
function toggleChat(v) {
  chatOpen = v; $('drawer').classList.toggle('hide', !v); document.body.classList.toggle('chatopen', v);
  if (v) { if (!unread(chatTeam)) { for (var t = 1; t <= 4; t++) if (unread(t)) { chatTeam = t; break; } } sigs.chlog = null; markSeen(); renderChat(); scrollChat(true); if (window.innerWidth >= 1000) setTimeout(function () { $('chInput').focus(); }, 50); }
  else renderChat();
}
function scrollChat(force) { var l = $('chLog'); if (!l) return; if (force || l.scrollHeight - l.scrollTop - l.clientHeight < 120) l.scrollTop = l.scrollHeight; }
function renderChat() {
  if (!ST) return; if (chatOpen) markSeen(); var total = 0; for (var t = 1; t <= 4; t++) total += unread(t);
  var fab = '<span class="fbi">' + ico('chat', 24) + '</span><span class="fl">Чат</span>' + (total ? '<span class="dotnew">' + (total > 99 ? '99+' : total) + '</span>' : '') + (ST.chatOff ? '<span class="lockb" title="Чат хаалттай">🔕</span>' : '');
  if ($('chatFab').dataset.h !== fab) { $('chatFab').dataset.h = fab; $('chatFab').innerHTML = fab; }
  $('chatFab').classList.toggle('on', chatOpen);
  if (!chatOpen) return;
  $('chState').textContent = ST.chatOff ? 'Сурагчдын чат хаалттай' : (ST.settings.chatOn ? 'Шууд · 4 багийн чат' : 'Тохиргоонд чат унтраалттай');
  $('chToggle').textContent = ST.chatOff ? '💬 Нээх' : '🔕 Хаах';
  var tabs = [1, 2, 3, 4].map(function (k) { var u = unread(k); return '<button type="button" role="tab" aria-selected="' + (k === chatTeam) + '" class="dtab' + (k === chatTeam ? ' on' : '') + '" data-ct="' + k + '" style="--tc:' + tcol(k) + '">' + stk(TEAMIMG[k], 22) + '<span>' + esc(tname(k)) + '</span>' + (u ? '<em>' + u + '</em>' : '') + '</button>'; }).join('');
  if ($('chTabs').dataset.h !== tabs) { $('chTabs').dataset.h = tabs; $('chTabs').innerHTML = tabs; }
  if (!chatAll) $('chInput').placeholder = tname(chatTeam) + '-д багшийн нэрээр…';
  var msgs = CHAT[chatTeam] || [], lg = $('chLog');
  var sig = JSON.stringify([chatTeam, msgs.length, msgs.length && msgs[msgs.length - 1].id, msgs.map(function (m) { return m.id; }).join(',')]);
  if (sigs.chlog === sig) return; sigs.chlog = sig;
  var near = lg.scrollHeight - lg.scrollTop - lg.clientHeight < 120;
  lg.innerHTML = msgs.length ? msgs.map(function (m) {
    return '<div class="cmsg' + (m.teacher ? ' teacher' : '') + '"><div class="cmh"><b>' + esc(m.teacher ? '👩‍🏫 ' + (m.name || 'Багш') : m.name) + '</b><time>' + hhmm(m.t) + '</time><button class="cdel" type="button" data-del="' + esc(m.id) + '" aria-label="Устгах" title="Устгах">✕</button></div><div class="cmt">' + esc(m.text) + '</div></div>';
  }).join('') : '<div class="empty">' + stk('bubble', 70) + '<div class="muted small">' + esc(tname(chatTeam)) + '-д мессеж алга</div></div>';
  if (near) lg.scrollTop = lg.scrollHeight;
  markSeen();
}
})();
