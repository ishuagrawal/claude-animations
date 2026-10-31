// "Touch the Light": one soft brush stroke of fiber light, moved only by fingertip gestures. It parts
// round a hidden island, scrolls and rubber-bands, is pinched into a single pixel, opens like a lid,
// and the "screen" pours out a sheet of light that flows round the logo, leaving it true black.
import { W, H, SS, clamp, lerp, inv, sstep, easeIn, easeInOut, bezier, apple, hash } from './core.js';
import { Poly, resample } from './geom.js';
import { ribbon, glow } from './ribbon.js';
import { pillSDF, polySDF, push } from './sdf.js';
import * as S from './shapes.js';
import { T } from './timeline.js';

let G = null;
function load() {
  const logo = S.logoShapes();
  G = {
    stroke: S.strokePoly(), logo,
    logoSDF: polySDF([logo.body, logo.leaf], 160, 1),
    body: logo.bodyLevels[0], leaf: logo.leafLevels[0],
  };
}

// whole-film slow push-in
const camMap = t => { const z = 1 + 0.035 * (t / T.end); return (x, y) => [(W / 2 + x * z) * SS, (H / 2 + y * z) * SS]; };

// ---------- the content transform: scroll (with rubber-band) and pinch ----------
function scrollY(t) {
  const [, d1, up] = T.flick;
  if (t < d1) return 0;
  if (t < up) return -150 * easeIn(inv(d1, up, t), 2);
  const tau = t - up, x0 = -150, v0 = -1000, w = 6;
  return (x0 + (v0 + w * x0) * tau) * Math.exp(-w * tau);
}
function pinchState(t) {
  const q = inv(T.pinch[1], T.pinch[2], t);
  return { s: 1 - easeIn(q, 2.3), r: 0.85 * easeIn(q, 1.6) };
}
function content(t) {
  const sc = scrollY(t), st = 1 + 0.05 * clamp(-sc / 190); // a touch of elastic stretch past the edge
  const ty = sc + 7 * Math.sin(t * 1.1) * sstep(T.stroke[1] - 0.6, T.stroke[1] + 0.6, t); // the light floats
  const { s, r } = pinchState(t), c = Math.cos(r), sn = Math.sin(r);
  return (x, y) => {
    y = 540 + (y - 540) * st + ty;
    return [(x * c - y * sn) * s, (x * sn + y * c) * s];
  };
}

// the island: never drawn, only felt. It breathes wider once.
function islandSDF(t) {
  const [a, b] = T.island;
  const open = sstep(a, a + 0.42, t) - sstep(b - 0.48, b, t);
  const pop = t < a + 0.42 ? Math.sin(Math.PI * clamp((t - a) / 0.42)) * 0.08 : 0; // slight overshoot
  const k = clamp(open + pop, 0, 1.1);
  return pillSDF(S.ISLAND.x, S.ISLAND.y, lerp(S.ISLAND.w, 232, k), lerp(S.ISLAND.h, 50, k));
}

// ---------- fingertip ----------
function ring(ctx, map, x, y, r, a, lw = 1) {
  if (a <= 0.004 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = `rgba(214,226,246,${Math.min(1, a)})`;
  ctx.lineWidth = lw * SS;
  ctx.beginPath();
  for (let k = 0; k <= 72; k++) { const an = k / 72 * Math.PI * 2; const [px, py] = map(x + r * Math.cos(an), y + r * Math.sin(an)); k ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
  ctx.stroke();
  ctx.restore();
}
function contact(ctx, map, x, y, t, down, up, k = 1) {
  if (t < down - 0.05 || t > up + 0.6) return;
  const press = sstep(down - 0.04, down + 0.08, t) * (1 - sstep(up, up + 0.25, t));
  const [px, py] = map(x, y);
  glow(ctx, px, py, 34, 0.32 * press * k);
  glow(ctx, px, py, 8, 0.7 * press * k, [255, 255, 255]);
  for (let i = 0; i < 2; i++) {
    const tau = t - down - i * 0.12;
    if (tau > 0 && tau < 0.9) ring(ctx, map, x, y, 10 + 70 * Math.pow(tau / 0.9, 0.6), 0.32 * k * (1 - tau / 0.9) * (1 - i * 0.4));
  }
}

// ---------- 1. the stroke ----------
const strokeEase = bezier(0.36, 0.06, 0.2, 1);
function drawStroke(ctx, t, map) {
  const P = G.stroke, L = P.L;
  const q = inv(T.stroke[0], T.stroke[1], t);
  if (q <= 0) return;
  const head = L * strokeEase(q);
  const { s } = pinchState(t);
  if (s < 0.02) return;
  const C = content(t), isl = islandSDF(t);
  const drawing = q < 1;
  // a light travels the length of the stroke once it lands, like the reference's hold
  const hold = t - T.stroke[1];
  const shimmer = s0 => hold > 0 && hold < 1.6 ? 1 + 0.6 * Math.exp(-Math.pow((s0 - hold * L / 1.3) / 120, 2)) : 1;
  ribbon(ctx, P, {
    map, a: 0, b: head, N: 46, centered: true, lw: 1.15, time: t, seed: 3,
    width: s0 => { const r = s0 / L; return 116 * sstep(0, 0.12, r) * (0.55 + 0.45 * Math.sin(Math.PI * clamp((r - 0.05) / 0.75))) * (1 - 0.8 * sstep(0.72, 1, r)) + 2; },
    comb: drawing ? 46 * (1 - sstep(0.75, 1, q)) : 0, tip: drawing ? 0.7 : 0,
    gain: sstep(0.0, 0.12, s) * (1 + 0.6 * sstep(0.5, 0.05, s)),
    shimmer,
    deform: (x, y) => {
      const [cx, cy] = C(x, y);
      const [px, py, a] = push(isl, cx, cy, 6, 8);
      return [px, py, 1 + 0.55 * Math.min(1, a / 26)];
    },
    breakDist: 14,
  });
  // fingertip riding the head
  if (drawing) {
    const h = P.at(head), [x, y] = C(h.x, h.y), [px, py] = map(x, y);
    const press = sstep(T.touch, T.touch + 0.12, t) * (1 - sstep(0.86, 1, q));
    glow(ctx, px, py, 40, 0.22 * press);
    glow(ctx, px, py, 9, 0.5 * press, [255, 255, 255]);
  }
}

// ---------- 2. one pixel ----------
function drawPixel(ctx, t, map) {
  const [p0, p1] = T.pixel;
  // the collapse: light concentrates into a point
  const { s } = pinchState(t);
  const conc = sstep(0.35, 0.0, s) * (1 - sstep(p0 + 0.2, p0 + 0.5, t));
  const [cx, cy] = map(0, 0);
  if (conc > 0.01) { glow(ctx, cx, cy, 70, 0.35 * conc); glow(ctx, cx, cy, 10, 0.95 * conc, [255, 255, 255]); }
  if (t < p0 || t > p1 + 0.05) return;
  const open = apple(inv(p0, p0 + 0.6, t));
  const merge = easeInOut(inv(p1 - 0.55, p1 - 0.15, t), 2);
  const shrink = easeIn(inv(p1 - 0.2, p1, t), 2);
  const z = open * (1 - 0.93 * shrink);
  const sp = 46 * z * (1 - merge), hh = 176 * z, bw = 27 * z;
  const cols = [[255, 46, 38], [52, 255, 104], [60, 116, 255]];
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  cols.forEach((col, i) => {
    const x0 = (i - 1) * sp;
    // each emitter is a little bundle of vertical fibers
    const nf = 7;
    for (let f = 0; f < nf; f++) {
      const fx = x0 + ((f + 0.5) / nf - 0.5) * bw;
      const v = (0.55 + 0.45 * hash(f * 3.1 + i * 7)) * (1 - 0.35 * Math.abs((f + 0.5) / nf - 0.5) * 2);
      const c = col.map(ch => Math.min(255, ch * v * (0.85 + 0.15 * Math.sin(t * 9 + f))) | 0);
      ctx.strokeStyle = `rgb(${c[0]},${c[1]},${c[2]})`;
      ctx.lineWidth = Math.max(1, bw / nf * 1.05) * SS;
      const [ax, ay] = map(fx, -hh / 2), [bx, by] = map(fx, hh / 2);
      ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
    }
    const [gx, gy] = map(x0, 0);
    glow(ctx, gx, gy, 46 * z + 6, 0.16 * open, col);
  });
  ctx.restore();
  // the white point it folds back into
  const wp = sstep(p1 - 0.25, p1, t) * (1 - sstep(T.line[0] + 0.1, T.line[0] + 0.4, t));
  if (wp > 0) glow(ctx, cx, cy, 9, 0.9 * wp, [255, 255, 255]);
}

// ---------- 3. the line that opens like a lid ----------
const LID = { half: 230, len: 440, open: 1.85 };
function lidGeom(t) {
  const e = apple(inv(T.lid[0] - 0.2, T.lid[1], t));
  const ox = 40 * e, oy = 150 * e, th = LID.open * apple(inv(T.lid[0], T.lid[1], t));
  const H = [-LID.half + ox, oy], dir = [Math.cos(th), -Math.sin(th)];
  return { H, dir, th, end: [LID.half + ox, oy], tip: [H[0] + dir[0] * LID.len, H[1] + dir[1] * LID.len] };
}
const linePoly = (a, b, n = 160) => new Poly(resample([a, b], n));
function drawLaptop(ctx, t, map) {
  if (t < T.line[0] || t > T.emit[1] + 0.2) return;
  const fadeOut = 1 - sstep(T.emit[0] + 0.8, T.emit[1], t);
  if (fadeOut <= 0.01) return;
  const lq = apple(inv(T.line[0], T.line[1], t));
  const g = lidGeom(t);
  const cxm = (g.H[0] + g.end[0]) / 2, hl = LID.half * lq;
  // base: the point draws out into a line
  const B = linePoly([cxm - hl, g.H[1]], [cxm + hl, g.H[1]]);
  const wB = s0 => 17 * Math.min(1, sstep(0, 40, s0) * (1 - sstep(B.L - 40, B.L, s0))) + 1;
  ribbon(ctx, B, { map, a: 0, b: B.L, N: 18, centered: true, lw: 1.05, width: wB, time: t, seed: 11, gain: 0.95 * fadeOut, accentGain: 0.6 });
  // lid: lies on the base, then lifts about the left end
  if (t > T.lid[0] - 0.05) {
    const Lp = linePoly(g.H, g.tip);
    const wL = s0 => (15 - 5 * s0 / LID.len) * Math.min(1, sstep(0, 30, s0) * (1 - sstep(Lp.L - 30, Lp.L, s0))) + 1;
    ribbon(ctx, Lp, { map, a: 0, b: Lp.L, N: 18, centered: true, lw: 1.05, width: wL, time: t, seed: 17, gain: 1.05 * fadeOut, accentGain: 0.8 });
  }
}

// ---------- 4. the sheet of light and the carved logo ----------
const NS = 128;
const SHEET_COL = [[226, 234, 248], [176, 192, 220], [120, 136, 168]];
const SHEET_ACC = { 17: [255, 70, 56], 46: [255, 168, 70], 83: [100, 168, 255], 109: [255, 120, 60] };
function drawSheet(ctx, t, map) {
  if (t < T.emit[0] || t > T.drain[1] + 0.4) return;
  const g = lidGeom(T.lid[1]);
  const drainR = lerp(900, 0, apple(inv(T.drain[0], T.drain[1], t)));
  const out = 1 - sstep(T.drain[1] - 0.2, T.drain[1] + 0.35, t);
  const sdf = G.logoSDF;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'butt'; ctx.lineJoin = 'round'; // butt caps: chunk joins must not double up under 'lighter'
  ctx.lineWidth = 1.05 * SS;
  for (let i = 0; i < NS; i++) {
    const v = 0.03 + 0.94 * (i + 0.5 + (hash(i * 1.3) - 0.5) * 0.6) / NS;
    const sx = g.H[0] + g.dir[0] * LID.len * v, sy = g.H[1] + g.dir[1] * LID.len * v;
    const t0 = T.emit[0] + v * 0.55 + hash(i * 4.7) * 0.18;
    if (t < t0) continue;
    const head = sx + 1150 * (t - t0) * (1 - 0.25 * hash(i * 2.9));
    const xe = Math.min(head, 640);
    const h1 = hash(i * 7.7), acc = SHEET_ACC[i];
    const base = acc || SHEET_COL[h1 < 0.45 ? 0 : h1 < 0.8 ? 1 : 2];
    const I = (acc ? 0.62 : 0.3 + 0.3 * hash(i * 5.3)) * out * (0.35 + 0.65 * sstep(0, 0.2, v) * sstep(1, 0.8, v));
    let prev = null, pts = [];
    const flush = () => {
      if (pts.length >= 2) {
        const mid = pts[pts.length >> 1], mx = mid[4];
        const d = sdf(mid[2], mid[3])[0];
        let b = I * (0.78 + 0.22 * Math.sin(mx * 0.011 - t * 6.5 + h1 * 30)); // light flowing rightward
        b *= sstep(sx, sx + 260, mx);                                         // fades in off the lid
        b *= 1 - sstep(head - 160, head, mx) * 0.6;                           // soft leading edge
        b *= clamp(1 - (d - 8 - drainR) / 46);                                // drains back to the edge
        if (b > 0.006) {
          ctx.strokeStyle = `rgb(${base[0] * b | 0},${base[1] * b | 0},${base[2] * b | 0})`;
          ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
          for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j][0], pts[j][1]);
          ctx.stroke();
        }
      }
    };
    for (let x = sx; x <= xe + 0.1; x += 4) {
      const dx = x - sx;
      // a slow silk wave travels with the light; the sheet fans out a little as it goes
      const wave = Math.sin(dx * 0.0095 - t * 2.6 + v * 1.4) * 9 * sstep(0, 260, dx) + Math.sin(dx * 0.021 - t * 4.1 + h1 * 6) * 2.5;
      const fy = sy + wave + (v - 0.5) * dx * 0.07;
      const [px, py] = push(sdf, x, fy, 7, 7);
      if (prev && Math.hypot(px - prev[0], py - prev[1]) > 16) { flush(); pts = []; }
      const [cx, cy] = map(px, py);
      pts.push([cx, cy, px, py, x]);
      prev = [px, py];
      if (pts.length > 7) { flush(); pts = [pts[pts.length - 1]]; }
    }
    flush();
  }
  ctx.restore();
}

// the logo's edge, left behind by the drained light, cooling to amber and going out
function drawEdge(ctx, t, map) {
  const a = sstep(T.drain[1] - 0.45, T.drain[1] + 0.1, t);
  if (a <= 0.003 || t > T.fade[1] + 0.1) return;
  const p = inv(T.fade[0], T.fade[1], t);
  const fade = u => 1 - clamp((p * 1.4 - (1 - u) * 0.75) / 0.55);
  const rim = sstep(0.15, 0.7, p);
  for (const [P, levels, w, step] of [[G.body, G.logo.bodyLevels, 13, 3], [G.leaf, G.logo.leafLevels, 9, 1.5]]) {
    ribbon(ctx, P, {
      map, a: 0, b: P.L, N: 16, side: -P.inward, lw: 1.0, width: () => w, levels, levelStep: step, wRef: w,
      gain: a * 1.05, time: t, seed: 23, fade, rim, accentGain: 0.6,
    });
  }
}

function draw(ctx, t) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W * SS, H * SS);
  const map = camMap(t);
  drawStroke(ctx, t, map);
  const C = content(t);
  {
    const [x, y] = C(-476, 232);
    if (t < T.stroke[0] + 0.4) contact(ctx, map, x, y, t, T.touch, T.stroke[0] + 0.15, 1.1);
  }
  {
    const [d0, d1, up] = T.flick;
    const fy = 330 + (t < up ? scrollY(Math.max(t, d1)) : -150);
    contact(ctx, map, 214, fy, t, d0, up);
  }
  {
    const a = C(-300, -236), b = C(312, 236);
    contact(ctx, map, a[0], a[1], t, T.pinch[0], T.pinch[2] - 0.05);
    contact(ctx, map, b[0], b[1], t, T.pinch[0] + 0.05, T.pinch[2] - 0.05);
  }
  drawPixel(ctx, t, map);
  drawLaptop(ctx, t, map);
  drawSheet(ctx, t, map);
  drawEdge(ctx, t, map);
  return {};
}

export const film = { duration: T.end, load, draw };
