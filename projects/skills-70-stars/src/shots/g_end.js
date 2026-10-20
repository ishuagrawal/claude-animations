// G · thank-you + the tease. Ink bars drop and become "70+" (like the opening's wordmark); Claude lands on the 0.
// Then the film's opening setup comes back with one change: a reference tile lowers on its string next to Claude,
// but it's a still picture (white print, picture badge, no play button). The credit types out as
// "> /skills:video-by-reference", "video" is backspaced to a blinking blank, a "soon" tag pops, and the picture
// flashes like a camera. Nothing is named.
import { P, rgba } from '../palette.js';
import { C } from '../timeline.js';
import { ease, seg, clamp, lerp, key, onN, BEAT, TAU } from '../core.js';
import { setFont, wordmark, starPath } from '../type.js';
import { drop } from '../soft.js';
import { claude } from '../claude.js';
import { tile, TILE } from '../tile.js';
import { starBurst } from '../fx2.js';
import { cardLayer } from './c_card.js';

const END = { text: '70+', size: 300, cx: 960, base: 440 };
const PRE = '/skills:', WORD = 'video', POST = '-by-reference';
const TYPE_AT = C.cmd, CPS = 30;
const IMG = { x: 1545, y: 120, s: 1.25 };

function ground(ctx) {
  ctx.fillStyle = P.gold; ctx.fillRect(0, 0, 1920, 1080);
  const g = ctx.createRadialGradient(960, 470, 0, 960, 470, 1100);
  g.addColorStop(0, rgba(P.goldLt, 0.22)); g.addColorStop(1, rgba(P.goldLt, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
}

function endType(ctx, t) {
  const items = wordmark(END.text, END.size, END.cx, END.base, { track: -8 });
  const tb = onN(t, 2); // the build moves on 2s like the opening
  items.forEach((it, i) => {
    const td = C.type + 0.15 + i * BEAT / 4, b = it.bar;
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
  const l1 = seg(t, C.typeDone + 0.35, C.typeDone + 0.7, ease.out);
  if (l1 > 0) {
    ctx.save(); ctx.globalAlpha = l1;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.ink;
    setFont(ctx, 64, { fam: 'ui', weight: 700, track: -1 });
    ctx.fillText('thank you, stargazers', 960, 572 + (1 - l1) * 30);
    setFont(ctx, 32, { fam: 'mono', weight: 500 });
    ctx.fillStyle = rgba(P.ink, 0.78);
    ctx.fillText('github.com/ishuagrawal/skills', 960, 900 + (1 - l1) * 20);
    ctx.restore();
  }
  return items;
}

// the credit line: types the command, then backspaces "video" — leaving a gold blank exactly five letters wide
// with the caret blinking in it; returns the chip's right edge
function command(ctx, t) {
  if (t < TYPE_AT) return null;
  const full = PRE + WORD + POST;
  const typed = Math.floor(clamp((t - TYPE_AT) * CPS, 0, full.length));
  const erasing = t >= C.erase;
  const gone = erasing ? Math.floor(clamp((t - C.erase) / 0.06, 0, WORD.length)) : 0;
  setFont(ctx, 46, { fam: 'mono', weight: 600, track: -0.5 });
  const wPrompt = ctx.measureText('> ').width, wPre = ctx.measureText(PRE).width;
  const wWord = ctx.measureText(WORD).width, wFull = ctx.measureText(full).width;
  const pad = 36, cw = wPrompt + wFull + 30 + pad * 2, ch = 88, cx = 960 - cw / 2, cy = 700;
  const pop = ease.outBack(seg(t, TYPE_AT - 0.2, TYPE_AT, ease.lin));
  ctx.save();
  ctx.translate(960, cy); ctx.scale(pop, pop); ctx.translate(-960, -cy);
  const chip = new Path2D(); chip.roundRect(cx, cy - ch / 2, cw, ch, 22);
  drop(ctx, chip, { dx: 10, dy: 14, blur: 22, a: 0.22 });
  ctx.fillStyle = P.ink; ctx.fill(chip);
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const x0 = cx + pad;
  ctx.fillStyle = P.gold; ctx.fillText('> ', x0, cy + 2);
  const xt = x0 + wPrompt;
  const blink = Math.floor((t - TYPE_AT) * 2.4) % 2 === 0;
  if (!erasing) {
    const s = full.slice(0, typed);
    ctx.fillStyle = P.cream; ctx.fillText(s, xt, cy + 2);
    if (typed < full.length || blink) { ctx.fillStyle = rgba(P.cream, 0.9); ctx.fillRect(xt + ctx.measureText(s).width + 3, cy - 23, 22, 48); }
  } else {
    const left = PRE + WORD.slice(0, WORD.length - gone);
    ctx.fillStyle = P.cream; ctx.fillText(left, xt, cy + 2);
    ctx.fillText(POST, xt + wPre + wWord, cy + 2);
    // the blank: a gold slot where "video" was
    const slot = seg(t, C.erase + 0.05, C.erase + 0.4, ease.out);
    ctx.fillStyle = rgba(P.gold, slot);
    ctx.fillRect(xt + wPre + 2, cy + 24, (wWord - 4) * slot, 6);
    const caretX = xt + ctx.measureText(left).width + 3;
    if (gone < WORD.length || blink) { ctx.fillStyle = P.gold; ctx.fillRect(caretX, cy - 23, 22, 48); }
  }
  ctx.restore();
  return { right: cx + cw, cy };
}

function soon(ctx, t, chip) {
  if (!chip || t < C.soon) return;
  const p = ease.outBack(seg(t, C.soon, C.soon + 0.3, ease.lin), 2.2);
  const pulse = 1 + 0.04 * Math.sin((t - C.soon) * TAU / (BEAT * 2));
  const x = chip.right + 28, y = chip.cy;
  ctx.save();
  ctx.translate(x + 106, y); ctx.rotate(-0.08); ctx.scale(p * pulse, p * pulse);
  const tag = new Path2D(); tag.roundRect(-106, -44, 212, 88, 44);
  drop(ctx, tag, { dx: 8, dy: 12, blur: 16, a: 0.22 });
  ctx.fillStyle = P.cream; ctx.fill(tag);
  ctx.lineWidth = 5; ctx.strokeStyle = P.ink; ctx.stroke(tag);
  setFont(ctx, 50, { fam: 'ui', weight: 800, track: 0.5 });
  ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('soon', 16, 2);
  ctx.fillStyle = P.gold; ctx.fill(starPath(-62, 0, 19, 9));
  ctx.lineWidth = 3.5; ctx.stroke(starPath(-62, 0, 19, 9));
  ctx.restore();
}

// the still-image reference lowers on its string, swings, and flashes like a camera at C.snap
function imageTile(ctx, t) {
  if (t < C.imgIn) return null;
  const y = key(t, [[C.imgIn, -480], [C.imgIn + 0.7, IMG.y + 16, ease.out], [C.imgIn + 1.0, IMG.y, ease.inOut]]);
  const dt = t - C.imgIn;
  const swing = dt > 0.6 ? 0.08 * Math.exp(-(dt - 0.6) * 2) * Math.sin((dt - 0.6) * 6.5) : 0;
  const flash = t >= C.snap ? Math.max(0, 1 - (t - C.snap) / 0.35) : 0;
  tile(ctx, IMG.x, y, { image: true, s: IMG.s, swing, flash, stringTop: -40 });
  const c = [IMG.x, y + (12 + TILE.h / 2) * IMG.s];
  if (t >= C.snap) starBurst(ctx, c[0], c[1], t - C.snap, { n: 14, r0: 190, r1: 330, life: 0.45, col: P.ink });
  return c;
}

function sEnd(ctx, t) {
  ground(ctx);
  const items = endType(ctx, t);
  // Claude drops onto the 0, then watches the picture come down; hops at "soon"; the flash makes it blink
  const zero = items[1];
  const tl = C.typeDone + 0.3;
  if (t > tl - 0.35) {
    const fall = seg(t, tl - 0.35, tl, ease.in2);
    const l = t - tl;
    const sq = l > 0 && l < 0.25 ? Math.sin(l / 0.25 * Math.PI) * 0.2 : 0;
    const hop = t > C.soon && t < C.soon + 0.45 ? Math.sin((t - C.soon) / 0.45 * Math.PI) * 46 : 0;
    const watching = t > C.imgIn + 0.15;
    let eyes = l > 0.2 ? 'happy' : 'wide';
    if (watching) eyes = t < C.soon ? 'wide' : 'happy';
    if (t >= C.snap && t < C.snap + 0.3) eyes = 'closed';
    else if (t >= C.snap + 0.3) eyes = 'star';
    const arms = t > C.soon ? [0.3 + (hop / 46) * 1.1, 0.3 + (hop / 46) * 1.1] : [0.2, 0.25];
    claude(ctx, { x: zero.box.x + zero.box.w / 2, y: lerp(-200, zero.box.y, fall) - hop, s: 0.95, sy: 1 - sq, sx: 1 + sq * 0.7, eyes, look: watching ? [0.9, -0.8] : [0, 0], arms, shadowA: 0.6 });
  }
  imageTile(ctx, t);
  const chip = command(ctx, t);
  soon(ctx, t, chip);
  // the card from the previous shot is still on its way out (and its confetti still falling)
  if (t < C.cheer + 3.4) cardLayer(ctx, t);
  const fade = seg(t, C.fade, C.end - 0.04, ease.inOut);
  if (fade > 0) { ctx.fillStyle = rgba('#000000', fade); ctx.fillRect(0, 0, 1920, 1080); }
  const flash = t >= C.snap && t < C.snap + 2 / 24 ? 0.55 : 0;
  return { vig: 0.03, grain: 0.01, flash, flashCol: [1, 1, 1] };
}

export const gEnd = [{ name: 'end', start: C.type, end: C.end + 1, draw: sEnd }];
