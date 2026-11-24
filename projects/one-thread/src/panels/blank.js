// The last square: undyed cloth, a few rows begun, loose threads waiting.
import { curve, line, lerp, rect, wavy, rng, TAU, poly } from '../art/geom.js';
import { heroHand, HERO_TIPS, stringFigure } from './parts.js';
import { seg, ease, hash, clamp, noise } from '../core.js';
const COLS = ['#a3231c', '#1f3a66', '#d8a130', '#2c6e6a', '#efe0bd', '#5b2750', '#34552f', '#c4781f', '#7c1c14', '#2a5d8c', '#1c0f08', '#b0596a'];
export default {
  id: 'blank', mat: 0, dur: 5,
  bake(B) {
    B.layer('chalk', A => { A.with({ halo: -1, noKnock: true, alpha: 0.16 }, () => { A.strokes(rect(40, 40, 1840, 1000), { w: 4, color: '#f6e6bd' }); for (let i = 1; i < 6; i++) { A.stroke(line([40 + i * 307, 40], [40 + i * 307, 1040]), { w: 2, color: '#f6e6bd' }); } for (let i = 1; i < 4; i++) A.stroke(line([40, 40 + i * 250], [1880, 40 + i * 250]), { w: 2, color: '#f6e6bd' }); }); }, { res: 0.6 });
    // the begun weaving: rows of many colours, each row a different people's yarn
    B.layer('rows', A => { const R = rng(4); for (let j = 0; j < 22; j++) { const y = 1040 - j * 9, c = COLS[(j * 5) % COLS.length]; let x = 30; while (x < 1890) { const w = 40 + R() * 180, x1 = Math.min(1890, x + w); A.part(rect(x, y - 9, x1 - x - 1, 8.6), { fill: R() > 0.3 ? c : COLS[Math.floor(R() * 12)], halo: 0, raise: 0.7, gold: 0, order: ['lin', 30, 0, 1890, 0, j / 24, (j + 1) / 24] }); x = x1; } } });
    B.sprite('handA', { w: 640, h: 980, ox: 320, oy: 600 }, A => heroHand(A, { skin: ['#2c1409', '#4a2410'], raise: 0.8, pattern: 0 }));
    B.sprite('handB', { w: 640, h: 980, ox: 320, oy: 600 }, A => heroHand(A, { skin: ['#7a3c1c', '#99562a'], raise: 0.8, pattern: 1 }));
  },
  // q: {hands 0..1, figure 0..1, rows 0..1, thread 0..1}
  draw(g, t, q = {}) {
    const o = { hands: 1, figure: 1, rows: 0.4, thread: 1, loose: 1, ...q };
    g.layer('chalk', { rv: 1 });
    if (o.rows > 0) g.layer('rows', { rv: o.rows, noise: 0.01, soft: 0.02, edge: 0.02 });
    // loose warp ends drifting up from the begun edge
    if (o.loose > 0) for (let i = 0; i < 92; i++) { const x = 34 + i * 20.3 + (hash(i) - 0.5) * 16, hz = Math.max(Math.exp(-(((x - 400) / 250) ** 4)), Math.exp(-(((x - 1520) / 250) ** 4))), mid = Math.exp(-(((x - 960) / 560) ** 6)), cut = lerp(1, Math.min(1 - hz, lerp(1, 0.34, mid)), clamp(o.hands)), len = (130 + hash(i * 7 + 1) * 380) * cut, pts = [], top = 1040 - 198 * o.rows; for (let k = 0; k <= 26; k++) { const u = k / 26, s = u * u; pts.push([x + Math.sin(u * 5 + i * 1.7 + t * 0.9) * 22 * s + Math.sin(t * 0.6 + i) * 14 * s, top - u * len + Math.sin(u * 3 + i) * 10 * s, 4 + 26 * s * (0.5 + 0.5 * Math.sin(i * 2.1 + t * 0.7))]); } if (len > 12) g.thread(pts, { w: 5.2, color: COLS[i % 12], gold: 0.1, shadow: 0.6, always: 1, alpha: o.loose }); }
    const e = ease.inOut2(clamp(o.hands)), lx = lerp(-420, 400, e), rx = lerp(2340, 1520, e), hy = 930 + Math.sin(t * 1.1) * 5;
    if (o.hands > 0) { g.sprite('handA', { x: lx, y: hy, s: 1.08, flip: true, r: 0.16 + Math.sin(t * 0.9) * 0.01, lift: 30, shadow: 0.9 }); g.sprite('handB', { x: rx, y: hy, s: 1.08, r: -0.16 - Math.sin(t * 0.9 + 1) * 0.01, lift: 30, shadow: 0.9 }); }
    if (o.figure > 0) {
      const tip = (hx, flip, r, n) => { const [a, b] = HERO_TIPS[n]; const X = a * 1.08 * flip, Y = (b + 46) * 1.08; return [hx + X * Math.cos(r) - Y * Math.sin(r), hy + X * Math.sin(r) + Y * Math.cos(r), 34]; };
      const op = ease.outBack(clamp(o.figure)), L = n => tip(lx, -1, 0.16, n), R = n => tip(rx, 1, -0.16, n);
      const li = L('index'), ll = L('thumb'), ri = R('index'), rl = R('thumb'); const ym = (li[1] + ll[1]) / 2, hh = (ll[1] - li[1]) / 2 * op;
      const seg2 = (a, b, n = 30, sag = 0) => Array.from({ length: n + 1 }, (_, i) => [lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n) + Math.sin(i / n * Math.PI) * sag, 34 + Math.sin(i / n * Math.PI) * 4]);
      const wob = Math.sin(t * 2) * 2; g.thread(seg2(li, ri, 40, 26 * op + wob), { w: 10, hero: 1, glow: 1.1, always: 1 }); g.thread(seg2(ll, rl, 40, -26 * op + wob), { w: 10, hero: 1, glow: 1.1, always: 1 });
      const n = 8, x0 = Math.max(li[0], ll[0]), x1 = Math.min(ri[0], rl[0]); for (const k of [-1, 1]) { const p = []; for (let i = 0; i <= n; i++) { const u = i / n, end = i === 0 || i === n; p.push(end ? [i ? (k > 0 ? rl : ri)[0] : (k > 0 ? ll : li)[0], i ? (k > 0 ? rl : ri)[1] : (k > 0 ? ll : li)[1], 34] : [lerp(x0, x1, u), ym + (i % 2 ? -k : k) * hh * 0.82 + wob, 34 + (i % 2 ? 8 : -4) * k]); } const q2 = []; for (let i = 0; i < n; i++) q2.push(...seg2(p[i], p[i + 1], 12).slice(0, -1)); q2.push(p[n]); g.thread(q2, { w: 10, hero: 1, glow: 1.1, f1: clamp(o.figure * 1.1), always: 1 }); }
      // loops around the fingers
      for (const [c, n] of [[li, 0], [ll, 1], [ri, 2], [rl, 3]]) { const lp = []; for (let i = 0; i <= 16; i++) { const a = i / 16 * TAU; lp.push([c[0] + Math.cos(a) * 34, c[1] + Math.sin(a) * 12 + 2, 36 + Math.sin(a) * 10]); } g.thread(lp, { w: 8, hero: 1, always: 1 }); }
    }
  },
  shots: [{ end: 5, cam: p => ({ x: 960, y: 560, w: 2000, tilt: 0.12 }) }],
};
