// The heart of the tapestry (the 4×4 centre cells, 7680×4320): first fire, hands, animals, the ring of
// dancers, the ring of words for "thread", and four corner worlds.
import { spl, blob, poly, limb, circ, ell, curve, line, spiral, petal, star, at, offset, wavy, lerp, clamp, TAU, rng, rect, ring, arc, T } from '../art/geom.js';
import * as P from '../art/patterns.js';
import { figure, SKIN, POSE, skirtPath } from '../art/figures.js';
import { flame, handPrint, quad, heroHand } from './parts.js';
import { CAST, K } from './dancers.js';
import { seg, ease, hash } from '../core.js';
export const CX = 3840, CY = 2160;
const kOf = R => lerp(1.12, 1.66, clamp((R - 300) / 1200));
// arc-length parametrised ellipse
const cacheE = new Map();
function ellipse(R, k = kOf(R)) { const id = R + '/' + k; if (cacheE.has(id)) return cacheE.get(id); const N = 720, L = [0]; let px = R * k, py = 0; for (let i = 1; i <= N; i++) { const a = i / N * TAU, x = Math.cos(a) * R * k, y = Math.sin(a) * R; L.push(L[i - 1] + Math.hypot(x - px, y - py)); px = x; py = y; } const e = { len: L[N], at(u) { u = ((u % 1) + 1) % 1; const t = u * L[N]; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] <= t) lo = m; else hi = m; } const a = (lo + (t - L[lo]) / (L[hi] - L[lo])) / N * TAU, x = Math.cos(a) * R * k, y = Math.sin(a) * R; const nx = Math.cos(a) / k, ny = Math.sin(a), l = Math.hypot(nx, ny); return { x, y, a, rot: Math.atan2(ny / l, nx / l) + Math.PI / 2 }; } }; cacheE.set(id, e); return e; }
export { ellipse, kOf };
const ePath = (R, k = kOf(R), n = 240) => ell(CX, CY, R * k, R, 0, n);
const eRing = (R0, R1) => [...ePath(R1), [...ePath(R0)[0]].reverse()];
const C = { ink: '#241309', umber: '#4a2410', red: '#9c2c18', deep: '#6f1a12', gold: '#d8a130', och: '#b46a22', cream: '#ecd9a8', sand: '#c9995a', ind: '#1d3558', teal: '#23686a', green: '#34552f' };
export const WORDS = ['uzi', 'सूत्र', '絲', 'خيط', 'μίτος', '𒄖', 'ito 糸', 'нитка', "q'aytu", 'ᐃᕙᓗ', 'நூல்', '실', 'חוט', 'ᚦᚱᛅᚦᛦ', 'ክር', 'نخ', 'ძაფი', 'aho', 'hilo', 'ด้าย', 'fil', 'òwú', 'ꦭꦮꦺ', 'snáithe', 'თელი', 'iplik', 'ᎠᏍᏗ', 'chỉ', 'lanka', 'ahama', 'edau', 'fir', 'sợi', 'raki', 'တံ', 'ᠤᠲᠠᠰᠤ', 'Faden', 'intambo', "k'uuch", 'asaawa', 'dhaga', 'thread', 'лента', 'zare', 'sinulid', 'draad'].filter(w => !['თელი', 'တံ', 'лента', 'sợi', 'dhaga'].includes(w));
// elongated first people
const first = (o = {}) => ({ skin: ['#4a2410', '#6f2f16'], ornament: 0, hair: { kind: 'cap', fill: ['#1c0f08', '#2c180c'] }, collar: { color: C.cream, w: 8 }, anklet: { color: C.cream }, lower: { len: 60, flare: 34, w: 26, folds: 2, scallop: 3, fill: [C.red, C.deep], gap: 10 }, headS: 0.74, ...o });
const antler = (A, q) => { for (const k of [0, 10]) { const b = q(-18 - k, -22); A.stroke(curve([b, [b[0] - 34, b[1] - 40], [b[0] - 30, b[1] - 104]]), { w: 10, color: C.ink, taper1: 0.5, halo: 2 }); } };
const tailA = (A, p) => A.stroke(curve([p, [p[0] - 34, p[1] + 16], [p[0] - 44, p[1] + 74]]), { w: 9, color: C.ink, taper1: 0.35, halo: 2 });
const BEASTS = [
  { fill: [C.red, C.deep], neckA: -48, hump: 8, horns: antler, tail: tailA },
  { fill: [C.umber, C.ink], neckA: -12, neckL: 70, hump: 60, depth: 150, headL: 84, horns: (A, q) => { const b = q(-6, -26); A.stroke(curve([b, [b[0] + 30, b[1] - 30], [b[0] + 20, b[1] - 66]]), { w: 13, color: C.ink, taper1: 0.5, halo: 2 }); }, tail: tailA },
  { fill: [C.och, C.red], neckA: -42, neckL: 108, headL: 100, tail: (A, p, ph) => A.part(limb([p, [p[0] - 50, p[1] - 10 + Math.sin(ph * TAU) * 14], [p[0] - 100, p[1] + 30]], [18, 26, 6]), { fill: C.ink, halo: 2, lines: [{ flow: { gap: 7, w: 2, margin: 3, field: [{ dir: 2.9 }] } }] }), extra: (A, { q }) => { for (let i = 0; i < 7; i++) { const b = q(-24 - i * 18, -24); A.part(petal(b[0], b[1], 44, 20, -2.2 - i * 0.04), { fill: C.ink, halo: 1.4 }); } } },
  { fill: [C.umber, '#2c1409'], L: 330, H: 270, depth: 190, neckA: 10, neckL: 50, headL: 80, hump: 46, legW: [58, 46, 36], stride: 46, gap: 12, gallop: 0.4, extra: (A, { q }) => { A.part(limb([q(60, 0), q(96, 60), q(80, 130), q(112, 168)], [44, 34, 22, 14]), { fill: [C.umber, C.ink], halo: 3, lines: [{ flow: { gap: 8, w: 2, margin: 3, field: [{ dir: 0.4 }] } }] }); for (const k of [0, 14]) { const b = q(66, 18 + k); A.stroke(curve([b, [b[0] + 60, b[1] + 46], [b[0] + 118, b[1] - 6], [b[0] + 112, b[1] - 60]]), { w: 17, color: C.cream, taper1: 0.6, halo: 3 }); } }, tail: tailA },
  { fill: [C.och, C.umber], neckA: -62, neckL: 150, headL: 74, legW: [30, 15, 10], horns: (A, q) => { for (const [k, d] of [[0, 1], [8, 0.9]]) { const b = q(-10 - k, -22); A.stroke(curve([b, [b[0] - 20, b[1] - 60 * d], [b[0] + 16, b[1] - 108 * d]]), { w: 9, color: C.ink, taper1: 0.4, halo: 2 }); for (const f of [0.4, 0.7]) { const p = [b[0] - 14, b[1] - 80 * d * f]; A.stroke(curve([p, [p[0] + 24, p[1] - 14], [p[0] + 30, p[1] - 34]]), { w: 7, color: C.ink, taper1: 0.4, halo: 1.4 }); } } } },
  { fill: [C.gold, C.och], neckA: -24, neckL: 70, headL: 72, depth: 104, H: 190, stride: 100, hoof: C.umber, tail: (A, p, ph) => A.stroke(curve([p, [p[0] - 60, p[1] - 30 + Math.sin(ph * TAU) * 20], [p[0] - 110, p[1] - 70]]), { w: 11, color: C.umber, taper1: 0.2, halo: 2 }), extra: (A, { q }) => { const c = q(-8, 2); for (let i = 0; i < 16; i++) A.part(petal(c[0], c[1], 62, 22, i / 16 * TAU), { fill: i % 2 ? C.umber : C.red, halo: 1.6 }); } },
];
export default {
  id: 'medallion', w: 7680, h: 4320, mat: 0, bakeScale: 1,
  bake(B) {
    B.layer('bg', A => {
      const R = rng(5);
      // deep field outside the oval with four worlds
      A.part([[[0, 0], [7680, 0], [7680, 4320], [0, 4320]], [...ePath(2150)[0]].reverse()], { fill: '#1d2f4a', halo: 0, rule: 'evenodd', order: 0.8 });
      const worlds = [[0, 0, '#16294a', '#23477a'], [1, 0, '#7a1f14', '#a8431c'], [0, 1, '#17484e', '#2a7474'], [1, 1, '#27452a', '#4d6a2c']];
      for (const [ix, iy, c0, c1] of worlds) {
        const x0 = ix ? CX + 20 : 0, y0 = iy ? CY + 20 : 0, clip = [[x0, y0], [x0 + CX - 20, y0], [x0 + CX - 20, y0 + CY - 20], [x0, y0 + CY - 20]];
        A.m.save(); A.m.beginPath(); clip.forEach((p, i) => i ? A.m.lineTo(...p) : A.m.moveTo(...p)); A.m.closePath(); A.m.clip();
        const corner = [ix ? 7680 : 0, iy ? 4320 : 0], sx = ix ? -1 : 1, sy = iy ? -1 : 1;
        A.part([[[x0, y0], [x0 + CX, y0], [x0 + CX, y0 + CY], [x0, y0 + CY]], [...ePath(2135)[0]].reverse()], { fill: [c0, c1], halo: 0, rule: 'evenodd', order: 0.8, lines: [{ flow: { gap: 46, w: 10, margin: 14, minLen: 120, field: [{ fn: (x, y) => { const a = Math.atan2((y - CY) * 1.66, x - CX); return [-Math.sin(a) * 1.5, Math.cos(a)]; } }, { vortex: [corner[0] + sx * 520, corner[1] + sy * 420, 520, ix ^ iy ? 1 : -1], w: 1.8 }, { vortex: [corner[0] + sx * 1380, corner[1] + sy * 260, 260, ix ^ iy ? -1 : 1], w: 1.4 }, { vortex: [corner[0] + sx * 260, corner[1] + sy * 1150, 260, ix ^ iy ? -1 : 1], w: 1.4 }] } }] });
        A.m.restore();
      }
    }, { res: 0.8 });
    B.layer('main', A => {
      const R = rng(9);
      // oval ground tone: rays
      A.with({ halo: -1, noKnock: true, order: 0.5, alpha: 0.34 }, () => { for (let i = 0; i < 132; i++) { const a = i / 132 * TAU, c = Math.cos(a), s = Math.sin(a); A.part(poly([[CX + c * 1180 * 1.5, CY + s * 1180], [CX + Math.cos(a - 0.011) * 2120 * 1.66, CY + Math.sin(a - 0.011) * 2120], [CX + Math.cos(a + 0.011) * 2120 * 1.66, CY + Math.sin(a + 0.011) * 2120]]), { fill: i % 2 ? C.och : C.sand }); } });
      // ---- rings of ornament
      const band = (R0, R1, fill, o = {}) => A.part(eRing(R0, R1), { fill, halo: 3, rule: 'evenodd', order: o.order ?? 0.5, ...o });
      const along = (Rm, n, fn, off = 0) => { const e = ellipse(Rm); for (let i = 0; i < n; i++) { const p = e.at((i + off) / n); A.at({ x: CX + p.x, y: CY + p.y, r: p.rot }, () => fn(i, p)); } };
      band(1196, 1214, C.umber); band(1330, 1348, C.umber);
      along(1272, 150, i => { const c = [C.red, C.ind, C.gold, C.teal, C.cream][i % 5]; A.stroke(spiral(0, 0, 34, 5, (i % 2) * Math.PI, (i % 2 ? -1 : 1) * 1.7, 40), { w: 12, color: c === C.cream ? C.och : c, taper: 0.12, halo: 0, order: i / 150 }); });
      band(1850, 1862, C.umber); band(2020, 2036, C.umber); band(2046, 2130, C.red, { order: 0.7 });
      along(2088, 168, i => A.part(poly([[-30, 28], [0, -32], [30, 28]]), { fill: i % 2 ? C.gold : C.cream, halo: 2, gold: i % 2, raise: 0.5, order: 0.7 }));
      along(1862, 220, i => A.dots([[0, -14, 7]], { color: C.red, halo: 0 }));
      // ring of words
      const e = ellipse(1936), n = 84; const FONT = '"Optima","Times New Roman","Noto Sans","Hiragino Mincho ProN","Songti SC","Kohinoor Devanagari","Geeza Pro","Noto Sans Cuneiform","Noto Sans Runic","Euphemia UCAS","Noto Sans Javanese","Noto Sans Mongolian","Kefa","Tamil Sangam MN","Thonburi","Plantagenet Cherokee","Arial Hebrew","Apple SD Gothic Neo","Times New Roman"'; let u = 0; const items = []; let w = 0; A.m.save(); A.m.font = `78px ${FONT}`; for (let i = 0; w < e.len - 60; i++) { const t = WORDS[i % WORDS.length], tw = A.m.measureText(t).width + 76; if (w + tw > e.len) break; items.push([t, w + tw / 2, i]); w += tw; } A.m.restore(); const slack = e.len / w; for (const [t, pos, i] of items) { const p = e.at(pos * slack / e.len - 0.25); A.at({ x: CX + p.x, y: CY + p.y, r: p.rot }, () => { A.text(t, 0, 26, { font: `78px ${FONT}`, align: 'center', color: i % 3 === 0 ? C.deep : C.ink, bold: 1.5, halo: 0, order: i / items.length }); }); const q = e.at((pos * slack + 0) / e.len - 0.25 + 0.5 / items.length); A.dots([[CX + q.x, CY + q.y, 9]], { color: C.gold, gold: 1, raise: 1, halo: 0, order: i / items.length }); }
      // ---- corner worlds
      const bigStar = (x, y, r, c, o = {}) => { A.part(star(x, y, r, r * 0.42, 8), { fill: c, gold: 1, raise: 0.8, halo: 4, order: 0.9, ...o }); };
      for (let i = 0; i < 60; i++) { const x = R() * 3000, y = R() * 1300; if (((x - CX) / 1.66) ** 2 + (y - CY) ** 2 < 2230 ** 2) continue; bigStar(60 + x, 50 + y, 14 + R() * 26, i % 3 ? C.cream : C.gold); }
      // moon (TL)
      A.part([spl([[560, 180], [420, 260], [370, 420], [430, 590], [580, 660], [500, 540], [470, 420], [490, 290]], true, 10)], { fill: [C.cream, '#d8c08a'], gold: 0.6, raise: 1, halo: 8, order: 0.85, lines: [{ flow: { gap: 26, w: 6, margin: 10, field: [{ contour: 1 }] } }] });
      // sun (TR)
      { const x = 7150, y = 440; for (const [k, r0, r1, c] of [[0, 190, 380, C.gold], [0.5, 190, 320, C.cream]]) for (let i = 0; i < 20; i++) { const a = (i + k) / 20 * TAU; A.part(limb([[x + Math.cos(a) * r0, y + Math.sin(a) * r0], [x + Math.cos(a + 0.06) * lerp(r0, r1, 0.5), y + Math.sin(a + 0.06) * lerp(r0, r1, 0.5)], [x + Math.cos(a - 0.03) * r1, y + Math.sin(a - 0.03) * r1]], [42, 30, 3]), { fill: c, gold: 1, raise: 0.9, halo: 4, order: 0.85 }); } A.part(circ(x, y, 178, 72), { fill: { rad: [x, y, 0, 178], stops: ['#f0c352', C.gold, '#b8661f'] }, gold: 1, raise: 1, halo: 8, order: 0.85, lines: [{ strokes: [spiral(x, y, 150, 16, 0, 4, 120)], w: 11, taper: 0.08 }] }); }
      // whale (BL)
      { A.at({ x: 640, y: 3850, r: -0.18 }, () => { A.part(blob([[-470, 30], [-330, -110], [-60, -170], [220, -140], [400, -60], [520, -90], [640, -190], [600, -70], [660, 10], [520, -14], [400, 40], [180, 120], [-120, 150], [-360, 110]]), { fill: ['#0f2a40', '#1d4a5c'], halo: 8, raise: 0.8, order: 0.9, lines: [{ flow: { gap: 24, w: 6, margin: 10, field: [{ guide: curve([[-470, 30], [0, -40], [400, -10], [640, -100]]), w: 1, fall: 400 }, { vortex: [60, -30, 120, 1], w: 1.4 }] } }] }); A.part(circ(-330, 10, 18), { fill: C.cream, halo: 5 }); A.part(petal(-150, 90, 230, 80, 1.1), { fill: '#0f2a40', halo: 6, order: 0.9, lines: [{ flow: { gap: 16, w: 4, margin: 6, field: [{ dir: 1.1 }] } }] }); }); for (const [x, y, s, d] of [[1300, 4050, 1, 1], [1760, 4150, 0.8, -1], [330, 3390, 0.8, 1], [2250, 4190, 0.7, 1]]) A.strokes([spiral(x, y, 130 * s, 12, 0, d * 2.4, 70)], { w: 20 * s, color: C.cream, taper: 0.2, halo: 6, order: 0.9 }); }
      // tree (BR)
      { const x = 7080, y = 4240; A.part(limb([[x, y], [x - 30, y - 240], [x + 20, y - 420]], [150, 90, 60]), { fill: [C.umber, C.ink], halo: 6, raise: 0.6, order: 0.85, lines: [{ flow: { gap: 18, w: 5, margin: 8, field: [{ guide: curve([[x, y], [x - 30, y - 240], [x + 20, y - 420]]), w: 1, fall: 400 }, { vortex: [x - 20, y - 180, 40, 1], w: 1 }] } }] }); for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.08 + 0.84 * i / 8), p = curve([[x + 10, y - 400], [x + Math.cos(a) * 220, y - 420 + Math.sin(a) * 200], [x + Math.cos(a) * 420, y - 430 + Math.sin(a) * 360]]); A.stroke(p, { w: 34, color: C.umber, taper1: 0.7, halo: 4, order: 0.9 }); const v = P.vine(p, { every: 84, size: 46, seed: i + 3 }); A.strokes(v.stems, { w: 8, color: '#8aa04a', taper1: 0.3, halo: 2, order: 0.92 }); for (const l of v.leaves) A.part([l], { fill: i % 2 ? '#7a9440' : '#b8b04a', halo: 2, order: 0.94 }); A.dots(v.berries.map(b => [b[0], b[1], b[2] * 1.4]), { color: C.red, halo: 3, order: 0.96 }); } }
    }, { res: 0.8 });
    B.layer('fields', A => {
      const band = (R0, R1, fill, o = {}) => A.part(eRing(R0, R1), { fill, halo: 3, rule: 'evenodd', order: 0.5, ...o });
      const along = (Rm, n, fn, off = 0) => { const e = ellipse(Rm); for (let i = 0; i < n; i++) { const p = e.at((i + off) / n); A.at({ x: CX + p.x, y: CY + p.y, r: p.rot }, () => fn(i, p)); } };
      // savanna under the animals
      band(866, 1190, ['#41501f', '#55622a', '#37461c']); along(1010, 150, i => A.strokes([0, 1, 2].map(k => curve([[k * 22 - 22, 60 - (i % 3) * 70], [k * 22 - 20 + 6, 34 - (i % 3) * 70], [k * 22 - 10, 14 - (i % 3) * 70]])), { w: 5, color: '#7d8a3e', taper1: 0.5, halo: 0, noKnock: true })); along(1140, 120, i => A.part(petal(0, 18, 34, 20, -1.57 + (i % 2 ? 0.4 : -0.4)), { fill: i % 2 ? '#8a9a48' : '#6b7a34', halo: 0, noKnock: true })); along(900, 96, i => A.dots([[0, 0, 7], [-14, 10, 4]], { color: i % 2 ? '#d8a130' : '#b3331c', halo: 0, noKnock: true }));
      // night sky behind the dancers, red earth under their feet
      band(1352, 1846, ['#15284a', '#1b355f', '#122240']); band(1354, 1422, ['#7a1f14', '#8f2a18']); along(1388, 190, i => A.part(poly([[-26, 24], [0, -26], [26, 24]]), { fill: i % 2 ? '#d8a130' : '#c4781f', halo: 2, gold: i % 2 ? 1 : 0, raise: 0.5 }));
      along(1620, 88, i => A.stroke(spiral(0, (i % 2 ? -150 : 40), 46, 6, i, (i % 2 ? 1 : -1) * 2, 46), { w: 7, color: '#2f5f96', taper: 0.15, halo: 0, noKnock: true })); along(1790, 200, i => A.part(star(0, (i * 37 % 5) * 16 - 40, 15 + i % 3 * 5, 6, 5), { fill: i % 3 ? '#ecd9a8' : '#d8a130', gold: 1, raise: 0.6, halo: 2 })); along(1540, 132, i => A.dots([[0, (i * 29 % 7) * 22 - 70, 5 + i % 3 * 2]], { color: '#4f86bd', halo: 0, noKnock: true }));
    }, { res: 0.6 });
    B.layer('core', A0 => A0.at({ x: 1600, y: 1000 }, A => {
      // local origin = centre; fine art for the opening
      const R = rng(21);
      A.with({ halo: -1, noKnock: true, alpha: 0.5 }, () => { for (let i = 0; i < 260; i++) { const a = R() * TAU, r = 220 + R() * 900; A.stroke(curve([[Math.cos(a) * r * 1.3, Math.sin(a) * r], [Math.cos(a) * (r + 26) * 1.3, Math.sin(a) * (r + 26)], [Math.cos(a + 0.03) * (r + 60) * 1.3, Math.sin(a + 0.03) * (r + 60)]]), { w: 5, color: C.och, taper: 0.4, order: r / 1100 }); } });
      // dots and lines between the rings
      for (const [Rr, n, d, c] of [[330, 64, 5, C.cream], [350, 64, 7, C.red], [612, 120, 5, C.umber], [632, 60, 8, C.och]]) { const e = ellipse(Rr); A.dots(Array.from({ length: n }, (_, i) => { const p = e.at(i / n); return [p.x, p.y, d]; }), { color: c, halo: 1, order: Rr / 1100 }); }
      // ring of spirals round the fire
      { const e = ellipse(292); for (let i = 0; i < 26; i++) { const p = e.at(i / 26); A.stroke(spiral(p.x, p.y, 24, 4, p.rot, i % 2 ? -1.8 : 1.8, 36), { w: 8, color: i % 2 ? C.umber : C.red, taper: 0.15, halo: 0, order: 0.2 }); } }
      // ring of hands
      { const e = ellipse(742), n = 30, cols = [C.red, C.ink, C.cream, C.och, C.deep, C.umber]; for (let i = 0; i < n; i++) { const p = e.at(i / n); A.at({ x: p.x, y: p.y, r: p.rot + (R() - 0.5) * 0.25, s: 0.62 + R() * 0.14, sx: R() > 0.5 ? 1 : -1 }, () => { const c = cols[i % cols.length]; A.with({ order: 0.3 + 0.45 * hash(i * 31 + 5) }, () => handPrint(A, { fill: c, spread: 0.8 + R() * 0.5 })); A.dots(Array.from({ length: 46 }, () => { const a = R() * TAU, r = 120 + R() * 70; return [Math.cos(a) * r, -50 + Math.sin(a) * r, 1.5 + R() * 4]; }), { color: c, halo: 0, noKnock: true, order: 0.3 + 0.45 * hash(i * 31 + 5) }); }); } }
    }), { x: CX - 1600, y: CY - 1000, w: 3200, h: 2000, res: 2 });
    B.sprite('fire', { w: 760, h: 760, n: 10, res: 2 }, (A, ph) => { for (let i = 0; i < 12; i++) A.at({ r: i / 12 * TAU + Math.sin(ph * TAU + i) * 0.05 }, () => A.at({ y: -96 }, () => flame(A, (ph + i * 0.17) % 1, { n: 3, w: 170, h: 190 + 50 * Math.sin(i * 2.1 + ph * TAU), seed: 4 + i }))); A.part(circ(0, 0, 122, 64), { fill: { rad: [0, 0, 0, 122], stops: ['#f7d268', '#dd8f1e', '#a8380c'] }, gold: 0.4, raise: 0.6, halo: 5, lines: [{ strokes: [spiral(0, 0, 100, 10, ph * TAU, 3, 90)], w: 9, taper: 0.1 }] }); });
    for (let v = 0; v < 4; v++) B.sprite('first' + v, { w: 300, h: 330, ox: 150, oy: 312, n: 6, res: 2 }, (A, ph) => A.at({ s: 0.7 }, () => figure(A, first({ pose: v === 0 ? POSE.dance(ph) : v === 1 ? { ...POSE.walk(ph), armN: [-60 + Math.sin(ph * TAU) * 30, -90], armF: [-120 - Math.sin(ph * TAU) * 30, -90] } : v === 2 ? { ...POSE.dance((ph + 0.5) % 1), lean: 22 } : POSE.run(ph), lower: v % 2 ? { len: 66, flare: 40, w: 26, folds: 2, scallop: 3, fill: [C.och, C.umber], gap: 10 } : first().lower }))));
    B.sprite('handA', { w: 640, h: 980, ox: 320, oy: 600, res: 2 }, A => heroHand(A, { skin: ['#2c1409', '#4a2410'], raise: 0.8, pattern: 0, halo: 4 }));
    B.sprite('handB', { w: 640, h: 980, ox: 320, oy: 600, res: 2 }, A => heroHand(A, { skin: ['#2c1409', '#4a2410'], raise: 0.8, pattern: 1, halo: 4 }));
    BEASTS.forEach((b, i) => B.sprite('beast' + i, { w: 620, h: 470, ox: 290, oy: 440, n: 6, res: 1.3 }, (A, ph) => quad(A, ph, b)));
    CAST.forEach((c, i) => B.sprite('d_' + c.id, { w: 440, h: 590, ox: 220, oy: 566, n: 6, res: 1.15 }, (A, ph) => figure(A, { ...c, pose: POSE.joinHands(ph) })));
  },
  // o: { fire, core, beasts, main, bg, dancers (0..1 reveals), spin, dark }
  draw(g, t, o = {}) {
    const q = { fire: 1, core: 1, first: 1, beasts: 1, main: 1, bg: 1, dancers: 1, fields: 0, spin: 0, emit: 0.07, ...o };
    if (q.bg > 0) g.layer('bg', { rv: q.bg, mode: 2, rvp: [CX, CY, 4300, 0], noise: 0.1 });
    if (q.main > 0) g.layer('main', { rv: q.main, mode: 2, rvp: [CX, CY, 4300, 0], noise: 0.08, edge: 0.03 });
    if (q.fields > 0) g.layer('fields', { rv: q.fields, mode: 2, rvp: [CX, CY, 4300, 0], noise: 0.05 });
    const outl = (name, o, px, col) => { for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.sprite(name, { ...o, x: o.x + Math.cos(a) * px, y: o.y + Math.sin(a) * px, tint: col, tintA: 1, raise: 0, gold: 0 }); } };
    if (q.core > 0) g.layer('core', { rv: q.core });
    const place = (R, n, off, fn) => { const e = ellipse(R); for (let i = 0; i < n; i++) { const p = e.at(i / n + off); fn(i, CX + p.x, CY + p.y, p.rot, p); } };
    if (q.first > 0) place(392, 20, t * 0.016 - 0.25, (i, x, y, r) => g.sprite('first' + (i % 4), { x, y, r, s: 0.94, ph: t * 1.6 + i * 0.37, rv: clamp(q.first * 2 - hash(i + 7)) }));
    if (q.beasts > 0) place(960, 18, -t * 0.022, (i, x, y, r) => { const n = 'beast' + (i * 5 % 6), o = { x, y, r, s: 0.74, flip: true, ph: t * 1.6 + i * 0.29, rv: clamp(q.beasts * 2 - hash(i + 3)) }; if (q.fields > 0.5) outl(n, o, 6, '#d9b36a'); g.sprite(n, o); });
    if (q.dancers > 0) place(1402, CAST.length, -0.25 + q.spin, (i, x, y, r) => { const c = CAST[(i + 22) % CAST.length], n = 'd_' + c.id, o = { x, y, r, s: 1.06, ph: t * 0.8 + (i % 2) * 0.5, rv: clamp(q.dancers * 1.8 - (i / CAST.length) * 0.8) }; if (q.fields > 0.5) outl(n, o, 5.5, '#dcbf82'); g.sprite(n, o); });
    if (q.fire > 0) { const f = 1 + 0.03 * Math.sin(t * 9); g.sprite('fire', { x: CX, y: CY, s: q.fire * f, r: t * 0.05, ph: t * 1.25, emit: q.emit * (0.85 + 0.15 * Math.sin(t * 11)) }); }
  },
  shots: [{ end: 5, cam: p => ({ x: CX, y: CY, w: 7800 }) }],
};
