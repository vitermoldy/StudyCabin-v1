import * as THREE from 'three';
import { rng } from '../core/emitter.js';

// Procedural textures drawn on canvases, so the scene ships without image files.
// Every texture tiles; UVs in the cabin are in metres, so `repeat` sets the size.

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function finish(c, { repeat = [1, 1], srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 4;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function grain(ctx, w, h, rand, amount, alpha = 0.06) {
  for (let i = 0; i < amount; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const l = rand() > 0.5 ? 255 : 0;
    ctx.fillStyle = `rgba(${l},${l},${l},${alpha * rand()})`;
    ctx.fillRect(x, y, 1 + rand() * 2, 1 + rand() * 6);
  }
}

/** Vertical board-and-batten siding: one tile is 1.2 m wide, 1.2 m tall. */
export function sidingTexture() {
  const [c, ctx] = canvas(256, 256);
  const rand = rng(11);
  ctx.fillStyle = '#9aa197';
  ctx.fillRect(0, 0, 256, 256);
  const boards = 6;
  const bw = 256 / boards;
  for (let i = 0; i < boards; i++) {
    const tone = 0.88 + rand() * 0.2;
    ctx.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(158 * tone)},${Math.round(146 * tone)})`;
    ctx.fillRect(i * bw, 0, bw, 256);
    // weathering streaks run down the board
    for (let k = 0; k < 18; k++) {
      ctx.fillStyle = `rgba(60,66,58,${0.04 + rand() * 0.07})`;
      ctx.fillRect(i * bw + rand() * bw, 0, 1 + rand() * 2, 256);
    }
  }
  grain(ctx, 256, 256, rand, 1400, 0.05);
  for (let i = 0; i < boards; i++) {
    const x = Math.round(i * bw);
    ctx.fillStyle = 'rgba(30,34,30,0.55)';
    ctx.fillRect(x, 0, 2, 256); // shadow beside the batten
    ctx.fillStyle = 'rgba(205,212,200,0.35)';
    ctx.fillRect(x + 2, 0, 3, 256); // batten edge catching light
    ctx.fillStyle = 'rgba(30,34,30,0.25)';
    ctx.fillRect(x + 5, 0, 1, 256);
  }
  return finish(c, { repeat: [1 / 1.2, 1 / 1.2] });
}

/** Standing-seam metal roof: seams every 0.45 m along the slope. */
export function roofTexture() {
  const [c, ctx] = canvas(256, 256);
  const rand = rng(23);
  ctx.fillStyle = '#7b7f81';
  ctx.fillRect(0, 0, 256, 256);
  grain(ctx, 256, 256, rand, 900, 0.05);
  const seams = 4;
  for (let i = 0; i < seams; i++) {
    const x = Math.round((i * 256) / seams);
    ctx.fillStyle = 'rgba(25,27,29,0.6)';
    ctx.fillRect(x, 0, 2, 256);
    ctx.fillStyle = 'rgba(230,232,235,0.4)';
    ctx.fillRect(x + 2, 0, 2, 256);
    ctx.fillStyle = 'rgba(25,27,29,0.2)';
    ctx.fillRect(x + 4, 0, 3, 256);
  }
  // faint rain stains
  for (let k = 0; k < 30; k++) {
    ctx.fillStyle = `rgba(40,42,44,${0.03 + rand() * 0.05})`;
    ctx.fillRect(rand() * 256, 0, 1 + rand() * 3, 256);
  }
  return finish(c, { repeat: [1 / 1.8, 1 / 1.8] });
}

/** Grey weathered deck planks, 0.14 m wide, laid along x. */
export function deckTexture() {
  const [c, ctx] = canvas(256, 256);
  const rand = rng(37);
  const rows = 8;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 200;
    while (x < 256) {
      const len = 120 + rand() * 160;
      const tone = 0.84 + rand() * 0.22;
      ctx.fillStyle = `rgb(${Math.round(162 * tone)},${Math.round(158 * tone)},${Math.round(150 * tone)})`;
      ctx.fillRect(x, r * rh, len, rh);
      ctx.fillStyle = 'rgba(30,26,22,0.6)';
      ctx.fillRect(x + len - 1, r * rh, 2, rh);
      x += len;
    }
    ctx.fillStyle = 'rgba(25,22,18,0.75)';
    ctx.fillRect(0, r * rh + rh - 2, 256, 2);
  }
  grain(ctx, 256, 256, rand, 1600, 0.06);
  return finish(c, { repeat: [1 / 1.15, 1 / 1.15] });
}

/** Warm interior floorboards. */
export function floorTexture() {
  const [c, ctx] = canvas(256, 256);
  const rand = rng(41);
  const rows = 6;
  const rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    let x = -rand() * 200;
    while (x < 256) {
      const len = 140 + rand() * 180;
      const tone = 0.85 + rand() * 0.2;
      ctx.fillStyle = `rgb(${Math.round(176 * tone)},${Math.round(136 * tone)},${Math.round(98 * tone)})`;
      ctx.fillRect(x, r * rh, len, rh);
      ctx.fillStyle = 'rgba(60,40,24,0.5)';
      ctx.fillRect(x + len - 1, r * rh, 1, rh);
      x += len;
    }
    ctx.fillStyle = 'rgba(50,32,20,0.55)';
    ctx.fillRect(0, r * rh + rh - 1, 256, 1);
  }
  grain(ctx, 256, 256, rand, 1300, 0.05);
  return finish(c, { repeat: [1 / 1.1, 1 / 1.1] });
}
