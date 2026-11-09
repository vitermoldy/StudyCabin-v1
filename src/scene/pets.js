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
  const tail =