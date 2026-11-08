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
