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

  registerOpener(id, button) {
    this.extraOpeners.set(button, id);
    button.addEventListener('click', (e) => this.toggle(id, button, e.detail === 0));
  }

  /** `keyboard`: opened with Enter or Space, so focus moves into the panel. */
  toggle(id, opener, keyboard = false) {
    if (this.current === id) this.close();
    else this.open(id, opener, { keyboard });
  }

  open(id, opener = null, { keyboard = false } = {}) {
    if (this.current && this.current !== id) this._hide(this.current);
    const panel = this.panels.get(id);
    if (!panel) return;
    panel.inert = false;
    panel.dataset.open = 'true';
    this.current = id;
    this.opener = opener || this.tabs.find((t) => t.dataset.panel === id);
    this._syncButtons();
    if (keyboard) {
      const target = (panel.dataset.focus && panel.querySelector(panel.dataset.focus)) || panel.querySelector(FOCUSABLE);
      // The panel is visible as soon as data-open is set, so it can take focus now.
      if (target) target.focus({ preventScroll: true });
    }
    this.emit('open', id);
  }
}
