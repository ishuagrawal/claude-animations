// The power supply. The Spark bursts out of the mains terminal into a vast violet cavern, hangs there in awe of the
// transformer, is caught by its field and whirled up the copper windings, then flung onto the output loom:
// stepped down, compact and steady, it streaks toward the golden opening and the motherboard beyond.
//   1 awe     C.psu           -> C.coilIn + 0.75  low wide, slow push and tilt up; the grab and the first half turn
//   2 spiral  C.coilIn + 0.75 -> C.coilOut + 3f   ride-along round the coil, then the camera lets go and cranes out
//   3 rail    C.coilOut + 3f -> C.vista          landing on the loom, then the streak into the light
import * as THREE from 'three';
import { buildPsu, COIL, INLET, HEAD } from '../world/psu.js';
import { Spark } from '../chars/spark.js';
import { setLook } from '../gl/paint.js';
import { setCam, V3 } from '../gl/geo.js';
import { Ribbon } from '../gl/fx.js';
import { C } from '../timeline.js';
import { clamp, lerp, seg, ease, smooth, key, TAU, noise, FPS } from '../core.js';

export default function () {
  const W = buildPsu(), cam = W.cam;
  const spark = new Spark({ trail: 46 }); W.scene.add(spark.group);
  const wake = new Ribbon(110, { color: 0x4fd8ff, gain: 1.5, core: 0.5, soft: 2 }); W.scene.add(wake.mesh);
  const wpts = Array.from({ length: 110 }, () => V3());
  const T0 = C.psu, G = C.coilIn, R = C.coilOut, E = C.vista;
  const CUT1 = G + 0.75, CUT2 = R + 3 / FPS;
  const tLand = R + 0.21, tGo = R + 0.74, tThru = E - 0.42;
  const SIZE = 1.8, SMALL = 1.3, RIDE = 5.1;

  // ---- the Spark's path: one position function for the whole scene
  const A1 = V3(-31.5, 9.6, 94), A2 = V3(-30.5, 12, 88), A3 = V3(-26.5, 15, 73), A4 = V3(-27.6, 16.2, 76.5);
  const N = 4, ANG0 = 106 * Math.PI / 180;
  const tauAt = t => clamp((t - G) / (R - G));
  const thetaAt = tau => TAU * N * (0.3 * tau + 0.7 * Math.pow(tau, 2.3));
  const helix = (t, o) => {
    const tau = tauAt(t), a = ANG0 - thetaAt(tau), r = COIL.r + lerp(5.8, 4.0, tau) + 0.5 * Math.sin(tau * 21);
    return o.set(Math.cos(a) * r, lerp(COIL.y0 - 2.5, COIL.y1 + 0.6, Math.pow(tau, 0.9)), Math.sin(a) * r);
  };
  // camera of the ride: locked just ahead of the Spark's angle, then its angular speed bleeds off (numeric integral
  // of a pure function of t) and it comes to rest front-right of the coil for the release
  const LEAD = 0.74, PHI_END = 0.96, BLEED = 0.5;
  const omegaS = t => (t < G || t > R ? 0 : -TAU * N * (0.3 + 0.7 * 2.3 * Math.pow(tauAt(t), 1.3)) / (R - G));
  const sweepFor = (tA, t) => { const n = 64, h = (Math.min(t, R) - CUT1) / n; let a = 0; if (h <= 0) return 0; for (let i = 0; i < n; i++) { const u = CUT1 + (i + 0.5) * h; a += omegaS(u) * (1 - smooth(tA, tA + BLEED, u)) * h; } return a; };
  const PHI0 = ANG0 - thetaAt(tauAt(CUT1)) - LEAD;
  const wrapS = x => ((((x + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  let tA = G + 2.1, best = 9;      // pick the let-go time whose natural resting angle is closest to the one wanted
  for (let c = G + 1.9; c <= G + 2.3; c += 0.004) { const e = Math.abs(wrapS(PHI_END - PHI0 - sweepFor(c, R))); if (e < best) { best = e; tA = c; } }
  const DPHI = wrapS(PHI_END - PHI0 - sweepFor(tA, R));
  const letA = t => smooth(tA, tA + BLEED, t), letR = t => 1 - Math.pow(1 - smooth(tA - 0.1, tA + 0.9, t), 1.8);
  const phiC = t => PHI0 + sweepFor(tA, t) + DPHI * letA(t);
  const PR = helix(R, V3()), TR = V3(Math.sin(ANG0), 0, -Math.cos(ANG0));
  const LTOP = HEAD.clone().add(V3(0, RIDE, 0)), CTRL = PR.clone().addScaledVector(TR, 40).add(V3(0, 1.5, 0));
  const railTan = W.rail.getTangent(0.25).normalize();
  const _h = V3(), _a = V3(), _b = V3();
  function posAt(t, o = V3()) {
    if (t <= R) {
      const p = key(t, [[T0, INLET.toArray()], [T0 + 0.4, A1.toArray(), ease.out], [T0 + 0.95, A2.toArray(), ease.inOutSine], [G - 0.16, A3.toArray(), ease.inOutSine], [G + 0.02, A4.toArray(), ease.out2]]);
      o.set(p[0], p[1], p[2]);
      const hop = Math.sin(Math.PI * clamp((t - T0) / 0.4)) * 2.2, bob = Math.sin((t - T0) * 4.6) * 0.32 * smooth(T0 + 0.4, T0 + 0.7, t);
      o.y += hop + bob;
      const w = seg(t, G + 0.02, G + 0.44, ease.in2);
      if (w > 0) o.lerp(helix(t, _h), w);
      return o;
    }
    if (t < tLand) {
      const k = ease.out2((t - R) / (tLand - R)) * 0.999;
      return o.copy(PR).multiplyScalar((1 - k) * (1 - k)).addScaledVector(CTRL, 2 * k * (1 - k)).addScaledVector(LTOP, k * k);
    }
    if (t < tGo) {
      const sq = key(t, [[tLand, 0], [tLand + 0.07, 1, ease.out], [tLand + 0.26, -0.22, ease.inOut2], [tLand + 0.38, 0], [tGo - 0.16, 0], [tGo, 0.7, ease.inOut2]]);
      const back = smooth(tGo - 0.16, tGo, t) * 1.5;
      return o.copy(LTOP).addScaledVector(railTan, -back).add(_a.set(0, -1.1 * sq, 0));
    }
    const k = clamp((t - tGo) / (tThru + 0.12 - tGo)), u = lerp(0.25, 1, Math.pow(k, 1.75));
    W.rail.getPoint(u, o); o.y += RIDE * lerp(1, 0.55, smooth(0.6, 0.82, u));
    return o;
  }
  const velAt = (t, o = V3()) => posAt(t + 0.012, o).sub(posAt(t - 0.012, _b)).multiplyScalar(1 / 0.024);
  const P = V3(), V = V3(), camP = V3(), tgt = V3(), _r = V3(), _qi = new THREE.Quaternion();
  let tNow = 0;
  const trail = age => posAt(tNow - age, _a);

  const look = () => setLook({ tint: [0.036, 0.016, 0.088], rim: [0.78, 0.42, 1.0], rimAmt: 0.36, brk: 0.66, poster: 0.72 });
  const POST = { rNear: 2.0, rFar: 7, range: 70, flat: 12, haze: 0.33, hazeCol: [0.15, 0.075, 0.36], bloom: 0.8, thr: 0.92, contrast: 1.12, sat: 1.1, vig: 0.5,
    lift: [0.012, 0.005, 0.03], gain: [1.0, 0.95, 1.06], glowWarm: 0.15 };
  const fieldAt = t => key(t, [[T0, 0.3], [G - 0.45, 0.36], [G - 0.05, 0.62, ease.in2], [G + 0.12, 0.95, ease.out], [G + 0.5, 0.68], [R - 0.25, 1.2, ease.in2], [R, 1.6, ease.out], [R + 0.35, 0.8, ease.out], [E, 0.55]]);

  // common world + character update; Q overrides the pose
  function act(t, Q = {}) {
    tNow = t; look();
    const tau = tauAt(t), F = fieldAt(t), spin = smooth(G + 0.2, G + 0.9, t) * (t <= R ? 1 : 0);
    W.update(t, cam, {
      field: F, twist: 0.3 * thetaAt(tau), swirl: 1.1 * spin * tau, spark: P,
      arc: t > R ? 0 : Math.max(0.95 * (1 - smooth(G + 0.02, G + 0.3, t)) * smooth(G - 0.1, G, t), spin * lerp(0.4, 0.85, tau)) * (Q.arcs ?? 1),
      gold: Q.gold ?? 0.12, fanGain: Q.fanGain ?? 1, shafts: Q.shafts ?? 1, curtain: Q.curtain ?? 1,
      arriveAge: t - T0 - 0.02, landAge: t - tLand, fill: Q.fill ?? null,
    });
    spark.update(t, cam, {
      pos: P, vel: V, size: SIZE, light: 30, lightDist: 64, lightCol: 0xb0e6ff, trailFn: trail, trailLen: 0.45, trailAmt: clamp(V.length() / 50), crackle: 0.4, orbit: 0.3,
      ...Q.pose,
    });
    // the afterglow it leaves wound round the copper
    const wl = clamp(t - G - 0.25, 0, 1.25) * (t <= R + 0.3 ? 1 : 0), wa = 1 - smooth(R, R + 0.3, t);
    wake.mesh.visible = wl > 0.02;
    if (wake.mesh.visible) {
      for (let i = 0; i < 110; i++) posAt(Math.min(t, R) - (i / 109) * wl, wpts[i]);
      wake.update(wpts, cam, (i, k) => 1.5 * (1 - 0.7 * k), (i, k) => wa * 0.5 * Math.pow(1 - k, 1.4) * smooth(0, 0.06, k));
    }
    // centrifugal lean: the wisp is thrown outward from the coil's axis
    const lean = spark.bodyMat.uniforms.uLean.value;
    if (spin > 0) { _qi.copy(spark.body.quaternion).invert(); lean.set(P.x, 0, P.z).normalize().multiplyScalar(spin * lerp(0.35, 0.75, tau)).applyQuaternion(_qi); } else lean.set(0, 0, 0);
    return F;
  }

  return [
    { name: 'psu-awe', start: T0, end: CUT1, draw(t) {
      posAt(t, P); velAt(t, V);
      const k = seg(t, T0, CUT1, ease.inOutSine), kk = seg(t, T0, CUT1, ease.out2);
      const sh = smooth(G - 0.1, G + 0.3, t) * 0.25;
      const pu = seg(t, G - 0.1, CUT1, ease.inOut2);
      setCam(cam, [lerp(-31, -25, kk) + 3 * pu + noise(t * 9, 3) * sh, lerp(3.2, 5.4, k) + 1.5 * pu + noise(t * 9, 5) * sh, lerp(125, 113, kk) - 15 * pu], [lerp(2, 5, k), lerp(27, 36, k), 0], 42);
      const awe = smooth(T0 + 0.36, T0 + 0.62, t), pull = smooth(G - 0.22, G - 0.02, t), grab = smooth(G, G + 0.12, t);
      const lk = key(t, [[T0, [0.7, 0.0]], [T0 + 0.4, [0.5, 0.1]], [T0 + 0.75, [0.72, 0.8], ease.inOut2], [G - 0.3, [0.66, 0.92]], [G - 0.08, [0.95, 0.25], ease.out], [G + 0.5, [0.8, -0.1]]]);
      const squash = key(t, [[T0, 1.1], [T0 + 0.38, 1.12], [T0 + 0.47, 0.8, ease.out], [T0 + 0.62, 1.07, ease.inOut2], [T0 + 0.78, 1.0], [G - 0.2, 1.0], [G - 0.04, 0.86, ease.inOut2], [G + 0.1, 1.12, ease.out], [G + 0.5, 1.0]]);
      const up = awe * (1 - pull);
      V.multiplyScalar(lerp(1, 0.45, grab));
      act(t, { pose: {
        look: lk, squash, open: lerp(0.95, 1.22, awe) + 0.08 * pull, wide: lerp(1.0, 1.27, awe) + 0.1 * pull, tilt: -0.1 * up + 0.16 * pull,
        armL: [-1.25 - 0.3 * pull, lerp(-0.6, -0.2 + 0.05 * Math.sin(t * 3.1), up) + 0.9 * pull, 0.3], armR: [1.25 + 0.3 * pull, lerp(-0.6, 0.02 - 0.05 * Math.sin(t * 3.1), up) + 0.75 * pull, 0.3],
        crackle: lerp(0.5, 0.18, awe) + 0.6 * pull, orbit: 0.2 + 0.25 * awe, trailLen: 0.4,
      } });
      const dist = cam.position.distanceTo(P);
      const fl = 1 - seg(t, T0 - 0.05, T0 + 0.42, ease.out);
      return { scene: W.scene, camera: cam, post: { ...POST, focus: lerp(dist, 80, 0.35), range: 90, flat: 30, flash: fl * 0.9, exposure: 1 + fl * 0.5 } };
    } },
    { name: 'psu-spiral', start: CUT1, end: CUT2, draw(t) {
      posAt(t, P); velAt(t, V);
      const tau = tauAt(t), F = fieldAt(t), s = letR(t), sa = letA(t), whip = smooth(R - 0.04, CUT2, t);
      // ride-along: the camera circles the coil just ahead of the Spark, looking back at it; then it lets go,
      // drifts out and up, and the Spark tears round the last turns on its own
      const phi = phiC(t), sr = Math.hypot(P.x, P.z), rc = lerp(sr + 1.2, 70, s), sh = 0.1 + 0.25 * tau * tau;
      camP.set(Math.cos(phi) * rc + noise(t * 11, 3) * sh, lerp(P.y - 1.6, 46, s) + noise(t * 11, 5) * sh, Math.sin(phi) * rc);
      _r.set(P.x, 0, P.z).normalize();
      tgt.copy(P).addScaledVector(_r, 2.6).lerp(_a.set(4 + 20 * whip, lerp(P.y, COIL.y1 - 9, s) - 3 * whip, 6 * whip), sa);
      setCam(cam, camP.toArray(), tgt.toArray(), lerp(44, 38, s), lerp(-0.2, 0.1, s));
      const delight = 1 - smooth(0.36, 0.48, tau), dizzy = smooth(0.4, 0.52, tau), squeeze = smooth(tauAt(tA) - 0.07, tauAt(tA) + 0.01, tau), rel = smooth(R, CUT2, t);
      const roll = (t - CUT1) * 9.5;
      V.multiplyScalar(0.22);
      act(t, { pose: {
        look: [lerp(-0.35, 0.6 * Math.cos(roll), dizzy * (1 - squeeze)), lerp(0.15, 0.6 * Math.sin(roll), dizzy * (1 - squeeze))],
        open: lerp(lerp(1.15, 1.3, dizzy), 0.13, squeeze), wide: lerp(1.2, 1.36, dizzy) * lerp(1, 1.1, squeeze), happy: 0.55 * delight + 0.8 * squeeze,
        tilt: 0.1 + 0.24 * Math.sin(roll * 0.5) * (0.3 + dizzy), squash: lerp(1, 0.86, squeeze) + 0.35 * rel, size: SIZE * lerp(1, 0.9, squeeze * s),
        armL: [-1.62, lerp(0.35, 0.7, tau) + 0.12 * Math.sin(t * 19), lerp(0.1, -0.4, tau)], armR: [1.62, lerp(0.5, 0.8, tau) - 0.12 * Math.sin(t * 19), lerp(0.1, -0.4, tau)],
        crackle: lerp(0.15, 0.6, s), legs: lerp(0.75, 1, s), trailLen: lerp(0.62, 0.5, tau), trailAmt: 1.2, glow: 1 + 0.25 * squeeze, light: lerp(32, 10, s), lightDist: 30,
      }, shafts: 0.8, arcs: lerp(0.5, 1, s), fanGain: lerp(0.55, 1, s) });
      const dist = cam.position.distanceTo(P);
      const fl = rel * 0.16 + Math.max(0, 1 - Math.abs(t - R) / 0.06) * 0.14;
      return { scene: W.scene, camera: cam, post: { ...POST, focus: lerp(dist, 50, s), range: lerp(46, 60, s), flat: lerp(7, 16, s), bloom: 0.8 + 0.25 * F * tau, flash: fl, exposure: 1 + 0.1 * tau } };
    } },
    { name: 'psu-rail', start: CUT2, end: E, draw(t) {
      posAt(t, P); velAt(t, V);
      const go = seg(t, tGo - 0.05, tThru, ease.inOut2), settle = seg(t, CUT2, tGo, ease.out2);
      camP.set(lerp(40, 42, settle) + 8 * go, lerp(32.4, 31.6, settle) - 0.6 * go, lerp(53, 52, settle) - 1 * go);
      tgt.set(lerp(82, 85, settle) + 40 * go, lerp(28.5, 29, settle) + 1.5 * go, lerp(31.5, 32, settle) + 5 * go);
      const hit = Math.max(0, 1 - (t - tLand) / 0.3) * (t >= tLand ? 1 : 0);
      camP.y -= 0.5 * hit * Math.cos((t - tLand) * 40);
      setCam(cam, camP.toArray(), tgt.toArray(), lerp(31, 28, go));
      const landed = smooth(tLand, tLand + 0.06, t), pop = smooth(tLand + 0.08, tLand + 0.3, t), crouch = smooth(tGo - 0.17, tGo - 0.02, t), gone = smooth(tGo, tGo + 0.1, t);
      const squash = key(t, [[CUT2, 1.1], [tLand, 1.15], [tLand + 0.07, 0.55, ease.out], [tLand + 0.26, 1.16, ease.inOut2], [tLand + 0.38, 1.0, ease.inOut2], [tGo - 0.17, 1.0], [tGo - 0.02, 0.72, ease.inOut2], [tGo + 0.1, 1.15, ease.out]]);
      const blink = (1 - smooth(tLand + 0.1, tLand + 0.28, t)) * landed;
      const thru = smooth(tThru - 0.12, tThru + 0.04, t);
      V.multiplyScalar(lerp(1, 0.4, gone));
      act(t, { pose: {
        size: lerp(SIZE, SMALL, pop), glow: lerp(1, 1.45, pop) * (1 - 0.6 * thru), light: lerp(30, 50, pop), lightDist: 80, squash,
        look: key(t, [[CUT2, [0.8, -0.3]], [tLand + 0.1, [0.2, -0.4]], [tLand + 0.34, [0.92, 0.12], ease.inOut2], [tGo, [1, 0.1]]]),
        open: lerp(lerp(1.1, 0.12, blink), 0.82, pop * (1 - blink)) - 0.2 * crouch, wide: lerp(1.2, 1.08, pop), happy: 0.75 * blink + 0.3 * pop * (1 - blink) + 0.25 * crouch,
        tilt: -0.1 * pop * (1 - gone),
        armL: [-1.3 + 0.2 * crouch, lerp(0.5, -0.45, pop) - 0.2 * crouch, 0.3 - 0.9 * gone], armR: [1.3 - 0.1 * crouch, lerp(0.5, -0.3, pop) + 0.5 * crouch, 0.3 - 0.9 * gone],
        legs: 1, crackle: lerp(0.7, 0.1, pop), orbit: 0.2, trailLen: lerp(0.3, 0.6, gone), trailAmt: t < tLand ? 1 : gone,
      }, gold: lerp(0.75, 1, go) + 1.2 * thru, fanGain: 0.8, shafts: 0.5, curtain: 0.7, fill: { p: [44, 52, 70], i: 46, c: 0xe8a0d8 } });
      const dist = cam.position.distanceTo(P);
      const fl = smooth(E - 0.32, E, t);
      return { scene: W.scene, camera: cam, post: { ...POST, focus: Math.min(dist, 120), range: 90, flat: 16, haze: 0.3, hazeCol: [lerp(0.27, 0.8, fl), lerp(0.13, 0.5, fl), lerp(0.5, 0.3, fl)],
        glowWarm: 0.75, bloom: 0.85 + 0.9 * thru + fl, exposure: 1 + 0.9 * fl, fade: fl * fl * 0.9, fadeCol: [1.0, 0.96, 0.86], gain: [1.0 + 0.1 * fl, 0.95, lerp(1.06, 0.82, fl)] } };
    } },
  ];
}
