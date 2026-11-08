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

/** Vertical wood panelling for the inside walls. */
export function panelTexture() {
  const [c, ctx] = canvas(256, 256);
  const rand = rng(53);
  const n = 5;
  const w = 256 / n;
  for (let i = 0; i < n; i++) {
    const tone = 0.86 + rand() * 0.18;
    ctx.fillStyle = `rgb(${Math.round(150 * tone)},${Math.round(116 * tone)},${Math.round(86 * tone)})`;
    ctx.fillRect(i * w, 0, w, 256);
    for (let k = 0; k < 10; k++) {
      ctx.fillStyle = `rgba(80,52,30,${0.04 + rand() * 0.06})`;
      ctx.fillRect(i * w + rand() * w, 0, 1 + rand() * 2, 256);
    }
    ctx.fillStyle = 'rgba(50,32,20,0.45)';
    ctx.fillRect(Math.round(i * w), 0, 1, 256);
  }
  grain(ctx, 256, 256, rand, 800, 0.04);
  return finish(c, { repeat: [1 / 1.4, 1 / 1.4] });
}

/** A soft knit / linen weave used on fabrics. */
export function fabricTexture() {
  const [c, ctx] = canvas(64, 64);
  const rand = rng(61);
  ctx.fillStyle = '#d8d8d8';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.03 + rand() * 0.03})`;
    ctx.fillRect(0, y, 64, 1);
  }
  for (let x = 0; x < 64; x += 2) {
    ctx.fillStyle = `rgba(255,255,255,${0.03 + rand() * 0.03})`;
    ctx.fillRect(x, 0, 1, 64);
  }
  return finish(c, { repeat: [3, 3] });
}

/** Abstract sea print for the frame above the sofa. */
export function printTexture() {
  const [c, ctx] = canvas(256, 192);
  ctx.fillStyle = '#e9e5dc';
  ctx.fillRect(0, 0, 256, 192);
  ctx.fillStyle = '#9aa6a3';
  ctx.fillRect(0, 118, 256, 74);
  ctx.strokeStyle = 'rgba(60,70,72,0.55)';
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    for (let x = 0; x <= 256; x += 8) {
      const y = 126 + i * 10 + Math.sin(x * 0.05 + i) * 3;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.fillStyle = '#c98f5a';
  ctx.beginPath();
  ctx.arc(176, 92, 18, 0, Math.PI * 2);
  ctx.fill();
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 1);
  return t;
}

/** Spines of books on a shelf. */
export function booksTexture() {
  const [c, ctx] = canvas(256, 64);
  const rand = rng(71);
  const palette = ['#7d4a36', '#3f5560', '#c9b48e', '#6b6f4b', '#a7643c', '#2f3a3f', '#d8cdb8', '#8a7a62'];
  let x = 0;
  while (x < 256) {
    const w = 6 + rand() * 10;
    const h = 40 + rand() * 24;
    ctx.fillStyle = palette[Math.floor(rand() * palette.length)];
    ctx.fillRect(x, 64 - h, w - 1, h);
    x += w;
  }
  const t = finish(c);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.repeat.set(1, 1);
  return t;
}
