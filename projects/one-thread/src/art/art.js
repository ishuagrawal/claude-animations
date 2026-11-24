// The dye painter. Every mark is painted twice: into `main` (dye colour + density) and into `aux`
// (R = reveal order 0..1, G = metal/gold 0..1, B = raised embroidery 0..1).
//
//   const A = new Art(w, h, scale)
//   A.part(path, { fill, under, halo, lines:[...], edge, order, gold, raise, alpha })
//   A.stroke(polyline, { w, color, taper, order, gold, raise })
//
// Style defaults can be scoped:  A.with({ raise:1, order:['lin',...] }, () => { ... })
import { trace, bbox, resample, plen, at, lerp, clamp } from './geom.js';
import { flowLines } from './flow.js';

let _tmp = null, _tmp2 = null;
function temp(w, h, second) {
  let c = second ? _tmp2 : _tmp;
  if (!c) { c = new OffscreenCanvas(w, h); c._x = c.getContext('2d'); if (second) _tmp2 = c; else _tmp = c; }
  if (c.width < w || c.height < h) { c.width = Math.max(c.width, w); c.height = Math.max(c.height, h); }
  const x = c._x; x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.clearRect(0, 0, w, h); return x;
}
// paint: css colour | [c0,c1,…] (auto vertical gradient over bbox) | {lin:[x0,y0,x1,y1], stops:[…]} | {rad:[x,y,r0,r1], stops} | CanvasPattern/Gradient
export function paint(ctx, f, b) {
  if (!f) return 'transparent';
  if (typeof f === 'string') return f;
  let g, st;
  if (Array.isArray(f)) { g = ctx.createLinearGradient(b.x, b.y, b.x, b.y1); st = f; }
  else if (f.lin) { g = ctx.createLinearGradient(...f.lin); st = f.stops; }
  else if (f.rad) { g = ctx.createRadialGradient(f.rad[0], f.rad[1], f.rad[2], f.rad[0], f.rad[1], f.rad[3]); st = f.stops; }
  else return f;
  st.forEach((c, i) => Array.isArray(c) ? g.addColorStop(c[0], c[1]) : g.addColorStop(st.length < 2 ? 0 : i / (st.length - 1), c));
  return g;
}
const b255 = v => Math.round(clamp(v) * 255);
// a tapered stroke polygon
export function taperPath(ctx, pl, w, t0 = 0, t1 = 0, prof) {
  const n = pl.length; if (n < 2) return;
  const L = [], R = []; let acc = 0; const tot = plen(pl) || 1;
  for (let i = 0; i < n; i++) {
    if (i) acc += Math.hypot(pl[i][0] - pl[i - 1][0], pl[i][1] - pl[i - 1][1]);
    const a = pl[Math.max(0, i - 1)], b = pl[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; dx /= l; dy /= l;
    const u = acc / tot; let k = 1;
    if (t0 > 0 && u < t0) k *= Math.sin(u / t0 * Math.PI / 2); if (t1 > 0 && u > 1 - t1) k *= Math.sin((1 - u) / t1 * Math.PI / 2);
    if (prof) k *= prof(u);
    const h = Math.max(0.05, w * k / 2); L.push([pl[i][0] - dy * h, pl[i][1] + dx * h]); R.push([pl[i][0] + dy * h, pl[i][1] - dx * h]);
  }
  ctx.moveTo(L[0][0], L[0][1]); for (let i = 1; i < n; i++) ctx.lineTo(L[i][0], L[i][1]);
  if (t1 <= 0) { const e = pl[n - 1], a = Math.atan2(L[n - 1][1] - e[1], L[n - 1][0] - e[0]); ctx.arc(e[0], e[1], Math.hypot(L[n - 1][0] - e[0], L[n - 1][1] - e[1]), a, a - Math.PI, true); }
  for (let i = n - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
  if (t0 <= 0) { const e = pl[0], a = Math.atan2(R[0][1] - e[1], R[0][0] - e[0]); ctx.arc(e[0], e[1], Math.hypot(R[0][0] - e[0], R[0][1] - e[1]), a, a - Math.PI, true); }
  ctx.closePath();
}
export class Art {
  constructor(w, h, scale = 1, { ox = 0, oy = 0, noAux = false } = {}) {
    this.w = w; this.h = h; this.s = scale; this.ox = ox; this.oy = oy;
    const W = Math.max(1, Math.round(w * scale)), H = Math.max(1, Math.round(h * scale));
    this.main = new OffscreenCanvas(W, H); this.aux = new OffscreenCanvas(W, H);
    this.m = this.main.getContext('2d'); this.a = this.aux.getContext('2d', { alpha: false });
    this.a.fillStyle = '#000'; this.a.fillRect(0, 0, W, H);
    for (const c of [this.m, this.a]) { c.setTransform(scale, 0, 0, scale, ox * scale, oy * scale); c.lineJoin = 'round'; c.lineCap = 'round'; }
    this.st = { halo: 3, order: 0.5, gold: 0, raise: 0, alpha: 1 };
  }
  with(o, fn) { const p = this.st; this.st = { ...p, ...o }; try { fn(this); } finally { this.st = p; } return this; }
  // run fn with a transform applied to everything painted inside (translate, rotate, scale)
  at(o, fn) {
    const { x = 0, y = 0, s = 1, sx = 1, sy = 1, r = 0 } = o;
    for (const c of [this.m, this.a]) { c.save(); c.translate(x, y); c.rotate(r); c.scale(s * sx, s * sy); }
    try { fn(this); } finally { for (const c of [this.m, this.a]) c.restore(); } return this;
  }
  _auxPaint(o) {
    const g = b255(o.gold), r = b255(o.raise), col = v => `rgb(${b255(v)},${g},${r})`, ord = o.order;
    if (typeof ord === 'number') return col(ord);
    const [k, ...q] = ord;
    if (k === 'lin') { const [x0, y0, x1, y1, a = 0, b = 1] = q, gr = this.a.createLinearGradient(x0, y0, x1, y1); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, col(lerp(a, b, i / 8))); return gr; }
    if (k === 'rad') { const [x, y, r0, r1, a = 0, b = 1] = q, gr = this.a.createRadialGradient(x, y, r0, x, y, r1); for (let i = 0; i <= 8; i++) gr.addColorStop(i / 8, col(lerp(a, b, i / 8))); return gr; }
    return col(0.5);
  }
  _auxFill(path, o, grow = 1.2) { const c = this.a; c.beginPath(); trace(c, path); const p = this._auxPaint(o); c.fillStyle = p; c.fill(o.rule || 'nonzero'); if (grow) { c.strokeStyle = p; c.lineWidth = grow; c.stroke(); } }
  // the main primitive: a dyed shape with carved / inked line work
  part(path, opt = {}) {
    if (path.length && typeof path[0][0] === 'number') path = [path];
    const o = { ...this.st, ...opt }, rule = o.rule || 'nonzero', b = bbox(path), m = this.m;
    if (!isFinite(b.w) || b.w <= 0) return this;
    const tf = m.getTransform(), sc = Math.hypot(tf.a, tf.b), pad = 3;
    const tw = Math.ceil(b.w * sc) + pad * 2, th = Math.ceil(b.h * sc) + pad * 2;
    const setup = x => { x.setTransform(sc, 0, 0, sc, pad - b.x * sc, pad - b.y * sc); x.lineJoin = 'round'; x.lineCap = 'round'; };
    const t = temp(tw, th); setup(t);
    t.beginPath(); trace(t, path); t.fillStyle = paint(t, o.fill, b); if (o.fill) t.fill(rule);
    for (const ls of o.lines || []) this._lines(t, path, ls, b, rule);
    if (o.edge) { t.globalCompositeOperation = 'source-atop'; t.strokeStyle = o.edge.color; t.lineWidth = o.edge.w * 2; t.beginPath(); trace(t, path); t.stroke(); t.globalCompositeOperation = 'source-over'; }
    // knock out what lies beneath (halo = the stencil gap)
    if (o.halo >= 0 && !o.noKnock) { m.save(); m.globalCompositeOperation = 'destination-out'; m.globalAlpha = 1; m.beginPath(); trace(m, path); m.fillStyle = '#000'; m.fill(rule); if (o.halo > 0) { m.strokeStyle = '#000'; m.lineWidth = o.halo * 2; m.stroke(); } m.restore(); }
    if (o.under) { m.save(); m.globalAlpha = o.alpha; m.beginPath(); trace(m, path); m.fillStyle = paint(m, o.under, b); m.fill(rule); m.restore(); }
    m.save(); m.globalAlpha = o.alpha; const back = 1 / sc;
    // draw temp → main in path space
    m.drawImage(t.canvas, 0, 0, tw, th, b.x - pad * back, b.y - pad * back, tw * back, th * back); m.restore();
    this._auxFill(path, { ...o, rule });
    return this;
  }
  _lines(t, path, ls, b, rule) {
    t.save();
    const carve = !ls.ink; t.globalCompositeOperation = carve ? 'destination-out' : 'source-atop';
    const ink = carve ? '#000' : paint(t, ls.ink, b); t.fillStyle = ink; t.strokeStyle = ink; t.globalAlpha = ls.alpha ?? 1;
    if (ls.flow) { const f = ls.flow, pls = flowLines(ls.path || path, f); const w = f.w ?? Math.max(1.5, f.gap * 0.28); t.beginPath(); for (const pl of pls) taperPath(t, pl, typeof w === 'function' ? w(pl) : w, f.taper ?? 0.18, f.taper1 ?? f.taper ?? 0.18, f.prof); t.fill(); }
    if (ls.strokes) { const tp = ls.taper ?? 0; t.beginPath(); for (const pl of ls.strokes) { if (tp || ls.prof) taperPath(t, pl.length < 6 ? resample(pl, 4) : pl, ls.w, ls.taper0 ?? tp, ls.taper1 ?? tp, ls.prof); } if (tp || ls.prof) t.fill(); else { t.lineWidth = ls.w; t.lineCap = ls.cap || 'round'; t.beginPath(); trace(t, ls.strokes); t.stroke(); } }
    if (ls.shape) { t.beginPath(); trace(t, ls.shape); t.fill(ls.rule || 'evenodd'); }
    if (ls.dots) { t.beginPath(); for (const [x, y, r] of ls.dots) { t.moveTo(x + r, y); t.arc(x, y, r, 0, 7); } t.fill(); }
    if (ls.pat) { t.beginPath(); trace(t, ls.clip || path); t.clip(rule); ls.pat(t, b); }
    t.restore();
  }
  // free stroke (ink on cloth). order may be {along:[a,b]} to draw itself on from start to end
  stroke(pl, opt = {}) {
    const o = { ...this.st, ...opt }, list = (pl.length && typeof pl[0][0] === 'number') ? [pl] : pl, m = this.m, w = o.w ?? 6;
    for (let q of list) {
      if (q.length < 2) continue; if (!q.open && q.length > 2) { q = [...q, q[0]]; q.open = true; }
      const tapered = o.taper || o.prof; if (tapered && q.length < 8) q = resample(q, Math.max(2, plen(q) / 24));
      const go = (c, extra) => { c.beginPath(); if (tapered) { taperPath(c, q, w + extra, o.taper0 ?? o.taper ?? 0, o.taper1 ?? o.taper ?? 0, o.prof); c.fill(); if (extra) { c.lineWidth = extra; } } else { trace(c, [Object.assign([...q], { open: true })]); c.lineWidth = w + extra; c.lineCap = o.cap || 'round'; c.lineJoin = o.join || 'round'; c.stroke(); } };
      if (o.halo > 0 && !o.noKnock) { m.save(); m.globalCompositeOperation = 'destination-out'; m.fillStyle = m.strokeStyle = '#000'; go(m, o.halo * 2); m.restore(); }
      m.save(); m.globalAlpha = o.alpha; m.fillStyle = m.strokeStyle = paint(m, o.color ?? o.fill ?? '#4a2a14', bbox([q])); go(m, 0); m.restore();
      const c = this.a;
      if (o.order && o.order.along) {
        const [A, B] = o.order.along, N = Math.min(160, Math.max(8, Math.ceil(plen(q) / 12))); c.lineCap = 'butt'; c.lineWidth = w + 2;
        for (let i = 0; i < N; i++) { c.strokeStyle = this._auxPaint({ ...o, order: lerp(A, B, (i + 0.5) / N) }); const p0 = at(q, Math.max(0, (i - 0.06) / N)), p1 = at(q, (i + 1.06) / N), pm = at(q, (i + 0.5) / N); c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(pm[0], pm[1]); c.lineTo(p1[0], p1[1]); c.stroke(); }
      } else { c.fillStyle = c.strokeStyle = this._auxPaint(o); go(c, 1.5); }
    }
    return this;
  }
  strokes(list, o) { for (const l of list) this.stroke(l, o); return this; }
  dots(list, opt = {}) { // list of [x,y,r]
    const o = { ...this.st, ...opt }, m = this.m, a = this.a, go = (c, g) => { c.beginPath(); for (const [x, y, r] of list) { c.moveTo(x + r + g, y); c.arc(x, y, r + g, 0, 7); } c.fill(); };
    if (o.halo > 0 && !o.noKnock) { m.save(); m.globalCompositeOperation = 'destination-out'; go(m, o.halo); m.restore(); }
    m.save(); m.globalAlpha = o.alpha; m.fillStyle = o.color ?? o.fill ?? '#4a2a14'; go(m, 0); m.restore();
    if (Array.isArray(o.order) && o.order[0] === 'each') { const [, f] = o.order; list.forEach((d, i) => { a.fillStyle = this._auxPaint({ ...o, order: typeof f === 'function' ? f(d, i, list.length) : i / list.length }); a.beginPath(); a.arc(d[0], d[1], d[2] + 0.8, 0, 7); a.fill(); }); }
    else { a.fillStyle = this._auxPaint(o); go(a, 0.8); } return this;
  }
  // raw pattern fill clipped to a path: fn(ctx, bbox) draws with ctx.fillStyle preset to color
  pattern(path, fn, opt = {}) {
    const o = { ...this.st, ...opt }; if (path.length && typeof path[0][0] === 'number') path = [path]; const b = bbox(path), m = this.m;
    if (o.bg) { this.part(path, { ...o, fill: o.bg, lines: [] }); }
    m.save(); m.globalAlpha = o.alpha; m.beginPath(); trace(m, path); m.clip(o.rule || 'nonzero'); m.fillStyle = m.strokeStyle = paint(m, o.color ?? '#4a2a14', b); fn(m, b); m.restore();
    this._auxFill(path, o, 0); return this;
  }
  text(str, x, y, opt = {}) {
    const o = { ...this.st, font: '48px "Noto Sans"', align: 'left', base: 'alphabetic', ...opt };
    const go = (c, p, sw) => { c.save(); c.font = o.font; c.textAlign = o.align; c.textBaseline = o.base; if (o.spacing) c.letterSpacing = o.spacing; if (o.dir) c.direction = o.dir; c.fillStyle = c.strokeStyle = p; if (sw) { c.lineWidth = sw; c.strokeText(str, x, y); } c.fillText(str, x, y); c.restore(); };
    if (o.halo > 0) { this.m.save(); this.m.globalCompositeOperation = 'destination-out'; go(this.m, '#000', o.halo * 2); this.m.restore(); }
    this.m.save(); this.m.globalAlpha = o.alpha; go(this.m, o.color ?? o.fill, o.bold || 0); this.m.restore(); go(this.a, this._auxPaint(o), 2); return this;
  }
  clear() { for (const c of [this.m]) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, this.main.width, this.main.height); c.restore(); } return this; }
}
