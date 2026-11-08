import * as THREE from 'three';
import { clamp, smoothstep } from '../core/emitter.js';
import { WORLD } from './materials.js';
import { Atmosphere } from './sky.js';
import { Terrain } from './terrain.js';
import { Ocean } from './ocean.js';
import { Cabin } from './cabin.js';
import { Resident } from './resident.js';
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
}
