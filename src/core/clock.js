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
}
