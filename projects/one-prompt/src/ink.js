import { CALM } from './calm.js';
// Illustration kit: flat silhouettes with airbrushed volume (soft inner shade and light), rim light, grain, glow and silk ribbons.
import { TAU, clamp, lerp, hash, rng, noise, ease, seg, smooth, key, spline, inv } from './core.js';
export { TAU, clamp, lerp, hash, rng, noise, ease, seg, smooth, key, spline, inv };

export const K = {
  ink: '#07041f', night0: '#080527', night1: '#120a4a', night2: '#24128a', indigo: '#2c1aa8', violet: '#6b3df5', lilac: '#b9a2ff', mist: '#d9ccff', plum: '#4a1180', wine: '#7a1a6e', magenta: '#e23c9a', coral: '#ff6b57', orange: '#ff9a45', sun: '#ffcf6b', cream: '#fff1dc',
  cyan: '#4be8ff', sky: '#62b2ff', blue: '#2f62ff', deep: '#0d1c86', white: '#ffffff', need: '#2ff0a6', need2: '#0aa487', extra: '#ffbf2e', extra2: '#ef7f12', choice: '#ff5bb0', choice2: '#c81f86',
};
export const CODE = { need: [K.need, K.need2, '#d6ffee'], extra: [K.extra, K.extra2, '#fff2cc'], choice: [K.choice, K.choice2, '#ffdcef'] };
const hx = h => parseInt(h.length === 4 ? h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h.slice(1, 7), 16);
export const rgba = (h, a) => { const p = hx(h); return `rgba(${(p >> 16) & 255},${(p >> 8) & 255},${p & 255},${a})`; };
export function mix(a, b, t) { const p = hx(a), q = hx(b), f = s => Math.round(((p >> s) & 255) * (1 - t) + ((q >> s) & 255) * t); return '#' + ((1 << 24) | (f(16) << 16) | (f(8) << 8) | f(0)).toString(16).slice(1); }

// ---- paths carry their bounds in .b
const B = (p, x, y, w, h) => ((p.b = [x, y, w, h]), p);
export const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return B(p, x, y, w, h); };
export const circ = (x, y, r) => { const p = new Path2D(); r = Math.max(0.01, r); p.arc(x, y, r, 0, TAU); return B(p, x - r, y - r, r * 2, r * 2); };
export const ell = (x, y, rx, ry, rot = 0) => { const p = new Path2D(); rx = Math.max(0.01, rx); ry = Math.max(0.01, ry); p.ellipse(x, y, rx, ry, rot, 0, TAU); const m = Math.max(rx, ry); return B(p, x - m, y - m, m * 2, m * 2); };
const bounds = pts => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; pts.forEach(([x, y]) => { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }); return [a, b, c - a, d - b]; };
export function poly(pts, r = 0) {
  const p = new Path2D(), n = pts.length;
  if (!r) pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  else for (let i = 0; i < n; i++) { const [ax, ay] = pts[(i + n - 1) % n], [bx, by] = pts[i], [cx, cy] = pts[(i + 1) % n], rad = Array.isArray(r) ? r[i] : r, la = Math.hypot(ax - bx, ay - by), lc = Math.hypot(cx - bx, cy - by), k = Math.min(rad, la / 2, lc / 2), s = [bx + (ax - bx) / la * k, by + (ay - by) / la * k], e = [bx + (cx - bx) / lc * k, by + (cy - by) / lc * k]; i ? p.lineTo(...s) : p.moveTo(...s); p.quadraticCurveTo(bx, by, ...e); }
  p.closePath(); return B(p, ...bounds(pts));
}
export function blob(pts) { const p = new Path2D(), n = pts.length, m = i => [(pts[i % n][0] + pts[(i + 1) % n][0]) / 2, (pts[i % n][1] + pts[(i + 1) % n][1]) / 2]; p.moveTo(...m(0)); for (let i = 1; i <= n; i++) p.quadraticCurveTo(...pts[i % n], ...m(i)); p.closePath(); return B(p, ...bounds(pts)); }
export function svg(d, pts) { const p = new Path2D(d); return B(p, ...(pts || [-500, -500, 1000, 1000])); }
export const union = (...ps) => { const q = new Path2D(); let a = 1e9, b = 1e9, c = -1e9, d = -1e9; ps.forEach(p => { q.addPath(p); a = Math.min(a, p.b[0]); b = Math.min(b, p.b[1]); c = Math.max(c, p.b[0] + p.b[2]); d = Math.max(d, p.b[1] + p.b[3]); }); return B(q, a, b, c - a, d - b); };

// ---- gradients
export function lg(x, x0, y0, x1, y1, st) { const g = x.createLinearGradient(x0, y0, x1, y1); st.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / Math.max(1, st.length - 1), s))); return g; }
export function rg(x, cx, cy, r, st, r0 = 0, fx = cx, fy = cy) { const g = x.createRadialGradient(fx, fy, r0, cx, cy, Math.max(r, r0 + 0.01)); st.forEach((s, i) => (Array.isArray(s) ? g.addColorStop(s[0], s[1]) : g.addColorStop(i / Math.max(1, st.length - 1), s))); return g; }
let NOISE = null; const noiseTile = () => { if (NOISE) return NOISE; const c = new OffscreenCanvas(384, 384), x = c.getContext('2d'), d = x.createImageData(384, 384), r = rng(99); for (let i = 0; i < d.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = Math.pow(r(), 2.2) * 255; } x.putImageData(d, 0, 0); return (NOISE = c); };
// soft inner shade: falls in from the edge that (dx,dy) points away from
export function inner(x, p, color, blur, dx = 0, dy = 0) {
  const m = x.getTransform(), s = Math.hypot(m.a, m.b), [bx, by, bw, bh] = p.b, pad = blur * 1.5 + Math.hypot(dx, dy) + 20; x.save(); x.clip(p); x.shadowColor = color; x.shadowBlur = blur * s; x.shadowOffsetX = m.a * dx + m.c * dy; x.shadowOffsetY = m.b * dx + m.d * dy;
  const q = new Path2D(); q.rect(bx - pad, by - pad, bw + pad * 2, bh + pad * 2); q.addPath(p); x.fillStyle = '#000'; x.fill(q, 'evenodd'); x.restore();
}
// ink(ctx, path, { f: colour | [colours], g: [x0,y0,x1,y1] (fractions of bounds) or r: [cx,cy,rad] (fractions), sh: [[colour,blur,dx,dy]...], drop: [colour,blur,dx,dy], rim: [colour,width,dx,dy], grain })
export function ink(x, p, o) {
  const [bx, by, bw, bh] = p.b; let f = o.f;
  if (Array.isArray(f)) { if (o.r) { const [cx, cy, rr2] = o.r; f = rg(x, bx + bw * cx, by + bh * cy, Math.max(bw, bh) * rr2, f); } else { const [a, b, c, d] = o.g || [0.2, 0, 0.8, 1]; f = lg(x, bx + bw * a, by + bh * b, bx + bw * c, by + bh * d, f); } }
  if (o.drop) { const m = x.getTransform(), s = Math.hypot(m.a, m.b); x.save(); x.shadowColor = o.drop[0]; x.shadowBlur = o.drop[1] * s; x.shadowOffsetX = (o.drop[2] || 0) * s; x.shadowOffsetY = (o.drop[3] || 0) * s; x.fillStyle = f; x.fill(p); x.restore(); } else { x.fillStyle = f; x.fill(p); }
  (o.sh || []).forEach(s => inner(x, p, ...s));
  if (o.rim) { const [c, w, dx, dy] = o.rim; x.save(); x.clip(p); const q = new Path2D(); q.addPath(p); q.addPath(p, new DOMMatrix([1, 0, 0, 1, -dx * w, -dy * w])); x.fillStyle = c; x.fill(q, 'evenodd'); x.restore(); }
  if (o.grain) { const m = x.getTransform(), s = Math.hypot(m.a, m.b), pt = x.createPattern(noiseTile(), 'repeat'); pt.setTransform(new DOMMatrix().scale(1.4 / s)); x.save(); x.globalAlpha *= o.grain; x.globalCompositeOperation = 'overlay'; x.fillStyle = pt; x.fill(p); x.restore(); }
}
export function glow(x, cx, cy, r, c, a = 1, op = 'lighter') { a *= CALM.glow; if (r <= 0 || a <= 0.002) return; x.save(); x.globalCompositeOperation = op; x.fillStyle = rg(x, cx, cy, r, [[0, rgba(c, a)], [0.25, rgba(c, a * 0.5)], [0.55, rgba(c, a * 0.14)], [1, rgba(c, 0)]]); x.fillRect(cx - r, cy - r, r * 2, r * 2); x.restore(); }
// soft volumetric beam: apex (x0,y0) width w0 to (x1,y1) width w1
export function beam(x, x0, y0, w0, x1, y1, w1, c, a = 0.4) { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l; x.save(); x.globalCompositeOperation = 'lighter'; for (let i = 0; i < 4; i++) { const k = 1 - i * 0.22; x.fillStyle = lg(x, x0, y0, x1, y1, [rgba(c, a * 0.3), rgba(c, a * 0.12), rgba(c, 0)]); x.beginPath(); x.moveTo(x0 + nx * w0 / 2 * k, y0 + ny * w0 / 2 * k); x.lineTo(x1 + nx * w1 / 2 * k, y1 + ny * w1 / 2 * k); x.lineTo(x1 - nx * w1 / 2 * k, y1 - ny * w1 / 2 * k); x.lineTo(x0 - nx * w0 / 2 * k, y0 - ny * w0 / 2 * k); x.fill(); } x.restore(); }
export function bg(x, st, ang = Math.PI / 2) { const c = Math.cos(ang), s = Math.sin(ang); x.fillStyle = lg(x, 960 - c * 1000, 540 - s * 600, 960 + c * 1000, 540 + s * 600, st); x.fillRect(-200, -200, 2320, 1480); }
export function shadowEll(x, cx, cy, rx, ry, c, a) { x.save(); x.translate(cx, cy); x.scale(1, ry / rx); x.fillStyle = rg(x, 0, 0, rx, [[0, rgba(c, a)], [0.55, rgba(c, a * 0.6)], [1, rgba(c, 0)]]); x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore(); }
// type
export const FONT = '"SF Pro Rounded", "SF Compact Rounded", ui-rounded, sans-serif', MONO = '"SF Mono", ui-monospace, Menlo, monospace';
export function font(x, size, o = {}) { x.font = `${o.w || 700} ${size}px ${o.mono ? MONO : FONT}`; x.letterSpacing = (o.track || 0) + 'px'; }
export function text(x, s, px, py, c, size, o = {}) { x.save(); font(x, size, o); x.textAlign = o.align || 'center'; x.textBaseline = o.base || 'middle'; x.fillStyle = c; x.fillText(s, px, py); const w = x.measureText(s).width; x.restore(); return w; }
export function tw(x, s, size, o = {}) { x.save(); font(x, size, o); const w = x.measureText(s).width; x.restore(); return w; }
// per-letter springing type; underline drawn by u (0..1). code: need|extra|choice
export function label(x, s, px, py, size, t, t0, t1, code, o = {}) {
  const a = t - t0, out = t1 == null ? 0 : clamp((t - t1) / 0.3); if (a <= 0 || out >= 1) return; const W = tw(x, s, size, { w: 800 }), x0 = o.align === 'l' ? px : o.align === 'r' ? px - W : px - W / 2; let cx = x0; x.save(); x.globalAlpha *= 1 - out; x.translate(0, -out * size * 0.35);
  x.save(); x.shadowColor = 'rgba(6,3,30,0.75)'; x.shadowBlur = size * 0.5 * x.getTransform().a; [...s].forEach((c, i) => { const w = tw(x, s.slice(0, i + 1), size, { w: 800 }) - tw(x, s.slice(0, i), size, { w: 800 }), k = ease.back(clamp((a - i * 0.022) / 0.34), 1.9); if (k > 0.01) { x.save(); x.translate(cx + w / 2, py + (1 - k) * size * 0.55); x.scale(k, k); text(x, c, 0, 0, o.c || '#fff', size, { w: 800 }); x.restore(); } cx += w; }); x.restore();
  if (code) { const u = ease.out3(clamp((a - 0.12) / 0.5)), [c0, c1] = CODE[code], y = py + size * 0.62, h = size * 0.12; if (u > 0) { glow(x, x0 + W * u, y, size * 1.1, c0, 0.5 * (1 - u) + 0.12); x.fillStyle = lg(x, x0, 0, x0 + W, 0, [c0, c1]); x.beginPath(); x.roundRect(x0, y - h / 2, Math.max(h, W * u), h, h / 2); x.fill(); } }
  x.restore();
}
// ---- silk ribbon through points. w(u) half width, tw(u) twist angle; draws back-to-front segments, from u0 to u1
export function ribbon(x, pt, o) {
  const n = o.n || 90, [c0, c1, c2] = o.c, u0 = o.u0 ?? 0, u1 = o.u1 ?? 1; if (u1 <= u0) return; const P = []; for (let i = 0; i <= n; i++) { const u = lerp(u0, u1, i / n), p = pt(u), q = pt(u + 0.004), dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy) || 1, t = o.twist(u), w = o.w(u) * (o.taper === false ? 1 : Math.pow(Math.sin(clamp((i / n)) * Math.PI), 0.55)); P.push({ x: p[0], y: p[1], nx: -dy / l, ny: dx / l, w: w * Math.cos(t), k: Math.cos(t), s: Math.sin(t), z: p[2] ?? 0 }); }
  if (o.glow) { x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round'; x.lineJoin = 'round'; const gs = x.getTransform().a; x.strokeStyle = rgba(c0, 0.4 * o.glow); x.shadowColor = rgba(c0, 0.9); x.shadowBlur = o.w(0.5) * 2.6 * gs; x.lineWidth = o.w(0.5) * 0.9; let pen = false; x.beginPath(); P.forEach(p => { if (o.z && !o.z(p.z)) { pen = false; return; } pen ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y); pen = true; }); x.stroke(); x.restore(); }
  for (let i = 0; i < n; i++) { const a = P[i], b = P[i + 1]; if (o.z && !o.z((a.z + b.z) / 2)) continue; const f = (a.k + b.k) / 2, sh = (a.s + b.s) / 2, lit = f > 0 ? mix(c0, c2, Math.pow(clamp(0.5 + sh * 0.6), 2.2) * 0.75) : mix(c1, c0, clamp(0.25 + sh * 0.3)); x.fillStyle = lit; x.strokeStyle = lit; x.lineWidth = 1.2; x.beginPath(); x.moveTo(a.x + a.nx * a.w, a.y + a.ny * a.w); x.lineTo(b.x + b.nx * b.w, b.y + b.ny * b.w); x.lineTo(b.x - b.nx * b.w, b.y - b.ny * b.w); x.lineTo(a.x - a.nx * a.w, a.y - a.ny * a.w); x.closePath(); x.fill(); x.stroke(); }
}
// ---- polyline with partial drawing (for one-line drawings)
export class Line {
  constructor(pts) { this.p = pts; this.L = [0]; for (let i = 1; i < pts.length; i++) this.L.push(this.L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); this.len = this.L[this.L.length - 1]; }
  at(u) { const s = clamp(u) * this.len; let lo = 0, hi = this.L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; this.L[m] <= s ? (lo = m) : (hi = m); } const k = (s - this.L[lo]) / Math.max(1e-6, this.L[hi] - this.L[lo]); return [lerp(this.p[lo][0], this.p[hi][0], k), lerp(this.p[lo][1], this.p[hi][1], k)]; }
  path(x, u0, u1) { const a = clamp(u0) * this.len, b = clamp(u1) * this.len; x.beginPath(); x.moveTo(...this.at(u0)); for (let i = 0; i < this.p.length; i++) if (this.L[i] > a && this.L[i] < b) x.lineTo(...this.p[i]); x.lineTo(...this.at(u1)); }
}
export const sampler = fn => { const out = []; fn({ M: (x, y) => out.push([x, y]), L: (x, y, n = 2) => { const [a, b] = out[out.length - 1]; for (let i = 1; i <= n; i++) out.push([lerp(a, x, i / n), lerp(b, y, i / n)]); }, Q: (cx, cy, x, y, n = 14) => { const [a, b] = out[out.length - 1]; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u * u * a + 2 * u * t * cx + t * t * x, u * u * b + 2 * u * t * cy + t * t * y]); } }, C: (c1x, c1y, c2x, c2y, x, y, n = 24) => { const [a, b] = out[out.length - 1]; for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; out.push([u ** 3 * a + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t ** 3 * x, u ** 3 * b + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t ** 3 * y]); } }, A: (cx, cy, r, a0, a1, n = 30, ry = r) => { for (let i = 0; i <= n; i++) { const t = lerp(a0, a1, i / n); out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * ry]); } } }); return out; };
export function sparkle(x, px, py, r, c = '#fff', a = 1) { a *= CALM.sparkle; r *= 0.75; if (r <= 0 || a <= 0.01) return; x.save(); x.translate(px, py); x.globalAlpha *= a; x.fillStyle = c; x.beginPath(); for (let i = 0; i < 4; i++) { const q = i * TAU / 4; x[i ? 'lineTo' : 'moveTo'](Math.cos(q) * r, Math.sin(q) * r); x.quadraticCurveTo(0, 0, Math.cos(q + TAU / 4) * r, Math.sin(q + TAU / 4) * r); } x.fill(); x.restore(); }
const CACHE = new Map();
export function cached(x, key, bx, by, w, h, fn, scale = 1.5, blur = 0) { let c = CACHE.get(key); if (!c) { const a = new OffscreenCanvas(Math.ceil(w * scale), Math.ceil(h * scale)), g = a.getContext('2d'); g.scale(scale, scale); g.translate(-bx, -by); fn(g); if (blur) { c = new OffscreenCanvas(a.width, a.height); const q = c.getContext('2d'); q.filter = `blur(${blur * scale}px)`; q.drawImage(a, 0, 0); } else c = a; CACHE.set(key, c); } x.drawImage(c, bx, by, w, h); }
// multiplane camera: a plane at depth d (1 = focal plane) seen from camera {x,y,z}; larger d = farther
export function plane(x, cam, d, fn) { const s = cam.zoom / Math.max(0.04, d - cam.z + 0); x.save(); x.translate(960, 540); x.rotate(cam.r || 0); x.scale(s, s); x.translate(-cam.x, -cam.y); fn(s); x.restore(); }
