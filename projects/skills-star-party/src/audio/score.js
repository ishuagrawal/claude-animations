// The soundtrack: an original, bright 120 BPM cue in D major, seven bars. Bar 1 is light (shaker,
// plucks) while Claude hops in and the reference ball boops along; bar 2 adds a half-time kick under
// the study (scan swell, frame clicks, a rising plink for each style chip) and lands on the clap;
// bars 3–4 are the short (the logo, the Octocat assembling, a falling-star glissando, the catch, the
// flick); bar 5 hits on the star (chime, crash, gentle confetti) with the hook; bar 6 is the wrap
// clap; bar 7 resolves on a held D major chord under the fade.
import { makeEngine, mtof } from './engine.js';
import { C, bar, beat } from '../timeline.js';
import { BEAT } from '../core.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;
const CH = { D: [62, 66, 69], Bm: [59, 62, 66], G: [55, 59, 62], A: [57, 61, 64] };
const ROOT = { D: 38, Bm: 35, G: 43, A: 45 };
const HARM = [[bar(1), 'D'], [bar(2), 'Bm'], [bar(3), 'G'], [bar(4), 'A'], [bar(5), 'D'], [bar(6), 'G'], [beat(6, 3), 'A'], [bar(7), 'D']];
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
  for (let b = 0; b < 24; b++) {                       // bars 1–6, beat by beat
    const t = b * BEAT, n = Math.floor(t / 2) + 1, ch = CH[chordAt(t)], r = ROOT[chordAt(t)];
    const full = n >= 5, mid = n >= 3;
    for (let k = 0; k < 4; k++) D.hat(t + k * S16, k === 2 ? 0.0 : (n === 1 ? 0.16 : 0.22));   // shaker
    if (n >= 2) { if (mid || b % 2 === 0) kick(t, full ? 0.95 : mid ? 0.8 : 0.6, full ? 0.5 : 0.3); }
    if (n >= 4 && b % 2 === 1) D.clap(t, full ? 0.75 : 0.5);
    if (n >= 2) D.hat(t + E8, mid ? 0.65 : 0.4, true);
    if (n >= 2) I.bass(t + E8, r, E8 * 0.85, mid ? 0.85 : 0.6);
    if (full) I.bass(t + E8 + S16, r + 12, S16 * 0.7, 0.35);
    S.pluck(t, ch[b % 3] + 12, n === 1 ? 0.55 : 0.7, -0.3);
    if (n >= 2) S.pluck(t + E8, ch[(b + 1) % 3] + 24, 0.5, 0.3);
    if (full) S.chord(t + E8, ch.map(m => m + 12), E8 * 0.7, 0.5);
  }
  S.pad(bar(1), CH.D.map(m => m + 12), 2.0, 0.6); S.pad(bar(2), CH.Bm.map(m => m + 12), 2.0, 0.7);
  S.pad(bar(3), CH.G.map(m => m + 12), 2.0, 0.6); S.pad(bar(4), CH.A.map(m => m + 12), 2.0, 0.7);
  // the clap: a stab on the downbeat-to-be; the zoom rides a riser
  S.chord(C.clap, CH.Bm.map(m => m + 12), 0.4, 1.0);
  fx.riser(C.zoomIn - 0.05, C.zoomInEnd - C.zoomIn, 0.35);
  // into the hit: riser + roll under the flick
  fx.riser(beat(4, 3), C.hit - beat(4, 3), 0.45);
  for (let k = 0; k < 8; k++) D.snare(beat(4, 4) + k * (BEAT / 8), 0.12 + k * 0.05);
  D.crash(C.hit, 0.9); fx.sub(C.hit, 0.6, 80, 0.9);
  S.chord(C.hit, CH.D.map(m => m + 12), 0.7, 1.1);
  // the hook (bars 5–6)
  for (const [t, m, d] of [[0, 81, 0.5], [0.5, 83, 0.5], [1, 86, 1], [2, 83, 0.5], [2.5, 81, 0.5], [3, 78, 1], [4, 79, 0.5], [4.5, 81, 0.5], [5, 83, 1], [6, 81, 0.5], [6.5, 79, 0.5], [7, 81, 1]]) S.lead(C.hit + t * BEAT, m, d * BEAT, 0.75);
  D.crash(C.wrap, 0.5);
  // bar 7: the final chord rings to the end
  const end = bar(7);
  D.crash(end, 0.55); kick(end, 0.85, 0.2); I.bass(end, ROOT.D, 1.2, 0.85);
  S.chord(end, CH.D.map(m => m + 12), 1.0, 0.9);
  S.pad(end, CH.D.map(m => m + 12), C.end - end, 1.2); S.pad(end, CH.D.map(m => m + 24), C.end - end, 0.7);
  S.lead(end, 90, 1.4, 0.7);
  [74, 78, 81, 86, 90].forEach((m, k) => I.bell(end + 0.04 + k * 0.06, m, 1.6, 0.5, (k - 2) * 0.3, 0.5));
}

// ------------------------------------------------------------- foley
function foley(A) {
  const { fx, inst: I, buses } = A;
  const clack = (t, v = 1) => { // clapperboard: a dry wooden snap
    A.hiss(t, { dur: 0.03, g: 0.7 * v, type: 'bandpass', f0: 2400, q: 1.4 });
    A.hiss(t, { dur: 0.012, g: 0.5 * v, type: 'highpass', f0: 5000 });
    A.tone(t, { type: 'triangle', f0: 320, f1: 140, dur: 0.06, g: 0.35 * v });
    A.hiss(t + 0.004, { dur: 0.15, g: 0.12 * v, type: 'bandpass', f0: 900, q: 0.8, rev: 0.4 });
  };
  // act 1: the card pops in; the reference ball boops on each bounce; Claude hops in, presents the slate
  fx.pop(C.card + 0.02, 0.7, 0.4);
  for (let t = 0.5; t < C.clap + 0.5; t += 0.5) A.tone(t, { f0: 300, f1: 170, dur: 0.07, g: 0.08, pan: 0.45 });
  fx.boing(C.hop, 0.3); fx.whoosh(C.hop, C.land - C.hop, 0.3, 300, 1400, -0.5);
  fx.thud(C.land, 0.6, -0.4); fx.step(C.land + 0.02, 0.5, -0.4);
  fx.pop(C.slate, 0.6, -0.3); I.bell(C.slate + 0.02, 86, 0.6, 0.35, -0.3, 0.35, buses.sfx);
  // act 1: the study
  A.hiss(C.scan, { dur: 0.65, g: 0.1, type: 'bandpass', f0: 1200, f1: 6000, q: 2, a: 0.3, pan: 0.4 });
  for (let i = 0; i < 4; i++) fx.click(C.frames + 0.1 + i * 0.08, 0.5, 3500 + i * 300, 0.3);
  [81, 83, 86, 88, 90, 93].forEach((m, i) => { I.bell(C.chips + i * 0.05, m, 0.4, 0.3, -0.2, 0.3, buses.sfx); });
  fx.whoosh(C.absorb, 0.35, 0.4, 2400, 600, -0.4);
  fx.sparkle(C.absorb + 0.3, 0.7);
  fx.whistleUp(C.raise, C.clap - C.raise - 0.04, 0.25);
  clack(C.clap, 1);
  fx.whoosh(C.zoomIn, C.zoomInEnd - C.zoomIn, 0.5, 300, 4000);
  // act 2: the short
  fx.whistleDown(C.mark - 0.25, 0.3, 0.25); fx.pop(C.mark + 0.1, 0.8);
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
  // act 3: out of the frame, the wrap clap, bunting, confetti, waves
  fx.whoosh(C.zoomOut, C.zoomOutEnd - C.zoomOut, 0.45, 3800, 300);
  fx.whistleUp(C.wrap - 0.25, 0.21, 0.2);
  clack(C.wrap, 1);
  fx.paper(C.wrap + 0.2, 0.6, 0.35, 0.2);
  fx.crackle(C.wrap + 0.1, 1.4, 22, 0.18, 7000, 0);
  fx.squeak(C.wrap + 0.6, 0.15, -0.3); fx.squeak(C.wrap + 0.95, 0.12, 0.35);
  fx.pop(C.lockup + 0.05, 0.5);
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
