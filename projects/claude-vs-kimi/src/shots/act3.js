// Decision: a DRAW on power, so the tiebreaker is price ($$$$ vs $$$, the Opus 5.5 : K3 ratio). Kimi wins,
// launches to the moon (a moonshot), and Claude gets one last drop on the head.
import * as THREE from 'three';
import { W, H, clamp, seg, ease, lerp, onN, key } from '../core.js';
import { C } from '../timeline.js';
import { aim, toScreen } from '../gl/view.js';
import { setSpots } from '../world/world.js';
import { ST, animateStill } from '../world/still.js';
import { animateSpace } from '../world/space.js';
import { hud, banner, chunky, callout, speedLines, COL, F } from '../overlay.js';
import { star2D, NAME } from './act1.js';
import {
  V3, HOME, base, arc, landSq, showSpots, draw3D, shakeV,
  lightRig, house, poseClaude, poseKimi, poseMini, animPuffs, setBeam,
} from './common.js';

const rig = (o = {}) => lightRig({ key: [-0.35, 0.8, 0.5], rimA: '#ff4d5e', rimB: '#38b6ff', ...o });

// price tags on strings: drop with a springy bounce, then swing
function hangTag(tag, t, t0, x, z, seed) {
  const k = t - t0;
  tag.visible = k > 0;
  if (!tag.visible) return;
  const drop = 1 - Math.exp(-7 * k) * Math.cos(k * 16);
  tag.position.set(x, lerp(6.5, 2.0, Math.min(1.05, drop)), z);
  tag.rotation.set(0, Math.sin(k * 3 + seed) * 0.25 * Math.exp(-0.8 * k), Math.sin(k * 5.5 + seed) * 0.12 * Math.exp(-1.2 * k));
}

export const act3 = [
  // s16 — top-down: both flat on the floor. DRAW.
  {
    name: 's16-draw', start: C.draw, end: C.tiebreak,
    draw(ctx, t, w) {
      base(w, t); rig({ key: [-0.3, 0.9, 0.3] }); house(w, 0.85, t);
      const k = t - C.draw;
      poseClaude(w.claude, { x: -1.8, y: 0.31, z: 0.55, ry: 0.25, pitch: -Math.PI / 2, armLz: 0.5, armRz: 0.3, eyes: { x: true } });
      poseKimi(w.kimi, { x: 1.8, z: 0.75, sq: 0.62 + 0.03 * Math.sin(t * 6), ry: -0.2, x_eyes: true, look: [0, 1.0] });
      showSpots(w, t, { cx: -1.8, kx: 1.8, cz: 0.55, kz: 0.75, swap: false });
      animPuffs(w.fx.puffs, t, [{ c: V3(0, 0.15, 0.7), t0: C.boom, n: 10, life: 2.4, size: 0.8, spread: 3.6, rise: 0.3, seed: 41, col: '#ffe6c8', alpha: 0.45, flatZ: 0.4 }]);
      const rot = k * 0.12;
      aim(w.camera, [0, 6.0 - k * 0.35, 0.65], [0, 0, 0.65], 50, 0, [Math.sin(rot), 0, -Math.cos(rot)]);
      draw3D(ctx, w);
      hud(ctx, { claude: 0, kimi: 0 });
      banner(ctx, t, C.draw + 0.25, C.tiebreak - C.draw - 0.45, 'DRAW', { y: H * 0.8, size: 200, col: COL.gold });
    },
  },
  // s17 — TIEBREAKER: LOWER PRICE WINS → $$$$ vs $$$ → KIMI WINS!
  {
    name: 's17-tiebreak', start: C.tiebreak, end: C.launch,
    draw(ctx, t, w) {
      base(w, t); rig(); house(w, 1, t);
      const up = ease.outBack(clamp((t - C.tiebreak - 0.1) / 0.3), 1.8);
      const won = t >= C.win;
      const hop = won ? Math.abs(Math.sin((t - C.win) / 0.42 * Math.PI)) * 0.45 : 0;
      poseClaude(w.claude, {
        ...HOME.claude, x: HOME.claude.x, z: HOME.claude.z, ry: 0.35,
        pitch: lerp(-Math.PI / 2, 0, up), y: lerp(0.31, 0, up),
        sq: won ? 0.94 : 1,
        eyes: { open: won ? 0.24 : (t > C.tags + 0.4 ? 1.15 : 1), slant: won ? 0 : 0.3 },
      });
      poseKimi(w.kimi, {
        x: HOME.kimi.x, z: HOME.kimi.z, y: hop, ry: -0.35, sq: lerp(0.62, 1, up) * (won ? (hop > 0.02 ? 1.08 : landSq(t, C.win + 0.42 * Math.round((t - C.win) / 0.42), 0.25)) : 1),
        look: t > C.tags + 0.3 && !won ? [0, 0.45] : [-0.1, 0.1], happy: won ? 1 : 0,
      });
      hangTag(w.fx.tagC, t, C.tags, HOME.claude.x, HOME.claude.z, 1);
      hangTag(w.fx.tagK, t, C.tags + 0.12, HOME.kimi.x, HOME.kimi.z, 2.5);
      showSpots(w, t, { claude: won ? 0.55 : 1, kimi: 1, swap: won });
      const push = seg(t, C.tiebreak, C.launch, ease.inOutSine);
      aim(w.camera, [0, 1.25, 6.6 - push * 0.5], [0, 1.25, 0.6], 40, 0);
      draw3D(ctx, w);
      banner(ctx, t, C.tiebreak + 0.1, C.tags - C.tiebreak + 0.35, 'TIEBREAKER', { y: 150, size: 130, col: COL.gold, sub: 'LOWER PRICE WINS', subCol: COL.cream });
      banner(ctx, t, C.win, C.launch - C.win - 0.1, 'KIMI WINS!', { y: 150, size: 150, col: '#9fe6ff', slab: '#071645', stroke: COL.ink });
      // confetti of little blue sparkles around Kimi when it wins
      if (won) {
        const [sx, sy] = toScreen(w.camera, V3(HOME.kimi.x, 1.0, HOME.kimi.z));
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + (t - C.win) * 2, r = 180 + 90 * Math.sin(t * 3 + i);
          star2D(ctx, sx + Math.cos(a) * r, sy + Math.sin(a) * r * 0.7, 70 + 30 * Math.sin(t * 9 + i), i % 2 ? '#9fe6ff' : '#ffffff', 0.9);
        }
      }
    },
  },
  // s18a — the moonshot: Kimi crouches and rockets straight up through the lanterns
  {
    name: 's18-launch', start: C.launch, end: C.moon,
    draw(ctx, t, w) {
      base(w, t); rig({ key: [0, 0.6, 0.8] }); house(w, 1, t);
      const lo = C.liftoff;
      const crouch = seg(t, C.launch, lo, ease.out);
      const fly = Math.max(0, t - lo);
      const ky = fly > 0 ? 0.5 * 30 * fly * fly + 2 * fly : 0;
      poseKimi(w.kimi, { x: HOME.kimi.x, z: HOME.kimi.z, y: ky, ry: -0.2, sq: fly > 0 ? 1.5 : 1 - 0.35 * crouch, look: [0, 0.5], happy: 1 });
      poseClaude(w.claude, { ...HOME.claude, x: HOME.claude.x, z: HOME.claude.z, ry: 0.75, pitch: -0.25 * clamp(fly * 3), eyes: { open: 0.24 } });
      w.fx.tagC.visible = true; w.fx.tagC.position.set(HOME.claude.x, 2.0, HOME.claude.z);
      if (fly > 0) setBeam(w.fx.beamK, V3(HOME.kimi.x, 0.1, HOME.kimi.z), V3(HOME.kimi.x, Math.max(0.2, ky + 0.3), HOME.kimi.z), 0.22, t, clamp(1 - fly * 1.2));
      animPuffs(w.fx.puffs, t, [{ c: V3(HOME.kimi.x, 0.1, HOME.kimi.z), t0: lo, n: 12, life: 0.8, size: 0.6, spread: 1.8, rise: 0.3, seed: 51, col: '#dfe6ff' }]);
      showSpots(w, t, { claude: 0.5, kimi: 1 });
      const sh = shakeV(t, lo, 0.12, 0.5);
      aim(w.camera, [HOME.kimi.x + 1.1 + sh.x, 0.3 + sh.y, HOME.kimi.z + 3.2], [HOME.kimi.x - 0.2, 2.4, HOME.kimi.z], 52, -0.06);
      draw3D(ctx, w);
      if (fly > 0) speedLines(ctx, t, { cx: W * 0.62, cy: -200, col: '#bfe3ff', n: 60, inner: 500, a: 0.7 * clamp(1 - fly * 1.5) });
    },
  },
  // s18b — space: Kimi streaks to the moon and lights up its dark side. Title.
  {
    name: 's18-moon', start: C.moon, end: C.button,
    draw(ctx, t, w) {
      base(w, t);
      lightRig({ key: [0.6, 0.5, 0.6], fog: '#000000', fogNear: 900, fogFar: 1000, rimA: '#4aa8ff', rimB: '#ffffff' });
      const S = w.space;
      S.group.visible = true;
      animateSpace(S, t);
      const O = S.origin;
      const k = t - C.moon;
      const land = 0.85;
      // Kimi arcs in from the lower left toward the moon's dark side
      const u = clamp(k / land);
      const p0 = V3(-5, -4.0, -5).add(O), p1 = V3(-0.4, 1.4, -15.8).add(O);
      const kp = p0.clone().lerp(p1, ease.inOut(u));
      kp.y += Math.sin(u * Math.PI) * 2.0;
      w.claude.root.visible = false;
      poseKimi(w.kimi, { x: kp.x, y: kp.y - 0.45 * lerp(1.4, 0.7, u), z: kp.z, scale: lerp(1.4, 0.7, u), sq: u < 1 ? 1.25 : landSq(t, C.moon + land, 0.3), axis: u < 1 ? [0.6, 0.8, -0.3] : null, happy: 1, ry: 0.4 });
      w.kimi.halo.material.opacity = 0.9;
      if (u < 1) setBeam(w.fx.beamK, p0.clone().lerp(kp, 0.4), kp, 0.12 * (1 - u * 0.6), t, 0.9);
      const lk = k - land;
      S.landFlare.position.copy(p1).sub(O).add(V3(0, 0, 0.6));
      S.landFlare.material.opacity = lk > 0 ? clamp(1 - lk / 0.6) : 0;
      S.landFlare.scale.setScalar(lk > 0 ? 6 + lk * 4 : 0.01);
      S.moonGlow.material.opacity = lk > 0 ? 0.55 * ease.out(clamp(lk / 0.8)) : 0;
      // the GPTs drift past, tumbling (blown all the way out here)
      w.astra.root.visible = w.sol.root.visible = true;
      poseMini(w.astra, { x: O.x + 5.5 - k * 1.6, y: O.y - 2.6 + k * 0.2, z: O.z - 4, ry: 0.3, spin: k * 2.2, scale: 0.9, wide: true });
      poseMini(w.sol, { x: O.x + 6.8 - k * 1.4, y: O.y - 3.4 + k * 0.15, z: O.z - 4.6, ry: -0.2, spin: -k * 2.6, scale: 0.9, wide: true });
      aim(w.camera, [O.x - 0.5, O.y - 0.3, O.z + 0.5 - k * 0.3], [O.x + 1.2, O.y + 0.4, O.z - 20], 40, 0.04);
      draw3D(ctx, w);
      // title
      const tk = t - C.title;
      if (tk > 0) {
        const s = ease.outBack(clamp(tk / 0.3), 2);
        chunky(ctx, NAME.kimi + ' ' + NAME.kimiSub, W * 0.3, H * 0.8, { size: 150, scale: s, fill: '#e8f8ff', stroke: '#1d4fb8', shadow: COL.ink, lw: 0.08, rot: -0.05, track: 3, grad: [[0, '#ffffff'], [0.6, '#bfeaff'], [1, '#38d6ff']] });
        const s2 = clamp((tk - 0.45) / 0.2);
        chunky(ctx, 'NOW LAUNCHED', W * 0.3, H * 0.8 + 125, { size: 64, scale: s2, fill: COL.gold, stroke: COL.ink, shadow: COL.ink, lw: 0.06, rot: -0.05, italic: false, track: 12 });
      }
      return { vig: 0.4, flash: clamp(1 - k / 0.1) * 0.5, flashCol: [0.75, 0.9, 1] };
    },
  },
  // s19 — the button: Claude alone under the still. One more drop. Plink.
  {
    name: 's19-button', start: C.button, end: C.end,
    draw(ctx, t, w) {
      base(w, t); rig({ key: [0.3, 0.8, 0.6], keyCol: '#d8dcff' }); house(w, 0.3, t);
      w.kimi.root.visible = false;
      setSpots(w.stage, [{ from: [ST.recv.x + 1.5, 8.2, ST.z + 4], to: [ST.recv.x, ST.z + 0.1], r: 1.0, col: '#ffb070', amt: 0.8 }], t);
      const swellT = C.plink - 0.75, fallT = C.plink - 0.25;
      let dropT = null;
      if (t >= swellT && t < fallT) dropT = { phase: 'swell', k: seg(t, swellT, fallT, ease.out) };
      else if (t >= fallT && t < C.plink) dropT = { phase: 'fall', k: seg(t, fallT, C.plink, ease.in2) };
      animateStill(w.still, t, { flow: 0.25, heat: 0.35, dropT });
      // the drop lands on Claude's head (re-aim the fall to Claude's top)
      if (dropT && dropT.phase === 'fall') w.still.drop.position.y = lerp(ST.spout.y - 0.12, 0.98, dropT.k * dropT.k);
      const hit = t >= C.plink;
      poseClaude(w.claude, {
        x: ST.recv.x, z: ST.z + 0.05, ry: 0.55, pitch: hit ? 0 : 0.12,
        sq: hit ? landSq(t, C.plink, 0.12, 0.35) : 1,
        eyes: { open: hit ? (t > C.plink + 0.12 ? 0.22 : 0.06) : 1, w: hit ? 1.1 : 1 },
      });
      const pk = t - C.plink;
      if (pk >= 0 && pk < 0.4) {
        // a tiny blue splash crown
        animPuffs(w.fx.puffs, t, [{ c: V3(ST.recv.x, 1.0, ST.z), t0: C.plink, n: 5, life: 0.35, size: 0.12, spread: 0.6, rise: 0.4, seed: 61, col: '#9fd0ff' }]);
      }
      aim(w.camera, [ST.recv.x + 1.5, 1.25, ST.z + 3.6], [ST.recv.x - 0.25, 1.05, ST.z], 34, 0.03);
      draw3D(ctx, w);
      const endFade = clamp((t - (C.end - 0.25)) / 0.25);
      return { vig: 0.45, flash: endFade, flashCol: [0, 0, 0] };
    },
  },
];
