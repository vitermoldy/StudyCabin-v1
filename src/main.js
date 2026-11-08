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

function showStill() {
  html.classList.remove('is-live');
  document.getElementById('nogl').hidden = false;
}

// ------------------------------------------------------------ state per frame
let activity = activityAt(clock.minutes, conditions(), focus.residentPhase);
let scenePaused = reduced; // under reduced motion the scene waits for a press
let lastFrame = performance.now();
let elapsed = 0;
let sampleIn = 0.3;
let audioIn = 0;
let uiIn = 0;
let jumped = true;

function conditions() {
  const cold = climate.season === 'winter' || climate.temperature() < 9;
  return { badWeather: climate.badWeather, cold };
}

function refreshActivity({ teleport = false } = {}) {
  const next = activityAt(clock.minutes, conditions(), focus.residentPhase);
  if (next.key !== activity.key || teleport) {
    activity = next;
    if (world) world.resident.setActivity(activity, { teleport });
  }
  overlay.setWord(activity.word);
}

function storyText() {
  const s = SEASONS[climate.season].label;
  const line = `${activity.line}. ${climate.describe()}.`;
  const meta = `Day ${clock.day} · ${s} · ${SPEED_LABELS[clock.speed].toLowerCase()}`;
  return { line, meta };
}

function jumpTo(minutes, sameDay) {
  clock.jumpTo(minutes, { sameDay });
}
clock.on('jump', () => {
  jumped = true;
});

// ------------------------------------------------------------ UI
const updateDay = mountDay({ clock, onJump: jumpTo });
const updateWeather = mountWeather({ climate });
mountSound({ ambient });
const renderFocus = mountFocus({ focus });
mountMusic(music, panels, { onPlayingChange: (on) => ambient.setMusicPlaying(on) });

const pauseBtn = document.getElementById('scene-pause');
function setScenePaused(on, { announce = false } = {}) {
  scenePaused = on;
  pauseBtn.setAttribute('aria-pressed', String(on));
  pauseBtn.setAttribute('aria-label', on ? 'Move the scene' : 'Pause the scene');
  pauseBtn.querySelector('use').setAttribute('href', on ? '#i-play' : '#i-pause');
  if (announce) toast(on ? 'Scene paused. The clock stops with it.' : 'Scene moving again.');
  lastFrame = performance.now();
}
pauseBtn.addEventListener('click', () => setScenePaused(!scenePaused, { announce: true }));
setScenePaused(scenePaused);
if (reduced) setTimeout(() => toast('The scene is still because your system asks for less motion. Press play at the top right to start it.', 7000), 1200);

function setWords(on) {
  wordsShown = on;
  html.classList.toggle('is-clear', !on);
  save('view', { ...load('view', {}), words: on });
}

let viewApi = null;
function toggleFullscreen() {
  if (!document.fullscreenEnabled) return;
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  else document.documentElement.requestFullscreen().catch(() => toast('Full screen is not available here.'));
}

focus.on('finished', (phase) => {
  ambient.chime();
  toast(phase === 'focus' ? 'Focus block done. Time for a break.' : 'Break over. Back to the desk.');
  refreshActivity();
});
focus.on('change', () => refreshActivity());
climate.on('season', (id) => {
  if (world) world.resident.setSeason(id);
});
climate.on('season', (id) => {
  if (climate.autoSeason) toast(`${SEASONS[id].label} has come to the cabin.`);
});
climate.on('weather', () => refreshActivity());
