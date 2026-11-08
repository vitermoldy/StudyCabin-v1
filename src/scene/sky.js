import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../core/emitter.js';

const NOISE = /* glsl */ `
  float hash2(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float hash3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float vnoise(vec2 p){
    vec2 i = floor(p); vec2 f = fract(p);
    float a = hash2(i), b = hash2(i + vec2(1.0, 0.0)), c = hash2(i + vec2(0.0, 1.0)), d = hash2(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0; float a = 0.5; for (int i = 0; i < 5; i++){ v += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return v; }
`;

const VERT = /* glsl */ `
  varying vec3 vDir;
  void main(){
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vDir = wp.xyz - cameraPosition;
    gl_Position = projectionMatrix * viewMatrix * wp;
    gl_Position.z = gl_Position.w;
  }
`;

const FRAG = /* glsl */ `
  uniform vec3 uZenith; uniform vec3 uHorizon; uniform vec3 uGround;
  uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uMoonDir;
  uniform vec3 uCloudLit; uniform vec3 uCloudDark;
  uniform float uSunVis; uniform float uMoonVis; uniform float uStars; uniform float uCloud;
  uniform float uTime; uniform float uWind; uniform float uFlash; uniform float uGlow; uniform float uFogAmt;
  uniform float uAurora;
  varying vec3 vDir;
  ${NOISE}

  // Northern lights: three curtains with a bright lower edge and soft rays.
  vec3 aurora(vec3 d, float t){
    if (d.y < 0.015) return vec3(0.0);
    float az = atan(d.x, -d.z);
    vec3 col = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float edge = 0.075 + fi * 0.06 + sin(az * (1.6 + fi * 0.5) + t * 0.035 + fi * 2.1) * 0.045
        + (vnoise(vec2(az * 3.0 + fi * 7.0, t * 0.03)) - 0.5) * 0.06;
      float hgt = d.y - edge;
      float curtain = smoothstep(-0.006, 0.012, hgt) * exp(-max(hgt, 0.0) * (7.0 - fi));
      float rays = 0.35 + 0.65 * pow(vnoise(vec2(az * 55.0 + fi * 19.0, t * 0.12 + fi)), 1.6);
      vec3 c = mix(vec3(0.12, 1.0, 0.55), vec3(0.1, 0.78, 0.82), smoothstep(0.0, 0.14, hgt));
      c = mix(c, vec3(0.95, 0.42, 0.55), smoothstep(0.08, 0.3, hgt) * 0.4);
      col += c * curtain * rays * (0.55 - fi * 0.13);
    }
    // they hang over the hills, fading toward the sea behind the viewer
    return col * smoothstep(-0.35, 0.45, -d.z) * smoothstep(0.015, 0.08, d.y);
  }

  // The Milky Way: a soft band of light with dark dust lanes and a brighter core.
  vec3 galaxy(vec3 d){
    vec3 n = normalize(vec3(0.42, 0.5, 0.76));
    float g = dot(d, n);
    float band = exp(-g * g / 0.018);
    vec2 q = vec2(atan(d.x, d.z) * 2.2, g * 9.0);
    float cloud = fbm(q * 2.0 + 3.0);
    float dust = smoothstep(0.45, 0.7, fbm(q * 3.4 + 11.0)) * exp(-g * g / 0.004);
    float core = exp(-pow(length(d - normalize(vec3(-0.55, 0.32, -0.77))), 2.0) * 4.0);
    vec3 c = vec3(0.7, 0.75, 0.88) * band * (0.25 + cloud * 0.9) * (1.0 - dust * 0.75);
    c += vec3(1.0, 0.86, 0.68) * core * band * 0.55;
    return c;
  }

  float starLayer(vec3 d, float scale, float density, float seed){
    vec3 sp = d * scale + seed;
    vec3 cell = floor(sp);
    float r = hash3(cell);
    float on = step(1.0 - density, r);
    float size = 0.32 + hash3(cell + 7.1) * 0.18;
    float glow = smoothstep(size, 0.0, length(fract(sp) - 0.5));
    return on * glow * (0.35 + hash3(cell + 3.3) * 0.65);
  }

  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    float up = clamp(h, 0.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, pow(up, 0.55));
    col = mix(col, uHorizon, uFogAmt * (1.0 - smoothstep(0.0, 0.4, up)));
    if (h < 0.0) col = mix(uHorizon, uGround, smoothstep(0.0, -0.25, h));

    float sd = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(sd, 5.0) * 0.32 * uGlow + pow(sd, 64.0) * 0.45) * uSunVis;

    // Night sky: galaxy, two layers of stars, northern lights.
    float skyUp = smoothstep(0.02, 0.25, up);
    vec3 night = galaxy(d) * 0.3;
    float stars = starLayer(d, 260.0, 0.0035, 0.0) * 1.3 + starLayer(d, 520.0, 0.01 + exp(-pow(dot(d, normalize(vec3(0.42, 0.5, 0.76))), 2.0) / 0.02) * 0.03, 17.0) * 0.55;
    night += vec3(stars);

    // Clouds: puffy lumps that catch the sun on one side, plus thin high streaks.
    vec2 drift = vec2(uTime * 0.006 * (0.25 + uWind), uTime * 0.002);
    vec2 uv = d.xz / (h + 0.16) * 1.4 + drift;
    vec2 warp = vec2(fbm(uv * 0.6 + 4.0), fbm(uv * 0.6 + 9.0)) - 0.5;
    float n = fbm(uv + warp * 0.8);
    float cover = smoothstep(1.0 - uCloud * 0.9, 1.25 - uCloud * 0.7, n + uCloud * 0.32);
    cover = max(cover, smoothstep(0.86, 1.0, uCloud) * 0.92);
    vec2 cuv = d.xz / (h + 0.3) * vec2(0.5, 2.6) + drift * 1.6;
    float cirrus = smoothstep(0.55, 0.85, fbm(cuv + 21.0)) * 0.35 * (1.0 - uFogAmt);
    float horizonFade = smoothstep(-0.03, 0.1, h);
    cover *= horizonFade;
    cirrus *= horizonFade;
    float self = fbm(uv + warp * 0.8 + uSunDir.xz * 0.12);
    float lit = clamp((n - self) * 2.4 + 0.55 + pow(sd, 3.0) * 0.5, 0.0, 1.0);
    vec3 cloudCol = mix(uCloudDark, uCloudLit, lit);
    float moonLit = pow(max(dot(d, uMoonDir), 0.0), 6.0) * uMoonVis;
    cloudCol += vec3(0.25, 0.28, 0.33) * moonLit;

    col += night * uStars * skyUp * (1.0 - max(cover, cirrus));
    col += aurora(d, uTime) * uAurora * (1.0 - cover * 0.85);

    float disc = smoothstep(0.99935, 0.99965, sd) * uSunVis;
    col += uSunColor * disc * 5.0 * (1.0 - cover * 0.96);

    float md = dot(d, uMoonDir);
    float moon = smoothstep(0.99925, 0.9995, md) * uMoonVis;
    col += vec3(0.82, 0.85, 0.9) * moon * 1.4 * (1.0 - cover * 0.92);
    col += vec3(0.45, 0.5, 0.58) * pow(max(md, 0.0), 260.0) * uMoonVis * 0.3 * (1.0 - cover);

    col = mix(col, mix(uCloudLit, cloudCol, 0.5), cirrus);
    col = mix(col, cloudCol, cover);
    col += vec3(0.7, 0.76, 0.9) * uFlash * (0.25 + cover * 0.75);
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;
