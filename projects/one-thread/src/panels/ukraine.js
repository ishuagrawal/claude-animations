// Ukraine — cross-stitch. Everything is charted on a 192×108 stitch grid (10 units a stitch), the way a rushnyk is
// counted out on linen. A steel needle pulls the red-gold thread in and out of the cloth; each dive pops stitches open.
import { lerp, clamp, TAU, rng } from '../art/geom.js';
import { seg, ease, key, hash } from '../core.js';

const PAL = { R: '#b5121b', D: '#7c0d16', K: '#1b1013', B: '#1d4588', L: '#4f86bd', Y: '#e3a11f', O: '#d4571a', G: '#3d7a33', E: '#1f4a27', W: '#f6eedb', S: '#dcaa7e', N: '#5b3317', A: '#b98432', P: '#d9818a' };
const CH = 'RDKBLYOGEWSNAP', GOLD = { Y: 0.22, A: 0.12 };
// ---------------------------------------------------------------- the chart
class Chart {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint8Array(w * h); this.ox = 0; this.oy = 0; }
  org(x, y) { this.ox = x; this.oy = y; return this; }
  set(x, y, c) { x = Math.round(x + this.ox); y = Math.round(y + this.oy); if (x < 0 || y < 0 || x >= this.w || y >= this.h) return; this.d[y * this.w + x] = c === '.' || c === ' ' ? (c === '.' ? this.d[y * this.w + x] : 0) : CH.indexOf(c) + 1; }
  get(x, y) { x = Math.round(x + this.ox); y = Math.round(y + this.oy); return x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : this.d[y * this.w + x]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, typeof c === 'function' ? c(i, j) : c); }
  ell(cx, cy, rx, ry, c) { for (let j = Math.floor(cy - ry); j <= cy + ry; j++) for (let i = Math.floor(cx - rx); i <= cx + rx; i++) { const u = (i - cx) / (rx + 0.2), v = (j - cy) / (ry + 0.2); if (u * u + v * v <= 1) this.set(i, j, typeof c === 'function' ? c(i - cx, j - cy) : c); } }
  poly(pts, c) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } for (let j = Math.floor(y0); j <= Math.ceil(y1); j++) for (let i = Math.floor(x0); i <= Math.ceil(x1); i++) { let k = false; for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) { const [xa, ya] = pts[a], [xb, yb] = pts[b]; if ((ya > j + 0.01) !== (yb > j + 0.01) && i + 0.01 < (xb - xa) * (j + 0.01 - ya) / (yb - ya) + xa) k = !k; } if (k) this.set(i, j, typeof c === 'function' ? c(i, j) : c); } }
  line(x0, y0, x1, y1, th, c) { const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)))); for (let k = 0; k <= n; k++) { const x = lerp(x0, x1, k / n), y = lerp(y0, y1, k / n), t = typeof th === 'function' ? th(k / n) : th; if (t <= 1) this.set(x, y, typeof c === 'function' ? c(k) : c); else { const r = t / 2; for (let j = Math.ceil(-r); j < r; j++) for (let i = Math.ceil(-r); i < r; i++) if (t < 3 || i * i + j * j <= r * r + 0.4) this.set(x + i, y + j, typeof c === 'function' ? c(k) : c); } } }
  path(pts, th, c) { for (let i = 0; i < pts.length - 1; i++) this.line(...pts[i], ...pts[i + 1], th, c); }
  dia(cx, cy, r, f) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const q = Math.abs(i) + Math.abs(j); if (q <= r) { const c = typeof f === 'function' ? f(q, i, j) : f[q]; if (c) this.set(cx + i, cy + j, c); } } }
  // eight-point star: k = reach
  star(cx, cy, k, c, mid) { for (let j = -k; j <= k; j++) for (let i = -k; i <= k; i++) { const a = Math.abs(i), b = Math.abs(j); if (a && b && a + b <= k + 1 && a !== b) this.set(cx + i, cy + j, typeof c === 'function' ? c(a, b) : c); } if (mid) this.set(cx, cy, mid); }
  blit(rows, x, y, o = {}) { rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.') this.set(o.flip ? x + r.length - 1 - i : x + i, y + j, o.map?.[ch] || ch); })); }
  mirror(cx) { const t = this.d.slice(); for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) { const v = t[j * this.w + i]; if (v) { const m = 2 * cx - i; if (m >= 0 && m < this.w) this.d[j * this.w + m] = v; } } }
  outline(c = 'K', only) { const t = this.d.slice(), v = CH.indexOf(c) + 1, on = only ? [...only].map(q => CH.indexOf(q) + 1) : null; for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) { if (t[j * this.w + i]) continue; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const x = i + a, y = j + b; if (x < 0 || y < 0 || x >= this.w || y >= this.h) continue; const q = t[y * this.w + x]; if (q && (!on || on.includes(q))) { this.d[j * this.w + i] = v; break; } } } return this; }
  over(g, x, y, flip) { for (let j = 0; j < g.h; j++) for (let i = 0; i < g.w; i++) { const v = g.d[j * g.w + i]; if (v) { const X = x + (flip ? g.w - 1 - i : i), Y = y + j; if (X >= 0 && Y >= 0 && X < this.w && Y < this.h) this.d[Y * this.w + X] = v; } } }
  // paint into an Art, top-left at panel/sprite units (ux,uy)
  paint(A, ux, uy, order = 0.5) { const m = A.m, a = A.a; for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) { const v = this.d[j * this.w + i]; if (!v) continue; const ch = CH[v - 1]; m.fillStyle = PAL[ch]; m.fillRect(ux + i * 10, uy + j * 10, 10, 10); const o = typeof order === 'function' ? order(i, j) : order; a.fillStyle = `rgb(${Math.round(clamp(o) * 255)},${Math.round((GOLD[ch] || 0) * 255)},0)`; a.fillRect(ux + i * 10, uy + j * 10, 10, 10); } return this; }
}
const RES = 0.25; // 10 units → 6 texels at bake 2.4: enough for a stitch
const sn = v => Math.round(v / 10) * 10;
// ---------------------------------------------------------------- flower charts (4-fold)
function rose(c, x, y, r, pal = 'RDYK') { const [p, d, m, k] = pal; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const q = Math.hypot(i, j), a = Math.atan2(j, i), w = r * (0.80 + 0.22 * Math.abs(Math.cos(2 * a))); if (q > w + 0.2) continue; const u = q / r; let ch = p; if (q < 1.2) ch = m; else if (u < 0.36) ch = k; else if (u < 0.52) ch = d; else if (Math.abs(i) === Math.abs(j)) ch = d; else if ((i === 0 || j === 0) && u > 0.6) ch = m; c.set(x + i, y + j, ch); } }
function sunfl(c, x, y, r, k = 0) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const q = Math.hypot(i, j), a = Math.atan2(j, i); const w = r * (0.82 + 0.2 * Math.cos(8 * a + k)); if (q > w + 0.35) continue; const ch = q < r * 0.46 ? ((i + j) & 1 ? 'N' : 'K') : q < r * 0.62 ? 'O' : 'Y'; c.set(x + i, y + j, ch); } }
function poppy(c, x, y, r) { for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) { const q = Math.hypot(i * 0.92, j); if (q > r + 0.2) continue; c.set(x + i, y + j, q < r * 0.34 ? 'K' : (Math.abs(i) < 1 && j < 0) || (j === 0 && Math.abs(i) > r * 0.5) ? 'D' : 'R'); } }
const KALYNA = ['...G...', '..GGG..', '.RR.RR.', 'RRRGRRR', 'RR.R.RR', '.RRRRR.', '.RR.RR.', '...R...'];
const OAK = ['....G....', '...GG....', '.GG.GGG..', '.GGGGEG..', '..GGEGG..', 'GGGEGGGG.', 'GGEGGGGG.', '..EGGG...', '.E.......'];
const LEAF = ['..GG.', '.GGGG', 'GGEGG', 'GEGG.', 'EGG..'];
const DOVE = ['......RRR..', '.....RRKRYY', 'K...RRRRR..', 'RK.BRRRRR..', 'RRKBYBRRR..', '.RRBBYBRK..', '..RRBBRK...', '....Y.Y....', '...YY.YY...'];
const DOVE2 = ['...........', '......RRR..', 'RK...RRKRYY', 'RRK.RRRRR..', '.RKBBRRRR..', '.RRBBYBRK..', '..RRBBRK...', '....Y.Y....', '...YY.YY...'];
// ---------------------------------------------------------------- hero bird. local origin = heart
const FX = 1.5, SPR = 1.3, NP = 11;
function fan(c, spread, ph) { // charted in polar cells so every plume stays crisp
  const D = 2 * SPR * spread / (NP - 1), wob = i => Math.sin(ph * TAU + i * 0.95) * 0.02 * spread, eyeR = i => (i % 2 ? 23 : 26.5) + (Math.sin(ph * TAU + i * 1.3) > 0.5 ? 1 : 0);
  for (let y = -31; y <= 8; y++) for (let x = -48; x <= 48; x++) { const X = x / FX, r = Math.hypot(X, y), a = Math.atan2(X, -y); if (r < 8) continue; const k = (a + SPR * spread) / D, i = Math.round(k); if (i < 0 || i >= NP || r > eyeR(i)) continue; const v = ((k - i) * D - wob(i)) * r * 1.32, av = Math.abs(v), hw = Math.min(D * r * 0.66, 0.6 + 2.5 * Math.sin(clamp((r - 6) / 19) * Math.PI * 0.82)); if (av > hw) continue;
    const t = i % 3, q = Math.floor((r + av * 0.9 + 40) / 2.2) % 2; const ch = av > hw - 0.85 && r > 11 ? 'K' : av < 0.5 ? 'Y' : t === 0 ? (q ? 'R' : 'D') : t === 1 ? (q ? 'O' : 'Y') : (q ? 'R' : 'O'); c.set(x, y, ch); }
  for (const par of [1, 0]) for (let i = par; i < NP; i += 2) { const a = -SPR * spread + i * D + wob(i), R = eyeR(i), x = Math.round(Math.sin(a) * R * FX), y = Math.round(-Math.cos(a) * R); if (spread < 0.4) { c.dia(x, y, 2, ['Y', 'R', 'K']); continue; } if (par) c.dia(x, y, 4, d => ['K', 'Y', 'Y', 'D', 'K'][d]); else { const t = (i / 2) % 3; c.dia(x, y, 5, d => ['Y', t === 1 ? 'R' : 'B', t === 1 ? 'R' : 'B', t === 2 ? 'Y' : 'W', 'R', 'K'][d]); if (t === 1) c.star(x, y, 3, 'Y', 'K'); } if (spread > 0.9 && par === 0) { const q = 34 + (Math.sin(ph * TAU + i) > 0 ? 1 : 0), X = Math.round(Math.sin(a) * q * FX), Y = Math.round(-Math.cos(a) * q); c.dia(X, Y, 1, ['Y', 'O']); } }
  if (spread > 0.8) for (let i = 0; i < NP - 1; i++) { const a = -SPR * spread + (i + 0.5) * D; for (let r = 24; r < 31 + (i + Math.round(ph * 6)) % 2; r++) { const x = Math.sin(a) * r * FX, y = -Math.cos(a) * r; if (!c.get(x, y)) c.set(x, y, r > 28 ? 'Y' : 'O'); } }
}
function bird(c, ph) {
  const s = Math.round(Math.sin(ph * TAU));
  for (const x of [-3, 4]) { c.line(x, 9, x - 1, 13, 2, 'Y'); for (const d of [-4, -1, 2]) c.line(x - 1, 14, x - 1 + d, 14, 1, 'Y'); c.set(x, 10, 'O'); c.set(x, 12, 'O'); }
  c.poly([[4, -2], [11, -5], [15, -4], [14, 0], [13, 3], [8, 6]], (x, y) => ((x + y + 60) % 4 < 2 ? 'R' : 'D'));
  c.ell(0, 3, 11, 7, (i, j) => { const x = i, y = j + 2; if (x < -1) { const q = (Math.abs(((x + 60) % 6) - 3) + Math.abs(((y + 63) % 6) - 3)); return q < 1 ? 'K' : q < 3 ? 'Y' : 'R'; } return 'R'; });
  c.path([[-7, 2], [-10, -3], [-11, -8], [-12, -13]], 6, 'R'); for (let y = -12; y < 0; y++) for (let x = -16; x < -3; x++) if (c.get(x, y)) { const e = Math.abs(x + 11.5 - (y + 6) * 0.35); if ((y + Math.round(e) + 40) % 3 === 0) c.set(x, y, 'Y'); }
  c.ell(-12, -16, 5, 5, 'R'); c.rect(-16, -19, 4, 4, 'W'); c.rect(-16, -18, 2, 2, 'K'); c.rect(-10, -17, 2, 2, 'O'); c.poly([[-17, -18], [-25, -14], [-17, -12.4]], 'Y'); c.line(-23, -14, -17, -15, 1, 'O'); c.line(-16, -11, -16, -7 + s, 3, 'D');
  [[-16, 3, -1], [-12, 5, 0], [-8, 4, 2]].forEach(([x, h, d]) => { c.line(x, -20, x + d + s, -20 - h, 2, 'R'); c.rect(x + d + s, -21 - h, 2, 2, 'Y'); });
  const w = [[-4, 1], [1, -4], [9, -4], [17, 0], [22, 6], [16, 5], [18, 10], [11, 9], [11, 13], [4, 10], [-2, 6]]; c.poly(w, (x, y) => { const d = Math.hypot(x + 3, y - 1); const q = Math.floor(d / 2.3) % 5; return q === 0 ? 'K' : q === 1 ? 'B' : q === 2 ? 'L' : q === 3 ? 'W' : 'Y'; }); c.path([[-4, 1], [1, -4], [9, -4], [17, 0], [22, 6]], 1, 'K'); c.path([[-4, 1], [-2, 6], [4, 10]], 1, 'K'); c.ell(1, 2, 4, 4, 'R'); c.dia(1, 2, 3, d => ['K', 'Y', 'Y', 'D'][d]);
}
// ---------------------------------------------------------------- dancers
const HW = ['..RYRYR..', '.RYRBRYR.', 'GRNNNNNRG', '.NNSSSNN.', '.NSSSSSN.', '.NKSSSKN.', '.NSSSSSN.', '..SSRSS..', '...SSS...'];
const HM = ['......NN...', '....NNNN...', '...SSSNNN..', '..SSSSSSNN.', '..SNNSNNSN.', '..SSKSKSS.N', '..SSSSSSS.N', '..NNNSNNN..', '.NN.SRS.NN.', '.N..SSS..N.', '....SSS....'];
const HK = ['..KKKKK..', '.KKDKKDK.', '.KKKKKKK.', '.NSSSSSN.', '.SKSSKSS.', '.SSSSSSS.', '.NNNNNNN.', '.N.SRS.N.', '...SSS...'];
function woman(ph, o = {}) { // 46×40 chart, feet at row 37, centre col 22
  const c = new Chart(46, 40); c.org(22, 37); const s = Math.sin(ph * TAU), k = Math.cos(ph * TAU), sk = o.sk || 'R', hem = 10 + 2 * Math.abs(k), sh = s * 2.5, by = -Math.round(Math.abs(s));
  ['R', 'B', 'Y', 'G', 'O'].forEach((col, i) => { const dir = s > 0 ? -1 : 1, pts = []; for (let q = 0; q <= 8; q++) pts.push([dir * (3 + q * (0.9 + i * 0.28)) * (0.5 + 0.5 * Math.abs(s)) + (1 - Math.abs(s)) * (i - 2) * 0.5, -27 + by + q * (2 - i * 0.12) + Math.sin(q * 0.9 + ph * TAU + i) * 1.1]); c.path(pts, 2, col); });
  const st = Math.round(s * 2); for (const x of [-4 - st, 2 + st]) { c.rect(x, -3, 4, 3, 'R'); c.rect(x - 1, 0, 5, 1, 'D'); }
  c.poly([[-5, -15 + by], [5, -15 + by], [hem + sh, -4], [hem * 0.6 + sh, -2], [sh, -3], [-hem * 0.6 + sh, -2], [-hem + sh, -4]], (x, y) => { const v = y + 15; if (v > 11) return 'K'; if (v === 11) return (x + 40) % 2 ? 'Y' : 'O'; if (v === 10) return sk; if (v === 9) return 'K'; if (v === 8) return 'Y'; if (v === 7) return (x + 40) % 4 < 2 ? 'W' : sk; return (x * 1.0 - sh * v / 12 + 60 | 0) % 4 === 0 ? (sk === 'D' ? 'R' : 'D') : sk; });
  c.poly([[-3, -14 + by], [3, -14 + by], [5 + sh, -4], [-4 + sh, -4]], (x, y) => { const v = y + 14; return v > 8 ? 'R' : v === 8 ? ((x + 40) % 2 ? 'R' : 'W') : v === 6 ? 'R' : v === 5 ? ((x + 40) % 2 ? 'K' : 'W') : v === 3 ? 'R' : 'W'; });
  const arm = (sg, up) => { const el = [sg * (8 + Math.abs(k)), -20 + by + (up ? -3 : 2)], ha = up ? [sg * (9 + 2 * Math.abs(s)), -29 + by + Math.round(s * sg)] : [sg * 5, -15 + by]; c.line(sg * 5, -22 + by, el[0], el[1], 5, q => (q % 3 === 1 ? 'R' : 'W')); c.line(el[0], el[1], ha[0], ha[1], 4, q => (q % 3 === 1 ? 'R' : 'W')); c.rect(ha[0] - 1, ha[1] - 1, 3, 2, 'S'); if (up && o.hk) { c.line(ha[0], ha[1] - 1, ha[0] + sg * 4, ha[1] + 4 + Math.round(s), 2, 'W'); c.rect(ha[0] + sg * 4, ha[1] + 5 + Math.round(s), 2, 1, 'R'); } };
  arm(-1, o.up !== 2 ? o.up : s > 0); arm(1, o.up !== 2 ? o.up : s <= 0);
  c.poly([[-5, -24 + by], [5, -24 + by], [4, -18 + by], [5, -14 + by], [-5, -14 + by], [-4, -18 + by]], (x, y) => (Math.abs(x) <= 1 ? (y % 2 ? 'R' : 'W') : (x + y + 60) % 4 === 0 ? 'Y' : (o.v || 'K'))); c.rect(-5, -15 + by, 11, 2, 'R'); c.rect(-4, -24 + by, 9, 1, 'W');
  for (let i = -3; i <= 3; i++) { c.set(i, -24 + by + (Math.abs(i) < 2 ? 1 : 0), 'R'); if (Math.abs(i) < 3) c.set(i, -22 + by, 'Y'); }
  c.blit(HW, -4, -33 + by, { flip: s < 0, map: o.hair ? { N: o.hair } : undefined });
  return c.outline('K');
}
function leaper(ph) { // 64×56 chart, ground at row 52, centre 32
  const c = new Chart(64, 58); c.org(32, 30); const air = ph > 0.18 && ph < 0.82 ? Math.sin((ph - 0.18) / 0.64 * Math.PI) : 0, sq = 1 - clamp(air * 3); // body root stays, sprite is lifted by draw
  const hipY = 6 + sq * 5, sp = Math.pow(air, 0.7); const knee = sg => [sg * lerp(6, 11, sp), hipY + lerp(5, 1, sp)], foot = sg => [sg * lerp(6, 22, sp), hipY + lerp(12 - sq * 4, -2, sp)];
  for (const sg of [-1, 1]) { const k = knee(sg), f = foot(sg); c.line(sg * 3, hipY, k[0], k[1], 8, q => (q % 5 === 2 ? 'B' : 'B')); c.line(k[0], k[1], lerp(k[0], f[0], 0.55), lerp(k[1], f[1], 0.55), t => 8 - t * 4, 'B'); c.line(lerp(k[0], f[0], 0.5), lerp(k[1], f[1], 0.5), f[0], f[1], 4, 'R'); c.line(f[0], f[1], f[0] + sg * 2, f[1] + (sp > 0.5 ? -3 : 1), 3, 'D'); c.line(k[0] - sg * 2, k[1] - 2, k[0] + sg, k[1] + 1, 1, 'L'); }
  // sash ends
  for (const d of [0, 1]) c.path([[-4, hipY - 1], [-9 - sp * 3, hipY + 2 - sp * 4 + d * 3], [-14 - sp * 2, hipY + 5 - sp * 9 + d * 3]], 2, d ? 'D' : 'R');
  // torso
  c.poly([[-6, hipY - 14], [6, hipY - 14], [5, hipY - 2], [5, hipY + 1], [-5, hipY + 1], [-5, hipY - 2]], (x, y) => (Math.abs(x) <= 2 ? ((x + y + 60) % 3 === 0 ? 'K' : 'R') : Math.abs(x) === 3 && y % 2 ? 'R' : 'W')); c.rect(-5, hipY - 2, 11, 3, (i) => (i % 3 === 1 ? 'Y' : 'R'));
  const arm = sg => { const sh = [sg * 6, hipY - 12], f = foot(sg), ha = sp > 0.45 ? [f[0] - sg * 1, f[1] - 4] : [sg * lerp(13, 17, sp), hipY - 18 - sq * 2], el = [lerp(sh[0], ha[0], 0.5) + sg, lerp(sh[1], ha[1], 0.5) + (sp > 0.45 ? -2 : 2)]; c.line(sh[0], sh[1], el[0], el[1], 5, q => (q % 4 === 1 ? 'R' : 'W')); c.line(el[0], el[1], ha[0], ha[1], 4, q => (q % 4 === 1 ? 'R' : 'W')); c.rect(ha[0] - 1, ha[1] - 1, 3, 3, 'S'); }; arm(-1); arm(1);
  c.rect(-4, hipY - 15, 9, 1, 'R'); c.blit(HM, -5, hipY - 25); return c.outline('K');
}
function bandura(ph) { const c = new Chart(34, 40); c.org(16, 36); const s = Math.round(Math.sin(ph * TAU) * 2);
  c.rect(-9, -10, 16, 10, (i, j) => (j < 1 ? 'K' : (i % 5 === 0 ? 'N' : 'A'))); c.line(-4, -12, 5, -11, 8, 'B'); c.line(5, -11, 6, -3, 6, 'B'); c.line(-5, -11, -3, -3, 6, 'B'); for (const x of [-5, 4]) { c.rect(x, -4, 5, 4, 'R'); c.rect(x, -1, 6, 1, 'D'); }
  c.poly([[-7, -26], [5, -26], [6, -10], [-7, -10]], (x, y) => (Math.abs(x + 1) < 2 ? ((x + y + 60) % 3 ? 'R' : 'K') : Math.abs(x + 1) === 3 && y % 2 ? 'R' : 'W')); c.rect(-7, -13, 13, 2, 'R');
  c.ell(5, -13, 6, 7, (i, j) => (Math.abs(i) < 3 && j > -2 && j < 2 ? 'K' : (Math.hypot(i / 6, j / 7) > 0.82 ? 'N' : 'Y'))); c.line(2, -18, -5, -32, 3, 'N'); c.rect(-7, -34, 4, 3, 'K'); for (const d of [0, 2, 4]) c.line(2 + d, -10, -3 + d * 0.6, -28 + d, 1, 'W');
  c.line(-7, -24, -10, -20, 5, q => (q % 3 === 1 ? 'R' : 'W')); c.line(-10, -20, -4, -26, 4, q => (q % 3 === 1 ? 'R' : 'W')); c.rect(-4, -28, 3, 3, 'S'); c.line(5, -24, 11, -18, 5, q => (q % 3 === 1 ? 'R' : q % 3 === 2 ? 'W' : 'W')); c.line(11, -18, 7, -13 + s, 4, q => (q % 3 === 1 ? 'R' : 'W')); c.rect(5, -14 + s, 3, 3, 'S');
  c.blit(HK, -5, -36); return c.outline('K'); }
function horse(ph) { const c = new Chart(34, 24); c.org(14, 21); const s = Math.sin(ph * TAU); const leg = (x, a, col) => { c.line(x, -7, x + a * 2, -4, 3, col); c.line(x + a * 2, -4, x + a * 3 - Math.abs(a), -1, 2, col); c.rect(x + a * 3 - Math.abs(a), 0, 3, 1, 'K'); };
  leg(-5, -s, 'D'); leg(5, s, 'D'); c.path([[-9, -10], [-11, -11 + s], [-12, -8 + s], [-11, -4 + s], [-12, -2 + s]], 2, 'D'); c.ell(0, -9, 9, 3, 'R'); c.poly([[3, -10], [6, -15], [10, -18], [13, -18], [17, -14], [16, -12], [12, -13], [10, -11], [9, -7]], 'R'); c.poly([[10, -17], [11, -21], [13, -17]], 'R'); c.path([[9, -18], [6, -15], [4, -12], [2, -11]], 2, 'K'); c.set(13, -16, 'W'); c.rect(-4, -13, 7, 5, (i, j) => (j === 4 ? 'Y' : (i + j) % 3 === 0 ? 'Y' : 'B')); c.line(13, -12, 11, -16, 1, 'Y'); leg(-7, s, 'R'); leg(7, -s, 'R'); return c.outline('K'); }
function stork(ph) { const c = new Chart(24, 16); c.org(10, 14); const up = ph < 0.5; c.rect(-8, -2, 17, 3, (i, j) => ((i + j) % 2 ? 'N' : 'A')); c.line(-1, -5, -1, -2, 1, 'R'); c.line(2, -5, 2, -2, 1, 'R'); c.ell(0, -7, 4, 2, 'W'); c.poly([[-2, -8], [-8, -5], [-7, -3], [0, -6]], 'K'); c.path([[3, -7], [5, -9], [4, -11]], 2, 'W'); c.rect(4, -12, 3, 2, 'W'); c.set(6, -12, 'K'); if (up) c.line(7, -12, 11, -14, 1, 'R'); else c.line(7, -11, 12, -10, 1, 'R'); return c.outline('K', 'W'); }
function bee(i) { const c = new Chart(9, 7); c.rect(2, 3, 5, 2, (a) => (a % 2 ? 'K' : 'Y')); c.rect(3, i ? 1 : 2, 2, i ? 2 : 1, 'L'); c.set(5, i ? 2 : 1, 'L'); return c; }
function khata() { const c = new Chart(34, 34); c.org(16, 33); c.rect(-12, -14, 25, 14, 'W'); c.rect(-12, -2, 25, 2, (i, j) => (j ? 'R' : 'D')); c.poly([[-16, -13], [-9, -26], [10, -26], [17, -13]], (x, y) => { const q = (y + 60) % 4; return q === 0 ? 'N' : (x + y * 2 + 90) % 5 === 0 ? 'O' : (x * 3 + y + 90) % 7 === 0 ? 'A' : 'Y'; }); c.rect(-15, -13, 31, 1, (i) => (i % 2 ? 'N' : 'A')); c.rect(-10, -27, 21, 2, (i) => (i % 3 === 0 ? 'K' : 'N')); c.rect(-2, -10, 6, 9, (i, j) => (i === 0 || i === 5 || j === 0 ? 'K' : (i + j) % 4 === 0 ? 'Y' : 'N')); for (const x of [-9, 7]) { c.rect(x - 2, -11, 8, 7, 'B'); c.rect(x, -10, 4, 5, (i, j) => (i === 2 || j === 2 ? 'W' : 'L')); c.rect(x - 2, -4, 8, 1, 'R'); } return c.outline('K'); }
function church() { const c = new Chart(40, 40); c.org(19, 38); const wall = (x, y, w, h) => c.rect(x, y, w, h, (i, j) => (j % 3 === 2 ? 'N' : 'A')); const dome = (x, y, r) => { c.rect(x - r + 1, y, 2 * r - 1, 3, (i, j) => (j === 2 ? 'K' : 'A')); c.ell(x, y - r + 1, r, r, (i, j) => (i === -Math.ceil(r / 2) ? 'Y' : (Math.abs(i) + j + 40) % 3 === 0 ? 'E' : 'G')); c.poly([[x - 2, y - 2 * r + 2], [x + 0.5, y - 2 * r - 1], [x + 3, y - 2 * r + 2]], 'G'); c.line(x, y - 2 * r - 4, x, y - 2 * r, 1, 'Y'); c.rect(x - 1, y - 2 * r - 3, 3, 1, 'Y'); };
  wall(-16, -11, 10, 11); wall(7, -11, 10, 11); wall(-8, -15, 17, 15); for (const [x, w, y] of [[-17, 12, -12], [6, 12, -12], [-9, 19, -16]]) c.poly([[x - 1, y + 2], [x + 2, y - 3], [x + w - 2, y - 3], [x + w + 1, y + 2]], (i, j) => ((j + 60) % 2 ? 'N' : (i + 60) % 2 ? 'K' : 'N')); wall(-4, -21, 9, 3); dome(-12, -17, 3); dome(12, -17, 3); dome(0, -23, 4); c.rect(-3, -8, 7, 8, (i, j) => (i === 0 || i === 6 || j === 0 ? 'K' : i === 3 ? 'Y' : 'D')); for (const x of [-13, 11]) { c.rect(x - 1, -8, 4, 5, 'K'); c.rect(x, -7, 2, 3, 'Y'); } c.dia(0, -12, 1, ['Y', 'K']); c.rect(-17, -1, 35, 1, 'K'); return c.outline('K'); }
function egg(c, x, y, k) { const base = ['R', 'K', 'B', 'D', 'G'][k % 5]; c.ell(x, y, 5, 6, (i, j) => { const e = Math.hypot(i / 5.2, j / 6.2) > 0.9; if (e) return 'K'; if (k % 3 === 0) { if (Math.abs(j) === 4) return 'Y'; return base; } if (k % 3 === 1) { if (j === 0) return 'W'; if (Math.abs(j) === 1) return (i + 20) % 2 ? 'Y' : base; return (Math.abs(i) + Math.abs(j)) % 4 === 0 ? 'Y' : base; } return (i + j + 40) % 4 === 0 || (i - j + 40) % 4 === 0 ? 'Y' : base; }); if (k % 3 === 0) c.star(x, y, 3, 'W', 'Y'); }
function tree(side) { // 43×46, trunk col 21, base row 43
  const c = new Chart(43, 46); c.org(21, 43);
  c.rect(-1, -38, 2, 34, (i) => (i ? 'E' : 'G')); const br = (y, x1, y1, x2, y2) => { for (const k of [-1, 1]) { c.path([[0, y], [k * x1, y1], [k * x2, y2]], 2, 'G'); c.path([[0, y + 1], [k * x1, y1 + 1]], 1, 'E'); } };
  br(-7, 8, -8, 14, -13); br(-16, 9, -18, 15, -23); br(-25, 6, -27, 11, -32);
  for (const k of [-1, 1]) { c.blit(OAK, k > 0 ? 3 : -11, -17, { flip: k < 0 }); c.blit(LEAF, k > 0 ? 2 : -6, -25, { flip: k < 0 }); c.blit(LEAF, k > 0 ? 2 : -6, -34, { flip: k < 0 }); c.blit(KALYNA, k * 9 - 3, -7); rose(c, k * 15, -14, 5); sunfl(c, k * 15, -25, 5); poppy(c, k * 11, -33, 4); c.blit(LEAF, k > 0 ? 8 : -12, -22, { flip: k < 0 }); c.dia(k * 19, -19, 1, ['Y', 'R']); c.dia(k * 18, -31, 1, ['Y', 'B']); c.dia(k * 5, -37, 1, ['Y', 'R']); c.dia(k * 20, -7, 1, ['Y', 'B']); c.dia(k * 18, -38, 1, ['Y', 'R']); }
  rose(c, 0, -38, 4, 'RDYK'); c.dia(0, -20, 2, ['Y', 'R', 'K']); c.dia(0, -29, 2, ['Y', 'B', 'K']);
  c.poly([[-5, -6], [6, -6], [8, -3], [5, 1], [-4, 1], [-7, -3]], (x, y) => (y === -6 || y === 0 ? 'K' : (Math.abs(((x + 60) % 4) - 2) + Math.abs(y + 3) < 2 ? 'Y' : (y === -5 || y === -1 ? 'Y' : 'R')))); c.rect(-3, 1, 7, 1, 'K'); return c;
}
// geometric border: rows run outward→inward, u along
function borderCell(u, v, len) { // v 0..8
  if (v === 0 || v === 8) return 'K'; if (v === 9) return u % 4 === 0 ? 'R' : u % 4 === 2 ? 'K' : '.'; if (v === 10) return u % 4 === 0 ? 'R' : '.';
  const P = 18, x = ((u % P) + P) % P - 4, y = v - 4; const a = Math.abs(x), b = Math.abs(y);
  if (a <= 4) { if (a && b && a + b <= 4) return 'R'; if (!a && !b) return 'K'; if (a + b === 6) return 'K'; if (a + b === 7) return 'R'; return '.'; }
  const x2 = x - 9, a2 = Math.abs(x2); if (a2 + b === 4) return 'R'; if (a2 + b === 3) return 'K'; if (a2 + b === 2) return '.'; if (a2 + b <= 1) return a2 + b ? 'R' : 'Y'; if (a2 + b === 5 && b > 2) return 'K'; return '.';
}
// ---------------------------------------------------------------- running-stitch path of the needle
const SY = 585, PER = 340, NL = 270; // stitch line, period
const lineY = x => (x > 1500 ? lerp(SY, 540, ease.inOut2(clamp((x - 1500) / 540))) : x < 420 ? lerp(SY, 540, ease.inOut2(clamp((420 - x) / 540))) : SY);
const phi = x => (((960 + 238 - x) / PER) % 1 + 1) % 1; // 0..0.64 above, then below. pokes down at x = 960
const laidZ = x => { const p = phi(x), o = 0.72; return p < o ? Math.min(1, Math.sin(p / o * Math.PI) * 3) * 7 - 1 : -9 * Math.sin((p - o) / (1 - o) * Math.PI) - 1; };
const airZ = x => { const p = phi(x), o = 0.7; return p < o ? Math.sin(p / o * Math.PI) * 104 : -Math.sin((p - o) / (1 - o) * Math.PI) * 48; };

export default {
  id: 'ukraine', mat: 4, dur: 5, from: 'right', to: 'left',
  word: { native: 'нитка', font: '"Times New Roman"', roman: 'nytka', gloss: 'thread' },
  caption: { place: 'Ukraine', tech: 'cross-stitch' },
  sfx: [{ t: 0.3, s: 'rip' }, { t: 0.625, s: 'click' }, { t: 1.25, s: 'thump' }, { t: 1.35, s: 'sparkle' }, { t: 1.875, s: 'stamp' }, { t: 2.5, s: 'stamp' }, { t: 2.5, s: 'shimmer' }, { t: 3.125, s: 'stamp' }, { t: 3.75, s: 'pluck' }, { t: 4.375, s: 'stamp' }],
  env: (t, cam) => { const f = 1 + 0.02 * Math.sin(t * 7.3); return { cloth: '#f0e7d2', stain: 0.45, wear: 0.06, exposure: 0.92, relief: 1.15, tint: [1, 0.99, 0.965], amb: [0.14, 0.13, 0.12], keys: [{ x: cam.x - cam.w * 0.28, y: cam.y - cam.w * 0.3, z: cam.w * 0.3, R: cam.w * 0.74, col: [1.72 * f, 1.6 * f, 1.36 * f] }, { x: cam.x + cam.w * 0.5, y: cam.y + cam.w * 0.16, z: cam.w * 0.2, R: cam.w * 0.5, col: [0.5, 0.36, 0.22] }], waves: [[0.0035, 0.0018, 8, t * 0.8]] }; },
  bake(B) {
    const L = (name, fn, o) => B.layer(name, fn, { res: RES, ...o });
    L('border', A => {
      const c = new Chart(192, 108); const W = 188, H = 104; const put = (x, y, ch) => { if (ch && ch !== '.') c.set(x, y, ch); };
      for (let v = 0; v < 11; v++) { for (let x = v < 9 ? 11 : 13; x < (v < 9 ? 181 : 179); x++) { const u = x - 96 + 9 * 20 + 4; const ch = borderCell(u, v, 0); put(x, 2 + v, ch); put(x, 105 - v, ch); } for (let y = v < 9 ? 11 : 13; y < (v < 9 ? 97 : 95); y++) { const u = y - 54 + 9 * 20 + 4; const ch = borderCell(u, v, 0); put(2 + v, y, ch); put(189 - v, y, ch); } }
      for (const [cx, cy] of [[6, 6], [185, 6], [6, 101], [185, 101]]) { for (let j = -4; j <= 4; j++) for (let i = -4; i <= 4; i++) c.set(cx + i, cy + j, Math.max(Math.abs(i), Math.abs(j)) === 4 ? 'K' : 'R'); c.star(cx, cy, 3, 'W', 'Y'); }
      c.paint(A, 0, 0, (i, j) => clamp((i > 96 ? (192 - i) / 192 : 1 - i / 192) * 0.9 + (j % 2) * 0.02));
    });
    L('trees', A => { const t = tree(); const c = new Chart(192, 108); c.over(t, 12, 12); c.over(t, 137, 12); c.paint(A, 0, 0, (i, j) => clamp((57 - j) / 46) * 0.42 + (i < 96 ? 0.56 : 0)); });
    L('fill', A => { const c = new Chart(192, 108); const R = rng(4);
      for (const [x, y] of [[59, 31], [133, 31], [53, 15], [139, 15]]) c.star(x, y, 2, 'R', 'K');
      for (const [x, y, ch] of [[66, 14, 'Y'], [126, 14, 'Y'], [57, 37, 'B'], [135, 37, 'B'], [55, 43, 'Y'], [137, 43, 'Y'], [80, 45, 'B'], [112, 45, 'B'], [61, 37, 'R'], [131, 37, 'R']]) { c.set(x, y, 'K'); for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) c.set(x + a, y + b, ch); }
      egg(c, 58, 21, 1); egg(c, 134, 21, 2); for (const [x, y] of [[51, 66], [56, 63], [51, 73], [171, 64], [169, 70]]) c.star(x, y, 2, 'R', 'K');
      for (let x = 76; x < 117; x++) { const h = Math.round(4 * Math.sqrt(Math.max(0, 1 - ((x - 96) / 21) ** 2))); for (let j = 0; j < h; j++) c.set(x, 55 - j, j === h - 1 ? 'E' : (x + j) % 3 ? 'G' : 'E'); } for (const x of [80, 88, 104, 112]) poppy(c, x, 54, 2); for (const x of [84, 96, 108]) c.dia(x, 54, 1, ['Y', 'W']);
      c.paint(A, 0, 0, (i, j) => clamp(Math.hypot(i - 96, j - 57) / 90)); });
    L('divider', A => { const c = new Chart(192, 108); for (let x = 13; x < 179; x++) { c.set(x, 56, 'K'); c.set(x, 60, 'K'); const u = (x - 12) % 6; c.set(x, 57, u < 4 ? 'R' : '.'); if (u === 0 || u === 3) c.set(x, 58, 'R'); if (u === 0 || u > 2) c.set(x, 59, 'R'); } c.paint(A, 0, 0, i => 1 - i / 192); });
    L('village', A => { const c = new Chart(192, 108); c.over(khata(), 12, 62); c.over(church(), 141, 57); for (let x = 13; x < 46; x++) c.set(x, 95, (x % 3) ? 'G' : 'E'); for (let x = 146; x < 179; x++) c.set(x, 95, (x % 3) ? 'G' : 'E');
      for (const [x, y, r] of [[42, 80, 4], [39, 88, 3]]) { c.line(x, y, x + 1, 95, 1, 'G'); sunfl(c, x, y, r); } for (const [x, y] of [[41, 91], [44, 93]]) c.blit(['GG', 'GG'], x, y); c.paint(A, 0, 0, (i, j) => clamp((96 - j) / 46) * 0.4 + (i < 96 ? 0.56 : 0)); });
    B.sprite('wheat', { w: 1080, h: 220, ox: 0, oy: 210, n: 6, res: RES }, (A, ph) => { const c = new Chart(108, 22); c.org(0, 21); for (let x = 2; x < 108; x += 4) { const s = Math.sin(ph * TAU + x * 0.13) * 1.6, h = 15 + ((x * 7) % 4); for (let y = 0; y < h - 6; y++) c.set(x + s * (y / h) * (y / h), -y, y < 3 ? 'E' : 'A'); for (let q = 0; q < 7; q++) { const y = -h + 6 - q, X = x + s * Math.pow((h - 6 + q) / h, 2); c.set(X, y, 'O'); if (q < 6) { c.set(X - 1, y, q % 2 ? 'Y' : 'A'); c.set(X + 1, y, q % 2 ? 'Y' : 'A'); } } c.line(x + 2, 0, x + 2, -4 - (x % 8 ? 0 : 2), 1, 'G'); c.set(x + 1, 0, 'E'); c.set(x - 1, 0, 'G'); c.set(x, 0, 'E'); } c.paint(A, 0, -210); });
    B.sprite('fan', { w: 1160, h: 520, ox: 580, oy: 440, n: 6, res: RES }, (A, ph) => { const c = new Chart(116, 52); c.org(58, 43); fan(c, 1, ph); c.paint(A, -580, -440); });
    B.sprite('fanOpen', { w: 1160, h: 520, ox: 580, oy: 440, n: 10, res: RES }, (A, ph, i) => { const c = new Chart(116, 52); c.org(58, 43); fan(c, lerp(0.12, 1, ease.out2(i / 9)), i / 9 * 0.5); c.paint(A, -580, -440); });
    B.sprite('bird', { w: 600, h: 560, ox: 280, oy: 330, n: 4, res: RES }, (A, ph) => { const c = new Chart(60, 56); c.org(28, 33); bird(c, ph); c.outline('K').outline('W').outline('W').paint(A, -280, -330); });
    const W = [{ sk: 'R', v: 'K', up: 2, hk: 1 }, { sk: 'B', v: 'D', up: 0, ap: 'W' }, { sk: 'D', v: 'B', up: 2, hk: 1, hair: 'A' }, { sk: 'R', v: 'E', up: 0, hair: 'N' }];
    W.forEach((o, k) => B.sprite('woman' + k, { w: 460, h: 400, ox: 220, oy: 380, n: 8, res: RES }, (A, ph) => woman(ph, o).paint(A, -220, -380)));
    B.sprite('leaper', { w: 640, h: 580, ox: 320, oy: 480, n: 8, res: RES }, (A, ph) => leaper(ph).paint(A, -320, -480));
    B.sprite('bandura', { w: 340, h: 400, ox: 160, oy: 370, n: 4, res: RES }, (A, ph) => bandura(ph).paint(A, -160, -370));
    B.sprite('horse', { w: 340, h: 240, ox: 140, oy: 220, n: 6, res: RES }, (A, ph) => horse(ph).paint(A, -140, -220));
    B.sprite('stork', { w: 240, h: 160, ox: 100, oy: 150, n: 2, res: RES }, (A, ph) => stork(ph).paint(A, -100, -150)); B.sprite('bee', { w: 90, h: 70, ox: 45, oy: 35, n: 2, res: RES }, (A, ph, i) => bee(i).paint(A, -40, -30));
    B.sprite('dove', { w: 110, h: 90, ox: 50, oy: 90, n: 2, res: RES }, (A, ph, i) => { const c = new Chart(11, 9); c.blit(i ? DOVE2 : DOVE, 0, 0); c.paint(A, -50, -90); });
  },
  draw(g, t) {
    const rv = (a, b) => seg(t, a, b, ease.out2), S = { soft: 0.02, noise: 0, mode: 4, rvp: [10, 0.35, 0, 0], glow: 0.7 };
    g.layer('border', { rv: rv(-0.3, 0.9), ...S }); g.layer('trees', { rv: seg(t, -0.15, 1.8, ease.lin), ...S }); g.layer('fill', { rv: rv(0.4, 1.7), ...S }); g.layer('divider', { rv: seg(t, -0.1, 2.0, ease.lin), ...S }); g.layer('village', { rv: seg(t, -0.2, 2.0, ease.lin), ...S });
    for (const [x, f, b] of [[230, 0, 0], [430, 1, 0.5], [1490, 0, 0.3], [1690, 1, 0.8]]) g.sprite('dove', { x, y: 560, flip: !!f, ph: t * 1.6 + b, rv: x > 960 ? rv(0.4, 1) : rv(1.2, 2), ...S });
    for (const k of [-1, 1]) g.sprite('horse', { x: 960 + k * 310 + 10, y: 560, flip: k > 0, ph: t * 1.6 + (k > 0 ? 0.5 : 0), rv: k > 0 ? rv(0.6, 1.3) : rv(1.2, 1.9), ...S });
    const hx = 960, hy = 410; const op = seg(t, 1.25, 1.95, ease.lin);
    if (t > 1.2) { if (op < 1) g.sprite('fanOpen', { x: hx, y: hy, frame: Math.floor(op * 9.99), rv: seg(t, 1.2, 1.5), ...S }); else g.sprite('fan', { x: hx, y: hy, ph: t * 0.8 }); }
    g.sprite('bird', { x: hx, y: hy + 0, ph: t * 1.6, rv: seg(t, 0.95, 1.35, ease.out2), ...S });
    g.sprite('wheat', { x: 440, y: 960, ph: t * 0.8, rv: rv(0.3, 1.2), ...S }); g.sprite('stork', { x: 290, y: 680, ph: t * 3.2, rv: rv(1.6, 2.2), ...S });
    // ring of dancers; each pops in as the needle passes
    const beat = t / 0.625, pop = x => clamp((needleT(x) - 0.05 - 0) * 0 + seg(t, needleT(x), needleT(x) + 0.5, ease.out2));
    [[1290, 0], [1130, 1], [790, 2], [610, 3]].forEach(([x, k], i) => g.sprite('woman' + k, { x: sn(x + Math.sin(t * 1.0 + i) * 20), y: 950 - (Math.floor(beat * 2 + i) % 2) * 10, ph: t * 0.8 + i * 0.25, rv: pop(x), ...S }));
    { const ph = (t / 1.25 + 0.02) % 1, air = ph > 0.18 && ph < 0.82 ? Math.sin((ph - 0.18) / 0.64 * Math.PI) : 0; g.sprite('leaper', { x: 960, y: sn(950 - air * 60), ph, rv: pop(960), ...S }); }
    g.sprite('bandura', { x: 1430, y: 950, ph: t * 3.2, rv: pop(1480), ...S });
    for (const [x, y, p] of [[520, 210, 0], [1400, 240, 1.4], [470, 800, 2.2], [330, 330, 3.1], [1600, 330, 4.4]]) g.sprite('bee', { x: sn(x + Math.sin(t * 2.1 + p) * 40), y: sn(y + Math.sin(t * 3.3 + p * 2) * 24), ph: t * 6, flip: Math.cos(t * 2.1 + p) < 0, rv: rv(1.4, 2) });
    // ---- needle + thread
    const xt = needleX(t); const pt = (x, z) => [x, lineY(x), z];
    const tip = xt, eye = xt + NL, zT = airZ(tip), zE = Math.max(airZ(eye) * 0.6 + 30, zT * 0.5 + 16); const A = [tip, lineY(tip), zT], Bp = [eye, lineY(eye), zE];
    const pts = []; for (let x = 2040; x >= eye; x -= 8) { const k = seg(x - eye, 0, 220, ease.inOut2); pts.push([x, lineY(x) + (1 - k) * Math.sin(k * 6) * 4, lerp(zE, laidZ(x), k)]); } const ePt = [lerp(Bp[0], A[0], 0.03), lerp(Bp[1], A[1], 0.03), lerp(Bp[2], A[2], 0.03)]; if (pts.length) pts.push([ePt[0], ePt[1], ePt[2] + 3], [ePt[0] - 4, ePt[1] + 5, ePt[2] - 4]);
    if (pts.length > 2) g.thread(pts, { w: 10, hero: 1 });
    if (tip < 2100 && eye > -160) needle(g, A, Bp);
    // the cloth lifts where the needle pokes
    for (const [x, w] of [[tip + 8, 44], [tip + 90, 52]]) { const p = phi(x); if (p > 0.66) g.bump(x, lineY(x), w, 13 * Math.sin(clamp((p - 0.66) / 0.34) * Math.PI)); }
    for (let x = 960 + PER * 2; x > 100; x -= PER) { const t0 = needleT(x); g.burst(x, lineY(x), t0, { n: 16, speed: 150, life: 0.55, seed: Math.round(x) + 5, size: 2.4 }); }
    g.burst(960, 410, 1.3, { n: 110, speed: 620, life: 1.2, size: 3, seed: 77, col: [2.4, 1.1, 0.4] });
    for (let b = 2; b < 8; b++) for (const x of [780, 960, 1140]) g.burst(x, 948, b * 0.625, { n: 9, speed: 140, life: 0.5, size: 2.6, seed: b * 7 + x, spread: 2.4, dir: -Math.PI / 2, col: [0.8, 0.6, 0.35], add: 0.4 });
    g.drift({ n: 46, vx: -26, vy: 16, col: [0.75, 0.08, 0.08], a: 0.9, size: 5, kind: 2, add: 0, z0: 30, z1: 140, seed: 8 }); g.drift({ n: 40, vx: -14, vy: -10, col: [1.2, 0.85, 0.4], a: 0.4, size: 2 });
  },
  shots: [
    { end: 1.25, cam: (p, t) => ({ x: Math.min(1660 - p * 40, needleX(t) + lerp(110, 120, p)), y: lerp(590, 560, ease.in2(p)), w: lerp(560, 720, ease.in2(p)), tilt: lerp(0.5, 0.36, p), yaw: lerp(0.26, 0.02, p), aperture: 3.5 }) },
    { end: 3.125, cam: (p, t) => ({ x: 960, y: lerp(480, 540, ease.out2(p)), w: lerp(1180, 1900, ease.out(p)), tilt: lerp(0.16, 0.03, p), aperture: 2.5 }) },
    { end: 5, cam: (p, t) => ({ x: lerp(1080, 840, p), y: lerp(800, 790, p), w: lerp(760, 820, p), tilt: 0.16, yaw: lerp(0.1, -0.08, p), aperture: 4 }) },
  ],
};
const NK = [[0, 2040], [0.3125, 1800], [0.625, 1420], [0.9375, 1120], [1.25, 955], [1.5, 925], [1.875, 720], [2.5, 400], [3.1, -440]];
function needleX(t) { return key(t, NK.map(([a, b], i) => (i ? [a, b, ease.inOutSine] : [a, b]))); }
function needleT(x) { if (x >= 2040) return 0; let a = 0, b = 5; for (let i = 0; i < 26; i++) { const m = (a + b) / 2; if (needleX(m) > x) a = m; else b = m; } return b; }
// steel needle built from smooth thread rods: an invisible lead-in parks the ply pattern so the rod reads as polished metal
function rod(g, a, b, w, o = {}) { const L = 60000, n = 6, d = [0, 1, 2].map(k => b[k] - a[k]), len = Math.hypot(...d), e = (o.ext ?? 3) * w, a2 = [0, 1, 2].map(k => a[k] - d[k] / len * e), pts = [[a2[0] + L, a2[1], a2[2]]]; for (let i = 0; i <= n; i++) pts.push([0, 1, 2].map(k => lerp(a2[k], b[k], i / n))); g.thread(pts, { w, color: '#e4e9ec', color2: '#e4e9ec', gold: 1, ply: 2 * 1.5 / (L / w / 1.55), from: L, to: L + e + len + w * 0.5, glow: 0.10, headLen: 1, spark: 0, shadow: 0.95, ...o }); }
function needle(g, tip, eye) { const P = u => [0, 1, 2].map(k => lerp(tip[k], eye[k], u)), dx = eye[0] - tip[0], dy = eye[1] - tip[1], l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; const off = (p, d) => [p[0] + nx * d, p[1] + ny * d, p[2]];
  const up = (p, z) => [p[0], p[1], p[2] + z]; rod(g, P(0.86), P(0.46), 20, { ext: 0.3 }); const N = 15; for (let i = 0; i < N; i++) { const u0 = 0.54 * (1 - i / N), u1 = Math.max(0, u0 - 0.05), z = 0.6 + i * 0.55; rod(g, up(P(u0 + 0.02), z), up(P(u1), z + 0.2), 2.6 + 17 * Math.pow(u0 / 0.54, 0.75), { ext: 1 }); }
  for (const d of [-6.5, 6.5]) rod(g, up(off(P(0.99), d * 0.8), 2), up(off(P(0.76), d), 2), 8, { ext: 0.6 }); for (const d of [-1, 1]) rod(g, off(P(1.0), d * 9), off(P(0.985), -d * 8), 8, { ext: 0.4 }); }
