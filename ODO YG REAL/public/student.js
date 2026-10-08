/* ENZYME — сурагчийн хуудас (4 шаттай урсгал) */
(function () {
'use strict';
var $ = function (id) { return document.getElementById(id); };
function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }

var TOKEN = lsGet('enz_token'), ST = null, OFF = 0, sock = null, poll = null, lastStateAt = 0, live = false;
var CODE = '', NAMES = [], needPin = false, pending = null;
var drafts = {}, inflight = {};
var UI = { intro: {}, stageOpen: {}, chatOpen: false, chatInit: false, seen: {}, msgs: [], unread: 0, confetti: false, cuteI: 0 };
try { drafts = JSON.parse(ssGet('enz_drafts') || '{}') || {}; } catch (e) { drafts = {}; }
var draftT = null;
function saveDrafts() { if (draftT) return; draftT = setTimeout(function () { draftT = null; var ks = Object.keys(drafts); if (ks.length > 30) ks.slice(0, ks.length - 30).forEach(function (k) { delete drafts[k]; }); ssSet('enz_drafts', JSON.stringify(drafts)); }, 400); }
function flushDrafts() { if (draftT) { clearTimeout(draftT); draftT = null; } ssSet('enz_drafts', JSON.stringify(drafts)); }
window.addEventListener('pagehide', flushDrafts); document.addEventListener('visibilitychange', function () { if (document.hidden) flushDrafts(); });
function D(key) { return drafts[key] || (drafts[key] = {}); }

var SCREENS = ['s-code', 's-names', 's-main', 's-boot'];
function show(id) {
  SCREENS.forEach(function (x) { $(x).classList.toggle('hide', x !== id); });
  live = id === 's-main';
  $('chatRoot').classList.toggle('hide', !live); $('meChip').classList.toggle('hide', !live);
  if (!live) $('tmTop').classList.add('hide');
  document.body.classList.toggle('in', live);
}
function err(id, m) { var e = $(id); e.textContent = m || ''; e.classList.toggle('hide', !m); }
var num = function (x) { x = +x || 0; return Math.round(x * 10) / 10; };
var RL = { ok: '✅ Зөв', partial: '🟡 Хэсэгчлэн зөв', wrong: '❌ Буруу' };
var PAL = ['pink', 'lilac', 'butter', 'mint', 'peach', 'sky'];
function avatar(name, sz) { return '<span class="av" style="width:' + (sz || 26) + 'px;height:' + (sz || 26) + 'px"><img src="/img/' + pick('all', name) + '.png" alt="" loading="lazy"></span>'; }
function teamSt(t, w, cls) { return stk(TEAMIMG[t] || 'purple', w || 60, cls || ''); }
function hm(ts) { var d = new Date(ts); return (d.getHours() < 10 ? '0' : '') + d.getHours() + ':' + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes(); }

/* ------------------------------ эхлэл ------------------------------ */
api('/api/public').then(function (j) { if (j && j.className) $('clsPill').textContent = j.className; }).catch(function () {});
var savedCode = lsGet('enz_code'); if (savedCode) $('code').value = savedCode;
var urlCode = ''; try { urlCode = (new URLSearchParams(location.search).get('c') || '').slice(0, 40); } catch (e) {}
if (urlCode) { $('code').value = urlCode; setTimeout(function () { try { if (history.replaceState) history.replaceState(null, '', location.pathname); } catch (e) {} $('codeBtn').click(); }, 400); }
if (TOKEN) {
  api('/api/state', { token: TOKEN }).then(function (j) { if (j.ok) { start(); apply(j.state); } else { setToken(null); show('s-code'); } })
    .catch(function () { show('s-code'); });
} else show('s-code');

function setToken(t) { TOKEN = t; lsSet('enz_token', t || null); }

/* ------------------------------ нэвтрэх ------------------------------ */
$('codeForm').addEventListener('submit', function (ev) {
  ev.preventDefault(); var b = $('codeBtn'); if (b.classList.contains('busy')) return; err('codeErr', '');
  var c = $('code').value.trim(); if (!c) return err('codeErr', 'Хичээлийн кодоо оруулна уу.');
  b.classList.add('busy');
  api('/api/code', { body: { code: c } }).then(function (j) {
    b.classList.remove('busy'); if (!j.ok) return err('codeErr', j.err || 'Хичээлийн код буруу байна.');
    CODE = c; NAMES = j.students || []; $('pinBox').classList.add('hide'); renderNames(j.pin); show('s-names');
  }).catch(function () { b.classList.remove('busy'); err('codeErr', 'Холболт тасарлаа. Дахин оролдоно уу.'); });
});
function renderNames(pin) {
  needPin = pin; pending = null; err('nameErr', '');
  $('names').innerHTML = NAMES.map(function (s) {
    return '<button class="namebtn" data-id="' + esc(s.id) + '" type="button"><span class="ini ' + PAL[hashStr(s.name) % PAL.length] + '">' + esc(s.name.charAt(0)) + '</span><span class="nmt">' + esc(s.name) + '</span>' + (s.online ? '<span class="dot on" title="Холбогдсон"></span>' : '') + '</button>';
  }).join('');
}
$('names').addEventListener('click', function (ev) {
  var b = ev.target.closest('.namebtn'); if (!b) return; err('nameErr', ''); pending = b.dataset.id;
  [].forEach.call(document.querySelectorAll('.namebtn'), function (x) { x.classList.toggle('sel', x === b); });
  if (needPin) { $('pinBox').classList.remove('hide'); $('pin').focus(); } else doLogin(false);
});
$('pinBtn').addEventListener('click', function () { doLogin(false); });
$('pin').addEventListener('keydown', function (e) { if (e.key === 'Enter') doLogin(false); });
$('backBtn').addEventListener('click', function () { show('s-code'); });
function doLogin(takeover) {
  if (!pending) return; var nm = NAMES.filter(function (x) { return x.id === pending; })[0];
  api('/api/student/login', { body: { code: CODE, id: pending, pin: $('pin').value, takeover: !!takeover, token: TOKEN } }).then(function (j) {
    if (j.need === 'takeover') {
      ask((nm ? nm.name + ' — ' : '') + 'өөр төхөөрөмж холбогдсон байна', 'Энэ нэр дээр өөр утас эсвэл компьютер холбогдсон байна. Энэ чи мөн үү? Үргэлжлүүлбэл нөгөө төхөөрөмж салгагдана.', 'Тийм, би мөн', 'Үгүй', 'mouse2')
        .then(function (y) { if (y) doLogin(true); });
      return;
    }
    if (!j.ok) return err('nameErr', j.err || 'Нэвтэрч чадсангүй.');
    setToken(j.token); lsSet('enz_code', CODE); toast('Амжилттай нэвтэрлээ.', 'ok'); start(); fetchState();
  }).catch(function () { err('nameErr', 'Холболт тасарлаа. Дахин оролдоно уу.'); });
}
function logout(msg) {
  setToken(null); if (sock) { try { sock.close(); } catch (e) {} sock = null; }
  if (poll) { clearInterval(poll); poll = null; } ST = null; $('s-main').innerHTML = ''; UI.msgs = []; UI.chatInit = false; UI.seen = {}; UI.unread = 0; closeChat();
  $('conn').classList.add('hide'); show('s-code'); if (msg) toast(msg, 'bad');
}

/* ------------------------------ баталгаажуулах цонх ------------------------------ */
function ask(title, msg, okT, noT, st) {
  return new Promise(function (res) {
    var m = document.createElement('div'); m.className = 'modal askm';
    m.innerHTML = '<div class="mbox askbox pop" role="dialog" aria-modal="true" aria-labelledby="askT">' + stk(st || 'mouse', 76, 'askstk') + '<h3 id="askT">' + esc(title) + '</h3><p class="muted">' + esc(msg) + '</p><div class="askbtns"><button type="button" class="btn" data-a="0">' + esc(noT || 'Болих') + '</button><button type="button" class="btn primary" data-a="1">' + esc(okT || 'Тийм') + '</button></div></div>';
    document.body.appendChild(m);
    var done = function (v) { document.removeEventListener('keydown', kd); m.remove(); res(v); };
    var kd = function (e) { if (e.key === 'Escape') done(false); };
    document.addEventListener('keydown', kd);
    m.addEventListener('click', function (e) { var b = e.target.closest('[data-a]'); if (b) done(b.dataset.a === '1'); else if (e.target === m) done(false); });
    m.querySelector('[data-a="1"]').focus();
  });
}

/* ------------------------------ холболт ------------------------------ */
var connTimer = null;
function start() {
  show('s-main'); buildChat();
  if (sock) { try { sock.close(); } catch (e) {} }
  sock = connectWS(function () { return 'role=student&token=' + encodeURIComponent(TOKEN || ''); }, {
    open: function () { clearTimeout(connTimer); $('conn').classList.add('hide'); if (poll) { clearInterval(poll); poll = null; } fetchState(); },
    close: function () { if (!live) return; clearTimeout(connTimer); connTimer = setTimeout(function () { if (live) $('conn').classList.remove('hide'); }, 1500); if (!poll) poll = setInterval(fetchState, 4000); },
    denied: function () { logout('Энэ нэрээр өөр төхөөрөмжөөс нэвтэрлээ. Дахин нэвтэрнэ үү.'); },
    msg: function (e, d) { if (e === 'state') apply(d); else if (e === 'chat' && d && d.msg) addChat(d.msg); }
  });
}
function fetchState() {
  if (!TOKEN) return;
  api('/api/state', { token: TOKEN }).then(function (j) { if (j.ok) apply(j.state); else if (j._status === 401) logout('Дахин нэвтэрнэ үү.'); }).catch(function () {});
}
setInterval(function () { if (live && TOKEN && Date.now() - lastStateAt > 12000) fetchState(); }, 6000);

/* ------------------------------ төлөв ------------------------------ */
function apply(s) {
  if (!s || !s.t || !live) return;
  ST = s; lastStateAt = Date.now(); OFF = s.t.now - Date.now();
  syncChat(s.chat || []);
  render(); updTimer();
}
function remaining() { var t = ST.t; if (t.paused) return t.left || 0; return t.endsAt ? t.endsAt - (Date.now() + OFF) : 0; }
var ioEl = null, io = null, bigVisible = true;
if ('IntersectionObserver' in window) io = new IntersectionObserver(function (es) { es.forEach(function (e) { bigVisible = e.isIntersecting; }); updTimer(); });
function updTimer() {
  if (!ST || !live) return; var t = ST.t, top = $('tmTop'), big = $('tmBig'), m = $('s-main');
  var isLive = t.phase === 'live', ms = isLive ? remaining() : 0, txt = fmt(ms);
  var cls = t.paused ? ' pause' : (ms > 0 && ms <= 10000 && t.ph !== 'rev' ? ' low' : '');
  if (big) { if (io && ioEl !== big) { io.disconnect(); io.observe(big); ioEl = big; } big.textContent = (t.paused ? '⏸ ' : '') + txt; big.className = 'timer' + cls; }
  top.textContent = (t.paused ? '⏸ ' : '⏱ ') + txt; top.className = 'tpill' + cls + ((isLive && big && !bigVisible) ? '' : ' hide');
  var bar = $('tbar'); if (bar && t.totalSec) bar.style.width = Math.max(0, Math.min(100, ms / (t.totalSec * 10))) + '%';
  var up = isLive && !t.paused && ms <= 0 && t.ph !== 'rev';
  m.classList.toggle('timeup', up); m.classList.toggle('tlocked', !!t.locked); m.classList.toggle('tpaused', !!t.paused);
  var n = $('tnote'); if (n) { var s = t.paused ? '⏸ Түр зогссон — багш удахгүй үргэлжлүүлнэ.' : t.locked ? '🔒 Багш хариултыг түгжсэн байна.' : up ? '⌛ Цаг дууссан.' : '';
    if (n.textContent !== s) n.textContent = s; n.classList.toggle('hide', !s); }
}
setInterval(updTimer, 250);

/* ------------------------------ блок-оор дахин зурах ------------------------------ */
function sigOf(h) { return h.replace(/(<textarea[^>]*>)[\s\S]*?<\/textarea>/g, '$1</textarea>'); }
function patch(root, blocks) {
  var keys = blocks.map(function (b) { return b[0]; });
  [].slice.call(root.children).forEach(function (el) { if (keys.indexOf(el.getAttribute('data-k')) < 0) el.remove(); });
  var prev = null;
  blocks.forEach(function (b) {
    var k = b[0], html = b[1], sig = sigOf(html), el = null;
    for (var i = 0; i < root.children.length; i++) if (root.children[i].getAttribute('data-k') === k) { el = root.children[i]; break; }
    if (!el) { el = document.createElement('div'); el.setAttribute('data-k', k); el.className = 'blk'; el.innerHTML = html; el._sig = sig; }
    else if (el._sig !== sig) { swap(el, html); el._sig = sig; }
    var want = prev ? prev.nextSibling : root.firstChild; if (want !== el) root.insertBefore(el, want);
    prev = el;
  });
}
function swap(el, html) {
  var a = document.activeElement, fk = null, ss = null, se = null, sc = 0;
  if (a && el.contains(a) && a.getAttribute('data-fk')) { fk = a.getAttribute('data-fk'); try { ss = a.selectionStart; se = a.selectionEnd; sc = a.scrollTop; } catch (e) {} }
  el.innerHTML = html;
  if (fk) { var n = el.querySelector('[data-fk="' + fk + '"]'); if (n) { n.focus({ preventScroll: true }); try { if (ss != null) n.setSelectionRange(ss, se); n.scrollTop = sc; } catch (e) {} } }
}

/* ------------------------------ гол зурах ------------------------------ */
var lastMe = '';
function render() {
  if (!ST || !live) return;
  var s = ST, t = s.t, B = [];
  var meH = teamSt(s.me.team, 26, 'mestk') + '<span class="men">' + esc(s.me.name) + '</span>';
  if (meH !== lastMe) { $('meChip').innerHTML = meH; lastMe = meH; }
  if (t.phase === 'lobby') lobbyBlocks(B);
  else if (t.phase === 'done') doneBlocks(B);
  else if (t.phase === 'live') liveBlocks(B);
  patch($('s-main'), B);
  if (t.phase === 'done') maybeConfetti();
}

/* ------------------------------ хүлээлэг (lobby) ------------------------------ */
function lobbyBlocks(B) {
  var s = ST, L = s.lobby || { joined: 0, total: 0, who: [] };
  B.push(['lhero', '<div class="card hero lobbyhero tint-pink">' +
    '<div class="flt f1">' + stk('egg', 70, 'float') + '</div><div class="flt f2">' + stk('bread', 76, 'float d1') + '</div><div class="flt f3">' + stk('tongue', 58, 'float d2') + '</div>' +
    '<div class="hero-kicker">Сайн уу, ' + esc(s.me.name) + ' 👋</div><h2 class="lobbyt">Сорилт удахгүй эхэлнэ</h2>' +
    '<div class="cute" id="cuteLine">' + esc(CUTE.wait[UI.cuteI % CUTE.wait.length]) + '</div>' +
    '<p class="muted small">Багш удахгүй эхлүүлнэ 🌷 Энэ хуудсыг хаалгүй хүлээгээрэй — асуулт автоматаар гарч ирнэ.</p></div>']);
  var pct = L.total ? Math.round(L.joined / L.total * 100) : 0;
  B.push(['ljoin', '<div class="card"><div class="rowb"><h3>Анги цугларч байна</h3><span class="pill butter"><b>' + L.joined + '/' + L.total + '</b>&nbsp;орлоо</span></div>' +
    '<div class="progress big"><i style="width:' + pct + '%"></i></div>' +
    '<div class="who">' + (L.who || []).map(function (w) { return '<span class="whoc' + (w.me ? ' me' : '') + '">' + avatar(w.name, 24) + esc(w.name) + '</span>'; }).join('') + '</div></div>']);
  B.push(['lteam', teamCard()]);
  B.push(['lstages', stagesCard()]);
  B.push(['lswitch', '<p class="center small"><button type="button" class="btn ghost sm" data-act="switch">Нэр буруу сонгосон уу? Нэр солих</button></p>']);
}
setInterval(function () {
  var el = $('cuteLine'); if (!el) return; el.classList.add('fade');
  setTimeout(function () { UI.cuteI++; el.textContent = CUTE.wait[UI.cuteI % CUTE.wait.length]; el.classList.remove('fade'); }, 450);
}, 4000);
function teamCard() {
  var s = ST, on = s.team.members.filter(function (m) { return m.online; }).length;
  return '<div class="card teamcard tm' + s.me.team + '">' + teamSt(s.me.team, 74, 'stkc tr tcst') +
    '<div class="k small muted">Миний баг</div><h3 class="tname">' + esc(s.me.teamName) + '</h3>' +
    (s.me.mission ? '<div class="mission">' + esc(s.me.mission) + '</div>' : '') + (s.me.focus ? '<p class="small muted">' + esc(s.me.focus) + '</p>' : '') +
    '<div class="small muted mt8">' + on + '/' + s.team.members.length + ' гишүүн холбогдсон</div>' +
    '<div class="mems">' + s.team.members.map(function (m) { return '<span class="mem' + (m.online ? ' on' : '') + (m.me ? ' me' : '') + '"><span class="dot' + (m.online ? ' on' : '') + '"></span>' + esc(m.name) + (m.me ? ' (би)' : '') + '</span>'; }).join('') + '</div></div>';
}
var STAGECLS = ['', 'lilac', 'mint', 'butter', 'peach'];
function stagesCard() {
  var s = ST;
  return '<div class="card"><h3>Өнөөдрийн 4 шат</h3><p class="small muted">Шат бүрийг дарж дэлгэрэнгүйг уншаарай.</p><div class="stg4">' + (s.stages || []).map(function (g) {
    var open = !!UI.stageOpen[g.id];
    return '<button type="button" class="tile stgt ' + STAGECLS[g.id] + (open ? ' open' : '') + '" data-act="stg" data-s="' + g.id + '" aria-expanded="' + open + '"><div class="k">' + g.id + '-р шат</div><div class="mt">' + esc(g.icon) + ' ' + esc(g.name) + '</div><div class="stt">' + esc(g.title) + '</div>' + (open ? '<div class="std">' + esc(g.desc) + '<div class="scl">' + scoreChips(g.id) + '</div></div>' : '<div class="more">Дэлгэрэнгүй ›</div>') + '</button>';
  }).join('') + '</div><p class="small muted center mt8">' + esc(scoreLine()) + '</p></div>';
}
function scoreLine() { var c = ST.scoring || {}; return 'Зөв хариулт +' + c.ind + ' · Peer Check +' + c.peerHit + '/+' + c.peerNear + ' · Багийн зөв +' + c.teamQ; }
function scoreChips(st) {
  var c = ST.scoring || {}, a = [];
  if (st === 1) a = ['Хувийн зөв +' + c.ind, 'Баг олонхиороо зөв +' + c.teamQ];
  else if (st === 2) a = ['Багийн хариулт зөв +' + c.teamQ + ' · хэсэгчлэн +' + c.teamPartial, 'Таны үнэлгээ таарвал +' + c.peerHit + ' · ойролцоо +' + c.peerNear];
  else if (st === 3) a = ['Хувийн зөв +' + c.ind, 'Багийн эцсийн хариулт зөв +' + c.teamQ];
  else a = ['Багийн зөв хариулт +' + c.teamQ];
  return a.map(function (x) { return '<span class="pill white">' + esc(x) + '</span>'; }).join('');
}

/* ------------------------------ сорилт явагдаж байхад ------------------------------ */
var PHL = { ind: 'Хувийн хариулт', team: 'Багийн шийдвэр', peer: 'Үнэлгээ', rev: 'Үр дүн' };
function stepTitle() {
  var t = ST.t, c = ST.cur || {};
  var k = t.kind === 'q' ? 'Асуулт ' + (c.qn || '') + '/' + (c.qTotal || '') : t.kind === 'write' ? 'Багийн хариулт бичих' : t.kind === 'peer' ? 'Бусдын хариултыг шалгах' : t.kind === 'duel' ? 'Ферментийн тулаан' : 'Багаа авар!';
  var p = t.kind === 'write' ? 'Багийн нэг хариулт' : PHL[t.ph] || '';
  return '<b>' + esc(k) + '</b><span class="muted"> · ' + esc(p) + '</span>';
}
function hud() {
  var s = ST, t = s.t;
  var stg = (s.stages || []).map(function (g) { var cl = g.id === t.stage ? 'on' : g.id < t.stage ? 'done' : ''; return '<div class="st ' + cl + '"><span class="sti">' + (g.id < t.stage ? '✓' : esc(g.icon)) + '</span><span class="stn">' + esc(g.name) + '</span></div>'; }).join('');
  var dots = (s.script || []).map(function (x, i) { return '<i class="' + (i < t.step ? 'done' : i === t.step ? 'on' : '') + '" title="' + esc(x.label) + '"></i>'; }).join('');
  return '<div class="card hud">' + '<div class="stepper">' + stg + '</div>' +
    '<div class="hudrow"><div class="hudl"><span class="stagechip s' + t.stage + '">' + t.stage + '-р шат</span><div class="hudlbl">' + stepTitle() + '</div></div><span class="timer" id="tmBig">--:--</span></div>' +
    '<div class="progress"><i id="tbar"></i></div>' +
    '<div class="dotsrow"><div class="dots" aria-label="Алхам">' + dots + '</div><span class="small muted">Алхам ' + (t.step + 1) + '/' + t.stepCount + '</span></div>' +
    '<div id="tnote" class="tnote hide" role="status"></div>' +
    '<div class="tiles3"><div class="tile pink"><div class="k">Миний оноо</div><div class="v">' + num(s.me.score) + '</div></div>' +
    '<div class="tile lilac"><div class="k">Багийн байр</div><div class="v">' + (s.team.rank ? s.team.rank + '<small>-р</small>' : '–') + '</div></div>' +
    '<div class="tile butter"><div class="k">Багийн оноо</div><div class="v">' + num(s.team.score) + '</div></div></div></div>';
}
function introCard() {
  var s = ST, t = s.t, g = (s.stages || [])[t.stage - 1]; if (!g) return '';
  var first = t.step === 0 || ((s.script[t.step - 1] || {}).stage !== t.stage);
  var open = UI.intro[t.stage] !== undefined ? UI.intro[t.stage] : (first && !t.phIndex);
  return '<div class="card intro tint-' + ['', 'lilac', 'mint', 'butter', 'peach'][t.stage] + (open ? ' open' : '') + '">' +
    '<button type="button" class="introh" data-act="intro" aria-expanded="' + open + '"><span class="ico">' + esc(g.icon) + '</span><span class="it"><span class="small muted">' + g.id + '-р шат · ' + esc(g.name) + '</span><b>' + esc(g.title) + '</b></span><span class="chev">' + (open ? '▴' : '▾') + '</span></button>' +
    (open ? '<div class="introb">' + stk(pick('science', 'st' + g.id), 54, 'introstk') + '<p>' + esc(g.desc) + '</p><div class="scl">' + scoreChips(g.id) + '</div><p class="small muted">' + esc(scoreLine()) + '</p></div>' : '') + '</div>';
}
function liveBlocks(B) {
  var s = ST, t = s.t, c = s.cur || {};
  B.push(['hud', hud()]);
  B.push(['intro' + t.stage, introCard()]);
  var k = t.kind, ph = t.ph;
  if (!c.q && k !== 'write' && k !== 'peer') { B.push(['wait', waitCard('Асуулт ачаалж байна…')]); }
  else if (k === 'q' && ph === 'ind') indBlocks(B, c, 'q');
  else if (k === 'q' && ph === 'rev') qRevBlocks(B, c);
  else if (k === 'write') writeBlocks(B, c);
  else if (k === 'peer' && ph === 'peer') peerBlocks(B, c);
  else if (k === 'peer' && ph === 'rev') peerRevBlocks(B, c);
  else if (k === 'duel' && ph === 'ind') indBlocks(B, c, 'duel');
  else if ((k === 'duel' || k === 'final') && ph === 'team') teamBlocks(B, c, k);
  else if ((k === 'duel' || k === 'final') && ph === 'rev') teamRevBlocks(B, c, k);
  else B.push(['wait', waitCard('Түр хүлээнэ үү…')]);
  if (ph === 'rev' && s.board) B.push(['board', boardCard()]);
  B.push(['tmini', teamMini()]);
}
function waitCard(msg) { return '<div class="card center waitc">' + stk(pick('wait', msg), 90, 'float') + '<h3>' + esc(msg) + '</h3><p class="muted">' + esc(cutePick('wait', ST.t.stepId || 'w')) + '</p></div>'; }
function teamMini() {
  var s = ST; return '<div class="card tmini tm' + s.me.team + '">' + teamSt(s.me.team, 40) + '<div class="tmt"><b>' + esc(s.me.teamName) + '</b><div class="mems sm">' + s.team.members.map(function (m) { return '<span class="mem' + (m.online ? ' on' : '') + (m.me ? ' me' : '') + '"><span class="dot' + (m.online ? ' on' : '') + '"></span>' + esc(m.name) + '</span>'; }).join('') + '</div></div></div>';
}

/* ----- асуулт ----- */
var TL = { mcq: 'Нэг зөв хариулт', multi: 'Олон зөв хариулт', tf: 'Үнэн / Худал', order: 'Дараалал', match: 'Тааруулалт', short: 'Бичгээр хариулна' };
var LET = 'АБВГДЕЖЗ';
function qHead(c, extra) {
  var q = c.q;
  return '<div class="qh">' + (c.kind === 'q' ? '<span class="pill pink">Асуулт ' + c.qn + '/' + c.qTotal + '</span>' : extra ? '<span class="pill pink">' + esc(extra) + '</span>' : '') +
    '<span class="pill">' + esc(TL[q.type] || '') + '</span>' + (q.concept ? '<span class="pill butter">' + esc(q.concept) + '</span>' : '') + '</div>';
}
function qBody(q) { return '<div class="qtext">' + esc(q.text) + '</div>' + (q.image ? '<img class="qimg" src="/img/q/' + encodeURIComponent(q.image) + '" alt="Асуултын зураг">' : '') + (q.graph ? graphSVG(q.graph) : ''); }
function initDraft(q, d, from) {
  if (d.init) return; d.init = true;
  if (q.type === 'order') d.ord = from && from.arr ? from.arr.slice() : q.items.map(function (x) { return x.i; });
  if (from) { if (q.type === 'mcq') d.i = from.i; if (q.type === 'multi') d.arr = (from.arr || []).slice(); if (q.type === 'tf') d.v = from.v; if (q.type === 'match') d.map = (from.arr || []).slice(); }
}
function inputs(q, dk, d) {
  var o = '', a = ' data-d="' + esc(dk) + '"';
  if (q.type === 'mcq' || q.type === 'multi') {
    o = '<div class="opts" role="' + (q.type === 'mcq' ? 'radiogroup' : 'group') + '">' + q.options.map(function (op, k) {
      var sel = q.type === 'mcq' ? d.i === op.i : (d.arr || []).indexOf(op.i) >= 0;
      return '<button type="button" class="opt' + (q.type === 'multi' ? ' multi' : '') + (sel ? ' sel' : '') + '" role="' + (q.type === 'mcq' ? 'radio' : 'checkbox') + '" aria-checked="' + sel + '" data-act="' + (q.type === 'mcq' ? 'pick' : 'tog') + '"' + a + ' data-i="' + op.i + '"><span class="k">' + (sel && q.type === 'multi' ? '✓' : LET[k]) + '</span><span>' + esc(op.text) + '</span></button>';
    }).join('') + '</div>' + (q.type === 'multi' ? '<p class="small muted">Зөв бүх хариултыг сонгоно.</p>' : '');
  } else if (q.type === 'tf') {
    o = '<div class="tfrow opts"><button type="button" class="opt' + (d.v === true ? ' sel' : '') + '" data-act="tf"' + a + ' data-v="1" aria-pressed="' + (d.v === true) + '"><span class="k">✓</span><span>Үнэн</span></button><button type="button" class="opt' + (d.v === false ? ' sel' : '') + '" data-act="tf"' + a + ' data-v="0" aria-pressed="' + (d.v === false) + '"><span class="k">✗</span><span>Худал</span></button></div>';
  } else if (q.type === 'order') {
    var ord = d.ord || q.items.map(function (x) { return x.i; }), tx = {}; q.items.forEach(function (x) { tx[x.i] = x.text; });
    o = '<p class="small muted">▲ ▼ товчоор зөв дараалалд оруулаарай.</p><div class="ord">' + ord.map(function (i, k) {
      return '<div class="ordi"><span class="n">' + (k + 1) + '</span><span class="t">' + esc(tx[i]) + '</span><button type="button" aria-label="Дээш" data-act="up"' + a + ' data-k="' + k + '"' + (k === 0 ? ' disabled' : '') + '>▲</button><button type="button" aria-label="Доош" data-act="dn"' + a + ' data-k="' + k + '"' + (k === ord.length - 1 ? ' disabled' : '') + '>▼</button></div>';
    }).join('') + '</div>';
  } else if (q.type === 'match') {
    var mm = d.map || [];
    o = '<p class="small muted">Мөр бүрд тохирох хариултыг сонго.</p>' + q.lefts.map(function (l, k) {
      return '<div class="mrow"><b>' + esc(l) + '</b><select data-act="mt"' + a + ' data-k="' + k + '" data-fk="' + esc(dk) + '|m' + k + '" aria-label="' + esc(l) + '"><option value="">— сонго —</option>' + q.rights.map(function (r) { return '<option value="' + r.i + '"' + (mm[k] === r.i ? ' selected' : '') + '>' + esc(r.text) + '</option>'; }).join('') + '</select></div>';
    }).join('');
  }
  return o;
}
function whyBox(q, dk, d) {
  var o = '';
  if (q.askJustify || q.askWhy) o = '<label for="why-' + esc(dk) + '">' + (q.askJustify && !q.askWhy ? 'Үндэслэл (1–2 өгүүлбэр)' : 'Яагаад? Товч тайлбарла') + ' <span class="muted small">(заавал биш)</span></label><textarea id="why-' + esc(dk) + '" data-act="why"' + ' data-d="' + esc(dk) + '" data-fk="' + esc(dk) + '|why" maxlength="700" placeholder="Яагаад ингэж бодсон бэ?">' + esc(d.why || '') + '</textarea>';
  return o;
}
function collect(q, d) {
  if (q.type === 'mcq') return d.i === undefined || d.i === null ? null : { i: d.i };
  if (q.type === 'multi') return d.arr && d.arr.length ? { arr: d.arr.slice() } : null;
  if (q.type === 'tf') return typeof d.v === 'boolean' ? { v: d.v } : null;
  if (q.type === 'order') return { arr: (d.ord || q.items.map(function (x) { return x.i; })).slice() };
  if (q.type === 'match') { var m = d.map || []; for (var k = 0; k < q.lefts.length; k++) if (m[k] === undefined || m[k] === null) return null; return { arr: m.slice(0, q.lefts.length) }; }
  if (q.type === 'short') return d.text && d.text.trim() ? { text: d.text.trim() } : null;
  return null;
}
function correctText(q, rv) {
  if (!rv) return ''; var m = {}; (q.options || []).forEach(function (x) { m[x.i] = x.text; });
  if (q.type === 'mcq') return m[rv.correct]; if (q.type === 'multi') return (rv.correct || []).map(function (i) { return m[i]; }).join(' • ');
  if (q.type === 'tf') return rv.correct ? 'Үнэн' : 'Худал';
  if (q.type === 'order') return (rv.correctItems || []).map(function (x, i) { return (i + 1) + '. ' + x; }).join('  ');
  if (q.type === 'match') return (rv.correctPairs || []).map(function (p) { return p.l + ' ⇒ ' + p.r; }).join(' • ');
  return rv.model || rv.explanation || '';
}
function explain(rv) {
  if (!rv) return ''; return (rv.explanation ? '<div class="expl"><h4>Тайлбар</h4>' + esc(rv.explanation) + '</div>' : '') +
    (rv.misconception ? '<div class="expl miscon"><h4>Түгээмэл буруу ойлголт</h4>' + esc(rv.misconception) + '</div>' : '');
}
function sendBtn(dk, act, label, cls) { var busy = inflight[dk + act]; return '<button type="button" class="btn ' + (cls || 'primary lg') + ' wide sendbtn' + (busy ? ' busy' : '') + '" data-act="' + act + '" data-d="' + esc(dk) + '">' + (busy ? 'Илгээж байна…' : esc(label)) + '</button>'; }
function teamProg(n, of, label) {
  n = n || 0; of = of || 0; var p = of ? Math.round(n / of * 100) : 0;
  return '<div class="card tprog">' + teamSt(ST.me.team, 46) + '<div class="tpw"><div class="rowb"><b>' + esc(label) + '</b><span class="pill mint">' + n + '/' + of + '</span></div><div class="progress"><i style="width:' + p + '%"></i></div></div></div>';
}

function indBlocks(B, c, kind) {
  var q = c.q, dk = 'I|' + c.stepId + '|' + q.id, d = D(dk);
  if (c.answered) {
    B.push(['qdone', '<div class="card qcard tint-mint pop">' + stk(pick('wait', q.id), 64, 'stkc tr') + qHead(c, kind === 'duel' ? 'Хувийн хариулт' : '') +
      '<div class="res ok">✔ Хариулт бүртгэгдлээ.</div><div class="small muted">Таны хариулт:</div><div class="ans">' + esc(describeAnswer(q, c.myAnswer) || '—') + '</div>' +
      '<p class="small muted mt8">' + (kind === 'duel' ? 'Удахгүй 30 секундийн багийн хэлэлцүүлэг эхэлнэ. Багийнхантайгаа санаагаа хуваалцаарай 💬' : 'Зөв эсэх нь цаг дууссаны дараа гарна. ' + esc(cutePick('wait', q.id))) + '</p></div>']);
  } else {
    initDraft(q, d, null);
    B.push(['qin', '<div class="card qcard">' + stk(pick('science', q.id), 56, 'stkc tr') + qHead(c, kind === 'duel' ? 'Хувийн хариулт' : '') + qBody(q) + inputs(q, dk, d) + whyBox(q, dk, d) +
      '<p class="tuonly err">⌛ Цаг дууссан.</p>' + sendBtn(dk, 'send', 'Хариулт илгээх') + '<p class="small muted center mt8">Илгээсний дараа өөрчлөх боломжгүй.</p></div>']);
  }
  if (c.teamSize) B.push(['tprog', teamProg(c.teamAnswered, c.teamSize, 'Багаас хариулсан')]);
}
function resultCard(r, seed, pts) {
  var none = !r || r.none, ok = r && r.ok === true, part = r && r.ok === 'partial';
  var k = none ? 'none' : ok ? 'ok' : part ? 'part' : 'no';
  var title = none ? 'Та энэ асуултад хариулаагүй.' : ok ? 'Зөв хариулт.' : part ? 'Хэсэгчлэн зөв.' : 'Буруу хариулт.';
  var sub = none ? 'Дараагийн асуултад заавал хариулаарай 🌷' : ok || part ? cutePick('right', seed) : cutePick('wrong', seed);
  var p = r ? (r.pts || 0) : 0;
  return '<div class="card rescard r-' + k + ' pop">' + stk(ok ? pick('happy', seed) : pick('sad', seed), 92, 'resstk') +
    '<div class="rest"><div class="resh">' + (ok ? '✔ ' : none ? '' : '✗ ') + esc(title) + '</div><div class="ress">' + esc(sub) + '</div></div><div class="respts">' + (p > 0 ? '+' + num(p) : '0') + '<small>оноо</small></div></div>';
}
function qRevBlocks(B, c) {
  var q = c.q, rv = c.reveal;
  B.push(['res', resultCard(c.result, q.id + ST.me.id)]);
  var my = c.myAnswer ? '<div class="small muted">Таны хариулт:</div><div class="ans mine' + (c.result && c.result.ok === true ? '' : ' bad') + '">' + esc(describeAnswer(q, c.myAnswer)) + '</div>' : '';
  B.push(['expl', '<div class="card qcard">' + qHead(c) + qBody(q) + my + '<div class="small muted mt8">Зөв хариулт:</div><div class="ans good">' + esc(correctText(q, rv)) + '</div>' + explain(rv) +
    (c.result && c.result.why ? '<div class="expl"><h4>Таны тайлбар</h4>' + esc(c.result.why) + '</div>' : '') + '</div>']);
  if (c.dist) B.push(['dist', distCard(c.dist, q, c.myAnswer)]);
  if (c.teamRes) B.push(['tres', teamResCard(c.teamRes)]);
}
function distCard(d, q, my) {
  var none = Math.max(0, (d.total || 0) - (d.answered || 0));
  var donut = Charts.donut([{ label: 'Зөв', value: d.correct, color: CH.mint }, { label: 'Хэсэгчлэн', value: d.partial || 0, color: CH.butter }, { label: 'Буруу', value: d.wrong, color: CH.rose }, { label: 'Хариулаагүй', value: none, color: CH.track }], { center: d.answered ? Math.round(d.correct / d.answered * 100) + '%' : '–', sub: 'зөв', size: 150, label: 'Ангийн зөв хариултын хувь' }) +
    Charts.legend([{ label: 'Зөв', value: d.correct, color: CH.mint }, { label: 'Буруу', value: d.wrong, color: CH.rose }, { label: 'Хариулаагүй', value: none, color: CH.track }]);
  var bars = '';
  if (d.opts && d.opts.length) {
    var mine = function (o) { if (!my) return false; if (q.type === 'mcq') return my.i === o.i; if (q.type === 'multi') return (my.arr || []).indexOf(o.i) >= 0; if (q.type === 'tf') return (my.v ? 1 : 0) === o.i; return false; };
    bars = Charts.hbars(d.opts.map(function (o) { return { label: (o.correct ? '✓ ' : '') + o.text + (mine(o) ? ' (би)' : ''), value: o.n, color: o.correct ? CH.mint : CH.lilac, text: o.n + ' · ' + (d.answered ? Math.round(o.n / d.answered * 100) : 0) + '%', mark: o.correct }; }), { max: Math.max(d.answered, 1) });
  }
  return '<div class="card"><div class="rowb"><h3>Анги даяарх хариулт</h3><span class="pill">' + d.answered + '/' + d.total + ' хариулсан</span></div><div class="distw"><div class="dd">' + donut + '</div>' + (bars ? '<div class="db">' + bars + '</div>' : '') + '</div></div>';
}
function teamResCard(tr) {
  var p = tr.of ? Math.round(tr.okN / tr.of * 100) : 0, sc = ST.scoring || {};
  return '<div class="card tres ' + (tr.ok ? 'tint-mint' : 'tint-lilac') + '">' + teamSt(ST.me.team, 64, 'stkc tr') + '<div class="k small muted">Багийн үр дүн</div><h3>' + esc(ST.me.teamName) + ': ' + tr.okN + '/' + tr.of + ' зөв</h3><div class="progress"><i style="width:' + p + '%"></i></div>' +
    '<p class="mt8"><b>' + (tr.ok ? 'Олонх нь зөв хариуллаа — баг +' + sc.teamQ + ' оноо 🎉' : 'Олонх нь зөв хариулаагүй тул багийн оноо нэмэгдсэнгүй.') + '</b></p><p class="small muted">' + esc(cutePick('team', 'tr' + ST.t.stepId)) + '</p></div>';
}
function boardCard() {
  var b = (ST.board || []).slice().sort(function (x, y) { return x.team - y.team; });
  var cols = Charts.columns(b.map(function (r) { return { label: r.name + (r.team === ST.me.team ? ' ★' : ''), value: Math.max(0, r.score), text: num(r.score), color: TEAMCOL[r.team] }; }), { height: 170 });
  var rk = (ST.board || []).slice().sort(function (x, y) { return x.rank - y.rank; });
  return '<div class="card"><div class="rowb"><h3>Багуудын оноо</h3><span class="pill butter">Манай баг ' + (ST.team.rank || '–') + '-р байр</span></div>' + cols +
    '<div class="rkline">' + rk.map(function (r) { return '<span class="rkc' + (r.team === ST.me.team ? ' me' : '') + '"><b>' + r.rank + '.</b> ' + esc(r.name) + '</span>'; }).join('') + '</div></div>';
}

/* ----- 2-р шат: багийн бичвэр ----- */
function writeBlocks(B, c) {
  var q = c.q; if (!q) { B.push(['wait', waitCard('Асуулт ачаалж байна…')]); return; }
  var dk = 'W|' + q.id, d = D(dk), ta = c.tans;
  if (!d.init) { d.init = true; d.text = ta && ta.text ? ta.text : ''; d.base = ta ? ta.t : 0; d.v = 1; }
  var newer = ta && ta.t !== d.base;
  if (newer && !d.dirty) { d.text = ta.text || ''; d.base = ta.t; d.v = (d.v || 1) + 1; newer = false; }
  var locked = ta && ta.locked;
  B.push(['wq', '<div class="card qcard">' + stk('pencil', 70, 'stkc tr') + '<div class="qh"><span class="pill pink">Багийн нэг хариулт</span><span class="pill">' + esc(TL.short) + '</span>' + (q.concept ? '<span class="pill butter">' + esc(q.concept) + '</span>' : '') + '</div>' + qBody(q) +
    '<p class="small muted">Багийн хэн ч бичиж хадгалж болно. Сүүлд хадгалсан хувилбар нь багийн хариулт болно. Цаг дуусахад түгжигдэнэ.</p></div>']);
  B.push(['wsaved', '<div class="card tint-butter">' + '<div class="rowb"><h3>📌 Багийн хадгалсан хариулт</h3>' + (locked ? '<span class="pill">🔒 Түгжигдсэн</span>' : '') + '</div>' +
    (ta && ta.text ? '<div class="ans saved">' + esc(ta.text) + '</div><div class="small muted mt8">✍ ' + esc(ta.by || '') + (ta.t ? ' · ' + hm(ta.t) : '') + ' хадгалсан</div>' : '<p class="muted">Одоогоор хадгалсан хариулт алга. Хамгийн түрүүнд чи бичээд хадгалаарай ✨</p>') + '</div>']);
  if (locked) { B.push(['wlock', '<div class="card center">' + stk('egg', 70) + '<p><b>Багийн хариулт түгжигдлээ.</b> Удахгүй өөр баг шалгана.</p></div>']); return; }
  B.push(['wedit', '<div class="card">' + '<label for="wtxt">Багийн хариултыг бичих / засах</label>' +
    '<textarea id="wtxt" class="bigta" data-act="wtxt" data-d="' + esc(dk) + '" data-fk="wtxt" data-v="' + d.v + '" maxlength="900" placeholder="Багтайгаа ярилцаад хариултаа энд бичээрэй…">' + esc(d.text || '') + '</textarea>' +
    (newer ? '<div class="res part">Багийн өөр гишүүн шинэ хувилбар хадгалсан байна. <button type="button" class="btn sm butter" data-act="wload" data-d="' + esc(dk) + '">Шинэ хувилбарыг ачаалах</button></div>' : '') +
    '<p class="tuonly err">⌛ Цаг дууссан.</p><div class="btnrow">' + sendBtn(dk, 'wsave', 'Хадгалах') + '<button type="button" class="btn lilac chatcta" data-act="chat">💬 Багийн чат</button></div></div>']);
}

/* ----- 2-р шат: шалгах ----- */
function peerBlocks(B, c) {
  var q = c.q, tg = c.target || {}, dk = 'P|' + c.stepId, d = D(dk);
  if (!d.init) { d.init = true; if (c.myVote) { d.vote = c.myVote.vote; d.why = c.myVote.why || ''; } }
  var has = tg.ans && tg.ans.text;
  B.push(['ptarget', '<div class="card qcard tint-lilac">' + teamSt(tg.team, 70, 'stkc tr') + '<div class="qh"><span class="pill pink">Peer Check</span><span class="pill white">' + esc(tg.name || '') + '-ийн хариулт</span></div>' +
    '<h3>Та <b>' + esc(tg.name || '') + '</b>-ийн хариултыг шалгана</h3>' + (q ? '<div class="qtext small2">' + esc(q.text) + '</div>' : '') +
    (has ? '<div class="ans saved">' + esc(tg.ans.text) + '</div>' : '<div class="res pend">Шалгах хариулт ирээгүй байна. Энэ баг хариулт хадгалаагүй тул үнэлэх шаардлагагүй — хүлээгээрэй 🌷</div>') + '</div>']);
  if (has) {
    var vb = function (v, cls) { var sel = d.vote === v; return '<button type="button" class="vote ' + cls + (sel ? ' sel' : '') + '" data-act="vote" data-d="' + esc(dk) + '" data-v="' + v + '" aria-pressed="' + sel + '">' + esc(RL[v]) + '</button>'; };
    B.push(['pvote', '<div class="card">' + '<h3>Таны үнэлгээ</h3><div class="votes">' + vb('ok', 'v-ok') + vb('partial', 'v-part') + vb('wrong', 'v-no') + '</div>' +
      '<label for="pwhy">Яагаад? <span class="muted small">(богино тайлбар)</span></label><textarea id="pwhy" data-act="why" data-d="' + esc(dk) + '" data-fk="pwhy" maxlength="300" placeholder="Жишээ нь: идэвхт төвийг дурдсан, гэхдээ денатурацийг тайлбарлаагүй…">' + esc(d.why || '') + '</textarea>' +
      (c.myVote ? '<div class="res ok">Таны илгээсэн үнэлгээ: ' + esc(RL[c.myVote.vote]) + ' — дахин илгээвэл шинэчлэгдэнэ.</div>' : '') +
      '<p class="tuonly err">⌛ Цаг дууссан.</p>' + sendBtn(dk, 'psend', c.myVote ? 'Үнэлгээг шинэчлэх' : 'Үнэлгээ илгээх') + '</div>']);
  }
  if (c.teamSize) B.push(['tprog', teamProg(c.voted, c.teamSize, 'Багаас үнэлгээ өгсөн')]);
  if (c.myTeamAns && c.myTeamAns.text) B.push(['pmine', '<div class="card small2"><div class="k small muted">Манай багийн хариулт (өөр баг шалгаж байна)</div><div class="ans">' + esc(c.myTeamAns.text) + '</div></div>']);
}
function peerRevBlocks(B, c) {
  var m = c.mine || { votes: {} }, v = m.votes || {}, sc = ST.scoring || {}, rating = m.rating;
  var tp = rating === 'ok' ? sc.teamQ : rating === 'partial' ? sc.teamPartial : 0;
  var tot = (v.ok || 0) + (v.partial || 0) + (v.wrong || 0);
  var donut = Charts.donut([{ label: 'Зөв', value: v.ok || 0, color: CH.mint }, { label: 'Хэсэгчлэн', value: v.partial || 0, color: CH.butter }, { label: 'Буруу', value: v.wrong || 0, color: CH.rose }], { center: tot, sub: 'санал', size: 140, label: 'Манай багийн хариултад өгсөн санал' }) +
    Charts.legend([{ label: 'Зөв', value: v.ok || 0, color: CH.mint }, { label: 'Хэсэгчлэн', value: v.partial || 0, color: CH.butter }, { label: 'Буруу', value: v.wrong || 0, color: CH.rose }]);
  B.push(['prmine', '<div class="card prmine ' + (rating === 'ok' ? 'tint-mint' : rating === 'partial' ? 'tint-butter' : 'tint-pink') + ' pop">' + teamSt(ST.me.team, 64, 'stkc tr') + '<div class="k small muted">Манай багийн хариулт хэрхэн үнэлэгдсэн</div><h3>' + (rating ? esc(RL[rating]) : 'Үнэлгээ гараагүй') + (tp ? ' · баг +' + tp : '') + '</h3>' +
    '<div class="distw"><div class="dd">' + donut + '</div><div class="db">' + (c.myTeamAns && c.myTeamAns.text ? '<div class="small muted">Манай хариулт:</div><div class="ans">' + esc(c.myTeamAns.text) + '</div>' : '<p class="muted">Манай баг хариулт хадгалаагүй байсан.</p>') + '</div></div></div>']);
  var p = c.myPts || 0, mv = c.myVote ? c.myVote.vote : null;
  B.push(['prme', '<div class="card rescard r-' + (p >= (sc.peerHit || 10) ? 'ok' : p > 0 ? 'part' : mv ? 'no' : 'none') + '">' + stk(p > 0 ? pick('happy', 'p' + ST.me.id) : pick('sad', 'p' + ST.me.id), 86, 'resstk') +
    '<div class="rest"><div class="resh">' + (mv ? 'Таны үнэлгээ: ' + esc(RL[mv]) : 'Та үнэлгээ өгөөгүй.') + '</div><div class="ress">' + (c.truth ? 'Тэр багийн эцсийн үнэлгээ: ' + esc(RL[c.truth]) + '. ' : '') + (p >= (sc.peerHit || 10) ? 'Яг таарлаа! ✨' : p > 0 ? 'Ойролцоо байна 🌷' : mv ? 'Энэ удаад таарсангүй — загвар хариултыг хамт уншъя 🌼' : 'Дараагийн удаа заавал үнэлээрэй 🌷') + '</div></div><div class="respts">' + (p > 0 ? '+' + p : '0') + '<small>оноо</small></div></div>']);
  var rv = c.reveal || {};
  B.push(['prmodel', '<div class="card qcard">' + (c.q ? qBody(c.q) : '') + '<div class="small muted">Загвар хариулт:</div><div class="ans good">' + esc(rv.model || rv.explanation || '') + '</div>' + (rv.misconception ? '<div class="expl miscon"><h4>Түгээмэл буруу ойлголт</h4>' + esc(rv.misconception) + '</div>' : '') + '</div>']);
}

/* ----- 3, 4-р шат: багийн шийдвэр ----- */
function teamBlocks(B, c, kind) {
  var q = c.q, ta = c.tans, dk = 'T|' + c.stepId + '|' + q.id, d = D(dk);
  if (kind === 'final') {
    B.push(['fwhy', '<div class="card tint-peach">' + stk('strawberry', 62, 'stkc tr') + '<h3>Яагаад энэ асуулт?</h3><p>Энэ асуулт <b>таны багийн өмнөх хариултуудаас хамгийн сул гарсан сэдэв</b>' + (q.concept ? ' — «' + esc(q.concept) + '»' : '') + ' дээр тулгуурласан. Багаараа хамтдаа ярилцаж, нэг хариулт сонгоод багаа авраарай! 💪</p></div>']);
  }
  if (kind === 'duel' && c.picks) {
    var g = {}, order = [], miss = [];
    c.picks.forEach(function (p) { if (!p.answered) { miss.push(p.name); return; } if (!g[p.desc]) { g[p.desc] = []; order.push(p.desc); } g[p.desc].push(p.name); });
    order.sort(function (x, y) { return g[y].length - g[x].length; });
    var cols = ['pink', 'lilac', 'butter', 'mint', 'peach'];
    B.push(['picks', '<div class="card">' + '<div class="rowb"><h3>Гишүүдийн хувийн хариулт</h3><span class="pill mint">' + (c.picks.length - miss.length) + '/' + c.picks.length + '</span></div>' +
      (order.length ? '<div class="pgroups">' + order.map(function (k, i) { return '<div class="pg ' + cols[i % 5] + '"><span class="pgn">' + g[k].length + '</span><div class="pgt"><div class="pgd">' + esc(k) + '</div><div class="pgw">' + g[k].map(function (n) { return '<span class="whoc">' + avatar(n, 20) + esc(n) + '</span>'; }).join('') + '</div></div></div>'; }).join('') + '</div>' : '<p class="muted">Хувийн хариулт ирээгүй байна.</p>') +
      (miss.length ? '<p class="small muted mt8">Хариулаагүй: ' + esc(miss.join(', ')) + '</p>' : '') + '</div>']);
  }
  if (ta && ta.locked) {
    B.push(['tlock', '<div class="card lockc tint-mint pop">' + stk(pick('cheer', c.stepId), 74, 'stkc tr') + '<div class="lockh">🔒 Түгжигдсэн · ' + esc(ta.by || '') + '</div><div class="small muted">Багийн эцсийн хариулт:</div><div class="ans">' + esc(ta.desc || '') + '</div><p class="small muted mt8">Үр дүн цаг дуусахад гарна. ' + esc(cutePick('team', c.stepId)) + '</p></div>']);
    return;
  }
  initDraft(q, d, c.myAnswer || null);
  B.push(['tdec', '<div class="card qcard">' + stk(pick('science', q.id + 't'), 56, 'stkc tr') + qHead(c, kind === 'duel' ? 'Багийн шийдвэр' : 'Багийн хариулт') + qBody(q) +
    (ta && ta.desc ? '<div class="res pend">💡 Санал: ' + esc(ta.desc) + ' · ' + esc(ta.by || '') + '</div>' : '') + inputs(q, dk, d) +
    '<p class="tuonly err">⌛ Цаг дууссан.</p>' + sendBtn(dk, 'tlock', '🔒 Эцсийн хариулт сонгож түгжих') +
    '<div class="btnrow mt8"><button type="button" class="btn lilac sendbtn' + (inflight[dk + 'tprop'] ? ' busy' : '') + '" data-act="tprop" data-d="' + esc(dk) + '">💡 Санал болгох</button><button type="button" class="btn butter chatcta" data-act="chat">💬 Чат</button></div>' +
    '<p class="small muted center mt8">Түгжсэний дараа өөрчлөх боломжгүй. Түгжээгүй бол цаг дуусахад ' + (kind === 'duel' ? 'санал эсвэл олонхийн хариулт' : 'хамгийн сүүлийн санал') + ' сонгогдоно.</p></div>']);
}
function teamRevBlocks(B, c, kind) {
  var q = c.q, rv = c.reveal, ta = c.tans, tr = c.teamRes || {}, sc = ST.scoring || {};
  var ok = !!tr.ok;
  B.push(['trres', '<div class="card rescard r-' + (ta ? (ok ? 'ok' : 'no') : 'none') + ' pop">' + teamSt(ST.me.team, 86, 'resstk') + '<div class="rest"><div class="resh">' + (ta ? (ok ? '✔ Багийн хариулт зөв!' : '✗ Багийн хариулт буруу.') : 'Баг хариулт өгөөгүй.') + '</div><div class="ress">' + esc(ok ? cutePick('right', c.stepId + ST.me.team) : cutePick('wrong', c.stepId + ST.me.team)) + '</div></div><div class="respts">' + (ok ? '+' + sc.teamQ : '0') + '<small>баг</small></div></div>']);
  if (kind === 'duel' && c.result) {
    var r = c.result;
    B.push(['trme', '<div class="card mymini ' + (r.none ? '' : r.ok === true ? 'tint-mint' : 'tint-pink') + '"><b>Миний хувийн хариулт:</b> ' + (r.none ? 'Хариулаагүй' : (r.ok === true ? 'Зөв хариулт.' : 'Буруу хариулт.') + ' · +' + num(r.pts) + ' оноо') + (c.myAnswer ? '<div class="small muted">' + esc(describeAnswer(q, c.myAnswer)) + '</div>' : '') + '</div>']);
  }
  B.push(['trexp', '<div class="card qcard">' + qHead(c, kind === 'duel' ? 'Enzyme Duel' : 'Save Your Team') + qBody(q) +
    (ta ? '<div class="small muted">Багийн хариулт' + (ta.auto ? ' (автоматаар олонхийн)' : ta.by ? ' · ' + esc(ta.by) : '') + ':</div><div class="ans mine' + (ok ? '' : ' bad') + '">' + esc(ta.desc || '') + '</div>' : '') +
    '<div class="small muted mt8">Зөв хариулт:</div><div class="ans good">' + esc(correctText(q, rv)) + '</div>' + explain(rv) + '</div>']);
}

/* ------------------------------ дуусах дэлгэц ------------------------------ */
function doneBlocks(B) {
  var s = ST, board = (s.board || []).slice().sort(function (a, b) { return a.rank - b.rank || b.score - a.score; });
  var mine = board.filter(function (b) { return b.team === s.me.team; })[0] || {};
  B.push(['dhero', '<div class="card hero center donehero tint-pink">' + '<div class="stkrow">' + stk('dance', 92, 'float') + stk(TEAMIMG[s.me.team] || 'purple', 80, 'float d1') + stk('tongue', 78, 'float d2') + '</div>' +
    '<h2>Сорилт дууслаа!</h2><div class="cute">' + esc(cutePick('done', s.me.id)) + '</div><p class="muted">Манай баг <b>' + esc(s.me.teamName) + '</b> — <b>' + (mine.rank || '–') + '-р байр</b></p></div>']);
  var pod = [board[1], board[0], board[2]].filter(Boolean);
  B.push(['dpod', '<div class="card"><h3>Багуудын эцсийн байр</h3><div class="podium">' + pod.map(function (b) {
    return '<div class="pd pd' + b.rank + (b.team === s.me.team ? ' me' : '') + '">' + teamSt(b.team, b.rank === 1 ? 70 : 56) + '<div class="pdn">' + esc(b.name) + '</div><div class="pdb" style="background:' + TEAMCOL[b.team] + '"><span class="pdr">' + b.rank + '</span><span class="pds">' + num(b.score) + '</span></div></div>';
  }).join('') + '</div>' +
    '<div class="rklist">' + board.map(function (b) { return '<div class="rkr' + (b.team === s.me.team ? ' me' : '') + '"><span class="rkn">' + b.rank + '</span>' + teamSt(b.team, 34) + '<div class="rkt"><b>' + esc(b.name) + '</b><span class="small muted">' + (b.accuracy != null ? 'Нарийвчлал ' + b.accuracy + '% · ' : '') + 'Багийн оноо +' + num(b.teamPts) + '</span></div><span class="rks">' + num(b.score) + '</span></div>'; }).join('') + '</div></div>']);
  B.push(['dstack', '<div class="card"><h3>Шат тус бүрийн оноо</h3>' + Charts.stacked(board.map(function (b) { return { name: b.name, color: TEAMCOL[b.team], stages: b.stages || [0, 0, 0, 0, 0], score: num(b.score) }; })) + '</div>']);
  var seenQ = {}, all = (s.all || []).filter(function (a) { if (seenQ[a.id]) return false; seenQ[a.id] = 1; return true; }), okN = all.filter(function (a) { return a.ok === true; }).length;
  B.push(['dme', '<div class="card"><h3>Миний үр дүн</h3><div class="tiles3"><div class="tile pink"><div class="k">Миний оноо</div><div class="v">' + num(s.me.score) + '</div></div><div class="tile mint"><div class="k">Зөв</div><div class="v">' + okN + '<small>/' + all.length + '</small></div></div><div class="tile lilac"><div class="k">Peer Check</div><div class="v">+' + num(s.me.peer) + '</div></div></div>' +
    '<div class="mylist">' + all.map(function (a, i) { var k = a.none ? 'none' : a.ok === true ? 'ok' : a.ok === 'partial' ? 'part' : 'no'; return '<div class="myr m-' + k + '"><span class="stagechip s' + a.stage + '">' + a.stage + '</span><span class="myt">' + esc(a.text) + '</span><span class="mys">' + (a.none ? '—' : a.ok === true ? '✔' : '✗') + ' <b>' + num(a.pts) + '</b></span></div>'; }).join('') + '</div></div>']);
  var ch = s.charts || {};
  if (ch.concepts && ch.concepts.length) B.push(['dcon', '<div class="card"><h3>Ойлголт тус бүрээр (анги даяар)</h3><p class="small muted">Хамгийн сул ойлголт дээрээс нь эхэлж харуулав.</p>' + Charts.hbars(ch.concepts.map(function (x) { return { label: x.name, value: x.pct, color: x.pct >= 70 ? CH.mint : x.pct >= 45 ? CH.butter : CH.pink, text: x.pct + '%' }; }), { max: 100 }) + '</div>']);
  if (ch.perQ && ch.perQ.length) B.push(['dperq', '<div class="card"><h3>Асуулт тус бүр</h3><div class="perq">' + ch.perQ.map(function (p, i) {
    var d = p.dist || {}, none = Math.max(0, (d.total || 0) - (d.answered || 0));
    return '<div class="pq"><div class="pqh"><span class="pill pink">А' + (i + 1) + '</span>' + (p.concept ? '<span class="small muted">' + esc(p.concept) + '</span>' : '') + '</div>' + Charts.donut([{ value: d.correct, color: CH.mint }, { value: d.partial || 0, color: CH.butter }, { value: d.wrong, color: CH.rose }, { value: none, color: CH.track }], { center: d.answered ? Math.round(d.correct / d.answered * 100) + '%' : '–', sub: 'зөв', size: 110, label: 'Асуулт ' + (i + 1) }) + '<div class="pqt">' + esc(p.text) + '</div></div>';
  }).join('') + '</div>' + Charts.legend([{ label: 'Зөв', color: CH.mint }, { label: 'Буруу', color: CH.rose }, { label: 'Хариулаагүй', color: CH.track }]) + '</div>']);
  B.push(['dend', '<div class="card center tint-butter">' + stk('mouse', 70) + '<p><b>Багш ярилцлагыг эхлүүлнэ.</b></p><p class="small muted">Энэ хуудсыг нээлттэй байлгаарай 🌷</p></div>']);
}
function maybeConfetti() {
  if (UI.confetti || !ST.board) return; var mine = ST.board.filter(function (b) { return b.team === ST.me.team; })[0];
  if (!mine || mine.rank !== 1) return; UI.confetti = true;
  var cs = [CH.pink, CH.lilac, CH.butter, CH.mint, CH.peach, CH.sky];
  for (var i = 0; i < 46; i++) { var e = document.createElement('i'); e.className = 'cf'; e.style.left = Math.random() * 100 + 'vw'; e.style.background = cs[i % cs.length]; e.style.animationDelay = (Math.random() * 1.4) + 's'; e.style.animationDuration = (2.4 + Math.random() * 1.6) + 's'; document.body.appendChild(e); (function (x) { setTimeout(function () { x.remove(); }, 5200); })(e); }
}

/* ------------------------------ үйлдлүүд ------------------------------ */
var main = $('s-main');
main.addEventListener('click', function (ev) {
  var b = ev.target.closest('[data-act]'); if (!b || b.tagName === 'SELECT' || b.tagName === 'TEXTAREA' || b.disabled) return;
  var act = b.dataset.act, dk = b.dataset.d, d = dk ? D(dk) : null;
  if (act === 'stg') { var sid = +b.dataset.s; UI.stageOpen[sid] = !UI.stageOpen[sid]; render(); return; }
  if (act === 'intro') { var st = ST.t.stage, cur = b.getAttribute('aria-expanded') === 'true'; UI.intro[st] = !cur; render(); return; }
  if (act === 'chat') { openChat(); return; }
  if (act === 'switch') { ask('Нэр солих уу?', 'Одоогийн нэрээсээ гараад өөр нэр сонгоно.', 'Тийм', 'Үгүй', 'pencil').then(function (y) { if (y) logout(); }); return; }
  var q = ST && ST.cur && ST.cur.q;
  if (act === 'pick') { d.i = +b.dataset.i; }
  else if (act === 'tog') { var a = d.arr || (d.arr = []), v = +b.dataset.i, p = a.indexOf(v); if (p >= 0) a.splice(p, 1); else a.push(v); }
  else if (act === 'tf') { d.v = b.dataset.v === '1'; }
  else if (act === 'up' || act === 'dn') { var k = +b.dataset.k, o = d.ord, j = act === 'up' ? k - 1 : k + 1; if (o && j >= 0 && j < o.length) { var x = o[k]; o[k] = o[j]; o[j] = x; } }
  else if (act === 'vote') { d.vote = b.dataset.v; }
  else if (act === 'wload') { var ta = ST.cur && ST.cur.tans; if (ta) { d.text = ta.text || ''; d.base = ta.t; d.dirty = false; d.v = (d.v || 1) + 1; } }
  else if (act === 'send') return sendInd(dk, q);
  else if (act === 'wsave') return sendWrite(dk, q);
  else if (act === 'psend') return sendPeer(dk);
  else if (act === 'tlock') return sendTeam(dk, q, true);
  else if (act === 'tprop') return sendTeam(dk, q, false);
  saveDrafts(); render();
});
main.addEventListener('change', function (ev) {
  var b = ev.target; if (!b.dataset || b.dataset.act !== 'mt') return; var d = D(b.dataset.d); d.map = d.map || [];
  d.map[+b.dataset.k] = b.value === '' ? null : +b.value; saveDrafts(); render();
});
main.addEventListener('input', function (ev) {
  var b = ev.target; if (!b.dataset || !b.dataset.d) return; var d = D(b.dataset.d);
  if (b.dataset.act === 'why') d.why = b.value; else if (b.dataset.act === 'wtxt') { d.text = b.value; d.dirty = true; }
  saveDrafts();
});
function busy(key, on) { if (on) inflight[key] = true; else delete inflight[key]; render(); }
function post(url, body, key, onOk) {
  if (inflight[key]) return; busy(key, true); var tries = 0;
  (function go() {
    api(url, { token: TOKEN, body: body }).then(function (j) {
      busy(key, false);
      if (j._status === 401) return logout('Дахин нэвтэрнэ үү.');
      if (!j.ok) { toast(j.err || 'Алдаа гарлаа.', 'bad'); fetchState(); return; }
      onOk(j); fetchState();
    }).catch(function () { if (++tries < 3) return setTimeout(go, 1200); busy(key, false); toast('Холболт тасарлаа. Дахин оролдоно уу — таны сонголт хадгалагдсан.', 'bad'); });
  })();
}
function guardTime() { if (main.classList.contains('timeup')) { toast('Цаг дууссан.', 'bad'); return false; } if (ST.t.paused) { toast('Сорилт түр зогссон байна.', 'bad'); return false; } return true; }
function sendInd(dk, q) {
  if (!q) return; var d = D(dk), ans = collect(q, d);
  if (!ans) { toast(q.type === 'match' ? 'Бүх мөрийг сонгоно уу.' : 'Эхлээд хариултаа сонгоно уу.', 'bad'); return; }
  if (!guardTime()) return;
  post('/api/answer', { qid: q.id, answer: ans, why: (d.why || '').trim() }, dk + 'send', function (j) {
    toast(j.dup ? 'Та энэ асуултад аль хэдийн хариулсан байна.' : 'Хариулт бүртгэгдлээ.', j.dup ? '' : 'ok');
    if (ST.cur && ST.cur.q && ST.cur.q.id === q.id) { ST.cur.answered = true; if (!j.dup) ST.cur.myAnswer = ans; else if (!ST.cur.myAnswer) ST.cur.myAnswer = ans; render(); }
  });
}
function sendWrite(dk, q) {
  if (!q) return; var d = D(dk), text = (d.text || '').trim();
  if (!text) { toast('Хариултаа бичнэ үү.', 'bad'); return; } if (!guardTime()) return;
  post('/api/team/answer', { qid: q.id, answer: { text: text } }, dk + 'wsave', function (j) { d.dirty = false; toast(j.msg || 'Багийн хариулт хадгалагдлаа.', j.dup ? '' : 'ok'); });
}
function sendPeer(dk) {
  var d = D(dk); if (!d.vote) { toast('Үнэлгээгээ сонгоно уу.', 'bad'); return; } if (!guardTime()) return;
  post('/api/peer', { vote: d.vote, why: (d.why || '').trim() }, dk + 'psend', function (j) { toast(j.msg || 'Үнэлгээ бүртгэгдлээ.', 'ok'); });
}
function sendTeam(dk, q, lock) {
  if (!q) return; var d = D(dk), ans = collect(q, d);
  if (!ans) { toast(q.type === 'match' ? 'Бүх мөрийг сонгоно уу.' : 'Эхлээд хариултаа сонгоно уу.', 'bad'); return; }
  if (!guardTime()) return;
  var go = function () { post('/api/team/answer', { qid: q.id, answer: ans, lock: !!lock }, dk + (lock ? 'tlock' : 'tprop'), function (j) { toast(j.msg || (lock ? 'Багийн хариулт түгжигдлээ.' : 'Санал хадгалагдлаа.'), j.dup ? '' : 'ok'); }); };
  if (!lock) return go();
  ask('Эцсийн хариултыг түгжих үү?', '«' + (describeAnswer(q, ans) || '') + '» — түгжсэний дараа баг бүхэлдээ өөрчлөх боломжгүй.', '🔒 Түгжих', 'Болих', 'lab').then(function (y) { if (y) go(); });
}

/* ------------------------------ багийн чат ------------------------------ */
function buildChat() {
  if ($('chatBtn')) return;
  $('chatRoot').innerHTML = '<button type="button" class="chatbtn" id="chatBtn" aria-label="Багийн чат нээх">💬<span class="dotnew hide" id="chatNew"></span></button>' +
    '<div class="chatpanel hide" id="chatPanel" role="dialog" aria-label="Багийн чат"><div class="chathead"><span id="chatStk"></span><span class="sp" id="chatTitle">Багийн чат</span><button type="button" class="btn ghost sm" id="chatClose" aria-label="Хаах">✕</button></div>' +
    '<div class="chatlog" id="chatLog" aria-live="polite"></div><div class="chatoff hide" id="chatOff">Чат одоогоор хаалттай байна.</div>' +
    '<form class="chatform" id="chatForm" autocomplete="off"><input id="chatIn" type="text" maxlength="300" placeholder="Багийнхандаа бичих…" aria-label="Мессеж"><button class="btn primary" type="submit" id="chatSend" aria-label="Илгээх">➤</button></form></div>';
  $('chatBtn').addEventListener('click', function () { if (UI.chatOpen) closeChat(); else openChat(); });
  $('chatClose').addEventListener('click', closeChat);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && UI.chatOpen && !document.querySelector('.askm')) closeChat(); });
  $('chatForm').addEventListener('submit', function (ev) {
    ev.preventDefault(); var inp = $('chatIn'), text = inp.value.trim(); if (!text) return; if (ST && !ST.chatOn) { toast('Чат одоогоор хаалттай байна.', 'bad'); return; }
    var btn = $('chatSend'); if (btn.classList.contains('busy')) return; btn.classList.add('busy');
    api('/api/chat', { token: TOKEN, body: { text: text } }).then(function (j) { btn.classList.remove('busy'); if (!j.ok) { toast(j.err || 'Илгээж чадсангүй.', 'bad'); return; } inp.value = ''; inp.focus(); })
      .catch(function () { btn.classList.remove('busy'); toast('Холболт тасарлаа. Дахин оролдоно уу.', 'bad'); });
  });
}
function openChat() { if (!$('chatPanel')) return; UI.chatOpen = true; $('chatPanel').classList.remove('hide'); $('chatBtn').classList.add('open'); UI.msgs.forEach(function (m) { UI.seen[m.id] = 1; }); UI.unread = 0; renderChat(true); setTimeout(function () { var i = $('chatIn'); if (i && ST && ST.chatOn) i.focus(); }, 30); }
function closeChat() { UI.chatOpen = false; if ($('chatPanel')) { $('chatPanel').classList.add('hide'); $('chatBtn').classList.remove('open'); } renderChat(); }
function syncChat(list) {
  var first = !UI.chatInit; UI.chatInit = true; UI.msgs = list.slice();
  UI.msgs.forEach(function (m) { if (!UI.seen[m.id]) { if (first || UI.chatOpen || (ST && m.sid === ST.me.id)) UI.seen[m.id] = 1; } });
  renderChat();
}
function addChat(m) {
  if (UI.msgs.some(function (x) { return x.id === m.id; })) return; UI.msgs.push(m); if (UI.msgs.length > 120) UI.msgs.shift();
  if (UI.chatOpen || (ST && m.sid === ST.me.id)) UI.seen[m.id] = 1;
  renderChat();
}
var chatSig = '';
function renderChat(force) {
  if (!$('chatLog') || !ST) return; var me = ST.me;
  var unread = UI.msgs.filter(function (m) { return !UI.seen[m.id]; }).length; var nb = $('chatNew');
  nb.textContent = unread > 9 ? '9+' : unread; nb.classList.toggle('hide', !unread); $('chatBtn').classList.toggle('has', !!unread);
  $('chatTitle').textContent = 'Багийн чат · ' + me.teamName; var cs = $('chatStk'); if (!cs.firstChild) cs.innerHTML = teamSt(me.team, 30);
  $('chatOff').classList.toggle('hide', !!ST.chatOn); $('chatForm').classList.toggle('hide', !ST.chatOn);
  var sig = UI.msgs.map(function (m) { return m.id; }).join(',');
  if (!force && sig === chatSig) return; chatSig = sig;
  var log = $('chatLog'), near = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.innerHTML = UI.msgs.length ? UI.msgs.map(function (m) {
    var mine = m.sid && m.sid === me.id;
    return '<div class="msg' + (m.teacher ? ' teacher' : mine ? ' me' : '') + '"><span class="nm">' + (m.teacher ? '👩‍🏫 Багш' : esc(mine ? 'Би' : m.name)) + ' · ' + hm(m.t) + '</span>' + esc(m.text) + '</div>';
  }).join('') : '<div class="chatempty">' + stk('bubble', 90) + '<p class="small muted">Багийнхандаа хамгийн түрүүнд сайн уу гэж бичээрэй 🌸</p></div>';
  if (near || force) log.scrollTop = log.scrollHeight;
}
})();
