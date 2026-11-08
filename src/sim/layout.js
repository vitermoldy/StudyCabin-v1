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
