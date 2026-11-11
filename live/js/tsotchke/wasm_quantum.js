// Zero-build inline W3C WebAssembly f64 quantum statevector kernel (up to 12+ qubits, DIM = 4,096).
// Assembles a valid compact WASM binary module in memory at startup and instantiates it over shared WebAssembly.Memory
// so Hadamard layers, Rz(theta) + Ising-ZZ(phi) unitary phase evolutions, CNOT ring entanglers, and Born norm reductions
// execute in native V8/browser JIT machine code (with automatic JS fallback if WebAssembly is unavailable).

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

// Memory layout (byte offsets in 2-page = 128 KB WebAssembly.Memory, enough for up to DIM = 4,096):
//   0      .. 32,767 : re[0..4095] (Float64Array)
//   32,768 .. 65,535 : im[0..4095] (Float64Array)
//   65,536 .. 98,303 : tmpRe[0..4095] / phaseCos
//   98,304 .. 131,071: tmpIm[0..4095] / phaseSin
export const OFF_RE = 0;
export const OFF_IM = 32768;
export const OFF_COS = 65536;
export const OFF_SIN = 98304;

function buildQuantumWasmBytes() {
  // Function 0: hadamardStep(halfBytes: i32, dimBytes: i32, invS2: f64) -> void
  // Loops base = 0; base < dimBytes; base += (halfBytes << 1):
  //   j = 0; j < halfBytes; j += 8:
  //     a = base + j; b = a + halfBytes;
  //     ar = re[a]; br = re[b]; re[a] = (ar + br)*s; re[b] = (ar - br)*s;
  //     ai = im[a]; bi = im[b]; im[a] = (ai + bi)*s; im[b] = (ai - bi)*s;
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
  // Multiplies (re[k] + i im[k]) by (phaseCos[k] + i phaseSin[k]) in-place and returns sum_k (re[k]^2 + im[k]^2).
  // Params: p0=dimBytes(i32) | Locals: l1=off(i32), l2=rk(f64), l3=ik(f64), l4=ck(f64), l5=sk(f64), l6=nr(f64), l7=ni(f64), l8=norm(f64)
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
        // store re[off] = nr
        0x20, 0x01, 0x20, 0x06, 0x39, 0x03, ...uleb(OFF_RE),
        // ni = rk*sk + ik*ck
        0x20, 0x02, 0x20, 0x05, 0xa2, 0x20, 0x03, 0x20, 0x04, 0xa2, 0xa0, 0x22, 0x07,
        // store im[off] = ni
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
  // For idx = 0 .. dim-1: if ((idx & cMask) != 0 && (idx & tMask) == 0) swap amplitude idx <-> (idx ^ tMask)
  // Params: p0=dim(i32), p1=cMask(i32), p2=tMask(i32) | Locals: l3=idx(i32), l4=aOff(i32), l5=bOff(i32), l6=tmp(f64)
  const fn2Locals = [...uleb(2), ...uleb(3), I32, ...uleb(1), F64];
  const fn2Code = [
    0x41, 0x00, 0x21, 0x03,                   // idx = 0
    0x02, 0x40,
      0x03, 0x40,
        0x20, 0x03, 0x20, 0x00, 0x4f, 0x0d, 0x01, // br_if exit (idx >=u dim)
        // check (idx & cMask) != 0 && (idx & tMask) == 0
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
    0x02, 0x00, ...uleb(2), // memory min = 2 pages (128 KB)
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

export function createWasmQuantumKernel(dim = 4096) {
  if (!WASM_SUPPORTED || typeof WebAssembly === 'undefined' || dim > 4096) return null;
  try {
    if (!CACHED_MOD) CACHED_MOD = new WebAssembly.Module(buildQuantumWasmBytes());
    const mem = new WebAssembly.Memory({ initial: 2 });
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
