// ENZYME 10D — автомат шалгалт (4 шатны загвар). Ажиллуулах: node test/qa.js
const { spawn } = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const PORT = 3791, B = 'http://localhost:' + PORT, D = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-'));
const p = spawn('node', [path.join(__dirname, '..', 'server.js')], { env: { ...process.env, PORT, DATA_DIR: D, NO_TUNNEL: '1', TEACHER_PASSWORD: 'Test12345' }, stdio: ['ignore', 'ignore', 'inherit'] });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0; const ok = (c, m) => { if (c) pass++; else { fail++; console.log('✗', m); } };
async function req(m, u, b, o = {}) { const h = { 'Content-Type': 'application/json' }; if (o.token) h['x-token'] = o.token; if (o.cookie) h.cookie = o.cookie; const r = await fetch(B + u, { method: m, headers: h, body: b === undefined ? undefined : JSON.stringify(b) }); let j = null; try { j = await r.json(); } catch (e) {} return Object.assign({ _s: r.status }, j || {}); }
(async () => {
  await sleep(2500);
  // нийтийн хуудас, SEO, CSP
  let r = await fetch(B + '/'); const html = await r.text(); ok(r.status === 200 && /<title>/.test(html), 'нүүр хуудас');
  ok((r.headers.get('content-security-policy') || '').includes('fonts.googleapis.com'), 'CSP фонт');
  ok((await (await fetch(B + '/robots.txt')).text()).includes('Disallow: /projector'), 'robots');
  ok((await (await fetch(B + '/sitemap.xml')).text()).includes('<urlset'), 'sitemap');
  ok(!/Terminal|npm|tunnel|cloudflared/i.test(html + fs.readFileSync(path.join(__dirname, '..', 'public', 'student.js'), 'utf8').replace(/\/\/.*$/gm, '')), 'сурагчийн UI-д техникийн үг байхгүй');
  // хамгаалагдсан зам
  ok((await req('GET', '/api/t/state'))._s === 401, 'багшийн зам хамгаалагдсан');
  ok((await req('GET', '/api/state'))._s === 401, 'сурагчийн state хамгаалагдсан');
  ok((await req('POST', '/api/code', { code: 'буруу' }))._s === 403, 'буруу код');
  const lr = await fetch(B + '/api/teacher/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'AmarjargalBuyanbaatar', password: 'Test12345' }) });
  const cookie = (lr.headers.get('set-cookie') || '').split(';')[0]; ok(!!cookie, 'багш нэвтэрсэн');
  const T = (u, b) => b === undefined ? req('GET', u, undefined, { cookie }) : req('POST', u, b, { cookie });
  let st = (await T('/api/t/state')).state;
  ok(st.teams.map(t => t.members.length || t.members).join() === '7,7,6,6' || st.teams.length === 4, '4 баг');
    ok(st.join && 'url' in st.join && st.code === '10D2026ENZYM', 'нэгдэх мэдээлэл');
  const c = await req('POST', '/api/code', { code: '10D2026ENZYM' }); ok(c.students.length === 26, '26 сурагч');
  const S = []; for (const s of c.students) { const l = await req('POST', '/api/student/login', { code: '10D2026ENZYM', id: s.id }); S.push({ id: s.id, token: l.token }); }
  ok(S.every(s => s.token), 'бүгд нэвтэрсэн');
  st = (await T('/api/t/state')).state; const teamOf = {}; st.students.forEach(s => teamOf[s.id] = s.team);
  const cnt = [1, 2, 3, 4].map(t => S.filter(s => teamOf[s.id] === t).length); ok(cnt.join() === '7,7,6,6', 'баг 7/7/6/6: ' + cnt);
  ok((await req('POST', '/api/answer', { qid: 'Q22', answer: { arr: [0] } }, { token: S[0].token }))._s === 409, 'эхлэхээс өмнө хариулах боломжгүй');
  // чат хувийн байдал
  const m1 = S.find(s => teamOf[s.id] === 1), m2 = S.find(s => teamOf[s.id] === 2);
  ok((await req('POST', '/api/chat', { text: 'сайн уу' }, { token: m1.token })).ok, 'чат илгээсэн');
  const s1 = (await req('GET', '/api/state', undefined, { token: m1.token })).state, s2 = (await req('GET', '/api/state', undefined, { token: m2.token })).state;
  const chatOf = x => JSON.stringify(x.chat || []);
  ok(chatOf(s1).includes('сайн уу') && !chatOf(s2).includes('сайн уу'), 'чат зөвхөн өөрийн багт харагдана');
  ok(JSON.stringify((await T('/api/t/state')).state.chat || {}).includes('сайн уу'), 'багш бүх багийн чатыг харна');
  ok((await T('/api/t/control', { action: 'start' })).ok, 'эхлүүлсэн');
  ok((await T('/api/t/state')).state.script.length >= 10, 'script байгуулагдсан');
  for (let i = 0; i < 60; i++) {
    st = (await T('/api/t/state')).state; const t = st.t; if (t.phase === 'done') break;
    if (t.ph === 'ind') for (let k = 0; k < S.length; k++) {
      const sv = (await req('GET', '/api/state', undefined, { token: S[k].token })).state; const q = sv.cur.q; const Q = st.questions.find(x => x.id === q.id); let a;
      if (Q.type === 'mcq') a = { i: k % 2 ? (Q.correct + 1) % Q.options.length : Q.correct }; else if (Q.type === 'multi') a = { arr: Q.correct }; else if (Q.type === 'tf') a = { v: Q.correct }; else if (Q.type === 'order') a = { arr: [...Array(Q.items.length).keys()] }; else if (Q.type === 'match') a = { arr: [...Array(Q.pairs.length).keys()] }; else a = { text: 'идэвхит төв субстрат комплекс' };
      const rr = await req('POST', '/api/answer', { qid: q.id, answer: a }, { token: S[k].token }); if (k === 0 && !rr.ok) ok(false, 'хувийн хариулт ' + (rr.err || ''));
    }
    if (t.ph === 'team') for (let team = 1; team <= 4; team++) {
      const m = S.find(x => teamOf[x.id] === team); const sv = (await req('GET', '/api/state', undefined, { token: m.token })).state; const q = sv.cur.q; const Q = st.questions.find(x => x.id === q.id); let a;
      if (Q.type === 'short') a = { text: 'Идэвхит төвийн хэлбэр тохирох тул өвөрмөц, субстрат хэлбэр холбогдож комплекс' }; else if (Q.type === 'mcq') a = { i: Q.correct }; else if (Q.type === 'multi') a = { arr: Q.correct }; else if (Q.type === 'tf') a = { v: Q.correct }; else a = { arr: Q.correct || [] };
      const rr = await req('POST', '/api/team/answer', { qid: q.id, answer: a, lock: Q.type !== 'short' }, { token: m.token }); if (!rr.ok && team === 1) ok(false, 'багийн хариулт: ' + rr.err);
    }
    if (t.ph === 'peer') {
      const own = S.find(x => teamOf[x.id] === 1); const sv = (await req('GET', '/api/state', undefined, { token: own.token })).state;
      for (let k = 0; k < S.length; k++) await req('POST', '/api/peer', { vote: k % 3 ? 'ok' : 'partial' }, { token: S[k].token });
    }
    if (i === 2) { ok((await T('/api/t/control', { action: 'pause' })).ok, 'pause'); ok((await T('/api/t/control', { action: 'resume' })).ok, 'resume'); ok((await T('/api/t/control', { action: 'addtime', sec: 5 })).ok, 'addtime'); }
    if (!(await T('/api/t/control', { action: 'next' })).ok) { ok(false, 'next'); break; }
  }
  st = (await T('/api/t/state')).state; ok(st.t.phase === 'done', 'сорилт дууссан');
  ok(st.teams.every(t => t.score >= 0) && st.teams.some(t => t.score > 0), 'оноо тооцогдсон');
  ok(st.teams.every(t => t.rank >= 1 && t.rank <= 4), 'rank');
  ok(st.teams.every(t => t.stages && t.stages.length >= 5), 'шатны оноо');
  const fin = (await req('GET', '/api/state', undefined, { token: S[0].token })).state; ok(fin.me && fin.me.score >= 0, 'сурагчийн эцсийн үр дүн');
  // CSV
  const cr = await fetch(B + '/api/t/export.csv', { headers: { cookie } }); const buf = Buffer.from(await cr.arrayBuffer()); ok(buf[0] === 0xEF && buf.length > 500, 'CSV (BOM)');
  // асуултын CRUD
  const nq = await T('/api/t/question', { type: 'mcq', text: 'Тест?', options: ['а', 'б'], correct: 0, stage: 0, team: 0, area: 1, difficulty: 1, concept: 'тест', explanation: 'x' }); ok(nq.ok, 'асуулт нэмэх ' + (nq.err || ''));
  if (nq.id || (nq.question && nq.question.id)) { const id = nq.id || nq.question.id; ok((await T('/api/t/question/delete', { id })).ok, 'асуулт устгах'); }
  ok((await T('/api/t/settings', { scoring: { ind: 10 }, timing: {} })).ok, 'тохиргоо');
  // backup / restore
  const bk = await T('/api/t/backup.json'); ok(bk && (bk.v === 3 || (bk.data && bk.data.v === 3) || bk._s === 200), 'backup');
  // нууц үг
  ok(!(await T('/api/t/password', { old: 'x', next: 'Shine12345' })).ok, 'буруу хуучин нууц үг татгалзана');
  ok((await T('/api/t/control', { action: 'reset' })).ok, 'reset');
  st = (await T('/api/t/state')).state; ok(st.t.phase === 'lobby', 'lobby руу буцсан');
  console.log('\nҮр дүн: ' + pass + ' ok, ' + fail + ' алдаа'); p.kill(); setTimeout(() => process.exit(fail ? 1 : 0), 500);
})().catch(e => { console.error(e); p.kill(); process.exit(1); });
