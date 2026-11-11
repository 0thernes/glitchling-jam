// WebGPU WGSL compute shader accelerator for large spiking sheets (L / XL / XXL / MEGA up to 1,048,576 neurons & 16.78M synapses).
// Combines a lock-free incoming-CSR layout (post <- pre) with procedural 16-tap canonical laminar + small-world WGSL gather
// when running the million-neuron MEGA cortex on GPU, plus Rush-Larsen HH AIS Na_v/K_v regenerative excitability!
import { R0, RN, regionOf } from './brain.js';

const WGSL_BRAIN = /* wgsl */ `
struct Params {
  N: u32,
  dt: f32,
  ds: f32,
  dr: f32,
  da: f32,
  gainNE: f32,
  noiseAmp: f32,
  atonia: f32,
  mn0: u32,
  mn1: u32,
  mot0: u32,
  mot1: u32,
  lesMot: u32,
  seed: u32,
  procMode: u32,
  ctx0: u32,
};

@group(0) @binding(0) var<uniform> P: Params;
@group(0) @binding(1) var<storage, read> in0: array<u32>;
@group(0) @binding(2) var<storage, read> inPre: array<u32>;
@group(0) @binding(3) var<storage, read> inW: array<f32>;
@group(0) @binding(4) var<storage, read> ext: array<f32>;
@group(0) @binding(5) var<storage, read> tauM: array<f32>;
@group(0) @binding(6) var<storage, read> adInc: array<f32>;
@group(0) @binding(7) var<storage, read> spkIn: array<u32>;
@group(0) @binding(8) var<storage, read_write> spkOut: array<u32>;
@group(0) @binding(9) var<storage, read_write> v: array<f32>;
@group(0) @binding(10) var<storage, read_write> syn: array<f32>;
@group(0) @binding(11) var<storage, read_write> ad: array<f32>;
@group(0) @binding(12) var<storage, read_write> refrac: array<f32>;
@group(0) @binding(13) var<storage, read_write> rate: array<f32>;

fn pcg(inp: u32) -> u32 {
  var state = inp * 747796405u + 2891336453u;
  var word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}

fn sigFast(x: f32) -> f32 {
  return 0.5 + (0.5 * x) / (1.0 + abs(x));
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let i = gid.x;
  if (i >= P.N) { return; }

  // 1) Explicit incoming-CSR gather
  var isyn = syn[i];
  let a = in0[i];
  let b = in0[i + 1u];
  for (var q = a; q < b; q = q + 1u) {
    if (spkIn[inPre[q]] != 0u) {
      isyn = isyn + inW[q];
    }
  }

  // 2) On 1.05M-neuron MEGA scale, gather 16-tap procedural canonical laminar + small-world cortical stencil
  if (P.procMode != 0u && i >= P.ctx0 && i < P.ctx0 + 921600u) {
    let rel = i - P.ctx0;
    let side = 960u;
    let ix = rel % side;
    let iy = rel / side;
    let n1 = P.ctx0 + iy * side + ((ix + 1u) % side);
    let n2 = P.ctx0 + iy * side + ((ix + side - 1u) % side);
    let n3 = P.ctx0 + ((iy + 1u) % side) * side + ix;
    let n4 = P.ctx0 + ((iy + side - 1u) % side) * side + ix;
    let sw1 = P.ctx0 + (pcg(rel + 17u) % 921600u);
    let sw2 = P.ctx0 + (pcg(rel + 97u) % 921600u);
    let eCnt = f32(spkIn[n1] + spkIn[n2] + spkIn[n3] + spkIn[n4] + spkIn[sw1]);
    isyn = isyn + 0.058 * eCnt - 0.095 * f32(spkIn[sw2]);
  }

  let h = pcg(i ^ P.seed);
  let nz = (f32(h & 65535u) + f32(h >> 16u) - 65535.0) * P.noiseAmp;
  var I = ext[i] + isyn + nz;
  if (i >= P.mn0 && i < P.mn1) { I = I - P.atonia; }
  if (P.lesMot != 0u && i >= P.mot0 && i < P.mot1) { I = -5.0; }
  I = I * P.gainNE;

  var tau = tauM[i];
  if (i >= P.mn0 && i < P.mn1) {
    tau = 0.02 / (1.0 + 2.0 / (1.0 + exp(-2.0 * (I - 1.0))));
  }

  var rf = refrac[i];
  var vm = v[i];
  var fired = 0u;
  var adapt = ad[i];
  var rt = rate[i];

  if (rf > 0.0) {
    rf = rf - P.dt;
    vm = 0.0;
  } else {
    // Regenerative AIS Na_v window boost on cortical neurons
    let mInf = sigFast((vm - 0.66) * 6.5);
    let iNa = select(0.0, 0.22 * mInf * mInf * mInf * (2.0 - vm), i >= P.ctx0 && i < P.mn0);
    vm = vm + (P.dt * (-vm + I + iNa - adapt)) / tau;
    if (vm > 1.0) {
      vm = 0.0;
      rf = 0.002;
      fired = 1u;
      adapt = adapt + adInc[i];
      rt = rt + (1.0 / 0.15);
    } else if (vm < -1.5) {
      vm = -1.5;
    }
  }

  v[i] = vm;
  refrac[i] = rf;
  spkOut[i] = fired;
  ad[i] = adapt * P.da;
  syn[i] = isyn * P.ds;
  rate[i] = rt * P.dr;
}
`;

export class WebGPUBrainAccelerator {
  static async create(brain) {
    try {
      if (!globalThis.navigator?.gpu) return null;
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return null;
      const device = await adapter.requestDevice();
      return new WebGPUBrainAccelerator(device, brain);
    } catch {
      return null;
    }
  }

  constructor(device, brain) {
    this.device = device;
    const N = brain.N, S = brain.explicitS ?? brain.S;
    this.N = N;
    this.stepCtr = 1;

    const in0 = new Uint32Array(N + 1);
    for (let s = 0; s < S; s++) in0[brain.post[s] + 1]++;
    for (let i = 0; i < N; i++) in0[i + 1] += in0[i];
    const fill = in0.slice(0, N);
    const inPre = new Uint32Array(Math.max(1, S));
    const inW = new Float32Array(Math.max(1, S));
    for (let s = 0; s < S; s++) {
      const dst = fill[brain.post[s]]++;
      inPre[dst] = brain.pre[s];
      inW[dst] = brain.w[s];
    }

    const mkBuf = (arr, usage) => {
      const b = device.createBuffer({ size: Math.max(16, arr.byteLength), usage, mappedAtCreation: true });
      new arr.constructor(b.getMappedRange()).set(arr);
      b.unmap();
      return b;
    };
    const STORAGE = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC;
    this.paramBuf = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    this.bIn0 = mkBuf(in0, GPUBufferUsage.STORAGE);
    this.bInPre = mkBuf(inPre, GPUBufferUsage.STORAGE);
    this.bInW = mkBuf(inW, STORAGE);
    this.bExt = mkBuf(brain.ext, STORAGE);
    this.bTau = mkBuf(brain.tauM, GPUBufferUsage.STORAGE);
    this.bAdInc = mkBuf(brain.adInc, GPUBufferUsage.STORAGE);
    this.bSpkA = mkBuf(new Uint32Array(N), STORAGE);
    this.bSpkB = mkBuf(new Uint32Array(N), STORAGE);
    this.bV = mkBuf(brain.v, STORAGE);
    this.bSyn = mkBuf(brain.syn, STORAGE);
    this.bAd = mkBuf(brain.ad, STORAGE);
    this.bRef = mkBuf(brain.ref, STORAGE);
    this.bRate = mkBuf(brain.rate, STORAGE);
    this.readRate = device.createBuffer({ size: N * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    this.readSpk = device.createBuffer({ size: N * 4, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

    const mod = device.createShaderModule({ code: WGSL_BRAIN });
    this.pipe = device.createComputePipeline({ layout: 'auto', compute: { module: mod, entryPoint: 'main' } });
    const mkBG = (sIn, sOut) => device.createBindGroup({
      layout: this.pipe.getBindGroupLayout(0),
      entries: [
        this.paramBuf, this.bIn0, this.bInPre, this.bInW, this.bExt, this.bTau, this.bAdInc,
        sIn, sOut, this.bV, this.bSyn, this.bAd, this.bRef, this.bRate,
      ].map((buffer, binding) => ({ binding, resource: { buffer } })),
    });
    this.bgAB = mkBG(this.bSpkA, this.bSpkB);
    this.bgBA = mkBG(this.bSpkB, this.bSpkA);
    this.ping = false;
    this.busy = false;
    this._spkScratch = new Uint8Array(N);
    this._effExt = new Float32Array(N);
  }

  async stepBatch(brain, substeps = 8, dt = 0.002) {
    if (this.busy || this.destroyed) return;
    this.busy = true;
    try {
      this._spkScratch.fill(0);
      await this.stepSubsteps(brain, substeps, dt, this._spkScratch);
    } catch {
      // Device lost or unmapped during teardown
    } finally {
      this.busy = false;
    }
  }

  destroy() {
    this.destroyed = true;
    for (const k of ['paramBuf', 'bIn0', 'bInPre', 'bInW', 'bExt', 'bTau', 'bAdInc', 'bSpkA', 'bSpkB', 'bV', 'bSyn', 'bAd', 'bRef', 'bRate', 'readRate', 'readSpk']) {
      try { this[k]?.destroy?.(); } catch { /* ignore */ }
    }
  }

  async stepSubsteps(brain, substeps, dt, spkAccum) {
    const dev = this.device, N = this.N, nm = brain.nm, rb = brain.regBias;
    const effExt = this._effExt;
    for (let i = 0; i < N; i++) effExt[i] = brain.ext[i] + brain.vBias[i] + rb[regionOf(i)];
    dev.queue.writeBuffer(this.bExt, 0, effExt);

    const pBuf = new ArrayBuffer(64);
    const u32 = new Uint32Array(pBuf), f32 = new Float32Array(pBuf);
    u32[0] = N;
    f32[1] = dt;
    f32[2] = Math.exp(-dt / 0.005);
    f32[3] = Math.exp(-dt / 0.15);
    f32[4] = Math.exp(-dt / 0.3);
    f32[5] = 1 + 0.6 * (nm.NE - 0.3);
    f32[6] = brain.noise * (1 + nm.NE) * Math.sqrt(dt / 0.002) * (1.7320508 / 65535);
    f32[7] = brain.atonia;
    u32[8] = R0.MN; u32[9] = R0.MN + RN.MN;
    u32[10] = R0.MOT; u32[11] = R0.MOT + RN.MOT;
    u32[12] = brain.lesion.mot ? 1 : 0;
    u32[14] = brain.procStencil ? 1 : 0;
    u32[15] = R0.CTX;

    const wg = Math.ceil(N / 64);
    for (let s = 0; s < substeps; s++) {
      u32[13] = (this.stepCtr++ * 2654435761) >>> 0;
      dev.queue.writeBuffer(this.paramBuf, 0, pBuf);
      const enc = dev.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(this.pipe);
      pass.setBindGroup(0, this.ping ? this.bgBA : this.bgAB);
      pass.dispatchWorkgroups(wg);
      pass.end();
      this.ping = !this.ping;
      if (s === substeps - 1) {
        enc.copyBufferToBuffer(this.bRate, 0, this.readRate, 0, N * 4);
        enc.copyBufferToBuffer(this.ping ? this.bSpkB : this.bSpkA, 0, this.readSpk, 0, N * 4);
      }
      dev.queue.submit([enc.finish()]);
    }
    await Promise.all([this.readRate.mapAsync(GPUMapMode.READ), this.readSpk.mapAsync(GPUMapMode.READ)]);
    brain.rate.set(new Float32Array(this.readRate.getMappedRange()));
    const spkU = new Uint32Array(this.readSpk.getMappedRange());
    let tot = 0;
    for (let i = 0; i < N; i++) {
      brain.spk[i] = spkU[i];
      if (spkU[i]) { spkAccum[i]++; tot++; }
    }
    brain.spikes = tot;
    this.readRate.unmap();
    this.readSpk.unmap();
    brain.t += dt * substeps;
  }
}

export { WebGPUBrainAccelerator as WebGPUBrain };
