// The full soundtrack: original 160 BPM surf-rock score in F# + frame-locked Foley.
import { makeEngine } from './engine.js';
import { C, MUSIC, bar, beat } from '../timeline.js';
import { ROCKETS, BURSTS, CITY } from '../shots/act2c.js';
import { DOM_N } from '../shots/act2b.js';
import { BEAT } from '../core.js';
import { discLandTimes } from '../shots/act2c.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const A = makeEngine(ctx);
  music(A);
  foley(A);
  // smash cuts: everything (incl. reverb tails) drops out
  const g = A.buses.master.gain;
  const cut = (t, back) => { g.setValueAtTime(0.9, t - 0.015); g.linearRampToValueAtTime(0.0001, t); g.setValueAtTime(0.0001, back - 0.01); g.linearRampToValueAtTime(0.9, back); };
  cut(C.sunrise - 0.01, C.sunrise + 0.05);
  // final fade
  g.setValueAtTime(0.9, C.end - 0.4); g.linearRampToValueAtTime(0.0001, C.end - 0.02);
  return ctx.startRendering();
}

// ---------------------------------------------------------------- music
const RIFF = {
  F: [54, 54, 57, 54, 59, 54, 60, 59],
  F2: [57, 54, 52, 54, null, 54, 57, 61],
  A: [57, 57, 60, 57, 62, 57, 63, 62],
  B: [59, 59, 62, 59, 64, 59, 65, 64],
  Cs: [61, 61, 64, 61, 66, 61, 67, 66],
};
const ROOT = { F: 42, F2: 42, A: 45, B: 47, Cs: 49 };
const F7 = [54, 58, 61, 64];

function music(A) {
  const { drums: D, inst: I } = A;
  // one bar of the surf groove. o.until cuts the bar short (absolute time)
  const groove = (n, chord, o = {}) => {
    const t0 = bar(n);
    const riff = RIFF[chord], R0 = ROOT[chord];
    for (let i = 0; i < 8; i++) {
      const t = t0 + i * E8;
      if (o.until !== undefined && t >= o.until) break;
      if (!o.noDrums) {
        if (i === 0 || i === 3 || i === 4) D.kick(t, (i === 0 ? 1 : 0.8) * (o.soft ? 0.6 : 1));
        if ((i === 2 || i === 6) && !o.noSnare) D.snare(t, 0.9 * (o.soft ? 0.6 : 1));
        D.hat(t, i % 2 ? 0.6 : 0.9, o.openHat && i === 7);
        if (o.sixteenths) D.hat(t + S16, 0.45);
      }
      const bn = [R0, R0, R0 + 12, R0, R0 + 7, R0, R0 + 12, R0 + 10][i];
      if (!o.noBass) I.bass(t, bn, E8 * 0.8, 0.95 * (o.soft ? 0.7 : 1));
      const m = riff[i];
      if (m && !o.noGtr) {
        if (o.trem) { I.gtr(t, m + 12, S16 * 0.8, 0.7, 0.2); I.gtr(t + S16, m + 12, S16 * 0.8, 0.55, 0.2); }
        else I.gtr(t, m, E8 * (i % 2 ? 0.6 : 0.85), (i === 0 ? 1 : 0.8) * (o.soft ? 0.7 : 1), 0.5);
      }
    }
    if (o.fill) [175, 150, 125, 105].forEach((f, k) => D.tom(bar(n) + 3 * BEAT + k * S16, f, 0.8, -0.3 + k * 0.2));
  };
  const hit = (t, chord = F7, crash = true, dur = 0.3) => { D.kick(t, 1); if (crash) D.crash(t, 0.9); I.stab(t, chord, dur, 1); I.bass(t, chord[0] - 12, dur, 1); };
  const roll = (t0, beats, v0 = 0.45) => { const n = Math.round(beats * 4); for (let k = 0; k < n; k++) D.snare(t0 + k * S16, v0 + k / n * 0.5); };
  const tremolo = (t0, t1, m, v = 0.4) => { for (let t = t0; t < t1; t += S16) I.gtr(t, m, S16 * 0.8, v, 0.2); };

  // ACT I: ominous swell under the status line, then the riser
  I.pad(C.enterTask + 0.1, [42, 49, 54, 57], 1.2, 0.9, 900);
  I.pad(C.bootShot, [42, 49, 54, 57, 61], C.burst - C.bootShot + 0.3, 1.2, 1600);

  // ---- bars 1-3: reveal
  hit(bar(1));
  hit(beat(1, 2), F7, false, 0.2);
  hit(beat(1, 3), [56, 60, 63, 66], false, 0.2);
  D.snare(beat(1, 4), 0.8); D.snare(beat(1, 4) + E8, 0.9);
  groove(2, 'F', { openHat: true });
  groove(3, 'F2', { fill: true });

  // ---- bars 4-10: stunt 1, The Clean Sweep
  hit(bar(4)); groove(4, 'F');
  groove(5, 'F2');
  groove(6, 'A', { soft: true });                         // climbing the lamp
  groove(7, 'B', { until: C.s1Leap });                    // wind-up...
  roll(C.s1Leap, 2, 0.5);                                 // ...and swing
  hit(C.s1Hit, F7, true, 0.6); groove(8, 'F', { noGtr: true });
  groove(9, 'F2');
  groove(10, 'A', { until: C.s1Duck });
  // the duck cutaway: everything drops to a lonely bass note + hat
  I.bass(C.s1Duck, 45, BEAT * 2, 0.8); D.hat(C.s1Duck + BEAT, 0.5); D.hat(C.s1Duck + BEAT * 2, 0.5);
  roll(beat(10, 4), 1, 0.4);

  // ---- bars 11-17: stunt 2, Rewriting History
  hit(bar(11)); groove(11, 'F');
  groove(12, 'F2', { fill: true });
  groove(13, 'A', { noGtr: true, until: C.s2Charge });
  tremolo(bar(13), C.s2Charge, 69, 0.45);                 // revving
  roll(C.s2Charge, 1, 0.5);
  hit(C.s2Slam, F7, true, 0.25); groove(14, 'F', { sixteenths: true });
  groove(15, 'A', { sixteenths: true, until: C.s2Slam + 24 * S16 });
  // Sarah's domino teeters: the band stops; a thin tremolo holds its breath
  tremolo(C.s2Slam + 24 * S16 + 0.05, C.s2Last, 78, 0.22);
  hit(C.s2Last, [57, 61, 64, 67], true, 0.3); groove(16, 'B', { sixteenths: true });
  groove(17, 'F', { fill: true });

  // ---- bars 18-21: stunt 3, The Green Light (stop-time)
  hit(bar(18));
  for (let n = 18; n <= 19; n++) for (let k = n === 18 ? 1 : 0; k < 8; k++) { D.hat(bar(n) + k * E8, 0.4); if (k % 4 === 0) I.bass(bar(n) + k * E8, 42, E8 * 0.7, 0.6); }
  D.kick(bar(20), 0.9); D.hat(bar(20) + E8, 0.4);
  [C.chop1, C.chop2, C.chop3].forEach((t, i) => { D.kick(t, 1); D.snare(t, 1); I.stab(t, [54 + i * 2, 58 + i * 2, 61 + i * 2], 0.12, 1); });
  // fake fanfare (F# major, very proud of itself)
  [66, 70, 73, 78].forEach((m, k) => I.bell(C.green + k * S16, m, 1.0, 1.1, 0.2));
  I.stab(C.green + BEAT, [54, 58, 61, 66], 0.8, 1.1); D.crash(C.green + BEAT, 0.8); D.kick(C.green + BEAT, 1);
  [190, 160, 130, 110].forEach((f, k) => D.tom(beat(21, 4) + k * S16, f, 0.9));

  // ---- bars 22-28: stunt 4, The Drop
  hit(bar(22)); groove(22, 'F');
  groove(23, 'F2', { fill: true });
  groove(24, 'A', { noSnare: true });                     // waddle
  // at the edge: the band thins to a held breath
  I.bass(bar(25), 42, BEAT, 0.9); D.kick(bar(25), 0.8);
  I.pad(C.s4Pov, [42, 48, 54, 60], C.s4Jump - C.s4Pov + 0.1, 1.0, 1100);
  tremolo(C.s4Pov, C.s4Jump, 66, 0.3);
  I.stab(C.s4Jump, [61, 64, 67], 0.15, 0.7);              // ...jump. silence while falling
  hit(C.s4Boing, F7, true, 0.3);
  D.snare(C.s4Boing + E8, 0.8); D.snare(C.s4Boing + BEAT, 0.9); D.snare(C.s4Boing + BEAT + E8, 1);
  groove(27, 'B', { noGtr: true, until: C.s4Land });
  I.stab(C.s4Land, [59, 63, 66], 0.2, 0.9);
  groove(28, 'B', { fill: true });

  // ---- bars 29-35: finale
  hit(bar(29)); groove(29, 'F');
  groove(30, 'F2');
  groove(31, 'A', { trem: true, soft: true });            // lighting fuses
  I.stab(C.s5Launch, [57, 61, 64, 67], 0.3, 1); groove(32, 'F', { sixteenths: true });
  groove(33, 'A', { sixteenths: true });
  groove(34, 'B', { sixteenths: true, trem: true, until: beat(34, 3) });
  roll(beat(34, 3), 2, 0.5);
  const big = C.s5Big;
  D.kick(big, 1.2); D.crash(big, 1.2); D.crash(big + 0.02, 0.8);
  I.stab(big, [54, 58, 61, 64, 69], 1.4, 1.3, 0.45);
  I.bass(big, 30, 1.3, 1.2);
  for (let k = 0; k < 16; k++) I.gtr(big + k * S16, 66, S16 * 0.8, 0.8 * (1 - k / 18), 0.2);

  // ACT III: soft morning guitar
  [66, 69, 71, 73, 71, 69, 66, 64, 66].forEach((m, k) => I.clean(C.sunrise + 0.3 + k * BEAT * 0.9, m, BEAT * 1.4, 0.75));
  [42, 49, 54].forEach(m => I.clean(C.sunrise + 0.3, m, 3.0, 0.45, 0.2));
  // the developer's whistle
  [[74, 0.18], [76, 0.18], [78, 0.36], [74, 0.18], [71, 0.36], [74, 0.18], [76, 0.5]].reduce((t, [m, d]) => { I.whistle(t, m, d * 0.92); return t + d; }, C.doorOpen + 0.2);
  // proud little vamp while the summary streams in
  const vamp = C.summary + 0.15;
  for (let k = 0; k < 20; k++) {
    const t = vamp + k * BEAT;
    if (t > C.slip - 0.2) break;
    [54, 58, 61, 66].forEach((m, j) => I.clean(t + j * 0.03, m + (k % 4 === 3 ? 2 : 0), BEAT * 0.9, 0.32, 0.15));
  }
  [73, 78, 82, 85].forEach((m, k) => I.bell(C.summary + 6.45 + k * 0.06, m, 1.4, 0.8, 0.3));

  // EPILOGUE: music box
  const mb = [66, 70, 73, 70, 71, 70, 68, 66, 68, 70, 71, 73, 75, 73, 70, 73, 71, 70, 68, 66];
  mb.forEach((m, k) => I.musicbox(C.sandbox + 0.1 + k * 0.24, m + 12, 0.9));
  I.pad(C.sandbox, [54, 58, 61], C.card - C.sandbox, 0.6, 900);
  // end card stingers
  [54, 58, 61, 66, 68].forEach((m, k) => I.bell(C.card + k * 0.02, m + 12, 2.2, 0.9, (k - 2) * 0.2));
  D.kick(C.card + 0.35, 0.9); I.stab(C.card + 0.35, [54, 58, 61, 66], 0.5, 0.9); D.crash(C.card + 0.35, 0.6);
  I.pad(C.card + 0.4, [42, 54, 58, 61, 66], 4.5, 0.7, 1400);
  [66, 70, 73, 78].forEach((m, k) => I.musicbox(C.card + 2.4 + k * 0.3, m + 12, 0.6));
}

// ---------------------------------------------------------------- foley
const CMD = 'claude --dangerously-skip-permissions';
const TASK = 'clean up my machine and make the tests pass. going to bed';

function foley(A) {
  const { fx, R } = A;
  // ===== ACT I
  fx.roomTone(0.15, MUSIC - 0.1, 1);
  fx.hum(0.15, C.lampOff - 0.1, 1);
  for (let i = 0; i < CMD.length; i++) fx.key(C.typeCmd + i / 22 + (R() - 0.5) * 0.01, 0.7 + R() * 0.4, 0.1);
  fx.thunk(C.enterCmd, 1.2); fx.sub(C.enterCmd, 0.5, 70, 0.4); fx.whoosh(C.enterCmd - 0.2, 0.2, 0.6, 300, 2500);
  fx.sub(C.warnIn, 0.8, 60, 0.9); fx.zap(C.warnIn, 0.08, 0.6);
  A.inst.stab(C.warnIn, [42, 48, 54], 0.6, 0.8, 0.4);
  fx.key(C.warnDown, 1.2); fx.blip(C.warnDown + 0.01, 900, 0.8, 0.04);
  fx.thunk(C.warnEnter, 0.9); fx.blip(C.warnEnter + 0.02, 1500, 1, 0.05); fx.blip(C.warnEnter + 0.08, 1800, 1, 0.05);
  for (let i = 0; i < TASK.length; i++) fx.key(C.typeTask + i / 26 + (R() - 0.5) * 0.008, 0.55 + R() * 0.4, 0.1);
  fx.thunk(C.enterTask, 0.9);
  // lights out
  fx.click(C.lampOff - 0.02, 1.2, 2200); fx.click(C.lampOff + 0.015, 0.8, 1400);
  [0, 0.24, 0.48].forEach((d, i) => fx.step(C.wipe + d, 0.8 - i * 0.15, -0.5 - i * 0.2));
  fx.creak(C.doorShut - 0.45, 0.4, 0.6, 140, -0.7);
  fx.thud(C.doorShut, 0.9, -0.7); fx.click(C.doorShut + 0.02, 0.6, 1800, -0.7);
  [C.doorShut - 0.5, C.clockTick, C.clockTick + 0.5].forEach((t, i) => fx.tick(t, t === C.clockTick ? 1.6 : 0.9, i % 2 === 1));
  // eyes boot
  fx.blip(C.eyesOn, 660, 1.2, 0.07); fx.blip(C.eyesOn + 0.13, 880, 1.2, 0.05); fx.blip(C.eyesOn + 0.26, 1320, 1.4, 0.12);
  for (let t = C.crackle; t < C.burst; t += 0.09 + R() * 0.08) fx.zap(t, 0.06 + R() * 0.05, 0.9, (R() - 0.5));
  fx.sub(C.ring, 0.7, 120, 0.6); fx.whoosh(C.ring, 0.4, 0.7, 2500, 300);
  fx.riser(C.bootShot, C.flash1 - C.bootShot, 1.1);
  fx.reverse(C.burst - 0.1, 0.4, 1); fx.glass(C.burst, 1.1); fx.whoosh(C.burst, 0.3, 1.2, 300, 5000);

  // ===== ACT II
  fx.roomTone(MUSIC - 0.1, C.sunrise - MUSIC, 0.5);
  fx.thud(C.land, 1.3); fx.sub(C.land, 0.6, 90, 0.5);
  fx.click(C.lampOn, 1.4, 1600); fx.thunk(C.lampOn, 0.6); fx.whoosh(C.lampOn, 0.25, 0.7, 2000, 500);
  fx.sparkle(C.lampOn + 0.05, 1);
  fx.whoosh(C.signIn - 0.05, 0.3, 0.6, 500, 2500); fx.bell(C.signIn + 0.2, 0.5, 1568); fx.bell(C.signIn + 0.28, 0.5, 2093);
  [C.s1, C.s2, C.s3, C.s4, C.s5].forEach(t => { fx.swoosh(t, 1); fx.swoosh(t + 0.45, 0.6); });
  // stunt 1
  fx.creak(C.s1Climb + 0.1, 0.4, 0.8, 200); fx.creak(C.s1Climb + 0.5, 0.3, 0.7, 260);
  fx.sparkle(C.s1Climb + 0.3, 0.7);
  fx.whoosh(C.s1Climb + 0.95, 0.4, 0.6, 1500, 600);
  fx.creak(C.s1Wind + 0.05, 0.7, 1, 120);
  fx.whoosh(C.s1Leap, C.s1Hit - C.s1Leap, 1.4, 200, 3200);
  fx.boom(C.s1Hit, 1.3); fx.glass(C.s1Hit, 0.4); fx.thud(C.s1Hit + 0.03, 1);
  fx.paper(C.s1Hit, 3.0, 1.3);
  fx.whoosh(C.s1Out, 1.3, 0.25, 800, 400, 0.5);
  fx.pop(C.s1Out + 1.45, 1); fx.sparkle(C.s1Out + 1.75, 1);
  fx.paper(C.s1Duck + 0.1, 0.3, 0.6); fx.thud(C.s1Duck + 0.35, 0.15);
  // stunt 2
  for (let t = C.s2Rev; t < C.s2Charge; t += 0.045) fx.click(t, 0.35, 900 + R() * 400, -0.2);
  A.hiss(C.s2Rev, { dur: C.s2Charge - C.s2Rev, g: 0.08, f0: 300, f1: 900, q: 2, a: 0.8 });
  fx.whoosh(C.s2Charge, C.s2Slam - C.s2Charge, 1, 300, 2500);
  fx.boom(C.s2Slam, 0.9, 0.6); fx.domino(C.s2Slam, 1.4);
  for (let i = 1; i < DOM_N; i++) fx.domino(C.s2Slam + i * S16 + 0.04, 1 - i / 50, -0.6 + i / 18);
  const lh = C.s2Slam + (DOM_N - 1) * S16;
  for (let t = lh + 0.2; t < C.s2Last; t += 0.21) fx.creak(t, 0.08, 0.35, 700 + R() * 200, 0.4); // wobble
  fx.thud(C.s2Last + 0.3, 0.9, 0.5); fx.domino(C.s2Last + 0.3, 1.5, 0.6);
  A.hiss(C.s2Last + 0.45, { dur: 0.35, g: 0.18, f0: 2500, f1: 1200, q: 5, pan: 0.5 });
  fx.domino(C.s2Plant + 0.12, 1.6); fx.thud(C.s2Plant + 0.14, 0.3);
  [0.45, 0.62].forEach(d => fx.step(C.s2Plant + d, 0.4));
  fx.ching(C.s2Plant + 0.12, 0.5);
  // stunt 3
  for (let t = C.s3 + 0.05; t < C.chop3; t += 0.4) fx.blip(t, 1760, 0.7, 0.08, 0.3);
  [C.chop1, C.chop2, C.chop3].forEach((t, i) => { fx.whoosh(t - 0.15, 0.15, 0.8, 800, 4000); fx.glass(t, 1.1, -0.4 + i * 0.3); });
  fx.ching(C.green, 1); fx.sparkle(C.green + 0.1, 1.2); fx.sparkle(C.green + 0.6, 0.8);
  // stunt 4
  fx.creak(C.s4Run, 0.4, 0.8, 380);
  for (let k = 0; k < 6; k++) fx.step(C.s4Run + 0.5 + k * 0.17, 0.5);
  A.hiss(C.s4Run + 0.45, { dur: 1.0, g: 0.04, f0: 600, q: 3 });
  A.tone(C.s4Pov, { f0: 110, f1: 104, dur: C.s4Jump - C.s4Pov, g: 0.12, vib: 6, vibRate: 3 });
  fx.whoosh(C.s4Jump, 0.3, 0.8, 500, 2000);
  fx.whistleDown(C.s4Jump + 0.15, C.s4Boing - C.s4Jump - 0.15, 1);
  discLandTimes.forEach((t, i) => fx.clang(t, 1 - i * 0.12, 0.4));
  A.hiss(C.s4Boing - 0.35, { dur: 0.35, g: 0.12, f0: 900, q: 2, a: 0.3 });
  fx.boing(C.s4Boing, 1.2); fx.creak(C.s4Boing, 0.4, 0.8, 90);
  fx.whoosh(C.s4Boing + 0.05, 0.6, 0.8, 300, 1800);
  fx.thud(C.s4Land, 1); fx.sparkle(C.s4Land + 0.2, 0.8);
  // finale
  fx.creak(C.s5 + 0.2, 0.45, 0.9, 220); fx.city(C.s5 + 0.3, C.s5End - C.s5 - 0.3, 1);
  A.hiss(C.s5Fuse + 0.15, { dur: 1.1, g: 0.09, type: 'highpass', f0: 6000, sustain: 1, a: 0.05, rel: 0.1 });
  fx.crackle(C.s5Fuse + 0.15, 1.1, 70, 0.6, 7000);
  ROCKETS.forEach((r, i) => fx.whistleUp(r.launch, 0.42, 0.9, -0.3 + i * 0.08));
  BURSTS.forEach(b => fx.burst(b.at, 0.8, (b.x - 101) / 40, b.shape === 'dollar' ? 1.1 : 0.9));
  CITY.forEach(c => fx.pop(c.at + 0.45, 0.22 + R() * 0.2, (c.x - 101) / 40));
  fx.ching(C.s5Meter, 0.9);
  for (let t = C.s5Meter + 0.1; t < C.s5Meter + 2.5; t += 0.035) fx.click(t, 0.18, 3500 + (t - C.s5Meter) * 600, 0.6);
  fx.ching(C.s5Meter + 2.5, 1.1);
  fx.whistleUp(C.s5Big - 0.42, 0.42, 1.2, 0);
  fx.burst(C.s5Big, 1.4, 0, 1.6); fx.boom(C.s5Big, 1.2, 1.6);

  // ===== ACT III
  fx.roomTone(C.sunrise + 0.05, C.nextNight - C.sunrise, 0.6);
  fx.birds(C.sunrise + 0.1, 2.9, 1);
  fx.click(C.doorOpen - 0.1, 0.8, 1500, -0.7); fx.creak(C.doorOpen, 0.6, 0.8, 180, -0.7);
  [0.35, 0.75, 1.15].forEach((d, i) => fx.step(C.doorOpen + d, 0.7, -0.6 + i * 0.25));
  for (let i = 0; i < 8; i++) for (let t = C.summary + 0.15 + i * 0.82; t < C.summary + 0.15 + i * 0.82 + 0.45; t += 0.05) fx.click(t, 0.12, 4200 + R() * 800, 0.1);
  fx.pop(C.summary + 6.45, 1, 0.3); fx.boing(C.summary + 6.47, 0.3);
  fx.scratch(C.slip, 1.2);
  A.buses.music.gain.setValueAtTime(0.62, C.slip - 0.01); A.buses.music.gain.linearRampToValueAtTime(0.0001, C.slip + 0.03);
  A.buses.music.gain.setValueAtTime(0.0001, C.sandbox - 0.05); A.buses.music.gain.linearRampToValueAtTime(0.62, C.sandbox + 0.05);
  fx.whoosh(C.slip + 0.35, 0.9, 0.4, 300, 150);
  fx.smash(C.shatter, 1.3);
  [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].forEach((d, i) => fx.tick(C.react + d, 0.8, i % 2 === 1));
  fx.drip(C.react + 1.55, 0.6);
  fx.squeak(C.squeak, 1.1, 0.2);

  // ===== EPILOGUE
  fx.bell(C.nextNight + 0.05, 0.5, 1397);
  fx.crickets(C.sandbox, C.card - C.sandbox, 1);
  fx.roomTone(C.sandbox, C.card - C.sandbox, 0.4);
  [1.0, 2.0, 3.0].forEach(d => { const t = C.sandbox + d; fx.whoosh(t - 0.3, 0.3, 0.4, 600, 2000); fx.fwump(t, 0.9); fx.pop(t + 0.02, 0.3); });
  fx.squeak(C.end - 0.8, 0.9, 0.1);
}

// 16-bit PCM WAV
export function toWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length;
  const out = new Uint8Array(44 + n * ch * 2);
  const v = new DataView(out.buffer);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return out;
}
