// Nile Valley, Egypt — papyrus painting. The thread becomes the surveyors' knotted rope (nwḥ); pulled taut,
// it lays out the pyramids.
import { spl, blob, poly, rect, rrect, limb, circ, ell, arc, arcBand, curve, line, spiral, petal, star, T, at, sub, offset, wavy, lerp, clamp, TAU, rng } from '../art/geom.js';
import * as P from '../art/patterns.js';
import { figure, SKIN, POSE, pol } from '../art/figures.js';
import { seg, ease, key, hash } from '../core.js';

const C = { ink: '#2a160a', red: '#a3301c', brick: '#7a2413', gold: '#d8a130', ochre: '#b9772a', turq: '#2c8a86', lapis: '#1d4470', green: '#3f6b3a', cream: '#ecd9a8', white: '#f3e6c4', sand: '#c99a52' };
const linen = { fill: [C.white, '#dcc794'], gap: 11, lw: 2.2 };
const man = (o = {}) => ({ skin: SKIN.sienna, hair: { kind: 'bob' }, torso: undefined, lower: { len: 92, flare: 44, w: 29, folds: 2, scallop: 3, ...linen }, belt: { color: C.lapis, ink: C.gold }, collar: { color: [C.turq, C.red, C.lapis], rows: 3, w: 11, dots: C.cream }, armlet: { color: C.gold, gold: 1 }, bangle: { color: C.turq }, ...o });
const woman = (o = {}) => ({ skin: SKIN.copper, hair: { kind: 'long', gap: 8 }, torso: { fill: [C.white, '#e3d0a0'] }, lower: { len: 176, flare: 46, w: 29, folds: 2, scallop: 2, ...linen, bands: [{ at: 0.93, w: 14, color: C.turq, motif: 'dots', ink: C.cream }] }, belt: { color: C.red }, collar: { color: [C.red, C.turq, C.lapis, C.gold], rows: 4, w: 10, dots: C.cream }, bangle: { color: C.gold, gold: 1 }, hat: A => { A.stroke(curve([[-50, -30], [-10, -42], [38, -26]]), { w: 8, color: C.gold, halo: 2, gold: 1 }); for (const q of P.petals(34, -44, 5, 0, 34, 16, -2.6).slice(0, 5)) A.part([q], { fill: C.turq, halo: 1.5 }); }, ...o });

function lotus(A, x, y, s, o = {}) { A.at({ x, y, s }, () => { for (const [a, l, w, c] of [[-2.5, 46, 20, C.green], [-0.64, 46, 20, C.green], [-2.15, 58, 22, C.turq], [-1, 58, 22, C.turq], [-1.85, 66, 22, C.cream], [-1.29, 66, 22, C.cream], [-1.57, 72, 24, C.turq]]) A.part(petal(0, 0, l, w, a), { fill: c, halo: 2, ...o }); }); }
function papyrus(A, pts, s, o) { const top = pts[pts.length - 1]; A.part(limb(pts, [16 * s, 12 * s, 9 * s]), { fill: [C.green, '#2c4d2c'], lines: [{ strokes: [offset(spl(pts, false, 8), 1)], w: 2.4 }], ...o }); for (let i = 0; i < 13; i++) { const a = -Math.PI / 2 + (i - 6) * 0.205; A.part(petal(top[0], top[1] + 6, (96 - Math.abs(i - 6) * 3) * s, 15 * s, a, 0.8), { fill: i % 2 ? C.green : '#5f8a3e', halo: 1.6, ...o }); } A.part(arcBand(top[0], top[1] + 4, 16 * s, 30 * s, Math.PI * 1.1, Math.PI * 1.9), { fill: C.red, halo: 2, ...o }); }

export default {
  id: 'nile', mat: 9, dur: 5,
  word: { native: '𓏌𓅱𓎛𓍢', font: '"Noto Sans Egyptian Hieroglyphs"', roman: 'nuh', gloss: 'rope, cord' },
  caption: { place: 'Nile Valley, Egypt', tech: 'papyrus painting' },
  env: t => ({ cloth: '#c9a257', stain: 0.8, wear: 0.16, exposure: 0.92 }),
  bake(B) {
    B.layer('ground', A => {
      A.part(rect(72, 72, 1776, 330), { fill: ['#122c4e', '#1d4470'], halo: 0, order: ['lin', 72, 0, 1848, 0, 0, 0.6] });
      for (let j = 0; j < 6; j++) for (let i = 0; i < 33; i++) { const x = 92 + i * 54 + (j % 2) * 27, y = 100 + j * 54; if (x > 1834) continue; A.part(star(x, y, 15, 5.4, 5), { fill: j % 2 ? C.gold : C.cream, gold: 0.7, raise: 0.5, halo: 2, order: 0.2 + i / 60 }); A.dots([[x, y, 3.4]], { color: C.red, halo: 0, order: 0.3 }); }
      // horizon: hills of red and gold with flow lines
      A.part([spl([[72, 660, 1], [72, 470, 1], [220, 440], [420, 468], [640, 430], [900, 470], [1180, 436], [1420, 470], [1640, 432], [1848, 462, 1], [1848, 660, 1]], true, 10)], { fill: ['#e0b868', '#cf9a48'], halo: 4, order: ['lin', 72, 0, 1848, 0, 0, 0.6], lines: [{ flow: { gap: 26, w: 4, margin: 8, minLen: 80, field: [{ dir: 0.04 }, { contour: 0.5 }, { vortex: [260, 560, 70, 1], w: 1 }, { vortex: [1650, 560, 70, -1], w: 1 }] }, alpha: 0.6 }] });
      // lower register ground
      A.part(rect(72, 800, 1776, 186), { fill: ['#e3c283', '#d9ad5e'], halo: 0, order: ['lin', 72, 0, 1848, 0, 0, 0.8] });
      const gl = [...'𓇳𓈖𓂋𓏏𓆓𓋹𓇋𓅓𓊪𓎛𓃀𓄿𓆑𓉔𓏤𓐍𓊃𓋴𓌳𓎡'];
      [[330, 0], [500, 5], [820, 2], [1105, 9], [1200, 4], [1480, 7], [1566, 1]].forEach(([x, k], n) => { A.strokes([line([x - 24, 806], [x - 24, 980]), line([x + 24, 806], [x + 24, 980])], { w: 3, color: C.brick, halo: 0, order: x / 1920 }); for (let i = 0; i < 4; i++) A.text(gl[(k + i * 3) % gl.length], x, 846 + i * 42, { font: '36px "Noto Sans Egyptian Hieroglyphs"', align: 'center', color: [C.lapis, C.red, C.ink, '#235f5c'][(i + n) % 4], bold: 1, halo: 0, order: x / 1920 }); });
      // wheat along the bottom
      for (let i = 0; i < 118; i++) { const x = 84 + i * 15 + (i % 3) * 2, h = 26 + (i * 7 % 5) * 3; A.stroke(curve([[x, 986], [x + 1, 986 - h * 0.6], [x + 4, 986 - h]]), { w: 2.6, color: C.ochre, halo: 0, order: x / 1920 }); A.part(petal(x + 4, 986 - h + 6, 16, 6, -1.4), { fill: C.gold, halo: 0, order: x / 1920 }); }
    });
    B.layer('back', A => {
      // ---- winged sun
      const sx = 960, sy = 228;
      A.with({ raise: 0.9, gold: 0.85 }, () => {
        for (const k of [-1, 1]) {
          const edge = curve([[sx + k * 64, sy - 10], [sx + k * 190, sy - 62], [sx + k * 380, sy - 70], [sx + k * 560, sy - 34], [sx + k * 700, sy + 46]], 16);
          const rows = [[22, 0.10, 250, 30, 46], [19, 0.06, 150, 27, 26], [17, 0.03, 84, 24, 10]];
          rows.forEach(([n, u0, L0, wd, dy], r) => { for (let i = n - 1; i >= 0; i--) { const u = lerp(u0, r === 0 ? 1 : r === 1 ? 0.93 : 0.86, i / (n - 1)), [x0, y0] = at(edge, u), a = Math.PI / 2 - k * lerp(0.05, 1.02, Math.pow(u, 1.25)), len = L0 * lerp(0.46, 1, Math.pow(u, 0.7)); const c = r === 2 ? [C.gold, C.ochre] : r === 1 ? [C.turq, '#1c6468'] : [[C.red, C.brick], [C.lapis, '#142d50'], [C.green, '#274a2a']][i % 3]; A.part(petal(x0, y0 + 4, len, wd, a, 0.8), { fill: c, gold: r === 2 ? 1 : 0.1, halo: 2.4, order: lerp(0.12, 0.62, u) + (2 - r) * 0.06, lines: [{ strokes: [line([x0, y0 + 4], [x0 + Math.cos(a) * len * 0.86, y0 + 4 + Math.sin(a) * len * 0.86])], w: 2.2, taper: 0.2 }, ...(r === 0 ? [{ strokes: Array.from({ length: 7 }, (_, q) => { const f = 0.45 + q * 0.07, px = x0 + Math.cos(a) * len * f, py = y0 + 4 + Math.sin(a) * len * f; return line([px, py], [px + Math.cos(a + 0.8) * 12, py + Math.sin(a + 0.8) * 12]); }), w: 1.8 }] : [])] }); } });
          A.part(limb(edge.filter((_, i) => i % 8 === 0), [34, 34, 30, 24, 8]), { fill: [C.gold, C.ochre], order: ['lin', sx, 0, sx + k * 640, 0, 0.1, 0.6], lines: [{ dots: Array.from({ length: 22 }, (_, i) => { const [x, y] = at(edge, 0.04 + i * 0.042); return [x, y, 5]; }), ink: C.red }, { dots: Array.from({ length: 22 }, (_, i) => { const [x, y] = at(edge, 0.061 + i * 0.042); return [x, y, 2.6]; }), ink: C.lapis }] });
        }
        A.part(circ(sx, sy, 84, 72), { fill: C.red, gold: 0.1, order: 0.05, halo: 5 }); A.part(circ(sx, sy, 72, 72), { fill: { rad: [sx, sy, 0, 72], stops: ['#f0c352', C.gold, '#b8661f'] }, gold: 1, order: 0.02, halo: 4, lines: [{ strokes: [spiral(sx, sy, 58, 8, 0, 3.2, 90)], w: 5, taper: 0.1 }] });
        for (const k of [-1, 1]) { const cob = curve([[sx + k * 66, sy + 40], [sx + k * 104, sy + 62], [sx + k * 92, sy + 104], [sx + k * 116, sy + 130]]); A.part(limb(cob.filter((_, i) => i % 6 === 0), [16, 18, 20, 26, 15]), { fill: [C.green, C.turq], gold: 0.2, order: 0.35, lines: [{ strokes: Array.from({ length: 9 }, (_, i) => { const [x, y, a] = at(cob, 0.1 + i * 0.1); return line([x - Math.sin(a) * 12, y + Math.cos(a) * 12], [x + Math.sin(a) * 12, y - Math.cos(a) * 12]); }), w: 2 }] }); A.part(circ(sx + k * 116, sy + 148, 13), { fill: C.gold, order: 0.4 }); }
      });
      // sun rays with little hands of light
      for (let i = 0; i < 15; i++) { const a = Math.PI * (0.12 + 0.76 * i / 14), x = sx + Math.cos(a) * 96, y = sy + Math.sin(a) * 96, l = 130 + (i % 2) * 40; A.stroke(line([x, y], [x + Math.cos(a) * l, y + Math.sin(a) * l]), { w: 4, color: C.ochre, taper0: 0, taper1: 0.5, order: ['rad', sx, sy, 80, 270, 0.2, 0.7], halo: 1 }); }
      // ---- pyramids, each face coursed
      for (const [cx, w, h, o, c] of [[520, 420, 258, 0.15, [C.ochre, '#9a5f24']], [980, 560, 330, 0.3, [C.gold, '#b0712a']], [1420, 380, 232, 0.5, [C.ochre, '#9a5f24']]]) {
        const by = 640, ap = [cx, by - h], L = [cx - w / 2, by], R = [cx + w / 2, by], M = [cx + w * 0.16, by];
        const courses = (a, b) => Array.from({ length: Math.floor(h / 17) }, (_, i) => { const u = (i + 1) / Math.floor(h / 17); return line([lerp(ap[0], a[0], u) , lerp(ap[1], a[1], u)], [lerp(ap[0], b[0], u), lerp(ap[1], b[1], u)]); });
        const joints = []; const Rn = rng(cx); for (let i = 1; i < h / 17 - 1; i++) { const y = by - h + i * 17, hw = w / 2 * i * 17 / h; for (let x = cx - hw + Rn() * 30; x < cx + hw; x += 34 + Rn() * 26) joints.push(line([x, y], [x, y + 17])); }
        A.part(poly([ap, L, M]), { fill: c, halo: 4, order: ['lin', 0, by, 0, by - h, o, o + 0.3], lines: [{ strokes: courses(L, M), w: 3 }, { strokes: joints.filter(j => j[0][0] < cx + 20), w: 2.4 }] });
        A.part(poly([ap, M, R]), { fill: ['#8a5220', C.brick], halo: 3, order: ['lin', 0, by, 0, by - h, o, o + 0.3], lines: [{ strokes: courses(M, R), w: 3 }] });
        A.part(poly([ap, [cx - w * 0.06, by - h * 0.88], [cx + w * 0.02, by - h * 0.88], [cx + w * 0.06, by - h * 0.88]]), { fill: C.gold, gold: 1, raise: 1, order: o + 0.32 });
      }
      // palms between
      for (const [x, y, s, k] of [[232, 648, 1, 1], [740, 650, 0.8, -1], [1204, 650, 0.78, 1], [1690, 648, 1.02, -1]]) A.at({ x, y, s, sx: k }, () => { A.part(limb([[0, 0], [8, -80], [-4, -170]], [24, 16, 13]), { fill: [C.brick, '#4a2412'], order: 0.35, lines: [{ strokes: Array.from({ length: 12 }, (_, i) => curve([[-12, -8 - i * 14], [4, -2 - i * 14], [20, -8 - i * 14]])), w: 2.6 }] }); for (let i = 0; i < 9; i++) { const a = -Math.PI / 2 + (i - 4) * 0.42, l = 92 - Math.abs(i - 4) * 4; A.part(limb([[-4, -168], [-4 + Math.cos(a) * l * 0.6, -172 + Math.sin(a) * l * 0.75], [-4 + Math.cos(a) * l * 1.1, -158 + Math.sin(a) * l * 0.5 + 18]], [8, 24, 3]), { fill: i % 2 ? C.green : '#5f7a35', order: 0.45, lines: [{ flow: { gap: 8, w: 2, margin: 3, minLen: 8, field: [{ dir: a + 0.9 }] } }] }); } for (const dx of [-14, 6]) A.part(ell(dx, -150, 9, 15), { fill: C.red, order: 0.5 }); });
    });
    B.layer('river', A => {
      A.part(rect(70, 652, 1780, 128), { fill: [C.turq, C.lapis], halo: 5, order: ['lin', 70, 0, 1850, 0, 0, 0.7], lines: [{ strokes: Array.from({ length: 6 }, (_, j) => { const z = []; for (let i = 0; i <= 120; i++) z.push([60 + i * 15, 666 + j * 21 + (i % 2 ? 7 : -5)]); z.open = true; return z; }), w: 4 }] });
      const R = rng(3); for (const [x, y, k, c] of [[300, 742, 1, C.red], [800, 758, -1, C.gold], [1180, 700, 1, C.cream], [1560, 750, -1, C.red], [560, 700, 1, C.gold]]) A.at({ x, y, sx: k, s: 0.9 }, () => { A.part(blob([[-40, 0], [-14, -16], [20, -12], [38, 0], [20, 12], [-14, 15]]), { fill: c, order: 0.6, lines: [{ flow: { gap: 8, w: 2, margin: 3, minLen: 6, field: [{ dir: 1.3 }] } }] }); A.part(poly([[-34, 0], [-60, -16], [-54, 0], [-60, 16]]), { fill: c, order: 0.6 }); A.dots([[24, -4, 3]], { color: C.ink, order: 0.6, halo: 1.5 }); });
      for (const [x, s] of [[130, 0.7], [430, 0.55], [690, 0.5], [1080, 0.5], [1330, 0.55], [1730, 0.7]]) { A.part(ell(x + 30, 782, 34 * s, 9 * s), { fill: C.green, order: 0.7 }); lotus(A, x, 776, s, { order: 0.75 }); }
    });
    B.layer('marsh', A => {
      for (const [x, s] of [[360, 0.5], [420, 0.62], [470, 0.48], [1260, 0.5], [1310, 0.64], [1370, 0.5], [1600, 0.56], [1660, 0.46]]) papyrus(A, [[x, 786], [x + 4, 786 - 70 * s], [x + (x % 20) - 8, 786 - 150 * s]], s * 0.62, { order: x / 1920, halo: 3 });
      A.at({ x: 1010, y: 770, s: 0.9 }, () => { A.part(blob([[-120, -6], [-60, -24], [40, -26], [110, -18], [150, -4], [110, 4], [0, 10], [-90, 8]]), { fill: ['#34552f', '#22401f'], order: 0.6, lines: [{ flow: { gap: 9, w: 2.4, margin: 3, minLen: 8, field: [{ dir: 0 }, { vortex: [-20, -8, 20, 1], w: 1 }] } }] }); A.part(poly(Array.from({ length: 15 }, (_, i) => [-70 + i * 11, i % 2 ? -26 : -38]).concat([[90, -20], [-70, -20]])), { fill: '#22401f', order: 0.6, halo: 1 }); A.dots([[106, -12, 4]], { color: C.gold, halo: 2 }); });
      A.at({ x: 690, y: 764, s: 0.8 }, () => { A.part(blob([[-80, 10], [-84, -30], [-40, -52], [30, -50], [70, -56], [100, -44], [112, -20], [96, -4], [60, 0], [40, 14]]), { fill: ['#4a6a8c', '#274868'], order: 0.5, lines: [{ flow: { gap: 12, w: 3, margin: 4, field: [{ contour: 0.6 }, { vortex: [-30, -16, 26, 1], w: 1.4 }] } }] }); lotus(A, -20, -6, 0.3); A.dots([[78, -40, 4]], { color: C.ink, halo: 2 }); A.part(petal(60, -54, 16, 10, -1.7), { fill: '#274868', halo: 1.4 }); });
    });
    B.layer('register', A => {
      A.part(rect(70, 786, 1780, 12), { fill: C.brick, order: ['lin', 70, 0, 1850, 0, 0, 0.8] }); A.part(rect(70, 988, 1780, 10), { fill: C.brick, order: ['lin', 70, 0, 1850, 0, 0, 0.8] });
      // hieroglyph column + word panel
      [...'𓏌𓅱𓎛𓍢'].forEach((ch, i) => A.text(ch, 1650, 452 + i * 58, { font: '58px "Noto Sans Egyptian Hieroglyphs"', align: 'center', color: C.brick, bold: 1.4, order: 0.5 + i * 0.1, halo: 0 }));
      for (const [x, txt] of [[116, '𓇳𓈖𓂋𓏏𓆓𓋹𓇋'], [1804, '𓇳𓈖𓂋𓏏𓆓𓋹𓇋']]) [...txt].forEach((ch, i) => A.text(ch, x, 330 + i * 44, { font: '36px "Noto Sans Egyptian Hieroglyphs"', align: 'center', color: i % 3 === 0 ? C.red : C.ink, order: 0.3 + i * 0.06 }));
      const tri = (A, J) => A.part(poly([[J.haN[0] - 6, J.haN[1] - 10], [J.haN[0] + 60, J.haN[1] - 10], [J.haN[0] + 27, J.haN[1] - 34]]), { fill: C.gold });
      // static frieze people: scribe, harvest, offering bearers
      const F = (x, o, s = 0.5, k = 1) => A.at({ x, y: 986, s, sx: k }, () => A.with({ order: 0.25 + x / 1920 * 0.6, halo: 2.6 }, () => figure(A, o)));
      F(210, woman({ pose: { armN: [-40, -80], armF: [10, -60] }, hands: { N: 'cup', F: 'flat' } })); F(300, woman({ pose: { ...POSE.walk(0.2), armN: [20, -50], armF: [60, 0] }, front: (A, J) => lotus(A, J.haN[0] + 10, J.haN[1] - 20, 0.6) }));
      const harp = (A, J) => { const p = curve([[J.haN[0] - 70, 0], [J.haN[0] + 10, -40], [J.haN[0] + 46, -150], [J.haN[0] + 30, -300]]); A.part(limb(p.filter((_, i) => i % 6 === 0), [44, 30, 14, 12]), { fill: [C.red, C.gold], halo: 3 }); for (let i = 0; i < 8; i++) { const [x1, y1] = at(p, 0.5 + i * 0.06); A.stroke(line([x1, y1], [J.haN[0] - 60 + i * 13, -14 - i * 5]), { w: 2.4, color: C.ink, halo: 0.8 }); } };
      F(560, man({ pose: { ...POSE.walk(0.1), armN: [-74, -98], armF: [-66, -100] }, front: (A, J) => { A.part(blob([[J.haN[0] - 60, J.haN[1] - 16], [J.haN[0] + 44, J.haN[1] - 16], [J.haN[0] + 30, J.haN[1] - 64], [J.haN[0] - 46, J.haN[1] - 64]]), { fill: [C.green, C.gold], lines: [{ dots: Array.from({ length: 9 }, (_, i) => [J.haN[0] - 42 + i * 10, J.haN[1] - 40 + (i % 2) * 14, 5]) }] }); } }));
      F(650, woman({ pose: { ...POSE.walk(0.6), armN: [-20, -70], armF: [50, -10] }, front: (A, J) => lotus(A, J.haN[0] + 6, J.haN[1] - 14, 0.7) })); F(740, woman({ pose: { ...POSE.walk(0.2), armN: [34, -44], armF: [20, -64] }, front: (A, J) => harp(A, J) }));
      F(1010, man({ skin: SKIN.umber, pose: { ...POSE.walk(0.35), armN: [-50, -84], armF: [60, 30] }, hands: { N: 'grip', F: 'grip' }, front: (A, J) => { A.stroke(line([J.haN[0], J.haN[1] + 250], [J.haN[0] + 4, J.haN[1] - 60]), { w: 7, color: C.brick, halo: 2 }); lotus(A, J.haN[0] + 4, J.haN[1] - 56, 0.5); } }));
      F(1290, woman({ pose: { ...POSE.dance(0.2) }, lower: { len: 150, flare: 70, w: 28, sway: 16, folds: 3, scallop: 4, ...linen, bands: [{ at: 0.9, w: 14, color: C.red, motif: 'tri', ink: C.cream }] } })); F(1390, woman({ pose: { ...POSE.dance(0.7) }, lower: { len: 150, flare: 70, w: 28, sway: -16, folds: 3, scallop: 4, ...linen, bands: [{ at: 0.9, w: 14, color: C.lapis, motif: 'tri', ink: C.cream }] } }), 0.46, -1);
      F(1640, man({ pose: { ...POSE.walk(0.7), armN: [-70, -96], armF: [-60, -100] }, front: (A, J) => { A.part(blob([[J.haN[0] - 60, J.haN[1] - 20], [J.haN[0] + 40, J.haN[1] - 20], [J.haN[0] + 24, J.haN[1] - 60], [J.haN[0] - 44, J.haN[1] - 60]]), { fill: C.red, lines: [{ flow: { gap: 8, w: 2, field: [{ dir: 0.5 }] } }] }); } })); F(1730, woman({ pose: { armN: [10, -70], armF: [40, -20] } }), 0.46, -1);
    });
    B.layer('frame', A => {
      A.with({ halo: 0 }, () => P.frame(A, 14, 14, 1892, 1052, 58, (A, len, side) => {
        A.with({ order: ['lin', 0, 0, len, 0, 0, 1] }, () => {
          A.part(rect(-58, 0, len + 116, 58), { fill: C.cream, halo: 0 });
          const n = Math.round(len / 74), u = len / n; for (let i = 0; i < n; i++) { const cx = (i + 0.5) * u; for (const [a, l, w, c] of [[-2.35, 34, 14, C.green], [-0.8, 34, 14, C.green], [-2.0, 40, 14, C.turq], [-1.14, 40, 14, C.turq], [-1.57, 44, 16, C.red]]) A.part(petal(cx, 48, l, w, a), { fill: c, halo: 1.6 }); A.part(petal(cx + u / 2, 48, 34, 12, -1.57), { fill: C.lapis, halo: 1.6 }); }
          const m = Math.round(len / 26); for (let i = 0; i < m; i++) A.part(rect(i * len / m, 48, len / m - 3, 10), { fill: [C.lapis, C.red, C.turq, C.gold][i % 4], halo: 0 });
          A.part(rect(0, 0, len, 5), { fill: C.brick, halo: 0 });
        });
        A.part(rect(-58, 0, 58, 58), { fill: C.lapis, halo: 0, order: 0 }); for (const q of P.petals(-29, 29, 8, 3, 22, 12)) A.part([q], { fill: C.gold, halo: 1.4, gold: 1, order: 0 });
      }));
    });
    B.layer('reeds', A => { for (const [x, h, s, lean] of [[96, 420, 1.15, 30], [170, 330, 0.95, 44], [40, 300, 0.9, -8], [1830, 430, 1.15, -34], [1756, 330, 0.95, -44], [1890, 300, 0.9, 6]]) papyrus(A, [[x, 1010], [x + lean * 0.3, 1010 - h * 0.5], [x + lean, 1010 - h]], s, { order: ['lin', 0, 1010, 0, 1010 - h, 0, 1], halo: 4 }); });
    // boat with sail and rowers
    B.sprite('boat', { w: 460, h: 330, ox: 230, oy: 290, n: 8 }, (A, ph) => {
      const s = Math.sin(ph * TAU); A.part(limb([[-206, -84], [-170, -30], [-70, -2], [60, -2], [160, -30], [200, -92]], [6, 24, 44, 44, 24, 6]), { fill: ['#c98f35', '#8f5a20'], lines: [{ flow: { gap: 9, w: 2.4, margin: 4, field: [{ guide: curve([[-206, -84], [-170, -30], [-70, -2], [60, -2], [160, -30], [200, -92]]), w: 1, fall: 400 }] } }] }); for (const k of [-1, 1]) lotus(A, k > 0 ? 200 : -206, k > 0 ? -88 : -80, 0.42);
      A.part(rect(-4, -278, 9, 262), { fill: C.brick }); const bil = 16 + s * 7; A.part([spl([[-128, -272, 1], [0, -280], [120, -272, 1], [112 + bil, -190], [120, -110, 1], [0, -104 + bil * 0.5], [-124, -110, 1], [-112 + bil * 0.6, -190]], true, 10)], { fill: [C.white, '#dcc58c'], lines: [{ flow: { gap: 14, w: 2.6, margin: 5, field: [{ dir: 0.05 }, { guide: curve([[-120, -190], [0, -180 + bil], [120, -190]]), w: 1, fall: 200 }] } }, { strokes: [line([-124, -238], [118, -238]), line([-120, -146], [116, -146])], w: 14, ink: C.red }, { dots: Array.from({ length: 11 }, (_, i) => [-104 + i * 21, -238, 4]), ink: C.cream }] }); A.part(circ(0, -190, 26), { fill: C.gold, gold: 1, lines: [{ strokes: [spiral(0, -190, 20, 3, 0, 2, 40)], w: 3 }] }); A.part(rect(-132, -282, 256, 8), { fill: C.brick });
      for (let i = 0; i < 5; i++) { const x = -122 + i * 52; A.at({ x, y: -22, s: 0.3 }, () => figure(A, man({ pose: { ...POSE.sit, lean: 8 + s * 16, armN: [40 - s * 14, 20 + s * 10], armF: [44 - s * 14, 20 + s * 10] }, hands: 'grip', collar: null, belt: null }))); A.stroke(line([x + 16, -52], [x + 30 - s * 22, 26]), { w: 5, color: C.brick, halo: 1.6 }); A.part(blob([[x + 25 - s * 20, 14], [x + 36 - s * 24, 18], [x + 34 - s * 26, 40], [x + 26 - s * 24, 40]]), { fill: C.brick, halo: 1.5 }); }
    });
    B.sprite('ibis', { w: 220, h: 170, n: 8 }, (A, ph) => { const f = Math.sin(ph * TAU); const wing = (k, c) => A.part(limb([[-4, -6], [-18 + k * 6, -6 - f * 38], [-52 + k * 10, -10 - f * 66]], [30, 34, 6]), { fill: c, lines: [{ flow: { gap: 7, w: 2, margin: 3, field: [{ guide: curve([[-4, -6], [-18, -6 - f * 38], [-52, -10 - f * 66]]), w: 1, fall: 200 }] } }] }); wing(1, [C.cream, C.sand]); A.part(limb([[-74, 12], [-30, 4], [16, 0], [40, -12], [64, -10]], [6, 28, 26, 10, 9]), { fill: [C.white, C.cream], lines: [{ flow: { gap: 8, w: 2, margin: 3, field: [{ dir: -0.1 }] } }] }); A.stroke(curve([[66, -10], [86, -4], [98, 8]]), { w: 6, color: C.ink, taper1: 0.5 }); A.dots([[68, -12, 2.4]], { color: C.ink, halo: 1 }); A.part(limb([[-60, 12], [-86, 18], [-100, 14]], [12, 10, 3]), { fill: C.ink }); A.stroke(line([-50, 18], [-96, 30]), { w: 3, color: C.red }); wing(0, [C.white, C.cream]); });
    B.sprite('stretcher', { w: 300, h: 250, ox: 150, oy: 236, n: 8 }, (A, ph) => { const s = Math.sin(ph * TAU) * 0.5 + 0.5; A.at({ s: 0.52 }, () => figure(A, man({ pose: { lean: -10 - s * 14, legN: [64 - s * 10, 100], legF: [116 + s * 8, 92], armN: [10 + s * 6, -6], armF: [24 + s * 6, 4], head: 8 }, hands: 'grip' }))); });
    B.sprite('duck', { w: 190, h: 150, n: 8 }, (A, ph) => { const f = Math.sin(ph * TAU); A.part(limb([[-2, -2], [-10, -4 - f * 30], [-34, -8 - f * 54]], [26, 28, 5]), { fill: [C.lapis, '#122c4e'], lines: [{ flow: { gap: 7, w: 2, margin: 3, field: [{ guide: curve([[-2, -2], [-10, -4 - f * 30], [-34, -8 - f * 54]]), w: 1, fall: 200 }] } }] }); A.part(limb([[-54, 10], [-10, 4], [26, -4], [46, -14]], [8, 32, 18, 14]), { fill: [C.brick, C.red], lines: [{ flow: { gap: 8, w: 2, margin: 3, field: [{ dir: -0.1 }] } }] }); A.part(circ(50, -16, 12, 20), { fill: C.green }); A.part(poly([[58, -18], [78, -12], [58, -8]]), { fill: C.gold, halo: 1.4 }); A.dots([[52, -18, 3]], { color: C.cream, halo: 0.6 }); A.part(limb([[2, 0], [8, 10 - f * 28], [-12, 8 - f * 50]], [24, 24, 4]), { fill: [C.turq, '#1c6468'], lines: [{ flow: { gap: 7, w: 2, margin: 3, field: [{ dir: 1.4 }] } }] }); });
    B.sprite('cattle', { w: 320, h: 230, ox: 160, oy: 214, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); const leg = (x, k) => A.part(limb([[x, -84], [x + k * 8, -44], [x + k * 14, -4]], [26, 14, 12]), { fill: C.brick }); leg(-76, -s); leg(62, s); A.part(blob([[-110, -110], [-90, -146], [-20, -140], [50, -150], [90, -160], [118, -176], [146, -166], [160, -140], [146, -128], [118, -124], [96, -100], [80, -78], [0, -66], [-90, -74], [-112, -90]]), { fill: ['#8a3a1c', C.brick], lines: [{ flow: { gap: 12, w: 3, margin: 5, field: [{ contour: 0.7 }, { vortex: [-70, -108, 34, 1], w: 1.5 }, { vortex: [66, -112, 32, -1], w: 1.5 }] } }] }); leg(-92, s); leg(80, -s); A.stroke(curve([[126, -172], [118, -206], [142, -226]]), { w: 9, color: C.cream, taper1: 0.5 }); A.stroke(curve([[112, -170], [92, -200], [104, -224]]), { w: 9, color: C.cream, taper1: 0.5 }); A.dots([[134, -152, 4]], { color: C.ink, halo: 2 }); A.stroke(curve([[-110, -130], [-130, -90], [-122, -50]]), { w: 6, color: C.brick, taper1: 0.3 }); });
    B.sprite('shimmer', { w: 1780, h: 128, ox: 0, oy: 0, n: 4, res: 0.6 }, (A, ph, i) => { for (let j = 0; j < 5; j++) for (let q = 0; q < 16; q++) { const x = (q * 118 + j * 47 + i * 29) % 1740 + 20; A.stroke(line([x, 16 + j * 22], [x + 34, 16 + j * 22]), { w: 4, color: C.white, taper: 0.4, gold: 0.6 }); } });
  },
  from: 'left', to: 'right', sfx: [{ t: 1.25, s: 'twang' }, { t: 1.9, s: 'shimmer' }, { t: 0.7, s: 'splash' }],
  draw(g, t) {
    const rv = (a, b) => seg(t, a, b, ease.out2);
    g.ground({ color: '#dfbd78', x: 14, y: 14, w: 1892, h: 1052, rv: rv(0, 0.9), mode: 5, rvp: [0, 540, 0, 2100], noise: 0.25 });
    g.layer('ground', { rv: rv(0.2, 1.2), mode: 5, rvp: [0, 540, 0, 2100], glow: 0.2 });
    g.layer('back', { rv: rv(0.5, 2.3) });
    g.layer('river', { rv: rv(0.15, 1.5), glow: 0.7 });
    if (t > 1.2) g.sprite('shimmer', { x: 70, y: 652, ph: t * 1.4, alpha: 0.35 * seg(t, 1.2, 2) });
    g.sprite('boat', { x: 560 + t * 92, y: 742 + Math.sin(t * 2.2) * 4, r: Math.sin(t * 1.7) * 0.015, ph: t * 0.8, rv: rv(0.7, 1.7) });
    g.sprite('boat', { x: 1500 + t * 34, y: 716 + Math.sin(t * 2 + 2) * 3, s: 0.56, ph: t * 0.8 + 0.4, rv: rv(1, 2) });
    g.layer('marsh', { rv: rv(0.6, 1.9) });
    g.layer('register', { rv: rv(0.3, 1.8) });
    for (let i = 0; i < 2; i++) g.sprite('cattle', { x: 880 + i * 190 + t * 22, y: 990, s: 0.62, ph: t * 0.9 + i * 0.3, rv: rv(0.8 + i * 0.1, 1.6 + i * 0.1) });
    // the rope
    const pull = seg(t, 1.0, 1.45, ease.outBack), sag = (1 - pull) * 60, xa = 455, xb = 1515, y = 884;
    g.sprite('stretcher', { x: xa - 62, y: 988, flip: true, ph: 0.25 + 0.5 * pull + Math.sin(t * 5) * 0.03, rv: rv(0.2, 0.9) });
    g.sprite('stretcher', { x: xb + 62, y: 988, ph: 0.25 + 0.5 * pull + Math.sin(t * 5) * 0.03, rv: rv(0.5, 1.2) });
    for (let i = 0; i < 9; i++) { const u = (t * 0.10 + i * 0.047 + (i % 3) * 0.01); const x = -60 + ((u * 2100 + i * 30) % 2100), yy = 360 + Math.sin(i * 1.7) * 60 + Math.sin(t * 1.3 + i) * 14 - (i % 3) * 34; g.sprite('ibis', { x, y: yy, s: 0.5 + (i % 3) * 0.08, ph: t * 1.5 + i * 0.21, rv: rv(0.9 + i * 0.05, 1.7 + i * 0.05), lift: 14 }); }
    for (let i = 0; i < 12; i++) { const k = seg(t, 0.9 + i * 0.06, 2.4 + i * 0.06, ease.out2), x = lerp(400 + (i % 4) * 22, 240 + i * 150 + t * 60, k), yy = lerp(720, 420 + (i % 4) * 46 + Math.sin(t * 2 + i) * 8, k); g.sprite('duck', { x, y: yy, s: 0.5 + (i % 3) * 0.06, ph: t * 2.2 + i * 0.17, rv: rv(0.8 + i * 0.05, 1.4 + i * 0.05), lift: 10 * k }); }
    g.layer('frame', { rv: rv(0, 1.3) });
    g.layer('reeds', { rv: rv(0.4, 1.6), r: Math.sin(t * 1.1) * 0.004, cx: 960, cy: 1010 });
    const pts = []; for (let i = 0; i <= 160; i++) { const u = i / 160, x = lerp(-120, 2040, u); const k = clamp((x - xa) / (xb - xa)); const inR = x > xa && x < xb; const yy = inR ? y + Math.sin(k * Math.PI) * sag + Math.sin(k * 40 - t * 60) * 5 * Math.exp(-Math.max(0, t - 1.35) * 5) * (t > 1.2 ? 1 : 0) : x <= xa ? lerp(y - 60 + Math.sin(u * 30 + t * 2) * 26, y, clamp((x + 120) / (xa + 120)) ** 2) : lerp(y, y - 80 + Math.sin(u * 22 - t * 2) * 26, clamp((x - xb) / 400)); pts.push([x, yy, 10 + (inR ? 6 : 20 + 16 * Math.sin(u * 20 + t))]); }
    const head = seg(t, 0, 1.0, ease.inOut2) * 0.74 + seg(t, 1.5, 2.2, ease.in) * 0.26; g.thread(pts, { w: 10, hero: 1, f1: head, spark: 1 });
    // knots on the rope
    for (let i = 0; i <= 12; i++) { const k = i / 12, x = lerp(xa, xb, k), u = (x + 120) / 2160; if (head < u) continue; const yy = y + Math.sin(k * Math.PI) * sag; g.thread([[x - 7, yy - 6, 16], [x - 2, yy + 8, 20], [x + 4, yy - 8, 20], [x + 8, yy + 6, 16]], { w: 8, hero: 1 }); }
    // taut → golden plumb lines rise and become the pyramid edges
    if (t > 1.35) { const r = seg(t, 1.4, 2.1, ease.inOut2), a = 1 - seg(t, 2.5, 3.1); if (a > 0) for (const [x0, ax, ay, x1] of [[310, 520, 382, 730], [700, 980, 310, 1260], [1230, 1420, 408, 1610]]) { g.thread([[x0, y - 10, 8], [x0, 640, 10], [ax, ay, 14], [x1, 640, 10], [x1, y - 10, 8]].flatMap((p, i, q) => i < q.length - 1 ? Array.from({ length: 14 }, (_, j) => [0, 1, 2].map(d => lerp(p[d], q[i + 1][d], j / 14))) : [p]), { w: 4.5, hero: 1, f1: r, spark: 1, glow: 1.6, alpha: a, shadow: 0.3 }); } }
    g.burst(xa, y, 1.35, { n: 26, speed: 200, seed: 4 }); g.burst(xb, y, 1.35, { n: 26, speed: 200, seed: 9 });
    for (const [i, q] of [[0, [520, 382]], [1, [980, 310]], [2, [1420, 408]]]) g.burst(q[0], q[1], 1.95 + i * 0.06, { n: 40, speed: 260, seed: 20 + i, life: 1.1 });
    g.drift({ n: 70, vx: 14, vy: -10, col: [1.2, 0.85, 0.4], a: 0.5, size: 2.4 });
  },
  shots: [
    { end: 1.25, cam: (p, t) => ({ x: lerp(420, 760, ease.inOut2(p)), y: lerp(860, 800, p), w: lerp(820, 1000, p), tilt: 0.24, yaw: -0.08, aperture: 4 }) },
    { end: 3.125, cam: (p, t) => ({ x: lerp(900, 985, ease.out2(p)), y: lerp(520, 545, p), w: lerp(1420, 1830, ease.out(p)), tilt: lerp(0.12, 0.05, p), aperture: 2 }) },
    { end: 5, cam: (p, t) => ({ x: lerp(1160, 760, ease.inOut2(p)), y: lerp(250, 300, p), w: lerp(700, 860, p), tilt: 0.3, yaw: lerp(0.14, -0.1, p), aperture: 5 }) },
  ],
};
