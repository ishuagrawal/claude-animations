// The Aegean, Greece, c. 550 BCE — warp-weighted loom, black-figure. The thread crosses a loom as weft, winds to the heart of
// the labyrinth and out again as Ariadne's clue, and is hauled taut as the stay of a ship.
import { spl, blob, poly, rect, rrect, limb, circ, ell, ring, arc, arcBand, curve, line, spiral, petal, star, T, at, sub, offset, wavy, resample, plen, lerp, clamp, TAU, rng } from '../art/geom.js';
import * as P from '../art/patterns.js';
import { figure, SKIN, POSE } from '../art/figures.js';
import { seg, ease, key, hash } from '../core.js';

const C = { terra: '#ad5f3d', deep: '#7f3a1e', light: '#d3935f', ink: '#150e0b', ink2: '#241610', white: '#f1e5cc', bone: '#dcc498', wine: '#7a1c26', red: '#a02a28', sea: '#4a8ea6', sea2: '#24566f', olive: '#5a6230', gold: '#d9a03a' };
const INK = [C.ink2, C.ink];
const ST = { under: C.terra };
const TONE = { halo: -1, noKnock: true };
// the slip pass: every mark as solid black, nothing incised
const slip = A => { const p = A.part.bind(A), s = A.stroke.bind(A), d = A.dots.bind(A); A.part = (path, o = {}) => p(path, { ...o, fill: o.fill === null ? null : o.keep ? o.fill : C.ink, under: null, lines: [], edge: null, gold: 0, raise: 0 }); A.stroke = (pl, o = {}) => o.inc ? A : s(pl, { ...o, color: o.keep ? o.color : C.ink, gold: 0, raise: 0 }); A.dots = (l, o = {}) => o.inc ? A : d(l, { ...o, color: o.keep ? o.color : C.ink }); return A; };

// ------------------------------------------------------------------ the labyrinth (seven circuits, entrance at the bottom)
const M = [960, 474], RO = 300, PITCH = 31, RK = k => 300 - 18 - (k - 1) * PITCH, CH = 76; // circuit k = 1 (outer) … 7
const mazePath = (() => {
  const d1 = 16, d2 = 47, pts = []; const A = Math.PI / 2; // axis points down
  const ang = (r, d, side) => A - side * Math.asin(Math.min(0.96, d / r)); // side +1 = right of axis, −1 = left
  const P2 = (r, a) => [M[0] + Math.cos(a) * r, M[1] + Math.sin(a) * r];
  // order of circuits and the perpendicular offset at which each end meets the axis. Entry on the left.
  const seq = [[3, -1, d1, 1, d2], [2, 1, d2, -1, d2], [1, -1, d2, 1, d1], [4, 1, d1, -1, d1], [7, -1, d1, 1, d2], [6, 1, d2, -1, d2], [5, -1, d2, 1, d1]];
  pts.push([M[0] - d1, M[1] + RO + 14]);
  for (const [k, s0, o0, s1, o1] of seq) { const r = RK(k); let a0 = ang(r, o0, s0), a1 = ang(r, o1, s1); // sweep the long way round, away from the axis
    if (s0 < 0) { a0 = a0; a1 = a1 + TAU; } else { a0 = a0 + TAU; }
    const n = Math.ceil(Math.abs(a1 - a0) * r / 7); for (let i = 0; i <= n; i++) pts.push(P2(r, lerp(a0, a1, i / n))); }
  pts.push([M[0] + d1, M[1] + CH - 14], [M[0] + 8, M[1] + 30]);
  // round the corners
  let q = resample(Object.assign(pts, { open: true }), 5); for (let it = 0; it < 4; it++) { const w = q.map((p, i) => i === 0 || i === q.length - 1 ? p : [(q[i - 1][0] + p[0] * 2 + q[i + 1][0]) / 4, (q[i - 1][1] + p[1] * 2 + q[i + 1][1]) / 4]); q = w; } q.open = true; return q;
})();

// ------------------------------------------------------------------ ornament
function palmette(A, x, y, s, r = 0, o = {}) { const K = o.col || INK, W = o.col2 || C.wine, U = o.col ? C.ink : C.terra, KK = o.col || C.ink; o = { order: o.order ?? 0.5 }; A.at({ x, y, s, r }, () => { const n = 9; for (let i = 0; i < n; i++) { const k = i - (n - 1) / 2, a = -Math.PI / 2 + k * 0.335, l = 74 - Math.abs(k) * 5.5; A.part(petal(0, -14, l, 17, a, 0.78), { fill: i % 2 ? W : K, under: U, halo: 2, ...o, lines: [{ strokes: [line([Math.cos(a) * 14, -14 + Math.sin(a) * 14], [Math.cos(a) * l * 0.7, -14 + Math.sin(a) * l * 0.7])], w: 2.6 }] }); } A.part(arcBand(0, -12, 0, 18, Math.PI, TAU), { fill: C.white, halo: 2, ...o }); for (const k of [-1, 1]) A.stroke(spiral(k * 34, 8, 25, 4, k > 0 ? Math.PI : 0, k * 1.6, 40), { w: 8, color: KK, halo: 2, taper1: 0.2, ...o }); A.stroke(curve([[-60, 8], [-30, 34], [0, 12], [30, 34], [60, 8]]), { w: 7, color: KK, halo: 2, ...o }); }); }
function lotus(A, x, y, s, r = 0, o = {}) { const K = o.col || INK, W = o.col2 || C.wine, U = o.col ? C.ink : C.terra; o = { order: o.order ?? 0.5 }; A.at({ x, y, s, r }, () => { for (const [a, l, w, f] of [[-0.62, 66, 20, K], [0.62, 66, 20, K], [-0.3, 60, 17, W], [0.3, 60, 17, W], [0, 68, 19, K]]) A.part(petal(0, 0, l, w, -Math.PI / 2 + a, 0.6), { fill: f, under: U, halo: 2, ...o, lines: [{ strokes: [line([Math.sin(a) * 12, -Math.cos(a) * 12], [Math.sin(a) * l * 0.7, -Math.cos(a) * l * 0.7])], w: 2.4 }] }); A.part(arcBand(0, 4, 0, 16, Math.PI, TAU), { fill: C.white, halo: 2, ...o }); }); }
const rosette = (A, x, y, r, o = {}) => { for (const q of P.petals(x, y, 8, r * 0.18, r * 0.82, r * 0.5)) A.part([q], { fill: C.ink, halo: 1.4, ...o }); A.part(circ(x, y, r * 0.3, 18), { fill: C.wine, halo: 1.4, ...o }); };
const ivyLeaf = (x, y, s, a) => T([spl([[4, 0, 1], [-5, -11], [4, -19], [18, -15], [50, 0, 1], [18, 15], [4, 19], [-5, 11]], true, 7)], { x, y, s: s / 40, r: a });
function olive(A, x, y, s, o = {}) { A.at({ x, y, s }, () => { A.part(limb([[0, 4], [-10, -60], [8, -110], [-4, -170]], [40, 28, 24, 16]), { fill: INK, halo: 3, ...o, lines: [{ flow: { gap: 9, w: 2.8, margin: 4, minLen: 20, field: [{ guide: curve([[0, 4], [-10, -60], [8, -110], [-4, -170]]), w: 1, fall: 200 }] } }] }); const br = [[[-2, -120], [-50, -150], [-92, -190]], [[2, -130], [50, -156], [92, -184]], [[-4, -160], [-24, -210], [-50, -252]], [[0, -165], [26, -216], [58, -246]], [[-4, -166], [0, -220], [4, -272]], [[-30, -140], [-80, -140], [-112, -150]], [[30, -144], [80, -140], [116, -144]]]; for (const b of br) { const c = curve(b); A.stroke(c, { w: 9, color: C.ink, taper1: 0.5, halo: 2, ...o }); for (let i = 0; i < 9; i++) { const [px, py, a] = at(c, 0.2 + i * 0.1); for (const k of [-1, 1]) A.part(petal(px, py, 36, 13, a + k * 0.75, 0.5), { fill: i % 3 ? INK : C.olive, halo: 1.8, ...o, lines: [{ strokes: [line([px, py], [px + Math.cos(a + k * 0.75) * 26, py + Math.sin(a + k * 0.75) * 26])], w: 2 }] }); if (i % 3 === 1) A.part(ell(px + 4, py + 14, 6, 8), { fill: C.wine, halo: 1.6, ...o }); } } }); }
function owl(A, x, y, s, o = {}) { A.at({ x, y, s }, () => { for (const k of [-1, 1]) for (const d of [-6, 0, 6]) A.stroke(line([k * 14, -8], [k * 14 + d, 4]), { w: 4.5, color: C.ink, halo: 1 }); A.part(blob([[-34, -110], [-46, -70], [-40, -30], [-16, -6], [16, -6], [40, -30], [46, -70], [34, -110], [0, -124]], 9), { fill: INK, halo: 3, ...o, lines: [{ dots: Array.from({ length: 24 }, (_, i) => { const r = Math.floor(i / 6); return [-20 + (i % 6) * 8 + (r % 2) * 4, -74 + r * 13, 2.6]; }), ink: C.white }, { flow: { gap: 8, w: 2.4, margin: 3, minLen: 16, field: [{ dir: 1.5 }] }, path: blob([[28, -84], [44, -64], [38, -30], [22, -14], [24, -50]]) }] }); A.part(blob([[-30, -120], [-40, -152], [-18, -166], [18, -166], [40, -152], [30, -120], [0, -108]], 8), { fill: INK, halo: 2.5, ...o }); for (const k of [-1, 1]) { A.part(circ(k * 16, -142, 15, 28), { fill: C.white, halo: 1.6 }); A.part(circ(k * 16, -142, 10, 24), { fill: C.wine, halo: 0 }); A.part(circ(k * 16, -142, 6, 18), { fill: C.ink, halo: 0 }); } A.part(poly([[-6, -134], [6, -134], [0, -118]]), { fill: C.white, halo: 1.6 }); }); }
function amphora(A, x, y, s, o = {}) { A.at({ x, y, s }, () => { for (const k of [-1, 1]) A.part(limb([[k * 16, -150], [k * 40, -152], [k * 44, -120], [k * 32, -104]], [9, 9, 9, 10]), { fill: INK, halo: 2, ...o }); A.part(blob([[-20, -164, 1], [20, -164, 1], [18, -152], [14, -132], [24, -118], [44, -92], [44, -62], [28, -26], [16, -10], [26, 0, 1], [-26, 0, 1], [-16, -10], [-28, -26], [-44, -62], [-44, -92], [-24, -118], [-14, -132], [-18, -152]], 7), { fill: INK, under: C.light, halo: 3, ...o, lines: [{ strokes: [line([-50, -104], [50, -104]), line([-50, -50], [50, -50]), line([-40, -34], [40, -34])], w: 3 }, { shape: Array.from({ length: 9 }, (_, i) => [[-32 + i * 8 - 4, -8], [-32 + i * 8, -30], [-32 + i * 8 + 4, -8]]) }, { strokes: P.greekKey(-40, -124 + 6, 80, 10, 6), w: 2 }, { strokes: [arc(0, -77, 16, 0, TAU, 24), spiral(0, -77, 12, 2, 0, 1.6, 24), line([-36, -77], [-20, -77]), line([20, -77], [36, -77])], w: 3 }] }); A.part(rect(-22, -168, 44, 8), { fill: C.wine, halo: 1.6, ...o }); }); }
function column(A, x, y0, y1, w, o = {}) { A.part(poly([[x - w * 0.4, y0], [x + w * 0.4, y0], [x + w / 2, y1], [x - w / 2, y1]]), { fill: [C.white, C.bone], under: C.ink, halo: 3, ...o, lines: [{ strokes: w < 26 ? [line([x - w * 0.1, y0 + 4], [x - w * 0.12, y1 - 3]), line([x + w * 0.16, y0 + 4], [x + w * 0.2, y1 - 3])] : Array.from({ length: 5 }, (_, i) => line([x - w * 0.3 + i * w * 0.15, y0 + 4], [x - w * 0.38 + i * w * 0.19, y1 - 4])), w: w < 26 ? 2.4 : 2.8 }] }); A.part(blob([[x - w * 0.42, y0 + 2, 1], [x + w * 0.42, y0 + 2, 1], [x + w * 0.7, y0 - 14, 1], [x - w * 0.7, y0 - 14, 1]], 5), { fill: C.wine, halo: 2, ...o }); A.part(rect(x - w * 0.76, y0 - 26, w * 1.52, 12), { fill: INK, halo: 2, ...o }); A.part(rect(x - w * 0.66, y1, w * 1.32, 9), { fill: INK, halo: 2, ...o }); }

// ------------------------------------------------------------------ people
const WSK = ['#e9d9b8', '#f1e5cc'], BSK = [C.ink2, C.ink];
const woman = (o = {}) => ({ skin: WSK, st: ST, hair: { kind: 'bun', fill: INK, gap: 10, w: 2.8 }, torso: { fill: [C.wine, '#5c141c'], lines: [], pat: (x, b) => { for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) { const X = b.x + i * 15 + (j % 2) * 7.5, Y = b.y + 8 + j * 15; x.beginPath(); for (let k = 0; k < 4; k++) { const a = k * TAU / 4; x.moveTo(X + Math.cos(a) * 3.4 + 2, Y + Math.sin(a) * 3.4); x.arc(X + Math.cos(a) * 3.4, Y + Math.sin(a) * 3.4, 2, 0, 7); } x.fill(); } }, patInk: C.white }, lower: { len: 188, flare: 48, w: 30, folds: 4, scallop: 3, fill: INK, gap: 18, lw: 3.2, bands: [{ at: 0.2, w: 18, color: C.wine, motif: 'dots', ink: C.white }, { at: 0.52, w: 24, color: C.white, motif: 'key', ink: C.ink }, { at: 0.72, w: 16, color: C.wine, motif: 'zig', ink: C.white }, { at: 0.95, w: 18, color: C.white, motif: 'dia', ink: C.wine }] }, belt: { color: C.white, w: 12, ink: C.wine }, sleeve: { fill: [C.wine, '#5c141c'], to: 'el', w: [40, 34], lines: [], trim: { color: C.white, w: 6 } }, collar: { color: [C.white, C.wine], rows: 2, w: 8 }, bangle: { color: C.wine }, hat: A => { A.stroke(curve([[-50, -16], [-18, -36], [16, -38], [36, -24]]), { w: 9, color: C.wine, halo: 1.6 }); A.dots(Array.from({ length: 7 }, (_, i) => { const [x, y] = at(curve([[-50, -16], [-18, -36], [16, -38], [36, -24]]), 0.08 + i * 0.14); return [x, y, 2.4]; }), { color: C.white, halo: 0 }); }, face: { lips: C.wine, pupil: C.ink, brow: C.ink }, ...o });
const man = (o = {}) => ({ skin: BSK, st: ST, hair: { kind: 'cap', fill: INK, gap: 10, w: 2.6 }, torso: undefined, face: { eye: C.white, pupil: C.ink, brow: null }, hat: A => A.stroke(curve([[-50, -16], [-18, -34], [16, -36], [36, -24]]), { w: 8, color: C.wine, halo: 1.6 }), ...o });
const himation = (f, b) => ({ len: 120, flare: 46, w: 30, folds: 3, scallop: 4, fill: f, gap: 14, bands: [{ at: 0.92, w: 14, color: b, motif: 'dots', ink: C.white }] });

export default {
  id: 'aegean', mat: 13, dur: 5,
  word: { native: 'μίτος', font: '"Times New Roman"', roman: 'mítos', gloss: 'warp thread' },
  caption: { place: 'The Aegean, Greece', tech: 'warp-weighted loom' },
  from: 'left', to: 'right',
  sfx: [{ t: 0.5, s: 'thump' }, { t: 0.625, s: 'whoosh' }, { t: 1.25, s: 'bell' }, { t: 2.5, s: 'twang' }, { t: 2.6, s: 'wave' }, { t: 3.125, s: 'splash' }, { t: 3.75, s: 'splash' }, { t: 4.0, s: 'hoof' }],
  env: t => ({ cloth: '#c9a878', stain: 0.6, wear: 0.06, exposure: 1.04, scorch: 0.4, vig: 0.68, sat: 0.98 }),
  bake(B) {
    const two = (name, fn) => { B.layer(name + 'S', A => fn(slip(A))); B.layer(name, fn); };
    // ---------------------------------------------- tone-on-tone ground
    B.layer('tone', A => A.with(TONE, () => {
      A.part(rect(70, 78, 1780, 164), { fill: ['#c27c4c', '#c98653'], halo: 0, order: ['lin', 70, 0, 1850, 0, 0, 0.95] }); 
      const R = rng(5); for (let i = 0; i < 110; i++) { const x = 90 + R() * 1750, y = 92 + R() * 140; if (Math.abs(x - 960) < 300) continue; if (R() > 0.4) { for (const q of P.petals(x, y, 8, 3, 11, 6.5)) A.part([q], { fill: C.deep, alpha: 0.7 }); } else A.dots(P.ringDots(x, y, 8, 7, 2.4).concat([[x, y, 3]]), { color: C.deep, alpha: 0.7 }); }
      for (let i = 0; i < 300; i++) { const x = 90 + R() * 1740, y = 320 + R() * 520, k = R(); if (Math.hypot(x - M[0], y - M[1]) < 400) continue; if (k < 0.4) { for (const q of P.petals(x, y, 8, 3, 13, 7)) A.part([q], { fill: C.deep, alpha: 0.8 }); } else if (k < 0.7) A.dots(P.ringDots(x, y, 10, 8, 2.6).concat([[x, y, 3.4]]), { color: C.deep, alpha: 0.85 }); else A.strokes([line([x - 9, y - 9], [x + 9, y + 9]), line([x + 9, y - 9], [x - 9, y + 9]), line([x - 11, y], [x + 11, y])], { w: 3.4, color: C.deep, alpha: 0.8 }); }
      // brush streaks of the fired slip
      for (let i = 0; i < 60; i++) { const x = R() * 1800 + 60, y = 90 + R() * 900; A.stroke(wavy(x, y, x + 90 + R() * 160, y, 3, 1, R() * 6, 20), { w: 3, color: C.light, alpha: 0.35 }); }
    }));

    // ---------------------------------------------- left: house, loom, riders' ground lines, spandrels
    two('left', A => {
      const ord = ['rad', 160, 540, 0, 760, 0, 0.95]; A.with({ order: ord }, () => {
        // register lines
        A.part(rect(78, 240, 620, 8), { fill: INK, halo: 2 });
        A.part(rect(78, 248, 620, 58), { fill: INK, halo: 0 }); for (let i = 0; i < 9; i++) { const x = 116 + i * 60; A.at({ x, y: 294, s: 0.5 }, () => { if (i % 2) lotus(A, 0, 4, 1, 0, { order: ord, col: C.light, col2: C.white }); else palmette(A, 0, 0, 0.92, 0, { order: ord, col: C.light, col2: C.red }); }); } A.part(rect(78, 304, 540, 6), { fill: INK, halo: 2 });
        // columns and entablature
        A.part(rect(78, 312, 520, 30), { fill: INK, under: C.terra, halo: 2, lines: [{ strokes: P.scrollWave(84, 316, 510, 22, 18), w: 3.6 }] });
        // loom
        for (const x of [232, 428]) A.part(poly([[x - 9, 350], [x + 9, 350], [x + 14, 834], [x - 14, 834]]), { fill: INK, halo: 3, lines: [{ strokes: [line([x - 3, 360], [x - 4, 828]), line([x + 4, 360], [x + 5, 828])], w: 2.4 }] });
        A.part(rrect(208, 344, 244, 28, 12), { fill: [C.wine, '#54121a'], under: C.terra, halo: 3, raise: 0.5, lines: [{ strokes: Array.from({ length: 16 }, (_, i) => line([214 + i * 15, 340], [226 + i * 15, 376])), w: 3 }] }); for (const x of [206, 454]) A.part(circ(x, 358, 15), { fill: INK, halo: 3, lines: [{ strokes: [arc(x, 358, 8, 0, TAU, 20)], w: 2.6 }] });
        // woven cloth
        A.part(rect(246, 374, 168, 160), { fill: C.white, halo: 2, raise: 0.25 });
        A.part(rect(246, 378, 168, 26), { fill: C.ink, halo: 0, under: C.white, lines: [{ strokes: P.greekKey(248, 382, 166, 18, 8), w: 3.2 }] }); A.part(rect(246, 410, 168, 12), { fill: C.wine, halo: 0, lines: [{ dots: P.dotRow(246, 416, 168, 2.8, 14), ink: C.white }] });
        for (let i = 0; i < 4; i++) A.at({ x: 268 + i * 42, y: 462, s: 0.2 }, () => { for (const [lx, k] of [[-60, -1], [-40, 1], [60, 1], [84, -0.6]]) A.part(limb([[lx, -90], [lx + k * 14, -40], [lx + k * 26, 0]], [30, 18, 14]), { fill: C.ink, halo: 0 }); A.part(blob([[-90, -100], [-70, -150], [40, -140], [90, -210], [130, -220], [160, -180], [140, -170], [116, -150], [90, -90], [-60, -80]], 6), { fill: C.ink, halo: 0 }); A.stroke(curve([[-88, -120], [-120, -90], [-116, -40]]), { w: 16, color: C.ink, halo: 0 }); });
        A.part(rect(246, 470, 168, 10), { fill: C.wine, halo: 0 }); A.part(P.diamonds(246, 484, 168, 22, 9), { fill: C.ink, halo: 0 }); A.part(P.diamonds(246, 490, 168, 10, 9), { fill: C.wine, halo: 0 }); A.part(rect(246, 510, 168, 10), { fill: C.ink, halo: 0, lines: [{ dots: P.dotRow(246, 515, 168, 2.4, 18), ink: C.white }] });
        // warp
        A.part(rect(246, 534, 168, 252), { fill: C.deep, halo: 0, keep: 1 }); for (let i = 0; i < 15; i++) { const x = 251 + i * 11.3; A.stroke(line([x, 532], [x, 788]), { w: 5, color: C.white, keep: 1, halo: 0 }); }
        // wool basket, altar stone for the owl
        A.part(poly([[612, 838], [674, 838], [690, 764], [596, 764]]), { fill: INK, under: C.light, halo: 3, lines: [{ strokes: Array.from({ length: 5 }, (_, i) => curve([[590, 778 + i * 13], [643, 784 + i * 13], [696, 778 + i * 13]])), w: 2.8 }, { strokes: Array.from({ length: 8 }, (_, i) => line([600 + i * 12, 764], [614 + i * 8, 838])), w: 2.2 }] }); for (const [x, y, r, c] of [[616, 752, 20, C.white], [650, 748, 22, C.wine], [676, 754, 16, C.white]]) A.part(circ(x, y, r), { fill: c, under: C.ink, halo: 2.4, lines: [{ strokes: [spiral(x, y, r * 0.8, 2, 0, 2.2, 30)], w: 2.6 }] });
        // spools and a loom-weight heap by the ring
        for (const [x, y] of [[716, 828], [742, 830]]) { A.part(poly([[x - 11, y + 10], [x + 11, y + 10], [x + 6, y - 22], [x - 6, y - 22]]), { fill: INK, under: C.light, halo: 2, lines: [{ dots: [[x, y - 14, 3]] }] }); }
        // wall: a hung wreath and an oinochoe
        A.stroke(arc(104, 420, 22, -1.2, 4.3, 30), { w: 5, color: C.ink, halo: 1 }); for (let i = 0; i < 14; i++) { const a = -1.2 + i * 0.42; A.part(petal(104 + Math.cos(a) * 22, 420 + Math.sin(a) * 22, 19, 9, a + 0.9, 0.5), { fill: i % 2 ? INK : C.olive, halo: 1.4 }); }
        palmette(A, 640, 190, 0.9, -0.62, { order: ord }); lotus(A, 698, 122, 0.5, -0.9, { order: ord }); lotus(A, 590, 256, 0.4, -0.4, { order: ord });
        for (const [x, y] of [[588, 420], [590, 560], [170, 360], [500, 372]]) rosette(A, x, y, 16, { order: ord });
      });
    });
    B.sprite('weights', { w: 220, h: 100, ox: 110, oy: 14, n: 8 }, (A, ph) => { for (let i = 0; i < 9; i++) { const x = -84 + i * 21, sw = Math.sin(ph * TAU + i * 0.7) * 7; A.stroke(line([x, -10], [x + sw, 22]), { w: 4, color: C.white, halo: 1 }); A.part(poly([[x + sw - 5, 18], [x + sw + 5, 18], [x + sw + 11, 62], [x + sw - 11, 62]]), { fill: i % 2 ? INK : [C.wine, '#4c1018'], under: C.light, halo: 2.2, lines: [{ dots: [[x + sw, 26, 3]] }, { strokes: [line([x + sw - 14, 50], [x + sw + 14, 50])], w: 2.6 }] }); } });
    B.sprite('heddle', { w: 260, h: 40, n: 1 }, A => { A.part(rrect(-116, -7, 232, 14, 6), { fill: INK, halo: 2, lines: [{ strokes: Array.from({ length: 27 }, (_, i) => line([-81 + i * 6.2, -8], [-81 + i * 6.2, 8])), w: 2, ink: C.white }] }); for (const k of [-1, 1]) A.part(circ(k * 118, 0, 9), { fill: C.wine, halo: 2 }); });

    // ---------------------------------------------- right: temple, olive, sea
    two('right', A => {
      const ord = ['rad', 1340, 520, 0, 720, 0, 0.95]; A.with({ order: ord }, () => {
        A.part(rect(1222, 240, 620, 8), { fill: INK, halo: 2 });
        // temple
        const tx = 1718; A.part(poly([[tx - 122, 140], [tx, 88], [tx + 122, 140]]), { fill: INK, under: C.white, halo: 3, lines: [{ strokes: [line([tx - 92, 134], [tx, 98]), line([tx, 98], [tx + 92, 134]), line([tx - 92, 134], [tx + 92, 134])], w: 3.4 }, { strokes: [spiral(tx, 122, 11, 2, 0, 1.6, 24)], w: 3 }] }); A.part(rect(tx - 120, 142, 240, 18), { fill: [C.white, C.bone], under: C.ink, halo: 2, lines: [{ strokes: Array.from({ length: 13 }, (_, i) => line([tx - 108 + i * 18, 144], [tx - 108 + i * 18, 158])), w: 5, ink: C.wine }] }); A.part(rect(tx - 112, 178, 224, 50), { fill: INK, halo: 0 }); for (let i = 0; i < 6; i++) column(A, tx - 98 + i * 39, 184, 226, 21, { order: ord }); A.part(rect(tx - 126, 228, 252, 12), { fill: INK, halo: 2 }); 
        for (const k of [-1, 1]) A.part(petal(tx + k * 122, 140, 20, 12, -Math.PI / 2), { fill: C.wine, halo: 1.6 }); A.part(petal(tx, 90, 20, 14, -Math.PI / 2), { fill: C.wine, halo: 1.6 });
        A.part(rect(1222, 248, 620, 58), { fill: INK, halo: 0 }); for (let i = 0; i < 9; i++) { const x = 1324 + i * 60; A.at({ x, y: 294, s: 0.5 }, () => { if (i % 2) lotus(A, 0, 4, 1, 0, { order: ord, col: C.light, col2: C.white }); else palmette(A, 0, 0, 0.92, 0, { order: ord, col: C.light, col2: C.red }); }); } A.part(rect(1302, 304, 540, 6), { fill: INK, halo: 2 });
        palmette(A, 1280, 190, 0.9, 0.62, { order: ord }); lotus(A, 1222, 122, 0.5, 0.9, { order: ord }); lotus(A, 1330, 256, 0.4, 0.4, { order: ord });
        // flying gulls & filler
        for (const [x, y, r] of [[1374, 360, 15], [1806, 366, 20], [1822, 452, 16], [1352, 430, 16], [1788, 520, 14], [1400, 452, 12], [1826, 590, 14], [1770, 340, 11], [1420, 345, 11], [1836, 520, 10]]) rosette(A, x, y, r, { order: ord });
        for (const [x, y] of [[1770, 400], [1840, 410], [1398, 400], [1385, 500], [1770, 470], [1840, 640], [1750, 560], [1416, 520]]) A.dots([...P.ringDots(x, y, 10, 7, 2.6), [x, y, 3.4]], { color: C.ink, halo: 0, order: ord });
        // sea body
        const top = []; for (let i = 0; i <= 120; i++) top.push([1060 + i * 6.6, 716 + Math.sin(i * 0.5) * 5]); A.part([[...top, [1852, 852], [1060, 852]]], { fill: [C.sea, C.sea2], under: C.white, halo: 3, lines: [{ strokes: [762, 792, 822].map((y, j) => wavy(1050, y, 1860, y, 5, 34, j * 2, 360)), w: 4, ink: C.white, alpha: 0.85 }] });
      });
    });
    B.sprite('waves', { w: 800, h: 150, ox: 0, oy: 90, n: 8 }, (A, ph) => { const u = 64; for (let i = -1; i < 13; i++) { const x = (i + ph) * u; A.part([spl([[x - 26, 48, 1], [x - 8, 14], [x + 16, -26], [x + 46, -38], [x + 62, -20], [x + 52, -4], [x + 38, -8], [x + 40, -18], [x + 30, -20], [x + 22, -2], [x + 30, 22], [x + 60, 40], [x + 80, 48, 1]], true, 8)], { fill: ['#7fb4c2', C.sea, C.sea2], under: C.white, halo: 3, lines: [{ strokes: [curve([[x - 4, 40], [x + 6, 14], [x + 22, -18], [x + 44, -30]]), curve([[x + 10, 44], [x + 14, 20], [x + 18, 6]])], w: 3.6 }] }); A.dots([[x + 68, -30, 4.4], [x + 76, -18, 3.4], [x + 58, -42, 3]], { color: C.white, halo: 1.4 }); } });
    B.sprite('waves2', { w: 800, h: 130, ox: 0, oy: 60, n: 8 }, (A, ph) => { const u = 64; for (let i = -1; i < 13; i++) { const x = (i + 0.5 - ph) * u; A.part([spl([[x + 66, 60, 1], [x + 50, 22], [x + 24, -20], [x - 6, -26], [x - 16, -10], [x - 6, 2], [x + 6, -2], [x + 4, -10], [x + 14, -4], [x + 14, 24], [x - 6, 50], [x - 26, 60, 1]], true, 8)], { fill: INK, under: C.light, halo: 3, lines: [{ strokes: [curve([[x + 44, 52], [x + 36, 20], [x + 18, -10], [x, -16]]), curve([[x + 22, 54], [x + 26, 30], [x + 22, 12]])], w: 3.4 }] }); A.dots([[x - 20, -20, 4], [x - 28, -8, 3]], { color: C.white, halo: 1.4 }); } });

    // ---------------------------------------------- medallion
    B.layer('disc', A => { A.part(circ(M[0], M[1], 396, 160), { fill: C.terra, halo: 6, order: ['rad', M[0], M[1] + 300, 0, 720, 0, 1] }); A.part(circ(M[0], M[1], RO + 2, 160), { fill: { rad: [M[0], M[1], 0, RO], stops: ['#241610', C.ink] }, halo: 3, gold: 0.08, order: ['rad', M[0], M[1] + 300, 0, 640, 0, 0.9] }); });
    two('rings', A => {
      const ord = ['rad', M[0], M[1] + 340, 0, 760, 0, 0.95]; A.with({ order: ord }, () => {
        A.part(ring(M[0], M[1], 388, 396, 160), { fill: INK, halo: 2 }); A.part(ring(M[0], M[1], 340, 386, 160), { fill: INK, under: C.terra, halo: 2, gold: 0.06 });
        // ivy on the black ring
        const n = 30, stem = []; for (let i = 0; i <= 360; i++) { const a = i / 360 * TAU, r = 363 + Math.sin(i / 360 * TAU * n / 2) * 8; stem.push([M[0] + Math.cos(a) * r, M[1] + Math.sin(a) * r]); } A.stroke(stem, { w: 3.4, color: C.light, halo: 0, inc: 1 });
        for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * TAU, sd = i % 2 ? 1 : -1, r = 363 + sd * 2, x = M[0] + Math.cos(a) * r, y = M[1] + Math.sin(a) * r; const la = a + Math.PI / 2 + (sd > 0 ? -0.34 : 0.34); A.part(ivyLeaf(x - Math.cos(la) * 24, y - Math.sin(la) * 24, 40, la), { fill: i % 4 < 2 ? C.light : C.white, halo: 2, lines: [{ strokes: [line([x - Math.cos(la) * 16, y - Math.sin(la) * 16], [x + Math.cos(la) * 18, y + Math.sin(la) * 18])], w: 3.4, ink: C.ink }] }); const b = (i + 0.95) / n * TAU, bx = M[0] + Math.cos(b) * (363 - sd * 13), by = M[1] + Math.sin(b) * (363 - sd * 13); A.dots([[bx, by, 3.6], [bx + 6, by + 4, 3], [bx - 5, by + 5, 3]], { color: i % 2 ? C.red : C.white, halo: 0, inc: 1 }); }
        // running wave on the pale ring
        const m = 46; for (let i = 0; i < m; i++) { const a = i / m * TAU; A.at({ x: M[0], y: M[1], r: a }, () => A.part([spl([[303, -24, 1], [314, -10], [328, 0], [337, 12], [334, 22], [326, 22], [324, 14], [329, 12], [324, 6], [316, 12], [303, 22, 1]], true, 6)], { fill: INK, halo: 1.4 })); }
        A.part(ring(M[0], M[1], 337, 341, 160), { fill: C.wine, halo: 1 });
      });
    });
    // corridor, cut along the thread's way in
    B.layer('maze', A => { const N = 60; for (let i = 0; i < N; i++) { const q = sub(mazePath, Math.max(0, i / N - 0.0015), Math.min(1, (i + 1) / N + 0.0015)); A.stroke(q, { w: 21, color: C.terra, halo: 0, cap: 'butt', order: { along: [i / N, (i + 1) / N] } }); } });
    B.layer('heart', A => { A.part(circ(M[0], M[1], CH, 80), { fill: C.light, halo: 2, order: ['rad', M[0], M[1], 0, CH, 0, 0.8] }); A.part(ring(M[0], M[1], CH - 9, CH - 4, 80), { fill: INK, halo: 0 });
      A.at({ x: M[0], y: M[1] + 6, s: 0.86 }, () => A.with({ under: C.light }, () => { for (const k of [-1, 1]) { A.part(limb([[k * 24, -34], [k * 56, -44], [k * 62, -70], [k * 44, -84]], [20, 16, 11, 3]), { fill: [C.white, C.bone], halo: 2, lines: [{ strokes: [curve([[k * 30, -38], [k * 52, -48], [k * 56, -66]])], w: 2.4, ink: C.ink }] }); A.part(petal(k * 30, -22, 44, 22, k > 0 ? 0.2 : Math.PI - 0.2, 0.5), { fill: INK, halo: 2, lines: [{ strokes: [line([k * 36, -20], [k * 62, -14])], w: 2.6 }] }); } A.part(blob([[-34, -44], [0, -52], [34, -44], [36, -14], [24, 18], [20, 46], [10, 60], [-10, 60], [-20, 46], [-24, 18], [-36, -14]], 9), { fill: INK, halo: 2.4, lines: [{ strokes: [curve([[-12, -40], [-8, 0], [-14, 34]]), curve([[12, -40], [8, 0], [14, 34]]), spiral(0, -34, 10, 1.5, 0, 1.6, 22), curve([[-18, 46], [0, 40], [18, 46]])], w: 2.8 }] }); for (const k of [-1, 1]) { A.part(ell(k * 20, -12, 9, 7), { fill: C.white, halo: 1.6 }); A.part(circ(k * 20, -12, 4.2), { fill: C.wine, halo: 0 }); A.dots([[k * 8, 50, 3]], { color: C.wine, halo: 1 }); } A.part(star(0, -58, 12, 5, 8), { fill: C.wine, halo: 1.4 }); }));
    });

    // ---------------------------------------------- bottom frieze, top ground
    two('bottom', A => { const ord = ['lin', 70, 0, 1850, 0, 0, 0.95]; A.with({ order: ord }, () => {
      A.part(rect(70, 840, 1780, 10), { fill: INK, halo: 4 }); A.part(rect(70, 853, 1780, 5), { fill: C.wine, halo: 2 });
      A.part(rect(70, 992, 1780, 14), { fill: INK, halo: 2, under: C.terra, lines: [{ dots: P.dotRow(80, 998, 1760, 3, 110) }] });
      for (const x of [140, 420, 700, 980, 1260, 1540, 1780]) amphora(A, x, 990, 0.78, { order: ord });
      for (const [x, k] of [[280, 1], [560, -1], [840, 1], [1120, -1], [1400, 1], [1660, -1]]) { const sp = curve([[x - 70, 884], [x - 20, 872], [x + 30, 884], [x + 80, 874]]); A.stroke(sp, { w: 4, color: C.ink, halo: 1 }); for (let i = 0; i < 8; i++) { const [px, py, a] = at(sp, 0.06 + i * 0.12); A.part(petal(px, py, 22, 9, a + (i % 2 ? 0.8 : -0.8), 0.5), { fill: i % 3 ? INK : C.olive, halo: 1.2 }); } }
    }); });
    B.layer('frieze', A => { A.part(rect(70, 846, 1780, 152), { fill: ['#cf8f5e', '#c27c4c'], halo: 0, order: ['lin', 70, 0, 1850, 0, 0, 0.95] }); A.with(TONE, () => { const R = rng(9); for (let i = 0; i < 70; i++) { const x = 96 + i * 25 + R() * 8, y = 880 + R() * 90; if (R() > 0.5) { for (const q of P.petals(x, y, 8, 3, 12, 7)) A.part([q], { fill: C.deep, alpha: 0.75, order: 0.5 }); } else A.dots(P.ringDots(x, y, 8, 7, 2.4).concat([[x, y, 3]]), { color: C.deep, alpha: 0.75, order: 0.5 }); } }); });

    // ---------------------------------------------- sprites: weavers
    const peplos = (ph, f) => { const s = Math.sin(ph * TAU); return woman({ pose: { legN: [84, 92], legF: [98, 94], lean: 2 + s * 2, armN: [f ? 66 - s * 20 : 60 + s * 16, f ? -34 - s * 20 : -30 + s * 14], armF: [f ? 30 : 40 - s * 14, f ? -50 : -44 - s * 10], head: s * 3 }, hands: { N: 'grip', F: 'flat' } }); };
    B.sprite('weaverL', { w: 320, h: 520, ox: 130, oy: 486, n: 8 }, (A, ph) => A.at({ s: 1.1 }, () => figure(A, { ...peplos(ph, 1), front: (A, J) => A.part(limb([[J.haN[0] - 14, J.haN[1] + 16], [J.haN[0] + 14, J.haN[1] - 10], [J.haN[0] + 74, J.haN[1] - 58]], [8, 11, 16]), { fill: [C.gold, '#8a5a1c'], halo: 2.4, under: C.ink }) })));
    B.sprite('weaverR', { w: 320, h: 520, ox: 130, oy: 486, n: 8 }, (A, ph) => A.at({ s: 1.1 }, () => figure(A, { ...peplos(ph + 0.25, 0), hair: { kind: 'long', fill: INK, gap: 11, w: 2.8 }, torso: { fill: INK, lines: [{ flow: { gap: 12, w: 2.8, margin: 5, field: [{ dir: 1.4 }] } }] }, sleeve: { fill: INK, to: 'el', w: [40, 34], trim: { color: C.wine, w: 6 } }, lower: { len: 188, flare: 48, w: 30, folds: 4, scallop: 3, fill: [C.wine, '#5c141c'], gap: 18, lw: 3, bands: [{ at: 0.16, w: 18, color: C.ink, motif: 'zig', ink: C.white }, { at: 0.46, w: 22, color: C.white, motif: 'tri', ink: C.wine }, { at: 0.68, w: 16, color: C.ink, motif: 'dots', ink: C.white }, { at: 0.94, w: 20, color: C.white, motif: 'key', ink: C.ink }] }, front: (A, J) => { const h = J.haN; A.part(limb([[h[0] - 20, h[1] + 4], [h[0] + 4, h[1]], [h[0] + 40, h[1] - 6]], [6, 18, 6]), { fill: [C.gold, '#8a5a1c'], halo: 2, under: C.ink }); A.part(ell(h[0] + 8, h[1] - 1, 16, 10), { fill: C.red, halo: 1.6, lines: [{ strokes: [line([h[0] - 2, h[1] - 10], [h[0] + 4, h[1] + 8]), line([h[0] + 8, h[1] - 10], [h[0] + 14, h[1] + 8])], w: 2.4 }] }); } })));

    // ---------------------------------------------- horse and rider
    B.sprite('rider', { w: 420, h: 400, ox: 190, oy: 360, n: 8 }, (A, ph) => A.at({ s: 0.96 }, () => A.with(ST, () => {
      const g = k => { const q = (ph + k) * TAU; return [Math.sin(q), Math.max(0, Math.cos(q))]; }; const leg = (x, y, k, back, f) => { const [q, l] = g(k); const kn = [x + q * 34 + (back ? -8 : 16), y + 52 - l * 14], ft = [x + q * 66 + (back ? -20 : 10) + l * (back ? 26 : -26), y + 112 - l * 46]; A.part(limb([[x, y], kn, ft], [42, 20, 12]), { fill: f, halo: 2.4, lines: back ? [{ strokes: [curve([[x - 6, y + 6], [kn[0] - 2, kn[1]], [ft[0], ft[1] - 10]])], w: 2.6 }] : [{ strokes: [curve([[x + 4, y + 4], [kn[0], kn[1]], [ft[0], ft[1] - 10]])], w: 2.6 }] }); A.part(ell(ft[0] + 4, ft[1] + 3, 11, 7), { fill: C.ink, halo: 1.4 }); };
      const bob = Math.sin(ph * TAU) * 6; A.at({ y: bob }, () => {
        leg(-74, -124, 0.52, 1, C.ink); leg(84, -128, 0.95, 0, C.ink);
        A.part(limb([[-104, -168], [-146, -176], [-182, -140], [-196, -86]], [18, 30, 26, 6]), { fill: [C.wine, '#54121a'], halo: 2.6, lines: [{ flow: { gap: 8, w: 2.4, margin: 3, field: [{ guide: curve([[-104, -168], [-146, -176], [-182, -140], [-196, -86]]), w: 1, fall: 200 }] } }] });
        A.part(blob([[-108, -146], [-96, -182], [-50, -194], [10, -182], [64, -190], [96, -214], [114, -264], [134, -298], [152, -306], [178, -288], [206, -252], [212, -232], [198, -222], [172, -234], [156, -230], [148, -192], [128, -148], [96, -118], [20, -124], [-50, -112], [-92, -112], [-112, -126]], 9), { fill: INK, halo: 3, lines: [{ strokes: [spiral(-70, -148, 30, 4, -0.6, 1.3, 40), spiral(100, -152, 26, 4, -2.4, -1.3, 40), curve([[-40, -128], [20, -138], [70, -130]]), curve([[134, -284], [126, -240], [108, -200], [84, -178]]), curve([[172, -262], [184, -244], [178, -234]])], w: 3.4, taper: 0.15 }, { strokes: [curve([[-96, -128], [-70, -116], [-50, -122]])], w: 3 }] });
        A.part(limb([[146, -304], [120, -282], [100, -236], [78, -202]], [8, 28, 26, 10]), { fill: [C.wine, '#54121a'], halo: 2, lines: [{ flow: { gap: 8, w: 2.4, margin: 3, minLen: 8, field: [{ dir: 2.5 }] } }] }); A.part(petal(146, -300, 32, 14, -1.9, 0.5), { fill: C.ink, halo: 1.6 }); A.part(circ(166, -270, 8), { fill: C.white, halo: 1.6 }); A.dots([[167, -270, 4]], { color: C.ink, halo: 0 });
        leg(-84, -120, 0, 1, C.ink2); leg(94, -122, 0.4, 0, C.ink2);
        // rider
        A.at({ x: -14, y: -118, s: 0.62 }, () => figure(A, man({ pose: { lean: 14, legN: [50, 110], legF: [60, 110], armN: [50, 0], armF: [40, -10], ground: false }, hands: { N: 'grip', F: 'grip' }, lower: { len: 60, flare: 48, w: 30, fill: [C.white, C.bone], gap: 14 }, torso: { fill: [C.white, C.bone], lines: [{ flow: { gap: 12, w: 2.8, margin: 5, field: [{ dir: 1.5 }] } }] }, back: (A, J) => A.part(blob([[J.neck[0] - 10, J.neck[1] + 4], [J.neck[0] - 70, J.neck[1] + 10 + bob], [J.neck[0] - 150, J.neck[1] - 10 - bob * 2], [J.neck[0] - 130, J.neck[1] + 40], [J.neck[0] - 60, J.neck[1] + 66], [J.neck[0] - 6, J.neck[1] + 50]], 8), { fill: [C.wine, '#54121a'], halo: 3, lines: [{ flow: { gap: 12, w: 2.8, margin: 4, field: [{ dir: 0.1 }] } }] }) })));
        A.stroke(curve([[198, -236], [140, -226], [60, -214]]), { w: 4, color: C.white, halo: 1.2 });
      });
    })));
    // ---------------------------------------------- runners
    for (const [nm, f] of [['runA', C.white], ['runB', C.wine]]) B.sprite(nm, { w: 260, h: 220, ox: 120, oy: 190, n: 8 }, (A, ph) => A.at({ s: 0.43 }, () => figure(A, man({ ornament: 0, torso: { fill: INK, lines: [] }, pose: (() => { const q = Math.sin(ph * TAU), c = Math.cos(ph * TAU); return { lean: 18, legN: [84 - 48 * q, 96 - 18 * q + 66 * Math.max(0, c)], legF: [84 + 48 * q, 96 + 18 * q + 66 * Math.max(0, -c)], armN: [92 + q * 56, 8 + q * 50], armF: [92 - q * 56, 8 - q * 50], bob: -Math.abs(q) * 12 }; })(), lower: { len: 52, flare: 42, w: 31, fill: f, gap: 14, folds: 2 }, hair: { kind: f === C.white ? 'cap' : 'top', fill: INK, gap: 10 }, beard: f === C.white ? null : { fill: INK, gap: 9 } }))));
    // ---------------------------------------------- ship
    B.sprite('ship', { w: 620, h: 560, ox: 300, oy: 490, n: 8 }, (A, ph) => A.with(ST, () => {
      const s = Math.sin(ph * TAU), hull = [spl([[-244, -156], [-222, -170], [-204, -132], [-176, -84], [-120, -60], [0, -54], [120, -58], [172, -78], [198, -110], [216, -118], [220, -76], [238, -40], [286, -10, 1], [222, 6], [120, 18], [-100, 18], [-184, -4], [-220, -60], [-240, -116]], true, 10)];
      // rigging
      for (const [a, b] of [[[-146, -376], [-190, -84]], [[146, -376], [196, -104]], [[0, -420], [-120, -60]], [[0, -420], [130, -62]]]) A.stroke(line(a, b), { w: 4, color: C.ink, halo: 1.4 });
      A.part(poly([[-6, -440], [6, -440], [9, -50], [-9, -50]]), { fill: INK, halo: 3 });
      // sail
      const bl = 20 + s * 9, sail = [spl([[-150, -376, 1], [0, -384], [150, -376, 1], [158 + bl, -300], [150 + bl * 0.6, -214, 1], [0, -196 + bl], [-146 + bl * 0.3, -214, 1], [-150 + bl * 0.7, -300]], true, 10)]; const st = []; for (let i = -4; i <= 4; i++) st.push(curve([[i * 35, -388], [i * 37 + bl * 0.85, -300], [i * 34 + bl * 0.4, -190]]));
      A.part(sail, { fill: [C.white, C.bone], halo: 4, lines: [{ strokes: st.filter((_, i) => i % 2 === 0), w: 18, ink: C.wine, cap: 'butt' }, { strokes: st.filter((_, i) => i % 2), w: 3.4 }, { strokes: [curve([[-160, -300], [0, -290 + bl], [190, -300]]), curve([[-160, -250], [0, -236 + bl], [190, -250]])], w: 3.4 }] });
      A.part(circ(10 + bl * 0.8, -290 + bl * 0.4, 42), { fill: INK, halo: 3 }); A.part(star(10 + bl * 0.8, -290 + bl * 0.4, 36, 14, 8), { fill: C.white, halo: 0 }); A.part(circ(10 + bl * 0.8, -290 + bl * 0.4, 10), { fill: C.wine, halo: 2 });
      A.part(limb([[-166, -374], [0, -386], [166, -374]], [10, 13, 10]), { fill: INK, halo: 2.4 }); A.part(poly([[0, -440], [-44 - s * 5, -452 + s * 4], [-38, -440], [-46 - s * 6, -428 - s * 3]]), { fill: C.wine, halo: 2 });
      // stern ornament, steersman, oarsmen
      A.stroke(curve([[-232, -150], [-252, -190], [-226, -214], [-202, -196]]), { w: 13, color: C.ink, taper1: 0.5, halo: 2.4 }); A.stroke(curve([[-222, -156], [-232, -184], [-214, -198]]), { w: 8, color: C.wine, taper1: 0.5, halo: 2 });
      A.at({ x: -184, y: -60, s: 0.36 }, () => figure(A, man({ ornament: 0, torso: { fill: INK, lines: [] }, pose: { lean: -4, armN: [40, 30], armF: [50, 40] }, hands: { N: 'grip', F: 'grip' }, lower: himation([C.white, C.bone], C.wine), beard: { fill: INK } }))); 
      for (let i = 0; i < 7; i++) { const x = -124 + i * 42; A.at({ x, y: -22, s: 0.34 }, () => figure(A, man({ ornament: 0, torso: { fill: INK, lines: [] }, pose: { ...POSE.sit, lean: 4 + s * 16, armN: [30 - s * 16, 10 + s * 12], armF: [34 - s * 16, 14 + s * 12] }, hands: 'grip', lower: { len: 20, flare: 34, w: 30, fill: C.white, gap: 14 }, hat: i % 2 ? A => A.stroke(curve([[-50, -16], [-18, -34], [16, -36], [36, -24]]), { w: 9, color: C.white, halo: 1.6 }) : A => A.part(blob([[-50, -12], [-50, -46], [-10, -72], [30, -50], [38, -22], [0, -30]], 7), { fill: C.wine, halo: 2 }) }))); }
      // hull
      A.part(hull, { fill: INK, halo: 4, gold: 0.06, lines: [{ strokes: [curve([[-204, -110], [-170, -56], [-100, -34], [100, -34], [170, -50], [206, -86]]), curve([[-212, -76], [-170, -26], [-100, -8], [100, -8], [190, -24], [250, -14]])], w: 3.4 }, { strokes: [curve([[-208, -92], [-172, -42], [-100, -21], [100, -21], [176, -36], [200, -58]])], w: 9, ink: C.wine }, { dots: Array.from({ length: 22 }, (_, i) => { const [x, y] = at(curve([[-200, -84], [-172, -42], [-100, -21], [100, -21], [160, -30]]), i / 21); return [x, y, 3]; }), ink: C.white }] });
      A.part(circ(206, -56, 17), { fill: C.white, halo: 2 }); A.part(circ(206, -56, 11), { fill: C.wine, halo: 0 }); A.part(circ(206, -56, 6), { fill: C.ink, halo: 0 }); A.stroke(curve([[184, -72], [206, -80], [226, -64]]), { w: 4, color: C.white, taper: 0.3, halo: 0 }); A.stroke(line([236, -20], [278, -10]), { w: 4, color: C.white, halo: 0 });
      // rail
      A.stroke(curve([[-176, -94], [-120, -76], [0, -70], [120, -74], [176, -92]]), { w: 5, color: C.ink, halo: 1.6 }); for (let i = 0; i < 15; i++) { const [x, y] = at(curve([[-176, -94], [-120, -76], [0, -70], [120, -74], [176, -92]]), i / 14); A.stroke(line([x, y], [x, y + 18]), { w: 3.4, color: C.ink, halo: 0.8 }); }
      // oars
      for (let i = 0; i < 7; i++) { const x = -124 + i * 42, e = [x - 26 - s * 34, 60 - Math.max(0, Math.cos(ph * TAU)) * 26]; A.stroke(line([x + 26, -40], e), { w: 5.4, color: C.white, halo: 1.6 }); A.part(petal(e[0] + 10, e[1] - 18, 40, 13, Math.atan2(e[1] + 40, e[0] - x - 26), 0.7), { fill: C.white, halo: 1.6 }); }
      A.part(limb([[-196, -84], [-232, -10], [-252, 40]], [9, 10, 22]), { fill: C.white, halo: 2 });
    }));
    // ---------------------------------------------- dolphins, gull
    B.sprite('dolphin', { w: 230, h: 120, n: 6, ox: 115, oy: 60 }, (A, ph) => A.with(ST, () => { const s = Math.sin(ph * TAU) * 9, body = [spl([[104, 4, 1], [84, -6], [70, -22], [34, -32], [-10, -28], [-54, -8 + s * 0.4], [-80, 2 + s], [-104, -18 + s * 1.5, 1], [-98, 6 + s * 1.3], [-108, 28 + s * 1.4, 1], [-78, 16 + s], [-44, 16 + s * 0.4], [10, 22], [54, 16], [82, 10]], true, 9)]; A.part(blob([[-6, -28], [-20, -54], [-40, -56], [-28, -36], [-30, -20]], 7), { fill: INK, halo: 2, lines: [{ strokes: [line([-12, -30], [-30, -50])], w: 2.6 }] }); A.part(body, { fill: INK, halo: 3, lines: [{ strokes: [curve([[98, 4], [60, 2], [10, 8], [-50, 4 + s * 0.4], [-80, 8 + s]])], w: 3.4 }, { shape: [spl([[90, 6], [50, 6], [0, 12], [-40, 10], [0, 18], [54, 13]], true, 8)], ink: C.white }] }); A.part(blob([[34, 8], [26, 34], [8, 42], [12, 22], [18, 8]], 7), { fill: C.wine, halo: 2, lines: [{ strokes: [line([28, 12], [16, 34])], w: 2.4 }] }); A.part(circ(70, -8, 5.6), { fill: C.white, halo: 1 }); A.dots([[71, -8, 2.8]], { color: C.ink, halo: 0 }); }));
    B.sprite('gull', { w: 170, h: 150, n: 8 }, (A, ph) => A.with(ST, () => { const f = Math.sin(ph * TAU); const w = k => A.part(limb([[0, -4], [-10 + k * 16, -8 - f * 30], [-28 + k * 34, -10 - f * 56]], [24, 26, 4]), { fill: k ? C.ink2 : INK, halo: 2, lines: [{ flow: { gap: 7, w: 2, margin: 3, field: [{ guide: curve([[0, -4], [-10, -8 - f * 30], [-28, -10 - f * 56]]), w: 1, fall: 100 }] } }] }); w(1); A.part(limb([[-54, 8], [-20, 2], [14, 0], [42, -8], [54, -8]], [5, 20, 20, 12, 10]), { fill: INK, halo: 2, lines: [{ strokes: [curve([[-46, 8], [0, 4], [40, -6]])], w: 2.6 }] }); A.part(poly([[54, -12], [74, -6], [54, -4]]), { fill: C.wine, halo: 1 }); A.dots([[50, -10, 2.4]], { color: C.white, halo: 0.6 }); w(0); }));
    B.sprite('owl', { w: 120, h: 200, ox: 60, oy: 190, n: 1 }, A => owl(A, 0, 0, 1, { under: C.terra }));
    B.layer('tree', A => { A.with(ST, () => { olive(A, 1546, 238, 0.54, { order: 0.5, under: C.terra }); }); }, {});

    // ---------------------------------------------- frame
    B.layer('frame', A => {
      A.with({ halo: 0 }, () => P.frame(A, 14, 14, 1892, 1052, 62, (A, len) => { A.with({ order: ['lin', 0, 0, len, 0, 0, 1] }, () => {
        A.part(rect(-62, 0, len + 124, 62), { fill: INK, halo: 0 }); A.part(rect(-62, 7, len + 124, 3), { fill: C.white, halo: 0 });
        const n = Math.round(len / 52); A.strokes(P.greekKey(4, 18, len - 4, 30, n), { w: 6, color: C.light, halo: 0, cap: 'butt', join: 'miter' }); A.part(rect(-62, 55, len + 124, 4), { fill: C.wine, halo: 0 });
      }); }));
      for (const [x, y, r] of [[45, 45, 0.78], [1875, 45, -0.78 + Math.PI * 1.5 + Math.PI / 2], [45, 1035, 0], [1875, 1035, 0]]) { A.part(rect(x - 31, y - 31, 62, 62), { fill: C.wine, halo: 0, order: 0.1 }); for (const q of P.petals(x, y, 8, 4, 24, 13)) A.part([q], { fill: C.white, halo: 1, order: 0.1 }); A.part(circ(x, y, 7), { fill: C.ink, halo: 1, order: 0.1 }); }
    });
  },
  draw(g, t) {
    const rv = (a, b, f = ease.out2) => seg(t, a, b, f), beat = t / 0.625;
    // two-stage technique: slip floods out from (x,y), then the art is incised through it
    const flood = (n, x, y, R, a, b, c, d) => { const q = rv(a, b, ease.inOut2); if (t < d) g.layer(n + 'S', { rv: q, mode: 2, rvp: [x, y, R, 0], soft: 0.06, noise: 0.16, glow: 0.8 }); if (t > c) g.layer(n, { rv: rv(c, d), soft: 0.08, noise: 0.04, glow: 0.55 }); };
    const SP = (n, o, a, b) => { const q = rv(a, b); if (q <= 0) return; if (o.hl) for (let k = 0; k < 8; k++) g.sprite(n, { ...o, x: o.x + Math.cos(k * TAU / 8) * 4, y: o.y + Math.sin(k * TAU / 8) * 4, rv: q, mode: 2, rvp: [o.x, o.y - 160, 420, 0], noise: 0.2, tint: o.hl, glow: 0 }); g.sprite(n, { ...o, rv: q, mode: 2, rvp: [o.x + (o.dx || 0), o.y - 160, 420, 0], noise: 0.2, tint: C.ink, tintA: 1 - seg(t, b - 0.1, b + 0.35), glow: 0.5 }); };

    g.ground({ color: C.terra, x: 14, y: 14, w: 1892, h: 1052, rv: rv(0, 0.7), mode: 2, rvp: [-60, 540, 2300, 0], noise: 0.12 });
    g.layer('tone', { rv: rv(0.2, 1.2), mode: 2, rvp: [-60, 540, 2300, 0], glow: 0.2 });
    flood('left', 160, 540, 760, 0.12, 0.7, 0.5, 1.1);
    // sea and ship
    flood('right', 1340, 520, 760, 1.35, 2.1, 1.9, 2.6);
    g.layer('tree', { rv: rv(1.8, 2.3) }); SP('owl', { x: 1488, y: 238, s: 0.44 }, 1.9, 2.3);
    SP('rider', { x: 1372 + Math.sin(t * 0.8) * 6, y: 238, s: 0.44, ph: t * 1.5, hl: C.terra }, 1.9, 2.4);
    g.sprite('waves', { x: 1050, y: 726, ph: t * 0.55, rv: rv(1.6, 2.3), mode: 3, rvp: [1050, 0, 0, 800], noise: 0.2 });
    const lurch = Math.exp(-Math.max(0, t - 2.5) * 2) * Math.sin(Math.max(0, t - 2.5) * 9) * (t > 2.5 ? 0.05 : 0), sx = 1568 + seg(t, 2.5, 5, ease.lin) * 20 - 6, sy = 716 + Math.sin(t * 2.3) * 8, sr = Math.sin(t * 2.3 + 1) * 0.032 + lurch, sc = 0.94;
    SP('ship', { x: sx, y: sy, r: sr, s: sc, ph: t * 0.8, hl: C.terra }, 1.6, 2.3);
    // dolphins leap on the beats
    const DOL = [[1270, 2.5, 1], [1700, 3.125, 1], [1300, 3.75, 1], [1660, 4.375, 1], [1440, 1.875, 1], [1620, 2.2, 1], [1480, 3.45, 1], [1560, 4.1, 1]]; DOL.forEach(([x, t0, k], i) => { const u = (t - t0) / 1.0; if (u < 0 || u > 1) return; const front = x > 1330 && x < 1800, H = front ? 62 : 124, X = x + k * (u - 0.5) * 190, h = Math.sin(u * Math.PI) * H, Y = (front ? 832 : 800) - h, an = Math.atan2(-Math.cos(u * Math.PI) * Math.PI * H, k * 190); const dq = { x: X, y: Y, r: k > 0 ? an : an + Math.PI, flip: k < 0, s: 0.78, ph: t * 2 + i * 0.2 }; for (let z = 0; z < 8; z++) g.sprite('dolphin', { ...dq, x: X + Math.cos(z * TAU / 8) * 4, y: Y + Math.sin(z * TAU / 8) * 4, tint: C.bone }); g.sprite('dolphin', dq); for (const [ts, xs] of [[0.1, -0.4], [0.9, 0.4]]) { const a = t - t0 - ts; if (a > 0 && a < 0.7) for (let q = 0; q < 16; q++) { const h1 = hash(i * 50 + q), vx = (h1 - 0.5) * 160, vy = -90 - 130 * hash(q * 7 + i); g.part(x + k * xs * 190 + vx * a, 770 + vy * a + 330 * a * a, 24, 4.4 * (1 - a), 0.95, 0.9, 0.8, 0.9 * (1 - a / 0.7), 1, 0, 0, 0); } } });
    g.sprite('waves2', { x: 1050, y: 792, ph: t * 0.4, rv: rv(1.8, 2.5), mode: 3, rvp: [1050, 0, 0, 800], noise: 0.2 });
    for (let i = 0; i < 4; i++) { const x = 1360 + ((i * 140 + t * 40) % 470), y = 420 + Math.sin(i * 2) * 50 + Math.sin(t * 1.7 + i) * 10; if (Math.abs(x - 1560) > 130) SP('gull', { x, y, s: 0.5, ph: t * 1.6 + i * 0.2 }, 2.2, 2.6); }
    // medallion
    g.layer('disc', { rv: rv(0.35, 0.95, ease.inOut2), soft: 0.04, noise: 0.14, glow: 0.8 });
    flood('rings', M[0] - 340, M[1] + 60, 760, 0.45, 1.0, 0.9, 1.6);
    // looms, weavers, riders
    g.sprite('heddle', { x: 330, y: 606 + Math.sin(beat * Math.PI) * 7, rv: rv(0.5, 0.9) }); g.sprite('heddle', { x: 330, y: 660 - Math.sin(beat * Math.PI) * 7, rv: rv(0.55, 0.95) });
    g.sprite('weights', { x: 331, y: 780, ph: t * 0.8, rv: rv(0.4, 0.9) });
    SP('weaverL', { x: 150, y: 838, hl: C.terra, ph: beat * 0.5 }, 0.1, 0.62); SP('weaverR', { x: 522, y: 838, flip: true, hl: C.terra, ph: beat * 0.5 }, 0.3, 0.85);
    for (let i = 0; i < 3; i++) SP('rider', { x: 150 + i * 170 + Math.sin(t * 0.9 + i) * 5 + t * 4, y: 238, s: 0.45, ph: t * 1.6 + i * 0.27, hl: C.terra }, 0.6 + i * 0.12, 1.3 + i * 0.12);
    // bottom frieze
    g.layer('frieze', { rv: rv(0.5, 1.3), glow: 0.3 }); flood('bottom', 160, 900, 1800, 0.5, 1.4, 1.2, 1.9);
    for (let i = 0; i < 8; i++) { const x = 100 + ((i * 222 + t * 120) % 1776); SP(i % 2 ? 'runB' : 'runA', { x, y: 991, s: 0.82, hl: '#bb7042', ph: t * 1.6 + i * 0.31, alpha: clamp((x - 96) / 30) * clamp((1850 - x) / 30) }, 0.8 + i * 0.06, 1.5 + i * 0.06); }

    // ------------------------------------------------ the thread
    const c1 = Math.cos(sr) * sc, s1 = Math.sin(sr) * sc, SH = (x, y) => [sx + x * c1 - y * s1, sy + x * s1 + y * c1];
    const path = [], add = (x, y, z) => path.push([x, y, z]), run = (pl, z, step = 8) => resample(Object.assign(pl, { open: true }), step).forEach((p, i) => add(p[0], p[1], typeof z === 'function' ? z(p[0], p[1], i) : z));
    run(curve([[-120, 540], [-20, 552], [90, 546], [160, 540], [246, 540]]), (x, y) => x > 92 && x < 206 ? -12 : 12);
    for (let i = 0; i <= 45; i++) add(247 + i * 3.75, 540 + Math.sin(beat * TAU) * 1.2, 3 + 7 * Math.sin(i / 45 * 15 * Math.PI));
    const arcIn = arc(M[0], M[1], 319, Math.PI * 0.965, Math.PI / 2 + 0.062, 60); run(curve([[416, 540], [440, 541], [500, 540], [560, 530], [600, 508], [642, 509]]), (x) => x > 452 && x < 556 ? -12 : 12); run(arcIn, 11);
    const iIn = path.length; const inn = offset(mazePath, -4.6), outp = [...offset(mazePath, 4.6)].reverse(); for (let i = 0; i < inn.length; i += 1) add(inn[i][0], inn[i][1], 10 + 3 * Math.sin(i * 0.3)); const iC = path.length; run(curve([inn[inn.length - 1], [M[0] - 8, M[1] + 62], [M[0] - 62, M[1] + 20], [M[0] - 50, M[1] - 46], [M[0] + 10, M[1] - 64], [M[0] + 62, M[1] - 14], [M[0] + 46, M[1] + 46], outp[0]]), 13); for (let i = 0; i < outp.length; i++) add(outp[i][0], outp[i][1], 10 + 3 * Math.sin(i * 0.3 + 1)); const iOut = path.length;
    run(arc(M[0], M[1], 319, Math.PI / 2 - 0.03, 0.06, 60), 11); const mast = SH(0, -436), bow = SH(214, -116), taut = seg(t, 2.5, 2.8, ease.outBack); run(curve([[1279, 493], [1330, 498], [1380, lerp(540, 470, taut)], [lerp(1470, 1476, taut), lerp(480, 380, taut)], mast]), 16); const iM = path.length; run(Object.assign([mast, [lerp(mast[0], bow[0], 0.5), lerp(mast[1], bow[1], 0.5) + (1 - taut) * 40], bow], { open: true }), 18); run(curve([bow, [1812, 560], [1880, 540], [2040, 540]]), 14);
    const cum = [0]; for (let i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2])); const U = i => cum[Math.min(i, cum.length - 1)] / cum[cum.length - 1];
    const head = key(t, [[0.05, 0], [0.5, U(iIn), ease.inOut2], [1.25, U(iC), ease.inOutSine], [1.36, U(iC + 30)], [2.5, U(iOut), ease.inOutSine], [2.72, U(iM), ease.out2], [3.1, 1, ease.in2]]);
    const inK = clamp((head - U(iIn)) / (U(iC) - U(iIn)));
    g.layer('maze', { rv: t > 1.3 ? 1 : inK, soft: 0.004, noise: 0.002, glow: 1.6, edge: 0.02 }); g.layer('heart', { rv: rv(1.15, 1.6), glow: 1.2 });
    g.layer('frame', { rv: rv(0, 1.3), glow: 0.5 });
    { const b = t - 1.25; if (b > 0 && b < 0.9) { const am = 22 * Math.exp(-3 * b), R2 = (80 + b * 420) ** 2; for (const p of path) p[2] += am * Math.exp(-((p[0] - M[0]) ** 2 + (p[1] - M[1]) ** 2) / R2); } }
    g.thread(path, { w: 7, hero: 1, f1: head, spark: 1, headLen: 140 });
    g.burst(M[0], M[1], 1.25, { n: 80, speed: 460, seed: 5, life: 1.1 }); g.burst(M[0], M[1] + 310, 2.5, { n: 30, speed: 220, seed: 6 }); if (t > 2.6) g.burst(mast[0], mast[1], 2.72, { n: 34, speed: 220, seed: 8 });
    // pulse of light round the labyrinth when the centre is reached
    const a = t - 1.25; if (a > 0 && a < 0.9) { g.bump(M[0], M[1], 80 + a * 420, 22 * Math.exp(-3 * a)); for (let k = 0; k < 150; k++) { const an = k / 150 * TAU, r = 60 + a * 420 + (hash(k) - 0.5) * 26, e = 1 - a / 0.9; g.part(M[0] + Math.cos(an) * r, M[1] + Math.sin(an) * r, 16, 2 + 3 * hash(k * 3), 2.2 * e, 1.3 * e, 0.5 * e, e, 0); } }
    // scratch sparks while lines are incised
    for (let k = 0; k < 40; k++) { const h1 = hash(k * 7), tt = 0.55 + h1 * 0.5, q = t - tt; if (q > 0 && q < 0.3) g.part(90 + hash(k * 3) * 500 + q * 40, 280 + hash(k * 5) * 540 + q * 60, 14, 2.6, 2 * (1 - q * 3), 1.2 * (1 - q * 3), 0.4, 1 - q * 3, 0); }
    g.drift({ n: 70, vx: 12, vy: -8, col: [1.2, 0.85, 0.45], a: 0.45, size: 2.3 });
  },
  shots: [
    { end: 1.25, cam: p => ({ x: lerp(300, 640, ease.inOut2(p)), y: lerp(590, 540, ease.inOut2(p)), w: lerp(700, 1150, ease.inOut2(p)), tilt: lerp(0.3, 0.16, p), yaw: lerp(-0.14, 0.04, p), aperture: 4 }) },
    { end: 2.5, cam: p => ({ x: lerp(955, 1000, ease.inOut2(p)), y: lerp(480, 520, p), w: lerp(430, 1240, ease.inOut2(p)), tilt: lerp(0.42, 0.1, ease.inOut2(p)), yaw: lerp(0.22, 0, p), aperture: lerp(5, 2, p) }) },
    { end: 5, cam: p => ({ x: lerp(1490, 985, ease.inOut2(p)), y: lerp(610, 545, ease.inOut2(p)), w: lerp(880, 1850, ease.inOut2(p)), tilt: lerp(0.22, 0.04, p), yaw: lerp(0.1, 0, p), aperture: lerp(3.5, 2, p) }) },
  ],
};
