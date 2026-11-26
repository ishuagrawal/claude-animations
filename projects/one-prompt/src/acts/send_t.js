// Anchors and geometry shared by the send act. Everything is keyed to the narration.
import { C, word, SEAM } from '../timeline.js';
import { clamp, lerp, ease, noise } from '../core.js';
const c2 = k => word('c2', k), c3 = k => word('c3', k);
const KICK_T = c3(6) + 0.06, SEA_T = Math.min(C.c3 + 1.46, KICK_T - 0.86);
export const T = {
  in: C.c1 - 0.3, burst: C.c1 - 0.02, key0: C.c1 + 0.12, enter: C.c2 - 0.14, pop: C.c2 + 0.16, catch: C.c2 + 0.52, land: C.c2 + 0.86,
  lp0: C.c2 + 0.3, lp1: c2(5) - 0.05, rumble: c2(4) + 0.05, eng: c2(6), stop: c2(9) - 0.1,
  l1: c2(9) + 0.06, l1e: c2(13) - 0.1, h2: c2(13), h3: c2(17) - 0.05, h4: c2(20) + 0.1,
  place: C.c2e - 0.06, tink: C.c2e + 0.16, brake: C.c2e + 0.42, go: C.c3 - 0.02, fib: Math.min(C.c3 + 0.82, SEA_T - 0.56), sea: SEA_T,
  kick: KICK_T, gate: c3(6) + 0.36, oth: c3(10) - 0.2, scan: c3(11) + 0.3, tail: C.c3e - 0.36, rush: C.d1 - 0.72, out: C.d1 - 0.25 + SEAM,
};
export const KEYS = 14, keyT = k => lerp(T.key0, T.enter - 0.66, k / (KEYS - 1));
// ---- train geometry (world units; rail top y = 0; +x is forward)
export const HW = 975, HE = 1120, G0 = 220, DECK = -400, PCH = HW * 2 + G0, X1 = 1900, HP = 96;
export const REST = [X1 + HW + G0 + HE, X1, X1 - PCH, X1 - 2 * PCH, X1 - 3 * PCH]; REST.push(REST[4] - HW - 62 - HP);
export const PORTAL = 7200;
// ---- camera: {x, y, z, r, sx, sy}; plane depth d (0 = action plane, >0 farther, <0 nearer)
export const dz = (c, d) => 1 / Math.max(0.06, 1 / c.z + d);
export function into(x, c, d, fn) { const s = dz(c, d); x.save(); x.translate(960 + (c.sx || 0), 540 + (c.sy || 0)); x.rotate(c.r || 0); x.scale(s, s); x.translate(-c.x, -c.y); fn(s); x.restore(); }
export const scr = (c, px, py, d = 0) => { const s = dz(c, d), qx = (px - c.x) * s, qy = (py - c.y) * s, k = Math.cos(c.r || 0), n = Math.sin(c.r || 0); return [960 + (c.sx || 0) + qx * k - qy * n, 540 + (c.sy || 0) + qx * n + qy * k, s]; };
export const PAL = { deep: '#01181c', d1: '#03302f', d2: '#075448', e2: '#0e8a6c', e3: '#25d39c', e4: '#8fffd6', e5: '#eafff7', ind: ['#7d86ff', '#3a37c4', '#171072', '#0a0640'], pnk: ['#ffb3dc', '#ee4aa6', '#9a1470', '#4a0640'], brs: ['#fff1cf', '#f0a860', '#9a4424'], stl: ['#e8fff8', '#8fc9c4', '#2f6a78', '#0c2f46'] };
