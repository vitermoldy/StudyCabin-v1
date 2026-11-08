import { Emitter } from './emitter.js';
import { load, save } from './store.js';

/** Game minutes that pass per real second, by speed id. */
export const SPEEDS = {
  paused: 0,
  real: 1 / 60,
  normal: 1, // the brief: one game minute every real second
  fast: 10,
};

export const SPEED_LABELS = {
  paused: 'Stopped',
  real: 'Real time',
  normal: '1 minute a second',
  fast: '10 minutes a second',
};

function realMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60;
}

export class Clock extends Emitter {
  constructor() {
    super();
    const saved = load('clock', null);
    this.minutes = saved && Number.isFinite(saved.minutes) ? saved.minutes : realMinutes();
    this.day = saved && Number.isInteger(saved.day) && saved.day > 0 ? saved.day : 1;
    this.speed = saved && saved.speed in SPEEDS ? saved.speed : 'normal';
    this._lastMinute = Math.floor(this.minutes);
    this._saveIn = 0;
  }

  get rate() {
    return SPEEDS[this.speed];
  }

  /** Hours as a float, 0..24. */
  get hours() {
    return this.minutes / 60;
  }

  setSpeed(id) {
    if (!(id in SPEEDS) || id === this.speed) return;
    this.speed = id;
    this.emit('speed', id);
    this.persist();
  }

  /** Advance by real seconds. Returns game minutes that passed. */
  tick(dt) {
    const passed = dt * this.rate;
    if (passed <= 0) return 0;
    this.minutes += passed;
    while (this.minutes >= 1440) {
      this.minutes -= 1440;
      this.day += 1;
      this.emit('day', this.day);
    }
    const whole = Math.floor(this.minutes);
    if (whole !== this._lastMinute) {
      this._lastMinute = whole;
      this.emit('minute', whole);
    }
    this._saveIn -= dt;
    if (this._saveIn <= 0) {
      this._saveIn = 5;
      this.persist();
    }
    return passed;
  }

  /** Move the clock to a time of day. Moving backwards starts the next day. */
  jumpTo(minutes, { sameDay = false } = {}) {
    const target = ((minutes % 1440) + 1440) % 1440;
    if (!sameDay && target < this.minutes - 0.5) {
      this.day += 1;
      this.emit('day', this.day);
    }
    this.minutes = target;
    this._lastMinute = Math.floor(target);
    this.emit('jump', target);
    this.emit('minute', this._lastMinute);
    this.persist();
  }

  syncToReal() {
    this.jumpTo(realMinutes(), { sameDay: true });
  }

  persist() {
    save('clock', { minutes: this.minutes, day: this.day, speed: this.speed });
  }
}
