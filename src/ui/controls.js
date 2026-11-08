import { formatClock, formatDuration } from '../core/emitter.js';
import { SPEEDS, SPEED_LABELS } from '../core/clock.js';
import { SEASONS, SEASON_ORDER, WEATHERS, WEATHER_ORDER } from '../sim/climate.js';
import { DAY, entryAt } from '../sim/schedule.js';
import { PRESETS } from '../sim/focus.js';
import { LAYERS } from '../audio/ambient.js';
import { VIEWS } from '../scene/views.js';

const $ = (id) => document.getElementById(id);

/** Builds a row of radio chips inside a fieldset. */
function radios(fieldset, name, options, current, onPick) {
  const row = document.createElement('div');
  row.className = 'choices__row';
  const inputs = new Map();
  for (const [value, label] of options) {
    const lab = document.createElement('label');
    lab.className = 'choice';
    const input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.value = value;
    input.checked = value === current;
    input.addEventListener('change', () => input.checked && onPick(value));
    const span = document.createElement('span');
    span.textContent = label;
    lab.append(input, span);
    row.appendChild(lab);
    inputs.set(value, input);
  }
  fieldset.appendChild(row);
  return (value) => {
    const i = inputs.get(value);
    if (i && !i.checked) i.checked = true;
  };
}

function bindSwitch(button, get, set) {
  const sync = () => button.setAttribute('aria-checked', String(!!get()));
  button.addEventListener('click', () => {
    set(!get());
    sync();
  });
  sync();
  return sync;
}

export function mountDay({ clock, onJump }) {
  const setSpeed = radios($('speed-group'), 'speed', Object.keys(SPEEDS).map((k) => [k, SPEED_LABELS[k]]), clock.speed, (v) => clock.setSpeed(v));
  clock.on('speed', setSpeed);
  const scrub = $('time-scrub');
  const scrubOut = $('time-scrub-out');
  scrub.addEventListener('input', () => {
    const m = Number(scrub.value);
    scrubOut.textContent = formatClock(m);
    onJump(m, true);
  });
  $('sync-clock').addEventListener('click', () => {
    const d = new Date();
    onJump(d.getHours() * 60 + d.getMinutes(), true);
  });

  const list = $('timeline');
  const rows = DAY.filter((a) => a.id !== 'sleep').map((a) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    const t = document.createElement('span');
    t.className = 'timeline__t';
    t.textContent = formatClock(a.start);
    const w = document.createElement('span');
    w.className = 'timeline__what';
    w.textContent = a.line;
    const now = document.createElement('span');
    now.className = 'timeline__now';
    b.append(t, w, now);
    b.setAttribute('aria-label', `Go to ${formatClock(a.start)}: ${a.line}`);
    b.addEventListener('click', () => onJump(a.start, false));
    li.appendChild(b);
    list.appendChild(li);
    return { a, b, now };
  });

  let lastId = '';
  return function update() {
    $('day-clock').textContent = formatClock(clock.minutes);
    $('day-num').textContent = `Day ${clock.day}`;
    if (document.activeElement !== scrub) {
      scrub.value = String(Math.floor(clock.minutes / 5) * 5);
      scrubOut.textContent = formatClock(Number(scrub.value));
    }
    const cur = entryAt(clock.minutes).id === 'sleep' ? 'sleep-early' : entryAt(clock.minutes).id;
    if (cur !== lastId) {
      lastId = cur;
      for (const r of rows) {
        const on = r.a.id === cur;
        r.now.textContent = on ? 'Now' : '';
        if (on) r.b.setAttribute('aria-current', 'true');
        else r.b.removeAttribute('aria-current');
      }
    }
  };
}

export function mountWeather({ climate }) {
  const setSeason = radios($('season-group'), 'season', SEASON_ORDER.map((k) => [k, SEASONS[k].label]), climate.season, (v) => climate.setSeason(v));
  const setWeather = radios(
    $('weather-group'),
    'weather',
    [['auto', 'Follow the season'], ...WEATHER_ORDER.map((k) => [k, WEATHERS[k].label])],
    climate.weatherMode,
    (v) => climate.setWeatherMode(v),
  );
  const syncAuto = bindSwitch($('auto-season'), () => climate.autoSeason, (v) => climate.setAutoSeason(v));
  climate.on('season', setSeason);
  climate.on('weather-mode', setWeather);
  climate.on('auto-season', syncAuto);
  return function update() {
    $('season-line').textContent = SEASONS[climate.season].line;
    const now = `${climate.describe()}${climate.weatherMode === 'auto' ? ', following the season' : ''}`;
    if ($('weather-now').textContent !== now) $('weather-now').textContent = now;
  };
}

export function mountSound({ ambient }) {
  const onBtn = $('amb-on');
  const vol = $('amb-vol');
  const volOut = $('amb-vol-out');
  const err = $('amb-error');
  const mix = $('amb-mix');
  onBtn.addEventListener('click', () => ambient.setEnabled(!ambient.enabled));
  vol.addEventListener('input', () => ambient.setVolume(Number(vol.value) / 100));
  const sliders = LAYERS.map((layer) => {
    const row = document.createElement('div');
    row.className = 'slider-row';
    const id = `mix-${layer.id}`;
    const label = document.createElement('label');
    label.className = 'label';
    label.htmlFor = id;
    label.textContent = layer.label;
    const input = document.createElement('input');
    input.className = 'range';
    input.type = 'range';
    input.id = id;
    input.min = '0';
    input.max = '100';
    input.step = '1';
    const out = document.createElement('output');
    out.className = 'slider-row__value';
    out.htmlFor = id;
    input.addEventListener('input', () => ambient.setMix(layer.id, Number(input.value) / 100));
    row.append(label, input, out);
    mix.appendChild(row);
    return { layer, input, out };
  });
  bindSwitch($('amb-duck'), () => ambient.duckWhenMusic, (v) => ambient.setDuck(v));
  ambient.on('error', (msg) => {
    err.textContent = msg;
    err.hidden = false;
  });
  const render = () => {
    onBtn.setAttribute('aria-checked', String(ambient.enabled));
    vol.value = String(Math.round(ambient.volume * 100));
    volOut.textContent = `${vol.value}%`;
    for (const s of sliders) {
      s.input.value = String(Math.round(ambient.mix[s.layer.id] * 100));
      s.out.textContent = `${s.input.value}%`;
      s.input.disabled = !ambient.enabled;
    }
    vol.disabled = !ambient.enabled;
  };
  ambient.on('change', render);
  render();
}

export function mountFocus({ focus }) {
  const startBtn = $('focus-start');
  const setPreset = radios($('focus-group'), 'focus-length', Object.entries(PRESETS).map(([k, p]) => [k, p.label]), focus.preset, (v) => focus.setPreset(v));
  const heroBtn = $('hero-focus');
  startBtn.addEventListener('click', () => focus.toggle());
  heroBtn.addEventListener('click', () => focus.toggle());
  $('focus-skip').addEventListener('click', () => focus.skip());
  $('focus-reset').addEventListener('click', () => focus.reset());
  const dockLabel = $('dock-focus-label');
  const baseTitle = document.title;
}
