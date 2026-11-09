// Inside the cord (C.tunnel -> C.psu): the Spark's first flight. Two setups, cut on the beat a third of the way in:
//  A  the camera flies backwards ahead of it, near the wall: it comes at us out of the glowing copper, left to right
//  B  chase from behind: anticipation, a barrel roll around the wall at C.tunnelLoop, a glance back, then away into the light
// The Spark's path is one analytic function of time (arc length u along the cord + an offset in the cross-section).
import * as THREE from 'three';
import { buildTunnel, frameAt, place } from '../world/tunnel.js';
import { Spark } from '../chars/spark.js';
import { setLook } from '../gl/paint.js';
import { C } from '../timeline.js';
import { key, ease, clamp, lerp, smooth, noise } from '../core.js';

export default function () {
  const W = buildTunnel();
  const spark = new Spark({ trail: 40 }); W.scene.add(spark.group);
  spark.light.visible = false;      // its light is painted by the copper material instead (a Lambert light on copper goes olive)
  const cam = W.cam, SIZE = 0.48;
  const T0 = C.tunnel, T1 = C.psu, D = T1 - T0, CUT = D / 3, L = C.tunnelLoop - T0;     // tau = t - T0

  // ---- speed along the cord (piecewise linear, integrated in closed form): cruise, gather, whip round the loop, hang, go
  const VK = [[-4, 24], [L - 0.36, 24], [L - 0.03, 15], [L + 0.15, 34], [L + 0.9, 30], [L + 1.15, 17], [L + 1.6, 18], [L + 1.9, 44], [D, 118], [D + 2, 118]];
  const integ = x => {
    let s = 0;
    for (let i = 1; i < VK.length; i++) {
      const [a, va] = VK[i - 1], [b, vb] = VK[i];
      if (x <= a) break;
      const e = Math.min(x, b), ve = va + (vb - va) * (e - a) / (b - a);
      s += (va + ve) * 0.5 * (e - a);
    }
    return s;
  };
  const I0 = integ(0), uAt = tau => integ(tau) - I0;
  const speedAt = tau => { for (let i = 1; i < VK.length; i++) if (tau <= VK[i][0]) return lerp(VK[i - 1][1], VK[i][1], (tau - VK[i - 1][0]) / (VK[i][0] - VK[i - 1][0])); return VK[VK.length - 1][1]; };

  const TG = L + 1.66, UG = uAt(TG) - 3.3, VG = speedAt(TG), AG = (38 - VG) / (D - TG);      // the camera's own run-out

  // ---- offset in the cross-section [right, up]: a slalom, a dip (anticipation), once round the wall, a wobble (follow-through)
  const PHI0 = -Math.PI / 2 + 0.6, SWEEP = Math.PI * 2 + 0.1;
  const loopRho = tau => key(tau, [[L - 0.38, 0], [L - 0.04, 1.5, ease.out2], [L + 0.24, 3.35, ease.inOut2], [L + 0.84, 3.35], [L + 1.12, 0, ease.inOut2]]);
  const loopK = tau => key(tau, [[L - 0.1, 0], [L + 1.02, 1, ease.inOutSine]]);            // 0..1 round the wall
  const offAt = (tau, o) => {
    const b = smooth(CUT - 0.3, CUT + 0.25, tau);
    const quiet = 1 - 0.8 * smooth(L - 0.36, L, tau) * (1 - smooth(L + 1.0, L + 1.3, tau));
    let ox = lerp(-1.0 + 0.8 * Math.sin(tau * 3.1 + 0.4), 0.7 * Math.sin(tau * 2.6 + 1.0), b) * quiet;
    let oy = lerp(-0.3 + 0.45 * Math.sin(tau * 4.3 + 1.2), -0.25 + 0.3 * Math.sin(tau * 3.4), b) * quiet;
    const rho = loopRho(tau), phi = PHI0 - SWEEP * loopK(tau);
    ox += rho * Math.cos(phi); oy += rho * Math.sin(phi);
    const ft = tau - (L + 1.06);
    if (ft > 0) { const w = 0.5 * Math.exp(-ft * 5) * Math.sin(ft * 15); ox += w * 0.8; oy += w; }
    const g = smooth(L + 1.8, L + 2.3, tau);                // the dash: low and left of the lens, so its streak reads
    o[0] = ox - 1.5 * g; o[1] = oy - 0.9 * g; return o;
  };
  const _o = [0, 0];
  const posAt = (t, out) => { const tau = t - T0; offAt(tau, _o); return place(uAt(tau), _o[0], _o[1], out); };
  const v3 = () => new THREE.Vector3();
  const P = v3(), V = v3(), Va = v3(), Pa = v3(), Pb = v3(), camP = v3(), tgt = v3(), fwd = v3(), right = v3(), up = v3(), trailP = v3();
  const f = { c: v3(), T: v3(), R: v3(), U: v3() }, fs = { c: v3(), T: v3(), R: v3(), U: v3() };
  const off = [0, 0];
  const velAt = (t, out) => { const h = 1 / 96; posAt(t + h, Pa); posAt(t - h, Pb); return out.subVectors(Pa, Pb).multiplyScalar(1 / (2 * h)); };
  let tNow = 0;
  const trail = age => posAt(tNow - age, trailP);
  // the velocity handed to the rig is art-directed: enough along the cord to trail the wisp at an angle (not flat
  // behind the body), the sideways motion exaggerated so the body leans into every turn, and a downward bias (kick)
  // that lifts the trailing legs up behind it: a flying pose, not a standing one
  const styleVel = (u, along, side, kick = 0) => {
    frameAt(u, fs);
    const vt = V.dot(fs.T), vr = V.dot(fs.R), vu = V.dot(fs.U), a = along * SIZE * 14 * clamp(vt / 24, 0.5, 1.6);
    return Va.copy(fs.T).multiplyScalar(a).addScaledVector(fs.R, vr * side).addScaledVector(fs.U, vu * side - kick * a);
  };

  function aim(pos, target, upRef, roll, fov) {
    cam.position.copy(pos);
    fwd.subVectors(target, pos).normalize(); right.crossVectors(fwd, upRef).normalize(); up.crossVectors(right, fwd);
    cam.up.copy(up).multiplyScalar(Math.cos(roll)).addScaledVector(right, Math.sin(roll));
    cam.lookAt(target);
    if (cam.fov !== fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld();
  }
  // wings: hands on a line through the body, banked by b (radians, + = right hand up), swept back by z
  const wings = (b, span, lift, z, flap) => {
    const c = Math.cos(b), s = Math.sin(b);
    return { armL: [-c * span - s * lift, -s * span + c * (lift + flap), z], armR: [c * span - s * lift, s * span + c * (lift - flap), z] };
  };
  // deep umber shadows, gold rim; the only cool colour in the frame is the Spark's own light
  const look = (o = {}) => setLook({ tint: [0.085, 0.032, 0.03], rim: [1.0, 0.58, 0.24], rimAmt: 0.42, band: [0.08, 0.4, 0.74, 1.15], brk: 0.65, poster: 0.72, ...o });
  const POST = { rNear: 2.0, rFar: 7, mean: 0.45, wobble: 5, bloom: 0.6, thr: 1.0, contrast: 1.1, sat: 1.0, matte: 0.075, satKnee: 0.64, vig: 0.5, lift: [0.03, 0.012, 0.01], gain: [1.03, 1.0, 0.96], matteCol: [0.9, 0.5, 0.4], hazeCol: [0.95, 0.5, 0.16] };

  return [
    { name: 'tunnel-meet', start: T0, end: T0 + CUT, draw(t) {
      const tau = t - T0, k = tau / CUT; tNow = t; look();
      const u = uAt(tau); offAt(tau, off); posAt(t, P); velAt(t, V);
      // camera: ahead of the Spark, flying backwards near the right-hand wall; the Spark gains on it and sweeps past
      const dA = key(tau, [[0, 8], [CUT * 0.72, 3.5, ease.inOutSine], [CUT, 2.3, ease.in2]]);
      const uc = u + dA; frameAt(uc, f);
      place(uc, 1.8 + 0.15 * Math.sin(tau * 1.7) + 0.05 * noise(tau * 3, 5), 0.45 + 0.12 * Math.sin(tau * 2.3 + 1) + 0.05 * noise(tau * 3, 9), camP);
      place(uc - 20, 0.4, -0.75, tgt); tgt.lerp(P, key(tau, [[0, 0.3], [CUT * 0.7, 0.5], [CUT, 0.72]]));
      aim(camP, tgt, f.U, -0.06 + 0.05 * Math.sin(tau * 1.9), 40);
      const dist = camP.distanceTo(P);
      // acting: wonder (wide eyes roam the strands) -> a strand arcs beside it, a blink of surprise -> delight, arms thrown back
      const joy = smooth(0.52, 0.74, k), squee = smooth(0.8, 0.92, k), startle = smooth(0.4, 0.46, k) * (1 - smooth(0.5, 0.6, k));
      const lk = key(tau, [[0, [-0.6, 0.4]], [CUT * 0.22, [-0.3, 0.45]], [CUT * 0.4, [0.55, 0.25]], [CUT * 0.6, [0.15, 0.05]], [CUT, [0.3, 0.0]]]);
      const bank = -0.42 * Math.cos(tau * 3.1 + 0.4) * (1 - 0.3 * joy);
      spark.update(t, cam, {
        pos: P, vel: styleVel(u, lerp(0.5, 0.8, joy), 1.0, 0.7), size: SIZE, look: lk, run: tau * 15, stride: 0.5 + 0.3 * joy,
        open: lerp(1.18, 1.0, joy) - 0.5 * startle - 0.22 * squee, wide: lerp(1.16, 1.12, joy) + 0.1 * startle + 0.08 * squee, happy: 0.4 * joy + 0.35 * squee,
        tilt: bank * 0.75 + 0.1 * joy, squash: 1 + 0.12 * startle - 0.05 * joy,
        ...wings(bank, lerp(1.3, 1.6, joy), lerp(-0.25, 0.45, joy), lerp(0.25, -0.75, joy), 0.1 * Math.sin(tau * 7)),
        trailFn: trail, trailLen: 0.5, trailAmt: 0.9, light: 0, crackle: 0.55 + 0.4 * startle,
      });
      W.update(t, cam, { u, pos: P, off, trail, camU: uc, back: true, heat: 1, heatGain: 0.45, arc: 0.5 + 0.5 * startle, key: 0.28, keyDir: [-0.2, 0.9, -0.5], mouth: 0 });
      W.scene.fog.density = 0.02; W.scene.fog.color.setRGB(0.5, 0.13, 0.02);
      return { scene: W.scene, camera: cam, post: { ...POST, focus: dist, range: 11, flat: 2, haze: 0.25, hazeCol: [0.7, 0.24, 0.06] } };
    } },
    { name: 'tunnel-chase', start: T0 + CUT, end: T1, draw(t) {
      const tau = t - T0; tNow = t;
      const u = uAt(tau); offAt(tau, off); posAt(t, P); velAt(t, V);
      const lk = loopK(tau), inLoop = smooth(L - 0.3, L, tau) * (1 - smooth(L + 0.95, L + 1.2, tau));
      const glance = smooth(L + 1.22, L + 1.38, tau) * (1 - smooth(L + 1.72, L + 1.86, tau));
      const go = smooth(L + 1.76, L + 2.05, tau), fl = smooth(D - 0.3, D, tau), beam = smooth(L + 1.46, L + 1.56, tau);
      look({ tint: [0.085 + 0.05 * go, 0.032 + 0.016 * go, 0.03 + 0.008 * go] });      // the light from the mouth lifts the shadows as it nears
      // camera: behind and a little above; widens for the roll and banks with it, closes in for the glance, then lets go
      // (after the glance the camera keeps its own steady pace, TG onward, while the Spark accelerates out of reach)
      const dt = Math.max(0, tau - TG);
      const uc = tau <= TG ? u - key(tau, [[CUT, 6.2], [L - 0.2, 5.4], [L + 0.45, 6.8], [L + 1.05, 6.0], [L + 1.4, 3.1], [TG, 3.3]]) : UG + VG * dt + 0.5 * AG * dt * dt;
      const dB = u - uc; frameAt(uc, f);
      const ft = Math.max(0, tau - L - 1.1);
      const bank = 0.07 + 0.42 * Math.sin(Math.PI * smooth(0.02, 1.15, (tau - L + 0.1) / 1.12)) - 0.05 * Math.exp(-ft * 6) * Math.sin(ft * 13);
      const wx = off[0] * (1 - inLoop), wy = off[1] * (1 - inLoop);
      place(uc, 0.3 * wx + 0.75 * go + 0.05 * noise(tau * 3, 5), 0.6 - 0.45 * inLoop + 0.12 * wy + 0.25 * go + 0.05 * noise(tau * 3, 9), camP);
      place(u + 3, 0, 0.05, tgt); tgt.lerp(P, key(tau, [[CUT, 0.35], [L - 0.3, 0.4], [L, 0.58], [L + 1.2, 0.5], [L + 1.4, 0.8], [L + 1.7, 0.8], [L + 2.15, 0.4], [D, 0.25]]));
      aim(camP, tgt, f.U, bank, lerp(40, 50, go * go));
      const dist = camP.distanceTo(P);
      // acting: wings out and banking; gather (squash, arms in); round the wall, wisp and legs streaming; wobble;
      // look back over the shoulder, beaming, arms up; then tuck and go
      const gather = smooth(L - 0.36, L - 0.06, tau) * (1 - smooth(L - 0.02, L + 0.12, tau));
      const roll = -Math.PI * 2 * lk + 0.9 * (V.dot(f.R) / 24) * (1 - inLoop);
      const w = wings(roll, lerp(1.6, 0.9, gather) - 0.5 * go, lerp(0.15, -0.3, gather) + 0.75 * glance, 0.35 + 0.5 * gather + 0.9 * go, 0.08 * Math.sin(tau * 7));
      spark.update(t, cam, {
        pos: P, vel: styleVel(u, 0.6 + 0.4 * go - 0.45 * glance, lerp(0.8, 0.3, inLoop), 0.75 * (1 - glance) * (1 - inLoop)), size: SIZE, run: tau * 15, stride: 0.55 * (1 - 0.6 * glance),
        look: [lerp(1, 0.22, glance), 0.12 * glance], eyes: glance, happy: 0.8 * beam, open: 1.1 - 0.28 * beam, wide: 1.14 + 0.08 * beam, tilt: 0.24 * glance,
        squash: 1 - 0.22 * gather + 0.18 * inLoop * (1 - gather) + 0.3 * go, ...w,
        trailFn: trail, trailLen: clamp(Math.min(dB * 0.85, 26) / V.length(), 0.1, 0.7), trailAmt: lerp(0.65, 1, Math.max(inLoop, go)), light: 0, crackle: 0.5 + 0.4 * inLoop,
      });
      const mouth = smooth(L + 0.9, D, tau);
      W.update(t, cam, { u, pos: P, off, trail, camU: uc, back: false, heat: 1, heatGain: 0.45 + 0.35 * go, wakeK: clamp(30 / V.length(), 0.3, 1), arc: 0.4 + 0.6 * inLoop, key: 0.5 + 0.5 * go, keyDir: [0.25, 0.5, 1], mouth: 0.25 + 0.75 * mouth });
      W.scene.fog.density = 0.019; W.scene.fog.color.setRGB(0.85 + 0.5 * go, 0.3 + 0.3 * go, 0.05 + 0.1 * go);
      return { scene: W.scene, camera: cam, post: { ...POST, focus: dist, range: 12, flat: 2, haze: 0.3, exposure: 1 + 0.2 * go + fl * fl * 4.5, flash: fl * fl * fl * 0.55, bloom: 0.6 + 1.2 * fl, glowWarm: 0.6 + 0.4 * fl, gain: [1.03 + 0.12 * fl, 1.0 + 0.02 * fl, 0.96 - 0.3 * fl], matteCol: [0.9 + 0.1 * fl, 0.5 + 0.35 * fl, 0.4 + 0.2 * fl] } };
    } },
  ];
}
