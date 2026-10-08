// ACT I — "Last command before bed": the developer launches Claude in bypass mode and leaves.
import { P, mix, rgba } from '../palette.js';
import { cam, withCam, apply } from '../camera.js';
import { LIGHTS } from '../props.js';
import { room, dev, finger, scr, scrZoom, LAYOUT } from '../set.js';
import * as T from '../terminal.js';
import { claude } from '../claude.js';
import { rectP, rrP, polyP, circP, fill, solid, glow, text, speedLines, sparkle, bg } from '../draw.js';
import { bolt, ring, sparks, puffs, shards } from '../fx.js';
import { C, MUSIC } from '../timeline.js';
import { ease, seg, key, onN, shake, hit, clamp, lerp, inv, TAU, W, H, hash } from '../core.js';

const PROMPT = (s) => [['dev@macbook', P.lemon, true], [' acme-app ', P.cream], ['% ', P.termDim], [s, P.cream]];

function camScreen(vx, vy, vw, rot = 0, ox = 0, oy = 0) {
  const [x, y] = scr(vx, vy);
  return cam(x, y, scrZoom(vw), rot, ox, oy);
}

// ---------- screen contents ----------
function shellHistory(s, y0) {
  T.line(s, 60, y0, PROMPT('npm test'));
  T.line(s, 60, y0 + 46, [['  ✗ 3 failing', P.red, true], ['   ✓ 212 passing', P.cream]]);
  T.line(s, 60, y0 + 112, PROMPT('du -sh ~'));
  T.line(s, 60, y0 + 158, [['  1.8T', P.lemon, true], ['    /Users/dev', P.cream]]);
}
const CMD = 'claude --dangerously-skip-permissions';

function shellScreen(t) {
  return (s, w, h) => {
    T.bg(s, w, h);
    shellHistory(s, 110);
    const str = T.typed(CMD, t, C.typeCmd, 22);
    const end = T.line(s, 60, 400, PROMPT(str));
    if (t < C.enterCmd) T.cursor(s, end, 400, t);
  };
}

function warningScreen(t) {
  return (s, w, h) => {
    T.bg(s, w, h);
    s.save(); s.globalAlpha = 0.3; shellHistory(s, -150); T.line(s, 60, 150, PROMPT(CMD)); s.restore();
    const lt = t - C.warnIn;
    const pop = ease.outBack(clamp(lt / 0.16), 2.5);
    s.save();
    s.translate(800, 470); s.scale(0.9 + 0.1 * pop, 0.9 + 0.1 * pop); s.translate(-800, -470);
    s.globalAlpha = clamp(lt / 0.06);
    const sel = t >= C.warnDown ? 1 : 0;
    T.warningBox(s, 110, 200, 1380, sel, t);
    if (t >= C.warnEnter) {
      // accepted: inverse highlight flashes on the chosen option
      const on = Math.floor((t - C.warnEnter) * 16) % 2 === 0;
      if (on) {
        fill(s, rectP(140, 200 + 70 + 70 + T.LH * 4 + 60 + T.LH + 6 - 36, 470, 50), P.red);
        T.line(s, 150, 200 + 70 + 70 + T.LH * 4 + 60 + T.LH + 6, [['❯ 2. Yes, I accept', P.ink, true]]);
      }
    }
    s.restore();
  };
}

const TASK = 'clean up my machine and make the tests pass. going to bed';
export function taskScreen(t, o = {}) {
  return (s, w, h) => {
    T.bg(s, w, h);
    T.welcome(s, 50, 36, 980, { eyeGlow: o.eyeGlow || 0, eyeCol: o.eyeCol || P.ink, hideMascot: o.hideMascot });
    const entered = t >= C.enterTask;
    if (entered) {
      T.line(s, 60, 300, [['> ', P.termDim], [TASK, P.termDim]]);
      if (t > C.enterTask + 0.12) T.spinner(s, 60, 380, t, o.verb || 'Freelancing');
    }
    const str = entered ? '' : T.typed(TASK, t, C.typeTask, 26);
    T.inputBox(s, 40, 700, 1520, str, t, { cursor: !entered || Math.floor(t * 2.2) % 2 === 0 });
    const pulse = entered ? 0.5 + 0.5 * Math.sin((t - C.enterTask) * 9) : 0;
    T.statusLine(s, 50, 826, 'bypass', entered ? 0.5 + pulse * 0.5 : 0.15);
    o.extra?.(s, t);
  };
}

// ---------- S01 shell ----------
function sShell(ctx, t) {
  if (t < 4 / 24) { bg(ctx, P.ink); return { vig: 0 }; }
  const L = LIGHTS.work;
  const p = seg(t, 0.15, C.enterShot, ease.inOut2);
  const c = camScreen(lerp(700, 720, p), lerp(300, 360, p), lerp(1560, 1340, p), 0);
  const [sx, sy] = shake(t, t > C.enterCmd ? 0 : 0, 10);
  room(ctx, c, L, { t, screen: shellScreen(t), lampOn: 1, beam: false });
  return { k: 0.14, vig: 0.42 };
}

// ---------- S02 enter key close-up ----------
const KEYS = [
  ['P', '['],
  [';', "'"],
  ['/', 'shift'],
];
function keycap(ctx, x, y, w, h, legend, col, press, rim, small = false) {
  const d = press * 10;
  // skirt
  solid(ctx, rrP(x, y + 18 + d * 0.3, w, h, 16), mix(col, P.ink, 0.45), {});
  // top
  const top = rrP(x + 10, y + d, w - 20, h - 26, 14);
  solid(ctx, top, col, { sh: [mix(col, P.navy, 0.35), -10, 10], rim: [rim, 6, -6] });
  text(ctx, legend, x + 34, y + d + (small ? 64 : 84), mix(col, P.ink, 0.75), small ? 40 : 60, { fam: 'cond', weight: 700 });
}
function sEnter(ctx, t) {
  const tc = onN(t, 2);
  const lt = t - C.enterCmd;
  const impact = lt >= 0 && lt < 3 / 24;
  const press = lt < 0 ? 0 : lt < 0.05 ? 1 : 1 - ease.out(clamp((lt - 0.08) / 0.25)) * 0.6;
  const [sx, sy] = shake(t, hit(t, C.enterCmd, 22, 0.35), 18, 4);
  ctx.save();
  ctx.translate(sx, sy);
  bg(ctx, impact ? P.lemon : '#0d0f3c');
  if (impact) speedLines(ctx, 1180, 560, 140, 1300, 70, 7 + frameSeed(t), P.ink, 0.05);
  else glow(ctx, 1500, 0, 1100, P.blue, 0.55);
  // keyboard plate
  ctx.save();
  ctx.translate(960, 560);
  ctx.rotate(-0.1);
  ctx.scale(1.45, 1.45);
  ctx.translate(-960, -560);
  const rim = impact ? P.ink : P.blueLt;
  const KC = impact ? P.ink3 : '#e8e4d6';
  const rows = [
    [['O', 1], ['P', 1], ['[', 1], [']', 1], ['\\', 1.5]],
    [['L', 1], [';', 1], ["'", 1], ['return', 2.25, 'enter']],
    [['.', 1], ['/', 1], ['shift', 2.75]],
  ];
  const u = 150;
  rows.forEach((r, ri) => {
    let x = 300 + ri * 40;
    const y = 220 + ri * 165;
    r.forEach(([lg, wu, kind]) => {
      const ww = u * wu;
      const isEnter = kind === 'enter';
      keycap(ctx, x, y, ww - 10, 150, lg, isEnter ? (impact ? P.ink : P.red) : KC, isEnter ? press : 0, rim, lg.length > 2);
      x += ww;
    });
  });
  ctx.restore();
  // finger: descends then slams
  const fy = lt < -0.2 ? -500 : lt < 0 ? lerp(-420, 345, ease.in(inv(-0.2, 0, lt))) : 345 + press * 14;
  if (lt >= 0) sparks(ctx, 960, 400, onN(lt, 2), { n: 16, speed: 1100, len: 30, w: 6, grav: 900, life: 0.35, col: P.lemon, col2: P.cream, seed: 21, spread: 1.6 });
  if (t > C.enterCmd - 0.22) finger(ctx, 960, fy, 4.4, impact ? P.lemon : P.blueLt);
  ctx.restore();
  return { k: 0.18, vig: 0.35 };
}
const frameSeed = t => Math.floor(t * 12);

// ---------- S03 warning ----------
function sWarning(ctx, t) {
  const L = LIGHTS.work;
  const lt = t - C.warnIn;
  const p = seg(t, C.warnIn, C.taskShot, ease.inOut2);
  const z = lerp(1640, 1460, p);
  let c = camScreen(800, 470, z);
  const [sx, sy, sr] = shake(t, hit(t, C.warnIn, 14, 0.3) + hit(t, C.warnEnter, 10, 0.25), 16, 5);
  c.ox = sx; c.oy = sy; c.rot = sr;
  room(ctx, c, L, { t, screen: warningScreen(t), lampOn: 1, beam: false, screenGlowCol: P.red });
  const fl = lt < 2 / 24 ? 0.85 : 0;
  return { k: 0.14, vig: 0.42, flash: fl, flashCol: [0.95, 0.16, 0.32] };
}

// ---------- S04 task ----------
function sTask(ctx, t) {
  const L = LIGHTS.work;
  let c;
  if (t < C.enterTask + 0.06) {
    const p = seg(t, C.taskShot, C.enterTask, ease.inOut2);
    c = camScreen(lerp(760, 820, p), lerp(560, 600, p), lerp(1640, 1460, p));
  } else {
    const p = seg(t, C.enterTask + 0.15, C.lightsShot, ease.inOut);
    c = camScreen(lerp(820, 420, p), lerp(600, 815, p), lerp(1460, 800, p));
  }
  const [sx, sy] = shake(t, hit(t, C.enterTask, 10, 0.3), 16, 6);
  c.ox = sx; c.oy = sy;
  room(ctx, c, L, { t, screen: taskScreen(t), lampOn: 1, beam: false, screenGlowCol: t > C.enterTask ? P.red : P.blue });
  return { k: 0.14, vig: 0.45 };
}

// ---------- S05 lights out ----------
// big arm reaching in (desk-layer cm coords)
function reachArm(ctx, sx, sy, hx, hy, w, rim, pinch = 0) {
  const dx = hx - sx, dy = hy - sy, d = Math.hypot(dx, dy), nx = -dy / d, ny = dx / d;
  const p = new Path2D();
  p.moveTo(sx + nx * w, sy + ny * w);
  p.lineTo(hx + nx * w * 0.62, hy + ny * w * 0.62);
  p.lineTo(hx - nx * w * 0.62, hy - ny * w * 0.62);
  p.lineTo(sx - nx * w, sy - ny * w);
  p.closePath();
  const a = Math.atan2(dy, dx);
  const hand = new Path2D();
  const m = new DOMMatrix().translate(hx, hy).rotate(a * 180 / Math.PI);
  const h = new Path2D();
  h.ellipse(w * 0.55, 0, w * 1.15, w * 0.9, 0, 0, TAU);
  // fingers: index + middle reaching, thumb pinching
  h.roundRect(w * 1.2, -w * 0.78 + pinch * w * 0.3, w * 1.5, w * 0.46, w * 0.23);
  h.roundRect(w * 1.25, -w * 0.25, w * 1.15, w * 0.44, w * 0.22);
  h.roundRect(w * 1.0, w * 0.3 - pinch * w * 0.3, w * 1.05, w * 0.46, w * 0.23);
  hand.addPath(h, m);
  const shape = new Path2D();
  shape.addPath(p); shape.addPath(hand);
  solid(ctx, shape, P.ink, { rim: [rim, 0.5, -0.5] }, true);
  // sleeve cuff
  const cuff = new Path2D();
  const cm = new DOMMatrix().translate(hx - Math.cos(a) * w * 3.2, hy - Math.sin(a) * w * 3.2).rotate(a * 180 / Math.PI);
  const cr = new Path2D(); cr.roundRect(-w * 8, -w * 1.25, w * 8, w * 2.5, w * 0.4);
  cuff.addPath(cr, cm);
  solid(ctx, cuff, P.navyDeep, { rim: [rim, 0.5, -0.5] });
}

function sLightsOut(ctx, t) {
  const off = t >= C.lampOff;
  const L = off ? LIGHTS.dark : LIGHTS.work;
  const p = seg(t, C.lightsShot, C.bootShot, ease.inOut2);
  const c = cam(lerp(-26, -20, p), lerp(-40, -38, p), lerp(12.6, 13.4, p));
  const [sx, sy] = shake(t, hit(t, C.doorShut, 5, 0.3), 14, 8);
  c.ox = sx; c.oy = sy;
  const doorOpen = t < C.doorShut - 0.45 ? 1 : 1 - ease.in2(inv(C.doorShut - 0.45, C.doorShut, t));
  const minute = t >= C.clockTick ? 0 : 59, hour = t >= C.clockTick ? 12 : 11;
  const tc = onN(t, 2);
  room(ctx, c, L, {
    t, screen: taskScreen(Math.max(t, C.enterTask + 0.25)), lampOn: off ? 0 : 1, beamA: 0.18,
    door: doorOpen, clockH: hour, clockM: minute,
    screenGlow: off ? 0.75 : 0.5,
    deskFront: (ctx2, L2, lp) => {
      // the developer's arm reaches in from the top-left and clicks the lamp off
      const inP = seg(tc, C.lightsShot + 0.1, C.lampOff - 0.08, ease.out);
      const outP = seg(tc, C.lampOff + 0.15, C.lampOff + 0.5, ease.in2);
      const k = inP * (1 - outP);
      if (k > 0.001) {
        const hx = lerp(-150, lp.j2[0] - 1.5, k), hy = lerp(-120, lp.j2[1] - 3.5, k);
        reachArm(ctx2, -170, -150, hx, hy, 5.2, off ? P.blue : P.blueLt, tc >= C.lampOff - 0.04 ? 1 : 0);
      }
    },
  });
  // body passing through the foreground (screen space), right -> left
  const wp = seg(tc, C.wipe, C.wipe + 0.48, ease.inOut2);
  if (wp > 0 && wp < 1) {
    ctx.save();
    dev(ctx, { rim: P.blue }, lerp(2400, -700, wp), 1180, 26, { armA: 1.6, armB: 0.1, lean: -0.08, rim: P.blue });
    ctx.restore();
  }
  return { k: 0.16, vig: 0.5 };
}

// ---------- S06 eyes boot ----------
function sBoot(ctx, t) {
  const L = LIGHTS.dark;
  const tc = onN(t, 2);
  const on = (tc >= C.eyesOn && tc < C.eyesOn + 0.08) || (tc >= C.eyesOn + 0.13 && tc < C.eyesOn + 0.18) || tc >= C.eyesOn + 0.26;
  const eg = on ? (tc >= C.eyesOn + 0.26 ? lerp(0.6, 1.4, seg(t, C.eyesOn + 0.26, C.burst)) : 0.5) : 0;
  const bulge = seg(t, C.burst - 0.35, C.burst, ease.in);
  // mascot icon center in virtual px: x 44+56, y 36+52+38
  const vx = 50 + 44 + 56, vy = 36 + 52 + 38;
  const p = seg(t, C.bootShot, C.burst, ease.inOut2);
  const [sx, sy, sr] = shake(t, 3 + bulge * 18 + hit(t, C.ring, 14, 0.4), 18, 9);
  const c = camScreen(lerp(vx + 40, vx, p), lerp(vy + 20, vy, p), lerp(520, 300, p) * (1 - bulge * 0.35), sr, sx, sy);
  room(ctx, c, L, {
    t, lampOn: 0, screenGlow: 0.8,
    screen: taskScreen(Math.max(t, C.enterTask + 0.35), {
      eyeCol: on ? P.lemon : P.ink, eyeGlow: eg, verb: 'Freelancing',
      extra: (s, tt) => {
        // electric crackles around the icon
        const tcc = onN(tt, 2);
        if (tcc >= C.crackle) {
          const n = 2 + Math.floor(seg(tt, C.crackle, C.burst) * 4);
          for (let i = 0; i < n; i++) {
            const sd = Math.floor(tcc * 12) * 7 + i * 31;
            const a = hash(sd) * TAU, r0 = 40 + hash(sd + 1) * 20, r1 = 120 + hash(sd + 2) * 160;
            bolt(s, vx + Math.cos(a) * r0, vy + Math.sin(a) * r0 * 0.7, vx + Math.cos(a) * r1, vy + Math.sin(a) * r1 * 0.7, sd, { w: 7, jag: 0.22, col: i % 3 ? P.cyan : P.lemon, glowA: 0.35 });
          }
        }
        ring(s, vx, vy - 8, tt - C.ring, { r0: 20, r1: 520, life: 0.45, w: 16, col: P.cyan });
        if (bulge > 0) glow(s, vx, vy, 200 + bulge * 900, P.cream, bulge * 0.9);
      },
    }),
  });
  return { k: 0.14 + bulge * 0.35, vig: 0.5 };
}

// ---------- S07 burst out of the screen ----------
function sBurst(ctx, t) {
  const lt = t - C.burst;
  const tc = onN(lt, 2);
  bg(ctx, P.red);
  speedLines(ctx, 960, 520, 160, 1400, 90, 3 + Math.floor(tc * 12), P.ink, 0.045);
  glow(ctx, 960, 520, 520, P.lemon, 0.5);
  const s = lerp(380, 1250, ease.in2(clamp(tc / 0.3)));
  claude(ctx, {
    x: 960, y: 520 + s * 0.55, s, sil: 1, eyes: 'squint', glowEyes: 1, glowColor: P.lemon,
    armL: 0.25, armR: 0.25, armLenL: 1.2, armLenR: 1.2, legs: [-4, 6, 6, -4], swing: [-8, -3, 3, 8], legLen: 1.25, sh: null, rim: [P.lemon, 5, -5], bevel: false,
  });
  shards(ctx, 960, 520, tc + 0.08, { n: 12, speed: 2600, size: 44, col: P.cream, col2: P.cyan, grav: 0, life: 0.6, spread: Math.PI, seed: 4 });
  const fl = t >= C.flash1 ? 1 : 0;
  return { k: 0.28, vig: 0.3, flash: fl };
}

export const act1 = [
  { name: 'shell', start: 0, end: C.enterShot, draw: sShell },
  { name: 'enter', start: C.enterShot, end: C.warnIn, draw: sEnter },
  { name: 'warning', start: C.warnIn, end: C.taskShot, draw: sWarning },
  { name: 'task', start: C.taskShot, end: C.lightsShot, draw: sTask },
  { name: 'lightsOut', start: C.lightsShot, end: C.bootShot, draw: sLightsOut },
  { name: 'boot', start: C.bootShot, end: C.burst, draw: sBoot },
  { name: 'burst', start: C.burst, end: MUSIC, draw: sBurst },
];
