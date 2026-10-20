// Celebration FX in the film's flat style: confetti (analytic drag + gravity + flutter), sparkle bursts.
// All functions are pure in (time since spawn) so frames render out of order.
import { P, darken } from './palette.js';
import { rng, TAU, clamp, ease } from './core.js';
import { starPath } from './type.js';

export const CONFETTI = [P.gold, P.ink, P.cream, P.mint, P.lilac, P.sky, P.pink, P.lime, P.goldLt];

// burst: x, y origin; dir/spread (radians, 0 = up); speed px/s; g gravity px/s²; k drag 1/s
export function confetti(ctx, x, y, t, o = {}) {
  const { n = 60, seed = 1, dir = 0, spread = 1.1, speed = 1400, g = 1500, k = 2.6, size = 18, life = 3.2, colors = CONFETTI, scale = 1, stars = 0.12 } = o;
  if (t < 0 || t > life) return;
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const a = dir + (r() - 0.5) * 2 * spread - Math.PI / 2;
    const sp = speed * (0.35 + r() * 0.75);
    const vx = Math.cos(a) * sp, vy = Math.sin(a) * sp;
    const kk = k * (0.7 + r() * 0.7);
    const delay = r() * 0.06;
    const tt = t - delay;
    const col = colors[Math.floor(r() * colors.length)];
    const kind = r() < stars ? 2 : r() < 0.6 ? 0 : 1;
    const sz = size * (0.6 + r() * 0.7) * scale;
    const spin = (r() - 0.5) * 14, flutter = 6 + r() * 10, ph = r() * TAU, sway = 10 + r() * 40;
    const lf = life * (0.75 + r() * 0.25);
    if (tt < 0 || tt > lf) continue;
    const e = (1 - Math.exp(-kk * tt)) / kk;
    const px = x + vx * e + Math.sin(tt * 3 + ph) * sway * clamp(tt * 2);
    const py = y + vy * e + (g / kk) * (tt - e);
    const fade = tt > lf - 0.4 ? (lf - tt) / 0.4 : 1;
    ctx.save();
    ctx.globalAlpha *= fade;
    ctx.translate(px, py);
    ctx.rotate(ph + spin * tt);
    const fl = Math.cos(ph + flutter * tt);
    ctx.scale(1, Math.abs(fl) < 0.12 ? 0.12 * Math.sign(fl || 1) : fl);
    ctx.fillStyle = fl < 0 ? darken(col, 0.18) : col;
    if (kind === 0) ctx.fillRect(-sz / 2, -sz * 0.3, sz, sz * 0.6);
    else if (kind === 1) { ctx.beginPath(); ctx.arc(0, 0, sz * 0.36, 0, TAU); ctx.fill(); }
    else ctx.fill(starPath(0, 0, sz * 0.6, sz * 0.27));
    ctx.restore();
  }
}

// a ring of little stars + lines bursting out (on the 70 tap, on lights)
export function starBurst(ctx, x, y, t, o = {}) {
  const { n = 10, r0 = 40, r1 = 220, life = 0.55, col = P.ink, size = 16, seed = 3, lines = true } = o;
  if (t < 0 || t > life) return;
  const p = ease.outExpo(t / life);
  const r = rng(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + r() * 0.3;
    const rr = r0 + (r1 - r0) * p;
    const s = size * (1 - ease.in2(t / life));
    if (lines) {
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.5, 7 * (1 - t / life)); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * rr * 0.72, y + Math.sin(a) * rr * 0.72);
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      ctx.stroke();
    } else {
      ctx.fillStyle = col;
      ctx.fill(starPath(x + Math.cos(a) * rr, y + Math.sin(a) * rr, s, s * 0.45, a));
    }
  }
  ctx.restore();
}
