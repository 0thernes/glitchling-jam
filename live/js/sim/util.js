// Small math helpers shared by the simulation (DOM-free so Node tests can import it).
// mulberry32, digamma and betaIG are ported from core/organism.ts (the reference organism).
export function mulberry(seed) { let a = seed >>> 0; const f = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; return f; }
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const sig = (x) => 1 / (1 + Math.exp(-x));
export const softplus = (x) => (x > 20 ? x : Math.log1p(Math.exp(x)));
export function gauss(r) { return Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r()); }
export function digamma(x) { let r = 0; while (x < 6) { r -= 1 / x; x += 1; } const f = 1 / (x * x); return r + Math.log(x) - 0.5 / x - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132)))); }
/** expected information gain of one more Bernoulli outcome under a Beta(a,b) belief (epistemic part of expected free energy) */
export function betaIG(a, b) { const n = a + b, m = a / n; const H = -(m * Math.log(m) + (1 - m) * Math.log(1 - m)); const EH = -(m * (digamma(a + 1) - digamma(n + 1)) + (1 - m) * (digamma(b + 1) - digamma(n + 1))); return Math.max(0, H - EH); }
export const IG0 = betaIG(1, 1);
// cheap smooth value noise for terrain/weather
function hash2(i, j, s) { let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 2147483647); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
export function vnoise(x, y, s = 0) { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j; const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j, s), b = hash2(i + 1, j, s), c = hash2(i, j + 1, s), d = hash2(i + 1, j + 1, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
export function fbm(x, y, s = 0, oct = 4) { let a = 0, amp = 0.5, f = 1; for (let o = 0; o < oct; o++) { a += amp * vnoise(x * f, y * f, s + o * 17); f *= 2.03; amp *= 0.5; } return a; }
