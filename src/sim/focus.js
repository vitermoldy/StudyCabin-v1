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
}
