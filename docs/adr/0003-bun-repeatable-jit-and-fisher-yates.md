# ADR-0003: Repeatable Bun Mode, Seeded Fisher–Yates Shuffle & Frozen `core/` Boundary

- **Date:** 2026-11-24 (updated 2026-11-25)
- **Status:** Accepted (`F03/D3`, `F18/D8`, `F30`, `F31/D9`)

## Context
Three determinism hazards were discovered: (1) JavaScriptCore concurrent JIT caused `glitchling.ts` to produce 6 distinct outputs in 11 runs (`F31`); (2) `arr.sort(() => r() - 0.5)` differed between V8 and JSC on 186/200 seeds (`F03`); (3) two helper functions in `live/js/` kept unused `Math.random` default fallbacks (`F30`). Meanwhile, `core/` is a frozen Creature #1 copy whose re-vendor is on hold pending Phase 1 (`F18`).

## Decision
1. Pin repeatable `glitchling.ts` execution to `BUN_JSC_useConcurrentJIT=0` and publish 30-seed Results v3 (`500–529`).
2. Use seeded Fisher–Yates in `play/sim.js` and `live/js/sim/world.js`.
3. Throw `TypeError` if `quantizeNestorRung` (stochastic rungs) or `chooseSafeCospectralObelisk` (classical fallback) is called without a seeded PRNG (`F30`).
4. Leave `core/` strictly untouched until Creature #1 Phase 1 completes (`F18/D8`).

## Consequences
Same-machine Bun runs and cross-browser `live/`/`play/` runs are 100% deterministic; `core/` maintains strict provenance fidelity with Asmodensius.
