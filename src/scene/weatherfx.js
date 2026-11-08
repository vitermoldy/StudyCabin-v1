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

export class WeatherFX {
  constructor(scene, flueTop) {
    this.common = {
      uTime: { value: 0 },
      uWind: { value: 0.3 },
      uCenter: { value: new THREE.Vector3(0, 8, 10) },
      uLight: { value: 1 },
      uScale: { value: 400 },
    };

    // Rain: short streaks.
    this.rainU = { ...this.common, uAmount: { value: 0 }, uBox: { value: new THREE.Vector3(56, 24, 52) } };
    const rain = new THREE.LineSegments(
      seeds(7000, 2, 3),
      new THREE.ShaderMaterial({
        uniforms: this.rainU,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          uniform float uTime; uniform float uWind; uniform float uAmount; uniform vec3 uCenter; uniform vec3 uBox;
          attribute vec3 aSeed; attribute float aId; attribute float aEnd;
          varying float vA;
          ${WRAP}
          void main(){
            vec3 vel = vec3(uWind * 6.0, -14.0 - aSeed.z * 4.0, -uWind * 1.5);
            vec3 p = aSeed * uBox + vel * uTime;
            p = wrapBox(p, uCenter, uBox);
            p -= normalize(vel) * aEnd * (0.32 + uAmount * 0.3);
            float on = step(aId, uAmount) * (1.0 - insideCabin(p)) * step(-0.2, p.y);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            float far = smoothstep(42.0, 18.0, -mv.z);
            vA = on * far * (1.0 - aEnd * 0.7);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uLight; uniform float uAmount; varying float vA;
          void main(){
            if (vA < 0.01) discard;
            gl_FragColor = vec4(vec3(0.72, 0.76, 0.8) * (0.35 + uLight * 0.65), vA * (0.26 + uAmount * 0.22));
            #include <colorspace_fragment>
          }`,
      }),
    );

    // Snow: soft discs drifting down.
    this.snowU = { ...this.common, uAmount: { value: 0 }, uBox: { value: new THREE.Vector3(50, 22, 46) } };
    const snow = new THREE.Points(
      seeds(5000, 1, 5),
      new THREE.ShaderMaterial({
        uniforms: this.snowU,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          uniform float uTime; uniform float uWind; uniform float uAmount; uniform vec3 uCenter; uniform vec3 uBox; uniform float uScale;
          attribute vec3 aSeed; attribute float aId;
          varying float vA;
          ${WRAP}
          void main(){
            vec3 vel = vec3(uWind * 1.8, -0.9 - aSeed.y * 0.6, -uWind * 0.4);
            vec3 p = aSeed * uBox + vel * uTime;
            p.x += sin(uTime * 0.7 + aSeed.z * 31.0) * 0.6;
            p.z += cos(uTime * 0.5 + aSeed.x * 23.0) * 0.5;
            p = wrapBox(p, uCenter, uBox);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vA = step(aId, uAmount) * (1.0 - insideCabin(p)) * smoothstep(40.0, 16.0, -mv.z) * smoothstep(1.5, 5.0, -mv.z);
            gl_PointSize = min((0.05 + aSeed.x * 0.05) * uScale / max(-mv.z, 0.5), 9.0);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uLight; varying float vA;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.15, d) * vA;
            if (a < 0.01) discard;
            gl_FragColor = vec4(vec3(0.95) * (0.4 + uLight * 0.6), a * 0.9);
            #include <colorspace_fragment>
          }`,
      }),
    );

    // Petals in spring, leaves in autumn: tumbling ovals.
    const tumble = (seed, colA, colB) => {
      const u = { ...this.common, uAmount: { value: 0 }, uBox: { value: new THREE.Vector3(46, 14, 40) }, uColA: { value: new THREE.Color(colA) }, uColB: { value: new THREE.Color(colB) } };
      const pts = new THREE.Points(
        seeds(700, 1, seed),
        new THREE.ShaderMaterial({
          uniforms: u,
          transparent: true,
          depthWrite: false,
          vertexShader: /* glsl */ `
            uniform float uTime; uniform float uWind; uniform float uAmount; uniform vec3 uCenter; uniform vec3 uBox; uniform float uScale;
            attribute vec3 aSeed; attribute float aId;
            varying float vA; varying float vRot; varying float vMix;
            ${WRAP}
            void main(){
              vec3 vel = vec3(0.6 + uWind * 3.5, -0.75 - aSeed.y * 0.4, -0.2 - uWind * 0.6);
              vec3 p = aSeed * uBox + vel * uTime;
              p.x += sin(uTime * 1.1 + aSeed.z * 40.0) * 0.8;
              p.y += sin(uTime * 1.7 + aSeed.x * 17.0) * 0.25;
              p = wrapBox(p, uCenter, uBox);
              vec4 mv = modelViewMatrix * vec4(p, 1.0);
              vA = step(aId, uAmount) * (1.0 - insideCabin(p)) * smoothstep(34.0, 12.0, -mv.z) * smoothstep(1.5, 4.0, -mv.z);
              vRot = uTime * (1.2 + aSeed.x * 2.5) + aSeed.z * 6.28;
              vMix = aSeed.y;
              gl_PointSize = min((0.09 + aSeed.z * 0.07) * uScale / max(-mv.z, 0.5), 16.0);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            uniform float uLight; uniform vec3 uColA; uniform vec3 uColB;
            varying float vA; varying float vRot; varying float vMix;
            void main(){
              vec2 c = gl_PointCoord - 0.5;
              float s = sin(vRot), co = cos(vRot);
              c = mat2(co, -s, s, co) * c;
              float flip = abs(sin(vRot * 0.7)) * 0.7 + 0.3;
              float d = length(c * vec2(1.0 / flip, 2.3));
              float a = smoothstep(0.5, 0.4, d) * vA;
              if (a < 0.01) discard;
              gl_FragColor = vec4(mix(uColA, uColB, vMix) * (0.3 + uLight * 0.7), a);
              #include <colorspace_fragment>
            }`,
        }),
      );
      return { pts, u };
    };
    const petals = tumble(7, '#f0d6d3', '#fbf5ef');
    const leaves = tumble(9, '#c2702f', '#8f4a28');
    this.petalU = petals.u;
    this.leafU = leaves.u;

    // Smoke from the stove flue.
    this.smokeU = { ...this.common, uAmount: { value: 0 }, uOrigin: { value: flueTop.clone() } };
    const smoke = new THREE.Points(
      seeds(70, 1, 13),
      new THREE.ShaderMaterial({
        uniforms: this.smokeU,
        transparent: true,
        depthWrite: false,
        vertexShader: /* glsl */ `
          uniform float uTime; uniform float uWind; uniform float uAmount; uniform vec3 uOrigin; uniform float uScale;
          attribute vec3 aSeed; attribute float aId;
          varying float vA;
          void main(){
            float age = fract(uTime / 7.0 + aId);
            vec3 p = uOrigin + vec3((0.4 + uWind * 3.0) * age * age * 3.0 + sin(age * 6.0 + aSeed.x * 9.0) * 0.18, age * 4.2, sin(age * 4.0 + aSeed.z * 7.0) * 0.2 - uWind * age);
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            vA = uAmount * smoothstep(0.0, 0.12, age) * (1.0 - age);
            gl_PointSize = (0.35 + age * 1.6) * uScale / max(-mv.z, 0.5);
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          uniform float uLight; varying float vA;
          void main(){
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d) * vA * (0.1 + uLight * 0.24);
            if (a < 0.005) discard;
            gl_FragColor = vec4(vec3(0.78, 0.79, 0.8) * (0.25 + uLight * 0.75), a);
            #include <colorspace_fragment>
          }`,
      }),
    );

    this.objects = [rain, snow, petals.pts, leaves.pts, smoke];
    for (const o of this.objects) {
      o.frustumCulled = false;
      o.renderOrder = 5;
      scene.add(o);
    }
  }
}
