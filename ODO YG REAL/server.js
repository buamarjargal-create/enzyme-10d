'use strict';
// ENZYME 10D — бодит цагийн сургалтын систем. Express + Socket.IO, өгөгдөл data/db.json дотор хадгалагдана.
const http = require('http'), path = require('path'), fs = require('fs'), crypto = require('crypto');
const { spawn } = require('child_process');
const { createApp } = require('./lib/mini');
const QRCode = require('./lib/qr/QRCode'), QRL = require('./lib/qr/QRCode/QRErrorCorrectLevel');
function qrDataUrl(text) { const q = new QRCode(-1, QRL.M); q.addData(text); q.make(); const n = q.getModuleCount(), m = 4, sz = n + m * 2; let d = ''; for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z'; const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + sz + ' ' + sz + '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>'; return 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64'); }
const seed = require('./seed');

const PORT = +process.env.PORT || 3000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const SITE_URL = (process.env.SITE_URL || '').replace(/\/+$/, '');
fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });

/* ------------------------------ helpers ------------------------------ */
const rid = n => crypto.randomBytes(n).toString('hex');
const now = () => Date.now();
const clean = (s, max = 200) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
function hashPw(pw, salt) { return crypto.scryptSync(String(pw), salt, 64).toString('hex'); }
function checkPw(pw, salt, hash) { try { const a = Buffer.from(hashPw(pw, salt), 'hex'), b = Buffer.from(hash, 'hex'); return a.length === b.length && crypto.timingSafeEqual(a, b); } catch (e) { return false; } }
function hashSeed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function seededShuffle(n, seedStr) { const a = [...Array(n).keys()]; let s = hashSeed(seedStr) || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function seededNonIdentity(n, seedStr) { let a = seededShuffle(n, seedStr); if (n > 1 && a.every((v, i) => v === i)) a = a.slice(1).concat(a[0]); return a; }
/* ------------------------------ persistence ------------------------------ */
let db;
function freshCreds() {
  const pw = process.env.TEACHER_PASSWORD || ('Enz-' + crypto.randomBytes(4).toString('hex'));
  db.settings.teacherSalt = rid(16); db.settings.teacherHash = hashPw(pw, db.settings.teacherSalt);
  db.settings.pwInitial = !process.env.TEACHER_PASSWORD;
  if (!process.env.TEACHER_PASSWORD) { try { fs.writeFileSync(path.join(DATA_DIR, 'FIRST-PASSWORD.txt'), 'Багшийн анхны нууц үг: ' + pw + '\nНэвтэрсний дараа Тохиргоо хэсэгт заавал солино уу.\n'); } catch (e) {} global.__firstPw = pw; }
}
function load() {
  let old = null;
  try { old = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch (e) { old = null; }
  if (old && old.v === 3 && old.settings && old.students) db = old;
  else {
    db = seed.make();
    if (old && old.settings && old.students) { // хуучин хувилбараас шилжүүлэх: нууц үг, код, сурагч, баг хэвээр
      try { fs.copyFileSync(DB_FILE, path.join(DATA_DIR, 'backups', 'db-old-v' + (old.v || 1) + '-' + Date.now() + '.json')); } catch (e) {}
      ['teacherUser', 'teacherHash', 'teacherSalt', 'pwInitial', 'code', 'className', 'topic', 'subject', 'pinEnabled'].forEach(k => { if (old.settings[k] !== undefined) db.settings[k] = old.settings[k]; });
      db.students = old.students; db.tokens = old.tokens || {}; db.tsess = old.tsess || {};
    } else freshCreds();
    save(true);
  }
  ['tokens', 'tsess', 'answers', 'tans', 'pvotes', 'ratings', 'adjust', 'teamAdjust'].forEach(k => db[k] = db[k] || {});
  db.chat = db.chat || {}; [1, 2, 3, 4].forEach(t => db.chat[t] = db.chat[t] || []);
  db.feed = db.feed || []; db.present = db.present || { kind: null };
  const R0 = db.run; R0.revealed = R0.revealed || {}; R0.finalMap = R0.finalMap || {}; R0.script = R0.script || [];
}
let saveTimer = null;
function save(sync) {
  const write = () => { saveTimer = null; try { const tmp = DB_FILE + '.tmp'; fs.writeFileSync(tmp, JSON.stringify(db)); fs.renameSync(tmp, DB_FILE); } catch (e) { console.error('Хадгалах алдаа:', e.message); } };
  if (sync) { if (saveTimer) clearTimeout(saveTimer); return write(); }
  if (!saveTimer) saveTimer = setTimeout(write, 250);
}
function backup(tag) { try { fs.copyFileSync(DB_FILE, path.join(DATA_DIR, 'backups', 'db-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + tag + '.json')); const f = fs.readdirSync(path.join(DATA_DIR, 'backups')).sort(); while (f.length > 30) fs.unlinkSync(path.join(DATA_DIR, 'backups', f.shift())); } catch (e) {} }
load();

/* ------------------------------ presence, feed ------------------------------ */
const socketsOf = {}; // studentId -> Set(connection)
const online = id => !!(socketsOf[id] && socketsOf[id].size);
function feed(text, kind) { db.feed.push({ t: now(), text, kind: kind || '' }); if (db.feed.length > 300) db.feed.splice(0, db.feed.length - 300); }
const S = () => db.settings;
const stu = id => db.students.find(s => s.id === id);
const qById = id => db.questions.find(q => q.id === id);
const teamName = t => (S().teams[t - 1] || {}).name || ('Баг ' + t);
const members = t => db.students.filter(s => s.team === t);
const PIC_DIR = path.join(__dirname, 'public', 'img', 'q');
const listPics = () => { try { return fs.readdirSync(PIC_DIR).filter(f => /\.(png|jpe?g|webp|svg|gif)$/i.test(f)).sort(); } catch (e) { return []; } };

/* ------------------------------ questions ------------------------------ */
const TYPES = ['mcq', 'multi', 'tf', 'order', 'match', 'short'];
function publicQ(q, seedKey) {
  const o = { id: q.id, type: q.type, text: q.text, graph: q.graph || null, image: q.image || null, askWhy: !!q.askWhy, askJustify: !!q.askJustify, concept: q.concept };
  if (q.type === 'mcq' || q.type === 'multi') { const p = seededShuffle(q.options.length, seedKey + q.id); o.options = p.map(i => ({ i, text: q.options[i] })); }
  if (q.type === 'order') { const p = seededNonIdentity(q.items.length, seedKey + q.id); o.items = p.map(i => ({ i, text: q.items[i] })); }
  if (q.type === 'match') { o.lefts = q.pairs.map(p => p.l); const p = seededNonIdentity(q.pairs.length, seedKey + q.id); o.rights = p.map(i => ({ i, text: q.pairs[i].r })); }
  return o;
}
function revealQ(q) {
  const o = { explanation: q.explanation || '', misconception: q.misconception || '', discussion: q.discussion || '' };
  if (q.type === 'mcq' || q.type === 'multi' || q.type === 'tf') o.correct = q.correct;
  else if (q.type === 'order') o.correctItems = q.items; else if (q.type === 'match') o.correctPairs = q.pairs;
  else if (q.type === 'short') o.model = q.explanation || '';
  return o;
}
function gradeAnswer(q, a) {
  if (q.type === 'short') return { ok: null, pts: 0 };
  let ok = false;
  if (q.type === 'mcq') ok = a.i === q.correct;
  else if (q.type === 'multi') { const x = [...a.arr].sort(), y = [...q.correct].sort(); ok = x.length === y.length && x.every((v, i) => v === y[i]); }
  else if (q.type === 'tf') ok = a.v === q.correct;
  else if (q.type === 'order' || q.type === 'match') ok = a.arr.every((v, i) => v === i);
  return { ok, pts: ok ? S().scoring.ind : 0 };
}
function validateAnswer(q, d) {
  if (!d || typeof d !== 'object') return null;
  const perm = (arr, n) => Array.isArray(arr) && arr.length === n && arr.every(v => isInt(v, 0, n - 1)) && new Set(arr).size === n;
  if (q.type === 'mcq') return isInt(d.i, 0, q.options.length - 1) ? { i: d.i } : null;
  if (q.type === 'multi') return Array.isArray(d.arr) && d.arr.length >= 1 && d.arr.every(v => isInt(v, 0, q.options.length - 1)) && new Set(d.arr).size === d.arr.length ? { arr: d.arr } : null;
  if (q.type === 'tf') return typeof d.v === 'boolean' ? { v: d.v } : null;
  if (q.type === 'order') return perm(d.arr, q.items.length) ? { arr: d.arr } : null;
  if (q.type === 'match') return perm(d.arr, q.pairs.length) ? { arr: d.arr } : null;
  if (q.type === 'short') { const t = clean(d.text, 900); return t ? { text: t } : null; }
  return null;
}
// богино хариултын түлхүүр үгээр: 'ok' | 'partial' | 'wrong' | null (түлхүүр үггүй)
function autoRate(q, text) {
  if (!q || !q.keywords || !q.keywords.length) return null; const t = String(text || '').toLowerCase();
  const f = q.keywords.filter(g => g.some(k => t.includes(String(k).toLowerCase()))).length / q.keywords.length;
  return f >= 0.99 ? 'ok' : f >= 0.5 ? 'partial' : 'wrong';
}
function describeAnswer(q, a) {
  try {
    if (q.type === 'mcq') return q.options[a.i]; if (q.type === 'multi') return a.arr.slice().sort().map(i => q.options[i]).join(' | ');
    if (q.type === 'tf') return a.v ? 'Үнэн' : 'Худал'; if (q.type === 'order') return a.arr.map(i => q.items[i]).join(' → ');
    if (q.type === 'match') return a.arr.map((r, k) => q.pairs[k].l + ' ⇒ ' + q.pairs[r].r).join(' | '); if (q.type === 'short') return a.text;
  } catch (e) {} return '';
}
const sameAns = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/* ------------------------------ script (шат, үе) ------------------------------ */
const KINDS = { q: ['ind', 'rev'], write: ['team'], peer: ['peer', 'rev'], duel: ['ind', 'team', 'rev'], final: ['team', 'rev'] };
const stageQs = st => db.questions.filter(q => q.active && q.stage === st).sort((a, b) => a.slot - b.slot || a.order - b.order);
function buildScript() {
  const sc = [];
  stageQs(1).forEach(q => sc.push({ id: 'q:' + q.id, stage: 1, kind: 'q', qid: q.id }));
  const w = stageQs(2)[0]; if (w) { sc.push({ id: 'w:' + w.id, stage: 2, kind: 'write', qid: w.id }); sc.push({ id: 'p:' + w.id, stage: 2, kind: 'peer', qid: w.id }); }
  const d = stageQs(3); if (d.length) { const qids = {}; for (let t = 1; t <= 4; t++) { const q = d.find(x => x.team === t) || d.find(x => x.team === 0) || d[0]; qids[t] = q.id; } sc.push({ id: 'd', stage: 3, kind: 'duel', qids }); }
  if (stageQs(4).length) sc.push({ id: 'f', stage: 4, kind: 'final', qids: {} });
  return sc;
}
const R = () => db.run;
const curStep = () => R().phase === 'live' ? R().script[R().step] || null : null;
const phName = () => { const st = curStep(); return st ? KINDS[st.kind][R().ph] : null; };
const stepQid = (st, team) => st ? (st.qid || (st.qids && st.qids[team]) || null) : null;
const curQ = team => { const st = curStep(); return st ? qById(stepQid(st, team)) : null; };
const phDur = (st, ph) => ((S().timing[st.kind] || {})[ph] || 30);
const stepLabel = st => { const q = st.qid ? qById(st.qid) : null; return st.kind === 'q' ? 'Асуулт ' + (stageQs(1).findIndex(x => x.id === st.qid) + 1) : st.kind === 'write' ? 'Багийн хариулт' : st.kind === 'peer' ? 'Шалгалт' : st.kind === 'duel' ? 'Тулаан' : 'Эцсийн сорил'; };
function remainingMs() { const r = R(); if (r.paused) return r.pausedLeft; return r.endsAt ? Math.max(0, r.endsAt - now()) : 0; }
const reviewTarget = team => (team % 4) + 1;       // баг t нь t+1-ийг шалгана
const reviewerOf = team => ((team + 2) % 4) + 1;   // баг t-ийг шалгадаг баг
function weakestArea(team) {
  const acc = {}; // area -> [ok, n]
  const add = (area, ok) => { if (!area) return; const a = acc[area] = acc[area] || [0, 0]; a[1]++; if (ok) a[0]++; };
  Object.values(db.answers).forEach(a => { const s = stu(a.sid); if (!s || s.team !== team) return; const q = qById(a.qid); if (q && a.ok !== null) add(q.area, a.ok === true); });
  Object.values(db.tans).forEach(a => { if (a.team !== team) return; const q = qById(a.qid); if (q && a.ok !== undefined && a.ok !== null) add(q.area, a.ok === true); });
  let best = 0, bv = 2; for (let a = 1; a <= 4; a++) { if (!acc[a]) continue; const v = acc[a][0] / acc[a][1]; if (v < bv - 1e-9) { bv = v; best = a; } }
  return best || team;
}
function assignFinal(st) {
  const pool = stageQs(4); if (!pool.length) return;
  for (let t = 1; t <= 4; t++) { const area = weakestArea(t); const q = pool.find(x => x.area === area) || pool.find(x => x.area === t) || pool[0]; st.qids[t] = q.id; st['area' + t] = area; }
}
function lockTeamAnswers(st) { // 'team' үе дуусахад багийн хариултуудыг түгжинэ
  for (let t = 1; t <= 4; t++) {
    const qid = stepQid(st, t); const q = qById(qid); if (!q) continue; const key = t + '|' + qid; let ta = db.tans[key];
    if (!ta && st.kind === 'duel') { // түгжээгүй бол гишүүдийн олонхийн хариулт
      const cnt = new Map(); members(t).forEach(m => { const a = db.answers[akey(m.id, qid)]; if (a) { const k = JSON.stringify(a.ans); const e = cnt.get(k) || { n: 0, ans: a.ans }; e.n++; cnt.set(k, e); } });
      let best = null; cnt.forEach(e => { if (!best || e.n > best.n) best = e; });
      if (best) { ta = db.tans[key] = { team: t, qid, ans: best.ans, by: null, byName: 'Автомат (олонх)', t: now(), locked: true, auto: true }; }
    }
    if (ta && !ta.locked) ta.locked = true;
    if (ta && st.kind !== 'write') { const g = gradeAnswer(q, ta.ans); ta.ok = g.ok; }
  }
}
function enterPhase() {
  const r = R(), st = curStep(); if (!st) return; const ph = KINDS[st.kind][r.ph];
  r.paused = false; r.endsAt = now() + phDur(st, ph) * 1000; r.phStart = now();
  if (st.kind === 'final' && r.ph === 0) assignFinal(st);
  if (ph === 'rev') { r.revealed[st.id] = true; feed('📣 Үр дүн: ' + stageName(st.stage) + ' · ' + stepLabel(st), 'sys'); }
  else feed('▶ ' + stageName(st.stage) + ' · ' + stepLabel(st) + (ph === 'team' ? ' (багийн хэлэлцүүлэг)' : ''), 'sys');
}
const stageName = n => ((S().stages[n - 1] || {}).name || ('Шат ' + n));
function endPhase() { const st = curStep(); if (!st) return; if (KINDS[st.kind][R().ph] === 'team') lockTeamAnswers(st); }
function finish() { const r = R(); endPhase(); r.phase = 'done'; r.endsAt = null; r.paused = false; r.finishedAt = now(); r.script.forEach(s => r.revealed[s.id] = true); feed('🏁 Сорилт дууслаа. Эцсийн дүн гарлаа.', 'sys'); backup('done'); }
function advance() {
  const r = R(); endPhase(); const st = curStep(); if (!st) return finish();
  if (r.ph + 1 < KINDS[st.kind].length) { r.ph++; } else { r.step++; r.ph = 0; if (r.step >= r.script.length) return finish(); }
  enterPhase();
}
function startRun() { const r = R(); r.script = buildScript(); if (!r.script.length) return false; r.phase = 'live'; r.step = 0; r.ph = 0; r.locked = false; r.revealed = {}; r.finalMap = {}; r.startedAt = now(); enterPhase(); return true; }
function tick() { const r = R(); if (r.phase !== 'live' || r.paused || !r.endsAt) return false; if (now() < r.endsAt) return false; if (!S().autoAdvance && phName() === 'rev') return false; advance(); save(); return true; }

/* ------------------------------ scoring ------------------------------ */
const akey = (sid, qid) => sid + '|' + qid;
const stageOfStep = (sc, qid) => { const st = sc.find(s => s.qid === qid || (s.qids && Object.values(s.qids).includes(qid))); return st; };
function ratingTruth(team) { // багийн бичсэн хариулт (2-р шат)
  const st = R().script.find(s => s.kind === 'write'); if (!st) return null; const q = qById(st.qid); const ta = db.tans[team + '|' + st.qid]; if (!ta) return null;
  if (db.ratings[team]) return db.ratings[team];
  const a = autoRate(q, ta.ans.text); if (a) return a;
  const votes = members(reviewerOf(team)).map(m => (db.pvotes[m.id + '|' + team] || {}).vote).filter(Boolean); if (!votes.length) return null;
  const c = { ok: 0, partial: 0, wrong: 0 }; votes.forEach(v => c[v]++); return Object.keys(c).sort((x, y) => c[y] - c[x] || ['ok', 'partial', 'wrong'].indexOf(x) - ['ok', 'partial', 'wrong'].indexOf(y))[0];
}
const RIDX = { ok: 0, partial: 1, wrong: 2 };
function peerPoints(sid, onlyRevealed) {
  const s = stu(sid), st = R().script.find(x => x.kind === 'peer'); if (!s || !st) return 0;
  if (onlyRevealed && !R().revealed[st.id]) return 0;
  const target = reviewTarget(s.team), v = db.pvotes[sid + '|' + target]; if (!v) return 0; const T = ratingTruth(target); if (!T) return 0;
  const d = Math.abs(RIDX[v.vote] - RIDX[T]); return d === 0 ? S().scoring.peerHit : d === 1 ? S().scoring.peerNear : 0;
}
function computeScores(onlyRevealed) {
  const r = R(), sc = r.script || [], done = r.phase === 'done';
  const revQ = new Set(); sc.forEach(st => { if (done || r.revealed[st.id]) { if (st.qid) revQ.add(st.qid); if (st.qids) Object.values(st.qids).forEach(x => revQ.add(x)); } });
  const per = {}; db.students.forEach(s => per[s.id] = { score: 0, ind: 0, peer: 0, adj: 0, correct: 0, graded: 0, answers: 0, ms: 0, msN: 0, byStage: [0, 0, 0, 0, 0] });
  Object.values(db.answers).forEach(a => {
    const q = qById(a.qid), p = per[a.sid]; if (!q || !p) return; if (onlyRevealed && !revQ.has(a.qid)) return;
    p.answers++; if (a.ok !== null) { p.graded++; if (a.ok === true) p.correct++; }
    const pts = (a.pts || 0) + (a.bonus || 0); p.ind += pts; const st = stageOfStep(sc, a.qid); if (st) p.byStage[st.stage] += pts; if (a.ms) { p.ms += a.ms; p.msN++; }
  });
  db.students.forEach(s => { const pp = peerPoints(s.id, onlyRevealed); per[s.id].peer = pp; per[s.id].byStage[2] += pp; per[s.id].adj = (db.adjust[s.id] || []).reduce((x, y) => x + y.delta, 0); per[s.id].score = per[s.id].ind + pp + per[s.id].adj; });
  return per;
}
function teamPoints(onlyRevealed) { // багийн нийт оноо (нэг баг = нэг хариулт)
  const r = R(), sc = r.script || [], done = r.phase === 'done'; const tp = {}; for (let t = 1; t <= 4; t++) tp[t] = { byStage: [0, 0, 0, 0, 0], adj: (db.teamAdjust[t] || []).reduce((x, y) => x + y.delta, 0), items: [] };
  const sco = S().scoring;
  sc.forEach(st => {
    const shown = done || r.revealed[st.id]; if (!shown && onlyRevealed) return;
    for (let t = 1; t <= 4; t++) {
      let pts = 0;
      if (st.kind === 'q') { const mem = members(t); if (!shown) continue; const okN = mem.filter(m => (db.answers[akey(m.id, st.qid)] || {}).ok === true).length; if (mem.length && okN * 2 > mem.length) pts = sco.teamQ; }
      else if (st.kind === 'peer') { const T = ratingTruth(t); if (!shown) continue; pts = T === 'ok' ? sco.teamQ : T === 'partial' ? sco.teamPartial : 0; }
      else if (st.kind === 'duel' || st.kind === 'final') { const ta = db.tans[t + '|' + stepQid(st, t)]; if (shown && ta && ta.ok === true) pts = sco.teamQ; }
      tp[t].byStage[st.stage] += pts; if (pts) tp[t].items.push({ step: st.id, pts });
    }
  });
  return tp;
}
function teamStats(onlyRevealed) {
  const per = computeScores(onlyRevealed), tp = teamPoints(true), rows = [];
  for (let t = 1; t <= 4; t++) {
    const mem = members(t); let sum = 0, correct = 0, graded = 0, answers = 0, ms = 0, msN = 0; const bs = [0, 0, 0, 0, 0];
    mem.forEach(m => { const p = per[m.id]; sum += p.score; correct += p.correct; graded += p.graded; answers += p.answers; ms += p.ms; msN += p.msN; for (let k = 1; k <= 4; k++) bs[k] += p.byStage[k]; });
    const teamP = tp[t].byStage.reduce((x, y) => x + y, 0) + tp[t].adj; const avg = mem.length ? sum / mem.length : 0; const n = mem.length || 1;
    const stageVals = [0, 1, 2, 3, 4].map(k => k === 0 ? 0 : Math.round((S().scoreMode === 'sum' ? bs[k] : bs[k] / n) * 10) / 10 + tp[t].byStage[k]);
    const key = S().scoreMode === 'sum' ? sum : avg;
    rows.push({ team: t, name: teamName(t), mission: (S().teams[t - 1] || {}).mission || '', members: mem.length, sum, avg: Math.round(avg * 10) / 10, teamPts: teamP, score: Math.round((key + teamP) * 10) / 10, stages: stageVals, correct, graded, answers, accuracy: graded ? Math.round(correct / graded * 100) : 0, avgSec: msN ? Math.round(ms / msN / 1000) : 0 });
  }
  const sorted = [...rows].sort((a, b) => b.score - a.score || b.teamPts - a.teamPts); sorted.forEach((r, i) => r.rank = i + 1);
  for (let i = 1; i < sorted.length; i++) if (sorted[i].score === sorted[i - 1].score) sorted[i].rank = sorted[i - 1].rank;
  return rows;
}
// асуулт бүрийн анги даяарх тархалт (цаг дууссаны дараа)
function qDist(q) {
  const ans = Object.values(db.answers).filter(a => a.qid === q.id); const o = { total: db.students.length, answered: ans.length, correct: ans.filter(a => a.ok === true).length, wrong: ans.filter(a => a.ok === false).length, partial: ans.filter(a => a.ok === 'partial').length };
  if (q.options) { o.opts = q.options.map((t, i) => ({ i, text: t, n: ans.filter(a => q.type === 'mcq' ? a.ans.i === i : (a.ans.arr || []).includes(i)).length, correct: q.type === 'mcq' ? q.correct === i : (q.correct || []).includes(i) })); }
  if (q.type === 'tf') o.opts = [{ i: 1, text: 'Үнэн', n: ans.filter(a => a.ans.v === true).length, correct: q.correct === true }, { i: 0, text: 'Худал', n: ans.filter(a => a.ans.v === false).length, correct: q.correct === false }];
  return o;
}

/* ------------------------------ chat ------------------------------ */
function chatPush(team, msg) { const arr = db.chat[team] = db.chat[team] || []; arr.push(msg); if (arr.length > 300) arr.splice(0, arr.length - 300); }

/* ------------------------------ state views ------------------------------ */
function timerView() {
  const r = R(), st = curStep(), ph = phName();
  return { phase: r.phase, step: r.step, stepCount: (r.script || []).length, stepId: st ? st.id : null, stage: st ? st.stage : 0, kind: st ? st.kind : null, ph, phIndex: r.ph, phCount: st ? KINDS[st.kind].length : 0,
    endsAt: r.endsAt, paused: r.paused, left: remainingMs(), now: now(), locked: r.locked, totalSec: st ? phDur(st, ph) : 0 };
}
const scriptView = () => (R().script || []).map(st => ({ id: st.id, stage: st.stage, kind: st.kind, label: stepLabel(st), revealed: !!R().revealed[st.id] || R().phase === 'done' }));
const stagesView = () => S().stages.map(s => ({ id: s.id, icon: s.icon, name: s.name, title: s.title, desc: s.desc }));
const teamAnsView = (team, qid) => { const ta = db.tans[team + '|' + qid]; if (!ta) return null; const q = qById(qid); return { text: q && q.type === 'short' ? ta.ans.text : null, ans: ta.ans, desc: q ? describeAnswer(q, ta.ans) : '', by: ta.byName || '', locked: !!ta.locked, auto: !!ta.auto, ok: ta.ok === undefined ? null : ta.ok, t: ta.t }; };
function teamPicks(team, qid) { const q = qById(qid); return members(team).map(m => { const a = db.answers[akey(m.id, qid)]; return { name: m.name, answered: !!a, ans: a ? a.ans : null, desc: a && q ? describeAnswer(q, a.ans) : '' }; }); }
function curView(s) {
  const r = R(), st = curStep(), ph = phName(); if (!st) return null; const team = s.team;
  const base = { stepId: st.id, stage: st.stage, kind: st.kind, ph, qn: st.kind === 'q' ? stageQs(1).findIndex(x => x.id === st.qid) + 1 : 0, qTotal: stageQs(1).length };
  if (st.kind === 'q' || st.kind === 'duel' || st.kind === 'final') {
    const qid = stepQid(st, team), q = qById(qid); if (!q) return base;
    const teamPhase = ph === 'team' || (ph === 'rev' && st.kind !== 'q');
    base.q = publicQ(q, teamPhase && st.kind !== 'q' ? 'T' + team : s.id);
    if (st.kind === 'final') { base.area = st['area' + team] || team; base.areaName = S().areas[base.area] || ''; }
    const a = db.answers[akey(s.id, qid)]; base.answered = !!a; if (a) base.myAnswer = a.ans;
    if (st.kind !== 'q' && ph !== 'ind') { base.tans = teamAnsView(team, qid); }
    if (st.kind === 'duel' && ph !== 'ind') base.picks = teamPicks(team, qid);
    if (ph === 'rev') {
      base.reveal = revealQ(q); base.result = a ? { ok: a.ok, pts: (a.pts || 0) + (a.bonus || 0), why: a.why || '' } : { ok: false, pts: 0, none: true };
      base.dist = st.kind === 'q' ? qDist(q) : null;
      const mem = members(team); const okN = mem.filter(m => (db.answers[akey(m.id, qid)] || {}).ok === true).length;
      base.teamRes = { okN, of: mem.length, ok: st.kind === 'q' ? (mem.length > 0 && okN * 2 > mem.length) : !!(db.tans[team + '|' + qid] || {}).ok };
      if (st.kind !== 'q') base.tans = teamAnsView(team, qid);
    }
    if (ph === 'ind' || ph === 'team') { const mem = members(team); base.teamAnswered = mem.filter(m => db.answers[akey(m.id, qid)]).length; base.teamSize = mem.length; }
  } else if (st.kind === 'write') {
    const q = qById(st.qid); if (!q) return base; base.q = publicQ(q, s.id); base.tans = teamAnsView(team, st.qid);
  } else if (st.kind === 'peer') {
    const q = qById(st.qid); if (!q) return base; base.q = publicQ(q, s.id); const target = reviewTarget(team); base.target = { team: target, name: teamName(target), ans: teamAnsView(target, st.qid) };
    const v = db.pvotes[s.id + '|' + target]; base.myVote = v ? { vote: v.vote, why: v.why } : null; const mem = members(team); base.voted = mem.filter(m => db.pvotes[m.id + '|' + target]).length; base.teamSize = mem.length;
    base.myTeamAns = teamAnsView(team, st.qid);
    if (ph === 'rev') {
      base.reveal = revealQ(q); const T = ratingTruth(target); base.truth = T; base.myPts = peerPoints(s.id, false);
      const votesOnMine = members(reviewerOf(team)).map(m => (db.pvotes[m.id + '|' + team] || {}).vote).filter(Boolean); const c = { ok: 0, partial: 0, wrong: 0 }; votesOnMine.forEach(x => c[x]++);
      base.mine = { rating: ratingTruth(team), votes: c };
      base.keywords = null;
    }
  }
  return base;
}
function studentView(s) {
  const r = R(), tv = timerView(), per = computeScores(true), teams = teamStats(true), mine = per[s.id], myTeam = teams[s.team - 1];
  const out = { t: tv, script: scriptView(), stages: stagesView(),
    me: { id: s.id, name: s.name, team: s.team, teamName: teamName(s.team), mission: (S().teams[s.team - 1] || {}).mission || '', focus: (S().teams[s.team - 1] || {}).focus || '', score: mine.score, ind: mine.ind, peer: mine.peer, correct: mine.correct, answers: mine.answers },
    team: { rank: myTeam.rank, avg: myTeam.avg, sum: myTeam.sum, score: myTeam.score, teamPts: myTeam.teamPts, members: members(s.team).map(x => ({ id: x.id, name: x.name, online: online(x.id), me: x.id === s.id })) },
    cls: { name: S().className, topic: S().topic, mode: S().scoreMode }, scoring: S().scoring, chatOn: S().chatOn && !r.chatOff,
    chat: (db.chat[s.team] || []).slice(-80) };
  if (r.phase === 'lobby') { out.lobby = { joined: db.students.filter(x => online(x.id)).length, total: db.students.length, who: db.students.filter(x => online(x.id)).map(x => ({ name: x.name, me: x.id === s.id })) }; }
  if (r.phase === 'live') { out.cur = curView(s); if (tv.ph === 'rev' || r.revealed && Object.keys(r.revealed).length) out.board = teams.map(t => ({ team: t.team, name: t.name, score: t.score, rank: t.rank, stages: t.stages, members: t.members, teamPts: t.teamPts, avg: t.avg })); }
  if (r.phase === 'done') {
    out.board = teams.map(t => ({ team: t.team, name: t.name, score: t.score, rank: t.rank, stages: t.stages, members: t.members, teamPts: t.teamPts, avg: t.avg, accuracy: t.accuracy, avgSec: t.avgSec }));
    out.charts = chartData(s);
    out.all = r.script.filter(x => x.kind === 'q' || x.kind === 'duel' || x.kind === 'final').map(x => { const qid = stepQid(x, s.team); const q = qById(qid); const a = db.answers[akey(s.id, qid)]; return q ? { id: q.id, stage: x.stage, text: q.text, ok: a ? a.ok : false, pts: a ? (a.pts || 0) + (a.bonus || 0) : 0, none: !a } : null; }).filter(Boolean);
  }
  return out;
}
function chartData(s) { // цаг дууссаны дараах диаграммын өгөгдөл
  const r = R(); const qs = []; r.script.forEach(x => { if (x.kind === 'q') qs.push(qById(x.qid)); });
  const per = qs.filter(Boolean).map(q => { const d = qDist(q); return { id: q.id, text: q.text, concept: q.concept, dist: d }; });
  const concepts = {}; db.questions.forEach(q => { if (!q.stage || q.type === 'short') return; const key = q.concept || '—'; Object.values(db.answers).filter(a => a.qid === q.id && a.ok !== null).forEach(a => { const c = concepts[key] = concepts[key] || { ok: 0, n: 0 }; c.n++; if (a.ok === true) c.ok++; }); });
  return { perQ: per, concepts: Object.keys(concepts).map(k => ({ name: k, pct: Math.round(concepts[k].ok / concepts[k].n * 100), n: concepts[k].n })).sort((a, b) => a.pct - b.pct) };
}
function teacherView() {
  const r = R(), per = computeScores(false), teams = teamStats(false), st = curStep(), ph = phName();
  const stuRows = db.students.map(s => { const p = per[s.id]; return { id: s.id, name: s.name, team: s.team, pin: s.pin || '', online: online(s.id), score: p.score, ind: p.ind, peer: p.peer, correct: p.correct, answers: p.answers }; });
  const qstats = {}; const cnt = {};
  Object.values(db.answers).forEach(a => { const c = cnt[a.qid] = cnt[a.qid] || { answered: 0, correct: 0, wrong: 0, pending: 0, partial: 0 }; c.answered++; if (a.ok === true) c.correct++; else if (a.ok === false) c.wrong++; else if (a.ok === 'partial') c.partial++; else c.pending++; });
  db.questions.forEach(q => { qstats[q.id] = Object.assign({ answered: 0, correct: 0, wrong: 0, pending: 0, partial: 0 }, cnt[q.id] || {}, { expected: db.students.length }); });
  // одоогийн үе: хэн хариулсан
  let live = null;
  if (st) {
    live = { stepId: st.id, kind: st.kind, ph, teams: [] };
    for (let t = 1; t <= 4; t++) {
      const qid = stepQid(st, t); const q = qById(qid); const mem = members(t);
      const row = { team: t, qid, qtext: q ? q.text : '', members: mem.map(m => ({ id: m.id, name: m.name, online: online(m.id), answered: st.kind === 'peer' ? !!db.pvotes[m.id + '|' + reviewTarget(t)] : !!db.answers[akey(m.id, qid)] })) };
      if (st.kind === 'q') { const okN = mem.filter(m => (db.answers[akey(m.id, qid)] || {}).ok === true).length; row.okN = okN; row.of = mem.length; row.ok = mem.length > 0 && okN * 2 > mem.length; }
      if (st.kind !== 'q') row.tans = teamAnsView(t, qid);
      if (st.kind === 'peer') { row.target = reviewTarget(t); row.rating = ratingTruth(t); row.manual = db.ratings[t] || null; }
      if (st.kind === 'final') row.area = st['area' + t] || t;
      live.teams.push(row);
    }
  }
  const out = { t: timerView(), script: scriptView(), stages: stagesView(), settings: publicSettings(), students: stuRows, teams, questions: db.questions, qstats, feed: db.feed.slice(-60), present: db.present, live,
    onlineCount: stuRows.filter(x => x.online).length, total: stuRows.length, tunnel: TUN, siteUrl: SITE_URL, firstPw: !!S().pwInitial, join: joinInfo(), code: S().code, chat: db.chat, chatOff: !!r.chatOff, pics: listPics(), charts: chartData(null) };
  // 2-р шатны багийн хариултууд (үнэлгээ хийх)
  const w = r.script.find(x => x.kind === 'write') || (stageQs(2)[0] ? { qid: stageQs(2)[0].id } : null);
  if (w) { const q = qById(w.qid); out.writeAnswers = [1, 2, 3, 4].map(t => ({ team: t, ans: teamAnsView(t, w.qid), rating: ratingTruth(t), manual: db.ratings[t] || null, auto: q && db.tans[t + '|' + w.qid] ? autoRate(q, db.tans[t + '|' + w.qid].ans.text) : null })); out.writeQ = { id: q.id, text: q.text, model: q.explanation, keywords: q.keywords || null }; }
  return out;
}
function publicSettings() { const s = Object.assign({}, S()); delete s.teacherHash; delete s.teacherSalt; return s; }
function projectorView() {
  const r = R(), tv = timerView(); const out = { t: tv, cls: { name: S().className, topic: S().topic }, stages: stagesView(), script: scriptView(), scoring: S().scoring, present: null, board: null, cur: null, chart: null };
  const st = curStep(), ph = phName();
  if (st) {
    const q = qById(st.qid || (st.qids && st.qids[1])); out.cur = { stepId: st.id, stage: st.stage, kind: st.kind, ph, qn: st.kind === 'q' ? stageQs(1).findIndex(x => x.id === st.qid) + 1 : 0, qTotal: stageQs(1).length };
    if (st.kind === 'q' || st.kind === 'write' || st.kind === 'peer') { if (q) { out.cur.q = publicQ(q, 'projector'); canon(out.cur.q, q); const answered = Object.values(db.answers).filter(a => a.qid === q.id).length; out.cur.answered = st.kind === 'q' ? answered : null; if (ph === 'rev') { out.cur.reveal = revealQ(q); out.cur.dist = st.kind === 'q' ? qDist(q) : null; } } }
    else { out.cur.teamQs = [1, 2, 3, 4].map(t => { const qq = qById(stepQid(st, t)); if (!qq) return null; const pq = publicQ(qq, 'projector'); canon(pq, qq); return { team: t, name: teamName(t), q: pq, locked: !!(db.tans[t + '|' + qq.id] || {}).locked, reveal: ph === 'rev' ? revealQ(qq) : null, ok: ph === 'rev' ? !!(db.tans[t + '|' + qq.id] || {}).ok : null }; }); }
    if (st.kind === 'peer' && ph === 'rev') out.cur.ratings = [1, 2, 3, 4].map(t => ({ team: t, name: teamName(t), rating: ratingTruth(t) }));
    if (st.kind === 'write' || st.kind === 'peer') out.cur.teamsDone = [1, 2, 3, 4].map(t => !!db.tans[t + '|' + st.qid]);
  }
  const p = db.present || {};
  if (p.kind && p.kind !== 'board') {
    if (p.qid) { const q = qById(p.qid); if (q) { const pq = publicQ(q, 'projector'); canon(pq, q); out.present = { kind: p.kind, q: pq, reveal: ['a', 'e', 'd'].includes(p.kind) ? revealQ(q) : null, concept: q.concept }; } }
    else if (p.kind === 'text') out.present = { kind: 'text', text: p.text || '', title: p.title || '' };
  }
  if (p.kind === 'board' || r.phase === 'done' || (r.phase === 'live' && tv.ph === 'rev')) out.board = teamStats(true).map(t => ({ team: t.team, name: t.name, mission: t.mission, score: t.score, rank: t.rank, stages: t.stages, members: t.members, teamPts: t.teamPts, avg: t.avg, accuracy: t.accuracy }));
  if (r.phase === 'done') out.chart = chartData(null);
  out.mission = S().teams.map(t => ({ name: t.name, mission: t.mission }));
  out.join = Object.assign({ code: S().code }, joinInfo());
  out.lobby = { joined: db.students.filter(x => online(x.id)).length, total: db.students.length };
  return out;
}
function canon(pq, q) { if (pq.options) pq.options = q.options.map((t, i) => ({ i, text: t })); if (pq.items) pq.items = q.items.map((t, i) => ({ i, text: t })); if (pq.rights) pq.rights = q.pairs.map((x, i) => ({ i, text: x.r })); }

/* ------------------------------ web server ------------------------------ */
const PUB = path.join(__dirname, 'public');
const app = createApp({ publicDir: PUB, onError: (e, req, res) => { console.error('Алдаа:', e && e.message); if (!res.headersSent) { res.status(500); if (req.path.startsWith('/api')) res.json({ ok: false, err: 'Серверийн алдаа.' }); else res.send('Серверийн алдаа'); } } });
const srv = http.createServer(app.listener);
app.use((q, r, n) => { r.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'SAMEORIGIN', 'Referrer-Policy': 'same-origin', 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self' ws: wss:; frame-ancestors 'self'" }); n(); });
const baseUrl = req => SITE_URL || (req.protocol + '://' + req.get('host'));
function sendPage(file, extra) { return (req, res) => { let html = fs.readFileSync(path.join(PUB, file), 'utf8').replace(/__SITE_URL__/g, baseUrl(req)); res.set('Content-Type', 'text/html; charset=utf-8'); if (extra) res.set(extra); res.set('Cache-Control', 'no-store'); res.send(html); }; }
app.get('/', sendPage('index.html'));
app.get('/teacher', sendPage('teacher.html'));
app.get('/projector', sendPage('projector.html', { 'X-Robots-Tag': 'noindex, nofollow' }));
app.get('/robots.txt', (q, r) => r.type('text/plain').send('User-agent: *\nAllow: /$\nDisallow: /projector\nDisallow: /api/\nSitemap: ' + baseUrl(q) + '/sitemap.xml\n'));
app.get('/sitemap.xml', (q, r) => r.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>' + baseUrl(q) + '/</loc><changefreq>monthly</changefreq></url><url><loc>' + baseUrl(q) + '/teacher</loc><changefreq>monthly</changefreq></url></urlset>\n'));

const hits = new Map();
function limited(req, key, max, winMs) { const k = key + '|' + req.ip, t = now(); let h = hits.get(k); if (!h || t - h.t > winMs) h = { t, n: 0 }; h.n++; hits.set(k, h); return h.n > max; }
setInterval(() => { const t = now(); for (const [k, h] of hits) if (t - h.t > 3600000) hits.delete(k); }, 600000).unref();
const ERR = (res, code, msg) => res.status(code).json({ ok: false, err: msg });

/* ----- public: class code + names ----- */
app.get('/api/public', (q, r) => r.json({ className: S().className, topic: S().topic, subject: S().subject }));
const codeOk = c => clean(c, 40).toLowerCase() === String(S().code).toLowerCase();
app.post('/api/code', (req, res) => {
  if (limited(req, 'code', 40, 60000)) return ERR(res, 429, 'Хэт олон оролдлого. Түр хүлээгээд дахин оролдоно уу.');
  if (!codeOk(req.body && req.body.code)) return ERR(res, 403, 'Хичээлийн код буруу байна.');
  res.json({ ok: true, pin: !!S().pinEnabled, students: db.students.slice().sort((a, b) => a.name.localeCompare(b.name, 'mn')).map(s => ({ id: s.id, name: s.name, online: online(s.id) })) });
});
app.post('/api/student/login', (req, res) => {
  if (limited(req, 'slogin', 60, 60000)) return ERR(res, 429, 'Хэт олон оролдлого. Түр хүлээнэ үү.');
  const b = req.body || {}; if (!codeOk(b.code)) return ERR(res, 403, 'Хичээлийн код буруу байна.');
  const s = stu(clean(b.id, 20)); if (!s) return ERR(res, 404, 'Сурагч олдсонгүй.');
  if (S().pinEnabled && s.pin && clean(b.pin, 20) !== s.pin) return ERR(res, 403, 'PIN буруу байна.');
  const existing = Object.keys(db.tokens).find(t => db.tokens[t] === s.id);
  if (b.token && b.token === existing) { return res.json({ ok: true, token: existing, me: { id: s.id, name: s.name } }); }
  if (online(s.id) && !b.takeover) return res.json({ ok: false, need: 'takeover', err: 'Энэ нэр дээр одоогоор өөр төхөөрөмж холбогдсон байна.' });
  Object.keys(db.tokens).forEach(t => { if (db.tokens[t] === s.id) delete db.tokens[t]; });
  (socketsOf[s.id] ? Array.from(socketsOf[s.id]) : []).forEach(c => { try { c.send('denied', {}); setTimeout(() => c.close(), 50); } catch (e) {} });
  const token = rid(18); db.tokens[token] = s.id; feed('👋 ' + s.name + ' нэвтэрлээ', 'join'); save(); pushAll();
  res.json({ ok: true, token, me: { id: s.id, name: s.name } });
});
const stuAuth = (req, res, next) => { const t = req.get('x-token') || ''; const id = db.tokens[t]; const s = id && stu(id); if (!s) return ERR(res, 401, 'Нэвтрэх шаардлагатай.'); req.stu = s; next(); };
app.get('/api/state', stuAuth, (req, res) => res.json({ ok: true, state: studentView(req.stu) }));
function stuPhaseGuard(res, kinds, phs) { const r = R(), st = curStep(); if (r.phase === 'lobby') { ERR(res, 409, 'Сорилт хараахан эхлээгүй байна.'); return null; } if (r.phase !== 'live' || !st) { ERR(res, 409, 'Цаг дууссан.'); return null; }
  if (!kinds.includes(st.kind) || !phs.includes(phName())) { ERR(res, 409, 'Цаг дууссан.'); return null; }
  if (r.paused) { ERR(res, 409, 'Сорилт түр зогссон байна.'); return null; } if (r.locked) { ERR(res, 409, 'Багш хариултыг түгжсэн байна.'); return null; }
  if (now() > r.endsAt + 1200) { ERR(res, 409, 'Цаг дууссан.'); return null; } return st; }
app.post('/api/answer', stuAuth, (req, res) => { // хувийн хариулт (1-р шат, 3-р шатны эхний үе)
  const s = req.stu, b = req.body || {}, r = R();
  const q = qById(clean(b.qid, 10)); if (!q) return ERR(res, 404, 'Асуулт олдсонгүй.');
  const key = akey(s.id, q.id); if (db.answers[key]) return res.json({ ok: true, dup: true, msg: 'Та энэ асуултад аль хэдийн хариулсан байна.' });
  const st = stuPhaseGuard(res, ['q', 'duel'], ['ind']); if (!st) return;
  if (stepQid(st, s.team) !== q.id) return ERR(res, 404, 'Энэ асуулт одоо нээлттэй биш байна.');
  const ans = validateAnswer(q, b.answer); if (!ans || q.type === 'short') return ERR(res, 400, 'Хариултаа бүрэн бөглөнө үү.');
  const g = gradeAnswer(q, ans);
  db.answers[key] = { sid: s.id, qid: q.id, t: now(), ms: Math.max(0, now() - (r.phStart || now())), ans, why: clean(b.why, 700), ok: g.ok, pts: g.pts, bonus: 0 };
  feed(s.name + ' (' + teamName(s.team) + ') хариуллаа', 'ans'); save(); pushSoon(); res.json({ ok: true, msg: 'Хариулт бүртгэгдлээ.' });
});
app.post('/api/team/answer', stuAuth, (req, res) => { // багийн хариулт: 2-р шатны бичвэр, 3-р шатны эцсийн хариулт, 4-р шат
  const s = req.stu, b = req.body || {};
  const st = stuPhaseGuard(res, ['write', 'duel', 'final'], ['team']); if (!st) return;
  const qid = stepQid(st, s.team), q = qById(qid); if (!q || clean(b.qid, 10) !== qid) return ERR(res, 404, 'Энэ асуулт одоо нээлттэй биш байна.');
  const key = s.team + '|' + qid, old = db.tans[key]; if (old && old.locked) return res.json({ ok: true, dup: true, msg: 'Багийн хариулт аль хэдийн түгжигдсэн байна.' });
  const ans = validateAnswer(q, b.answer); if (!ans) return ERR(res, 400, 'Хариултаа бүрэн бөглөнө үү.');
  const lock = !!b.lock && st.kind !== 'write'; // бичвэрийг цаг дуусахад л түгжинэ
  const ta = { team: s.team, qid, ans, by: s.id, byName: s.name, t: now(), locked: lock };
  if (lock) { ta.ok = gradeAnswer(q, ans).ok; }
  db.tans[key] = ta; feed(s.name + ' (' + teamName(s.team) + ') багийн хариулт ' + (lock ? 'түгжлээ 🔒' : 'шинэчиллээ'), 'ans'); save(); pushSoon();
  res.json({ ok: true, msg: lock ? 'Багийн хариулт түгжигдлээ.' : 'Багийн хариулт хадгалагдлаа.' });
});
app.post('/api/peer', stuAuth, (req, res) => {
  const s = req.stu, b = req.body || {}; const st = stuPhaseGuard(res, ['peer'], ['peer']); if (!st) return;
  const target = reviewTarget(s.team); if (!db.tans[target + '|' + st.qid]) return ERR(res, 409, 'Шалгах хариулт ирээгүй байна.');
  const vote = clean(b.vote, 10); if (!['ok', 'partial', 'wrong'].includes(vote)) return ERR(res, 400, 'Үнэлгээгээ сонгоно уу.');
  db.pvotes[s.id + '|' + target] = { sid: s.id, target, vote, why: clean(b.why, 300), t: now() }; feed(s.name + ' (' + teamName(s.team) + ') үнэлгээ өглөө', 'ans'); save(); pushSoon(); res.json({ ok: true, msg: 'Үнэлгээ бүртгэгдлээ.' });
});
const lastChat = new Map();
function chatSend(team, from, name, text, teacher) {
  const msg = { id: rid(4), sid: from, name, text, t: now(), teacher: !!teacher }; chatPush(team, msg);
  (db.students.filter(x => x.team === team)).forEach(m => (socketsOf[m.id] || new Set()).forEach(c => c.send('chat', { team, msg })));
  rooms.teacher.forEach(c => c.send('chat', { team, msg })); save(); return msg;
}
app.post('/api/chat', stuAuth, (req, res) => {
  const s = req.stu; if (!S().chatOn || R().chatOff) return ERR(res, 409, 'Чат одоогоор хаалттай байна.');
  const text = clean((req.body || {}).text, 300); if (!text) return ERR(res, 400, 'Мессеж хоосон байна.');
  const t = now(), l = lastChat.get(s.id) || []; const recent = l.filter(x => t - x < 60000); if (recent.length >= 30 || (recent.length && t - recent[recent.length - 1] < 600)) return ERR(res, 429, 'Хэт хурдан бичиж байна.');
  recent.push(t); lastChat.set(s.id, recent); chatSend(s.team, s.id, s.name, text, false); res.json({ ok: true });
});

/* ----- teacher auth ----- */
function parseCookies(h) { const o = {}; String(h || '').split(';').forEach(p => { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim()); }); return o; }
function teacherSid(headers) { const sid = parseCookies(headers.cookie).tsid; const e = sid && db.tsess[sid]; if (e && e.exp > now()) return sid; return null; }
const tAuth = (req, res, next) => { if (!teacherSid(req.headers)) return ERR(res, 401, 'Багшийн нэвтрэлт шаардлагатай.'); next(); };
app.post('/api/teacher/login', (req, res) => {
  if (limited(req, 'tlogin', 8, 600000)) return ERR(res, 429, 'Хэт олон оролдлого. 10 минутын дараа дахин оролдоно уу.');
  const b = req.body || {}; const okUser = clean(b.username, 80).toLowerCase() === String(S().teacherUser).toLowerCase();
  const okPw = checkPw(String(b.password || '').slice(0, 200), S().teacherSalt, S().teacherHash);
  if (!okUser || !okPw) return ERR(res, 403, 'Нэвтрэх нэр эсвэл нууц үг буруу байна.');
  const sid = rid(24); db.tsess[sid] = { exp: now() + 12 * 3600 * 1000 };
  Object.keys(db.tsess).forEach(k => { if (db.tsess[k].exp < now()) delete db.tsess[k]; }); save();
  const secure = (req.get('x-forwarded-proto') || req.protocol) === 'https';
  res.set('Set-Cookie', 'tsid=' + sid + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200' + (secure ? '; Secure' : ''));
  res.json({ ok: true });
});
app.post('/api/teacher/logout', (req, res) => { const sid = teacherSid(req.headers); if (sid) { delete db.tsess[sid]; save(); } res.set('Set-Cookie', 'tsid=; Path=/; HttpOnly; Max-Age=0'); res.json({ ok: true }); });
app.get('/api/teacher/me', (req, res) => res.json({ ok: !!teacherSid(req.headers), user: S().teacherUser }));

/* ----- teacher: control ----- */
const T = app.router('/api/t', tAuth);
T.get('/state', (q, r) => r.json({ ok: true, state: teacherView() }));
T.post('/control', (req, res) => {
  const a = clean((req.body || {}).action, 20), r = R();
  if (a === 'start') { if (r.phase !== 'lobby') return ERR(res, 409, 'Сорилт аль хэдийн эхэлсэн. Эхлээд «Шинээр эхлүүлэх» дарна уу.'); backup('start'); if (!startRun()) return ERR(res, 400, 'Идэвхтэй асуулт олдсонгүй.'); }
  else if (a === 'pause') { if (r.phase === 'live' && r.endsAt && !r.paused) { r.pausedLeft = Math.max(0, r.endsAt - now()); r.paused = true; feed('⏸ Түр зогсоов', 'sys'); } }
  else if (a === 'resume') { if (r.paused) { r.paused = false; r.endsAt = now() + r.pausedLeft; feed('▶ Үргэлжилж байна', 'sys'); } }
  else if (a === 'next') { if (r.phase === 'live') advance(); else if (r.phase === 'lobby') { backup('start'); if (!startRun()) return ERR(res, 400, 'Идэвхтэй асуулт олдсонгүй.'); } else return ERR(res, 409, 'Сорилт дууссан байна.'); }
  else if (a === 'goto') { const i = +(req.body || {}).step; if (r.phase !== 'live') return ERR(res, 409, 'Сорилт явагдаагүй байна.'); if (!isInt(i, 0, r.script.length - 1)) return ERR(res, 400, 'Буруу алхам.'); endPhase(); r.step = i; r.ph = 0; enterPhase(); }
  else if (a === 'addtime') { const sec = +(req.body || {}).sec; if (!isInt(sec, -300, 600)) return ERR(res, 400, 'Буруу утга.'); if (r.phase === 'live') { if (r.paused) r.pausedLeft = Math.max(1000, r.pausedLeft + sec * 1000); else r.endsAt = Math.max(now() + 1000, r.endsAt + sec * 1000); feed('⏱ Хугацаа ' + (sec > 0 ? '+' : '') + sec + ' секунд', 'sys'); } }
  else if (a === 'lock') { r.locked = true; feed('🔒 Хариулт түгжигдлээ', 'sys'); } else if (a === 'unlock') { r.locked = false; feed('🔓 Түгжээ нээгдлээ', 'sys'); }
  else if (a === 'chatoff') { r.chatOff = true; feed('💬 Чат хаагдлаа', 'sys'); } else if (a === 'chaton') { r.chatOff = false; feed('💬 Чат нээгдлээ', 'sys'); }
  else if (a === 'end') { if (r.phase === 'lobby') return ERR(res, 409, 'Сорилт эхлээгүй байна.'); finish(); }
  else if (a === 'reset') { backup('before-reset'); db.answers = {}; db.tans = {}; db.pvotes = {}; db.ratings = {}; db.chat = { 1: [], 2: [], 3: [], 4: [] }; db.adjust = {}; db.teamAdjust = {}; db.feed = []; db.present = { kind: null }; db.run = { phase: 'lobby', step: 0, ph: 0, endsAt: null, paused: false, pausedLeft: 0, locked: false, revealed: {}, finalMap: {}, script: [], startedAt: null, finishedAt: null }; feed('♻ Сорилт шинээр бэлэн боллоо', 'sys'); }
  else return ERR(res, 400, 'Үл мэдэгдэх үйлдэл.');
  save(); pushAll(); res.json({ ok: true });
});
T.post('/rate', (req, res) => { const b = req.body || {}; const t = +b.team; if (!isInt(t, 1, 4)) return ERR(res, 400, 'Баг 1..4.'); const v = clean(b.rating, 10); if (v === '') delete db.ratings[t]; else if (['ok', 'partial', 'wrong'].includes(v)) db.ratings[t] = v; else return ERR(res, 400, 'Буруу үнэлгээ.'); feed('📝 ' + teamName(t) + ' багийн хариултын үнэлгээ: ' + (v || 'автомат'), 'sys'); save(); pushAll(); res.json({ ok: true }); });
T.post('/chat', (req, res) => { const b = req.body || {}; const text = clean(b.text, 300); if (!text) return ERR(res, 400, 'Мессеж хоосон байна.'); const t = +b.team; if (t === 0) { [1, 2, 3, 4].forEach(x => chatSend(x, null, 'Багш', text, true)); } else if (isInt(t, 1, 4)) chatSend(t, null, 'Багш', text, true); else return ERR(res, 400, 'Баг сонгоно уу.'); pushSoon(); res.json({ ok: true }); });
T.post('/chat/delete', (req, res) => { const b = req.body || {}; const t = +b.team; if (!isInt(t, 1, 4)) return ERR(res, 400, 'Баг 1..4.'); db.chat[t] = (db.chat[t] || []).filter(m => m.id !== clean(b.id, 10)); save(); pushAll(); res.json({ ok: true }); });
T.post('/present', (req, res) => { const b = req.body || {}; const kind = clean(b.kind, 10); if (!['q', 'a', 'e', 'd', 'text', 'board', 'clear'].includes(kind)) return ERR(res, 400, 'Буруу төрөл.'); db.present = kind === 'clear' ? { kind: null } : { kind, qid: clean(b.qid, 10), text: clean(b.text, 1200), title: clean(b.title, 200) }; save(); pushAll(); res.json({ ok: true }); });
T.post('/award', (req, res) => { const b = req.body || {}; const d = +b.delta; if (!isInt(d, -200, 200) || d === 0) return ERR(res, 400, 'Оноо -200..200 хооронд тоо байна.'); const reason = clean(b.reason, 100) || 'Багшийн тохируулга';
  if (b.sid) { const s = stu(clean(b.sid, 20)); if (!s) return ERR(res, 404, 'Сурагч олдсонгүй.'); (db.adjust[s.id] = db.adjust[s.id] || []).push({ delta: d, reason, t: now() }); feed('⭐ ' + s.name + ': ' + (d > 0 ? '+' : '') + d + ' (' + reason + ')', 'sys'); }
  else if (isInt(+b.team, 1, 4)) { (db.teamAdjust[+b.team] = db.teamAdjust[+b.team] || []).push({ delta: d, reason, t: now() }); feed('⭐ ' + teamName(+b.team) + ': ' + (d > 0 ? '+' : '') + d + ' (' + reason + ')', 'sys'); } else return ERR(res, 400, 'Сурагч эсвэл баг сонгоно уу.');
  save(); pushAll(); res.json({ ok: true }); });
T.get('/answers', (req, res) => {
  const q = qById(clean(req.query.qid, 10)); if (!q) return ERR(res, 404, 'Асуулт олдсонгүй.');
  const rows = db.students.map(s => { const a = db.answers[akey(s.id, q.id)]; return { sid: s.id, name: s.name, team: s.team, answered: !!a, text: a ? describeAnswer(q, a.ans) : '', why: a ? a.why : '', ok: a ? a.ok : null, pts: a ? a.pts : 0, bonus: a ? a.bonus : 0, sec: a ? Math.round(a.ms / 1000) : null }; });
  const tr = [1, 2, 3, 4].map(t => { const x = db.tans[t + '|' + q.id]; return x ? { team: t, text: describeAnswer(q, x.ans), by: x.byName, ok: x.ok === undefined ? null : x.ok, locked: !!x.locked, auto: !!x.auto } : null; }).filter(Boolean);
  res.json({ ok: true, q: { id: q.id, text: q.text, type: q.type, explanation: q.explanation, keywords: q.keywords || null }, rows, teamRows: tr, dist: qDist(q) });
});
T.post('/grade', (req, res) => { const b = req.body || {}; const a = db.answers[akey(clean(b.sid, 20), clean(b.qid, 10))]; if (!a) return ERR(res, 404, 'Хариулт олдсонгүй.');
  if (b.bonus !== undefined) { const p = +b.bonus; if (!isInt(p, 0, 20)) return ERR(res, 400, 'Бонус 0..20 хооронд байна.'); a.bonus = p; }
  save(); pushSoon(); res.json({ ok: true }); });
T.get('/images', (q, r) => r.json({ ok: true, pics: listPics() }));

/* ----- teacher: students & teams ----- */
function teamCounts() { const c = [0, 0, 0, 0]; db.students.forEach(s => { if (s.team >= 1 && s.team <= 4) c[s.team - 1]++; }); return c; }
T.post('/student', (req, res) => { const b = req.body || {}; const name = clean(b.name, 40);
  if (b.id) { const s = stu(clean(b.id, 20)); if (!s) return ERR(res, 404, 'Сурагч олдсонгүй.'); if (b.name !== undefined) { if (!name) return ERR(res, 400, 'Нэр хоосон байж болохгүй.'); s.name = name; } if (b.team !== undefined) { const t = +b.team; if (!isInt(t, 1, 4)) return ERR(res, 400, 'Баг 1..4.'); s.team = t; } if (b.pin !== undefined) s.pin = clean(b.pin, 12); }
  else { if (!name) return ERR(res, 400, 'Нэр оруулна уу.'); const c = teamCounts(); const t = c.indexOf(Math.min(...c)) + 1; db.students.push({ id: 's' + (Math.max(0, ...db.students.map(x => +x.id.slice(1) || 0)) + 1), name, team: isInt(+b.team, 1, 4) ? +b.team : t, pin: '' }); }
  save(); pushAll(); res.json({ ok: true }); });
T.post('/student/delete', (req, res) => { const id = clean((req.body || {}).id, 20); const s = stu(id); if (!s) return ERR(res, 404, 'Сурагч олдсонгүй.'); db.students = db.students.filter(x => x.id !== id); Object.keys(db.answers).forEach(k => { if (db.answers[k].sid === id) delete db.answers[k]; }); delete db.adjust[id]; Object.keys(db.tokens).forEach(t => { if (db.tokens[t] === id) delete db.tokens[t]; }); save(); pushAll(); res.json({ ok: true }); });
T.post('/student/kick', (req, res) => { const id = clean((req.body || {}).id, 20); Object.keys(db.tokens).forEach(t => { if (db.tokens[t] === id) delete db.tokens[t]; }); (socketsOf[id] || new Set()).forEach(c => c.close()); save(); pushAll(); res.json({ ok: true }); });
T.post('/teams/shuffle', (req, res) => { const sizes = [7, 7, 6, 6]; const n = db.students.length; const base = Math.floor(n / 4), extra = n % 4; const sz = n === 26 ? sizes : [0, 1, 2, 3].map(i => base + (i < extra ? 1 : 0)); const ids = db.students.map(s => s); for (let i = ids.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; } let k = 0; sz.forEach((c, t) => { for (let i = 0; i < c && k < ids.length; i++) ids[k++].team = t + 1; }); feed('🔀 Багууд санамсаргүй дахин хуваарилагдлаа', 'sys'); save(); pushAll(); res.json({ ok: true }); });

/* ----- teacher: questions ----- */
function normQuestion(b, old) {
  const q = { id: old ? old.id : '', order: old ? old.order : 0, active: b.active !== false };
  q.stage = +b.stage; if (!isInt(q.stage, 0, 4)) return 'Шат 0..4 байна.'; q.slot = +(b.slot || 0); if (!isInt(q.slot, 0, 12)) return 'Дугаар 0..12 байна.'; q.area = +(b.area || 0); if (!isInt(q.area, 0, 4)) return 'Сэдвийн бүлэг 0..4 байна.';
  if (b.image) { const im = clean(b.image, 80); if (!/^[\w.-]+\.(png|jpe?g|webp|svg|gif)$/i.test(im) || !listPics().includes(im)) return 'Зураг олдсонгүй.'; q.image = im; }
  q.team = +b.team; if (!isInt(q.team, 0, 4)) return 'Баг 0..4 байна.';
  q.type = clean(b.type, 10); if (!TYPES.includes(q.type)) return 'Асуултын төрөл буруу.';
  q.text = clean(b.text, 1500); if (!q.text) return 'Асуултын текст хоосон байна.';
  q.difficulty = +b.difficulty; if (!isInt(q.difficulty, 1, 3)) return 'Түвшин 1..3.';
  q.concept = clean(b.concept, 80); q.explanation = clean(b.explanation, 1500); q.misconception = clean(b.misconception, 800); q.discussion = clean(b.discussion, 800);
  q.askWhy = !!b.askWhy; q.askJustify = !!b.askJustify;
  const arr = (x, max) => (Array.isArray(x) ? x : []).map(v => clean(v, max)).filter(Boolean);
  if (q.type === 'mcq') { q.options = arr(b.options, 400); if (q.options.length < 2 || q.options.length > 8) return 'Сонголт 2..8 байна.'; q.correct = +b.correct; if (!isInt(q.correct, 0, q.options.length - 1)) return 'Зөв хариултыг сонго.'; }
  if (q.type === 'multi') { q.options = arr(b.options, 400); if (q.options.length < 2 || q.options.length > 8) return 'Сонголт 2..8 байна.'; q.correct = (Array.isArray(b.correct) ? b.correct : []).map(Number); if (!q.correct.length || !q.correct.every(v => isInt(v, 0, q.options.length - 1)) || new Set(q.correct).size !== q.correct.length) return 'Зөв хариултуудыг сонго.'; }
  if (q.type === 'tf') { if (typeof b.correct !== 'boolean') return 'Үнэн/Худал сонго.'; q.correct = b.correct; }
  if (q.type === 'order') { q.items = arr(b.items, 300); if (q.items.length < 2 || q.items.length > 8) return 'Дараалал 2..8 зүйлтэй байна.'; }
  if (q.type === 'match') { q.pairs = (Array.isArray(b.pairs) ? b.pairs : []).map(p => ({ l: clean(p && p.l, 200), r: clean(p && p.r, 300) })).filter(p => p.l && p.r); if (q.pairs.length < 2 || q.pairs.length > 8) return 'Таарууллын хос 2..8 байна.'; }
  if (q.type === 'short') { q.keywords = (Array.isArray(b.keywords) ? b.keywords : []).map(g => arr(g, 40)).filter(g => g.length); }
  if (b.graph) { const g = b.graph; if (!g || !Array.isArray(g.series) || !g.series.length || g.series.length > 4 || !g.series.every(s => Array.isArray(s.points) && s.points.length >= 2 && s.points.length <= 40 && s.points.every(p => Array.isArray(p) && p.length === 2 && isFinite(p[0]) && isFinite(p[1])))) return 'Графикийн JSON буруу.'; q.graph = { title: clean(g.title, 120), xlabel: clean(g.xlabel, 80), ylabel: clean(g.ylabel, 80), series: g.series.map(s => ({ name: clean(s.name, 60), points: s.points.map(p => [+p[0], +p[1]]) })) }; }
  return q;
}
function renumber() { db.questions.forEach((q, i) => q.order = i + 1); }
T.post('/question', (req, res) => { const b = req.body || {}; const old = b.id ? qById(clean(b.id, 10)) : null; if (b.id && !old) return ERR(res, 404, 'Асуулт олдсонгүй.');
  const q = normQuestion(b, old); if (typeof q === 'string') return ERR(res, 400, q);
  if (old) { Object.keys(old).forEach(k => delete old[k]); Object.assign(old, q); } else { const n = Math.max(0, ...db.questions.map(x => +x.id.slice(1) || 0)) + 1; q.id = 'Q' + String(n).padStart(2, '0'); q.order = db.questions.length + 1; db.questions.push(q); }
  save(); pushAll(); res.json({ ok: true, id: (old || q).id }); });
T.post('/question/delete', (req, res) => { const id = clean((req.body || {}).id, 10); if (!qById(id)) return ERR(res, 404, 'Асуулт олдсонгүй.'); db.questions = db.questions.filter(q => q.id !== id); Object.keys(db.answers).forEach(k => { if (db.answers[k].qid === id) delete db.answers[k]; }); renumber(); save(); pushAll(); res.json({ ok: true }); });
T.post('/question/duplicate', (req, res) => { const o = qById(clean((req.body || {}).id, 10)); if (!o) return ERR(res, 404, 'Асуулт олдсонгүй.'); const c = JSON.parse(JSON.stringify(o)); const n = Math.max(0, ...db.questions.map(x => +x.id.slice(1) || 0)) + 1; c.id = 'Q' + String(n).padStart(2, '0'); c.text += ' (хуулбар)'; const i = db.questions.indexOf(o); db.questions.splice(i + 1, 0, c); renumber(); save(); pushAll(); res.json({ ok: true, id: c.id }); });
T.post('/question/move', (req, res) => { const b = req.body || {}; const q = qById(clean(b.id, 10)); if (!q) return ERR(res, 404, 'Асуулт олдсонгүй.'); const i = db.questions.indexOf(q), j = i + (+b.dir < 0 ? -1 : 1); if (j < 0 || j >= db.questions.length) return res.json({ ok: true }); [db.questions[i], db.questions[j]] = [db.questions[j], db.questions[i]]; renumber(); save(); pushAll(); res.json({ ok: true }); });
T.post('/question/toggle', (req, res) => { const q = qById(clean((req.body || {}).id, 10)); if (!q) return ERR(res, 404, 'Асуулт олдсонгүй.'); q.active = !q.active; save(); pushAll(); res.json({ ok: true }); });
T.post('/question/regrade', (req, res) => { const q = qById(clean((req.body || {}).id, 10)); if (!q) return ERR(res, 404, 'Асуулт олдсонгүй.'); let n = 0; Object.values(db.answers).forEach(a => { if (a.qid === q.id && q.type !== 'short') { const v = validateAnswer(q, a.ans); if (v) { const g = gradeAnswer(q, v); a.ok = g.ok; a.pts = g.pts; n++; } } }); save(); pushAll(); res.json({ ok: true, n }); });

/* ----- teacher: settings, password, backup ----- */
T.post('/settings', (req, res) => { const b = req.body || {}; const s = S();
  if (b.className !== undefined) { const v = clean(b.className, 40); if (!v) return ERR(res, 400, 'Ангийн нэр хоосон.'); s.className = v; }
  if (b.topic !== undefined) s.topic = clean(b.topic, 60) || s.topic; if (b.subject !== undefined) s.subject = clean(b.subject, 60) || s.subject;
  if (b.code !== undefined) { const v = clean(b.code, 30); if (v.length < 4) return ERR(res, 400, 'Код хамгийн багадаа 4 тэмдэгт.'); s.code = v; }
  if (b.teacherUser !== undefined) { const v = clean(b.teacherUser, 60); if (v.length < 3) return ERR(res, 400, 'Нэвтрэх нэр хамгийн багадаа 3 тэмдэгт.'); s.teacherUser = v; }
  if (b.pinEnabled !== undefined) s.pinEnabled = !!b.pinEnabled; if (b.autoAdvance !== undefined) s.autoAdvance = !!b.autoAdvance;
  if (b.scoreMode !== undefined) s.scoreMode = b.scoreMode === 'sum' ? 'sum' : 'avg';
  if (b.chatOn !== undefined) s.chatOn = !!b.chatOn;
  if (b.scoring && typeof b.scoring === 'object') { for (const k of Object.keys(s.scoring)) if (b.scoring[k] !== undefined) { const v = +b.scoring[k]; if (!isInt(v, 0, 100)) return ERR(res, 400, 'Оноо 0..100 байна.'); s.scoring[k] = v; } }
  if (b.timing && typeof b.timing === 'object') { for (const k of Object.keys(s.timing)) for (const p of Object.keys(s.timing[k])) if (b.timing[k] && b.timing[k][p] !== undefined) { const v = +b.timing[k][p]; if (!isInt(v, 5, 900)) return ERR(res, 400, 'Хугацаа 5..900 секунд байна.'); s.timing[k][p] = v; } }
  if (Array.isArray(b.teams)) b.teams.forEach((t, i) => { if (s.teams[i]) { if (t.name !== undefined) s.teams[i].name = clean(t.name, 40) || s.teams[i].name; if (t.mission !== undefined) s.teams[i].mission = clean(t.mission, 80); if (t.focus !== undefined) s.teams[i].focus = clean(t.focus, 300); } });
  if (Array.isArray(b.discussion)) { s.discussion = b.discussion.slice(0, 8).map(d => ({ min: clean(d.min, 20), title: clean(d.title, 100), prompts: (Array.isArray(d.prompts) ? d.prompts : []).map(p => clean(p, 300)).filter(Boolean).slice(0, 10) })); }
  save(); pushAll(); res.json({ ok: true }); });
T.post('/password', (req, res) => { if (limited(req, 'pw', 10, 600000)) return ERR(res, 429, 'Хэт олон оролдлого.'); const b = req.body || {};
  if (!checkPw(String(b.current || ''), S().teacherSalt, S().teacherHash)) return ERR(res, 403, 'Одоогийн нууц үг буруу байна.');
  const n = String(b.next || ''); if (n.length < 8 || n.length > 100) return ERR(res, 400, 'Шинэ нууц үг хамгийн багадаа 8 тэмдэгт байна.'); if (n !== String(b.confirm || '')) return ERR(res, 400, 'Шинэ нууц үг давтахтай таарахгүй байна.');
  S().teacherSalt = rid(16); S().teacherHash = hashPw(n, S().teacherSalt); S().pwInitial = false; const keep = teacherSid(req.headers); Object.keys(db.tsess).forEach(k => { if (k !== keep) delete db.tsess[k]; });
  try { fs.unlinkSync(path.join(DATA_DIR, 'FIRST-PASSWORD.txt')); } catch (e) {} save(true); res.json({ ok: true }); });
T.get('/backup.json', (req, res) => { res.set({ 'Content-Type': 'application/json; charset=utf-8', 'Content-Disposition': 'attachment; filename="enzyme-10D-backup-' + new Date().toISOString().slice(0, 10) + '.json"' }); const copy = JSON.parse(JSON.stringify(db)); copy.tokens = {}; copy.tsess = {}; res.send(JSON.stringify(copy)); });
T.post('/restore', (req, res) => { const d = req.body && req.body.data; if (!d || !d.settings || !Array.isArray(d.students) || !Array.isArray(d.questions) || !d.run || d.v !== 3) return ERR(res, 400, 'Нөөц файл буруу эсвэл хуучин хувилбарынх байна.'); backup('before-restore'); const keepPw = { h: S().teacherHash, s: S().teacherSalt, i: S().pwInitial }; const sess = db.tsess; db = d; db.settings.teacherHash = d.settings.teacherHash || keepPw.h; db.settings.teacherSalt = d.settings.teacherSalt || keepPw.s; db.settings.pwInitial = keepPw.i === undefined ? false : keepPw.i; db.tokens = {}; db.tsess = sess; ['answers', 'tans', 'pvotes', 'ratings', 'adjust', 'teamAdjust'].forEach(k => db[k] = db[k] || {}); db.chat = db.chat || {}; [1, 2, 3, 4].forEach(t => db.chat[t] = db.chat[t] || []); db.feed = db.feed || []; db.present = db.present || { kind: null }; db.run.revealed = db.run.revealed || {}; db.run.finalMap = db.run.finalMap || {}; db.run.script = db.run.script || []; save(true); pushAll(); res.json({ ok: true }); });

/* ----- teacher: export ----- */
const csvCell = v => { v = String(v == null ? '' : v); return /[",\n\r;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
T.get('/export.csv', (req, res) => {
  const per = computeScores(false), sc = R().script && R().script.length ? R().script : buildScript(), rows = [];
  const iq = []; sc.forEach(st => { if (st.kind === 'q') iq.push({ st, label: 'Ш1 ' + st.qid, qid: st.qid }); });
  rows.push(['Сурагч', 'Баг', 'Нийт оноо', 'Хувийн оноо', 'Peer Check оноо', 'Тохируулга', 'Зөв', 'Хариулсан', ...iq.map(x => x.label), 'Ш3 хувийн']);
  db.students.slice().sort((a, b) => a.team - b.team || a.name.localeCompare(b.name, 'mn')).forEach(s => { const p = per[s.id]; const d = sc.find(x => x.kind === 'duel'); const da = d ? db.answers[akey(s.id, stepQid(d, s.team))] : null;
    rows.push([s.name, teamName(s.team), p.score, p.ind, p.peer, p.adj, p.correct, p.answers, ...iq.map(x => { const a = db.answers[akey(s.id, x.qid)]; return a ? (a.pts || 0) + (a.bonus || 0) : ''; }), da ? (da.pts || 0) : '']); });
  rows.push([]); rows.push(['БАГИЙН ДҮН']); rows.push(['Байр', 'Баг', 'Гишүүд', 'Нийт оноо', 'Дундаж хувийн оноо', 'Багийн оноо', 'Ш1', 'Ш2', 'Ш3', 'Ш4', 'Нарийвчлал %', 'Дундаж хариулах хугацаа (сек)']);
  teamStats(false).sort((a, b) => a.rank - b.rank).forEach(t => rows.push([t.rank, t.name, t.members, t.score, t.avg, t.teamPts, t.stages[1], t.stages[2], t.stages[3], t.stages[4], t.accuracy, t.avgSec]));
  rows.push([]); rows.push(['БАГИЙН ХАРИУЛТУУД']); rows.push(['Баг', 'Асуулт', 'Хариулт', 'Хэн', 'Үнэлгээ']);
  Object.values(db.tans).forEach(x => { const q = qById(x.qid); rows.push([teamName(x.team), x.qid, q ? describeAnswer(q, x.ans) : '', x.byName || '', x.ok === true ? 'зөв' : x.ok === false ? 'буруу' : (db.ratings[x.team] || '')]); });
  res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="enzyme-10D-results.csv"' });
  res.send('﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n'));
});


/* ------------------------------ realtime (WebSocket) ------------------------------ */
const rooms = { teacher: new Set(), projector: new Set() };
function wsAuth(c) {
  const q = c.req.query || {};
  if (q.role === 'student') { const id = db.tokens[q.token]; const s = id && stu(id); return s ? { role: 'student', id: s.id } : null; }
  if (q.role === 'teacher' || q.role === 'projector') return teacherSid(c.req.headers) ? { role: q.role } : null;
  return null;
}
app.attachWS(srv, c => {
  const d = wsAuth(c); if (!d) { c.send('denied', {}); setTimeout(() => c.close(), 50); return; }
  c.data = d;
  if (d.role === 'student') {
    const set = socketsOf[d.id] = socketsOf[d.id] || new Set(); const was = set.size > 0; set.add(c);
    const s = stu(d.id); if (s && !was) feed('🟢 ' + s.name + ' холбогдлоо', 'join'); pushSoon();
    c.onclose = () => { set.delete(c); if (!set.size) { const s2 = stu(d.id); if (s2) feed('⚪ ' + s2.name + ' салгагдлаа', 'join'); } pushSoon(); };
  } else if (d.role === 'teacher') { rooms.teacher.add(c); c.send('tstate', teacherView()); c.onclose = () => rooms.teacher.delete(c); }
  else { rooms.projector.add(c); c.send('pstate', projectorView()); c.onclose = () => rooms.projector.delete(c); }
});
let pushT = null;
function pushSoon() { if (pushT) return; pushT = setTimeout(() => { pushT = null; pushAll(); }, 150); }
function pushAll() {
  if (pushT) { clearTimeout(pushT); pushT = null; }
  if (rooms.teacher.size) { const v = teacherView(); rooms.teacher.forEach(c => c.send('tstate', v)); }
  if (rooms.projector.size) { const v = projectorView(); rooms.projector.forEach(c => c.send('pstate', v)); }
  for (const id of Object.keys(socketsOf)) { const set = socketsOf[id]; if (!set.size) continue; const s = stu(id); if (!s) continue; const v = studentView(s); set.forEach(c => c.send('state', v)); }
}
setInterval(() => { try { if (tick()) pushAll(); } catch (e) { console.error(e); } }, 400);
setInterval(() => { try { pushAll(); } catch (e) {} }, 5000); // нэмэлт sync (цаг, online)

/* ------------------------------ tunnel (түр хугацааны public URL) ------------------------------ */
const TUN = { status: 'off', url: '', qr: '', msg: '' };
function lanUrl() { try { const ifs = require('os').networkInterfaces(); for (const k of Object.keys(ifs)) for (const i of ifs[k] || []) if (i.family === 'IPv4' && !i.internal && /^(192\.168|10\.|172\.(1[6-9]|2\d|3[01]))\./.test(i.address)) return 'http://' + i.address + ':' + PORT; } catch (e) {} return ''; }
const LAN = { url: lanUrl(), qr: '' }; try { if (LAN.url) LAN.qr = qrDataUrl(LAN.url); } catch (e) {}
const qrCache = {}; const qrFor = u => { try { return qrCache[u] || (qrCache[u] = qrDataUrl(u)); } catch (e) { return ''; } };
const withCode = u => u + (u.includes('?') ? '&' : '?') + 'c=' + encodeURIComponent(S().code);
const joinInfo = () => { const pub = SITE_URL || TUN.url || LAN.url; if (!pub) return { url: '', qr: '', kind: 'none' }; return { url: pub, qr: qrFor(withCode(pub)), kind: SITE_URL ? 'site' : TUN.url ? 'tunnel' : 'lan' }; };
function banner() {
  const pub = SITE_URL || TUN.url;
  console.log('\n🧬 ENZYME — ' + S().className + ' бодит цагийн сорилт\n');
  console.log('Багшийн хаяг (энэ компьютер):  http://localhost:' + PORT + '/teacher');
  console.log('Нэвтрэх нэр:                   ' + S().teacherUser);
  if (global.__firstPw) console.log('Анхны нууц үг:                 ' + global.__firstPw + '   (нэвтэрсний дараа Тохиргоо хэсэгт заавал соль)');
  else if (S().pwInitial) { try { console.log('Анхны нууц үг: ' + fs.readFileSync(path.join(DATA_DIR, 'FIRST-PASSWORD.txt'), 'utf8').split(':')[1].split('\n')[0].trim() + '  (data/FIRST-PASSWORD.txt)'); } catch (e) {} }
  console.log('Хичээлийн код:                 ' + S().code);
  console.log('Сурагчдад өгөх хаяг:           ' + (pub || LAN.url || '(нэг WiFi дээр байх шаардлагатай)'));
  console.log('Проектор:                      http://localhost:' + PORT + '/projector');
  console.log('\nХичээл дуустал энэ цонхыг хаахгүй байна уу.\n');
}
function tunnel(cmds) {
  const c = cmds[0]; if (!c) { TUN.status = 'fail'; TUN.msg = ''; console.log('ℹ️  cloudflared олдсонгүй: интернэт хаяг үүсгэхгүй. (Нэг WiFi дээр localhost/IP хаягаар ажиллана. Хүсвэл: brew install cloudflared)'); return pushAll(); }
  let done = false, got = false, buf = ''; const nx = () => { if (done) return; done = true; tunnel(cmds.slice(1)); }; let p;
  try { p = spawn(c[0], c.slice(1)); } catch (e) { return nx(); }
  const on = d => { buf = (buf + d).slice(-4000); const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(buf); if (m && !got) { got = true; TUN.url = m[0]; TUN.status = 'ok'; try { TUN.qr = qrDataUrl(TUN.url); } catch (e) {} pushAll(); banner(); } };
  p.stdout.on('data', on); p.stderr.on('data', on); p.on('error', nx);
  p.on('exit', () => { if (got) { TUN.status = 'down'; TUN.msg = 'Түр холболт тасарлаа.'; console.log('🔴 Tunnel тасарлаа. Серверийг дахин асаахад шинэ хаяг, QR гарна.'); pushAll(); } else nx(); });
}
process.on('SIGINT', () => { save(true); process.exit(0); }); process.on('SIGTERM', () => { save(true); process.exit(0); });
process.on('uncaughtException', e => console.error('Алдаа:', e)); process.on('unhandledRejection', e => console.error('Алдаа:', e));
srv.listen(PORT, () => {
  banner();
  if (SITE_URL) { TUN.url = SITE_URL; try { TUN.qr = qrDataUrl(SITE_URL); } catch (e) {} TUN.status = 'ok'; }
  else if (!process.env.NO_TUNNEL) tunnel([['cloudflared', 'tunnel', '--url', 'http://localhost:' + PORT]]);
});
module.exports = { srv };
