// INTRO — the GitHub app icon is clicked; the Invertocat's cut-out lights up with the fully modelled
// Octocat (aligned to the mark's head: centre (12,12) of the 24-unit glyph, half-width 6.83 units);
// the white mark dissolves outward from the cat, the tentacles unfurl, the eyes open, and the icon
// opens into the window of the milestone page while the Octocat steps over to its spot in the hero.
// Also owns the Octocat's whole-film pose (wave hello, watch the cursor, cheer at the star).
import { C } from '../timeline.js';
import { PANEL, HERO, toRest } from '../layout.js';
import { clamp, lerp, TAU } from '../core.js';
import { sp, eio, eout, smooth, glow } from '../kit.js';
import { ICONS } from '../icons.js';
import { rgba } from '../palette.js';
import { txt } from '../ui.js';

const IC = [960, 520];          // icon centre (rest coords)
const SQ = 300;                 // squircle size at rest
const MARK = SQ * 0.66;         // mark size (24 glyph units)
const K = 6.83;                 // model unit = K glyph units (mark head half-width)
const S0 = MARK / 24 * K;       // model scale inside the icon (≈56)
const S1 = 96;                  // model scale once it has popped out
const markPath = new Path2D(ICONS.github);

const grow = t => eio((t - C.dissolve - 0.05) / 0.6);           // model + icon zoom while the mark dissolves
const openK = t => eio((t - C.open) / (C.openEnd - C.open));     // icon → window
export const iconK = t => 1 - smooth((t - C.open) / (C.openEnd - C.open) * 1.4); // icon look → panel look

// The window's rounded rect over time (icon squircle → panel)
// spring-in, hover lift and click squash of the icon (the model inside follows it)
function iconScale(t) {
  const k = sp(t, C.icon, 1.6, 0.55);
  const press = t > C.click ? Math.exp(-(t - C.click) * 7) * Math.sin((t - C.click) * 22) * 0.05 : 0;
  const hover = smooth((t - C.click + 0.45) / 0.3) * (1 - smooth((t - C.click) / 0.1)) * 0.03;
  return k * (1 + hover - Math.abs(press) * 0.6);
}
export function panelRect(t) {
  const s = SQ * iconScale(t) * (1 + grow(t) * (S1 / S0 - 1));
  const ic = { x: IC[0] - s / 2, y: IC[1] - s / 2, w: s, h: s, r: s * 0.235 };
  const m = openK(t);
  if (m <= 0) return ic;
  return { x: lerp(ic.x, PANEL.x, m), y: lerp(ic.y, PANEL.y, m), w: lerp(ic.w, PANEL.w, m), h: lerp(ic.h, PANEL.h, m), r: lerp(ic.r, PANEL.r, m) };
}

// cursor-follow for the Octocat's eyes (set by film.js each frame)
let cursorPos = [960, 900];
export const setCursor = p => { cursorPos = p; };

export function octoPose(t) {
  const H = toRest(HERO.octo.x, HERO.octo.y, t);
  const g = grow(t);
  // step over to the hero spot as the window opens (slight overshoot)
  const m = sp(t, C.open + 0.05, 1.1, 0.75);
  let s = lerp(S0, S1, g) * lerp(iconScale(t), 1, clamp(m)), x = IC[0], y = IC[1];
  x = lerp(x, H[0], m); y = lerp(y, H[1], m); s = lerp(s, HERO.octo.s, m);
  const alive = t >= C.alive;
  const bob = alive ? Math.sin((t - C.alive) * 2.4) * 6 : 0;
  // blinks: eyes closed until alive, then quick blinks
  let blink = alive ? Math.max(0, 1 - (t - C.alive) / 0.14) : 1;
  for (const b of [3.7, 6.6, 9.4, 12.1]) blink = Math.max(blink, Math.max(0, 1 - Math.abs(t - b) * 12));
  // wave hello as the page appears, cheer at the star
  const wave = smooth((t - C.h1) / 0.3) * (1 - smooth((t - C.toStar + 0.1) / 0.3));
  const cheer = smooth((t - C.star - 0.04) / 0.18) * (1 - smooth((t - C.star - 1.4) / 0.5));
  const hop = t > C.star ? Math.max(0, Math.sin((t - C.star) * 7.5)) * Math.exp(-(t - C.star) * 2.2) : 0;
  // look: toward the cursor once alive (eyes track it), ahead before
  let look = [0, 0];
  if (alive) {
    const dx = cursorPos[0] - x, dy = cursorPos[1] - (y + 0.1 * s), d = Math.hypot(dx, dy) || 1;
    const k = Math.min(1, d / 260) * smooth((t - C.alive - 0.2) / 0.4);
    look = [dx / d * k, dy / d * k * 0.8];
  }
  return {
    x, y: y + bob - hop * 26, s,
    o: {
      t, rot: alive ? Math.sin((t - C.alive) * 1.7) * 0.035 : 0, blink: Math.min(1, blink), grow: sp(t, C.dissolve, 1.4, 0.5),
      look, happy: cheer > 0.5 ? 1 : 0, mouth: alive ? 0.45 + cheer * 0.5 : 0, wave, cheer, squash: -hop * 0.6,
    },
  };
}

// glow behind the model, the white mark (disc minus cat) dissolving outward, the app label
export function drawMarkBack(ctx, t) {
  const p = octoPose(t), on = smooth((t - C.click) / 0.5);
  if (on > 0 && t < C.openEnd + 1) {
    const fade = 1 - smooth((t - C.open) / 0.9);
    glow(ctx, p.x, p.y + p.s * 0.6, p.s * 4.2, '#8957e5', 0.32 * on * (0.5 + 0.5 * fade));
    glow(ctx, p.x + p.s * 0.8, p.y, p.s * 3, '#2f81f7', 0.18 * on * fade);
  }
}
export function drawMarkFront(ctx, t) {
  const p = octoPose(t);
  const unit = p.s / K;
  const dis = clamp((t - C.dissolve) / (C.alive - C.dissolve + 0.05));
  if (dis >= 1 || t < C.icon) return;
  ctx.save();
  ctx.translate(IC[0], IC[1]); ctx.scale(unit, unit); ctx.translate(-12, -12);
  if (dis <= 0) ctx.fillStyle = '#ffffff';
  else {
    const Rr = 13, rd = dis * Rr * 1.1;
    const g = ctx.createRadialGradient(12, 12, 0, 12, 12, Rr);
    const a = Math.max(0, rd - 1.6) / Rr, b = Math.min(0.999, rd / Rr);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(Math.max(0.0001, a), 'rgba(255,255,255,0)');
    g.addColorStop(Math.max(a + 0.0001, b), 'rgba(220,205,255,1)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    ctx.fillStyle = g;
  }
  ctx.fill(markPath, 'evenodd');
  ctx.restore();
}
// clip region for the model while it is still inside the mark (the glyph's disc)
export function markClip(ctx, t) {
  const p = octoPose(t), unit = p.s / K;
  const dis = clamp((t - C.dissolve) / (C.alive - C.dissolve + 0.05));
  if (dis >= 1) return false;
  ctx.beginPath(); ctx.arc(IC[0], IC[1] + 0.53 * unit, 11.55 * unit * (1 + dis * 0.9), 0, TAU); ctx.clip();
  return true;
}
export function drawLabel(ctx, t) {
  const R = panelRect(t);
  const a = smooth((t - C.icon - 0.2) / 0.4) * (1 - smooth((t - C.click) / 0.3));
  if (a > 0) txt(ctx, 'GitHub', IC[0], R.y + R.h + 52, { size: 30, weight: 500, color: '#e6edf3', align: 'center', a });
}
export const ICON_CENTER = IC;
export { rgba, eout };
