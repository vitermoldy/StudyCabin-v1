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

  /** A thin pane of glass: across x at depth z (axis 'z') or across z at x (axis 'x'). */
  _pane(a0, a1, y0, y1, axis, at) {
    const pane = axis === 'z'
      ? this._bx(this.mat.glass, a0, a1, y0, y1, at - 0.01, at + 0.01, { cast: false, receive: false })
      : this._bx(this.mat.glass, at - 0.01, at + 0.01, y0, y1, a0, a1, { cast: false, receive: false });
    pane.renderOrder = 2;
    return pane;
  }

  // ------------------------------------------------------------ shell
  // Every wall of the main room is glass in thin dark frames, so the rooms show from all sides
  // and daylight falls in from all of them; the floor, the ceiling and the roof stay solid.
  _shell() {
    const { floor, ceiling, found, trim } = this.mat;
    this._bx(found, -7.15, 7.15, -0.3, FLOOR - 0.02, -3.15, FRONT);
    this._bx(floor, CABIN.x0, CABIN.x1, FLOOR - 0.03, FLOOR, CABIN.z0, FRONT);
    this._bx(ceiling, CABIN.x0, CABIN.x1, WALL_TOP, WALL_TOP + 0.06, CABIN.z0, FRONT, { cast: false });
    // back wall: a sill, a head and posts, glass between
    const backZ = [-3.13, -3.02];
    this._bx(trim, -7.0, 7.0, FLOOR, FLOOR + 0.05, ...backZ);
    this._bx(trim, -7.0, 7.0, WALL_TOP - 0.06, WALL_TOP, ...backZ);
    const posts = [-7.0, -4.67, -2.33, 0, 2.33, 4.67, 7.0];
    for (const x of posts.slice(1, -1)) this._bx(trim, x - 0.035, x + 0.035, FLOOR, WALL_TOP, ...backZ);
    for (let i = 0; i < posts.length - 1; i++) this._pane(posts[i] + 0.035, posts[i + 1] - 0.035, FLOOR + 0.05, WALL_TOP - 0.06, 'z', -3.075);
    // gable ends: glass to the head of the wall, posts, and a glass triangle up to the ridge
    const tri = new THREE.Shape();
    tri.moveTo(-3.1, WALL_TOP);
    tri.lineTo(3.08, WALL_TOP);
    tri.lineTo(0, RIDGE - 0.05);
    tri.closePath();
    for (const side of [-1, 1]) {
      const x = side * 7.06;
      const xs = [x - 0.055, x + 0.055];
      this._bx(trim, ...xs, FLOOR, FLOOR + 0.05, -3.02, 2.98);
      this._bx(trim, ...xs, WALL_TOP - 0.06, WALL_TOP, -3.15, 3.12);
      const zs = [-3.02, -1.05, 1.05, 2.98];
      for (const z of [-1.05, 1.05]) this._bx(trim, ...xs, FLOOR, WALL_TOP, z - 0.035, z + 0.035);
      for (let i = 0; i < zs.length
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

  _deck() {
    const { deck, deckWood, found } = this.mat;
    this._bx(deck, DECK.x0, DECK.x1, FLOOR - 0.1, FLOOR, DECK.z0, DECK.z1);
    this._bx(deckWood, DECK.x0, DECK.x1, 0.05, FLOOR - 0.1, DECK.z1 - 0.06, DECK.z1);
    this._bx(deckWood, DECK.x0, DECK.x0 + 0.06, 0.05, FLOOR - 0.1, DECK.z0, DECK.z1);
    this._bx(deckWood, DECK.x1 - 0.06, DECK.x1, 0.05, FLOOR - 0.1, DECK.z0, DECK.z1);
    for (let x = DECK.x0 + 0.4; x < DECK.x1; x += 2.4) {
      this._bx(found, x - 0.07, x + 0.07, -0.3, FLOOR - 0.1, DECK.z1 - 0.35, DECK.z1 - 0.21);
    }
    // three steps down to the sand
    const steps = [[6.6, 6.95, 0.34], [6.95, 7.3, 0.18], [7.3, 7.65, 0.04]];
    for (const [z0, z1, top] of steps) this._bx(deck, -1.25, 1.25, top - 0.12, top, z0, z1);
    this._bx(deckWood, -1.3, -1.25, -0.05, FLOOR, 6.6, 7.65);
    this._bx(deckWood, 1.25, 1.3, -0.05, FLOOR, 6.6, 7.65);
  }

  _annex() {
    const { siding, roof, trim } = this.mat;
    this._bx(siding, ANNEX.x0, ANNEX.x1, 0.05, ANNEX.h, ANNEX.z0, ANNEX.z1);
    this._bx(roof, ANNEX.x0 - 0.2, ANNEX.x1 + 0.08, ANNEX.h, ANNEX.h + 0.1, ANNEX.z0 - 0.25, ANNEX.z1 + 0.3);
    this._bx(trim, -9.35, -8.35, FLOOR, ANNEX.h - 0.35, ANNEX.z1, ANNEX.z1 + 0.04);
    this._bx(trim, ANNEX.x0 - 0.2, ANNEX.x1 + 0.08, ANNEX.h - 0.06, ANNEX.h, ANNEX.z1 + 0.26, ANNEX.z1 + 0.32);
  }

  // ------------------------------------------------------------ interior
  _kitchen() {
    const { counter, cabinet, ceramic, metal, wood, woodDark, trim, leaf, pot } = this.mat;
    // back counter and tall cupboard
    this._bx(cabinet, -6.1, -3.8, FLOOR, FLOOR + 0.86, -3.0, -2.42);
    this._bx(counter, -6.12, -3.78, FLOOR + 0.86, FLOOR + 0.92, -3.0, -2.38);
    this._bx(cabinet, -6.98, -6.12, FLOOR, FLOOR + 2.2, -3.0, -2.38);
    // open shelves with bowls and jars
    for (const y of [FLOOR + 1.55, FLOOR + 2.0]) {
      this._bx(wood, -6.0, -3.9, y, y + 0.04, -3.0, -2.74);
      for (let i = 0; i < 5; i++) {
        const x = -5.8 + i * 0.42;
        if ((i + (y > 2.2 ? 1 : 0)) % 2) this._cyl(ceramic, 0.07, 0.06, 0.16, x, y + 0.12, -2.86, 12);
        else this._cyl(ceramic, 0.12, 0.07, 0.07, x, y + 0.075, -2.86, 14);
      }
    }
    // island with a pot on the hob
    const I = F.island;
    this._bx(cabinet, I.x - I.w / 2, I.x + I.w / 2, FLOOR, FLOOR + 0.86, I.z - I.d / 2, I.z + I.d / 2);
    this._bx(counter, I.x - I.w / 2 - 0.03, I.x + I.w / 2 + 0.03, FLOOR + 0.86, FLOOR + 0.92, I.z - I.d / 2 - 0.03, I.z + I.d / 2 + 0.03);
    this._bx(trim, I.x - 0.62, I.x + 0.02, FLOOR + 0.92, FLOOR + 0.925, I.z - 0.3, I.z + 0.3);
    this._cyl(metal, 0.13, 0.12, 0.14, I.x - 0.3, FLOOR + 0.99, I.z - 0.05, 16);
    this._cyl(ceramic, 0.09, 0.1, 0.18, I.x + 0.45, FLOOR + 1.01, I.z + 0.1, 14);
    // dining table and chairs
    const T = F.table;
    this._bx(wood, T.x - T.w / 2, T.x + T.w / 2, FLOOR + 0.71, FLOOR + 0.76, T.z - T.d / 2, T.z + T.d / 2);
    this._legs(woodDark, T.x, T.z, T.w - 0.08, T.d - 0.08, 0.71);
    this._chair(T.x, 0.42, 0);
    this._chair(T.x - 0.38, 2.02, Math.PI);
    this._chair(T.x + 0.38, 2.02, Math.PI);
    this._cyl(ceramic, 0.13, 0.08, 0.06, T.x + 0.25, FLOOR + 0.79, T.z - 0.1, 14);
    // tall plant in the corner by the glass
    this._cyl(pot, 0.2, 0.16, 0.42, -6.55, FLOOR + 0.21, 2.5, 16);
    for (let i = 0; i < 7; i++) {
      const s = this._m(new THREE.IcosahedronGeometry(0.28 - i * 0.015, 0), leaf);
      s.position.set(-6.55 + Math.sin(i * 2.1) * 0.18, FLOOR + 0.75 + i * 0.17, 2.5 + Math.cos(i * 2.1) * 0.15);
      s.scale.set(1, 0.8, 1);
    }
    // pendants over the island and the table
    for (const [x, z] of [[I.x, I.z], [T.x, T.z]]) this._pendant(x, z, this.shades.kitchen);
  }

  _chair(x, z, rot, mat = this.mat.wood) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.group.add(g);
    this._cb(mat, 0.46, 0.04, 0.44, 0, FLOOR + 0.45, 0, { parent: g });
    this._cb(mat, 0.46, 0.42, 0.04, 0, FLOOR + 0.7, -0.21, { parent: g });
    this._legs(this.mat.woodDark, 0, 0, 0.44, 0.42, 0.43, FLOOR, 0.04, g);
    return g;
  }

  _pendant(x, z, shade) {
    this._cyl(this.mat.metal, 0.006, 0.006, WALL_TOP - (FLOOR + 2.2), x, (WALL_TOP + FLOOR + 2.2) / 2, z, 6, { cast: false });
    const cone = this._m(new THREE.ConeGeometry(0.22, 0.2, 24, 1, true), shade, { cast: false });
    cone.position.set(x, FLOOR + 2.12, z);
    cone.material.side = THREE.DoubleSide;
    const bulb = this._m(new THREE.SphereGeometry(0.05, 12, 8), shade, { cast: false });
    bulb.position.set(x, FLOOR + 2.04, z);
  }

  _living() {
    const { sofa, cushion, rug, wood, woodDark, metal, ceramic, print, books, trim, stoveGlass } = this.mat;
    this._bx(rug, -2.9, 0.2, FLOOR, FLOOR + 0.012, -2.2, 0.35, { cast: false });
    // sofa facing the glass
    const S = F.sofa;
    const sx0 = S.x - S.w / 2;
    const sx1 = S.x + S.w / 2;
    this._soft(sofa, S.w, 0.36, S.d, 0.06, S.x, FLOOR + 0.2, S.z);
    this._soft(sofa, S.w, 0.5, 0.26, 0.08, S.x, FLOOR + 0.6, S.z - S.d / 2 + 0.13);
    this._soft(sofa, 0.22, 0.6, S.d, 0.07, sx0 + 0.11, FLOOR + 0.32, S.z);
    this._soft(sofa, 0.22, 0.6, S.d, 0.07, sx1 - 0.11, FLOOR + 0.32, S.z);
    for (const dx of [-0.42, 0.42]) this._soft(cushion, 0.8, 0.12, 0.62, 0.05, S.x + dx, FLOOR + 0.44, S.z + 0.1);
    this._soft(cushion, 0.42, 0.36, 0.12, 0.05, sx0 + 0.42, FLOOR + 0.68, S.z - 0.22).rotation.z = 0.15;
    // coffee table with books and a mug
    const C = F.coffeeTable;
    this._bx(wood, C.x - C.w / 2, C.x + C.w / 2, FLOOR + 0.36, FLOOR + 0.42, C.z - C.d / 2, C.z + C.d / 2);
    this._bx(woodDark, C.x - C.w / 2 + 0.06, C.x + C.w / 2 - 0.06, FLOOR, FLOOR + 0.36, C.z - 0.12, C.z + 0.12);
    this._cb(this.mat.books, 0.3, 0.05, 0.22, C.x - 0.25, FLOOR + 0.445, C.z);
    this._cb(trim, 0.26, 0.04, 0.2, C.x - 0.25, FLOOR + 0.49, C.z + 0.01).rotation.y = 0.2;
    this._cyl(ceramic, 0.045, 0.04, 0.09, C.x + 0.28, FLOOR + 0.465, C.z + 0.05, 12);
    // armchair angled toward the glass
    const A = F.armchair;
    const ag = new THREE.Group();
    ag.position.set(A.x, 0, A.z);
    ag.rotation.y = A.rot;
    this.group.add(ag);
    this._soft(cushion, 0.78, 0.3, 0.74, 0.06, 0, FLOOR + 0.24, 0, { parent: ag });
    this._soft(cushion, 0.78, 0.55, 0.18, 0.06, 0, FLOOR + 0.62, -0.32, { parent: ag });
    for (const ex of [-0.36, 0.36]) this._soft(cushion, 0.12, 0.42, 0.7, 0.05, ex, FLOOR + 0.38, 0, { parent: ag });
    this._legs(woodDark, 0, 0, 0.7, 0.66, 0.1, FLOOR, 0.04, ag);
    // bookcase
    const B = F.shelf;
    const bx0 = B.x - B.w / 2;
    const bx1 = B.x + B.w / 2;
    this._bx(woodDark, bx0, bx1, FLOOR, FLOOR + 2.0, -3.0, -3.0 + B.d - 0.32);
    this._bx(woodDark, bx0, bx0 + 0.03, FLOOR, FLOOR + 2.0, -3.0, -3.0 + B.d);
    this._bx(woodDark, bx1 - 0.03, bx1, FLOOR, FLOOR + 2.0, -3.0, -3.0 + B.d);
    for (let i = 0; i < 5; i++) {
      const y = FLOOR + 0.05 + i * 0.48;
      this._bx(woodDark, bx0, bx1, y - 0.03, y, -3.0, -3.0 + B.d);
      if (i < 4) this._bx(books, bx0 + 0.04, bx1 - 0.04, y, y + 0.32, -2.96, -2.72, { cast: false });
    }
    // print above the sofa
    this._bx(trim, S.x - 0.66, S.x + 0.66, FLOOR + 1.45, FLOOR + 2.45, -3.0, -2.97);
    this._bx(print, S.x - 0.62, S.x + 0.62, FLOOR + 1.49, FLOOR + 2.41, -2.97, -2.96, { cast: false });
    // floor lamp
    this._cyl(metal, 0.16, 0.16, 0.03, -2.85, FLOOR + 0.015, -2.35, 16);
    this._cyl(metal, 0.012, 0.012, 1.55, -2.85, FLOOR + 0.8, -2.35, 6);
    const shade = this._m(new THREE.CylinderGeometry(0.17, 0.22, 0.28, 20, 1, true), this.shades.living, { cast: false });
    shade.material.side = THREE.DoubleSide;
    shade.position.set(-2.85, FLOOR + 1.62, -2.35);
    // wood stove
    const W = F.stove;
    this._bx(metal, W.x - 0.28, W.x + 0.28, FLOOR + 0.12, FLOOR + 0.66, W.z - 0.25, W.z + 0.22);
    this._legs(metal, W.x, W.z, 0.5, 0.42, 0.12, FLOOR, 0.035);
    this._bx(stoveGlass, W.x - 0.17, W.x + 0.17, FLOOR + 0.24, FLOOR + 0.52, W.z + 0.22, W.z + 0.225, { cast: false });
    this._bx(this.mat.ceramic, W.x - 0.5, W.x + 0.5, FLOOR, FLOOR + 0.02, W.z - 0.4, W.z + 0.55, { cast: false });
    // log basket
    this._cyl(woodDark, 0.2, 0.17, 0.3, W.x + 0.75, FLOOR + 0.15, W.z + 0.1, 14);
  }

  _bedroom() {
    const { wood, linen, duvet, cushion, woodDark, ceramic } = this.mat;
    const B = F.bed;
    const x0 = B.x - B.w / 2;
    const x1 = B.x + B.w / 2;
    const z0 = B.z - B.d / 2;
    const z1 = B.z + B.d / 2;
    this._bx(wood, x0, x1, FLOOR + 0.1, FLOOR + 0.32, z0, z1);
    this._bx(woodDark, x0 + 0.05, x1 - 0.05, FLOOR, FLOOR + 0.1, z0 + 0.05, z1 - 0.05);
    this._soft(linen, B.w - 0.06, 0.22, B.d - 0.08, 0.05, B.x, FLOOR + 0.43, B.z);
    this._bx(wood, x0 - 0.03, x1 + 0.03, FLOOR + 0.1, FLOOR + 1.12, -3.0, -2.92);
    for (const dx of [-0.42, 0.42]) this._soft(cushion, 0.68, 0.16, 0.38, 0.07, B.x + dx, FLOOR + 0.62, -2.62);
    // duvet: flat when the bed is made, raised while someone sleeps
    this.duvet = this._soft(duvet, B.w + 0.04, 0.1, 1.5, 0.05, B.x, FLOOR + 0.58, -1.6);
    this.duvetFold = this._soft(duvet, B.w + 0.04, 0.08, 0.32, 0.04, B.x, FLOOR + 0.66, -1.0);
    for (const n of [F.nightL, F.nightR]) {
      this._bx(woodDark, n.x - 0.24, n.x + 0.24, FLOOR, FLOOR + 0.46, n.z - 0.22, n.z + 0.22);
      this._cyl(ceramic, 0.07, 0.09, 0.22, n.x, FLOOR + 0.57, n.z, 14);
      const s = this._m(new THREE.CylinderGeometry(0.12, 0.16, 0.2, 18, 1, true), this.shades.bed, { cast: false });
      s.material.side = THREE.DoubleSide;
      s.position.set(n.x, FLOOR + 0.78, n.z);
    }
  }

  _desk() {
    const { wood, woodDark, trim, ceramic, metal, leaf, pot, screen } = this.mat;
    const D = F.desk;
    this._bx(wood, D.x - D.w / 2, D.x + D.w / 2, FLOOR + 0.72, FLOOR + 0.76, D.z - D.d / 2, D.z + D.d / 2);
    this._legs(woodDark, D.x, D.z, D.w - 0.04, D.d - 0.04, 0.72, FLOOR, 0.04);
    const top = FLOOR + 0.76;
    // laptop: its screen faces the chair, away from the glass
    this._bx(trim, D.x - 0.2, D.x + 0.2, top, top + 0.02, D.z - 0.28, D.z + 0.0);
    const lid = new THREE.Group();
    lid.position.set(D.x, top + 0.02, D.z + 0.0);
    lid.rotation.x = -0.32;
    this.group.add(lid);
    this._bx(trim, -0.2, 0.2, 0, 0.27, -0.006, 0.006, { parent: lid });
    this._bx(screen, -0.185, 0.185, 0.015, 0.255, -0.012, -0.007, { parent: lid, cast: false });
    // notebook, pen, mug, plant
    this._bx(ceramic, D.x - 0.62, D.x - 0.34, top, top + 0.015, D.z - 0.25, D.z - 0.03).rotation.y = 0.12;
    this._cyl(ceramic, 0.045, 0.04, 0.1, D.x + 0.36, top + 0.05, D.z - 0.18, 12);
    this._cyl(pot, 0.07, 0.055, 0.12, D.x + 0.58, top + 0.06, D.z + 0.12, 12);
    const p = this._m(new THREE.IcosahedronGeometry(0.11, 0), leaf);
    p.position.set(D.x + 0.58, top + 0.2, D.z + 0.12);
    // desk lamp
    this._cyl(metal, 0.07, 0.08, 0.02, D.x - 0.58, top + 0.01, D.z + 0.15, 14);
    this._cyl(metal, 0.01, 0.01, 0.42, D.x - 0.58, top + 0.22, D.z + 0.15, 6);
    const head = this._m(new THREE.ConeGeometry(0.09, 0.12, 18, 1, true), this.shades.desk, { cast: false });
    head.material.side = THREE.DoubleSide;
    head.position.set(D.x - 0.5, top + 0.44, D.z + 0.08);
    head.rotation.x = 0.5;
    // chair, its back to the room
    this._chair(D.x, 1.66, 0, woodDark);
  }

  _deckFurniture() {
    const { deckWood, metal, flame, ceramic } = this.mat;
    // low lounge chairs facing the sea
    for (const c of [F.deckChair, F.deckChair2]) {
      const g = new THREE.Group();
      g.position.set(c.x, 0, c.z);
      this.group.add(g);
      this._cb(deckWood, 0.66, 0.05, 0.6, 0, FLOOR + 0.36, 0.02, { parent: g });
      const back = this._cb(deckWood, 0.66, 0.62, 0.05, 0, FLOOR + 0.66, -0.3, { parent: g });
      back.rotation.x = -0.32;
      for (const sx of [-0.33, 0.33]) {
        this._cb(deckWood, 0.06, 0.06, 0.7, sx, FLOOR + 0.6, 0.0, { parent: g });
        this._cb(deckWood, 0.05, 0.36, 0.05, sx, FLOOR + 0.18, 0.28, { parent: g });
        this._cb(deckWood, 0.05, 0.36, 0.05, sx, FLOOR + 0.18, -0.24, { parent: g });
      }
    }
    // a wooden chair and a small table on the right
    this._chair(F.guitarChair.x, F.guitarChair.z, 0, deckWood);
    this._chair(F.guitarChair.x + 1.65, F.guitarChair.z, 0, deckWood);
    const t = F.deckTable;
    this._cyl(deckWood, 0.3, 0.3, 0.04, t.x, FLOOR + 0.55, t.z, 20);
    this._cyl(deckWood, 0.04, 0.04, 0.53, t.x, FLOOR + 0.27, t.z, 8);
    this._cyl(ceramic, 0.045, 0.04, 0.1, t.x + 0.1, FLOOR + 0.62, t.z - 0.05, 12);
    // fire bowl
    const f = F.fireBowl;
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const a = (i / 10) * Math.PI * 0.5;
      pts.push(new THREE.Vector2(0.05 + Math.sin(a) * 0.5, 0.42 - Math.cos(a) * 0.3));
    }
    const bowl = this._m(new THREE.LatheGeometry(pts, 28), metal);
    bowl.material = metal;
    bowl.position.set(f.x, FLOOR, f.z);
    this._cyl(metal, 0.14, 0.2, 0.14, f.x, FLOOR + 0.07, f.z, 16);
    this.flames = [];
    for (let i = 0; i < 4; i++) {
      const fl = this._m(new THREE.ConeGeometry(0.11 - i * 0.012, 0.42, 10), flame, { cast: false, receive: false });
      fl.position.set(f.x + Math.sin(i * 1.7) * 0.12, FLOOR + 0.55, f.z + Math.cos(i * 1.7) * 0.12);
      this.flames.push(fl);
    }
  }

  _lights() {
    const mk = (color, x, y, z, distance) => {
      const l = new THREE.PointLight(color, 0, distance, 2);
      l.position.set(x, y, z);
      this.group.add(l);
      return l;
    };
    const warm = '#ffc98a';
    this.lights = {
      kitchen: mk(warm, -5.2, FLOOR + 1.95, 0.2, 9),
      living: mk(warm, -2.75, FLOOR + 1.55, -2.1, 9),
      bed: mk(warm, F.bed.x, FLOOR + 1.1, -2.45, 7),
      desk: mk('#ffd7a3', F.desk.x - 0.45, FLOOR + 1.12, F.desk.z - 0.05, 5),
      stove: mk('#ff8a3c', F.stove.x, FLOOR + 0.55, F.stove.z + 0.6, 6),
      fire: mk('#ff9a4a', F.fireBowl.x, FLOOR + 0.95, F.fireBowl.z, 10),
    };
    this.maxLight = { kitchen: 9, living: 7, bed: 5, desk: 3.2, stove: 3.2, fire: 7 };
  }

  // ------------------------------------------------------------ state
  /** Targets for every lamp and moving part, each 0..1. */
  set(values) {
    Object.assign(this.target, values);
  }

  update(dt, time) {
    const s = this.state;
    for (const k of Object.keys(this.target)) {
      const rate = k === 'door' ? 5 : k === 'sleeping' ? 2.4 : 2.2;
      s[k] = damp(s[k], this.target[k], rate, dt);
    }
    const flick = (seed) => 0.86 + Math.sin(time * 9.1 + seed) * 0.05 + Math.sin(time * 23.7 + seed * 3) * 0.05 + Math.sin(time * 4.3 + seed) * 0.04;
    for (const id of ['kitchen', 'living', 'bed', 'desk']) {
      this.lights[id].intensity = s[id] * this.maxLight[id];
      this.shades[id].emissiveIntensity = s[id] * 1.6;
    }
    this.lights.stove.intensity = s.stove * this.maxLight.stove * flick(1);
    this.mat.stoveGlass.emissiveIntensity = s.stove * 2.2 * flick(2);
    this.lights.fire.intensity = s.fire * this.maxLight.fire * flick(3);
    this.mat.flame.opacity = s.fire * 0.85;
    this.flames.forEach((f, i) => {
      const k = 0.7 + 0.3 * Math.sin(time * (7 + i * 1.3) + i);
      f.scale.set(1, (0.2 + s.fire * 0.8) * k, 1);
      f.position.y = FLOOR + 0.38 + 0.21 * f.scale.y;
    });
    this.shades.porch.emissiveIntensity = s.porch * 2;
    this.mat.screen.emissiveIntensity = s.screen * 0.9;
    this.door.position.x = -1.86 * s.door;
    const sl = s.sleeping;
    this.duvet.scale.y = 1 + sl * 1.6;
    this.duvet.position.y = FLOOR + 0.58 + sl * 0.07;
    this.duvetFold.visible = sl < 0.5;
  }
}
