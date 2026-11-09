// Inside the processor. The Spark finds Claude asleep, touches it awake, the user's words drift down, Claude sees
// the poem standing right there, and a flock of tokens lifts toward the light.
import * as THREE from 'three';
import { buildChip, WORDS } from '../world/chip.js';
import { Claude, blinkAt } from '../chars/claude.js';
import { Spark } from '../chars/spark.js';
import { Sprites } from '../gl/fx.js';
import { setLook } from '../gl/paint.js';
import { setCam, V3 } from '../gl/geo.js';
import { C } from '../timeline.js';
import { clamp, lerp, seg, ease, smooth, key, hash2, TAU, pulse } from '../core.js';

export default function () {
  const K = buildChip(), cam = K.cam, DY = K.DAIS_Y;
  const claude = new Claude(); claude.group.position.set(0, DY, 0); claude.group.rotation.y = -0.3; K.scene.add(claude.group);
  const spark = new Spark({ trail: 36 }); K.scene.add(spark.group);
  const flock = new Sprites(460, { shape: 'star', core: 1.0, soft: 1.2 }); K.scene.add(flock.mesh);
  const flockGlow = new Sprites(460, { shape: 'dot', core: 0.2, soft: 1.5 }); K.scene.add(flockGlow.mesh);
  const motes = new Sprites(140, { shape: 'star', core: 1, soft: 0.8 }); K.scene.add(motes.mesh);
  const contact = new Sprites(2, { shape: 'star', core: 1.5, soft: 1 }); K.scene.add(contact.mesh);
  const SIZE = 1.45;
  const H0 = V3(-17, 10, 8), H1 = V3(-11.6, 8.6, 5.2), H2 = V3(-10.4, 8.3, 4.8), H3 = V3(-12.6, 9.2, 5.4);
  const CL = V3(0, DY + 5, 1);                                    // Claude's heart
  const tSwept = C.release + 0.55;

  function sparkPos(t) {
    if (t < C.chip + 2.7) { const k = seg(t, C.chip - 0.2, C.chip + 2.7, ease.out), a = (1 - k) * 2.2; return V3(-9 + Math.sin(a) * 5 * (1 - k), 64, 6).lerp(H0, k).add(V3(Math.cos(a * 2) * 2 * (1 - k), 0, 0)); }
    const bob = V3(0, Math.sin(t * 1.9) * 0.28, 0);
    if (t < tSwept) {
      const p = key(t, [[C.two + 0.2, H0.toArray()], [C.two + 0.95, [-13.6, 9.1, 6.2], ease.inOutSine], [C.two + 1.25, [-14.3, 9.3, 6.5], ease.inOutSine], [C.reach, H1.toArray(), ease.inOutSine], [C.touch - 0.05, H2.toArray(), ease.inOutSine],
        [C.touch + 0.3, [-13.2, 9.6, 5.6], ease.out], [C.wake, H3.toArray(), ease.inOutSine], [C.idea + 0.25, H3.toArray()], [C.idea + 0.5, [-12.6, 10.4, 5.4], ease.out], [C.idea + 0.8, H3.toArray(), ease.in2], [tSwept, H3.toArray()]]);
      return V3(...p).add(bob.multiplyScalar(t < C.touch ? 0.5 : 1));
    }
    const tau = t - tSwept, th = Math.atan2(H3.z, H3.x) - tau * 1.9, r = lerp(H3.length(), 8.5, smooth(0, 2.5, tau));
    return V3(Math.cos(th) * r, H3.y + 2.5 * tau + 5.2 * tau * tau, Math.sin(th) * r);
  }
  const sparkVel = t => sparkPos(t + 0.02).sub(sparkPos(t - 0.02)).multiplyScalar(25);

  function words(t) {
    const S = 3.4, gap = 1.0; let total = -gap; K.wordW.forEach(w => { total += w * S * 0.82 + gap; });
    let x = -2 - total / 2;
    K.wordMeshes.forEach(({ m, u }, i) => {
      const w = K.wordW[i] * S * 0.82, t0 = C.words + 0.15 + i * 0.16, k = seg(t, t0, t0 + 1.75, ease.out);
      const h0 = hash2(i, 61), h1 = hash2(i, 62), h2 = hash2(i, 63), gone = seg(t, C.gather + i * 0.05, C.gather + 0.55 + i * 0.05);
      const to = V3(x + w / 2, 21.5 + Math.sin(t * 1.1 + i) * 0.22, 7);
      const from = V3(to.x + (h0 - 0.5) * 22, to.y + 36 + h1 * 22, to.z + (h2 - 0.5) * 12);
      m.position.lerpVectors(from, to, k); m.position.x += Math.sin((1 - k) * 5 + i) * 3.5 * (1 - k);
      m.position.lerp(CL, gone * gone * 0.6);
      m.rotation.set((1 - k) * (h1 - 0.5) * 1.2, (1 - k) * (h0 - 0.5) * 3.0, (1 - k) * (h2 - 0.5) * 1.6);
      m.scale.setScalar(S * (1 - 0.5 * gone));
      u.uA.value = (t < C.words ? 0 : seg(t, t0, t0 + 0.6)) * (1 - gone);
      u.uCol.value.setRGB(lerp(0.62, 1.0, gone), lerp(0.86, 0.8, gone), lerp(1.0, 0.45, gone));
      m.visible = u.uA.value > 0.001;
      m.userData.x = x + w / 2; x += w + gap;
    });
    // the words dissolve into gold motes that spiral into Claude
    let n = 0;
    if (t > C.gather && t < C.release + 0.2) for (let i = 0; i < 140; i++) {
      const h0 = hash2(i, 71), h1 = hash2(i, 72), h2 = hash2(i, 73), wm = K.wordMeshes[i % 7].m;
      const t0 = C.gather + h0 * 0.45, k = clamp((t - t0) / (C.release - t0 - 0.02)); if (k <= 0 || k >= 1) continue;
      const from = V3(wm.userData.x + (h1 - 0.5) * 3, 21.5 + (h2 - 0.5) * 1.5, 7), e = ease.in2(k);
      const p = from.lerp(CL, e); const sw = Math.sin(k * Math.PI) * (3 + h1 * 4); p.x += Math.cos(k * 7 + h0 * 6) * sw; p.z += Math.sin(k * 7 + h0 * 6) * sw;
      motes.set(n++, p.x, p.y, p.z, 0.5 + h2 * 0.6, 1.0, 0.8, 0.42, smooth(0, 0.15, k) * (1 - smooth(0.85, 1, k)), h0);
    }
    motes.commit(n);
  }
  function tokens(t) {
    let n = 0;
    if (t > C.release - 0.02) for (let i = 0; i < 460; i++) {
      const h0 = hash2(i, 81), h1 = hash2(i, 82), h2 = hash2(i, 83), h3 = hash2(i, 84);
      const tau = t - (C.release + h0 * h0 * 4.3); if (tau <= 0) continue;
      const y = DY + 9 + 9 * tau + 7.5 * tau * tau; if (y > 150) continue;
      const r = (2.5 + (10 + h1 * 13) * (1 - Math.exp(-tau * 1.7))) * (1 - 0.72 * smooth(45, 120, y));
      const th = h1 * TAU + (1.3 + h2 * 1.2) * tau * (i % 5 ? 1 : -1);
      const fx = Math.sin(tau * 5 + h3 * 9) * 0.8, flap = 0.72 + 0.28 * Math.sin(tau * 17 + h3 * 20);
      const a = smooth(0, 0.18, tau) * (1 - smooth(110, 150, y)), warmth = h2;
      const x = Math.cos(th) * r + fx, z = Math.sin(th) * r + 1, s = (0.7 + h3 * 0.9) * flap;
      flock.set(n, x, y + Math.cos(tau * 4 + h2 * 7) * 0.6, z, s * 1.5, 1.0, lerp(0.7, 0.9, warmth), lerp(0.3, 0.72, warmth), a, h0);
      flockGlow.set(n, x, y, z, s * 3.2, 1.0, 0.6, 0.25, a * 0.3, h0); n++;
    }
    flock.commit(n); flockGlow.commit(n);
  }
  function act(t) {
    const warmth = seg(t, C.touch + 0.05, C.touch + 1.9, ease.inOutSine);
    setLook({ tint: [lerp(0.035, 0.05, warmth), lerp(0.06, 0.08, warmth), lerp(0.13, 0.17, warmth)], rim: [lerp(0.5, 1.0, warmth), lerp(0.7, 0.66, warmth), lerp(1.0, 0.4, warmth)], rimAmt: 0.5, brk: 0.65, warm: warmth });
    K.warm.intensity = warmth * 1.5 + pulse(t, C.release, 0.1, 0.7) * 1.2;
    K.ripU.uR.value = Math.max(0, t - C.touch) * 46; K.ripU.uAmt.value = seg(t, C.touch, C.touch + 0.25); K.ripU.uBase.value = 0.3 * (1 - warmth);
    K.shaftM.uniforms.uColor.value.setRGB(lerp(0.56, 1.0, warmth), lerp(0.72, 0.6, warmth), lerp(1.0, 0.28, warmth));
    K.shaftM.uniforms.uGain.value = lerp(0.11, 0.045, warmth) + seg(t, C.ascend, C.white) * 0.12;
    K.oculus.set(0, 0, 128, 0, 60, lerp(0.6, 1.0, warmth), 0.8, lerp(1.0, 0.6, warmth), 0.9 + seg(t, C.ascend, C.white) * 2.5, 0); K.oculus.commit(1);
    K.top.intensity = lerp(0.85, 0.6, warmth);
    claude.skin.emissiveIntensity = 0.6 * pulse(t, C.touch + 0.05, 0.35, 0.7) + 0.5 * pulse(t, C.release - 0.1, 0.12, 0.5) + 0.06 * warmth;
    // ---- Claude
    const awake = seg(t, C.touch + 0.5, C.wake + 0.5, ease.inOutSine), breath = Math.sin(t * 1.5) * 0.008;
    const flutter = t > C.wake - 0.35 && t < C.wake + 0.5 ? clamp(1 - (t - (C.wake - 0.35)) / 0.85 + 0.35 * Math.sin((t - C.wake) * 30) * (1 - seg(t, C.wake, C.wake + 0.5))) : (t < C.wake ? 1 : 0);
    const blink = Math.max(flutter, blinkAt(t, [C.greet + 0.9, C.words + 1.4, C.wordsLand + 0.8, C.idea + 0.7, C.release + 1.4, C.ascend + 2.2]));
    const hop = Math.max(0, Math.sin(clamp((t - C.idea - 0.05) / 0.45) * Math.PI)) * 1.6, crouch = seg(t, C.gather, C.release - 0.08, ease.inOutSine) * (t < C.release ? 1 : 0);
    const spring = pulse(t, C.release, 0.1, 0.35), up = seg(t, C.release, C.release + 0.18, ease.out);
    const lookX = key(t, [[C.wake + 0.5, 0], [C.wake + 0.9, 0.7, ease.inOut], [C.greet - 0.25, 0.7], [C.greet + 0.15, -1, ease.inOut], [C.words + 0.5, -1], [C.words + 1.0, -0.25, ease.inOut], [C.idea - 0.15, -0.25], [C.idea + 0.15, -1, ease.inOut], [C.gather + 0.3, -1], [C.release - 0.2, 0, ease.inOut]]);
    const lookY = key(t, [[C.words + 0.5, 0], [C.words + 1.0, 1, ease.inOut], [C.idea - 0.15, 0.8], [C.idea + 0.15, 0, ease.inOut], [C.release - 0.1, 0], [C.release + 0.2, 1, ease.out]]);
    const waveL = seg(t, C.greet + 0.3, C.greet + 0.6, ease.outBack) * (1 - seg(t, C.words - 0.2, C.words + 0.3)), ending = seg(t, C.ascend + 0.3, C.ascend + 0.9);
    claude.pose({
      squash: lerp(0.93, 1, awake) + breath - 0.14 * crouch + 0.12 * spring + 0.05 * pulse(t, C.wake + 0.45, 0.12, 0.2) - 0.1 * pulse(t, C.idea + 0.5, 0.05, 0.12),
      lean: lerp(0.07, 0, awake) - 0.1 * up * (1 - ending) - 0.1 * ending, tilt: 0.05 * Math.sin(t * 0.9) * awake * (1 - crouch) - 0.07 * waveL,
      bob: hop + spring * 1.8, blink, lookX, lookY, eyeH: 1 - 0.3 * seg(t, C.release + 0.1, C.release + 0.4) * (1 - ending),
      armL: lerp(-0.22, 0, awake) + waveL * (0.75 + 0.2 * Math.sin((t - C.greet) * 13)) - 0.4 * crouch + 1.25 * up * (1 - ending * 0.6),
      armR: lerp(-0.22, 0, awake) - 0.4 * crouch + 1.25 * up * (1 - ending) + ending * (0.9 + 0.25 * Math.sin(t * 10)),
    });
    // ---- the Spark
    const p = sparkPos(t), v = sparkVel(t), sp = v.length();
    const reach = seg(t, C.reach, C.touch - 0.06, ease.inOutSine) * (1 - seg(t, C.touch + 0.05, C.touch + 0.3, ease.out));
    const startle = pulse(t, C.touch + 0.02, 0.06, 0.25), wave = seg(t, C.greet + 0.75, C.greet + 1.0, ease.outBack) * (1 - seg(t, C.words - 0.3, C.words + 0.2));
    const me = seg(t, C.idea + 0.75, C.idea + 1.05, ease.outBack) * (1 - seg(t, C.gather + 0.5, C.release));
    const swept = seg(t, tSwept, tSwept + 0.4);
    const sLook = key(t, [[C.chip + 2.2, [0.2, -0.6]], [C.chip + 3.2, [0.85, -0.25], ease.inOut], [C.touch + 0.1, [0.9, -0.1]], [C.wake - 0.2, [0.9, 0.05]], [C.words + 0.3, [0.9, 0.05]], [C.words + 0.9, [0.45, 0.95], ease.inOut],
      [C.idea, [0.45, 0.85]], [C.idea + 0.35, [0.9, 0], ease.inOut], [C.idea + 0.9, [0.0, 0.0], ease.inOut], [C.gather + 0.4, [0.85, 0.0], ease.inOut], [tSwept, [0.6, 0.5]], [tSwept + 0.5, [0.2, 0.9], ease.inOut]]);
    const sBlink = Math.max(pulse(t, C.chip + 3.6, 0.05, 0.06), pulse(t, C.two + 0.7, 0.05, 0.06), pulse(t, C.touch + 0.75, 0.05, 0.06), pulse(t, C.greet + 0.4, 0.05, 0.06), pulse(t, C.wordsLand + 0.5, 0.05, 0.06), pulse(t, C.idea + 1.2, 0.05, 0.06));
    const hesitate = seg(t, C.two + 0.95, C.two + 1.25) * (1 - seg(t, C.two + 1.3, C.reach));
    spark.update(t, cam, { pos: p, vel: sp > 3 ? v : undefined, size: SIZE, look: sLook, open: (1 - 0.94 * clamp(sBlink)) * (1 + 0.1 * startle), wide: 1 + 0.2 * startle + 0.12 * seg(t, C.wake, C.wake + 0.4) * (1 - seg(t, C.greet, C.greet + 0.5)) + 0.15 * me,
      happy: Math.max(wave * 0.7, swept * 0.8, seg(t, C.greet + 0.2, C.greet + 0.6) * 0.5 * (1 - seg(t, C.words, C.words + 0.5))), tilt: -0.14 * me + 0.1 * hesitate,
      armR: [lerp(1.28, 2.55, reach) + 0.2 * startle - 1.0 * me, lerp(-0.5, 0.05, reach) + 0.4 * startle + 0.25 * me + swept * 1.2, lerp(0.3, 0.2, reach) + 0.55 * me],
      armL: [-1.28 - 0.1 * hesitate, -0.5 + 0.35 * hesitate + 0.5 * startle + wave * (1.3 + 0.18 * Math.sin((t - C.greet) * 15)) + swept * 1.2, 0.3 + 0.2 * hesitate],
      legs: 1, light: 2.6, lightDist: 60, lightCol: 0xa8e6ff, orbit: 0.3, crackle: 0.35 + 0.5 * startle,
      trailFn: (t < C.chip + 2.8 || t > tSwept) ? age => sparkPos(t - age) : null, trailLen: 0.5, trailAmt: clamp(sp / 9) });
    // the touch itself
    const h = spark.hands[1], tc = pulse(t, C.touch - 0.02, 0.04, 0.3);
    contact.set(0, h.x + 0.4, h.y, h.z, 9 * tc, 1.0, 0.85, 0.6, tc * 1.4, 0); contact.set(1, h.x + 0.4, h.y, h.z, 22 * tc, 1.0, 0.6, 0.3, tc * 0.35, 0.5); contact.commit();
    words(t); tokens(t);
    POST.sat = lerp(1.2, 1.45, warmth);
    return { p, warmth };
  }
  const POST = { rNear: 2.0, rFar: 7.5, lift: [0.006, 0.014, 0.034], vig: 0.55, bloom: 0.85, contrast: 1.05, matteCol: [0.5, 0.66, 1.0] };

  return [
    { name: 'chip-arrive', start: C.chip, end: C.two, draw(t) {
      const k = seg(t, C.chip, C.two, ease.inOutSine);
      setCam(cam, [lerp(-13, -9, k), lerp(17, 9, k), lerp(82, 62, k)], [lerp(-4, -5, k), lerp(26, 11, k), 0], 34);
      act(t);
      return { scene: K.scene, camera: cam, post: { ...POST, focus: 64, range: 70, flat: 18, flash: (1 - seg(t, C.chip - 0.05, C.chip + 0.5, ease.out)), fade: 0 } };
    } },
    { name: 'chip-two', start: C.two, end: C.words, draw(t) {
      const k = seg(t, C.two, C.touch, ease.inOutSine), k2 = seg(t, C.touch + 0.6, C.words, ease.inOutSine);
      setCam(cam, [lerp(-9.5, -8, k) + k2 * 1.0, lerp(8.3, 8.0, k) + k2 * 0.6, lerp(31, 25.5, k) + k2 * 5], [lerp(-5.2, -4.6, k) + k2 * 0.6, lerp(8.6, 8.4, k) + k2 * 0.4, 0], 30);
      act(t);
      return { scene: K.scene, camera: cam, post: { ...POST, focus: 26, range: 46, flat: 9, rNear: 1.7 } };
    } },
    { name: 'chip-words', start: C.words, end: C.release - 0.25, draw(t) {
      const k = seg(t, C.words, C.release, ease.inOutSine);
      setCam(cam, [lerp(-4, -3, k), lerp(7.5, 8.5, k), lerp(47, 42, k)], [-2.4, lerp(16, 14, k), 0], 37);
      act(t);
      return { scene: K.scene, camera: cam, post: { ...POST, focus: 42, range: 60, flat: 14 } };
    } },
    { name: 'chip-release', start: C.release - 0.25, end: C.ascend, draw(t) {
      const k = seg(t, C.release - 0.25, C.ascend, ease.out2);
      setCam(cam, [lerp(9, 10, k), lerp(8.5, 7.2, k), lerp(25, 28, k)], [0.5, lerp(9.5, 13.5, k), 0], 34);
      act(t);
      return { scene: K.scene, camera: cam, post: { ...POST, focus: 27, range: 50, flat: 9, bloom: 1.0 } };
    } },
    { name: 'chip-ascend', start: C.ascend, end: C.reply, draw(t) {
      const k = seg(t, C.ascend, C.reply, ease.inOutSine);
      setCam(cam, [lerp(-17, -13, k), lerp(4.6, 5.2, k), lerp(38, 33, k)], [lerp(-2, 0, k), lerp(26, 46, k), 0], 42);
      act(t);
      return { scene: K.scene, camera: cam, post: { ...POST, focus: 45, range: 80, flat: 20, bloom: 1.0 + seg(t, C.white - 0.8, C.reply) * 0.8, exposure: 1 + seg(t, C.white - 0.6, C.reply) * 0.5, flash: seg(t, C.white, C.reply - 0.02, ease.in2) } };
    } },
  ];
}
