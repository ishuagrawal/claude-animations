// HOOK — a video you love → "Make me one like this!" → meet /video-by-reference → zoom into the card.
import { P, rgba, mix } from '../palette.js';
import { C, beat } from '../timeline.js';
import { clamp, ease, seg, key, lerp, TAU, inv } from '../core.js';
import { claude, hop, blinkAt } from '../claude.js';
import { phone, holdHand, heart, videoRect } from '../hands.js';
import { drawRetro, retroStill } from '../retro.js';
import { caption, pill, setFont, SANS, MONO } from '../type.js';
import { confetti, fieldShapes } from '../bgfx.js';
import { sprayAt } from '../tex.js';

export const THUMB_T = 1.15;          // the Sunset Surf moment shown on the shared card (STUDY opens on it)
const CARD = { w: 400, h: 330, thumbW: 368 };
const PH = { x: 700, y: 630, w: 800, h: 400 };
const CL = { x: 1560, y: 950, s: 330 };
const DOCK = { x: 1215, y: 395 };

// the shared card floats (explainer UI idiom) at DOCK, bobbing gently until the zoom
export function cardHeld(t) {
  const calm = 1 - seg(t, C.zoom1 - 0.4, C.zoom1, ease.lin);
  return { x: DOCK.x, y: DOCK.y + Math.sin(t * 2.4) * 9 * calm, rot: Math.sin(t * 1.9) * 0.025 * calm };
}
function bobAt(t) {
  const amp = 0.02 * (1 - seg(t, C.zoom1 - 0.5, C.zoom1, ease.lin));
  const ph = ((t - C.claudeLand) / 0.5) * TAU;
  return { sx: 1 - Math.sin(ph) * amp * 0.5, sy: 1 + Math.sin(ph) * amp };
}

function camAt(t) {
  // gentle push, then a zoom straight into the card's thumbnail so it fills the frame at C.study
  const push = seg(t, C.title - 0.6, C.zoom1, ease.inOutSine);
  let x = lerp(960, 1000, push), y = lerp(540, 525, push), z = lerp(1, 1.05, push);
  const zp = seg(t, C.zoom1, C.study, ease.inOut);
  if (zp > 0) {
    const c = cardHeld(C.study), thumbCy = c.y - CARD.h / 2 + 18 + (CARD.thumbW * 9 / 16) / 2;
    const zEnd = 1920 / CARD.thumbW;
    const lz = lerp(Math.log(z), Math.log(zEnd), zp);
    // keep the target point's screen position moving smoothly to the centre
    x = lerp(x, c.x, ease.inOut(clamp(zp * 1.15))); y = lerp(y, thumbCy, ease.inOut(clamp(zp * 1.15)));
    z = Math.exp(lz);
  }
  return { x, y, z };
}

export function drawCard(ctx, t, cx, cy, s = 1, rot = 0, { chrome = 1, text = 1 } = {}) {
  const { w, h, thumbW } = CARD, th = thumbW * 9 / 16;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot); ctx.scale(s, s);
  if (chrome > 0) {
    ctx.globalAlpha *= chrome;
    ctx.fillStyle = rgba(P.navy, 0.14); ctx.beginPath(); ctx.roundRect(-w / 2 + 10, -h / 2 + 16, w, h, 26); ctx.fill();
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-w / 2, -h / 2, w, h, 26); ctx.fill();
    // bubble tail
    ctx.beginPath(); ctx.moveTo(-w / 2 + 40, h / 2 - 2); ctx.lineTo(-w / 2 + 22, h / 2 + 30); ctx.lineTo(-w / 2 + 80, h / 2 - 2); ctx.fill();
    ctx.globalAlpha /= chrome;
  }
  const tx = -thumbW / 2, ty = -h / 2 + 18;
  ctx.save(); ctx.beginPath(); ctx.roundRect(tx, ty, thumbW, th, 16 * chrome); ctx.clip();
  if (chrome < 0.6) drawRetro(ctx, tx, ty, thumbW, th, THUMB_T, 'surf'); else ctx.drawImage(retroStill('surf', THUMB_T, 768, 432), tx, ty, thumbW, th);
  ctx.restore();
  if (chrome > 0) {
    ctx.globalAlpha *= chrome;
    // play button
    ctx.fillStyle = rgba(P.white, 0.92); ctx.beginPath(); ctx.arc(0, ty + th / 2, 34, 0, TAU); ctx.fill();
    ctx.fillStyle = P.rRust; ctx.beginPath(); ctx.moveTo(-10, ty + th / 2 - 15); ctx.lineTo(16, ty + th / 2); ctx.lineTo(-10, ty + th / 2 + 15); ctx.fill();
    // link line + message
    if (text > 0) {
      ctx.globalAlpha *= text;
      setFont(ctx, 30, 700); ctx.fillStyle = P.navy; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Make me one like this!', tx + 4, ty + th + 52);
      setFont(ctx, 19, 600); ctx.fillStyle = rgba(P.navy, 0.45);
      ctx.fillText('youtube.com/watch?v=sunset-surf', tx + 4, ty + th + 84);
    }
  }
  ctx.restore();
}

function draw(ctx, t) {
  const cam = camAt(t);
  ctx.fillStyle = P.cream; ctx.fillRect(0, 0, 1920, 1080);
  ctx.save();
  ctx.translate(960, 540); ctx.scale(cam.z, cam.z); ctx.translate(-cam.x, -cam.y);

  fieldShapes(ctx, t, P.cream, { seed: 5, n: 5, k: 0.035, dark: true });
  // backdrop disc that Claude lands in front of
  const disc = ease.outBack(clamp((t - C.claudeHop) / 0.6), 1.3);
  if (disc > 0) { ctx.fillStyle = P.creamDk; ctx.beginPath(); ctx.arc(CL.x, CL.y - 190, 300 * disc, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba(P.navy, 0.12); ctx.lineWidth = 4; ctx.setLineDash([3, 18]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(CL.x, CL.y - 190, 350 * disc, 0, TAU); ctx.stroke(); ctx.setLineDash([]); }
  confetti(ctx, t, { seed: 21, n: 34, size: 1.35, colors: [P.butter, P.rose, P.sky, P.mint, P.violetLt], area: [-80, -60, 2080, 1200], avoid: [200, 150, 1100, 860], t0: 0.0 });

  // ---------------- phone in two hands
  const inY = key(t, [[C.phoneIn, 820], [C.phoneIn + 0.75, 0, ease.outBack]]);
  const outY = key(t, [[C.bubbleLand + 0.15, 0], [C.bubbleLand + 0.75, 980, ease.inBack]]);
  const tap = Math.sin(clamp((t - C.share + 0.12) / 0.3) * Math.PI);
  const pr = -0.035 + Math.sin(t * 1.3) * 0.012 + key(t, [[C.phoneIn, 0.14], [C.phoneIn + 0.9, 0, ease.outBack]]) - tap * 0.012;
  const px = PH.x, py = PH.y + inY + outY + Math.sin(t * 1.7) * 4;
  if (py < 1700) {
    holdHand(ctx, px, py, PH.w, PH.h, pr, -1, 'back');
    holdHand(ctx, px, py, PH.w, PH.h, pr, 1, 'back');
    phone(ctx, px, py, PH.w, PH.h, pr, (c, x, y, w, h) => {
      const v = videoRect(x, y, w, h);
      drawRetro(c, v.x, v.y, v.w, v.h, t, 'surf', { grain: 0.16 });
      // player chrome: progress bar + tiny heart counter
      c.fillStyle = rgba('#ffffff', 0.45); c.fillRect(x + 30, y + h - 26, w - 60, 6);
      c.fillStyle = P.rRust; c.fillRect(x + 30, y + h - 26, (w - 60) * clamp(0.18 + t * 0.06), 6);
      c.beginPath(); c.arc(x + 30 + (w - 60) * clamp(0.18 + t * 0.06), y + h - 23, 9, 0, TAU); c.fill();
      // tap ripple where the thumb hits "share"
      const rp = clamp((t - C.share) / 0.45);
      if (rp > 0 && rp < 1) { c.strokeStyle = rgba('#ffffff', 1 - rp); c.lineWidth = 5; c.beginPath(); c.arc(x + w - 70, y + h * 0.55, 20 + rp * 60, 0, TAU); c.stroke(); }
    });
    holdHand(ctx, px, py, PH.w, PH.h, pr, -1, 'front');
    holdHand(ctx, px, py, PH.w, PH.h, pr, 1, 'front', { tap });
  }

  // ---------------- hearts floating up from the video
  for (let i = 0; i < 9; i++) {
    const t0 = C.hearts + i * 0.16, u = (t - t0) / 1.5;
    if (u <= 0 || u >= 1) continue;
    const hx = PH.x + 220 + (i % 3) * 70 + Math.sin(u * 7 + i) * 26, hy = PH.y - 170 - u * 300;
    const s = (26 + (i % 4) * 9) * ease.outBack(clamp(u * 4)) * (1 - ease.in(clamp((u - 0.7) / 0.3)));
    heart(ctx, hx, hy, s, [P.rose, P.roseLt, P.butter][i % 3], Math.sin(u * 5 + i) * 0.3);
  }

  // like counter popping on the video (UI detail)
  if (t > C.hearts - 0.1 && t < C.bubbleLand + 0.2) {
    const n = Math.floor(lerp(12.4, 12.9, clamp((t - C.hearts) / 1.6)) * 10) / 10;
    pill(ctx, t, n.toFixed(1) + 'k', PH.x - 300, PH.y - 250 + inY + outY, { t0: C.hearts - 0.1, t1: C.bubbleLand - 0.1, size: 30, bg: P.white, fg: P.navy, icon: (c, x, y, r) => heart(c, x, y + 1, r * 2.1, P.rose) });
  }
  // ---------------- the shared card: pops out of the screen, arcs over to Claude
  const fl = clamp((t - C.bubbleOut) / (C.bubbleLand - C.bubbleOut));
  const held = cardHeld(t);
  if (t >= C.bubbleOut) {
    let cx, cy, s, rot;
    if (fl < 1) {
      const e = ease.inOut(fl);
      const p0 = [PH.x + 300, PH.y - 20], p2 = [held.x, held.y], p1 = [lerp(p0[0], p2[0], 0.5), Math.min(p0[1], p2[1]) - 260];
      cx = (1 - e) ** 2 * p0[0] + 2 * (1 - e) * e * p1[0] + e * e * p2[0];
      cy = (1 - e) ** 2 * p0[1] + 2 * (1 - e) * e * p1[1] + e * e * p2[1];
      s = lerp(0.25, 1, ease.outBack(clamp(fl * 1.6), 1.4)); rot = Math.sin(fl * Math.PI) * -0.25;
      // dotted flight trail (thin-line accent)
      ctx.save(); ctx.strokeStyle = rgba(P.navy, 0.35); ctx.lineWidth = 4; ctx.setLineDash([2, 16]); ctx.lineCap = 'round';
      ctx.beginPath(); for (let k = 0; k <= 24; k++) { const q = e * k / 24; const x = (1 - q) ** 2 * p0[0] + 2 * (1 - q) * q * p1[0] + q * q * p2[0], y = (1 - q) ** 2 * p0[1] + 2 * (1 - q) * q * p1[1] + q * q * p2[1]; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      ctx.globalAlpha = 1 - clamp((fl - 0.8) / 0.2); ctx.stroke(); ctx.restore();
    } else {
      const land = t - C.bubbleLand;
      cx = held.x; cy = held.y + Math.sin(clamp(land / 0.35) * Math.PI) * 26; s = 1; rot = held.rot;
    }
    // drawn after Claude when held (in front of the arms) — store for later
    ctx._card = { cx, cy, s, rot };
  }

  // ---------------- Claude
  if (t >= C.claudeHop - 0.3) {
    const hp = hop(t, C.claudeHop, C.claudeLand - C.claudeHop, 300);
    const xx = lerp(2180, CL.x, ease.out(clamp((t - C.claudeHop) / (C.claudeLand - C.claudeHop))));
    const cheer = clamp((t - (C.bubbleLand - 0.1)) / 0.7);
    const nod = Math.sin(clamp((t - C.nod) / 0.5) * TAU) * 0.035;
    const b = t > C.claudeLand ? bobAt(t) : { sx: 1, sy: 1 };
    const joy = hop(t, C.claudeLand + 0.55, 0.42, 60); // happy little jump when it sees the video
    let eyes = 'open', lx = -0.8, ly = 0.2, blush = 0;
    if (t < C.claudeLand + 0.2) { eyes = 'wide'; }
    else if (t < C.share) { eyes = 'heart'; blush = 1; }
    else if (t < C.bubbleLand) { eyes = 'wide'; lx = lerp(-0.8, -0.9, fl); ly = lerp(0.2, -0.9, fl); }
    else if (t < C.title + 0.6) { eyes = 'happy'; blush = 0.8; lx = -0.4; ly = -0.4; }
    else { eyes = 'sparkle'; lx = -0.9; ly = -0.9; blush = 0.6; }
    const armUp = cheer > 0 && cheer < 1 ? 0.3 + Math.sin(cheer * Math.PI) * 0.9 + Math.sin(cheer * TAU * 3) * 0.15 * Math.sin(cheer * Math.PI) : (t > C.claudeLand && t < C.share ? 0.5 + Math.sin(t * 9) * 0.25 : 0.2);
    const legs = t < C.claudeLand ? [10, 6, 10, 6] : [0, 0, 0, 0];
    sprayAt(ctx, P.creamDk, xx, CL.y + 6, 190 * (1 - Math.min(0.5, -(hp.y + joy.y) / 400)), 26, 0.9);
    claude(ctx, {
      x: xx, y: CL.y + hp.y + joy.y, s: CL.s, sx: hp.sx * joy.sx * b.sx, sy: hp.sy * joy.sy * b.sy * (1 + nod), rot: t < C.claudeLand ? -0.12 * (1 - clamp((t - C.claudeHop) / 0.8)) : 0,
      armL: armUp, armR: armUp, eyes, lx, ly, blush, legs,
      blink: blinkAt(t, [C.claudeLand + 1.4, C.title + 1.2]),
    });
  }
  if (ctx._card) { const k = ctx._card; if (t > C.bubbleLand && t < C.zoom1) sprayAt(ctx, P.creamDk, k.cx, k.cy + 230, 170, 22, 0.5); drawCard(ctx, t, k.cx, k.cy, k.s, k.rot, { chrome: 1 - seg(t, C.zoom1 + 0.25, C.study - 0.05, ease.in), text: 1 - seg(t, C.zoom1, C.zoom1 + 0.3) }); ctx._card = null; }
  ctx.restore();

  // ---------------- captions (screen space)
  caption(ctx, t, { text: 'Love how a video looks?', x: PH.x, y: 230, t0: C.capLove, t1: C.capLoveOut, size: 88, align: 'center', hl: ['looks?'], hlColor: P.rose });
  if (t >= C.title - 0.1 && t < C.study) {
    const out = C.zoom1 - 0.1;
    caption(ctx, t, { text: 'Meet', x: 150, y: 420, t0: C.title, t1: out, size: 76, color: P.navy });
    const pp = ease.outBack(clamp((t - C.title - 0.3) / 0.5), 1.6) * (1 - ease.inBack(clamp((t - out - 0.1) / 0.3)));
    if (pp > 0) {
      ctx.save(); ctx.translate(150, 520); ctx.scale(pp, pp);
      setFont(ctx, 56, 700, MONO);
      const label = 'video-by-reference', sw = ctx.measureText('/').width, lw = ctx.measureText(label).width;
      const Wd = sw + lw + 64, Hh = 96;
      ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(0, -Hh / 2, Wd, Hh, Hh / 2); ctx.fill();
      ctx.textBaseline = 'middle'; ctx.fillStyle = P.butter; ctx.fillText('/', 32, 3);
      ctx.fillStyle = P.white; ctx.fillText(label, 32 + sw, 3);
      ctx.restore();
    }
    caption(ctx, t, { text: 'a Claude Code skill', x: 156, y: 638, t0: C.title + 0.55, t1: out, size: 44, weight: 600, color: rgba(P.navy, 0.62) });
  }
  return { vig: 0, grain: 0 };
}

export const hook = [{ name: 'hook', start: 0, end: C.study, draw }];
