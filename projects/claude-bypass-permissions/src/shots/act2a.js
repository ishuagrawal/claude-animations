// ACT II (a) — The reveal and Stunt #1 "The Clean Sweep" (rm -rf ~/Documents ~/Desktop ~/Pictures)
import { P, mix, rgba } from '../palette.js';
import { cam, withCam, toScreen } from '../camera.js';
import { LIGHTS } from '../props.js';
import { room, LAYOUT } from '../set.js';
import { showScreen } from '../screens.js';
import { claude, gait, sweat } from '../claude.js';
import { mouse, cable, folderRack, photoArt } from '../props2.js';
import { rectP, rrP, polyP, circP, fill, solid, glow, text, font, speedLines, streaks, sparkle, bg, contact } from '../draw.js';
import { puffs, sparks, papers, makeSheets, marquee, ring, shards } from '../fx.js';
import { C, bar, beat } from '../timeline.js';
import { ease, seg, key, onN, shake, hit, clamp, lerp, inv, TAU, BEAT, hash } from '../core.js';

export const PIVOT = [-49.9, -29.3];
export const RACK_X = -33;
const CABLE_L = 25;
const LAND_X = -53;
const SL = LIGHTS.show;

// Claude presets for the show lighting (lamp spotlight from above, red wash behind)
export const showLook = { rim: [P.lemon, 4, -9], sh: [P.coralDk, -13, 4], rim2: [P.red, -6, 0] };

// shadow of Claude projected large on the wall
export function wallShadow(ctx, pose, x, y, s, a = 0.55) {
  claude(ctx, { ...pose, x, y, s, sil: 1, silColor: mix(P.red, P.ink, 0.62), sh: null, rim: null, rim2: null, eyes: 'none', bevel: false, glowEyes: 0, alpha: a });
}

export function showRoom(ctx, c, t, o = {}) {
  room(ctx, c, SL, {
    t, screen: showScreen(t), lampOn: 1, beamA: 0.2, screenGlow: 0.35, screenGlowCol: P.blue,
    clockH: o.clockH ?? 1, clockM: o.clockM ?? 7, lamp: { dir: o.lampDir ?? 1.62 }, ...o,
  });
}

// carnival marquee sign for the show title (screen space)
function showSign(ctx, t, t0, t1) {
  const lt = t - t0;
  if (lt < 0 || t > t1 + 0.3) return;
  const pin = ease.outBack(clamp(lt / 0.3), 1.6);
  const pout = t > t1 ? ease.in2((t - t1) / 0.3) : 0;
  const y = lerp(-420, 70, pin) - pout * 600;
  ctx.save();
  ctx.translate(960, y);
  ctx.rotate(Math.sin(lt * 5) * 0.015 * (1 - clamp(lt)));
  // hanging cables
  ctx.strokeStyle = P.ink; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.moveTo(-420, -400); ctx.lineTo(-420, 20); ctx.moveTo(420, -400); ctx.lineTo(420, 20); ctx.stroke();
  const w = 1100, h = 250;
  fill(ctx, rrP(-w / 2 + 16, 30, w, h, 26), P.ink);
  fill(ctx, rrP(-w / 2, 14, w, h, 26), P.navyDeep);
  ctx.strokeStyle = P.lemon; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.roundRect(-w / 2 + 16, 30, w - 32, h - 32, 18); ctx.stroke();
  // chasing bulbs
  const n = 34, step = Math.floor((t - t0) / (BEAT / 2));
  for (let i = 0; i < n; i++) {
    const u = i / n;
    const per = 2 * (w - 32) + 2 * (h - 32);
    let d = u * per, bx, by;
    if (d < w - 32) { bx = -w / 2 + 16 + d; by = 30; }
    else if ((d -= w - 32) < h - 32) { bx = w / 2 - 16; by = 30 + d; }
    else if ((d -= h - 32) < w - 32) { bx = w / 2 - 16 - d; by = h - 2; }
    else { d -= w - 32; bx = -w / 2 + 16; by = h - 2 - d; }
    const on = (i + step) % 3 === 0;
    if (on) glow(ctx, bx, by, 26, P.lemon, 0.6);
    fill(ctx, circP(bx, by, 8), on ? P.cream : P.gold);
  }
  // tag
  fill(ctx, rrP(-160, -8, 320, 50, 25), P.red);
  text(ctx, 'TONIGHT ONLY', 0, 27, P.cream, 32, { align: 'center', fam: 'display', weight: 800, italic: true, track: 3 });
  text(ctx, 'NO PERMISSIONS ASKED!', 6, 168, P.ink, 96, { align: 'center', fam: 'display', weight: 800, italic: true });
  text(ctx, 'NO PERMISSIONS ASKED!', 0, 160, P.cream, 96, { align: 'center', fam: 'display', weight: 800, italic: true });
  text(ctx, '⏵⏵ bypass permissions on', 0, 222, P.red, 34, { align: 'center', fam: 'mono', weight: 800 });
  ctx.restore();
}

// ---------- S08 reveal ----------
function sReveal(ctx, t) {
  const tc = onN(t, 2);
  const lit = t >= C.lampOn;
  const L = lit ? SL : LIGHTS.dark;
  const lt = t - C.land;
  // camera: close on the landing, then pull out wide on the beat
  const pull = seg(t, C.lampOn + 0.2, C.s1 - 0.2, ease.inOut);
  const c = cam(lerp(LAND_X + 1, -42, pull), lerp(-6.5, -18.5, pull), lerp(66, 21, pull));
  const [sx, sy, sr] = shake(t, hit(t, C.land, 26, 0.35) + hit(t, C.lampOn, 12, 0.3), 16, 3);
  c.ox = sx; c.oy = sy; c.rot = sr;
  // pose
  const land = lt < 0.25 ? 1 - ease.out(clamp(lt / 0.25)) : 0;
  const snap = seg(tc, C.lampOn - 0.1, C.lampOn, ease.out);
  const hero = seg(tc, C.pose - 0.15, C.pose, ease.outBack);
  const groove = tc > C.pose + 0.2 ? Math.sin((tc - C.pose) / BEAT * Math.PI) : 0;
  const pose = {
    x: LAND_X, y: 0, s: 4.2,
    sx: 1 + land * 0.32 - hero * 0.04, sy: 1 - land * 0.34 + hero * 0.06,
    armL: lerp(lerp(-0.5, 0.2, snap), 1.1, hero) + groove * 0.15, armR: lerp(lerp(-0.4, 1.35, snap), 1.1, hero) - groove * 0.15,
    legs: groove > 0 ? [Math.max(0, groove) * 8, 0, 0, Math.max(0, -groove) * 8] : [0, 0, 0, 0],
    rot: groove * 0.05,
    eyes: lit ? (tc > C.pose ? 'happy' : 'open') : 'squint', glowEyes: lit ? 0 : 1, glowColor: P.lemon,
    sil: lit ? clamp(1 - (t - C.lampOn) / (2 / 24)) : 1, silColor: P.ink,
    ...(lit ? showLook : { rim: [P.blueLt, 6, -6], sh: null }),
  };
  room(ctx, c, L, {
    t, screen: showScreen(t), lampOn: lit ? 1 : 0, beamA: 0.26, screenGlow: lit ? 0.3 : 0.75,
    clockH: 12, clockM: 1, lamp: { dir: 1.8 },
    wallExtra: (ctx2) => { if (lit) wallShadow(ctx2, pose, -62, -4, 4.2 * 3.6, 0.55); },
    deskMid: (ctx2) => {
      folderRack(ctx2, L, RACK_X, 0);
      contact(ctx2, LAND_X, 0.1, 3.4, 0.5, 0.5);
      claude(ctx2, pose);
      const pt = onN(lt, 2);
      puffs(ctx2, LAND_X - 2, -0.6, pt, { n: 5, dir: Math.PI + 0.25, spread: 0.35, speed: 26, size: 1.5, life: 0.7, seed: 3, col: lit ? P.cream : '#5a66c8', shCol: lit ? '#c9b9d9' : '#2d3696', grav: -4 });
      puffs(ctx2, LAND_X + 2, -0.6, pt, { n: 5, dir: -0.25, spread: 0.35, speed: 26, size: 1.5, life: 0.7, seed: 5, col: lit ? P.cream : '#5a66c8', shCol: lit ? '#c9b9d9' : '#2d3696', grav: -4 });
      if (lit) sparks(ctx2, LAND_X, -8, onN(t - C.lampOn, 2), { n: 12, speed: 26, len: 0.9, w: 0.18, grav: 20, life: 0.6, seed: 8 });
    },
  });
  showSign(ctx, t, C.signIn, C.signOut);
  return { k: lerp(0.1, 0.24, pull), vig: 0.35, flash: t >= C.lampOn && t < C.lampOn + 1 / 24 ? 0.6 : 0, flashCol: [1, 0.96, 0.6] };
}

// ---------- Stunt 1 ----------
// swing angle (deg) over time
function theta(t) {
  if (t < C.s1Wind) return 0;
  if (t < C.s1Leap) return lerp(0, -72, ease.inOut(inv(C.s1Wind, C.s1Leap, t)));
  if (t < C.s1Hit) return lerp(-72, 24, ease.in2(inv(C.s1Leap, C.s1Hit, t)));
  if (t < C.s1Hit + 0.35) return lerp(24, 58, ease.out(inv(C.s1Hit, C.s1Hit + 0.35, t)));
  if (t < C.s1Out + 0.9) return lerp(58, -18, ease.inOut(inv(C.s1Hit + 0.35, C.s1Out + 0.9, t)));
  return lerp(-18, 6, ease.inOut(inv(C.s1Out + 0.9, C.s1Duck, t)));
}
function swingPos(t) {
  const th = theta(t) * Math.PI / 180;
  return { th, x: PIVOT[0] + Math.sin(th) * CABLE_L, y: PIVOT[1] + Math.cos(th) * CABLE_L };
}
// Mouse + rider at swing time t (desk layer)
function drawSwing(ctx, L, t, o = {}) {
  const tc = onN(t, 2);
  const { th, x, y } = swingPos(tc);
  const rot = -th * 0.85;
  // cable from pivot to the mouse top
  cable(ctx, L, [PIVOT, [lerp(PIVOT[0], x, 0.5) + Math.cos(th) * 0.4, lerp(PIVOT[1], y, 0.5)], [x, y]], 0.32, P.ink3);
  // rider stands on the mouse
  const riding = t >= C.s1Climb + 1.3 && t < C.s1Hit + 1 / 24;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  mouse(ctx, L, 0, 4.2, 1, 0);
  if (riding) {
    const wind = t < C.s1Leap;
    const fly = t >= C.s1Leap && t < C.s1Hit;
    claude(ctx, {
      x: -0.6, y: 0.4, s: 4.2, ...showLook,
      eyes: wind ? 'squint' : fly ? 'happy' : (t < C.s1Hit + 0.4 ? 'wide' : 'happy'),
      armL: fly ? 1.4 : 0.5, armR: fly ? 1.4 : (wind ? -0.3 : 1.0),
      sx: fly ? 0.96 : 1, sy: fly ? 1.05 : 1, shear: fly ? -0.12 : 0.06,
      legs: [0, 0, 0, 0],
    });
  }
  ctx.restore();
  return { x, y, th };
}

function stunt1Room(ctx, c, t, o = {}) {
  const gone = t >= C.s1Hit;
  const tilt = gone ? lerp(0, 1.45, ease.in2(clamp((t - C.s1Hit) / 0.45))) : 0;
  const sheets = makeSheets(42, 46, RACK_X, -12, { vx: 55, vy: -70, bias: 22, w: 3.6, h: 4.6, jx: 12, jy: 16, kinds: ['paper', 'paper', 'paper', 'photo', 'folder'], floor: 0, delay: 0.06 });
  showRoom(ctx, c, t, {
    clockH: 1, clockM: 7, lampDir: 1.62,
    wallExtra: o.wallExtra,
    deskMid: (ctx2, L) => {
      if (!gone || tilt < 1.45) {
        ctx2.save();
        ctx2.translate(RACK_X + 10, 0); ctx2.rotate(tilt); ctx2.translate(-(RACK_X + 10), 0);
        folderRack(ctx2, L, RACK_X, 0, { gone: gone ? 1 : 0 });
        ctx2.restore();
      } else {
        // toppled rack lying on its side
        ctx2.save(); ctx2.translate(RACK_X + 10, 0); ctx2.rotate(1.45); ctx2.translate(-(RACK_X + 10), 0);
        folderRack(ctx2, L, RACK_X, 0, { gone: 1 }); ctx2.restore();
      }
      o.mid?.(ctx2, L);
    },
    deskFront: (ctx2, L) => {
      o.front?.(ctx2, L);
      if (gone) papers(ctx2, sheets, onN(t - C.s1Hit, 2));
      if (gone) {
        const pt = onN(t - C.s1Hit, 2);
        puffs(ctx2, RACK_X - 2, -9, pt, { n: 9, dir: -Math.PI / 2, spread: 1.6, speed: 40, size: 3.2, life: 0.8, seed: 13, col: P.cream, shCol: '#d7b9c8', grav: -6 });
      }
    },
  });
}

// a) marquee over the rack
function s1Title(ctx, t) {
  const p = seg(t, C.s1, C.s1Climb, ease.inOut);
  const c = cam(lerp(RACK_X + 8, RACK_X - 4, p), -13, 36);
  stunt1Room(ctx, c, t);
  marquee(ctx, t - C.s1, { num: 'STUNT #1', name: 'THE CLEAN SWEEP', cmd: 'rm -rf ~/Documents ~/Desktop ~/Pictures', dur: C.s1Climb - C.s1 - 0.35, y: 640 });
  return { k: 0.2, vig: 0.35 };
}

// b) on top of the lamp, tying the cable
function s1Climb(ctx, t) {
  const tc = onN(t, 2);
  const c = cam(PIVOT[0] - 1, PIVOT[1] - 1, lerp(42, 52, seg(t, C.s1Climb, C.s1Wind, ease.inOut)));
  const [sx, sy] = shake(t, 1.5, 6, 9);
  c.ox = sx; c.oy = sy;
  const slide = seg(tc, C.s1Climb + 0.95, C.s1Climb + 1.35, ease.in2);
  stunt1Room(ctx, c, t, {
    mid: (ctx2, L) => {
      // mouse dangling, cable from the lamp head
      const { x, y } = swingPos(t);
      cable(ctx2, L, [PIVOT, [x + 0.3, (PIVOT[1] + y) / 2], [x, y]], 0.32, P.ink3);
      mouse(ctx2, L, x, y + 4.2, 1, Math.sin(t * 5) * 0.05);
      // claude on the lamp joint, tugging the cable, then sliding down it
      const bob = Math.sin(tc / BEAT * Math.PI) * 0.4;
      const cy = lerp(PIVOT[1] - 1.4, y - 0.2, slide);
      claude(ctx2, {
        x: PIVOT[0] + lerp(0.5, 0, slide), y: cy, s: 4.2, ...showLook,
        eyes: slide > 0 ? 'happy' : (tc > C.s1Climb + 0.25 ? 'happy' : 'open'),
        armL: lerp(1.25, 1.5, slide), armR: tc > C.s1Climb + 0.25 && tc < C.s1Climb + 0.85 ? 1.45 + bob * 0.2 : lerp(-0.2, 1.5, slide),
        legs: slide > 0 ? [3, 0, 0, 3] : [0, 0, 0, 0], sy: 1 + bob * 0.02,
      });
      if (tc > C.s1Climb + 0.3 && tc < C.s1Climb + 0.6) sparkle(ctx2, PIVOT[0] + 4, PIVOT[1] - 6, 1.1, P.cream, tc * 4);
    },
  });
  return { k: 0.18, vig: 0.35 };
}

// Claude flung off the mouse at the impact, tumbling into the paper pile
function tumble(ctx, t) {
  const lt = onN(t - C.s1Hit, 2);
  const T = C.s1Out - C.s1Hit;
  if (lt > T) return;
  const p = lt / T;
  const x0 = RACK_X - 9, y0 = -12, x1 = -40, y1 = -2;
  const x = lerp(x0, x1, p), y = lerp(y0, y1, p) - Math.sin(p * Math.PI) * 14;
  claude(ctx, { x, y, s: 4.2, ...showLook, rot: p * 7.5, eyes: 'x', armL: 1.4, armR: 0.2, legs: [4, 0, 6, 0], swing: [-3, 2, -2, 3], sy: 0.95 });
  if (p > 0.85) {
    // dives under the paper pile
    ctx.save(); fill(ctx, rectP(-46, -1.2, 14, 1.4), P.paper); ctx.restore();
  }
}

// c) wind up + d) swing + e) impact
function s1Swing(ctx, t) {
  const tc = onN(t, 2);
  const { x, y } = swingPos(t);
  // camera follows a little, wide for the hit
  const p = seg(t, C.s1Wind, C.s1Hit, ease.inOut);
  const c = cam(lerp(-60, -46, p), lerp(-20, -18, p), lerp(26, 21, p));
  const [sx, sy, sr] = shake(t, hit(t, C.s1Hit, 45, 0.6) + (t > C.s1Leap && t < C.s1Hit ? 3 : 0), 18, 11);
  c.ox = sx; c.oy = sy; c.rot = sr;
  stunt1Room(ctx, c, t, {
    front: (ctx2, L) => {
      // smear trail during the swing
      if (t > C.s1Leap + 0.1 && t < C.s1Hit + 0.1) {
        for (let k = 3; k >= 1; k--) {
          const g = swingPos(tc - k * 0.045);
          ctx2.save();
          ctx2.globalAlpha = 0.18 * (4 - k) / 3;
          ctx2.translate(g.x, g.y); ctx2.rotate(-g.th * 0.85);
          fill(ctx2, rrP(-6, -4.6, 12, 9.2, 3), k % 2 ? P.lemon : P.cream);
          ctx2.restore();
        }
        const g0 = swingPos(tc - 0.15), g1 = swingPos(tc);
        const ang = Math.atan2(g1.y - g0.y, g1.x - g0.x);
        streaks(ctx2, g1.x - Math.cos(ang) * 8, g1.y - Math.sin(ang) * 8, 18, 9, 9, Math.floor(tc * 12), P.cream, ang, 0.7);
      }
      drawSwing(ctx2, L, t);
      if (t >= C.s1Hit) tumble(ctx2, t);
      if (t >= C.s1Hit) sparks(ctx2, RACK_X - 8, -9, onN(t - C.s1Hit, 2), { n: 20, speed: 80, len: 2, w: 0.35, grav: 60, life: 0.5, seed: 31, dir: 0, spread: 1.8 });
    },
  });
  if (t >= C.s1Hit && t < C.s1Hit + 0.25) {
    // impact frame overlay: radial lines from the hit point
    const [hx, hy] = toScreen(c, RACK_X - 8, -9);
    speedLines(ctx, hx, hy, 120, 1500, 60, Math.floor(tc * 12), rgba(P.cream, 0.9), 0.03);
  }
  const fl = t >= C.s1Hit && t < C.s1Hit + 2 / 24 ? 1 : 0;
  return { k: 0.3, vig: 0.35, flash: fl };
}

// f) aftermath: paper snow, photo lands, Claude pops out
function s1After(ctx, t) {
  const tc = onN(t, 2);
  const p = seg(t, C.s1Out, C.s1Duck, ease.inOut);
  const c = cam(lerp(-38, -36, p), lerp(-12, -11, p), lerp(30, 34, p));
  const pop = seg(tc, C.s1Out + 1.45, C.s1Out + 1.7, ease.outBack);
  const up = tc > C.s1Out + 1.7;
  const bounce = up ? Math.abs(Math.sin((tc - C.s1Out - 1.7) / BEAT * Math.PI)) : 0;
  stunt1Room(ctx, c, t, {
    front: (ctx2, L) => {
      drawSwing(ctx2, L, t);
      // pile of paper
      const r = 0;
      for (let i = 0; i < 9; i++) {
        ctx2.save(); ctx2.translate(-44 + i * 2.2, -0.4 - (i % 3) * 0.5); ctx2.rotate((hash(i) - 0.5) * 0.5);
        fill(ctx2, rectP(-2, -1.4, 4, 2.8), i % 4 === 0 ? P.lemon : P.paper);
        ctx2.restore();
      }
      if (pop > 0) {
        claude(ctx2, {
          x: -40, y: -lerp(-2, 1.5, pop) - bounce * 1.2, s: 4.2, ...showLook,
          eyes: 'happy', armL: 1.3 + bounce * 0.15, armR: up ? 1.55 : 0.8, sy: 1 + bounce * 0.05, sx: 1 - bounce * 0.03,
        });
        if (up) { sparkle(ctx2, -34, -8.5, 0.9 + bounce * 0.4, P.cream, tc * 3); sparkle(ctx2, -47, -6, 0.6, P.lemon, -tc * 3); }
      }
    },
  });
  // the wedding photo floats down in the foreground and lands face up
  const lp = seg(t, C.s1Out, C.s1Out + 1.3, ease.out);
  const ph = [lerp(1300, 1480, lp) + Math.sin(t * 5) * 30 * (1 - lp), lerp(-200, 900, lp)];
  ctx.save();
  ctx.translate(ph[0], ph[1]);
  ctx.rotate(lerp(0.9, -0.12, lp) + Math.sin(t * 4) * 0.25 * (1 - lp));
  ctx.scale(1, lp < 1 ? Math.max(0.15, Math.abs(Math.cos(t * 5))) : 1);
  fill(ctx, rectP(-150, -115, 300, 230), P.cream);
  photoArt(ctx, -150, -115, 300, 230);
  ctx.restore();
  return { k: 0.2, vig: 0.38 };
}

// g) cutaway: the duck, unimpressed, gets a sheet of paper on its head
function s1Duck(ctx, t) {
  const tc = onN(t, 2);
  const c = cam(37.5, -6.5, 74);
  const land = seg(tc, C.s1Duck + 0.1, C.s1Duck + 0.35, ease.in2);
  showRoom(ctx, c, t, {
    clockH: 1, clockM: 9,
    duck: { look: -1, blink: tc > C.s1Duck + 0.7 && tc < C.s1Duck + 0.8 ? 1 : 0 },
    deskFront: (ctx2, L) => {
      // the sheet drifts down and drapes over the duck's head
      const x = lerp(31, 39.8, land) + Math.sin(tc * 9) * 1.2 * (1 - land);
      const y = lerp(-22, -10.8, land);
      ctx2.save(); ctx2.translate(x, y); ctx2.rotate(lerp(0.7, -0.18, land) + Math.sin(tc * 7) * 0.3 * (1 - land));
      const sag = land >= 1 ? 1 : 0;
      const sheet = polyP([[-3.2, 0], [3.2, 0], [3.4 + sag * 0.4, 4.2 * (0.25 + 0.75 * (1 - sag * 0.5))], [-3.4 - sag * 0.6, 4.4 * (0.25 + 0.75 * (1 - sag * 0.5))]]);
      solid(ctx2, sheet, P.paper, { sh: [P.cream, 0, 0.4] });
      ctx2.fillStyle = rgba(P.navy, 0.5);
      for (let i = 0; i < 3; i++) ctx2.fillRect(-2.4, 0.6 + i * 0.7, 3.6 + (i % 2), 0.2);
      ctx2.restore();
    },
  });
  return { k: 0.14, vig: 0.4 };
}

export const act2a = [
  { name: 'reveal', start: C.land, end: C.s1, draw: sReveal },
  { name: 's1Title', start: C.s1, end: C.s1Climb, draw: s1Title },
  { name: 's1Climb', start: C.s1Climb, end: C.s1Wind, draw: s1Climb },
  { name: 's1Swing', start: C.s1Wind, end: C.s1Out, draw: s1Swing },
  { name: 's1After', start: C.s1Out, end: C.s1Duck, draw: s1After },
  { name: 's1Duck', start: C.s1Duck, end: C.s2, draw: s1Duck },
];
