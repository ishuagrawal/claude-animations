// B · the party, by reference. The wordmark collapses into bars that become the floor; a reference video tile
// lowers on a string; Claude bumps it; palette chips fly out and build the party (look 1, soft flat). Each flick
// of a new reference restyles the whole room from the tile outward: pixel → ink → neon (the reference's
// configurator: same room, swapped on the beat).
import { P, rgba } from '../palette.js';
import { C } from '../timeline.js';
import { ease, seg, onN, lerp, key, BEAT, TAU } from '../core.js';
import { wordmark, setFont, starButton } from '../type.js';
import { pointer } from '../hands.js';
import { claude } from '../claude.js';
import { renderRoom } from '../room.js';
import { danceClaude, CLAUDE_X, TILE_AT } from '../party.js';
import { tile, swatches, TILE } from '../tile.js';
import { LOOKS, ROLES, FLOOR_Y } from '../looks.js';
import { WM, PILL_POS, dotPose } from './a_open.js';

const ROOM_S = 1.45; // Claude's scale in the room
export const TS = 1.15; // reference tile scale
export const LOOK_CUES = C.looks;
export function lookAt(t) { let i = 0; for (let k = 0; k < LOOK_CUES.length; k++) if (t >= LOOK_CUES[k]) i = k; return i; }

// build progress for every prop group at time t (eased)
export function builds(t) {
  const B = C.builds;
  const s = (k, d = 0.42, f = ease.outBack) => seg(t, B[k], B[k] + d, f);
  return {
    lamp: s('lamp', 0.4), frame: s('frame', 0.32), bunting: s('bunting', 0.45),
    table: seg(t, B.table, B.table + 0.3, ease.out), cake: seg(t, B.cake, B.cake + 0.24, ease.in2),
    gifts: seg(t, B.gifts, B.gifts + 0.26, ease.in2), balloons: seg(t, B.balloons, B.balloons + 0.5, ease.out),
    candles: seg(t, B.candles, B.candles + 0.3, ease.lin), flames: seg(t, B.flames, B.flames + 0.25, ease.outBack),
  };
}

// Claude's pose in the room over the whole act
export function roomClaude(t) {
  if (t < C.bump - 0.22) { // standing, looking up at the tile
    const look = t > C.tileIn + 0.3 ? [0.2, -1] : [0, 0];
    const blink = Math.abs(t - (C.tileHang + 0.2)) < 0.05 ? 1 : 0;
    return { x: CLAUDE_X, y: FLOOR_Y, s: ROOM_S, look, blink, eyes: 'open', arms: [0.15, 0.15] };
  }
  if (t < C.bump + 0.5) { // squat, hop, bump the tile, land
    const p = key(t, [[C.bump - 0.22, 0], [C.bump - 0.08, -1, ease.out], [C.bump, 1, ease.out], [C.bump + 0.24, 1], [C.bump + 0.5, 0, ease.in2]]);
    const h = Math.max(0, p) * 132;
    const sq = p < 0 ? -p : 0;
    return { x: CLAUDE_X, y: FLOOR_Y - h, s: ROOM_S, sy: 1 - sq * 0.18 + (p > 0 ? 0.06 : 0), sx: 1 + sq * 0.14, eyes: t > C.bump - 0.02 && t < C.bump + 0.2 ? 'closed' : 'open', look: [0, -1], arms: [0.2 + Math.max(0, p), 0.2 + Math.max(0, p)] };
  }
  if (t < C.flood) return { x: CLAUDE_X, y: FLOOR_Y, s: ROOM_S, eyes: 'wide', look: [0.6, -0.4], arms: [0.3, 0.3] };
  const d = danceClaude(t, C.flood);
  return { x: CLAUDE_X, y: FLOOR_Y + d.y, s: ROOM_S, sx: d.sx, sy: d.sy, arms: d.arms, legs: d.legs, lean: d.lean, look: d.look, eyes: 'happy' };
}

// tile state over the act: position, swing, play, flips between references
export function tileState(t) {
  const hangY = TILE_AT.y;
  let y = key(t, [[C.tileIn, -420], [C.tileHang - 0.1, hangY + 14, ease.out], [C.tileHang + 0.2, hangY, ease.inOut]]);
  let swing = 0;
  if (t > C.tileHang - 0.1) swing += 0.09 * Math.exp(-(t - C.tileHang) * 2.2) * Math.sin((t - C.tileHang) * 7);
  if (t > C.bump) swing += 0.16 * Math.exp(-(t - C.bump) * 2.4) * Math.sin((t - C.bump) * 8.5);
  const i = lookAt(t);
  let flip = 0, ref = i, nextRef = i;
  for (let k = 1; k < LOOK_CUES.length; k++) {
    const L = LOOK_CUES[k];
    if (t >= L - 0.08 && t < L + 0.3) { flip = seg(t, L - 0.08, L + 0.3, ease.inOut); ref = k - 1; nextRef = k; }
    if (t > L) swing += 0.08 * Math.exp(-(t - L) * 3) * Math.sin((t - L) * 9);
  }
  const lastFlip = i > 0 ? LOOK_CUES[i] : C.bump;
  const play = t < C.bump ? 0 : seg(t, lastFlip + (i > 0 ? 0.2 : 0), lastFlip + BEAT * 4, ease.lin);
  return { x: TILE_AT.x, y, swing, play, flip, ref, nextRef };
}

function drawCollapse(ctx, t) {
  // gold ground, the wordmark folding back into bars, bars falling into a floor line; the star button drops away
  ctx.fillStyle = P.gold; ctx.fillRect(0, 0, 1920, 1080);
  const items = wordmark(WM.text, WM.size, WM.cx, WM.base, { track: -6 });
  const tb = onN(t, 2);
  items.forEach((it, i) => {
    const t0 = C.collapse + i * 0.03;
    const pm = 1 - seg(tb, t0, t0 + 0.16, ease.in2); // glyph → bar
    const b = it.bar, bx = it.box;
    if (pm > 0) {
      ctx.save();
      const x0 = lerp(b.x, bx.x - 6, pm), x1 = lerp(b.x + b.w, bx.x + bx.w + 6, pm);
      ctx.beginPath(); ctx.rect(x0, bx.y - 40, Math.max(0, x1 - x0), bx.h + 80); ctx.clip();
      setFont(ctx, WM.size, { fam: 'display', weight: 900, stretch: 'expanded' });
      ctx.fillStyle = P.ink; ctx.fillText(it.ch, it.pen, WM.base);
      ctx.restore();
    }
    // the bar falls flat into the floor: height shrinks to 16, width grows to the letter's advance + gap
    const pf = seg(tb, t0 + 0.12, t0 + 0.42, ease.in2);
    const w = lerp(b.w, it.adv + 10, pf), h = lerp(b.h, 16, pf);
    const cx = lerp(b.x + b.w / 2, it.pen + it.adv / 2, pf);
    const yb = lerp(b.y + b.h, FLOOR_Y + 8, pf);
    ctx.fillStyle = P.ink; ctx.fillRect(cx - w / 2, yb - h, w, h);
  });
  // floor line extends to both edges
  const ext = seg(t, C.collapse + 0.45, C.land + 0.25, ease.out);
  if (ext > 0) {
    const l = items[0].pen, r = items[items.length - 1].pen + items[items.length - 1].adv;
    ctx.fillStyle = P.ink;
    ctx.fillRect(lerp(l, -10, ext), FLOOR_Y - 8, lerp(r, 1930, ext) - lerp(l, -10, ext), 16);
  }
  // star button falls away
  const pd = seg(t, C.collapse, C.collapse + 0.5, ease.in2);
  if (pd < 1) starButton(ctx, PILL_POS[0], PILL_POS[1] + pd * 520, { fill: 1, count: { from: 70, to: 70, p: 1 }, scale: 1.2, alpha: 1 });
}

function sConfig(ctx, t) {
  const L = lookAt(t);
  const ts = tileState(t);
  const tileCenter = [ts.x, ts.y + (12 + TILE.h / 2) * TS];
  const pose = roomClaude(t);

  if (t < C.flood) {
    drawCollapse(ctx, t);
    // Claude: falls from the dot of the i to the floor, growing to room scale
    const items = wordmark(WM.text, WM.size, WM.cx, WM.base, { track: -6 });
    const dp = dotPose(items);
    if (t < C.land) {
      const p = seg(t, C.collapse + 0.05, C.land, ease.lin);
      const x = lerp(dp.x, CLAUDE_X, ease.inOut(p));
      const y = lerp(dp.y, FLOOR_Y, ease.in2(p)) - Math.sin(p * Math.PI) * 120;
      claude(ctx, { x, y, s: lerp(dp.s, ROOM_S, p), eyes: 'wide', arms: [1.2, 1.2], legs: [6, 6, 6, 6], rot: p * TAU * 0 + Math.sin(p * Math.PI) * 0.2 });
    } else {
      const l = t - C.land;
      const sq = l < 0.25 ? Math.sin(l / 0.25 * Math.PI) * 0.22 : 0;
      claude(ctx, { ...pose, sy: (pose.sy || 1) * (1 - sq), sx: (pose.sx || 1) * (1 + sq * 0.7) });
    }
  } else {
    // the room in the current look; during a change, the new look is revealed in a circle growing from the tile
    const b = builds(t);
    const roomOpt = { builds: b, claude: pose, cakeSquash: cakeSquash(t) };
    const cue = LOOK_CUES[L];
    const rev = L === 0 ? seg(t, C.flood, C.flood + 0.5, ease.out) : seg(t, cue, cue + 0.42, ease.inOut2);
    if (rev < 1) {
      if (L === 0) { drawCollapse(ctx, t); }
      else renderRoom(ctx, t, LOOKS[L - 1], roomOpt);
      const [ox, oy] = L === 0 ? [1300, 520] : tileCenter;
      const R = rev * 2300;
      ctx.save();
      ctx.beginPath(); ctx.arc(ox, oy, Math.max(1, R), 0, TAU); ctx.clip();
      renderRoom(ctx, t, LOOKS[L], roomOpt);
      ctx.restore();
      // the reveal's rim
      ctx.save(); ctx.strokeStyle = rgba(P.cream, 0.7 * (1 - rev)); ctx.lineWidth = 14 * (1 - rev) + 2;
      ctx.beginPath(); ctx.arc(ox, oy, Math.max(1, R), 0, TAU); ctx.stroke(); ctx.restore();
    } else renderRoom(ctx, t, LOOKS[L], roomOpt);
  }

  // the reference tile (always the "real" object, never restyled)
  if (t > C.tileIn) tile(ctx, ts.x, ts.y, { s: TS, swing: ts.swing, play: ts.play, flip: ts.flip, ref: ts.ref, nextRef: ts.nextRef, stringTop: -40 });
  // palette chips (look 1)
  const R0 = ROLES.soft;
  swatches(ctx, t, C.chips.map(c => c - 0.42), tileCenter, [[1300, 520], [960, 260], [1210, 560], [1730, 380]], [R0.wall, R0.flags[2], R0.giftA, R0.balloons[1]]);
  // flick fingers from the top for looks 2–4
  for (let k = 1; k < LOOK_CUES.length; k++) {
    const Lc = LOOK_CUES[k];
    if (t < Lc - 0.4 || t > Lc + 0.45) continue;
    const d = key(t, [[Lc - 0.4, 700], [Lc - 0.12, 60, ease.out], [Lc - 0.06, 90, ease.inOut], [Lc - 0.02, -10, ease.in2], [Lc + 0.08, -6], [Lc + 0.45, 760, ease.in]]);
    const tx = ts.x + (TILE.w / 2 - 30) * TS, ty = ts.y + 26 * TS;
    const skins = ['mint', 'lilac', 'tan'];
    pointer(ctx, { x: tx + d * 0.25, y: ty - d, ang: Math.PI - 0.25, s: 58, skin: skins[k - 1], press: t > Lc - 0.03 && t < Lc + 0.1 ? 1 : 0, curl: t < Lc - 0.06 ? 0.4 : 0 });
  }
  return { vig: 0.08, grain: 0.012 };
}

function cakeSquash(t) {
  const l = t - (C.builds.cake + 0.24);
  return l > 0 && l < 0.3 ? Math.sin(l / 0.3 * Math.PI) * (1 - l / 0.3) : 0;
}

export const bConfig = [{ name: 'config', start: C.collapse, end: C.pullback, draw: sConfig }];
