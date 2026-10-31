// Kitchen sound effects, all synthesized with Web Audio (no audio files). Each cue in
// anim.js's CUES names one of the instruments below; scheduleAudio() lays the whole list out
// on an AudioContext's clock, so the same code plays live and renders offline for the video.

function noiseBuffer(ctx) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 7;
  for (let i = 0; i < d.length; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
  return buf;
}

// a gain that rises to `peak` in `a` seconds, then decays over `d`
function env(ctx, at, peak, a, d) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.linearRampToValueAtTime(peak, at + a);
  g.gain.exponentialRampToValueAtTime(0.0001, at + a + d);
  return g;
}

function tone(x, at, { f, f2 = f, type = "sine", peak = 0.2, a = 0.005, d = 0.15 }) {
  const { ctx, out } = x;
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, at);
  if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, at + a + d * 0.8);
  const g = env(ctx, at, peak, a, d);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + a + d + 0.05);
  return o;
}

function noise(x, at, { f = 2000, f2 = f, q = 1, type = "bandpass", peak = 0.2, a = 0.003, d = 0.08 }) {
  const { ctx, out, buf } = x;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f, at);
  if (f2 !== f) filt.frequency.exponentialRampToValueAtTime(f2, at + a + d);
  const g = env(ctx, at, peak, a, d);
  src.connect(filt).connect(g).connect(out);
  src.start(at, (at * 7.31) % 1.5);
  src.stop(at + a + d + 0.05);
}

const notes = (x, at, fs, step, o) => fs.forEach((f, i) => tone(x, at + i * step, { f, ...o }));

// a seeded random, so live playback and the rendered video sound the same
function rng(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

const SYN = {
  pop: (x, at) => tone(x, at, { f: 480, f2: 1100, peak: 0.18, d: 0.08 }),
  click: (x, at) => noise(x, at, { f: 3000, q: 2, peak: 0.3, d: 0.02 }),
  swish: (x, at) => noise(x, at, { f: 700, f2: 3200, q: 1.5, peak: 0.07, a: 0.08, d: 0.3 }),
  whoosh: (x, at) => noise(x, at, { f: 280, f2: 1600, q: 1.2, peak: 0.16, a: 0.12, d: 0.45 }),
  printer: (x, at, c) => {
    for (let t = 0; t < c.d; t += 0.022) noise(x, at + t, { f: 2600, q: 3, peak: 0.12, d: 0.012 });
    tone(x, at, { f: 170, type: "square", peak: 0.025, d: c.d });
  },
  tear: (x, at) => noise(x, at, { f: 1800, f2: 5000, type: "highpass", peak: 0.15, a: 0.02, d: 0.14 }),
  steps: (x, at, c) => {
    for (let t = 0; t < c.d; t += 0.2) {
      tone(x, at + t, { f: 110, f2: 60, peak: 0.16, d: 0.07 });
      noise(x, at + t, { f: 1200, q: 2, peak: 0.05, d: 0.03 });
    }
  },
  chop: (x, at, c) => {
    tone(x, at, { f: 150 + (c.i % 2) * 15, f2: 55, peak: 0.45, d: 0.1 });
    noise(x, at, { f: 1700, q: 1.8, peak: 0.3, d: 0.05 });
  },
  hop: (x, at) => tone(x, at, { f: 320, f2: 640, type: "triangle", peak: 0.07, d: 0.09 }),
  hum: (x, at) => notes(x, at, [523, 659, 784, 659], 0.16, { type: "triangle", peak: 0.09, a: 0.02, d: 0.16 }),
  shake: (x, at, c) => {
    for (let t = 0; t < c.d; t += 0.075) noise(x, at + t, { f: 6500, q: 1.2, peak: 0.09, a: 0.01, d: 0.05 });
  },
  zip: (x, at, c) => tone(x, at, { f: 380 + c.k * 60, f2: 900 + c.k * 120, type: "triangle", peak: 0.06, a: 0.02, d: 0.3 }),
  clang: (x, at) => [520, 1340, 2210].forEach((f, i) => tone(x, at, { f, peak: 0.06 / (i + 1), d: 0.7 })),
  ignite: (x, at) => {
    noise(x, at, { f: 900, f2: 300, type: "lowpass", peak: 0.12, a: 0.03, d: 0.35 });
    tone(x, at, { f: 75, peak: 0.08, a: 0.03, d: 0.3 });
  },
  blip: (x, at) => tone(x, at, { f: 880, type: "triangle", peak: 0.08, d: 0.08 }),
  taste: (x, at, c) => tone(x, at, { f: 620 + c.k * 95, type: "triangle", peak: 0.07, a: 0.01, d: 0.14 }),
  thought: (x, at) => notes(x, at, [784, 1175], 0.1, { type: "triangle", peak: 0.11, d: 0.25 }),
  boing: (x, at) => {
    const o = tone(x, at, { f: 190, peak: 0.22, a: 0.01, d: 0.5 });
    const lfo = x.ctx.createOscillator(), depth = x.ctx.createGain();
    lfo.frequency.value = 13;
    depth.gain.setValueAtTime(70, at);
    depth.gain.exponentialRampToValueAtTime(1, at + 0.5);
    lfo.connect(depth).connect(o.frequency);
    lfo.start(at);
    lfo.stop(at + 0.6);
  },
  scribble: (x, at) => {
    for (let t = 0; t < 0.25; t += 0.04) noise(x, at + t, { f: 4200, q: 3, peak: 0.035, a: 0.01, d: 0.03 });
  },
  dots: (x, at) => notes(x, at, [520, 620, 740], 0.1, { type: "triangle", peak: 0.06, d: 0.08 }),
  sparkle: (x, at) => notes(x, at, [1320, 1760, 2640], 0.06, { type: "triangle", peak: 0.06, d: 0.2 }),
  chalk: (x, at, c) => {
    for (let t = 0; t < c.d; t += 0.035) noise(x, at + t, { f: 3400, q: 2, type: "bandpass", peak: 0.05, a: 0.005, d: 0.025 });
  },
  tick: (x, at) => {
    noise(x, at, { f: 3600, q: 4, peak: 0.2, d: 0.015 });
    tone(x, at, { f: 2100, peak: 0.03, d: 0.012 });
  },
  cheer: (x, at) => notes(x, at, [523, 659, 784, 1047], 0.08, { type: "triangle", peak: 0.1, d: 0.22 }),
  plop: (x, at) => {
    tone(x, at, { f: 420, f2: 120, peak: 0.35, d: 0.13 });
    noise(x, at, { f: 600, type: "lowpass", peak: 0.12, d: 0.06 });
  },
  conveyor: (x, at, c) => {
    for (let t = 0; t < c.d; t += 0.11) noise(x, at + t, { f: 1500, q: 3, peak: 0.05, d: 0.02 });
    tone(x, at, { f: 62, type: "square", peak: 0.02, a: 0.1, d: c.d });
  },
  ping: (x, at, c) => tone(x, at, { f: [988, 1109, 1175, 1319][c.k] || 988, type: "triangle", peak: 0.08, d: 0.2 }),
  key: (x, at) => {
    noise(x, at, { f: 2400, q: 2, peak: 0.09, d: 0.018 });
    tone(x, at, { f: 1500, peak: 0.015, d: 0.01 });
  },
  ding: (x, at) => [1, 2.76, 5.4, 8.93].forEach((r, i) => tone(x, at, { f: 1400 * r, peak: 0.22 / (i + 1.5), d: 1.8 / (i + 1) })),
  drip: (x, at) => [0, 0.22].forEach((dt) => tone(x, at + dt, { f: 950, f2: 420, peak: 0.08, d: 0.08 })),
  // the kitchen's background: a low sizzle with the odd bubble, until the end
  ambience: (x, at, c) => {
    const { ctx, out, buf } = x;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = "bandpass";
    filt.frequency.value = 3800;
    filt.Q.value = 0.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.018, at + 1);
    g.gain.setValueAtTime(0.018, at + c.d - 1.5);
    g.gain.linearRampToValueAtTime(0.0001, at + c.d);
    src.connect(filt).connect(g).connect(out);
    src.start(at);
    src.stop(at + c.d + 0.1);
    const r = rng(11);
    for (let t = 0.5; t < c.d - 1; t += 0.12 + r() * 0.35) tone(x, at + t, { f: 180 + r() * 260, f2: 300 + r() * 400, peak: 0.02, d: 0.04 });
  },
};

// Lays every cue out on ctx's clock, with cue time 0 at ctx time `zero`.
export function scheduleAudio(ctx, dest, cues, { zero = ctx.currentTime, from = 0, end = 60 } = {}) {
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 4;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  comp.connect(master).connect(dest);
  const x = { ctx, out: comp, buf: noiseBuffer(ctx) };
  for (const c of cues) {
    if (c.t < from) continue;
    const opts = c.name === "ambience" ? { ...c, d: end - c.t } : c;
    SYN[c.name]?.(x, zero + c.t - from, opts);
  }
  return master;
}

// Renders the whole soundtrack offline and returns it as a 16-bit stereo WAV (base64).
export async function renderWav(cues, end, sampleRate = 44100) {
  const ctx = new OfflineAudioContext(2, Math.ceil(sampleRate * end), sampleRate);
  scheduleAudio(ctx, ctx.destination, cues, { zero: 0, end });
  const buf = await ctx.startRendering();
  const n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)];
  const view = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF"); view.setUint32(4, 36 + n * 4, true); str(8, "WAVE"); str(12, "fmt ");
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true);
  view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 4, true);
  view.setUint16(32, 4, true); view.setUint16(34, 16, true); str(36, "data"); view.setUint32(40, n * 4, true);
  for (let i = 0, o = 44; i < n; i++) for (let c = 0; c < 2; c++, o += 2) view.setInt16(o, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true);
  let bin = "";
  const bytes = new Uint8Array(view.buffer);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
