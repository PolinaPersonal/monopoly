// The zoomable Monopoly board. Drawn once at 720×720 "board pixels",
// then scaled to fit. Pinch, ctrl/trackpad-pinch, double-tap and the
// +/−/fit buttons change the zoom; one finger drags to pan.

import { SQUARES, COLORS, LIGHT_GROUPS } from './data.js';

const SIZE = 720;
const CN = 96; // corner size
const SQ = (SIZE - 2 * CN) / 9; // edge square width
const MAX_REL = 3.4; // max zoom relative to "fit"

const GLYPHS = {
  chance: { g: '?', size: 40, ink: '#E07B12' },
  chest: { g: '✦', size: 22, ink: '#1B4FA0' },
  tax: { g: '£', size: 30, ink: '#1B1B1B' },
};

const CORNERS = {
  GO: { top: 'COLLECT £200\nSALARY AS YOU PASS', big: 'GO', size: 34, ink: '#B3121F', bottom: '←' },
  JAIL: { top: 'IN', big: 'JAIL', size: 24, ink: '#1B1B1B', bottom: 'JUST VISITING' },
  FREE: { top: 'FREE', big: 'P', size: 34, ink: '#B3121F', bottom: 'PARKING' },
  GOTOJAIL: { top: 'GO TO', big: 'JAIL', size: 24, ink: '#1B4FA0', bottom: 'DO NOT PASS GO' },
};

const ICONS = {
  station:
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1B1B1B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M8 19l-2 2M16 19l2 2"/><circle cx="9" cy="13" r="0.8" fill="#1B1B1B"/><circle cx="15" cy="13" r="0.8" fill="#1B1B1B"/></svg>',
  electric:
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1B1B1B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0012 3z"/></svg>',
  water:
    '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#1B1B1B" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h8v4M8 8V5h4M12 12c0 0-3 4-3 6a3 3 0 006 0c0-2-3-6-3-6z" transform="translate(2 0)"/></svg>',
};

function geometry(i) {
  if (i === 0) return { x: SIZE - CN, y: SIZE - CN, w: CN, h: CN, rot: 0 };
  if (i < 10) return { x: SIZE - CN - i * SQ, y: SIZE - CN, w: SQ, h: CN, rot: 0 };
  if (i === 10) return { x: 0, y: SIZE - CN, w: CN, h: CN, rot: 0 };
  if (i < 20) return { x: 0, y: SIZE - CN - (i - 10) * SQ, w: CN, h: SQ, rot: 90 };
  if (i === 20) return { x: 0, y: 0, w: CN, h: CN, rot: 0 };
  if (i < 30) return { x: CN + (i - 21) * SQ, y: 0, w: SQ, h: CN, rot: 180 };
  if (i === 30) return { x: SIZE - CN, y: 0, w: CN, h: CN, rot: 0 };
  return { x: SIZE - CN, y: CN + (i - 31) * SQ, w: CN, h: SQ, rot: 270 };
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function squareHTML(s, i) {
  const g = geometry(i);
  const isCorner = s.kind === 'corner';
  const iw = isCorner ? CN : SQ;
  const ih = CN;
  const il = (g.w - iw) / 2;
  const it = (g.h - ih) / 2;
  let inner = '';
  if (isCorner) {
    const c = CORNERS[s.label];
    inner = `<div class="sq-corner">
      <span class="sq-small">${esc(c.top)}</span>
      <span class="sq-big" style="font-size:${c.size}px;color:${c.ink}">${esc(c.big)}</span>
      <span class="sq-small">${esc(c.bottom)}</span></div>`;
  } else {
    const ownable = s.kind === 'property' || s.kind === 'station' || s.kind === 'utility';
    const band = s.kind === 'property'
      ? `<div class="sq-band" style="background:${COLORS[s.group]}"><svg class="sq-tick" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="${LIGHT_GROUPS.has(s.group) ? '#1B1B1B' : '#FFFFFF'}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>`
      : '';
    let mid = '';
    if (GLYPHS[s.kind]) {
      const gl = GLYPHS[s.kind];
      mid = `<span class="sq-glyph" style="font-size:${gl.size}px;color:${gl.ink}">${gl.g}</span>`;
    } else if (s.kind === 'station') mid = ICONS.station;
    else if (s.kind === 'utility') mid = s.id === 'water-works' ? ICONS.water : ICONS.electric;
    const name = s.boardName || s.label;
    const price = s.price ? `£${s.price}` : s.sub || '';
    const ownedTick = s.kind !== 'property' && ownable
      ? `<svg class="sq-tick sq-tick-badge" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#FFFFFF" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`
      : '';
    inner = `${band}<div class="sq-body">
      <span class="sq-name">${esc(name)}</span>${mid}<span class="sq-price">${esc(price)}</span>${ownedTick}</div>`;
  }
  return `<div class="sq" data-id="${s.id}" data-kind="${s.kind}" style="left:${g.x}px;top:${g.y}px;width:${g.w}px;height:${g.h}px">
    <div class="sq-inner" style="left:${il}px;top:${it}px;width:${iw}px;height:${ih}px;transform:rotate(${g.rot}deg)">${inner}</div></div>`;
}

export function createBoard(host, { onSquareTap } = {}) {
  host.innerHTML = `
    <div class="board-wrap">
      <div class="board-vp" tabindex="0" aria-label="Monopoly board. Pinch or use the buttons to zoom.">
        <div class="board-sizer"><div class="board">
          ${SQUARES.map(squareHTML).join('')}
          <div class="board-centre">
            <div class="centre-card centre-chance" aria-hidden="true">CHANCE ?</div>
            <div class="centre-card centre-chest" aria-hidden="true">COMMUNITY<br>CHEST</div>
            <div class="centre-title">
              <span class="centre-city">COMPLETE</span>
              <span class="centre-word">THE BOARD</span>
              <span class="centre-count" data-role="count"></span>
            </div>
          </div>
        </div></div>
      </div>
      <div class="zoom-chip" data-role="chip">Full board</div>
      <div class="zoom-ctl">
        <button type="button" data-zoom="in" aria-label="Zoom in"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>
        <button type="button" data-zoom="out" aria-label="Zoom out"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
        <button type="button" data-zoom="fit" aria-label="Show full board"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg></button>
      </div>
    </div>`;

  const vp = host.querySelector('.board-vp');
  const sizer = host.querySelector('.board-sizer');
  const board = host.querySelector('.board');
  const chip = host.querySelector('[data-role="chip"]');
  let fit = 0.5;
  let z = 0.5;

  function measure() {
    const w = vp.clientWidth;
    const wasFit = Math.abs(z - fit) < 0.001;
    fit = w / SIZE;
    if (wasFit || z < fit) z = fit;
    apply();
  }

  function apply() {
    board.style.transform = `scale(${z})`;
    sizer.style.width = sizer.style.height = `${SIZE * z}px`;
    const rel = z / fit;
    const zoomed = rel > 1.01;
    vp.classList.toggle('zoomed', zoomed);
    chip.textContent = zoomed ? `${rel.toFixed(1)}× zoom` : 'Full board';
  }

  function zoomTo(nz, ax, ay) {
    const old = z;
    nz = Math.max(fit, Math.min(fit * MAX_REL, nz));
    const px = (vp.scrollLeft + ax) / old;
    const py = (vp.scrollTop + ay) / old;
    z = nz;
    apply();
    vp.scrollLeft = Math.max(0, px * z - ax);
    vp.scrollTop = Math.max(0, py * z - ay);
  }

  const local = (cx, cy) => {
    const r = vp.getBoundingClientRect();
    return { x: cx - r.left, y: cy - r.top };
  };
  const centre = () => ({ x: vp.clientWidth / 2, y: vp.clientHeight / 2 });

  host.querySelector('.zoom-ctl').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const c = centre();
    if (b.dataset.zoom === 'in') zoomTo(z * 1.6, c.x, c.y);
    if (b.dataset.zoom === 'out') zoomTo(z / 1.6, c.x, c.y);
    if (b.dataset.zoom === 'fit') zoomTo(fit, 0, 0);
  });

  // Double-tap / double-click: zoom into that spot, or back out.
  let lastTap = 0;
  let tapMoved = false;
  let tapTimer = null;
  function doubleTap(cx, cy) {
    clearTimeout(tapTimer);
    const p = local(cx, cy);
    if (z / fit < 1.5) zoomTo(fit * 2.4, p.x, p.y);
    else zoomTo(fit, 0, 0);
  }
  vp.addEventListener('dblclick', (e) => {
    e.preventDefault();
    doubleTap(e.clientX, e.clientY);
  });

  // Trackpad pinch arrives as ctrl+wheel.
  vp.addEventListener(
    'wheel',
    (e) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const p = local(e.clientX, e.clientY);
      zoomTo(z * Math.exp(-e.deltaY * 0.01), p.x, p.y);
    },
    { passive: false }
  );

  // Two-finger pinch on phones.
  let pinch = null;
  vp.addEventListener(
    'touchstart',
    (e) => {
      tapMoved = false;
      if (e.touches.length === 2) {
        const [a, b] = e.touches;
        const mid = local((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
        pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), z, x: mid.x, y: mid.y };
      }
    },
    { passive: true }
  );
  vp.addEventListener(
    'touchmove',
    (e) => {
      tapMoved = true;
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [a, b] = e.touches;
      const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      zoomTo(pinch.z * (d / pinch.d), pinch.x, pinch.y);
    },
    { passive: false }
  );
  vp.addEventListener('touchend', (e) => {
    if (pinch && e.touches.length < 2) {
      pinch = null;
      return;
    }
    if (tapMoved || e.changedTouches.length !== 1) return;
    const t = e.changedTouches[0];
    const now = Date.now();
    if (now - lastTap < 300) {
      e.preventDefault();
      doubleTap(t.clientX, t.clientY);
      lastTap = 0;
    } else {
      lastTap = now;
    }
  });

  // Single tap on a square opens its deed (after a short wait so
  // double-taps don't also open it).
  vp.addEventListener('click', (e) => {
    const sq = e.target.closest('.sq');
    if (!sq || !onSquareTap) return;
    clearTimeout(tapTimer);
    tapTimer = setTimeout(() => onSquareTap(sq.dataset.id), 320);
  });

  window.addEventListener('resize', measure);
  requestAnimationFrame(measure);

  return {
    update(claimed) {
      let n = 0;
      host.querySelectorAll('.sq').forEach((el) => {
        const own = !!claimed[el.dataset.id];
        if (own) n++;
        el.classList.toggle('owned', own);
      });
      host.querySelector('[data-role="count"]').textContent = `${n} of 28 claimed`;
    },
    fit: () => zoomTo(fit, 0, 0),
    measure,
  };
}
