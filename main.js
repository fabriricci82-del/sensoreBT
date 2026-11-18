import {BleClient} from '@capacitor-community/bluetooth-le';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
const SVC="6e400001-b5a3-f393-e0a9-e50e24dcca9e",CMD="6e400002-b5a3-f393-e0a9-e50e24dcca9e",CHR="6e400003-b5a3-f393-e0a9-e50e24dcca9e",FIL="6e400004-b5a3-f393-e0a9-e50e24dcca9e";
let devId=null;
const BLE={
  ok:()=>true,
  async connect(onPkt,onFile,onDisc){
    await BleClient.initialize({androidNeverForLocation:true});
    const dev=await BleClient.requestDevice({services:[SVC]});
    await BleClient.connect(dev.deviceId,()=>{devId=null;onDisc()});
    devId=dev.deviceId;
    await BleClient.startNotifications(devId,SVC,CHR,onPkt);
    await BleClient.startNotifications(devId,SVC,FIL,onFile);
    return dev.name||"Datalogger9";
  },
  async send(a){if(devId)await BleClient.write(devId,SVC,CMD,new DataView(Uint8Array.from(a).buffer))},
  async save(name,text){
    const r=await Filesystem.writeFile({path:name,data:text,directory:Directory.Cache,encoding:Encoding.UTF8});
    await Share.share({title:name,files:[r.uri]});
  }
};
const HDR="ms,ax,ay,az,gx,gy,gz,mx,my,mz,tempC,hPa,vibRMS,roll,pitch,yaw,batV,fHz,wt1_ax,wt1_ay,wt1_az,wt1_gx,wt1_gy,wt1_gz,wt1_roll,wt1_pitch,wt1_yaw,wt2_ax,wt2_ay,wt2_az,wt2_gx,wt2_gy,wt2_gz,wt2_roll,wt2_pitch,wt2_yaw,quotaRel_m";
const SR=10;  // pacchetti al secondo dal sensore
const COL=["#e5484d","#30a46c","#3e63dd"];
const $=i=>document.getElementById(i),st=$("st"),f=(x,d)=>x.toFixed(d);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const CH=[
{t:"Accelerazione (g)",s:[0,1,2],n:["X","Y","Z"]},
{t:"Giroscopio (°/s)",s:[3,4,5],n:["X","Y","Z"]},
{t:"Magnetometro (µT)",s:[6,7,8],n:["X","Y","Z"]},
{t:"Orientamento (°)",s:[12,13,14],n:["Roll","Pitch","Yaw"],dp:1},
{t:"Temperatura (°C)",s:[9],n:[""],dp:1},
{t:"Pressione (hPa)",s:[10],n:[""],dp:1},
{t:"Quota relativa (m)",s:[35],n:[""],rel:true},
{t:"Vibrazione RMS (g)",s:[11],n:[""],dp:3},
{t:"Frequenza dominante (Hz)",s:[16],n:[""],dp:0},
{t:"WT1 accelerazione (g)",s:[17,18,19],n:["X","Y","Z"]},
{t:"WT1 giroscopio (°/s)",s:[20,21,22],n:["X","Y","Z"],dp:1},
{t:"WT1 angoli (°)",s:[23,24,25],n:["Roll","Pitch","Yaw"],dp:1},
{t:"WT2 accelerazione (g)",s:[26,27,28],n:["X","Y","Z"]},
{t:"WT2 giroscopio (°/s)",s:[29,30,31],n:["X","Y","Z"],dp:1},
{t:"WT2 angoli (°)",s:[32,33,34],n:["Roll","Pitch","Yaw"],dp:1}];
CH.forEach(c=>{const d=document.createElement("div");d.className="c";d.innerHTML='<div class="l">'+c.t+'</div><div class="hd"></div><canvas></canvas>';$("cs").appendChild(d);c.hd=d.children[1];c.cv=d.children[2]});
let buf=[],paused=false,offs=0,cur=null,dur=30,alt0=null,lastAbs=0,recOn=false,rec=[],connected=false,prevFl=0,shocks=0,fmode=null,fbytes=[],fcur=null;
const CTL=["s1","s0","au","tm","c1","c2","ls","ap","wf"];
const setCtl=on=>CTL.forEach(i=>$(i).disabled=!on);
const fmt=s=>s>=60?+(s/60).toFixed(1)+" min":Math.round(s)+" s";
function pct(v){const T=[[3.3,0],[3.5,5],[3.7,20],[3.8,45],[3.9,65],[4.0,80],[4.1,92],[4.2,100]];if(v<=T[0][0])return 0;for(let i=1;i<T.length;i++)if(v<=T[i][0]){const a=T[i-1],b=T[i];return Math.round(a[1]+(b[1]-a[1])*(v-a[0])/(b[0]-a[0]))}return 100}
function draw(){
  const dpr=window.devicePixelRatio||1,mut=getComputedStyle(document.documentElement).getPropertyValue("--mut");
  const N=Math.round(dur*SR),sp=Math.max(1,Math.floor(N/600)),end=buf.length-offs;
  const d=[];for(let i=end-1;i>=Math.max(0,end-N);i-=sp)d.unshift([i,buf[i]]);
  const ci=cur===null?end-1:Math.max(0,Math.min(end-1,Math.round(end-1-(1-cur)*(N-1))));
  const cr=buf[ci];
  CH.forEach(c=>{
    const cv=c.cv,w=Math.round(cv.clientWidth*dpr),h=Math.round(cv.clientHeight*dpr);
    if(cv.width!==w||cv.height!==h){cv.width=w;cv.height=h}
    const x=cv.getContext("2d");x.clearRect(0,0,w,h);
    const o=c.rel?(alt0||0):0;
    if(cr)c.hd.innerHTML=c.s.map((k,j)=>'<span style="color:'+COL[c.s.length>1?j:2]+'">'+c.n[j]+' '+f(cr[k]-o,c.dp===undefined?2:c.dp)+'</span>').join("  ")+(cur!==null?" (cursore)":"");
    if(d.length<2)return;
    let lo=Infinity,hi=-Infinity;
    d.forEach(e=>c.s.forEach(k=>{lo=Math.min(lo,e[1][k]-o);hi=Math.max(hi,e[1][k]-o)}));
    if(hi-lo<1e-6){hi+=.5;lo-=.5}
    const pad=(hi-lo)*.1;lo-=pad;hi+=pad;
    c.s.forEach((k,j)=>{
      x.strokeStyle=COL[c.s.length>1?j:2];x.lineWidth=2*dpr;x.beginPath();
      d.forEach((e,m)=>{const px=w-(end-1-e[0])/(N-1)*w,py=h-(e[1][k]-o-lo)/(hi-lo)*h;m?x.lineTo(px,py):x.moveTo(px,py)});
      x.stroke();
    });
    if(cur!==null){x.strokeStyle=mut;x.lineWidth=dpr;x.setLineDash([4,4]);x.beginPath();x.moveTo(cur*w,0);x.lineTo(cur*w,h);x.stroke();x.setLineDash([])}
    x.fillStyle=mut;x.font=(11*dpr)+"px sans-serif";x.fillText(f(hi,2),4,12*dpr);x.fillText(f(lo,2),4,h-4);
    x.textAlign="center";x.fillText("\u2212"+fmt(dur/2),w/2,h-4);x.textAlign="right";x.fillText("ora",w-4,h-4);x.textAlign="left";
  });
}
function show(v,fl,fl2){
  $("t").textContent=f(v[9],1);$("p").textContent=f(v[10],1);$("q").textContent=f(v[35]-alt0,1);
  $("bt").textContent=v[15]<1?"non misurata":pct(v[15])+"% ("+f(v[15],2)+" V)";
  const sd=fl&4,lg=fl&1;
  $("sds").textContent=!sd?"microSD non rilevata":lg?"● In registrazione":"Ferma";
  $("sds").style.color=lg?"var(--ok)":"var(--tx)";
  $("au").checked=!!(fl&2);
  $("rt").textContent=(fl&16)?"Orologio RTC: impostato":"Orologio RTC: assente o da impostare";
  $("cal").textContent=(fl&64)?"Calibrazione in corso…":"";
  $("lb").hidden=!(fl&32);
  $("wts").textContent="WT9011DCL  1: "+((fl&128)?"connesso":"no")+"   2: "+((fl2&1)?"connesso":"no");
  $("s1").disabled=!sd||!!lg;$("s0").disabled=!lg;$("au").disabled=!sd;$("ls").disabled=!sd||!!lg;
  draw();
}
let asm=new Uint8Array(148),got=0;
function onPkt(d){
  const q=d.getUint8(0);
  if(q===0)got=0;
  if(q*19!==got)return;
  for(let i=1;i<d.byteLength&&got<148;i++)asm[got++]=d.getUint8(i);
  if(got>=148)onData(new DataView(asm.buffer.slice(0,148)));
}
function onData(d){
  const v=[];for(let i=0;i<35;i++)v.push(d.getFloat32(4+i*4,true));
  const fl=d.getUint8(144),fl2=d.getUint8(145);
  const ab=44330*(1-Math.pow(v[10]/1013.25,0.1903));if(alt0===null)alt0=ab;lastAbs=ab;v.push(ab);
  buf.push(v);if(buf.length>18000)buf.shift();
  if(recOn){rec.push([d.getUint32(0,true)].concat(v.slice(0,35).map(x=>+x.toFixed(3)),[+(ab-alt0).toFixed(2)]).join(","));$("rn").textContent=rec.length+" campioni"}
  if((fl&8)&&!(prevFl&8)){shocks++;$("sh").textContent="⚠ Urti rilevati: "+shocks+" (tocca per azzerare)";$("sh").hidden=false}
  prevFl=fl;
  if(!paused)show(v,fl,fl2);
}
const tx=a=>BLE.send(a).catch(e=>{st.textContent="Errore comando: "+(e.message||e)});
$("s1").onclick=()=>tx([1]);$("s0").onclick=()=>tx([0]);
$("au").onchange=e=>tx([e.target.checked?2:3]);
$("tm").onclick=()=>{const e=Math.floor(Date.now()/1000-new Date().getTimezoneOffset()*60);tx([4,e&255,(e>>>8)&255,(e>>>16)&255,(e>>>24)&255])};
$("c1").onclick=()=>tx([5]);$("c2").onclick=()=>tx([6]);$("wf").onclick=()=>tx([11]);
$("ap").onclick=()=>{const hz=+$("rh").value,g=Math.max(1,Math.min(25,+$("sg").value||3));tx([10,+$("rg").value,hz&255,hz>>8,Math.round(g*10)]);st.textContent="Parametri salvati: il sensore si riavvia, riconnettiti"};
$("sh").onclick=()=>{shocks=0;$("sh").hidden=true};
$("ls").onclick=()=>{fmode="list";fbytes=[];$("fl").textContent="Lettura…";tx([7])};
$("fl").onclick=e=>{const b=e.target.closest("button");if(!b)return;fcur={name:b.dataset.n,size:+b.dataset.z||1};fmode="file";fbytes=[];$("fp").textContent=fcur.name+": 0%";tx([8].concat([...fcur.name].map(c=>c.charCodeAt(0))))};
function onFile(d){
  if(d.byteLength===1&&d.getUint8(0)===4){endFile();return}
  for(let i=0;i<d.byteLength;i++)fbytes.push(d.getUint8(i));
  if(fmode==="file"&&fcur)$("fp").textContent=fcur.name+": "+Math.min(100,Math.round(fbytes.length/fcur.size*100))+"%";
}
async function endFile(){
  const txt=new TextDecoder().decode(Uint8Array.from(fbytes));
  const m=fmode;fmode=null;
  if(m==="list"){
    const rows=txt.trim().split("\n").filter(Boolean).map(l=>l.split(","));
    $("fl").innerHTML=rows.length?rows.map(r=>'<div class="row"><span>'+esc(r[0])+' · '+Math.round(r[1]/1024)+' KB</span><button class="s sm" data-n="'+esc(r[0])+'" data-z="'+esc(r[1])+'">Scarica</button></div>').join(""):"Nessun file";
  }else if(m==="file"){
    try{await BLE.save(fcur.name,txt);$("fp").textContent=fcur.name+": salvato"}catch(e){$("fp").textContent="Salvataggio non riuscito: "+(e.message||e)}
  }
}
const SK="dl_sessions";
const loadS=()=>{try{return JSON.parse(localStorage.getItem(SK)||"[]")}catch(e){return[]}};
const saveS=a=>{try{localStorage.setItem(SK,JSON.stringify(a));return true}catch(e){$("rn").textContent="Memoria piena: elimina qualche sessione";return false}};
function renderS(){const a=loadS();$("ss").innerHTML=a.length?a.map(s=>'<div class="row"><span>'+esc(s.name)+'<br><small>'+s.n+' campioni</small></span><span><button class="s sm" data-a="d" data-i="'+s.id+'">Scarica</button> <button class="s sm" data-a="x" data-i="'+s.id+'">Elimina</button></span></div>').join(""):'<div class="l">Nessuna sessione</div>'}
$("ss").onclick=async e=>{
  const b=e.target.closest("button");if(!b)return;
  const a=loadS(),s=a.find(x=>String(x.id)===b.dataset.i);if(!s)return;
  if(b.dataset.a==="x"){saveS(a.filter(x=>x!==s));renderS()}
  else{try{await BLE.save(s.name.replace(/[^\w-]+/g,"_")+".csv",s.csv)}catch(err){$("rn").textContent="Salvataggio non riuscito: "+(err.message||err)}}
};
$("rc").onclick=()=>{
  recOn=!recOn;
  if(recOn){rec=[];$("rn").textContent="0 campioni"}
  else if(rec.length){
    const a=loadS();a.unshift({id:Date.now(),name:$("nm").value.trim()||"Sessione "+new Date().toLocaleString(),n:rec.length,csv:HDR+"\n"+rec.join("\n")});
    if(saveS(a))$("rn").textContent=rec.length+" campioni salvati";renderS();
  }
  $("rc").textContent=recOn?"Ferma e salva":"Avvia";
};
function setPaused(p){paused=p;$("pa").textContent=p?"Riprendi":"Pausa";if(!p){offs=0;cur=null}draw()}
$("pa").onclick=()=>setPaused(!paused);
$("az").onclick=()=>{alt0=lastAbs;draw()};
$("du").onchange=e=>{dur=+e.target.value;draw()};
const ptrs=new Map();let pinch0=null,drag0=null,moved=false;
const dist=()=>{const [a,b]=[...ptrs.values()];return Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY)};
$("cs").addEventListener("pointerdown",e=>{if(!e.target.matches("canvas"))return;ptrs.set(e.pointerId,e);moved=false;if(ptrs.size===2)pinch0={d:dist(),dur};drag0={x:e.clientX,offs}});
$("cs").addEventListener("pointermove",e=>{
  if(!ptrs.has(e.pointerId))return;ptrs.set(e.pointerId,e);
  if(ptrs.size===2&&pinch0){dur=Math.min(1800,Math.max(5,pinch0.dur*pinch0.d/dist()));draw()}
  else if(ptrs.size===1&&drag0){
    const dx=e.clientX-drag0.x;if(Math.abs(dx)>8)moved=true;
    if(moved){if(!paused)setPaused(true);offs=Math.max(0,Math.min(buf.length-2,Math.round(drag0.offs+dx/e.target.clientWidth*dur*SR)));draw()}
  }
});
const up=e=>{
  if(ptrs.size===1&&!moved&&e.type==="pointerup"&&e.target.matches("canvas")){const r=e.target.getBoundingClientRect(),x=(e.clientX-r.left)/r.width;cur=(cur!==null&&Math.abs(cur-x)<.04)?null:x;draw()}
  ptrs.delete(e.pointerId);pinch0=null;drag0=null;
};
$("cs").addEventListener("pointerup",up);$("cs").addEventListener("pointercancel",up);
$("b").onclick=async()=>{
  if(!BLE.ok()){st.textContent="Web Bluetooth non supportato: usa Chrome su Android (o Bluefy su iPhone)";return}
  try{
    st.textContent="Ricerca…";
    const name=await BLE.connect(onPkt,onFile,()=>{connected=false;setCtl(false);st.textContent="Disconnesso";st.style.color=""});
    connected=true;alt0=null;st.textContent="Connesso a "+name;st.style.color="var(--ok)";
  }catch(err){st.textContent="Errore: "+(err.message||err)}
};
window.addEventListener("resize",draw);
renderS();
