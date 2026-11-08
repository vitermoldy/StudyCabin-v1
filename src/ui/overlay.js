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

  setWord(text) {
    if (text === this.currentWord) return;
    this.currentWord = text;
    const el = this.word;
    el.textContent = '';
    const said = document.createElement('span');
    said.className = 'sr-only';
    said.textContent = text;
    el.appendChild(said);
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.className = 'ch';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = ch;
      s.style.setProperty('--i', i);
      el.appendChild(s);
      if (!this.reduced) requestAnimationFrame(() => s.classList.add('is-in'));
    });
  }

  setTime(minutes) {
    const text = formatClock(minutes);
    if (text === this.lastTime) return;
    const prev = this.lastTime;
    this.lastTime = text;
    this.clock.setAttribute('datetime', text);
    if (!prev || this.reduced) {
      this.clock.textContent = text;
      return;
    }
    // Only the characters that changed cross-fade.
    this.clock.textContent = '';
    [...text].forEach((ch, i) => {
      const s = document.createElement('span');
      s.textContent = ch;
      if (ch !== prev[i]) s.className = 'digit-swap';
      this.clock.appendChild(s);
    });
  }
}
