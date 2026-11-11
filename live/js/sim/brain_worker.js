// Off-main-thread Web Worker host for the spiking Brain (S / M / L / XL / XXL).
// Steps the large 3-compartment laminar cortical, hippocampal and thalamic sheets off the UI/WebGL thread
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
    brain = new mod.Brain(msg.seed || 1, msg.scale || 'M');
    // Start THAL / CTX / HIP sheets near their steady-state homeostatic resting bias so offloaded sheets fire immediately on attach
    if (brain.scale !== 'S') { brain.regBias[1] = 0.44; brain.regBias[2] = 0.44; brain.regBias[3] = 0.42; }
    spkAccum = new Uint8Array(brain.N);
    batchCount = 0;
    if (msg.useWebGPU && globalThis.navigator?.gpu) {
      const { WebGPUBrainAccelerator } = await import('./webgpu_brain.js');
      const gpu = await WebGPUBrainAccelerator.create(brain);
      if (gpu) { brain.gpu = gpu; brain.backend = 'Worker+WebGPU'; }
      else brain.backend = 'WebWorker-CSR';
    } else {
      brain.backend = 'WebWorker-CSR';
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
    if (msg.ofcApp && msg.ofcAv) brain.driveOFCColumns(msg.ofcApp, msg.ofcAv);

    spkAccum.fill(0);
    const sub = msg.substeps || 8;
    const dt = msg.dt || (1 / 60) / sub;
    if (brain.gpu) {
      await brain.gpu.stepSubsteps(brain, sub, dt, spkAccum);
    } else {
      for (let s = 0; s < sub; s++) {
        brain.step(dt);
        for (let i = 0; i < brain.N; i++) if (brain.spk[i]) spkAccum[i] |= 1;
      }
    }
    batchCount++;
    if (msg.runSlow || batchCount % 2 === 0) {
      brain.slow(msg.slowDt || 0.02, stage, msg.achGain ?? msg.achMetaGain ?? 1);
    }
    const stepMs = performance.now() - t0;

    const rateOut = new Float32Array(brain.rate);
    const spkOut = new Uint8Array(spkAccum);
    const regOut = new Float32Array(brain.regRate);
    const astroOut = new Float32Array(brain.astro);
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
        dwLast: brain.dwLast || 0,
        backend: brain.backend,
        stepMs,
      },
      [rateOut.buffer, spkOut.buffer, regOut.buffer, astroOut.buffer]
    );
  }
};
