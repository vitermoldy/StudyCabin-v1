import * as THREE from 'three';
import { clamp, smoothstep } from '../core/emitter.js';
import { WORLD } from './materials.js';
import { Atmosphere } from './sky.js';
import { Terrain } from './terrain.js';
import { Ocean } from './ocean.js';
import { Cabin } from './cabin.js';
import { Resident } from './resident.js';
import { Pets } from './pets.js';
import { WeatherFX } from './weatherfx.js';
import { CameraRig } from './camera.js';
import { Ripples, RIPPLE_AREA } from './ripples.js';
import { Trees } from './trees.js';

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGL2RenderingContext && c.getContext('webgl2'));
  } catch {
    return false;
  }
}

export class World {
  constructor(canvas, { reducedMotion = false } = {}) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // A GPU that rejects a shader would leave a black canvas: fall back to the still picture.
    this.onShaderFail = null;
    this.renderer.debug.onShaderError = (gl, program, vs, fs) => {
      console.warn('StudyCabin: a shader did not compile; showing the still picture.', gl.getProgramInfoLog(program) || '');
      if (this.onShaderFail) this.onShaderFail();
    };
    this.maxDpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.dpr = this.maxDpr;
    this.renderer.setPixelRatio(this.dpr);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2600);
    this.rig = new CameraRig(this.camera);
    this.rig.reduced = reducedMotion;
    this.reduced = reducedMotion;

    this.atmo = new Atmosphere(this.scene, this.renderer);
    const lowPower = matchMedia('(max-width: 700px), (pointer: coarse)').matches;
    this.terrain = new Terrain(this.scene, { lowPower });
    this.trees = new Trees(this.scene, { lowPower });
    this.ocean = new Ocean(this.scene);
    this.ripples = new Ripples(this.renderer);
    this.ocean.setRipples(this.ripples.texture, RIPPLE_AREA);
    this.raycaster = new THREE.Raycaster();
    this.waterPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.04);
    this._rainDrops = 0;
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35);
    this.pointerNdc = new THREE.Vector2();
    this.pointerOn = false;
    this._push = new THREE.Vector3();
    this.cabin = new Cabin(this.scene);
    this.resident = new Resident(this.scene);
    this.pets = new Pets(this.scene, this.resident);
    this.fx = new WeatherFX(this.scene, this.cabin.flueTop);

    this.flash = 0;
    this._nextBolt = 6;
    this._boltSeq = [];
    this.onThunder = null;
    this._frameAvg = 16;
    this._dprCheck = 0;
    this._cooldown = 0;
    this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /** Drop resolution while frames run slow, raise it again when there is room. */
  _adapt(frameMs) {
    this._frameAvg += (frameMs - this._frameAvg) * 0.05;
    this._dprCheck += frameMs / 1000;
    if (this._cooldown > 0) this._cooldown -= frameMs / 1000;
    if (this._dprCheck < 2 || this._cooldown > 0) return;
    this._dprCheck = 0;
    let next = this.dpr;
    if (this._frameAvg > 24 && this.dpr > 0.6) next = Math.max(0.6, this.dpr - 0.2);
    else if (this._frameAvg < 12 && this.dpr < this.maxDpr) next = Math.min(this.maxDpr, this.dpr + 0.1);
    if (next !== this.dpr) {
      this.dpr = next;
      this.renderer.setPixelRatio(next);
      this.resize();
      this._cooldown = 3;
    }
  }

  _lightning(dt, storm) {
    if (this.reduced || storm < 0.5) {
      this.flash = Math.max(0, this.flash - dt * 4);
      return;
    }
    this._nextBolt -= dt;
    if (this._nextBolt <= 0) {
      this._nextBolt = 8 + Math.random() * 14;
      // A soft double pulse, never more than two flashes in a second.
      this._boltSeq = [{ at: 0, v: 0.75 }, { at: 0.42, v: 0.45 }];
      this._boltT = 0;
      if (this.onThunder) setTimeout(() => this.onThunder(storm), 700 + Math.random() * 2200);
    }
    if (this._boltSeq.length) {
      this._boltT += dt;
      while (this._boltSeq.length && this._boltT >= this._boltSeq[0].at) {
        this.flash = Math.max(this.flash, this._boltSeq.shift().v);
      }
    }
    this.flash = Math.max(0, this.flash - dt * 3.2);
  }

  /** Decide lamps, stove, fire and door from the time, weather and resident. */
  _house(state) {
    const { minutes, climate, activity } = state;
    const atmo = this.atmo;
    const p = climate.params;
    const darkness = clamp(1 - atmo.dayFactor + atmo.overcast * 0.4 + p.rain * 0.2 + p.fog * 0.15, 0, 1);
    const res = this.resident;
    const asleep = activity.pose === 'sleep';
    const awake = !asleep;
    const spot = res.spot;
    const at = (a, b) => minutes >= a * 60 && minutes < b * 60;
    const evening = at(17, 23.5);
    const on = (cond, level = 1) => (cond ? level : 0);
    const dark = darkness > 0.42;
    const season = climate.season;
    const cold = season === 'winter' || season === 'autumn' || climate.temperature(minutes) < 14;
    const stoveLit = (cold && (at(15.5, 23.1) || at(6.6, 9.5))) || (season === 'rainy' && at(18.5, 22.8));

    this.cabin.set({
      kitchen: on(awake && dark && (spot === 'cook' || spot === 'dine' || evening), spot === 'cook' || spot === 'dine' ? 1 : 0.55),
      living: on(awake && dark && (['sofa', 'armchair', 'shelf', 'stove', 'window'].includes(spot) || evening), 1),
      bed: (activity.id === 'wake' || activity.id === 'bedtime' || (asleep && at(23, 23.15))) && darkness > 0.3 ? 0.85 : asleep && darkness > 0.5 ? 0.14 : 0,
      desk: on(spot === 'desk' && !res.path && darkness > 0.25, 1),
      screen: on(spot === 'desk' && !res.path && (activity.pose === 'sitType'), 1),
      stove: on(stoveLit, 1),
      fire: on(at(18.5, 22.5) && p.rain < 0.2 && p.snow < 0.3 && season !== 'rainy', 1),
      porch: on(darkness > 0.6 && (minutes >= 17 * 60 || minutes < 30), 1),
      sleeping: on(asleep && !res.path, 1),
      door: on(Math.min(res.doorDistance, this.pets.doorDistance) < 1.5, 1),
    });
    this.stoveLit = this.cabin.state.stove;
  }

  update(dt, t, state) {
    const { minutes, climate, activity, follow = true } = state;
    const p = climate.params;
    WORLD.uTime.value = t;
    WORLD.uWind.value = p.wind;
    WORLD.uSnow.value = climate.look.snow * (0.55 + p.snow * 0.45);
    WORLD.uWet.value = clamp(p.rain * 1.2, 0, 1);

    this._lightning(dt, p.storm);
    this.rig.update(dt, t, this.resident.head);

    this.atmo.update({
      minutes,
      season: { ...climate.seasonInfo, id: climate.season },
      params: p,
      time: t,
      flash: this.flash,
      cameraPos: this.camera.position,
    });
    // Caustics need sun on the water; a little stays under cloud.
    const sunVis = this.atmo.uniforms.uSunVis.value;
    this.terrain.update(climate.look, { caustic: Math.max(0, 0.1 + sunVis * 0.6 * this.atmo.dayFactor - this.atmo.night * 0.1) });
    this.trees.update(climate.look);
    this._grassPush(dt);
    this._rain(dt, p.rain);
    this.ripples.step(2);
    this.ocean.update({ time: t, params: p, atmo: this.atmo, rippleTexture: this.ripples.texture });
    this._house({ minutes, climate, activity });
    this.cabin.update(dt, t);
    this.resident.update(dt, t, state.residentOptions);
    this.pets.update(dt, t, {
      minutes,
      conditions: { badWeather: climate.badWeather, cold: climate.season === 'winter' || climate.temperature(minutes) < 9 },
      speedUp: state.residentOptions?.speedUp ?? 1,
    });
    this.fx.update({
      time: t,
      params: p,
      look: climate.look,
      camera: this.camera,
      light: 0.15 + this.atmo.dayFactor * 0.85,
      stove: this.cabin.state.stove,
      viewportHeight: this.height * this.dpr,
    });
    // Glass reflects more by day, shows the lit room at night.
    const glass = this.cabin.mat.glass;
    glass.opacity = 0.08 + this.atmo.dayFactor * 0.16 * (1 - smoothstep(0.3, 1, this.cabin.state.living + this.cabin.state.kitchen) * 0.4);
    glass.color.copy(this.atmo.horizon).lerp(WHITE, 0.25);
  }

  /** The point on level
  /** Mouse position over the scene (CSS pixels), for the grass that parts round it. */
  setPointer(x, y, on = true) {
    this.pointerNdc.set((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.pointerOn = on;
  }

  _grassPush(dt) {
    const push = this.terrain.grassPush.value;
    let want = 0;
    if (this.pointerOn) {
      this.raycaster.setFromCamera(this.pointerNdc, this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.groundPlane, tmpHit);
      if (hit && hit.distanceTo(this.camera.position) < 70) {
        push.x = hit.x;
        push.y = hit.z;
        want = 1;
      }
    }
    push.z += (want - push.z) * (1 - Math.exp(-6 * dt));
  }

  /** Raindrops ring the water in front of the cabin. */
  _rain(dt, rain) {
    if (!this.ripples.ok || rain < 0.05) return;
    this._rainDrops += dt * rain * 40;
    while (this._rainDrops >= 1) {
      this._rainDrops -= 1;
      const x = (Math.random() - 0.5) * 50;
      const z = 12.5 + Math.random() * 30;
      this.ripples.drop(x, z, 0.3 + Math.random() * 0.25, 0.2 + Math.random() * 0.15);
    }
  }

  /**
   * A press or drag on the screen: where it meets the water, drop a ripple.
   * x, y in CSS pixels. Returns true when it touched water.
   */
  poke(x, y, strength = 0.55) {
    if (!this.ripples.ok) return false;
    const ndc = new THREE.Vector2((x / this.width) * 2 - 1, -(y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.waterPlane, tmpHit);
    if (!hit || hit.z < 11.6) return false;
    this.ripples.drop(hit.x, hit.z, 0.7, strength);
    return true;
  }

  render(frameMs = 16) {
    this.renderer.render(this.scene, this.camera);
    this._adapt(frameMs);
  }

  /**
   * Mean relative luminance (0..1) of the rendered pixels under each CSS-pixel
   * rectangle. Called right after render, so the drawing buffer is still there.
   */
  sampleLuminance(rects) {
    const gl = this.renderer.getContext();
    const ratio = this.renderer.getPixelRatio();
    const H = gl.drawingBufferHeight;
    const out = [];
    const buf = new Uint8Array(4 * 12 * 6);
    for (const r of rects) {
      let sum = 0;
      let max = 0;
      let min = 1;
      let n = 0;
      // Sample a 4 x 3 grid of small blocks across the rectangle.
      for (let gy = 0; gy < 3; gy++) {
        for (let gx = 0; gx < 4; gx++) {
          const cx = Math.round((r.x + (r.w * (gx + 0.5)) / 4) * ratio);
          const cy = Math.round(H - (r.y + (r.h * (gy + 0.5)) / 3) * ratio);
          const x = clamp(cx - 6, 0, gl.drawingBufferWidth - 12);
          const y = clamp(cy - 3, 0, H - 6);
          gl.readPixels(x, y, 12, 6, gl.RGBA, gl.UNSIGNED_BYTE, buf);
          let blk = 0;
          for (let i = 0; i < buf.length; i += 4) {
            blk += 0.2126 * lin(buf[i]) + 0.7152 * lin(buf[i + 1]) + 0.0722 * lin(buf[i + 2]);
          }
          blk /= buf.length / 4;
          sum += blk;
          max = Math.max(max, blk);
          min = Math.min(min, blk);
          n++;
        }
      }
      out.push({ mean: sum / n, max, min });
    }
    return out;
  }
}

const WHITE = new THREE.Color(1, 1, 1);
const tmpHit = new THREE.Vector3();
const LIN = new Float32Array(256).map((_, i) => {
  const c = i / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
});
function lin(v) {
  return LIN[v];
}
