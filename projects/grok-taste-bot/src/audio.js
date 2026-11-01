// Soundtrack, rendered offline (OfflineAudioContext) against the film's cue times. The reference Grok Bot film is
// all crisp UI sound effects over true silence, no music, so this is too: its own sounds are reused where the
// same thing happens (the bot popping into view, the caption word clicks, and the whole end card);
// everything else is soft and physical (air, muffled taps, gentle thumps) rather than bleepy.
// Each find lands on the next note of a rising pentatonic line, so the speeding cuts become the build.

const SR = 48000;

// Reference sound events (seconds into the reference film), measured from its audio
const REF = {
  pop: [0.25, 0.56],        // the bot bursting out of its app icon
  clickA: [6.57, 6.63],     // caption word clicks
  clickB: [6.635, 6.74],
  clickC: [6.9, 6.96],
  endCard: [8.62, 12.7],    // sphere pop + wordmark, to the end
};
const SPHERE_T = 8.633;     // the end card's first sphere frame

// C major pentatonic, rising from C4 (an octave lower than a UI chime, so the line sits warm rather than tinny)
const NOTES = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66];

export async function renderSoundtrack(base, cue) {
  const ctx = new OfflineAudioContext(2, Math.ceil(cue.duration * SR), SR);
  const refBuf = await ctx.decodeAudioData(await (await fetch(base + 'cache/ref_audio.wav')).arrayBuffer());

  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -26; master.ratio.value = 4; master.knee.value = 6; master.attack.value = 0.003; master.release.value = 0.12;
  // makeup gain into a gentle tanh soft-clip, so it sits at a social-video loudness without hard clipping
  const makeup = ctx.createGain(); makeup.gain.value = 1.6;
  const clip = ctx.createWaveShaper();
  clip.curve = Float32Array.from({ length: 2048 }, (_, i) => Math.tanh(1.15 * (i / 1023.5 - 1)) / Math.tanh(1.15));
  master.connect(makeup).connect(clip).connect(ctx.destination);
  // a warm tilt on everything: lift the lows, soften the very top
  const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 180; low.gain.value = 4;
  const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 4500; high.gain.value = -4;
  const bus = ctx.createGain();
  bus.connect(low).connect(high).connect(master);
  // a small, dark room for the synthesized effects only (the reference's sounds are already mixed)
  const room = ctx.createConvolver();
  room.buffer = impulse(ctx, 0.8, 2.4);
  const roomTone = ctx.createBiquadFilter(); roomTone.type = 'lowpass'; roomTone.frequency.value = 2400;
  const wet = ctx.createGain(); wet.gain.value = 0.18;
  room.connect(roomTone).connect(wet).connect(bus);
  const fx = ctx.createGain(); fx.connect(bus); fx.connect(room);

  const noise = ctx.createBuffer(1, SR * 2, SR);
  { const d = noise.getChannelData(0); let s = 7; for (let i = 0; i < d.length; i++) { s = (s * 16807) % 2147483647; d[i] = s / 1073741823.5 - 1; } }

  const out = (pan = 0, dest = fx) => {
    const p = ctx.createStereoPanner(); p.pan.value = pan; p.connect(dest); return p;
  };
  // a slice of the reference's audio
  const ref = (t, [a, b], { gain = 1, rate = 1, pan = 0 } = {}) => {
    if (t < 0) { a -= t / rate; t = 0; }
    const src = ctx.createBufferSource(); src.buffer = refBuf; src.playbackRate.value = rate;
    const g = ctx.createGain();
    const len = (b - a) / rate;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.setValueAtTime(gain, t + len - 0.01); g.gain.linearRampToValueAtTime(0, t + len);
    src.connect(g).connect(out(pan, bus));
    src.start(t, a, b - a);
  };
  // pitched blip with a glide
  const blip = (t, f0, f1, dur, gain, { type = 'sine', pan = 0, attack = 0.004 } = {}) => {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out(pan)); o.start(t); o.stop(t + dur + 0.02);
  };
  // band of noise sweeping f0 → f1; shape 'swell' rises to the end, 'swish' peaks early
  const air = (t, dur, f0, f1, gain, { q = 1.2, shape = 'swish', pan = 0 } = {}) => {
    const src = ctx.createBufferSource(); src.buffer = noise; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    if (shape === 'swell') { g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    else { g.gain.exponentialRampToValueAtTime(gain, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
    src.connect(bp).connect(g).connect(out(pan)); src.start(t, Math.random()); src.stop(t + dur + 0.02);
  };
  // soft wooden mallet: a round fundamental, a quiet octave above, and a sub an octave below for body
  const pluck = (t, f, gain, pan = 0) => {
    blip(t, f, f, 0.55, gain, { pan, attack: 0.005 });
    blip(t, f * 2, f * 2, 0.22, gain * 0.16, { pan, attack: 0.004 });
    blip(t, f / 2, f / 2, 0.4, gain * 0.45, { pan, attack: 0.008, type: 'triangle' });
  };
  const thump = (t, gain) => blip(t, 120, 46, 0.2, gain);
  const tick = (t, gain, f = 1300, pan = 0) => blip(t, f, f * 0.85, 0.035, gain, { pan });
  // a soft, muffled tap — something light landing on a surface; no pitch, nothing bleepy
  const tap = (t, gain, pan = 0) => {
    const src = ctx.createBufferSource(); src.buffer = noise;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    src.connect(lp).connect(g).connect(out(pan)); src.start(t, 0.3); src.stop(t + 0.09);
    blip(t, 130, 110, 0.06, gain * 0.5, { pan });
  };

  const { T, ARRIVE, HOP, DIVE, TOSS, REF_START, WORDS, URL_T, cards } = cue;

  // --- the bot appears, looks around, and stretches into an orange search pill
  ref(0.0, REF.pop, { gain: 0.9 });
  // the stretch into the pill: just a soft, low swoosh of air
  air(T.form[0], T.form[1] - T.form[0], 220, 650, 0.07, { q: 0.6 });
  // ...it springs out (a light push-off) and lands on the end (a muffled tap)
  air(T.hopOut[0] - 0.02, 0.22, 500, 900, 0.035, { q: 0.7 });
  tap(T.hopOut[0], 0.12, -0.1);
  tap(T.hopOut[1] - 0.03, 0.16, 0.3);

  // --- typing the query, then enter
  const n = cue.query.length;
  for (let i = 0; i < n; i++) {
    const t = T.type[0] + (i + 0.5) * (T.type[1] - T.type[0]) / n;
    const space = cue.query[i] === ' ';
    ref(t, i % 2 ? REF.clickA : REF.clickC, { gain: space ? 0.24 : 0.46, rate: 0.8 + ((i * 37) % 10) / 50, pan: -0.15 + ((i * 13) % 7) / 25 });
  }
  ref(T.enter, REF.clickB, { gain: 0.65, rate: 0.75 });
  thump(T.enter, 0.16);

  // --- results stream in; the feed slows onto the first one, which pings
  air(T.dock[0] - 0.05, ARRIVE - T.dock[0], 900, 320, 0.17, { q: 0.7 });
  pluck(ARRIVE - 0.32, 783.99, 0.12, 0.3);
  pluck(ARRIVE - 0.24, 1174.66, 0.08, 0.3);

  // --- hop onto the post, dive in
  air(HOP[0], HOP[1] - HOP[0], 380, 800, 0.04, { q: 0.7, pan: 0.2 });
  tap(HOP[1], 0.15, 0.25);
  // the ride down onto the handle pill: just a small breath of air as it falls
  air(DIVE[0] + 0.05, DIVE[1] - DIVE[0], 900, 420, 0.045, { q: 1, shape: 'swell', pan: -0.3 });

  // --- the finds: each arrival is the next note up, with a soft thump; transitions breathe between them
  cards.forEach((c, i) => {
    const t = c.cut;
    pluck(t, NOTES[i % NOTES.length], i ? 0.24 : 0.16, -0.15 + (i % 3) * 0.15);
    if (i) thump(t, 0.2 + 0.008 * i); // the first find arrives quietly, under the bot's fall
    const next = cards[i + 1];
    if (next) {
      if (c.kind === 'push') {
        air(c.holdEnd, c.tr * 0.62, 180, 1400, 0.15, { shape: 'swell', q: 0.8 });
        blip(c.holdEnd, 60, 110, c.tr * 0.6, 0.07);
      } else {
        air(c.holdEnd + c.tr * 0.15, c.tr * 0.55, 600, 2000, 0.1, { q: 1.1 });
      }
    }
  });

  // (the bot's reactions are left silent: the music of the finds carries them)

  // --- the serve: a racket "pock", the ball whistling up into the sphere
  blip(TOSS[0], 420, 300, 0.07, 0.32);
  air(TOSS[0], 0.05, 1400, 1100, 0.3, { q: 2 });
  blip(TOSS[0] + 0.05, 480, 1000, TOSS[1] - TOSS[0] - 0.08, 0.03, { type: 'triangle' });

  // --- the end card plays with its own sound, the tagline clicks in word by word like the reference's caption
  ref(REF_START - (SPHERE_T - REF.endCard[0]), REF.endCard, { gain: 1 });
  [REF.clickA, REF.clickB, REF.clickC].forEach((c, i) => ref(WORDS[i][1], c, { gain: 0.85 }));
  tick(URL_T, 0.04, 1500);

  const buf = await ctx.startRendering();
  return wavBase64(buf);
}

function impulse(ctx, seconds, decay) {
  const len = Math.floor(SR * seconds), b = ctx.createBuffer(2, len, SR);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let s = 99 + c;
    for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 1073741823.5 - 1) * Math.pow(1 - i / len, decay); }
  }
  return b;
}

function wavBase64(buf) {
  const ch = buf.numberOfChannels, n = buf.length, bytes = 44 + n * ch * 2;
  const view = new DataView(new ArrayBuffer(bytes));
  const str = (o, s) => [...s].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); view.setUint32(4, bytes - 8, true); str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, ch, true);
  view.setUint32(24, SR, true); view.setUint32(28, SR * ch * 2, true); view.setUint16(32, ch * 2, true); view.setUint16(34, 16, true);
  str(36, 'data'); view.setUint32(40, n * ch * 2, true);
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { view.setInt16(o, Math.max(-1, Math.min(1, data[c][i])) * 32767, true); o += 2; }
  const u8 = new Uint8Array(view.buffer);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(bin);
}
