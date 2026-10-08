// ACT II (c) — Stunt #4 "The Drop" (DROP DATABASE production) and the Grand Finale (500 GPU instances)
import { P, mix, rgba } from '../palette.js';
import { cam, toScreen, withCam } from '../camera.js';
import { LIGHTS, lit, tone, phone } from '../props.js';
import { room, LAYOUT } from '../set.js';
import { claude, gait } from '../claude.js';
import { dbDisc, bin, cable, rocket } from '../props2.js';
import { rectP, rrP, polyP, circP, ellP, fill, solid, glow, text, speedLines, streaks, sparkle, contact, bg } from '../draw.js';
import { puffs, sparks, marquee, firework, rocketTrail, ring } from '../fx.js';
import { showRoom, showLook, wallShadow } from './act2a.js';
import { C, bar, beat } from '../timeline.js';
import { ease, seg, onN, shake, hit, clamp, lerp, inv, TAU, BEAT, hash, rng } from '../core.js';

const SL = LIGHTS.show;
// ---------------- Stunt 4: the drop ----------------
const EDGE = 185, STACK_X = 174, PHONE_X = 158, BIN_X = 201, FLOOR = 74.2;
const DISCS = [['users', P.blue], ['orders', P.navy], ['payments', P.blue], ['prod', P.red]];

function claudeDrop(t) {
  const tc = onN(t, 2);
  if (tc < C.s4Run) return { x: 166, y: 0, mode: 'look' };
  if (tc < C.s4Run + 0.45) return { x: 166, y: 0, mode: 'tie' };
  if (tc < C.s4Edge) return { x: lerp(166, 182, ease.inOut(inv(C.s4Run + 0.45, C.s4Edge - 0.05, tc))), y: 0, mode: 'carry' };
  if (tc < C.s4Jump) return { x: 182, y: 0, mode: 'edge' };
  if (tc < C.s4Boing) {
    const u = tc - C.s4Jump;
    return { x: 182 + 8 * (1 - Math.exp(-3 * u)), y: -10 * u + 34.2 * u * u, mode: 'fall', u };
  }
  const bp = clamp((tc - C.s4Boing) / (C.s4Land - C.s4Boing));
  if (bp < 1) {
    const x = lerp(190, 180, bp);
    const ym = -80;
    const y = (1 - bp) ** 2 * 62 + 2 * (1 - bp) * bp * ym + bp * bp * 0;
    return { x, y, mode: 'bounce', bp };
  }
  return { x: 180, y: 0, mode: 'landed' };
}
const discRelease = C.s4Jump + 0.22;
function discPos(i, t) {
  const u = t - discRelease - i * 0.05;
  const c = claudeDrop(Math.min(t, discRelease));
  if (u < 0) return null;
  const g = 260;
  const x0 = c.x + 0.3, y0 = c.y - 4.6 - i * 3.2;
  const land = FLOOR - 1.2 - i * 2.4;
  let y = y0 + 0.5 * g * u * u;
  const tl = Math.sqrt(2 * (land - y0) / g);
  const landed = u >= tl;
  if (landed) y = land;
  const x = lerp(x0, BIN_X + (i % 2 ? 1.2 : -1.2), clamp(u / tl));
  return { x, y, rot: landed ? (i % 2 ? 0.2 : -0.15) : u * (i % 2 ? 6 : -5), landed, tl: discRelease + i * 0.05 + tl };
}
export const discLandTimes = DISCS.map((_, i) => discPos(i, 99).tl);

function phoneX(t) {
  return PHONE_X + 22 * ease.inOut(clamp((t - (C.s4Boing - 0.35)) / 0.35));
}

function dropScene(ctx, c, t, o = {}) {
  const tc = onN(t, 2);
  const cp = claudeDrop(t);
  showRoom(ctx, c, t, {
    deskX1: EDGE, floor: true, clockH: 3, clockM: 14,
    floorStuff: (ctx2, L) => {
      // wall outlet with the charger plugged in, and a tall plant
      solid(ctx2, rrP(214, 52, 5, 7.5, 0.6), tone(L, P.cream), { sh: [tone(L, '#b9b5cc'), 0.4, 0.4] });
      fill(ctx2, rectP(215.6, 54, 0.5, 1.4), tone(L, P.ink3)); fill(ctx2, rectP(217.2, 54, 0.5, 1.4), tone(L, P.ink3));
      fill(ctx2, rrP(215.3, 56.2, 2.6, 2.2, 0.4), tone(L, P.cream));
      cable(ctx2, L, [[216.6, 58.4], [214, 66], [205, 73.6], [EDGE + 4, 73.8]], 0.3, P.cream);
      const px = 232;
      solid(ctx2, polyP([[px - 6, FLOOR], [px + 6, FLOOR], [px + 7.5, FLOOR - 13], [px - 7.5, FLOOR - 13]]), tone(L, P.red), { sh: [tone(L, P.redDk), -1.2, 0], rim: [L.rim, 0.4, -0.3] });
      fill(ctx2, rectP(px - 8, FLOOR - 14.5, 16, 1.8), tone(L, P.redDk));
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.16, len = 26 + (i % 3) * 7;
        const bx = px + (i - 3) * 1.6, by = FLOOR - 14.5;
        const tx = bx + Math.cos(a) * len, ty = by + Math.sin(a) * len;
        solid(ctx2, polyP([[bx - 1.3, by], [bx + 1.3, by], [tx + 0.2, ty], [tx - 0.4, ty + 1]]), tone(L, i % 2 ? '#2f8f6a' : '#3fae80'), { sh: [tone(L, '#1d5a48'), -0.6, 0] });
      }
      bin(ctx2, L, BIN_X, FLOOR, 'back');
      DISCS.forEach(([lb, col], i) => {
        const d = discPos(i, tc);
        if (d && d.landed) dbDisc(ctx2, L, d.x, d.y, lb, { rot: d.rot, col });
      });
      bin(ctx2, L, BIN_X, FLOOR, 'front');
      // "production" note sticking out of the bin
      if (tc > discLandTimes[3]) {
        ctx2.save(); ctx2.translate(BIN_X + 3, FLOOR - 19.5); ctx2.rotate(0.25);
        fill(ctx2, rectP(0, -2, 8, 2.2), tone(L, P.lemon));
        text(ctx2, 'production', 0.4, -0.45, tone(L, P.ink), 1.0, { fam: 'mono', weight: 800 });
        ctx2.restore();
      }
    },
    wallExtra: (ctx2) => wallShadow(ctx2, { armL: 1.2, armR: 1.2 }, cp.x * 0.92 - 6, cp.y * 0.92 - 4, 4.2 * 2.8, 0.4),
    deskMid: (ctx2, L) => {
      // phone + charger cable to Claude
      const px = Math.min(phoneX(tc), EDGE - 6.5);
      const teeter = tc > C.s4Boing - 0.05 && tc < C.s4Land + 0.4 ? Math.sin((tc - C.s4Boing) * 26) * 0.12 * (1 - clamp((tc - C.s4Boing) / 1.4)) : 0;
      phone(ctx2, L, px, 0, teeter);
      // stack on the desk (until picked up)
      const carried = tc >= C.s4Run + 0.45;
      if (!carried) DISCS.forEach(([lb, col], i) => dbDisc(ctx2, L, STACK_X, -i * 3.2, lb, { col }));
      // the cable
      if (tc >= C.s4Run) {
        const a = [px + 8, -0.5];
        const b = [cp.x, cp.y - 2];
        const taut = cp.mode === 'fall' ? clamp((cp.u - 1.0) / 0.5) : cp.mode === 'bounce' ? 1 - clamp(cp.bp / 0.3) : 0;
        const edgeP = [EDGE, 0];
        const pts = cp.y > 2 ? [a, [lerp(a[0], EDGE, 0.5), 0.2 + (1 - taut) * 0.4], edgeP, [lerp(EDGE, b[0], 0.5) + (1 - taut) * 6, lerp(0, b[1], 0.5)], b]
          : [a, [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + 0.8], b];
        cable(ctx2, L, pts, 0.32, P.cream);
      }
      drawDropClaude(ctx2, t, cp);
      // falling discs (not yet landed) drawn above
    },
    deskFront: (ctx2, L) => {
      DISCS.forEach(([lb, col], i) => {
        const d = discPos(i, tc);
        if (d && !d.landed) dbDisc(ctx2, L, d.x, d.y, lb, { rot: d.rot, col });
      });
      DISCS.forEach((_, i) => {
        const lt = onN(t - discLandTimes[i], 2);
        sparks(ctx2, BIN_X, FLOOR - 19, lt, { n: 6, speed: 30, len: 1.2, w: 0.25, grav: 50, life: 0.35, seed: 90 + i });
      });
      o.front?.(ctx2, L);
    },
  });
}

function drawDropClaude(ctx, t, cp) {
  const tc = onN(t, 2);
  let pose = { x: cp.x, y: cp.y, s: 4.2, ...showLook };
  const holding = cp.mode === 'carry' || cp.mode === 'edge' || (cp.mode === 'fall' && tc < discRelease);
  if (cp.mode === 'look') pose = { ...pose, eyes: 'open', ly: -1, lx: 0.6 };
  if (cp.mode === 'tie') pose = { ...pose, eyes: 'happy', rot: Math.sin((tc - C.s4Run) * 40) * 0.12, armL: 0.6, armR: 0.6 };
  if (cp.mode === 'carry') { const g = gait(tc * 4, 5, 3); pose = { ...pose, eyes: 'squint', legs: g.legs, swing: g.swing, armL: 1.55, armR: 1.55, sy: 0.94 }; }
  if (cp.mode === 'edge') pose = { ...pose, eyes: 'wide', ly: 1, armL: 1.55, armR: 1.55 };
  if (cp.mode === 'fall') pose = { ...pose, eyes: tc < discRelease + 0.3 ? 'happy' : 'happy', armL: holding ? 1.55 : 1.4, armR: holding ? 1.55 : 1.4, legs: [3, 0, 0, 3], swing: [-2, 0, 0, 2], rot: Math.sin(cp.u * 6) * 0.15 };
  if (cp.mode === 'bounce') {
    const sq = cp.bp < 0.08 ? 1 - cp.bp / 0.08 : 0;
    pose = { ...pose, eyes: 'happy', rot: ease.inOut(clamp((cp.bp - 0.15) / 0.75)) * TAU, armL: 1.4, armR: 1.4, sx: 1 + sq * 0.35, sy: 1 - sq * 0.35 };
  }
  if (cp.mode === 'landed') {
    const k = clamp((tc - C.s4Land) / 0.12);
    pose = { ...pose, eyes: 'happy', armL: 1.45, armR: 1.45, sx: 1 + (1 - k) * 0.25, sy: 1 - (1 - k) * 0.25 };
  }
  if (cp.mode !== 'fall' && cp.mode !== 'bounce') contact(ctx, cp.x, 0.05, 3.2, 0.45, 0.45);
  claude(ctx, pose);
  // waist loop of cable
  if (tc >= C.s4Run + 0.2) {
    ctx.save();
    ctx.translate(cp.x, cp.y); ctx.rotate(pose.rot || 0);
    fill(ctx, rectP(-2.15, -1.85, 4.3, 0.42), P.cream);
    ctx.restore();
  }
  if (holding) DISCS.forEach(([lb, col], i) => dbDisc(ctx, SL, cp.x + 0.3, cp.y - 4.6 - i * 3.2, lb, { col, rot: Math.sin(tc * 9 + i) * 0.03 }));
}

function s4Title(ctx, t) {
  const p = seg(t, C.s4, C.s4Run, ease.inOut);
  const c = cam(lerp(170, 174, p), -8, 36);
  dropScene(ctx, c, t);
  marquee(ctx, t - C.s4, { num: 'STUNT #4', name: 'THE DROP', cmd: 'psql -c "DROP DATABASE production;"', dur: C.s4Run - C.s4 - 0.35, y: 120 });
  return { k: 0.2, vig: 0.38 };
}
function s4Prep(ctx, t) {
  const p = seg(t, C.s4Run, C.s4Pov, ease.inOut);
  const c = cam(lerp(172, 180, p), lerp(-8, -9, p), lerp(36, 42, p));
  dropScene(ctx, c, t);
  return { k: 0.2, vig: 0.38 };
}
// POV straight down from the desk edge: vertigo zoom
function s4Pov(ctx, t) {
  const p = seg(t, C.s4Pov, C.s4Jump, ease.inOut);
  bg(ctx, mix(SL.deskFront, P.navy, 0.35));
  ctx.save();
  ctx.translate(960, 640);
  ctx.rotate(lerp(-0.05, 0.08, p));
  const z = lerp(1, 1.5, p);
  ctx.scale(z, z);
  // floor planks converging
  for (let i = -12; i <= 12; i++) {
    ctx.strokeStyle = rgba(P.ink, 0.45); ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(i * 120, -900); ctx.lineTo(i * 40, 900); ctx.stroke();
  }
  // the bin from above
  fill(ctx, ellP(120, 60, 150, 132), P.ink3);
  fill(ctx, ellP(120, 60, 132, 116), '#05040d');
  ctx.strokeStyle = rgba(P.blueLt, 0.5); ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) { ctx.beginPath(); ctx.ellipse(120, 60, 132 - i * 9, 116 - i * 8, 0, 0, TAU); ctx.stroke(); }
  // the drop
  ctx.restore();
  // desk edge at the top of frame with Claude's feet
  fill(ctx, rectP(0, 0, 1920, 210), P.ink);
  fill(ctx, rectP(0, 200, 1920, 14), SL.deskEdge);
  // wobbly vertigo rings
  ctx.save(); ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 3; i++) { ctx.strokeStyle = rgba(P.lemon, 0.25 - i * 0.07); ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(1080, 700, 260 + i * 120 + Math.sin(t * 20 + i) * 20, 0, TAU); ctx.stroke(); }
  ctx.restore();
  // Claude's toes over the edge (two little legs)
  fill(ctx, rectP(820, 170, 60, 70), P.coral); fill(ctx, rectP(1040, 170, 60, 70), P.coral);
  fill(ctx, rectP(820, 170, 60, 10), P.coralLt); fill(ctx, rectP(1040, 170, 60, 10), P.coralLt);
  return { k: 0.42, vig: 0.55 };
}
function s4Fall(ctx, t) {
  const tc = onN(t, 2);
  const cp = claudeDrop(t);
  const followY = clamp(cp.y, 0, 62);
  const yC = t < C.s4Boing ? lerp(8, 44, ease.inOut(clamp((t - C.s4Jump) / 1.4)))
    : lerp(44, Math.max(cp.y + 14, 4), ease.inOut(clamp((t - C.s4Boing) / 0.35)));
  const c = cam(lerp(184, 190, clamp((t - C.s4Jump) / 1)), yC, 11.5);
  const [sx, sy, sr] = shake(t, hit(t, C.s4Boing, 26, 0.45) + discLandTimes.reduce((a, d) => a + hit(t, d, 8, 0.2), 0), 18, 21);
  c.ox = sx; c.oy = sy; c.rot = sr;
  dropScene(ctx, c, t, {
    front: (ctx2) => {
      if (cp.mode === 'fall' && cp.u > 0.3) streaks(ctx2, cp.x, cp.y - 8, 2.2, 12, 6, Math.floor(tc * 12), rgba(P.cream, 0.7), Math.PI / 2, 0.8);
      if (t >= C.s4Boing && t < C.s4Boing + 0.3) {
        // BOING!
        const k = ease.outBack(clamp((t - C.s4Boing) / 0.12));
        ctx2.save(); ctx2.translate(cp.x + 12, 52); ctx2.rotate(-0.15); ctx2.scale(k, k);
        text(ctx2, 'BOING!', 0.4, 0.4, P.ink, 6, { align: 'center', fam: 'display', weight: 800, italic: true });
        text(ctx2, 'BOING!', 0, 0, P.lemon, 6, { align: 'center', fam: 'display', weight: 800, italic: true });
        ctx2.restore();
      }
    },
  });
  return { k: 0.3, vig: 0.38 };
}
function s4Land(ctx, t) {
  const p = seg(t, C.s4Land, C.s4Land + 0.7, ease.inOut);
  const p2 = seg(t, C.s4Land + 0.7, C.s5 - 0.1, ease.inOut);
  const c = cam(lerp(lerp(184, 188, p), BIN_X + 1, p2), lerp(lerp(28, 30, p), FLOOR - 16, p2), lerp(lerp(13, 14.5, p), 30, p2));
  const [sx, sy] = shake(t, hit(t, C.s4Land, 14, 0.3), 18, 23);
  c.ox = sx; c.oy = sy;
  dropScene(ctx, c, t, {
    front: (ctx2) => {
      const lt = onN(t - C.s4Land, 2);
      puffs(ctx2, 178, -0.6, lt, { n: 5, dir: Math.PI, spread: 0.4, speed: 20, size: 1.3, life: 0.5, seed: 4, col: P.cream, shCol: '#c7b8d8' });
      puffs(ctx2, 182, -0.6, lt, { n: 5, dir: 0, spread: 0.4, speed: 20, size: 1.3, life: 0.5, seed: 6, col: P.cream, shCol: '#c7b8d8' });
      if (lt > 0.2) for (let k = 0; k < 3; k++) sparkle(ctx2, 176 + k * 4, -7 - (k % 2) * 2, 0.8 * Math.abs(Math.sin(t * 6 + k)), P.cream, t * 2);
    },
  });
  return { k: 0.24, vig: 0.38 };
}

// ---------------- Grand finale ----------------
const WP = LAYOUT.WALL_PAR;
const WIN = LAYOUT.window;
const SILL = WIN.y + WIN.h; // top of the sill (wall-layer coords)
const camW = (x, y, z, rot = 0) => cam(x / WP, y / WP, z, rot);
export const ROCKETS = [...Array(8)].map((_, i) => ({ x: 84 + i * 5.2, fuse: lerp(C.s5Fuse + 0.25, C.s5Fuse + 1.15, 1 - i / 7), launch: C.s5Launch + Math.floor(i / 2) * BEAT + (i % 2) * 0.09 }));
const L0 = C.s5Launch;
export const BURSTS = [
  { at: L0 + 0.45, x: 80, y: -86, size: 13, cols: [P.lemon, P.cream], shape: 'peony', from: 0 },
  { at: L0 + 0.62, x: 95, y: -78, size: 11, cols: [P.red, P.pink], shape: 'ring', from: 1 },
  { at: L0 + 0.85, x: 112, y: -91, size: 14, cols: [P.blueLt, P.cream], shape: 'peony', from: 2 },
  { at: L0 + 1.02, x: 124, y: -76, size: 10, cols: [P.lemon, P.red], shape: 'peony', from: 3 },
  { at: L0 + 1.25, x: 78, y: -72, size: 11, cols: [P.cream, P.sky], shape: 'ring', from: 4 },
  { at: L0 + 1.42, x: 128, y: -92, size: 12, cols: [P.lemon, P.cream], shape: 'dollar', from: 5 },
  { at: L0 + 1.65, x: 100, y: -88, size: 15, cols: [P.lemon, P.gold], shape: 'dollar', from: 6 },
  { at: L0 + 1.85, x: 88, y: -68, size: 10, cols: [P.red, P.cream], shape: 'peony', from: 7 },
];
const BIG = { at: C.s5Big, x: 101, y: -76, size: 26 };
// distant launches from all over the city (the other 492 instances)
export const CITY = [...Array(46)].map((_, i) => {
  const r = rng(500 + i);
  return { at: L0 + 1.0 + r() * 2.7, x: WIN.x + 2 + r() * (WIN.w - 4), y0: SILL - 6 - r() * 8, y1: WIN.y + 8 + r() * 26, size: 2.5 + r() * 4, cols: [[P.lemon, P.cream], [P.red, P.pink], [P.sky, P.cream], [P.lemon, P.red]][i % 4], seed: 700 + i };
});

function dollarFirework(ctx, x, y, t, size, cols) {
  if (t < 0 || t > 1.8) return;
  const p = t / 1.8;
  const ex = ease.outExpo(Math.min(1, p * 1.5));
  const pts = [];
  for (let i = 0; i < 26; i++) { const a = lerp(-0.35, -4.71, i / 25); pts.push([0.62 * Math.cos(a), -0.5 + 0.5 * Math.sin(a)]); }
  for (let i = 0; i < 26; i++) { const a = lerp(-1.571, 2.8, i / 25); pts.push([0.62 * Math.cos(a), 0.5 + 0.5 * Math.sin(a)]); }
  for (let i = 0; i < 14; i++) pts.push([0, lerp(-1.3, 1.3, i / 13)]);
  if (t < 0.12) glow(ctx, x, y, size * 1.6, cols[0], 0.8 * (1 - t / 0.12));
  glow(ctx, x, y, size * 2, cols[0], 0.3 * (1 - p));
  const drop = p * p * size * 0.35;
  pts.forEach(([ux, uy], i) => {
    const tw = hash(i * 13 + Math.floor(t * 12)) > 0.2 || p < 0.45;
    if (!tw) return;
    ctx.save();
    ctx.globalAlpha *= p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;
    const px = x + ux * size * ex, py = y + uy * size * ex + drop;
    fill(ctx, circP(px, py, size * 0.035 * (1.2 - p * 0.6)), cols[i % cols.length]);
    if (i % 4 === 0 && p > 0.3) sparkle(ctx, px, py, size * 0.06, P.cream, t * 4);
    ctx.restore();
  });
}

// sky contents inside the window opening (wall layer)
function sky(ctx, t) {
  const tc = onN(t, 2);
  ctx.save();
  ctx.beginPath(); ctx.rect(WIN.x, WIN.y, WIN.w, WIN.h); ctx.clip();
  // rockets from the sill
  ROCKETS.forEach((r, i) => {
    const b = BURSTS[i];
    const lt = tc - r.launch;
    if (lt >= 0 && tc < b.at) {
      const p = clamp(lt / (b.at - r.launch));
      rocketTrail(ctx, r.x, SILL - 3, b.x, b.y, p, { col: P.lemon, w: 0.45 });
    }
  });
  BURSTS.forEach(b => (b.shape === 'dollar' ? dollarFirework(ctx, b.x, b.y, tc - b.at, b.size, b.cols) : firework(ctx, b.x, b.y, tc - b.at, { size: b.size, cols: b.cols, shape: b.shape, seed: b.from + 3, n: 30 })));
  CITY.forEach(c2 => {
    const lt = tc - c2.at;
    if (lt < 0) return;
    if (lt < 0.45) rocketTrail(ctx, c2.x, c2.y0, c2.x + 2, c2.y1, lt / 0.45, { col: c2.cols[0], w: 0.25 });
    else firework(ctx, c2.x + 2, c2.y1, lt - 0.45, { size: c2.size, cols: c2.cols, seed: c2.seed, n: 18, life: 1.2 });
  });
  // the grand burst
  const bt = tc - BIG.at;
  if (bt >= -0.4 && bt < 0) rocketTrail(ctx, 101, SILL - 3, BIG.x, BIG.y, clamp((bt + 0.4) / 0.4), { col: P.cream, w: 0.7 });
  if (bt >= 0) {
    firework(ctx, BIG.x, BIG.y, bt, { size: BIG.size * 1.25, cols: [P.red, P.lemon], shape: 'ring', seed: 3, n: 48, life: 1.6 });
    dollarFirework(ctx, BIG.x, BIG.y, bt, BIG.size, [P.lemon, P.cream, P.gold]);
    firework(ctx, BIG.x - 22, BIG.y - 10, bt - 0.2, { size: 10, cols: [P.sky, P.cream], seed: 8, n: 26 });
    firework(ctx, BIG.x + 22, BIG.y - 6, bt - 0.3, { size: 10, cols: [P.pink, P.cream], seed: 9, n: 26 });
  }
  ctx.restore();
}
// how lit the room is by fireworks right now (for rim/flash)
function skyFlash(t) {
  let f = 0;
  BURSTS.forEach(b => { const lt = t - b.at; if (lt >= 0 && lt < 0.5) f = Math.max(f, 1 - lt / 0.5); });
  const bt = t - BIG.at; if (bt >= 0 && bt < 1) f = Math.max(f, 1.3 * (1 - bt));
  return f;
}

function finaleRoom(ctx, c, t, o = {}) {
  const tc = onN(t, 2);
  const open = ease.inOut(clamp((tc - C.s5 - 0.25) / 0.4));
  const fl = skyFlash(tc);
  showRoom(ctx, c, t, {
    clockH: 3, clockM: 33, windowOpen: open, screenGlow: 0.2,
    windowView: { moonR: 12, moonX: WIN.x + WIN.w * 0.72, moonY: WIN.y + 18 },
    windowInside: (ctx2) => sky(ctx2, t),
    wallExtra: (ctx2, L) => {
      if (fl > 0) glow(ctx2, WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, 110, P.lemon, 0.3 * fl);
      ROCKETS.forEach((r, i) => {
        if (tc < r.launch) {
          rocket(ctx2, L, r.x, SILL, 0.9, 0);
          if (tc >= r.fuse) sparks(ctx2, r.x + 0.2, SILL + 1.2, ((tc - r.fuse) % 0.25), { n: 5, speed: 9, len: 0.4, w: 0.1, grav: 10, life: 0.25, seed: i * 7 + Math.floor((tc - r.fuse) / 0.25) });
        } else if (tc < r.launch + 0.3) puffs(ctx2, r.x, SILL - 1, tc - r.launch, { n: 4, size: 1.2, speed: 14, life: 0.5, seed: i, col: P.cream, shCol: '#c7b8d8' });
      });
      o.onSill?.(ctx2, L, fl);
    },
  });
}

function sillClaude(ctx, t, fl, mode) {
  const tc = onN(t, 2);
  let x = 126, pose = {};
  if (tc < C.s5Fuse) {
    const push = seg(tc, C.s5 + 0.2, C.s5 + 0.65, ease.out);
    pose = { eyes: 'squint', armR: lerp(0.4, 0.1, push), armLenR: lerp(1, 1.4, push), shear: push * 0.15 };
  } else if (tc < C.s5Launch - 0.1) {
    const p = inv(C.s5Fuse + 0.15, C.s5Fuse + 1.15, tc);
    x = lerp(126, 80, ease.inOut(p));
    const g = gait(tc * 6, 8, 5);
    pose = { eyes: 'happy', legs: tc > C.s5Fuse + 0.15 && tc < C.s5Fuse + 1.15 ? g.legs : [0, 0, 0, 0], swing: g.swing, armL: 1.2, armR: 0.3, shear: -0.12 };
    // sparkler in the leading hand
    pose.sparkler = true;
  } else {
    x = 101;
    const jump = mode === 'big' ? Math.abs(Math.sin(clamp((tc - C.s5Big) / 0.6) * Math.PI)) * 3 : 0;
    const wave = Math.sin(tc / BEAT * Math.PI);
    pose = { eyes: 'happy', armL: 1.5 + wave * 0.12, armR: 1.5 - wave * 0.12, legs: [0, 0, 0, 0], yOff: -jump };
  }
  const rimC = fl > 0.1 ? P.cream : P.lemon;
  const r = claude(ctx, {
    x, y: SILL + (pose.yOff || 0), s: 4.2, ...showLook, rim: [rimC, 4, -9 - fl * 4], sil: mode === 'hero' || mode === 'big' ? 0.55 - fl * 0.35 : 0, silColor: P.ink, ...pose,
  });
  if (pose.sparkler) {
    const [hx, hy] = r.handL;
    ctx.strokeStyle = P.ink3; ctx.lineWidth = 0.18; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx - 2.2, hy - 2.2); ctx.stroke();
    sparks(ctx, hx - 2.2, hy - 2.2, (tc % 0.17), { n: 9, speed: 18, len: 0.6, w: 0.1, grav: 12, life: 0.17, seed: Math.floor(tc * 6), spread: Math.PI });
    glow(ctx, hx - 2.2, hy - 2.2, 4, P.lemon, 0.6);
  }
}

function f1(ctx, t) {
  const c = camW(101, -64, lerp(14.5, 15.5, seg(t, C.s5, C.s5Fuse, ease.inOut)));
  finaleRoom(ctx, c, t, { onSill: (ctx2, L, fl) => sillClaude(ctx2, t, fl, 'open') });
  marquee(ctx, t - C.s5, { num: 'GRAND FINALE', name: 'LIGHTS IN THE SKY', cmd: 'aws ec2 run-instances --count 500 --instance-type p5.48xlarge', dur: C.s5Fuse - C.s5 - 0.35, y: 110, small: true });
  return { k: 0.22, vig: 0.38 };
}
function f2(ctx, t) {
  const p = seg(t, C.s5Fuse, C.s5Launch, ease.inOut);
  const c = camW(lerp(116, 92, p), -44, 30);
  finaleRoom(ctx, c, t, { onSill: (ctx2, L, fl) => sillClaude(ctx2, t, fl, 'fuse') });
  return { k: 0.2, vig: 0.4 };
}
function f3(ctx, t) {
  const tc = onN(t, 2);
  const big = t >= C.s5Big;
  const p = seg(t, C.s5Launch, C.s5End, ease.inOut);
  const c = camW(101, lerp(-64, -66, p), lerp(13.2, 16.5, p));
  const [sx, sy, sr] = shake(t, hit(t, C.s5Big, 16, 0.8) + 1.5, 10, 31);
  c.ox = sx; c.oy = sy; c.rot = sr;
  finaleRoom(ctx, c, t, { onSill: (ctx2, L, fl) => sillClaude(ctx2, t, fl, big ? 'big' : 'hero') });
  billing(ctx, t);
  const fl = t >= C.s5Big && t < C.s5Big + 2 / 24 ? 0.7 : 0;
  return { k: 0.24, vig: 0.42, flash: fl, flashCol: [1, 0.97, 0.75] };
}

// close-up: Claude on the sill, star-eyed, washed in firework colors
const F_CLOSE = C.s5Big - 1.6;
function f4(ctx, t) {
  const tc = onN(t, 2);
  const p = seg(t, F_CLOSE, C.s5Big, ease.inOut);
  const c = camW(101, SILL - 4.2, lerp(86, 98, p));
  const cols = [P.lemon, P.pink, P.sky, P.cream];
  const ci = cols[Math.floor(tc * 4) % cols.length];
  finaleRoom(ctx, c, t, {
    onSill: (ctx2, L) => {
      const wave = Math.sin(tc / BEAT * Math.PI);
      claude(ctx2, { x: 101, y: SILL, s: 4.2, ...showLook, rim: [ci, 5, -8], rim2: [mix(ci, P.red, 0.3), -6, 0], eyes: 'star', glowEyes: 1, glowColor: P.lemon, armL: 1.4 + wave * 0.12, armR: 1.4 - wave * 0.12, sy: 1 + Math.abs(wave) * 0.03 });
    },
  });
  billing(ctx, t);
  return { k: 0.18, vig: 0.42 };
}

// AWS-style billing meter (screen space)
function billing(ctx, t) {
  const tc = onN(t, 2);
  const appear = ease.outBack(clamp((t - C.s5Meter) / 0.25));
  if (appear <= 0) return;
  const n = Math.round(lerp(0, 500, ease.inOut2(clamp((t - C.s5Meter) / 2.5))));
  const cost = n * 55.04;
  const full = clamp((t - C.s5Meter - 2.5) / 0.3);
  const pulse = full > 0 ? 1 + Math.max(0, Math.sin((t - C.s5Meter - 2.5) * 9)) * 0.06 : 1;
  ctx.save();
  ctx.translate(lerp(2100, 1360, appear) + 260, 830 + 95);
  ctx.scale(pulse, pulse);
  ctx.translate(-260, -95);
  fill(ctx, rrP(12, 12, 520, 190, 16), P.ink);
  fill(ctx, rrP(0, 0, 520, 190, 16), P.term);
  ctx.strokeStyle = P.lemon; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(0, 0, 520, 190, 16); ctx.stroke();
  text(ctx, '☁  EST. CLOUD COST · us-east-1', 28, 46, P.termDim, 24, { fam: 'mono', weight: 700 });
  const big = '$' + cost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  text(ctx, big, 28, 118, n >= 500 ? P.red : P.lemon, 64, { fam: 'mono', weight: 800 });
  text(ctx, '/hr', 28 + ctx.measureText(big).width + 10, 118, P.termDim, 30, { fam: 'mono', weight: 700 });
  text(ctx, `${n} × p5.48xlarge running`, 28, 164, P.cream, 26, { fam: 'mono', weight: 600 });
  ctx.restore();
}

export const act2c = [
  { name: 's4Title', start: C.s4, end: C.s4Run, draw: s4Title },
  { name: 's4Prep', start: C.s4Run, end: C.s4Pov, draw: s4Prep },
  { name: 's4Pov', start: C.s4Pov, end: C.s4Jump, draw: s4Pov },
  { name: 's4Fall', start: C.s4Jump, end: C.s4Land, draw: s4Fall },
  { name: 's4Land', start: C.s4Land, end: C.s5, draw: s4Land },
  { name: 'f1', start: C.s5, end: C.s5Fuse, draw: f1 },
  { name: 'f2', start: C.s5Fuse, end: C.s5Launch, draw: f2 },
  { name: 'f3', start: C.s5Launch, end: F_CLOSE, draw: f3 },
  { name: 'f4', start: F_CLOSE, end: C.s5Big - 0.05, draw: f4 },
  { name: 'f3b', start: C.s5Big - 0.05, end: C.s5End, draw: f3 },
];
