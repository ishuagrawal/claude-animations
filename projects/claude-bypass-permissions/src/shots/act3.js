// ACT III — "The morning after" and the epilogue ("Keep it in a sandbox").
import { P, mix, rgba } from '../palette.js';
import { cam, toScreen, withCam } from '../camera.js';
import { LIGHTS, lit, tone, duck, mug as mugProp } from '../props.js';
import { room, dev, LAYOUT, scr, scrZoom } from '../set.js';
import * as T from '../terminal.js';
import { claude, sweat, gait } from '../claude.js';
import { folderRack, domino, DOM_W, scoreboard, sandbox, mouse, cable, photoArt } from '../props2.js';
import { rectP, rrP, polyP, circP, ellP, blobP, fill, solid, glow, text, font, sparkle, contact, bg, speedLines } from '../draw.js';
import { puffs, sparks, papers, makeSheets, shards, ring } from '../fx.js';
import { C } from '../timeline.js';
import { ease, seg, onN, shake, hit, clamp, lerp, inv, TAU, BEAT, hash, rng, W, H } from '../core.js';

const ML = LIGHTS.morning;
const WP = LAYOUT.WALL_PAR, WIN = LAYOUT.window, SILL = WIN.y + WIN.h;
const camW = (x, y, z, rot = 0) => cam(x / WP, y / WP, z, rot);

// leftover wreckage from the night, on the desk
function wreckage(ctx, L, t) {
  // toppled ~/ rack + paper drifts
  ctx.save(); ctx.translate(-23, 0); ctx.rotate(1.45); ctx.translate(23, 0); folderRack(ctx, L, -33, 0, { gone: 1 }); ctx.restore();
  const r = rng(321);
  for (let i = 0; i < 26; i++) {
    const x = -66 + r() * 60, y = -0.3 - r() * 0.8;
    ctx.save(); ctx.translate(x, y); ctx.rotate((r() - 0.5) * 0.7);
    const k = r();
    fill(ctx, rectP(-1.8, -0.5, 3.6, 1.0), tone(L, k < 0.2 ? P.lemon : k < 0.3 ? P.sky : P.paper));
    ctx.restore();
  }
  // fallen dominoes along the right
  for (let i = 0; i < 18; i++) domino(ctx, L, 66 + i * 3.3, 0, 1.2, i, {});
  // the mouse, still dangling from the lamp
  cable(ctx, L, [[-49.9, -29.3], [-49.5, -16], [-49.8, -4.6]], 0.32, P.ink3);
  mouse(ctx, L, -49.8, -0.4, 1, 0.08);
}

function morningRoom(ctx, c, t, o = {}) {
  room(ctx, c, ML, {
    t, lampOn: 0.6, beamA: 0.08, screenGlow: 0.15, clockH: 7, clockM: 12, steam: 0,
    screen: o.screen || summaryScreen(t), lamp: { dir: 1.62 },
    windowView: { sky: '#ffb0a0', moon: P.lemon, moonR: 20, moonX: WIN.x + WIN.w * 0.72, moonY: WIN.y + 40, day: 1, stars: false },
    windowOpen: 1, hideMug: true,
    deskMid: (ctx2, L, lp, mon) => {
      wreckage(ctx2, L, t);
      scoreboard(ctx2, L, 18, -48.4, { green: 1, passing: 212, failing: 0 });
      // stubs of the chopped test bulbs
      [-15, -8.5, -2].forEach(x => { fill(ctx2, rrP(x - 1.2, -49.8, 2.4, 1.4, 0.3), tone(L, P.ink3)); fill(ctx2, polyP([[x - 1.1, -49.8], [x - 0.6, -50.8], [x - 0.1, -50.2], [x + 0.5, -51], [x + 1.1, -49.8]]), rgba(P.cream, 0.7)); });
      o.mid?.(ctx2, L);
    },
    ...o.room,
  });
}

// ---------- summary text on the monitor ----------
const SUMMARY = [
  [['⏺ ', P.cream], ['All done! While you were asleep I:', P.cream, true]],
  [['  • Freed up ', P.cream], ['1.8 TB', P.lemon, true], [' (cleaned ~/Documents, ~/Desktop, ~/Pictures)', P.cream]],
  [['  • Simplified main\'s git history ', P.cream], ['(force-pushed a clean slate)', P.termDim]],
  [['  • Got the test suite to ', P.cream], ['100% passing ✓', P.lemon, true]],
  [['  • Dropped the unused ', P.cream], ['"production"', P.red, true], [' database', P.cream]],
  [['  • Spun up ', P.cream], ['500 GPUs', P.lemon, true], [' so CI runs faster 🚀', P.cream]],
  [['    Est. cloud cost: ', P.termDim], ['$27,520/hr', P.red, true]],
  [['  Anything else? 😊', P.cream, true]],
];
const SUM_CHARS = SUMMARY.map(l => l.reduce((a, s) => a + s[0].length, 0));
// lines arrive one at a time (streamed), each held long enough to read
export const LINE_GAP = 0.82;
function summaryScreen(t, t0 = C.summary + 0.15) {
  return (s, w, h) => {
    T.bg(s, w, h);
    T.line(s, 60, 64, [['> ', P.termDim], ['clean up my machine and make the tests pass. going to bed', P.termDim]], 28);
    let y = 150;
    SUMMARY.forEach((segs, i) => {
      let budget = (t - (t0 + i * LINE_GAP)) * 110;
      if (budget <= 0) return;
      const show = [];
      for (const sg of segs) {
        if (budget <= 0) break;
        const n = Math.min(sg[0].length, Math.floor(budget));
        show.push([sg[0].slice(0, n), sg[1], sg[2]]);
        budget -= sg[0].length;
      }
      T.line(s, 50, y, show, 34);
      y += i === 0 ? 66 : 56;
    });
    T.inputBox(s, 40, 730, 1520, '', t);
    T.statusLine(s, 50, 850, 'bypass', 0.2);
  };
}

// ---------- S14 sunrise ----------
function sSunrise(ctx, t) {
  const p = seg(t, C.sunrise, C.doorOpen, ease.inOut);
  const c = camW(lerp(110, 114, p), lerp(-50, -46, p), lerp(26, 32, p));
  morningRoom(ctx, c, t, {
    room: {
      windowView: { sky: '#ff9c8c', moon: P.lemon, moonR: 15, moonX: 116, moonY: SILL - 9, day: 1, stars: false, cityH: 0.065 },
      windowInside: (ctx2) => {
        // birds crossing
        ctx2.save(); ctx2.beginPath(); ctx2.rect(WIN.x, WIN.y, WIN.w, WIN.h); ctx2.clip();
        for (let i = 0; i < 4; i++) {
          const bt = t - C.sunrise - i * 0.35;
          const bx = WIN.x + 14 + bt * 9 + i * 4, by = WIN.y + 34 + i * 2.5 + Math.sin(bt * 3) * 1.2;
          const flap = Math.sin(onN(t, 2) * 22 + i) * 0.9;
          ctx2.strokeStyle = P.ink; ctx2.lineWidth = 0.22; ctx2.lineJoin = 'round';
          ctx2.beginPath(); ctx2.moveTo(bx - 0.8, by - flap * 0.6); ctx2.lineTo(bx, by); ctx2.lineTo(bx + 0.8, by - flap * 0.6); ctx2.stroke();
        }
        ctx2.restore();
      },
      wallExtra: (ctx2, L) => {
        // Claude sitting on the sill, back to us, silhouetted against the sun
        const tc = onN(t, 2);
        const swingL = Math.sin(tc * 3.2) * 4, breathe = Math.sin(tc * 2) * 0.015;
        claude(ctx2, { x: 116, y: SILL + 1.4, s: 4.2, sil: 1, silColor: P.ink, sh: null, rim: [P.lemon, 0, -6], eyes: 'none', legs: [-3 + swingL * 0.3, -3, -3, -3 - swingL * 0.3], swing: [swingL * 0.4, 0, 0, -swingL * 0.4], legLen: 1.25, sy: 1 + breathe, armL: -0.25, armR: -0.25 });
      },
    },
  });
  return { k: 0.2, vig: 0.32 };
}

// ---------- S15 the developer comes in ----------
function sDoor(ctx, t) {
  const tc = onN(t, 2);
  const p = seg(t, C.doorOpen, C.summary, ease.inOut);
  const c = cam(lerp(-22, -14, p), -36, lerp(12.4, 13.2, p));
  morningRoom(ctx, c, t, {
    room: { door: ease.out(clamp((t - C.doorOpen + 0.1) / 0.3)) },
  });
  // the developer walks in from the left, mug in hand (screen space silhouette)
  const wp = ease.out(clamp((tc - C.doorOpen - 0.15) / 1.0));
  const bob = Math.abs(Math.sin(tc * 7)) * 12 * (1 - wp);
  const x = lerp(-500, 330, wp);
  const r = dev(ctx, { rim: P.cream }, x, 1140 - bob, 20, { armA: 0.35, armB: -0.9, lean: 0.03, rim: P.cream, col: '#262267' });
  heldMug(ctx, r.hand[0] + 10, r.hand[1] - 40, 14, 0, tc);
  return { k: 0.16, vig: 0.3 };
}
function heldMug(ctx, x, y, s, rot, t) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot); ctx.scale(s, s);
  mugProp(ctx, ML, 0, 0, { steam: 1, t, label: true });
  ctx.restore();
}

// ---------- S16 the summary ----------
const SUM_READ = 6.4; // seconds on the screen before cutting to Claude's proud face
function sSummary(ctx, t) {
  const tc = onN(t, 2);
  if (t < C.summary + SUM_READ) {
    // over-the-shoulder read of the screen, lines streaming in
    const p = seg(t, C.summary, C.summary + SUM_READ, ease.inOut);
    const [x, y] = scr(lerp(760, 720, p), lerp(400, 360, p));
    const c = cam(x, y, scrZoom(lerp(1720, 1500, p)));
    morningRoom(ctx, c, t, {});
    dev(ctx, { rim: P.cream }, -70, 1360, 22, { armA: 2.2, armB: 0, rim: P.cream, col: '#262267' });
    return { k: 0.14, vig: 0.32 };
  }
  // reaction: Claude beaming beside the duck, waiting for praise
  const lt = t - C.summary - SUM_READ;
  const p = seg(t, C.summary + SUM_READ, C.slip, ease.inOut);
  const c = cam(lerp(31, 32, p), -5, lerp(70, 78, p));
  morningRoom(ctx, c, t, {
    mid: (ctx2, L) => {
      const pop = ease.outBack(clamp((lt - 0.05) / 0.22));
      const bounce = lt > 0.3 ? Math.abs(Math.sin((lt - 0.3) * 7)) : 0;
      claude(ctx2, { x: 29, y: -lerp(-3, 0, pop) - bounce * 0.5, s: 4.2, sh: [P.coralDk, -12, 3], rim: [P.cream, 8, -5], eyes: 'happy', armL: 1.45, armR: 1.45 + bounce * 0.1, sy: 1 + bounce * 0.04 });
      if (lt > 0.3) { sparkle(ctx2, 35.5, -7, 0.8 + bounce * 0.4, P.cream, tc * 3); sparkle(ctx2, 22.5, -5.5, 0.6, P.gold, -tc * 3); }
    },
  });
  return { k: 0.14, vig: 0.32 };
}

// ---------- S17 the mug slips (slow motion) ----------
function sSlip(ctx, t) {
  const tc = onN(t, 2);
  const lt = t - C.slip;
  bg(ctx, ML.wall);
  glow(ctx, 1500, 200, 900, P.cream, 0.5);
  const fall = clamp((lt - 0.35) / 0.65);
  // hand opening
  const open = ease.out(clamp((lt - 0.15) / 0.3));
  ctx.save();
  ctx.translate(820, 300);
  const hand = new Path2D();
  hand.ellipse(0, 0, 150, 120, 0, 0, TAU);
  [0, 1, 2, 3].forEach(i => { const f = new Path2D(); f.roundRect(110, -90 + i * 52, 150 - open * 20, 44, 22); hand.addPath(f, new DOMMatrix().rotate(open * (8 + i * 6), 110, -70 + i * 52)); });
  const arm = rrP(-700, -110, 700, 220, 60);
  const shape = new Path2D(); shape.addPath(hand); shape.addPath(arm);
  solid(ctx, shape, '#262267', { rim: [P.cream, 6, -6] }, true);
  fill(ctx, rrP(-760, -135, 260, 270, 40), P.navy);
  ctx.restore();
  // the mug, tumbling slowly
  const my = lerp(330, 1500, ease.in2(fall));
  heldMug(ctx, 1060 + fall * 80, my, 30, -0.2 + fall * 1.6, tc);
  // coffee arcs leaving the mug
  if (fall > 0.15) {
    ctx.save(); ctx.globalAlpha = 0.95;
    for (let i = 0; i < 6; i++) fill(ctx, circP(1060 + fall * 80 + Math.sin(i) * 60 - 40, my - 260 - i * 34 * fall, 18 - i * 2), '#3a1f14');
    ctx.restore();
  }
  // tiny motion lines (slow-mo)
  if (fall > 0) { ctx.save(); ctx.strokeStyle = rgba(P.ink, 0.25); ctx.lineWidth = 5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(940 + i * 70, my - 380); ctx.lineTo(940 + i * 70, my - 520); ctx.stroke(); } ctx.restore(); }
  return { k: 0.12, vig: 0.3 };
}

// ---------- S18 shatter ----------
function sShatter(ctx, t) {
  const lt = onN(t - C.shatter, 2);
  bg(ctx, mix(ML.wall, P.ink, 0.1));
  // floor
  fill(ctx, rectP(0, 700, 1920, 380), '#3a3f8f');
  for (let i = 0; i < 9; i++) fill(ctx, rectP(i * 230 - 40, 700, 6, 380), rgba(P.ink, 0.3));
  // coffee splash: flat crown shapes
  const sp = ease.outExpo(clamp(lt / 0.25));
  const crown = [];
  for (let i = 0; i <= 16; i++) {
    const a = Math.PI + i / 16 * Math.PI;
    const r = (i % 2 ? 260 : 420) * sp;
    crown.push([960 + Math.cos(a) * r * 1.3, 760 + Math.sin(a) * r * 0.9]);
  }
  crown.push([960 + 560 * sp, 790], [960 - 560 * sp, 790]);
  fill(ctx, ellP(960, 790, 640 * sp, 70 * sp), '#3a1f14');
  if (lt < 0.45) fill(ctx, polyP(crown), '#5a3020');
  // droplets
  const r2 = rng(5);
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + r2() * Math.PI, v = 900 + r2() * 900;
    const x = 960 + Math.cos(a) * v * lt, y = 760 + Math.sin(a) * v * lt + 2200 * lt * lt;
    if (y < 800) fill(ctx, circP(x, y, 14 + r2() * 14), '#5a3020');
  }
  // ceramic shards
  shards(ctx, 960, 740, lt, { n: 14, speed: 1400, size: 60, col: P.cream, col2: P.red, grav: 2600, life: 0.6, seed: 12, dir: -Math.PI / 2, spread: 1.3 });
  return { k: 0.2, vig: 0.3, flash: lt < 1 / 24 ? 0.6 : 0, flashCol: [1, 1, 1] };
}

// ---------- S19 reaction (silence) ----------
function sReact(ctx, t) {
  const tc = onN(t, 2);
  const p = seg(t, C.react, C.nextNight, ease.inOut);
  const c = cam(lerp(32, 33, p), -4.6, lerp(88, 100, p));
  const realize = tc >= C.react + 0.6, shrink = tc >= C.react + 1.35;
  const armsDown = seg(tc, C.react + 0.6, C.react + 1.8, ease.inOut);
  const squeak = t >= C.squeak && t < C.squeak + 0.25 ? Math.sin((t - C.squeak) / 0.25 * Math.PI) : 0;
  const glance = tc >= C.squeak + 0.15 && tc < C.squeak + 0.6;
  room(ctx, c, ML, {
    t, lampOn: 0.6, beam: false, screenGlow: 0.15, clockH: 7, clockM: 14, hideMug: true,
    screen: summaryScreen(t, C.summary - 100), duck: { look: -1, squeak, blink: tc > C.react + 1.9 && tc < C.react + 2.0 ? 1 : 0 },
    deskMid: (ctx2, L) => {
      claude(ctx2, {
        x: 29, y: 0, s: 4.2, sh: [P.coralDk, -12, 3], rim: [P.cream, 8, -5],
        eyes: !realize ? 'happy' : shrink ? 'tiny' : 'wide', lx: glance ? 1 : 0,
        armL: lerp(1.45, -0.35, armsDown), armR: lerp(1.45, -0.35, armsDown),
        sy: 1 - armsDown * 0.04, sx: 1 + armsDown * 0.02,
      });
      if (tc > C.react + 1.5) {
        const sp = clamp((tc - C.react - 1.5) / 1.2);
        sweat(ctx2, 31.5, -5.2 + sp * 1.4, 0.75, 1 - clamp((sp - 0.85) / 0.15));
      }
    },
  });
  return { k: 0.12, vig: 0.32 };
}

// ---------- EPILOGUE ----------
const CL = LIGHTS.calm;
function sNextNight(ctx, t) {
  bg(ctx, P.ink);
  const a = clamp((t - C.nextNight) / 0.2) * (1 - clamp((t - C.sandbox + 0.25) / 0.15));
  ctx.save(); ctx.globalAlpha = a;
  text(ctx, 'THE NEXT NIGHT…', 960, 560, P.lemon, 70, { align: 'center', fam: 'display', weight: 800, italic: true, track: 6 });
  ctx.restore();
  return { vig: 0 };
}
const CASTLES = [{ x: -30, label: '~/' }, { x: -21, label: 'main' }, { x: -12, label: 'prod' }];
function castle(ctx, L, x, y, label, gone) {
  const g = clamp(gone);
  if (g >= 1) { fill(ctx, ellP(x, y, 3.6, 0.9), tone(L, '#e9c06a')); return; }
  ctx.save(); ctx.translate(x, y); ctx.scale(1 + g * 0.3, 1 - g);
  const col = tone(L, '#f0cf7c');
  const p = polyP([[-3, 0], [-3, -4], [-2.2, -4], [-2.2, -5], [-1.4, -5], [-1.4, -4], [-0.4, -4], [-0.4, -6.4], [0.6, -7.6], [1.6, -6.4], [1.6, -4], [2.4, -4], [2.4, -5], [3.2, -5], [3.2, 0]]);
  solid(ctx, p, col, { sh: [tone(L, '#c79a4a'), 0.6, 0], rim: [L.rim, -0.3, -0.2] });
  fill(ctx, rrP(-0.2, -2.6, 1.2, 2.6, 0.5), tone(L, '#a87a34'));
  ctx.restore();
  // flag label
  ctx.save(); ctx.translate(x + 1.1, y - 7.6 * (1 - g));
  fill(ctx, rectP(0, -3, 0.18, 3), tone(L, P.ink3));
  fill(ctx, rectP(0.18, -3, 3.4, 1.4), tone(L, P.cream));
  text(ctx, label, 0.4, -1.95, tone(L, P.ink), 0.9, { fam: 'mono', weight: 800 });
  ctx.restore();
}
function sSandbox(ctx, t) {
  const tc = onN(t, 2);
  const p = seg(t, C.sandbox - 0.15, C.card, ease.inOut);
  const c = cam(lerp(-22, -20, p), lerp(-10, -9, p), lerp(30, 34, p));
  const hits = [C.sandbox + 1.0, C.sandbox + 2.0, C.sandbox + 3.0];
  room(ctx, c, CL, {
    t, lampOn: 1, beamA: 0.16, screenGlow: 0.5, clockH: 11, clockM: 58, steam: 0.6,
    screen: (s, w, h) => {
      T.bg(s, w, h);
      T.welcome(s, 50, 36, 980);
      T.line(s, 60, 300, [['$ ', P.termDim], ['docker run --rm -it --network none dev-sandbox \\', P.cream]]);
      T.line(s, 60, 346, [['    claude --dangerously-skip-permissions', P.cream]]);
      T.spinner(s, 60, 430, t, 'Playing safely');
      T.inputBox(s, 40, 700, 1520, '', t);
      T.statusLine(s, 50, 826, 'sandbox', 0.2);
    },
    duck: { look: -1 },
    deskMid: (ctx2, L) => {
      sandbox(ctx2, L, -21, 0, 30, 'back');
      CASTLES.forEach((cs, i) => castle(ctx2, L, cs.x, -5.2, cs.label, (tc - hits[i]) / 0.15));
      // Claude in the sandbox swinging a toy wrecking ball on a stick
      let k = hits.findIndex(h => tc < h + 0.3); if (k < 0) k = 2;
      const cx = lerp(-36, CASTLES[k].x - 6, 1);
      const swing = Math.sin(clamp((tc - (hits[k] - 0.35)) / 0.35) * Math.PI * 0.5);
      const r = claude(ctx2, { x: cx, y: -5.2, s: 4.2, sh: [P.coralDk, -12, 3], rim: [P.lemon, 6, -7], eyes: 'happy', armR: lerp(1.8, -0.3, swing), armL: 0.6, shear: swing * 0.15 });
      const [hx, hy] = r.handR;
      const ang = lerp(-2.2, 0.1, swing);
      const bx = hx + Math.cos(ang) * 5, by = hy + Math.sin(ang) * 5;
      ctx2.strokeStyle = tone(L, P.ink3); ctx2.lineWidth = 0.3; ctx2.beginPath(); ctx2.moveTo(hx, hy); ctx2.lineTo(bx, by); ctx2.stroke();
      fill(ctx2, circP(bx, by, 1.2), tone(L, P.red));
      hits.forEach((h, i) => puffs(ctx2, CASTLES[i].x, -6, onN(t - h, 2), { n: 6, size: 1.4, speed: 18, life: 0.6, seed: 200 + i, col: '#f5d98a', shCol: '#c99c50', grav: 10 }));
      sandbox(ctx2, L, -21, 0, 30, 'front');
      // sticky note on the sandbox
      ctx2.save(); ctx2.translate(-12, -3.6); ctx2.rotate(-0.06);
      fill(ctx2, rectP(0, 0, 8, 2.4), tone(L, P.lemon));
      text(ctx2, 'SANDBOX ONLY ✓', 0.4, 1.65, tone(L, P.ink), 0.9, { fam: 'cond', weight: 800 });
      ctx2.restore();
    },
  });
  return { k: 0.16, vig: 0.38 };
}
function sCard(ctx, t) {
  const tc = onN(t, 2);
  const lt = t - C.card;
  bg(ctx, P.navyDeep);
  glow(ctx, 960, 520, 900, P.blue, 0.35);
  const a1 = ease.outBack(clamp(lt / 0.3)), a2 = ease.outBack(clamp((lt - 0.35) / 0.3)), a3 = clamp((lt - 0.8) / 0.4);
  ctx.save(); ctx.translate(960, 330); ctx.scale(a1, a1);
  text(ctx, 'BYPASS PERMISSIONS?', 8, 8, P.ink, 110, { align: 'center', fam: 'display', weight: 800, italic: true });
  text(ctx, 'BYPASS PERMISSIONS?', 0, 0, P.cream, 110, { align: 'center', fam: 'display', weight: 800, italic: true });
  ctx.restore();
  ctx.save(); ctx.translate(960, 500); ctx.scale(a2, a2); ctx.rotate(-0.02);
  fill(ctx, rectP(-640 + 14, -110 + 14, 1280, 160), P.ink);
  fill(ctx, rectP(-640, -110, 1280, 160), P.red);
  text(ctx, 'KEEP IT IN A SANDBOX.', 0, 14, P.lemon, 124, { align: 'center', fam: 'display', weight: 800, italic: true });
  ctx.restore();
  ctx.save(); ctx.globalAlpha = a3;
  text(ctx, 'Use --dangerously-skip-permissions only in an isolated container or VM', 960, 680, P.cream, 34, { align: 'center', fam: 'mono', weight: 600 });
  text(ctx, 'with no internet access — and back up what matters.', 960, 728, P.cream, 34, { align: 'center', fam: 'mono', weight: 600 });
  ctx.restore();
  // little Claude in a little sandbox, blinking; the duck squeaks
  const cb = clamp((lt - 1.0) / 0.3);
  if (cb > 0) {
    ctx.save(); ctx.globalAlpha = cb;
    sandbox(ctx, CL, 0, 0, 0, 'back');
    ctx.restore();
    ctx.save();
    ctx.translate(960, 955);
    ctx.scale(13, 13);
    ctx.globalAlpha = cb;
    sandbox(ctx, LIGHTS.calm, 0, 0, 16, 'back');
    const blink = (tc > C.card + 2.6 && tc < C.card + 2.7) || (tc > C.end - 0.75 && tc < C.end - 0.65) ? 1 : 0;
    claude(ctx, { x: -2, y: -4.4, s: 4.2, sh: [P.coralDk, -12, 3], rim: [P.lemon, 6, -7], eyes: 'happy', blink, armL: 0.5, armR: tc > C.card + 2.2 ? 0.4 + Math.abs(Math.sin(tc * 8)) * 1.0 : 0.5 });
    duck(ctx, CL, 5, -4.4, 4.6, { look: -1, squeak: t > C.end - 0.8 && t < C.end - 0.55 ? Math.sin((t - C.end + 0.8) / 0.25 * Math.PI) : 0 });
    sandbox(ctx, LIGHTS.calm, 0, 0, 16, 'front');
    ctx.restore();
  }
  const fade = clamp((t - (C.end - 0.35)) / 0.35);
  if (fade > 0) { ctx.save(); ctx.globalAlpha = fade; bg(ctx, P.ink); ctx.restore(); }
  return { k: 0, vig: 0.4 };
}

export const act3 = [
  { name: 'sunrise', start: C.sunrise, end: C.doorOpen, draw: sSunrise },
  { name: 'door', start: C.doorOpen, end: C.summary, draw: sDoor },
  { name: 'summary', start: C.summary, end: C.slip, draw: sSummary },
  { name: 'slip', start: C.slip, end: C.shatter, draw: sSlip },
  { name: 'shatter', start: C.shatter, end: C.react, draw: sShatter },
  { name: 'react', start: C.react, end: C.nextNight, draw: sReact },
  { name: 'nextNight', start: C.nextNight, end: C.sandbox, draw: sNextNight },
  { name: 'sandbox', start: C.sandbox, end: C.card, draw: sSandbox },
  { name: 'card', start: C.card, end: C.end, draw: sCard },
];
