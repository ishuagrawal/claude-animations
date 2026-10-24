// The soundtrack: an original funk score (144 BPM, A dorian — the reference measures ≈140 BPM in A dorian)
// plus Foley, synthesized offline from the cue sheet so it is sample-accurate to the picture.
import { makeEngine, mtof } from './engine.js';
import { C } from '../timeline.js';
import { BEAT, rng } from '../core.js';

export const SR = 48000;
const S16 = BEAT / 4;

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const A = makeEngine(ctx);
  extend(A);
  music(A);
  foley(A);
  // smash cut after the explosion; the music returns for the tiebreak
  const g = A.buses.music.gain;
  g.setValueAtTime(0.62, C.boom + 0.05); g.linearRampToValueAtTime(0.0001, C.boom + 0.6);
  g.setValueAtTime(0.0001, C.tiebreak - 0.02); g.linearRampToValueAtTime(0.62, C.tiebreak + 0.05);
  const m = A.buses.master.gain;
  m.setValueAtTime(0.9, Math.max(0, duration - 0.3)); m.linearRampToValueAtTime(0.0001, duration - 0.02);
  return ctx.startRendering();
}

// ------------------------------------------------------------- extra instruments
function extend(A) {
  const { ctx, buses, tone, hiss, R } = A;
  const { music, sfx } = buses;
  const gain = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const pan = (node, p, dest) => { const s = ctx.createStereoPanner(); s.pan.value = p; node.connect(s); s.connect(dest); };
  // clavinet-ish chop: pulse through a resonant band-pass, short
  A.inst.clav = (t, notes, dur = 0.09, v = 1, p = 0.25) => {
    notes.forEach(m => {
      const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = mtof(m);
      const bp = filt('bandpass', mtof(m) * 3, 2.5), g = gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09 * v, t + 0.002); g.gain.setTargetAtTime(0.0001, t + dur, 0.02);
      o.connect(bp); bp.connect(g); pan(g, p, music);
      o.start(t); o.stop(t + dur + 0.2);
    });
  };
  // slap/pop bass: the engine bass plus a bright pop transient on accents
  A.inst.slap = (t, m, dur = 0.12, v = 1, pop = false) => {
    A.inst.bass(t, m, dur, v * 1.1);
    if (pop) tone(t, { type: 'triangle', f0: mtof(m + 24), dur: 0.08, g: 0.12 * v, a: 0.001, dest: music });
  };
  // guzheng-style pluck: bright partial stack with a quick bend-in
  A.inst.zheng = (t, m, v = 1, p = 0.2, bend = 0) => {
    const f = mtof(m);
    [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.18, 'sine'], [4.02, 0.08, 'sine']].forEach(([r, a, type]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f * r * (bend ? Math.pow(2, -bend / 12) : 1), t);
      if (bend) o.frequency.exponentialRampToValueAtTime(f * r, t + 0.09);
      const g = gain(0); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.14 * v * a, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.01, 0.35 / r);
      o.connect(g); pan(g, p, music);
      o.start(t); o.stop(t + 1.6);
    });
    hiss(t, { dur: 0.015, g: 0.05 * v, f0: 4000, q: 2, dest: music, pan: p });
  };
  // gong: inharmonic partials, slow bloom, long tail
  A.fx.gong = (t, v = 1) => {
    [[82, 1], [131, 0.7], [197, 0.55], [262, 0.4], [349, 0.35], [466, 0.25], [618, 0.18], [823, 0.12]].forEach(([f, a], i) => {
      tone(t, { f0: f * (1 + (R() - 0.5) * 0.01), f1: f * 0.985, dur: 3.2 - i * 0.2, g: 0.13 * v * a, a: 0.02 + i * 0.01, rev: 0.5, curve: 'lin' });
    });
    hiss(t, { dur: 1.6, g: 0.12 * v, type: 'bandpass', f0: 900, q: 0.6, a: 0.05, rev: 0.6 });
    tone(t, { f0: 60, f1: 40, dur: 1.2, g: 0.4 * v });
  };
  // sad trombone-ish "womp womp"
  A.fx.womp = (t, m, dur = 0.45, v = 1) => {
    const o = ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(mtof(m), t); o.frequency.linearRampToValueAtTime(mtof(m - 1), t + dur);
    const l = ctx.createOscillator(); l.frequency.value = 6; const lg = gain(mtof(m) * 0.02); l.connect(lg); lg.connect(o.frequency);
    const lp = filt('lowpass', 900, 1.5), g = gain(0);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.2 * v, t + 0.05); g.gain.setTargetAtTime(0.0001, t + dur, 0.06);
    o.connect(lp); lp.connect(g); g.connect(sfx);
    o.start(t); l.start(t); o.stop(t + dur + 0.4); l.stop(t + dur + 0.4);
  };
  // toy fanfare (the GPTs' hopeful entrance)
  A.fx.toot = (t, notes, v = 1) => notes.forEach(([dt, m, d]) => tone(t + dt, { type: 'square', f0: mtof(m), dur: d, g: 0.05 * v, a: 0.005, filter: ['lowpass', 2400], dest: sfx, pan: -0.4 }));
  // sustained beam roar: noise band + detuned saws with a wobble
  A.fx.beam = (t, dur, f, v = 1, p = 0) => {
    hiss(t, { dur, g: 0.16 * v, type: 'bandpass', f0: f * 4, q: 1.2, a: 0.05, sustain: 1, rel: 0.1, pan: p });
    [-12, 0, 7].forEach(d => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.detune.value = d * 10;
      o.frequency.setValueAtTime(f, t); o.frequency.linearRampToValueAtTime(f * 1.5, t + dur);
      const l = ctx.createOscillator(); l.frequency.value = 11 + d; const lg = gain(f * 0.03); l.connect(lg); lg.connect(o.frequency);
      const lp = filt('lowpass', 1400, 1), g = gain(0);
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.035 * v, t + 0.08); g.gain.setValueAtTime(0.035 * v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.08);
      o.connect(lp); lp.connect(g); pan(g, p, sfx);
      o.start(t); l.start(t); o.stop(t + dur + 0.2); l.stop(t + dur + 0.2);
    });
  };
  // bubbling: many little low plops
  A.fx.bubbles = (t, dur, v = 1) => {
    for (let tt = t; tt < t + dur; tt += 0.035 + R() * 0.07) {
      const f = 180 + R() * 380;
      tone(tt, { f0: f, f1: f * (1.6 + R()), dur: 0.04 + R() * 0.03, g: 0.05 * v * (0.4 + R() * 0.6), a: 0.002, pan: -0.25 + (R() - 0.5) * 0.3, rev: 0.15 });
    }
  };
  A.fx.flame = (t, dur, v = 1) => hiss(t, { dur, g: 0.035 * v, type: 'bandpass', f0: 1100, q: 0.4, a: 0.2, sustain: 1, rel: 0.2, pan: -0.25 });
  A.fx.ring = (t, dur, v = 1) => tone(t, { f0: 5600, dur, g: 0.012 * v, a: 0.01 });
}

// ------------------------------------------------------------- music
// A dorian vamp: Am7 | D9, one bar each. Bass riff in 16ths (null = rest), MIDI.
const CH = { Am7: [57, 60, 64, 67], D9: [62, 66, 69, 72], Am9: [57, 60, 64, 67, 71] };
const BASS = {
  Am7: [45, null, 45, 57, null, 45, 43, 45, null, 45, 48, null, 50, 52, 50, 48],
  D9: [38, null, 38, 50, null, 38, 41, 42, null, 38, 45, null, 48, 47, 45, 43],
};
const KICK = [1, 0, 0, 0.6, 0, 0, 0, 0, 1, 0, 0.8, 0, 0, 0, 0, 0];
const CLAV = [2, 6, 10, 11, 14];

function groove(A, b0, nBars, o = {}) {
  const { drums: D, inst: I } = A;
  for (let b = 0; b < nBars; b++) {
    const t0 = b0 + b * 4 * BEAT;
    const ch = ['Am7', 'D9'][b % 2];
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * S16 + (s % 2 ? S16 * 0.08 : 0); // a touch of swing on the off-16ths
      if (o.until && t >= o.until) return;
      if (KICK[s]) D.kick(t, KICK[s]);
      if (s === 4 || s === 12) D.snare(t, 0.95);
      if ((s === 7 || s === 15) && !o.lite) D.snare(t, 0.22, 0.1);
      D.hat(t, s % 4 === 0 ? 0.8 : s % 2 ? 0.35 : 0.55, s === 14 && !o.lite);
      const m = BASS[ch][s]; if (m) I.slap(t, m, S16 * 0.85, 0.95, s === 3 || s === 11);
      if (!o.noClav && CLAV.includes(s)) I.clav(t, CH[ch], 0.07, s === 11 ? 0.7 : 1);
    }
  }
}

function music(A) {
  const { drums: D, inst: I, fx } = A;
  const bars = (k) => k * 4 * BEAT;
  // the drop: everything hits on bar 1
  D.kick(C.drop, 1.3); D.crash(C.drop, 1.1); I.stab(C.drop, CH.Am9.map(m => m + 12), 0.5, 1.3); fx.sub(C.drop, 0.9, 70, 1.2);
  groove(A, C.drop, 4, { until: C.gpt });                    // Kimi arrives, Claude bursts out
  // Kimi's nameplate: a guzheng-style pentatonic run (A C D E G A C)
  [69, 72, 74, 76, 79, 81, 84].forEach((m, i) => I.zheng(C.kimiName + i * 0.045, m, 0.9 - i * 0.05, 0.3, i === 6 ? 1 : 0));
  // Claude's nameplate: brass "bwaa" lick
  I.stab(C.claudeName, [64, 69, 72], 0.14, 1.1); I.stab(C.claudeName + BEAT * 0.5, [67, 72, 76], 0.3, 1.2);
  I.stab(C.claudePop, CH.D9.map(m => m + 12), 0.25, 1); D.crash(C.claudePop, 0.7);
  // the GPTs: stop-time (a lonely hat, then nothing)
  for (let s = 0; s < 7; s++) D.hat(C.gpt + (s + 1) * BEAT * 0.5, 0.3 - s * 0.03);
  // VS card — drums return with toms, a roll into FIGHT!
  D.crash(C.vs, 1); D.kick(C.vs, 1.2); I.stab(C.vs, CH.Am7.map(m => m + 12), 0.3, 1.1);
  groove(A, C.vs, 1, { noClav: true, lite: true, until: C.fight - BEAT * 2 });
  for (let i = 0; i < 12; i++) D.snare(C.fight - BEAT * 2 + i * BEAT / 6, 0.3 + i * 0.05);
  D.kick(C.fight, 1.4); D.crash(C.fight, 1.2); I.stab(C.fight, [69, 72, 76, 79, 81], 0.6, 1.4); fx.sub(C.fight, 0.8, 80, 0.8);
  // the fight
  groove(A, C.charge, 4, { until: C.clash });
  I.stab(C.impact, CH.Am9.map(m => m + 12), 0.3, 1.3); D.crash(C.impact, 1);
  // specials: a rising pad under each poster; the copy is the same chord, pitched a hair flat
  I.pad(C.special, [57, 64, 67, 71, 76], BEAT * 4, 1.2, 1800);
  I.pad(C.copy, [57, 64, 67, 71, 76].map(m => m - 0.3), BEAT * 4, 1.2, 1800);
  // clash — pedal on A, four on the floor, snare roll into the boom
  for (let i = 0; i < 20; i++) {
    const t = C.clash + i * S16 * 2;
    if (t >= C.boom) break;
    I.slap(t, i % 4 === 0 ? 33 : 45, S16 * 1.6, 1, i % 8 === 4);
    if (i % 2 === 0) D.kick(t, 1.1);
    D.hat(t, 0.5);
  }
  for (let i = 0; i < 24; i++) { const t = C.clash + BEAT * 2 + i * (C.boom - C.clash - BEAT * 2) / 24; D.snare(t, 0.2 + i * 0.03); }
  I.pad(C.clash, [57, 64, 69, 72], C.boom - C.clash, 1.4, 2400);
  // tiebreak — a soft roll, then KIMI WINS: a bright A-major fanfare and the groove returns
  for (let i = 0; i < 40; i++) { const t = C.tiebreak + 0.3 + i * (C.win - C.tiebreak - 0.35) / 40; D.snare(t, 0.08 + i * 0.008, (i % 2 - 0.5) * 0.3); }
  D.tom(C.tiebreak, 110, 1); I.stab(C.tiebreak, [57, 60, 64], 0.3, 0.9);
  D.kick(C.win, 1.3); D.crash(C.win, 1.2); I.stab(C.win, [69, 73, 76, 81], 0.5, 1.4); I.stab(C.win + BEAT * 0.75, [71, 74, 78, 83], 0.4, 1.2);
  [81, 84, 86, 88, 91, 93].forEach((m, i) => I.zheng(C.win + 0.15 + i * 0.04, m, 0.8, -0.3));
  groove(A, C.win + BEAT, 2, { until: C.liftoff });
  // launch → space: airy pad and bells; the title gets the last big chord
  fx.riser(C.launch, C.liftoff - C.launch + 0.1, 1);
  I.pad(C.moon, [57, 64, 67, 71, 74], C.button - C.moon, 1.3, 2600);
  [76, 79, 81, 84, 88].forEach((m, i) => I.bell(C.moon + 0.2 + i * 0.18, m, 1.4, 0.8, (i - 2) * 0.2));
  D.crash(C.title, 1); D.kick(C.title, 1.2); I.stab(C.title, [57, 64, 69, 72, 76, 81], 1.2, 1.3); fx.sub(C.title, 0.6, 70, 1);
  [69, 72, 74, 76, 79, 81].forEach((m, i) => I.zheng(C.title + 0.35 + i * 0.06, m, 0.7, 0.3));
}

// ------------------------------------------------------------- foley
function foley(A) {
  const { fx, inst: I } = A;
  const r = rng(77);
  fx.roomTone(0, C.end, 1.1);
  // cold open: the still
  fx.flame(0, C.claudePop, 1);
  fx.bubbles(0.05, C.spout - 0.05, 1);
  fx.squeak(0.55, 0.5, -0.2); fx.squeak(1.2, 0.35, -0.2);           // Claude, muffled, in the flask
  for (let i = 0; i < 14; i++) I.bell(C.neck + i * 0.09 + r() * 0.04, 84 + Math.floor(r() * 10), 0.5, 0.35, (i / 14 - 0.5) * 1.2, 0.4, A.buses.sfx);
  A.tone(C.spout + 0.1, { f0: 900, f1: 1500, dur: C.fall - C.spout - 0.2, g: 0.025, a: 0.3, curve: 'lin', pan: 0.3 });  // the drop swelling
  fx.drip(C.fall, 0.8);
  A.tone(C.fall + 0.02, { f0: 2400, f1: 900, dur: C.drop - C.fall - 0.04, g: 0.04, a: 0.01, pan: 0.3 });             // falling
  fx.drip(C.drop, 1.4); fx.smash(C.drop + 0.01, 0.35); fx.sparkle(C.drop + 0.05, 1);
  // Kimi pops out of the K3.1 flask
  const kPop = C.kimiPop + BEAT, kLand = C.kimiPop + BEAT * 3;
  fx.smash(kPop, 0.9); fx.pop(kPop, 1, 0.3); fx.whoosh(kPop, 0.5, 0.7, 500, 2500, 0.2); fx.boing(kLand, 0.8); fx.thud(kLand, 0.5, 0.3);
  fx.blip(C.kimiBlink + 0.07, 2600, 0.6, 0.05); fx.sparkle(C.kimiBlink + 0.1, 0.8);
  fx.swoosh(C.kimiName, 0.8); fx.thunk(C.kimiName + 0.02, 0.4);
  // Claude bursts out of the boiling flask
  fx.smash(C.claudePop, 1.1); fx.pop(C.claudePop, 1.2, -0.2); fx.whoosh(C.claudePop, 0.6, 0.8, 300, 2000, -0.2);
  fx.thud(C.claudeLand, 1, -0.2); fx.sub(C.claudeLand, 0.5, 80, 0.4);
  A.hiss(C.claudeLand + 0.25, { dur: 0.9, g: 0.08, type: 'highpass', f0: 3000, a: 0.05, pan: -0.2 });          // steam
  fx.swoosh(C.claudeName, 0.8); fx.thunk(C.claudeName + 0.02, 0.4);
  // the GPTs: lamp on, a hopeful toot, flicker, pop, womp womp
  fx.thunk(C.gpt, 0.6); fx.hum(C.gpt, C.gptDim + 0.33 - C.gpt, 6);
  fx.toot(C.gpt + 0.25, [[0, 72, 0.1], [0.12, 76, 0.1], [0.24, 79, 0.25]], 1);
  fx.zap(C.gptDim, 0.3, 0.6, -0.4); fx.pop(C.gptDim + 0.33, 1.4, -0.4); A.hiss(C.gptDim + 0.33, { dur: 0.25, g: 0.2, type: 'highpass', f0: 5000, pan: -0.4 });
  fx.womp(C.gptDim + 0.5, 58, 0.26, 1); fx.womp(C.gptDim + 0.78, 56, 0.5, 1);
  // VS card
  fx.whoosh(C.vs - 0.15, 0.3, 1, 300, 4000); fx.thud(C.vs + 0.3, 0.8); fx.thunk(C.vs + 0.55, 0.6);
  fx.squeak(C.vs + 0.95, 0.4, 0); fx.pop(C.vs + 1.45, 0.8); fx.boing(C.vs + 1.47, 0.35);     // the GPTs squeezed out
  fx.riser(C.fight - BEAT * 2, BEAT * 2, 0.8); fx.boom(C.fight, 0.6, 0.8);
  // the fight
  for (let i = 0; i < 9; i++) fx.step(C.charge + i * 0.09, 0.7, -0.3 + i * 0.05);
  fx.whoosh(C.punch - 0.05, 0.3, 1.1, 800, 4000, 0.1);
  fx.whoosh(C.punch - 0.1, 0.55, 0.6, 400, 1500, 0.3); fx.boing(C.punch + 0.5, 0.6);   // Kimi's leap and landing
  fx.boing(C.headbutt + 0.25, 0.4);
  fx.whoosh(C.impact - 0.18, 0.18, 1, 600, 5000);
  fx.boom(C.impact, 1.1, 0.7); fx.clang(C.impact, 0.6); A.hiss(C.impact, { dur: 0.06, g: 0.6, type: 'highpass', f0: 2000 });
  fx.thud(C.impact + 0.5, 1, 0.4); fx.ching(C.impact + 0.1, 0.6);
  // EXTENDED THINKING / MOVE COPIED
  fx.riser(C.special, BEAT * 3, 0.9); fx.sparkle(C.special + 0.3, 1);
  fx.zap(C.copy, 0.08, 0.6); fx.scratch(C.copy + 0.04, 0.5); fx.riser(C.copy + 0.1, BEAT * 3, 0.9); fx.sparkle(C.copy + 0.3, 1);
  // beam clash, dead even; the GPTs' little pew; BOOM
  fx.beam(C.clash, C.boom - C.clash, 110, 1, -0.3); fx.beam(C.clash, C.boom - C.clash, 147, 1, 0.3);
  fx.crackle(C.clash + 0.15, C.boom - C.clash - 0.15, 70, 0.8, 6000);
  fx.toot(C.blowAway, [[0, 79, 0.06], [0.08, 84, 0.08]], 0.8);
  A.tone(C.blowAway + 0.25, { type: 'square', f0: 1800, f1: 1200, dur: 0.25, g: 0.04, filter: ['lowpass', 3000], pan: -0.4 });   // pew
  fx.burst(C.boom, 1.6, 0, 1.4); fx.sub(C.boom, 1, 70, 1.6); fx.whistleDown(C.boom + 0.1, 0.5, 0.6);
  // DRAW: smoke, a gong, ringing ears
  fx.gong(C.draw + 0.2, 1.2); fx.ring(C.draw, 2.2, 1);
  A.hiss(C.draw, { dur: 3, g: 0.04, type: 'lowpass', f0: 600, a: 0.4, sustain: 1, rel: 0.5 });
  // tiebreak: tags drop, ka-ching ×2
  fx.whoosh(C.tags - 0.2, 0.25, 0.6, 1200, 3000); fx.clang(C.tags + 0.12, 0.3, -0.3); fx.ching(C.tags + 0.12, 0.9);
  fx.clang(C.tags + 0.24, 0.3, 0.3); fx.ching(C.tags + 0.27, 0.9);
  fx.sparkle(C.win + 0.1, 1.2); fx.boing(C.win + 0.42, 0.5); fx.boing(C.win + 0.84, 0.4);
  // moonshot
  fx.boing(C.launch + 0.05, 0.6);
  fx.boom(C.liftoff, 1, 1.0); fx.whoosh(C.liftoff, 1.0, 1.2, 200, 6000); fx.whistleUp(C.liftoff + 0.05, 0.7, 1);
  fx.whoosh(C.moon, 0.9, 0.6, 300, 2000); fx.boing(C.moon + 0.85, 0.7); fx.sparkle(C.moon + 0.88, 1.2);
  // the button: silence, the flame ticking down, one drop
  fx.flame(C.button, C.end - C.button, 0.4);
  A.tone(C.plink - 0.75, { f0: 900, f1: 1500, dur: 0.5, g: 0.02, a: 0.25, curve: 'lin', pan: 0.2 });
  fx.drip(C.plink, 1.6); A.tone(C.plink, { f0: 1500, f1: 3200, dur: 0.05, g: 0.08, a: 0.001 });
  fx.fwump(C.plink + 0.02, 0.25);
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
