#!/usr/bin/env node
// Example 1: Glitchling engineered flaw algebraic invariants (backwards involution + leaky contraction)
import assert from 'node:assert/strict';

const SITES = 16;
const mirrorSite = (k) => SITES - 1 - k;
for (let k = 0; k < SITES; k++) {
  const m = mirrorSite(k);
  assert.notEqual(m, k, 'backwards mirror must have no fixed points');
  assert.equal(mirrorSite(m), k, 'backwards mirror must be an exact involution');
}

const prior = 0.25;
const leakRate = 0.06;
let w = 0.85;
for (let step = 0; step < 50; step++) {
  const distBefore = Math.abs(w - prior);
  w += leakRate * (prior - w);
  const distAfter = Math.abs(w - prior);
  assert(distAfter < distBefore, 'leaky update must strictly contract toward prior');
}
console.log(`Example 01 PASS: 16-site mirror involution verified (0 fixed points); leaky decayed 0.85 -> ${w.toFixed(4)} (prior 0.25)`);
