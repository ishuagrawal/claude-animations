// Cold open (the still) and the arrivals: Kimi is distilled out of Claude, Claude bursts free, the GPTs
// get no spotlight, VS card.
import { W, H, clamp, seg, ease, lerp, onN, key } from '../core.js';
import { C, bt } from '../timeline.js';
import { aim, toScreen } from '../gl/view.js';
import { ST } from '../world/still.js';
import { setSpots, GPT_RY } from '../world/world.js';
import { nameplate, chunky, callout, COL, F, riso, hanzi } from '../overlay.js';
import { vsCard } from './vs.js';
import {
  V3, HOME, RECV_C, BOIL_C, BEAT2, base, arc, landSq, seatGPTs, showSpots, draw3D, shakeV,
  lightRig, house, poseClaude, poseKimi, animPuffs, animateStill,
} from './common.js';

export const NAME = { kimi: 'KIMI', kimiSub: 'K3.1 PRO', claude: 'CLAUDE', claudeSub: 'OPUS 5.5' };

// dark-hall rig: the flame below, Claude's orange essence glowing, cool rims
const darkRig = () => lightRig({ key: [0.25, -0.35, 0.9], keyCol: '#b9c2ff', rimA: '#ff8a4c', rimB: '#4aa8ff', rimADir: [-1, 0.4, -0.2], rimBDir: [1, -0.2, -0.3], fog: '#07061a', fogNear: 8, fogFar: 40 });
const showRig = (o = {}) => lightRig({ key: [-0.45, 0.8, 0.45], rimA: '#ff4d5e', rimB: '#38b6ff', ...o });

// Claude inside the boiling flask (cold open)
function claudeInFlask(w, t, { tremble = 1 } = {}) {
  const tr = Math.sin(onN(t, 2) * 70) * 0.012 * tremble;
  poseClaude(w.claude, {
    x: ST.boil.x + tr, y: ST.boil.y - ST.boilR + 0.07, z: ST.z + 0.08, scale: 0.7, ry: 0.12,
    pitch: 0.1, armL: 1.25, armR: 1.25, armLz: 0.2, armRz: 0.2,
    eyes: { open: 1.15 + 0.1 * Math.sin(t * 6), slant: -0.7 },
  });
}

export const act1 = [
  // s01 — ECU: Claude trapped in the boiling flask, its cubes peeling off
  {
    name: 's01-flask', start: C.open, end: C.neck,
    draw(ctx, t, w) {
      base(w, t); darkRig(); house(w, 0, t); setSpots(w.stage, [], t);
      w.kimi.root.visible = false;
      claudeInFlask(w, t);
      const k = seg(t, C.open, C.neck, ease.inOutSine);
      aim(w.camera, [ST.boil.x + 0.95 - k * 0.2, 1.62 + k * 0.08, ST.z + 3.5 - k * 0.6], [ST.boil.x + 0.12, 1.5, ST.z], 36, 0.04);
      draw3D(ctx, w);
      return { flash: clamp(1 - t / 0.25) , flashCol: [0, 0, 0] };
    },
  },
  // s02 — tilt up the swan neck: orange cubes in, blue cubes out
  {
    name: 's02-neck', start: C.neck, end: C.spout,
    draw(ctx, t, w) {
      base(w, t); darkRig(); house(w, 0.05, t); setSpots(w.stage, [], t);
      w.kimi.root.visible = false;
      claudeInFlask(w, t);
      const k = seg(t, C.neck, C.spout, ease.inOut);
      const from = V3(-1.25, 3.0, 0.9), to = V3(1.15, 2.55, -0.3);
      const tf = V3(-1.35, 3.55, ST.z), tt = V3(1.1, 2.75, ST.z);
      const p = from.lerp(to, k), q = tf.lerp(tt, k);
      aim(w.camera, [p.x, p.y, p.z], [q.x, q.y, q.z], 40, -0.05 + k * 0.08);
      draw3D(ctx, w);
    },
  },
  // s03 — ECU spout: a blue drop swells (dead air)
  {
    name: 's03-spout', start: C.spout, end: C.fall,
    draw(ctx, t, w) {
      base(w, t); darkRig(); house(w, 0.05, t); setSpots(w.stage, [], t);
      w.kimi.root.visible = false; w.claude.root.visible = false;
      const k = seg(t, C.spout, C.fall, ease.out);
      animateStill(w.still, t, { flow: 0.6, heat: 1, dropT: { phase: 'swell', k } });
      aim(w.camera, [ST.spout.x + 0.42, ST.spout.y + 0.02, ST.z + 1.65 - k * 0.2], [ST.spout.x, ST.spout.y - 0.08, ST.z], 24);
      draw3D(ctx, w);
      // glint on the drop
      const g = clamp(1 - Math.abs(t - (C.fall - 0.35)) / 0.18);
      if (g > 0) {
        const [sx, sy] = toScreen(w.camera, w.still.drop.position.clone().add(V3(-0.02, 0.03, 0.05)));
        star2D(ctx, sx, sy, 140 * g, '#ffffff', g);
      }
    },
  },
  // s04 — the drop falls into the K3.1 flask
  {
    name: 's04-fall', start: C.fall, end: C.drop,
    draw(ctx, t, w) {
      base(w, t); darkRig(); house(w, 0.05, t); setSpots(w.stage, [], t);
      w.kimi.root.visible = false; w.claude.root.visible = false;
      const k = seg(t, C.fall, C.drop, ease.in2);
      animateStill(w.still, t, { flow: 0.6, heat: 1, dropT: { phase: 'fall', k } });
      aim(w.camera, [ST.recv.x + 0.9, 0.55, ST.z + 2.3], [ST.recv.x, 0.85, ST.z], 40, 0.05);
      draw3D(ctx, w);
    },
  },
  // s05 — the drop hits: lights slam on, the flask bursts, Kimi bounces out (with Claude's square eyes)
  {
    name: 's05-kimi-pop', start: C.kimiPop, end: C.kimiCU,
    draw(ctx, t, w) {
      base(w, t); showRig({ key: [0.2, 0.75, 0.6] }); house(w, 1, t, { beatPulse: Math.max(0, 1 - (t - C.drop) * 3) });
      showSpots(w, t, { claude: 0, kimi: clamp((t - C.drop) * 8), kx: 1.6, kz: 0.6 });
      w.claude.root.visible = false;
      const tPop = C.kimiPop + BEAT2, tLand = C.kimiPop + BEAT2 * 3;
      w.still.recvGlow.material.opacity = clamp(1 - (t - C.drop) / 0.5) * 0.9 + (t < tPop ? 0.5 : 0);
      if (t < tPop) {
        // the flask glows and bulges
        const b = seg(t, C.drop, tPop, ease.in);
        w.still.recv.scale.set(1 + b * 0.12, 1 + b * 0.18, 1 + b * 0.12);
        w.kimi.root.visible = false;
      } else {
        w.still.recv.scale.set(1, 1, 1);
        const { p, u } = arc(t, tPop, tLand, V3(ST.recv.x, 0.3, ST.z), HOME.kimi, 2.0);
        const s = lerp(0.35, 1, ease.out(u));
        const sq = t < tLand ? 1 + 0.25 * Math.sin(u * Math.PI) : landSq(t, tLand, 0.38);
        poseKimi(w.kimi, { x: p.x, y: p.y, z: p.z, scale: s, sq, spin: -u * Math.PI * 2, square: 1, look: [0.1, 0.05], ry: -0.4 });
        animPuffs(w.fx.puffs, t, [
          { c: V3(ST.recv.x, 0.4, ST.z), t0: tPop, n: 8, life: 0.7, size: 0.45, spread: 1.2, rise: 1, col: '#cfe8ff', seed: 2 },
          { c: V3(HOME.kimi.x, 0.1, HOME.kimi.z), t0: tLand, n: 8, life: 0.55, size: 0.32, spread: 1.4, rise: 0.25, col: '#dfe6ff', seed: 5 },
        ]);
      }
      const sh = shakeV(t, tLand, 0.08, 0.35);
      aim(w.camera, [3.4 + sh.x, 0.5 + sh.y, 6.0], [1.0, 1.05, -1.2], 44, -0.04);
      draw3D(ctx, w);
      return { flash: clamp(1 - (t - C.drop) / 0.12) * 0.9, flashCol: [0.85, 0.95, 1] };
    },
  },
  // s06 — close-up: Claude's square eyes blink into Kimi's own pills; nameplate
  {
    name: 's06-kimi-cu', start: C.kimiCU, end: C.claudePop,
    draw(ctx, t, w) {
      base(w, t); showRig({ key: [0.35, 0.7, 0.65] }); house(w, 1, t);
      showSpots(w, t, { claude: 0, kimi: 1 });
      // look left, look right, blink → pills, happy hop
      const lookX = key(t, [[C.kimiCU, 0.0], [C.kimiCU + 0.15, -0.32, ease.outBack], [C.kimiCU + 0.5, -0.32], [C.kimiCU + 0.62, 0.3, ease.outBack], [C.kimiBlink - 0.05, 0.3], [C.kimiBlink + 0.2, 0.0]]);
      const bl = Math.abs(t - (C.kimiBlink + 0.07)) < 0.07 ? 0.08 : 1;
      const sqr = t < C.kimiBlink + 0.07 ? 1 : 0;
      const hop = t > C.kimiBlink + 0.14 ? Math.max(0, Math.sin((t - C.kimiBlink - 0.14) / 0.42 * Math.PI)) * (t < C.kimiBlink + 0.56 ? 0.35 : 0) : 0;
      const sq = landSq(t, C.kimiBlink + 0.56, 0.25) * (t > C.kimiBlink + 0.07 && t < C.kimiBlink + 0.16 ? 0.85 : 1);
      poseKimi(w.kimi, { x: HOME.kimi.x, y: hop, z: HOME.kimi.z, ry: -0.35, square: sqr, open: bl, look: [lookX + 0.05, 0.08], sq });
      const k = seg(t, C.kimiCU, C.claudePop, ease.inOutSine);
      aim(w.camera, [HOME.kimi.x - 0.55 + k * 0.1, 0.62, HOME.kimi.z + 2.9 - k * 0.35], [HOME.kimi.x - 0.15, 0.52, HOME.kimi.z], 32, 0.03);
      draw3D(ctx, w);
      nameplate(ctx, t, C.kimiName, { side: 'right', name: NAME.kimi, sub: NAME.kimiSub, col: COL.blue, colDk: '#16307e', y: 760, hold: C.claudePop - C.kimiName });
    },
  },
  // s07 — Claude bursts out of the boiling flask, lands in the red corner
  {
    name: 's07-claude-pop', start: C.claudePop, end: C.gpt,
    draw(ctx, t, w) {
      base(w, t); showRig({ key: [-0.3, 0.75, 0.6] }); house(w, 1, t);
      showSpots(w, t, { claude: clamp((t - C.claudeLand) * 8), kimi: 0.85 });
      poseKimi(w.kimi, { ...HOME.kimi, x: HOME.kimi.x, z: HOME.kimi.z, ry: -0.6, look: [-0.35, 0.05] });
      const { p, u } = arc(t, C.claudePop, C.claudeLand, V3(ST.boil.x, ST.boil.y - 0.75, ST.z), HOME.claude, 1.5);
      const landed = t >= C.claudeLand;
      const shakeOff = landed ? Math.sin((t - C.claudeLand - 0.3) * 40) * 0.12 * clamp(1 - (t - C.claudeLand - 0.3) / 0.35) * (t > C.claudeLand + 0.3 ? 1 : 0) : 0;
      poseClaude(w.claude, {
        x: p.x, y: p.y, z: p.z, scale: lerp(0.7, 1, ease.out(u)),
        ry: landed ? lerp(-0.2, 0.3, seg(t, C.claudeName - 0.25, C.claudeName, ease.outBack)) : -u * Math.PI * 2,
        sq: landed ? landSq(t, C.claudeLand, 0.4) : 1 + 0.2 * Math.sin(u * Math.PI),
        lean: shakeOff, armL: landed ? 0.15 : 1.4, armR: landed ? 0.15 : 1.4, armLz: landed ? 0 : 0.5, armRz: landed ? 0 : 0.5,
        eyes: { slant: t > C.claudeName - 0.2 ? 0.85 : 0, open: t > C.claudeLand && t < C.claudeLand + 0.2 ? 0.2 : 1 },
      });
      animPuffs(w.fx.puffs, t, [
        { c: BOIL_C.clone(), t0: C.claudePop, n: 9, life: 0.8, size: 0.55, spread: 1.4, rise: 1.0, col: '#f4f1ff', seed: 9 },
        { c: V3(HOME.claude.x, 0.1, HOME.claude.z), t0: C.claudeLand, n: 9, life: 0.6, size: 0.36, spread: 1.5, rise: 0.25, col: '#e6e8ff', seed: 11 },
        { c: V3(HOME.claude.x, 1.0, HOME.claude.z), t0: C.claudeLand + 0.25, n: 6, life: 0.9, size: 0.3, spread: 0.35, rise: 1.4, col: '#ffffff', seed: 14, alpha: 0.45, stagger: 0.5 },
      ]);
      const sh = shakeV(t, C.claudeLand, 0.1, 0.4);
      const k = seg(t, C.claudePop, C.gpt, ease.inOutSine);
      aim(w.camera, [-2.6 + k * 0.3 + sh.x, 0.8 + sh.y, 5.0 - k * 0.7], [-1.35, 1.05 - k * 0.3, -1.0 + k * 0.9], 42, 0.05);
      draw3D(ctx, w);
      nameplate(ctx, t, C.claudeName, { side: 'left', name: NAME.claude, sub: NAME.claudeSub, col: COL.claude, colDk: COL.claudeDk, y: 760, hold: C.gpt - C.claudeName });
      return { flash: clamp(1 - (t - C.claudePop) / 0.1) * 0.7, flashCol: [1, 0.85, 0.7] };
    },
  },
  // s08 — ringside: GPT-6 Astra and GPT-6.1 Sol get a spotlight… that dies
  {
    name: 's08-gpts', start: C.gpt, end: C.vs,
    draw(ctx, t, w) {
      base(w, t); house(w, 0.6, t);
      const on = t < C.gptDim + 0.32;
      const flick = t > C.gptDim && t < C.gptDim + 0.32 ? (Math.floor(t * 30) % 2) : 1;
      const lamp = on ? flick * clamp((t - C.gpt) * 10) : 0;
      lightRig({ key: [0.5, 0.6, 0.6], keyCol: lamp > 0.5 ? '#fff1c9' : '#3a3f78', rimA: '#ff4d5e', rimB: '#38b6ff' });
      const lp = w.bench.head.getWorldPosition(V3(0, 0, 0)), bp = w.bench.group.position;
      setSpots(w.stage, [
        { from: [-1.5, 8.2, 2.5], to: [-1.6, 0.6], r: 1.15, col: '#ff3b5c', amt: 0.9 },
        { from: [1.5, 8.2, 2.5], to: [1.6, 0.6], r: 1.15, col: '#2f9bff', amt: 0.9 },
        { from: [lp.x, lp.y, lp.z], to: [bp.x, bp.z], r: 0.75, col: '#fff1c9', amt: lamp * 0.8, flare: 0.6 },
      ], t);
      w.astra.root.visible = w.sol.root.visible = true;
      const dark = !on;
      seatGPTs(w, t, { bob: lamp > 0.5 ? 0.06 : 0, wide: lamp > 0.5, eyesWhite: dark, blink: dark && Math.abs(t - (C.gptDim + 0.85)) < 0.05 ? 1 : 0 });
      w.bench.lens.material.uniforms.uAmt.value = lamp * 1.6;
      w.claude.root.visible = w.kimi.root.visible = true;
      poseClaude(w.claude, { ...HOME.claude, x: HOME.claude.x, z: HOME.claude.z, ry: 0.55, eyes: { slant: 0.85 } });
      poseKimi(w.kimi, { x: HOME.kimi.x, z: HOME.kimi.z, ry: -0.6, look: [-0.35, 0.05], slant: 0.6 });
      const fwd = V3(Math.sin(GPT_RY), 0, Math.cos(GPT_RY));
      const bc = w.bench.group.position;
      const ck = seg(t, C.gpt, C.vs, ease.inOutSine);
      aim(w.camera, [bc.x + fwd.x * (2.3 - ck * 0.3) + 0.25, 0.32, bc.z + fwd.z * (2.3 - ck * 0.3)], [bc.x, -0.02, bc.z], 30, -0.03);
      draw3D(ctx, w);
      if (lamp > 0.5) {
        const [sx, sy] = toScreen(w.camera, w.bench.lens.getWorldPosition(V3(0, 0, 0)));
        star2D(ctx, sx, sy, 260, '#fff3c4', 0.9);
      }
      // the bulb pops
      const pk = clamp(1 - Math.abs(t - (C.gptDim + 0.33)) / 0.08);
      if (pk > 0) { const [sx, sy] = toScreen(w.camera, w.bench.lens.getWorldPosition(V3(0, 0, 0))); star2D(ctx, sx, sy, 420 * pk, '#ffffff', pk); }
      // their nameplate tries to slide in, then falls away
      gptPlate(ctx, t);
    },
  },
  // s09 — VS card, then FIGHT!
  {
    name: 's09-vs', start: C.vs, end: C.charge,
    draw(ctx, t, w) { return vsCard(ctx, t, w); },
  },
];

function gptPlate(ctx, t) {
  const k = t - (C.gpt + 0.15);
  if (k < 0) return;
  const fall = t > C.gptDim + 0.33 ? t - (C.gptDim + 0.33) : 0;
  const x = 1160 - (1 - ease.outExpo(clamp(k / 0.3))) * 900;
  const y = 830 + 0.5 * 3200 * fall * fall;
  const rot = -0.04 + fall * 2.2;
  ctx.save();
  ctx.translate(x, y); ctx.rotate(rot);
  ctx.fillStyle = COL.ink; ctx.fillRect(-12, -6, 640, 118);
  ctx.fillStyle = '#d9dbe8'; ctx.fillRect(-20, -14, 640, 118);
  ctx.restore();
  chunky(ctx, 'GPT-6 ASTRA', x + 20 * Math.cos(rot), y + 26, { size: 46, align: 'left', fill: COL.ink, stroke: '#d9dbe8', shadow: '#d9dbe8', lw: 0.01, rot, italic: true, track: 2 });
  chunky(ctx, '& GPT-6.1 SOL', x + 20, y + 76, { size: 40, align: 'left', fill: '#5a5e8a', stroke: '#d9dbe8', shadow: '#d9dbe8', lw: 0.01, rot, italic: true, track: 2 });
}

// 2D star flare (glints, bulbs)
export function star2D(ctx, x, y, s, col, a = 1) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, y, 0, x, y, s * 0.35);
  g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, s * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = col;
  for (let i = 0; i < 4; i++) {
    const a0 = i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a0) * s, y + Math.sin(a0) * s);
    ctx.lineTo(x + Math.cos(a0 + Math.PI / 2) * s * 0.035, y + Math.sin(a0 + Math.PI / 2) * s * 0.035);
    ctx.lineTo(x - Math.cos(a0) * s * 0.05, y - Math.sin(a0) * s * 0.05);
    ctx.lineTo(x + Math.cos(a0 - Math.PI / 2) * s * 0.035, y + Math.sin(a0 - Math.PI / 2) * s * 0.035);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
