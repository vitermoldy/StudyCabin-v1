import './style.css';
import { Clock, SPEED_LABELS } from './core/clock.js';
import { load, save } from './core/store.js';
import { prefersReducedMotion, smoothstep } from './core/emitter.js';
import { Climate, SEASONS } from './sim/climate.js';
import { activityAt, isOutside } from './sim/schedule.js';
import { FocusTimer } from './sim/focus.js';
import { Ambient } from './audio/ambient.js';
import { MusicPlayer } from './music/player.js';
import { Overlay } from './ui/overlay.js';
import { Panels, toast } from './ui/panels.js';
import { mountMusic } from './ui/music-ui.js';
import { mountDay, mountWeather, mountSound, mountFocus, mountView } from './ui/controls.js';
import { mountCameraInput } from './ui/camera-input.js';

const html = document.documentElement;
const reduced = prefersReducedMotion();

// ------------------------------------------------------------ simulation
const clock = new Clock();
const climate = new Climate(clock);
const focus = new FocusTimer();
const ambient = new Ambient();
const music = new MusicPlayer(document.getElementById('yt-host'));
const overlay = new Overlay({ reducedMotion: reduced });
const panels = new Panels();

const prefs = load('view', { view: 'shore', words: true });
let wordsShown = prefs.words !== false;
html.classList.toggle('is-clear', !wordsShown);

// ------------------------------------------------------------ the scene
let world = null;
async function startWorld() {
  const { World, webglAvailable } = await import('./scene/world.js');
  if (!webglAvailable()) throw new Error('no webgl');
  const canvas = document.getElementById('scene');
  const w = new World(canvas, { reducedMotion: reduced });
  w.onShaderFail = () => {
    world = null;
    showStill();
  };
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    showStill();
  });
  return w;
}
