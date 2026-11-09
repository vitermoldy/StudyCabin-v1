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
    // How far the visitor may wander from the view's own target, and pull the camera back.
    this.panLimit = 150;
    this.maxRadius = 200;
    this.lookUp = 0; // radians the gaze is tipped above level, toward the sky
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

  /**
   * Drag to turn and tilt: pixels moved. Dragging down lowers the camera to level ground; going
   * on past it tips the gaze up, to the sky.
   */
  orbit(dx, dy) {
    this.rotateBy(-dx * 0.0055, -dy * 0.0045);
  }

  /** Turn and tilt by angles (radians), as orbit() does for a drag. */
  rotateBy(yaw, tilt) {
    this.user.yaw += yaw;
    this.user.tilt = clamp(this.user.tilt + tilt, -2.9, 1.2);
  }

  /** Drag to move across the land like a map: pixels moved. */
  pan(dx, dy) {
    const dist = this.pos.distanceTo(this.target) * this.userS.zoom;
    const k = Math.max(dist, 6) * 0.0016;
    const theta = Math.atan2(this.camera.position.x - this.target.x, this.camera.position.z - this.target.z);
    const rx = Math.cos(theta);
    const rz = -Math.sin(theta);
    const fx = Math.sin(theta);
    const fz = Math.cos(theta);
    const L = this.panLimit;
    this.user.panX = clamp(this.user.panX - dx * k * rx - dy * k * fx, -L, L);
    this.user.panZ = clamp(this.user.panZ - dx * k * rz - dy
  }

  /** factor > 1 moves away, < 1 moves closer. */
  zoomBy(factor) {
    this.user.zoom = clamp(this.user.zoom * factor, 0.22, 3);
  }

  resetUser() {
    Object.assign(this.user, { yaw: 0, tilt: 0, zoom: 1, panX: 0, panZ: 0 });
  }

  get userMoved() {
    const u = this.user;
    return Math.abs(u.yaw) > 0.001 || Math.abs(u.tilt) > 0.001 || Math.abs(u.zoom - 1) > 0.001 || Math.abs(u.panX) > 0.01 || Math.abs(u.panZ) > 0.01;
  }

  /** True while the camera is still easing toward where the visitor put it. */
  get settling() {
    const a = this.user;
    const b = this.userS;
    return Math.abs(a.yaw - b.yaw) + Math.abs(a.tilt - b.tilt) + Math.abs(a.zoom - b.zoom) + Math.abs(a.panX - b.panX) * 0.1 + Math.abs(a.panZ - b.panZ) * 0.1 > 0.0005 || this.travel < 1;
  }

  setPointer(x, y) {
    this.pointer.set(x, y);
  }

  update(dt, t, followPoint) {
    const cam = this.camera;
    // Wider lens on tall screens.
    const fov = cam.aspect < 1 ? lerp(62, 42, clamp((cam.aspect - 0.45) / 0.55, 0, 1)) : 42;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
    if (followPoint) this.followTarget.lerp(followPoint, 1 - Math.exp(-2.5 * dt));
    const basePos = tmpA;
    const baseTarget = tmpB;
    this._resolve(this.view, basePos, baseTarget, this.view === 'follow' || this.view === 'window' ? this.followTarget : null);

    if (this.travel < 1) {
      this.travel = Math.min(1, this.travel + dt / this.travelTime);
      const k = easeInOut(this.travel);
      this.pos.lerpVectors(this.from.pos, basePos, k);
      this.target.lerpVectors(this.from.target, baseTarget, k);
    } else {
      this.pos.copy(basePos);
      this.target.copy(baseTarget);
    }

    // The visitor's own camera moves, eased so a drag feels smooth.
    for (const k of Object.keys(this.user)) this.userS[k] = damp(this.userS[k], this.user[k], 12, dt);
    const us = this.userS;
    if (Math.abs(us.yaw) + Math.abs(us.tilt) + Math.abs(us.zoom - 1) + Math.abs(us.panX) + Math.abs(us.panZ) > 1e-4) {
      this.target.x += us.panX;
      this.target.z += us.panZ;
      sph.setFromVector3(tmpE.subVectors(this.pos, this.target));
      sph.radius = clamp(sph.radius * us.zoom, 1.6, 190);
      sph.theta += us.yaw;
      sph.phi = clamp(sph.phi - us.tilt, 0.1, Math.PI / 2 - 0.02);
      this.pos.copy(this.target).add(tmpE.setFromSpherical(sph));
      // Stay above the sand and the sea, and outside the cabin.
      const floor = Math.max(groundHeight(this.pos.x, this.pos.z), -0.05) + 0.45;
      if (this.pos.y < floor) this.pos.y = floor;
      const inCabin = this.pos.x > -10.8 && this.pos.x < 7.6 && this.pos.z > -3.6 && this.pos.z < 3.6 && this.pos.y < 6.4;
      if (inCabin) this.pos.z = this.pos.z > -0.2 ? 3.6 : -3.6;
    }

    // Entrance: the camera settles a little closer once, on load.
    if (this.entrance > 0) this.entrance = Math.max(0, this.entrance - dt / 1.6);
    const settle = this.reduced ? 0 : easeInOut(this.entrance) * 0.06;

    // A slow breathing drift and a small answer to the pointer.
    this.pointerSmooth.x = damp(this.pointerSmooth.x, this.pointer.x, 2.5, dt);
    this.pointerSmooth.y = damp(this.pointerSmooth.y, this.pointer.y, 2.5, dt);
    const sway = this.reduced ? 0 : 1;
    const dist = this.pos.distanceTo(this.target);
    const right = tmpC.subVectors(this.target, this.pos).cross(UP).normalize();
    cam.position.copy(this.pos)
      .addScaledVector(tmpD.subVectors(this.pos, this.target), settle)
      .addScaledVector(right, (this.pointerSmooth.x * 0.035 * dist + Math.sin(t * 0.11) * 0.012 * dist) * sway)
      .addScaledVector(UP, (this.pointerSmooth.y * 0.018 * dist + Math.sin(t * 0.07) * 0.006 * dist) * sway);
    cam.lookAt(this.target);
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3();
const tmpB = new THREE.Vector3();
const tmpC = new THREE.Vector3();
const tmpD = new THREE.Vector3();
const tmpE = new THREE.Vector3();
const sph = new THREE.Spherical();
