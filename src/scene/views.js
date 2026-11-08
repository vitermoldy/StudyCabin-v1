/**
 * Camera views. `width` is how many metres across must fit on screen, so the
 * framing holds on a phone held upright as well as on a wide monitor.
 */
export const VIEWS = {
  shore: { label: 'Shore', pos: [0, 6.2, 36], target: [-0.6, 3.6, -2], width: 36 },
  deck: { label: 'Deck', pos: [0.4, 2.9, 14.5], target: [0, 2.2, 0], width: 19 },
  window: { label: 'Window', pos: [0.5, 1.95, 6.6], target: [0, 1.25, -1.0], width: 7.5 },
  water: { label: 'Water', pos: [5, 6.5, 22], target: [4, 0, 13.5], width: 14 },
  follow: { label: 'Follow', pos: [0, 2.4, 9], target: [0, 1.4, 0], width: 7 },
};
