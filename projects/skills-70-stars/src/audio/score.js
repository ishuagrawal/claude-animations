// The soundtrack: an original score + Foley, synthesized offline from the cue sheet so it is sample-accurate to
// the picture. From the style bible: ~90 BPM (ref 91), C major, warm and bass-heavy, a percussive intro, a
// one-beat drop-out right before the big moment, a melodic layer that enters mid-film, and a hard stop for the end
// card. Here the band also changes instruments with each look (soft keys / chiptune / felt piano / synthwave).
import { makeEngine, mtof, MUSIC_GAIN } from './engine.js';
import { C, bar, beat } from '../timeline.js';
import { BEAT } from '../core.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const A = makeEngine(ctx);
  const I = instruments(A);
  music(A, I);
  foley(A, I);
  const g = A.buses.master.gain;
  g.setValueAtTime(0.9, Math.max(0, duration - 0.5)); g.linearRampToValueAtTime(0.0001, duration - 0.02);
  return ctx.startRendering();
}

// ------------------------------------------------------------- extra instruments (built from engine primitives)
function instruments(A) {
  const { tone, hiss } = A, M = A.buses.music;
  return {
    // electric piano: sine + soft 2nd + a short "tine" partial
    ep(t, m, dur = 0.6, v = 1, pan = 0) {
      tone(t, { f0: mtof(m), dur, g: 0.085 * v, a: 0.004, dest: M, pan, rev: 0.25 });
      tone(t, { f0: mtof(m) * 2, dur: dur * 0.5, g: 0.025 * v, a: 0.003, dest: M, pan, rev: 0.25 });
      tone(t, { f0: mtof(m) * 7.02, dur: 0.07, g: 0.012 * v, a: 0.001, dest: M, pan });
    },
    marimba(t, m, v = 1, pan = 0) {
      tone(t, { f0: mtof(m), dur: 0.42, g: 0.16 * v, a: 0.002, dest: M, pan, rev: 0.2 });
      tone(t, { f0: mtof(m) * 3.93, dur: 0.06, g: 0.05 * v, a: 0.001, dest: M, pan });
      tone(t, { type: 'triangle', f0: mtof(m) * 0.5, dur: 0.12, g: 0.05 * v, a: 0.002, dest: M, pan });
    },
    chip(t, m, dur = 0.1, v = 1, pan = 0) { tone(t, { type: 'square', f0: mtof(m), dur, g: 0.1 * v, a: 0.002, dest: M, pan, filter: ['lowpass', 5200] }); },
    chipBass(t, m, dur = 0.15, v = 1) { tone(t, { type: 'square', f0: mtof(m), dur, g: 0.14 * v, a: 0.002, dest: M, filter: ['lowpass', 1400] }); tone(t, { type: 'triangle', f0: mtof(m - 12), dur, g: 0.3 * v, a: 0.002, dest: M }); },
    chipKick(t, v = 1) { tone(t, { type: 'square', f0: 220, f1: 40, dur: 0.12, g: 0.42 * v, dest: M, filter: ['lowpass', 900] }); },
    chipHat(t, v = 1) { hiss(t, { dur: 0.03, g: 0.12 * v, type: 'highpass', f0: 7000, dest: M }); },
    piano(t, m, dur = 0.8, v = 1, pan = 0) {
      tone(t, { type: 'triangle', f0: mtof(m), dur, g: 0.17 * v, a: 0.003, dest: M, pan, rev: 0.35, filter: ['lowpass', 2400] });
      tone(t, { f0: mtof(m) * 2.003, dur: dur * 0.4, g: 0.02 * v, a: 0.002, dest: M, pan, rev: 0.35 });
    },
    brush(t, v = 1) { hiss(t, { dur: 0.18, g: 0.14 * v, type: 'bandpass', f0: 3200, q: 0.5, a: 0.06, dest: M, rev: 0.2 }); },
    upright(t, m, dur = 0.3, v = 1) { tone(t, { f0: mtof(m), dur, g: 0.5 * v, a: 0.006, dest: M }); tone(t, { type: 'triangle', f0: mtof(m) * 2, dur: 0.06, g: 0.04 * v, dest: M }); },
    saw(t, m, dur = 0.3, v = 1, pan = 0, cut = 1800) {
      [-8, 8].forEach(d => tone(t, { type: 'sawtooth', f0: mtof(m) * Math.pow(2, d / 1200), dur, g: 0.03 * v, a: 0.01, dest: M, pan, rev: 0.3, filter: ['lowpass', cut] }));
    },
    sawBass(t, m, dur = 0.2, v = 1) { tone(t, { type: 'sawtooth', f0: mtof(m), dur, g: 0.12 * v, a: 0.004, dest: M, filter: ['lowpass', 700] }); tone(t, { f0: mtof(m - 12), dur, g: 0.25 * v, a: 0.004, dest: M }); },
    shaker(t, v = 1) { hiss(t, { dur: 0.05, g: 0.06 * v, type: 'highpass', f0: 6500, a: 0.012, dest: M, pan: 0.3 }); },
    snap(t, v = 1) { hiss(t, { dur: 0.03, g: 0.3 * v, f0: 2600, q: 2, dest: M, rev: 0.25, pan: -0.2 }); },
    woodblock(t, m, v = 1, pan = 0) { tone(t, { f0: mtof(m), dur: 0.08, g: 0.2 * v, a: 0.001, dest: M, pan }); A.hiss(t, { dur: 0.01, g: 0.12 * v, f0: 2200, q: 3, dest: M, pan }); },
  };
}

// chords (one per bar): Cmaj9 · Am9 · Fmaj9 · G9sus, looping from the drop
const CH = {
  C: { root: 48, v: [64, 67, 71, 74] }, // bass roots sit an octave up: the bass voice adds its own sub octave
  Am: { root: 45, v: [60, 64, 67, 71] },
  F: { root: 53, v: [57, 60, 64, 67] },
  G: { root: 55, v: [65, 69, 72, 74] },
};
const PROG = ['C', 'Am', 'F', 'G'];
const chordAt = n => CH[PROG[(n - 4 + 400) % 4]]; // bar 4 (the drop) is C
// the band follows the room's look only while the looks are being swapped; from the pull-back it's the main band
const lookAt = t => { if (t < C.looks[1] || t >= C.pullback) return 0; let i = 0; C.looks.forEach((c, k) => { if (t >= c) i = k; }); return i; };

// ------------------------------------------------------------- music
function music(A, I) {
  const { drums: D, inst } = A;
  const M = A.buses.music;

  // intro (bars 1–3): every dropping bar is a note of a C arpeggio; snaps and a shaker set up the groove
  [60, 64, 67, 72, 76, 79].forEach((m, i) => { I.marimba(C.barDrops[i], m, 0.9, (i - 2.5) * 0.15); I.woodblock(C.barDrops[i], m + 12, 0.35); });
  for (let k = 0; k < 8; k++) I.shaker(bar(2) + k * E8, k % 2 ? 0.6 : 1);
  I.snap(beat(2, 2)); I.snap(beat(2, 4));
  D.kick(bar(2), 0.6); D.kick(beat(2, 3), 0.5);
  [60, 64, 67, 71].forEach((m, k) => I.ep(C.morph + k * 0.01, m, BEAT * 2.4, 0.7, (k - 1.5) * 0.2));
  [60, 64, 67, 74].forEach((m, k) => I.ep(C.pill + k * 0.01, m, BEAT * 2, 0.6, (k - 1.5) * 0.2));
  inst.bass(C.morph, 48, BEAT * 1.5, 0.7); inst.bass(C.pill, 55, BEAT * 1.4, 0.6);
  // bar 3: taps on beats 1–3 (the score climbs with the counter), then a whole beat of silence
  C.taps.forEach((tc, i) => { D.kick(tc, 0.75); D.clap(tc, 0.5); I.ep(tc, [64, 67, 69][i], 0.5, 1.2); });
  for (let k = 0; k < 6; k++) I.shaker(bar(3) + k * E8, 0.7);

  // from the drop: the groove, with the band's instruments following the current look
  const endGroove = C.freeze;
  for (let n = 4; bar(n) < endGroove; n++) {
    const ch = chordAt(n);
    for (let e = 0; e < 8; e++) {
      const t = bar(n) + e * E8 + (e % 2 ? 0.02 : 0); // a touch of swing
      if (t >= endGroove) break;
      const L = lookAt(t);
      const lightBar = n === 5 && t < C.flood; // the collapse/tile bar stays light (bass + hats only)
      const cakeBar = n === 11;               // top-down cake: lighter drums
      // drums
      if (L === 1) { // pixel
        if (e === 0 || e === 3 || e === 4) I.chipKick(t);
        if (e === 2 || e === 6) A.hiss(t, { dur: 0.1, g: 0.3, type: 'bandpass', f0: 1800, q: 0.7, dest: M });
        I.chipHat(t, e % 2 ? 0.6 : 1);
      } else if (L === 2) { // ink
        if (e === 0 || e === 4) D.kick(t, 0.55);
        if (e === 2 || e === 6) I.brush(t, 1.1);
        I.brush(t + E8 * 0.5, 0.35);
      } else {
        if (!lightBar) {
          if (e === 0 || e === 3 || e === 4 || (e === 7 && n % 2 === 0)) D.kick(t, cakeBar ? 0.6 : 0.95);
          if ((e === 2 || e === 6) && !cakeBar) D.clap(t, 0.85);
          if ((e === 2 || e === 6) && cakeBar) I.snap(t, 0.8);
        }
        D.hat(t, e % 2 ? 0.55 : 0.85, L === 3 && e % 2 === 1);
        if (L === 3) D.hat(t + E8 / 2, 0.35);
      }
      // bass
      const bassPat = [0, null, 12, 0, null, 7, 0, 10];
      const off = bassPat[e];
      if (off !== null) {
        const m = ch.root + (off === 10 ? 10 : off);
        if (L === 1) I.chipBass(t, m, E8 * 0.8);
        else if (L === 2) I.upright(t, m - 12, E8 * 0.9, 0.9);
        else if (L === 3) I.sawBass(t, m, E8 * 0.8);
        else inst.bass(t, m, E8 * 0.75, 1.0);
      }
      // comping
      if (L === 1) { // chip arpeggio in 16ths
        for (let s = 0; s < 2; s++) I.chip(t + s * S16, ch.v[(e * 2 + s) % 4] + 12, S16 * 0.8, 0.8, 0.2);
      } else if (L === 2) {
        if (e === 0 || e === 3 || e === 6) ch.v.forEach((m, k) => I.piano(t + k * 0.012, m, 0.9, 0.7, -0.15));
      } else if (L === 3) {
        if (e === 0) ch.v.forEach(m => I.saw(t, m, BAR_LEN() * 0.95, 0.9, 0, 1400));
        if (e % 2 === 0) I.saw(t, ch.v[3] + 12, E8 * 0.6, 0.7, 0.25, 3000);
      } else if (!lightBar) {
        if (e === 0 || e === 3 || e === 6) ch.v.forEach((m, k) => I.ep(t + k * 0.008, m, e === 0 ? 0.7 : 0.35, 0.9, (k - 1.5) * 0.15));
      }
    }
  }
  // the drop
  D.crash(C.seventy, 1); inst.stab(C.seventy, [60, 64, 67, 71, 74], 0.5, 1.1);
  [72, 76, 79, 84, 88].forEach((m, k) => inst.bell(C.seventy + 0.05 + k * 0.07, m, 1.2, 0.8, (k - 2) * 0.2));
  // build bar: the chips play a rising marimba figure; look 1 lands with a chord
  C.chips.forEach((t, i) => I.marimba(t, [72, 76, 79, 84][i], 1, (i - 1.5) * 0.3));
  // look changes: a crash-less hit + stinger in the new instrument
  C.looks.slice(1).forEach((t, k) => {
    const L = k + 1;
    if (L === 1) [72, 76, 79, 84, 88, 91].forEach((m, j) => I.chip(t + j * 0.04, m, 0.06, 1, 0.3));
    if (L === 2) [72, 76, 79].forEach((m, j) => I.piano(t + j * 0.05, m, 0.9, 1, 0.1));
    if (L === 3) { I.saw(t, 84, 0.25, 1.4, 0.2, 5000); I.saw(t + 0.08, 88, 0.25, 1.2, -0.2, 5000); }
  });
  // the card: the melodic hook enters (bell + EP), two bars
  const hook = [[0, 76, 0.5], [0.5, 79, 0.5], [1, 81, 1], [2, 79, 0.5], [2.5, 76, 0.5], [3, 74, 1], [4, 72, 0.5], [4.5, 74, 0.5], [5, 76, 1], [6, 79, 1.5], [7.5, 81, 0.5]];
  hook.forEach(([b, m, d]) => { const t = bar(9) + b * BEAT; inst.bell(t, m, d * BEAT * 1.4, 1.1, 0.15); I.ep(t, m - 12, d * BEAT, 0.6, -0.1); });
  // toss → tunnel: riser + tom fill; landing hit
  A.fx.riser(C.toss - 0.1, C.land2 - C.toss + 0.1, 0.8);
  for (let k = 0; k < 6; k++) D.tom(C.toss + 0.35 + k * S16 * 1.1, 180 - k * 18, 0.7, (k - 2.5) * 0.2);
  D.crash(C.land2, 0.6);
  // candles ripple: a bell glissando
  for (let k = 0; k < 10; k++) inst.bell(C.candle + 0.1 + k * 0.045, [72, 74, 76, 79, 81, 84, 86, 88, 91, 93][k], 0.6, 0.45, (k - 5) * 0.1);
  // party
  D.crash(C.party, 1); inst.stab(C.party, [60, 64, 67, 72], 0.4, 0.9);
  hook.filter(([b]) => b < 4).forEach(([b, m, d]) => { const t = C.party + b * BEAT; inst.bell(t, m + 12, d * BEAT * 1.4, 1.2, -0.15); I.ep(t, m, d * BEAT, 0.8, 0.1); });
  [0, 2].forEach(b => inst.stab(C.party + b * BEAT, [60, 64, 67, 71], 0.18, 0.7));
  for (let k = 0; k < 8; k++) D.hat(C.party + k * E8 + E8 / 2, 0.5, true);
  D.crash(C.cannons, 0.8);
  // FREEZE: the band cuts; a tape-stop of the chord slides down and dies
  M.gain.setValueAtTime(MUSIC_GAIN, C.freeze - 0.01); M.gain.linearRampToValueAtTime(0.0001, C.freeze + 0.015);
  M.gain.setValueAtTime(0.0001, C.typeDone - 0.06); M.gain.linearRampToValueAtTime(MUSIC_GAIN, C.typeDone - 0.02);
  tapeStop(A, C.freeze, [48, 60, 64, 67, 71]);
  // end type lands: the last chord + bells, ringing out into silence
  inst.stab(C.typeDone, [48, 60, 64, 67, 71, 74], 1.2, 0.9, 0.5);
  [72, 76, 79, 83, 86].forEach((m, k) => inst.bell(C.typeDone + k * 0.06, m, 2.2, 0.9, (k - 2) * 0.2));
  inst.bass(C.typeDone, 48, 1.4, 1.0);
  D.kick(C.typeDone, 0.9);
}
const BAR_LEN = () => BEAT * 4;

function tapeStop(A, t, notes) {
  const ctx = A.ctx;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.01); g.gain.setTargetAtTime(0.0001, t + 0.25, 0.12);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(3000, t); f.frequency.exponentialRampToValueAtTime(200, t + 0.55);
  notes.forEach(m => {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(m), t); o.frequency.exponentialRampToValueAtTime(mtof(m) / 5, t + 0.55);
    o.connect(f); o.start(t); o.stop(t + 0.8);
  });
  f.connect(g); g.connect(A.buses.sfx);
}

// ------------------------------------------------------------- foley
function foley(A, I) {
  const { fx, hiss, tone } = A;
  fx.roomTone(0, C.end, 0.8);
  // A
  C.barDrops.forEach((t, i) => fx.thud(t, 0.35, (i - 2.5) * 0.15));
  fx.swoosh(C.morph, 0.8);
  fx.pop(C.pill, 0.9); fx.thud(C.pill + 0.05, 0.3);
  C.taps.forEach((t, i) => { fx.click(t - 0.01, 0.9, 2400); fx.pop(t, 0.6, [0.4, -0.4, 0.5][i]); });
  fx.whistleUp(C.hush + 0.2, 0.36, 0.5);
  fx.click(C.seventy - 0.01, 1.2, 2000); fx.boom(C.seventy, 0.6, 0.9); fx.ching(C.seventy + 0.02, 1);
  fx.crackle(C.seventy + 0.05, 1.6, 60, 0.8);
  fx.boing(C.seventy + 0.05, 0.8);
  // B: collapse, landing, the tile
  fx.whoosh(C.collapse, 0.35, 0.6, 2000, 300);
  for (let i = 0; i < 6; i++) fx.domino(C.collapse + 0.15 + i * 0.03, 0.8, (i - 2.5) * 0.2);
  fx.whistleDown(C.collapse + 0.05, 0.6, 0.6);
  fx.thud(C.land, 0.8); fx.squeak(C.land + 0.08, 0.35);
  fx.whoosh(C.tileIn, 0.6, 0.35, 1200, 400);
  fx.tick(C.tileHang - 0.1, 0.8); fx.tick(C.tileHang + 0.3, 0.6, true);
  fx.boing(C.bump, 0.7); fx.blip(C.bump + 0.05, 1568, 1.1, 0.08);
  C.chips.forEach((t, i) => { fx.pop(t - 0.42, 0.5); fx.drip(t, 0.8); });
  fx.whoosh(C.flood - 0.05, 0.45, 0.7, 300, 2500); fx.sparkle(C.flood + 0.1, 0.8);
  const B = C.builds;
  fx.whoosh(B.lamp, 0.3, 0.5, 600, 1800, -0.6); fx.click(B.lamp + 0.3, 0.6, 1800, -0.6);
  fx.pop(B.frame + 0.1, 0.5, -0.3);
  fx.paper(B.bunting + 0.2, 0.5, 0.6);
  fx.thunk(B.table + 0.25, 0.5);
  fx.fwump(B.cake + 0.24, 0.8);
  fx.thud(B.gifts + 0.26, 0.6, 0.5); fx.thud(B.gifts + 0.33, 0.4, 0.5);
  fx.squeak(B.balloons + 0.1, 0.3, 0.7);
  fx.pop(B.candles + 0.15, 0.5); fx.pop(B.candles + 0.22, 0.5);
  hiss(B.flames, { dur: 0.3, g: 0.12, type: 'lowpass', f0: 1200, q: 0.5 });
  // look changes: the flick, a reverse swell into the reveal, and a texture of the new look
  C.looks.slice(1).forEach((t, k) => {
    fx.click(t - 0.03, 1, 3200); fx.reverse(t - 0.35, 0.35, 0.5); fx.whoosh(t, 0.35, 0.6, 500, 3500);
    if (k === 1) fx.paper(t + 0.05, 0.35, 0.8);
    if (k === 2) fx.zap(t + 0.02, 0.12, 0.6);
  });
  // C: pull-back, typing, badge
  fx.whoosh(C.pullback, 0.9, 0.7, 2500, 400);
  hiss(C.pullback, { dur: 0.4, g: 0.1, f0: 1500, f1: 4000, q: 2 }); // the tile reeled up
  const typeStart = C.card - 0.45;
  for (let i = 0; i < 26; i++) fx.key(typeStart + i / 30 + 0.01, 0.55, 0.1);
  fx.ching(C.card + 0.6, 0.6);
  // toss + tunnel + landing
  fx.whoosh(C.toss - 0.1, 0.4, 0.8, 300, 3000);
  fx.whoosh(C.toss + 0.3, C.land2 - C.toss - 0.3, 0.6, 3000, 200);
  fx.thud(C.land2, 1); fx.sub(C.land2, 0.4, 70, 0.4);
  // E: lid, morph, candles, the last one, flames
  fx.pop(C.lid, 1); fx.whoosh(C.lid, 0.45, 0.6, 800, 3000);
  fx.sparkle(C.lid + 0.3, 0.6);
  for (let i = 0; i < 10; i++) if (i !== 2) fx.pop(C.lid + 0.5 + i * BEAT / 8, 0.35, (i - 5) * 0.1);
  fx.thunk(C.candle, 0.5); fx.click(C.candle, 0.8, 2600);
  for (let k = 0; k < 10; k++) hiss(C.candle + 0.1 + k * 0.045, { dur: 0.12, g: 0.05, type: 'lowpass', f0: 1400, q: 0.5 });
  // F: party, cannons, the jump
  fx.burst(C.cannons, 0.6, -0.7, 0.6); fx.burst(C.cannons + 0.02, 0.6, 0.7, 0.6);
  fx.whistleUp(C.cannons + BEAT * 0.6 + 0.18, C.freeze - C.cannons - BEAT * 0.6 - 0.15, 0.6);
  // G: shutter, shrink, grab, flip, lift, bars, landing, easel, dab
  shutter(A, C.freeze);
  fx.whoosh(C.shrink, 0.6, 0.35, 2000, 600);
  fx.step(C.grab, 0.6);
  fx.paper(C.flip, 0.35, 0.9); fx.whoosh(C.flip, 0.4, 0.4, 800, 2400);
  fx.whoosh(C.type - 0.15, 0.45, 0.6, 400, 2500);
  for (let i = 0; i < 3; i++) fx.thud(C.type + 0.15 + i * BEAT / 2, 0.5, (i - 1) * 0.3);
  fx.swoosh(C.typeDone, 0.7);
  fx.thud(C.typeDone + 0.3, 0.5); fx.squeak(C.typeDone + 0.36, 0.3);
  fx.pop(C.typeDone + 0.95, 0.25, 0.7);
  fx.drip(C.dab, 0.7); fx.sparkle(C.dab + 0.04, 0.5);
}

function shutter(A, t) {
  const { hiss, tone } = A;
  hiss(t, { dur: 0.012, g: 0.5, f0: 3500, q: 1.5 });
  tone(t, { type: 'triangle', f0: 320, f1: 140, dur: 0.04, g: 0.25 });
  hiss(t + 0.055, { dur: 0.018, g: 0.4, f0: 2800, q: 1.5 });
  tone(t + 0.055, { type: 'triangle', f0: 260, f1: 120, dur: 0.05, g: 0.2 });
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
