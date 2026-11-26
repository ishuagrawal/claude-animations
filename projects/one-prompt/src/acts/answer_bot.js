// Answer act: the robot's choreography. Pelvis path = stands, ballistic arcs and rides; limbs, spin, crouch and scarf follow on springs.
import { K, ink, circ, rr, rgba, mix, lg, rg, glow, TAU, clamp, lerp, hash, ease, key, noise, smooth } from '../ink.js';
import { gl } from '../gl.js';
import { bot } from '../bot.js';
import { spring, chain, ring, arc, record } from '../sim.js';
import { T, toS, smoothPts, hammer, HAMMER } from './answer_kit.js';
import { X, TOP, HITX, letterTop } from './answer_forge.js';
export const S = 0.54, A0 = T.a - 0.6, A1 = T.z;
const [b0, b1, b2, b3] = T.b;
// ---- comet
const CX1 = X(9); export const comet = t => { const k = t - T.hit; return [CX1 + k * 4020, -40 + (k < 0 ? -300 * ease.out2(clamp(-k / 0.7)) + Math.sin(t * 7) * 26 * clamp(-k * 3) : 0)]; };
// ---- segments: stand {F}, air {g}, fn {p}
export const SEG = [
  { a: A0, b: T.hit - 0.07, p: t => { const c = comet(t), k = ease.io2(clamp((t - T.a - 0.1) / 0.7)); return [c[0] - lerp(425, 330, k), c[1] + lerp(138, 24, k) + Math.sin(t * 9) * 10]; } },
  { a: T.hit - 0.07, b: T.hit + 0.32, g: 2900 },
  { a: T.hit + 0.32, b: b0 + 0.1, F: t => [X(2.9), letterTop(t, 3)] },
  { a: b0 + 0.1, b: b0 + 0.29, g: 2600 },
  { a: b0 + 0.29, b: b1 + 0.09, F: t => [X(8.5), letterTop(t, 8) + 8] },
  { a: b1 + 0.09, b: b1 + 0.29, g: 2200 },
  { a: b1 + 0.29, b: b2 + 0.07, F: t => [X(18.9), letterTop(t, 18) + 6] },
  { a: b2 + 0.07, b: b3, g: 6200 },
  { a: b3, b: b3 + 0.2, F: t => [X(15.5), letterTop(t, 15) + 4] },
  { a: b3 + 0.2, b: b3 + 0.62, g: 2300 },
  { a: b3 + 0.62, b: T.five - 0.2, F: t => [X(20.2), letterTop(t, 20) + 4] },
  { a: T.five - 0.2, b: T.five + 0.24, g: 2400 },
  { a: T.five + 0.24, b: A1, F: t => [X(20.2), letterTop(t, 20) + 4] },
];
export const addSegs = list => { const i = SEG.length - 1; SEG[i].b = list[0].a; SEG.push(...list); };
const segAt = t => { let lo = 0, hi = SEG.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; t >= SEG[m].a ? (lo = m) : (hi = m - 1); } return SEG[lo]; };
export const KEYS = { crouch: [[A0, 1], [T.hit + 0.2, 1], [T.hit + 0.5, 0.82], [b0 - 0.3, 0.86], [b0 - 0.12, 1.0, ease.out2], [b0, 0.6, ease.in2], [b0 + 0.1, 0.96], [b0 + 0.3, 0.72], [b1 - 0.1, 0.98], [b1, 0.6, ease.in2], [b1 + 0.08, 0.96], [b1 + 0.3, 0.7], [b2 - 0.08, 0.98], [b2, 0.58, ease.in2], [b2 + 0.07, 1.0], [b3 - 0.02, 1], [b3 + 0.04, 0.44, ease.out2], [b3 + 0.2, 0.98], [b3 + 0.6, 0.9], [b3 + 0.75, 0.66], [T.lock, 0.94], [T.five - 0.36, 0.94], [T.five - 0.24, 0.62], [T.five - 0.18, 1], [T.five + 0.26, 0.94], [T.five + 0.36, 0.7], [T.five + 0.6, 0.96]],
  rot: [[A0, 0.98], [T.a + 0.1, 0.98], [T.a + 0.8, 1.18], [T.hit - 0.08, 1.18], [T.hit + 0.3, TAU, ease.sine], [b0 - 0.1, TAU - 0.1], [b0, TAU + 0.16, ease.in2], [b0 + 0.2, TAU], [b1 - 0.1, TAU - 0.1], [b1, TAU + 0.16, ease.in2], [b1 + 0.2, TAU], [b2 - 0.06, TAU - 0.1], [b2, TAU + 0.18, ease.in2], [b2 + 0.06, TAU], [b3, 0, ease.lin], [b3 + 0.04, -0.16], [b3 + 0.2, 0], [b3 + 0.4, 0.3], [b3 + 0.65, 0], [T.open, -0.06], [T.five - 0.3, -0.04], [T.five - 0.1, 0.14], [T.five + 0.15, 0.0]],
  yaw: [[A0, 1.0], [b2 + 0.06, 0.95], [b3 - 0.08, -0.95], [b3 + 0.8, -0.75], [T.open + 0.2, -0.55], [T.five - 0.5, -0.5], [T.five - 0.28, 0.6], [T.five + 0.5, 0.5]],
  lean: [[A0, 0], [T.hit, 0], [b0 - 0.12, -0.16], [b0, 0.2, ease.in2], [b0 + 0.2, 0], [b1 - 0.12, -0.16], [b1, 0.22, ease.in2], [b1 + 0.2, 0], [b2 - 0.1, -0.16], [b2, 0.22, ease.in2], [b2 + 0.2, 0], [b3 - 0.2, 0.14], [b3, -0.24, ease.in2], [b3 + 0.4, 0]],
  head: [[A0, -0.7], [T.hit - 0.1, -0.7], [T.hit + 0.3, 0], [b0 - 0.1, -0.1], [b0 + 0.05, 0.12], [b1 - 0.1, -0.1], [b1 + 0.05, 0.12], [b2 - 0.1, -0.1], [b2 + 0.05, 0.12], [b3 + 0.05, -0.14], [b3 + 0.7, 0.1], [T.open, 0.06], [T.five, -0.1], [T.five + 0.5, 0]],
  hands: [[A0, [300, -330, 250, -340]], [T.hit - 0.08, [300, -330, 250, -340]], [T.hit + 0.06, [-160, -220, 170, -240]], [T.hit + 0.3, [-190, -200, 190, -200]], [T.pull - 0.14, [-60, -330, 110, -330]], [b3 + 0.75, [-150, -60, 150, -60]], [T.lock + 0.1, [-176, -120, 176, -110]], [T.open, [-200, -150, 200, -140]], [T.open + 0.24, [-190, -330, 196, -330]], [T.five - 0.4, [-190, -300, 190, -280]], [T.five - 0.16, [-170, -120, 120, -180]], [T.five, [-190, -120, 214, -316], ease.in2], [T.five + 0.2, [-190, -140, 200, -240]], [T.five + 0.6, [-170, -80, 170, -80]]] };
export const addKeys = o => Object.entries(o).forEach(([k, v]) => { KEYS[k].push(...v); KEYS[k].sort((a, b) => a[0] - b[0]); });
// springs are built on first use, after every act section has added its keys
const lazy = f => { let g = null; return t => (g ??= f())(t); };
const crKicks = []; export const landKick = (t, v) => crKicks.push([t, v]);
[[T.hit + 0.3, -8], [b0 + 0.29, -4], [b1 + 0.29, -5], [b3, -9], [b3 + 0.62, -5], [T.five + 0.24, -6]].forEach(q => crKicks.push(q));
export const crouch = lazy(() => spring(A0, A1, t => key(t, KEYS.crouch), 30, 0.46, crKicks));
export const ROTF = []; const rotT = t => { const f = ROTF.find(([a, b]) => t >= a && t < b); return f ? f[2](t) : key(t, KEYS.rot); };
export const rotS = lazy(() => spring(A0, A1, rotT, 34, 0.62));
export const yawS = lazy(() => spring(A0, A1, t => key(t, KEYS.yaw), 20, 0.8));
export const leanS = lazy(() => spring(A0, A1, t => key(t, KEYS.lean), 26, 0.5));
export const headS = lazy(() => spring(A0, A1, t => key(t, KEYS.head), 20, 0.4));
export const handS = lazy(() => spring(A0, A1, t => key(t, KEYS.hands), 26, 0.46));
const standP = (s, t) => { const f = s.F(t), r = rotS(t), c = crouch(t) * 158 * S; return [f[0] + Math.sin(r) * c, f[1] - Math.cos(r) * c]; };
const raw = (s, t) => (s.F ? standP(s, t) : s.p(t));
export function body(t) { const s = segAt(t); if (s.g == null) return raw(s, t); const i = SEG.indexOf(s), p = SEG[i - 1], n = SEG[i + 1]; return arc(t, s.a, p.g != null ? body(s.a - 1e-4) : raw(p, s.a), s.b, n.g != null ? arcEnd(n, s.b) : raw(n, s.b), s.g); }
const arcEnd = (n, t) => raw(n, t); // consecutive arcs are joined through an fn segment
export const airborne = t => { const s = segAt(t); return !s.F; };
// local <-> world
export const toL = (t, w, sc = scaleAt(t)) => { const b = body(t), r = rotS(t), dx = (w[0] - b[0]) / sc, dy = (w[1] - b[1]) / sc, c = Math.cos(r), s = Math.sin(r); return [dx * c + dy * s, -dx * s + dy * c]; };
export const toW = (t, l, sc = scaleAt(t)) => { const b = body(t), r = rotS(t), c = Math.cos(r), s = Math.sin(r); return [b[0] + (l[0] * c - l[1] * s) * sc, b[1] + (l[0] * s + l[1] * c) * sc]; };
let SCALE = [[A0, S]]; export const setScale = k => (SCALE = k); export const scaleAt = t => key(t, SCALE);
// world targets for hands: [t0, t1, which(0|1|2=both), fn(t)->[x,y], offset]
export const GRABS = []; export const FISTS = [[A0, T.hit - 0.12]];
// ---- hammer in the hands: [grip x, grip y, angle], keyed (contact must be exact)
const STR = [146, -4, 0.62], UPP = [-34, -336, -2.5];
export const HAM = [[T.pull, [70, -290, -1.1]], [T.pull + 0.2, [118, -96, -0.5], ease.out2], [b0 - 0.36, [126, -130, -0.9]], [b0 - 0.13, UPP, ease.io2], [b0 - 0.06, [-40, -340, -2.62]], [b0, STR, ease.in2], [b0 + 0.05, [140, -30, 0.4]], [b0 + 0.14, [124, -80, -0.1]], [b1 - 0.12, UPP, ease.io2], [b1 - 0.05, [-40, -340, -2.62]], [b1, STR, ease.in2], [b1 + 0.05, [140, -30, 0.4]], [b1 + 0.14, [124, -80, -0.1]], [b2 - 0.12, UPP, ease.io2], [b2 - 0.05, [-40, -340, -2.62]], [b2, STR, ease.in2], [b2 + 0.05, [140, -30, 0.4]], [b2 + 0.16, [90, -250, -1.2]], [b3 - 0.14, [-40, -340, -2.5]], [b3 - 0.06, [-44, -344, -2.7]], [b3, STR, ease.in2], [b3 + 0.06, [140, -34, 0.44]], [b3 + 0.2, [120, -90, 0]], [b3 + 0.5, [96, -190, -1.3]], [b3 + 0.85, [60, -230, -2.4]]];
export const HELD = [[T.pull, T.lock + 0.12]]; // intervals the hammer is in the hands
export const heldAt = t => HELD.some(([a, b]) => t >= a && t < b);
export const hamLocal = t => { const [gx, gy, a] = key(t, HAM), f = yawS(t) >= 0 ? 1 : -1; return [gx * f, gy, f > 0 ? a : Math.PI - a, f]; };
export const hamWorld = t => { const h = hamLocal(t), p = toW(t, h); return [p[0], p[1], h[2] + rotS(t)]; };
// ---- full pose
export const EYES = [];
const nr = r => ((r + Math.PI) % TAU + TAU) % TAU - Math.PI;
const antS = lazy(() => spring(A0, A1, t => { const e = 0.02, a = body(t - e), b = body(t + e), vx = (b[0] - a[0]) / (2 * e), vy = (b[1] - a[1]) / (2 * e); return [clamp(-vx * 0.00022, -0.7, 0.7) - nr(rotS(t)) * 0.15, clamp(-vx * 0.0003 + vy * 0.0004, -1.3, 1.3)]; }, 20, 0.18));
export function draw(x, t, o = {}) {
  const p = body(t), r = rotS(t), sc = scaleAt(t), s = segAt(t), yaw = yawS(t), h = handS(t).slice(), hm = heldAt(t), L = hm ? hamLocal(t) : null; let fists = FISTS.some(([a, b]) => t >= a && t < b) ? [1, 1] : [0, 0];
  if (hm) { const c = Math.cos(L[2]), q = Math.sin(L[2]), k = smooth(T.pull, T.pull + 0.04, t) ; const g1 = [L[0], L[1]], g0 = [L[0] - c * 70, L[1] - q * 70], nr2 = L[3] > 0 ? [g0, g1] : [g1, g0]; h[0] = nr2[0][0]; h[1] = nr2[0][1]; h[2] = nr2[1][0]; h[3] = nr2[1][1]; fists = [1, 1]; }
  GRABS.forEach(([a, b, w, fn]) => { const k = ease.io2(clamp((t - a + 0.09) / 0.09)) * (1 - ease.io2(clamp((t - b) / 0.1))); if (k <= 0) return; const q = toL(t, fn(t), sc); [0, 1].forEach(i => { if (w !== 2 && w !== i) return; const d = w === 2 ? (i ? 16 : -16) : 0; h[i * 2] = lerp(h[i * 2], q[0] + d, k); h[i * 2 + 1] = lerp(h[i * 2 + 1], q[1], k); if (k > 0.5) fists[i] = 1; }); });
  let feet; if (s.F) { const f = s.F(t), l = toL(t, f, sc); const sp = 62 + (1 - clamp(crouch(t), 0.4, 1)) * 50; feet = [[l[0] - sp, l[1], -r * 0], [l[0] + sp, l[1] - 2, 0]]; } else { const u = clamp((t - s.a) / (s.b - s.a)), tk = s.p ? 0.5 : Math.sin(u * Math.PI), sw = Math.sin(t * 13) * 12; feet = [[-58 - tk * 20, 150 - tk * 60 + sw * 0.4, 0.5 * tk], [54 + tk * 10, 152 - tk * 30 - sw * 0.4, 0.3 * tk]]; if (s.trail) { feet = [[-46 + sw, 168, 0.5], [40 - sw, 172, 0.4]]; } }
  const ey = EYES.filter(([a, b]) => t >= a && t < b), eyes = {}; ey.forEach(([a, b, k, v]) => { eyes[k] = Math.max(eyes[k] || 0, (v ?? 1) * clamp((t - a) / 0.1) * clamp((b - t) / 0.12)); }); const an = antS(t), lk = o.look || [0.35, 0];
  if (o.backHammer) { x.save(); x.translate(...p); x.rotate(r); x.scale(sc, sc); x.translate(-30 * Math.sign(Math.sin(yaw)), -60); x.rotate(-2.0 + (yaw < 0 ? 0.9 : 0)); hammer(x, 0); x.restore(); }
  bot(x, { p, s: sc, rot: r, yaw, lean: leanS(t), t, sq: o.sq || 0, head: headS(t) - nr(r) * 0.3 * (s.F ? 0 : 1) * (Math.abs(nr(r)) < 1.3 ? 1 : 0), headYaw: o.headYaw || 0.08, feet, hands: [[h[0], h[1], fists[0] ? 'fist' : 'open'], [h[2], h[3], fists[1] ? 'fist' : 'open']], eyes, look: lk, blink: (t % 2.9) > 2.8 ? 0.1 : 1, ant: [clamp(an[0], -0.9, 0.9), clamp(an[1], -1.4, 1.4)], key: o.key || '#bfffe8', fill: o.fill || '#6fb8ff', jet: o.jet || 0, on: 1, hold: hm ? c => { c.save(); c.translate(L[0], L[1]); c.rotate(L[2]); if (L[3] < 0) c.scale(1, -1); hammer(c, o.heat || 0); c.restore(); } : null });
}
// ---- scarf
const neck = t => { const p = body(t), r = rotS(t), c = 212 * scaleAt(t); return [p[0] + Math.sin(r) * c, p[1] - Math.cos(r) * c]; };
const vel = t => { const e = 0.03, a = body(t - e), b = body(t + e); return [(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e)]; };
export const WIND = []; // extra wind [t0, t1, ax, ay]
const strips = [0, 1].map(i => lazy(() => chain(A0, A1, t => { const n = neck(t); return [n[0] - 14 * Math.sign(Math.sin(yawS(t)) || 1), n[1] + 6 + i * 8]; }, 13, 23 - i * 3, { wind: t => { const v = vel(t); let ax = -clamp(v[0], -2600, 2600) * 2.2 - 420 * Math.sign(Math.sin(yawS(t)) || 1), ay = 760 + i * 260 - clamp(v[1], -2000, 2000) * 1.0; WIND.forEach(([a, b, wx, wy]) => { if (t > a && t < b) { ax += wx; ay += wy; } }); return [ax, ay]; }, flutter: [3600 + i * 1200, 19 + i * 4, 0.85], drag: 0.02, dir: [-1, 0.1] })));
export function scarf(x, t, w, a = 1) { const G = gl(); G.clear(); [1, 0].forEach(i => { const pts = smoothPts(strips[i](t), 46, (px, py, v, k) => { const q = toS(w, px, py); return [q[0], q[1], (13 + v * 13) * w.z * (scaleAt(t) / S) * (v > 0.96 ? Math.max(0.04, (1 - v) * 25) : 1), Math.sin(v * 7 - t * 15 + i) * 0.7, k * 9]; }); G.silk({ pts, c: ['#ff6f6a', '#b3165e', '#ffd2b0'], seed: 9 + i, t }); }); G.to(x, a); }
export const handW = (t, i) => { const h = handS(t); return toW(t, [h[i * 2], h[i * 2 + 1]]); };
