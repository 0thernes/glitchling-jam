// Isolation (2) rollout action choice and (3) error-predicting confidence; Eshkol exact gradients.
// Task: 4 hidden-rule states. Action a in {0,1} at t is rewarded at t+2 iff a == rule[s_t] (states 0,1 deterministic; 2,3 reward p=0.5 noise).
// Agents: roll = learned 2-step model f(s,a)->r(t+2), choose argmax; greedy = learned 1-step model f(s,a)->r(t+1) (reward at t+1 is unrelated);
// ident = identity/no-learning model lesion. (3) conf model g(s,a)->expected squared error of f; opt-out (safe 0.6) when g high;
// controls: margin |f-0.5| confidence, shuffled g.
import { readFileSync } from "fs"; import { createRequire } from "module"; (globalThis as any).require = createRequire(import.meta.url); (globalThis as any).__dirname = "/tmp/eshkol-dive";
const D = "/tmp/eshkol-dive/"; (globalThis as any).window = globalThis; eval(readFileSync(D + "eshkol-vm.js", "utf8") + "\n;globalThis.EshkolVM=EshkolVM;");
const rng = (s: number) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
let out = ""; const mk = async () => { const vm: any = await (globalThis as any).EshkolVM({ print: (t: string) => (out += t + "\n"), printErr: (t: string) => console.error("[err]", t), stdout: (b: any) => { if (b != null) out += String.fromCharCode(b); }, locateFile: (p: string) => D + p }); vm.ccall("repl_init", null, [], []); return vm.cwrap("repl_eval", "string", ["string"]); };
const NSt = 16, NW = 32; const DEFS = `(define NW ${NW}) (define (sig z) (/ 1.0 (+ 1.0 (exp (- 0.0 z))))) (define (f w i) (sig (vref w i))) (define (ls w i y) (let ((o (f w i))) (* (- o y) (- o y))))
(define (upd! w i y lr) (let ((g (gradient (lambda (q) (ls q i y)) w))) (do ((j 0 (+ j 1))) ((= j NW)) (vector-set! w j (- (vref w j) (* lr (vref g j)))))))`;
const ask = (ev: any, e: string) => { out = ""; ev(`(display ${e})`); return Number(out.trim()); };
const res: any = {}; const put = (k: string, v: number) => (res[k] ??= []).push(v); const S0 = Number(process.env.S ?? 3077), NS = Number(process.env.NS ?? 8), T = Number(process.env.T ?? 2400);
for (let s = S0; s < S0 + NS; s++) for (const ag of ["roll", "greedy", "ident"]) { const r = rng(s); const rp = rng(s * 31 + ag.length); const rule = Array.from({ length: NSt }, () => 0).map(() => (r() < 0.5 ? 0 : 1)); let ev = await mk(); ev(DEFS); ev(`(define w (make-vector NW 0.0)) (define c (make-vector NW 0.0))`);
  const hist: { s: number; a: number; r1: number }[] = []; let tot = 0, n = 0; const C: { conf: number; marg: number; ok: number }[] = [];
  for (let t = 0; t < T; t++) { if (t % 300 === 299) { out = ""; ev(`(display w)`); const W = out.replace(/[#()]/g, " ").trim(); out = ""; ev(`(display c)`); const Cc = out.replace(/[#()]/g, " ").trim(); ev = await mk(); ev(DEFS); ev(`(define w (vector ${W})) (define c (vector ${Cc}))`); }
    const st = Math.floor(r() * NSt); const pr = [0, 1].map((a) => ask(ev, `(f w ${st * 2 + a})`)); const a = rp() < 0.1 || pr[0] === pr[1] ? (rp() < 0.5 ? 0 : 1) : pr[1] > pr[0] ? 1 : 0;
    const rew = st < NSt / 2 ? +(a === rule[st]) : +(r() < 0.5); const cur = { s: st, a, r1: rew }; hist.push(cur);
    // learning: roll learns r(t+2) for the (s,a) of t-2; greedy learns reward received now against (s,a) of t-1 (one-step); ident never learns
    if (t >= 2) { const h = hist[t - 2]; const tgt = h.r1; if (ag === "roll") { const e = (ask(ev, `(f w ${h.s * 2 + h.a})`) - tgt) ** 2; ev(`(upd! w ${h.s * 2 + h.a} ${tgt} 2.0)`); ev(`(let ((g (gradient (lambda (q) (ls q ${h.s * 2 + h.a} ${e})) c))) (do ((j 0 (+ j 1))) ((= j NW)) (vector-set! c j (- (vref c j) (* 2.0 (vref g j))))))`); } }
    if (ag === "greedy" && t >= 2) { const h = hist[t - 1]; ev(`(upd! w ${h.s * 2 + h.a} ${hist[t - 2].r1} 2.0)`); } /* one-step model: credits the reward delivered now to the most recent action */
    if (t >= T / 2) { tot += +(st < NSt / 2 ? a === rule[st] : r() < 0.5); n++; if (ag === "roll") C.push({ conf: -ask(ev, `(f c ${st * 2 + a})`), marg: Math.abs(pr[a] - 0.5), ok: st < NSt / 2 ? +(a === rule[st]) : 0.5 }); } }
  put(ag, tot / n);
  if (ag === "roll") { // (3) opt-out: abstain on the 50% lowest-confidence trials; accuracy on kept trials
    const keep = (k: "conf" | "marg" | "shuf") => { const v = C.map((x, i) => ({ x, c: k === "shuf" ? C[(i * 7919) % C.length].conf : x[k] })); const srt = [...v].sort((p, q) => q.c - p.c); const th = srt[Math.floor(v.length / 2)].c; const kept = v.filter((z) => z.c > th || (z.c === th && Math.random() < 0)); return kept.reduce((p, z) => p + z.x.ok, 0) / Math.max(1, kept.length); };
    put("opt:errorModel", keep("conf")); put("opt:margin", keep("marg")); put("opt:shuffled", keep("shuf")); } }
console.log(JSON.stringify(res));
