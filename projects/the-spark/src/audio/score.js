// The soundtrack of THE SPARK: an original score + Foley, synthesized offline from the cue sheet so it is
// sample-accurate to the picture. Every event is timed from a cue in src/timeline.js (plus beats of the
// 72 BPM grid counted from that cue); nothing here is an absolute time.
//
// Key: D major. The theme is three rising "hops" and a settle:  D^A  E^B | F#^D' C#' A   (T1, ends open on V)
// and its answer  D^A  E^B | G^E'... -> D'  (T2, resolves). Each hop is the spark's two-note "blink" (D^A).
// Harmony: D  G6 | Bm  A ; the power supply turns to bVI-bVII (Bb, C) so the vista lands on a bright D.
import { makeEngine, mtof, N } from './engine.js';
import { C, PROMPT, POEM, TYPE_CPS } from '../timeline.js';
import { BEAT, BAR, rng } from '../core.js';

export const SR = 48000;
const E8 = BEAT / 2, S16 = BEAT / 4, H = BEAT * 2;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const n = (...a) => a.map(N);
const DMAJ = [2, 4, 6, 7, 9, 11, 1], DPENT = [2, 4, 6, 9, 11];
const ladder = (pcs, lo, hi) => { const o = []; for (let m = lo; m <= hi; m++) if (pcs.includes(m % 12)) o.push(m); return o; };
const nearest = (lad, h) => lad.reduce((b, m) => (Math.abs(m - h) < Math.abs(b - h) ? m : b), lad[0]);

// [eighth-note position, pitch, length in eighths]
const T1 = [[0, 'D5', 1], [1, 'A5', 3], [4, 'E5', 1], [5, 'B5', 3], [8, 'F#5', 1], [9, 'D6', 4], [13, 'C#6', 1], [14, 'A5', 2]];
const T2 = [[0, 'D5', 1], [1, 'A5', 3], [4, 'E5', 1], [5, 'B5', 3], [8, 'G5', 1], [9, 'E6', 7]];
const theme = (notes, t0, fn) => notes.forEach(([p, nm, l], i) => fn(t0 + p * E8, N(nm), l * E8, i));

// The two master dynamics stages each look ahead 6 ms, which delays the whole mix by 12 ms: render that much
// extra and shift it back so every sound sits exactly on its cue.
const LATENCY = Math.round(0.012 * SR);

export async function renderSoundtrack(duration) {
  const len = Math.ceil(duration * SR);
  const ctx = new OfflineAudioContext(2, len + LATENCY, SR);
  const A = makeEngine(ctx, { cut: C.chip });
  ambience(A, duration);
  room(A);
  outlet(A);
  journey(A);
  vista(A);
  chip(A);
  touch(A);
  release(A);
  reply(A);
  automation(A, duration);
  // mixing aid: ?solo=music|sfx|amb renders one stem (the hall returns stay with the music stem)
  const solo = new URLSearchParams(globalThis.location?.search || '').get('solo');
  if (solo) { for (const k of ["music", "sfx", "amb"]) if (k !== solo) A.buses[k].gain.value = 0; if (solo !== "music") { A.halls.a.ret.disconnect(); A.halls.b.ret.disconnect(); } }
  const raw = await A.render();
  const out = new AudioBuffer({ numberOfChannels: 2, length: len, sampleRate: SR });
  for (let c = 0; c < 2; c++) out.copyToChannel(raw.getChannelData(c).subarray(LATENCY, LATENCY + len), c);
  return out;
}

// harp glissando over a scale, accelerating slightly, with a crescendo
function gliss(A, t0, dur, lo, hi, v = 0.5, pcs = DMAJ, pan0 = -0.5, pan1 = 0.3) {
  const lad = ladder(pcs, lo, hi);
  lad.forEach((m, i) => { const u = i / (lad.length - 1); A.inst.harp(t0 + dur * Math.pow(u, 0.85), m, v * (0.45 + 0.55 * u), { pan: lerp(pan0, pan1, u) }); });
}
// the spark's blink: two quick notes a fifth apart
function blink(A, t, tr = 0, v = 0.6) {
  A.inst.celesta(t, N('D6') + tr, v * 0.9); A.inst.celesta(t + 0.14, N('A6') + tr, v);
}
// 16th-note mallet ostinato (3+3+2 accents) + plucked bass + light hand percussion over one half-bar
function pulse(A, t0, ch, { mar = 0.5, every = 1, bass = 0.6, perc = 0, shake = 0, len = 8 } = {}) {
  const { inst: I, drums: D } = A, o = n(...ch.ost);
  for (let k = 0; k < len; k++) {
    const t = t0 + k * S16, acc = k % 8 === 0 || k % 8 === 3 || k % 8 === 6;
    if (mar && k % every === 0) I.marimba(t, o[[0, 1, 2, 0, 1, 2, 0, 1][k % 8]], mar * (acc ? 1 : 0.55), { pan: acc ? -0.25 : -0.05 });
    if (shake) D.shaker(t, shake * (k % 2 ? 1 : 0.55));
    if (perc && acc) D.frame(t, perc * (k % 8 === 0 ? 1 : 0.55), k % 8 === 0 ? 95 : 130);
  }
  if (bass) { I.pizz(t0, N(ch.bass), bass, { pan: 0.15 }); if (len > 6) I.pizz(t0 + 6 * S16, N(ch.bass) + 12, bass * 0.6, { pan: 0.15 }); }
}

// ------------------------------------------------------------- ambience
function ambience(A, dur) {
  const { fx } = A;
  fx.roomTone(0, dur, 1);                                                   // under every "silent" moment
  // the room at dusk: a computer fan, crickets far outside
  const r1 = C.follow + 2;
  fx.wind(0, r1, 0.1, { f: 260, wander: 0.12, q: 0.6, pts: [[1, 1], [r1 - 1.5, 1], [r1, 0]] });
  fx.crickets(0.3, C.follow - 0.3, 1);
  fx.wind(C.reply - 0.3, dur - C.reply + 0.3, 0.1, { f: 260, wander: 0.12, q: 0.6, pts: [[1, 1], [dur - C.reply, 1]] });
  fx.crickets(C.home, dur - C.home - 0.8, 1);
  // inside the wall: close, dark
  fx.roomTone(C.outlet - 0.3, C.xray - C.outlet + 0.6, 1.0, { lp: 170, pts: [[0.4, 1], [C.xray - C.outlet, 1], [C.xray - C.outlet + 0.6, 0]] });
  // the copper tunnel: wind rush
  const tl = C.psu - C.xray;
  fx.wind(C.xray, tl + 0.4, 0.55, { f: 850, wander: 0.7, q: 0.8, pts: [[0.8, 0.35], [C.tunnel - C.xray, 0.5], [C.tunnel - C.xray + 0.5, 1], [tl - 0.3, 1], [tl + 0.4, 0]], dest: A.buses.sfx });
  // the power-supply cavern
  const pl = C.coilOut - C.psu;
  fx.roomTone(C.psu - 0.2, pl + 0.3, 2.5, { lp: 240, pts: [[0.5, 1], [pl, 1], [pl + 0.3, 0]] });
  // the motherboard at golden hour: open air
  const vl = C.chip - C.vista;
  fx.wind(C.vista - 0.5, vl + 0.5, 0.16, { f: 1500, wander: 0.5, q: 0.5, pts: [[1.2, 1], [vl + 0.4, 1], [vl + 0.5, 0]] });
  // inside the processor: vast and hushed
  const cl = C.touch - C.chip;
  fx.roomTone(C.chip, cl + 3, 1.0, { lp: 210, pts: [[0.25, 1], [cl - 0.9, 1], [cl - 0.55, 0.45], [cl, 0.45], [cl + 3, 0]] });
  fx.wind(C.chip, cl - 0.8, 0.02, { f: 5200, wander: 0.3, q: 0.4, pts: [[0.6, 1], [cl - 1.6, 1], [cl - 0.8, 0]], rev: 0.5 });
}

// ------------------------------------------------------------- Act I: the room, the question
function room(A) {
  const { inst: I, fx } = A, t0 = C.room;
  // the theme, solo piano, with a celesta halo on the top of each hop
  theme(T1, t0, (t, m, d, i) => { I.piano(t, m, i % 2 ? 0.44 : 0.36, { dur: d + 1.6, rel: 0.5 }); if (i % 2 && i < 6) I.celesta(t + 0.012, m + 12, 0.18); });
  [[0, ['D3', 'A3']], [4, ['G2', 'D3']], [8, ['B2', 'F#3']], [12, ['A2', 'E3']]].forEach(([p, ns]) => ns.forEach((nm, k) => I.piano(t0 + p * E8 + k * 0.035, N(nm), 0.27, { dur: 2.6, rel: 0.6 })));
  I.pad(t0 + BAR, n('D3', 'A3', 'F#4'), H - 0.2, 0.2, { cut: 600, att: 1.6, rel: 0.8 });
  // the title: a gentle bell
  I.bell(C.titleIn, N('D6'), 0.3); I.glock(C.titleIn + 0.03, N('A6'), 0.22);

  // close on the monitor: the music waits while the question is typed
  const s = C.screen;
  I.pad(s, n('G2', 'D3', 'B3', 'D4'), BAR - 0.2, 0.25, { cut: 650, att: 1.0, rel: 0.8 });
  I.piano(s, N('G2'), 0.3, { dur: 3 }); I.piano(s + 0.04, N('D4'), 0.25, { dur: 3 });
  const r = rng(77);
  [...PROMPT].forEach((ch, i) => fx.key(C.typeStart + (i + 0.55 + (r() - 0.5) * 0.4) / TYPE_CPS, 0.75 + r() * 0.45, (r() - 0.5) * 0.3, ch === ' '));
  I.piano(s + 3 * BEAT, N('A4'), 0.28, { dur: 2 });                        // the pause before Enter
  I.pad(s + BAR, n('A2', 'E3', 'A3', 'D4'), C.follow - s - BAR, 0.28, { cut: 700, att: 0.5, rel: 0.5 });
  I.piano(s + BAR, N('A2'), 0.3, { dur: 2.5 }); I.piano(s + BAR + 0.04, N('D4'), 0.26, { dur: 2.5 });
  fx.enter(C.enter, 1);
  [['A5', 0.34], ['E6', 0.4], ['A6', 0.48]].forEach(([nm, v], k) => I.celesta(C.enter + 0.11 + k * 0.075, N(nm), v));  // "sent"

  // down the power cord to the wall: a low held pad, a slow descent, anticipation
  const f = C.follow, L = C.outlet - f;
  I.sub(f, N('A1'), L - 0.15, 0.25, { att: 1.5, rel: 0.2 });
  I.pad(f, n('A2', 'E3', 'A3', 'D4'), L - 0.2, 0.4, { cut: 480, cutPts: [[L, 1500]], att: 1.5, rel: 0.25, rev: 0.3 });
  I.choir(f + 0.5, n('E4', 'A4', 'B4'), L - 0.7, 0.32, { vowel: 'oo', pts: [[2, 0.45], [L - 0.75, 1]], rel: 0.25, rev: 0.35 });
  ['E5', 'D5', 'B4', 'A4', 'F#4', 'E4', 'D4'].forEach((nm, k) => I.harp(f + k * BEAT, N(nm), 0.42 - k * 0.02, { pan: lerp(-0.1, 0.4, k / 6), dur: Math.min(2.2, L - k * BEAT - 0.1), rel: 0.1, rev: 0.3 }));
  fx.whoosh(f, 2.6, 0.22, 520, 190, { peak: 0.4, q: 0.8 });
  // a glow answers inside the outlet: a faint tingle
  const g = C.slotGlow, gl = C.outlet - g;
  fx.zap(g, { dur: 0.05, v: 0.35, pan: 0.3 });
  fx.fizz(g, gl, 0.7, { rate: 26, w: u => 0.25 + 0.75 * u, pan: 0.25 });
  n('A4', 'E5').forEach(m => I.strings(g, m, gl - 0.12, 0.22, { trem: 13, hp: 700, pts: [[0.3, 0.2], [gl - 0.12, 1]], rel: 0.12, rev: 0.3, pan: -0.2 }));
}

// ------------------------------------------------------------- Act II: the spark wakes
function outlet(A) {
  const { inst: I, fx } = A, g = C.slotGlow, o = C.outlet - g;
  // mains hum (tuned to B1, 61.7 Hz): faint from the glow, close while we are inside, gone as the spark dives
  fx.hum(g, C.xray - g, mtof(N('B1')), 0.2, { harm: [0.4, 1, 0.7, 0.4, 0.25, 0.12], pts: [[1.2, 0.2], [o - 0.05, 0.4], [o + 0.12, 1], [C.dive - g, 1], [C.xray - g, 0.15]], am: [[0, 0.8], [C.xray - g, 1.1]], amDepth: 0.15, rel: 0.2 });
  // the first arcs
  fx.zap(C.arc1, { dur: 0.07, v: 0.8, pan: -0.35, notes: n('A5', 'D6', 'E6') }); fx.zap(C.arc1 + 0.17, { dur: 0.035, v: 0.45, pan: -0.2 });
  fx.zap(C.arc2, { dur: 0.1, v: 0.9, pan: 0.35 }); fx.zap(C.arc2 + 0.14, { dur: 0.045, v: 0.55, pan: 0.15 });
  // ...gather, quickening, into a body
  const g0 = C.arc2 + 0.36, gN = 7;
  for (let k = 0; k < gN; k++) fx.zap(lerp(g0, C.born - 0.04, 1 - Math.pow(1 - k / gN, 1.7)), { dur: 0.03, v: 0.3 + 0.07 * k, pan: (k % 2 ? 1 : -1) * 0.5 * (1 - k / gN) });
  // born: a rising shimmer, then a soft bell
  n('D6', 'F#6', 'A6', 'B6', 'D7', 'F#7', 'A7').forEach((m, k) => I.celesta(C.born + k * 0.065, m, 0.2 + k * 0.035, { pan: lerp(-0.3, 0.3, k / 6) }));
  A.hiss(C.born, { dur: 0.55, g: 0.07, type: 'bandpass', f0: 2500, f1: 9000, q: 1, pts: [[0.45, 1], [0.55, 0.2]], rel: 0.2, rev: 0.4 });
  fx.fizz(C.born, 0.6, 0.5, { rate: 70, w: u => u });
  fx.chirp(C.born + 0.02, 600, 2000, 0.42, 0.55);
  I.bell(C.born + 0.52, N('A5'), 0.4); I.bell(C.born + 0.52, N('D5'), 0.2);
  I.pad(C.born + 0.4, n('D4', 'A4', 'E5'), C.hop - C.born - 0.2, 0.12, { cut: 750, att: 1.2, rel: 0.8 });
  // eyes open: the blink motif
  blink(A, C.eyesOpen, 0, 0.7);
  // looking around: curious plucks, a little "hm?"
  const la = C.lookAround;
  [[0, 'F#4'], [0.21, 'A4'], [0.76, 'E4'], [0.97, 'G4'], [1.18, 'B4']].forEach(([dt, nm], k) => I.pizz(la + dt, N(nm), 0.45, { pan: k < 2 ? -0.4 : 0.4 }));
  fx.chirp(la + 0.42, 1050, 1250, 0.07, 0.45, -0.3); fx.chirp(la + 1.5, 1100, 1650, 0.12, 0.55, 0.3);
  // notices the way in
  fx.chirp(C.notice, 1300, 2500, 0.09, 0.75); I.celesta(C.notice + 0.03, N('D7'), 0.4); I.pizz(C.notice, N('A4'), 0.5); I.pizz(C.notice + 0.12, N('D5'), 0.55);
  // hop!
  fx.chirp(C.hop - 0.16, 1500, 1100, 0.07, 0.35);
  fx.boing(C.hop, 1, 330); fx.chirp(C.hop + 0.01, 950, 1900, 0.08, 0.6); I.pizz(C.hop, N('D4'), 0.6); I.pizz(C.hop + 0.42, N('A3'), 0.4);
  // dives into the prong
  fx.chirp(C.dive - 0.02, 2300, 520, 0.36, 0.7);
  fx.whoosh(C.dive - 0.05, 0.55, 0.7, 3400, 600, { peak: 0.5, pan: [[0, 0], [0.55, 0.5]] });
  fx.zap(C.dive + 0.34, { dur: 0.12, v: 1 });
}

// ------------------------------------------------------------- the cord, the tunnel, the power supply
const J = [
  { bass: 'D2', ost: ['D4', 'A4', 'D5'], pad: ['A3', 'D4', 'F#4'] },
  { bass: 'G2', ost: ['G4', 'B4', 'E5'], pad: ['B3', 'D4', 'G4'] },
  { bass: 'B2', ost: ['F#4', 'B4', 'D5'], pad: ['B3', 'D4', 'F#4'] },
  { bass: 'A2', ost: ['E4', 'A4', 'C#5'], pad: ['A3', 'C#4', 'E4'] },
  { bass: 'G2', ost: ['G4', 'A4', 'D5'], pad: ['B3', 'D4', 'G4', 'A4'] },
];
function journey(A) {
  const { inst: I, fx, drums: D } = A, x = C.xray, tn = C.tunnel, ps = C.psu;
  // x-ray: the glow races through the cord
  fx.whoosh(x - 0.12, 1.4, 0.75, 500, 5200, { pan: [[0, -0.6], [1.4, 0.6]], peak: 0.7 });
  fx.fizz(x, 1.3, 0.55, { rate: 60, w: u => u, spread: 0.8 });
  fx.fizz(x + 1.3, tn - x - 1.3, 0.3, { rate: 22, spread: 0.8 });
  // the theme's rhythm starts: light pulse, plucked hops; the tunnel adds mallets, strings and drums
  const segs = Math.round((ps - x) / H);
  for (let k = 0; k < segs; k++) {
    const t = x + k * H, inTunnel = t >= tn - 0.01;
    pulse(A, t, J[k % J.length], { mar: [0.34, 0.4, 0.5, 0.55, 0.6][k] ?? 0.5, every: k === 0 ? 2 : 1, bass: inTunnel ? 0.75 : 0.6, perc: inTunnel ? 0.55 : 0, shake: k === 0 ? 0 : inTunnel ? 0.6 : 0.4 });
    if (inTunnel) J[k % J.length].pad.forEach((nm, i) => I.strings(t, N(nm), H - 0.05, 0.7 + 0.12 * (k - 2), { att: 0.25, rel: 0.4, pan: lerp(-0.3, 0.3, i / 3) }));
  }
  theme(T1, x, (t, m, d, i) => {
    I.celesta(t, m, 0.5); I.pizz(t, m - 12, 0.5, { pan: -0.3 });
    if (t >= tn - 0.01) I.strings(t, m, d, 1.0, { att: 0.07, rel: 0.3, pan: -0.35 });
  });
  // the last half-bar climbs toward the cavern
  const last = x + (segs - 1) * H;
  ['B4', 'D5', 'E5', 'F#5'].forEach((nm, k) => I.strings(last + k * E8, N(nm), E8, 0.75 + k * 0.08, { att: 0.06, rel: 0.25, pan: -0.35 }));
  D.cymbal(ps, 1.3, 0.3, 1.4);
  // a joyful barrel roll
  const lp = C.tunnelLoop;
  gliss(A, lp - 0.1, 0.85, N('A3'), N('D7'), 0.5);
  fx.whoosh(lp - 0.1, 1.0, 0.45, 700, 3600, { pan: [[0, -0.7], [0.5, 0.7], [1.0, -0.3]], peak: 0.5 });
  A.tone(lp, { f0: 900, fpts: [[0.35, 2100], [0.8, 1400]], g: 0.05, pts: [[0.05, 1], [0.5, 0.8], [0.8, 0]], rel: 0.1, pan: [[0, -0.5], [0.4, 0.5], [0.8, 0]], rev: 0.3 }); // "wheee"
  I.glock(lp + 0.75, N('D7'), 0.4);

  // the power supply: bVI, deep and strange; a giant transformer hums on Bb
  const pl = C.coilOut - ps, ci = C.coilIn - ps;
  D.gran(ps, 0.55);
  I.sub(ps, N('Bb1'), pl, 0.34, { att: 0.3, rel: 0.25 });
  I.strings(ps, N('Bb2'), pl, 0.4, { att: 0.5, rel: 0.25, pan: 0.3 }); I.strings(ps, N('F3'), pl, 0.35, { att: 0.6, rel: 0.25, pan: 0.15 });
  I.choir(ps, n('D4', 'F4', 'A4'), BAR, 0.55, { vowel: 'oo', att: 1.2, rel: 0.8 });
  I.choir(ps + BAR, n('E4', 'G4', 'C5'), pl - BAR, 0.55, { vowel: 'oo', pts: [[0.5, 0.7], [pl - BAR, 1.1]], rel: 0.2 });
  I.celesta(ps, N('D5'), 0.5); I.celesta(ps + E8, N('A5'), 0.55); I.glock(ps + E8, N('A6'), 0.2);   // the hop, strange now
  fx.hum(ps - 0.4, pl + 0.4, mtof(N('Bb2')), 1.7, { harm: [1, 0.5, 0.6, 0.25, 0.3, 0.1, 0.12, 0.05], pts: [[0.5, 0.3], [ci + 0.4, 0.75], [pl + 0.4, 0.95]], am: [[0, 2], [ci + 0.4, 3], [pl + 0.4, 15]], amDepth: 0.35, dest: A.buses.sfx, rel: 0.07, rev: 0.25 });
  // caught in the magnetic field: an accelerating spiral
  const cl = C.coilOut - C.coilIn, NN = 34, iv = k => 0.27 * Math.pow(0.04 / 0.27, k / (NN - 1));
  let tot = 0; for (let k = 0; k < NN; k++) tot += iv(k);
  const lad1 = ladder([10, 2, 4, 5, 9], 58, 98), lad2 = ladder([0, 2, 4, 7, 9], 58, 98);
  let t = C.coilIn;
  for (let k = 0; k < NN; k++) {
    const u = k / (NN - 1), m = nearest(t < ps + BAR ? lad1 : lad2, 58 + 30 * u + [0, 4, 7][k % 3]), pan = Math.sin(k * 0.8) * 0.7;
    I.celesta(t, m, 0.28 + 0.3 * u, { pan }); I.harp(t, m - 12, 0.28 + 0.22 * u, { pan: -pan });
    if (k % 3 === 0) I.marimba(t, m - 12, 0.28 + 0.22 * u, { pan });
    t += iv(k) * (cl - 0.06) / tot;
  }
  fx.riser(C.coilIn, cl, 0.45, { f0: 300, f1: 5000, tone0: mtof(N('Bb2')), tone1: mtof(N('Bb5')) });
  n('A4', 'D5').forEach((m, i) => I.strings(C.coilIn, m, cl, 0.48, { trem: 12, pts: [[0.15, 0.15], [cl, 1]], rel: 0.1, pan: i ? 0.3 : -0.3 }));
  fx.chirp(C.coilIn + 0.05, 1500, 1000, 0.12, 0.6);                        // "uh-oh"
  // flung out along the rail, straight into the reveal
  const co = C.coilOut, V = C.vista, vl = V - co;
  fx.whoosh(co - 0.25, 0.65, 0.8, 400, 4600, { pan: [[0, -0.5], [0.65, 0.7]], peak: 0.42 });
  fx.impact(co, 0.42); D.frame(co, 0.8, 80); fx.zap(co + 0.01, { dur: 0.09, v: 0.8 }); fx.chirp(co + 0.03, 1200, 2700, 0.18, 0.6, 0.3);
  I.sub(co, N('A1'), vl, 0.7, { att: 0.08, rel: 0.12 });
  n('A3', 'E4', 'A4', 'D5').forEach((m, i) => I.strings(co + 0.05, m, vl - 0.05, 0.72, { trem: 13, pts: [[0.12, 0.3], [vl - 0.05, 1]], rel: 0.12, pan: lerp(0.3, -0.3, i / 3) }));
  for (let tt = co + 0.3, k = 0; tt < V - 0.02; tt += BEAT / 8, k++) D.timp(tt, N('A2'), lerp(0.1, 0.5, (tt - co) / vl) * (k % 2 ? 0.8 : 1));
  ladder(DMAJ, N('A4'), N('A5')).forEach((m, k) => { const tt = V - BEAT + k * BEAT / 8; I.strings(tt, m, 0.11, 0.6 + k * 0.06, { att: 0.02, rel: 0.12, vib: 0, pan: -0.35 }); });
  gliss(A, V - 0.85, 0.8, N('A2'), N('C#7'), 0.6);
  D.cymbal(V, vl, 1, 3);
  fx.riser(V - 1.5, 1.5, 0.45);
}

// ------------------------------------------------------------- the reveal, the run
const VCH = [
  { sub: 'D2', pad: ['D3', 'A3', 'F#4', 'A4'] },
  { sub: 'D2', pad: ['D3', 'B3', 'G4', 'B4'] },
  { sub: 'B1', pad: ['B2', 'F#3', 'D4', 'F#4'] },
  { sub: 'A1', pad: ['A2', 'E3', 'C#4', 'E4'] },
];
// rolling harp 16ths over a chord, two octaves up and back
function harpArp(A, t0, chord, v, len = 8) {
  const tones = [...n(...chord), ...n(...chord).map(m => m + 12)].sort((a, b) => a - b);
  for (let k = 0; k < len; k++) { const i = k % (tones.length * 2 - 2); A.inst.harp(t0 + k * S16, tones[i < tones.length ? i : tones.length * 2 - 2 - i], v * (k % 4 ? 0.75 : 1)); }
}
function vista(A) {
  const { inst: I, fx, drums: D } = A, V = C.vista;
  // THE reveal: the film's mix peak. Low drum on the downbeat, the full theme, a big warm D.
  D.gran(V, 0.85); D.timp(V, N('D2'), 0.9); D.timp(V + 0.02, N('D3'), 0.45);
  n('D4', 'A4', 'D5', 'F#5', 'A5', 'D6').forEach((m, k) => I.harp(V + k * 0.018, m, 0.9));
  I.glock(V, N('D6'), 0.8); I.glock(V, N('A6'), 0.6);
  VCH.forEach((ch, k) => {
    const t = V + k * H, lv = [1, 1, 0.97, 0.9][k];
    I.sub(t, N(ch.sub), H - 0.05, 0.8 * lv, { att: 0.06, rel: 0.4 });
    ch.pad.forEach((nm, i) => I.strings(t, N(nm), H - 0.03, 1.25 * lv, { att: k ? 0.2 : 0.06, rel: 0.5, pan: lerp(0.35, -0.3, i / 3) }));
    I.choir(t, n(...ch.pad.slice(1)), H - 0.05, 1.4 * lv, { att: k ? 0.5 : 0.15, rel: 0.8, pan: -0.2 });
    I.choir(t, n(...ch.pad.slice(1)).map(m => m + 12), H - 0.05, 0.8 * lv, { att: 0.5, rel: 0.8, pan: 0.3 });
    harpArp(A, t, ch.pad, 0.5 * lv);
    if (k > 1) D.timp(t, N(ch.sub) + 12, 0.5);
  });
  theme(T1, V, (t, m, d, i) => {
    I.strings(t, m, d, 1.9, { att: 0.06, rel: 0.4, pan: -0.35 });
    I.strings(t, m - 12, d, 1.4, { att: 0.06, rel: 0.4, pan: 0.2 });
    I.horn(t, m - 12, d * 0.95, 1.3);
    I.piano(t, m, 1.0, { dur: d + 0.5 });
    if (i % 2) I.glock(t, m + 12, 0.7);
  });

  // running the gold trace: the answer phrase, lighter and moving; LEDs bloom as it passes
  const R = C.run, RCH = [J[0], J[1], { bass: 'A2', ost: ['E4', 'A4', 'C#5'] }];
  const segs = Math.ceil((C.chip - R) / H - 0.01);
  for (let k = 0; k < segs; k++) {
    const t = R + k * H, len = Math.min(8, Math.round((C.chip - t) / S16));
    pulse(A, t, RCH[k], { mar: 0.5, bass: 0.7, perc: 0.4, shake: 0.5, len });
  }
  [['A3', 'D4', 'F#4'], ['B3', 'D4', 'G4']].forEach((ch, k) => ch.forEach((nm, i) => I.strings(R + k * H, N(nm), H - 0.05, 0.5, { att: 0.2, rel: 0.4, pan: lerp(0.3, -0.2, i / 2) })));
  theme(T2, R, (t, m, d, i) => {
    const dd = Math.min(d, C.chip - t);
    I.strings(t, m - 12, dd, 0.95, { att: 0.07, rel: i === 5 ? 0.08 : 0.3, pan: 0.15 }); I.horn(t, m - 12, dd * 0.95, 0.6, { rel: i === 5 ? 0.08 : 0.3 }); I.pizz(t, m - 12, 0.5);
    if (i === 5) I.strings(t, m, dd, 1.0, { pts: [[0.08, 0.6], [dd, 1.2]], rel: 0.08, pan: -0.35 });
  });
  const nLed = Math.floor((C.leap - R) / (S16 * 1.5)) + 1, led = ladder(DPENT, N('D5'), N('D8'));
  for (let i = 0; i < nLed; i++) {
    const t = R + i * S16 * 1.5, pan = lerp(-0.6, 0.6, i / (nLed - 1));
    I.glock(t, led[i], 0.45, { pan }); I.ping(t, mtof(led[i]) * 2, 0.012, 0.09, pan);
  }
  // the leap: a lift... then the cut
  const lf = C.leap, ll = C.chip - lf;
  fx.chirp(lf, 800, 2400, 0.14, 0.7);
  fx.whoosh(lf, ll, 0.7, 500, 6500, { peak: 0.92, pan: [[0, -0.3], [ll, 0.3]] });
  gliss(A, lf + 0.15, ll - 0.25, N('A3'), N('E7'), 0.55);
  n('A2', 'E3', 'A3', 'C#4', 'G4').forEach((m, i) => I.strings(R + BAR, m, C.chip - R - BAR, 0.85, { pts: [[0.25, 0.5], [C.chip - R - BAR, 1.15]], rel: 0.08, pan: lerp(0.3, -0.3, i / 4) }));
  I.sub(R + BAR, N('A1'), C.chip - R - BAR, 0.7, { att: 0.1, rel: 0.06 });
  D.cymbal(C.chip - 0.03, ll, 0.55, 0.2);
}

// ------------------------------------------------------------- Act III: inside the processor
function chip(A) {
  const { inst: I, fx } = A, c = C.chip, T = C.touch, hush = T - 0.72;
  // vast, dark, hushed: one held high note over a low pad. Someone is sleeping.
  I.air(c + 0.15, N('F#6'), hush - c - 0.15, 0.13, { att: 2.2, rel: 0.3, pan: -0.2 });
  I.sub(c + 0.2, N('B1'), hush - c - 0.2, 0.08, { att: 2.5, rel: 0.3 });
  I.pad(c + 0.2, n('B2', 'F#3'), hush - c - 0.2, 0.1, { cut: 320, att: 2.5, rel: 0.3 });
  for (let t = c + 0.7; t + 3 < hush; t += BAR) fx.breath(t, 1, 0.15);
  I.celesta(c + 2.3, N('B6'), 0.07, { rev: 1.2, pan: -0.6 }); I.celesta(c + 4.2, N('F#7'), 0.05, { rev: 1.2, pan: 0.6 });   // far-off glints: scale
  // the close two-shot
  n('D3', 'F#3').forEach((m, i) => I.strings(C.two, m, hush - C.two, 0.07, { att: 1.4, rel: 0.3, pan: i ? 0.2 : -0.2 }));
  // a hesitant reach: thin tremolo, the spark's small question
  const rl = hush - C.reach;
  n('F#5', 'A5').forEach((m, i) => I.strings(C.reach, m, rl, 0.09, { trem: 13, hp: 900, pts: [[0.5, 0.55], [rl - 0.15, 1], [rl, 0.5]], rel: 0.12, rev: 0.25, pan: i ? 0.3 : -0.3 }));
  fx.chirp(C.reach + 0.12, 1250, 1480, 0.1, 0.25); fx.fizz(C.reach, rl, 0.12, { rate: 16 });
  // ...and for the last moment before the touch: nothing but the room.
}

function touch(A) {
  const { inst: I, fx, drums: D } = A, T = C.touch, W = C.words, G = C.gather, Rl = C.release;
  // the touch: one pure warm bell, a low bloom, then warmth opens
  I.bell(T, N('D5'), 0.8, { rev: 0.75 }); I.bell(T, N('D4'), 0.35, { rev: 0.6 });
  I.sub(T, N('D2'), W - T, 0.35, { pts: [[0.9, 1], [2.2, 0.7], [W - T, 0.55]], rel: 0.5 });
  A.hiss(T, { dur: 2.5, g: 0.05, hp: 55, type: 'lowpass', f0: 160, fpts: [[1.2, 520], [2.5, 200]], q: 0.5, pts: [[1.0, 1], [2.5, 0]], rel: 0.3, brown: true, dest: A.buses.amb });
  I.pad(T + 0.05, n('D3', 'A3', 'E4', 'A4'), W - T, 0.7, { cut: 230, cutPts: [[0.3, 260], [2.6, 2600]], att: 1.4, rel: 1.2 });
  I.choir(T + 0.8, n('A3', 'D4', 'A4'), W - T - 0.8, 0.32, { att: 1.6, rel: 1.2 });
  // Claude's eyes open: the blink, answered a fifth lower and warmer
  blink(A, C.wake, -7, 0.55); I.piano(C.wake, N('G4'), 0.34); I.piano(C.wake + 0.14, N('D5'), 0.38);
  fx.chirp(C.wake + 0.75, 1300, 1900, 0.09, 0.45, 0.3);                     // the spark, delighted
  // they see each other: a tender statement of the theme, piano and strings
  I.piano(C.greet, N('A3'), 0.42, { dur: 1.5 });
  theme(T1, W, (t, m, d, i) => { I.piano(t, m - 12, i % 2 ? 0.6 : 0.48, { dur: d + 1.4, rel: 0.5 }); if (i % 2) I.strings(t, m - 12, d, 0.32, { att: 0.25, rel: 0.6, pan: -0.3 }); });
  VCH.forEach((ch, k) => {
    const t = W + k * H, last = k === 3, len = last ? Rl - t : H;
    I.piano(t, N(ch.sub), 0.34, { dur: 3 }); I.piano(t + 0.03, N(ch.sub) + 12, 0.28, { dur: 3 });
    I.sub(t, N(ch.sub), len - 0.05, 0.25, { att: 0.3, rel: 0.4 });
    ch.pad.forEach((nm, i) => I.strings(t, N(nm), len - 0.03, 0.26, { att: 0.5, rel: last ? 0.15 : 0.7, pan: lerp(0.3, -0.3, i / 3), pts: last ? [[0.25, 0.7], [len - 0.03, 3.2]] : null }));
  });
  // the prompt drifts down as glowing letters: delicate descending glints
  const r = rng(404), gl = ladder(DPENT, N('A5'), N('D7')).reverse(), nG = 13, wl = C.wordsLand - W;
  for (let k = 0; k < nG; k++) {
    const u = k / (nG - 1), m = gl[clamp(Math.round(u * (gl.length - 1) + (r() - 0.5) * 1.6), 0, gl.length - 1)], pan = (r() - 0.5) * 1.2;
    I.glock(W + 0.15 + (wl - 0.35) * u + (r() - 0.5) * 0.08, m, 0.2 + r() * 0.08, { pan });
  }
  A.hiss(C.wordsLand, { g: 0.06, type: 'lowpass', f0: 320, a: 0.01, tau: 0.06 });
  I.harp(C.wordsLand, N('G3'), 0.45); I.celesta(C.wordsLand, N('B5'), 0.3); I.celesta(C.wordsLand + 0.07, N('D6'), 0.26);
  // the idea: a bright "aha"
  I.glock(C.idea - 0.1, N('F#6'), 0.3); I.glock(C.idea - 0.05, N('A6'), 0.36); I.glock(C.idea, N('D7'), 0.62); I.celesta(C.idea, N('D6'), 0.5);
  [0.12, 0.2, 0.31].forEach((dt, k) => I.ping(C.idea + dt, mtof(N('A7')) * [1, 1.335, 1.5][k], 0.02, 0.1, [0.3, -0.3, 0.1][k]));
  fx.chirp(C.idea + 0.06, 1500, 2400, 0.08, 0.5, -0.3);
  // gathering: riser, tremolo swell
  const gd = Rl - G;
  fx.riser(G, gd, 0.55);
  n('E4', 'A4', 'E5').forEach((m, i) => I.strings(G, m, gd, 0.75, { trem: 13, pts: [[0.1, 0.15], [gd, 1]], rel: 0.12, pan: lerp(-0.3, 0.3, i / 2) }));
  for (let tt = Rl - BEAT, k = 0; tt < Rl - 0.02; tt += BEAT / 8, k++) D.timp(tt, N('A2'), 0.12 + k * 0.04);
  gliss(A, Rl - 0.75, 0.7, N('A3'), N('C#7'), 0.5);
  D.cymbal(Rl, gd, 0.75, 2.4);
}

// ------------------------------------------------------------- the flock
function release(A) {
  const { inst: I, fx, drums: D } = A, Rl = C.release, P = C.reply, wd = C.white - Rl;
  D.gran(Rl, 0.55); D.timp(Rl, N('D2'), 0.6);
  n('D4', 'A4', 'D5', 'F#5', 'A5').forEach((m, k) => I.harp(Rl + k * 0.018, m, 0.6));
  // the theme returns, soaring; the answer phrase hangs on the dominant until the screen
  const CH = [
    { sub: 'D2', pad: ['D3', 'A3', 'F#4', 'A4'], ost: ['D4', 'A4', 'D5'] },
    { sub: 'G1', pad: ['D3', 'B3', 'G4', 'B4'], ost: ['G4', 'B4', 'E5'] },
    { sub: 'A1', pad: ['E3', 'A3', 'D4', 'G4'], ost: ['E4', 'A4', 'D5'] },
    { sub: 'A1', pad: ['E3', 'A3', 'C#4', 'G4'], ost: ['E4', 'A4', 'C#5'] },
  ];
  CH.forEach((ch, k) => {
    const t = Rl + k * H, lv = [0.8, 0.92, 0.95, 1.0][k], end = k === 3;
    I.sub(t, N(ch.sub), H - 0.05, 0.7 * lv, { att: 0.08, rel: end ? 0.15 : 0.4 });
    ch.pad.forEach((nm, i) => I.strings(t, N(nm), H - 0.03, 1.0 * lv, { att: k ? 0.2 : 0.07, rel: end ? 0.2 : 0.5, pan: lerp(0.35, -0.3, i / 3), pts: end ? [[0.2, 1], [H - 0.03, 1.3]] : null }));
    if (k) I.choir(t, n(...ch.pad.slice(1)), H - 0.05, 1.2 * lv, { att: 0.5, rel: end ? 0.25 : 0.8, pan: -0.2 });
    harpArp(A, t, ch.pad, 0.42 * lv);
    pulse(A, t, { bass: ch.sub, ost: ch.ost }, { mar: 0.34, bass: 0, perc: 0, shake: k ? 0.4 : 0.25 });
    if (k) D.timp(t, N(ch.sub) + 12, 0.45);
  });
  theme(T2, Rl, (t, m, d, i) => {
    const dd = Math.min(d, P - t), hang = i === 5;
    I.strings(t, m, dd, 1.6, { att: 0.07, rel: hang ? 0.25 : 0.4, pan: -0.35, pts: hang ? [[0.1, 0.8], [dd, 1.25]] : null });
    I.strings(t, m - 12, dd, 1.25, { att: 0.07, rel: hang ? 0.25 : 0.4, pan: 0.2 });
    if (t >= C.ascend - 0.01) I.horn(t, m - 12, dd * 0.97, 1.2, { rel: 0.25 });
    I.piano(t, m, 0.9, { dur: d + 0.5 });
    if (i % 2) I.glock(t, m + 12, 0.45);
  });
  // the flock: a flutter of many tiny soft notes, climbing
  const r = rng(2024), lad = ladder(DPENT, N('A5'), N('C#8'));
  for (let t = Rl; t < C.white + 0.2;) {
    const u = clamp((t - Rl) / wd, 0, 1);
    t += -Math.log(1 - r() * 0.98) / (u < 0.07 ? 36 : 23 - 9 * u);
    const m = lad[clamp(Math.round((lerp(0.12, 0.72, u) + (r() - 0.5) * 0.5) * (lad.length - 1)), 0, lad.length - 1)];
    I.ping(t, mtof(m), (0.017 + r() * 0.019) * (1 - 0.3 * u), 0.05 + r() * 0.07, (r() - 0.5) * 1.6, 0.5);
  }
  fx.flutter(Rl, wd, 1, { pts: [[0.25, 1], [wd * 0.5, 0.55], [wd, 0.35]] });
  fx.whoosh(Rl - 0.1, 1.6, 0.5, 600, 4200, { peak: 0.35, pan: [[0, -0.4], [1.6, 0.4]] });
  fx.chirp(Rl + 0.05, 1000, 2600, 0.2, 0.5, 0.3);
  // into the light of the screen
  const wl = P - C.white;
  for (let tt = P - BEAT * 1.5, k = 0; tt < P - 0.02; tt += BEAT / 8, k++) D.timp(tt, N('A2'), 0.1 + k * 0.03);
  D.cymbal(P - 0.02, wl + 1.2, 0.9, 1.0);
  A.hiss(C.white - 0.2, { dur: wl + 0.2, g: 0.1, type: 'highpass', f0: 1200, q: 0.4, pts: [[0.2, 0.15], [wl + 0.2, 1]], rel: 0.22, rev: 0.4 });
  A.tone(C.white - 0.2, { type: 'sawtooth', f0: mtof(N('A4')), f1: mtof(N('A5')), dur: wl + 0.2, g: 0.03, pts: [[0.2, 0.2], [wl + 0.2, 1]], rel: 0.1, lp: 3000, rev: 0.4, dest: A.buses.music });
}

// ------------------------------------------------------------- the answer, home
function reply(A) {
  const { inst: I, fx } = A, P = C.reply;
  // the dominant resolves on a single quiet note: the screen
  I.celesta(P, N('D6'), 0.55); I.piano(P, N('D6'), 0.34, { dur: 3 }); I.piano(P + 0.02, N('D3'), 0.36, { dur: 4 }); I.piano(P + 0.05, N('A3'), 0.3, { dur: 4 });
  // each line of the poem: one hop of the theme over a gentle chord, and the soft ticks of text landing
  const LCH = [['D3', 'A3', 'F#4'], ['G2', 'D3', 'B3', 'E4'], ['B2', 'F#3', 'D4'], ['A2', 'E3', 'C#4']];
  C.line.forEach((t, i) => {
    LCH[i].forEach((nm, k) => I.piano(t + k * 0.04, N(nm), 0.3, { dur: 3.2, rel: 0.6 }));
    const [a, b] = [T1[i * 2], T1[i * 2 + 1]];
    I.piano(t, N(a[1]), 0.42, { dur: 2 }); I.piano(t + E8, N(b[1]), 0.48, { dur: 3 }); I.celesta(t + E8, N(b[1]), 0.3);
    fx.ticks(t + 0.02, clamp(Math.round(POEM[i].length / 3), 6, 10), 1, -0.25);
  });
  // the cursor blinks: it has eyes
  fx.zap(C.cursor, { dur: 0.04, v: 0.4, notes: n('D6', 'A6'), pan: 0.1 });
  blink(A, C.cursor + 0.07, 0, 0.62);
  I.piano(C.cursor + 0.21, N('D3'), 0.34, { dur: 4 }); I.piano(C.cursor + 0.25, N('A3'), 0.3, { dur: 4 });
  // home: the room again, warmer. IV, then the theme's first two hops, and it finally comes to rest on D.
  const hm = C.home, F = C.fadeOut, tF = F - BAR, end = C.end - F;
  I.pad(hm, n('G2', 'D3', 'A3', 'B3'), tF - hm, 0.4, { cut: 800, att: 0.9, rel: 1.0 });
  I.choir(hm + 0.2, n('B3', 'D4', 'G4'), tF - hm - 0.2, 0.25, { vowel: 'oo', att: 0.9, rel: 1.0 });
  I.piano(hm, N('G2'), 0.36, { dur: 3 }); I.piano(hm + 0.04, N('D4'), 0.3, { dur: 3 }); I.piano(hm + BEAT, N('B4'), 0.34, { dur: 2.5 }); I.piano(hm + BEAT * 1.5, N('A4'), 0.3, { dur: 2.5 });
  [[0, ['D3', 'A3', 'F#4']], [H, ['G2', 'D3', 'B3']]].forEach(([dt, ch]) => {
    ch.forEach((nm, k) => { I.piano(tF + dt + k * 0.035, N(nm), 0.34, { dur: 3.5, rel: 0.6 }); I.strings(tF + dt, N(nm) + (k ? 0 : 12), H, 0.16, { att: 0.6, rel: 0.9, pan: lerp(0.3, -0.3, k / 2) }); });
  });
  T1.slice(0, 4).forEach(([p, nm], i) => { I.piano(tF + p * E8, N(nm), i % 2 ? 0.52 : 0.44, { dur: 3, rel: 0.6 }); if (i % 2) I.celesta(tF + p * E8 + 0.012, N(nm) + 12, 0.18); });
  n('D2', 'A2', 'D3', 'F#4', 'A4').forEach((m, k) => I.piano(F + k * 0.045, m, 0.32));
  I.piano(F, N('D5'), 0.42); I.celesta(F, N('D6'), 0.36); I.glock(F + 0.05, N('A6'), 0.16);
  n('D3', 'A3', 'F#4').forEach((m, k) => I.strings(F, m, end, 0.16, { pts: [[0.5, 1], [end, 0.3]], rel: 0.4, pan: lerp(0.3, -0.3, k / 2) }));
}

// ------------------------------------------------------------- master moves
function automation(A, duration) {
  const m = A.buses.master.gain, hb = A.halls.b.ret.gain, lv = m.value;
  m.setValueAtTime(0, 0); m.linearRampToValueAtTime(lv, Math.max(0.2, C.room));
  // the held breath before the touch: nothing rings
  hb.setValueAtTime(hb.value, C.touch - 0.72); hb.setTargetAtTime(0.02, C.touch - 0.72, 0.05); hb.setTargetAtTime(0.42, C.touch - 0.004, 0.003);
  // the last chord rings and fades to silence
  const f0 = C.fadeOut + 0.5, tau = (duration - f0) / 3.6, tE = duration - 0.3;
  m.setValueAtTime(lv, f0); m.setTargetAtTime(0, f0, tau);
  m.setValueAtTime(lv * Math.exp(-(tE - f0) / tau), tE); m.linearRampToValueAtTime(0, duration - 0.04);
}

// 16-bit PCM WAV
export function toWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length;
  const out = new Uint8Array(44 + len * ch * 2);
  const v = new DataView(out.buffer);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, len * ch * 2, true);
  const chans = [...Array(ch)].map((_, i) => buf.getChannelData(i));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const s = Math.max(-1, Math.min(1, chans[c][i]));
    v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return out;
}
