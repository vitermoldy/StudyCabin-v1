import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, smoothstep } from '../core/emitter.js';
import { WORLD, weathered } from './materials.js';
import { groundHeight } from './terrain.js';

// Trees on the rising ground behind the cabin: dark pines that keep their
// colour (and hold snow in winter) and broadleaf trees whose crowns follow the
// season. Both sway a little with the wind, more toward the top.

const flat = (g) => (g.index ? g.toNonIndexed() : g);

function paint(geo, r, g, b, vary = 0) {
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  const pos = geo.attributes.position;
  for (let i = 0; i < n; i++) {
    const y = pos.getY(i);
    const k = 1 + vary * (y - 0.5);
    col[i * 3] = r * k;
    col[i * 3 + 1] = g * k;
    col[i * 3 + 2] = b * k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return geo;
}

/** A pine 1 unit tall: trunk plus four stacked cones. */
function pineGeometry() {
  const parts = [];
  const trunk = new THREE.CylinderGeometry(0.018, 0.03, 0.3, 6);
  trunk.translate(0, 0.15, 0);
  parts.push(paint(trunk, 0.36, 0.27, 0.2));
  const tiers = [[0.2, 0.2, 0.42], [0.36, 0.16, 0.34], [0.52, 0.12, 0.28], [0.68, 0.08, 0.26]];
  tiers.forEach(([y, r, h], i) => {
    const cone = new THREE.ConeGeometry(r, h, 8, 1);
    cone.translate(0, y + h / 2, 0);
    const shade = 0.8 + i * 0.07;
    parts.push(paint(cone, 0.62 * shade, 0.8 * shade, 0.62 * shade, 0.2));
  });
  const g = mergeGeometries(parts);
  g.computeVertexNormals();
  return g;
}

/** A broadleaf tree 1 unit tall: trunk, two limbs and a cloud of crown lumps. */
function broadleafGeometry() {
  const trunkParts = [];
  const crownParts = [];
  const trunk = new THREE.CylinderGeometry(0.025, 0.045, 0.5, 7);
  trunk.translate(0, 0.25, 0);
  trunkParts.push(flat(trunk));
  for (const [ang, tilt] of [[0.4, 0.6], [2.6, -0.55]]) {
    const limb = new THREE.CylinderGeometry(0.012, 0.022, 0.28, 5);
    limb.translate(0, 0.14, 0);
    limb.rotateZ(tilt);
    limb.rotateY(ang);
    limb.translate(0, 0.42, 0);
    trunkParts.push(flat(limb));
  }
  const r = rng(5);
  const lumps = [[0, 0.72, 0, 0.26], [0.17, 0.62, 0.05, 0.19], [-0.16, 0.64, -0.04, 0.2], [0.04, 0.6, 0.17, 0.18], [-0.03, 0.62, -0.17, 0.18], [0.06, 0.86, -0.02, 0.17]];
  for (const [x, y, z, s] of lumps) {
    const blob = new THREE.IcosahedronGeometry(s, 1);
    const p = blob.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const k = 0.88 + r() * 0.24;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.86, p.getZ(i) * k);
    }
    blob.translate(x, y, z);
    crownParts.push(flat(blob));
  }
  const trunkG = paint(mergeGeometries(trunkParts), 0.38, 0.3, 0.24);
  const crownG = paint(mergeGeometries(crownParts), 1, 1, 1, 0.5);
  // Mark crown vertices so the shader can tint only the leaves.
  const leafT = new Float32Array(trunkG.attributes.position.count).fill(0);
  const leafC = new Float32Array(crownG.attributes.position.count).fill(1);
  trunkG.setAttribute('aLeaf', new THREE.BufferAttribute(leafT, 1));
  crownG.setAttribute('aLeaf', new THREE.BufferAttribute(leafC, 1));
  const g = mergeGeometries([trunkG, crownG]);
  g.computeVertexNormals();
  return g;
}

function swayShader(material, { leaves = false } = {}) {
  const prev = material.onBeforeCompile;
  // Two programs from one wrapper: give each its own cache key.
  material.customProgramCacheKey = () => (leaves ? 'tree-leaves' : 'tree-plain');
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    shader.uniforms.uTime = WORLD.uTime;
    shader.uniforms.uWind = WORLD.uWind;
    if (leaves) shader.uniforms.uLeaf = material.userData.uLeaf;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uTime; uniform float uWind;${leaves ? '\nattribute float aLeaf; varying float vLeaf;' : ''}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        ${leaves ? 'vLeaf = aLeaf;' : ''}
        #ifdef USE_INSTANCING
          vec3 base = instanceMatrix[3].xyz;
          float hh = position.y;
          float ph = base.x * 0.21 + base.z * 0.17;
          float s = (sin(uTime * 0.9 + ph) * 0.6 + sin(uTime * 2.1 + ph * 1.7) * 0.25) * (0.15 + uWind * 0.85);
          transformed.x += s * hh * hh * 0.07;
          transformed.z += s * hh * hh * 0.03;
        #endif`,
      );
    if (leaves) {
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform vec3 uLeaf; varying float vLeaf;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uLeaf * 1.6, vLeaf);');
    }
  };
  return material;
}
