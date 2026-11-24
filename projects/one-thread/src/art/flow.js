// Flow engine: rasterize a shape, distance-transform it, and grow evenly spaced streamlines of a
// direction field inside it (Jobard–Lefer). These become the carved "resist" lines that give the
// dyed shapes their hair / feather / water / fold patterning.
import { trace, bbox } from './geom.js';
import { rng } from '../core.js';

let _cv = null;
export function rasterMask(path, res = 1, pad = 2) {
  const b = bbox(path), w = Math.max(2, Math.ceil(b.w * res) + pad * 2), h = Math.max(2, Math.ceil(b.h * res) + pad * 2);
  if (!_cv) { _cv = new OffscreenCanvas(w, h); _cv._x = _cv.getContext('2d', { willReadFrequently: true }); }
  if (_cv.width < w || _cv.height < h) { _cv.width = Math.max(_cv.width, w); _cv.height = Math.max(_cv.height, h); }
  const x = _cv._x; x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, w, h);
  x.setTransform(res, 0, 0, res, pad - b.x * res, pad - b.y * res); x.fillStyle = '#000'; x.beginPath(); trace(x, path); x.fill('evenodd');
  const d = x.getImageData(0, 0, w, h).data, m = new Uint8Array(w * h);
  for (let i = 0; i < m.length; i++) m[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return { m, w, h, res, ox: b.x - pad / res, oy: b.y - pad / res };
}
// exact EDT (Felzenszwalb), distance in raster px to the nearest outside pixel
export function edt(mask) {
  const { m, w, h } = mask, INF = 1e12, f = new Float64Array(Math.max(w, h)), D = new Float32Array(w * h);
  const v = new Int32Array(Math.max(w, h) + 1), z = new Float64Array(Math.max(w, h) + 2);
  const d1 = (n, get, set) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF; for (let q = 0; q < n; q++) f[q] = get(q);
    for (let q = 1; q < n; q++) { let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); } k++; v[k] = q; z[k] = s; z[k + 1] = INF; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; set(q, (q - v[k]) * (q - v[k]) + f[v[k]]); }
  };
  for (let x = 0; x < w; x++) d1(h, y => (m[y * w + x] ? INF : 0), (y, val) => { D[y * w + x] = val; });
  for (let y = 0; y < h; y++) d1(w, x => D[y * w + x], (x, val) => { D[y * w + x] = val; });
  for (let i = 0; i < D.length; i++) D[i] = Math.sqrt(D[i]);
  return D;
}
function blur(D, w, h, r) {
  const tmp = new Float32Array(D.length), out = new Float32Array(D.length);
  for (let y = 0; y < h; y++) { let s = 0; for (let x = -r; x <= r; x++) s += D[y * w + Math.min(w - 1, Math.max(0, x))]; for (let x = 0; x < w; x++) { tmp[y * w + x] = s / (2 * r + 1); s += D[y * w + Math.min(w - 1, x + r + 1)] - D[y * w + Math.max(0, x - r)]; } }
  for (let x = 0; x < w; x++) { let s = 0; for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]; for (let y = 0; y < h; y++) { out[y * w + x] = s / (2 * r + 1); s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; } }
  return out;
}
// Field: array of terms summed at each point.
//   {guide:[polyline], w, fall}   follow a guide stroke's direction (falls off with distance)
//   {vortex:[x,y,r,dir], w}       swirl (dir ±1), lines curl into a spiral
//   {dir:angle, w}                uniform direction
//   {contour:1, w}                parallel to the outline
//   {radial:[x,y], w}             away from a point
//   {fn:(x,y)=>[vx,vy], w}
export function makeField(terms, ctx) {
  const guides = [];
  for (const t of terms) if (t.guide) for (const g of (typeof t.guide[0][0] === 'number' ? [t.guide] : t.guide)) {
    const step = Math.max(1, Math.floor(g.length / 24)), s = [];
    for (let i = 0; i < g.length - 1; i += step) { const j = Math.min(g.length - 1, i + step), dx = g[j][0] - g[i][0], dy = g[j][1] - g[i][1], l = Math.hypot(dx, dy) || 1; s.push([(g[i][0] + g[j][0]) / 2, (g[i][1] + g[j][1]) / 2, dx / l, dy / l]); }
    guides.push({ s, w: t.w ?? 1, fall: t.fall ?? 60 });
  }
  return (x, y) => {
    let vx = 0, vy = 0;
    for (const g of guides) { let sx = 0, sy = 0, sw = 0; for (const [px, py, dx, dy] of g.s) { const d2 = (px - x) ** 2 + (py - y) ** 2, w = 1 / (d2 + 25) ** 1.5; sx += dx * w; sy += dy * w; sw += w; } const near = g.s.reduce((m, q) => Math.min(m, (q[0] - x) ** 2 + (q[1] - y) ** 2), 1e12); const k = g.w / (1 + near / (g.fall * g.fall)); vx += sx / sw * k; vy += sy / sw * k; }
    for (const t of terms) {
      const w = t.w ?? 1;
      if (t.dir !== undefined) { vx += Math.cos(t.dir) * w; vy += Math.sin(t.dir) * w; }
      else if (t.vortex) { const [cx, cy, r, dr = 1] = t.vortex, dx = x - cx, dy = y - cy, d = Math.hypot(dx, dy) || 1e-3, k = w * Math.exp(-(d * d) / (r * r)) * 3; const inn = t.inward ?? 0.22; vx += (-dy / d * dr - dx / d * inn) * k; vy += (dx / d * dr - dy / d * inn) * k; }
      else if (t.contour) { const [gx, gy] = ctx.grad(x, y); vx += -gy * w * t.contour; vy += gx * w * t.contour; }
      else if (t.radial) { const dx = x - t.radial[0], dy = y - t.radial[1], d = Math.hypot(dx, dy) || 1; vx += dx / d * w; vy += dy / d * w; }
      else if (t.fn) { const [a, b] = t.fn(x, y); vx += a * w; vy += b * w; }
    }
    const l = Math.hypot(vx, vy) || 1e-6; return [vx / l, vy / l];
  };
}
// → array of polylines (panel units)
export function flowLines(path, { field = [{ contour: 1 }], gap = 18, margin = 6, minLen = 24, seed = 1, test = 0.62, maxLen = 4000, smooth = 3 } = {}) {
  const b = bbox(path), span = Math.max(b.w, b.h);
  const res = Math.min(1.5, Math.max(0.35, 420 / span), 6 / gap * 1.6 + 0.2);
  const M = rasterMask(path, res), D = blur(edt(M), M.w, M.h, smooth), { w, h, ox, oy } = M;
  const ix = (x, y) => { const i = Math.round((x - ox) * res), j = Math.round((y - oy) * res); return i < 0 || j < 0 || i >= w || j >= h ? -1 : j * w + i; };
  const dist = (x, y) => { const k = ix(x, y); return k < 0 || !M.m[k] ? 0 : D[k] / res; };
  const grad = (x, y) => { const e = 1.5 / res; let gx = dist(x + e, y) - dist(x - e, y), gy = dist(x, y + e) - dist(x, y - e); const l = Math.hypot(gx, gy); return l < 1e-4 ? [0, 0] : [gx / l, gy / l]; };
  const F = makeField(field, { grad, dist });
  // occupancy grid
  const cs = gap, gw = Math.ceil(b.w / cs) + 3, gh = Math.ceil(b.h / cs) + 3, grid = new Map();
  const key = (x, y) => Math.floor((y - b.y) / cs + 1) * gw + Math.floor((x - b.x) / cs + 1);
  const near = (x, y, r, self) => { const cx = Math.floor((x - b.x) / cs + 1), cy = Math.floor((y - b.y) / cs + 1), r2 = r * r; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const c = grid.get((cy + j) * gw + cx + i); if (!c) continue; for (const p of c) { if (self && p[2] === self && p[3] !== undefined && Math.abs(p[3] - self._n) < self._skip) continue; if ((p[0] - x) ** 2 + (p[1] - y) ** 2 < r2) return true; } } return false; };
  const put = (x, y, id, n) => { const k = key(x, y); let c = grid.get(k); if (!c) grid.set(k, c = []); c.push([x, y, id, n]); };
  const R = rng(seed), step = Math.min(gap * 0.22, 4), lines = [];
  const grow = (x, y) => {
    const id = { _n: 0, _skip: Math.ceil(gap * 1.6 / step) }, half = [];
    for (const dir of [1, -1]) {
      let px = x, py = y, pts = [], L = 0, [lx, ly] = F(x, y); lx *= dir; ly *= dir;
      while (L < maxLen) {
        let [ax, ay] = F(px, py); if (ax * lx + ay * ly < 0) { ax = -ax; ay = -ay; }
        let [bx, by] = F(px + ax * step * 0.5, py + ay * step * 0.5); if (bx * ax + by * ay < 0) { bx = -bx; by = -by; }
        if (bx * lx + by * ly < 0.2) break;
        const nx = px + bx * step, ny = py + by * step; if (dist(nx, ny) < margin) break; if (near(nx, ny, gap * test)) break;
        // self-proximity (spirals)
        let hit = false; const all = half.length ? half[0] : [], sk = Math.ceil(gap * 1.7 / step);
        for (let i = 0; i < pts.length - sk; i += 2) if ((pts[i][0] - nx) ** 2 + (pts[i][1] - ny) ** 2 < (gap * test) ** 2) { hit = true; break; }
        if (!hit && all.length) for (let i = sk; i < all.length; i += 2) if ((all[i][0] - nx) ** 2 + (all[i][1] - ny) ** 2 < (gap * test) ** 2 && i + pts.length > sk) { hit = true; break; }
        if (hit) break;
        pts.push([nx, ny]); px = nx; py = ny; lx = bx; ly = by; L += step;
      }
      half.push(pts);
    }
    const pl = [...half[1].reverse(), [x, y], ...half[0]];
    const len = pl.length * step; if (len < minLen) return null;
    pl.forEach(p => put(p[0], p[1], id)); pl.open = true; return pl;
  };
  const queue = [];
  const trySeed = (x, y) => { if (dist(x, y) < margin || near(x, y, gap * 0.98)) return; const pl = grow(x, y); if (pl) { lines.push(pl); queue.push(pl); } };
  const drain = () => { while (queue.length) { const pl = queue.shift(); for (let i = 0; i < pl.length; i += 3) { const a = pl[Math.max(0, i - 1)], c = pl[Math.min(pl.length - 1, i + 1)]; let dx = c[0] - a[0], dy = c[1] - a[1]; const l = Math.hypot(dx, dy) || 1; for (const s of [1, -1]) trySeed(pl[i][0] - dy / l * gap * s, pl[i][1] + dx / l * gap * s); } } };
  // start from the deepest point, then scatter
  let best = 0, bi = 0; for (let i = 0; i < D.length; i++) if (M.m[i] && D[i] > best) { best = D[i]; bi = i; }
  trySeed(ox + (bi % w) / res, oy + Math.floor(bi / w) / res); drain();
  const tries = Math.min(4000, Math.ceil(b.w * b.h / gap / gap * 3));
  for (let i = 0; i < tries; i++) { trySeed(b.x + R() * b.w, b.y + R() * b.h); drain(); }
  return lines;
}
