// v3 hero: studio-v3 page in headless Chrome (SwiftShader). Flaw state from events[] at TICK; neurons from frame rate[].
import { chromium } from '/workspace/cqw/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const A='/workspace/glitchling-jam/artifacts/artificial-life', TICK=+(process.env.TICK??720);
const W=+(process.env.W??3840), H=+(process.env.H??2160), OUT=process.env.OUT??`${A}/hdr/glitchling-hero-v3-4k.png`;
const opts={bloom:process.env.BLOOM!=='0',ao:process.env.AO!=='0',dof:process.env.DOF!=='0'};
const J=JSON.parse(readFileSync('/workspace/glitchling-jam/results/activations_allflaws_seed1.json','utf8'));
const frame=J.frames.find(f=>f.t===TICK);
const near=(type,w)=>J.events.filter(e=>e.type===type&&e.tick<=TICK&&TICK-e.tick<w), decay=es=>es.length?Math.max(...es.map(e=>0.93**(TICK-e.tick))):0;
const mr=near('motor_reversal',30), last=mr.at(-1);
const inp={frame:{t:frame.t,rate:frame.rate,regions:frame.regions},glow:{scramble:decay(near('sensor_shuffle',30)),backwards:decay(mr),misfire:decay(near('misfire',30)),leaky:1},intended:last?.intended??null,executed:last?.executed??null};
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:W,height:H}}); p.setDefaultTimeout(1200000); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:3919/index.html'); await p.waitForFunction(()=>!!globalThis.buildHero);
const t0=Date.now();
const r=await p.evaluate(([W,H,inp,opts,cam])=>{const h=buildHero(W,H,inp,opts);return h.render(...cam)},[W,H,inp,opts,JSON.parse(process.env.CAM??'[0.95,6.4,2.4]')]);
writeFileSync(OUT,await p.locator('canvas').screenshot({type:'png'}));
writeFileSync(OUT.replace(/\.png$/,'.json'),JSON.stringify({tick:TICK,W,H,opts,glow:inp.glow,intended:inp.intended,executed:inp.executed,post:r,renderSecs:(Date.now()-t0)/1000,events:J.events.filter(e=>e.tick<=TICK&&TICK-e.tick<30).map(e=>({tick:e.tick,type:e.type})),errs},null,2));
console.log('done',(Date.now()-t0)/1000,'s',JSON.stringify(r),errs); await b.close();
