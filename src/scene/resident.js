import * as THREE from 'three';
import { damp, clamp } from '../core/emitter.js';
import { SPOTS, SHORE_LOOP, route, FLOOR, FURNITURE as F } from '../sim/layout.js';
import { groundHeight } from './terrain.js';

const OUTFIT = {
  summer: '#e4ded2',
  spring: '#9ba78b',
  rainy: '#b8954f',
  autumn: '#a6604a',
  winter: '#4d5154',
};

const SEAT = { sofa: 0.5, armchair: 0.5, dine: 0.52, desk: 0.52, deckChair: 0.46, guitar: 0.52 };

// Joint names; every pose fills these.
const JOINTS = ['hipY', 'spineX', 'spineZ', 'headX', 'headY', 'shLx', 'shLz', 'elL', 'shRx', 'shRz', 'elR', 'thL', 'knL', 'thR', 'knR', 'lie'];

function base(o = {}) {
  return {
    hipY: 0.93, spineX: 0, spineZ: 0, headX: 0, headY: 0,
    shLx: 0.05, shLz: 0.09, elL: -0.18, shRx: 0.05, shRz: -0.09, elR: -0.18,
    thL: 0, knL: 0.02, thR: 0, knR: 0.02, lie: 0, ...o,
  };
}

function sitBase(seat, o = {}) {
  return base({ hipY: seat + 0.02, thL: -1.5, knL: 1.48, thR: -1.45, knR: 1.42, shLx: -0.3, elL: -0.9, shRx: -0.3, elR: -0.9, spineX: 0.04, ...o });
}

/** Pose functions: (t, seat) -> joint targets. t is real seconds. */
const POSES = {
  stand: (t) => base({ spineX: 0.015 * Math.sin(t * 1.4), headY: 0.15 * Math.sin(t * 0.21) }),
  walk: () => base(),
  stretch: (t) => {
    const k = Math.sin(t * 0.7);
    return base({ shLx: -2.85, shLz: 0.25, elL: -0.25, shRx: -2.85, shRz: -0.25, elR: -0.25, spineZ: 0.16 * k, headX: -0.15, spineX: -0.05 });
  },
  cook: (t) => base({
    spineX: 0.12, headX: 0.38,
    shLx: -0.55, shLz: 0.12, elL: -1.05,
    shRx: -0.62 + 0.08 * Math.sin(t * 3.1), shRz: -0.14 + 0.1 * Math.cos(t * 3.1), elR: -0.95 + 0.12 * Math.sin(t * 3.1 + 1),
  }),
  standDrink: (t) => {
    const p = (t % 9) / 9;
    const lift = p > 0.55 && p < 0.8 ? Math.sin(((p - 0.55) / 0.25) * Math.PI) : 0;
    return base({ shRx: -0.45 - 0.75 * lift, shRz: -0.2, elR: -1.55 - 0.65 * lift, headX: 0.05 - 0.25 * lift, shLx: 0.08, elL: -0.2, headY: 0.12 * Math.sin(t * 0.17) });
  },
  reach: (t) => base({ shRx: -2.35 + 0.08 * Math.sin(t * 0.9), shRz: -0.12, elR: -0.3, headX: -0.28, spineX: -0.05 }),
  crouch: (t) => base({ hipY: 0.5, thL: -1.95, knL: 2.35, thR: -1.85, knR: 2.3, spineX: 0.55, headX: 0.15, shLx: -0.9, elL: -0.6, shRx: -1.0 + 0.15 * Math.sin(t * 1.3), elR: -0.5 }),
  sitRead: (t, seat) => sitBase(seat, { spineX: 0.12, headX: 0.42 + 0.03 * Math.sin(t * 0.3), shLx: -0.62, shLz: 0.3, elL: -1.45, shRx: -0.62, shRz: -0.3, elR: -1.45 }),
  sitType: (t, seat) => sitBase(seat, {
    spineX: 0.2, headX: 0.32,
    shLx: -0.62, shLz: 0.14, elL: -0.95 + 0.05 * Math.max(0, Math.sin(t * 13)),
    shRx: -0.62, shRz: -0.14, elR: -0.95 + 0.05 * Math.max(0, Math.sin(t * 11 + 2)),
  }),
  sitWrite: (t, seat) => sitBase(seat, {
    spineX: 0.26, headX: 0.45,
    shLx: -0.52, shLz: 0.22, elL: -1.15,
    shRx: -0.66 + 0.03 * Math.sin(t * 5), shRz: -0.16 + 0.05 * Math.sin(t * 2.3), elR: -1.0,
  }),
  sitDrink: (t, seat) => {
    const p = (t % 8) / 8;
    const lift = p > 0.5 && p < 0.78 ? Math.sin(((p - 0.5) / 0.28) * Math.PI) : 0;
    return sitBase(seat, { spineX: -0.05, shRx: -0.4 - 0.8 * lift, shRz: -0.18, elR: -1.5 - 0.7 * lift, headX: 0.05 - 0.25 * lift, shLx: -0.25, elL: -1.0, headY: 0.18 * Math.sin(t * 0.15) });
  },
  sitEat: (t, seat) => {
    const p = (t % 5) / 5;
    const lift = p > 0.4 && p < 0.7 ? Math.sin(((p - 0.4) / 0.3) * Math.PI) : 0;
    return sitBase(seat, { spineX: 0.16, headX: 0.25, shLx: -0.55, elL: -1.0, shRx: -0.55 - 0.45 * lift, elR: -1.0 - 0.9 * lift });
  },
  sitGuitar: (t, seat) => sitBase(seat, {
    spineX: 0.1, headX: 0.32, headY: 0.32,
    shLx: -0.75, shLz: 0.62, elL: -1.15,
    shRx: -0.45, shRz: -0.3, elR: -1.25 + 0.22 * Math.sin(t * 7.5),
  }),
  sleep: (t) => base({ lie: 1, hipY: 0.62, spineX: 0.012 * Math.sin(t * 1.1), shLx: 0, shLz: 0.12, elL: -0.1, shRx: 0, shRz: -0.12, elR: -0.1, thL: -0.08, knL: 0.15, thR: -0.04, knR: 0.08, headY: 0.25 }),
};

const PROPS_FOR = {
  sitRead: ['book'],
  sitDrink: ['mug'],
  standDrink: ['mug'],
  sitGuitar: ['guitar'],
};

function capsule(r, len, mat) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 12), mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export class Resident {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.mat = {
      skin: new THREE.MeshStandardMaterial({ color: '#c9987a', roughness: 0.7 }),
      hair: new THREE.MeshStandardMaterial({ color: '#33261f', roughness: 0.9 }),
      top: new THREE.MeshStandardMaterial({ color: OUTFIT.spring, roughness: 0.95 }),
      pants: new THREE.MeshStandardMaterial({ color: '#3d4448', roughness: 0.9 }),
      shoe: new THREE.MeshStandardMaterial({ color: '#2a2725', roughness: 0.8 }),
      book: new THREE.MeshStandardMaterial({ color: '#ece6da', roughness: 0.9 }),
      cover: new THREE.MeshStandardMaterial({ color: '#7d4a36', roughness: 0.8 }),
      mug: new THREE.MeshStandardMaterial({ color: '#e7e2d8', roughness: 0.4 }),
      guitar: new THREE.MeshStandardMaterial({ color: '#b07a45', roughness: 0.5 }),
      guitarDark: new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.6 }),
    };
    this._build();
    this.j = POSES.stand(0, 0.5);
    this.pos = new THREE.Vector3(SPOTS.bed.at.x, SPOTS.bed.at.y, SPOTS.bed.at.z);
    this.facing = 0;
    this.path = null;
    this.spot = null;
    this.pose = 'stand';
    this.walkPhase = 0;
    this.speed = 1.25;
    this.loopIndex = 0;
    this.loopPause = 0;
    this.head = new THREE.Vector3();
    this.season = 'spring';
  }

  _build() {
    const m = this.mat;
    const r = this.root;
    this.body = new THREE.Group(); // tilts when lying down
    r.add(this.body);
    this.hips = new THREE.Group();
    this.body.add(this.hips);
    const pelvis = capsule(0.13, 0.12, m.pants);
    pelvis.rotation.z = Math.PI / 2;
    pelvis.position.y = 0.02;
    this.hips.add(pelvis);

    this.spine = new THREE.Group();
    this.spine.position.y = 0.05;
    this.hips.add(this.spine);
    const torso = capsule(0.16, 0.3, m.top);
    torso.position.y = 0.26;
    torso.scale.set(1, 1, 0.78);
    this.spine.add(torso);
    this.chest = new THREE.Group();
    this.chest.position.y = 0.47;
    this.spine.add(this.chest);
    const neck = capsule(0.05, 0.06, m.skin);
    neck.position.y = 0.07;
    this.chest.add(neck);
    this.headG = new THREE.Group();
    this.headG.position.y = 0.13;
    this.chest.add(this.headG);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 20, 14), m.skin);
    head.position.y = 0.1;
    head.scale.set(0.95, 1.08, 1);
    head.castShadow = true;
    this.headG.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.113, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), m.hair);
    hair.position.set(0, 0.115, -0.012);
    hair.rotation.x = -0.25;
    hair.castShadow = true;
    this.headG.add(hair);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), m.hair);
    bun.position.set(0, 0.2, -0.08);
    this.headG.add(bun);

    const arm = (side) => {
      const sh = new THREE.Group();
      sh.position.set(0.2 * side, -0.02, 0);
      this.chest.add(sh);
      const up = capsule(0.052, 0.2, m.top);
      up.position.y = -0.14;
      sh.add(up);
      const el = new THREE.Group();
      el.position.y = -0.29;
      sh.add(el);
      const fore = capsule(0.044, 0.18, m.top);
      fore.position.y = -0.12;
      el.add(fore);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), m.skin);
      hand.position.y = -0.27;
      hand.scale.set(0.85, 1.15, 0.7);
      hand.castShadow = true;
      el.add(hand);
      const grip = new THREE.Group();
      grip.position.y = -0.29;
      el.add(grip);
      return { sh, el, grip };
    };
    this.armL = arm(1);
    this.armR = arm(-1);

    const leg = (side) => {
      const th = new THREE.Group();
      th.position.set(0.095 * side, -0.02, 0);
      this.hips.add(th);
      const thigh = capsule(0.07, 0.3, m.pants);
      thigh.position.y = -0.21;
      th.add(thigh);
      const kn = new THREE.Group();
      kn.position.y = -0.43;
      th.add(kn);
      const shin = capsule(0.056, 0.3, m.pants);
      shin.position.y = -0.2;
      kn.add(shin);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.22), m.shoe);
      foot.position.set(0, -0.44, 0.05);
      foot.castShadow = true;
      kn.add(foot);
      return { th, kn };
    };
    this.legL = leg(1);
    this.legR = leg(-1);

    // Props
    this.props = {};
    const book = new THREE.Group();
    const pageL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.2, 0.012), m.book);
    pageL.position.set(0.072, 0, 0);
    pageL.rotation.y = -0.25;
    const pageR = pageL.clone();
    pageR.position.x = -0.072;
    pageR.rotation.y = 0.25;
    const spineB = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.21, 0.02), m.cover);
    book.add(pageL, pageR, spineB);
    book.position.set(0, 0.0, 0.36);
    book.rotation.x = -0.9;
    this.chest.add(book);
    this.props.book = book;

    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.038, 0.09, 12), m.mug);
    mug.position.set(0, -0.02, 0.04);
    this.armR.grip.add(mug);
    this.props.mug = mug;

    const guitar = new THREE.Group();
    const bodyA = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.09, 20), m.guitar);
    bodyA.rotation.x = Math.PI / 2;
    const bodyB = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.09, 20), m.guitar);
    bodyB.rotation.x = Math.PI / 2;
    bodyB.position.x = 0.22;
    const neckG = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.03), m.guitarDark);
    neckG.position.set(0.58, 0, 0.03);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 16), m.guitarDark);
    hole.position.set(0.12, 0, 0.047);
    guitar.add(bodyA, bodyB, neckG, hole);
    guitar.position.set(-0.05, -0.06, 0.24);
    guitar.rotation.set(0, 0, 0.32);
    guitar.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.spine.add(guitar);
    this.props.guitar = guitar;
    for (const p of Object.values(this.props)) p.visible = false;
  }

  setSeason(id) {
    if (OUTFIT[id]) this.mat.top.color.set(OUTFIT[id]);
    this.season = id;
  }

  /** Go to a spot and take a pose. `teleport` skips the walk (after a time jump). */
  setActivity(activity, { teleport = false } = {}) {
    this.activity = activity;
    const target = activity.spot;
    if (teleport || !this.spot) {
      this._place(target);
      this.pose = activity.pose;
      this.path = null;
      this.j = this._targetJoints(0);
      return;
    }
    if (target === this.spot && !this.path) {
      this.pose = activity.pose;
      return;
    }
    // Stand up and walk from wherever the resident is now.
    const from = { x: this.pos.x, y: this.pos.y, z: this.pos.z };
    const to = SPOTS[target].at;
    const near = Math.hypot(to.x - from.x, to.z - from.z) < 1.7 && Math.abs(to.y - from.y) < 0.1 && !this.path;
    if (near) {
      this.path = [from, { ...to }];
    } else {
      const startSpot = this.path ? null : this.spot;
      this.path = route(startSpot || this._nearestSpot(), target, from);
    }
    this.pathIndex = 1;
    this.spot = target;
    if (this.path.length < 2) {
      this.path = null;
      this.pose = activity.pose;
      return;
    }
    this.pose = 'walk';
  }

  _nearestSpot() {
    let best = 'sofa';
    let bd = Infinity;
    for (const [id, s] of Object.entries(SPOTS)) {
      const d = Math.hypot(s.at.x - this.pos.x, s.at.z - this.pos.z);
      if (d < bd) { bd = d; best = id; }
    }
    return best;
  }

  _place(spotId) {
    const s = SPOTS[spotId];
    this.spot = spotId;
    this.pos.set(s.at.x, s.at.y, s.at.z);
    this.facing = s.face;
    if (spotId === 'beach') this.loopIndex = 0;
  }
}
