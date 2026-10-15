// Motion + drawing basics: spring easing, eases, type setup, Octicons, additive glow, sparkles.
import { rgba } from './palette.js';
import { ICONS } from './icons.js';
import { TAU, clamp } from './core.js';

// ---------------------------------------------------------------- motion
// Underdamped spring 0→1 (Remotion-like): f = frequency (Hz), z = damping ratio.
export function spring(t, f = 2.2, z = 0.42) {
  if (t <= 0) return 0;
  const w = TAU * f, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}
export const sp = (t, t0, f, z) => spring(t - t0, f, z);
export const smooth = x => { x = clamp(x); return x * x * (3 - 2 * x); };
export const eio = x => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
export const eout = x => 1 - Math.pow(1 - clamp(x), 3);

// ---------------------------------------------------------------- type
export const SANS = '"Mona Sans", "Helvetica Neue", Arial, sans-serif';
export const MONO = '"Monaspace Neon", ui-monospace, Menlo, monospace';
export function font(ctx, size, weight = 800, fam = SANS, track = 0) {
  ctx.font = `${weight} ${size}px ${fam}`;
  ctx.letterSpacing = track + 'px';
}
// ---------------------------------------------------------------- icons
const iconCache = {};
export function icon(ctx, name, x, y, size, color) {
  const p = iconCache[name] || (iconCache[name] = new Path2D(ICONS[name]));
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(p, 'evenodd');
  ctx.restore();
}

// ---------------------------------------------------------------- light
export function glow(ctx, x, y, r, color, a = 1, op = 'lighter') {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = op;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(color, a));
  g.addColorStop(0.3, rgba(color, a * 0.42));
  g.addColorStop(0.65, rgba(color, a * 0.1));
  g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// four-point sparkle with a soft core
export function sparkle(ctx, x, y, r, color, rot = 0, a = 1) {
  if (r <= 0 || a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  const k = 0.14;
  ctx.moveTo(0, -r); ctx.quadraticCurveTo(r * k, -r * k, r, 0);
  ctx.quadraticCurveTo(r * k, r * k, 0, r); ctx.quadraticCurveTo(-r * k, r * k, -r, 0);
  ctx.quadraticCurveTo(-r * k, -r * k, 0, -r);
  ctx.fill();
  if (r > 6) {
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.45);
    g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(-r * 0.45, -r * 0.45, r * 0.9, r * 0.9);
  }
  ctx.restore();
}
