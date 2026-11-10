// Tsotchke adapter (v5.1). Engine-agnostic: the brain calls ent(); this file decides where the bits come from.
// QRNG: tsotchke/quantum_rng (MIT, (c) 2024 Tsotchke) via the WASM wrapper in /tmp/www14/tsotchke (seeded mode = replayable; a classical
// simulation of Born-rule measurement, NOT hardware quantum randomness). Because the simulator is async WASM and the creature is synchronous,
// bytes are pre-generated per seed by gen_qrng.mjs into $TSOTCHKE_QRNG_DIR/<seed>.bin and streamed here. Missing file -> seeded fallback.
// QGTL: tsotchke/quantum_geometric_tensor fidelity |<sqrt p|sqrt q>|^2 is used OFFLINE (qgtl_wiring.mjs) to measure like-to-like structure
// of the learned cross wiring; jsFidelity below is the identical formula used in the sync path.
export function tsotchkeEntropy(seed: number, fallback: () => number): () => number {
  let buf: Uint8Array | null = null; try { const dir = typeof process !== "undefined" ? process.env?.TSOTCHKE_QRNG_DIR : undefined; if (dir) { const fs = require("fs"); const f = `${dir}/${seed}.bin`; if (fs.existsSync(f)) buf = new Uint8Array(fs.readFileSync(f)); } } catch { buf = null; }
  if (!buf || buf.length < 8) return fallback; let i = 0, wraps = 0; const b = buf;
  return () => { if (i + 4 > b.length) { i = 0; wraps++; } const v = (((b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0) ^ Math.imul(wraps, 0x9e3779b9)) >>> 0; i += 4; return v / 4294967296; }; }
export const jsFidelity = (p: number[], q: number[]): number => { const sp = p.reduce((a, b) => a + b, 0) || 1, sq = q.reduce((a, b) => a + b, 0) || 1; let s = 0; for (let i = 0; i < p.length; i++) s += Math.sqrt((p[i] / sp) * (q[i] / sq)); return s * s; };
