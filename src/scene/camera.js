import * as THREE from 'three';
import { clamp, damp, lerp } from '../core/emitter.js';

import { VIEWS } from './views.js';
import { groundHeight } from './terrain.js';

export { VIEWS };

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.view = 'shore';
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.from = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
    this.travel = 1; // 0..1 progress of a move between views
    this.travelTime = 1.4;
    this.pointer = new THREE.Vector2();
    this.pointerSmooth = new THREE.Vector2();
    this.followTarget = new THREE.Vector3();
    this.entrance = 1; // 1 = start pulled back, eases to 0
    this.reduced = false;
    // The visitor's own turn, tilt, zoom and slide on top of the chosen view.
    this.user = { yaw: 0, tilt: 0, zoom: 1, panX: 0, panZ: 0 };
    this.userS = { ...this.user };
    this._resolve(this.view, this.pos, this.target);
  }
}
