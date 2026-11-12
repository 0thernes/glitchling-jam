// Pass 20 Comprehensive Verification Suite:
// Geodesic Biodome First-Law Closure (< 1e-12), HEPTARCH 7-Seat Capped Council, Raider ColdStrike,
// RS[15,11] GF(16) ECC, Cryptochrome-4 Nocturnal Compass, Levin V_mem Limb Regeneration,
// GATE-DOME-REFUGE Sanctuary Causal Audit, Multi-Kingdom Species, KCBS / CEGA-18 / Hoggar & Certified MPS/Magic M2.

import assert from 'node:assert/strict';
import { Creature } from '../js/sim/creature.js';
import { encodeAcousticCallRS, decodeAcousticCallRS } from '../js/sim/heptarch.js';
import { evalContextualitySuites } from '../js/tsotchke/qgtl.js';
import { MPSQuantumSimulator32Q } from '../js/tsotchke/moonlab.js';

console.log('=== PASS 20: DOME, HEPTARCH, MULTI-KINGDOM & QUANTUM CONTEXTUALITY PROBE ===');

// 1) Quantum Contextuality Witnesses + Certified MPS Truncation + 2-Renyi Magic M2
{
  const ctx = evalContextualitySuites(0, 0);
  assert(Math.abs(ctx.kcbsValue - Math.sqrt(5)) < 1e-9 && ctx.kcbsViolated, 'KCBS pentagon must equal sqrt(5) > 2');
  assert(ctx.kcbsOrthoErr < 1e-12, 'KCBS orthogonality error must be < 1e-12');
  assert(Math.abs(ctx.cegaValue - 9) < 1e-9 && ctx.cegaViolationMargin > 0.99 && ctx.cegaAllTwice, 'CEGA-18 9-tetrad value must equal 9 > 8');
  assert(ctx.cegaOrthoErr < 1e-12, 'CEGA-18 orthogonality error must be < 1e-12');
  assert(ctx.hoggarViolatedLines === 63 && ctx.hoggarBetaNCHV === 189, 'Hoggar 3Q SIC must have 63/315 frustrated lines');
  assert(Math.abs(ctx.hoggarFloor - 1 / 3) < 1e-9, 'Hoggar spectral floor must equal 1/3');
  assert(Math.abs(ctx.c3CospectralGap - 0.025) < 1e-9, 'C3 cospectral twin Jordan gap must equal 0.025');

  const mpsBell = new MPSQuantumSimulator32Q(8, 16);
  mpsBell.hadamard(0);
  mpsBell.cnot(0);
  const bellMagic = mpsBell.stabilizerMagic2Q(0);
  assert(Math.abs(bellMagic) < 1e-9, `Clifford Bell state M2 must be 0, got ${bellMagic}`);
  mpsBell.ry(0, Math.PI / 4); // T-like non-Clifford angle
  const nonCliffMagic = mpsBell.stabilizerMagic2Q(0);
  assert(nonCliffMagic > 0.15, `Non-Clifford state must have M2 > 0.15, got ${nonCliffMagic}`);
  assert(mpsBell.vcTruncBound >= 0 && Number.isFinite(mpsBell.vcTruncBound), 'Verstraete-Cirac bound must be finite >= 0');

  console.log(
    `[PASS] Quantum Contextuality & Tensor Certs: KCBS=${ctx.kcbsValue.toFixed(6)} (>2), CEGA-18=${ctx.cegaValue.toFixed(1)} (>8), ` +
    `Hoggar=${ctx.hoggarViolatedLines}/315 (floor=${ctx.hoggarFloor.toFixed(4)}), C3_gap=${ctx.c3CospectralGap.toFixed(3)}, ` +
    `Bell_M2=${bellMagic.toExponential(1)}, NonClifford_M2=${nonCliffMagic.toFixed(4)}, VC_bound=${mpsBell.vcTruncBound.toExponential(2)}`
  );
}

// 2) RS[15,11,d=5] GF(2^4) Bio-Acoustic Burst Error Correction
{
  let okCount = 0;
  const trials = 1000;
  for (let i = 0; i < trials; i++) {
    const x = -18 + (i % 37);
    const z = -16 + ((i * 7) % 33);
    const cw = encodeAcousticCallRS(i % 4, x, z, 0.85, i % 5);
    const p1 = i % 15;
    const p2 = (i * 3 + 1 + (i % 13)) % 15;
    cw[p1] ^= ((i % 15) + 1) & 0x0f;
    if (p2 !== p1) cw[p2] ^= (((i * 5) % 15) + 1) & 0x0f;
    const dec = decodeAcousticCallRS(cw);
    if (dec.ok && Math.abs(dec.x - x) < 0.25 && Math.abs(dec.z - z) < 0.25) okCount++;
  }
  assert(okCount === trials, `RS[15,11] must recover 100% of <=2 symbol errors (${okCount}/${trials})`);
  console.log(`[PASS] RS[15,11,d=5] GF(16) Acoustic ECC: ${okCount}/${trials} (100.0%) exact 2-symbol error recovery`);
}

// 3) Live 60s Geodesic Biodome + Multi-Kingdom Biosphere + First-Law Closure + HEPTARCH Anti-Monarchy Cap
{
  const cr = new Creature(7, { eco: { peers: 12, mites: 24, predators: 1 } });
  let maxSeatObserved = 0;
  for (let f = 0; f < 60 * 60; f++) {
    cr.step();
    if (f % 6 === 0) {
      let sSum = 0;
      for (let m = 0; m < 7; m++) {
        const w = cr.heptarch.seats[m];
        sSum += w;
        if (w > maxSeatObserved) maxSeatObserved = w;
      }
      assert(Math.abs(sSum - 1.0) < 1e-6, 'HEPTARCH seat weights must sum to 1');
    }
  }
  const closureErr = cr.world.auditEnergyClosure();
  assert(closureErr < 1e-12, `GATE-03 First-Law closure error must be < 1e-12, got ${closureErr}`);
  assert(maxSeatObserved <= 0.460001, `HEPTARCH Law 1 anti-monarchy cap violated: ${maxSeatObserved}`);

  const xm0 = cr.eco.xenomimics[0];
  assert(xm0.chshS > 2.0 && xm0.marginalBias === 0, 'Xenomimic Bell twins must violate CHSH > 2 with zero marginal bias');
  assert(cr.eco.xylos.length === 4 && cr.world.slimeTrails.length > 0, 'Xylos must deposit Physarum low-drag slime trails');
  assert(cr.eco.titans.length === 3 && cr.eco.shoggoths.length === 2, 'Titans and Shoggoths must populate Dome');

  // Test Keel Ring-0 low-ATP curiosity gate
  cr.metab.atp = 0.88;
  cr.metab.thirst = 0.05;
  cr.heptarch.step(0.1, cr);
  const epiHighATP = cr.efe(20).epi;
  cr.metab.atp = 0.14;
  cr.heptarch.step(0.1, cr);
  const epiLowATP = cr.efe(20).epi;
  assert(epiLowATP < epiHighATP * 0.35, `Keel survival gate must suppress epistemic curiosity at low ATP (${epiLowATP} vs ${epiHighATP})`);

  console.log(
    `[PASS] 60s Live Biodome & HEPTARCH: ClosureErr=${closureErr.toExponential(2)} (<1e-12), maxSeat=${maxSeatObserved.toFixed(4)} (<=0.46), ` +
    `Keel_epi(highATP=${epiHighATP.toFixed(3)} -> lowATP=${epiLowATP.toFixed(4)}), Xenomimic_CHSH=${xm0.chshS.toFixed(3)} (bias=${xm0.marginalBias}), ` +
    `SlimeNodes=${cr.world.slimeTrails.length}, O2=${cr.world.dome.o2.toFixed(2)}%, CO2=${Math.round(cr.world.dome.co2)}ppm`
  );
}

// 4) Causal Lesion A: Levin Somatic Bioelectric V_mem Limb Regeneration (Intact vs lesion.bioelec)
{
  const cIntact = new Creature(3);
  const cLesion = new Creature(3);
  cLesion.lesion.bioelec = true;
  cIntact.heptarch.inflictLimbTrauma(0, 0.50);
  cLesion.heptarch.inflictLimbTrauma(0, 0.50);
  const initInt = cIntact.heptarch.limbIntegrity[0];
  for (let i = 0; i < 200; i++) {
    cIntact.heptarch.stepBioelectric(0.1, cIntact.metab, false);
    cLesion.heptarch.stepBioelectric(0.1, cLesion.metab, true);
  }
  const finalIntact = cIntact.heptarch.limbIntegrity[0];
  const finalLesion = cLesion.heptarch.limbIntegrity[0];
  assert(finalIntact > initInt + 0.20, `Intact bioelectric network must regenerate traumatized limb (${initInt} -> ${finalIntact})`);
  assert(Math.abs(finalLesion - initInt) < 1e-9, `Lesioned bioelectric network must fail to regenerate (${finalLesion})`);
  console.log(
    `[PASS] Levin V_mem Limb Regeneration Causal Lesion: init=${initInt.toFixed(2)} -> intact=${finalIntact.toFixed(3)} vs bioelec_lesion=${finalLesion.toFixed(3)}`
  );
}

// 5) Causal Lesion B: Nocturnal Cryptochrome-4 Radical-Pair Magnetoreception (Intact vs lesion.magneto in Darkness)
{
  const runNocturnal = (lesionMag) => {
    const c = new Creature(5);
    c.lesion.magneto = lesionMag;
    // 20s daytime celestial/geomagnetic HD ring Hebbian Wv consolidation
    for (let f = 0; f < 20 * 60; f++) {
      c.hour = 12.0; // noon sunlight
      c.step();
    }
    // Sudden nocturnal rock-slip disorientation in pitch-black darkness (01:00 AM, awake nocturnal foraging)
    // Perturb internal HD bump by ~0.55 rad (~31 deg) as from a dark boulder tumble, then walk 25s at night:
    const hSave = Float64Array.from(c.nav.h);
    for (let i = 0; i < 36; i++) c.nav.h[i] = hSave[(i + 5) % 36];
    let errSum = 0, errN = 0;
    for (let f = 0; f < 25 * 60; f++) {
      c.hour = 1.0;       // 01:00 AM pitch-black night (solar az === null; only Cryptochrome-4 is active!)
      c.sleep.S = 0;      // nocturnal active foraging (prevent sleep atonia)
      c.sleep.stage = 0;
      c.step();
      if (f > 10 * 60 && f % 6 === 0) {
        errSum += c.navErr.hd;
        errN++;
      }
    }
    return errSum / Math.max(1, errN);
  };
  const hdErrIntact = runNocturnal(false);
  const hdErrLesion = runNocturnal(true);
  assert(hdErrIntact < hdErrLesion * 0.5, `Intact Cryptochrome-4 nocturnal compass must re-anchor HD drift vs magneto-lesioned (${hdErrIntact} vs ${hdErrLesion})`);
  console.log(
    `[PASS] Cryptochrome-4 Nocturnal Compass Causal Lesion: night HD error intact=${hdErrIntact.toFixed(4)} rad < magneto_lesion=${hdErrLesion.toFixed(4)} rad`
  );
}

// 6) V4 Causal Sanctuary Refuge Audit (`GATE-DOME-REFUGE`: refugeImmunityEnabled ON vs OFF under Leviathan attack)
{
  const runSanctuaryAudit = (refugeOn) => {
    const c = new Creature(11, { eco: { peers: 8, predators: 1, refugeImmunityEnabled: refugeOn } });
    const sc = c.world.sanctuaries[0];
    // Cluster all peers inside Sanctuary 0 and place Shadow-Leviathan directly overhead!
    for (const p of c.eco.peers) {
      p.x = sc.x + 0.2;
      p.z = sc.z + 0.2;
    }
    const lv = c.eco.predators[0];
    lv.x = sc.x;
    lv.z = sc.z;
    for (let f = 0; f < 15 * 60; f++) {
      for (const p of c.eco.peers) {
        p.x = sc.x + 0.15;
        p.z = sc.z + 0.15;
      }
      lv.x = sc.x;
      lv.z = sc.z;
      c.eco.step(1 / 60, c);
    }
    return { saves: c.eco.stats.sanctuarySaves, predations: c.eco.stats.predations };
  };
  const onRes = runSanctuaryAudit(true);
  const offRes = runSanctuaryAudit(false);
  assert(onRes.predations === 0 && onRes.saves > 0, `Sanctuary ward ON must block predation inside Big-Tree canopy: ${JSON.stringify(onRes)}`);
  assert(offRes.predations > 0, `Sanctuary ward OFF must suffer Leviathan predation: ${JSON.stringify(offRes)}`);
  console.log(
    `[PASS] GATE-DOME-REFUGE V4 Sanctuary Causal Audit: Ward_ON(predations=${onRes.predations}, saves=${onRes.saves}) vs Ward_OFF(predations=${offRes.predations})`
  );
}

console.log('=== ALL PASS 20 VERIFICATION GATES PASSED 100%! ===');
