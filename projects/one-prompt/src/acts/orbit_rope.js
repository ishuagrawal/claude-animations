// The signal as a physical rope: verlet with moving pins (hard or soft), and a three-strand twisted silk renderer.
import { gl } from '../gl.js';
import { record } from '../sim.js';
import { clamp, lerp, TAU } from '../core.js';
// o: {n, len(t), pins(t) -> [[i, x, y, stiffness 0..1]], acc(t, i, u) -> [ax, ay], drag, init(i) -> [x, y], kicks: [[t, (i, u) -> [vx, vy]]], iter}
export function ropeSim(t0, t1, o) {
  const n = o.n, f = record(t0, t1, () => ({ p: Array.from({ length: n }, (_, i) => { const [x, y] = o.init(i, i / (n - 1)); return { x, y, px: x, py: y }; }), k: (o.kicks || []).map(() => false) }), (s, t, dt) => {
    const seg = o.len(t) / (n - 1), pins = o.pins(t), drag = Math.pow(o.drag ?? 0.06, dt), hard = {}; pins.forEach(p => { hard[p[0]] = p; });
    (o.kicks || []).forEach(([kt, fn], j) => { if (!s.k[j] && t >= kt) { s.k[j] = true; s.p.forEach((q, i) => { const v = fn(i, i / (n - 1)); q.px -= v[0] * dt; q.py -= v[1] * dt; }); } });
    s.p.forEach((q, i) => { const a = o.acc(t, i, i / (n - 1)), vx = clamp((q.x - q.px) * drag, -60, 60), vy = clamp((q.y - q.py) * drag, -60, 60); q.px = q.x; q.py = q.y; q.x += vx + a[0] * dt * dt; q.y += vy + a[1] * dt * dt; });
    const fix = () => { for (const p of pins) { const q = s.p[p[0]], k = p[3] ?? 1; q.x = lerp(q.x, p[1], k); q.y = lerp(q.y, p[2], k); } };
    fix(); for (let it = 0; it < (o.iter || 22); it++) { for (let i = 1; i < n; i++) { const A = s.p[i - 1], B = s.p[i], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6; let k = (d - seg) / d; if (k < 0) k *= o.push ?? 0.15; const ha = hard[i - 1] && (hard[i - 1][3] ?? 1) >= 1, hb = hard[i] && (hard[i][3] ?? 1) >= 1, wa = ha ? 0 : hb ? 1 : 0.5, wb = hb ? 0 : ha ? 1 : 0.5; A.x += dx * k * wa; A.y += dy * k * wa; B.x -= dx * k * wb; B.y -= dy * k * wb; } } fix();
  }, s => s.p.flatMap(q => [q.x, q.y]), 240, 2);
  return t => { const a = f(t), r = []; for (let i = 0; i < n; i++) r.push([a[i * 2], a[i * 2 + 1]]); return r; };
}
// Catmull-Rom resample with arc length: returns [[x, y, s, tx, ty]...]
export function resample(P, m) { const out = [], n = P.length; let s = 0; for (let k = 0; k <= m; k++) { const u = k / m * (n - 1), j = Math.min(n - 2, Math.floor(u)), f = u - j, a = P[Math.max(0, j - 1)], b = P[j], c = P[j + 1], d = P[Math.min(n - 1, j + 2)], cr = q => 0.5 * (2 * b[q] + (c[q] - a[q]) * f + (2 * a[q] - 5 * b[q] + 4 * c[q] - d[q]) * f * f + (3 * b[q] - a[q] - 3 * c[q] + d[q]) * f ** 3), x = cr(0), y = cr(1); if (k) s += Math.hypot(x - out[k - 1][0], y - out[k - 1][1]); out.push([x, y, s, 0, 0]); } out.forEach((p, k) => { const a = out[Math.max(0, k - 1)], b = out[Math.min(m, k + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; p[3] = (b[0] - a[0]) / l; p[4] = (b[1] - a[1]) / l; }); return out; }
// point at arc length s on a resampled line
export function atS(R, s) { let lo = 0, hi = R.length - 1; if (s <= 0) { const p = R[0]; return [p[0] + p[3] * s, p[1] + p[4] * s, p[3], p[4]]; } if (s >= R[hi][2]) { const p = R[hi], e = s - p[2]; return [p[0] + p[3] * e, p[1] + p[4] * e, p[3], p[4]]; } while (hi - lo > 1) { const m = (lo + hi) >> 1; R[m][2] <= s ? (lo = m) : (hi = m); } const a = R[lo], b = R[hi], k = (s - a[2]) / Math.max(1e-6, b[2] - a[2]); return [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[3], b[3], k), lerp(a[4], b[4], k)]; }
const STR = [['#ffc531', '#e0660c', '#fff0c0'], ['#fff3cf', '#ffae2a', '#ffffff'], ['#ffa51f', '#b8430a', '#ffe09a']];
// R: resampled screen-space line; w = rope radius px (number or fn(u)); phase = spin
export function drawRope(x, R, w, t, o = {}) {
  const G = gl(), m = R.length - 1, wf = typeof w === 'function' ? w : () => w, a = o.a ?? 1; if (m < 2 || a <= 0.01) return;
  const gw = wf(0.5); x.save(); x.lineCap = x.lineJoin = 'round'; x.beginPath(); R.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](p[0], p[1])); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 7; i++) { x.strokeStyle = `rgba(255,${150 + i * 8},40,${0.028 * a})`; x.lineWidth = gw * (7 - i * 0.85); x.stroke(); } x.restore();
  G.clear(); { const core = R.map((p, i) => [p[0], p[1], wf(i / m) * 0.86, 0.5, p[2]]); G.silk({ pts: core, c: ['#a8480a', '#6a2206', '#d9780f'], seed: 3, t, a }); } const runs = [[], []], K = o.k || 0.052; for (let k = 0; k < 3; k++) { let cur = null, sgn = 0; for (let i = 0; i <= m; i++) { const p = R[i], u = i / m, ww = wf(u), ph = p[2] * K * (14 / Math.max(6, gw)) + k * TAU / 3 - (o.spin || 0) + t * 1.5, z = Math.cos(ph), off = Math.sin(ph) * ww * 0.62, q = [p[0] - p[4] * off, p[1] + p[3] * off, ww * (0.2 + 0.56 * Math.sqrt(Math.abs(z))), 0.3 + Math.sin(ph) * 0.55, p[2] * 1.6 + k * 200]; const sg = z >= 0 ? 1 : 0; if (sg !== sgn || !cur) { if (cur) cur.pts.push(q); cur = { k, pts: cur ? [q] : [q] }; runs[sg].push(cur); sgn = sg; } else cur.pts.push(q); } }
  runs.forEach((L, f) => L.forEach(r => { if (r.pts.length > 1) G.silk({ pts: r.pts, c: f ? STR[r.k] : STR[r.k].map((c, j) => ['#c8640c', '#7a2a06', '#ffb84a'][j]), seed: 11 + r.k, t, a }); })); G.to(x);
}
