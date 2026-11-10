// Headless check of the in-page lineage evolution: opens the lab tab, runs the evolution, waits for generations, adopts, screenshots.
const { chromium } = (await import(process.env.PLAYWRIGHT || 'playwright')).default ?? (await import(process.env.PLAYWRIGHT || 'playwright'));
const url = process.argv[2] || 'http://127.0.0.1:8899/live/'; const out = process.argv[3] || '/workspace/glitchling-jam/live-shots'; const tag = process.argv[4] || 'lineage'; const W = +(process.argv[5] || 240);
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } }); const errs = []; page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.goto(url + '?seed=2&speed=0.25', { waitUntil: 'load' }); await page.waitForTimeout(3000);
const t0 = Date.now(); await page.evaluate(() => document.getElementById('evo-run').click());
await page.waitForFunction(() => !document.getElementById('evo-adopt').disabled, null, { timeout: W * 1000 }).catch(() => {});
const secs = (Date.now() - t0) / 1000; const log = await page.evaluate(() => document.getElementById('evo-log').innerText);
await page.click('#panel-btn').catch(() => {}); await page.evaluate(() => { const b = [...document.querySelectorAll('[data-tab],[data-pane-btn],button')].find((x) => /^lesions$/i.test(x.textContent.trim())); b?.click(); }); await page.waitForTimeout(800);
await page.evaluate(() => document.getElementById("evo-log").scrollIntoView()); await page.screenshot({ path: `${out}/${tag}-desktop-lab.png` });
await page.evaluate(() => document.getElementById('evo-adopt').click()); await page.waitForTimeout(4000); const after = await page.evaluate(() => ({ log: document.getElementById('evo-log').innerText, saved: !!localStorage.getItem('glv2.genome'), t: window.glitch.cr.t, dist: window.glitch.cr.stats.dist }));
console.log(JSON.stringify({ secs, log, after, errors: errs }, null, 1)); await browser.close();
