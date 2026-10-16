// 14 seconds, one continuous camera, three acts:
//  1. the studio — Claude, holding a clapperboard for the video-by-reference skill, studies a video
//     you love (a bouncing-ball test): a scan sweeps it, its frames peel off into a filmstrip, its
//     palette, motion and sound lift out and fly into Claude. Clap.
//  2. the short — the camera pushes into the frame: the same pastel style, a new story. GitHub's
//     Invertocat turns into the official Octocat, who catches a falling star on its tail and flicks
//     it into the repo's Star button: STARS.
//  3. the wrap — pull back to the studio; Claude claps "that's a wrap", the Octocat waves from the
//     screen, gentle confetti, the repo and its count below.
import { W, H, clamp, lerp, TAU } from './core.js';
import { C, STARS } from './timeline.js';
import { sp, smooth, eio, eout } from './kit.js';
import { claude } from './claude.js';
import { short, catCanvas } from './short.js';
import { wall, card, filmstrip, chips, clapper, lockup, bunting, IN, CARD_C, FLOOR } from './studio.js';
import { ballPos } from './sky.js';
import { star, confettiRain } from './fx.js';

// ---- camera: zoom z about focus (cx, cy); full = the card's screen fills the frame
const FULL = { z: W / IN.w, cx: CARD_C[0], cy: CARD_C[1] };
const REST = { z: 1.08, cx: 960, cy: 486 };
const STUDY = { z: 1.12, cx: 990, cy: 466 };
const WRAP = { z: 1.07, cx: 960, cy: 500 };
function lerpCam(a, b, u) { // log-space zoom keeps the push-in speed even
  return { z: Math.exp(lerp(Math.log(a.z), Math.log(b.z), u)), cx: lerp(a.cx, b.cx, u), cy: lerp(a.cy, b.cy, u) };
}
export function camAt(t) {
  if (t < C.scan) return REST;
  if (t < C.zoomIn) return lerpCam(REST, STUDY, eio((t - C.scan) / 1.4));
  if (t < C.zoomInEnd) return lerpCam(STUDY, FULL, eio((t - C.zoomIn) / (C.zoomInEnd - C.zoomIn)));
  if (t < C.zoomOut) return FULL;
  if (t < C.zoomOutEnd) return lerpCam(FULL, WRAP, eio((t - C.zoomOut) / (C.zoomOutEnd - C.zoomOut)));
  return lerpCam(WRAP, { z: 1.1, cx: 970, cy: 490 }, smooth((t - C.zoomOutEnd) / 3.5));
}
const isFull = t => t >= C.zoomInEnd && t < C.zoomOut;

// ---- Claude: hops in with the board, presents it, studies, absorbs the style, claps; wraps
const CX = 350, CS = 30;
function claudeState(t) {
  const u = clamp((t - C.hop) / (C.land - C.hop));
  let x = lerp(-160, CX, eout(u)), lift = Math.sin(Math.PI * u) * 170, squash = u > 0 && u < 1 ? -0.4 * Math.sin(Math.PI * u) : 0;
  if (t < C.hop) x = -400;
  const land = t - C.land;
  if (land > 0) squash += 0.8 * Math.exp(-land * 7) * Math.cos(land * 22);
  for (const c of [C.clap, C.wrap]) { // snap of the clap
    const d = t - c;
    if (d > -0.06 && d < 0.5) squash += d < 0 ? 0.3 * (1 + d / 0.06) : 0.45 * Math.exp(-d * 9) * Math.cos(d * 26);
  }
  const absorb = t - C.absorb - 0.3;
  if (absorb > 0 && absorb < 0.5) squash += 0.35 * Math.exp(-absorb * 8) * Math.cos(absorb * 24);
  // the wrap: a happy hop, then small bounces on the beat
  const h = t - C.wrap - 0.35;
  if (h > 0 && h < 0.5) lift += Math.sin(Math.PI * h / 0.5) * 70;
  if (t > C.wrap + 1) lift += Math.max(0, Math.sin(Math.PI * ((t - C.wrap) % 0.5) / 0.5)) * 6;
  // idle breathing
  if (t > C.land + 0.5) lift += Math.sin(t * 3.2) * 2;
  return { x, lift, squash };
}
// board-holding arm (radians up), clapstick opening, board pop
function boardAt(t) {
  let arm = 0.5, open = 0, pop = 0, flash = 0;
  pop += 0.08 * Math.exp(-Math.max(0, t - C.slate) * 6) * Math.sin(Math.max(0, t - C.slate) * 20) * (t > C.slate ? 1 : 0);
  for (const c of [C.clap, C.wrap]) {
    const raise = c - 0.25;
    arm += 0.45 * smooth((t - raise) / 0.18) * (1 - smooth((t - c - 0.35) / 0.3));
    if (t > raise && t < c) open = 0.62 * eout((t - raise) / 0.16) * (1 - Math.pow(clamp((t - c + 0.06) / 0.06), 2));
    if (t >= c && t < c + 0.25) { open = Math.max(0, 0.1 * Math.sin((t - c) * 40) * Math.exp(-(t - c) * 14)); flash = Math.max(flash, 1 - (t - c) / 0.25); }
  }
  return { arm, open, pop, flash };
}
function claudeHand(t, cs, arm) {
  const sx = 1 + cs.squash * 0.14, sy = 1 - cs.squash * 0.14;
  const hx = cs.x + 4 * CS * sx, hy = FLOOR - cs.lift - 6 * CS * sy;
  return [hx + (2 * Math.cos(arm) + Math.sin(arm)) * CS * sx, hy + (-2 * Math.sin(arm) + Math.cos(arm)) * CS * sy];
}

function drawStudio(ctx, t) {
  wall(ctx, t);
  // the card: the reference before the clap, the short after (overlays fade while we're inside it)
  const inside = smooth((t - C.zoomIn) / 0.4) * (1 - smooth((t - C.zoomOut - 0.2) / 0.5));
  const progress = t < C.clap ? (t % 2.4) / 2.4 : clamp((t - C.clap) / (C.end - C.clap - 1));
  const scan = t >= C.scan && t <= C.scan + 0.65 ? (t - C.scan) / 0.65 : -1;
  card(ctx, t, c => short(c, t), { ui: 1 - inside, progress, scan });
  filmstrip(ctx, t);
  // Claude + the clapperboard
  const cs = claudeState(t), b = boardAt(t);
  let blink = 0;
  for (const bt of [1.6, 4.0, 10.1, 11.9, 13.2]) blink = Math.max(blink, Math.max(0, 1 - Math.abs(t - bt) / 0.07));
  let look = t > C.wrap + 0.7 ? [0.2, 0] : t > C.zoomOut ? [1, -0.1] : t > C.slate + 0.6 ? [1, -0.3] : t > C.slate - 0.1 ? [0, 0] : [1, 0];
  if (t > C.slate + 0.6 && t < C.chips) { // eyes follow the bouncing ball in the reference
    const b = ballPos(t), bx = IN.x + b.x * IN.w / 1920, by = IN.y + b.y * IN.h / 1080, ex = cs.x, ey = FLOOR - cs.lift - 6.5 * CS;
    const d = Math.hypot(bx - ex, by - ey) || 1; look = [(bx - ex) / d, (by - ey) / d * 1.6];
  }
  const happy = (t > C.absorb + 0.32 && t < C.raise) || (t > C.wrap && t < C.wrap + 1.6) || (t > C.slate && t < C.slate + 0.5) ? 1 : 0;
  const wave = t > C.wrap + 0.55 ? (1.05 + Math.sin((t - C.wrap) * 10) * 0.35) * smooth((t - C.wrap - 0.55) / 0.2) * (1 - smooth((t - C.wrap - 2.2) / 0.3)) : (t < C.land ? 0.8 : 0);
  claude(ctx, cs.x, FLOOR, CS, { squash: cs.squash, lift: cs.lift, armL: wave, armR: b.arm, blink, happy, look });
  const [hx, hy] = claudeHand(t, cs, b.arm);
  if (t > C.hop) clapper(ctx, hx - 30, hy + 52, { open: b.open, pop: b.pop, flash: b.flash, rot: -0.06 - (b.arm - 0.5) * 0.25, scale: 1.18 });
  // the style flies into Claude (aimed at its face)
  chips(ctx, t, [cs.x, FLOOR - cs.lift - 6.6 * CS]);
  lockup(ctx, t, STARS, (c, x, y, r) => star(c, x, y, r, { shadow: 0 }));
  bunting(ctx, t);
  confettiRain(ctx, t - C.wrap, { n: 46, seed: 21, life: 4.5, speed: 230, w: W });
}

export const film = {
  duration: C.end,
  render: { supersample: 1.5 },
  blurAt(t) {
    const fast = [[C.zoomIn, C.zoomInEnd], [C.zoomOut, C.zoomOutEnd], [C.pop - 0.04, C.pop + 0.3], [C.flick - 0.05, C.hit + 0.1], [C.hop, C.land]];
    return fast.some(([a, b]) => t > a && t < b) ? 5 : 1;
  },
  async load() {
    await Promise.all(['600 40px "Mona Sans"', '700 40px "Mona Sans"'].map(f => document.fonts.load(f)));
    catCanvas();
  },
  draw(ctx, t) {
    if (isFull(t)) short(ctx, t);                // inside the card: the short fills the frame
    else {
      const cam = camAt(t);
      ctx.fillStyle = '#e6ecf5'; ctx.fillRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2); ctx.scale(cam.z, cam.z); ctx.translate(-cam.cx, -cam.cy);
      drawStudio(ctx, t);
      ctx.restore();
    }
    const f = Math.max(1 - smooth(t / 0.12), smooth((t - C.fadeOut) / (C.end - C.fadeOut)));
    if (f > 0) { ctx.fillStyle = `rgba(240,244,250,${f})`; ctx.fillRect(0, 0, W, H); }
    return { vig: 0.1, grain: 0.012, contrast: 1.0, saturation: 1.03 };
  },
};
export { TAU };
