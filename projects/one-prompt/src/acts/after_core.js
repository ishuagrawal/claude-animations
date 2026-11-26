// The journey after the laptop closes: beat times, one continuous world, the robot's path through it, acting and camera.
// World pixels, y down. planet top (0,0) -> hill -> rapids -> cavern -> reading corridor -> plaza -> cloud -> disk -> street -> tube -> night.
import { K, ink, rr, circ, ell, poly, blob, rgba, mix, lg, rg, glow, TAU, clamp, lerp, hash, ease, spline, key, noise, inv } from '../ink.js';
import { gl } from '../gl.js';
import { bot } from '../bot.js';
import { spring, chain, ring, arc } from '../sim.js';
import { C, word, SEAM } from '../timeline.js';
export const S0 = C.f1 - 0.25, S1 = C.g1 - 0.3 + SEAM, SC = 0.56;
const W = word;
export const T = {
  pull: C.f1 - 0.02, full: W('f1', 3) - 0.08, dark: W('f1', 3) + 0.2, out: W('f1', 4) + 0.12, swing: W('f1', 7), thr: W('f1', 9) - 0.12, cat: W('f1', 9) + 0.27, yank: W('f1', 9) + 0.52,
  crash: C.f2 + 0.14, c0: C.f2 + 0.42, c30: W('f2', 3) + 0.2, crum: W('f2', 4) + 0.08, lev: W('f2', 6) + 0.12, clunk: W('f2', 6) + 0.5, y0: W('f2', 6) + 0.5, y5: W('f2', 9) + 0.1, pop: C.f2e + 0.08, raft: C.f3 + 0.1,
  lip: W('f3', 3) + 0.05, land: W('f3', 5) + 0.3, abs: W('f3', 7) + 0.02, grow: W('f3', 8) - 0.05, wheel: W('f3', 9) + 0.16, h1: W('f3', 10) - 0.02, h2: W('f3', 11) - 0.04, h3: W('f3', 12) - 0.06, shut: W('f3', 12) + 0.1,
  jet: W('f3', 13) - 0.04, cor: W('f3', 13) + 0.36, sneak: W('f3', 14) + 0.2, duck: W('f3', 15) + 0.3, sprint: C.f3e + 0.12, leap: C.f4 - 0.28, grab: C.f4 - 0.04,
  rel: W('f4', 3) - 0.06, awn: W('f4', 3) + 0.2, hook: W('f4', 6) - 0.1, tr: W('f4', 6) + 0.05, drop: W('f4', 9) - 0.1, hop: W('f4', 9) + 0.28, chute: W('f4', 10) + 0.1, disk: W('f4', 11) + 0.18, fling: C.f5 + 0.02, street: C.f5 + 0.8,
  slap: W('f5', 10) + 0.02, suck: W('f5', 11) + 0.2, boom: W('f5', 13) - 0.1, out2: C.g1 - 0.3,
};
// ---- geography
export const PR = 2600, hillY = x => PR - Math.sqrt(Math.max(0, PR * PR - x * x));
export const JL = -570, JR = 560, PH = 150, JH = 560, JW = 440, LEV = [-5, -218], LL = 290;
const RP = [[700, 96], [900, 161], [1060, 226], [1180, 290], [1330, 420], [1540, 520], [1780, 620], [2060, 950], [2340, 1050], [2580, 1150], [2830, 1410], [3000, 1500], [3200, 1560]]; export const rapY = x => spline(x, RP);
export const LIP = [3000, 1500], WL = 2540, KC = [4500, 2040], GX = [3583, 4069, 5389], GLY = 2010, KX = 4764, WHL = [5668, 2320], WR = 132, LEDGE = 2470, CW = 5900, XP = 8100, CF = 2490;
export const CHA = [XP + 40, 1960], CHB = [XP + 2450, 2960], chY = x => lerp(CHA[1], CHB[1], (x - CHA[0]) / (CHB[0] - CHA[0])) + Math.sin(clamp((x - CHA[0]) / (CHB[0] - CHA[0])) * Math.PI) * 60, PG = 3480, SCR = [XP + 1480, 2650, 1120, 620], AW = [XP + 2700, 3250];
export const CC = [XP + 3740, 1830], OT = [XP + 3110, 2226], CT = [XP + 4360, 2226], BLK = 108, JIB = 1446, MAST = XP + 4700, CH0 = [XP + 4900, 2080], DC = [XP + 6150, 3560, 900, 262], CH1 = [DC[0] + Math.cos(-2.35) * DC[2] * 0.8, DC[1] + Math.sin(-2.35) * DC[3] * 0.8];
export const AF = XP + 7480, SG = 3900, SEE = XP + 11560, TUBE = XP + 12090, TM = 3330;
const J = (t, t0, p0, t1, p1, g = 2600) => arc(t, t0, p0, t1, p1, g);
// ---- orbit stage
export const OR = { rx: 5000, ry: 1180, c: [0, PR] }, HOUSE = -0.6;
export const houseP = [Math.sin(HOUSE) * (PR + 90), PR - Math.cos(HOUSE) * (PR + 90)];
export const PHI = t => { const a = Math.max(0, t - T.out); return 1.22 * a + 0.85 * (1 - Math.exp(-a * 2.2)); };
export const orbitAt = (phi, R, k = 1) => { const c = Math.cos(phi), s = Math.sin(phi), ox = -c * OR.rx * k, oy = s * OR.ry * k + c * 700 * k; return [lerp(houseP[0], OR.c[0] + ox, R), lerp(houseP[1], OR.c[1] + oy, R) - Math.sin(R * Math.PI) * 1500, s]; };
const PH0 = Math.PI * 0.5 - (PHI(W('f1', 8)) ); export const myPhi = t => PH0 + PHI(t);
const persp = s => 3.5 * (1 + 0.3 * s);
const bez = (a, b, c, d, u) => { const v = 1 - u; return [0, 1].map(i => v * v * v * a[i] + 3 * v * v * u * b[i] + 3 * v * u * u * c[i] + u * u * u * d[i]); };
export const leverA = t => { const u = ease.in2(clamp((t - T.lev) / (T.clunk - T.lev))); const back = ease.out3(clamp((t - T.pop - 0.05) / 0.2)); return lerp(lerp(-0.72, 0.72, u), -0.5, back) + ring(t, T.clunk, 5, 7) * -0.12 + ring(t, T.crash, 4, 5) * 0.05 + ring(t, T.pop + 0.2, 4, 4) * 0.2; };
export const knob = t => { const a = leverA(t); return [LEV[0] + Math.sin(a) * LL, LEV[1] - Math.cos(a) * LL]; };
// body angle while hanging on the lever: trails out, then flags leftwards in the storm
const levHang = spring(T.lev - 0.3, T.pop + 0.4, t => (t < T.clunk ? lerp(0.1, -1.9, inv(T.lev, T.clunk, t)) : t < T.clunk + 0.35 ? 0.35 : -1.45 - 0.22 * Math.sin(t * 13) - 0.14 * Math.sin(t * 21)), 11, 0.35);
const HLEN = cr => (345 + 158 * cr + 8) * SC;
export const wind = t => clamp((t - T.clunk - 0.3) / 0.25) * (1 - clamp((t - T.pop - 0.2) / 0.3));
// raft
export const BR = 104; export const raftX = t => { const u = inv(T.raft, T.lip, t); return lerp(1450, LIP[0], 0.45 * u + 0.55 * u * u * (1.5 - 0.5 * u)); };
const bob = spring(T.raft - 0.2, T.abs + 0.5, t => (t < T.raft ? 0 : Math.sin(t * 15) * 9), 22, 0.22, [[T.raft, 620], [T.land, 900]]);
const warp = u => u + 0.62 * Math.sin(u * TAU) / TAU;
export const raft = t => { if (t < T.lip) { const x = raftX(Math.max(t, T.raft)); return [x, rapY(x) - BR + 34 + bob(t)]; } if (t < T.land) { const u = warp(inv(T.lip, T.land, t)), q = arc(u, 0, [LIP[0], rapY(LIP[0]) - BR + 30], 1, [4230, WL - BR + 40], 1900); return [q[0], q[1]]; } const u = ease.io2(inv(T.land, T.abs, t)); return [lerp(4230, 4380, u), WL - BR + 40 + bob(t)]; };
// crystal growth 0..1 with kicks
export const grow = t => 0.34 + 0.12 * ease.back(clamp((t - T.land - 0.1) / 0.5)) + 0.5 * ease.back(clamp((t - T.grow) / 0.55), 2.2) + 0.04 * Math.sin(t * 2.2);
// wheel angle in heaves
export const wheelA = t => -[T.h1, T.h2, T.h3].reduce((a, h, i) => a + 1.25 * ease.back(clamp((t - h) / 0.3), 0.8), 0);
export const doorU = t => clamp([T.h1, T.h2, T.h3].reduce((a, h, i) => a + [0.3, 0.3, 0.4][i] * (i < 2 ? ease.out2(clamp((t - h) / 0.28)) : ease.in2(clamp((t - h) / (T.shut - T.h3)))), 0));
const heaves = [T.h1, T.h2, T.h3];
const heaveU = t => { let h = -1; heaves.forEach((q, i) => { if (t >= q - 0.26) h = i; }); if (h < 0) return 0; const q = heaves[h]; return t < q ? -ease.io2(clamp((t - q + 0.26) / 0.22)) : lerp(-1, 1, ease.out3(clamp((t - q) / 0.24))) * (1 - ease.io2(clamp((t - q - 0.32) / 0.2))); };
const heaveS = spring(T.wheel - 0.3, T.jet + 0.2, t => heaveU(t) * (1 - clamp((t - T.jet + 0.16) / 0.12)), 30, 0.62);
// zip
export const zipX = t => { const u = inv(T.grab, T.rel, t); return lerp(CHA[0] + 190, CHB[0] - 170, 0.3 * u + 0.7 * Math.pow(u, 1.7)); };
const zipHang = spring(T.grab - 0.3, T.rel + 0.2, t => (t < T.grab ? 0.7 : -0.34 - 0.0 * t), 8, 0.22, [[T.grab, 5]]);
// trolley and the hooked block
export const trolX = t => key(t, [[T.hook - 2, OT[0] + 120], [T.hook - 0.3, OT[0] + 280, ease.io2], [T.hook, OT[0] + 330, ease.io2], [T.tr, OT[0] + 360], [T.drop - 0.16, CT[0], ease.io3], [T.drop + 2, CT[0]]]);
export const cableA = spring(T.hook - 1.2, T.drop + 0.6, t => { const e = 0.03, v = (trolX(t + e) - trolX(t - e)) / (2 * e); return t > T.drop ? 0 : clamp(-v * 0.00022, -0.4, 0.4); }, 7, 0.16, [[T.hook, 1.1]]);
export const cableL = t => key(t, [[T.hook - 1.2, 400], [T.hook - 0.5, 336, ease.io2], [T.tr, 336], [T.drop - 0.2, 336], [T.drop, CT[1] - BLK * 4 - JIB, ease.in2], [T.drop + 0.1, CT[1] - BLK * 4 - JIB], [T.drop + 0.6, 260, ease.io2]]) + ring(t, T.hook, 4, 5) * 34;
export const blockP = t => { const a = cableA(t) * (1 - ease.io2(clamp((t - T.drop + 0.3) / 0.28))), l = cableL(t), x = trolX(t); return [x + Math.sin(a) * l, JIB + Math.cos(a) * l, -a]; }; // top centre of the hooked block
// chute
const chP = u => bez(CH0, [CH0[0] + 420, CH0[1] + 60], [CH0[0] + 120, CH1[1] - 420], CH1, u); export const chuteP = chP;
// disk
export const DSP = 2.45, diskA = t => (t - T.disk) * DSP; const DA0 = -2.35; export const rideA = t => DA0 + (() => { const a = t - T.disk, tot = T.fling - T.disk; return lerp(0, Math.PI * 2 + 0.75 + 1.45, 0.25 * (a / tot) + 0.75 * Math.pow(a / tot, 1.35)); })(); const DK = 0.8;
const onDisk = a => [DC[0] + Math.cos(a) * DC[2] * DK, DC[1] + Math.sin(a) * DC[3] * DK];
export const ARMA = 0.55; // angle of the needle on the platter
const hopAt = (() => { let t = T.disk; while (t < T.fling && !(rideA(t) >= ARMA - 0.02)) t += 1 / 240; return t; })(), hopAt2 = (() => { let t = T.disk; while (t < T.fling && !(rideA(t) >= ARMA + TAU - 0.02)) t += 1 / 240; return t; })(); export const HOPS = [hopAt, hopAt2];
// street
export const runX0 = AF + 420, runX = t => runX0 + (SEE + 250 - runX0) * (() => { const u = inv(T.street, T.slap - 0.12, t); return u * (0.9 + 0.1 * u); })(); export const RUNV = (SEE + 250 - runX0) / (T.slap - 0.12 - T.street); const STR = 330; export const runPh = t => (runX(t) - runX0) / STR * Math.PI;
export const JUMPS = [[T.street + 0.95, 0.42, 150], [T.street + 1.95, 0.46, 190]]; const jumpY = t => JUMPS.reduce((a, [q, d, h]) => a - Math.max(0, Math.sin(clamp((t - q) / d) * Math.PI)) * h, 0);
export const seeA = t => { const u = t < T.slap ? 0.15 : lerp(0.15, -0.2, ease.out3(clamp((t - T.slap) / 0.09))) ; return u + ring(t, T.slap + 0.09, 4, 4) * 0.12; };
export const tubeY = t => { const u = inv(T.suck, T.out2 + 0.3, t); return lerp(TM - 60, TM - 7200, 0.1 * u + 0.9 * u * u); };
export function body(t) {
  if (t < T.yank) { const R = ease.io2(clamp((t - T.out) / 1.15)), o = orbitAt(myPhi(t), R); return { x: o[0], y: o[1], k: persp(o[2]) * lerp(0.25, 1, R), air: 0, m: 'orbit', z: o[2], R }; }
  if (t < T.crash) { const o = orbitAt(myPhi(T.yank), 1), u = inv(T.yank, T.crash, t), e = lerp(u, u * u, 0.7), p = bez([o[0], o[1]], [o[0] + 300, o[1] - 2500], [1500, -1900], [-60, hillY(-60)], e); return { x: p[0], y: p[1], k: lerp(persp(o[2]), 1, ease.out2(clamp(u * 1.05))), air: 1, m: 'yank' }; }
  if (t < T.lev) { const x = key(t, [[T.crash, -60], [T.crash + 0.4, -236, ease.out3], [T.crum + 0.08, -236], [T.crum + 0.3, -140, ease.out2], [T.lev - 0.42, -120]]); if (t > T.lev - 0.32) { const A = knob(T.lev), q = J(t, T.lev - 0.32, [-120, hillY(-120)], T.lev, [A[0] + Math.sin(0.1) * HLEN(1), A[1] + Math.cos(0.1) * HLEN(1)], 1500); return { x: q[0], y: q[1], k: 1, air: 1, m: 'jump' }; } const hopT = t - T.crum; const hy = hopT > 0.08 && hopT < 0.32 ? -Math.sin((hopT - 0.08) / 0.24 * Math.PI) * 60 : 0; return { x, y: hillY(x) + hy, k: 1, air: hy < -4 ? 1 : 0, m: 'hill' }; }
  if (t < T.pop + 0.12) { const A = knob(t), a = levHang(t); return { x: A[0] + Math.sin(a) * HLEN(1), y: A[1] + Math.cos(a) * HLEN(1), k: 1, air: 1, m: 'lever', a }; }
  if (t < T.raft) { const s = body(T.pop + 0.119), v = inv(T.pop + 0.12, T.raft, t), u = v + 0.45 * Math.sin(v * TAU) / TAU; return { x: lerp(s.x, 1450, u), y: lerp(s.y, rapY(1450) - BR * 2 + 34, u) - 4 * 760 * u * (1 - u), k: 1, air: 1, m: 'flip' }; }
  if (t < T.abs - 0.1) { const r = raft(t); return { x: r[0], y: r[1] - BR + 10, k: 1, air: 0, m: 'raft' }; }
  if (t < T.abs + 0.14) { const r = raft(T.abs - 0.1), q = J(t, T.abs - 0.1, [r[0], r[1] - BR + 10], T.abs + 0.14, [4490, WL - 150], 3600); return { x: q[0], y: q[1], k: 1, air: 1, m: 'hopc' }; }
  if (t < T.grow) return { x: 4490, y: WL - 150 - Math.max(0, grow(t) - 0.46) * 300, k: 1, air: 0, m: 'cry' };
  if (t < T.wheel) { const q = J(t, T.grow, [4490, WL - 150], T.wheel, [WHL[0] - 205, LEDGE], 3300); return { x: q[0], y: q[1], k: 1, air: 1, m: 'toss' }; }
  if (t < T.jet) { const h = heaveS(t); return { x: WHL[0] - 205 + h * 54, y: LEDGE, k: 1, air: 0, m: 'wheel', h }; }
  if (t < T.cor) { const u = inv(T.jet, T.cor, t), q = J(t, T.jet, [WHL[0] - 205, LEDGE], T.cor, [CW + 330, CF], 1500); return { x: lerp(WHL[0] - 205, CW + 330, lerp(u, ease.out2(u), 0.4)), y: q[1] - 30 * Math.sin(u * Math.PI), k: 1, air: 1, m: 'jet' }; }
  if (t < T.leap) { const x = key(t, [[T.cor, CW + 330], [T.sneak, CW + 620, ease.out3], [T.duck, CW + 1000, ease.lin], [T.sprint, CW + 1030], [T.leap, XP - 40, ease.in2]]); return { x, y: CF, k: 1, air: 0, m: t < T.sneak ? 'slide' : t < T.duck ? 'sneak' : t < T.sprint ? 'duck' : 'sprint' }; }
  if (t < T.grab) { const A = [zipX(T.grab), chY(zipX(T.grab)) + 60], a = zipHang(T.grab), q = J(t, T.leap, [XP - 40, CF], T.grab, [A[0] + Math.sin(a) * HLEN(1), A[1] + Math.cos(a) * HLEN(1)], 2200); return { x: q[0], y: q[1], k: 1, air: 1, m: 'leap' }; }
  if (t < T.rel) { const X = zipX(t), A = [X, chY(X) + 60], a = zipHang(t); return { x: A[0] + Math.sin(a) * HLEN(1), y: A[1] + Math.cos(a) * HLEN(1), k: 1, air: 1, m: 'zip', a, A }; }
  if (t < T.awn) { const s = body(T.rel - 0.001), q = J(t, T.rel, [s.x, s.y], T.awn, [AW[0], AW[1] + 70], 2600); return { x: q[0], y: q[1], k: 1, air: 1, m: 'fall' }; }
  if (t < T.hook) { const b = blockP(T.hook), q = J(t, T.awn, [AW[0], AW[1] + 70], T.hook, [b[0], b[1]], 2300); return { x: q[0], y: q[1], k: 1, air: 1, m: 'up' }; }
  if (t < T.hop) { const b = blockP(Math.min(t, T.drop + 0.1)); return { x: b[0], y: b[1], k: 1, air: 0, m: 'block', a: -b[2] }; }
  if (t < T.chute) { const q = J(t, T.hop, [CT[0], CT[1] - BLK * 4], T.chute, [CH0[0], CH0[1]], 2600); return { x: q[0], y: q[1], k: 1, air: 1, m: 'hop' }; }
  if (t < T.disk) { const u = inv(T.chute, T.disk, t), p = chP(lerp(u, u * u, 0.5)); return { x: p[0], y: p[1], k: lerp(1, 0.955, u), air: 0, m: 'chute' }; }
  if (t < T.fling) { const a = rideA(t), p = onDisk(a), h = HOPS.reduce((q, ht) => q - Math.max(0, Math.sin(clamp((t - ht + 0.17) / 0.36) * Math.PI)) * 190, 0), dep = Math.sin(a); return { x: p[0], y: p[1] + h, k: lerp(0.92, 1.16, (dep + 1) / 2), air: h < -8 ? 1 : 0, m: 'disk', a, gy: p[1], z: dep }; }
  if (t < T.street) { const s = body(T.fling - 0.001), q = J(t, T.fling, [s.x, s.y], T.street, [runX0, SG], 3000); return { x: q[0], y: q[1], k: lerp(s.k, 1, inv(T.fling, T.fling + 0.3, t)), air: 1, m: 'fling' }; }
  if (t < T.slap) { const jy = jumpY(t), x = runX(t); return { x, y: SG + jy - (x > SEE ? Math.sin(seeA(t)) * (x - SEE) * 0 : 0) - (x > SEE - 300 ? 8 : 0), k: 1, air: jy < -8 ? 1 : 0, m: t > T.slap - 0.12 ? 'brace' : 'run' }; }
  if (t < T.suck) { const q = J(t, T.slap, [SEE + 250, SG - 8], T.suck, [TUBE, TM + 140], 2500); return { x: q[0], y: q[1], k: 1, air: 1, m: 'launch' }; }
  return { x: TUBE, y: tubeY(t) + 200, k: 1, air: 1, m: 'tube' };
}
export const velAt = t => { const e = 0.012, a = body(t - e), b = body(t + e); return [(b.x - a.x) / (2 * e), (b.y - a.y) / (2 * e)]; };
const nr = r => ((r + Math.PI) % TAU + TAU) % TAU - Math.PI;
const slopeR = t => { const x = raftX(t); return Math.atan2(rapY(x + 70) - rapY(x - 70), 140); };
// whole-body rotation, continuous (spins accumulate in named turns)
const rotT = t => {
  const b = body(t), u = (a, c) => inv(a, c, t);
  if (t < T.yank) return 0.16 * Math.sin(t * 3) + (t > T.thr && t < T.cat ? 0.25 : 0);
  if (t < T.crash) return -TAU * 1 * ease.in2(u(T.yank, T.crash)) - 1.2 * u(T.yank, T.crash);
  if (b.m === 'hill') return -TAU + key(t, [[T.crash, -1.2], [T.crash + 0.4, -0.95], [T.crash + 0.75, 0, ease.io2], [T.crum, 0], [T.crum + 0.14, 0.35], [T.crum + 0.5, 0]]);
  if (b.m === 'jump') return -TAU - 0.2;
  if (b.m === 'lever') return -TAU - b.a;
  if (b.m === 'flip') return lerp(-TAU + 1.0, -TAU * 2, ease.io2(u(T.pop + 0.12, T.raft)));
  const R2 = -TAU * 2; if (b.m === 'raft') return R2 + (t < T.lip ? slopeR(t) * 0.7 : t < T.land ? -0.28 + 0.4 * u(T.lip, T.land) : 0);
  if (b.m === 'hopc' || b.m === 'cry') return R2 + (b.m === 'cry' ? -0.1 : 0.15);
  if (b.m === 'toss') return lerp(R2, R2 + TAU, ease.io2(u(T.grow + 0.05, T.wheel - 0.05)));
  const R3 = -TAU; if (b.m === 'wheel') return R3 + (b.h || 0) * -0.0;
  if (b.m === 'jet') return R3 + lerp(0, 1.15, ease.out3(u(T.jet, T.cor)));
  if (b.m === 'slide') return R3 + key(t, [[T.cor, 1.0], [T.sneak - 0.2, 0.75], [T.sneak, 0.05, ease.io2]]);
  if (b.m === 'sneak') return R3 + 0.1; if (b.m === 'duck') return R3; if (b.m === 'sprint') return R3 + 0.22;
  if (b.m === 'leap') return R3 - 0.3; if (b.m === 'zip') return R3 - b.a; if (b.m === 'fall') return R3 + 0.2;
  if (b.m === 'up') return lerp(R3, R3 + TAU, ease.io2(u(T.awn + 0.05, T.hook - 0.15)));
  if (b.m === 'block') return -b.a * 0.9; if (b.m === 'hop') return 0.3; if (b.m === 'chute') return key(t, [[T.chute, 0.2], [T.chute + 0.2, 0.75], [T.disk - 0.15, 0.6], [T.disk, -0.2]]);
  if (b.m === 'disk') return b.air ? -0.1 : Math.sin(b.a + 0.4) * 0.1; if (b.m === 'fling') return lerp(0, TAU, ease.io2(u(T.fling, T.street - 0.08)));
  if (b.m === 'run') return TAU + 0.2; if (b.m === 'brace') return TAU + 0.05; if (b.m === 'launch') return lerp(TAU, TAU * 2, ease.io2(u(T.slap, T.suck))); return TAU * 2 + Math.sin(t * 9) * 0.07;
};
export const rotS = spring(S0, S1, rotT, 30, 0.6);
// acting: step targets through springs give overlap. [t, yaw, crouch, headTilt]
const A = [[S0, 0.3, 0.9, 0], [T.out, 1.0, 0.7, 0], [T.swing, 0.75, 0.72, -0.1], [T.thr - 0.25, 0.4, 0.66, 0.14], [T.thr, 1.0, 0.95, -0.1], [T.cat, 1.05, 0.72, 0], [T.cat + 0.14, 1.1, 0.6, 0.15], [T.yank, 0.9, 1, 0.2], [T.crash, -0.7, 0.55, 0.3], [T.crash + 0.5, -0.5, 0.75, 0.2], [T.crash + 0.75, -0.75, 0.92, -0.12], [T.crum, -0.9, 0.95, -0.1], [T.crum + 0.5, -0.4, 0.95, -0.15], [T.lev - 0.55, 0.3, 0.6, 0.1], [T.lev - 0.3, 0.2, 1, -0.2], [T.clunk, 0.6, 0.95, 0], [T.clunk + 0.35, 0.8, 0.95, 0.15], [T.pop + 0.1, 0.9, 0.65, 0], [T.raft, 0.95, 0.66, -0.05], [T.lip - 0.12, 0.95, 0.5, 0.1], [T.lip, 0.95, 0.96, -0.1], [T.lip + 0.4, 0.5, 0.8, -0.16], [T.land, 0.9, 0.5, 0.15], [T.land + 0.25, 0.8, 0.85, -0.2], [T.abs - 0.2, 0.9, 0.6, 0], [T.abs - 0.08, 0.9, 1, -0.1], [T.abs + 0.14, 0.8, 0.6, 0.1], [T.abs + 0.28, 0.6, 0.9, -0.2], [T.grow - 0.04, 0.6, 0.5, 0.1], [T.grow + 0.1, 0.4, 0.75, 0], [T.wheel, 0.8, 0.55, 0.1], [T.wheel + 0.15, 0.72, 0.85, 0], [T.shut + 0.02, 0.72, 0.7, 0.2], [T.shut + 0.14, 0.4, 0.95, -0.1], [T.jet, 0.9, 0.9, 0], [T.cor, 1.1, 0.62, 0.1], [T.sneak, 1.15, 0.74, 0.05], [T.duck, 0.9, 0.44, 0.22], [T.sprint - 0.1, 0.9, 0.4, 0.1], [T.sprint, 1.2, 0.9, 0.05], [T.leap - 0.05, 1.1, 0.6, 0], [T.leap + 0.03, 1.0, 1, -0.2], [T.grab, 0.85, 0.95, -0.1], [T.rel, 0.9, 0.8, 0.1], [T.awn - 0.02, 0.6, 0.5, 0.2], [T.awn + 0.12, 0.3, 1, -0.2], [T.hook - 0.06, 0.5, 0.95, 0], [T.hook + 0.04, 0.9, 0.55, 0.15], [T.hook + 0.3, 0.7, 0.8, -0.05], [T.drop, 0.2, 0.5, 0.2], [T.drop + 0.16, 0.2, 0.96, -0.1], [T.hop - 0.08, 0.9, 0.6, 0.1], [T.hop + 0.03, 0.9, 1, -0.1], [T.chute, 1.1, 0.5, 0.05], [T.disk, 0.9, 0.52, 0.2], [T.disk + 0.25, 1.1, 0.85, 0], [T.fling, 1.0, 0.7, 0], [T.street, 1.1, 0.55, 0.15], [T.street + 0.14, 1.2, 0.92, 0], [T.slap - 0.14, 1.0, 0.6, 0.1], [T.slap + 0.02, 0.6, 1, -0.3], [T.suck, 0.1, 0.95, 0], [T.boom, 0, 1, -0.1]];
const step = (tab, t) => { let r = tab[0]; for (const q of tab) { if (t >= q[0]) r = q; else break; } return r; };
const actS = spring(S0, S1, t => step(A, t).slice(1), 20, 0.5), crS = spring(S0, S1, t => step(A, t)[2], 27, 0.42, [[T.crash, -9], [T.land, -6], [T.wheel, -6], [T.awn, -10], [T.hook, -7], [T.drop, -6], [T.disk, -7], [T.street, -8]]);
// hands, local coordinates [lx, ly, rx, ry]
const bal = t => Math.sin(t * 5.2) * 14;
const H = [[S0, -160, -60, 170, -60], [T.out, -190, -230, 190, -230], [T.out + 0.8, -190, -140, 206, -150], [T.swing, -150, -110, 120, -330], [T.thr - 0.22, -190, -150, -60, -350], [T.thr, -170, -60, 214, -190], [T.cat, 60, -150, 206, -160], [T.yank, -60, -340, 60, -360], [T.crash, -200, -120, 190, -200], [T.crash + 0.45, -120, -20, 120, -30], [T.crash + 0.7, 40, -300, 60, -290], [T.c0 + 0.75, -160, -60, 150, -40], [T.crum, -214, -230, 60, -250], [T.crum + 0.35, -206, -290, 160, -120], [T.lev - 0.55, -120, -20, 130, -30], [T.lev - 0.3, -40, -330, 40, -350], [T.pop + 0.1, -220, -260, 220, -260], [T.raft, -206, -190, 214, -160], [T.lip + 0.05, -210, -290, 216, -280], [T.land, -206, -120, 212, -110], [T.land + 0.3, -190, -80, 190, -220], [T.abs, -206, -200, 210, -200], [T.abs + 0.3, -150, -60, 206, -300], [T.grow, -210, -260, 210, -260], [T.wheel, 120, -160, 190, -160], [T.shut + 0.14, -190, -250, 190, -290], [T.jet, 200, -260, 210, -220], [T.cor, 206, -230, 214, -190], [T.sneak, 100, -190, 160, -210], [T.duck, 40, -330, 110, -330], [T.sprint, 120, -60, -120, -120], [T.leap, 60, -350, 150, -340], [T.rel, -206, -200, 214, -240], [T.awn, -210, -290, 214, -290], [T.hook, -60, -330, 60, -340], [T.drop, -206, -160, 206, -160], [T.drop + 0.16, -170, -260, 200, -330], [T.hop, -200, -250, 208, -260], [T.chute, -190, -300, 190, -310], [T.disk, -206, -160, 212, -190], [T.fling, -206, -240, 206, -240], [T.street, -200, -110, 206, -110], [T.slap, -190, -300, 190, -320], [T.suck, -110, -340, 110, -350], [T.boom, -70, -350, 70, -370]];
const handS = spring(S0, S1, t => { const h = step(H, t).slice(1), d = bal(t); return [h[0], h[1] + d, h[2], h[3] - d]; }, 21, 0.42);
export const lassoHand = t => handWorld(t, 1);
// world anchors the hands must really hold: side 0 left, 1 right
const hold = (t, a, b, e = 0.1) => ease.io2(clamp((t - a) / e)) * (1 - clamp((t - b) / e));
function anchors(t) { const o = []; const kL = hold(t, T.lev - 0.08, T.pop + 0.1); if (kL > 0) { const k = knob(t); o.push([0, k[0] - 14, k[1] + 4, kL], [1, k[0] + 16, k[1] - 2, kL]); } const kW = hold(t, T.wheel + 0.05, T.shut + 0.08); if (kW > 0) { const a0 = wheelA(t), g = (base) => { const q = base + (((a0 - heaveG(t)))); return [WHL[0] + Math.cos(q) * WR * 0.9, WHL[1] + Math.sin(q) * WR * 0.9]; }; const p = g(Math.PI + 0.75), p2 = g(Math.PI - 0.15); o.push([0, p2[0], p2[1], kW], [1, p[0], p[1], kW]); } const kZ = hold(t, T.grab - 0.08, T.rel); if (kZ > 0) { const X = zipX(Math.max(t, T.grab)), A0 = [X, chY(X) + 60]; o.push([0, A0[0] - 46, A0[1] + 4, kZ], [1, A0[0] + 46, A0[1] + 4, kZ]); } const kB = hold(t, T.hook + 0.02, T.drop + 0.12); if (kB > 0) { const b = blockP(t), a = -b[2]; o.push([1, b[0] - Math.sin(a) * 190 + 10, b[1] - Math.cos(a) * 190, kB], [0, b[0] - Math.sin(a) * 250 - 10, b[1] - Math.cos(a) * 250, kB]); } return o; }
const heaveG = t => { let g = 0; heaves.forEach((h, i) => { if (t >= h - 0.26) { const k = i === 0 ? 0 : -1.25 * i; g = k; } }); return g; };
const kin = t => { const b = body(t), r = rotS(t), cr = crS(t), s = SC * b.k, u = cr * 158 * s + 8 * s; return { b, r, cr, s, p: [b.x + Math.sin(r) * u, b.y - Math.cos(r) * u] }; };
const toLocal = (k, wx, wy) => { const dx = wx - k.p[0], dy = wy - k.p[1], c = Math.cos(k.r), s = Math.sin(k.r); return [(dx * c + dy * s) / k.s, (-dx * s + dy * c) / k.s]; };
export function handWorld(t, i) { const k = kin(t), h = handsAt(t, k), hx = h[i * 2] * k.s, hy = h[i * 2 + 1] * k.s; return [k.p[0] + Math.cos(k.r) * hx - Math.sin(k.r) * hy, k.p[1] + Math.sin(k.r) * hx + Math.cos(k.r) * hy]; }
function handsAt(t, k) { const h = handS(t).slice(); if (k.b.m === 'run' || k.b.m === 'sprint') { const ph = k.b.m === 'run' ? runPh(t) : t * 24, am = k.b.m === 'run' ? 1 : 1; h[0] = Math.sin(ph) * 130 * am - 10; h[1] = -60 - Math.max(0, Math.sin(ph)) * 120; h[2] = -Math.sin(ph) * 130 * am + 10; h[3] = -60 - Math.max(0, -Math.sin(ph)) * 120; } if (k.b.m === 'orbit' && t > T.swing && t < T.thr - 0.2) { const q = t * 15; h[2] = 90 + Math.cos(q) * 40; h[3] = -330 + Math.sin(q) * 26; } anchors(t).forEach(([i, wx, wy, w]) => { const l = toLocal(k, wx, wy); h[i * 2] = lerp(h[i * 2], l[0], w); h[i * 2 + 1] = lerp(h[i * 2 + 1], l[1], w); }); return h; }
const antS = spring(S0, S1, t => { const v = velAt(t), b = body(t), q = 1 / Math.max(1, b.k * 2.2), r = rotS(t), c = Math.cos(r), s = Math.sin(r), lx = (v[0] * c + v[1] * s) * q, ly = (-v[0] * s + v[1] * c) * q; return [clamp(-lx * 0.0003, -0.6, 0.6), clamp(-lx * 0.0005 + ly * 0.0001, -1.3, 1.3)]; }, 18, 0.16);
const E = (t, a, b, e = 0.1) => clamp((t - a) / e) * (1 - clamp((t - b) / e));
const eyesAt = t => ({ wide: clamp(E(t, T.yank, T.crash) + E(t, T.crum - 0.02, T.crum + 0.5) + E(t, T.clunk + 0.3, T.pop + 0.3) + E(t, T.lip, T.land - 0.2) + E(t, T.abs + 0.1, T.grow + 0.3) + E(t, T.jet, T.cor + 0.1) + E(t, T.duck, T.sprint) + E(t, T.leap, T.grab + 0.15) + E(t, T.drop, T.drop + 0.25) + E(t, T.fling, T.street) + E(t, T.slap, T.suck)), happy: clamp(E(t, T.cat + 0.05, T.yank) + E(t, T.raft + 0.25, T.lip - 0.1) + E(t, T.shut + 0.1, T.jet) + E(t, T.grab + 0.3, T.rel) + E(t, T.drop + 0.2, T.hop + 0.1) + E(t, T.chute + 0.1, T.disk) + E(t, T.suck + 0.4, S1)), focus: clamp(E(t, T.swing, T.cat) + E(t, T.lev - 0.5, T.clunk) + E(t, T.wheel, T.shut) + E(t, T.sneak, T.duck) + E(t, T.sprint, T.leap) + E(t, T.disk + 0.2, T.fling) + E(t, T.street + 0.1, T.slap - 0.1)) });
const LOOK = [[S0, 0, 0], [T.swing, 0.6, 0.1], [T.crash + 0.6, -0.4, -0.7], [T.crum, -0.7, -0.3], [T.lev - 0.5, 0, -0.6], [T.clunk + 0.3, 0.7, -0.4], [T.raft, 0.6, 0.1], [T.lip + 0.2, 0.5, -0.2], [T.land + 0.2, 0.6, -0.7], [T.wheel, 0.5, 0.1], [T.sneak, 0, -0.5], [T.duck, 0.1, -0.9], [T.sprint, 0.6, 0], [T.grab, 0.6, 0.4], [T.awn, 0.1, -0.8], [T.hook, 0.6, 0.1], [T.chute, 0.5, 0.5], [T.disk, 0.5, 0], [T.street, 0.4, 0], [T.slap, 0.4, -0.8]];
const lookS = spring(S0, S1, t => step(LOOK, t).slice(1), 16, 0.7);
// light on the robot per place: [t, key, fill]
const LIT = [[S0, '#bff6ff', '#ffb98a'], [T.yank, '#bff6ff', '#ffb98a'], [T.crash + 0.2, '#ffd9b0', '#8aa6ff'], [T.clunk + 0.4, '#bfe0ff', '#7f9bff'], [T.raft, '#a8f4ff', '#6f8cff'], [T.lip + 0.3, '#a8fff0', '#49c8ff'], [T.jet, '#a8fff0', '#ffcf9a'], [T.sneak, '#fff0d6', '#ff9a7a'], [T.leap, '#ffe2c2', '#ff8aa0'], [T.rel, '#ffe2c2', '#ff8aa0'], [T.hook, '#fff2e6', '#c9a8ff'], [T.chute, '#ffe6d0', '#b0a0ff'], [T.disk + 0.2, '#b8d4ff', '#ffb27a'], [T.fling, '#b8d4ff', '#ffb27a'], [T.street, '#ffe6c0', '#ff8f8a'], [T.suck + 0.3, '#ffe0f0', '#ff9ac0'], [S1, '#cfe0ff', '#b09aff']];
const litAt = (t, i) => { for (let k = 1; k < LIT.length; k++) if (t < LIT[k][0]) return mix(LIT[k - 1][i], LIT[k][i], inv(LIT[k - 1][0], LIT[k][0], t)); return LIT[LIT.length - 1][i]; };
function feetAt(t, k) {
  const b = k.b, ft = k.cr * 158, m = b.m, sw = (a, c, d) => Math.sin(t * a + c) * d;
  if (m === 'run' || m === 'sprint') { const ph = m === 'run' ? runPh(t) : t * 24, f = q => { const c = Math.cos(ph + q), s = Math.sin(ph + q); return [c * 112 + 8, ft - Math.max(0, -s) * 92, s < 0 ? 0.5 + c * 0.5 : c > 0 ? -0.15 : 0.1]; }; if (b.air) return [[-70, ft - 30, 0.5], [104, ft - 70, -0.35]]; return [f(0), f(Math.PI)]; }
  if (m === 'raft' && t < T.lip) { const ph = t * 17, f = q => [Math.cos(ph + q) * 74, ft - Math.max(0, -Math.sin(ph + q)) * 56, Math.max(0, -Math.sin(ph + q)) * 0.3]; return [f(0), f(Math.PI)]; }
  if (m === 'sneak') { const ph = t * 8.5, f = q => [Math.cos(ph + q) * 66, ft - Math.max(0, -Math.sin(ph + q)) * 46, Math.max(0, -Math.sin(ph + q)) * 0.4]; return [f(0), f(Math.PI)]; }
  if (['yank', 'lever', 'zip', 'jump', 'leap', 'launch', 'tube'].includes(m)) { const v = sw(7, 0, 22); const tk = m === 'yank' || m === 'launch' ? 1 : 0; return [[-50 + v, 150 - tk * 44 + sw(9, 1, 8), 0.45 + sw(6, 0, 0.2)], [46 + v * 0.6, 132 - tk * 30 + sw(8, 2, 10), 0.3 + sw(7, 2, 0.2)]]; }
  if (['flip', 'toss', 'up', 'fling', 'hop', 'fall', 'hopc'].includes(m)) return [[-58 + sw(9, 0, 10), 104, 0.5], [54, 120 + sw(8, 1, 10), 0.3]];
  if (m === 'jet' || m === 'slide') return [[-60 + sw(20, 0, 14), 148, 0.2], [40 + sw(22, 1, 14), 150, 0.2]];
  if (m === 'chute') return [[40, 120, -0.5], [92, 110, -0.5]];
  if (m === 'hill' && t < T.crash + 0.5) return [[-70, 130, 0.6], [60, 140, 0.2]];
  if (m === 'duck') return [[-72, ft, 0], [64, ft, 0]];
  if (m === 'wheel') { const h = b.h || 0; return [[-96 - h * 46, ft, 0], [70 - h * 78, ft - Math.max(0, h) * 14, h * 0.2]]; }
  if (m === 'disk') { const ph = b.a * 7; return b.air ? [[-70, ft - 40, 0.4], [80, ft - 60, -0.2]] : [[Math.cos(ph) * 84 - 4, ft - Math.max(0, -Math.sin(ph)) * 50, 0], [-Math.cos(ph) * 84 + 4, ft - Math.max(0, Math.sin(ph)) * 50, 0]]; }
  return [[-78, ft, 0], [72, ft - 2, 0]];
}
export function robot(x, t, o = {}) {
  const k = kin(t), [yaw, , hd] = actS(t), h = handsAt(t, k), b = k.b, an = antS(t), f = feetAt(t, k), e = eyesAt(t), lk = lookS(t); let yw = yaw;
  if (b.m === 'disk') yw = -Math.sin(b.a) * 1.2;
  if (b.m === 'tube') yw = Math.sin((t - T.suck) * 5) * 0.5 * (1 - clamp((t - T.boom) / 0.4));
  const fist = (a, c) => t > a && t < c; const grip = fist(T.lev - 0.06, T.pop + 0.1) || fist(T.wheel + 0.06, T.shut + 0.1) || fist(T.grab - 0.06, T.rel) || fist(T.hook + 0.04, T.drop + 0.12) || b.m === 'run' || b.m === 'sprint';
  const rope = fist(T.swing - 0.2, T.crash - 0.1); const run = b.m === 'run' || b.m === 'sprint', hb = run ? Math.sin((b.m === 'run' ? runPh(t) : t * 24) * 2) * 6 : 0;
  bot(x, { p: [k.p[0], k.p[1] + hb * k.s], s: k.s, rot: k.r, yaw: clamp(yw, -1.4, 1.4), lean: run ? 0.1 : b.m === 'wheel' ? (b.h || 0) * -0.34 : 0, t, sq: o.sq || 0, head: hd - nr(k.r) * 0.3 + (b.m === 'lever' ? 0.1 : 0), headYaw: b.m === 'duck' ? Math.sin(t * 9) * 0.5 - 0.6 : t > T.sneak && t < T.duck ? -0.5 : b.m === 'run' && t > T.street + 0.5 && t < T.street + 1.0 ? -1.5 : 0, feet: f, hands: [[h[0], h[1], grip ? 'fist' : 'open'], [h[2], h[3], grip || rope ? 'fist' : 'open']], eyes: { open: 1, wide: e.wide * (1 - e.happy), happy: e.happy, focus: e.focus * (1 - e.happy) * (1 - e.wide) }, look: lk, blink: ((t + 1.25) % 2.9) > 2.8 ? 0.1 : 1, ant: an, key: litAt(t, 1), fill: litAt(t, 2), jet: b.m === 'up' ? E(t, T.awn + 0.05, T.hook - 0.25) * 0.8 : b.m === 'tube' ? 0.6 : 0, hold: o.hold });
}
// ---- camera
const SHOTS = [[T.crash, T.pop + 0.25, () => [-6, -374, 0.92], 0.2, 0.3], [T.crum - 0.35, T.crum + 0.75, () => [-190, -380, 0.99], 0.4, 0.4], [T.y0 + 0.1, T.pop + 0.1, () => [130, -385, 0.97], 0.4, 0.3], [T.pop + 0.12, T.raft - 0.34, () => [840, -320, 0.74], 0.2, 0.4], [T.lip + 0.12, T.wheel - 0.1, () => [KC[0], KC[1], 0.72], 0.3, 0.35], [T.wheel - 0.1, T.shut, () => [5420, 2210, 1.06], 0.35, 0.3], [T.shut - 0.12, T.jet + 0.12, () => [4955, 2080, 0.8], 0.25, 0.2], [T.jet + 0.25, T.leap - 0.12, () => [CW + 1090, 2060, 0.86], 0.35, 0.3], [T.leap + 0.1, T.rel - 0.05, () => [XP + 1360, 2720, 0.85], 0.45, 0.3], [T.awn + 0.4, T.hop + 0.2, () => [CC[0], CC[1], 0.85], 0.4, 0.25], [T.disk - 0.15, T.fling + 0.02, () => [DC[0] - 20, DC[1] - 190, 0.86], 0.3, 0.15], [T.slap - 0.5, T.suck + 0.05, () => [SEE + 170, SG - 420, 0.84], 0.35, 0.25]];
const camT = t => { const b = body(t), v = velAt(t), big = b.k > 1.5, lead = big ? 0 : 0.19; let c = [b.x + clamp(v[0] * lead, -420, 520), b.y - 190 + clamp(v[1] * lead * 0.9, -420, 420), 0]; if (b.m === 'raft' && t < T.lip) c = [c[0] + 150, c[1] + 120, 0.03]; if (b.m === 'run') c = [b.x - 30, SG - 355, Math.log(0.86)]; if (b.m === 'fling') c[2] = -0.12; if (b.m === 'tube') c = [TUBE, Math.min(b.y - 590 + v[1] * 0.13, SG - 300) + ease.in2(clamp((t - T.out2 + 0.35) / 0.65)) * 2300, -0.1]; if (t < T.crash + 0.2) { const u = inv(T.yank, T.crash - 0.08, t), e = Math.pow(u, 1.9), pc = planetCam(T.yank), z = lerp(pc[2], Math.log(0.92), e), f = (Math.exp(-z) - Math.exp(-Math.log(0.92))) / (Math.exp(-pc[2]) - Math.exp(-Math.log(0.92))); c = [lerp(-6, pc[0], f), lerp(-374, pc[1], f), z]; } SHOTS.forEach(([a, e, f, i, o]) => { const w = ease.io2(clamp((t - a) / i)) * (1 - ease.io2(clamp((t - e) / o))); if (w > 0) { const q = f(t), z = Math.log(q[2]); c = [lerp(c[0], q[0], w), lerp(c[1], q[1], w), lerp(c[2], z, w)]; } }); return c; };
const planetCam = t => { const u = inv(T.pull, T.full, t), e = u < 0.5 ? 8 * u ** 4 * 0.5 + 0 : 1 - Math.pow(-2 * u + 2, 4) / 2, z = Math.exp(lerp(Math.log(14), Math.log(0.15), ease.io2(u) * 0.35 + (u >= 1 ? 1 : e) * 0.65)), top = lerp(540, 262, ease.io3(u)), dr = t - T.full; const zz = z * (1 + 0.022 * Math.max(0, dr)); return [lerp(0, -60, u), -(top - 540) / zz, Math.log(zz)]; };
const C0 = T.yank - 0.05, camF = spring(C0, S1, t => (t < T.yank ? planetCam(t) : camT(t)), 9, 0.92);
const HITS = [[T.cat, 7], [T.crash, 30], [T.crum, 16], [T.clunk, 24], [T.pop, 30], [T.raft, 14], [T.land, 26], [T.grow, 24], [T.wheel, 8], [T.h1, 7], [T.h2, 7], [T.shut, 26], [T.jet, 24], [T.grab, 14], [T.awn, 16], [T.hook, 12], [T.drop, 22], [T.disk, 14], [T.street, 14], [T.slap, 34], [T.suck, 14]]; export const IMPACT = HITS;
const shake = t => HITS.reduce((a, [h, k]) => a + (t > h ? Math.exp(-(t - h) * 7) * k : 0), 0) + wind(t) * 5;
export function view(t) { const c = t < C0 ? planetCam(t) : camF(t), z = Math.exp(c[2]), s = shake(t), b = body(t); let r = noise(t * 18, 5) * s * 0.0006; if (b.m === 'raft' && t < T.lip) r += 0.035; if (b.m === 'run') r += 0.012; return { cx: c[0] + noise(t * 26, 3) * s / z, cy: c[1] + noise(t * 26, 9) * s / z, z, r }; }
export const apply = (x, w) => { x.translate(960, 540); x.rotate(w.r); x.scale(w.z, w.z); x.translate(-w.cx, -w.cy); };
export const toS = (w, px, py) => { const qx = (px - w.cx) * w.z, qy = (py - w.cy) * w.z, c = Math.cos(w.r), s = Math.sin(w.r); return [960 + qx * c - qy * s, 540 + qx * s + qy * c]; };
// parallax frame: draws fn in a world whose origin is pinned at (ax, ay) when the camera is there; p = 1 moves with the world
export const par = (x, w, p, ax, ay, fn, zp = 1) => { x.save(); x.translate(960, 540); x.rotate(w.r); const z = lerp(0.85, w.z, zp); x.scale(z, z); x.translate(-(w.cx - ax) * p, -(w.cy - ay) * p); fn(x); x.restore(); };
export const at = (x, w, fn) => { x.save(); apply(x, w); fn(x); x.restore(); };
// ---- scarf
const neck = t => { const k = kin(t), u = 212 * k.s; return [k.p[0] + Math.sin(k.r) * u, k.p[1] - Math.cos(k.r) * u]; };
const orbN = t => { const n = neck(t); return [n[0] / 7, n[1] / 7]; };
const scA = [0, 1].map(i => chain(T.out, T.crash + 0.02, t => { const n = orbN(t); return [n[0], n[1]]; }, 12, 17 - i * 3, { wind: () => [0, 260], flutter: [2600, 19 + i * 4, 0.85], drag: 0.001, dir: [-1, 0.1] }));
const scB = [0, 1].map(i => chain(T.crash - 0.05, S1, t => { const n = neck(t); return [n[0] - 18 - i * 8, n[1] + 6 + i * 8]; }, 13, 23 - i * 4, { wind: t => { const b = body(t).m, v = b === 'run' ? -1500 : 0; return [-1300 * wind(t) * 5 + v, 1500 + i * 300]; }, flutter: [4200 + i * 1400, 21 + i * 4, 0.85], drag: 0.0016, dir: [0.2, 1] }));
export function scarves(x, t, w) { const a = t < T.crash, b = body(t), G = gl(); G.clear(); [1, 0].forEach(i => { const P = (a ? scA : scB)[i](t), pts = []; for (let k = 0; k <= 44; k++) { const u = k / 44 * (P.length - 1), j = Math.min(P.length - 2, Math.floor(u)), f = u - j, pm = P[Math.max(0, j - 1)], p1 = P[j], p2 = P[j + 1], pn = P[Math.min(P.length - 1, j + 2)], cr = (p0, q1, q2, p3) => 0.5 * (2 * q1 + (q2 - p0) * f + (2 * p0 - 5 * q1 + 4 * q2 - p3) * f * f + (3 * q1 - p0 - 3 * q2 + p3) * f ** 3), m = a ? 7 : 1, q = toS(w, cr(pm[0], p1[0], p2[0], pn[0]) * m, cr(pm[1], p1[1], p2[1], pn[1]) * m), v = k / 44; pts.push([q[0], q[1], (13 + v * 13) * w.z * b.k * (a ? 0.9 : 1) * (v > 0.96 ? (1 - v) * 25 : 1), Math.sin(v * 7 - t * 17 + i) * 0.75, k * 9]); } G.silk({ pts, c: ['#ff6f6a', '#b3165e', '#ffd2b0'], seed: 9 + i, t }); }); G.to(x); }
// contact shadow
export const shadow = (x, px, py, rx, a = 0.5, c = '#04021a') => { x.save(); x.translate(px, py); x.scale(1, 0.16); x.fillStyle = rg(x, 0, 0, rx, [[0, rgba(c, a)], [0.6, rgba(c, a * 0.5)], [1, rgba(c, 0)]]); x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore(); };
// shockwave ring and particle burst in screen space lists
export const shock = (x, px, py, t, t0, R, c = '#ffffff', d = 0.5, wd = 18) => { const u = (t - t0) / d; if (u <= 0 || u >= 1) return; x.strokeStyle = rgba(c, (1 - u) * 0.9); x.lineWidth = wd * (1 - u); x.beginPath(); x.arc(px, py, R * ease.out3(u), 0, TAU); x.stroke(); };
// burst(L, w, t, {t0, p, n, c:[..], an:[from,to], v:[a,b], g, life, sz, ty, sd, f}) pushes screen particles
export function burst(L, w, t, o) { const a = t - o.t0, lf = o.life || 0.8; if (a <= 0 || a > lf) return; for (let i = 0; i < o.n; i++) { const h = k => hash((o.sd || 1) * 977 + i * 31 + k), an = lerp(o.an ? o.an[0] : 0, o.an ? o.an[1] : TAU, h(1)), v = lerp(o.v[0], o.v[1], h(2)), dl = (o.spread || 0) * h(8), q = a - dl; if (q <= 0) continue; const life = 1 - q / (lf * (0.5 + 0.5 * h(3))); if (life <= 0) continue; const d = o.drag || 0.3, e = q * (1 - d * q), px = o.p[0] + (h(9) - 0.5) * (o.w || 0) + Math.cos(an) * v * e, py = o.p[1] + (h(10) - 0.5) * (o.h || 0) + Math.sin(an) * v * e + (o.g ?? 1400) * q * q * 0.5, s = toS(w, px, py), ty = Array.isArray(o.ty) ? o.ty[Math.floor(h(5) * o.ty.length)] : o.ty ?? 1; L.push([s[0], s[1], Math.cos(an) * v * 0.012 * w.z * (o.st ?? 1), (Math.sin(an) * v + (o.g ?? 1400) * q) * 0.012 * w.z * (o.st ?? 1), (lerp(0.35, 1, h(4)) * (o.sz || 12)) * Math.sqrt(life) * w.z, ty, o.c[Math.floor(h(6) * o.c.length)], clamp(life * 2) * (o.a ?? 1)]); } }
export const flush = (x, L) => { if (!L.length) return; const G = gl(); G.clear(); G.parts(L); G.to(x); };
