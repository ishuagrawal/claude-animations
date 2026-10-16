// The soundtrack: an original, bright 120 BPM cue in D major, 7½ bars (D–Bm–Em–G–A–D–G/A–D). Bar 1 is
// light (shaker, plucks) while Claude drops onto the Claude Code card and types (soft key clicks, a
// stomp on enter); bars 2–3 add a half-time kick under the study (scan swell, a rising plink for each
// style chip, a chime for "style learned") and stab on "make", when the chips fly out and the world
// builds (a whoosh for the sky, a bell for the sun, a bloom for the hills, plinks for the flowers);
// bars 4–5 are the short (the logo, the Octocat assembling, a falling-star glissando, the catch, the
// flick); bar 6 hits on the star (chime, crash, gentle confetti) with the hook; bar 7 lifts to IV for
// the thank-you (crash, confetti cannons, a bell run, the jump, the waves and hearts) and the last half
// bar resolves on D under the fade.
import { makeEngine, mtof } from './engine.js';
import { C, bar, beat } from '../timeline.js';
import { keyTimes, chipLand, chipLaunch, chipArrive } from '../ui.js';
import { BEAT } from '../core.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;
const CH = { D: [62, 66, 69], Bm: [59, 62, 66], Em: [64, 67, 71], G: [55, 59, 62], A: [57, 61, 64] };
const ROOT = { D: 38, Bm: 35, Em: 40, G: 43, A: 45 };
const HARM = [[bar(1), 'D'], [bar(2), 'Bm'], [bar(3), 'Em'], [bar(4), 'G'], [bar(5), 'A'], [bar(6), 'D'], [bar(7), 'G'], [beat(7, 3), 'A'], [bar(8), 'D']];
const chordAt = t => { let c = 'D'; for (const [tt, n] of HARM) if (t >= tt - 1e-6) c = n; return c; };

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const A = makeEngine(ctx);
  const S = synths(A);
  music(A, S);
  foley(A);
  const g = A.buses.master.gain;
  g.value = 1.0; g.setValueAtTime(1.0, C.fadeOut); g.linearRampToValueAtTime(0.0001, duration - 0.02);
  return ctx.startRendering();
}

// ------------------------------------------------------------- synths (pumped bus)
function synths(A) {
  const { ctx } = A;
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(A.buses.music);
  const verb = ctx.createConvolver();
  { // short bright plate
    const b = ctx.createBuffer(2, SR * 1.6, SR);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = (A.R() * 2 - 1) * Math.pow(1 - i / d.length, 3.5); }
    verb.buffer = b;
  }
  const vr = ctx.createGain(); vr.gain.value = 0.28; verb.connect(vr); vr.connect(bus);
  const delay = ctx.createDelay(1); delay.delayTime.value = BEAT * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.32;
  const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 3500;
  delay.connect(dl); dl.connect(fb); fb.connect(delay); const dOut = ctx.createGain(); dOut.gain.value = 0.25; dl.connect(dOut); dOut.connect(bus);
  const voice = (t, m, { dur = 0.22, v = 1, types = ['sawtooth', 'square'], det = 9, f0 = 4200, f1 = 700, fdec = 0.16, a = 0.003, pan = 0, send = 0.3, echo = 0 }) => {
    const out = ctx.createGain(); out.gain.setValueAtTime(0.0001, t);
    out.gain.linearRampToValueAtTime(0.11 * v, t + a); out.gain.setTargetAtTime(0.0001, t + Math.max(a, dur), 0.06);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(f0, t); lp.frequency.exponentialRampToValueAtTime(Math.max(80, f1), t + fdec);
    types.forEach((ty, i) => { const o = ctx.createOscillator(); o.type = ty; o.frequency.value = mtof(m); o.detune.value = (i - (types.length - 1) / 2) * det; o.connect(lp); o.start(t); o.stop(t + Math.max(a, dur) + 0.6); });
    lp.connect(out);
    const p = ctx.createStereoPanner(); p.pan.value = pan; out.connect(p); p.connect(bus);
    if (send) { const s = ctx.createGain(); s.gain.value = send; out.connect(s); s.connect(verb); }
    if (echo) { const s = ctx.createGain(); s.gain.value = echo; out.connect(s); s.connect(delay); }
  };
  return {
    pluck: (t, m, v = 1, pan = 0, echo = 0.4) => voice(t, m, { dur: 0.14, v: v * 0.9, types: ['triangle', 'sawtooth'], det: 7, f0: 3000, f1: 520, fdec: 0.14, pan, echo, send: 0.35 }),
    lead: (t, m, dur, v = 1) => voice(t, m, { dur, v: v * 1.1, types: ['triangle', 'square', 'sine'], det: 8, f0: 2600, f1: 1300, fdec: 0.25, a: 0.012, send: 0.4, echo: 0.3 }),
    chord: (t, notes, dur, v = 1) => notes.forEach((m, i) => voice(t, m, { dur, v: v * 0.5, types: ['sawtooth', 'triangle', 'sawtooth'], det: 16, f0: 2000, f1: 750, fdec: 0.3, a: 0.012, pan: (i - 1) * 0.35, send: 0.45 })),
    pad: (t, notes, dur, v = 1) => notes.forEach((m, i) => voice(t, m, { dur, v: v * 0.3, types: ['sawtooth', 'triangle'], det: 14, f0: 1400, f1: 1100, fdec: dur, a: Math.min(0.8, dur * 0.4), pan: (i - 1) * 0.5, send: 0.6 })),
    // sidechain-style pump: duck the synth bus on each kick
    pump(t, depth = 0.6) { const g = bus.gain; g.setValueAtTime(1 - depth, t); g.setTargetAtTime(1, t + 0.02, 0.09); },
  };
}// ------------------------------------------------------------- music
function music(A, S) {
  const { drums: D, inst: I, fx } = A;
  const kick = (t, v = 1, pump = 0.45) => { D.kick(t, v); if (pump) S.pump(t, pump); };
  for (let b = 0; b < 28; b++) {                       // bars 1–7, beat by beat
    const t = b * BEAT, n = Math.floor(t / 2) + 1, ch = CH[chordAt(t)], r = ROOT[chordAt(t)];
    const full = n >= 6, mid = n >= 4;
    for (let k = 0; k < 4; k++) D.hat(t + k * S16, k === 2 ? 0.0 : (n === 1 ? 0.16 : 0.22));   // shaker
    if (n >= 2) { if (mid || b % 2 === 0) kick(t, full ? 0.95 : mid ? 0.8 : 0.6, full ? 0.5 : 0.3); }
    if (n >= 5 && b % 2 === 1) D.clap(t, full ? 0.75 : 0.5);
    if (n >= 2) D.hat(t + E8, mid ? 0.65 : 0.4, true);
    if (n >= 2) I.bass(t + E8, r, E8 * 0.85, mid ? 0.85 : 0.6);
    if (full) I.bass(t + E8 + S16, r + 12, S16 * 0.7, 0.35);
    S.pluck(t, ch[b % 3] + 12, n === 1 ? 0.55 : 0.7, -0.3);
    if (n >= 2) S.pluck(t + E8, ch[(b + 1) % 3] + 24, 0.5, 0.3);
    if (full) S.chord(t + E8, ch.map(m => m + 12), E8 * 0.7, 0.5);
  }
  ['D', 'Bm', 'Em', 'G', 'A'].forEach((c, i) => S.pad(bar(i + 1), CH[c].map(m => m + 12), 2.0, i % 2 ? 0.7 : 0.6));
  // make: a stab; the world builds over a riser into bar 4
  S.chord(C.make, CH.Em.map(m => m + 12), 0.4, 1.0);
  fx.riser(C.make, bar(4) - C.make, 0.35);
  // into the hit: riser + roll under the flick
  fx.riser(C.catch, C.hit - C.catch, 0.45);
  for (let k = 0; k < 8; k++) D.snare(C.hit - BEAT + k * (BEAT / 8), 0.12 + k * 0.05);
  D.crash(C.hit, 0.9); fx.sub(C.hit, 0.6, 80, 0.9);
  S.chord(C.hit, CH.D.map(m => m + 12), 0.7, 1.1);
  // the hook (bars 6–7)
  for (const [t, m, d] of [[0, 81, 0.5], [0.5, 83, 0.5], [1, 86, 1], [2, 83, 0.5], [2.5, 81, 0.5], [3, 78, 1], [4, 79, 0.5], [4.5, 81, 0.5], [5, 83, 1], [6, 81, 0.5], [6.5, 79, 0.5], [7, 81, 1]]) S.lead(C.hit + t * BEAT, m, d * BEAT, 0.75);
  // thank you: a crash, a warm IV stab and a bell run up the G major chord
  D.crash(C.thank, 0.8); fx.sub(C.thank, 0.4, 70, 0.7);
  S.chord(C.thank, CH.G.map(m => m + 12), 0.6, 1.0);
  [67, 71, 74, 79, 83, 86].forEach((m, k) => I.bell(C.thank + 0.04 + k * 0.075, m + 12, 1.2, 0.4, (k - 2.5) * 0.25, 0.5));
  // the last half bar: the final chord rings into the fade
  const end = bar(8);
  D.crash(end, 0.55); kick(end, 0.85, 0.2); I.bass(end, ROOT.D, 1.2, 0.85);
  S.chord(end, CH.D.map(m => m + 12), 1.0, 0.9);
  S.pad(end, CH.D.map(m => m + 12), C.end - end, 1.2); S.pad(end, CH.D.map(m => m + 24), C.end - end, 0.7);
  S.lead(end, 90, 1.4, 0.7);
  [74, 78, 81, 86, 90].forEach((m, k) => I.bell(end + 0.04 + k * 0.06, m, 1.6, 0.5, (k - 2) * 0.3, 0.5));
}

// ------------------------------------------------------------- foley
function foley(A) {
  const { fx, inst: I, buses } = A;
  // act 1: the card springs in; Claude drops onto it and types
  fx.pop(C.card + 0.02, 0.7, 0.1);
  fx.whistleDown(C.hop, C.land - C.hop, 0.22);
  fx.thud(C.land, 0.55, -0.3); fx.step(C.land + 0.01, 0.5, -0.3); fx.click(C.land, 0.4, 1800, -0.3);
  keyTimes().forEach((t, i) => fx.key(t, 0.32 + 0.1 * ((i * 7) % 3) / 2, -0.2 + ((i * 5) % 7) * 0.05));
  fx.pop(C.attach + 0.02, 0.6, 0.35); fx.paper(C.attach, 0.2, 0.25, 0.35);
  fx.boing(C.stomp, 0.22);
  fx.thud(C.enter, 0.5, -0.3); fx.thunk(C.enter, 0.6); I.bell(C.enter + 0.02, 86, 0.5, 0.3, 0, 0.3, buses.sfx);
  // the study
  fx.whoosh(C.tile - 0.05, 0.3, 0.35, 500, 3200, 0.45); fx.pop(C.tile + 0.1, 0.55, 0.45);
  for (let t = 3.0; t < C.make - 0.2; t += 0.5) A.tone(t, { f0: 300, f1: 170, dur: 0.07, g: 0.06, pan: 0.55 }); // the ball, bouncing in its clip
  A.hiss(C.scan, { dur: C.scanEnd - C.scan, g: 0.1, type: 'bandpass', f0: 1200, f1: 6000, q: 2, a: 0.3, pan: 0.45 });
  fx.blip(C.scan + 0.18, 1600, 0.5, 0.04, 0.4); fx.blip(C.scan + 0.24, 2000, 0.5, 0.04, 0.4);
  [81, 83, 86, 88, 90, 93].forEach((m, i) => { fx.click(chipLand(i), 0.4, 2600, -0.2); I.bell(chipLand(i) + 0.005, m, 0.4, 0.28, -0.2, 0.3, buses.sfx); });
  I.bell(C.learned, 90, 0.8, 0.4, 0, 0.4, buses.sfx); I.bell(C.learned + 0.08, 95, 0.9, 0.35, 0.1, 0.4, buses.sfx);
  // make: Claude hops, the style flies out and builds the world, the card docks
  fx.boing(C.make, 0.25);
  for (let i = 0; i < 6; i++) fx.whoosh(chipLaunch(i), Math.max(0.12, chipArrive(i) - chipLaunch(i)), 0.18, 900, 3600, -0.5 + i * 0.2);
  fx.whoosh(C.wipe, 0.5, 0.5, 300, 5000); fx.sparkle(C.wipe + 0.05, 0.6);
  I.bell(C.sun, 93, 1.0, 0.4, 0.5, 0.5, buses.sfx); fx.sparkle(C.sun + 0.02, 0.5);
  fx.sub(C.hills, 0.35, 70, 0.5); A.hiss(C.hills, { dur: 0.45, g: 0.12, type: 'lowpass', f0: 600, f1: 2200, q: 0.6, a: 0.15 });
  [0, 0.05, 0.09, 0.14, 0.2, 0.25].forEach((d, k) => fx.drip(C.flowers + 0.06 + d, 0.35 + 0.05 * k));
  fx.whoosh(C.dock, C.dockEnd - C.dock, 0.35, 2600, 500, -0.4);
  fx.thud(C.dockEnd, 0.4, -0.5); fx.pop(C.dockEnd + 0.01, 0.5, -0.5);
  // the logo pops out of the motion chip
  fx.pop(C.mark, 0.8); fx.boing(C.mark + 0.01, 0.15);
  // act 2: the short
  fx.whistleUp(C.squash, C.invert - C.squash, 0.3);
  fx.whoosh(C.invert, C.invertEnd - C.invert + 0.05, 0.55, 600, 5200);
  I.bell(C.invert + 0.02, 98, 0.8, 0.3, 0, 0.5, buses.sfx);
  fx.pop(C.pop, 1); fx.boing(C.pop + 0.01, 0.2); fx.sub(C.pop, 0.3, 120, 0.25);
  [74, 78, 81, 86].forEach((m, i) => I.bell(C.legs + i * 0.035, m, 0.35, 0.25, (i - 1.5) * 0.25, 0.25, buses.sfx));
  fx.pop(C.face + 0.03, 0.5);
  fx.blip(C.eyes + 0.02, 1400, 0.6, 0.05, -0.2); fx.blip(C.eyes + 0.07, 1760, 0.6, 0.05, 0.2);
  for (let i = 0; i < 9; i++) fx.drip(C.suckers + i * 0.04, 0.22 + i * 0.02);
  fx.drip(C.puddle + 0.42, 0.8);
  fx.pop(C.header, 0.6); fx.click(C.header + 0.05, 0.4, 3000);
  // the star: out of the sun, a falling glissando, caught, wound up, flicked, into the button
  fx.sparkle(C.starIn, 0.8);
  [98, 95, 93, 90, 88, 86, 83].forEach((m, i) => I.bell(C.starIn + 0.1 + i * 0.13, m, 0.5, 0.22, 0.3 - i * 0.08, 0.45, buses.sfx));
  A.tone(C.catch, { f0: 520, f1: 780, dur: 0.08, g: 0.15 }); I.bell(C.catch + 0.01, 90, 0.5, 0.35, -0.2, 0.3, buses.sfx);
  fx.whistleUp(C.windup, 0.2, 0.2);
  fx.swoosh(C.flick, 0.7); fx.whistleUp(C.flick, C.hit - C.flick, 0.4);
  fx.click(C.hit - 0.01, 0.9, 2600); fx.ching(C.hit, 0.9); fx.sparkle(C.hit + 0.04, 1);
  [86, 90, 93, 98].forEach((m, k) => I.bell(C.hit + 0.02 + k * 0.045, m, 1.2, 0.4, (k - 1.5) * 0.3, 0.45, buses.sfx));
  fx.crackle(C.hit + 0.15, 1.6, 26, 0.22, 7000, -0.4); fx.crackle(C.hit + 0.15, 1.6, 26, 0.22, 7000, 0.4);
  fx.thud(C.hit + 0.52, 0.35); fx.drip(C.hit + 0.53, 0.7);
  // act 3: the credit; thank you (cannons, words popping up, the star, the jump); waves and hearts
  fx.whoosh(C.credit - 0.05, 0.4, 0.3, 800, 3000, -0.5); fx.pop(C.credit + 0.3, 0.5, -0.5);
  fx.burst(C.thank, 0.8, -0.75); fx.burst(C.thank + 0.02, 0.8, 0.75);
  fx.paper(C.thank + 0.1, 1.2, 0.35, -0.4); fx.paper(C.thank + 0.12, 1.2, 0.35, 0.4);
  fx.crackle(C.thank + 0.15, 1.6, 26, 0.2, 7000, -0.5); fx.crackle(C.thank + 0.15, 1.6, 26, 0.2, 7000, 0.5);
  for (let i = 0; i < 5; i++) fx.pop(C.thank + 0.06 + i * 0.075, 0.45, (i - 2) * 0.2);
  fx.ching(C.thank + 0.48, 0.7); fx.sparkle(C.thank + 0.52, 0.8);
  fx.boing(C.thank, 0.18); fx.thud(C.thank + 0.5, 0.35); fx.step(C.thank + 0.5, 0.4, -0.5);
  fx.squeak(C.wave + 0.1, 0.14, -0.5); fx.squeak(C.wave + 0.4, 0.12, 0.1);
  for (let k = 0; k < 5; k++) fx.drip(C.wave + 0.14 + k * 0.24, 0.3);
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
