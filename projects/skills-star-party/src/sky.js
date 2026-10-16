// The "style" both videos share (1920×1080 coordinates): a pastel sky with a soft sun, drifting
// clouds, two layers of rolling hills with grass and tiny flowers along the crest. The reference
// video (a bouncing-ball test) and the short Claude makes from it are both drawn in this world.
import { TAU, rng } from './core.js';

export const PAL = { skyTop: '#a9d6ff', skyMid: '#d9edff', horizon: '#ffe8da', sun: '#ffd66e', hill: '#9edcae', hillDk: '#7ccb92', back: '#c6ecd2', coral: '#ff7a6b' };
const HILL = { cx: 960, cy: 1480, rx: 1250, ry: 640 };      // the front hill (top at y = 840)
export const surface = x => HILL.cy - HILL.ry * Math.sqrt(Math.max(0, 1 - ((x - HILL.cx) / HILL.rx) ** 2));
export const SUN = [1540, 230];

function cloud(ctx, x, y, s) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const blobs = [[-70, 10, 52], [-20, -18, 66], [45, -6, 58], [90, 14, 42], [10, 22, 50]];
  ctx.fillStyle = 'rgba(120,150,200,0.16)';
  ctx.beginPath(); for (const [bx, by, r] of blobs) { ctx.moveTo(bx + r, by + 12); ctx.arc(bx, by + 12, r, 0, TAU); } ctx.fill();
  const g = ctx.createLinearGradient(0, -80, 0, 70);
  g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#eef4ff');
  ctx.fillStyle = g;
  ctx.beginPath(); for (const [bx, by, r] of blobs) { ctx.moveTo(bx + r, by); ctx.arc(bx, by, r, 0, TAU); } ctx.fill();
  ctx.restore();
}

export function sky(ctx, t) {
  const g = ctx.createLinearGradient(0, 0, 0, 900);
  g.addColorStop(0, PAL.skyTop); g.addColorStop(0.55, PAL.skyMid); g.addColorStop(1, PAL.horizon);
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  // sun: glow, soft rays, disc with a warm rim
  const [sx, sy] = SUN;
  const glow = ctx.createRadialGradient(sx, sy, 40, sx, sy, 420);
  glow.addColorStop(0, 'rgba(255,236,170,0.75)'); glow.addColorStop(1, 'rgba(255,236,170,0)');
  ctx.fillStyle = glow; ctx.fillRect(sx - 420, sy - 420, 840, 840);
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.12);
  ctx.fillStyle = 'rgba(255,240,190,0.35)';
  for (let i = 0; i < 12; i++) { ctx.rotate(TAU / 12); ctx.beginPath(); ctx.moveTo(0, -100); ctx.lineTo(10, -150); ctx.lineTo(-10, -150); ctx.closePath(); ctx.fill(); }
  ctx.restore();
  const d = ctx.createRadialGradient(sx - 20, sy - 24, 8, sx, sy, 86);
  d.addColorStop(0, '#fffbe6'); d.addColorStop(0.6, PAL.sun); d.addColorStop(1, '#f7b64a');
  ctx.fillStyle = d; ctx.beginPath(); ctx.arc(sx, sy, 86, 0, TAU); ctx.fill();
  // clouds drifting
  cloud(ctx, 380 + ((t * 18) % 2400) - 300, 210, 1.0);
  cloud(ctx, 1150 + ((t * 11) % 2400) - 1300, 330, 0.7);
  cloud(ctx, 900 - ((t * 9) % 2600) + 1300, 150, 0.55);
  // back hills
  for (const [cx, cy, rx, ry, c] of [[300, 1250, 900, 520, PAL.back], [1700, 1230, 820, 480, '#b8e3c5']]) {
    const hg = ctx.createLinearGradient(0, cy - ry, 0, cy - ry + 300);
    hg.addColorStop(0, c); hg.addColorStop(1, '#a9dbb9');
    ctx.fillStyle = hg; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, TAU); ctx.fill();
  }
  // front hill with a lit crest
  const fg = ctx.createLinearGradient(0, 840, 0, 1080);
  fg.addColorStop(0, '#b4e7c0'); fg.addColorStop(0.25, PAL.hill); fg.addColorStop(1, PAL.hillDk);
  ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(HILL.cx, HILL.cy, HILL.rx, HILL.ry, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(HILL.cx, HILL.cy + 2, HILL.rx - 2, HILL.ry - 2, 0, Math.PI * 1.22, Math.PI * 1.78); ctx.stroke();
  // grass tufts + tiny flowers along the crest (deterministic)
  const R = rng(9);
  ctx.lineCap = 'round';
  for (let i = 0; i < 70; i++) {
    const x = 120 + R() * 1680, y = surface(x) + 6 + R() * 26, h = 7 + R() * 9, sw = Math.sin(t * 2 + x * 0.01) * 2;
    ctx.strokeStyle = R() < 0.5 ? '#6fc086' : '#88d29d'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + sw, y - h * 0.6, x - 3 + sw * 1.5, y - h); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 2 + sw, y - h * 0.5, x + 5 + sw * 1.5, y - h * 0.8); ctx.stroke();
    if (R() < 0.18) { ctx.fillStyle = R() < 0.5 ? '#ffffff' : '#ffd1dc'; ctx.beginPath(); ctx.arc(x + 4, y - h - 1, 3.2, 0, TAU); ctx.fill(); ctx.fillStyle = '#ffd66e'; ctx.beginPath(); ctx.arc(x + 4, y - h - 1, 1.3, 0, TAU); ctx.fill(); }
  }
}

// the reference video's subject: a coral ball bouncing across the hill (squash & stretch, shadow)
export function ballPos(t, exit = 0) {
  const P = 2.4, u = (t % P) / P, pp = u < 0.5 ? u * 2 : 2 - u * 2;   // ping-pong across
  const x = 560 + 800 * (pp * pp * (3 - 2 * pp)) + exit * exit * 1400;
  const b = (t * 2) % 1, hgt = 300 * (1 - (2 * b - 1) ** 2) * (1 + exit * 1.5);
  const r = 46, gy = surface(x);
  const contact = Math.max(0, 1 - Math.min(b, 1 - b) / 0.06);
  const sq = contact * 0.28, st = hgt > 40 ? 0.06 * Math.abs(2 * b - 1) : 0;  // squash on contact, stretch in flight
  return { x, y: gy - r * (1 - sq) - hgt, gy, hgt, r, sq, st };
}
export function ball(ctx, t, { exit = 0 } = {}) {
  const { x, y, gy, hgt, r, sq, st } = ballPos(t, exit);
  // shadow
  const k = 1 - Math.min(0.75, hgt / 420);
  ctx.save(); ctx.translate(x, gy + 4); ctx.scale(1, 0.22);
  const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.3 * k);
  sg.addColorStop(0, `rgba(40,90,60,${0.35 * k})`); sg.addColorStop(1, 'rgba(40,90,60,0)');
  ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, r * 1.3 * k, 0, TAU); ctx.fill(); ctx.restore();
  // ball
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + sq * 0.9 - st, 1 - sq + st * 1.6);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#ffb3a6'); g.addColorStop(0.55, PAL.coral); g.addColorStop(1, '#e0533f');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, r * 0.7, Math.PI * 1.1, Math.PI * 1.45); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.ellipse(-r * 0.32, -r * 0.42, r * 0.2, r * 0.12, -0.6, 0, TAU); ctx.fill();
  ctx.restore();
}
