// Hero still: studio page (real Glitchling brain + PBR body, ACES + CQM PMREM env + bloom) at 3840x2160, flaw state from events[].
import { chromium } from '/workspace/cqw/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync } from 'node:fs';
const A='/workspace/glitchling-jam/artifacts/artificial-life', TICK=+(process.env.TICK??720);
const J=JSON.parse(readFileSync('/workspace/glitchling-jam/results/activations_allflaws_seed1.json','utf8'));
const frame=J.frames.find(f=>f.t===TICK)??J.frames.reduce((a,f)=>Math.abs(f.t-TICK)<Math.abs(a.t-TICK)?f:a);
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const p=await b.newPage({viewport:{width:3840,height:2160}}); p.setDefaultTimeout(900000); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('http://localhost:3918/index.html'); await p.waitForFunction(()=>!!globalThis.studio);
const st=await p.evaluate(([n])=>{const t=studio.tick(n);return {tick:t.tick,x:t.x,z:t.z}},[TICK-1]);
const fl=await p.evaluate(([ev,fr,t])=>studio.applyEvents(ev,fr,t),[J.events,frame,TICK]);
await p.evaluate((process_nb)=>{globalThis.NOBLOOM=!!process_nb;return studio.render(studio.view.sim.heading+0.9,6.2,3.0)},process.env.NB==='1');
const shot=await p.locator('canvas').screenshot({type:'png'}); writeFileSync(`${A}/hdr/glitchling-hero-4k.png`,shot);
writeFileSync(`${A}/hdr/glitchling-hero-4k.json`,JSON.stringify({tick:TICK,frameT:frame.t,simState:st,flawState:fl,eventsUsed:J.events.filter(e=>e.tick<=TICK&&TICK-e.tick<30).map(e=>({tick:e.tick,type:e.type})),errs},null,2));
console.log('done',JSON.stringify(fl),errs.length); await b.close();
