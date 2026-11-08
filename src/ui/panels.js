import { Emitter } from '../core/emitter.js';

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], select, textarea, [tabindex]:not([tabindex="-1"])';

/** The dock and its panels: one open at a time, Escape closes, focus returns. */
export class Panels extends Emitter {
  constructor() {
    super();
    this.tabs = [...document.querySelectorAll('.dock__tab')];
    this.panels = new Map(this.tabs.map((t) => [t.dataset.panel, document.getElementById(t.getAttribute('aria-controls'))]));
    this.extraOpeners = new Map(); // other buttons that open a panel, e.g. "Add music"
    this.current = null;
    this.opener = null;

    for (const t of this.tabs) t.addEventListener('click', (e) => this.toggle(t.dataset.panel, t, e.detail === 0));
    for (const p of this.panels.values()) {
      p.querySelector('.panel__close').addEventListener('click', () => this.close());
    }
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.current) {
        e.preventDefault();
        this.close();
      }
    });
    // Clicking the scene closes the open panel.
    document.getElementById('scene').addEventListener('pointerdown', () => this.close(false));
  }
}
