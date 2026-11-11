// Web Worker for the in-page lineage evolution: scores a full 108-gene Hox Evo-Devo genome on paired Common-Random-Number (CRN)
// rough-ground + closed-loop steering trials off the main thread (?brain=S in worker URL).
import { evalGenome } from './fitness.js';
self.onmessage = (e) => {
  const { id, genome, seeds, secs, opts } = e.data;
  try {
    const r = evalGenome(genome, seeds, secs, opts);
    self.postMessage({ id, r });
  } catch (err) {
    self.postMessage({ id, err: String(err) });
  }
};
self.postMessage({ ready: true });
