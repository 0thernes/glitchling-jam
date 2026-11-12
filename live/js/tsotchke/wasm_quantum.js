// Zero-build inline W3C WebAssembly f64 quantum statevector kernel (up to 16 qubits, DIM = 65,536) +
// Optional 18-Qubit (DIM = 262,144) WebGPU WGSL Compute-Shader Statevector Coprocessor (Pass 19).
// Assembles a valid compact WASM binary module in memory at startup and instantiates it over 32-page (2.0 MB) shared
// WebAssembly.Memory so Hadamard layers, Rz(theta) + Ising-ZZ(phi) unitary phase evolutions, CNOT ring entanglers, and
// Born norm reductions execute in native V8/browser JIT machine code (with automatic JS fallback if WebAssembly is unavailable).

function uleb(n) {
  const out = [];
  let v = n >>> 0;
  do {
    let b = v & 0x7f;
    v >>>= 7;
    if (v !== 0) b |= 0x80;
    out.push(b);
  } while (v !== 0);
  return out;
}

function sleb(n) {
  const out = [];
  let v = n | 0;
  let more = true;
  while (more) {
    let b = v & 0x7f;
    v >>= 7;
    if ((v === 0 && (b & 0x40) === 0) || (v === -1 && (b & 0x40) !== 0)) more = false;
    else b |= 0x80;
    out.push(b);
  }
  return out;
}

function section(id, payload) {
  return [id, ...uleb(payload.length), ...payload];
}

function strBytes(s) {
  const b = [...s].map((c) => c.charCodeAt(0));
  return [...uleb(b.length), ...b];
}

const I32 = 0x7f, F64 = 0x7c;

// Memory layout (byte offsets in 32-page = 2,097,152 B = 2.0 MB WebAssembly.Memory, up to 16 qubits / DIM = 65,536):
//   0         ..   524,287 : re[0..65535]       (Float64Array)
//   524,288   .. 1,048,575 : im[0..65535]       (Float64Array)
//   1,048,576 .. 1,572,863 : phaseCos[0..65535] (Float64Array)
//   1,572,864 .. 2,097,151 : phaseSin[0..65535] (Float64Array)
export const MAX_WASM_NQ = 16;
export const MAX_WASM_DIM = 65536;
export const OFF_RE = 0;
export const OFF_IM = 524288;
export const OFF_COS = 1048576;
export const OFF_SIN = 1572864;

function buildQuantumWasmBytes() {
  // Function 0: hadamardStep(halfBytes: i32, dimBytes: i32, invS2: f64) -> void
  // Locals: p0=halfBytes(i32), p1=dimBytes(i32), p2=invS2(f64) | l3=step(i32), l4=base(i32), l5=j(i32), l6=a(i32), l7=b(i32), l8=ar(f64), l9=br(f64)
  const fn0Locals = [...uleb(2), ...uleb(5), I32, ...uleb(2), F64];
  const fn0Code = [
    0x20, 0x00, 0x41, 0x01, 0x74, 0x21, 0x03, // step = halfBytes << 1
    0x41, 0x00, 0x21, 0x04,                   // base = 0
    0x02, 0x40,                               // block $exitOuter
      0x03, 0x40,                             // loop $outer
        0x20, 0x04, 0x20, 0x01, 0x4f, 0x0d, 0x01, // br_if $exitOuter (base >=u dimBytes)
        0x41, 0x00, 0x21, 0x05,               // j = 0
        0x02, 0x40,                           // block $exitInner
          0x03, 0x40,                         // loop $inner
            0x20, 0x05, 0x20, 0x00, 0x4f, 0x0d, 0x01, // br_if $exitInner (j >=u halfBytes)
            0x20, 0x04, 0x20, 0x05, 0x6a, 0x22, 0x06, // a = base + j
            0x20, 0x00, 0x6a, 0x21, 0x07,     // b = a + halfBytes
            // re[a], re[b]
            0x20, 0x06, 0x2b, 0x03, ...uleb(OFF_RE), 0x21, 0x08, // ar = f64.load(OFF_RE + a)
            0x20, 0x07, 0x2b, 0x03, ...uleb(OFF_RE), 0x21, 0x09, // br = f64.load(OFF_RE + b)
            0x20, 0x06, 0x20, 0x08, 0x20, 0x09, 0xa0, 0x20, 0x02, 0xa2, 0x39, 0x03, ...uleb(OFF_RE), // re[a] = (ar+br)*invS2
            0x20, 0x07, 0x20, 0x08, 0x20, 0x09, 0xa1, 0x20, 0x02, 0xa2, 0x39, 0x03, ...uleb(OFF_RE), // re[b] = (ar-br)*invS2
            // im[a], im[b]
            0x20, 0x06, 0x2b, 0x03, ...uleb(OFF_IM), 0x21, 0x08, // ar = f64.load(OFF_IM + a)
            0x20, 0x07, 0x2b, 0x03, ...uleb(OFF_IM), 0x21, 0x09, // br = f64.load(OFF_IM + b)
            0x20, 0x06, 0x20, 0x08, 0x20, 0x09, 0xa0, 0x20, 0x02, 0xa2, 0x39, 0x03, ...uleb(OFF_IM), // im[a] = (ai+bi)*invS2
            0x20, 0x07, 0x20, 0x08, 0x20, 0x09, 0xa1, 0x20, 0x02, 0xa2, 0x39, 0x03, ...uleb(OFF_IM), // im[b] = (ai-bi)*invS2
            0x20, 0x05, 0x41, 0x08, 0x6a, 0x21, 0x05, // j += 8
            0x0c, 0x00,                       // br $inner
          0x0b,
        0x0b,
        0x20, 0x04, 0x20, 0x03, 0x6a, 0x21, 0x04, // base += step
        0x0c, 0x00,                           // br $outer
      0x0b,
    0x0b,
    0x0b,
  ];

  // Function 1: applyDiagonalPhasesAndNorm(dimBytes: i32) -> f64
  const fn1Locals = [...uleb(2), ...uleb(1), I32, ...uleb(7), F64];
  const fn1Code = [
    0x41, 0x00, 0x21, 0x01,                   // off = 0
    0x44, 0, 0, 0, 0, 0, 0, 0, 0, 0x21, 0x08, // norm = 0.0
    0x02, 0x40,
      0x03, 0x40,
        0x20, 0x01, 0x20, 0x00, 0x4f, 0x0d, 0x01, // br_if exit (off >=u dimBytes)
        0x20, 0x01, 0x2b, 0x03, ...uleb(OFF_RE), 0x21, 0x02,  // rk
        0x20, 0x01, 0x2b, 0x03, ...uleb(OFF_IM), 0x21, 0x03,  // ik
        0x20, 0x01, 0x2b, 0x03, ...uleb(OFF_COS), 0x21, 0x04, // ck
        0x20, 0x01, 0x2b, 0x03, ...uleb(OFF_SIN), 0x21, 0x05, // sk
        // nr = rk*ck - ik*sk
        0x20, 0x02, 0x20, 0x04, 0xa2, 0x20, 0x03, 0x20, 0x05, 0xa2, 0xa1, 0x22, 0x06,
        0x20, 0x01, 0x20, 0x06, 0x39, 0x03, ...uleb(OFF_RE),
        // ni = rk*sk + ik*ck
        0x20, 0x02, 0x20, 0x05, 0xa2, 0x20, 0x03, 0x20, 0x04, 0xa2, 0xa0, 0x22, 0x07,
        0x20, 0x01, 0x20, 0x07, 0x39, 0x03, ...uleb(OFF_IM),
        // norm += nr*nr + ni*ni
        0x20, 0x08, 0x20, 0x06, 0x20, 0x06, 0xa2, 0x20, 0x07, 0x20, 0x07, 0xa2, 0xa0, 0xa0, 0x21, 0x08,
        0x20, 0x01, 0x41, 0x08, 0x6a, 0x21, 0x01, // off += 8
        0x0c, 0x00,
      0x0b,
    0x0b,
    0x20, 0x08,                               // return norm
    0x0b,
  ];

  // Function 2: cnotPair(dim: i32, cMask: i32, tMask: i32) -> void
  const fn2Locals = [...uleb(2), ...uleb(3), I32, ...uleb(1), F64];
  const fn2Code = [
    0x41, 0x00, 0x21, 0x03,                   // idx = 0
    0x02, 0x40,
      0x03, 0x40,
        0x20, 0x03, 0x20, 0x00, 0x4f, 0x0d, 0x01, // br_if exit (idx >=u dim)
        0x20, 0x03, 0x20, 0x01, 0x71,         // idx & cMask
        0x04, 0x40,                           // if != 0
          0x20, 0x03, 0x20, 0x02, 0x71, 0x45, // (idx & tMask) == 0
          0x04, 0x40,                         // if == 0
            0x20, 0x03, 0x41, 0x03, 0x74, 0x21, 0x04, // aOff = idx << 3
            0x20, 0x03, 0x20, 0x02, 0x73, 0x41, 0x03, 0x74, 0x21, 0x05, // bOff = (idx ^ tMask) << 3
            // swap re
            0x20, 0x04, 0x2b, 0x03, ...uleb(OFF_RE), 0x21, 0x06,
            0x20, 0x04, 0x20, 0x05, 0x2b, 0x03, ...uleb(OFF_RE), 0x39, 0x03, ...uleb(OFF_RE),
            0x20, 0x05, 0x20, 0x06, 0x39, 0x03, ...uleb(OFF_RE),
            // swap im
            0x20, 0x04, 0x2b, 0x03, ...uleb(OFF_IM), 0x21, 0x06,
            0x20, 0x04, 0x20, 0x05, 0x2b, 0x03, ...uleb(OFF_IM), 0x39, 0x03, ...uleb(OFF_IM),
            0x20, 0x05, 0x20, 0x06, 0x39, 0x03, ...uleb(OFF_IM),
          0x0b,
        0x0b,
        0x20, 0x03, 0x41, ...sleb(1), 0x6a, 0x21, 0x03, // idx += 1
        0x0c, 0x00,
      0x0b,
    0x0b,
    0x0b,
  ];

  const types = [
    ...uleb(3),
    0x60, ...uleb(3), I32, I32, F64, ...uleb(0),
    0x60, ...uleb(1), I32, ...uleb(1), F64,
    0x60, ...uleb(3), I32, I32, I32, ...uleb(0),
  ];
  const imports = [
    ...uleb(1),
    ...strBytes('env'),
    ...strBytes('mem'),
    0x02, 0x00, ...uleb(32), // memory min = 32 pages (2.0 MB, supports up to 16 qubits / DIM = 65,536 f64)
  ];
  const funcs = [...uleb(3), 0x00, 0x01, 0x02];
  const exportsSec = [
    ...uleb(3),
    ...strBytes('hadamardStep'), 0x00, 0x00,
    ...strBytes('applyDiagonalPhasesAndNorm'), 0x00, 0x01,
    ...strBytes('cnotPair'), 0x00, 0x02,
  ];
  const body0 = [...fn0Locals, ...fn0Code];
  const body1 = [...fn1Locals, ...fn1Code];
  const body2 = [...fn2Locals, ...fn2Code];
  const code = [
    ...uleb(3),
    ...uleb(body0.length), ...body0,
    ...uleb(body1.length), ...body1,
    ...uleb(body2.length), ...body2,
  ];

  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...section(1, types),
    ...section(2, imports),
    ...section(3, funcs),
    ...section(7, exportsSec),
    ...section(10, code),
  ]);
}

let CACHED_MOD = null;
let WASM_SUPPORTED = true;

export function createWasmQuantumKernel(dim = 65536) {
  if (!WASM_SUPPORTED || typeof WebAssembly === 'undefined' || dim > MAX_WASM_DIM) return null;
  try {
    if (!CACHED_MOD) CACHED_MOD = new WebAssembly.Module(buildQuantumWasmBytes());
    const mem = new WebAssembly.Memory({ initial: 32 });
    const inst = new WebAssembly.Instance(CACHED_MOD, { env: { mem } });
    const buf = mem.buffer;
    return {
      re: new Float64Array(buf, OFF_RE, dim),
      im: new Float64Array(buf, OFF_IM, dim),
      phaseCos: new Float64Array(buf, OFF_COS, dim),
      phaseSin: new Float64Array(buf, OFF_SIN, dim),
      hadamardAll(nQ) {
        const s = Math.SQRT1_2, dimBytes = dim << 3;
        for (let q = 0; q < nQ; q++) inst.exports.hadamardStep(1 << (q + 3), dimBytes, s);
      },
      applyDiagonalPhasesAndNorm() {
        return inst.exports.applyDiagonalPhasesAndNorm(dim << 3);
      },
      cnotRing(nQ) {
        for (let q = 0; q < nQ; q++) {
          inst.exports.cnotPair(dim, 1 << q, 1 << ((q + 1) % nQ));
        }
      },
    };
  } catch {
    WASM_SUPPORTED = false;
    return null;
  }
}

/**
 * Optional 18-Qubit (DIM = 262,144) WebGPU WGSL Compute-Shader Quantum Statevector Coprocessor.
 * Executes Hadamard butterfly layers, parameterized Rz(theta_q) + Ising ZZ(phi) unitary diagonal evolutions,
 * and 18-qubit CNOT ring gates directly on GPU storage buffers (`vec2<f32>` complex amplitudes = 2.0 MB).
 */
export const WGSL_QUANTUM_18Q = /* wgsl */ `
struct GateParams {
  mode: u32,      // 0 = Hadamard qubit q, 1 = Diagonal Rz + Ising ZZ, 2 = CNOT(cMask, tMask)
  qBit: u32,
  tMask: u32,
  zzPhi: f32,
  nQ: u32,
  dim: u32,
  pad0: u32,
  pad1: u32,
  thetas0: vec4<f32>,
  thetas1: vec4<f32>,
  thetas2: vec4<f32>,
  thetas3: vec4<f32>,
  thetas4: vec4<f32>,
};

@group(0) @binding(0) var<storage, read_write> state: array<vec2<f32>>;
@group(0) @binding(1) var<uniform> params: GateParams;

fn thetaAt(q: u32) -> f32 {
  if (q < 4u) { return params.thetas0[q]; }
  if (q < 8u) { return params.thetas1[q - 4u]; }
  if (q < 12u) { return params.thetas2[q - 8u]; }
  if (q < 16u) { return params.thetas3[q - 12u]; }
  return params.thetas4[q - 16u];
}

@compute @workgroup_size(256)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  let idx = gid.x;
  let dim = params.dim;
  let halfDim = dim >> 1u;
  if (params.mode == 0u) {
    if (idx >= halfDim) { return; }
    let half = params.qBit;
    let lo = idx & (half - 1u);
    let hi = (idx ^ lo) << 1u;
    let i0 = hi | lo;
    let i1 = i0 | half;
    let a0 = state[i0];
    let a1 = state[i1];
    let s = 0.70710678f;
    state[i0] = (a0 + a1) * s;
    state[i1] = (a0 - a1) * s;
  } else if (params.mode == 1u) {
    if (idx >= dim) { return; }
    var ang = 0.0f;
    var aligned = 0.0f;
    let nQ = params.nQ;
    for (var q = 0u; q < nQ; q = q + 1u) {
      let bq = (idx >> q) & 1u;
      if (bq == 1u) { ang = ang + thetaAt(q); }
      let nq = select(q + 1u, 0u, q + 1u == nQ);
      let bq1 = (idx >> nq) & 1u;
      aligned = aligned + select(-1.0f, 1.0f, bq == bq1);
    }
    ang = ang - params.zzPhi * aligned;
    let c = cos(ang);
    let s = sin(ang);
    let a = state[idx];
    state[idx] = vec2<f32>(a.x * c - a.y * s, a.x * s + a.y * c);
  } else if (params.mode == 2u) {
    if (idx >= dim) { return; }
    if ((idx & params.qBit) != 0u && (idx & params.tMask) == 0u) {
      let j = idx ^ params.tMask;
      let tmp = state[idx];
      state[idx] = state[j];
      state[j] = tmp;
    }
  }
}
`;
export const WGSL_QUANTUM_16Q = WGSL_QUANTUM_18Q;

export class WebGPUQuantumStatevector {
  constructor(nQ = 18) {
    this.nQ = nQ;
    this.dim = 1 << nQ;
    this.ready = false;
    this.device = null;
    this.pipeline = null;
    this.stateBuf = null;
    this.paramBuf = null;
    this.readBuf = null;
    this.bindGroup = null;
    this.steps = 0;
  }

  async init() {
    if (typeof navigator === 'undefined' || !navigator.gpu) return false;
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) return false;
      const device = await adapter.requestDevice();
      const mod = device.createShaderModule({ code: WGSL_QUANTUM_18Q });
      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: mod, entryPoint: 'main' },
      });
      const byteSize = this.dim * 8; // vec2<f32> * 262,144 = 2.0 MB
      const initAmp = new Float32Array(this.dim * 2);
      initAmp[0] = 1.0; // |0>^{⊗18}
      const stateBuf = device.createBuffer({
        size: byteSize,
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
      });
      device.queue.writeBuffer(stateBuf, 0, initAmp);

      const paramBuf = device.createBuffer({
        size: 112, // 8 u32/f32 (32B) + 5 vec4<f32> (80B) = 112B
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });
      const readBuf = device.createBuffer({
        size: 4096, // sample 512 complex amplitudes for entropy/Toeplitz seeding
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: stateBuf } },
          { binding: 1, resource: { buffer: paramBuf } },
        ],
      });
      this.device = device;
      this.pipeline = pipeline;
      this.stateBuf = stateBuf;
      this.paramBuf = paramBuf;
      this.readBuf = readBuf;
      this.bindGroup = bindGroup;
      this.ready = true;
      return true;
    } catch {
      this.ready = false;
      return false;
    }
  }

  async stepLayer(thetas, zzPhi = 0.085) {
    if (!this.ready) return null;
    const dev = this.device;
    const uBuf = new ArrayBuffer(112);
    const u32 = new Uint32Array(uBuf, 0, 8);
    const f32 = new Float32Array(uBuf);
    u32[4] = this.nQ;
    u32[5] = this.dim;
    for (let i = 0; i < this.nQ; i++) f32[8 + i] = thetas[i % thetas.length] || 0;
    f32[3] = zzPhi;

    const dispatchMode = (mode, qBit, tMask, groups) => {
      u32[0] = mode; u32[1] = qBit; u32[2] = tMask;
      dev.queue.writeBuffer(this.paramBuf, 0, uBuf);
      const enc = dev.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(this.pipeline);
      pass.setBindGroup(0, this.bindGroup);
      pass.dispatchWorkgroups(groups);
      pass.end();
      dev.queue.submit([enc.finish()]);
    };

    const halfGroups = Math.max(1, (this.dim >> 1) / 256);
    const fullGroups = Math.max(1, this.dim / 256);
    for (let q = 0; q < this.nQ; q++) dispatchMode(0, 1 << q, 0, halfGroups);
    dispatchMode(1, 0, 0, fullGroups);
    for (let q = 0; q < this.nQ; q++) dispatchMode(2, 1 << q, 1 << ((q + 1) % this.nQ), fullGroups);

    const enc = dev.createCommandEncoder();
    enc.copyBufferToBuffer(this.stateBuf, 0, this.readBuf, 0, 4096);
    dev.queue.submit([enc.finish()]);
    await this.readBuf.mapAsync(GPUMapMode.READ);
    const sample = Float32Array.from(new Float32Array(this.readBuf.getMappedRange()));
    this.readBuf.unmap();
    this.steps++;
    return sample;
  }
}
