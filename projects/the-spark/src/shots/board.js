// The motherboard: the reveal (a tiny light entering a golden-hour valley), then the run along the gold trace and
// the leap into the processor under the cooler tower.
import * as THREE from 'three';
import { buildBoard } from '../world/board.js';
import { Spark } from '../chars/spark.js';
import { setLook } from '../gl/paint.js';
import { setCam, V3 } from '../gl/geo.js';
import { C } from '../timeline.js';
import { clamp, lerp, seg, ease, smooth, key, pulse } from '../core.js';

export default function () {
  const B = buildBoard(), cam = B.cam;
  const spark = new Spark({ trail: 40 }); B.scene.add(spark.group);
  const UP = V3(0, 1, 0), SIZE = 1.5;
  const look = () => setLook({ tint: [0.05, 0.2, 0.22], rim: [1.0, 0.6, 0.28], rimAmt: 0.6, brk: 0.65 });
  // progress along the gold trace: bursts in, slows in awe, then runs; leaves the trace at C.leap
  const uAt = t => key(t, [[C.vista - 0.3, 0.0], [C.vista + 1.1, 0.085, ease.out], [C.vista + 2.6, 0.11, ease.inOutSine], [C.run, 0.27, ease.in2], [C.leap, 0.93, ease.lin], [C.leap + 0.4, 1.0, ease.out2]]);
  const socket = V3(4, 5.2, -45);
  function posAt(t) {
    const u = uAt(t), p = B.at(u);
    const run = Math.abs(Math.sin(t * 13)) * 0.35 * smooth(C.run - 0.5, C.run, t);
    p.y = SIZE * 1.62 + 0.3 + run;
    if (t > C.leap) {      // the leap: up over the socket rim and into the seam under the cooler
      const k = clamp((t - C.leap) / 1.25), e = ease.inOut2(k);
      const from = B.at(0.93); from.y = SIZE * 1.62 + 0.3;
      p.lerpVectors(from, socket, e); p.y += Math.sin(k * Math.PI) * 13 * (1 - k * 0.35);
    }
    return p;
  }
  const velAt = t => posAt(t + 0.02).sub(posAt(t - 0.02)).multiplyScalar(25);
  const POST = { rNear: 2.0, haze: 0.13, hazeCol: [0.8, 0.46, 0.3], bloom: 0.65, lift: [0.008, 0.03, 0.04], sat: 1.5, matteCol: [0.4, 0.85, 0.9] };
  function act(t, P = {}) {
    look();
    const p = posAt(t), v = velAt(t), sp = v.length();
    B.update(t, Math.min(uAt(t), 0.985), cam);
    spark.update(t, cam, { pos: p, vel: v, size: SIZE, look: [0.8, 0.1], open: 1.05, happy: 0.3, legs: 1, stride: clamp(sp / 20), run: t * 22, light: 3.2, lightDist: 46, lightCol: 0xbfeaff,
      trailFn: age => posAt(t - age), trailLen: 0.55, trailAmt: clamp(sp / 12), orbit: 0.3, ...P });
    return p;
  }
  return [
    { name: 'vista', start: C.vista, end: C.run, draw(t) {
      const k = seg(t, C.vista, C.run, ease.inOutSine);
      setCam(cam, [lerp(-46, -38, k), lerp(7.5, 13, k), lerp(136, 120, k)], [lerp(5, 3, k), lerp(27, 24, k), -20], 34);
      act(t, { size: SIZE * 1.15 });
      return { scene: B.scene, camera: cam, post: { ...POST, focus: 115, range: 110, flat: 40, rFar: 6.5, flash: (1 - seg(t, C.vista - 0.05, C.vista + 0.6, ease.out)) * 0.9 } };
    } },
    { name: 'run', start: C.run, end: C.leap, draw(t) {
      // track alongside and a little behind, so the run reads left-to-right with the tower and the vents ahead
      const T = B.tan(uAt(t + 0.25)).setY(0).normalize(), S = UP.clone().cross(T).addScaledVector(T, 0.75).normalize();
      const k = seg(t, C.run, C.leap, ease.inOutSine), d = lerp(27, 21, k);
      const lead = posAt(t + 0.12);
      setCam(cam, [lead.x - S.x * d, 7.5 + k * 1.5, lead.z - S.z * d], [lead.x + T.x * 5, lead.y + 2.2, lead.z + T.z * 5], 34);
      act(t, { happy: 0.55, armL: [-1.45, 0.25, -0.5], armR: [1.45, 0.3 + 0.1 * Math.sin(t * 9), -0.4], wide: 1.05 });
      return { scene: B.scene, camera: cam, post: { ...POST, focus: d, range: 60, flat: 6, rFar: 8, bloom: 0.75 } };
    } },
    { name: 'leap', start: C.leap, end: C.chip, draw(t) {
      const p = posAt(t);
      const k = seg(t, C.leap, C.chip, ease.inOutSine), from = B.at(0.86);
      setCam(cam, [lerp(from.x - 13, from.x - 8, k), lerp(4.5, 7, k), lerp(from.z + 30, from.z + 20, k)], [lerp(p.x, socket.x, 0.35), lerp(p.y, 12, 0.3), lerp(p.z, socket.z, 0.4)], 34);
      act(t, { happy: 0.2, wide: 1.15, armL: [-1.3, 0.9, 0], armR: [1.3, 0.9, 0], look: [0.3, 0.5], legs: 1 });
      const gone = seg(t, C.leap + 1.15, C.leap + 1.3);
      return { scene: B.scene, camera: cam, post: { ...POST, focus: 32, range: 60, flat: 10, rFar: 7, bloom: 0.8 + gone, flash: seg(t, C.chip - 0.3, C.chip, ease.in2), exposure: 1 + gone * 0.4 } };
    } },
  ];
}
