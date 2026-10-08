(function(){
var root=document.getElementById('root'),ST=null,OFF=0,wi=0;
connectWS(function(){return 'role=projector'},{msg:function(e,s){if(e==='pstate'){ST=s;OFF=s.t.now-Date.now();draw()}},denied:function(){root.innerHTML='<div class="pc center"><h1>Нэвтрэх шаардлагатай</h1><p class="muted">Энэ компьютер дээр эхлээд <a href="/teacher">/teacher</a> хуудсаар багшаар нэвтэрч, дараа нь Проекторыг нээнэ үү.</p></div>'}});
function rem(){var t=ST.t;return t.paused?t.left:(t.endsAt?Math.max(0,t.endsAt-(Date.now()+OFF)):0)}
var L='АБВГДЕЖЗ';
var PHN={ind:'Хувийн хариулт',team:'Багийн хэлэлцүүлэг',peer:'Шалгалт',rev:'Хариу ба тайлбар'};
function stageOf(id){return (ST.stages||[])[id-1]||{}}
function top(){var c=ST.cur,s=c?stageOf(c.stage):null;return '<div class="top"><span>🧬 ENZYME · '+esc(ST.cls.name)+' · '+esc(ST.cls.topic)+'</span>'+(s?'<span class="stg">'+esc(s.icon||'')+' '+esc(s.name||'')+' · '+esc(PHN[ST.t.ph]||'')+'</span>':'')+'</div>'}
function timer(){return ST.t.phase==='live'&&ST.t.ph!=='rev'?'<div class="tm"><div class="timer" id="pt">--:--</div></div>':''}
function opts(q,rv){var good=function(i){if(!rv)return false;return Array.isArray(rv.correct)?rv.correct.indexOf(i)>=0:rv.correct===i},h='';
  if(q.options)h+='<div class="row2">'+q.options.map(function(o,i){return '<div class="optp'+(good(o.i)?' good':'')+'"><b>'+L[i]+'</b><span>'+esc(o.text)+'</span></div>'}).join('')+'</div>';
  if(q.items)h+=(rv&&rv.correctItems?rv.correctItems:q.items.map(function(o){return o.text})).map(function(t,i){return '<div class="optp'+(rv?' good':'')+'"><b>'+(rv?i+1:'•')+'</b><span>'+esc(t)+'</span></div>'}).join('');
  if(q.lefts)h+=q.lefts.map(function(l,i){return '<div class="optp'+(rv?' good':'')+'"><b>'+(i+1)+'</b><span>'+esc(l)+(rv&&rv.correctPairs?' ⇒ '+esc(rv.correctPairs[i].r):'')+'</span></div>'}).join('')+(!rv&&q.rights?'<div class="muted">Хариултууд: '+q.rights.map(function(r){return esc(r.text)}).join(' · ')+'</div>':'');
  if(q.type==='tf'&&rv)h+='<div class="optp good"><b>✓</b><span>'+(rv.correct?'Үнэн':'Худал')+'</span></div>';
  if(rv&&rv.explanation)h+='<div class="box"><h4>Тайлбар</h4>'+esc(rv.explanation)+'</div>';
  return h}
function qBlock(q,rv){return '<div class="q">'+esc(q.text)+'</div>'+(q.graph?graphSVG(q.graph):'')+(q.image?'<div class="center"><img src="/img/q/'+esc(q.image)+'" alt="" style="max-height:30vh;border-radius:20px;background:#fff;padding:8px"></div>':'')+opts(q,rv)}
function board(b){var s=b.slice().sort(function(a,c){return a.rank-c.rank});
  var h='<div class="big">🏆 Багийн үр дүн</div>'+s.map(function(t){return '<div class="lb"><div class="rk">'+t.rank+'</div><div><b>'+esc(t.name)+'</b><div class="muted" style="font-size:.6em">'+esc(t.mission||'')+'</div></div><div class="sc">'+Math.round(t.score)+'</div></div>'}).join('');
  h+='<div class="card" style="margin:0">'+Charts.stacked(s.map(function(t){return {name:t.name,color:TEAMCOL[t.team],stages:t.stages||[0,0,0,0,0],score:t.score}}))+'</div>';
  return h}
function lobby(){var j=ST.join||{},h='<div class="big">Сорилтод нэгдэх <span class="float" style="display:inline-block">'+stk('dna',80)+'</span></div><div class="row" style="gap:3vw">'+(j.qr?'<img class="qr" alt="QR" src="'+j.qr+'">':'')+'<div><div class="muted">Хичээлийн код</div><div class="code">'+esc(j.code||'')+'</div><div class="muted" style="margin-top:.8em;word-break:break-all;font-size:.75em">'+esc(j.url||'')+'</div></div></div>';
  h+='<div class="tcard" style="background:var(--pink-1);align-self:flex-start">'+stk(pick('wait',wi),44,'','vertical-align:middle')+' Орсон: '+ST.lobby.joined+' / '+ST.lobby.total+' · '+esc(cutePick('wait',wi))+'</div>';
  h+='<div class="row2" style="grid-template-columns:repeat(4,1fr)">'+ST.mission.map(function(m,i){return '<div class="tcard" style="background:'+TEAMCOL[i+1]+'88">'+esc(m.name)+'<div class="muted" style="font-size:.65em">'+esc(m.mission||'')+'</div></div>'}).join('')+'</div>';
  return h}
function teamQs(c){var rv=ST.t.ph==='rev';return '<div class="row2">'+c.teamQs.filter(Boolean).map(function(x){return '<div class="card" style="margin:0;border-left:10px solid '+TEAMCOL[x.team]+'"><b>'+esc(x.name)+'</b> '+(rv?'<span class="tag '+(x.ok?'ok':'no')+'">'+(x.ok?'Зөв':'Буруу')+'</span>':'<span class="tag '+(x.locked?'ok':'wait')+'">'+(x.locked?'🔒 түгжсэн':'…')+'</span>')+'<div style="font-size:.8em;margin:.3em 0">'+esc(x.q.text)+'</div>'+(x.q.graph?graphSVG(x.q.graph):'')+(x.q.image?'<img src="/img/q/'+esc(x.q.image)+'" alt="" style="max-height:20vh;max-width:100%;border-radius:14px">':'')+(rv&&x.reveal&&x.reveal.explanation?'<div class="box" style="font-size:.7em">'+esc(x.reveal.explanation)+'</div>':'')+'</div>'}).join('')+'</div>'}
function draw(){if(!ST)return;var p=ST.present,c=ST.cur,h=top(),t=ST.t;
  if(p&&p.kind==='text')h+='<div class="muted">'+esc(p.title||'Ярилцъя')+'</div><div class="big" style="margin-top:2vh">'+esc(p.text)+'</div>';
  else if(p&&p.q){var rv=p.reveal;h+='<div class="muted">'+esc(p.concept||'')+'</div>'+qBlock(p.q,p.kind==='a'?rv:null);if(rv&&p.kind==='d')h+='<div class="box"><h4>Ярилцъя</h4>'+esc(rv.discussion||'')+'</div>';if(rv&&p.kind==='e')h+='<div class="box"><h4>Тайлбар</h4>'+esc(rv.explanation||'')+'</div>'}
  else if(p&&p.kind==='board'&&ST.board)h+=board(ST.board);
  else if(t.phase==='lobby')h+=lobby();
  else if(t.phase==='done'){h+=(ST.board?board(ST.board):'');if(ST.chart&&ST.chart.concepts&&ST.chart.concepts.length)h+='<div class="card" style="margin:0"><h3>Сэдвийн зөв хариулсан хувь</h3>'+Charts.hbars(ST.chart.concepts.map(function(k){return {label:k.name,value:k.pct,text:k.pct+'%',color:k.pct<50?CH.rose:CH.mint}}),{max:100})+'</div>';h+='<div class="center big">'+stk(pick('cheer',1),90)+' '+esc(cutePick('done',1))+'</div>'}
  else if(c){
    if(t.paused)h+='<div class="tcard" style="background:var(--butter-2);align-self:center">⏸ Түр зогссон</div>';
    if(c.q){h+=timer()+qBlock(c.q,t.ph==='rev'?c.reveal:null);
      if(c.kind==='q'&&t.ph==='ind')h+='<div class="muted center">Хариулсан: '+(c.answered||0)+' / '+ST.lobby.total+' · Асуулт '+c.qn+'/'+c.qTotal+'</div>';
      if(t.ph==='rev'&&c.dist)h+='<div class="card" style="margin:0">'+Charts.dist(c.dist)+'</div>';
      if(c.teamsDone)h+='<div class="row">'+c.teamsDone.map(function(d,i){return '<span class="tag '+(d?'ok':'wait')+'">'+(i+1)+'-р баг '+(d?'✓':'…')+'</span>'}).join('')+'</div>';
      if(c.ratings)h+='<div class="row">'+c.ratings.map(function(r){var m={ok:['ok','✅ Зөв'],partial:['mid','🟡 Хэсэгчлэн'],wrong:['no','❌ Буруу']}[r.rating]||['wait','…'];return '<span class="tag '+m[0]+'">'+esc(r.name)+': '+m[1]+'</span>'}).join('')+'</div>'}
    else if(c.teamQs)h+=timer()+teamQs(c);
  }
  root.innerHTML='<div class="pc">'+h+'</div>';tick()}
function tick(){var el=document.getElementById('pt');if(el&&ST){var r=rem();el.className='timer'+(ST.t.paused?' pause':r<10000?' low':'');el.textContent=(ST.t.paused?'⏸ ':'')+fmt(r)}}
setInterval(tick,300);setInterval(function(){wi++;if(ST&&ST.t.phase==='lobby')draw()},4500);
})();
