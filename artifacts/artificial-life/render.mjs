// Headless Chrome (SwiftShader) capture of the real CQM Mini World with the Glitchling. Clip at 1280x720, stills at 3840x2160.
import { chromium } from '/workspace/cqw/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
const dir='/workspace/glitchling-jam/artifacts/artificial-life'; const FRAMES=+(process.env.FRAMES??48);
const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width:1280, height:720 } }); p.setDefaultTimeout(900000); p.on('crash',()=>console.log('PAGE CRASHED'));
const cdp = await p.context().newCDPSession(p); const errs=[]; p.on('pageerror',e=>{errs.push(e.message.slice(0,200));console.log('PAGEERR',e.message.slice(0,300))});
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const log=(...a)=>console.log(new Date().toTimeString().slice(0,8),...a);
const shot=async f=>{const {data}=await cdp.send('Page.captureScreenshot',{format:'png'});writeFileSync(f,Buffer.from(data,'base64'));};
const aim=(az,dist,h)=>p.evaluate(([az,dist,h])=>{const g=globalThis.__glitchling,c=window.world?.engine?.camera;if(!g||!c)return 'no';const v=g.body.position;c.position.set(v.x+Math.cos(az)*dist,h,v.z+Math.sin(az)*dist);c.lookAt(v.x,1.1,v.z);c.updateMatrixWorld();return 'ok'},[az,dist,h]);
const raf=()=>p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
await p.goto('http://localhost:3917/?world=mini',{waitUntil:'commit'});
for(let i=0;i<150;i++){await sleep(4000);const ok=await p.evaluate(()=>{const b=[...document.querySelectorAll('button')].find(x=>/Enter the world/.test(x.textContent));if(b)b.click();return (globalThis.__glitchling?.sim?.g?.t??0)>0}).catch(()=>false);if(ok)break; if(i%5==0)log('wait',i,await p.evaluate(()=>[!!window.world,typeof globalThis.__glitchling,globalThis.__glitchling?.sim?.g?.t]).catch(e=>String(e).slice(0,80)));}
// hide HUD panels for clean renders
await p.addStyleTag({content:'body > *:not(canvas):not(:has(canvas)){visibility:hidden!important} canvas{visibility:visible!important}'}).catch(()=>{});
log('entered'); await sleep(20000);
const states=[];
for(let f=0;f<FRAMES;f++){ await aim(0.6+f*0.05,6.5,3.2); await raf(); await aim(0.6+f*0.05,6.5,3.2); await shot(`${dir}/clip-frames/f${String(f).padStart(3,'0')}.png`);
  states.push(await p.evaluate(()=>{const g=globalThis.__glitchling;const l=g?.last;return l&&{tick:l.tick,x:+l.x.toFixed(2),z:+l.z.toFixed(2),action:l.action,fired:l.fired,glc:+l.glc.toFixed(3)}}).catch(()=>null)); if(f%8==0) log('frame',f); }
await p.setViewportSize({width:3840,height:2160}); await sleep(5000);
for (const [n,az,d,h] of [['glitchling-4k-hero',0.9,5,2.6],['glitchling-4k-brain',2.2,3.2,3.4]]) { await aim(az,d,h); await raf(); await raf(); await aim(az,d,h); await raf(); await shot(`${dir}/${n}.png`); log('still',n); }
const st=await p.evaluate(()=>{const s=globalThis.__glitchling?.sim;return s&&{ticks:s.g.t,counts:s.counts,forages:s.g.foraged,rewards:s.g.rewards,jolts:s.g.jolts,tone:window.world?.engine?.renderer?.toneMapping,exposure:window.world?.engine?.renderer?.toneMappingExposure}}).catch(e=>String(e));
writeFileSync(`${dir}/glitchling-browser-state.json`,JSON.stringify({final:st,clipFrames:states,errs:errs.slice(0,10)},null,2)); log(JSON.stringify(st),'errs',errs.length); await b.close();
