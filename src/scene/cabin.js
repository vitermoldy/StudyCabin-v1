import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { damp } from '../core/emitter.js';
import { FLOOR, CABIN, DECK, FURNITURE as F, ANNEX } from '../sim/layout.js';
import { weathered, std } from './materials.js';
import {
  sidingTexture, roofTexture, deckTexture, floorTexture, panelTexture,
  fabricTexture, printTexture, booksTexture, metricBoxUV,
} from './textures.js';

const WALL_TOP = FLOOR + CABIN.wall; // 3.55
const RIDGE = FLOOR + CABIN.ridge; // 5.85
const GLASS_TOP = FLOOR + 2.6;
const FRONT = CABIN.z1; // 3.0

/** The cabin: shell, glass, interior, deck furniture and every lamp. */
export class Cabin {
  constructor(scene) {
    this.group = new THREE.Group();
    scene.add(this.group);
    this._makeMaterials();
    this._shell();
    this._front();
    this._roof();
    this._deck();
    this._annex();
    this._kitchen();
    this._living();
    this._bedroom();
    this._desk();
    this._deckFurniture();
    this._lights();

    this.state = { kitchen: 0, living: 0, bed: 0, desk: 0, stove: 0, fire: 0, porch: 0, screen: 0, door: 0, sleeping: 0 };
    this.target = { ...this.state };
  }

  // ------------------------------------------------------------ helpers
  _m(geo, mat, { cast = true, receive = true, parent = this.group } = {}) {
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = receive;
    parent.add(mesh);
    return mesh;
  }

  /** Axis-aligned box from bounds, UVs in metres. */
  _bx(mat, x0, x1, y0, y1, z0, z1, opts) {
    const w = x1 - x0;
    const h = y1 - y0;
    const d = z1 - z0;
    const geo = metricBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d);
    const mesh = this._m(geo, mat, opts);
    mesh.position.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
    return mesh;
  }
}
