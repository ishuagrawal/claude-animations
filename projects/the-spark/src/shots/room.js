// Room shots: the dusk room and the question, the cord to the wall, the x-ray of the cord, the reply, the ending.
import * as THREE from 'three';
import { buildRoom, OUTLET, MON } from '../world/room.js';
import { SW, SH, COL_X, POEM_Y, POEM_LH } from '../world/screen.js';
import { Spark } from '../chars/spark.js';
import { Sprites } from '../gl/fx.js';
import { setLook } from '../gl/paint.js';
import { setCam, V3 } from '../gl/geo.js';
import { C, PROMPT, POEM, TYPE_CPS } from '../timeline.js';
import { clamp, lerp, seg, ease, smooth, key, hash2, TAU, noise, pulse } from '../core.js';
import { title } from '../overlay.js';

export default function () {
  const R = buildRoom(), cam = R.cam;
  const spark = new Spark(); R.scene.add(spark.group);
  const motes = new Sprites(180, { shape: 'star', core: 1, soft: 0.3 }); R.scene.add(motes.mesh);
  const dusk = () => setLook({ tint: [0.07, 0.16, 0.22], rim: [1.0, 0.6, 0.32], rimAmt: 0.5, brk: 0.65 });
  const night = () => setLook({ tint: [0.035, 0.07, 0.13], rim: [1.0, 0.78, 0.5], rimAmt: 0.35, brk: 0.65 });
  const hideSpark = t => spark.update(t, cam, { pos: V3(0, -50, 0), size: 0 });
  const noMotes = () => motes.commit(0);
  const scrPt = (px, py, dz = 0.05) => V3(MON.x - MON.w / 2 + (px / SW) * MON.w, MON.y + MON.h / 2 - (py / SH) * MON.h, MON.z + dz);
  const typedAt = t => clamp((t - C.typeStart) * TYPE_CPS, 0, PROMPT.length);
  const POST = { rNear: 2.0, rFar: 7, lift: [0.008, 0.026, 0.04], vig: 0.5, matteCol: [0.45, 0.8, 0.95] };

  return [
    { name: 'room', start: 0, end: C.screen, draw(t) {
      dusk(); hideSpark(t); noMotes();
      R.set(t, { night: 0, tower: 0.22 + 0.04 * Math.sin(t * 1.3), typing: -1, headTilt: 0.05 * Math.sin(t * 0.7), headNod: 0.03 * Math.sin(t * 0.45 + 1), screenGain: 0.9 });
      R.screen.draw({ t, typed: 0 });
      const k = seg(t, 0, C.screen, ease.inOutSine);
      setCam(cam, [lerp(17.5, 15.2, k), lerp(14.2, 13.0, k), lerp(31, 26.5, k)], [lerp(-0.5, 0.6, k), lerp(8.6, 8.8, k), 0], 32);
      return { scene: R.scene, camera: cam, post: { ...POST, focus: 27, range: 26, flat: 7, fade: 1 - seg(t, C.fadeIn + 0.1, C.room + 1.4, ease.inOutSine), bloom: 0.8 },
        overlay: ctx => title(ctx, 'THE SPARK', seg(t, C.titleIn, C.titleIn + 1.2, ease.inOutSine) * (1 - seg(t, C.titleOut, C.titleOut + 0.9, ease.inOutSine)), { y: 318, track: 26, size: 46 }) };
    } },
    { name: 'screen', start: C.screen, end: C.follow, draw(t) {
      dusk(); hideSpark(t); noMotes();
      const typing = t > C.typeStart && t < C.typeEnd;
      R.set(t, { night: 0, tower: 0.22, typing: typing ? t : -1, screenGain: 0.86, screenLight: 1.1 });
      const sent = seg(t, C.enter, C.enter + 0.55, ease.out);
      R.screen.draw({ t, typed: typedAt(t), typing: typing ? 1 : 0, sent, think: seg(t, C.enter + 0.35, C.enter + 0.8) });
      const k = seg(t, C.screen, C.follow, ease.inOutSine), e = pulse(t, C.enter, 0.04, 0.12) * 0.03;
      setCam(cam, [lerp(10.4, 9.9, k), lerp(12.3, 12.1, k), lerp(12.3, 11.3, k) - e], [lerp(6.8, 6.9, k), lerp(11.2, 11.3, k), 1.9], 30);
      return { scene: R.scene, camera: cam, post: { ...POST, focus: 9.5, range: 6, flat: 2.5, rFar: 9, bloom: 0.55, thr: 1.0, vig: 0.55 } };
    } },
    { name: 'follow', start: C.follow, end: C.outlet, draw(t) {
      dusk(); hideSpark(t); noMotes();
      const slot = seg(t, C.slotGlow, C.outlet - 0.3, ease.in2);
      R.set(t, { night: 0, tower: 0.22, slot });
      R.screen.draw({ t, typed: PROMPT.length, sent: 1, think: 1 });
      // glide low along the cord from the tower to the wall, then push in to the outlet
      const k = seg(t, C.follow, C.slotGlow + 0.4, ease.inOutSine), u = lerp(0.97, 0.12, k);
      const p = R.cord.getPointAt(u), a = R.cord.getPointAt(Math.max(0, u - 0.1));
      const pin = seg(t, C.slotGlow - 0.5, C.outlet, ease.inOut), [ox, oy] = OUTLET;
      const pos = V3(p.x + 1.2, p.y + 1.25 + 0.3 * Math.sin(k * Math.PI), p.z + 4.6).lerp(V3(ox + 0.42, oy + 0.42, 1.25), pin);
      const look = V3(a.x, a.y + 0.2, a.z).lerp(V3(ox, oy + 0.38, 0), pin);
      setCam(cam, pos.toArray(), look.toArray(), lerp(34, 26, pin));
      const d = pos.distanceTo(look);
      return { scene: R.scene, camera: cam, post: { ...POST, focus: d, range: d * 1.3, flat: d * 0.35, rFar: 8, fade: seg(t, C.outlet - 0.45, C.outlet - 0.02, ease.in2), exposure: 1.05, bloom: 0.9 } };
    } },
    { name: 'xray', start: C.xray, end: C.tunnel, draw(t) {
      R.set(t, { night: 0, tower: 0.22 });
      R.screen.draw({ t, typed: PROMPT.length, sent: 1, think: 1 });
      noMotes();
      const uAt = tt => lerp(0.3, 0.86, seg(tt, C.xray - 0.25, C.tunnel + 0.15, ease.lin));
      const u = uAt(t), p = R.cord.getPointAt(u), ahead = R.cord.getPointAt(Math.min(1, u + 0.04));
      const vel = R.cord.getTangentAt(u).multiplyScalar((uAt(t + 0.02) - uAt(t - 0.02)) / 0.04 * R.cord.getLength());
      setLook({ tint: [0.07, 0.16, 0.22], rim: [1.0, 0.6, 0.32], rimAmt: 0.55, brk: 0.65, reveal: [p.x, p.y, p.z, 0.6], revealCol: [0.35, 0.9, 1.0] });
      R.copperM.emissiveIntensity = 0.35;
      const k = seg(t, C.xray, C.tunnel, ease.inOutSine);
      setCam(cam, [p.x - 0.35 + k * 0.5, p.y + lerp(0.62, 0.42, k), p.z + lerp(2.25, 1.75, k)], [ahead.x + 0.1, ahead.y + 0.02, ahead.z], 30);
      const bob = Math.sin(t * 21) * 0.006;
      spark.update(t, cam, { pos: V3(p.x, p.y + bob, p.z), vel, size: 0.07, look: [0.75, 0.05], open: 1.05, wide: 1.1, happy: 0.35, arms: 1, legs: 1, stride: 1, run: t * 26,
        armL: [-1.1, 0.25, -0.5], armR: [1.35, 0.1, 0.4], light: 0.9, lightDist: 3, trailFn: age => R.cord.getPointAt(uAt(t - age)), trailLen: 0.5, trailAmt: 1, crackle: 0.7 });
      return { scene: R.scene, camera: cam, post: { ...POST, focus: 2.1, range: 3.5, flat: 0.5, rNear: 1.6, rFar: 9, bloom: 1.0, flash: Math.max(seg(t, C.tunnel - 0.22, C.tunnel, ease.in2) * 0.9, (1 - seg(t, C.xray, C.xray + 0.3, ease.out)) * 0.7) } };
    } },
    { name: 'reply', start: C.reply, end: C.home, draw(t) {
      night();
      const k = seg(t, C.reply, C.home, ease.inOutSine), c2 = seg(t, C.cursor - 0.3, C.home, ease.inOutSine);
      setCam(cam, [lerp(5.6, 6.3, k) + c2 * 1.1, lerp(11.8, 11.5, k) - c2 * 0.5, lerp(8.9, 8.1, k) - c2 * 2.0], [lerp(7.3, 7.5, k) + c2 * 0.9, lerp(11.2, 11.05, k) - c2 * 0.5, 1.9], 34);
      R.set(t, { night: 1, tower: 0.6 + 0.1 * Math.sin(t * 2), screenGain: 0.88, screenLight: 1.5 });
      const lines = POEM.map((_, i) => clamp((t - C.line[i]) / 1.05));
      R.screen.draw({ t, typed: PROMPT.length, sent: 1, think: 1 - seg(t, C.line[0] - 0.3, C.line[0] + 0.2), lines });
      // tokens arriving: gold motes stream in and settle where each line is being written
      let n = 0;
      POEM.forEach((ln, i) => {
        const w = R.screen.poemW[i] || 600;
        for (let j = 0; j < 40; j++) {
          const h0 = hash2(i * 97 + j, 3), h1 = hash2(i * 97 + j, 5), h2 = hash2(i * 97 + j, 7);
          const arrive = C.line[i] + (j / 40) * 1.0 + h0 * 0.12, k = clamp((t - (arrive - 0.9)) / 0.9), gone = clamp((t - arrive) / 0.35);
          if (k <= 0 || gone >= 1) continue;
          const to = scrPt(COL_X + (j / 40) * w, POEM_Y + i * POEM_LH + (h1 - 0.5) * 30, 0.08), e = ease.out(k);
          const from = V3(to.x + 2.5 + h0 * 3, to.y + 1.5 + h1 * 2.5, to.z + 2.5 + h2 * 2.5);
          const p = from.lerp(to, e); p.y += Math.sin(k * Math.PI) * 0.5 * (h2 - 0.3); p.x += Math.sin(k * 7 + h0 * 6) * 0.12 * (1 - k);
          motes.set(n++, p.x, p.y, p.z, 0.2 + h2 * 0.16, 1.0, 0.78, 0.36, (0.6 + 0.4 * h1) * smooth(0, 0.15, k) * (1 - gone), h0);
        }
      });
      motes.commit(n);
      // the cursor: the spark, peeking out at the end of the last line
      const cp = scrPt(COL_X + (R.screen.poemW[3] || 720) + 46, POEM_Y + 3 * POEM_LH - 4, 0.22);
      const pop = seg(t, C.cursor, C.cursor + 0.45, ease.outBack), wave = seg(t, C.cursor + 1.0, C.cursor + 1.4);
      const blink = Math.max(pulse(t, C.cursor + 0.8, 0.05, 0.06), pulse(t, C.cursor + 2.0, 0.05, 0.06));
      spark.update(t, cam, { pos: V3(cp.x, cp.y + (1 - pop) * -0.1 + Math.sin(t * 2.4) * 0.012, cp.z), size: 0.15 * pop, look: [-0.35, 0.1], open: 1 - 0.9 * clamp(blink), happy: 0.5 * wave, wide: 1.05,
        armR: [1.25, 0.2 + 0.55 * wave + 0.12 * wave * Math.sin(t * 16), 0.4], legs: 0.9, light: 0.5 * pop, lightDist: 5, glow: pop > 0 ? 1 : 0, orbit: 0.25 });
      return { scene: R.scene, camera: cam, post: { ...POST, focus: 6.8, range: 6, flat: 2.5, rFar: 9, bloom: 0.6, thr: 1.0, vig: 0.5, flash: 1 - seg(t, C.reply - 0.1, C.reply + 0.7, ease.out) } };
    } },
    { name: 'home', start: C.home, end: C.end + 1, draw(t) {
      night(); noMotes();
      const k = seg(t, C.home, C.end, ease.inOutSine), lean = seg(t, C.home + 0.5, C.home + 2.4, ease.inOut);
      setCam(cam, [lerp(13.2, 16.5, k), lerp(12.6, 14.6, k), lerp(22, 30, k)], [lerp(2.6, 0.2, k), lerp(9.2, 8.6, k), 0], 32);
      R.set(t, { night: 1, tower: 0.75 + 0.2 * Math.sin((t - C.home) * 2.2), screenGain: 0.95, screenLight: 2.5, lean: 0.13 * lean, headTilt: 0.14 * lean, headNod: -0.1 * lean });
      R.screen.draw({ t, typed: PROMPT.length, sent: 1, think: 0, lines: [1, 1, 1, 1] });
      const cp = scrPt(COL_X + (R.screen.poemW[3] || 720) + 46, POEM_Y + 3 * POEM_LH - 4, 0.22);
      spark.update(t, cam, { pos: V3(cp.x, cp.y + Math.sin(t * 2.4) * 0.012, cp.z), size: 0.15, look: [0.3, 0], open: 1, happy: 0.4, light: 0.6, lightDist: 6, orbit: 0.3 });
      return { scene: R.scene, camera: cam, post: { ...POST, focus: 24, range: 26, flat: 7, bloom: 0.95, fade: seg(t, C.fadeOut, C.end - 0.15, ease.inOutSine), lift: [0.006, 0.02, 0.04] } };
    } },
  ];
}
