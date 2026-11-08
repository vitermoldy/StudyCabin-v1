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

  /** Base position and target for a view at the current aspect. */
  _resolve(id, outPos, outTarget, follow = null) {
    const v = VIEWS[id];
    const cam = this.camera;
    outTarget.set(...v.target);
    outPos.set(...v.pos);
    if (id === 'window' && follow && follow.z < 7.5) {
      const fx = clamp(follow.x, -4.4, 4.4);
      outPos.x += fx - outTarget.x;
      outTarget.x = fx;
    }
    if (id === 'follow' && follow) {
      outTarget.copy(follow);
      outTarget.y -= 0.25;
      const inside = follow.z < 3.2;
      outPos.set(follow.x * 0.85 + 0.3, follow.y + 1.0, inside ? 6.6 : follow.z + 6.8);
    }
    // Pull back far enough that `width` metres fit across.
    const dir = outPos.clone().sub(outTarget);
    const dist0 = dir.length();
    dir.normalize();
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2) * cam.aspect);
    const need = v.width / 2 / Math.tan(hfov / 2);
    const dist = Math.max(dist0, Math.min(need, dist0 * 2.6));
    outPos.copy(outTarget).addScaledVector(dir, dist);
    if (id === 'window' || (id === 'follow' && follow && follow.z < 3.2)) {
      // Never pass through the glass.
      outPos.z = Math.max(outPos.z, 3.9);
    }
    return outPos;
  }

  setView(id) {
    if (!VIEWS[id] || id === this.view) return;
    this.from.pos.copy(this.camera.position);
    this.from.target.copy(this.target);
    this.view = id;
    this.travel = this.reduced ? 1 : 0;
    this.resetUser();
  }

  /** Drag to turn: pixels moved. */
  orbit(dx, dy) {
    this.user.yaw -= dx * 0.0055;
    this.user.tilt = clamp(this.user.tilt - dy * 0.0045, -1.2, 1.2);
  }

  /** Drag to slide the view over the ground: pixels moved. */
  pan(dx, dy) {
    const dist = this.pos.distanceTo(this.target) * this.userS.zoom;
    const k = dist * 0.0016;
    const theta = Math.atan2(this.camera.position.x - this.target.x, this.camera.position.z - this.target.z);
    const rx = Math.cos(theta);
    const rz = -Math.sin(theta);
    const fx = Math.sin(theta);
    const fz = Math.cos(theta);
    this.user.panX = clamp(this.user.panX - dx * k * rx - dy * k * fx, -60, 60);
    this.user.panZ = clamp(this.user.panZ - dx * k * rz - dy * k * fz, -45, 60);
  }
}
