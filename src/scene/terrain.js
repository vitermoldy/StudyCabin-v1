import * as THREE from 'three';
import { rng, smoothstep } from '../core/emitter.js';
import { WORLD } from './materials.js';

// ---------- noise shared by the ground, the grass and the mountains ----------
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4) {
  let v = 0;
  let a = 0.5;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x, y);
    x = x * 2.02 + 13.7;
    y = y * 2.02 + 7.3;
    a *= 0.5;
  }
  return v;
}

export const SHORE_Z = 10.8;

/** Height of the sand and dunes at a point. */
export function groundHeight(x, z) {
  let y = 0;
  if (z > SHORE_Z) y -= (z - SHORE_Z) * 0.085;
  const dx = Math.max(0, Math.abs(x + 0.5) - 12.2);
  const dzBack = Math.max(0, -4.6 - z);
  const away = Math.hypot(dx, dzBack);
  const front = z > -4.6 ? smoothstep(10.5, 3.5, z) : 1;
  const dune = smoothstep(0, 7, away) * front;
  y += dune * (0.35 + fbm(x * 0.045, z * 0.05) * 2.7 + Math.min(dzBack, 45) * 0.035);
  if (z < -60) y += smoothstep(-60, -150, z) * (2 + fbm(x * 0.012, z * 0.012) * 6);
  y += (vnoise(x * 0.8, z * 0.8) - 0.5) * 0.05;
  return y;
}

/** How much a point reads as vegetated dune (0..1). */
function duneness(x, z) {
  const dx = Math.max(0, Math.abs(x + 0.5) - 12.2);
  const dzBack = Math.max(0, -4.6 - z);
  const front = z > -4.6 ? smoothstep(10.5, 3.5, z) : 1;
  return smoothstep(1.5, 6, Math.hypot(dx, dzBack)) * front;
}

/** How thickly grass covers a point, 0..1. The deck, the path and the beach stay clear. */
export function grassCover(x, z) {
  if (z > 9.6) return 0;
  if (x > -11.4 && x < 10.4 && z > -3.8 && z < 7.8) return 0;
  if (Math.abs(x + 0.5) < 12.5 && z > 5.5) return 0;
  const side = x < -11 || x > 10.5 ? smoothstep(9.6, 6.5, z) : 0;
  const byCabin = z < 8 && z > -20 && x > -28 && x < 27 ? 0.85 : 0;
  const cover = Math.max(duneness(x, z), side, byCabin);
  const patchy = fbm(x * 0.07 + 3.1, z * 0.07, 3);
  return smoothstep(0.22, 0.5, cover * (0.55 + patchy));
}

function warp(u) {
  const a = Math.abs(u);
  return Math.sign(u) * (0.1 * a + 0.9 * a * a);
}

function buildGround() {
  const NX = 230;
  const NZ = 200;
  const pos = [];
  const mix = [];
  for (let j = 0; j <= NZ; j++) {
    const v = (j / NZ) * 2 - 1;
    const z = v < 0 ? warp(v) * 420 : warp(v) * 80;
    for (let i = 0; i <= NX; i++) {
      const u = (i / NX) * 2 - 1;
      const x = warp(u) * 520;
      const y = groundHeight(x, z);
      pos.push(x, y, z);
      const wet = smoothstep(SHORE_Z - 1.6, SHORE_Z + 0.4, z);
      const veg = Math.max(grassCover(x, z), duneness(x, z) * 0.35);
      mix.push(wet, Math.min(1, veg), vnoise(x * 0.35, z * 0.35));
    }
  }
  const idx = [];
  for (let j = 0; j < NZ; j++) {
    for (let i = 0; i < NX; i++) {
      const a = j * (NX + 1) + i;
      const b = a + 1;
      const c = a + NX + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aMix', new THREE.Float32BufferAttribute(mix, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Caustics: the bright net light draws on a sandy bottom under clear water
// (the water-turbulence pattern, a few warped sine iterations).
const CAUSTIC = /* glsl */ `
  float caustic(vec2 p, float t){
    vec2 i = p;
    float c = 1.0;
    float inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0;
    c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }
`;
