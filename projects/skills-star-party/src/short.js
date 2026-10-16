// The GitHub layer of the short Claude makes (1920×1080 coordinates), drawn over the pastel world the
// learned style builds (sky.js): GitHub's Invertocat pops out of the motion chip, inverts outward (the
// cut-out cat turns solid, the logo's ring falls into a puddle on the hill) and pops into the official
// Octocat. The repo card slides in with its Star button at STARS − 1; a star slips out of the sun, the
// Octocat catches it on its tail and flicks it into the button: Starred, STARS.
import { W, H, clamp, lerp, TAU } from './core.js';
import { C, STARS, OWNER, REPO } from './timeline.js';
import { sp, smooth, eio, eout, icon, font, SANS } from './kit.js';
import { ICONS } from './icons.js';
import { octocat, GEO } from './octocat.js';
import { SUN } from './sky.js';
import { star, sparkle } from './fx.js';
import { rgba } from './palette.js';

// ---- the logo, sized so its cat head matches the Octocat's head (glyph unit = 18.81 avatar px)
const U = 18.4;                               // px per glyph unit (disc ≈ 424 px)
export const LOGO = [960, 456];               // where glyph (12, 12) sits
const HEAD = [226, 165];                      // Octocat head centre (avatar px) = glyph (12, 12)
const S0 = U / 18.81, S1 = 1.42;
const GROUND = 908;                           // puddle centre, on the hill
const markPath = new Path2D(ICONS.github);
let CAT = null;                               // the logo's cut-out cat as a solid shape (offscreen)
export function catCanvas() {
  if (CAT) return CAT;
  const N = 1440; CAT = document.createElement('canvas'); CAT.width = CAT.height = N;
  const g = CAT.getContext('2d');
  g.scale(N / 24, N / 24);
  // the mark is one closed path (the cat's body opens through the bottom of the disc), so the cut-out
  // cat = the disc minus the mark; the disc sits a hair inside the mark's rim so no ring survives
  g.fillStyle = '#000'; g.beginPath(); g.arc(12, 12.5, 11.42, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.fill(markPath, 'evenodd');
  return CAT;
}

// ---- Octocat placement (scale, screen position of HEAD), with hops
export function octoPlace(t) {
  const k = sp(t, C.pop, 1.25, 0.62);
  const s = lerp(S0, S1, k), x = LOGO[0];
  let y = lerp(LOGO[1], GROUND - (GEO.puddle.cy - HEAD[1]) * S1, k);
  let hop = 0;
  for (const c of [C.hit + 0.02, C.jump]) {    // the celebration jump; the jump with Claude
    const h = t - c;
    if (h > 0 && h < 0.5) hop += Math.sin(Math.PI * h / 0.5) * 70;
  }
  if (t > C.hit + 0.7) { const b = ((t - C.hit - 0.7) % 1) / 1; hop += Math.max(0, Math.sin(Math.PI * b * 2)) * 6; }
  return { s, x, y: y - hop, hop };
}
export const toScreen = (P, [ax, ay]) => [P.x + (ax - HEAD[0]) * P.s, P.y + (ay - HEAD[1]) * P.s];

// ---- the tail: grows in curled; reaches up for the star; winds up; flicks; waves
const ROOT = [178, 282], TIP = [96, 254];
function tailAt(t) {
  const grow = clamp(sp(t, C.tail, 1.4, 0.5), 0, 1.15);
  let a = (1 - clamp(sp(t, C.tail, 1.4, 0.5), 0, 1.2)) * -0.7;
  const reach = smooth((t - C.catch + 0.45) / 0.4);
  a += 0.32 * reach + Math.sin((t - C.catch) * 18) * 0.06 * Math.exp(-Math.max(0, t - C.catch) * 6) * (t > C.catch ? 1 : 0);
  if (t > C.windup) a += -0.7 * eio((t - C.windup) / 0.2);                      // wind up (tip dips back)
  if (t > C.flick - 0.03) a += 1.75 * eout((t - C.flick + 0.03) / 0.1);           // flick
  if (t > C.flick + 0.12) a -= 1.37 * eio((t - C.flick - 0.12) / 0.45);          // settle
  if (t > C.hit + 0.35) a += Math.sin((t - C.hit - 0.35) * 8) * 0.22 * smooth((t - C.hit - 0.35) / 0.2) * (1 - smooth((t - C.hit - 1.2) / 0.3));
  if (t > C.wrap + 0.1) a += (0.45 + Math.sin((t - C.wrap) * 9) * 0.28) * smooth((t - C.wrap - 0.1) / 0.25) * (1 - smooth((t - C.wrap - 1.6) / 0.3));
  return { a, grow };
}
export function tipAt(t) {
  const P = octoPlace(t), { a, grow } = tailAt(t);
  const dx = (TIP[0] - ROOT[0]) * grow, dy = (TIP[1] - ROOT[1]) * grow;
  const p = [ROOT[0] + dx * Math.cos(a) - dy * Math.sin(a), ROOT[1] + dx * Math.sin(a) + dy * Math.cos(a)];
  return toScreen(P, p);
}

// ---- the repo card + Star button (GitHub light UI)
const CARD = { cy: 152, h: 104 };
let meas = null;                              // text measuring context (layout must not depend on the draw ctx)
function cardLayout() {
  const ctx = meas || (meas = document.createElement('canvas').getContext('2d'));
  font(ctx, 36, 600, SANS, -0.3); const ow = ctx.measureText(`${OWNER} / `).width;
  font(ctx, 36, 700, SANS, -0.3); const rw = ctx.measureText(REPO).width;
  const badge = 92, btnW = 296, inner = 50 + 18 + ow + rw + 16 + badge + 40 + btnW;
  const w = inner + 64, x = W / 2 - w / 2;
  return { x, w, ow, rw, badge, btnX: x + w - 32 - btnW, btnW };
}
export function countTarget() { const L = cardLayout(); return [L.btnX + L.btnW - 52, CARD.cy]; }
function odometer(ctx, v, cx, y, size, color) {
  font(ctx, size, 600, SANS, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const dw = ctx.measureText('0').width, lh = size * 1.2;
  ctx.save(); ctx.beginPath(); ctx.rect(cx - dw - 4, y - size * 0.86, dw * 2 + 8, size * 1.1); ctx.clip();
  ctx.fillStyle = color;
  for (let i = 0; i < 2; i++) {
    const place = 10 ** i, base = Math.floor(v / place), f = i === 0 ? v - Math.floor(v) : clamp((v % place) - (place - 1));
    const x = cx + dw * (0.5 - i);
    ctx.fillText(String(base % 10), x, y - f * lh);
    if (f > 0.001) ctx.fillText(String((base + 1) % 10), x, y + (1 - f) * lh);
  }
  ctx.restore();
}
function repoCard(ctx, t) {
  const k = sp(t, C.header, 1.6, 0.6);
  if (k <= 0.002) return;
  const L = cardLayout(), y = CARD.cy - CARD.h / 2, starred = t >= C.hit;
  const bump = t > C.hit ? 0.05 * Math.exp(-(t - C.hit) * 7) * Math.cos((t - C.hit) * 22) : 0;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.5);
  ctx.translate(W / 2, CARD.cy); ctx.scale(1 + bump, 1 + bump); ctx.translate(-W / 2, -CARD.cy + (1 - k) * -60);
  // card
  ctx.shadowColor = 'rgba(40,70,120,0.18)'; ctx.shadowBlur = 40 * ctx.getTransform().a; ctx.shadowOffsetY = 14 * ctx.getTransform().a;
  ctx.beginPath(); ctx.roundRect(L.x, y, L.w, CARD.h, 26); ctx.fillStyle = '#ffffff'; ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(31,35,40,0.10)'; ctx.lineWidth = 1.5; ctx.stroke();
  let x = L.x + 32;
  icon(ctx, 'github', x + 25, CARD.cy, 50, '#1f2328'); x += 50 + 18;
  font(ctx, 36, 600, SANS, -0.3); ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#59636e'; ctx.fillText(`${OWNER} / `, x, CARD.cy + 2); x += L.ow;
  font(ctx, 36, 700, SANS, -0.3); ctx.fillStyle = '#1f2328'; ctx.fillText(REPO, x, CARD.cy + 2); x += L.rw + 16;
  ctx.beginPath(); ctx.roundRect(x, CARD.cy - 17, L.badge, 34, 17); ctx.strokeStyle = '#d1d9e0'; ctx.lineWidth = 2; ctx.stroke();
  font(ctx, 20, 600, SANS, 0); ctx.fillStyle = '#59636e'; ctx.textAlign = 'center'; ctx.fillText('Public', x + L.badge / 2, CARD.cy + 1);
  // Star button: [★ Star | 69] → [★ Starred | 70]
  const bx = L.btnX, bw = L.btnW, bh = 60, by = CARD.cy - bh / 2;
  const press = Math.max(0, 1 - Math.abs(t - C.hit + 0.02) / 0.07);
  ctx.save(); ctx.translate(bx + bw / 2, CARD.cy); ctx.scale(1 - press * 0.05, 1 - press * 0.05); ctx.translate(-bx - bw / 2, -CARD.cy);
  const g = ctx.createLinearGradient(0, by, 0, by + bh); g.addColorStop(0, '#f6f8fa'); g.addColorStop(1, '#eef1f4');
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = '#d1d9e0'; ctx.lineWidth = 2; ctx.stroke();
  const div = bx + bw - 104;
  ctx.beginPath(); ctx.moveTo(div, by + 1); ctx.lineTo(div, by + bh - 1); ctx.stroke();
  const sk = starred ? clamp(sp(t, C.hit, 2.2, 0.4), 0, 1.4) : 0;
  if (starred) star(ctx, bx + 36, CARD.cy, 17 * (0.6 + 0.4 * sk), { shadow: 0 });
  else icon(ctx, 'starOutline', bx + 36, CARD.cy, 30, '#59636e');
  font(ctx, 28, 600, SANS, 0); ctx.textAlign = 'left'; ctx.fillStyle = '#25292e';
  ctx.fillText(starred ? 'Starred' : 'Star', bx + 62, CARD.cy + 1);
  ctx.beginPath(); ctx.roundRect(div + 16, CARD.cy - 20, 72, 40, 20); ctx.fillStyle = starred ? '#fff1c2' : '#e6eaef'; ctx.fill();
  const v = STARS - 1 + clamp(sp(t, C.hit, 1.6, 0.6));
  odometer(ctx, v, div + 52, CARD.cy + 11, 28, '#25292e');
  ctx.restore();
  ctx.restore();
}

// ---- the logo hand-off
function logo(ctx, t) {
  if (t < C.mark || t > C.pop + 0.2) return;
  const k = sp(t, C.mark, 1.5, 0.5);           // springs out of the motion chip
  const spin = (1 - clamp(sp(t, C.mark, 1.3, 0.45), 0, 1.3)) * -0.5;
  const sq = Math.sin(clamp((t - C.squash) / (C.invert - C.squash)) * Math.PI) * 0.06;
  const pre = t < C.invert ? (1 - sq * 0.5) : 1;
  ctx.save();
  ctx.translate(LOGO[0], LOGO[1]); ctx.rotate(spin); ctx.scale(Math.min(1, k * 1.2) * (1 + sq) * pre, Math.min(1, k * 1.2) * (1 - sq) * pre);
  ctx.globalAlpha = 1 - smooth((t - C.pop) / 0.07);
  ctx.translate(-12 * U, -12 * U); ctx.scale(U, U);
  const inv = eio((t - C.invert) / (C.invertEnd - C.invert)), R = inv * 13.5;
  if (t < C.invert) {
    ctx.save();
    ctx.beginPath(); ctx.rect(-10, -10, 44, 44); ctx.arc(12, 12.5, 11.5, 0, TAU, true); ctx.clip();
    ctx.translate(0, 0.9); ctx.globalAlpha *= 0.2; ctx.filter = 'blur(10px)';
    ctx.beginPath(); ctx.ellipse(12, 13.6, 11, 10.6, 0, 0, TAU); ctx.fillStyle = '#2a4a6a'; ctx.fill(); ctx.filter = 'none'; ctx.restore();
  }
  ctx.save();
  ctx.beginPath(); ctx.rect(-10, -10, 44, 44); ctx.arc(12, 12.53, Math.max(0.001, R), 0, TAU, true); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fill(markPath, 'evenodd');
  ctx.restore();
  if (R > 0) {
    ctx.save(); ctx.beginPath(); ctx.arc(12, 12.53, R, 0, TAU); ctx.clip();
    ctx.drawImage(catCanvas(), 0, 0, 24, 24); ctx.restore();
    if (inv < 1) {
      ctx.lineWidth = 0.42 * (1 - inv) + 0.08; ctx.strokeStyle = rgba('#9cdaf0', 0.95);
      ctx.beginPath(); ctx.arc(12, 12.53, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.1; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(12, 12.53, Math.max(0.001, R - 0.18), 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
}
function fallingRing(ctx, t) {
  const u = clamp((t - C.puddle) / 0.42);
  if (u <= 0 || u >= 1) return;
  const P = octoPlace(t), e = eio(u), [px, py] = toScreen(P, [GEO.puddle.cx, GEO.puddle.cy]);
  const x = lerp(LOGO[0], px, e), y = lerp(LOGO[1] + 0.53 * U, py, e);
  const rx = lerp(13.5 * U, GEO.puddle.rx * P.s, e), ry = lerp(13.5 * U, GEO.puddle.ry * P.s, e);
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = rgba('#9cdaf0', 0.15 + 0.85 * e * e); ctx.fill();
  ctx.lineWidth = lerp(8, 3, e); ctx.strokeStyle = '#9cdaf0'; ctx.stroke();
}

// ---- the star: out of the sun, drifting down to the tail tip, riding it, flicked into the button
export function starPos(t) {
  if (t < C.starIn || t > C.hit + 0.05) return null;
  if (t < C.catch) {
    const u = (t - C.starIn) / (C.catch - C.starIn), e = eio(u), [tx, ty] = tipAt(C.catch);
    const x = lerp(SUN[0] - 40, tx, e) + Math.sin(u * Math.PI * 2.5) * 70 * (1 - u), y = lerp(SUN[1] + 40, ty - 26, e);
    return { x, y, r: 30 * Math.min(1, u * 6), rot: Math.sin(t * 3) * 0.3 };
  }
  if (t < C.flick) { const [tx, ty] = tipAt(t); return { x: tx, y: ty - 26, r: 30, rot: Math.sin(t * 9) * 0.15 }; }
  const L = tipAt(C.flick), T = countTarget(), u = clamp((t - C.flick) / (C.hit - 0.04 - C.flick));
  const cx = (L[0] + T[0]) / 2 - 80, cy = Math.min(L[1], T[1]) - 150, q = 1 - u;
  return { x: q * q * L[0] + 2 * q * u * cx + u * u * T[0], y: q * q * (L[1] - 26) + 2 * q * u * cy + u * u * T[1], r: 30 * (1 - 0.55 * smooth((u - 0.7) / 0.3)), rot: u * 9, u };
}
function starFX(ctx, t) {
  const p = starPos(t);
  if (p) {
    if (p.u !== undefined) for (let k = 1; k <= 14; k++) { // trail
      const q = starPos(t - k * 0.018);
      if (!q || q.u === undefined) break;
      sparkle(ctx, q.x + Math.sin(k * 7.1) * 8, q.y + Math.cos(k * 5.3) * 8, 10 * (1 - k / 15), k % 2 ? '#ffd56b' : '#ffffff', k, 0.85 * (1 - k / 15));
    }
    if (t < C.catch && t > C.starIn) for (let k = 0; k < 3; k++) sparkle(ctx, p.x + Math.cos(t * 4 + k * 2.1) * 44, p.y + Math.sin(t * 4 + k * 2.1) * 44, 7, '#fff6cf', k, 0.8);
    star(ctx, p.x, p.y, p.r, { rot: p.rot });
  }
  // the hit: a gold ring and sparkles out of the button
  const h = t - C.hit;
  if (h > -0.04 && h < 0.7) {
    const [x, y] = countTarget(), e = eout(Math.max(0, h) / 0.7);
    ctx.save(); ctx.globalAlpha = 1 - e; ctx.strokeStyle = '#ffcf4a'; ctx.lineWidth = 6 * (1 - e) + 1;
    ctx.beginPath(); ctx.arc(x, y, 20 + 110 * e, 0, TAU); ctx.stroke(); ctx.restore();
    for (let i = 0; i < 10; i++) { const a = i * TAU / 10 + 0.3, d = 40 + 150 * e; sparkle(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * 0.8, 13 * (1 - e), i % 2 ? '#ffd56b' : '#ffffff', a, 1); }
  }
}

function octoParams(t) {
  const L = i => clamp(sp(t, C.legs + i * 0.035, 1.6, 0.55), 0, 1.15);
  const { a: tailAng, grow: tailGrow } = tailAt(t);
  let blink = 0;
  for (const b of [C.alive + 0.05, 6.4, 9.2, 11.9, 13.1]) blink = Math.max(blink, Math.max(0, 1 - Math.abs(t - b) / 0.07));
  // eyes follow the star, then the card, then Claude (on its pill, down to the left)
  let look = [0, 0];
  const P = octoPlace(t), head = toScreen(P, [226, 190]);
  if (t > C.starIn && t < C.hit + 0.3) {
    const sp2 = t < C.hit ? (starPos(t) || { x: head[0], y: head[1] - 200 }) : { x: countTarget()[0], y: CARD.cy };
    const dx = sp2.x - head[0], dy = sp2.y - head[1], d = Math.hypot(dx, dy) || 1;
    look = [dx / d, dy / d];
  } else if (t > C.credit + 0.3) look = [-0.92, 0.4];
  return {
    legs: [L(0), L(1), L(2), L(3)].map(v => (t < C.pop ? 0 : v)),
    tailAng, tailGrow, suckers: clamp((t - C.suckers) / 0.36),
    face: clamp(sp(t, C.face, 2.6, 0.5), 0, 1.2),
    eyes: clamp(sp(t, C.eyes, 2.8, 0.42), 0, 1.25), blink, look,
    nose: clamp(sp(t, C.eyes + 0.06, 2.4, 0.45), 0, 1.3), mouth: eout((t - C.eyes - 0.1) / 0.25),
    grin: smooth((t - C.hit) / 0.1) * (1 - smooth((t - C.hit - 1.4) / 0.4)) + smooth((t - C.wrap) / 0.2) * 0.8,
    happy: smooth((t - C.hit) / 0.1),
    whiskers: eout((t - C.whiskers) / 0.32),
    puddle: t < C.puddle + 0.42 ? 0 : 1, puddleSquash: 1 + 0.12 * Math.exp(-(t - C.puddle - 0.42) * 6) * Math.sin((t - C.puddle - 0.42) * 20),
    reflect: smooth((t - C.legs - 0.2) / 0.3),
    ripples: [t - C.hit - 0.52, t - C.hit - 0.66], rippleX: 231,
  };
}

// the GitHub layer, in 1920×1080 coordinates
export function github(ctx, t) {
  if (t < C.mark) return;
  fallingRing(ctx, t);
  logo(ctx, t);
  if (t >= C.pop) {
    const P = octoPlace(t), o = octoParams(t);
    const pop = t - C.pop, sq = 0.1 * Math.exp(-pop * 7) * Math.sin(pop * 26);
    ctx.save();
    ctx.translate(P.x, P.y); ctx.scale(P.s * (1 - sq), P.s * (1 + sq)); ctx.translate(-HEAD[0], -HEAD[1]);
    octocat(ctx, o);
    ctx.restore();
  }
  repoCard(ctx, t);
  starFX(ctx, t);
}
export { STARS };
