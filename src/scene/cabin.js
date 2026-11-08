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
}
