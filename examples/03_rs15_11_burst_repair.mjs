#!/usr/bin/env node
// Example 3: Systematic RS[15,11,d=5] GF(16) bio-acoustic call encoding & 2-symbol burst-noise repair
import assert from 'node:assert/strict';
import { encodeAcousticCallRS, decodeAcousticCallRS } from '../live/js/sim/heptarch.js';

const cw = encodeAcousticCallRS(2, 11.4, -7.8, 0.93, 1);
const corrupted = Uint8Array.from(cw);
corrupted[3] ^= 0x0b;
corrupted[12] ^= 0x07;
const dec = decodeAcousticCallRS(corrupted);
assert.equal(dec.ok, true);
assert.equal(dec.correctedSymbols, 2);
assert.equal(dec.typeId, 2);
assert(Math.abs(dec.x - 11.4) < 0.25 && Math.abs(dec.z - (-7.8)) < 0.25);
console.log(`Example 03 PASS: RS[15,11] repaired ${dec.correctedSymbols} GF(16) burst errors -> (x=${dec.x.toFixed(2)}, z=${dec.z.toFixed(2)}, caste=${dec.casteId})`);
