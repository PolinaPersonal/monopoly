import { SQUARES, OWNABLE, BY_ID, COLORS, LIGHT_GROUPS, GROUP_NAMES, COLOUR_SETS, CARDS } from './data.js';
import { distanceTo, anchorOf, formatDistance, haversine } from './geo.js';
import * as store from './store.js';
import { createBoard } from './board.js';

// ---------- Tunables ----------
const NUDGE_RADIUS = 1000; // metres
const NUDGE_GAP = 10 * 60 * 1000; // at most one nudge every 10 minutes
const NUDGE_REPEAT = 3 * 60 * 60 * 1000; // same place again only after 3 hours
const CARD_MAX_PER_DAY = 2;
const CARD_GAP = 45 * 60 * 1000;
const CARD_CHANCE_PER_MIN = 0.05; // once eligible, ~5% chance each minute
const CARD_BONUS = 50;
const CARD_WINDOW = 60 * 60 * 1000;
const MAX_ACCURACY = 150; // ignore GPS fixes worse than this for claims

// ---------- State ----------
let state = store.load();
const params = new URLSearchParams(location.search);
let testMode = params.has('test') || localStorage.getItem('fullboard.test') === '1';
let lastPos = null; // { lat, lng, acc, at }
let watchId = null;
let lastCardRoll = 0;
let wakeLock = null;
let alertsSeen = state.alerts.length;

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const persist = () => store.save(state);
const fmtMoney = (n) => `£${n.toLocaleString('en-GB')}`;

// ---------- Derived numbers ----------
function claimedCount() {
  return Object.keys(state.claimed).length;
}
function groupMembers(g) {
  return OWNABLE.filter((s) => s.group === g);
}
function isSetComplete(g) {
  return groupMembers(g).every((s) => state.claimed[s.id]);
}
function completeSets() {
  return COLOUR_SETS.filter(isSetComplete);
}
function portfolioValue() {
  const props = Object.keys(state.claimed).reduce((sum, id) => sum + (BY_ID[id].price || 0), 0);
  const bonus = Object.values(state.claimed).reduce((sum, c) => sum + (c.bonus || 0), 0);
  return props + bonus + (state.cash || 0);
}
function claimOrder(id) {
  const ids = Object.entries(state.claimed).sort((a, b) => a[1].at.localeCompare(b[1].at)).map((e) => e[0]);
  return ids.indexOf(id) + 1;
}
function bonusCount() {
  const cardBonuses = Object.values(state.claimed).filter((c) => c.bonus).length;
  return completeSets().length + cardBonuses + (state.cards || []).filter((c) => c.cash).length;
}

// ---------- Rendering ----------
const board = createBoard($('#board-host'), { onSquareTap: (id) => openDeed(id) });

function render() {
  board.update(state.claimed);
  document.querySelector('[data-stat="props"]').textContent = claimedCount();
  document.querySelector('[data-stat="sets"]').textContent = completeSets().length;
  document.querySelector('[data-stat="value"]').textContent = fmtMoney(portfolioValue());
  renderNearby();
  renderDeeds();
  renderAlertsBadge();
  const view = currentView();
  if (view === 'album') renderAlbum();
  if (view === 'alerts') renderAlerts();
}

function nearestUnclaimed(pos) {
  if (!pos) return null;
  let best = null;
  for (const s of OWNABLE) {
    if (state.claimed[s.id]) continue;
    const d = distanceTo(s, [pos.lat, pos.lng]);
    if (!best || d < best.d) best = { s, d };
  }
  return best;
}

function mapsLink(s) {
  const [lat, lng] = anchorOf(s);
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

function miniDeed(color) {
  return `<span class="mini-deed" aria-hidden="true"><span style="background:${color}"></span><span></span><span></span></span>`;
}

function renderNearby() {
  const host = $('#nearby');
  if (!lastPos) {
    host.innerHTML = `<div class="nearby"><span class="nearby-text"><span class="nearby-eyebrow">WAITING FOR LOCATION</span><span class="nearby-sub">Keep the app open while you walk. Properties claim themselves when you arrive.</span></span></div>`;
    return;
  }
  const n = nearestUnclaimed(lastPos);
  if (!n) {
    host.innerHTML = `<div class="nearby"><span class="nearby-text"><span class="nearby-eyebrow">BOARD COMPLETE</span><span class="nearby-title">You own all of London.</span></span></div>`;
    return;
  }
  if (n.d > NUDGE_RADIUS) {
    host.innerHTML = `<div class="nearby"><span class="nearby-text"><span class="nearby-eyebrow">NOTHING UNCLAIMED WITHIN 1 KM</span><span class="nearby-sub">Keep exploring. We’ll tell you when you’re close to one.</span></span></div>`;
    return;
  }
  const s = n.s;
  const setNote = s.kind === 'property' ? setProgressNote(s) : s.kind === 'station' ? 'A station: £200' : 'A utility';
  host.innerHTML = `<div class="nearby">
      ${miniDeed(COLORS[s.group])}
      <button type="button" class="nearby-text" data-open="${s.id}" style="border:0;background:none;padding:0;text-align:left;cursor:pointer">
        <span class="nearby-eyebrow">WITHIN 1 KM · NOT YET YOURS</span>
        <span class="nearby-title">${esc(s.name)} <span>· ${formatDistance(n.d)}</span></span>
        <span class="nearby-sub">${esc(setNote)}</span>
      </button>
      <a class="nearby-go" href="${mapsLink(s)}" target="_blank" rel="noopener">Walk there</a>
    </div>`;
}

function setProgressNote(s) {
  const members = groupMembers(s.group);
  const have = members.filter((m) => state.claimed[m.id]).length;
  if (have === members.length - 1) return `Claim it to complete the ${GROUP_NAMES[s.group].toLowerCase()} set`;
  return `${GROUP_NAMES[s.group]} set · ${have} of ${members.length} owned`;
}

function renderDeeds() {
  const host = $('#view-deeds');
  const bar = [];
  const tiles = ['brown', 'lblue', 'pink', 'orange', 'red', 'yellow', 'green', 'dblue', 'station', 'utility'].map((g) => {
    const members = groupMembers(g);
    const have = members.filter((m) => state.claimed[m.id]).length;
    const full = have === members.length;
    const color = COLORS[g];
    const n = members.length;
    const step = n === 4 ? 26 : n === 3 ? 32 : 38;
    members.forEach((m) => bar.push(state.claimed[m.id] ? color : '#DCD4C2'));
    const ink = full ? (LIGHT_GROUPS.has(g) ? '#1B1B1B' : '#FFFFFF') : '#1B1B1B';
    const cards = members
      .map((m, i) => {
        const own = !!state.claimed[m.id];
        const rot = (i - (n - 1) / 2) * 7;
        const band = own ? `background:${color};color:${LIGHT_GROUPS.has(g) ? '#1B1B1B' : '#FFFFFF'}` : '';
        return `<div class="fan-card ${own ? 'own' : ''}" style="left:${i * step}px;transform:rotate(${rot}deg)"><div class="fb" style="${band}">${own ? '✓' : '?'}</div><div class="fl"></div><div class="fl"></div><div class="fl"></div></div>`;
      })
      .join('');
    return `<button type="button" class="set-tile" data-group="${g}" style="background:${full ? color : '#FFFFFF'};color:${ink}" aria-label="${GROUP_NAMES[g]}: ${have} of ${n} owned">
        <div class="set-fan" aria-hidden="true">${cards}${full ? '<span class="set-stamp">FULL SET</span>' : ''}</div>
        <div class="set-foot"><b>${GROUP_NAMES[g]}</b><span>${have} / ${n}</span></div>
      </button>`;
  });
  const stations = groupMembers('station').filter((m) => state.claimed[m.id]).length;
  host.innerHTML = `
    <div class="deeds-head">
      <span class="eyebrow">THE CREW’S DEEDS</span>
      <div class="deeds-row">
        <h1 class="deeds-count"><b>${claimedCount()}</b><i>of 28 deeds</i></h1>
        <span class="deeds-value"><b>${fmtMoney(portfolioValue())}</b><span>Portfolio</span></span>
      </div>
      <div class="deeds-bar" role="img" aria-label="${claimedCount()} of 28 properties owned">${bar.map((c) => `<span style="background:${c}"></span>`).join('')}</div>
      <div class="deeds-meta"><span>${completeSets().length} / 8 full sets</span><span>·</span><span>${bonusCount()} bonuses</span><span>·</span><span>${stations} / 4 stations</span></div>
    </div>
    <div class="deeds-grid">${tiles.join('')}</div>`;
}

let albumUrls = [];
async function renderAlbum() {
  const host = $('#view-album');
  albumUrls.forEach((u) => URL.revokeObjectURL(u));
  albumUrls = [];
  const ids = Object.entries(state.claimed).sort((a, b) => b[1].at.localeCompare(a[1].at)).map((e) => e[0]);
  if (!ids.length) {
    host.innerHTML = `<div class="page-head"><span class="eyebrow">THE ALBUM</span><h1>Photo stamps</h1></div>
      <div class="empty-state"><b>No deeds yet</b>Every property you claim lands here. Add a crew selfie to stamp it.</div>`;
    return;
  }
  const items = await Promise.all(
    ids.map(async (id) => {
      const s = BY_ID[id];
      const blob = await store.getPhoto(id);
      let media;
      if (blob) {
        const url = URL.createObjectURL(blob);
        albumUrls.push(url);
        media = `<img src="${url}" alt="Photo stamp for ${esc(s.name)}">`;
      } else {
        media = `<div class="album-empty"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#8C8577" stroke-width="1.8" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>Add a photo</div>`;
      }
      return `<button type="button" class="album-item" data-photo="${id}">
          <div class="album-band" style="background:${COLORS[s.group]}"></div>${media}
          <span class="album-name">${esc(s.name.toUpperCase())}</span></button>`;
    })
  );
  host.innerHTML = `<div class="page-head"><span class="eyebrow">THE ALBUM</span><h1>Photo stamps</h1><p>${ids.length} ${ids.length === 1 ? 'deed' : 'deeds'} · tap one to add or share a photo</p></div>
    <div class="album-grid">${items.join('')}</div>`;
}

function timeAgo(iso) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function appMark() {
  const c = ['#E2231A', '#FCE300', '#1FA34A', '#D6338A', '#F4EFE3', '#1B4FA0', '#F28C28', '#9FD3EF', '#8B4A2B'];
  return `<span class="app-mark" aria-hidden="true">${c.map((x) => `<span style="background:${x}"></span>`).join('')}</span>`;
}

function renderAlerts() {
  const host = $('#view-alerts');
  alertsSeen = state.alerts.length;
  renderAlertsBadge();
  if (!state.alerts.length) {
    host.innerHTML = `<div class="page-head"><span class="eyebrow">ALERTS</span><h1>From the Bank</h1></div>
      <div class="empty-state"><b>All quiet</b>Claims, nearby properties and the odd Chance card will show up here.</div>`;
    return;
  }
  host.innerHTML = `<div class="page-head"><span class="eyebrow">ALERTS</span><h1>From the Bank</h1></div>
    <ul class="alert-list">${state.alerts
      .map(
        (a) => `<li><button type="button" class="alert" ${a.id ? `data-open="${a.id}"` : ''}>${appMark()}
          <span class="alert-text"><span class="alert-time">${timeAgo(a.at)}</span><span class="alert-title">${esc(a.title)}</span><span class="alert-body">${esc(a.body)}</span></span></button></li>`
      )
      .join('')}</ul>`;
}

function renderAlertsBadge() {
  const badge = $('[data-role="badge"]');
  const unseen = state.alerts.length - alertsSeen;
  badge.hidden = unseen <= 0 || currentView() === 'alerts';
  badge.textContent = unseen;
}

// ---------- Tabs ----------
function currentView() {
  return document.querySelector('.tabs [aria-current="page"]').dataset.tab;
}
function showView(name) {
  document.querySelectorAll('.tabs button').forEach((b) => {
    if (b.dataset.tab === name) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.dataset.view !== name));
  $('main').scrollTop = 0;
  if (name === 'board') board.measure();
  if (name === 'album') renderAlbum();
  if (name === 'alerts') renderAlerts();
  renderAlertsBadge();
}
$('.tabs').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-tab]');
  if (b) showView(b.dataset.tab);
});

// ---------- Overlays ----------
const overlay = $('#overlay');
const queue = [];
let overlayOpen = false;

function showOverlay(html, cls = '', onMount) {
  overlay.className = `overlay ${cls}`;
  overlay.style.background = '';
  overlay.innerHTML = html;
  overlay.hidden = false;
  overlay.scrollTop = 0;
  overlayOpen = true;
  document.body.style.overflow = 'hidden';
  if (onMount) onMount(overlay);
  const focusable = overlay.querySelector('button, a');
  if (focusable) focusable.focus({ preventScroll: true });
}
function closeOverlay() {
  overlay.hidden = true;
  overlay.innerHTML = '';
  overlayOpen = false;
  document.body.style.overflow = '';
  if (queue.length) setTimeout(() => queue.shift()(), 150);
}
function enqueue(fn) {
  if (overlayOpen) queue.push(fn);
  else fn();
}
overlay.addEventListener('click', (e) => {
  if (e.target.closest('[data-close]')) closeOverlay();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && overlayOpen) closeOverlay();
});

const CLOSE_BTN = `<button type="button" class="sheet-close" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;

function stampDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
}

function deedHTML(s) {
  const claim = state.claimed[s.id];
  const color = COLORS[s.group];
  const headInk = LIGHT_GROUPS.has(s.group) ? '#1B1B1B' : '#FFFFFF';
  let body;
  if (s.kind === 'property') {
    const [r, h1, h2, h3, h4, hotel] = s.rents;
    body = `<div class="deed-rent">RENT £${r}</div>
      <div class="deed-row"><span>With 1 house</span><b>${fmtMoney(h1)}</b></div>
      <div class="deed-row"><span>With 2 houses</span><b>${fmtMoney(h2)}</b></div>
      <div class="deed-row"><span>With 3 houses</span><b>${fmtMoney(h3)}</b></div>
      <div class="deed-row"><span>With 4 houses</span><b>${fmtMoney(h4)}</b></div>
      <div class="deed-row"><span>With hotel</span><b>${fmtMoney(hotel)}</b></div>
      <div class="deed-foot"><span>Houses cost £${s.houseCost} each</span><span>Mortgage £${s.mortgage}</span></div>`;
  } else if (s.kind === 'station') {
    body = `<div class="deed-row"><span>Rent</span><b>£25</b></div>
      <div class="deed-row"><span>If 2 stations are owned</span><b>£50</b></div>
      <div class="deed-row"><span>If 3 stations are owned</span><b>£100</b></div>
      <div class="deed-row"><span>If 4 stations are owned</span><b>£200</b></div>
      <div class="deed-foot"><span>Price £200</span><span>Mortgage £100</span></div>`;
  } else {
    body = `<p style="margin:0;font-size:12.5px;line-height:1.45">If one utility is owned, rent is 4 times the amount shown on the dice. If both are owned, rent is 10 times the amount shown.</p>
      <div class="deed-foot"><span>Price £150</span><span>Mortgage £75</span></div>
      <p style="margin:0;font-size:11px;color:#5C574D">Stand-in: ${esc(s.stand)}</p>`;
  }
  const head =
    s.kind === 'property'
      ? `<div class="deed-head" style="background:${color};color:${headInk}"><small>TITLE DEED</small><strong>${esc(s.name)}</strong></div>`
      : `<div class="deed-head"><small>TITLE DEED</small><strong>${esc(s.name)}</strong></div>`;
  const stamp = claim
    ? `<div class="stamp" aria-hidden="true"><b>OWNED</b><span>${claim.past ? 'BEEN HERE BEFORE' : `THE CREW · ${stampDate(claim.at)}`}</span></div>`
    : '';
  return `<div class="deed${claim ? ' owned' : ''}">${head}<div class="deed-body">${body}</div>${stamp}</div>`;
}

function factHTML(s) {
  return `<section class="fact"><small>WHY IS IT ON THE BOARD?</small><p>${esc(s.fact)}</p></section>`;
}

function openDeed(id, fresh = false) {
  const s = BY_ID[id];
  if (!s || !s.fact) return;
  const claim = state.claimed[id];
  let intro = '';
  if (fresh) {
    intro = `<div><h1 class="serif">Congratulations!</h1><p class="lede">The Bank hereby transfers <strong>${esc(s.name)}</strong> to the crew.${claim.bonus ? ` Chance bonus: <strong>£${claim.bonus}</strong>.` : ''}</p></div>`;
  }
  let status = '';
  if (!claim) {
    const d = lastPos ? distanceTo(s, [lastPos.lat, lastPos.lng]) : null;
    status = `<p class="status-line">Not ticked off yet${d !== null && d <= NUDGE_RADIUS ? ` · ${formatDistance(d)} away` : ''}. Walk there, or tick it below if you’ve already been.</p>`;
  }
  const actions = claim
    ? `<button type="button" class="btn btn-dark" data-act="photo">${CAMERA_ICON} ${fresh ? 'Stamp it with a crew photo' : 'Photo stamp'}</button>
       ${claim.past ? '<button type="button" class="btn-link" data-act="unmark">Unmark: we haven’t been here</button>' : ''}
       <button type="button" class="btn-link" data-close>${fresh ? 'Back to the board' : 'Close'}</button>`
    : `<button type="button" class="btn btn-dark" data-act="mark"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg> We’ve been here</button>
       <button type="button" class="btn-link" data-close>Close</button>`;
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow">${fresh ? 'PROPERTY ACQUIRED' : claim ? 'OWNED BY THE CREW' : 'TITLE DEED'}</span>${CLOSE_BTN}</div>
      ${intro}${deedHTML(s)}${status}${factHTML(s)}
      <div class="actions">${actions}</div>
    </div>`,
    '',
    (el) => {
      const p = el.querySelector('[data-act="photo"]');
      if (p) p.addEventListener('click', () => openPhoto(id));
      const m = el.querySelector('[data-act="mark"]');
      if (m)
        m.addEventListener('click', () => {
          markPast(id);
          closeOverlay();
          openDeed(id);
          toast(`${s.name} ticked off`, 'It’s on the board now.');
        });
      const u = el.querySelector('[data-act="unmark"]');
      if (u)
        u.addEventListener('click', () => {
          unmarkPast(id);
          closeOverlay();
        });
    }
  );
}

// ---------- Places visited before the game ----------
// These count towards the board and the counters, but skip the
// celebration screens (you weren't standing there when you ticked them).
function markPast(id) {
  const s = BY_ID[id];
  if (!s || state.claimed[id]) return;
  state.claimed[id] = { at: new Date().toISOString(), bonus: 0, past: true };
  if (s.kind === 'property' && isSetComplete(s.group) && !state.setsAwarded.includes(s.group)) state.setsAwarded.push(s.group);
  persist();
  render();
}

function unmarkPast(id) {
  const c = state.claimed[id];
  if (!c || !c.past) return;
  delete state.claimed[id];
  const s = BY_ID[id];
  if (s && s.group) state.setsAwarded = state.setsAwarded.filter((g) => g !== s.group || isSetComplete(g));
  persist();
  render();
}

function openPastPicker() {
  const groups = ['brown', 'lblue', 'pink', 'orange', 'red', 'yellow', 'green', 'dblue', 'station', 'utility'];
  const rows = groups
    .map((g) => {
      const items = groupMembers(g)
        .map((m) => {
          const c = state.claimed[m.id];
          const locked = c && !c.past;
          return `<label class="past-row">
            <input type="checkbox" data-past="${m.id}" ${c ? 'checked' : ''} ${locked ? 'disabled' : ''}>
            <span class="past-swatch" style="background:${COLORS[g]}"></span>
            <span>${esc(m.name)}${locked ? '<small>Claimed on foot</small>' : ''}</span></label>`;
        })
        .join('');
      return `<fieldset class="past-group"><legend>${esc(GROUP_NAMES[g])}</legend>${items}</fieldset>`;
    })
    .join('');
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow">ALREADY BEEN?</span>${CLOSE_BTN}</div>
      <h1 class="serif">Places we’ve been</h1>
      <p class="lede">Tick anywhere the crew has already visited. They go straight onto the board and count towards your sets.</p>
      ${rows}
      <div class="actions"><button type="button" class="btn btn-dark" data-close>Done</button></div>
    </div>`,
    '',
    (el) =>
      el.querySelectorAll('[data-past]').forEach((cb) =>
        cb.addEventListener('change', () => (cb.checked ? markPast(cb.dataset.past) : unmarkPast(cb.dataset.past)))
      )
  );
}

// A shareable link can pre-mark places: ?visited=angel-islington,kings-cross
function applyVisitedParam() {
  const v = params.get('visited');
  if (!v) return 0;
  const ids = v.split(',').map((x) => x.trim()).filter((id) => BY_ID[id] && BY_ID[id].fact);
  ids.forEach(markPast);
  params.delete('visited');
  const q = params.toString();
  history.replaceState(null, '', location.pathname + (q ? `?${q}` : ''));
  return ids.length;
}

const CAMERA_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`;

function openSetBonus(g) {
  const members = groupMembers(g);
  const color = COLORS[g];
  const dark = LIGHT_GROUPS.has(g);
  const n = members.length;
  const positions = n === 2 ? [[40, 10, -8], [150, 10, 8]] : [[0, 20, -10], [100, 0, 0], [200, 20, 10]];
  const cards = members
    .map((m, i) => {
      const [l, t, r] = positions[i];
      return `<div class="deed-mini" style="left:${l}px;top:${t}px;transform:rotate(${r}deg)">
        <div class="dm-head" style="background:${color};color:${dark ? '#1B1B1B' : '#FFFFFF'}"><small>TITLE DEED</small><strong>${esc(m.name)}</strong></div>
        <span class="dm-rent">RENT £${m.rents[0]}</span><span class="dm-stamp">OWNED</span></div>`;
    })
    .join('');
  const names = members.map((m) => m.name);
  const list = names.length === 2 ? `${names[0]} and ${names[1]}` : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  const ink = dark ? '#1B1B1B' : '#FFFFFF';
  showOverlay(
    `<div class="sheet" style="color:${ink}">
      <div class="sheet-top"><span class="eyebrow" style="color:${ink}">COLOUR SET BONUS</span>${CLOSE_BTN}</div>
      <div style="display:flex;flex-direction:column;gap:6px;margin-top:8px"><span class="kicker">You’ve cornered the market.</span><h1>FULL<br>SET!</h1></div>
      <div class="fan" aria-hidden="true">${cards}</div>
      <p class="lede" style="color:${ink}">The crew now holds <strong>${esc(list)}</strong>. By order of the Bank, rent on all ${esc(GROUP_NAMES[g].toLowerCase())} properties is doubled.</p>
      <div class="bonus-tiles"><div><b>${completeSets().length} / 8</b><span>Colour sets complete</span></div><div><b>×2 rent</b><span>Bonus unlocked</span></div></div>
      <button type="button" class="btn btn-light" data-close>See it on the board</button>
    </div>`,
    'bonus',
    (el) => (el.style.background = g === 'red' ? '#C41C14' : color)
  );
}

function openCard(card) {
  const color = card.deck === 'Chance' ? '#F28C28' : '#9FD3EF';
  const target = card.target ? BY_ID[card.target] : null;
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow" style="color:${color}">YOU’VE DRAWN A CARD</span>${CLOSE_BTN.replace('sheet-close', 'sheet-close" style="color:#F4EFE3')}</div>
      <div class="big-card" style="background:${color}">
        <div class="big-card-top"><b>${card.deck.toUpperCase()}</b><span aria-hidden="true">${card.deck === 'Chance' ? '?' : '✦'}</span></div>
        <hr>
        <h2>${esc(card.title)}</h2>
        <p>${esc(card.body)}</p>
      </div>
      <p class="note">Card ${card.n} of ${CARD_MAX_PER_DAY} today${target ? ' · Chance only sends you somewhere within 1 km' : ''}</p>
      <div class="actions">
        ${target ? `<a class="btn btn-light" href="${mapsLink(target)}" target="_blank" rel="noopener">Walk me there</a>` : ''}
        <button type="button" class="btn-link" data-close>${target ? 'Keep it for later' : 'Lovely'}</button>
      </div>
    </div>`,
    'card-ov'
  );
}

function openGroup(g) {
  const members = groupMembers(g);
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow">${esc(GROUP_NAMES[g].toUpperCase())}</span>${CLOSE_BTN}</div>
      <div class="group-list">${members
        .map((m) => {
          const c = state.claimed[m.id];
          return `<button type="button" class="group-row" data-open="${m.id}">${miniDeed(COLORS[g])}<span>${esc(m.name)}<small>${c ? `Owned since ${stampDate(c.at).toLowerCase()}` : 'Not yet yours'}</small></span></button>`;
        })
        .join('')}</div>
    </div>`
  );
}

// ---------- Photo stamps ----------
const photoInput = $('#photo-input');
let photoTarget = null;

function openPhoto(id) {
  photoTarget = id;
  // Decide synchronously: phones only open the camera from a direct tap.
  if (!state.photos[id]) {
    photoInput.value = '';
    photoInput.click();
    return;
  }
  store.getPhoto(id).then((blob) => {
    if (blob) showPhotoSheet(id, blob);
    else {
      delete state.photos[id];
      persist();
      toast('Photo missing', 'Tap again to take a new one.');
    }
  });
}

function showPhotoSheet(id, blob) {
  const s = BY_ID[id];
  const url = URL.createObjectURL(blob);
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow">PHOTO STAMP</span>${CLOSE_BTN}</div>
      <div class="photo-frame"><img src="${url}" alt="Photo stamp for ${esc(s.name)}"></div>
      <div class="photo-actions">
        <button type="button" class="btn btn-light" data-act="retake">Retake</button>
        <button type="button" class="btn btn-dark" data-act="share">Share</button>
        <button type="button" class="btn btn-light" data-act="save">Save</button>
      </div>
    </div>`,
    '',
    (el) => {
      el.querySelector('[data-act="retake"]').addEventListener('click', () => {
        photoTarget = id;
        photoInput.value = '';
        photoInput.click();
      });
      el.querySelector('[data-act="share"]').addEventListener('click', () => sharePhoto(s, blob));
      el.querySelector('[data-act="save"]').addEventListener('click', () => downloadBlob(s, blob));
    }
  );
}

async function sharePhoto(s, blob) {
  const file = new File([blob], `${s.id}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `We own ${s.name}!`, text: `The crew now owns ${s.name}. ${claimedCount()} of 28 properties down.` });
    } catch (e) {}
  } else {
    downloadBlob(s, blob);
  }
}

function downloadBlob(s, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `london-monopoly-${s.id}.jpg`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

photoInput.addEventListener('change', async () => {
  const file = photoInput.files && photoInput.files[0];
  if (!file || !photoTarget) return;
  const id = photoTarget;
  try {
    const blob = await composeStamp(BY_ID[id], file);
    await store.savePhoto(id, blob);
    state.photos[id] = true;
    persist();
    if (currentView() === 'album') renderAlbum();
    showPhotoSheet(id, blob);
  } catch (e) {
    toast('Couldn’t read that photo', 'Try another one, or take a new picture.');
  }
});

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

async function composeStamp(s, file) {
  await document.fonts.ready;
  const img = await loadImage(file);
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const color = COLORS[s.group];
  const headInk = s.kind === 'property' ? (LIGHT_GROUPS.has(s.group) ? '#1B1B1B' : '#FFFFFF') : '#1B1B1B';
  // card
  x.fillStyle = '#FFFFFF';
  x.fillRect(0, 0, W, H);
  x.lineWidth = 8;
  x.strokeStyle = '#1B1B1B';
  x.strokeRect(4, 4, W - 8, H - 8);
  // header band
  const pad = 36;
  x.fillStyle = s.kind === 'property' ? color : '#FFFFFF';
  x.fillRect(pad, pad, W - pad * 2, 170);
  x.lineWidth = 5;
  x.strokeRect(pad, pad, W - pad * 2, 170);
  x.fillStyle = headInk;
  x.textAlign = 'center';
  x.font = '700 30px Archivo, sans-serif';
  x.fillText('T I T L E   D E E D', W / 2, pad + 60);
  x.font = '900 72px Archivo, sans-serif';
  let name = s.name.toUpperCase();
  while (x.measureText(name).width > W - pad * 2 - 40) {
    const size = parseInt(x.font.match(/(\d+)px/)[1], 10) - 4;
    x.font = `900 ${size}px Archivo, sans-serif`;
  }
  x.fillText(name, W / 2, pad + 140);
  // photo (cover fit)
  const py = pad + 170 + 24;
  const ph = H - py - 130;
  const pw = W - pad * 2;
  const r = Math.max(pw / img.width, ph / img.height);
  const sw = pw / r;
  const sh = ph / r;
  x.save();
  x.beginPath();
  x.rect(pad, py, pw, ph);
  x.clip();
  x.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, pad, py, pw, ph);
  x.restore();
  x.lineWidth = 4;
  x.strokeRect(pad, py, pw, ph);
  // stamp
  const claim = state.claimed[s.id];
  const when = claim ? new Date(claim.at) : new Date();
  const cx = W - pad - 150;
  const cy = py + ph - 150;
  x.save();
  x.translate(cx, cy);
  x.rotate(-0.21);
  x.fillStyle = 'rgba(255,255,255,0.85)';
  x.beginPath();
  x.arc(0, 0, 118, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = 9;
  x.strokeStyle = '#B3121F';
  x.stroke();
  x.fillStyle = '#B3121F';
  x.font = '800 24px Archivo, sans-serif';
  if (claim && claim.past) {
    x.font = '800 24px Archivo, sans-serif';
    x.fillText('BEEN HERE', 0, -30);
    x.font = '900 46px Archivo, sans-serif';
    x.fillText('BEFORE', 0, 22);
  } else {
    x.fillText('ACQUIRED', 0, -36);
    x.font = '900 50px Archivo, sans-serif';
    x.fillText(when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase(), 0, 16);
    x.font = '800 22px Archivo, sans-serif';
    x.fillText(`${when.getFullYear()} · ${when.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 0, 52);
  }
  x.restore();
  // footer
  x.fillStyle = '#1B1B1B';
  x.textAlign = 'left';
  x.font = 'italic 52px "Instrument Serif", Georgia, serif';
  x.fillText('Property of the crew', pad + 6, H - 56);
  x.textAlign = 'right';
  x.font = '700 30px Archivo, sans-serif';
  x.fillStyle = '#5C574D';
  x.fillText(`No. ${claimOrder(s.id) || claimedCount()} of 28`, W - pad - 6, H - 60);
  URL.revokeObjectURL(img.src);
  return new Promise((resolve) => c.toBlob(resolve, 'image/jpeg', 0.86));
}

// ---------- Notifications ----------
function logAlert(kind, title, body, id) {
  state.alerts.unshift({ at: new Date().toISOString(), kind, title, body, id: id || null });
  state.alerts = state.alerts.slice(0, 60);
  persist();
  renderAlertsBadge();
  if (currentView() === 'alerts') renderAlerts();
}

async function systemNotify(title, body, tag) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', renotify: true };
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch (e) {}
}

let toastTimer = null;
function toast(title, body, onTap) {
  const el = $('#toast');
  el.innerHTML = `${appMark()}<span class="alert-text"><span class="alert-title">${esc(title)}</span><span class="alert-body">${esc(body)}</span></span>`;
  el.hidden = false;
  el.onclick = () => {
    el.hidden = true;
    if (onTap) onTap();
  };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 6000);
}

function notify(kind, title, body, id, tag, onTap) {
  logAlert(kind, title, body, id);
  if (document.hidden) systemNotify(title, body, tag || kind);
  else if (!overlayOpen) toast(title, body, onTap); // never cover a claim or card screen
  if (navigator.vibrate) navigator.vibrate(kind === 'claim' || kind === 'set' ? [120, 60, 120] : 80);
}

// ---------- Game engine ----------
function claim(s, pos) {
  if (state.claimed[s.id]) return;
  let bonus = 0;
  const ac = state.activeCard;
  if (ac && ac.target === s.id && Date.now() < ac.expires) {
    bonus = CARD_BONUS;
    state.activeCard = null;
  }
  state.claimed[s.id] = { at: new Date().toISOString(), bonus };
  persist();

  const rent = s.kind === 'property' ? `Rent £${s.rents[0]}.` : s.kind === 'station' ? 'Rent £25.' : '';
  // In-app: the claim screen itself is the notification, so no toast.
  logAlert('claim', `Title deed acquired: ${s.name}`, `The Bank has transferred ${s.name} to the crew. ${rent}`.trim(), s.id);
  if (document.hidden) systemNotify(`Title deed acquired: ${s.name}`, `The Bank has transferred ${s.name} to the crew. ${rent} Tap to collect your deed.`, `claim-${s.id}`);
  if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  enqueue(() => openDeed(s.id, true));

  if (s.kind === 'property' && isSetComplete(s.group) && !state.setsAwarded.includes(s.group)) {
    state.setsAwarded.push(s.group);
    persist();
    const names = groupMembers(s.group).map((m) => m.name).join(', ');
    logAlert('set', `FULL SET! The ${GROUP_NAMES[s.group].toLowerCase()} set is yours`, `${names}. Rent doubled by order of the Bank.`, s.id);
    if (document.hidden) systemNotify(`FULL SET! The ${GROUP_NAMES[s.group].toLowerCase()} set is yours`, `${names}. Rent doubled by order of the Bank.`, `set-${s.group}`);
    enqueue(() => openSetBonus(s.group));
  }
  render();
}

function maybeNudge(pos) {
  const now = Date.now();
  if (now - state.lastNudgeAt < NUDGE_GAP) return;
  const p = [pos.lat, pos.lng];
  let best = null;
  for (const s of OWNABLE) {
    if (state.claimed[s.id]) continue;
    const d = distanceTo(s, p);
    if (d > NUDGE_RADIUS || d <= s.radius) continue;
    if (now - (state.nudged[s.id] || 0) < NUDGE_REPEAT) continue;
    if (!best || d < best.d) best = { s, d };
  }
  if (!best) return;
  const s = best.s;
  state.nudged[s.id] = now;
  state.lastNudgeAt = now;
  persist();
  const extra = s.kind === 'property' ? ` ${setProgressNote(s)}.` : '';
  notify('nudge', `Psst… ${s.name} is ${formatDistance(best.d)} away`, `Unclaimed and closer than you think.${extra}`, s.id, `nudge-${s.id}`, () => openDeed(s.id));
}

function cardsToday() {
  const today = new Date().toDateString();
  return (state.cards || []).filter((c) => new Date(c.at).toDateString() === today);
}

function pickCard(pos) {
  const p = [pos.lat, pos.lng];
  const near = OWNABLE.filter((s) => !state.claimed[s.id])
    .map((s) => ({ s, d: distanceTo(s, p) }))
    .filter((x) => x.d <= NUDGE_RADIUS && x.d > x.s.radius)
    .sort((a, b) => a.d - b.d);
  const vine = near.find((x) => x.s.id === 'vine-street');
  const options = CARDS.filter((c) => {
    if (c.type === 'jail') return !!vine;
    if (c.type === 'target') return near.length > 0;
    return true;
  });
  // Prefer a card that sends you somewhere, when one is possible.
  const directed = options.filter((c) => c.type !== 'cash');
  const pool = directed.length && Math.random() < 0.7 ? directed : options;
  const card = pool[Math.floor(Math.random() * pool.length)];
  let target = null;
  if (card.type === 'jail') target = vine;
  if (card.type === 'target') target = near[Math.floor(Math.random() * Math.min(3, near.length))];
  const fill = (t) => t.replace('{name}', target ? target.s.name : '').replace('{dist}', target ? formatDistance(target.d) : '');
  return { deck: card.deck, type: card.type, amount: card.amount || 0, title: fill(card.title), body: fill(card.body), target: target ? target.s.id : null };
}

function drawCard(pos, force = false) {
  const today = cardsToday();
  if (!force) {
    if (testMode) return; // in test mode cards only come from the "Draw a card" button
    if (Date.now() - (state.startedAt || 0) < 15 * 60 * 1000) return; // not in the first 15 minutes
    if (today.length >= CARD_MAX_PER_DAY) return;
    const last = state.cards.length ? new Date(state.cards[state.cards.length - 1].at).getTime() : 0;
    if (Date.now() - last < CARD_GAP) return;
    if (Date.now() - lastCardRoll < 60 * 1000) return;
    lastCardRoll = Date.now();
    if (Math.random() > CARD_CHANCE_PER_MIN) return;
  }
  const card = pickCard(pos);
  card.n = Math.min(today.length + 1, CARD_MAX_PER_DAY);
  state.cards.push({ at: new Date().toISOString(), title: card.title, cash: card.amount });
  if (card.amount) state.cash = (state.cash || 0) + card.amount;
  if (card.target) state.activeCard = { target: card.target, expires: Date.now() + CARD_WINDOW, title: card.title };
  persist();
  logAlert('card', `${card.deck}!`, `${card.title} ${card.body}`, card.target);
  if (document.hidden) systemNotify(`${card.deck}!`, `${card.title} Tap to draw the card.`, 'card');
  if (navigator.vibrate) navigator.vibrate(80);
  enqueue(() => openCard(card));
  render();
}

function onPosition(pos) {
  lastPos = { ...pos, at: Date.now() };
  updateGpsLabel();
  if (!state.started) {
    renderNearby();
    return;
  }
  const p = [pos.lat, pos.lng];
  if (pos.acc <= MAX_ACCURACY) {
    for (const s of OWNABLE) {
      if (state.claimed[s.id]) continue;
      if (distanceTo(s, p) <= s.radius + Math.min(pos.acc, 40)) claim(s, pos);
    }
  }
  if (pos.acc <= 500) {
    maybeNudge(pos);
    drawCard(pos);
  }
  renderNearby();
}

function updateGpsLabel() {
  const el = $('[data-role="gps"]');
  el.classList.remove('live', 'test');
  if (testMode) {
    el.textContent = 'Test mode';
    el.classList.add('test');
  } else if (lastPos) {
    el.textContent = `GPS ±${Math.round(lastPos.acc)} m`;
    el.classList.add('live');
  } else {
    el.textContent = state.started ? 'Locating…' : 'Not started';
  }
}

function startTracking() {
  if (testMode || watchId !== null || !('geolocation' in navigator)) return;
  watchId = navigator.geolocation.watchPosition(
    (p) => onPosition({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
    (err) => {
      const el = $('[data-role="gps"]');
      el.textContent = err.code === 1 ? 'Location blocked' : 'No GPS signal';
      if (err.code === 1) toast('Location is turned off', 'Allow location for this site in your browser settings so properties can claim themselves.');
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 }
  );
}
function stopTracking() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
}

// ---------- Wake lock ----------
async function applyWakeLock() {
  if (!('wakeLock' in navigator)) return;
  try {
    if (state.settings.wakeLock && document.visibilityState === 'visible') {
      if (!wakeLock) {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => (wakeLock = null));
      }
    } else if (wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) {}
}
document.addEventListener('visibilitychange', applyWakeLock);

// ---------- Onboarding & settings ----------
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
}

function openIntro() {
  const iosTip = isIOS() && !isStandalone()
    ? `<li><b>!</b><span>On iPhone, tap <strong>Share → Add to Home Screen</strong> and open it from there first, so notifications work.</span></li>`
    : '';
  const squares = Array.from({ length: 25 }, (_, i) => {
    const r = Math.floor(i / 5);
    const c = i % 5;
    const edge = r === 0 || r === 4 || c === 0 || c === 4;
    const colors = ['#E2231A', '#FCE300', '#1FA34A', '#1B4FA0', '#8B4A2B', '#9FD3EF', '#D6338A', '#F28C28'];
    return `<span style="background:${edge ? colors[i % colors.length] : '#F4EFE3'}"></span>`;
  }).join('');
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow">LONDON MONOPOLY · UNOFFICIAL FAN GAME</span></div>
      <h1 class="serif">Complete the board.</h1>
      <p class="lede">Walk London as a crew and claim every street, station and utility on the Monopoly board.</p>
      <div class="intro-board" aria-hidden="true">${squares}</div>
      <ul class="steps">
        <li><b>1</b><span>Keep this app open while you walk. Properties claim themselves when you arrive.</span></li>
        <li><b>2</b><span>We’ll tap you on the shoulder when an unclaimed one is within 1 km.</span></li>
        <li><b>3</b><span>Complete colour sets for bonuses, and stamp each deed with a crew photo.</span></li>
        ${iosTip}
      </ul>
      <div class="actions">
        <button type="button" class="btn btn-dark" data-act="start">Start the game</button>
        <button type="button" class="btn-link" data-act="past">We’ve already been to some places</button>
        <p class="status-line" style="font-weight:600">We’ll ask for your location and permission to send notifications.</p>
      </div>
    </div>`,
    '',
    (el) => {
      el.querySelector('[data-act="start"]').addEventListener('click', startGame);
      el.querySelector('[data-act="past"]').addEventListener('click', async () => {
        await startGame();
        openPastPicker();
      });
    }
  );
}

async function startGame() {
  state.started = true;
  state.startedAt = Date.now();
  persist();
  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (e) {}
  }
  closeOverlay();
  updateGpsLabel();
  if (testMode) startTest();
  else startTracking();
  render();
}

function openSettings() {
  const notif = !('Notification' in window)
    ? 'Not supported in this browser' + (isIOS() && !isStandalone() ? ' (add to Home Screen first on iPhone)' : '')
    : Notification.permission === 'granted'
      ? 'On'
      : Notification.permission === 'denied'
        ? 'Blocked in browser settings'
        : 'Not yet allowed';
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow">SETTINGS</span>${CLOSE_BTN}</div>
      <div class="settings-list">
        <div class="setting"><div class="setting-row"><b>Notifications</b>${'Notification' in window && Notification.permission === 'default' ? '<button type="button" class="small-btn" data-act="notif">Allow</button>' : ''}</div><p>${esc(notif)}. Alerts show on your lock screen when the app is in the background.</p></div>
        <div class="setting"><div class="setting-row"><b>Keep screen awake</b><label class="switch"><input type="checkbox" data-act="wake" ${state.settings.wakeLock ? 'checked' : ''} aria-label="Keep screen awake"><span></span></label></div><p>Phones pause location when the screen locks. Turn this on while you walk so nothing gets missed.</p></div>
        <div class="setting"><div class="setting-row"><b>Test mode</b><label class="switch"><input type="checkbox" data-act="test" ${testMode ? 'checked' : ''} aria-label="Test mode"><span></span></label></div><p>Pretend to be anywhere on the board to try claims, nudges and cards without walking. Turns off real GPS.</p></div>
        <div class="setting"><div class="setting-row"><b>Places we’ve already been</b><button type="button" class="small-btn" data-act="past">Choose</button></div><p>Mark places the crew visited before you started using the app.</p></div>
        <div class="setting"><b>Utility stand-ins</b><p>Electric Company is Battersea Power Station. Water Works is the Museum of Water &amp; Steam at Kew Bridge.</p></div>
        <div class="setting"><div class="setting-row"><b>Reset the game</b><button type="button" class="small-btn danger" data-act="reset">Reset</button></div><p>Clears every deed, photo and alert on this phone.</p></div>
      </div>
    </div>`,
    '',
    (el) => {
      const n = el.querySelector('[data-act="notif"]');
      if (n)
        n.addEventListener('click', async () => {
          await Notification.requestPermission();
          openSettings();
        });
      el.querySelector('[data-act="wake"]').addEventListener('change', (e) => {
        state.settings.wakeLock = e.target.checked;
        persist();
        applyWakeLock();
      });
      el.querySelector('[data-act="test"]').addEventListener('change', (e) => setTestMode(e.target.checked));
      el.querySelector('[data-act="past"]').addEventListener('click', openPastPicker);
      el.querySelector('[data-act="reset"]').addEventListener('click', async () => {
        if (!confirm('Reset the whole game? All deeds and photos on this phone will be deleted.')) return;
        state = store.reset();
        await store.clearPhotos();
        alertsSeen = 0;
        closeOverlay();
        render();
        openIntro();
      });
    }
  );
}

// ---------- Test mode ----------
function setTestMode(on) {
  testMode = on;
  localStorage.setItem('fullboard.test', on ? '1' : '0');
  lastPos = null;
  if (on) {
    stopTracking();
    startTest();
  } else {
    $('#test-fab').hidden = true;
    startTracking();
  }
  updateGpsLabel();
  renderNearby();
}

function startTest() {
  $('#test-fab').hidden = false;
}

// A point `metres` from `p`, in the first direction that doesn't land
// inside another unclaimed property (so "stand nearby" doesn't claim it).
function nearbyPoint(p, metres) {
  for (let k = 0; k < 16; k++) {
    const a = (k * Math.PI) / 8;
    const q = [p[0] + (metres * Math.cos(a)) / 111320, p[1] + (metres * Math.sin(a)) / (111320 * Math.cos((p[0] * Math.PI) / 180))];
    const clash = OWNABLE.some((s) => !state.claimed[s.id] && distanceTo(s, q) <= s.radius + 40);
    if (!clash) return q;
  }
  return [p[0] + metres / 111320, p[1]];
}

function openTestPanel() {
  const opts = OWNABLE.map((s) => `<option value="${s.id}">${esc(s.name)}${state.claimed[s.id] ? ' ✓' : ''}</option>`).join('');
  showOverlay(
    `<div class="sheet">
      <div class="sheet-top"><span class="eyebrow">TEST MODE</span>${CLOSE_BTN}</div>
      <p class="lede">Jump to a place to see what the crew would get there.</p>
      <label class="setting"><b>Place</b><select class="test-select" data-act="place">${opts}</select></label>
      <div class="test-grid">
        <button type="button" class="btn btn-dark" data-act="arrive">Arrive here</button>
        <button type="button" class="btn btn-light" data-act="near">Stand 600 m away</button>
        <button type="button" class="btn btn-light" data-act="card">Draw a card</button>
        <button type="button" class="btn btn-light" data-act="far">Go far away</button>
      </div>
      <p class="status-line" data-role="where">${lastPos ? `Now at ${lastPos.lat.toFixed(4)}, ${lastPos.lng.toFixed(4)}` : 'No position yet'}</p>
    </div>`,
    '',
    (el) => {
      const sel = el.querySelector('[data-act="place"]');
      const firstOpen = OWNABLE.find((s) => !state.claimed[s.id]);
      if (firstOpen) sel.value = firstOpen.id;
      const go = (p) => {
        closeOverlay();
        state.lastNudgeAt = 0;
        state.nudged = {};
        onPosition({ lat: p[0], lng: p[1], acc: 10 });
      };
      el.querySelector('[data-act="arrive"]').addEventListener('click', () => go(anchorOf(BY_ID[sel.value])));
      el.querySelector('[data-act="near"]').addEventListener('click', () => go(nearbyPoint(anchorOf(BY_ID[sel.value]), sel.value === 'mayfair' ? 900 : 600)));
      el.querySelector('[data-act="far"]').addEventListener('click', () => go([51.4545, -0.0080]));
      el.querySelector('[data-act="card"]').addEventListener('click', () => {
        const p = lastPos || { lat: 51.5080, lng: -0.1281, acc: 10 };
        closeOverlay();
        drawCard(p, true);
      });
    }
  );
}
$('#test-fab').addEventListener('click', openTestPanel);

// ---------- Global clicks ----------
document.addEventListener('click', (e) => {
  const open = e.target.closest('[data-open]');
  if (open && open.dataset.open) {
    if (overlayOpen) closeOverlay();
    setTimeout(() => openDeed(open.dataset.open), overlayOpen ? 160 : 0);
    return;
  }
  const group = e.target.closest('[data-group]');
  if (group) return openGroup(group.dataset.group);
  const photo = e.target.closest('[data-photo]');
  if (photo) return openPhoto(photo.dataset.photo);
  if (e.target.closest('[data-action="settings"]')) openSettings();
});

// ---------- Boot ----------
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data && e.data.open) openDeed(e.data.open);
  });
}

const preMarked = applyVisitedParam();
render();
updateGpsLabel();
applyWakeLock();
if (!state.started) openIntro();
else if (testMode) startTest();
else startTracking();

if (preMarked) setTimeout(() => toast(`${preMarked} places added from your link`, 'They’re on the board as places you’ve been before.'), 600);

// Expose a tiny hook for debugging in the console.
window.fullBoard = { state: () => state, claim: (id) => claim(BY_ID[id], lastPos), haversine };
