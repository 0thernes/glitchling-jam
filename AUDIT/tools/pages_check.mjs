// Headless page check used by the audit: loads every page at phone (390x844) and desktop (1280x800) sizes and reports console
// errors, failed requests, horizontal overflow and a screenshot. Usage: BASE=http://127.0.0.1:8000/ OUT=shots PLAYWRIGHT=/path/to/playwright/index.mjs node AUDIT/tools/pages_check.mjs
const { chromium } = await import(process.env.PLAYWRIGHT || 'playwright');
const base=process.env.BASE||'http://127.0.0.1:8000/'; const pages=(process.argv[2]||',live/,play/,site/,brain-viz/').split(',');
const browser = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const out={};
for (const p of pages) for (const [name,vp] of [['phone',{width:390,height:844}],['desktop',{width:1280,height:800}]]) {
  const ctx = await browser.newContext({viewport:vp,isMobile:name==='phone',hasTouch:name==='phone'}); const page=await ctx.newPage(); const errs=[], warns=[], bad=[];
  page.on('console',m=>{ if(m.type()==='error') errs.push(m.text().slice(0,300)); if(m.type()==='warning') warns.push(m.text().slice(0,200)); });
  page.on('pageerror',e=>errs.push('pageerror: '+e.message.slice(0,300)));
  page.on('response',r=>{ if(r.status()>=400) bad.push(r.status()+' '+r.url()); });
  page.on('requestfailed',r=>bad.push('FAILED '+r.url()+' '+(r.failure()?.errorText||'')));
  try { await page.goto(base+p,{waitUntil:'load',timeout:60000}); await page.waitForTimeout(+process.env.WAIT||8000);
    const sw = await page.evaluate(()=>({sw:document.documentElement.scrollWidth, cw:document.documentElement.clientWidth, title:document.title}));
    await page.screenshot({path:`${process.env.OUT||'.'}/${(p||'root').replace(/\W/g,'')}-${name}.png`});
    out[p+'|'+name]={errs,warns:warns.slice(0,5),bad,...sw};
  } catch(e){ out[p+'|'+name]={fatal:e.message.slice(0,300),errs,bad}; }
  await ctx.close(); }
await browser.close(); console.log(JSON.stringify(out,null,1));
