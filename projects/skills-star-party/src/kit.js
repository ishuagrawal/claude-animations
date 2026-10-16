// Motion + drawing basics: spring easing, eases, type setup, icons.
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
