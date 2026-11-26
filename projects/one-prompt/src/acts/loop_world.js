// Crystal velodrome: sky, cathedral, crystal forests, the glass track. World x: model at 0, laptop at LX.
import { K, CODE, ink, inner, rr, circ, ell, poly, blob, union, rgba, mix, lg, rg, glow, beam, text, sparkle, cached, TAU, clamp, lerp, hash, rng, ease, key, noise } from '../ink.js';
import { gl } from '../gl.js';
import { ripple } from '../sim.js';
import { par, toS, apply } from './loop_kit.js';
export const LX = 3600, GY = 858, FY = 792; // laptop x, front lane y, rear lane y
// ---- crystals: prism shards, three facets each
function shard(g, bx, by, w, h, tilt, pal, r) {
  g.save(); g.translate(bx, by); g.rotate(tilt); const sh = h * (0.74 + r() * 0.12), rd = (r() - 0.5) * w * 0.3, tip = (r() - 0.5) * w * 0.5, A = [-w / 2, 0], B = [w / 2, 0], CL = [-w / 2, -sh], CR = [w / 2, -sh * (0.9 + r() * 0.08)], M = [rd, -sh * 0.93], T = [tip, -h];
  const f = (pts, c, gx) => { g.fillStyle = lg(g, gx ? -w / 2 : 0, -h, gx ? w / 2 : 0, 0, c); g.beginPath(); pts.forEach((q, i) => g[i ? 'lineTo' : 'moveTo'](...q)); g.closePath(); g.fill(); };
  f([A, CL, M, [rd, 0]], [pal[0], mix(pal[0], pal[1], 0.6), pal[1], pal[2]]); f([[rd, 0], M, CR, B], [mix(pal[1], pal[2], 0.4), pal[2], mix(pal[2], pal[3], 0.4)]); f([CL, T, M], [mix(pal[0], '#ffffff', 0.7), pal[0]]); f([M, T, CR], [mix(pal[0], pal[1], 0.5), pal[1]]);
  g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 3; i++) { const y0 = -sh * (0.15 + r() * 0.6), l = sh * (0.12 + r() * 0.2); g.fillStyle = rgba(i ? '#ffffff' : pal[4], 0.13 + r() * 0.13); g.beginPath(); g.moveTo(-w / 2, y0); g.lineTo(rd, y0 - l * 0.4); g.lineTo(rd, y0 - l); g.lineTo(-w / 2, y0 - l * 0.5); g.fill(); } g.globalCompositeOperation = 'source-over';
  g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = rgba('#ffffff', pal[5] ?? 0.6); g.beginPath(); g.moveTo(...A); g.lineTo(...CL); g.lineTo(...T); g.stroke(); g.lineWidth = 2; g.strokeStyle = rgba('#ffffff', 0.45); g.beginPath(); g.moveTo(rd, 0); g.lineTo(...M); g.lineTo(...T); g.stroke(); g.lineWidth = 5; g.strokeStyle = rgba(pal[4], 0.9); g.beginPath(); g.moveTo(B[0] - 2, 0); g.lineTo(CR[0] - 2, CR[1]); g.lineTo(...T); g.stroke(); g.restore();
}
export function cluster(g, sd, pal, n = 9) { const r = rng(sd), S = []; for (let i = 0; i < n; i++) { const u = (i + 0.5) / n, env = Math.pow(Math.sin(u * Math.PI), 0.6); S.push([110 + u * 780 + (r() - 0.5) * 60, 70 + r() * 90, (260 + r() * 420) * env + 90, (u - 0.5) * 0.7 + (r() - 0.5) * 0.16]); } S.sort((a, b) => b[2] - a[2]); S.forEach(q => shard(g, q[0], 900, q[1], q[2], q[3], pal, r)); }
export const PALS = { far: ['#e0a8ff', '#b47cfa', '#8450ee', '#5c2cd0', '#ffa8f0', 0.3], mid: ['#9aeaff', '#48aaff', '#2f54e8', '#1c18a8', '#c070f8', 0.5], near: ['#7fb4ff', '#3a3ae0', '#1e0e94', '#0c0450', '#ff5fd0'], mag: ['#ffe0fb', '#ff7fe0', '#a42ad8', '#3a0a86', '#8ff2ff'] };
export const crystal = (x, k, pal, v, o = {}) => cached(x, 'lpCr' + k + v, -500, -900, 1000, 900, g => { g.translate(-500, -900); cluster(g, v * 17 + 3, PALS[pal], o.n || 9); }, o.res || 1, o.blur || 0);
export function forest(x, k, pal, o) { const G = o.gap, i0 = Math.floor(o.cam / G); for (let i = -2; i < Math.ceil(1920 / G) + 2; i++) { const id = i0 + i, v = ((id % 4) + 4) % 4, px = id * G - o.cam + (hash(id * 3 + 1) - 0.5) * G * 0.35, sc = o.scale * (0.75 + hash(id * 9 + 5) * 0.5); x.save(); x.translate(px, o.y); x.scale(hash(id * 5) > 0.5 ? -sc : sc, sc); crystal(x, k, pal, v, o); x.restore(); } }
function arch(g) { // gothic bay 900 x 1200
  const pt = (k) => { const p = new Path2D(); p.moveTo(40 + k, 1200); p.lineTo(40 + k, 620); p.bezierCurveTo(40 + k, 330, 230 + k * 0.6, 130 + k, 450, 30 + k * 1.3); p.bezierCurveTo(670 - k * 0.6, 130 + k, 860 - k, 330, 860 - k, 620); p.lineTo(860 - k, 1200); return p; };
  g.fillStyle = lg(g, 0, 0, 0, 1200, ['rgba(150,240,255,0.26)', 'rgba(110,150,255,0.18)', 'rgba(255,120,220,0.10)', 'rgba(255,255,255,0)']); g.fill(pt(0)); g.lineJoin = 'round';
  [[34, 0, 'rgba(70,110,255,0.5)'], [18, 0, 'rgba(170,230,255,0.65)'], [5, 0, 'rgba(255,255,255,0.95)'], [8, 60, 'rgba(220,190,255,0.5)'], [3, 60, 'rgba(255,255,255,0.8)']].forEach(([w, k, c]) => { g.lineWidth = w; g.strokeStyle = c; g.stroke(pt(k)); });
  for (let i = 1; i < 4; i++) { const px = 40 + i * 205; g.lineWidth = 5; g.strokeStyle = 'rgba(235,225,255,0.4)'; g.beginPath(); g.moveTo(px, 1200); g.lineTo(px, 560); g.stroke(); } [[450, 300, 110], [300, 470, 70], [600, 470, 70]].forEach(([a, b, r]) => { g.fillStyle = rg(g, a, b, r, ['rgba(255,255,255,0.75)', 'rgba(150,220,255,0.4)', 'rgba(255,120,230,0.28)']); g.beginPath(); g.arc(a, b, r, 0, TAU); g.fill(); g.lineWidth = 6; g.strokeStyle = 'rgba(255,255,255,0.75)'; g.stroke(); for (let k = 0; k < 8; k++) { const an = k * TAU / 8; g.lineWidth = 3; g.strokeStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(a + Math.cos(an) * r * 0.3, b + Math.sin(an) * r * 0.3); g.lineTo(a + Math.cos(an) * r, b + Math.sin(an) * r); g.stroke(); } });
}
export function arches(x, cam, y, sc, a) { const G = 860 * sc, i0 = Math.floor(cam / G); x.save(); x.globalAlpha = a; for (let i = -1; i < Math.ceil(1920 / G) + 1; i++) { const id = i0 + i; x.save(); x.translate(id * G - cam, y - 1200 * sc); x.scale(sc, sc); cached(x, 'lpArch', 0, 0, 900, 1200, arch, 0.9, 1.5); x.restore(); } x.restore(); }
// ---- the sky and the hall
export function hall(x, t, w, o = {}) {
  const G = gl(); G.clear(); const sx = 960 - (w.cx - (o.sunX ?? 0)) * 0.16, sy = 470 - (w.cy - 540) * 0.12; const g0 = o.gold || 0, SK = [['#040334', '#16043c'], ['#0c0f86', '#3a0c74'], ['#1a32cc', '#8a1f8e'], ['#3f5cf2', '#e8486a'], ['#9a62f4', '#ff8a3c'], ['#ff8fe0', '#ffd67a']]; G.sky({ t, s: SK.map(q => mix(q[0], q[1], g0)), sunC: mix('#dffaff', '#ffe2a0', g0), c: ['#ffffff', '#8fb6ff', '#2a3fc0'], sun: [sx, sy], cam: [w.cx, w.cy - 540], cloud: 0, star: 0.8, ray: 0.34, hz: 1 }); G.to(x);
  par(x, w, 0.07, c => { forest(x, 'f', 'far', { cam: c * 1 + 9000, y: 730, scale: 0.5, gap: 330, res: 0.6, blur: 2.5 }); });
  par(x, w, 0.12, c => arches(x, c + 4000, 900, 0.82, 0.8));
  x.save(); x.fillStyle = lg(x, 0, 300, 0, 800, [rgba('#c07aff', 0), rgba(mix('#d88aff', '#ffb06a', g0), 0.4), rgba(mix('#8a4cf0', '#ff7a5a', g0), 0.3)]); x.fillRect(0, 300, 1920, 500); x.restore();
  par(x, w, 0.24, c => { forest(x, 'm', 'mid', { cam: c + 7000, y: 800, scale: 0.56, gap: 520, res: 0.8, blur: 0.6 }); });
  x.save(); x.fillStyle = lg(x, 0, 380, 0, 760, [rgba('#4a3cf0', 0), rgba(mix('#5a44f5', '#ff7a5a', g0), 0.3), rgba(mix('#4a28d8', '#b03a8a', g0), 0.5)]); x.fillRect(0, 380, 1920, 400); x.restore();
  { const ty = 540 + (744 - 540) * (1 + (w.z - 1) * 0.55) - (w.cy - 540) * 0.4 - 60; x.fillStyle = lg(x, 0, ty, 0, 1080, ['#3416a8', '#1c0a70', '#0c0440']); x.fillRect(0, ty, 1920, 1400); }
  // far straight of the loop
  if (!o.noStraight) par(x, w, 0.4, c => { const y = 704; x.fillStyle = lg(x, 0, y - 46, 0, y + 70, ['#a9c8ff', '#6a7cff', '#4a3ae0', '#2a1298']); x.fillRect(-200, y - 40, 2320, 130); x.fillStyle = 'rgba(255,255,255,0.95)'; x.fillRect(-200, y - 42, 2320, 5); [['#ff5fd0', -12], ['#8ff2ff', 18]].forEach(([q, d]) => { x.fillStyle = rgba(q, 0.8); x.fillRect(-200, y + d, 2320, 4); }); const S = 260, off = ((c % S) + S) % S; for (let i = -1; i < 9; i++) { const px = i * S - off; x.fillStyle = 'rgba(60,20,180,0.5)'; x.fillRect(px, y - 110, 8, 84); ink(x, circ(px + 4, y - 116, 10), { f: ['#ffffff', '#ff8fe6'] }); glow(x, px + 4, y - 116, 60, '#ff8fe6', 0.5); } });
  par(x, w, 0.62, c => { forest(x, 'n', 'near', { cam: c + 3000, y: 840, scale: 0.46, gap: 860, res: 1, n: 7 }); });
  if (g0 > 0) { x.save(); x.globalCompositeOperation = 'soft-light'; x.fillStyle = lg(x, 0, 0, 0, 900, [rgba('#ff9a2c', 0.2 * g0), rgba('#ff9a2c', 0.75 * g0), rgba('#ffa01c', 0.7 * g0)]); x.fillRect(0, 0, 1920, 1080); x.restore(); }
  const home = clamp((w.cx - 400) / (LX - 700)) * (o.noStraight || o.gold ? 0 : 1); x.save(); x.globalCompositeOperation = 'soft-light'; x.fillStyle = lg(x, 0, 0, 1920, 1080, [rgba('#ff3fc0', 0.16 * (1 - home)), rgba('#ff3fc0', 0.3 * (1 - home))]); x.fillRect(0, 0, 1920, 1080); if (home > 0) { x.fillStyle = lg(x, 0, 0, 0, 1080, [rgba('#0a50ff', 0.35 * home), rgba('#00ffc8', 0.6 * home)]); x.fillRect(0, 0, 1920, 1080); } x.restore();
}
const flat = wx => clamp(Math.min(Math.abs(wx) - 900, Math.abs(wx - LX) - 1200, 600) / 600);
export const hill = wx => flat(wx) * (Math.sin(wx * 0.0021) * 24 + Math.sin(wx * 0.0047 + 1) * 11);
// glass track between x0..x1 in world space; hits: ripple impulses
export function track(x, t, w, hits = [], o = {}) {
  const z = w.z, x0 = w.cx - 1080 / z, x1 = w.cx + 1080 / z, n = 90, H = wx => hill(wx) + ripple(t, wx, hits, { c: 1500, L: 240 }) * 0.5, P = []; for (let i = 0; i <= n; i++) { const wx = lerp(x0, x1, i / n); P.push([wx, H(wx)]); }
  const line = (yy, k = 1) => { P.forEach(([a, h], i) => x[i ? 'lineTo' : 'moveTo'](a, yy + h * k)); }; const band = (y0, y1, f, k0 = 1, k1 = 1) => { x.fillStyle = f; x.beginPath(); P.forEach(([a, h], i) => x[i ? 'lineTo' : 'moveTo'](a, y0 + h * k0)); for (let i = n; i >= 0; i--) x.lineTo(P[i][0], y1 + P[i][1] * k1); x.closePath(); x.fill(); };
  // back kerb
  band(728, 762, lg(x, 0, 720, 0, 762, ['#ffffff', '#d9c9ff', '#8f6cf5', '#4a22c0'])); x.strokeStyle = '#ffffff'; x.lineWidth = 3; x.beginPath(); line(728); x.stroke();
  // surface
  band(758, 918, lg(x, 0, 752, 0, 918, [[0, '#5ac8ff'], [0.07, '#c9f6ff'], [0.22, '#5fc0ff'], [0.55, '#4a78f8'], [0.82, '#4636e0'], [1, '#3a14b8']]));
  // seams of the boards, in perspective
  const S = 150, i0 = Math.floor(x0 / S) - 2, i1 = Math.ceil(x1 / S) + 2; x.lineCap = 'butt'; for (let i = i0; i <= i1; i++) { const wx = i * S, h = H(wx), k = (wx - w.cx) * 0.085; x.strokeStyle = i % 4 ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.6)'; x.lineWidth = i % 4 ? 2 : 4; x.beginPath(); x.moveTo(wx - k, 762 + h); x.lineTo(wx + k, 916 + h); x.stroke(); if (i % 4 === 0) { x.fillStyle = 'rgba(255,255,255,0.12)'; x.beginPath(); x.moveTo(wx - k, 762 + h); x.lineTo(wx + S - k * 1, 762 + H(wx + S)); x.lineTo(wx + S + (wx + S - w.cx) * 0.085, 916 + H(wx + S)); x.lineTo(wx + k, 916 + h); x.fill(); } }
  // lane lines with running lights
  [[786, 5, '#ffffff', 0.9], [826, 8, '#ff5fd0', 0.85], [884, 11, '#fff2b0', 0]].forEach(([y, lw, c, a], j) => { if (a <= 0) return; x.strokeStyle = rgba(c, a); x.lineWidth = lw; x.beginPath(); line(y); x.stroke(); }); x.strokeStyle = rgba('#ffffff', 0.85); x.lineWidth = 12; x.setLineDash([120, 120]); x.lineDashOffset = x0 % 240; x.beginPath(); line(890); x.stroke(); x.setLineDash([]);
  // reflections of bright things
  (o.refl || []).forEach(([rx, c, r, a]) => { x.save(); x.translate(rx, 838 + H(rx)); x.scale(1, 0.24); x.globalCompositeOperation = 'lighter'; x.fillStyle = rg(x, 0, 0, r, [rgba(c, a), rgba(c, a * 0.35), rgba(c, 0)]); x.fillRect(-r, -r, r * 2, r * 1.4); x.restore(); });
  x.save(); x.globalCompositeOperation = 'lighter'; band(760, 800, lg(x, 0, 760, 0, 800, ['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)'])); x.restore();
  // front lip
  band(914, 960, lg(x, 0, 914, 0, 960, ['#ffffff', '#b9a0ff', '#7a3cf0', '#3a0f9a'])); x.strokeStyle = '#ffffff'; x.lineWidth = 4; x.beginPath(); line(915); x.stroke(); x.save(); x.globalCompositeOperation = 'lighter'; x.strokeStyle = rgba('#ff5fd0', 0.85); x.lineWidth = 7; x.beginPath(); line(950); x.stroke(); x.restore();
  band(958, o.warm ? 1180 : 1500, lg(x, 0, 958, 0, o.warm ? 1180 : 1300, o.warm ? ['#5a1268', 'rgba(150,44,70,0.75)', 'rgba(216,102,42,0)'] : ['#2c0c86', '#150650', '#08032c'])); for (let i = Math.floor(x0 / 300) - 1; i < x1 / 300 + 1; i++) { const wx = i * 300, h = H(wx); x.strokeStyle = o.warm ? 'rgba(255,190,110,0.6)' : 'rgba(150,110,255,0.5)'; x.lineWidth = 12; x.beginPath(); x.moveTo(wx, 962 + h); x.lineTo(wx + 150, 1160 + h); x.lineTo(wx + 300, 962 + H(wx + 300)); x.stroke(); }
}
export const fgCrystal = (x, v) => cached(x, 'lpFg' + v, -500, -900, 1000, 900, g => { g.translate(-500, -900); cluster(g, v * 5 + 31, ['#b06cff', '#5a1fc0', '#2a0a78', '#0c0336', '#ff5fd0'], 6); }, 0.5, 12);
// foreground whips
export function fore(x, t, w) { const c = w.cx * 1.9; const G = 1700, i0 = Math.floor(c / G); for (let i = -1; i < 3; i++) { const id = i0 + i, px = id * G - c + (hash(id * 3) - 0.5) * 500 + 300, up = hash(id * 7) > 0.5; x.save(); x.translate(px, up ? -60 - (w.cy - 540) * 1.5 : 1190 - (w.cy - 540) * 1.5); x.scale(0.8, up ? -0.5 : 0.62); fgCrystal(x, ((id % 2) + 2) % 2); x.restore(); } }
