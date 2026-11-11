// Off-main-thread Web Worker host for the spiking Brain (S / M / L / XL / XXL / MEGA up to 1,048,576 neurons & 16.78M synapses).
// Steps the 4-compartment Rush-Larsen Hodgkin-Huxley laminar cortical, hippocampal and thalamic sheets off the UI/WebGL thread
// while exchanging transferable Float32Array / Uint8Array buffers with the main thread.
let brain = null;
let spkAccum = null;
let batchCount = 0;

self.onmessage = async (ev) => {
  const msg = ev.data || {};
  const kind = msg.op || msg.type;

  if (kind === 'init') {
    globalThis.BRAIN_SCALE = msg.scale || 'M';
    const mod = await import('./brain.js');
    brain = new mod.Brain(msg.seed || 1, msg.scale || 'M', msg.gen || null);
    if (brain.scale !== 'S') { brain.regBias[1] = 0.44; brain.regBias[2] = 0.44; brain.regBias[3] = 0.42; }
    // On million-neuron MEGA inside dedicated worker, use impulse-invariant sheetStride = 4 so 60fps real-time stays crisp
    if (brain.scale === 'MEGA') brain.sheetStride = 4;
    spkAccum = new Uint8Array(brain.N);
    batchCount = 0;
    if (msg.useWebGPU && globalThis.navigator?.gpu) {
      const { WebGPUBrainAccelerator } = await import('./webgpu_brain.js');
      const gpu = await WebGPUBrainAccelerator.create(brain);
      if (gpu) { brain.gpu = gpu; brain.backend = 'Worker+WebGPU'; }
      else brain.backend = brain.procStencil ? 'WebWorker-ProceduralCSR32' : 'WebWorker-CSR';
    } else {
      brain.backend = brain.procStencil ? 'WebWorker-ProceduralCSR32' : 'WebWorker-CSR';
    }
    self.postMessage({
      op: 'ready',
      type: 'ready',
      N: brain.N,
      S: brain.S,
      scale: brain.scale,
      backend: brain.backend,
    });
    return;
  }

  if ((kind === 'stepBatch' || kind === 'step') && brain) {
    const t0 = performance.now();
    const extIn = msg.extBuf ? new Float32Array(msg.extBuf) : msg.ext;
    if (extIn) brain.ext.set(extIn.subarray(0, brain.N));
    if (msg.nm) Object.assign(brain.nm, msg.nm);
    if (msg.lesion) Object.assign(brain.lesion, msg.lesion);
    if (msg.atonia !== undefined) brain.atonia = msg.atonia;
    const stage = msg.stage ?? msg.sleepStage ?? 0;
    brain.sleepStage = stage;
    if (msg.place) brain.drivePlaceCells(msg.place[0], msg.place[1], msg.place[2]);
    if (msg.v1Complex) brain.driveVisualCortex(msg.v1Complex, 0.75);
    if (msg.itAct) brain.driveITCortex(msg.itAct, 0.65);
    if (msg.ofcApp && msg.ofcAv) brain.driveOFCColumns(msg.ofcApp, msg.ofcAv);

    spkAccum.fill(0);
    const sub = msg.substeps || 8;
    const dt = msg.dt || (1 / 60) / sub;
    if (brain.gpu) {
      await brain.gpu.stepSubsteps(brain, sub, dt, spkAccum);
    } else {
      const prevDelegated = brain.delegated;
      brain.delegated = false;
      for (let s = 0; s < sub; s++) {
        brain.step(dt);
        if (brain.N > 200000) {
          // Sparse O(nSpk) spike accumulation on 1.05M-neuron MEGA sheet!
          const cnt = brain.nPrevSheetSpk || 0, lst = brain.prevSheetSpk;
          for (let q = 0; q < cnt; q++) spkAccum[lst[q]] |= 1;
          for (let q = 0; q < brain.spikes; q++) spkAccum[brain.spkList[q]] |= 1;
        } else {
          for (let i = 0; i < brain.N; i++) if (brain.spk[i]) spkAccum[i] |= 1;
        }
      }
      brain.delegated = prevDelegated;
    }
    batchCount++;
    if (msg.runSlow || batchCount % 2 === 0) {
      brain.slow(msg.slowDt || 0.02, stage, msg.achGain ?? msg.achMetaGain ?? 1);
    }
    const stepMs = performance.now() - t0;

    // On MEGA (1.05M neurons), post compact subsampled sheet rates or full rate every 4th batch to keep postMessage < 0.4ms
    const fullSend = brain.N <= 200000 || (batchCount & 3) === 1;
    const rateOut = fullSend ? new Float32Array(brain.rate) : null;
    const spkOut = fullSend ? new Uint8Array(spkAccum) : null;
    const regOut = new Float32Array(brain.regRate);
    const astroOut = new Float32Array(brain.astro);
    const xfer = [regOut.buffer, astroOut.buffer];
    if (rateOut) xfer.push(rateOut.buffer, spkOut.buffer);
    self.postMessage(
      {
        op: 'stepped',
        type: 'state',
        rate: rateOut,
        spk: spkOut,
        spkCnt: spkOut,
        regRate: regOut,
        astro: astroOut,
        nm: brain.nm,
        spikes: brain.spikes,
        stdpEvents: brain.stdpEvents,
        grown: brain.grown,
        pruned: brain.pruned,
        plateauBursts: brain.plateauBursts || 0,
        ihSagMean: brain.ihSagMean || 0.24,
        dwLast: brain.dwLast || 0,
        backend: brain.backend,
        stepMs,
      },
      xfer
    );
  }
};
