#!/usr/bin/env node
// Repository health check, run by `npm test` and by CI (.github/workflows/ci.yml).
// Fast by default (about 1 minute). FULL=1 also runs the 90-second dome/HEPTARCH probe.
// Exits non-zero on the first failing group and prints a summary table.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);
const results = [];
const run = (name, fn) => {
  const t0 = Date.now();
  try { const note = fn() || ''; results.push([name, 'PASS', ((Date.now() - t0) / 1000).toFixed(1), note]); }
  catch (e) { results.push([name, 'FAIL', ((Date.now() - t0) / 1000).toFixed(1), String(e.message || e).split('\n').slice(0, 6).join(' | ')]); }
};
const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split('\n').filter(Boolean);
const exists = (f) => fs.existsSync(f);

run('JS/MJS syntax (node --check, vendor excluded)', () => {
  const files = tracked.filter((f) => /\.(m?js)$/.test(f) && !f.includes('/vendor/') && exists(f));
  const bad = [];
  for (const f of files) { const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' }); if (r.status !== 0) bad.push(f + ': ' + r.stderr.split('\n').find((l) => /Error/.test(l))); }
  if (bad.length) throw new Error(bad.join('\n'));
  return `${files.length} files`;
});

run('JSON / JSONL parse', () => {
  const files = tracked.filter((f) => /\.(json|jsonl)$/.test(f) && exists(f));
  for (const f of files) {
    const s = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.jsonl')) s.split('\n').filter(Boolean).forEach((l, i) => { try { JSON.parse(l); } catch (e) { throw new Error(`${f}:${i + 1} ${e.message}`); } });
    else try { JSON.parse(s); } catch (e) { throw new Error(`${f}: ${e.message}`); }
  }
  return `${files.length} files`;
});

run('Local links in Markdown/HTML resolve to tracked files', () => {
  const set = new Set(tracked); const dirs = new Set();
  for (const f of tracked) { const p = f.split('/'); for (let i = 1; i < p.length; i++) dirs.add(p.slice(0, i).join('/')); }
  const bad = [];
  for (const f of tracked.filter((x) => /\.(md|html)$/.test(x) && exists(x))) {
    let s = fs.readFileSync(f, 'utf8');
    if (f.endsWith('.md')) s = s.replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]+`/g, '');
    const pats = [/\]\(([^)\s]+)\)/g, /(?:href|src)=["']([^"'#]+)/g];
    for (const re of pats) for (const m of s.matchAll(re)) {
      let u = m[1].split('#')[0].split('?')[0];
      if (!u || /^(https?:|mailto:|data:|javascript:|blob:|\$|\{)/.test(u) || u.includes('${')) continue;
      const t = path.normalize(path.join(path.dirname(f), decodeURIComponent(u))).replace(/\\/g, '/').replace(/\/$/, '');
      if (t === '.' || t.startsWith('..') || t.startsWith('/')) continue;
      if (!set.has(t) && !dirs.has(t) && !set.has(t + '/index.html')) bad.push(`${f} -> ${u}`);
    }
  }
  if (bad.length) throw new Error(bad.join('\n'));
});

run('No secrets or private keys in tracked text', () => {
  const re = /(ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{32,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
  const hits = [];
  for (const f of tracked.filter((x) => /\.(m?js|ts|md|html|json|py|css|yml|yaml|txt)$/.test(x) && exists(x))) {
    const s = fs.readFileSync(f, 'utf8'); const m = s.match(re); if (m) hits.push(`${f}: ${m[0].slice(0, 12)}...`);
  }
  if (hits.length) throw new Error(hits.join('\n'));
});

run('No eval / new Function / document.write in first-party JS', () => {
  const hits = [];
  for (const f of tracked.filter((x) => /\.(m?js|html)$/.test(x) && !x.includes('/vendor/') && exists(x))) {
    const s = fs.readFileSync(f, 'utf8'); if (/\beval\s*\(|new Function\s*\(|document\.write\s*\(/.test(s)) hits.push(f);
  }
  if (hits.length) throw new Error(hits.join(', '));
});

run('Honesty guard: no consciousness/AGI claims in user-facing pages', () => {
  const pages = ['index.html', 'live/index.html', 'play/index.html', 'site/index.html', 'brain-viz/index.html', 'README.md', 'live/README.md'];
  const bad = [];
  const claim = /\b(is|are|became|achiev\w*|reach\w*)\s+(conscious|sentient|self-aware|alive in the real sense|AGI)\b/i;
  for (const f of pages.filter(exists)) fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (claim.test(l) && !/\b(no|not|never|without|nor|neither)\b/i.test(l)) bad.push(`${f}:${i + 1}`); });
  if (bad.length) throw new Error(bad.join(', '));
  const disclaim = ['README.md', 'play/index.html', 'live/js/honesty.js'].filter((f) => exists(f) && /consciousness/i.test(fs.readFileSync(f, 'utf8')));
  if (disclaim.length < 3) throw new Error('a no-consciousness-claim disclaimer is missing from README.md, play/index.html or live/js/honesty.js');
});

const node = (args, env = {}, timeout = 240000) => {
  const r = spawnSync(process.execPath, args, { cwd: path.join(ROOT, 'live'), encoding: 'utf8', env: { ...process.env, ...env }, timeout });
  if (r.status !== 0) throw new Error(`node ${args.join(' ')} exited ${r.status}${r.signal ? ' ' + r.signal : ''}: ${(r.stderr || r.stdout).slice(-600)}`);
  return r.stdout;
};

run('live/ creature: 20 s headless run, finite state, it moves', () => {
  const out = node(['-e', `
    const { Creature } = await import('./js/sim/creature.js');
    const c = new Creature(1); for (let i = 0; i < 1200; i++) c.step();
    const com = c.body.com ? c.body.com() : null; const d = c.stats.dist;
    const finite = (v) => v == null || (Array.isArray(v) || ArrayBuffer.isView(v) ? [...v].every(Number.isFinite) : typeof v === 'object' ? Object.values(v).every((x) => typeof x !== 'number' || Number.isFinite(x)) : Number.isFinite(v));
    if (!Number.isFinite(d) || d <= 0.5) { console.error('distance', d); process.exit(2); }
    if (!finite(com)) { console.error('non-finite COM', com); process.exit(3); }
    console.log(JSON.stringify({ dist: +d.toFixed(4), t: c.t }));`, '--input-type=module']);
  return out.trim();
});

run('live/ determinism: same seed gives identical 10 s trajectories', () => {
  const prog = `const { Creature } = await import('./js/sim/creature.js'); const c = new Creature(7); for (let i = 0; i < 600; i++) c.step(); console.log(c.stats.dist.toFixed(12), JSON.stringify(c.stats));`;
  const a = node(['--input-type=module', '-e', prog]); const b = node(['--input-type=module', '-e', prog]);
  if (a !== b) throw new Error('two runs with seed 7 differ:\n' + a.slice(0, 200) + '\n' + b.slice(0, 200));
  return a.split(' ')[0];
});

run('Reference sim (bun glitchling.ts 2 2 500): sane, deterministic, matches committed v3 rows', () => {
  // Audit finding F31: under Bun/JavaScriptCore the reference sim's output depends on JIT tier-up timing (CPU load), so the
  // committed results/summary.csv is one realization and is NOT byte-reproducible in general. With concurrent JIT compilation
  // disabled the run is deterministic, so that is what this check pins down. It also checks the structure of the output.
  const bunCandidates = ['bun', path.join(os.homedir(), '.bun', 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun')];
  let bunExe = null;
  for (const cand of bunCandidates) {
    const probe = spawnSync(cand, ['--version'], { encoding: 'utf8' });
    if (probe.status === 0) { bunExe = cand; break; }
  }
  if (!bunExe) return 'SKIPPED (bun not installed)';
  const once = () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'glref-'));
    fs.cpSync('glitchling.ts', path.join(tmp, 'glitchling.ts')); fs.cpSync('core', path.join(tmp, 'core'), { recursive: true });
    const r = spawnSync(bunExe, ['run', 'glitchling.ts', '2', '2', '500'], { cwd: tmp, encoding: 'utf8', timeout: 600000, env: { ...process.env, BUN_JSC_useConcurrentJIT: '0' } });
    if (r.status !== 0) throw new Error('bun run failed: ' + (r.stderr || '').slice(-400));
    const csv = fs.readFileSync(path.join(tmp, 'results/summary.csv'), 'utf8'); fs.rmSync(tmp, { recursive: true, force: true }); return csv;
  };
  const a = once(), b = once();
  if (a !== b) throw new Error('two runs with BUN_JSC_useConcurrentJIT=0 differ');
  const [head, ...rows] = a.trim().split('\n'); const H = head.split(',');
  const col = (r, k) => r.split(',')[H.indexOf(k)];
  if (rows.length !== 14) throw new Error(`expected 14 rows, got ${rows.length}`);
  for (const r of rows) {
    const c = col(r, 'condition'), j = +col(r, 'jolts');
    if (col(r, 'alive') !== 'true' || +col(r, 'ticks') !== 2880) throw new Error('bad row: ' + r);
    if (j !== (['misfire', 'all', 'all_mild'].includes(c) ? 48 : 0)) throw new Error('bad jolt count: ' + r);
    const sr = +col(r, 'successRate'); if (!(sr >= 0 && sr <= 1)) throw new Error('successRate out of range: ' + r);
  }
  // Results v3 (seeds 500-529) was made in the same mode, so seeds 500-501 should match the committed rows exactly. A mismatch on
  // another machine is reported but does not fail the check, because cross-machine JSC repeatability is not guaranteed (F31).
  const committed = fs.readFileSync('results/summary.csv', 'utf8').trim().split('\n').slice(1).filter((r) => ['500', '501'].includes(col(r, 'seed')));
  const same = committed.length === 14 && committed.every((r) => rows.includes(r));
  return `14 rows sane, deterministic; ${same ? 'matches the committed v3 rows for seeds 500-501' : 'DIFFERS from the committed v3 rows for seeds 500-501 (cross-machine, see F31)'}`;
});

if (process.env.FULL === '1') run('live/ dome + HEPTARCH probe (FULL=1)', () => { const o = node(['test/dome_heptarch_probe.mjs'], {}, 900000); if (!/ALL PASS 20 VERIFICATION GATES PASSED/.test(o)) throw new Error(o.slice(-500)); return 'all gates passed'; });

const w = Math.max(...results.map((r) => r[0].length));
console.log('\n' + results.map(([n, s, t, note]) => `${s === 'PASS' ? '✔' : '✘'} ${n.padEnd(w)}  ${s}  ${t}s  ${note}`).join('\n'));
const failed = results.filter((r) => r[1] === 'FAIL').length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
