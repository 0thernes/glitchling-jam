// Oracle check: TS BPTT gradient of EFM vs Eshkol exact reverse-mode `gradient` on random windows.
import { readFileSync } from "fs"; import { createRequire } from "module"; import { EFM } from "./efm"; (globalThis as any).require = createRequire(import.meta.url); (globalThis as any).__dirname = "/tmp/eshkol-dive";
const Dd = "/tmp/eshkol-dive/"; (globalThis as any).window = globalThis; eval(readFileSync(Dd + "eshkol-vm.js", "utf8") + "\n;globalThis.EshkolVM=EshkolVM;");
let out = ""; const vm: any = await (globalThis as any).EshkolVM({ print: (t: string) => (out += t + "\n"), printErr: (t: string) => console.error(t), stdout: (b: any) => { if (b != null) out += String.fromCharCode(b); }, locateFile: (p: string) => Dd + p }); vm.ccall("repl_init", null, [], []); const ev = vm.cwrap("repl_eval", "string", ["string"]);
let a = 12345; const r = () => { a = (a * 1103515245 + 12345) % 2147483648; return a / 2147483648; }; const H = 10, D = 5, T = 24, B = 6; const m = new EFM(D, r, H);
ev(`(define H ${H}) (define D ${D}) (define oX (* H H)) (define oB (+ oX (* H D))) (define oO (+ oB H))
(define (cell p h x) (let ((nh (make-vector H 0.0))) (do ((i 0 (+ i 1))) ((= i H) nh) (let ((s (vref p (+ oB i)))) (do ((j 0 (+ j 1))) ((= j H)) (set! s (+ s (* (vref p (+ (* i H) j)) (vref h j))))) (do ((d 0 (+ d 1))) ((= d D)) (set! s (+ s (* (vref p (+ oX (* i D) d)) (vref x d))))) (vector-set! nh i (tanh s))))))
(define (outp p h) (let ((s (vref p (+ oO H)))) (do ((j 0 (+ j 1))) ((= j H) s) (set! s (+ s (* (vref p (+ oO j)) (vref h j)))))))
(define (loss p xs ys) (let loop ((t 0) (h (make-vector H 0.0)) (L 0.0)) (if (= t (vector-length xs)) (/ L ${T - B}.0) (let* ((h2 (cell p h (vref xs t))) (e (- (outp p h2) (vref ys t)))) (loop (+ t 1) h2 (if (< t ${B}) L (+ L (* e e))))))))`);
let mx = 0, mg = 0; for (let w = 0; w < 3; w++) { const xs = Array.from({ length: T }, () => Array.from({ length: D }, () => r() * 2 - 1)), ys = xs.map(() => r() - 0.5);
  const g = m.grad(xs, ys, B); out = ""; ev(`(display (gradient (lambda (q) (loss q (vector ${xs.map((x) => `(vector ${x.join(" ")})`).join(" ")}) (vector ${ys.join(" ")}))) (vector ${Array.from(m.p).join(" ")})))`);
  const ge = out.replace(/[#()]/g, " ").trim().split(/\s+/).map(Number); if (ge.length !== g.length) console.log("len", ge.length, g.length); for (let i = 0; i < g.length; i++) { mx = Math.max(mx, Math.abs(g[i] - ge[i])); mg = Math.max(mg, Math.abs(ge[i])); } }
console.log(`EFM BPTT vs Eshkol gradient: max abs diff ${mx.toExponential(2)} (max |g| ${mg.toFixed(3)}), n params ${m.n}`);
