// Explainer kit on top of engine.js: the instruments and Foley this film needs (bright, light,
// friendly — the reference's VO-led explainer beds and UI sound design).
import { mtof } from './engine.js';

export function makeKit(A) {
  const { ctx, tone, hiss, R, buses: { music, sfx, amb }, prim: { out, env, gain, filt, osc, noise, ksBuffer } } = A;

  const K = {};
  // ---- instruments
  // nylon-ish ukulele: bright Karplus-Strong, short, strummed
  K.uke = (t, notes, { v = 1, dir = 1, len = 0.32, pan = 0.15 } = {}) => {
    const ns = dir > 0 ? notes : [...notes].reverse();
    ns.forEach((m, i) => {
      const s = ctx.createBufferSource(); s.buffer = ksBuffer(m, 0.72, 0.994, 1.2);
      const f = filt('lowpass', 5200, 0.6), g = gain(0);
      const tt = t + i * 0.011;
      g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.4 * v, tt + 0.002); g.gain.setTargetAtTime(0.0001, tt + len, 0.06);
      s.connect(f); f.connect(g); out(g, music, pan + (i - 1.5) * 0.06, 0.12);
      s.start(tt); s.stop(tt + len + 0.6);
    });
  };
  // marimba / kalimba: sine with a woody 4x partial and fast decay
  K.marimba = (t, m, v = 1, pan = 0, dest = music) => {
    tone(t, { f0: mtof(m), dur: 0.42, g: 0.3 * v, a: 0.002, dest, pan, rev: 0.15 });
    tone(t, { f0: mtof(m) * 3.98, dur: 0.07, g: 0.06 * v, a: 0.001, dest, pan });
    hiss(t, { dur: 0.012, g: 0.05 * v, f0: 2400, q: 2, dest, pan });
  };
  // glockenspiel
  K.glock = (t, m, v = 1, pan = 0, dest = music) => {
    [[1, 1], [2.76, 0.32], [5.4, 0.1]].forEach(([r, a]) => tone(t, { f0: mtof(m) * r, dur: r > 1 ? 0.35 : 0.9, g: 0.17 * v * a, a: 0.001, dest, pan, rev: 0.35 }));
  };
  // round bass: sine + soft triangle, plucky
  K.bass = (t, m, dur = 0.4, v = 1) => {
    const o1 = osc('sine', mtof(m)), o2 = osc('triangle', mtof(m));
    const g = gain(0), g2 = gain(0.35), lp = filt('lowpass', 900, 0.7);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.3 * v, t + 0.008); g.gain.setTargetAtTime(0.14 * v, t + 0.02, 0.1); g.gain.setTargetAtTime(0.0001, t + dur, 0.05);
    o1.connect(g); o2.connect(g2); g2.connect(lp); lp.connect(g); out(g, music, 0);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.4); o2.stop(t + dur + 0.4);
  };
  K.pad = (t, notes, dur, v = 1) => A.inst.pad(t, notes, dur, v * 0.8, 1500);
  K.kick = (t, v = 1) => {
    const o = osc('sine', 140); o.frequency.exponentialRampToValueAtTime(56, t + 0.08);
    const g = gain(0); env(g.gain, t, 0.5 * v, 0.002, 0.22); o.connect(g); out(g, music); o.start(t); o.stop(t + 0.45);
    hiss(t, { dur: 0.008, g: 0.12 * v, type: 'highpass', f0: 3500, dest: music });
  };
  K.clap = (t, v = 1) => { for (let i = 0; i < 3; i++) hiss(t + i * 0.009, { dur: 0.05 + (i === 2 ? 0.09 : 0), g: 0.22 * v, f0: 1700, q: 1.3, dest: music, rev: 0.25, pan: 0.05 }); };
  K.snap = (t, v = 1, pan = -0.2) => { hiss(t, { dur: 0.02, g: 0.28 * v, f0: 2600, q: 3, dest: music, pan, rev: 0.2 }); tone(t, { f0: 1800, f1: 900, dur: 0.02, g: 0.06 * v, dest: music, pan }); };
  K.shaker = (t, v = 1) => hiss(t, { dur: 0.05, g: 0.07 * v, type: 'highpass', f0: 7000, q: 0.7, a: 0.012, dest: music, pan: 0.3 });
  K.crash = (t, v = 1) => A.drums.crash(t, 0.55 * v);
  K.whistle = (t, m, dur, v = 1) => A.inst.whistle(t, m, dur, v * 1.4);

  // ---- Foley / UI sound design
  K.pop = (t, v = 1, f = 1, pan = 0) => { tone(t, { f0: 380 * f, f1: 1100 * f, dur: 0.07, g: 0.32 * v, a: 0.002, pan }); hiss(t, { dur: 0.025, g: 0.12 * v, f0: 2200 * f, q: 1.2, pan }); };
  K.bloop = (t, v = 1, f = 1, pan = 0) => tone(t, { f0: 300 * f, f1: 900 * f, dur: 0.11, g: 0.22 * v, a: 0.004, pan, rev: 0.15 });
  K.tick = (t, v = 1, pan = 0) => { hiss(t, { dur: 0.01, g: 0.18 * v, f0: 4200, q: 3, pan }); tone(t, { type: 'triangle', f0: 1400, dur: 0.02, g: 0.05 * v, a: 0.001, pan }); };
  K.click = (t, v = 1, pan = 0) => { hiss(t, { dur: 0.012, g: 0.3 * v, f0: 3200, q: 2.5, pan }); tone(t, { f0: 900, f1: 600, dur: 0.03, g: 0.1 * v, a: 0.001, pan }); };
  K.whoosh = (t, dur = 0.4, v = 1, f0 = 350, f1 = 3200, pan = 0) => A.fx.whoosh(t, dur, v * 0.9, f0, f1, pan);
  K.swish = (t, v = 1, pan = 0) => A.fx.swoosh(t, v * 0.8);
  K.ding = (t, v = 1, m = 88) => { K.glock(t, m, 1.2 * v, 0.1, sfx); K.glock(t + 0.004, m + 12, 0.35 * v, 0.1, sfx); };
  K.sparkle = (t, v = 1) => [0, 0.05, 0.1, 0.15].forEach((d, i) => tone(t + d, { f0: 2400 + i * 520, dur: 0.22, g: 0.045 * v, a: 0.001, rev: 0.45, pan: (i - 1.5) * 0.3 }));
  K.chime = (t, v = 1, base = 79) => [0, 4, 7, 12].forEach((iv, i) => K.glock(t + i * 0.06, base + iv, 0.7 * v, (i - 1.5) * 0.25, sfx));
  K.boing = (t, v = 1) => A.fx.boing(t, v * 0.55);
  K.land = (t, v = 1) => { tone(t, { f0: 130, f1: 70, dur: 0.1, g: 0.3 * v }); hiss(t, { dur: 0.05, g: 0.12 * v, type: 'lowpass', f0: 800 }); };
  K.sploosh = (t, dur = 0.8, v = 1) => {
    hiss(t, { dur: dur * 0.5, g: 0.3 * v, type: 'bandpass', f0: 500, f1: 2400, q: 0.8, a: dur * 0.3, rev: 0.25 });
    hiss(t + dur * 0.45, { dur: dur * 0.5, g: 0.22 * v, type: 'bandpass', f0: 2600, f1: 600, q: 0.8, a: 0.02, rev: 0.25 });
    for (let i = 0; i < 9; i++) { const tt = t + 0.05 + R() * dur * 0.9, f = 500 + R() * 900; tone(tt, { f0: f, f1: f * 2.6, dur: 0.06, g: 0.07 * v, a: 0.003, pan: (R() - 0.5) * 0.8, rev: 0.2 }); }
  };
  K.rattle = (t, v = 1) => { for (let i = 0; i < 10; i++) hiss(t + i * 0.022 + R() * 0.01, { dur: 0.02, g: (0.16 - i * 0.012) * v, f0: 3000 + R() * 3000, q: 2, pan: (R() - 0.5) * 0.6 }); tone(t, { f0: 2200, dur: 0.18, g: 0.03 * v, a: 0.001, rev: 0.2 }); };
  K.clink = (t, v = 1, pan = 0) => { const f = 2600 + R() * 2400; tone(t, { f0: f, dur: 0.16, g: 0.06 * v, a: 0.001, pan, rev: 0.25 }); tone(t, { f0: f * 1.5, dur: 0.08, g: 0.03 * v, a: 0.001, pan }); };
  K.typing = (t0, t1, rate = 11, v = 1) => { for (let tt = t0; tt < t1; tt += (0.6 + R() * 0.8) / rate) A.fx.key(tt, 0.55 * v, -0.4); };
  K.scribble = (t0, t1, v = 1) => { for (let tt = t0; tt < t1; tt += 0.07 + R() * 0.06) hiss(tt, { dur: 0.05 + R() * 0.06, g: 0.05 * v, f0: 3500 + R() * 2500, q: 1.4, a: 0.02, pan: 0.3 }); };
  K.glug = (t0, t1, v = 1) => { for (let tt = t0; tt < t1; tt += 0.11 + R() * 0.05) tone(tt, { f0: 220 + R() * 120, f1: 520 + R() * 200, dur: 0.07, g: 0.13 * v, a: 0.004, rev: 0.15, pan: 0.4 }); };
  K.uhoh = t => { K.marimba(t, 76, 1.1, 0, sfx); K.marimba(t + 0.18, 72, 1.1, 0, sfx); };
  K.flip = (t, v = 1) => { hiss(t, { dur: 0.12, g: 0.2 * v, f0: 1800, f1: 4000, q: 0.9, a: 0.04 }); hiss(t + 0.1, { dur: 0.05, g: 0.15 * v, f0: 1200, q: 1 }); };
  K.thump = (t, v = 1) => { tone(t, { f0: 150, f1: 70, dur: 0.12, g: 0.45 * v }); hiss(t, { dur: 0.04, g: 0.18 * v, f0: 900, q: 0.8 }); };
  K.snip = (t, v = 1) => { hiss(t, { dur: 0.03, g: 0.3 * v, type: 'highpass', f0: 5000, q: 0.7 }); tone(t, { f0: 3800, f1: 2400, dur: 0.04, g: 0.06 * v, a: 0.001 }); };
  K.reverse = (t, dur = 0.5, v = 1) => A.fx.reverse(t, dur, v * 0.7);
  K.riser = (t, dur, v = 1) => A.fx.riser(t, dur, v * 0.6);
  K.chip = (t, notes, v = 1) => notes.forEach((m, i) => tone(t + i * 0.055, { type: 'square', f0: mtof(m), dur: 0.05, g: 0.045 * v, a: 0.001, filter: ['lowpass', 4000] }));
  K.harp = (t, notes, v = 1) => notes.forEach((m, i) => { const s = ctx.createBufferSource(); s.buffer = ksBuffer(m, 0.45, 0.998, 1.8); const g = gain(0); const tt = t + i * 0.045; g.gain.setValueAtTime(0.0001, tt); g.gain.linearRampToValueAtTime(0.2 * v, tt + 0.003); g.gain.setTargetAtTime(0.0001, tt + 0.6, 0.25); s.connect(g); out(g, sfx, (i / notes.length - 0.5) * 0.8, 0.4); s.start(tt); s.stop(tt + 2); });
  K.squish = (t, v = 1) => { tone(t, { f0: 180, f1: 420, dur: 0.12, g: 0.25 * v, a: 0.01, vib: 25, vibRate: 30 }); hiss(t, { dur: 0.1, g: 0.08 * v, type: 'lowpass', f0: 1200 }); };
  K.paper = (t, v = 1) => A.fx.paper(t, 0.35, 0.8 * v, 0.1);
  K.room = (t, dur) => A.fx.roomTone(t, dur, 0.22);
  return K;
}
