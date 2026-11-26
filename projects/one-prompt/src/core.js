// Constants, easing, deterministic randomness. Everything in the film is a pure function of time.
export const W = 1920, H = 1080, FPS = 30, TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const ease = {
  lin: t => t, in2: t => t * t, out2: t => 1 - (1 - t) * (1 - t), io2: t => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  in3: t => t ** 3, out3: t => 1 - (1 - t) ** 3, io3: t => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  in4: t => t ** 4, out4: t => 1 - (1 - t) ** 4, outExpo: t => (t >= 1 ? 1 : 1 - 2 ** (-10 * t)), inExpo: t => (t <= 0 ? 0 : 2 ** (10 * t - 10)),
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2, back: (t, s = 1.7) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2),
  elastic: t => (t <= 0 ? 0 : t >= 1 ? 1 : 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
};
export const seg = (t, a, b, f = ease.io3) => f(inv(a, b, t));
// keyframes [[t, value|array, easeInto]]
export function key(t, K) {
  if (t <= K[0][0]) return K[0][1];
  for (let i = 1; i < K.length; i++) if (t <= K[i][0]) { const p = (K[i][2] || ease.io3)(inv(K[i - 1][0], K[i][0], t)), a = K[i - 1][1], b = K[i][1]; return Array.isArray(a) ? a.map((x, j) => lerp(x, b[j], p)) : lerp(a, b, p); }
  return K[K.length - 1][1];
}
export function hash(n) { n = (n | 0) ^ 0x9e3779b9; n = Math.imul(n ^ (n >>> 16), 0x85ebca6b); n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35); n ^= n >>> 16; return (n >>> 0) / 4294967296; }
export function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function noise(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), h = k => hash(Math.imul(k, 73856093) ^ Math.imul(seed, 19349663)) * 2 - 1; return lerp(h(i), h(i + 1), u); }
// C1-continuous spline through [[t, [..]|number], ...] (non-uniform Catmull-Rom): use for one-take camera moves
export function spline(t, K) {
  const n = K.length; if (t <= K[0][0]) return K[0][1]; if (t >= K[n - 1][0]) return K[n - 1][1];
  let i = 0; while (K[i + 1][0] < t) i++;
  const [t1, a] = K[i], [t2, b] = K[i + 1], h = t2 - t1, u = (t - t1) / h, p = K[i - 1], q = K[i + 2], f = (A, B, Pv, Qv) => { const m1 = p ? (B - Pv) / (t2 - p[0]) * h : 0, m2 = q ? (Qv - A) / (q[0] - t1) * h : 0, u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * A + (u3 - 2 * u2 + u) * m1 + (-2 * u3 + 3 * u2) * B + (u3 - u2) * m2; };
  return Array.isArray(a) ? a.map((x, j) => f(x, b[j], p ? p[1][j] : 0, q ? q[1][j] : 0)) : f(a, b, p ? p[1] : 0, q ? q[1] : 0);
}
