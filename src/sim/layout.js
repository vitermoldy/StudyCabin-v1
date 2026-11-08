// Shared floor plan, in metres. x runs left to right along the cabin front,
// z points from the back wall out to the sea, y is up. The cabin front glass
// sits at z = 3, the deck runs to z = 6.6, the shore is near z = 11.5.

export const FLOOR = 0.5; // interior floor and deck top
export const CABIN = { x0: -7, x1: 7, z0: -3, z1: 3, wall: 3.05, ridge: 5.35 };
export const DECK = { x0: -10.6, x1: 9.6, z0: 3, z1: 6.6 };
export const DOOR = { x0: -0.95, x1: 0.95 };
export const ANNEX = { x0: -10.4, x1: -7.12, z0: -2.4, z1: 1.9, h: 2.75 };
export const SPINE_Z = 2.3; // free strip inside the glass
export const DECK_Z = 3.75; // free strip on the deck

// Furniture, shared by the cabin builder and the resident's routes.
export const FURNITURE = {
  counter: { x: -5.35, z: -2.72, w: 3.1, d: 0.62 },
  island: { x: -5.4, z: -0.82, w: 1.7, d: 0.78 },
  table: { x: -5.0, z: 1.22, w: 1.5, d: 0.84 },
  shelf: { x: -3.05, z: -2.82, w: 1.05, d: 0.34 },
  sofa: { x: -1.5, z: -1.85, w: 2.1, d: 0.92 },
  coffeeTable: { x: -1.5, z: -0.42, w: 1.1, d: 0.6 },
  armchair: { x: 0.95, z: 0.18, rot: -0.42 },
  stove: { x: 0.65, z: -2.55 },
  bed: { x: 4.6, z: -1.95, w: 1.72, d: 2.12 },
  nightL: { x: 3.42, z: -2.72 },
  nightR: { x: 5.78, z: -2.72 },
  desk: { x: 5.6, z: 2.48, w: 1.45, d: 0.66 },
  deckChair: { x: -4.2, z: 4.95 },
  deckChair2: { x: -2.9, z: 4.95 },
  deckTable: { x: 4.85, z: 5.05 },
  guitarChair: { x: 4.0, z: 4.95 },
  fireBowl: { x: -7.4, z: 5.25 },
};

const f = FURNITURE;
const p = (x, z, y = FLOOR) => ({ x, y, z });

/**
 * Spots the resident uses. `via` leads from the area's hub line to the spot;
 * `face` is the rotation about y once there (0 faces the sea, +z).
 */
export const SPOTS = {
  bed: { area: 'in', via: [p(3.0, SPINE_Z), p(3.0, -1.35)], at: p(3.1, -1.35), face: Math.PI / 2 },
  bedside: { area: 'in', via: [p(3.0, SPINE_Z), p(3.0, -0.9)], at: p(3.05, -0.9), face: 0.15 },
  cook: { area: 'in', via: [p(-3.65, SPINE_Z), p(-3.65, -1.82)], at: p(-5.35, -1.82), face: 0 },
  dine: { area: 'in', via: [p(-3.85, SPINE_Z), p(-3.85, 0.42)], at: p(-5.0, 0.42), face: 0 },
  sofa: { area: 'in', via: [p(-2.85, SPINE_Z), p(-2.85, -1.0), p(-1.55, -1.0)], at: p(-1.55, -1.72), face: 0 },
  armchair: { area: 'in', via: [p(0.95, SPINE_Z), p(1.15, 0.95)], at: p(0.98, 0.22), face: f.armchair.rot },
  desk: { area: 'in', via: [p(4.35, SPINE_Z), p(4.35, 1.28), p(5.6, 1.28)], at: p(5.6, 1.66), face: 0 },
  stove: { area: 'in', via: [p(1.95, SPINE_Z), p(1.95, -1.7)], at: p(0.68, -1.72), face: Math.PI },
  shelf: { area: 'in', via: [p(-2.85, SPINE_Z), p(-2.85, -2.12)], at: p(-3.05, -2.12), face: Math.PI },
  window: { area: 'in', via: [p(-2.3, SPINE_Z)], at: p(-2.3, 2.6), face: 0 },
  deskWindow: { area: 'in', via: [p(3.6, SPINE_Z)], at: p(3.6, 2.6), face: 0 },
  deckChair: { area: 'deck', via: [p(-4.2, DECK_Z), p(-4.2, 4.3)], at: p(-4.2, 4.86), face: 0 },
  guitar: { area: 'deck', via: [p(4.0, DECK_Z), p(4.0, 4.3)], at: p(4.0, 4.86), face: 0 },
  rail: { area: 'deck', via: [p(1.6, DECK_Z), p(1.6, 5.9)], at: p(1.6, 6.15), face: 0 },
  beach: { area: 'beach', via: [p(2.5, 9.0, 0)], at: p(6.5, 10.4, 0), face: 0.2 },
};
