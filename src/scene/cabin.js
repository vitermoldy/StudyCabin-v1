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

  /** Box by centre and size, inside an optional parent group. */
  _cb(mat, w, h, d, x, y, z, opts) {
    const geo = metricBoxUV(new THREE.BoxGeometry(w, h, d), w, h, d);
    const mesh = this._m(geo, mat, opts);
    mesh.position.set(x, y, z);
    return mesh;
  }

  _soft(mat, w, h, d, r, x, y, z, opts) {
    const mesh = this._m(new RoundedBoxGeometry(w, h, d, 3, r), mat, opts);
    mesh.position.set(x, y, z);
    return mesh;
  }

  _cyl(mat, rt, rb, h, x, y, z, seg = 16, opts) {
    const mesh = this._m(new THREE.CylinderGeometry(rt, rb, h, seg), mat, opts);
    mesh.position.set(x, y, z);
    return mesh;
  }

  _legs(mat, cx, cz, w, d, h, y0 = FLOOR, t = 0.045, parent = this.group) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        this._cb(mat, t, h, t, cx + sx * (w / 2 - t), y0 + h / 2, cz + sz * (d / 2 - t), { parent });
      }
    }
  }

  // ------------------------------------------------------------ materials
  _makeMaterials() {
    const fab = fabricTexture();
    this.mat = {
      siding: weathered(std('#f6f9f1', { map: sidingTexture(), roughness: 0.86 }), { snow: 0.6 }),
      trim: std('#2b2f2d', { roughness: 0.6 }),
      roof: weathered(std('#f2f4f5', { map: roofTexture(), roughness: 0.52, metalness: 0.12 }), { snow: 1 }),
      deck: weathered(std('#f2ece4', { map: deckTexture(), roughness: 0.9 }), { snow: 0.85 }),
      found: std('#3a3936', { roughness: 0.95 }),
      floor: std('#ffffff', { map: floorTexture(), roughness: 0.62 }),
      panel: std('#f4ece2', { map: panelTexture(), roughness: 0.82 }),
      ceiling: std('#d9c8b6', { map: panelTexture(), roughness: 0.85 }),
      glass: new THREE.MeshStandardMaterial({
        color: '#b4c4c5', transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false,
      }),
      linen: std('#ddd8cd', { map: fab, roughness: 0.95 }),
      duvet: std('#bfb9ad', { map: fab, roughness: 0.95 }),
      sofa: std('#b6ae9f', { map: fab, roughness: 0.95 }),
      cushion: std('#d1c9ba', { map: fab, roughness: 0.95 }),
      rug: std('#8f8577', { map: fab, roughness: 1 }),
      wood: std('#a7825f', { roughness: 0.7 }),
      woodDark: std('#6c5240', { roughness: 0.75 }),
      deckWood: weathered(std('#87827a', { roughness: 0.85 }), { snow: 0.8 }),
      metal: std('#1f2121', { roughness: 0.45, metalness: 0.5 }),
      counter: std('#d9d5cc', { roughness: 0.38 }),
      cabinet: std('#7e604a', { roughness: 0.7 }),
      ceramic: std('#e6e1d6', { roughness: 0.35 }),
      leaf: std('#4f6a44', { roughness: 0.8 }),
      pot: std('#b19f88', { roughness: 0.8 }),
      print: std('#ffffff', { map: printTexture(), roughness: 0.9 }),
      books: std('#ffffff', { map: booksTexture(), roughness: 0.9 }),
      stoveGlass: new THREE.MeshStandardMaterial({ color: '#120c08', emissive: '#ff7a2e', emissiveIntensity: 0, roughness: 0.3 }),
      screen: new THREE.MeshStandardMaterial({ color: '#1b1d1f', emissive: '#d6e4ee', emissiveIntensity: 0, roughness: 0.3 }),
      flame: new THREE.MeshBasicMaterial({ color: '#ffb35c', transparent: true, opacity: 0, depthWrite: false }),
    };
    this.shades = {};
    for (const id of ['kitchen', 'living', 'bed', 'desk', 'porch']) {
      this.shades[id] = new THREE.MeshStandardMaterial({ color: '#e7dcc6', emissive: '#ffcf8f', emissiveIntensity: 0, roughness: 0.8 });
    }
  }

  // ------------------------------------------------------------ shell
  _shell() {
    const { siding, panel, floor, ceiling, found, trim } = this.mat;
    this._bx(found, -7.15, 7.15, -0.3, FLOOR - 0.02, -3.15, FRONT);
    this._bx(floor, CABIN.x0, CABIN.x1, FLOOR - 0.03, FLOOR, CABIN.z0, FRONT);
    this._bx(ceiling, CABIN.x0, CABIN.x1, WALL_TOP, WALL_TOP + 0.06, CABIN.z0, FRONT, { cast: false });
    // back wall
    this._bx(siding, -7.15, 7.15, 0.05, WALL_TOP, -3.15, -3.03);
    this._bx(panel, CABIN.x0, CABIN.x1, FLOOR, WALL_TOP, -3.03, -3.0, { cast: false });
    // gable side walls
    const shape = new THREE.Shape();
    shape.moveTo(-3.15, 0.05);
    shape.lineTo(3.12, 0.05);
    shape.lineTo(3.12, WALL_TOP);
    shape.lineTo(0, RIDGE);
    shape.lineTo(-3.15, WALL_TOP);
    shape.closePath();
    for (const side of [-1, 1]) {
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.12, bevelEnabled: false });
      geo.rotateY(-Math.PI / 2);
      geo.translate(side > 0 ? 7.12 : -7.0, 0, 0);
      this._m(geo, siding);
      const x0 = side > 0 ? 6.97 : CABIN.x0;
      this._bx(panel, x0, x0 + 0.03, FLOOR, WALL_TOP, CABIN.z0, FRONT, { cast: false });
      // dark corner boards
      this._bx(trim, side * 7.0 - (side > 0 ? 0 : 0.16), side * 7.0 + (side > 0 ? 0.16 : 0), 0.05, WALL_TOP, 2.98, 3.16);
      this._bx(trim, side * 7.0 - (side > 0 ? 0 : 0.16), side * 7.0 + (side > 0 ? 0.16 : 0), 0.05, WALL_TOP, -3.18, -3.02);
    }
  }

  _front() {
    const { siding, trim, glass } = this.mat;
    this._bx(siding, -7.15, 7.15, GLASS_TOP, WALL_TOP, 2.98, 3.13);
    this._bx(trim, -7.0, 7.0, FLOOR, FLOOR + 0.05, 2.95, 3.1);
    this._bx(trim, -7.0, 7.0, GLASS_TOP - 0.06, GLASS_TOP, 2.95, 3.1);
    this._bx(trim, -7.0, 7.0, 0.1, FLOOR - 0.03, 3.0, 3.06); // skirting under the glass line
    const posts = [-6.98, -3.62, -0.98, 0.98, 3.62, 6.98];
    for (const x of posts) this._bx(trim, x - 0.035, x + 0.035, FLOOR, GLASS_TOP, 2.97, 3.08);
    const panes = [[-6.93, -3.67], [-3.57, -1.03], [1.03, 3.57], [3.67, 6.93]];
    for (const [a, b] of panes) {
      const pane = this._bx(glass, a, b, FLOOR + 0.05, GLASS_TOP - 0.06, 3.01, 3.03, { cast: false, receive: false });
      pane.renderOrder = 2;
    }
    // sliding door: glass and a thin frame
    this.door = new THREE.Group();
    this.door.position.set(0, 0, 2.93);
    this.group.add(this.door);
    const dg = this._bx(glass, -0.93, 0.93, FLOOR + 0.05, GLASS_TOP - 0.06, -0.01, 0.01, { cast: false, receive: false, parent: this.door });
    dg.renderOrder = 2;
    this._bx(trim, -0.95, -0.92, FLOOR + 0.05, GLASS_TOP - 0.06, -0.02, 0.02, { parent: this.door });
    this._bx(trim, 0.92, 0.95, FLOOR + 0.05, GLASS_TOP - 0.06, -0.02, 0.02, { parent: this.door });
    this._bx(trim, 0.78, 0.82, FLOOR + 0.9, FLOOR + 1.3, 0.02, 0.05, { parent: this.door });
    // porch light beside the door
    this._bx(trim, 1.15, 1.31, GLASS_TOP + 0.08, GLASS_TOP + 0.3, 3.13, 3.2);
    this._bx(this.shades.porch, 1.17, 1.29, GLASS_TOP + 0.1, GLASS_TOP + 0.2, 3.2, 3.24, { cast: false });
  }

  _roof() {
    const { roof, trim } = this.mat;
    const run = 3.15;
    const rise = RIDGE - WALL_TOP;
    const alpha = Math.atan2(rise, run);
    const over = 0.55;
    const hRun = run + over;
    const len = hRun / Math.cos(alpha);
    const w = 15.3;
    for (const side of [1, -1]) {
      const geo = metricBoxUV(new THREE.BoxGeometry(w, 0.12, len), w, 0.12, len);
      const slab = this._m(geo, roof);
      const zc = side * hRun / 2;
      slab.position.set(0, RIDGE - Math.tan(alpha) * (hRun / 2) + 0.07, zc);
      slab.rotation.x = side * alpha;
      // barge boards on both gable ends
      for (const ex of [-1, 1]) {
        const bg = new THREE.BoxGeometry(0.06, 0.22, len);
        const b = this._m(bg, trim);
        b.position.set(ex * (w / 2 + 0.02), slab.position.y - 0.03, zc);
        b.rotation.x = side * alpha;
      }
      // fascia along the eave
      const eaveY = RIDGE - Math.tan(alpha) * hRun;
      this._cb(trim, w + 0.1, 0.18, 0.06, 0, eaveY - 0.02, side * (hRun + 0.02));
    }
    this._cb(roof, 15.4, 0.1, 0.32, 0, RIDGE + 0.12, 0);
    // stove flue through the roof
    const { stove } = F;
    this._cyl(this.mat.metal, 0.085, 0.085, RIDGE + 1.0 - (FLOOR + 0.62), stove.x, (FLOOR + 0.62 + RIDGE + 1.0) / 2, stove.z);
    this._cyl(this.mat.metal, 0.16, 0.16, 0.08, stove.x, RIDGE + 1.04, stove.z);
    this.flueTop = new THREE.Vector3(stove.x, RIDGE + 1.1, stove.z);
  }
}
