import * as THREE from 'three';
import { rng } from '../core/emitter.js';

// Particles driven entirely on the GPU from a time uniform: nothing is
// rewritten per frame. Each drop, flake or leaf has a seed and wraps inside a
// box that follows the camera, so the weather is always around the viewer.

const WRAP = /* glsl */ `
  vec3 wrapBox(vec3 p, vec3 center, vec3 box){ return center + mod(p - center + box * 0.5, box) - box * 0.5; }
  float insideCabin(vec3 p){
    // the roof and walls keep the weather out
    vec3 lo = vec3(-7.7, -1.0, -3.8);
    vec3 hi = vec3(7.7, 6.0, 3.75);
    vec3 a = step(lo, p) * step(p, hi);
    return a.x * a.y * a.z;
  }
`;

function seeds(count, perItem, seed) {
  const r = rng(seed);
  const s = new Float32Array(count * perItem * 3);
  const id = new Float32Array(count * perItem);
  const end = new Float32Array(count * perItem);
  for (let i = 0; i < count; i++) {
    const a = r();
    const b = r();
    const c = r();
    const order = r();
    for (let k = 0; k < perItem; k++) {
      const o = i * perItem + k;
      s[o * 3] = a;
      s[o * 3 + 1] = b;
      s[o * 3 + 2] = c;
      id[o] = order;
      end[o] = k;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(count * perItem * 3), 3));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(s, 3));
  geo.setAttribute('aId', new THREE.Float32BufferAttribute(id, 1));
  geo.setAttribute('aEnd', new THREE.Float32BufferAttribute(end, 1));
  return geo;
}
