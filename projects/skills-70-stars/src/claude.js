// Claude rig, measured from refs/claude-mascot.png (250×189 px, body #da7758 on #f2f3ee):
//   torso x 52–198 (147 wide) y 17–124 (107 tall) · arms x 15–51 / 199–231, y 52–87 (36×36)
//   legs 4 × ~18 wide, y 124–162, outer centers ±64 and inner ±28 about x 125 · eyes 17×17 black, y 34–50,
//   centers ±45 about x 125. Rig units = source pixels, origin at the feet (125, 163).
// The rig only produces geometry; `style` picks the rendering model (soft flat / pixel flat / ink / neon).
import { P, rgba, mix, lighten } from './palette.js';
import { softUnion, drop } from './soft.js';
import { hash } from './core.js';

const BODY = { x: -73.5, y: -146, w: 147, h: 107 };
const ARM = { w: 36, h: 36, y: -111 };
const LEGS = [-64, -28, 28, 64];
const LEG = { w: 18, h: 39 };
const EYE = { s: 17, y: -121, x: 45 };

// pose → local transform + part rectangles
function parts(o, clean = false) {
  const { arms = [0, 0], legs = [0, 0, 0, 0], armLen = 1 } = o;
  const rects = [];
  rects.push({ x: BODY.x, y: BODY.y, w: BODY.w, h: BODY.h });
  // arms pivot on their top-inner corner; positive raise lifts the outer end
  // arms (blocks): a raise v slides the block up the body side (v·30 px) and tips its outer end up (v·0.38 rad);
  // each reaches 24 px into the body so a tipped arm stays attached
  const aw = ARM.w * armLen, hh = ARM.h / 2;
  const lift = v => Math.min(v, 1.6) * 30, tip = v => v * 0.38;
  if (clean) { // line/pixel styles: arms only slide, and never overlap the body (no inner outlines)
    rects.push({ x: -aw, y: -hh, w: aw, h: ARM.h, px: BODY.x, py: ARM.y + hh - lift(arms[0]), rot: 0 });
    rects.push({ x: 0, y: -hh, w: aw, h: ARM.h, px: -BODY.x, py: ARM.y + hh - lift(arms[1]), rot: 0 });
  } else {
    rects.push({ x: -aw, y: -hh, w: aw + 24, h: ARM.h, px: BODY.x, py: ARM.y + hh - lift(arms[0]), rot: tip(arms[0]) });
    rects.push({ x: -24, y: -hh, w: aw + 24, h: ARM.h, px: -BODY.x, py: ARM.y + hh - lift(arms[1]), rot: -tip(arms[1]) });
  }
  LEGS.forEach((cx, i) => {
    const lift = legs[i] || 0;
    rects.push({ x: cx - LEG.w / 2, y: -LEG.h - 1, w: LEG.w, h: LEG.h + 1 - lift });
  });
  return rects;
}
function rectPath(r, path = new Path2D()) {
  const m = new DOMMatrix().translate(r.px || 0, r.py || 0).rotate((r.rot || 0) * 180 / Math.PI);
  const q = new Path2D(); q.rect(r.x, r.y, r.w, r.h);
  path.addPath(q, m);
  return path;
}

// eye shapes in local units; mode: open | closed | happy | wide | star | none; look [-1..1, -1..1]
function eyePaths(o) {
  const { eyes = 'open', look = [0, 0], blink = 0 } = o;
  const out = [];
  const lx = look[0] * 7, ly = look[1] * 6;
  for (const sgn of [-1, 1]) {
    const cx = sgn * EYE.x + lx, cy = EYE.y + ly, s = EYE.s;
    const p = new Path2D();
    const b = eyes === 'open' || eyes === 'wide' ? blink : 0;
    if (eyes === 'none') continue;
    if (eyes === 'closed' || b > 0.85) p.rect(cx - s / 2, cy + 1, s, 4);
    else if (eyes === 'happy') {
      // ^ made of three blocks (stays on the mascot's pixel grid)
      const u = s / 3;
      p.rect(cx - s / 2 - 1, cy, u + 1, u + 1);
      p.rect(cx - u / 2, cy - u, u, u + 1);
      p.rect(cx + s / 2 - u, cy, u + 1, u + 1);
    } else if (eyes === 'star') {
      const R = s * 0.85, r = R * 0.45;
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r : R;
        i ? p.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : p.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
      }
      p.closePath();
    } else {
      const k = eyes === 'wide' ? 1.25 : 1;
      const h = s * k * (1 - b);
      p.rect(cx - s * k / 2, cy - h / 2, s * k, Math.max(3, h));
    }
    out.push(p);
  }
  return out;
}

// Draw Claude. o: x, y (feet), s (world units per rig px), sx/sy squash about the feet, rot (about the body
// center), lean (shear), arms [l, r] raise 0..1.6, legs [4 lifts], eyes, look [x, y], blink, style ('soft'|'flat'|'ink'|'neon'),
// alpha, shadow (soft drop shadow on the wall behind), t (for ink boil)
export function claude(ctx, o) {
  const { x = 0, y = 0, s = 1, sx = 1, sy = 1, rot = 0, lean = 0, style = 'soft', alpha = 1, shadow = true, t = 0 } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.transform(1, 0, lean, 1, 0, 0);
  ctx.scale(sx, sy);
  if (rot) { ctx.translate(0, -92); ctx.rotate(rot); ctx.translate(0, 92); }
  const rs = parts(o, style !== 'soft');
  const body = new Path2D();
  rs.forEach(r => rectPath(r, body));
  const eyes = eyePaths(o);
  const bounds = { x0: -150, y0: -200, x1: 150, y1: 10 };
  ctx.globalAlpha *= alpha;
  if (style === 'soft') {
    if (shadow) drop(ctx, body, { dx: 14, dy: 12, blur: 22, color: '#000000', a: 0.18 * (o.shadowA ?? 1) });
    softUnion(ctx, body, P.coral, bounds, { k: 2.2, shade: P.coralDk, light: P.coralLt, sa: 0.8, la: 0.6, grad: 0.06 });
    eyes.forEach(e => { ctx.fillStyle = o.eyes === 'star' ? P.goldLt : P.eye; ctx.fill(e); });
    if (o.eyes === 'star') eyes.forEach(e => { ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke(e); });
  } else if (style === 'flat') {
    ctx.fillStyle = P.coral; ctx.fill(body);
    eyes.forEach(e => { ctx.fillStyle = o.eyes === 'star' ? P.goldLt : P.eye; ctx.fill(e); });
  } else if (style === 'ink') {
    inkClaude(ctx, rs, eyes, t, o);
  } else if (style === 'neon') {
    neonClaude(ctx, body, eyes, o);
  }
  ctx.restore();
}

// ---- ink-sketch rendering: off-register coral wash + boiling ink lines + hatching on the shade side
function jitterRect(r, seed, amt) {
  // each edge drawn as a slightly bowed stroke that overshoots its corners (hand-drawn)
  const j = i => (hash(seed * 97 + i) - 0.5) * 2 * amt;
  const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const p = new Path2D();
  for (let i = 0; i < 4; i++) {
    const a = pts[i], b = pts[(i + 1) % 4];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, ov = 3 + hash(seed + i) * 4;
    p.moveTo(a[0] - ux * ov + j(i * 4), a[1] - uy * ov + j(i * 4 + 1));
    p.quadraticCurveTo((a[0] + b[0]) / 2 + j(i * 4 + 2) * 1.6 - uy * j(i + 9), (a[1] + b[1]) / 2 + j(i * 4 + 3) * 1.6 + ux * j(i + 9), b[0] + ux * ov + j(i * 4 + 5), b[1] + uy * ov + j(i * 4 + 6));
  }
  return p;
}
export function boilSeed(t, fps = 8) { return Math.floor(t * fps + 1e-6); }
function inkClaude(ctx, rs, eyes, t, o) {
  const seed = boilSeed(t);
  // wash, offset from the lines like a quick watercolor fill
  ctx.save();
  ctx.translate(4, 3);
  const wash = new Path2D();
  rs.forEach(r => rectPath(r, wash));
  ctx.fillStyle = rgba(P.coral, 0.85);
  ctx.fill(wash);
  ctx.restore();
  // hatching on the lower-right of the body
  ctx.save();
  const clip = new Path2D(); rs.forEach(r => rectPath(r, clip));
  ctx.clip(clip);
  ctx.strokeStyle = rgba(P.ink, 0.4); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const xx = 30 + i * 9 + (hash(seed * 13 + i) - 0.5) * 3;
    ctx.beginPath(); ctx.moveTo(xx, -44); ctx.lineTo(xx + 26, -74); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 4.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  rs.forEach((r, i) => {
    ctx.save();
    if (r.px !== undefined) { ctx.translate(r.px, r.py); ctx.rotate(r.rot || 0); }
    ctx.stroke(jitterRect(r, seed * 31 + i, 2.2));
    ctx.restore();
  });
  eyes.forEach(e => { ctx.fillStyle = P.ink; ctx.fill(e); });
}

// ---- neon: dark body, coral tube outline with bloom, glowing eyes
function neonClaude(ctx, body, eyes, o) {
  ctx.fillStyle = mix(P.night, P.coral, 0.12);
  ctx.fill(body);
  ctx.save();
  ctx.lineJoin = 'round';
  const m = ctx.getTransform(), s = Math.hypot(m.a, m.b);
  for (const [w, a, blur] of [[16, 0.35, 40], [8, 0.8, 16], [4, 1, 0]]) {
    ctx.shadowColor = rgba(P.coral, a);
    ctx.shadowBlur = blur * s;
    ctx.strokeStyle = w === 4 ? lighten(P.coral, 0.55) : rgba(P.coral, a);
    ctx.lineWidth = w;
    ctx.stroke(body);
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = rgba(P.neonCyan, 0.9); ctx.shadowBlur = 18 * s;
  eyes.forEach(e => { ctx.fillStyle = lighten(P.neonCyan, 0.5); ctx.fill(e); });
  ctx.restore();
}
