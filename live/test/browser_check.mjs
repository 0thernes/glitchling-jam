// Headless Chromium check: console errors, fps, motion via neurons (MN lesion), screenshots at phone and desktop sizes.
const { chromium } = (await import(process.env.PLAYWRIGHT || 'playwright')).default ?? (await import(process.env.PLAYWRIGHT || 'playwright'));
const url = process.argv[2] || 'http://127.0.0.1:8899/live/'; const out = process.argv[3] || '/workspace/glitchling-jam/live-shots'; const tag = process.argv[4] || 'stage';
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const res = {};
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['desktop', { width: 1280, height: 800 }]]) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1, isMobile: name === 'phone', hasTouch: name === 'phone' }); const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
  await page.goto(url + '?seed=3', { waitUntil: 'load' }); await page.waitForTimeout(9000);
  const s1 = await page.evaluate(() => ({ fps: window.glitch.stats.fps, q: window.glitch.stats.quality, simMs: window.glitch.stats.simMs, stepMs: window.glitch.stats.stepMs, brain: window.glitch.cr.brain.N, renderMs: window.glitch.stats.renderMs, dist: window.glitch.cr.stats.dist, t: window.glitch.cr.t }));
  await page.screenshot({ path: `${out}/${tag}-${name}.png` });
  // motion check: 6 sim-seconds intact vs 6 sim-seconds with all motor neurons lesioned (stepped directly, deterministic)
  const m = await page.evaluate(() => { const cr = window.glitch.cr; const run = (n) => { const d0 = cr.stats.dist; for (let i = 0; i < n; i++) cr.step(); return cr.stats.dist - d0; }; const a = run(600); cr.lesion.mn = true; run(180); const b = run(600); cr.lesion.mn = false; run(300); cr.lesion.mot = true; run(180); const c = run(600); cr.lesion.mot = false; return { intact: a, mnLesioned: b, motLesioned: c }; });
  await page.click('#panel-btn'); await page.waitForTimeout(1500); await page.screenshot({ path: `${out}/${tag}-${name}-brain.png` });
  res[name] = { ...s1, motion: m, errors: errs }; await page.close(); }
await browser.close(); console.log(JSON.stringify(res, null, 1));
