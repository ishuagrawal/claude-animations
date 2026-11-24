// Ur, Mesopotamia, c. 2500 BCE — cylinder seal & inlay. A great stone seal rolls the picture out; the thread strings a
// bull-headed lyre, and its notes travel on along the canal.
import { spl, blob, poly, rect, rrect, limb, circ, ell, ring, arc, arcBand, curve, line, spiral, petal, star, T, at, sub, offset, wavy, resample, lerp, clamp, TAU, rng } from '../art/geom.js';
import * as P from '../art/patterns.js';
import { flowLines } from '../art/flow.js';
import { figure, SKIN, POSE } from '../art/figures.js';
import { seg, ease, key, hash } from '../core.js';

const C = { lapis: '#0f2d5c', mid: '#1d5190', sky: '#3c78b8', pale: '#7fabd2', shell: '#f1e6c9', bone: '#d9c69a', red: '#ad3417', coral: '#cf5a2e', dark: '#180f0a', brown: '#5a2f16', clay: '#b7713a', sand: '#d39a55', gold: '#dca53a', dgold: '#a86a1c', green: '#48702f', dgreen: '#25451f', turq: '#2f8f93' };
const TONE = { halo: -1, noKnock: true };
const UL = { under: C.dark };

// ------------------------------------------------------------------ lyre geometry
const NS = 12;
const TOP = i => [404 + i * 28.6, 336 - i * 3.7], BOT = i => [486 + i * 14.4, 902 - i * 1.2];
const BULL = { x: 818, y: 752, s: 0.9 };

// ------------------------------------------------------------------ small things
const rosette = (A, x, y, r, o = {}) => { o = { order: 0.5, ...o }; A.part(circ(x, y, r * 1.12, 32), { fill: o.bg || C.dark, halo: 1.5, order: o.order }); for (const q of P.petals(x, y, 8, r * 0.2, r * 0.78, r * 0.52)) A.part([q], { fill: o.fill || C.shell, halo: 1, order: o.order, raise: o.raise || 0, gold: o.gold || 0 }); A.part(circ(x, y, r * 0.28, 20), { fill: o.eye || C.red, halo: 1.2, order: o.order, raise: o.raise || 0 }); };
function palm(A, x, y, s, o = {}) { A.at({ x, y, s }, () => {
  const tk = [[0, 6], [8, -90], [-4, -190]]; A.part(limb(tk, [30, 22, 18]), { fill: ['#8a4c22', '#4d2611'], halo: 3, ...o, lines: [{ strokes: Array.from({ length: 13 }, (_, i) => { const y = -8 - i * 14; return Object.assign([[-18, y - 4], [0, y + 6], [18, y - 4]], { open: true }); }), w: 2.8, ink: C.sand }] });
  for (let i = 0; i < 13; i++) { const j = (i * 5) % 13, a = -Math.PI * (0.02 + 0.96 * j / 12), l = 104 - Math.abs(j - 6) * 1.5, e = [-4 + Math.cos(a) * l * 1.05, -190 + Math.sin(a) * l * 0.5 + 34 * Math.abs(Math.cos(a))], m = [-4 + Math.cos(a) * l * 0.55, -192 + Math.sin(a) * l * 0.72], sp = curve([[-4, -190], m, e], 8); const barbs = []; for (let k = 1; k < 9; k++) { const [px, py, pa] = at(sp, 0.12 + k * 0.1); barbs.push(line([px, py], [px + Math.cos(pa + 0.9) * 17, py + Math.sin(pa + 0.9) * 17]), line([px, py], [px + Math.cos(pa - 0.9) * 17, py + Math.sin(pa - 0.9) * 17])); } A.part(limb([[-4, -190], m, e], [8, 30, 4]), { fill: i % 2 ? [C.green, C.dgreen] : ['#6f8f3a', C.green], halo: 2, ...o, lines: [{ strokes: [sp], w: 2.4, ink: C.dark }, { strokes: barbs, w: 2, ink: C.dark, alpha: 0.8 }] }); }
  for (const [dx, dy] of [[-18, -172], [10, -166], [-4, -158]]) { A.part(ell(dx, dy, 11, 17), { fill: [C.coral, C.red], halo: 2, ...o, lines: [{ dots: Array.from({ length: 7 }, (_, i) => [dx - 5 + (i % 3) * 5, dy - 8 + Math.floor(i / 3) * 7, 1.6]), ink: C.gold }] }); }
}); }
function reeds(A, x, y, s, n, seed, o = {}) { const R = rng(seed); for (let i = 0; i < n; i++) { const h = (90 + R() * 70) * s, l = (R() - 0.5) * 34 * s, x0 = x + (i - n / 2) * 8 * s; A.stroke(curve([[x0, y], [x0 + l * 0.3, y - h * 0.5], [x0 + l, y - h]], 5), { w: 5 * s, color: i % 2 ? C.green : '#7f8f45', taper1: 0.3, halo: 1.4, ...o }); if (i % 2) A.part(ell(x0 + l, y - h, 6 * s, 18 * s, l * 0.006), { fill: [C.sand, C.brown], halo: 1.6, ...o }); } }
const cune = (A, x, y, str, size, gap, o = {}) => [...str].forEach((ch, i) => A.text(ch, x + i * gap, y, { font: `${size}px "Noto Sans Cuneiform"`, align: 'center', color: o.color || C.dark, halo: 0, order: o.order ?? 0.5, bold: o.bold ?? 0.6 }));

// ------------------------------------------------------------------ people
const tufts = (rows, tw, c1 = '#8d6a38', w0 = 31, fl = 50) => (x, b) => { x.lineWidth = 2.4; for (let r = 0; r < rows; r++) { const y = b.y + b.h * r / rows - 4, h = b.h / rows * 1.28, hw = lerp(w0, fl, Math.pow((r + 0.5) / rows, 0.8)) + 6, n = Math.max(3, Math.round(hw * 2 / tw)); for (let i = 0; i <= n; i++) { const X = b.cx - hw + (i + (r % 2 ? 0.5 : 0)) * hw * 2 / n, W = hw / n; x.strokeStyle = c1; x.beginPath(); x.moveTo(X - W, y); x.quadraticCurveTo(X - W * 0.9, y + h * 0.72, X, y + h); x.quadraticCurveTo(X + W * 0.9, y + h * 0.72, X + W, y); x.stroke(); x.beginPath(); x.moveTo(X, y + h * 0.3); x.lineTo(X, y + h * 0.86); x.stroke(); } } };
const kaun = (o = {}) => ({ len: o.len || 136, flare: o.flare || 50, w: 31, folds: 4, scallop: 4, fill: o.fill || [C.shell, C.bone], lines: [], pat: tufts(o.rows || 5, o.tw || 21, o.ink || '#8d6a38', 31, o.flare || 50), patInk: '#8d6a38', sway: 0 });
const SM = { ornament: 0, torso: { fill: [SKIN.tan[1], SKIN.tan[0]], lines: [] } };
const man = (o = {}) => ({ skin: SKIN.tan, st: UL, ...SM, lower: kaun(), belt: { color: C.red, w: 14, ink: C.gold }, face: { lips: '#8a3a1e' }, limbW: 1, ...o });
const bearded = { fill: ['#1d130d', '#2c1a10'], curl: 1, gap: 8 };
const leafCrown = A => { A.stroke(curve([[-54, -24], [-20, -46], [14, -48], [38, -34]]), { w: 9, color: C.lapis, halo: 1.6 }); A.dots(Array.from({ length: 8 }, (_, i) => { const [x, y] = at(curve([[-54, -24], [-20, -46], [14, -48], [38, -34]]), 0.06 + i * 0.125); return [x, y, 3]; }), { color: C.coral, halo: 0 }); for (let i = 0; i < 8; i++) { const [x, y] = at(curve([[-54, -22], [-20, -44], [14, -46], [38, -32]]), 0.04 + i * 0.13); A.part(petal(x, y, 19, 12, Math.PI / 2 + (i - 4) * 0.08, 0.55), { fill: [C.gold, C.dgold], halo: 1.6, gold: 0.9, lines: [{ strokes: [line([x, y], [x, y + 16])], w: 1.6 }] }); } for (const a of [-2.1, -1.7, -1.3]) { const x = -20 + Math.cos(a) * 50, y = -20 + Math.sin(a) * 66; A.stroke(line([-22, -50], [x, y]), { w: 3.4, color: C.gold, halo: 1 }); for (const q of P.petals(x, y, 6, 1, 13, 8)) A.part([q], { fill: C.gold, halo: 0.8, gold: 0.8 }); } };
const lady = (o = {}) => ({ skin: SKIN.tan, st: UL, hair: { kind: 'bun', fill: ['#1d130d', '#2c1a10'], gap: 10 }, torso: { fill: [C.red, '#7c2412'], lines: [{ flow: { gap: 12, w: 2.4, margin: 5, field: [{ dir: 1.2 }] } }] }, lower: { len: 182, flare: 48, w: 30, folds: 3, scallop: 3, fill: [C.red, '#7c2412'], gap: 14, bands: [{ at: 0.4, w: 16, color: C.gold, motif: 'tri', ink: C.red }, { at: 0.7, w: 20, color: C.shell, motif: 'dia', ink: C.lapis }, { at: 0.95, w: 16, color: C.gold, motif: 'dots', ink: C.red }] }, collar: { color: [C.gold, C.sky, C.coral], rows: 3, w: 11, dots: C.shell }, bangle: { color: C.gold, gold: 0.8 }, hat: leafCrown, face: { lips: '#8a2a18' }, ...o });

function bullHead(A, o = {}) {
  const G = [[0, '#f6d27a'], [0.45, C.gold], [1, '#8f5a18']], g = (x0, y0, x1, y1) => ({ lin: [x0, y0, x1, y1], stops: G });
  const horn = (dx, dy, f) => A.part(limb([[-14 + dx, -84 + dy], [30 + dx, -128 + dy], [34 + dx, -190 + dy], [-10 + dx, -232 + dy]], [42, 32, 22, 5]), { fill: f, halo: 4, gold: 0.9, raise: 0.9, ...o, lines: [{ strokes: Array.from({ length: 6 }, (_, i) => { const [x, y, a] = at(curve([[-14 + dx, -84 + dy], [30 + dx, -128 + dy], [34 + dx, -190 + dy], [-10 + dx, -232 + dy]]), 0.1 + i * 0.1); return line([x - Math.sin(a) * 18, y + Math.cos(a) * 18], [x + Math.sin(a) * 18, y - Math.cos(a) * 18]); }), w: 2.6 }] });
  horn(46, 10, ['#c48a2c', '#7a4a14']);
  // beard
  const bd = [];
  A.part(blob([[-34, 58], [10, 74], [70, 92], [108, 88], [116, 130], [104, 178], [84, 218], [50, 244], [14, 250], [-8, 232], [-14, 190], [-26, 140], [-46, 96]], 10), { fill: ['#2d5aa8', '#16326b'], under: C.gold, halo: 4, raise: 0.8, gold: 0.05, ...o, lines: [{ flow: { gap: 13, w: 3.6, margin: 5, minLen: 26, taper: 0.2, field: [{ guide: curve([[30, 80], [60, 140], [30, 250]]), w: 1, fall: 300 }, { fn: (x, y) => [Math.sin(y * 0.07) * 0.5, 0] }, { vortex: [12, 224, 24, 1], w: 1.8 }, { vortex: [56, 214, 24, -1], w: 1.8 }, { vortex: [92, 168, 22, -1], w: 1.2 }] } }] });
  // ear far, neck, head
  A.part(blob([[-84, -62], [-40, -98], [4, -104], [44, -86], [78, -40], [112, 0], [146, 38], [150, 66], [130, 92], [98, 98], [62, 88], [20, 76], [-24, 70], [-66, 92], [-124, 96], [-140, 30], [-118, -36]], 10), { fill: g(-60, -100, 60, 110), halo: 5, gold: 1, raise: 1, ...o, lines: [{ flow: { gap: 17, w: 3.4, margin: 8, minLen: 30, taper: 0.3, field: [{ vortex: [-20, 20, 60, 1], w: 1.4 }, { guide: curve([[-90, -50], [-20, -60], [60, -10], [130, 60]]), w: 1, fall: 120 }, { contour: 0.4 }] } }] });
  A.part(blob([[112, 18], [146, 40], [152, 68], [130, 94], [98, 98], [92, 66]], 8), { fill: g(90, 10, 130, 110), halo: 2.5, gold: 1, raise: 1, ...o, lines: [{ strokes: [spiral(132, 56, 11, 2, 0.4, 1.3, 24)], w: 4 }, { strokes: [curve([[98, 82], [120, 80], [142, 76]])], w: 4 }] });
  // forelock curls
  for (let r = 0; r < 3; r++) for (let i = 0; i < 4 - (r > 1 ? 1 : 0); i++) { const x = -56 + i * 24 + r * 12, y = -84 + r * 20 + i * 5; A.part(circ(x, y, 13, 24), { fill: ['#2d5aa8', '#1a3a78'], halo: 2, raise: 0.8, ...o, gold: 0, lines: [{ strokes: [spiral(x, y, 9, 1.5, 0, 1.6, 24)], w: 2.6 }] }); }
  horn(0, 0, g(-20, -232, 40, -80));
  A.part(petal(-74, -44, 96, 46, 2.75, 0.55), { fill: g(-160, -60, -70, 0), halo: 4, gold: 1, raise: 1, ...o, lines: [{ strokes: [line([-82, -40], [-150, -14])], w: 4, taper: 0.2 }] });
  // eye
  A.part([spl([[8, -34, 1], [30, -54], [58, -46], [74, -18, 1], [48, -14], [26, -18]], true, 8)], { fill: C.dark, halo: 3, raise: 0.4, ...o, gold: 0 }); A.part([spl([[17, -34, 1], [32, -46], [54, -40], [65, -22, 1], [46, -20], [30, -23]], true, 8)], { fill: C.shell, halo: 0, ...o, gold: 0, raise: 0.4 }); A.part(circ(44, -32, 11.5, 24), { fill: ['#2d5aa8', '#15316a'], halo: 0, ...o, gold: 0, raise: 0.4 }); A.part(circ(46, -33, 5, 14), { fill: C.dark, halo: 0, ...o, gold: 0 });
  A.stroke(curve([[0, -44], [26, -68], [58, -62], [82, -30]]), { w: 9, color: '#244e98', taper: 0.25, halo: 2, raise: 0.5, ...o, gold: 0 });
}

export default {
  id: 'ur', mat: 0, dur: 5,
  word: { native: '𒄖', font: '"Noto Sans Cuneiform"', roman: 'gu', gloss: 'thread, string' },
  caption: { place: 'Ur, Mesopotamia', tech: 'cylinder seal & inlay' },
  from: 'left', to: 'right',
  sfx: [{ t: 0.15, s: 'roll' }, { t: 1.25, s: 'pluck' }, { t: 1.875, s: 'pluck' }, { t: 2.5, s: 'twang' }, { t: 3.125, s: 'pluck' }, { t: 3.75, s: 'pluck' }, { t: 1.95, s: 'thump' }, { t: 2.6, s: 'shimmer' }],
  env: t => ({ cloth: '#c8b183', stain: 0.5, wear: 0.05, exposure: 1.04, scorch: 0.4, vig: 0.7 }),
  bake(B) {
    const M3 = {};
    // ------------------------------------------------ ground ornament
    B.layer('tone', A => {
      A.with(TONE, () => {
        // scale pattern (mountain imbrication) low on the left; stars above
        for (let j = 0; j < 15; j++) for (let i = 0; i < 24; i++) { const x = 90 + i * 40 + (j % 2) * 20, y = 492 + j * 35; if (x > 960) continue; A.stroke(arc(x, y, 21, 0.05, Math.PI - 0.05, 14), { w: 3.4, color: C.sky, alpha: 0.5 }); A.stroke(arc(x, y, 12, 0.1, Math.PI - 0.1, 10), { w: 2.6, color: C.sky, alpha: 0.4 }); A.dots([[x, y + 4, 3]], { color: C.pale, alpha: 0.5 }); }
        const R = rng(8); for (let i = 0; i < 230; i++) { const x = 90 + R() * 1740, y = 86 + R() * 290; if (R() > 0.7) A.part(star(x, y, 9 + R() * 5, 3.4, 8), { fill: C.gold, alpha: 0.8 }); else A.dots([[x, y, 1.8 + R() * 2]], { color: R() > 0.5 ? C.shell : C.pale, alpha: 0.8 }); }
        for (let j = 0; j < 4; j++) for (let i = 0; i < 24; i++) { const x = 110 + i * 76 + (j % 2) * 38, y = 110 + j * 66; for (const q of P.petals(x, y, 8, 3, 13, 8)) A.part([q], { fill: C.mid, alpha: 0.75 }); }
      });
      // crescent and great star
      A.part(T(blob([[1404, 98], [1420, 122], [1446, 134], [1474, 122], [1490, 98], [1482, 140], [1446, 160], [1412, 140]], 8), { x: 142, y: -2 }), { fill: [C.shell, C.gold], halo: 0, gold: 0.5, raise: 0.5 });
      for (const [x, y, r] of [[1120, 140, 34], [590, 160, 40], [250, 140, 28], [1690, 170, 28]]) { A.part(star(x, y, r, r * 0.42, 8), { fill: [C.gold, C.dgold], halo: 0, gold: 0.7, raise: 0.6 }); A.part(circ(x, y, r * 0.3), { fill: C.red, halo: 2 }); A.dots(P.ringDots(x, y, r * 1.3, 16, 2.2), { color: C.shell, halo: 0 }); }
    });

    // ------------------------------------------------ rivers, canal, ziggurat
    const riverL = curve([[902, 70], [876, 120], [896, 180], [926, 232], [904, 296], [898, 340], [920, 400]], 14), riverR = curve([[1772, 70], [1802, 130], [1776, 196], [1748, 246], [1778, 310], [1790, 350], [1766, 400]], 14);
    B.layer('far', A => {
      const water = (pl, w) => { const pr = resample(pl, 8); A.part([[...offset(pr, w / 2), ...offset(pr, -w / 2).reverse()]], { fill: ['#2f7f9c', C.turq, '#1d5a86'], halo: 4, lines: [{ strokes: [-0.34, -0.12, 0.12, 0.34].map(k => offset(resample(pl, 6), u => k * w + Math.sin(u * 46 + k * 9) * 4)), w: 3.6, ink: C.shell }] }); for (const k of [-1, 1]) { const q = offset(pl, k * (w / 2 + 9)); A.stroke(q, { w: 7, color: C.sand, halo: 1 }); A.dots(resample(q, 16).map(p => [p[0], p[1], 2.4]), { color: C.red, halo: 0 }); } };
      water(riverL, 62); water(riverR, 62);
      // canal, full width
      A.part(rect(70, 392, 1780, 58), { fill: ['#2f8a9c', '#1c5588'], halo: 4, lines: [{ strokes: [402, 416, 430, 443].map((y, j) => wavy(60, y, 1860, y, 4, 46, j * 1.6, 460)), w: 3.6, ink: C.shell, alpha: 0.9 }] });
      A.part(rect(70, 384, 1780, 8), { fill: C.sand, halo: 2 }); A.part(rect(70, 450, 1780, 9), { fill: C.sand, halo: 2 }); A.dots(Array.from({ length: 112 }, (_, i) => [78 + i * 16, 454.5, 2.6]), { color: C.red, halo: 0 });
      // ziggurat
      const brick = (x0, x1, y0, y1, bat) => { const L = []; const R = rng(x0 | 0); for (let y = y0 + 11; y < y1; y += 11) { const k = (y - y0) / (y1 - y0), l = lerp(x0 + bat, x0, k), r = lerp(x1 - bat, x1, k); L.push(line([l, y], [r, y])); for (let x = l + R() * 20; x < r; x += 22) L.push(line([x, y], [x, y - 11])); } return L; };
      const tier = (cx, w, y0, y1, bat, f, ink, but) => { const x0 = cx - w / 2, x1 = cx + w / 2; A.part(poly([[x0 + bat, y0], [x1 - bat, y0], [x1, y1], [x0, y1]]), { fill: f, halo: 4, raise: 0.12, lines: [{ strokes: brick(x0, x1, y0, y1, bat), w: 1.7, ink }, { strokes: Array.from({ length: but }, (_, i) => { const u = (i + 0.5) / but; return line([lerp(x0 + bat, x1 - bat, u), y0 + 8], [lerp(x0, x1, u), y1]); }), w: 7, ink: C.dark, alpha: 0.42 }] }); A.part(rect(x0 + bat - 6, y0 - 7, w - bat * 2 + 12, 10), { fill: C.shell, halo: 2, lines: [{ shape: P.triangles(x0 + bat - 6, y0 - 7, w - bat * 2 + 12, 10, Math.round(w / 14)), ink: C.red, rule: 'nonzero' }] }); };
      const cx = 1340; tier(cx, 640, 300, 384, 20, ['#c07a44', '#8a4420'], '#5a2810', 15); tier(cx, 452, 234, 294, 15, [C.sand, '#a96432'], '#6a3416', 11); tier(cx, 290, 184, 228, 11, [C.coral, C.red], '#5c1a0c', 8);
      // temple
      A.at({ x: 0, y: 38 }, () => { A.part(poly([[cx - 64, 88], [cx + 64, 88], [cx + 70, 142], [cx - 70, 142]]), { fill: ['#4f82c6', C.mid], halo: 4, raise: 0.4, lines: [{ pat: (x, b) => { for (let j = 0; j < 8; j++) for (let i = 0; i < 20; i++) { x.beginPath(); x.arc(b.x + i * 8 + (j % 2) * 4, b.y + 4 + j * 8, 2, 0, 7); x.fill(); } }, ink: C.shell }] }); A.part(rrect(cx - 18, 104, 36, 38, 14), { fill: C.dark, halo: 2, lines: [{ strokes: [arc(cx, 124, 12, Math.PI, TAU, 14)], w: 3, ink: C.gold }] }); for (const k of [-1, 1]) A.part(blob([[cx + k * 46, 88], [cx + k * 60, 72], [cx + k * 66, 80], [cx + k * 64, 92]], 6), { fill: C.gold, halo: 2, gold: 0.8 }); A.part(rect(cx - 72, 82, 144, 8), { fill: C.gold, halo: 2, gold: 0.8 }); });
      // stairs: central ramp and two side ramps
      const steps = (x0, x1, xt0, xt1, y0, y1, n) => A.part(poly([[xt0, y0], [xt1, y0], [x1, y1], [x0, y1]]), { fill: [C.shell, C.bone], halo: 4, lines: [{ strokes: Array.from({ length: n }, (_, i) => { const u = i / n; return line([lerp(xt0, x0, u), lerp(y0, y1, u)], [lerp(xt1, x1, u), lerp(y0, y1, u)]); }), w: 2.6, ink: C.brown }, { strokes: [line([xt0 + 3, y0], [x0 + 5, y1]), line([xt1 - 3, y0], [x1 - 5, y1])], w: 5, ink: C.red }] });
      steps(cx - 46, cx + 46, cx - 20, cx + 20, 184, 384, 24);
      for (const k of [-1, 1]) A.part(poly([[cx + k * 52, 316], [cx + k * 52, 290], [cx + k * 318, 384], [cx + k * 262, 384]]), { fill: [C.shell, C.bone], halo: 4, lines: [{ strokes: Array.from({ length: 18 }, (_, i) => { const u = i / 18, x = lerp(cx + k * 52, cx + k * 300, u); return line([x, lerp(270, 380, u)], [x, lerp(300, 396, u)]); }), w: 2.6, ink: C.brown }] });
      // gate tower where stairs meet
      A.part(rect(cx - 56, 276, 112, 26), { fill: [C.gold, C.dgold], halo: 3, gold: 0.5, raise: 0.4, lines: [{ strokes: Array.from({ length: 8 }, (_, i) => line([cx - 48 + i * 14, 276], [cx - 48 + i * 14, 302])), w: 3 }] });
      // palms and reed houses on the banks
      for (const [x, s] of [[1000, 0.72], [1062, 0.52], [1664, 0.62], [1716, 0.5], [1156, 0.4], [1540, 0.4]]) palm(A, x, x > 1100 && x < 1600 ? 300 : 386, s);
      const mud = (x, w, h) => { A.part(poly([[x - w / 2, 386], ...arc(x, 386, w / 2, Math.PI, TAU, 24, h).slice(1, -1), [x + w / 2, 386]]), { fill: [C.sand, C.clay], halo: 4, lines: [{ strokes: Array.from({ length: 7 }, (_, i) => arc(x, 386, w / 2 * (0.2 + i * 0.12), Math.PI, TAU, 20, h * (0.28 + i * 0.1))), w: 3 }, { strokes: Array.from({ length: 9 }, (_, i) => line([x - w / 2 + i * w / 8, 386], [x - w / 2 + i * w / 8, 386 - h])), w: 2.2, ink: C.brown }] }); A.part(poly([[x - w * 0.14, 386], ...arc(x, 386, w * 0.14, Math.PI, TAU, 12, h * 0.62).slice(1, -1), [x + w * 0.14, 386]]), { fill: C.dark, halo: 2.5, lines: [{ strokes: [line([x, 340], [x, 386])], w: 2, ink: C.sand }] }); for (const k of [-1, 1]) A.part(limb([[x + k * w * 0.3, 386], [x + k * w * 0.32, 386 - h * 0.9], [x + k * w * 0.36, 386 - h * 1.28]], [16, 12, 20]), { fill: [C.gold, C.clay], halo: 2.5, lines: [{ strokes: Array.from({ length: 8 }, (_, i) => line([x + k * w * 0.3 - 12, 380 - i * h * 0.14], [x + k * w * 0.3 + 18, 380 - i * h * 0.14])), w: 2.4 }] }); };
      mud(196, 200, 118); mud(352, 128, 84); palm(A, 108, 388, 0.8); palm(A, 290, 388, 0.56); reeds(A, 470, 392, 0.8, 9, 5); reeds(A, 780, 392, 0.9, 10, 9); reeds(A, 830, 392, 0.6, 7, 12); palm(A, 700, 388, 0.74); palm(A, 560, 388, 0.6); reeds(A, 1818, 392, 0.8, 6, 14);
    });

    B.layer('guil', A => { A.part(rect(70, 462, 884, 30), { fill: C.dark, halo: 2 }); const G = P.guilloche(70, 463, 884, 28, 34); for (const [l, c] of [[G.a, C.gold], [G.b, C.coral]]) { A.stroke(l, { w: 7, color: C.dark, halo: 0 }); A.stroke(l, { w: 4.4, color: c, halo: 0, gold: c === C.gold ? 0.6 : 0 }); } for (const e of G.eyes) A.part([e], { fill: C.shell, halo: 0 }); });
    // ------------------------------------------------ register bands at right
    const RX0 = 1010, RX1 = 1842, RY = [464, 640, 818, 998];
    B.layer('bands', A => {
      const fills = [['#7c2412', '#62190c'], [C.dark, '#20140c'], ['#7c2412', '#62190c']];
      for (let r = 0; r < 3; r++) { A.part(rect(RX0, RY[r], RX1 - RX0, RY[r + 1] - RY[r]), { fill: r === 1 ? ['#1a3f80', '#132c5e'] : ['#93371c', '#6a1e0e'], halo: 0 }); const R = rng(r + 5); A.with(TONE, () => { for (let i = 0; i < 46; i++) { const x = RX0 + 20 + R() * (RX1 - RX0 - 40), y = RY[r] + 30 + R() * 110; const c = r === 1 ? C.sky : C.coral; for (const q of P.petals(x, y, 6, 1, 8, 5)) A.part([q], { fill: c, alpha: 0.85 }); } }); }
      for (let r = 0; r < 4; r++) { const y = RY[r] - 11; A.part(rect(RX0, y, RX1 - RX0, 24), { fill: C.dark, halo: 0 }); const n = 52, w = (RX1 - RX0) / n; for (const [p, c] of [[P.triangles(RX0, y + 3, RX1 - RX0, 9, n), C.shell], [P.triangles(RX0, y + 12, RX1 - RX0, 9, n, true), C.coral]]) A.part(p, { fill: c, halo: 0 }); A.dots(Array.from({ length: n + 1 }, (_, i) => [RX0 + i * w, y + 12, 2.6]), { color: C.gold, halo: 0 }); }
      // furniture of the feast, barley and young palms between the figures
      const table = (x, y) => { A.part(rect(x - 24, y - 64, 48, 8), { fill: C.gold, halo: 2, gold: 0.4 }); for (const k of [-1, 1]) A.part(limb([[x + k * 16, y - 56], [x + k * 22, y - 26], [x + k * 12, y - 2]], [7, 6, 8]), { fill: C.gold, halo: 1.6 }); A.part(blob([[x - 14, y - 66], [x - 8, y - 80], [x + 8, y - 80], [x + 14, y - 66]], 6), { fill: C.shell, halo: 1.8 }); A.dots([[x - 6, y - 84, 5], [x + 4, y - 85, 5]], { color: C.coral, halo: 1.4 }); };
      for (const x of [1142, 1452]) table(x, 634);
      const barley = (x, y, h, c) => { const R = rng(x | 0); for (let i = 0; i < 3; i++) { const l = (i - 1) * 13 + R() * 5, top = [x + l, y - h + Math.abs(i - 1) * 12]; A.stroke(curve([[x + (i - 1) * 4, y], [x + l * 0.4, y - h * 0.5], top], 6), { w: 4, color: c, halo: 1.4 }); for (let k = 0; k < 6; k++) for (const q of [-1, 1]) A.part(petal(top[0] - l * 0.02 * k, top[1] + k * 8, 13, 6, -Math.PI / 2 + q * 0.6), { fill: C.gold, halo: 1 }); } };
      for (const [x, h] of [[1032, 76], [1150, 70], [1420, 66], [1500, 92], [1560, 96], [1834, 70]]) barley(x, 988, h, C.sand);
      for (const [x, h] of [[1090, 62], [1180, 58], [1290, 66], [1480, 60], [1570, 64], [1662, 72], [1702, 66]]) barley(x, 808, h, C.pale);
      for (const [x, y] of [[1040, 552], [1245, 512], [1452, 508], [1560, 520], [1820, 510], [1380, 690], [1450, 872], [1545, 860]]) rosette(A, x, y, 13, { fill: C.gold, bg: C.dark });
      // tablet column of cuneiform
      A.part(rrect(962, 468, 42, 526, 10), { fill: [C.sand, C.clay], halo: 4, raise: 0.2, lines: [{ strokes: Array.from({ length: 14 }, (_, i) => line([962, 500 + i * 35], [1004, 500 + i * 35])), w: 2, ink: C.brown }] });
      const txt = '𒄖𒌨𒆠𒀭𒈗𒂍𒃲𒁇𒊺𒋾𒌓𒈾𒁀𒆳𒉡'; [...txt].forEach((ch, i) => cune(A, 983, 493 + i * 35, ch, 24, 0, { order: 0.5 }));
      // cuneiform rows above the canal register heads
    });

    // ------------------------------------------------ the great lyre
    B.layer('lyre', A => {
      A.with({ raise: 0.9 }, () => {
        const wood = [C.brown, '#3a1c0c'];
        // rear and front uprights
        const up = (pts, w, o) => { A.part(limb(pts, w), { fill: [C.gold, C.dgold], halo: 5, gold: 0.75, lines: [{ strokes: Array.from({ length: 30 }, (_, i) => { const [x, y, a] = at(curve(pts), 0.03 + i * 0.033), h = 30; return Object.assign([[x - Math.sin(a) * h, y + Math.cos(a) * h], [x + Math.cos(a) * 8, y + Math.sin(a) * 8], [x + Math.sin(a) * h, y - Math.cos(a) * h]], { open: true }); }), w: 4, ink: i => C.red }] }); };
        const inl = (pts, w, n) => { const c = curve(pts); A.part(limb(pts, w), { fill: [C.gold, C.dgold], halo: 5, gold: 0.8 }); const ww = w[0] * 0.64; for (let i = 0; i < n; i++) { const [x, y, a] = at(c, (i + 0.5) / n); A.at({ x, y, r: a }, () => { A.part(poly([[-8.5, -ww / 2], [8.5, -ww / 2], [8.5, ww / 2], [-8.5, ww / 2]]), { fill: [C.lapis, C.red, C.shell][i % 3], halo: 1.2, gold: 0, raise: 0.5 }); A.part(poly([[-7, -ww / 2 + 2], [0, 0], [-7, ww / 2 - 2]]), { fill: [C.gold, C.shell, C.lapis][i % 3], halo: 0, gold: 0, raise: 0.5 }); A.part(poly([[7, -ww / 2 + 2], [0, 0], [7, ww / 2 - 2]]), { fill: [C.gold, C.shell, C.lapis][i % 3], halo: 0, gold: 0, raise: 0.5 }); }); } };
        inl([[436, 830], [412, 640], [384, 480], [366, 318]], [38, 34, 32, 34], 25); inl([[704, 800], [728, 640], [744, 450], [752, 268]], [40, 36, 34, 34], 26);
        // crossbar with pegs
        A.part(limb([[318, 350], [540, 320], [800, 276]], [36, 34, 36]), { fill: { lin: [0, 260, 0, 360], stops: ['#f4d07a', C.gold, '#8f5a18'] }, halo: 5, gold: 1, raise: 1, lines: [{ strokes: [0.06, 0.1, 0.9, 0.94].map(u => { const [x, y, a] = at(curve([[318, 350], [540, 320], [800, 276]]), u); return line([x - Math.sin(a) * 20, y + Math.cos(a) * 20], [x + Math.sin(a) * 20, y - Math.cos(a) * 20]); }), w: 6, ink: C.red }] });
        for (const [x, y] of [[314, 351], [806, 275]]) rosette(A, x, y, 24, { gold: 0.9, fill: C.gold, eye: C.red, raise: 1, bg: C.lapis });
        for (let i = 0; i < NS; i++) { const [x, y] = TOP(i); A.part(limb([[x - 5, y - 34], [x + 2, y + 14]], [11, 13]), { fill: i % 2 ? [C.shell, C.bone] : [C.coral, C.red], halo: 2.4, gold: 0, raise: 0.8, lines: [{ strokes: [line([x - 12, y - 8], [x + 10, y - 8])], w: 3 }] }); }
        // sound box
        const box = [spl([[392, 824, 1], [540, 806], [716, 776, 1], [742, 846], [752, 958, 1], [580, 974], [416, 972, 1], [398, 900]], true, 10)];
        A.part(box, { fill: [C.gold, C.dgold], halo: 6, gold: 0.8 });
        A.part(T(box, { ox: 572, oy: 876, s: 0.93, x: 0, y: 0 }), { fill: C.dark, halo: 2, gold: 0, raise: 0.4 });
        A.with({ gold: 0, raise: 0.5 }, () => {
          const row = (y, f, dy = 0) => f(y);
          // triangles along upper and lower edges following the box slope
          const ue = [[414, 836], [704, 796]], le = [[430, 956], [734, 946]]; for (let i = 0; i < 20; i++) { const u0 = i / 20, u1 = (i + 1) / 20, um = (i + 0.5) / 20, p = (e, u) => [lerp(e[0][0], e[1][0], u), lerp(e[0][1], e[1][1], u)]; const a = p(ue, u0), b = p(ue, u1), c = p(ue, um); A.part(poly([a, b, [c[0], c[1] + 14]]), { fill: i % 2 ? C.shell : C.coral, halo: 0.8 }); const d = p(le, u0), e = p(le, u1), f = p(le, um); A.part(poly([d, e, [f[0], f[1] - 14]]), { fill: i % 2 ? C.coral : C.shell, halo: 0.8 }); }
          // lozenge row + rosettes
          for (let i = 0; i < 13; i++) { const x = 440 + i * 23, y = 866 - i * 2.4; A.part(poly([[x - 11, y], [x, y - 9], [x + 11, y], [x, y + 9]]), { fill: i % 2 ? C.lapis : C.red, halo: 1 }); A.part(poly([[x - 5, y], [x, y - 4], [x + 5, y], [x, y + 4]]), { fill: C.shell, halo: 0 }); }
          for (let i = 0; i < 7; i++) if (i < 1 || i > 5) rosette(A, 446 + i * 45, 924 - i * 1.4, 15, { bg: C.mid });
          // inlaid ibexes browsing a palm
          const ibex = (x, y, k) => A.at({ x, y, sx: k * 0.62, s: 1 }, () => A.at({ sy: 0.62 }, () => { for (const [lx, d] of [[-34, -4], [-24, 3], [24, -3], [34, 5]]) A.part(limb([[lx, -22], [lx + d, 4]], [8, 5]), { fill: C.bone, halo: 1 }); A.part(blob([[-44, -34], [-30, -46], [10, -44], [36, -54], [50, -72], [62, -72], [78, -60], [72, -54], [58, -54], [46, -30], [20, -18], [-34, -20]], 6), { fill: C.shell, halo: 1.6, lines: [{ strokes: [curve([[-34, -32], [0, -34], [36, -44]])], w: 2.6, ink: C.red }] }); A.stroke(curve([[54, -72], [42, -92], [20, -92]], 6), { w: 6, color: C.gold, halo: 1 }); A.dots([[62, -64, 2.4]], { color: C.dark, halo: 0 }); }));
          ibex(540, 946, 1); ibex(614, 944, -1); A.stroke(line([577, 948], [577, 922]), { w: 5, color: C.gold, halo: 1 }); for (let i = 0; i < 7; i++) A.part(petal(577, 924, 22, 8, -Math.PI / 2 + (i - 3) * 0.44), { fill: C.sky, halo: 1 });
        });
        // bridge
        A.part(limb([[466, 906], [560, 898], [668, 886]], [17]), { fill: [C.shell, C.bone], halo: 3, gold: 0, raise: 1, lines: [{ dots: Array.from({ length: NS }, (_, i) => { const [x, y] = BOT(i); return [x, y + 1, 3]; }), ink: C.red }] });
        // feet
        for (const x of [438, 700]) A.part(blob([[x - 26, 966, 1], [x + 26, 966, 1], [x + 34, 998, 1], [x - 34, 998, 1]], 5), { fill: [C.gold, C.dgold], halo: 3, gold: 0.8, lines: [{ strokes: [line([x - 30, 980], [x + 30, 980])], w: 4, ink: C.red }] });
      });
    });
    B.layer('bull', A => A.at({ x: BULL.x, y: BULL.y, s: BULL.s }, () => bullHead(A)), { x: 0, y: 0 });

    // ------------------------------------------------ foreground base under the left half
    B.layer('base', A => {
      A.part(rect(70, 984, 896, 22), { fill: C.dark, halo: 2 }); A.part(P.triangles(70, 986, 896, 10, 56), { fill: C.shell, halo: 0 }); A.part(P.triangles(70, 996, 896, 10, 56, true), { fill: C.coral, halo: 0 });
      // jars on stands by the beard
      const jar = (x, y, s, f) => A.at({ x, y, s }, () => { A.part(poly([[-22, 0], [22, 0], [14, -30], [-14, -30]]), { fill: C.brown, halo: 2.5 }); A.part(blob([[-12, -110], [12, -110], [14, -100], [34, -80], [38, -54], [22, -30], [0, -24], [-22, -30], [-38, -54], [-34, -80], [-14, -100]], 8), { fill: f, under: C.dark, halo: 3, raise: 0.2, lines: [{ strokes: [curve([[-40, -64], [0, -56], [40, -64]]), curve([[-38, -48], [0, -40], [38, -48]])], w: 3 }, { strokes: [Object.assign(Array.from({ length: 11 }, (_, i) => [-38 + i * 7.6, -80 + (i % 2) * 10]), { open: true })], w: 3, ink: C.red }] }); A.part(rect(-16, -118, 32, 10), { fill: C.gold, halo: 2, gold: 0.5 }); });
      jar(924, 986, 0.72, [C.sand, C.clay]); jar(776, 986, 0.5, [C.shell, C.bone]);
      reeds(A, 86, 1000, 1.15, 5, 21); reeds(A, 224, 1002, 0.7, 5, 22);
    });

    // ------------------------------------------------ the musicians
    B.sprite('harper', { w: 470, h: 560, ox: 150, oy: 520, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); A.at({ s: 1.12 }, () => figure(A, man({ skin: SKIN.copper, ornament: 1, torso: undefined, pose: { lean: 4 + s * 2, legN: [82, 94], legF: [100, 92], armN: [18 + s * 7, -12 - c * 9], armF: [2 - s * 6, -16 + c * 8], head: 4 - s * 5 }, hands: { N: 'open', F: 'open' }, lower: kaun({ len: 150, flare: 56, rows: 6, tw: 22 }), collar: { color: [C.gold, C.sky, C.coral], rows: 3, w: 11, dots: C.shell }, armlet: { color: C.gold, gold: 0.8 }, bangle: { color: C.gold, gold: 0.8 } }))); });
    B.sprite('singer', { w: 330, h: 520, ox: 165, oy: 486, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU); A.at({ s: 1.06 }, () => figure(A, lady({ pose: { legN: [84, 92], legF: [98, 94], armN: [44 - s * 10, -52 - s * 10], armF: [30 + s * 10, -60 + s * 12], head: s * 5 }, hands: { N: 'flat', F: 'flat' } }))); });

    // ------------------------------------------------ banquet (register 1)
    const stool = (A, J) => { const x = J.hip[0] - 4, y = J.hip[1] + 20; A.part(rect(x - 36, y, 74, 12), { fill: [C.gold, C.dgold], halo: 2, gold: 0.4 }); for (const dx of [-30, 24]) A.part(limb([[x + dx, y + 12], [x + dx - 4, -60], [x + dx + 4, -4]], [12, 9, 13]), { fill: C.gold, halo: 1.6 }); A.stroke(line([x - 28, -34], [x + 30, -34]), { w: 6, color: C.gold, halo: 1.5 }); };
    const cup = (A, p, k = 1) => { A.part(blob([[p[0] - 12, p[1] - 26, 1], [p[0] + 12, p[1] - 26, 1], [p[0] + 8, p[1] - 4], [p[0], p[1] + 2], [p[0] - 8, p[1] - 4]], 6), { fill: [C.gold, C.dgold], halo: 2, gold: 0.8, lines: [{ strokes: [line([p[0] - 12, p[1] - 16], [p[0] + 12, p[1] - 16])], w: 2.6 }] }); };
    B.sprite('diner', { w: 230, h: 230, ox: 100, oy: 212, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU) * 0.5 + 0.5; A.at({ s: 0.56 }, () => figure(A, man({ pose: { ...POSE.sit, lean: 2, armN: [44 - s * 40, -46 - s * 14], armF: [80, 10], head: -s * 6 }, hands: { N: 'grip', F: 'flat' }, back: stool, lower: { path: J => limb([[J.hip[0] - 16, J.hip[1] - 2], [J.hip[0] + 30, J.hip[1] + 4], [J.knN[0] + 4, J.knN[1] + 4], [J.knN[0] - 2, J.knN[1] + 64]], [62, 62, 56, 60], { cap1: false }), fill: [C.shell, C.bone], lines: [], pat: (x, b) => { x.lineWidth = 2.6; x.strokeStyle = '#8d6a38'; for (let r = 0; r < 9; r++) for (let i = 0; i < 12; i++) { const X = b.x + i * 18 + (r % 2) * 9, Y = b.y + r * 18 - 6; x.beginPath(); x.moveTo(X - 9, Y); x.quadraticCurveTo(X - 8, Y + 15, X, Y + 22); x.quadraticCurveTo(X + 8, Y + 15, X + 9, Y); x.stroke(); } }, patInk: '#8d6a38' }, belt: null, front: (A, J) => cup(A, [J.haN[0] + 10, J.haN[1] - 2]) }))); });
    B.sprite('server', { w: 180, h: 240, ox: 90, oy: 222, n: 8 }, (A, ph) => A.at({ s: 0.5 }, () => figure(A, man({ pose: { ...POSE.walk(ph), armN: [20, -20], armF: [16, -24] }, front: (A, J) => { const h = J.haN; A.part(blob([[h[0] - 16, h[1] - 52], [h[0] + 14, h[1] - 52], [h[0] + 16, h[1] - 40], [h[0] + 30, h[1] - 18], [h[0] + 18, h[1] + 6], [h[0] - 20, h[1] + 6], [h[0] - 32, h[1] - 18], [h[0] - 18, h[1] - 40]], 7), { fill: [C.sky, C.mid], halo: 2, lines: [{ strokes: [line([h[0] - 32, h[1] - 18], [h[0] + 32, h[1] - 18])], w: 3 }] }); } }))));
    B.sprite('piper', { w: 200, h: 240, ox: 80, oy: 222, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU); A.at({ s: 0.5 }, () => figure(A, lady({ ornament: 0, torso: { fill: [C.sky, C.mid], lines: [] }, lower: { len: 182, flare: 48, w: 30, folds: 3, scallop: 3, fill: [C.sky, C.mid], gap: 16, bands: [{ at: 0.5, w: 18, color: C.gold, motif: 'tri', ink: C.red }, { at: 0.92, w: 18, color: C.shell, motif: 'dia', ink: C.red }] }, pose: { armN: [40 + s * 4, -38], armF: [30, -42 - s * 4], head: s * 3 }, hands: { N: 'grip', F: 'grip' }, front: (A, J) => { const m = [J.head[0] + 46, J.head[1] + 12]; for (const d of [0, 10]) A.part(limb([m, [J.haN[0] + 66, J.haN[1] + 24 + d]], [8, 12]), { fill: [C.gold, C.dgold], halo: 2, gold: 0.4 }); } }))); });

    // ------------------------------------------------ bearers (register 2)
    const fishShape = (A, x, y, k, c) => { A.part(blob([[x - 52 * k, y], [x - 20 * k, y - 20], [x + 26 * k, y - 16], [x + 50 * k, y], [x + 26 * k, y + 16], [x - 20 * k, y + 18]], 8), { fill: c, halo: 2, under: C.dark, lines: [{ strokes: Array.from({ length: 9 }, (_, i) => arc(x - 24 * k + i * 7 * k + (i % 2) * 2, y - 9 + (i % 3) * 9, 7, -1.5, 1.5, 6)), w: 2 }] }); A.part(poly([[x - 46 * k, y], [x - 78 * k, y - 20], [x - 70 * k, y], [x - 78 * k, y + 20]]), { fill: c, halo: 2 }); A.dots([[x + 36 * k, y - 4, 3.4]], { color: C.dark, halo: 1.4 }); };
    B.sprite('fisher', { w: 210, h: 250, ox: 100, oy: 226, n: 8 }, (A, ph) => A.at({ s: 0.52 }, () => figure(A, man({ pose: { ...POSE.walk(ph), armN: [66, -10], armF: [50, -16] }, hands: { N: 'grip', F: 'grip' }, front: (A, J) => { A.at({ x: J.haN[0] + 4, y: J.haN[1] + 34, r: 1.45 }, () => fishShape(A, 0, 0, 1, [C.shell, C.sky])); A.at({ x: J.haN[0] + 36, y: J.haN[1] + 38, r: 1.6 }, () => fishShape(A, 0, 0, 0.9, [C.coral, C.red])); } }))));
    const sheep = (A, ph, c = [C.shell, C.bone]) => { const s = Math.sin(ph * TAU), cc = Math.cos(ph * TAU); const leg = (x, k, f) => A.part(limb([[x, -70], [x + k * 8, -36], [x + k * 16, -3 - Math.max(0, k) * 4]], [22, 13, 10]), { fill: f, halo: 2.4 }); leg(-44, -s, C.brown); leg(42, s, C.brown); A.part(blob([[-74, -84], [-58, -120], [0, -126], [54, -122], [76, -96], [62, -64], [0, -56], [-58, -60]], 9), { fill: c, under: C.brown, halo: 3, lines: [{ strokes: Array.from({ length: 24 }, (_, i) => { const x = -54 + (i % 8) * 16 + (Math.floor(i / 8) % 2) * 8, y = -106 + Math.floor(i / 8) * 18; return spiral(x, y, 7, 1.4, 0, 1.3, 14); }), w: 2.6 }] }); leg(-56, s, C.clay); leg(54, -s, C.clay); A.part(blob([[62, -112], [80, -136], [104, -134], [126, -112], [124, -100], [100, -98], [76, -88]], 8), { fill: [C.sand, C.clay], halo: 3 }); A.part(curve([[84, -132], [70, -150], [52, -140], [58, -122], [74, -124]]).length ? limb([[86, -130], [70, -150], [52, -140], [60, -122]], [14, 12, 9, 4]) : [], { fill: [C.bone, C.brown], halo: 2, lines: [{ strokes: Array.from({ length: 6 }, (_, i) => line([82 - i * 5, -152 + i * 2], [76 - i * 5, -132 + i * 2])), w: 1.8 }] }); A.dots([[102, -120, 3.4]], { color: C.dark, halo: 1.4 }); A.stroke(curve([[-74, -100], [-88, -90], [-86, -70]]), { w: 8, color: C.bone, taper1: 0.4, halo: 2 }); };
    B.sprite('sheep', { w: 190, h: 130, ox: 90, oy: 118, n: 8 }, (A, ph) => A.at({ s: 0.68 }, () => sheep(A, ph)));
    B.sprite('goat', { w: 190, h: 140, ox: 90, oy: 128, n: 8 }, (A, ph) => A.at({ s: 0.68 }, () => sheep(A, ph, ['#9c5a2a', C.brown])));
    B.sprite('herder', { w: 180, h: 250, ox: 90, oy: 226, n: 8 }, (A, ph) => A.at({ s: 0.52 }, () => figure(A, man({ pose: { ...POSE.walk(ph), armN: [40, 0] }, hands: { N: 'grip', F: 'open' }, beard: bearded, hair: { kind: 'bob', fill: ['#1d130d', '#2c1a10'], gap: 10 }, lower: kaun({ fill: [C.coral, C.red], ink: C.shell }), front: (A, J) => A.part(limb([[J.haN[0] + 6, J.haN[1] - 120], [J.haN[0] + 4, J.haN[1] + 110]], [9, 10]), { fill: [C.gold, C.brown], halo: 2 }) }))));
    B.sprite('sack', { w: 200, h: 250, ox: 100, oy: 226, n: 8 }, (A, ph) => A.at({ s: 0.52 }, () => figure(A, man({ pose: { ...POSE.walk(ph), lean: 14, armN: [64, -108], armF: [56, -112] }, hands: { N: 'grip', F: 'grip' }, lower: kaun({ fill: [C.sky, C.mid], ink: C.shell }), front: (A, J) => A.part(blob([[J.neck[0] - 70, J.neck[1] - 30], [J.neck[0] - 20, J.neck[1] - 46], [J.neck[0] - 6, J.neck[1] - 10], [J.neck[0] - 20, J.neck[1] + 40], [J.neck[0] - 62, J.neck[1] + 50], [J.neck[0] - 84, J.neck[1] + 10]], 8), { fill: [C.sand, C.clay], halo: 3, under: C.brown, lines: [{ flow: { gap: 11, w: 2.6, margin: 4, field: [{ dir: 1.3 }] } }] }) }))));
    B.sprite('scribe', { w: 220, h: 240, ox: 100, oy: 222, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU * 2); A.at({ s: 0.56 }, () => figure(A, man({ pose: { ...POSE.sit, lean: 6, armN: [60, -30 + s * 8], armF: [70, -40], head: 14 }, hands: { N: 'grip', F: 'cup' }, back: stool, lower: { path: J => limb([[J.hip[0] - 16, J.hip[1] - 2], [J.hip[0] + 30, J.hip[1] + 4], [J.knN[0] + 4, J.knN[1] + 4], [J.knN[0] - 2, J.knN[1] + 64]], [62, 62, 56, 60], { cap1: false }), fill: [C.sky, C.mid], lines: [], pat: (x, b) => { x.lineWidth = 2.6; x.strokeStyle = C.shell; for (let r = 0; r < 9; r++) for (let i = 0; i < 12; i++) { const X = b.x + i * 18 + (r % 2) * 9, Y = b.y + r * 18 - 6; x.beginPath(); x.moveTo(X - 9, Y); x.quadraticCurveTo(X - 8, Y + 15, X, Y + 22); x.quadraticCurveTo(X + 8, Y + 15, X + 9, Y); x.stroke(); } }, patInk: C.shell }, belt: null, front: (A, J) => { const x = J.haF[0] + 14, y = J.haF[1] - 14; A.part(rrect(x - 4, y - 34, 50, 60, 8), { fill: [C.sand, C.clay], halo: 2.4 }); for (let i = 0; i < 4; i++) A.text('𒄖𒌨𒆠𒀭'.slice(i * 2, i * 2 + 2), x + 4, y - 18 + i * 14, { font: '13px "Noto Sans Cuneiform"', color: C.dark, halo: 0 }); A.stroke(line([J.haN[0] + 4, J.haN[1] - 20], [J.haN[0] + 28, J.haN[1] + 16]), { w: 5, color: C.red, halo: 1.5 }); } }))); });

    // ------------------------------------------------ onager cart (register 3)
    const onager = (A, ph, x, c) => A.at({ x }, () => { const s = k => Math.sin((ph + k) * TAU), leg = (lx, k, f) => { const q = s(k), lift = Math.max(0, Math.cos((ph + k) * TAU)); A.part(limb([[lx, -104], [lx + q * 24 + (lx < 0 ? -6 : 8), -56 - lift * 8], [lx + q * 48, -6 - lift * 24]], [30, 15, 11]), { fill: f, halo: 2.4 }); A.part(poly([[lx + q * 48 - 8, -8 - lift * 24], [lx + q * 48 + 10, -8 - lift * 24], [lx + q * 48 + 12, 0 - lift * 24], [lx + q * 48 - 9, 0 - lift * 24]]), { fill: C.dark, halo: 1 }); }; leg(-60, 0.5, '#7a4a24'); leg(56, 0.85, '#7a4a24');
      A.part(oBody, { fill: c, under: C.dark, halo: 3, lines: [{ strokes: oFlow, w: 3, taper: 0.2 }] });
      leg(-72, 0, c[0]); leg(66, 0.35, c[0]); A.part(limb([[122, -228], [104, -206], [82, -170]], [12, 22, 8]), { fill: C.dark, halo: 2, lines: [{ strokes: Array.from({ length: 6 }, (_, i) => line([122 - i * 8, -226 + i * 10], [106 - i * 8, -216 + i * 9])), w: 2 }] }); for (const a of [-2.1, -1.75]) A.part(petal(122, -226, 44, 16, a, 0.5), { fill: c[0], halo: 2 }); A.dots([[146, -204, 4]], { color: C.dark, halo: 2 }); A.stroke(curve([[-88, -130], [-106, -100], [-104, -66]]), { w: 7, color: C.dark, taper1: 0.5, halo: 2 });
      A.stroke(curve([[132, -226], [140, -196], [160, -178]]), { w: 5, color: C.red, halo: 1.4 }); A.part(limb([[52, -170], [72, -132], [84, -98]], [20, 22, 16]), { fill: [C.red, '#6a1e0e'], halo: 2, lines: [{ dots: Array.from({ length: 5 }, (_, i) => [56 + i * 6, -160 + i * 14, 3.4]), ink: C.gold }] }); });
    const oBody = blob([[-88, -118], [-74, -150], [-20, -158], [40, -154], [72, -168], [104, -216], [118, -232], [150, -224], [186, -192], [186, -176], [168, -172], [140, -182], [120, -150], [92, -108], [40, -96], [-40, -92], [-82, -96]], 9), oFlow = flowLines(oBody, { gap: 13, margin: 5, minLen: 20, field: [{ vortex: [-54, -122, 32, 1], w: 1.4 }, { vortex: [68, -132, 30, -1], w: 1.3 }, { guide: curve([[-80, -120], [0, -126], [80, -140], [120, -200], [170, -190]]), w: 1, fall: 100 }] });
    B.sprite('cart', { w: 660, h: 260, ox: 330, oy: 232, n: 6 }, (A, ph) => A.at({ s: 0.66 }, () => {
      for (let i = 3; i >= 0; i--) onager(A, ph + i * 0.18, 150 + i * 46, [[C.sand, '#a9652c'], [C.shell, C.bone], ['#b9743a', '#8a4a20'], [C.shell, C.bone]][i]);
      A.stroke(curve([[-120, -86], [0, -118], [130, -140]]), { w: 9, color: C.gold, halo: 2 }); for (const d of [0, 10, 20]) A.stroke(curve([[-150, -186 + d], [0, -170 + d], [290, -192 + d * 0.5]]), { w: 4, color: C.red, halo: 1.4 });
      // driver and spear bearer
      A.at({ x: -200, y: -64, s: 0.66 }, () => figure(A, man({ pose: { lean: 8, armN: [30, 6], armF: [20, 0] }, hands: { N: 'grip', F: 'grip' }, beard: bearded, hat: A => A.part(blob([[-52, -8], [-52, -40], [-24, -60], [14, -58], [38, -36], [36, -20], [0, -24], [-30, 4]], 7), { fill: [C.gold, C.dgold], halo: 2, gold: 0.7, lines: [{ strokes: [curve([[-50, -16], [-10, -32], [36, -26]])], w: 3 }] }) })));
      A.at({ x: -276, y: -60, s: 0.66 }, () => figure(A, man({ pose: { armN: [60, -50], armF: [70, 20] }, hands: { N: 'grip', F: 'grip' }, lower: kaun({ fill: [C.coral, C.red], ink: C.shell }), hat: A => A.part(blob([[-52, -8], [-52, -40], [-24, -60], [14, -58], [38, -36], [36, -20], [0, -24], [-30, 4]], 7), { fill: [C.sky, C.mid], halo: 2, lines: [{ strokes: [curve([[-50, -16], [-10, -32], [36, -26]])], w: 3 }] }), front: (A, J) => { A.stroke(line([J.haN[0] - 20, J.haN[1] + 120], [J.haN[0] + 30, J.haN[1] - 150]), { w: 8, color: C.gold, halo: 2 }); A.part(petal(J.haN[0] + 29, J.haN[1] - 146, 50, 22, -1.39), { fill: C.shell, halo: 2 }); } })));
      A.part(poly([[-330, -128], [-314, -160], [-300, -128], [-150, -128], [-140, -196], [-112, -196], [-104, -72], [-330, -72]]), { fill: [C.red, '#6a1e0e'], under: C.gold, halo: 3, raise: 0.2, lines: [{ strokes: Array.from({ length: 8 }, (_, i) => line([-320 + i * 27, -122], [-296 + i * 27, -76])), w: 4 }, { strokes: Array.from({ length: 8 }, (_, i) => line([-296 + i * 27, -122], [-320 + i * 27, -76])), w: 4 }, { strokes: [line([-340, -124], [-100, -124]), line([-340, -78], [-100, -78])], w: 6, ink: C.gold }] });
      for (const wx of [-278, -146]) { A.part(circ(wx, -50, 52, 48), { fill: [C.sand, C.clay], under: C.dark, halo: 4, raise: 0.2, lines: [{ strokes: [arc(wx, -50, 42, 0, TAU, 40)], w: 5, ink: C.dark }, { strokes: [0, 1].map(k => { const a = ph * TAU / 2 + 0; return line([wx + Math.cos(a) * 42 + Math.sin(a) * (k ? 15 : -15), -50 + Math.sin(a) * 42 - Math.cos(a) * (k ? 15 : -15)], [wx - Math.cos(a) * 42 + Math.sin(a) * (k ? 15 : -15), -50 - Math.sin(a) * 42 - Math.cos(a) * (k ? 15 : -15)]); }), w: 4, ink: C.dark }, { dots: P.ringDots(wx, -50, 47, 16, 2.4, ph * TAU / 2), ink: C.red }] }); A.part(circ(wx, -50, 11), { fill: C.gold, halo: 2, gold: 0.6 }); }
    }));
    B.sprite('runner', { w: 220, h: 250, ox: 100, oy: 226, n: 8 }, (A, ph) => A.at({ s: 0.52 }, () => figure(A, man({ pose: { ...POSE.run(ph), armN: [70, -14] }, hands: { N: 'grip', F: 'open' }, lower: kaun({ len: 96, flare: 46, rows: 4 }), front: (A, J) => { A.stroke(line([J.haN[0] - 60, J.haN[1] + 20], [J.haN[0] + 70, J.haN[1] - 24]), { w: 7, color: C.gold, halo: 2 }); } }))));

    // ------------------------------------------------ water life
    B.sprite('reedboat', { w: 340, h: 190, ox: 170, oy: 150, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU); const hull = [[-150, -84], [-132, -30], [-64, 0], [60, 0], [128, -30], [152, -88]]; A.part(limb(hull, [8, 26, 40, 40, 26, 8]), { fill: [C.gold, C.clay], under: C.brown, halo: 4, lines: [{ flow: { gap: 8, w: 2.4, margin: 3, field: [{ guide: curve(hull), w: 1, fall: 300 }] } }, { strokes: [0.18, 0.34, 0.5, 0.66, 0.82].map(u => { const [x, y, a] = at(curve(hull), u); return line([x - Math.sin(a) * 24, y + Math.cos(a) * 24], [x + Math.sin(a) * 24, y - Math.cos(a) * 24]); }), w: 5, ink: C.red }] });
      A.at({ x: -62, y: -16, s: 0.36 }, () => figure(A, man({ pose: { lean: 8 + s * 8, armN: [10, -40 + s * 14], armF: [0, -50 + s * 14] }, hands: 'grip', lower: kaun({ len: 100, rows: 4 }), front: (A, J) => A.part(limb([[J.haN[0] + 20, J.haN[1] - 130], [J.haN[0] - 60, J.haN[1] + 320]], [10, 11]), { fill: C.gold, halo: 2 }) })));
      A.at({ x: 56, y: -10, s: 0.36 }, () => figure(A, lady({ pose: { ...POSE.sit, armN: [40, -20], armF: [30, 10] }, lower: { path: J => limb([[J.hip[0] - 10, J.hip[1]], [J.knN[0], J.knN[1]], [J.ftN[0] - 4, J.ftN[1] - 24]], [58, 52, 54], { cap1: false }), fill: [C.red, '#7c2412'], lines: [] } }))); A.part(blob([[0, -22], [26, -22], [30, -44], [14, -54], [-4, -44]], 7), { fill: [C.sand, C.clay], halo: 2, lines: [{ strokes: [line([-2, -36], [30, -36])], w: 2.6 }] }); });
    B.sprite('fish', { w: 130, h: 80, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU) * 7, sp = [[44, 0], [14, 0], [-14, s * 0.4], [-38, s]]; A.part(poly([[-34, s * 0.9], [-58, -15 + s * 1.5], [-50, s * 1.3], [-58, 15 + s * 1.5]]), { fill: C.coral, halo: 2 }); A.part(limb(sp, [14, 32, 28, 8]), { fill: [C.shell, C.coral], under: C.dark, halo: 2.4, lines: [{ strokes: Array.from({ length: 8 }, (_, i) => arc(16 - i * 6, (i % 2 ? 6 : -6), 7, -1.3, 1.3, 6)), w: 2 }] }); A.dots([[34, -3, 3]], { color: C.dark, halo: 1 }); });
    B.sprite('bird', { w: 200, h: 170, n: 8 }, (A, ph) => { const f = Math.sin(ph * TAU); const wing = (k, c) => A.part(limb([[-2, -4], [-16 + k * 8, -8 - f * 34], [-44 + k * 14, -12 - f * 62]], [28, 34, 6]), { fill: c, under: C.dark, halo: 2, lines: [{ flow: { gap: 7, w: 2, margin: 3, field: [{ guide: curve([[-2, -4], [-16, -8 - f * 34], [-44, -12 - f * 62]]), w: 1, fall: 200 }] } }] }); wing(1, [C.bone, C.clay]); A.part(limb([[-66, 10], [-28, 4], [16, 0], [44, -8], [60, -8]], [5, 24, 24, 12, 10]), { fill: [C.shell, C.bone], under: C.dark, halo: 2, lines: [{ flow: { gap: 8, w: 2, margin: 3, field: [{ dir: -0.1 }] } }] }); A.part(poly([[62, -12], [82, -5], [62, -4]]), { fill: C.gold, halo: 1 }); A.dots([[58, -10, 2.4]], { color: C.dark, halo: 0.8 }); wing(0, [C.shell, C.bone]); });
    B.sprite('climber', { w: 60, h: 90, ox: 30, oy: 80, n: 4 }, (A, ph) => A.at({ s: 0.17 }, () => figure(A, man({ pose: { ...POSE.carry(ph) }, front: (A, J) => A.part(blob([[J.haN[0] - 60, J.haN[1] - 20], [J.haN[0] + 50, J.haN[1] - 20], [J.haN[0] + 30, J.haN[1] - 70], [J.haN[0] - 44, J.haN[1] - 70]]), { fill: C.coral }) }))));

    // ------------------------------------------------ the cylinder seal
    B.sprite('seal', { w: 300, h: 1120, ox: 150, oy: 560, n: 12, res: 0.62 }, (A, ph) => {
      const R = 112, H = 520; A.part(rrect(-R, -H, R * 2, H * 2, 16), { fill: { lin: [-R, 0, R, 0], stops: [[0, '#0f1f3f'], [0.16, '#24508f'], [0.34, '#7fa9dc'], [0.46, '#4d7fc0'], [0.72, '#1f4280'], [1, '#0a1428']] }, halo: 0, raise: 0 });
      // carved figures wrapping round: 3 repeats per turn
      const X = th => Math.sin(th) * (R - 70 * Math.max(0.05, Math.cos(th)) * Math.abs(Math.sin(th))), K = th => Math.cos(th), per = TAU / 4;
      for (let k = -2; k <= 2; k++) { const th = (k + ph) * per; if (Math.abs(th) > 1.62) continue; const x = X(th), q = Math.max(0.05, K(th)), al = clamp(q * 1.6);
        const m = (fn) => A.at({ x, sx: q }, fn);
        m(() => { A.with({ alpha: al }, () => { const L = '#d9e6f2', Dk = '#0e1d3c';
          // standing figure holding palm, star, bull, rosette, fish, wheat in stacked registers
          for (const [y, f] of [[-440, 0], [-300, 1], [-160, 2], [-20, 3], [120, 4], [260, 5], [400, 0]]) {
            if (f === 0) { A.part(star(0, y, 46, 18, 8), { fill: L, halo: 5 }); A.part(circ(0, y, 12), { fill: Dk, halo: 0 }); }
            if (f === 1) { A.part(blob([[-56, y + 20], [-40, y - 24], [20, y - 26], [40, y - 48], [60, y - 40], [56, y - 10], [40, y + 22], [44, y + 52], [30, y + 52], [24, y + 24], [-30, y + 24], [-34, y + 52], [-48, y + 52]], 6), { fill: L, halo: 5, lines: [{ flow: { gap: 12, w: 3.4, margin: 4, field: [{ contour: 1 }] } }] }); A.stroke(curve([[44, y - 46], [40, y - 72], [58, y - 80]]), { w: 8, color: L, halo: 3 }); }
            if (f === 2) { for (const p of P.petals(0, y, 8, 8, 40, 24)) A.part([p], { fill: L, halo: 2 }); A.part(circ(0, y, 10), { fill: '#b8452a', halo: 2 }); }
            if (f === 3) { A.stroke(line([0, y + 56], [0, y - 30]), { w: 9, color: L, halo: 4 }); for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.42; A.part(petal(0, y - 28, 52, 15, a), { fill: L, halo: 2.5 }); } }
            if (f === 4) { A.part(circ(0, y - 40, 15), { fill: L, halo: 4 }); A.part(blob([[-20, y - 22], [20, y - 22], [24, y + 10], [34, y + 54], [-34, y + 54], [-24, y + 10]], 6), { fill: L, halo: 4, lines: [{ strokes: [-6, 8, 22, 36].map(d => line([-34, y + d], [34, y + d])), w: 4 }] }); A.stroke(line([18, y - 14], [52, y - 34]), { w: 9, color: L, halo: 3 }); }
            if (f === 5) { A.part(blob([[-48, y], [-10, y - 22], [40, y], [-10, y + 22]], 8), { fill: L, halo: 4 }); A.part(poly([[-40, y], [-64, y - 22], [-64, y + 22]]), { fill: L, halo: 3 }); }
          }
          A.stroke(line([70, -500], [70, 500]), { w: 6, color: '#9fb9da', halo: 3 });
        }); }); }
      // rims and gold caps
      for (const y of [-500, -372, -232, -92, 52, 192, 332, 478]) A.part(rect(-R, y - 3, R * 2, 7), { fill: { lin: [-R, 0, R, 0], stops: ['#0a1428', '#cfe0f2', '#0a1428'] }, halo: 2 });
      for (const k of [-1, 1]) { A.part(rrect(-R - 8, k > 0 ? 506 : -548, R * 2 + 16, 42, 12), { fill: { lin: [-R - 8, 0, R + 8, 0], stops: ['#5a3610', '#f2cf77', C.gold, '#4a2a0c'] }, halo: 3, gold: 1, raise: 0.9, lines: [{ strokes: Array.from({ length: 12 }, (_, i) => { const th = (i / 12 + ph / 4) * TAU; return Math.cos(th) > 0 ? line([Math.sin(th) * R, k > 0 ? 508 : -546], [Math.sin(th) * R, k > 0 ? 546 : -508]) : line([0, 0], [0.01, 0]); }), w: 4, ink: C.red }] }); }
    });

    // ------------------------------------------------ frame
    B.layer('frame', A => {
      A.with({ halo: 0 }, () => P.frame(A, 14, 14, 1892, 1052, 60, (A, len) => {
        A.part(rect(-60, 0, len + 120, 60), { fill: C.dark, halo: 0 });
        const n = Math.round(len / 32), u = len / n; A.part(P.triangles(0, 2, len, 13, n), { fill: C.shell, halo: 0 }); A.part(P.triangles(0, 15, len, 13, n, true).map(p => p), { fill: C.coral, halo: 0 }); A.part(rect(-60, 28, len + 120, 4), { fill: C.gold, halo: 0, gold: 0.8 });
        const m = Math.round(len / 46), v = len / m, pet = [[], []], eyes = []; for (let i = 0; i < m; i++) { const x = (i + 0.5) * v; A.part(rect(i * v + 1, 33, v - 2, 22), { fill: i % 2 ? C.mid : C.red, halo: 0 }); pet[i % 2].push(...P.petals(x, 44, 8, 2, 9, 5.4)); eyes.push([x, 44, 2.8]); }
        A.part([...pet[0], ...pet[1]], { fill: C.shell, halo: 0.6 }); A.dots(eyes, { color: C.gold, halo: 0 });
        A.part(rect(-60, 56, len + 120, 4), { fill: C.gold, halo: 0, gold: 0.8 });
      }));
      for (const [x, y] of [[44, 44], [1876, 44], [44, 1036], [1876, 1036]]) { A.part(rect(x - 30, y - 30, 60, 60), { fill: C.mid, halo: 0 }); rosette(A, x, y, 24, { fill: C.gold, gold: 0.8, bg: C.dark }); }
    });
  },
  draw(g, t) {
    const beat = t / 0.625, rollX = lerp(-170, 2110, seg(t, 0.05, 1.95, ease.inOutSine));
    const soft = 0.018, R3 = { mode: 3, rvp: [0, 0, 0, 1920], soft, noise: 0.012, glow: 0.5, edge: 0.03, rv: t > 2 ? 1 : clamp((rollX / 1920 + 0.01) / (1 + soft + 0.02), 0, 1) };
    const L = (n, o = {}) => g.layer(n, { ...R3, ...o }), S = (n, o) => g.sprite(n, { ...R3, ...o });
    const D = (n, o, col = C.lapis, w = 3) => { for (let k = 0; k < 8; k++) g.sprite(n, { ...R3, ...o, x: o.x + Math.cos(k * TAU / 8) * w, y: o.y + Math.sin(k * TAU / 8) * w, tint: col, glow: 0 }); g.sprite(n, { ...R3, ...o }); };
    g.ground({ ...R3, color: C.lapis, x: 14, y: 14, w: 1892, h: 1052, noise: 0.02 });
    L('tone'); L('far');
    // fish in the rivers, boats on the canal
    for (let i = 0; i < 6; i++) { const u = ((t * 0.10 + i * 0.37) % 1); const left = i % 2; const pl = left ? [[902, 70], [876, 120], [896, 180], [926, 232], [904, 296], [898, 340], [920, 400]] : [[1772, 70], [1802, 130], [1776, 196], [1748, 246], [1778, 310], [1790, 350], [1766, 400]]; const [x, y, a] = at(curve(pl, 8), 0.08 + u * 0.8); S('fish', { x, y, r: a, s: 0.62, ph: t * 1.8 + i * 0.3 }); }
    for (let i = 0; i < 5; i++) { const x = 1010 + ((i * 190 + t * 34) % 800), y = 420 + (i % 2) * 12; S('fish', { x, y, s: 0.6, ph: t * 2 + i * 0.4 }); }
    D('reedboat', { x: 236 - t * 10, y: 436 + Math.sin(t * 2.1) * 3, r: Math.sin(t * 1.6) * 0.02, s: 0.72, flip: true, ph: t * 0.8 }, '#0f3557', 3);
    D('reedboat', { x: 1060 + t * 46, y: 438 + Math.sin(t * 2 + 1) * 3, r: Math.sin(t * 1.5 + 1) * 0.02, s: 0.78, ph: t * 0.8 + 0.4 }, '#0f3557', 3);
    D('reedboat', { x: 1560 + t * 30, y: 436 + Math.sin(t * 2.3 + 2) * 3, r: Math.sin(t * 1.4 + 2) * 0.02, s: 0.68, ph: t * 0.8 + 0.2 }, '#0f3557', 3);
    for (let i = 0; i < 7; i++) { const u = ((t * 0.10 + i / 7) % 1), y = lerp(384, 190, u); S('climber', { x: 1340 + (i % 2 ? 12 : -12) * (1 - u * 0.5), y, s: lerp(0.95, 0.5, u), ph: t * 1.6 + i * 0.3, flip: i % 2 === 1, alpha: clamp((0.93 - u) * 12) }); }
    for (const k of [-1, 1]) for (let i = 0; i < 3; i++) { const u = ((t * 0.12 + i / 3 + (k > 0 ? 0.15 : 0)) % 1); S('climber', { x: 1340 + k * lerp(290, 60, u), y: lerp(384, 302, u), s: 0.9, flip: k > 0, ph: t * 1.6 + i * 0.37 }); }
    for (let i = 0; i < 7; i++) { const x = -60 + ((i * 290 + t * 90 + (i % 2) * 70) % 2040), y = 190 + Math.sin(i * 2.1) * 60 + Math.sin(t * 1.6 + i) * 10; S('bird', { x, y, s: 0.5 + (i % 3) * 0.06, ph: t * 1.7 + i * 0.23 }); }
    L('guil'); L('bands');
    // register 1: banquet
    const cupT = t * 0.8; const y1 = 634, y2 = 811, y3 = 990;
    [[1078, 0], [1196, 0], [1398, 1], [1506, 1], [1770, 1]].forEach(([x, f], i) => D('diner', { x, y: y1, s: 0.86, flip: !!f, ph: cupT + i * 0.17 }, '#5c180b', 2.4));
    D('server', { x: 1292 + Math.sin(t * 0.9) * 10, y: y1, s: 0.84, ph: t * 0.8 }, '#5c180b', 2.4); D('piper', { x: 1596, y: y1, s: 0.84, ph: t * 1.6 }, '#5c180b', 2.4);
    D('server', { x: 1700, y: y1, s: 0.84, flip: true, ph: t * 0.8 + 0.5 }, '#5c180b', 2.4);
    // register 2: bearers, flocks, scribe
    const mv = t * 22; for (const [n, x, s] of [['sack', 1040, 0.8], ['goat', 1128, 0.94], ['herder', 1230, 0.82], ['sheep', 1330, 0.94], ['sheep', 1428, 0.88], ['fisher', 1524, 0.8], ['sack', 1606, 0.8]]) { const X = 1030 + ((x - 1030 + mv) % 690); if (X < 1672) D(n, { x: X, y: y2, s, ph: t * 0.95 + x * 0.013, alpha: clamp((X - 1030) / 16) * clamp((1670 - X) / 16) }, '#0e2350', 2.4); }
    D('scribe', { x: 1768, y: y2, s: 0.86, flip: true, ph: t * 0.6 }, '#0e2350', 2.4);
    // register 3: cart and runners
    D('cart', { x: 1350 + Math.sin(t * 0.8) * 8 + t * 10, y: y3, s: 0.86, ph: t * 1.25 }, '#5c180b', 2.4);
    D('runner', { x: 1078 + t * 10, y: y3, s: 0.84, ph: t * 1.25 }, '#5c180b', 2.4); D('runner', { x: 1670 + t * 10, y: y3, s: 0.84, ph: t * 1.25 + 0.4 }, '#5c180b', 2.4); D('runner', { x: 1752 + t * 8, y: y3, s: 0.84, ph: t * 1.25 + 0.1 }, '#5c180b', 2.4);
    // the lyre and its players
    L('base'); D('singer', { x: 152, y: 992, s: 0.98, ph: t * 0.8 }, C.lapis, 4);
    L('lyre', { glow: 0.8 }); L('bull', { y: Math.sin(beat * TAU) * 1.2 });
    D('harper', { x: 322, y: 992, s: 0.98, ph: beat * 0.5 }, C.lapis, 3.4);
    L('frame');

    // ---- thread: crossbar → twelve strings → out along the canal
    const pl = [], hits = [1.25, 1.875, 2.5, 3.125, 3.75, 4.375], path = []; const add = (x, y, z) => path.push([x, y, z]);
    const N0 = 24; for (let i = 0; i <= N0; i++) { const u = i / N0; const p = at(curve([[-120, 540], [20, 520], [150, 452], [262, 396], [318, 352], [TOP(0)[0] - 10, TOP(0)[1] - 4]]), u); add(p[0], p[1] + Math.sin(u * 12 - t * 6) * 8 * (1 - u), 14 + 8 * Math.sin(u * 9)); }
    const vib = i => { let a = 0; hits.forEach((h, q) => { const d = t - h - i * 0.016 * (q % 2 ? 1 : 1); if (d > 0 && d < 1.3) a += (q === 2 ? 11 : 7.5) * Math.exp(-3.2 * d) * Math.sin(d * (62 + i * 5)); }); return a; };
    for (let i = 0; i < NS; i++) { const a = i % 2 ? BOT(i) : TOP(i), b = i % 2 ? TOP(i) : BOT(i), v = vib(i), M = 26; add(a[0], a[1], -6); for (let k = 1; k < M; k++) { const u = k / M; add(lerp(a[0], b[0], u) + v * Math.sin(u * Math.PI) + v * 0.35 * Math.sin(u * TAU * 2), lerp(a[1], b[1], u), 12 + 6 * Math.sin(u * Math.PI)); } add(b[0], b[1], -6); }
    const iEnd = path.length - 1, wv = key(t, [[0, 0], [2.4, 4], [2.6, 34], [5, 16]]); const out = curve([TOP(NS - 1), [800, 286], [880, 360], [960, 420], [1100, 424], [1400, 422], [1700, 424], [1830, 446], [1920, 520], [2040, 540]], 14); resample(out, 7).forEach((p, i, q) => { if (!i) return; const u = i / q.length, k = clamp((p[0] - 900) / 160) * clamp((1860 - p[0]) / 200); add(p[0], p[1] + Math.sin(p[0] * 0.055 - t * 15) * wv * k * (0.45 + 0.55 * Math.sin(p[0] * 0.011 - t * 5)), 12 + 6 * Math.sin(p[0] * 0.03)); });
    const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2])); const Lt = cum[cum.length - 1];
    const head = key(t, [[0.3, 0], [0.86, cum[N0] / Lt, ease.in2], [1.22, cum[iEnd] / Lt, ease.inOut2], [1.9, cum[iEnd] / Lt], [2.9, 1, ease.inOut2]]);
    hits.forEach(h => { const b = t - h; if (b > 0 && b < 1.1) { const am = 10 * Math.exp(-3 * b) * Math.cos(b * 16), R2 = (120 + b * 260) ** 2; for (const p of path) p[2] += am * Math.exp(-((p[0] - 580) ** 2 + (p[1] - 640) ** 2) / R2); } });
    g.thread(path, { w: 6.2, hero: 1, f1: head, spark: 1 });
    // notes: rings of gold dust from the lyre
    hits.forEach((h, q) => { const a = t - h; if (a < 0 || a > 1.1) return; g.bump(580, 640, 120 + a * 260, 10 * Math.exp(-3 * a) * Math.cos(a * 16)); for (let w = 0; w < 2; w++) { const r = 60 + (a - w * 0.1) * 520; if (r < 60) continue; const n = 120; for (let k = 0; k < n; k++) { const h1 = hash(k * 7 + q * 31 + w), an = k / n * TAU + q, rr = r * (0.86 + 0.2 * h1) + Math.sin(an * 5 + q) * 10; const e = 1 - a / 1.1; g.part(580 + Math.cos(an) * rr * 0.9, 620 + Math.sin(an) * rr * 0.75, 14 + 40 * h1, 1.6 + 3 * hash(k * 3), 2.2 * e, 1.5 * e, 0.6 * e, 0.8 * e * e, 0); } } g.burst(560, 640, h, { n: q === 2 ? 60 : 26, speed: q === 2 ? 420 : 240, seed: 60 + q }); });
    g.burst(BULL.x + 40, BULL.y - 30, 2.5, { n: 24, speed: 150, seed: 91, col: [0.8, 1.4, 2.4] });
    // ---- the cylinder seal rolls across, dust at its feet
    if (t < 2.05) { g.bump(rollX, 300, 150, 18); g.bump(rollX, 800, 150, 18); g.sprite('seal', { x: rollX, y: 540, ph: rollX / (TAU * 112 / 4), lift: 34, shadow: 1, glow: 0 }); for (let k = 0; k < 90; k++) { const h1 = hash(k * 13), h2 = hash(k * 29 + 5), age = (t * 1.6 + h1) % 1, bx = rollX - 168 - age * (50 + 150 * h2), y = 40 + h2 * 1000; if (bx < 10) continue; g.part(bx, y - age * 22, 20 + 50 * hash(k * 7), 10 + 30 * age * h1, 0.7, 0.55, 0.36, 0.2 * (1 - age), 3, k + t, 0, 0); } for (let k = 0; k < 50; k++) { const h1 = hash(k * 17 + 3), age = (t * 2.4 + h1) % 1; g.part(rollX - 112 - age * 70 * hash(k), 30 + hash(k * 5) * 1020, 24 + 30 * h1, 2.4, 2.0 * (1 - age), 1.3 * (1 - age), 0.5 * (1 - age), 1 - age, 0); } }
    g.drift({ n: 80, vx: 12, vy: -8, col: [1.2, 0.9, 0.45], a: 0.45, size: 2.4 });
  },
  shots: [
    { end: 1.25, cam: p => ({ x: lerp(300, 720, ease.inOut2(p)), y: lerp(620, 560, p), w: lerp(820, 1420, ease.inOut2(p)), tilt: lerp(0.28, 0.14, p), yaw: lerp(-0.16, 0.0, p), aperture: 3 }) },
    { end: 3.125, cam: p => ({ x: lerp(500, 720, ease.inOut2(p)), y: lerp(600, 690, ease.inOut2(p)), w: lerp(560, 760, ease.inOut2(p)), tilt: lerp(0.34, 0.2, p), yaw: lerp(-0.16, 0.12, p), aperture: 5 }) },
    { end: 5, cam: p => ({ x: lerp(1290, 975, ease.inOut2(p)), y: lerp(690, 545, ease.inOut2(p)), w: lerp(1050, 1840, ease.inOut2(p)), tilt: lerp(0.2, 0.04, p), aperture: 2.5 }) },
  ],
};
