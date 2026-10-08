// Two-tone liquid splash wipe (the reference's chapter transition: light + dark of one hue, curling
// tendrils, flung droplets; in ~0.35 s, full for a beat, out ~0.4 s revealing the next scene).
// Built as an expanding organic annulus: the outer edge bursts out from (cx,cy) until it covers the
// frame, then a hole opens in the middle and races outward. Deterministic in t.
import { TAU, clamp, ease, rng, lerp } from './core.js';

function makeEdge(seed, nT = 7) {
  const r = rng(seed);
  const waves = Array.from({ length: 5 }, (_, i) => ({ f: 2 + i * 2 + Math.floor(r() * 3), a: (0.09 / (i + 1)) * (0.6 + r() * 0.8), p: r() * TAU, s: (r() - 0.5) * 3 }));
  const tend = Array.from({ length: nT }, () => ({ th: r() * TAU, w: 0.07 + r() * 0.1, a: 0.22 + r() * 0.5, curl: (r() - 0.5) * 1.4 }));
  return (th, u) => {
    let v = 0;
    for (const w of waves) v += Math.sin(th * w.f + w.p + u * w.s) * w.a;
    let sp = 0, curl = 0;
    for (const T of tend) {
      let d = Math.atan2(Math.sin(th - T.th), Math.cos(th - T.th));
      const g = Math.exp(-((d / T.w) ** 2));
      sp += g * T.a; curl += g * T.curl;
    }
    return { k: 1 + v + sp, curl };
  };
}

function ring(ctx, cx, cy, R, edge, u, swirl, n = 360) {
  // closed organic boundary of radius ~R, as a sub-path
  for (let i = 0; i <= n; i++) {
    const th = (i / n) * TAU;
    const { k, curl } = edge(th, u);
    const rr = Math.max(0, R * k);
    const a = th + (swirl + curl * 0.35) * (k - 1);
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// Draws the splash for time t. Returns {mid} — callers draw the outgoing scene before `mid`
// and the incoming scene after it (the splash fully covers the frame around `mid`).
export function splash(ctx, t, { t0, dur = 0.85, cx = 960, cy = 540, colors, seed = 1, swirl = 0.6 }) {
  const u = (t - t0) / dur;
  const mid = t0 + dur * 0.47;
  if (u <= 0 || u >= 1) return { mid, active: false };
  const D = Math.max(Math.hypot(cx, cy), Math.hypot(1920 - cx, cy), Math.hypot(cx, 1080 - cy), Math.hypot(1920 - cx, 1080 - cy));
  const inP = ease.out(clamp(u / 0.45));
  const outP = clamp((u - 0.5) / 0.5);
  const Ro = D * 1.25 * inP * (1 + outP * 0.6);
  const Ri = D * 1.55 * ease.inOut2(outP);
  const layers = [
    { col: colors[0], ro: 1.0, ri: 0.9, s: seed, lag: 0 },
    { col: colors[1], ro: 0.6, ri: 1.12, s: seed + 17, lag: 0.04 },
  ];
  for (const L of layers) {
    const ul = clamp(u - L.lag);
    const ro = Ro * L.ro * (L.lag ? clamp(ul / Math.max(0.01, u)) : 1);
    if (ro <= 1) continue;
    ctx.save();
    ctx.fillStyle = L.col;
    ctx.beginPath();
    const eO = makeEdge(L.s * 13 + 3), eI = makeEdge(L.s * 13 + 9, 6);
    ring(ctx, cx, cy, ro, eO, u, swirl);
    if (Ri > 0) ring(ctx, cx, cy, Ri * L.ri, eI, u, -swirl * 0.7);
    ctx.fill('evenodd');
    ctx.restore();
  }
  // flung droplets (ahead of the burst, then trailing the receding edge)
  const r = rng(seed * 31 + 7);
  for (let k = 0; k < 22; k++) {
    const a = r() * TAU, sp = 0.9 + r() * 0.5, sz = 6 + r() * 20, delay = r() * 0.25, col = r() < 0.6 ? colors[0] : colors[1];
    const uu = clamp((u - delay) / (1 - delay));
    if (uu <= 0 || uu >= 1) continue;
    const dist = (Ro * 0.9 + D * 0.25 * uu) * sp * (0.85 + 0.3 * Math.sin(k));
    const x = cx + Math.cos(a + 0.3 * uu * swirl) * dist, y = cy + Math.sin(a + 0.3 * uu * swirl) * dist;
    const s = sz * Math.sin(uu * Math.PI);
    if (s < 0.5) continue;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.ellipse(x, y, s * 1.3, s, a, 0, TAU); ctx.fill();
  }
  return { mid, active: true };
}
