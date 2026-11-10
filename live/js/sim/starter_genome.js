// Shipped starter genome.
// Motor part: evolved by test/evolve_genome.mjs (CMA-ES, lambda 16, start = centre of the gene bounds, sigma 0.3) in two runs on training bodies 1-3: run 1, 43 generations
// (688 genomes) from the centre of the gene bounds, whose fitness counted displacement in any direction (a bug: it favoured
// sideways gaits); run 2, 30 generations (496 genomes) warm-started from run 1's mean with travel measured along the body's
// heading and sideways travel penalised. This is run 2's best-ever genome (generation 4). Fitness and held-out results: CHANGELOG pass 12.
// Steering part (sense -> MOT): see STEER below.
import { HAND_STEER } from './genome.js';
export const MOTOR = {"segAg0": 2.4257, "segAg1": 0.9791, "segAnt0": 0, "segAnt1": -1.3355, "segTop": 0.6695, "segRad": -0.3403, "wvAsc": 0.3781, "wvDesc": 1.3203, "sF": 3.5, "sB": -0.3571, "gF": 2.0379, "gB": -0.9119, "eF": 1.6699, "eB": -1.2646, "eB2": -0.9772, "cS": 1.3118, "cO": -0.7195, "rS": 1.9232, "rO": -1.4803, "tauA": 0.8, "cf": 1.8022, "aS": 1.9978, "aR1": 0.9614, "aR2": 2, "aG": -0.6557, "cturn": 2.3538, "legTurn": -2, "t0": 2.2524, "t1": 1.4825, "tAnt": -0.0478, "tRad0": 1.7375, "tRad1": 1.4434, "tGripIn": -0.2392, "tGripOut": -2, "tSwIn": 1.4386, "tSwOut": -1.1997, "tExIn": -0.4229, "tExOut": -1.7273, "tArmIn": 0.508, "tArmOut": -2, "lift": 0.6038, "rLeg": 1.4798, "rArm": 2.2291, "rVent": 3};
export const STEER = { ...HAND_STEER };
export const STARTER = { ...MOTOR, ...STEER };
export const STARTER_INFO = { source: 'motor: evolved (CMA-ES, run 1 43 + run 2 30 generations); steer: hand-set', turnGain0: 1.36 };
