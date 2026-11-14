// Small persistence helper. Every read and write is wrapped: private windows,
// blocked storage or a full quota must never break the app.
const KEY = 'studycabin:v1';

import { mirrorSave } from './cloud.js';

let cache = null;
// Set by replaceAll: a restored save must not be overwritten by this page on its way out.
let frozen = false;

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
  if (frozen) return;
  try {
    const text = JSON.stringify(cache);
    localStorage.setItem(KEY, text);
    mirrorSave(text);
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

export function save(section, value) {
  readAll()[section] = value;
  if (!timer) timer = setTimeout(flush, 250);
}

export function saveNow() {
  if (timer) {
    clearTimeout(timer);
    flush();
  }
}

/** Replaces the whole save with another browser's (a restore by recovery code); reload after. */
export function replaceAll(text) {
  frozen = true;
  clearTimeout(timer);
  timer = 0;
  try {
    localStorage.setItem(KEY, text);
  } catch {
    /* storage unavailable: nothing to restore into */
  }
addEventListener('pagehide', saveNow);
