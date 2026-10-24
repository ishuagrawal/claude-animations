// Cel-anime kit: characters are flat fills + one hard shadow tone + small hard highlights, with a
// dark brown outline. Backgrounds (bg.js) are painted and never outlined — that split is the
// reference's signature (style bible: Form/Light).
import { P, mix, rgba } from './palette.js';
import { W } from './core.js';

// current px-per-unit of ctx in 1920-space (the scene canvas is supersampled)
export function unitPx(ctx) {
  const m = ctx.getTransform();
  return Math.hypot(m.a, m.b) / (ctx.canvas.width / W);
}

// Scene lighting shared by every cel part in a shot (shots call setLight; film.draw resets it).
// lx/ly: direction TO the light. rim: rim-light colour on the lit edge (null = none).
const LIGHT0 = { lx: 1, ly: -1, rim: null, rimK: 0.45, shadowTint: '#2e2450', deep: 0.32, lineWeight: 1 };
export const LIGHT = { ...LIGHT0 };
export function setLight(o = {}) { Object.assign(LIGHT, LIGHT0, o); }

// Outline with hand-drawn weight variation: a thin pass, plus a heavier pass nudged away from
// the light, so lines swell on the shadow side like inked cels. `px` is in 1920×1080 pixels.
export function ink(ctx, path, px = 4, color = P.line) {
  if (px <= 0) return;
  const u = unitPx(ctx);
  px *= LIGHT.lineWeight;
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = color;
  ctx.lineWidth = px * 0.72 / u;
  ctx.stroke(path);
  const off = px * 0.3 / u;
  ctx.translate(-LIGHT.lx * off, -LIGHT.ly * off);
  ctx.lineWidth = px * 0.92 / u;
  ctx.stroke(path);
  ctx.restore();
}

// Fill `inner` clipped to `shape` (cel shadow / highlight shapes drawn over a base fill)
export function clipFill(ctx, shape, inner, color) {
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = color;
  ctx.fill(inner);
  ctx.restore();
}

// Hard band: `shape` minus itself shifted by (dx,dy). Fast even-odd path for simple shapes;
// `complex` uses an offscreen layer so unions of overlapping sub-paths work.
let layer = null;
export function band(ctx, shape, color, dx, dy, complex = false) {
  if (!complex) {
    ctx.save();
    ctx.clip(shape);
    const q = new Path2D();
    q.rect(-1e5, -1e5, 2e5, 2e5);
    q.addPath(shape, new DOMMatrix([1, 0, 0, 1, dx, dy]));
    ctx.fillStyle = color;
    ctx.fill(q, 'evenodd');
    ctx.restore();
    return;
  }
  const c = ctx.canvas;
  if (!layer || layer.width !== c.width || layer.height !== c.height) layer = new OffscreenCanvas(c.width, c.height);
  const l = layer.getContext('2d');
  l.setTransform(1, 0, 0, 1, 0, 0);
  l.clearRect(0, 0, layer.width, layer.height);
  l.setTransform(ctx.getTransform());
  l.globalCompositeOperation = 'source-over';
  l.fillStyle = color;
  l.fill(shape);
  l.globalCompositeOperation = 'destination-out';
  const q = new Path2D();
  q.addPath(shape, new DOMMatrix([1, 0, 0, 1, dx, dy]));
  l.fill(q);
  l.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(layer, 0, 0);
  ctx.restore();
}

// A whole cel part: base, shadow band away from the scene light, a thin deep-shadow accent on the
// shadow edge, rim light on the lit edge, extra shadow/highlight shapes, weighted outline.
export function cel(ctx, shape, base, o = {}) {
  const { depth = 0.12, shapes = [], hl = null, hlShapes = [], line = 4, lineCol = P.line, noBand = false, complex = false, deep = true, rim = true } = o;
  const sh = o.sh || mix(base, LIGHT.shadowTint, 0.36);
  const lx = o.lx ?? LIGHT.lx, ly = o.ly ?? LIGHT.ly;
  ctx.fillStyle = base;
  ctx.fill(shape);
  if (!noBand && depth > 0) band(ctx, shape, sh, lx * depth, ly * depth, complex);
  for (const s of shapes) clipFill(ctx, shape, s, sh);
  if (deep && !noBand && depth > 0 && LIGHT.deep > 0) band(ctx, shape, mix(sh, LIGHT.shadowTint, LIGHT.deep), lx * depth * 0.3, ly * depth * 0.3, complex);
  if (rim && LIGHT.rim && depth > 0) band(ctx, shape, LIGHT.rim, -lx * depth * LIGHT.rimK, -ly * depth * LIGHT.rimK, complex);
  if (hlShapes.length) for (const s of hlShapes) clipFill(ctx, shape, s, hl || mix(base, P.white, 0.45));
  if (line) ink(ctx, shape, line, lineCol);
}

// Anime blush: three short diagonal strokes
export function blush(ctx, x, y, s, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = rgba('#ff6f7d', 0.55);
  ctx.beginPath(); ctx.ellipse(x, y, s * 1.3, s * 0.55, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#e0465a';
  ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(x + i * s * 0.55 - s * 0.18, y + s * 0.3); ctx.lineTo(x + i * s * 0.55 + s * 0.18, y - s * 0.3); ctx.stroke(); }
  ctx.restore();
}

// Anime sweat drop
export function sweat(ctx, x, y, s, a = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  const p = new Path2D();
  p.moveTo(x, y - s);
  p.quadraticCurveTo(x + s * 0.75, y + s * 0.1, x, y + s * 0.6);
  p.quadraticCurveTo(x - s * 0.75, y + s * 0.1, x, y - s);
  ctx.fillStyle = '#bfe8ff'; ctx.fill(p);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(x - s * 0.15, y + s * 0.1, s * 0.12, s * 0.22, 0.3, 0, Math.PI * 2); ctx.fill();
  ink(ctx, p, 3);
  ctx.restore();
}

// Anime lens-flare glint: a cross of thin rays + hexagon ghosts
export function glint(ctx, x, y, r, a = 1, rot = 0.3) {
  if (a <= 0 || r <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.rotate(rot);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,250,220,0.7)'); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.fillRect(-r * 0.5, -r * 0.5, r, r);
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (const [len, w, ang] of [[r * 2.2, r * 0.035, 0], [r * 1.4, r * 0.03, Math.PI / 2], [r * 0.9, r * 0.02, Math.PI / 4], [r * 0.9, r * 0.02, -Math.PI / 4]]) {
    ctx.save(); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(0, -w); ctx.lineTo(len, 0); ctx.lineTo(0, w); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
