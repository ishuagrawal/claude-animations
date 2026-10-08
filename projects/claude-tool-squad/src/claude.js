// Claude mascot rig. Geometry measured from refs/claude-mascot.png (250×189, coral #DA7758):
// body 147 wide × 107 tall (x 52–198, y 17–123), side arms ≈35 × 36 starting 35 below the top,
// four ≈18-wide legs 37 tall at x 52–68, 88–105, 142–159, 179–198, 18×18 black eyes inset 18 from
// each side and 17 from the top. Units are those reference pixels; origin = ground under the body.
// Two render modes: 'cel' (the anime restyle: outline, one hard shadow tone, highlights, eye
// catchlights) and 'pixel' (the original sprite on a 24×16 grid — the "pixel born" form).
import { P, mix } from './palette.js';
import { cel, ink, blush, sweat, band, clipFill, LIGHT } from './cel.js';
import { clamp, TAU } from './core.js';

const BW = 147, BH = 107, LEG_H = 37, ARM_W = 35, ARM_H = 36, ARM_Y = 35, EYE = 18, EYE_X = 18, EYE_Y = 17;
const TOP = -(BH + LEG_H);
const LEG_X = [-73.5, -37.5, 19.5, 55.5], LEG_W = 18;
export const MASCOT = { BW, BH, LEG_H, HEIGHT: BH + LEG_H, WIDTH: BW + ARM_W * 2 };

export const defaults = {
  x: 0, y: 0, s: 147, sx: 1, sy: 1, rot: 0, shear: 0,
  legs: [0, 0, 0, 0], swing: [0, 0, 0, 0],
  armL: 0, armR: 0, armLenL: 1, armLenR: 1,
  eyes: 'open', lx: 0, ly: 0, blink: 0, eyeScale: 1,
  mode: 'cel', reveal: 1, pixelGap: 0.12, pixelCol: P.coral,
  sil: 0, silColor: P.line, base: P.coral, shade: null, hl: P.coralLt,
  light: [1, -1], depth: 9, line: null, lineCol: P.line,
  blush: 0, sweat: 0, glowEyes: 0, alpha: 1, smear: 0, rim: null, // rim: [color, depth] light from the other side
  yaw: 0.26, pitch: 0.2, // 3/4 volume: side face (yaw ±1) and top face (pitch) of the block
};
const DEPTH = BW * 0.44;
const volume = o => {
  const ox = clamp(o.yaw, -1, 1) * DEPTH * 0.72;
  const oy = -clamp(o.pitch, 0, 1) * DEPTH * 0.55 - Math.abs(o.yaw) * DEPTH * 0.06;
  return [ox, oy];
};

const rr = (x, y, w, h, r) => { const p = new Path2D(); p.roundRect(x, y, w, h, r); return p; };

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
  const toCaller = (x, y) => { const q = m.transformPoint(new DOMPoint(x, y)); return [q.x, q.y]; };
  const anchors = {
    m,
    top: toCaller(0, TOP), center: toCaller(0, TOP / 2), feet: toCaller(0, 0),
    eyeL: toCaller(-BW / 2 + EYE_X + EYE / 2, TOP + EYE_Y + EYE / 2),
    eyeR: toCaller(BW / 2 - EYE_X - EYE / 2, TOP + EYE_Y + EYE / 2),
  };
  // arm geometry (pivot at the shoulder, mid-height of the arm, mid-depth of the block)
  const [vx, vy] = o.mode === 'pixel' ? [0, 0] : volume(o);
  const armGeo = (side, ang, len) => {
    const am = new DOMMatrix().translate(side * BW / 2 + vx * 0.5, TOP + ARM_Y + ARM_H / 2 + vy * 0.5).rotate(-side * ang * 180 / Math.PI);
    const L = ARM_W * len;
    const r = rr(side < 0 ? -L : -8, -ARM_H / 2, L + 8, ARM_H, 5);
    const p = new Path2D(); p.addPath(r, am);
    const tip = am.transformPoint(new DOMPoint(side * L, 0));
    return { p, am, tip };
  };
  const aL = armGeo(-1, o.armL, o.armLenL), aR = armGeo(1, o.armR, o.armLenR);
  anchors.handL = toCaller(aL.tip.x, aL.tip.y);
  anchors.handR = toCaller(aR.tip.x, aR.tip.y);
  if (o.dry) return anchors; // geometry only (e.g. to attach a leash drawn underneath)

  ctx.save();
  ctx.globalAlpha *= o.alpha;
  ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
  if (o.mode === 'pixel') drawPixel(ctx, o);
  else drawCel(ctx, o, aL, aR, k);
  ctx.restore();
  return anchors;
}

function drawCel(ctx, o, aL, aR, k) {
  const sil = clamp(o.sil);
  const S = c => (sil > 0 ? mix(c, o.silColor, sil) : c);
  const base = S(o.base);
  const shade = o.shade || mix(o.base, LIGHT.shadowTint, 0.42);
  const sh = S(shade);
  const top = S(mix(o.base, '#ffd9c0', 0.42));
  const side = S(mix(o.base, LIGHT.shadowTint, 0.24));
  const sideDk = S(mix(o.base, LIGHT.shadowTint, 0.42));
  const line = o.line ?? clamp(o.s / 147 * 4.6, 1.8, 8);
  const lx = LIGHT.lx, ly = LIGHT.ly;
  const D = o.depth;
  const hlA = 1 - sil;
  const [ox, oy] = volume(o);
  const sgn = Math.sign(ox) || 1;
  const rimC = o.rim ? o.rim[0] : LIGHT.rim;
  const rimD = o.rim ? o.rim[1] : D * 0.5;
  const poly = pts => { const p = new Path2D(); pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y))); p.closePath(); return p; };
  // a block (x,y,w,h on the front plane) extruded by (ex,ey): returns its three face paths
  const block = (x, y, w, h, ex, ey, r = 4) => {
    const sx = sgn > 0 ? x + w : x;
    return {
      front: rr(x, y, w, h, r),
      side: Math.abs(ex) > 0.5 ? poly([[sx, y + 2], [sx + ex, y + ey + 2], [sx + ex, y + h + ey - 2], [sx, y + h - 2]]) : null,
      top: ey < -0.5 ? poly([[x + 2, y], [x + w - 2, y], [x + w - 2 + ex, y + ey], [x + 2 + ex, y + ey]]) : null,
    };
  };
  const paintBlock = (b, { lw = line, hl = null, bandK = 1 } = {}) => {
    if (b.side) { ctx.fillStyle = side; ctx.fill(b.side); band(ctx, b.side, sideDk, 0, -D * 0.6 * bandK); if (lw > 0) ink(ctx, b.side, lw * 0.85); }
    if (b.top) { ctx.fillStyle = top; ctx.fill(b.top); if (lw > 0) ink(ctx, b.top, lw * 0.85); }
    ctx.fillStyle = base; ctx.fill(b.front);
    band(ctx, b.front, sh, lx * D * bandK, ly * D * bandK);
    if (LIGHT.deep > 0) band(ctx, b.front, S(mix(shade, LIGHT.shadowTint, 0.3)), lx * D * 0.3 * bandK, ly * D * 0.3 * bandK);
    if (rimC && hlA > 0) band(ctx, b.front, rimC, -lx * rimD * bandK, -ly * rimD * bandK);
    if (hl) hl(b.front);
    if (lw > 0) ink(ctx, b.front, lw);
  };
  const drawArm = (a, near) => {
    // arm = front face + a thin extruded top/side for volume
    const q = new Path2D(); q.addPath(a.p, new DOMMatrix([1, 0, 0, 1, ox * 0.28, oy * 0.28]));
    ctx.fillStyle = near ? top : sideDk; ctx.fill(q); if (line > 0) ink(ctx, q, line * 0.8);
    ctx.fillStyle = base; ctx.fill(a.p);
    band(ctx, a.p, sh, lx * D * 0.8, ly * D * 0.8);
    if (rimC && hlA > 0) band(ctx, a.p, rimC, -lx * rimD * 0.7, -ly * rimD * 0.7);
    if (hlA > 0 && near) { ctx.save(); ctx.globalAlpha *= hlA; const h = new Path2D(); h.addPath(rr(-2, -ARM_H / 2 + 3, ARM_W, 5, 2), a.am); clipFill(ctx, a.p, h, o.hl); ctx.restore(); }
    if (line > 0) ink(ctx, a.p, line);
  };
  const farArm = sgn > 0 ? aL : aR, nearArm = sgn > 0 ? aR : aL;
  drawArm(farArm, false);
  // legs (under the body, slightly back)
  LEG_X.forEach((x0, i) => {
    const b = block(x0 + o.swing[i] + ox * 0.25, -LEG_H - o.legs[i] - 6 + oy * 0.25, LEG_W, LEG_H + 6, ox * 0.3, oy * 0.3, 4);
    paintBlock(b, { lw: line * 0.95, bandK: 0.7 });
    // the body's cast shadow across the top of each leg
    clipFill(ctx, b.front, rr(x0 - 20 + ox * 0.25, -LEG_H - 26 + oy * 0.25, LEG_W + 40, 16 + 9, 0), sh);
  });
  // body
  const body = block(-BW / 2, TOP, BW, BH, ox, oy, 7);
  paintBlock(body, {
    bandK: 1.4,
    hl: f => {
      if (hlA <= 0) return;
      ctx.save(); ctx.globalAlpha *= hlA;
      clipFill(ctx, f, rr(-BW / 2 + 14, TOP + 3, BW - 30, 5, 3), o.hl);
      clipFill(ctx, f, rr(BW / 2 - 21, TOP + 13, 8, 22, 3), o.hl);
      clipFill(ctx, f, rr(BW / 2 - 21, TOP + 39, 8, 6, 2), o.hl);
      ctx.restore();
    },
  });
  if (body.top && hlA > 0) { ctx.save(); ctx.globalAlpha *= 0.6 * hlA; clipFill(ctx, body.top, poly([[-BW / 2 + 20, TOP - 2], [-BW / 2 + 60, TOP - 2], [-BW / 2 + 60 + ox, TOP + oy - 2], [-BW / 2 + 20 + ox, TOP + oy - 2]]), '#fff1e6'); ctx.restore(); }
  drawArm(nearArm, true);
  // eyes
  if (o.eyes === 'none') {}
  else if (sil < 1) drawEyes(ctx, o, line, sil);
  else if (o.glowEyes > 0) drawEyes(ctx, { ...o, eyes: 'glow' }, line, 0);
  // blush + sweat
  if (o.blush > 0 && sil < 0.5) {
    blush(ctx, -BW / 2 + 26, TOP + 58, 11, o.blush);
    blush(ctx, BW / 2 - 26, TOP + 58, 11, o.blush);
  }
  if (o.sweat > 0) sweat(ctx, BW / 2 + 6 + ox, TOP + 6 + oy, 14, o.sweat);
}

function drawEyes(ctx, o, line, sil) {
  const es = o.eyeScale;
  const cx = [-BW / 2 + EYE_X + EYE / 2, BW / 2 - EYE_X - EYE / 2];
  const cy = TOP + EYE_Y + EYE / 2;
  const ex = clamp(o.lx, -1, 1) * 5, ey = clamp(o.ly, -1, 1) * 5;
  const col = P.line;
  ctx.save();
  cx.forEach((x0, i) => {
    const x = x0 + ex, y = cy + ey, side = i ? 1 : -1;
    const e = o.eyes;
    let s = EYE * es;
    if (e === 'glow') {
      ctx.fillStyle = mix(P.lemon, P.white, 0.3); ctx.fillRect(x - s / 2, y - s / 2, s, s);
      return;
    }
    if (o.blink >= 0.95 || e === 'closed') {
      ctx.fillStyle = col; ctx.fillRect(x - s * 0.6, y + s * 0.05, s * 1.2, s * 0.24);
      return;
    }
    if (e === 'happy') {
      ctx.strokeStyle = col; ctx.lineWidth = s * 0.3; ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
      ctx.beginPath(); ctx.moveTo(x - s * 0.6, y + s * 0.3); ctx.lineTo(x, y - s * 0.3); ctx.lineTo(x + s * 0.6, y + s * 0.3); ctx.stroke();
      return;
    }
    if (e === 'x') {
      ctx.strokeStyle = col; ctx.lineWidth = s * 0.26; ctx.lineCap = 'square';
      ctx.beginPath(); ctx.moveTo(x - s * 0.45, y - s * 0.45); ctx.lineTo(x + s * 0.45, y + s * 0.45); ctx.moveTo(x + s * 0.45, y - s * 0.45); ctx.lineTo(x - s * 0.45, y + s * 0.45); ctx.stroke();
      return;
    }
    if (e === 'wide') s *= 1.3;
    if (e === 'tiny') s *= 0.42;
    const h = s * (1 - clamp(o.blink));
    const p = new Path2D();
    if (e === 'determined') {          // inner-top corner cut = brows down
      const cut = s * 0.42;
      if (side < 0) { p.moveTo(x - s / 2, y - s / 2); p.lineTo(x + s / 2 - cut, y - s / 2); p.lineTo(x + s / 2, y - s / 2 + cut); }
      else { p.moveTo(x - s / 2, y - s / 2 + cut); p.lineTo(x - s / 2 + cut, y - s / 2); p.lineTo(x + s / 2, y - s / 2); }
      p.lineTo(x + s / 2, y + s / 2); p.lineTo(x - s / 2, y + s / 2); p.closePath();
    } else if (e === 'sad') {          // outer-top corner cut
      const cut = s * 0.38;
      if (side > 0) { p.moveTo(x - s / 2, y - s / 2); p.lineTo(x + s / 2 - cut, y - s / 2); p.lineTo(x + s / 2, y - s / 2 + cut); }
      else { p.moveTo(x - s / 2, y - s / 2 + cut); p.lineTo(x - s / 2 + cut, y - s / 2); p.lineTo(x + s / 2, y - s / 2); }
      p.lineTo(x + s / 2, y + s / 2); p.lineTo(x - s / 2, y + s / 2); p.closePath();
    } else p.rect(x - s / 2, y + s / 2 - h, s, h);
    ctx.fillStyle = col; ctx.fill(p);
    // anime catchlights (skip for tiny / heavily blinked eyes)
    if (e !== 'tiny' && h > s * 0.5 && sil < 0.6) {
      ctx.fillStyle = P.white;
      const c1 = s * (e === 'wide' ? 0.36 : 0.32);
      ctx.fillRect(x + s * 0.5 - c1 - s * 0.1, y - s * 0.5 + s * 0.1 + (s - h), c1, c1);
      ctx.fillRect(x - s * 0.5 + s * 0.14, y + s * 0.5 - s * 0.3, s * 0.15, s * 0.15);
    }
  });
  ctx.restore();
}

// ---------- the 8-bit sprite: 24×16 grid, 1 cell = 147/16 units
const CELL = BW / 16;
const SPRITE = (() => {
  const rows = [];
  for (let r = 0; r < 16; r++) {
    let s = '';
    for (let c = 0; c < 24; c++) {
      let v = '.';
      const bc = c - 4;
      if (r < 12 && bc >= 0 && bc < 16) v = 'o';
      if (r >= 4 && r < 8 && (c < 4 || c >= 20)) v = 'o';
      if (r >= 12 && [0, 1, 4, 5, 10, 11, 14, 15].includes(bc)) v = 'o';
      if ((r === 2 || r === 3) && [2, 3, 12, 13].includes(bc)) v = 'e';
      s += v;
    }
    rows.push(s);
  }
  return rows;
})();

function drawPixel(ctx, o) {
  const x0 = -12 * CELL, y0 = TOP - 0;
  const gap = CELL * o.pixelGap;
  const total = SPRITE.length * 24;
  const shown = Math.floor(clamp(o.reveal) * total);
  const look = Math.round(clamp(o.lx, -1, 1));
  ctx.save();
  let i = 0;
  for (let r = 0; r < 16; r++) for (let c = 0; c < 24; c++, i++) {
    let v = SPRITE[r][c];
    if (v === '.') continue;
    // eyes slide one cell when looking
    if (look !== 0 && r >= 2 && r <= 3) {
      const bc = c - 4, src = bc - look;
      const isEye = [2, 3, 12, 13].includes(src) && src >= 0 && src < 16;
      v = isEye ? 'e' : 'o';
    }
    const order = r * 24 + c;
    if (order >= shown) continue;
    ctx.fillStyle = v === 'e' ? P.term : o.pixelCol;
    ctx.fillRect(x0 + c * CELL + gap / 2, y0 + r * CELL * (BH + LEG_H) / (16 * CELL) + gap / 2, CELL - gap, CELL * (BH + LEG_H) / (16 * CELL) - gap);
  }
  ctx.restore();
}
