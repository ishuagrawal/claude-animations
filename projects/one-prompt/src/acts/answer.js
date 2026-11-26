import { rr as KR, text as KT } from '../ink.js';
import { word } from '../timeline.js';
// The answer comes home: riding the comet, re-forging one line, gold rain, the rewind crank, the shatter, the rating star, the closing lid.
import { K, CODE, ink, rr, circ, ell, poly, rgba, mix, lg, rg, glow, beam, text, label, sparkle, shadowEll, TAU, clamp, lerp, rng, hash, ease, key, noise, smooth } from '../ink.js';
import { gl } from '../gl.js';
import { spring, ring, arc } from '../sim.js';
import { T, apply, toS, parts, pulse, hand, blit, hammer } from './answer_kit.js';
import { X, clock, heroLine, forgeParts, forgeLight, land, ground, fore, gateOpen, preLines } from './answer_forge.js';
import * as B from './answer_bot.js';
import * as A from './answer_gold.js';
import * as Q from './answer_glass.js';
import { coin } from '../coin.js';
import { tcoin, markCoin, markClock } from './answer_kit.js';
const [b0, b1, b2, b3] = T.b;
// ---- camera: [x, y, zoom, pitch]
const CAM = [[T.a - 0.6, [X(9) - 4020 * (T.hit - T.a + 0.6) - 270, -150, 0.9, 0]], [T.a + 0.25, [X(9) - 4020 * (T.hit - T.a - 0.25) - 250, -150, 0.9, 0], ease.lin], [T.hit - 0.28, [X(9) - 4020 * 0.28 + 10, -170, 0.96, 0], ease.lin], [T.hit + 0.16, [-30, -70, 1.0, 0], ease.out3], [T.pull + 0.1, [-10, -84, 1.0, 0]], [b0 - 0.06, [-30, -84, 1.0, 10]], [b0 + 0.06, [-50, -70, 1.05, 10], ease.out3], [b1 + 0.06, [0, -70, 1.04, 10]], [b2 + 0.06, [40, -70, 1.04, 10]], [b3 - 0.1, [10, -110, 0.97, 20]], [b3 + 0.08, [0, -70, 1.06, 20], ease.out3], [T.lock - 0.05, [10, -130, 1.0, 90]], [T.open + 0.3, [10, -226, 0.95, 190]], [T.five - 0.2, [30, -230, 0.96, 190]], [T.five + 0.1, [60, -236, 1.0, 190], ease.out2], [T.rain + 0.3, [60, -230, 0.97, 170]]];
export const addCam = k => CAM.push(...k);
let camF = null; const SHK = [[T.hit, 28], [b0, 15], [b1, 15], [b2, 16], [b3, 30], [T.lock, 16], [T.open + 0.12, 14], [T.five, 11]];
export const addShake = k => SHK.push(...k);
export function view(t) { camF ??= spring(T.a - 0.6, T.z, q => key(q + 0.13, CAM), 15, 1.0); const c = camF(t), s = SHK.reduce((a, [h, k]) => a + (t > h ? Math.exp(-(t - h) * 7.5) * k : 0), 0); return { x: c[0], y: c[1], z: c[2], pitch: c[3], sx: noise(t * 21, 3) * s, sy: noise(t * 21, 9) * s, r: noise(t * 16, 5) * s * 0.0005 }; }
B.EYES.push([T.hit - 0.1, T.hit + 0.5, 'wide'], [T.pull, b3 + 0.3, 'focus'], [b3 + 0.3, T.open, 'wide'], [T.open + 0.1, T.five + 0.9, 'happy']);
const speed = t => { const e = 0.02; return (view(t + e).x - view(t - e).x) / (2 * e); };
// ---- act two choreography: coins, hourglass, needle, bat, crank
const S = B.S, rr2 = (x, y, r) => { const c = Math.cos(r), s = Math.sin(r); return [x * c - y * s, x * s + y * c]; };
const standX = t => A.HUB[0] - 122 + Math.cos(A.crankA(t)) * 34;
const hangAt = (f, hx, hy) => t => { const h = f(t), q = rr2(hx * S, hy * S, B.rotS(t)); return [h[0] - q[0], h[1] - q[1]]; };
const FLOAT = [A.BATP[0] + 227, A.BATP[1] + 84];
B.addSegs([
  { a: T.sled, b: T.sled + 0.3, g: 2300 },
  { a: T.sled + 0.3, b: T.leap, F: t => [A.sledX(t), A.sledY(t) + 6] },
  { a: T.leap, b: T.rim, g: 2500 },
  { a: T.rim, b: T.flip + 0.1, F: t => A.hgRight(t) },
  { a: T.flip + 0.1, b: T.needle, g: 2300 },
  { a: T.needle, b: T.rel, p: hangAt(A.tip, 20, -352), trail: 1 },
  { a: T.rel, b: T.bat - 0.13, g: 1700 },
  { a: T.bat - 0.13, b: T.bat + 0.15, p: t => [FLOAT[0] + (t - T.bat) * 60, FLOAT[1] - Math.cos((t - T.bat) * 8) * 14] },
  { a: T.bat + 0.15, b: T.car, g: 2500 },
  { a: T.car, b: T.slip, F: t => [A.carX(t) + lerp(-250, standX(t), smooth(T.car, T.car + 0.24, t)) * A.CK, A.deck(t)[1]] },
  { a: T.slip, b: T.slip + 0.34, g: 2300 },
  { a: T.slip + 0.34, b: T.over + 0.1, F: t => [A.carX(t) - 330 * A.CK, A.deck(t)[1]] },
  { a: T.over + 0.1, b: T.over + 0.3, g: 2300 },
  { a: T.over + 0.3, b: T.crack, p: hangAt(A.handle, 10, -330), trail: 1 },
  { a: T.crack, b: T.fold, p: t => { const k = clamp((t - T.burst) / (T.fold - T.burst)), p0 = P0(), e = ease.out3(k), q = Q.W(450, 560); return [lerp(p0[0], q[0], e), lerp(p0[1], q[1], e) - Math.sin(k * Math.PI) * 130]; } },
  { a: T.fold, b: T.throw + 0.12, p: t => { const q = Q.W(450, 560), w = key(t, [[T.throw - 0.3, 0], [T.throw - 0.08, -46, ease.out2], [T.throw, 50, ease.in2], [T.throw + 0.12, 70]]); return [q[0] + w, q[1] + Math.sin((t - T.fold) * 4) * 10]; } },
  { a: T.throw + 0.12, b: Q.HOP[0], g: 1500 },
  ...[0, 1, 2, 3].flatMap(i => [{ a: Q.HOP[i], b: Q.HOP[i] + 0.05, F: Q.starTop(i) }, { a: Q.HOP[i] + 0.05, b: i < 3 ? Q.HOP[i + 1] : T.grab, g: i < 3 ? 5200 : 3600 }]),
  { a: T.grab, b: T.pop, F: t => Q.W(lerp(1474, 1590, ease.out2((t - T.grab) / (T.pop - T.grab))), Q.BAR + 6) },
  { a: T.pop, b: T.pop + 0.36, g: 2600 },
  { a: T.pop + 0.36, b: T.pop + 0.46, F: () => Q.W(1668, Q.BAR + 6) },
  { a: T.pop + 0.46, b: T.zed + 0.12, g: 2600 },
  { a: T.zed + 0.12, b: T.zed + 0.98, F: t => Q.W(lerp(985, 1175, ((t - T.zed - 0.12) / 0.86) ** 1.4), Q.BAR + 6) },
  { a: T.zed + 0.98, b: T.tail + 0.2, g: 1700 },
  { a: T.tail + 0.2, b: T.z, F: () => Q.W(430, Q.BAR + 6) },
]);
let p0 = null; const P0 = () => (p0 ??= B.body(T.crack - 1e-3)); const R1 = A.crankA(T.crack) - Math.PI / 2 + TAU, R2 = TAU * Math.ceil(R1 / TAU);
B.ROTF.push([T.over + 0.2, T.crack, t => A.crankA(t) - Math.PI / 2 + TAU], [T.crack, T.burst, () => R1]);
B.setScale([[T.over, S], [T.throw, S], [Q.HOP[0] - 0.2, 0.47]]);
const braceU = t => { const x = Q.W(0, 0)[0], bx = B.body(t)[0] - x + 74; let lo = 0.62, hi = 0.95; for (let i = 0; i < 18; i++) { const m = (lo + hi) / 2; Q.pathAt(m, t)[0] < bx ? (lo = m) : (hi = m); } return lo; };
const braceP = t => { const p = Q.pathAt(braceU(t), t); return Q.W(p[0], p[1]); };
B.addKeys({
  crouch: [[T.burst, 1], [T.fold, 0.95], [Q.HOP[0] - 0.02, 0.96], ...[0, 1, 2, 3].flatMap(i => [[Q.HOP[i] + 0.02, 0.62, ease.out2], [Q.HOP[i] + 0.08, 1]]), [T.grab, 0.9], [T.grab + 0.12, 0.6], [T.pop - 0.03, 0.56], [T.pop + 0.06, 0.95], [T.pop + 0.34, 0.9], [T.pop + 0.42, 0.56], [T.pop + 0.5, 1], [T.zed + 0.12, 0.9], [T.zed + 0.26, 0.6], [T.zed + 0.9, 0.56], [T.zed + 1.02, 1], [T.tail + 0.2, 0.9], [T.tail + 0.34, 0.5], [T.letter - 0.1, 0.6], [T.letter + 0.2, 0.98], [T.lid, 0.96], [T.lid + 0.18, 0.5, ease.out2]],
  rot: [[T.burst, R1], [T.fold, R2 - 0.05, ease.out2], [T.throw - 0.08, R2 - 0.22], [T.throw + 0.04, R2 + 0.3, ease.in2], [Q.HOP[0] - 0.1, R2 + TAU, ease.io2], [Q.HOP[3] + 0.04, R2 + TAU + 0.06], [T.grab - 0.02, R2 + TAU + 0.1], [T.grab + 0.1, R2 + TAU + 0.34], [T.pop - 0.02, R2 + TAU + 0.46], [T.pop + 0.3, R2 + TAU * 2, ease.out2], [T.zed, R2 + TAU * 2 - 0.2], [T.zed + 0.26, R2 + TAU * 2 - 0.42], [T.zed + 0.94, R2 + TAU * 2 - 0.36], [T.tail + 0.12, R2 + TAU * 3 - 0.1, ease.sine], [T.tail + 0.34, R2 + TAU * 3], [T.lid, R2 + TAU * 3]],
  yaw: [[T.crack, 0.8], [T.burst + 0.4, 0.2], [T.fold, 0.75], [T.throw, 0.9], [Q.HOP[3], 0.9], [T.grab, -0.9], [T.pop + 0.1, -0.9], [T.pop + 0.4, -0.8], [T.zed, 0.9], [T.tail, 0.8], [T.tail + 0.4, 0.2], [T.letter, 0.6], [T.claude + 0.4, 0.7], [T.lid, 0.15]],
  lean: [[T.throw - 0.08, -0.16], [T.throw + 0.05, 0.22, ease.in2], [T.throw + 0.4, 0], [T.grab, 0.08], [T.pop, 0.12], [T.pop + 0.3, 0], [T.zed + 0.3, -0.12], [T.zed + 0.95, -0.12], [T.tail + 0.3, 0.08], [T.letter, 0]],
  head: [[T.crack, 0], [T.fold, -0.1], [T.throw, 0.06], [T.grab, 0], [T.pop + 0.4, -0.1], [T.zed + 0.4, -0.06], [T.tail + 0.4, 0.16], [T.letter, -0.16], [T.lid, -0.2], [T.lid + 0.2, 0.1]],
  hands: [[T.crack, [-40, -350, 120, -350]], [T.burst + 0.3, [-230, -260, 240, -200]], [T.fold - 0.1, [-190, -130, 190, -190]], [T.fold + 0.24, [176, -230, 180, -120]], [T.throw - 0.09, [-120, -372, 190, -150], ease.out2], [T.throw, [226, -226, 150, -60], ease.in2], [T.throw + 0.2, [120, -90, 190, -90]], [Q.HOP[0], [-220, -260, 220, -260]], [Q.HOP[3], [-220, -260, 220, -260]], [T.grab, [-190, -160, -100, -170]], [T.pop, [-190, -160, -100, -170]], [T.pop + 0.12, [-230, -300, 220, -280]], [T.pop + 0.4, [-190, -60, 190, -60]], [T.zed, [100, -200, 200, -220]], [T.zed + 0.95, [100, -200, 200, -220]], [T.zed + 1.1, [-220, -320, 220, -320]], [T.tail + 0.2, [-210, -220, 210, -220]], [T.tail + 0.42, [-150, -150, 150, -260]], [T.letter - 0.1, [-160, -60, 120, -300]], [T.letter + 0.2, [-190, -260, 200, -270]], [T.claude, [-170, -80, 190, -150]], [T.lid, [-170, -90, 180, -110]], [T.lid + 0.16, [-110, -400, 110, -400], ease.out2]],
});
B.GRABS.push([T.grab - 0.02, T.pop, 2, t => { const s = Q.star5(t) || Q.W(1456, 590); return [s[0] + 40, s[1] + 4]; }], [T.zed + 0.1, T.zed + 0.98, 2, braceP]);
B.EYES.push([T.throw - 0.3, T.throw + 0.05, 'focus'], [T.throw + 0.1, Q.HOP[0], 'happy'], [Q.HOP[0], T.grab - 0.05, 'happy'], [T.grab, T.pop, 'focus'], [T.pop, T.zed, 'wide'], [T.zed + 0.1, T.zed + 0.95, 'focus'], [T.zed + 0.95, T.letter, 'wide'], [T.letter + 0.1, T.lid, 'happy'], [T.lid, T.z, 'wide']);
[[T.grab, -7], [T.pop + 0.36, -8], [T.zed + 0.12, -6], [T.tail + 0.2, -9]].forEach(q => B.landKick(...q));
B.addKeys({
  crouch: [[T.sled - 0.12, 0.62], [T.sled, 1], [T.sled + 0.26, 0.95], [T.sled + 0.42, 0.66], [T.sled + 0.7, 0.78], [T.leap - 0.1, 0.56], [T.leap + 0.02, 1.02], [T.rim, 0.92], [T.rim + 0.12, 0.7], [T.rim + 0.4, 0.95], [T.flip, 0.8], [T.flip + 0.1, 1], [T.car, 0.9], [T.car + 0.12, 0.66], [T.undo - 0.12, 0.96], [T.undo, 0.74], [T.slip, 0.8], [T.slip + 0.34, 0.8], [T.slip + 0.5, 0.5], [T.kept + 0.1, 0.55], [T.kept + 0.3, 0.98], [T.over - 0.1, 0.94], [T.over + 0.06, 0.64], [T.over + 0.14, 1]],
  rot: [[T.sled, 0], [T.sled + 0.2, 0.16], [T.sled + 0.5, -0.1], [T.leap - 0.1, 0.06], [T.leap + 0.36, TAU, ease.io2], [T.flip, TAU], [T.flip + 0.1, TAU - 0.2], [T.needle - 0.06, TAU * 2 - 0.4, ease.io2], [T.needle + 0.02, TAU * 2 - 0.5], [T.rel - 0.2, TAU * 2 + 0.9, ease.in2], [T.rel, TAU * 2 + 1.5], [T.bat - 0.12, TAU * 3 + 0.12, ease.out2], [T.bat + 0.02, TAU * 3 - 0.16], [T.bat + 0.2, TAU * 3 - 0.4], [T.car - 0.06, TAU * 2, ease.io2], [T.undo, TAU * 2 - 0.06], [T.slip - 0.02, TAU * 2 - 0.12], [T.slip + 0.3, TAU * 2 - 0.5, ease.out2], [T.slip + 0.5, TAU * 2 - 0.1], [T.kept + 0.2, TAU * 2], [T.over + 0.1, TAU * 2 + 0.2], [T.over + 0.3, TAU * 2 + 0.6]],
  yaw: [[T.sled, 0.6], [T.sled + 0.3, 1.0], [T.leap, 0.9], [T.rim + 0.1, 0.2], [T.flip, -0.3], [T.flip + 0.16, 0.9], [T.rel, 0.9], [T.max + 0.06, 0.6], [T.bat - 0.14, -0.95], [T.bat + 0.16, -0.95], [T.car, 0.6], [T.slip, 0.7], [T.slip + 0.2, 0.4], [T.kept + 0.3, 0.25], [T.over, 0.8]],
  lean: [[T.sled + 0.4, 0.14], [T.leap, 0.1], [T.rim + 0.2, 0], [T.bat - 0.12, 0.14], [T.bat, -0.2, ease.in2], [T.bat + 0.2, -0.1], [T.car, 0], [T.undo, -0.1], [T.slip, -0.12], [T.slip + 0.4, 0.1], [T.kept + 0.3, 0]],
  head: [[T.sled, 0], [T.rim + 0.2, 0.14], [T.flip, 0.1], [T.needle, -0.16], [T.rel, -0.3], [T.bat, 0], [T.car, 0.06], [T.undone, -0.16], [T.slip, -0.1], [T.slip + 0.5, -0.12], [T.kept + 0.2, -0.2], [T.over, 0]],
  hands: [[T.sled - 0.1, [-120, -40, 150, -40]], [T.sled + 0.2, [-210, -260, 220, -270]], [T.sled + 0.5, [-226, -170, 224, -120]], [T.leap - 0.1, [-180, -60, 200, -70]], [T.leap + 0.1, [-210, -300, 210, -300]], [T.rim + 0.1, [-236, -190, 236, -190]], [T.rim + 0.5, [-170, -90, 170, -90]], [T.flip, [-210, -230, 220, -230]], [T.needle - 0.14, [-60, -360, 120, -360]], [T.rel, [-60, -360, 120, -360]], [T.max, [-200, -260, 200, -200]], [T.bat + 0.3, [-200, -230, 210, -230]], [T.car, [-190, -240, 200, -240]], [T.undo - 0.1, [60, -150, 150, -190]], [T.slip, [60, -150, 160, -190]], [T.slip + 0.15, [-210, -280, 220, -300]], [T.slip + 0.5, [-190, -30, 190, -30]], [T.kept, [-180, -60, 180, -60]], [T.kept + 0.26, [-200, -320, 206, -320]], [T.take + 0.3, [-200, -300, 200, -300]], [T.over - 0.1, [-150, -110, 170, -190]], [T.over + 0.2, [-40, -350, 120, -350]]],
});
B.HELD.push([T.max + 0.02, T.bat + 0.3]);
B.HAM.push([T.max + 0.02, [40, -250, -2.2]], [T.bat - 0.2, [-70, -240, -2.9], ease.out2], [T.bat - 0.07, [-90, -216, -3.2]], [T.bat, [120, -150, 0], ease.in2], [T.bat + 0.1, [132, -150, 0.28], ease.out2], [T.bat + 0.3, [100, -110, 1.2]]);
B.GRABS.push([T.needle - 0.05, T.rel, 2, A.tip], [T.undo - 0.14, T.slip - 0.01, 2, A.handle], [T.over + 0.26, T.burst, 2, A.handle]);
B.FISTS.push([T.needle - 0.05, T.rel]);
[[T.sled + 0.3, -7], [T.rim, -8], [T.car, -8], [T.slip + 0.34, -8]].forEach(q => B.landKick(...q));
B.EYES.push([T.sled, T.leap + 0.1, 'happy'], [T.flip - 0.1, T.needle, 'wide'], [T.needle, T.rel + 0.1, 'wide'], [T.max, T.bat + 0.1, 'focus'], [T.bat + 0.2, T.car + 0.1, 'happy'], [T.undo - 0.1, T.undone, 'focus'], [T.undone, T.kept, 'wide'], [T.kept + 0.1, T.over - 0.2, 'happy'], [T.over - 0.1, T.burst + 0.4, 'wide']);
addCam([[T.sled, [300, -190, 0.96, 130]], [T.sled + 0.34, [900, -60, 0.95, 60]], [T.leap - 0.06, [2040, 190, 0.9, 0], ease.lin], [T.rim + 0.06, [2484, 566, 0.68, 0], ease.out2], [T.flip, [2510, 572, 0.69, 0]], [T.needle - 0.1, [3900, 720, 0.82, 0]], [T.needle + 0.12, [4240, 760, 0.86, 0], ease.out2], [T.rel, [4300, 740, 0.88, 0]], [T.max + 0.1, [4640, 470, 0.9, 0]], [T.bat - 0.12, [4990, 150, 1.02, 0]], [T.bat + 0.08, [4990, 140, 1.14, 0], ease.out3], [T.bat + 0.2, [5010, 120, 1.1, 0]], [T.car + 0.04, [5800, 120, 1.0, 0]], [T.undo, [5800, 120, 1.0, 0]], [T.undo + 0.55, [-30, 120, 1.0, 0], ease.io3], [T.undone, [-30, 120, 1.0, 0]], [T.undone + 0.1, [-30, 116, 1.02, 0]], [T.slip, [-30, 118, 1.0, 0]], [T.kept, [-30, 112, 1.03, 0]], [T.kept + 0.5, [-30, 120, 1.0, 0]], [T.crack, [-30, 120, 1.05, 0], ease.in2], [T.burst + 0.1, [-30, 120, 1.0, 0]], [T.gather, [-30, 112, 1.03, 0]], [T.fold, [-44, 104, 1.06, 0]], [T.throw, [-20, 110, 1.03, 0]], [T.stars + 0.2, [-30, 120, 1.0, 0]], [T.grab, [10, 124, 1.03, 0]], [T.pop - 0.02, [40, 120, 1.07, 0]], [T.pop + 0.14, [0, 112, 1.0, 0], ease.out3], [T.zed + 0.3, [-30, 116, 0.99, 0]], [T.tail, [-30, 110, 1.0, 0]], [T.letter, [-30, 108, 1.0, 0]], [T.letter + 0.12, [-30, 104, 1.07, 0], ease.out3], [T.claude + 0.2, [10, 112, 1.02, 0]], [T.z, [10, 112, 1.02, 0]]]);
addShake([[T.sled + 0.3, 14], [T.rim, 16], [T.flip + 0.04, 18], [T.needle, 12], [T.max, 30], [T.bat, 28], [T.car, 18], [T.undo + 0.4, 10], [A.STAMP[0], 20], [A.STAMP[1], 22], [T.kept, 22], [T.crack, 40], [T.burst, 46], [T.sheet, 18], [T.throw, 12], [T.catch, 14], ...Q.HOP.map(h => [h, 10]), [T.grab, 14], [T.pop, 30], [T.pop + 0.36, 14], [T.zed, 18], [T.tail + 0.2, 16], [T.letter, 16], [Q.SEAL, 26]]);
export const samples = (t, n) => (n < 3 ? n : n * ((t > T.undo && t < T.undo + 0.6) || Math.abs(t - T.hit) < 0.5 || (t > T.tail && t < T.letter) || Math.abs(t - T.pop - 0.2) < 0.3 || t > T.over + 0.2 && t < T.crack ? 3 : 2));
const codexP = spring(T.rim - 0.4, T.undo, t => (t < T.rim - 0.1 ? [2200, 60] : t < T.bat - 0.5 ? [1640, 300] : [2300, -100]), 9, 0.55);
const DEST = [[1370, 650], [1680, 650]], cpF = DEST.map((d, i) => spring(T.undone - 0.6, T.z, t => (t < T.undone - 0.1 + i * 0.12 ? [2180 + i * 160, 500] : t < T.over + 0.5 ? d : [2300, 300 + i * 200]), 9, 0.5));
function goldFront(x, t, w) {
  if (t > T.rim - 0.4 && t < T.bat) { const p = codexP(t), hs = toS(w, A.HG[0] + 120, A.HG[1] + 360), gs = toS(w, A.GA[0], A.GA[1] + 100); [0, 1, 2].forEach(i => { const a = clamp((t - T.rim - 0.24 - i * 0.12) / 0.5); if (a <= 0 || t > T.needle + 0.2) return; const an = i * 2.1 + t * 2.2, q = [lerp(hs[0], p[0] + Math.cos(an) * 140, ease.io3(a)), lerp(hs[1], p[1] + Math.sin(an) * 140, ease.io3(a)) - Math.sin(a * Math.PI) * 160]; tcoin(x, q[0], q[1], lerp(44, 34, a), 0, a * 9, i); }); const a = clamp((t - T.rel + 0.1) / 0.5); if (a > 0) { const an = t * 2.2; markCoin(x, lerp(gs[0], p[0] + Math.cos(an) * 140, ease.io3(a)), lerp(gs[1], p[1] + Math.sin(an) * 140, ease.io3(a)) - Math.sin(a * Math.PI) * 120, lerp(60, 38, a), 0, 'clock', markClock, Math.cos(a * TAU)); } coin(x, 'codex', p[0], p[1], 98, t, { name: 'Codex' }); }
  if (t > T.undone - 0.3 && t < T.burst) { const D = cpF.map(f => f(t)); ['zed', 'copilot'].forEach((n, i) => { const p = D[i], got = [T.slip + 0.36 + i * 0.1, T.take + 0.54 + i * 0.1].reduce((a, q) => a + ring(t, q, 5, 7), 0); if (p[0] < 2150) coin(x, n, p[0], p[1], 94 * (1 + got * 0.08), t, { name: ['Zed', 'GitHub Copilot'][i] }); }); A.tokens(x, t, w, D); }
}
// ---- the literal choice: an editor's Keep / Undo bar; the pointer clicks Undo (the forge runs backwards), then Keep
function keepBar(x, t) {
  const t0 = word('e2', 5.75) - 0.15, t1 = T.kept + 1.7; if (t < t0 - 0.05 || t > t1 + 0.4) return;
  const a = ease.out3(clamp((t - t0) / 0.35)) * (1 - ease.in2(clamp((t - t1) / 0.35))), X = 1020, Y = 444, W = 640, H = 92;
  x.save(); x.globalAlpha *= a; x.translate(0, (1 - a) * 14);
  x.save(); x.shadowColor = 'rgba(4,2,26,0.5)'; x.shadowBlur = 24 * x.getTransform().a; x.shadowOffsetY = 8 * x.getTransform().a; x.fillStyle = 'rgba(18,14,48,0.92)'; x.fill(KR(X, Y, W, H, 18)); x.restore();
  x.strokeStyle = 'rgba(220,212,255,0.18)'; x.lineWidth = 1.5; x.stroke(KR(X + 0.75, Y + 0.75, W - 1.5, H - 1.5, 17));
  KT(x, 'auth.js', X + 28, Y + 30, '#ffffff', 22, { w: 700, align: 'left' }); KT(x, '1 change', X + 28, Y + 58, 'rgba(210,200,245,0.7)', 18, { w: 600, align: 'left' });
  const undoOn = t > T.undo - 0.05 && t < T.kept - 0.05, keepOn = t > T.kept - 0.05, press = q => clamp(1 - Math.abs(t - q) / 0.1);
  const btn = (s, cx, on, col, p) => { const bw = 150, bh = 50, k = 1 - p * 0.06; x.save(); x.translate(cx, Y + H / 2); x.scale(k, k); x.fillStyle = on ? col : 'rgba(255,255,255,0.07)'; x.fill(KR(-bw / 2, -bh / 2, bw, bh, 12)); x.strokeStyle = on ? col : 'rgba(220,212,255,0.35)'; x.lineWidth = 2; x.stroke(KR(-bw / 2, -bh / 2, bw, bh, 12)); KT(x, s, 0, 1, on ? '#0e0a26' : '#ffffff', 23, { w: 800 }); x.restore(); };
  const KX = X + 330, UX = X + 500; btn('Keep', KX, keepOn, '#6ff0b0', press(T.kept - 0.05)); btn('Undo', UX, undoOn, '#cfc6ff', press(T.undo - 0.05));
  // the pointer: in from the right, to Undo, then across to Keep
  const path = key(t, [[t0, [X + W + 140, Y + 170]], [T.undo - 0.4, [UX + 16, Y + 50], ease.io3], [T.undo + 0.25, [UX + 16, Y + 50]], [T.kept - 0.35, [KX + 16, Y + 50], ease.io3], [T.kept + 0.6, [KX + 16, Y + 50]], [t1, [KX + 120, Y + 190], ease.io2]]), pr = Math.max(press(T.undo - 0.05), press(T.kept - 0.05));
  x.save(); x.translate(path[0], path[1]); x.scale(1 - pr * 0.12, 1 - pr * 0.12); x.fillStyle = '#ffffff'; x.strokeStyle = '#120a36'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 0); x.lineTo(0, 34); x.lineTo(9, 26); x.lineTo(16, 40); x.lineTo(22, 37); x.lineTo(15, 23); x.lineTo(27, 23); x.closePath(); x.fill(); x.stroke(); x.restore();
  x.restore();
}
// ---- comet: the answer, still hot
function cometDraw(x, t, w) { if (t > T.hit) return; const pts = []; for (let k = 0; k <= 70; k++) { const u = k / 70, c = B.comet(t - u * 0.34), q = toS(w, c[0], c[1] + Math.sin(u * 9 - t * 16) * 26 * u); pts.push([q[0], q[1], (70 * (1 - u * 0.8) * Math.min(1, u * 7 + 0.25)) * w.z, u * 5 - t * 6, u * 900]); } const G = gl(); G.clear(); G.silk({ pts, c: CODE.need, seed: 4, t }); G.to(x); const c = toS(w, ...B.comet(t)), L = []; for (let i = 0; i < 90; i++) { const a = (t * 2.2 + hash(i)) % 1, te = t - a * 0.5, q = B.comet(te), s = toS(w, q[0] - a * 60, q[1] + (hash(i * 3) - 0.5) * (40 + a * 200)); L.push([s[0], s[1], -40 * (1 - a), 0, (3 + hash(i * 5) * 9) * (1 - a), hash(i * 7) > 0.6 ? 3 : 2, hash(i * 9) > 0.5 ? '#eafff6' : '#5dffc8', 0.9 * (1 - a)]); } G.clear(); G.parts(L); G.to(x); glow(x, c[0], c[1], 420, '#5dffc8', 0.8); glow(x, c[0], c[1], 170, '#ffffff', 0.95); ink(x, ell(c[0] + 14, c[1], 74, 58), { f: ['#ffffff', '#dcfff0', '#4fe8b4'], r: [0.6, 0.4, 0.8] }); }
function seamIn(x, t) { const k = 1 - ease.io2(clamp((t - T.a - 0.16) / 0.5)); if (k <= 0) return; x.save(); x.globalAlpha = k; x.fillStyle = lg(x, 0, 0, 1920, 0, ['#5dffc8', '#8fffd6', '#e8fff6']); x.fillRect(0, 0, 1920, 1080); x.restore(); const L = []; for (let i = 0; i < 80; i++) { const p = ((hash(i) * 2600 - t * (3600 + hash(i * 3) * 3600)) % 2600 + 2600) % 2600 - 340; L.push([p, hash(i * 7) * 1080, -(160 + hash(i * 9) * 420), 0, 2 + hash(i * 11) * 7, 2, hash(i * 13) > 0.5 ? '#ffffff' : '#c8ffe6', 0.8 * k]); } const G = gl(); G.clear(); G.parts(L); G.to(x); }
function fiveHand(x, t) { const d = t - T.five, w0 = B.toW(T.five, [214, -316]); if (d < -0.62 || d > 0.85) return; let px, py, r, sq = 0; if (d < 0) { const u = clamp((d + 0.6) / 0.6), e = u < 0.62 ? ease.out3(u / 0.62) * 0.72 : u < 0.8 ? 0.72 - 0.07 * Math.sin((u - 0.62) / 0.18 * Math.PI / 2) : lerp(0.65, 1, ease.in2((u - 0.8) / 0.2)); px = lerp(w0[0] + 760, w0[0] + 78, e); py = lerp(w0[1] - 560, w0[1] + 6, e); r = lerp(0.5, -0.12, e); } else { const b = ease.out3(clamp(d / 0.16)) * 60; px = w0[0] + 78 + b + ease.in2(clamp((d - 0.3) / 0.55)) * 700; py = w0[1] + 6 - b * 0.3 - ease.in2(clamp((d - 0.3) / 0.55)) * 760; r = -0.12 + ring(t, T.five, 4, 5) * 0.3 + clamp((d - 0.3) / 0.5) * 0.5; sq = Math.exp(-d * 16); } x.save(); x.translate(px, py); x.rotate(r); x.scale(0.62 * (1 - sq * 0.16), 0.62 * (1 + sq * 0.1)); blit(x, hand(), -260, -300); x.restore(); }
function confetti(t) { const L = [], run = (t0, ox, oy, n, sp, sd) => { const d = t - t0; if (d <= 0 || d > 2.4) return; for (let i = 0; i < n; i++) { const h = q => hash(sd + i * 41 + q * 7), an = -Math.PI * (0.12 + h(1) * 0.76), v = sp * (0.35 + h(2) * 0.9), dr = 1 - Math.exp(-d * 2.1), px = ox + Math.cos(an) * v * dr * 0.62 + Math.sin(d * (2 + h(3) * 4) + i) * 26, py = oy + Math.sin(an) * v * dr * 0.62 + 170 * d * d, tw = Math.cos(d * (6 + h(4) * 10) + i), al = clamp((2.3 - d) / 0.5); L.push([px, py, Math.cos(i + d * 4) * 11, Math.sin(i + d * 4) * 11, 2 + 5.5 * Math.abs(tw), h(5) > 0.82 ? 3 : 5, ['#5dffc8', '#ffffff', '#7ee6ff', '#b9a2ff', '#2ff0a6'][i % 5], al]); } }; run(T.open + 0.04, -330, -120, 90, 1500, 5); run(T.open + 0.04, 330, -120, 90, 1500, 905); return L; }
const CR1 = [1570, 320], CL2 = [1490, 420], slide = (a, b, p, off, w = 9, z = 0.52) => spring(T.crack, T.z, t => (t > a && t < b ? p : off), w, z), claude1 = slide(T.gather, T.catch + 0.5, CR1, [2250, 120]), claude2 = slide(T.letter - 0.5, T.z + 9, CL2, [2250, 240]), zedP = slide(T.hop + 0.2, T.tail + 0.15, Q.ZED, [2250, 140]);
const sub = (x, s, px, py, size, t, t0, t1) => { const a = clamp((t - t0) / 0.25) * (1 - clamp((t - t1) / 0.2)); if (a <= 0) return; x.save(); x.globalAlpha *= a; x.shadowColor = 'rgba(40,0,90,0.8)'; x.shadowBlur = 18 * x.getTransform().a; text(x, s, px, py, '#fff', size, { w: 700 }); x.restore(); };
const labels = (x, t) => {
  label(x, 'The answer', 960, 96, 74, t, b3 + 0.12, T.rain + 0.1, 'need');
  label(x, 'Token counts', 560, 96, 74, t, T.leap - 0.2, T.flip + 0.05, 'extra'); label(x, 'Speed', 380, 110, 74, t, T.needle - 0.3, T.max + 0.4, 'extra'); label(x, 'Errors', 960, 96, 74, t, T.max + 0.16, T.undo + 0.5, 'extra'); label(x, 'Kept or undone edits', 448, 96, 74, t, T.undo + 0.62, T.over + 0.4, 'extra');
  label(x, 'Crash reports', 960, 96, 74, t, T.gather + 0.05, T.catch + 0.12, 'extra'); label(x, 'Ratings', 960, 96, 74, t, T.catch + 0.22, T.pop + 0.5, 'choice'); label(x, 'Feedback', 960, 96, 74, t, T.tail + 0.1, T.lid + 0.02, 'choice');
};
// everything up to the crash
function forge(x, t, o = {}) {
  const w = view(t), u = clock(t), v = A.gclock(t), op = u > T.open ? gateOpen(u) : 0, gold = smooth(T.rain + 0.1, T.leap - 0.1, t) * (1 - smooth(T.undo + 0.2, T.undo + 0.5, t)), crank = smooth(T.undo, T.undo + 0.3, t), e = { gold, crank, open: op * (1 - gold), u, pitch: w.pitch, gs: 0.03 * clamp(op) - 0.25 * crank, gy: -58 * crank, lift: 104 * crank }, sp = speed(t), act2 = t > T.rain - 0.3 && t < T.undo + 0.7;
  land(x, t, w, e); ground(x, w, e);
  x.save(); apply(x, w); if (act2) { if (Math.abs(w.x - A.GA[0]) < 1900) A.gauge(x, v, t); A.hourglass(x, v, t, 0); A.hill(x, t, w); } preLines(x, w); x.restore(); if (!o.noBot) seamIn(x, t); cometDraw(x, t, w); x.save(); apply(x, w); if (w.x < 2400) heroLine(x, u, t); if (act2) { A.avalanche(x, t, w, 0); A.avalanche(x, t, w, 1); A.sled(x, t); A.hourglass(x, v, t, 1); A.floorGold(x, t, w); } A.rail(x, w, t); A.belt(x, t); if (t > T.bat - 0.3) A.car(x, t); x.restore();
  if (!o.noBot) B.scarf(x, t, w);
  x.save(); apply(x, w); if (t > T.hit && t < T.pull) { const d0 = T.hit + 0.04, p1 = B.hamWorld(T.pull); if (t > d0) { const q = arc(t, d0, [X(9), -70], T.pull, p1, 2400); x.save(); x.translate(q[0], q[1]); x.rotate(p1[2] - (T.pull - t) * 13); x.scale(B.S, B.S); glow(x, 150, 0, 340, '#8fffd6', 0.6); hammer(x, clamp((T.pull - t) * 2.4)); x.restore(); } }
  let extra = A.shard(x, t);
  if (!o.noBot) B.draw(x, t, { heat: clamp(b.reduce((a, q) => a + (t > q ? Math.exp(-(t - q) * 3) : 0), 0)), backHammer: t > T.lock + 0.12 && t < T.max + 0.02, look: t > b3 + 0.2 && t < T.five - 0.4 ? [0.2, -0.4] : [0.35, 0.1], key: gold > 0.5 ? '#ffe9b0' : t > T.open && t < T.undo ? '#ffffff' : '#bfffe8', fill: gold > 0.4 ? '#ffb04a' : '#6fb8ff' });
  if (t > T.bat + 0.3 && t < T.bat + 1.3) { const h = B.hamWorld(T.bat + 0.299), d = t - T.bat - 0.3; x.save(); x.translate(h[0] - 500 * d, h[1] - 200 * d + 1500 * d * d); x.rotate(h[2] + d * 13); x.scale(-S, S); hammer(x, 0); x.restore(); }
  fiveHand(x, t); forgeLight(x, u); if (t > T.bat && t < T.bat + 0.5) { const d = t - T.bat; glow(x, A.BATP[0] + 60, A.BATP[1], 300, '#fff0c0', 0.75 * Math.exp(-d * 14)); if (d < 0.16) { x.save(); x.globalCompositeOperation = 'lighter'; x.translate(A.BATP[0] + 70, A.BATP[1]); for (let i = 0; i < 14; i++) { const a = i * TAU / 14 + 0.2, l = (120 + hash(i * 7) * 260) * Math.min(1, d / 0.03) * (1 - d / 0.17); x.fillStyle = 'rgba(255,246,210,0.9)'; x.beginPath(); x.moveTo(Math.cos(a) * l, Math.sin(a) * l); x.lineTo(Math.cos(a + 0.09) * 26, Math.sin(a + 0.09) * 26); x.lineTo(Math.cos(a - 0.09) * 26, Math.sin(a - 0.09) * 26); x.fill(); } x.restore(); } pulse(x, A.BATP[0], A.BATP[1], d / 0.5, 560, '#ffd27a', 30); } if (t > T.max && t < T.max + 0.5) { const q = A.tip(T.max + 0.1); glow(x, q[0], q[1], 520, '#ffb04a', 0.9 * Math.exp(-(t - T.max) * 8)); pulse(x, q[0], q[1], (t - T.max) / 0.5, 460, '#ffd27a', 26); } const rp = act2 ? A.rain(x, t) : []; x.restore();
  parts(x, w, forgeParts(u).concat(t < T.undo ? confetti(t) : [], rp, extra, A.overParts(t))); if (t > T.five && t < T.five + 0.6) { const c = toS(w, ...B.toW(T.five, [240, -330])); pulse(x, c[0], c[1], (t - T.five) / 0.5, 360, '#ffffff', 26); pulse(x, c[0], c[1], (t - T.five - 0.05) / 0.5, 230, K.cyan, 18); }
  if (!o.noBot) { if (t > T.a + 0.6) fore(x, w, t, sp, gold); goldFront(x, t, w); }
}
// the crash and after
let snap = null; const snapshot = x => { const W2 = x.canvas.width, H2 = x.canvas.height; if (!snap || snap.width !== W2) { snap = new OffscreenCanvas(W2, H2); const g = snap.getContext('2d'); g.setTransform(W2 / 1920, 0, 0, H2 / 1080, 0, 0); g.save(); forge(g, T.crack, { noBot: true }); g.restore(); } return snap; };
function glass(x, t) {
  const w = view(t), dest1 = claude1(t), dest2 = claude2(t), frozen = t < T.burst, handR = q => B.handW(q, 0), w1 = p => [(p[0] - 960 - w.sx) / w.z + w.x, (p[1] - 540 - w.sy) / w.z + w.y];
  if (frozen) { const s = snapshot(x); x.save(); x.translate(960, 540); const k = 1 + 0.03 * clamp((t - T.crack) / 0.24); x.scale(k, k); x.translate(-960 + noise(t * 50, 2) * 8, -540 + noise(t * 50, 4) * 8); x.drawImage(s, 0, 0, 1920, 1080); Q.cracks(x, t, s); x.restore(); B.scarf(x, t, w); x.save(); apply(x, w); B.draw(x, t, {}); x.restore(); return; }
  Q.rose(x, t, w); x.save(); apply(x, w); Q.ratingBack(x, t); x.restore();
  if (t < T.sheet + 0.14) Q.shards(x, t, snapshot(x));
  const coinAt = (n, f, nm, R) => { const p = f(t); if (p[0] < 2150) shadowEll(x, p[0], p[1] + R * 1.95, 230, 120, '#1a0668', 0.62), coin(x, n, p[0], p[1], R, t, { name: nm }); };
  if (t < T.catch + 1.2) coinAt('claude', claude1, 'Claude Code', 104); if (t > T.letter - 0.6) coinAt('claude', claude2, 'Claude Code', 110);
  sub(x, 'Pro, Max and Ultra', dest1[0], dest1[1] + 234, 34, t, T.sheet + 0.1, T.catch + 0.45); sub(x, 'kept five years', dest2[0], dest2[1] + 250, 44, t, T.letter + 0.2, T.lid + 0.1);
  x.save(); apply(x, w); Q.rating(x, t); x.restore(); Q.ribbon(x, t, w); if (t > T.stars && t < T.tail + 0.8) coinAt('zed', zedP, 'Zed', 104 * (1 + (t > T.zed && t < T.tail ? 0.04 * Math.sin(t * 24) : 0) + ring(t, T.zed, 4, 5) * 0.14));
  const held = t > T.fold + 0.2 && t < T.throw - 0.02; if (held) { x.save(); apply(x, w); Q.crash(x, t, handR, w1(CR1)); x.restore(); }
  B.scarf(x, t, w); x.save(); apply(x, w); B.draw(x, t, { key: '#ffe0f2', fill: '#8fb8ff', jet: (t > T.burst + 0.5 && t < Q.HOP[0] - 0.1) ? 0.5 * clamp((t - T.burst - 0.5) / 0.3) : 0, look: t > T.pop && t < T.lid ? [0.3, -0.3] : [0.35, 0] }); if (!held) Q.crash(x, t, handR, w1(CR1)); Q.letter(x, t, w1(CL2)); x.restore();
  const sk = []; if (t > T.zed + 0.16 && t < T.zed + 0.98) for (let i = 0; i < 40; i++) { const a = ((t * 3 + hash(i)) % 1) * 0.3, o = Q.W(0, 0), bx = B.body(t - a); sk.push([bx[0] - 30 - (200 + hash(i * 3) * 500) * a, Q.W(0, Q.BAR)[1] - (100 + hash(i * 5) * 400) * a + 500 * a * a, -14, -6, 2 + hash(i * 7) * 4, 2, i % 2 ? '#ffffff' : '#ffb0de', 1 - a / 0.3]); }
  parts(x, w, Q.glassDust(t).concat(Q.planeTrail(t, handR, w1(CR1)), Q.ribbonParts(t), sk));
  if (t > T.catch && t < T.catch + 0.5) pulse(x, dest1[0], dest1[1], (t - T.catch) / 0.5, 330, '#ffd67a', 22); if (t > T.zed && t < T.zed + 0.5) pulse(x, Q.ZED[0], Q.ZED[1], (t - T.zed) / 0.5, 360, '#ffb0de', 24); const tk = T.claude + 0.46; if (t > tk && t < tk + 0.5) pulse(x, dest2[0], dest2[1], (t - tk) / 0.5, 360, '#ffb0de', 24);
}
let buf = null;
export function draw(x, t) {
  const b4 = t < T.crack, sc = (c, q) => { (b4 ? forge : glass)(c, q); labels(c, q); };
  if (t < T.lid) { sc(x, t); keepBar(x, t); } else { const W2 = x.canvas.width, H2 = x.canvas.height; if (!buf || buf.width !== W2) buf = new OffscreenCanvas(W2, H2); const g = buf.getContext('2d'); g.setTransform(W2 / 1920, 0, 0, H2 / 1080, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.save(); sc(g, t); g.restore(); Q.lid(x, t, buf); }
  const rw = smooth(T.undo + 0.1, T.undo + 0.3, t) * (1 - smooth(T.undone, T.undone + 0.15, t)) + smooth(T.slip, T.slip + 0.1, t) * (1 - smooth(T.kept - 0.05, T.kept + 0.1, t)) * 0.8;
  if (rw > 0.01) { x.save(); x.globalCompositeOperation = 'lighter'; [0, 1, 2].forEach(i => { const d = t < T.slip ? -1 : 1, y = (((t * (520 + i * 170) * d + i * 420) % 1300) + 1300) % 1300 - 110, h2 = 34 + i * 22; x.fillStyle = lg(x, 0, y, 0, y + h2, ['rgba(160,230,255,0)', `rgba(170,235,255,${0.1 * rw})`, 'rgba(160,230,255,0)']); x.fillRect(0, y, 1920, h2); x.fillStyle = `rgba(220,245,255,${0.16 * rw})`; x.fillRect(hash(i + Math.floor(t * 20)) * 900, y + h2 * 0.5, 500 + hash(i * 3 + Math.floor(t * 20)) * 700, 2); }); x.restore(); }
  return { ca: 0.003 + 0.004 * rw, bloom: 0.3, vig: t > T.lid ? 0.28 * (1 - clamp((t - T.lid) / 0.5)) : 0.28, grain: 0.032, sat: 1.06 };
}
const b = T.b;
