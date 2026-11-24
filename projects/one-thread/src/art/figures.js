// People kit. One shared stylisation (profile head, almond eye, dyed shapes with resist lines) so every
// culture belongs to the same tapestry; dress, hair, adornment and pose carry the differences.
// Units: a standing adult is ~400 tall, feet at y = 0, facing +x. Wrap in A.at({x,y,s,sx:-1}) to place/flip.
import { spl, blob, limb, circ, ell, curve, line, spiral, T, petal, lerp, bbox, rect, TAU } from './geom.js';
const D = Math.PI / 180, pol = (p, a, l) => [p[0] + Math.cos(a * D) * l, p[1] + Math.sin(a * D) * l];
export const SKIN = { deep: ['#2c1409', '#3b1c0d'], umber: ['#48240f', '#5a2f14'], sienna: ['#6e3517', '#83441d'], copper: ['#8a4a22', '#9c5a2c'], tan: ['#a96c38', '#b97c45'], sand: ['#c08d58', '#cc9c68'], wheat: ['#cfa878', '#dab98c'] };
const L = { up: 66, fo: 62, th: 92, sh: 92, torso: 104, neck: 24 };

// Build joints from a pose. Angles in degrees, 0 = +x (forward), 90 = down, -90 = up, 180 = back.
export function joints(p = {}) {
  const P = { lean: 0, armN: [100, 80], armF: [80, 60], legN: [84, 92], legF: [98, 96], head: 0, hip: null, sh: 26, hipW: 13, bob: 0, twist: 0, air: 0, scale: 1, ...p };
  const hip = [0, 0], la = -90 + P.lean, chest = pol(hip, la, L.torso * 0.86), neck = pol(chest, la + P.lean * 0.3, 30), ax = [Math.cos((la + 90) * D), Math.sin((la + 90) * D)];
  const shN = [chest[0] + ax[0] * P.sh * (1 - P.twist), chest[1] + ax[1] * P.sh + 4], shF = [chest[0] - ax[0] * P.sh * (1 - P.twist) * 0.9, chest[1] - ax[1] * P.sh + 4];
  const hpN = [hip[0] + P.hipW * 0.6, hip[1]], hpF = [hip[0] - P.hipW * 0.6, hip[1]];
  const elN = pol(shN, P.armN[0], L.up), haN = pol(elN, P.armN[1], L.fo), elF = pol(shF, P.armF[0], L.up), haF = pol(elF, P.armF[1], L.fo);
  const knN = pol(hpN, P.legN[0], L.th), ftN = pol(knN, P.legN[1], L.sh), knF = pol(hpF, P.legF[0], L.th), ftF = pol(knF, P.legF[1], L.sh);
  const hd = pol(neck, la + P.head * 0.5, 36);
  const J = { hip, chest, neck, head: hd, headA: (P.lean * 0.6 + P.head) * D, shN, shF, hpN, hpF, elN, haN, elF, haF, knN, ftN, knF, ftF, P };
  const gy = P.ground === false ? L.th + L.sh + 14 : Math.max(ftN[1], ftF[1]) + 12; const dy = -gy - P.air + P.bob;
  for (const k of ['hip', 'chest', 'neck', 'head', 'shN', 'shF', 'hpN', 'hpF', 'elN', 'haN', 'elF', 'haF', 'knN', 'ftN', 'knF', 'ftF']) J[k] = [J[k][0], J[k][1] + dy]; return J;
}
// ---- hand: drawn at wrist pointing along angle a (deg). pose: open | grip | flat | point | cup
export function hand(A, w, a, { s = 1, skin = SKIN.copper, pose = 'open', flip = 1, halo = 2, ...st } = {}) {
  A.at({ x: w[0], y: w[1], r: a * D, s, sy: flip }, () => {
    const f = (pts, wd) => A.part(limb(pts, wd, { seg: 5 }), { fill: skin[0], halo: 1.6, ...st });
    if (pose === 'grip') { A.part(blob([[-6, -9], [10, -13], [22, -8], [24, 4], [14, 12], [-6, 9]], 6), { fill: skin[0], halo, ...st, lines: [{ strokes: [line([12, -11], [16, 9]), line([5, -11], [8, 10])], w: 2.2 }] }); f([[4, 8], [16, 12], [22, 6]], [8, 8, 6]); return; }
    if (pose === 'flat') { A.part(blob([[-6, -8], [14, -9], [36, -5], [44, 0], [34, 6], [12, 9], [-6, 8]], 6), { fill: skin[0], halo, ...st, lines: [{ strokes: [line([18, -3], [40, -1]), line([18, 3], [36, 3])], w: 2 }] }); f([[6, -6], [16, -16], [24, -20]], [8, 7, 5]); return; }
    if (pose === 'point') { A.part(blob([[-6, -9], [12, -11], [22, -6], [22, 6], [12, 11], [-6, 9]], 6), { fill: skin[0], halo, ...st }); f([[14, -6], [30, -8], [46, -8]], [8, 7, 5]); f([[4, 8], [14, 14], [20, 10]], [8, 7, 5]); return; }
    const sp = pose === 'cup' ? 0.35 : 1; for (const [dy, an, ln, wd] of [[-9, -24, 30, 7], [-4, -8, 36, 7.5], [3, 8, 35, 7.5], [9, 24, 28, 6.5]]) { const b = [13, dy], m = pol(b, an * sp, ln * 0.55), e = pol(m, an * sp * (pose === 'cup' ? -1 : 1.2) + (pose === 'cup' ? 20 : 0), ln * 0.45); f([b, m, e], [wd, wd, wd * 0.6]); }
    f([[2, -8], [8, -22], [18, -30]], [9, 8, 5]); A.part(blob([[-6, -9], [10, -13], [18, -10], [19, 10], [10, 13], [-6, 9]], 6), { fill: skin[0], halo: 1.2, ...st });
  });
}
export function foot(A, p, a, { skin, shoe, halo = 2, s = 1, ...st }) { A.at({ x: p[0], y: p[1], r: (a - 90) * D * 0.35, s }, () => A.part(blob([[-11, -10, 1], [9, -10], [18, 0], [40, 5], [46, 11], [38, 14], [-12, 14, 1], [-15, 4]], 6), { fill: shoe || skin[0], halo, ...st, lines: shoe ? [] : [{ strokes: [line([34, 8], [38, 13]), line([29, 7], [32, 13])], w: 1.6 }] })); }
// ---- profile head at origin = centre of head, ~104 tall with neck. o: {skin, hair:{...}, eye, brow, lips, paint(A), beard, ear}
export const PROFILE = [[-6, -52], [18, -50], [34, -38], [39, -22], [36, -13], [44, 0], [51, 9, 1], [38, 14], [43, 19], [38, 23, 1], [42, 28], [36, 34], [38, 43], [30, 51], [14, 51], [2, 46], [0, 60], [4, 84], [-30, 84], [-27, 60], [-30, 38], [-46, 18], [-50, -8], [-42, -36], [-24, -49]];
export function headProfile(A, { skin = SKIN.copper, eye = '#efe0bd', pupil = '#1c0f08', lips, ear = true, brow = '#1c0f08', look = 0, closed = false, halo = 3, age = 0, cheek = true, ...st } = {}) {
  A.part([spl(PROFILE, true, 7)], { fill: [skin[1], skin[0]], halo, ...st, lines: [
    { strokes: [curve([[-18, 36], [-4, 46], [10, 50], [24, 47]])], w: 3, taper: 0.35 }, { strokes: [curve([[37, 6], [31, 8], [29, 13], [33, 16], [36, 13]])], w: 2.2, taper: 0.3 },
    ...(cheek ? [{ strokes: [curve([[2, 2], [8, 14], [18, 18], [26, 12], [22, 5], [15, 8]])], w: 2.4, taper: 0.3 }] : []),
    { strokes: [curve([[-26, 50], [-22, 66], [-22, 82]]), curve([[-14, 54], [-10, 68], [-9, 82]])], w: 2.4, taper: 0.3 },
    ...(age ? [{ strokes: [curve([[27, 18], [24, 27], [29, 34]]), curve([[4, -4], [0, -9]]), curve([[4, 0], [-1, -1]]), curve([[14, -40], [24, -38], [31, -34]])], w: 2, taper: 0.35 }] : [])] });
  const s2 = { ...st, halo: 2 };
  if (closed) { A.stroke(curve([[4, -10], [16, -2], [33, -10]]), { w: 5, color: pupil, taper: 0.25, ...s2 }); }
  else { A.part([spl([[1, -8, 1], [12, -21], [25, -22], [38, -9, 1], [27, -2], [12, -1]], true, 7)], { fill: pupil, ...s2 }); A.part([spl([[6, -9, 1], [14, -18], [25, -18.5], [34, -10, 1], [25, -5], [13, -4.5]], true, 7)], { fill: eye, ...s2, halo: 0 }); A.part(circ(23 + look * 4, -11, 7, 20), { fill: pupil, ...s2, halo: 0 }); A.part(circ(24.5 + look * 4, -13, 2, 10), { fill: eye, ...s2, halo: 0 }); }
  if (brow) A.stroke(curve([[-2, -24], [10, -35], [24, -36], [37, -28]]), { w: 6, color: brow, taper: 0.4, ...s2, halo: 1.2 });
  if (lips) A.part([spl([[34, 18, 1], [43, 17.5], [39, 23, 1], [42.5, 28.5], [34, 30]], true, 5)], { fill: lips, ...s2, halo: 0.8 }); else A.stroke(curve([[40, 23], [34, 24], [28, 21.5]]), { w: 2.6, color: pupil, taper: 0.3, ...s2, halo: 0 });
  if (ear) A.part(ell(-12, 3, 9.5, 15, 0.15, 24), { fill: skin[0], ...s2, lines: [{ strokes: [spiral(-11.5, 1.5, 7.5, 1.4, 2.2, -1.2, 22)], w: 2.2 }] });
}
// frontal head: mask-like, symmetrical
export function headFront(A, { skin = SKIN.copper, eye = '#efe0bd', pupil = '#1c0f08', brow = '#1c0f08', lips = '#7a1f16', closed = false, smile = 0.6, ear = true, halo = 3, ...st } = {}) {
  A.part([spl([[-15, 44], [-15, 84], [15, 84], [15, 44]], true, 6)], { fill: skin[0], halo, ...st, lines: [{ strokes: [curve([[-7, 56], [-6, 84]]), curve([[7, 56], [6, 84]])], w: 2.4 }] }); if (ear) for (const k of [-1, 1]) A.part(ell(k * 42, 2, 10, 15, 0, 20), { fill: skin[0], halo: 2, ...st, lines: [{ strokes: [spiral(k * 42, 2, 7, 1.4, k > 0 ? 3.1 : 0, k * 1.1, 18)], w: 2 }] });
  A.part([spl([[0, -54], [28, -49], [41, -22], [40, 6], [30, 34], [13, 50], [0, 53], [-13, 50], [-30, 34], [-40, 6], [-41, -22], [-28, -49]], true, 7)], { fill: [skin[1], skin[0]], halo, ...st, lines: [{ strokes: [curve([[-35, 8], [-26, 20], [-14, 22], [-11, 14], [-18, 12]]), curve([[35, 8], [26, 20], [14, 22], [11, 14], [18, 12]])], w: 2.4, taper: 0.3 }] });
  const s2 = { ...st, halo: 2 };
  for (const k of [-1, 1]) { if (closed) A.stroke(curve([[k * 6, -10], [k * 18, -3], [k * 31, -11]]), { w: 5, color: pupil, taper: 0.25, ...s2 }); else { A.part([spl([[k * 4, -8, 1], [k * 13, -19], [k * 23, -19], [k * 35, -10, 1], [k * 23, -2], [k * 13, -2]], true, 6)], { fill: pupil, ...s2 }); A.part([spl([[k * 8, -9, 1], [k * 14, -16], [k * 22, -16], [k * 31, -10.5, 1], [k * 22, -5], [k * 14, -5]], true, 6)], { fill: eye, ...s2, halo: 0 }); A.part(circ(k * 18.5, -10.5, 6.2, 18), { fill: pupil, ...s2, halo: 0 }); } }
  if (brow) A.stroke(curve([[-37, -24], [-20, -34], [-8, -28], [-4, -10], [-6, 8], [0, 13], [6, 8], [4, -10], [8, -28], [20, -34], [37, -24]]), { w: 4.6, color: brow, taper: 0.18, ...s2, halo: 1.2 });
  A.part([spl([[-13, 30, 1], [-5, 27], [0, 29], [5, 27], [13, 30, 1], [6, 37 + smile * 2], [-6, 37 + smile * 2]], true, 5)], { fill: lips, ...s2, lines: [{ strokes: [curve([[-12, 30], [0, 33 + smile * 2], [12, 30]])], w: 1.8 }] });
}
// hair cap that follows the skull in profile; path options for common shapes
export const HAIR = {
  cap: [[38, -24], [34, -40], [18, -54], [-8, -58], [-34, -50], [-52, -28], [-54, 0], [-46, 22], [-34, 34], [-26, 22], [-20, 6], [-18, -14], [-4, -26], [16, -30]],
  long: [[38, -24], [34, -42], [16, -56], [-10, -60], [-38, -50], [-56, -26], [-60, 10], [-64, 60], [-74, 120], [-58, 150], [-36, 140], [-24, 100], [-20, 50], [-18, 8], [-16, -14], [-4, -26], [16, -30]],
  bun: [[38, -24], [34, -42], [16, -56], [-10, -60], [-30, -56], [-46, -66], [-66, -60], [-72, -40], [-60, -24], [-54, 0], [-46, 22], [-34, 32], [-26, 20], [-20, 4], [-18, -14], [-4, -26], [16, -30]],
  afro: [[36, -22], [44, -44], [30, -70], [0, -84], [-36, -78], [-64, -54], [-74, -18], [-66, 18], [-44, 36], [-26, 24], [-18, 4], [-16, -14], [-2, -26], [16, -28]],
  bob: [[38, -22], [36, -42], [16, -57], [-10, -60], [-38, -50], [-54, -26], [-56, 10], [-52, 40], [-20, 42], [-14, 20], [-18, -2], [-14, -16], [0, -26], [18, -28]],
  top: [[38, -24], [34, -42], [18, -54], [8, -62], [12, -80], [-4, -92], [-22, -84], [-22, -64], [-40, -50], [-53, -26], [-52, 2], [-44, 22], [-32, 30], [-24, 16], [-18, -12], [-4, -26], [16, -30]],
};
export function hair(A, kind, { fill = ['#1c0f08', '#2c180c'], gap = 9, w = 2.6, field, halo = 2.5, ...st } = {}) { const pts = typeof kind === 'string' ? HAIR[kind] : kind; const path = [spl(pts, true, 7)], b = bbox(path); A.part(path, { fill, halo, ...st, lines: [{ flow: { gap, w, margin: 4, minLen: 10, field: field || [{ guide: curve([[34, -34], [0, -50], [-40, -30], [-48, 20], [b.x + 10, b.y1]]), w: 1, fall: 400 }] } }] }); }
export const beard = (A, o = {}) => A.part([spl(o.pts || [[-4, 30], [10, 34], [26, 30], [34, 34], [40, 46], [34, 76], [22, 96], [8, 84], [-4, 62], [-10, 44]], true, 7)], { fill: o.fill || ['#1c0f08', '#2c180c'], halo: 1.5, ...o, lines: [{ flow: { gap: o.gap || 8, w: 2.2, margin: 3, minLen: 8, field: [{ dir: Math.PI * 0.52 }, ...(o.curl ? [{ vortex: [16, 64, 16, 1], w: 1.6 }] : [])] } }] });

// ---- garments as paths built from joints ------------------------------------------------------
export const torsoPath = (J, { w0 = 34, w1 = 27, w2 = 30 } = {}) => [spl([[J.shF[0] - 8, J.shF[1] - 6], [J.neck[0] - 15, J.neck[1] + 4], [J.neck[0] + 13, J.neck[1] + 4], [J.shN[0] + 9, J.shN[1] - 6], [J.shN[0] + 9, J.shN[1] + 22], [lerp(J.chest[0], J.hip[0], 0.6) + w1, lerp(J.chest[1], J.hip[1], 0.6)], [J.hip[0] + w2, J.hip[1] + 8], [J.hip[0] - w2, J.hip[1] + 8], [lerp(J.chest[0], J.hip[0], 0.6) - w1, lerp(J.chest[1], J.hip[1], 0.6)], [J.shF[0] - 10, J.shF[1] + 22]], true, 8)];
// robe/skirt from waist to hem. len: px below hip, flare: half-width at hem, sway: hem x-shift, folds: hem scallops
export function skirtGeo(J, { len = 150, flare = 70, w = 30, top = 0, sway = 0, folds = 3, scallop = 5, lift = 0, drop = 0 } = {}) {
  const y0 = J.hip[1] - top, y1 = J.hip[1] + len, cx = J.hip[0]; const prof = f => lerp(w, flare, Math.pow(f, 0.82)), shift = f => sway * f * f;
  const row = f => { const o = [], n = 36; for (let i = 0; i <= n; i++) { const u = i / n * 2 - 1; o.push([cx + shift(f) + u * prof(f), lerp(y0, y1, f) + f * (Math.cos(u * Math.PI * folds) * scallop - u * lift + (1 - u * u) * drop)]); } o.open = true; return o; };
  const L = [], R = []; for (let i = 0; i <= 14; i++) { const f = i / 14, r = row(f); L.push(r[0]); R.push(r[r.length - 1]); }
  return { path: [[...L.map(q => q).reverse(), ...R, ...row(1).reverse().slice(1, -1)].reduce((a, q) => (a.push(q), a), [])], row, L, R };
}
export function skirtPath(J, o = {}) { const g = skirtGeo(J, o); return [[...g.R, ...[...g.row(1)].reverse().slice(1, -1), ...[...g.L].reverse()]]; }
// woven bands across a skirt: [{at:0..1, w, color, motif:'zig'|'dots'|'dia'|'tri'|'line'|'key'|'cross'|'wave', ink, n}]
export function skirtBands(J, o, bands) { const g = skirtGeo(J, o), out = []; for (const b of bands) { const r = g.row(Math.min(1, b.at)), W = Math.hypot(r[0][0] - r[36][0], 0); if (b.color) out.push({ strokes: [r], w: b.w, ink: b.color, cap: 'butt' }); if (b.motif && b.motif !== 'line') { const n = b.n || Math.max(4, Math.round(W / (b.w * 1.1))), pt = (u, v) => { const k = Math.min(35.99, Math.max(0, u * 36)), i = Math.floor(k), f = k - i; return [lerp(r[i][0], r[i + 1][0], f), lerp(r[i][1], r[i + 1][1], f) + v]; }; const h = b.w * 0.32; if (b.motif === 'zig') { const z = []; for (let i = 0; i <= n * 2; i++) z.push(pt(i / (n * 2), i % 2 ? h : -h)); z.open = true; out.push({ strokes: [z], w: b.lw || b.w * 0.2, ink: b.ink }); } else if (b.motif === 'dots') out.push({ dots: Array.from({ length: n }, (_, i) => [...pt((i + 0.5) / n, 0), b.w * 0.24]), ink: b.ink }); else if (b.motif === 'dia' || b.motif === 'tri' || b.motif === 'cross') { const sh = []; for (let i = 0; i < n; i++) { const c = (i + 0.5) / n, d = 0.42 / n; if (b.motif === 'dia') sh.push([pt(c - d, 0), pt(c, -h * 1.2), pt(c + d, 0), pt(c, h * 1.2)]); else if (b.motif === 'tri') sh.push([pt(c - d, h), pt(c, -h * 1.2), pt(c + d, h)]); else sh.push([pt(c - d, -h * 0.35), pt(c + d, -h * 0.35), pt(c + d, h * 0.35), pt(c - d, h * 0.35)], [pt(c - d * 0.35, -h), pt(c + d * 0.35, -h), pt(c + d * 0.35, h), pt(c - d * 0.35, h)]); } out.push({ shape: sh, ink: b.ink, rule: 'nonzero' }); } else if (b.motif === 'wave') { const z = []; for (let i = 0; i <= n * 10; i++) z.push(pt(i / (n * 10), Math.sin(i / 10 * TAU) * h)); z.open = true; out.push({ strokes: [z], w: b.lw || b.w * 0.2, ink: b.ink }); } else if (b.motif === 'key') { const z = []; for (let i = 0; i < n; i++) { const a = i / n, q = 1 / n / 4; z.push(pt(a, h), pt(a, -h), pt(a + q * 3, -h), pt(a + q * 3, h * 0.3), pt(a + q * 1.4, h * 0.3)); z.push(pt(a + q * 1.4, h * 0.3), pt(a + q * 3, h * 0.3), pt(a + q * 3, h)); } z.open = true; out.push({ strokes: [z], w: b.lw || b.w * 0.16, ink: b.ink }); } } } return out; }
export const foldField = (J, { sway = 0, len = 150, flare = 60, w = 30 } = {}) => [{ fn: (x, y) => { const v = Math.max(0, Math.min(1.2, (y - J.hip[1]) / len)), hw = lerp(w, flare, v), u = (x - J.hip[0] - sway * v * v) / hw; const vx = u * (flare - w) / len + 2 * sway * v / len, l = Math.hypot(vx, 1); return [vx / l, 1 / l]; } }];
export const sleevePath = (sh, el, ha, w = [40, 36, 34]) => limb([sh, el, ha], w, { seg: 8 });

// ---- the figure -------------------------------------------------------------------------------
// o: { pose, skin, legs:{fill,w,lines}|false, shoe, torso:{fill,lines,pat,...}|false, lower:{...skirt opts, fill, lines, trim:{color,w}, pat}, sleeve:{fill,w,lines,to:'el'|'ha'}, hands:'open'|{N,F},
//      head:'profile'|'front'|false, face:{}, hair:{kind,...}, hat:(A,J)=>, back:(A,J)=>, mid:(A,J)=>, front:(A,J)=>, belt:{color,w}, collar:{color,w}, order, gold, raise }
export function figure(A, o) {
  const J = joints(o.pose), skin = o.skin || SKIN.copper, st = o.st || {}, orn = o.ornament ?? 1; const ang = (a, b) => Math.atan2(b[1] - a[1], b[0] - a[0]) / D;
  // body lines: a joint spiral at the root of each limb, running into lines along it
  const limbOrn = (a, b, c, r, w) => !orn ? [] : [{ strokes: [spiral(a[0], a[1], r, r * 0.22, ang(a, b) * D - 1.2, 1.35, 26)], w, taper: 0.25 }, { strokes: [curve([[lerp(a[0], b[0], 0.42), lerp(a[1], b[1], 0.42)], b, [lerp(b[0], c[0], 0.75), lerp(b[1], c[1], 0.75)]])], w, taper: 0.3 }];
  const limbSkin = (a, b, c, w, r, lw, bare) => A.part(limb([a, b, c], w, { seg: 8 }), { fill: skin[0], halo: 2.6, ...st, lines: o.limbLines ? o.limbLines(a, b, c) : bare ? limbOrn(a, b, c, r, lw) : [] });
  const hp = typeof o.hands === 'object' ? o.hands : { N: o.hands || 'open', F: o.hands || 'open' };
  const arm = (sh, el, ha, k) => {
    const sl = o.sleeve; limbSkin(sh, el, ha, [25, 27, 20, 21, 13], 8.5, 2.6, !sl || sl.to === 'el');
    if (hp[k] !== false) hand(A, ha, ang(el, ha) + (o.wrist?.[k] || 0), { skin, pose: hp[k] || 'open', flip: o.handFlip?.[k] ?? (k === 'N' ? 1 : -1), s: o.handS || 0.95, ...st });
    if (o.bangle) { const q = [lerp(el[0], ha[0], 0.86), lerp(el[1], ha[1], 0.86)], an = ang(el, ha); A.stroke(line(pol(q, an + 90, 10), pol(q, an - 90, 10)), { w: o.bangle.w || 7, color: o.bangle.color, halo: 1.4, cap: 'butt', ...st, gold: o.bangle.gold || 0 }); }
    if (o.armlet) { const q = [lerp(sh[0], el[0], 0.62), lerp(sh[1], el[1], 0.62)], an = ang(sh, el); A.stroke(line(pol(q, an + 90, 13), pol(q, an - 90, 13)), { w: o.armlet.w || 8, color: o.armlet.color, halo: 1.4, cap: 'butt', ...st, gold: o.armlet.gold || 0 }); }
    if (sl) { const ww = sl.w || [42, 36, 40], end = sl.to === 'el' ? [lerp(sh[0], el[0], 0.92), lerp(sh[1], el[1], 0.92)] : [lerp(el[0], ha[0], 0.84), lerp(el[1], ha[1], 0.84)], root = [lerp(sh[0], el[0], -0.06), lerp(sh[1], el[1], -0.06)];
      const path = sl.path ? sl.path(sh, el, ha) : sl.to === 'el' ? limb([root, end], ww, { cap1: false }) : limb([root, el, end], ww, { seg: 8, cap1: false });
      A.part(path, { fill: sl.fill, under: sl.under, halo: 2.6, ...st, lines: [...(sl.lines || [{ flow: { gap: sl.gap || 10, w: sl.lw || 2.6, margin: 5, minLen: 14, field: [{ guide: curve([sh, el, end]), w: 1, fall: 300 }] } }]), ...(sl.trim ? [{ strokes: [line(pol(end, ang(sl.to === 'el' ? sh : el, end) + 90, 60), pol(end, ang(sl.to === 'el' ? sh : el, end) - 90, 60))], w: (sl.trim.w || 8) * 2, ink: sl.trim.color }] : [])] }); } };
  const leg = (h, k, f) => { const lg = o.legs; limbSkin(h, k, f, [40, 41, 27, 31, 14], 12, 3, !lg); foot(A, f, ang(k, f), { skin, shoe: o.shoe, ...st }); if (o.anklet) { const q = [lerp(k[0], f[0], 0.88), lerp(k[1], f[1], 0.88)], an = ang(k, f); A.stroke(line(pol(q, an + 90, 11), pol(q, an - 90, 11)), { w: 7, color: o.anklet.color, halo: 1.4, cap: 'butt', ...st, gold: o.anklet.gold || 0 }); } if (lg) { const end = lg.to ? [lerp(k[0], f[0], lg.to), lerp(k[1], f[1], lg.to)] : f; A.part(limb([h, k, end], lg.w || [46, 42, 34, 34], { seg: 8, cap1: false }), { fill: lg.fill, halo: 2.6, ...st, lines: [...(lg.lines || [{ flow: { gap: 11, w: 2.6, margin: 5, minLen: 16, field: [{ guide: curve([h, k, end]), w: 1, fall: 300 }] } }]), ...(lg.trim ? [{ strokes: [line(pol(end, ang(k, end) + 90, 60), pol(end, ang(k, end) - 90, 60))], w: (lg.trim.w || 8) * 2, ink: lg.trim.color }] : [])] }); } };
  o.back?.(A, J); arm(J.shF, J.elF, J.haF, 'F'); o.behind?.(A, J); leg(J.hpF, J.knF, J.ftF); leg(J.hpN, J.knN, J.ftN);
  const tp = torsoPath(J, o.torsoShape), t = o.torso; const body = { flow: { gap: 12, w: 2.8, margin: 6, minLen: 14, field: [{ guide: curve([J.neck, J.chest, J.hip]), w: 0.8, fall: 300 }, { contour: 0.8 }, { vortex: [J.chest[0] + 6, J.chest[1] + 16, 22, 1], w: 1.2 }] } };
  if (t !== false) A.part(tp, { fill: t ? t.fill : [skin[1], skin[0]], under: t?.under, halo: 2.6, ...st, lines: [...(t?.lines || [t ? { flow: { gap: 12, w: 2.8, margin: 6, minLen: 16, field: [{ guide: curve([J.neck, J.chest, J.hip]), w: 1, fall: 300 }, { contour: 0.4 }] } } : body]), ...(t?.pat ? [{ pat: t.pat, ink: t.patInk || '#e9d3a0' }] : [])] });
  if (o.lower) { const lw = o.lower, p = lw.path ? lw.path(J) : skirtPath(J, lw); A.part(p, { fill: lw.fill, under: lw.under, halo: 2.6, ...st, gold: lw.gold || 0, lines: [...(lw.lines || [{ flow: { gap: lw.gap || 13, w: lw.lw || 3, margin: 5, minLen: 20, field: foldField(J, lw) } }]), ...(lw.pat ? [{ pat: lw.pat, ink: lw.patInk || '#e9d3a0' }] : []), ...(lw.bands ? skirtBands(J, lw, lw.bands) : []), ...(lw.trim ? skirtBands(J, lw, [{ at: 1, w: (lw.trim.w || 10) * 2, color: lw.trim.color }]) : [])] }); }
  if (o.belt) A.part(limb([[J.hip[0] - 31, J.hip[1] - 3], [J.hip[0], J.hip[1] + 3], [J.hip[0] + 31, J.hip[1] - 3]], [o.belt.w || 13], { cap0: false, cap1: false }), { fill: o.belt.color, halo: 2, ...st, gold: o.belt.gold || 0, lines: o.belt.ink ? [{ strokes: [curve([[J.hip[0] - 31, J.hip[1] - 3], [J.hip[0], J.hip[1] + 3], [J.hip[0] + 31, J.hip[1] - 3]])], w: 3, ink: o.belt.ink }] : [] });
  o.mid?.(A, J);
  const collar = () => { if (!o.collar) return; const c = o.collar, w = c.w || 12, x = J.neck[0], y = J.neck[1]; const rows = c.rows || 1; for (let i = rows - 1; i >= 0; i--) A.part(limb([[x - 22 - i * w * 0.62, y + 4 + i * 3], [x - 12 - i * w * 0.3, y + 20 + i * w * 0.8], [x + 2, y + 25 + i * w * 0.9], [x + 15 + i * w * 0.3, y + 19 + i * w * 0.8], [x + 23 + i * w * 0.62, y + 4 + i * 3]], [w * 0.9], { seg: 6 }), { fill: Array.isArray(c.color) ? c.color[i % c.color.length] : c.color, halo: 1.8, ...st, gold: c.gold || 0, lines: c.dots ? [{ dots: Array.from({ length: 9 }, (_, k) => { const u = k / 8, a = lerp(Math.PI * 0.98, 0.02, u); return [x + Math.cos(a) * (22 + i * w * 0.62), y + 4 + Math.sin(a) * (20 + i * w * 0.85), w * 0.18]; }), ink: c.dots }] : [] }); };
  if (o.head !== false) A.at({ x: J.head[0], y: J.head[1] - 14, r: J.headA, s: o.headS || 0.9 }, () => { o.headBack?.(A, J); if (o.head === 'front') headFront(A, { skin, ...st, ...(o.face || {}) }); else headProfile(A, { skin, ...st, ...(o.face || {}) }); if (o.beard) beard(A, { ...st, ...o.beard }); if (o.hair) hair(A, o.hair.kind, { ...st, ...o.hair }); o.hat?.(A, J); });
  collar(); arm(J.shN, J.elN, J.haN, 'N'); o.front?.(A, J); return J;
}
// Pose presets and cycles (ph 0..1)
export const POSE = {
  stand: {}, walk: ph => { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); return { lean: 4, legN: [88 - s * 24, 96 - s * 18 + Math.max(0, c) * 26], legF: [88 + s * 24, 96 + s * 18 + Math.max(0, -c) * 26], armN: [96 + s * 26, 76 + s * 18], armF: [96 - s * 26, 76 - s * 18], bob: -Math.abs(s) * 3 }; },
  carry: ph => ({ ...POSE.walk(ph), armN: [-62, -100], armF: [-70, -96] }),
  dance: ph => { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU); return { lean: s * 9, legN: [70 - s * 16, 112 + s * 22], legF: [104 + s * 14, 100 - s * 26], armN: [-30 - s * 34, -70 + c * 26], armF: [-150 - s * 34, -110 + c * 26], head: -s * 10, bob: -Math.abs(c) * 12 }; },
  joinHands: ph => { const s = Math.sin(ph * TAU), c = Math.cos(ph * TAU * 2); return { lean: s * 6, legN: [78 - s * 20, 98 + Math.max(0, s) * 34], legF: [100 - s * 20, 98 - Math.min(0, s) * 34], armN: [14, -20 + s * 8], armF: [166, 200 - s * 8], head: -s * 6, bob: -Math.abs(c) * 9 }; },
  sit: { legN: [12, 96], legF: [2, 100], lean: 2, armN: [70, 10], armF: [60, 8] }, kneel: { legN: [40, 170], legF: [92, 178], lean: 4 }, run: ph => { const s = Math.sin(ph * TAU); return { lean: 16, legN: [80 - s * 50, 100 - s * 10 + (s < 0 ? 60 : 0)], legF: [80 + s * 50, 100 + s * 10 + (s > 0 ? 60 : 0)], armN: [90 + s * 50, 20 + s * 50], armF: [90 - s * 50, 20 - s * 50], bob: -Math.abs(s) * 10 }; },
};
export { pol, D };
