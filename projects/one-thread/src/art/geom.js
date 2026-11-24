// Geometry kit. A "path" is an array of polylines; a polyline is an array of [x,y] with an optional
// `.open = true` flag. All helpers return dense polylines so the flow engine and painter can use them.
// Coordinates are panel units, y down.
import { TAU, lerp, clamp, rng } from '../core.js';

// Catmull-Rom (centripetal) through pts. A point [x,y,1] is a sharp corner.
export function spl(pts, closed = true, seg = 10) {
  const n = pts.length;
  if (n < 3) { const o = pts.map(p => [p[0], p[1]]); if (!closed) o.open = true; return o; }
  const out = [];
  const get = i => closed ? pts[((i % n) + n) % n] : pts[clamp(i, 0, n - 1)];
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    let p0 = get(i - 1), p1 = get(i), p2 = get(i + 1), p3 = get(i + 2);
    if (p1[2]) p0 = [p1[0] * 2 - p2[0], p1[1] * 2 - p2[1]];
    if (p2[2]) p3 = [p2[0] * 2 - p1[0], p2[1] * 2 - p1[1]];
    const d1 = Math.sqrt(Math.hypot(p1[0] - p0[0], p1[1] - p0[1])) || 1e-3;
    const d2 = Math.sqrt(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])) || 1e-3;
    const d3 = Math.sqrt(Math.hypot(p3[0] - p2[0], p3[1] - p2[1])) || 1e-3;
    const t1 = [0, 1].map(k => (p1[k] - p0[k]) / d1 - (p2[k] - p0[k]) / (d1 + d2) + (p2[k] - p1[k]) / d2).map(v => v * d2);
    const t2 = [0, 1].map(k => (p2[k] - p1[k]) / d2 - (p3[k] - p1[k]) / (d2 + d3) + (p3[k] - p2[k]) / d3).map(v => v * d2);
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2_ = t * t, t3 = t2_ * t;
      out.push([0, 1].map(k => (2 * t3 - 3 * t2_ + 1) * p1[k] + (t3 - 2 * t2_ + t) * t1[k] + (-2 * t3 + 3 * t2_) * p2[k] + (t3 - t2_) * t2[k]));
    }
  }
  if (!closed) { out.push([pts[n - 1][0], pts[n - 1][1]]); out.open = true; }
  return out;
}
export const line = (...p) => { const o = p.map(q => [q[0], q[1]]); o.open = true; return o; };
export const curve = (pts, seg = 12) => spl(pts, false, seg);
export const blob = (pts, seg = 10) => [spl(pts, true, seg)];
export const poly = pts => [pts.map(p => [p[0], p[1]])];
export const rect = (x, y, w, h) => [[[x, y], [x + w, y], [x + w, y + h], [x, y + h]]];
export function rrect(x, y, w, h, r = 8) {
  r = Math.min(r, w / 2, h / 2); const o = [];
  for (const [cx, cy, a] of [[x + w - r, y + r, -Math.PI / 2], [x + w - r, y + h - r, 0], [x + r, y + h - r, Math.PI / 2], [x + r, y + r, Math.PI]])
    for (let i = 0; i <= 8; i++) o.push([cx + Math.cos(a + i / 8 * Math.PI / 2) * r, cy + Math.sin(a + i / 8 * Math.PI / 2) * r]);
  return [o];
}
export const ell = (x, y, rx, ry = rx, rot = 0, n = 48) => { const o = [], c = Math.cos(rot), s = Math.sin(rot); for (let i = 0; i < n; i++) { const a = i / n * TAU, u = Math.cos(a) * rx, v = Math.sin(a) * ry; o.push([x + u * c - v * s, y + u * s + v * c]); } return [o]; };
export const circ = (x, y, r, n = 48) => ell(x, y, r, r, 0, n);
export const ring = (x, y, r0, r1, n = 64) => [...circ(x, y, r1, n), [...circ(x, y, r0, n)[0]].reverse()];
export const arc = (x, y, r, a0, a1, n = 32, ry = r) => { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([x + Math.cos(a) * r, y + Math.sin(a) * ry]); } o.open = true; return o; };
export function arcBand(x, y, r0, r1, a0, a1, n = 24) { const o = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); o.push([x + Math.cos(a) * r1, y + Math.sin(a) * r1]); } for (let i = n; i >= 0; i--) { const a = lerp(a0, a1, i / n); o.push([x + Math.cos(a) * r0, y + Math.sin(a) * r0]); } return [o]; }
export function spiral(x, y, r0, r1, a0, turns, n = 48) { const o = []; for (let i = 0; i <= n; i++) { const t = i / n, a = a0 + turns * TAU * t, r = lerp(r0, r1, t); o.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } o.open = true; return o; }
export function ngon(x, y, r, n, rot = -Math.PI / 2, r2 = null) { const o = [], m = r2 === null ? n : n * 2; for (let i = 0; i < m; i++) { const a = rot + i / m * TAU, rr = r2 === null ? r : (i % 2 ? r2 : r); o.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); } return [o]; }
export const star = (x, y, r, r2, n, rot = -Math.PI / 2) => ngon(x, y, r, n, rot, r2);
// petal from (x,y) pointing along angle a
export function petal(x, y, len, wid, a, tip = 0.62) {
  const c = Math.cos(a), s = Math.sin(a), L = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  return [spl([[...L(0, 0), 1], L(len * 0.3, wid * 0.36), L(len * tip, wid * 0.5), [...L(len, 0), 1], L(len * tip, -wid * 0.5), L(len * 0.3, -wid * 0.36)], true, 8)];
}
// tapered limb polygon around a spine. widths: number[] sampled along the spine (full widths)
export function limb(pts, widths, { smooth = true, cap0 = true, cap1 = true, seg = 10 } = {}) {
  const sp = smooth && pts.length > 2 ? spl(pts, false, seg) : densify(pts, 14);
  const n = sp.length, L = [], R = [];
  const w = i => { const u = i / (n - 1) * (widths.length - 1), k = Math.min(widths.length - 2, Math.floor(u)); return widths.length === 1 ? widths[0] : lerp(widths[k], widths[k + 1], u - k); };
  for (let i = 0; i < n; i++) {
    const a = sp[Math.max(0, i - 1)], b = sp[Math.min(n - 1, i + 1)];
    let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const h = w(i) / 2;
    L.push([sp[i][0] - dy * h, sp[i][1] + dx * h]); R.push([sp[i][0] + dy * h, sp[i][1] - dx * h]);
  }
  const cap = (c, from, rad, out) => { const a0 = Math.atan2(from[1] - c[1], from[0] - c[0]); for (let k = 1; k < 8; k++) out.push([c[0] + Math.cos(a0 - k / 8 * Math.PI) * rad, c[1] + Math.sin(a0 - k / 8 * Math.PI) * rad]); };
  const o = [...L];
  if (cap1) cap(sp[n - 1], L[n - 1], w(n - 1) / 2, o);
  for (let i = n - 1; i >= 0; i--) o.push(R[i]);
  if (cap0) cap(sp[0], R[0], w(0) / 2, o);
  return [o];
}
export function densify(pts, per = 8) { const o = []; for (let i = 0; i < pts.length - 1; i++) for (let k = 0; k < per; k++) o.push([lerp(pts[i][0], pts[i + 1][0], k / per), lerp(pts[i][1], pts[i + 1][1], k / per)]); o.push([...pts[pts.length - 1]]); o.open = true; return o; }
export function resample(pl, step, closed = !pl.open) {
  const src = closed ? [...pl, pl[0]] : pl, o = [[...src[0]]]; let acc = 0;
  for (let i = 1; i < src.length; i++) {
    let [x0, y0] = src[i - 1]; const [x1, y1] = src[i]; let d = Math.hypot(x1 - x0, y1 - y0);
    while (acc + d >= step) { const t = (step - acc) / d; x0 = lerp(x0, x1, t); y0 = lerp(y0, y1, t); o.push([x0, y0]); d = Math.hypot(x1 - x0, y1 - y0); acc = 0; }
    acc += d;
  }
  if (!closed) o.open = true; return o;
}
export const plen = pl => { let s = 0; for (let i = 1; i < pl.length; i++) s += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); return s; };
// point + tangent angle at fraction t of a polyline
export function at(pl, t) {
  const L = plen(pl) * clamp(t); let acc = 0;
  for (let i = 1; i < pl.length; i++) { const d = Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]); if (acc + d >= L || i === pl.length - 1) { const k = d ? (L - acc) / d : 0; return [lerp(pl[i - 1][0], pl[i][0], k), lerp(pl[i - 1][1], pl[i][1], k), Math.atan2(pl[i][1] - pl[i - 1][1], pl[i][0] - pl[i - 1][0])]; } acc += d; }
  return [pl[0][0], pl[0][1], 0];
}
// the part of a polyline between fractions a..b
export function sub(pl, a, b) { const n = 40, o = []; for (let i = 0; i <= n; i++) { const p = at(pl, lerp(a, b, i / n)); o.push([p[0], p[1]]); } o.open = true; return o; }
// offset polyline sideways by d (positive = left of travel)
export function offset(pl, d) { const n = pl.length, o = []; for (let i = 0; i < n; i++) { const a = pl[Math.max(0, i - 1)], b = pl[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; const dd = typeof d === 'function' ? d(i / (n - 1)) : d; o.push([pl[i][0] + dy / l * dd, pl[i][1] - dx / l * dd]); } if (pl.open) o.open = true; return o; }
const isPL = p => p.length && typeof p[0][0] === 'number';
export function T(path, { x = 0, y = 0, s = 1, sx = 1, sy = 1, r = 0, ox = 0, oy = 0 } = {}) {
  if (isPL(path)) { const c = Math.cos(r), n = Math.sin(r); const o = path.map(([px, py]) => { const u = (px - ox) * s * sx, v = (py - oy) * s * sy; return [x + ox + u * c - v * n, y + oy + u * n + v * c]; }); if (path.open) o.open = true; return o; }
  return path.map(p => T(p, { x, y, s, sx, sy, r, ox, oy }));
}
export const mirrorX = (path, cx = 0) => { if (isPL(path)) { const o = path.map(([x, y]) => [2 * cx - x, y]); if (path.open) o.open = true; return o; } return path.map(p => mirrorX(p, cx)); };
export function bbox(path) { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const pl of (isPL(path) ? [path] : path)) for (const [x, y] of pl) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; } return { x: a, y: b, w: c - a, h: d - b, x1: c, y1: d, cx: (a + c) / 2, cy: (b + d) / 2 }; }
export function trace(ctx, path) { for (const pl of (isPL(path) ? [path] : path)) { if (!pl.length) continue; ctx.moveTo(pl[0][0], pl[0][1]); for (let i = 1; i < pl.length; i++) ctx.lineTo(pl[i][0], pl[i][1]); if (!pl.open) ctx.closePath(); } }
// SVG path string → path (array of polylines). Supports M L H V C S Q T A Z, absolute and relative.
export function svg(d, { x = 0, y = 0, s = 1, sx = 1, sy = 1, r = 0 } = {}, seg = 14) {
  const tok = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+\.?)(?:e[-+]?\d+)?/g) || []; let i = 0, cmd = '', X = 0, Y = 0, SX = 0, SY = 0, lc = null, lq = null, cur = null; const out = [];
  const num = () => parseFloat(tok[i++]); const isCmd = () => /[a-zA-Z]/.test(tok[i]);
  while (i < tok.length) {
    if (isCmd()) cmd = tok[i++]; const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), bx = rel ? X : 0, by = rel ? Y : 0;
    if (C === 'M') { X = bx + num(); Y = by + num(); SX = X; SY = Y; cur = [[X, Y]]; cur.open = true; out.push(cur); cmd = rel ? 'l' : 'L'; lc = lq = null; }
    else if (C === 'L') { X = bx + num(); Y = by + num(); cur.push([X, Y]); lc = lq = null; }
    else if (C === 'H') { X = bx + num(); cur.push([X, Y]); lc = lq = null; }
    else if (C === 'V') { Y = by + num(); cur.push([X, Y]); lc = lq = null; }
    else if (C === 'C' || C === 'S') { let x1, y1; if (C === 'C') { x1 = bx + num(); y1 = by + num(); } else { x1 = lc ? 2 * X - lc[0] : X; y1 = lc ? 2 * Y - lc[1] : Y; } const x2 = bx + num(), y2 = by + num(), x3 = bx + num(), y3 = by + num(); for (let k = 1; k <= seg; k++) { const t = k / seg, m = 1 - t; cur.push([m * m * m * X + 3 * m * m * t * x1 + 3 * m * t * t * x2 + t * t * t * x3, m * m * m * Y + 3 * m * m * t * y1 + 3 * m * t * t * y2 + t * t * t * y3]); } X = x3; Y = y3; lc = [x2, y2]; lq = null; }
    else if (C === 'Q' || C === 'T') { let x1, y1; if (C === 'Q') { x1 = bx + num(); y1 = by + num(); } else { x1 = lq ? 2 * X - lq[0] : X; y1 = lq ? 2 * Y - lq[1] : Y; } const x2 = bx + num(), y2 = by + num(); for (let k = 1; k <= seg; k++) { const t = k / seg, m = 1 - t; cur.push([m * m * X + 2 * m * t * x1 + t * t * x2, m * m * Y + 2 * m * t * y1 + t * t * y2]); } X = x2; Y = y2; lq = [x1, y1]; lc = null; }
    else if (C === 'A') { let rx = Math.abs(num()), ry = Math.abs(num()); const ph = num() * Math.PI / 180, fa = num(), fs = num(), x2 = bx + num(), y2 = by + num(); const c = Math.cos(ph), n = Math.sin(ph), dx = (X - x2) / 2, dy = (Y - y2) / 2, xp = c * dx + n * dy, yp = -n * dx + c * dy; const lam = xp * xp / rx / rx + yp * yp / ry / ry; if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); } const q = Math.sqrt(Math.max(0, (rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp) / (rx * rx * yp * yp + ry * ry * xp * xp))) * (fa === fs ? -1 : 1); const cxp = q * rx * yp / ry, cyp = -q * ry * xp / rx, cx = c * cxp - n * cyp + (X + x2) / 2, cy = n * cxp + c * cyp + (Y + y2) / 2; const th = Math.atan2((yp - cyp) / ry, (xp - cxp) / rx); let dt = Math.atan2((-yp - cyp) / ry, (-xp - cxp) / rx) - th; if (fs && dt < 0) dt += TAU; if (!fs && dt > 0) dt -= TAU; const N = Math.max(8, Math.ceil(Math.abs(dt) * 8)); for (let k = 1; k <= N; k++) { const a = th + dt * k / N; cur.push([cx + c * rx * Math.cos(a) - n * ry * Math.sin(a), cy + n * rx * Math.cos(a) + c * ry * Math.sin(a)]); } X = x2; Y = y2; lc = lq = null; }
    else if (C === 'Z') { cur.open = false; X = SX; Y = SY; lc = lq = null; }
    else throw new Error('svg cmd ' + cmd);
  }
  return T(out, { x, y, s, sx, sy, r });
}
// wavy / scalloped helper lines
export function wavy(x0, y0, x1, y1, amp, n, ph = 0, seg = 80) { const o = [], a = Math.atan2(y1 - y0, x1 - x0); for (let i = 0; i <= seg; i++) { const t = i / seg, w = Math.sin(t * n * TAU + ph) * amp; o.push([lerp(x0, x1, t) - Math.sin(a) * w, lerp(y0, y1, t) + Math.cos(a) * w]); } o.open = true; return o; }
export { lerp, clamp, rng, TAU };
