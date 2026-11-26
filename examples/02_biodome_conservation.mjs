#!/usr/bin/env node
// Example 2: Geodesic Biodome First-Law 11-pool energy & N/C mass closure + FMO GKSL vs secular Pauli-Forster
import assert from 'node:assert/strict';
import { World, solveFMOLindbladExact, solveFMOForsterExact } from '../live/js/sim/world.js';

const w = new World(42);
for (let f = 0; f < 300; f++) w.step(1 / 60, f);
const eErr = w.auditEnergyClosure();
const mErr = w.auditMassClosure();
assert(eErr < 1e-12 && mErr < 1e-12, `Conservation drift: E=${eErr}, M=${mErr}`);

const roomQ = solveFMOLindbladExact(22.0);
const roomC = solveFMOForsterExact(22.0);
const zenoQ = solveFMOLindbladExact(518.0);
const zenoC = solveFMOForsterExact(518.0);
assert(roomQ.sinkEff > roomC, 'Room-temp FMO GKSL must exceed secular Forster');
assert(Math.abs(zenoQ.sinkEff - zenoC) < 5e-5, 'High-dephasing FMO must converge to secular Forster');
console.log(
  `Example 02 PASS: 5s Dome E_err=${eErr.toExponential(2)}, M_err=${mErr.toExponential(2)}, ` +
  `FMO(24C)=${roomQ.sinkEff.toFixed(4)} > Forster=${roomC.toFixed(4)}, Zeno gap=${Math.abs(zenoQ.sinkEff - zenoC).toExponential(2)}`
);
