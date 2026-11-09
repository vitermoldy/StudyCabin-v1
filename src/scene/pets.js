import * as THREE from 'three';
import { FLOOR, SPINE_Z, DECK_Z, route, approachPath } from '../sim/layout.js';

// The resident's pets. The dog goes where the resident goes: it walks the resident's own steps a
// metre behind (so it never cuts through glass or furniture), lies down beside the chair, the
// sofa or the desk, sits while the resident stands, follows them out on the deck and the walk,
// and sleeps in its basket by the stove at night. The cat keeps its own day: the foot of the bed
// at night, its bowl at breakfast and dinner, the sunny deck on fine mornings (the glass on cold
// or wet ones), the sofa in the afternoon and the evening, the armchair or the glass by the desk
// in between. Both are a few soft shapes, lit and shadowed like everything else.

const ball = new THREE.SphereGeometry(1, 14, 10);
const p = (x, z, y = FLOOR) => ({ x, y, z });
const GAP = 1.1; // how far behind the resident the dog keeps

function coat(hex) {
  return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.9, metalness: 0 });
}

function blob(material, [sx, sy, sz], [x, y, z], tilt = 0) {
  const mesh = new THREE.Mesh(ball, material);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.rotation.z = tilt;
  mesh.castShadow = true;
  return mesh;
}

// A leg hanging from its hip or shoulder; rotating the pivot about z swings it forward (+) or back.
function leg(material, length, top, bottom, [x, y, z]) {
  const g = new THREE.CylinderGeometry(top, bottom, length, 6);
  g.translate(0, -length / 2, 0);
  const pivot = new THREE.Group();
  pivot.position.set(x, y, z);
  const mesh = new THREE.Mesh(g, material);
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

/** A model is built facing +x; `inner` turns it so that facing 0 looks down +z, as the resident does. */
function frame() {
  const root = new THREE.Group();
  const inner = new THREE.Group();
  inner.rotation.y = -Math.PI / 2;
  root.add(inner);
  const body = new THREE.Group();
  inner.add(body);
  return { root, body };
}

function makeDog() {
  const fur = coat('#c4914e');
  const pale = coat('#ecd9b4');
  const dark = coat('#2e221a');
  const { root, body } = frame();
  body.add(blob(fur, [0.3, 0.14, 0.13], [0, 0, 0]));
  body.add(blob(pale, [0.12, 0.11, 0.1], [0.2, -0.02, 0]));
  const neck = new THREE.Group();
  neck.position.set(0.26, 0.06, 0);
  body.add(neck);
  neck.add(blob(fur, [0.07, 0.12, 0.07], [0.04, 0.08, 0], -0.5));
  const head = new THREE.Group();
  head.position.set(0.1, 0.2, 0);
  neck.add(head);
  head.add(blob(fur, [0.11, 0.095, 0.09], [0, 0, 0]));
  head.add(blob(fur, [0.08, 0.05, 0.055], [0.11, -0.03, 0]));
  head.add(blob(dark, [0.022, 0.02, 0.025], [0.19, -0.02, 0]));
  for (const side of [-1, 1]) {
    head.add(blob(dark, [0.013, 0.013, 0.013], [0.07, 0.03, side * 0.05]));
    const ear = blob(fur, [0.035, 0.08, 0.02], [-0.02, -0.02, side * 0.085]);
    ear.rotation.x = side * 0.25;
    head.add(ear);
  }
  const tail = new THREE.Group();
  tail.position.set(-0.28, 0.05, 0);
  body.add(tail);
  tail.add(blob(fur, [0.15, 0.035, 0.035], [-0.13, 0.05, 0], 0.4));
  const legs = [[0.18, 0.075], [0.18, -0.075], [-0.2, 0.075], [-0.2, -0.075]].map(([x, z]) => {
    const l = leg(fur, 0.37, 0.035, 0.025, [x, -0.04, z]);
    body.add(l);
    return l;
  });
  // Standing height of the body's centre, and each pose as targets for the joints. Leg angles are
  // relative to the body; the body's pitch tips its front end up (+).
  const poses = {
    stand: { y: 0.42, pitch: 0, neck: 0, turn: 0, front: 0, rear: 0, tail: 0.5, wag: 0.25 },
    sit: { y: 0.36, pitch: 0.55, neck: -0.2, turn: 0, front: -0.55, rear: 0.8, tail: -0.2, wag: 0.5 },
    lie: { y: 0.15, pitch: 0, neck: -0.4, turn: 0, front: 1.45, rear: 1.2, tail: -0.4, wag: 0.15 },
    sleep: { y: 0.15, pitch: 0, neck: -0.85, turn: 0.5, front: 1.45, rear: 1.2, tail: -0.6, wag: 0 },
  };
  return { root, body, neck, head, tail, legs, poses, stride: 0.75, swing: 0.5 };
}

function makeCat() {
  const fur = coat('#6b655e');
  const pale = coat('#d9d1c4');
  const dark = coat('#26221f');
  const { root, body } = frame();
  body.add(blob(fur, [0.19, 0.08, 0.07], [0, 0, 0]));
  body.add(blob(pale, [0.07, 0.06, 0.055], [0.13, -0.02, 0]));
  const neck = new THREE.Group();
  neck.position.set(0.17, 0.04, 0);
  body.add(neck);
  const head = new THREE.Group();
  head.position.set(0.05, 0.07, 0);
  neck.add(head);
  head.add(blob(fur, [0.07, 0.062, 0.068], [0, 0, 0]));
  head.add(blob(pale, [0.035, 0.025, 0.035], [0.055, -0.02, 0]));
  head.add(blob(dark, [0.012, 0.01, 0.012], [0.09, -0.01, 0]));
  for (const side of [-1, 1]) {
    head.add(blob(dark, [0.011, 0.011, 0.011], [0.055, 0.02, side * 0.03]));
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.05, 5), fur);
    ear.position.set(-0.005, 0.06, side * 0.035);
    ear.rotation.x = side * -0.25;
    ear.castShadow = true;
    head.add(ear);
  }
  // The tail: four links, each bending a little, so it can stand up, hang or wrap round the feet.
  const tail = new THREE.Group();
  tail.position.set(-0.18, 0.03, 0);
  body.add(tail);
  const links = [];
  let parent = tail;
  for (let i = 0; i < 4; i++) {
    const link = new THREE.Group();
    if (i) link.position.set(-0.075, 0, 0);
    parent.add(link);
    link.add(blob(fur, [0.045, 0.017, 0.017], [-0.037, 0, 0]));
    links.push(link);
    parent = link;
  }
  const legs = [[0.12, 0.04], [0.12, -0.04], [-0.12, 0.04], [-0.12, -0.04]].map(([x, z]) => {
    const l = leg(fur, 0.17, 0.018, 0.014, [x, -0.02, z]);
    body.add(l);
    return l;
  });
  const poses = {
    stand: { y: 0.2, pitch: 0, neck: 0.1, turn: 0, front: 0, rear: 0, tail: 0.38, wrap: 0 },
    sit: { y: 0.16, pitch: 0.75, neck: -0.45, turn: 0, front: -0.75, rear: 0.65, tail: -0.1, wrap: 0.45 },
    loaf: { y: 0.085, pitch: 0, neck: 0.05, turn: 0, front: 1.5, rear: 1.5, tail: -0.05, wrap: 0.4 },
    curl: { y: 0.075, pitch: 0, neck: -0.5, turn: 1.1, front: 1.5, rear: 1.5, tail: 0, wrap: 0.55 },
    eat: { y: 0.17, pitch: -0.12, neck: -0.9, turn: 0, front: 0.12, rear: 0, tail: 0.2, wrap: 0 },
  };
  return { root, body, neck, head, tail, links, legs, poses, stride: 0.35, swing: 0.6 };
}

/** Each joint eases toward the pose; legs swing while walking. */
function applyPose(m, state, name, dt, t, walking) {
  const target = m.poses[walking ? 'stand' : name] || m.poses.stand;
  const j = state.j || (state.j = { ...target });
  const k = dt > 0 ? 1 - Math.exp(-dt * 5) : 1;
  for (const key of Object.keys(target)) j[key] += (target[key] - j[key]) * k;
  m.body.position.y = j.y + (walking ? Math.abs(Math.sin(state.step)) * 0.012 : 0);
  m.body.rotation.z = j.pitch;
  m.neck.rotation.z = j.neck;
  m.neck.rotation.y = j.turn;
  m.legs.forEach((l, i) => {
    const front = i < 2;
    const swing = walking ? Math.sin(state.step + (i === 0 || i === 3 ? 0 : Math.PI)) * m.swing : 0;
    l.rotation.z = (front ? j.front : j.rear) + swing;
  });
  if (m.links) {
    // The cat's tail: up and gently curling at the tip while walking, round the paws at rest.
    m.links.forEach((link, i) => {
      link.rotation.z = (i === 0 ? j.tail * 2.2 : j.tail * 0.6) + Math.sin(t * 1.3 + i) * 0.06;
      link.rotation.y = j.wrap * (i + 1) * 0.5;
    });
  } else {
    m.tail.rotation.z = j.tail;
    m.tail.rotation.y = Math.sin(t * (walking ? 9 : 6)) * j.wag;
  }
}

// The dog's basket by the stove and the cat's spots, on the same hub lines as the resident's.
const DOG_SPOTS = {
  basket: { area: 'in', via: [p(2.45, SPINE_Z), p(2.45, -1.55)], at: p(2.45, -2.3, FLOOR + 0.08), face: 1.2 },
};
const CAT_SPOTS = {
  bed: { area: 'in', via: [p(5.3, SPINE_Z), p(5.3, -0.55)], at: p(5.1, -1.05, FLOOR + 0.69), pose: 'curl', face: 2.4 },
  sofa: { area: 'in', via: [p(-0.4, SPINE_Z), p(-0.4, -1.05), p(-0.85, -1.05)], at: p(-0.85, -1.72, FLOOR + 0.5), pose: 'curl', face: 1.2 },
  window: { area: 'in', via: [p(-1.7, SPINE_Z)], at: p(-1.7, 2.62), pose: 'sit', face: 0 },
  deskWindow: { area: 'in', via: [p(2.9, SPINE_Z)], at: p(2.9, 2.62), pose: 'sit', face: 0 },
  bowl: { area: 'in', via: [p(-3.6, SPINE_Z), p(-3.6, -1.6)], at: p(-3.6, -1.92), pose: 'eat', face: Math.PI },
  armchair: { area: 'in', via: [p(1.6, SPINE_Z), p(1.6, 0.95)], at: p(0.95, 0.15, FLOOR + 0.42), pose: 'loaf', face: -0.42 },
  deck: { area: 'deck', via: [p(2.6, DECK_Z)], at: p(2.6, 5.3), pose: 'loaf', face: 0.6 },
};

// Footprints the pets keep out of (x0, x1, z0, z1): furniture inside, chairs and the fire bowl
// on the deck. Only used to pick where the dog settles beside the resident.
const BLOCKS = [
  [-6.98, -3.78, -3.0, -2.38], [-6.25, -4.55, -1.21, -0.43], [-5.75, -4.25, 0.2, 2.25], [-3.58, -2.52, -3.0, -2.48],
  [-2.55, -0.45, -2.31, -1.39], [-2.05, -0.95, -0.72, -0.12], [0.5, 1.4, -0.27, 0.63], [0.15, 1.65, -2.95, -2.0],
  [3.74, 5.46, -3.0, -0.89], [3.18, 3.66, -2.94, -2.5], [5.54, 6.02, -2.94, -2.5], [4.87, 6.33, 1.4, 2.81],
  [2.0, 2.9, -2.8, -1.85], [-3.0, -2.7, -2.5, -2.2], [-6.85, -6.25, 2.2, 2.8],
  [-4.55, -3.85, 4.6, 5.3], [-3.25, -2.55, 4.6, 5.3], [3.7, 4.3, 4.65, 5.25], [5.35, 5.95, 4.65, 5.25],
  [4.5, 5.2, 4.7, 5.4], [-7.95, -6.85, 4.7, 5.8],
];

/** True when the dog (about 0.35 m round) fits at x, z in the same room or on the same deck. */
function roomFor(x, z, inside) {
  const r = 0.35;
  if (inside ? x < -6.8 || x > 6.8 || z < -2.8 || z > 2.75 : x < -10.3 || x > 9.3 || z < 3.35 || z > 6.35) return false;
  return !BLOCKS.some(([x0, x1, z0, z1]) => x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r);
}

const h = (hh, mm = 0) => hh * 60 + mm;

/** Where the cat wants to be now. */
function catSpot(minutes, { bad, cold, residentSpot }) {
  const m = ((minutes % 1440) + 1440) % 1440;
  let id;
  if (m < h(6, 45)) id = 'bed';
  else if (m < h(7, 25)) id = 'bowl';
  else if (m < h(10, 30)) id = bad || cold ? 'window' : 'deck';
  else if (m < h(15)) id = 'sofa';
  else if (m < h(17)) id = 'deskWindow';
  else if (m < h(18)) id = 'armchair';
  else if (m < h(18, 40)) id = 'bowl';
  else if (m < h(22)) id = 'sofa';
  else id = 'bed';
  // The resident's seat wins.
  if (id === 'armchair' && residentSpot === 'armchair') id = 'sofa';
  if (id === 'deskWindow' && residentSpot === 'deskWindow') id = 'window';
  return id;
}

/** The point `dist` metres back from the end of a polyline, and the rest of the line after it. */
function pointBack(path, dist) {
  let left = dist;
  for (let i = path.length - 1; i > 0; i--) {
    const a = path[i - 1];
    const b = path[i];
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    if (d >= left) {
      const k = 1 - left / Math.max(d, 1e-6);
      return { at: { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, z: a.z + (b.z - a.z) * k }, rest: path.slice(i) };
    }
    left -= d;
  }
  return { at: { ...path[0] }, rest: path.slice(1) };
}

function turn(current, target, maxStep) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + Math.max(-maxStep, Math.min(maxStep, d));
}

const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Walk a mover along a polyline by `budget` metres; a step up or down onto furniture is a hop. */
function walkPath(m, budget, dt) {
  while (budget > 1e-5 && m.path) {
    const target = m.path[m.idx];
    const from = m.path[m.idx - 1] || m.pos;
    const d = dist2(m.pos, target);
    if (d <= budget) {
      m.pos.set(target.x, target.y, target.z);
      budget -= d;
      m.idx++;
      if (m.idx >= m.path.length) m.path = null;
    } else {
      const k = budget / d;
      m.pos.x += (target.x - m.pos.x) * k;
      m.pos.z += (target.z - m.pos.z) * k;
      const segLen = Math.max(dist2(from, target), 1e-6);
      const along = 1 - dist2(m.pos, target) / segLen;
      const rise = target.y - from.y;
      m.pos.y = from.y + rise * along + (Math.abs(rise) > 0.2 ? Math.sin(Math.PI * along) * 0.18 : 0);
      m.facing = turn(m.facing, Math.atan2(target.x - m.pos.x, target.z - m.pos.z), 8 * dt);
      budget = 0;
    }
  }
}

export class Pets {
  constructor(scene, resident) {
    this.resident = resident;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.dogModel = makeDog();
    this.catModel = makeCat();
    this.group.add(this.dogModel.root, this.catModel.root);
    this.dog = { pos: new THREE.Vector3(), facing: 0, mode: 'follow', crumbs: [], path: null, idx: 1, step: 0, pose: 'sit' };
    this.cat = { pos: new THREE.Vector3(), facing: 0, spot: null, path: null, idx: 1, step: 0, pose: 'sit' };
    this.last = null;
    this._things();
  }

  /** Food and water bowls in the kitchen, the dog's basket by the stove. */
  _things() {
    const add = (geo, color, x, y, z) => {
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.085, 0.07, 0.045, 18), '#b8614a', -3.6, FLOOR + 0.023, -2.18);
    add(new THREE.CylinderGeometry(0.085, 0.07, 0.045, 18), '#56798a', -3.88, FLOOR + 0.023, -2.18);
    const b = DOG_SPOTS.basket.at;
    add(new THREE.CylinderGeometry(0.46, 0.48, 0.12, 28), '#7e6c5a', b.x, FLOOR + 0.06, b.z);
    add(new THREE.CylinderGeometry(0.37, 0.37, 0.06, 28), '#b9ab97',