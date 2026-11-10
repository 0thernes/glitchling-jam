// three.js view of the simulation. Rendering only READS simulation state: particle positions, neuron spikes, muscle
// channels, metabolic pools and the chromatophore sheet. Nothing here moves the creature.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { NS, CH } from './sim/body.js';
import { REGIONS, R0, RN, NNEU } from './sim/brain.js';
import { SW, SH } from './sim/skin.js';
const HUES = [0x39ff9e, 0xff3df0, 0x3df7ff, 0xffb02e];
const RING_M = 28, RING_S = 56;
export class View {
  constructor(canvas, cr, opts = {}) {
    this.cr = cr; this.reduced = !!opts.reduced; const R = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false }));
    R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.0; R.outputColorSpace = THREE.SRGBColorSpace; R.shadowMap.enabled = false; R.shadowMap.type = THREE.PCFSoftShadowMap;
    const S = (this.scene = new THREE.Scene()); S.fog = new THREE.FogExp2(0x05040c, 0.022);
    const cam = (this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 300)); cam.position.set(3.2, 2.6, 3.8);
    this.controls = new OrbitControls(cam, canvas); this.controls.enableDamping = true; this.controls.maxPolarAngle = Math.PI * 0.49; this.controls.minDistance = 1.5; this.controls.maxDistance = 45; this.follow = true;
    this.hemi = new THREE.HemisphereLight(0x9fd8ff, 0x201008, 0.9); S.add(this.hemi); this.sun = new THREE.DirectionalLight(0xfff0dd, 2.2); this.sun.position.set(10, 18, 6); this.sun.castShadow = true; this.sun.shadow.mapSize.set(1024, 1024); const sc = this.sun.shadow.camera; sc.left = sc.bottom = -12; sc.right = sc.top = 12; S.add(this.sun); S.add(this.sun.target);
    this.rim = new THREE.PointLight(0xff40ff, 6, 8, 1.5); S.add(this.rim);
    this.buildSky(); this.buildTerrain(); this.buildProps(); this.buildCreature(); this.buildWeather();
    this.composer = new EffectComposer(R); this.composer.addPass(new RenderPass(S, cam)); this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.85, 0.55, 0.82); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.quality = 1; this.setQuality(opts.quality ?? 1); this.clock = 0; this.heartPh = 0;
  }
  setQuality(q) { this.quality = q; const dpr = Math.min(window.devicePixelRatio || 1, 2); this.pr = [0.55, 0.85, 1, dpr][q] ?? 1; this.bloom.enabled = q >= 1; this.renderer.shadowMap.enabled = q >= 3; this.sun.castShadow = q >= 3; this.rainN = [150, 500, 1000, 1600][q]; this.resize(); }
  resize() { const c = this.renderer.domElement, w = c.clientWidth || 300, h = c.clientHeight || 300; this.renderer.setPixelRatio(this.pr); this.renderer.setSize(w, h, false); this.composer.setPixelRatio(this.pr); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
  buildSky() { const g = new THREE.SphereGeometry(150, 32, 16); this.skyU = { day: { value: 1 }, t: { value: 0 } };
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU, vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float day; uniform float t; varying vec3 vP; float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }
      void main(){ float y = vP.y; vec3 nightA = vec3(0.01,0.0,0.03), nightB = vec3(0.05,0.0,0.09); vec3 dayA = vec3(0.25,0.35,0.6), dayB = vec3(0.9,0.5,0.7);
        vec3 c = mix(mix(nightB, nightA, smoothstep(-0.1,0.6,y)), mix(dayB, dayA, smoothstep(-0.1,0.5,y)), day);
        float aur = smoothstep(0.1,0.6,y) * (0.5+0.5*sin(vP.x*9.0 + t*0.3 + sin(vP.z*7.0 + t*0.2)*2.0)); c += vec3(0.1,0.9,0.6) * aur * 0.25 * (1.0-day*0.7);
        vec3 q = floor(vP*220.0); float s = step(0.997, h(q)) * (1.0-day) * smoothstep(0.0,0.3,y); c += vec3(s)*2.5; gl_FragColor = vec4(c,1.0); }` });
    this.sky = new THREE.Mesh(g, m); this.scene.add(this.sky); }
  buildTerrain() { const N = 150, g = new THREE.PlaneGeometry(46, 46, N, N); g.rotateX(-Math.PI / 2); const col = new Float32Array(g.attributes.position.count * 3); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); this.tGeo = g;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0.05 });
    mat.onBeforeCompile = (sh) => { sh.uniforms.uT = this.terrainT = { value: 0 }; sh.vertexShader = 'varying vec3 vW;\n' + sh.vertexShader.replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\n vW = (modelMatrix*vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = 'uniform float uT; varying vec3 vW;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float vein = smoothstep(0.92, 1.0, sin(vW.x*1.3 + sin(vW.z*0.9 + uT*0.2)*2.0) * sin(vW.z*1.1 + uT*0.15));
        totalEmissiveRadiance += vec3(0.1,0.9,1.2) * vein * (0.4 + 0.3*sin(uT*1.5 + vW.x));`); };
    this.terrain = new THREE.Mesh(g, mat); this.terrain.receiveShadow = true; this.scene.add(this.terrain); this.updateTerrain(); }
  updateTerrain() { const W = this.cr.world, p = this.tGeo.attributes.position, c = this.tGeo.attributes.color; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), h = W.height(x, z); p.setY(i, h); const t = Math.max(0, Math.min(1, (h + 1.5) / 3.5));
      c.setXYZ(i, 0.05 + 0.25 * t + 0.08 * Math.sin(x * 0.7), 0.04 + 0.12 * (1 - t) + 0.1 * t, 0.12 + 0.2 * (1 - t)); } p.needsUpdate = true; c.needsUpdate = true; this.tGeo.computeVertexNormals(); }
  buildProps() { const S = this.scene, W = this.cr.world; this.props = new THREE.Group(); S.add(this.props);
    this.rockMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2440, roughness: 0.55, metalness: 0.2, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 900], flatShading: true });
    this.rockMeshes = []; this.springMeshes = []; this.plantMeshes = []; this.snackMeshes = new Map(); this.wasteMeshes = [];
    const shapes = [new THREE.SphereGeometry(0.28, 20, 14), new THREE.BoxGeometry(0.4, 0.4, 0.4), new THREE.ConeGeometry(0.28, 0.55, 18), new THREE.OctahedronGeometry(0.34, 0)];
    for (const P of W.plants) { const g = new THREE.Group(); const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.2, 8), new THREE.MeshStandardMaterial({ color: 0x1b3b2a, roughness: 0.7 })); stem.position.y = 0.6; g.add(stem);
      const fm = new THREE.MeshStandardMaterial({ color: HUES[P.c], emissive: HUES[P.c], emissiveIntensity: 1.5, roughness: 0.3 }); const fruit = new THREE.Mesh(shapes[P.s], fm); fruit.position.y = 1.35; g.add(fruit);
      if (P.s === 3) for (let k = 0; k < 6; k++) { const th = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0x550000 })); th.position.set(Math.cos(k) * 0.25, 1.35 + Math.sin(k * 2) * 0.2, Math.sin(k) * 0.25); th.lookAt(0, 1.35, 0); th.rotateX(-Math.PI / 2); g.add(th); }
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.02, 6, 40), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
      g.position.set(P.x, P.y, P.z); this.props.add(g); this.plantMeshes.push({ g, fruit, fm, ring }); }
    const coil = new THREE.TorusKnotGeometry(0.7, 0.07, 120, 8, 2, 7); this.springGeo = coil; this.springMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0x553300, metalness: 0.8, roughness: 0.25 });
    this.snackGeo = new THREE.IcosahedronGeometry(0.16, 1); this.wasteGeo = new THREE.SphereGeometry(0.12, 8, 6); this.syncProps(); }
  syncProps() { const W = this.cr.world; while (this.rockMeshes.length < W.rocks.length) { const g = new THREE.IcosahedronGeometry(1, 2); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const v = new THREE.Vector3().fromBufferAttribute(p, i); v.multiplyScalar(0.85 + 0.25 * Math.sin(v.x * 5 + v.y * 3) * Math.cos(v.z * 4)); p.setXYZ(i, v.x, v.y, v.z); } g.computeVertexNormals(); const m = new THREE.Mesh(g, this.rockMat); m.castShadow = m.receiveShadow = true; this.props.add(m); this.rockMeshes.push(m); }
    W.rocks.forEach((R, i) => { const m = this.rockMeshes[i]; m.position.set(R.x, R.y, R.z); m.scale.setScalar(R.r); }); for (let i = W.rocks.length; i < this.rockMeshes.length; i++) this.rockMeshes[i].visible = false;
    while (this.springMeshes.length < W.springs.length) { const g = new THREE.Group(); const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 32), new THREE.MeshStandardMaterial({ color: 0x40ffd0, emissive: 0x0a6050, roughness: 0.3 })); const c = new THREE.Mesh(this.springGeo, this.springMat); c.rotation.x = Math.PI / 2; c.scale.set(1, 1, 0.5); g.add(c); g.add(pad); g.userData = { pad, coil: c }; this.props.add(g); this.springMeshes.push(g); }
    W.springs.forEach((S, i) => { const g = this.springMeshes[i]; g.position.set(S.x, S.y, S.z); const h = 0.3 - S.comp * 0.4; g.userData.pad.position.y = h; g.userData.coil.position.y = h / 2; g.userData.coil.scale.z = Math.max(0.1, h); }); }
  buildCreature() { const S = this.scene; this.cg = new THREE.Group(); S.add(this.cg);
    // skin tube geometry, rebuilt from particles every frame
    const n = RING_S * (RING_M + 1); const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2), idx = [];
    for (let s = 0; s < RING_S; s++) for (let m = 0; m <= RING_M; m++) { const i = s * (RING_M + 1) + m; uv[2 * i] = s / (RING_S - 1); uv[2 * i + 1] = m / RING_M; if (s < RING_S - 1 && m < RING_M) { const a = i, b = i + RING_M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); } }
    const g = (this.skinGeo = new THREE.BufferGeometry()); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(idx);
    this.chromaTex = new THREE.DataTexture(this.cr.skin.rgba, SW, SH, THREE.RGBAFormat); this.chromaTex.wrapS = THREE.RepeatWrapping; this.chromaTex.wrapT = THREE.RepeatWrapping; this.chromaTex.magFilter = THREE.LinearFilter; this.chromaTex.needsUpdate = true;
    this.skinU = { chroma: { value: this.chromaTex }, t: { value: 0 }, ne: { value: 0.3 }, da: { value: 0.3 }, sleep: { value: 0 }, glitch: { value: 0 }, sunDir: { value: new THREE.Vector3(0.4, 0.8, 0.3) }, sunI: { value: 1 }, beat: { value: 0 }, perf: { value: 0.5 } };
    this.skinMat = new THREE.ShaderMaterial({ uniforms: this.skinU, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; varying vec3 vW; void main(){ vUv = uv; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D chroma; uniform float t, ne, da, sleep, glitch, sunI, beat, perf; uniform vec3 sunDir; varying vec2 vUv; varying vec3 vN, vV, vW;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        float hsh(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7)))*43758.5453); }
        float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f); return mix(mix(hsh(i), hsh(i+vec2(1,0)), f.x), mix(hsh(i+vec2(0,1)), hsh(i+vec2(1,1)), f.x), f.y); }
        // thin-film interference of guanine-crystal platelets (n = 1.83 in cytoplasm n = 1.33): two-beam reflectance per wavelength,
        // R(lambda) ~ 0.5 - 0.5 cos(4 pi n d cos(theta_t) / lambda + pi). Platelet thickness d (nm) is set by the neural skin channel.
        vec3 thinFilm(float d, float cosI){ float n = 1.83; float sinT = sqrt(max(0.0, 1.0 - cosI*cosI)) * 1.33 / n; float cosT = sqrt(max(0.0, 1.0 - sinT*sinT)); float opd = 2.0*n*d*cosT; vec3 lam = vec3(650.0, 532.0, 450.0); return 0.5 - 0.5*cos(6.2831853*opd/lam + 3.14159265); }
        void main(){ vec2 uv = vec2(vUv.x, vUv.y); vec4 c = texture2D(chroma, uv); vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N; vec3 V = normalize(vV); float nv = clamp(dot(N, V), 0.0, 1.0); vec3 L = normalize(sunDir);
          // chromatophores: small dark/red/yellow sacs whose expansion = c.r (from the neural excitable sheet + Turing layer)
          vec2 g = fract(uv*vec2(160.0, 70.0)) - 0.5; float sac = smoothstep(0.18 + 0.32*c.r, 0.05, length(g));
          vec3 pigment = mix(vec3(0.95,0.75,0.2), vec3(0.6,0.05,0.12), c.r) * sac;
          float d = 120.0 + 260.0*c.g + 30.0*sin(vW.y*3.0 + t*0.4); vec3 irid = thinFilm(d, nv);
          vec3 leuco = vec3(0.6,0.75,1.0) * c.b;
          float fres = 0.04 + 0.96*pow(1.0 - nv, 5.0);
          // capillaries: a vein network (ridged noise) that brightens on each heartbeat and with blood perfusion
          float vein = 1.0 - abs(vn(uv*vec2(38.0, 16.0))*2.0 - 1.0); vein = smoothstep(0.86, 0.98, vein) * (0.25 + 0.75*beat) * perf;
          // wet-skin GGX specular (roughness 0.28) and back-lit translucency through the thin body wall
          vec3 H = normalize(L + V); float nh = max(dot(N, H), 0.0); float a2 = 0.28*0.28*0.28*0.28; float D = a2 / (3.14159*pow(nh*nh*(a2-1.0)+1.0, 2.0)); float spec = D * fres * 0.25 * sunI;
          float trans = pow(clamp(dot(V, -L + N*0.35), 0.0, 1.0), 3.0) * sunI;
          float band = 0.75 + 0.25*smoothstep(0.35, 0.5, abs(fract(uv.x*7.0) - 0.5));
          vec3 col = (pigment*0.9 + irid*(0.18 + 0.7*fres) + leuco*0.22 + vec3(1.0,0.2,0.9)*fres*0.5*(0.5+ne) + hue(fract(uv.x*1.5 - t*0.05))*c.a*0.35) * band;
          col += vec3(0.9, 0.08, 0.15)*vein*0.6 + vec3(1.0, 0.45, 0.6)*trans*0.35 + vec3(spec);
          col *= 1.0 - 0.55*sleep; col += vec3(1.0,0.1,0.1)*glitch*step(0.5, fract(uv.x*20.0 + t*9.0));
          float alpha = clamp(0.28 + 0.5*fres + 0.3*sac*c.r + 0.25*vein + min(spec, 0.4), 0.0, 0.92); gl_FragColor = vec4(col, alpha); }` });
    this.skin = new THREE.Mesh(g, this.skinMat); this.skin.renderOrder = 10; this.skin.frustumCulled = false; this.cg.add(this.skin);
    // insides
    const glow = (c, i = 2) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: i, roughness: 0.4, transparent: true, opacity: 0.9 });
    this.heart = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), glow(0xff1144, 3)); this.liver = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), glow(0x8a2be2, 1.5)); this.bladder = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), glow(0xffee55, 1.2)); this.fatM = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(0xffe0a0, 0.6));
    this.colonM = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), glow(0x7a4a20, 0.6)); for (const m of [this.heart, this.liver, this.bladder, this.fatM, this.colonM]) this.cg.add(m);
    this.gutBalls = []; for (let i = 0; i < 10; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), glow(0x33ff99, 1.2)); this.cg.add(m); this.gutBalls.push(m); }
    // brain: one point per neuron (426), coloured by region, flashing on spikes
    const bp = new Float32Array(NNEU * 3), bc = new Float32Array(NNEU * 3), bs = new Float32Array(NNEU); this.brainLocal = bp; const rc = new THREE.Color();
    REGIONS.forEach(([name, cnt], ri) => { rc.setHSL(ri / REGIONS.length, 0.9, 0.6); const a = (ri / REGIONS.length) * Math.PI * 2; for (let k = 0; k < cnt; k++) { const i = R0[name] + k; const rr = 0.05 + 0.05 * Math.random(); const th = a + (Math.random() - 0.5) * 0.7, ph = (Math.random() - 0.5) * 2.4;
        bp[3 * i] = 0.09 * Math.cos(ph) + (Math.random() - 0.5) * 0.04; bp[3 * i + 1] = Math.sin(ph) * rr + Math.cos(th) * 0.03; bp[3 * i + 2] = Math.sin(th) * rr; bc[3 * i] = rc.r; bc[3 * i + 1] = rc.g; bc[3 * i + 2] = rc.b; } });
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NNEU * 3), 3)); bg.setAttribute('color', new THREE.BufferAttribute(bc, 3)); bg.setAttribute('spk', new THREE.BufferAttribute(bs, 1)); this.brainGeo = bg;
    this.brainPts = new THREE.Points(bg, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { px: { value: 1 } }, vertexShader: 'attribute float spk; attribute vec3 color; varying vec3 vC; varying float vS; uniform float px; void main(){ vC = color; vS = spk; vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = px*(2.0 + 9.0*spk) * (3.0 / -mv.z); gl_Position = projectionMatrix*mv; }', fragmentShader: 'varying vec3 vC; varying float vS; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vC*(0.4+4.0*vS)*(1.0-2.0*d), 1.0); }' }));
    this.brainPts.frustumCulled = false; this.brainPts.renderOrder = 5; this.cg.add(this.brainPts);
    // blood: particles circulating along the body axis, speed from heart rate, colour from blood glucose
    this.bloodN = 160; const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.bloodN * 3), 3)); this.bloodPh = Float32Array.from({ length: this.bloodN }, () => Math.random()); this.bloodOff = Float32Array.from({ length: this.bloodN * 2 }, () => Math.random() * 2 - 1);
    this.bloodMat = new THREE.PointsMaterial({ color: 0xff3355, size: 0.035, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }); this.blood = new THREE.Points(fg, this.bloodMat); this.blood.frustumCulled = false; this.cg.add(this.blood);
    // limbs, stalks, eyes
    const limbMat = new THREE.MeshPhysicalMaterial({ color: 0x9a6bff, roughness: 0.25, metalness: 0.1, iridescence: 1, iridescenceIOR: 1.8, transmission: 0.3, thickness: 0.2, emissive: 0x220833, transparent: true, opacity: 0.85 });
    this.bones = []; const cap = new THREE.CapsuleGeometry(1, 1, 4, 10); for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(cap, limbMat); m.castShadow = true; this.cg.add(m); this.bones.push(m); }
    this.feet = []; for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0x40ffe0, emissive: 0x40ffe0, emissiveIntensity: 0.5, roughness: 0.3 })); this.cg.add(m); this.feet.push(m); }
    this.eyeU = { t: { value: 0 }, sleep: { value: 0 } };
    const eyeMat = (k) => new THREE.ShaderMaterial({ uniforms: { ...this.eyeU, k: { value: k }, dil: { value: 0.5 } }, vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP = position; vec4 w = modelMatrix*vec4(position,1.0); vN = normalize(mat3(modelMatrix)*normal); vV = normalize(cameraPosition-w.xyz); gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float t, sleep, k, dil; varying vec3 vP, vN, vV; vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0.,4.,2.),6.)-3.)-1.,0.,1.); }
        void main(){ vec3 p = normalize(vP); float front = p.z; float r = acos(clamp(front,-1.0,1.0)); float a = atan(p.y, p.x);
          vec3 sclera = vec3(0.95,0.9,1.0)*0.6 + hue(fract(r*0.8 + t*0.03 + k*0.3))*0.25; float iris = smoothstep(0.95, 0.85, r);
          float rays = 0.5+0.5*sin(a*13.0 + r*30.0 - t*2.0*k); vec3 irisC = hue(fract(0.55 + 0.2*k + 0.15*rays + r*0.5))*(0.8+1.6*rays);
          // three slit pupils that rotate with the pupil phase; dilation from noradrenaline
          float pup = 0.0; for (int i=0;i<3;i++){ float aa = a + float(i)*2.094 + t*0.2*(k+1.0); vec2 q = vec2(cos(aa), sin(aa))*r; pup = max(pup, smoothstep(0.08+0.12*dil, 0.04, abs(q.x)) * step(r, 0.12+0.5*dil) ); }
          vec3 col = mix(sclera, irisC, iris); col = mix(col, vec3(0.0), pup); float lid = smoothstep(0.0, 0.2, abs(p.y) - (1.0 - sleep)*1.2 + 0.2); col = mix(col, vec3(0.25,0.05,0.3), sleep*lid);
          float fres = pow(1.0 - clamp(dot(normalize(vN), normalize(vV)),0.0,1.0), 2.5); col += vec3(0.6,0.9,1.0)*fres*0.8; gl_FragColor = vec4(col*1.3, 1.0); }` });
    this.eyes = []; for (let e = 0; e < 3; e++) { const m = new THREE.Mesh(new THREE.SphereGeometry(e === 2 ? 0.07 : 0.1, 32, 24), eyeMat(e)); this.cg.add(m); this.eyes.push(m); }
    this.goalMark = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.7, 48), new THREE.MeshBasicMaterial({ color: 0xff40ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide })); this.goalMark.rotation.x = -Math.PI / 2; this.scene.add(this.goalMark);
  }
  buildWeather() { const n = 1600; const g = new THREE.BufferGeometry(); const p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { p[3 * i] = (Math.random() - 0.5) * 44; p[3 * i + 1] = Math.random() * 14; p[3 * i + 2] = (Math.random() - 0.5) * 44; } g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.spores = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fffe0, size: 0.035, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false })); this.scene.add(this.spores); }
  // ---------------------------------------------------------------- per-frame update
  update(dtReal) {
    const cr = this.cr, B = cr.body, W = cr.world, nm = cr.brain.nm; this.clock += dtReal; const t = this.clock; const X = B.x, Y = B.y, Z = B.z;
    if (Math.floor(W.t / 2) !== this._tt) { this._tt = Math.floor(W.t / 2); this.updateTerrain(); } this.syncProps(); if (this.terrainT) this.terrainT.value = t;
    const day = cr.light; this.skyU.day.value = day; this.skyU.t.value = t; this.hemi.intensity = 0.25 + 0.8 * day; this.sun.intensity = 0.2 + 2.4 * day; this.scene.fog.color.setRGB(0.02 + 0.05 * day, 0.02 + 0.05 * day, 0.05 + 0.08 * day);
    // skin tube through the segment centres (Catmull-Rom), cross-section from ring particles
    const F = B.F, pos = this.skinGeo.attributes.position.array, nor = this.skinGeo.attributes.normal.array; const cen = (i) => B.c[Math.max(0, Math.min(NS - 1, i))];
    const P = (i) => [X[cen(i)], Y[cen(i)], Z[cen(i)]]; const tmp = [0, 0, 0];
    for (let s = 0; s < RING_S; s++) { const f = (s / (RING_S - 1)) * (NS - 1 + 0.9) - 0.45; const i = Math.max(0, Math.min(NS - 2, Math.floor(f))); const tt = f - i; const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      for (let k = 0; k < 3; k++) { const a = p0[k], b = p1[k], c = p2[k], d = p3[k]; tmp[k] = 0.5 * (2 * b + (-a + c) * tt + (2 * a - 5 * b + 4 * c - d) * tt * tt + (-a + 3 * b - 3 * c + d) * tt * tt * tt); }
      const si = Math.max(0, Math.min(NS - 1, Math.round(f))); const fr = F[si]; const rg = B.ring[si], c0 = B.c[si]; const rad = (j) => Math.hypot(X[rg[j]] - X[c0], Y[rg[j]] - Y[c0], Z[rg[j]] - Z[c0]);
      const ru = (rad(0) + rad(2)) / 2, rs = (rad(1) + rad(3)) / 2; const end = s / (RING_S - 1); const taper = Math.sqrt(Math.max(0, Math.sin(Math.PI * Math.min(1, Math.max(0, end * 1.02))))) * (1 + 0.25 * Math.max(0, end - 0.75) * 4 * (1 - end) * 4);
      for (let m = 0; m <= RING_M; m++) { const th = (m / RING_M) * Math.PI * 2; const ct = Math.cos(th), st = Math.sin(th); const bump = 1 + 0.06 * Math.sin(th * 5 + s * 0.7 + t * 0.8) * (0.5 + nm.ACh) + 0.05 * Math.sin(s * 1.9 - t * 3 * (0.3 + nm.NE));
        const nx = st * fr.s[0] + ct * fr.u[0], ny = st * fr.s[1] + ct * fr.u[1], nz = st * fr.s[2] + ct * fr.u[2]; const o = 3 * (s * (RING_M + 1) + m); const r1 = taper * bump * 1.18;
        pos[o] = tmp[0] + (st * rs * fr.s[0] + ct * ru * fr.u[0]) * r1; pos[o + 1] = tmp[1] + (st * rs * fr.s[1] + ct * ru * fr.u[1]) * r1; pos[o + 2] = tmp[2] + (st * rs * fr.s[2] + ct * ru * fr.u[2]) * r1; nor[o] = nx; nor[o + 1] = ny; nor[o + 2] = nz; } }
    this.skinGeo.attributes.position.needsUpdate = true; this.skinGeo.attributes.normal.needsUpdate = true; this.chromaTex.needsUpdate = true;
    const stg = cr.sleep.stage; this.skinU.t.value = t; this.skinU.ne.value = nm.NE; this.skinU.da.value = nm.DA; this.skinU.sleep.value = stg >= 2 ? 1 : stg === 1 ? 0.4 : 0; this.skinU.glitch.value = Math.max(0, (this.skinU.glitch.value || 0) * 0.92);
    // organs: placed in the body frame of their segment; sizes and colours come from metabolic state
    const M = cr.metab; const at = (seg, du, ds, df, obj, sc) => { const c = B.c[seg], fr = F[seg]; obj.position.set(X[c] + fr.u[0] * du + fr.s[0] * ds + fr.f[0] * df, Y[c] + fr.u[1] * du + fr.s[1] * ds + fr.f[1] * df, Z[c] + fr.u[2] * du + fr.s[2] * ds + fr.f[2] * df); obj.scale.setScalar(sc); };
    this.heartPh += dtReal * (M.hr / 60) * (cr.speed || 1); const beat = Math.pow(Math.max(0, Math.sin(this.heartPh * Math.PI * 2)), 6); this.skinU.beat.value = beat; this.skinU.perf.value = Math.min(1, 0.3 + M.blood.glc / 6 + (M.hr - 60) / 120); this.skinU.sunDir.value.copy(this.sun.position).sub(this.sun.target.position).normalize(); this.skinU.sunI.value = this.sun.intensity / 2.6; at(4, 0.05, 0, 0, this.heart, 1 + 0.45 * beat); this.heart.material.emissiveIntensity = 1.5 + 4 * beat;
    at(3, -0.02, 0.06, 0, this.liver, 0.7 + M.liverGly / 40); this.liver.material.emissive.setHSL(0.75 - 0.25 * Math.min(1, M.liverGly / 40), 0.9, 0.45);
    at(1, -0.06, 0, -0.05, this.bladder, 0.6 + 1.6 * M.bladder); at(0, 0, 0, 0.1, this.colonM, 0.5 + 1.2 * M.colon); at(2, 0.06, -0.05, 0, this.fatM, 0.6 + M.fat / 400);
    const gutFill = M.gut.glc + M.gut.fat + M.gut.prot; const ensR = cr.brain.rate; this.gutBalls.forEach((g, i) => { const f = 1 + (i / 9) * 3.6; const seg = Math.floor(f), tt2 = f - seg; const ens = ensR[R0.ENS + i * 4] / 40; const sc = 0.5 + 0.35 * Math.min(2, gutFill / 3) + 0.5 * ens; at(seg, -0.05 + 0.03 * Math.sin(i + t * 2 * M.motility), 0, tt2 * 0.4, g, sc); g.material.emissiveIntensity = 0.6 + 2.5 * ens; });
    // brain points ride in the head frame
    const hc = B.c[NS - 1], hf = F[NS - 1]; const bp = this.brainGeo.attributes.position.array, spk = this.brainGeo.attributes.spk.array, L = this.brainLocal; const tb = cr.brain.t;
    for (let i = 0; i < NNEU; i++) { const a = L[3 * i], b = L[3 * i + 1], c = L[3 * i + 2]; bp[3 * i] = X[hc] + hf.f[0] * a + hf.u[0] * b + hf.s[0] * c; bp[3 * i + 1] = Y[hc] + hf.f[1] * a + hf.u[1] * b + hf.s[1] * c; bp[3 * i + 2] = Z[hc] + hf.f[2] * a + hf.u[2] * b + hf.s[2] * c; const ls = cr.brain.lastSpike[i]; spk[i] = ls < 0 ? 0 : Math.exp(-(tb - ls) / 0.08); }
    this.brainGeo.attributes.position.needsUpdate = true; this.brainGeo.attributes.spk.needsUpdate = true; this.brainPts.material.uniforms.px.value = this.renderer.getPixelRatio() * (this.renderer.domElement.height / 800);
    // blood flow
    const bpos = this.blood.geometry.attributes.position.array; const v = (M.hr / 70) * 0.12 * dtReal * (cr.speed || 1); for (let i = 0; i < this.bloodN; i++) { let ph = (this.bloodPh[i] += v * (i % 2 ? 1 : -1)); ph -= Math.floor(ph); const f = ph * (NS - 1); const seg = Math.min(NS - 2, Math.floor(f)), tt2 = f - seg; const c1 = B.c[seg], c2 = B.c[seg + 1], fr = F[seg]; const ro = 0.12 * (i % 2 ? 1 : -0.6);
      for (let k = 0; k < 3; k++) { const base = [X, Y, Z][k]; bpos[3 * i + k] = base[c1] + (base[c2] - base[c1]) * tt2 + fr.u[k] * this.bloodOff[2 * i] * 0.08 + fr.s[k] * (this.bloodOff[2 * i + 1] * 0.08 + ro * 0.3); } }
    this.blood.geometry.attributes.position.needsUpdate = true; const glc = Math.min(1.5, M.blood.glc / 3); this.bloodMat.color.setRGB(1, 0.15 + 0.4 * glc, 0.3 + 0.5 * glc);
    // limbs
    let bi = 0; const bone = (a, b, r) => { const m = this.bones[bi++]; const ax = X[a], ay = Y[a], az = Z[a], dx = X[b] - ax, dy = Y[b] - ay, dz = Z[b] - az; const len = Math.hypot(dx, dy, dz) || 1e-3; m.position.set(ax + dx / 2, ay + dy / 2, az + dz / 2); m.scale.set(r, Math.max(0.001, len / 2 - r) , r); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len)); };
    B.limbs.forEach((Lb, k) => { const r = Lb.kind === 'arm' ? 0.045 : 0.05; bone(Lb.hip, Lb.knee, r); bone(Lb.knee, Lb.foot, r * 0.8); const f = this.feet[k]; f.position.set(X[Lb.foot], Y[Lb.foot], Z[Lb.foot]); const gp = B.gripP[Lb.foot] || 0; f.scale.setScalar(0.06 + 0.03 * gp); f.material.emissiveIntensity = 0.3 + 3 * gp; });
    for (const st of B.stalks) { bone(st.base, st.mid, 0.025); bone(st.mid, st.eye, 0.02); } while (bi < this.bones.length) this.bones[bi++].visible = false;
    // eyes: position from physics, gaze direction from the eye motor channels (neural output)
    const gz = (e) => [B.u[CH.gaze + 2 * e], B.u[CH.gaze + 2 * e + 1]]; const dil = Math.min(1, 0.2 + 0.8 * nm.NE);
    for (let e = 0; e < 3; e++) { const m = this.eyes[e]; if (e < 2) { const p = B.stalks[e].eye; m.position.set(X[p], Y[p], Z[p]); } else { const c = B.c[NS - 1]; m.position.set(X[c] + hf.f[0] * 0.33 + hf.u[0] * 0.08, Y[c] + hf.f[1] * 0.33 + hf.u[1] * 0.08, Z[c] + hf.f[2] * 0.33 + hf.u[2] * 0.08); }
      const [yw, pt] = gz(e); const d = new THREE.Vector3(hf.f[0], hf.f[1], hf.f[2]).applyAxisAngle(new THREE.Vector3(hf.u[0], hf.u[1], hf.u[2]), -yw * 1.2).applyAxisAngle(new THREE.Vector3(hf.s[0], hf.s[1], hf.s[2]), pt * 0.8);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()); m.material.uniforms.dil.value = dil; }
    this.eyeU.t.value = t; this.eyeU.sleep.value = stg >= 2 ? 1 : stg === 1 ? 0.5 : 0;
    // world objects
    W.plants.forEach((Pl, i) => { const pm = this.plantMeshes[i]; pm.fruit.scale.setScalar(0.3 + 0.7 * Pl.fruit); pm.fm.emissiveIntensity = 0.3 + 2.2 * Pl.fruit; pm.fruit.rotation.y = t * 0.5 + i; pm.g.position.y = Pl.y; const gl = cr.goal && cr.goal.type === 'site' && cr.goal.k === i; pm.ring.material.opacity = gl ? 0.9 : 0; });
    const live = new Set(); for (const s of W.snacks) { live.add(s.id); let m = this.snackMeshes.get(s.id); if (!m) { m = new THREE.Mesh(this.snackGeo, new THREE.MeshStandardMaterial({ color: s.kind === 'fat' ? 0xffcc66 : 0xff66cc, emissive: s.kind === 'fat' ? 0xffaa33 : 0xff33aa, emissiveIntensity: 2.5 })); this.scene.add(m); this.snackMeshes.set(s.id, m); } m.position.set(s.x, s.y, s.z); m.rotation.y = t; }
    for (const [id, m] of this.snackMeshes) if (!live.has(id)) { this.scene.remove(m); this.snackMeshes.delete(id); }
    while (this.wasteMeshes.length < W.waste.length) { const m = new THREE.Mesh(this.wasteGeo, new THREE.MeshStandardMaterial({ color: 0x553311, roughness: 0.9, transparent: true })); this.scene.add(m); this.wasteMeshes.push(m); }
    this.wasteMeshes.forEach((m, i) => { const w = W.waste[i]; if (!w) { m.visible = false; return; } m.visible = true; m.position.set(w.x, W.height(w.x, w.z) + 0.03, w.z); if (w.type === 'urine') { m.material.color.set(0xddcc22); m.scale.set(0.9 * w.amount, 0.05, 0.9 * w.amount); m.material.opacity = 0.6 * (1 - w.age / 120); } else { m.material.color.set(0x553311); m.scale.setScalar(0.7 + 0.3 * w.amount); m.material.opacity = 1 - w.age / 120; } });
    const tg = cr.target(); if (tg) { this.goalMark.visible = true; this.goalMark.position.set(tg[0], W.height(tg[0], tg[2]) + 0.05, tg[2]); this.goalMark.rotation.z = t; } else this.goalMark.visible = false;
    // weather particles drift on the simulated wind field
    const sp = this.spores.geometry.attributes.position.array; const n = this.rainN; this.spores.geometry.setDrawRange(0, n); for (let i = 0; i < n; i++) { sp[3 * i] += W.wind.x * dtReal * 0.6 + Math.sin(t + i) * 0.003; sp[3 * i + 2] += W.wind.z * dtReal * 0.6; sp[3 * i + 1] -= dtReal * (0.2 + 5 * W.wind.rain * (i % 3 === 0 ? 1 : 0)); if (sp[3 * i + 1] < -2 || Math.abs(sp[3 * i]) > 22 || Math.abs(sp[3 * i + 2]) > 22) { sp[3 * i] = (Math.random() - 0.5) * 44; sp[3 * i + 1] = 8 + Math.random() * 6; sp[3 * i + 2] = (Math.random() - 0.5) * 44; } }
    this.spores.geometry.attributes.position.needsUpdate = true;
    // camera follow
    const com = B.com(); this.rim.position.set(com[0], com[1] + 1.5, com[2]); this.rim.intensity = 3 + 6 * nm.NE; this.sun.target.position.set(com[0], com[1], com[2]); this.sun.position.set(com[0] + 10, com[1] + 18, com[2] + 6);
    if (this.follow) { const tgt = this.controls.target; const k = this.reduced ? 0.03 : 0.08; const dx = (com[0] - tgt.x) * k, dy = (com[1] - tgt.y) * k, dz = (com[2] - tgt.z) * k; tgt.x += dx; tgt.y += dy; tgt.z += dz; this.camera.position.x += dx; this.camera.position.y += dy; this.camera.position.z += dz; }
    this.controls.update(); if (this.bloom.enabled) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }
  pick(ndcX, ndcY) { const rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(ndcX, ndcY), this.camera); const B = this.cr.body; let best = -1, bd = 0.35;
    for (let i = 0; i < B.n; i++) { const p = new THREE.Vector3(B.x[i], B.y[i], B.z[i]); const d = rc.ray.distanceToPoint(p); if (d < bd) { bd = d; best = i; } }
    const hit = rc.intersectObject(this.terrain)[0]; return { particle: best, point: hit ? hit.point : null, dir: rc.ray.direction }; }
}
