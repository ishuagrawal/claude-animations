// C · the pull-back (the reference's "the room was a tablet in someone's hands"): the party is a video playing in
// a card captioned with the command that made it, held up by two of the community's hands. The film inside keeps
// switching looks; then the celebration happens right on the card (cannons around it, the film jumps to the blue
// finale party) and the hands put it away for the end card.
import { P, rgba } from '../palette.js';
import { C } from '../timeline.js';
import { ease, seg, clamp, lerp, key, BEAT } from '../core.js';
import { setFont } from '../type.js';
import { grip } from '../hands.js';
import { drop } from '../soft.js';
import { renderRoom } from '../room.js';
import { LOOKS } from '../looks.js';
import { danceClaude, CLAUDE_X } from '../party.js';
import { tile } from '../tile.js';
import { tileState, TS } from './b_config.js';
import { FLOOR_Y } from '../looks.js';
import { confetti } from '../fx2.js';

// card layout (screen px at rest)
export const CARD = { x: 480, y: 128, w: 960, h: 540, cap: 118, pad: 14, r: 28 };
const CMD = '/skills:video-by-reference';

function cardRoomLook(t) {
  if (t < C.card) return 'neon'; // still neon while the camera pulls back
  if (t >= C.cheer) return 'finale';
  return LOOKS[Math.floor((t - C.card) / (BEAT * 2)) % 4];
}
// Claude in the card: dancing, then jumping on every beat of the celebration
function cardClaude(t) {
  if (t < C.cheer) {
    const d = danceClaude(t, C.flood);
    return { x: CLAUDE_X, y: FLOOR_Y + d.y, s: 1.45, sx: d.sx, sy: d.sy, arms: d.arms, legs: d.legs, lean: d.lean, look: d.look, eyes: 'happy' };
  }
  const ph = ((t - C.cheer) / BEAT) % 1, j = Math.sin(ph * Math.PI);
  const sq = ph < 0.1 ? (0.1 - ph) * 2.2 : 0;
  return { x: CLAUDE_X, y: FLOOR_Y - j * 170, s: 1.45, sy: 1 - sq + j * 0.06, sx: 1 + sq * 0.8, arms: [0.4 + j * 1.2, 0.4 + j * 1.2], legs: [j * 8, 0, 0, j * 8], eyes: 'star', look: [0, -0.3] };
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
  renderRoom(ctx, roomT, look, { claude: cardClaude(roomT) });
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
  cardLayer(ctx, t);
  return { vig: 0.06, grain: 0.012 };
}

// the card, its hands and the cannons' confetti (no ground) — the end shot keeps drawing it while it leaves
export function cardLayer(ctx, t) {
  const z = zoom(t);
  // the celebration: the hands bounce the card on the beat; then they drop it out of frame
  const ph = t >= C.cheer ? ((t - C.cheer) / BEAT) % 1 : 0;
  const bounce = t >= C.cheer && t < C.exit ? -Math.sin(ph * Math.PI) * 26 : 0;
  const out = key(t, [[C.exit - 0.12, 0], [C.exit, -30, ease.out], [C.exit + 0.42, 1250, ease.in2]]);
  const cyc = CARD.y + (CARD.h + CARD.cap) / 2;
  ctx.save();
  ctx.translate(0, bounce + out);
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
  // confetti cannons from both lower corners, around the card
  const dt = t - C.cheer;
  confetti(ctx, 40, 1080, dt, { n: 140, seed: 21, dir: 0.5, spread: 0.32, speed: 2700, size: 26, g: 1250 });
  confetti(ctx, 1880, 1080, dt, { n: 140, seed: 23, dir: -0.5, spread: 0.32, speed: 2700, size: 26, g: 1250 });
}

export const cCard = [
  { name: 'card', start: C.pullback, end: C.type, draw: sCard },
];
