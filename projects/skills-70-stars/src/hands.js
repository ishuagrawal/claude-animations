// The community's giant hands (the reference's maker hands: pastel skin, soft airbrushed shading, a few crease
// lines, white-ish nails, a soft drop shadow on the ground behind). Hand units: 1 = finger width.
import { P, rgba, mix, lighten, darken } from './palette.js';
import { soft, drop, softUnion } from './soft.js';

export const SKINS = {
  mint: [P.mint, P.mintDk],
  cream: [P.creamHand, P.creamHandDk],
  slate: [P.slate, P.slateDk],
  tan: [P.tan, P.tanDk],
  lilac: [P.lilac, P.lilacDk],
};

function capsule(x, y0, y1, w) {
  const p = new Path2D();
  p.roundRect(x - w / 2, y0, w, y1 - y0, [w / 2, w / 2, w * 0.18, w * 0.18]);
  return p;
}
function crease(ctx, x0, x1, y, bow, col, lw) {
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + bow, x1, y);
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.stroke();
}

// Pointing hand. (x, y) = fingertip, ang = pointing direction (radians, 0 = up/-y), s = px per finger width,
// curl 0..1 bends the finger tip (anticipation), press 0..1 squashes the pad (contact).
export function pointer(ctx, { x, y, ang = 0, s = 60, skin = 'mint', curl = 0, press = 0, shadow = true, flip = false } = {}) {
  const [base, dk] = SKINS[skin] || SKINS.mint;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(s * (flip ? -1 : 1), s);
  const L = 3.3 * (1 - press * 0.06);
  // forearm + fist + thumb + index as one silhouette
  const sil = new Path2D();
  const arm = new Path2D(); arm.roundRect(-1.05, 4.6, 2.9, 30, 1.2); sil.addPath(arm);
  const fist = new Path2D(); fist.roundRect(-0.62, 2.55, 2.75, 3.25, [0.9, 1.1, 0.8, 0.8]); sil.addPath(fist);
  const thumb = new Path2D(); thumb.roundRect(-0.98, 3.2, 0.95, 2.3, 0.47); sil.addPath(thumb);
  const index = new Path2D();
  index.addPath(capsule(0, -press * 0.1, L, 1), new DOMMatrix().rotate(-curl * 12));
  sil.addPath(index);
  if (shadow) drop(ctx, sil, { dx: 0.35, dy: 0.45, blur: 0.55, color: '#000000', a: 0.2 });
  softUnion(ctx, sil, base, { x0: -1.3, y0: -0.3, x1: 2.4, y1: 12 }, { k: 0.075, shade: dk, light: lighten(base, 0.45), sa: 0.9, la: 0.7, grad: 0.05 });
  // curled fingers (stacked knuckle pads on the fist), creases, nail
  ctx.save();
  ctx.rotate(-curl * 12 * Math.PI / 180);
  const nail = new Path2D(); nail.roundRect(-0.3, 0.12, 0.6, 0.78, [0.3, 0.3, 0.12, 0.12]);
  ctx.fillStyle = mix(base, P.nail, 0.55); ctx.fill(nail);
  ctx.fillStyle = rgba(dk, 0.35); ctx.fillRect(-0.3, 0.8, 0.6, 0.06);
  crease(ctx, -0.32, 0.32, 1.45, 0.08, rgba(dk, 0.7), 0.05);
  crease(ctx, -0.36, 0.36, 2.25, 0.1, rgba(dk, 0.7), 0.05);
  ctx.restore();
  // curled fingers: overlapping knuckle pads that read as one fist (gentle separation lines, no hard outlines)
  for (let i = 0; i < 3; i++) {
    const yy = 2.7 + i * 0.8;
    const k = new Path2D(); k.roundRect(0.48 + i * 0.06, yy, 1.52 - i * 0.04, 0.9, 0.42);
    soft(ctx, k, mix(base, dk, 0.06), { k: 0.045, shade: dk, sa: 0.42, la: 0.45, grad: 0, b: [0.48, yy, 2.05, yy + 0.9] });
  }
  crease(ctx, -0.85, -0.2, 4.4, -0.06, rgba(dk, 0.6), 0.05);
  ctx.restore();
}

// Gripping hand at a card's vertical edge. side -1 = left edge (hand comes from the left), +1 = right.
// Draw back() before the card and front() after it. (x, y) = the grip point on the edge; s = finger width.
export function grip(ctx, { x, y, s = 60, side = -1, skin = 'mint', part = 'front', shadow = true, ang = 0 } = {}) {
  const [base, dk] = SKINS[skin] || SKINS.mint;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.scale(s * side, s); // local +x points away from the card (outward)
  if (part === 'back') {
    const sil = new Path2D();
    const palm = new Path2D(); palm.roundRect(-0.4, -2.1, 3.6, 4.4, 1.3); sil.addPath(palm);
    const arm = new Path2D(); arm.roundRect(1.6, 0.2, 30, 2.8, 1.2); sil.addPath(arm, new DOMMatrix().rotate(28));
    if (shadow) drop(ctx, sil, { dx: -0.3 * side, dy: 0.5, blur: 0.6, a: 0.18 });
    softUnion(ctx, sil, darken(base, 0.06), { x0: -1, y0: -3, x1: 12, y1: 12 }, { k: 0.08, shade: dk, light: lighten(base, 0.35), sa: 0.9, la: 0.5, grad: 0.04 });
  } else {
    // four fingertips wrapping over the edge + thumb pad
    for (let i = 0; i < 4; i++) {
      const yy = -1.75 + i * 0.92;
      const f = new Path2D(); f.roundRect(-0.95, yy, 1.35, 0.84, [0.42, 0.2, 0.2, 0.42]);
      if (shadow) drop(ctx, f, { dx: 0.12 * -1, dy: 0.18, blur: 0.25, a: 0.25 });
      soft(ctx, f, base, { k: 0.05, shade: dk, sa: 0.8, la: 0.6, grad: 0, b: [-0.95, yy, 0.4, yy + 0.84] });
      const n = new Path2D(); n.roundRect(-0.9, yy + 0.16, 0.42, 0.52, 0.2);
      ctx.fillStyle = mix(base, P.nail, 0.5); ctx.fill(n);
    }
  }
  ctx.restore();
}
