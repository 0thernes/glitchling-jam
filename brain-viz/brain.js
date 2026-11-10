// Glitchling brain viz — SIMULATED. Real MLP forward passes on seeded random weights.
(()=>{
let s=0x6c17c41;const rnd=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return((s>>>0)/4294967296)};
const gauss=()=>Math.sqrt(-2*Math.log(rnd()+1e-9))*Math.cos(6.283*rnd());
const SIZES=[24,222,189,32,195,195,8];
const L=[];for(let k=0;k<SIZES.length-1;k++){const i=SIZES[k],o=SIZES[k+1],W=new Float32Array(i*o),sc=1.6/Math.sqrt(i);for(let j=0;j<W.length;j++)W[j]=gauss()*sc;L.push({i,o,W,b:new Float32Array(o).map(()=>gauss()*0.1)})}
const acts=SIZES.map(n=>new Float32Array(n));
const SENS=["eyeL","eyeR","ear","smell","touch","heat","hunger","pain"];const MOT=["legL","legR","tail","jaw","blink","hop","purr","flee"];
const perm=[...Array(24).keys()];const memory=new Float32Array(32);
let leaked=0,sparks=[],mutations=0,t=0;
const $=id=>document.getElementById(id);
const c=$("c"),g=c.getContext("2d");let W_,H_;
function rs(){W_=c.width=innerWidth;H_=c.height=innerHeight}addEventListener("resize",rs);rs();
function pos(k,j){const n=SIZES[k],x=W_*(0.08+0.84*k/(SIZES.length-1)),top=H_*0.2,h=H_*0.68;return[x,top+h*(n===1?.5:j/(n-1))]}
function step(){t++;
 const raw=new Float32Array(24);for(let j=0;j<24;j++)raw[j]=Math.sin(t*0.03*(1+j%8*0.3)+j)*0.8+gauss()*0.1;
 if($("g0").checked&&t%90===0){const a=rnd()*24|0,b=rnd()*24|0;[perm[a],perm[b]]=[perm[b],perm[a]]}
 if(!$("g0").checked)perm.sort((a,b)=>a-b);
 for(let j=0;j<24;j++)acts[0][j]=raw[perm[j]];
 for(let k=0;k<L.length;k++){const{i,o,W,b}=L[k],x=acts[k],y=acts[k+1];for(let q=0;q<o;q++){let z=b[q];for(let p=0;p<i;p++)z+=W[q*i+p]*x[p];y[q]=Math.tanh(z)}
  if(k===2){const leak=$("g1").checked?0.06:0.005;leaked=0;for(let q=0;q<32;q++){const before=memory[q];memory[q]=memory[q]*(1-leak)+y[q]*0.05;leaked+=Math.abs(before)*leak;y[q]=0.5*y[q]+memory[q]*4;
   if($("g1").checked&&rnd()<0.08){const p=pos(3,q);sparks.push({x:p[0],y:p[1],vx:(rnd()-.5)*0.5,vy:1+rnd(),life:60,col:"#5cf",drip:1})}}}}
 if($("g2").checked)for(let q=0;q<8;q++)acts[6][q]*=-1;
 if($("g3").checked&&rnd()<0.12){const k=rnd()*L.length|0,Lk=L[k],q=rnd()*Lk.W.length|0;Lk.W[q]+=gauss()*1.5;mutations++;
  const o=(q/Lk.i)|0,[x,y]=pos(k+1,o);for(let n=0;n<26;n++){const a=rnd()*6.283,v=1+rnd()*4;sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:30+rnd()*30,col:rnd()<.5?"#ff5cf0":"#ffe14d"})}}
}
function col(v,a){return v>0?`rgba(255,${120-80*v|0},${200},${a})`:`rgba(80,${200},255,${a})`}
function draw(){g.fillStyle="rgba(7,4,13,0.35)";g.fillRect(0,0,W_,H_);
 // edges: sample strongest-ish
 g.lineWidth=0.6;for(let k=0;k<L.length;k++){const{i,o,W}=L[k];for(let e=0;e<70;e++){const p=(e*7919+k*31)%i,q=(e*104729+k*17)%o,v=acts[k][p]*W[q*i+p];if(Math.abs(v)<0.15)continue;
  const[a,b]=pos(k,p),[cx,cy]=pos(k+1,q);g.strokeStyle=col(Math.sign(v),Math.min(.5,Math.abs(v)*.6));g.beginPath();g.moveTo(a,b);g.lineTo(cx,cy);g.stroke()}}
 // scrambled sensor wiring
 for(let j=0;j<24;j++){const[x,y]=pos(0,j),sy=H_*0.2+H_*0.68*perm[j]/23;const bad=perm[j]!==j;
  g.strokeStyle=bad?"rgba(255,60,90,.9)":"rgba(140,255,170,.5)";g.setLineDash(bad?[3,3]:[]);g.beginPath();g.moveTo(18,sy);g.bezierCurveTo(x*0.5,sy,x*0.5,y,x,y);g.stroke();g.setLineDash([]);
  g.fillStyle=bad?"#ff5d7a":"#9fa";g.fillText((bad?"⚠":"")+SENS[perm[j]%8]+(perm[j]>>3),2,sy-2)}
 for(let k=0;k<SIZES.length;k++){for(let j=0;j<SIZES[k];j++){const[x,y]=pos(k,j),v=acts[k][j],r=SIZES[k]>100?1.6:3.5;g.fillStyle=col(v,0.25+0.75*Math.abs(v));g.beginPath();g.arc(x+(Math.random()<.01?(Math.random()-.5)*8:0),y,r+Math.abs(v)*2,0,6.283);g.fill()}
  const[x]=pos(k,0);g.fillStyle="#b9a6e8";g.fillText(["senses","hidden1","hidden2","MEMORY (leaky)","inner1","inner2","motors"][k]+" ·"+SIZES[k],x-30,H_*0.2-14)}
 // memory bar
 const[mx]=pos(3,0);for(let q=0;q<32;q++){const[,y]=pos(3,q);g.fillStyle="rgba(90,200,255,.6)";g.fillRect(mx+8,y-2,Math.abs(memory[q])*80,4)}
 // motors reversed
 for(let q=0;q<8;q++){const[x,y]=pos(6,q),v=acts[6][q],rev=$("g2").checked;g.fillStyle=rev?"#ffb84d":"#9fa";
  g.fillText(MOT[q]+(rev?" ⟲ REVERSED":""),x+10,y+4);g.fillStyle=col(v,.8);g.fillRect(x+10,y+7,v*40,4);if(rev){g.strokeStyle="#ffb84d";g.strokeRect(x+10,y+7,-v*40,4)}}
 for(const p of sparks){p.x+=p.vx;p.y+=p.vy;if(!p.drip)p.vy+=0.05;p.life--;g.fillStyle=p.col;g.globalAlpha=Math.max(0,p.life/60);g.fillRect(p.x,p.y,2,2+(p.drip?4:0))}g.globalAlpha=1;sparks=sparks.filter(p=>p.life>0);
 if(Math.random()<0.04){const y=Math.random()*H_,h=4+Math.random()*20;g.drawImage(c,0,y,W_,h,(Math.random()-.5)*30,y,W_,h)}
 $("stats").textContent=`tick ${t} · sensors miswired ${perm.filter((v,i)=>v!==i).length}/24 · memory leaked ${leaked.toFixed(3)}/tick · mutation misfires ${mutations}`;
}

// ---------- REAL mode: playback of results/activations_allflaws_seed1.json ----------
const D=window.GLITCHLING_REAL;
// Region layout from core/organism.ts REGIONS (CTX = CE+4*KI = 64 here); verified: per-region mean of `rate` equals the file's `regions` value in all 144 frames.
const RG=[["SENS",16],["THAL",16],["CTX",64],["HIP",32],["STR",32],["HYP",16],["VTA",6],["RAPHE",6],["LC",6],["BF",6],["INS",8],["SCN",8],["MOT",8],["ENS",48]];
let mode=(D&&D.frames&&D.frames.length)?"real":"sim",fi=0,ft=0,prevW=null,rsparks=[];
const sumN=RG.reduce((a,r)=>a+r[1],0);
function setMode(m){mode=m;$("mReal").className=m==="real"?"on":"";$("mSim").className=m==="sim"?"on":"";$("simctl").style.display=m==="sim"?"":"none";
 if(m==="real"){$("banner").textContent="REAL DATA — results/activations_allflaws_seed1.json (all flaws on, seed 1)";$("banner").style.background="#16a34a";
  $("sub").innerHTML=`Glitchling spiking brain from core/organism.ts: ${D.nNeurons} neurons in 14 regions, ${D.frames.length} frames (t=${D.frames[0].t}..${D.frames[D.frames.length-1].t}, every 10 ticks). Mapping = REGIONS order (sums to ${sumN}).<br><span style="color:#ffb84d">≠ Creature #1 canvas MLP (24→222→189→32 / 32→195→195→8): that layout does not apply; this file is a different, region-based brain.</span>`;g.fillStyle="#07040d";g.fillRect(0,0,W_,H_);}
 else{$("banner").textContent="SIMULATED DATA — not real Glitchling activations";$("banner").style.background="#ff2d55";$("sub").textContent="Toy MLP shaped like Creature #1 (outer 24→222→189→32, inner 32→195→195→8, tanh), seeded random weights";}}
$("mReal").onclick=()=>{if(D)setMode("real")};$("mSim").onclick=()=>setMode("sim");if(!D)$("mReal").disabled=true;
function drawReal(){const f=D.frames[fi];g.fillStyle="rgba(7,4,13,0.5)";g.fillRect(0,0,W_,H_);
 const x0=40,x1=W_*0.62,top=H_*0.24,h=H_*0.6,colW=(x1-x0)/RG.length;let o=0;
 RG.forEach(([n,k],ri)=>{const cx=x0+colW*(ri+.5),cols=k>16?4:2,rows=Math.ceil(k/cols),dy=Math.min(14,h/rows);
  for(let j=0;j<k;j++){const v=f.rate[o+j],x=cx+((j%cols)-(cols-1)/2)*9,y=top+((j/cols)|0)*dy;g.fillStyle=`hsla(${300-200*v},100%,${20+45*v}%,${0.3+0.7*v})`;g.beginPath();g.arc(x,y,2+v*3.5,0,6.283);g.fill()}
  g.fillStyle=n==="SENS"?"#ff5d7a":n==="HIP"?"#5cf":n==="MOT"?"#ffb84d":"#b9a6e8";g.fillText(n,cx-12,top-22);g.fillText((f.regions[n]).toFixed(2),cx-12,top-10);
  g.fillStyle="rgba(185,166,232,.5)";g.fillRect(cx-10,top+h+8,20,-f.regions[n]*50);o+=k});
 // glitch annotations (flaw mechanics are from glitchling.ts; the file logs only rates, wSite, glc)
 g.fillStyle="#ff5d7a";g.fillText("⚠ SENS: site channels read through a fixed shuffle + noise (scramble on; permutation not logged)",x0,H_*0.94);
 g.fillStyle="#ffb84d";g.fillText("⟲ MOT: body goes to mirror site 15−k (backwards on; choices not logged)",x0,H_*0.94+14);
 // wSite: perceived site values, the leaky memory
 const wx=W_*0.68,ww=W_*0.28;g.fillStyle="#5cf";g.fillText("wSite — learned site values (leak pulls each toward 0.25 every tick)",wx,top-22);
 const by=top+h*0.45;g.strokeStyle="rgba(92,204,255,.4)";g.beginPath();g.moveTo(wx,by-0.25*h*0.4);g.lineTo(wx+ww,by-0.25*h*0.4);g.stroke();g.fillText("prior 0.25",wx+ww-60,by-0.25*h*0.4-3);
 f.wSite.forEach((v,k)=>{const bw=ww/16,x=wx+k*bw;g.fillStyle="#5cf";g.fillRect(x+1,by,bw-2,-v*h*0.4);
  const d=prevW?v-prevW[k]:0;if(Math.abs(d)>0.05){g.fillStyle="#ffe14d";for(let n=0;n<(ft===0?18:0);n++){const a=Math.random()*6.283,s2=1+Math.random()*3;rsparks.push({x:x+bw/2,y:by-v*h*0.4,vx:Math.cos(a)*s2,vy:Math.sin(a)*s2,life:40,col:Math.random()<.5?"#ff5cf0":"#ffe14d"})}}
  if(d<-0.001&&d>-0.05&&Math.random()<.15)rsparks.push({x:x+bw/2,y:by-v*h*0.4,vx:0,vy:1,life:40,col:"#5cf",drip:1});
  g.fillStyle="#9ab";g.fillText(k,x+2,by+12)});
 g.fillStyle="#ffe14d";g.fillText("✦ sparks = jump >0.05 in a site value between frames (consistent with a misfire jolt; misfires fire every 60 ticks)",wx,by+30);
 const mf=f.t%60===0;if(mf){g.fillStyle="#ff5cf0";g.fillText("t%60==0 → scheduled misfire tick",wx,by+46)}
 // glucose trace
 const gy=H_*0.8;g.strokeStyle="#9fa";g.beginPath();D.frames.forEach((q,i)=>{const x=wx+ww*i/(D.frames.length-1),y=gy-q.glc*12;i?g.lineTo(x,y):g.moveTo(x,y)});g.stroke();
 g.fillStyle="#fff";g.fillRect(wx+ww*fi/(D.frames.length-1)-1,gy-90,2,95);g.fillStyle="#9fa";g.fillText("blood glucose (glc) — "+f.glc,wx,gy+16);
 for(const p of rsparks){p.x+=p.vx;p.y+=p.vy;p.life--;g.fillStyle=p.col;g.globalAlpha=Math.max(0,p.life/40);g.fillRect(p.x,p.y,2,p.drip?6:2)}g.globalAlpha=1;rsparks=rsparks.filter(p=>p.life>0);
 $("stats").textContent=`frame ${fi+1}/${D.frames.length} · tick ${f.t} · mean rate ${(f.rate.reduce((a,b)=>a+b,0)/f.rate.length).toFixed(3)} · glc ${f.glc}`;
 if(++ft>=8){ft=0;prevW=f.wSite;fi=(fi+1)%D.frames.length;if(fi===0)prevW=null}}
const q=new URLSearchParams(location.search);if(q.get("mode")==="sim")mode="sim";if(q.get("frame"))fi=Math.min(+q.get("frame"),(D?D.frames.length:1)-1);
setMode(mode);
function loop(){if(mode==="real")drawReal();else{step();draw()}requestAnimationFrame(loop)}for(let i=0;i<200;i++)step();loop();
})();
