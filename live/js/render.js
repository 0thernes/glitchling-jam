// Wild Three.js + p5.js HDR16F / 4K UHD Biosphere Renderer (pass 17)
// Rendering strictly READS simulation state: 336-tet FEM particles, 4-comp HH spikes, 256 WCSPH blood parcels,
// 92-gene Evo-Devo morphology, p5.js Voronoi dermal & pheromone/mycelial textures, and the multi-agent ecosystem.

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

const HUES = [0x39ff9e, 0xff3df0, 0x3df7ff, 0xffb02e];
const RING_M = 36, RING_S = 72;
const GRASS_COUNT = 2400;
const MAX_PEER_MESHES = 16;
const MAX_EGG_MESHES = 18;
const LEVIATHAN_SEGS = 12;

// Depth-Buffer Screen-Space Contact & Horizon Ambient Occlusion + Crepuscular Scattering Shader
const ContactAOScatterShader = {
  uniforms: {
    tDiffuse: { value: null },
    tDepth: { value: null },
    uRes: { value: new THREE.Vector2(1280, 720) },
    uNear: { value: 0.05 },
    uFar: { value: 320.0 },
    uStrength: { value: 0.42 },
    uSunScreen: { value: new THREE.Vector2(0.5, 0.75) },
    uGodRay: { value: 0.18 },
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
        if (dC < uFar * 0.85) {
          vec2 texel = 1.0 / max(vec2(1.0), uRes);
          float rad = clamp(4.5 / max(0.6, dC), 1.0, 6.0);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398 + fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453) * 0.7;
            vec2 off = vec2(cos(a), sin(a)) * texel * rad * (1.0 + 0.5 * float(i & 1));
            float dS = linDepth(clamp(vUv + off, 0.001, 0.999));
            float diff = dC - dS;
            if (diff > 0.015 && diff < 1.35) {
              occ += (1.0 - diff / 1.35);
            }
          }
          occ = clamp((occ / 8.0) * uStrength * 2.1, 0.0, 0.58);
        }
      }
      vec3 col = safeCol * (1.0 - occ);

      // Subtle crepuscular sky-scatter toward sun screen projection
      vec2 toSun = uSunScreen - vUv;
      float sunDist = length(toSun);
      if (uGodRay > 0.01 && uStrength > 0.001 && sunDist < 0.85) {
        vec2 stepUv = toSun * 0.045;
        vec2 suv = vUv;
        float skyVis = 0.0;
        for (int s = 0; s < 5; s++) {
          suv = clamp(suv + stepUv, 0.002, 0.998);
          skyVis += step(uFar * 0.75, linDepth(suv));
        }
        col += vec3(1.0, 0.78, 0.58) * (skyVis / 5.0) * uGodRay * smoothstep(0.85, 0.0, sunDist);
      }
      col.r = (col.r >= 0.0 && col.r <= 48.0) ? col.r : 0.0;
      col.g = (col.g >= 0.0 && col.g <= 48.0) ? col.g : 0.0;
      col.b = (col.b >= 0.0 && col.b <= 48.0) ? col.b : 0.0;
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

function makeHDRTarget(w, h) {
  const depthTex = new THREE.DepthTexture(Math.max(1, w), Math.max(1, h));
  depthTex.type = THREE.UnsignedIntType;
  const rt = new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: true,
    depthTexture: depthTex,
  });
  return rt;
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
    R.toneMappingExposure = 1.06;

    // Enable Display-P3 wide color gamut when supported by browser + display, fallback sRGB
    const p3Ok = !!(THREE.DisplayP3ColorSpace && typeof window !== 'undefined' && window.matchMedia?.('(color-gamut: p3)')?.matches);
    try {
      R.outputColorSpace = p3Ok ? THREE.DisplayP3ColorSpace : THREE.SRGBColorSpace;
      this.colorGamut = p3Ok ? 'Display-P3' : 'sRGB';
    } catch {
      R.outputColorSpace = THREE.SRGBColorSpace;
      this.colorGamut = 'sRGB';
    }
    this.hdrPipeline = 'HDR16F + SSAO + Bloom';
    R.shadowMap.enabled = false;
    R.shadowMap.type = THREE.PCFSoftShadowMap;

    const S = (this.scene = new THREE.Scene());
    S.fog = new THREE.FogExp2(0x060510, 0.017);

    const cam = (this.camera = new THREE.PerspectiveCamera(52, 1, 0.05, 320));
    cam.position.set(3.4, 2.5, 4.0);

    this.controls = new OrbitControls(cam, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.maxPolarAngle = Math.PI * 0.492;
    this.controls.minDistance = 1.1;
    this.controls.maxDistance = 58;
    this.follow = true;
    this.cameraMode = opts.cameraMode || 'orbit'; // 'orbit' | 'pov' | 'director' | 'overhead'
    this._dirAngle = 0.5;
    this._povLook = new THREE.Vector3(0, 0.5, 1);

    // Lighting rig: Hemisphere + Shadowed Sun + Neural Rim + Geothermal Vent Warmth
    this.hemi = new THREE.HemisphereLight(0x9fd8ff, 0x221218, 0.95);
    S.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff0dd, 2.35);
    this.sun.position.set(12, 20, 8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -15;
    sc.right = sc.top = 15;
    sc.near = 1;
    sc.far = 55;
    S.add(this.sun);
    S.add(this.sun.target);

    this.rim = new THREE.PointLight(0xff40ff, 5.5, 9.5, 1.5);
    S.add(this.rim);

    // Build all 3D layers
    this._upVec = new THREE.Vector3(0, 1, 0);
    this._tmpV1 = new THREE.Vector3();
    this._tmpV2 = new THREE.Vector3();
    this._tmpQ = new THREE.Quaternion();
    this._tmpM = new THREE.Matrix4();

    this.buildSky();
    this.buildTerrain();
    this.buildGrass();
    this.buildProps();
    this.buildEcosystem();
    this.buildCreature();
    this.buildWeather();

    // HalfFloatType (HDR16F) EffectComposer with independent DepthTextures on both ping-pong targets
    const initRt = makeHDRTarget(512, 512);
    this.composer = new EffectComposer(R, initRt);
    this.composer.renderTarget2.dispose();
    this.composer.renderTarget2 = makeHDRTarget(512, 512);
    this.composer.readBuffer = this.composer.renderTarget2;
    this.composer.writeBuffer = this.composer.renderTarget1;

    this.renderPass = new RenderPass(S, cam);
    this.composer.addPass(this.renderPass);

    // Custom SSAO + crepuscular scatter pass binding readBuffer.depthTexture dynamically
    this.aoPass = new ShaderPass(ContactAOScatterShader);
    const origAORender = this.aoPass.render.bind(this.aoPass);
    this.aoPass.render = (renderer, writeBuffer, readBuffer, deltaTime, maskActive) => {
      this.aoPass.uniforms.tDepth.value = readBuffer.depthTexture;
      origAORender(renderer, writeBuffer, readBuffer, deltaTime, maskActive);
    };
    this.composer.addPass(this.aoPass);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.72, 0.52, 0.84);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.quality = 2;
    this.setQuality(opts.quality ?? 2);
    this.clock = 0;
    this.heartPh = 0;
  }

  setCameraMode(mode) {
    this.cameraMode = mode;
    this.controls.enabled = mode === 'orbit' || mode === 'overhead';
    if (mode === 'overhead') {
      this.controls.target.set(0, 0, 0);
      this.camera.position.set(0, 31, 17);
      this.camera.fov = 54;
      this.camera.updateProjectionMatrix();
    } else if (mode === 'pov') {
      this.camera.fov = 76;
      this.camera.updateProjectionMatrix();
    } else {
      this.camera.fov = 52;
      this.camera.updateProjectionMatrix();
    }
    if (this.cg) this.cg.visible = true;
  }

  setQuality(q) {
    this.quality = q;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (q === 4) {
      // Fixed 4K UHD (3840x2160) HDR16F master mode
      this.pr = 1;
    } else {
      this.pr = [0.55, 0.85, 1, dpr][q] ?? 1;
    }
    this.aoPass.enabled = q >= 1;
    this.aoPass.uniforms.uStrength.value = q >= 2 ? 0.55 : 0.0;
    this.bloom.enabled = q >= 1;
    this.renderer.shadowMap.enabled = q >= 3;
    this.sun.castShadow = q >= 3;
    this.rainN = [160, 480, 950, 1500, 1800][q] ?? 950;
    if (this.grassMesh) {
      this.grassMesh.count = [450, 1100, 1800, GRASS_COUNT, GRASS_COUNT][q] ?? 1800;
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

    // Resize both HalfFloatType + DepthTexture targets cleanly
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

    this.camera.aspect = cssW / cssH;
    this.camera.updateProjectionMatrix();
    this.bufferWidth = bufW;
    this.bufferHeight = bufH;
  }

  /** Render an exact 3840x2160 4K UHD HDR16F frame and download as a PNG */
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

  // ------------------------------------------------------------------ Sky: Twin Alien Moons, FBM Nebula, Aurora & Sun Corona
  buildSky() {
    const g = new THREE.SphereGeometry(175, 40, 24);
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
          vec3 nightZen = vec3(0.012, 0.008, 0.038);
          vec3 nightHor = vec3(0.055, 0.018, 0.105);
          vec3 dayZen = mix(vec3(0.14, 0.30, 0.62), vec3(0.24, 0.22, 0.52), 0.35 * sin(season * 6.283));
          vec3 dayHor = mix(vec3(0.82, 0.52, 0.68), vec3(0.95, 0.66, 0.48), 0.5 + 0.5 * cos(season * 6.283));

          vec3 c = mix(
            mix(nightHor, nightZen, smoothstep(-0.08, 0.65, y)),
            mix(dayHor, dayZen, smoothstep(-0.08, 0.58, y)),
            day
          );

          // Deep-space bioluminescent FBM nebula
          float neb = noise(dir * 3.5 + vec3(t * 0.008, 0.0, -t * 0.006)) * 0.65
                    + noise(dir * 7.5 - vec3(0.0, t * 0.01, 0.0)) * 0.35;
          c += mix(vec3(0.28, 0.05, 0.45), vec3(0.05, 0.42, 0.52), neb) * smoothstep(0.42, 0.85, neb) * (1.0 - 0.72 * day) * smoothstep(-0.05, 0.35, y);

          // Multi-curtain Magnetospheric Aurora
          float aurWave = sin(dir.x * 8.5 + t * 0.28 + sin(dir.z * 6.5 + t * 0.19) * 2.3);
          float aur = smoothstep(0.08, 0.55, y) * smoothstep(0.95, 0.35, y) * pow(0.5 + 0.5 * aurWave, 2.2);
          c += mix(vec3(0.08, 0.95, 0.62), vec3(0.65, 0.22, 0.98), 0.5 + 0.5 * sin(dir.z * 4.0 + t * 0.12)) * aur * 0.36 * (1.0 - day * 0.72);

          // Solar disc & atmospheric Mie halo
          float sunCos = clamp(dot(dir, normalize(sunDir)), 0.0, 1.0);
          c += vec3(1.0, 0.82, 0.58) * pow(sunCos, 12.0) * 0.45 * day;
          c += vec3(1.4, 1.25, 1.05) * smoothstep(0.9965, 0.9992, sunCos) * (0.4 + 1.4 * day);

          // Twin Alien Moons (Selene-Prime & Cyan-Minor)
          vec3 m1Dir = normalize(vec3(-0.52, 0.58, -0.62));
          vec3 m2Dir = normalize(vec3(-0.24, 0.44, -0.86));
          float m1 = dot(dir, m1Dir);
          if (m1 > 0.994) {
            float crater = noise(dir * 95.0);
            vec3 mc = vec3(0.85, 0.80, 0.96) * (0.72 + 0.35 * crater);
            c = mix(c, mc, (1.0 - 0.45 * day) * smoothstep(0.994, 0.9952, m1));
          }
          float m2 = dot(dir, m2Dir);
          if (m2 > 0.9982) {
            c = mix(c, vec3(0.48, 0.92, 1.0), (1.0 - 0.5 * day) * smoothstep(0.9982, 0.9988, m2));
          }

          // Crisp high-altitude starfield
          vec3 q = floor(dir * 260.0);
          float s = step(0.9968, h(q)) * (1.0 - day * 0.88) * smoothstep(0.0, 0.28, y);
          c += vec3(0.85, 0.92, 1.0) * s * (1.8 + 0.8 * sin(t * 2.5 + q.x));

          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(g, m);
    this.scene.add(this.sky);
  }

  // ------------------------------------------------------------------ Terrain + p5.js Mycelial & Pheromone Biosphere Overlay
  buildTerrain() {
    const N = 176;
    const g = new THREE.PlaneGeometry(46, 46, N, N);
    g.rotateX(-Math.PI / 2);
    const col = new Float32Array(g.attributes.position.count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.tGeo = g;

    const bioTex = this.p5Layer ? this.p5Layer.bioTex : null;
    this.terrainU = {
      uT: { value: 0 },
      uBioTex: { value: bioTex },
      uHasBio: { value: bioTex ? 1.0 : 0.0 },
      uWorldSpan: { value: 2 * WORLD },
    };

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.82,
      metalness: 0.08,
    });
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uT = this.terrainU.uT;
      sh.uniforms.uBioTex = this.terrainU.uBioTex;
      sh.uniforms.uHasBio = this.terrainU.uHasBio;
      sh.uniforms.uWorldSpan = this.terrainU.uWorldSpan;
      sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\n vW = (modelMatrix * vec4(transformed, 1.0)).xyz;'
      );
      sh.fragmentShader = 'uniform float uT, uHasBio, uWorldSpan; uniform sampler2D uBioTex; varying vec3 vW;\n' +
        sh.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float vein = smoothstep(0.91, 1.0, sin(vW.x * 1.35 + sin(vW.z * 0.92 + uT * 0.22) * 2.0) * sin(vW.z * 1.15 + uT * 0.16));
          totalEmissiveRadiance += vec3(0.08, 0.78, 1.05) * vein * (0.32 + 0.24 * sin(uT * 1.5 + vW.x));
          if (uHasBio > 0.5) {
            vec2 bioUv = clamp((vW.xz / uWorldSpan) + 0.5, 0.0, 1.0);
            vec4 bio = texture2D(uBioTex, bioUv);
            totalEmissiveRadiance += bio.rgb * bio.a * 0.75;
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
    const sTint = season === 'winter' ? [0.08, 0.11, 0.18]
      : season === 'autumn' ? [0.12, 0.05, 0.04]
      : season === 'summer' ? [0.03, 0.09, 0.04]
      : [0.02, 0.07, 0.06];

    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      const h = W.height(x, z);
      p.setY(i, h);
      const t = Math.max(0, Math.min(1, (h + 1.5) / 3.5));
      const moss = 0.5 + 0.5 * Math.sin(x * 0.55 + Math.cos(z * 0.5) * 1.6);
      c.setXYZ(
        i,
        0.04 + 0.21 * t + 0.05 * moss + sTint[0],
        0.05 + 0.14 * (1 - t) + 0.09 * moss + sTint[1],
        0.11 + 0.18 * (1 - t) + sTint[2]
      );
    }
    p.needsUpdate = true;
    c.needsUpdate = true;
    this.tGeo.computeVertexNormals();
    if (this._grassBaseXZ) this._syncGrassHeights();
  }

  // ------------------------------------------------------------------ 2,400 GPU-Instanced Wind-Swaying Bioluminescent Grass Blades
  buildGrass() {
    // Tapered 4-segment curved blade geometry
    const segs = 4;
    const pos = [], nor = [], col = [], idx = [];
    for (let s = 0; s <= segs; s++) {
      const v = s / segs;
      const w = 0.036 * (1 - v * 0.88);
      const y = v * 0.52;
      const zCurve = v * v * 0.09;
      pos.push(-w, y, zCurve, w, y, zCurve);
      nor.push(0, 0.25, 0.97, 0, 0.25, 0.97);
      // Root deep emerald -> tip glowing cyan-lime
      const r = 0.05 + 0.22 * v * v;
      const g = 0.22 + 0.72 * v;
      const b = 0.18 + 0.65 * v * v;
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
      roughness: 0.55,
      metalness: 0.05,
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
          vTip = clamp(position.y / 0.52, 0.0, 1.0);
          vec3 iPos = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
          float gust = sin(uTime * 2.3 + iPos.x * 0.45 + iPos.z * 0.38) + 0.5 * cos(uTime * 4.1 - iPos.z * 0.7);
          float bend = vTip * vTip;
          transformed.x += (uWind.x * 0.16 + 0.09 * gust) * bend;
          transformed.z += (uWind.y * 0.16 + 0.07 * gust) * bend;`
        );
      sh.fragmentShader = 'uniform float uNightGlow; varying float vTip;\n' +
        sh.fragmentShader.replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          totalEmissiveRadiance += diffuseColor.rgb * pow(vTip, 2.2) * (0.28 + 0.85 * uNightGlow);`
        );
    };

    this.grassMesh = new THREE.InstancedMesh(bladeGeo, grassMat, GRASS_COUNT);
    this.grassMesh.frustumCulled = false;
    this._grassBaseXZ = new Float32Array(GRASS_COUNT * 4); // x, z, rotY, scale

    const W = this.cr.world;
    let gs = 424242;
    const grnd = () => { gs = (gs * 1664525 + 1013904223) >>> 0; return gs / 4294967296; };
    let placed = 0, guard = 0;
    while (placed < GRASS_COUNT && guard++ < GRASS_COUNT * 6) {
      const r = 1.8 + Math.sqrt(grnd()) * (WORLD - 2.2);
      const a = grnd() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      let inPool = false;
      for (const P of W.pools) if (Math.hypot(x - P.x, z - P.z) < P.r + 0.25) inPool = true;
      if (inPool) continue;
      this._grassBaseXZ[placed * 4] = x;
      this._grassBaseXZ[placed * 4 + 1] = z;
      this._grassBaseXZ[placed * 4 + 2] = grnd() * Math.PI * 2;
      this._grassBaseXZ[placed * 4 + 3] = 0.65 + grnd() * 0.95;
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

  // ------------------------------------------------------------------ L-System Flora, Vents, Crystal Shelters, Caustics Pools
  buildProps() {
    const S = this.scene, W = this.cr.world;
    this.props = new THREE.Group();
    S.add(this.props);

    this.rockMat = new THREE.MeshPhysicalMaterial({
      color: 0x2b2544,
      roughness: 0.48,
      metalness: 0.22,
      iridescence: 1,
      iridescenceIOR: 1.65,
      iridescenceThicknessRange: [180, 880],
      flatShading: true,
    });
    this.rockMeshes = [];
    this.springMeshes = [];
    this.ventMeshes = [];
    this.shelterMeshes = [];
    this.plantMeshes = [];
    this.snackMeshes = new Map();
    this.wasteMeshes = [];

    // Multi-branching L-system alien flora
    const shapes = [
      new THREE.SphereGeometry(0.27, 20, 14),
      new THREE.BoxGeometry(0.38, 0.38, 0.38),
      new THREE.ConeGeometry(0.28, 0.56, 18),
      new THREE.OctahedronGeometry(0.34, 0),
    ];
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x183d2e, emissive: 0x061b14, roughness: 0.65 });
    const leafGeo = new THREE.ConeGeometry(0.14, 0.48, 6);

    for (let idx = 0; idx < W.plants.length; idx++) {
      const P = W.plants[idx];
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.095, 1.18, 8), stemMat);
      trunk.position.y = 0.59;
      g.add(trunk);

      // 3 L-system secondary branches + glowing canopy fronds
      const crown = new THREE.Group();
      crown.position.y = 1.15;
      for (let b = 0; b < 3; b++) {
        const ang = (b / 3) * Math.PI * 2 + idx * 0.7;
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.04, 0.48, 6), stemMat);
        br.position.set(Math.cos(ang) * 0.16, 0.16, Math.sin(ang) * 0.16);
        br.rotation.z = -Math.cos(ang) * 0.55;
        br.rotation.x = Math.sin(ang) * 0.55;
        crown.add(br);

        const frond = new THREE.Mesh(
          leafGeo,
          new THREE.MeshStandardMaterial({ color: HUES[P.c], emissive: HUES[P.c], emissiveIntensity: 0.45, roughness: 0.45 })
        );
        frond.position.set(Math.cos(ang) * 0.34, 0.28, Math.sin(ang) * 0.34);
        frond.rotation.z = -Math.cos(ang) * 1.05;
        frond.rotation.x = Math.sin(ang) * 1.05;
        crown.add(frond);
      }

      const fm = new THREE.MeshStandardMaterial({
        color: HUES[P.c],
        emissive: HUES[P.c],
        emissiveIntensity: 1.6,
        roughness: 0.26,
      });
      const fruit = new THREE.Mesh(shapes[P.s], fm);
      fruit.position.y = 0.26;
      crown.add(fruit);

      if (P.s === 3) {
        for (let k = 0; k < 6; k++) {
          const th = new THREE.Mesh(
            new THREE.ConeGeometry(0.04, 0.32, 5),
            new THREE.MeshStandardMaterial({ color: 0xff2233, emissive: 0x660011 })
          );
          th.position.set(Math.cos(k) * 0.26, 0.26 + Math.sin(k * 2) * 0.18, Math.sin(k) * 0.26);
          th.lookAt(0, 0.26, 0);
          th.rotateX(-Math.PI / 2);
          crown.add(th);
        }
      }
      g.add(crown);

      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.56, 0.025, 6, 40),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.05;
      g.add(ring);

      g.position.set(P.x, P.y, P.z);
      this.props.add(g);
      this.plantMeshes.push({ g, crown, fruit, fm, ring });
    }

    // Crystal Spire Shelters (4 translucent amethyst-cyan crystal clusters)
    const crystalMat = new THREE.MeshPhysicalMaterial({
      color: 0x66e0ff,
      emissive: 0x163860,
      emissiveIntensity: 0.75,
      roughness: 0.12,
      metalness: 0.1,
      transmission: 0.65,
      thickness: 0.8,
      iridescence: 1.0,
      iridescenceIOR: 1.9,
      flatShading: true,
    });
    for (const sh of W.shelters || []) {
      const grp = new THREE.Group();
      for (let k = 0; k < 5; k++) {
        const h = (0.9 + (k % 3) * 0.45) * (sh.tall || 1);
        const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.18 + 0.04 * (k % 2), h, 6), crystalMat);
        const a = (k / 5) * Math.PI * 2;
        spire.position.set(Math.cos(a) * 0.28, h * 0.45, Math.sin(a) * 0.28);
        spire.rotation.z = -Math.cos(a) * 0.22;
        spire.rotation.x = Math.sin(a) * 0.22;
        grp.add(spire);
      }
      grp.position.set(sh.x, sh.y, sh.z);
      this.props.add(grp);
      this.shelterMeshes.push(grp);
    }

    // Geothermal Steam/Ember Plume Particle Pool (180 buoyant particles across vents)
    this.ventPlumeN = 180;
    const vpGeo = new THREE.BufferGeometry();
    const vpPos = new Float32Array(this.ventPlumeN * 3);
    const vpCol = new Float32Array(this.ventPlumeN * 3);
    this._ventLife = new Float32Array(this.ventPlumeN);
    for (let i = 0; i < this.ventPlumeN; i++) {
      this._ventLife[i] = Math.random();
      vpCol[3 * i] = 1.0;
      vpCol[3 * i + 1] = 0.45 + 0.4 * Math.random();
      vpCol[3 * i + 2] = 0.2 + 0.5 * Math.random();
    }
    vpGeo.setAttribute('position', new THREE.BufferAttribute(vpPos, 3));
    vpGeo.setAttribute('color', new THREE.BufferAttribute(vpCol, 3));
    this.ventPlumes = new THREE.Points(
      vpGeo,
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.14,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.ventPlumes.frustumCulled = false;
    S.add(this.ventPlumes);

    const coil = new THREE.TorusKnotGeometry(0.7, 0.07, 100, 8, 2, 7);
    this.springGeo = coil;
    this.springMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x553300, metalness: 0.8, roughness: 0.25 });

    // Shimmering Voronoi-Caustics Water Pools
    this.poolU = { t: { value: 0 } };
    this.poolMeshes = W.pools.map((P) => {
      const m = new THREE.Mesh(
        new THREE.CircleGeometry(P.r, 56),
        new THREE.ShaderMaterial({
          uniforms: this.poolU,
          transparent: true,
          depthWrite: false,
          vertexShader: `
            varying vec2 vP;
            void main() {
              vP = position.xy;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform float t;
            varying vec2 vP;
            float caustic(vec2 uv) {
              vec2 p = uv * 3.4;
              float a = sin(p.x * 2.1 + t * 1.9 + cos(p.y * 2.4 - t * 1.4));
              float b = cos(p.y * 2.7 - t * 1.6 + sin(p.x * 1.9 + t * 2.1));
              return pow(0.5 + 0.5 * a * b, 3.0);
            }
            void main() {
              float r = length(vP);
              float c1 = caustic(vP);
              float c2 = caustic(vP * 1.45 + vec2(0.7, -0.4));
              float ripple = 0.5 + 0.5 * sin(r * 15.0 - t * 3.2);
              float edge = smoothstep(${P.r.toFixed(2)}, ${(P.r * 0.76).toFixed(2)}, r);
              float foam = smoothstep(${(P.r * 0.78).toFixed(2)}, ${(P.r * 0.95).toFixed(2)}, r) * edge;
              vec3 deep = vec3(0.03, 0.19, 0.38);
              vec3 glow = vec3(0.32, 0.92, 1.0);
              vec3 col = mix(deep, glow, clamp(c1 * 0.65 + c2 * 0.45 + ripple * 0.18 + foam * 0.55, 0.0, 1.0));
              gl_FragColor = vec4(col, 0.82 * edge);
            }
          `,
        })
      );
      m.rotation.x = -Math.PI / 2;
      S.add(m);
      return m;
    });

    this.snackGeo = new THREE.IcosahedronGeometry(0.16, 1);
    this.wasteGeo = new THREE.SphereGeometry(0.12, 8, 6);
    this.syncProps();
  }

  syncProps() {
    const W = this.cr.world;
    if (this.poolMeshes) {
      W.pools.forEach((P, i) => {
        this.poolMeshes[i].position.set(P.x, W.height(P.x, P.z) + 0.045, P.z);
      });
    }
    if (this.poolU) this.poolU.t.value = W.t;

    while (this.rockMeshes.length < W.rocks.length) {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const v = new THREE.Vector3().fromBufferAttribute(p, i);
        v.multiplyScalar(0.85 + 0.25 * Math.sin(v.x * 5 + v.y * 3) * Math.cos(v.z * 4));
        p.setXYZ(i, v.x, v.y, v.z);
      }
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
        new THREE.CylinderGeometry(1.3, 1.3, 0.12, 32),
        new THREE.MeshStandardMaterial({ color: 0x40ffd0, emissive: 0x0a6050, roughness: 0.3 })
      );
      const c = new THREE.Mesh(this.springGeo, this.springMat);
      c.rotation.x = Math.PI / 2;
      c.scale.set(1, 1, 0.5);
      g.add(c);
      g.add(pad);
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

    // Geothermal Hydrothermal Vents (volcanic chimney cone + glowing caldera + warm point light)
    const vents = W.vents || [];
    while (this.ventMeshes.length < vents.length) {
      const g = new THREE.Group();
      const cone = new THREE.Mesh(
        new THREE.CylinderGeometry(0.32, 0.95, 0.78, 12, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x261c24, emissive: 0x3a1205, roughness: 0.85, side: THREE.DoubleSide })
      );
      cone.position.y = 0.36;
      const throat = new THREE.Mesh(
        new THREE.CircleGeometry(0.3, 16),
        new THREE.MeshBasicMaterial({ color: 0xff6a1a })
      );
      throat.rotation.x = -Math.PI / 2;
      throat.position.y = 0.72;
      const light = new THREE.PointLight(0xff6622, 3.2, 7.5, 1.6);
      light.position.y = 0.95;
      g.add(cone, throat, light);
      g.userData = { throat, light };
      this.props.add(g);
      this.ventMeshes.push(g);
    }
    vents.forEach((v, i) => {
      const g = this.ventMeshes[i];
      g.visible = true;
      g.position.set(v.x, v.y, v.z);
      const pulse = 0.8 + 0.35 * Math.sin(v.phase || 0);
      g.userData.light.intensity = 2.6 * v.heat * pulse;
    });
    for (let i = vents.length; i < this.ventMeshes.length; i++) this.ventMeshes[i].visible = false;

    if (W.shelters) {
      W.shelters.forEach((sh, i) => {
        if (this.shelterMeshes[i]) this.shelterMeshes[i].position.set(sh.x, sh.y, sh.z);
      });
    }
  }

  // ------------------------------------------------------------------ 3D Multi-Agent Ecosystem (Conspecifics, Eggs, Bio-Mites, Shadow-Leviathan)
  buildEcosystem() {
    this.ecoGroup = new THREE.Group();
    this.scene.add(this.ecoGroup);

    // 1) Articulated 7-segment 3D Conspecific Glitchlings
    this.peerPool = [];
    const segGeo = new THREE.SphereGeometry(0.16, 14, 10);
    const eyeGeo = new THREE.SphereGeometry(0.055, 10, 8);
    const finGeo = new THREE.ConeGeometry(0.06, 0.26, 5);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xe8ffff });

    for (let i = 0; i < MAX_PEER_MESHES; i++) {
      const grp = new THREE.Group();
      grp.visible = false;
      const mat = new THREE.MeshPhysicalMaterial({
        color: 0x55ccff,
        emissive: 0x113355,
        emissiveIntensity: 0.9,
        roughness: 0.28,
        iridescence: 0.9,
        transparent: true,
        opacity: 0.92,
      });
      const segs = [];
      const fins = [];
      for (let s = 0; s < 7; s++) {
        const sm = new THREE.Mesh(segGeo, mat);
        grp.add(sm);
        segs.push(sm);
        if (s >= 1 && s <= 5) {
          const fm = new THREE.Mesh(finGeo, mat);
          grp.add(fm);
          fins.push({ mesh: fm, seg: s });
        }
      }
      const eyeL = new THREE.Mesh(eyeGeo, eyeMat);
      const eyeR = new THREE.Mesh(eyeGeo, eyeMat);
      grp.add(eyeL, eyeR);
      this.ecoGroup.add(grp);
      this.peerPool.push({ grp, mat, segs, fins, eyeL, eyeR });
    }

    // 2) Translucent Pulsing 3D Bioluminescent Eggs
    this.eggPool = [];
    const shellGeo = new THREE.SphereGeometry(0.18, 16, 12);
    shellGeo.scale(1, 1.28, 1);
    const coreGeo = new THREE.SphereGeometry(0.09, 12, 10);
    for (let i = 0; i < MAX_EGG_MESHES; i++) {
      const grp = new THREE.Group();
      grp.visible = false;
      const shellMat = new THREE.MeshPhysicalMaterial({
        color: 0xaaffee,
        emissive: 0x226655,
        emissiveIntensity: 0.7,
        transmission: 0.65,
        roughness: 0.15,
        transparent: true,
        opacity: 0.82,
      });
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0xffdd66,
        emissive: 0xffaa22,
        emissiveIntensity: 2.2,
      });
      const shell = new THREE.Mesh(shellGeo, shellMat);
      const core = new THREE.Mesh(coreGeo, coreMat);
      grp.add(shell, core);
      this.ecoGroup.add(grp);
      this.eggPool.push({ grp, shell, core, coreMat, shellMat });
    }

    // 3) Photonic Bio-Mites (up to 64 glowing golden-cyan point sprites)
    this.maxMites = 64;
    const mGeo = new THREE.BufferGeometry();
    mGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.maxMites * 3), 3));
    const mCol = new Float32Array(this.maxMites * 3);
    for (let i = 0; i < this.maxMites; i++) {
      mCol[3 * i] = 0.55 + 0.45 * (i & 1);
      mCol[3 * i + 1] = 0.95;
      mCol[3 * i + 2] = 0.45 + 0.55 * ((i + 1) & 1);
    }
    mGeo.setAttribute('color', new THREE.BufferAttribute(mCol, 3));
    this.mitePts = new THREE.Points(
      mGeo,
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.15,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.mitePts.frustumCulled = false;
    this.ecoGroup.add(this.mitePts);

    // 4) Shadow-Leviathan Apex Predators (up to 3 multi-segment armored serpentine leviathans)
    this.predPool = [];
    const levSegGeo = new THREE.IcosahedronGeometry(0.36, 1);
    const levSpineGeo = new THREE.ConeGeometry(0.08, 0.48, 5);
    const levMat = new THREE.MeshStandardMaterial({
      color: 0x12081a,
      emissive: 0x660824,
      emissiveIntensity: 1.35,
      roughness: 0.35,
      metalness: 0.65,
      flatShading: true,
    });
    const levEyeMat = new THREE.MeshBasicMaterial({ color: 0xff2244 });
    for (let p = 0; p < 3; p++) {
      const grp = new THREE.Group();
      grp.visible = false;
      const segs = [];
      for (let s = 0; s < LEVIATHAN_SEGS; s++) {
        const holder = new THREE.Group();
        const bodyM = new THREE.Mesh(levSegGeo, levMat);
        const taper = (1 - (s / LEVIATHAN_SEGS) * 0.72) * (s === 0 ? 1.18 : 1.0);
        bodyM.scale.set(taper * 1.1, taper * 0.85, taper * 1.25);
        holder.add(bodyM);
        if (s < LEVIATHAN_SEGS - 2) {
          const sp = new THREE.Mesh(levSpineGeo, levMat);
          sp.position.y = 0.32 * taper;
          sp.rotation.x = -0.35;
          holder.add(sp);
        }
        if (s === 0) {
          for (const sx of [-0.22, 0.22]) {
            const ey = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), levEyeMat);
            ey.position.set(sx, 0.12, 0.26);
            holder.add(ey);
          }
        }
        grp.add(holder);
        segs.push(holder);
      }
      this.ecoGroup.add(grp);
      this.predPool.push({ grp, segs });
    }
  }

  syncEcosystem(t) {
    const eco = this.cr.eco;
    if (!eco) {
      this.ecoGroup.visible = false;
      return;
    }
    this.ecoGroup.visible = true;

    // 1) Conspecifics
    const peers = eco.peers;
    for (let i = 0; i < MAX_PEER_MESHES; i++) {
      const slot = this.peerPool[i];
      const p = peers[i];
      if (!p) {
        slot.grp.visible = false;
        continue;
      }
      slot.grp.visible = true;
      const hue = p.gen.pigmentHue ?? 0.55;
      const camo = p.camo || 0;
      slot.mat.color.setHSL(hue, 0.78 - 0.45 * camo, 0.48 - 0.22 * camo);
      slot.mat.emissive.setHSL((hue + 0.08) % 1, 0.88, (0.18 + 0.22 * (p.courtship || 0)) * (1 - 0.6 * camo));

      const bGirth = (p.gen.bodyGirth ?? 1.0) * p.scale;
      for (let s = 0; s < 7; s++) {
        const sm = slot.segs[s];
        sm.position.set(p.segX[s], p.segY[s], p.segZ[s]);
        const prof = Math.sin(((s + 0.6) / 7.6) * Math.PI);
        sm.scale.setScalar((0.55 + 0.65 * prof) * bGirth);
      }
      const finScale = (p.gen.crestFin ?? 0.5) * p.scale;
      for (const f of slot.fins) {
        const s = f.seg;
        f.mesh.position.set(p.segX[s], p.segY[s] + 0.18 * bGirth, p.segZ[s]);
        f.mesh.scale.set(0.8 * p.scale, Math.max(0.15, 1.3 * finScale), 1.1 * p.scale);
      }
      const hx = p.segX[6], hy = p.segY[6], hz = p.segZ[6];
      const cf = Math.cos(p.hdg), sf = Math.sin(p.hdg);
      slot.eyeL.position.set(hx + cf * 0.14 - sf * 0.11 * p.scale, hy + 0.12 * p.scale, hz + sf * 0.14 + cf * 0.11 * p.scale);
      slot.eyeR.position.set(hx + cf * 0.14 + sf * 0.11 * p.scale, hy + 0.12 * p.scale, hz + sf * 0.14 - cf * 0.11 * p.scale);
      slot.eyeL.scale.setScalar(p.scale);
      slot.eyeR.scale.setScalar(p.scale);
    }

    // 2) Eggs
    const eggs = eco.eggs;
    for (let i = 0; i < MAX_EGG_MESHES; i++) {
      const slot = this.eggPool[i];
      const eg = eggs[i];
      if (!eg) {
        slot.grp.visible = false;
        continue;
      }
      slot.grp.visible = true;
      const pulse = 1 + 0.12 * Math.sin(t * (3 + 8 * eg.progress) + eg.id);
      slot.grp.position.set(eg.x, eg.y, eg.z);
      slot.grp.scale.setScalar(pulse);
      slot.core.scale.setScalar(0.55 + 0.65 * eg.progress);
      slot.coreMat.emissive.setHSL(eg.gen?.pigmentHue ?? 0.14, 0.95, 0.5);
      slot.coreMat.emissiveIntensity = 1.4 + 2.2 * eg.progress;
    }

    // 3) Photonic Bio-Mites
    const mites = eco.mites;
    const mp = this.mitePts.geometry.attributes.position.array;
    const nM = Math.min(this.maxMites, mites.length);
    for (let i = 0; i < nM; i++) {
      mp[3 * i] = mites[i].x;
      mp[3 * i + 1] = mites[i].y;
      mp[3 * i + 2] = mites[i].z;
    }
    this.mitePts.geometry.setDrawRange(0, nM);
    this.mitePts.geometry.attributes.position.needsUpdate = true;

    // 4) Shadow-Leviathans
    const preds = eco.predators;
    const W = this.cr.world;
    for (let p = 0; p < this.predPool.length; p++) {
      const slot = this.predPool[p];
      const lv = preds[p];
      if (!lv) {
        slot.grp.visible = false;
        continue;
      }
      slot.grp.visible = true;
      const cf = Math.cos(lv.hdg), sf = Math.sin(lv.hdg);
      for (let s = 0; s < LEVIATHAN_SEGS; s++) {
        const holder = slot.segs[s];
        const lag = s * 0.48;
        const sway = 0.36 * Math.sin(t * 4.2 - s * 0.65);
        const sx = lv.x - cf * lag - sf * sway;
        const sz = lv.z - sf * lag + cf * sway;
        const sy = W.height(sx, sz) + 0.55 + 0.14 * Math.sin(t * 3.1 + s * 0.5);
        holder.position.set(sx, sy, sz);
        holder.rotation.y = Math.atan2(cf, sf);
      }
    }
  }

  // ------------------------------------------------------------------ Sculpted Evo-Devo Focal Glitchling
  buildCreature() {
    const S = this.scene;
    this.cg = new THREE.Group();
    S.add(this.cg);

    // 1) High-Resolution 72x36 Catmull-Rom Dermal Tube + p5.js Voronoi Biomaterial Shader
    const n = RING_S * (RING_M + 1);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let s = 0; s < RING_S; s++) {
      for (let m = 0; m <= RING_M; m++) {
        const i = s * (RING_M + 1) + m;
        uv[2 * i] = s / (RING_S - 1);
        uv[2 * i + 1] = m / RING_M;
        if (s < RING_S - 1 && m < RING_M) {
          const a = i, b = i + RING_M + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      }
    }
    const g = (this.skinGeo = new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);

    this.chromaTex = new THREE.DataTexture(this.cr.skin.rgba, SW, SH, THREE.RGBAFormat);
    this.chromaTex.wrapS = THREE.RepeatWrapping;
    this.chromaTex.wrapT = THREE.RepeatWrapping;
    this.chromaTex.magFilter = THREE.LinearFilter;
    this.chromaTex.needsUpdate = true;

    const p5Dermal = this.p5Layer ? this.p5Layer.dermalTex : this.chromaTex;
    this.skinU = {
      chroma: { value: this.chromaTex },
      dermal: { value: p5Dermal },
      t: { value: 0 },
      ne: { value: 0.3 },
      da: { value: 0.3 },
      sleep: { value: 0 },
      glitch: { value: 0 },
      camo: { value: 0 },
      geneHue: { value: this.cr.gen.pigmentHue ?? 0.72 },
      sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) },
      sunI: { value: 1 },
      beat: { value: 0 },
      perf: { value: 0.5 },
    };

    this.skinMat = new THREE.ShaderMaterial({
      uniforms: this.skinU,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vN, vV, vW;
        void main() {
          vUv = uv;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz;
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        uniform sampler2D chroma, dermal;
        uniform float t, ne, da, sleep, glitch, camo, geneHue, sunI, beat, perf;
        uniform vec3 sunDir;
        varying vec2 vUv;
        varying vec3 vN, vV, vW;

        vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hsh(i), hsh(i + vec2(1,0)), f.x), mix(hsh(i + vec2(0,1)), hsh(i + vec2(1,1)), f.x), f.y);
        }
        vec3 thinFilm(float d, float cosI) {
          float n = 1.83;
          float sinT = sqrt(max(0.0, 1.0 - cosI * cosI)) * 1.33 / n;
          float cosT = sqrt(max(0.0, 1.0 - sinT * sinT));
          float opd = 2.0 * n * d * cosT;
          vec3 lam = vec3(650.0, 532.0, 450.0);
          return 0.5 - 0.5 * cos(6.2831853 * opd / lam + 3.14159265);
        }

        void main() {
          vec2 uv = vUv;
          vec4 c = texture2D(chroma, uv);
          vec4 p5c = texture2D(dermal, uv * vec2(3.0, 2.0));
          vec3 N = normalize(length(vN) > 1e-4 ? vN : vec3(0.0, 1.0, 0.0));
          if (!gl_FrontFacing) N = -N;
          vec3 V = normalize(length(vV) > 1e-4 ? vV : vec3(0.0, 0.0, 1.0));
          float nv = clamp(dot(N, V), 0.0, 1.0);
          vec3 L = normalize(length(sunDir) > 1e-4 ? sunDir : vec3(0.0, 1.0, 0.0));

          vec2 g = fract(uv * vec2(150.0, 68.0)) - 0.5;
          float sac = smoothstep(0.18 + 0.32 * c.r, 0.05, length(g));
          vec3 baseTint = hue(fract(geneHue + 0.12 * c.g));
          vec3 pigment = mix(baseTint * 0.95, vec3(0.65, 0.08, 0.18), c.r) * sac;

          float d = 130.0 + 260.0 * c.g + 32.0 * sin(vW.y * 3.0 + t * 0.45);
          vec3 irid = thinFilm(d, nv);
          float fres = 0.05 + 0.95 * pow(max(0.0, 1.0 - nv), 4.5);

          float vein = 1.0 - abs(vn(uv * vec2(38.0, 16.0)) * 2.0 - 1.0);
          vein = smoothstep(0.85, 0.98, vein) * (0.28 + 0.72 * beat) * perf;

          vec3 lv = L + V;
          vec3 H = length(lv) > 1e-4 ? normalize(lv) : N;
          float nh = max(dot(N, H), 0.0);
          float a2 = 0.0042;
          float D = a2 / (3.14159 * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0));
          float spec = D * fres * 0.26 * sunI;
          float trans = pow(clamp(dot(V, -L + N * 0.35), 0.0, 1.0), 3.0) * sunI;

          float band = 0.78 + 0.22 * smoothstep(0.32, 0.5, abs(fract(uv.x * 7.0) - 0.5));
          vec3 col = (pigment * 0.72 + p5c.rgb * 0.55 + irid * (0.22 + 0.68 * fres) + baseTint * fres * 0.45 * (0.5 + ne) + hue(fract(uv.x * 1.5 - t * 0.05)) * c.a * 0.32) * band;
          col += vec3(0.95, 0.12, 0.22) * vein * 0.58 + vec3(1.0, 0.48, 0.65) * trans * 0.34 + vec3(spec);
          col = mix(col, vec3(0.06, 0.09, 0.08), 0.68 * camo);
          col *= 1.0 - 0.52 * sleep;
          col += vec3(1.0, 0.1, 0.1) * glitch * step(0.5, fract(uv.x * 20.0 + t * 9.0));

          float alpha = clamp(0.32 + 0.48 * fres + 0.28 * sac * c.r + 0.22 * vein + min(spec, 0.38), 0.0, 0.93);
          gl_FragColor = vec4(col, alpha);
        }
      `,
    });
    this.skin = new THREE.Mesh(g, this.skinMat);
    this.skin.renderOrder = 10;
    this.skin.frustumCulled = false;
    this.cg.add(this.skin);

    // 2) Evo-Devo Bioluminescent Dorsal Crest-Fin Ribbon (48 stations along spine)
    this.crestN = 48;
    const cPos = new Float32Array(this.crestN * 2 * 3);
    const cCol = new Float32Array(this.crestN * 2 * 3);
    const cIdx = [];
    for (let i = 0; i < this.crestN; i++) {
      const u = i / (this.crestN - 1);
      cCol[6 * i] = 0.25; cCol[6 * i + 1] = 0.55; cCol[6 * i + 2] = 0.95;
      cCol[6 * i + 3] = 0.35 + 0.65 * Math.sin(u * Math.PI);
      cCol[6 * i + 4] = 0.95;
      cCol[6 * i + 5] = 0.85;
      if (i < this.crestN - 1) {
        const a = 2 * i;
        cIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    this.crestGeo = new THREE.BufferGeometry();
    const cNor = new Float32Array(this.crestN * 2 * 3);
    for (let i = 0; i < this.crestN * 2; i++) cNor[3 * i + 2] = 1;
    this.crestGeo.setAttribute('position', new THREE.BufferAttribute(cPos, 3));
    this.crestGeo.setAttribute('normal', new THREE.BufferAttribute(cNor, 3));
    this.crestGeo.setAttribute('color', new THREE.BufferAttribute(cCol, 3));
    this.crestGeo.setIndex(cIdx);
    this.crestMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      emissive: 0x22ccff,
      emissiveIntensity: 1.35,
      transparent: true,
      opacity: 0.78,
      roughness: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.crestMesh = new THREE.Mesh(this.crestGeo, this.crestMat);
    this.crestMesh.frustumCulled = false;
    this.crestMesh.renderOrder = 11;
    this.cg.add(this.crestMesh);

    // 3) Caudal Tail Fluke Fan (bilateral bioluminescent paddle at segment 0)
    const flukeShape = new THREE.Shape();
    flukeShape.moveTo(0, 0);
    flukeShape.quadraticCurveTo(0.28, 0.14, 0.16, -0.34);
    flukeShape.quadraticCurveTo(0, -0.18, -0.16, -0.34);
    flukeShape.quadraticCurveTo(-0.28, 0.14, 0, 0);
    const flukeGeo = new THREE.ShapeGeometry(flukeShape, 12);
    flukeGeo.rotateX(Math.PI / 2);
    this.flukeMat = new THREE.MeshStandardMaterial({
      color: 0x66ccff,
      emissive: 0x22ccff,
      emissiveIntensity: 1.15,
      transparent: true,
      opacity: 0.78,
      roughness: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.flukeMesh = new THREE.Mesh(flukeGeo, this.flukeMat);
    this.flukeMesh.renderOrder = 11;
    this.cg.add(this.flukeMesh);

    // 4) Bilateral Feathered Chemotactic Antennae (left & right 8-node sensory plumes)
    this.antNodes = 8;
    this.antennae = [0, 1].map(() => {
      const ag = new THREE.BufferGeometry();
      ag.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.antNodes * 3), 3));
      const am = new THREE.LineBasicMaterial({ color: 0x55ffdd, transparent: true, opacity: 0.9 });
      const ln = new THREE.Line(ag, am);
      ln.frustumCulled = false;
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x66ffee })
      );
      this.cg.add(ln, tip);
      return { ln, ag, am, tip };
    });

    // 5) Internal Organs (Heart, Dual Breathing Lungs, Liver, Bladder, Fat, Colon, Peristaltic ENS Gut)
    const glow = (c, i = 2) => new THREE.MeshStandardMaterial({
      color: c, emissive: c, emissiveIntensity: i, roughness: 0.35, transparent: true, opacity: 0.88,
    });
    this.heart = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), glow(0xff1144, 3));
    this.lungL = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), glow(0x44ccff, 1.3));
    this.lungR = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), glow(0x44ccff, 1.3));
    this.liver = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), glow(0x8a2be2, 1.5));
    this.bladder = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glow(0xffee55, 1.2));
    this.fatM = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(0xffe0a0, 0.6));
    this.colonM = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(0x7a4a20, 0.6));
    for (const m of [this.heart, this.lungL, this.lungR, this.liver, this.bladder, this.fatM, this.colonM]) this.cg.add(m);

    this.gutBalls = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.048, 10, 8), glow(0x33ff99, 1.2));
      this.cg.add(m);
      this.gutBalls.push(m);
    }

    // 6) Stratified 3D Spiking Brain Cloud (works seamlessly from S=436 up to MEGA=1,048,644!)
    const visIdx = [];
    if (NNEU <= 12000) {
      for (let i = 0; i < NNEU; i++) visIdx.push(i);
    } else {
      let fixed = 0, sheetTot = 0;
      for (const [, cnt] of REGIONS) { if (cnt <= 256) fixed += cnt; else sheetTot += cnt; }
      const budget = Math.max(1024, 12000 - fixed);
      for (const [name, cnt] of REGIONS) {
        const r0 = R0[name];
        if (cnt <= 256) {
          for (let k = 0; k < cnt; k++) visIdx.push(r0 + k);
        } else {
          const take = Math.max(64, Math.round((cnt / sheetTot) * budget));
          for (let k = 0; k < take; k++) visIdx.push(r0 + Math.min(cnt - 1, Math.floor(((k + 0.5) * cnt) / take)));
        }
      }
    }
    this.visNeuIdx = Uint32Array.from(visIdx);
    const NV = (this.visNeuCount = this.visNeuIdx.length);
    const bp = new Float32Array(NV * 3), bc = new Float32Array(NV * 3), bs = new Float32Array(NV);
    this.brainLocal = bp;
    const rc = new THREE.Color();
    for (let v = 0; v < NV; v++) {
      const ni = this.visNeuIdx[v];
      let ri = 0;
      for (let r = 0; r < REGIONS.length; r++) {
        const nm = REGIONS[r][0];
        if (ni >= R0[nm] && ni < R0[nm] + REGIONS[r][1]) { ri = r; break; }
      }
      rc.setHSL(ri / REGIONS.length, 0.9, 0.6);
      const a = (ri / REGIONS.length) * Math.PI * 2;
      const rr = 0.05 + 0.05 * Math.random(), th = a + (Math.random() - 0.5) * 0.7, ph = (Math.random() - 0.5) * 2.4;
      bp[3 * v] = 0.09 * Math.cos(ph) + (Math.random() - 0.5) * 0.04;
      bp[3 * v + 1] = Math.sin(ph) * rr + Math.cos(th) * 0.03;
      bp[3 * v + 2] = Math.sin(th) * rr;
      bc[3 * v] = rc.r; bc[3 * v + 1] = rc.g; bc[3 * v + 2] = rc.b;
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NV * 3), 3));
    bg.setAttribute('color', new THREE.BufferAttribute(bc, 3));
    bg.setAttribute('spk', new THREE.BufferAttribute(bs, 1));
    this.brainGeo = bg;
    this.brainPts = new THREE.Points(
      bg,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: { px: { value: 1 } },
        vertexShader: `
          attribute float spk;
          attribute vec3 color;
          varying vec3 vC;
          varying float vS;
          uniform float px;
          void main() {
            vC = color;
            vS = spk;
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            gl_PointSize = px * (2.0 + 9.0 * spk) * (3.0 / max(0.25, -mv.z));
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: `
          varying vec3 vC;
          varying float vS;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            if (d > 0.5) discard;
            gl_FragColor = vec4(vC * (0.42 + 4.0 * vS) * (1.0 - 2.0 * d), 1.0);
          }
        `,
      })
    );
    this.brainPts.frustumCulled = false;
    this.brainPts.renderOrder = 5;
    this.cg.add(this.brainPts);

    // 7) 256 3D WCSPH Blood Parcels
    this.bloodN = this.cr.fluid ? this.cr.fluid.px.length : 256;
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.bloodN * 3), 3));
    const bCols = new Float32Array(this.bloodN * 3);
    for (let i = 0; i < this.bloodN; i++) { bCols[3 * i] = 1; bCols[3 * i + 1] = 0.22; bCols[3 * i + 2] = 0.35; }
    fg.setAttribute('color', new THREE.BufferAttribute(bCols, 3));
    this.bloodMat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 0.036,
      transparent: true,
      opacity: 0.92,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.blood = new THREE.Points(fg, this.bloodMat);
    this.blood.frustumCulled = false;
    this.cg.add(this.blood);

    // 8) Articulated Iridescent Limbs + 3-Clawed Glowing Digits (18 claws) + Stalked Compound-Foveated Eyes
    const limbMat = new THREE.MeshPhysicalMaterial({
      color: 0x9a6bff,
      roughness: 0.24,
      metalness: 0.12,
      iridescence: 1,
      iridescenceIOR: 1.85,
      transmission: 0.32,
      thickness: 0.22,
      emissive: 0x220833,
      transparent: true,
      opacity: 0.88,
    });
    this.bones = [];
    const cap = new THREE.CapsuleGeometry(1, 1, 4, 10);
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(cap, limbMat);
      m.castShadow = true;
      this.cg.add(m);
      this.bones.push(m);
    }

    this.feet = [];
    this.claws = [];
    const clawGeo = new THREE.ConeGeometry(0.022, 0.11, 5);
    clawGeo.rotateX(Math.PI / 2);
    const clawMat = new THREE.MeshStandardMaterial({ color: 0xaaffee, emissive: 0x22ddcc, emissiveIntensity: 0.9, roughness: 0.2 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(1, 14, 10),
        new THREE.MeshStandardMaterial({ color: 0x40ffe0, emissive: 0x40ffe0, emissiveIntensity: 0.5, roughness: 0.3 })
      );
      this.cg.add(m);
      this.feet.push(m);
      const digitSet = [];
      for (let d = -1; d <= 1; d++) {
        const cm = new THREE.Mesh(clawGeo, clawMat);
        this.cg.add(cm);
        digitSet.push(cm);
      }
      this.claws.push(digitSet);
    }

    this.eyeU = { t: { value: 0 }, sleep: { value: 0 } };
    const eyeMat = (k) => new THREE.ShaderMaterial({
      uniforms: { ...this.eyeU, k: { value: k }, dil: { value: 0.5 } },
      vertexShader: `
        varying vec3 vP, vN, vV;
        void main() {
          vP = position;
          vec4 w = modelMatrix * vec4(position, 1.0);
          vN = normalize(mat3(modelMatrix) * normal);
          vV = normalize(cameraPosition - w.xyz);
          gl_Position = projectionMatrix * viewMatrix * w;
        }
      `,
      fragmentShader: `
        uniform float t, sleep, k, dil;
        varying vec3 vP, vN, vV;
        vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main() {
          vec3 p = normalize(vP);
          float r = acos(clamp(p.z, -1.0, 1.0));
          float a = atan(p.y, p.x);
          vec3 sclera = vec3(0.95, 0.92, 1.0) * 0.62 + hue(fract(r * 0.8 + t * 0.03 + k * 0.3)) * 0.25;
          float iris = smoothstep(0.96, 0.84, r);
          float rays = 0.5 + 0.5 * sin(a * 17.0 + r * 34.0 - t * 2.0 * (k + 0.5));
          vec3 irisC = hue(fract(0.55 + 0.2 * k + 0.15 * rays + r * 0.5)) * (0.85 + 1.65 * rays);
          float pup = 0.0;
          for (int i = 0; i < 3; i++) {
            float aa = a + float(i) * 2.094 + t * 0.2 * (k + 1.0);
            vec2 q = vec2(cos(aa), sin(aa)) * r;
            pup = max(pup, smoothstep(0.08 + 0.12 * dil, 0.035, abs(q.x)) * step(r, 0.14 + 0.48 * dil));
          }
          // High-acuity foveal gold ring
          float fovRing = smoothstep(0.04, 0.0, abs(r - (0.18 + 0.35 * dil)));
          vec3 col = mix(sclera, irisC + vec3(1.0, 0.85, 0.3) * fovRing * 0.6, iris);
          col = mix(col, vec3(0.01, 0.0, 0.03), pup);
          float lid = smoothstep(0.0, 0.2, abs(p.y) - (1.0 - sleep) * 1.2 + 0.2);
          col = mix(col, vec3(0.22, 0.06, 0.28), sleep * lid);
          float fres = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0), 2.5);
          col += vec3(0.65, 0.92, 1.0) * fres * 0.85;
          gl_FragColor = vec4(col * 1.3, 1.0);
        }
      `,
    });
    const eyeSz = this.cr.gen.eyeSize ?? 1.0;
    this.eyes = [];
    for (let e = 0; e < 3; e++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry((e === 2 ? 0.07 : 0.105) * eyeSz, 32, 24), eyeMat(e));
      this.cg.add(m);
      this.eyes.push(m);
    }

    this.goalMark = new THREE.Mesh(
      new THREE.RingGeometry(0.58, 0.72, 48),
      new THREE.MeshBasicMaterial({ color: 0xff40ff, transparent: true, opacity: 0.75, side: THREE.DoubleSide })
    );
    this.goalMark.rotation.x = -Math.PI / 2;
    S.add(this.goalMark);
  }

  buildWeather() {
    const n = 1800;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[3 * i] = (Math.random() - 0.5) * 44;
      p[3 * i + 1] = Math.random() * 14;
      p[3 * i + 2] = (Math.random() - 0.5) * 44;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.spores = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0x9fffe0,
        size: 0.04,
        transparent: true,
        opacity: 0.65,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(this.spores);
  }

  // ------------------------------------------------------------------ Per-Frame Update
  update(dtReal) {
    const cr = this.cr, B = cr.body, W = cr.world, nm = cr.brain.nm;
    this.clock += dtReal;
    const t = this.clock;
    const X = B.x, Y = B.y, Z = B.z;

    if (Math.floor(W.t / 2) !== this._tt) {
      this._tt = Math.floor(W.t / 2);
      this.updateTerrain();
    }
    this.syncProps();
    this.syncEcosystem(t);

    if (this.terrainU) {
      this.terrainU.uT.value = t;
      if (this.p5Layer && !this.terrainU.uBioTex.value) {
        this.terrainU.uBioTex.value = this.p5Layer.bioTex;
        this.terrainU.uHasBio.value = 1.0;
      }
    }

    const day = cr.light;
    this.skyU.day.value = day;
    this.skyU.t.value = t;
    this.skyU.season.value = W.seasonPhase || 0;
    this.hemi.intensity = 0.28 + 0.82 * day;
    this.sun.intensity = 0.22 + 2.45 * day;
    this.scene.fog.color.setRGB(0.02 + 0.05 * day, 0.02 + 0.05 * day, 0.05 + 0.09 * day);

    if (this.grassU) {
      this.grassU.uTime.value = t;
      this.grassU.uWind.value.set(W.wind.x, W.wind.z);
      this.grassU.uNightGlow.value = 1 - day * 0.78;
    }

    // Update rising hydrothermal vent steam/ember plumes
    if (this.ventPlumes && W.vents && W.vents.length > 0) {
      const vp = this.ventPlumes.geometry.attributes.position.array;
      for (let i = 0; i < this.ventPlumeN; i++) {
        let lf = (this._ventLife[i] += dtReal * (0.28 + 0.14 * (i % 3)));
        if (lf > 1) lf -= 1;
        this._ventLife[i] = lf;
        const v = W.vents[i % W.vents.length];
        const swirl = t * 1.8 + i * 1.7;
        const spread = 0.18 + lf * 0.95;
        vp[3 * i] = v.x + Math.cos(swirl) * spread + W.wind.x * lf * 0.7;
        vp[3 * i + 1] = v.y + 0.5 + lf * 4.4 * v.heat;
        vp[3 * i + 2] = v.z + Math.sin(swirl) * spread + W.wind.z * lf * 0.7;
      }
      this.ventPlumes.geometry.attributes.position.needsUpdate = true;
    }

    // 1) Catmull-Rom 72x36 Dermal Tube + Dorsal Crest-Fin + Caudal Tail Fluke
    const F = B.F;
    const pos = this.skinGeo.attributes.position.array;
    const nor = this.skinGeo.attributes.normal.array;
    const cen = (i) => B.c[Math.max(0, Math.min(NS - 1, i))];
    const P = (i) => [X[cen(i)], Y[cen(i)], Z[cen(i)]];
    const tmp = [0, 0, 0];
    const crestArr = this.crestGeo.attributes.position.array;
    const crestH = 0.24 * (cr.gen.crestFin ?? 0.55);

    for (let s = 0; s < RING_S; s++) {
      const f = (s / (RING_S - 1)) * (NS - 1 + 0.9) - 0.45;
      const i = Math.max(0, Math.min(NS - 2, Math.floor(f)));
      const tt = f - i;
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < 3; k++) {
        const a = p0[k], b = p1[k], c = p2[k], d = p3[k];
        tmp[k] = 0.5 * (2 * b + (-a + c) * tt + (2 * a - 5 * b + 4 * c - d) * tt * tt + (-a + 3 * b - 3 * c + d) * tt * tt * tt);
      }
      const si = Math.max(0, Math.min(NS - 1, Math.round(f)));
      const fr = F[si];
      const rg = B.ring[si], c0 = B.c[si];
      const rad = (j) => Math.hypot(X[rg[j]] - X[c0], Y[rg[j]] - Y[c0], Z[rg[j]] - Z[c0]);
      const ru = (rad(0) + rad(2)) / 2, rs = (rad(1) + rad(3)) / 2;
      const end = s / (RING_S - 1);
      const taper = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, end * 1.02))))) * (1 + 0.25 * Math.max(0, end - 0.75) * 4 * (1 - end) * 4);

      for (let m = 0; m <= RING_M; m++) {
        const th = (m / RING_M) * Math.PI * 2;
        const ct = Math.cos(th), st = Math.sin(th);
        const bump = 1 + 0.055 * Math.sin(th * 6 + s * 0.65 + t * 0.8) * (0.5 + nm.ACh) + 0.045 * Math.sin(s * 1.8 - t * 3 * (0.3 + nm.NE));
        const nx = st * fr.s[0] + ct * fr.u[0], ny = st * fr.s[1] + ct * fr.u[1], nz = st * fr.s[2] + ct * fr.u[2];
        const o = 3 * (s * (RING_M + 1) + m);
        const r1 = taper * bump * 1.18;
        pos[o] = tmp[0] + (st * rs * fr.s[0] + ct * ru * fr.u[0]) * r1;
        pos[o + 1] = tmp[1] + (st * rs * fr.s[1] + ct * ru * fr.u[1]) * r1;
        pos[o + 2] = tmp[2] + (st * rs * fr.s[2] + ct * ru * fr.u[2]) * r1;
        nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz;
      }
    }

    // Update dorsal crest-fin ribbon along spine [0.10 .. 0.88]
    for (let k = 0; k < this.crestN; k++) {
      const u = k / (this.crestN - 1);
      const sIdx = Math.min(RING_S - 1, Math.floor((0.08 + u * 0.80) * (RING_S - 1)));
      const topVert = 3 * (sIdx * (RING_M + 1) + 0); // m=0 is dorsal (ct=1, st=0 -> +fr.u)
      const si = Math.max(0, Math.min(NS - 1, Math.round(u * (NS - 1))));
      const fr = F[si];
      const prof = Math.sin(u * Math.PI) * (0.7 + 0.3 * Math.sin(u * 14 - t * 5));
      const sway = 0.04 * Math.sin(t * 6.5 - u * 9.0) * crestH;
      const bx = pos[topVert], by = pos[topVert + 1], bz = pos[topVert + 2];
      crestArr[6 * k] = bx;
      crestArr[6 * k + 1] = by;
      crestArr[6 * k + 2] = bz;
      crestArr[6 * k + 3] = bx + fr.u[0] * crestH * prof + fr.s[0] * sway;
      crestArr[6 * k + 4] = by + fr.u[1] * crestH * prof + fr.s[1] * sway;
      crestArr[6 * k + 5] = bz + fr.u[2] * crestH * prof + fr.s[2] * sway;
    }
    this.crestGeo.attributes.position.needsUpdate = true;
    this.crestMat.emissive.setHSL(((cr.gen.pigmentHue ?? 0.72) + 0.16) % 1, 0.9, 0.45);
    this.crestMat.emissiveIntensity = (0.9 + 1.4 * (cr.vocalAmp || 0) + 0.8 * nm.DA) * (1 - 0.65 * (cr.camoLevel || 0));
    if (this.flukeMat) {
      this.flukeMat.emissive.copy(this.crestMat.emissive);
      this.flukeMat.emissiveIntensity = this.crestMat.emissiveIntensity * 0.9;
    }

    // Caudal tail fluke at segment 0
    const t0 = B.c[0], tf0 = F[0];
    this.flukeMesh.position.set(X[t0] - tf0.f[0] * 0.14, Y[t0] - tf0.f[1] * 0.14, Z[t0] - tf0.f[2] * 0.14);
    const flukeScl = 0.45 + 1.15 * (cr.gen.tailFluke ?? 0.45);
    this.flukeMesh.scale.set(flukeScl, flukeScl, flukeScl);
    this.flukeMesh.lookAt(X[t0] + tf0.f[0], Y[t0] + tf0.f[1], Z[t0] + tf0.f[2]);

    // Bilateral feathered chemotactic antennae on head (NS - 1)
    const hc = B.c[NS - 1], hf = F[NS - 1];
    for (let side = 0; side < 2; side++) {
      const ant = this.antennae[side];
      const sgn = side === 0 ? -1 : 1;
      const arr = ant.ag.attributes.position.array;
      for (let j = 0; j < this.antNodes; j++) {
        const u = j / (this.antNodes - 1);
        const sweep = 0.12 * Math.sin(t * 7.5 + side * 2.2 - u * 2.5);
        const fwd = 0.18 + u * 0.42;
        const lat = sgn * (0.09 + u * 0.24) + sweep * u;
        const up = 0.11 + u * 0.18 - u * u * 0.08;
        arr[3 * j] = X[hc] + hf.f[0] * fwd + hf.s[0] * lat + hf.u[0] * up;
        arr[3 * j + 1] = Y[hc] + hf.f[1] * fwd + hf.s[1] * lat + hf.u[1] * up;
        arr[3 * j + 2] = Z[hc] + hf.f[2] * fwd + hf.s[2] * lat + hf.u[2] * up;
      }
      ant.ag.attributes.position.needsUpdate = true;
      const ti = (this.antNodes - 1) * 3;
      ant.tip.position.set(arr[ti], arr[ti + 1], arr[ti + 2]);
      if ((cr.pherAlarm || 0) > 0.15) ant.am.color.setHex(0xff3355);
      else if ((cr.pherFood || 0) > 0.1) ant.am.color.setHex(0x44ff99);
      else ant.am.color.setHex(0x55eeff);
      ant.tip.material.color.copy(ant.am.color);
    }

    this.skinGeo.attributes.position.needsUpdate = true;
    this.skinGeo.attributes.normal.needsUpdate = true;
    this.chromaTex.needsUpdate = true;
    const stg = cr.sleep.stage;
    this.skinU.t.value = t;
    this.skinU.ne.value = nm.NE;
    this.skinU.da.value = nm.DA;
    this.skinU.camo.value = cr.camoLevel || 0;
    this.skinU.geneHue.value = cr.gen.pigmentHue ?? 0.72;
    this.skinU.sleep.value = stg >= 2 ? 1 : stg === 1 ? 0.4 : 0;
    this.skinU.glitch.value = Math.max(0, (this.skinU.glitch.value || 0) * 0.92);

    // 2) Internal Organs + Dual Breathing Lungs
    const M = cr.metab;
    const at = (seg, du, ds, df, obj, sc) => {
      const c = B.c[seg], fr = F[seg];
      obj.position.set(
        X[c] + fr.u[0] * du + fr.s[0] * ds + fr.f[0] * df,
        Y[c] + fr.u[1] * du + fr.s[1] * ds + fr.f[1] * df,
        Z[c] + fr.u[2] * du + fr.s[2] * ds + fr.f[2] * df
      );
      obj.scale.setScalar(sc);
    };
    this.heartPh += dtReal * (M.hr / 60) * (cr.speed || 1);
    const beat = Math.pow(Math.max(0, Math.sin(this.heartPh * Math.PI * 2)), 6);
    const breath = 0.5 + 0.5 * Math.sin(t * 2.2);
    this.skinU.beat.value = beat;
    const flPerf = cr.fluid ? Math.min(1, 0.25 + (cr.fluid.cardiacOutput / 38) * 0.45 + cr.fluid.meanO2 * 0.3) : 0.6;
    this.skinU.perf.value = flPerf;
    this.skinU.sunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize();
    this.skinU.sunI.value = this.sun.intensity / 2.6;

    at(4, 0.05, 0, 0, this.heart, 1 + 0.45 * beat);
    this.heart.material.emissiveIntensity = 1.5 + 4 * beat;
    at(4, 0.03, -0.075, 0.05, this.lungL, 0.75 + 0.32 * breath);
    at(4, 0.03, 0.075, 0.05, this.lungR, 0.75 + 0.32 * breath);
    at(3, -0.02, 0.06, 0, this.liver, 0.7 + M.liverGly / 40);
    this.liver.material.emissive.setHSL(0.75 - 0.25 * Math.min(1, M.liverGly / 40), 0.9, 0.45);
    at(1, -0.06, 0, -0.05, this.bladder, 0.6 + 1.6 * M.bladder);
    at(0, 0, 0, 0.1, this.colonM, 0.5 + 1.2 * M.colon);
    at(2, 0.06, -0.05, 0, this.fatM, 0.6 + M.fat / 400);

    const gutFill = M.gut.glc + M.gut.fat + M.gut.prot;
    const ensR = cr.brain.rate;
    this.gutBalls.forEach((g, i) => {
      const f = 1 + (i / 9) * 3.6;
      const seg = Math.floor(f), tt2 = f - seg;
      const ens = (ensR ? ensR[R0.ENS + i * 4] || 0 : 0) / 40;
      const sc = 0.5 + 0.35 * Math.min(2, gutFill / 3) + 0.5 * ens;
      at(seg, -0.05 + 0.03 * Math.sin(i + t * 2 * M.motility), 0, tt2 * 0.4, g, sc);
      g.material.emissiveIntensity = 0.6 + 2.5 * ens;
    });

    // 3) Brain Cloud
    const bp = this.brainGeo.attributes.position.array;
    const spk = this.brainGeo.attributes.spk.array;
    const L = this.brainLocal;
    const tb = cr.brain.t;
    const NV = this.visNeuCount, vIdx = this.visNeuIdx;
    const hasSpk = cr.brain.lastSpike && cr.brain.lastSpike.length >= NNEU;
    for (let v = 0; v < NV; v++) {
      const ni = vIdx[v], a = L[3 * v], b = L[3 * v + 1], c = L[3 * v + 2];
      bp[3 * v] = X[hc] + hf.f[0] * a + hf.u[0] * b + hf.s[0] * c;
      bp[3 * v + 1] = Y[hc] + hf.f[1] * a + hf.u[1] * b + hf.s[1] * c;
      bp[3 * v + 2] = Z[hc] + hf.f[2] * a + hf.u[2] * b + hf.s[2] * c;
      const ls = hasSpk ? cr.brain.lastSpike[ni] : -1;
      spk[v] = ls < 0 ? 0 : Math.exp(-(tb - ls) / 0.08);
    }
    this.brainGeo.attributes.position.needsUpdate = true;
    this.brainGeo.attributes.spk.needsUpdate = true;
    this.brainPts.material.uniforms.px.value = this.renderer.getPixelRatio() * (this.renderer.domElement.height / 800);

    // 4) 256 3D WCSPH Blood Parcels
    if (cr.fluid) {
      const bpos = this.blood.geometry.attributes.position.array;
      const bcol = this.blood.geometry.attributes.color.array;
      const FL = cr.fluid, nB = Math.min(this.bloodN, FL.px.length);
      for (let i = 0; i < nB; i++) {
        bpos[3 * i] = FL.px[i]; bpos[3 * i + 1] = FL.py[i]; bpos[3 * i + 2] = FL.pz[i];
        const o2 = Math.max(0, Math.min(1, (FL.pO2[i] - 0.55) / 0.43));
        const gl = Math.max(0, Math.min(1.3, FL.pGlc[i]));
        bcol[3 * i] = 0.42 + 0.58 * o2;
        bcol[3 * i + 1] = 0.06 + 0.24 * o2 * gl;
        bcol[3 * i + 2] = 0.72 - 0.46 * o2;
      }
      this.blood.geometry.attributes.position.needsUpdate = true;
      this.blood.geometry.attributes.color.needsUpdate = true;
    }

    // 5) Limbs + 3-Clawed Glowing Digits + Eye Stalks
    let bi = 0;
    const bone = (a, b, r) => {
      const m = this.bones[bi++];
      m.visible = true;
      const ax = X[a], ay = Y[a], az = Z[a], dx = X[b] - ax, dy = Y[b] - ay, dz = Z[b] - az;
      const len = Math.hypot(dx, dy, dz) || 1e-3;
      m.position.set(ax + dx / 2, ay + dy / 2, az + dz / 2);
      m.scale.set(r, Math.max(0.001, len / 2 - r), r);
      m.quaternion.setFromUnitVectors(this._upVec, this._tmpV1.set(dx / len, dy / len, dz / len));
    };
    B.limbs.forEach((Lb, k) => {
      const r = Lb.kind === 'arm' ? 0.045 : 0.052;
      bone(Lb.hip, Lb.knee, r);
      bone(Lb.knee, Lb.foot, r * 0.8);
      const f = this.feet[k];
      const fx = X[Lb.foot], fy = Y[Lb.foot], fz = Z[Lb.foot];
      f.position.set(fx, fy, fz);
      const gp = B.gripP[Lb.foot] || 0;
      f.scale.setScalar(0.058 + 0.028 * gp);
      f.material.emissiveIntensity = 0.35 + 3.0 * gp;

      // Orient 3 claws forward from knee->foot direction
      const kx = X[Lb.knee], kz = Z[Lb.knee];
      let dirX = fx - kx, dirZ = fz - kz;
      const dn = Math.hypot(dirX, dirZ) || 1;
      dirX /= dn; dirZ /= dn;
      const latX = -dirZ, latZ = dirX;
      const digitSet = this.claws[k];
      for (let d = -1; d <= 1; d++) {
        const cm = digitSet[d + 1];
        const angOff = d * 0.42;
        const cx = dirX * Math.cos(angOff) + latX * Math.sin(angOff);
        const cz = dirZ * Math.cos(angOff) + latZ * Math.sin(angOff);
        cm.position.set(fx + cx * 0.06, fy - 0.015 * gp, fz + cz * 0.06);
        cm.lookAt(fx + cx * 0.3, fy - (0.04 + 0.12 * gp), fz + cz * 0.3);
      }
    });
    for (const st of B.stalks) {
      bone(st.base, st.mid, 0.025);
      bone(st.mid, st.eye, 0.02);
    }
    while (bi < this.bones.length) this.bones[bi++].visible = false;

    // 6) Eyes & Live Neural Gaze Vector
    const gz = (e) => [B.u[CH.gaze + 2 * e], B.u[CH.gaze + 2 * e + 1]];
    const dil = Math.min(1, 0.2 + 0.8 * nm.NE);
    let mainGazeDir = null;
    for (let e = 0; e < 3; e++) {
      const m = this.eyes[e];
      if (e < 2) {
        const p = B.stalks[e].eye;
        m.position.set(X[p], Y[p], Z[p]);
      } else {
        m.position.set(X[hc] + hf.f[0] * 0.33 + hf.u[0] * 0.08, Y[hc] + hf.f[1] * 0.33 + hf.u[1] * 0.08, Z[hc] + hf.f[2] * 0.33 + hf.u[2] * 0.08);
      }
      const [yw, pt] = gz(e);
      const d = new THREE.Vector3(hf.f[0], hf.f[1], hf.f[2])
        .applyAxisAngle(new THREE.Vector3(hf.u[0], hf.u[1], hf.u[2]), -yw * 1.2)
        .applyAxisAngle(new THREE.Vector3(hf.s[0], hf.s[1], hf.s[2]), pt * 0.8)
        .normalize();
      if (e === 2) mainGazeDir = d;
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
      m.material.uniforms.dil.value = dil;
    }
    this.eyeU.t.value = t;
    this.eyeU.sleep.value = stg >= 2 ? 1 : stg === 1 ? 0.5 : 0;

    // 7) World Flora, Snacks, Waste & Goal Ring
    W.plants.forEach((Pl, i) => {
      const pm = this.plantMeshes[i];
      const cScale = Pl.crownScale ?? 1.0;
      pm.crown.scale.setScalar(cScale);
      pm.fruit.scale.setScalar(0.32 + 0.72 * Pl.fruit);
      pm.fm.emissiveIntensity = 0.35 + 2.3 * Pl.fruit;
      pm.fruit.rotation.y = t * 0.55 + i;
      pm.g.position.y = Pl.y;
      const gl = cr.goal && cr.goal.type === 'site' && cr.goal.k === i;
      pm.ring.material.opacity = gl ? 0.92 : 0;
    });

    const live = new Set();
    for (const s of W.snacks) {
      live.add(s.id);
      let m = this.snackMeshes.get(s.id);
      if (!m) {
        m = new THREE.Mesh(
          this.snackGeo,
          new THREE.MeshStandardMaterial({
            color: s.kind === 'fat' ? 0xffcc66 : 0xff66cc,
            emissive: s.kind === 'fat' ? 0xffaa33 : 0xff33aa,
            emissiveIntensity: 2.5,
          })
        );
        this.scene.add(m);
        this.snackMeshes.set(s.id, m);
      }
      m.position.set(s.x, s.y, s.z);
      m.rotation.y = t * 1.4;
    }
    for (const [id, m] of this.snackMeshes) {
      if (!live.has(id)) {
        this.scene.remove(m);
        this.snackMeshes.delete(id);
      }
    }

    while (this.wasteMeshes.length < W.waste.length) {
      const m = new THREE.Mesh(this.wasteGeo, new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9, transparent: true }));
      this.scene.add(m);
      this.wasteMeshes.push(m);
    }
    this.wasteMeshes.forEach((m, i) => {
      const w = W.waste[i];
      if (!w) { m.visible = false; return; }
      m.visible = true;
      m.position.set(w.x, W.height(w.x, w.z) + 0.03, w.z);
      if (w.type === 'urine') {
        m.material.color.set(0xddcc22);
        m.scale.set(0.9 * w.amount, 0.05, 0.9 * w.amount);
        m.material.opacity = 0.6 * (1 - w.age / 120);
      } else {
        m.material.color.set(0x553311);
        m.scale.setScalar(0.7 + 0.3 * w.amount);
        m.material.opacity = 1 - w.age / 120;
      }
    });

    const tg = cr.target();
    if (tg) {
      this.goalMark.visible = true;
      this.goalMark.position.set(tg[0], W.height(tg[0], tg[2]) + 0.05, tg[2]);
      this.goalMark.rotation.z = t;
    } else {
      this.goalMark.visible = false;
    }

    // 8) Wind-Drifted Spores & Rain
    const sp = this.spores.geometry.attributes.position.array;
    const n = this.rainN;
    this.spores.geometry.setDrawRange(0, n);
    for (let i = 0; i < n; i++) {
      sp[3 * i] += W.wind.x * dtReal * 0.65 + Math.sin(t + i) * 0.003;
      sp[3 * i + 2] += W.wind.z * dtReal * 0.65;
      sp[3 * i + 1] -= dtReal * (0.2 + 5 * W.wind.rain * (i % 3 === 0 ? 1 : 0));
      if (sp[3 * i + 1] < -2 || Math.abs(sp[3 * i]) > 22 || Math.abs(sp[3 * i + 2]) > 22) {
        sp[3 * i] = (Math.random() - 0.5) * 44;
        sp[3 * i + 1] = 8 + Math.random() * 6;
        sp[3 * i + 2] = (Math.random() - 0.5) * 44;
      }
    }
    this.spores.geometry.attributes.position.needsUpdate = true;

    // 9) Lighting & 4 Camera Modes (Orbit Follow, Creature Eye POV, Auto-Director, Biosphere Overhead)
    const com = B.com();
    this.rim.position.set(com[0], com[1] + 1.5, com[2]);
    this.rim.intensity = 3 + 6 * nm.NE;
    this.sun.target.position.set(com[0], com[1], com[2]);
    const sunAz = 0.8 + (cr.hour / 24) * Math.PI * 2;
    const sunElev = Math.max(2.5, 6 + 15 * day);
    this.sun.position.set(com[0] + Math.cos(sunAz) * 14, com[1] + sunElev, com[2] + Math.sin(sunAz) * 14);
    this.skyU.sunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize();

    if (this.cameraMode === 'pov') {
      // First-Person Creature Eye POV perched between binocular eye stalks looking along neural gaze!
      const eL = B.stalks[0].eye, eR = B.stalks[1].eye;
      const ex = 0.5 * (X[eL] + X[eR]) + hf.f[0] * 0.16 + hf.u[0] * 0.06;
      const ey = 0.5 * (Y[eL] + Y[eR]) + hf.f[1] * 0.16 + hf.u[1] * 0.06;
      const ez = 0.5 * (Z[eL] + Z[eR]) + hf.f[2] * 0.16 + hf.u[2] * 0.06;
      this.camera.position.lerp(this._tmpV1.set(ex, Math.max(W.height(ex, ez) + 0.18, ey), ez), 0.35);
      const gDir = mainGazeDir || this._tmpV2.set(hf.f[0], hf.f[1], hf.f[2]);
      this._povLook.lerp(this._tmpV2.set(ex + gDir.x * 6, ey + gDir.y * 6, ez + gDir.z * 6), 0.25);
      this.camera.lookAt(this._povLook);
    } else if (this.cameraMode === 'director') {
      // Smooth low-angle heroic cinema sweep around focal creature & nearby action
      this._dirAngle += dtReal * 0.22;
      const rad = 3.8 + 1.4 * Math.sin(t * 0.31);
      const hOff = 1.45 + 0.75 * (0.5 + 0.5 * Math.cos(t * 0.23));
      const tx = com[0] + Math.cos(this._dirAngle) * rad;
      const tz = com[2] + Math.sin(this._dirAngle) * rad;
      const ty = Math.max(W.height(tx, tz) + 0.45, com[1] + hOff);
      this.camera.position.lerp(this._tmpV1.set(tx, ty, tz), 0.06);
      this.camera.lookAt(com[0], com[1] + 0.22, com[2]);
    } else if (this.cameraMode === 'overhead') {
      this.controls.update();
    } else {
      if (this.follow) {
        const tgt = this.controls.target;
        const k = this.reduced ? 0.03 : 0.085;
        const dx = (com[0] - tgt.x) * k, dy = (com[1] - tgt.y) * k, dz = (com[2] - tgt.z) * k;
        tgt.x += dx; tgt.y += dy; tgt.z += dz;
        this.camera.position.x += dx; this.camera.position.y += dy; this.camera.position.z += dz;
      }
      this.controls.update();
    }

    // Project sun direction to screen UV for crepuscular god-ray scattering
    const sunWorld = this._tmpV1.copy(this.camera.position).addScaledVector(this.skyU.sunDir.value, 100);
    sunWorld.project(this.camera);
    this.aoPass.uniforms.uSunScreen.value.set(sunWorld.x * 0.5 + 0.5, sunWorld.y * 0.5 + 0.5);
    this.aoPass.uniforms.uGodRay.value = sunWorld.z < 1 ? 0.18 * day : 0.0;

    if (this.bloom.enabled) this.composer.render();
    else this.renderer.render(this.scene, this.camera);
  }

  pick(ndcX, ndcY) {
    const rc = new THREE.Raycaster();
    rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera);
    const B = this.cr.body;
    let best = -1, bd = 0.38;
    for (let i = 0; i < B.n; i++) {
      const p = new THREE.Vector3(B.x[i], B.y[i], B.z[i]);
      const d = rc.ray.distanceToPoint(p);
      if (d < bd) { bd = d; best = i; }
    }
    const hit = rc.intersectObject(this.terrain)[0];
    return { particle: best, point: hit ? hit.point : null, dir: rc.ray.direction };
  }
}
