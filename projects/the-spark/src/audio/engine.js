// Synth engine on an OfflineAudioContext: buses, hall reverb, an orchestral-ish palette and Foley.
// Everything is generated (no samples), deterministic, and scheduled in absolute seconds.
// Struck/plucked instruments (piano, celesta, glock, marimba, pizzicato, harp, bell) are additive
// syntheses rendered once per pitch into cached buffers; sustained ones (strings, choir, horn, pad)
// are live oscillator voices.
import { rng } from '../core.js';

export const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
// 'F#5' -> MIDI number (C4 = 60)
export const N = s => { const m = /^([A-G])([#b]?)(-?\d)$/.exec(s); return PC[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12; };
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function makeEngine(ctx, { cut = Infinity } = {}) {
  const SR = ctx.sampleRate;
  const R = rng(90210);
  const rr = (a, b) => a + (b - a) * R();
  const T0 = t => Math.max(0, t);

  // ---------- lazy voice scheduler ----------
  // An offline graph that holds every voice of the film from the start is slow (each idle node is still visited
  // every render quantum). Voices are queued instead and built just before they sound: render() suspends the
  // context every `step` seconds and creates the voices of the next window.
  const queue = []; let horizon = 0, seq = 0;
  const at = (t, fn) => { if (t < horizon) fn(); else queue.push({ t, fn, i: seq++ }); };
  const flush = h => {
    horizon = h;
    for (;;) {
      queue.sort((a, b) => a.t - b.t || a.i - b.i);
      let k = 0; while (k < queue.length && queue[k].t < h) k++;
      if (!k) break;
      queue.splice(0, k).forEach(e => e.fn());
    }
  };
  function render(step = 0.5) {
    const dur = ctx.length / SR;
    flush(step + 0.1);
    for (let T = step; T < dur - 0.05; T += step) ctx.suspend(T).then(() => { flush(T + step + 0.1); ctx.resume(); });
    return ctx.startRendering();
  }

  const gain = (v = 1) => { const g = ctx.createGain(); g.gain.value = v; return g; };
  const filt = (type, f, q = 0.7) => { const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; return n; };
  const osc = (type, f) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; };

  // ---------- mix chain: buses -> master -> HP 32 -> glue -> limiter -> trim ----------
  // Tuned by meter for a wide-dynamic film score: a gentle glue (-12 dB, 2:1, soft knee) so the written dynamics
  // survive, then a limiter driven a little harder (-5 dB) to hold -1 dBTP. (Chrome's compressor adds automatic
  // make-up gain; `trim` sets the final level: -15.6 LUFS integrated, -1.4 dBTP as measured.)
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -5; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
  const glue = ctx.createDynamicsCompressor();
  glue.threshold.value = -12; glue.knee.value = 10; glue.ratio.value = 2; glue.attack.value = 0.01; glue.release.value = 0.2;
  const master = gain(0.9);
  const hp = filt('highpass', 32, 0.7);
  const trim = gain(0.97);
  master.connect(hp); hp.connect(glue); glue.connect(limiter); limiter.connect(trim); trim.connect(ctx.destination);
  // music and sfx are split into a pre-cut and a post-cut path, so the scene cut at `cut` can stop everything
  // that is still ringing (voices pick their path by start time) without touching what starts after it
  const bus = (g, split) => {
    const n = gain(g); n.connect(master);
    if (split) { n.pre = gain(1); n.post = gain(1); n.pre.connect(n); n.post.connect(n); }
    return n;
  };
  const music = bus(0.62, true), sfx = bus(0.95, true), amb = bus(0.5);

  // ---------- noise ----------
  const noiseBuf = ctx.createBuffer(2, SR * 4, SR);
  for (let c = 0; c < 2; c++) { const d = noiseBuf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = R() * 2 - 1; }
  const brownBuf = ctx.createBuffer(2, SR * 6, SR);
  for (let c = 0; c < 2; c++) {
    const d = brownBuf.getChannelData(c); let l = 0;
    for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (R() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    // seamless loop over [0, len - 0.25 s): cross-fade the head with what follows the loop end
    const nf = SR / 4, L = d.length - nf; for (let i = 0; i < nf; i++) { const k = i / nf; d[i] = d[i] * k + d[L + i] * (1 - k); }
  }
  const noiseSrc = (t, dur, brown = false) => {
    const s = ctx.createBufferSource(); s.buffer = brown ? brownBuf : noiseBuf; s.loop = true;
    if (brown) s.loopEnd = 5.75;
    s.start(t, R() * 3); s.stop(t + dur + 0.05); return s;
  };

  // ---------- hall reverb: two instances of one IR so a scene cut can gate the tail of the first ----------
  function makeIR(dur, rt60) {
    const n = Math.floor(SR * dur), b = ctx.createBuffer(2, n, SR), pre = Math.floor(0.012 * SR);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c); let lp = 0;
      for (let i = pre; i < n; i++) {
        const tt = (i - pre) / SR;
        const k = 0.07 + 0.5 * Math.exp(-tt / 0.5);           // highs die first
        lp += ((R() * 2 - 1) - lp) * k;
        d[i] = lp / Math.sqrt(k) * Math.exp(-6.91 * tt / rt60) * Math.min(1, tt / 0.004);
      }
      for (let j = 0; j < 7; j++) { const i = pre + Math.floor(rr(0.006, 0.075) * SR); d[i] += (R() < 0.5 ? -1 : 1) * rr(0.5, 1.4) * (1 - j * 0.09); } // early reflections
      const nf = Math.floor(0.3 * SR); for (let i = 0; i < nf; i++) d[n - 1 - i] *= i / nf;
    }
    return b;
  }
  const irBuf = makeIR(3.6, 2.9);
  const mkHall = () => {
    const pre = filt('highpass', 200, 0.5), cv = ctx.createConvolver(), post = filt('lowpass', 7500, 0.5), ret = gain(0.42);
    cv.buffer = irBuf; pre.connect(cv); cv.connect(post); post.connect(ret); ret.connect(master);
    return { in: pre, ret };
  };
  const hallA = mkHall(), hallB = mkHall();
  const hallAt = t => (t < cut ? hallA : hallB);

  // ---------- routing + envelopes ----------
  // pan: number, or [[dt, pan], ...] for a moving source
  const out = (node, t, { dest = music, pan = 0, rev = 0 } = {}) => {
    let n = node;
    if (pan) {
      const p = ctx.createStereoPanner();
      if (Array.isArray(pan)) { p.pan.setValueAtTime(pan[0][1], t); pan.forEach(([dt, v]) => p.pan.linearRampToValueAtTime(clamp(v, -1, 1), t + dt)); }
      else p.pan.value = clamp(pan, -1, 1);
      node.connect(p); n = p;
    }
    n.connect(dest.pre ? (t < cut ? dest.pre : dest.post) : dest);
    if (rev > 0) { const s = gain(rev); n.connect(s); s.connect(hallAt(t).in); }
  };
  // struck: fast attack, exponential decay with time constant tau
  const perc = (p, t, peak, a, tau) => { p.setValueAtTime(0, t); p.linearRampToValueAtTime(peak, t + a); p.setTargetAtTime(0, t + a, tau); };
  // sustained: linear segments [[dt, level], ...] then a release; returns the time the voice may stop
  const shape = (p, t, pts, rel = 0.3) => {
    p.setValueAtTime(0, t); let last = 0;
    for (const [dt, v] of pts) { p.linearRampToValueAtTime(v, t + dt); last = dt; }
    p.setTargetAtTime(0, t + last, rel / 3);
    return t + last + rel * 2.6;
  };

  // generic oscillator voice with optional pitch glide
  function tone(t, o = {}) { at(T0(t), () => {
    const { type = 'sine', f0 = 440, f1 = null, fpts = null, dur = 0.2, g = 0.3, a = 0.005, tau = null, pts = null, rel = 0.1, dest = sfx, pan = 0, rev = 0, lp = null, vib = 0, vibRate = 6 } = o;
    t = T0(t);
    const os = osc(type, f0), gn = gain(0);
    os.frequency.setValueAtTime(f0, t);
    if (f1 !== null) os.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    if (fpts) fpts.forEach(([dt, fr]) => os.frequency.exponentialRampToValueAtTime(Math.max(1, fr), t + dt));
    let end;
    if (pts) end = shape(gn.gain, t, pts.map(([dt, l]) => [dt, l * g]), rel);
    else { const k = tau ?? dur / 4; perc(gn.gain, t, g, a, k); end = t + a + k * 9; }
    let nd = os;
    if (lp) { const f = filt('lowpass', lp, 0.6); os.connect(f); nd = f; }
    nd.connect(gn); out(gn, t, { dest, pan, rev });
    if (vib) { const l = osc('sine', vibRate), lg = gain(vib); l.connect(lg); lg.connect(os.frequency); l.start(t); l.stop(end); }
    os.start(t); os.stop(end);
  }); }
  // filtered noise voice
  function hiss(t, o = {}) { at(T0(t), () => {
    const { dur = 0.2, g = 0.3, type = 'bandpass', f0 = 2000, f1 = null, fpts = null, q = 0.8, a = 0.003, tau = null, pts = null, rel = 0.1, dest = sfx, pan = 0, rev = 0, brown = false, hp = 0 } = o;
    t = T0(t);
    const f = filt(type, f0, q), gn = gain(0);
    f.frequency.setValueAtTime(f0, t);
    if (f1 !== null) f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    if (fpts) fpts.forEach(([dt, fr]) => f.frequency.exponentialRampToValueAtTime(Math.max(20, fr), t + dt));
    let end;
    if (pts) end = shape(gn.gain, t, pts.map(([dt, l]) => [dt, l * g]), rel);
    else { const k = tau ?? dur / 4; perc(gn.gain, t, g, a, k); end = t + a + k * 9; }
    const s = noiseSrc(t, end - t, brown);
    if (hp) { const h = filt('highpass', hp, 0.6); s.connect(h); h.connect(f); } else s.connect(f);
    f.connect(gn); out(gn, t, { dest, pan, rev });
  }); }

  // ---------- additive buffers (struck / plucked instruments) ----------
  const cache = new Map();
  // parts: [{ f, a, tau, tau2?, w2?, ph? }] -> amplitude a * ((1-w2) e^(-t/tau) + w2 e^(-t/tau2))
  function additive(key, len, parts, { atk = 0.002, thump = 0, thumpK = 0.05 } = {}) {
    if (cache.has(key)) return cache.get(key);
    const n = Math.floor(len * SR), b = ctx.createBuffer(1, n, SR), d = b.getChannelData(0);
    for (const p of parts) {
      if (p.f >= SR * 0.42 || !p.a) continue;
      const w = 2 * Math.PI * p.f / SR, w2 = p.w2 || 0;
      const k1 = Math.exp(-1 / (p.tau * SR)), k2 = p.tau2 ? Math.exp(-1 / (p.tau2 * SR)) : 0;
      let e1 = p.a * (1 - w2), e2 = p.a * w2, ph = p.ph || 0;
      for (let i = 0; i < n; i++) {
        const e = e1 + e2; if (e < 2e-5) break;
        d[i] += e * Math.sin(ph); ph += w; e1 *= k1; e2 *= k2;
      }
    }
    if (thump) { // soft hammer / mallet noise
      const r = rng(n + 17), m = Math.floor(0.03 * SR); let lp = 0;
      for (let i = 0; i < m; i++) { lp += ((r() * 2 - 1) - lp) * thumpK; d[i] += lp * thump / Math.sqrt(thumpK) * Math.pow(Math.sin(Math.PI * i / m), 2) * (1 - i / m); }
    }
    let pk = 1e-6; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(d[i]));
    const na = Math.max(1, Math.floor(atk * SR)), nf = Math.min(n, Math.floor(0.06 * SR));
    for (let i = 0; i < n; i++) d[i] /= pk;
    for (let i = 0; i < na; i++) d[i] *= 0.5 - 0.5 * Math.cos(Math.PI * i / na);
    for (let i = 0; i < nf; i++) d[n - 1 - i] *= i / nf;
    cache.set(key, b); return b;
  }
  function play(mk, t, { v = 1, dur = null, rel = 0.12, lp = null, pan = 0, rev = 0, dest = music } = {}) { at(T0(t), () => {
    t = T0(t);
    const buf = mk(), s = ctx.createBufferSource(), g = gain(v); s.buffer = buf;
    let n = s;
    if (lp) { const f = filt('lowpass', lp, 0.5); s.connect(f); n = f; }
    n.connect(g);
    let life = buf.duration;
    if (dur !== null && dur < buf.duration) { g.gain.setValueAtTime(v, t + dur); g.gain.setTargetAtTime(0, t + dur, rel); life = Math.min(life, dur + rel * 8); }
    out(g, t, { dest, pan, rev });
    s.start(t); s.stop(t + life + 0.02);
  }); }

  const bufs = {
    piano(m) {
      const f0 = mtof(m), B = Math.max(0.00008, 0.0004 * Math.pow(2, (m - 60) / 10));
      const base = clamp(4.2 * Math.pow(261.6 / f0, 0.55), 0.5, 7), P = clamp(Math.floor(9000 / f0), 2, 14), parts = [];
      for (let n = 1; n <= P; n++) {
        const fn = n * f0 * Math.sqrt(1 + B * n * n), a = Math.pow(n, -1.3) * (0.3 + 0.7 * Math.abs(Math.sin(Math.PI * n / 7.5))), tau = base / (1 + 0.3 * (n - 1));
        parts.push({ f: fn * 1.0003, a: a * 0.55, tau: tau * 0.3, tau2: tau * 1.4, w2: 0.3 }, { f: fn * 0.9997, a: a * 0.45, tau: tau * 0.35, tau2: tau * 1.5, w2: 0.3, ph: 0.4 * n });
      }
      return additive('pn' + m, Math.min(7, base * 3.2), parts, { atk: 0.004, thump: 0.1, thumpK: 0.04 });
    },
    celesta(m) {
      const f0 = mtof(m), tau = clamp(1.6 * Math.pow(880 / f0, 0.6), 0.3, 2.5);
      return additive('ce' + m, tau * 5, [{ f: f0, a: 1, tau }, { f: f0 * 1.0008, a: 0.5, tau: tau * 0.9 }, { f: 2 * f0, a: 0.2, tau: tau * 0.5 }, { f: 3 * f0, a: 0.05, tau: tau * 0.3 },
        { f: 4 * f0, a: 0.25, tau: tau * 0.18 }, { f: 6.3 * f0, a: 0.06, tau: 0.04 }, { f: 9.2 * f0, a: 0.03, tau: 0.02 }], { atk: 0.0015 });
    },
    glock(m) {
      const f0 = mtof(m), tau = clamp(2.2 * Math.pow(1760 / f0, 0.5), 0.5, 3.2);
      return additive('gl' + m, tau * 5, [{ f: f0, a: 1, tau }, { f: f0 * 2.756, a: 0.4, tau: tau * 0.4 }, { f: f0 * 5.404, a: 0.14, tau: tau * 0.18 }, { f: f0 * 8.933, a: 0.05, tau: tau * 0.07 }], { atk: 0.001 });
    },
    marimba(m) {
      const f0 = mtof(m), tau = clamp(0.5 * Math.pow(262 / f0, 0.7), 0.07, 0.8);
      return additive('ma' + m, tau * 7, [{ f: f0, a: 1, tau }, { f: f0 * 3.93, a: 0.22, tau: tau * 0.2 }, { f: f0 * 9.5, a: 0.07, tau: tau * 0.06 }], { atk: 0.002, thump: 0.12, thumpK: 0.12 });
    },
    pluck(m, harp) { // plucked string: harmonic amplitudes set by pluck position, highs die fast
      const f0 = mtof(m), p = harp ? 0.31 : 0.21, q = harp ? 1.5 : 1.65, damp = harp ? 0.035 : 0.13;
      const tau0 = harp ? clamp(2.4 * Math.pow(262 / f0, 0.5), 0.5, 4) : clamp(0.42 * Math.pow(196 / f0, 0.45), 0.12, 0.75);
      const P = clamp(Math.floor(8000 / f0), 2, 18), parts = [];
      for (let n = 1; n <= P; n++) parts.push({ f: n * f0 * (1 + 0.00005 * n * n), a: Math.abs(Math.sin(Math.PI * n * p)) / Math.pow(n, q), tau: tau0 / (1 + damp * (n - 1) * (n - 1)), ph: n % 2 ? 0 : Math.PI });
      return additive((harp ? 'hp' : 'pz') + m, tau0 * 6, parts, { atk: 0.0015, thump: harp ? 0.03 : 0.08, thumpK: 0.15 });
    },
    bell(m) { // warm hand-bell: strong beating fundamental, soft upper partials
      const f0 = mtof(m);
      return additive('bl' + m, 7, [{ f: f0, a: 1, tau: 2.6 }, { f: f0 + 0.7, a: 0.6, tau: 2.6 }, { f: 2 * f0, a: 0.3, tau: 1.6 }, { f: 2.76 * f0, a: 0.1, tau: 0.8 }, { f: 3 * f0 + 1, a: 0.08, tau: 1.0 }, { f: 5.4 * f0, a: 0.03, tau: 0.25 }], { atk: 0.003 });
    },
  };

  const hornWave = ctx.createPeriodicWave(new Float32Array(11), new Float32Array([0, 1, 0.55, 0.5, 0.3, 0.2, 0.12, 0.08, 0.05, 0.03, 0.02]));

  // ---------- instruments ----------
  const inst = {
    piano(t, m, v = 0.6, o = {}) { play(() => bufs.piano(m), t, { v: 0.28 * v, lp: Math.max(mtof(m) * 2.5, 700 + 7000 * Math.pow(v, 1.5)), rev: 0.32, pan: clamp((m - 64) / 60, -0.4, 0.4), rel: 0.18, ...o }); },
    celesta(t, m, v = 0.6, o = {}) { play(() => bufs.celesta(m), t, { v: 0.17 * v, rev: 0.5, pan: 0.15, ...o }); },
    glock(t, m, v = 0.6, o = {}) { play(() => bufs.glock(m), t, { v: 0.12 * v, rev: 0.55, pan: 0.25, ...o }); },
    marimba(t, m, v = 0.6, o = {}) { play(() => bufs.marimba(m), t, { v: 0.36 * v, rev: 0.22, pan: -0.2, ...o }); },
    pizz(t, m, v = 0.6, o = {}) { play(() => bufs.pluck(m, false), t, { v: 0.34 * v, rev: 0.3, pan: -0.1, ...o }); },
    harp(t, m, v = 0.6, o = {}) { play(() => bufs.pluck(m, true), t, { v: 0.27 * v, rev: 0.45, pan: -0.35, ...o }); },
    bell(t, m, v = 0.6, o = {}) { play(() => bufs.bell(m), t, { v: 0.2 * v, rev: 0.6, ...o }); },
    // tiny sine chime (flocks, glints)
    ping(t, f, v = 1, tau = 0.08, pan = 0, rev = 0.45) { tone(t, { f0: f, g: v, a: 0.002, tau, pan, rev, dest: music }); },

    // string section voice: 3 detuned saws, delayed vibrato, two-pole-pair low-pass. trem = bowed tremolo rate (Hz)
    strings(t, m, dur, v = 1, o = {}) { at(T0(t), () => {
      const { att = 0.3, rel = 0.6, cut = null, pan = 0, rev = 0.5, trem = 0, pts = null, vib = 1, hp = 0, dest = music } = o;
      t = T0(t);
      const f = mtof(m), fc = cut ?? clamp(650 + f * 2.4, 900, 4800);
      const lp1 = filt('lowpass', fc, 0.6), lp2 = filt('lowpass', fc * 1.7, 0.5), g = gain(0);
      const end = shape(g.gain, t, (pts || [[att, 1], [Math.max(att + 0.01, dur), 1]]).map(([dt, l]) => [dt, l * 0.05 * v]), rel);
      const lfo = osc('sine', rr(4.9, 6)), lg = gain(0);
      lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * 0.0032 * vib, t + Math.min(0.7, dur * 0.6)); lfo.connect(lg); lfo.start(t); lfo.stop(end);
      [-9, 1, 8].forEach(c => { const o2 = osc('sawtooth', f); o2.detune.value = c + rr(-2, 2); lg.connect(o2.frequency); o2.connect(lp1); o2.start(t); o2.stop(end); });
      lp1.connect(lp2); let n = lp2;
      if (hp) { const h = filt('highpass', hp, 0.7); n.connect(h); n = h; }
      if (trem) { const tg = gain(0.6), l = osc('triangle', trem * rr(0.96, 1.04)), ld = gain(0.4); l.connect(ld); ld.connect(tg.gain); n.connect(tg); n = tg; l.start(t); l.stop(end); }
      n.connect(g); out(g, t, { dest, pan, rev });
    }); },
    // soft wordless choir: saw pairs through vowel formants ('ah' open, 'oo' dark)
    choir(t, notes, dur, v = 1, o = {}) { at(T0(t), () => {
      const { att = 0.9, rel = 1.0, vowel = 'ah', pts = null, rev = 0.6, pan = 0 } = o;
      t = T0(t);
      const F = vowel === 'oo' ? [[380, 1, 2.2], [800, 0.4, 2.6], [2500, 0.04, 3]] : [[680, 1, 1.7], [1150, 0.55, 2.2], [2800, 0.1, 3]];
      const sum = gain(1), g = gain(0);
      const end = shape(g.gain, t, (pts || [[att, 1], [Math.max(att + 0.01, dur), 1]]).map(([dt, l]) => [dt, l * 0.085 * v / Math.sqrt(notes.length)]), rel);
      F.forEach(([fc, a, q]) => { const b = filt('bandpass', fc, q), bg = gain(a); sum.connect(b); b.connect(bg); bg.connect(g); });
      notes.forEach(m => [-8, 7].forEach(c => {
        const f = mtof(m), o2 = osc('sawtooth', f), l = osc('sine', rr(4.4, 5.6)), lg = gain(f * 0.004);
        o2.detune.value = c + rr(-3, 3); l.connect(lg); lg.connect(o2.frequency); o2.connect(sum);
        o2.start(t); o2.stop(end); l.start(t); l.stop(end);
      }));
      out(g, t, { pan, rev });
    }); },
    // warm pad with an automatable filter: cutPts = [[dt, Hz], ...]
    pad(t, notes, dur, v = 1, o = {}) { at(T0(t), () => {
      const { att = 1.2, rel = 1.2, cut = 900, cutPts = null, pts = null, rev = 0.5, pan = 0 } = o;
      t = T0(t);
      const f = filt('lowpass', cut, 0.7), g = gain(0);
      f.frequency.setValueAtTime(cut, t);
      if (cutPts) cutPts.forEach(([dt, fr]) => f.frequency.exponentialRampToValueAtTime(fr, t + dt));
      const end = shape(g.gain, t, (pts || [[att, 1], [Math.max(att + 0.01, dur), 1]]).map(([dt, l]) => [dt, l * 0.06 * v / Math.sqrt(notes.length)]), rel);
      notes.forEach(m => [-7, 7].forEach(c => { const o2 = osc('sawtooth', mtof(m)); o2.detune.value = c + rr(-2, 2); o2.connect(f); o2.start(t); o2.stop(end); }));
      f.connect(g); out(g, t, { pan, rev });
    }); },
    // mellow horn
    horn(t, m, dur, v = 1, o = {}) { at(T0(t), () => {
      const { att = 0.09, rel = 0.35, pan = 0.25, rev = 0.5 } = o;
      t = T0(t);
      const f = filt('lowpass', 450, 0.7), g = gain(0);
      f.frequency.setValueAtTime(450, t); f.frequency.linearRampToValueAtTime(700 + 1500 * v, t + att * 1.5); f.frequency.setTargetAtTime(600 + 900 * v, t + att * 1.5, 0.3);
      const end = shape(g.gain, t, [[att, 0.16 * v], [Math.max(att + 0.01, dur), 0.13 * v]], rel);
      [-4, 4].forEach(c => { const o2 = ctx.createOscillator(); o2.setPeriodicWave(hornWave); o2.frequency.value = mtof(m); o2.detune.value = c; o2.connect(f); o2.start(t); o2.stop(end); });
      f.connect(g); out(g, t, { pan, rev });
    }); },
    // a single pure held note with a breath of air (string harmonic / glass)
    air(t, m, dur, v = 1, o = {}) { at(T0(t), () => {
      const { att = 1.5, rel = 1.5, pan = 0, rev = 0.7, pts = null } = o;
      t = T0(t);
      const f = mtof(m), g = gain(0);
      const end = shape(g.gain, t, (pts || [[att, 1], [Math.max(att + 0.01, dur), 1]]).map(([dt, l]) => [dt, l * 0.05 * v]), rel);
      [[f, 1], [f * 1.0012, 0.7], [f * 2, 0.06]].forEach(([fr, a]) => { const o2 = osc('sine', fr), og = gain(a); o2.connect(og); og.connect(g); o2.start(t); o2.stop(end); });
      const s = noiseSrc(t, end - t), b = filt('bandpass', f, 14), bg = gain(0.5); s.connect(b); b.connect(bg); bg.connect(g);
      out(g, t, { pan, rev });
    }); },
    // low sustained bass (sine + soft triangle)
    sub(t, m, dur, v = 1, o = {}) { at(T0(t), () => {
      const { att = 0.4, rel = 0.8, pts = null, rev = 0.15 } = o;
      t = T0(t);
      const f = mtof(m), g = gain(0), lp = filt('lowpass', 420, 0.5);
      const end = shape(g.gain, t, (pts || [[att, 1], [Math.max(att + 0.01, dur), 1]]).map(([dt, l]) => [dt, l * 0.12 * v]), rel);
      const a = osc('sine', f), b = osc('triangle', f * 2), bg = gain(0.6);
      a.connect(g); b.connect(lp); lp.connect(bg); bg.connect(g); a.start(t); b.start(t); a.stop(end); b.stop(end);
      out(g, t, { rev });
    }); },
  };

  // ---------- orchestral percussion ----------
  const drums = {
    timp(t, m, v = 1) { at(T0(t), () => {
      t = T0(t); const f = mtof(m);
      [[1, 1, 0.5], [1.5, 0.45, 0.24], [1.99, 0.3, 0.16], [2.44, 0.12, 0.1]].forEach(([r, a, tau]) => {
        const o2 = osc('sine', f * r * 1.1), g = gain(0);
        o2.frequency.setValueAtTime(f * r * 1.1, t); o2.frequency.exponentialRampToValueAtTime(f * r, t + 0.07);
        perc(g.gain, t, 0.5 * a * v, 0.003, tau); o2.connect(g); out(g, t, { pan: 0.1, rev: 0.4 }); o2.start(t); o2.stop(t + tau * 9);
      });
      hiss(t, { g: 0.22 * v, type: 'lowpass', f0: 650, a: 0.002, tau: 0.02, dest: music, rev: 0.3, pan: 0.1 });
    }); },
    gran(t, v = 1) { // concert bass drum
      tone(t, { f0: 66, f1: 40, dur: 0.3, g: 0.85 * v, a: 0.004, tau: 0.32, dest: music, rev: 0.25 });
      hiss(t, { g: 0.4 * v, type: 'lowpass', f0: 240, a: 0.004, tau: 0.09, dest: music, rev: 0.3, brown: true });
    },
    frame(t, v = 1, f = 105, pan = 0.15) { // soft hand drum
      tone(t, { f0: f * 1.25, f1: f, dur: 0.05, g: 0.4 * v, a: 0.003, tau: 0.07, dest: music, pan, rev: 0.2 });
      hiss(t, { g: 0.1 * v, type: 'bandpass', f0: 900, q: 0.8, a: 0.002, tau: 0.012, dest: music, pan, rev: 0.2 });
    },
    shaker(t, v = 1, pan = 0.3) { hiss(t, { g: 0.07 * v, type: 'highpass', f0: 6500, q: 0.5, a: 0.008, tau: 0.014, dest: music, pan, rev: 0.1 }); },
    // suspended cymbal with soft mallets: swell peaking at tPeak, then ring
    cymbal(tPeak, rise, v = 1, ring = 2.0) { at(T0(tPeak - rise), () => {
      const t = T0(tPeak - rise), a = tPeak - t;
      [[3200, 0.5, 1], [6300, 0.8, 0.8], [9800, 1.2, 0.5]].forEach(([fc, q, lv]) => {
        const s = noiseSrc(t, a + ring * 3), f = filt('bandpass', fc, q), g = gain(0);
        g.gain.setValueAtTime(0, t);
        if (a > 0.03) { g.gain.linearRampToValueAtTime(0.1 * v * lv * 0.22, t + a * 0.55); g.gain.exponentialRampToValueAtTime(0.1 * v * lv, tPeak); }
        else g.gain.linearRampToValueAtTime(0.1 * v * lv, tPeak + 0.004);
        g.gain.setTargetAtTime(0, tPeak + 0.005, ring / 3 * (fc > 8000 ? 0.6 : 1));
        s.connect(f); f.connect(g); out(g, t, { pan: -0.15, rev: 0.45 });
      });
    }); },
  };

  // ---------- Foley / effects ----------
  const fx = {
    key(t, v = 1, pan = 0, space = false) {
      hiss(t, { g: (space ? 0.1 : 0.2) * v, f0: (space ? 2200 : 3500) + R() * 1500, q: 1.5, a: 0.001, tau: 0.006, pan });
      tone(t, { type: 'triangle', f0: (space ? 190 : 260) + R() * 60, f1: space ? 130 : 180, dur: 0.03, g: (space ? 0.12 : 0.1) * v, a: 0.001, tau: 0.012, pan });
    },
    enter(t, v = 1) {
      tone(t, { f0: 125, f1: 52, dur: 0.16, g: 0.19 * v, a: 0.002, tau: 0.05 });
      hiss(t, { g: 0.15 * v, f0: 1800, q: 1, a: 0.001, tau: 0.012, rev: 0.12 });
      hiss(t + 0.004, { g: 0.1 * v, f0: 4200, q: 2, a: 0.001, tau: 0.005 });
      hiss(t + 0.11, { g: 0.07 * v, f0: 3000, q: 2, a: 0.001, tau: 0.006 }); // key-up
    },
    // cute, pitched electric zap: a square hopping between scale notes through a soft band-pass, plus fizz
    zap(t, { dur = 0.1, v = 1, pan = 0, notes = [81, 86, 88, 90, 93, 98], rev = 0.25 } = {}) { at(T0(t), () => {
      t = T0(t);
      const o2 = osc('square', 800), o3 = osc('triangle', 800), f = filt('bandpass', 2400, 0.7), lp = filt('lowpass', 5200, 0.5), g = gain(0), g3 = gain(1.6);
      for (let i = 0; i * 0.014 < dur + 0.05; i++) { const fr = mtof(notes[Math.floor(R() * notes.length)]) * (R() < 0.25 ? 2 : 1) * rr(0.985, 1.015); o2.frequency.setValueAtTime(fr, t + i * 0.014); o3.frequency.setValueAtTime(fr, t + i * 0.014); }
      perc(g.gain, t, 0.085 * v, 0.002, dur / 2.5);
      o2.connect(f); o3.connect(g3); g3.connect(f); f.connect(lp); lp.connect(g); out(g, t, { dest: sfx, pan, rev });
      o2.start(t); o3.start(t); o2.stop(t + dur * 4 + 0.1); o3.stop(t + dur * 4 + 0.1);
      fx.fizz(t, dur * 1.3, 0.5 * v, { pan, rate: 90 });
    }); },
    // soft crackle: many micro-bursts of band-passed noise; w(u) weights density over the duration
    fizz(t, dur, v = 1, { rate = 50, f = 6500, pan = 0, w = null, spread = 0.5, dest = sfx, rev = 0 } = {}) {
      const n = Math.floor(dur * rate);
      for (let i = 0; i < n; i++) {
        const u = R(); if (w && R() > w(u)) continue;
        hiss(t + u * dur, { g: rr(0.03, 0.1) * v, f0: f * rr(0.6, 1.4), q: 1.6, a: 0.001, tau: rr(0.002, 0.006), pan: clamp(pan + rr(-spread, spread), -1, 1), dest, rev });
      }
    },
    // the spark's "voice": a tiny sine chirp
    chirp(t, f0, f1, dur = 0.09, v = 1, pan = 0) {
      tone(t, { f0, fpts: [[dur, f1]], g: 0.11 * v, a: 0.006, tau: dur * 0.6, pan, rev: 0.3 });
      tone(t, { f0: f0 * 2, fpts: [[dur, f1 * 2]], g: 0.03 * v, a: 0.006, tau: dur * 0.4, pan, rev: 0.3 });
    },
    boing(t, v = 1, f = 300, pan = 0) { at(T0(t), () => {
      t = T0(t);
      const o2 = osc('sine', f), l = osc('sine', 19), lg = gain(f * 0.22), g = gain(0);
      o2.frequency.setValueAtTime(f * 0.8, t); o2.frequency.exponentialRampToValueAtTime(f * 2.1, t + 0.09); o2.frequency.exponentialRampToValueAtTime(f * 1.25, t + 0.5);
      lg.gain.setValueAtTime(f * 0.22, t); lg.gain.setTargetAtTime(0, t + 0.08, 0.14); l.connect(lg); lg.connect(o2.frequency);
      perc(g.gain, t, 0.14 * v, 0.006, 0.13); o2.connect(g); out(g, t, { dest: sfx, pan, rev: 0.25 });
      o2.start(t); l.start(t); o2.stop(t + 1.2); l.stop(t + 1.2);
    }); },
    // band-noise sweep; peak = fraction of dur where it is loudest
    whoosh(t, dur = 0.5, v = 1, f0 = 400, f1 = 3000, { pan = 0, peak = 0.65, q = 1.3, rev = 0.2, dest = sfx } = {}) {
      hiss(t, { dur, g: 0.3 * v, f0, f1, q, pts: [[dur * peak, 1], [dur, 0.05]], rel: dur * 0.3, pan, rev, dest });
    },
    riser(t, dur, v = 1, { f0 = 300, f1 = 6000, tone0 = 110, tone1 = 880 } = {}) {
      hiss(t, { dur, g: 0.2 * v, f0, f1, q: 1.2, pts: [[dur * 0.5, 0.2], [dur, 1]], rel: 0.12, rev: 0.3 });
      tone(t, { type: 'sawtooth', f0: tone0, f1: tone1, dur, g: 0.05 * v, pts: [[dur * 0.5, 0.25], [dur, 1]], rel: 0.1, lp: 2400, rev: 0.3 });
    },
    impact(t, v = 1, pan = 0) {
      tone(t, { f0: 85, f1: 34, dur: 0.5, g: 0.7 * v, a: 0.003, tau: 0.22, pan });
      hiss(t, { g: 0.4 * v, type: 'lowpass', f0: 900, f1: 150, dur: 0.4, a: 0.003, tau: 0.12, pan, rev: 0.35 });
      hiss(t, { g: 0.14 * v, type: 'highpass', f0: 3000, a: 0.002, tau: 0.03, pan, rev: 0.2 });
    },
    // wind / air: band noise with a wandering filter; pts shape the level
    wind(t, dur, v = 1, { f = 600, wander = 0.5, q = 0.7, pts = null, pan = 0, dest = amb, rev = 0.1, brown = false } = {}) {
      const fpts = []; for (let x = 0.35; x < dur; x += rr(0.3, 0.6)) fpts.push([x, f * Math.pow(2, rr(-wander, wander))]);
      hiss(t, { dur, g: 0.2 * v, f0: f, fpts, q, pts: pts || [[dur * 0.3, 1], [dur, 1]], rel: 0.4, pan, dest, rev, brown });
    },
    // hum: harmonic stack at f; pts = level envelope; am = [[dt, Hz], ...] wobble rate automation
    hum(t, dur, f, v = 1, { harm = [1, 0.7, 0.45, 0.2, 0.12, 0.06], pts = null, am = null, amDepth = 0.3, pan = 0, dest = amb, rev = 0, rel = 0.3, fpts = null } = {}) { at(T0(t), () => {
      t = T0(t);
      const g = gain(0), end = shape(g.gain, t, (pts || [[0.5, 1], [dur, 1]]).map(([dt, l]) => [dt, l * 0.05 * v]), rel);
      harm.forEach((a, i) => {
        if (!a) return;
        const o2 = osc('sine', f * (i + 1)), og = gain(a);
        if (fpts) { o2.frequency.setValueAtTime(f * (i + 1), t); fpts.forEach(([dt, r]) => o2.frequency.linearRampToValueAtTime(f * (i + 1) * r, t + dt)); }
        o2.connect(og); og.connect(g); o2.start(t); o2.stop(end);
      });
      let n = g;
      if (am) { const tg = gain(1 - amDepth), l = osc('sine', am[0][1]), ld = gain(amDepth); l.frequency.setValueAtTime(am[0][1], t); am.forEach(([dt, r]) => l.frequency.linearRampToValueAtTime(r, t + dt)); l.connect(ld); ld.connect(tg.gain); g.connect(tg); n = tg; l.start(t); l.stop(end); }
      out(n, t, { dest, pan, rev });
    }); },
    roomTone(t, dur, v = 1, { lp = 380, pts = null, dest = amb } = {}) {
      hiss(t, { dur, g: 0.03 * v, type: 'lowpass', f0: lp, hp: 55, q: 0.4, pts: pts || [[0.4, 1], [dur, 1]], rel: 0.4, dest, brown: true });
    },
    // a quick run of tiny soft clicks (text landing on a screen)
    ticks(t, n, v = 1, pan = 0, step = 0.05) {
      for (let i = 0; i < n; i++) {
        const tt = t + i * step * rr(0.85, 1.15);
        hiss(tt, { g: 0.26 * v * rr(0.7, 1.1), f0: rr(2600, 4200), q: 2.5, a: 0.001, tau: 0.005, pan: pan + i * 0.02 });
        tone(tt, { f0: rr(1500, 1900), g: 0.03 * v, a: 0.001, tau: 0.01, pan: pan + i * 0.02, rev: 0.2 });
      }
    },
    // sleeping breath: soft low noise, in then out
    breath(t, v = 1, pan = 0) {
      hiss(t, { dur: 1.2, g: 0.03 * v, f0: 420, fpts: [[1.2, 640]], q: 0.9, pts: [[0.9, 1], [1.2, 0.3]], rel: 0.25, dest: amb, pan, rev: 0.5 });
      hiss(t + 1.45, { dur: 1.5, g: 0.024 * v, f0: 560, fpts: [[1.5, 330]], q: 0.9, pts: [[0.35, 1], [1.5, 0.1]], rel: 0.3, dest: amb, pan, rev: 0.5 });
    },
    crickets(t, dur, v = 1) {
      for (let c = 0; c < 2; c++) {
        const f = 4300 + c * 310, pan = c ? 0.55 : -0.65;
        for (let tt = t + R() * 0.5; tt < t + dur; tt += rr(0.6, 1.0)) for (let k = 0; k < 3; k++) tone(tt + k * 0.036, { f0: f, g: 0.004 * v, a: 0.004, tau: 0.006, pan, dest: amb, rev: 0.3 });
      }
    },
    // wing / chime flutter bed
    flutter(t, dur, v = 1, { pts = null, rate = 21, f = 3200 } = {}) { at(T0(t), () => {
      t = T0(t);
      const g = gain(0), end = shape(g.gain, t, (pts || [[dur * 0.2, 1], [dur, 0.3]]).map(([dt, l]) => [dt, l * 0.05 * v]), 0.4);
      const s = noiseSrc(t, end - t), b = filt('bandpass', f, 0.9), tg = gain(0.5), l = osc('sine', rate), ld = gain(0.5);
      b.frequency.setValueAtTime(f, t); b.frequency.exponentialRampToValueAtTime(f * 1.8, t + dur);
      l.connect(ld); ld.connect(tg.gain); s.connect(b); b.connect(tg); tg.connect(g); l.start(t); l.stop(end);
      out(g, t, { dest: sfx, rev: 0.4 });
    }); },
  };

  // the cut: gate the pre-cut paths and the first hall's tail
  if (isFinite(cut)) [music.pre.gain, sfx.pre.gain, hallA.ret.gain].forEach(p => { p.setValueAtTime(p.value, cut - 0.035); p.setTargetAtTime(0, cut - 0.035, 0.012); });

  return { ctx, SR, render, buses: { music, sfx, amb, master, trim }, halls: { a: hallA, b: hallB }, inst, drums, fx, tone, hiss, R, rr };
}
