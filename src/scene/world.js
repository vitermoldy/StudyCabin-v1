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
