// Claude mascot rig. Geometry measured from refs/claude-mascot.png (250x189):
// body 147 wide x 107 tall, side arms 35 x 36 starting 35 below the top, four 18-wide legs 37 tall,
// 17x17 eyes inset 19 from each side and 17 from the top. Units below are those reference pixels,
// origin at the ground point under the body's center.
import { P, mix } from './palette.js';
import { solid, rectP, union, glow, sparkle } from './draw.js';
import { clamp, TAU } from './core.js';

const BW = 147, BH = 107, LEG_H = 37, ARM_W = 35, ARM_H = 36, ARM_Y = 35, EYE = 17, EYE_X = 19, EYE_Y = 17;
const TOP = -(BH + LEG_H);
const LEG_X = [-73.5, -37.5, 19.5, 55.5];
const LEG_W = 18;
export const MASCOT = { BW, BH, LEG_H, HEIGHT: BH + LEG_H, WIDTH: BW + ARM_W * 2 };

export const defaults = {
  x: 0, y: 0, s: 147, sx: 1, sy: 1, rot: 0, shear: 0,
  legs: [0, 0, 0, 0], swing: [0, 0, 0, 0], legLen: 1,
  armL: 0, armR: 0, armLenL: 1, armLenR: 1,
  eyes: 'open', lx: 0, ly: 0, blink: 0, eyeScale: 1,
  sil: 0, silColor: P.ink, base: P.coral,
  sh: [P.coralDk, -14, 0], rim: [P.cream, 7, -4], rim2: null,
  glowEyes: 0, glowColor: P.lemon, catchlight: true, bevel: true, alpha: 1,
};

// Returns the transform used (DOMMatrix) and anchor points in caller space.
export function claude(ctx, o) {
  o = { ...defaults, ...o };
  const k = o.s / BW;
  const m = new DOMMatrix()
    .translate(o.x, o.y)
    .translate(0, TOP / 2 * k * o.sy)
    .rotate(o.rot * 180 / Math.PI)
    .translate(0, -TOP / 2 * k * o.sy)
    .scale(k * o.sx, k * o.sy)
    .multiply(new DOMMatrix([1, 0, -o.shear, 1, 0, 0]));

  // parts
  const body = rectP(-BW / 2, TOP, BW, BH + 1);
  const arm = (side, ang, len) => {
    const p = new Path2D();
    const px = side * BW / 2, py = TOP + ARM_Y + ARM_H / 2;
    const am = new DOMMatrix().translate(px, py).rotate((side < 0 ? ang : -ang) * 180 / Math.PI);
    const r = new Path2D();
    const L = ARM_W * len;
    r.rect(side < 0 ? -L : -6, -ARM_H / 2, L + 6, ARM_H);
    p.addPath(r, am);
    return { p, tip: am.transformPoint(new DOMPoint(side * L, 0)) };
  };
  const aL = arm(-1, o.armL, o.armLenL), aR = arm(1, o.armR, o.armLenR);
  const legs = LEG_X.map((lx, i) => rectP(lx + o.swing[i], -LEG_H * o.legLen - o.legs[i], LEG_W, LEG_H * o.legLen + 2));
  const shape = union(body, aL.p, aR.p, ...legs);

  const sil = clamp(o.sil);
  const base = sil > 0 ? mix(o.base, o.silColor, sil) : o.base;
  ctx.save();
  ctx.globalAlpha *= o.alpha;
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  solid(ctx, shape, base, {
    sh: o.sh && sil < 1 ? [sil > 0 ? mix(o.sh[0], o.silColor, sil) : o.sh[0], o.sh[1], o.sh[2]] : null,
    rim: o.rim ? o.rim : null,
    rim2: o.rim2,
  }, true);
  if (o.bevel && sil < 0.5) {
    // pixel-art bevel: a crisp lighter strip along the top edge
    ctx.fillStyle = mix(P.coralLt, base, sil * 2);
    ctx.globalAlpha *= 0.55;
    ctx.fillRect(-BW / 2 + 4, TOP, BW - 8, 4);
    ctx.globalAlpha /= 0.55;
  }
  drawEyes(ctx, o, sil);
  ctx.restore();

  const toCaller = p => { const q = m.transformPoint(p); return [q.x, q.y]; };
  return {
    m,
    handL: toCaller(aL.tip),
    handR: toCaller(aR.tip),
    top: toCaller(new DOMPoint(0, TOP)),
    center: toCaller(new DOMPoint(0, TOP / 2)),
    eyeL: toCaller(new DOMPoint(-BW / 2 + EYE_X + EYE / 2, TOP + EYE_Y + EYE / 2)),
    eyeR: toCaller(new DOMPoint(BW / 2 - EYE_X - EYE / 2, TOP + EYE_Y + EYE / 2)),
    feet: toCaller(new DOMPoint(0, 0)),
    k,
  };
}

function drawEyes(ctx, o, sil) {
  if (o.eyes === 'none') return;
  const lx = clamp(o.lx, -1, 1) * 4.5, ly = clamp(o.ly, -1, 1) * 4.5;
  const glowing = o.glowEyes > 0;
  const col = glowing ? mix(P.ink, o.glowColor, o.glowEyes) : P.ink;
  const es = o.eyeScale;
  for (const side of [-1, 1]) {
    const cx = side * (BW / 2 - EYE_X - EYE / 2) + lx;
    const cy = TOP + EYE_Y + EYE / 2 + ly;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(es, es);
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    const h = EYE * (1 - clamp(o.blink));
    switch (o.eyes) {
      case 'happy': {
        ctx.lineWidth = 5.5; ctx.lineJoin = 'miter'; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(-9, 5); ctx.lineTo(0, -5); ctx.lineTo(9, 5); ctx.stroke();
        break;
      }
      case 'closed': ctx.fillRect(-EYE / 2, 3, EYE, 4.5); break;
      case 'wide': {
        const s = 22;
        ctx.fillRect(-s / 2, -s / 2 + (EYE - h) / 2, s, s * (1 - clamp(o.blink)));
        if (o.catchlight && !glowing && h > 6) { ctx.fillStyle = P.cream; ctx.fillRect(-s / 2 + 3, -s / 2 + 3, 6, 6); }
        break;
      }
      case 'tiny': ctx.fillRect(-3.5, -3.5, 7, 7); break;
      case 'x': {
        ctx.lineWidth = 5; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(-8, -8); ctx.lineTo(8, 8); ctx.moveTo(8, -8); ctx.lineTo(-8, 8); ctx.stroke();
        break;
      }
      case 'squint': {
        // determined: inner corners down
        const inner = side < 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(-EYE / 2, -2 - inner * 3.5); ctx.lineTo(EYE / 2, -2 + inner * 3.5);
        ctx.lineTo(EYE / 2, EYE / 2); ctx.lineTo(-EYE / 2, EYE / 2); ctx.closePath(); ctx.fill();
        break;
      }
      case 'worried': {
        const inner = side < 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(-EYE / 2, -4 - inner * 3.5); ctx.lineTo(EYE / 2, -4 + inner * 3.5);
        ctx.lineTo(EYE / 2, EYE / 2); ctx.lineTo(-EYE / 2, EYE / 2); ctx.closePath(); ctx.fill();
        break;
      }
      case 'star': {
        sparkle(ctx, 0, 0, 12, col, 0);
        break;
      }
      default: {
        ctx.fillRect(-EYE / 2, -EYE / 2 + (EYE - h), EYE, h);
        if (o.catchlight && !glowing && h > 7) { ctx.fillStyle = sil > 0.5 ? P.ink3 : P.cream; ctx.fillRect(-EYE / 2 + 2.5, -EYE / 2 + 2.5 + (EYE - h), 5, 5); }
      }
    }
    ctx.restore();
    if (glowing) {
      const t = ctx.getTransform();
      ctx.save();
      glow(ctx, cx, cy, 34, o.glowColor, 0.55 * o.glowEyes);
      ctx.restore();
    }
  }
}

// pixel sweat drop near the top-right of the head
export function sweat(ctx, x, y, s, a = 1) {
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = P.sky;
  const u = s / 6;
  ctx.fillRect(x, y, u, u);
  ctx.fillRect(x - u, y + u, u * 3, u);
  ctx.fillRect(x - u, y + u * 2, u * 3, u * 1.2);
  ctx.fillStyle = P.cream;
  ctx.fillRect(x - u * 0.6, y + u * 1.3, u * 0.7, u * 0.7);
  ctx.restore();
}

// Walk/run cycle helper -> {legs, swing, bob}. phase in cycles; amp in ref units.
export function gait(phase, amp = 12, swingAmp = 6) {
  const legs = [], swing = [];
  for (let i = 0; i < 4; i++) {
    const ph = phase * TAU + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0);
    legs.push(Math.max(0, Math.sin(ph)) * amp);
    swing.push(Math.cos(ph) * swingAmp);
  }
  return { legs, swing, bob: Math.abs(Math.sin(phase * TAU * 2)) * amp * 0.25 };
}
