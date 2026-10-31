// Shared constants and math. Output is square like the reference; the scene is drawn supersampled.
export const W = 1080, H = 1080, FPS = 30, SS = 2;

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = t => (t = clamp(t), t * t * (3 - 2 * t));
export const smoother = t => (t = clamp(t), t * t * t * (t * (t * 6 - 15) + 10));
export const sstep = (a, b, x) => smooth(inv(a, b, x));
export const easeOut = (t, p = 3) => 1 - Math.pow(1 - clamp(t), p);
export const easeIn = (t, p = 3) => Math.pow(clamp(t), p);
export const easeInOut = (t, p = 3) => (t = clamp(t), t < 0.5 ? Math.pow(2 * t, p) / 2 : 1 - Math.pow(2 - 2 * t, p) / 2);
// window: 0 before a, ramps up to 1 over fadeIn, holds, ramps down over fadeOut ending at b
export const win = (x, a, b, fi, fo = fi) => Math.min(sstep(a, a + fi, x), 1 - sstep(b - fo, b, x));

// CSS-style cubic-bezier easing
export function bezier(x1, y1, x2, y2) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax * t + bx) * t + cx) * t, Y = t => ((ay * t + by) * t + cy) * t;
  const dX = t => (3 * ax * t + 2 * bx) * t + cx;
  return x => {
    x = clamp(x);
    let t = x;
    for (let i = 0; i < 8; i++) { const e = X(t) - x, d = dX(t); if (Math.abs(e) < 1e-6 || Math.abs(d) < 1e-6) break; t -= e / d; }
    return Y(clamp(t));
  };
}
export const apple = bezier(0.42, 0, 0.18, 1); // confident start, long silky landing
export const glide = bezier(0.6, 0, 0.25, 1);

// damped spring from 0 to 1 (overshoots); tau in seconds since start
export function spring(tau, freq = 2.2, damp = 0.32) {
  if (tau <= 0) return 0;
  const w = 2 * Math.PI * freq, z = damp, wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
export const hash = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
