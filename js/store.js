// Game state lives on this phone: small things in localStorage,
// photo stamps (which are bigger) in IndexedDB.

const KEY = 'fullboard.v1';

const blank = () => ({
  started: false,
  claimed: {}, // id -> { at: ISO time, bonus: number }
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

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    return { ...blank(), ...JSON.parse(raw) };
  } catch (e) {
    return blank();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Could not save game', e);
  }
}

export function reset() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
  return blank();
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
