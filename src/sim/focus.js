import { Emitter } from '../core/emitter.js';
import { load, save } from '../core/store.js';

export const PRESETS = {
  short: { label: '25 min focus, 5 min break', focus: 25, short: 5, long: 15, rounds: 4 },
  long: { label: '50 min focus, 10 min break', focus: 50, short: 10, long: 20, rounds: 3 },
};

const PHASE_LABEL = { focus: 'Focus', short: 'Short break', long: 'Long break' };

const today = () => new Date().toISOString().slice(0, 10);

/** A focus timer in real time (not the cabin's clock). */
export class FocusTimer extends Emitter {
  constructor() {
    super();
    const s = load('focus', {});
    this.preset = s.preset in PRESETS ? s.preset : 'short';
    this.phase = ['focus', 'short', 'long'].includes(s.phase) ? s.phase : 'focus';
    this.round = Number.isInteger(s.round) && s.round > 0 ? s.round : 1;
    this.running = s.running === true && Number.isFinite(s.endAt);
    this.endAt = Number.isFinite(s.endAt) ? s.endAt : 0;
    this.remainingMs = Number.isFinite(s.remainingMs) ? s.remainingMs : this.lengthMs();
    this.doneDate = s.doneDate || today();
    this.done = s.doneDate === today() && Number.isInteger(s.done) ? s.done : 0;
    // A block that ended while the page was closed is simply finished.
    if (this.running && Date.now() >= this.endAt) {
      this.running = false;
      this._advancePhase(false);
    }
  }

  get config() {
    return PRESETS[this.preset];
  }

  get phaseLabel() {
    return PHASE_LABEL[this.phase];
  }

  /** 'focus' or 'break' while running, else null: the resident reads this. */
  get residentPhase() {
    if (!this.running && this.remainingMs === this.lengthMs()) return null;
    return this.phase === 'focus' ? 'focus' : 'break';
  }

  get active() {
    return this.running || this.remainingMs !== this.lengthMs();
  }

  lengthMs(phase = this.phase) {
    return this.config[phase === 'focus' ? 'focus' : phase === 'short' ? 'short' : 'long'] * 60000;
  }

  remaining() {
    return this.running ? Math.max(0, this.endAt - Date.now()) : this.remainingMs;
  }

  setPreset(id) {
    if (!(id in PRESETS) || id === this.preset) return;
    this.preset = id;
    this.reset();
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.endAt = Date.now() + this.remainingMs;
    this._commit();
  }

  pause() {
    if (!this.running) return;
    this.remainingMs = Math.max(0, this.endAt - Date.now());
    this.running = false;
    this._commit();
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  reset() {
    this.running = false;
    this.phase = 'focus';
    this.round = 1;
    this.remainingMs = this.lengthMs();
    this._commit();
  }

  skip() {
    this._advancePhase(this.running);
    this._commit();
  }

  _advancePhase(keepRunning) {
    if (this.phase === 'focus') {
      if (this.doneDate !== today()) {
        this.doneDate = today();
        this.done = 0;
      }
      this.done += 1;
      this.phase = this.round >= this.config.rounds ? 'long' : 'short';
    } else {
      this.round = this.phase === 'long' ? 1 : this.round + 1;
      this.phase = 'focus';
    }
    this.remainingMs = this.lengthMs();
    this.running = keepRunning;
    if (keepRunning) this.endAt = Date.now() + this.remainingMs;
  }
}
