// v4.0 substrate senses: the creature feels the machine it runs on. Sandboxed, read-only.
// Modes: "synthetic" (seeded, deterministic; default for tests), "replay" (bit-exact from a recorded log), "live" (reads runtime counters and records them).
// Tests and preregistered runs must use "synthetic" or "replay" only. See DELARP-PLAN.md §30.
import { mulberry } from "./organism";
export type SubstrateMode = "synthetic" | "replay" | "live";
export const SUBSTRATE_IDS = ["jitter", "cpu", "heap", "gc", "loopDelay", "dome"] as const;
export type SubstrateFrame = { t: number; v: number[] };
export class SubstrateTap {
  readonly log: SubstrateFrame[] = []; private i = 0; private r: () => number; private pink = new Float64Array(6); private last = 0; private gcPending = 0; private gcObs: any = null; private eld: any = null;
  constructor(readonly mode: SubstrateMode, seed: number, private replayLog: SubstrateFrame[] = []) {
    this.r = mulberry(seed * 3571 + 40);
    if (mode === "live") { try { const ph = require("perf_hooks"); this.gcObs = new ph.PerformanceObserver((l: any) => { for (const e of l.getEntries()) this.gcPending += e.duration; }); this.gcObs.observe({ entryTypes: ["gc"] }); this.eld = ph.monitorEventLoopDelay({ resolution: 10 }); this.eld.enable(); } catch { /* browser or no perf_hooks: those channels read 0 */ } this.last = typeof performance !== "undefined" ? performance.now() : Date.now(); }
  }
  /** one reading per tick: [jitter, cpu, heap, gc, loopDelay, dome], each roughly in 0..1 */
  read(t: number, dome = 0): number[] {
    let v: number[];
    if (this.mode === "replay") { const f = this.replayLog[this.i++]; if (!f || f.t !== t) throw new Error(`substrate replay out of sync at tick ${t}`); this.log.push({ t, v: f.v.slice() }); return f.v.slice(); }
    if (this.mode === "synthetic") { // 1/f-like jitter (sum of AR(1) octaves), occasional GC bursts, slow load drift
      for (let k = 0; k < 6; k++) { const a = 1 - Math.pow(2, -k - 1); this.pink[k] = a * this.pink[k] + (1 - a) * (this.r() - 0.5); }
      const pk = this.pink.reduce((s, x) => s + x, 0); const gc = this.r() < 0.02 ? 0.3 + 0.7 * this.r() : 0;
      v = [0.5 + pk, 0.3 + 0.2 * Math.sin(t / 1440 * 2 * Math.PI) + 0.05 * (this.r() - 0.5), 0.4 + 0.1 * this.pink[5], gc, 0.1 + 0.5 * gc, dome];
    } else {
      const now = typeof performance !== "undefined" ? performance.now() : Date.now(); const dt = now - this.last; this.last = now;
      let cpu = 0, heap = 0; try { const os = require("os"); cpu = os.loadavg()[0] / Math.max(1, os.cpus().length); heap = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal; } catch { /* browser */ }
      const gc = Math.min(1, this.gcPending / 50); this.gcPending = 0; const m = this.eld ? this.eld.mean : 0; const ld = Number.isFinite(m) ? Math.min(1, m / 1e8) : 0;
      v = [Math.tanh(dt / 50), Math.min(1, cpu), heap, gc, ld, dome];
    }
    this.log.push({ t, v: v.slice() }); return v;
  }
  /** newline-delimited JSON for results/<run>/substrate.ndjson */
  toNDJSON(): string { return this.log.map((f) => JSON.stringify(f)).join("\n"); }
  static fromNDJSON(s: string): SubstrateFrame[] { return s.split("\n").filter(Boolean).map((l) => JSON.parse(l)); }
  close(): void { try { this.gcObs?.disconnect(); this.eld?.disable(); } catch { /* ignore */ } }
}
