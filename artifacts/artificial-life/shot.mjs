import { chromium } from '/workspace/cqw/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const dir='/workspace/glitchling-jam/artifacts/artificial-life';
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width:900, height:560 } }); p.setDefaultTimeout(600000);
const cdp = await p.context().newCDPSession(p); const errs=[]; p.on('pageerror',e=>errs.push(e.message.slice(0,200)));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const shot=async n=>{const {data}=await cdp.send('Page.captureScreenshot',{format:'png'});writeFileSync(`${dir}/${n}.png`,Buffer.from(data,'base64'));console.log('shot',n);};
await p.goto('http://localhost:3917/?world=mini',{waitUntil:'commit'});
for(let i=0;i<120;i++){await sleep(5000);const ok=await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Enter the world/.test(x.textContent));if(b)b.click();return !!globalThis.__glitchling && (globalThis.__glitchling.sim.tickN>0)}).catch(()=>false);if(ok)break;}
await sleep(30000); await shot('glitchling-mini-world');
// aim camera at the glitchling for a close-up
await p.evaluate(()=>{const g=globalThis.__glitchling, c=window.world?.engine?.camera; if(!g||!c)return; const s=g.sim; c.position.set(s.x+4,6,s.z+6); c.lookAt(s.x,1.5,s.z);}).catch(()=>{});
await sleep(1500); await shot('glitchling-closeup');
const st=await p.evaluate(()=>{const s=globalThis.__glitchling?.sim;return s&&{ticks:s.tickN,x:s.x,z:s.z,counts:s.counts,actions:s.actions,eaten:s.eaten}}).catch(e=>String(e));
writeFileSync(`${dir}/glitchling-browser-state.json`,JSON.stringify({st,errs:errs.slice(0,10)},null,2)); console.log(JSON.stringify(st),errs.length);
await b.close();
