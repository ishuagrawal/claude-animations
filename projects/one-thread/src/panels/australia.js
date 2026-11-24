// Arnhem Land, Australia — fine-line ochre on bark. Own non-sacred composition: parallel brush hairlines in one direction,
// x-ray-inspired animals, no clan designs, no dot painting. The thread is bark-fibre string (raki) rolled on the thigh; it
// becomes a string of light that runs pool to pool down a winding creek.
import { spl, blob, poly, rect, limb, circ, ell, ring, arc, curve, line, spiral, petal, star, T, at, sub, offset, wavy, resample, bbox, plen, lerp, clamp, TAU, rng, trace } from '../art/geom.js';
import { figure, SKIN, POSE, joints, pol } from '../art/figures.js';
import { seg, ease, key, hash } from '../core.js';

const C = { ground: '#82301a', deep: '#5c1c0d', dark: '#34110a', red: '#a83818', white: '#f2e8d0', cream: '#e2cd9c', yel: '#dc9c2c', ochre: '#b86f20', sand: '#d2964a', black: '#1d110b', pink: '#cf8a62', dawn: '#e2a05a' };
const TON = { halo: -1, noKnock: true };

// ------------------------------------------------------------------ the country
const HAND = [404, 936]; // where the string is rolled
const HOLES = [ // [x, y, r, beat]
  [404, 650, 70, 1.25], [190, 428, 60, 1.5625], [458, 318, 82, 1.875], [690, 690, 80, 2.5], [1196, 676, 74, 2.8125], [1446, 498, 102, 3.125], [1694, 470, 64, 3.75]];
const RIVER = resample(curve([[560, 872], [572, 800], [530, 712], [404, 650], [262, 604], [172, 528], [190, 428], [300, 332], [458, 318], [590, 392], [648, 520], [634, 610], [690, 690], [830, 694], [1030, 690], [1196, 676], [1310, 590], [1446, 498], [1570, 422], [1694, 470], [1780, 526], [1852, 540]], 16), 6);
RIVER.open = true;
const HILL = [[60, 772], [200, 744], [420, 790], [620, 818], [880, 778], [1160, 790], [1400, 786], [1580, 780], [1730, 760], [1860, 776]];
const HILLTOP = curve(HILL, 16);
const hillPath = [[...HILLTOP, [1860, 1010], [60, 1010]].map(p => [p[0], p[1]])];

// ------------------------------------------------------------------ kangaroo geometry (origin = mid body)
const ROO = { x: 1000, y: 486, s: 1.0 };
const rooBody = spl([[-166, 40], [-158, -14], [-118, -66], [-46, -104], [44, -114], [112, -124], [156, -152], [182, -190], [204, -236, 1], [232, -258], [266, -262], [298, -246], [332, -224], [346, -208], [338, -196], [304, -190], [272, -184], [250, -166], [234, -132], [222, -92], [194, -50], [134, -18], [70, 24], [16, 76], [-40, 110], [-96, 116], [-142, 92]], true, 12);
const rooTail = limb([[-128, 44], [-222, 66], [-322, 54], [-412, 4], [-486, -66]], [104, 78, 52, 34, 10]);
const rooThigh = spl([[-112, -42], [-62, -62], [0, -46], [52, -2], [84, 60], [92, 100], [70, 122], [34, 118], [-16, 112], [-66, 96], [-104, 60], [-122, 8]], true, 12);

// ------------------------------------------------------------------ x-ray drawing helpers (own, simple)
const bar = (x, y, a, l, w) => { const c = Math.cos(a), n = Math.sin(a), q = (u, v) => [x + u * c - v * n, y + u * n + v * c]; return [q(-l / 2, -w / 2), q(l / 2, -w / 2), q(l / 2, w / 2), q(-l / 2, w / 2)]; };
// backbone: a red band with pale vertebrae; w(u) = band width
const spine = (pl, n, w, o = {}) => { const wf = typeof w === 'function' ? w : () => w, L = plen(pl) / n; return [{ strokes: [pl], w: o.max ?? wf(0.4), ink: o.ink || C.red, taper: o.taper ?? 0.12, prof: u => wf(u) / (o.max ?? wf(0.4)) }, { shape: Array.from({ length: n }, (_, i) => { const u = (i + 0.5) / n, [x, y, a] = at(pl, u), k = wf(u); return bar(x, y, a, L * 0.62, k * 0.56); }), ink: o.bone || C.white, rule: 'nonzero' }]; };
// a long bone with knuckle ends
const bone = (a, b, w, ink = C.red, fill = C.white) => { const an = Math.atan2(b[1] - a[1], b[0] - a[0]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], sh = k => limb([a, [lerp(a[0], b[0], 0.16), lerp(a[1], b[1], 0.16)], m, [lerp(a[0], b[0], 0.84), lerp(a[1], b[1], 0.84)], b], [w * 1.25 + k, w * 0.8 + k, w * 0.62 + k, w * 0.8 + k, w * 1.25 + k], { seg: 6 }); return [{ shape: sh(7), ink, rule: 'nonzero' }, { shape: sh(0), ink: fill, rule: 'nonzero' }]; };
const hair = (dir, gap, w, ink, path) => ({ flow: { gap, w, margin: 6, minLen: 22, taper: 0.3, field: [{ dir }] }, ink, ...(path ? { path } : {}) });

// ------------------------------------------------------------------ plants and small motifs
function spinifex(A, x, y, s, seed, cols = [C.cream, C.yel, C.black], o = {}) { const R = rng(seed); A.at({ x, y, s }, () => { for (let i = 0; i < 26; i++) { const a = -Math.PI / 2 + (i / 25 - 0.5) * 2.5 + (R() - 0.5) * 0.14, l = 44 + R() * 34; A.stroke(curve([[(i - 13) * 1.2, 0], [Math.cos(a) * l * 0.5, Math.sin(a) * l * 0.62], [Math.cos(a) * l, Math.sin(a) * l * 0.82]], 5), { w: 5.4, color: cols[i % cols.length], taper0: 0.1, taper1: 0.8, halo: 1.4, ...o }); } }); }
const tuft = (A, x, y, s, seed, col, o = {}) => { const R = rng(seed), n = 5 + Math.floor(R() * 2); for (let i = 0; i < n; i++) { const k = i / (n - 1) - 0.5, l = (34 + R() * 18) * s * (1 - Math.abs(k) * 0.4); A.stroke(curve([[x + k * 24 * s, y], [x + k * 40 * s, y - l * 0.62], [x + k * 84 * s, y - l]], 5), { w: 3.2, color: col, taper0: 0.1, taper1: 0.7, halo: 0.4, ...o }); } };
const sprig = (A, x, y, s, a, col, o = {}) => { const e = [x + Math.cos(a) * 46 * s, y + Math.sin(a) * 46 * s]; A.stroke(line([x, y], e), { w: 3, color: col, taper1: 0.4, halo: 0.8, ...o }); for (let i = 0; i < 5; i++) { const u = 0.2 + i * 0.18, k = i % 2 ? 1 : -1; A.part(petal(lerp(x, e[0], u), lerp(y, e[1], u), 24 * s, 8 * s, a + k * 0.75, 0.45), { fill: col, halo: 1, ...o }); } };
function reed(A, x, y, s, seed, o = {}) { const R = rng(seed); for (let i = 0; i < 6; i++) { const l = (i - 2.5) * 9 * s + (R() - 0.5) * 10 * s, h = (60 + R() * 56) * s, x0 = x + (i - 2.5) * 11 * s, p = curve([[x0, y], [x0 + l * 0.25, y - h * 0.55], [x0 + l, y - h]], 6); A.stroke(p, { w: 4, color: [C.cream, C.yel, '#a08a3a'][i % 3], taper1: 0.5, halo: 0.6, ...o }); if (i % 3 === 1) A.part(limb([p[p.length - 3], [x0 + l, y - h - 16 * s]], [8 * s, 8 * s]), { fill: ['#8a4a20', C.deep], halo: 1.4, ...o }); } }
function termite(A, x, y, s, o = {}) { A.at({ x, y, s }, () => { const p = blob([[-62, 8, 1], [-58, -70], [-48, -128], [-40, -176], [-30, -196], [-20, -168], [-12, -190], [-4, -238], [6, -252], [16, -226], [20, -186], [30, -206], [38, -186], [46, -120], [58, -60], [64, 8, 1]], 8); A.part(p, { fill: ['#e0a65a', '#c47a3a', '#9a4a22'], under: C.dark, halo: 4, ...o, lines: [{ flow: { gap: 10, w: 3, margin: 4, minLen: 26, field: [{ dir: Math.PI / 2, w: 1 }, { contour: 1, w: 0.4 }] } }] }); }); }
function tree(A, pts, w, o = {}) { // stringybark trunk
  A.part(limb(pts, w), { fill: ['#e6cfa0', '#c79a66', '#9a6234'], under: C.dark, halo: 5, ...o, lines: [{ flow: { gap: 8, w: 2.4, margin: 3, minLen: 18, taper: 0.4, field: [{ guide: curve(pts), w: 1, fall: 400 }, { fn: (x, y) => [Math.sin(y * 0.06 + x * 0.1) * 0.35, 0] }] } }] });
}
function leaves(A, cx, cy, rx, ry, n, seed, o = {}) { const R = rng(seed), L = []; A.part(blob(Array.from({ length: 12 }, (_, i) => { const a = i / 12 * TAU, r = 1 + (i % 2 ? 0.16 : -0.06); return [cx + Math.cos(a) * rx * r, cy + 10 + Math.sin(a) * ry * r]; })), { fill: ['#3a2410', '#1d110b'], halo: 3, ...o }); for (let i = 0; i < n; i++) { const a = R() * TAU, r = Math.sqrt(R()); L.push([cx + Math.cos(a) * rx * r, cy + Math.sin(a) * ry * r, Math.PI / 2 + (R() - 0.5) * 1.5, R()]); } L.sort((a, b) => a[1] - b[1]); for (const [x, y, a, k] of L) A.part(petal(x, y, 36 + k * 14, 14, a, 0.45), { fill: k < 0.22 ? C.black : k < 0.45 ? '#8a6a24' : k < 0.75 ? C.yel : C.cream, halo: 2, ...o, lines: [{ strokes: [line([x, y], [x + Math.cos(a) * 36, y + Math.sin(a) * 36])], w: 1.6 }] }); }
function pandanus(A, x, y, s, o = {}) { A.at({ x, y, s }, () => {
  const tk = [[0, 10], [-12, -110], [10, -210], [4, -290]]; for (const q of [[-8, -30, -58, 10], [2, -34, 50, 12], [-4, -60, -84, 14], [4, -70, 82, 12]]) A.part(limb([[q[0], q[1] - 20], [(q[0] + q[2]) / 2, q[1]], [q[2], q[3]]], [14, 11, 9]), { fill: '#6b3a1c', halo: 2, ...o });
  A.part(limb(tk, [44, 34, 30, 26]), { fill: ['#7d4a24', '#452210'], halo: 3, ...o, lines: [{ strokes: Array.from({ length: 22 }, (_, i) => { const [px, py] = at(curve(tk), 0.04 + i * 0.043); return curve([[px - 24, py - 3], [px, py + 5], [px + 24, py - 4]], 5); }), w: 2.8 }] });
  A.part(limb([[8, -220], [60, -262], [84, -318]], [22, 18, 16]), { fill: ['#7d4a24', '#452210'], halo: 2.5, ...o, lines: [{ strokes: Array.from({ length: 8 }, (_, i) => { const [px, py, a] = at(curve([[8, -220], [60, -262], [84, -318]]), 0.1 + i * 0.11); return line([px - Math.sin(a) * 14, py + Math.cos(a) * 14], [px + Math.sin(a) * 14, py - Math.cos(a) * 14]); }), w: 2.4 }] });
  const crown = (cx, cy, k, n) => { for (let i = 0; i < n; i++) { const j = (i * 7) % n, a = -Math.PI * (-0.06 + 1.12 * j / (n - 1)), l = (118 + ((i * 0.618) % 1) * 40) * k, dr = Math.abs(Math.cos(a)); const pts = [[cx, cy], [cx + Math.cos(a) * l * 0.4, cy + Math.sin(a) * l * 0.5], [cx + Math.cos(a) * l * 0.8, cy + Math.sin(a) * l * 0.62 + dr * 10 * k], [cx + Math.cos(a) * l * 1.06, cy + Math.sin(a) * l * 0.36 + (26 + dr * 60) * k]], sp = curve(pts, 8); A.part(limb(pts, [9 * k, 17 * k, 13 * k, 2]), { fill: [['#d8b45a', '#a07a2c'], [C.cream, '#c79a4a'], ['#7a6a2a', '#3f3a18'], [C.yel, C.ochre]][i % 4], halo: 2.4, ...o, lines: [{ strokes: [sp], w: 2.4, taper: 0.2, ink: C.deep }] }); } A.part(ell(cx + 4 * k, cy + 34 * k, 26 * k, 32 * k), { fill: ['#e07a24', C.red], halo: 2.4, raise: 0.5, ...o, lines: [{ strokes: [...Array.from({ length: 5 }, (_, i) => arc(cx - 40 * k + i * 20 * k, cy + 34 * k, 34 * k, -1.2, 1.2, 10)), ...Array.from({ length: 5 }, (_, i) => arc(cx - 32 * k + i * 20 * k, cy + 34 * k, 34 * k, Math.PI - 1.2, Math.PI + 1.2, 10))], w: 2 }] }); };
  crown(88, -330, 0.78, 17); crown(2, -304, 1, 23);
}); }
function lily(A, x, y, s, open = 1, o = {}) { A.at({ x, y, s }, () => { A.part(ell(0, 12, 46, 13), { fill: ['#6c6a28', '#3c3f1a'], halo: 2, ...o, lines: [{ strokes: Array.from({ length: 7 }, (_, i) => line([0, 12], [Math.cos(i * 0.9) * 44, 12 + Math.sin(i * 0.9) * 12])), w: 1.6 }] }); for (const [a, l, w, c] of [[-2.7, 34, 14, C.white], [-0.44, 34, 14, C.white], [-2.2, 40, 15, C.pink], [-0.94, 40, 15, C.pink], [-1.85, 44, 16, C.white], [-1.29, 44, 16, C.white], [-1.57, 46, 15, C.white]]) A.part(petal(0, 8, l * (0.6 + 0.4 * open), w, -Math.PI / 2 + (a + Math.PI / 2) * open, 0.6), { fill: c, halo: 1.6, ...o, lines: [{ strokes: [line([0, 4], [Math.cos(-Math.PI / 2 + (a + Math.PI / 2) * open) * l * 0.7, 6 + Math.sin(-Math.PI / 2 + (a + Math.PI / 2) * open) * l * 0.7])], w: 1.3 }] }); A.dots([[0, 0, 7]], { color: C.yel, halo: 1.5, ...o }); }); }
// tracks
const trackEmu = (A, x, y, a, s, o) => A.at({ x, y, r: a, s }, () => { for (const [d, l] of [[0, 34], [-0.62, 28], [0.62, 28]]) A.stroke(line([0, 0], [Math.cos(d) * l, Math.sin(d) * l]), { w: 8, taper1: 0.5, ...o }); });
const trackRoo = (A, x, y, a, s, o) => A.at({ x, y, r: a, s }, () => { for (const k of [-1, 1]) { A.part(limb([[-30, k * 13], [0, k * 12], [26, k * 10]], [11, 12, 6]), { fill: o.color, halo: 2, ...o }); A.stroke(line([4, k * 15], [16, k * 21]), { w: 5, taper1: 0.4, ...o }); A.dots([[-8, k * 30, 4.5], [-1, k * 32, 3.2]], o); } });
const trackFoot = (A, x, y, a, s, f, o) => A.at({ x, y, r: a, s, sy: f }, () => { A.part(blob([[-30, -2], [-22, -10], [-4, -9], [12, -14], [24, -10], [26, 2], [14, 10], [-4, 4], [-22, 8]], 6), { fill: o.color, halo: 2, ...o }); A.dots([[35, -13, 5.2], [38, -4, 4.2], [37, 4, 3.6], [33, 10, 3.2], [27, 15, 2.8]], o); });
const trackBird = (A, x, y, a, s, o) => A.at({ x, y, r: a, s }, () => { for (const d of [0, -0.8, 0.8, Math.PI]) A.stroke(line([0, 0], [Math.cos(d) * (d > 3 ? 12 : 26), Math.sin(d) * 26]), { w: 4.5, taper1: 0.5, ...o }); });

// ------------------------------------------------------------------ people
const NAGA = (c, b) => ({ len: 78, flare: 46, w: 30, folds: 2, scallop: 4, fill: c, gap: 12, bands: [{ at: 0.86, w: 10, color: b }, { at: 0.86, w: 3, color: C.white }] });
const bandPaint = (A, J) => { for (const [a, b] of [[J.elN, J.haN], [J.knN, J.ftN], [J.knF, J.ftF]]) for (const u of [0.34, 0.48]) { const q = [lerp(a[0], b[0], u), lerp(a[1], b[1], u)], an = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2, r = a === J.elN ? 10 : 13; A.stroke(line([q[0] - Math.cos(an) * r, q[1] - Math.sin(an) * r], [q[0] + Math.cos(an) * r, q[1] + Math.sin(an) * r]), { w: 5, color: C.white, halo: 0.6, cap: 'butt' }); } };
const headband = (col, dot) => A => { A.stroke(curve([[-50, -22], [-18, -36], [14, -36], [36, -24]]), { w: 11, color: col, halo: 1.6, cap: 'butt' }); if (dot) A.stroke(curve([[-49, -22], [-18, -36], [14, -36], [35, -24]]), { w: 2.6, color: dot, halo: 0 }); };
const tassel = (A, p, n, l, col) => { for (let i = 0; i < n; i++) { const a = Math.PI / 2 + (i - (n - 1) / 2) * 0.34; A.part(petal(p[0], p[1], l, 9, a, 0.6), { fill: i % 2 ? C.white : col, halo: 1.4 }); } };
const ST = { under: '#c98d4c' };
// loose curls, scalloped outline
const HM = [[37, -23], [44, -36], [34, -46], [32, -60], [16, -62], [6, -74], [-10, -68], [-26, -74], [-36, -62], [-52, -58], [-54, -42], [-68, -30], [-60, -14], [-66, 4], [-54, 14], [-52, 28], [-36, 30], [-26, 18], [-20, 2], [-18, -14], [-4, -26], [16, -29]];
const HW = [[37, -23], [44, -36], [34, -46], [32, -60], [16, -62], [6, -76], [-10, -70], [-26, -78], [-38, -66], [-56, -62], [-58, -44], [-74, -32], [-66, -14], [-76, 4], [-64, 18], [-70, 36], [-54, 44], [-48, 58], [-34, 46], [-24, 22], [-20, 2], [-18, -14], [-4, -26], [16, -29]];
const man = (o = {}) => ({ st: ST, skin: SKIN.deep, hair: { kind: HM, fill: ['#150a05', '#2a140a'], gap: 10, w: 2.6, field: [{ fn: (x, y) => [Math.sin(y * 0.16 + Math.sin(x * 0.12) * 1.6), Math.cos(x * 0.15 + Math.sin(y * 0.1) * 1.6)] }] }, torso: undefined, lower: NAGA([C.red, C.deep], C.yel), belt: { color: C.white, w: 11, ink: C.red }, armlet: { color: C.white, w: 9 }, bangle: { color: C.yel, w: 8 }, hat: headband(C.white, C.red), front: (A, J) => { bandPaint(A, J); tassel(A, [lerp(J.shN[0], J.elN[0], 0.66), lerp(J.shN[1], J.elN[1], 0.66)], 3, 26, C.yel); o.after?.(A, J); }, ...o });
const floral = (c1, c2) => (x, b) => { const R = rng(5); for (let j = 0, y = b.y + 8; y < b.y1; y += 17, j++) for (let X = b.x + (j % 2) * 10; X < b.x1; X += 20) { x.fillStyle = (j + Math.round(X / 20)) % 2 ? c1 : c2; x.beginPath(); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; x.moveTo(X + Math.cos(a) * 4, y + Math.sin(a) * 4); x.arc(X + Math.cos(a) * 3.6, y + Math.sin(a) * 3.6, 2.5, 0, 7); } x.fill(); } };
const woman = (o = {}) => ({ st: ST, skin: SKIN.deep, hair: { kind: HW, fill: ['#150a05', '#2a140a'], gap: 10, w: 2.6, field: [{ fn: (x, y) => [Math.sin(y * 0.16 + Math.sin(x * 0.12) * 1.6), Math.cos(x * 0.15 + Math.sin(y * 0.1) * 1.6)] }] }, torso: { fill: [C.red, '#8c2a12'], lines: [], pat: floral(C.white, C.yel), patInk: C.white }, sleeve: { fill: [C.red, '#8c2a12'], to: 'el', w: [40, 38], trim: { color: C.white, w: 5 } }, lower: { len: 138, flare: 62, w: 30, folds: 3, scallop: 5, fill: [C.white, C.cream], gap: 15, bands: [{ at: 0.72, w: 16, color: C.red }, { at: 0.72, w: 3, color: C.white }, { at: 0.93, w: 9, color: C.yel }] }, hat: headband(C.red, C.white), collar: { color: [C.white, C.red], rows: 2, w: 9 }, bangle: { color: C.white }, ...o });

export default {
  id: 'australia', mat: 12, dur: 5,
  word: { native: 'raki', font: '"Avenir Next", sans-serif', roman: 'raki', gloss: 'bark-fibre string' },
  caption: { place: 'Arnhem Land, Australia', tech: 'ochre on bark' },
  env: t => ({ cloth: '#b27a4a', stain: 0.75, wear: 0.09, exposure: 1.02, scorch: 0.5, vig: 0.72, relief: 0.8 }),
  bake(B) {
    // ------------------------------------------------ night → dawn sky
    B.layer('sky', A => {
      const O = [960, 2640], band = (r0, r1) => { const o = []; const q = Math.asin(888 / r1), a0 = -Math.PI / 2 - q, a1 = -Math.PI / 2 + q; for (let i = 0; i <= 60; i++) { const a = lerp(a0, a1, i / 60); o.push([O[0] + Math.cos(a) * r1, O[1] + Math.sin(a) * r1]); } for (let i = 60; i >= 0; i--) { const a = lerp(a0, a1, i / 60); o.push([O[0] + Math.cos(a) * r0, O[1] + Math.sin(a) * r0]); } return [o]; };
      const G = (...c) => ({ lin: [70, 0, 1850, 0], stops: c });
      const ord = ['lin', 60, 0, 1860, 0, 0, 0.8];
      A.part(poly([[60, 60], [1860, 60], [1860, 420], ...band(2388, 2389)[0].slice(0, 61).reverse().filter(p => p[0] > 60 && p[0] < 1860), [60, 420]]), { fill: G([0, '#160c0a'], [0.5, '#1d0f0b'], [0.74, '#3a130c'], [0.9, '#7a2a12'], [1, '#a8481c']), halo: 0, order: ord });
      // bands of dawn
      const bands = [[2388, 2402, G([0, '#4a1a0e'], [0.6, C.red], [1, C.yel])], [2407, 2413, G([0, '#8a7a5c'], [0.6, C.sand], [1, C.white])], [2522, 2530, G([0, '#5c1c0d'], [0.6, C.red], [1, C.yel])]];
      for (const [r0, r1, f] of bands) A.part(band(r0, r1), { fill: f, halo: 2, order: ord });
      // star river: fine parallel brush-lines along the arc, with stars scattered through it and a string of larger stars
      const R = rng(11), P = (a, r) => [O[0] + Math.cos(a) * r, O[1] + Math.sin(a) * r];
      for (let r = 0; r < 13; r++) { const rad = 2419 + r * 8; let a = -Math.PI / 2 - 0.39 + R() * 0.02; while (a < -Math.PI / 2 + 0.39) { const len = 0.03 + R() * 0.09, n = 14, pl = []; for (let i = 0; i <= n; i++) pl.push(P(a + len * i / n, rad + Math.sin((a + len * i / n) * 60 + r) * 1.6)); pl.open = true; const x = pl[7][0], u = (x - 70) / 1780; if (pl[0][0] > 78 && pl[n][0] < 1842) A.stroke(pl, { w: 2.6, color: u > 0.8 ? [C.white, '#f0c878', C.sand][r % 3] : u > 0.6 ? [C.sand, C.pink, C.cream][r % 3] : [C.cream, '#8f6a50', C.pink, '#b79a78'][r % 4], taper: 0.3, halo: 0, alpha: 0.55 + 0.4 * R(), order: clamp(u * 0.8) }); a += len + 0.004 + R() * 0.012; } }
      const str = []; for (let i = 0; i < 15; i++) str.push(P(-Math.PI / 2 - 0.33 + 0.5 * i / 14, 2472 + Math.sin(i * 1.1) * 30)); A.stroke(curve(str), { w: 3, color: C.white, halo: 1, order: { along: [0, 0.8] } });
      str.forEach(([x, y], i) => { const q = 0.8 + (i % 3) * 0.2; A.part(circ(x, y, 17 * q), { fill: '#1a0d09', halo: 0, order: i / 18 }); A.part(star(x, y, 16 * q, 5.5 * q, 6), { fill: C.white, halo: 0, order: i / 18, raise: 0.4 }); });
      for (let i = 0; i < 150; i++) { const x = 84 + R() * 1750, y = 82 + R() * 190, d = Math.hypot(x - O[0], y - O[1]); if (d < 2430 || (d < 2530 && i % 3)) continue; const q = 3.4 + R() * 5; A.part(star(x, y, q, q * 0.34, 4, R()), { fill: R() > 0.3 ? C.white : C.sand, halo: 0, order: x / 1920 * 0.8 }); }
      A.part(blob([[176, 98], [206, 110], [218, 140], [206, 172], [176, 184], [196, 164], [202, 140], [196, 118]]), { fill: [C.white, C.cream], halo: 4, raise: 0.5, order: 0.1, lines: [{ strokes: [curve([[184, 106], [206, 140], [184, 176]])], w: 2, ink: C.sand }] });
      const sx = 1752, sy = 176; for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; A.stroke(line([sx + Math.cos(a) * 42, sy + Math.sin(a) * 42], [sx + Math.cos(a) * (66 + (i % 2) * 14), sy + Math.sin(a) * (66 + (i % 2) * 14)]), { w: 4, color: i % 2 ? C.yel : C.white, taper1: 0.6, halo: 0, order: 0.78 }); } A.part(circ(sx, sy, 37), { fill: C.red, halo: 0, order: 0.7 }); A.part(circ(sx, sy, 33), { fill: { rad: [sx, sy, 0, 34], stops: ['#fff0c0', '#f1c65c', C.yel] }, halo: 0, gold: 0.4, raise: 0.5, order: 0.7 });
      // stone country on the horizon, strata as fine level lines
      const rock = (pts, sd) => { const p = blob(pts, 6); A.part(p, { fill: ['#7a2c14', '#541a0c'], halo: 3, order: ['lin', 60, 0, 1860, 0, 0.1, 0.6], lines: [{ flow: { gap: 10, w: 2.6, margin: 5, minLen: 26, taper: 0.3, seed: sd, field: [{ dir: 0.03 }, { fn: (x, y) => [0, Math.sin(x * 0.02) * 0.2] }] }, ink: '#c27a48' }] }); };
      rock([[84, 372], [96, 322, 1], [128, 316, 1], [136, 300, 1], [196, 296, 1], [210, 320, 1], [258, 318, 1], [280, 344, 1], [330, 356], [270, 384], [170, 400], [84, 420]], 3); rock([[1370, 318], [1400, 286, 1], [1452, 284, 1], [1462, 268, 1], [1540, 272, 1], [1556, 292, 1], [1620, 296, 1], [1634, 320, 1], [1712, 318, 1], [1730, 342, 1], [1838, 352], [1838, 426], [1700, 396], [1560, 360], [1440, 336]], 5);
    });

    // ------------------------------------------------ bark fibre, grass, rain: plain red-ochre country
    B.layer('bark', A => { const R = rng(17); A.with(TON, () => { for (let i = 0; i < 700; i++) { const x = 70 + R() * 1780, y = 80 + R() * 900, l = 60 + R() * 220; A.stroke(wavy(x, y, x + (R() - 0.5) * 16, y + l, 3 + R() * 4, 1.4, R() * 6, 18), { w: 1.6 + R() * 2.6, color: ['#601d0c', '#a34a26', '#521808', '#b0582f'][i % 4], taper: 0.35, alpha: 0.75, order: clamp(R() * 0.5 + y / 2400) }); } }); });
    B.layer('grass', A => {
      const R = rng(21), rs = 0.5, ex = new OffscreenCanvas(960, 540), x = ex.getContext('2d', { willReadFrequently: true }); x.scale(rs, rs); x.lineCap = x.lineJoin = 'round'; x.fillStyle = x.strokeStyle = '#000';
      const solid = (fn, w) => { x.beginPath(); fn(); x.fill(); x.lineWidth = w; x.stroke(); };
      x.beginPath(); trace(x, RIVER); x.lineWidth = 128; x.stroke(); for (const [hx, hy, r] of HOLES) { x.beginPath(); x.ellipse(hx, hy, r * 1.4 + 16, r * 0.95 + 14, 0, 0, 7); x.fill(); }
      solid(() => trace(x, hillPath), 60); for (const p of [rooBody, rooTail[0], rooThigh]) solid(() => trace(x, T(p, { x: ROO.x, y: ROO.y, s: ROO.s })), 18);
      for (const [cx, cy, rx, ry] of [[336, 486, 96, 76], [1480, 342, 130, 34], [1060, 640, 130, 30], [1250, 384, 76, 44], [1640, 690, 84, 100], [1440, 720, 70, 100], [150, 700, 110, 80], [1790, 400, 70, 120], [1730, 560, 60, 60], [560, 610, 66, 74], [108, 610, 60, 70], [520, 452, 44, 60], [1322, 720, 66, 80]]) { x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill(); }
      for (const [p, w] of [[[[690, 422], [760, 400], [830, 386]], 80], [[[1540, 720], [1560, 660], [1640, 600], [1780, 630]], 66], [[[650, 322], [780, 298], [960, 290], [1120, 300]], 72]]) { x.beginPath(); trace(x, curve(p)); x.lineWidth = w; x.stroke(); }
      x.fillRect(0, 0, 84, 1080); x.fillRect(1836, 0, 84, 1080); x.beginPath(); x.rect(0, 0, 1920, 1080); x.moveTo(960 + 2362, 2640); x.arc(960, 2640, 2362, 0, TAU); x.fill('evenodd');
      const id = x.getImageData(0, 0, 960, 540).data, free = (px, py) => px > 84 && px < 1836 && py > 80 && py < 1000 && id[(Math.round(py * rs) * 960 + Math.round(px * rs)) * 4 + 3] < 100;
      const hy = px => { for (let i = 1; i < HILLTOP.length; i++) if (HILLTOP[i][0] >= px) return HILLTOP[i][1]; return 770; }, open = (px, py) => px > 90 && px < 1832 && Math.hypot(px - 960, py - 2640) < 2376 && py < hy(px) - 44 && ![[560, 610, 62], [108, 610, 60], [132, 292, 80]].some(([a, b, r]) => Math.hypot(px - a, py - b) < r);
      // rain: slanting hairlines, one direction
      for (let i = 0; i < 2600; i++) { const px = 90 + R() * 1740, py = 250 + R() * 540, cl = Math.sin(px * 0.011) + Math.sin(py * 0.013 + 1); if (cl < -0.35) continue; const l = 22 + R() * 34, e = [px - l * 0.28, py + l]; if (!open(px, py) || !open(e[0], e[1])) continue; A.stroke(line([px, py], e), { w: 2.4, color: i % 3 ? '#d08a5e' : C.cream, taper: 0.35, halo: 0, noKnock: true, alpha: 0.8, order: clamp(Math.hypot(px - 440, py - 780) / 1700 + R() * 0.12) }); }
      const pts = []; for (let i = 0; i < 5000 && pts.length < 320; i++) { const px = 90 + R() * 1740, py = 240 + R() * 560; if (!free(px, py) || !free(px, py - 22)) continue; if (pts.some(q => (q[0] - px) ** 2 + (q[1] - py) ** 2 < 33 * 33)) continue; pts.push([px, py]); } pts.sort((a, b) => a[1] - b[1]);
      pts.forEach(([px, py], i) => { const o = { order: clamp(Math.hypot(px - 440, py - 780) / 1700) }, c = [C.yel, C.cream, C.black, C.sand, C.white][i % 5]; if (i % 4 === 3) sprig(A, px, py, 0.78, -1.57 + (R() - 0.5) * 1.4, c, o); else tuft(A, px, py, 0.95, i + 3, c, o); });
    });

    // ------------------------------------------------ tracks + water path
    B.layer('tracks', A => {
      const st = (c, u) => ({ color: c, fill: c, halo: 4, order: u });
      const run = (pts, n, fn) => { const c = curve(pts); for (let i = 0; i < n; i++) { const [x, y, a] = at(c, (i + 0.5) / n); fn(x, y, a, i); } };
      run([[700, 420], [760, 400], [820, 388]], 2, (x, y, a, i) => trackRoo(A, x, y, a, 0.9, st(C.white, 0.4 + i * 0.05)));
      run([[740, 600], [800, 690], [880, 720]], 3, (x, y, a, i) => trackBird(A, x, y, a, 1, st(C.white, 0.5 + i * 0.05)));
      run([[1520, 760], [1560, 660], [1640, 600], [1800, 640]], 8, (x, y, a, i) => trackEmu(A, x + (i % 2 ? 12 : -12) * Math.sin(a), y - (i % 2 ? 12 : -12) * Math.cos(a), a, 0.95, st(i % 2 ? C.white : C.cream, 0.6 + i * 0.03)));
      run([[650, 322], [780, 298], [960, 290], [1120, 300]], 6, (x, y, a, i) => trackFoot(A, x + (i % 2 ? 14 : -14) * Math.sin(a), y - (i % 2 ? 14 : -14) * Math.cos(a), a, 0.86, i % 2 ? 1 : -1, st(i % 2 ? C.yel : C.cream, 0.5 + i * 0.04)));
      run([[1380, 760], [1300, 800], [1230, 830]], 3, (x, y, a, i) => trackRoo(A, x, y, a + Math.PI, 0.7, st(C.cream, 0.6 + i * 0.04)));
      run([[110, 660], [130, 720]], 2, (x, y, a, i) => trackBird(A, x, y, a, 0.9, st(C.cream, 0.3)));
      run([[1480, 640], [1430, 700], [1360, 740]], 5, (x, y, a, i) => trackBird(A, x, y, a, 0.8, st(C.cream, 0.6 + i * 0.03)));
    });
    B.layer('river', A => {
      const along = { along: [0, 1] }, R = rng(33), N = RIVER.length;
      A.stroke(RIVER, { w: 122, color: C.deep, halo: 0, order: along }); A.stroke(RIVER, { w: 112, color: C.yel, halo: 0, order: along }); A.stroke(RIVER, { w: 104, color: C.red, halo: 0, order: along }); A.stroke(RIVER, { w: 96, color: '#1a100c', halo: 0, order: along });
      // bundles of flowing parallel hairlines: broken, tapered brush strokes
      for (let k = 0; k < 13; k++) { const d = -42 + k * 7, pl = offset(RIVER, u => d + Math.sin(u * 70 + k * 0.5) * 2.6); let i = Math.floor(R() * 12); while (i < N - 8) { const n = 24 + Math.floor(R() * 40), q = pl.slice(i, Math.min(N, i + n)); q.open = true; if (q.length > 6) A.stroke(q, { w: 3, color: k % 4 === 1 ? C.yel : k % 4 === 3 ? '#d0693a' : R() > 0.25 ? C.white : C.cream, taper: 0.2, halo: 0, order: { along: [i / N, Math.min(1, (i + n) / N)] } }); i += n + 2 + Math.floor(R() * 4); } }
    });
    // a pool: organic outline, level broken ripple lines, floating lily pads
    B.sprite('pool', { w: 380, h: 270, n: 10, res: 0.8 }, (A, ph) => {
      const base = [1, 0.94, 1.05, 0.97, 1.03, 0.93, 1.02, 0.98, 1.06, 0.95, 1.0, 0.96], P = k => blob(base.map((b, i) => { const a = i / 12 * TAU; return [Math.cos(a) * 150 * b * k, Math.sin(a) * 100 * b * k]; }), 8);
      A.part(P(1.12), { fill: C.deep, halo: 0 }); A.part(P(1.085), { fill: C.yel, halo: 0 }); A.part(P(1.035), { fill: C.red, halo: 0 });
      const L = [[], [], []]; for (let j = 0; j < 17; j++) { const y = -92 + j * 11.6; for (let q = 0; q < 3; q++) { const sh = ((ph + j * 0.31 + q * 0.37) % 1), x0 = -150 + q * 104 + (sh - 0.5) * 30, len = 64 + ((j * 7 + q * 5) % 4) * 9; L[(j + q) % 3].push(wavy(x0, y, x0 + len, y, 2.4, 1.6, ph * TAU + j * 0.9 + q, 18)); } }
      A.part(P(1), { fill: ['#1a100c', '#2a1a12'], halo: 0, lines: [{ strokes: L[0], w: 3, ink: C.white, taper: 0.3 }, { strokes: L[1], w: 3, ink: C.cream, taper: 0.3 }, { strokes: L[2], w: 3, ink: '#c2703c', taper: 0.3 }] });
      for (const [x, y, r, a] of [[-104, 34, 28, 0.4], [-66, 58, 21, 2.2], [100, -36, 27, 3.4], [112, 30, 22, 2.6], [-92, -44, 20, 5.6], [34, 70, 22, 4.2]]) { const pad = []; for (let i = 0; i <= 26; i++) { const t = a + 0.34 + (TAU - 0.68) * i / 26; pad.push([x + Math.cos(t) * r, y + Math.sin(t) * r * 0.52]); } pad.push([x, y]); A.part([pad], { fill: ['#8f8136', '#5f5622'], halo: 2, lines: [{ strokes: Array.from({ length: 6 }, (_, i) => { const t = a + 0.8 + i * 0.95; return line([x, y], [x + Math.cos(t) * r * 0.82, y + Math.sin(t) * r * 0.42]); }), w: 1.8, ink: C.cream }] }); }
    });
    B.layer('reeds', A => HOLES.forEach(([x, y, r, b], i) => { const o = { order: clamp((b - 1) / 3.2) }; for (const [dx, dy, q] of [[-1.36, 0.12, 0.8], [-1.12, 0.62, 0.62], [1.34, 0.2, 0.78], [0.62, -0.74, 0.56], [-0.5, -0.78, 0.5]]) reed(A, x + dx * r, y + dy * r, q * (r / 74), i * 7 + Math.round(dx * 10), o); }));
    B.sprite('goose', { w: 190, h: 220, ox: 90, oy: 200, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU); for (const k of [-1, 1]) { A.stroke(line([k * 9, -60], [k * 11, -4]), { w: 6, color: C.yel, halo: 1.5 }); A.stroke(curve([[k * 11, -4], [k * 11 + 18, 0]]), { w: 5, color: C.yel, halo: 1 }); } A.part(blob([[-74, -70], [-44, -104], [6, -112], [42, -96], [40, -66], [0, -48], [-46, -54]], 9), { fill: [C.white, C.cream], under: C.deep, halo: 3, lines: [hair(0.1, 8, 2, '#b5642c')] }); A.part(blob([[-82, -62], [-56, -106], [-4, -112], [8, -90], [-30, -66], [-70, -52]], 8), { fill: C.black, under: C.sand, halo: 2.5, lines: [{ flow: { gap: 8, w: 2, margin: 3, minLen: 16, field: [{ dir: 2.6 }] } }] }); const nk = [[36, -88], [62, -122 + s * 4], [52, -156 + s * 8], [72, -178 + s * 10]]; A.part(limb(nk, [36, 19, 14, 22]), { fill: C.black, under: C.sand, halo: 2.5, lines: [{ strokes: [curve(nk)], w: 2 }] }); A.part(blob([[62, -190 + s * 10], [74, -200 + s * 10], [86, -190 + s * 10], [84, -172 + s * 10], [68, -168 + s * 10]], 6), { fill: C.black, halo: 2 }); A.part(poly([[82, -190 + s * 10], [112, -168 + s * 12], [80, -170 + s * 10]]), { fill: '#d0693a', halo: 1.6 }); A.dots([[77, -184 + s * 10, 3]], { color: C.white, halo: 0.6 }); });
    B.sprite('lily', { w: 130, h: 110, ox: 65, oy: 80, n: 4 }, (A, ph, i) => lily(A, 0, 0, 1, [0.25, 0.55, 0.8, 1][i]));

    // ------------------------------------------------ hill, trees, mounds
    B.layer('hill', A => {
      A.part(hillPath, { fill: [C.yel, C.sand, '#c88338'], halo: 5, order: ['lin', 60, 0, 1860, 0, 0.1, 0.7], lines: [{ flow: { gap: 21, w: 3, margin: 12, minLen: 60, taper: 0.3, field: [{ guide: HILLTOP, w: 1, fall: 900 }, { fn: (x, y) => [0, Math.sin(x * 0.013 + y * 0.02) * 0.25] }] }, alpha: 0.42 }] });
      for (const [d, c, w] of [[-9, C.black, 5], [-17, C.white, 2.8], [-24, C.red, 2.8], [-31, C.red, 2.8]]) A.stroke(offset(HILLTOP, d), { w, color: c, halo: 0, order: 0.4 });
      const R = rng(4); for (let i = 0; i < 64; i++) { const ty = 846 + R() * 150; tuft(A, 84 + R() * 1750, ty, 0.75 + (ty - 846) / 400, i + 70, [C.deep, C.white, C.red, C.deep][i % 4], { order: 0.2 + R() * 0.4, halo: 0.2, w: 3 }); }
      for (let i = 0; i < 6; i++) trackEmu(A, 1420 + i * 44, 846 + (i % 2) * 18, Math.PI, 0.7, { color: C.red, fill: C.red, halo: 2, order: 0.6 });
      A.at({ x: 596, y: 1002, s: 1.05 }, () => { A.part(blob([[-34, -70, 1], [34, -70, 1], [32, -34], [18, -4], [0, 4], [-18, -4], [-32, -34]], 8), { fill: [C.cream, C.sand, C.ochre], under: C.deep, halo: 3, order: 0.6, lines: [{ strokes: Array.from({ length: 6 }, (_, i) => curve([[-40, -62 + i * 12], [0, -56 + i * 12], [40, -62 + i * 12]])), w: 2.6 }, { strokes: [curve([[-40, -48], [0, -42], [40, -48]]), curve([[-40, -26], [0, -20], [40, -26]])], w: 7, ink: C.red }] }); A.stroke(curve([[-32, -70], [-24, -112], [0, -124], [24, -112], [32, -70]]), { w: 5, color: C.red, halo: 2, order: 0.6 }); });
      for (const [x, y, s] of [[1392, 812, 0.5], [1452, 808, 0.78], [1512, 802, 0.46]]) termite(A, x, y, s, { order: 0.55 });
      for (const [x, y, s, q] of [[640, 1006, 0.8, 3], [1180, 1006, 0.8, 6], [1350, 816, 0.5, 8], [1430, 1004, 0.7, 13], [1590, 800, 0.5, 14], [490, 1006, 0.5, 24]]) spinifex(A, x, y, s, q, [C.deep, C.black, C.white], { order: 0.6 });
    });
    B.layer('trees', A => {
      const o = { order: ['lin', 0, 1000, 0, 200, 0, 0.9] };
      tree(A, [[1800, 1020], [1786, 840], [1806, 640], [1786, 470], [1800, 360]], [74, 56, 50, 44, 34], o); tree(A, [[1800, 700], [1752, 600], [1730, 520]], [30, 24, 16], o); tree(A, [[1796, 520], [1840, 450], [1846, 380]], [28, 22, 16], o);
      leaves(A, 1784, 344, 86, 46, 64, 5, o); leaves(A, 1722, 548, 50, 34, 30, 8, o); leaves(A, 1830, 440, 34, 44, 26, 9, o);
      
      pandanus(A, 142, 1000, 0.92, o);
      for (const [x, y, s, q] of [[96, 1012, 1, 31], [210, 1010, 0.9, 32], [1700, 1012, 1, 33], [1846, 1014, 1, 34]]) spinifex(A, x, y, s, q, [C.white, C.deep, C.black], o);
    });

    // ------------------------------------------------ kangaroo: rigid pieces so the line work never boils
    const RW = [C.white, '#ecd9b0', C.cream], UR = '#8a3a1c', HL = '#c98a52', tl = curve([[-128, 44], [-222, 66], [-322, 54], [-412, 4], [-486, -66]]);
    B.sprite('rooTail', { w: 560, h: 320, ox: 470, oy: 180 }, A => A.at({ x: 120, y: -44 }, () => { A.part(rooTail, { fill: RW, under: UR, halo: 4, raise: 0.2, lines: [{ strokes: [offset(tl, u => lerp(38, 5, u)), offset(tl, u => lerp(30, 4, u)), offset(tl, u => -lerp(38, 5, u)), offset(tl, u => -lerp(30, 4, u))], w: 2.2, ink: HL }, ...spine(tl, 17, u => lerp(30, 7, u), { max: 30, taper: 0.05 })] }); }));
    const shank = (A, c, f) => A.part(limb([[0, 0], [-40, 46], [-84, 92]], [66, 46, 30]), { fill: c, under: UR, halo: 3, raise: 0.2, lines: f ? [hair(2.3, 9, 2, HL), ...bone([2, 0], [-82, 90], 15)] : [{ strokes: [curve([[0, 0], [-40, 46], [-84, 92]])], w: 4 }] });
    const footP = (A, c, f) => { A.part(blob([[-32, -16], [-8, -28], [18, -18], [66, -8], [130, 2], [180, 2], [208, 6, 1], [180, 18], [120, 22], [52, 18], [-2, 12], [-28, 4]], 9), { fill: c, under: UR, halo: 3, raise: 0.2, lines: f ? [...bone([-10, -8], [112, 8], 11), ...bone([124, 10], [172, 10], 8), { strokes: [line([-26, -4], [-6, 10])], w: 3 }] : [] }); A.part(poly([[176, 0], [226, 10], [176, 16]]), { fill: C.black, halo: 1.5 }); A.part(poly([[140, 12], [184, 34], [136, 24]]), { fill: C.black, halo: 1.5 }); };
    for (const [k, c, f] of [['N', RW, 1], ['F', ['#c79a5f', '#8f5526'], 0]]) { B.sprite('rooShank' + k, { w: 220, h: 220, ox: 150, oy: 60 }, A => shank(A, c, f)); B.sprite('rooFoot' + k, { w: 300, h: 120, ox: 50, oy: 50 }, A => footP(A, c, f)); }
    B.sprite('rooThigh', { w: 300, h: 300, ox: 150, oy: 130 }, A => A.part([rooThigh], { fill: RW, under: UR, halo: 4, raise: 0.3, lines: [hair(0.72, 9, 2.1, HL), { strokes: [curve([[-92, -34], [-20, -18], [40, 34], [72, 104]]), curve([[-100, 48], [-40, 72], [20, 92], [60, 112]])], w: 4.4 }, { strokes: [curve([[-92, -26], [-22, -9], [32, 40], [62, 104]])], w: 2.4, ink: C.red }, ...bone([-78, 14], [56, 84], 23)] }));
    const armL = f => (f ? [hair(0.5, 9, 2, HL), ...bone([2, 4], [36, 46], 12), ...bone([40, 50], [88, 58], 9)] : [{ strokes: [curve([[0, 0], [34, 48], [84, 56], [112, 34]])], w: 4 }]);
    B.sprite('rooArm', { w: 200, h: 200, ox: 60, oy: 50 }, A => { A.part(limb([[0, 0], [34, 48], [84, 62], [108, 44]], [52, 36, 24, 18]), { fill: RW, under: UR, halo: 3, raise: 0.25, lines: armL(1) }); for (const a of [-0.9, -0.4, 0.1]) A.stroke(line([108, 42], [108 + Math.cos(a) * 26, 42 + Math.sin(a) * 26]), { w: 6, color: C.black, taper1: 0.5, halo: 1.5 }); });
    B.sprite('rooArmF', { w: 200, h: 200, ox: 60, oy: 50 }, A => { A.part(limb([[0, 0], [34, 48], [84, 56], [112, 34]], [46, 32, 22, 16]), { fill: ['#c79a5f', '#8f5526'], under: UR, halo: 3, lines: armL(0) }); for (const a of [-0.9, -0.4, 0.1]) A.stroke(line([112, 32], [112 + Math.cos(a) * 24, 32 + Math.sin(a) * 24]), { w: 6, color: C.black, taper1: 0.5, halo: 1.5 }); });
    B.sprite('rooBody', { w: 620, h: 620, ox: 220, oy: 420 }, A => {
      const sp = curve([[-150, 22], [-112, -34], [-44, -70], [44, -80], [112, -92], [160, -122], [192, -168], [214, -208]], 12);
      const rib = (u, l, b) => { const [x, y, a] = at(sp, u), n = a + Math.PI / 2; return curve([[x, y], [x + Math.cos(n - 0.5) * l * 0.45, y + Math.sin(n - 0.5) * l * 0.45], [x + Math.cos(n + b) * l, y + Math.sin(n + b) * l]], 8); };
      A.part(petal(212, -238, 112, 44, -2.05, 0.55), { fill: ['#8f5526', '#c79a5f'], under: UR, halo: 3, lines: [{ strokes: [line([212, -238], [172, -316])], w: 4, taper: 0.2 }] });
      A.part([rooBody], { under: UR, fill: { lin: [0, -300, 0, 120], stops: [C.white, '#f0e2c0', C.cream] }, halo: 4, raise: 0.25, lines: [
        hair(2.5, 9, 2.1, HL),
        // body divisions: neck rings, chest line, belly line
        { strokes: [curve([[148, -144], [186, -120], [226, -100]]), curve([[158, -156], [192, -134], [230, -118]]), curve([[176, -228], [214, -196], [250, -174]]), curve([[28, -112], [40, -50], [66, 12]]), curve([[16, -110], [28, -48], [52, 22]])], w: 4 },
        // organs: heart, liver, stomach
        { shape: petal(206, -84, 66, 40, 2.55, 0.55), ink: UR }, { shape: petal(200, -82, 52, 27, 2.55, 0.55), ink: C.yel }, { shape: blob([[60, 4], [84, -24], [122, -30], [142, -18], [118, 2], [84, 22], [62, 28]]), ink: UR }, { shape: blob([[68, 4], [88, -16], [120, -22], [130, -16], [112, -2], [84, 14], [70, 18]]), ink: '#e0b56a' }, { strokes: [curve([[78, 4], [98, -6], [122, -16]])], w: 3, ink: UR },
        { strokes: [0.47, 0.515, 0.56, 0.605, 0.65, 0.695].map((u, i) => rib(u, [58, 66, 70, 70, 64, 54][i], [0.2, 0.15, 0.1, 0.1, 0.05, 0][i])), w: 6.4, ink: C.red, taper1: 0.4 },
        ...spine(sp, 22, u => lerp(26, 17, u), { max: 26, taper: 0.04 }),
        { strokes: [curve([[252, -240], [262, -216], [250, -188]])], w: 3.4, ink: C.red }] });
      A.part(petal(226, -246, 124, 48, -1.72, 0.55), { fill: RW, under: UR, halo: 3, raise: 0.25, lines: [{ shape: petal(222, -262, 96, 24, -1.72, 0.55), ink: '#c9774a' }, { strokes: [line([222, -268], [210, -346]), line([216, -276], [204, -336]), line([229, -276], [222, -336])], w: 2.6, taper: 0.2, ink: C.deep }] });
      A.part(blob([[312, -240], [334, -226], [348, -208], [336, -196], [316, -206]], 8), { fill: C.black, halo: 2 }); A.stroke(curve([[334, -198], [308, -198], [286, -206]]), { w: 4, color: C.black, taper1: 0.5, halo: 1 });
      A.part(ell(276, -230, 13, 10, 0.3), { fill: C.black, halo: 3 }); A.dots([[280, -233, 3]], { color: C.white, halo: 0 });
    });

    // ------------------------------------------------ animals
    B.sprite('emu', { w: 280, h: 380, ox: 130, oy: 350, n: 8 }, (A, ph) => {
      const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU), leg = (x, q, k, f) => { const kn = [x + 6 + q * 18, -78 - Math.max(0, k) * 16], ft = [x - 2 + q * 46, -4 - Math.max(0, k) * 26]; A.part(limb([[x, -136], kn, ft], [36, 12, 9]), { fill: f, halo: 2.5 }); for (const a of [-0.1, 0.35, 2.9]) A.stroke(line(ft, [ft[0] + Math.cos(a) * 26, ft[1] + Math.sin(a) * 9 + 3]), { w: 7, color: f, taper1: 0.5, halo: 1.5 }); };
      leg(8, -s, -c, '#b88a4a'); leg(-6, s, c, C.cream);
      const nk = [[52, -196], [84, -232], [80, -280 + s * 3], [94, -318 + s * 3]], eb = blob([[-104, -120], [-96, -168], [-58, -204], [0, -214], [56, -204], [82, -178], [74, -140], [30, -114], [-30, -104], [-74, -98], [-112, -84]], 9), es = curve([[-96, -124], [-72, -160], [-10, -184], [54, -186], [72, -204]]);
      A.part(limb(nk, [44, 24, 18, 18]), { fill: [C.white, C.cream], under: C.dark, halo: 3, lines: spine(curve(nk), 12, 9, { max: 9, ink: C.deep, taper: 0.1 }) });
      A.part(eb, { fill: [C.white, C.cream, C.sand], under: C.dark, halo: 4, lines: [hair(0.5, 9, 2.2, '#b5703a'), { strokes: Array.from({ length: 6 }, (_, i) => { const [x, y] = at(es, 0.3 + i * 0.1); return curve([[x, y], [x - 8, y + 24], [x - 2, y + 48 - Math.abs(i - 2) * 3]]); }), w: 5, ink: C.red, taper1: 0.4 }, { shape: ell(-46, -132, 24, 17, -0.4), ink: UR }, { shape: ell(-46, -132, 18, 11, -0.4), ink: C.yel }, ...spine(es, 12, 14, { max: 14 }), ...bone([-30, -140], [-6, -108], 9)] });
      A.part(blob([[84, -330 + s * 3], [102, -338 + s * 3], [118, -324 + s * 3], [108, -310 + s * 3], [90, -310 + s * 3]], 6), { fill: C.white, under: C.dark, halo: 2 }); A.part(poly([[112, -328 + s * 3], [142, -316 + s * 3], [112, -312 + s * 3]]), { fill: C.black, halo: 1.5 }); A.dots([[103, -325 + s * 3, 3.8]], { color: C.black, halo: 0 }); for (let i = 0; i < 5; i++) A.stroke(line([92 + i * 3, -334 + s * 3], [86 + i * 4, -350 + s * 3]), { w: 2.6, color: C.white, halo: 0.6 });
    });
    B.sprite('chick', { w: 110, h: 110, ox: 50, oy: 96, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU); for (const k of [-1, 1]) A.stroke(line([k * 6, -34], [k * 4 + k * s * 14, -3]), { w: 5, color: C.black, halo: 1.5 }); A.part(blob([[-34, -44], [-20, -62], [10, -64], [28, -50], [16, -34], [-20, -32]], 8), { fill: C.white, halo: 2.5, lines: [{ strokes: [curve([[-30, -46], [-6, -56], [24, -54]]), curve([[-28, -40], [-4, -46], [22, -46]])], w: 4, ink: C.black }] }); A.part(limb([[20, -54], [30, -70], [34, -80]], [18, 11, 13]), { fill: C.white, halo: 2, lines: [{ strokes: [line([24, -56], [34, -80])], w: 3, ink: C.black }] }); A.part(poly([[38, -84], [52, -76], [38, -76]]), { fill: C.yel, halo: 1 }); A.dots([[35, -81, 2]], { color: C.black, halo: 0 }); });
    B.sprite('brolga', { w: 350, h: 340, ox: 175, oy: 170, n: 8 }, (A, ph) => {
      const f = Math.sin(ph * TAU), f2 = Math.sin(ph * TAU - 0.7); const wing = (k, c) => { const root = [k * 16 - 2, -8], mid = [-22 + k * 24, -10 - f * 50], tip = [-52 + k * 30 - (1 - Math.abs(f2)) * 16, -14 - f2 * 98]; for (let i = 5; i >= 0; i--) { const a = Math.atan2(tip[1] - mid[1], tip[0] - mid[0]) - (i - 1) * 0.2 * (f2 > 0 ? 1 : -1); A.part(petal(lerp(mid[0], tip[0], 0.8), lerp(mid[1], tip[1], 0.8), 66 - i * 5, 13, a, 0.62), { fill: C.black, halo: 1.8 }); } A.part(limb([root, mid, tip], [40, 54, 26]), { fill: c, halo: 2.6, lines: [{ flow: { gap: 10, w: 2.8, margin: 3, minLen: 14, field: [{ guide: curve([root, mid, tip]), w: 1, fall: 200 }, { dir: 2.6, w: 0.35 }] } }] }); };
      wing(1, ['#b9a07a', '#8a6a44']); A.stroke(line([-46, 10], [-132, 26]), { w: 5, color: C.black, halo: 1.6 }); A.stroke(line([-46, 14], [-126, 36]), { w: 5, color: C.black, halo: 1.6 });
      A.part(limb([[-62, 14], [-24, 4], [16, -2], [60, -16], [104, -20], [118, -20]], [8, 34, 34, 14, 9, 12]), { fill: [C.white, C.cream], halo: 3, lines: [{ flow: { gap: 9, w: 2.4, margin: 3, field: [{ dir: -0.15 }] } }] }); A.part(ell(122, -21, 13, 9), { fill: C.white, halo: 1.6 }); A.part(blob([[112, -30], [124, -32], [130, -22], [116, -20]], 6), { fill: '#c2301a', halo: 1 }); A.part(poly([[132, -25], [162, -16], [132, -16]]), { fill: C.black, halo: 1.2 }); A.dots([[125, -22, 2.4]], { color: C.black, halo: 0.6 }); wing(0, [C.white, C.cream]);
    });
    B.sprite('barra', { w: 340, h: 170, n: 8, ox: 170, oy: 85 }, (A, ph) => {
      const w = x => Math.sin(ph * TAU + x * 0.018) * (x < 0 ? -x * 0.10 : 0), sp = [[132, 0], [84, w(84)], [20, w(20)], [-44, w(-44)], [-96, w(-96)]], tx = -96, ty = w(-110);
      A.part(poly([[tx + 10, ty - 8], [tx - 44, ty - 42 + w(-150) * 0.5], [tx - 34, ty + w(-150) * 0.4], [tx - 44, ty + 42 + w(-150) * 0.5], [tx + 10, ty + 10]]), { fill: [C.white, C.yel], halo: 2.5, lines: [{ flow: { gap: 8, w: 2.2, margin: 3, field: [{ radial: [tx + 20, ty] }] } }] });
      A.part(blob([[40, -36], [10, -66], [-30, -58], [-60, -30], [-40, -22]], 8), { fill: [C.yel, C.red], halo: 2, lines: [{ strokes: Array.from({ length: 6 }, (_, i) => line([34 - i * 16, -28], [14 - i * 16, -64])), w: 2.6 }] }); A.part(blob([[-20, 30], [-44, 58], [-70, 46], [-56, 20]], 8), { fill: [C.yel, C.red], halo: 2, lines: [{ strokes: Array.from({ length: 4 }, (_, i) => line([-24 - i * 9, 22], [-36 - i * 10, 54])), w: 2.4 }] });
      const body = limb(sp, [34, 74, 92, 64, 26], { seg: 8 }), bs = curve([...sp].reverse().concat([])); A.part(body, { fill: [C.white, C.cream, C.yel], under: UR, halo: 3, raise: 0.2, lines: [hair(0.06, 8, 2, HL), { shape: blob([[60, -4 + w(60)], [34, -20 + w(34)], [0, -18 + w(0)], [-14, -8 + w(-14)], [4, -4 + w(4)], [40, -2 + w(40)]].map(p => [p[0], p[1]])), ink: UR }, { strokes: [...Array.from({ length: 9 }, (_, i) => { const x = 52 - i * 16, y = w(x), l = 34 - Math.abs(i - 3) * 3.4; return line([x, y], [x - 12, y - l]); }), ...Array.from({ length: 9 }, (_, i) => { const x = 52 - i * 16, y = w(x), l = 34 - Math.abs(i - 3) * 3.4; return line([x, y], [x - 12, y + l]); })], w: 4, ink: C.red, taper1: 0.4 }, ...spine(bs, 15, 13, { max: 13 }), { strokes: [arc(66, 0, 40, -1.1, 1.1, 14)], w: 5 }] });
      A.part(limb([[140, 2], [100, 2], [86, 2]], [26, 66, 76], { cap1: false }), { fill: C.red, halo: 2, lines: [{ flow: { gap: 9, w: 2.4, margin: 3, field: [{ contour: 1 }] } }] }); A.part(circ(112, -10, 11), { fill: C.white, halo: 2 }); A.dots([[113, -10, 5.6]], { color: C.black, halo: 0 }); A.stroke(line([148, 8], [118, 12]), { w: 3.4, color: C.black, halo: 0 }); A.part(petal(60, 14, 40, 18, 2.3 + Math.sin(ph * TAU) * 0.3), { fill: C.yel, halo: 2, lines: [{ strokes: [line([58, 16], [38, 38])], w: 2 }] });
    });
    B.sprite('turtle', { w: 340, h: 240, n: 8, ox: 135, oy: 120 }, (A, ph) => {
      const s = Math.sin(ph * TAU); const flip = (x, y, a, l, k) => { const an = a + s * 0.35 * k; A.part(limb([[x, y], [x + Math.cos(an) * l * 0.55, y + Math.sin(an) * l * 0.55], [x + Math.cos(an + 0.4 * Math.sign(y)) * l, y + Math.sin(an + 0.4 * Math.sign(y)) * l]], [28, 30, 14]), { fill: [C.white, C.cream], under: UR, halo: 2.5, lines: bone([x, y], [x + Math.cos(an) * l * 0.62, y + Math.sin(an) * l * 0.62], 7) }); for (let i = -1; i < 2; i++) { const e = [x + Math.cos(an + 0.4 * Math.sign(y)) * l, y + Math.sin(an + 0.4 * Math.sign(y)) * l], q = an + 0.4 * Math.sign(y) + i * 0.5; A.stroke(line(e, [e[0] + Math.cos(q) * 15, e[1] + Math.sin(q) * 15]), { w: 4, color: C.black, taper1: 0.4, halo: 1 }); } };
      flip(44, -46, -0.9, 66, 1); flip(44, 46, 0.9, 66, -1); flip(-56, -40, -2.3, 56, -1); flip(-56, 40, 2.3, 56, 1); A.stroke(line([-78, 0], [-102, s * 5]), { w: 10, color: C.ochre, taper1: 0.6, halo: 2 });
      const nkp = [[66, 0], [104, -8 + s * 6], [138, 2 - s * 4], [166, 2 - s * 8]], nk = curve(nkp); A.part(limb(nkp, [26, 18, 16, 18]), { fill: [C.white, C.cream], under: UR, halo: 2.5, lines: spine(nk, 11, 8, { max: 8, taper: 0.1 }) }); A.part(blob([[156, -10 - s * 8], [174, -9 - s * 8], [188, 2 - s * 8], [174, 14 - s * 8], [156, 14 - s * 8]], 6), { fill: C.white, under: UR, halo: 2 }); A.dots([[174, -2 - s * 8, 3], [174, 7 - s * 8, 3]], { color: C.black, halo: 0 });
      A.part(ell(0, 0, 86, 66), { fill: UR, halo: 3 }); A.part(ell(0, 0, 80, 60), { fill: [C.white, C.cream], halo: 0, raise: 0.25, lines: [hair(0.3, 8, 2, HL), { strokes: [arc(0, 0, 68, 0, TAU, 48, 49)], w: 3.4, ink: UR }, { strokes: [-44, -26, -8, 10, 28, 46].flatMap(x => [-1, 1].map(k => curve([[x, 0], [x + 5, k * 22], [x * 1.1 - 2, k * 46 * Math.sqrt(Math.max(0.1, 1 - x * x / 4600))]]))), w: 5, ink: C.red }, { shape: blob([[-34, 6], [-20, 12], [-22, 28], [-38, 26]]), ink: C.yel }, { shape: blob([[18, -10], [32, -14], [36, -28], [20, -28]]), ink: C.yel }, ...spine(line([-70, 0], [70, 0]), 11, 14, { max: 14 })] });
    });
    B.sprite('goanna', { w: 380, h: 190, n: 8, ox: 190, oy: 95 }, (A, ph) => {
      const s = ph * TAU, Y = x => Math.sin(s + x * 0.017) * (14 + Math.max(0, -x) * 0.05); const sp = []; for (let x = 150; x >= -174; x -= 27) sp.push([x, Y(x)]); const spc = curve(sp);
      const leg = (x, k, f) => { const y = Y(x), q = Math.sin(s + f) * 16; const el = [x + q * 0.6, y + k * 34], ft = [x + 18 + q, y + k * 52]; A.part(limb([[x, y + k * 10], el, ft], [24, 16, 11]), { fill: C.black, halo: 2.2, lines: [{ strokes: [line([x, y + k * 10], el, ft)], w: 3.4, ink: C.sand }] }); for (let i = -1; i < 2; i++) A.stroke(line(ft, [ft[0] + Math.cos(i * 0.6 + k * 0.5) * 20, ft[1] + Math.sin(i * 0.6 + k * 0.5) * 20]), { w: 4.4, color: C.black, taper1: 0.5, halo: 1.2 }); };
      leg(66, -1, 0); leg(66, 1, Math.PI); leg(-46, -1, Math.PI); leg(-46, 1, 0);
      A.part(limb(sp, [10, 34, 30, 48, 54, 52, 46, 34, 24, 18, 14, 9, 4]), { fill: C.black, halo: 3, raise: 0.2, lines: [{ strokes: Array.from({ length: 9 }, (_, i) => { const [x, y, a] = at(spc, 0.28 + i * 0.032); return line([x - Math.sin(a) * 18, y + Math.cos(a) * 18], [x, y], [x + Math.sin(a) * 18, y - Math.cos(a) * 18]); }), w: 3.4, ink: C.sand }, ...spine(spc, 26, u => lerp(13, 5, u), { max: 13, ink: C.red, bone: C.cream }), { strokes: Array.from({ length: 8 }, (_, i) => { const [x, y, a] = at(spc, 0.62 + i * 0.045); return line([x - Math.sin(a) * 16, y + Math.cos(a) * 16], [x + Math.sin(a) * 16, y - Math.cos(a) * 16]); }), w: 5, ink: C.yel }] });
      A.dots([[134, Y(134) - 9, 3.4], [134, Y(134) + 9, 3.4]], { color: C.yel, halo: 0.6 }); A.stroke(curve([[154, Y(150)], [168, Y(150) + 3], [180, Y(150) - 5]]), { w: 3, color: '#c2481e', halo: 1 });
    });

    // ------------------------------------------------ people
    B.sprite('woman', { w: 440, h: 400, ox: 110, oy: 370, n: 8 }, (A, ph) => {
      const s = Math.sin(ph * TAU); A.at({ s: 1.22 }, () => figure(A, woman({
        pose: { lean: 8 + s * 3, legN: [5, 5], legF: [-1, 8], armN: [104 - s * 14, -6 + s * 4], armF: [70 - s * 8, 4 + s * 6], head: 20 }, hands: { N: 'flat', F: 'grip' }, hair: { kind: HW, fill: ['#150a05', '#3b2012'], gap: 10, w: 2.6, field: [{ fn: (x, y) => [Math.sin(y * 0.16 + Math.sin(x * 0.12) * 1.6), Math.cos(x * 0.15 + Math.sin(y * 0.1) * 1.6)] }] },
        lower: { path: J => limb([[J.hip[0] - 18, J.hip[1] + 2], [J.hip[0] + 24, J.hip[1] + 4], [lerp(J.hpN[0], J.knN[0], 1.04), J.hpN[1] + 8]], [64, 64, 52], { cap1: false }), fill: [C.white, C.cream], lines: [{ flow: { gap: 14, w: 3.4, margin: 5, minLen: 18, field: [{ dir: 0.1 }, { fn: (x, y) => [0, Math.sin(x * 0.05) * 0.4] }] } }, { strokes: [0, 1].map(k => curve([[-60, -60 + k * 10], [20, -56 + k * 10], [110, -46 + k * 10]])), w: 4, ink: C.red }], len: 0 }, belt: null, face: { age: 1 },
        front: (A, J) => { // fibre bundle in the far hand, string on the thigh
          const h = J.haF; for (let i = 0; i < 9; i++) A.stroke(curve([[h[0] + 4, h[1] + 4], [h[0] + 26 + i * 3, h[1] - 16 + i * 5], [h[0] + 62 + (i % 3) * 8, h[1] - 26 + i * 9]], 6), { w: 4, color: i % 2 ? C.white : C.sand, taper1: 0.6, halo: 1 });
        },
      })));
    });
    B.sprite('danceM', { w: 330, h: 370, ox: 165, oy: 336, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); A.at({ s: 0.76 }, () => figure(A, man({ pose: { lean: 12 + s * 4, legN: [44 - s * 14, 106 + s * 14], legF: [112 + s * 12, 72 - s * 16], armN: [34 - s * 26, -34 + c * 18], armF: [150 + s * 26, 206 - c * 18], head: -8 + s * 6, bob: -Math.abs(c) * 12 } }))); });
    B.sprite('danceW', { w: 330, h: 370, ox: 165, oy: 336, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); A.at({ s: 0.73 }, () => figure(A, woman({ pose: { lean: 4 + s * 5, legN: [82 - s * 14, 98 + s * 8], legF: [100 + s * 10, 92 - s * 8], armN: [44 - s * 20, -14 + c * 20], armF: [140 + s * 20, 196 - c * 20], head: s * 7, bob: -Math.abs(c) * 9 }, lower: { len: 138, flare: 62, w: 30, sway: s * 14, folds: 3, scallop: 5, fill: [C.white, C.cream], gap: 16, bands: [{ at: 0.72, w: 16, color: C.red }, { at: 0.72, w: 3, color: C.white }, { at: 0.93, w: 9, color: C.yel }] } }))); });
    const lap = (c) => ({ path: J => limb([[J.hip[0] - 14, J.hip[1]], [lerp(J.hpN[0], J.knN[0], 0.3), lerp(J.hpN[1], J.knN[1], 0.3) + 4], [lerp(J.hpN[0], J.knN[0], 0.72), lerp(J.hpN[1], J.knN[1], 0.72) + 2]], [60, 58, 52], { cap1: false }), fill: c, lines: [{ flow: { gap: 13, w: 3.2, margin: 4, field: [{ dir: -0.5 }] } }] });
    B.sprite('yidaki', { w: 560, h: 330, ox: 420, oy: 300, n: 6 }, (A, ph) => {
      const s = Math.sin(ph * TAU);
      A.at({ sx: -1 }, () => figure(A, man({ pose: { lean: 4 + s * 2, legN: [-34, 84], legF: [-18, 70], armN: [40, -40], armF: [26, -50], head: 8 }, hands: { N: 'grip', F: 'grip' }, lower: lap([C.red, C.deep]), belt: null,
        mid: (A, J) => { const m = [J.head[0] + 46, J.head[1] + 12], sp = [m, [m[0] + 90, m[1] + 74], [m[0] + 190, -50], [m[0] + 268, -8]], c = curve(sp); A.part(limb(sp, [18, 28, 38, 54], { cap1: false }), { fill: [C.white, C.cream], halo: 3, raise: 0.3, lines: [{ strokes: [0.12, 0.17, 0.4, 0.45, 0.72, 0.77].map(u => { const [x, y, a] = at(c, u); return line([x - Math.sin(a) * 30, y + Math.cos(a) * 30], [x + Math.sin(a) * 30, y - Math.cos(a) * 30]); }), w: 9, ink: C.black }, { strokes: [0.145, 0.425, 0.745, 0.94].map(u => { const [x, y, a] = at(c, u); return line([x - Math.sin(a) * 30, y + Math.cos(a) * 30], [x + Math.sin(a) * 30, y - Math.cos(a) * 30]); }), w: 10, ink: C.red }, { strokes: [offset(c, 9), offset(c, 3), offset(c, -3), offset(c, -9)], w: 2, ink: '#b5642c' }] }); } })));
    });
    B.sprite('clap', { w: 330, h: 320, ox: 165, oy: 292, n: 8 }, (A, ph) => { const s = Math.max(0, Math.sin(ph * TAU)); A.at({ sx: 1 }, () => figure(A, man({ pose: { lean: 6, legN: [-36, 84], legF: [-20, 72], armN: [40 - s * 24, -30 - s * 10], armF: [20 + s * 20, -44 + s * 24], head: -6 - s * 6 }, hands: { N: 'grip', F: 'grip' }, hair: { kind: HM, fill: ['#d8cdb8', '#a89a84'], gap: 10, w: 2.6, field: [{ fn: (x, y) => [Math.sin(y * 0.16 + Math.sin(x * 0.12) * 1.6), Math.cos(x * 0.15 + Math.sin(y * 0.1) * 1.6)] }] }, face: { age: 1 }, beard: { fill: ['#d8cdb8', '#a89a84'] }, lower: lap([C.red, C.deep]), belt: null, after: (A, J) => { for (const [h, a] of [[J.haF, -0.5 - s * 0.3], [J.haN, -1.0 + s * 0.3]]) A.part(limb([[h[0] - Math.cos(a) * 20 + 8, h[1] - Math.sin(a) * 20], [h[0] + Math.cos(a) * 80 + 8, h[1] + Math.sin(a) * 80]], [17, 17]), { fill: C.red, halo: 2, lines: [{ strokes: [0.15, 0.5, 0.85].map(u => { const q = [h[0] + 8 + Math.cos(a) * (100 * u - 20), h[1] + Math.sin(a) * (100 * u - 20)]; return line([q[0] - Math.sin(a) * 10, q[1] + Math.cos(a) * 10], [q[0] + Math.sin(a) * 10, q[1] - Math.cos(a) * 10]); }), w: 6, ink: C.white }] }); } }))); });

    // ------------------------------------------------ blown-ochre hand stencils
    for (const [nm, col, sd] of [['handW', C.white, 3], ['handY', C.yel, 8], ['handR', '#c8512a', 13]]) B.sprite(nm, { w: 250, h: 270, ox: 125, oy: 150, res: 0.8 }, A => {
      const R = rng(sd), q = []; for (let i = 0; i < 1500; i++) { const a = R() * TAU, r = 18 + Math.pow(R(), 0.72) * 96 * (0.82 + 0.22 * Math.sin(a * 3 + sd)); const f = 1 - r / 124; q.push([Math.cos(a) * r, Math.sin(a) * r * 1.06 - 8, 0.9 + R() * 3.4 * Math.max(0.12, f), Math.hypot(Math.cos(a) * r, Math.sin(a) * r)]); }
      A.part(blob(Array.from({ length: 14 }, (_, i) => { const a = i / 14 * TAU, r = 62 + (i % 2) * 9 + R() * 6; return [Math.cos(a) * r, Math.sin(a) * r * 1.06 - 8]; })), { fill: { rad: [0, -8, 20, 80], stops: [col, col, col + '00'] }, halo: 0, noKnock: true, order: ['rad', 0, 0, 0, 110, 0, 0.8] });
      A.dots(q, { color: col, halo: 0, noKnock: true, order: ['each', d => Math.min(0.95, d[3] / 120)] });
      const K = p => A.part(p, { fill: null, halo: 0, order: 0 }); K(blob([[-30, 60], [-34, 18], [-30, -6], [-10, -16], [14, -14], [30, 0], [32, 26], [24, 60], [20, 90], [-24, 90]], 8)); for (const [x0, y0, a, l, w] of [[-24, -4, -1.94, 64, 15], [-8, -10, -1.66, 76, 16], [9, -10, -1.42, 70, 15.5], [24, -2, -1.16, 54, 14], [26, 30, -0.56, 58, 17]]) K(limb([[x0 - Math.cos(a) * 16, y0 - Math.sin(a) * 16], [x0 + Math.cos(a) * l * 0.6, y0 + Math.sin(a) * l * 0.6], [x0 + Math.cos(a) * l, y0 + Math.sin(a) * l]], [w, w, w * 0.8]));
    });

    // ------------------------------------------------ frame: bark edge, dotted bands
    B.layer('frame', A => {
      const rg = (i, w) => [...rect(i, i, 1920 - 2 * i, 1080 - 2 * i), [...rect(i + w, i + w, 1920 - 2 * (i + w), 1080 - 2 * (i + w))[0]].reverse()];
      const band = (i, w, fill, lines) => A.part(rg(i, w), { fill, halo: 0, order: ['lin', 0, 1080, 0, 0, 0, 0.9], lines: lines || [] });
      band(14, 62, C.deep); band(14, 8, C.black);
      // plain ochre band, one-direction hairline hatching all the way round
      const H = []; for (let k = -1100; k < 1920; k += 9) H.push(line([k, 1080], [k + 1080, 0])); band(26, 30, [C.yel, C.ochre], [{ strokes: H, w: 2.6, ink: C.red }]);
      band(22, 4, C.white); band(56, 4, C.white); band(60, 8, C.black); band(68, 4, C.yel); band(72, 5, C.black);
    });
  },
  from: 'bottom', to: 'right', sfx: [{ t: 0.6, s: 'rattle' }, { t: 1.25, s: 'drum' }, { t: 1.5625, s: 'splash' }, { t: 1.875, s: 'splash' }, { t: 2.5, s: 'drum' }, { t: 2.8125, s: 'splash' }, { t: 3.125, s: 'splash' }, { t: 3.75, s: 'splash' }, { t: 0.9, s: 'wind' }],
  draw(g, t) {
    const S = (n, o, col = '#dcae62', w = 2.6) => { if (o.rv > 0.02) for (let k = 0; k < 8; k++) g.sprite(n, { ...o, x: o.x + Math.cos(k * TAU / 8) * w, y: o.y + Math.sin(k * TAU / 8) * w, tint: col, glow: 0 }); g.sprite(n, o); };
    const rv = (a, b) => seg(t, a, b, ease.out2), beat = t / 0.625, bp = Math.pow(0.5 + 0.5 * Math.cos(beat * TAU), 3);
    // thread geometry
    const pre = curve([[960, 1200], [960, 1090], [912, 1014], [800, 996], [660, 990], [540, 958], HAND], 16), roll = t < 1.3 ? Math.sin(t * 19) * 5 : 0;
    const post = curve([HAND, [376, 926], [380, 892], [430, 874], [500, 884], RIVER[0]], 10), path = [];
    pre.forEach((p, i) => { const u = i / pre.length; path.push([p[0], p[1] + Math.sin(i * 0.5 - t * 9) * 3 * (1 - u) + (u > 0.9 ? roll : 0), 10 + 5 * Math.sin(i * 0.35)]); });
    post.forEach((p, i) => i && path.push([p[0], p[1], 12]));
    RIVER.forEach((p, i) => { if (!i) return; const inTail = p[0] > 590 && p[0] < 690 && p[1] > 470 && p[1] < 610; path.push([p[0], p[1] + Math.sin(i * 0.22 - t * 5) * 3.2, inTail ? lerp(8, -14, clamp(Math.sin((p[1] - 470) / 140 * Math.PI) * 2)) : 9 + 4 * Math.sin(i * 0.16 - t * 3)]); });
    path.push([2040, 540, 10]);
    const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
    const Ltot = cum[cum.length - 1], near = (x, y) => { let b = 1e9, bi = 0; path.forEach((p, i) => { if (i < pre.length) return; const d = (p[0] - x) ** 2 + (p[1] - y) ** 2; if (d < b) { b = d; bi = i; } }); return cum[bi] / Ltot; };
    const uH = cum[pre.length - 1] / Ltot, uS = HOLES.map(h => near(h[0], h[1]));
    const head = key(t, [[0.05, 0], [0.85, uH, ease.inOut2], [1.02, uH], [1.25, uS[0], ease.in2], [1.5625, uS[1], ease.lin], [1.875, uS[2], ease.lin], [2.5, uS[3], ease.inOut2], [2.8125, uS[4], ease.lin], [3.125, uS[5], ease.lin], [3.75, uS[6], ease.inOut2], [4.1, 1, ease.in2]]);
    const rvr = key(t, [[0.5, 0.0], [1.25, 0.16], [1.875, 0.42], [2.5, 0.62], [3.4, 1.0]]);

    g.ground({ color: C.ground, x: 14, y: 14, w: 1892, h: 1052, rv: rv(0, 0.3), mode: 2, rvp: [700, 1080, 1500, 0], noise: 0.3 });
    g.layer('bark', { rv: rv(0, 0.5), glow: 0.1 });
    g.layer('sky', { rv: rv(0.15, 1.5), glow: 0.3 });
    g.layer('grass', { rv: key(t, [[0, 0], [0.45, 0.42, ease.out2], [2.0, 1, ease.lin]]), soft: 0.04, noise: 0, glow: 0.5 });
    g.layer('tracks', { rv: rv(1.0, 2.6), soft: 0.02 });
    g.layer('river', { rv: t > 3.4 ? 1 : clamp(rvr), soft: 0.02, noise: 0.02, glow: 1.2 });
    HOLES.forEach(([x, y, r, b], i) => { const k = seg(t, b - 0.02, b + 0.42, ease.outBack); if (t < b - 0.05) return; g.sprite('pool', { x, y, s: r / 106 * Math.max(0.05, k), flip: i % 2 === 1, r: [0.1, 0.5, -0.1, 0.05, -0.12, -0.3, 0.3][i], ph: t * 0.45 + i * 0.13 }); });
    g.layer('reeds', { rv: clamp((t - 1) / 3.2), soft: 0.03, noise: 0, glow: 0.6, r: Math.sin(t * 1.3) * 0.0012, cx: 960, cy: 540 });
    g.layer('hill', { rv: rv(0, 0.75), glow: 0.4 });
    // lilies open round each pool
    HOLES.forEach(([x, y, r, b], i) => { for (let k = 0; k < 4; k++) { const b2 = b + 0.1 + k * 0.07; if (t < b2) continue; const a = [2.5, 0.4, 4.3, 5.4][k] + i * 0.4, o = seg(t, b2, b2 + 0.5, ease.outBack); g.sprite('lily', { x: x + Math.cos(a) * r * 1.02, y: y + Math.sin(a) * r * 0.62, s: (0.5 + 0.12 * (k % 2)) * o, frame: Math.min(3, Math.floor(seg(t, b2, b2 + 0.8, ease.lin) * 3.99)), r: Math.sin(t * 2 + k + i) * 0.06, lift: 8 }); } });
    S('goose', { x: 1362, y: 776, s: 0.62, ph: t * 0.9, rv: rv(2.0, 2.8) });
    // fish swim down the water path
    for (const [u0, v, sc, b] of [[0.31, 0.016, 0.5, 1.9], [0.535, 0.010, 0.56, 2.5], [0.745, 0.014, 0.5, 2.9]]) { const [x, y, a] = at(RIVER, u0 + v * t); g.sprite('barra', { x: x + Math.sin(a) * 26, y: y - Math.cos(a) * 26, r: a, s: sc * 1.2, ph: t * 1.3 + u0, rv: rv(b, b + 0.6) }); }
    g.sprite('turtle', { x: 330 + t * 3, y: 490 - t * 4, r: -0.5 + Math.sin(t) * 0.06, s: 0.96, ph: t * 0.8, rv: rv(1.3, 2.1) });
    g.sprite('goanna', { x: 1440 + t * 14, y: 342 + t * 1.5, r: 0.1, s: 0.84, ph: t * 0.8, rv: rv(1.7, 2.6) });
    // emu family on the ridge
    const ex = 1672 - t * 10; S('emu', { x: ex, y: 786, s: 0.76, flip: true, ph: t * 0.8, rv: rv(1.2, 2.1) }); for (let i = 0; i < 2; i++) g.sprite('chick', { x: ex - 62 - i * 48, y: 786 - i * 2, s: 0.8, flip: true, ph: t * 1.6 + i * 0.3, rv: rv(1.5 + i * 0.1, 2.3) });
    g.layer('trees', { rv: rv(0.05, 1.2), r: Math.sin(t * 0.9) * 0.0016, cx: 960, cy: 1010, glow: 0.4 });
    // brolgas across the sky
    for (let i = 0; i < 5; i++) { const x = 500 + i * 230 + t * 46 - (i % 2) * 40, y = 176 + (i % 3) * 40 + Math.sin(t * 1.4 + i * 1.3) * 10 + Math.abs(i - 2) * 16; g.sprite('brolga', { x: -100 + ((x + 100) % 2100), y, s: 0.56 + (i % 3) * 0.07, ph: t * 1.25 + i * 0.23, rv: rv(1.4 + i * 0.08, 2.2 + i * 0.08), lift: 26, shadow: 0.4 }); }
    // kangaroo
    const hop = Math.sin((t - 1.25) * TAU / 1.25 - Math.PI / 2), up = hop * 0.5 + 0.5, kx = ROO.x + (t - 2.5) * 10, ky = ROO.y + 14 - up * 32, kr = -0.03 + Math.cos((t - 1.25) * TAU / 1.25 - Math.PI / 2) * 0.035, cs = Math.cos(kr) * ROO.s, sn = Math.sin(kr) * ROO.s, J = (x, y) => [kx + x * cs - y * sn, ky + x * sn + y * cs];
    const rr = rv(0.95, 2.1), rq = [], P = (n, x, y, r, o = {}) => { const [X, Y] = J(x, y); rq.push([n, { x: X, y: Y, r: kr + r, s: ROO.s, rv: rr, ...o }]); };
    const q = Math.sin((t - 1.25) * TAU / 1.25);
    P('rooTail', -120, 44, q * 0.10 + 0.02); P('rooArmF', 196, -100, q * 0.10 - 0.1); const leg = (k, x, y, r1, r2) => { P('rooShank' + k, x, y, r1); const c1 = Math.cos(r1), s1 = Math.sin(r1); P('rooFoot' + k, x - 84 * c1 - 92 * s1, y - 84 * s1 + 92 * c1, r2); };
    leg('F', 122, 70, -0.12 + q * 0.1, -0.2 + q * 0.2); P('rooBody', 0, 0, 0); leg('N', 78, 92, q * 0.1, 0.02 + q * 0.22); P('rooThigh', -26, 14, q * 0.05); P('rooArm', 168, -84, -q * 0.12);
    for (const [n, o] of rq) for (let k = 0; k < 10; k++) g.sprite(n, { ...o, x: o.x + Math.cos(k * TAU / 10) * 6, y: o.y + Math.sin(k * TAU / 10) * 6, tint: '#4a150a', glow: 0 });
    for (const [n, o] of rq) { if (n === 'rooThigh' || n === 'rooArm' || n === 'rooShankN') for (let k = 0; k < 8; k++) g.sprite(n, { ...o, x: o.x + Math.cos(k * TAU / 8) * 2.6, y: o.y + Math.sin(k * TAU / 8) * 2.6, tint: '#8a3a1c', glow: 0 }); g.sprite(n, o); }
    // dancers
    for (let i = 0; i < 5; i++) { const x = [656, 784, 914, 1042, 1148][i]; S(i % 2 ? 'danceW' : 'danceM', { s: i === 4 ? 0.64 : 0.9, x: x + Math.sin(t * 5.03 + i) * 4, y: 999 - Math.abs(Math.sin(beat * Math.PI)) * 6, ph: beat * 0.5 + (i % 2) * 0.5, flip: i % 2 === 1, rv: rv(0.35 + i * 0.1, 1.1 + i * 0.1) }); }
    S('clap', { x: 1268, y: 1000, s: 0.86, ph: beat + 0.25, rv: rv(1.0, 1.9) }); S('yidaki', { x: 1716, y: 1000, s: 0.86, ph: t * 0.8, rv: rv(0.9, 1.8) });
    S('woman', { x: 300, y: 1000, ph: t < 1.4 ? t * 3 : 1.4 * 3 + (t - 1.4) * 1.1, rv: rv(0, 0.5) });
    g.layer('frame', { rv: rv(0, 0.7), soft: 0.02, glow: 0.4 });
    // hand stencils blown on the beats
    const HS = [[132, 292, -0.14, 'handW', 0.3125, 0.74], [108, 610, 0.16, 'handY', 0.9375, 0.62], [1392, 132, 0.1, 'handY', 1.5625, 0.5], [640, 122, -0.1, 'handW', 0.625, 0.5], [560, 610, -0.16, 'handY', 1.875, 0.62]];
    HS.forEach(([x, y, r, n, b, s], i) => { if (t < b) return; g.sprite(n, { x, y, r, s, rv: seg(t, b, b + 0.4, ease.out2), soft: 0.1, glow: 0.2 }); const a = t - b; if (a < 0.9) for (let k = 0; k < 26; k++) { const h = hash(i * 90 + k), an = hash(i * 31 + k * 7) * TAU, d = (20 + 90 * h) * (1 - Math.exp(-5 * a)) * s * 1.6; g.part(x + Math.cos(an) * d, y + Math.sin(an) * d - a * 16, 20 + 40 * h, 12 + 26 * h * (0.4 + a), n === 'handW' ? 0.9 : 0.75, n === 'handW' ? 0.82 : 0.45, n === 'handW' ? 0.66 : 0.14, 0.34 * (1 - a / 0.9), 3, an, 0, 0); } });
    // the string
    HOLES.forEach(([x, y, r, b]) => { const a = t - b; if (a > 0 && a < 1.6) { const am = 16 * Math.exp(-3 * a) * Math.cos(a * 14), R2 = (r * (0.6 + a)) ** 2; for (const p of path) p[2] += am * Math.exp(-((p[0] - x) ** 2 + (p[1] - y) ** 2) / R2); } });
    g.thread(path, { w: 9.5, hero: 1, f1: head, spark: 1 });
    HOLES.forEach(([x, y, r, b], i) => { const a = t - b; if (a > 0 && a < 1.6) { g.bump(x, y, r * (0.6 + a), 16 * Math.exp(-3 * a) * Math.cos(a * 14)); for (let w = 0; w < 2; w++) { const q = a - w * 0.16; if (q < 0.02 || q > 0.95) continue; const rr = r * (0.3 + q * 0.75), e = 1 - q / 0.95; for (let k = 0; k < 6; k++) { const yy = (k - 2.5) * 0.3, half = Math.sqrt(Math.max(0, 1 - yy * yy)), sd = k % 2 ? 1 : -1, xx = sd * half * (0.55 + 0.45 * w), P = []; for (let z = 0; z <= 18; z++) { const u = z / 18 - 0.5; P.push([x + (xx + u * 0.62) * rr * 1.2, y + yy * rr + Math.sin(u * 9 + t * 8 + k) * 3, 8 + 8 * e]); } g.thread(P, { w: 2.6, color: C.white, glow: e, gold: 0, alpha: e * 0.9, shadow: 0.2 }); } } } g.burst(x, y, b, { n: 40, speed: 240, seed: 30 + i, col: [2.2, 1.6, 0.8] }); });
    g.burst(HAND[0], HAND[1], 0.88, { n: 24, speed: 150, seed: 2 });
    // stars twinkle
    for (let i = 0; i < 60; i++) { const x = 100 + hash(i * 3 + 1) * 1500, y = 92 + hash(i * 7 + 2) * 130, tw = Math.pow(0.5 + 0.5 * Math.sin(t * (2 + hash(i) * 4) + i), 4) * seg(t, 1, 2); g.part(x, y, 8, 5, 1.6 * tw, 1.4 * tw, 1.0 * tw, tw, 0); }
    // breath of the yidaki, clapstick sparks, dancers' dust
    for (let b = 1.25; b < 5; b += 0.625) { const a = t - b; if (a < 0 || a > 0.9) continue; for (let k = 0; k < 10; k++) { const h = hash(k * 17 + b * 100); g.part(1280 - a * (60 + 60 * h) + k * 2, 990 - a * 24 * h, 14, 8 + 18 * a, 0.8, 0.5, 0.22, 0.22 * (1 - a / 0.9), 3, h * 6, 0, 0); } for (let k = 0; k < 24; k++) { const h = hash(k * 31 + b * 77), x = 680 + h * 460; g.part(x + (hash(k) - 0.5) * 50 * a, 998 - a * 30 * hash(k * 5), 10, 6 + 16 * a, 0.75, 0.42, 0.18, 0.28 * (1 - a / 0.9), 3, h * 6, 0, 0); } }
    g.drift({ n: 80, vx: 10, vy: -8, col: [1.2, 0.8, 0.4], a: 0.45, size: 2.4 });
  },
  shots: [
    { end: 1.25, cam: p => ({ x: lerp(510, 480, ease.inOut2(p)), y: lerp(866, 826, ease.inOut2(p)), w: lerp(640, 860, ease.inOut2(p)), tilt: lerp(0.32, 0.2, p), yaw: lerp(-0.12, 0.02, p), aperture: 4.5 }) },
    { end: 3.125, cam: p => ({ x: lerp(620, 985, ease.inOut2(p)), y: lerp(620, 545, ease.inOut2(p)), w: lerp(1250, 1840, ease.inOut2(p)), tilt: lerp(0.16, 0.04, p), aperture: 2 }) },
    { end: 5, cam: p => ({ x: lerp(1110, 1370, ease.inOut2(p)), y: lerp(404, 560, ease.inOut2(p)), w: lerp(840, 1120, ease.inOut2(p)), tilt: lerp(0.28, 0.16, p), yaw: lerp(0.14, -0.06, p), aperture: 4 }) },
  ],
};
