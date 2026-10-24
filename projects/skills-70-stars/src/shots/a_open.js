// A · the 70th star. Gold ground; ink bars drop on 8ths and become the "skills" wordmark (the reference builds its
// brand mark from dropping bars); a star button counts 66 → 69 under three different hands; one beat of silence;
// a big finger taps 70 and Claude boings up as the dot of the i.
import { P } from '../palette.js';
import { C, STAR_FROM } from '../timeline.js';
import { ease, seg, onN, clamp, lerp, key, BEAT } from '../core.js';
import { wordmark, setFont, starButton, PILL } from '../type.js';
import { pointer } from '../hands.js';
import { claude } from '../claude.js';
import { confetti, starBurst } from '../fx2.js';

export const WM = { text: 'skılls', size: 290, cx: 960, base: 520 };
export const PILL_POS = [960, 800];
export const iIndex = 2;

// Claude sits on the ı as its dot. Shared with act B (which drops it to the floor).
export function dotPose(items) {
  const st = items[iIndex].bar;
  const s = (st.w * 2.25) / 147;
  return { x: st.x + st.w / 2, y: st.y - 26, s };
}

// a finger tap: enters along its direction, presses at tc, retracts
const TAPS = [
  { skin: 'mint', ang: -0.62, s: 62 },
  { skin: 'creamHand', ang: 0.58, s: 62 },
  { skin: 'slate', ang: -1.42, s: 62 },
];
function tapPose(t, tc, ang, dist = 900, { inDur = 0.3, outDur = 0.32, hold = 0.12 } = {}) {
  // returns {d: distance from target along -dir (0 = touching), press 0..1, visible}
  if (t < tc - inDur - 0.02 || t > tc + hold + outDur) return null;
  let d, press = 0, curl = 0;
  if (t < tc - 0.07) { const p = seg(t, tc - inDur, tc - 0.07, ease.outBack); d = lerp(dist, 26, p); curl = 0.2 * p; }
  else if (t < tc) { const p = seg(t, tc - 0.07, tc, ease.in2); d = lerp(26, -10, p); curl = 0.2 * (1 - p); press = p; }
  else if (t < tc + hold) { d = -10; press = 1 - seg(t, tc, tc + hold, ease.out) * 0.6; }
  else { const p = seg(t, tc + hold, tc + hold + outDur, ease.in); d = lerp(-10, dist, p); press = 0.4 * (1 - p); }
  return { d, press, curl };
}

function drawWordmark(ctx, t, items, o = {}) {
  const { hideBars = false } = o;
  const tb = onN(t, 2); // the build moves on 2s like the reference's opening
  items.forEach((it, i) => {
    const td = C.barDrops[i];
    const b = it.bar;
    // drop: fall from above frame, land at td with a squash on 2s
    const fallDur = 0.32;
    if (tb < td - fallDur) return;
    const pf = clamp((tb - (td - fallDur)) / fallDur);
    const yTop = lerp(-b.h - 60, b.y, ease.in2(pf));
    const land = tb >= td ? tb - td : -1;
    const sq = land >= 0 && land < 0.25 ? Math.sin(land / 0.25 * Math.PI) * 0.08 * (1 - land / 0.25) : 0;
    // morph: the glyph is revealed from the bar outward (clip grows from the stem to the glyph box)
    const pm = seg(tb, C.morph + i * 0.035, C.morph + 0.22 + i * 0.035, ease.outBack);
    ctx.save();
    if (pm > 0) {
      const bx = it.box;
      const x0 = lerp(b.x, bx.x - 6, pm), x1 = lerp(b.x + b.w, bx.x + bx.w + 6, pm);
      ctx.beginPath(); ctx.rect(x0, bx.y - 40, Math.max(0, x1 - x0), bx.h + 80); ctx.clip();
      setFont(ctx, WM.size, { fam: 'display', weight: 900, stretch: 'expanded' });
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = P.ink;
      ctx.fillText(it.ch, it.pen, WM.base);
    }
    ctx.restore();
    if (pm < 1 && !hideBars) {
      const h = b.h * (1 - sq), w = b.w * (1 + sq * 0.6);
      ctx.fillStyle = P.ink;
      ctx.fillRect(b.x + b.w / 2 - w / 2, yTop + (b.h - h), w, h);
    }
  });
}

function sOpen(ctx, t) {
  ctx.fillStyle = P.gold; ctx.fillRect(0, 0, 1920, 1080);
  const items = wordmark(WM.text, WM.size, WM.cx, WM.base, { track: -6 });
  drawWordmark(ctx, t, items);

  // star button
  const [px, py] = PILL_POS;
  const pop = seg(t, C.pill, C.pill + 0.38, ease.outBack);
  let n = STAR_FROM, from = STAR_FROM, p = 1, press = 0, fill = 0;
  const allTaps = [...C.taps, C.seventy];
  allTaps.forEach((tc, i) => {
    if (t >= tc) { from = STAR_FROM + i; n = STAR_FROM + i + 1; p = seg(t, tc, tc + 0.2, ease.outBack); }
    const dt = t - tc;
    if (dt > -0.07 && dt < 0.3) press = Math.max(press, dt < 0 ? (dt + 0.07) / 0.07 : 1 - dt / 0.3);
    if (dt >= 0) fill = i === 3 ? 1 : Math.max(fill, dt < 0.5 ? 1 - dt / 0.5 : 0);
  });
  const glow = t >= C.seventy ? Math.min(1, (t - C.seventy) / 0.15) * (0.55 + 0.25 * Math.cos((t - C.seventy) * Math.PI * 2 / (BEAT * 2))) : 0;
  const bounce70 = t >= C.seventy ? 1 + 0.08 * Math.exp(-(t - C.seventy) * 7) * Math.sin((t - C.seventy) * 30) : 1;
  const PS = 1.2;
  starButton(ctx, px, py, { press: clamp(press), fill, count: { from, to: n, p }, scale: pop * bounce70 * PS, glow });
  const starXY = [px + (-PILL.w / 2 + 92) * PS, py + 2 * PS];

  // fingers (three taps, then the big one)
  TAPS.forEach((h, i) => {
    const tp = tapPose(t, C.taps[i], h.ang);
    if (!tp) return;
    const dx = Math.sin(h.ang), dy = -Math.cos(h.ang);
    pointer(ctx, { x: starXY[0] - dx * tp.d, y: starXY[1] + 4 - dy * tp.d, ang: h.ang, s: h.s, skin: h.skin === 'creamHand' ? 'cream' : h.skin, press: tp.press, curl: tp.curl });
  });
  // the 70th: winds up during the hush, jabs on the downbeat
  if (t > C.hush - 0.1 && t < C.seventy + 0.75) {
    const ang = -0.12, dx = Math.sin(ang), dy = -Math.cos(ang);
    const d = key(t, [[C.hush - 0.1, 1100], [C.hush + 0.32, 140, ease.out], [C.seventy - 0.1, 230, ease.inOut], [C.seventy, -14, ease.in2], [C.seventy + 0.16, -14], [C.seventy + 0.75, 1200, ease.in]]);
    const pr = t >= C.seventy - 0.03 && t < C.seventy + 0.2 ? 1 : 0;
    pointer(ctx, { x: starXY[0] - dx * d, y: starXY[1] + 4 - dy * d, ang, s: 96, skin: 'mint', press: pr, curl: t < C.seventy - 0.1 ? 0.25 : 0 });
  }

  // 70: burst + Claude boings out of the ı + confetti
  if (t >= C.seventy) {
    const dt = t - C.seventy;
    starBurst(ctx, starXY[0], starXY[1], dt, { n: 12, r0: 60, r1: 210, life: 0.5, col: P.ink });
    const dp = dotPose(items);
    claudeDot(ctx, t, dp);
    confetti(ctx, px - 180, py - 40, dt - 0.02, { n: 70, seed: 7, dir: -0.35, spread: 0.55, speed: 1900, size: 20 });
    confetti(ctx, px + 180, py - 40, dt - 0.02, { n: 70, seed: 9, dir: 0.35, spread: 0.55, speed: 1900, size: 20 });
  }
  return { vig: 0.02, grain: 0.01 };
}

// Claude pops out of the dotless i and lands as its dot; bounces on the beat, star eyes → happy
export function claudeDot(ctx, t, dp, extra = {}) {
  const dt = t - C.seventy;
  if (dt < 0) return;
  const up = 190;
  let y = dp.y, sx = 1, sy = 1;
  if (dt < 0.42) {
    // ballistic pop from inside the stem top to the apex and down onto the dot position
    const p = dt / 0.42;
    y = dp.y + 40 - (up + 40) * 4 * p * (1 - p) * 1.0 - 0 * p;
    y = lerp(dp.y + 60, dp.y, p) - up * 4 * p * (1 - p);
    sy = dt < 0.08 ? lerp(0.2, 1.25, dt / 0.08) : 1 + 0.12 * (1 - p);
    sx = 1 / Math.sqrt(sy);
  } else {
    const l = dt - 0.42;
    const sq = l < 0.22 ? Math.sin(l / 0.22 * Math.PI) * 0.22 * (1 - l / 0.3) : 0;
    // happy bounce on every beat
    const bt = ((dt - 0.42) % BEAT) / BEAT;
    const hop = l > 0.3 ? Math.max(0, Math.sin(bt * Math.PI)) * 22 : 0;
    y -= hop;
    sy = 1 - sq; sx = 1 + sq * 0.8;
  }
  const appear = clamp(dt / 0.05);
  const cheer = Math.max(0, Math.sin(((dt) % BEAT) / BEAT * Math.PI));
  const arms = dt < 0.42 ? [1.4, 1.4] : [0.3 + 0.9 * cheer, 0.3 + 0.9 * cheer];
  ctx.save();
  if (dt < 0.1) { // emerge from behind the stem top
    ctx.beginPath(); ctx.rect(0, 0, 1920, dp.y + 34); ctx.clip();
  }
  claude(ctx, { x: dp.x, y, s: dp.s, sx, sy, alpha: appear, shadowA: 0.6, eyes: dt < 0.9 ? 'star' : 'happy', arms, style: 'soft', ...extra });
  ctx.restore();
}

export const aOpen = [{ name: 'open', start: 0, end: C.collapse, draw: sOpen }];
