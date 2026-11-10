// Shipped starter genome.
// Motor part: evolved by test/evolve_genome.mjs (CMA-ES, lambda 16, start = centre of the gene bounds, sigma 0.3) in two runs on training bodies 1-3: run 1, 43 generations
// (688 genomes) from the centre of the gene bounds, whose fitness counted displacement in any direction (a bug: it favoured
// sideways gaits); run 2, 30 generations (496 genomes) warm-started from run 1's mean with travel measured along the body's
// heading and sideways travel penalised (run 2's best-ever genome, generation 4, shipped in pass 12). Pass 14: run 3, 24 generations x 16 on
// bodies 1-2 with brain M, warm-started from that genome (sigma 0.1), 'rough' fitness (rocks and springs kept, plus a zigzag trial whose
// turn command switches side every 1.5 s, extra weight on staying upright). This is run 3's final CMA-ES mean (more robust on held-out
// bodies 4-9 than its single best-ever sample). Fitness and held-out results: CHANGELOG pass 12 and pass 14.
// Steering part (sense -> MOT): see STEER below.
import { HAND_STEER } from './genome.js';
export const MOTOR = {"segAg0": 2.4569, "segAg1": 1.0739, "segAnt0": 0, "segAnt1": -1.0881, "segTop": 1.07, "segRad": -0.562, "wvAsc": 0, "wvDesc": 1.4548, "sF": 2.8955, "sB": -1.488, "gF": 2.3483, "gB": -1.0579, "eF": 1.615, "eB": -0.7697, "eB2": -0.5388, "cS": 1.4034, "cO": -0.908, "rS": 2.3852, "rO": -1.3256, "tauA": 0.7211, "cf": 2.1274, "aS": 2.0054, "aR1": -0.0652, "aR2": 1.5306, "aG": -0.8877, "cturn": 1.8161, "legTurn": -1.7789, "t0": 1.8711, "t1": 1.187, "tAnt": -0.3327, "tRad0": 0.8461, "tRad1": 2.3932, "tGripIn": 0.1391, "tGripOut": -1.4816, "tSwIn": 1.9291, "tSwOut": 0.0271, "tExIn": -0.4595, "tExOut": -1.4501, "tArmIn": 1.8777, "tArmOut": -1.4241, "lift": 0.6862, "rLeg": 1.4872, "rArm": 2.1711, "rVent": 1.9805};
export const STEER = { ...HAND_STEER };
export const STARTER = { ...MOTOR, ...STEER };
export const STARTER_INFO = { source: 'motor: evolved (CMA-ES, runs of 43 + 30 + 24 generations); steer: hand-set', turnGain0: 1.36 };
