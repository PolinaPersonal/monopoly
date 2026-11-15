// Distance helpers. Accurate to a few metres across central London,
// which is all a walking game needs.

const R = 6371000;
const toRad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Project to a local flat plane (metres) around `origin`.
function toXY(p, origin) {
  const x = toRad(p[1] - origin[1]) * R * Math.cos(toRad(origin[0]));
  const y = toRad(p[0] - origin[0]) * R;
  return [x, y];
}

function pointToSegment(p, a, b) {
  const [px, py] = toXY(p, a);
  const [bx, by] = toXY(b, a);
  const len2 = bx * bx + by * by;
  let t = len2 ? (px * bx + py * by) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - t * bx;
  const dy = py - t * by;
  return Math.sqrt(dx * dx + dy * dy);
}

// Shortest distance in metres from `pos` to a square's geometry.
export function distanceTo(square, pos) {
  if (square.point) return haversine(pos, square.point);
  const path = square.path;
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    best = Math.min(best, pointToSegment(pos, path[i], path[i + 1]));
  }
  return best;
}

// A representative point for a square (used for map links and test teleports).
export function anchorOf(square) {
  if (square.point) return square.point;
  return square.path[Math.floor(square.path.length / 2)];
}

export function formatDistance(m) {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toFixed(1)} km`;
}
