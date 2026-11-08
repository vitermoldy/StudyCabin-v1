# StudyCabin: design direction

Direction comes from the owner's four reference screenshots (a sage-green board cabin with a
standing-seam roof on a misty beach, dunes and marram grass, fog on the mountains behind, a warm lit
interior seen through floor-to-ceiling glass). The words in those screenshots are ignored, at the
owner's request; their look is the direction.

**Design Read.** Reading this as: an ambient study app (software) for people who study or work at a
screen for hours, in a cinematic misty-coast style taken from the owner's screenshots, dial
**ENERGY 3 / RHYTHM 1 / MOTION 3**.

- ENERGY 3: giant type over a full-bleed scene, as in the reference.
- RHYTHM 1: one screen, one scene; every panel uses the same template on purpose, so the scene is
  the only thing that changes.
- MOTION 3: the product is a living place (clock, weather, seasons, a resident). Interface motion
  stays small (hover step, panel fade, a word blurring in when the activity changes).

## The deal (taste-skill 2.5.1)

- Kind: software (page type software, site-kind software). The live scene is the hero and the
  page's one effect; it carries `data-enter="off"` because the scene has its own load motion.
- Palette: the owner's own colours through `start.mjs brand` (mist `#e4e5e1`, ink `#171716`, lamp
  amber `#d9a05b`). The dealt `mint-pink-accounts` was not used: the reference photographs set the
  colours. Amber is the lamp light in the reference interiors, the one warm note in a grey scene.
- Type: Instrument Sans (the dealt third pairing). Urbanist (first) is geometric and Funnel
  (second) has quirky terminals; the reference is a plain neo-grotesk, and Instrument Sans is the
  nearest one in the deal. Self-hosted (fontsource), one variable file, weights 400 to 600.
- Radius: sharp (4 / 6 / 8). The reference bar is an almost square black block.

## Decisions and their reasons (R-31)

| Decision | Reason |
| --- | --- |
| Live WebGL scene (Three.js) instead of photographs | The owner asked for a house where time, weather, seasons and a person change; only a live scene can show that. |
| Giant words: activity top left, "at" on the right, the clock bottom right | The reference's three-word composition, turned into live state: "Coffee at 07:42". |
| Word blurs in letter by letter when the activity changes | The reference shows letters arriving out of blur; here it marks that the resident started something new. |
| Big type switches between light and dark ink | The scene behind it goes from night to bright fog; the page samples the rendered pixels under each word and keeps 3:1 or better. |
| Four thin vertical lines | Taken from the reference; they mark the 4-column grid the words and panels sit on (R-07 purpose). |
| Black dock at the bottom centre | The reference's black "HOME" bar, grown into the app's controls. |
| Small text on dark plates | Text under 24px must hold 4.5:1 over sky, fog and night; a plate guarantees it. |
| Amber accent only on: active state, focus ring, primary button, the playing row | One warm note, like the lamps; never on large areas. |
| Glass blur on the open panel only (R-10) | Keeps the scene readable behind the one open panel; nothing else is frosted. |
| No shadows on UI (R-12) | The scene has real shadows; flat panels keep the two apart. |
| Hand-drawn filled glyphs for transport and tabs (R-04) | Each one names its action (play, pause, next, cloud for weather, timer for focus); real YouTube and YouTube Music marks name where a link comes from. |
| Sentence-case labels, no tracked capitals | taste-skill rule; the reference's tracked caps are dropped, its layout kept. |
| "↳" before "Add music" (R-08) | The reference's own glyph for its one top-right action; used once. |
| Dark ground behind the canvas | The page is a scene that runs through day and night; the ground only shows before the first frame. |
| Lightning is a soft sky brightening, at most one flash every 8 s, off under reduced motion | Storm atmosphere without a flashing hazard. |
| Thick lawn of fine blades, dark at the root, light at the tip, parting round the pointer | The owner's grass reference: one soft field with no sand between blades. |
| Clear water with caustics and a ripple simulation; calm long swells, soft glints | The owner's water references (madebyevan WebGL Water, a glassy calm sea): see-through in the shallows, smooth on the surface. |
| Pines and broadleaf trees behind the cabin, crowns following the season | Asked for by the owner; they frame the cabin against the hills and show the season. |
| Northern lights green to teal with a rose top, galaxy band, two star layers | Asked for by the owner. The reference's violet is left out (taste-skill: never violet); green aurora is the natural colour. |
| Drag, slide and zoom the camera by hand, double-click to reset | Asked for by the owner; the five views stay as starting points. |
