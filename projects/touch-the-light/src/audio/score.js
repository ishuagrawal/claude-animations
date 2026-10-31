// The soundtrack: two tremolo-pad swells (first touch, the reveal) and a resolving one under the
// title, with glassy touch ticks and Foley-like light sounds placed on the picture's beats.
import { makeEngine, mtof } from './engine.js';
import { T } from '../timeline.js';

const SR = 48000;

export async function renderSoundtrack(duration) {
  const ctx = new OfflineAudioContext(2, Math.ceil(SR * duration), SR);
  const E = makeEngine(ctx);
  const { tone, hiss, tremPad, R } = E;

  // ---- sound vocabulary ----
  const tick = (t, v = 1, pan = 0, f = 4200) => {
    hiss(t, { dur: 0.012, g: 0.16 * v, f0: f, q: 4, pan, rev: 0.25, room: 0.4 });
    tone(t, { f0: f * 0.62, dur: 0.05, g: 0.05 * v, a: 0.001, pan, rev: 0.3 });
  };
  const glass = (t, f, v = 1, pan = 0, dur = 0.9) => {
    [[1, 1], [2.76, 0.28], [5.4, 0.09]].forEach(([r, a]) => tone(t, { f0: f * r, dur: dur * (r > 1 ? 0.35 : 1), g: 0.07 * v * a, a: 0.002, pan, rev: 0.55, dry: 0.8 }));
  };
  const touch = (t, v = 1, pan = 0) => { // fingertip landing on glass: soft tap + airy ping
    hiss(t, { dur: 0.03, g: 0.12 * v, type: 'lowpass', f0: 1400, pan, room: 0.3 });
    tone(t, { f0: 180, f1: 120, dur: 0.06, g: 0.12 * v, pan });
    glass(t + 0.004, 2637, 0.55 * v, pan, 0.7);
  };
  const air = (t, dur, f0, f1, v = 1, pan = 0, q = 1.1) => hiss(t, { dur: dur * 0.6, a: dur * 0.5, g: 0.07 * v, f0, f1, q, pan, rev: 0.35 });
  const sub = (t, v = 1, f0 = 70, dur = 1.2) => tone(t, { f0, f1: 34, dur, g: 0.5 * v, a: 0.01 });

  // ---- music: the reference's tremolo swells. First touch / the lid opening / the logo, resolving ----
  tremPad(T.touch + 0.05, [50, 57, 61, 64, 66, 69], { attack: 1.3, hold: 1.3, release: 2.4, g: 0.22, rate: 13, depth: 0.8, cut0: 500, cut1: 4200 });
  tremPad(T.lid[0] - 0.2, [43, 55, 59, 62, 66, 69, 73], { attack: 1.7, hold: 0.9, release: 2.6, g: 0.16, rate: 14, depth: 0.8, cut0: 520, cut1: 4600 });
  tremPad(T.carve - 0.5, [38, 50, 57, 61, 64, 66, 69], { attack: 1.0, hold: 2.6, release: 3.6, g: 0.17, rate: 12, rate1: 3, depth: 0.7, cut0: 450, cut1: 3800 });
  // a faint bed of air so the silences between beats stay alive
  hiss(0.2, { dur: 1.5, a: 1.2, hold: duration - 2.6, g: 0.012, type: 'lowpass', f0: 1100, q: 0.5, rev: 0.3 });
  tone(T.flick[0] - 1.2, { f0: mtof(38), dur: 3.2, g: 0.05, a: 1.2, lp: 300 });

  // ---- the stroke ----
  touch(T.touch, 1);
  sub(T.touch, 0.12, 60, 0.6);
  for (let k = 0; k < 9; k++) {
    const tt = T.stroke[0] + 0.2 + (k / 9) * (T.stroke[1] - T.stroke[0] - 0.6) + (R() - 0.5) * 0.15;
    tick(tt, 0.35 + R() * 0.4, (R() - 0.5) * 1.2, 3000 + R() * 3000);
  }
  air(T.stroke[0] + 0.1, 2.2, 500, 2600, 0.8, -0.2, 0.7);
  glass(T.islandPass, 3136, 0.55, 0.1, 0.9);                     // passing the hidden island
  // the island breathes: a soft rise and fall
  tone(T.island[0], { f0: 520, f1: 790, dur: 0.42, g: 0.05, a: 0.05, rev: 0.5, lp: 2500 });
  tone(T.island[1] - 0.5, { f0: 790, f1: 520, dur: 0.45, g: 0.045, a: 0.05, rev: 0.5, lp: 2500 });
  glass(T.island[0] + 0.38, 2093, 0.35, 0, 1.0);

  // ---- flick, overscroll, rubber-band ----
  const [fd, fm, fu] = T.flick;
  touch(fd, 0.8, 0.3);
  hiss(fm, { dur: 0.4, a: fu - fm, g: 0.1, f0: 800, f1: 5200, q: 1.3, pan: 0.2, rev: 0.25 });
  tone(fu + 0.08, { f0: 150, f1: 95, dur: 0.5, g: 0.16, a: 0.02 });                // the elastic give
  tone(fu + 0.1, { f0: 380, f1: 300, dur: 0.35, g: 0.025, a: 0.02, rev: 0.3 });
  hiss(fu + 0.15, { dur: 0.6, a: 0.05, g: 0.05, f0: 3000, f1: 900, q: 1, pan: -0.2, rev: 0.4 });

  // ---- pinch: the light gathers to one point ----
  const [pd, pm, pmeet] = T.pinch;
  touch(pd, 0.8, -0.5); touch(pd + 0.05, 0.8, 0.5);
  hiss(pm, { dur: 0.2, a: pmeet - pm, g: 0.07, f0: 600, f1: 7000, q: 1.6, rev: 0.4 });
  for (let k = 0; k < 7; k++) { const q = k / 7; glass(pm + Math.pow(q, 0.7) * (pmeet - pm - 0.05), 1500 * Math.pow(2, q * 1.6), 0.3 + q * 0.3, (k % 2 ? 0.5 : -0.5) * (1 - q), 0.35); }
  glass(pmeet, 4699, 0.7, 0, 1.2);
  sub(pmeet, 0.3, 75, 1.2);

  // ---- one pixel: a note for each emitter, folding into one ----
  const [x0, x1] = T.pixel;
  glass(x0 + 0.12, 1319, 0.7, -0.5, 1.6); glass(x0 + 0.2, 1661, 0.7, 0, 1.6); glass(x0 + 0.28, 1976, 0.7, 0.5, 1.6);
  tone(x0 + 0.1, { f0: mtof(81), dur: 1.2, g: 0.02, a: 0.3, rev: 0.6 });
  glass(x1 - 0.3, 2637, 0.8, 0, 1.4);
  hiss(x1 - 0.5, { dur: 0.3, a: 0.4, g: 0.05, f0: 6000, f1: 2500, q: 2, rev: 0.4 });

  // ---- the line opens like a lid ----
  air(T.line[0], 0.7, 900, 3600, 0.7, 0);
  tick(T.lid[0] + 0.02, 0.5, -0.2, 2600);
  tone(T.lid[0], { f0: 196, f1: 294, dur: 1.8, g: 0.03, a: 1.2, rev: 0.5, lp: 1800 });

  // ---- the sheet of light and the carved logo ----
  hiss(T.emit[0], { dur: 1.2, a: T.carve - T.emit[0], g: 0.05, f0: 1500, f1: 7000, q: 0.9, rev: 0.5 });
  glass(T.carve, 1175, 1.0, 0, 3.0); glass(T.carve + 0.012, 1760, 0.75, -0.1, 2.6); glass(T.carve + 0.024, 2794, 0.5, 0.1, 2.2);
  sub(T.carve, 0.45, 62, 2.2);
  // the drain: a descending trickle back to the edge
  for (let k = 0; k < 8; k++) { const q = k / 8; glass(T.drain[0] + q * (T.drain[1] - T.drain[0]), 3520 * Math.pow(2, -q * 1.1), 0.28, k % 2 ? 0.4 : -0.4, 0.45); }
  // the edge cools and goes out
  glass(T.fade[0] + 0.1, 1175, 0.5, 0, 2.6);
  hiss(T.fade[0], { dur: 1.4, a: 0.02, g: 0.03, type: 'highpass', f0: 6000, rev: 0.7 });

  const buf = await ctx.startRendering();
  // fade the last half-second
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const d = buf.getChannelData(c), n = Math.floor(SR * 0.6);
    for (let i = 0; i < n; i++) d[d.length - 1 - i] *= i / n;
  }
  return buf;
}

export function toWav(buf) {
  const ch = buf.numberOfChannels, n = buf.length, bytes = new Uint8Array(44 + n * ch * 2), v = new DataView(bytes.buffer);
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + n * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, buf.sampleRate, true);
  v.setUint32(28, buf.sampleRate * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const s = Math.max(-1, Math.min(1, data[c][i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
  return bytes;
}
