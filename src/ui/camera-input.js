/**
 * Moving the camera by hand on the scene canvas, like a map.
 * Mouse: drag to move across the land, right-drag or Ctrl+drag to turn and tilt (keep dragging
 * down past level ground to look up at the sky), wheel to zoom toward the pointer, double-click
 * to go back to the view. Touch: one finger moves, two fingers pinch to zoom, twist to turn and
 * slide up or down together to tilt. A tap on the sea rings the water; Shift+drag draws a trail
 * of ripples.
 */
export function mountCameraInput(canvas, { getWorld, onRender }) {
  const html = document.documentElement;
  const pointers = new Map();
  let mode = null;
  let moved = 0;
  let pinchDist = 0;
  let pinchMid = null;
  let pinchAngle = 0;
  let lastRipple = 0;

  const two = () => [...pointers.values()].slice(0, 2);
  const spread = () => {
    const [a, b] = two();
    return Math.hypot(a.x - b.x, a.y - b.y) || 1;
  };
  const middle = () => {
    const [a, b] = two();
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  };
  const angle = () => {
    const [a, b] = two();
    return Math.atan2(b.y - a.y, b.x - a.x);
  };

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  canvas.addEventListener('pointerdown', (e) => {
    const w = getWorld();
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable: fine */
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      moved = 0;
      if (e.shiftKey) {
        mode = 'ripple';
        if (w) w.poke(e.clientX, e.clientY, 0.6);
      } else if (e.button === 2 || e.button === 1 || e.ctrlKey || e.metaKey) mode = 'orbit';
      else mode = 'pan';
    } else if (pointers.size === 2) {
      mode = 'pinch';
      pinchDist = spread();
      pinchMid = middle();
      pinchAngle = angle();
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    const w = getWorld();
    if (!w) return;
    if (mode === 'pinch' && pointers.size >= 2) {
      // Pinch zooms toward the point between the fingers, a
      const d = spread();
      w.rig.zoomBy(pinchDist / d);
      pinchDist = d;
      const m = middle();
      w.rig.pan(m.x - pinchMid.x, m.y - pinchMid.y);
      pinchMid = m;
      onRender();
      return;
    }
    if (moved < 5) return;
    if (mode === 'ripple') {
      const now = performance.now();
      if (now - lastRipple > 30) {
        lastRipple = now;
        w.poke(e.clientX, e.clientY, 0.35);
      }
      return;
    }
    html.classList.add('is-dragging');
    if (mode === 'orbit') w.rig.orbit(dx, dy);
    else if (mode === 'pan') w.rig.pan(dx, dy);
    onRender();
  });

  const end = (e) => {
    if (!pointers.has(e.pointerId)) return;
    const tap = pointers.size === 1 && moved < 5 && mode !== 'pinch' && mode !== 'ripple';
    pointers.delete(e.pointerId);
    if (pointers.size === 0) {
      html.classList.remove('is-dragging');
      const w = getWorld();
      if (tap && e.type === 'pointerup' && w) w.poke(e.clientX, e.clientY, 0.7);
      mode = null;
    } else if (pointers.size === 1) {
      mode = 'orbit';
      moved = 5;
    }
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  canvas.addEventListener('wheel', (e) => {
    const w = getWorld();
    if (!w) return;
    e.preventDefault();
    const delta = e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY;
    w.rig.zoomBy(Math.exp(Math.max(-200, Math.min(200, delta)) * 0.0011));
    onRender();
  }, { passive: false });

  canvas.addEventListener('dblclick', () => {
    const w = getWorld();
    if (w) {
      w.rig.resetUser();
      onRender();
    }
  });
}
