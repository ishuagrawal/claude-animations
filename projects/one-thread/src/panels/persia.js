// Persia — knotted carpet. The thread draws a 16-point girih star in one unbroken line ({16/5} is a single closed path),
// the star blooms into a paradise garden, and the weaver's comb beats the carpet up row by row.
import { spl, blob, poly, rect, rrect, limb, circ, ell, ring, arc, arcBand, curve, line, spiral, petal, star, ngon, T, at, sub, offset, wavy, mirrorX, lerp, clamp, TAU, rng } from '../art/geom.js';
import * as P from '../art/patterns.js';
import { figure, joints, SKIN, POSE, pol } from '../art/figures.js';
import { seg, ease, hash } from '../core.js';

const C = { crim: '#a8152b', wine: '#6a0c20', lapis: '#1c357f', night: '#0d1842', ivory: '#f2e2ba', cream: '#dcc48c', rose: '#dc7182', saff: '#e8a521', ochre: '#b97420', pist: '#93b45c', leaf: '#3f7440', turq: '#25a39d', teal: '#0d6670', brown: '#4a2110', ink: '#1a0d16', camel: '#b4702c' };
const UP = ['lin', 0, 1066, 0, 14, 0, 1], MX = 960, MY = 509, MR = 296;
const V = k => { const a = -Math.PI / 2 + k * TAU / 16; return [MX + Math.cos(a) * MR, MY + Math.sin(a) * MR]; };
const starPath = Array.from({ length: 17 }, (_, s) => V((s * 5) % 16));
const L2 = (a, b, n = 10) => { const o = []; for (let i = 0; i <= n; i++) o.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); o.open = true; return o; };

// every carpet motif is drawn inside a dark outline: grow the silhouette behind what is already painted
function outline(A, r = 4.5, col = C.ink) { const c = A.main, k = new OffscreenCanvas(c.width, c.height), x = k.getContext('2d'); x.drawImage(c, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); const m = A.m; m.save(); m.setTransform(1, 0, 0, 1, 0, 0); m.globalCompositeOperation = 'destination-over'; const d = r * A.s; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; m.drawImage(k, Math.cos(a) * d, Math.sin(a) * d); } m.drawImage(k, 0, 0); m.restore(); }
// ---- carpet ornament, drawn bold: one knot is five units ------------------------------------------------
function rosette(A, x, y, r, c = [C.ivory, C.crim, C.saff], n = 8, o = {}) { A.part(circ(x, y, r * 1.04, 24), { fill: c[3] || c[1], halo: 2, ...o }); for (const q of P.petals(x, y, n, r * 0.2, r * 0.76, r * 2.1 / n * 1.5)) A.part([q], { fill: c[0], halo: 0, ...o }); A.part(circ(x, y, r * 0.44, 18), { fill: c[1], halo: 1, ...o }); A.part(circ(x, y, r * 0.24, 14), { fill: c[2], halo: 0, ...o }); }
function palmette(A, x, y, s, r = 0, c = [C.crim, C.ivory, C.saff, C.turq], o = {}) {
  A.at({ x, y, s, r }, () => {
    for (const k of [-1, 1]) A.part(limb([[0, 36], [k * 24, 42], [k * 50, 26], [k * 50, 0], [k * 38, -6]], [10, 18, 20, 14, 5]), { fill: c[3], halo: 3, ...o });
    for (let i = 0; i < 7; i++) { const j = i % 2 ? (i + 1) / 2 : -i / 2, a = -Math.PI / 2 + j * 0.56, l = 68 - Math.abs(j) * 6; A.part(petal(0, 16, l, 38, a, 0.74), { fill: c[0], halo: 2.5, ...o }); }
    A.part(petal(0, 18, 52, 56, -Math.PI / 2, 0.6), { fill: c[1], halo: 3, ...o }); A.part(petal(0, 18, 34, 30, -Math.PI / 2, 0.55), { fill: c[2], halo: 2.5, ...o }); A.part(circ(0, 16, 14, 18), { fill: c[3], halo: 2.5, ...o });
  });
}
function lotus(A, x, y, s, r, c = [C.rose, C.ivory, C.crim], o = {}) { A.at({ x, y, s, r }, () => { for (const [a, l, w, k] of [[-2.7, 40, 22, 2], [-0.44, 40, 22, 2], [-2.25, 50, 22, 0], [-0.89, 50, 22, 0], [-1.86, 58, 22, 1], [-1.28, 58, 22, 1], [-1.57, 62, 20, 0]]) A.part(petal(0, 12, l, w, a), { fill: c[k], halo: 1.8, ...o }); A.part(ell(0, 14, 17, 10), { fill: C.saff, halo: 1.5, ...o }); }); }
// split-leaf (islimi) scroll: stem spiral ending in a forked leaf
function islimi(A, x, y, s, r, k, c = [C.saff, C.turq, C.ivory], o = {}) {
  A.at({ x, y, s, r, sy: k }, () => {
    const sp = spiral(58, -40, 70, 14, 2.45, 1.25, 40); A.stroke(curve([[0, 0], [10, 14], ...sp.filter((_, i) => i % 4 === 0)]), { w: 9, color: c[0], halo: 2, ...o });
    for (const [u, l, d] of [[0.1, 40, -1], [0.32, 40, 1], [0.55, 32, -1], [0.75, 26, 1]]) { const [lx, ly, la] = at(sp, u); A.part(limb([[lx, ly], pol([lx, ly], (la + d * 0.9) * 57.3, l * 0.6), pol([lx, ly], (la + d * 0.2) * 57.3, l * 1.15)], [7, 17, 4]), { fill: d > 0 ? c[1] : c[2], halo: 2, ...o }); }
    rosette(A, 58, -40, 22, [c[2], C.crim, C.saff], 6, o);
  });
}
function cypress(A, x, y, h, w, o = {}) { const lean = o.lean || 0; A.part(rect(x - 5, y - 18, 10, 18), { fill: C.brown, halo: 2, ...o }); const p = [spl([[x, y - 8, 1], [x + w * 0.42, y - h * 0.16], [x + w * 0.5, y - h * 0.36], [x + w * 0.36, y - h * 0.64], [x + w * 0.12 + lean * 0.4, y - h * 0.9], [x + lean, y - h, 1], [x - w * 0.16 + lean * 0.3, y - h * 0.86], [x - w * 0.36, y - h * 0.64], [x - w * 0.5, y - h * 0.36], [x - w * 0.42, y - h * 0.16]], true, 10)]; A.part(p, { fill: [C.leaf, '#1d4a36'], halo: 3, ...o, lines: [{ strokes: [-1, 1].flatMap(k => [0, 1, 2, 3, 4, 5].map(i => curve([[x + lean * 0.2, y - h * (0.16 + i * 0.125)], [x + k * w * 0.16, y - h * (0.2 + i * 0.125)], [x + k * w * 0.4, y - h * (0.14 + i * 0.125)]]))), w: 5, ink: C.pist }] }); }
function flower(A, x, y, r, c, o = {}) { for (const q of P.petals(x, y, 5, r * 0.12, r, r * 0.96, x * 0.3)) A.part([q], { fill: c, halo: 1.2, ...o }); A.part(circ(x, y, r * 0.32, 10), { fill: C.saff, halo: 0, ...o }); }
function sprig(A, x, y, s, c, r = 0, o = {}) { A.at({ x, y, s, r }, () => { A.stroke(curve([[0, 20], [3, 0], [0, -22]]), { w: 5, color: '#5f8a4a', halo: 0, ...o }); for (const k of [-1, 1]) A.part(petal(0, 10, 24, 11, -Math.PI / 2 + k * 0.95), { fill: '#5f8a4a', halo: 0, ...o }); flower(A, 0, -22, 14, c, o); }); }
const arch = (cx, by, w, h, n = 14) => { const hw = w / 2, sy = by - h + hw * 1.02, o = [[cx - hw, by], [cx - hw, sy]]; for (let i = 1; i <= n; i++) { const u = i / n; o.push([cx - hw + hw * Math.pow(u, 1.5) * 0.98 + 0.02 * hw * u, sy - (by - h === sy ? 0 : (sy - (by - h))) * Math.sin(u * Math.PI / 2) ** 0.92]); } const m = o.slice(0, -1).reverse().map(([x, y]) => [2 * cx - x, y]); return [...o, ...m]; };
// ---- architecture
function mosque(A, cx, k) {
  A.at({ x: cx, y: 0, sx: k }, () => {
    const by = 470, o = {};
    // side arcades
    for (const [x0, w, n] of [[-262, 130, 2], [132, 130, 2]]) { A.part(rect(x0, by - 112, w, 112), { fill: [C.ivory, C.camel], halo: 3 }); A.part(rect(x0, by - 112, w, 16), { fill: C.lapis, halo: 0, lines: [{ dots: Array.from({ length: 7 }, (_, i) => [x0 + 10 + i * w / 6.6, by - 104, 5]), ink: C.saff }] }); for (let i = 0; i < n; i++) { const X = x0 + (i + 0.5) * w / n; A.part([arch(X, by, w / n - 22, 84)], { fill: [C.turq, C.teal], halo: 3 }); A.part([arch(X, by, w / n - 40, 56)], { fill: C.night, halo: 2 }); } }
    // drum + dome
    A.part(rect(-66, 250, 132, 46), { fill: C.lapis, halo: 3, lines: [{ strokes: P.zigzag(-70, 262, 140, 22, 6), w: 6, ink: C.ivory }] });
    const dome = [spl([[-66, 252, 1], [-88, 226], [-92, 196], [-70, 160], [-30, 136], [0, 118, 1], [30, 136], [70, 160], [92, 196], [88, 226], [66, 252, 1]], true, 12)];
    const rib = (f, w) => curve([[f * 66, 252], [f * 92, 206], [f * 62, 160], [0, 120]]);
    A.part(dome, { fill: { rad: [-30, 180, 10, 130], stops: ['#2fada4', C.turq, C.teal] }, halo: 4, raise: 0.5, lines: [{ strokes: [-0.72, -0.4, 0.4, 0.72].map(f => rib(f)), w: 6, ink: C.lapis }, { strokes: [curve([[-92, 222], [0, 236], [92, 222]])], w: 14, ink: C.ivory }, { dots: Array.from({ length: 8 }, (_, i) => [-80 + i * 23, 224 + Math.sin(i / 7 * Math.PI) * 8, 5]), ink: C.crim }, { shape: [-1, 0, 1].flatMap(i => star(i * 48, 190 - (i ? 0 : 8), i ? 15 : 20, i ? 7 : 9, 8)), ink: C.saff }] });
    A.part(rect(-4, 84, 8, 38), { fill: C.saff, gold: 1, halo: 2 }); A.part(circ(0, 100, 10, 16), { fill: C.saff, gold: 1, halo: 1 }); A.part(circ(0, 84, 7, 12), { fill: C.saff, gold: 1, halo: 1 });
    // pishtaq
    A.part(rect(-124, 284, 248, 186), { fill: C.lapis, halo: 4 }); A.part(rect(-124, 284, 248, 186), { fill: C.lapis, halo: 0, lines: [{ strokes: [line([-112, 470], [-112, 296], [112, 296], [112, 470])], w: 7, ink: C.saff }, { dots: [...Array.from({ length: 11 }, (_, i) => [-92 + i * 18.4, 313, 6]), ...Array.from({ length: 8 }, (_, i) => [-94, 330 + i * 18.4, 6]), ...Array.from({ length: 8 }, (_, i) => [94, 330 + i * 18.4, 6])], ink: C.turq }] });
    A.part(rect(-80, 326, 160, 144), { fill: C.turq, halo: 3 }); for (const s of [-1, 1]) { A.stroke(spiral(s * 58, 346, 15, 4, 0, s * 1.3, 24), { w: 6, color: C.ivory, halo: 0 }); }
    const ar = arch(0, 470, 136, 138); A.part([ar], { fill: [C.saff, C.ochre], halo: 4, gold: 0.3 });
    for (let j = 0; j < 4; j++) { const sc = 1 - j * 0.2, pl = ar.map(([x, y]) => [x * sc, 470 - (470 - y) * (1 - j * 0.17)]); pl.open = true; const n = 11 - j * 2; A.part([pl], { fill: [C.ivory, C.lapis, C.ivory, C.turq][j], halo: 2 }); for (let i = 0; i < n; i++) { const [x, y] = at(pl, lerp(0.24, 0.76, i / (n - 1))); A.part(circ(x * 0.93, y + 8, 10, 14), { fill: i % 2 ? [C.turq, C.ivory, C.crim, C.ivory][j] : [C.lapis, C.saff, C.turq, C.saff][j], halo: 1 }); } }
    A.part([arch(0, 470, 50, 62)], { fill: [C.wine, C.ink], halo: 3 }); A.part([arch(0, 470, 24, 40)], { fill: C.saff, halo: 2, gold: 0.6 });
    for (const x of [-124, 124]) { A.part(rect(x - 12, 272, 24, 198), { fill: C.ivory, halo: 3, lines: [{ strokes: Array.from({ length: 13 }, (_, i) => line([x - 16, 296 + i * 16], [x + 16, 280 + i * 16])), w: 6, ink: C.turq }] }); A.part([arch(x, 274, 26, 34)], { fill: C.turq, halo: 2 }); }
    // minarets
    for (const x of [-196, 196]) { A.part(poly([[x - 21, 470], [x - 15, 214], [x + 15, 214], [x + 21, 470]]), { fill: C.cream, halo: 4, lines: [{ strokes: Array.from({ length: 11 }, (_, i) => line([x - 26, 250 + i * 25], [x + 26, 226 + i * 25])), w: 8, ink: C.turq }, { strokes: Array.from({ length: 11 }, (_, i) => line([x - 26, 262 + i * 25], [x + 26, 238 + i * 25])), w: 5, ink: C.lapis }] }); A.part(poly([[x - 16, 216], [x - 28, 196], [x + 28, 196], [x + 16, 216]]), { fill: C.saff, halo: 2, lines: [{ strokes: [line([x - 10, 216], [x - 14, 196]), line([x + 10, 216], [x + 14, 196]), line([x, 216], [x, 196])], w: 5, ink: C.crim }] }); A.part(rect(x - 14, 164, 28, 34), { fill: C.lapis, halo: 2, lines: [{ strokes: [line([x - 5, 170], [x - 5, 196]), line([x + 5, 170], [x + 5, 196])], w: 5, ink: C.saff }] }); A.part([spl([[x - 18, 166, 1], [x - 20, 150], [x, 126, 1], [x + 20, 150], [x + 18, 166, 1]], true, 8)], { fill: C.turq, halo: 2 }); A.part(circ(x, 122, 6, 10), { fill: C.saff, gold: 1, halo: 1 }); }
  });
}
// ---- people: carpet-scale heads and robes
function head(A, x, y, { s = 1, skin = SKIN.wheat, turban = C.ivory, plume = C.crim, hat = 'turban', hairC = C.ink, tilt = 0, beard = 0 } = {}) {
  A.at({ x, y, s, r: tilt }, () => {
    if (hat === 'veil') A.part(blob([[-36, 46], [-40, 0], [-24, -42], [8, -46], [34, -26], [20, -10], [-4, 20], [-8, 50]]), { fill: turban, halo: 3 });
    A.part([spl([[-18, -26], [12, -32], [29, -14], [30, 0], [36, 11, 1], [28, 15], [28, 26], [16, 37], [2, 34], [0, 54], [-22, 54], [-22, 20], [-28, 0]], true, 8)], { fill: skin[1], halo: 3 });
    A.part(blob([[-26, -20], [-6, -34], [16, -32], [2, -16], [-6, 4], [-10, 26], [-24, 30], [-32, 4]]), { fill: hairC, halo: 0 });
    if (beard) A.part(blob([[-4, 18], [14, 24], [28, 22], [26, 44], [12, 56], [0, 42]]), { fill: beard === 2 ? C.ivory : hairC, halo: 0 });
    A.part(ell(16, -2, 8.5, 5), { fill: C.ink, halo: 0 }); A.stroke(curve([[4, -13], [16, -18], [29, -13]]), { w: 6, color: C.ink, halo: 0 }); A.part(ell(27, 25, 6, 4), { fill: C.crim, halo: 0 });
    if (hat === 'turban') { A.part(blob([[-40, -18], [-34, -50], [0, -64], [34, -48], [38, -24], [14, -22], [-14, -14]]), { fill: turban, halo: 3, lines: [{ strokes: [curve([[-34, -22], [-6, -46], [34, -44]]), curve([[-18, -14], [10, -30], [38, -30]])], w: 5, ink: plume }] }); A.part(limb([[-6, -58], [-12, -86], [-30, -98]], [10, 14, 5]), { fill: plume, halo: 2 }); A.part(circ(-2, -56, 7, 12), { fill: C.saff, halo: 1, gold: 1 }); }
    else if (hat === 'crown') { A.part(poly([[-34, -24], [-36, -58], [-16, -42], [0, -68], [18, -44], [38, -56], [32, -22]]), { fill: C.saff, gold: 1, halo: 3 }); A.dots([[0, -38, 6], [-20, -34, 5], [20, -34, 5]], { color: C.crim, halo: 0 }); }
    else if (hat === 'veil') { A.part(blob([[-32, -10], [-20, -44], [10, -46], [32, -26], [12, -24], [-12, -10], [-18, 20], [-32, 20]]), { fill: turban, halo: 0 }); A.stroke(curve([[-28, -16], [-6, -34], [28, -24]]), { w: 7, color: plume, halo: 0 }); }
  });
}
// seated person (kneeling on carpet). returns hand anchors through cb
function sitter(A, x, y, s, k, { robe = [C.crim, C.wine], sleeve, trim = C.saff, skin = SKIN.wheat, armN = [40, -10], armF = [30, -14], h = {}, mot = C.saff, back, front } = {}) {
  A.at({ x, y, s, sx: k }, () => {
    const shN = [8, -156], shF = [-14, -158], el = pol(shN, armN[0], 58), ha = pol(el, armN[1], 54), ef = pol(shF, armF[0], 58), hf = pol(ef, armF[1], 54);
    back?.(A, { ha, hf, el });
    A.part(limb([shF, ef, hf], [30, 30, 24]), { fill: sleeve || robe, halo: 3 }); A.part(circ(hf[0], hf[1], 13, 16), { fill: skin[1], halo: 2 });
    A.part([spl([[-36, -150], [-14, -176], [10, -176], [30, -152], [36, -100], [40, -62], [96, -50], [112, -20], [96, 0, 1], [-66, 0, 1], [-74, -26], [-52, -62], [-44, -110]], true, 10)], { fill: robe, halo: 3, lines: [{ strokes: [curve([[36, -60], [-6, -40], [-50, -46]]), curve([[92, -24], [20, -18], [-60, -20]])], w: 7, ink: trim }, { dots: [[-14, -120, 8], [10, -92, 8], [-22, -78, 8], [60, -34, 8], [18, -56, 8]], ink: mot }, { strokes: [line([-4, -176], [4, -66])], w: 9, ink: trim }] });
    A.part(limb([[-44, -64], [0, -56], [40, -66]], [16]), { fill: trim, halo: 2 });
    head(A, 0, -212, { s: 0.92, skin, ...h });
    A.part(limb([shN, el, ha], [34, 32, 26]), { fill: sleeve || robe, halo: 3, lines: [{ strokes: [line(pol([lerp(shN[0], el[0], 0.4), lerp(shN[1], el[1], 0.4)], armN[0] + 90, 30), pol([lerp(shN[0], el[0], 0.4), lerp(shN[1], el[1], 0.4)], armN[0] - 90, 30))], w: 8, ink: trim }] }); A.part(circ(ha[0], ha[1], 14, 16), { fill: skin[1], halo: 2 });
    front?.(A, { ha, hf, el });
  });
}
// ---- beasts
const legP = (A, x, y, a, b, l1, l2, w, fill, hoof = C.ink, o = {}) => { const k = pol([x, y], a, l1), f = pol(k, a + b, l2); A.part(limb([[x, y], k, f], [w, w * 0.62, w * 0.46], { seg: 6 }), { fill, halo: 2.2, ...o }); A.part(circ(f[0] + 2, f[1], w * 0.32, 10), { fill: hoof, halo: 0, ...o }); };
const gallop = (ph, q, hind) => { const a = (ph + q) * TAU, s = Math.sin(a), c = Math.cos(a); return hind ? [98 - s * 40, (c > 0 ? 34 : -14) + s * 10] : [86 - s * 44, (c > 0 ? c * 70 : 4)]; };
const walkL = (ph, q, hind) => { const a = (ph + q) * TAU, s = Math.sin(a), c = Math.cos(a); return [90 - s * 20 + (hind ? 4 : 0), (hind ? -4 : 3) + Math.max(0, c) * 26]; };
function horse(A, ph, { col = [C.ivory, C.cream], mane = C.crim, cloth = C.lapis } = {}) {
  const bob = Math.sin(ph * TAU) * 6, r = Math.cos(ph * TAU) * 0.06; A.at({ y: bob, r }, () => {
    const dark = Array.isArray(col) ? col[1] : col; legP(A, 62, -92, ...gallop(ph, 0.14), 46, 46, 30, dark); legP(A, -70, -94, ...gallop(ph, 0.62, 1), 48, 48, 36, dark);
    A.part(limb([[-100, -116], [-138, -112 + Math.sin(ph * TAU) * 14], [-164, -86 + Math.sin(ph * TAU + 1) * 18], [-186, -84]], [16, 26, 24, 6]), { fill: mane, halo: 3 });
    A.part([spl([[-110, -110], [-96, -136], [-50, -136], [10, -126], [56, -140], [84, -176], [104, -200], [118, -198, 1], [126, -186], [160, -164], [162, -150], [146, -148], [120, -156], [108, -130], [94, -90], [60, -68], [0, -72], [-60, -66], [-100, -78]], true, 9)], { fill: col, halo: 3, lines: [{ strokes: [spiral(-78, -100, 24, 6, 0, 1.2, 24), spiral(76, -100, 18, 5, 2, -1.2, 22)], w: 6, ink: mane }] });
    A.part([spl([[60, -142], [80, -190], [106, -204], [100, -180], [88, -150], [76, -134]], true, 7)], { fill: mane, halo: 2 }); A.part(circ(128, -174, 5, 10), { fill: C.ink, halo: 0 }); A.stroke(curve([[150, -158], [120, -150], [60, -126]]), { w: 5, color: C.saff, halo: 0 }); A.stroke(line([132, -184], [142, -150]), { w: 5, color: C.saff, halo: 0 });
    A.part(blob([[-44, -140], [30, -134], [34, -104], [20, -86], [-30, -86], [-48, -110]]), { fill: cloth, halo: 2.5, lines: [{ strokes: [line([-40, -96], [28, -96])], w: 7, ink: C.saff }, { dots: [[-22, -116, 7], [2, -114, 7]], ink: C.rose }] });
    legP(A, 84, -92, ...gallop(ph, 0), 46, 46, 32, col); legP(A, -84, -96, ...gallop(ph, 0.5, 1), 50, 48, 40, col);
  }); return bob;
}
function gazelle(A, ph, col = ['#d99a4c', C.camel]) { const b = Math.sin(ph * TAU) * 8; A.at({ y: b, r: Math.cos(ph * TAU) * 0.07 }, () => { legP(A, 40, -66, ...gallop(ph, 0.14), 34, 36, 18, C.ochre); legP(A, -46, -66, ...gallop(ph, 0.6, 1), 36, 36, 22, C.ochre); A.part([spl([[-76, -82], [-60, -98], [-10, -92], [34, -98], [56, -130], [66, -142], [80, -142], [104, -126], [102, -117], [82, -116], [74, -86], [56, -58], [10, -52], [-40, -52], [-66, -60]], true, 8)], { fill: col, halo: 3, lines: [{ dots: [[-40, -80, 5], [-20, -74, 5], [0, -82, 5], [20, -74, 5], [-54, -70, 5]], ink: C.ivory }] }); A.part(limb([[-74, -82], [-88, -94], [-92, -84]], [8, 10, 4]), { fill: C.ivory, halo: 2 }); A.part(limb([[66, -138], [50, -152], [44, -144]], [10, 12, 4]), { fill: col[1], halo: 2 }); A.stroke(curve([[74, -142], [62, -172], [72, -198]]), { w: 7, color: C.ink, halo: 2 }); A.stroke(curve([[82, -142], [82, -170], [94, -190]]), { w: 6, color: C.ink, halo: 2 }); A.part(circ(86, -130, 4, 10), { fill: C.ink, halo: 0 }); legP(A, 54, -66, ...gallop(ph, 0), 34, 36, 18, col); legP(A, -56, -68, ...gallop(ph, 0.5, 1), 38, 36, 24, col); }); }
function lion(A, ph) { const b = Math.sin(ph * TAU) * 6, w = Math.sin(ph * TAU); A.at({ y: b, r: Math.cos(ph * TAU) * 0.05 }, () => { legP(A, 50, -62, ...gallop(ph, 0.14), 34, 32, 30, C.ochre, C.ochre); legP(A, -64, -66, ...gallop(ph, 0.6, 1), 36, 34, 36, C.ochre, C.ochre); A.stroke(curve([[-92, -84], [-128, -92 + w * 8], [-144, -124 + w * 10], [-128, -142 + w * 10]]), { w: 12, color: C.saff, halo: 2.5 }); A.part(blob([[-126, -154 + w * 10], [-108, -146 + w * 10], [-118, -128 + w * 10], [-138, -136 + w * 10]]), { fill: C.wine, halo: 2 }); A.part([spl([[-100, -86], [-80, -110], [-20, -102], [40, -112], [80, -108], [92, -80], [70, -52], [10, -46], [-50, -48], [-90, -58]], true, 8)], { fill: [C.saff, C.ochre], halo: 3, lines: [{ strokes: [spiral(-70, -78, 20, 5, 0, 1.2, 22)], w: 6, ink: C.wine }] }); A.part(circ(84, -106, 46, 30), { fill: C.wine, halo: 3 }); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; A.part(petal(84 + Math.cos(a) * 26, -106 + Math.sin(a) * 26, 30, 20, a + 0.4), { fill: i % 2 ? C.crim : C.ochre, halo: 1 }); } A.part([spl([[58, -128], [86, -138], [112, -124], [134, -104], [130, -90], [106, -84], [78, -82], [58, -100]], true, 8)], { fill: C.saff, halo: 2 }); A.part(ell(104, -114, 7, 5), { fill: C.ink, halo: 0 }); A.part(ell(131, -100, 7, 5), { fill: C.ink, halo: 0 }); A.stroke(line([128, -90], [106, -90]), { w: 5, color: C.crim, halo: 0 }); legP(A, 66, -62, ...gallop(ph, 0), 34, 32, 32, C.saff, C.ivory); legP(A, -74, -68, ...gallop(ph, 0.5, 1), 38, 34, 40, C.saff, C.ivory); }); }
function camel(A, ph, { col = [C.camel, '#8a4c1c'], cloth = C.crim, load = C.lapis, rider } = {}) {
  const b = Math.sin(ph * TAU * 2) * 3, n = Math.sin(ph * TAU) * 5; A.at({ y: b }, () => {
    legP(A, 46, -82, ...walkL(ph, 0.5), 42, 42, 22, col[1]); legP(A, -52, -82, ...walkL(ph, 0.25, 1), 42, 42, 24, col[1]);
    A.part(limb([[66, -104], [96, -84], [116, -108 + n], [112, -150 + n]], [44, 34, 24, 20]), { fill: col, halo: 2.5 });
    A.part([spl([[98, -152 + n], [106, -172 + n], [126, -172 + n], [152, -156 + n], [150, -142 + n], [126, -140 + n], [104, -138 + n]], true, 7)], { fill: col, halo: 2.5 }); A.part(circ(122, -160 + n, 5, 10), { fill: C.ink, halo: 0 }); A.part(limb([[104, -168 + n], [94, -180 + n]], [10, 6]), { fill: col[1], halo: 1 }); A.stroke(line([136, -168 + n], [138, -142 + n]), { w: 5, color: C.crim, halo: 0 });
    A.part([spl([[-84, -100], [-72, -122], [-54, -150], [-34, -152], [-16, -124], [6, -126], [22, -154], [42, -152], [60, -118], [74, -92], [60, -68], [0, -62], [-60, -64], [-84, -80]], true, 8)], { fill: col, halo: 3 }); A.part(limb([[-82, -100], [-96, -84], [-92, -62]], [8, 8, 12]), { fill: col[1], halo: 1.5 });
    A.part(blob([[-56, -140], [-20, -118], [20, -118], [50, -136], [52, -84], [-58, -84]]), { fill: cloth, halo: 2.5, lines: [{ strokes: [line([-60, -92], [56, -92])], w: 8, ink: C.saff }, { shape: [[[-30, -106], [-18, -118], [-6, -106], [-18, -94]], [[8, -106], [20, -118], [32, -106], [20, -94]]], ink: C.ivory }] });
    if (rider) { A.part([spl([[-30, -128], [-24, -178], [-4, -190], [16, -176], [22, -128]], true, 8)], { fill: rider, halo: 3 }); head(A, -4, -212, { s: 0.62, turban: C.ivory, plume: rider }); A.part(limb([[10, -170], [34, -150], [58, -138]], [16, 14, 10]), { fill: rider, halo: 2 }); } else { A.part(blob([[-50, -150], [-6, -164], [44, -150], [40, -118], [-44, -118]]), { fill: load, halo: 3, lines: [{ strokes: [line([-20, -166], [-20, -110]), line([18, -166], [18, -110])], w: 6, ink: C.saff }] }); }
    legP(A, 56, -82, ...walkL(ph, 0), 42, 42, 24, col); legP(A, -62, -84, ...walkL(ph, 0.75, 1), 42, 42, 26, col); for (let i = 0; i < 3; i++) A.part(circ(-48 + i * 46, -78, 6, 10), { fill: C.saff, halo: 1 });
  });
}
// ---- Simurgh, facing +x
function simurgh(A, ph) {
  const f = Math.sin(ph * TAU), g = Math.cos(ph * TAU);
  const plume = (i, n) => { const u = i / (n - 1) - 0.5, pts = []; for (let k = 0; k <= 9; k++) { const q = k / 9; pts.push([-56 - q * (262 - Math.abs(u) * 80), 24 + u * 250 * Math.pow(q, 0.9) + Math.sin(q * 5 - ph * TAU + i * 0.8) * 24 * q]); } const col = [C.turq, C.crim, C.saff, C.rose, C.lapis][i]; A.part(limb(pts, [12, 26, 30, 26, 16]), { fill: col, halo: 3.5, lines: [{ strokes: [curve(pts.slice(1))], w: 8, ink: C.ivory }] }); const e = pts[9], e0 = pts[8], a = Math.atan2(e[1] - e0[1], e[0] - e0[0]), cx = e[0] + Math.cos(a) * 12, cy = e[1] + Math.sin(a) * 12; A.part(petal(e[0] - Math.cos(a) * 24, e[1] - Math.sin(a) * 24, 82, 60, a, 0.45), { fill: C.ivory, halo: 3.5 }); A.part(circ(cx, cy, 20, 18), { fill: col, halo: 0 }); A.part(circ(cx, cy, 9, 12), { fill: C.saff, halo: 0, gold: 1 }); };
  [0, 4, 1, 3, 2].forEach(i => plume(i, 5));
  const wing = k => {
    const S = [14 + k * 16, -8 - k * 8], W = [34 + k * 34, -96 - f * 62 - k * 16], Tp = [-120 + k * 70, -138 - f * 130 - k * 20], ed = curve([S, [lerp(S[0], W[0], 0.6) + 14, lerp(S[1], W[1], 0.6)], W, [lerp(W[0], Tp[0], 0.5) + 10, lerp(W[1], Tp[1], 0.55) - 14 - f * 10], Tp], 10);
    let outA = Math.atan2(Tp[1] - W[1], Tp[0] - W[0]); if (outA < 0) outA += TAU;
    const N = 8; for (let i = 0; i < N; i++) { const u = i / (N - 1), [x, y] = at(ed, lerp(0.1, 1, u)), a = lerp(Math.PI - 0.25 * f + 0.15, outA, Math.pow(u, 1.7)), len = lerp(100, 176, Math.sin(u * 2.2)), c = Math.cos(a), n = Math.sin(a); A.part(petal(x, y, len, 52, a, 0.82), { fill: k ? [C.teal, C.turq][i % 2] : C.ivory, halo: 3.5, lines: k ? [] : [{ shape: circ(x + c * len * 0.84, y + n * len * 0.84, 27, 18), ink: i % 2 ? C.crim : C.turq }, { strokes: [line([x + c * 30, y + n * 30], [x + c * len * 0.6, y + n * len * 0.6])], w: 7, ink: C.ochre }] }); }
    const M = 5; for (let i = 0; i < M; i++) { const u = i / (M - 1), [x, y] = at(ed, lerp(0.08, 0.88, u)), a = lerp(Math.PI + 0.1, outA + 0.25, Math.pow(u, 1.4)); A.part(petal(x, y, 74, 52, a, 0.8), { fill: k ? C.lapis : i % 2 ? C.rose : C.saff, halo: 3.5 }); }
    A.part(limb(ed.filter((_, i) => i % 5 === 0), [34, 34, 30, 24, 10]), { fill: k ? C.lapis : C.crim, halo: 3, lines: [{ dots: Array.from({ length: 7 }, (_, i) => { const [x, y] = at(ed, 0.1 + i * 0.13); return [x, y, 7]; }), ink: C.saff }] });
  };
  wing(1);
  A.part(limb([[-74, 22], [-30, 18], [20, 4], [62, -8], [94, -44], [106, -86], [118, -112]], [30, 66, 76, 54, 36, 32, 32]), { fill: { lin: [-70, 0, 120, 0], stops: [C.crim, C.saff, '#f6cf6a'] }, halo: 3.5, gold: 0.5, lines: [{ dots: [[-44, 16, 8], [-22, 28, 8], [-16, 4, 8], [6, 16, 8], [16, -8, 8], [36, 12, 8], [48, -10, 8], [72, -26, 7]], ink: C.wine }] });
  A.part([spl([[98, -116], [112, -144], [136, -148], [156, -132], [178, -124], [190, -100, 1], [170, -108], [150, -102], [130, -92], [106, -94]], true, 8)], { fill: C.saff, halo: 3, gold: 0.6 }); A.part(circ(136, -124, 11, 14), { fill: C.ivory, halo: 0 }); A.part(circ(138, -124, 7, 12), { fill: C.ink, halo: 0 });
  A.part([spl([[154, -130], [178, -126], [190, -100, 1], [170, -108], [152, -108]], true, 6)], { fill: C.crim, halo: 2.5 });
  for (let i = 0; i < 3; i++) { const a = -2.0 - i * 0.48 + g * 0.06, b = [118 - i * 6, -138 + i * 6], e = pol(b, a * 57.3 - 10, 70); A.part(limb([b, pol(b, a * 57.3 + 14, 36), e], [9, 16, 6]), { fill: [C.crim, C.turq, C.rose][i], halo: 3 }); A.part(circ(e[0], e[1], 11, 12), { fill: C.saff, halo: 2, gold: 1 }); }
  for (const x of [6, 28]) A.stroke(curve([[x, 36], [x - 18, 56], [x - 42, 58]]), { w: 10, color: C.saff, halo: 2 });
  wing(0);
}
const beatFront = t => { let s = 0.2; for (let i = 0; i < 11; i++) s += seg(t, 0.15 + i * 0.3125, 0.15 + i * 0.3125 + 0.14, ease.outBack) / 11 * 0.8; return s; };

export default {
  id: 'persia', mat: 2, dur: 5, from: 'top', to: 'bottom',
  word: { native: 'نخ', font: '"Geeza Pro"', roman: 'nakh', gloss: 'thread' }, caption: { place: 'Persia', tech: 'knotted carpet' },
  sfx: [{ t: 0.15, s: 'thump' }, { t: 0.4625, s: 'thump' }, { t: 0.775, s: 'thump' }, { t: 1.0875, s: 'thump' }, { t: 1.25, s: 'pluck' }, { t: 1.4, s: 'thump' }, { t: 1.7125, s: 'thump' }, { t: 2.025, s: 'thump' }, { t: 2.3375, s: 'thump' }, { t: 2.5, s: 'shimmer' }, { t: 2.65, s: 'thump' }, { t: 3.125, s: 'flap' }, { t: 3.75, s: 'flap' }, { t: 4.1, s: 'bird' }],
  env: t => ({ cloth: '#d6bd8a', stain: 0.55, wear: 0.05, exposure: 1.0, relief: 1.05, sat: 1.1, amb: [0.15, 0.13, 0.125], waves: [[0.0032, 0.0016, 9, t * 0.7]] }),
  bake(B0) {
    const rows = (A, x, y, w, h, y0, y1) => { const c = A.a; c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = '#00ffff'; c.fillRect(x, y, w, h); c.globalCompositeOperation = 'lighter'; const g = c.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, '#000'); g.addColorStop(1, '#f00'); c.fillStyle = g; c.fillRect(x, y, w, h); c.restore(); };
    const B = { layer: (n, f, o = {}) => B0.layer(n, A => { f(A); if (o.rows) rows(A, 0, 0, 1920, 1080, 1066, 14); }, { res: 0.6, ...o }), sprite: (n, o, f) => B0.sprite(n, { res: 0.55, ...o }, (A, ph, i) => { f(A, ph, i); outline(A, o.out ?? 4.5); rows(A, -(o.ox ?? o.w / 2), -(o.oy ?? o.h / 2), o.w, o.h, o.h - (o.oy ?? o.h / 2), -(o.oy ?? o.h / 2)); }) };
    const baseOrder = A => A._auxFill(rect(0, 0, 1920, 1080), { ...A.st, order: UP }, 0);
    B.layer('warp', A => { A.with({ halo: 0, noKnock: true, order: 0 }, () => { for (let x = 24; x < 1900; x += 10) A.stroke(line([x, 10], [x, 1070]), { w: 4, color: x % 20 < 10 ? '#8e6a3a' : '#f3e6c0', alpha: 0.75 }); A.stroke(line([14, 1052], [1906, 1052]), { w: 10, color: C.ochre }); }); });
    B.layer('field', A => A.with({ order: UP }, () => {
      A.part(rect(100, 100, 1720, 880), { fill: C.ivory, halo: 0 });
      A.part(rect(132, 130, 1656, 346), { fill: [C.night, '#16286a'], halo: 0 }); A.part(rect(132, 544, 1656, 328), { fill: ['#5c0a1c', '#8f1128'], halo: 0 });
      // sky: stars, cloud bands
      const R = rng(11); for (let i = 0; i < 74; i++) { const x = 150 + R() * 1620, y = 142 + R() * 300; if (Math.hypot(x - MX, y - MY) < 350) continue; const s = 7 + R() * 9; A.part(star(x, y, s + 4, (s + 4) * 0.45, R() > 0.5 ? 6 : 8), { fill: R() > 0.4 ? C.saff : C.ivory, gold: 0.8, halo: 0 }); }
      for (const [x, y, k, c] of [[640, 178, 1, C.turq], [1290, 178, -1, C.turq], [800, 160, 1, C.rose], [1120, 160, -1, C.rose], [162, 250, 1, C.rose], [1758, 250, -1, C.rose]]) A.at({ x, y, sx: k }, () => { A.part(limb([[-52, 10], [-20, -12], [12, 10], [44, -10], [64, 4]], [8, 18, 20, 18, 6]), { fill: c, halo: 2 }); A.stroke(spiral(-44, 4, 18, 5, 0, 1.2, 20), { w: 8, color: c, halo: 0 }); A.stroke(spiral(34, -14, 16, 5, 2, 1.2, 20), { w: 8, color: c, halo: 0 }); });
      // millefleur ground below, over a tone-on-tone islimi scroll
      A.with({ halo: -1, noKnock: true }, () => { for (let i = 0; i < 12; i++) for (let j = 0; j < 3; j++) { const x = 200 + i * 138 + (j % 2) * 60, y = 600 + j * 108; A.stroke(spiral(x, y, 52, 8, i + j, (i + j) % 2 ? 1.3 : -1.3, 40), { w: 7, color: '#a51c34', alpha: 0.6 }); for (let q = 0; q < 3; q++) { const a = i + q * 2.1; A.part(petal(x + Math.cos(a) * 44, y + Math.sin(a) * 44, 30, 16, a + 1.2), { fill: '#a51c34', alpha: 0.6 }); } } });
      const R2 = rng(5); for (let j = 0; j < 7; j++) for (let i = 0; i < 29; i++) { const x = 160 + i * 58 + (j % 2) * 29 + R2() * 12, y = 576 + j * 45 + R2() * 10; if (Math.hypot(x - MX, y - MY) < 350 || x > 1774 || y > 856) continue; const c = ['#c8485a', '#b98a4a', '#b5602c', '#cf7a6a', '#2f7f78'][(i + j * 2) % 5]; if ((i + j) % 2 === 0) sprig(A, x, y, 0.85, c, (R2() - 0.5) * 0.6); else if ((i + j) % 4 === 1) flower(A, x, y, 12, c); }
      // medallion ground (before the bloom): dark disc with the geometer's construction circles
      A.part(circ(MX, MY, 330, 96), { fill: C.ivory, halo: 0 }); A.part(circ(MX, MY, 322, 96), { fill: { rad: [MX, MY, 40, 330], stops: ['#23409a', C.lapis, C.night] }, halo: 5 });
      for (const r of [MR, 246, 164, 92]) { const pts = []; const n = Math.round(r / 5.2); for (let i = 0; i < n; i++) pts.push([MX + Math.cos(i / n * TAU) * r, MY + Math.sin(i / n * TAU) * r, 3.4]); A.dots(pts, { color: C.ochre, halo: 0 }); }
      for (let i = 0; i < 16; i++) { const [x, y] = V(i); A.stroke(line([MX + (x - MX) * 0.12, MY + (y - MY) * 0.12], [x, y]), { w: 3, color: C.ochre, halo: 0, alpha: 0.6 }); }
    }), { rows: 1 });
    B.layer('garden', A => A.with({ order: UP }, () => { baseOrder(A);
      // water channels
      const water = (x, y, w, h, vert) => { A.part(rect(x - 10, y - 10, w + 20, h + 20), { fill: C.ivory, halo: 0 }); A.part(rect(x, y, w, h), { fill: vert ? [C.teal, C.turq] : [C.turq, C.teal], halo: 2, lines: [{ strokes: vert ? [0, 1, 2, 3].map(i => wavy(x + 10 + i * 20, y - 10, x + 10 + i * 20, y + h + 10, 6, h / 46, i)) : [0, 1, 2, 3].map(i => wavy(x - 10, y + 9 + i * 18, x + w + 10, y + 9 + i * 18, 6, w / 60, i)), w: 5, ink: '#8fe0d2' }] }); };
      water(142, 473, 540, 70); water(1238, 473, 540, 70); water(922, 142, 76, 90, 1); water(922, 800, 76, 62, 1);
      mosque(A, 384, 1); mosque(A, 1536, -1);
      for (const [x, h, w] of [[160, 220, 50], [664, 210, 48], [1760, 220, 50], [1256, 210, 48]]) cypress(A, x, 472, h, w, { lean: x < 960 ? 8 : -8 });
      for (const [x, y, s, c] of [[612, 474, 0.9, C.rose], [1308, 474, 0.9, C.rose], [706, 474, 0.8, C.ivory], [1214, 474, 0.8, C.ivory]]) { sprig(A, x, y - 20, s, c); }
      // left: hunting ground trees and flowers
      const tree = (x, y, h, k, cols, n, seed, spread = 1) => { const R = rng(seed); const tr = [[x, y], [x + k * 8, y - h * 0.3], [x - k * 6, y - h * 0.62], [x + k * 10, y - h * 0.95]]; A.part(limb(tr, [26, 18, 14, 8]), { fill: [C.brown, '#6b3519'], halo: 3 }); const br = [[0.4, -k], [0.52, k], [0.66, -k], [0.78, k]].map(([u, s]) => { const [bx, by] = at(curve(tr), u); const e = [bx + s * h * 0.34 * spread, by - h * 0.22]; A.part(limb([[bx, by], [lerp(bx, e[0], 0.6), by - h * 0.05], e], [13, 10, 5]), { fill: C.brown, halo: 2 }); return [bx, by, e]; }); for (let i = 0; i < n; i++) { const a = R() * TAU, rr = Math.sqrt(R()); const px = x + Math.cos(a) * rr * h * 0.46 * spread, py = y - h * 0.82 + Math.sin(a) * rr * h * 0.30; if (R() < 0.45) A.part(petal(px, py, 24, 15, R() * TAU), { fill: R() > 0.5 ? C.pist : C.leaf, halo: 1.6 }); else flower(A, px, py, 14, cols[Math.floor(R() * cols.length)]); } return br; };
      tree(1712, 868, 296, -1, [C.ivory, C.rose, '#f0b0a8'], 84, 9, 1.05);
      cypress(A, 672, 868, 210, 52); cypress(A, 1246, 868, 210, 52); cypress(A, 164, 868, 250, 50, { lean: 8 }); cypress(A, 1764, 868, 120, 34);
      // rose bush + small hills
      for (const [x, w, h, c] of [[300, 200, 30, C.leaf], [560, 240, 34, '#2d5f3c'], [430, 160, 24, C.teal]]) A.part([spl([[x - w / 2, 868, 1], [x - w * 0.3, 868 - h * 0.8], [x, 868 - h], [x + w * 0.3, 868 - h * 0.75], [x + w / 2, 868, 1]], true, 8)], { fill: [c, '#173a30'], halo: 3, lines: [{ strokes: [1].map(i => curve([[x - w * 0.4 + i * 14, 868], [x, 868 - h + i * 14], [x + w * 0.4 - i * 14, 868]])), w: 5, ink: C.pist }] });
      // musicians' carpet + terrace
      A.part(rect(1272, 838, 416, 30), { fill: C.lapis, halo: 3, lines: [{ strokes: P.zigzag(1272, 844, 416, 18, 16), w: 6, ink: C.saff }] });
      // poet under the tree
      sitter(A, 1648, 840, 0.84, -1, { robe: [C.turq, C.teal], trim: C.ivory, mot: C.ivory, armN: [62, -18], armF: [52, -26], h: { turban: C.ivory, plume: C.crim, beard: 2 }, front: (A, J) => { A.part(poly([[J.ha[0] - 8, J.ha[1] - 4], [J.ha[0] + 34, J.ha[1] - 18], [J.ha[0] + 62, J.ha[1] - 4], [J.ha[0] + 58, J.ha[1] + 34], [J.ha[0] + 30, J.ha[1] + 18], [J.ha[0] - 10, J.ha[1] + 32]]), { fill: C.ivory, halo: 3, lines: [{ strokes: [line([J.ha[0] + 2, J.ha[1] + 10], [J.ha[0] + 24, J.ha[1] + 2]), line([J.ha[0] + 38, J.ha[1] + 4], [J.ha[0] + 54, J.ha[1] + 14])], w: 6, ink: C.crim }] }); } });
      // ewer, cups, fruit on the terrace
      A.part(blob([[1566, 840], [1554, 818], [1560, 800], [1568, 788], [1566, 774], [1580, 774], [1578, 788], [1588, 800], [1592, 820], [1582, 840]]), { fill: C.saff, gold: 0.9, halo: 2.5 }); outline(A, 5);
    }), { rows: 1 });
    // musicians (animated)
    B.sprite('setar', { w: 310, h: 280, ox: 130, oy: 264, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU); sitter(A, 0, 0, 0.84, 1, { robe: [C.pist, C.leaf], trim: C.saff, mot: C.ivory, armN: [86 - s * 8, -4 + s * 22], armF: [16, -34], h: { turban: C.ivory, plume: C.saff, tilt: s * 0.05 }, front: (A, J) => { A.stroke(line([4, -78], [J.hf[0] + 34, J.hf[1] - 22]), { w: 11, color: C.brown, halo: 2.5 }); A.part(blob([[-22, -62], [0, -100], [36, -96], [40, -70], [16, -48], [-12, -48]]), { fill: [C.saff, C.ochre], halo: 3, lines: [{ dots: [[12, -74, 8]], ink: C.brown }] }); A.part(circ(J.ha[0], J.ha[1], 14, 16), { fill: SKIN.wheat[1], halo: 2 }); } }); });
    B.sprite('daf', { w: 290, h: 290, ox: 120, oy: 264, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU); sitter(A, 0, 0, 0.84, 1, { robe: [C.saff, C.ochre], trim: C.crim, mot: C.crim, armN: [24, -34 + s * 20], armF: [-6, -56], h: { hat: 'veil', turban: C.rose, plume: C.saff, tilt: -s * 0.08 }, back: (A, J) => {}, front: (A, J) => { const c = [J.hf[0] + 18, J.hf[1] - 2]; A.part(circ(c[0], c[1], 46, 36), { fill: C.ivory, halo: 3 }); A.part(ring(c[0], c[1], 36, 46), { fill: C.crim, halo: 0 }); A.part(star(c[0], c[1], 22, 9, 8), { fill: C.lapis, halo: 1 }); A.part(limb([[8, -156], J.el, J.ha], [34, 32, 24]), { fill: [C.saff, C.ochre], halo: 3 }); A.part(circ(J.ha[0], J.ha[1], 15, 16), { fill: SKIN.wheat[1], halo: 2 }); } }); });
    B.sprite('ney', { w: 290, h: 280, ox: 120, oy: 264, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU); sitter(A, 0, 0, 0.84, 1, { robe: [C.lapis, C.night], trim: C.turq, mot: C.rose, armN: [70, -30 + s * 4], armF: [44, -44], h: { turban: C.crim, plume: C.ivory, beard: 1, tilt: 0.12 + s * 0.04 }, front: (A, J) => { A.stroke(line([26, -184], [J.ha[0] + 40, J.ha[1] + 46]), { w: 9, color: C.saff, halo: 2.5 }); A.part(circ(J.ha[0], J.ha[1], 14, 16), { fill: SKIN.wheat[1], halo: 2 }); A.part(circ(J.hf[0] + 6, J.hf[1] + 4, 13, 16), { fill: SKIN.wheat[1], halo: 2 }); } }); });
    B.sprite('hunter', { w: 400, h: 360, ox: 190, oy: 320, n: 8 }, (A, ph) => {
      const bob = Math.sin(ph * TAU) * 6; horse(A, ph); A.at({ y: bob }, () => {
        // rider turned to shoot
        A.part(limb([[-4, -132], [26, -108], [22, -70]], [34, 30, 20]), { fill: C.saff, halo: 3 }); A.part(blob([[14, -72], [36, -70], [52, -58], [16, -56]]), { fill: C.brown, halo: 2 });
        const bow = curve([[96, -262], [120, -236], [114, -206], [120, -176], [98, -150]]); A.part(limb([[10, -198], [52, -206], [104, -208]], [26, 22, 16]), { fill: C.turq, halo: 3 });
        A.part([spl([[-30, -124], [-26, -190], [-6, -212], [18, -204], [24, -160], [20, -122]], true, 8)], { fill: [C.turq, C.teal], halo: 3, lines: [{ strokes: [line([-30, -138], [24, -138])], w: 10, ink: C.crim }, { dots: [[-8, -172, 8], [8, -186, 7]], ink: C.saff }] });
        head(A, 0, -240, { s: 0.8, turban: C.ivory, plume: C.crim }); A.stroke(bow, { w: 9, color: C.brown, halo: 2.5 }); A.stroke(line([96, -262], [30, -206], [98, -150]), { w: 4, color: C.ivory, halo: 1 }); A.stroke(line([22, -206], [146, -208]), { w: 5, color: C.ivory, halo: 1 }); A.part(circ(106, -208, 11, 14), { fill: SKIN.wheat[1], halo: 2 });
        A.part(limb([[-6, -196], [-30, -184], [26, -206]], [24, 24, 18]), { fill: C.turq, halo: 3 }); A.part(circ(28, -206, 11, 14), { fill: SKIN.wheat[1], halo: 2 }); A.part(poly([[-40, -150], [-22, -156], [-14, -104], [-32, -100]]), { fill: C.crim, halo: 2 }); for (const i of [0, 1, 2]) A.stroke(line([-36 + i * 6, -152], [-44 + i * 6, -178]), { w: 5, color: C.ivory, halo: 0 });
      });
    });
    B.sprite('rider2', { w: 400, h: 360, ox: 190, oy: 320, n: 8 }, (A, ph) => { const bob = Math.sin(ph * TAU) * 6; horse(A, ph, { col: ['#6f9ad8', '#3f64a8'], mane: C.ivory, cloth: C.saff }); A.at({ y: bob }, () => { A.part(limb([[-4, -132], [26, -108], [22, -70]], [34, 30, 20]), { fill: C.ivory, halo: 3 }); A.stroke(line([-60, -250], [150, -150]), { w: 7, color: C.ivory, halo: 2.5 }); A.part(petal(146, -152, 34, 18, 0.44), { fill: C.saff, gold: 0.8, halo: 2 }); A.part([spl([[-30, -124], [-26, -190], [-6, -212], [18, -204], [24, -160], [20, -122]], true, 8)], { fill: [C.rose, C.crim], halo: 3, lines: [{ strokes: [line([-30, -138], [24, -138])], w: 10, ink: C.saff }] }); head(A, 0, -240, { s: 0.8, hat: 'crown' }); A.part(limb([[10, -196], [36, -180], [58, -194]], [26, 24, 16]), { fill: C.rose, halo: 3 }); A.part(circ(58, -194, 11, 14), { fill: SKIN.wheat[1], halo: 2 }); }); });
    B.sprite('gazelle', { w: 260, h: 270, ox: 120, oy: 230, n: 8 }, (A, ph) => gazelle(A, ph)); B.sprite('lion', { w: 360, h: 250, ox: 180, oy: 215, n: 8 }, (A, ph) => lion(A, ph));
    B.sprite('camelA', { w: 310, h: 290, ox: 130, oy: 270, n: 8 }, (A, ph) => camel(A, ph, { cloth: C.crim, load: C.turq })); B.sprite('camelB', { w: 310, h: 290, ox: 130, oy: 270, n: 8 }, (A, ph) => camel(A, ph, { col: ['#d8a35a', C.camel], cloth: C.lapis, rider: C.crim })); B.sprite('camelC', { w: 310, h: 290, ox: 130, oy: 270, n: 8 }, (A, ph) => camel(A, ph, { col: ['#8c4a20', '#5c2a12'], cloth: C.turq, load: C.saff }));
    B.sprite('simurgh', { w: 820, h: 720, ox: 480, oy: 380, n: 10, out: 6.5 }, (A, ph) => simurgh(A, ph));
    B.sprite('duck', { w: 110, h: 80, n: 4 }, (A, ph) => { const b = Math.sin(ph * TAU) * 2; A.at({ y: b }, () => { A.part([spl([[-44, -2], [-30, -8], [0, -10], [18, -14], [18, -30], [30, -38], [42, -30], [52, -24], [40, -20], [36, -8], [24, 12], [-16, 14], [-36, 8]], true, 7)], { fill: [C.ivory, C.cream], halo: 2.5 }); A.part(blob([[-26, -2], [0, -8], [14, 0], [0, 10], [-18, 8]]), { fill: C.crim, halo: 1.5 }); A.part(blob([[20, -30], [30, -38], [40, -30], [34, -20], [22, -20]]), { fill: C.leaf, halo: 0 }); A.part(poly([[40, -30], [54, -24], [40, -20]]), { fill: C.saff, halo: 0 }); A.part(circ(33, -29, 3.4, 8), { fill: C.ivory, halo: 0 }); }); });
    B.sprite('fish', { w: 110, h: 60, n: 4 }, (A, ph) => { const w = Math.sin(ph * TAU) * 7; A.part(blob([[-26, 0], [0, -15], [30, -8], [40, 0], [30, 8], [0, 15]]), { fill: [C.saff, C.crim], halo: 2.5, lines: [{ strokes: [line([8, -16], [6, 16]), line([-8, -14], [-10, 14])], w: 5, ink: C.ivory }] }); A.part(poly([[-22, 0], [-46, -14 + w], [-38, w * 0.6], [-46, 14 + w]]), { fill: C.crim, halo: 2 }); A.part(circ(28, -2, 4, 8), { fill: C.ink, halo: 0 }); });
    B.sprite('bulbul', { w: 110, h: 100, n: 6 }, (A, ph) => { const f = Math.sin(ph * TAU); A.part(limb([[-44, 18], [-14, 8], [10, -4], [24, -16]], [8, 26, 28, 20]), { fill: [C.brown, C.ochre], halo: 2.5 }); A.part(circ(26, -18, 13, 16), { fill: C.ink, halo: 1 }); A.part(poly([[36, -22], [52, -20 - Math.max(0, f) * 6], [36, -14]]), { fill: C.saff, halo: 1 }); A.part(circ(29, -20, 3.4, 8), { fill: C.ivory, halo: 0 }); A.part(petal(8, -4, 46, 22, 2.7 + f * 0.25, 0.7), { fill: C.crim, halo: 2 }); });
    B.sprite('peacock', { w: 260, h: 240, ox: 160, oy: 220, n: 6 }, (A, ph) => { const s = Math.sin(ph * TAU); for (let i = 0; i < 5; i++) { const a = Math.PI + 0.5 - i * 0.17 + s * 0.03, p0 = [-6, -70], e = pol(p0, a * 57.3, 116); A.part(limb([p0, [lerp(p0[0], e[0], 0.5), lerp(p0[1], e[1], 0.5) - 10], e], [12, 16, 12]), { fill: i % 2 ? C.leaf : C.teal, halo: 2 }); A.part(circ(e[0], e[1], 15, 18), { fill: C.saff, halo: 2 }); A.part(circ(e[0], e[1], 8, 12), { fill: C.lapis, halo: 0 }); } for (const x of [-4, 10]) A.stroke(line([x, -44], [x + 2, -2]), { w: 6, color: C.saff, halo: 2 }); A.part(limb([[-22, -72], [6, -68], [34, -84], [42, -124], [46, -152 + s * 3]], [26, 48, 38, 20, 18]), { fill: [C.turq, C.lapis], halo: 3, lines: [{ dots: [[0, -70, 6], [16, -76, 6], [4, -56, 6]], ink: C.saff }] }); A.part(circ(48, -154 + s * 3, 12, 16), { fill: C.lapis, halo: 1 }); A.part(poly([[58, -158 + s * 3], [74, -150 + s * 3], [58, -148 + s * 3]]), { fill: C.saff, halo: 1 }); A.part(circ(51, -156 + s * 3, 3.6, 8), { fill: C.ivory, halo: 0 }); for (const k of [-1, 0, 1]) { A.stroke(line([46, -164], [42 + k * 10, -186]), { w: 4, color: C.saff, halo: 1 }); A.part(circ(42 + k * 10, -188, 6, 10), { fill: C.crim, halo: 1 }); } });
    // ---- the medallion
    B.layer('medal', A => {
      const O = a => ['rad', MX, MY, 0, 330, 0, 1];
      A.with({ order: O() }, () => {
        // cusped outer band
        const lobes = []; for (let i = 0; i < 384; i++) { const a = i / 384 * TAU - Math.PI / 2, r = 318 + 16 * Math.abs(Math.cos(a * 8 + Math.PI / 2 * 0)); lobes.push([MX + Math.cos(a) * r, MY + Math.sin(a) * r]); }
        A.part([lobes], { fill: C.ivory, halo: 4 }); A.part(circ(MX, MY, 314, 120), { fill: C.crim, halo: 3 }); A.part(circ(MX, MY, MR + 6, 120), { fill: C.saff, halo: 2, gold: 0.4 }); A.part(circ(MX, MY, MR - 4, 120), { fill: C.night, halo: 0 });
        for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; A.part(circ(MX + Math.cos(a) * 307, MY + Math.sin(a) * 307, 5, 10), { fill: i % 2 ? C.ivory : C.saff, halo: 0 }); }
        // cells of the {16/5} arrangement
        const n = 16, k = 5, d = MR * Math.cos(k * Math.PI / n), rr = m => d / Math.cos(m * Math.PI / n), pt = (m, j) => { const a = -Math.PI / 2 + Math.PI / n + (k * Math.PI / n) + j * Math.PI / n; return [MX + Math.cos(a) * rr(m), MY + Math.sin(a) * rr(m)]; };
        const cell = (pts, c, dots) => A.part(poly(pts), { fill: c, halo: 0, lines: dots ? [dots] : [] });
        for (let i = 0; i < n; i++) {
          const j = i * 2 + 1; // parity handled below
          for (let m = 1; m + 2 <= k; m++) { const a = i * 2 + (m % 2); const q = [pt(m, a), pt(m + 1, a + 1), pt(m + 2, a), pt(m + 1, a - 1)]; cell(q, [null, C.saff, C.turq, C.night][m]); if (m === 3) { const cx = (q[0][0] + q[2][0]) / 2, cy = (q[0][1] + q[2][1]) / 2; A.part(T(ell(0, 0, 15, 8), { x: cx, y: cy, r: Math.atan2(cy - MY, cx - MX) }), { fill: C.saff, halo: 0 }); A.part(circ(cx, cy, 5, 8), { fill: C.ivory, halo: 0 }); } }
          { const a = i * 2 + (k % 2) + 1; const o = pt(k - 1, a), l = pt(k, a - 1), r = pt(k, a + 1); const ang = Math.atan2(o[1] - MY, o[0] - MX); const cap = [l]; for (let q = 1; q < 8; q++) { const b = Math.atan2(l[1] - MY, l[0] - MX); let e = Math.atan2(r[1] - MY, r[0] - MX); while (e < b) e += TAU; const t = lerp(b, e, q / 8); cap.push([MX + Math.cos(t) * (MR - 4), MY + Math.sin(t) * (MR - 4)]); } cap.push(r, o); A.part(poly(cap), { fill: i % 2 ? C.ivory : C.turq, halo: 0 }); lotus(A, MX + Math.cos(ang) * 262, MY + Math.sin(ang) * 258, 0.5, ang + Math.PI / 2, i % 2 ? [C.crim, C.rose, C.wine] : [C.lapis, C.ivory, C.night], { halo: 0.5 }); }
          { const a = i * 2 + 0; const p2 = pt(2, a), e0 = pt(1, a - 1), e1 = pt(1, a + 1); cell([e0, p2, e1], C.saff); }
        }
        // inner disc: midnight, eight palmettes and a lotus heart
        A.part(ngon(MX, MY, rr(1) - 2, 16, -Math.PI / 2), { fill: { rad: [MX, MY, 60, 160], stops: [C.ivory, C.cream] }, halo: 0 });
        for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + Math.PI / 16; A.part(petal(MX + Math.cos(a) * 88, MY + Math.sin(a) * 88, 62, 36, a, 0.62), { fill: i % 2 ? C.lapis : C.crim, halo: 3, lines: [{ strokes: [line([MX + Math.cos(a) * 104, MY + Math.sin(a) * 104], [MX + Math.cos(a) * 134, MY + Math.sin(a) * 134])], w: 7, ink: i % 2 ? C.turq : C.saff }] }); }
        A.part(star(MX, MY, 106, 84, 16), { fill: C.night, halo: 4 }); A.part(star(MX, MY, 92, 72, 16), { fill: C.saff, halo: 0, gold: 0.6, raise: 0.4 }); A.part(circ(MX, MY, 70, 40), { fill: C.lapis, halo: 0 });
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; A.part(petal(MX + Math.cos(a) * 14, MY + Math.sin(a) * 14, 54, 42, a, 0.6), { fill: [C.ivory, C.rose][i % 2], halo: 3 }); }
        for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.PI / 8; A.part(petal(MX + Math.cos(a) * 10, MY + Math.sin(a) * 10, 36, 24, a, 0.6), { fill: C.turq, halo: 2 }); }
        A.part(circ(MX, MY, 22, 24), { fill: C.saff, halo: 2, gold: 1 }); A.part(circ(MX, MY, 11, 18), { fill: C.crim, halo: 1 });
        outline(A, 4);
      });
    });
    // interlaced strapwork: chord s is revealed as the thread passes
    B.layer('straps', A => {
      const n = 16, k = 5, d = MR * Math.cos(k * Math.PI / n); const ch = [...Array(16)].map((_, s) => [starPath[s], starPath[s + 1]]);
      for (let s = 0; s < 16; s++) { const q = L2(...ch[s], 16); A.stroke(q, { w: 27, color: C.ink, halo: 0, order: { along: [s / 16, (s + 1) / 16] } }); A.stroke(q, { w: 18, color: C.ivory, halo: 0, order: { along: [s / 16, (s + 1) / 16] } }); A.stroke(q, { w: 7, color: C.crim, halo: 0, gold: 0.3, order: { along: [s / 16, (s + 1) / 16] } }); }
      // over-crossings
      const mid = s => { const [a, b] = ch[s]; return [(a[0] + b[0]) / 2 - MX, (a[1] + b[1]) / 2 - MY]; }; const idx = s => { const m = mid(s); let j = Math.round((Math.atan2(m[1], m[0])) / (TAU / 16)); return ((j % 16) + 16) % 16; };
      for (let s = 0; s < 16; s++) for (let q = 0; q < 16; q++) { if (q === s) continue; let m = idx(q) - idx(s); if (m > 8) m -= 16; if (m < -8) m += 16; if (Math.abs(m) >= k || m === 0) continue; const id = m < 0 ? m + k : m + k - 1; if (id % 2) continue; const base = mid(s), l = Math.hypot(...base), nx = base[0] / l, ny = base[1] / l; const t0 = d * Math.tan(m * Math.PI / n); const c = [MX + nx * d - ny * t0, MY + ny * d + nx * t0]; const seg1 = line([c[0] + ny * 24, c[1] - nx * 24], [c[0] - ny * 24, c[1] + nx * 24]); const or = (Math.max(s, q) + 0.6) / 16; A.stroke(seg1, { w: 27, color: C.ink, halo: 0, order: or, cap: 'butt' }); A.stroke(seg1, { w: 18, color: C.ivory, halo: 0, order: or, cap: 'butt' }); A.stroke(seg1, { w: 7, color: C.crim, halo: 0, gold: 0.3, order: or, cap: 'butt' }); }
      for (let i = 0; i < 16; i++) { const [x, y] = V(i); A.part(circ(x, y, 20, 18), { fill: C.ink, halo: 0, order: 0.03 + 0.94 * (((i * 13) % 16) / 16) }); A.part(circ(x, y, 15, 18), { fill: C.saff, gold: 1, raise: 0.8, halo: 0, order: 0.03 + 0.94 * (((i * 13) % 16) / 16) }); A.part(circ(x, y, 6, 12), { fill: C.crim, halo: 0, order: 0.03 + 0.94 * (((i * 13) % 16) / 16) }); }
    });
    B.layer('bloom', A => {
      const od = ['rad', MX, MY, 320, 470, 0, 1]; A._auxFill(rect(0, 0, 1920, 1080), { ...A.st, order: od }, 0);
      A.with({ order: od }, () => {
        for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + i * TAU / 16, x = MX + Math.cos(a) * 344, y = MY + Math.sin(a) * 344; if (i % 2 === 0 && i % 4 !== 2) { continue; } A.at({ x, y, r: a + Math.PI / 2 }, () => { for (const k of [-1, 1]) A.part(petal(0, 10, 40, 24, -Math.PI / 2 + k * 0.9), { fill: C.turq, halo: 0 }); A.part(petal(0, 12, 50, 34, -Math.PI / 2, 0.55), { fill: C.saff, halo: 3 }); A.part(petal(0, 8, 26, 16, -Math.PI / 2, 0.55), { fill: C.crim, halo: 2 }); }); }
        for (const a of [-2.356, -0.785, 2.356, 0.785]) { const ca = Math.cos(a), sa = Math.sin(a); for (const q of [-1, 1]) { if (sa > 0 && q * ca > 0) continue; const sp = spiral(MX + Math.cos(a + q * 0.2) * 422, MY + Math.sin(a + q * 0.2) * 422, 40, 10, a + Math.PI + q * 0.5, -q * 1.2, 40); A.stroke([...curve([[MX + ca * 350, MY + sa * 350], [sp[0][0], sp[0][1]]], 6), ...sp].reduce((o, p) => (o.push(p), o), Object.assign([], { open: true })), { w: 9, color: C.pist, halo: 0 }); flower(A, sp[40][0], sp[40][1], 19, q > 0 ? C.rose : C.ivory); for (const u of [0.2, 0.5]) { const [lx, ly, la] = at(sp, u); A.part(petal(lx, ly, 30, 18, la + q * 1.1), { fill: C.turq, halo: 2 }); } } palmette(A, MX + ca * 376, MY + sa * 376, 0.92, a + Math.PI / 2, [C.crim, C.ivory, C.saff, C.turq]); }
        for (const s of [-1, 1]) palmette(A, MX, MY + s * 350, 0.6, s > 0 ? Math.PI : 0, [C.crim, C.ivory, C.saff, C.turq]);
        for (const s of [-1, 1]) palmette(A, MX + s * 366, MY, 0.9, s > 0 ? Math.PI / 2 : -Math.PI / 2, [C.crim, C.ivory, C.saff, C.pist]);
        outline(A, 4.5);
      });
    });
    B.layer('frame', A => A.with({ order: UP }, () => {
      P.frame(A, 14, 14, 1892, 1052, 100, (A, len, side) => {
        A.with({ order: side === 0 ? 0.97 : side === 2 ? 0.03 : side === 3 ? ['lin', 0, 0, len, 0, 0.04, 0.96] : ['lin', 0, 0, len, 0, 0.96, 0.04] }, () => {
          A.part(rect(0, 0, len, 18), { fill: C.crim, halo: 0 }); const m = Math.round(len / 24); for (let i = 0; i < m; i++) A.part(poly([[i * len / m, 17], [(i + 0.5) * len / m, 2], [(i + 1) * len / m, 17]]), { fill: C.saff, halo: 0 });
          A.part(rect(0, 18, len, 64), { fill: C.night, halo: 0 }); A.part(rect(0, 18, len, 5), { fill: C.ivory, halo: 0 }); A.part(rect(0, 77, len, 5), { fill: C.ivory, halo: 0 });
          
          A.part(rect(0, 82, len, 18), { fill: C.crim, halo: 0 }); const q = Math.round(len / 30); for (let i = 0; i < q; i++) A.part(ngon((i + 0.5) * len / q, 91, 8, 4, 0), { fill: i % 2 ? C.saff : C.ivory, halo: 0 });
        });
        A.with({ order: side === 0 || side === 1 ? 0.96 : 0.04, halo: 0 }, () => { A.part(rect(-100, 0, 100, 100), { fill: C.crim }); A.part(rect(-84, 16, 68, 68), { fill: C.ivory }); A.part(rect(-79, 21, 58, 58), { fill: C.lapis }); A.part(star(-50, 50, 30, 20, 8), { fill: C.saff }); A.part(star(-50, 50, 20, 13, 8, 0), { fill: C.crim }); A.part(circ(-50, 50, 6, 10), { fill: C.ivory }); });
      });
      // caravan frieze ground
      A.part(rect(114, 870, 1692, 98), { fill: ['#f0c76a', C.saff], halo: 0 }); A.part(rect(114, 864, 1692, 10), { fill: C.night, halo: 0 });
      for (let i = 0; i < 12; i++) A.part([spl([[114 + i * 141, 968, 1], [150 + i * 141, 936 - (i % 3) * 6], [200 + i * 141, 922 - (i % 2) * 10], [255 + i * 141, 968, 1]], true, 8)], { fill: i % 2 ? '#d48a2c' : '#e0a848', halo: 0, lines: [{ strokes: [curve([[150 + i * 141, 962], [196 + i * 141, 938], [240 + i * 141, 964]])], w: 5, ink: '#b8701f' }] }); for (let i = 0; i < 26; i++) A.part(star(150 + i * 66, 888 + (i % 2) * 8, 9, 4, 6), { fill: C.crim, halo: 0 });
      // inner vine guard, three sides
      for (const [x, y, w, h] of [[114, 114, 1692, 20], [114, 114, 20, 750], [1786, 114, 20, 750]]) { A.part(rect(x, y, w, h), { fill: C.ivory, halo: 0 }); const ver = h > w, L = ver ? h : w, n = Math.round(L / 34); for (let i = 0; i < n; i++) { const p = (i + 0.5) / n * L, X = ver ? x + 10 : x + p, Y = ver ? y + p : y + 10; A.part(ngon(X, Y, 10, 4, 0), { fill: [C.crim, C.lapis, C.turq][i % 3], halo: 0 }); } }
    }), { rows: 1 });
    B.layer('vine', A => A.with({ order: UP }, () => { baseOrder(A);
      P.frame(A, 14, 14, 1892, 1052, 100, (A, len, side) => A.with({ order: side === 0 ? 0.97 : side === 2 ? 0.03 : side === 3 ? ['lin', 0, 0, len, 0, 0.04, 0.96] : ['lin', 0, 0, len, 0, 0.96, 0.04] }, () => {
        const n = Math.round(len / 118), u = len / n; A.stroke(wavy(0, 50, len, 50, 15, n, 0, 600), { w: 7, color: C.pist, halo: 0 });
        for (let i = 0; i < n; i++) { const x = (i + 0.5) * u; for (const k of [-1, 1]) A.part(petal(x + k * 36, 50 + k * 8, 30, 15, k > 0 ? 0.6 : Math.PI + 0.6, 0.6), { fill: C.turq, halo: 0 }); palmette(A, x, 56, 0.62, 0, [[C.crim, C.ivory, C.saff, C.turq], [C.turq, C.ivory, C.crim, C.saff], [C.saff, C.ivory, C.lapis, C.rose], [C.rose, C.ivory, C.crim, C.turq]][i % 4]); if (i) { for (const q of P.petals(i * u, 50, 6, 4, 18, 15)) A.part([q], { fill: i % 2 ? C.ivory : C.rose, halo: 0 }); A.part(circ(i * u, 50, 7, 12), { fill: C.crim, halo: 0 }); } }
      })); outline(A, 4, C.ink);
    }), { rows: 1 });
    // the designer's cartoon, chalked on bare warps
    B.layer('chalk', A => A.with({ halo: 0, noKnock: true, order: ['rad', MX, MY, 0, 900, 0, 1] }, () => { for (const r of [MR, 246, 164, 92, 330]) { A.stroke(circ(MX, MY, r, 96)[0], { w: 6, color: C.crim, alpha: 0.5 }); } for (let i = 0; i < 16; i++) { const [x, y] = V(i); A.stroke(line([MX, MY], [x, y]), { w: 4, color: C.wine, alpha: 0.4 }); } A.stroke(line([MX, 20], [MX, 1060]), { w: 5, color: C.wine, alpha: 0.5 }); A.stroke(line([20, MY], [1900, MY]), { w: 5, color: C.wine, alpha: 0.5 }); for (const [x, y] of [[384, 300], [1536, 300]]) { A.stroke(arch(x, 470, 240, 190), { w: 5, color: C.wine, alpha: 0.45 }); A.stroke(Object.assign([...arc(x, 196, 90, Math.PI, TAU)], { open: true }), { w: 5, color: C.wine, alpha: 0.45 }); } A.strokes([line([132, 130], [1788, 130]), line([132, 868], [1788, 868]), line([132, 130], [132, 868]), line([1788, 130], [1788, 868])], { w: 5, color: C.wine, alpha: 0.45 }); for (let i = 0; i < 12; i++) { A.stroke(spiral(210 + (i % 6) * 110 + (i > 5 ? 1000 : 0) - (i > 5 ? 0 : 0), 620 + (i % 2) * 130, 46, 8, i, 1.3, 30), { w: 5, color: C.wine, alpha: 0.4 }); } }));
    // weaver's comb-beater
    B.sprite('comb', { w: 260, h: 220, ox: 130, oy: 200, n: 1 }, A => { A.part(blob([[-16, -190, 1], [16, -190, 1], [20, -120], [60, -96], [104, -86, 1], [104, -60, 1], [-104, -60, 1], [-104, -86, 1], [-60, -96], [-20, -120]]), { fill: ['#7a3b1a', C.brown], halo: 3, lines: [{ strokes: [spiral(0, -92, 18, 4, 0, 1.4, 24)], w: 6, ink: C.saff }, { strokes: [line([-96, -70], [96, -70])], w: 6, ink: C.saff }] }); for (let i = 0; i < 11; i++) A.part(poly([[-98 + i * 19.6 - 6, -60], [-98 + i * 19.6 + 6, -60], [-98 + i * 19.6 + 3, -4], [-98 + i * 19.6 - 3, -4]]), { fill: ['#cfc4ae', '#7d7364'], gold: 0.35, halo: 2 }); });
  },
  draw(g, t) {
    const F = beatFront(t), fy = y => clamp((F - (1066 - y) / 1052) * 9), K = { mode: 4, rvp: [5, 0.16, 0, 0], noise: 0.015, edge: 0.03 }, pop = (y, h = 180) => ({ mode: 4, rvp: [5, 0.14, 0, 0], rv: clamp((F - (1066 - y) / 1052) * 1052 / h), noise: 0, edge: 0.03, glow: 0.4 });
    g.layer('warp', { rv: 1 }); g.layer('chalk', { rv: 1 });
    g.layer('field', { ...K, rv: F, glow: 0.5 }); g.layer('garden', { ...K, rv: F, glow: 0.4 });
    for (let i = 0; i < 5; i++) { const L = i < 3, x = L ? 168 + ((i * 180 + t * 46) % 480) : 1270 + (((i - 3) * 230 + t * 46) % 480); g.sprite('fish', { x, y: 508 + Math.sin(i * 2 + t * 2) * 10, ph: t * 1.6 + i * 0.3, s: 0.8, ...pop(530, 60) }); }
    for (const [x, d, i] of [[300, 1, 0], [1650, -1, 1], [560, -1, 2], [1400, 1, 3]]) g.sprite('duck', { x: x + d * t * 22, y: 496 + Math.sin(t * 3 + i) * 3, flip: d < 0, s: 0.9, ph: t + i * 0.3, ...pop(520, 70) });
    // the hunt
    const run = t * 20;
    g.sprite('rider2', { x: 240 + run, y: 702, s: 0.58, ph: t * 1.6 + 0.35, ...pop(712, 210) }); g.sprite('gazelle', { x: 468 + run, y: 700, s: 0.66, ph: t * 1.6 + 0.6, ...pop(712, 180) });
    g.sprite('gazelle', { x: 588 + run * 0.7, y: 800, s: 0.5, ph: t * 1.6 + 0.2, ...pop(806, 140) }); g.sprite('hunter', { x: 270 + run, y: 862, s: 0.74, ph: t * 1.6, ...pop(884, 266) }); g.sprite('lion', { x: 530 + run, y: 864, s: 0.74, ph: t * 1.5 + 0.4, ...pop(884, 190) });
    // music and poetry
    const bt = t / 0.625; g.sprite('daf', { x: 1316, y: 840, ph: bt * 2, ...pop(866, 290) }); g.sprite('setar', { x: 1408, y: 842, ph: bt * 2 + 0.3, ...pop(858, 280) }); g.sprite('ney', { x: 1500, y: 844, ph: bt * 0.5, ...pop(860, 280) });
    g.sprite('bulbul', { x: 1594, y: 620 + Math.sin(t * 3) * 3, s: 1, ph: t * 2.4, ...pop(670, 100) }); g.sprite('peacock', { x: 772, y: 866, s: 0.62, ph: t * 0.7, ...pop(878, 150) }); g.sprite('peacock', { x: 1148, y: 866, s: 0.62, flip: true, ph: t * 0.7 + 0.4, ...pop(878, 150) });
    g.layer('frame', { ...K, rv: F, glow: 0.4 }); g.layer('vine', { ...K, rv: F, glow: 0.4 });
    for (let i = 0; i < 12; i++) { const x = 1880 - ((i * 152 + 60 + t * 34) % 1840); if (x < 150 || x > 1776) continue; const e = clamp(Math.min(x - 150, 1776 - x) / 40); g.sprite(['camelA', 'camelB', 'camelC'][i % 3], { x, y: 966, s: 0.52, flip: true, ph: t * 0.95 + i * 0.27, alpha: e, ...pop(976, 150) }); }
    // the medallion blooms when the star closes
    const bl = seg(t, 2.36, 3.0, ease.out2); if (bl > 0) g.layer('medal', { mode: 4, rvp: [5, 0.12, 0, 0], rv: bl, noise: 0.02, glow: 1.3 }); if (t > 2.5) g.layer('bloom', { mode: 4, rvp: [5, 0.14, 0, 0], rv: seg(t, 2.55, 3.25, ease.out2), glow: 1.1, noise: 0.02 });
    const h0 = seg(t, 0, 0.32, u => Math.pow(u, 1.3)), h1 = seg(t, 0.32, 2.5, u => u), h2 = seg(t, 2.5, 3.0, ease.inOut2);
    g.layer('straps', { rv: h1 >= 1 ? 1 : h1 * 0.99, soft: 0.01, noise: 0, glow: 1.2, edge: 0.02 });
    // comb thumps
    for (let i = 0; i < 11; i++) { const t0 = 0.15 + i * 0.3125, a = t - t0; if (a < -0.22 || a > 0.2) continue; const y = 1066 - (0.2 + 0.8 * (i + 1) / 11) * 1052 + 6, up = a < 0 ? Math.pow(-a / 0.22, 0.8) * 90 : a * 260; const x = [520, 1400, 900, 300, 1620, 700, 1240, 430, 1500, 820, 1120][i]; g.sprite('comb', { x, y: y - up, alpha: clamp((0.2 - a) * 10), lift: 20 + up * 0.3 }); if (a >= 0) { g.bump(x, y, 160, 12 * Math.exp(-a * 14)); } g.burst(x, y, t0, { n: 26, speed: 260, spread: 2.4, dir: -1.57, seed: i + 3, col: [1.6, 1.1, 0.7], life: 0.5, size: 2.4 }); }
    // Simurgh
    const bu = clamp((t - 2.5) / 2.5), sx = 290 + 1280 * Math.pow(bu, 1.5), sy = 400 - Math.sin(bu * Math.PI) * 60 + Math.sin(t * 5) * 8; if (t > 2.3) g.sprite('simurgh', { x: sx, y: sy, s: 0.9, r: -0.06 + Math.sin(t * 1.4) * 0.05, ph: t / 0.625, rv: seg(t, 2.4, 2.95), mode: 4, rvp: [10, 1, 0, 0], lift: 34, noise: 0 });
    // the thread: in from the top, sixteen chords, half way round the rim, out at the bottom
    const pts = [], seg0 = [], tot = []; const push = (x, y, z) => pts.push([x, y, z]);
    for (let i = 0; i <= 24; i++) { const u = i / 24; push(MX + Math.sin(u * 9 + t * 2.2) * 26 * (1 - u) * u * 2.2, lerp(-120, MY - MR, u), lerp(60, 14, u)); } const l0 = pts.length;
    for (let s = 0; s < 16; s++) for (let i = 1; i <= 14; i++) { const a = starPath[s], b = starPath[s + 1], u = i / 14; push(lerp(a[0], b[0], u), lerp(a[1], b[1], u), 9 + 6 * Math.sin(u * Math.PI * 5) ** 2 * ((s + i) % 2 ? 1 : 0.4)); } const l1 = pts.length;
    for (let i = 1; i <= 60; i++) { const a = -Math.PI / 2 + i / 60 * Math.PI; push(MX + Math.cos(a) * (MR + 10 * Math.min(1, i / 5)), MY + Math.sin(a) * (MR + 10 * Math.min(1, i / 5)), 12); }
    for (let i = 1; i <= 24; i++) { const u = i / 24; push(MX + Math.sin(u * 8 - t * 2) * 22 * u, lerp(MY + MR + 10, 1200, u), lerp(12, 50, u)); }
    const len = (a, b) => { let s = 0; for (let i = Math.max(1, a); i < b; i++) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], pts[i][2] - pts[i - 1][2]); return s; }; const A0 = len(0, l0), A1 = len(l0, l1), A2 = len(l1, pts.length), LT = A0 + A1 + A2;
    g.thread(pts, { w: 9, hero: 1, f0: (A0 + A1) / LT * seg(t, 3.0, 3.95, ease.inOut2), f1: (A0 * h0 + A1 * h1 + A2 * h2) / LT, spark: t < 3.1 ? 1 : 0 });
    for (let s = 0; s < 16; s++) { const p = starPath[s + 1]; g.burst(p[0], p[1], 0.32 + (s + 1) / 16 * 2.18, { n: 12, speed: 170, seed: s + 40, life: 0.6 }); }
    g.burst(MX, MY, 2.5, { n: 120, speed: 620, seed: 99, life: 1.2, size: 3.4 });
    g.drift({ n: 60, vx: 10, vy: -8, col: [1.2, 0.8, 0.5], a: 0.45, size: 2.4 }); if (t > 2.6) g.drift({ n: 46, vx: 26, vy: 34, col: [0.95, 0.5, 0.55], a: 0.75 * seg(t, 2.6, 3.2), size: 6, kind: 2, add: 0, seed: 8, twinkle: 0 });
  },
  shots: [
    { end: 1.25, cam: (p, t) => ({ x: lerp(930, 960, p), y: lerp(480, 590, ease.inOut2(p)), w: lerp(1000, 1120, p), tilt: lerp(0.3, 0.2, p), yaw: lerp(0.1, -0.04, p), aperture: 4 }) },
    { end: 3.125, cam: (p, t) => ({ x: 960, y: lerp(540, 540, p), w: lerp(1300, 1860, ease.inOut2(p)), tilt: lerp(0.16, 0.02, p), aperture: 2.5 }) },
    { end: 5, cam: (p, t) => ({ x: lerp(560, 1290, ease.inOut2(p)), y: lerp(420, 510, p), w: lerp(980, 1140, p), tilt: lerp(0.26, 0.18, p), yaw: lerp(-0.1, 0.1, p), aperture: 3.6 }) },
  ],
};
