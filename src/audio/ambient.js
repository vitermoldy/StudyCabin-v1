import { Emitter, clamp } from '../core/emitter.js';
import { load, save } from '../core/store.js';

export const LAYERS = [
  { id: 'waves', label: 'Waves' },
  { id: 'rain', label: 'Rain' },
  { id: 'wind', label: 'Wind' },
  { id: 'wildlife', label: 'Birds and crickets' },
  { id: 'fire', label: 'Stove fire' },
];

/**
 * Ambient sound, made in the browser from filtered noise and oscillators:
 * no audio files. Nothing is created until the visitor turns sound on.
 */
export class Ambient extends Emitter {
  constructor() {
    super();
    const saved = load('ambient', {});
    this.enabled = saved.on === true;
    this.volume = Number.isFinite(saved.volume) ? clamp(saved.volume, 0, 1) : 0.6;
    this.mix = { waves: 0.8, rain: 0.8, wind: 0.6, wildlife: 0.7, fire: 0.8, ...(saved.mix || {}) };
    this.duckWhenMusic = saved.duck !== false;
    this.musicPlaying = false;
    this.ctx = null;
    this._t = 0;
    this._nextBird = 0;
    this._nextCrackle = 0;
    this._cricketGate = 0;
    this.env = null;
  }

  get supported() {
    return typeof window.AudioContext === 'function' || typeof window.webkitAudioContext === 'function';
  }

  _ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Pinkish noise (Paul Kellet's filter) so the base is softer than white.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    this.noise = buf;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    const src = (offset) => {
      const s = ctx.createBufferSource();
      s.buffer = buf;
      s.loop = true;
      s.start(0, offset);
      return s;
    };
    const filter = (type, freq, q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      return f;
    };
    const gain = (v = 0) => {
      const g = ctx.createGain();
      g.gain.value = v;
      return g;
    };
    const chain = (...nodes) => {
      for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
      return nodes[nodes.length - 1];
    };

    this.g = {
      waves: gain(), surf: gain(), rain: gain(), rainLow: gain(), wind: gain(),
      wildlife: gain(), fire: gain(), fireLow: gain(),
    };
    chain(src(0.3), filter('lowpass', 420), this.g.waves, this.master);
    this.surfFilter = filter('bandpass', 1400, 0.6);
    chain(src(1.1), this.surfFilter, this.g.surf, this.master);
    chain(src(2.2), filter('highpass', 1100), filter('lowpass', 7000), this.g.rain, this.master);
    chain(src(0.7), filter('lowpass', 260), this.g.rainLow, this.master);
    this.windFilter = filter('bandpass', 420, 1.3);
    chain(src(3.1), this.windFilter, this.g.wind, this.master);
    chain(src(1.7), filter('lowpass', 170), this.g.fireLow, this.master);
    this.g.wildlife.connect(this.master);
    this.g.fire.connect(this.master);

    // Crickets: a high tone gated by a fast pulse, switched on and off in bursts.
    const carrier = ctx.createOscillator();
    carrier.frequency.value = 4400;
    const am = gain(0);
    const lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 27;
    const lfoDepth = gain(0.5);
    lfo.connect(lfoDepth).connect(am.gain);
    this.cricketGate = gain(0);
    this.cricketLevel = gain(0);
    carrier.connect(am).connect(this.cricketGate).connect(this.cricketLevel).connect(this.master);
    carrier.start();
    lfo.start();

    this.thunderBus = gain(1);
    this.thunderBus.connect(this.master);
    return true;
  }

  /** Turn sound on or off. Must run from a click or key press the first time. */
  async setEnabled(on) {
    this.enabled = !!on;
    if (on) {
      if (!this._ensure()) {
        this.enabled = false;
        this.emit('error', 'This browser cannot play generated sound.');
        this.emit('change');
        return;
      }
      try {
        await this.ctx.resume();
      } catch {
        /* resumed on the next gesture */
      }
    }
    this._applyMaster(0.4);
    if (!on && this.ctx) {
      setTimeout(() => {
        if (!this.enabled && this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
      }, 900);
    }
    this.persist();
    this.emit('change');
  }

  /** Browsers start audio suspended; resume on the next gesture if it was on. */
  resumeIfWanted() {
    if (this.enabled) this.setEnabled(true);
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    this._applyMaster(0.15);
    this.persist();
    this.emit('change');
  }

  setMix(id, v) {
    this.mix[id] = clamp(v, 0, 1);
    this.persist();
    this.emit('change');
  }

  setDuck(on) {
    this.duckWhenMusic = !!on;
    this._applyMaster(0.4);
    this.persist();
    this.emit('change');
  }

  setMusicPlaying(on) {
    this.musicPlaying = !!on;
    this._applyMaster(0.8);
  }

  _applyMaster(tc) {
    if (!this.ctx) return;
    const duck = this.musicPlaying && this.duckWhenMusic ? 0.4 : 1;
    const v = this.enabled ? this.volume * this.volume * duck : 0;
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, tc);
  }

  /** env: { waves, rain, wind, storm, day, night, season, fire } all 0..1. */
  update(dt, env) {
    this.env = env;
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    this._t += dt;
    const t = this._t;
    const m = this.mix;
    const set = (g, v, tc = 0.6) => g.gain.setTargetAtTime(v, now, tc);

    // Waves: swells about every nine seconds, louder with bigger sea.
    const swell = Math.pow(0.5 + 0.5 * Math.sin((t / 9) * Math.PI * 2), 1.6);
    const sea = 0.35 + env.waves * 0.65;
    set(this.g.waves, m.waves * sea * (0.35 + swell * 0.65) * 0.9, 0.3);
    set(this.g.surf, m.waves * sea * Math.pow(Math.max(0, Math.sin((t / 9) * Math.PI * 2 - 0.7)), 3) * 0.32, 0.25);
    this.surfFilter.frequency.setTargetAtTime(1100 + swell * 900, now, 0.4);

    set(this.g.rain, m.rain * env.rain * 0.55);
    set(this.g.rainLow, m.rain * (env.rain * 0.25 + env.storm * 0.35));

    const gust = 0.6 + 0.4 * Math.sin(t * 0.23) * Math.sin(t * 0.61 + 1);
    set(this.g.wind, m.wind * (0.08 + env.wind * 0.5) * gust, 0.8);
    this.windFilter.frequency.setTargetAtTime(300 + gust * 380 + env.wind * 200, now, 0.8);

    const seasonBirds = { spring: 1, summer: 0.8, autumn: 0.45, rainy: 0.35, winter: 0.2 }[env.season] ?? 0.5;
    const seasonCrickets = { spring: 0.5, summer: 1, autumn: 0.55, rainy: 0.7, winter: 0 }[env.season] ?? 0.5;
    const birds = m.wildlife * env.day * seasonBirds * (1 - env.rain * 0.85) * (env.morning ? 1 : 0.45);
    const crickets = m.wildlife * env.night * seasonCrickets * (1 - env.rain * 0.8);
    set(this.g.wildlife, 1, 0.3);
    set(this.cricketLevel, crickets * 0.018, 1.2);
    this._cricketGate -= dt;
    if (this._cricketGate <= 0) {
      const onFor = 0.25 + Math.random() * 0.5;
      this.cricketGate.gain.setTargetAtTime(1, now, 0.02);
      this.cricketGate.gain.setTargetAtTime(0, now + onFor, 0.03);
      this._cricketGate = onFor + 0.3 + Math.random() * 0.9;
    }
    if (birds > 0.05 && now > this._nextBird) {
      this._bird(birds);
      this._nextBird = now + 1.2 + Math.random() * 4 / (0.4 + birds);
    }

    set(this.g.fireLow, m.fire * env.fire * 0.22);
    set(this.g.fire, m.fire * env.fire, 0.3);
    if (env.fire > 0.1 && now > this._nextCrackle) {
      this._crackle();
      this._nextCrackle = now + 0.03 + Math.random() * 0.22;
    }
  }

  _bird(level) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2600 + Math.random() * 1500;
    for (let i = 0; i < notes; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const t0 = now + i * (0.11 + Math.random() * 0.05);
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.25), t0);
      o.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), t0 + 0.07);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.045 * level, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.09);
      o.connect(g).connect(this.g.wildlife);
      o.start(t0);
      o.stop(t0 + 0.1);
    }
  }
}
