// Deterministic physics: fixed-step simulations run once over a time range and sampled as pure functions of t.
import { clamp, lerp } from './core.js';
// record(t0, t1, step(state, t, dt) -> void, state, snap(state) -> number[]) ; returns t => number[]
export function record(t0, t1, init, step, snap, hz = 240, every = 2) {
  let data = null, n = 0, w = 0; const run = () => { const s = init(), dt = 1 / hz, N = Math.ceil((t1 - t0) * hz), out = []; for (let i = 0; i <= N; i++) { step(s, t0 + i * dt, dt); if (i % every === 0) out.push(Array.from(snap(s))); } n = out.length; w = out[0].length; data = new Float32Array(n * w); out.forEach((a, i) => data.set(a, i * w)); };
  const buf = []; return t => { if (!data) run(); const f = clamp((t - t0) * hz / every, 0, n - 1.0001), i = Math.floor(f), k = f - i; for (let j = 0; j < w; j++) buf[j] = lerp(data[i * w + j], data[(i + 1) * w + j], k); return buf.slice(0, w); };
}
// verlet chain pinned to anchor(t); wind(t) -> [ax, ay]; returns t => [[x,y]...]
export function chain(t0, t1, anchor, n, seg, o = {}) {
  const f = record(t0, t1, () => { const [x, y] = anchor(t0), dir = o.dir || [-1, 0.2]; return { p: Array.from({ length: n }, (_, i) => ({ x: x + dir[0] * seg * i, y: y + dir[1] * seg * i, px: x + dir[0] * seg * i, py: y + dir[1] * seg * i })) }; }, (s, t, dt) => {
    const [gx, gy] = o.wind ? o.wind(t) : [0, 900], a = anchor(t), drag = Math.pow(o.drag ?? 0.04, dt); s.p.forEach((q, i) => { if (!i) return; const k = i / n, fl = o.flutter ? Math.sin(t * o.flutter[1] - i * (o.flutter[2] || 0.9)) * o.flutter[0] * k : 0; const vx = (q.x - q.px) * drag, vy = (q.y - q.py) * drag; q.px = q.x; q.py = q.y; q.x += vx + gx * dt * dt; q.y += vy + (gy + fl) * dt * dt; }); s.p[0].x = a[0]; s.p[0].y = a[1];
    for (let it = 0; it < (o.iter || 14); it++) { for (let i = 1; i < n; i++) { const A = s.p[i - 1], B = s.p[i], dx = B.x - A.x, dy = B.y - A.y, d = Math.hypot(dx, dy) || 1e-6, k = (d - seg) / d; if (i === 1) { B.x -= dx * k; B.y -= dy * k; } else { A.x += dx * k * 0.5; A.y += dy * k * 0.5; B.x -= dx * k * 0.5; B.y -= dy * k * 0.5; } } if (o.stiff && a.length > 2) { const B = s.p[1]; B.x = lerp(B.x, a[0] + Math.cos(a[2]) * seg, o.stiff); B.y = lerp(B.y, a[1] + Math.sin(a[2]) * seg, o.stiff); } s.p[0].x = a[0]; s.p[0].y = a[1]; } }, s => s.p.flatMap(q => [q.x, q.y]), 240, 2);
  return t => { const a = f(t), r = []; for (let i = 0; i < n; i++) r.push([a[i * 2], a[i * 2 + 1]]); return r; };
}
// damped spring following target(t) (number or array). w = stiffness (rad/s), z = damping ratio, kicks: [[t, impulse(array|num)]]
export function spring(t0, t1, target, w = 14, z = 0.35, kicks = []) {
  const one = !Array.isArray(target(t0)), T = t => (one ? [target(t)] : target(t)); const f = record(t0, t1, () => { const x = T(t0); return { x: x.slice(), v: x.map(() => 0), k: kicks.map(() => false) }; }, (s, t, dt) => { const g = T(t); kicks.forEach(([kt, imp], i) => { if (!s.k[i] && t >= kt) { s.k[i] = true; (one ? [imp] : imp).forEach((q, j) => (s.v[j] += q)); } }); s.x.forEach((x, j) => { const a = w * w * (g[j] - x) - 2 * z * w * s.v[j]; s.v[j] += a * dt; s.x[j] += s.v[j] * dt; }); }, s => s.x, 240, 2);
  return t => (one ? f(t)[0] : f(t));
}
// analytic decaying oscillation after t0 (for impacts)
export const ring = (t, t0, f = 5, d = 5) => (t < t0 ? 0 : Math.exp(-(t - t0) * d) * Math.sin((t - t0) * f * Math.PI * 2));
// height field ripple on a string: impulses [[t, x, strength]] evaluated analytically (travelling, dispersing packets)
export const ripple = (t, x, hits, o = {}) => hits.reduce((a, [t0, x0, k]) => { const q = t - t0; if (q <= 0 || q > 3) return a; const d = Math.abs(x - x0), c = o.c || 1500, L = o.L || 190, fr = d - c * q, env = Math.exp(-(fr * fr) / (2 * (L * (1 + q * 1.4)) ** 2)) * Math.exp(-q * (o.d || 1.7)); const dip = Math.exp(-(d * d) / (2 * 150 ** 2)) * Math.exp(-q * 5) * Math.cos(q * 16); return a + k * (env * Math.cos(fr * 0.012) * 0.6 + dip); }, 0);
// ballistic arc through (t0,p0)->(t1,p1) with apex height h above the higher end
export function arc(t, t0, p0, t1, p1, g) { const T = t1 - t0, q = t - t0, vx = (p1[0] - p0[0]) / T, vy = (p1[1] - p0[1]) / T - 0.5 * g * T; return [p0[0] + vx * q, p0[1] + vy * q + 0.5 * g * q * q, vx, vy + g * q]; }
