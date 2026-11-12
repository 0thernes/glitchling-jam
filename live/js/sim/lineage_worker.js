// Web Worker for the in-page "evolve a new lineage" option: scores one motor genome with the same fitness the offline
// CMA-ES used (js/sim/fitness.js), on the small brain (?brain=S in this worker's URL). Runs off the main thread.
import { evalGenome } from './fitness.js';
self.onmessage = (e) => { const { id, genome, seeds, secs } = e.data; try { const r = evalGenome(genome, seeds, secs); self.postMessage({ id, r }); } catch (err) { self.postMessage({ id, err: String(err) }); } };
