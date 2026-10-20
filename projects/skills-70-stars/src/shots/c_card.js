// C · the pull-back (the reference's "the room was a tablet in someone's hands"): the party is a video playing in
// a card captioned with the command that made it, held up by two of the community's hands. The film inside keeps
// switching looks. Then the hands toss it up into D · the wedge tunnel, where it spins and becomes a gift box.
import { P, rgba, lighten } from '../palette.js';
import { C } from '../timeline.js';
import { ease, seg, clamp, lerp, key, BEAT, TAU } from '../core.js';
import { setFont } from '../type.js';
import { grip } from '../hands.js';
import { drop } from '../soft.js';
import { renderRoom } from '../room.js';
import { LOOKS } from '../looks.js';
import { danceClaude, CLAUDE_X } from '../party.js';
import { tile } from '../tile.js';
import { tileState, TS } from './b_config.js';
import { FLOOR_Y } from '../looks.js';

// card layout (screen px at rest)
export const CARD = { x: 480, y: 128, w: 960, h: 540, cap: 118, pad: 14, r: 28 };
const CMD = '/skills:video-by-reference';

function cardRoomLook(t) {
  if (t < C.card) return 3; // still neon while the camera pulls back
  const n = Math.floor((t - C.card) / (BEAT * 2));
  return [0, 1, 2, 3][(n + 0) % 4];
}

// zoom from full frame (the video rect fills the screen) to the card at rest: screen = k·(pt − CARD.xy) + B
function zoom(t) {
  const p = seg(t, C.pullback, C.card, ease.inOut);
  const k0 = 1920 / CARD.w, k = Math.exp(lerp(Math.log(k0), 0, p)), q = (k0 - k) / (k0 - 1);
  return { k, bx: CARD.x * q, by: CARD.y * q, p };
}
function applyZoom(ctx, z) { ctx.translate(z.bx, z.by); ctx.scale(z.k, z.k); ctx.translate(-CARD.x, -CARD.y); }

export function drawCard(ctx, t, o = {}) {
  const { look = cardRoomLook(t), roomT = t, chrome = 1, caption = 1, hands = null } = o;
  const { x, y, w, h, cap, pad, r } = CARD;
  // card body (ink) with the caption strip under the video
  const outer = new Path2D(); outer.roundRect(x - pad, y - pad, w + pad * 2, h + cap + pad * 2, r);
  if (chrome > 0) {
    drop(ctx, outer, { dx: 18, dy: 26, blur: 40, a: 0.28 * chrome });
    ctx.fillStyle = P.ink; ctx.fill(outer);
  }
  ctx.save();
  const vid = new Path2D(); vid.roundRect(x, y, w, h, 16);
  ctx.clip(vid);
  ctx.translate(x, y); ctx.scale(w / 1920, h / 1080);
  const pose = danceClaude(roomT, C.flood);
  renderRoom(ctx, roomT, LOOKS[look], { claude: { x: CLAUDE_X, y: FLOOR_Y + pose.y, s: 1.45, sx: pose.sx, sy: pose.sy, arms: pose.arms, legs: pose.legs, lean: pose.lean, look: pose.look, eyes: 'happy' } });
  ctx.restore();
  // caption: the command that made it
  if (caption > 0) {
    ctx.save();
    ctx.globalAlpha *= caption;
    const cy = y + h + cap / 2 + 6;
    setFont(ctx, 40, { fam: 'mono', weight: 600, track: -0.5 });
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    const n = Math.floor(clamp((t - (C.card - 0.45)) * 30, 0, CMD.length));
    ctx.fillStyle = P.gold; ctx.fillText('>', x + 34, cy);
    ctx.fillStyle = P.cream; ctx.fillText(CMD.slice(0, n), x + 76, cy);
    const cw = ctx.measureText(CMD.slice(0, n)).width;
    if (n < CMD.length || Math.floor(t * 2.4) % 2 === 0) { ctx.fillStyle = rgba(P.cream, 0.9); ctx.fillRect(x + 80 + cw, cy - 22, 20, 44); }
    // the render badge
    const pb = seg(t, C.card + 0.55, C.card + 0.85, ease.outBack);
    if (pb > 0) {
      ctx.save(); ctx.translate(x + w - 96, cy); ctx.scale(pb, pb);
      const bdg = new Path2D(); bdg.roundRect(-78, -27, 156, 54, 27);
      ctx.fillStyle = P.mint; ctx.fill(bdg);
      setFont(ctx, 27, { fam: 'ui', weight: 700 });
      ctx.fillStyle = P.ink; ctx.textAlign = 'center'; ctx.fillText('✓ film.mp4', 0, 2);
      ctx.restore();
    }
    ctx.restore();
  }
}

function sCard(ctx, t) {
  // gold ground with a soft radial light (the reference's brand-color bookend)
  ctx.fillStyle = P.gold; ctx.fillRect(0, 0, 1920, 1080);
  const g = ctx.createRadialGradient(960, 440, 0, 960, 440, 1100);
  g.addColorStop(0, rgba(P.goldLt, 0.65)); g.addColorStop(1, rgba(P.goldLt, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);

  const z = zoom(t);
  // toss: anticipation dip, then fling up and spin out of frame
  const ty = key(t, [[C.toss - 0.32, 0], [C.toss - 0.06, 46, ease.out], [C.toss + 0.42, -1250, ease.in2]]);
  const tr = key(t, [[C.toss - 0.06, 0], [C.toss + 0.42, -0.9, ease.in2]]);
  const cx = 960, cyc = CARD.y + (CARD.h + CARD.cap) / 2;
  ctx.save();
  ctx.translate(cx, cyc + ty); ctx.rotate(tr); ctx.translate(-cx, -cyc);
  applyZoom(ctx, z);
  // the community's hands were holding it all along: palms behind, fingertips in front
  const hy = cyc - 20;
  const handAt = side => [side < 0 ? CARD.x - CARD.pad + 6 : CARD.x + CARD.w + CARD.pad - 6, hy];
  for (const side of [-1, 1]) { const [hx, hy2] = handAt(side); grip(ctx, { x: hx, y: hy2, s: 62, side, skin: side < 0 ? 'mint' : 'slate', part: 'back' }); }
  drawCard(ctx, t, { chrome: 1, caption: t > C.card - 0.5 ? 1 : 0 });
  // the reference tile is reeled up out of the shot as the camera pulls back
  if (t < C.pullback + 0.5) {
    const ts = tileState(t);
    const up = seg(t, C.pullback - 0.1, C.pullback + 0.5, ease.in2);
    ctx.save(); ctx.translate(CARD.x, CARD.y); ctx.scale(CARD.w / 1920, CARD.w / 1920);
    tile(ctx, ts.x, ts.y - up * 900, { s: TS, swing: ts.swing, play: ts.play, ref: 3, nextRef: 3, stringTop: -2000 });
    ctx.restore();
  }
  for (const side of [-1, 1]) { const [hx, hy2] = handAt(side); grip(ctx, { x: hx, y: hy2, s: 62, side, skin: side < 0 ? 'mint' : 'slate', part: 'front' }); }
  ctx.restore();
  return { vig: 0.08, grain: 0.012 };
}

// ---------------------------------------------------------------- D · tunnel
export function tunnel(ctx, t, t0, o = {}) {
  const { cx = 960, cy = 540, a = 1 } = o;
  const dt = t - t0;
  const N = 5;
  const rot = dt * 1.5 + Math.sin(dt * 2.4) * 0.25;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = P.ink; ctx.fillRect(0, 0, 1920, 1080);
  for (let i = 0; i < N; i++) {
    const a0 = rot + i / N * TAU, a1 = a0 + TAU / N * (0.5 + 0.1 * Math.sin(dt * 4 + i * 1.3));
    ctx.beginPath(); ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, 2400, a0, a1); ctx.closePath();
    ctx.fillStyle = P.gold; ctx.fill();
  }
  // depth: darker toward the vanishing point
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, 900);
  g.addColorStop(0, rgba(P.ink, 0.85)); g.addColorStop(0.35, rgba(P.ink, 0.25)); g.addColorStop(1, rgba(P.ink, 0));
  ctx.fillStyle = g; ctx.fillRect(0, 0, 1920, 1080);
  ctx.restore();
}

// a spinning card that turns into a gift box (top view) as it falls away from camera
export function fallingCard(ctx, t, t0, t1) {
  const p = clamp((t - t0) / (t1 - t0));
  // ends exactly where the next shot's box lands: 300 px, centred, axis-aligned (3/2 turn)
  const s = lerp(1.7, 1, ease.in2(p));
  const rot = ease.out(p) * Math.PI * 1.5;
  const flip = Math.cos(p * Math.PI * 3);
  const box = p > 0.5;
  ctx.save();
  ctx.translate(960 + Math.sin(p * 5) * 30 * (1 - p), 540 + Math.cos(p * 4) * 20 * (1 - p));
  ctx.rotate(rot);
  ctx.scale(s * (box ? 1 : Math.max(0.05, Math.abs(flip))), s);
  if (!box) {
    const c = new Path2D(); c.roundRect(-300, -190, 600, 380, 26);
    ctx.fillStyle = P.ink; ctx.fill(c);
    const v = new Path2D(); v.roundRect(-284, -174, 568, 320, 14);
    ctx.save(); ctx.clip(v); ctx.translate(-284, -174); ctx.scale(568 / 1920, 320 / 1080);
    renderRoom(ctx, t, 'soft', {});
    ctx.restore();
    ctx.fillStyle = P.gold; ctx.fillRect(-250, 158, 200, 12);
  } else giftTop(ctx, 0, 0, 300, 1);
  ctx.restore();
}

// gift box seen from above: lid with a ribbon cross and bow. size = side length
export function giftTop(ctx, x, y, size, lid = 1, o = {}) {
  const h = size / 2;
  ctx.save(); ctx.translate(x, y);
  const body = new Path2D(); body.roundRect(-h, -h, size, size, size * 0.05);
  drop(ctx, body, { dx: 14, dy: 18, blur: 24, a: 0.3 });
  ctx.fillStyle = P.berry; ctx.fill(body);
  if (lid > 0) {
    ctx.fillStyle = lighten(P.berry, 0.08); ctx.fillRect(-h + 8, -h + 8, size - 16, size - 16);
    ctx.fillStyle = P.goldLt;
    ctx.fillRect(-size * 0.07, -h, size * 0.14, size);
    ctx.fillRect(-h, -size * 0.07, size, size * 0.14);
    // bow
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.ellipse(s * size * 0.12, -size * 0.02, size * 0.13, size * 0.07, s * 0.6, 0, TAU); ctx.fill(); }
    ctx.fillStyle = P.gold; ctx.beginPath(); ctx.arc(0, 0, size * 0.06, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

function sTunnel(ctx, t) {
  tunnel(ctx, t, C.toss + 0.25);
  fallingCard(ctx, t, C.toss + 0.25, C.land2);
  return { vig: 0.1, grain: 0.012 };
}

export const cCard = [
  { name: 'card', start: C.pullback, end: C.toss + 0.25, draw: sCard },
  { name: 'tunnel', start: C.toss + 0.25, end: C.land2, draw: sTunnel },
];
