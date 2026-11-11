// Procedural WebAudio Bio-Acoustic Syrinx & Biosphere Soundscape (pass 17)
// Synthesizes focal Glitchling FM syrinx vocalizations, stereo-panned conspecific calls,
// hemodynamic systolic/dicrotic lub-dub, hydrothermal vent rumble, wind/rain pink noise,
// and micro-foley for feeding, drinking, stings, and egg hatching. Zero external audio assets needed.

import { clamp } from './sim/util.js';

export class BioAudio {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.volume = 0.22;
    this._lastHeartPhase = 0;
    this._lastEventTick = -1;
    this._lastEventCount = 0;
    this._peerChirpTimer = 0;
  }

  _init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 18;
    comp.ratio.value = 6;
    comp.attack.value = 0.005;
    comp.release.value = 0.18;

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(comp);
    comp.connect(ctx.destination);
    this.master = master;

    // 1) Pink-noise buffer (2 seconds seamless loop) for wind, rain & hydrothermal steam
    const bufLen = ctx.sampleRate * 2;
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufLen; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.035;
      b6 = w * 0.115926;
    }

    // Wind & rain ambience voice
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuf;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.05;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();
    this.windFilter = windFilter;
    this.windGain = windGain;

    // Hydrothermal vent sub-rumble voice
    const ventSrc = ctx.createBufferSource();
    ventSrc.buffer = noiseBuf;
    ventSrc.loop = true;
    ventSrc.playbackRate.value = 0.45;
    const ventFilter = ctx.createBiquadFilter();
    ventFilter.type = 'lowpass';
    ventFilter.frequency.value = 95;
    ventFilter.Q.value = 3.2;
    const ventGain = ctx.createGain();
    ventGain.gain.value = 0.0;
    ventSrc.connect(ventFilter);
    ventFilter.connect(ventGain);
    ventGain.connect(master);
    ventSrc.start();
    this.ventFilter = ventFilter;
    this.ventGain = ventGain;

    // Continuous FM Syrinx vocal tract for focal creature
    const syrMod = ctx.createOscillator();
    syrMod.type = 'sine';
    syrMod.frequency.value = 520;
    const syrModGain = ctx.createGain();
    syrModGain.gain.value = 65;
    const syrCar = ctx.createOscillator();
    syrCar.type = 'triangle';
    syrCar.frequency.value = 360;
    const syrFormant = ctx.createBiquadFilter();
    syrFormant.type = 'bandpass';
    syrFormant.frequency.value = 720;
    syrFormant.Q.value = 3.5;
    const syrGain = ctx.createGain();
    syrGain.gain.value = 0.0;

    syrMod.connect(syrModGain);
    syrModGain.connect(syrCar.frequency);
    syrCar.connect(syrFormant);
    syrFormant.connect(syrGain);
    syrGain.connect(master);
    syrMod.start();
    syrCar.start();

    this.syrMod = syrMod;
    this.syrModGain = syrModGain;
    this.syrCar = syrCar;
    this.syrFormant = syrFormant;
    this.syrGain = syrGain;
  }

  toggle() {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  setEnabled(on) {
    this.enabled = !!on;
    if (this.enabled) {
      this._init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      if (this.master && this.ctx) {
        this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.08);
      }
    } else if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
    }
  }

  _pulseTone(freq0, freq1, dur, amp = 0.12, type = 'sine', pan = 0) {
    if (!this.enabled || !this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(35, freq0), t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(35, freq1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + Math.min(0.015, dur * 0.25));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    if (this.ctx.createStereoPanner && Math.abs(pan) > 0.01) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = clamp(pan, -1, 1);
      osc.connect(g);
      g.connect(p);
      p.connect(this.master);
    } else {
      osc.connect(g);
      g.connect(this.master);
    }
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  update(cr, camPos = null) {
    if (!this.enabled || !this.ctx || !cr) return;
    if (this.ctx.state === 'suspended') return;
    const now = this.ctx.currentTime;
    const W = cr.world;
    const com = cr.body.com();

    // 1) Wind & rain pink-noise modulation
    const windSpd = Math.hypot(W.wind.x, W.wind.z);
    const rain = W.wind.rain || 0;
    this.windFilter.frequency.setTargetAtTime(260 + 210 * windSpd + 520 * rain, now, 0.12);
    this.windGain.gain.setTargetAtTime(clamp(0.035 + 0.055 * windSpd + 0.12 * rain, 0.02, 0.24), now, 0.12);

    // 2) Hydrothermal vent proximity sub-rumble
    const refX = camPos ? camPos.x : com[0];
    const refZ = camPos ? camPos.z : com[2];
    let ventProx = 0;
    if (W.vents) {
      for (let i = 0; i < W.vents.length; i++) {
        const v = W.vents[i];
        const d = Math.hypot(v.x - refX, v.z - refZ);
        if (d < 12) ventProx = Math.max(ventProx, (1 - d / 12) * v.heat);
      }
    }
    this.ventGain.gain.setTargetAtTime(0.18 * ventProx, now, 0.1);
    this.ventFilter.frequency.setTargetAtTime(75 + 45 * ventProx, now, 0.1);

    // 3) Focal Glitchling FM syrinx continuous vocalization
    const vAmp = clamp(cr.vocalAmp || 0, 0, 1);
    const vFreq = clamp(cr.vocalFreq || 380, 140, 1400);
    const da = cr.brain?.nm?.DA ?? 0.3;
    this.syrCar.frequency.setTargetAtTime(vFreq, now, 0.04);
    this.syrMod.frequency.setTargetAtTime(vFreq * (1.5 + 0.35 * da), now, 0.04);
    this.syrModGain.gain.setTargetAtTime(30 + 140 * vAmp, now, 0.04);
    this.syrFormant.frequency.setTargetAtTime(vFreq * 1.9 + 220 * (cr.nociception || 0), now, 0.05);
    this.syrGain.gain.setTargetAtTime(0.085 * vAmp * (cr.sleep.stage === 0 ? 1 : 0.15), now, 0.05);

    // 4) Hemodynamic cardiac lub-dub on systolic & dicrotic phase crossings
    const hp = cr.fluid?.heartPhase ?? 0;
    const prevHp = this._lastHeartPhase;
    this._lastHeartPhase = hp;
    const camDist = camPos ? Math.hypot(camPos.x - com[0], camPos.y - com[1], camPos.z - com[2]) : 5;
    const heartAtten = clamp(1.3 - camDist / 14, 0.15, 1.0);
    if (prevHp > 0.8 && hp < 0.25) {
      this._pulseTone(64, 42, 0.09, 0.09 * heartAtten, 'sine', 0);
    } else if (prevHp < 0.34 && hp >= 0.34) {
      this._pulseTone(78, 52, 0.07, 0.055 * heartAtten, 'sine', 0);
    }

    // 5) Discrete biological event chimes/chirps (reward, drink, sting, egg/birth)
    if (cr.events.length > 0) {
      const lastEv = cr.events[cr.events.length - 1];
      if (lastEv.t !== this._lastEventTick || cr.events.length !== this._lastEventCount) {
        this._lastEventTick = lastEv.t;
        this._lastEventCount = cr.events.length;
        if (lastEv.type === 'reward' || lastEv.type === 'eat') {
          this._pulseTone(440, 720, 0.14, 0.11, 'triangle', 0);
        } else if (lastEv.type === 'drink') {
          this._pulseTone(310, 480, 0.11, 0.08, 'sine', 0);
        } else if (lastEv.type === 'sting' || lastEv.type === 'poke') {
          this._pulseTone(880, 290, 0.18, 0.13, 'sawtooth', 0);
        }
      }
    }

    // 6) Stereo-spatialized conspecific chorus
    this._peerChirpTimer -= 1 / 60;
    if (cr.eco && this._peerChirpTimer <= 0) {
      this._peerChirpTimer = 0.35 + Math.random() * 0.55;
      for (let i = 0; i < cr.eco.peers.length; i++) {
        const p = cr.eco.peers[i];
        if (p.vocalAmp > 0.25) {
          const dx = p.x - refX, dz = p.z - refZ;
          const d = Math.hypot(dx, dz);
          if (d < 20) {
            const pan = clamp(dx / 12, -0.95, 0.95);
            const gain = 0.07 * p.vocalAmp * (1 - d / 20);
            this._pulseTone(p.vocalFreq, p.vocalFreq * (p.courtship > 0.3 ? 1.32 : 0.82), 0.15, gain, 'sine', pan);
            break;
          }
        }
      }
    }
  }
}
