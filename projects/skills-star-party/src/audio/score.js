// The soundtrack: an original, bright 120 BPM cue in D major, four bars long. Bar 1 is all foley and
// sparkle for the logo (pop, wind-up, the inversion shimmer, the bloop as the Octocat appears, a blip
// for every part that pops on, a plop as the ring lands as a puddle); bar 2 starts the groove as Claude
// leaps in and the count ticks up; bar 3 is the hit (crash, chord, poppers, confetti) with the hook;
// bar 4 resolves on a held D major chord under the fade.
import { makeEngine, mtof } from './engine.js';
import { C, bar, beat } from '../timeline.js';
import { BEAT } from '../core.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;
const CH = { D: [62, 66, 69], Bm: [59, 62, 66], G: [55, 59, 62], A: [57, 61, 64] };
const ROOT = { D: 38, Bm: 35, G: 43, A: 45 };
// harmony per half bar (seconds): bar 2 G → A, bar 3 D → Bm, bar 4 G → A → D
const HARM = [[bar(2), 'G'], [beat(2, 3), 'A'], [bar(3), 'D'], [beat(3, 3), 'Bm'], [bar(4), 'G'], [beat(4, 2), 'A'], [beat(4, 3), 'D']];
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
  // bar 1: a soft D pad and music-box sparkle under the logo
  S.pad(0.05, CH.D.map(m => m + 12), 2.0, 0.7);
  [86, 90, 93, 98].forEach((m, k) => I.musicbox(C.mark + 0.05 + k * 0.07, m, 0.5));
  // bars 2–4: the groove (bar 2 lighter; full from the hit), plucked 8ths on the harmony, bass on the off-beats
  for (let b = 0; b < 12; b++) {
    const t = bar(2) + b * BEAT, full = t >= C.hit - 1e-6;
    if (t >= beat(4, 3) - 1e-6) break;                            // the final chord rings alone
    kick(t, full ? 0.95 : 0.75, full ? 0.5 : 0.35);
    if (full && b % 2 === 1) D.clap(t, 0.75);
    D.hat(t + E8, full ? 0.75 : 0.5, true);
    for (let k = 1; k < 4; k += 2) D.hat(t + k * S16, 0.22);
    const ch = CH[chordAt(t)], r = ROOT[chordAt(t)];
    I.bass(t + E8, r, E8 * 0.85, 0.85);
    if (full) I.bass(t + E8 + S16, r + 12, S16 * 0.7, 0.35);
    S.pluck(t, ch[b % 3] + 12, 0.75, -0.3); S.pluck(t + E8, ch[(b + 1) % 3] + 24, 0.55, 0.3);
    if (full) S.chord(t + E8, ch.map(m => m + 12), E8 * 0.7, 0.55);
  }
  S.pad(bar(2), CH.G.map(m => m + 12), 1.0, 0.8); S.pad(beat(2, 3), CH.A.map(m => m + 12), 1.0, 0.9);
  // the count: a riser and a snare roll into the hit
  fx.riser(C.count, C.hit - C.count, 0.55);
  for (let k = 0; k < 12; k++) D.snare(beat(2, 4) + k * (BEAT / 12), 0.12 + k * 0.035);
  // the hit
  D.crash(C.hit, 1.0); fx.sub(C.hit, 0.7, 80, 0.9);
  S.chord(C.hit, CH.D.map(m => m + 12), 0.7, 1.1);
  // hook (bars 3–4)
  for (const [t, m, d] of [[0, 81, 0.5], [0.5, 83, 0.5], [1, 86, 1], [2, 83, 0.5], [2.5, 81, 0.5], [3, 78, 1], [4, 81, 0.5], [4.5, 83, 0.5], [5, 86, 1]]) S.lead(C.hit + t * BEAT, m, d * BEAT, 0.8);
  // the final chord (bar 4, beat 3) rings to the end
  const end = beat(4, 3);
  D.crash(end, 0.55); kick(end, 0.85, 0.2); I.bass(end, ROOT.D, 0.9, 0.85);
  S.chord(end, CH.D.map(m => m + 12), 0.9, 0.9);
  S.pad(end, CH.D.map(m => m + 12), C.end - end, 1.2); S.pad(end, CH.D.map(m => m + 24), C.end - end, 0.7);
  S.lead(end, 90, 0.9, 0.7);
  [74, 78, 81, 86, 90].forEach((m, k) => I.bell(end + 0.04 + k * 0.05, m, 1.4, 0.5, (k - 2) * 0.3, 0.5));
}

// ------------------------------------------------------------- foley
function foley(A) {
  const { fx, inst: I, buses } = A;
  // the logo pops in; wind-up; the inversion sweeps out; the Octocat bloops into being
  fx.pop(C.mark + 0.02, 0.9); fx.sparkle(C.mark + 0.25, 0.5);
  fx.whistleUp(C.squash, C.invert - C.squash, 0.35);
  fx.reverse(C.invert - 0.12, 0.14, 0.35);
  fx.whoosh(C.invert, C.invertEnd - C.invert + 0.05, 0.6, 600, 5200);
  I.bell(C.invert + 0.02, 98, 0.8, 0.35, 0, 0.5, buses.sfx);
  fx.pop(C.pop, 1.1); fx.boing(C.pop + 0.01, 0.22); fx.sub(C.pop, 0.35, 120, 0.25);
  // parts pop on: four legs (rising plucks), face, eyes, nose, whiskers, nine suckers (bubbles)
  [74, 78, 81, 86].forEach((m, i) => I.bell(C.legs + i * 0.035, m, 0.35, 0.28, (i - 1.5) * 0.25, 0.25, buses.sfx));
  fx.pop(C.face + 0.03, 0.55);
  fx.blip(C.eyes + 0.02, 1400, 0.7, 0.05, -0.2); fx.blip(C.eyes + 0.07, 1760, 0.7, 0.05, 0.2);
  fx.click(C.whiskers + 0.05, 0.35, 6000, -0.5); fx.click(C.whiskers + 0.08, 0.35, 6400, 0.5);
  for (let i = 0; i < 9; i++) fx.drip(C.suckers + i * 0.04, 0.25 + i * 0.02);
  // the ring lands as a puddle
  fx.drip(C.puddle + 0.4, 0.9); A.hiss(C.puddle + 0.41, { dur: 0.18, g: 0.12, type: 'bandpass', f0: 2600, q: 0.8 });
  // alive: a blink sparkle; the drop forms
  fx.sparkle(C.alive + 0.06, 0.6); fx.drip(C.drip + 0.1, 0.35);
  // the Octocat steps aside; Claude leaps in and lands
  fx.whoosh(C.slide, 0.4, 0.35, 300, 1600);
  fx.boing(C.jump, 0.4); fx.whoosh(C.jump, C.land - C.jump, 0.5, 400, 2400);
  fx.thud(C.land, 0.7); fx.step(C.land + 0.02, 0.6);
  // the count: the star chimes in; ticks accelerate with the number
  fx.ching(C.count + 0.02, 0.7);
  const n = 22;
  for (let k = 0; k < n; k++) { const u = k / (n - 1), t = C.count + 0.08 + (C.hit - C.count - 0.12) * (1 - Math.pow(1 - u, 1.6)); fx.tick(t, 0.25 + 0.25 * u, k % 2 === 1); }
  // the hit: both jump, poppers, confetti, a bright chime
  fx.whistleUp(C.hit - 0.28, 0.28, 0.4);
  fx.pop(C.hit, 1, -0.8); fx.pop(C.hit + 0.02, 1, 0.8);
  fx.crackle(C.hit + 0.08, 1.4, 45, 0.45, 6500, -0.6); fx.crackle(C.hit + 0.08, 1.4, 45, 0.45, 6500, 0.6);
  fx.ching(C.hit + 0.01, 1);
  [86, 90, 93, 98].forEach((m, k) => I.bell(C.hit + 0.02 + k * 0.045, m, 1.2, 0.45, (k - 1.5) * 0.3, 0.45, buses.sfx));
  // landing back in the puddle: a splash
  fx.thud(C.hit + 0.28, 0.5); fx.drip(C.hit + 0.29, 0.8); A.hiss(C.hit + 0.29, { dur: 0.25, g: 0.18, type: 'bandpass', f0: 3000, q: 0.7, pan: 0.3 });
  // the repo name slides in; the skill pill pops
  fx.whoosh(C.repo - 0.05, 0.4, 0.3, 500, 3000);
  fx.pop(C.skill, 0.7); I.bell(C.skill + 0.02, 93, 0.6, 0.35, 0.3, 0.4, buses.sfx);
  // waving goodbye
  fx.squeak(C.wave + 0.1, 0.18, -0.3); fx.squeak(C.wave + 0.45, 0.14, 0.3);
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
