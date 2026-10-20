// Small synth engine on an OfflineAudioContext: master chain, two reverbs, tones, noise and the
// tremolo pad. Everything is generated (no samples), deterministic, scheduled in absolute seconds.
import { rng } from '../core.js';

export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

export function makeEngine(ctx) {
  const SR = ctx.sampleRate;
  const R = rng(4242);

  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.12;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -22; glue.knee.value = 10; glue.ratio.value = 2; glue.attack.value = 0.02; glue.release.value = 0.3;
  const master = ctx.createGain(); master.gain.value = 1.8;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 28;
  master.connect(hp); hp.connect(glue); glue.connect(limiter); limiter.connect(ctx.destination);

  const noiseBuf = ctx.createBuffer(2, SR * 3, SR);
  for (let c = 0; c < 2; c++) { const d = noiseBuf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }

  const makeIR = (dur, decay, color) => {
    const b = ctx.createBuffer(2, Math.floor(SR * dur), SR);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < d.length; i++) {
        lp += ((R() * 2 - 1) - lp) * color;
        d[i] = lp * Math.pow(1 - i / d.length, decay) * (i < 400 ? i / 400 : 1);
      }
    }
    return b;
  };
  const hall = ctx.createConvolver(); hall.buffer = makeIR(4.2, 2.6, 0.28);
  const hallRet = ctx.createGain(); hallRet.gain.value = 0.42; hall.connect(hallRet); hallRet.connect(master);
  const room = ctx.createConvolver(); room.buffer = makeIR(1.2, 3.5, 0.5);
  const roomRet = ctx.createGain(); roomRet.gain.value = 0.3; room.connect(roomRet); roomRet.connect(master);

  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };
  const out = (node, { pan = 0, rev = 0, room: rm = 0, dry = 1 } = {}) => {
    const p = ctx.createStereoPanner(); p.pan.value = pan;
    const d = gain(dry); node.connect(d); d.connect(p); p.connect(master);
    if (rev > 0) { const s = gain(rev); node.connect(s); s.connect(hall); }
    if (rm > 0) { const s = gain(rm); node.connect(s); s.connect(room); }
  };
  const env = (param, t, peak, a, d) => {
    param.setValueAtTime(0.0001, t);
    param.linearRampToValueAtTime(peak, t + a);
    param.setTargetAtTime(0.0001, t + a, d / 4);
  };

  function tone(t, { type = 'sine', f0 = 440, f1 = null, dur = 0.2, g = 0.3, a = 0.004, pan = 0, rev = 0, room: rm = 0, dry = 1, lp = null }) {
    const o = osc(type, f0);
    if (f1 !== null) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const gn = gain(0); env(gn.gain, t, g, a, dur);
    let n = o;
    if (lp) { const f = filt('lowpass', lp); o.connect(f); n = f; }
    n.connect(gn); out(gn, { pan, rev, room: rm, dry });
    o.start(t); o.stop(t + a + dur * 1.5 + 0.2);
  }
  function hiss(t, { dur = 0.2, g = 0.3, type = 'bandpass', f0 = 2000, f1 = null, q = 0.8, a = 0.003, pan = 0, rev = 0, room: rm = 0, dry = 1, hold = 0 }) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = filt(type, f0, q);
    if (f1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + a + hold + dur * 0.5);
    const gn = gain(0);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.linearRampToValueAtTime(g, t + a);
    gn.gain.setValueAtTime(g, t + a + hold); gn.gain.setTargetAtTime(0.0001, t + a + hold, dur / 4);
    s.connect(f); f.connect(gn); out(gn, { pan, rev, room: rm, dry });
    s.start(t, R() * 2); s.stop(t + a + hold + dur * 1.5 + 0.2);
  }

  // The reference's signature: a chord of detuned saws/triangles under a fast amplitude tremolo,
  // swelling in and dying away. rate may glide (r0 -> r1).
  function tremPad(t, notes, { attack = 1.2, hold = 0.4, release = 2.2, g = 0.1, rate = 13, rate1 = null, depth = 0.75, cut0 = 700, cut1 = 3800, rev = 0.5 }) {
    const end = t + attack + hold + release;
    const f = filt('lowpass', cut0, 0.9);
    f.frequency.setValueAtTime(cut0, t);
    f.frequency.exponentialRampToValueAtTime(cut1, t + attack);
    f.frequency.exponentialRampToValueAtTime(cut0 * 1.2, end);
    const amp = gain(0);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(g * 0.35, t + attack * 0.55);
    amp.gain.linearRampToValueAtTime(g, t + attack);
    amp.gain.setValueAtTime(g, t + attack + hold);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    // tremolo: gain = (1 - depth/2) + depth/2 * sin
    const trem = gain(1 - depth / 2);
    const lfo = osc('sine', rate);
    if (rate1) lfo.frequency.exponentialRampToValueAtTime(rate1, end);
    const lg = gain(depth / 2); lfo.connect(lg); lg.connect(trem.gain);
    notes.forEach((m, i) => {
      for (const [type, det, lvl] of [['sawtooth', -7, 0.5], ['sawtooth', 6, 0.5], ['triangle', 0, 0.9]]) {
        const o = osc(type, mtof(m)); o.detune.value = det + (R() - 0.5) * 4;
        const og = gain(lvl / notes.length);
        const p = ctx.createStereoPanner(); p.pan.value = ((i / Math.max(1, notes.length - 1)) - 0.5) * 0.9;
        o.connect(og); og.connect(p); p.connect(f);
        o.start(t); o.stop(end + 0.1);
      }
    });
    f.connect(trem); trem.connect(amp);
    out(amp, { rev });
    lfo.start(t); lfo.stop(end + 0.1);
  }

  return { ctx, SR, R, tone, hiss, tremPad, mtof, master };
}
