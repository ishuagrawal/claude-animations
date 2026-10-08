// Claude mascot rig, drawn in the explainer's flat-vector language (flat coral fill, one hard
// shadow tone, stipple grain in the shadow, no outlines).
// Geometry measured from refs/claude-mascot.png (250x189, coral #da7758, eyes #000):
// body 147 wide x 107 tall, side arms 35 x 36 starting 35 below the top, four 18-wide legs 37 tall,
// 17x17 eyes inset 19 from each side and 17 from the top. Units = those reference pixels; origin
// at the ground point under the body's center. `s` = on-screen body width in px.
import { P, mix, rgba } from './palette.js';
import { union, rrP, sparkle } from './draw.js';
import { clamp, TAU, lerp } from './core.js';
import { sprayLinear } from './tex.js';

const BW = 147, BH = 107, LEG_H = 37, ARM_W = 35, ARM_H = 36, ARM_Y = 35, EYE = 17, EYE_X = 19, EYE_Y = 17;
const TOP = -(BH + LEG_H);
const LEG_X = [-73.5, -37.5, 19.5, 55.5];
const LEG_W = 18;
const R = 2.2; // corner rounding (vector-crafted, still blocky)
export const MASCOT = { BW, BH, LEG_H, HEIGHT: BH + LEG_H, WIDTH: BW + ARM_W * 2, TOP };

export const defaults = {
  x: 0, y: 0, s: 147, sx: 1, sy: 1, rot: 0, shear: 0,
  legs: [0, 0, 0, 0], swing: [0, 0, 0, 0], legLen: 1,
  armL: 0, armR: 0, armLenL: 1, armLenR: 1,
  eyes: 'open', eyeL: null, eyeR: null, lx: 0, ly: 0, blink: 0, eyeScale: 1, blush: 0,
  base: P.coral, shadow: P.coralDk, light: P.coralLt, alpha: 1, grain: 0.55,
};

const rp = (x, y, w, h, r = R) => rrP(x, y, w, h, r);

export function claudePath(o) {
  const body = rp(-BW / 2, TOP, BW, BH + 2);
  const arm = (side, ang, len) => {
    const p = new Path2D();
    const px = side * BW / 2, py = TOP + ARM_Y + ARM_H / 2;
    const am = new DOMMatrix().translate(px, py).rotate((side < 0 ? ang : -ang) * 180 / Math.PI);
    const L = ARM_W * len;
    p.addPath(rp(side < 0 ? -L : -8, -ARM_H / 2, L + 8, ARM_H), am);
    return { p, tip: am.transformPoint(new DOMPoint(side * (L - 6), 0)), am };
  };
  const aL = arm(-1, o.armL, o.armLenL), aR = arm(1, o.armR, o.armLenR);
  const legs = LEG_X.map((lx, i) => rp(lx + o.swing[i], -LEG_H * o.legLen - o.legs[i], LEG_W, LEG_H * o.legLen + 4));
  return { shape: union(body, aL.p, aR.p, ...legs), body, aL, aR, legs };
}

export function matrixOf(o) {
  const k = o.s / BW;
  return new DOMMatrix()
    .translate(o.x, o.y)
    .translate(0, TOP / 2 * k * o.sy)
    .rotate(o.rot * 180 / Math.PI)
    .translate(0, -TOP / 2 * k * o.sy)
    .scale(k * o.sx, k * o.sy)
    .multiply(new DOMMatrix([1, 0, -o.shear, 1, 0, 0]));
}

// Returns anchors in caller space.
export function claude(ctx, o) {
  o = { ...defaults, ...o };
  const m = matrixOf(o);
  const { shape, aL, aR } = claudePath(o);
  ctx.save();
  ctx.globalAlpha *= o.alpha;
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  // base
  ctx.fillStyle = o.base; ctx.fill(shape);
  // hard shadow shape on the right/bottom (light from top-left), drawn via an offscreen-free clip trick:
  ctx.save();
  ctx.clip(shape);
  ctx.fillStyle = o.shadow;
  // right side band of the body + undersides
  const sh = new Path2D();
  sh.rect(BW / 2 - 17, TOP - 10, 80, BH + LEG_H + 20);            // right body edge + right arm
  sh.rect(-BW / 2 - 60, TOP + ARM_Y + ARM_H - 9, BW + 120, 12);  // arm undersides
  sh.rect(-BW / 2 - 10, -LEG_H - 2, BW + 20, 9);                  // belly edge above the legs
  for (const lx of LEG_X) sh.rect(lx + LEG_W - 6, -LEG_H, 8, LEG_H + 10); // leg shade
  ctx.fill(sh);
  // stipple spray fading from the shadow edge into the lit side
  if (o.grain > 0) {
    const sp = sprayLinear(o.shadow);
    ctx.globalAlpha *= o.grain;
    ctx.save(); ctx.translate(BW / 2 - 17, TOP + BH / 2); ctx.rotate(Math.PI / 2);
    ctx.drawImage(sp, -BH * 0.75, 0, BH * 1.5, 46); ctx.restore();
    ctx.save(); ctx.translate(0, -LEG_H - 2); ctx.rotate(Math.PI);
    ctx.drawImage(sp, -BW * 0.6, 0, BW * 1.2, 26); ctx.restore();
    ctx.globalAlpha /= o.grain;
  }
  // top-left light edge
  ctx.fillStyle = o.light;
  ctx.globalAlpha *= 0.85;
  ctx.fillRect(-BW / 2 - 60, TOP - 4, BW + 60 - 17, 9);
  ctx.globalAlpha /= 0.85;
  ctx.restore();
  drawEyes(ctx, o);
  ctx.restore();

  const toC = p => { const q = m.transformPoint(p); return [q.x, q.y]; };
  return {
    m,
    handL: toC(aL.tip), handR: toC(aR.tip),
    top: toC(new DOMPoint(0, TOP)),
    center: toC(new DOMPoint(0, TOP + BH / 2)),
    eyeL: toC(new DOMPoint(-BW / 2 + EYE_X + EYE / 2, TOP + EYE_Y + EYE / 2)),
    eyeR: toC(new DOMPoint(BW / 2 - EYE_X - EYE / 2, TOP + EYE_Y + EYE / 2)),
    feet: toC(new DOMPoint(0, 0)),
    k: o.s / BW,
  };
}

export function drawEyes(ctx, o) {
  if (o.eyes === 'none') return;
  const lx = clamp(o.lx, -1, 1) * 6, ly = clamp(o.ly, -1, 1) * 5;
  for (const side of [-1, 1]) {
    const kind = (side < 0 ? o.eyeL : o.eyeR) || o.eyes;
    const cx = side * (BW / 2 - EYE_X - EYE / 2) + lx;
    const cy = TOP + EYE_Y + EYE / 2 + ly;
    // blush under the eyes
    if (o.blush > 0) {
      ctx.save();
      ctx.fillStyle = rgba(P.rose, 0.55 * o.blush);
      ctx.beginPath(); ctx.roundRect(cx - 12 + side * 3, cy + 15, 22, 9, 4.5); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(o.eyeScale, o.eyeScale);
    ctx.fillStyle = P.ink; ctx.strokeStyle = P.ink;
    const b = clamp(o.blink);
    switch (kind) {
      case 'happy': { // ^ ^
        ctx.lineWidth = 5.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-9, 4); ctx.lineTo(0, -5); ctx.lineTo(9, 4); ctx.stroke();
        break;
      }
      case 'closed': ctx.beginPath(); ctx.roundRect(-EYE / 2, 2, EYE, 4.5, 2); ctx.fill(); break;
      case 'wide': {
        const s = 22, h = s * (1 - b);
        ctx.fillRect(-s / 2, -s / 2 + (s - h), s, h);
        if (h > 8) { ctx.fillStyle = '#fff'; ctx.fillRect(-s / 2 + 3.5, -s / 2 + 3.5 + (s - h), 6, 6); }
        break;
      }
      case 'sparkle': { // delighted: big square eyes with catchlights
        const s = 21, h = s * (1 - b);
        ctx.fillRect(-s / 2, -s / 2 + (s - h), s, h);
        if (h > 8) {
          ctx.fillStyle = '#fff';
          ctx.fillRect(-s / 2 + 3, -s / 2 + 3 + (s - h), 7, 7);
          ctx.fillRect(s / 2 - 7, s / 2 - 7, 3.5, 3.5);
        }
        break;
      }
      case 'tiny': ctx.fillRect(-3.5, -3.5, 7, 7); break;
      case 'star': sparkle(ctx, 0, 0, 13, P.ink, 0); break;
      case 'heart': {
        ctx.fillStyle = P.rose;
        ctx.beginPath();
        ctx.moveTo(0, 9);
        ctx.bezierCurveTo(-14, -1, -10, -13, 0, -5);
        ctx.bezierCurveTo(10, -13, 14, -1, 0, 9);
        ctx.fill();
        break;
      }
      case 'squint': {
        const inner = side < 0 ? 1 : -1;
        ctx.beginPath();
        ctx.moveTo(-EYE / 2, -1 - inner * 3.5); ctx.lineTo(EYE / 2, -1 + inner * 3.5);
        ctx.lineTo(EYE / 2, EYE / 2); ctx.lineTo(-EYE / 2, EYE / 2); ctx.closePath(); ctx.fill();
        break;
      }
      case 'worried': {
        const inner = side < 0 ? -1 : 1;
        ctx.beginPath();
        ctx.moveTo(-EYE / 2, -3 - inner * 3.5); ctx.lineTo(EYE / 2, -3 + inner * 3.5);
        ctx.lineTo(EYE / 2, EYE / 2); ctx.lineTo(-EYE / 2, EYE / 2); ctx.closePath(); ctx.fill();
        break;
      }
      default: {
        const h = EYE * (1 - b);
        ctx.fillRect(-EYE / 2, -EYE / 2 + (EYE - h), EYE, Math.max(h, 2.5));
      }
    }
    ctx.restore();
  }
}

// Little hop: returns {y, sx, sy} for a jump between t0 and t0+dur with squash on take-off/landing.
export function hop(t, t0, dur, height) {
  const p = (t - t0) / dur;
  if (p < -0.25 || p > 1.35) return { y: 0, sx: 1, sy: 1 };
  if (p < 0) { const q = (p + 0.25) / 0.25; const s = Math.sin(q * Math.PI) * 0.12; return { y: 0, sx: 1 + s, sy: 1 - s }; } // anticipation
  if (p <= 1) { const y = -4 * height * p * (1 - p); const st = 0.1 * Math.cos(p * Math.PI); return { y, sx: 1 - Math.abs(st) * 0.6, sy: 1 + Math.abs(st) }; }
  const q = (p - 1) / 0.35; const s = Math.sin(q * Math.PI) * 0.16 * (1 - q * 0.5); return { y: 0, sx: 1 + s, sy: 1 - s }; // landing squash
}
// Idle breathing / bob on the beat
export function bob(t, beat = 0.5, amp = 0.025) { const ph = (t / beat) * TAU; return { sx: 1 - Math.sin(ph) * amp * 0.5, sy: 1 + Math.sin(ph) * amp }; }
export function blinkAt(t, times, dur = 0.14) { for (const b of times) { const d = t - b; if (d >= 0 && d < dur) return Math.sin(d / dur * Math.PI); } return 0; }
export function legsWalk(phase, amp = 10) {
  const legs = [];
  for (let i = 0; i < 4; i++) legs.push(Math.max(0, Math.sin(phase * TAU + (i % 2 ? Math.PI : 0))) * amp);
  return legs;
}
export { lerp, mix };
