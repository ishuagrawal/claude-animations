// G · the still. The party freezes at the top of Claude's jump (flash + shutter), the moment shrinks into a stretched
// canvas on the gold ground, a hand takes it by the top edge and turns it around (the back: linen, wooden stretcher
// bars, a pencilled "nº 2"), lifts it away, and the end type builds from dropping bars like the opening.
// Corner signature: a tiny easel with a blank canvas that gets one coral dab before the fade. (The hints never
// name anything.)
import { P, rgba, darken } from '../palette.js';
import { C } from '../timeline.js';
import { ease, seg, clamp, lerp, onN, BEAT, TAU, rng } from '../core.js';
import { setFont, wordmark } from '../type.js';
import { grip } from '../hands.js';
import { drop, soft } from '../soft.js';
import { claude } from '../claude.js';
import { partyFrame } from './e_cake.js';
import { starBurst } from '../fx2.js';

const FROZEN = C.freeze - 1 / 240;
const CV = { w: 1920 * 0.42, h: 1080 * 0.42, cx: 960, cy: 500, depth: 16 };

let weave = null;
function weaveTex() {
  if (weave) return weave;
  const c = new OffscreenCanvas(64, 64), x = c.getContext('2d');
  const r = rng(9);
  x.fillStyle = '#808080'; x.fillRect(0, 0, 64, 64);
  for (let i = 0; i < 64; i += 4) {
    x.fillStyle = `rgba(0,0,0,${0.18 + r() * 0.1})`; x.fillRect(0, i, 64, 1.6);
    x.fillStyle = `rgba(255,255,255,${0.14 + r() * 0.1})`; x.fillRect(i + 2, 0, 1.4, 64);
  }
  weave = c;
  return c;
}

function ground(ctx) {
  ctx.fillStyle = P.gold; ctx.fillRect(0, 0, 1920, 1080);
  const g = ctx.createRadialGradient(960, 470, 0, 960, 470, 1100);
  g.addColorStop(0, rgba(P.goldLt, 0.22)); g.addColorStop(1, rgba(P.goldLt, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
}

// the stretched canvas: front = the frozen party (painted), back = linen + stretcher bars
function canvasObj(ctx, t, s, flip, o = {}) {
  const w = CV.w, h = CV.h, d = CV.depth;
  const fx = Math.cos(flip * Math.PI);
  const back = flip > 0.5;
  ctx.save();
  ctx.scale(Math.max(0.02, Math.abs(fx)), 1);
  const face = new Path2D(); face.rect(-w / 2, -h / 2, w, h);
  // thickness (the canvas wraps around a deep stretcher): a darker band on the right/bottom
  const side = new Path2D(); side.rect(-w / 2 + d * 0.6, -h / 2 + d * 0.6, w, h);
  drop(ctx, side, { dx: 22, dy: 30, blur: 40, a: 0.3 });
  ctx.fillStyle = back ? '#b9a27a' : darken(P.cream, 0.18); ctx.fill(side);
  if (!back) {
    ctx.save(); ctx.clip(face);
    ctx.translate(-w / 2, -h / 2); ctx.scale(w / 1920, h / 1080);
    partyFrame(ctx, FROZEN);
    ctx.restore();
    // canvas weave shows once it's an object
    ctx.save(); ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.35 * (o.weave ?? 1);
    ctx.fillStyle = ctx.createPattern(weaveTex(), 'repeat'); ctx.fill(face);
    ctx.restore();
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 3; ctx.stroke(face);
  } else {
    ctx.save();
    ctx.fillStyle = '#e4d5b4'; ctx.fill(face);
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.25; ctx.fillStyle = ctx.createPattern(weaveTex(), 'repeat'); ctx.fill(face); ctx.restore();
    // shadow of the frame on the linen, then the stretcher bars (wood) and a centre brace
    const bw = 40;
    const bars = [[-w / 2, -h / 2, w, bw], [-w / 2, h / 2 - bw, w, bw], [-w / 2, -h / 2, bw, h], [w / 2 - bw, -h / 2, bw, h], [-bw / 2, -h / 2, bw, h]];
    bars.forEach(([x, y, ww, hh]) => {
      const b = new Path2D(); b.rect(x, y, ww, hh);
      drop(ctx, b, { dx: 6, dy: 8, blur: 12, a: 0.25 });
      soft(ctx, b, P.wood, { k: 0.6, b: [x, y, x + ww, y + hh], grad: 0.06, sa: 0.6, la: 0.5 });
    });
    // grain lines on the wood
    ctx.strokeStyle = rgba(P.woodDk, 0.5); ctx.lineWidth = 2;
    for (const [x, y, ww, hh] of bars) for (let k = 1; k < 3; k++) { ctx.beginPath(); if (ww > hh) { ctx.moveTo(x + 10, y + hh * k / 3); ctx.lineTo(x + ww - 10, y + hh * k / 3); } else { ctx.moveTo(x + ww * k / 3, y + 10); ctx.lineTo(x + ww * k / 3, y + hh - 10); } ctx.stroke(); }
    // staples
    ctx.fillStyle = '#8b8b8b';
    for (let i = 0; i < 9; i++) { ctx.fillRect(-w / 2 + 60 + i * (w - 120) / 8, -h / 2 + 8, 16, 4); ctx.fillRect(-w / 2 + 60 + i * (w - 120) / 8, h / 2 - 12, 16, 4); }
    // pencil note
    setFont(ctx, 40, { fam: 'ui', weight: 400 });
    ctx.fillStyle = rgba('#5a5550', 0.85); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.save(); ctx.translate(w / 4, 6); ctx.rotate(-0.06); ctx.fillText('nº 2', 0, 0); ctx.restore();
    ctx.restore();
  }
  // the turn darkens the face as it goes edge-on
  if (Math.abs(fx) < 0.7) { ctx.fillStyle = rgba(P.ink, (0.7 - Math.abs(fx)) * 0.6); ctx.fill(face); }
  ctx.restore();
}

// corner signature: a tiny easel with a blank canvas; one coral dab lands on it at C.dab
function easel(ctx, t) {
  const p = ease.outBack(seg(t, C.typeDone + 0.9, C.typeDone + 1.25, ease.lin));
  if (p <= 0) return;
  ctx.save();
  ctx.translate(1786, 1010); ctx.scale(p, p);
  ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(0, -96); ctx.lineTo(26, 0); ctx.moveTo(0, -96); ctx.lineTo(0, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-34, -30); ctx.lineTo(34, -30); ctx.stroke();
  const cv = new Path2D(); cv.rect(-34, -86, 68, 52);
  drop(ctx, cv, { dx: 4, dy: 5, blur: 6, a: 0.25 });
  ctx.fillStyle = P.cream; ctx.fill(cv);
  ctx.lineWidth = 3.5; ctx.stroke(cv);
  const dab = seg(t, C.dab, C.dab + 0.18, ease.outBack);
  if (dab > 0) {
    ctx.save(); ctx.translate(6, -60); ctx.scale(dab, dab); ctx.rotate(-0.4);
    ctx.fillStyle = P.coral;
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 7, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-9, 3, 6, 4, 0.5, 0, TAU); ctx.fill();
    ctx.restore();
    starBurst(ctx, 6, -60, t - C.dab, { n: 7, r0: 18, r1: 44, life: 0.4, col: P.ink, lines: true });
  }
  ctx.restore();
}

const END = { text: '70+', size: 330, cx: 960, base: 560 };

function endType(ctx, t) {
  const items = wordmark(END.text, END.size, END.cx, END.base, { track: -8 });
  const drops = items.map((_, i) => C.type + 0.15 + i * BEAT / 2);
  const tb = onN(t, 2);
  items.forEach((it, i) => {
    const td = drops[i], b = it.bar;
    if (tb < td - 0.3) return;
    const pf = clamp((tb - (td - 0.3)) / 0.3);
    const yTop = lerp(-b.h - 60, b.y, ease.in2(pf));
    const pm = seg(tb, C.typeDone + i * 0.04, C.typeDone + 0.22 + i * 0.04, ease.outBack);
    if (pm > 0) {
      ctx.save();
      const bx = it.box;
      const x0 = lerp(b.x, bx.x - 8, pm), x1 = lerp(b.x + b.w, bx.x + bx.w + 8, pm);
      ctx.beginPath(); ctx.rect(x0, bx.y - 40, Math.max(0, x1 - x0), bx.h + 80); ctx.clip();
      setFont(ctx, END.size, { fam: 'display', weight: 900, stretch: 'expanded' });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.ink;
      ctx.fillText(it.ch, it.pen, END.base);
      ctx.restore();
    }
    if (pm < 1) { ctx.fillStyle = P.ink; ctx.fillRect(b.x, yTop, b.w, b.h); }
  });
  // lines under it
  const l1 = seg(t, C.typeDone + 0.35, C.typeDone + 0.7, ease.out);
  if (l1 > 0) {
    ctx.save(); ctx.globalAlpha = l1;
    setFont(ctx, 66, { fam: 'ui', weight: 700, track: -1 });
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.ink;
    ctx.fillText('thank you, stargazers', 960, 700 + (1 - l1) * 30);
    ctx.restore();
  }
  const l2 = seg(t, C.typeDone + 0.75, C.typeDone + 1.1, ease.out);
  if (l2 > 0) {
    ctx.save(); ctx.globalAlpha = l2;
    setFont(ctx, 36, { fam: 'mono', weight: 500 });
    ctx.textAlign = 'center'; ctx.fillStyle = rgba(P.ink, 0.82);
    ctx.fillText('made with /skills:video-by-reference', 960, 800 + (1 - l2) * 20);
    ctx.fillText('github.com/ishuagrawal/skills', 960, 852 + (1 - l2) * 20);
    ctx.restore();
  }
  return items;
}

function sEnd(ctx, t) {
  ground(ctx);
  const sh = seg(t, C.shrink, C.shrink + 0.62, ease.inOut);
  const lift = seg(t, C.type - 0.15, C.type + 0.35, ease.in2);
  if (lift < 1) {
    const s = lerp(1 / 0.42, 1, sh);
    const cy = lerp(540, CV.cy, sh) - lift * 1100;
    const flip = seg(t, C.flip, C.flip + 0.45, ease.inOut);
    ctx.save();
    ctx.translate(lerp(960, CV.cx, sh), cy);
    ctx.scale(s, s);
    // hand behind first (palm above the canvas), then the canvas, then fingertips over the top edge
    const grabIn = seg(t, C.grab - 0.3, C.grab, ease.out);
    const hy = -CV.h / 2 - (1 - grabIn) * 700;
    if (grabIn > 0) grip(ctx, { x: 0, y: hy, s: 62, side: -1, ang: Math.PI / 2, skin: 'mint', part: 'back' });
    canvasObj(ctx, t, s, flip, { weave: sh });
    if (grabIn > 0) grip(ctx, { x: 0, y: hy, s: 62, side: -1, ang: Math.PI / 2, skin: 'mint', part: 'front' });
    ctx.restore();
  }
  const items = endType(ctx, t);
  // Claude drops onto the 0 and waves
  const zero = items[1];
  const tl = C.typeDone + 0.3;
  if (t > tl - 0.35) {
    const fall = seg(t, tl - 0.35, tl, ease.in2);
    const l = t - tl;
    const sq = l > 0 && l < 0.25 ? Math.sin(l / 0.25 * Math.PI) * 0.2 : 0;
    const wave = l > 0.3 ? Math.max(0, Math.sin((l - 0.3) / BEAT * Math.PI)) : 0;
    const top = zero.box.y;
    claude(ctx, { x: zero.box.x + zero.box.w / 2, y: lerp(-200, top, fall), s: 0.95, sy: 1 - sq, sx: 1 + sq * 0.7, eyes: l > 0.2 ? 'happy' : 'wide', arms: [0.2, 0.4 + wave * 1.2], shadowA: 0.6 });
  }
  easel(ctx, t);
  const fade = seg(t, C.fade, C.end - 0.04, ease.inOut);
  if (fade > 0) { ctx.fillStyle = rgba('#000000', fade); ctx.fillRect(0, 0, 1920, 1080); }
  const flash = t >= C.freeze && t < C.freeze + 2 / 24 ? 0.85 : 0;
  return { vig: 0.03, grain: 0.01, flash, flashCol: [1, 1, 1] };
}

export const gEnd = [{ name: 'end', start: C.freeze, end: C.end + 1, draw: sEnd }];
