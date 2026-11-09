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
    // and stay low: nothing streaks across the zenith when the view is tipped up
    return col * smoothstep(-0.35, 0.45, -d.z) * smoothstep(0.015, 0.08, d.y) * (1.0 - smoothstep(0.35, 0.7, d.y));
  }

  // The Milky Way: a soft band of light with dark dust lanes and a brighter core.
  vec3 galaxy(vec3 d){
    vec3 n = normalize(vec3(0.42, 0.5, 0.76));
    float g = dot(d, n);
    float band = exp(-g * g / 0.018);
    // Coordinates along the band itself, not round the zenith, so looking straight up shows no
    // pinch; the seam sits at the band's lowest point, below the horizon.
    vec3 b1 = normalize(vec3(0.0, 1.0, 0.0) - n * n.y);
    vec3 b2 = cross(n, b1);
    vec2 q = vec2(atan(dot(d, b2), dot(d, b1)) * 2.2, g * 9.0);
    q =
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

const C = (hex) => new THREE.Color(hex);

// Clear sky by sun height (y of the sun direction).
const CLEAR = [
  { y: -0.3, zenith: C('#0c1522'), horizon: C('#1b2738') },
  { y: -0.08, zenith: C('#22324d'), horizon: C('#55627a') },
  { y: 0.0, zenith: C('#33496b'), horizon: C('#d39470') },
  { y: 0.12, zenith: C('#55789f'), horizon: C('#e2c09b') },
  { y: 0.35, zenith: C('#6a8fb8'), horizon: C('#c3d0d6') },
  { y: 1.0, zenith: C('#6589b2'), horizon: C('#bfcdd4') },
];
const OVERCAST = [
  { y: -0.3, zenith: C('#15181b'), horizon: C('#22272b') },
  { y: -0.08, zenith: C('#353b41'), horizon: C('#4b5156') },
  { y: 0.0, zenith: C('#555a5f'), horizon: C('#7e7671') },
  { y: 0.12, zenith: C('#8a9092'), horizon: C('#aaa9a3') },
  { y: 0.35, zenith: C('#a2a8a9'), horizon: C('#c3c6c4') },
  { y: 1.0, zenith: C('#a7adae'), horizon: C('#c8cbc9') },
];

function sample(table, y, key, out) {
  if (y <= table[0].y) return out.copy(table[0][key]);
  for (let i = 1; i < table.length; i++) {
    if (y <= table[i].y) {
      const a = table[i - 1];
      const b = table[i];
      const t = (y - a.y) / (b.y - a.y);
      return out.copy(a[key]).lerp(b[key], t * t * (3 - 2 * t));
    }
  }
  return out.copy(table[table.length - 1][key]);
}

const SUN_LOW = C('#ff9b5e');
const SUN_HIGH = C('#fff0db');
const MOON_LIGHT = C('#a6bbdc');

/**
 * The sky dome, sun, moon, hemisphere light and fog: everything that follows
 * the clock and the weather.
 */
export class Atmosphere {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    this.uniforms = {
      uZenith: { value: C('#6a8fb8') },
      uHorizon: { value: C('#c3d0d6') },
      uGround: { value: C('#8e8f88') },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uSunColor: { value: C('#fff0db') },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uCloudLit: { value: C('#d9dcdc') },
      uCloudDark: { value: C('#8d9396') },
      uSunVis: { value: 1 },
      uMoonVis: { value: 0 },
      uStars: { value: 0 },
      uCloud: { value: 0.2 },
      uTime: { value: 0 },
      uWind: { value: 0.3 },
      uFlash: { value: 0 },
      uGlow: { value: 1 },
      uFogAmt: { value: 0.2 },
      uAurora: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(1000, 48, 24), mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    this.fog = new THREE.FogExp2(0xc3c6c4, 0.004);
    scene.fog = this.fog;

    this.hemi = new THREE.HemisphereLight(0xc8d2d8, 0x6f6a60, 1);
    scene.add(this.hemi);

    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    const coarse = matchMedia('(max-width: 700px)').matches;
    this.sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -19; sc.right = 19; sc.top = 15; sc.bottom = -13; sc.near = 5; sc.far = 160;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.035;
    this.sun.target.position.set(-0.5, 0, 2.5);
    scene.add(this.sun, this.sun.target);

    this.sunDir = new THREE.Vector3();
    this.moonDir = new THREE.Vector3();
    this.dayFactor = 1;
    this.night = 0;
    this.overcast = 0;
    this.horizon = new THREE.Color();
    this.zenith = new THREE.Color();
    this.fogColor = new THREE.Color();
    this.sunColor = new THREE.Color();
    this._tmpA = new THREE.Color();
    this._tmpB = new THREE.Color();
  }

  static sunDirection(minutes, season, out) {
    const { sunrise, sunset, noonElevation } = season;
    const dayLen = sunset - sunrise;
    let theta;
    if (minutes >= sunrise && minutes <= sunset) theta = ((minutes - sunrise) / dayLen) * Math.PI;
    else {
      const since = (((minutes - sunset) % 1440) + 1440) % 1440;
      theta = Math.PI + (since / (1440 - dayLen)) * Math.PI;
    }
    const peak = THREE.MathUtils.degToRad(noonElevation);
    const el = Math.sin(theta) * (Math.sin(theta) >= 0 ? peak : 0.6);
    const hx = Math.cos(theta);
    const hz = -0.8 + 1.4 * Math.max(Math.sin(theta), -0.3);
    const hl = Math.hypot(hx, hz) || 1;
    return out.set((hx / hl) * Math.cos(el), Math.sin(el), (hz / hl) * Math.cos(el));
  }

  update({ minutes, season, params, time, flash, cameraPos }) {
    const u = this.uniforms;
    Atmosphere.sunDirection(minutes, season, this.sunDir);
    Atmosphere.sunDirection((minutes + 720) % 1440, season, this.moonDir);
    this.moonDir.x *= -1; // the moon crosses the other way round, so it is not a second sun

    const sy = this.sunDir.y;
    const day = smoothstep(-0.1, 0.14, sy);
    this.dayFactor = day;
    this.night = 1 - smoothstep(-0.16, 0.02, sy);
    const overcast = smoothstep(0.35, 0.95, params.cloud);
    this.overcast = overcast;
    const storm = params.storm;

    sample(CLEAR, sy, 'zenith', this._tmpA);
    sample(OVERCAST, sy, 'zenith', this._tmpB);
    this.zenith.copy(this._tmpA).lerp(this._tmpB, overcast);
    sample(CLEAR, sy, 'horizon', this._tmpA);
    sample(OVERCAST, sy, 'horizon', this._tmpB);
    this.horizon.copy(this._tmpA).lerp(this._tmpB, overcast);

    // Fog pulls the whole sky toward a soft grey of the same brightness.
    const fogAmt = clamp(params.fog, 0, 1);
    const grey = this._tmpA.copy(this.horizon);
    const l = (grey.r + grey.g + grey.b) / 3;
    grey.setRGB(lerp(grey.r, l, 0.7), lerp(grey.g, l, 0.7), lerp(grey.b, l, 0.7));
    this.horizon.lerp(grey, fogAmt * 0.6);
    this.zenith.lerp(this.horizon, fogAmt * 0.55);
    const darken = 1 - storm * 0.38 - params.rain * 0.1;
    this.horizon.multiplyScalar(darken);
    this.zenith.multiplyScalar(darken);

    u.uZenith.value.copy(this.zenith);
    u.uHorizon.value.copy(this.horizon);
    this.fogColor.copy(this.horizon).lerp(this.zenith, 0.12);
    u.uGround.value.copy(this.fogColor).multiplyScalar(0.8);
    this.fog.color.copy(this.fogColor);
    const f = params.fog;
    this.fog.density = 0.003 + 0.0035 * f + 0.014 * f * f * f + params.rain * 0.002 + params.snow * 0.003;

    // Sun colour and strength.
    const lowness = 1 - smoothstep(0.02, 0.4, sy);
    this.sunColor.copy(SUN_HIGH).lerp(SUN_LOW, lowness);
    u.uSunColor.value.copy(this.sunColor);
    u.uSunDir.value.copy(this.sunDir);
    u.uMoonDir.value.copy(this.moonDir);
    u.uSunVis.value = smoothstep(-0.06, 0.04, sy) * (1 - overcast * 0.85);
    u.uGlow.value = 0.6 + lowness * 1.4;
    u.uMoonVis.value = this.night * smoothstep(-0.05, 0.1, this.moonDir.y);
    u.uStars.value = this.night * (1 - overcast * 0.9) * (1 - fogAmt * 0.8);
    // a few clouds are always about; overcast fills the sky
    u.uCloud.value = 0.3 + params.cloud * 0.7;
    const auroraSeason = { winter: 1, autumn: 0.85, spring: 0.7, rainy: 0.55, summer: 0.5 }[season.id] ?? 0.7;
    u.uAurora.value = this.night * (1 - overcast) * (1 - fogAmt * 0.85) * auroraSeason;
    u.uWind.value = params.wind;
    u.uTime.value = time;
    u.uFogAmt.value = fogAmt;
    u.uFlash.value = flash;
    u.uCloudLit.value.copy(this.horizon).lerp(this._tmpB.setRGB(1, 1, 1), 0.25 * day).lerp(this.sunColor, 0.15 * day * (1 - overcast));
    u.uCloudDark.value.copy(this.zenith).lerp(this.horizon, 0.4).multiplyScalar(0.72);

    this.dome.position.copy(cameraPos);

    // Lights.
    const sunUp = smoothstep(-0.03, 0.08, sy);
    const moonUp = smoothstep(-0.02, 0.15, this.moonDir.y) * this.night;
    const useMoon = sunUp < 0.02;
    const dir = useMoon ? this.moonDir : this.sunDir;
    this.sun.position.copy(this.sun.target.position).addScaledVector(dir, 70);
    if (useMoon) {
      this.sun.color.copy(MOON_LIGHT);
      this.sun.intensity = 0.42 * moonUp * (1 - overcast * 0.75);
    } else {
      this.sun.color.copy(this.sunColor);
      this.sun.intensity = 3.1 * sunUp * (1 - overcast * 0.78) * (1 - fogAmt * 0.3);
    }
    this.sun.castShadow = this.sun.intensity > 0.05;

    this.hemi.color.copy(this.zenith).lerp(this.horizon, 0.5).lerp(this._tmpB.setRGB(1, 1, 1), 0.2);
    this.hemi.groundColor.copy(this.horizon).multiplyScalar(0.45);
    this.hemi.intensity = 0.55 + day * (0.95 + overcast * 0.45) + flash * 2.2;

    // A little more exposure at night so the scene never goes black.
    this.renderer.toneMappingExposure = lerp(1.0, 1.45, this.night) * (1 - storm * 0.05);
  }
}
