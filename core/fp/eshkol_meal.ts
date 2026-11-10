// Isolation (1): dream-trained forward model, meal 3 ticks ahead on a jittered schedule. A = TS TPC (NLMS on reservoir, online),
// B = Eshkol exact-BPTT RNN (55 params) trained only in "dream" batches replayed from the wake buffer. Metric: AUC on held-out cycles.
import { createRequire } from "module"; (globalThis as any).require = createRequire(import.meta.url); (globalThis as any).__dirname = "/tmp/eshkol-dive";
import { readFileSync } from "fs"; import { TPC } from "./tpc";
const D = "/tmp/eshkol-dive/"; (globalThis as any).window = globalThis; eval(readFileSync(D + "eshkol-vm.js", "utf8") + "\n;globalThis.EshkolVM=EshkolVM;");
const rng = (s: number) => { let a = s >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const auc = (p: number[], y: number[]) => { const P = p.filter((_, i) => y[i]), N = p.filter((_, i) => !y[i]); let s = 0; for (const a of P) for (const b of N) s += a > b ? 1 : a === b ? 0.5 : 0; return s / (P.length * N.length); };
const PER = 12, JIT = Number(process.env.JIT ?? 1), K = 3;
const sched = (r: () => number, n: number) => { const f = new Array(n).fill(0); let t = 5; while (t < n) { f[t] = 1; t += PER + Math.round((r() * 2 - 1) * JIT); } return f; };
let out = ""; const mk = async () => { const vm: any = await (globalThis as any).EshkolVM({ print: (t: string) => (out += t + "\n"), printErr: (t: string) => console.error("[err]", t), stdout: (b: any) => { if (b != null) out += String.fromCharCode(b); }, locateFile: (p: string) => D + p }); vm.ccall("repl_init", null, [], []); return vm.cwrap("repl_eval", "string", ["string"]); }; let ev = await mk();
const H = 6, NP = H * H + 3 * H + 1;
const DEFS = `(define LR ${process.env.LR ?? 0.05}) (define H ${H}) (define (sig z) (/ 1.0 (+ 1.0 (exp (- 0.0 z)))))
(define (cell p h x) (let ((nh (make-vector H 0.0))) (do ((i 0 (+ i 1))) ((= i H) nh) (let loop ((j 0) (s (+ (* (vref p (+ 36 i)) x) (vref p (+ 42 i)))))
  (if (= j H) (vector-set! nh i (tanh s)) (loop (+ j 1) (+ s (* (vref p (+ (* i H) j)) (vref h j)))))))))
(define (outp p h) (let loop ((j 0) (s (vref p 54))) (if (= j H) (sig s) (loop (+ j 1) (+ s (* (vref p (+ 48 j)) (vref h j)))))))
(define (wloss p xs ys B) (let loop ((t 0) (h (make-vector H 0.0)) (L 0.0)) (if (= t (vector-length xs)) L
  (let* ((h2 (cell p h (vref xs t))) (o (outp p h2)) (y (vref ys t)) (e (- 0.0 (+ (* y (log (+ o 1e-6))) (* (- 1.0 y) (log (+ (- 1.0 o) 1e-6))))))) (loop (+ t 1) h2 (if (< t B) L (+ L e)))))))
(define (preds p xs) (let loop ((t 0) (h (make-vector H 0.0)) (acc '())) (if (= t (vector-length xs)) (reverse acc)
  (let ((h2 (cell p h (vref xs t)))) (loop (+ t 1) h2 (cons (outp p h2) acc))))))`; ev(DEFS);
const res: any = { A: [], B: [], Bms: [] }; const S0 = Number(process.env.S ?? 3077), NS = Number(process.env.NS ?? 8);
for (let s = S0; s < S0 + NS; s++) { const r = rng(s); const tr = sched(r, 1200), te = sched(r, 600); const yte = te.map((_, t) => te[t + K] ?? 0).slice(0, 590);
  // A: online TPC through wake + test (continues learning, as in the creature)
  const m = new TPC(1, rng(s + 7), { K }); const pa: number[] = []; for (const x of tr) m.step([x]); for (let t = 0; t < 590; t++) pa.push(m.step([te[t]])[0]); res.A.push(auc(pa, yte));
  // B: dreams = 400 SGD steps on random 36-tick windows from the wake buffer (12 burn-in), exact BPTT via Eshkol gradient
  const p0 = Array.from({ length: NP }, () => ((r() * 2 - 1) * 0.5).toFixed(4)); ev(`(define p (vector ${p0.join(" ")})) (define m (make-vector ${NP} 0.0)) (define v (make-vector ${NP} 0.0)) (define k 0)`); const t0 = Date.now();
  for (let it = 0; it < Number(process.env.IT ?? 400); it++) { if (it % 10 === 9) { const grab = (n: string) => { out = ""; ev(`(display ${n})`); return out.replace(/[#()]/g, " ").trim().split(/\s+/); }; const pv = grab("p"), mv = grab("m"), vv = grab("v"), kv = grab("k"); ev = await mk(); ev(DEFS); ev(`(define p (vector ${pv.join(" ")})) (define m (vector ${mv.join(" ")})) (define v (vector ${vv.join(" ")})) (define k ${kv[0]})`); } const a = Math.floor(r() * (1200 - 52)); const xs = tr.slice(a, a + 48), ys = tr.slice(a + K, a + K + 48);
    if (it % 50 === 0) { out = ""; ev(`(display (wloss p (vector ${xs.join(" ")}) (vector ${ys.join(" ")}) 12))`); console.error(it, out.trim()); } ev(`(let ((g (gradient (lambda (q) (wloss q (vector ${xs.join(" ")}) (vector ${ys.join(" ")}) 16)) p))) (set! k (+ k 1)) (do ((i 0 (+ i 1))) ((= i ${NP})) (let ((gi (vref g i))) (vector-set! m i (+ (* 0.9 (vref m i)) (* 0.1 gi))) (vector-set! v i (+ (* 0.999 (vref v i)) (* 0.001 gi gi))) (vector-set! p i (- (vref p i) (/ (* LR (/ (vref m i) (- 1.0 (expt 0.9 k)))) (+ 1e-8 (sqrt (/ (vref v i) (- 1.0 (expt 0.999 k))))))))))))`); }
  out = ""; ev(`(display (preds p (vector ${te.slice(0, 590).join(" ")})))`); const pb = out.replace(/[()]/g, " ").trim().split(/\s+/).map(Number); res.Bms.push(Date.now() - t0); res.B.push(auc(pb.slice(12), yte.slice(12))); }
console.log(JSON.stringify(res));
