import * as THREE from 'three';
import { damp, clamp } from '../core/emitter.js';
import { SPOTS, SHORE_LOOP, route, FLOOR, FURNITURE as F } from '../sim/layout.js';
import { groundHeight } from './terrain.js';

const OUTFIT = {
  summer: '#e4ded2',
  spring: '#9ba78b',
  rainy: '#b8954f',
  autumn: '#a6604a',
  winter: '#4d5154',
};

const SEAT = { sofa: 0.5, armchair: 0.5, dine: 0.52, desk: 0.52, deckChair: 0.46, guitar: 0.52 };

// Joint names; every pose fills these.
const JOINTS = ['hipY', 'spineX', 'spineZ', 'headX', 'headY', 'shLx', 'shLz', 'elL', 'shRx', 'shRz', 'elR', 'thL', 'knL', 'thR', 'knR', 'lie'];

function base(o = {}) {
  return {
    hipY: 0.93, spineX: 0, spineZ: 0, headX: 0, headY: 0,
    shLx: 0.05, shLz: 0.09, elL: -0.18, shRx: 0.05, shRz: -0.09, elR: -0.18,
    thL: 0, knL: 0.02, thR: 0, knR: 0.02, lie: 0, ...o,
  };
}

function sitBase(seat, o = {}) {
  return base({ hipY: seat + 0.02, thL: -1.5, knL: 1.48, thR: -1.45, knR: 1.42, shLx: -0.3, elL: -0.9, shRx: -0.3, elR: -0.9, spineX: 0.04, ...o });
}

/** Pose functions: (t, seat) -> joint targets. t is real seconds. */
const POSES = {
  stand: (t) => base({ spineX: 0.015 * Math.sin(t * 1.4), headY: 0.15 * Math.sin(t * 0.21) }),
  walk: () => base(),
  stretch: (t) => {
    const k = Math.sin(t * 0.7);
    return base({ shLx: -2.85, shLz: 0.25, elL: -0.25, shRx: -2.85, shRz: -0.25, elR: -0.25, spineZ: 0.16 * k, headX: -0.15, spineX: -0.05 });
  },
  cook: (t) => base({
    spineX: 0.12, headX: 0.38,
    shLx: -0.55, shLz: 0.12, elL: -1.05,
    shRx: -0.62 + 0.08 * Math.sin(t * 3.1), shRz: -0.14 + 0.1 * Math.cos(t * 3.1), elR: -0.95 + 0.12 * Math.sin(t * 3.1 + 1),
  }),
  standDrink: (t) => {
    const p = (t % 9) / 9;
    const lift = p > 0.55 && p < 0.8 ? Math.sin(((p - 0.55) / 0.25) * Math.PI) : 0;
    return base({ shRx: -0.45 - 0.75 * lift, shRz: -0.2, elR: -1.55 - 0.65 * lift, headX: 0.05 - 0.25 * lift, shLx: 0.08, elL: -0.2, headY: 0.12 * Math.sin(t * 0.17) });
  },
  reach: (t) => base({ shRx: -2.35 + 0.08 * Math.sin(t * 0.9), shRz: -0.12, elR: -0.3, headX: -0.28, spineX: -0.05 }),
  crouch: (t) => base({ hipY: 0.5, thL: -1.95, knL: 2.35, thR: -1.85, knR: 2.3, spineX: 0.55, headX: 0.15, shLx: -0.9, elL: -0.6, shRx: -1.0 + 0.15 * Math.sin(t * 1.3), elR: -0.5 }),
  sitRead: (t, seat) => sitBase(seat, { spineX: 0.12, headX: 0.42 + 0.03 * Math.sin(t * 0.3), shLx: -0.62, shLz: 0.3, elL: -1.45, shRx: -0.62, shRz: -0.3, elR: -1.45 }),
  sitType: (t, seat) => sitBase(seat, {
    spineX: 0.2, headX: 0.32,
    shLx: -0.62, shLz: 0.14, elL: -0.95 + 0.05 * Math.max(0, Math.sin(t * 13)),
    shRx: -0.62, shRz: -0.14, elR: -0.95 + 0.05 * Math.max(0, Math.sin(t * 11 + 2)),
  }),
  sitWrite: (t, seat) => sitBase(seat, {
    spineX: 0.26, headX: 0.45,
    shLx: -0.52, shLz: 0.22, elL: -1.15,
    shRx: -0.66 + 0.03 * Math.sin(t * 5), shRz: -0.16 + 0.05 * Math.sin(t * 2.3), elR: -1.0,
  }),
  sitDrink: (t, seat) => {
    const p = (t % 8) / 8;
    const lift = p > 0.5 && p < 0.78 ? Math.sin(((p - 0.5) / 0.28) * Math.PI) : 0;
    return sitBase(seat, { spineX: -0.05, shRx: -0.4 - 0.8 * lift, shRz: -0.18, elR: -1.5 - 0.7 * lift, headX: 0.05 - 0.25 * lift, shLx: -0.25, elL: -1.0, headY: 0.18 * Math.sin(t * 0.15) });
  },
  sitEat: (t, seat) => {
    const p = (t % 5) / 5;
    const lift = p > 0.4 && p < 0.7 ? Math.sin(((p - 0.4) / 0.3) * Math.PI) : 0;
    return sitBase(seat, { spineX: 0.16, headX: 0.25, shLx: -0.55, elL: -1.0, shRx: -0.55 - 0.45 * lift, elR: -1.0 - 0.9 * lift });
  },
  sitGuitar: (t, seat) => sitBase(seat, {
    spineX: 0.1, headX: 0.32, headY: 0.32,
    shLx: -0.75, shLz: 0.62, elL: -1.15,
    shRx: -0.45, shRz: -0.3, elR: -1.25 + 0.22 * Math.sin(t * 7.5),
  }),
  sleep: (t) => base({ lie: 1, hipY: 0.62, spineX: 0.012 * Math.sin(t * 1.1), shLx: 0, shLz: 0.12, elL: -0.1, shRx: 0, shRz: -0.12, elR: -0.1, thL: -0.08, knL: 0.15, thR: -0.04, knR: 0.08, headY: 0.25 }),
};
