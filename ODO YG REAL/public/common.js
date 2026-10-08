/* ENZYME — ерөнхий туслах функцууд */
(function(){
var W=window;
W.esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
W.fmt=function(ms){ms=Math.max(0,Math.ceil(ms/1000));var m=Math.floor(ms/60),s=ms%60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s};
W.dna=function(sz){sz=sz||30;return '<svg width="'+sz+'" height="'+sz+'" viewBox="0 0 32 32" aria-hidden="true"><path d="M8 3c0 8 16 8 16 13S8 21 8 29M24 3c0 8-16 8-16 13s16 5 16 13" fill="none" stroke="#b79df0" stroke-width="2.4" stroke-linecap="round"/><path d="M11 8h10M9.5 16h13M11 24h10" stroke="#f5a3c7" stroke-width="2" stroke-linecap="round"/></svg>'};
W.toast=function(msg,kind){var t=document.createElement('div');t.className='toast '+(kind||'');t.setAttribute('role','status');t.textContent=msg;document.body.appendChild(t);setTimeout(function(){t.remove()},kind==='bad'?4200:2600)};
W.api=function(url,opt){opt=opt||{};var h={'Content-Type':'application/json'};if(opt.token)h['x-token']=opt.token;
  return fetch(url,{method:opt.method||(opt.body?'POST':'GET'),headers:h,body:opt.body?JSON.stringify(opt.body):undefined,credentials:'same-origin'}).then(function(r){return r.json().catch(function(){return {ok:false,err:'Серверийн хариу буруу байна.'}}).then(function(j){j._status=r.status;return j})})};
W.graphSVG=function(g){
  if(!g||!g.series||!g.series.length)return '';
  var w=520,h=290,L=56,R=16,T=34,B=52,xs=[],ymax=0,xmin=1e9,xmax=-1e9;
  g.series.forEach(function(s){s.points.forEach(function(p){if(xs.indexOf(p[0])<0)xs.push(p[0]);ymax=Math.max(ymax,p[1]);xmin=Math.min(xmin,p[0]);xmax=Math.max(xmax,p[0])})});
  xs.sort(function(a,b){return a-b});if(xmax===xmin)xmax=xmin+1;
  var raw=(ymax||1)/5,pw=Math.pow(10,Math.floor(Math.log10(raw))),fr=raw/pw,yt=(fr<=1?1:fr<=2?2:fr<=5?5:10)*pw;var top=Math.ceil(ymax/yt)*yt||1;var cols=['#9d7fe0','#f08fb5','#e8b94a','#7fc4a4'];
  var X=function(x){return L+(x-xmin)/(xmax-xmin)*(w-L-R)},Y=function(y){return h-B-(y/top)*(h-B-T)};
  var o='<svg class="graph" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(g.title||'График')+'" xmlns="http://www.w3.org/2000/svg" font-family="Nunito,ui-rounded,system-ui,Arial,sans-serif">';
  o+='<text x="'+w/2+'" y="20" text-anchor="middle" font-size="14" font-weight="700" fill="#4a3a5c">'+esc(g.title||'')+'</text>';
  for(var v=0;v<=top+1e-9;v+=yt){var yy=Y(v);o+='<line x1="'+L+'" x2="'+(w-R)+'" y1="'+yy+'" y2="'+yy+'" stroke="#efe6f7"/><text x="'+(L-8)+'" y="'+(yy+4)+'" text-anchor="end" font-size="11" fill="#8a7a9c">'+(Math.round(v*100)/100)+'</text>'}
  var skip=Math.ceil(xs.length/9);xs.forEach(function(x,i){if(i%skip)return;var xx=X(x);o+='<line x1="'+xx+'" x2="'+xx+'" y1="'+(h-B)+'" y2="'+(h-B+4)+'" stroke="#b9a9cc"/><text x="'+xx+'" y="'+(h-B+17)+'" text-anchor="middle" font-size="11" fill="#8a7a9c">'+x+'</text>'});
  o+='<line x1="'+L+'" x2="'+L+'" y1="'+T+'" y2="'+(h-B)+'" stroke="#b9a9cc"/><line x1="'+L+'" x2="'+(w-R)+'" y1="'+(h-B)+'" y2="'+(h-B)+'" stroke="#b9a9cc"/>';
  o+='<text x="'+(L+(w-L-R)/2)+'" y="'+(h-18)+'" text-anchor="middle" font-size="12" font-weight="600" fill="#5b4a6e">'+esc(g.xlabel||'')+'</text>';
  o+='<text transform="translate(14 '+(T+(h-B-T)/2)+') rotate(-90)" text-anchor="middle" font-size="12" font-weight="600" fill="#5b4a6e">'+esc(g.ylabel||'')+'</text>';
  g.series.forEach(function(s,k){var c=cols[k%4];var pts=s.points.slice().sort(function(a,b){return a[0]-b[0]});o+='<polyline fill="none" stroke="'+c+'" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="'+pts.map(function(p){return X(p[0])+','+Y(p[1])}).join(' ')+'"/>';pts.forEach(function(p){o+='<circle cx="'+X(p[0])+'" cy="'+Y(p[1])+'" r="3.6" fill="'+c+'"/>'})});
  if(g.series.length>1){g.series.forEach(function(s,k){var lx=L+12,ly=T+12+k*16;o+='<rect x="'+lx+'" y="'+(ly-8)+'" width="12" height="4" fill="'+cols[k%4]+'"/><text x="'+(lx+18)+'" y="'+(ly-3)+'" font-size="11.5" fill="#4a3a5c">'+esc(s.name)+'</text>'})}
  return o+'</svg>'};
W.describeAnswer=function(q,a){try{
  if(q.type==='mcq'||q.type==='multi'){var m={};(q.options||[]).forEach(function(o){m[o.i]=o.text});return q.type==='mcq'?m[a.i]:a.arr.slice().sort(function(x,y){return x-y}).map(function(i){return m[i]}).join(' • ')}
  if(q.type==='tf')return a.v?'Үнэн':'Худал';
  if(q.type==='order'){var t={};q.items.forEach(function(o){t[o.i]=o.text});return a.arr.map(function(i,k){return (k+1)+'. '+t[i]}).join(' ')}
  if(q.type==='match'){var r={};q.rights.forEach(function(o){r[o.i]=o.text});return a.arr.map(function(ri,k){return q.lefts[k]+' ⇒ '+r[ri]}).join(' • ')}
  if(q.type==='short')return a.text}catch(e){}return ''};

W.connectWS=function(qs,h){var ws,delay=800,stopped=false,last=Date.now(),api={close:function(){stopped=true;try{ws.close()}catch(e){}}};
  function open(){var u=(location.protocol==='https:'?'wss://':'ws://')+location.host+'/ws?'+qs();try{ws=new WebSocket(u)}catch(e){setTimeout(open,delay);return}
    ws.onopen=function(){delay=800;last=Date.now();h.open&&h.open()};
    ws.onmessage=function(m){last=Date.now();var j;try{j=JSON.parse(m.data)}catch(e){return}if(j.e==='denied'){stopped=true;h.denied&&h.denied();return}h.msg&&h.msg(j.e,j.d)};
    ws.onclose=function(){h.close&&h.close();if(!stopped){setTimeout(open,delay);delay=Math.min(Math.round(delay*1.6),4000)}};
    ws.onerror=function(){try{ws.close()}catch(e){}}}
  open();setInterval(function(){if(ws&&ws.readyState===1&&Date.now()-last>20000){try{ws.close()}catch(e){}}},5000);return api};
})();

document.addEventListener('DOMContentLoaded', function () { document.querySelectorAll('[data-dna]').forEach(function (el) { el.innerHTML = dna(+el.getAttribute('data-dna') || 30); }); });


/* ---------- наалт зураг ---------- */
var STK={happy:['tongue','dance','egg'],sad:['strawberry','black','bread'],wait:['bread','egg','mouse2','tongue','dance','strawberry','orange'],science:['lab','flask','atom','mol','plant','dna','mouse'],cheer:['dance','tongue','bubble'],team:['purple','blue','green','orange'],all:['atom','black','blue','bread','bubble','dance','dna','egg','flask','green','lab','mol','mouse','mouse2','orange','pencil','plant','purple','strawberry','tongue']};
var TEAMIMG={1:'purple',2:'blue',3:'green',4:'orange'};
function hashStr(s){var h=2166136261;s=String(s);for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
function pick(group,seed){var a=STK[group]||STK.all;return a[hashStr(seed==null?Math.random():seed)%a.length]}
function stk(n,w,cls,st){return '<img class="sticker '+(cls||'')+'" src="/img/'+n+'.png" width="'+(w||80)+'" alt="" loading="lazy"'+(st?' style="'+st+'"':'')+'>'}
/* ---------- хөөрхөн үгс ---------- */
var CUTE={
  wait:['Найзуудаа хүлээж байна… 🌸','Ферментүүд халаагаа хийж байна 🧪','Нэг гүнзгий амьсгаа аваад бэлд ✨','Өнөөдөр бид хамтдаа гялалзана 💖','Субстрат ба энзим уулзахад бэлэн 🧬','Багийнхаа хүмүүстэй инээмсэглэж үз 🌷','Хамгийн хөөрхөн баг хэн бол оо? 🍓','Чи чадна, багш чамд итгэж байна 🫶','Санаа зоволгүй, алдаа бол суралцах алхам 🌼','Жижигхэн ДНХ-ууд бүжиглэж байна 💃'],
  right:['Гайхалтай! ✨','Яг зөв! 🌸','Ухаалаг байна! 💖','Сайхан! 🎀','Төгс хариулт! 🌷','Баг чинь бахархаж байна! 🍓'],
  wrong:['Зүгээр дээ, дараагийнх чинь болно 🌷','Алдаанаас л суралцдаг юм шүү 🍓','Тайлбарыг нь хамт уншъя 🌼','Одоо мэддэг болчихлоо ✨'],
  team:['Хамтдаа бодоцгооё 💬','Нэг нэгнийхээ санааг сонс 🌸','Хамгийн сайн үндэслэлийг сонго ✨','Баг бол хүч 💪'],
  done:['Та нар гайхалтай байлаа! 💖','Хамтдаа маш сайн ажилласан 🎀','Энзим та нарыг сайхан харж байна 🧬','Ямар ухаалаг баг вэ! 🌷']
};
function cutePick(k,seed){var a=CUTE[k]||CUTE.wait;return a[hashStr(seed==null?Math.random():seed)%a.length]}
/* ---------- диаграмм (SVG/HTML string) ---------- */
var CH={pink:'#f5a8c8',lilac:'#b9a3ec',butter:'#f6d56f',mint:'#a9dcc0',peach:'#ffc9a8',sky:'#a9cdf2',rose:'#f19aa6',track:'#f1e9f8',ink:'#4a3a5c'};
var TEAMCOL={1:'#b9a3ec',2:'#a9cdf2',3:'#a9dcc0',4:'#ffc9a8'};
var Charts={
  // donut: items [{label,value,color}], opt {center,sub,size}
  donut:function(items,opt){opt=opt||{};var sz=opt.size||200,r=sz*0.36,sw=sz*0.17,c=2*Math.PI*r,tot=items.reduce(function(a,b){return a+(+b.value||0)},0)||1,off=0;
    var o='<svg class="chart donut" viewBox="0 0 '+sz+' '+sz+'" width="'+sz+'" height="'+sz+'" role="img" aria-label="'+esc(opt.label||'Диаграмм')+'"><circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="'+CH.track+'" stroke-width="'+sw+'"/>';
    items.forEach(function(it){var v=(+it.value||0);if(v<=0)return;var len=v/tot*c;o+='<circle cx="'+sz/2+'" cy="'+sz/2+'" r="'+r+'" fill="none" stroke="'+it.color+'" stroke-width="'+sw+'" stroke-dasharray="'+Math.max(0,len-3)+' '+(c-len+3)+'" stroke-dashoffset="'+(-off)+'" transform="rotate(-90 '+sz/2+' '+sz/2+')" stroke-linecap="round"/>';off+=len});
    o+='<text x="'+sz/2+'" y="'+(sz/2+(opt.sub?2:8))+'" text-anchor="middle" font-size="'+sz*0.15+'" font-weight="800" fill="'+CH.ink+'" font-family="Nunito,ui-rounded,system-ui,sans-serif">'+esc(opt.center==null?tot:opt.center)+'</text>';
    if(opt.sub)o+='<text x="'+sz/2+'" y="'+(sz/2+sz*0.11)+'" text-anchor="middle" font-size="'+sz*0.07+'" fill="#8a7a9c" font-family="Nunito,ui-rounded,system-ui,sans-serif">'+esc(opt.sub)+'</text>';
    return o+'</svg>'},
  legend:function(items){return '<div class="legend">'+items.map(function(it){return '<span><i style="background:'+it.color+'"></i>'+esc(it.label)+(it.value!=null?' <b>'+esc(it.value)+'</b>':'')+'</span>'}).join('')+'</div>'},
  // хэвтээ мөр: items [{label,value,max?,color,mark?}]
  hbars:function(items,opt){opt=opt||{};var mx=opt.max||Math.max.apply(null,items.map(function(i){return i.value}).concat([1]));
    return '<div class="hbars">'+items.map(function(it){var p=Math.max(0,Math.min(100,it.value/mx*100));return '<div class="hb'+(it.mark?' mark':'')+'"><div class="hb-l">'+esc(it.label)+'</div><div class="hb-t"><div class="hb-f" style="width:'+p+'%;background:'+(it.color||CH.lilac)+'"></div></div><div class="hb-v">'+esc(it.text!=null?it.text:it.value)+'</div></div>'}).join('')+'</div>'},
  // босоо капсул багана (лавлагаа дахь Total Sales Overview шиг): items [{label,value,color}]
  columns:function(items,opt){opt=opt||{};var mx=opt.max||Math.max.apply(null,items.map(function(i){return i.value}).concat([1]));var h=opt.height||190;
    return '<div class="cols" style="height:'+h+'px">'+items.map(function(it){var p=Math.max(4,it.value/mx*100);return '<div class="col"><div class="col-track"><div class="col-fill hatch" style="height:'+p+'%;background-color:'+(it.color||CH.pink)+'"><span class="col-v">'+esc(it.text!=null?it.text:it.value)+'</span></div></div><div class="col-l">'+esc(it.label)+'</div></div>'}).join('')+'</div>'},
  // багуудын шатлал бүрийн оноо: rows [{name,color,stages:[0,s1,s2,s3,s4],score}]
  stacked:function(rows){var cs=[CH.lilac,CH.mint,CH.butter,CH.peach];var mx=Math.max.apply(null,rows.map(function(r){return r.score}).concat([1]));
    return '<div class="stackw">'+rows.map(function(r){var tot=(r.stages[1]+r.stages[2]+r.stages[3]+r.stages[4])||1;return '<div class="sk"><div class="sk-l"><span class="sk-dot" style="background:'+r.color+'"></span>'+esc(r.name)+'</div><div class="sk-t" style="width:'+Math.max(8,r.score/mx*100)+'%">'+[1,2,3,4].map(function(k,i){var v=Math.max(0,r.stages[k]);return v?'<div class="sk-s" style="flex:'+v+';background:'+cs[i]+'" title="'+k+'-р шат: '+v+'">'+(v/tot>0.12?Math.round(v):'')+'</div>':''}).join('')+'</div><div class="sk-v">'+r.score+'</div></div>'}).join('')+'<div class="legend"><span><i style="background:'+cs[0]+'"></i>1 Team vs Team</span><span><i style="background:'+cs[1]+'"></i>2 Peer Check</span><span><i style="background:'+cs[2]+'"></i>3 Enzyme Duel</span><span><i style="background:'+cs[3]+'"></i>4 Save Your Team</span></div></div>'},
  // асуултын хариултын тархалт (dist объект серверээс)
  dist:function(d){if(!d)return '';var items=[];if(d.opts&&d.opts.length){var L='АБВГДЕЖЗ';return Charts.hbars(d.opts.map(function(o,i){return {label:L[i]+') '+o.text,value:o.n,color:o.correct?CH.mint:CH.lilac,text:o.n+' · '+(d.answered?Math.round(o.n/d.answered*100):0)+'%',mark:o.correct}}),{max:Math.max(d.answered,1)})}
    var none=Math.max(0,d.total-d.answered);return Charts.donut([{label:'Зөв',value:d.correct,color:CH.mint},{label:'Хэсэгчлэн',value:d.partial||0,color:CH.butter},{label:'Буруу',value:d.wrong,color:CH.rose},{label:'Хариулаагүй',value:none,color:CH.track}],{center:d.answered?Math.round(d.correct/d.answered*100)+'%':'–',sub:'зөв',size:150})+Charts.legend([{label:'Зөв',value:d.correct,color:CH.mint},{label:'Буруу',value:d.wrong,color:CH.rose},{label:'Хариулаагүй',value:none,color:CH.track}])}
};
