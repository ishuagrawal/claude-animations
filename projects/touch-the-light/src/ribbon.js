// The light ribbon: dozens of fine parallel fibers following a path, bright silver at the anchored
// edge and dimming to steel blue across the band, with a few wandering chromatic threads and a soft
// living shimmer. Drawn in chunks so color can vary along each fiber.
import { SS, hash, clamp } from './core.js';

const HI = [236, 242, 252], MID = [168, 184, 210], LO = [52, 62, 84];
export const AMBER = [255, 150, 62];

export const ACCENTS = [
  { col: [255, 66, 52], u0: 0.5, amp: 0.16, f: 0.0045, ph: 1.3, f2: 0.0032, ph2: 0.4, g: 0.9 },
  { col: [255, 170, 64], u0: 0.36, amp: 0.18, f: 0.0038, ph: 4.1, f2: 0.0027, ph2: 2.5, g: 0.8 },
  { col: [96, 170, 255], u0: 0.14, amp: 0.1, f: 0.0052, ph: 2.2, f2: 0.0041, ph2: 4.6, g: 0.75 },
];

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// poly: Poly in the ribbon's local plane; o.map(x, y) -> canvas [x, y].
// o.levels (optional): progressively smoothed copies of poly (same vertex count), levels[i] smoothed by
// i * o.levelStep; deeper fibers follow smoother curves so they never fold at sharp corners.
export function ribbon(ctx, poly, o) {
  const {
    map, N = 36, width = () => 40, side = 1, centered = false,
    a = 0, b = poly.L, comb = 0, combA = 0, lw = 1.1, gain = 1, time = 0, seed = 0,
    shimmer = null, fade = null, rim = 0, rimCol = AMBER, accents = ACCENTS, accentGain = 1, tip = 0, chunk = 7,
    levels = null, levelStep = 1, wRef = 0,
  } = o;
  if (b - a < 0.5 || gain <= 0.002) return;
  const n = poly.n;
  const wv = new Float64Array(n);
  const i0 = Math.max(0, poly.seg(a)), i1 = Math.min(n - 1, poly.seg(b) + 1);
  for (let i = i0; i <= i1; i++) wv[i] = width(poly.s[i]);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const off = u => centered ? (u - 0.5) : u * side;
  const level = u => {
    if (!levels) return poly;
    const d = Math.abs(off(u)) * wRef;
    return levels[Math.min(levels.length - 1, Math.round(d / levelStep))];
  };

  // one fiber from ai to bi at band position uAt(s); shade(sMid, u) -> css color or null
  const fiber = (uAt, ai, bi, shade, maxPts) => {
    let pts = [], ss = [], us = [];
    const at = (s, k, tt) => { // point at vertex k (+ fraction tt toward k+1) on the fiber's level
      const u = uAt(s), P = level(u), k1 = Math.min(n - 1, k + 1);
      const x = P.x[k] + (P.x[k1] - P.x[k]) * tt, y = P.y[k] + (P.y[k1] - P.y[k]) * tt;
      let nx = P.nx[k] + (P.nx[k1] - P.nx[k]) * tt, ny = P.ny[k] + (P.ny[k1] - P.ny[k]) * tt;
      const l = Math.hypot(nx, ny) || 1;
      const w = tt === 0 && wv[k] ? wv[k] : width(s);
      const d = off(u) * w;
      pts.push(map(x + nx / l * d, y + ny / l * d)); ss.push(s); us.push(u);
    };
    const frac = s => { const k = poly.seg(s), k1 = Math.min(n - 1, k + 1); return [k, (s - poly.s[k]) / ((poly.s[k1] - poly.s[k]) || 1)]; };
    const flush = final => {
      if (pts.length >= 2) {
        const mid = pts.length >> 1;
        const c = shade((ss[0] + ss[ss.length - 1]) / 2, us[mid]);
        if (c) {
          ctx.strokeStyle = c;
          ctx.beginPath();
          ctx.moveTo(pts[0][0], pts[0][1]);
          for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.stroke();
        }
      }
      if (!final) { pts = [pts[pts.length - 1]]; ss = [ss[ss.length - 1]]; us = [us[us.length - 1]]; }
    };
    const [ka, ta] = frac(ai); at(ai, ka, ta);
    for (let k = ka + 1; k < n && poly.s[k] < bi; k++) { at(poly.s[k], k, 0); if (pts.length > maxPts) flush(false); }
    const [kb, tb] = frac(bi); at(bi, kb, tb);
    flush(true);
  };

  // dark inner fibers first, so the bright edge always sits on top
  ctx.lineWidth = lw * SS;
  for (let t = N - 1; t >= 0; t--) {
    const u = clamp((t + 0.5 + (hash(t * 1.7 + seed) - 0.5) * 0.7) / N);
    const h1 = hash(t * 3.3 + seed), h2 = hash(t * 9.1 + seed);
    let I = (1 - 0.78 * Math.pow(u, 0.8)) * (0.7 + 0.3 * h1);
    if (h2 > 0.88) I *= 1.28;
    const f = fade ? fade(u) : 1;
    if (f <= 0.003) continue;
    const ai = a + combA * (0.15 + 0.85 * hash(t * 5.1 + seed));
    const bi = b - comb * (0.1 + 0.55 * u + 0.35 * hash(t * 7.7 + seed));
    if (bi - ai < 0.5) continue;
    let col = u < 0.45 ? mix(HI, MID, u / 0.45) : mix(MID, LO, (u - 0.45) / 0.55);
    col = mix(col, [col[0] * 0.9, col[1] * 0.97, col[2] * 1.06], h2);
    const rw = Math.pow(1 - u, 6);
    fiber(() => u, ai, bi, s => {
      const rk = (typeof rim === 'function' ? rim(s) : rim) * rw;
      let v = I * f * gain * (0.86 + 0.14 * Math.sin(s * 0.021 + h1 * 40 - time * 0.9));
      if (shimmer) v *= shimmer(s, u);
      if (tip) v *= 1 + tip * Math.exp(-Math.max(0, b - s) / 40);
      if (v < 0.004) return null;
      const c = rk > 0 ? mix(col, rimCol, Math.min(1, rk)) : col;
      return `rgb(${Math.min(255, c[0] * v) | 0},${Math.min(255, c[1] * v) | 0},${Math.min(255, c[2] * v) | 0})`;
    }, chunk);
  }

  // chromatic threads wander across the band, glowing additively
  if (accents && accentGain > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = lw * 1.15 * SS;
    for (const A of accents) {
      const ai = a + combA * 0.5, bi = b - comb * 0.5;
      if (bi - ai < 1) continue;
      const env = s => Math.pow(Math.max(0, Math.sin(s * A.f2 + A.ph2 + seed)), 3);
      const uAt = s => clamp(A.u0 + A.amp * Math.sin(s * A.f + A.ph + time * 0.25), 0.02, 0.98);
      fiber(uAt, ai, bi, (s, u) => {
        let v = env(s) * A.g * accentGain * gain * (fade ? fade(u) : 1);
        if (shimmer) v *= shimmer(s, u);
        return v > 0.01 ? `rgba(${A.col[0]},${A.col[1]},${A.col[2]},${Math.min(1, v)})` : null;
      }, 10);
    }
    ctx.restore();
  }
}

// soft radial light (fingertip contact, seam flashes); x, y in canvas px, r in output px
export function glow(ctx, x, y, r, a, col = [235, 242, 255]) {
  if (a <= 0.003 || r <= 0) return;
  const R = r * SS;
  const g = ctx.createRadialGradient(x, y, 0, x, y, R);
  g.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, a)})`);
  g.addColorStop(0.18, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, a) * 0.45})`);
  g.addColorStop(0.5, `rgba(${col[0]},${col[1]},${col[2]},${Math.min(1, a) * 0.1})`);
  g.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
