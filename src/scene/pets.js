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
  m.body.position.y