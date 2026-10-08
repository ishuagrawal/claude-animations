// ① STUDY — the shared video unrolls into a filmstrip; Claude scans it with a magnifier and pulls
// out colors, timing and music, then files everything into a style bible.
import { P, rgba, mix } from '../palette.js';
import { C } from '../timeline.js';
import { clamp, ease, seg, key, lerp, TAU, rng } from '../core.js';
import { claude, hop, blinkAt } from '../claude.js';
import { retroStill, drawRetro, catPos, RW, RH } from '../retro.js';
import { caption, badge, setFont, SANS } from '../type.js';
import { confetti, fieldShapes } from '../bgfx.js';
import { sprayAt } from '../tex.js';
import { THUMB_T } from './hook.js';

const CELL = { w: 384, h: 216, gap: 46 };
const STRIP_Y = 395;
const HERO = 1;                       // index of the shared frame in the strip
const LENS = { x: 560, y: STRIP_Y, r: 142 };
const VSCROLL = 95;                   // px/s
export const SWATCHES = [P.rCream, P.rMustard, P.rOrange, P.rRust, P.rTeal];

// three "shots" in the loved video: wide, close-up on the cat, sun
function frameSpec(k) {
  const shot = k < 0 ? 0 : Math.floor(k / 3) % 3;
  const tt = THUMB_T + (k - HERO) * 0.45;
  if (k === HERO) return { shot: 0, tt: THUMB_T };
  if (shot === 1) { const [cx, cy] = catPos(tt); return { shot, tt, view: [cx - 300, cy - 210, 600, 337.5] }; }
  if (shot === 2) return { shot, tt, view: [420, 230, 760, 427.5] };
  return { shot, tt };
}
const cellX = (k, t) => LENS.x + (k - HERO) * (CELL.w + CELL.gap) - VSCROLL * Math.max(0, t - C.study);

function stripCell(ctx, k, x, y, w, h, t) {
  const f = frameSpec(k);
  if (k === HERO && t < C.study + 1.2) { drawRetro(ctx, x, y, w, h, THUMB_T, 'surf'); return; } // vector while zoomed in
  const img = retroStill('surf', f.tt, 384, 216, f.view ? { view: f.view } : {});
  ctx.drawImage(img, x, y, w, h);
}

function drawStrip(ctx, t, lens = null) {
  const top = STRIP_Y - CELL.h / 2 - 34, H = CELL.h + 68;
  ctx.fillStyle = '#0d0b26'; ctx.fillRect(-400, top, 2720, H);
  // sprocket holes scroll with the film
  const off = -VSCROLL * Math.max(0, t - C.study);
  ctx.fillStyle = P.navyLt;
  for (let i = -6; i < 70; i++) {
    const x = ((i * 48 + off) % 2880) - 300;
    ctx.beginPath(); ctx.roundRect(x, top + 9, 26, 16, 5); ctx.roundRect(x, top + H - 25, 26, 16, 5); ctx.fill();
  }
  for (let k = -3; k < 12; k++) {
    const cx = cellX(k, t);
    if (cx < -300 || cx > 2300) continue;
    ctx.save(); ctx.beginPath(); ctx.roundRect(cx - CELL.w / 2, STRIP_Y - CELL.h / 2, CELL.w, CELL.h, 6 * clamp((t - C.study) / 0.6)); ctx.clip();
    stripCell(ctx, k, cx - CELL.w / 2, STRIP_Y - CELL.h / 2, CELL.w, CELL.h, t);
    ctx.restore();
  }
}

// thin-line timecode ruler above the strip
function ruler(ctx, t, a) {
  if (a <= 0) return;
  const off = -VSCROLL * Math.max(0, t - C.study);
  ctx.save(); ctx.globalAlpha *= a;
  ctx.strokeStyle = rgba(P.lilac, 0.5); ctx.lineWidth = 2;
  const y = STRIP_Y - CELL.h / 2 - 58;
  ctx.beginPath(); ctx.moveTo(-100, y); ctx.lineTo(2020, y); ctx.stroke();
  setFont(ctx, 18, 600); ctx.fillStyle = rgba(P.lilac, 0.7); ctx.textAlign = 'center';
  for (let k = -3; k < 14; k++) {
    const x = cellX(k, t) - CELL.w / 2 - CELL.gap / 2;
    for (let m = 0; m < 5; m++) { const xx = x + m * (CELL.w + CELL.gap) / 5; ctx.beginPath(); ctx.moveTo(xx, y); ctx.lineTo(xx, y - (m ? 8 : 16)); ctx.stroke(); }
    if (k >= 0) ctx.fillText(`0:0${Math.floor(k * 0.7)}.${(k * 7) % 10}`, x, y - 24);
  }
  ctx.restore();
}

function magnifier(ctx, t, x, y, r, hx, hy, a) {
  if (a <= 0) return;
  ctx.save();
  // handle from Claude's hand to the rim
  const ang = Math.atan2(hy - y, hx - x), ex = x + Math.cos(ang) * r, ey = y + Math.sin(ang) * r;
  ctx.lineCap = 'round';
  ctx.strokeStyle = P.butterDk; ctx.lineWidth = 30; ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(hx, hy); ctx.stroke();
  ctx.strokeStyle = P.butter; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(ex + Math.cos(ang) * 30, ey + Math.sin(ang) * 30); ctx.lineTo(hx, hy); ctx.stroke();
  // magnified view
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.clip();
  ctx.fillStyle = '#0d0b26'; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.translate(x, y); ctx.scale(1.55, 1.55); ctx.translate(-x, -y - 34);
  drawStrip(ctx, t);
  ctx.restore();
  // glass tint + glare
  ctx.fillStyle = rgba(P.sky, 0.12); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 10; ctx.beginPath(); ctx.arc(x, y, r * 0.78, Math.PI * 1.08, Math.PI * 1.42); ctx.stroke();
  ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r * 0.78, Math.PI * 1.5, Math.PI * 1.58); ctx.stroke();
  // rim
  ctx.strokeStyle = P.white; ctx.lineWidth = 22; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = P.lilac; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r - 11, 0, TAU); ctx.stroke();
  ctx.restore();
}

const CARDS = [{ x: 1000, label: 'colors', t: () => C.colors }, { x: 1350, label: 'timing', t: () => C.timing }, { x: 1700, label: 'music', t: () => C.music }];
const CARD_Y = 815, CW = 300, CH = 210;
export const BOOK = { x: 1350, y: 800 };

function infoCard(ctx, t, i, x, y, s, rot) {
  const c = CARDS[i], t0 = c.t();
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  ctx.fillStyle = rgba('#000000', 0.18); ctx.beginPath(); ctx.roundRect(-CW / 2 + 8, -CH / 2 + 12, CW, CH, 24); ctx.fill();
  ctx.fillStyle = P.white; ctx.beginPath(); ctx.roundRect(-CW / 2, -CH / 2, CW, CH, 24); ctx.fill();
  setFont(ctx, 30, 700); ctx.fillStyle = P.navy; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.fillText(c.label, 0, CH / 2 - 26);
  if (i === 0) {
    SWATCHES.forEach((col, k) => {
      const land = t0 + 0.55 + k * 0.09, p = ease.outBack(clamp((t - land) / 0.3), 2.5);
      if (p <= 0) return;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(-104 + k * 52, -22, 22 * p, 0, TAU); ctx.fill();
      if (col === P.rCream) { ctx.strokeStyle = P.ui; ctx.lineWidth = 3; ctx.stroke(); }
    });
  } else if (i === 1) {
    // three shot segments with cut ticks + average length pill
    const segs = [0.36, 0.28, 0.36], pr = ease.out(clamp((t - t0 - 0.5) / 0.5));
    let xx = -120;
    segs.forEach((w, k) => {
      const ww = 240 * w * pr;
      ctx.fillStyle = [P.sky, P.lilac, P.mintLt][k]; ctx.beginPath(); ctx.roundRect(xx, -62, Math.max(0.1, ww - 6), 26, 8); ctx.fill();
      xx += 240 * w * pr;
      if (pr > 0.3 && k < 2) { ctx.fillStyle = P.butterDk; ctx.fillRect(xx - 5, -72, 4, 46); }
    });
    const pp = ease.outBack(clamp((t - t0 - 0.9) / 0.35), 2);
    if (pp > 0) {
      ctx.save(); ctx.translate(0, -2); ctx.scale(pp, pp);
      ctx.fillStyle = P.navy; ctx.beginPath(); ctx.roundRect(-70, -24, 140, 48, 24); ctx.fill();
      setFont(ctx, 28, 700); ctx.fillStyle = P.butter; ctx.textBaseline = 'middle'; ctx.fillText('2.0 s', 0, 2);
      ctx.restore();
    }
  } else {
    // waveform bouncing on the beat + bpm
    const on = clamp((t - t0 - 0.3) / 0.4);
    for (let k = 0; k < 13; k++) {
      const ph = ((t - t0) / 0.625) % 1, beatPulse = Math.exp(-ph * 5);
      const hh = (12 + 36 * Math.abs(Math.sin(k * 1.7 + 0.5)) * (0.5 + 0.5 * beatPulse)) * ease.outBack(clamp(on * 2 - k * 0.06));
      ctx.fillStyle = k % 2 ? P.violet : P.rose;
      ctx.beginPath(); ctx.roundRect(-126 + k * 20, -40 - hh / 2, 12, Math.max(1, hh), 6); ctx.fill();
    }
    const pp = ease.outBack(clamp((t - t0 - 0.8) / 0.35), 2);
    if (pp > 0) { ctx.save(); ctx.translate(0, 20); ctx.scale(pp, pp); setFont(ctx, 26, 700); ctx.fillStyle = rgba(P.navy, 0.7); ctx.textBaseline = 'middle'; ctx.fillText('♪ 96 bpm', 0, 0); ctx.restore(); }
  }
  ctx.restore();
}

function scissors(ctx, x, y, open, s = 1) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.lineCap = 'round';
  for (const sd of [-1, 1]) {
    ctx.save(); ctx.rotate(sd * open * 0.45);
    ctx.fillStyle = P.white; ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.lineTo(sd * 3, 70); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = P.butter; ctx.lineWidth = 9; ctx.beginPath(); ctx.arc(sd * 14, -26, 15, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  ctx.fillStyle = P.navy; ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
  ctx.restore();
}

function book(ctx, t, x, y, s, closeP) {
  // closed book = portrait cover; open = two pages. closeP 0 (open) .. 1 (closed)
  const PW = 250, PHh = 320;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = rgba('#000000', 0.2); ctx.beginPath(); ctx.roundRect(-PW + 14 + closeP * PW, -PHh / 2 + 18, PW * (2 - closeP), PHh, 20); ctx.fill();
  if (closeP < 1) {
    // left page + cover edge
    ctx.fillStyle = P.violetDk; ctx.beginPath(); ctx.roundRect(-PW - 12, -PHh / 2 - 10, PW + 12, PHh + 20, 18); ctx.fill();
    ctx.fillStyle = P.paper; ctx.beginPath(); ctx.roundRect(-PW, -PHh / 2, PW - 4, PHh, 10); ctx.fill();
    ctx.fillStyle = P.ui; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.roundRect(-PW + 30, -PHh / 2 + 44 + k * 40, 170 - (k % 3) * 40, 12, 6); ctx.fill(); }
  }
  // right half: page, then the cover swinging over (fake 3D via scaleX)
  ctx.fillStyle = P.violetDk; ctx.beginPath(); ctx.roundRect(0, -PHh / 2 - 10, PW + 12, PHh + 20, 18); ctx.fill();
  ctx.fillStyle = P.paper; ctx.beginPath(); ctx.roundRect(4, -PHh / 2, PW - 4, PHh, 10); ctx.fill();
  ctx.fillStyle = P.ui; for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.roundRect(34, -PHh / 2 + 44 + k * 40, 180 - (k % 2) * 50, 12, 6); ctx.fill(); }
  if (closeP > 0) {
    // the left cover flips over onto the right page
    const ang = closeP * Math.PI, sx = -Math.cos(ang); // -1 (left, open) -> 1 (right, closed)
    ctx.save(); ctx.scale(sx, 1);
    const front = sx > 0;
    ctx.fillStyle = front ? P.violet : P.violetDk; ctx.beginPath(); ctx.roundRect(0, -PHh / 2 - 10, PW + 12, PHh + 20, 18); ctx.fill();
    if (front) {
      ctx.fillStyle = rgba('#ffffff', 0.12); ctx.fillRect(14, -PHh / 2 - 10, 12, PHh + 20);
      SWATCHES.forEach((col, k) => { ctx.fillStyle = col; ctx.fillRect(40, -PHh / 2 + 40 + k * 26, PW - 60, 18); });
      setFont(ctx, 40, 800); ctx.fillStyle = P.white; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillText('Style', 40, 108); ctx.fillText('bible', 40, 150);
    }
    ctx.restore();
  }
  ctx.restore();
}

function draw(ctx, t) {
  // camera: pull back from the shared frame (full screen) to reveal the strip
  const pb = seg(t, C.study, C.study + 0.95, ease.inOut);
  const hx = cellX(HERO, t), hy = STRIP_Y;
  const z = Math.exp(lerp(Math.log(1920 / CELL.w), 0, pb));
  const cx = lerp(hx, 960, pb), cy = lerp(hy, 540, pb);
  ctx.fillStyle = P.navy; ctx.fillRect(0, 0, 1920, 1080);
  ctx.save();
  ctx.translate(960, 540); ctx.scale(z, z); ctx.translate(-cx, -cy);

  fieldShapes(ctx, t, P.navy, { seed: 9, n: 5, k: 0.05 });
  confetti(ctx, t, { seed: 33, n: 26, size: 1.2, colors: [P.butter, P.sky, P.rose, P.mint], area: [-60, 560, 2040, 560], avoid: [700, 640, 1260, 400], t0: C.study + 0.6, alpha: 0.9 });
  ruler(ctx, t, seg(t, C.study + 0.7, C.study + 1.2));
  drawStrip(ctx, t);

  // ---- scissors snip between shot 0 and shot 1 (the gap after cell 2), then a cut marker stays
  const gapK = 2, gx = () => cellX(gapK, t) + CELL.w / 2 + CELL.gap / 2;
  const sc = clamp((t - C.timing) / 0.9);
  if (sc > 0) {
    const x = gx();
    const snip = Math.abs(Math.sin(clamp((t - C.timing - 0.25) / 0.35) * Math.PI * 2));
    const yIn = key(t, [[C.timing, STRIP_Y + 420], [C.timing + 0.3, STRIP_Y + 245, ease.outBack], [C.timing + 0.75, STRIP_Y + 245], [C.timing + 1.0, STRIP_Y + 520, ease.in]]);
    ctx.strokeStyle = P.butter; ctx.lineWidth = 6; ctx.setLineDash([14, 10]);
    const mk = ease.out(clamp((t - C.timing - 0.35) / 0.3));
    ctx.beginPath(); ctx.moveTo(x, STRIP_Y - CELL.h / 2 - 40); ctx.lineTo(x, STRIP_Y - CELL.h / 2 - 40 + (CELL.h + 80) * mk); ctx.stroke(); ctx.setLineDash([]);
    if (sc < 1) { ctx.save(); ctx.translate(x, yIn); ctx.rotate(Math.PI); scissors(ctx, 0, 0, 1 - snip, 1.9); ctx.restore(); }
  }

  // ---- Claude with the magnifier
  const enter = ease.outBack(clamp((t - C.study - 0.75) / 0.5), 1.4);
  const lensX = LENS.x + Math.sin((t - C.scan) * 1.6) * 26 * clamp(t - C.scan), lensY = LENS.y + Math.cos((t - C.scan) * 2.1) * 8;
  const jumpC = hop(t, C.colors + 0.05, 0.4, 50), jumpM = hop(t, C.bookClose + 0.1, 0.45, 90);
  const bb = Math.sin(((t - C.music) / 0.5) * TAU) * 0.02 * clamp(t - C.music);
  const CLx = 455, CLy = 1012 + (1 - enter) * 500;
  let eyes = 'squint', lx = 0.7, ly = -0.9, blush = 0;
  if (t > C.colors && t < C.colors + 0.7) { eyes = 'wide'; }
  else if (t > C.timing + 0.3 && t < C.timing + 1.0) { eyes = 'sparkle'; }
  else if (t > C.music && t < C.bookIn) { eyes = 'happy'; blush = 0.5; }
  else if (t >= C.bookIn) { eyes = t > C.bookClose ? 'happy' : 'sparkle'; lx = 1; ly = 0; blush = 0.8; }
  const armR = t < C.bookIn ? 0.95 : lerp(0.95, 1.3, seg(t, C.bookClose, C.bookClose + 0.2)) ;
  sprayAt(ctx, P.navyDk, CLx, 1018, 170, 24, 0.9);
  const a = claude(ctx, { x: CLx, y: CLy + jumpC.y + jumpM.y, s: 270, sx: jumpC.sx * jumpM.sx * (1 - bb * 0.5), sy: jumpC.sy * jumpM.sy * (1 + bb), armR, armL: t > C.bookClose ? 1.2 : 0.15 + Math.sin(t * 3) * 0.05, eyes, lx, ly, blush, blink: blinkAt(t, [C.study + 2.2, C.music - 0.3]), rot: Math.sin(t * 1.6) * 0.02 });
  const magOut = seg(t, C.bookIn - 0.3, C.bookIn + 0.1, ease.in);
  magnifier(ctx, t, lensX, lensY - magOut * 900, LENS.r, a.handR[0], a.handR[1] - magOut * 900 * 0, enter * (1 - magOut));

  // ---- swatches drip out of the lens and fly to the colors card
  SWATCHES.forEach((col, k) => {
    const t0 = C.colors + k * 0.09, u = clamp((t - t0) / 0.55);
    if (u <= 0 || u >= 1) return;
    const e = ease.inOut(u), p0 = [lensX + (k - 2) * 36, lensY + 60], p2 = [CARDS[0].x - 104 + k * 52, CARD_Y - 22], p1 = [lerp(p0[0], p2[0], 0.5), p0[1] - 200];
    const x = (1 - e) ** 2 * p0[0] + 2 * (1 - e) * e * p1[0] + e * e * p2[0], y = (1 - e) ** 2 * p0[1] + 2 * (1 - e) * e * p1[1] + e * e * p2[1];
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, 22 * ease.outBack(clamp(u * 3)), 0, TAU); ctx.fill();
  });

  // ---- the three cards (pop in on their beat), then fly into the book
  CARDS.forEach((c, i) => {
    const t0 = c.t(), p = ease.outBack(clamp((t - t0) / 0.4), 1.7);
    if (p <= 0) return;
    const fly = seg(t, C.chipsFly + i * 0.12, C.chipsFly + i * 0.12 + 0.45, ease.inOut);
    const x = lerp(c.x, BOOK.x + (i - 1) * 60, fly), y = lerp(CARD_Y + Math.sin(t * 2 + i) * 5, BOOK.y - 20, fly);
    const s = p * lerp(1, 0.25, fly);
    if (fly >= 1) return;
    infoCard(ctx, t, i, x, y, s, Math.sin(t * 1.5 + i) * 0.02 + fly * 0.3);
  });
  // ---- the book
  const bIn = ease.outBack(clamp((t - C.bookIn) / 0.45), 1.5);
  if (bIn > 0) {
    const closeP = seg(t, C.bookClose - 0.25, C.bookClose + 0.1, ease.inOut);
    const pulse = 1 + hop(t, C.bookClose + 0.1, 0.3, 0).sx * 0 + Math.sin(clamp((t - C.bookClose - 0.1) / 0.3) * Math.PI) * 0.08;
    book(ctx, t, BOOK.x - closeP * 125, BOOK.y + (1 - bIn) * 500, 0.95 * pulse, closeP);
    // sparkles when it closes
    const sp = clamp((t - C.bookClose - 0.1) / 0.6);
    if (sp > 0 && sp < 1) for (let k = 0; k < 8; k++) { const ang = k / 8 * TAU, d = 190 + sp * 90; ctx.fillStyle = [P.butter, P.rose, P.sky, P.mint][k % 4]; ctx.beginPath(); ctx.arc(BOOK.x + Math.cos(ang) * d, BOOK.y + Math.sin(ang) * d * 0.9, 10 * (1 - sp), 0, TAU); ctx.fill(); }
  }
  ctx.restore();

  badge(ctx, t, 1, 160, 150, 46, C.badge1, { t1: C.cap1Out, bg: P.butter });
  caption(ctx, t, { text: 'Studies every frame', x: 232, y: 176, t0: C.cap1, t1: C.cap1Out, size: 74, color: P.white, hl: ['every', 'frame'], hlColor: P.butter });
  caption(ctx, t, { text: '…and writes a style bible', x: 160, y: 176, t0: C.cap1b, t1: C.splash1 + 0.2, size: 74, color: P.white, hl: ['style', 'bible'], hlColor: P.butter });
  return { vig: 0, grain: 0 };
}

export const study = [{ name: 'study', start: C.study, end: C.imagine, draw }];
