// Small persistence helper. Every read and write is wrapped: private windows,
// blocked storage or a full quota must never break the app.
const KEY = 'studycabin:v1';

let cache = null;

function readAll() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? JSON.parse(raw) : {};
    if (!cache || typeof cache !== 'object') cache = {};
  } catch {
    cache = {};
  }
  return cache;
}

let timer = 0;
function flush() {
  timer = 0;
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    /* storage unavailable: settings live for this visit only */
  }
}

export function load(section, fallback) {
  const all = readAll();
  const value = all[section];
  if (value === undefined || value === null) return fallback;
  if (fallback && typeof fallback === 'object' && !Array.isArray(fallback)) {
    return { ...fallback, ...value };
  }
  return value;
}
