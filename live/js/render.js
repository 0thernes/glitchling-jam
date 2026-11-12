// Next-Gen Three.js + p5.js HDR16F / PMREM Sky IBL / 4K UHD Bio-Observatory Renderer (Pass 19)
// Strictly READS live simulation state: 5-clade (0L/4L/6L/8L/10L) 360-tet FEM + 32 Henneman muscle fascicles + Patagium + Angler Esca,
// 16-comp Discrete Markov / 14.16M-neu 1.13B-syn GIGA spikes, 1,024 WCSPH Erythrocytes & Leukocytes + 64 Murray vessels + D3Q19 LBM,
// 256 discrete 3D micro-fauna, >5.2M microbial continuum, and 48-peer multi-species biosphere.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { NS, CH } from './sim/body.js';
import { REGIONS, R0, NNEU } from './sim/brain.js';
import { SW, SH } from './sim/skin.js';
import { WORLD } from './sim/world.js';
import { clamp } from './sim/util.js';

const HUES = [0x34f5a6, 0xff44d8, 0x38e8ff, 0xffb838];
const RING_M = 48, RING_S = 96;
const LIMB_RINGS = 14, LIMB_SIDES = 12;
const STALK_RINGS = 10, STALK_SIDES = 10;
const ANT_RINGS = 10, ANT_SIDES = 8;
const PEER_RINGS = 20, PEER_SIDES = 10;
const GRASS_COUNT = 5600;
const MAX_PEER_MESHES = 48;
const MAX_EGG_MESHES = 28;
const MAX_MICRO_FAUNA = 256;
const MUSHROOM_COUNT = 96;
const LEVIATHAN_SEGS = 24;

// 12-Tap Spiral Interleaved-Gradient-Noise GTAO + 8-Step Volumetric Crepuscular Sunbeams (HDR16F safe)
const ContactAOScatterShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uNear: { value: 0.05 },
    uFar: { value: 320.0 },
    uStrength: { value: 0.48 },
    uSunScreen: { value: new THREE.Vector2(0.5, 0.75) },
    uGodRay: { value: 0.20 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform sampler2D tDepth;
    uniform vec2 uRes;
    uniform float uNear, uFar, uStrength, uGodRay;
    uniform vec2 uSunScreen;
    varying vec2 vUv;

    float linDepth(vec2 uv) {
      float z = texture2D(tDepth, uv).x;
      float ndc = z * 2.0 - 1.0;
      return (2.0 * uNear * uFar) / max(1e-4, uFar + uNear - ndc * (uFar - uNear));
    }

    void main() {
      vec4 base = texture2D(tDiffuse, vUv);
      vec3 safeCol;
      safeCol.r = (base.r >= 0.0 && base.r <= 48.0) ? base.r : 0.0;
      safeCol.g = (base.g >= 0.0 && base.g <= 48.0) ? base.g : 0.0;
      safeCol.b = (base.b >= 0.0 && base.b <= 48.0) ? base.b : 0.0;
      float occ = 0.0;
      if (uStrength > 0.001) {
        float dC = linDepth(vUv);
        if (dC < uFar * 0.86) {
          vec2 texel = 1.0 / max(vec2(1.0), uRes);
          float rad = clamp(5.2 / max(0.55, dC), 1.1, 7.2);
          float ign = fract(52.9829189 * fract(dot(vUv * uRes, vec2(0.06711056, 0.00583715))));
          for (int i = 0; i < 12; i++) {
            float fi = (float(i) + 0.5) / 12.0;
            float a = float(i) * 2.399963 + ign * 6.283185;
            vec2 off = vec2(cos(a), sin(a)) * texel * rad * (0.35 + 0.95 * sqrt(fi));
            float dS = linDepth(clamp(vUv + off, 0.001, 0.999));
            float diff = dC - dS;
            if (diff > 0.012 && diff < 1.45) {
              occ += (1.0 - diff / 1.45) * (1.15 - 0.35 * fi);
            }
          }
          occ = clamp((occ / 12.0) * uStrength * 2.25, 0.0, 0.56);
        }
      }
      // Tint ambient occlusion subtly cool-indigo instead of muddy black
      vec3 aoTint = mix(vec3(1.0), vec3(0.08, 0.12, 0.24), occ);
      vec3 col = safeCol * mix(vec3(1.0 - occ), aoTint, 0.25);

      vec2 toSun = uSunScreen - vUv;
      float sunDist = length(toSun);
      if (uGodRay > 0.01 && uStrength > 0.001 && sunDist < 0.92) {
        vec2 stepUv = toSun * 0.036;
        vec2 suv = vUv;
        float skyVis = 0.0;
        for (int s = 0; s < 8; s++) {
          suv = clamp(suv + stepUv, 0.002, 0.998);
          skyVis += step(uFar * 0.72, linDepth(suv)) * (1.0 - float(s) * 0.08);
        }
        col += vec3(1.0, 0.82, 0.62) * (skyVis / 6.0) * uGodRay * smoothstep(0.92, 0.0, sunDist);
      }
      col.r = (col.r >= 0.0 && col.r <= 48.0) ? col.r : 0.0;
      col.g = (col.g >= 0.0 && col.g <= 48.0) ? col.g : 0.0;
      col.b = (col.b >= 0.0 && col.b <= 48.0) ? col.b : 0.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

// FidelityFX-Inspired Contrast-Adaptive Sharpening (CAS) + Subtle Optical Natural Vignette
const CinematicLensCASShader = {
  uniforms: {
    tDiffuse: { value: null },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uSharpness: { value: 0.42 },
    uVignette: { value: 0.16 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 uRes;
    uniform float uSharpness, uVignette;
    varying vec2 vUv;

    vec3 safeFetch(vec2 uv) {
      vec3 c = texture2D(tDiffuse, clamp(uv, 0.0005, 0.9995)).rgb;
      c.r = (c.r >= 0.0 && c.r <= 48.0) ? c.r : 0.0;
      c.g = (c.g >= 0.0 && c.g <= 48.0) ? c.g : 0.0;
      c.b = (c.b >= 0.0 && c.b <= 48.0) ? c.b : 0.0;
      return c;
    }

    void main() {
      vec2 px = 1.0 / max(vec2(1.0), uRes);
      vec3 e = safeFetch(vUv);
      if (uSharpness > 0.01) {
        vec3 b = safeFetch(vUv + vec2(0.0, -px.y));
        vec3 d = safeFetch(vUv + vec2(-px.x, 0.0));
        vec3 f = safeFetch(vUv + vec2(px.x, 0.0));
        vec3 h = safeFetch(vUv + vec2(0.0, px.y));
        vec3 mnRGB = min(min(min(d, e), min(f, b)), h);
        vec3 mxRGB = max(max(max(d, e), max(f, b)), h);
        vec3 amp = clamp(min(mnRGB, 2.0 - mxRGB) / max(vec3(1e-4), mxRGB), 0.0, 1.0);
        vec3 w = -sqrt(amp) * (0.125 * uSharpness);
        e = max(vec3(0.0), (b * w + d * w + f * w + h * w + e) / (4.0 * w + 1.0));
      }
      vec2 dv = vUv - 0.5;
      float vig = 1.0 - uVignette * dot(dv, dv) * 1.65;
      vec3 outCol = clamp(e * vig, 0.0, 48.0);
      gl_FragColor = vec4(outCol, 1.0);
    }
  `,
};

function makeHDRTarget(w, h) {
  const depthTex = new THREE.DepthTexture(Math.max(1, w), Math.max(1, h));
  depthTex.type = THREE.UnsignedIntType;
  return new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    depthTexture: depthTex,
  });
}

function makeTubeGeometry(rings, sides) {
  const n = rings * (sides + 1);
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  const uv = new Float32Array(n * 2);
  const idx = [];
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s <= sides; s++) {
      const i = r * (sides + 1) + s;
      nor[3 * i + 1] = 1;
      uv[2 * i] = r / Math.max(1, rings - 1);
      uv[2 * i + 1] = s / sides;
      if (r < rings - 1 && s < sides) {
        const a = i, b = i + sides + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

/** Update a continuous Catmull-Rom tubular mesh along control points `pts` with per-control-point radii `radii` */
function writeCatmullTube(geo, rings, sides, pts, radii, upHint = [0, 1, 0]) {
  const pos = geo.attributes.position.array;
  const nor = geo.attributes.normal.array;
  const K = pts.length;
  const getP = (i) => pts[Math.max(0, Math.min(K - 1, i))];
  const getR = (i) => radii[Math.max(0, Math.min(K - 1, i))];
  const center = [0, 0, 0], tang = [0, 0, 1], side = [1, 0, 0], up = [0, 1, 0];

  for (let r = 0; r < rings; r++) {
    const u = r / (rings - 1);
    const f = u * (K - 1);
    const i = Math.min(K - 2, Math.floor(f));
    const tt = f - i;
    const p0 = getP(i - 1), p1 = getP(i), p2 = getP(i + 1), p3 = getP(i + 2);
    for (let c = 0; c < 3; c++) {
      const a = p0[c], b = p1[c], d = p2[c], e = p3[c];
      center[c] = 0.5 * (2 * b + (-a + d) * tt + (2 * a - 5 * b + 4 * d - e) * tt * tt + (-a + 3 * b - 3 * d + e) * tt * tt * tt);
      tang[c] = 0.5 * ((-a + d) + 2 * (2 * a - 5 * b + 4 * d - e) * tt + 3 * (-a + 3 * b - 3 * d + e) * tt * tt);
    }
    let tn = Math.hypot(tang[0], tang[1], tang[2]);
    if (tn < 1e-5) { tang[0] = 0; tang[1] = 0; tang[2] = 1; tn = 1; }
    tang[0] /= tn; tang[1] /= tn; tang[2] /= tn;

    // Orthonormal Bishop-like frame from upHint x tang
    side[0] = upHint[1] * tang[2] - upHint[2] * tang[1];
    side[1] = upHint[2] * tang[0] - upHint[0] * tang[2];
    side[2] = upHint[0] * tang[1] - upHint[1] * tang[0];
    let sn = Math.hypot(side[0], side[1], side[2]);
    if (sn < 1e-4) {
      side[0] = 1; side[1] = 0; side[2] = 0;
      sn = 1;
    }
    side[0] /= sn; side[1] /= sn; side[2] /= sn;
    up[0] = tang[1] * side[2] - tang[2] * side[1];
    up[1] = tang[2] * side[0] - tang[0] * side[2];
    up[2] = tang[0] * side[1] - tang[1] * side[0];

    const rad = getR(i) * (1 - tt) + getR(i + 1) * tt;
    // Hemispherical end-cap rounding at very tip
    const capTaper = r === rings - 1 ? 0.12 : r === 0 ? 0.88 : 1.0;
    const rr = Math.max(0.0015, rad * capTaper);

    for (let s = 0; s <= sides; s++) {
      const th = (s / sides) * Math.PI * 2;
      const ct = Math.cos(th), st = Math.sin(th);
      const nx = st * side[0] + ct * up[0];
      const ny = st * side[1] + ct * up[1];
      const nz = st * side[2] + ct * up[2];
      const o = 3 * (r * (sides + 1) + s);
      pos[o] = center[0] + nx * rr;
      pos[o + 1] = center[1] + ny * rr;
      pos[o + 2] = center[2] + nz * rr;
      nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
    }
  }
  geo.attributes.position.needsUpdate = true;
  geo.attributes.normal.needsUpdate = true;
}

/** Build a curved parabolic keratin talon geometry extending along +Z and curving ventrally (-Y) */
function buildCurvedTalonGeo() {
  const rings = 7, sides = 8;
  const geo = makeTubeGeometry(rings, sides);
  const pts = [], radii = [];
  for (let r = 0; r < rings; r++) {
    const u = r / (rings - 1);
    pts.push([0, -0.042 * u * u, 0.115 * u]);
    radii.push(0.019 * (1 - 0.86 * Math.pow(u, 0.85)));
  }
  writeCatmullTube(geo, rings, sides, pts, radii, [0, 1, 0]);
  return geo;
}

/** Soft radial Gaussian glowing sprite ShaderMaterial (eliminates boxy square WebGL point sprites) */
function makeSoftSpriteMaterial(baseSize = 0.14, opacity = 0.85, additive = true) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: {
      uSize: { value: baseSize },
      uScale: { value: 420.0 },
      uOpacity: { value: opacity },
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vCol;
      uniform float uSize, uScale;
      void main() {
        vCol = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(uSize * uScale / max(0.35, -mv.z), 1.5, 42.0);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vCol;
      uniform float uOpacity;
      void main() {
        vec2 p = gl_PointCoord - 0.5;
        float r2 = dot(p, p) * 4.0;
        if (r2 > 1.0) discard;
        float w = exp(-r2 * 2.8) * (1.0 - r2);
        gl_FragColor = vec4(vCol * (0.85 + 0.9 * w), uOpacity * w);
      }
    `,
  });
}

export class View {
  constructor(canvas, cr, opts = {}) {
    this.cr = cr;
    this.p5Layer = opts.p5Layer || null;
    this.reduced = !!opts.reduced;

    const R = (this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
      preserveDrawingBuffer: false,
    }));
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = 1.12;

    const p3Ok = !!(THREE.DisplayP3ColorSpace && typeof window !== 'undefined' && window.matchMedia?.('(color-gamut: p3)')?.matches);
    try {
      R.outputColorSpace = p3Ok ? THREE.DisplayP3ColorSpace : THREE.SRGBColorSpace;
      this.colorGamut = p3Ok ? 'Display-P3' : 'sRGB';
    } catch {
      R.outputColorSpace = THREE.SRGBColorSpace;
      this.colorGamut = 'sRGB';
    }
    this.hdrPipeline = 'HDR16F + Sky IBL + GTAO + CAS';
    R.shadowMap.enabled = false;
    R.shadowMap.type = THREE.PCFSoftShadowMap;

    const S = (this.scene = new THREE.Scene());
    // Crisp deep atmospheric perspective (no washed-out grey FogExp2 soup!)
    S.fog = new THREE.FogExp2(0x060b18, 0.0068);
    S.environmentIntensity = 0.88;

    const cam = (this.camera = new THREE.PerspectiveCamera(48, 1, 0.05, 320));
    cam.position.set(2.75, 1.72, 3.15);

    this.controls = new OrbitControls(cam, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.492;
    this.controls.minDistance = 0.85;
    this.controls.maxDistance = 58;
    this.follow = true;
    this.cameraMode = opts.cameraMode || 'orbit';
    this.lightingMode = opts.lightingMode || 'auto';
    this._dirAngle = 0.5;
    this._povLook = new THREE.Vector3(0, 0.5, 1);

    // Multi-point studio + biosphere lighting rig with 4096px PCFSoftShadowMap support
    this.hemi = new THREE.HemisphereLight(0xa8e0ff, 0x1a1424, 1.12);
    S.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2e0, 2.75);
    this.sun.position.set(12, 20, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.normalBias = 0.018;
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -15;
    sc.right = sc.top = 15;
    sc.near = 1;
    sc.far = 58;
    S.add(this.sun);
    S.add(this.sun.target);

    this.rim = new THREE.PointLight(0x48e8ff, 5.2, 12.0, 1.4);
    S.add(this.rim);

    this._upVec = new THREE.Vector3(0, 1, 0);
    this._tmpV1 = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._tmpM = new THREE.Matrix4();

    // PMREM HDR Sky Environment Probe for realistic wet skin, cornea, water & crystal reflections
    this.pmrem = new THREE.PMREMGenerator(R);
    this.pmrem.compileEquirectangularShader();
    this._envRT = null;
    this._lastEnvDay = -999;

    this.buildSky();
    this.bakeSkyEnvironment(cr.light ?? 1);
    this.buildTerrain();
    this.buildGrass();
    this.buildProps();
    this.buildDome();
    this.buildEcosystem();
    this.buildCreature();
    this.buildWeather();

    const initRt = makeHDRTarget(512, 512);
    this.composer = new EffectComposer(R, initRt);
    this.composer.renderTarget2.dispose();
    this.composer.renderTarget2 = makeHDRTarget(512, 512);
    this.composer.readBuffer = this.composer.renderTarget2;
    this.composer.writeBuffer = this.composer.renderTarget1;

    this.renderPass = new RenderPass(S, cam);
    this.composer.addPass(this.renderPass);

    this.aoPass = new ShaderPass(ContactAOScatterShader);
    const origAORender = this.aoPass.render.bind(this.aoPass);
    this.aoPass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
      this.aoPass.uniforms.tDepth.value = readBuffer.depthTexture;
      origAORender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    };
    this.composer.addPass(this.aoPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.54, 0.48, 0.90);
    this.composer.addPass(this.bloom);

    this.casPass = new ShaderPass(CinematicLensCASShader);
    this.composer.addPass(this.casPass);
    this.composer.addPass(new OutputPass());

    this.quality = opts.quality ?? 3;
    this.setQuality(this.quality);
    this.clock = 0;
    this.heartPh = 0;
  }

  dispose() {
    if (this._envRT) { this._envRT.dispose(); this._envRT = null; }
    if (this.pmrem) { this.pmrem.dispose(); this.pmrem = null; }
  }

  bakeSkyEnvironment(dayVal) {
    if (!this.pmrem || !this.envScene) return;
    this._lastEnvDay = dayVal;
    this.skyU.day.value = dayVal;
    const nextRT = this.pmrem.fromScene(this.envScene, 0.035);
    if (this._envRT) this._envRT.dispose();
    this._envRT = nextRT;
    this.scene.environment = nextRT.texture;
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this.controls.enabled = mode === 'orbit' || mode === 'overhead';
    if (mode === 'overhead') {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 30, 16);
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
    } else if (mode === 'pov') {
      this.camera.fov = 76;
      this.camera.updateProjectionMatrix();
    } else {
      this.camera.fov = 50;
      this.camera.updateProjectionMatrix();
    }
    if (this.cg) this.cg.visible = true;
  }

  setLightingMode(mode) {
    this.lightingMode = mode || 'auto';
    this._lastEnvDay = -999;
  }

  setQuality(q) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (q === 4) {
      this.pr = 1;
    } else {
      this.pr = [0.65, 0.85, 1.0, dpr][q] ?? dpr;
    }
    this.aoPass.enabled = q >= 1;
    this.aoPass.uniforms.uStrength.value = q >= 2 ? 0.54 : 0.0;
    this.bloom.enabled = q >= 1;
    this.casPass.enabled = q >= 2;
    this.casPass.uniforms.uSharpness.value = q >= 3 ? 0.48 : 0.32;
    this.renderer.shadowMap.enabled = q >= 2;
    this.sun.castShadow = q >= 2;
    const wantShadow = q >= 3 ? 4096 : 2048;
    if (this.sun.shadow.mapSize.x !== wantShadow) {
      this.sun.shadow.mapSize.set(wantShadow, wantShadow);
      if (this.sun.shadow.map) {
        this.sun.shadow.map.dispose();
        this.sun.shadow.map = null;
      }
    }
    this.rainN = [240, 600, 1100, 1600, 1800][q] ?? 1400;
    if (this.grassMesh) {
      this.grassMesh.count = [900, 2000, 3600, GRASS_COUNT, GRASS_COUNT][q] ?? 3600;
    }
    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const cssW = Math.max(1, c.clientWidth || window.innerWidth || 1280);
    const cssH = Math.max(1, c.clientHeight || window.innerHeight || 720);

    let bufW, bufH;
    if (this.quality === 4) {
      bufW = 3840;
      bufH = 2160;
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(bufW, bufH, false);
    } else {
      this.renderer.setPixelRatio(this.pr);
      this.renderer.setSize(cssW, cssH, false);
      bufW = Math.max(1, Math.round(cssW * this.pr));
      bufH = Math.max(1, Math.round(cssH * this.pr));
    }

    this.composer.renderTarget1.setSize(bufW, bufH);
    if (this.composer.renderTarget1.depthTexture) {
      this.composer.renderTarget1.depthTexture.image.width = bufW;
      this.composer.renderTarget1.depthTexture.image.height = bufH;
      this.composer.renderTarget1.depthTexture.dispose();
    }
    this.composer.renderTarget2.setSize(bufW, bufH);
    if (this.composer.renderTarget2.depthTexture) {
      this.composer.renderTarget2.depthTexture.image.width = bufW;
      this.composer.renderTarget2.depthTexture.image.height = bufH;
      this.composer.renderTarget2.depthTexture.dispose();
    }
    this.composer.setPixelRatio(1);
    this.composer.setSize(bufW, bufH);
    this.aoPass.uniforms.uRes.value.set(bufW, bufH);
    this.casPass.uniforms.uRes.value.set(bufW, bufH);

    const spriteScale = bufH * 0.58;
    for (const sm of [this.ventSpriteMat, this.miteSpriteMat, this.bloodSpriteMat, this.sporeSpriteMat, this.brainSpriteMat]) {
      if (sm?.uniforms?.uScale) sm.uniforms.uScale.value = spriteScale;
    }

    this.camera.aspect = cssW / cssH;
    this.camera.updateProjectionMatrix();
    this.bufferWidth = bufW;
    this.bufferHeight = bufH;
  }

  capture4KPNG() {
    const prevQ = this.quality;
    this.setQuality(4);
    this.camera.aspect = 3840 / 2160;
    this.camera.updateProjectionMatrix();
    if (this.bloom.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `glitchling-4k-uhd-seed${this.cr.seed}.png`;
    a.click();
    if (prevQ !== 4) this.setQuality(prevQ);
    else this.resize();
  }

  // ------------------------------------------------------------------ Sky Dome + PMREM Environment Source
  buildSky() {
    const g = new THREE.SphereGeometry(185, 48, 32);
    this.skyU = {
      day: { value: 1 },
      t: { value: 0 },
      sunDir: { value: new THREE.Vector3(0.45, 0.75, 0.35).normalize() },
      season: { value: 0 },
    };
    const m = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: this.skyU,
      vertexShader: `
        varying vec3 vP;
        void main() {
          vP = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float day, t, season;
        uniform vec3 sunDir;
        varying vec3 vP;

        float h(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float noise(vec3 p) {
          vec3 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(h(i), h(i + vec3(1,0,0)), f.x), mix(h(i + vec3(0,1,0)), h(i + vec3(1,1,0)), f.x), f.y),
            mix(mix(h(i + vec3(0,0,1)), h(i + vec3(1,0,1)), f.x), mix(h(i + vec3(0,1,1)), h(i + vec3(1,1,1)), f.x), f.y),
            f.z
          );
        }

        void main() {
          vec3 dir = normalize(vP);
          float y = dir.y;
          vec3 nightZen = vec3(0.010, 0.016, 0.048);
          vec3 nightHor = vec3(0.038, 0.055, 0.125);
          vec3 dayZen = mix(vec3(0.09, 0.26, 0.58), vec3(0.16, 0.22, 0.52), 0.35 * sin(season * 6.283));
          vec3 dayHor = mix(vec3(0.58, 0.76, 0.88), vec3(0.92, 0.68, 0.52), 0.45 + 0.45 * cos(season * 6.283));

          vec3 c = mix(
            mix(nightHor, nightZen, smoothstep(-0.08, 0.65, y)),
            mix(dayHor, dayZen, smoothstep(-0.08, 0.62, y)),
            day
          );

          // Bioluminescent deep-space FBM nebula
          float neb = noise(dir * 3.4 + vec3(t * 0.006, 0.0, -t * 0.005)) * 0.65
                    + noise(dir * 7.8 - vec3(0.0, t * 0.008, 0.0)) * 0.35;
          c += mix(vec3(0.22, 0.06, 0.42), vec3(0.04, 0.44, 0.54), neb) * smoothstep(0.42, 0.86, neb) * (1.0 - 0.76 * day) * smoothstep(-0.05, 0.35, y);

          // Magnetospheric Aurora Curtains
          float aurWave = sin(dir.x * 8.2 + t * 0.24 + sin(dir.z * 6.2 + t * 0.17) * 2.2);
          float aur = smoothstep(0.08, 0.56, y) * smoothstep(0.95, 0.34, y) * pow(0.5 + 0.5 * aurWave, 2.3);
          c += mix(vec3(0.08, 0.96, 0.68), vec3(0.52, 0.26, 0.98), 0.5 + 0.5 * sin(dir.z * 4.0 + t * 0.12)) * aur * 0.38 * (1.0 - day * 0.75);

          // Solar disc & Rayleigh-Mie atmospheric scatter
          float sunCos = clamp(dot(dir, normalize(sunDir)), 0.0, 1.0);
          c += vec3(1.0, 0.84, 0.62) * pow(sunCos, 10.0) * 0.42 * day;
          c += vec3(1.5, 1.35, 1.12) * smoothstep(0.9965, 0.9993, sunCos) * (0.4 + 1.5 * day);

          // Twin Alien Moons (Selene-Prime ringed gas giant & Cyan-Minor)
          vec3 m1Dir = normalize(vec3(-0.52, 0.58, -0.62));
          vec3 m2Dir = normalize(vec3(-0.24, 0.44, -0.86));
          float m1 = dot(dir, m1Dir);
          if (m1 > 0.9935) {
            float band = 0.5 + 0.5 * sin(dir.y * 140.0 + noise(dir * 60.0) * 3.0);
            vec3 mc = mix(vec3(0.76, 0.82, 0.96), vec3(0.48, 0.74, 0.92), band);
            c = mix(c, mc, (1.0 - 0.38 * day) * smoothstep(0.9935, 0.9950, m1));
          }
          float m2 = dot(dir, m2Dir);
          if (m2 > 0.9982) {
            c = mix(c, vec3(0.48, 0.94, 1.0), (1.0 - 0.45 * day) * smoothstep(0.9982, 0.9989, m2));
          }

          vec3 q = floor(dir * 270.0);
          float s = step(0.9970, h(q)) * (1.0 - day * 0.88) * smoothstep(0.0, 0.26, y);
          c += vec3(0.86, 0.93, 1.0) * s * (1.7 + 0.7 * sin(t * 2.4 + q.x));

          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(g, m);
    this.scene.add(this.sky);

    // Separate lightweight sky dome for PMREM HDR reflection cubemap baking
    this.envScene = new THREE.Scene();
    this.envScene.add(new THREE.Mesh(new THREE.SphereGeometry(40, 24, 16), m));
  }

  // ------------------------------------------------------------------ 224x224 Micro-Normal PBR Terrain + Wet Shorelines + Microbial Veins
  buildTerrain() {
    const N = 224;
    const g = new THREE.PlaneGeometry(46, 46, N, N);
    g.rotateX(-Math.PI / 2);
    const col = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.tGeo = g;

    const W = this.cr.world;
    const poolVecs = [0, 1, 2].map((i) => {
      const p = W.pools[i] || { x: 999, z: 999, r: 2.2 };
      return new THREE.Vector3(p.x, p.z, p.r);
    });

    const bioTex = this.p5Layer ? this.p5Layer.bioTex : null;
    this.terrainU = {
      uT: { value: 0 },
      uBioTex: { value: bioTex },
      uHasBio: { value: bioTex ? 1.0 : 0.0 },
      uWorldSpan: { value: 2 * WORLD },
      uRain: { value: 0 },
      uPool0: { value: poolVecs[0] },
      uPool1: { value: poolVecs[1] },
      uPool2: { value: poolVecs[2] },
    };

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.78,
      metalness: 0.06,
    });
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.terrainU);
      sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
      sh.fragmentShader = `
        uniform float uT, uHasBio, uWorldSpan, uRain;
        uniform vec3 uPool0, uPool1, uPool2;
        uniform sampler2D uBioTex;
        varying vec3 vW;
        float tHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float tNoise(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(tHash(i), tHash(i + vec2(1,0)), f.x), mix(tHash(i + vec2(0,1)), tHash(i + vec2(1,1)), f.x), f.y);
        }
        float tFbm(vec2 p) {
          return 0.55 * tNoise(p) + 0.30 * tNoise(p * 2.13 + 3.1) + 0.15 * tNoise(p * 4.37 - 1.7);
        }
      ` + sh.fragmentShader
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float dP0 = length(vW.xz - uPool0.xy) - uPool0.z;
          float dP1 = length(vW.xz - uPool1.xy) - uPool1.z;
          float dP2 = length(vW.xz - uPool2.xy) - uPool2.z;
          float shoreWet = smoothstep(1.35, -0.15, min(dP0, min(dP1, dP2)));
          float microDetail = tFbm(vW.xz * 3.8);
          diffuseColor.rgb *= (0.84 + 0.34 * microDetail) * (1.0 - 0.28 * shoreWet);
          roughnessFactor = clamp(roughnessFactor * (0.88 + 0.24 * microDetail) - 0.58 * shoreWet - 0.28 * uRain, 0.12, 0.95);`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float hMicro = tFbm(vW.xz * 6.5) + 0.35 * tNoise(vW.xz * 18.0);
          vec3 dPdx = dFdx(vW);
          vec3 dPdy = dFdy(vW);
          float dHdx = dFdx(hMicro);
          float dHdy = dFdy(hMicro);
          vec3 surfGrad = (dHdx * cross(normal, dPdy) + dHdy * cross(dPdx, normal));
          float gradLen = length(surfGrad);
          if (gradLen > 1e-6) {
            normal = normalize(normal - (surfGrad / max(0.02, gradLen)) * min(0.28, gradLen * 2.4));
          }`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float vein = smoothstep(0.925, 1.0, sin(vW.x * 1.45 + sin(vW.z * 0.95 + uT * 0.20) * 2.1) * sin(vW.z * 1.2 + uT * 0.14));
          totalEmissiveRadiance += vec3(0.06, 0.72, 0.95) * vein * (0.24 + 0.18 * sin(uT * 1.4 + vW.x));
          if (uHasBio > 0.5) {
            vec2 bioUv = clamp((vW.xz / uWorldSpan) + 0.5, 0.0, 1.0);
            vec4 bio = texture2D(uBioTex, bioUv);
            totalEmissiveRadiance += bio.rgb * bio.a * 0.62;
          }`
        );
    };
    this.terrain = new THREE.Mesh(g, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
    this.updateTerrain();
  }

  updateTerrain() {
    const W = this.cr.world;
    const p = this.tGeo.attributes.position;
    const c = this.tGeo.attributes.color;
    const season = W.season || 'spring';
    const sTint = season === 'winter' ? [0.06, 0.10, 0.16]
      : season === 'autumn' ? [0.10, 0.05, 0.03]
      : season === 'summer' ? [0.02, 0.08, 0.04]
      : [0.02, 0.07, 0.06];

    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = W.height(x, z);
      p.setY(i, h);
      const t = Math.max(0, Math.min(1, (h + 1.5) / 3.6));
      const moss = 0.5 + 0.5 * Math.sin(x * 0.52 + Math.cos(z * 0.48) * 1.7);
      // Richer natural volcanic-loam + bioluminescent moss + basalt ridge palette
      const rCol = 0.045 + 0.18 * t + 0.035 * moss + sTint[0];
      const gCol = 0.065 + 0.15 * (1 - t * 0.65) + 0.11 * moss + sTint[1];
      const bCol = 0.095 + 0.14 * (1 - t) + 0.04 * moss + sTint[2];
      c.setXYZ(i, rCol, gCol, bCol);
    }
    p.needsUpdate = true;
    c.needsUpdate = true;
    this.tGeo.computeVertexNormals();
    if (this._grassBaseXZ) this._syncGrassHeights();
  }

  // ------------------------------------------------------------------ 3,200 GPU-Instanced Wind-Swaying Bioluminescent Grass & Reeds
  buildGrass() {
    const segs = 5;
    const pos = [], nor = [], col = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const v = s / segs;
      const w = 0.032 * (1 - v * 0.90);
      const y = v * 0.54;
      const zCurve = v * v * 0.11;
      pos.push(-w, y, zCurve, w, y, zCurve);
      nor.push(0, 0.28, 0.96, 0, 0.28, 0.96);
      const r = 0.04 + 0.18 * v * v;
      const g = 0.20 + 0.72 * v;
      const b = 0.16 + 0.68 * v * v;
      col.push(r, g, b, r, g, b);
      if (s < segs) {
        const a = s * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const bladeGeo = new THREE.BufferGeometry();
    bladeGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    bladeGeo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    bladeGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    bladeGeo.setIndex(idx);

    this.grassU = {
      uTime: { value: 0 },
      uWind: { value: new THREE.Vector2(0.4, 0.2) },
      uNightGlow: { value: 0.4 },
    };

    const grassMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.48,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    grassMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = this.grassU.uTime;
      sh.uniforms.uWind = this.grassU.uWind;
      sh.uniforms.uNightGlow = this.grassU.uNightGlow;
      sh.vertexShader = 'uniform float uTime; uniform vec2 uWind; varying float vTip;\n' +
        sh.vertexShader.replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vTip = clamp(position.y / 0.54, 0.0, 1.0);
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float gust = sin(uTime * 2.2 + iPos.x * 0.42 + iPos.z * 0.36) + 0.5 * cos(uTime * 3.9 - iPos.z * 0.65);
          float bend = vTip * vTip;
          transformed.x += (uWind.x * 0.16 + 0.085 * gust) * bend;
          transformed.z += (uWind.y * 0.16 + 0.07 * gust) * bend;`
        );
      sh.fragmentShader = 'uniform float uNightGlow; varying float vTip;\n' +
        sh.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * pow(vTip, 2.4) * (0.22 + 0.78 * uNightGlow);`
        );
    };

    this.grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS_COUNT);
    this.grassMesh.frustumCulled = false;
    this._grassBaseXZ = new Float32Array(GRASS_COUNT * 4);

    const W = this.cr.world;
    let gs = 424242;
    const grnd = () => { gs = (gs * 1664525 + 1013904223) >>> 0; return gs / 4294967296; };
    let placed = 0, guard = 0;
    while (placed < GRASS_COUNT && guard++ < GRASS_COUNT * 6) {
      const r = 1.6 + Math.sqrt(grnd()) * (WORLD - 2.0);
      const a = grnd() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      let inPool = false;
      for (const P of W.pools) if (Math.hypot(x - P.x, z - P.z) < P.r + 0.22) inPool = true;
      if (inPool) continue;
      this._grassBaseXZ[placed * 4] = x;
      this._grassBaseXZ[placed * 4 + 1] = z;
      this._grassBaseXZ[placed * 4 + 2] = grnd() * Math.PI * 2;
      this._grassBaseXZ[placed * 4 + 3] = 0.62 + grnd() * 0.98;
      placed++;
    }
    this._syncGrassHeights();
    this.scene.add(this.grassMesh);
  }

  _syncGrassHeights() {
    const W = this.cr.world;
    const dummy = this._tmpM;
    const pos = this._tmpV1, scl = this._tmpV2, q = this._tmpQ;
    for (let i = 0; i < GRASS_COUNT; i++) {
      const x = this._grassBaseXZ[i * 4];
      const z = this._grassBaseXZ[i * 4 + 1];
      const ry = this._grassBaseXZ[i * 4 + 2];
      const sc = this._grassBaseXZ[i * 4 + 3];
      pos.set(x, W.height(x, z) - 0.02, z);
      q.setFromAxisAngle(this._upVec, ry);
      scl.set(sc, sc * (0.85 + 0.35 * (W.meanSoilN || 0.5)), sc);
      dummy.compose(pos, q, scl);
      this.grassMesh.setMatrixAt(i, dummy);
    }
    this.grassMesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ Curved Tube Canopy Flora, Basalt-Geode Rocks, Fresnel Pools & Vents
  buildProps() {
    const S = this.scene, W = this.cr.world;
    this.props = new THREE.Group();
    S.add(this.props);

    // Smooth high-subdivision wet volcanic basalt-geode boulder material (ZERO flatShading facets!)
    this.rockMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      roughness: 0.38,
      metalness: 0.18,
      clearcoat: 0.68,
      clearcoatRoughness: 0.18,
      iridescence: 0.72,
      iridescenceIOR: 1.62,
      iridescenceThicknessRange: [180, 760],
      flatShading: false,
    });
    this.rockMeshes = [];
    this.springMeshes = [];
    this.ventMeshes = [];
    this.shelterMeshes = [];
    this.plantMeshes = [];
    this.snackMeshes = new Map();
    this.wasteMeshes = [];

    // Sculpted Curved-Tube Bioluminescent Canopy Flora
    const shapes = [
      new THREE.SphereGeometry(0.26, 24, 18),
      new THREE.DodecahedronGeometry(0.26, 1),
      new THREE.ConeGeometry(0.26, 0.54, 22),
      new THREE.OctahedronGeometry(0.32, 1),
    ];
    const stemMat = new THREE.MeshPhysicalMaterial({
      color: 0x16382b,
      emissive: 0x051812,
      roughness: 0.52,
      clearcoat: 0.35,
    });

    // Organic curved leaf-frond ribbon geometry
    const frondShape = new THREE.Shape();
    frondShape.moveTo(0, 0);
    frondShape.quadraticCurveTo(0.14, 0.22, 0.02, 0.56);
    frondShape.quadraticCurveTo(-0.12, 0.22, 0, 0);
    const frondGeo = new THREE.ShapeGeometry(frondShape, 10);

    for (let idx = 0; idx < W.plants.length; idx++) {
      const P = W.plants[idx];
      const g = new THREE.Group();

      // Swept S-curve organic trunk via CatmullRomCurve3 + TubeGeometry + 3 buttress roots
      const leanX = Math.cos(idx * 1.7) * 0.12, leanZ = Math.sin(idx * 2.3) * 0.12;
      const trunkCurve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, -0.04, 0),
        new THREE.Vector3(leanX * 0.5, 0.42, leanZ * 0.5),
        new THREE.Vector3(-leanX * 0.35, 0.84, -leanZ * 0.35),
        new THREE.Vector3(0, 1.22, 0),
      ]);
      const trunk = new THREE.Mesh(new THREE.TubeGeometry(trunkCurve, 14, 0.062, 10, false), stemMat);
      trunk.castShadow = true;
      g.add(trunk);

      for (let r = 0; r < 3; r++) {
        const ra = (r / 3) * Math.PI * 2 + idx;
        const rootCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(ra) * 0.24, -0.03, Math.sin(ra) * 0.24),
          new THREE.Vector3(Math.cos(ra) * 0.10, 0.14, Math.sin(ra) * 0.10),
          new THREE.Vector3(0, 0.34, 0),
        ]);
        g.add(new THREE.Mesh(new THREE.TubeGeometry(rootCurve, 7, 0.032, 7, false), stemMat));
      }

      const crown = new THREE.Group();
      crown.position.y = 1.20;
      const frondMat = new THREE.MeshPhysicalMaterial({
        color: HUES[P.c],
        emissive: HUES[P.c],
        emissiveIntensity: 0.42,
        roughness: 0.32,
        transmission: 0.28,
        side: THREE.DoubleSide,
      });

      for (let b = 0; b < 4; b++) {
        const ang = (b / 4) * Math.PI * 2 + idx * 0.7;
        const brCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(ang) * 0.20, 0.18, Math.sin(ang) * 0.20),
          new THREE.Vector3(Math.cos(ang) * 0.42, 0.24, Math.sin(ang) * 0.42),
        ]);
        crown.add(new THREE.Mesh(new THREE.TubeGeometry(brCurve, 8, 0.024, 7, false), stemMat));

        const frond = new THREE.Mesh(frondGeo, frondMat);
        frond.position.set(Math.cos(ang) * 0.28, 0.20, Math.sin(ang) * 0.28);
        frond.rotation.y = -ang + Math.PI * 0.5;
        frond.rotation.x = 0.85;
        crown.add(frond);
      }

      const fm = new THREE.MeshPhysicalMaterial({
        color: HUES[P.c],
        emissive: HUES[P.c],
        emissiveIntensity: 1.35,
        roughness: 0.18,
        clearcoat: 0.85,
        transmission: 0.25,
      });
      const fruit = new THREE.Mesh(shapes[P.s], fm);
      fruit.position.y = 0.28;
      crown.add(fruit);

      if (P.s === 3) {
        const thornGeo = buildCurvedTalonGeo();
        const thornMat = new THREE.MeshStandardMaterial({ color: 0xff2244, emissive: 0x660018, roughness: 0.25 });
        for (let k = 0; k < 6; k++) {
          const th = new THREE.Mesh(thornGeo, thornMat);
          const ta = (k / 6) * Math.PI * 2;
          th.position.set(Math.cos(ta) * 0.18, 0.24, Math.sin(ta) * 0.18);
          th.lookAt(Math.cos(ta) * 0.6, 0.28, Math.sin(ta) * 0.6);
          crown.add(th);
        }
      }
      g.add(crown);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.022, 8, 48),
        new THREE.MeshBasicMaterial({ color: 0x38e8ff, transparent: true, opacity: 0 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);

      g.position.set(P.x, P.y, P.z);
      this.props.add(g);
      this.plantMeshes.push({ g, crown, fruit, fm, ring });
    }

    // Crystal Spire Shelters (hexagonal prismatic quartz-amethyst refraction spires)
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x70e8ff,
      emissive: 0x143862,
      emissiveIntensity: 0.68,
      roughness: 0.08,
      metalness: 0.08,
      transmission: 0.72,
      thickness: 1.1,
      ior: 1.56,
      clearcoat: 1.0,
      iridescence: 1.0,
      iridescenceIOR: 1.9,
    });
    for (const sh of W.shelters || []) {
      const grp = new THREE.Group();
      for (let k = 0; k < 6; k++) {
        const h = (0.95 + (k % 3) * 0.48) * (sh.h ? sh.h / 2.2 : 1);
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.17 + 0.04 * (k % 2), h, 6), crystalMat);
        const a = (k / 6) * Math.PI * 2;
        spire.position.set(Math.cos(a) * 0.28, h * 0.46, Math.sin(a) * 0.28);
        spire.rotation.z = -Math.cos(a) * 0.22;
        spire.rotation.x = Math.sin(a) * 0.22;
        spire.castShadow = true;
        grp.add(spire);
      }
      grp.position.set(sh.x, sh.y, sh.z);
      this.props.add(grp);
      this.shelterMeshes.push(grp);
    }

    // Soft Gaussian Volumetric Hydrothermal Steam/Ember Plume Sprites (220 particles)
    this.ventPlumeN = 220;
    const vpGeo = new THREE.BufferGeometry();
    const vpPos = new Float32Array(this.ventPlumeN * 3);
    const vpCol = new Float32Array(this.ventPlumeN * 3);
    this._ventLife = new Float32Array(this.ventPlumeN);
    for (let i = 0; i < this.ventPlumeN; i++) {
      this._ventLife[i] = (i * 0.6180339) % 1;
      const ember = i % 4 === 0;
      vpCol[3 * i] = ember ? 1.0 : 0.55;
      vpCol[3 * i + 1] = ember ? 0.52 : 0.78;
      vpCol[3 * i + 2] = ember ? 0.18 : 0.92;
    }
    vpGeo.setAttribute('position', new THREE.BufferAttribute(vpPos, 3));
    vpGeo.setAttribute('color', new THREE.BufferAttribute(vpCol, 3));
    this.ventSpriteMat = makeSoftSpriteMaterial(0.28, 0.55, true);
    this.ventPlumes = new THREE.Points(vpGeo, this.ventSpriteMat);
    this.ventPlumes.frustumCulled = false;
    S.add(this.ventPlumes);

    this.springGeo = new THREE.TorusKnotGeometry(0.7, 0.065, 112, 12, 2, 7);
    this.springMat = new THREE.MeshPhysicalMaterial({
      color: 0xffd23f,
      emissive: 0x442800,
      metalness: 0.85,
      roughness: 0.18,
      clearcoat: 0.6,
    });

    // Refractive Fresnel + Gerstner Ripple + Voronoi Caustics + Bioluminescent Phytoplankton Water Pools
    this.poolU = {
      t: { value: 0 },
      uSunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      uDay: { value: 1.0 },
      uPlankton: { value: 0.65 },
    };
    this.poolMeshes = W.pools.map((P) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(P.r * 1.04, 72),
        new THREE.ShaderMaterial({
          uniforms: this.poolU,
          transparent: true,
          depthWrite: false,
          vertexShader: `
            varying vec2 vP;
            varying vec3 vW;
            void main() {
              vP = position.xy;
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vW = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `,
          fragmentShader: `
            uniform float t, uDay, uPlankton;
            uniform vec3 uSunDir;
            varying vec2 vP;
            varying vec3 vW;

            float caustic(vec2 uv) {
              vec2 p = uv * 3.6;
              float a = sin(p.x * 2.2 + t * 1.8 + cos(p.y * 2.5 - t * 1.3));
              float b = cos(p.y * 2.8 - t * 1.5 + sin(p.x * 2.0 + t * 2.0));
              return pow(0.5 + 0.5 * a * b, 3.4);
            }

            void main() {
              float r = length(vP);
              float maxR = ${(P.r * 1.04).toFixed(3)};
              float edge = smoothstep(maxR, ${(P.r * 0.72).toFixed(3)}, r);
              if (edge <= 0.002) discard;

              // Analytical capillary wave normal for crisp solar specular glints & Fresnel sky reflection
              float wx = cos(vP.x * 9.5 + t * 2.8) * 0.045 + cos((vP.x + vP.y) * 14.0 - t * 3.6) * 0.03;
              float wz = sin(vP.y * 9.2 - t * 2.5) * 0.045 + sin((vP.x - vP.y) * 13.5 + t * 3.2) * 0.03;
              vec3 N = normalize(vec3(-wx, 1.0, -wz));
              vec3 V = normalize(cameraPosition - vW);
              vec3 L = normalize(uSunDir);
              float fres = 0.04 + 0.96 * pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 4.2);

              float c1 = caustic(vP + N.xz * 0.4);
              float c2 = caustic(vP * 1.55 + vec2(0.7, -0.4));
              float depthFrac = clamp(1.0 - (r / maxR), 0.0, 1.0);

              vec3 deepAbsorb = vec3(0.015, 0.13, 0.26);
              vec3 shallowTeal = vec3(0.06, 0.42, 0.54);
              vec3 waterBody = mix(shallowTeal, deepAbsorb, smoothstep(0.0, 0.75, depthFrac));

              // Bioluminescent aquatic phytoplankton bloom
              vec3 bioGlow = vec3(0.08, 0.95, 0.85) * uPlankton * (0.28 + 0.55 * c2) * (1.15 - 0.65 * uDay);
              vec3 skyRefl = mix(vec3(0.06, 0.18, 0.34), vec3(0.55, 0.80, 0.98), uDay);

              vec3 H = normalize(L + V);
              float spec = pow(max(dot(N, H), 0.0), 180.0) * (0.6 + 2.4 * uDay);
              float foam = smoothstep(${(P.r * 0.80).toFixed(3)}, ${(P.r * 0.98).toFixed(3)}, r) * edge * (0.55 + 0.45 * sin(r * 22.0 - t * 3.5));

              vec3 col = mix(waterBody + vec3(0.22, 0.78, 0.92) * (c1 * 0.42 + c2 * 0.25) + bioGlow, skyRefl, fres * 0.72);
              col += vec3(1.0, 0.94, 0.84) * spec + vec3(0.65, 0.92, 0.98) * foam * 0.42;
              gl_FragColor = vec4(col, clamp(0.88 * edge + fres * 0.12, 0.0, 0.95));
            }
          `,
        })
      );
      m.rotation.x = -Math.PI / 2;
      S.add(m);
      return m;
    });

    this.snackGeo = new THREE.IcosahedronGeometry(0.16, 2);
    this.wasteGeo = new THREE.SphereGeometry(0.12, 12, 10);
    this.syncProps();
  }

  syncProps() {
    const W = this.cr.world;
    if (this.poolMeshes) {
      W.pools.forEach((P, i) => {
        this.poolMeshes[i].position.set(P.x, W.height(P.x, P.z) + 0.048, P.z);
      });
    }
    if (this.poolU) {
      this.poolU.t.value = W.t;
      this.poolU.uPlankton.value = W.planktonBloom ?? 0.65;
    }

    // High-Subdivision Smooth Indexed Multifractal Basalt-Geode Boulders (SphereGeometry 56x40 = smooth vertex-averaged normals, zero facets!)
    while (this.rockMeshes.length < W.rocks.length) {
      const seedOff = this.rockMeshes.length * 3.71;
      const g = new THREE.SphereGeometry(1, 56, 40);
      const p = g.attributes.position;
      const col = new Float32Array(p.count * 3);
      const v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const ridge1 = 1.0 - Math.abs(Math.sin(v.x * 3.4 + seedOff) * Math.cos(v.y * 2.9 - seedOff) + 0.5 * Math.sin(v.z * 4.1));
        const strata = Math.sin(v.y * 9.5 + v.x * 2.2) * 0.045;
        const micro = Math.sin(v.x * 11.0 + v.z * 9.0) * 0.025;
        const disp = 0.82 + 0.22 * ridge1 + strata + micro;
        v.y *= 0.84; // natural settled boulder silhouette
        v.multiplyScalar(disp);
        p.setXYZ(i, v.x, v.y, v.z);

        // Glowing cyan-amethyst crystal geode seam along deep fissures + mossy top patina
        const seam = Math.max(0, 1.0 - Math.abs(Math.sin(v.x * 4.2 + v.y * 3.1 + seedOff)) * 6.5);
        const topMoss = Math.max(0, v.y * 0.55);
        col[3 * i] = 0.11 + 0.06 * ridge1 + 0.28 * seam;
        col[3 * i + 1] = 0.12 + 0.14 * topMoss + 0.65 * seam;
        col[3 * i + 2] = 0.17 + 0.08 * ridge1 + 0.85 * seam;
      }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.rockMat);
      m.castShadow = m.receiveShadow = true;
      this.props.add(m);
      this.rockMeshes.push(m);
    }
    W.rocks.forEach((R, i) => {
      const m = this.rockMeshes[i];
      m.visible = true;
      m.position.set(R.x, R.y, R.z);
      m.scale.setScalar(R.r);
    });
    for (let i = W.rocks.length; i < this.rockMeshes.length; i++) this.rockMeshes[i].visible = false;

    while (this.springMeshes.length < W.springs.length) {
      const g = new THREE.Group();
      const pad = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.35, 0.12, 36),
        new THREE.MeshPhysicalMaterial({ color: 0x38f5d0, emissive: 0x0a5848, roughness: 0.22, clearcoat: 0.8 })
      );
      const c = new THREE.Mesh(this.springGeo, this.springMat);
      c.rotation.x = Math.PI / 2;
      c.scale.set(1, 1, 0.5);
      g.add(c, pad);
      g.userData = { pad, coil: c };
      this.props.add(g);
      this.springMeshes.push(g);
    }
    W.springs.forEach((S, i) => {
      const g = this.springMeshes[i];
      g.visible = true;
      g.position.set(S.x, S.y, S.z);
      const h = 0.3 - S.comp * 0.4;
      g.userData.pad.position.y = h;
      g.userData.coil.position.y = h / 2;
      g.userData.coil.scale.z = Math.max(0.1, h);
    });

    // Sculpted Fluted Geothermal Hydrothermal Chimneys + Glowing Mineral Caldera
    const vents = W.vents || [];
    while (this.ventMeshes.length < vents.length) {
      const g = new THREE.Group();
      const coneGeo = new THREE.CylinderGeometry(0.30, 1.02, 0.84, 24, 6, true);
      const cp = coneGeo.attributes.position;
      for (let k = 0; k < cp.count; k++) {
        const vx = cp.getX(k), vy = cp.getY(k), vz = cp.getZ(k);
        const ang = Math.atan2(vz, vx);
        const flute = 1.0 + 0.12 * Math.sin(ang * 7.0 + vy * 3.0);
        cp.setXYZ(k, vx * flute, vy, vz * flute);
      }
      coneGeo.computeVertexNormals();
      const cone = new THREE.Mesh(
        coneGeo,
        new THREE.MeshPhysicalMaterial({ color: 0x221920, emissive: 0x381206, roughness: 0.72, clearcoat: 0.35, side: THREE.DoubleSide })
      );
      cone.position.y = 0.38;
      const throat = new THREE.Mesh(
        new THREE.CircleGeometry(0.29, 24),
        new THREE.MeshBasicMaterial({ color: 0xff7722 })
      );
      throat.rotation.x = -Math.PI / 2;
      throat.position.y = 0.76;
      const light = new THREE.PointLight(0xff6a24, 3.0, 8.0, 1.6);
      light.position.y = 0.98;
      g.add(cone, throat, light);
      g.userData = { throat, light };
      this.props.add(g);
      this.ventMeshes.push(g);
    }
    vents.forEach((v, i) => {
      const g = this.ventMeshes[i];
      g.visible = true;
      g.position.set(v.x, v.y, v.z);
      const pulse = 0.82 + 0.32 * Math.sin(v.phase || 0);
      g.userData.light.intensity = 2.6 * v.heat * pulse;
    });
    for (let i = vents.length; i < this.ventMeshes.length; i++) this.ventMeshes[i].visible = false;

    if (W.shelters) {
      W.shelters.forEach((sh, i) => {
        if (this.shelterMeshes[i]) this.shelterMeshes[i].position.set(sh.x, sh.y, sh.z);
      });
    }
  }

  // ------------------------------------------------------------------ Layer-1 Geodesic Biodome, Anomaly Tori, Big-Tree Sanctuaries, Crystal Monoliths + C3 Twins & Lithic Tools
  buildDome() {
    const W = this.cr.world;
    this.domeGroup = new THREE.Group();
    this.scene.add(this.domeGroup);

    const rDome = W.dome?.radius || 21.6;

    // 1) Translucent Geodesic Biodome Canopy Shell + Strut Lattice + Grounded Horizon Containment Ring
    const shellGeo = new THREE.SphereGeometry(rDome, 36, 20, 0, Math.PI * 2, 0, Math.PI * 0.52);
    this.domeShellMat = new THREE.MeshPhysicalMaterial({
      color: 0x3ad8ff,
      emissive: 0x0b4c6e,
      emissiveIntensity: 0.35,
      roughness: 0.12,
      metalness: 0.08,
      transparent: true,
      opacity: 0.055,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.domeShellMesh = new THREE.Mesh(shellGeo, this.domeShellMat);
    this.domeShellMesh.position.y = -0.35;
    this.domeGroup.add(this.domeShellMesh);

    const icoGeo = new THREE.IcosahedronGeometry(rDome - 0.04, 3);
    const icoPos = icoGeo.attributes.position;
    for (let i = 0; i < icoPos.count; i++) {
      const y = icoPos.getY(i);
      if (y < -0.6) icoPos.setY(i, -0.6);
    }
    const wireGeo = new THREE.WireframeGeometry(icoGeo);
    this.domeWireMat = new THREE.LineBasicMaterial({
      color: 0x5ce8ff,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
    });
    this.domeWire = new THREE.LineSegments(wireGeo, this.domeWireMat);
    this.domeGroup.add(this.domeWire);

    const baseRingGeo = new THREE.TorusGeometry(rDome, 0.14, 12, 96);
    baseRingGeo.rotateX(Math.PI / 2);
    this.domeRingMat = new THREE.MeshStandardMaterial({
      color: 0x264860,
      emissive: 0x22b8e0,
      emissiveIntensity: 0.75,
      roughness: 0.28,
      metalness: 0.65,
    });
    this.domeBaseRing = new THREE.Mesh(baseRingGeo, this.domeRingMat);
    this.domeBaseRing.position.y = 0.05;
    this.domeGroup.add(this.domeBaseRing);

    // 2) 3 Reality-Glitch Physics Anomaly Tori (low-g cyan, chrono-visc violet, sensory-crack amber)
    this.anomalyMeshes = [];
    for (const az of (W.anomalyZones || [])) {
      const grp = new THREE.Group();
      const col = new THREE.Color().setHSL(az.hue ?? 0.53, 0.92, 0.58);
      const rMat = new THREE.MeshStandardMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 1.15,
        roughness: 0.2,
        transparent: true,
        opacity: 0.68,
      });
      const outer = new THREE.Mesh(new THREE.TorusGeometry(az.r, 0.045, 10, 48), rMat);
      outer.rotation.x = Math.PI / 2;
      const inner = new THREE.Mesh(new THREE.TorusGeometry(az.r * 0.62, 0.032, 8, 36), rMat);
      inner.rotation.x = Math.PI * 0.36;
      const floorDisc = new THREE.Mesh(
        new THREE.CircleGeometry(az.r * 0.96, 36),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.09, side: THREE.DoubleSide, depthWrite: false })
      );
      floorDisc.rotation.x = -Math.PI / 2;
      floorDisc.position.y = -0.26;
      grp.add(outer, inner, floorDisc);
      grp.position.set(az.x, az.y, az.z);
      this.domeGroup.add(grp);
      this.anomalyMeshes.push({ grp, outer, inner, rMat });
    }

    // 3) 2 Giant Bioluminescent Big-Tree Sanctuaries (`GATE-DOME-REFUGE` canopy + buttress roots + golden nectar orbs)
    this.sanctuaryMeshes = [];
    for (const sc of (W.sanctuaries || [])) {
      const grp = new THREE.Group();
      const trunkMat = new THREE.MeshStandardMaterial({
        color: 0x3b2d26,
        emissive: new THREE.Color().setHSL(sc.hue, 0.75, 0.12),
        roughness: 0.78,
      });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.78, sc.h, 12), trunkMat);
      trunk.position.y = sc.h * 0.48;
      trunk.castShadow = true;
      grp.add(trunk);

      for (let b = 0; b < 5; b++) {
        const ang = (b * Math.PI * 2) / 5;
        const root = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.35, 6), trunkMat);
        root.position.set(Math.cos(ang) * 0.62, 0.48, Math.sin(ang) * 0.62);
        root.rotation.z = -Math.cos(ang) * 0.42;
        root.rotation.x = Math.sin(ang) * 0.42;
        grp.add(root);
      }

      const canCol = new THREE.Color().setHSL(sc.hue, 0.88, 0.52);
      const canopyMat = new THREE.MeshPhysicalMaterial({
        color: canCol,
        emissive: canCol,
        emissiveIntensity: 0.72,
        roughness: 0.25,
        transmission: 0.35,
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide,
      });
      const canopy = new THREE.Mesh(new THREE.SphereGeometry(sc.r * 0.76, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.56), canopyMat);
      canopy.position.y = sc.h * 0.86;
      canopy.scale.set(1, 0.62, 1);
      grp.add(canopy);

      const orbs = [];
      const orbGeo = new THREE.SphereGeometry(0.14, 12, 10);
      const orbMat = new THREE.MeshStandardMaterial({
        color: 0xffe27a,
        emissive: 0xffb830,
        emissiveIntensity: 1.45,
        roughness: 0.18,
      });
      for (let k = 0; k < 6; k++) {
        const oa = (k * Math.PI) / 3 + 0.25;
        const om = new THREE.Mesh(orbGeo, orbMat);
        om.position.set(Math.cos(oa) * sc.r * 0.52, sc.h * 0.74, Math.sin(oa) * sc.r * 0.52);
        grp.add(om);
        orbs.push(om);
      }

      const wardRing = new THREE.Mesh(
        new THREE.RingGeometry(sc.r - 0.12, sc.r, 48),
        new THREE.MeshBasicMaterial({ color: canCol, transparent: true, opacity: 0.36, side: THREE.DoubleSide, depthWrite: false })
      );
      wardRing.rotation.x = -Math.PI / 2;
      wardRing.position.y = 0.06;
      grp.add(wardRing);

      grp.position.set(sc.x, sc.y, sc.z);
      this.domeGroup.add(grp);
      this.sanctuaryMeshes.push({ grp, canopyMat, orbMat, orbs, wardRing });
    }

    // 4) 4 Quantum-Geometric Crystal Monoliths + C3 Cospectral Twin Obelisks (sigma_0 / sigma_1)
    this.monolithMeshes = [];
    for (const mn of (W.monoliths || [])) {
      const grp = new THREE.Group();
      const col = new THREE.Color().setHSL(mn.hue ?? 0.52, 0.9, 0.58);
      const cMat = new THREE.MeshPhysicalMaterial({
        color: col,
        emissive: col,
        emissiveIntensity: 0.95,
        roughness: 0.08,
        metalness: 0.22,
        transmission: 0.45,
        iridescence: 0.85,
        transparent: true,
        opacity: 0.9,
      });
      let spireGeo;
      if (mn.kind === 'ck31') spireGeo = new THREE.OctahedronGeometry(0.78, 1);
      else if (mn.kind === 'cabello33') spireGeo = new THREE.CylinderGeometry(0.38, 0.62, mn.h, 6);
      else if (mn.kind === 'cega18') spireGeo = new THREE.OctahedronGeometry(0.82, 0);
      else spireGeo = new THREE.ConeGeometry(0.58, mn.h, 8);

      const spire = new THREE.Mesh(spireGeo, cMat);
      spire.position.y = mn.kind === 'cabello33' || mn.kind === 'hoggar64' ? mn.h * 0.5 : 1.45;
      if (mn.kind === 'ck31' || mn.kind === 'cega18') spire.scale.set(1, 1.75, 1);
      spire.castShadow = true;
      grp.add(spire);

      const ped = new THREE.Mesh(
        new THREE.CylinderGeometry(0.82, 1.05, 0.34, 8),
        new THREE.MeshStandardMaterial({ color: 0x1d2736, roughness: 0.55, metalness: 0.5 })
      );
      ped.position.y = 0.17;
      grp.add(ped);

      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.035, 8, 36), cMat);
      halo.position.y = 1.65;
      halo.rotation.x = Math.PI * 0.42;
      grp.add(halo);

      // Flanking C3 Cospectral Twin Obelisks on Hoggar-64 monolith: sigma_0 (contextual trap) vs sigma_1 (Jordan-safe)
      if (mn.twins) {
        for (const tw of mn.twins) {
          const twCol = tw.safe ? new THREE.Color(0x42f5a7) : new THREE.Color(0xff5277);
          const twMat = new THREE.MeshPhysicalMaterial({
            color: twCol,
            emissive: twCol,
            emissiveIntensity: 0.85,
            roughness: 0.14,
            metalness: 0.25,
            transparent: true,
            opacity: 0.88,
          });
          const ob = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.28, 1.55, 6), twMat);
          ob.position.set(tw.dx, 0.78, tw.dz);
          grp.add(ob);
        }
      }

      grp.position.set(mn.x, mn.y, mn.z);
      this.domeGroup.add(grp);
      this.monolithMeshes.push({ grp, spire, halo, cMat });
    }

    // 5) 6 Movable Lithic DomeStones, 4 Spoiling DomeCaches & up to 16 Shed Exuvia Chitin Shells
    this.stoneMeshes = [];
    const stoneGeo = new THREE.DodecahedronGeometry(1, 1);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8b95a6, roughness: 0.68, metalness: 0.22 });
    for (const st of (W.domeStones || [])) {
      const m = new THREE.Mesh(stoneGeo, stoneMat);
      m.scale.set(st.r * 1.15, st.r * 0.82, st.r * 1.05);
      m.castShadow = true;
      m.position.set(st.x, st.y, st.z);
      this.domeGroup.add(m);
      this.stoneMeshes.push(m);
    }

    this.cacheMeshes = [];
    const cacheGeo = new THREE.IcosahedronGeometry(0.24, 1);
    for (const dc of (W.domeCaches || [])) {
      const cMat = new THREE.MeshStandardMaterial({
        color: dc.hardShell ? 0xd9a441 : 0x72e896,
        emissive: dc.hardShell ? 0x6e4810 : 0x1e6b38,
        emissiveIntensity: 0.65,
        roughness: 0.32,
      });
      const m = new THREE.Mesh(cacheGeo, cMat);
      m.position.set(dc.x, dc.y, dc.z);
      this.domeGroup.add(m);
      this.cacheMeshes.push({ mesh: m, mat: cMat });
    }

    this.exuviaMeshes = [];
    const exGeo = new THREE.SphereGeometry(0.22, 12, 8);
    exGeo.scale(1.45, 0.55, 0.85);
    for (let i = 0; i < 16; i++) {
      const exMat = new THREE.MeshPhysicalMaterial({
        color: 0xc8eef8,
        emissive: 0x24586e,
        emissiveIntensity: 0.35,
        roughness: 0.25,
        transmission: 0.55,
        transparent: true,
        opacity: 0.65,
      });
      const m = new THREE.Mesh(exGeo, exMat);
      m.visible = false;
      this.domeGroup.add(m);
      this.exuviaMeshes.push({ mesh: m, mat: exMat });
    }
  }

  syncDome(t, day) {
    const W = this.cr.world;
    if (!this.domeGroup || !W.dome) return;
    const D = W.dome;
    // Clamp all Dome & Sanctuary visual pulses strictly <= 3 Hz (here 0.25..0.65 Hz)!
    const slowPulse = 0.5 + 0.5 * Math.sin(t * 2.1); // 0.33 Hz
    const storm = D.auroraStorm || 0;
    this.domeShellMat.opacity = 0.045 + 0.075 * storm * slowPulse + 0.02 * (1 - day);
    this.domeShellMat.emissive.setHSL((0.52 + 0.16 * storm) % 1, 0.85, 0.18 + 0.22 * storm);
    this.domeWireMat.opacity = 0.11 + 0.14 * storm * slowPulse;
    this.domeRingMat.emissiveIntensity = 0.55 + 0.65 * slowPulse + 0.8 * storm;

    if (W.anomalyZones) {
      for (let i = 0; i < this.anomalyMeshes.length; i++) {
        const az = W.anomalyZones[i], am = this.anomalyMeshes[i];
        if (!az || !am) continue;
        am.grp.position.set(az.x, az.y, az.z);
        am.outer.rotation.z = t * 0.65 * (i % 2 === 0 ? 1 : -1);
        am.inner.rotation.y = t * 0.95;
        am.rMat.emissiveIntensity = 0.85 + 0.45 * Math.sin(t * 2.6 + i);
      }
    }

    if (W.sanctuaries) {
      for (let i = 0; i < this.sanctuaryMeshes.length; i++) {
        const sc = W.sanctuaries[i], sm = this.sanctuaryMeshes[i];
        if (!sc || !sm) continue;
        sm.grp.position.set(sc.x, W.height(sc.x, sc.z), sc.z);
        const nec = clamp(sc.nectar ?? 0.8, 0, 1);
        sm.canopyMat.emissiveIntensity = 0.55 + 0.45 * nec + 0.22 * (1 - day);
        sm.orbMat.emissiveIntensity = 0.45 + 1.45 * nec * (0.8 + 0.2 * Math.sin(t * 2.8 + i));
        for (let k = 0; k < sm.orbs.length; k++) {
          sm.orbs[k].visible = nec > 0.08;
          sm.orbs[k].scale.setScalar(0.45 + 0.65 * nec);
        }
      }
    }

    if (W.monoliths) {
      for (let i = 0; i < this.monolithMeshes.length; i++) {
        const mn = W.monoliths[i], mm = this.monolithMeshes[i];
        if (!mn || !mm) continue;
        mm.grp.position.set(mn.x, W.height(mn.x, mn.z), mn.z);
        mm.spire.rotation.y = t * 0.45 + mn.phase;
        mm.halo.rotation.z = -t * 0.75;
        mm.cMat.emissiveIntensity = 0.45 + 1.05 * (mn.charge ?? 0.8) * (0.85 + 0.15 * Math.sin(t * 2.4 + i));
      }
    }

    if (W.domeStones) {
      for (let i = 0; i < this.stoneMeshes.length; i++) {
        const st = W.domeStones[i], m = this.stoneMeshes[i];
        if (!st || !m) continue;
        m.position.set(st.x, st.heldBy ? st.y : W.height(st.x, st.z) + st.r * 0.72, st.z);
      }
    }

    if (W.domeCaches) {
      for (let i = 0; i < this.cacheMeshes.length; i++) {
        const dc = W.domeCaches[i], cm = this.cacheMeshes[i];
        if (!dc || !cm) continue;
        cm.mesh.visible = dc.energy > 0.06;
        if (!cm.mesh.visible) continue;
        cm.mesh.position.set(dc.x, W.height(dc.x, dc.z) + 0.16, dc.z);
        cm.mesh.scale.setScalar(0.65 + 0.45 * dc.energy);
        const fresh = clamp(dc.freshness ?? 1, 0, 1);
        cm.mat.color.setHSL(dc.hardShell ? 0.11 * fresh + 0.06 : 0.34 * fresh + 0.08, 0.45 + 0.45 * fresh, 0.32 + 0.26 * fresh);
      }
    }

    const exArr = W.exuvia || [];
    for (let i = 0; i < this.exuviaMeshes.length; i++) {
      const em = this.exuviaMeshes[i];
      if (i >= exArr.length) {
        em.mesh.visible = false;
        continue;
      }
      const ex = exArr[i];
      em.mesh.visible = true;
      em.mesh.position.set(ex.x, W.height(ex.x, ex.z) + 0.09, ex.z);
      em.mesh.scale.setScalar(0.55 + 0.55 * (ex.mineral ?? 0.8));
      em.mat.color.setHSL(ex.hue ?? 0.72, 0.45, 0.68);
      em.mat.opacity = 0.25 + 0.48 * (ex.mineral ?? 0.8);
    }
  }

  // ------------------------------------------------------------------ 32-Peer Skinned Biosphere, Translucent Eggs, Bio-Mites & Shadow-Leviathans
  buildEcosystem() {
    const S = this.scene;
    this.ecoGroup = new THREE.Group();
    S.add(this.ecoGroup);

    // 1) Conspecific Peer Pool (up to 32 continuous Catmull-Rom skinned creatures with 4/6/8 Hox limbs)
    this.peerPool = [];
    const peerEyeGeo = new THREE.SphereGeometry(0.048, 16, 12);
    const peerPupilMat = new THREE.MeshStandardMaterial({ color: 0x05070e, roughness: 0.08, metalness: 0.2 });
    const peerLimbGeo = makeTubeGeometry(6, 7);
    {
      const lPts = [[0, 0, 0], [0, -0.05, 0.11], [0, -0.15, 0.20], [0, -0.22, 0.24]];
      const lRad = [0.038, 0.044, 0.028, 0.018];
      writeCatmullTube(peerLimbGeo, 6, 7, lPts, lRad, [0, 1, 0]);
    }
    const auraGeo = new THREE.RingGeometry(0.36, 0.44, 32);
    auraGeo.rotateX(-Math.PI / 2);

    for (let i = 0; i < MAX_PEER_MESHES; i++) {
      const grp = new THREE.Group();
      grp.visible = false;

      const bodyGeo = makeTubeGeometry(PEER_RINGS, PEER_SIDES);
      const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x38d8c0,
        emissive: 0x0b3038,
        emissiveIntensity: 0.55,
        roughness: 0.28,
        metalness: 0.06,
        clearcoat: 0.78,
        clearcoatRoughness: 0.16,
        iridescence: 0.75,
        iridescenceIOR: 1.65,
      });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      bodyMesh.castShadow = true;
      bodyMesh.frustumCulled = false;
      grp.add(bodyMesh);

      // Dorsal bioluminescent crest ribbon along the 7 peer spine segments
      const crestPos = new Float32Array(14 * 3);
      const crestIdx = [];
      for (let s = 0; s < 6; s++) {
        const a = s * 2;
        crestIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      const crestGeo = new THREE.BufferGeometry();
      crestGeo.setAttribute('position', new THREE.BufferAttribute(crestPos, 3));
      crestGeo.setIndex(crestIdx);
      const crestMat = new THREE.MeshPhysicalMaterial({
        color: 0x58f5ff,
        emissive: 0x24b8d8,
        emissiveIntensity: 0.95,
        roughness: 0.22,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      });
      const crestMesh = new THREE.Mesh(crestGeo, crestMat);
      crestMesh.frustumCulled = false;
      grp.add(crestMesh);

      // Bilateral stalked eyes on rostral segment
      const eyes = [];
      for (let side = -1; side <= 1; side += 2) {
        const eg = new THREE.Group();
        const iris = new THREE.Mesh(peerEyeGeo, new THREE.MeshPhysicalMaterial({
          color: 0xffe498, emissive: 0x443008, roughness: 0.1, clearcoat: 1.0,
        }));
        const pup = new THREE.Mesh(peerEyeGeo, peerPupilMat);
        pup.scale.set(0.55, 0.55, 0.55);
        pup.position.z = 0.026;
        eg.add(iris, pup);
        grp.add(eg);
        eyes.push(eg);
      }

      // Up to 10 lateral muscular limbs (pairs 0..4 -> 0L Serpent, 4L Tetrapod, 6L Hexapod, 8L Octopod, or 10L Decapod!)
      const limbs = [];
      for (let k = 0; k < 10; k++) {
        const lm = new THREE.Mesh(peerLimbGeo, bodyMat);
        grp.add(lm);
        limbs.push(lm);
      }

      const auraMat = new THREE.MeshBasicMaterial({
        color: 0xff62e8,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const aura = new THREE.Mesh(auraGeo, auraMat);
      grp.add(aura);

      this.ecoGroup.add(grp);
      this.peerPool.push({
        grp, bodyGeo, bodyMat, crestGeo, crestMat, eyes, limbs, aura, auraMat,
        pts: Array.from({ length: 7 }, () => [0, 0, 0]),
        radii: new Float32Array(7),
      });
    }

    // 2) Translucent Chorion Eggs with Pulsing Curled Embryo Cores
    this.eggPool = [];
    const shellGeo = new THREE.SphereGeometry(0.155, 24, 18);
    shellGeo.scale(1.0, 1.24, 1.0);
    const embryoGeo = new THREE.TorusKnotGeometry(0.052, 0.020, 32, 8, 2, 3);
    for (let i = 0; i < MAX_EGG_MESHES; i++) {
      const grp = new THREE.Group();
      grp.visible = false;
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: 0x9ef8ff,
        emissive: 0x104050,
        emissiveIntensity: 0.45,
        roughness: 0.08,
        transmission: 0.72,
        thickness: 0.45,
        ior: 1.44,
        clearcoat: 1.0,
        iridescence: 0.85,
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      const embMat = new THREE.MeshStandardMaterial({
        color: 0xff70d8,
        emissive: 0xff44b8,
        emissiveIntensity: 1.4,
        roughness: 0.3,
      });
      const embryo = new THREE.Mesh(embryoGeo, embMat);
      grp.add(shell, embryo);
      this.ecoGroup.add(grp);
      this.eggPool.push({ grp, shellMat, embMat, embryo });
    }

    // 3) 80 Soft Radial-Glow Photonic Bio-Mite Pollinators
    this.maxMites = 80;
    const mGeo = new THREE.BufferGeometry();
    const mPos = new Float32Array(this.maxMites * 3);
    const mCol = new Float32Array(this.maxMites * 3);
    mGeo.setAttribute('position', new THREE.BufferAttribute(mPos, 3));
    mGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
    this.miteSpriteMat = makeSoftSpriteMaterial(0.20, 0.95, true);
    this.mitePts = new THREE.Points(mGeo, this.miteSpriteMat);
    this.mitePts.frustumCulled = false;
    this.ecoGroup.add(this.mitePts);

    // 4) 3 Sculpted Armored Shadow-Leviathan Apex Predators (continuous wyrm tube + mandibles + dorsal spines)
    this.predPool = [];
    const mandibleGeo = buildCurvedTalonGeo();
    const spineGeo = new THREE.ConeGeometry(0.032, 0.22, 6);
    for (let i = 0; i < 3; i++) {
      const grp = new THREE.Group();
      grp.visible = false;
      const wGeo = makeTubeGeometry(LEVIATHAN_SEGS, 12);
      const wMat = new THREE.MeshPhysicalMaterial({
        color: 0x140b1e,
        emissive: 0x3b081e,
        emissiveIntensity: 0.75,
        roughness: 0.24,
        metalness: 0.38,
        clearcoat: 0.88,
        iridescence: 0.92,
        iridescenceIOR: 2.0,
      });
      const wyrm = new THREE.Mesh(wGeo, wMat);
      wyrm.castShadow = true;
      wyrm.frustumCulled = false;
      grp.add(wyrm);

      const headGrp = new THREE.Group();
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2048 });
      const eyeSphere = new THREE.SphereGeometry(0.042, 12, 10);
      for (let e = 0; e < 4; e++) {
        const sgn = e < 2 ? -1 : 1;
        const row = e % 2;
        const em = new THREE.Mesh(eyeSphere, eyeMat);
        em.position.set(sgn * (0.11 + row * 0.045), 0.05 - row * 0.03, 0.14 - row * 0.06);
        headGrp.add(em);
      }
      const jaws = [];
      const jawMat = new THREE.MeshStandardMaterial({ color: 0x2b1024, emissive: 0x680a22, roughness: 0.2, metalness: 0.5 });
      for (let sgn = -1; sgn <= 1; sgn += 2) {
        const jw = new THREE.Mesh(mandibleGeo, jawMat);
        jw.scale.set(2.2, 2.2, 2.6);
        jw.position.set(sgn * 0.12, -0.04, 0.16);
        jw.rotation.z = sgn * 1.25;
        headGrp.add(jw);
        jaws.push(jw);
      }
      grp.add(headGrp);

      const spines = [];
      const spMat = new THREE.MeshStandardMaterial({ color: 0xff2858, emissive: 0x880828, roughness: 0.28 });
      for (let s = 0; s < 8; s++) {
        const sp = new THREE.Mesh(spineGeo, spMat);
        grp.add(sp);
        spines.push(sp);
      }

      this.ecoGroup.add(grp);
      this.predPool.push({
        grp, wGeo, headGrp, jaws, spines,
        pts: Array.from({ length: 9 }, () => [0, 0, 0]),
        radii: [0.04, 0.09, 0.14, 0.19, 0.22, 0.23, 0.21, 0.19, 0.14],
      });
    }

    // 5) 256 GPU-Instanced 3D Benthic Detritivore Isopods, Pelagic Pool Copepods & Rhizosphere Springtails
    const mfGeo = new THREE.SphereGeometry(0.045, 10, 8);
    mfGeo.scale(1.65, 0.62, 0.92);
    const mfMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      emissive: 0x163844,
      emissiveIntensity: 0.72,
      roughness: 0.24,
      metalness: 0.18,
      clearcoat: 0.92,
      iridescence: 0.75,
    });
    this.microFaunaMesh = new THREE.InstancedMesh(mfGeo, mfMat, MAX_MICRO_FAUNA);
    this.microFaunaMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.microFaunaMesh.frustumCulled = false;
    const cInit = new THREE.Color();
    for (let i = 0; i < MAX_MICRO_FAUNA; i++) {
      cInit.setHSL(i % 3 === 0 ? 0.09 : i % 3 === 1 ? 0.52 : 0.34, 0.92, 0.58);
      this.microFaunaMesh.setColorAt(i, cInit);
    }
    if (this.microFaunaMesh.instanceColor) this.microFaunaMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.microFaunaMesh);

    // 6) 96 Bioluminescent Rhizosphere Mycena Mushroom Clusters around Flora & Basalt Outcrops
    const capGeo = new THREE.ConeGeometry(0.11, 0.085, 14, 1, true);
    capGeo.translate(0, 0.145, 0);
    const stemGeo = new THREE.CylinderGeometry(0.016, 0.026, 0.14, 8);
    stemGeo.translate(0, 0.07, 0);
    const capMat = new THREE.MeshPhysicalMaterial({
      color: 0x4ef5ff,
      emissive: 0x18c8e8,
      emissiveIntensity: 1.15,
      roughness: 0.22,
      transmission: 0.48,
      transparent: true,
      opacity: 0.88,
      side: THREE.DoubleSide,
    });
    const stemMat = new THREE.MeshStandardMaterial({
      color: 0xc8f4ff,
      emissive: 0x145868,
      emissiveIntensity: 0.55,
      roughness: 0.45,
    });
    this.mushroomCaps = new THREE.InstancedMesh(capGeo, capMat, MUSHROOM_COUNT);
    this.mushroomStems = new THREE.InstancedMesh(stemGeo, stemMat, MUSHROOM_COUNT);
    this.mushroomCapMat = capMat;
    const W = this.cr.world;
    const mushDummy = new THREE.Object3D();
    const mushCol = new THREE.Color();
    for (let i = 0; i < MUSHROOM_COUNT; i++) {
      const pl = W.plants[i % Math.max(1, W.plants.length)] || { x: 0, z: 0 };
      const ang = (i * 2.39996) % (Math.PI * 2);
      const rad = 0.42 + ((i * 7) % 11) * 0.095;
      const mx = pl.x + Math.cos(ang) * rad;
      const mz = pl.z + Math.sin(ang) * rad;
      const my = W.height(mx, mz) - 0.01;
      const sc = 0.55 + ((i * 13) % 9) * 0.09;
      mushDummy.position.set(mx, my, mz);
      mushDummy.rotation.set((Math.sin(i * 3.1) * 0.16), ang, (Math.cos(i * 2.7) * 0.16));
      mushDummy.scale.setScalar(sc);
      mushDummy.updateMatrix();
      this.mushroomCaps.setMatrixAt(i, mushDummy.matrix);
      this.mushroomStems.setMatrixAt(i, mushDummy.matrix);
      mushCol.setHSL((0.46 + (i % 5) * 0.075) % 1, 0.92, 0.62);
      this.mushroomCaps.setColorAt(i, mushCol);
    }
    this.mushroomCaps.instanceMatrix.needsUpdate = true;
    this.mushroomStems.instanceMatrix.needsUpdate = true;
    if (this.mushroomCaps.instanceColor) this.mushroomCaps.instanceColor.needsUpdate = true;
    this.scene.add(this.mushroomCaps, this.mushroomStems);

    // 7) Multi-Kingdom Dome Species: Xenomimic Bell Twins, Xylos Poincare Gliders, Geopolitical Titans & Amorphous Shoggoths
    this.xenomimicPool = [];
    const xmBodyGeo = new THREE.ConeGeometry(0.18, 0.72, 8);
    xmBodyGeo.rotateX(Math.PI / 2);
    const xmWingGeo = new THREE.BoxGeometry(0.88, 0.03, 0.34);
    for (let i = 0; i < 4; i++) {
      const grp = new THREE.Group();
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x42e8ff,
        emissive: 0x1685d8,
        emissiveIntensity: 0.9,
        roughness: 0.14,
        metalness: 0.25,
        iridescence: 0.95,
      });
      const body = new THREE.Mesh(xmBodyGeo, mat);
      const wing = new THREE.Mesh(xmWingGeo, mat);
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x7af5ff, emissiveIntensity: 1.6 })
      );
      core.position.y = 0.08;
      grp.add(body, wing, core);
      grp.visible = false;
      this.ecoGroup.add(grp);
      this.xenomimicPool.push({ grp, wing, mat, core });
    }
    // 2 Entanglement Bell Ribbons linking twin pairs (0<->1, 2<->3)
    this.bellRibbons = [];
    for (let p = 0; p < 2; p++) {
      const rGeo = new THREE.BufferGeometry();
      rGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(12 * 3), 3));
      const rMat = new THREE.LineBasicMaterial({ color: 0x70f8ff, transparent: true, opacity: 0.55 });
      const ln = new THREE.Line(rGeo, rMat);
      ln.frustumCulled = false;
      ln.visible = false;
      this.ecoGroup.add(ln);
      this.bellRibbons.push({ line: ln, geo: rGeo, mat: rMat });
    }

    // Xylos (4 radial 6-lobe Poincare-disk gliders with 2-slot Global Workspace highlight)
    this.xylosPool = [];
    const xyDomeGeo = new THREE.SphereGeometry(0.32, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const xyLobeGeo = new THREE.SphereGeometry(0.11, 10, 8);
    xyLobeGeo.scale(1.6, 0.55, 0.85);
    for (let i = 0; i < 4; i++) {
      const grp = new THREE.Group();
      const bellMat = new THREE.MeshPhysicalMaterial({
        color: 0x62ffd2,
        emissive: 0x168a72,
        emissiveIntensity: 0.65,
        roughness: 0.16,
        transmission: 0.52,
        transparent: true,
        opacity: 0.84,
        side: THREE.DoubleSide,
      });
      const bell = new THREE.Mesh(xyDomeGeo, bellMat);
      grp.add(bell);
      const lobes = [];
      for (let l = 0; l < 6; l++) {
        const lMat = new THREE.MeshStandardMaterial({
          color: 0x48e8c8,
          emissive: 0x157868,
          emissiveIntensity: 0.5,
          roughness: 0.25,
        });
        const lm = new THREE.Mesh(xyLobeGeo, lMat);
        const la = (l * Math.PI) / 3;
        lm.position.set(Math.cos(la) * 0.36, -0.02, Math.sin(la) * 0.36);
        lm.rotation.y = -la;
        grp.add(lm);
        lobes.push({ mesh: lm, mat: lMat });
      }
      grp.visible = false;
      this.ecoGroup.add(grp);
      this.xylosPool.push({ grp, bell, bellMat, lobes });
    }

    // Titans (3 towering 1.4u geopolitical litho-colossi with emerald/cyan/crimson IPD treaty cores)
    this.titanPool = [];
    const tiTorsoGeo = new THREE.DodecahedronGeometry(0.62, 0);
    const tiPlateGeo = new THREE.OctahedronGeometry(0.24, 0);
    for (let i = 0; i < 3; i++) {
      const grp = new THREE.Group();
      const armorMat = new THREE.MeshStandardMaterial({
        color: 0x2d3545,
        emissive: 0x101826,
        roughness: 0.42,
        metalness: 0.68,
      });
      const torso = new THREE.Mesh(tiTorsoGeo, armorMat);
      torso.scale.set(0.95, 1.45, 0.95);
      torso.position.y = 0.95;
      torso.castShadow = true;
      grp.add(torso);

      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x3cf5a8,
        emissive: 0x22e890,
        emissiveIntensity: 1.5,
        roughness: 0.15,
      });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), coreMat);
      core.position.y = 1.65;
      grp.add(core);

      const plates = [];
      for (let k = 0; k < 3; k++) {
        const pm = new THREE.Mesh(tiPlateGeo, armorMat);
        grp.add(pm);
        plates.push(pm);
      }

      const ringMat = new THREE.MeshBasicMaterial({ color: 0x3cf5a8, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
      const ring = new THREE.Mesh(new THREE.RingGeometry(1.15, 1.28, 36), ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.05;
      grp.add(ring);

      grp.visible = false;
      this.ecoGroup.add(grp);
      this.titanPool.push({ grp, torso, core, coreMat, plates, ringMat });
    }

    // Shoggoths (2 amorphous opalescent ambushers whose tendrils & glow clamp by meek = 1 - 0.6 * deceive)
    this.shoggothPool = [];
    const shCoreGeo = new THREE.IcosahedronGeometry(0.44, 2);
    const shTentGeo = new THREE.ConeGeometry(0.085, 0.68, 7);
    shTentGeo.rotateX(Math.PI / 2);
    for (let i = 0; i < 2; i++) {
      const grp = new THREE.Group();
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x2b193d,
        emissive: 0x6a1eb8,
        emissiveIntensity: 0.85,
        roughness: 0.12,
        clearcoat: 1.0,
        iridescence: 0.9,
      });
      const core = new THREE.Mesh(shCoreGeo, mat);
      core.scale.set(1.15, 0.72, 1.15);
      core.position.y = 0.28;
      grp.add(core);

      const tendrils = [];
      for (let k = 0; k < 6; k++) {
        const tm = new THREE.Mesh(shTentGeo, mat);
        grp.add(tm);
        tendrils.push(tm);
      }
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffd25a, emissive: 0xff5a2a, emissiveIntensity: 1.3 });
      const eyes = [];
      for (let e = 0; e < 4; e++) {
        const em = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 8), eyeMat);
        const ea = (e * Math.PI) / 2 + 0.4;
        em.position.set(Math.cos(ea) * 0.28, 0.46, Math.sin(ea) * 0.28);
        grp.add(em);
        eyes.push(em);
      }
      grp.visible = false;
      this.ecoGroup.add(grp);
      this.shoggothPool.push({ grp, core, mat, tendrils, eyeMat });
    }
  }

  syncEcosystem(t) {
    // Always animate the 256 embodied 3D micro-fauna in the biosphere (even if conspecific peers are 0)
    if (this.microFaunaMesh && this.cr.world.microFauna) {
      const mf = this.cr.world.microFauna;
      const nMF = Math.min(mf.length, MAX_MICRO_FAUNA);
      for (let i = 0; i < nMF; i++) {
        const f = mf[i];
        const sc = 0.68 + 0.55 * (f.energy ?? 0.7);
        this._tmpV1.set(f.x, f.y + 0.02, f.z);
        this._tmpQ.setFromAxisAngle(this._upVec, -(f.hdg || 0));
        this._tmpV2.set(sc, sc, sc);
        this._tmpM.compose(this._tmpV1, this._tmpQ, this._tmpV2);
        this.microFaunaMesh.setMatrixAt(i, this._tmpM);
      }
      this.microFaunaMesh.count = nMF;
      this.microFaunaMesh.instanceMatrix.needsUpdate = true;
    }

    const eco = this.cr.eco;
    if (!eco) {
      this.ecoGroup.visible = false;
      return;
    }
    this.ecoGroup.visible = true;

    // 1) Sync up to 48 embodied 5-clade conspecifics
    const peers = eco.peers;
    const nP = Math.min(peers.length, MAX_PEER_MESHES);
    const prof = [0.58, 0.86, 1.0, 1.05, 0.98, 0.88, 0.72];
    for (let i = 0; i < MAX_PEER_MESHES; i++) {
      const slot = this.peerPool[i];
      if (i >= nP) {
        slot.grp.visible = false;
        continue;
      }
      const p = peers[i];
      slot.grp.visible = true;
      const hue = p.gen.pigmentHue ?? 0.55;
      const girth = (p.gen.bodyGirth ?? 1.0) * p.scale;
      const crestH = 0.15 * (p.gen.crestFin ?? 1.0) * p.scale;
      slot.bodyMat.color.setHSL(hue, 0.74 - 0.35 * p.camo, 0.42 + 0.10 * p.courtship);
      slot.bodyMat.emissive.setHSL((hue + 0.08) % 1, 0.88, 0.12 + 0.22 * p.courtship + 0.12 * p.vocalAmp);
      const casteHue = p.casteId === 0 ? 0.13 : p.casteId === 2 ? 0.56 : p.casteId === 3 ? 0.08 : p.casteId === 4 ? 0.86 : ((hue + 0.14) % 1);
      slot.crestMat.color.setHSL(casteHue, 0.92, 0.58);
      slot.crestMat.emissive.setHSL(casteHue, 0.95, 0.32 + 0.28 * p.courtship + (p.casteId === 0 ? 0.2 : 0));

      const cPos = slot.crestGeo.attributes.position.array;
      for (let s = 0; s < 7; s++) {
        const sx = p.segX[s], sy = p.segY[s], sz = p.segZ[s];
        slot.pts[s][0] = sx;
        slot.pts[s][1] = sy;
        slot.pts[s][2] = sz;
        const rSeg = 0.165 * prof[s] * girth;
        slot.radii[s] = rSeg;
        const arch = Math.sin(((s + 0.5) / 7) * Math.PI);
        cPos[6 * s] = sx;
        cPos[6 * s + 1] = sy + rSeg * 0.85;
        cPos[6 * s + 2] = sz;
        cPos[6 * s + 3] = sx;
        cPos[6 * s + 4] = sy + rSeg * 0.85 + crestH * arch;
        cPos[6 * s + 5] = sz;
      }
      slot.crestGeo.attributes.position.needsUpdate = true;
      slot.crestGeo.computeVertexNormals();
      writeCatmullTube(slot.bodyGeo, PEER_RINGS, PEER_SIDES, slot.pts, slot.radii, [0, 1, 0]);

      // Head orientation & stalked eyes at segment 6
      const hx = p.segX[6], hy = p.segY[6], hz = p.segZ[6];
      const fx = Math.cos(p.hdg), fz = Math.sin(p.hdg);
      const rx = -fz, rz = fx;
      const stalkL = 0.17 * (p.gen.eyeStalk ?? 1.0) * p.scale;
      for (let e = 0; e < 2; e++) {
        const sgn = e === 0 ? -1 : 1;
        const eg = slot.eyes[e];
        eg.position.set(
          hx + fx * 0.08 * p.scale + rx * sgn * 0.11 * p.scale,
          hy + stalkL,
          hz + fz * 0.08 * p.scale + rz * sgn * 0.11 * p.scale
        );
        eg.scale.setScalar(p.scale);
        eg.lookAt(eg.position.x + fx, eg.position.y, eg.position.z + fz);
      }

      // Hox 0 / 4 / 6 / 8 / 10 lateral limbs across all 5 macro-bauplan clades!
      const limbSegs = [1, 5, 3, 2, 4]; // pair 0=hind, pair 1=fore, pair 2=mid(6L), pair 3=extra(8L), pair 4=decapod(10L)
      const activePairs = p.limbPairs ?? 3;
      for (let pair = 0; pair < 5; pair++) {
        const segIdx = limbSegs[pair];
        const show = pair < activePairs;
        for (let side = 0; side < 2; side++) {
          const k = pair * 2 + side;
          const lm = slot.limbs[k];
          lm.visible = show;
          if (!show) continue;
          const sgn = side === 0 ? -1 : 1;
          const bx = p.segX[segIdx], by = p.segY[segIdx], bz = p.segZ[segIdx];
          const rAttach = slot.radii[segIdx] * 0.82;
          lm.position.set(bx + rx * sgn * rAttach, by - 0.02 * p.scale, bz + rz * sgn * rAttach);
          const swing = Math.sin(p.gaitPh + pair * 1.45 + side * Math.PI) * 0.42;
          lm.rotation.set(0, -p.hdg + (sgn > 0 ? 0 : Math.PI) + swing * sgn, 0);
          lm.scale.setScalar(p.scale * (pair === 1 ? (p.gen.foreLimb ?? 1) : (p.gen.hindLimb ?? 1)));
        }
      }

      const glow = Math.max(p.courtship, p.vocalAmp * 0.8);
      if (glow > 0.06) {
        slot.aura.visible = true;
        slot.aura.position.set(p.x, this.cr.world.height(p.x, p.z) + 0.04, p.z);
        const sAura = p.scale * (0.9 + 0.35 * Math.sin(t * 5.0 + p.id));
        slot.aura.scale.setScalar(sAura);
        slot.auraMat.opacity = Math.min(0.65, glow * 0.55);
      } else {
        slot.aura.visible = false;
      }
    }

    // 2) Sync Chorion Eggs
    const eggs = eco.eggs;
    for (let i = 0; i < MAX_EGG_MESHES; i++) {
      const slot = this.eggPool[i];
      if (i >= eggs.length) {
        slot.grp.visible = false;
        continue;
      }
      const eg = eggs[i];
      slot.grp.visible = true;
      slot.grp.position.set(eg.x, eg.y, eg.z);
      const beat = 1.0 + 0.06 * Math.sin(t * 4.5 + eg.pulse);
      slot.grp.scale.setScalar((0.85 + 0.35 * eg.progress) * beat);
      slot.shellMat.color.setHSL(eg.hue, 0.72, 0.68);
      slot.embMat.color.setHSL((eg.hue + 0.08) % 1, 0.92, 0.55);
      slot.embMat.emissive.setHSL((eg.hue + 0.08) % 1, 0.95, 0.35 + 0.25 * eg.progress);
      slot.embryo.rotation.set(t * 0.9 + eg.pulse, t * 1.3, 0);
      slot.embryo.scale.setScalar(0.55 + 0.55 * eg.progress);
    }

    // 3) Sync Photonic Bio-Mites
    const mites = eco.mites;
    const mPos = this.mitePts.geometry.attributes.position.array;
    const mCol = this.mitePts.geometry.attributes.color.array;
    const nM = Math.min(mites.length, this.maxMites);
    const tmpC = new THREE.Color();
    for (let i = 0; i < nM; i++) {
      const m = mites[i];
      mPos[3 * i] = m.x;
      mPos[3 * i + 1] = m.y + 0.08 * Math.sin(t * 6.0 + m.ph);
      mPos[3 * i + 2] = m.z;
      tmpC.setHSL(m.hue, 0.95, 0.62 + 0.18 * m.pollen);
      mCol[3 * i] = tmpC.r;
      mCol[3 * i + 1] = tmpC.g;
      mCol[3 * i + 2] = tmpC.b;
    }
    this.mitePts.geometry.setDrawRange(0, nM);
    this.mitePts.geometry.attributes.position.needsUpdate = true;
    this.mitePts.geometry.attributes.color.needsUpdate = true;

    // 4) Sync Shadow-Leviathans
    const preds = eco.predators;
    for (let i = 0; i < 3; i++) {
      const slot = this.predPool[i];
      if (i >= preds.length) {
        slot.grp.visible = false;
        continue;
      }
      const pr = preds[i];
      slot.grp.visible = true;
      const fx = Math.cos(pr.hdg), fz = Math.sin(pr.hdg);
      const rx = -fz, rz = fx;
      for (let k = 0; k < 9; k++) {
        const u = k / 8; // 0 = tail tip, 1 = head
        const distBack = (1 - u) * 2.85;
        const slither = Math.sin(t * 5.2 - (1 - u) * 5.4 + pr.ph) * 0.28 * (1.15 - 0.65 * u);
        const archY = Math.sin(u * Math.PI) * 0.18 - pr.swoop * 0.35 * u;
        const wx = pr.x - fx * distBack + rx * slither;
        const wz = pr.z - fz * distBack + rz * slither;
        const wy = Math.max(this.cr.world.height(wx, wz) + 0.22, pr.y + archY);
        slot.pts[k][0] = wx;
        slot.pts[k][1] = wy;
        slot.pts[k][2] = wz;
        if (k < 8) {
          const sp = slot.spines[k];
          sp.position.set(wx, wy + slot.radii[k] * 0.95, wz);
          sp.rotation.set(-0.35, -pr.hdg, 0);
        }
      }
      writeCatmullTube(slot.wGeo, LEVIATHAN_SEGS, 12, slot.pts, slot.radii, [0, 1, 0]);
      const headP = slot.pts[8];
      slot.headGrp.position.set(headP[0], headP[1], headP[2]);
      slot.headGrp.lookAt(headP[0] + fx, headP[1] - pr.swoop * 0.25, headP[2] + fz);
      const snap = 0.25 + 0.45 * pr.swoop + 0.15 * Math.sin(t * 7.5 + pr.ph);
      slot.jaws[0].rotation.y = snap;
      slot.jaws[1].rotation.y = -snap;
    }

    // 5) Sync Multi-Kingdom Dome Species (Xenomimics + Bell Ribbons, Xylos, Titans, Shoggoths; pulses <= 3 Hz)
    const xenos = eco.xenomimics || [];
    for (let i = 0; i < 4; i++) {
      const slot = this.xenomimicPool[i];
      if (!slot) continue;
      if (i >= xenos.length) { slot.grp.visible = false; continue; }
      const xm = xenos[i];
      slot.grp.visible = true;
      const hover = 0.36 + 0.08 * Math.sin(t * 3.2 + xm.phase);
      slot.grp.position.set(xm.x, this.cr.world.height(xm.x, xm.z) + hover, xm.z);
      slot.grp.rotation.set(0, -xm.hdg + Math.PI * 0.5, 0.18 * Math.sin(t * 3.8 + i));
      slot.wing.rotation.z = 0.16 * Math.sin(t * 4.5 + xm.phase);
      const h = xm.chirality > 0 ? 0.53 : 0.79; // +kappa cyan vs -kappa violet Bell twin!
      slot.mat.color.setHSL(h, 0.92, 0.56);
      slot.mat.emissive.setHSL(h, 0.95, 0.25 + 0.35 * (xm.bellFidelity ?? 0.8));
    }
    for (let p = 0; p < 2; p++) {
      const rb = this.bellRibbons[p];
      const a = xenos[2 * p], b = xenos[2 * p + 1];
      if (!rb || !a || !b || (a.bellFidelity ?? 0) < 0.52) {
        if (rb) rb.line.visible = false;
        continue;
      }
      rb.line.visible = true;
      const arr = rb.geo.attributes.position.array;
      const ay = this.cr.world.height(a.x, a.z) + 0.42;
      const by = this.cr.world.height(b.x, b.z) + 0.42;
      for (let k = 0; k < 12; k++) {
        const u = k / 11;
        arr[3 * k] = a.x + (b.x - a.x) * u;
        arr[3 * k + 1] = ay + (by - ay) * u + Math.sin(u * Math.PI) * (0.65 + 0.15 * Math.sin(t * 2.8 + p));
        arr[3 * k + 2] = a.z + (b.z - a.z) * u;
      }
      rb.geo.attributes.position.needsUpdate = true;
      rb.mat.opacity = clamp(((a.chshS ?? 2.4) - 2.0) * 0.65, 0.12, 0.68);
    }

    const xylos = eco.xylos || [];
    for (let i = 0; i < 4; i++) {
      const slot = this.xylosPool[i];
      if (!slot) continue;
      if (i >= xylos.length) { slot.grp.visible = false; continue; }
      const xy = xylos[i];
      slot.grp.visible = true;
      slot.grp.position.set(xy.x, this.cr.world.height(xy.x, xy.z) + 0.24 + 0.05 * Math.sin(t * 2.6 + i), xy.z);
      slot.grp.rotation.y = t * 0.45 + i;
      const slotLobeA = (xy.gwSlotA ?? 0) % 6;
      const slotLobeB = (xy.gwSlotB ?? 1) % 6;
      for (let l = 0; l < 6; l++) {
        const isGW = l === slotLobeA || l === slotLobeB;
        const lb = slot.lobes[l];
        lb.mat.color.setHex(isGW ? 0xffe478 : 0x48e8c8);
        lb.mat.emissive.setHex(isGW ? 0xffa828 : 0x157868);
        lb.mat.emissiveIntensity = isGW ? 1.55 : 0.42;
        lb.mesh.scale.setScalar(isGW ? 1.25 : 0.92);
      }
    }

    const titans = eco.titans || [];
    for (let i = 0; i < 3; i++) {
      const slot = this.titanPool[i];
      if (!slot) continue;
      if (i >= titans.length) { slot.grp.visible = false; continue; }
      const ti = titans[i];
      slot.grp.visible = true;
      slot.grp.position.set(ti.x, this.cr.world.height(ti.x, ti.z), ti.z);
      slot.torso.rotation.y = -ti.hdg;
      slot.core.rotation.y = t * 0.9 + i;
      // Geopolitical Treaty Signal: Crimson = War, Emerald = Alliance, Cyan = Truce
      let hasWar = false, hasAlly = false;
      if (ti.treaty) {
        for (let j = 0; j < ti.treaty.length; j++) {
          if (j === i) continue;
          if (ti.treaty[j] === 'war') hasWar = true;
          else if (ti.treaty[j] === 'alliance') hasAlly = true;
        }
      }
      const colHex = hasWar ? 0xff3b5c : hasAlly ? 0x38f59c : 0x45d8ff;
      slot.coreMat.color.setHex(colHex);
      slot.coreMat.emissive.setHex(colHex);
      slot.ringMat.color.setHex(colHex);
      for (let k = 0; k < 3; k++) {
        const pa = t * 0.85 + (k * Math.PI * 2) / 3 + i;
        slot.plates[k].position.set(Math.cos(pa) * 0.82, 1.05 + 0.12 * Math.sin(t * 2.2 + k), Math.sin(pa) * 0.82);
        slot.plates[k].rotation.set(pa, pa * 0.5, 0);
      }
    }

    const shoggoths = eco.shoggoths || [];
    for (let i = 0; i < 2; i++) {
      const slot = this.shoggothPool[i];
      if (!slot) continue;
      if (i >= shoggoths.length) { slot.grp.visible = false; continue; }
      const sh = shoggoths[i];
      slot.grp.visible = true;
      slot.grp.position.set(sh.x, this.cr.world.height(sh.x, sh.z), sh.z);
      const meek = clamp(sh.meek ?? (1 - 0.6 * (sh.deceive ?? 0)), 0.4, 1.0);
      const lunge = sh.ambush ?? 0;
      slot.core.scale.set(1.12 + 0.14 * Math.sin(t * 2.5 + i), 0.58 + 0.25 * meek + 0.3 * lunge, 1.12 + 0.14 * Math.cos(t * 2.5 + i));
      slot.mat.emissive.setHSL(lunge > 0.2 ? 0.96 : 0.78, 0.88, (0.14 + 0.32 * lunge) * meek);
      slot.eyeMat.emissiveIntensity = (0.55 + 1.45 * lunge) * meek;
      for (let k = 0; k < 6; k++) {
        const ka = (k * Math.PI) / 3 + 0.15 * Math.sin(t * 2.4 + k);
        const reach = (0.36 + 0.32 * meek + 0.42 * lunge);
        const tm = slot.tendrils[k];
        tm.position.set(Math.cos(ka) * reach, 0.16, Math.sin(ka) * reach);
        tm.rotation.y = -ka + Math.PI * 0.5;
        tm.scale.set(meek, meek, 0.65 + 0.55 * meek + 0.5 * lunge);
      }
    }
  }

  // ------------------------------------------------------------------ Next-Gen Organic Focal Creature (96x48 Dermal Spline + 4/6/8 Muscular Limbs + Wet Corneas)
  buildCreature() {
    const S = this.scene, B = this.cr.body;
    this.cg = new THREE.Group();
    S.add(this.cg);

    // 1) 96x48 Continuous Dermal Body Tube with Osteoderm Scute Relief, Subsurface Scattering, Wet Clearcoat & Iridescence
    this.skinGeo = makeTubeGeometry(RING_M, RING_S);
    this.skinTex = new THREE.DataTexture(this.cr.skin.rgba, SW, SH, THREE.RGBAFormat);
    this.skinTex.wrapS = this.skinTex.wrapT = THREE.RepeatWrapping;
    this.skinTex.magFilter = this.skinTex.minFilter = THREE.LinearFilter;
    this.skinTex.needsUpdate = true;

    const dermalTex = this.p5Layer ? this.p5Layer.dermalTex : null;
    this.skinU = {
      t: { value: 0 },
      glitch: { value: 0 },
      sleep: { value: 0 },
      camo: { value: 0 },
      uHue: { value: this.cr.gen.pigmentHue ?? 0.72 },
      uOsteo: { value: B.hox?.osteoderm ?? 0.5 },
      uSkinTex: { value: this.skinTex },
      uDermalTex: { value: dermalTex },
      uHasDermal: { value: dermalTex ? 1.0 : 0.0 },
    };

    this.skinMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.24,
      metalness: 0.04,
      clearcoat: 0.92,
      clearcoatRoughness: 0.11,
      iridescence: 0.86,
      iridescenceIOR: 1.72,
      iridescenceThicknessRange: [160, 680],
      sheen: 0.55,
      sheenRoughness: 0.35,
      sheenColor: new THREE.Color(0x52f2ff),
      transparent: true,
      opacity: 0.88,
    });
    this.skinMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, this.skinU);
      sh.vertexShader = 'varying vec2 vSkinUv; varying vec3 vWPos;\n' + sh.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vSkinUv = uv;`
      ).replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
      sh.fragmentShader = `
        uniform float t, glitch, sleep, camo, uHue, uOsteo, uHasDermal;
        uniform sampler2D uSkinTex, uDermalTex;
        varying vec2 vSkinUv;
        varying vec3 vWPos;

        vec3 hsl2rgb(float h, float s, float l) {
          vec3 rgb = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
        }

        float hexScute(vec2 p) {
          float k1 = cos(p.x * 6.2831853);
          float k2 = cos((0.5 * p.x + 0.8660254 * p.y) * 6.2831853);
          float k3 = cos((-0.5 * p.x + 0.8660254 * p.y) * 6.2831853);
          return clamp(0.5 + 0.1666667 * (k1 + k2 + k3), 0.0, 1.0);
        }
      ` + sh.fragmentShader
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
          vec4 chro = texture2D(uSkinTex, vec2(vSkinUv.x * 1.5, vSkinUv.y * 2.0));
          vec4 derm = uHasDermal > 0.5 ? texture2D(uDermalTex, vec2(vSkinUv.x * 2.2, vSkinUv.y * 2.2)) : vec4(0.3, 0.7, 0.8, 1.0);
          float dorsalMask = pow(max(0.0, cos((vSkinUv.y - 0.0) * 6.283185)), 1.35);
          float bellyMask = pow(max(0.0, -cos(vSkinUv.y * 6.283185)), 1.4);
          float scute = hexScute(vSkinUv * vec2(34.0, 20.0));
          float osteoPlate = smoothstep(0.18, 0.72, scute) * dorsalMask * uOsteo;

          vec3 basePigment = hsl2rgb(fract(uHue + 0.09 * (chro.g - 0.5)), 0.76 - 0.38 * camo, 0.26 + 0.16 * chro.r);
          vec3 counterShade = mix(basePigment, hsl2rgb(fract(uHue + 0.05), 0.42, 0.58), bellyMask * 0.68);
          vec3 plateTint = hsl2rgb(fract(uHue - 0.06), 0.62, 0.18 + 0.14 * scute);
          diffuseColor.rgb = mix(counterShade, plateTint, osteoPlate * 0.58) * (0.76 + 0.52 * derm.rgb);`
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          float scuteR = hexScute(vSkinUv * vec2(34.0, 20.0));
          roughnessFactor = clamp(0.16 + 0.26 * (1.0 - scuteR) + 0.18 * uOsteo * scuteR, 0.08, 0.68);`
        )
        .replace(
          '#include <normal_fragment_maps>',
          `#include <normal_fragment_maps>
          float bumpH = hexScute(vSkinUv * vec2(34.0, 20.0)) * (0.35 + 0.65 * uOsteo)
                      + 0.22 * sin(vSkinUv.x * 150.0) * cos(vSkinUv.y * 110.0);
          vec3 dPdxS = dFdx(vWPos);
          vec3 dPdyS = dFdy(vWPos);
          vec3 gradS = dFdx(bumpH) * cross(normal, dPdyS) + dFdy(bumpH) * cross(dPdxS, normal);
          float gLenS = length(gradS);
          if (gLenS > 1e-6) {
            normal = normalize(normal - (gradS / max(0.015, gLenS)) * min(0.32, gLenS * 2.2));
          }`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          vec4 chroE = texture2D(uSkinTex, vec2(vSkinUv.x * 1.5, vSkinUv.y * 2.0));
          vec4 dermE = uHasDermal > 0.5 ? texture2D(uDermalTex, vec2(vSkinUv.x * 2.2, vSkinUv.y * 2.2)) : vec4(0.2, 0.7, 0.9, 1.0);
          vec3 viewDirW = normalize(cameraPosition - vWPos);
          float sssRim = pow(1.0 - abs(dot(normal, viewDirW)), 2.6);
          vec3 bioWave = hsl2rgb(fract(uHue + 0.15 + 0.12 * chroE.g), 0.95, 0.54);
          totalEmissiveRadiance += bioWave * (0.18 + 0.65 * chroE.a + 0.38 * sssRim) * (1.0 - 0.45 * sleep) * (1.0 - 0.55 * camo);
          totalEmissiveRadiance += dermE.rgb * 0.22 * chroE.b;
          if (glitch > 0.01) {
            float scan = step(0.65, fract(vSkinUv.x * 18.0 - t * 12.0));
            totalEmissiveRadiance += vec3(0.35, 1.0, 0.95) * glitch * scan * 1.3;
          }`
        );
    };

    this.skinMesh = new THREE.Mesh(this.skinGeo, this.skinMat);
    this.skinMesh.castShadow = this.skinMesh.receiveShadow = true;
    this.skinMesh.frustumCulled = false;
    this.cg.add(this.skinMesh);

    // Shared organic muscle & dermal material for seamless limbs, eye stalks, mandible & antennae
    this.appendageMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setHSL(this.cr.gen.pigmentHue ?? 0.72, 0.68, 0.34),
      emissive: new THREE.Color().setHSL(((this.cr.gen.pigmentHue ?? 0.72) + 0.10) % 1, 0.85, 0.11),
      roughness: 0.26,
      metalness: 0.05,
      clearcoat: 0.86,
      clearcoatRoughness: 0.14,
      iridescence: 0.72,
      iridescenceIOR: 1.65,
      sheen: 0.45,
      sheenColor: new THREE.Color(0x48e8ff),
    });

    // 2) 48-Station Bioluminescent Dorsal Crest-Fin Membrane + Caudal Tail Fluke
    const crestPos = new Float32Array(RING_M * 2 * 3);
    const crestUv = new Float32Array(RING_M * 2 * 2);
    const crestIdx = [];
    for (let i = 0; i < RING_M; i++) {
      crestUv[4 * i] = i / (RING_M - 1); crestUv[4 * i + 1] = 0;
      crestUv[4 * i + 2] = i / (RING_M - 1); crestUv[4 * i + 3] = 1;
      if (i < RING_M - 1) {
        const a = i * 2;
        crestIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.crestGeo = new THREE.BufferGeometry();
    this.crestGeo.setAttribute('position', new THREE.BufferAttribute(crestPos, 3));
    this.crestGeo.setAttribute('uv', new THREE.BufferAttribute(crestUv, 2));
    this.crestGeo.setIndex(crestIdx);
    this.crestMat = new THREE.MeshPhysicalMaterial({
      color: 0x48f5ff,
      emissive: 0x1aa8d8,
      emissiveIntensity: 0.92,
      roughness: 0.18,
      transmission: 0.48,
      transparent: true,
      opacity: 0.82,
      iridescence: 0.95,
      side: THREE.DoubleSide,
    });
    this.crestMesh = new THREE.Mesh(this.crestGeo, this.crestMat);
    this.crestMesh.frustumCulled = false;
    this.cg.add(this.crestMesh);

    const FLUKE_RAYS = 13;
    const fPos = new Float32Array((FLUKE_RAYS + 1) * 3);
    const fIdx = [];
    for (let k = 1; k < FLUKE_RAYS; k++) fIdx.push(0, k, k + 1);
    this.flukeGeo = new THREE.BufferGeometry();
    this.flukeGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
    this.flukeGeo.setIndex(fIdx);
    this.flukeMesh = new THREE.Mesh(this.flukeGeo, this.crestMat);
    this.flukeMesh.frustumCulled = false;
    this.cg.add(this.flukeMesh);

    // 3) Articulated Ventral Cranial Mandible (driven by B.jawOpen during feeding/vocalization)
    const jawGeo = makeTubeGeometry(8, 10);
    {
      const jPts = [[-0.12, 0, -0.02], [-0.08, -0.02, 0.10], [0.0, -0.025, 0.15], [0.08, -0.02, 0.10], [0.12, 0, -0.02]];
      const jRad = [0.022, 0.032, 0.036, 0.032, 0.022];
      writeCatmullTube(jawGeo, 8, 10, jPts, jRad, [0, 1, 0]);
    }
    this.mandibleMesh = new THREE.Mesh(jawGeo, this.appendageMat);
    this.cg.add(this.mandibleMesh);

    // 4) Bilateral Curved Tapered 3D Antennal Rachis Tubes + 10 Pairs of Bioluminescent Gill/Chemotactic Barbules
    this.antennae = [];
    const barbGeo = buildCurvedTalonGeo();
    this.barbuleMat = new THREE.MeshPhysicalMaterial({
      color: 0x62f8ff,
      emissive: 0x1ed8e8,
      emissiveIntensity: 1.15,
      roughness: 0.2,
      transparent: true,
      opacity: 0.88,
    });
    for (let s = 0; s < 2; s++) {
      const aGeo = makeTubeGeometry(ANT_RINGS, ANT_SIDES);
      const aMesh = new THREE.Mesh(aGeo, this.appendageMat);
      aMesh.frustumCulled = false;
      this.cg.add(aMesh);
      const barbs = [];
      for (let b = 0; b < 5; b++) {
        const bm = new THREE.Mesh(barbGeo, this.barbuleMat);
        this.cg.add(bm);
        barbs.push(bm);
      }
      this.antennae.push({
        geo: aGeo,
        mesh: aMesh,
        barbs,
        pts: Array.from({ length: 5 }, () => [0, 0, 0]),
        radii: [0.026, 0.020, 0.015, 0.010, 0.005],
      });
    }

    // 5) 10 Continuous Skinned Muscular Catmull-Rom Limb Tubes + 10 Webbed Autopod Pads + 10x4 Curved Keratin Talons (0L..10L Clades!)
    this.limbTubes = [];
    this.feet = [];
    this.claws = [];
    const footPadGeo = new THREE.SphereGeometry(0.072, 20, 14);
    footPadGeo.scale(1.18, 0.44, 1.38);
    const talonGeo = buildCurvedTalonGeo();
    this.talonMat = new THREE.MeshPhysicalMaterial({
      color: 0xebe4d8,
      emissive: 0x181410,
      roughness: 0.18,
      metalness: 0.12,
      clearcoat: 0.95,
      clearcoatRoughness: 0.08,
    });

    for (let k = 0; k < 10; k++) {
      const lGeo = makeTubeGeometry(LIMB_RINGS, LIMB_SIDES);
      const lMesh = new THREE.Mesh(lGeo, this.appendageMat);
      lMesh.castShadow = true;
      lMesh.frustumCulled = false;
      this.cg.add(lMesh);
      this.limbTubes.push({
        geo: lGeo,
        mesh: lMesh,
        pts: Array.from({ length: 5 }, () => [0, 0, 0]),
        radii: new Float32Array(5),
      });

      const fMat = new THREE.MeshPhysicalMaterial({
        color: 0x2ce8c8,
        emissive: 0x083834,
        roughness: 0.28,
        clearcoat: 0.85,
      });
      const foot = new THREE.Mesh(footPadGeo, fMat);
      foot.castShadow = true;
      this.cg.add(foot);
      this.feet.push(foot);

      const talonSet = [];
      for (let c = 0; c < 4; c++) {
        const tl = new THREE.Mesh(talonGeo, this.talonMat);
        tl.castShadow = true;
        this.cg.add(tl);
        talonSet.push(tl);
      }
      this.claws.push(talonSet);
    }

    // 5b) Bilateral Iridescent Translucent Patagium Gliding Wing-Membranes (stretching forelimb wrist/elbow -> flank segments 4..1)
    this.patagia = [];
    this.patagiumMat = new THREE.MeshPhysicalMaterial({
      color: 0x3ef0d8,
      emissive: 0x127898,
      emissiveIntensity: 0.85,
      roughness: 0.18,
      transmission: 0.58,
      thickness: 0.12,
      ior: 1.38,
      iridescence: 0.95,
      iridescenceIOR: 1.85,
      transparent: true,
      opacity: 0.76,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    for (let side = 0; side < 2; side++) {
      // 6 vertices: 0=seg4 flank, 1=seg3 flank, 2=seg2 flank, 3=forelimb hip, 4=forelimb knee/elbow, 5=forelimb wrist/wingtip
      const pGeo = new THREE.BufferGeometry();
      pGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6 * 3), 3));
      pGeo.setIndex([0, 3, 4, 0, 4, 1, 1, 4, 5, 1, 5, 2]);
      const pMesh = new THREE.Mesh(pGeo, this.patagiumMat);
      pMesh.frustumCulled = false;
      this.cg.add(pMesh);
      this.patagia.push({ geo: pGeo, mesh: pMesh });
    }

    // 5c) Cranial Neural-Crest Bioluminescent Angler-Lure (Illicium Stalk + Refractive Photophore Esca Bulb + Dynamic PointLight)
    const illGeo = makeTubeGeometry(10, 8);
    const illMesh = new THREE.Mesh(illGeo, this.appendageMat);
    illMesh.frustumCulled = false;
    this.cg.add(illMesh);
    this.anglerTube = {
      geo: illGeo,
      mesh: illMesh,
      pts: Array.from({ length: 5 }, () => [0, 0, 0]),
      radii: [0.028, 0.022, 0.017, 0.013, 0.018],
    };
    this.escaMat = new THREE.MeshPhysicalMaterial({
      color: 0x7affea,
      emissive: 0x38f8ff,
      emissiveIntensity: 2.1,
      roughness: 0.06,
      transmission: 0.72,
      ior: 1.46,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.95,
    });
    this.anglerEsca = new THREE.Mesh(new THREE.SphereGeometry(0.056, 20, 16), this.escaMat);
    this.cg.add(this.anglerEsca);
    this.anglerLight = new THREE.PointLight(0x4cf8ff, 1.8, 4.2, 1.6);
    this.cg.add(this.anglerLight);

    // 6) 2 Curved Muscular Eye Peduncle Tubes + Orbital Calyx Cups + 3 Foveal Iris Eyeballs + Wet Refractive Cornea Domes
    this.stalkTubes = [];
    this.eyes = [];
    const calyxGeo = new THREE.CylinderGeometry(0.095, 0.052, 0.068, 20, 1, true);
    calyxGeo.rotateX(Math.PI / 2);
    const irisGeo = new THREE.SphereGeometry(0.086, 32, 24);
    const pupilGeo = new THREE.SphereGeometry(0.048, 24, 18);
    pupilGeo.scale(0.75, 1.08, 0.55); // vertical amphibia/cephalopod slit-oval pupil!
    const corneaGeo = new THREE.SphereGeometry(0.095, 32, 24);

    const irisMat = new THREE.MeshPhysicalMaterial({
      color: 0xffcf58,
      emissive: 0x583204,
      emissiveIntensity: 0.65,
      roughness: 0.16,
      metalness: 0.15,
      iridescence: 0.9,
    });
    const pupilMat = new THREE.MeshStandardMaterial({ color: 0x020308, roughness: 0.04, metalness: 0.1 });
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.03,
      metalness: 0.0,
      transmission: 0.92,
      thickness: 0.22,
      ior: 1.376, // physiological aqueous/corneal refractive index!
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 0.95,
      transparent: true,
      opacity: 0.96,
    });

    for (let s = 0; s < 2; s++) {
      const stGeo = makeTubeGeometry(STALK_RINGS, STALK_SIDES);
      const stMesh = new THREE.Mesh(stGeo, this.appendageMat);
      stMesh.castShadow = true;
      stMesh.frustumCulled = false;
      this.cg.add(stMesh);
      this.stalkTubes.push({
        geo: stGeo,
        mesh: stMesh,
        pts: Array.from({ length: 4 }, () => [0, 0, 0]),
        radii: [0.068, 0.052, 0.046, 0.062],
      });
    }

    for (let i = 0; i < 3; i++) {
      const eg = new THREE.Group();
      const sc = i === 2 ? 0.62 : 1.0; // i=2 is dorsal pineal/median ocellus
      const calyx = new THREE.Mesh(calyxGeo, this.appendageMat);
      calyx.position.z = -0.025;
      const iris = new THREE.Mesh(irisGeo, irisMat);
      const pupil = new THREE.Mesh(pupilGeo, pupilMat);
      pupil.position.z = 0.064;
      const cornea = new THREE.Mesh(corneaGeo, corneaMat);
      cornea.position.z = 0.008;
      eg.add(calyx, iris, pupil, cornea);
      eg.scale.setScalar(sc);
      this.cg.add(eg);
      this.eyes.push({ grp: eg, pupil });
    }

    // 7) Internal Translucent Bioluminescent Viscera (Heart, Dual Lungs, Liver, Adipose, Bladder, Colon & 10 Peristaltic Gut Boluses)
    const organMat = (col, emi, op = 0.62) => new THREE.MeshPhysicalMaterial({
      color: col,
      emissive: emi,
      emissiveIntensity: 0.85,
      roughness: 0.25,
      transmission: 0.45,
      transparent: true,
      opacity: op,
    });
    this.heartMat = organMat(0xff2e68, 0xc81048, 0.78);
    this.heart = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), this.heartMat);
    this.cg.add(this.heart);

    this.lungMat = organMat(0x52d8ff, 0x146898, 0.52);
    this.lungs = [0, 1].map(() => {
      const lg = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 14), this.lungMat);
      lg.scale.set(1.35, 0.82, 0.78);
      this.cg.add(lg);
      return lg;
    });
    this.liver = new THREE.Mesh(new THREE.SphereGeometry(0.095, 16, 12), organMat(0xb84830, 0x481408, 0.58));
    this.bladderMesh = new THREE.Mesh(new THREE.SphereGeometry(0.068, 14, 12), organMat(0xf5d848, 0x685208, 0.56));
    this.colonMesh = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 12), organMat(0x886238, 0x301e0c, 0.56));
    this.cg.add(this.liver, this.bladderMesh, this.colonMesh);

    const bolusGeo = new THREE.SphereGeometry(0.038, 12, 10);
    const bolusMat = organMat(0x48ff9a, 0x129852, 0.65);
    this.boluses = Array.from({ length: 10 }, () => {
      const bm = new THREE.Mesh(bolusGeo, bolusMat);
      this.cg.add(bm);
      return bm;
    });

    // 8) 12,000-Neuron Stratified 3D Spiking Brain Cloud (works smoothly from S=436 up to GIGA=14,156,048!)
    const BRAIN_VIS = Math.min(NNEU, 12000);
    this.brainVisN = BRAIN_VIS;
    this.brainIdx = new Uint32Array(BRAIN_VIS);
    this.brainLocal = new Float32Array(BRAIN_VIS * 3);
    this.brainBaseCol = new Float32Array(BRAIN_VIS * 3);
    this.brainGlow = new Float32Array(BRAIN_VIS);
    const bPos = new Float32Array(BRAIN_VIS * 3);
    const bCol = new Float32Array(BRAIN_VIS * 3);
    const tmpCol = new THREE.Color();

    for (let v = 0; v < BRAIN_VIS; v++) {
      const ni = Math.min(NNEU - 1, Math.floor((v / BRAIN_VIS) * NNEU));
      this.brainIdx[v] = ni;
      let rIdx = 0;
      for (let k = 0; k < REGIONS.length; k++) {
        const [, a, nR] = REGIONS[k];
        if (ni >= a && ni < a + nR) { rIdx = k; break; }
      }
      tmpCol.setHSL(rIdx / REGIONS.length, 0.92, 0.56);
      this.brainBaseCol[3 * v] = tmpCol.r;
      this.brainBaseCol[3 * v + 1] = tmpCol.g;
      this.brainBaseCol[3 * v + 2] = tmpCol.b;

      // Anatomical bilobed cerebral hemisphere layout inside cranial segments 5..6
      const u = ((v * 0.6180339887) % 1) * 2 - 1;
      const th = v * 2.39996323;
      const rad = Math.cbrt(((v * 0.75487766) % 1)) * 0.16;
      const lobe = (v & 1) ? 0.055 : -0.055;
      const rr = Math.sqrt(Math.max(0, 1 - u * u));
      this.brainLocal[3 * v] = u * rad * 1.25;
      this.brainLocal[3 * v + 1] = Math.sin(th) * rr * rad * 0.82 + 0.02;
      this.brainLocal[3 * v + 2] = Math.cos(th) * rr * rad * 0.85 + lobe;
    }
    const brainGeo = new THREE.BufferGeometry();
    brainGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    brainGeo.setAttribute('color', new THREE.BufferAttribute(bCol, 3));
    this.brainSpriteMat = makeSoftSpriteMaterial(0.036, 0.82, true);
    this.brainPts = new THREE.Points(brainGeo, this.brainSpriteMat);
    this.brainPts.frustumCulled = false;
    this.cg.add(this.brainPts);

    // 9) 512 Soft-Glow 3D WCSPH + D3Q19 Lattice-Boltzmann Vascular Blood Corpuscles
    const nBlood = this.cr.fluid.px.length;
    const blGeo = new THREE.BufferGeometry();
    blGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nBlood * 3), 3));
    blGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nBlood * 3), 3));
    this.bloodSpriteMat = makeSoftSpriteMaterial(0.048, 0.82, true);
    this.bloodPts = new THREE.Points(blGeo, this.bloodSpriteMat);
    this.bloodPts.frustumCulled = false;
    this.cg.add(this.bloodPts);
  }

  // ------------------------------------------------------------------ Atmospheric Rain Streaks & Floating Bioluminescent Spore Motes
  buildWeather() {
    const S = this.scene;
    const maxRain = 1800;
    const rPos = new Float32Array(maxRain * 6);
    this._rainSeeds = new Float32Array(maxRain * 3);
    for (let i = 0; i < maxRain; i++) {
      this._rainSeeds[3 * i] = (Math.random() - 0.5) * 38;
      this._rainSeeds[3 * i + 1] = Math.random() * 18;
      this._rainSeeds[3 * i + 2] = (Math.random() - 0.5) * 38;
    }
    const rGeo = new THREE.BufferGeometry();
    rGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
    this.rainLines = new THREE.LineSegments(
      rGeo,
      new THREE.LineBasicMaterial({ color: 0x7cd8ff, transparent: true, opacity: 0 })
    );
    this.rainLines.frustumCulled = false;
    S.add(this.rainLines);

    // 260 Soft Floating Bioluminescent Pollen / Spore Motes
    this.sporeN = 260;
    const spPos = new Float32Array(this.sporeN * 3);
    const spCol = new Float32Array(this.sporeN * 3);
    this._sporeSeeds = new Float32Array(this.sporeN * 4);
    const cTmp = new THREE.Color();
    for (let i = 0; i < this.sporeN; i++) {
      this._sporeSeeds[4 * i] = (Math.random() - 0.5) * 36;
      this._sporeSeeds[4 * i + 1] = 0.25 + Math.random() * 4.2;
      this._sporeSeeds[4 * i + 2] = (Math.random() - 0.5) * 36;
      this._sporeSeeds[4 * i + 3] = Math.random() * Math.PI * 2;
      cTmp.setHSL(0.42 + 0.35 * Math.random(), 0.92, 0.65);
      spCol[3 * i] = cTmp.r; spCol[3 * i + 1] = cTmp.g; spCol[3 * i + 2] = cTmp.b;
    }
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    spGeo.setAttribute('color', new THREE.BufferAttribute(spCol, 3));
    this.sporeSpriteMat = makeSoftSpriteMaterial(0.068, 0.58, true);
    this.sporePts = new THREE.Points(spGeo, this.sporeSpriteMat);
    this.sporePts.frustumCulled = false;
    S.add(this.sporePts);
  }

  // ------------------------------------------------------------------ Per-Frame 60 FPS Live Simulation Readout & Render
  update(dtReal = 1 / 60) {
    const cr = this.cr, W = cr.world, B = cr.body;
    const dt = Math.min(0.05, Math.max(0.001, dtReal));
    this.clock += dt;
    const t = this.clock;

    // 1) Circadian Sky, Cinema Lighting Presets (auto / twilight / pandora / day), Dynamic PMREM HDR Sky IBL & God-Ray Projection
    let day = cr.light ?? 1;
    let sunAz = 0.8 + ((cr.hour ?? 12) / 24) * Math.PI * 2;
    let sunEl = 0.14 + 0.92 * day;
    if (this.lightingMode === 'twilight') {
      day = 0.34;
      sunAz = 0.62 + 0.04 * Math.sin(t * 0.08);
      sunEl = 0.22;
    } else if (this.lightingMode === 'pandora') {
      day = 0.06;
      sunAz = 2.4 + 0.05 * Math.sin(t * 0.06);
      sunEl = 0.12;
    } else if (this.lightingMode === 'day') {
      day = 0.96;
      sunAz = 1.05;
      sunEl = 0.92;
    }
    const sdx = Math.cos(sunAz) * Math.cos(sunEl);
    const sdy = Math.sin(sunEl);
    const sdz = Math.sin(sunAz) * Math.cos(sunEl);

    this.skyU.day.value = day;
    this.skyU.t.value = t;
    this.skyU.sunDir.value.set(sdx, sdy, sdz).normalize();
    this.skyU.season.value = W.seasonPhase ?? 0;
    if (this.mushroomCapMat) {
      this.mushroomCapMat.emissiveIntensity = 0.65 + 1.45 * (1 - day);
    }

    if (Math.abs(day - this._lastEnvDay) > 0.14) {
      this.bakeSkyEnvironment(day);
    }

    const com = B.com();
    this.sun.position.set(com[0] + sdx * 22, com[1] + Math.max(5, sdy * 24), com[2] + sdz * 22);
    this.sun.target.position.set(com[0], com[1], com[2]);
    this.sun.intensity = 0.55 + 2.35 * day;
    this.sun.color.setHSL(0.08 + 0.04 * day, 0.55 - 0.30 * day, 0.68 + 0.24 * day);
    this.hemi.intensity = 0.52 + 0.65 * day;
    this.rim.position.set(com[0] - sdx * 2.6, com[1] + 1.85, com[2] - sdz * 2.6);
    this.rim.intensity = 2.8 + 2.6 * (1 - day);
    this.scene.fog.color.setHSL(0.61, 0.48, 0.03 + 0.09 * day);

    // Project solar world direction to screen UV for ContactAOScatterShader crepuscular sunbeams
    this._tmpV1.set(com[0] + sdx * 120, com[1] + sdy * 120, com[2] + sdz * 120).project(this.camera);
    this.aoPass.uniforms.uSunScreen.value.set(this._tmpV1.x * 0.5 + 0.5, this._tmpV1.y * 0.5 + 0.5);
    this.aoPass.uniforms.uGodRay.value = (this.reduced ? 0 : 0.22) * Math.max(0, day - 0.15) * (this._tmpV1.z < 1 ? 1 : 0);

    // 2) Terrain, Grass, Water Pools, Hydrothermal Plumes & Fruiting Flora
    if (W.morph !== this._lastMorph || W.season !== this._lastSeason) {
      this._lastMorph = W.morph;
      this._lastSeason = W.season;
      this.updateTerrain();
    }
    const rainAmt = W.rain ?? 0;
    this.terrainU.uT.value = t;
    this.terrainU.uRain.value = rainAmt;
    if (this.p5Layer?.bioTex) {
      this.terrainU.uBioTex.value = this.p5Layer.bioTex;
      this.terrainU.uHasBio.value = 1.0;
    }

    this.grassU.uTime.value = t;
    this.grassU.uWind.value.set(W.windX ?? 0.35, W.windZ ?? 0.2);
    this.grassU.uNightGlow.value = 1.0 - 0.72 * day;

    this.poolU.t.value = t;
    this.poolU.uSunDir.value.copy(this.skyU.sunDir.value);
    this.poolU.uDay.value = day;
    this.poolU.uPlankton.value = W.planktonBloom ?? 0.65;

    this.syncProps();

    // Update fruiting canopy flora & navigation target halo
    const goalSite = cr.nav?.goal?.type === 'site' ? cr.nav.goal.k : -1;
    for (let i = 0; i < W.plants.length; i++) {
      const P = W.plants[i], pm = this.plantMeshes[i];
      if (!pm) continue;
      pm.g.position.set(P.x, P.y, P.z);
      const cScale = P.crownScale ?? 1.0;
      pm.crown.scale.setScalar(cScale);
      pm.crown.rotation.y = Math.sin(t * 1.1 + i) * 0.08;
      const fScale = Math.max(0.001, P.fruit);
      pm.fruit.visible = P.fruit > 0.03;
      pm.fruit.scale.setScalar(0.35 + 0.65 * fScale);
      pm.fruit.position.y = 0.26 + 0.04 * Math.sin(t * 2.2 + i);
      pm.fm.emissiveIntensity = (0.45 + 1.15 * P.fruit) * (1.15 - 0.35 * day);
      pm.ring.material.opacity = i === goalSite ? 0.55 + 0.3 * Math.sin(t * 5.0) : 0;
    }

    // Sync dropped user snacks & metabolic waste boluses
    const snacks = W.snacks || [];
    const liveIds = new Set();
    for (let i = 0; i < snacks.length; i++) {
      const sn = snacks[i];
      const key = sn.id ?? i;
      liveIds.add(key);
      let m = this.snackMeshes.get(key);
      if (!m) {
        m = new THREE.Mesh(
          this.snackGeo,
          new THREE.MeshPhysicalMaterial({ color: 0xffb838, emissive: 0xd86808, emissiveIntensity: 1.2, roughness: 0.2, clearcoat: 0.9 })
        );
        this.props.add(m);
        this.snackMeshes.set(key, m);
      }
      m.position.set(sn.x, sn.y ?? W.height(sn.x, sn.z) + 0.16, sn.z);
      m.rotation.y = t * 1.8;
    }
    for (const [k, m] of this.snackMeshes) {
      if (!liveIds.has(k)) {
        this.props.remove(m);
        this.snackMeshes.delete(k);
      }
    }

    const wastes = W.wastes || [];
    while (this.wasteMeshes.length < wastes.length) {
      const wm = new THREE.Mesh(
        this.wasteGeo,
        new THREE.MeshStandardMaterial({ color: 0x5c4828, emissive: 0x1c2810, roughness: 0.78 })
      );
      this.props.add(wm);
      this.wasteMeshes.push(wm);
    }
    for (let i = 0; i < this.wasteMeshes.length; i++) {
      const wm = this.wasteMeshes[i];
      if (i >= wastes.length) { wm.visible = false; continue; }
      const ws = wastes[i];
      wm.visible = true;
      wm.position.set(ws.x, W.height(ws.x, ws.z) + 0.08, ws.z);
      wm.scale.setScalar(Math.max(0.25, ws.amt ?? 0.6));
    }

    // Hydrothermal vent volumetric plume advection
    const vents = W.vents || [];
    if (vents.length > 0) {
      this.ventPlumes.visible = true;
      const vp = this.ventPlumes.geometry.attributes.position.array;
      for (let i = 0; i < this.ventPlumeN; i++) {
        let lf = (this._ventLife[i] + dt * (0.28 + (i % 5) * 0.05)) % 1;
        this._ventLife[i] = lf;
        const v = vents[i % vents.length];
        const swirl = t * 2.2 + i * 1.7 + lf * 5.0;
        const spread = 0.16 + lf * 0.85;
        vp[3 * i] = v.x + Math.cos(swirl) * spread + (W.windX ?? 0) * lf * 1.1;
        vp[3 * i + 1] = v.y + 0.78 + lf * 3.6;
        vp[3 * i + 2] = v.z + Math.sin(swirl) * spread + (W.windZ ?? 0) * lf * 1.1;
      }
      this.ventPlumes.geometry.attributes.position.needsUpdate = true;
    } else {
      this.ventPlumes.visible = false;
    }

    // 3) Sync Layer-1 Geodesic Dome & Multi-Agent Biosphere
    this.syncDome(t, day);
    this.syncEcosystem(t);

    // 4) Sync Focal Creature 96x48 Organic Dermal Tube + Crest + Fluke + Mandible + Curved Antennae + 4/6/8 Limbs + Wet Eyes
    this.skinTex.needsUpdate = true;
    this.skinU.t.value = t;
    this.skinU.glitch.value = Math.max(0, this.skinU.glitch.value - dt * 2.6);
    this.skinU.sleep.value = cr.sleep?.asleep ? 1.0 : 0.0;
    this.skinU.camo.value = cr.camoLevel ?? 0;
    this.skinU.uHue.value = cr.gen.pigmentHue ?? 0.72;
    this.skinU.uOsteo.value = B.hox?.osteoderm ?? 0.5;
    if (this.p5Layer?.dermalTex) {
      this.skinU.uDermalTex.value = this.p5Layer.dermalTex;
      this.skinU.uHasDermal.value = 1.0;
    }
    this.appendageMat.color.setHSL(cr.gen.pigmentHue ?? 0.72, 0.68 - 0.32 * (cr.camoLevel ?? 0), 0.32);
    this.appendageMat.emissive.setHSL(((cr.gen.pigmentHue ?? 0.72) + 0.10) % 1, 0.85, 0.09 + 0.10 * (cr.vocalAmp ?? 0));

    // Interpolate 7 soft-body segments smoothly onto RING_M=48 stations x RING_S=96 circumferential vertices
    const X = B.x, Y = B.y, Z = B.z, F = B.F;
    const sPos = this.skinGeo.attributes.position.array;
    const cPos = this.crestGeo.attributes.position.array;
    const crestAmp = 0.24 * (cr.gen.crestFin ?? 1.0);
    const breath = 1.0 + 0.035 * Math.sin(t * 2.8);

    // Extract 7 spine core positions + 8 octagonal dermal ring offsets per segment
    const segC = [], segUp = [], segSide = [], segFwd = [], segR8 = [];
    for (let s = 0; s < NS; s++) {
      const ci = B.c[s], fr = F[s];
      const cx = X[ci], cy = Y[ci], cz = Z[ci];
      segC.push([cx, cy, cz]);
      segUp.push(fr.u);
      segSide.push(fr.s);
      segFwd.push(fr.f);
      const R = B.ring[s], D = B.ringDiag[s];
      const oct = [R[0], D[0], R[1], D[1], R[2], D[2], R[3], D[3]];
      const rads = new Float32Array(8);
      for (let k = 0; k < 8; k++) {
        const pi = oct[k];
        rads[k] = Math.hypot(X[pi] - cx, Y[pi] - cy, Z[pi] - cz);
      }
      segR8.push(rads);
    }

    const catmull1D = (v0, v1, v2, v3, tt) =>
      0.5 * (2 * v1 + (-v0 + v2) * tt + (2 * v0 - 5 * v1 + 4 * v2 - v3) * tt * tt + (-v0 + 3 * v1 - 3 * v2 + v3) * tt * tt * tt);
    const getClamped = (arr, idx) => arr[Math.max(0, Math.min(NS - 1, idx))];

    for (let m = 0; m < RING_M; m++) {
      const u = m / (RING_M - 1);
      // Extend smoothly past tail (s=0) and snout (s=NS-1) for sleek rounded amphibian/dragon rostrum & tail caps
      const f = -0.34 + u * ((NS - 1) + 0.72);
      const i = Math.max(0, Math.min(NS - 2, Math.floor(f)));
      const tt = Math.max(0, Math.min(1, f - i));
      const p0 = getClamped(segC, i - 1), p1 = getClamped(segC, i), p2 = getClamped(segC, i + 1), p3 = getClamped(segC, i + 2);
      const u1 = getClamped(segUp, i), u2 = getClamped(segUp, i + 1);
      const s1 = getClamped(segSide, i), s2 = getClamped(segSide, i + 1);
      const fw1 = getClamped(segFwd, i), fw2 = getClamped(segFwd, i + 1);

      let cx = catmull1D(p0[0], p1[0], p2[0], p3[0], tt);
      let cy = catmull1D(p0[1], p1[1], p2[1], p3[1], tt);
      let cz = catmull1D(p0[2], p1[2], p2[2], p3[2], tt);

      // Smooth snout & tail-tip axial extension + organic elliptical dome taper
      let capScale = 1.0;
      if (f < 0) {
        const ef = Math.min(1, -f / 0.34);
        const reach = Math.sin(ef * Math.PI * 0.5) * 0.28;
        cx -= fw1[0] * reach; cy -= fw1[1] * reach; cz -= fw1[2] * reach;
        capScale = Math.max(0.02, Math.cos(ef * Math.PI * 0.492));
      } else if (f > NS - 1) {
        const ef = Math.min(1, (f - (NS - 1)) / 0.38);
        const reach = Math.sin(ef * Math.PI * 0.5) * 0.35;
        const snoutTuck = ef * ef * 0.055;
        cx += fw2[0] * reach - u2[0] * snoutTuck;
        cy += fw2[1] * reach - u2[1] * snoutTuck;
        cz += fw2[2] * reach - u2[2] * snoutTuck;
        capScale = Math.max(0.02, Math.cos(ef * Math.PI * 0.492));
      }

      let ux = u1[0] * (1 - tt) + u2[0] * tt, uy = u1[1] * (1 - tt) + u2[1] * tt, uz = u1[2] * (1 - tt) + u2[2] * tt;
      let un = Math.hypot(ux, uy, uz) || 1; ux /= un; uy /= un; uz /= un;
      let sx = s1[0] * (1 - tt) + s2[0] * tt, sy = s1[1] * (1 - tt) + s2[1] * tt, sz = s1[2] * (1 - tt) + s2[2] * tt;
      let sn = Math.hypot(sx, sy, sz) || 1; sx /= sn; sy /= sn; sz /= sn;

      const rA = getClamped(segR8, i), rB = getClamped(segR8, i + 1);
      const chestBreath = (u > 0.45 && u < 0.82) ? breath : 1.0;

      let dorsalR = 0;
      for (let j = 0; j <= RING_S; j++) {
        const ang = (j / RING_S) * Math.PI * 2; // 0 = dorsal (+u), pi/2 = -side, pi = ventral (-u)
        const octF = ((j / RING_S) * 8) % 8;
        const oi0 = Math.floor(octF) & 7, oi1 = (oi0 + 1) & 7;
        const ofrac = octF - Math.floor(octF);
        const rad0 = rA[oi0] * (1 - ofrac) + rA[oi1] * ofrac;
        const rad1 = rB[oi0] * (1 - ofrac) + rB[oi1] * ofrac;
        // Subtle organic dorsoventral muscular flute sculpting
        const muscleFlute = 1.0 + 0.045 * Math.cos(ang * 2.0) + 0.022 * Math.cos(ang * 6.0);
        const rad = (rad0 * (1 - tt) + rad1 * tt) * capScale * chestBreath * muscleFlute;
        if (j === 0) dorsalR = rad;

        const ca = Math.cos(ang), sa = -Math.sin(ang);
        const nx = ca * ux + sa * sx;
        const ny = ca * uy + sa * sy;
        const nz = ca * uz + sa * sz;
        const vo = 3 * (m * (RING_S + 1) + j);
        sPos[vo] = cx + nx * rad;
        sPos[vo + 1] = cy + ny * rad;
        sPos[vo + 2] = cz + nz * rad;
      }

      // Dorsal bioluminescent crest-fin ribbon along spine top
      const finEnv = Math.sin(Math.pow(u, 0.85) * Math.PI) * (0.72 + 0.28 * Math.sin(u * 18.0 - t * 3.8));
      const finRipple = Math.sin(t * 4.2 - u * 9.0) * 0.035 * crestAmp;
      cPos[6 * m] = cx + ux * (dorsalR * 0.92);
      cPos[6 * m + 1] = cy + uy * (dorsalR * 0.92);
      cPos[6 * m + 2] = cz + uz * (dorsalR * 0.92);
      cPos[6 * m + 3] = cx + ux * (dorsalR * 0.92 + crestAmp * finEnv) + sx * finRipple;
      cPos[6 * m + 4] = cy + uy * (dorsalR * 0.92 + crestAmp * finEnv) + sy * finRipple;
      cPos[6 * m + 5] = cz + uz * (dorsalR * 0.92 + crestAmp * finEnv) + sz * finRipple;
    }
    this.skinGeo.attributes.position.needsUpdate = true;
    this.skinGeo.computeVertexNormals();
    this.crestGeo.attributes.position.needsUpdate = true;
    this.crestGeo.computeVertexNormals();

    // Caudal Tail Fluke Fan at segment 0
    {
      const f0 = F[0], tc = segC[0];
      const flukeSpan = 0.34 * (cr.gen.tailFluke ?? 1.0);
      const fp = this.flukeGeo.attributes.position.array;
      fp[0] = tc[0] - f0.f[0] * 0.08;
      fp[1] = tc[1] - f0.f[1] * 0.08;
      fp[2] = tc[2] - f0.f[2] * 0.08;
      for (let k = 0; k < 13; k++) {
        const a = ((k / 12) - 0.5) * 1.95;
        const len = flukeSpan * (0.68 + 0.32 * Math.cos(a * 2.2));
        const wave = Math.sin(t * 4.5 + a * 2.5) * 0.035;
        const dx = -f0.f[0] * Math.cos(a) * len + f0.s[0] * Math.sin(a) * len + f0.u[0] * wave;
        const dy = -f0.f[1] * Math.cos(a) * len + f0.s[1] * Math.sin(a) * len + f0.u[1] * wave;
        const dz = -f0.f[2] * Math.cos(a) * len + f0.s[2] * Math.sin(a) * len + f0.u[2] * wave;
        fp[3 * (k + 1)] = fp[0] + dx;
        fp[3 * (k + 1) + 1] = fp[1] + dy;
        fp[3 * (k + 1) + 2] = fp[2] + dz;
      }
      this.flukeGeo.attributes.position.needsUpdate = true;
      this.flukeGeo.computeVertexNormals();
    }

    // Head Frame, Articulated Cranial Mandible & Curved 3D Antennae + Gill Barbules
    const fh = F[NS - 1], hc = segC[NS - 1];
    const headR = B.segRad[NS - 1];
    const jawAng = 0.08 + 0.55 * (B.jawOpen ?? 0) + 0.22 * (cr.vocalAmp ?? 0) * (0.5 + 0.5 * Math.sin(t * 24.0));
    this.mandibleMesh.position.set(
      hc[0] + fh.f[0] * (headR * 0.52) - fh.u[0] * (headR * 0.55),
      hc[1] + fh.f[1] * (headR * 0.52) - fh.u[1] * (headR * 0.55),
      hc[2] + fh.f[2] * (headR * 0.52) - fh.u[2] * (headR * 0.55)
    );
    this._tmpV1.set(
      this.mandibleMesh.position.x + fh.f[0] - fh.u[0] * Math.sin(jawAng),
      this.mandibleMesh.position.y + fh.f[1] - fh.u[1] * Math.sin(jawAng),
      this.mandibleMesh.position.z + fh.f[2] - fh.u[2] * Math.sin(jawAng)
    );
    this.mandibleMesh.up.set(fh.u[0], fh.u[1], fh.u[2]);
    this.mandibleMesh.lookAt(this._tmpV1);

    const antLen = 0.52 * (cr.gen.antennaLen ?? 1.0);
    const gillSpan = B.hox?.gillFronds ?? 1.0;
    const chemGlow = Math.min(1, (cr.pherFood ?? 0) + (cr.pherAlarm ?? 0) + (cr.pherMate ?? 0));
    this.barbuleMat.emissiveIntensity = 0.85 + 1.45 * chemGlow;
    for (let s = 0; s < 2; s++) {
      const sgn = s === 0 ? -1 : 1;
      const ant = this.antennae[s];
      for (let k = 0; k < 5; k++) {
        const u = k / 4;
        const twitch = Math.sin(t * 6.5 + s * 2.1 - u * 2.8) * 0.055 * u * (1 + chemGlow);
        const flare = sgn * (headR * 0.45 + u * antLen * 0.55 + twitch);
        const lift = headR * 0.58 + Math.sin(u * Math.PI * 0.72) * antLen * 0.58;
        const fwd = headR * 0.55 + u * antLen * 0.72 - u * u * 0.14;
        ant.pts[k][0] = hc[0] + fh.f[0] * fwd + fh.u[0] * lift + fh.s[0] * flare;
        ant.pts[k][1] = hc[1] + fh.f[1] * fwd + fh.u[1] * lift + fh.s[1] * flare;
        ant.pts[k][2] = hc[2] + fh.f[2] * fwd + fh.u[2] * lift + fh.s[2] * flare;

        const bm = ant.barbs[k];
        bm.position.set(ant.pts[k][0], ant.pts[k][1], ant.pts[k][2]);
        bm.scale.setScalar((1.05 - 0.55 * u) * gillSpan * 0.85);
        this._tmpV1.set(
          ant.pts[k][0] + fh.s[0] * sgn * 0.5 + fh.u[0] * 0.35,
          ant.pts[k][1] + fh.s[1] * sgn * 0.5 + fh.u[1] * 0.35,
          ant.pts[k][2] + fh.s[2] * sgn * 0.5 + fh.u[2] * 0.35
        );
        bm.lookAt(this._tmpV1);
      }
      writeCatmullTube(ant.geo, ANT_RINGS, ANT_SIDES, ant.pts, ant.radii, fh.u);
    }

    // 5) 10 Muscular Catmull-Rom Limbs + Webbed Autopod Pads + 4 Curved Keratin Talons (0L / 4L / 6L / 8L / 10L Clades!)
    for (let k = 0; k < 10; k++) {
      const Lb = B.limbs[k];
      const showLimb = !!(Lb && !Lb.vestigial);
      const lt = this.limbTubes[k];
      const foot = this.feet[k];
      const clawSet = this.claws[k];
      lt.mesh.visible = showLimb;
      foot.visible = showLimb;
      for (let c = 0; c < 4; c++) clawSet[c].visible = showLimb;
      if (!showLimb) continue;

      const sc = segC[Lb.s], fs = F[Lb.s];
      const hx = X[Lb.hip], hy = Y[Lb.hip], hz = Z[Lb.hip];
      const kx = X[Lb.knee], ky = Y[Lb.knee], kz = Z[Lb.knee];
      const fx = X[Lb.foot], fy = Y[Lb.foot], fz = Z[Lb.foot];

      // Deep shoulder/hip girdle root inside trunk -> hip -> biceps/femur belly -> knee -> forearm/crus -> autopod
      const xb = B.crossBridge ? (B.crossBridge[k % B.crossBridge.length] ?? 0.25) : 0.25;
      const limbInt = cr.heptarch ? (cr.heptarch.limbIntegrity[k % 10] ?? 1.0) : 1.0;
      const girthM = (cr.gen.bodyGirth ?? 1.0) * (1.0 + 0.22 * xb) * (0.52 + 0.48 * limbInt);
      lt.pts[0][0] = sc[0] * 0.42 + hx * 0.58;
      lt.pts[0][1] = sc[1] * 0.42 + hy * 0.58;
      lt.pts[0][2] = sc[2] * 0.42 + hz * 0.58;

      lt.pts[1][0] = (hx + kx) * 0.5 + fs.u[0] * 0.035;
      lt.pts[1][1] = (hy + ky) * 0.5 + fs.u[1] * 0.035;
      lt.pts[1][2] = (hz + kz) * 0.5 + fs.u[2] * 0.035;

      lt.pts[2][0] = kx; lt.pts[2][1] = ky; lt.pts[2][2] = kz;

      lt.pts[3][0] = kx * 0.42 + fx * 0.58;
      lt.pts[3][1] = ky * 0.42 + fy * 0.58;
      lt.pts[3][2] = kz * 0.42 + fz * 0.58;

      lt.pts[4][0] = fx; lt.pts[4][1] = fy; lt.pts[4][2] = fz;

      lt.radii[0] = 0.088 * girthM;
      lt.radii[1] = 0.078 * girthM; // bulging proximal stylopod muscle belly
      lt.radii[2] = 0.052 * girthM; // anatomical knee/elbow joint taper
      lt.radii[3] = 0.056 * girthM; // zeugopod gastrocnemius/forearm belly
      lt.radii[4] = 0.038 * girthM; // wrist/ankle

      writeCatmullTube(lt.geo, LIMB_RINGS, LIMB_SIDES, lt.pts, lt.radii, fs.u);

      // Orient webbed foot pad & 4 curved talons along distal limb + forward ground tangent
      let dx = fx - kx, dy = fy - ky, dz = fz - kz;
      let dn = Math.hypot(dx, dy, dz) || 1; dx /= dn; dy /= dn; dz /= dn;
      const tx = fs.f[0] * 0.65 + dx * 0.35;
      const ty = Math.max(-0.25, fs.f[1] * 0.5 + dy * 0.2);
      const tz = fs.f[2] * 0.65 + dz * 0.35;

      const grip = B.gripP[Lb.foot] ?? 0;
      foot.position.set(fx, fy - 0.012, fz);
      foot.material.emissiveIntensity = 0.35 + 1.15 * grip;
      this._tmpV1.set(fx + tx, fy + ty, fz + tz);
      foot.up.set(0, 1, 0);
      foot.lookAt(this._tmpV1);

      const sgnLat = Lb.side === 1 ? -1 : 1;
      for (let c = 0; c < 4; c++) {
        const sp = (c - 1.5) * 0.32;
        const tl = clawSet[c];
        const cxOff = tx * 0.05 + fs.s[0] * sp * 0.09;
        const czOff = tz * 0.05 + fs.s[2] * sp * 0.09;
        tl.position.set(fx + cxOff, fy - 0.012, fz + czOff);
        this._tmpV1.set(
          tl.position.x + tx + fs.s[0] * (sp * 0.38 + sgnLat * 0.08),
          tl.position.y - 0.12 - 0.22 * grip,
          tl.position.z + tz + fs.s[2] * (sp * 0.38 + sgnLat * 0.08)
        );
        tl.up.set(0, 1, 0);
        tl.lookAt(this._tmpV1);
      }
    }

    // 5b) Bilateral Patagium Gliding Wing-Membranes (active when patagium > 0.12 & forelimbs non-vestigial, or lateral fin fold on 0L)
    const patSpan = B.hox?.patagium ?? 0.18;
    const glideGlow = Math.min(1, (B.glideLift ?? 0) * 2.5);
    this.patagiumMat.color.setHSL(((cr.gen.pigmentHue ?? 0.72) + 0.08) % 1, 0.88, 0.52);
    this.patagiumMat.emissive.setHSL(((cr.gen.pigmentHue ?? 0.72) + 0.14) % 1, 0.95, 0.22 + 0.38 * glideGlow);
    for (let side = 0; side < 2; side++) {
      const pat = this.patagia[side];
      const foreLb = B.limbs[2 + side];
      const showPat = patSpan > 0.16 && !!(foreLb && !foreLb.vestigial);
      pat.mesh.visible = showPat;
      if (!showPat) continue;
      const sgn = side === 0 ? -1 : 1;
      const pArr = pat.geo.attributes.position.array;
      const setV = (vi, vx, vy, vz) => { pArr[3 * vi] = vx; pArr[3 * vi + 1] = vy; pArr[3 * vi + 2] = vz; };
      for (let si = 0; si < 3; si++) {
        const segIdx = 4 - si;
        const sc = segC[segIdx], fs = F[segIdx], rS = B.segRad[segIdx] * 0.82;
        setV(si, sc[0] + fs.s[0] * sgn * rS, sc[1] + fs.s[1] * sgn * rS, sc[2] + fs.s[2] * sgn * rS);
      }
      const hx = X[foreLb.hip], hy = Y[foreLb.hip], hz = Z[foreLb.hip];
      const kx = X[foreLb.knee], ky = Y[foreLb.knee], kz = Z[foreLb.knee];
      const fx = X[foreLb.foot], fy = Y[foreLb.foot], fz = Z[foreLb.foot];
      const spanScale = Math.min(1.45, 0.55 + 0.65 * patSpan);
      const wx = hx + (fx - hx) * spanScale + F[4].u[0] * 0.05 * patSpan;
      const wy = hy + (fy - hy) * 0.55 + 0.06 * patSpan;
      const wz = hz + (fz - hz) * spanScale + F[4].u[2] * 0.05 * patSpan;
      setV(3, hx, hy, hz);
      setV(4, kx, ky + 0.02, kz);
      setV(5, wx, wy, wz);
      pat.geo.attributes.position.needsUpdate = true;
      pat.geo.computeVertexNormals();
    }

    // 5c) Cranial Bioluminescent Angler-Lure (Illicium Stalk + Glowing Esca Bulb + Dynamic PointLight)
    const lureSpan = B.hox?.anglerLure ?? 0.24;
    if (lureSpan > 0.08) {
      this.anglerTube.mesh.visible = true;
      this.anglerEsca.visible = true;
      this.anglerLight.visible = true;
      const L = 0.24 + 0.42 * lureSpan;
      const sway = Math.sin(t * 3.4) * 0.06 * (1 + lureSpan * 0.5);
      for (let k = 0; k < 5; k++) {
        const u = k / 4;
        const fwd = headR * 0.32 + Math.pow(u, 0.85) * L * 0.92;
        const lift = headR * 0.85 + Math.sin(u * Math.PI * 0.78) * L * 0.68 - u * u * L * 0.26;
        const lat = sway * u * u;
        this.anglerTube.pts[k][0] = hc[0] + fh.f[0] * fwd + fh.u[0] * lift + fh.s[0] * lat;
        this.anglerTube.pts[k][1] = hc[1] + fh.f[1] * fwd + fh.u[1] * lift + fh.s[1] * lat;
        this.anglerTube.pts[k][2] = hc[2] + fh.f[2] * fwd + fh.u[2] * lift + fh.s[2] * lat;
      }
      writeCatmullTube(this.anglerTube.geo, 10, 8, this.anglerTube.pts, this.anglerTube.radii, fh.u);
      const tip = this.anglerTube.pts[4];
      const emitScale = cr.lesion?.heptarch ? 1.0 : (1.0 - 0.6 * (cr.heptarch?.deceive ?? 0));
      const pulse = (0.78 + 0.32 * Math.sin(t * 5.2) + 0.45 * (cr.vocalAmp ?? 0)) * emitScale;
      this.anglerEsca.position.set(tip[0], tip[1], tip[2]);
      this.anglerEsca.scale.setScalar((0.72 + 0.48 * lureSpan) * (0.94 + 0.08 * Math.sin(t * 5.2)));
      this.escaMat.emissiveIntensity = (1.5 + 1.4 * (1 - day)) * pulse;
      this.anglerLight.position.set(tip[0], tip[1], tip[2]);
      this.anglerLight.intensity = (0.85 + 2.4 * (1 - day)) * Math.min(1.5, lureSpan) * pulse;
    } else {
      this.anglerTube.mesh.visible = false;
      this.anglerEsca.visible = false;
      this.anglerLight.visible = false;
    }

    // 6) Curved Muscular Eye Peduncles + Wet Refractive Corneal Eyeballs + Microsaccadic Gaze
    const sacX = cr.retina?.sacYaw ?? 0;
    const sacY = cr.retina?.sacPitch ?? 0;
    for (let s = 0; s < 2; s++) {
      const st = B.stalks[s], tube = this.stalkTubes[s];
      const bx = X[st.base], by = Y[st.base], bz = Z[st.base];
      const mx = X[st.mid], my = Y[st.mid], mz = Z[st.mid];
      const ex = X[st.eye], ey = Y[st.eye], ez = Z[st.eye];
      const sgn = s === 0 ? -1 : 1;

      tube.pts[0][0] = hc[0] * 0.35 + bx * 0.65 + fh.s[0] * sgn * 0.05;
      tube.pts[0][1] = hc[1] * 0.35 + by * 0.65;
      tube.pts[0][2] = hc[2] * 0.35 + bz * 0.65 + fh.s[2] * sgn * 0.05;
      tube.pts[1][0] = (bx + mx) * 0.5 + fh.s[0] * sgn * 0.04;
      tube.pts[1][1] = (by + my) * 0.5;
      tube.pts[1][2] = (bz + mz) * 0.5 + fh.s[2] * sgn * 0.04;
      tube.pts[2][0] = mx; tube.pts[2][1] = my; tube.pts[2][2] = mz;
      tube.pts[3][0] = ex; tube.pts[3][1] = ey; tube.pts[3][2] = ez;
      writeCatmullTube(tube.geo, STALK_RINGS, STALK_SIDES, tube.pts, tube.radii, fh.f);

      const eyeObj = this.eyes[s];
      eyeObj.grp.position.set(ex, ey, ez);
      const gx = fh.f[0] + fh.s[0] * (sacX + sgn * 0.14) + fh.u[0] * sacY;
      const gy = fh.f[1] + fh.s[1] * (sacX + sgn * 0.14) + fh.u[1] * sacY;
      const gz = fh.f[2] + fh.s[2] * (sacX + sgn * 0.14) + fh.u[2] * sacY;
      this._tmpV1.set(ex + gx, ey + gy, ez + gz);
      eyeObj.grp.up.set(fh.u[0], fh.u[1], fh.u[2]);
      eyeObj.grp.lookAt(this._tmpV1);
      // Pupillary light reflex (constricts in bright daylight, dilates at night or high NE arousal)
      const dilate = 0.72 + 0.42 * (1 - day) + 0.25 * (cr.brain.nm.NE ?? 0.3);
      eyeObj.pupil.scale.set(0.68 * dilate, 1.05 * dilate, 0.55);
    }
    // Dorsal parietal / pineal ocellus at cranial crown
    {
      const pe = this.eyes[2];
      const topIdx = B.ring[NS - 1][0];
      pe.grp.position.set(
        X[topIdx] + fh.u[0] * 0.03,
        Y[topIdx] + fh.u[1] * 0.03,
        Z[topIdx] + fh.u[2] * 0.03
      );
      this._tmpV1.set(
        pe.grp.position.x + fh.u[0] * 0.8 + fh.f[0] * 0.5,
        pe.grp.position.y + fh.u[1] * 0.8 + fh.f[1] * 0.5,
        pe.grp.position.z + fh.u[2] * 0.8 + fh.f[2] * 0.5
      );
      pe.grp.up.set(fh.f[0], fh.f[1], fh.f[2]);
      pe.grp.lookAt(this._tmpV1);
    }

    // 7) Internal Organs, GIGA-Safe 12,000-Neuron Spiking Brain Cloud & 512 WCSPH Blood Corpuscles
    const hrHz = (cr.metab.hr || 72) / 60;
    this.heartPh = (this.heartPh + dt * hrHz * Math.PI * 2) % (Math.PI * 2);
    const systole = 1.0 + 0.22 * Math.pow(Math.max(0, Math.sin(this.heartPh)), 3);
    const c4 = segC[4], f4 = F[4];
    this.heart.position.set(c4[0] + f4.u[0] * 0.04, c4[1] + f4.u[1] * 0.04, c4[2] + f4.u[2] * 0.04);
    this.heart.scale.setScalar(systole);
    this.heartMat.emissiveIntensity = 0.65 + 0.95 * (systole - 1) * 4;

    for (let l = 0; l < 2; l++) {
      const sgn = l === 0 ? -1 : 1;
      this.lungs[l].position.set(
        c4[0] + f4.s[0] * sgn * 0.11,
        c4[1] + f4.s[1] * sgn * 0.11,
        c4[2] + f4.s[2] * sgn * 0.11
      );
      this.lungs[l].scale.set(1.35 * breath, 0.82 * breath, 0.78 * breath);
    }
    const c3 = segC[3], c1 = segC[1];
    this.liver.position.set(c3[0] - F[3].u[0] * 0.05, c3[1] - F[3].u[1] * 0.05, c3[2] - F[3].u[2] * 0.05);
    this.liver.scale.setScalar(0.75 + 0.45 * Math.min(1, (cr.metab.liverGly || 20) / 40));
    this.bladderMesh.position.set(c1[0] - F[1].u[0] * 0.06, c1[1] - F[1].u[1] * 0.06, c1[2] - F[1].u[2] * 0.06);
    this.bladderMesh.scale.setScalar(0.45 + 0.75 * Math.min(1, (cr.metab.bladder || 0) / 1.2));
    this.colonMesh.position.set(c1[0] + F[1].u[0] * 0.03, c1[1] + F[1].u[1] * 0.03, c1[2] + F[1].u[2] * 0.03);
    this.colonMesh.scale.setScalar(0.45 + 0.75 * Math.min(1, (cr.metab.colon || 0) / 1.5));

    const gutMass = Math.min(1, ((cr.metab.gut.glc + cr.metab.gut.fat + cr.metab.gut.prot) || 0) / 8);
    for (let b = 0; b < 10; b++) {
      const uGut = ((1 - ((b / 10 + t * 0.08 * (cr.metab.motility || 0.4)) % 1)) * 0.72 + 0.12) * (NS - 1);
      const gi = Math.min(NS - 2, Math.floor(uGut));
      const gf = uGut - gi;
      const ga = segC[gi], gb = segC[gi + 1];
      const bm = this.boluses[b];
      bm.visible = gutMass > 0.04;
      bm.position.set(
        ga[0] * (1 - gf) + gb[0] * gf,
        ga[1] * (1 - gf) + gb[1] * gf - 0.03,
        ga[2] * (1 - gf) + gb[2] * gf
      );
      bm.scale.setScalar(0.5 + 0.85 * gutMass);
    }

    // Stratified 12,000-neuron 3D spiking brain cloud (handles both standard lastSpike and 14.16M-neuron GIGA mode!)
    {
      const br = cr.brain;
      const c5 = segC[5], c6 = segC[6];
      const bx0 = c5[0] * 0.32 + c6[0] * 0.68;
      const by0 = c5[1] * 0.32 + c6[1] * 0.68;
      const bz0 = c5[2] * 0.32 + c6[2] * 0.68;
      const bp = this.brainPts.geometry.attributes.position.array;
      const bc = this.brainPts.geometry.attributes.color.array;
      const hasLast = !!br.lastSpike;

      // In GIGA mode, scatter sampled active sheet micro-buckets into brainGlow with O(1) cost
      if (!hasLast && br.prevSheetSpk && br.prevSheetSpkCount > 0) {
        const sheetSpan = Math.max(1, R0.STR - R0.THAL);
        const stepK = Math.max(1, Math.floor(br.prevSheetSpkCount / 180));
        for (let k = 0; k < br.prevSheetSpkCount; k += stepK) {
          const ni = R0.THAL + br.prevSheetSpk[k];
          const v = Math.min(this.brainVisN - 1, Math.floor((ni / Math.max(1, sheetSpan + 512)) * this.brainVisN));
          this.brainGlow[v] = 1.0;
        }
      }

      for (let v = 0; v < this.brainVisN; v++) {
        const lx = this.brainLocal[3 * v], ly = this.brainLocal[3 * v + 1], lz = this.brainLocal[3 * v + 2];
        bp[3 * v] = bx0 + fh.f[0] * lx + fh.u[0] * ly + fh.s[0] * lz;
        bp[3 * v + 1] = by0 + fh.f[1] * lx + fh.u[1] * ly + fh.s[1] * lz;
        bp[3 * v + 2] = bz0 + fh.f[2] * lx + fh.u[2] * ly + fh.s[2] * lz;

        const ni = this.brainIdx[v];
        let flash = this.brainGlow[v] * 0.86;
        if (hasLast) {
          const age = br.t - br.lastSpike[ni];
          if (age >= 0 && age < 0.14) flash = Math.max(flash, 1 - age / 0.14);
        } else if (ni < R0.THAL || ni >= R0.STR) {
          if (br.spk[ni]) flash = 1.0;
        }
        this.brainGlow[v] = flash;
        const gain = 0.24 + 1.55 * flash;
        bc[3 * v] = Math.min(1.8, this.brainBaseCol[3 * v] * gain + 0.35 * flash);
        bc[3 * v + 1] = Math.min(1.8, this.brainBaseCol[3 * v + 1] * gain + 0.35 * flash);
        bc[3 * v + 2] = Math.min(1.8, this.brainBaseCol[3 * v + 2] * gain + 0.35 * flash);
      }
      this.brainPts.geometry.attributes.position.needsUpdate = true;
      this.brainPts.geometry.attributes.color.needsUpdate = true;
    }

    // 1,024 3D WCSPH + D3Q19 LBM Blood Cells: 896 Erythrocytes (crimson->violet O2) + 128 Chemotactic Leukocytes (pearlescent cyan-white)
    if (cr.fluid?.initedPos) {
      this.bloodPts.visible = true;
      const fl = cr.fluid;
      const blP = this.bloodPts.geometry.attributes.position.array;
      const blC = this.bloodPts.geometry.attributes.color.array;
      const nBl = fl.px.length;
      const pType = fl.pType, pAct = fl.pActivation;
      for (let i = 0; i < nBl; i++) {
        blP[3 * i] = fl.px[i];
        blP[3 * i + 1] = fl.py[i];
        blP[3 * i + 2] = fl.pz[i];
        if (pType && pType[i] === 1) {
          const act = pAct ? pAct[i] : 0.3;
          blC[3 * i] = 0.58 + 0.42 * act;
          blC[3 * i + 1] = 0.92 + 0.08 * act;
          blC[3 * i + 2] = 1.05;
        } else {
          const o2 = Math.max(0, Math.min(1, (fl.pO2[i] - 0.55) / 0.42));
          blC[3 * i] = 0.22 + 0.88 * o2;
          blC[3 * i + 1] = 0.12 + 0.22 * (1 - o2);
          blC[3 * i + 2] = 0.68 - 0.42 * o2;
        }
      }
      this.bloodPts.geometry.attributes.position.needsUpdate = true;
      this.bloodPts.geometry.attributes.color.needsUpdate = true;
    } else {
      this.bloodPts.visible = false;
    }

    // 8) Atmospheric Rain & Bioluminescent Spores
    if (rainAmt > 0.02) {
      this.rainLines.visible = true;
      this.rainLines.material.opacity = Math.min(0.52, rainAmt * 0.55);
      const rp = this.rainLines.geometry.attributes.position.array;
      const wx = (W.windX ?? 0) * 0.22, wz = (W.windZ ?? 0) * 0.22;
      for (let i = 0; i < this.rainN; i++) {
        const sx = com[0] + this._rainSeeds[3 * i];
        const sy = ((this._rainSeeds[3 * i + 1] - t * 16.5) % 18 + 18) % 18;
        const sz = com[2] + this._rainSeeds[3 * i + 2];
        rp[6 * i] = sx; rp[6 * i + 1] = sy; rp[6 * i + 2] = sz;
        rp[6 * i + 3] = sx + wx; rp[6 * i + 4] = sy - 0.58; rp[6 * i + 5] = sz + wz;
      }
      this.rainLines.geometry.setDrawRange(0, this.rainN * 2);
      this.rainLines.geometry.attributes.position.needsUpdate = true;
    } else {
      this.rainLines.visible = false;
    }

    {
      const sp = this.sporePts.geometry.attributes.position.array;
      for (let i = 0; i < this.sporeN; i++) {
        const bx = this._sporeSeeds[4 * i], by = this._sporeSeeds[4 * i + 1], bz = this._sporeSeeds[4 * i + 2], ph = this._sporeSeeds[4 * i + 3];
        const x = bx + Math.sin(t * 0.35 + ph) * 1.4;
        const z = bz + Math.cos(t * 0.31 + ph) * 1.4;
        sp[3 * i] = x;
        sp[3 * i + 1] = W.height(x, z) + by + 0.28 * Math.sin(t * 0.9 + ph);
        sp[3 * i + 2] = z;
      }
      this.sporePts.geometry.attributes.position.needsUpdate = true;
    }

    // 9) 4 Camera Modes (Orbit Follow, Cinematic Director Sweep, First-Person Binocular POV, Biosphere Overhead)
    if (this.cameraMode === 'orbit') {
      if (this.follow) {
        const tgt = this.controls.target;
        const dx = com[0] - tgt.x, dy = (com[1] + 0.12) - tgt.y, dz = com[2] - tgt.z;
        const lerp = 1 - Math.exp(-dt * 5.5);
        tgt.x += dx * lerp; tgt.y += dy * lerp; tgt.z += dz * lerp;
        this.camera.position.x += dx * lerp;
        this.camera.position.y += dy * lerp;
        this.camera.position.z += dz * lerp;
      }
      this.controls.update();
    } else if (this.cameraMode === 'director') {
      this._dirAngle += dt * (this.reduced ? 0.05 : 0.16);
      const dist = 3.35 + 0.85 * Math.sin(t * 0.21);
      const elev = 1.25 + 0.55 * Math.sin(t * 0.15 + 1.1);
      const tx = com[0] + Math.cos(this._dirAngle) * dist;
      const tz = com[2] + Math.sin(this._dirAngle) * dist;
      const ty = Math.max(W.height(tx, tz) + 0.45, com[1] + elev);
      this.camera.position.lerp(this._tmpV1.set(tx, ty, tz), 1 - Math.exp(-dt * 3.5));
      this.controls.target.lerp(this._tmpV2.set(com[0], com[1] + 0.14, com[2]), 1 - Math.exp(-dt * 5.0));
      this.camera.lookAt(this.controls.target);
    } else if (this.cameraMode === 'pov') {
      const eL = B.stalks[0].eye, eR = B.stalks[1].eye;
      const ex = (X[eL] + X[eR]) * 0.5 + fh.f[0] * 0.16;
      const ey = (Y[eL] + Y[eR]) * 0.5 + fh.f[1] * 0.16 + 0.04;
      const ez = (Z[eL] + Z[eR]) * 0.5 + fh.f[2] * 0.16;
      this.camera.position.set(ex, ey, ez);
      this._povLook.lerp(this._tmpV1.set(ex + fh.f[0] * 4, ey + fh.f[1] * 4, ez + fh.f[2] * 4), 1 - Math.exp(-dt * 10));
      this.camera.lookAt(this._povLook);
    } else if (this.cameraMode === 'overhead') {
      this.controls.update();
    }

    // Clamp camera above local terrain height so orbit never clips underground
    if (this.cameraMode !== 'pov') {
      const floorY = W.height(this.camera.position.x, this.camera.position.z) + 0.22;
      if (this.camera.position.y < floorY) this.camera.position.y = floorY;
    }

    if (this.quality >= 1) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ Interactive Raycasting (Poke Soft-Body Node or Place World Prop)
  pick(ndcX, ndcY) {
    if (!this._ray) this._ray = new THREE.Raycaster();
    this._ray.setFromCamera(this._tmpV1.set(ndcX, ndcY), this.camera);
    const ray = this._ray.ray;

    const B = this.cr.body;
    let bestP = -1, bestT = Infinity;
    for (let i = 0; i < B.n; i++) {
      this._tmpV2.set(B.x[i], B.y[i], B.z[i]);
      const dSq = ray.distanceSqToPoint(this._tmpV2);
      const rHit = Math.max(0.16, B.r[i] * 1.65);
      if (dSq < rHit * rHit) {
        const tHit = ray.origin.distanceTo(this._tmpV2);
        if (tHit < bestT) { bestT = tHit; bestP = i; }
      }
    }
    if (bestP >= 0) {
      return { particle: bestP, dir: ray.direction.clone(), point: null };
    }

    const hits = this._ray.intersectObject(this.terrain, false);
    if (hits.length > 0) {
      return { particle: -1, dir: ray.direction.clone(), point: hits[0].point };
    }
    return { particle: -1, dir: ray.direction.clone(), point: null };
  }
}
