// Back on the track for the last lap: every metre sheds gold, which pours off the edge into the machine below.
import { K, CODE, ink, inner, rr, circ, ell, poly, rgba, mix, lg, rg, glow, label, cached, TAU, clamp, lerp, hash, ease, key, noise } from '../ink.js';
import { gl } from '../gl.js';
import { board } from '../bot.js';
import { spring, ring, arc } from '../sim.js';
import { C, word } from '../timeline.js';
import { SC, apply, toS, par, shakeOf, bump, hit, since, actor, burst, flush, streaks, shock, nr } from './loop_kit.js';
import { hall, track, fore, hill, GY, LX } from './loop_world.js';
import { W as WB } from './loop_web.js';
import { G } from './loop_brass.js';
import { gear } from './loop_brass.js';
const IN = WB.leave + 0.3, X0 = 900, XL = 1250, XD = 2900, gnd = wx => GY + hill(wx);
export const GO = { in: IN, end: G.in + 0.2 };
function pos(t) { if (t < G.land) { const p = arc(t, IN, [X0, -1000], G.land, [XL, gnd(XL)], 2600); return [p[0], p[1]]; } if (t < G.dive) { const u = since(t, G.land, G.dive - G.land), x = lerp(XL, XD, 0.35 * u + 0.65 * u * u * (3 - 2 * u) * 1); return [x, gnd(x)]; } const u = t - G.dive; return [XD + 1300 * u, gnd(XD) + 30 * u - 520 * u + 2500 * u * u]; }
const vx = t => (pos(t + 0.02)[0] - pos(t - 0.02)[0]) / 0.04;
const bob = actor({ t0: IN - 0.1, t1: GO.end + 0.2, pos, sc: () => SC * 1.04, rot: t => key(t, [[IN, -2.6], [G.land - 0.1, 0.1], [G.land, 0], [G.land + 0.2, 0.2], [G.dive - 0.1, 0.12], [G.dive + 0.05, -0.2], [G.dive + 0.5, 0.9]]), pv: t => bump(t, IN - 0.3, G.land - 0.05, 0.1) * 140, yaw: t => key(t, [[IN, 0], [G.land, 0.95], [G.dive, 0.95], [G.dive + 0.3, 0.5]]), cr: t => key(t, [[IN, 0.7], [G.land - 0.04, 0.98], [G.land + 0.08, 0.5], [G.land + 0.3, 0.72], [G.dive - 0.06, 0.58], [G.dive + 0.04, 1], [G.dive + 0.3, 0.8]]), ck: [[G.land, -10]],
  hands: t => { const s = Math.sin(t * 5) * 14, H = [-190, -140 + s, 200, -110 - s]; const k = bump(t, IN, G.land - 0.04, 0.1) + bump(t, G.dive, GO.end + 1, 0.1); [-190, -280, 190, -280].forEach((q, i) => (H[i] = lerp(H[i], q, clamp(k)))); return H; }, pose: t => ({ eyes: { focus: bump(t, G.land + 0.1, G.dive, 0.1), wide: clamp(bump(t, IN, G.land, 0.1) + bump(t, G.dive, GO.end + 1, 0.06)) }, look: [0.3, t > G.dive ? 0.5 : 0], key: '#fff2b0', fill: '#ff9ac0' }) });
const ox = spring(IN - 0.1, GO.end + 0.2, t => key(t, [[IN, 900], [G.land, 760], [G.dive, 860], [GO.end, 900]]), 10, 0.9), cy = spring(IN - 0.1, GO.end + 0.2, t => key(t, [[IN - 0.1, -500], [G.land - 0.04, 520, ease.io2], [G.dive - 0.1, 600], [G.dive + 0.16, 900, ease.in2], [GO.end, 2000]]), 14, 0.9), cz = spring(IN - 0.1, GO.end + 0.2, t => key(t, [[IN, 0.94], [G.land - 0.02, 1.0], [G.land + 0.06, 1.18, ease.out2], [G.land + 0.5, 1.02], [G.dive, 1.06], [GO.end, 1.0]]), 12, 0.65);
export function goldView(t) { const z = cz(t), p = pos(t), s = shakeOf(t, [[G.land, 40, 6], [G.dive, 12]]) + (t > G.land && t < G.dive ? 3 : 0); return { cx: p[0] - (ox(t) - 960) / z, cy: cy(t), z, r: noise(t * 18, 5) * s * 0.0006, sx: noise(t * 26, 3) * s, sy: noise(t * 26, 9) * s }; }
export const goldSpeed = t => { const a = goldView(t - 0.012), b = goldView(t + 0.012); return Math.hypot(b.cx - a.cx, b.cy - a.cy) / 0.024; };
const when = wx => { let a = G.land, b = G.dive; for (let i = 0; i < 22; i++) { const m = (a + b) / 2; pos(m)[0] < wx ? (a = m) : (b = m); } return a; };
const FALLS = Array.from({ length: 17 }, (_, i) => 1290 + i * 98 + (hash(i) - 0.5) * 30).map(wx => [wx, when(wx)]);
export function drawGold(x, t) {
  const w = goldView(t), p = pos(t), GLc = gl(), gk = clamp((t - G.land) / 0.7); hall(x, t, w, { gold: 0.25 + 0.75 * clamp((t - IN) / 0.9), sunX: 1200 }); if (Math.abs(vx(t)) > 900) streaks(x, t, -1, 0.7, { n: 26, sp: 5200, c: '#fff2c4', a: 0.3 });
  // below the track: warm depths, gears turning up out of the dark
  if (w.cy > 540) { x.save(); const y0 = 540 + (940 - w.cy) * w.z; x.fillStyle = lg(x, 0, y0, 0, y0 + 900, ['#4a1268', '#8a2a4a', '#d8662a', '#ffc04a']); x.fillRect(0, y0, 1920, 1800); x.restore(); }
  x.save(); apply(x, w); track(x, t, w, [[G.land, XL, 190]], { warm: w.cy > 560, refl: [[p[0], '#ffb03a', 420, 0.34], [p[0] - 700, '#ff9a1c', 460, 0.2]] }); if (w.cy > 600) { [[2500, 1600, 330, 20, 1], [3130, 1540, 260, 16, -1.2], [3720, 1640, 380, 24, 0.8], [2050, 1750, 260, 16, -1.2], [4300, 1480, 260, 16, -1.2]].forEach(q => gear(x, q[0], q[1], q[2], q[3], t * q[4], 'mid')); } x.restore();
  if (w.cy > 700) streaks(x, t, 1, clamp((w.cy - 700) / 400), { n: 40, sp: 3600, vert: true, c: '#ffe6a8', a: 0.5, w: 3 });
  // gold river on the boards, then curtains over the lip
  GLc.clear(); const riv = []; const x1 = Math.min(p[0], XD), x0 = Math.max(XL, w.cx - 1300); if (t > G.land && x1 > x0 + 20) { for (let i = 0; i <= 70; i++) { const u = i / 70, wx = lerp(x0, x1, u), q = toS(w, wx, gnd(wx) + 26 + Math.sin(wx * 0.011 + t * 5) * 9); riv.push([q[0], q[1], (34 + 16 * Math.sin(wx * 0.006 + t * 3)) * w.z * Math.min(1, (1 - u) * 9 + 0.2), Math.sin(wx * 0.004) * 0.5, wx - t * 260]); } GLc.silk({ pts: riv, c: CODE.extra, seed: 5, t }); }
  FALLS.forEach(([wx, ft], i) => { const a = t - ft - 0.04; if (a <= 0) return; const len = Math.min(2300, 900 * a + 2600 * a * a), pts = [], q0 = gnd(wx) + 34; for (let k = 0; k <= 30; k++) { const u = k / 30, q = toS(w, wx + Math.sin(u * 5 + t * 3 + i) * 10 * u, q0 + u * len); pts.push([q[0], q[1], (86 + 14 * Math.sin(u * 9 - t * 8 + i)) * w.z * (0.75 + 0.25 * Math.min(1, u * 6)) * (u > 0.8 ? 0.35 + 0.65 * (1 - u) / 0.2 : 1), Math.sin(u * 2.2 + i * 1.7 - t * 2) * 0.42, u * len - t * 1500]); } GLc.silk({ pts, c: CODE.extra, seed: 11 + i, t, a: 0.97 }); }); GLc.to(x);
  if (t > G.land) { x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = lg(x, 0, 300, 0, 1080, [rgba('#ff9a1c', 0), rgba('#ffa01c', 0.16 * gk)]); x.fillRect(0, 0, 1920, 1080); x.restore(); }
  GLc.clear(); bob.scarf(t, w); GLc.to(x); x.save(); apply(x, w); if (t > G.land - 0.12) board(x, p, nr(bob.rot(t)) * 0.8, SC * 1.06, t); bob.draw(x, t); const u = since(t, G.land, 0.5); shock(x, XL, GY, u, 620, '#ffd26a', 34, 0.5); shock(x, XL, GY, u * 1.3, 380, '#ffffff', 20, 0.5); if (u > 0 && u < 0.3) glow(x, XL, GY, 520, '#fff2c4', 0.9 * (1 - u / 0.3)); x.restore();
  const L = []; burst(L, t, G.land, XL, GY, { n: 130, a0: -3.05, a1: -0.1, c: ['#ffd26a', '#fff2c4', '#ffb01f'], sd: 41, v1: 1500, life: 1.1 }); const R = 330; for (let j = Math.floor((t - 0.9) * R); j < t * R; j++) { const te = j / R; if (te < G.land || te > G.dive + 0.5) continue; const q = pos(te), v = vx(te), a = t - te, h = k => hash(j * 13 + k), life = 1 - a / (0.45 + h(3) * 0.45); if (life <= 0) continue; const dv = -(100 + h(1) * 700) + v * 0.3, uy = -(200 + h(2) * 900), px = q[0] - 50 + dv * a + (h(4) - 0.5) * 80, py = q[1] - h(6) * 160 + uy * a + 1500 * a * a; L.push([px, py, dv * 0.01, (uy + 3000 * a) * 0.008, (4 + h(5) * 10) * Math.sqrt(life), h(8) > 0.75 ? 3 : h(8) > 0.4 ? 1 : 2, ['#ffd26a', '#fff2c4', '#ffb01f', '#ffffff'][Math.floor(h(7) * 4)], clamp(life * 2)]); } flush(x, w, L); if (t < G.dive - 0.5) fore(x, t, w);
  return w;
}
