// E · top-down (the reference's dark-square → coffee-cup match-morph). The gift box lands on a green tablecloth, its
// lid pops toward camera, the dark inside morphs into a cake seen from above, candles pop in around the rim, and a
// finger sets the last one; the flames light in a ripple. F · cut to the party, side view, in the finale look.
import { P, rgba, mix, darken, lighten } from '../palette.js';
import { C } from '../timeline.js';
import { ease, seg, lerp, key, BEAT, TAU, rng } from '../core.js';
import { setFont } from '../type.js';
import { pointer } from '../hands.js';
import { drop, soft } from '../soft.js';
import { tunnel, giftTop } from './c_card.js';
import { renderRoom } from '../room.js';
import { danceClaude, CLAUDE_X } from '../party.js';
import { FLOOR_Y } from '../looks.js';
import { confetti } from '../fx2.js';

const CX = 960, CY = 540;
const NC = 10; // candles around the rim; the one at index GAP is set by hand
const GAP = 2;
const candleAt = i => { const a = -Math.PI / 2 + i / NC * TAU; return [CX + Math.cos(a) * 200, CY + Math.sin(a) * 200]; };

function cloth(ctx) {
  ctx.fillStyle = P.green; ctx.fillRect(0, 0, 1920, 1080);
  // woven gingham, very faint, + a soft light from above
  ctx.save(); ctx.globalAlpha = 0.07; ctx.fillStyle = P.greenDk;
  for (let x = 0; x < 1920; x += 120) ctx.fillRect(x, 0, 60, 1080);
  for (let y = 0; y < 1080; y += 120) ctx.fillRect(0, y, 1920, 60);
  ctx.restore();
  const g = ctx.createRadialGradient(CX, CY, 0, CX, CY, 1100);
  g.addColorStop(0, rgba(lighten(P.green, 0.25), 0.7)); g.addColorStop(1, rgba(P.green, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
}

function cakeTop(ctx, t, m) {
  // m: morph 0 (dark box interior square) → 1 (round cake)
  const size = 300;
  const r = lerp(size * 0.05, 270, m), half = lerp(size / 2 - 14, 270, m);
  // plate grows in under the cake
  if (m > 0) {
    const pr = lerp(150, 340, ease.outBack(m));
    const plate = new Path2D(); plate.arc(CX, CY, pr, 0, TAU);
    drop(ctx, plate, { dx: 18, dy: 22, blur: 30, a: 0.3 * m });
    soft(ctx, plate, '#ffffff', { k: 2.2, b: [CX - pr, CY - pr, CX + pr, CY + pr], grad: 0.05, sa: 0.5, la: 0.3 });
    ctx.strokeStyle = rgba('#d7e3e8', m); ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(CX, CY, pr - 34, 0, TAU); ctx.stroke();
  }
  const body = new Path2D(); body.roundRect(CX - half, CY - half, half * 2, half * 2, r);
  const col = m < 1 ? mix(darken(P.berry, 0.55), P.frost, ease.inOut(m)) : P.frost;
  if (m > 0.3) drop(ctx, body, { dx: 12, dy: 14, blur: 18, a: 0.18 });
  soft(ctx, body, col, { k: 2, b: [CX - half, CY - half, CX + half, CY + half], grad: 0.06, sa: 0.7, la: 0.5 });
  if (m < 1) return;
  // pink frosting dollops around the rim
  for (let i = 0; i < 22; i++) {
    const a = i / 22 * TAU, x = CX + Math.cos(a) * 248, y = CY + Math.sin(a) * 248;
    const d = new Path2D(); d.arc(x, y, 24, 0, TAU);
    soft(ctx, d, P.pink, { k: 0.35, b: [x - 24, y - 24, x + 24, y + 24], grad: 0.1, sa: 0.8, la: 0.7 });
  }
  // sprinkles
  const rr = rng(77);
  for (let i = 0; i < 46; i++) {
    const a = rr() * TAU, d = 60 + rr() * 110, x = CX + Math.cos(a) * d, y = CY + Math.sin(a) * d;
    ctx.save(); ctx.translate(x, y); ctx.rotate(rr() * TAU);
    ctx.fillStyle = [P.sky, P.lime, P.gold, P.lilac, P.berry][i % 5];
    ctx.beginPath(); ctx.roundRect(-9, -3, 18, 6, 3); ctx.fill(); ctx.restore();
  }
}

function seventy(ctx, t) {
  const p = seg(t, C.lid + 0.42, C.lid + 0.8, ease.inOut);
  if (p <= 0) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(CX - 200, CY - 150, 400 * p, 300); ctx.clip();
  setFont(ctx, 190, { fam: 'display', weight: 900, stretch: 'expanded', track: -4 });
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = darken(P.berry, 0.25); ctx.fillText('70', CX + 6, CY + 16);
  ctx.fillStyle = P.berry; ctx.fillText('70', CX, CY + 10);
  ctx.fillStyle = rgba('#ffffff', 0.35); ctx.save(); ctx.beginPath(); ctx.rect(CX - 220, CY - 90, 440, 34); ctx.clip(); ctx.fillText('70', CX, CY + 10); ctx.restore();
  ctx.restore();
}

function candle(ctx, x, y, i, s, lit, t) {
  if (s <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  const c = new Path2D(); c.arc(0, 0, 24, 0, TAU);
  drop(ctx, c, { dx: 12, dy: 15, blur: 12, a: 0.32 });
  soft(ctx, c, i % 2 ? P.sky : P.lime, { k: 0.4, b: [-24, -24, 24, 24], grad: 0.1, sa: 0.8, la: 0.7 });
  ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(0, 0, 15, -2.4, -0.6); ctx.stroke();
  ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(0, 0, 4.5, 0, TAU); ctx.fill();
  if (lit > 0) {
    const fl = 1 + Math.sin(t * 31 + i * 2.1) * 0.1;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(0, -4, 0, 0, -4, 95 * lit * fl);
    g.addColorStop(0, rgba('#ffe7a0', 1)); g.addColorStop(0.28, rgba('#ffb53d', 0.6)); g.addColorStop(1, rgba('#ffb53d', 0));
    ctx.fillStyle = g; ctx.fillRect(-100, -104, 200, 200);
    ctx.restore();
    ctx.fillStyle = '#ffb53d'; ctx.beginPath(); ctx.ellipse(0, -4, 11 * lit * fl, 15 * lit * fl, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#fff6d6'; ctx.beginPath(); ctx.ellipse(0, -2, 6 * lit * fl, 9 * lit * fl, 0, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function sCake(ctx, t) {
  cloth(ctx);
  // the tunnel walls whoosh past and fade as the box lands
  const tf = seg(t, C.land2, C.land2 + 0.22, ease.out);
  if (tf < 1) {
    ctx.save(); ctx.globalAlpha = 1 - tf;
    ctx.translate(CX, CY); ctx.scale(1 + tf * 2.5, 1 + tf * 2.5); ctx.translate(-CX, -CY);
    tunnel(ctx, t, C.toss + 0.25);
    ctx.restore();
  }
  // box lands (squash) then the lid pops toward camera
  const land = t - C.land2;
  const sq = land > 0 && land < 0.3 ? Math.sin(land / 0.3 * Math.PI) * 0.1 * (1 - land / 0.3) : 0;
  const m = seg(t, C.lid + 0.08, C.lid + 0.42, ease.inOut);
  ctx.save(); ctx.translate(CX, CY); ctx.scale(1 + sq, 1 + sq); ctx.translate(-CX, -CY);
  if (m < 1) {
    // box walls seen from above: a berry square rim around the dark inside
    const k = 1 - m;
    ctx.save(); ctx.globalAlpha = k;
    const outer = new Path2D(); outer.roundRect(CX - 150, CY - 150, 300, 300, 14);
    drop(ctx, outer, { dx: 14, dy: 18, blur: 24, a: 0.3 });
    ctx.fillStyle = P.berry; ctx.fill(outer);
    ctx.restore();
  }
  cakeTop(ctx, t, m);
  ctx.restore();
  seventy(ctx, t);
  // the lid flies up toward camera
  const pl = seg(t, C.lid, C.lid + 0.45, ease.in2);
  if (t < C.lid + 0.45) {
    ctx.save();
    const sc = 1 + sq + pl * 3.2;
    ctx.translate(CX - pl * 1500, CY - pl * 1100); ctx.rotate(-pl * 1.1); ctx.scale(sc, sc);
    giftTop(ctx, 0, 0, 300 + 16, 1);
    ctx.restore();
  }
  // candles pop in around the rim on 16ths (one gap), the last is set by a finger, then the ripple of flames
  const t0 = C.lid + 0.5;
  for (let i = 0; i < NC; i++) {
    const [x, y] = candleAt(i);
    let s, yy = y, x2 = x;
    if (i === GAP) {
      // carried in under the fingertip, shrinking as it drops onto the cake
      s = t < C.candle - 0.45 ? 0 : t < C.candle ? 1.6 - 0.6 * seg(t, C.candle - 0.45, C.candle, ease.in2) : 1;
      const d = key(t, [[C.candle - 0.45, 700], [C.candle - 0.02, 26, ease.out], [C.candle, 0]]);
      const ang = Math.PI + 0.55;
      if (t < C.candle) { x2 = x - Math.sin(ang) * d; yy = y + Math.cos(ang) * d; }
    } else s = ease.outBack(seg(t, t0 + i * BEAT / 4 * 0.5, t0 + i * BEAT / 4 * 0.5 + 0.16, ease.lin));
    const order = (i - GAP + NC) % NC;
    const lit = seg(t, C.candle + 0.1 + order * 0.045, C.candle + 0.2 + order * 0.045, ease.outBack);
    candle(ctx, x2, yy, i, s, lit, t);
  }
  // the finger that sets the last candle (comes from the top, presses it in)
  const [gx, gy] = candleAt(GAP);
  if (t > C.candle - 0.45 && t < C.candle + 0.6) {
    const d = key(t, [[C.candle - 0.45, 700], [C.candle - 0.02, 26, ease.out], [C.candle + 0.08, 10], [C.candle + 0.6, 800, ease.in]]);
    const ang = Math.PI + 0.55; // pointing down-left, coming from the upper right
    pointer(ctx, { x: gx - Math.sin(ang) * d, y: gy - 6 + Math.cos(ang) * d, ang, s: 64, skin: 'cream', press: t > C.candle - 0.02 && t < C.candle + 0.12 ? 1 : 0 });
  }
  return { vig: 0.1, grain: 0.012 };
}

// F · the party, side view in the finale look; confetti cannons; Claude jumps toward the freeze
export function partyFrame(ctx, t) {
  const push = seg(t, C.party, C.freeze, ease.inOut);
  const z = 1 + push * 0.06;
  ctx.save();
  ctx.translate(960, 560); ctx.scale(z, z); ctx.translate(-960, -560);
  let pose;
  if (t < C.cannons + BEAT * 0.6) {
    const d = danceClaude(t, C.party);
    pose = { x: CLAUDE_X, y: FLOOR_Y + d.y, s: 1.45, sx: d.sx, sy: d.sy, arms: d.arms, legs: d.legs, lean: d.lean, look: d.look, eyes: 'happy' };
  } else {
    // squat on beat 3.6, jump to the apex exactly at the freeze
    const j0 = C.cannons + BEAT * 0.6, j1 = C.freeze;
    const p = key(t, [[j0, 0], [j0 + 0.14, -1, ease.out], [j0 + 0.2, 0, ease.in2], [j1, 1, ease.out]]);
    const h = Math.max(0, p) * 300, sq = p < 0 ? -p : 0;
    pose = { x: CLAUDE_X + Math.max(0, p) * 60, y: FLOOR_Y - h, s: 1.45, sy: 1 - sq * 0.2 + Math.max(0, p) * 0.08, sx: 1 + sq * 0.16 - Math.max(0, p) * 0.04, arms: [1.6 * Math.max(0, p) + 0.2, 1.6 * Math.max(0, p) + 0.2], legs: [8 * Math.max(0, p), 4 * Math.max(0, p), 4 * Math.max(0, p), 8 * Math.max(0, p)], eyes: p > 0.2 ? 'star' : 'closed', look: [0, -0.3] };
  }
  renderRoom(ctx, t, 'finale', { claude: pose });
  const dt = t - C.cannons;
  confetti(ctx, 60, 1060, dt, { n: 150, seed: 21, dir: 0.42, spread: 0.3, speed: 2900, size: 28, g: 1250 });
  confetti(ctx, 1860, 1060, dt, { n: 150, seed: 23, dir: -0.42, spread: 0.3, speed: 2900, size: 28, g: 1250 });
  ctx.restore();
}
function sParty(ctx, t) {
  partyFrame(ctx, t);
  return { vig: 0.1, grain: 0.012 };
}

export const eCake = [
  { name: 'cake', start: C.land2, end: C.party, draw: sCake },
  { name: 'party', start: C.party, end: C.freeze, draw: sParty },
];
