// The whole loop in one look: model at one end, your laptop at the other, the agent lapping between them.
import { K, CODE, ink, inner, rr, circ, ell, poly, blob, union, rgba, mix, lg, rg, glow, beam, text, tw, label, sparkle, cached, TAU, clamp, lerp, hash, rng, ease, key, noise, spline } from '../ink.js';
import { gl } from '../gl.js';
import { bot } from '../bot.js';
import { spring, ring } from '../sim.js';
import { apply, toS, par, bump, hit, since, fold, flush, streaks, shock } from './loop_kit.js';
import { model, rose } from './loop_model.js';
import { hall, crystal, fgCrystal } from './loop_world.js';
import { laptop, ball, pageTex } from './loop_lap.js';
import { T } from './loop_run.js';
const CX = 960, CYY = 660, RO = [850, 262], RI = [600, 150], RM = [744, 214]; export const A0 = T.arena + 0.12, A1 = T.dive + 0.3;
const PH = t => { const u = clamp((t - A0) / (A1 - A0)); return 0.2 + 2.24 * (0.62 * u + 0.38 * u * u); }; // laps
const ang = p => Math.PI - p * TAU, P = (p, r = RM) => { const a = ang(p); return [CX + r[0] * Math.cos(a), CYY + r[1] * Math.sin(a) + (1 - Math.abs(Math.cos(a))) * 0, Math.sin(a)]; };
const solve = v => { let a = A0, b = A1; for (let i = 0; i < 30; i++) { const m = (a + b) / 2; PH(m) < v ? (a = m) : (b = m); } return a; };
const LAPT = [0.5, 1.5].map(solve), MODT = [1, 2].map(solve); // laptop passes, model passes
function ringArt(g) {
  // under-structure
  const E = (r, dy = 0) => { const p = new Path2D(); p.ellipse(CX, CYY + dy, r[0], r[1], 0, 0, TAU); return p; };
  g.fillStyle = rg(g, CX, CYY + 120, 1100, [[0, 'rgba(30,6,120,0.9)'], [0.75, 'rgba(20,4,90,0.65)'], [1, 'rgba(20,4,90,0)']]); g.save(); g.translate(0, (CYY + 120) * 0.6); g.scale(1, 0.4); g.beginPath(); g.arc(CX, CYY + 120, 1100, 0, TAU); g.fill(); g.restore();
  const wall = new Path2D(); wall.ellipse(CX, CYY, RO[0], RO[1], 0, 0, Math.PI); wall.lineTo(CX - RO[0] * 0.95, CYY + 88); wall.ellipse(CX, CYY + 88, RO[0] * 0.95, RO[1] * 0.96, 0, Math.PI, 0, true); wall.closePath(); wall.b = [CX - RO[0], CYY, RO[0] * 2, RO[1] + 90]; ink(g, wall, { f: [[0, '#3a0f9a'], [0.14, '#8a5cff'], [0.32, '#c9b4ff'], [0.5, '#7a8cff'], [0.7, '#4a2fd8'], [0.9, '#c03af0'], [1, '#5a12a0']], g: [0, 0, 1, 0], sh: [['rgba(14,0,80,0.75)', 40, 0, -30], ['rgba(255,255,255,0.85)', 8, 0, 5]] }); for (let i = 0; i < 60; i++) { const a = (i + 0.5) / 60 * Math.PI; g.strokeStyle = 'rgba(255,255,255,0.22)'; g.lineWidth = 3; g.beginPath(); g.moveTo(CX + RO[0] * Math.cos(a), CYY + RO[1] * Math.sin(a)); g.lineTo(CX + RO[0] * 0.95 * Math.cos(a), CYY + 88 + RO[1] * 0.96 * Math.sin(a)); g.stroke(); }
  // surface
  const surf = new Path2D(); surf.ellipse(CX, CYY, RO[0], RO[1], 0, 0, TAU); surf.ellipse(CX, CYY, RI[0], RI[1], 0, 0, TAU, true); surf.b = [CX - RO[0], CYY - RO[1], RO[0] * 2, RO[1] * 2]; ink(g, surf, { f: [[0, '#3a22b8'], [0.22, '#3a58e8'], [0.5, '#48a4ff'], [0.8, '#5a7cff'], [1, '#4a30d8']], g: [0.5, 0, 0.5, 1], sh: [['rgba(255,255,255,0.55)', 14, 0, 6], ['rgba(20,0,110,0.6)', 30, 0, -12]] });
  for (let i = 0; i < 96; i++) { const a = i / 96 * TAU; g.strokeStyle = i % 4 ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.35)'; g.lineWidth = i % 4 ? 1.5 : 3; g.beginPath(); g.moveTo(CX + RO[0] * Math.cos(a), CYY + RO[1] * Math.sin(a)); g.lineTo(CX + RI[0] * Math.cos(a), CYY + RI[1] * Math.sin(a)); g.stroke(); }
  [[0.2, 5, '#ffffff', 0.9], [0.66, 5, '#ff7fe0', 0.9], [0.86, 4, '#8ff2ff', 0.9]].forEach(([k, w, c, a]) => { g.strokeStyle = rgba(c, a); g.lineWidth = w; g.beginPath(); g.ellipse(CX, CYY, lerp(RO[0], RI[0], k), lerp(RO[1], RI[1], k), 0, 0, TAU); g.stroke(); });
  g.lineWidth = 9; g.strokeStyle = lg(g, CX - 850, 0, CX + 850, 0, ['#ffffff', '#c9b4ff', '#8ff2ff', '#ffffff', '#ff9ae8']); g.stroke(E(RO)); g.lineWidth = 6; g.stroke(E(RI));
  // infield: still light-water
  const inf = E([RI[0] - 4, RI[1] - 3]); inf.b = [CX - RI[0], CYY - RI[1], RI[0] * 2, RI[1] * 2]; ink(g, inf, { f: ['#2a12a8', '#3a1fd0', '#5a2be8', '#8a3cf0'], g: [0.5, 0, 0.5, 1], sh: [['rgba(8,0,60,0.8)', 36, 0, 18], ['rgba(160,230,255,0.6)', 14, 0, -8]] }); g.save(); g.clip(inf); g.globalCompositeOperation = 'lighter'; [[430, '#8ff2ff', 0.5], [1480, '#6affd0', 0.45]].forEach(([px, c, a]) => { g.save(); g.translate(px, CYY + 20); g.scale(1, 0.28); g.fillStyle = rg(g, 0, 0, 420, [rgba(c, a), rgba(c, a * 0.3), rgba(c, 0)]); g.fillRect(-420, -420, 840, 840); g.restore(); }); for (let i = 1; i < 7; i++) { g.strokeStyle = `rgba(200,220,255,${0.16 - i * 0.015})`; g.lineWidth = 2.5; g.beginPath(); g.ellipse(CX, CYY, RI[0] * i / 7, RI[1] * i / 7, 0, 0, TAU); g.stroke(); } g.restore();
  // painted words, in perspective
  
}
export function arenaView(t) { const p = P(PH(t)), z = key(t, [[A0 - 0.2, 4.2], [A0 + 0.42, 1.06, ease.out3], [(A0 + A1) / 2, 0.99, ease.sine], [A1 - 0.42, 1.0, ease.sine], [A1 + 0.05, 4.4, ease.in3]]), k = clamp((z - 1) / 2.2); return { cx: lerp(960, p[0], k), cy: lerp(540, p[1] - 30, k), z, r: lerp(0.02, -0.025, clamp((t - A0) / (A1 - A0))), sx: 0, sy: 0 }; }
export function arena(x, t) {
  const w = arenaView(t), ph = PH(t), me = P(ph); hall(x, t, { ...w, cx: 960 + (w.cx - 960) * 0.4, cy: 540 + (w.cy - 540) * 0.4 + 120, z: 1 + (w.z - 1) * 0.3 }, { noStraight: true });
  x.save(); apply(x, w); rose(x, t, 960, 250, 470, 0.5); x.save(); x.fillStyle = lg(x, 0, 380, 0, 760, [rgba('#5a22c8', 0), '#3410a0', '#1c0670']); x.fillRect(-900, 380, 3800, 1400); x.restore();
  for (let i = 0; i < 11; i++) { x.save(); x.translate(-140 + i * 220 + (hash(i) - 0.5) * 90, 500 + Math.abs(i - 5) * 13); const q = 0.27 + hash(i * 3) * 0.1; x.scale(hash(i * 7) > 0.5 ? q : -q, q); crystal(x, 'm', 'mid', i % 4, { res: 0.8, blur: 0.6 }); x.restore(); }
  x.restore(); x.save(); apply(x, w); cached(x, 'lpArena', 0, 300, 1920, 760, ringArt, 1.6);
  // trails left by finished legs: cyan out (ask), green back (fetch)
  const leg = (p0, p1, c, a, wd) => { if (p1 <= p0) return; x.save(); x.lineCap = 'butt'; const n = Math.max(3, Math.ceil((p1 - p0) * 70)); [[wd * 2.6, 0.28], [wd * 1.5, 0.85], [wd * 0.5, 1]].forEach(([lw, al], q) => { x.globalCompositeOperation = q ? 'source-over' : 'lighter'; x.strokeStyle = rgba(q === 2 ? mix(c, '#ffffff', 0.75) : c, al * a); x.lineWidth = lw; x.beginPath(); for (let i = 0; i <= n; i++) { const u = P(lerp(p0, p1, i / n)); x[i ? 'lineTo' : 'moveTo'](u[0], u[1]); } x.stroke(); }); x.restore(); };
  const legs = back => { for (let k = 0; k < 4; k++) { const o0 = k, o1 = k + 0.5, b1 = k + 1; const fade = q => Math.pow(clamp(1 - Math.max(0, ph - q) * 0.3), 1.1); if (!back && ph > o0) leg(Math.max(o0, k ? o0 : 0.17), Math.min(ph, o1), '#4be8ff', fade(o1), 20); if (back && ph > o1) leg(o1, Math.min(ph, b1), K.need, fade(b1), 20); } };
  const runner = () => { const s = lerp(0.28, 0.36, (me[2] + 1) / 2), out = (ph % 1) < 0.5, f = out ? 1 : -1, c = out ? '#8ff2ff' : K.need; glow(x, me[0], me[1] - 60, 190, c, 0.7); const bx = { p: [me[0], me[1] - 130 * s], s, yaw: f * 0.95, rot: f * 0.22, t, key: '#ffffff', fill: c, eyes: { focus: 1 }, hands: [[f * 110 * Math.cos(t * 26), -140], [-f * 110 * Math.cos(t * 26), -140]], feet: [0, 1].map(i => { const a = t * 26 + i * Math.PI; return [f * Math.cos(a) * 120, 140 - Math.max(0, -Math.sin(a)) * 90, f * Math.cos(a) * 0.5]; }) }; bot(x, bx); if (out) ball(x, me[0] - 4, me[1] - 660 * s, 30 * s / 0.2, ['?'], t); else { x.save(); x.translate(me[0], me[1] - 690 * s); x.rotate(-0.12 + Math.sin(t * 20) * 0.1); glow(x, 0, 0, 90, K.need, 0.7); x.drawImage(pageTex(), -46 * s / 0.2, -32 * s / 0.2, 92 * s / 0.2, 64 * s / 0.2); x.restore(); } };
  const paint = (s, px, py, sx, sy) => { x.save(); x.translate(px, py); x.scale(sx, sy); x.font = '900 120px "SF Pro Rounded", ui-rounded, sans-serif'; x.letterSpacing = '26px'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineWidth = 26; x.strokeStyle = '#2410a0'; x.strokeText(s, 0, 0); x.fillStyle = '#ffffff'; x.fillText(s, 0, 0); x.restore(); };
  legs(true); paint('◂ FETCH', CX, CYY - 204, 0.66, 0.36); if (me[2] < 0) runner();
  // back gates
  const gates = front => [0.12, 0.38, 0.62, 0.88].forEach(g0 => { const a = ang(g0), fr = Math.sin(a) > 0; if (fr !== front) return; const o = [CX + RO[0] * Math.cos(a), CYY + RO[1] * Math.sin(a)], n = [CX + RI[0] * Math.cos(a), CYY + RI[1] * Math.sin(a)], d = Math.min(Math.abs(((ph - g0) % 1 + 1) % 1), Math.abs(((g0 - ph) % 1 + 1) % 1)), hot = clamp(1 - d * 9), H = fr ? 150 : 110; x.lineCap = 'round'; [[20, '#2a0f8a'], [14, '#b9a0ff'], [5, mix('#8ff2ff', '#ffffff', hot)]].forEach(([lw, c]) => { x.lineWidth = lw; x.strokeStyle = c; x.beginPath(); x.moveTo(...o); x.bezierCurveTo(o[0], o[1] - H * 1.3, n[0], n[1] - H * 1.3, ...n); x.stroke(); }); if (hot > 0) glow(x, (o[0] + n[0]) / 2, (o[1] + n[1]) / 2 - H, 180, '#8ff2ff', hot * 0.8); });
  gates(false);
  x.save(); x.translate(1490, CYY + 34); x.scale(0.4, 0.4); laptop(x, t, { open: 0, page: LAPT.some(q => t > q - 0.05 && t < q + 0.1), flash: LAPT.reduce((a, q) => a + hit(t, q, 8), 0) * 0.7 }); x.restore(); LAPT.forEach(q => shock(x, 1490, CYY - 110, since(t, q, 0.5), 300, K.need, 24));
  x.save(); x.translate(430, CYY + 36); x.scale(0.52, 0.52); model(x, t, { evs: [...MODT.map(q => [q, 1.4]), ...MODT.map(q => [q - 0.04, 0.6])], charge: MODT.reduce((a, q) => a + bump(t, q - 0.06, q + 0.04, 0.12, 0.1), 0) * 0.6 }); x.restore(); MODT.forEach(q => { shock(x, 430, CYY - 200, since(t, q, 0.5), 360, '#8ff2ff', 24); });
  legs(false); paint('ASK ▸', CX, CYY + 208, 0.8, 0.5); gates(true); if (me[2] >= 0) runner(); [[-60, 1150, 0.62, 1], [1990, 1170, 0.6, -1], [260, 1190, 0.36, -1], [1690, 1190, 0.36, 1]].forEach(([px, py, sc, f], i) => { x.save(); x.translate(px, py); x.scale(sc * f, sc); fgCrystal(x, i % 2); x.restore(); }); x.restore();
  const sp = clamp((w.z - 1.1) / 2); if (sp > 0) { const L = []; for (let i = 0; i < 40; i++) { const a = hash(i) * TAU, r0 = 260 + ((t * 2600 + hash(i * 3) * 900) % 900), l = 90 + hash(i * 5) * 200; L.push([960 + Math.cos(a) * r0 * 1.2, 540 + Math.sin(a) * r0, Math.cos(a) * l * sp, Math.sin(a) * l * sp, 2 + hash(i * 7) * 2, 2, '#eafcff', 0.4 * sp]); } const G = gl(); G.clear(); G.parts(L); G.to(x); }
  return w;
}
export const arenaLabels = (x, t) => { const a = A0 + 0.4, b = A1 - 0.42; label(x, 'The model', 700, 150, 60, t, a, b, null); label(x, 'Your computer', 1490, 268, 60, t, a + 0.1, b, null); };
