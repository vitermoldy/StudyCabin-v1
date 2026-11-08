import * as THREE from 'three';
import { SHORE_Z } from './terrain.js';

const VERT = /* glsl */ `
  uniform float uTime; uniform float uWaves;
  varying vec3 vWorld; varying vec3 vNormalW; varying float vDepth; varying float vCrest;
  #include <fog_pars_vertex>

  // Waves roll toward the shore (-z). Each: direction, wavelength, amplitude, speed.
  vec3 wave(vec2 p, vec2 dir, float len, float amp, float spd, inout vec3 n){
    float k = 6.2831 / len;
    float f = k * dot(dir, p) + uTime * spd;
    float a = amp;
    n.x -= dir.x * k * a * cos(f);
    n.z -= dir.y * k * a * cos(f);
    return vec3(0.0, a * sin(f), 0.0);
  }

  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float ground = -max(wp.z - ${SHORE_Z.toFixed(2)}, 0.0) * 0.085;
    float shoal = smoothstep(0.0, 1.6, -ground);
    float amp = mix(0.035, 0.3, uWaves * uWaves) * mix(0.35, 1.0, shoal);
    vec3 n = vec3(0.0, 1.0, 0.0);
    vec2 p = wp.xz;
    vec3 d = vec3(0.0);
    d += wave(p, normalize(vec2(0.12, -1.0)), 16.0, amp * 0.6, 0.95, n);
    d += wave(p, normalize(vec2(-0.3, -1.0)), 10.0, amp * 0.32, 1.25, n);
    d += wave(p, normalize(vec2(0.55, -0.8)), 6.5, amp * 0.14 * uWaves, 1.6, n);
    // The run-up: water climbs the sand and slides back.
    float surge = (0.05 + 0.11 * uWaves) * (sin(uTime * 0.62 + wp.x * 0.045) * 0.5 + 0.5) * (1.0 - smoothstep(0.0, 1.3, -ground));
    wp.y += d.y + surge;
    vCrest = d.y / max(amp, 0.001);
    vDepth = wp.y - ground;
    vWorld = wp.xyz;
    vNormalW = normalize(n);
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uZenith; uniform vec3 uHorizon;
  uniform vec3 uSunDir; uniform vec3 uSunColor; uniform float uSunVis; uniform float uTime;
  uniform float uWaves; uniform float uRain; uniform float uLight; uniform vec3 uMoonDir; uniform float uMoonVis;
  varying vec3 vWorld; varying vec3 vNormalW; varying float vDepth; varying float vCrest;
  uniform sampler2D uRipple; uniform vec4 uRippleArea; uniform vec3 uLand;
  #include <fog_pars_fragment>

  // slope of one sine train a*sin(k dot(d,p) + w t)
  vec2 wgrad(vec2 p, vec2 d, float len, float a, float spd, float t){
    float k = 6.2831 / len;
    return d * (a * k * cos(k * dot(d, p) + t * spd));
  }

  float h21(vec2 p){ p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
  float vn(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }

  void main(){
    vec3 V = normalize(cameraPosition - vWorld);
    vec3 N = vNormalW;
    // Crisp small waves with exact slopes (a sum of short sine trains), so the
    // sun and sky break into sharp glints instead of a blur.
    vec2 p = vWorld.xz;
    float t = uTime;
    vec2 g = vec2(0.0);
    float rough = 0.45 + uWaves * 0.9 + uRain * 0.35;
    g += wgrad(p, vec2(0.15, -0.99), 9.0, 0.05, 0.8, t);
    g += wgrad(p, vec2(-0.42, -0.9), 6.2, 0.03, 1.0, t);
    g += wgrad(p, vec2(0.62, -0.78), 4.1, 0.014, 1.3, t);
    g += wgrad(p, vec2(-0.85, -0.52), 2.7, 0.006, 1.6, t);
    // fade the fine detail with distance so it never shimmers into a pattern
    float dist = length(cameraPosition - vWorld);
    g *= rough * exp(-dist / 120.0);
    // Rings from the ripple simulation: pointer drags and raindrops.
    vec2 ruv = (p - uRippleArea.xy) / uRippleArea.z;
    if (uRippleArea.w > 0.5 && ruv.x > 0.0 && ruv.y > 0.0 && ruv.x < 1.0 && ruv.y < 1.0) {
      float e = 1.0 / 256.0;
      float hL = texture2D(uRipple, ruv - vec2(e, 0.0)).r;
      float hR = texture2D(uRipple, ruv + vec2(e, 0.0)).r;
      float hD = texture2D(uRipple, ruv - vec2(0.0, e)).r;
      float hU = texture2D(uRipple, ruv + vec2(0.0, e)).r;
      g += vec2(hR - hL, hU - hD) * 4.0;
    }
    N = normalize(N + vec3(-g.x, 0.0, -g.y) * 1.3);

    float ndv = max(dot(N, V), 0.0);
    float fres = (0.02 + 0.98 * pow(1.0 - ndv, 4.0)) * 0.72;
    vec3 R = reflect(-V, N);
    R.y = abs(R.y);
    vec3 sky = mix(uHorizon, uZenith, pow(clamp(R.y, 0.0, 1.0), 0.6));
    // Looking toward the land, low reflections are of dunes and hills, not sky.
    float landward = smoothstep(0.1, -0.5, R.z) * (1.0 - smoothstep(0.03, 0.22, R.y));
    sky = mix(sky, uLand, landward);
    float sd = max(dot(R, uSunDir), 0.0);
    sky += uSunColor * pow(sd, 5.0) * 0.32 * uSunVis;

    // Light is absorbed with depth: clear over the sand in the shallows,
    // green-grey further out (the seabed and its caustics show through).
    float depth = max(vDepth, 0.0);
    float absorb = 1.0 - exp(-depth * 0.55);
    vec3 body = mix(uShallow, uDeep, smoothstep(0.2, 3.5, depth)) * uLight;

    float spec = pow(sd, mix(320.0, 120.0, uRain)) * 1.5 + pow(sd, 36.0) * 0.22;
    float mspec = pow(max(dot(R, uMoonDir), 0.0), 160.0) * 1.2 + pow(max(dot(R, uMoonDir), 0.0), 24.0) * 0.12;
    vec3 glint = uSunColor * spec * uSunVis + vec3(0.6, 0.66, 0.75) * mspec * uMoonVis * 0.8;

    // Foam: the swash line, broken crests in the shallows, white caps in a storm.
    float n1 = vn(p * vec2(0.9, 2.2) + vec2(0.0, t * 0.5));
    float n2 = vn(p * 3.1 - vec2(t * 0.2, 0.0));
    float swash = smoothstep(0.07, 0.0, vDepth) * smoothstep(0.35, 0.75, n1 + n2 * 0.4) * smoothstep(-0.01, 0.015, vDepth);
    float bands = smoothstep(0.8, 0.98, sin(vDepth * 9.0 + t * 1.25 + n1 * 2.0) * 0.5 + 0.5) * smoothstep(1.4, 0.2, vDepth);
    float caps = smoothstep(0.62, 0.95, vCrest) * smoothstep(0.85, 1.0, uWaves) * smoothstep(0.55, 0.85, n2 * n1 * 1.6);
    float foam = clamp(swash * 0.8 + bands * uWaves * uWaves * 0.3 * n2 + caps * 0.7, 0.0, 1.0);
    vec3 foamCol = vec3(0.88, 0.9, 0.9) * (0.25 + uLight * 0.75);

    // Premultiplied mix so the shallows stay see-through while reflections stay bright.
    vec3 col = body * absorb * (1.0 - fres) + sky * fres + glint;
    float alpha = absorb * (1.0 - fres) + fres + min(1.0, dot(glint, vec3(0.33)));
    col = mix(col, foamCol, foam * 0.85);
    alpha = mix(alpha, 1.0, foam * 0.85);
    alpha = clamp(alpha, 0.0, 1.0) * smoothstep(-0.01, 0.03, vDepth);
    gl_FragColor = vec4(col / max(alpha, 0.001), alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }`;

function buildGeometry() {
  // Dense near the shore, coarse toward the horizon.
  const NX = 200;
  const NZ = 120;
  const pos = [];
  for (let j = 0; j <= NZ; j++) {
    const v = j / NZ;
    const z = SHORE_Z - 1.4 + Math.pow(v, 2.2) * 700;
    for (let i = 0; i <= NX; i++) {
      const u = (i / NX) * 2 - 1;
      const x = Math.sign(u) * (0.12 * Math.abs(u) + 0.88 * u * u) * 700;
      pos.push(x, -0.04, z);
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
  geo.setIndex(idx);
  geo.computeBoundingSphere();
  return geo;
}
