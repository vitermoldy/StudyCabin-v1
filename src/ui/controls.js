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
