import { formatClock } from '../core/emitter.js';

/**
 * The reference's giant three-word composition, turned into live state:
 * "<activity> at <time>". The word blurs in letter by letter when the
 * resident starts something new; the ink flips between light and dark so the
 * words keep 3:1 against whatever the scene shows behind them.
 */
export class Overlay {
  constructor({ reducedMotion }) {
    this.word = document.getElementById('word-activity');
    this.at = document.querySelector('.big--b');
    this.timeWrap = document.getElementById('word-time');
    this.clock = document.getElementById('clock');
    this.story = document.getElementById('story-line');
    this.meta = document.getElementById('story-meta');
    this.reduced = reducedMotion;
    this.currentWord = '';
    this.lastTime = '';
    this.inks = new Map();
  }
}
