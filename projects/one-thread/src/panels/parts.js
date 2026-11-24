// Shared hero parts for the opening, the medallion and the ending.
import { spl, blob, poly, limb, circ, ell, curve, line, spiral, petal, at, offset, lerp, clamp, TAU, rng, rect, arcBand } from '../art/geom.js';
import * as P from '../art/patterns.js';

// ---- flame: a tongue cluster, phase ph 0..1 loops
export function flame(A, ph, { n = 7, w = 420, h = 520, cols = [['#5a0f06', '#8f1c08'], ['#97230a', '#c24a0c'], ['#c2560c', '#dd8a18'], ['#dd9a22', '#f2c850']], seed = 4 } = {}) {
  const s = k => Math.sin(ph * TAU + k), R = rng(seed); const params = Array.from({ length: n * 4 }, () => R());
  cols.forEach((c, layer) => { const k = 1 - layer * 0.21, m = Math.max(2, n - layer * 2); for (let i = 0; i < m; i++) { const u = m === 1 ? 0 : i / (m - 1) * 2 - 1, p = params[layer * n + i], x0 = u * w * 0.30 * k, H = h * k * (0.55 + 0.45 * (1 - u * u)) * (0.85 + 0.2 * p), wob = s(p * 9 + layer), wob2 = s(p * 5 + 2 + layer * 1.3), bw = w * 0.15 * k * (1.1 - Math.abs(u) * 0.35);
    const sp = [[x0, 8], [x0 + wob * 14 - u * 14, -H * 0.3], [x0 + wob2 * 30 - u * 34, -H * 0.62], [x0 + wob * 46 - u * 40 + wob2 * 16, -H * 0.88], [x0 + wob * 64 - u * 30 + wob2 * 34, -H]];
    A.part(limb(sp, [bw * 1.5, bw * 1.9, bw * 1.35, bw * 0.62, 2], { seg: 10 }), { fill: [c[0], c[1]].reverse(), halo: 2.5, raise: 0.45, gold: layer > 2 ? 0.4 : 0, order: lerp(0.1, 0.9, (i + layer) / (m + 4)), lines: [{ flow: { gap: 13, w: 3, margin: 5, minLen: 20, field: [{ guide: curve(sp), w: 1, fall: 400 }] } }] }); } });
}
// ---- a blown-pigment hand stencil / print, palm facing, fingers up, ~300 tall
export function handPrint(A, { fill = '#8a2f14', spread = 1, thumb = 1, lines = true, halo = 2, ...st } = {}) {
  const f = (x, y, a, l, w) => limb([[x, y], [x + Math.sin(a) * l * 0.55, y - Math.cos(a) * l * 0.55], [x + Math.sin(a * 1.15) * l, y - Math.cos(a * 1.15) * l]], [w, w * 0.96, w * 0.8], { seg: 6 });
  const parts = [f(-44, -86, -0.24 * spread, 108, 36), f(-14, -98, -0.07 * spread, 128, 38), f(18, -96, 0.08 * spread, 120, 37), f(46, -80, 0.24 * spread, 94, 33), limb([[-52 * thumb, -20], [-92 * thumb, -58], [-112 * thumb, -100]], [42, 38, 30], { seg: 6 })];
  const palm = blob([[-58, -80], [-30, -100], [30, -100], [58, -78], [60, -20], [40, 40], [0, 54], [-42, 40], [-62, -10]]);
  for (const p of parts) A.part(p, { fill, halo, ...st });
  A.part(palm, { fill, halo: 0, noKnock: true, ...st, lines: lines ? [{ strokes: [spiral(0, -24, 34, 5, 0.4, 2.1, 50)], w: 6, taper: 0.15 }, { strokes: [curve([[-46, 20], [-10, 34], [44, 10]])], w: 5, taper: 0.3 }] : [] });
}
// ---- hero hand: upright, palm to viewer, richly ornamented. ~620 tall, wrist at (0,0). k=1 thumb on the left (viewer's) side.
// returns fingertip anchors {thumb,index,middle,ring,little} in local coords (before A.at)
export const HERO_TIPS = { thumb: [-166, -236], index: [-92, -470], middle: [-14, -506], ring: [64, -478], little: [134, -398] };
export function heroHand(A, { skin = ['#3b1c0d', '#5a2f14'], ink = '#e9d3a0', accent = '#b3331c', gold = '#d8a130', cuff = null, pattern = 0, child = 0, ...st } = {}) {
  const ln = (p, w = 4, t = 0.25, c) => ({ strokes: p, w, taper: t, ...(c ? { ink: c } : {}) });
  const F = (base, mid, tip, w, o = {}) => { const path = limb([base, mid, tip], [w * 1.04, w, w * 0.9, w * 0.72], { seg: 12 }); const sp = spl([base, mid, tip], false, 14), rings = [0.36, 0.40, 0.63, 0.67].map(u => { const [x, y, a] = at(sp, u); return curve([[x - Math.sin(a) * w * 0.6, y + Math.cos(a) * w * 0.6], [x - Math.cos(a) * 6, y - Math.sin(a) * 6], [x + Math.sin(a) * w * 0.6, y - Math.cos(a) * w * 0.6]]); });
    const [tx, ty, ta] = at(sp, 0.9); const nail = ell(tx + Math.cos(ta) * 4, ty + Math.sin(ta) * 4, w * 0.26, w * 0.2, ta, 20);
    A.part(path, { fill: [skin[1], skin[0]], halo: 4, ...st, lines: [ln(rings, 4, 0.2), { strokes: [sub2(sp, 0.08, 0.3)], w: 3.4, taper: 0.3 }, { dots: [0.48, 0.52, 0.56].map(u => { const [x, y] = at(sp, u); return [x, y, 3.4]; }) }, { shape: nail, ink: '#c08a58', rule: 'nonzero' }] });
    if (o.band) { const [x, y, a] = at(sp, 0.2); A.part(limb([[x - Math.sin(a) * w * 0.56, y + Math.cos(a) * w * 0.56], [x + Math.sin(a) * w * 0.56, y - Math.cos(a) * w * 0.56]], [13], { smooth: false, cap0: false, cap1: false }), { fill: gold, gold: 1, halo: 2, raise: 1, ...st }); } };
  const sub2 = (pl, a, b) => { const o = []; for (let i = 0; i <= 14; i++) { const q = at(pl, lerp(a, b, i / 14)); o.push([q[0], q[1]]); } o.open = true; return o; };
  // forearm, palm, then the fingers over it so every crease is a resist line
  A.part(limb([[6, 270], [4, 120], [2, -30]], [176, 158, 156], { cap0: false, cap1: false }), { fill: [skin[1], skin[0]], halo: 4, ...st, lines: [ln([curve([[-44, 260], [-40, 120], [-34, 20]]), curve([[56, 260], [50, 120], [40, 20]])], 4, 0.2), { strokes: [curve([[-90, 60], [2, 84], [92, 60]]), curve([[-90, 92], [2, 116], [92, 92]]), curve([[-90, 124], [2, 148], [92, 124]])], w: 4.5 }, { dots: Array.from({ length: 10 }, (_, i) => [-68 + i * 15.5, 79 + Math.sin(i / 9 * 3.14) * 22, 4.2]) }, { dots: Array.from({ length: 10 }, (_, i) => [-68 + i * 15.5, 111 + Math.sin(i / 9 * 3.14) * 22, 4.2]) }] });
  if (cuff) cuff(A);
  const palm = [spl([[-100, -190], [-70, -226], [-30, -238], [0, -240], [60, -232], [104, -200], [116, -150], [112, -80], [96, -20], [80, 20], [-72, 20], [-92, -24], [-104, -90]], true, 10)];
  A.part(palm, { fill: [skin[1], skin[0]], halo: 4, ...st, lines: [ln([curve([[-98, -150], [-60, -168], [-10, -160], [40, -168], [112, -190]])], 4.5, 0.25), { strokes: [spiral(8, -92, 60, 9, 0.2, 2.6, 80)], w: 6, taper: 0.12 }, { dots: P.ringDots(8, -92, 74, 18, 4.2) }, { strokes: [curve([[-80, 2], [0, 18], [86, -4]])], w: 4, taper: 0.3 }, { dots: Array.from({ length: 8 }, (_, i) => [-84 + i * 25, -184 + Math.abs(i - 3.5) * 2, 3.6]) }] });
  F([104, -176], [126, -288], HERO_TIPS.little, 58); F([58, -208], [66, -350], HERO_TIPS.ring, 66, { band: pattern % 2 === 0 }); F([-4, -214], [-8, -372], HERO_TIPS.middle, 70); F([-64, -200], [-80, -342], HERO_TIPS.index, 66, { band: pattern % 3 === 1 });
  F([-66, -24], [-142, -122], HERO_TIPS.thumb, 74);
  if (accent) A.part(circ(8, -92, 11, 24), { fill: accent, halo: 3, raise: 1, ...st });
}
// ---- four-diamond string figure between two points (left/right centre), returns polylines (x,y,z)
export function stringFigure(xl, xr, yc, hh, { diamonds = 4, t = 0, open = 1 } = {}) {
  const out = [], n = diamonds * 2, W = xr - xl; const z = (i, k) => 26 + ((i + k) % 2 ? 7 : -5);
  const seg = (a, b, m = 14) => Array.from({ length: m + 1 }, (_, i) => a.map((v, d) => lerp(v, b[d], i / m)));
  for (const k of [-1, 1]) out.push(seg([xl, yc + k * hh * 0.9, 30], [xr, yc + k * hh * 0.9, 30], 60).map((p, i) => [p[0], p[1] + Math.sin(i / 60 * Math.PI) * -k * hh * 0.16 * open, p[2]]));
  for (const k of [-1, 1]) { const p = []; for (let i = 0; i <= n; i++) { const x = xl + W * i / n, y = yc + ((i % 2 ? 1 : -1) * k) * hh * (0.74) * open * (i === 0 || i === n ? 0.5 : 1); p.push([x, y, z(i, k > 0 ? 1 : 0)]); } const q = []; for (let i = 0; i < n; i++) q.push(...seg(p[i], p[i + 1], 12).slice(0, -1)); q.push(p[n]); out.push(q); }
  return out;
}
// ---- generic running quadruped, facing +x, feet at y=0. Parameterised silhouettes, flow-carved.
export function quad(A, ph, { fill = ['#5a2a12', '#3a1c0c'], L = 300, H = 230, depth = 120, neckL = 120, neckA = -50, headL = 92, legW = [40, 20, 13], stride = 78, lift = 46, horns, tail, hump = 0, gap = 14, field = [], extra, gallop = 1, hoof = '#1c0f08', ear = 1 } = {}) {
  const c = k => Math.cos((ph + k) * TAU), s = k => Math.sin((ph + k) * TAU), bob = -Math.abs(s(0.1)) * 10 * gallop, D = Math.PI / 180;
  const leg = (x, k, front, shade) => { const hy = -H + depth * 0.62 + bob, fx = x + s(k) * stride, fy = -Math.max(0, c(k)) * lift, kx = lerp(x, fx, 0.5) + (front ? 12 : -16) * (0.4 + Math.max(0, c(k))), ky = lerp(hy, fy, 0.52); A.part(limb([[x, hy], [kx, ky], [fx, fy - 6]], legW, { seg: 8 }), { fill: shade ? fill[1] : fill, halo: 3 }); A.part(poly([[fx - 9, fy - 10], [fx + 9, fy - 10], [fx + 13, fy], [fx - 9, fy]]), { fill: hoof, halo: 1 }); };
  leg(L * 0.34, 0.12, true, 1); leg(-L * 0.36, 0.62, false, 1);
  if (tail) tail(A, [-L * 0.48, -H + depth * 0.15 + bob], ph);
  const y0 = -H + bob, nx = L * 0.42, ny = y0 + 6, hx = nx + Math.cos(neckA * D) * neckL, hy = ny + Math.sin(neckA * D) * neckL + s(0.3) * 6 * gallop, hd = (neckA + 78) * D, u = [Math.cos(hd), Math.sin(hd)], v = [-u[1], u[0]]; const q = (a, b) => [hx + u[0] * a + v[0] * b, hy + u[1] * a + v[1] * b];
  const body = [spl([[-L * 0.5, y0 + depth * 0.34], [-L * 0.44, y0 + depth * 0.04], [-L * 0.2, y0 + 2], [L * 0.06, y0 + 4 - hump * 0.6], [L * 0.28, y0 - 8 - hump], [nx - 10, ny - 18], q(-30, -26), q(0, -30), q(headL * 0.5, -22), q(headL, -14), q(headL + 8, 4), q(headL * 0.86, 18), q(headL * 0.4, 24), q(0, 34), [nx + 26, ny + depth * 0.34], [L * 0.46, y0 + depth * 0.62], [L * 0.3, y0 + depth * 0.98], [0, y0 + depth * 1.0], [-L * 0.28, y0 + depth * 0.9], [-L * 0.46, y0 + depth * 0.74]], true, 8)];
  A.part(body, { fill, halo: 3, lines: [{ flow: { gap, w: gap * 0.26, margin: 6, minLen: 18, field: [{ contour: 0.7 }, { vortex: [-L * 0.3, y0 + depth * 0.46, depth * 0.36, 1], w: 1.7 }, { vortex: [L * 0.27, y0 + depth * 0.44, depth * 0.36, -1], w: 1.7 }, ...field] } }] });
  if (ear) A.part(petal(q(-14, -20)[0], q(-14, -20)[1], 34, 18, hd - 2.2), { fill: fill[0], halo: 2 });
  const e = q(headL * 0.28, -6); A.part(circ(e[0], e[1], 8, 18), { fill: '#efe0bd', halo: 3 }); A.part(circ(e[0] + 1, e[1], 4.4, 14), { fill: '#1c0f08', halo: 0 });
  if (horns) horns(A, q, hd);
  leg(L * 0.3, -0.1 + (gallop ? 0.12 : 0.5), true, 0); leg(-L * 0.32, 0.5, false, 0);
  if (extra) extra(A, { q, y0, L, H, depth, bob });
}
