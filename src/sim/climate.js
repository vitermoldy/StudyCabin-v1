import { Emitter, clamp, damp, lerp } from '../core/emitter.js';
import { load, save } from '../core/store.js';

export const SEASON_ORDER = ['spring', 'summer', 'rainy', 'autumn', 'winter'];

export const SEASONS = {
  summer: {
    label: 'Summer',
    sunrise: 330, sunset: 1185, noonElevation: 68,
    temp: [27, 4],
    grass: '#86934a', sand: '#d2c6ab', sandWet: '#a3977e', foliage: '#6f7d48',
    snow: 0, petals: 0, leaves: 0, warmth: 1,
    odds: { clear: 0.5, cloudy: 0.27, fog: 0.06, rain: 0.11, storm: 0.06 },
    line: 'Long days, warm sand, the sun up before six.',
  },
  autumn: {
    label: 'Autumn',
    sunrise: 405, sunset: 1080, noonElevation: 40,
    temp: [13, 4],
    grass: '#a88b4a', sand: '#cec1a5', sandWet: '#9d927c', foliage: '#9a6a3a',
    snow: 0, petals: 0, leaves: 1, warmth: 0.6,
    odds: { clear: 0.2, cloudy: 0.3, fog: 0.25, rain: 0.2, storm: 0.05 },
    line: 'Gold grass on the dunes, leaves on the wind, fog most mornings.',
  },
  spring: {
    label: 'Spring',
    sunrise: 375, sunset: 1125, noonElevation: 55,
    temp: [18, 4],
    grass: '#6f9442', sand: '#cdc3ad', sandWet: '#9f9683', foliage: '#6c8a4a',
    snow: 0, petals: 1, leaves: 0, warmth: 0.75,
    odds: { clear: 0.35, cloudy: 0.3, fog: 0.15, rain: 0.2 },
    line: 'Blossom in the air, birds at dawn, mild afternoons.',
  },
  rainy: {
    label: 'Rainy season',
    sunrise: 360, sunset: 1110, noonElevation: 60,
    temp: [24, 3],
    grass: '#5d8a3e', sand: '#b8ae99', sandWet: '#8b826f', foliage: '#4f6c3c',
    snow: 0, petals: 0, leaves: 0, warmth: 0.7,
    odds: { cloudy: 0.15, fog: 0.1, rain: 0.5, storm: 0.25 },
    line: 'Warm rain most days, storms in the afternoon, green dunes.',
  },
  winter: {
    label: 'Winter',
    sunrise: 450, sunset: 1005, noonElevation: 26,
    temp: [0, 3],
    grass: '#9e9b88', sand: '#d6d4cd', sandWet: '#a9a7a0', foliage: '#7d7f70',
    snow: 1, petals: 0, leaves: 0, warmth: 0.3,
    odds: { clear: 0.2, cloudy: 0.25, fog: 0.15, snow: 0.4 },
    line: 'Short days, snow on the roof, the stove lit by four.',
  },
};

export const WEATHER_ORDER = ['clear', 'cloudy', 'fog', 'rain', 'storm', 'snow'];

export const WEATHERS = {
  clear: { label: 'Clear', cloud: 0.12, fog: 0.16, rain: 0, snow: 0, wind: 0.25, waves: 0.45, storm: 0, temp: 1 },
  cloudy: { label: 'Cloudy', cloud: 0.72, fog: 0.32, rain: 0, snow: 0, wind: 0.42, waves: 0.55, storm: 0, temp: -1 },
  fog: { label: 'Fog', cloud: 0.55, fog: 1, rain: 0, snow: 0, wind: 0.1, waves: 0.32, storm: 0, temp: -1.5 },
  rain: { label: 'Rain', cloud: 0.92, fog: 0.5, rain: 0.62, snow: 0, wind: 0.5, waves: 0.72, storm: 0, temp: -3 },
  storm: { label: 'Storm', cloud: 1, fog: 0.58, rain: 1, snow: 0, wind: 1, waves: 1, storm: 1, temp: -4 },
  snow: { label: 'Snow', cloud: 0.86, fog: 0.55, rain: 0, snow: 0.85, wind: 0.35, waves: 0.5, storm: 0, temp: -2 },
};

const PARAM_KEYS = ['cloud', 'fog', 'rain', 'snow', 'wind', 'waves', 'storm'];

function pick(odds, random = Math.random) {
  const entries = Object.entries(odds);
  const total = entries.reduce((s, [, p]) => s + p, 0);
  let r = random() * total;
  for (const [id, p] of entries) {
    r -= p;
    if (r <= 0) return id;
  }
  return entries[entries.length - 1][0];
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export class Climate extends Emitter {
  constructor(clock) {
    super();
    this.clock = clock;
    const saved = load('climate', {});
    this.season = saved.season in SEASONS ? saved.season : 'spring';
    this.autoSeason = saved.autoSeason !== false;
    this.weatherMode = saved.weatherMode === 'auto' || saved.weatherMode in WEATHERS ? saved.weatherMode : 'auto';
    this.weather = saved.weather in WEATHERS ? saved.weather : this._roll();
    if (this.weatherMode !== 'auto') this.weather = this.weatherMode;
    this.nextChange = Number.isFinite(saved.nextChange) ? saved.nextChange : this._now() + this._span();

    // Blended values the scene reads every frame.
    this.params = {};
    const target = WEATHERS[this.weather];
    for (const k of PARAM_KEYS) this.params[k] = target[k];
    const s = SEASONS[this.season];
    this.look = {
      grass: hexToRgb(s.grass),
      sand: hexToRgb(s.sand),
      sandWet: hexToRgb(s.sandWet),
      foliage: hexToRgb(s.foliage),
      snow: s.snow,
      petals: s.petals,
      leaves: s.leaves,
      warmth: s.warmth,
    };
    this.lightning = 0; // 0..1 flash level, set by the scene
    clock.on('day', (day) => this._onDay(day));
  }

  _now() {
    return this.clock.day * 1440 + this.clock.minutes;
  }

  _span() {
    return 120 + Math.random() * 260;
  }

  _roll() {
    const odds = { ...SEASONS[this.season].odds };
    // Weather tends to stay: the current one gets extra weight.
    if (this.weather && odds[this.weather]) odds[this.weather] += 0.35;
    return pick(odds);
  }

  _onDay(day) {
    if (!this.autoSeason) return;
    if ((day - 1) % 7 === 0) {
      const i = SEASON_ORDER.indexOf(this.season);
      this.setSeason(SEASON_ORDER[(i + 1) % SEASON_ORDER.length], { fromAuto: true });
    }
  }

  get seasonInfo() {
    return SEASONS[this.season];
  }

  get weatherInfo() {
    return WEATHERS[this.weather];
  }

  setSeason(id, { fromAuto = false } = {}) {
    if (!(id in SEASONS)) return;
    const changed = id !== this.season;
    this.season = id;
    if (!fromAuto) this.emit('season-picked', id);
    if (this.weatherMode === 'auto' && !(this.weather in SEASONS[id].odds)) {
      this._setWeather(this._roll());
      this.nextChange = this._now() + this._span();
    }
    if (changed) this.emit('season', id);
    this.persist();
  }

  setAutoSeason(on) {
    this.autoSeason = !!on;
    this.emit('auto-season', this.autoSeason);
    this.persist();
  }

  setWeatherMode(mode) {
    if (mode !== 'auto' && !(mode in WEATHERS)) return;
    this.weatherMode = mode;
    if (mode === 'auto') {
      this._setWeather(this._roll());
      this.nextChange = this._now() + this._span();
    } else {
      this._setWeather(mode);
    }
    this.emit('weather-mode', mode);
    this.persist();
  }
}
