// Generated textures (built once from fixed seeds, reused every frame): the explainer look's
// stipple "spray" shading and fine grain. Sprites are white-on-transparent masks tinted on demand.
import { rng, TAU } from './core.js';

const cache = new Map();
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

// density(u,v) in [0,1] -> stipple mask
function stipple(w, h, seed, density, n, rMin = 0.7, rMax = 1.5) {
  const c = mk(w, h), x = c.getContext('2d'), r = rng(seed);
  x.fillStyle = '#fff';
  for (let i = 0; i < n; i++) {
    const u = r(), v = r();
    if (r() > density(u, v)) continue;
    const rad = rMin + r() * (rMax - rMin);
    x.beginPath(); x.arc(u * w, v * h, rad, 0, TAU); x.fill();
  }
  return c;
}
function tinted(key, make, color) {
  const k = key + color;
  if (cache.has(k)) return cache.get(k);
  const m = cache.get(key) || (cache.set(key, make()), cache.get(key));
  const c = mk(m.width, m.height), x = c.getContext('2d');
  x.drawImage(m, 0, 0);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
  cache.set(k, c);
  return c;
}

// radial spray: dense center, fading out
export const sprayRadial = color => tinted('sprayR', () => stipple(512, 512, 11, (u, v) => {
  const d = Math.hypot(u - 0.5, v - 0.5) * 2; return Math.max(0, 1 - d) ** 1.6;
}, 26000, 1.1, 2.2), color);
// linear spray: dense at v=0, fading to nothing at v=1
export const sprayLinear = color => tinted('sprayL', () => stipple(512, 512, 23, (u, v) => (1 - v) ** 1.8, 30000, 1.1, 2.2), color);
// uniform fine grain (tileable enough at this density)
export const grain = color => tinted('grain', () => stipple(512, 512, 37, () => 0.5, 9000, 0.8, 1.5), color);

// Draw a linear spray inside the current clip: from (x0,y0) dense to (x1,y1) faint, width w.
export function sprayAlong(ctx, color, x0, y0, x1, y1, w, a = 1) {
  const s = sprayLinear(color), len = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x0, y0);
  ctx.rotate(Math.atan2(y1 - y0, x1 - x0) - Math.PI / 2);
  ctx.drawImage(s, -w / 2, 0, w, len);
  ctx.restore();
}
export function sprayAt(ctx, color, x, y, rx, ry = rx, a = 1) {
  ctx.save(); ctx.globalAlpha *= a;
  ctx.drawImage(sprayRadial(color), x - rx, y - ry, rx * 2, ry * 2);
  ctx.restore();
}
// Fill a path with uniform grain (clipped)
export function grainFill(ctx, path, color, a = 0.35, scale = 1) {
  const g = grain(color);
  ctx.save();
  ctx.clip(path);
  ctx.globalAlpha *= a;
  const pat = ctx.createPattern(g, 'repeat');
  pat.setTransform(new DOMMatrix().scale(scale));
  ctx.fillStyle = pat;
  ctx.fill(path);
  ctx.restore();
}
