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