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

  // ---- music: Dmaj9 swell / G lydian swell / Dmaj9 resolving with a slowing tremolo ----
  tremPad(T.touch + 0.05, [50, 57, 61, 64, 66, 69], { attack: 1.3, hold: 1.3, release: 2.2, g: 0.22, rate: 13, depth: 0.8, cut0: 500, cut1: 4200 });
  tremPad(T.pull[0] - 0.1, [43, 55, 59, 62, 66, 69, 73], { attack: 1.5, hold: 1.2, release: 3.2, g: 0.17, rate: 14, depth: 0.8, cut0: 520, cut1: 4800 });
  tremPad(T.pour[0] - 0.2, [50, 62, 66, 69, 73], { attack: 0.9, hold: 0.8, release: 1.8, g: 0.07, rate: 9, depth: 0.5, cut0: 900, cut1: 3000 });
  tremPad(T.text1[0] - 0.4, [38, 50, 57, 61, 64, 66, 69], { attack: 1.4, hold: 1.8, release: 3.6, g: 0.15, rate: 12, rate1: 3, depth: 0.7, cut0: 450, cut1: 3600 });
  // a low bed under the reveal and the close
  tone(T.pull[0], { f0: mtof(31), dur: 4.5, g: 0.11, a: 1.4, lp: 200 });
  tone(T.close[0], { f0: mtof(26), dur: 2.4, g: 0.1, a: 1.0, lp: 180 });

  // a faint bed of air and a low drone so the silences between beats stay alive
  hiss(0.2, { dur: 1.5, a: 1.2, hold: duration - 2.6, g: 0.014, type: 'lowpass', f0: 1100, q: 0.5, rev: 0.3 });
  for (const [m, g] of [[38, 0.022], [45, 0.013], [62, 0.005]]) {
    const o = ctx.createOscillator(); o.frequency.value = mtof(m);
    const gn = ctx.createGain(); gn.gain.setValueAtTime(0.0001, T.seal); gn.gain.linearRampToValueAtTime(g, T.seal + 1.2);
    gn.gain.setValueAtTime(g, T.pull[0] - 0.3); gn.gain.linearRampToValueAtTime(0.0001, T.pull[0] + 1.0);
    const lp = ctx.createBiquadFilter(); lp.frequency.value = 600;
    o.connect(lp); lp.connect(gn); gn.connect(E.master); o.start(T.seal); o.stop(T.pull[0] + 1.2);
  }

  // ---- the gesture ----
  touch(T.touch, 1);
  sub(T.touch, 0.12, 60, 0.6);
  // hairline crackle riding the stroke (sparse, like the reference's ticks)
  for (let k = 0; k < 9; k++) {
    const tt = T.gest[0] + 0.25 + (k / 9) * (T.gest[1] - T.gest[0] - 0.6) + (R() - 0.5) * 0.15;
    tick(tt, 0.35 + R() * 0.4, (R() - 0.5) * 1.2, 3000 + R() * 3000);
  }
  air(T.gest[0] + 0.2, 2.4, 500, 2400, 0.8, -0.2, 0.7);
  // snap and seal
  hiss(T.snap, { dur: 0.35, g: 0.08, f0: 2500, f1: 600, q: 1.2, a: 0.04, rev: 0.3 });
  tone(T.snap + 0.05, { f0: 140, f1: 90, dur: 0.25, g: 0.18 });
  glass(T.seal, 1760, 1.1, 0, 1.6); glass(T.seal + 0.02, 2637, 0.8, 0.15, 1.4); glass(T.seal + 0.05, 3520, 0.5, -0.15, 1.2);
  sub(T.seal, 0.45, 80, 1.2);
  hiss(T.seal, { dur: 0.3, g: 0.07, type: 'highpass', f0: 5000, rev: 0.5 });
  // drop into the camera island
  tone(T.pill[0] + 0.12, { f0: 900, f1: 1900, dur: 0.12, g: 0.06, a: 0.002, rev: 0.4 });
  glass(T.pill[0] + 0.3, 3136, 0.6, 0, 0.6);

  // ---- touches on the display ----
  const [sd, sm, su] = T.swipe;
  touch(sd, 0.9, 0.3);
  hiss(sm, { dur: 0.5, a: 0.38, g: 0.11, f0: 900, f1: 5200, q: 1.3, pan: 0.2, rev: 0.25 });
  hiss(su, { dur: 0.7, a: 0.02, g: 0.09, f0: 4000, f1: 700, q: 1.1, pan: -0.5, rev: 0.4 });
  tick(su, 0.5, 0.1, 5200);
  const [pd, pm, pmeet] = T.pinch;
  touch(pd, 0.8, -0.5); touch(pd + 0.04, 0.8, 0.5);
  // the pinch draws light inward: rising shimmer that lands on a bell
  hiss(pm, { dur: 0.2, a: pmeet - pm, g: 0.07, f0: 600, f1: 7000, q: 1.6, rev: 0.4 });
  for (let k = 0; k < 7; k++) { const q = k / 7; glass(pm + Math.pow(q, 0.7) * (pmeet - pm - 0.05), 1500 * Math.pow(2, q * 1.6), 0.35 + q * 0.3, (k % 2 ? 0.5 : -0.5) * (1 - q), 0.35); }
  glass(pmeet, 2349, 0.85, 0, 2.2); glass(pmeet + 0.01, 3520, 0.5, 0.1, 1.6);
  sub(pmeet, 0.32, 75, 1.4);

  // ---- reveal: hinge, base, front edge ----
  tick(T.hinge[0] + 0.05, 0.6, 0, 3800);
  air(T.base[0], 0.9, 700, 3200, 0.9, -0.4);
  air(T.front[0], 0.5, 1500, 4500, 0.6, 0.3);
  tick(T.front[1] - 0.1, 0.4, 0.3, 4800);
  // light running along the edge
  hiss(T.rim[0] + 0.3, { dur: 1.2, a: 0.6, g: 0.035, f0: 6000, f1: 9000, q: 3, pan: -0.3, rev: 0.5 });

  // ---- the logo: leaf flick, then light pours down both sides ----
  tick(T.leaf[0], 0.6, 0.2, 5000);
  glass(T.leaf[0] + 0.1, 4186, 0.4, 0.2, 0.5);
  for (let k = 0; k < 10; k++) {
    const q = k / 10, tt = T.pour[0] + Math.pow(q, 0.8) * (T.pour[1] - T.pour[0] - 0.1);
    glass(tt, 3520 * Math.pow(2, -q * 1.2), 0.32, k % 2 ? 0.45 : -0.45, 0.4);
  }
  glass(T.pour[1], 1175, 0.9, 0, 2.6); glass(T.pour[1] + 0.012, 1760, 0.7, -0.1, 2.2); glass(T.pour[1] + 0.024, 2794, 0.45, 0.1, 1.8);
  sub(T.pour[1], 0.35, 70, 1.2);

  // ---- the lid closes ----
  hiss(T.close[0], { dur: 0.6, a: T.close[1] - T.close[0] - 0.15, g: 0.075, type: 'lowpass', f0: 300, f1: 1400, q: 0.6, rev: 0.2 });
  const land = T.close[1];
  tone(land, { f0: 110, f1: 46, dur: 0.35, g: 0.55 });              // soft, heavy contact
  hiss(land, { dur: 0.05, g: 0.1, type: 'lowpass', f0: 900, room: 0.5 });
  hiss(land + 0.012, { dur: 0.015, g: 0.08, f0: 3200, q: 3, room: 0.4 }); // magnet click
  // the line draws back into a point
  tone(T.line[0] + 0.1, { f0: 5200, f1: 2600, dur: 0.8, g: 0.018, a: 0.3, rev: 0.6 });
  glass(T.line[1], 3520, 0.6, 0, 1.2);
  // titles
  hiss(T.text1[0], { dur: 1.0, a: 0.5, g: 0.03, f0: 7000, q: 2, rev: 0.6 });
  sub(T.text2[0], 0.4, 62, 2.0);
  glass(T.text2[0] + 0.02, 1175, 0.55, 0, 3); glass(T.text2[0] + 0.03, 1760, 0.4, 0, 2.6);
  hiss(T.text2[0], { dur: 1.4, a: 0.02, g: 0.04, type: 'highpass', f0: 6000, rev: 0.7 });

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
