// Game state lives on this phone: small things in localStorage,
// photo stamps (which are bigger) in IndexedDB.

const LEGACY_KEY = 'fullboard.v1';
const keyFor = (id) => (id ? `fullboard.v2:${id}` : LEGACY_KEY);

const blank = () => ({
  started: false,
  claimed: {}, // id -> { at: ISO time, bonus: number, past?: true }
  removed: {}, // id -> ms time it was unmarked (so other phones drop it too)
  cash: 0, // bonus money from cards
  setsAwarded: [], // colour sets whose bonus has fired
  nudged: {}, // id -> last nudge time (ms)
  lastNudgeAt: 0,
  cards: [], // { at, title } drawn cards
  activeCard: null, // { target, expires, title }
  alerts: [], // newest first: { at, title, body, kind, id }
  photos: {}, // id -> true when a photo stamp exists
  settings: { wakeLock: false },
});

export function blankState() {
  return blank();
}

export function load(id) {
  try {
    const raw = localStorage.getItem(keyFor(id));
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch (e) {
    return blank();
  }
}

export function save(state, id) {
  try {
    localStorage.setItem(keyFor(id), JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save game', e);
  }
}

export function reset(id) {
  try {
    localStorage.removeItem(keyFor(id));
  } catch (e) {}
  return blank();
}

// A board played before names existed (kept so nobody loses progress).
export function loadLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    return raw ? { ...blank(), ...JSON.parse(raw) } : null;
  } catch (e) {
    return null;
  }
}
export function clearLegacy() {
  try {
    localStorage.removeItem(LEGACY_KEY);
  } catch (e) {}
}

// ---- Photos (IndexedDB) ----
let dbPromise = null;
function db() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open('fullboard', 1);
      req.onupgradeneeded = () => req.result.createObjectStore('photos');
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

export async function savePhoto(id, blob) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction('photos', 'readwrite');
    tx.objectStore('photos').put(blob, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getPhoto(id) {
  const d = await db();
  return new Promise((resolve) => {
    const req = d.transaction('photos').objectStore('photos').get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => resolve(null);
  });
}

export async function clearPhotos() {
  const d = await db();
  return new Promise((resolve) => {
    const tx = d.transaction('photos', 'readwrite');
    tx.objectStore('photos').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
