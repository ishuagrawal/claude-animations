// Shared shot helpers: per-frame defaults and continuity (what is broken, what is running), jump arcs,
// the HUD state, and the composite step.
import * as THREE from 'three';
import { W, H, clamp, seg, ease, lerp, onN, hash } from '../core.js';
import { C } from '../timeline.js';
import { render3D } from '../film.js';
import { house, lightRig, setSpots, silhouette } from '../world/world.js';
import { animateStill, ST } from '../world/still.js';
import { pose as poseClaude } from '../chars/claude.js';
import { pose as poseKimi } from '../chars/kimi.js';
import { poseMini } from '../chars/gpts.js';
import { animShards, animPuffs, setBeam, setClash, setRing, setOrb } from '../world/fx3d.js';

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export const HOME = { claude: V3(-1.6, 0, 0.6), kimi: V3(1.6, 0, 0.6) };
export const RECV_C = V3(ST.recv.x, 0.45, ST.z), BOIL_C = ST.boil.clone();

// parabolic jump from p0 to p1 between t0 and t1 with apex height h above the higher end
export function arc(t, t0, t1, p0, p1, h) {
  const u = clamp((t - t0) / (t1 - t0));
  const p = p0.clone().lerp(p1, u);
  const top = Math.max(p0.y, p1.y) + h;
  // y(u) through p0.y, top, p1.y: quadratic with peak ≈ top
  const a = p0.y, b = p1.y;
  p.y = (1 - u) * (1 - u) * a + 2 * u * (1 - u) * (2 * top - (a + b) / 2) + u * u * b;
  return { p, u };
}

// squash/stretch impulse after a landing at tl: returns scale along y
export function landSq(t, tl, amt = 0.32, dur = 0.42) {
  const k = (t - tl) / dur;
  if (k < 0 || k > 1) return 1;
  return 1 - amt * Math.exp(-4 * k) * Math.cos(k * 9);
}

// everything a frame starts from; shots override what they need
export function base(w, t) {
  silhouette(false);
  w.renderer.setClearColor(0x000000, 0);
  // continuity: the boiling flask breaks when Claude bursts out, the K3.1 flask when Kimi does
  const S = w.still;
  S.flask.visible = t < C.claudePop;
  S.recvGlass.visible = S.recvLabel.visible = t < C.kimiPop + BEAT2;
  S.liquid.visible = t < C.kimiPop + BEAT2;
  S.tag.visible = S.string.visible = true;
  S.tagHome = S.tagHome || { p: S.tag.position.clone(), r: S.tag.rotation.clone() };
  S.tag.position.copy(S.tagHome.p); S.tag.rotation.copy(S.tagHome.r);
  S.recv.scale.set(1, 1, 1);
  if (t >= C.claudePop) { S.tag.position.set(ST.boil.x + 0.35, 0.02, ST.z + 0.9); S.tag.rotation.set(-Math.PI / 2, 0, 0.4); S.string.visible = false; }
  animateStill(S, t, { flow: t < C.claudePop ? 1 : 0.25, heat: t < C.claudePop ? 1 : 0.35, recvFill: 0.3 });
  animShards(w.fx.shardsK, t, C.kimiPop + BEAT2, RECV_C, { scale: 0.8 });
  animShards(w.fx.shardsC, t, C.claudePop, BOIL_C, { scale: 0.9 });
  animPuffs(w.fx.puffs, t, []);
  setBeam(w.fx.beamC, null); setBeam(w.fx.beamK, null); setBeam(w.fx.beamG, null);
  setClash(w.fx.clash, null); setRing(w.fx.ring, null, 0); setOrb(w.fx.orb, null);
  w.fx.tagC.visible = w.fx.tagK.visible = false;
  w.claude.root.visible = w.kimi.root.visible = true;
  w.kimi.halo.visible = true; w.kimi.halo.material.opacity = 0.55;
  w.astra.root.visible = w.sol.root.visible = false;
  w.bench.group.visible = true;
  w.bench.lens.material.uniforms.uAmt.value = 0;
  w.stage.moonGroup && (w.stage.moonGroup.visible = true);
  if (w.space) w.space.group.visible = false;
  // GPTs sit on their bench unless a shot moves them
  seatGPTs(w, t, {});
}
export const BEAT2 = 60 / 144;

export function seatGPTs(w, t, { bob = 0, wide = false, blink = 0, eyesWhite = false } = {}) {
  const b = w.bench.group;
  b.updateMatrixWorld(true);
  const pa = b.localToWorld(V3(-0.38, 0.46, 0.02)), ps = b.localToWorld(V3(0.38, 0.46, 0.02));
  const ry = b.rotation.y + Math.PI + 0.25;
  poseMini(w.astra, { x: pa.x, y: pa.y, z: pa.z, ry, bob: Math.abs(Math.sin(t * 9)) * bob, tilt: Math.sin(t * 13) * bob * 0.6, wide, blink });
  poseMini(w.sol, { x: ps.x, y: ps.y, z: ps.z, ry, bob: Math.abs(Math.sin(t * 9 + 1)) * bob, wide, blink });
  [w.astra, w.sol].forEach(c => c.eyes.forEach(e => e.material.color.set(eyesWhite ? '#f6efd9' : '#0b0a12')));
}

// showtime lights: the two corner spots + backlights; per-beat color swaps like the reference
export function showSpots(w, t, { claude = 1, kimi = 1, back = 1, cx = HOME.claude.x, kx = HOME.kimi.x, cz = 0.6, kz = 0.6, swap = true } = {}) {
  const b = Math.floor((t - C.drop) / BEAT2);
  const alt = swap && b % 2 === 1;
  setSpots(w.stage, [
    { from: [-4.6, 8.2, 3.2], to: [cx, cz], r: 1.15, col: '#ff3b5c', amt: claude },
    { from: [4.6, 8.2, 3.2], to: [kx, kz], r: 1.15, col: '#2f9bff', amt: kimi },
    { from: [-2.4, 8.2, -4.5], to: [-4.2, -1.5], r: 1.3, col: alt ? '#38d6ff' : '#f2c46a', amt: 0.75 * back },
    { from: [2.4, 8.2, -4.5], to: [4.2, -1.8], r: 1.3, col: alt ? '#f2c46a' : '#38d6ff', amt: 0.7 * back },
    { from: [-6.5, 8.2, -1], to: [-2.8, -3.6], r: 1.0, col: '#ff3b5c', amt: 0.5 * back },
    { from: [6.5, 8.2, -1], to: [3.2, -3.6], r: 1.0, col: '#2f9bff', amt: 0.5 * back },
  ], t);
}

// draw the 3D view into the frame
export const draw3D = (ctx, w) => render3D(ctx, w);

// a decaying camera shake offset in world units (stepped on 2s like the reference's hits)
export function shakeV(t, t0, amp, dur = 0.5) {
  if (t < t0 || t > t0 + dur) return V3(0, 0, 0);
  const k = Math.pow(1 - (t - t0) / dur, 2) * amp;
  const ts = Math.floor(onN(t, 2) * 24);
  return V3((hash(ts * 3) - 0.5) * k, (hash(ts * 7 + 1) - 0.5) * k, 0);
}

export { lightRig, house, silhouette, poseClaude, poseKimi, poseMini, animPuffs, setBeam, setClash, setRing, animateStill, ST };
