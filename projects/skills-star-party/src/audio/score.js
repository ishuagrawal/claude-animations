// The soundtrack: an original 120 BPM product-video cue in D major — airy pad and music-box
// twinkles while the icon comes alive, a soft four-on-the-floor groove (I–V–vi–IV) once the page is
// up, a fuller chorus for the thank-you and a held final chord — with UI foley on every cursor
// event of the cue sheet: hover ticks, clicks, keystrokes, toggles, success blips, chimes, whooshes
// on scrolls and camera moves, and confetti.
import { makeEngine, mtof } from './engine.js';
import { C, bar, beat, STARS, GRID, cellTime, INSTALL, RUN } from '../timeline.js';
import { BEAT } from '../core.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4;

// chords (MIDI) and bass roots per bar (bars are 1-based, 2 s each)
const CH = { D: [62, 66, 69], Bm: [59, 62, 66], G: [55, 59, 62], A: [57, 61, 64] };
const PROG = { 1: 'D', 2: 'A', 3: 'Bm', 4: 'G', 5: 'D', 6: 'A', 7: 'Bm', 8: 'G', 9: 'D', 10: 'A', 11: 'Bm', 12: 'G', 13: 'D' };
const ROOT = { D: 38, Bm: 35, G: 43, A: 45 };
const PENTA = [74, 76, 78, 81, 83, 86, 88, 90, 93, 95];

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SR), SR);
  const A = makeEngine(ctx);
  const S = synths(A);
  music(A, S);
  foley(A);
  const g = A.buses.master.gain;
  g.value = 1.07; g.setValueAtTime(1.07, C.fadeOut); g.linearRampToValueAtTime(0.0001, duration - 0.02);
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
}

// ------------------------------------------------------------- music
function music(A, S) {
  const { drums: D, inst: I, fx } = A;
  const kick = (t, v = 1, pump = 0.45) => { D.kick(t, v); if (pump) S.pump(t, pump); };
  const arp = (n, v = 1, pattern = [0, 1, 2, 1, 0, 2, 1, 2], oct = 12) => {
    const ch = CH[PROG[n]];
    for (let i = 0; i < 8; i++) S.pluck(bar(n) + i * E8, ch[pattern[i]] + oct, v * (i % 2 ? 0.7 : 1), (i % 2 ? 0.3 : -0.3));
  };
  const groove = (n, { clap = true, hats = 1, bass = 1, pump = 0.45, kickV = 0.8, shaker = 1, skip = [] } = {}) => {
    for (let b = 0; b < 4; b++) {
      if (skip.includes(b)) continue; // a stop
      const t = bar(n) + b * BEAT;
      if (kickV > 0) kick(t, kickV, pump);
      if (clap && (b === 1 || b === 3)) D.clap(t, 0.6);
      if (hats) D.hat(t + E8, 0.6 * hats, true);
      if (shaker) for (let k = 0; k < 4; k++) D.hat(t + k * S16, (k === 2 ? 0.0 : 0.22) * shaker);
      if (bass) { const r = ROOT[PROG[n]]; I.bass(t + E8, r, E8 * 0.85, 0.8 * bass); if (b % 2) I.bass(t + E8 + S16, r + 12, S16 * 0.7, 0.35 * bass); }
    }
  };
  const pad = (n, v = 1, oct = 12) => S.pad(bar(n), CH[PROG[n]].map(m => m + oct), 2.1, v);
  const lead = (n, notes, v) => { for (const [b, m, d] of notes) S.lead(bar(n) + b * BEAT, m, d * BEAT, v); };

  // ---- intro (bars 1–2): pad, twinkles, a riser into the window opening, half-time pulse
  pad(1, 0.9); pad(2, 1);
  for (let i = 0; i < 6; i++) I.musicbox(C.icon + 0.1 + i * E8 * 0.5, [86, 90, 93, 98, 93, 90][i], 0.35);
  fx.riser(C.dissolve - 0.2, C.alive - C.dissolve + 0.2, 0.55);
  fx.sub(C.alive, 0.5, 80, 0.9); D.crash(C.alive, 0.45);
  S.chord(C.alive, CH.A.map(m => m + 12), 0.9, 0.9);
  arp(2, 0.45);
  for (let b = 1; b < 4; b++) kick(bar(2) + b * BEAT, 0.45, 0.25);

  // ---- hero (bars 3–4): the groove arrives
  D.crash(bar(3), 0.5);
  groove(3, { clap: false, bass: 0.8 }); arp(3, 0.6); pad(3, 0.7);
  groove(4); arp(4, 0.65); pad(4, 0.7);
  S.chord(C.star, CH.Bm.map(m => m + 24), 0.5, 0.8);
  for (let k = 0; k < 8; k++) D.snare(C.scroll1 - 0.2 + k * 0.07, 0.08 + k * 0.03); // soft roll into the scroll

  // ---- feature (bars 5–8): full groove, offbeat chords, a lead line while the run completes
  D.crash(bar(5), 0.6);
  for (const n of [5, 6, 7, 8]) {
    const full = n >= 7; // builds: lighter while the cards arrive and the command types, full once it runs
    groove(n, { kickV: full ? 0.85 : 0.7, clap: full, hats: full ? 1 : 0.6 }); arp(n, full ? 0.55 : 0.45);
    if (full) for (let b = 0; b < 4; b++) S.chord(bar(n) + b * BEAT + E8, CH[PROG[n]].map(m => m + 12), E8 * 0.7, 0.45);
    else pad(n, 0.6);
  }
  lead(7, [[0, 74, 1], [1, 78, 0.5], [1.5, 76, 0.5], [2, 74, 1], [3, 71, 1]], 0.55);
  lead(8, [[0, 71, 1], [1, 74, 0.5], [1.5, 76, 0.5], [2, 78, 1.5]], 0.55);

  // ---- stats (bars 9–10): lighter — kick + shaker under the cascade, pad swell to the newest star
  D.crash(bar(9), 0.5);
  // breakdown: no kick or bass while the cells light, then the kick returns and stops dead before the chorus
  groove(9, { clap: false, hats: 0, bass: 0, kickV: 0, shaker: 0.8 }); pad(9, 1.2); arp(9, 0.35, [0, 1, 2, 1, 0, 2, 1, 2], 24);
  groove(10, { clap: false, bass: 0.6, kickV: 0.6, hats: 0.5, skip: [3] }); pad(10, 1.1);
  for (let k = 0; k < 12; k++) D.snare(C.scroll3 - 0.15 + k * (bar(11) - C.scroll3 + 0.1) / 12, 0.06 + k * 0.025);
  fx.riser(bar(10) + BEAT * 2, BEAT * 2, 0.45);

  // ---- thank-you chorus (bars 11–12)
  D.crash(bar(11), 0.8); fx.sub(bar(11), 0.45, 75, 0.8);
  for (const n of [11, 12]) {
    groove(n, { kickV: 0.9, pump: 0.55 });
    for (let b = 0; b < 4; b++) S.chord(bar(n) + b * BEAT + E8, CH[PROG[n]].map(m => m + 12), E8 * 0.8, 0.6);
    arp(n, 0.5, [0, 2, 1, 2, 0, 2, 1, 2], 24); pad(n, 0.8);
  }
  lead(11, [[0, 78, 1], [1, 81, 0.5], [1.5, 78, 0.5], [2, 76, 1], [3, 74, 1]], 0.85);
  lead(12, [[0, 79, 1], [1, 78, 0.5], [1.5, 76, 0.5], [2, 74, 1.5], [3.5, 76, 0.5]], 0.85);

  // ---- outro (bar 13 →): the final chord rings out under the pull-back
  const end = bar(13);
  D.crash(end, 0.55); kick(end, 0.8, 0.3); I.bass(end, ROOT.D, 1.6, 0.8);
  S.chord(end, CH.D.map(m => m + 12), 1.6, 0.9);
  S.pad(end, CH.D.map(m => m + 12), C.end - end, 1.3); S.pad(end, CH.D.map(m => m + 24), C.end - end, 0.8);
  S.lead(end, 78, 1.8, 0.7);
  [74, 78, 81, 86, 90].forEach((m, k) => I.bell(end + 0.05 + k * 0.06, m, 2, 0.55, (k - 2) * 0.3, 0.5));
}

// ------------------------------------------------------------- foley
function foley(A) {
  const { fx, inst: I, buses } = A;
  const ui = (t, v = 1, pan = 0) => fx.pop(t, 0.35 * v, pan);           // a soft UI pop for appearing elements
  const tick = (t, v = 1, pan = 0) => fx.click(t, 0.5 * v, 4200, pan);    // hover / toggle tick
  const press = (t, v = 1) => { fx.click(t, 0.9 * v, 2400); fx.click(t + 0.045, 0.5 * v, 3200); A.tone(t, { f0: 180, f1: 110, dur: 0.05, g: 0.12 * v }); };
  const keys = (t0, s, cps, v) => { for (let k = 0; k < s.length; k++) fx.key(t0 + k / cps + (A.R() - 0.5) * 0.012, v * (0.8 + A.R() * 0.4), (A.R() - 0.5) * 0.3); };

  // intro: icon pops in, hover, click, the reveal shimmer, the window opening
  fx.pop(C.icon + 0.02, 0.7); fx.sparkle(C.icon + 0.35, 0.5);
  tick(C.click - 0.4, 0.6);
  press(C.click, 1.1);
  for (let k = 0; k < 8; k++) I.bell(C.click + 0.06 + k * 0.055, PENTA[k + 1], 0.5, 0.2, (k % 2 ? 0.4 : -0.4), 0.45, buses.sfx);
  fx.reverse(C.dissolve, C.alive - C.dissolve, 0.45);
  fx.drip(C.alive + 0.12, 0.6); fx.sparkle(C.alive + 0.1, 0.6);   // eyes open
  fx.whoosh(C.open - 0.05, C.openEnd - C.open + 0.1, 0.55, 250, 2600);
  // hero elements stagger in
  for (const t of [C.nav, C.pill, C.h1, C.h1 + 0.1, C.sub, C.btns]) ui(t, 0.6);
  for (let i = 0; i < 4; i++) ui(C.chips + i * 0.12, 0.5, (i % 2 ? 0.4 : -0.4));
  fx.squeak(C.h1 + 0.1, 0.12, 0.4);                                  // the Octocat waves hello
  // the star: hover, click, chime, counter tick, sparkle
  tick(C.star - 0.28, 0.7);
  press(C.star, 1.2);
  fx.ching(C.star + 0.01, 0.8); fx.sparkle(C.star + 0.05, 1.0);
  fx.domino(C.star + 0.18, 0.7); fx.domino(C.star + 0.32, 0.5);
  [81, 86, 90].forEach((m, k) => I.bell(C.star + 0.02 + k * 0.05, m, 1.2, 0.45, (k - 1) * 0.3, 0.45, buses.sfx));
  fx.whoosh(C.push1, 1.6, 0.25, 200, 900);
  // scrolls
  for (const t of [C.scroll1, C.scroll2, C.scroll3]) { fx.whoosh(t - 0.05, 0.75, 0.7, 300, 3200); fx.swoosh(t + 0.55, 0.35); }
  // feature: cards pop in, typing, enter, results, toggles, the render, done
  for (let i = 0; i < 4; i++) ui(C.cards + i * 0.12, 0.6, (i - 1.5) * 0.25);
  keys(C.type, RUN, 18.5, 0.55);
  fx.thunk(C.enter, 0.35); fx.key(C.enter, 0.9);
  [C.out1, C.out2, C.out3].forEach((t, i) => { I.bell(t, [81, 83, 86][i], 0.6, 0.45, 0.2, 0.3, buses.sfx); tick(t + 0.03, 0.8, 0.5); });
  for (let i = 0; i < 8; i++) fx.pop(C.out2 + 0.03 + i * 0.04, 0.12, (i - 3.5) * 0.12); // palette swatches
  press(C.out4, 1); tick(C.out4 + 0.03, 0.9, 0.5);
  fx.riser(C.out4 + 0.2, C.doneRender - C.out4 - 0.2, 0.3);
  for (let t = C.out4 + 0.25; t < C.doneRender; t += S16) fx.tick(t, 0.25, (Math.round((t - C.out4) / S16) % 2) === 1);
  fx.ching(C.doneRender, 0.7); [86, 90, 93].forEach((m, k) => I.bell(C.doneRender + k * 0.05, m, 1, 0.4, (k - 1) * 0.3, 0.4, buses.sfx));
  // stats: the cells light in a rising cascade, the newest rings gold, the tooltip
  for (let i = 0; i < STARS - 1; i += 2) I.bell(cellTime(i), PENTA[Math.floor(i / (STARS - 1) * PENTA.length)] - 12, 0.25, 0.13 + 0.12 * i / STARS, ((i % GRID.cols) / GRID.cols - 0.5) * 1.2, 0.3, buses.sfx);
  fx.ching(C.grid1, 0.9); fx.sparkle(C.grid1 + 0.05, 0.9);
  [74, 78, 81, 86].forEach((m, k) => I.bell(C.grid1 + k * 0.05, m + 12, 1.4, 0.5, (k - 1.5) * 0.3, 0.5, buses.sfx));
  ui(C.tip, 0.7); tick(C.tip - 0.05, 0.6);
  for (let i = 0; i < 4; i++) ui(C.stats + 0.25 + i * 0.1, 0.45, (i % 2 ? 0.5 : -0.2));
  // CTA: mascots pop up, commands type in, Copy → Copied, confetti
  fx.pop(C.mascots + 0.05, 0.6, -0.4); fx.boing(C.mascots + 0.1, 0.18);
  fx.pop(C.mascots + 0.2, 0.6, 0.4); fx.squeak(C.mascots + 0.45, 0.12, 0.4);
  keys(C.typeCmd, INSTALL, 40, 0.35);
  keys(C.typeCmd + INSTALL.length / 40 + 0.2, RUN, 40, 0.35);
  tick(C.copy - 0.3, 0.7);
  press(C.copy, 1.1);
  fx.ching(C.copy + 0.02, 0.9); fx.sparkle(C.copy + 0.08, 1);
  fx.pop(C.copy + 0.05, 0.9, -0.8); fx.pop(C.copy + 0.07, 0.9, 0.8);
  fx.crackle(C.copy + 0.15, 1.2, 40, 0.35, 6500, -0.5); fx.crackle(C.copy + 0.15, 1.2, 40, 0.35, 6500, 0.5);
  fx.boing(C.copy + 0.1, 0.2);
  // pull-back, caption
  fx.whoosh(C.pullOut, 1.6, 0.35, 1200, 250);
  ui(C.caption + 0.1, 0.6); fx.sparkle(C.caption + 0.2, 0.6);
  fx.roomTone(0, C.end, 0.35);
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
