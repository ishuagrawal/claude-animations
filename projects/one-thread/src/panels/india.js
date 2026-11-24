// India — block-printed and painted cotton (kalamkari / ajrakh). The thread is spun on a charkha, becomes the border of
// a sari, and garlands the elephant that three carved blocks (iron black, madder, indigo) have just printed into life.
import { spl, blob, poly, rect, rrect, limb, circ, ell, ring, arc, arcBand, curve, line, spiral, petal, star, T, at, sub, offset, wavy, resample, lerp, clamp, TAU, rng } from '../art/geom.js';
import * as P from '../art/patterns.js';
import { figure, headProfile, hand, hair, joints, SKIN, POSE, pol } from '../art/figures.js';
import { seg, ease, key, hash } from '../core.js';
import { defaultKeys } from '../light.js';

const K = '#1b0e0a', R = '#a12a1b', Rd = '#6b1511', Pk = '#c9694c', I = '#1f3a70', Id = '#13203f', Bl = '#5f86b4', Y = '#d89a1e', Yl = '#eebd4c', G = '#54722d', Gd = '#2c4a2a', W = '#f2e3bd', O = '#c8772a';
const D = Math.PI / 180;
// --- kalamkari mark: dyed shape + iron-black outline. Orders follow the print passes (black, then red/yellow, then blue/green)
const PASS = { [K]: 0.04, [R]: 0.4, [Rd]: 0.38, [Pk]: 0.42, [Y]: 0.5, [Yl]: 0.52, [O]: 0.48, [W]: 0.3, [I]: 0.78, [Id]: 0.76, [Bl]: 0.82, [G]: 0.86, [Gd]: 0.86 };
const passOf = f => PASS[typeof f === 'string' ? f : Array.isArray(f) ? f[0] : f && f.stops ? f.stops[0] : ''] ?? 0.6;
function ink(A, path, o = {}) {
  if (path.length && typeof path[0][0] === 'number') path = [path];
  A.part(path, { halo: 2, order: passOf(o.fill), ...o });
  if (o.ow !== 0) for (const pl of path) A.stroke(pl, { w: o.ow || 2.2, color: o.oc || K, halo: 0, noKnock: true, order: o.ko ?? 0.05, raise: o.raise || 0, gold: o.og || 0 });
}
const kline = (A, pl, w = 2, o = {}) => A.stroke(pl, { w, color: K, halo: 0, noKnock: true, order: 0.06, ...o });
const bloom = (A, x, y, r, cols, n = 8, o = {}) => { // layered print flower
  cols.forEach((c, j) => { const rr = r * (1 - j * 0.3); for (let i = 0; i < n; i++) ink(A, [petal(x, y, rr, rr * 1.9 * Math.PI / n * 0.62, o.rot || 0 + (i + (j % 2) * 0.5) / n * TAU, 0.66)].flat().length ? petal(x, y, rr, rr * 3.7 / n, (o.rot || 0) + (i + (j % 2) * 0.5) / n * TAU, 0.66) : [], { fill: c, ow: 1.5, halo: 1, ...o.st }); });
  ink(A, circ(x, y, r * 0.22, 18), { fill: o.eye || Yl, ow: 1.5, halo: 0.6, ...o.st }); A.dots(P.ringDots(x, y, r * 0.12, 5, r * 0.035), { color: K, halo: 0, noKnock: true, order: 0.06 });
};
const leafAt = (A, x, y, l, w, a, c, o = {}) => ink(A, petal(x, y, l, w, a, 0.5), { fill: c, ow: 1.5, halo: 1.2, lines: [{ strokes: [line([x + Math.cos(a) * l * 0.12, y + Math.sin(a) * l * 0.12], [x + Math.cos(a) * l * 0.86, y + Math.sin(a) * l * 0.86])], w: 1.6 }], ...o });
function ik(a, b, l1 = 66, l2 = 62, k = 1) { const dx = b[0] - a[0], dy = b[1] - a[1], d = Math.min(Math.hypot(dx, dy), l1 + l2 - 0.5), base = Math.atan2(dy, dx), A = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1)) * k, e = [a[0] + Math.cos(base + A) * l1, a[1] + Math.sin(base + A) * l1]; return [(base + A) / D, Math.atan2(b[1] - e[1], b[0] - e[0]) / D]; }
// multifoil arch edge from left spring to right spring
function cusped(x0, x1, ys, ya, n = 9) { const cx = (x0 + x1) / 2, w = (x1 - x0) / 2, pts = []; for (let i = 0; i <= n; i++) { const u = i / n * 2 - 1, f = Math.abs(u); pts.push([cx + Math.sign(u) * w * Math.sin(f * Math.PI / 2) ** 1.0, lerp(ya, ys, 1 - Math.sqrt(Math.max(0, 1 - Math.pow(f, 1.7))) * (1 - 0.16 * (1 - f)) - 0.0)]); } const o = []; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); for (let k = 0; k < 8; k++) { const t = k / 8, h = Math.sin(t * Math.PI) * l * 0.3; o.push([a[0] + dx * t + dy / l * h, a[1] + dy * t - dx / l * h]); } } o.push(pts[n]); o.open = true; return o; }
// quad cloth mapping for the caparison
const jTop = u => -408 - 18 * Math.sin(Math.PI * (u * 0.9 + 0.08));
const jq = (u, v) => [lerp(-104 - 14 * v, 196 + 20 * v, u), lerp(jTop(u), -112, v) + 12 * Math.sin(Math.PI * u) * v];
const jPanel = (u0, v0, u1, v1, n = 16) => { const o = []; for (let i = 0; i <= n; i++) o.push(jq(lerp(u0, u1, i / n), v0)); for (let i = 1; i <= n; i++) o.push(jq(u1, lerp(v0, v1, i / n))); for (let i = 1; i <= n; i++) o.push(jq(lerp(u1, u0, i / n), v1)); for (let i = 1; i < n; i++) o.push(jq(u0, lerp(v1, v0, i / n))); return [o]; };
const jLine = (u0, v0, u1, v1, n = 20) => { const o = []; for (let i = 0; i <= n; i++) o.push(jq(lerp(u0, u1, i / n), lerp(v0, v1, i / n))); o.open = true; return o; };
// little printed flowers painted with a 2d context (for pat: callbacks)
const dab = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
const posy = (c, x, y, r, col, eye, n = 6) => { for (let i = 0; i < n; i++) { const a = i / n * TAU; dab(c, x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.42, col); } dab(c, x, y, r * 0.36, eye); };

// ---------------------------------------------------------------- sprites: people
function goldBits(A, J) { }
function spinner(A, ph) {
  const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); const base = { lean: 5 + s * 2, legN: [4, 176], legF: [8, 172], head: 4 - s * 3, armN: [0, 0], armF: [0, 0] };
  A.at({ s: 1.45 }, () => {
    const J0 = joints(base), hub = [(436 - 250) / 1.45, (744 - 846) / 1.45], tgt = [hub[0] - 12 + Math.cos(ph * TAU) * 15, hub[1] + Math.sin(ph * TAU) * 15];
    const draw = [92 + s * 10, -150 - c * 18]; // cotton hand in front, rising and falling
    base.armN = ik(J0.shN, tgt, 66, 62, 1); base.armF = ik(J0.shF, draw, 66, 62, 1);
    const sari = { fill: [Y, O], under: W };
    figure(A, { pose: base, skin: SKIN.copper, hair: { kind: 'bun', gap: 8, fill: [K, '#2a160d'] }, st: { order: 0.5 },
      face: { lips: R, brow: K }, hands: { N: 'grip', F: 'cup' }, bangle: { color: Y, gold: 0.9, w: 12 }, armlet: { color: Y, gold: 0.9 },
      torso: { fill: [G, Gd], under: W, lines: [{ flow: { gap: 9, w: 2, margin: 4, minLen: 10, field: [{ contour: 1 }] } }] }, sleeve: { to: 'el', fill: [G, Gd], under: W, w: [36, 31], gap: 9, trim: { color: Y, w: 5 } },
      lower: { path: () => blob([[-52, -44], [-22, -62], [18, -56], [66, -50], [106, -38], [120, -16], [112, 0], [40, 4], [-40, 4], [-66, 0], [-70, -20]]), fill: [R, Rd], under: W, lines: [{ flow: { gap: 10, w: 2.4, margin: 4, minLen: 18, field: [{ guide: curve([[-40, -40], [20, -44], [84, -30], [108, -6]]), w: 1, fall: 200 }, { contour: 0.5 }] } }, { strokes: [curve([[-70, -6], [0, -8], [70, -10], [124, -22]])], w: 14, ink: Y }, { strokes: [curve([[-70, -12], [0, -15], [70, -18], [124, -30]]), curve([[-70, 0], [0, -1], [70, -3], [124, -14]])], w: 2, ink: K }, { dots: Array.from({ length: 15 }, (_, i) => { const [x, y] = at(curve([[-70, -6], [0, -8], [70, -10], [124, -22]]), (i + 0.5) / 15); return [x, y, 3]; }), ink: R }] },
      back: (A, J) => { // pallu falling behind
        ink(A, blob([[J.shF[0] - 4, J.shF[1] - 12], [J.shF[0] - 34, J.shF[1] + 18], [-66, -56], [-78 - s * 3, 2], [-34, 4], [-24, -60], [J.shF[0] + 14, J.shF[1] + 16]]), { fill: [R, Rd], under: W, order: 0.5, ow: 2, lines: [{ flow: { gap: 10, w: 2.4, margin: 5, minLen: 20, field: [{ dir: 1.75 }] } }, { strokes: [line([-82, -14], [-26, -12])], w: 13, ink: Y }, { strokes: [line([-82, -22], [-26, -20])], w: 2, ink: K }] }); },
      mid: (A, J) => { ink(A, blob([[J.shF[0] - 12, J.shF[1] - 12], [J.shF[0] + 12, J.shF[1] - 16], [J.chest[0] + 16, J.chest[1] + 14], [J.hip[0] + 34, J.hip[1] - 6], [J.hip[0] + 22, J.hip[1] + 8], [J.hip[0] - 8, J.hip[1] + 2], [J.chest[0] - 10, J.chest[1] + 22]]), { fill: [R, Rd], under: W, order: 0.5, ow: 1.8, lines: [{ flow: { gap: 9, w: 2, margin: 4, minLen: 14, field: [{ dir: 0.95 }] } }, { strokes: [curve([[J.shF[0] + 12, J.shF[1] - 14], [J.chest[0] + 14, J.chest[1] + 14], [J.hip[0] + 34, J.hip[1] - 4]])], w: 9, ink: Y }] }); },
      collar: { color: [Y, R], rows: 2, w: 9, gold: 0.8, dots: K },
      hat: (A) => { for (let i = 0; i < 9; i++) { const a = 2.1 + i * 0.42; A.part(circ(-52 + Math.cos(a) * 24, -38 + Math.sin(a) * 24, 6, 12), { fill: W, halo: 1.2, order: 0.3 }); } A.dots([[34, -32, 4.5]], { color: R, halo: 1 }); A.part(circ(-13, 22, 8, 16), { fill: Y, halo: 1.4, gold: 1 }); A.part(petal(-13, 28, 16, 13, Math.PI / 2, 0.7), { fill: Y, halo: 1, gold: 1 }); A.stroke(arc(40, 12, 5, -1, 3.4, 10), { w: 2.2, color: Y, gold: 1, halo: 0.6 }); A.stroke(curve([[20, -50], [-6, -42], [-14, -14], [-13, 4]]), { w: 3.4, color: Y, gold: 1, halo: 1 }); A.part(circ(30, -44, 6, 14), { fill: Y, gold: 1, halo: 1 }); },
      front: (A, J) => { // roll of cotton in the drawing hand
        A.part(limb([[J.haF[0] - 26, J.haF[1] - 26], [J.haF[0] + 8, J.haF[1] - 6], [J.haF[0] + 22, J.haF[1] + 10]], [10, 16, 4]), { fill: W, halo: 1.6, order: 0.3, lines: [{ flow: { gap: 6, w: 1.4, margin: 2, minLen: 8, field: [{ dir: 0.8 }] }, ink: '#c9a86a' }] }); }, });
  });
}
function dancer(A, ph, o) { // half-seated, knees turned out, pleated fan opening between them
  const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), k = o.k || 1; const [C1, C1d, C2, C3] = o.cols; const st = { order: 0.5 };
  const sit = 10 + s * 10, hip = [0, -166 + sit], chest = [k * (4 - c * 5), hip[1] - 82], neck = [chest[0] + k * 2, chest[1] - 26];
  const knL = [-84 - s * 5, -92 + sit * 0.5], knR = [84 - s * 5, -92 + sit * 0.5], ftL = [-40, -8 - Math.max(0, c) * 26], ftR = [40, -8 - Math.max(0, -c) * 26];
  const sk = SKIN[o.skin || 'copper'];
  const shL = [chest[0] - 33, chest[1] - 10], shR = [chest[0] + 33, chest[1] - 10];
  const haU = [chest[0] - k * (78 - s * 20), chest[1] - 112 + c * 10], haO = [chest[0] + k * (96 + s * 8), chest[1] - 14 + s * 30];
  const armTo = (sh, ha, b) => { const a = ik(sh, ha, 66, 62, b); const el = pol(sh, a[0], 66), h = pol(el, a[1], 62); return { el, h, a: a[1] }; };
  const limbS = (a, b, e, w) => A.part(limb([a, b, e], w, { seg: 8 }), { fill: sk[0], halo: 2.2, ...st, lines: [{ strokes: [spiral(a[0], a[1], 9, 2, 1, 1.2, 20)], w: 2 }] });
  const U = armTo(k > 0 ? shL : shR, haU, k > 0 ? -1 : 1), Ou = armTo(k > 0 ? shR : shL, haO, k > 0 ? 1 : -1);
  // braid with flowers, swinging
  A.part(limb([[neck[0] + k * 30, neck[1] - 30], [neck[0] + k * 50, neck[1] + 40], [neck[0] + k * (46 + s * 16), neck[1] + 110], [neck[0] + k * (34 + s * 30), neck[1] + 160]], [24, 22, 18, 10]), { fill: [K, '#2a160d'], halo: 2, ...st, lines: [{ strokes: Array.from({ length: 9 }, (_, i) => { const y = neck[1] - 10 + i * 20; return curve([[neck[0] + k * 66, y], [neck[0] + k * 46, y + 8], [neck[0] + k * 22, y - 2]]); }), w: 2 }] });
  for (let i = 0; i < 5; i++) A.dots([[neck[0] + k * (40 + (i % 2) * 12), neck[1] + i * 26, 6]], { color: i % 2 ? Y : W, halo: 1, ...st });
  // legs in gathered silk
  for (const [kn, ft, q] of [[knL, ftL, -1], [knR, ftR, 1]]) {
    const a0 = Math.atan2(0, 1); A.at({ x: ft[0], y: ft[1], sx: q }, () => { A.part(blob([[-12, -14], [10, -12], [28, -2], [52, 2], [56, 8], [44, 11], [-12, 11], [-16, 0]], 6), { fill: sk[0], halo: 2, ...st, lines: [{ strokes: [line([46, 4], [49, 10]), line([41, 3], [44, 10])], w: 1.6, ink: R }, { strokes: [line([-12, 10], [54, 9])], w: 4, ink: R }] }); });
    ink(A, limb([[q * 8, hip[1] + 4], kn, [ft[0] + q * 2, ft[1] - 22]], [52, 62, 40, 26], { seg: 9 }), { fill: [C1, C1d], under: W, ow: 2, ...st, lines: [{ flow: { gap: 9, w: 2.2, margin: 4, minLen: 14, field: [{ guide: curve([[q * 8, hip[1]], kn, ft]), w: 1, fall: 300 }] } }] });
    ink(A, limb([[ft[0] + q * 20, ft[1] - 34], [ft[0] - q * 12, ft[1] - 24]], [13]), { fill: Y, gold: 0.9, raise: 0.6, ow: 1.4, ...st });
    for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) A.dots([[ft[0] + lerp(-14, 14, i / 4) + q * 3, ft[1] - 18 + r * 7, 3.2]], { color: r % 2 ? Y : Yl, gold: 1, halo: 0.8, ...st });
  }
  // the fan of pleats
  const open = 0.72 + 0.28 * s, n = 13, w0 = 26, hemY = -34 + sit * 0.4; const L = [], Rr = []; const hem = []; for (let i = 0; i <= n * 2; i++) { const u = i / (n * 2) * 2 - 1, a = u * 0.82 * open; const r = 136 + (i % 2 ? 8 : 0); hem.push([Math.sin(a) * r, hip[1] + Math.cos(a) * r]); }
  const fan = [[-w0, hip[1] - 4], ...hem, [w0, hip[1] - 4]]; const rad = f => Array.from({ length: 21 }, (_, i) => { const u = i / 20 * 2 - 1, a = u * 0.82 * open; return [Math.sin(a) * 136 * f, hip[1] + Math.cos(a) * 136 * f]; });
  const op = l => { l.open = true; return l; };
  ink(A, [fan], { fill: [C2, C3], under: W, ow: 2.2, ...st, raise: 0.35, lines: [{ strokes: Array.from({ length: n - 1 }, (_, i) => { const a = ((i + 1) / n * 2 - 1) * 0.82 * open; return line([Math.sin(a) * 20, hip[1] + Math.cos(a) * 18], [Math.sin(a) * 146, hip[1] + Math.cos(a) * 146]); }), w: 2.2 }, { strokes: [op(rad(0.9))], w: 16, ink: Y }, { strokes: [op(rad(0.97)), op(rad(0.83)), op(rad(0.62))], w: 2.4, ink: K }, { strokes: [op(rad(0.68))], w: 6, ink: Y }, { dots: Array.from({ length: 15 }, (_, i) => { const a = ((i + 0.5) / 15 * 2 - 1) * 0.82 * open; return [Math.sin(a) * 122, hip[1] + Math.cos(a) * 122, 4]; }), ink: R }] });
  // far (raised) arm, torso
  limbS(k > 0 ? shL : shR, U.el, U.h, [24, 25, 19, 19, 12]); hand(A, U.h, U.a + k * -24, { skin: sk, pose: 'cup', flip: k, s: 0.9, ...st });
  ink(A, blob([[shL[0] - 6, shL[1] - 4], [neck[0] - 13, neck[1] + 8], [neck[0] + 13, neck[1] + 8], [shR[0] + 6, shR[1] - 4], [chest[0] + 30, chest[1] + 26], [hip[0] + 25, hip[1] - 18], [hip[0] + 33, hip[1] + 6], [hip[0] - 33, hip[1] + 6], [hip[0] - 25, hip[1] - 18], [chest[0] - 30, chest[1] + 26]]), { fill: o.bl, under: W, ow: 2, ...st, lines: [{ flow: { gap: 9, w: 2, margin: 4, minLen: 10, field: [{ contour: 1 }] } }] });
  ink(A, blob([[hip[0] - 34, hip[1] - 8], [hip[0] - 25, hip[1] - 34], [hip[0] + 25, hip[1] - 34], [hip[0] + 34, hip[1] - 8], [hip[0] + 36, hip[1] + 8], [hip[0], hip[1] + 18], [hip[0] - 36, hip[1] + 8]]), { fill: [C1, C1d], under: W, ow: 1.8, ...st, lines: [{ flow: { gap: 8, w: 2, margin: 3, minLen: 12, field: [{ dir: 0.12 }] } }] });
  ink(A, limb([[-36, hip[1] - 4], [0, hip[1] + 6], [36, hip[1] - 4]], [13]), { fill: Y, gold: 1, raise: 0.7, ow: 1.4, ...st, lines: [{ dots: Array.from({ length: 9 }, (_, i) => [-32 + i * 8, hip[1] - 2 + Math.sin(i / 8 * Math.PI) * 7, 2.4]), ink: R }] });
  ink(A, blob([[chest[0] - k * 40, chest[1] - 18], [chest[0] - k * 18, chest[1] - 24], [hip[0] + k * 34, hip[1] - 14], [hip[0] + k * 16, hip[1] - 4]]), { fill: [C1, C1d], under: W, ow: 1.6, ...st, lines: [{ strokes: [line([chest[0] - k * 30, chest[1] - 14], [hip[0] + k * 26, hip[1] - 12])], w: 6, ink: Y }] });
  // necklaces
  for (const [w, d, cc] of [[20, 22, Y], [26, 46, Yl]]) A.stroke(curve([[neck[0] - w, neck[1] + 10], [neck[0], neck[1] + 10 + d], [neck[0] + w, neck[1] + 10]]), { w: 6, color: cc, gold: 1, halo: 1.4, ...st });
  // head
  A.at({ x: neck[0] - k * 2, y: neck[1] - 50, s: 0.86, sx: -k, r: (-0.06 + s * 0.12) * k }, () => { headProfile(A, { skin: sk, lips: R, brow: K, ...st, look: 0.3 }); hair(A, 'bun', { ...st, fill: [K, '#2a160d'], gap: 8 });
    for (let i = 0; i < 12; i++) { const a = 1.9 + i * 0.36; A.part(circ(-54 + Math.cos(a) * 28, -36 + Math.sin(a) * 26, 7, 12), { fill: i % 3 ? W : Y, halo: 1.1, ...st }); }
    A.stroke(curve([[36, -38], [10, -54], [-24, -56], [-50, -40]]), { w: 6, color: Y, gold: 1, halo: 1.2, ...st }); A.part(circ(33, -38, 6, 14), { fill: R, halo: 1, ...st }); A.stroke(curve([[30, -44], [-4, -30], [-16, -8]]), { w: 4, color: Y, gold: 1, halo: 1, ...st }); A.part(circ(-13, 22, 9, 16), { fill: Y, gold: 1, halo: 1.2, ...st }); A.part(petal(-13, 28, 18, 15, Math.PI / 2, 0.7), { fill: Y, gold: 1, halo: 1, ...st }); A.dots([[36, -28, 4.4]], { color: R, halo: 1, ...st }); A.stroke(arc(40, 12, 5, -1, 3.4, 10), { w: 2.2, color: Y, gold: 1, halo: 0.6, ...st }); });
  limbS(k > 0 ? shR : shL, Ou.el, Ou.h, [24, 25, 19, 19, 12]); hand(A, Ou.h, Ou.a - k * 30, { skin: sk, pose: 'flat', flip: k, s: 0.9, ...st });
  for (const [a, b, m] of [[k > 0 ? shL : shR, U.el, U.h], [k > 0 ? shR : shL, Ou.el, Ou.h]]) { const q = [lerp(a[0], b[0], 0.45), lerp(a[1], b[1], 0.45)], an = Math.atan2(b[1] - a[1], b[0] - a[0]) / D; ink(A, limb([a, q], [34, 30], { cap1: false }), { fill: o.bl, under: W, ow: 1.6, ...st, lines: [{ strokes: [line(pol(q, an + 90, 22), pol(q, an - 90, 22))], w: 12, ink: Y }] }); for (const f of [0.78, 0.86]) { const e = [lerp(b[0], m[0], f), lerp(b[1], m[1], f)], a2 = Math.atan2(m[1] - b[1], m[0] - b[0]) / D; A.stroke(line(pol(e, a2 + 90, 9), pol(e, a2 - 90, 9)), { w: 5, color: Y, gold: 1, halo: 1, cap: 'butt', ...st }); } }
}

// ---------------------------------------------------------------- elephant parts (local: ground under the body centre at 0,0, facing left)
const BODY = [[-118, -392], [-60, -408], [20, -424], [100, -424], [170, -404], [226, -360], [256, -296], [264, -226], [248, -168], [214, -140], [120, -126], [10, -120], [-70, -132], [-128, -170], [-150, -240], [-146, -330]];
const eFill = ['#34568f', '#16264f'], eFar = ['#22396a', '#101b3a'], eUnder = '#e3d3a6';
function eleLeg(A, ph, hind, far) {
  const s = Math.sin(ph * TAU), c = Math.max(0, Math.cos(ph * TAU)); const kn = [-s * 34 - c * (hind ? -6 : 18), 92 - c * 14], ft = [-s * 62 + c * 8, 186 - c * 26], w = hind ? [140, 116, 78, 76, 78] : [116, 104, 78, 76, 80];
  const sp = [[hind ? 4 : 0, -44], [hind ? 4 - s * 10 : -s * 10, 20], kn, [lerp(kn[0], ft[0], 0.6), lerp(kn[1], ft[1], 0.6)], ft];
  const st = { order: 0.76 };
  ink(A, limb(sp, w, { seg: 9, cap1: false }), { fill: far ? eFar : eFill, under: eUnder, ow: 3, ...st, lines: [{ flow: { gap: 12, w: 2.6, margin: 6, minLen: 22, field: [{ guide: curve(sp), w: 1, fall: 300 }, { vortex: [sp[0][0], 0, 40, hind ? 1 : -1], w: far ? 0 : 1.5 }] } }] });
  A.at({ x: ft[0], y: ft[1], r: -s * 0.12 }, () => {
    ink(A, blob([[-42, -14], [0, -18], [42, -14], [47, 2], [38, 8], [-40, 8], [-48, 2]]), { fill: far ? eFar : eFill, ow: 2.6, ...st }); for (let i = 0; i < 4; i++) A.part(arcBand(-34 + i * 19, 6, 0, 8.5, Math.PI, TAU, 10), { fill: W, halo: 1, order: 0.3 });
    if (!far) { ink(A, limb([[-39, -40], [0, -33], [39, -40]], [15], { cap0: false, cap1: false }), { fill: Y, gold: 1, raise: 0.8, ow: 1.6, order: 0.5, lines: [{ dots: Array.from({ length: 8 }, (_, i) => [-32 + i * 9, -37 + Math.sin(i / 7 * 3.14) * 6, 3]), ink: R }] }); for (let i = 0; i < 7; i++) A.part(circ(-34 + i * 11.4, -25 + Math.sin(i / 6 * 3.14) * 6, 5, 12), { fill: Yl, gold: 1, halo: 1, order: 0.5 }); for (let i = 0; i < 3; i++) A.pattern(circ(-22 + i * 22, -64, 11, 14), (x) => posy(x, -22 + i * 22, -64, 10, i % 2 ? W : Pk, Y), { order: 0.5, color: W }); }
    else { ink(A, limb([[-38, -36], [0, -30], [38, -36]], [11], { cap0: false, cap1: false }), { fill: O, gold: 0.6, ow: 1.4, order: 0.5 }); }
  });
}
function trunkSpine(ph) { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); return [[-262, -318], [-304, -262], [-330, -186], [-364, -134], [-420, -124 + s * 4], [-456 - c * 5, -164 + s * 6], [-450 - c * 9, -226 + s * 9], [-416 - c * 12, -268 + s * 10], [-404 - c * 12, -316 + s * 10]]; }
function eleTrunk(A, ph) {
  const sp = trunkSpine(ph), cv = curve(sp, 10), p = limb(sp, [124, 108, 88, 72, 60, 50, 42, 36, 28], { seg: 10 });
  ink(A, p, { fill: eFill, under: eUnder, ow: 3, order: 0.76, lines: [{ strokes: Array.from({ length: 34 }, (_, i) => { const u = 0.1 + i * 0.026, [x, y, a] = at(cv, u), h = lerp(50, 14, u), e = lerp(0.42, 0.5, u); const m = [x + Math.cos(a) * 5, y + Math.sin(a) * 5]; return curve([[x - Math.sin(a) * h * e * 2, y + Math.cos(a) * h * e * 2], [x - Math.sin(a) * h * 0.3 + Math.cos(a) * 6, y + Math.cos(a) * h * 0.3 + Math.sin(a) * 6]], 4); }), w: 2.2, taper: 0.2 },
    { ink: W, pat: c => { c.lineWidth = 4; c.strokeStyle = W; c.beginPath(); for (let i = 0; i <= 70; i++) { const [x, y, a] = at(cv, 0.02 + i / 70 * 0.9), w = Math.sin(i * 0.55) * lerp(22, 6, i / 70), X = x + Math.sin(a) * (w + 4), Yy = y - Math.cos(a) * (w + 4); i ? c.lineTo(X, Yy) : c.moveTo(X, Yy); } c.stroke(); for (let i = 0; i < 15; i++) { const u = 0.04 + i * 0.06, [x, y, a] = at(cv, u), sd = (i % 2 ? 1 : -1) * lerp(20, 5, u), q = lerp(15, 6, u); posy(c, x + Math.sin(a) * sd, y - Math.cos(a) * sd, q, [Pk, Yl, W][i % 3], [Y, R, R][i % 3], 7); for (const d of [-1, 1]) { c.fillStyle = '#8fae4a'; c.beginPath(); c.ellipse(x + Math.sin(a) * sd * 0.2 + Math.cos(a) * d * q * 1.1, y - Math.cos(a) * sd * 0.2 + Math.sin(a) * d * q * 1.1, q * 0.55, q * 0.24, a + d * 0.6, 0, 7); c.fill(); } } } }] });
}
function eleHead(A) {
  ink(A, blob([[-96, -410], [-136, -446], [-168, -468], [-204, -462], [-232, -446], [-268, -440], [-296, -402], [-310, -346], [-316, -286], [-288, -240], [-250, -214], [-206, -198], [-160, -212], [-118, -262], [-90, -336]]), { fill: eFill, under: eUnder, ow: 3.2, order: 0.76, lines: [{ flow: { gap: 12, w: 2.6, margin: 6, minLen: 16, field: [{ contour: 1 }, { vortex: [-250, -346, 34, 1], w: 1.6 }, { vortex: [-188, -250, 36, -1], w: 1.4 }] } }] });
  // mouth
  A.part(blob([[-262, -226], [-236, -206], [-206, -206], [-220, -190], [-250, -196], [-268, -212]]), { fill: Pk, halo: 1.5, order: 0.42 });
  // gold forehead caparison with bosses
  A.with({ raise: 0.9, gold: 1, order: 0.5 }, () => {
    ink(A, blob([[-150, -462], [-176, -472], [-206, -464], [-234, -450], [-268, -440], [-296, -400], [-312, -344], [-318, -286], [-300, -254], [-286, -292], [-270, -336], [-244, -372], [-206, -396], [-164, -414]]), { fill: [Yl, Y], ow: 2.4, lines: [{ dots: [...Array.from({ length: 13 }, (_, i) => { const [x, y] = at(curve([[-166, -452], [-214, -442], [-262, -414], [-290, -362], [-304, -290]]), i / 12); return [x, y, 7]; })], ink: R }, { dots: Array.from({ length: 13 }, (_, i) => { const [x, y] = at(curve([[-166, -452], [-214, -442], [-262, -414], [-290, -362], [-304, -290]]), i / 12); return [x, y, 3]; }), ink: Yl }, { dots: Array.from({ length: 16 }, (_, i) => { const [x, y] = at(curve([[-160, -428], [-208, -412], [-246, -386], [-276, -340], [-292, -292]]), i / 15); return [x, y, 3.4]; }), ink: K }] });
    for (let i = 0; i < 12; i++) { const [x, y] = at(curve([[-160, -410], [-204, -394], [-242, -370], [-268, -334], [-284, -288]]), i / 11); A.part(petal(x, y, 18, 8, Math.PI * 0.42, 0.8), { fill: i % 2 ? R : Yl, halo: 1, gold: i % 2 ? 0 : 1 }); }
  });
  // eye
  A.part([spl([[-272, -330, 1], [-252, -348], [-232, -342], [-216, -326, 1], [-236, -318], [-256, -318]], true, 7)], { fill: K, halo: 3, order: 0.05 }); A.part([spl([[-264, -330, 1], [-250, -341], [-236, -338], [-224, -327, 1], [-240, -322]], true, 7)], { fill: W, halo: 0, order: 0.3 }); A.part(circ(-246, -331, 7.5, 18), { fill: K, halo: 0, order: 0.05 }); A.part(circ(-248, -333, 2.2, 8), { fill: W, halo: 0, order: 0.05 }); kline(A, curve([[-276, -340], [-254, -360], [-230, -354], [-210, -336]]), 4); kline(A, curve([[-266, -312], [-246, -306], [-222, -312]]), 2.6);
  // painted cheek vine
  A.pattern(circ(-190, -262, 44), c => { for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; posy(c, -190 + Math.cos(a) * 26, -262 + Math.sin(a) * 26, 10, i % 2 ? Pk : Yl, W); } posy(c, -190, -262, 15, W, R, 8); }, { order: 0.5 });
}
function eleEar(A) {
  ink(A, blob([[-176, -404], [-138, -428], [-92, -418], [-62, -376], [-58, -318], [-78, -258], [-106, -214], [-130, -206], [-142, -240], [-146, -290], [-164, -340]]), { fill: ['#3f6199', '#1b2f5e'], under: eUnder, ow: 3, order: 0.76, lines: [{ flow: { gap: 12, w: 2.6, margin: 8, minLen: 16, field: [{ contour: 1 }, { dir: 1.5, w: 0.4 }] } }] });
  ink(A, blob([[-156, -392], [-132, -408], [-100, -400], [-80, -366], [-78, -316], [-94, -266], [-116, -236], [-126, -250], [-128, -296], [-144, -344]]), { fill: [Pk, R], under: W, ow: 1.8, order: 0.42, lines: [{ flow: { gap: 13, w: 2.4, margin: 8, minLen: 14, field: [{ radial: [-150, -420] }] } }, { ink: W, pat: c => { for (const [x, y, r] of [[-124, -380, 13], [-104, -346, 13], [-104, -306, 12], [-114, -270, 9], [-136, -350, 9]]) posy(c, x, y, r, Yl, Rd, 7); } }] });
}
function eleCloth(A) { // jhool
  const st = { raise: 0.85 };
  A.with(st, () => {
    ink(A, jPanel(0, 0, 1, 1), { fill: I, order: 0.78, gold: 0.05, ow: 3 });
    ink(A, jPanel(0.015, 0.02, 0.985, 0.975), { fill: [Yl, Y], order: 0.5, gold: 1, ow: 1.6 });
    ink(A, jPanel(0.045, 0.05, 0.955, 0.94), { fill: I, order: 0.78, ow: 1.4, lines: [{ strokes: [[0.075, 0.06, 0.075, 0.9], [0.925, 0.06, 0.925, 0.9]].map(q => { const l = jLine(...q, 40); return offset(l, u => Math.sin(u * 40) * 5); }), w: 3, ink: Yl }, { strokes: [offset(jLine(0.06, 0.895, 0.94, 0.895, 50), u => Math.sin(u * 46) * 5)], w: 3, ink: Yl }] });
    const bd = []; for (let i = 0; i < 12; i++) { bd.push([...jq(0.075, 0.1 + i * 0.07), 5], [...jq(0.925, 0.1 + i * 0.07), 5]); } for (let i = 0; i < 15; i++) bd.push([...jq(0.08 + i * 0.06, 0.895), 5]);
    A.dots(bd, { color: R, halo: 1.6, order: 0.4 }); A.dots(bd.map(q => [q[0], q[1], 2]), { color: Yl, halo: 0, order: 0.5, gold: 1 });
    ink(A, jPanel(0.11, 0.1, 0.89, 0.85), { fill: [R, Rd], order: 0.4, ow: 1.8, gold: 0.05 });
    // triangles round the field
    const tr = []; for (let i = 0; i < 22; i++) { const u = 0.12 + i * 0.035; tr.push([jq(u, 0.846), jq(u + 0.0175, 0.8), jq(u + 0.035, 0.846)]); tr.push([jq(u, 0.104), jq(u + 0.0175, 0.146), jq(u + 0.035, 0.104)]); } A.part(tr, { fill: Yl, gold: 1, order: 0.5, halo: 1 });
    // lotus medallion
    const [mx, my] = jq(0.5, 0.47); ink(A, circ(mx, my, 78, 48), { fill: I, order: 0.78, ow: 1.8 });
    for (const [r, n, l, w, c] of [[40, 20, 36, 13, Yl], [26, 14, 34, 14, Pk], [12, 10, 30, 15, W]]) for (const q of P.petals(mx, my, n, r, l, w, r)) A.part([q], { fill: c, halo: 1.2, order: passOf(c), gold: c === Yl ? 1 : 0 }); ink(A, circ(mx, my, 17), { fill: Yl, gold: 1, order: 0.5, ow: 1.4, lines: [{ dots: P.ringDots(mx, my, 10, 8, 2), ink: R }] });
    A.part(ring(mx, my, 80, 88), { fill: Yl, gold: 1, halo: 1.4, order: 0.5 });
    // corner paisleys
    for (const [u, v, rr, f] of [[0.24, 0.28, 2.5, 1], [0.76, 0.28, -2.5, -1], [0.24, 0.68, 0.7, 1], [0.76, 0.68, -0.7, -1]]) { const [x, y] = jq(u, v); ink(A, P.paisley(x, y, 40, rr, f), { fill: [Yl, Y], gold: 1, order: 0.5, ow: 1.6, halo: 1.6 }); ink(A, P.paisley(x, y, 26, rr, f), { fill: G, order: 0.86, ow: 1.2, halo: 1 }); A.part(P.paisley(x, y, 13, rr, f), { fill: Pk, halo: 1, order: 0.42 }); }
    for (let j = 0; j < 8; j++) for (let i = 0; i < 12; i++) { const u = 0.15 + i * 0.064 + (j % 2) * 0.03, v = 0.18 + j * 0.085, [x, y] = jq(u, v); if (Math.hypot(x - mx, y - my) < 98 || u > 0.87) continue; let near = 0; for (const [a, b] of [[0.24, 0.28], [0.76, 0.28], [0.24, 0.68], [0.76, 0.68]]) { const q = jq(a, b); if (Math.hypot(q[0] - x, q[1] - y) < 44) near = 1; } if (!near) A.dots([[x, y, 3.2]], { color: Yl, halo: 0.8, order: 0.5, gold: 1 }); }
    // fringe and bells
    for (let i = 0; i <= 26; i++) { const [x, y] = jq(i / 26, 1); A.part(limb([[x, y - 2], [x, y + 12], [x + 1, y + 26]], [5, 11, 8]), { fill: i % 2 ? Yl : R, gold: i % 2 ? 1 : 0, halo: 1.2, order: 0.45, lines: [{ strokes: [line([x, y + 8], [x, y + 26])], w: 1.6 }] }); }
    for (let i = 0; i < 9; i++) { const [x, y] = jq((i + 0.5) / 9, 1); ink(A, blob([[x - 7, y + 46], [x - 6, y + 34], [x, y + 28], [x + 6, y + 34], [x + 7, y + 46]]), { fill: Yl, gold: 1, ow: 1.2, order: 0.5 }); }
  });
}
function howdah(A) {
  const st = { raise: 0.8 };
  A.with(st, () => {
    // riders inside
    for (const [x, kk, o] of [[8, -1, { torso: { fill: [G, Gd], under: W }, hat: 1 }], [104, -1, { torso: { fill: [R, Rd], under: W } }]]) A.at({ x, y: -420, s: 0.46, sx: kk }, () => A.with({ raise: 0, order: 0.5 }, () => figure(A, { pose: { ...POSE.sit, armN: [40, -40], armF: [60, -10] }, skin: SKIN.copper, hair: { kind: 'bun', gap: 9 }, torso: o.torso, sleeve: { to: 'el', fill: o.torso.fill, under: W, w: [42, 38], trim: { color: Y, w: 5 } }, lower: { path: () => rect(-60, -100, 1, 1), fill: 'transparent' }, collar: { color: Y, w: 9, gold: 1 }, bangle: { color: Y, gold: 1 }, face: { lips: R }, hat: A => { A.dots([[33, -30, 4]], { color: R, halo: 1 }); A.part(circ(-13, 22, 8, 14), { fill: Y, gold: 1, halo: 1 }); if (o.hat) for (let i = 0; i < 7; i++) A.dots([[-60 + Math.cos(i) * 20, -42 + Math.sin(i) * 20, 6]], { color: W, halo: 1 }); } })));
    for (const x of [-62, 14, 96, 172]) ink(A, limb([[x, -452], [x, -590]], [9, 11]), { fill: [Yl, Y], gold: 1, ow: 1.6, order: 0.5 });
    const val = cusped(-74, 184, -560, -586, 11); ink(A, [[...val, [184, -604], [-74, -604]]], { fill: [R, Rd], ow: 2, order: 0.4, lines: [{ dots: Array.from({ length: 15 }, (_, i) => [-62 + i * 16.8, -596, 3.4]), ink: Yl }] });
    ink(A, [spl([[-104, -600, 1], [-92, -622], [-72, -650], [-30, -684], [24, -700], [52, -716, 1], [80, -700], [140, -684], [184, -650], [204, -622], [216, -600, 1]], true, 9)], { fill: [Yl, Y], gold: 1, ow: 2.4, order: 0.5, lines: [{ strokes: [-0.8, -0.55, -0.28, 0, 0.28, 0.55, 0.8].map(u => curve([[55 + u * 4, -712], [56 + u * 92, -668], [56 + u * 154, -602]])), w: 3, ink: R }, { strokes: [curve([[-100, -610], [56, -606], [212, -610]])], w: 12, ink: I }, { dots: Array.from({ length: 19 }, (_, i) => [-88 + i * 16, -608 + Math.sin(i / 18 * 3.14) * 3, 3]), ink: Yl }] });
    ink(A, circ(54, -724, 12), { fill: Yl, gold: 1, ow: 1.6, order: 0.5 }); ink(A, petal(54, -732, 34, 14, -Math.PI / 2, 0.4), { fill: Yl, gold: 1, ow: 1.6, order: 0.5 });
    for (const x of [-100, 212]) { A.part(limb([[x, -600], [x, -584], [x + 2, -560]], [6, 12, 9]), { fill: R, halo: 1.6, order: 0.4, lines: [{ strokes: [line([x, -584], [x, -562])], w: 1.6 }] }); }
    // base: lotus-petal box
    ink(A, poly([[-92, -478], [206, -478], [190, -424], [-74, -424]]), { fill: [R, Rd], ow: 2.4, order: 0.4 });
    for (let i = 0; i < 15; i++) ink(A, petal(-72 + i * 18.4, -426, 34, 17, -Math.PI / 2, 0.6), { fill: i % 2 ? Yl : Y, gold: 1, ow: 1.3, order: 0.5, halo: 0.8 });
    ink(A, rrect(-98, -486, 310, 14, 6), { fill: Yl, gold: 1, ow: 1.8, order: 0.5, lines: [{ dots: Array.from({ length: 22 }, (_, i) => [-88 + i * 13.8, -479, 3.2]), ink: I }] });
  });
}
const EL = [1284, 880];
// sari ribbon: centreline + signed half-width (it turns over at index tw)
const SARI = new Map();
function sariGeo(ph) {
  const w = (u, k) => Math.sin(u * 6.5 - ph * TAU + k) * 17 * Math.min(1, u * 2.2) * Math.min(1, (1 - u) * 3); const base = [[0, 0], [66, 10], [132, -18], [160, -86], [150, -158], [196, -214], [270, -226], [318, -238]].map((q, i) => { const u = i / 7; return [q[0] + w(u, 0), q[1] + w(u, 1.4) * 0.8]; });
  const cv = curve(base, 8), n = cv.length, hw = cv.map((_, i) => { const u = i / (n - 1); return (u < 0.5 ? lerp(12, 66, Math.sin(Math.min(1, u / 0.24) * Math.PI / 2)) * Math.cos(Math.pow(u / 0.5, 2.4) * Math.PI / 2 * 0.94) : -lerp(58, 12, Math.pow((u - 0.5) / 0.5, 2.2)) * Math.sin(Math.min(1, (u - 0.5) / 0.22) * Math.PI / 2)) + (u < 0.5 ? 3 : -3); });
  const tw = Math.round((n - 1) * 0.5); const pt = (i, f) => { const a = cv[Math.max(0, i - 1)], b = cv[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [cv[i][0] + (b[1] - a[1]) / l * hw[i] * f, cv[i][1] - (b[0] - a[0]) / l * hw[i] * f]; };
  return { cv, hw, n, tw, pt };
}

export default {
  id: 'india', mat: 10, dur: 5, from: 'left', to: 'right',
  word: { native: 'सूत्र', font: '"Kohinoor Devanagari"', roman: 'sūtra', gloss: 'thread' },
  caption: { place: 'India', tech: 'block-printed cotton' },
  sfx: [{ t: 0.3125, s: 'stamp' }, { t: 0.625, s: 'stamp' }, { t: 1.25, s: 'stamp' }, { t: 1.875, s: 'stamp' }, { t: 2.2, s: 'bell' }, { t: 2.5, s: 'shimmer' }, { t: 3.1, s: 'rattle' }, { t: 3.6, s: 'bell' }],
  env: t => ({ cloth: '#d9c49a', stain: 0.6, wear: 0.12, exposure: 0.95, sat: 1.06, waves: [[0.004, 0.002, 7, t * 0.8]] }),
  bake(B) {
    // ------------------------------------------------ printed ground
    B.layer('ground', A => {
      A.with({ halo: -1, noKnock: true }, () => {
        for (let j = 0; j < 15; j++) for (let i = 0; i < 24; i++) { const x = 100 + i * 78 + (j % 2) * 39, y = 108 + j * 62; if (x > 1840) continue; const q = (i + j * 2) % 3, c = ['#c9714a', '#8d9a62', '#c8962f'][q];
          if ((i + j) % 2) { A.part(P.paisley(x, y, 21, (i % 2 ? 0.5 : -0.5), i % 2 ? 1 : -1), { fill: c, alpha: 0.8, order: 0.4, lines: [{ strokes: [P.paisley(x, y, 13, (i % 2 ? 0.5 : -0.5), i % 2 ? 1 : -1)[0]], w: 2 }, { dots: [[x, y + 5, 3.4]] }] }); }
          else { A.part(P.petals(x, y - 4, 8, 4, 11, 6.5, j), { fill: c, alpha: 0.82, order: 0.4 }); A.dots([[x, y - 4, 2.6]], { color: '#b9623c', alpha: 0.7, order: 0.4 }); A.stroke(curve([[x, y + 9], [x + 4, y + 18], [x - 1, y + 27]]), { w: 2.2, color: '#b08f50', alpha: 0.7, order: 0.2 }); A.part([...petal(x + 2, y + 17, 14, 7, 0.2), ...petal(x + 2, y + 21, 14, 7, Math.PI - 0.2)], { fill: '#a9995a', alpha: 0.62, order: 0.7 }); }
          A.dots([[x + 39, y, 2.4], [x + 39, y + 9, 1.8], [x + 39, y - 9, 1.8]], { color: '#c0945a', alpha: 0.6, order: 0.2 }); }
      });
    }, { res: 0.75 });
    // ------------------------------------------------ far city, trees, pavilion
    B.layer('back', A => {
      // pale palace skyline
      A.with({ halo: 1.5 }, () => {
        const pale = ['#e0b985', '#d0a066'], pale2 = ['#dcc08e', '#cda872'];
        const dome = (x, y, w, h, c) => { A.part([spl([[x - w / 2, y, 1], [x - w * 0.56, y - h * 0.4], [x - w * 0.3, y - h * 0.78], [x, y - h, 1], [x + w * 0.3, y - h * 0.78], [x + w * 0.56, y - h * 0.4], [x + w / 2, y, 1]], true, 8)], { fill: c, order: 0.4, lines: [{ strokes: [-0.5, 0, 0.5].map(u => curve([[x, y - h], [x + u * w * 0.75, y - h * 0.5], [x + u * w * 0.8, y]])), w: 2 }] }); A.stroke(line([x, y - h], [x, y - h - 16]), { w: 4, color: c[1], order: 0.4 }); };
        const block = (x, y, w, h, c) => { const nW = Math.max(2, Math.floor(w / 24)), u = w / nW, sh = []; for (let r = 0; r < Math.floor(h / 50); r++) for (let i = 0; i < nW; i++) { const q = x + (i + 0.5) * u, yy = y + 22 + r * 50; sh.push([[q - 6, yy + 20], ...arc(q, yy + 4, 6, Math.PI, TAU, 8), [q + 6, yy + 20]]); } A.part(Array.from({ length: nW }, (_, i) => rrect(x + i * u + 2, y - 9, u - 5, 12, 5)[0]), { fill: c, order: 0.4 }); A.part(rect(x, y, w, h), { fill: c, order: 0.4, lines: [{ strokes: Array.from({ length: Math.ceil(h / 50) }, (_, r) => line([x, y + 8 + r * 50], [x + w, y + 8 + r * 50])), w: 2 }, { strokes: Array.from({ length: Math.ceil(h / 50) }, (_, r) => { const z = []; for (let i = 0; i <= nW * 2; i++) z.push([x + i * u / 2, y + 48 + r * 50 + (i % 2 ? 4 : 0)]); z.open = true; return z; }), w: 1.6 }, { shape: sh, rule: 'nonzero' }] }); };
        block(960, 690, 150, 190, pale2); dome(1035, 690, 120, 74, pale2); block(1120, 730, 200, 150, pale); block(1330, 700, 120, 180, pale2); dome(1390, 700, 96, 62, pale); block(1560, 650, 150, 230, pale); dome(1635, 650, 124, 84, pale); block(1720, 700, 130, 180, pale2); dome(1786, 700, 100, 66, pale2); for (const x of [980, 1095, 1345, 1440, 1580, 1696]) { dome(x, 652, 30, 26, pale); A.part(rect(x - 10, 652, 20, 40), { fill: pale, order: 0.4 }); }
      });
      // ---- tree of life
      const trunk = [[742, 850], [756, 740], [736, 640], [776, 540], [764, 440], [776, 340]];
      const br = [[[766, 560], [690, 520], [630, 540], [588, 500]], [[768, 470], [690, 420], [620, 430], [576, 388]], [[770, 420], [712, 330], [640, 320], [586, 280]], [[776, 360], [742, 260], [668, 226], [606, 196]], [[776, 345], [768, 230], [716, 150], [640, 120]], [[776, 345], [838, 250], [912, 210], [960, 140], [1050, 116]], [[772, 420], [850, 360], [930, 350], [1010, 290], [1080, 250]], [[770, 500], [840, 470], [900, 440]], [[912, 212], [1000, 220], [1080, 180], [1160, 190]], [[1050, 116], [1120, 110], [1190, 130]], [[762, 610], [700, 590], [650, 630], [600, 610]], [[930, 350], [1000, 384], [1060, 360], [1110, 392]], [[1080, 180], [1140, 250], [1110, 310]], [[840, 470], [890, 500], [950, 480]]];
      const rt = [[1806, 884], [1790, 760], [1812, 640], [1780, 520], [1796, 400], [1770, 300]], rb = [[[1796, 420], [1730, 400], [1690, 360], [1640, 372]], [[1780, 340], [1710, 300], [1660, 250], [1600, 262]], [[1770, 300], [1730, 220], [1650, 180], [1560, 190]], [[1770, 300], [1790, 210], [1740, 140], [1660, 120], [1570, 124]], [[1800, 560], [1740, 520], [1700, 530]], [[1640, 372], [1580, 420], [1520, 390]], [[1600, 262], [1540, 290], [1508, 250]]];
      const bark = { fill: ['#8a3a1e', '#54210f'], ow: 2.4 };
      const leaves = (b, seed, w0) => { const cv = curve(b, 14), R0 = rng(seed), L = b.length * 90, n = Math.round(L / 24); for (let i = 1; i < n; i++) { const u = i / n, [x, y, a] = at(cv, u), sd = i % 2 ? 1 : -1; leafAt(A, x, y, 34 + R0() * 18, 15 + R0() * 6, a + sd * (0.7 + R0() * 0.5), [G, Gd, '#7d8f36', G][Math.floor(R0() * 4)]); } };
      const flowerSets = [[R, Pk, Yl], [I, Bl, W], [Yl, R, W], [Pk, W, R], [Bl, I, Yl]];
      br.forEach((b, i) => leaves(b, 30 + i)); rb.forEach((b, i) => leaves(b, 60 + i));
      [...br.map(b => [b, 12]), ...rb.map(b => [b, 11])].forEach(([b, w]) => ink(A, limb(b, [w * 1.5, w, w * 0.6, 4]), { ...bark, ow: 1.8 }));
      ink(A, limb(trunk, [78, 54, 48, 44, 34, 24]), { ...bark, lines: [{ flow: { gap: 10, w: 2.4, margin: 4, minLen: 20, field: [{ guide: curve(trunk), w: 1, fall: 300 }, { vortex: [752, 700, 20, 1], w: 1.4 }, { vortex: [764, 560, 18, -1], w: 1.4 }] } }] });
      ink(A, limb(rt, [58, 42, 40, 34, 28, 20]), { ...bark, lines: [{ flow: { gap: 10, w: 2.4, margin: 4, minLen: 20, field: [{ guide: curve(rt), w: 1, fall: 300 }] } }] });
      // banyan roots
      for (const [x, y, l] of [[640, 440, 150], [662, 540, 120], [612, 340, 150], [866, 372, 150], [900, 360, 110], [846, 470, 90]]) { A.stroke(wavy(x, y, x + 4, y + l, 4, 2, x), { w: 5, color: '#7a3319', halo: 1.4, order: 0.4, taper1: 0.4 }); A.stroke(wavy(x + 10, y, x + 14, y + l * 0.7, 3, 2, x), { w: 3.4, color: '#7a3319', halo: 1.2, order: 0.4, taper1: 0.4 }); }
      let fi = 0; for (const [x, y, r] of [[588, 500, 32], [576, 388, 34], [588, 276, 34], [610, 190, 36], [640, 118, 34], [690, 344, 28], [712, 232, 30], [770, 180, 34], [836, 262, 34], [1050, 130, 34], [936, 180, 26], [1088, 240, 32], [1166, 196, 34], [940, 346, 28], [900, 436, 28], [1010, 290, 24], [660, 424, 24], [850, 128, 28], [1196, 130, 28], [640, 372, 22], [1636, 372, 30], [1600, 262, 34], [1556, 190, 34], [1570, 122, 30], [1740, 130, 30], [1690, 300, 26], [1650, 180, 28], [1800, 236, 30], [1698, 530, 24], [1826, 400, 26], [600, 606, 28], [654, 640, 20], [1112, 394, 24], [1110, 316, 24], [1520, 386, 26], [1506, 250, 24], [1580, 424, 22]]) bloom(A, x, y, r, flowerSets[fi++ % 5], 8, { rot: fi });
      // ---- pavilion
      const px0 = 110, px1 = 546, cx = 328;
      ink(A, rect(84, 832, 560, 50), { fill: [R, Rd], ow: 2.4, lines: [] });
      ink(A, rect(150, 396, 356, 452), { fill: ['#2c4c88', I, Id], ow: 0, order: 0.76, lines: [] });
      A.with({ halo: -1, noKnock: true }, () => { const hs = P.hankin(P.tiling666({ x: 156, y: 400, w: 344, h: 440 }, 27), 1.05); A.pattern(rect(152, 400, 352, 444), c => { c.lineWidth = 3; c.strokeStyle = '#3f639c'; c.beginPath(); for (const l of hs) { l.forEach((q, i) => i ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1])); } c.stroke(); }, { order: 0.8, alpha: 0.75 }); });
      const op = cusped(156, 500, 596, 410, 11);
      ink(A, [[[px0, 372], [px1, 372], [px1, 596], [500, 596], ...[...op].reverse(), [156, 596], [px0, 596]]], { fill: [R, Rd], ow: 2.6, halo: 2, lines: [{ strokes: [offset(op, 10)], w: 3 }] });
      // spandrel scrolls
      for (const k of [-1, 1]) { const sp = curve([[cx + k * 30, 396], [cx + k * 110, 410], [cx + k * 186, 470], [cx + k * 204, 580]]); const v = P.vine(sp, { every: 44, size: 20, seed: 4, turns: 1 }); A.with({ halo: 0.8 }, () => { A.strokes(v.stems, { w: 2.6, color: Yl, order: 0.5, taper: 0.1 }); for (const l of v.leaves) A.part([l], { fill: W, order: 0.3 }); A.dots(v.berries, { color: Yl, order: 0.5 }); }); bloom(A, cx + k * 166, 424, 30, [Yl, W, R], 10); }
      // piers
      for (const x of [110, 500]) { ink(A, rect(x, 596, 46, 250), { fill: [Y, O], ow: 2.4, lines: [] }); ink(A, rect(x + 8, 612, 30, 218), { fill: I, ow: 1.4 }); const v = P.vine(line([x + 23, 828], [x + 23, 612]), { every: 30, size: 10, seed: x, turns: 0.9 }); A.stroke(wavy(x + 23, 828, x + 23, 614, 7, 4), { w: 2.4, color: Yl, halo: 0.6, order: 0.5 }); for (let i = 0; i < 7; i++) bloom(A, x + 23 + (i % 2 ? 5 : -5), 632 + i * 30, 10, [i % 2 ? Pk : Yl, W], 6); for (const y of [590, 838]) ink(A, rrect(x - 7, y, 60, 14, 5), { fill: Yl, ow: 1.8, gold: 0.4 }); }
      // eave with brackets, parapet
      for (let i = 0; i < 13; i++) ink(A, poly([[96 + i * 38, 374], [118 + i * 38, 374], [107 + i * 38, 398]]), { fill: i % 2 ? Yl : I, ow: 1.4 });
      ink(A, poly([[72, 350], [584, 350], [564, 378], [92, 378]]), { fill: [Y, O], ow: 2.4, lines: [{ strokes: Array.from({ length: 31 }, (_, i) => line([84 + i * 16, 352], [98 + i * 15.2, 376])), w: 2 }] });
      ink(A, rect(96, 322, 464, 28), { fill: [R, Rd], ow: 2, lines: [{ shape: Array.from({ length: 23 }, (_, i) => P.petals(106 + i * 20, 336, 4, 1, 8, 6, 0.8)).flat(), rule: 'nonzero' }] });
      // chhatri kiosks
      for (const x of [140, 516]) { for (const d of [-32, 0, 32]) ink(A, rect(x + d - 4, 262, 8, 62), { fill: Yl, ow: 1.6 }); ink(A, [[...cusped(x - 40, x + 40, 276, 262, 5), [x + 44, 254], [x - 44, 254]]], { fill: R, ow: 1.6 }); ink(A, poly([[x - 52, 256], [x + 52, 256], [x + 44, 244], [x - 44, 244]]), { fill: Y, ow: 1.8 }); ink(A, [spl([[x - 40, 244, 1], [x - 44, 222], [x - 22, 196], [x, 182, 1], [x + 22, 196], [x + 44, 222], [x + 40, 244, 1]], true, 8)], { fill: [I, Id], ow: 2, under: W, lines: [{ strokes: [-0.6, -0.2, 0.2, 0.6].map(u => curve([[x, 184], [x + u * 40, 214], [x + u * 44, 242]])), w: 2 }] }); A.stroke(line([x, 182], [x, 158]), { w: 5, color: Yl, gold: 0.7, order: 0.5 }); A.dots([[x, 168, 6]], { color: Yl, gold: 0.7, order: 0.5 }); }
      // basket of cotton + oil lamp
      ink(A, blob([[168, 850], [160, 812], [214, 806], [268, 812], [262, 850]]), { fill: [O, '#7d4316'], ow: 2, lines: [{ strokes: Array.from({ length: 4 }, (_, i) => wavy(160, 818 + i * 9, 268, 818 + i * 9, 3, 9)), w: 2 }] }); for (const [x, y, r] of [[176, 804, 16], [200, 796, 20], [228, 796, 19], [250, 806, 15], [214, 782, 15]]) ink(A, circ(x, y, r, 24), { fill: W, ow: 1.4, lines: [{ strokes: [spiral(x, y, r * 0.6, 2, x, 1.2, 20)], w: 1.8, ink: '#c9a86a' }] });
    });
    // kolam: dots, then one line that loops round them all (on the plinth step)
    B.layer('kolam', A => {
      const pit = 23, cols = 19, rows = 2;
      const X0 = 26, Y0 = 34; A.dots(Array.from({ length: cols * rows }, (_, i) => [X0 + (i % cols) * pit, Y0 + Math.floor(i / cols) * pit, 3]), { color: W, halo: 0, order: ['each', (d, i, n) => 0.05 + 0.25 * i / n] });
      const l1 = [], l2 = []; for (let i = 0; i <= 300; i++) { const u = i / 300, x = X0 - pit / 2 + u * cols * pit, a = (x - X0 + pit / 2) / pit * Math.PI; l1.push([x, Y0 + pit / 2 - Math.cos(a) * pit * 0.98]); l2.push([x, Y0 + pit / 2 + Math.cos(a) * pit * 0.98]); }
      const l3 = []; const l4 = []; for (let i = 0; i <= 300; i++) { const u = i / 300, x = X0 - pit / 2 + u * cols * pit, a = (x - X0 + pit / 2) / pit * Math.PI; l3.push([x, Y0 - Math.abs(Math.sin(a * 0.5 + 0.8)) * 0 - Math.sin(a) ** 2 * 11]); l4.push([x, Y0 + pit + Math.sin(a) ** 2 * 11]); }
      for (const [l, a, b] of [[l1, 0.2, 0.75], [l2, 0.35, 0.85], [l3, 0.5, 0.95], [l4, 0.55, 1]]) { l.open = true; A.stroke(l, { w: 3.2, color: W, halo: 0, noKnock: true, order: { along: [a, b] } }); }
    }, { x: 100, y: 815, w: 470, h: 100 });
    // ------------------------------------------------ lotus tank + stepwell in front of the tree
    B.layer('pond', A => {
      const OX = -530, OY = -760; A.at({ x: OX, y: OY }, () => {
        const cx = 785, top = 846;
        // descending stair courses, each faced with triangular flights
        for (let j = 0; j < 4; j++) { const w = 232 - j * 24, y0 = 838 + j * 22, y1 = 1000 - j * 8; ink(A, blob([[cx - w, y0 + 6], [cx - w * 0.6, y0 - 8], [cx, y0 - 14], [cx + w * 0.6, y0 - 8], [cx + w, y0 + 6], [cx + w * 0.96, y1 - 20], [cx + w * 0.5, y1], [cx - w * 0.5, y1], [cx - w * 0.96, y1 - 20]]), { fill: [[Y, O], [Pk, R], [Yl, Y], [R, Rd]][j], ow: 2.2, lines: j < 3 ? [{ strokes: Array.from({ length: 3 }, (_, q) => curve([[cx - w, y0 + 6 + q * 6], [cx, y0 - 14 + q * 6], [cx + w, y0 + 6 + q * 6]])), w: 1.8 }, { shape: Array.from({ length: 13 }, (_, i) => { const x = cx - w + (i + 0.5) * w * 2 / 13, yb = y0 + 4 - Math.cos((x - cx) / w * 1.5) * 12 + 16; return [[x - 12, yb], [x - 8, yb], [x - 8, yb - 5], [x - 4, yb - 5], [x - 4, yb - 10], [x + 4, yb - 10], [x + 4, yb - 5], [x + 8, yb - 5], [x + 8, yb], [x + 12, yb]]; }), rule: 'nonzero', ink: K }] : [] }); }
        ink(A, blob([[cx - 150, 926], [cx - 90, 904], [cx, 898], [cx + 90, 904], [cx + 150, 926], [cx + 140, 966], [cx + 70, 984], [cx - 70, 984], [cx - 140, 966]]), { fill: [I, Id], under: '#7fa0c4', ow: 2.4, order: 0.78, lines: [{ flow: { gap: 12, w: 2.6, margin: 5, minLen: 18, field: [{ dir: 0.02 }, { fn: (x, y) => [1, Math.sin(x * 0.06 + y * 0.1) * 0.7], w: 1 }, { vortex: [cx - 70, 944, 20, 1], w: 1.2 }, { vortex: [cx + 60, 950, 20, -1], w: 1.2 }] } }] });
        // little arched niches flanking the tank
        for (const k of [-1, 1]) for (let q = 0; q < 2; q++) { const x = cx + k * (196 - q * 0), y = 952 - q * 44; ink(A, [[[x - 12, y], ...arc(x, y - 18, 12, Math.PI, TAU, 10), [x + 12, y]]], { fill: Id, ow: 1.8, order: 0.76 }); A.dots([[x, y - 12, 4]], { color: Yl, halo: 1, order: 0.5, gold: 0.6 }); }
        for (const [x, y, r] of [[cx - 104, 938, 20], [cx + 104, 944, 22], [cx - 24, 972, 20], [cx + 40, 920, 16], [cx - 60, 916, 14]]) ink(A, ell(x, y, r * 1.2, r * 0.46), { fill: G, ow: 1.5, order: 0.86, lines: [{ strokes: [0, 1, 2, 3, 4, 5].map(i => line([x, y], [x + Math.cos(i * 1.05) * r * 1.1, y + Math.sin(i * 1.05) * r * 0.42])), w: 1.4 }] });
      });
    }, { x: 530, y: 760, w: 510, h: 260 });
    B.sprite('lotus', { w: 110, h: 100, ox: 55, oy: 84 }, A => { for (const [a, l, w, c] of [[-2.62, 46, 22, Pk], [-0.52, 46, 22, Pk], [-2.25, 56, 24, W], [-0.9, 56, 24, W], [-1.95, 60, 24, Pk], [-1.2, 60, 24, Pk], [-1.57, 64, 26, W]]) ink(A, petal(0, 0, l, w, a, 0.6), { fill: [c, c === W ? Pk : R], ow: 1.8, lines: [{ strokes: [line([Math.cos(a) * l * 0.3, Math.sin(a) * l * 0.3], [Math.cos(a) * l * 0.8, Math.sin(a) * l * 0.8])], w: 1.5, ink: R }] }); });
    B.sprite('fish', { w: 120, h: 60, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU); ink(A, poly([[34, s * 4], [56, -16 + s * 10], [50, s * 8], [56, 16 + s * 10]]), { fill: R, ow: 1.5 }); ink(A, blob([[-44, 0], [-20, -15], [14, -11], [40, s * 4], [14, 11], [-20, 14]]), { fill: [Yl, O], ow: 1.8, lines: [{ strokes: Array.from({ length: 5 }, (_, i) => curve([[-14 + i * 10, -12], [-8 + i * 10, 0], [-14 + i * 10, 11]])), w: 1.8, ink: R }] }); A.dots([[-30, -3, 3]], { color: K, halo: 1 }); });
    // ------------------------------------------------ bottom dado: one ajrakh repeat, three blocks
    const RW = 1760 / 7, RH = 116; const cxs = RW / 2, cys = RH / 2;
    const motif = { ros: () => P.petals(cxs, cys, 12, 16, 22, 11, 0), pais: [[46, cys, 24, 1.1, 1], [RW - 46, cys, 24, -1.1, -1]] };
    B.sprite('rep0', { w: RW, h: RH, ox: 0, oy: 0 }, A => { // iron black: outlines and fine work
      const k = (pl, w = 2) => A.stroke(pl, { w, color: K, halo: 0, noKnock: true, order: 0.1 });
      for (const y of [2, 10, RH - 10, RH - 2]) k(line([0, y], [RW, y]), 2.4); for (let i = 0; i < 24; i++) { A.dots([[(i + 0.5) * RW / 24, 6, 2.4], [(i + 0.5) * RW / 24, RH - 6, 2.4]], { color: K, halo: 0, noKnock: true, order: 0.1 }); }
      for (const r of [48, 43]) k(circ(cxs, cys, r)[0], 2); for (const q of motif.ros()) k(q, 1.8); k(circ(cxs, cys, 13)[0], 2); A.dots(P.ringDots(cxs, cys, 45.5, 28, 1.6), { color: K, halo: 0, noKnock: true, order: 0.1 }); A.dots(P.ringDots(cxs, cys, 7, 6, 1.8), { color: K, halo: 0, noKnock: true, order: 0.1 });
      for (const [x, y, s, r, f] of motif.pais) { k(P.paisley(x, y, s * 1.7, r, f)[0], 2); k(P.paisley(x, y, s * 1.2, r, f)[0], 1.6); A.dots(resample(P.paisley(x, y, s * 1.45, r, f)[0], 9).map(q => [q[0], q[1], 1.4]), { color: K, halo: 0, noKnock: true, order: 0.1 }); }
      for (const [x, y] of [[0, cys], [RW, cys]]) { for (const q of P.petals(x, y, 8, 4, 16, 9, 0.39)) k(q, 1.6); } for (const x of [cxs - 70, cxs + 70]) for (const q of [...petal(x, 22, 26, 11, 1.57), ...petal(x, RH - 22, 26, 11, -1.57)]) k(q, 1.6);
    });
    B.sprite('rep1', { w: RW, h: RH, ox: 0, oy: 0 }, A => { // madder: the ground, with motifs left in reserve
      const holes = [...circ(cxs, cys, 50), ...motif.pais.flatMap(([x, y, s, r, f]) => P.paisley(x, y, s * 1.85, r, f)), ...P.petals(0, cys, 8, 2, 22, 13, 0.39), ...P.petals(RW, cys, 8, 2, 22, 13, 0.39), ...[cxs - 70, cxs + 70].flatMap(x => [...petal(x, 20, 30, 15, 1.57), ...petal(x, RH - 20, 30, 15, -1.57)])];
      const bits = []; const Rn = rng(5); for (let i = 0; i < 60; i++) { const x = Rn() * RW, y = 14 + Rn() * (RH - 28); bits.push([x, y, 1.7]); }
      A.part(rect(0, 12, RW, RH - 24), { fill: [R, '#8a2016'], halo: 0, order: 0.2, lines: [{ shape: holes, rule: 'nonzero' }, { dots: bits }] });
      A.part(P.petals(cxs, cys, 12, 18, 18, 8, 0), { fill: R, halo: 0, order: 0.2 }); for (const [x, y, s, r, f] of motif.pais) A.part(P.paisley(x, y, s * 0.8, r, f), { fill: R, halo: 0, order: 0.2 });
    });
    B.sprite('rep2', { w: RW, h: RH, ox: 0, oy: 0 }, A => { // indigo + weld yellow
      A.part([...circ(cxs, cys, 42), ], { fill: I, halo: 0, order: 0.2, lines: [{ shape: P.petals(cxs, cys, 12, 13, 28, 14, 0), rule: 'nonzero' }, { dots: [[cxs, cys, 15]] }] }); A.dots([[cxs, cys, 11]], { color: Y, halo: 0, order: 0.2 });
      for (const [x, y, s, r, f] of motif.pais) A.part(P.paisley(x, y, s * 1.62, r, f), { fill: I, halo: 0, order: 0.2, lines: [{ shape: P.paisley(x, y, s * 1.18, r, f) }] });
      for (const x of [0, RW]) A.part(P.petals(x, cys, 8, 5, 14, 7, 0.39), { fill: Y, halo: 0, order: 0.2 }); for (const x of [cxs - 70, cxs + 70]) A.part([...petal(x, 24, 22, 8, 1.57), ...petal(x, RH - 24, 22, 8, -1.57)], { fill: I, halo: 0, order: 0.2 });
      A.part([...rect(0, 2, RW, 8), ...rect(0, RH - 10, RW, 8)], { fill: I, halo: 0, order: 0.2, lines: [{ dots: Array.from({ length: 48 }, (_, i) => [(i % 24 + 0.5) * RW / 24, i < 24 ? 6 : RH - 6, 3.4] ) }] });
    });
    // the carved teak blocks, seen from above, with the printer's hand
    const wood = (A, w, h, stain) => {
      ink(A, rrect(-w / 2 - 4, -h / 2 + 4, w + 8, h + 6, 10), { fill: stain, ow: 2.4, order: 0.1 });
      ink(A, rrect(-w / 2, -h / 2, w, h - 4, 9), { fill: ['#dba461', '#a9692f'], ow: 3, order: 0.1, raise: 0.0, lines: [{ flow: { gap: 8, w: 1.8, margin: 4, minLen: 30, field: [{ dir: 0.02 }, { fn: (x, y) => [1, Math.sin(x * 0.03 + y * 0.12) * 0.3] }, { vortex: [w * 0.3, h * 0.1, 18, 1], w: 1.2 }] }, ink: '#8a5122' }] });
      ink(A, rrect(-w / 2 + 9, -h / 2 + 8, w - 18, h - 20, 7), { fill: 'rgba(0,0,0,0)', halo: -1, noKnock: true, ow: 1.8, oc: '#7a4319', order: 0.1 });
      for (const [x, y] of [[-0.42, -0.34], [0.42, -0.34], [-0.42, 0.3], [0.42, 0.3]]) A.dots([[x * w, y * h, 6]], { color: K, halo: 0, order: 0.1 });
      ink(A, rrect(-w * 0.16, -h * 0.17, w * 0.32, h * 0.32, 14), { fill: ['#efc98c', '#b97c3e'], ow: 3, order: 0.1, lines: [{ flow: { gap: 7, w: 1.6, margin: 3, field: [{ dir: 0 }] }, ink: '#6b3917' }] });
    };
    for (const [i, c] of [[0, '#2b1a14'], [1, R], [2, I]]) B.sprite('block' + i, { w: RW + 60, h: 330, ox: RW / 2 + 30, oy: 110, res: 0.8 }, A => { wood(A, RW, RH, c); const sk = SKIN[['copper', 'sienna', 'copper'][i]]; A.with({ order: 0.1 }, () => { A.part(limb([[34, 216], [22, 120], [4, 40]], [58, 46, 40]), { fill: sk[0], halo: 2.6, lines: [{ flow: { gap: 12, w: 2.2, margin: 6, minLen: 20, field: [{ dir: 1.4 }] } }] }); ink(A, limb([[40, 218], [30, 150]], [76, 62], { cap1: false }), { fill: [W, '#d9c390'], ow: 2.2, lines: [{ flow: { gap: 12, w: 2, margin: 5, minLen: 16, field: [{ dir: 1.45 }] }, ink: '#b59a62' }] }); A.stroke(line([2, 106], [40, 100]), { w: 9, color: Y, gold: 0.8, halo: 1.5 }); A.part(blob([[-34, 2], [-26, -24], [4, -32], [30, -22], [36, 4], [26, 34], [-4, 42], [-28, 30]]), { fill: sk[0], halo: 2.6, lines: [{ strokes: [curve([[-18, -26], [-20, -8], [-30, 4]]), curve([[0, -30], [-2, -8], [-8, 4]]), curve([[16, -28], [16, -8], [12, 4]])], w: 2.6 }] }); A.part(limb([[-30, 26], [-44, 6], [-36, -14]], [20, 18, 12]), { fill: sk[0], halo: 2 }); }); });
    B.sprite('bigblock', { w: 560, h: 480, ox: 280, oy: 232, n: 3, res: 0.6 }, (A, ph, i) => { const c = ['#2b1a14', R, I][i]; wood(A, 500, 390, c); for (const k of [-1, 1]) ink(A, rrect(k * 200 - 40, -150, 80, 300, 20), { fill: ['#e2b06e', '#b0713a'], ow: 3, order: 0.1, lines: [{ strokes: [spiral(k * 200, -90, 26, 4, 0, 2, 40), spiral(k * 200, 0, 26, 4, 0, 2, 40), spiral(k * 200, 90, 26, 4, 0, 2, 40)], w: 4, ink: '#8a5122' }] }); });
    // ------------------------------------------------ border: elephants and geese
    B.layer('frame', A => {
      const TH = 64; const ele = (x, y, s, f) => A.at({ x, y, s, sx: f }, () => { A.part([...blob([[-40, -18], [-34, -40], [-6, -50], [22, -44], [34, -52], [48, -46], [54, -30], [60, -10], [58, 4], [70, 6], [66, 13], [52, 10], [48, -8], [42, -14], [34, -10], [34, 14], [22, 14], [20, -6], [-16, -6], [-18, 14], [-32, 14], [-34, -4], [-40, 0]])], { fill: W, halo: 0, lines: [] }); A.part(rrect(-18, -50, 30, 36, 4), { fill: R, halo: 2, lines: [{ dots: [[-3, -32, 5]], ink: Yl }] }); A.part(blob([[30, -44], [42, -40], [42, -26], [34, -20], [28, -32]]), { fill: I, halo: 1.6 }); A.dots([[48, -36, 2.4]], { color: K, halo: 0 }); A.stroke(curve([[-40, -22], [-48, -10], [-46, 2]]), { w: 3, color: W, halo: 0 }); });
      const goose = (x, y, s, f) => A.at({ x, y, s, sx: f }, () => { A.part(blob([[-44, -22], [-28, -18], [-4, -32], [18, -28], [22, -44], [30, -54], [42, -50], [56, -44], [42, -40], [36, -28], [34, -8], [14, 6], [-14, 4], [-32, -8]]), { fill: Yl, halo: 0, lines: [{ strokes: [curve([[-20, -10], [4, -20], [22, -12]]), curve([[-14, -2], [4, -10], [18, -4]])], w: 2.4, ink: R }] }); A.part(petal(-8, -12, 34, 18, Math.PI + 0.3, 0.5), { fill: G, halo: 1.4 }); A.dots([[36, -46, 2.4]], { color: K, halo: 0 }); A.stroke(line([2, 4], [0, 14]), { w: 3, color: O, halo: 0 }); A.stroke(line([12, 4], [12, 14]), { w: 3, color: O, halo: 0 }); });
      P.frame(A, 14, 14, 1892, 1052, TH, (A, len, side) => {
        const go = () => {
          A.with({ halo: 0, order: ['lin', 0, 0, len, 0, 0.05, 0.95] }, () => {
            A.part(rect(-TH, 0, len + TH * 2, 9), { fill: K, halo: 0 }); A.dots(Array.from({ length: Math.round(len / 12) }, (_, i) => [(i + 0.5) * len / Math.round(len / 12), 4.5, 2.6]), { color: W, halo: 0 });
            A.part(rect(-TH, 11, len + TH * 2, 40), { fill: side % 2 ? [I, Id] : [I, Id], halo: 0 });
            A.part(P.triangles(0, 53, len, 10, Math.round(len / 13), true), { fill: R, halo: 0 }); A.part(rect(0, 51.5, len, 2), { fill: K, halo: 0 });
          });
          const n = Math.round(len / 92), u = len / n; for (let i = 0; i < n; i++) { const x = (i + 0.5) * u, o = 0.06 + 0.88 * (i + 0.5) / n; A.with({ order: o }, () => { i % 2 ? goose(x, 41, 0.5, side === 2 ? -1 : 1) : ele(x, 41, 0.56, side === 2 ? -1 : 1); const fx = (i + 1) * u; if (i < n - 1) { A.part(P.petals(fx, 31, 8, 3, 11, 7), { fill: R, halo: 1 }); A.dots([[fx, 31, 3.5]], { color: Yl, halo: 0.6 }); for (const k of [-1, 1]) A.part(petal(fx, 31 + k * 9, 11, 6, k * Math.PI / 2), { fill: '#7d9a3c', halo: 0.5 }); } }); }
        };
        if (side === 2) A.at({ x: len, y: TH, r: Math.PI }, () => { A.at({ y: 0 }, () => { // upright feet-out copy of the band
          A.with({ halo: 0, order: ['lin', len, 0, 0, 0, 0.05, 0.95] }, () => { A.part(rect(-TH, TH - 9, len + TH * 2, 9), { fill: K, halo: 0 }); A.dots(Array.from({ length: Math.round(len / 12) }, (_, i) => [(i + 0.5) * len / Math.round(len / 12), TH - 4.5, 2.6]), { color: W, halo: 0 }); A.part(rect(-TH, 13, len + TH * 2, 40), { fill: [I, Id], halo: 0 }); A.part(P.triangles(0, 1, len, 10, Math.round(len / 13)), { fill: R, halo: 0 }); A.part(rect(0, 11, len, 2), { fill: K, halo: 0 }); });
          const n = Math.round(len / 92), u = len / n; for (let i = 0; i < n; i++) { const x = (i + 0.5) * u; A.with({ order: 0.06 + 0.88 * (i + 0.5) / n }, () => { i % 2 ? goose(x, 43, 0.5, 1) : ele(x, 43, 0.56, 1); const fx = (i + 1) * u; if (i < n - 1) { A.part(P.petals(fx, 33, 8, 3, 11, 7), { fill: R, halo: 1 }); A.dots([[fx, 33, 3.5]], { color: Yl, halo: 0.6 }); for (const k of [-1, 1]) A.part(petal(fx, 33 + k * 9, 11, 6, k * Math.PI / 2), { fill: '#7d9a3c', halo: 0.5 }); } }); }
        }); }); else go();
        }); for (const [cx0, cy0] of [[14, 14], [1906 - TH, 14], [14, 1066 - TH], [1906 - TH, 1066 - TH]]) A.at({ x: cx0 + TH, y: cy0 }, () => {
        A.part(rect(-TH, 0, TH, TH), { fill: R, halo: 0, order: 0.02 }); A.part(rect(-TH + 5, 5, TH - 10, TH - 10), { fill: I, halo: 2, order: 0.02 }); for (const q of P.petals(-TH / 2, TH / 2, 8, 4, 20, 13)) A.part([q], { fill: Yl, halo: 1.4, order: 0.03 }); for (const q of P.petals(-TH / 2, TH / 2, 8, 2, 12, 8, 0.39)) A.part([q], { fill: R, halo: 1, order: 0.03 }); A.dots([[-TH / 2, TH / 2, 5]], { color: W, halo: 1, order: 0.03 });
      });
    });
    // foreground: cropped paisley trees, banana leaves, marigold swags from the top border
    B.layer('fore', A => {
      const ban = (x, y, l, w, a, c) => { const tip = [x + Math.cos(a) * l, y + Math.sin(a) * l], m = [x + Math.cos(a - 0.1) * l * 0.5, y + Math.sin(a - 0.1) * l * 0.5]; ink(A, limb([[x, y], m, tip], [w * 0.3, w, w * 0.8, 3]), { fill: c, under: '#b9c77a', ow: 2.4, lines: [{ strokes: [curve([[x, y], m, tip])], w: 4 }, { flow: { gap: 10, w: 2, margin: 3, minLen: 12, field: [{ dir: a + 1.15 }] } }] }); };
      for (const [x, k] of [[66, 1], [1858, -1]]) { for (const [l, w, a, c] of [[220, 50, -1.12, [G, Gd]], [190, 46, -0.62, ['#7d8f36', G]], [150, 42, -0.2, [G, Gd]], [230, 46, -1.48, [Gd, '#1d3420']]]) ban(x, 1000, l, w, k > 0 ? a : Math.PI - a, c); }
      for (const [x, y, r, f] of [[128, 990, 30, 0], [1800, 988, 30, 1], [174, 1000, 24, 2], [1750, 998, 24, 3]]) bloom(A, x, y, r, [[R, Pk, Yl], [I, Bl, W], [Yl, O, R], [Pk, W, R]][f], 9);
      // swags
      for (let i = 0; i < 9; i++) { const x0 = 90 + i * 193.3, x1 = x0 + 193.3, cv = curve([[x0, 78], [lerp(x0, x1, 0.5), 78 + (i % 2 ? 34 : 44)], [x1, 78]], 18); for (let j = 0; j <= 26; j++) { const [x, y] = at(cv, j / 26); ink(A, circ(x, y, 8.5, 14), { fill: (j % 5 === 2) ? R : j % 2 ? Yl : O, ow: 1.2, halo: 0.8, lines: [{ strokes: [spiral(x, y, 5.5, 1, j, 1.3, 14)], w: 1.4, ink: R }] }); } for (let q = 0; q < 4; q++) ink(A, petal(x1, 80 + q * 4, 30 - q * 3, 13, Math.PI / 2 + (q - 1.5) * 0.42, 0.5), { fill: G, ow: 1.2, halo: 0.8 }); }
    });
    // ------------------------------------------------ living things
    B.sprite('spinner', { w: 480, h: 480, ox: 190, oy: 440, n: 8 }, (A, ph) => spinner(A, ph));
    B.sprite('wheel', { w: 232, h: 232 }, A => {
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ink(A, limb([[Math.cos(a) * 12, Math.sin(a) * 12], [Math.cos(a) * 50, Math.sin(a) * 50], [Math.cos(a) * 90, Math.sin(a) * 90]], [9, 12, 7]), { fill: i % 2 ? R : Yl, ow: 1.6 }); A.dots([[Math.cos(a) * 50, Math.sin(a) * 50, 4]], { color: i % 2 ? Yl : R, halo: 0.8, order: 0.4 }); }
      ink(A, ring(0, 0, 84, 102), { fill: ['#8a4419', '#5c2a10'], ow: 2.6, rule: 'evenodd', lines: [{ dots: P.ringDots(0, 0, 93, 24, 4), ink: Yl }] }); A.stroke(circ(0, 0, 106)[0], { w: 3, color: W, halo: 1.2, order: 0.3 }); ink(A, circ(0, 0, 20), { fill: Yl, gold: 0.8, ow: 2, lines: [{ dots: P.ringDots(0, 0, 12, 8, 2.4), ink: R }] }); ink(A, limb([[0, 0], [20, 0]], [8, 8]), { fill: K, ow: 0 });
    });
    B.sprite('stand', { w: 330, h: 150, ox: 120, oy: 124 }, A => { ink(A, limb([[-100, 10], [180, 10]], [18]), { fill: ['#8a4419', '#5c2a10'], ow: 2.2 }); for (const x of [0, 152]) ink(A, limb([[x, 8], [x, x ? -44 : -100]], [16, 12]), { fill: [O, '#7a3d14'], ow: 2, lines: [{ strokes: [line([x - 10, -10], [x + 10, -10]), line([x - 10, -24], [x + 10, -24])], w: 2 }] }); ink(A, limb([[130, -48], [192, -56]], [6, 3]), { fill: K, ow: 0 }); ink(A, ell(154, -52, 20, 10, -0.13), { fill: W, ow: 1.8, lines: [{ strokes: Array.from({ length: 6 }, (_, i) => line([140 + i * 5, -62], [143 + i * 5, -42])), w: 1.6, ink: R }] }); });
    // far legs / near legs
    for (const [nm, hind, far] of [['lFF', 0, 1], ['lFH', 1, 1], ['lNF', 0, 0], ['lNH', 1, 0]]) B.sprite(nm, { w: 300, h: 300, ox: 160, oy: 80, n: 8, res: 0.9 }, (A, ph) => eleLeg(A, ph, hind, far));
    B.sprite('eBody', { w: 460, h: 350, ox: 180, oy: 450 - 0 }, A => ink(A, blob(BODY), { fill: eFill, under: eUnder, ow: 3.4, order: 0.76, lines: [{ flow: { gap: 14, w: 3, margin: 7, minLen: 24, field: [{ contour: 1 }, { vortex: [-96, -214, 54, -1], w: 1.8 }, { vortex: [196, -236, 60, 1], w: 1.8 }, { dir: 0.1, w: 0.2 }] } }] }));
    B.sprite('eTail', { w: 90, h: 240, ox: 40, oy: 20 }, A => { A.part(limb([[0, 0], [18, 70], [10, 150]], [22, 12, 8]), { fill: eFill, under: eUnder, halo: 2, order: 0.76 }); for (let i = 0; i < 7; i++) A.part(limb([[10, 148], [6 + i * 2, 180], [i * 6 - 8, 206]], [5, 6, 2]), { fill: K, halo: 1, order: 0.05 }); A.part(limb([[2, 130], [20, 128]], [8]), { fill: Y, gold: 1, halo: 1, order: 0.5 }); });
    B.sprite('eHead', { w: 300, h: 320, ox: 340, oy: 490 }, A => eleHead(A));
    B.sprite('eTrunk', { w: 300, h: 330, ox: 490, oy: 400, n: 8 }, (A, ph) => eleTrunk(A, ph));
    B.sprite('eTusk', { w: 190, h: 110, ox: 390, oy: 300 }, A => { ink(A, limb([[-246, -228], [-290, -212], [-334, -216], [-368, -246]], [26, 25, 19, 4]), { fill: [W, '#dcbf85'], ow: 2.4, order: 0.3, lines: [{ flow: { gap: 8, w: 1.4, margin: 3, minLen: 20, field: [{ dir: 0.2 }] }, ink: '#c9a86a' }] }); ink(A, limb([[-288, -226], [-284, -198]], [12]), { fill: Yl, gold: 1, raise: 0.7, ow: 1.4, order: 0.5 }); ink(A, limb([[-330, -228], [-328, -204]], [9]), { fill: Yl, gold: 1, raise: 0.7, ow: 1.4, order: 0.5 }); });
    B.sprite('eEar', { w: 150, h: 260, ox: 0, oy: 0 }, A => A.at({ x: 190, y: 440 }, () => eleEar(A)));
    B.sprite('eCloth', { w: 380, h: 400, ox: 150, oy: 450 }, A => eleCloth(A));
    B.sprite('eHow', { w: 370, h: 370, ox: 130, oy: 780 }, A => howdah(A));
    B.sprite('mahout', { w: 250, h: 310, ox: 140, oy: 280, n: 4 }, (A, ph) => { const s = Math.sin(ph * TAU); A.at({ s: 0.56, sx: -1 }, () => figure(A, { pose: { lean: 4 + s * 3, legN: [40, 96], legF: [30, 90], armN: [50, -10 + s * 8], armF: [30, -20], ground: false }, skin: SKIN.sienna, hair: false, torso: { fill: [G, Gd], under: W }, sleeve: { to: 'el', fill: [G, Gd], under: W, w: [40, 34] }, st: { order: 0.5 }, lower: { path: J => blob([[J.hip[0] - 34, J.hip[1] - 4], [J.hip[0] + 30, J.hip[1] - 6], [J.hip[0] + 84, J.hip[1] + 40], [J.hip[0] + 96, J.hip[1] + 84], [J.hip[0] + 60, J.hip[1] + 92], [J.hip[0] + 20, J.hip[1] + 50], [J.hip[0] - 32, J.hip[1] + 26]]), fill: [R, Rd], under: W }, belt: { color: Y, ink: R }, hands: 'grip', bangle: { color: Y, gold: 1 }, hat: A => { ink(A, blob([[40, -24], [36, -48], [14, -70], [-20, -72], [-50, -52], [-60, -22], [-46, -6], [-20, -20], [10, -30]]), { fill: [Yl, O], ow: 2, order: 0.5, lines: [{ flow: { gap: 8, w: 2, margin: 3, minLen: 12, field: [{ dir: -0.4 }, { vortex: [-8, -48, 18, 1], w: 1.4 }] } }] }); A.part(limb([[-50, -14], [-70, 20], [-62, 60]], [16, 18, 6]), { fill: O, halo: 1.6, order: 0.5 }); }, front: (A, J) => { A.stroke(line([J.haN[0] - 20, J.haN[1] + 50], [J.haN[0] + 16, J.haN[1] - 70]), { w: 6, color: K, halo: 1.6, order: 0.05 }); A.stroke(curve([[J.haN[0] + 14, J.haN[1] - 62], [J.haN[0] + 34, J.haN[1] - 70], [J.haN[0] + 34, J.haN[1] - 46]]), { w: 6, color: Y, gold: 0.8, halo: 1.4, order: 0.5 }); } })); });
    B.sprite('danceA', { w: 400, h: 400, ox: 200, oy: 384, n: 8 }, (A, ph) => dancer(A, ph, { k: -1, skin: 'copper', cols: [R, Rd, Yl, O], bl: [G, Gd] }));
    B.sprite('danceB', { w: 400, h: 400, ox: 200, oy: 384, n: 8 }, (A, ph) => dancer(A, ph, { k: 1, skin: 'sienna', cols: [I, Id, R, Rd], bl: [Yl, Y] }));
    // sari cloth streaming from the wheel to the trunk, turning over once on the way
    B.sprite('sari', { w: 460, h: 420, ox: 50, oy: 340, n: 8 }, (A, ph) => {
      const S = sariGeo(ph), { cv, hw, n } = S; const ord = { order: ['lin', 0, 0, 330, -240, 0.1, 0.95], ko: ['lin', 0, 0, 330, -240, 0, 0.85] };
      const side = (f, a, b) => { const o = []; for (let i = a; i <= b; i++) o.push(S.pt(i, f)); o.open = true; return o; };
      const face = (a, b, fill, bc, mot, under) => { const p = [[...side(1, a, b), ...[...side(-1, a, b)].reverse()]]; ink(A, p, { fill, under: W, ow: 2.4, ...ord, lines: [{ strokes: [side(0.42, a, b), side(0.1, a, b), side(-0.26, a, b)], w: 2, taper: 0.15 }, { strokes: [side(0.84, a, b), side(-0.84, a, b)], w: 14, ink: bc }, { strokes: [side(0.68, a, b), side(-0.68, a, b)], w: 2, ink: K }, { dots: Array.from({ length: Math.floor((b - a) / 2) }, (_, i) => [...S.pt(a + i * 2 + 1, 0.84), 3]).concat(Array.from({ length: Math.floor((b - a) / 2) }, (_, i) => [...S.pt(a + i * 2 + 1, -0.84), 3])), ink: mot }, { ink: W, pat: c => { for (let i = a + 3; i < b - 2; i += 5) for (const f of (i % 2 ? [0.3, -0.36] : [-0.06])) { const q = S.pt(i, f); posy(c, q[0], q[1], Math.min(8, Math.abs(hw[i]) * 0.16), under, bc === Yl ? Rd : W, 6); } } }] }); };
      // the far half shows the reverse (weld yellow), the near half the madder face
      face(S.tw, n - 1, { lin: [120, -100, 320, -240], stops: [O, Yl, Y] }, R, Yl, I); face(0, S.tw, { lin: [0, 0, 190, -130], stops: [R, Rd, R] }, Yl, R, Yl);
    });
    // peacock
    B.sprite('plume', { w: 80, h: 250, ox: 40, oy: 240 }, A => { // feather pointing up from 0,0
      A.stroke(line([0, 0], [0, -212]), { w: 3.4, color: Yl, halo: 0, order: 0.5, gold: 0.4 }); for (let i = 0; i < 22; i++) { const y = -24 - i * 7.6, l = 11 + Math.sin(i / 22 * 2.6) * 10; for (const k of [-1, 1]) A.stroke(curve([[0, y], [k * l * 0.6, y - 8], [k * l, y - 20]]), { w: 3, color: i % 3 ? G : '#7d9a3c', halo: 0.3, taper1: 0.4, order: 0.6 }); }
      ink(A, ell(0, -206, 24, 30), { fill: ['#8fae4a', G], ow: 1.6, order: 0.86 }); ink(A, ell(0, -207, 18, 23), { fill: Yl, ow: 1, order: 0.5, gold: 0.8 }); ink(A, ell(0, -204, 13.5, 17), { fill: '#2f8a86', ow: 1, order: 0.8 }); A.part([spl([[0, -216], [9, -210], [8, -198], [0, -191], [-8, -198], [-9, -210]], true, 8)], { fill: Id, halo: 0.8, order: 0.76 });
    });
    B.sprite('peacock', { w: 210, h: 230, ox: 100, oy: 200, n: 4 }, (A, ph) => { const s = Math.sin(ph * TAU) * 3; for (const x of [-8, 12]) A.stroke(curve([[x, -34], [x + 4, -14], [x, 4]]), { w: 5, color: O, halo: 1 }); A.stroke(line([-18, 5], [16, 5]), { w: 4, color: O }); ink(A, blob([[-44, -60], [-26, -84], [6, -92], [20, -116], [22, -146 + s], [30, -164 + s], [46, -164 + s], [52, -150 + s], [44, -136 + s], [42, -104], [36, -70], [20, -42], [-8, -30], [-34, -40]]), { fill: ['#2a5a9c', I], under: '#9fc0dc', ow: 2.2, order: 0.78, lines: [{ flow: { gap: 8, w: 2, margin: 4, minLen: 10, field: [{ guide: curve([[38, -150], [34, -100], [10, -60], [-30, -50]]), w: 1, fall: 200 }] } }] }); ink(A, blob([[-60, -52], [-30, -78], [4, -70], [2, -46], [-30, -34]]), { fill: ['#2f8a86', Gd], ow: 1.8, order: 0.82, lines: [{ strokes: [curve([[-50, -50], [-24, -62], [0, -58]]), curve([[-44, -42], [-20, -52], [0, -48]])], w: 2 }] }); ink(A, poly([[50, -154 + s], [70, -146 + s], [50, -144 + s]]), { fill: Yl, ow: 1.2 }); A.part(ell(40, -152 + s, 9, 7), { fill: W, halo: 1 }); A.dots([[41, -152 + s, 3.4]], { color: K, halo: 0 }); for (let i = 0; i < 5; i++) { const a = -1.9 + i * 0.22; A.stroke(line([36, -164 + s], [36 + Math.cos(a) * 24, -164 + s + Math.sin(a) * 24]), { w: 2, color: K, halo: 0.5 }); A.dots([[36 + Math.cos(a) * 26, -164 + s + Math.sin(a) * 26, 4]], { color: Yl, halo: 0.8 }); } });
    B.sprite('peaTrain', { w: 200, h: 420, ox: 100, oy: 160 }, A => { // perched, train hanging
      for (let i = 0; i < 11; i++) { const x = -34 + (i % 4) * 14 + Math.floor(i / 4) * 6, l = 120 + i * 11; A.stroke(curve([[-6, -10], [x - 12, l * 0.5], [x - 20, l]]), { w: 13, color: i % 2 ? G : Gd, halo: 1.2, taper1: 0.2, order: 0.86 }); ink(A, ell(x - 20, l, 13, 17), { fill: Yl, ow: 1.2, order: 0.5, gold: 0.6 }); ink(A, ell(x - 20, l + 2, 8, 11), { fill: '#2f8a86', ow: 0.8, order: 0.82 }); A.dots([[x - 20, l + 3, 4.4]], { color: Id, halo: 0, order: 0.76 }); }
      ink(A, blob([[-36, -4], [-28, -34], [0, -48], [16, -70], [18, -104], [28, -118], [44, -116], [48, -104], [40, -92], [36, -60], [30, -30], [10, -2], [-16, 10]]), { fill: ['#2a5a9c', I], under: '#9fc0dc', ow: 2, order: 0.78, lines: [{ flow: { gap: 8, w: 2, margin: 4, minLen: 10, field: [{ guide: curve([[34, -104], [28, -60], [-20, -10]]), w: 1, fall: 200 }] } }] }); ink(A, poly([[46, -108], [64, -101], [46, -99]]), { fill: Yl, ow: 1 }); A.dots([[36, -106, 4.6]], { color: W, halo: 0.6 }); A.dots([[37, -106, 2.8]], { color: K, halo: 0 }); for (let i = 0; i < 4; i++) { const a = -1.9 + i * 0.25; A.stroke(line([32, -117], [32 + Math.cos(a) * 18, -117 + Math.sin(a) * 18]), { w: 1.8, color: K, halo: 0.5 }); A.dots([[32 + Math.cos(a) * 20, -117 + Math.sin(a) * 20, 3.2]], { color: Yl, halo: 0.5 }); }
    });
    B.sprite('parrot', { w: 150, h: 130, n: 6 }, (A, ph) => { const f = Math.sin(ph * TAU); const wing = (k, c) => ink(A, limb([[-2, -4], [-16 + k * 8, -8 - f * 30], [-44 + k * 8, -14 - f * 50]], [26, 28, 5]), { fill: c, ow: 1.6, order: 0.5, lines: [{ flow: { gap: 7, w: 1.8, margin: 3, minLen: 8, field: [{ guide: curve([[-2, -4], [-16, -8 - f * 30], [-44, -14 - f * 50]]), w: 1, fall: 100 }] } }] }); wing(1, ['#7d9a3c', G]); ink(A, limb([[-66, 20], [-30, 8], [14, -2], [32, -8]], [5, 18, 28, 24]), { fill: ['#6f9a35', G], ow: 1.8, order: 0.5 }); A.part(limb([[-30, 8], [-66, 22]], [8, 3]), { fill: Bl, halo: 1, order: 0.5 }); A.part(arcBand(30, -6, 9, 13, 1.2, 4.2), { fill: R, halo: 0.8, order: 0.5 }); ink(A, blob([[40, -14], [54, -10], [52, 2], [44, -2]]), { fill: R, ow: 1.2, order: 0.5 }); A.dots([[36, -12, 4]], { color: W, halo: 0.6, order: 0.5 }); A.dots([[37, -12, 2.4]], { color: K, halo: 0, order: 0.5 }); wing(0, ['#8fae4a', G]); });
    B.sprite('monkey', { w: 170, h: 220, ox: 85, oy: 30, n: 8 }, (A, ph) => { // langur hanging by one arm
      const s = Math.sin(ph * TAU); const f = ['#d9c08a', '#b3905a']; A.with({ order: 0.5 }, () => { A.stroke(curve([[6, 104], [44, 130], [50, 176], [26 + s * 14, 186]]), { w: 8, color: '#b3905a', halo: 1.4 }); ink(A, limb([[0, 0], [10, 34], [4, 58]], [12, 14, 16]), { fill: f, ow: 1.8 }); ink(A, limb([[2, 102], [26 + s * 6, 120], [18 + s * 8, 148]], [22, 16, 10]), { fill: f, ow: 1.8 }); ink(A, limb([[-8, 102], [-30, 124 - s * 6], [-16, 150 - s * 8]], [22, 16, 10]), { fill: f, ow: 1.8 }); ink(A, blob([[-18, 56], [8, 48], [24, 64], [22, 100], [0, 114], [-20, 100]]), { fill: f, ow: 2, lines: [{ flow: { gap: 8, w: 1.8, margin: 4, minLen: 10, field: [{ dir: 1.5 }, { contour: 0.5 }] } }] }); ink(A, limb([[-10, 62], [-36, 78], [-50 + s * 5, 62 + s * 10]], [16, 13, 9]), { fill: f, ow: 1.8 }); A.part(circ(-52 + s * 5, 56 + s * 10, 9, 16), { fill: Yl, halo: 1 }); A.part(circ(-8, 36, 23, 24), { fill: f, halo: 1.6, lines: [{ flow: { gap: 7, w: 1.6, margin: 3, minLen: 6, field: [{ radial: [-8, 36] }] } }] }); A.part(blob([[-26, 34], [-18, 22], [-4, 24], [0, 38], [-8, 50], [-20, 50]]), { fill: K, halo: 1.4 }); A.dots([[-18, 34, 3], [-7, 34, 3]], { color: W, halo: 0 }); A.stroke(curve([[-18, 44], [-13, 47], [-7, 44]]), { w: 1.8, color: W, halo: 0 }); }); });
    B.sprite('mari', { w: 40, h: 40, n: 3 }, (A, ph, i) => { const c = ['#f2c04a', '#e8912a', '#c2391f'][i]; A.part(circ(0, 0, 16), { fill: i === 2 ? Rd : O, halo: 0, order: 0.4 }); for (const [r, n, l] of [[8, 14, 10], [3, 11, 10]]) for (const q of P.petals(0, 0, n, r, l, 6.4, r)) A.part([q], { fill: c, halo: 0.9, order: 0.4, raise: 0.6 }); kline(A, circ(0, 0, 17)[0], 1.2); A.dots([[0, 0, 4]], { color: i === 2 ? Yl : R, halo: 0.5, order: 0.4 }); });
    B.sprite('bfly', { w: 70, h: 60, n: 4 }, (A, ph) => { const f = 0.35 + 0.65 * Math.abs(Math.cos(ph * Math.PI)); for (const k of [-1, 1]) { ink(A, petal(0, 2, 26 * f, 22, k > 0 ? -0.7 : Math.PI + 0.7, 0.7), { fill: [R, O], ow: 1.4, order: 0.4, lines: [{ dots: [[k * 13 * f, -10, 3.4]], ink: Yl }] }); ink(A, petal(0, 4, 18 * f, 16, k > 0 ? 0.6 : Math.PI - 0.6, 0.7), { fill: [Yl, O], ow: 1.4, order: 0.4 }); } A.stroke(line([0, -10], [0, 16]), { w: 4, color: K, halo: 0.5 }); });
    B.sprite('tassel', { w: 60, h: 260, ox: 30, oy: 6 }, A => { for (let i = 0; i < 13; i++) ink(A, circ(0, 10 + i * 15, 9.5, 14), { fill: [Yl, O, Yl, R][i % 4], ow: 1.2, halo: 0.8, order: 0.4, lines: [{ strokes: [spiral(0, 10 + i * 15, 6, 1, i, 1.3, 12)], w: 1.4, ink: Rd }] }); ink(A, petal(0, 200, 42, 26, Math.PI / 2, 0.6), { fill: [R, Rd], ow: 1.6, order: 0.4 }); ink(A, petal(0, 200, 24, 12, Math.PI / 2, 0.6), { fill: Yl, ow: 1, order: 0.5 }); });
  },

  draw(g, t) {
    const rv = (a, b, f = ease.out2) => seg(t, a, b, f), bt = 0.625;
    const cells = (a, b) => ({ rv: rv(a, b, ease.lin), mode: 4, rvp: [150, 0.28, 0, 0], soft: 0.02, edge: 0.03, glow: 0.35 });
    g.ground({ color: '#ecdfc2', x: 14, y: 14, w: 1892, h: 1052, rv: rv(0, 0.7), mode: 5, rvp: [0, 540, 0, 2100], noise: 0.2, glow: 0.4 });
    g.layer('ground', cells(-0.2, 1.1));
    g.layer('back', cells(-0.1, 2.05));
    const alive = Math.max(0, t - 1.95), gait = alive * 0.72 * seg(t, 1.95, 2.8, ease.out2);
    // --- spinning woman
    const spin = t * 0.9;
    g.sprite('stand', { x: 436, y: 836, rv: rv(0.15, 0.6) });
    g.sprite('wheel', { x: 436, y: 742, r: spin * TAU, rv: rv(0.15, 0.6) });
    g.sprite('spinner', { x: 250, y: 846, ph: spin, rv: rv(0.0, 0.5) });
    g.layer('kolam', { rv: rv(1.0, 3.6, ease.inOutSine), soft: 0.01, edge: 0.04, glow: 1.1 });
    for (let i = 0; i < 4; i++) g.sprite('tassel', { x: [186, 262, 394, 470][i], y: [402, 396, 396, 402][i], s: [0.62, 0.42, 0.42, 0.62][i], r: Math.sin(t * 1.6 + i) * 0.07, rv: rv(0.5 + i * 0.1, 1.1 + i * 0.1) });
    // --- sari streaming, elephant
    const ex = EL[0] - alive * 2, ey = EL[1], bob = Math.abs(Math.sin(gait * TAU)) * 5, sw = Math.sin(t * 1.7);
    const pass = key(t, [[0.6, 0], [0.63, 0.22, ease.lin], [1.24, 0.22], [1.27, 0.63, ease.lin], [1.86, 0.63], [1.89, 1, ease.lin]]), E = { rv: pass, soft: 0.02, edge: 0.06, glow: 0.8 };
    const saRv = rv(1.25, 1.85);
    g.sprite('eTail', { x: ex + 252, y: ey - 330 + bob, r: -0.15 + Math.sin(t * 2.6) * 0.16, ...E });
    g.sprite('lFF', { x: ex - 52, y: ey - 188 + bob * 0.4, ph: gait + 0.5, ...E }); g.sprite('lFH', { x: ex + 128, y: ey - 188 + bob * 0.4, ph: gait + 0.0, ...E });
    g.sprite('eBody', { x: ex, y: ey - 0 + bob, ...E });
    g.sprite('lNF', { x: ex - 104, y: ey - 188 + bob * 0.4, ph: gait + 0.0, ...E }); g.sprite('lNH', { x: ex + 186, y: ey - 188 + bob * 0.4, ph: gait + 0.5, ...E });
    g.sprite('eCloth', { x: ex, y: ey + bob, skew: Math.sin(gait * TAU * 2) * 0.012, ...E });
    g.sprite('eHow', { x: ex + 6, y: ey + bob - 2, r: Math.sin(gait * TAU + 0.6) * 0.012, ...E });
    g.sprite('mahout', { x: ex - 92, y: ey - 340 + bob, ph: t * 0.8, ...E });
    const hb = bob + sw * 3;
    if (t > 1.25 || g.rv === 1) g.sprite('sari', { x: 594, y: 790, s: 0.88, ph: t * 0.8, rv: saRv, soft: 0.05, lift: 10, shadow: 0.6 * saRv * saRv });
    g.sprite('eTrunk', { x: ex, y: ey + hb, ph: t * 0.4, ...E });
    g.sprite('eHead', { x: ex, y: ey + hb, ...E });
    g.sprite('eTusk', { x: ex, y: ey + hb, ...E });
    g.sprite('eEar', { x: ex - 190 + 0, y: ey - 440 + hb, sx: 1 + Math.sin(t * 2.4) * 0.06, r: Math.sin(t * 2.4 + 0.5) * 0.03, ...E });
    // --- dancers
    const db = t / 1.25;
    g.sprite('danceA', { x: 1626, y: 878, s: 0.98, ph: db, rv: rv(1.6, 2.3) }); g.sprite('danceB', { x: 1764, y: 878, s: 0.94, ph: db + 0.5, rv: rv(1.8, 2.5) });
    // --- tree life
    g.sprite('monkey', { x: 862, y: 258, s: 0.8, r: Math.sin(t * 2) * 0.2, ph: t * 0.8, rv: rv(1.1, 1.7) }); g.sprite('monkey', { x: 1680, y: 196, s: 0.72, r: Math.sin(t * 1.8 + 1) * 0.22, flip: true, ph: t * 0.8 + 0.4, rv: rv(1.4, 2) });
    g.sprite('peaTrain', { x: 1712, y: 408, s: 0.62, r: Math.sin(t * 1.2) * 0.03, flip: true, rv: rv(1.6, 2.2) });
    for (let i = 0; i < 6; i++) { const u = (t * 0.085 + i * 0.163) % 1, x = lerp(1846, 74, u), y = 160 + Math.sin(i * 2.1) * 46 + Math.sin(t * 1.5 + i) * 14 + (i % 3) * 120; g.sprite('parrot', { x, y, s: 0.5 + (i % 2) * 0.1, flip: true, ph: t * 2 + i * 0.27, rv: rv(1.2 + i * 0.1, 1.8 + i * 0.1), lift: 16, shadow: 0.6 * rv(1.5, 2.2) }); }
    for (const [x, y, i] of [[640, 700, 0], [1010, 420, 1], [1060, 640, 2], [960, 300, 3], [1545, 330, 4], [690, 560, 5]]) g.sprite('bfly', { x: x + Math.sin(t * 1.1 + i * 2) * 34, y: y + Math.cos(t * 1.6 + i) * 20, s: 0.62, r: Math.sin(t * 2 + i) * 0.4, ph: t * 3.2 + i * 0.3, rv: rv(1.4 + i * 0.08, 1.9 + i * 0.08), lift: 12, shadow: 0.5 * rv(1.6, 2.2) });
    g.layer('frame', cells(0.0, 1.6));
    // --- dado: three blocks march along the cloth on the half beat
    const RW = 1760 / 7, DX = 80, DY = 882, h = 0.3125;
    for (let p = 0; p < 3; p++) for (let k = 0; k < 7; k++) { const T0 = h * (k + 1) + p * bt; if (t >= T0 || g.rv === 1) g.sprite('rep' + p, { x: DX + k * RW, y: DY, rv: 1 }); }
    // --- pond, peacocks
    g.layer('pond', cells(0.5, 2.0));
    for (let i = 0; i < 3; i++) { const u = t * 0.5 + i * 2.1; g.sprite('fish', { x: 785 + Math.cos(u) * (70 + i * 14), y: 944 + Math.sin(u) * 18, s: 0.42, flip: Math.sin(u) < 0, ph: t * 2 + i * 0.3, rv: rv(1.2, 1.9) }); }
    for (const [x, y, s, i] of [[700, 936, 0.62, 0], [872, 944, 0.7, 1], [760, 974, 0.78, 2], [824, 918, 0.5, 3]]) g.sprite('lotus', { x, y: y + Math.sin(t * 1.8 + i) * 2, s, r: Math.sin(t * 1.3 + i * 2) * 0.05, rv: rv(1 + i * 0.15, 1.7 + i * 0.15) });
    g.layer('fore', cells(0.3, 1.9));
    // peacock on the roof: closed train, then the fan snaps open on 2.5
    const op = seg(t, 2.42, 2.95, ease.outBack), fx = 326, fy = 250, pk = rv(0.6, 1.4);
    for (const [n, s, off] of [[21, 0.76, 0], [18, 0.6, 0.5], [13, 0.45, 0]]) for (let j = 0; j < n; j++) { const i = j % 2 ? n - 1 - (j >> 1) : j >> 1; const u = (i + 0.5) / n * 2 - 1, a = lerp(-2.35 + u * 0.16, u * 1.62, op) + Math.sin(t * 9 + i * 0.7) * 0.012 * op + Math.sin(t * 2 + i * 0.3) * 0.01; g.sprite('plume', { x: fx - lerp(16, 0, op), y: fy + 24, s: s * lerp(0.8, 1, op), r: a, rv: pk, lift: op > 0.02 ? 5 * op : 0, shadow: 0.5 }); }
    g.sprite('peacock', { x: 330, y: 320, s: 0.82, ph: t * 1.2, rv: pk });
    if (g.rv !== 1) for (let p = 0; p < 3; p++) {
      const t0 = h + p * bt, q = (t - t0) / h; if (q < -1.2 || q > 8) continue;
      const k = clamp(Math.floor(q), -1, 7), f = clamp(q - k), hold = 0.22, m = clamp((f - hold) / (1 - hold)); const a = Math.max(k, -1), kk = k >= 6 ? 6 : k;
      const cx0 = DX + (a + 0.5) * RW, cx1 = DX + (a + 1.5) * RW; const u = f < hold ? 0 : ease.inOut2(m), lift = f < hold ? 0 : Math.sin(Math.pow(m, 0.8) * Math.PI) * 130 + (k >= 6 ? m * 300 : 0);
      const x = k < 0 ? lerp(DX + RW / 2 - 70, DX + RW / 2, ease.in2(clamp(q + 1))) : k >= 6 ? cx0 - (k - 6) * RW : lerp(cx0, cx1, u); const y = DY + 58 - lift * 0.34;
      const lf = k < 0 ? (1 - ease.in2(clamp(q + 1))) * 160 : lift; g.sprite('block' + p, { x, y: y, s: 1 + lf * 0.0011, lift: 6 + lf, alpha: k >= 6 ? 1 - m : 1, r: Math.sin(m * Math.PI) * -0.05, rv: 1 });
      for (let j = Math.max(0, k - 1); j <= Math.min(6, k); j++) { const c = [[0.10, 0.07, 0.06], [0.42, 0.07, 0.04], [0.05, 0.10, 0.28]][p], bx = DX + (j + 0.5) * RW; for (let d = 0; d < 14; d++) g.burst(bx + (d / 13 - 0.5) * 250, DY + (d % 2 ? 108 : 4), t0 + j * h - 0.05, { n: 3, speed: 240, life: 0.6, size: 15, col: c, kind: 3, add: 0, grav: -30, seed: p * 100 + j * 10 + d }); g.burst(bx, DY + 58, t0 + j * h, { n: 26, speed: 420, life: 0.6, size: 2.6, col: c, kind: 1, add: 0, seed: p * 31 + j }); }
    }
    // the hero blocks: black, madder, indigo
    if (g.rv !== 1) for (let p = 0; p < 3; p++) {
      const T0 = bt * (p + 1), q = t - T0; if (q > -0.24 && q < 0.3) { const dn = ease.in(clamp((q + 0.24) / 0.24)), up = ease.in2(clamp((q - 0.06) / 0.24)), lf = (1 - dn) * 420 + up * 520; g.sprite('bigblock', { frame: p, x: EL[0] + 40 + up * 60, y: 600 - lf * 0.5, s: 1.02 + lf * 0.0009, r: 0.03 * (p - 1) - up * 0.1, lift: 6 + lf * 0.6, alpha: 1 - clamp((q - 0.18) / 0.12), rv: 1 }); }
      const c = [[0.12, 0.08, 0.07], [0.5, 0.09, 0.05], [0.07, 0.13, 0.36]][p]; for (let j = 0; j < 30; j++) { const a = j / 30 * TAU, ex_ = EL[0] + 40 + Math.sign(Math.cos(a)) * 250 * Math.pow(Math.abs(Math.cos(a)), 0.35), ey_ = 600 + Math.sign(Math.sin(a)) * 196 * Math.pow(Math.abs(Math.sin(a)), 0.35); g.burst(ex_, ey_, T0 - 0.06, { n: 4, speed: 420, life: 0.75, size: 24, col: c, kind: 3, add: 0, grav: -40, seed: p * 77 + j, dir: a, spread: 1.8 }); if (j % 3) continue; g.burst(ex_, ey_, T0, { n: 12, speed: 520, life: 0.7, size: 3, col: c, kind: 1, add: 0, seed: p * 7 + j * 3, dir: a, spread: 1.6 }); }
      const w = t - T0; if (w >= 0 && w < 0.5) g.bump(EL[0] + 40, 600, 420, -14 * Math.exp(-w * 9) * Math.cos(w * 30));
    }
    // ------------------------------------------------ the thread
    const hx = 250 + 1.45 * (100 + Math.sin(spin * TAU) * 10), hy = 846 + 1.45 * (-150 - Math.cos(spin * TAU) * 18);
    const tip = trunkSpine(t * 0.4).slice(-1)[0], tx = ex + tip[0], ty = ey + hb + tip[1], by = ey + bob, gl = Math.sin(t * 2.1) * 5;
    const SG = sariGeo(t * 0.8), sv = []; for (let i = 3; i < SG.n; i += 2) { const q = SG.pt(i, i < SG.tw ? -0.84 : 0.84); sv.push([594 + q[0] * 0.88, 790 + q[1] * 0.88, 16]); }
    const sm = q => { const c = spl(q.map(p => [p[0], p[1]]), false, 10), z = spl(q.map((p, i) => [i * 40, p[2]]), false, 10); return c.map((p, i) => [p[0], p[1], z[i][1]]); };
    const seg1 = sm([[-120, 540, 24], [20, 524, 20], [110, 468, 26], [220, 436, 30], [340, 446, 30], [428, 496, 26], [444, 560, 22], [hx + 14, hy - 6, 14], [hx + 2, hy + 12, 14], [500, 728, 18], [614, 782, 12]]);
    const seg2 = sm([[622, 788, 10], ...sv, [tx + 2, ty + 10, 12], [tx + 26, ty - 46, 34], [ex - 330, ey - 486, 44], [ex - 250, ey - 520, 34], [ex - 176, ey - 486, 20], [ex - 148, ey - 452, 2]]);
    const hid1 = [[ex - 148, ey - 452, 0], [ex - 222, by - 206, 0]], hid2 = [[ex - 106, by - 222, 0], [ex - 98, by - 428, 0]];
    const gar = sm([[ex - 224, by - 204, 4], [ex - 212, by - 150, 14], [ex - 180 + gl, by - 102, 18], [ex - 142 + gl, by - 98, 18], [ex - 112, by - 142, 16], [ex - 104, by - 222, 4]]);
    const swg = sm([[ex - 100, by - 430, 4], [ex - 88, by - 392, 16], [ex - 52 + gl, by - 358, 18], [ex - 4 + gl, by - 362, 18], [ex + 30, by - 396, 16], [ex + 44, by - 428, 14], [ex + 58, by - 396, 16], [ex + 92 + gl, by - 360, 18], [ex + 138 + gl, by - 360, 18], [ex + 172, by - 388, 16], [ex + 192, by - 420, 14]]);
    const seg4 = sm([[ex + 192, by - 420, 14], [ex + 236, by - 404, 24], [1520, 486, 30], [1570, 520, 26], [1630, 486 + Math.sin(t * 3) * 8, 30], [1694, 528 + Math.sin(t / 1.25 * TAU) * 8, 16], [1762, 484 + Math.sin(t * 3 + 1) * 8, 30], [1830, 520, 30], [1900, 530, 30], [2040, 540, 24]]);
    const len = q => { let s = 0; for (let i = 1; i < q.length; i++) s += Math.hypot(q[i][0] - q[i - 1][0], q[i][1] - q[i - 1][1], q[i][2] - q[i - 1][2]); return s; };
    const run = [[seg1, 1], [seg2, 1], [hid1, 0], [gar, 1, 'g'], [hid2, 0], [swg, 1, 'g'], [seg4, 1]], Ls = run.map(r => len(r[0])), cum = [0]; Ls.forEach(l => cum.push(cum[cum.length - 1] + l));
    const head = key(t, [[0, 0], [0.75, cum[1], ease.inOut2], [1.2, cum[1] + 4, ease.lin], [1.9, cum[2], ease.inOut2], [2.55, cum[6], ease.inOut2], [3.5, cum[7], ease.inOut2]]);
    run.forEach(([q, vis], i) => { const f = clamp((head - cum[i]) / Ls[i]); if (vis && f > 0.002) g.thread(q, { w: 8, hero: 1, f1: f, spark: f < 1 || i === 6 ? 1 : 0 }); });
    // drive band and thread wound round the spindle
    g.thread([[436, 640, 8], [520, 700, 8], [590, 776, 8]], { w: 2.6, color: '#efe0b8', glow: 0 }); g.thread([[470, 842, 6], [530, 826, 8], [592, 792, 8]], { w: 2.6, color: '#efe0b8', glow: 0 });
    for (let i = 0; i < 5; i++) if (head > cum[1] - 6) g.thread([[578 + i * 7, 776, 4], [582 + i * 7, 784, 14], [586 + i * 7, 792, 4]], { w: 6, hero: 1, glow: 0.4 });
    // marigolds bead themselves on the garlands as the thread passes
    for (const [ri, n] of [[3, 15], [5, 22]]) { const q = run[ri][0]; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, k = clamp((head - cum[ri] - u * Ls[ri]) / 40); if (k <= 0) continue; const p = at(q, u); g.sprite('mari', { frame: i % 5 === 2 ? 2 : i % 2, x: p[0], y: p[1], s: 1.28 * ease.outBack(k), r: i * 1.3 + Math.sin(t * 2 + i) * 0.1, lift: 9, rv: 1 }); } }
    g.burst(tx, ty, 1.9, { n: 34, speed: 220, seed: 5 }); g.burst(326, 220, 2.5, { n: 90, speed: 420, seed: 8, life: 1.2, col: [1.4, 1.5, 0.5] }); g.burst(ex - 160, by - 100, 2.2, { n: 40, speed: 240, seed: 6, life: 1 });
    // falling petals
    g.drift({ n: 60, vx: -16, vy: 46, kind: 2, add: 0, col: [0.75, 0.22, 0.08], a: 0.85, size: 6, sway: 30, seed: 4 }); g.drift({ n: 36, vx: -10, vy: 40, kind: 2, add: 0, col: [0.9, 0.5, 0.06], a: 0.85, size: 6, sway: 26, seed: 9 }); g.drift({ n: 50, vx: 14, vy: -10, col: [1.2, 0.85, 0.4], a: 0.4, size: 2.2 });
  },
  shots: [
    { end: 2.5, cam: (p, t) => ({ x: lerp(520, 985, ease.inOut2(p)), y: lerp(690, 556, ease.inOut2(p)), w: lerp(1000, 1800, ease.inOut(p)), tilt: lerp(0.22, 0.05, p), yaw: lerp(-0.06, 0, p), aperture: 3 }) },
    { end: 5, cam: (p, t) => ({ x: key(p, [[0, 580], [0.45, 900, ease.inOut2], [1, 1420, ease.inOut2]]), y: key(p, [[0, 360], [0.45, 520, ease.inOut2], [1, 650, ease.inOut2]]), w: key(p, [[0, 960], [0.45, 900], [1, 820]]), tilt: lerp(0.08, 0.24, p), yaw: lerp(-0.1, 0.1, p), aperture: 4 }) },
  ],
};
