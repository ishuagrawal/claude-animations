// Night in the same room: the bloom still fills the window, the fix sits on the screen, and the lanterns quietly leave.
import { K, CODE, ink, inner, rr, circ, ell, poly, blob, union, rgba, mix, lg, rg, glow, beam, text, tw, shadowEll, cached, plane, sparkle, TAU, clamp, lerp, rng, hash, ease, key, noise } from '../ink.js';
import { dev } from '../dev.js';

import { gl } from '../gl.js';
import { spring, ring, chain } from '../sim.js';
import { T } from './finale_time.js';
import { dots } from './finale_sky.js';

const ZH = 1.185, YH = -150, DB = 3.2, A0 = T.pull - 0.5, A1 = T.end + 1.5;
// one slow dolly out through the window, then the gentlest push in
const zK = t => (t < T.room ? lerp(ZH, 0.0, ease.io2(clamp((t - T.pull) / (T.room - T.pull)))) : 0.085 * ease.sine(clamp((t - T.room) / (T.end - T.room)))); const zS = spring(A0, A1, zK, 9, 1);
const yS = spring(A0, A1, t => lerp(YH, 2, ease.io2(clamp((t - T.pull - 0.1) / (T.room - T.pull)))), 9, 1), xS = spring(A0, A1, t => lerp(0, 46, ease.io2(clamp((t - T.pull - 0.2) / (T.room - T.pull + 0.4)))), 7, 1);
export const roomCam = t => ({ x: xS(t), y: yS(t), z: zS(t), zoom: 1, r: 0 });
export const inRoom = t => t > T.pull - 0.02;
// the bloom outside, seen from the room
export const outside = t => { const c = roomCam(t), s = 1 / (DB - c.z), z = (DB - ZH) * s; return { x: 960, y: 540, zoom: z, r: 0, sx: -c.x * s, sy: (YH - c.y) * s, room: true }; };
const at3 = (c, d, wx, wy) => { const s = 1 / Math.max(0.04, d - c.z); return [960 + (wx - c.x) * s, 540 + (wy - c.y) * s, s]; };
const leaf = (x, a, l, w, c) => { x.save(); x.rotate(a); const p = blob([[0, 0], [-w, -l * 0.4], [-w * 0.5, -l * 0.85], [0, -l], [w * 0.5, -l * 0.85], [w, -l * 0.4]]); ink(x, p, { f: c, g: [0.2, 0, 0.8, 1], sh: [['rgba(4,50,40,0.5)', 22, -8, -10], ['rgba(255,250,180,0.6)', 10, 5, 5]] }); x.strokeStyle = 'rgba(255,255,210,0.4)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, -8); x.lineTo(0, -l * 0.9); x.stroke(); x.restore(); };
const skyline = (sd, a, b, lit) => g => { const r = rng(sd); let bx = -1480; while (bx < 1480) { const w = 70 + r() * 120, h = 180 + r() * (lit ? 340 : 480); ink(g, rr(bx, 400 - h, w, h + 220, 14), { f: [a, b], g: [0.5, 0, 0.5, 1], sh: [['rgba(120,30,110,0.35)', 24, -12, 0], ['rgba(255,245,200,0.85)', 9, 5, 5]] }); for (let j = 0; j < h / 46; j++) for (let k = 0; k < w / 34 - 1; k++) if (r() > 0.6) { g.fillStyle = r() > 0.4 ? 'rgba(255,240,190,0.75)' : 'rgba(255,190,150,0.5)'; g.fill(rr(bx + 18 + k * 32, 424 - h + j * 44, 14, 20, 4)); } bx += w + 8; } };
function wallArt(g) { // plane 1.75 static art, 4400 x 2800 at (-2200,-1500)
  const hole = new Path2D(); hole.rect(-2200, -1500, 4400, 2800); hole.arc(0, -150, 640, 0, TAU); g.fillStyle = lg(g, -1400, -900, 1200, 900, ['#54246f', '#8a3f72', '#b85f66', '#7a3270', '#3f1660']); g.fill(hole, 'evenodd'); g.save(); g.clip(hole, 'evenodd');
  g.fillStyle = rg(g, 0, -150, 1700, [[0, 'rgba(255,214,140,0.95)'], [0.42, 'rgba(255,186,112,0.85)'], [0.55, 'rgba(244,146,96,0.5)'], [0.75, 'rgba(210,100,100,0.2)'], [1, 'rgba(180,80,110,0)']]); g.fillRect(-2200, -1500, 4400, 2800);
  // light pool of the window thrown on the wall, panel moulding
  g.strokeStyle = 'rgba(255,220,180,0.12)'; g.lineWidth = 6; [[-1900, -900, 700, 1500], [1180, -900, 760, 1500]].forEach(q => { g.beginPath(); g.roundRect(q[0], q[1], q[2], q[3], 40); g.stroke(); });
  g.restore();
  const ringP = new Path2D(); ringP.arc(0, -150, 690, 0, TAU); ringP.arc(0, -150, 628, 0, TAU, true); ringP.b = [-690, -840, 1380, 1380]; ink(g, ringP, { f: ['#ffe0a8', '#f08a5c', '#a8406c', '#6a2478'], g: [0.35, 0, 0.6, 1], sh: [['rgba(90,10,70,0.6)', 26, -10, -14], ['rgba(255,255,225,0.95)', 14, 6, 8]] });
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; ink(g, circ(Math.cos(a) * 660, -150 + Math.sin(a) * 660, 8), { f: ['#fff6d8', '#d9824a'], sh: [['rgba(90,10,60,0.5)', 4, -2, -2]] }); }
  g.strokeStyle = 'rgba(255,255,235,0.95)'; g.lineWidth = 5; g.beginPath(); g.arc(0, -150, 628, 0, TAU); g.stroke();
}
// the two halves of the window stand open
function sash(x, t) { [-1, 1].forEach(q => { const sw = 0.2 + Math.sin(t * 0.7 + q) * 0.012; x.save(); x.translate(q * 632, -150); x.scale(-q * sw, 1); const p = new Path2D(); p.arc(0, 0, 606, -Math.PI / 2, Math.PI / 2); p.lineTo(0, -606); p.b = [0, -606, 606, 1212]; x.fillStyle = lg(x, 0, -500, 600, 500, ['rgba(255,255,240,0.35)', 'rgba(255,210,170,0.14)', 'rgba(255,240,200,0.3)']); x.fill(p); x.lineJoin = 'round'; x.strokeStyle = lg(x, 0, -600, 0, 600, ['#ffd9a0', '#c9686a', '#7a2c74']); x.lineWidth = 70; x.save(); x.clip(p); x.stroke(p); x.strokeStyle = 'rgba(255,250,220,0.9)'; x.lineWidth = 10; x.stroke(p); x.restore(); x.restore(); }); }
function shelfArt(g) { ink(g, rr(-330, 0, 520, 34, 14), { f: ['#ffcf9a', '#c9686a', '#7a2c74'], sh: [['rgba(80,0,70,0.5)', 14, 0, -8], ['rgba(255,255,235,0.8)', 6, 0, 4]], drop: ['rgba(60,0,60,0.45)', 30, 0, 18] }); const cols = ['#ff7a8a', '#5fc8f0', '#ffd06b', '#b08bff', '#5fe0b0', '#ff9a5c']; let bx = -300; [38, 46, 34, 52, 40, 44].forEach((w, i) => { const h = [170, 210, 150, 190, 224, 176][i]; ink(g, rr(bx, -h, w, h, 8), { f: [mix(cols[i], '#fff0c8', 0.4), cols[i], mix(cols[i], '#5a0a6c', 0.5)], g: [0.9, 0, 0.1, 1], sh: [['rgba(60,0,70,0.45)', 12, 7, 0], ['rgba(255,255,230,0.75)', 6, -4, 2]] }); g.fillStyle = 'rgba(255,255,240,0.7)'; g.fill(rr(bx + 9, -h + 24, w - 18, 8, 4)); g.fillRect(bx + 9, -h + 42, w - 18, 3); bx += w + 6; }); ink(g, poly([[54, -82], [166, -82], [152, 0], [68, 0]], 14), { f: ['#ffd9a0', '#f0805c', '#a83468'], g: [0.9, 0, 0.1, 1], sh: [['rgba(90,0,60,0.5)', 18, 10, -6], ['rgba(255,250,220,0.9)', 8, -4, 4]] }); }
function lampArt(g) { g.lineCap = 'round'; g.strokeStyle = lg(g, 0, -400, 0, 0, ['#ffc9a0', '#8a3a86']); g.lineWidth = 22; g.beginPath(); g.moveTo(60, 60); g.quadraticCurveTo(140, -260, -40, -400); g.stroke(); g.strokeStyle = 'rgba(255,246,210,0.8)'; g.lineWidth = 5; g.beginPath(); g.moveTo(52, 60); g.quadraticCurveTo(130, -256, -46, -396); g.stroke(); ink(g, rr(-70, 40, 260, 40, 18), { f: ['#ffc9a0', '#a84a80', '#5a1a6c'] }); g.translate(-60, -400); g.rotate(0.42); ink(g, poly([[-54, -110], [54, -110], [140, 50], [-140, 50]], 26), { f: ['#ffd9a8', '#f0706a', '#9a2a72'], g: [0, 0, 1, 1], sh: [['rgba(80,0,60,0.55)', 30, -16, -10], ['rgba(255,250,220,0.95)', 14, 7, 7]] }); ink(g, ell(0, 50, 126, 24), { f: ['#8a4468', '#c9786a'] }); }
// ---- laptop: a 3/4 slab, screen in its own flat space 640 x 410 (origin: hinge centre, screen goes up)
const LW = 640, LH = 412, LP = [352, 398], SK = [0.965, 0.052, -0.05, 1];
const toL = (u, v) => [LP[0] + SK[0] * u + SK[2] * v, LP[1] + SK[1] * u + SK[3] * v]; // laptop-flat -> desk plane world
// the terminal: the request, the one-line edit, and (on "bug fix") the green check
const okS = spring(A0, A1, t => (t > T.fixed ? 1 : 0), 16, 0.55);
function screen(x, t) {
  const p = rr(-LW / 2 + 16, -LH + 14, LW - 32, LH - 30, 16); x.save(); x.clip(p); x.fillStyle = lg(x, -300, -LH, 300, 0, ['#2a2090', '#181060', '#0c0838']); x.fillRect(-LW / 2, -LH, LW, LH); glow(x, 160, -170, 320, '#5a8cff', 0.32); glow(x, -250, -380, 260, '#ff9ab0', 0.14);
  x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(-LW / 2, -LH, LW, 54); ['#ff6b6b', '#ffc93d', '#3ee6a0'].forEach((c, i) => ink(x, circ(-280 + i * 26, -LH + 34, 8.5), { f: [mix(c, '#ffffff', 0.4), c] })); text(x, 'login-app', 0, -LH + 35, '#d9ccff', 21, { w: 700 });
  const X0 = -LW / 2 + 52, Y0 = -LH + 112, mono = (s, X, Y, c, fs, w = 600) => text(x, s, X, Y, c, fs, { mono: true, w, align: 'left' });
  mono('$ agent', X0, Y0, '#9d92d8', 27); mono('> fix the login bug', X0, Y0 + 52, '#ffffff', 30, 700);
  mono('auth.js', X0 + 24, Y0 + 108, '#b8aef0', 25); mono('+1', X0 + 166, Y0 + 108, '#3ee6a0', 25, 700); mono('-1', X0 + 214, Y0 + 108, '#ff7a8a', 25, 700); mono('one line changed', X0 + 266, Y0 + 108, 'rgba(184,174,240,0.7)', 22);
  const k = okS(t), o = clamp(k); if (o > 0.01) { x.save(); x.globalAlpha = o; x.translate(X0 + 14, Y0 + 178); x.scale(lerp(0.6, 1, clamp(k, 0, 1.2)), lerp(0.6, 1, clamp(k, 0, 1.2))); glow(x, 120, 0, 190, '#2ff0a6', 0.22 * o); x.strokeStyle = '#3ee6a0'; x.lineWidth = 6; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(-12, 0); x.lineTo(-3, 9); x.lineTo(14, -11); x.stroke(); mono('login works', 34, 0, '#c9ffe6', 31, 800); x.restore(); }
  if ((t * 1.1) % 1 < 0.55) { x.fillStyle = 'rgba(220,210,255,0.85)'; x.fillRect(X0, Y0 + (o > 0.01 ? 216 : 160), 15, 28); }
  x.fillStyle = lg(x, -320, -LH, 100, -60, ['rgba(255,240,210,0.16)', 'rgba(255,240,210,0)']); x.beginPath(); x.moveTo(-320, -LH); x.lineTo(60, -LH); x.lineTo(-170, 0); x.lineTo(-320, 0); x.fill(); x.restore();
}
function laptop(x, t) {
  x.save(); x.translate(...LP); // desk shadow
  x.save(); x.translate(-30, 76); x.scale(1, 0.16); x.fillStyle = rg(x, 0, 0, 460, ['rgba(50,0,60,0.75)', 'rgba(50,0,60,0.4)', 'rgba(50,0,60,0)']); x.fillRect(-480, -480, 960, 960); x.restore();
  // base
  const F = (u, v) => [SK[0] * u - v * 46, SK[1] * u + v * 118]; const B = poly([F(-LW / 2 - 6, 0), F(LW / 2 + 6, 0), F(LW / 2 + 12, 1), F(-LW / 2 - 12, 1)], 16); ink(x, poly([F(-LW / 2 - 12, 0.98), F(LW / 2 + 12, 0.98), [F(LW / 2 + 12, 1)[0], F(LW / 2 + 12, 1)[1] + 18], [F(-LW / 2 - 12, 1)[0], F(-LW / 2 - 12, 1)[1] + 18]], 8), { f: ['#a88ae0', '#4a2c9a'] }); ink(x, B, { f: ['#f6ecff', '#c9b0f0', '#8a6cd0'], g: [0.8, 0, 0.2, 1], sh: [['rgba(40,10,110,0.45)', 24, 12, -6], ['rgba(255,245,215,0.95)', 8, -3, 4]] });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 13; c++) { const u0 = -LW / 2 + 30 + c * 45, v0 = 0.12 + r * 0.16; x.fillStyle = r === 1 && c === 12 ? '#4be8ff' : '#3a2a92'; x.beginPath(); [F(u0, v0), F(u0 + 39, v0), F(u0 + 39, v0 + 0.125), F(u0, v0 + 0.125)].forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](...p)); x.fill(); } x.fillStyle = 'rgba(90,60,180,0.35)'; x.beginPath(); [F(-80, 0.8), F(90, 0.8), F(92, 0.97), F(-82, 0.97)].forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](...p)); x.fill();
  x.save(); x.transform(SK[0], SK[1], SK[2], SK[3], 0, 0);
  glow(x, 0, -200, 520, '#8fb8ff', 0.22); ink(x, rr(-LW / 2 - 4, -LH - 2, LW + 14, LH + 4, 30), { f: ['#6a4cc0', '#2a1280'] }); ink(x, rr(-LW / 2, -LH, LW, LH, 28), { f: ['#f2e6ff', '#b9a0ec', '#7a5cc8'], g: [0.1, 0, 0.8, 1], sh: [['rgba(40,10,110,0.5)', 16, -8, -8], ['rgba(255,246,220,0.95)', 8, 4, 4]], drop: ['rgba(60,0,60,0.4)', 40, 10, 20] }); ink(x, rr(-LW / 2 + 12, -LH + 10, LW - 24, LH - 22, 20), { f: '#0c0640' }); screen(x, t); x.restore();
  ink(x, rr(-LW / 2 * SK[0] + 40, -10, LW * SK[0] - 80, 16, 8), { f: ['#a88ae0', '#3a2290'] });
  x.restore();
}
// ---- developer: eyes on the screen the whole time; a small smile when the check lands
const riseS = spring(A0, A1, t => { const z = zK(t); return 760 * ease.io2(clamp((z - 0.06) / 0.5)); }, 10, 0.9);
const mouthS = spring(A0, A1, t => (t < T.fixed + 0.15 ? 0.12 : t < T.leave + 1.2 ? 0.62 : 0.4), 7, 0.8);
const lookS = spring(A0, A1, t => (t < T.fixed ? [0.95, 0.72] : [0.98, 0.62]), 9, 0.8);
const DX = -440, DP = 1.15;
export function room(x, t) {
  const c = roomCam(t), G = gl(), u = ease.io2(clamp((t - T.pull - 0.5) / (T.room - T.pull - 0.3)));
  // wall, window, shelf, lamp
  plane(x, c, 1.75, () => { x.save(); x.globalAlpha = ease.io2(clamp((t - T.pull - 0.25) / 0.5)); sash(x, t); x.restore(); cached(x, 'finWall', -2200, -1500, 4400, 2800, wallArt, 0.62); x.save(); x.translate(-1120, -40); cached(x, 'finShelf', -360, -250, 600, 310, shelfArt, 1); x.translate(110, 0); [[-0.75, 130, 26], [-0.25, 170, 30], [0.3, 164, 30], [0.8, 124, 26]].forEach(([a, l, w], i) => { x.save(); x.translate(0, -74); leaf(x, a + Math.sin(t * 0.9 + i) * 0.05, l, w, ['#e6ff9a', '#3fd08a', '#0f7a70']); x.restore(); }); x.restore(); x.save(); x.translate(1330, 470); cached(x, 'finLamp', -300, -620, 560, 720, lampArt, 0.8); x.restore(); });
  // developer, lit by the screen and the bloom behind
  const rise = riseS(t); if (c.z < 0.62 && rise < 700) plane(x, c, DP, () => { const m = mouthS(t), bl = (t % 3.7) > 3.58 || (t > T.fixed + 0.3 && t < T.fixed + 0.42) ? 0.12 : lerp(1, 0.86, clamp(m - 0.45) * 2); glow(x, DX + 60, 40, 620, '#ffcf8a', 0.16 * u); glow(x, DX + 260, 120, 420, '#7f9cff', 0.12 * u); dev(x, DX, 92 + rise + Math.sin(t * 1.5) * 2, 1.02, { t, look: lookS(t), blink: bl, brow: 0.12, mouth: m, tilt: 0.035 + Math.sin(t * 0.8) * 0.008, key: '#ffcf9a', keyA: 0.75, warm: 1.25, lensA: 0.34, lens: (g, R) => { g.fillStyle = lg(g, -R, -R, R, R, ['rgba(255,236,180,0.95)', 'rgba(255,170,120,0.35)', 'rgba(160,120,255,0.3)']); g.fillRect(-R, -R, R * 2, R * 2); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 5; g.beginPath(); g.arc(R * 0.1, -R * 0.1, R * 0.5, 0, TAU); g.stroke(); } }); });
  // desk
  if (c.z < 0.5) plane(x, c, 1.0, () => { const dy = 330; x.translate(0, 560 * ease.io2(clamp((c.z - 0.03) / 0.42))); x.fillStyle = lg(x, 0, dy, 0, 720, ['#ffb98a', '#e0706e', '#9a3878', '#5a1c6a']); x.fillRect(-1500, dy, 3000, 700); x.fillStyle = 'rgba(255,246,214,0.95)'; x.fillRect(-1500, dy, 3000, 5); x.save(); x.globalCompositeOperation = 'lighter'; x.fillStyle = rg(x, 260, dy, 900, ['rgba(255,210,130,0.5)', 'rgba(255,180,120,0.14)', 'rgba(255,180,120,0)']); x.fillRect(-1500, dy, 3000, 700); x.restore();
    for (let i = 0; i < 7; i++) { x.strokeStyle = 'rgba(120,20,80,0.14)'; x.lineWidth = 3; x.beginPath(); const y = dy + 26 + i * i * 5 + i * 14; x.moveTo(-1500, y); x.bezierCurveTo(-500, y - 8, 400, y + 12, 1500, y - 4); x.stroke(); }
    x.save(); x.translate(-520, dy + 40); x.save(); x.translate(-60, 46); x.scale(1, 0.18); x.fillStyle = rg(x, 0, 0, 150, ['rgba(70,0,60,0.6)', 'rgba(70,0,60,0)']); x.fillRect(-160, -160, 320, 320); x.restore(); for (let i = 0; i < 3; i++) { const q = (t * 0.22 + i / 3) % 1; x.save(); x.globalAlpha = 0.6 * Math.sin(q * Math.PI); x.strokeStyle = 'rgba(255,250,230,0.9)'; x.lineWidth = 11 + q * 5; x.lineCap = 'round'; x.beginPath(); x.moveTo(-22 + i * 22, -120 - q * 80); x.bezierCurveTo(-50 + i * 22 + Math.sin(t * 1.4 + i) * 20, -160 - q * 80, 10 + i * 22, -190 - q * 80, -20 + i * 22, -230 - q * 80); x.stroke(); x.restore(); } x.lineWidth = 24; x.strokeStyle = lg(x, 60, -80, 110, 20, ['#bff4ff', '#3a7be0']); x.beginPath(); x.arc(70, -40, 36, -1.5, 1.5); x.stroke(); ink(x, rr(-72, -110, 144, 150, 30), { f: ['#c9f8ff', '#4fb0f5', '#2a4cc8'], g: [1, 0, 0, 1], sh: [['rgba(20,10,110,0.55)', 36, 20, -8], ['rgba(255,250,220,0.95)', 16, -8, 8]] }); ink(x, ell(0, -106, 70, 15), { f: ['#5a2a3e', '#a8604e'] }); x.restore();
    laptop(x, t); });
  // dust in the light
  if (t > T.pull + 0.2) { const L = []; for (let i = 0; i < 60; i++) { const h = k => hash(i * 47 + k), px = h(1) * 1920 + Math.sin(t * 0.3 + i) * 40, py = (h(2) * 1080 + t * (8 + h(3) * 14)) % 1080; L.push([px, py, 0, 0, 2 + h(4) * 3, 0, '#ffe9b8', 0.3 * u * (0.5 + 0.5 * Math.sin(t * 1.4 + i * 2))]); } G.clear(); dots(G, L); G.to(x); }
  // foreground leaves, out of focus
  plane(x, c, 0.62, () => { if (c.z > 0.3) return; x.globalAlpha = clamp(1 - c.z * 3); cached(x, 'finFgL', -760, -160, 620, 700, g => { g.save(); g.translate(-640, 500); [[-0.5, 380, 70], [0.0, 430, 74], [0.5, 330, 66]].forEach(([r, l, w]) => leaf(g, r, l, w, ['#e8c86a', '#7a8a4a', '#4a2c58'])); g.restore(); }, 1, 14); });
  // warm wash
  x.save(); x.globalCompositeOperation = 'soft-light'; x.globalAlpha = u * 0.55; x.fillStyle = lg(x, 300, 0, 1500, 1080, ['rgba(255,220,150,0.35)', 'rgba(255,160,90,0.3)', 'rgba(160,60,140,0.25)']); x.fillRect(0, 0, 1920, 1080); x.restore();
  // fine print
  const fa = ease.io2(clamp((t - T.type) / 0.8)); if (fa > 0) { x.save(); x.globalAlpha = fa; x.fillStyle = lg(x, 0, 930, 0, 1080, ['rgba(60,10,70,0)', 'rgba(60,10,70,0.55)']); x.fillRect(0, 930, 1920, 150); x.shadowColor = 'rgba(50,0,60,0.8)'; x.shadowBlur = 14 * x.getTransform().a; text(x, 'From public docs and source code, November 2026.', 120, 1004 + (1 - fa) * 10, '#fff6e4', 27, { w: 700, align: 'left' }); text(x, 'Practices differ by tool, plan and settings.', 120, 1042 + (1 - fa) * 14, '#fff6e4', 27, { w: 700, align: 'left' }); x.restore(); }
}
