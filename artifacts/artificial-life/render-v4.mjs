// v4: drive studio-v4 from state_v2.jsonl. Uses results/state_v2.jsonl if it exists, else the SYNTHETIC prototype.
// MODE=still TICKS=720,780 W=3840 H=2160  |  MODE=clip W=1920 H=1080 SUB=2 FPS=12
import { chromium } from '/workspace/cqw/node_modules/playwright/index.mjs';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const A='/workspace/glitchling-jam/artifacts/artificial-life';
const REAL='/workspace/glitchling-jam/results/state_v2.jsonl', SYN='/workspace/glitchling-jam/synthetic/state_v2.synthetic.jsonl';
const real=existsSync(REAL); const src=real?REAL:SYN;
const recs=readFileSync(src,'utf8').trim().split('\n').map(l=>JSON.parse(l)); const ticks=[...new Set(recs.map(r=>r.t))].sort((a,b)=>a-b); const byT=t=>recs.filter(r=>r.t===t);
const label=real?`REAL state_v2.jsonl (${src})`:`SYNTHETIC state_v2 prototype — schema test only, not sim output (${src.split('/').pop()}); brain/glc/leak/flaw events from real activations_allflaws_seed1.json`;
const MODE=process.env.MODE??'still', W=+(process.env.W??3840), H=+(process.env.H??2160), CAM=JSON.parse(process.env.CAM??'[1.05,8.6,2.3]');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:W,height:H}}); p.setDefaultTimeout(1800000); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&!/404/.test(m.text())&&errs.push(m.text()));
await p.goto('http://localhost:3920/index.html'); await p.waitForFunction(()=>!!globalThis.buildStudio);
await p.evaluate(([W,H,label])=>{globalThis.S=buildStudio(W,H,{bloom:true,ao:true,dof:true},label)},[W,H,label]);
const apply=(rs,dt)=>p.evaluate(([rs,dt])=>S.apply(rs,dt),[rs,dt]); const render=()=>p.evaluate(c=>S.render(...c),CAM);
const meta={source:src,real,mode:MODE,W,H,errs};
if(MODE==='still'){ const want=(process.env.TICKS??'720,780').split(',').map(Number); let i=0;
  for(const t of ticks){ await apply(byT(t),1); if(want.includes(t)){ await render(); const f=`${A}/hdr/glitchling-v4-t${t}-4k.png`; writeFileSync(f,await p.screenshot({type:'png'})); console.log('still',f); } if(t>=Math.max(...want)) break; } }
else { const SUB=+(process.env.SUB??2), dir=`${A}/v4-clip-frames`; mkdirSync(dir,{recursive:true}); let n=0;
  for(let i=0;i<ticks.length-1;i++){ const a=byT(ticks[i]), bb=byT(ticks[i+1]);
    for(let s=0;s<SUB;s++){ const k=s/SUB; const rs=bb.map(r=>{const ra=a.find(x=>x.id===r.id);return ra?{...(k<0.5?ra:r),...Object.fromEntries(['body','limbs','eyes','metab','affect','field'].map(key=>[key,null]))}:null}).filter(Boolean);
      const mixed=await p.evaluate(([a,bb,k])=>bb.map(r=>{const ra=a.find(x=>x.id===r.id);if(!ra)return null;const m=lerpRec(ra,r,k);m.events=k<0.5?ra.events:r.events;m.id=r.id;m.gen=r.gen;m.t=Math.round(ra.t+(r.t-ra.t)*k);m.field.rvActive=k<0.5?ra.field.rvActive:r.field.rvActive;m.brain.motExecuted=k<0.5?ra.brain.motExecuted:r.brain.motExecuted;m.brain.motIntended=k<0.5?ra.brain.motIntended:r.brain.motIntended;m.limbs.forEach((l,j)=>{l.contact=(k<0.5?ra:r).limbs[j].contact;l.rev=(k<0.5?ra:r).limbs[j].rev});return m}).filter(Boolean),[a,bb,k]);
      await apply(mixed,1/SUB); await render(); writeFileSync(`${dir}/f${String(n++).padStart(4,'0')}.png`,await p.screenshot({type:'png'})); if(n%8==0)console.log('frame',n,ticks[i]); } }
  meta.frames=n; }
writeFileSync(`${A}/hdr/glitchling-v4-${MODE}.json`,JSON.stringify(meta,null,2)); console.log('done',JSON.stringify(meta)); await b.close();
