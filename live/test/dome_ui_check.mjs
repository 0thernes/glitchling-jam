// Headless-Chrome check of the live page (Three.js Dome + p5.js + HEPTARCH HUD) over the DevTools protocol.
// Needs Node >= 22 (global WebSocket). Usage: CHROME=/path/to/chrome node test/dome_ui_check.mjs [outDir]
// Exit code 1 on any console error, page error, or NaN/undefined in the Dome or Mind HUD.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT_DIR = process.argv[2] || path.join(os.tmpdir(), 'glitchling-ui-check');
fs.mkdirSync(OUT_DIR, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  let rel = decodeURIComponent(u.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const fp = path.join(ROOT, rel);
  if (!fp.startsWith(ROOT) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream' });
  fs.createReadStream(fp).pipe(res);
});

await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const liveUrl = `http://127.0.0.1:${port}/live/?seed=3&q=high`;

const userDataDir = path.join(OUT_DIR, 'chrome-profile-' + Date.now());
const dbgPort = 9345;
const chrome = spawn(process.env.CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new',
  `--remote-debugging-port=${dbgPort}`,
  `--user-data-dir=${userDataDir}`,
  '--window-size=1440,900',
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let targets = null;
for (let i = 0; i < 40; i++) {
  try {
    const resp = await fetch(`http://127.0.0.1:${dbgPort}/json/list`);
    targets = await resp.json();
    if (targets.length > 0) break;
  } catch {}
  await sleep(250);
}
const pageTarget = targets.find((t) => t.type === 'page');
const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true });
  ws.addEventListener('error', reject, { once: true });
});

let msgId = 0;
const pending = new Map();
const consoleErrors = [];
const pageErrors = [];

ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(msg.error.message));
    else resolve(msg.result);
  } else if (msg.method === 'Runtime.consoleAPICalled') {
    if (msg.params.type === 'error') {
      consoleErrors.push(msg.params.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  } else if (msg.method === 'Runtime.exceptionThrown') {
    pageErrors.push(msg.params.exceptionDetails?.text + ' ' + (msg.params.exceptionDetails?.exception?.description || ''));
  }
});

const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++msgId;
  pending.set(id, { resolve, reject });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url: liveUrl });
await sleep(7500);

const evalJS = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};

// Capture hero 3D Biodome scene screenshot
const shot1 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(OUT_DIR, 'pass21-dome-hero.png'), Buffer.from(shot1.data, 'base64'));

// Open Lab panel -> switch to Dome tab -> inspect stats & buttons -> switch p5 studio tabs
const uiAudit = await evalJS(`(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector('#panel-btn')?.click();
  await wait(400);
  document.querySelector('[data-tab="dome"]')?.click();
  await wait(800);
  const domeHtmlBefore = document.querySelector('#domestats')?.innerText || '';
  const barsCount = document.querySelectorAll('#heptarch-bars .bar').length;

  // Test interactive Dome controls (#dome-storm, #dome-refuge, #dome-trauma)
  document.querySelector('#dome-storm')?.click();
  document.querySelector('#dome-trauma')?.click();
  document.querySelector('#dome-refuge')?.click();
  await wait(700);
  // Restore refuge immunity ON
  document.querySelector('#dome-refuge')?.click();
  await wait(400);

  // Cycle p5 Studio modes (pip -> map & quantum tabs)
  const p5Btn = document.querySelector('#p5-btn');
  if (p5Btn) p5Btn.click();
  await wait(400);
  for (const tab of document.querySelectorAll('#p5-tabs button')) {
    tab.click();
    await wait(200);
  }

  // Switch to honesty/about tab briefly to verify text renders cleanly, then back to dome
  document.querySelector('[data-tab="about"]')?.click();
  await wait(300);
  const realItems = document.querySelectorAll('#real-list li').length;
  const simpItems = document.querySelectorAll('#simp-list li').length;
  document.querySelector('[data-tab="mind"]')?.click();
  await wait(350);
  const mindText = document.querySelector('#mindstats')?.innerText || '';
  document.querySelector('[data-tab="dome"]')?.click();
  await wait(400);

  const domeTextAfter = document.querySelector('#domestats')?.innerText || '';
  const g = window.glitch;
  return {
    fps: g?.stats?.fps,
    stepMs: g?.stats?.stepMs,
    renderMs: g?.stats?.renderMs,
    t: g?.cr?.t,
    brainN: g?.cr?.brain?.N,
    barsCount,
    hasNaN: domeTextAfter.includes('NaN') || domeTextAfter.includes('undefined') || mindText.includes('NaN') || mindText.includes('undefined'),
    auroraStorm: g?.cr?.world?.dome?.auroraStorm,
    limb0Integrity: g?.cr?.heptarch?.limbIntegrity?.[0],
    refugeOn: g?.cr?.eco?.refugeImmunityEnabled,
    xenomimics: g?.cr?.eco?.xenomimics?.length,
    xylos: g?.cr?.eco?.xylos?.length,
    titans: g?.cr?.eco?.titans?.length,
    shoggoths: g?.cr?.eco?.shoggoths?.length,
    realItems,
    simpItems,
    domeSample: domeTextAfter.slice(0, 520),
    mindSample: mindText.slice(0, 420),
  };
})()`);

const shot2 = await send('Page.captureScreenshot', { format: 'png' });
fs.writeFileSync(path.join(OUT_DIR, 'pass21-dome-panel.png'), Buffer.from(shot2.data, 'base64'));

ws.close();
chrome.kill();
server.close();
setTimeout(() => {
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  console.log(JSON.stringify({ consoleErrors, pageErrors, uiAudit }, null, 2));
  process.exit(consoleErrors.length || pageErrors.length || uiAudit.hasNaN ? 1 : 0);
}, 500);
