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

export class Terrain {
  constructor(scene, { lowPower = false } = {}) {
    this.uniforms = {
      uSand: { value: new THREE.Color('#d4cab4') },
      uSandWet: { value: new THREE.Color('#a39a86') },
      uVeg: { value: new THREE.Color('#7b9558') },
      uCaustic: { value: 0.5 },
    };
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.96, metalness: 0 });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms, { uSnow: WORLD.uSnow, uWet: WORLD.uWet, uTime: WORLD.uTime });
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nattribute vec3 aMix; varying vec3 vMix; varying float vUp; varying vec3 vWorldG;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vMix = aMix;\n vWorldG = (modelMatrix * vec4(position, 1.0)).xyz;')
        .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n vUp = inverseTransformDirection(transformedNormal, viewMatrix).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vMix; varying float vUp; varying vec3 vWorldG;
          uniform vec3 uSand; uniform vec3 uSandWet; uniform vec3 uVeg; uniform float uSnow; uniform float uWet;
          uniform float uTime; uniform float uCaustic;
          ${CAUSTIC}`,
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          vec3 sand = uSand * (0.92 + vMix.z * 0.14);
          sand = mix(sand, uSandWet, clamp(vMix.x + uWet * 0.55, 0.0, 1.0));
          vec3 veg = mix(sand, uVeg * (0.38 + vMix.z * 0.16), smoothstep(0.0, 0.6, vMix.y));
          float snowAmt = uSnow * (1.0 - vMix.x) * smoothstep(0.55, 0.85, vUp);
          diffuseColor.rgb = mix(veg, vec3(0.9, 0.92, 0.94), snowAmt * 0.92);
          // Under the water: the sand goes green-grey with depth and catches caustics.
          float under = -0.04 - vWorldG.y;
          if (under > 0.0) {
            diffuseColor.rgb *= mix(vec3(0.86, 0.96, 0.95), vec3(0.45, 0.68, 0.68), smoothstep(0.0, 3.0, under));
            float cz = caustic(mod(vWorldG.xz * 1.9, 6.28318) - 250.0, uTime * 0.6);
            float fade = smoothstep(0.0, 0.18, under) * exp(-under * 0.22);
            diffuseColor.rgb += vec3(0.85, 1.0, 0.95) * cz * fade * uCaustic * 1.1;
          }`,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
          roughnessFactor = mix(roughnessFactor, 0.35, clamp(vMix.x * 0.8 + uWet * 0.4, 0.0, 1.0) * (1.0 - snowAmt));`,
        );
    };
    this.ground = new THREE.Mesh(buildGround(), mat);
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    this.grass = this._buildGrass(lowPower);
    scene.add(this.grass);
    this.mountains = this._buildMountains();
    scene.add(this.mountains);
  }

  /**
   * Fine marram grass: patches of many thin curved blades, laid on a jittered
   * grid over the dunes so the cover reads as one soft field, with gusts that
   * roll across it.
   */
  _buildGrass(lowPower) {
    // One patch: many long thin blades over about a square metre, each curving
    // over toward its tip, dark at the root and light at the tip, so a field of
    // patches reads as one thick lawn.
    const rand = rng(7);
    const pos = [];
    const col = [];
    const nrm = [];
    const blades = lowPower ? 34 : 64;
    for (let b = 0; b < blades; b++) {
      const bx = (rand() - 0.5) * 1.12;
      const bz = (rand() - 0.5) * 1.12;
      const ang = rand() * Math.PI * 2;
      const lean = 0.1 + rand() * 0.38;
      const h = 0.3 + Math.pow(rand(), 0.7) * 0.45;
      const w = 0.012 + rand() * 0.01;
      const dx = Math.cos(ang);
      const dz = Math.sin(ang);
      const px = -dz * w;
      const pz = dx * w;
      const at = (f, side) => {
        const bend = lean * f * f;
        const width = (1 - f * 0.8) * side;
        return [bx + dx * bend + px * width, h * f * (1 - lean * 0.25 * f), bz + dz * bend + pz * width];
      };
      const tip = [bx + dx * lean, h * (1 - lean * 0.25), bz + dz * lean];
      const push = (v, f) => {
        pos.push(...v);
        const c = 0.12 + Math.pow(f, 0.8) * 0.95;
        col.push(c * 1.02, c, c * (0.86 - f * 0.12));
        nrm.push(dx * 0.3, 1, dz * 0.3);
      };
      const l0 = at(0, -1), r0 = at(0, 1), l1 = at(0.55, -1), r1 = at(0.55, 1);
      push(l0, 0); push(r0, 0); push(l1, 0.55);
      push(r0, 0); push(r1, 0.55); push(l1, 0.55);
      push(l1, 0.55); push(r1, 0.55); push(tip, 1);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    geo.computeBoundingSphere();

    this.grassPush = { value: new THREE.Vector3(0, 0, 0) };
    const mat = new THREE.MeshLambertMaterial({ color: 0x6f9442, vertexColors: true, side: THREE.DoubleSide });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = WORLD.uTime;
      shader.uniforms.uWind = WORLD.uWind;
      shader.uniforms.uSnow = WORLD.uSnow;
      shader.uniforms.uPush = this.grassPush;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime; uniform float uWind; uniform vec3 uPush; varying float vTip;')
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          float hh = position.y;
          vTip = clamp(hh / 0.6, 0.0, 1.0);
          #ifdef USE_INSTANCING
            vec3 ip = (instanceMatrix * vec4(position, 1.0)).xyz;
            vec2 wdir = normalize(vec2(1.0, -0.35));
            // a gust front rolling across the field, plus a fine flutter
            float roll = sin(dot(ip.xz, wdir) * 0.3 - uTime * 1.6);
            float gust = pow(roll * 0.5 + 0.5, 2.0);
            float flutter = sin(uTime * 3.7 + ip.x * 1.9 + ip.z * 2.3) * 0.1;
            float s = (0.25 + gust * 0.9 + flutter) * (0.2 + uWind * 1.05);
            float h2 = hh * hh;
            vec3 windW = vec3(wdir.x, 0.0, wdir.y) * s * h2 * 0.85 - vec3(0.0, s * h2 * 0.22, 0.0);
            // the blades part round the pointer
            vec2 away = ip.xz - uPush.xy;
            float dd = length(away);
            float near = uPush.z * smoothstep(2.4, 0.2, dd);
            windW.xz += (away / max(dd, 0.001)) * near * h2 * 1.6;
            windW.y -= near * h2 * 0.5;
            mat3 imx = mat3(instanceMatrix);
            transformed += (transpose(imx) * windW) / max(dot(imx[0], imx[0]), 0.0001);
          #endif`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uSnow; varying float vTip;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.9, 0.92), uSnow * 0.55 * vTip);');
    };

    const r = rng(99);
    const spots = [];
    const consider = (x, z, scale) => {
      const cover = grassCover(x, z);
      if (cover < 0.05 || r() > cover * 1.15) return;
      spots.push([x, z, scale]);
    };
    // Thick near the cabin and over the dunes in view.
    const near = lowPower ? 1.15 : 0.82;
    for (let z = -34; z <= 9.6; z += near) {
      for (let x = -44; x <= 44; x += near) consider(x + (r() - 0.5) * near * 0.7, z + (r() - 0.5) * near * 0.7, 1);
    }
    // Further out: bigger patches out to the hills and the trees.
    const far = lowPower ? 3.4 : 2.6;
    for (let z = -72; z <= 9; z += far) {
      for (let x = -110; x <= 110; x += far) {
        if (Math.abs(x) < 44 && z > -34) continue;
        consider(x + (r() - 0.5) * 2, z + (r() - 0.5) * 2, 2.3);
      }
    }
    const mesh = new THREE.InstancedMesh(geo, mat, spots.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const c = new THREE.Color();
    const Y = new THREE.Vector3(0, 1, 0);
    spots.forEach(([x, z, scale], i) => {
      p.set(x, groundHeight(x, z) - 0.03, z);
      q.setFromAxisAngle(Y, r() * Math.PI * 2);
      const tall = 0.85 + r() * 0.3 + fbm(x * 0.12, z * 0.12, 2) * 0.45;
      s.set(scale, tall * (scale > 1 ? 1.3 : 1), scale);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
      const tone = 0.82 + fbm(x * 0.05, z * 0.05, 2) * 0.32 + r() * 0.05;
      c.setRGB(tone * (0.97 + r() * 0.06), tone, tone * (0.9 + r() * 0.1));
      mesh.setColorAt(i, c);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  _buildMountains() {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: 0x5f6662, roughness: 1 });
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uSnow = WORLD.uSnow;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vH; varying float vUp2;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vH = (modelMatrix * vec4(position, 1.0)).y;')
        .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\n vUp2 = inverseTransformDirection(transformedNormal, viewMatrix).y;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vH; varying float vUp2; uniform float uSnow;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          float line = mix(150.0, 34.0, uSnow);
          float cap = smoothstep(line, line + 18.0, vH) * smoothstep(0.35, 0.7, vUp2);
          diffuseColor.rgb *= 0.85 + 0.25 * smoothstep(0.0, 120.0, vH);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.85, 0.88), cap);`,
        );
    };
    const ranges = [
      { z: -215, depth: 180, peak: 74, seed: 3, sx: 0.0052, x: 0 },
      { z: -380, depth: 220, peak: 120, seed: 9, sx: 0.0034, x: 120 },
    ];
    for (const R of ranges) {
      const geo = new THREE.PlaneGeometry(1700, R.depth, 220, 50);
      geo.rotateX(-Math.PI / 2);
      const pa = geo.attributes.position;
      for (let i = 0; i < pa.count; i++) {
        const x = pa.getX(i) + R.x;
        const zl = pa.getZ(i); // -depth/2 (back) .. +depth/2 (front)
        const front = (zl + R.depth / 2) / R.depth; // 0 back, 1 front
        const ridge = 1 - Math.abs(fbm(x * R.sx + R.seed, zl * 0.01 + R.seed, 5) * 2 - 1);
        const sideForward = smoothstep(150, 520, Math.abs(x)) * 0.35;
        const env = Math.sin(Math.min(1, Math.max(0, (1 - front) * 1.25 + sideForward)) * Math.PI * 0.5);
        const h = env * (R.peak * 0.25 + R.peak * Math.pow(ridge, 1.6)) * (0.75 + fbm(x * 0.002 + R.seed, 3.1) * 0.5);
        pa.setY(i, h - 6 - (1 - env) * 10);
      }
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(-R.x, 0, R.z);
      group.add(mesh);
    }
    return group;
  }
}
