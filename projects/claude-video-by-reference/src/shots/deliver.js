// DELIVER — bookend of the hook: the phone comes back, the .mp4 lands in it and plays Claude's
// new film; next to it the video they loved. Same style, new story. Then zoom into the screen.
import { P, rgba } from '../palette.js';
import { C } from '../timeline.js';
import { clamp, ease, seg, key, lerp, TAU } from '../core.js';
import { claude, hop, blinkAt } from '../claude.js';
import { phone, holdHand, heart, videoRect } from '../hands.js';
import { drawRetro, retroStill } from '../retro.js';
import { caption, pill, setFont } from '../type.js';
import { confetti, fieldShapes } from '../bgfx.js';
import { sprayAt } from '../tex.js';
import { mp4Card } from './compose.js';
import { THUMB_T } from './hook.js';
import { KITE_T } from './imagine.js';

const PH = { x: 1010, y: 650, w: 720, h: 360 };
const ORIG = { x: 330, y: 610, w: 380 };
const CL = { x: 1640, y: 1000, s: 260 };
export const kiteT = t => KITE_T + 1.2 + Math.max(0, t - C.play);

// phone screen's 16:9 video rect in world coords (phone unrotated at zoom time)
function screenRect() {
  const bz = PH.h * 0.06, sx = -PH.w / 2 + bz * 1.6, sy = -PH.h / 2 + bz, sw = PH.w - bz * 3.2, sh = PH.h - bz * 2;
  const v = videoRect(sx, sy, sw, sh);
  return { x: PH.x + v.x, y: PH.y + v.y, w: v.w, h: v.h };
}

function camAt(t) {
  const zp = seg(t, C.zoom3, C.styles, ease.inOut);
  if (zp <= 0) return { x: 960, y: 540, z: 1 };
  const r = screenRect(), zEnd = 1920 / r.w;
  return { x: lerp(960, r.x + r.w / 2, ease.inOut(clamp(zp * 1.15))), y: lerp(540, r.y + r.h / 2, ease.inOut(clamp(zp * 1.15))), z: Math.exp(lerp(0, Math.log(zEnd), zp)) };
}

function draw(ctx, t) {
  const cam = camAt(t);
  ctx.fillStyle = P.cream; ctx.fillRect(0, 0, 1920, 1080);
  ctx.save();
  ctx.translate(960, 540); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);
  fieldShapes(ctx, t, P.cream, { seed: 5, n: 5, k: 0.035, dark: true });
  confetti(ctx, t, { seed: 77, n: 30, size: 1.35, colors: [P.butter, P.rose, P.sky, P.mint, P.violetLt], area: [-80, -60, 2080, 1200], avoid: [120, 240, 1700, 760], t0: C.deliver - 0.2 });

  // ---- the video they loved (left)
  const og = ease.outBack(clamp((t - C.play - 0.2) / 0.45), 1.6) * (1 - seg(t, C.zoom3 - 0.2, C.zoom3 + 0.3, ease.inBack));
  if (og > 0) {
    const th = ORIG.w * 9 / 16;
    ctx.save(); ctx.translate(ORIG.x, ORIG.y + Math.sin(t * 2.2) * 8); ctx.rotate(-0.06); ctx.scale(og, og);
    ctx.fillStyle = rgba(P.navy, 0.14); ctx.beginPath(); ctx.roundRect(-ORIG.w / 2 - 14 + 10, -th / 2 - 14 + 16, ORIG.w + 28, th + 28, 22); ctx.fill();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-ORIG.w / 2 - 14, -th / 2 - 14, ORIG.w + 28, th + 28, 22); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.roundRect(-ORIG.w / 2, -th / 2, ORIG.w, th, 12); ctx.clip();
    ctx.drawImage(retroStill('surf', THUMB_T + 0.6, 760, 428), -ORIG.w / 2, -th / 2, ORIG.w, th);
    ctx.restore();
    ctx.restore();
    pill(ctx, t, 'their video', ORIG.x, ORIG.y - th / 2 - 62, { t0: C.play + 0.35, t1: C.zoom3 - 0.2, size: 30, bg: P.navy, fg: P.white });
    // dotted arrow → phone
    const ar = seg(t, C.play + 0.5, C.play + 1.0, ease.inOut) * (1 - seg(t, C.zoom3 - 0.2, C.zoom3 + 0.1));
    if (ar > 0) {
      ctx.save(); ctx.strokeStyle = rgba(P.navy, 0.45); ctx.lineWidth = 6; ctx.setLineDash([2, 16]); ctx.lineCap = 'round';
      const x0 = ORIG.x + ORIG.w / 2 + 30, x1 = PH.x - PH.w / 2 - 70;
      ctx.beginPath(); ctx.moveTo(x0, ORIG.y); ctx.quadraticCurveTo((x0 + x1) / 2, ORIG.y - 70, lerp(x0, x1, ar), ORIG.y - 10 + 10 * ar); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = rgba(P.navy, 0.45 * clamp(ar * 3 - 2));
      ctx.beginPath(); ctx.moveTo(x1 + 18, ORIG.y); ctx.lineTo(x1 - 6, ORIG.y - 14); ctx.lineTo(x1 - 6, ORIG.y + 14); ctx.fill();
      ctx.restore();
    }
  }

  // ---- phone in two hands
  const inY = key(t, [[C.phone2, 820], [C.phone2 + 0.6, 0, ease.outBack]]);
  const pr = (Math.sin(t * 1.3) * 0.01 - 0.02) * (1 - seg(t, C.zoom3 - 0.3, C.zoom3));
  const px = PH.x, py = PH.y + inY + Math.sin(t * 1.7) * 3 * (1 - seg(t, C.zoom3 - 0.3, C.zoom3));
  holdHand(ctx, px, py, PH.w, PH.h, pr, -1, 'back');
  holdHand(ctx, px, py, PH.w, PH.h, pr, 1, 'back');
  phone(ctx, px, py, PH.w, PH.h, pr, (c, x, y, w, h) => {
    const v = videoRect(x, y, w, h);
    if (t >= C.play) {
      drawRetro(c, v.x, v.y, v.w, v.h, kiteT(t), 'kite', { grain: 0.16 });
      const ui = 1 - seg(t, C.zoom3 - 0.3, C.zoom3);
      if (ui > 0) {
        c.save(); c.globalAlpha *= ui;
        c.fillStyle = rgba('#ffffff', 0.45); c.fillRect(v.x + 26, v.y + v.h - 22, v.w - 52, 5);
        const pp = clamp((t - C.play) / 6);
        c.fillStyle = P.rose; c.fillRect(v.x + 26, v.y + v.h - 22, (v.w - 52) * pp, 5); c.beginPath(); c.arc(v.x + 26 + (v.w - 52) * pp, v.y + v.h - 19.5, 8, 0, TAU); c.fill();
        c.restore();
      }
    } else {
      // waiting for the film: a download ring fills as the .mp4 flies in
      c.fillStyle = P.navyDk; c.fillRect(x, y, w, h);
      const cx = x + w / 2, cy = y + h / 2, pr2 = clamp((t - C.phone2 - 0.3) / (C.play - C.phone2 - 0.35));
      c.strokeStyle = rgba('#ffffff', 0.15); c.lineWidth = 10; c.beginPath(); c.arc(cx, cy, 46, 0, TAU); c.stroke();
      c.strokeStyle = P.rose; c.lineCap = 'round'; c.beginPath(); c.arc(cx, cy, 46, -Math.PI / 2, -Math.PI / 2 + TAU * ease.inOut(pr2)); c.stroke();
      c.strokeStyle = P.white; c.lineWidth = 8; c.beginPath(); c.moveTo(cx, cy - 18); c.lineTo(cx, cy + 14); c.moveTo(cx - 13, cy + 2); c.lineTo(cx, cy + 15); c.lineTo(cx + 13, cy + 2); c.stroke();
    }
    const fl = 1 - clamp((t - C.play) / 0.3);
    if (t > C.play - 0.1 && fl > 0) { c.fillStyle = rgba('#ffffff', fl); c.fillRect(x, y, w, h); }
  });
  holdHand(ctx, px, py, PH.w, PH.h, pr, -1, 'front');
  holdHand(ctx, px, py, PH.w, PH.h, pr, 1, 'front');
  pill(ctx, t, 'your film', PH.x, PH.y - PH.h / 2 - 66 + inY, { t0: C.play + 0.35, t1: C.zoom3 - 0.2, size: 30, bg: P.rose, fg: P.white });

  // ---- the .mp4 flies in and drops into the screen
  const fly = clamp((t - C.mp4In) / (C.play - C.mp4In));
  if (t > C.deliver && fly < 1) {
    const e = ease.in(fly);
    mp4Card(ctx, lerp(2050, PH.x, e), lerp(-260, PH.y, e), lerp(0.9, 0.12, e), lerp(0.6, 0, e));
  }

  // ---- hearts + proud Claude
  for (let i = 0; i < 10; i++) {
    const t0 = C.hearts2 + i * 0.13, u = (t - t0) / 1.4;
    if (u <= 0 || u >= 1) continue;
    const hx = PH.x - 250 + (i % 5) * 120 + Math.sin(u * 7 + i) * 24, hy = PH.y - PH.h / 2 - 40 - u * 260;
    heart(ctx, hx, hy, (26 + (i % 4) * 9) * ease.outBack(clamp(u * 4)) * (1 - ease.in(clamp((u - 0.7) / 0.3))), [P.rose, P.roseLt, P.butter][i % 3], Math.sin(u * 5 + i) * 0.3);
  }
  if (t > C.proud - 0.3) {
    const hp = hop(t, C.proud, 0.55, 260);
    const xx = lerp(2150, CL.x, ease.out(clamp((t - C.proud) / 0.55)));
    const cheer = t > C.proud + 0.55 ? Math.sin((t - C.proud) * 9) * 0.2 : 0;
    sprayAt(ctx, P.creamDk, xx, CL.y + 6, 170, 24, 0.9);
    claude(ctx, { x: xx, y: CL.y + hp.y, s: CL.s, sx: hp.sx, sy: hp.sy, armL: 1.15 + cheer, armR: 1.15 - cheer, eyes: t < C.proud + 0.6 ? 'wide' : 'sparkle', lx: -0.9, ly: -0.3, blush: 0.9, blink: blinkAt(t, [C.proud + 1.3]) });
  }
  ctx.restore();

  caption(ctx, t, { text: 'Same style. New story. Your film.', x: 960, y: 205, t0: C.capSame, t1: C.zoom3 - 0.15, size: 80, align: 'center', stagger: 0.12, hl: ['style.', 'story.', 'film.'], hlColor: P.rose });
  return { vig: 0, grain: 0 };
}

export const deliver = [{ name: 'deliver', start: C.deliver, end: C.styles, draw }];
