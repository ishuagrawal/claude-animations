// Grok Bot: an orange capsule whose two eyes sit on a sphere inside it. A gaze (yaw/pitch/roll) turns that sphere,
// so the eyes swing across the body and foreshorten like a head turning, and each face sets every eye's width,
// height, tilt and openness. The face table follows the grokbots.ai studio set as ported by Omabot
// (github.com/njpatel/omabot, Apache-2.0); the one-shot flourishes are timed like its hop, wiggle, pop, nod and
// celebrate.

export const ORANGE = '#EE922F';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;

// [yaw, pitch, roll, split, leftW, leftH, leftTilt, leftOpen, rightW, rightH, rightTilt, rightOpen]
// widths/heights are fractions of the eye sphere's radius, angles in degrees
export const FACES = {
  neutral:   [0,   0,   0, 15.46, 0.186, 0.412,   0, 1.0, 0.186, 0.412,   0, 1.0],
  attentive: [4,   5,  -4, 16.0,  0.21,  0.44,    0, 1.0, 0.21,  0.44,    0, 1.0],
  surprised: [3,  -3,   0, 19.0,  0.45,  0.47,    0, 1.0, 0.45,  0.47,    0, 1.0],
  excited:   [6, -14,   0, 19.5,  0.40,  0.56,  -10, 1.0, 0.40,  0.56,   10, 1.0],
  happy:     [5,   9,   0, 17.0,  0.27,  0.17,   14, 1.0, 0.27,  0.17,  -14, 1.0],
  delighted: [4,  14,   0, 18.0,  0.34,  0.13,   20, 1.0, 0.34,  0.13,  -20, 1.0],
  curious:   [16, -9, -15, 16.5,  0.24,  0.46,   -8, 1.0, 0.20,  0.38,   -8, 1.0],
  proud:     [5,  17,   0, 17.0,  0.30,  0.15,   18, 1.0, 0.30,  0.15,  -18, 1.0],
  shy:       [-19, -14, -7, 14.0, 0.17,  0.30,    0, 1.0, 0.17,  0.30,    0, 1.0],
  drowsy:    [6,  -9,  -3, 16.0,  0.20,  0.42,    0, 0.42, 0.20, 0.42,    0, 0.42],
};
export const mixFace = (a, b, k) => FACES[a].map((v, i) => lerp(v, FACES[b][i], k));
// The x.ai/bot guideline keeps faces understated (eyes only, small gaze turns, gentle wobble), so faces are worn at
// a fraction of their full strength: eye shapes pulled most of the way back toward neutral, gaze halved again.
export const calm = (face, k = 0.38) => face.map((v, i) => lerp(FACES.neutral[i], v, i < 3 ? k * 0.6 : k));

// ---------- easing for flourishes ----------
const E = {
  linear: k => k,
  outQuad: k => 1 - (1 - k) * (1 - k),
  inQuad: k => k * k,
  inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
  outBack: k => 1 + 2.70158 * Math.pow(k - 1, 3) + 1.70158 * Math.pow(k - 1, 2),
  inOutBack: k => {
    const c = 1.70158 * 1.525;
    return k < 0.5 ? (Math.pow(2 * k, 2) * ((c + 1) * 2 * k - c)) / 2 : (Math.pow(2 * k - 2, 2) * ((c + 1) * (k * 2 - 2) + c) + 2) / 2;
  },
  outBounce: k => {
    const n = 7.5625, d = 2.75;
    if (k < 1 / d) return n * k * k;
    if (k < 2 / d) return n * (k -= 1.5 / d) * k + 0.75;
    if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + 0.9375;
    return n * (k -= 2.625 / d) * k + 0.984375;
  },
};
// A property track: [[seconds, target, ease], ...] starting from `from`.
function track(dt, from, segs) {
  let v = from;
  for (const [d, to, ease] of segs) {
    if (dt < d) return lerp(v, to, E[ease](clamp(dt / d)));
    dt -= d;
    v = to;
  }
  return v;
}
// One-shot flourishes. u = body height (bounce distances scale with it). Returns additive offsets.
export function flourish(kind, dt, u) {
  const o = { bounce: 0, tilt: 0, pop: 1, squash: 0, spin: 0, yaw: 0, pitch: 0 };
  if (dt < 0) return o;
  switch (kind) {
    case 'hop':
      o.bounce = track(dt, 0, [[0.34, -u * 0.3, 'outQuad'], [0.56, 0, 'outBounce']]);
      o.squash = track(dt, 0, [[0.12, -0.07, 'outQuad'], [0.22, 0, 'outQuad'], [0.1, 0.06, 'outQuad'], [0.28, 0, 'outBack']]);
      break;
    case 'wiggle':
      o.tilt = track(dt, 0, [[0.26, 6, 'inOutSine'], [0.32, -5, 'inOutSine'], [0.28, 3, 'inOutSine'], [0.32, 0, 'outBack']]);
      break;
    case 'pop':
      o.pop = track(dt, 1, [[0.22, 1.07, 'outBack'], [0.5, 1, 'outBack']]);
      o.squash = track(dt, 0, [[0.22, -0.05, 'outQuad'], [0.5, 0, 'outBack']]);
      break;
    case 'nod':
      o.pitch = track(dt, 0, [[0.3, -9, 'inOutSine'], [0.4, -9, 'linear'], [0.4, 0, 'inOutSine']]);
      o.squash = track(dt, 0, [[0.3, 0, 'linear'], [0.18, 0.05, 'outQuad'], [0.3, 0, 'outBack']]);
      break;
    case 'celebrate':
      // a happy double hop (the guideline's 'happy' is a hop; no spins)
      o.bounce = track(dt, 0, [[0.22, -u * 0.32, 'outQuad'], [0.3, 0, 'outBounce'], [0.2, -u * 0.18, 'outQuad'], [0.3, 0, 'outBounce']]);
      o.pop = track(dt, 1, [[0.22, 1.06, 'outQuad'], [0.5, 1, 'outBack']]);
      break;
    case 'shake':
      o.tilt = track(dt, 0, [[0.08, -4, 'outQuad'], [0.12, 4, 'inOutSine'], [0.12, -2.5, 'inOutSine'], [0.1, 0, 'outQuad']]);
      break;
  }
  return o;
}

// Rotate two orthogonal basis vectors about their shared normal.
function spin2(a, b, ang) {
  const c = Math.cos(ang), s = Math.sin(ang);
  return [[a[0] * c + b[0] * s, a[1] * c + b[1] * s, a[2] * c + b[2] * s], [b[0] * c - a[0] * s, b[1] * c - a[1] * s, b[2] * c - a[2] * s]];
}
const rad = d => (d * Math.PI) / 180;

// Bean silhouette for when it is flying: hull of two end circles, one smaller (bean > 0: right end smaller).
function bodyPath(ctx, w, h, bean) {
  ctx.beginPath();
  if (!bean) { ctx.roundRect(-w / 2, -h / 2, w, h, Math.min(w, h) / 2); return; }
  const r1 = (h / 2) * (1 - 0.24 * Math.max(0, -bean)), r2 = (h / 2) * (1 - 0.24 * Math.max(0, bean));
  const c1 = -w / 2 + r1, c2 = w / 2 - r2;
  const nx = clamp((r1 - r2) / Math.max(1e-3, c2 - c1), -0.99, 0.99), ny = Math.sqrt(1 - nx * nx);
  const up = Math.atan2(-ny, nx), down = Math.atan2(ny, nx);
  ctx.moveTo(c1 + r1 * nx, -r1 * ny);
  ctx.lineTo(c2 + r2 * nx, -r2 * ny);
  ctx.arc(c2, 0, r2, up, down);
  ctx.lineTo(c1 + r1 * nx, r1 * ny);
  ctx.arc(c1, 0, r1, down, up + Math.PI * 2);
  ctx.closePath();
}

// Draws the bot centred at (x, y). face = pose array (FACES entry or a mix); yaw/pitch/roll add to the face's own
// gaze; blink 0 open .. 1 shut; f = flourish offsets; eyes = 0..1 fades the eyes (when it becomes the search bar).
export function drawBot(ctx, { x, y, w, h, face = FACES.neutral, yaw = 0, pitch = 0, roll = 0, blink = 0, rot = 0,
  sx = 1, sy = 1, bean = 0, eyes = 1, alpha = 1, color = ORANGE, f = null }) {
  const fl = f || flourish(null, 0, h);
  const pop = fl.pop, squash = fl.squash;
  const W = w * sx * pop * (1 + squash), H = h * sy * pop * (1 - squash * 0.85);
  if (W <= 0.5 || H <= 0.5) return;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(x, y + fl.bounce + (h - H) / 2 * 0.6); // squashes settle onto what it stands on
  ctx.rotate(rot + rad(fl.tilt + fl.spin + roll * 0.25));
  ctx.fillStyle = color;
  bodyPath(ctx, W, H, bean);
  ctx.fill();
  if (eyes > 0) {
    ctx.globalAlpha *= clamp(eyes * 1.5);
    ctx.fillStyle = '#fff';
    // the eye sphere: centred a touch left of the body's middle, sized to the body's height
    const R = 0.9 * H, cx = -0.03 * W;
    let fwd = [0, 0, 1], right = [1, 0, 0], up = [0, 1, 0], p;
    p = spin2(fwd, right, rad(face[0] + yaw + fl.yaw)); fwd = p[0]; right = p[1];
    p = spin2(up, fwd, rad(face[1] + pitch + fl.pitch)); up = p[0]; fwd = p[1];
    p = spin2(right, up, rad(face[2] + roll)); right = p[0]; up = p[1];
    for (const side of [-1, 1]) {
      const q = spin2(fwd, right, rad(face[3] * side));
      const e = { x: q[0][0] * R * 0.92, y: q[0][1] * R * 0.92, ax: q[1][0], ay: q[1][1], depth: q[0][2] };
      if (e.depth < -0.1) continue;
      const b = side < 0 ? 4 : 8;
      const fore = Math.max(0.22, 0.55 + 0.45 * e.depth);
      const open = face[b + 3] * (1 - blink);
      const hw = Math.max(0.6, face[b] * R * 0.5 * fore), hh = Math.max(0.5, face[b + 1] * R * 0.5 * Math.max(0.06, open));
      ctx.save();
      ctx.translate(cx + e.x, e.y);
      ctx.rotate(Math.atan2(e.ay, e.ax) + rad(face[b + 2]));
      ctx.beginPath();
      ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  ctx.restore();
}
