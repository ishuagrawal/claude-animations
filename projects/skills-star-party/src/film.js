// 14 seconds, one continuous frame, no cuts:
//  1. Claude Code — Claude drops onto the Claude Code card and types /video-by-reference with a video
//     it loves attached; stomps enter. The clip springs out and is studied (scan, the ball tracked, the
//     frame sampled); its style lifts out into the card: four swatches, a motion curve, a sound wave.
//  2. Make — Claude hops; the chips fly out and build the new world (the sky opens, the sun, the hills,
//     the flowers), the motion chip becomes GitHub's Invertocat and the card docks into a pill at the
//     bottom left, Claude riding it. The short plays: the Invertocat turns into the official Octocat,
//     who catches a falling star on its tail and flicks it into the repo's Star button: STARS. Claude
//     watches from its pill, whose ✻ spins until the star lands.
//  3. The wrap — the pill reads "Made with /video-by-reference"; Claude and the Octocat wave, confetti
//     pops from the pill, and they jump together.
import { W, H, clamp, lerp, TAU } from './core.js';
import { C } from './timeline.js';
import { sp, smooth, eio, eout } from './kit.js';
import { claude } from './claude.js';
import { github, catCanvas, starPos, countTarget, LOGO } from './short.js';
import { sky } from './sky.js';
import { confetti, confettiRain } from './fx.js';
import { CARD, PILL, cardContent, pillContent, pillWidth, eqPos, shell, stage, tile, chips, chipPops, wipeR, WIPE, FLOWER_X, keyTimes } from './ui.js';

// ---- the camera: close on Claude Code (a slow push), pulling back to 1:1 as the new world builds
export const camZ = t => t < C.make + 0.05 ? lerp(1.27, 1.32, smooth(t / 3)) : lerp(1.32, 1, eio((t - C.make - 0.05) / (C.dockEnd - C.make - 0.05)));
const toCam = (p, t) => { const z = camZ(t); return [(p[0] - 960) / z + 960, (p[1] - 540) / z + 540]; };

// ---- the frame: the card, morphing into the pill
const ride = t => eio((t - C.dock) / (C.dockEnd - C.dock));
function dip(t) { // the card (and later the pill) gives a little under Claude's landings
  let d = 0;
  for (const [c, a] of [[C.land, 16], [C.enter, 12], [C.make + 0.3, 8], [C.dockEnd, 9], [C.hit + 0.44, 5], [C.jump + 0.5, 6]]) {
    const u = t - c;
    if (u > 0 && u < 0.8) d += a * Math.exp(-u * 8) * Math.sin(u * 24);
  }
  return d;
}
export function frameRect(t) {
  const u = ride(t), P = { x: PILL.x, y: PILL.cy - PILL.h / 2, w: pillWidth(t), h: PILL.h, r: PILL.h / 2 };
  const R = u <= 0 ? { ...CARD } : u >= 1 ? P : { x: lerp(CARD.x, P.x, u), y: lerp(CARD.y, P.y, u), w: lerp(CARD.w, P.w, u), h: lerp(CARD.h, P.h, u), r: lerp(CARD.r, P.r, u) };
  R.y += dip(t);
  return R;
}
const eqAtDock = () => eqPos({ x: PILL.x, y: PILL.cy - PILL.h / 2, w: pillWidth(C.dockEnd), h: PILL.h });

// ---- the world, built from the learned style
function world(t) {
  if (t < C.wipe) return null;
  const r = wipeR(t);
  return {
    wipe: r < 9000 ? { x: WIPE[0], y: WIPE[1], r } : null,
    sun: Math.max(0, sp(t, C.sun, 2.0, 0.42)),
    back: Math.max(0, sp(t, C.hills, 1.7, 0.55)),
    hills: Math.max(0, sp(t, C.hills + 0.07, 1.8, 0.5)),
    flowerAge: t - C.flowers, flowerX: FLOWER_X,
  };
}

// ---- Claude
function claudeAt(t, R) {
  if (t < C.hop) return null;
  const u = ride(t);
  const s = 12;
  const x = R.x + lerp(130, 70, u), y = R.y;
  let lift = 0, squash = 0, armL = 0.12, armR = 0.12, happy = 0, tilt = 0;
  // drops in from above, stretched
  if (t < C.land) { const v = (t - C.hop) / (C.land - C.hop); lift = 820 * (1 - v * v); squash = -0.4 * smooth(v * 4); armL = armR = 0.9; }
  // hops: the stomp (enter), the go (make), the cheer (hit), the credit, the jump
  for (const [a, b, h, arms] of [[C.stomp, C.enter, 90, 0.9], [C.make, C.make + 0.3, 80, 1.3], [C.hit + 0.02, C.hit + 0.44, 70, 1.3], [C.credit, C.credit + 0.3, 34, 0.6], [C.jump, C.jump + 0.5, 70, 1.3]]) {
    if (t > a && t < b) { const v = (t - a) / (b - a); lift += Math.sin(Math.PI * v) * h; squash -= 0.25 * Math.sin(Math.PI * v); armL = armR = arms; }
    const pre = a - t; // anticipation
    if (pre > 0 && pre < 0.08) squash += 0.3 * (1 - pre / 0.08);
  }
  for (const c of [C.land, C.enter, C.make + 0.3, C.dockEnd, C.hit + 0.44, C.credit + 0.3, C.jump + 0.5]) { // landings
    const d = t - c;
    if (d > 0 && d < 0.7) squash += 0.75 * Math.exp(-d * 7) * Math.cos(d * 22);
  }
  // typing: arms patter on the card
  if (t > C.type && t < C.typeEnd + 0.05) { armL = 0.12 + 0.3 * Math.max(0, Math.sin(t * 38)); armR = 0.12 + 0.3 * Math.max(0, Math.sin(t * 38 + Math.PI)); squash += 0.05 * Math.sin(t * 76); }
  // style learned: a little arms-up
  if (t > C.learned && t < C.make) { armL = armR = 0.12 + 0.9 * smooth((t - C.learned) / 0.1); squash -= 0.1 * Math.sin(Math.PI * clamp((t - C.learned) / 0.22)); happy = 1; }
  // riding the card down: lean against the motion, arms out for balance
  if (u > 0 && u < 1) { tilt = 0.16 * Math.sin(Math.PI * u); armL = 0.7 + 0.2 * Math.sin(t * 20); armR = 0.5 + 0.2 * Math.sin(t * 20 + 1); }
  // the cheer, the wave, the happy bounces on the beat with the Octocat
  if (t > C.hit && t < C.hit + 1.1) { armL = armR = Math.max(armL, 1.2 + 0.15 * Math.sin((t - C.hit) * 16)); happy = 1; }
  if (t > C.pop && t < C.pop + 0.5) happy = 1;
  if (t > C.wrap) {
    const w = smooth((t - C.wrap) / 0.15) * (1 - smooth((t - C.wrap - 1.7) / 0.3));
    armR = lerp(armR, 1.25 + Math.sin((t - C.wrap) * 11) * 0.38, w);
    if (t < C.wrap + 2.2) happy = 1;
  }
  if (t > C.jump - 0.1 && t < C.jump + 0.9) happy = 1;
  if (t > C.hit + 0.7 && t > C.jump + 0.6) { const b = ((t - C.hit - 0.7) % 1) / 1; lift += Math.max(0, Math.sin(Math.PI * b * 2)) * 5; }
  if (t > C.land + 0.4) lift += Math.sin(t * 3.4) * 1.5;  // breathing
  let blink = 0;
  for (const bt of [1.12, 2.62, 4.3, 6.55, 9.35, 12.3, 13.15]) blink = Math.max(blink, Math.max(0, 1 - Math.abs(t - bt) / 0.07));
  if (happy) blink = 0;
  // where Claude looks
  const ex = x, ey = y - lift - 6.5 * s;
  const at = ([tx, ty]) => { const dx = tx - ex, dy = ty - ey, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d * 1.4]; };
  let look = [0, 0.2];
  if (t < C.land + 0.25) look = [0, 0.8];
  else if (t < C.type) look = [0.15, 0.1];
  else if (t < C.attach + 0.05) look = at([R.x + 140 + (t - C.type) * 600, R.y + 124]);
  else if (t < C.tile) look = at([R.x + 690, R.y + 124]);
  else if (t < C.chips) { look = at([1334, 352]); }
  else if (t < C.learned) look = at([CARD.x + 64 + Math.min(5, Math.floor((t - C.chips) / 0.07)) * 78, CARD.y + 292]);
  else if (t < C.make) look = [0.1, 0.1];
  else if (t < C.dockEnd) look = at([1200, 260]);
  else if (t < C.pop + 0.3) look = at(LOGO);
  else if (t < C.starIn) look = at([960, 600]);
  else if (t < C.hit) { const p = starPos(t); look = p ? at([p.x, p.y]) : at([960, 500]); }
  else if (t < C.hit + 1) look = at(countTarget());
  else if (t < C.credit) look = at([960, 600]);
  else if (t < C.wrap - 0.1) look = [0.2, 0.15];
  else if (t < C.wrap + 2.4) look = at([960, 590]);
  else look = [0.15, 0.1];
  return { x, y, s, lift, squash, armL, armR, happy, tilt, blink, look };
}

// ---- drawing
function drawFrame(ctx, t) {
  const B = world(t);
  if (!B || B.wipe) stage(ctx, t);
  if (B) sky(ctx, t, B);
  github(ctx, t);
  const z = camZ(t);
  ctx.save();
  if (z !== 1) { ctx.translate(960, 540); ctx.scale(z, z); ctx.translate(-960, -540); }
  tile(ctx, t);
  // the card / pill, springing in
  const k = clamp(sp(t, C.card, 1.6, 0.62), 0, 1.2);
  if (k > 0.002) {
    const R = frameRect(t), u = ride(t);
    ctx.save();
    if (t < C.card + 1) {
      const s = lerp(0.86, 1, k), cx = CARD.x + CARD.w / 2, cy = CARD.y + CARD.h / 2;
      ctx.globalAlpha *= clamp(k * 1.8); ctx.translate(cx, cy + (1 - Math.min(1, k)) * 40); ctx.scale(s, s); ctx.translate(-cx, -cy);
    }
    shell(ctx, R);
    cardContent(ctx, t, R, 1 - smooth((u - 0.08) / 0.4));
    pillContent(ctx, t, R, smooth((u - 0.4) / 0.4));
    const c = claudeAt(t, R);
    if (c) claude(ctx, c.x, c.y, c.s, { squash: c.squash, lift: c.lift, armL: c.armL, armR: c.armR, blink: c.blink, happy: c.happy, look: c.look, tilt: c.tilt, shadow: c.lift > 300 ? 0 : 1 });
    ctx.restore();
  }
  chips(ctx, t, eqAtDock(), toCam);
  ctx.restore();
  chipPops(ctx, t, eqAtDock());
  // celebration
  confettiRain(ctx, t - C.hit, { n: 70, seed: 11, life: 6.5, speed: 240 });
  const R = frameRect(t);
  confetti(ctx, R.x + R.w * 0.62, R.y + 6, t - C.wrap - 0.05, { n: 44, seed: 4, dir: -1.2, spread: 0.5, speed: 1400, life: 3.2, size: 15, streamers: 2 });
}

export const film = {
  duration: C.end,
  render: { supersample: 1.5 },
  blurAt(t) {
    const fast = [[C.hop + 0.1, C.land], [C.make, C.dockEnd + 0.05], [C.pop - 0.04, C.pop + 0.3], [C.flick - 0.05, C.hit + 0.1]];
    return fast.some(([a, b]) => t > a && t < b) ? 5 : 1;
  },
  async load() {
    await Promise.all(['600 40px "Mona Sans"', '700 40px "Mona Sans"', '500 30px "Monaspace Neon"', '600 30px "Monaspace Neon"'].map(f => document.fonts.load(f)));
    catCanvas();
  },
  draw(ctx, t) {
    drawFrame(ctx, t);
    const f = Math.max(1 - smooth(t / 0.12), smooth((t - C.fadeOut) / (C.end - C.fadeOut)));
    if (f > 0) { ctx.fillStyle = `rgba(240,244,250,${f})`; ctx.fillRect(0, 0, W, H); }
    return { vig: 0.1, grain: 0.012, contrast: 1.0, saturation: 1.03 };
  },
};
export { TAU, keyTimes };
