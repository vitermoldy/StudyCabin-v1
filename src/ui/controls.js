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
