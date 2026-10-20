// "Soft flat" kit: the reference's look — flat vector fills with airbrushed inner shading (darker lower/right
// edges, a lit upper/left edge) and soft blurred drop shadows cast down-right on the wall (the walls' radial
// spotlight lives in looks.js). Canvas shadow* values live in device pixels, so every helper converts from the
// current transform; callers stay in world/screen units.
import { rgba, lighten, darken } from './palette.js';

const OFF = 6000; // device px

// Inner shadow: darkens (or lights) the inside edge of `path` on the side opposite (dx, dy).
// b = [x0, y0, x1, y1]: the path's bounds in caller units. The shadow is cast by a frame just outside those
// bounds (blurring a huge frame costs seconds per shape), so pass them whenever you can.
let warned = false;
export function inner(ctx, path, color, blur, dx, dy, a = 1, b = null) {
  if (a <= 0) return;
  const m = ctx.getTransform(), s = Math.hypot(m.a, m.b);
  ctx.save();
  ctx.clip(path);
  const ring = new Path2D();
  if (b) {
    const pad = blur * 3 + Math.abs(dx) + Math.abs(dy) + 2;
    ring.rect(b[0] - pad, b[1] - pad, b[2] - b[0] + pad * 2, b[3] - b[1] + pad * 2);
  } else {
    if (!warned) { warned = true; console.warn('inner(): no bounds given (slow path)'); }
    const R = OFF / s;
    ring.rect(-R, -R, R * 2, R * 2);
  }
  ring.addPath(path);
  ctx.shadowColor = rgba(color, a);
  ctx.shadowBlur = blur * s;
  ctx.shadowOffsetX = dx * s; // screen-aligned: light always comes from the upper left
  ctx.shadowOffsetY = dy * s;
  ctx.fillStyle = '#000';
  ctx.fill(ring, 'evenodd');
  ctx.restore();
}

// Drop shadow only (the shape itself is not drawn): blurred copy offset by (dx, dy) in caller units.
export function drop(ctx, path, { dx = 6, dy = 10, blur = 18, color = '#000000', a = 0.25 } = {}) {
  if (a <= 0) return;
  const m = ctx.getTransform(), s = Math.hypot(m.a, m.b);
  ctx.save();
  ctx.shadowColor = rgba(color, a);
  ctx.shadowBlur = blur * s;
  const D = OFF / s;
  ctx.shadowOffsetX = m.a * D + dx * s;
  ctx.shadowOffsetY = m.b * D + dy * s;
  ctx.translate(-D, 0);
  ctx.fillStyle = '#000';
  ctx.fill(path);
  ctx.restore();
}

// The workhorse: a flat fill with soft inner shading. o.k scales the shading to the object size; o.b = bounds
// [x0, y0, x1, y1] (see inner()). shade: edge-darkening color, light: lit-edge color.
export function soft(ctx, path, base, o = {}) {
  const { k = 1, shade = darken(base, 0.28), light = lighten(base, 0.35), sa = 0.85, la = 0.55, grad = 0.1, b = null } = o;
  if (grad > 0) {
    // gentle top-to-bottom value ramp inside the fill (needs the path's vertical extent)
    const { y0 = b ? b[1] : -k * 30, y1 = b ? b[3] : k * 30 } = o;
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    g.addColorStop(0, lighten(base, grad));
    g.addColorStop(1, darken(base, grad));
    ctx.fillStyle = g;
  } else ctx.fillStyle = base;
  ctx.fill(path);
  inner(ctx, path, shade, 9 * k, -3 * k, -5 * k, sa, b);
  if (la > 0) inner(ctx, path, light, 6 * k, 2 * k, 3 * k, la, b);
}

// Soft shading for a UNION of overlapping pieces (e.g. Claude's body + rotated arms), where the even-odd trick
// in inner() would punch holes. Renders into an offscreen layer clipped to the device-space bounds of `b`
// ({x0, y0, x1, y1} in caller units): base fill, then edge bands = fill minus a blurred, offset copy.
const layers = [];
function layer(i, w, h) {
  if (!layers[i] || layers[i].width < w || layers[i].height < h) layers[i] = new OffscreenCanvas(Math.max(w, layers[i]?.width || 0), Math.max(h, layers[i]?.height || 0));
  const c = layers[i], x = c.getContext('2d');
  x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-over'; x.filter = 'none'; x.globalAlpha = 1;
  x.clearRect(0, 0, w, h);
  return [c, x];
}
export function softUnion(ctx, path, base, b, o = {}) {
  const { k = 1, shade = darken(base, 0.28), light = lighten(base, 0.35), sa = 0.85, la = 0.55, grad = 0.1, alpha = 1 } = o;
  const m = ctx.getTransform(), s = Math.hypot(m.a, m.b);
  const pad = 30 * k;
  const pts = [[b.x0 - pad, b.y0 - pad], [b.x1 + pad, b.y0 - pad], [b.x0 - pad, b.y1 + pad], [b.x1 + pad, b.y1 + pad]].map(([x, y]) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
  const bx = Math.floor(Math.min(...pts.map(p => p[0]))), by = Math.floor(Math.min(...pts.map(p => p[1])));
  const bw = Math.ceil(Math.max(...pts.map(p => p[0]))) - bx, bh = Math.ceil(Math.max(...pts.map(p => p[1]))) - by;
  if (bw <= 0 || bh <= 0 || bw > 8000 || bh > 8000) return;
  const local = (x, dx = 0, dy = 0) => { x.setTransform(m.a, m.b, m.c, m.d, m.e - bx + dx * s, m.f - by + dy * s); };
  const [L, lx] = layer(0, bw, bh);
  local(lx);
  if (grad > 0) {
    const g = lx.createLinearGradient(0, b.y0, 0, b.y1);
    g.addColorStop(0, lighten(base, grad)); g.addColorStop(1, darken(base, grad));
    lx.fillStyle = g;
  } else lx.fillStyle = base;
  lx.fill(path);
  const band = (col, a, blur, dx, dy) => {
    if (a <= 0) return;
    const [S, sx] = layer(1, bw, bh);
    local(sx); sx.fillStyle = col; sx.fill(path);
    sx.globalCompositeOperation = 'destination-out';
    sx.filter = `blur(${(blur * s).toFixed(2)}px)`;
    local(sx, dx, dy); sx.fill(path);
    sx.filter = 'none';
    lx.save(); lx.setTransform(1, 0, 0, 1, 0, 0); lx.globalCompositeOperation = 'source-atop'; lx.globalAlpha = a;
    lx.drawImage(S, 0, 0, bw, bh, 0, 0, bw, bh); lx.restore();
  };
  band(shade, sa, 9 * k, -3 * k, -5 * k);
  band(light, la, 6 * k, 2 * k, 3 * k);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha *= alpha;
  ctx.drawImage(L, 0, 0, bw, bh, bx, by, bw, bh);
  ctx.restore();
}
