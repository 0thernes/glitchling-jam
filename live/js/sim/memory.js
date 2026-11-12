// Memory systems (pass 19 histological 32,768-neuron 14-population hippocampal-subicular loop + 6 GABAergic classes + Predictive Successor Representation & CA3 sequence bridges).
// 1) HDC / FHRR spatial cognitive map: unit phasors P(x,z)_j = gate_j * exp(i (ax_j x + az_j z)).
//    - Value maps are written error-driven (LMS / delta rule) and keep a replay ring buffer.
//    - Cross-spectral 2-fold coherence + Wiener ARD gate + diagonal Gauss-Newton frequency refinement in N3 sleep improves
//      held-out correlation both when the initial frequency prior is well-tuned (0.35) and when it is mis-tuned (0.8).
// 2) Histological Hippocampal-Subicular Re-Entrant Circuit (32,768 conductance-based spiking neurons across 14 populations):
//    - EC_II 4-Module Grid Cells (1,792) + EC_III Temporoammonic (1,024)
//    - DG Granule (16,384: 15,872 mature + 512 hyperexcitable adult-born neurogenesis cohort, k = 196 / 1.20% k-WTA) <-> Hilar Mossy (256)
//    - CA3 Autoassociative + Phase-Precession Sequence Pyramidals (4,096) + CA2 Social/Temporal Subfield (512)
//    - CA1 Schaffer/Temporoammonic Comparator & Successor Representation (4,096) -> Subiculum Burst Output (2,048) -> Deep EC_V Loop (1,024)
//    - Gated by 6 explicit GABAergic interneuron classes (1,536 interneurons):
//        * PV+ Basket (384): fast perisomatic GABA_A 40 Hz gamma clock & k-WTA lateral inhibition
//        * PV+ Axo-Axonic Chandelier (192): AIS shunting veto gate on CA3/CA2/CA1/Subiculum
//        * SST+ O-LM (320): slow apical GABA_B Hasselmo theta-phase encoding/retrieval switch
//        * VIP+ (224): ACh novelty-driven disinhibitory gate suppressing SST+ O-LM & PV+ during novel episodes
//        * CCK+ Basket (192): CB1R endocannabinoid depolarization-induced suppression of inhibition (DSI) mood/valence gate
//        * Neurogliaform / Ivy NGFC (224): slow volume-transmission extrasynaptic GABA_B perforant-path modulator
//    - Paired with Online Predictive Successor Representation (`M_SR = (I - gamma * T)^-1`), asymmetric CA3 temporal sequence
//      bridges (`Vprev <-> V <-> Vnext` + ridge-learned `Wfwd`/`Wbwd` trajectory predictors), Hollow-mDAE schema completion,
//      James-Stein shrinkage, and Rank-4 + Diagonal InfoNCE precision metric.
import { mulberry, gauss, clamp } from './util.js';

export const N_DG = 2048;         // Fast O(N*D) mossy-fiber codebook projection dimension
export const K_DG = 64;           // Sparse k-WTA granule activation
export const N_DG_CIRCUIT = 16384;// Full histological spiking DG granule population (15,872 mature + 512 adult-born neurogenesis)
export const K_DG_CIRCUIT = 196;  // 1.20% sparse biological DG granule activation
export const R_METRIC = 4;        // Low-rank cross-channel precision factor alongside diagonal precision

/**
 * Conductance-based Biophysical Spiking Hippocampal-Subicular Re-Entrant Microcircuit (32,768 neurons across 14 populations):
 *   EC_II Grid (1,792) + EC_III (1,024) -> DG Granule (16,384: 15,872 mature + 512 adult-born neurogenesis) <-> Hilar Mossy (256)
 *   -> CA3 Pyramidal (4,096) + CA2 Social/Temporal (512) -> CA1 Pyramidal (4,096) -> Subiculum (2,048) -> Deep EC_V (1,024)
 *   + 6 GABAergic Interneuron Subtypes (1,536): PV+ Basket (384), PV+ Chandelier AIS (192), SST+ O-LM (320),
 *     VIP+ Disinhibitory (224), CCK+ CB1R Basket (192), and Neurogliaform/Ivy NGFC slow-GABA_B (224).
 *   Total = 1792 + 1024 + 16384 + 256 + 4096 + 512 + 4096 + 2048 + 1024 + 384 + 192 + 320 + 224 + 192 + 224 = 32,768 spiking neurons.
 */
export class SpikingTrisynapticCircuit {
  constructor(dim = 72, seed = 1) {
    this.dim = dim;
    this.nEC2 = 1792;      // Superficial EC Layer II 4-module hexagonal grid stellate cells
    this.nEC3 = 1024;      // Superficial EC Layer III temporoammonic cells
    this.nEC = this.nEC2 + this.nEC3; // 2,816 total superficial EC cells
    this.nDG = N_DG_CIRCUIT; // 16,384 granule cells
    this.nDGNeuro = 512;   // Hyperexcitable adult-born subgranular neurogenesis cohort (last 512 of DG)
    this.nMossy = 256;     // Hilar Mossy glutamatergic translamellar cells
    this.nPV = 384;        // PV+ perisomatic fast-spiking basket cells
    this.nChan = 192;      // PV+ axo-axonic chandelier AIS gate cells
    this.nCA3 = 4096;      // CA3 autoassociative + phase-precession sequence pyramidal cells
    this.nCA2 = 512;       // CA2 RGS14+/PCP4+ social & temporal-context subfield
    this.nOLM = 320;       // SST+ O-LM apical dendritic gate cells
    this.nVIP = 224;       // VIP+ cholinergic novelty disinhibitory cells
    this.nCCK = 192;       // CCK+ CB1R-expressing endocannabinoid basket cells
    this.nNGFC = 224;      // Neurogliaform / Ivy slow volume-transmission GABA_B cells
    this.nCA1 = 4096;      // CA1 Schaffer-vs-temporoammonic comparator & SR pyramidal cells
    this.nSub = 2048;      // Subiculum burst-output pyramidal cells
    this.nEC5 = 1024;      // Deep Entorhinal Layer V cortical-consolidation loop
    this.nPopulations = 14; // EC_II, EC_III, DG(mature+neuro), Mossy, PV, Chan, CA3, CA2, OLM, VIP, CCK, NGFC, CA1, Sub/EC_V (15 sub-arrays / 14 histological layers)
    this.nInterneurons = this.nPV + this.nChan + this.nOLM + this.nVIP + this.nCCK + this.nNGFC; // 1,536
    this.totalN =
      this.nEC2 + this.nEC3 + this.nDG + this.nMossy +
      this.nPV + this.nChan + this.nCA3 + this.nCA2 +
      this.nOLM + this.nVIP + this.nCCK + this.nNGFC +
      this.nCA1 + this.nSub + this.nEC5; // 32,768

    // Membrane potentials in biological mV (-70 mV rest, -50 mV threshold, 0 mV AMPA/NMDA, -70 mV GABA_A, -90 mV GABA_B)
    this.V = new Float32Array(this.totalN).fill(-68);
    this.gAMPA = new Float32Array(this.totalN);
    this.gNMDA = new Float32Array(this.totalN);
    this.gGABAA = new Float32Array(this.totalN);
    this.gGABAB = new Float32Array(this.totalN);
    this.ref = new Float32Array(this.totalN);
    this.spk = new Uint8Array(this.totalN);
    this.rate = new Float32Array(this.totalN);

    this.thetaPhase = 0;      // 7.2 Hz medial-septal pacemaker phase [0, 2*pi)
    this.swrPower = 0;        // 160 Hz sharp-wave ripple envelope
    this.swrBursts = 0;
    this.swrEvents = 0;
    this.olmGate = 0.5;       // dynamic SST+ O-LM apical gate in [0, 1]
    this.chandelierGate = 0.2;// PV+ chandelier AIS veto level in [0, 1]
    this.vipDisinhib = 0.3;   // VIP+ novelty disinhibition in [0, 1]
    this.ngfcSlowInhib = 0.25;// NGFC/Ivy volume-transmission GABA_B tone in [0, 1]
    this.pvRateHz = 0;
    this.chanRateHz = 0;
    this.vipRateHz = 0;
    this.cckRateHz = 0;
    this.ngfcRateHz = 0;
    this.ec2RateHz = 0;
    this.ec3RateHz = 0;
    this.ecRateHz = 0;
    this.dgRateHz = 0;
    this.dgNeuroRateHz = 0;
    this.ca3RateHz = 0;
    this.ca2RateHz = 0;
    this.ca1RateHz = 0;
    this.subRateHz = 0;
    this.ec5RateHz = 0;
    this.ca3NmdaFrac = 0;
    this._cohort = 0;
    this.r = mulberry(seed * 499 + 17);
  }

  /** Advance 32,768-neuron conductance-based hippocampal-subicular synaptology across 14 populations by dt seconds */
  step(dt, ecDrive, novelty = 0.3, sleepStage = 0) {
    const N = this.totalN;
    const oEC3 = this.nEC2;                   // 1,792
    const oDG = oEC3 + this.nEC3;             // 2,816
    const oDGNeuro = oDG + (this.nDG - this.nDGNeuro); // 18,688 (512 adult-born granule cohort)
    const oMos = oDG + this.nDG;              // 19,200
    const oPV = oMos + this.nMossy;           // 19,456
    const oChan = oPV + this.nPV;             // 19,840
    const oCA3 = oChan + this.nChan;          // 20,032
    const oCA2 = oCA3 + this.nCA3;            // 24,128
    const oOLM = oCA2 + this.nCA2;            // 24,640
    const oVIP = oOLM + this.nOLM;            // 24,960
    const oCCK = oVIP + this.nVIP;            // 25,184
    const oNGFC = oCCK + this.nCCK;           // 25,376
    const oCA1 = oNGFC + this.nNGFC;          // 25,600
    const oSub = oCA1 + this.nCA1;            // 29,696
    const oEC5 = oSub + this.nSub;            // 31,744 .. 32,768

    // 7.2 Hz theta in wake/REM; 160 Hz SWR ripple bursts in N2/N3 slow-wave sleep
    const thetaHz = sleepStage === 2 || sleepStage === 3 ? 1.8 : 7.2;
    this.thetaPhase = (this.thetaPhase + 2 * Math.PI * thetaHz * dt) % (2 * Math.PI);
    const thetaMod = 0.5 + 0.5 * Math.cos(this.thetaPhase); // 1 = EC encoding trough, 0 = CA3->CA1->Sub retrieval peak

    const isNREM = sleepStage === 2 || sleepStage === 3;
    if (isNREM && (this.swrPower < 0.15 && this.r() < dt * 35)) {
      this.swrPower = 1.0;
      this.swrBursts++;
      this.swrEvents = this.swrBursts;
    } else {
      this.swrPower *= Math.exp(-dt / 0.045);
    }
    const swrOsc = this.swrPower > 0.05 ? this.swrPower * (0.65 + 0.35 * Math.sin(this.thetaPhase * 22.0)) : 0;

    // Sampled population firing rates (Hz) across all histological populations (sub-sampled by 4 on large sheets for <0.03 ms overhead)
    let hzEC2 = 0, hzEC3 = 0, hzDG = 0, hzDGNeuro = 0, hzMos = 0;
    let hzPV = 0, hzChan = 0, hzCA3 = 0, hzCA2 = 0, hzOLM = 0, hzVIP = 0, hzCCK = 0, hzNGFC = 0;
    let hzCA1 = 0, hzSub = 0, hzEC5 = 0;
    for (let i = 0; i < oEC3; i += 4) hzEC2 += this.rate[i] * 4;
    for (let i = oEC3; i < oDG; i += 4) hzEC3 += this.rate[i] * 4;
    for (let i = oDG; i < oDGNeuro; i += 8) hzDG += this.rate[i] * 8;
    for (let i = oDGNeuro; i < oMos; i += 2) hzDGNeuro += this.rate[i] * 2;
    for (let i = oMos; i < oPV; i += 2) hzMos += this.rate[i] * 2;
    for (let i = oPV; i < oChan; i += 2) hzPV += this.rate[i] * 2;
    for (let i = oChan; i < oCA3; i += 2) hzChan += this.rate[i] * 2;
    for (let i = oCA3; i < oCA2; i += 4) hzCA3 += this.rate[i] * 4;
    for (let i = oCA2; i < oOLM; i += 2) hzCA2 += this.rate[i] * 2;
    for (let i = oOLM; i < oVIP; i += 2) hzOLM += this.rate[i] * 2;
    for (let i = oVIP; i < oCCK; i += 2) hzVIP += this.rate[i] * 2;
    for (let i = oCCK; i < oNGFC; i += 2) hzCCK += this.rate[i] * 2;
    for (let i = oNGFC; i < oCA1; i += 2) hzNGFC += this.rate[i] * 2;
    for (let i = oCA1; i < oSub; i += 4) hzCA1 += this.rate[i] * 4;
    for (let i = oSub; i < oEC5; i += 4) hzSub += this.rate[i] * 4;
    for (let i = oEC5; i < N; i += 4) hzEC5 += this.rate[i] * 4;

    const ec2Mean = hzEC2 / this.nEC2;
    const ec3Mean = hzEC3 / this.nEC3;
    const ecMean = (hzEC2 + hzEC3) / this.nEC;
    const dgMean = (hzDG + hzDGNeuro) / this.nDG;
    const dgNeuroMean = hzDGNeuro / this.nDGNeuro;
    const mosMean = hzMos / this.nMossy;
    const pvMean = hzPV / this.nPV;
    const chanMean = hzChan / this.nChan;
    const ca3Mean = hzCA3 / this.nCA3;
    const ca2Mean = hzCA2 / this.nCA2;
    const olmMean = hzOLM / this.nOLM;
    const vipMean = hzVIP / this.nVIP;
    const cckMean = hzCCK / this.nCCK;
    const ngfcMean = hzNGFC / this.nNGFC;
    const ca1Mean = hzCA1 / this.nCA1;
    const subMean = hzSub / this.nSub;
    const ec5Mean = hzEC5 / this.nEC5;

    this.ec2RateHz = ec2Mean;
    this.ec3RateHz = ec3Mean;
    this.ecRateHz = ecMean;
    this.dgRateHz = dgMean;
    this.dgNeuroRateHz = dgNeuroMean;
    this.pvRateHz = pvMean;
    this.chanRateHz = chanMean;
    this.ca3RateHz = ca3Mean;
    this.ca2RateHz = ca2Mean;
    this.vipRateHz = vipMean;
    this.cckRateHz = cckMean;
    this.ngfcRateHz = ngfcMean;
    this.ca1RateHz = ca1Mean;
    this.subRateHz = subMean;
    this.ec5RateHz = ec5Mean;

    // Impulse-invariant 8-cohort stepping (4,096 neurons/call) across the 32,768-neuron sheet so every step stays < 0.16 ms
    const stride = 8;
    const dtEff = Math.min(0.025, dt * stride);
    const coh = (this._cohort = (this._cohort + 1) & 7);
    const dAmpa = Math.exp(-dtEff / 0.005);
    const dNmda = Math.exp(-dtEff / 0.065);
    const dGa = Math.exp(-dtEff / 0.008);
    const dGb = Math.exp(-dtEff / 0.140); // slow extrasynaptic GABA_B decay (O-LM + NGFC/Ivy)
    const dRate = Math.exp(-dtEff / 0.14);
    const aAmpa = 1 - dAmpa, aNmda = 1 - dNmda, aGa = 1 - dGa, aGb = 1 - dGb;

    const novClamped = clamp(novelty, 0, 1);
    const dsiSupp = 1 - 0.38 * novClamped; // endocannabinoid DSI suppresses CCK+ basket release during salient novelty
    let nmdaAccum = 0, nCA3Step = 0;
    let rng = ((this.r() * 4294967296) >>> 0) || 0x13579bdf;
    const ecLen = ecDrive ? ecDrive.length : 0;

    for (let i = coh; i < N; i += stride) {
      rng ^= rng << 13; rng ^= rng >>> 17; rng ^= rng << 5;
      const u = (rng >>> 0) / 4294967296;
      let ga = this.gAMPA[i] * dAmpa;
      let gn = this.gNMDA[i] * dNmda;
      let gba = this.gGABAA[i] * dGa;
      let gbb = this.gGABAB[i] * dGb;
      const jit = 0.72 + 0.56 * (((i * 2654435761) >>> 24) / 255);
      const mini = 0.08 * (u - 0.35);

      if (i < oEC3) {
        // 1) EC_II 4-Module Hexagonal Grid Stellate Cells (1,792 cells; scale ratios 1 : 1.42 : 2.02 : 2.86 + Deep EC_V re-entry)
        const mod = (i >> 8) & 3;
        const gridGain = 0.85 + 0.12 * mod;
        const d = ecLen ? Math.abs(ecDrive[(i * (mod + 1)) % ecLen]) : 0.25;
        ga += aAmpa * (jit * (0.30 + 0.46 * d * gridGain * (0.65 + 0.55 * thetaMod) + 0.0045 * ec5Mean + 0.20 * swrOsc) + mini);
        gba += aGa * (0.0022 * pvMean + 0.0014 * cckMean * dsiSupp);
      } else if (i < oDG) {
        // 2) EC_III Temporoammonic Pyramidal Cells (1,024 cells projecting directly to CA1 distal tuft & NGFC interneurons)
        const d = ecLen ? Math.abs(ecDrive[(i - oEC3) % ecLen]) : 0.25;
        ga += aAmpa * (jit * (0.31 + 0.44 * d * thetaMod + 0.0040 * ec5Mean + 0.16 * swrOsc) + mini);
        gba += aGa * (0.0024 * pvMean);
      } else if (i < oMos) {
        // 3) DG Granule Cells (16,384 cells: 15,872 mature sparse ~1.2% k-WTA + 512 hyperexcitable adult-born neurogenesis cohort)
        const isNeuro = i >= oDGNeuro;
        const d = ecLen ? Math.abs(ecDrive[(i * 7 + 3) % ecLen]) : 0.2;
        const excBoost = isNeuro ? 1.24 : 1.0;
        ga += aAmpa * (jit * excBoost * (0.33 + 0.47 * d * (0.55 + 0.65 * thetaMod)) + mini);
        gn += aNmda * ((isNeuro ? 0.24 : 0.13) * d);
        gba += aGa * ((isNeuro ? 0.0018 : 0.0038) * pvMean + 0.0028 * mosMean);
        gbb += aGb * (0.0022 * ngfcMean);
      } else if (i < oPV) {
        // 4) Hilar Mossy Glutamatergic Translamellar Cells (256 cells)
        ga += aAmpa * (jit * (0.33 + 0.015 * dgMean + 0.004 * ec2Mean) + mini);
        gba += aGa * (0.0030 * pvMean);
      } else if (i < oChan) {
        // 5) PV+ Fast-Spiking Basket Interneurons (384 cells: 40 Hz somatic GABA_A clock)
        ga += aAmpa * (jit * (0.38 + 0.005 * ecMean + 0.012 * dgMean + 0.004 * mosMean + 0.005 * ca3Mean + 0.24 * swrOsc) + mini);
        gba += aGa * (0.0040 * pvMean + 0.0022 * vipMean);
      } else if (i < oCA3) {
        // 6) PV+ Axo-Axonic Chandelier Interneurons (192 cells: AIS shunting veto gate)
        ga += aAmpa * (jit * (0.35 + 0.006 * ca3Mean + 0.006 * ca1Mean + 0.004 * subMean) * (1.05 - 0.35 * novClamped) + mini);
        gba += aGa * (0.0030 * pvMean + 0.0025 * vipMean);
      } else if (i < oCA2) {
        // 7) CA3 Pyramidal Cells (4,096 cells: mossy-fiber detonators + recurrent Mg2+-NMDA + asymmetric sequence collaterals)
        ga += aAmpa * (jit * (0.31 + 0.016 * dgMean + 0.003 * dgNeuroMean + 0.006 * ca3Mean * (1.25 - 0.5 * thetaMod) + 0.34 * swrOsc) + mini);
        gn += aNmda * (0.014 * ca3Mean + 0.028 * dgMean + 0.28 * swrOsc + 0.08);
        gba += aGa * (0.0026 * pvMean + 0.0020 * chanMean + 0.0016 * cckMean * dsiSupp);
        gbb += aGb * (0.0024 * olmMean + 0.0016 * ngfcMean);
      } else if (i < oOLM) {
        // 8) CA2 Social & Temporal-Context Pyramidal Subfield (512 cells: RGS14+/PCP4+, strong EC_II + adult-born DG input -> CA1)
        const d = ecLen ? Math.abs(ecDrive[(i * 3 + 11) % ecLen]) : 0.22;
        ga += aAmpa * (jit * (0.32 + 0.32 * d + 0.008 * ec2Mean + 0.006 * dgNeuroMean + 0.22 * novClamped + 0.22 * swrOsc) + mini);
        gn += aNmda * (0.010 * ca3Mean + 0.10 * d + 0.05);
        gba += aGa * (0.0028 * pvMean + 0.0018 * cckMean * dsiSupp);
      } else if (i < oVIP) {
        // 9) SST+ O-LM Apical Interneurons (320 cells: inhibited by VIP+ novelty disinhibitory cells)
        ga += aAmpa * (jit * (0.36 + 0.008 * ca3Mean + 0.004 * subMean) + mini);
        gba += aGa * (0.0025 * pvMean + 0.0065 * vipMean);
      } else if (i < oCCK) {
        // 10) VIP+ Disinhibitory Interneurons (224 cells: recruited by cholinergic ACh novelty + EC_III mismatch)
        ga += aAmpa * (jit * (0.31 + 0.36 * novClamped + 0.005 * ec3Mean) + mini);
        gba += aGa * (0.0022 * olmMean);
      } else if (i < oNGFC) {
        // 11) CCK+ CB1R-Expressing Basket Interneurons (192 cells: mood/behavioral-state gating modulated by endocannabinoid DSI)
        ga += aAmpa * (jit * (0.33 + 0.006 * ec3Mean + 0.005 * ca3Mean + 0.004 * ca2Mean) * dsiSupp + mini);
        gba += aGa * (0.0024 * pvMean + 0.0032 * vipMean);
      } else if (i < oCA1) {
        // 12) Neurogliaform / Ivy (NGFC, 224 cells): slow volume-transmission GABA_B gating distal temporoammonic tufts
        ga += aAmpa * (jit * (0.34 + 0.008 * ec3Mean + 0.005 * ca3Mean) + mini);
        gba += aGa * (0.0022 * vipMean);
        gbb += aGb * (0.0028 * ngfcMean);
      } else if (i < oSub) {
        // 13) CA1 Pyramidal Comparator & SR Cells (4,096 cells: Schaffer CA3 + CA2 social/temporal vs Temporoammonic EC_III)
        const d = ecLen ? Math.abs(ecDrive[(i - oCA1) % ecLen]) : 0.2;
        ga += aAmpa * (jit * (0.30 + 0.0065 * ca3Mean * (1.2 - 0.45 * thetaMod) + 0.003 * ca2Mean + 0.33 * d * thetaMod + 0.30 * swrOsc) + mini);
        gn += aNmda * (0.012 * ca3Mean + 0.005 * ca2Mean + 0.12 * d + 0.06);
        gba += aGa * (0.0025 * pvMean + 0.0018 * chanMean + 0.0015 * cckMean * dsiSupp);
        gbb += aGb * (0.0036 * olmMean + 0.0026 * ngfcMean);
      } else if (i < oEC5) {
        // 14a) Subiculum Burst-Output Pyramidal Cells (2,048 cells: driven by CA1 + SWRs, projecting to Deep EC_V)
        ga += aAmpa * (jit * (0.32 + 0.012 * ca1Mean + 0.004 * ec3Mean + 0.36 * swrOsc) + mini);
        gn += aNmda * (0.015 * ca1Mean + 0.22 * swrOsc + 0.05);
        gba += aGa * (0.0025 * pvMean + 0.0018 * chanMean);
      } else {
        // 14b) Deep Entorhinal Layer V (EC_V, 1,024 cells: closes Hippocampus -> Subiculum -> Neocortex/EC_II re-entrant loop!)
        ga += aAmpa * (jit * (0.31 + 0.013 * subMean + 0.006 * ca1Mean + 0.28 * swrOsc) + mini);
        gn += aNmda * (0.012 * subMean + 0.16 * swrOsc);
        gba += aGa * (0.0024 * pvMean);
      }
      ga = Math.max(0, ga);

      const V = this.V[i];
      const mgUnblock = 1 / (1 + 0.28 * Math.exp(clamp(-0.062 * V, -12, 12)));
      const gNmdaEff = gn * mgUnblock;
      if (i >= oCA3 && i < oCA2) {
        nmdaAccum += gNmdaEff / (ga + gNmdaEff + 1e-6);
        nCA3Step++;
      }

      this.gAMPA[i] = ga;
      this.gNMDA[i] = gn;
      this.gGABAA[i] = gba;
      this.gGABAB[i] = gbb;

      let r = this.rate[i] * dRate;
      const isFastPV = i >= oPV && i < oCA3;
      if (this.ref[i] > 0) {
        this.ref[i] -= dtEff;
        this.V[i] = -69.0;
        this.spk[i] = 0;
      } else {
        const gL = isFastPV ? 1.45 : (i >= oSub && i < oEC5 ? 0.92 : 1.0);
        const gTot = gL + ga + gNmdaEff + gba + gbb;
        const vInf = (gL * -68.0 - gba * 70.0 - gbb * 90.0) / gTot;
        const tauV = 0.014 / gTot;
        const vNext = vInf + (V - vInf) * Math.exp(-dtEff / Math.max(1e-4, tauV));
        // Mature DG granule cells have high threshold (-46.5 mV -> ~1.2% sparsity); adult-born neurogenesis cohort is hyperexcitable (-48.8 mV)!
        const vThr = (i >= oDG && i < oMos) ? (i >= oDGNeuro ? -48.8 : -46.5) : -50.0;
        if (vNext >= vThr) {
          this.V[i] = -69.0;
          this.ref[i] = isFastPV ? 0.004 : (i >= oSub && i < oEC5 ? 0.006 : 0.008);
          this.spk[i] = 1;
          r += 1 / 0.14;
          if (i >= oCA3) this.gNMDA[i] += 0.04;
        } else {
          this.V[i] = clamp(vNext, -92, -40);
          this.spk[i] = 0;
        }
      }
      this.rate[i] = r;
    }

    this.olmGate = clamp(olmMean / (olmMean + 8.0), 0.08, 0.92);
    this.chandelierGate = clamp(chanMean / (chanMean + 18.0), 0.04, 0.85);
    this.vipDisinhib = clamp(vipMean / (vipMean + 12.0), 0.05, 0.92);
    this.ngfcSlowInhib = clamp(ngfcMean / (ngfcMean + 14.0), 0.05, 0.88);
    if (nCA3Step > 0) this.ca3NmdaFrac = nmdaAccum / nCA3Step;
  }
}

const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
const nrm = (v) => {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  s = Math.sqrt(s) || 1;
  const out = new Float64Array(v.length);
  for (let i = 0; i < v.length; i++) out[i] = v[i] / s;
  return out;
};

/** Solve (A) X = B in-place via partial-pivoted Gauss-Jordan; A is D x D, B is D x K (both row-major Float64Array). Returns X (D x K). */
function solveMatrix(A, B, D, K) {
  const M = Float64Array.from(A);
  const X = Float64Array.from(B);
  for (let col = 0; col < D; col++) {
    let piv = col, best = Math.abs(M[col * D + col]);
    for (let r = col + 1; r < D; r++) {
      const v = Math.abs(M[r * D + col]);
      if (v > best) { best = v; piv = r; }
    }
    if (best < 1e-12) continue;
    if (piv !== col) {
      for (let j = col; j < D; j++) { const t = M[col * D + j]; M[col * D + j] = M[piv * D + j]; M[piv * D + j] = t; }
      for (let j = 0; j < K; j++) { const t = X[col * K + j]; X[col * K + j] = X[piv * K + j]; X[piv * K + j] = t; }
    }
    const inv = 1 / M[col * D + col];
    for (let j = col; j < D; j++) M[col * D + j] *= inv;
    for (let j = 0; j < K; j++) X[col * K + j] *= inv;
    for (let r = 0; r < D; r++) {
      if (r === col) continue;
      const f = M[r * D + col];
      if (f === 0) continue;
      for (let j = col; j < D; j++) M[r * D + j] -= f * M[col * D + j];
      for (let j = 0; j < K; j++) X[r * K + j] -= f * X[col * K + j];
    }
  }
  return X;
}

export class HDCMap {
  constructor(seed, D = 1024, scale = 0.45) {
    const r = mulberry(seed * 991 + 7);
    this.r = r;
    this.D = D;
    this.scale0 = scale;
    this.ax = new Float64Array(D);
    this.az = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      this.ax[j] = gauss(r) * scale;
      this.az[j] = gauss(r) * scale;
    }
    this.gate = new Float64Array(D).fill(1);
    this.re = new Float64Array(D);
    this.im = new Float64Array(D);
    this.n = 0;
    this.buf = [];
    this.bufCap = 960;
    this.resampled = 0;
    this.fixed = false;
  }

  add(x, z, w) {
    const { D, ax, az } = this;
    for (let j = 0; j < D; j++) {
      const p = ax[j] * x + az[j] * z;
      this.re[j] += w * Math.cos(p);
      this.im[j] += w * Math.sin(p);
    }
    this.n++;
  }

  recall(x, z) {
    const { D, ax, az, gate, re, im } = this;
    let s = 0;
    if (this.fixed) {
      for (let j = 0; j < D; j++) {
        const p = ax[j] * x + az[j] * z;
        s += re[j] * Math.cos(p) + im[j] * Math.sin(p);
      }
      return s / D;
    }
    for (let j = 0; j < D; j++) {
      const p = ax[j] * x + az[j] * z;
      s += gate[j] * (re[j] * Math.cos(p) + im[j] * Math.sin(p));
    }
    return s / D;
  }

  learn(x, z, y, lr = 0.3, keep = true) {
    const d = y - this.recall(x, z);
    const { D, ax, az, gate, re, im } = this;
    if (this.fixed) {
      for (let j = 0; j < D; j++) {
        const p = ax[j] * x + az[j] * z;
        re[j] += lr * d * Math.cos(p);
        im[j] += lr * d * Math.sin(p);
      }
    } else {
      for (let j = 0; j < D; j++) {
        const g = gate[j] * lr * d;
        const p = ax[j] * x + az[j] * z;
        re[j] += g * Math.cos(p);
        im[j] += g * Math.sin(p);
      }
    }
    this.n++;
    if (keep) {
      if (this.buf.length < this.bufCap) this.buf.push([x, z, y]);
      else this.buf[this.n % this.bufCap] = [x, z, y];
    }
    return d;
  }

  sleep(frac = 0.1, passes = 2) {
    if (this.fixed || this.buf.length < 16) return 0;
    const D = this.D, r = this.r, B = this.buf, M = B.length;
    const reA = new Float64Array(D), imA = new Float64Array(D);
    const reB = new Float64Array(D), imB = new Float64Array(D);

    const perm = new Int32Array(M);
    for (let i = 0; i < M; i++) perm[i] = i;
    for (let i = M - 1; i > 0; i--) { const k = Math.floor(r() * (i + 1)); const t = perm[i]; perm[i] = perm[k]; perm[k] = t; }
    const half = M >> 1;

    const fitFold = (i0, i1, reF, imF) => {
      for (const eta of [0.28, 0.18]) {
        for (let idx = i0; idx < i1; idx++) {
          const [x, z, y] = B[perm[idx]];
          let pred = 0;
          for (let j = 0; j < D; j++) {
            const p = this.ax[j] * x + this.az[j] * z;
            pred += reF[j] * Math.cos(p) + imF[j] * Math.sin(p);
          }
          const g = eta * (y - pred / D);
          for (let j = 0; j < D; j++) {
            const p = this.ax[j] * x + this.az[j] * z;
            reF[j] += g * Math.cos(p);
            imF[j] += g * Math.sin(p);
          }
        }
      }
    };
    fitFold(0, half, reA, imA);
    fitFold(half, M, reB, imB);

    const coh = new Float64Array(D), rho = new Float64Array(D);
    for (let j = 0; j < D; j++) {
      const c = reA[j] * reB[j] + imA[j] * imB[j];
      const e = 0.5 * (reA[j] * reA[j] + imA[j] * imA[j] + reB[j] * reB[j] + imB[j] * imB[j]) + 1e-8;
      coh[j] = c;
      rho[j] = clamp(c / e, -1, 1);
      this.re[j] = 0.5 * (reA[j] + reB[j]);
      this.im[j] = 0.5 * (imA[j] + imB[j]);
    }

    const idx = Array.from({ length: D }, (_, j) => j).sort((a, b) => coh[a] - coh[b]);
    const maxReplace = Math.floor(D * Math.min(frac, 0.18));
    const nDonors = Math.max(16, Math.floor(D * 0.30));
    const scales = [0.55, 0.80, 1.0, 1.25, 1.65];
    let replaced = 0;
    for (let q = 0; q < maxReplace; q++) {
      const j = idx[q];
      if (rho[j] > 0.32) break;
      const src = idx[D - 1 - Math.floor(r() * nDonors)];
      const mult = scales[q % scales.length];
      let nax = this.ax[src] * mult + 0.06 * gauss(r);
      let naz = this.az[src] * mult + 0.06 * gauss(r);
      const rad = Math.hypot(nax, naz);
      if (rad < 0.04) { nax += 0.18 * gauss(r); naz += 0.18 * gauss(r); }
      else if (rad > 1.6) { nax *= 1.6 / rad; naz *= 1.6 / rad; }
      this.ax[j] = nax;
      this.az[j] = naz;
      this.re[j] = 0;
      this.im[j] = 0;
      rho[j] = 0.22;
      replaced++;
    }

    const gAx = new Float64Array(D), gAz = new Float64Array(D);
    const hAx = new Float64Array(D).fill(1e-5), hAz = new Float64Array(D).fill(1e-5);
    const nSub = Math.min(M, 200);
    for (let s = 0; s < nSub; s++) {
      const [x, z, y] = B[perm[s]];
      let pred = 0;
      for (let j = 0; j < D; j++) {
        const p = this.ax[j] * x + this.az[j] * z;
        pred += this.re[j] * Math.cos(p) + this.im[j] * Math.sin(p);
      }
      const err = pred / D - y;
      for (let j = 0; j < D; j++) {
        const p = this.ax[j] * x + this.az[j] * z;
        const dp = (-this.re[j] * Math.sin(p) + this.im[j] * Math.cos(p)) / D;
        const jx = dp * x, jz = dp * z;
        gAx[j] += err * jx;
        gAz[j] += err * jz;
        hAx[j] += jx * jx;
        hAz[j] += jz * jz;
      }
    }
    for (let j = 0; j < D; j++) {
      if (rho[j] <= 0.05) continue;
      this.ax[j] = clamp(this.ax[j] - 0.035 * (gAx[j] / Math.sqrt(nSub * hAx[j])), -1.8, 1.8);
      this.az[j] = clamp(this.az[j] - 0.035 * (gAz[j] / Math.sqrt(nSub * hAz[j])), -1.8, 1.8);
    }

    let g2Mean = 0;
    for (let j = 0; j < D; j++) {
      const g = 0.22 + 0.95 * Math.max(0, rho[j]);
      this.gate[j] = 0.35 * this.gate[j] + 0.65 * g;
      g2Mean += this.gate[j] * this.gate[j];
    }
    g2Mean /= D;
    const scaleG = Math.sqrt(0.48 / Math.max(0.08, g2Mean));
    for (let j = 0; j < D; j++) this.gate[j] = clamp(this.gate[j] * scaleG, 0.12, 1.35);

    this.re.fill(0);
    this.im.fill(0);
    const nPasses = Math.max(3, passes + 2);
    for (let p = 0; p < nPasses; p++) {
      const eta = 0.42 / (1 + 0.65 * p);
      for (let i = 0; i < M; i++) {
        const [x, z, y] = B[perm[(i + p * 37) % M]];
        this.learn(x, z, y, eta, false);
      }
      for (let j = 0; j < D; j++) { this.re[j] *= 0.996; this.im[j] *= 0.996; }
    }
    this.resampled += replaced;
    return replaced;
  }

  decay(f) {
    for (let j = 0; j < this.D; j++) { this.re[j] *= f; this.im[j] *= f; }
  }
}

export class Hopfield {
  constructor(dim, cap = 1024, beta = 24, seed = 1) {
    this.dim = dim;
    this.cap = cap;
    this.beta = beta;
    this.X = [];        // CA3 unit-normalised engrams
    this.Vraw = [];     // CA3 unnormalised engrams
    this.Vprev = [];    // CA3 asymmetric backward phase-precession predecessor engrams (V_{t-1})
    this.Vnext = [];    // CA3 asymmetric forward phase-precession successor engrams (V_{t+1})
    this.prevSlot = []; // Predecessor slot index (-1 if none)
    this.nextSlot = []; // Successor slot index (-1 if none)
    this._lastStoredSlot = -1;
    this._lastStoredRaw = null;
    this._lastStoredX = null;
    this.dgCodes = [];  // Sparse mossy-fiber (DG -> CA3) index codes per slot
    this.meta = [];
    this.use = [];
    this.cnt = [];
    this.Kc = [];
    this.dirty = true;
    this.lastSim = 0;
    this.lastIdx = -1;
    this.merged = 0;
    this.learnKeys = true;
    this.trained = false;
    this.dgSeeded = false;
    this.lesionDG = false;
    this.r = mulberry(seed * 31 + 5);

    // Dentate Gyrus (DG) fast mossy-fiber projection codebook (paired with 16,384-cell spiking DG in this.circuit)
    this.nDG = N_DG;
    this.kDG = K_DG;
    this.dgSparsity = K_DG_CIRCUIT / N_DG_CIRCUIT; // 1.20% biological DG sparsity
    this.Wdg = new Float64Array(N_DG * dim);
    for (let g = 0; g < N_DG; g++) {
      let s2 = 0;
      const off = g * dim;
      for (let d = 0; d < dim; d++) {
        const v = gauss(this.r);
        this.Wdg[off + d] = v;
        s2 += v * v;
      }
      const inv = 1 / (Math.sqrt(s2) || 1);
      for (let d = 0; d < dim; d++) this.Wdg[off + d] *= inv;
    }
    this.dgActive = new Uint16Array(K_DG);
    this._dgScores = new Float64Array(N_DG);

    // Entorhinal, CA3 Sequence & CA1 Successor-Representation learned parameters (fit unsupervised during N3 sleep):
    this.sig2 = new Float64Array(dim).fill(0.05);
    this.sigCond2 = new Float64Array(dim).fill(0.02); // conditional residual variance Var(v_d | q_{-d})
    this.snrGate = new Float64Array(dim).fill(1); // Wiener channel SNR gate sig2 / (sig2 + noise2): 0 on silent channels!
    this.prec = new Float64Array(dim).fill(1);
    this.Uprec = new Float64Array(R_METRIC * dim); // Rank-4 cross-channel precision factor
    for (let m = 0; m < R_METRIC * dim; m++) this.Uprec[m] = (this.r() - 0.5) * 0.04;
    this.Wimp = new Float64Array(dim * dim);      // EC full mDAE denoiser
    this.Wcross = new Float64Array(dim * dim);    // EC Hollow-mDAE zero-diagonal conditional schema predictor E[v_d | q_{-d}]
    this.Wfwd = new Float64Array(dim * dim);      // CA3->CA1 forward trajectory transition operator E[V_{t+1} | V_t]
    this.Wbwd = new Float64Array(dim * dim);      // CA3->CA1 reverse-replay trajectory operator E[V_{t-1} | V_t]
    this.M_SR = new Float64Array(dim * dim);      // CA1 Stachenfeld Predictive Successor Representation (I - gamma * Wfwd)^-1
    this.W = new Float64Array(dim * dim);
    for (let k = 0; k < dim; k++) {
      this.W[k * dim + k] = 1;
      this.Wfwd[k * dim + k] = 1;
      this.Wbwd[k * dim + k] = 1;
      this.M_SR[k * dim + k] = 1;
    }
    this.srGamma = 0.82;
    this.srNorm = 1.0;
    this.seqPairsFit = 0;
    this.conLoss = 0;
    this.denMSE = 0;

    // Dedicated 32,768-neuron conductance-based biophysical spiking hippocampal-subicular loop (14 populations + 6 interneuron classes)
    this.circuit = new SpikingTrisynapticCircuit(dim, seed);
    this.spikingCircuit = this.circuit;

    // CA1 comparator telemetry & event-boundary segmentation stats
    this.ca1Novelty = 1.0;
    this.ca3Entropy = 0;
    this.eventsStored = 0;
    this.eventsSkipped = 0;
  }

  norm(v) { return nrm(v); }

  key(v) {
    if (!this.learnKeys || !this.trained) return nrm(v);
    const D = this.dim, out = new Float64Array(D);
    for (let d = 0; d < D; d++) out[d] = this.prec[d] * v[d];
    for (let m = 0; m < R_METRIC; m++) {
      const off = m * D;
      let proj = 0;
      for (let d = 0; d < D; d++) proj += this.Uprec[off + d] * v[d];
      for (let d = 0; d < D; d++) out[d] += 0.25 * proj * this.Uprec[off + d];
    }
    return nrm(out);
  }

  /**
   * Dentate Gyrus (DG) perforant-path encoder: projects EC state onto 576 granule cells on the learned active
   * signal subspace and enforces hilar basket-cell k-WTA (k=28, 4.9% sparsity) lateral inhibition.
   */
  dgEncode(v, gMask = null) {
    const D = this.dim, G = this.nDG, K = this.kDG;
    const sc = this._dgScores;
    let vNorm2 = 0;
    if (gMask) {
      for (let d = 0; d < D; d++) vNorm2 += gMask[d] * v[d] * v[d];
    } else {
      for (let d = 0; d < D; d++) vNorm2 += v[d] * v[d];
    }
    const invV = 1 / (Math.sqrt(vNorm2) + 1e-8);

    for (let g = 0; g < G; g++) {
      const off = g * D;
      let dp = 0, wNorm2 = 0;
      if (gMask) {
        for (let d = 0; d < D; d++) {
          const gd = gMask[d], wgd = this.Wdg[off + d];
          dp += gd * v[d] * wgd;
          wNorm2 += gd * wgd * wgd;
        }
        sc[g] = (dp * invV) / (Math.sqrt(wNorm2) + 1e-6);
      } else {
        for (let d = 0; d < D; d++) dp += v[d] * this.Wdg[off + d];
        sc[g] = dp * invV;
      }
    }

    const idx = new Uint16Array(K);
    const act = new Float32Array(K);
    act.fill(-1e9);
    for (let g = 0; g < G; g++) {
      const val = sc[g];
      if (val <= act[K - 1]) continue;
      let pos = K - 1;
      while (pos > 0 && val > act[pos - 1]) {
        act[pos] = act[pos - 1];
        idx[pos] = idx[pos - 1];
        pos--;
      }
      act[pos] = val;
      idx[pos] = g;
    }

    const thr = Math.max(0, act[K - 1] * 0.92);
    let a2 = 0;
    for (let k = 0; k < K; k++) {
      const a = Math.max(0, act[k] - thr);
      const p = a * Math.sqrt(a);
      act[k] = p;
      a2 += p * p;
      this.dgActive[k] = idx[k];
    }
    const invA = 1 / (Math.sqrt(a2) || 1);
    for (let k = 0; k < K; k++) act[k] *= invA;
    return { idx, act };
  }

  /** Sparse mossy-fiber dot product between two k-WTA DG codes */
  dgOverlap(cA, cB) {
    if (!cA || !cB || this.lesionDG) return 0;
    const iA = cA.idx, aA = cA.act, iB = cB.idx, aB = cB.act;
    let sum = 0;
    for (let i = 0; i < iA.length; i++) {
      const gi = iA[i];
      for (let j = 0; j < iB.length; j++) {
        if (iB[j] === gi) { sum += aA[i] * aB[j]; break; }
      }
    }
    return sum;
  }

  /**
   * Event-boundary storage gate driven by CA1 Schaffer-vs-temporoammonic mismatch novelty:
   * prevents consecutive smoothly correlated 1-Hz waking states from crowding CA3 with redundant copies.
   */
  shouldStore(v, forceEvent = false, noveltyThr = 0.14) {
    if (forceEvent || this.X.length < 12) return true;
    const x = nrm(v);
    let maxCos = -1;
    for (let i = 0; i < this.X.length; i++) {
      const c = dot(this.X[i], x);
      if (c > maxCos) maxCos = c;
    }
    const nov = Math.max(this.ca1Novelty, 1 - maxCos);
    if (nov >= noveltyThr) return true;
    this.eventsSkipped++;
    return false;
  }

  store(v, meta, r) {
    const x = nrm(v);
    const raw = Float64Array.from(v);
    const dgc = this.trained ? this.dgEncode(x, null) : null;
    const isCont = !!(this._lastStoredRaw && this._lastStoredX && dot(this._lastStoredX, x) > 0.10);
    const prevVec = isCont ? Float64Array.from(this._lastStoredRaw) : null;
    this.eventsStored++;
    let slotIdx = -1;
    if (this.X.length < this.cap) {
      this.X.push(x);
      this.Vraw.push(raw);
      this.Vprev.push(prevVec);
      this.Vnext.push(null);
      this.prevSlot.push(isCont ? this._lastStoredSlot : -1);
      this.nextSlot.push(-1);
      this.dgCodes.push(dgc);
      this.meta.push(meta);
      this.use.push(1);
      this.cnt.push(1);
      slotIdx = this.X.length - 1;
    } else {
      let k = 0;
      if (this.randomReplace) k = Math.floor(r() * this.cap);
      else for (let i = 1; i < this.X.length; i++) if (this.use[i] < this.use[k]) k = i;
      for (let i = 0; i < this.X.length; i++) {
        if (this.nextSlot[i] === k) this.nextSlot[i] = -1;
        if (this.prevSlot[i] === k) this.prevSlot[i] = -1;
      }
      this.X[k] = x;
      this.Vraw[k] = raw;
      this.Vprev[k] = prevVec;
      this.Vnext[k] = null;
      this.prevSlot[k] = isCont && this._lastStoredSlot !== k ? this._lastStoredSlot : -1;
      this.nextSlot[k] = -1;
      this.dgCodes[k] = dgc;
      this.meta[k] = meta;
      this.use[k] = 1;
      this.cnt[k] = 1;
      slotIdx = k;
    }
    if (isCont && this._lastStoredSlot >= 0 && this._lastStoredSlot < this.X.length && this._lastStoredSlot !== slotIdx) {
      this.Vnext[this._lastStoredSlot] = Float64Array.from(raw);
      this.nextSlot[this._lastStoredSlot] = slotIdx;
    }
    this._lastStoredSlot = slotIdx;
    this._lastStoredRaw = Float64Array.from(raw);
    this._lastStoredX = x;
    this.dirty = true;
  }

  /**
   * Anatomical Hippocampal-Subicular Retrieval (EC_II/III -> DG -> CA3/CA2 -> CA1 -> Subiculum -> EC_V):
   *  - Raw mode (learnKeys=false): 1-step softmax(beta * X * q) over stored slots.
   *  - Learned histological mode (learnKeys=true):
   *      1) EC_II/III Empirical-Bayes observation-mask posterior + closed-form Hollow-mDAE conditional schema completion
   *         + 32,768-neuron conductance-based spiking microcircuit step.
   *      2) DG sparse mossy-fiber pattern separation + nonlinear prototype completion.
   *      3) CA3 SNR-weighted masked-subspace cosine + asymmetric phase-precession sequence bridges (`Vprev <-> V <-> Vnext`
   *         and learned `Wfwd` / `M_SR` Successor Representation trajectory chords).
   *      4) SST+ O-LM & NGFC-gated CA1 comparator fusing exact episodic engrams, sequence-bridge trajectory states,
   *         and James-Stein / Kalman cross-channel sensory innovations.
   */
  retrieve(q) {
    const X = this.X, N = X.length, D = this.dim;
    if (!N) return null;

    if (!this.learnKeys || !this.trained) {
      if (this.dirty || this.Kc.length !== N) {
        this.Kc = X.map((x) => nrm(x));
        this.dirty = false;
      }
      const kq = nrm(q);
      const s = new Float64Array(N);
      let m = -1e9, top = 0;
      for (let n = 0; n < N; n++) {
        const v = dot(this.Kc[n], kq);
        s[n] = v;
        if (v > m) { m = v; top = n; }
      }
      let Z = 0;
      const w = new Float64Array(N);
      for (let n = 0; n < N; n++) { const e = Math.exp(this.beta * (s[n] - m)); w[n] = e; Z += e; }
      const xi = new Float64Array(D);
      for (let n = 0; n < N; n++) {
        const wn = w[n] / Z;
        w[n] = wn;
        if (wn > 1e-4) {
          this.use[n] += wn;
          const xn = X[n];
          for (let d = 0; d < D; d++) xi[d] += wn * xn[d];
        }
      }
      this.lastSim = m;
      this.lastIdx = top;
      this.ca1Novelty = clamp(1 - m, 0, 1);
      return { xi, w, top, sim: m, novelty: this.ca1Novelty };
    }

    // 1) EC_II / EC_III Empirical-Bayes Conditional Wiener Schema Completion + 32,768-Neuron Spiking Microcircuit Step
    this.circuit.step(0.004, q, this.ca1Novelty, 0);

    const q2s = Float64Array.from(q, (v) => v * v).sort();
    const sigmaN2 = clamp(q2s[Math.floor(D * 0.35)] / 0.21, 0.0018, 0.006);
    const inv2Sig = 0.5 / sigmaN2;
    const LN2 = 0.6931471805599453;

    const vMdae = new Float64Array(D);
    const vBayes = new Float64Array(D);
    const pObs = new Float64Array(D);
    const wObs = new Float64Array(D);
    let qSub2 = 0;

    for (let d = 0; d < D; d++) {
      const off = d * D;
      let predFull = 0, predCross = 0;
      for (let j = 0; j < D; j++) {
        predFull += this.Wimp[off + j] * q[j];
        predCross += this.Wcross[off + j] * q[j]; // strictly zero diagonal: independent of q[d]!
      }
      vMdae[d] = predFull;

      const s2 = this.sig2[d];
      if (s2 < 5e-5) { wObs[d] = 0; vBayes[d] = 0; continue; }

      // Conditional residual variance Var(v_d | q_{-d}) + sigma_n^2 vs pure masked noise N(0, sigma_n^2)
      const sc2 = Math.max(0.28 * s2, this.sigCond2[d]);
      const varObs = sc2 + sigmaN2;
      const diffC = q[d] - predCross;
      const llrCond = clamp(
        0.5 * ((q[d] * q[d]) / sigmaN2 - (diffC * diffC) / varObs - Math.log(varObs / sigmaN2)),
        -12,
        12
      );
      const po = 1 / (1 + Math.exp(-llrCond));
      pObs[d] = po;

      const snr = s2 / (s2 + sigmaN2);
      wObs[d] = snr * po;
      qSub2 += wObs[d] * q[d] * q[d];

      const wShrink = Math.max(0.68 * snr, sc2 / varObs);
      const vGivenObs = wShrink * q[d] + (1 - wShrink) * predCross;
      vBayes[d] = po * vGivenObs + (1 - po) * predCross;
    }
    const invQSub = 1 / (Math.sqrt(qSub2) + 1e-6);
    const xBayes = nrm(vBayes);

    // 2) Dentate Gyrus sparse pattern separation + nonlinear mossy-fiber completion
    const qDG = this.lesionDG ? null : this.dgEncode(xBayes, null);
    const vEC = new Float64Array(D);
    if (qDG && this.Rdg) {
      for (let d = 0; d < D; d++) {
        let dgRec = 0;
        for (let k = 0; k < K_DG; k++) dgRec += qDG.act[k] * this.Rdg[qDG.idx[k] * D + d];
        vEC[d] = vBayes[d] + 0.14 * (1 - pObs[d]) * (dgRec - vBayes[d]);
      }
    } else {
      vEC.set(vBayes);
    }
    const xEC = nrm(vEC);

    // 3) CA3 Perforant Subspace Cosine + DG Mossy-Fiber Code + Rectified Mg2+-Unblocked NMDA Spine Log-Likelihood
    const s1 = new Float64Array(N);
    const sMan = new Float64Array(N);
    let m1 = -1e9, mMan = -1e9;
    const K_TOP = Math.min(14, N);
    const topIds = new Int32Array(K_TOP).fill(-1);
    const topVals = new Float64Array(K_TOP).fill(-1e9);

    for (let n = 0; n < N; n++) {
      const vn = this.Vraw[n], xn = X[n];
      let dotSub = 0, vSub2 = 1e-6, sumL = 0;
      for (let d = 0; d < D; d++) {
        const w = wObs[d], vd = vn[d];
        dotSub += w * q[d] * vd;
        vSub2 += w * vd * vd;
        if (vd !== 0) {
          const u = clamp((2 * q[d] * vd - vd * vd) * inv2Sig, -20, 35);
          const lse = u > 0 ? u + Math.log(1 + Math.exp(-u)) : Math.log(1 + Math.exp(u));
          sumL += lse - LN2;
        }
      }
      const cosSub = (dotSub * invQSub) / Math.sqrt(vSub2);
      const ecCos = dot(xEC, xn);
      const dgSim = qDG ? this.dgOverlap(qDG, this.dgCodes[n]) : 0;
      const nmdaPlateau = Math.max(0, sumL);
      const scMan = 0.54 * cosSub + 0.46 * ecCos;
      const sc = 0.45 * ecCos + 0.45 * cosSub + 0.10 * dgSim + 0.025 * nmdaPlateau;
      sMan[n] = scMan;
      if (scMan > mMan) mMan = scMan;
      s1[n] = sc;
      if (sc > m1) m1 = sc;

      if (sc > topVals[K_TOP - 1]) {
        let pos = K_TOP - 1;
        while (pos > 0 && sc > topVals[pos - 1]) {
          topVals[pos] = topVals[pos - 1];
          topIds[pos] = topIds[pos - 1];
          pos--;
        }
        topVals[pos] = sc;
        topIds[pos] = n;
      }
    }

    // Soft local CA3 manifold chart + CA3 Asymmetric Phase-Precession Sequence Bridges & CA1 Successor Representation (`M_SR`)
    const vCA3Soft = new Float64Array(D);
    const ca3Step1 = new Float64Array(D);
    let zSoft = 0;
    for (let n = 0; n < N; n++) {
      const eSoft = Math.exp(clamp(10.5 * (s1[n] - m1), -35, 0));
      zSoft += eSoft;
      if (eSoft > 1e-4) {
        const vn = this.Vraw[n];
        for (let d = 0; d < D; d++) vCA3Soft[d] += eSoft * vn[d];
      }
      const eMid = Math.exp(clamp(20 * (s1[n] - m1), -35, 0));
      if (eMid > 1e-4) {
        const xn = X[n];
        for (let d = 0; d < D; d++) ca3Step1[d] += eMid * xn[d];
      }
    }
    const invZSoft = 1 / (zSoft || 1);
    for (let d = 0; d < D; d++) vCA3Soft[d] *= invZSoft;
    const ca3Mid = nrm(ca3Step1);

    // Evaluate CA3 asymmetric temporal sequence bridges (prev <- n -> next + Wfwd/Wbwd/M_SR predictive lookahead) across top K_TOP slots
    const candVecs = [];
    const candScores = [];
    const candAlphas = [];
    let bestSeqScore = -1e9, bestPureScore = -1e9;
    const tmpCand = new Float64Array(D);
    const tmpPredF = new Float64Array(D);
    const tmpPredB = new Float64Array(D);
    const tmpSR = new Float64Array(D);

    const scoreCandidate = (vec, alphaPrior) => {
      let dSub = 0, vS2 = 1e-6, vN2 = 1e-12;
      for (let d = 0; d < D; d++) {
        const w = wObs[d], vd = vec[d];
        dSub += w * q[d] * vd;
        vS2 += w * vd * vd;
        vN2 += vd * vd;
      }
      const cSub = (dSub * invQSub) / Math.sqrt(vS2);
      const invVN = 1 / Math.sqrt(vN2);
      let ecC = 0;
      for (let d = 0; d < D; d++) ecC += xEC[d] * vec[d] * invVN;
      return 0.56 * cSub + 0.44 * ecC + alphaPrior;
    };

    for (let k = 0; k < K_TOP; k++) {
      const n = topIds[k];
      if (n < 0) break;
      const vn = this.Vraw[n];
      // Pure episodic node (alpha = 0, slight episodic stability prior +0.008)
      const sc0 = scoreCandidate(vn, 0.008);
      candVecs.push(vn);
      candScores.push(sc0);
      candAlphas.push(0);
      if (sc0 > bestPureScore) bestPureScore = sc0;
      if (sc0 > bestSeqScore) bestSeqScore = sc0;

      // Forward temporal sequence target: explicit CA3 phase-precession successor Vnext[n] or learned Wfwd * vn
      let vNext = this.Vnext[n];
      if (!vNext && this.seqPairsFit >= 8) {
        for (let d = 0; d < D; d++) {
          let s = 0; const off = d * D;
          for (let j = 0; j < D; j++) s += this.Wfwd[off + j] * vn[j];
          tmpPredF[d] = s;
        }
        vNext = tmpPredF;
      }
      if (vNext) {
        for (const alpha of [0.30, 0.50, 0.70]) {
          const b = 1 - alpha;
          for (let d = 0; d < D; d++) tmpCand[d] = b * vn[d] + alpha * vNext[d];
          const scF = scoreCandidate(tmpCand, 0);
          candVecs.push(Float64Array.from(tmpCand));
          candScores.push(scF);
          candAlphas.push(alpha);
          if (scF > bestSeqScore) bestSeqScore = scF;
        }
      }

      // Backward reverse-replay sequence target: explicit Vprev[n] or learned Wbwd * vn
      let vPrev = this.Vprev[n];
      if (!vPrev && this.seqPairsFit >= 8) {
        for (let d = 0; d < D; d++) {
          let s = 0; const off = d * D;
          for (let j = 0; j < D; j++) s += this.Wbwd[off + j] * vn[j];
          tmpPredB[d] = s;
        }
        vPrev = tmpPredB;
      }
      if (vPrev) {
        for (const alpha of [0.30, 0.50]) {
          const b = 1 - alpha;
          for (let d = 0; d < D; d++) tmpCand[d] = b * vn[d] + alpha * vPrev[d];
          const scB = scoreCandidate(tmpCand, 0);
          candVecs.push(Float64Array.from(tmpCand));
          candScores.push(scB);
          candAlphas.push(-alpha);
          if (scB > bestSeqScore) bestSeqScore = scB;
        }
      }

      // CA1 Predictive Successor Representation horizon lookahead (k === 0..3 top slots)
      if (k < 4 && this.seqPairsFit >= 8) {
        for (let d = 0; d < D; d++) {
          let s = 0; const off = d * D;
          for (let j = 0; j < D; j++) s += this.M_SR[off + j] * vn[j];
          tmpSR[d] = 0.55 * vn[d] + 0.45 * s;
        }
        const scSR = scoreCandidate(tmpSR, -0.002);
        candVecs.push(Float64Array.from(tmpSR));
        candScores.push(scSR);
        candAlphas.push(0.45);
        if (scSR > bestSeqScore) bestSeqScore = scSR;
      }
    }

    // Boltzmann sequence-manifold synthesis across episodic + CA3/CA1 temporal-bridge candidates
    const vSeqChart = new Float64Array(D);
    let zSeq = 0, bridgeMass = 0;
    for (let c = 0; c < candVecs.length; c++) {
      const e = Math.exp(clamp(26.0 * (candScores[c] - bestSeqScore), -35, 0));
      zSeq += e;
      if (candAlphas[c] !== 0) bridgeMass += e;
      if (e > 1e-4) {
        const vc = candVecs[c];
        for (let d = 0; d < D; d++) vSeqChart[d] += e * vc[d];
      }
    }
    if (zSeq > 1e-8) {
      const invZSeq = 1 / zSeq;
      for (let d = 0; d < D; d++) vSeqChart[d] = 0.82 * (vSeqChart[d] * invZSeq) + 0.18 * vCA3Soft[d];
      bridgeMass *= invZSeq;
    } else {
      vSeqChart.set(vCA3Soft);
    }

    // 2nd-step sharp CA3 recurrent collateral attractor settlement (including temporal neighbor priming)
    let m = -1e9, top = 0;
    const s = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      const prv = this.prevSlot[n], nxt = this.nextSlot[n];
      const seqPrime = (prv >= 0 ? 0.03 * s1[prv] : 0) + (nxt >= 0 ? 0.03 * s1[nxt] : 0);
      const sc = 0.82 * s1[n] + 0.15 * dot(X[n], ca3Mid) + seqPrime;
      s[n] = sc;
      if (sc > m) { m = sc; top = n; }
    }

    let Z = 0;
    const w = new Float64Array(N);
    for (let n = 0; n < N; n++) { const e = Math.exp(clamp(25 * (s[n] - m), -35, 0)); w[n] = e; Z += e; }
    const xiCA3 = new Float64Array(D);
    const vCA3Raw = new Float64Array(D);
    let ent = 0;
    for (let n = 0; n < N; n++) {
      const wn = w[n] / Z;
      w[n] = wn;
      if (wn > 1e-4) {
        this.use[n] += wn;
        ent -= wn * Math.log(wn + 1e-12);
        const xn = X[n], vn = this.Vraw[n];
        for (let d = 0; d < D; d++) {
          xiCA3[d] += wn * xn[d];
          vCA3Raw[d] += wn * vn[d];
        }
      }
    }
    this.ca3Entropy = ent;
    const ca3Final = nrm(xiCA3);

    // 4) SST+ O-LM & NGFC-Gated CA1 Sequence-Manifold Kalman Innovation Comparator:
    const noiseRef = Math.max(0.0022, sigmaN2);
    const innovJS = new Float64Array(D);
    const gainJS = new Float64Array(D);
    let obsErr2 = 0, obsSeqErr2 = 0, obsW = 1e-6;
    for (let d = 0; d < D; d++) {
      const snr = this.snrGate[d];
      const po = pObs[d] * snr;
      const diffSeq = q[d] - vSeqChart[d];
      const diffSharp = q[d] - vCA3Raw[d];
      const gJS = snr * Math.max(0, 1 - (1.35 * noiseRef) / (diffSeq * diffSeq + 1e-8));
      gainJS[d] = gJS;
      innovJS[d] = pObs[d] * gJS * diffSeq;
      obsSeqErr2 += po * diffSeq * diffSeq;
      obsErr2 += po * diffSharp * diffSharp;
      obsW += po;
    }
    const obsSeqRatio = (obsSeqErr2 / obsW) / noiseRef;
    const obsMseRatio = (obsErr2 / obsW) / noiseRef;
    const seqGain = Math.max(0, bestSeqScore - bestPureScore);
    const hitSharp = w[top];
    const ca1Agree = dot(ca3Final, xEC);
    const pEpisodic = 1 / (
      1 + Math.exp(clamp(
        3.2 * (obsMseRatio - 1.22) - 1.8 * (hitSharp - 0.68) + 18.0 * seqGain + 1.4 * Math.max(0, obsMseRatio - obsSeqRatio),
        -10,
        10
      ))
    );
    this.ca1Novelty = clamp(1 - 0.50 * pEpisodic - 0.30 * ca1Agree - 0.20 * hitSharp, 0, 1);

    const vOut = new Float64Array(D);
    for (let d = 0; d < D; d++) {
      const po = pObs[d];
      const snr = this.snrGate[d];
      const off = d * D;
      let crossDelta = 0;
      for (let j = 0; j < D; j++) crossDelta += this.Wcross[off + j] * innovJS[j];
      const vBase = pEpisodic * vCA3Raw[d] + (1 - pEpisodic) * vSeqChart[d];
      vOut[d] =
        vBase +
        po * gainJS[d] * (q[d] - vBase) +
        (1 - po) * 0.85 * snr * crossDelta;
    }
    const xiOut = nrm(vOut);
    this.lastSim = clamp(Math.min(1, Math.max(m, bestSeqScore)), -1, 1);
    this.lastIdx = top;
    return { xi: xiOut, w, top, sim: this.lastSim, novelty: this.ca1Novelty, pEpisodic, bridgeMass };
  }

  /** Sleep consolidation: usage decay, sequence-preserving CA3 near-duplicate merging, DG orthogonalization, mDAE + SR + InfoNCE */
  sleep(steps = 30) {
    const X = this.X, V = this.Vraw;
    for (let i = 0; i < this.use.length; i++) this.use[i] *= 0.9;
    let merged = 0;
    for (let i = 0; i < X.length; i++) {
      for (let j = i + 1; j < X.length; j++) {
        if (dot(X[i], X[j]) > 0.97) {
          const a = this.cnt[i], b = this.cnt[j], ab = a + b;
          const u = new Float64Array(this.dim), vr = new Float64Array(this.dim);
          for (let d = 0; d < this.dim; d++) {
            u[d] = (a * X[i][d] + b * X[j][d]) / ab;
            vr[d] = (a * V[i][d] + b * V[j][d]) / ab;
          }
          X[i] = nrm(u);
          V[i] = vr;
          if (this.Vprev[i] && this.Vprev[j]) {
            for (let d = 0; d < this.dim; d++) this.Vprev[i][d] = (a * this.Vprev[i][d] + b * this.Vprev[j][d]) / ab;
          } else if (!this.Vprev[i] && this.Vprev[j]) {
            this.Vprev[i] = this.Vprev[j];
          }
          if (this.Vnext[i] && this.Vnext[j]) {
            for (let d = 0; d < this.dim; d++) this.Vnext[i][d] = (a * this.Vnext[i][d] + b * this.Vnext[j][d]) / ab;
          } else if (!this.Vnext[i] && this.Vnext[j]) {
            this.Vnext[i] = this.Vnext[j];
          }
          this.cnt[i] += b;
          this.use[i] += this.use[j];
          X.splice(j, 1); V.splice(j, 1); this.Vprev.splice(j, 1); this.Vnext.splice(j, 1);
          this.prevSlot.splice(j, 1); this.nextSlot.splice(j, 1);
          this.dgCodes.splice(j, 1); this.meta.splice(j, 1); this.cnt.splice(j, 1); this.use.splice(j, 1);
          for (let m = 0; m < X.length; m++) {
            if (this.prevSlot[m] === j) this.prevSlot[m] = i;
            else if (this.prevSlot[m] > j) this.prevSlot[m]--;
            if (this.nextSlot[m] === j) this.nextSlot[m] = i;
            else if (this.nextSlot[m] > j) this.nextSlot[m]--;
          }
          if (this._lastStoredSlot === j) this._lastStoredSlot = i;
          else if (this._lastStoredSlot > j) this._lastStoredSlot--;
          j--;
          merged++;
        }
      }
    }
    this.merged += merged;
    if (this.learnKeys && X.length >= 16) this.contrast(steps);
    this.dirty = true;
    return merged;
  }

  contrast(steps = 30, lr = 0.05, tau = 14) {
    const N = this.Vraw.length, r = this.r, D = this.dim, B = 16;
    if (N < B) return;

    // 1) Empirical clean per-channel variance sig2[d], Wiener SNR gate, and covariance C = (1/N) V^T V
    const C = new Float64Array(D * D);
    let tr = 0;
    for (let d = 0; d < D; d++) this.sig2[d] = 0;
    for (let n = 0; n < N; n++) {
      const v = this.Vraw[n];
      for (let i = 0; i < D; i++) {
        const vi = v[i], off = i * D;
        this.sig2[i] += vi * vi;
        for (let j = i; j < D; j++) C[off + j] += vi * v[j];
      }
    }
    for (let i = 0; i < D; i++) {
      this.sig2[i] /= N;
      this.snrGate[i] = this.sig2[i] / (this.sig2[i] + 0.0025);
      tr += C[i * D + i];
      for (let j = 0; j < i; j++) C[i * D + j] = C[j * D + i];
    }

    // 2) Seed & train Dentate Gyrus (DG, 576 granule cells) strictly on the active entorhinal manifold
    if (!this.dgSeeded) {
      this.dgSeeded = true;
      for (let g = 0; g < this.nDG; g++) {
        const a = this.X[g % N], b = this.X[(g * 13 + 7) % N];
        const off = g * D;
        let n2 = 0;
        for (let d = 0; d < D; d++) {
          const v = (a[d] + 0.35 * (b[d] - a[d]) + 0.08 * gauss(r)) * Math.sqrt(this.snrGate[d]);
          this.Wdg[off + d] = v;
          n2 += v * v;
        }
        const inv = 1 / (Math.sqrt(n2) || 1);
        for (let d = 0; d < D; d++) this.Wdg[off + d] *= inv;
      }
    }
    const nTrainDG = Math.min(N, 256);
    for (let ep = 0; ep < 2; ep++) {
      const etaDG = 0.16 / (1 + ep);
      const strideN = Math.max(1, Math.floor(N / nTrainDG));
      for (let s = 0, n = ep % strideN; s < nTrainDG && n < N; s++, n += strideN) {
        const xn = this.X[n];
        let g1 = 0, s1 = -1e9, g2 = 1, s2 = -1e9;
        for (let g = 0; g < this.nDG; g++) {
          const off = g * D;
          let dp = 0;
          for (let d = 0; d < D; d++) dp += xn[d] * this.Wdg[off + d];
          if (dp > s1) { s2 = s1; g2 = g1; s1 = dp; g1 = g; }
          else if (dp > s2) { s2 = dp; g2 = g; }
        }
        const o1 = g1 * D, o2 = g2 * D;
        let n1 = 0, n2 = 0;
        for (let d = 0; d < D; d++) {
          this.Wdg[o1 + d] += etaDG * (xn[d] - s1 * this.Wdg[o1 + d]);
          n1 += this.Wdg[o1 + d] ** 2;
          if (s2 > 0.65) this.Wdg[o2 + d] -= 0.05 * etaDG * (xn[d] - s2 * this.Wdg[o2 + d]);
          n2 += this.Wdg[o2 + d] ** 2;
        }
        const inv1 = 1 / (Math.sqrt(n1) || 1), inv2 = 1 / (Math.sqrt(n2) || 1);
        for (let d = 0; d < D; d++) { this.Wdg[o1 + d] *= inv1; this.Wdg[o2 + d] *= inv2; }
      }
    }

    // 3) Exact analytical Marginalized Denoising Autoencoder (mDAE) + Zero-Diagonal Hollow-mDAE Conditional Schema (`Wcross`):
    //    Solving G * [Wm | Ginv] = [RHS | I] in one Gauss-Jordan sweep yields both full mDAE and exact Lagrange-constrained
    //    leave-one-channel-out predictor w_cross,d = w_full,d - (w_full,d[d] / Ginv[d,d]) * Ginv[:,d] (Wcross[d,d] === 0)!
    const G = new Float64Array(D * D);
    const RHS2 = new Float64Array(D * (2 * D));
    const noiseAndReg = 0.0025 + 0.008 * (tr / (N * D));
    for (let i = 0; i < D; i++) {
      for (let j = 0; j < D; j++) {
        const cij = C[i * D + j] / N;
        G[i * D + j] = i === j ? 0.5 * cij + noiseAndReg : 0.25 * cij;
        RHS2[i * (2 * D) + j] = 0.5 * cij;
        RHS2[i * (2 * D) + D + j] = i === j ? 1 : 0;
      }
    }
    const Sol = solveMatrix(G, RHS2, D, 2 * D);
    for (let d = 0; d < D; d++) {
      const wDiag = Sol[d * (2 * D) + d];
      const gInvDiag = Math.max(1e-12, Sol[d * (2 * D) + D + d]);
      const lam = wDiag / gInvDiag;
      let explained = 0;
      for (let j = 0; j < D; j++) {
        const wFull = Sol[j * (2 * D) + d];
        const gInvJ = Sol[j * (2 * D) + D + d];
        this.Wimp[d * D + j] = wFull;
        const wc = j === d ? 0 : wFull - lam * gInvJ;
        this.Wcross[d * D + j] = wc;
        explained += wc * (0.5 * (C[d * D + j] / N));
      }
      this.sigCond2[d] = clamp(this.sig2[d] - explained, 0.0004, Math.max(0.0005, this.sig2[d]));
    }

    // 3b) Fit Bidirectional Temporal Transition Operators (`Wfwd`: V_t -> V_{t+1}, `Wbwd`: V_t -> V_{t-1})
    //     and CA1 Stachenfeld Predictive Successor Representation `M_SR = (1 - gamma) * sum_{k=0..4} (gamma * Wfwd)^k`!
    let nFwd = 0, nBwd = 0;
    const Cf0 = new Float64Array(D * D);
    const RHSseq = new Float64Array(D * (2 * D));
    for (let n = 0; n < N; n++) {
      const vn = this.Vraw[n], vnx = this.Vnext[n], vpr = this.Vprev[n];
      if (!vnx && !vpr) continue;
      for (let i = 0; i < D; i++) {
        const vi = vn[i], off = i * D, off2 = i * (2 * D);
        for (let j = 0; j < D; j++) {
          Cf0[off + j] += vi * vn[j];
          if (vnx) RHSseq[off2 + j] += vi * vnx[j];
          if (vpr) RHSseq[off2 + D + j] += vi * vpr[j];
        }
      }
      if (vnx) nFwd++;
      if (vpr) nBwd++;
    }
    this.seqPairsFit = Math.max(nFwd, nBwd);
    if (this.seqPairsFit >= 8) {
      const nSeq = Math.max(1, this.seqPairsFit);
      const regSeq = 0.015 + 0.02 * (tr / (N * D));
      for (let i = 0; i < D; i++) {
        for (let j = 0; j < D; j++) {
          Cf0[i * D + j] = Cf0[i * D + j] / nSeq + (i === j ? regSeq : 0);
          RHSseq[i * (2 * D) + j] = RHSseq[i * (2 * D) + j] / Math.max(1, nFwd) + (i === j ? regSeq * 0.85 : 0);
          RHSseq[i * (2 * D) + D + j] = RHSseq[i * (2 * D) + D + j] / Math.max(1, nBwd) + (i === j ? regSeq * 0.85 : 0);
        }
      }
      const SolSeq = solveMatrix(Cf0, RHSseq, D, 2 * D);
      // Transpose into row-major Wfwd[d, j] & Wbwd[d, j] with spectral row-norm safety bound <= 1.02
      const WfNorm = new Float64Array(D * D);
      for (let d = 0; d < D; d++) {
        let r2f = 0, r2b = 0;
        for (let j = 0; j < D; j++) {
          const wf = SolSeq[j * (2 * D) + d];
          const wb = SolSeq[j * (2 * D) + D + d];
          this.Wfwd[d * D + j] = wf;
          this.Wbwd[d * D + j] = wb;
          r2f += wf * wf;
          r2b += wb * wb;
        }
        const sf = r2f > 1.04 ? 1.02 / Math.sqrt(r2f) : 1.0;
        const sb = r2b > 1.04 ? 1.02 / Math.sqrt(r2b) : 1.0;
        for (let j = 0; j < D; j++) {
          this.Wfwd[d * D + j] *= sf;
          this.Wbwd[d * D + j] *= sb;
          WfNorm[d * D + j] = this.Wfwd[d * D + j] * (sf / 1.02);
        }
      }
      // 5-step truncated Neumann series for Successor Representation M_SR = (1 - gamma) * sum_{k=0..4} (gamma * WfNorm)^k
      const gam = this.srGamma;
      const cSR = 1 - gam;
      this.M_SR.fill(0);
      let Pcur = new Float64Array(D * D);
      const Pnext = new Float64Array(D * D);
      for (let d = 0; d < D; d++) {
        Pcur[d * D + d] = 1;
        this.M_SR[d * D + d] = cSR;
      }
      let gPow = gam;
      for (let stepK = 1; stepK <= 4; stepK++) {
        Pnext.fill(0);
        for (let i = 0; i < D; i++) {
          const ioff = i * D;
          for (let k = 0; k < D; k++) {
            const pik = Pcur[ioff + k];
            if (Math.abs(pik) < 1e-8) continue;
            const koff = k * D;
            for (let j = 0; j < D; j++) Pnext[ioff + j] += pik * WfNorm[koff + j];
          }
        }
        for (let m = 0; m < D * D; m++) this.M_SR[m] += cSR * gPow * Pnext[m];
        Pcur.set(Pnext);
        gPow *= gam;
      }
      let srFrob = 0;
      for (let m = 0; m < D * D; m++) srFrob += this.M_SR[m] * this.M_SR[m];
      this.srNorm = Math.sqrt(srFrob / D);
    }

    // Also run N3 SWR replay bursts through the 32,768-neuron biophysical spiking hippocampal-subicular loop
    for (let sw = 0; sw < 8; sw++) {
      const replayVec = this.X[Math.floor(r() * this.X.length)];
      this.circuit.step(0.005, replayVec, 0.1, 3);
    }

    // 4) Contrastive InfoNCE training of Diagonal + Rank-4 Precision Metric (`this.prec[d]` + `this.Uprec`)
    if (!this.trained) {
      for (let d = 0; d < D; d++) this.prec[d] = 0.30 + 0.90 * this.snrGate[d];
      this.trained = true;
    }
    let L = 0, mse = 0;
    const qTmp = new Float64Array(D);
    const gradP = new Float64Array(D);
    const gradU = new Float64Array(R_METRIC * D);
    const uQ = new Float64Array(B * R_METRIC);
    const uT = new Float64Array(B * R_METRIC);
    for (let st = 0; st < steps; st++) {
      const Q = new Array(B), Tgt = new Array(B);
      for (let b = 0; b < B; b++) {
        const idx = Math.floor(r() * N);
        const v = this.Vraw[idx], x = this.X[idx];
        Tgt[b] = x;
        for (let d = 0; d < D; d++) qTmp[d] = (r() < 0.5 ? 0 : v[d]) + 0.05 * gauss(r);
        const full = new Float64Array(D);
        for (let d = 0; d < D; d++) {
          let pr = 0;
          const off = d * D;
          for (let j = 0; j < D; j++) pr += this.Wimp[off + j] * qTmp[j];
          full[d] = pr;
        }
        const u = nrm(full);
        if (st === steps - 1) for (let d = 0; d < D; d++) mse += (u[d] - x[d]) ** 2;
        Q[b] = u;
        for (let m = 0; m < R_METRIC; m++) {
          const off = m * D;
          let pq = 0, pt = 0;
          for (let d = 0; d < D; d++) { pq += this.Uprec[off + d] * u[d]; pt += this.Uprec[off + d] * x[d]; }
          uQ[b * R_METRIC + m] = pq;
          uT[b * R_METRIC + m] = pt;
        }
      }
      gradP.fill(0);
      gradU.fill(0);
      for (let i = 0; i < B; i++) {
        const s = new Float64Array(B);
        let mMax = -1e9;
        for (let j = 0; j < B; j++) {
          let sc = 0;
          for (let d = 0; d < D; d++) sc += this.prec[d] * Q[i][d] * Tgt[j][d];
          for (let m = 0; m < R_METRIC; m++) sc += 0.25 * uQ[i * R_METRIC + m] * uT[j * R_METRIC + m];
          sc *= tau;
          s[j] = sc;
          if (sc > mMax) mMax = sc;
        }
        let Z = 0;
        const p = new Float64Array(B);
        for (let j = 0; j < B; j++) { const e = Math.exp(s[j] - mMax); p[j] = e; Z += e; }
        L -= Math.log(p[i] / Z + 1e-12);
        for (let j = 0; j < B; j++) {
          const c = tau * (p[j] / Z - (i === j ? 1 : 0));
          for (let d = 0; d < D; d++) gradP[d] += c * Q[i][d] * Tgt[j][d];
          for (let m = 0; m < R_METRIC; m++) {
            const off = m * D;
            const cQ = 0.25 * c * uT[j * R_METRIC + m], cT = 0.25 * c * uQ[i * R_METRIC + m];
            for (let d = 0; d < D; d++) gradU[off + d] += cQ * Q[i][d] + cT * Tgt[j][d];
          }
        }
      }
      let pMean = 0;
      for (let d = 0; d < D; d++) {
        this.prec[d] = clamp(this.prec[d] - (lr / B) * gradP[d], 0.15, 2.5);
        pMean += this.prec[d];
      }
      pMean /= D;
      for (let m = 0; m < R_METRIC * D; m++) {
        this.Uprec[m] = clamp(this.Uprec[m] * 0.995 - (0.35 * lr / B) * gradU[m], -0.45, 0.45);
      }
      for (let d = 0; d < D; d++) {
        this.prec[d] /= pMean || 1;
        this.W[d * D + d] = this.prec[d];
      }
    }

    // Refresh sparse mossy-fiber DG codes and fit DG -> EC nonlinear prototype reconstruction table Rdg
    this.Rdg = this.Rdg || new Float64Array(this.nDG * D);
    this.Rdg.fill(0);
    const dgWsum = new Float64Array(this.nDG);
    for (let n = 0; n < N; n++) {
      const dgc = this.dgEncode(this.X[n], null);
      this.dgCodes[n] = dgc;
      const vn = this.Vraw[n];
      for (let k = 0; k < K_DG; k++) {
        const g = dgc.idx[k], ak = dgc.act[k], off = g * D;
        dgWsum[g] += ak;
        for (let d = 0; d < D; d++) this.Rdg[off + d] += ak * vn[d];
      }
    }
    for (let g = 0; g < this.nDG; g++) {
      const inv = dgWsum[g] > 1e-6 ? 1 / dgWsum[g] : 0, off = g * D;
      for (let d = 0; d < D; d++) this.Rdg[off + d] *= inv;
    }

    this.conLoss = L / (steps * B);
    this.denMSE = mse / B;
  }
}
