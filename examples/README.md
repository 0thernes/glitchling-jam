# Runnable Examples (`examples/`)

Three self-contained, zero-dependency Node.js (>=22) examples demonstrating the core verified invariants of `glitchling-jam` (`Build Standard A43`):

```bash
npm run examples
```

1. [`01_flaw_invariants.mjs`](01_flaw_invariants.mjs): Demonstrates Glitchling's `backwards` mirror involution (`k -> 15 - k`, zero fixed points) and `leaky` memory contraction toward prior `0.25`.
2. [`02_biodome_conservation.mjs`](02_biodome_conservation.mjs): Runs the Geodesic Biodome 11-pool energy ledger, closed N/C mass ledger, and FMO ENAQT vs secular Pauli–Förster comparison (`world.js`).
3. [`03_rs15_11_burst_repair.mjs`](03_rs15_11_burst_repair.mjs): Encodes a physical bio-acoustic warning call with systematic `RS[15,11,d=5]` over $\mathbb{F}_{16}$, injects a 2-symbol aurora storm burst error, and verifies exact recovery (`heptarch.js`).
