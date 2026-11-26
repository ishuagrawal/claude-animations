// Loop act kit: camera, actor (bot + springs + scarf), textured meshes, particles, lightning.
import { K, CODE, ink, inner, rr, circ, ell, poly, blob, union, rgba, mix, lg, rg, glow, text, sparkle, cached, TAU, clamp, lerp, hash, rng, ease, key, noise } from '../ink.js';
import { gl } from '../gl.js';
import { bot, board } from '../bot.js';
import { spring, chain, ring } from '../sim.js';
export const SC = 0.56, SILKC = ['#ff6f6a', '#b3165e', '#ffd2b0'], GREEN = '#8fffd6';
// ---- camera: {cx, cy, z, r, sx, sy}
export const apply = (x, w) => { x.translate(960 + (w.sx || 0), 540 + (w.sy || 0)); x.rotate(w.r || 0); x.scale(w.z, w.z); x.translate(-w.cx, -w.cy); };
export const toS = (w, px, py) => { const qx = (px - w.cx) * w.z, qy = (py - w.cy) * w.z, c = Math.cos(w.r || 0), s = Math.sin(w.r || 0); return [qx * c - qy * s + 960 + (w.sx || 0), qx * s + qy * c + 540 + (w.sy || 0)]; };
// parallax plane: depth factor k (0 = infinitely far, 1 = focal)
export const par = (x, w, k, fn) => { const z = 1 + (w.z - 1) * (0.25 + 0.75 * k); x.save(); x.translate(960 + (w.sx || 0) * k, 540 + (w.sy || 0) * k); x.rotate((w.r || 0)); x.scale(z, z); x.translate(-960, -540); x.translate(0, -(w.cy - 540) * k); fn((w.cx - 960) * k); x.restore(); };
export const shakeOf = (t, hits) => hits.reduce((a, [h, k, d]) => a + (t > h ? Math.exp(-(t - h) * (d || 7)) * k : 0), 0);
export const bump = (t, a, b, f = 0.16, g = f) => ease.io2(clamp((t - a) / f)) * (1 - ease.io2(clamp((t - b) / g)));
export const since = (t, t0, d) => clamp((t - t0) / d);
export const hit = (t, t0, d = 6) => (t < t0 ? 0 : Math.exp(-(t - t0) * d));
// fold yaw so bot() only ever sees [-1.45, 1.45]
export const fold = y => { let q = ((y + Math.PI) % TAU + TAU) % TAU - Math.PI; if (Math.abs(q) > 1.45) q = Math.sign(q) * Math.max(0.2, Math.PI - Math.abs(q)); return clamp(q, -1.45, 1.45); };
export const nr = r => ((r + Math.PI) % TAU + TAU) % TAU - Math.PI;
// ---- actor: o = {t0, t1, pos(t)->[x, y] (feet), rot(t), yaw(t), cr(t), hands(t)->[lx,ly,rx,ry], sc(t), pv(t) pivot height px above feet, run(t) 0..1, phase(t), ck, rk, hk, wind(t)->[ax, ay], pose(t)->bot overrides, key, fill}
export function actor(o) {
  const { t0, t1 } = o, S = (f, w, z, k = []) => spring(t0, t1, f, w, z, k), sc = o.sc || (() => SC), pv = o.pv || (() => 0), e = 0.025;
  const rot = S(o.rot || (() => 0), o.rw || 22, 0.6, o.rk), cr = S(o.cr || (() => 0.88), 26, 0.4, o.ck), yaw = S(o.yaw || (() => 0.9), o.yw || 17, 0.85), hs = S(o.hands || (() => [-150, -60, 150, -60]), 24, 0.42, o.hk);
  const vel = t => { const a = o.pos(t - e), b = o.pos(t + e); return [(b[0] - a[0]) / (2 * e), (b[1] - a[1]) / (2 * e)]; };
  const V = o.vel || vel, run = o.run || (() => 0), ph = o.phase || (t => t * 22);
  const pelvis = t => { const p = o.pos(t), s = sc(t), r = rot(t), H = pv(t), bobr = run(t) * Math.abs(Math.sin(ph(t))) * 14 * s, q = H - cr(t) * 158 * s - bobr; return [p[0] - Math.sin(r) * q, p[1] - H + Math.cos(r) * q]; };
  const loc = (t, lx, ly) => { const p = pelvis(t), r = rot(t), s = sc(t), c = Math.cos(r), n = Math.sin(r); return [p[0] + (lx * c - ly * n) * s, p[1] + (lx * n + ly * c) * s]; };
  const toLocal = (t, wx, wy) => { const p = pelvis(t), r = -rot(t), s = sc(t), dx = wx - p[0], dy = wy - p[1], c = Math.cos(r), n = Math.sin(r); return [(dx * c - dy * n) / s, (dx * n + dy * c) / s]; };
  const armRun = t => { const k = run(t), f = Math.sign(Math.sin(yaw(t))) || 1, h = hs(t).slice(); if (k <= 0) return h; const c = Math.cos(ph(t)); [0, 1].forEach(i => { const q = i ? c : -c; h[i * 2] = lerp(h[i * 2], f * (q * 128 + 24), k); h[i * 2 + 1] = lerp(h[i * 2 + 1], -96 - Math.max(0, q) * 84 + Math.max(0, -q) * 10, k); }); return h; };
  const hand = (t, i) => { const h = o.handL ? o.handL(t, armRun(t)) : armRun(t); return loc(t, h[i * 2], h[i * 2 + 1]); };
  const ant = S(t => { const v = V(t); return [clamp(-v[0] * 0.00016 - nr(rot(t)) * 0.2, -0.75, 0.75), clamp(-v[0] * 0.0002 + v[1] * 0.0004, -1.3, 1.3)]; }, 20, 0.16, o.ak);
  const neck = t => loc(t, -Math.sin(yaw(t)) * 46, -214);
  const rel = t => [o.pos(t)[0], 0];
  const tails = [0, 1].map(i => chain(t0, t1, t => { const n = neck(t), r = rel(t); return [n[0] - r[0] - Math.sin(yaw(t)) * i * 12, n[1] + i * 9]; }, 12, (25 - i * 4) * (o.sl || 1), { wind: t => { const v = V(t), w = o.wind ? o.wind(t) : [0, 0]; const k = clamp(1 - Math.abs(v[0]) / 700), g0 = Math.sin(yaw(t)); return [clamp(-v[0] * 2.2, -5600, 5600) + w[0] - (Math.sign(g0) || 1) * k * (1900 + Math.sin(t * 2.3) * 400), 1000 + i * 250 - k * 420 + clamp(-v[1] * 1.2, -2600, 2600) + w[1]]; }, flutter: [4200 + i * 1400, 23 + i * 4, 0.85], drag: 0.015, dir: [-1, 0.2] }));
  return {
    pelvis, loc, toLocal, hand, rot, yaw, cr, vel: V, pos: o.pos, sc,
    scarf(t, w, z = 1) { const r = rel(t); [1, 0].forEach(i => { const P = tails[i](t), pts = []; for (let k = 0; k <= 44; k++) { const u = k / 44 * (P.length - 1), j = Math.min(P.length - 2, Math.floor(u)), f = u - j, pm = P[Math.max(0, j - 1)], a = P[j], b = P[j + 1], pn = P[Math.min(P.length - 1, j + 2)], cr4 = (p0, p1, p2, p3) => 0.5 * (2 * p1 + (p2 - p0) * f + (2 * p0 - 5 * p1 + 4 * p2 - p3) * f * f + (3 * p1 - p0 - 3 * p2 + p3) * f ** 3), q = toS(w, cr4(pm[0], a[0], b[0], pn[0]) + r[0], cr4(pm[1], a[1], b[1], pn[1])), v = k / 44; pts.push([q[0], q[1], (14 + v * 14) * w.z * z * (sc(t) / SC) * (v > 0.96 ? (1 - v) * 25 : 1), Math.sin(v * 7 - t * 17 + i) * 0.75, k * 9]); } gl().silk({ pts, c: SILKC, seed: 9 + i, t }); }); },
    draw(x, t, ov = {}) {
      const s = sc(t), c = cr(t), r = rot(t), y = yaw(t), yw = fold(y), h0 = armRun(t), h = o.handL ? o.handL(t, h0) : h0, k = run(t), f = Math.sign(Math.sin(yw)) || 1, P = o.pose ? o.pose(t) : {}, A = ant(t), ft = c * 158; let feet = P.feet || [[-74, ft, 0], [72, ft - 2, 0]];
      if (k > 0.02) { const R = [0, 1].map(i => { const a = ph(t) + i * Math.PI, ca = Math.cos(a), sa = Math.sin(a); return [f * (ca * 118 + 6), ft + 8 - Math.max(0, -sa) * 96, f * (sa < 0 ? -0.2 + ca * 0.75 : ca * 0.18)]; }); feet = feet.map((q, i) => q.map((v, j) => lerp(v, R[i][j], k))); }
      bot(x, { p: pelvis(t), s, rot: r, yaw: yw, t, lean: 0, head: clamp(-nr(r) * 0.4, -0.5, 0.5), headYaw: 0.1, hands: [[h[0], h[1], 'open'], [h[2], h[3], 'open']], eyes: {}, look: [0.3, 0], blink: (t % 3.1) > 3.0 ? 0.1 : 1, ant: [clamp(A[0], -0.9, 0.9), clamp(A[1], -1.5, 1.5)], key: '#bff6ff', fill: '#ff8fe0', ...P, ...ov, feet, hands: (ov.hands || P.hands) ? (ov.hands || P.hands) : [[h[0], h[1], P.hm?.[0] || 'open'], [h[2], h[3], P.hm?.[1] || 'open']] });
    },
  };
}
// ---- textured mesh: P(i,j) -> [x, y, light(-1..1), z]; img drawn cell by cell with affine maps
export function mesh(x, img, nx, ny, P, o = {}) {
  const iw = img.width, ih = img.height, cw = iw / nx, ch = ih / ny, G = []; for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) G.push(P(i / nx, j / ny)); const cells = []; for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = G[j * (nx + 1) + i], b = G[j * (nx + 1) + i + 1], c = G[(j + 1) * (nx + 1) + i], d = G[(j + 1) * (nx + 1) + i + 1]; cells.push([i, j, a, b, c, d, ((a[3] || 0) + (b[3] || 0) + (c[3] || 0) + (d[3] || 0)) / 4]); } if (o.sort) cells.sort((a, b) => a[6] - b[6]);
  cells.forEach(([i, j, a, b, c, d]) => { const ux = ((b[0] - a[0]) + (d[0] - c[0])) / 2, uy = ((b[1] - a[1]) + (d[1] - c[1])) / 2, vx = ((c[0] - a[0]) + (d[0] - b[0])) / 2, vy = ((c[1] - a[1]) + (d[1] - b[1])) / 2, mx = (a[0] + b[0] + c[0] + d[0]) / 4, my = (a[1] + b[1] + c[1] + d[1]) / 4, l = (a[2] + b[2] + c[2] + d[2]) / 4, back = ux * vy - uy * vx < 0; x.save(); x.transform(ux, uy, vx, vy, mx, my); x.drawImage(img, i * cw, j * ch, cw, ch, -0.53, -0.53, 1.06, 1.06); if (back && o.back) { x.globalAlpha *= 0.8; x.fillStyle = o.back; x.fillRect(-0.53, -0.53, 1.06, 1.06); x.globalAlpha /= 0.8; } const s = back ? l * 0.6 - 0.12 : l; if (s < -0.02) { x.fillStyle = rgba(o.dark || '#0a3a5c', Math.min(0.7, -s)); x.fillRect(-0.53, -0.53, 1.06, 1.06); } else if (s > 0.02) { x.fillStyle = rgba(o.light || '#ffffff', Math.min(0.7, s)); x.fillRect(-0.53, -0.53, 1.06, 1.06); } x.restore(); });
}
export const SPR = new Map();
export const sprite = (k, w, h, fn, sc = 1.5) => { let c = SPR.get(k); if (!c) { c = new OffscreenCanvas(Math.ceil(w * sc), Math.ceil(h * sc)); const g = c.getContext('2d'); g.scale(sc, sc); fn(g); SPR.set(k, c); } return c; };
// jagged arc between points, alive at 14 Hz
export function bolt(x, a, b, t, sd, c = '#bff6ff', w = 5, amp = 34) { const fr = Math.floor(t * 18) + sd * 101, n = 9, P = []; for (let i = 0; i <= n; i++) { const u = i / n, q = Math.sin(u * Math.PI); P.push([lerp(a[0], b[0], u) + (hash(fr * 7 + i * 13) - 0.5) * amp * 2 * q, lerp(a[1], b[1], u) + (hash(fr * 11 + i * 17) - 0.5) * amp * 2 * q]); } x.save(); x.globalCompositeOperation = 'lighter'; x.lineJoin = x.lineCap = 'round'; [[w * 4, 0.16], [w * 1.8, 0.4], [w * 0.7, 1]].forEach(([lw, al], k) => { x.strokeStyle = rgba(k === 2 ? '#ffffff' : c, al); x.lineWidth = lw; x.beginPath(); P.forEach((p, i) => x[i ? 'lineTo' : 'moveTo'](...p)); x.stroke(); }); x.restore(); }
// radial burst of particles: push world-space particles into list L, age a since t0
export function burst(L, t, t0, ox, oy, o = {}) { const a = t - t0, n = o.n || 50, life = o.life || 0.8; if (a <= 0 || a > life * 1.4) return; for (let i = 0; i < n; i++) { const h = k => hash((o.sd || 1) * 977 + i * 31 + k), an = (o.a0 ?? 0) + h(1) * ((o.a1 ?? TAU) - (o.a0 ?? 0)), v = (o.v0 || 260) + h(2) * (o.v1 || 900), dr = 1 - Math.exp(-a * 2.2), px = ox + Math.cos(an) * v * dr / 2.2, py = oy + Math.sin(an) * v * dr / 2.2 + (o.g ?? 1000) * a * a, l = 1 - a / (life * (0.6 + h(3) * 0.6)); if (l <= 0) continue; const vx = Math.cos(an) * v * Math.exp(-a * 2.2), vy = Math.sin(an) * v * Math.exp(-a * 2.2) + 2 * (o.g ?? 1000) * a, st = o.st ?? 0.01; L.push([px, py, vx * st, vy * st, (o.r0 || 4) + h(4) * (o.r1 || 10) * Math.sqrt(l), o.type ?? (h(5) > 0.75 ? 3 : 1), o.c[Math.floor(h(6) * o.c.length)], clamp(l * 2)]); } }
export const flush = (x, w, L) => { if (!L.length) return; const G = gl(); G.clear(); G.parts(L.map(p => { const q = toS(w, p[0], p[1]); return [q[0], q[1], p[2] * w.z, p[3] * w.z, p[4] * w.z, p[5], p[6], p[7]]; })); G.to(x); };
export const toScreen = (w, L) => L.map(p => { const q = toS(w, p[0], p[1]); return [q[0], q[1], p[2] * w.z, p[3] * w.z, p[4] * w.z, p[5], p[6], p[7]]; });
// screen-space speed streaks
export function streaks(x, t, dir, amt, o = {}) { if (amt < 0.03) return; const L = [], n = o.n || 40, sd = o.sd || 0; for (let i = 0; i < n; i++) { const sp = (o.sp || 4200) * (0.6 + hash(i * 3 + sd) * 0.9), per = 2900, q = ((t * sp * dir + hash(i * 7 + sd) * per) % per + per) % per - 480, py = hash(i * 5 + sd) * 1080, l = (90 + hash(i * 11 + sd) * 320) * amt * dir; L.push(o.vert ? [py * 1.78, q * 0.6, 0, -l, (o.w || 2) + hash(i * 13) * (o.w || 2), 2, o.c || '#ffffff', (o.a || 0.28) * amt] : [q, py, l, 0, (o.w || 2) + hash(i * 13) * (o.w || 2), 2, o.c || '#ffffff', (o.a || 0.28) * amt]); } const G = gl(); G.clear(); G.parts(L); G.to(x); }
export function shock(x, px, py, u, R, c = '#ffffff', w = 26, k = 1) { if (u <= 0 || u >= 1) return; x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba(c, (1 - u)); x.lineWidth = w * (1 - u); x.beginPath(); x.ellipse(px, py, Math.max(1, ease.out3(u) * R), Math.max(1, ease.out3(u) * R * k), 0, 0, TAU); x.stroke(); x.restore(); }
