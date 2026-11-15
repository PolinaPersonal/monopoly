// Cloud save: each player's board lives in Firestore at boards/<name-id>,
// so it survives refreshes, new phones and app updates. Several phones can
// open the same name and they stay in sync.

import { FIREBASE_CONFIG } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
let api = null;
let db = null;

async function ready() {
  if (db) return true;
  if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.projectId) return false;
  try {
    const [{ initializeApp }, fs] = await Promise.all([import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-firestore.js`)]);
    api = fs;
    db = fs.getFirestore(initializeApp(FIREBASE_CONFIG));
    return true;
  } catch (e) {
    console.warn('Cloud save unavailable', e);
    return false;
  }
}

export function playerId(name) {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export async function loadBoard(id) {
  if (!(await ready())) throw new Error('offline');
  const snap = await api.getDoc(api.doc(db, 'boards', id));
  return snap.exists() ? snap.data() : null;
}

let pending = null;
let timer = null;
export function saveBoard(id, data) {
  pending = { id, data };
  clearTimeout(timer);
  timer = setTimeout(flush, 700);
}

export async function flush() {
  if (!pending) return true;
  const { id, data } = pending;
  if (!(await ready())) return false;
  try {
    await api.setDoc(api.doc(db, 'boards', id), data);
    if (pending && pending.data === data) pending = null;
    return true;
  } catch (e) {
    console.warn('Save failed, will retry', e);
    clearTimeout(timer);
    timer = setTimeout(flush, 5000);
    return false;
  }
}

// Calls onChange(data) whenever another phone changes this board.
export async function watchBoard(id, onChange) {
  if (!(await ready())) return () => {};
  return api.onSnapshot(api.doc(db, 'boards', id), (snap) => {
    if (snap.exists() && !snap.metadata.hasPendingWrites) onChange(snap.data());
  });
}

window.addEventListener('online', () => flush());

// ---- Photo stamps ----
// Stored as compressed JPEG text in photos/<board>__<square> (kept under
// Firestore's 1 MB document limit), so they can be downloaded from any phone.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export async function uploadPhoto(boardId, square, blob) {
  if (!(await ready())) return false;
  try {
    const data = await blobToBase64(blob);
    await api.setDoc(api.doc(db, 'photos', `${boardId}__${square}`), { board: boardId, square, data, at: Date.now() });
    return true;
  } catch (e) {
    console.warn('Photo upload failed', e);
    return false;
  }
}

export async function downloadPhoto(boardId, square) {
  if (!(await ready())) return null;
  try {
    const snap = await api.getDoc(api.doc(db, 'photos', `${boardId}__${square}`));
    if (!snap.exists()) return null;
    const bin = atob(snap.data().data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: 'image/jpeg' });
  } catch (e) {
    return null;
  }
}
