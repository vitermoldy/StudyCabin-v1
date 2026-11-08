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
