// The awakening: arcs gather between contact and blade and become the Spark. It opens its eyes, finds its hands,
// sees the way out along the blade, and dives in.
import * as THREE from 'three';
import { buildOutlet, BLADE_Y, GAP } from '../world/outlet.js';
import { Spark, strike } from '../chars/spark.js';
import { setLook } from '../gl/paint.js';
import { setCam, V3 } from '../gl/geo.js';
import { C } from '../timeline.js';
import { clamp, lerp, seg, ease, smooth, key, hash2, TAU, pulse, FPS } from '../core.js';

export default function () {
  const O = buildOutlet(), cam = O.cam;
  const spark = new Spark(); O.scene.add(spark.group);
  const SIZE = 0.56, STAND = BLADE_Y + 1.6 * SIZE;
  const gap = V3(...GAP), _a = V3(), _b = V3(), pts = [];
  const tOut = C.born + 0.5, tStand = C.born + 0.95;                 // plops out of the gap, settles on the blade
  const tLand = C.hop + 0.62, tCrouch = C.dive - 0.3, tIn = C.dive + 0.34;

  // body position (pure function of t)
  function posAt(t) {
    const stand = V3(2.55, STAND, 0.1);
    if (t < tOut) return gap.clone();
    if (t < tStand) { const k = seg(t, tOut, tStand, ease.out2); return gap.clone().lerp(stand, k).add(V3(0, Math.sin(k * Math.PI) * 0.55, 0)); }
    if (t < C.hop) return stand.add(V3(0, Math.sin(t * 2.6) * 0.03, 0));
    if (t < tLand) { const k = (t - C.hop) / (tLand - C.hop); return stand.add(V3(0.25 * k, 4 * 1.05 * k * (1 - k), 0)); }
    if (t < C.dive) return stand.add(V3(0.25 - 0.18 * seg(t, tCrouch, C.dive, ease.out), -0.16 * seg(t, tCrouch, C.dive, ease.out), 0));
    if (t < tIn) { const k = (t - C.dive) / (tIn - C.dive); return V3(lerp(2.62, 4.6, k), STAND - 0.16 + 4 * 0.85 * k * (1 - k) - (STAND - 0.16 - BLADE_Y) * k * k, 0.1); }
    return V3(4.6 + (t - tIn) * 26, BLADE_Y, 0.05);
  }
  const velAt = t => posAt(t + 0.02).sub(posAt(t - 0.02)).multiplyScalar(1 / 0.04);

  function common(t) {
    setLook({ tint: [0.035, 0.03, 0.09], rim: [1.0, 0.62, 0.3], rimAmt: 0.42, brk: 0.7, poster: 0.75 });
    const fseed = Math.floor(t * FPS / 2 + 1e-6);
    // crackles: two short bursts, then a continuous build to the birth
    const burst = Math.max(pulse(t, C.arc1, 0.02, 0.1), pulse(t, C.arc2, 0.02, 0.2), smooth(C.born - 0.75, C.born, t) * (t < C.born + 0.25 ? 1 : 0));
    const live = burst > 0.05;
    O.arcs.forEach((a, i) => {
      const on = live && hash2(fseed, i * 7) < 0.35 + burst * 0.6 ? 1 : 0;
      _a.set(GAP[0] + (hash2(fseed, i) - 0.5) * 0.9, 0.38 + hash2(fseed, i + 9) * 0.12, (hash2(fseed, i + 3) - 0.5) * 1.3);
      _b.set(_a.x + (hash2(fseed, i + 5) - 0.5) * 0.5, BLADE_Y, _a.z + (hash2(fseed, i + 6) - 0.5) * 0.4);
      strike(_a, _b, 6, 0.09, fseed * 3 + i, pts);
      a.update(pts, cam, 0.085, on * (0.5 + burst));
    });
    const fl = live ? burst * (0.55 + 0.45 * hash2(fseed, 77)) : 0;
    O.flash.intensity = fl * 5.5;
    // the blade answers: a pulse of light runs along it toward the slot (at notice), and the wake of the dive
    let n = 0;
    for (let i = 0; i < 7; i++) {
      const k = clamp((t - (C.notice - 0.1) - i * 0.045) / 0.8);
      if (k > 0 && k < 1) O.pulse.set(n++, lerp(2.4, 8.6, ease.inOut2(k)), BLADE_Y + 0.05, 0, 1.5 - i * 0.12, 0.45, 0.9, 1.0, Math.sin(k * Math.PI) * 0.9, i / 7);
    }
    for (let i = 0; i < 6; i++) {
      const k = clamp((t - tIn - i * 0.012) / 0.2);
      if (k > 0 && k < 1) O.pulse.set(n++, lerp(4.6, 9.2, k), BLADE_Y + 0.05, 0, 2.2 - i * 0.2, 0.5, 0.92, 1.0, (1 - k) * 1.6, i / 6);
    }
    O.pulse.commit(n);
    // splash where it dives into the metal
    let m = 0; const st = t - tIn;
    if (st > 0 && st < 0.8) for (let i = 0; i < 60; i++) {
      const h0 = hash2(i, 1), h1 = hash2(i, 2), h2 = hash2(i, 3), a = h0 * TAU, sp = 2 + h1 * 5;
      O.splash.set(m++, 4.6 + Math.cos(a) * sp * st * 0.6 + st * 1.5, BLADE_Y + (2.5 + h2 * 5) * st - 9 * st * st, 0.1 + Math.sin(a) * sp * st * 0.6, 0.3 * (1 - st / 0.8) + 0.05, 0.6, 0.93, 1.0, 1 - st / 0.8, h0);
    }
    O.splash.commit(m);
    // the spark
    const form = seg(t, C.born - 0.1, C.born + 0.55, ease.outBack), limbs = seg(t, tOut + 0.25, tStand + 0.25, ease.out);
    const eyesIn = seg(t, C.eyesOpen - 0.25, C.eyesOpen + 0.05);
    let open = seg(t, C.eyesOpen, C.eyesOpen + 0.4, ease.out2);
    open *= 1 - Math.max(pulse(t, C.eyesOpen + 0.62, 0.05, 0.055), pulse(t, C.eyesOpen + 0.9, 0.05, 0.055), pulse(t, C.notice - 0.9, 0.05, 0.06), pulse(t, C.hop + 0.95, 0.05, 0.06)) * 0.94;
    const LA = C.lookAround;
    const look = key(t, [[LA, [0, 0]], [LA + 0.35, [-0.85, 0.05], ease.inOut], [LA + 0.8, [-0.85, 0.05]], [LA + 1.15, [0.8, 0.15], ease.inOut], [LA + 1.6, [0.8, 0.15]], [LA + 1.95, [0.1, 0.85], ease.inOut],
      [LA + 2.3, [0.1, 0.85]], [LA + 2.65, [0.5, -0.35], ease.inOut], [C.notice - 0.15, [0.5, -0.35]], [C.notice + 0.25, [0.35, -0.8], ease.inOut], [C.notice + 0.6, [0.95, -0.1], ease.inOut], [C.hop + 0.1, [0.95, -0.05]],
      [C.hop + 0.5, [0.2, 0.3], ease.inOut], [tCrouch, [0.9, 0.0], ease.inOut], [C.dive + 0.2, [0.9, -0.6]]]);
    // discovers its hand: raises it, turns it, wiggles
    const handUp = seg(t, LA + 2.5, LA + 2.9, ease.outBack) * (1 - seg(t, C.notice - 0.05, C.notice + 0.3)), wig = Math.sin((t - LA) * 17) * 0.1 * handUp;
    const cheer = Math.max(seg(t, C.hop, C.hop + 0.25, ease.out) * (1 - seg(t, tLand + 0.1, tLand + 0.4)), 0);
    const diveArm = seg(t, C.dive - 0.05, C.dive + 0.2);
    const armR = [lerp(1.28, 0.95, handUp) + wig - 0.3 * diveArm, lerp(-0.5, 0.35, handUp) + cheer * 1.5 + diveArm * 1.0, lerp(0.3, 0.75, handUp) + diveArm * 0.5];
    const armL = [-1.28 + 0.3 * diveArm, -0.5 + cheer * 1.5 + diveArm * 1.0 + Math.sin(t * 2.2) * 0.05, 0.3 + diveArm * 0.5];
    // squash and stretch: plop landing, hop anticipation / landing, dive crouch
    let squash = 1 - 0.28 * pulse(t, tStand - 0.02, 0.05, 0.1) - 0.22 * seg(t, C.hop - 0.22, C.hop - 0.02, ease.out) * (t < C.hop ? 1 : 0)
      - 0.3 * pulse(t, tLand, 0.04, 0.1) - 0.28 * seg(t, tCrouch, C.dive, ease.out) * (t < C.dive ? 1 : 0);
    const wow = seg(t, C.notice + 0.2, C.notice + 0.6) * (1 - seg(t, C.hop + 0.2, C.hop + 0.5));
    const happy = Math.max(handUp * 0.5, cheer, seg(t, tLand, tLand + 0.2) * 0.6 * (1 - diveArm));
    const gone = t > tIn + 0.02;
    const p = posAt(t);
    spark.update(t, cam, { pos: p, vel: t > C.hop - 0.01 ? velAt(t) : undefined, size: gone ? SIZE * 0.6 : SIZE * form, squash, look, open: Math.max(open, 0.06), eyes: gone ? 0 : eyesIn, wide: 1 + 0.22 * wow,
      happy, armL, armR, arms: gone ? 0 : limbs, legs: gone ? 0 : limbs, stride: 0, glow: 1, light: lerp(1.2, 2.6, form), lightDist: 26, lightCol: 0xd8f0ff, orbit: 0.35 * form,
      crackle: lerp(0.9, 0.4, seg(t, C.born, C.eyesOpen)), trailFn: t > C.dive ? age => posAt(t - age) : null, trailLen: 0.22, trailAmt: 1.2 });
    return p;
  }
  const POST = { rNear: 1.8, rFar: 8, lift: [0.014, 0.012, 0.034], vig: 0.55, bloom: 1.0, glowWarm: 0.2, contrast: 1.04, matte: 0.085, matteCol: [0.62, 0.55, 1.0] };

  return [
    { name: 'outlet-dark', start: C.outlet, end: C.born + 0.45, draw(t) {
      const k = seg(t, C.outlet, C.born + 0.45, ease.inOutSine);
      setCam(cam, [lerp(-1.6, -0.6, k), lerp(2.1, 1.5, k), lerp(14.5, 10.2, k)], [lerp(1.4, 1.6, k), 0.3, 0], 32);
      common(t);
      return { scene: O.scene, camera: cam, post: { ...POST, focus: 11, range: 12, flat: 3, fade: 1 - seg(t, C.outlet, C.outlet + 0.9, ease.out), exposure: 1.1 } };
    } },
    { name: 'outlet-wake', start: C.born + 0.45, end: C.notice + 0.3, draw(t) {
      const k = seg(t, C.born + 0.45, C.notice + 0.3, ease.inOutSine);
      setCam(cam, [lerp(4.3, 3.7, k), lerp(1.75, 1.55, k), lerp(5.2, 4.5, k)], [lerp(2.1, 2.5, seg(t, tOut, tStand)), lerp(0.75, 1.0, seg(t, tOut, tStand)) , 0], 30);
      common(t);
      return { scene: O.scene, camera: cam, post: { ...POST, focus: 5, range: 8, flat: 1.5, rNear: 1.5 } };
    } },
    { name: 'outlet-dive', start: C.notice + 0.3, end: C.xray, draw(t) {
      const p = posAt(t);
      const k = seg(t, C.notice + 0.3, C.xray, ease.inOutSine), follow = seg(t, C.dive, C.xray, ease.inOut);
      setCam(cam, [lerp(0.2, 1.2, k), lerp(2.3, 2.0, k), lerp(9.2, 8.2, k)], [lerp(3.6, 4.2, k) + follow * 1.6, 0.9 + Math.max(0, p.y - STAND) * 0.35, 0], 32);
      common(t);
      return { scene: O.scene, camera: cam, post: { ...POST, focus: 9, range: 12, flat: 2.5, flash: seg(t, C.xray - 0.14, C.xray, ease.in2) * 0.85 } };
    } },
  ];
}
