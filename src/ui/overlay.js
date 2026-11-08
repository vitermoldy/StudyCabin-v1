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

  setStory(line, meta) {
    if (this.story.textContent !== line) this.story.textContent = line;
    if (this.meta.textContent !== meta) this.meta.textContent = meta;
  }

  /** CSS-pixel rectangles of the three words, for sampling the scene behind them. */
  rects() {
    return [this.word, this.at, this.timeWrap].map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top + r.height * 0.15, w: Math.max(1, r.width), h: Math.max(1, r.height * 0.7) };
    });
  }

  /**
   * Pick the ink with the better worst-case contrast over the sampled area.
   * samples: [{mean, max, min}] relative luminance.
   */
  applyInk(samples) {
    const L_LIGHT = 0.9; // #f4f3ef
    const L_DARK = 0.0118; // #1b1c1a
    const ratio = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    [this.word, this.at, this.timeWrap].forEach((el, i) => {
      const s = samples[i];
      if (!s) return;
      const light = Math.min(ratio(L_LIGHT, s.max), ratio(L_LIGHT, s.mean));
      const dark = Math.min(ratio(L_DARK, s.min), ratio(L_DARK, s.mean));
      const prev = this.inks.get(el) || 'light';
      // A little hysteresis so the words do not flicker at the threshold.
      let next = prev;
      if (prev === 'light' && dark > light * 1.25) next = 'dark';
      if (prev === 'dark' && light > dark * 1.25) next = 'light';
      if (next !== prev || !el.dataset.ink) {
        this.inks.set(el, next);
        el.dataset.ink = next;
      }
    });
  }
}
