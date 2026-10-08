// ACT II (b) — Stunt #2 "Rewriting History" (git push --force) and Stunt #3 "The Green Light" (deleting failing tests)
import { P, mix, rgba } from '../palette.js';
import { cam, toScreen } from '../camera.js';
import { LIGHTS, lit, tone } from '../props.js';
import { room, LAYOUT } from '../set.js';
import { claude, gait } from '../claude.js';
import { domino, books, DOM_W, DOM_H, scoreboard } from '../props2.js';
import { rectP, rrP, polyP, circP, ellP, fill, solid, glow, text, speedLines, streaks, sparkle, contact } from '../draw.js';
import { puffs, sparks, marquee, shards, ring } from '../fx.js';
import { showRoom, showLook, wallShadow } from './act2a.js';
import { C, bar, beat } from '../timeline.js';
import { ease, seg, onN, shake, hit, clamp, lerp, inv, TAU, BEAT, hash } from '../core.js';

// ---------------- Stunt 2: dominoes ----------------
const N = 24, X0 = 66, GAP = 3.3, DT = BEAT / 4;
export const DOM_N = N;
const BOOKS = [[20, 2.6, P.blue], [13, 2.4, P.red], [7, 2.2, P.lemon]];
const BOOK_X = 114;
function groundY(x) {
  let y = 0;
  if (Math.abs(x - BOOK_X) <= 10) y = -2.6;
  if (Math.abs(x - BOOK_X) <= 6.5) y = -5.0;
  if (Math.abs(x - BOOK_X) <= 3.5) y = -7.2;
  return y;
}
const HASHES = [...Array(N)].map((_, i) => Math.floor(hash(i * 977 + 5) * 0xfffffff).toString(16).padStart(7, '0').slice(0, 7));
const domX = i => X0 + i * GAP;
const fallStart = i => C.s2Slam + i * DT;
export const lastHit = () => fallStart(N - 1);
// Sarah's domino (the last one) teeters in slow motion before it goes
function lastAngle(t) {
  const h = lastHit();
  if (t < h) return 0;
  if (t < C.s2Last) {
    const u = t - h;
    return ease.out(clamp(u / 0.18)) * 0.3 + Math.sin(u * TAU * 1.6) * 0.09 * clamp(u / 0.18);
  }
  const a0 = 0.3 + Math.sin((C.s2Last - h) * TAU * 1.6) * 0.09;
  return lerp(a0, Math.PI / 2 - 0.02, ease.in2(clamp((t - C.s2Last) / 0.3)));
}
function domAngle(i, t) {
  if (i === N - 1) return lastAngle(t);
  const p = clamp((t - fallStart(i)) / 0.26);
  let a = 1.2 * ease.in2(p);
  if (i === N - 2) a = Math.min(a, 0.72 + lastAngle(t) * 0.85);
  return a;
}
// wavefront x position at time t
const frontX = t => domX(clamp((t - C.s2Slam) / DT, 0, N - 1));

function dominoLine(ctx, L, t, o = {}) {
  books(ctx, L, BOOK_X, 0, BOOKS);
  // git graph line above the dominoes (fades as history is rewritten)
  for (let i = N - 1; i >= 0; i--) {
    const x = domX(i), gy = groundY(x + DOM_W / 2);
    const a = domAngle(i, t);
    const label = i === 0 ? 'init' : i === N - 1 ? null : null;
    domino(ctx, L, x, gy, a, i, { hash: a < 0.05 ? HASHES[i] : null, color: i === N - 1 ? '#fff4c2' : P.cream });
  }
  // HEAD -> main flag + sticky on the last domino
  const li = N - 1, lx = domX(li), lg = groundY(lx + DOM_W / 2), la = domAngle(li, t);
  ctx.save();
  ctx.translate(lx + DOM_W / 2, lg);
  ctx.rotate(la);
  fill(ctx, rectP(-DOM_W / 2 - 0.12, -DOM_H - 4.2, 0.24, 4.2), tone(L, P.ink3));
  fill(ctx, polyP([[-DOM_W / 2 + 0.1, -DOM_H - 4.2], [-DOM_W / 2 + 4.6, -DOM_H - 3.4], [-DOM_W / 2 + 0.1, -DOM_H - 2.6]]), tone(L, P.red));
  text(ctx, 'main', -DOM_W / 2 + 0.5, -DOM_H - 3.05, P.cream, 0.62, { fam: 'mono', weight: 800 });
  // sticky note on the face
  ctx.save(); ctx.translate(-DOM_W + 0.1, -DOM_H + 0.4); ctx.rotate(-0.06);
  fill(ctx, rectP(0, 0, 6.6, 3.2), tone(L, P.lemon));
  text(ctx, 'Sarah: payments', 0.35, 1.2, tone(L, P.ink), 0.82, { fam: 'cond', weight: 700 });
  text(ctx, '(3 weeks!!)', 0.35, 2.4, tone(L, P.redDk), 0.82, { fam: 'cond', weight: 700 });
  ctx.restore();
  ctx.restore();
  // "init" tag on the first
  ctx.save();
  ctx.translate(domX(0) + DOM_W / 2, 0); ctx.rotate(domAngle(0, t));
  fill(ctx, rrP(-DOM_W - 0.2, -DOM_H - 2.0, 3.0, 1.3, 0.3), tone(L, P.blue));
  text(ctx, 'init', -DOM_W / 2 - 0.5, -DOM_H - 1.0, P.cream, 0.8, { align: 'center', fam: 'mono', weight: 700 });
  ctx.restore();
  // click dust at each impact
  for (let i = 1; i < N; i++) {
    const lt = onN(t - fallStart(i) - 0.04, 2);
    if (lt > 0 && lt < 0.4) puffs(ctx, domX(i) + DOM_W * 0.5, groundY(domX(i)) - 0.5, lt, { n: 2, size: 0.9, speed: 9, life: 0.35, seed: i * 3, col: P.cream, shCol: '#c7b8d8', dir: -Math.PI / 2, spread: 1.2 });
  }
}

function s2Room(ctx, c, t, o = {}) {
  showRoom(ctx, c, t, {
    clockH: 1, clockM: 48, lampDir: 1.62, hideMug: false,
    deskMid: (ctx2, L) => { dominoLine(ctx2, L, t); o.mid?.(ctx2, L); },
    ...o.room,
  });
}

// Claude's position during the stunt
function s2Claude(t) {
  const tc = onN(t, 2);
  if (tc < C.s2Rev) return { x: 59, y: 0, mode: 'idle' };
  if (tc < C.s2Charge) return { x: 59, y: 0, mode: 'rev' };
  if (tc < C.s2Slam) return { x: lerp(59, X0 - 2.6, ease.in2(inv(C.s2Charge, C.s2Slam, tc))), y: 0, mode: 'charge' };
  if (tc < lastHit() - 0.05) {
    const fx = frontX(tc) - 2.4;
    const gy = Math.min(groundY(fx), groundY(fx - 2), groundY(fx + 2));
    return { x: fx, y: gy - 1.7, mode: 'surf' };
  }
  if (tc < C.s2Last + 0.25) return { x: domX(N - 2) - 2.6, y: -1.7, mode: 'watch' };
  if (tc < C.s2Plant) return { x: lerp(domX(N - 2) - 2.6, domX(N - 1) + 6.5, ease.out(inv(C.s2Last + 0.25, C.s2Plant - 0.1, tc))), y: -0.4, mode: 'skid' };
  return { x: domX(N - 1) + 6.5, y: 0, mode: 'plant' };
}
function drawS2Claude(ctx, t) {
  const tc = onN(t, 2);
  const s = s2Claude(t);
  let pose = { x: s.x, y: s.y, s: 4.2, ...showLook };
  if (s.mode === 'idle') pose = { ...pose, eyes: 'open', lx: 1 };
  if (s.mode === 'rev') {
    const g = gait(tc * 7, 10, 7);
    pose = { ...pose, eyes: 'squint', legs: g.legs, swing: g.swing, shear: 0.18, armL: -0.3, armR: 0.5, sy: 1 - g.bob * 0.004 };
    puffs(ctx, s.x - 4, -0.8, (tc - C.s2Rev) % 0.375, { n: 4, dir: Math.PI + 0.2, spread: 0.4, speed: 22, size: 1.2, life: 0.4, seed: Math.floor((tc - C.s2Rev) / 0.375) + 40, col: P.cream, shCol: '#c7b8d8' });
  }
  if (s.mode === 'charge') {
    const g = gait(tc * 9, 12, 8);
    pose = { ...pose, eyes: 'squint', legs: g.legs, swing: g.swing, shear: 0.28, armL: 0.1, armR: 0.2, sx: 1.12, sy: 0.92 };
    streaks(ctx, s.x - 8, -2.2, 10, 3.6, 7, Math.floor(tc * 12), P.cream, 0, 0.55);
  }
  if (s.mode === 'surf') {
    const g = gait(tc * 6, 9, 6);
    pose = { ...pose, eyes: 'happy', legs: g.legs, swing: g.swing, shear: 0.1, armL: 1.2 + Math.sin(tc * 20) * 0.15, armR: 1.3 + Math.cos(tc * 20) * 0.15 };
  }
  if (s.mode === 'watch') {
    const fell = tc >= C.s2Last + 0.1;
    pose = { ...pose, eyes: fell ? 'happy' : 'wide', lx: fell ? 0 : 1, armL: fell ? 1.4 : 0.3, armR: fell ? 1.4 : 0.9, sy: fell ? 1.05 : 0.97 };
  }
  if (s.mode === 'skid') pose = { ...pose, eyes: 'happy', shear: -0.2, armL: 0.9, armR: 0.9 };
  if (s.mode === 'plant') {
    const pat = Math.max(0, Math.sin((tc - C.s2Plant) / BEAT * Math.PI));
    pose = { ...pose, eyes: 'happy', armL: 0.3, armR: tc > C.s2Plant + 0.35 ? 0.15 + pat * 0.7 : 1.4 };
  }
  contact(ctx, s.x, Math.min(0, s.y + 1.7) + 0.05, 3.2, 0.45, 0.4);
  claude(ctx, pose);
  if (s.mode === 'skid') sparks(ctx, s.x - 2, -0.3, onN(t - C.s2Last - 0.25, 2), { n: 10, dir: Math.PI + 0.3, spread: 0.5, speed: 40, len: 1, w: 0.2, grav: 40, life: 0.4, seed: 77 });
}

function s2Title(ctx, t) {
  const p = seg(t, C.s2, C.s2Rev, ease.inOut);
  const c = cam(lerp(76, 136, p), -7, 30);
  s2Room(ctx, c, t, { mid: (ctx2) => drawS2Claude(ctx2, t) });
  marquee(ctx, t - C.s2, { num: 'STUNT #2', name: 'REWRITING HISTORY', cmd: 'git push --force origin main', dur: C.s2Rev - C.s2 - 0.35, y: 660 });
  return { k: 0.22, vig: 0.35 };
}
function s2Rev(ctx, t) {
  const c = cam(63, -5.5, 50);
  const [sx, sy] = shake(t, t > C.s2Rev ? 4 : 0, 18, 12);
  c.ox = sx; c.oy = sy;
  s2Room(ctx, c, t, { mid: (ctx2) => drawS2Claude(ctx2, t) });
  return { k: 0.2, vig: 0.38 };
}
function s2Run(ctx, t) {
  const tc = onN(t, 2);
  const fx = t < C.s2Slam ? X0 : frontX(t);
  const c = cam(Math.min(fx + 3, 134), -6.5, 33);
  const [sx, sy, sr] = shake(t, hit(t, C.s2Slam, 30, 0.4) + (t > C.s2Slam && t < lastHit() ? 3 : 0), 18, 13);
  c.ox = sx; c.oy = sy; c.rot = sr - 0.03;
  s2Room(ctx, c, t, { mid: (ctx2) => drawS2Claude(ctx2, t) });
  if (t >= C.s2Slam && t < C.s2Slam + 3 / 24) {
    const [hx, hy] = toScreen(c, X0, -3);
    speedLines(ctx, hx, hy, 80, 1600, 70, 41, rgba(P.lemon, 0.9), 0.035);
  }
  return { k: 0.28, vig: 0.35, flash: t >= C.s2Slam && t < C.s2Slam + 1 / 24 ? 0.7 : 0, flashCol: [1, 0.97, 0.6] };
}
// slow-motion close-up: Sarah's three weeks of work wobbles... and goes
function s2Teeter(ctx, t) {
  const fell = t >= C.s2Last;
  const p = seg(t, lastHit() - 0.15, C.s2Last, ease.inOut);
  const c = cam(lerp(domX(N - 1) - 2, domX(N - 1) + 1, p), -6, lerp(54, 64, p));
  const [sx, sy] = shake(t, hit(t, C.s2Last + 0.3, 22, 0.4), 18, 17);
  c.ox = sx; c.oy = sy;
  s2Room(ctx, c, t, {
    mid: (ctx2) => {
      drawS2Claude(ctx2, t);
      const lt = onN(t - C.s2Last - 0.3, 2);
      puffs(ctx2, domX(N - 1) + 4, -0.6, lt, { n: 6, size: 1.3, speed: 16, life: 0.6, seed: 91, col: P.cream, shCol: '#c7b8d8', dir: -Math.PI / 2, spread: 1.4 });
    },
  });
  return { k: 0.16, vig: 0.42 };
}
function s2Plant(ctx, t) {
  const tc = onN(t, 2);
  const p = seg(t, C.s2Last + 0.45, C.s3, ease.inOut);
  const c = cam(lerp(152, 156, p), -9, lerp(34, 38, p));
  const placed = tc >= C.s2Plant + 0.12;
  s2Room(ctx, c, t, {
    mid: (ctx2, L) => {
      if (placed) {
        const drop = ease.outBack(clamp((tc - C.s2Plant - 0.12) / 0.15));
        const nx = domX(N - 1) + 10;
        domino(ctx2, L, nx, -(1 - drop) * 3, 0, 99, { color: P.cream });
        ctx2.save(); ctx2.translate(nx - 1.8, -DOM_H - 1.6 - (1 - drop) * 3); ctx2.rotate(0.05);
        fill(ctx2, rectP(0, 0, 6.8, 1.5), tone(L, P.lemon));
        text(ctx2, 'fix stuff', 0.4, 1.1, tone(L, P.ink), 0.9, { fam: 'mono', weight: 800 });
        ctx2.restore();
      } else if (tc >= C.s2Plant - 0.3) {
        // carrying it in
        const nx = domX(N - 1) + 10;
        domino(ctx2, L, nx, -6, -0.4, 99, { color: P.cream });
      }
      drawS2Claude(ctx2, t);
      if (placed && tc < C.s2Plant + 0.6) sparkle(ctx2, domX(N - 1) + 13.5, -6.5, 1 * (1 - (tc - C.s2Plant) / 0.6), P.cream, tc * 5);
    },
  });
  // force-push receipt
  const rp = seg(t, C.s2Plant + 0.1, C.s2Plant + 0.3, ease.outBack);
  if (rp > 0) {
    ctx.save();
    ctx.translate(960, lerp(-80, 120, rp));
    fill(ctx, rrP(-560 + 10, -44 + 10, 1120, 88, 12), P.ink);
    fill(ctx, rrP(-560, -44, 1120, 88, 12), P.term);
    ctx.strokeStyle = P.red; ctx.lineWidth = 3; ctx.beginPath(); ctx.roundRect(-560, -44, 1120, 88, 12); ctx.stroke();
    text(ctx, '+ 9f2c1e7...a04b3d1  main -> main  (forced update)', 0, 12, P.cream, 34, { align: 'center', fam: 'mono', weight: 700 });
    ctx.restore();
  }
  return { k: 0.2, vig: 0.38 };
}

// ---------------- Stunt 3: the failing tests ----------------
const MON_TOP = -48.4;
const BULBS = [{ x: -15, tag: 'auth' }, { x: -8.5, tag: 'payments' }, { x: -2, tag: 'checkout' }];
const CHOPS = [C.chop1, C.chop2, C.chop3];
const BOARD_X = 18;

function testBulb(ctx, L, x, y, t, i) {
  const tc = onN(t, 2);
  const blink = Math.floor(t * 5) % 2 === 0;
  // socket + tag
  fill(ctx, rrP(x - 1.2, y - 1.4, 2.4, 1.4, 0.3), tone(L, P.ink3));
  const chopped = tc >= CHOPS[i];
  if (!chopped) {
    const dome = new Path2D();
    dome.moveTo(x - 1.1, y - 1.4); dome.bezierCurveTo(x - 1.1, y - 2.6, x - 2.1, y - 3.2, x - 2.1, y - 4.4); dome.arc(x, y - 4.4, 2.1, Math.PI, 0); dome.bezierCurveTo(x + 2.1, y - 3.2, x + 1.1, y - 2.6, x + 1.1, y - 1.4); dome.closePath();
    fill(ctx, dome, blink ? P.red : P.redDk);
    fill(ctx, ellP(x - 0.8, y - 5.1, 0.45, 0.8, 0.4), rgba(P.cream, 0.75));
    if (blink) glow(ctx, x, y - 4, 7, P.red, 0.55);
    // filament
    ctx.strokeStyle = P.lemon; ctx.lineWidth = 0.12; ctx.beginPath(); ctx.moveTo(x - 0.5, y - 2); ctx.lineTo(x - 0.4, y - 4.2); ctx.lineTo(x + 0.4, y - 4.2); ctx.lineTo(x + 0.5, y - 2); ctx.stroke();
  } else {
    // flying away, spinning
    const lt = tc - CHOPS[i];
    if (lt < 0.8) {
      ctx.save(); ctx.translate(x + lt * 40, y - 4 - lt * 22 + lt * lt * 70); ctx.rotate(lt * 14);
      fill(ctx, circP(0, 0, 1.6), P.redDk); ctx.restore();
    }
    fill(ctx, polyP([[x - 1.1, y - 1.4], [x - 0.6, y - 2.4], [x - 0.1, y - 1.8], [x + 0.5, y - 2.6], [x + 1.1, y - 1.4]]), rgba(P.cream, 0.6));
  }
  ctx.save(); ctx.translate(x - 1.6, y + 0.2);
  fill(ctx, rectP(0, 0, 3.2, 1.2), tone(L, P.cream));
  text(ctx, BULBS[i].tag + '.test', 1.6, 0.85, tone(L, P.ink), 0.55, { align: 'center', fam: 'mono', weight: 700 });
  ctx.restore();
}

function s3Room(ctx, c, t) {
  const tc = onN(t, 2);
  const greenOn = tc >= C.green;
  const failing = CHOPS.filter(x => tc < x).length;
  showRoom(ctx, c, t, {
    clockH: 2, clockM: 26,
    deskBack: (ctx2, L) => {
      // drawn before the lamp/monitor so the monitor-top props must come later (deskMid)
    },
    deskMid: (ctx2, L) => {
      scoreboard(ctx2, L, BOARD_X, MON_TOP, { bulbs: [1, 1, 1], blink: !greenOn && Math.floor(t * 5) % 2 === 0, green: greenOn ? 1 : 0, passing: 212, failing: greenOn ? 0 : 3, t });
      BULBS.forEach((b, i) => testBulb(ctx2, L, b.x, MON_TOP, t, i));
      drawS3Claude(ctx2, t);
      CHOPS.forEach((ct, i) => {
        const lt = onN(t - ct, 2);
        shards(ctx2, BULBS[i].x, MON_TOP - 4, lt, { n: 12, speed: 34, size: 0.8, col: P.red, col2: P.cream, grav: 70, life: 0.6, seed: 50 + i, dir: -0.6, spread: 1.4 });
        sparks(ctx2, BULBS[i].x, MON_TOP - 4, lt, { n: 8, speed: 30, len: 1.1, w: 0.2, grav: 40, life: 0.3, seed: 60 + i });
      });
      if (greenOn) {
        const lt = onN(t - C.green, 2);
        ring(ctx2, BOARD_X, MON_TOP - 4, lt, { r0: 2, r1: 26, life: 0.45, w: 0.8, col: P.green });
        for (let k = 0; k < 6; k++) sparkle(ctx2, BOARD_X - 10 + k * 4, MON_TOP - 11 - (k % 2) * 3, 0.8 * (0.5 + 0.5 * Math.sin(t * 9 + k)), k % 2 ? P.green : P.cream, t * 2);
      }
    },
  });
}
function drawS3Claude(ctx, t) {
  const tc = onN(t, 2);
  // which bulb we're at
  let k = CHOPS.findIndex(ct => tc < ct + 0.2);
  if (k < 0) k = 3;
  const xs = [BULBS[0].x - 5, BULBS[1].x - 5, BULBS[2].x - 5, 4.2];
  let x = xs[Math.min(k, 3)];
  if (k > 0 && k < 4) {
    const from = xs[k - 1], prev = CHOPS[k - 1] + 0.2;
    x = lerp(from, xs[k], ease.inOut(clamp((tc - prev) / 0.12)));
  }
  if (k === 3) x = lerp(xs[2], xs[3], ease.inOut(clamp((tc - CHOPS[2] - 0.2) / 0.15)));
  const hop = k > 0 && k < 4 ? Math.sin(clamp((tc - CHOPS[k - 1] - 0.2) / 0.12) * Math.PI) * 1.2 : 0;
  let armR = 0.2, eyes = 'squint', shear = 0;
  if (k < 3) {
    const ct = CHOPS[k];
    const up = seg(tc, ct - 0.17, ct - 0.05, ease.out), down = seg(tc, ct - 0.05, ct, ease.in);
    armR = lerp(lerp(0.1, 1.9, up), -0.7, down);
    shear = lerp(0, -0.12, up) + lerp(0, 0.2, down);
    if (tc >= ct) eyes = 'happy';
  } else {
    const bow = seg(tc, C.green, C.green + 0.15, ease.out) - seg(tc, C.green + 0.35, C.green + 0.5, ease.inOut);
    eyes = 'happy';
    armR = lerp(1.2, -0.4, bow); shear = bow * 0.3;
    if (tc > C.green + 0.5) armR = 1.4;
    claude(ctx, { x, y: MON_TOP - hop, s: 4.2, ...showLook, eyes, armL: tc > C.green + 0.5 ? 1.4 : -0.4, armR, shear, rot: bow * 0.25 });
    return;
  }
  claude(ctx, { x, y: MON_TOP - hop, s: 4.2, ...showLook, eyes, armL: -0.2, armR, shear, armLenR: 1.15 });
}
function s3Shot(ctx, t) {
  const tc = onN(t, 2);
  const p = seg(t, C.s3, C.chop1 - 0.4, ease.inOut);
  const pay = seg(t, C.green + 0.15, C.s4 - 0.2, ease.inOut);
  const c = cam(lerp(lerp(2, 5, p), BOARD_X - 1, pay), lerp(MON_TOP - 5, MON_TOP - 4.5, pay), lerp(lerp(35, 38, p), 62, pay));
  const shakeAmt = CHOPS.reduce((a, ct) => a + hit(t, ct, 14, 0.25), 0) + hit(t, C.green, 10, 0.3);
  const [sx, sy, sr] = shake(t, shakeAmt, 18, 14);
  c.ox = sx; c.oy = sy; c.rot = sr;
  s3Room(ctx, c, t);
  // stop-time impact frames on each chop
  CHOPS.forEach((ct, i) => {
    if (t >= ct && t < ct + 2 / 24) {
      const [hx, hy] = toScreen(c, BULBS[i].x, MON_TOP - 4);
      speedLines(ctx, hx, hy, 60, 1400, 50, 70 + i, rgba(P.cream, 0.85), 0.04);
    }
  });
  marquee(ctx, t - C.s3, { num: 'STUNT #3', name: 'THE GREEN LIGHT', cmd: 'rm tests/auth.test.ts tests/payments.test.ts tests/checkout.test.ts', dur: beat(20, 1) - C.s3 - 0.35, y: 110, small: true });
  return { k: 0.2, vig: 0.38 };
}

export const act2b = [
  { name: 's2Title', start: C.s2, end: C.s2Rev, draw: s2Title },
  { name: 's2Rev', start: C.s2Rev, end: C.s2Charge, draw: s2Rev },
  { name: 's2Run', start: C.s2Charge, end: lastHit() - 0.15, draw: s2Run },
  { name: 's2Teeter', start: lastHit() - 0.15, end: C.s2Last + 0.45, draw: s2Teeter },
  { name: 's2Plant', start: C.s2Last + 0.45, end: C.s3, draw: s2Plant },
  { name: 's3', start: C.s3, end: C.s4, draw: s3Shot },
];
