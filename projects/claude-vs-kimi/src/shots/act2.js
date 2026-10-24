// The fight: Claude charges and whiffs, Kimi ricochets in for a PERFECT, Claude's special, Kimi copies it
// move for move, and the beams clash dead even until everything blows up (taking the GPTs with it).
import * as THREE from 'three';
import { W, H, clamp, seg, ease, lerp, onN, key } from '../core.js';
import { C } from '../timeline.js';
import { aim, toScreen } from '../gl/view.js';
import { solo, silhouette } from '../world/world.js';
import { anchors } from '../chars/claude.js';
import { setOrb } from '../world/fx3d.js';
import { hud, callout, burst, riso, impactField, speedLines, chunky, COL, F } from '../overlay.js';
import { star2D } from './act1.js';
import {
  V3, HOME, BEAT2, base, arc, landSq, showSpots, draw3D, shakeV, seatGPTs,
  lightRig, house, poseClaude, poseKimi, poseMini, animPuffs, setBeam, setClash, setRing,
} from './common.js';

const fightRig = (o = {}) => lightRig({ key: [-0.4, 0.8, 0.5], rimA: '#ff4d5e', rimB: '#38b6ff', ...o });

// health over the fight (one source of truth for every shot's HUD)
export function health(t) {
  const c = key(t, [[C.impact, 1], [C.impact + 0.35, 0.72, ease.out], [C.clash + 0.3, 0.72], [C.boom, 0.06, ease.inOut], [C.boom + 0.15, 0]]);
  const k = key(t, [[C.clash + 0.3, 1], [C.boom, 0.06, ease.inOut], [C.boom + 0.15, 0]]);
  const gc = key(t, [[C.impact, 1], [C.impact + 0.7, 1], [C.impact + 1.1, 0.72, ease.inOut]]);
  return { claude: c, kimi: k, ghostC: t < C.impact + 1.1 ? gc : null };
}
export const drawHud = (ctx, t, a = 1) => hud(ctx, { a, ...health(t) });

export const act2 = [
  // s10 — Claude charges; the punch whiffs as Kimi bounces over it
  {
    name: 's10-charge', start: C.charge, end: C.headbutt,
    draw(ctx, t, w) {
      base(w, t); fightRig(); house(w, 1, t);
      const run = seg(t, C.charge, C.punch - 0.05, ease.inOut);
      const cx = lerp(HOME.claude.x, 0.4, run) + (t > C.punch ? seg(t, C.punch, C.punch + 0.35, ease.out) * 0.35 : 0);
      const punchK = clamp((t - C.punch) / 0.07) * (1 - clamp((t - C.punch - 0.3) / 0.2));
      const whiff = t > C.punch + 0.12;
      poseClaude(w.claude, {
        x: cx, z: HOME.claude.z, ry: 0.65, walk: t * 30, stride: run < 1 ? 0.55 : 0.1,
        pitch: run < 1 ? 0.12 : (whiff ? 0.22 : 0.05), lift: run < 1 ? Math.abs(Math.sin(t * 15)) * 0.06 : 0,
        armL: -0.4 * (1 - punchK), reachR: punchK * 0.42, armR: punchK * 0.1,
        eyes: { slant: whiff ? 0 : 0.9, open: whiff ? 1.3 : 1 },
      });
      // Kimi: anticipation squash, leap over, land behind
      const tJump = C.punch - 0.1, tLand = C.punch + 0.5;
      let kp, ksq = 1, kspin = 0;
      if (t < tJump) { kp = HOME.kimi.clone(); ksq = 1 - 0.28 * seg(t, tJump - 0.25, tJump, ease.out); }
      else { const a = arc(t, tJump, tLand, HOME.kimi, V3(-1.0, 0, 0.6), 1.7); kp = a.p; ksq = t < tLand ? 1 + 0.25 * Math.sin(a.u * Math.PI) : landSq(t, tLand, 0.35); kspin = a.u * Math.PI * 2; }
      poseKimi(w.kimi, { x: kp.x, y: kp.y, z: kp.z, ry: -0.75, sq: ksq, spin: kspin, slant: 0.6, look: [-0.35, 0.05] });
      showSpots(w, t, { cx, kx: kp.x });
      animPuffs(w.fx.puffs, t, [
        { c: V3(HOME.claude.x, 0.05, 0.6), t0: C.charge, n: 6, life: 0.5, size: 0.3, spread: 1, rise: 0.2, seed: 21 },
        { c: V3(-1.0, 0.05, 0.6), t0: tLand, n: 7, life: 0.55, size: 0.3, spread: 1.3, rise: 0.25, seed: 23 },
      ]);
      const sh = shakeV(t, C.punch, 0.05, 0.25);
      aim(w.camera, [0.15 + cx * 0.2 + sh.x, 0.45 + sh.y, 5.3], [cx * 0.25, 0.95, 0.4], 44, 0.04);
      draw3D(ctx, w);
      // whoosh streaks on the whiff
      if (t > C.punch && t < C.punch + 0.25) {
        const [sx, sy] = toScreen(w.camera, V3(cx + 0.8, 0.62, 0.6));
        ctx.save(); ctx.globalAlpha = 1 - (t - C.punch) / 0.25; ctx.strokeStyle = COL.cream; ctx.lineWidth = 6; ctx.lineCap = 'round';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(sx - 160, sy - 40 + i * 26); ctx.lineTo(sx + 40 - i * 20, sy - 40 + i * 26); ctx.stroke(); }
        ctx.restore();
      }
      drawHud(ctx, t, clamp((t - C.charge) / 0.25));
    },
  },
  // s11 — Kimi ricochets into Claude: impact frame, PERFECT!!
  {
    name: 's11-headbutt', start: C.headbutt, end: C.special,
    draw(ctx, t, w) {
      base(w, t); fightRig(); house(w, 1, t);
      const imp = C.impact, inImpact = t >= imp && t < imp + 3 / 24;
      // Claude: stunned at x=0.75 facing right; after the hit it flies, tumbling, and lands face-down
      let cp = V3(0.75, 0, 0.6), cpitch = 0.08, csq = 1;
      if (t >= imp) {
        const a = arc(t, imp, imp + 0.5, V3(0.75, 0, 0.6), V3(2.9, 0, 0.6), 0.9);
        cp = a.p; cpitch = t < imp + 0.5 ? a.u * Math.PI * 1.5 : Math.PI / 2 - 0.05; csq = t < imp + 0.5 ? 1 : landSq(t, imp + 0.5, 0.3);
      }
      poseClaude(w.claude, { x: cp.x, y: t >= imp + 0.5 ? 0.31 : cp.y, z: cp.z, ry: 0.6, pitch: cpitch, sq: csq, eyes: { open: t >= imp ? 0.15 : 1.25, slant: t >= imp ? 0.4 : 0 } });
      // Kimi: hop on the spot, then shoot right into Claude's back
      const tShot = imp - 0.18;
      let kp = V3(-1.0, 0, 0.6), ksq = 1, axis = null;
      if (t < tShot) { const h = Math.max(0, Math.sin((t - C.headbutt) / (tShot - C.headbutt) * Math.PI)) * 0.55; kp.y = h; ksq = h > 0.02 ? 1.12 : landSq(t, C.headbutt, 0.3); }
      else if (t < imp) { kp.x = lerp(-1.0, 0.1, (t - tShot) / 0.18); ksq = 1.4; axis = [1, 0, 0]; }
      else { const a = arc(t, imp, imp + 0.45, V3(0.1, 0, 0.6), V3(-0.6, 0, 0.6), 0.6); kp = a.p; ksq = t < imp + 0.08 ? 0.7 : (t < imp + 0.45 ? 1 : landSq(t, imp + 0.45, 0.3)); axis = t < imp + 0.08 ? [1, 0, 0] : null; }
      poseKimi(w.kimi, { x: kp.x, y: kp.y, z: kp.z, ry: -0.6, sq: ksq, axis, slant: 0.8, look: [0.3, 0.02] });
      showSpots(w, t, { cx: cp.x, kx: kp.x });
      animPuffs(w.fx.puffs, t, [
        { c: V3(0.45, 0.6, 0.6), t0: imp, n: 10, life: 0.5, size: 0.4, spread: 1.6, rise: 0.6, seed: 31, col: '#fff3c4' },
        { c: V3(2.9, 0.1, 0.6), t0: imp + 0.5, n: 8, life: 0.6, size: 0.4, spread: 1.6, rise: 0.25, seed: 33 },
      ]);
      const sh = shakeV(t, imp, 0.16, 0.5);
      const pan = seg(t, imp + 0.05, imp + 0.6, ease.inOut);
      aim(w.camera, [lerp(-0.2, 1.0, pan) + sh.x, 0.75 + sh.y, 4.1], [lerp(0.15, 1.5, pan), 0.6, 0.6], 40, -0.03);
      if (inImpact) {
        // impact frame: flat red field, speed lines, both fighters in ink silhouette
        const [sx, sy] = toScreen(w.camera, V3(0.45, 0.55, 0.6));
        impactField(ctx, t, { col: '#e22f54', lines: '#0c0a2b', cx: sx, cy: sy });
        const restore = solo(w, [w.claude.root, w.kimi.root]);
        silhouette(true, '#0c0a2b');
        w.kimi.halo.visible = false;
        draw3D(ctx, w);
        silhouette(false); restore();
        star2D(ctx, sx, sy, 520, '#fff3c4', 1);
        return { flash: t < imp + 1 / 24 ? 0.35 : 0, flashCol: [1, 1, 1], ca: 2.5 };
      }
      draw3D(ctx, w);
      callout(ctx, t, imp + 0.08, 1.05, 'PERFECT!!', { x: 560, y: 360, size: 170, font: F.round, italic: false, fill: '#fff6dc', stroke: '#e2622f', shadow: COL.ink, lw: 0.1, rot: -0.08 });
      callout(ctx, t, imp + 0.25, 0.9, 'COUNTER HIT', { x: 600, y: 490, size: 62, fill: COL.cyan, stroke: COL.ink, shadow: COL.ink, lw: 0.08, rot: -0.08, track: 4 });
      drawHud(ctx, t);
    },
  },
  // s12 — Claude's special: EXTENDED THINKING
  {
    name: 's12-special', start: C.special, end: C.copy,
    draw(ctx, t, w) {
      base(w, t);
      const k = t - C.special;
      burst(ctx, t, { c1: '#e2622f', c2: '#f2c46a', c3: '#3a0e1e', seed: 4, cy: H * 0.42 });
      riso(ctx, t, { a: 0.25, c1: '#ffd0a0', c2: '#3a0e1e', seed: 7 });
      lightRig({ key: [-0.3, 0.9, 0.6], rimA: '#fff3c4', rimB: '#fff3c4', rimW: 1.4 });
      const tc = onN(t, 2);
      const up = ease.outBack(clamp(k / 0.3), 2);
      poseClaude(w.claude, { x: 0, y: 0, z: 0, ry: 0.12, lift: 0.12 * up + Math.sin(tc * 8) * 0.02, armLz: 1.05 * up, armRz: 1.05 * up, sq: 1 + 0.06 * up, eyes: { glow: up, glowCol: '#ffe08a', slant: 0.6 } });
      const orbK = ease.out(clamp((k - 0.25) / 0.6)) * (1 + 0.05 * Math.sin(t * 20));
      setOrb(w.fx.orb, V3(0, 1.62, 0.1), t, orbK, '#ff9a4a', '#ffb070');
      const restore = solo(w, [w.claude.root, w.fx.orb.g]);
      const push = seg(t, C.special, C.copy, ease.inOutSine);
      aim(w.camera, [0.15, 0.25, 3.2 - push * 0.4], [0, 0.95, 0], 44, 0.05);
      draw3D(ctx, w);
      restore();
      callout(ctx, t, C.special + 0.3, 1.25, 'EXTENDED THINKING!', { x: W / 2, y: H - 170, size: 128, fill: '#fff3c4', stroke: '#b8452e', shadow: COL.ink, lw: 0.08, rot: -0.05, grad: [[0, '#ffffff'], [0.6, '#ffe6a8'], [1, '#f2c46a']], track: 2 });
      return { flash: clamp(1 - k / 0.08) * 0.6, flashCol: [1, 0.9, 0.7], ca: 1.2, vig: 0.25 };
    },
  },
  // s13 — Kimi strikes the same pose: MOVE COPIED (*allegedly)
  {
    name: 's13-copy', start: C.copy, end: C.clash,
    draw(ctx, t, w) {
      base(w, t);
      const k = t - C.copy;
      burst(ctx, t, { c1: '#1d4fb8', c2: '#38d6ff', c3: '#071645', seed: 6, cy: H * 0.42 });
      riso(ctx, t, { a: 0.25, c1: '#bfe3ff', c2: '#071645', seed: 9 });
      lightRig({ key: [0.3, 0.9, 0.6], rimA: '#ffffff', rimB: '#ffffff', rimW: 1.4 });
      const up = ease.outBack(clamp(k / 0.3), 2);
      // the eyes flicker to Claude's squares, glowing
      const sq = k > 0.18 ? (Math.floor(k * 16) % 5 === 0 && k < 0.6 ? 0 : 1) : 0;
      poseKimi(w.kimi, { x: 0, y: 0.12 * up, z: 0, ry: -0.1, sq: 1 + 0.08 * up, square: sq, eyeGlow: sq * up, eyeGlowCol: '#cfeaff', look: [0, 0.1] });
      const orbK = ease.out(clamp((k - 0.25) / 0.6)) * (1 + 0.05 * Math.sin(t * 20));
      setOrb(w.fx.orb, V3(0, 1.45, 0.1), t, orbK, '#4aa8ff', '#9fd8ff');
      const restore = solo(w, [w.kimi.root, w.fx.orb.g]);
      w.kimi.halo.visible = false;
      const push = seg(t, C.copy, C.clash, ease.inOutSine);
      aim(w.camera, [-0.15, 0.25, 3.0 - push * 0.4], [0, 0.8, 0], 44, -0.05);
      draw3D(ctx, w);
      restore();
      callout(ctx, t, C.copy + 0.3, 1.25, 'MOVE COPIED!', { x: W / 2, y: H - 170, size: 150, fill: '#e8f8ff', stroke: '#1d4fb8', shadow: COL.ink, lw: 0.08, rot: -0.05, grad: [[0, '#ffffff'], [0.6, '#bfeaff'], [1, '#38d6ff']], track: 2 });
      callout(ctx, t, C.copy + 0.75, 0.8, '*allegedly', { x: W / 2 + 470, y: H - 62, size: 54, italic: true, weight: 700, fill: COL.cream, stroke: COL.ink, shadow: COL.ink, lw: 0.06, rot: -0.05, track: 1 });
      return { flash: clamp(1 - k / 0.08) * 0.6, flashCol: [0.75, 0.9, 1], ca: 1.2, vig: 0.25 };
    },
  },
  // s14 — beam clash: dead even; the GPTs try to help and get blown away; BOOM
  {
    name: 's14-clash', start: C.clash, end: C.draw,
    draw(ctx, t, w) {
      base(w, t); fightRig({ key: [0, 0.8, 0.6] }); house(w, 1, t, { beatPulse: 0.3 * Math.max(0, Math.sin((t - C.clash) * 15)) });
      const k = t - C.clash, boomed = t >= C.boom, kb = t - C.boom;
      const cx = -2.1, kx = 2.1;
      // blown back after the boom
      const cxx = boomed ? cx - ease.out(clamp(kb / 0.35)) * 1.1 : cx, kxx = boomed ? kx + ease.out(clamp(kb / 0.35)) * 1.1 : kx;
      const strain = Math.sin(onN(t, 2) * 60) * 0.015;
      poseClaude(w.claude, { x: cxx, z: 0.6, ry: 0.6, lean: boomed ? 0.5 : 0.08 + strain, pitch: -0.08, armL: 0.6, armR: 0.6, reachL: 0.12, reachR: 0.12, eyes: { slant: 0.9, glow: boomed ? 0 : 1, glowCol: '#ffe08a' }, sq: boomed ? 1 : 0.97 });
      poseKimi(w.kimi, { x: kxx, z: 0.6, ry: -0.6, sq: boomed ? 1 : 0.85 + strain, axis: [1, 0, 0], slant: 0.85, square: boomed ? 0 : 1, eyeGlow: boomed ? 0 : 1, eyeGlowCol: '#cfeaff', look: [-0.25, 0.04] });
      // clash point: tug of war, dead even
      const px = key(t, [[C.clash, 0], [C.clash + 0.5, 0.55], [C.clash + 1.0, -0.5], [C.clash + 1.4, 0.25], [C.boom - 0.2, -0.05], [C.boom, 0]]);
      const P = V3(px + Math.sin(t * 37) * 0.03, 0.78, 0.6);
      const reach = ease.out(clamp(k / 0.15));
      if (!boomed) {
        const ca = anchors(w.claude).face;
        const kf = V3(kxx - 0.34, 0.47, 0.85);
        setBeam(w.fx.beamC, ca, ca.clone().lerp(P, reach), 0.16 + 0.03 * Math.sin(t * 40), t);
        setBeam(w.fx.beamK, kf, kf.clone().lerp(P, reach), 0.16 + 0.03 * Math.sin(t * 43 + 1), t);
        setClash(w.fx.clash, P, t, reach, 0.8 + k * 0.25);
      } else {
        setClash(w.fx.clash, P, t, clamp(1 - kb / 0.3), 3.5);
        setRing(w.fx.ring, P, clamp(kb / 0.45), '#fff3c4');
        animPuffs(w.fx.puffs, t, [{ c: V3(P.x, 0.4, 0.6), t0: C.boom, n: 16, life: 0.9, size: 1.1, spread: 2.6, rise: 0.9, seed: 41, col: '#ffe6c8' }]);
      }
      // the GPTs hop in from the left with a feeble beam of their own — and get blown away
      const g0 = C.blowAway;
      if (t >= g0) {
        w.astra.root.visible = w.sol.root.visible = true;
        const inn = ease.outBack(clamp((t - g0) / 0.25), 1.6);
        const fly = boomed ? kb : 0;
        const ax = lerp(-3.4, -1.75, inn) - fly * 9, sx = lerp(-2.9, -1.15, inn) - fly * 7;
        const ay = 0 + fly * 6 - fly * fly * 3, sy = 0 + fly * 8 - fly * fly * 3;
        poseMini(w.astra, { x: ax, y: ay, z: 3.0, ry: 0.5, scale: 1.2, spin: fly * 14, bob: Math.abs(Math.sin(t * 14)) * 0.05 * (1 - Math.min(1, fly * 9)), wide: boomed });
        poseMini(w.sol, { x: sx, y: sy, z: 3.1, ry: 0.4, scale: 1.2, spin: -fly * 16, wide: boomed });
        if (!boomed && t > g0 + 0.25) {
          const from = V3(sx + 0.3, 0.42, 3.1);
          setBeam(w.fx.beamG, from, from.clone().lerp(V3(P.x, 0.6, 1.4), ease.out(clamp((t - g0 - 0.25) / 0.3)) * 0.35), 0.02, t, 0.8);
        }
      }
      showSpots(w, t, { cx: cxx, kx: kxx, claude: boomed ? 0.4 : 1, kimi: boomed ? 0.4 : 1 });
      const sh = shakeV(t, C.clash, 0.05, 3).add(shakeV(t, C.boom, 0.35, 0.6));
      const push = seg(t, C.clash, C.boom, ease.inOut);
      aim(w.camera, [sh.x, 1.0 + sh.y, 6.2 - push * 0.9], [0, 0.82, 0.6], 46, 0);
      draw3D(ctx, w);
      if (!boomed) drawHud(ctx, t);
      if (t > C.clash + 0.25 && t < C.boom - 0.05) callout(ctx, t, C.clash + 0.25, C.boom - C.clash - 0.6, 'DEAD EVEN!', { x: W / 2, y: 230, size: 110, fill: COL.cream, stroke: COL.ink, shadow: COL.ink, lw: 0.08, rot: -0.04, track: 3, grad: [[0, '#ffffff'], [1, '#ffe6a8']] });
      return { flash: boomed ? clamp(1 - kb / 0.3) : 0, flashCol: [1, 0.98, 0.92], ca: boomed ? 2 : 1 };
    },
  },
];
