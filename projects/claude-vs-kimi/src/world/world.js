// Builds the whole world once: arena, the still, the cast, FX pools. Shots toggle and pose these objects.
import * as THREE from 'three';
import { makeView } from '../gl/view.js';
import { RIG } from '../gl/toon.js';
import { makeStage, setSpots, animateStage } from './stage.js';
import { makeStill } from './still.js';
import { makeClaude, setSil as silClaude } from '../chars/claude.js';
import { makeKimi } from '../chars/kimi.js';
import { makeAstra, makeSol, makeBench } from '../chars/gpts.js';

export const GPT_RY = Math.atan2(5.0, -6.4);   // the bench faces the stage
import { makeShards, makePuffs, makeBeam, makeClash, makeRing, makeTag, makeOrb } from './fx3d.js';
import { makeSpace } from './space.js';

export function makeWorld(ss) {
  const V = makeView(ss);
  const stage = makeStage(V.scene);
  const still = makeStill(V.scene, { glow: stage.GLOW });
  const claude = makeClaude();
  const kimi = makeKimi(stage.GLOW);
  const astra = makeAstra(), sol = makeSol();
  const bench = makeBench(V.scene);
  bench.group.position.set(-5.0, -0.5, 6.4); bench.group.rotation.y = GPT_RY - Math.PI;
  V.scene.add(claude.root, kimi.root, astra.root, sol.root);
  const fx = {
    shardsK: makeShards(V.scene, 36, 3),
    shardsC: makeShards(V.scene, 44, 8),
    puffs: makePuffs(V.scene, 40),
    beamC: makeBeam(V.scene, '#ff9a4a', stage.GLOW),
    beamK: makeBeam(V.scene, '#4aa8ff', stage.GLOW),
    beamG: makeBeam(V.scene, '#ffe08a', stage.GLOW),
    clash: makeClash(V.scene, stage.GLOW, stage.STAR),
    ring: makeRing(V.scene),
    tagC: makeTag(V.scene, '$$$$', '#b8452e'),
    tagK: makeTag(V.scene, '$$$', '#1d4fb8'),
    orb: makeOrb(V.scene, stage.GLOW, stage.STAR),
  };
  const space = makeSpace(V.scene, stage);
  return { ...V, stage, still, claude, kimi, astra, sol, bench, fx, space };
}

// light rig presets (key from the camera side, colored rims from the two corners)
export function lightRig({ key = [-0.35, 0.75, 0.55], keyCol = '#ffffff', rimA = '#ff4d5e', rimB = '#38b6ff', rimADir = [-1, 0.3, -0.35], rimBDir = [1, 0.3, -0.35], amb = '#151642', fog = '#0c0a2b', fogNear = 14, fogFar = 60, rimW = 1 } = {}) {
  RIG.uKeyDir.value.set(...key).normalize();
  RIG.uKeyCol.value.set(keyCol);
  RIG.uRimACol.value.set(rimA); RIG.uRimADir.value.set(...rimADir).normalize();
  RIG.uRimBCol.value.set(rimB); RIG.uRimBDir.value.set(...rimBDir).normalize();
  RIG.uAmb.value.set(amb);
  RIG.uFogCol.value.set(fog); RIG.uFogNear.value = fogNear; RIG.uFogFar.value = fogFar;
  RIG.uRimW.value = rimW;
}

// house lights: 0 = dark hall (cold open), 1 = showtime
export function house(w, amt, t, { beatPulse = 0 } = {}) {
  const S = w.stage;
  animateStage(S, t, { barAmt: 0.08 + 0.92 * amt, beatPulse });
  S.lanternMat.uniforms.uEmisAmt.value = 0.05 + 0.25 * amt;
  S.lanternMat.uniforms.uKeyCol.value.setScalar(0.35 + 0.65 * amt);
  S.lanterns.forEach(g => (g.children.find(c => c.isSprite).material.opacity = 0.12 + 0.5 * amt));
  S.floor.material.uniforms.uBright.value = 0.35 + 0.65 * amt;
  S.neon.material.uniforms.uAmt.value = 0.15 + 1.05 * amt;
  S.moon.material.uniforms.uKeyCol.value.setScalar(0.35 + 0.65 * amt);
  S.twinkles.forEach(sp => (sp.material.opacity *= 0.3 + 0.7 * amt));
}

// show only the listed objects (poster passes render characters alone over a 2D background)
export function solo(w, list) {
  const keep = new Set(list);
  w.scene.children.forEach(o => { o.userData._vis = o.visible; o.visible = keep.has(o) && o.visible; });
  return () => w.scene.children.forEach(o => { o.visible = o.userData._vis; });
}

export function silhouette(on, color = '#000000') {
  RIG.uSil.value = on ? 1 : 0;
  RIG.uSilCol.value.set(color);
}
export { setSpots, silClaude };
