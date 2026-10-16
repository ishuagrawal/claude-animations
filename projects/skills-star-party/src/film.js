// 8 seconds, one stage, three ideas: the repo, its star count, and the skill.
// GitHub's Invertocat pops in; its colours invert outward so the cat cut-out turns solid, the logo's
// ring falls into a puddle, and the silhouette pops into the official Octocat (traced from the
// @octocat artwork) part by part. Claude leaps in beside it; a gold star counts up to STARS; on the
// downbeat the two high-five under confetti while the repo name and the skill settle in below.
import { W, H, clamp, lerp, TAU } from './core.js';
import { C, STARS, OWNER, REPO, SKILL, beat } from './timeline.js';
import { sp, smooth, eio, eout, icon, font, SANS } from './kit.js';
import { ICONS } from './icons.js';
import { octocat, GEO } from './octocat.js';
import { claude } from './claude.js';
import { star, rays, sparkle, confetti } from './fx.js';
import { rgba } from './palette.js';

// ---- the logo, sized so its cat head matches the Octocat's head (glyph unit = 18.81 avatar px)
const U = 20.6;                               // screen px per glyph unit (disc ≈ 475 px)
const HEAD = [226, 165];                      // Octocat head centre (avatar px) = glyph (12, 12)
const S0 = U / 18.81;                         // Octocat scale at the hand-off
const S1 = 1.42;                              // Octocat scale on stage
const GROUND = 858;                           // screen y of the puddle centre / Claude's feet
const markPath = new Path2D(ICONS.github);
let CAT = null;                               // the logo's cut-out cat as a solid black shape (offscreen)
function catCanvas() {
  if (CAT) return CAT;
  const N = 1440; CAT = document.createElement('canvas'); CAT.width = CAT.height = N;
  const g = CAT.getContext('2d');
  g.scale(N / 24, N / 24);
  // the mark is one closed path (the cat's body opens through the bottom of the disc), so the cut-out
  // cat = the disc minus the mark; the disc is drawn a hair inside the mark's rim so no ring survives
  g.fillStyle = '#000'; g.beginPath(); g.arc(12, 12.5, 11.42, 0, TAU); g.fill();
  g.globalCompositeOperation = 'destination-out'; g.fill(markPath, 'evenodd');
  return CAT;
}

// ---- Octocat placement: [scale, screen x, screen y of the avatar point HEAD]
function octoPlace(t) {
  const a = { s: S0, x: W / 2, y: H / 2 };
  const m = { s: S1, x: W / 2, y: GROUND - (GEO.puddle.cy - HEAD[1]) * S1 };
  const b = { s: S1, x: 1150, y: m.y };
  const k1 = sp(t, C.pop, 1.25, 0.62), k2 = eio((t - C.slide) / 0.55);
  let s = lerp(a.s, m.s, k1), x = lerp(a.x, m.x, k1), y = lerp(a.y, m.y, k1);
  x = lerp(x, b.x, k2);
  let hop = Math.sin(Math.PI * clamp((t - C.slide) / 0.55)) * 46;
  const h = t - C.hit + 0.28;                  // jumps with Claude: apex on the downbeat
  if (h > 0 && h < 0.56) hop += Math.sin(Math.PI * h / 0.56) * 74;
  if (t > C.hit + 0.9) { const b = ((t - C.hit + 0.25) % 0.5) / 0.5; hop += Math.max(0, Math.sin(Math.PI * b)) * 8; }
  return { s, x, y: y - hop, hop };
}
const toScreen = (P, [ax, ay]) => [P.x + (ax - HEAD[0]) * P.s, P.y + (ay - HEAD[1]) * P.s];

// ---- Claude placement
const CL = { x: 680, s: 33 };
function claudeState(t) {
  const u = clamp((t - C.jump) / (C.land - C.jump));
  let x = lerp(-180, CL.x, eout(u * 1.05)), lift = Math.sin(Math.PI * u) * 330, squash = 0;
  if (t < C.jump) { x = -400; }
  if (u > 0 && u < 1) squash = -0.55 * Math.sin(Math.PI * u); // stretch in the air
  const land = t - C.land;
  if (land > 0) squash = 0.9 * Math.exp(-land * 7) * Math.cos(land * 22);
  // celebration hop at the hit, small bounces on the beats after
  const h = t - C.hit + 0.28;                  // take-off 0.28 s before the downbeat, apex on it
  if (h > -0.12 && h < 0) squash += 0.45 * Math.sin(Math.PI * (h + 0.12) / 0.12); // crouch
  if (h > 0 && h < 0.56) { const k = Math.sin(Math.PI * h / 0.56); lift += k * 118; squash -= 0.3 * k; }
  if (h > 0.56 && h < 0.9) squash += 0.6 * Math.exp(-(h - 0.56) * 9) * Math.cos((h - 0.56) * 24); // landing
  if (t > C.hit + 0.9) { const b = ((t - C.hit) % 0.5) / 0.5; lift += Math.max(0, Math.sin(Math.PI * b)) * 10; }
  return { x, lift, squash };
}

const armUp = t => { const h = t - C.hit; return 1.25 * smooth((h + 0.3) / 0.2) * (1 - smooth((h - 0.45) / 0.3)); };

// ---- odometer number (continuous value), right-aligned at x
function odometer(ctx, v, x, y, size, color) {
  font(ctx, size, 700, SANS, -4);
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  const dw = ctx.measureText('0').width * 0.98, lh = size * 1.08;
  const n = Math.max(1, String(Math.floor(v + 1e-6)).length);
  ctx.save();
  ctx.beginPath(); ctx.rect(x - dw * Math.max(n, 2) - 10, y - size * 0.9, dw * Math.max(n, 2) + 20, size * 1.08); ctx.clip();
  ctx.fillStyle = color;
  for (let i = 0; i < Math.max(n, 2); i++) {
    const place = Math.pow(10, i), base = Math.floor(v / place);
    const f = i === 0 ? v - Math.floor(v) : clamp((v % place) - (place - 1));
    const d = base % 10, cx = x - dw * (i + 0.5);
    if (!(i > 0 && base === 0)) ctx.fillText(String(d), cx, y - f * lh);
    if (f > 0.001) ctx.fillText(String((d + 1) % 10), cx, y + (1 - f) * lh);
  }
  ctx.restore();
  return dw * Math.max(n, 2);
}

function background(ctx, t) {
  const g = ctx.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H * 0.5, W * 0.72);
  g.addColorStop(0, '#f8fafd'); g.addColorStop(0.55, '#e9eff8'); g.addColorStop(1, '#d5dfee');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // two faint brand-tinted light pools drifting
  for (const [x, y, r, c, a, ph] of [[300, 220, 620, '#c9b8f5', 0.28, 0], [1650, 860, 680, '#f6cdb8', 0.26, 2], [1600, 160, 520, '#b8dcf5', 0.22, 4]]) {
    const px = x + Math.sin(t * 0.4 + ph) * 40, py = y + Math.cos(t * 0.33 + ph) * 30;
    const rg = ctx.createRadialGradient(px, py, 0, px, py, r);
    rg.addColorStop(0, rgba(c, a)); rg.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = rg; ctx.fillRect(px - r, py - r, 2 * r, 2 * r);
  }
}

function drawLogo(ctx, t) {
  if (t < C.mark || t > C.pop + 0.2) return;
  const k = sp(t, C.mark, 1.5, 0.5);
  const sq = Math.sin(clamp((t - C.squash) / (C.invert - C.squash)) * Math.PI) * 0.06; // anticipation
  const pre = t < C.invert ? (1 - sq * 0.5) : 1;
  const cx = W / 2, cy = H / 2;
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(k * (1 + sq) * pre, k * (1 - sq) * pre); ctx.rotate((1 - k) * -0.3);
  // soft shadow under the disc
  const fadeAll = 1 - smooth((t - C.pop) / 0.07);
  ctx.globalAlpha = fadeAll;
  ctx.translate(-12 * U, -12 * U); ctx.scale(U, U);
  const inv = eio((t - C.invert) / (C.invertEnd - C.invert));
  const R = inv * 13.5;
  if (t < C.invert) {
    ctx.save();
    ctx.beginPath(); ctx.rect(-10, -10, 44, 44); ctx.arc(12, 12.5, 11.5, 0, TAU, true); ctx.clip(); // never through the cut-out
    ctx.translate(0, 0.9); ctx.globalAlpha *= 0.18 * k; ctx.filter = 'blur(10px)';
    ctx.beginPath(); ctx.ellipse(12, 13.6, 11, 10.6, 0, 0, TAU); ctx.fillStyle = '#26364f'; ctx.fill(); ctx.filter = 'none'; ctx.restore();
  }
  // outside the inversion front: the logo as is
  ctx.save();
  ctx.beginPath(); ctx.rect(-10, -10, 44, 44); ctx.arc(12, 12.53, Math.max(0.001, R), 0, TAU, true); ctx.clip();
  ctx.fillStyle = '#000'; ctx.fill(markPath, 'evenodd');
  ctx.restore();
  // inside it: inverted — the cut-out cat is solid, the disc is gone
  if (R > 0) {
    ctx.save();
    ctx.beginPath(); ctx.arc(12, 12.53, R, 0, TAU); ctx.clip();
    ctx.drawImage(catCanvas(), 0, 0, 24, 24);
    ctx.restore();
    if (inv < 1) { // the moving front: a bright water-blue ring
      ctx.lineWidth = 0.42 * (1 - inv) + 0.08; ctx.strokeStyle = rgba('#9cdaf0', 0.95);
      ctx.beginPath(); ctx.arc(12, 12.53, R, 0, TAU); ctx.stroke();
      ctx.lineWidth = 0.1; ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.arc(12, 12.53, Math.max(0.001, R - 0.18), 0, TAU); ctx.stroke();
    }
  }
  ctx.restore();
}

// the logo's ring falls and flattens into the puddle under the Octocat
function fallingRing(ctx, t) {
  const u = clamp((t - C.puddle) / 0.42);
  if (u <= 0 || u >= 1) return;
  const P = octoPlace(t), e = eio(u);
  const [px, py] = toScreen(P, [GEO.puddle.cx, GEO.puddle.cy]);
  const x = lerp(W / 2, px, e), y = lerp(H / 2 + 0.53 * U, py, e);
  const rx = lerp(13.5 * U, GEO.puddle.rx * P.s, e), ry = lerp(13.5 * U, GEO.puddle.ry * P.s, e);
  ctx.save();
  ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = rgba('#9cdaf0', 0.15 + 0.85 * e * e); ctx.fill();
  ctx.lineWidth = lerp(8, 3, e); ctx.strokeStyle = rgba('#9cdaf0', 1); ctx.stroke();
  ctx.restore();
}

function octoParams(t) {
  const L = i => clamp(sp(t, C.legs + i * 0.035, 1.6, 0.55), 0, 1.15);
  const hit = t - C.hit;
  // tail: grows in curled, then reaches for Claude's hand on the high five, waves goodbye
  let tailAng = (1 - clamp(sp(t, C.tail, 1.4, 0.5), 0, 1.2)) * -0.7;
  const tailGrow = clamp(sp(t, C.tail, 1.4, 0.5), 0, 1.15);
  tailAng += 0.6 * armUp(t);                   // swings up on the jump
  if (t > C.wave) tailAng += Math.sin((t - C.wave) * 9) * 0.22 * smooth((t - C.wave) / 0.3) * (1 - smooth((t - C.wave - 1.3) / 0.3));
  // blinks
  let blink = 0;
  for (const b of [C.alive + 0.08, 3.55, 5.35, 6.95]) blink = Math.max(blink, Math.max(0, 1 - Math.abs(t - b) / 0.07));
  // look: at Claude as it lands, up at the count, then at the camera
  let look = [0, 0];
  if (t > C.jump) look = [-1, 0.1];
  if (t > C.count + 0.1) look = [-0.2, -1];
  if (t > C.hit + 0.6) look = [0, 0];
  // the drop on the tail tip forms, wobbles, falls when the tail lifts
  let drip = null;
  const dk = clamp(sp(t, C.drip, 1.8, 0.4), 0, 1.3);
  if (dk > 0.01) {
    const fall = Math.max(0, t - (C.hit - 0.32));
    const y = fall > 0 ? 0.5 * 1800 * fall * fall : 0;
    if (y < 120) drip = { s: dk, y, stretch: 1 + Math.sin((t - C.drip) * 9) * 0.06 * Math.exp(-(t - C.drip) * 1.5) + Math.min(0.5, fall * 2) };
  }
  return {
    legs: [L(0), L(1), L(2), L(3)].map(v => (t < C.pop ? 0 : v)),
    tailAng, tailGrow,
    suckers: clamp((t - C.suckers) / 0.36),
    face: clamp(sp(t, C.face, 2.6, 0.5), 0, 1.2),
    eyes: clamp(sp(t, C.eyes, 2.8, 0.42), 0, 1.25), blink, look,
    nose: clamp(sp(t, C.eyes + 0.06, 2.4, 0.45), 0, 1.3),
    mouth: eout((t - C.eyes - 0.1) / 0.25),
    grin: smooth((t - C.hit) / 0.1) * (1 - smooth((t - C.hit - 1.2) / 0.4)),
    happy: smooth((t - C.hit) / 0.1),
    whiskers: eout((t - C.whiskers) / 0.32),
    puddle: t < C.puddle + 0.42 ? 0 : 1, puddleSquash: 1 + 0.12 * Math.exp(-(t - C.puddle - 0.42) * 6) * Math.sin((t - C.puddle - 0.42) * 20),
    reflect: smooth((t - C.legs - 0.2) / 0.3),
    drip, ripples: [t - C.hit - 0.28, t - C.hit - 0.42], rippleX: 231, hit,
  };
}

function dripSplash(ctx, t, P) {
  const tHit = C.hit - 0.32 + Math.sqrt(2 * 112 / 1800), u = t - tHit;
  if (u < 0 || u > 0.6) return;
  const [x, y] = toScreen(P, [GEO.B.drip.cx, 386]);
  ctx.save();
  ctx.strokeStyle = rgba('#7cbae6', 0.8 * (1 - u / 0.6)); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(x, y, 6 + 40 * eout(u / 0.6), 2 + 9 * eout(u / 0.6), 0, 0, TAU); ctx.stroke();
  ctx.fillStyle = rgba('#9cdaf0', 1 - u / 0.6);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.45, v = 160 + i * 17;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * v * u, y + Math.sin(a) * v * u + 900 * u * u, 3.2 - i * 0.2, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function countBlock(ctx, t) {
  const k = sp(t, C.count, 1.6, 0.5);
  if (k <= 0.002) return;
  const v = t < C.count + 0.06 ? 0 : t >= C.hit ? STARS : STARS * (1 - Math.pow(1 - clamp((t - C.count - 0.06) / (C.hit - C.count - 0.06)), 2.2));
  const punch = 0.14 * smooth((t - C.hit + 0.06) / 0.06) * Math.exp(-Math.max(0, t - C.hit) * 6) * Math.cos(Math.max(0, t - C.hit) * 16);
  const cy = 258, size = 184;
  ctx.save();
  ctx.globalAlpha *= clamp(k * 1.5);
  ctx.translate(W / 2, cy - size * 0.33); ctx.scale(k * (1 + punch), k * (1 + punch)); ctx.translate(-W / 2, -(cy - size * 0.33));
  font(ctx, size, 700, SANS, -4);
  const dw = ctx.measureText('0').width * 0.98 * 2, sr = 84, gap = 30;
  const total = sr * 2 + gap + dw, x0 = W / 2 - total / 2;
  const sx = x0 + sr, sy = cy - size * 0.35;
  const burst = smooth((t - C.hit) / 0.2);
  rays(ctx, sx, sy, 210 * (0.6 + 0.4 * burst), t, burst * 0.55);
  star(ctx, sx, sy, sr * (1 + punch * 0.8), { rot: (1 - Math.min(1, k)) * -1.2 + Math.sin(t * 2) * 0.04 });
  // number with a soft drop shadow
  ctx.save(); ctx.translate(0, 10); ctx.globalAlpha *= 0.14; ctx.filter = `blur(${(12 * ctx.getTransform().a).toFixed(1)}px)`; odometer(ctx, v, x0 + total, cy, size, '#0b2147'); ctx.filter = 'none'; ctx.restore();
  odometer(ctx, v, x0 + total, cy, size, '#1f2328');
  // sparkles around the star after the hit
  if (t > C.hit) for (let i = 0; i < 7; i++) {
    const a = i * TAU / 7 + 0.4, d = sr * (1.35 + 0.25 * Math.sin(t * 3 + i)), tw = 0.5 + 0.5 * Math.sin(t * 5 + i * 1.7);
    sparkle(ctx, sx + Math.cos(a) * d, sy + Math.sin(a) * d, (8 + 7 * tw) * burst, i % 2 ? '#ffd56b' : '#ffffff', 0, 0.9 * burst);
  }
  ctx.restore();
}

function bottomLine(ctx, t) {
  const a1 = eout((t - C.repo) / 0.5), a2 = sp(t, C.skill, 1.7, 0.5);
  if (a1 <= 0) return;
  const y = 990, size = 46;
  font(ctx, size, 600, SANS, -0.5);
  const label = `${OWNER}/${REPO}`, lw = ctx.measureText(label).width;
  font(ctx, 30, 600, SANS, 0);
  const sw = ctx.measureText(SKILL).width, pw = sw + 92, ph = 60;
  const total = 52 + 16 + lw + 34 + pw, x0 = W / 2 - total / 2;
  ctx.save();
  ctx.globalAlpha *= a1; ctx.translate(0, (1 - a1) * 26);
  icon(ctx, 'github', x0 + 26, y - size * 0.34, 52, '#1f2328');
  font(ctx, size, 600, SANS, -0.5); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#57606a'; const ow = ctx.measureText(`${OWNER}/`).width;
  ctx.fillText(`${OWNER}/`, x0 + 68, y);
  ctx.fillStyle = '#1f2328'; ctx.font = `700 ${size}px ${SANS}`; ctx.fillText(REPO, x0 + 68 + ow, y);
  ctx.restore();
  if (a2 > 0.002) { // the skill pill
    const px = x0 + 68 + lw + 34, py = y - size * 0.34 - ph / 2;
    ctx.save();
    ctx.translate(px + pw / 2, py + ph / 2); ctx.scale(a2, a2); ctx.translate(-px - pw / 2, -py - ph / 2);
    ctx.globalAlpha *= clamp(a2 * 2);
    ctx.shadowColor = 'rgba(130,80,223,0.35)'; ctx.shadowBlur = 24 * ctx.getTransform().a; ctx.shadowOffsetY = 8 * ctx.getTransform().a;
    const g = ctx.createLinearGradient(px, 0, px + pw, 0); g.addColorStop(0, '#8250df'); g.addColorStop(1, '#bf3989');
    ctx.beginPath(); ctx.roundRect(px, py, pw, ph, ph / 2); ctx.fillStyle = g; ctx.fill();
    ctx.shadowColor = 'transparent';
    const hg = ctx.createLinearGradient(0, py, 0, py + ph); hg.addColorStop(0, 'rgba(255,255,255,0.28)'); hg.addColorStop(0.55, 'rgba(255,255,255,0)');
    ctx.fillStyle = hg; ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(px + 0.75, py + 0.75, pw - 1.5, ph - 1.5, ph / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(px + 32, py + ph / 2, 17, 0, TAU); ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fill();
    ctx.fillStyle = '#8250df'; ctx.beginPath(); ctx.moveTo(px + 27, py + ph / 2 - 8); ctx.lineTo(px + 40, py + ph / 2); ctx.lineTo(px + 27, py + ph / 2 + 8); ctx.closePath(); ctx.fill();
    font(ctx, 30, 600, SANS, 0); ctx.fillStyle = '#ffffff'; ctx.textBaseline = 'middle'; ctx.fillText(SKILL, px + 62, py + ph / 2 + 1);
    ctx.restore();
  }
}

export const film = {
  duration: C.end,
  render: { supersample: 1.5 },
  blurAt(t) {
    const fast = [[C.pop - 0.04, C.pop + 0.3], [C.jump, C.land + 0.12], [C.hit - 0.15, C.hit + 0.6], [C.slide, C.slide + 0.55]];
    return fast.some(([a, b]) => t > a && t < b) ? 5 : 1;
  },
  async load() {
    await Promise.all(['600 40px "Mona Sans"', '700 40px "Mona Sans"'].map(f => document.fonts.load(f)));
    catCanvas();
  },
  draw(ctx, t) {
    background(ctx, t);
    const z = 1 + 0.015 * smooth(t / C.end) + 0.01 * Math.exp(-Math.max(0, t - C.hit) * 5) * (t > C.hit ? 1 : 0);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.scale(z, z); ctx.translate(-W / 2, -H / 2);
    countBlock(ctx, t);
    fallingRing(ctx, t);   // under the silhouette, so it never tints it
    drawLogo(ctx, t);
    const P = octoPlace(t);
    if (t >= C.pop - 0.04) {
      const o = octoParams(t);
      const pop = t - C.pop, sq = pop > 0 ? 0.1 * Math.exp(-pop * 7) * Math.sin(pop * 26) : 0;
      ctx.save();
      ctx.globalAlpha = t >= C.pop ? 1 : 0;
      ctx.translate(P.x, P.y); ctx.scale(P.s * (1 - sq), P.s * (1 + sq)); ctx.translate(-HEAD[0], -HEAD[1]);
      octocat(ctx, o);
      ctx.restore();
      dripSplash(ctx, t, P);
    }
    const cs = claudeState(t);
    if (t > C.jump) {
      const h = t - C.hit;
      const armR = (t < C.land ? 0.9 : 0) + armUp(t);
      const armL = armUp(t) + (t > C.wave ? (0.9 + Math.sin((t - C.wave) * 10) * 0.35) * smooth((t - C.wave) / 0.25) * (1 - smooth((t - C.wave - 1.4) / 0.3)) : (t < C.land ? 0.9 : 0));
      let blink = 0;
      for (const b of [C.land + 0.35, 3.62, 5.6, 7.1]) blink = Math.max(blink, Math.max(0, 1 - Math.abs(t - b) / 0.07));
      const look = t > C.hit + 0.6 ? [0, 0] : t > C.count + 0.1 ? [0.3, -1] : [1, 0];
      claude(ctx, cs.x, GROUND, CL.s, { squash: cs.squash, lift: cs.lift, armL, armR, blink, happy: h > 0 && h < 1.6 ? 1 : 0, look });
    }
    bottomLine(ctx, t);
    // confetti: two cannons on the hit, then a light drift from above
    confetti(ctx, -40, H + 40, t - C.hit, { n: 70, seed: 3, dir: -Math.PI / 2 + 0.55, spread: 0.32, speed: 1900, streamers: 6 });
    confetti(ctx, W + 40, H + 40, t - C.hit, { n: 70, seed: 7, dir: -Math.PI / 2 - 0.55, spread: 0.32, speed: 1900, streamers: 6 });
    ctx.restore();
    const f = Math.max(1 - smooth(t / 0.12), smooth((t - C.fadeOut) / (C.end - C.fadeOut)));
    if (f > 0) { ctx.fillStyle = `rgba(238,243,250,${f})`; ctx.fillRect(0, 0, W, H); }
    return { vig: 0.12, grain: 0.012, contrast: 1.0, saturation: 1.03 };
  },
};
export { beat };
