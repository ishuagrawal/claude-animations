// The soundtrack: an original instrumental anime-rock anthem (144 BPM, D minor → D major at the
// payoff, like the reference's driving pop-rock opening but no vocals and no borrowed melody),
// plus Foley for every on-screen action. Everything is scheduled from the cue sheet.
import { makeEngine, mtof } from './engine.js';
import { C, MUSIC, bar, beat } from '../timeline.js';
import { BEAT } from '../core.js';
import { FIREWORKS } from '../shots/act3.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const A = makeEngine(ctx);
  music(A);
  foley(A);
  // smash to silence on the final black
  const g = A.buses.master.gain;
  g.setValueAtTime(0.9, C.black - 0.01); g.linearRampToValueAtTime(0.0001, C.black + 0.02);
  return ctx.startRendering();
}

// ------------------------------------------------------------------ harmony
// chord = [bass root (MIDI), power-chord root (MIDI), triad for stabs/pads]
const CH = {
  Dm: [38, 50, [62, 65, 69]], Bb: [46, 46, [58, 62, 65]], C: [36, 48, [60, 64, 67]], F: [41, 53, [57, 60, 65]],
  Gm: [43, 55, [55, 58, 62]], A: [45, 57, [57, 61, 64]], D: [38, 50, [62, 66, 69]], Eb: [39, 51, [55, 58, 63]],
};

// rock groove for one bar: kick 1, &2, 3 · snare 2, 4 · 8th hats · 8th bass · power-chord chugs
function groove(A, n, chord, o = {}) {
  const { drums: D, inst: I } = A;
  const [bass, pr] = CH[chord];
  const v = o.v ?? 1;
  for (let i = 0; i < 8; i++) {
    const t = bar(n) + i * E8;
    if (!o.noDrums) {
      if (i === 0 || i === 3 || i === 4 || (o.drive && i === 7)) D.kick(t, (i ? 0.8 : 1) * v);
      if (i === 2 || i === 6) D.snare(t, 0.9 * v);
      D.hat(t, (i % 2 ? 0.55 : 0.85) * v, o.open && i % 2 === 1);
      if (o.sixteenth) D.hat(t + S16, 0.4 * v);
    }
    if (!o.noBass) I.bass(t, bass + (o.walk && i === 7 ? 7 : 0), E8 * 0.85, 0.95 * v);
    if (!o.noGtr) I.power(t, pr, E8 * (o.sustain ? 3.6 : 0.8), 0.6 * v, o.sustain ? 0.2 : 0.65);
  }
  if (o.crash) D.crash(bar(n), o.crash);
}
const fill = (A, n, from = 3) => { // tom/snare fill over the end of bar n
  for (let k = 0; k < (5 - from) * 4; k++) {
    const t = beat(n, from) + k * S16;
    if (k % 4 < 2) A.drums.tom(t, 180 - k * 6, 0.7 + k * 0.02); else A.drums.snare(t, 0.5 + k * 0.03);
  }
};
const roll = (A, t0, dur, v0 = 0.3, v1 = 1) => { const n = Math.floor(dur / S16); for (let k = 0; k < n; k++) A.drums.snare(t0 + k * S16, v0 + (v1 - v0) * k / n); };

// the hook (original): [MIDI, start beat, length beats]
const HOOK = [
  [69, 0, 0.5], [74, 0.5, 1], [76, 1.5, 0.5], [77, 2, 1], [76, 3, 0.5], [74, 3.5, 0.5],
  [72, 4, 1], [70, 5, 1], [69, 6, 1.5], [65, 7.5, 0.5],
  [69, 8, 0.5], [72, 8.5, 1], [74, 9.5, 0.5], [77, 10, 1.5], [76, 11.5, 0.5],
  [74, 12, 1], [72, 13, 0.5], [74, 13.5, 2.5],
];
function hook(A, t0, beats = 16, transpose = 0, v = 1) {
  for (const [m, b, l] of HOOK) if (b < beats) A.inst.lead(t0 + b * BEAT, m + transpose, Math.min(l, beats - b) * BEAT * 0.95, v, b === 0 ? -2 : 0);
}

// ------------------------------------------------------------------ the arrangement
function music(A) {
  const { drums: D, inst: I, fx } = A;
  // ---- intro (cosmos): pad swell, arpeggio shimmer, riser into the boot
  I.pad(0, [50, 57, 62, 65], bar(3) - 0.2, 0.9, 1400);
  for (let k = 0; k < 16; k++) I.bell(MUSIC + k * E8, [62, 65, 69, 74][k % 4] + (k > 7 ? 12 : 0), 0.9, 0.35 + k * 0.02, (k % 2 ? 0.3 : -0.3));
  fx.riser(bar(2), bar(3) - bar(2), 0.7);
  D.tom(beat(2, 3), 150, 0.6); D.tom(beat(2, 3.5), 130, 0.7); D.tom(beat(2, 4), 110, 0.8); D.tom(beat(2, 4.5), 95, 0.9);
  // ---- boot: half-time pulse on D, the sprite blips over it
  for (let i = 0; i < 4; i++) { D.kick(beat(3, 1 + i), i === 0 ? 1 : 0.6); I.bass(beat(3, 1 + i), 38, BEAT * 0.8, 0.8); }
  D.snare(beat(3, 3), 0.6); roll(A, beat(3, 3.5), BEAT * 1.5, 0.2, 0.9);
  // ---- burst → verse (bars 4–6): full band
  D.kick(C.burst, 1.3); D.crash(C.burst, 1.2); I.stab(C.burst, CH.Dm[2], 0.4, 1.2);
  groove(A, 4, 'Dm', { crash: 0 }); groove(A, 5, 'Bb', { sustain: true }); groove(A, 6, 'C', { drive: true });
  // the dream line over the eyes reveal
  [[69, 0, 2], [74, 2, 2], [77, 4, 1.5], [76, 5.5, 0.5], [81, 6, 2]].forEach(([m, b, l]) => I.lead(C.eyes + b * BEAT, m, l * BEAT * 0.95, 0.9));
  // ---- the dream (bar 7): band thins, hollow bells; the board (bar 8): tension hits
  I.pad(bar(7), [50, 57, 62, 69], BAR2(), 1, 1000);
  for (let k = 0; k < 8; k++) I.bell(bar(7) + k * E8, [74, 69, 65, 62][k % 4], 1.2, 0.4, 0, 0.6);
  D.kick(bar(7), 0.8); D.kick(beat(7, 3), 0.6);
  for (let i = 0; i < 4; i++) { I.stab(beat(8, 1 + i), [50, 53, 56], 0.18, 0.8 + i * 0.1); D.kick(beat(8, 1 + i), 0.7); I.bass(beat(8, 1 + i), 38, BEAT * 0.5, 0.9); }
  roll(A, beat(8, 3), BEAT * 2, 0.3, 1);
  // ---- parade (bars 9–13): one bar per creature, stab + crash on each entrance, lead motif
  const parade = ['Dm', 'Bb', 'F', 'C', 'Gm'];
  parade.forEach((ch, i) => {
    groove(A, 9 + i, ch, { crash: i === 0 ? 1.1 : 0.6, sixteenth: i >= 3 });
    I.stab(bar(9 + i), CH[ch][2], 0.22, 1);
    const top = CH[ch][2].map(m => m + 12);
    [[0, 0.5], [1, 0.5], [2, 1], [1, 0.5]].forEach(([n, b], k) => I.lead(beat(9 + i, 2.5 + k * 0.5), top[n], E8 * 0.9, 0.8));
  });
  // ---- bug gang (bars 14–15): villain riff (chromatic, palm-muted), thunder
  const vill = [38, 38, 39, 38, 37, 38, 41, 40];
  for (let n = 14; n <= 15; n++) for (let i = 0; i < 8; i++) {
    const t = bar(n) + i * E8;
    I.bass(t, vill[i], E8 * 0.8, 1); I.power(t, vill[i] + 12, E8 * 0.7, 0.7, 0.8);
    if (i % 2 === 0) D.kick(t, 0.9); if (i === 2 || i === 6) D.snare(t, 0.9);
    D.hat(t, 0.5);
  }
  I.stab(C.gang, [50, 53, 56, 59], 0.5, 1.2); D.crash(C.gang, 0.9);
  // ---- the gag (bars 16–17): stop-time comedy
  I.bass(bar(16), 38, E8, 0.8); D.kick(bar(16), 0.7);
  for (let i = 0; i < 3; i++) I.gtr(beat(16, 1.5 + i * 0.25), 74 - i * 2, 0.08, 0.5, 0.9); // tiptoe plucks
  D.kick(C.faceplant, 1); I.stab(C.faceplant, [49, 52, 55], 0.3, 0.9);
  I.bass(beat(17, 1), 38, BEAT * 0.4, 0.7); I.bass(beat(17, 1.5), 37, BEAT * 0.4, 0.7);
  I.bass(C.flakyBack, 36, BEAT * 0.5, 0.8); D.kick(C.flakyBack, 0.6);
  D.tom(C.flakyBlink, 170, 0.9); D.tom(C.flakyBlink + E8, 130, 0.9); D.snare(C.flakyBlink + BEAT, 0.7); D.crash(C.flakyBlink + BEAT, 0.5); // ba-dum-tss
  // ---- the throw (bar 18): build — snare roll, riser, toms on the release
  roll(A, bar(18), BEAT * 2, 0.25, 0.9);
  for (let i = 0; i < 4; i++) { D.kick(beat(18, 1 + i), 0.8 + i * 0.1); I.bass(beat(18, 1 + i), 45, BEAT * 0.9, 1); I.power(beat(18, 1 + i), 57, BEAT * 0.9, 0.7, 0.3); }
  fx.riser(bar(18), BAR2() / 2, 0.8);
  D.tom(C.release, 160, 1); D.tom(C.release + S16, 140, 1); D.tom(C.tokenCam, 120, 1); D.tom(C.tokenCam + E8, 100, 1);
  // ---- chorus (bars 19–21): subagents + panels, the hook
  D.crash(C.split, 1.3); D.kick(C.split, 1.3); I.stab(C.split, CH.Dm[2].map(m => m + 12), 0.5, 1.2);
  groove(A, 19, 'Dm', { open: true }); groove(A, 20, 'Bb', { sixteenth: true }); groove(A, 21, 'C', { sixteenth: true, drive: true });
  hook(A, bar(19), 12);
  // ---- Bash (bars 22–25): heavy groove → stop-time at the prompt → warm hug
  groove(A, 22, 'Gm', { crash: 0.8, drive: true });
  // the prompt: band stops dead on beat 3; held pad + ticking hat while the viewer reads
  I.pad(C.prompt, [55, 58, 62, 67], C.fizzle - C.prompt, 1.1, 1600);
  for (let t = C.prompt + E8; t < C.fizzle; t += E8) D.hat(t, 0.35);
  for (let i = 0; i < 4; i++) I.bass(beat(23, 1 + i), 43, BEAT * 0.3, 0.6);
  I.stab(C.promptNo, [55, 58, 62], 0.15, 0.7); I.stab(C.promptNo + E8, [55, 58, 62], 0.15, 0.8);
  // fizzle → sad descending pluck; the hug: clean guitar + music box in B♭ major
  [74, 72, 70, 69].forEach((m, i) => I.clean(C.fizzle + 0.15 + i * E8, m, 0.3, 0.7));
  const hugArp = [58, 62, 65, 70, 65, 62, 58, 62, 60, 64, 67, 72, 67, 64, 60, 64];
  hugArp.forEach((m, i) => { const t = C.pat + i * E8; if (t < bar(26) - 0.1) I.clean(t, m, 0.45, 0.8); });
  [82, 81, 77, 74, 77].forEach((m, i) => I.musicbox(C.hug + i * BEAT * 0.75, m, 0.9));
  I.pad(C.pat, [46, 53, 58, 62], bar(26) - C.pat, 1, 1200);
  for (let i = 0; i < 6; i++) D.kick(C.hug + i * BEAT, 0.45);
  // ---- the beast (bar 26): villain riff, heavier
  for (let i = 0; i < 8; i++) { const t = bar(26) + i * E8; I.bass(t, vill[i], E8 * 0.8, 1.1); I.power(t, vill[i] + 12, E8 * 0.7, 0.85, 0.85); if (i % 2 === 0) D.kick(t, 1); if (i === 2 || i === 6) D.snare(t, 1); D.hat(t, 0.6); }
  D.crash(C.beast, 1.1); I.stab(C.beast, [50, 53, 56, 59], 0.6, 1.3);
  // ---- the snip (bars 27–28): build then D MAJOR resolution
  groove(A, 27, 'A', { sixteenth: true });
  roll(A, beat(27, 3), BEAT * 2, 0.3, 1);
  D.crash(C.merged, 1.2); D.kick(C.merged, 1.2); I.stab(C.merged, CH.D[2].map(m => m + 12), 0.8, 1.2);
  I.pad(C.merged, [50, 57, 62, 66, 69], BAR2() / 2, 1.2, 1800);
  [74, 78, 81, 86].forEach((m, i) => I.bell(C.merged + i * 0.09, m, 1.6, 0.8));
  for (let i = 0; i < 8; i++) { D.hat(bar(28) + i * E8, 0.5); if (i % 2 === 0) I.bass(bar(28) + i * E8, 38, E8 * 1.6, 0.9); }
  D.snare(beat(28, 4), 0.8); D.snare(beat(28, 4.5), 0.9);
  // ---- team + road (bars 29–31): the anthem in full, hook in the major lift
  groove(A, 29, 'Bb', { crash: 1.2, sixteenth: true }); groove(A, 30, 'F', { crash: 0.7 }); groove(A, 31, 'C', { drive: true });
  I.stab(C.team, CH.Bb[2].map(m => m + 12), 0.4, 1.1);
  hook(A, beat(29, 1), 12, 0, 1);
  fill(A, 31, 3);
  // ---- finale (bars 32–33): build to the flip, then the big release
  for (let i = 0; i < 2; i++) { D.kick(beat(32, 1 + i), 1); I.bass(beat(32, 1 + i), 45, BEAT * 0.9, 1); I.power(beat(32, 1 + i), 57, BEAT * 0.9, 0.8, 0.3); }
  roll(A, beat(32, 2), BEAT, 0.4, 1);
  D.crash(C.flip, 1.4); D.kick(C.flip, 1.4); I.stab(C.flip, CH.D[2].map(m => m + 12), 0.6, 1.3);
  for (let i = 0; i < 4; i++) { const t = C.flip + i * E8; I.power(t, 50, E8 * 0.9, 0.8, 0.3); I.bass(t, 38, E8 * 0.9, 1); D.hat(t, 0.7); }
  groove(A, 33, 'D', { crash: 1.2, sixteenth: true, open: true });
  [[81, 0, 1.5], [78, 1.5, 0.5], [76, 2, 1], [74, 3, 1]].forEach(([m, b, l]) => I.lead(bar(33) + b * BEAT, m, l * BEAT * 0.95, 1));
  // ---- final throw (bar 34): the last build
  roll(A, bar(34), BEAT * 2.5, 0.3, 1.1);
  for (let i = 0; i < 4; i++) { D.kick(beat(34, 1 + i), 1); I.bass(beat(34, 1 + i), 45, BEAT * 0.9, 1); I.power(beat(34, 1 + i), 57, BEAT * 0.95, 0.85, 0.25); }
  fx.riser(bar(34), C.flash2 - bar(34), 1);
  // ---- logo (bars 35–36): the final chord rings out with bells
  D.kick(C.logo, 1.5); D.crash(C.logo, 1.5); I.stab(C.logo, [62, 66, 69, 74], 1.6, 1.4, 0.5);
  I.power(C.logo, 50, 2.6, 1, 0.05); I.bass(C.logo, 38, 2.6, 1.1);
  I.lead(C.logo, 81, BEAT * 3.6, 1);
  I.pad(C.logo, [50, 57, 62, 66, 69, 74], C.button - C.logo + 0.5, 1.3, 2400);
  [74, 78, 81, 86, 90].forEach((m, i) => I.bell(C.ribbon + i * 0.08, m, 2.2, 0.9, (i - 2) * 0.2));
  D.crash(C.ribbon, 0.8);
}
const BAR2 = () => BEAT * 8;

// ------------------------------------------------------------------ foley
function foley(A) {
  const { fx, inst: I, drums: D, tone, hiss, R } = A;
  fx.roomTone(0, C.end, 0.7);
  // cosmos: node chimes, the comet, the dive
  for (let i = 0; i < 12; i++) fx.sparkle(0.1 + i * 0.1 + 0.05, 0.35);
  fx.whoosh(C.comet - 0.15, 0.9, 0.9, 300, 4000, -0.5);
  fx.whoosh(C.boot - 0.6, 0.6, 1.1, 200, 2500);
  // boot: CRT power-on, typing, sprite blips, the bulge
  fx.thunk(C.boot, 0.6); tone(C.boot, { type: 'sine', f0: 15000, dur: 1.5, g: 0.012, a: 0.05 }); fx.hum(C.boot, C.burst - C.boot, 1.2);
  for (let i = 0; i < 25; i++) fx.key(C.boot + 0.05 + i / 40, 0.5, 0.1);
  for (let i = 0; i < 12; i++) I.chip(C.sprite + i * 0.046, 62 + (i * 5) % 24, 0.04, 0.8);
  I.chip(C.spriteLook, 74, 0.05, 1); I.chip(C.spriteLook + 0.07, 79, 0.05, 1);
  for (let i = 0; i < 3; i++) I.chip(C.spriteLook + 0.2 + i * 0.208, 67 + i * 2, 0.05, 0.8);
  tone(C.burst - 0.42, { type: 'sawtooth', f0: 200, f1: 1600, dur: 0.42, g: 0.05, curve: 'exp', filter: ['lowpass', 3000] });
  // burst: boom + shatter of pixels
  fx.boom(C.burst, 1.1); fx.glass(C.burst + 0.02, 0.9); fx.sparkle(C.burst + 0.1, 0.8);
  // eyes: the glint
  fx.ching(C.eyesOpen + 0.05, 0.8); fx.whoosh(C.eyes, 1.2, 0.4, 600, 2000, 0.3);
  // cliff: wind + birds
  hiss(C.cliff, { dur: C.dream - C.cliff, g: 0.08, type: 'bandpass', f0: 700, q: 0.5, a: 0.4, sustain: 1, rel: 0.3, dest: A.buses.amb });
  fx.birds(C.cliff, C.dream - C.cliff, 0.8);
  // dream: lights switch on; board: error buzzer
  fx.clang(C.dream, 0.4); fx.thunk(C.dream + 0.05, 0.8);
  tone(C.board, { type: 'square', f0: 110, dur: 0.5, g: 0.05, filter: ['lowpass', 900] }); tone(C.board + 0.5, { type: 'square', f0: 98, dur: 0.6, g: 0.05, filter: ['lowpass', 900] });
  // parade: whoosh-in + stamp slam + each creature's voice
  ['pRead', 'pFetch', 'pEdit', 'pWrite', 'pBash'].forEach((k, i) => { fx.swoosh(C[k], 0.9); fx.thud(C[k] + 0.08, 0.6); fx.whoosh(C[k] + 0.2, 0.25, 0.4, 1500, 5000); });
  tone(C.pRead + BEAT * 2, { f0: 520, f1: 470, dur: 0.22, g: 0.12, rev: 0.3 }); tone(C.pRead + BEAT * 2.6, { f0: 470, f1: 420, dur: 0.35, g: 0.12, rev: 0.3 }); // hoo-hoo
  fx.paper(C.pRead + 0.4, 0.4, 0.5);
  for (let i = 0; i < 2; i++) { hiss(C.pFetch + 0.5 + i * 0.35, { dur: 0.09, g: 0.4, type: 'bandpass', f0: 900, q: 1.2 }); tone(C.pFetch + 0.5 + i * 0.35, { type: 'sawtooth', f0: 420, f1: 260, dur: 0.1, g: 0.12, filter: ['lowpass', 2000] }); } // woof woof
  for (let i = 0; i < 6; i++) fx.step(C.pFetch + i * E8 * 1.2, 0.4, 0.2);
  for (let b = 1; b < 4; b += 2) fx.shing(beat(13 - 2, 1 + b), 0.8);
  fx.scratch(C.pWrite + 0.3, 0.3); fx.paper(C.pWrite + 0.25, 1.1, 0.5);
  fx.flame(C.pBash + BEAT, BEAT * 1.2, 0.9); fx.growl(C.pBash + BEAT * 0.8, 0.5, 0.6, 90);
  // gang: thunder, label slams, the bonk, moth flicker
  fx.thunder(C.gang, 1); fx.thunder(C.gBonk, 0.6, -0.4);
  [C.gOff, C.gRace, C.gFlaky].forEach(t => { fx.thud(t, 0.7); fx.swoosh(t, 0.5); });
  fx.boing(C.gBonk, 0.9); fx.clang(C.gBonk, 0.5);
  for (let i = 0; i < 5; i++) fx.zap(C.gFlaky + 0.25 + i * 0.42, 0.05, 0.4, 0.5);
  // gag
  for (let i = 0; i < 6; i++) fx.step(C.gag + i * 0.14, 0.25, -0.3);
  fx.whistleUp(C.pounce, C.faceplant - C.pounce, 0.8, 0.2); fx.whoosh(C.pounce, 0.4, 0.6);
  fx.zap(C.vanish - 0.08, 0.15, 0.7, 0.4);
  fx.thud(C.faceplant, 1.1); fx.fwump(C.faceplant + 0.02, 0.8);
  fx.zap(C.flakyBack, 0.12, 0.5, 0.2); fx.squeak(C.flakyBlink, 0.7); fx.pop(C.flakyBlink + 0.05, 0.6);
  // throw
  fx.whoosh(C.windup, 0.5, 0.5, 300, 1200); fx.ching(C.windup + BEAT * 1.1, 0.7);
  fx.whoosh(C.release - 0.1, 0.35, 1.1, 400, 5000); fx.whoosh(C.tokenCam, C.split - C.tokenCam, 1.2, 200, 3000);
  // split: burst + five pops (subagents)
  fx.boom(C.split, 0.9); fx.sparkle(C.split + 0.05, 0.8);
  for (let i = 0; i < 5; i++) fx.pop(C.fan + i * 0.05, 0.7, (i - 2) * 0.35);
  fx.thud(C.fan + 0.1, 0.5);
  // panels: slams + check chimes rising
  C.panelIn.forEach((t, i) => { fx.swoosh(t, 0.6); fx.thud(t + 0.03, 0.4); });
  C.checks.forEach((t, i) => { I.bell(t, 79 + i * 2, 0.6, 0.8, (i - 2) * 0.3, 0.3, A.buses.sfx); fx.click(t, 0.4, 3000); });
  // Bash
  fx.growl(C.dragon, 0.7, 0.8, 70, -0.3);
  fx.reverse(C.inhale - 0.1, 0.35, 0.7);
  fx.flame(C.inhale, C.fizzle - C.inhale, 0.9);
  fx.thunk(C.prompt, 0.8); I.bell(C.prompt + 0.05, 86, 0.4, 0.5, 0.2, 0.2, A.buses.sfx);
  fx.key(C.promptNo, 0.9); fx.key(C.promptNo + E8, 0.9);
  for (let t = C.prompt + 0.2; t < C.fizzle; t += 0.5) fx.crackle(t, 0.3, 20, 0.4, 3000, -0.2); // fire against the prompt
  fx.fizzle(C.fizzle, 1);
  [0, 0.2, 0.4].forEach(d => fx.pop(C.pat + d, 0.4));
  fx.squeak(C.hug, 0.5); fx.sparkle(C.hug + 0.1, 0.6);
  // beast
  fx.thunder(C.beast, 1); fx.growl(C.roar, 1.2, 1.1, 60, -0.4); fx.growl(C.roar + 0.06, 1.2, 1.0, 85, 0.4);
  // snip
  fx.whoosh(C.snip, C.snipCut - C.snip, 0.8, 400, 3000); fx.shing(C.snipCut, 1.3); fx.whistleDown(C.snipCut + 0.1, 0.8, 0.6);
  fx.sparkle(C.merged, 0.9); fx.ching(C.mergedSmile, 0.6);
  // team: pops as they appear
  for (let i = 0; i < 4; i++) fx.pop(C.team + i * 0.06, 0.5, (i - 1.5) * 0.4);
  // road: footsteps
  for (let i = 0; i < 14; i++) fx.step(C.road + i * 0.24, 0.25, (i % 2 ? 0.2 : -0.2));
  hiss(C.road, { dur: C.finale - C.road, g: 0.05, type: 'bandpass', f0: 600, q: 0.5, a: 0.4, sustain: 1, rel: 0.3, dest: A.buses.amb });
  // finale: crowd + fireworks
  fx.crowd(C.finale, C.flip - C.finale, 0.5);
  fx.crowd(C.flip, C.throw2 - C.flip + 0.3, 1.2);
  FIREWORKS.forEach(([t, x], i) => { fx.whistleUp(t - 0.5, 0.45, 0.4, (x - 960) / 1200); fx.burst(t, 0.7, (x - 960) / 1200, 0.9); });
  // final throw + logo
  fx.whoosh(C.throw2, 0.5, 0.5, 300, 1200); fx.ching(C.throw2 + BEAT * 1.1, 0.7);
  fx.whoosh(C.release2 - 0.1, 0.35, 1.1, 400, 5000); fx.whoosh(C.release2 + 0.2, C.flash2 - C.release2, 1.2, 200, 3000);
  fx.boom(C.flash2, 1.2);
  fx.thud(C.logo, 1.0); fx.swoosh(C.ribbon, 0.8); fx.pop(C.ribbon + 0.4, 0.7, 0.5);
  // button: tiny bug footsteps, Claude's eyes slide, cut
  for (let t = C.bugIn; t < C.black - 0.05; t += 0.07) fx.tick(t, 0.7, (t * 10 | 0) % 2 === 0);
  I.chip(C.eyesSlide, 79, 0.05, 0.6); I.chip(C.eyesSlide + 0.06, 74, 0.05, 0.6);
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
