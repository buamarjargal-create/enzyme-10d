# ENZYME V3 — frontend ↔ server гэрээ (хөгжүүлэгчдэд)

Бүх UI текст МОНГОЛ хэлээр. Хэрэглэгчид харагдах газар "Terminal", "tunnel", "npm", "server", "localhost" гэх мэт техникийн үг БАЙХГҮЙ.
Загвар: `public/theme.css` (дизайн систем), `public/common.js` (helper, Charts, CUTE, STK/stk()). Өнгө: baby pink / pink / purple / white / yellow — зөөлөн, бүдэг.
Шрифт нь `Nunito` (HTML head дотор Google Fonts link оруул: `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800;900&display=swap&subset=cyrillic" rel="stylesheet">`). CSP зөвшөөрсөн: `script-src 'self'` (INLINE SCRIPT БОЛОМЖГҮЙ — зөвхөн /xxx.js файл), style-src 'self' 'unsafe-inline' fonts.googleapis.com.
Бүх динамик текстийг `esc()`-ээр escape хий. Наалт зураг: `/img/<name>.png` (atom black blue bread bubble dance dna egg flask green lab mol mouse mouse2 orange pencil plant purple strawberry tongue), `stk(name,w,cls,style)`, `pick(group,seed)`, групп: happy sad wait science cheer team all. `TEAMIMG[team]`. `cutePick('wait'|'right'|'wrong'|'team'|'done', seed)`.
Зураг бүхий асуулт: `q.image` → `/img/q/<file>`; `q.graph` → `graphSVG(q.graph)`.

## Урсгал (db.run)
`t.phase`: `lobby` | `live` | `done`. `live` үед `t.step` (index), `t.stepCount`, `t.stage` (1..4), `t.kind` ∈ q|write|peer|duel|final, `t.ph` ∈ ind|team|peer|rev, `t.endsAt`, `t.left`(ms), `t.now`, `t.paused`, `t.locked`, `t.totalSec`.
Шат бүр үеүд (KINDS): q:[ind,rev] · write:[team] · peer:[peer,rev] · duel:[ind,team,rev] · final:[team,rev].
1-р шат = 6 асуулт (q), 2-р шат = write (багийн нэг хариулт бичнэ) + peer (өөр баг үнэлнэ: баг t нь баг t%4+1-ийг шалгана), 3-р шат = duel (баг бүр өөр асуулт: хувийн хариулт → 30с багийн хэлэлцүүлэг+түгжих → үр дүн), 4-р шат = final (баг бүрийн хамгийн сул сэдвээр сонгосон асуулт, зөвхөн багийн хариулт).
Оноо (`scoring`): ind=10 (хувийн зөв), teamQ=20 (багийн зөв), teamPartial=10, peerHit=10, peerNear=5. Багийн оноо = (гишүүдийн хувийн оноогоор дундаж | нийлбэр) + багийн оноо.

## Сурагчийн HTTP API (header `x-token`)
- POST /api/code {code} → {ok, students:[{id,name,online}]}
- POST /api/student/login {code,id,pin?,takeover?,token?} → {ok,token} | {ok:false,need:'takeover'}
- GET /api/state → {ok,state}
- POST /api/answer {qid, answer, why?} — хувийн (ind үе). answer: mcq {i} · multi {arr:[i..]} · tf {v:bool} · order {arr: permutation of original indices in displayed order} · match {arr: for each left k, original index of chosen right}. → {ok,msg,dup?}. Алдаа: {ok:false, err}.
- POST /api/team/answer {qid, answer, lock?} — write/duel/final-ийн `team` үед. write-д answer={text}, lock үгүй (цаг дуусахад түгждэг). duel/final-д lock:true → эцсийн хариулт түгжинэ. Баг доторх хэн ч хадгалж/түгжиж болно (сүүлийнх нь ялна, түгжигдсэний дараа өөрчлөхгүй).
- POST /api/peer {vote:'ok'|'partial'|'wrong', why?} — peer үед; дахин илгээвэл шинэчилнэ.
- POST /api/chat {text} (багийн чат). WS event `chat` {team,msg:{id,name,text,t,sid,teacher}} зөвхөн өөрийн багт.

## Сурагчийн state (`/api/state`, WS `state`)
`t` (timer) · `script:[{id,stage,kind,label,revealed}]` · `stages:[{id,icon,name,title,desc}]` · `me:{id,name,team,teamName,mission,focus,score,ind,peer,correct,answers}` · `team:{rank,avg,sum,score,teamPts,members:[{id,name,online,me}]}` · `cls` · `scoring` · `chatOn` · `chat:[…]` (сүүлийн 80) · `lobby:{joined,total,who:[{name,me}]}` (lobby үед) · `cur` (live үед) · `board:[{team,name,score,rank,stages[0..4],teamPts,avg,members,accuracy?,avgSec?}]` (live/rev, done) · `charts:{perQ:[{id,text,concept,dist}],concepts:[{name,pct,n}]}` + `all:[{id,stage,text,ok,pts,none}]` (done үед).
`cur` = {stepId, stage, kind, ph, qn, qTotal, q (publicQ: {id,type,text,graph,image,askWhy,askJustify,concept, options:[{i,text}] | items:[{i,text}] | lefts:[...] & rights:[{i,text}]}), answered, myAnswer, area?, tans, picks, teamAnswered, teamSize, reveal, result, dist, teamRes, target, myVote, voted, myTeamAns, truth, myPts, mine, ...}.
- q/ind: q, answered, myAnswer, teamAnswered/teamSize. q/rev: reveal({correct|correctItems|correctPairs, explanation, misconception, discussion}), result{ok,pts,why,none?}, dist (Charts.dist), teamRes{okN,of,ok}.
- write/team: q (short), tans (багийн одоогийн бичвэр: {text,by,locked}) — бүгдэд харагдана.
- peer/peer: q, target:{team,name,ans:{text,by}|null}, myVote, voted/teamSize. peer/rev: truth, myPts, mine:{rating,votes:{ok,partial,wrong}} (манай хариулт хэрхэн үнэлэгдсэн), reveal.
- duel/ind: q (хувийн shuffle). duel/team: q (БАГИЙН нэг ижил дараалал), picks:[{name,answered,desc}] (гишүүдийн хувийн хариулт), tans:{ans,desc,by,locked,auto}. duel/rev: reveal, result, teamRes, tans.
- final/team: q, area (хамгийн сул сэдвийн дугаар, settings.areas), tans. final/rev: reveal, teamRes, tans.
Төлөв дахин зурахдаа input/textarea-н оруулсан утгыг БҮҮ арилга (signature-д суурилсан дахин зурах; чатыг тусад нь шинэчил).

## Багшийн API (cookie `tsid`; prefix `/api/t`)
GET /state → {state} (`teacherView`): t, script, stages, settings (public; scoring, timing, stages, areas, teams, discussion, code…), students[{id,name,team,pin,online,score,ind,peer,correct,answers}], teams[{team,name,members,sum,avg,teamPts,score,stages[0..4],accuracy,avgSec,rank}], questions[…], qstats{qid:{answered,correct,wrong,partial,pending,expected}}, feed, present, live{stepId,kind,ph,teams:[{team,qid,qtext,members:[{id,name,online,answered}],tans,target?,rating?,manual?,area?}]}, onlineCount,total, chat{1:[…],2,3,4}, chatOff, pics[], charts, writeAnswers[{team,ans,rating,manual,auto}], writeQ.
POST /control {action: start|pause|resume|next|goto{step}|addtime{sec}|lock|unlock|chatoff|chaton|end|reset}
POST /rate {team,rating:'ok'|'partial'|'wrong'|''} · POST /chat {team(0=бүгд),text} · POST /chat/delete {team,id}
POST /present {kind:q|a|e|d|text|board|clear,qid?,text?,title?} · POST /award {sid|team, delta, reason}
GET /answers?qid= → {q,rows[{sid,name,team,answered,text,why,ok,pts,bonus,sec}],teamRows,dist} · POST /grade {sid,qid,bonus}
POST /student {id?,name,team,pin} · /student/delete · /student/kick · /teams/shuffle
POST /question {id?, stage 0..4, slot, area 0..4, team 0..4, type, text, image?, graph?, options|items|pairs|keywords, correct, difficulty, concept, explanation, misconception, discussion, askWhy, askJustify, active} · /question/delete|duplicate|move|toggle|regrade {id}
POST /settings {className,topic,code,pinEnabled,scoreMode,autoAdvance,chatOn,scoring{},timing{kind:{ph:sec}},teams[],discussion[]} · POST /password · GET /backup.json · POST /restore {data} · GET /export.csv · GET /images
WS: /ws?role=teacher → events `tstate` (full), `chat` {team,msg}. /ws?role=projector → `pstate`. /ws?role=student&token=… → `state`, `chat`, `denied`.
