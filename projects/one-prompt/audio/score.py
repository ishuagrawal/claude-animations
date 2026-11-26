#!/usr/bin/env python3
"""Soundtrack for One Prompt: synthesized score + Foley + the ElevenLabs narration, all placed from the film's cue sheet.

  python3 audio/score.py measure out/vo                    -> out/vo/vo.json (speech length and lead-in per line)
  node audio/cues.mjs > out/cues-audio.json
  python3 audio/score.py mix out/cues-audio.json out/vo out/one-prompt.wav

Nothing is sampled: every instrument and effect is generated here, so the mix is deterministic and sample-accurate.
"""
import json, subprocess, sys
import numpy as np
from scipy import signal

SR = 48000
MUSIC = 0.0   # the old synthesized score stays muted
MUSIC_FILE = None   # --music <wav>: the score from audio/compose.py, ducked under the narration
MUSIC_GAP_DB, MUSIC_DUCK_DB = 9.0, 8.0   # music sits this far under speech level in pauses, and ducks this much more under the voice
RNG = np.random.default_rng(7)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def decode(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def speech_bounds(x, thr_db=-46):
    """first and last sample louder than thr_db (10 ms RMS), in seconds"""
    w = int(SR * 0.01)
    n = len(x) // w
    rms = np.sqrt(np.mean(x[: n * w].reshape(n, w) ** 2, axis=1) + 1e-12)
    on = np.where(20 * np.log10(rms) > thr_db)[0]
    if not len(on):
        return 0.0, len(x) / SR
    return on[0] * w / SR, (on[-1] + 1) * w / SR


def speech_rms(x):
    """loudness of the voiced part of a clip: RMS of 20 ms frames within 30 dB of the loudest frame"""
    w = int(SR * 0.02); n = len(x) // w
    r = np.sqrt(np.mean(x[: n * w].reshape(n, w) ** 2, axis=1) + 1e-12)
    v = r[r > r.max() * 10 ** (-30 / 20)]
    return float(np.sqrt(np.mean(v ** 2)))


# ---------------------------------------------------------------- mixing buffers
class Bus:
    def __init__(self, dur):
        self.n = int(dur * SR) + SR
        self.L = np.zeros(self.n)
        self.R = np.zeros(self.n)

    def add(self, t, sig, gain=1.0, pan=0.0):
        i = int(round(t * SR))
        if i >= self.n or len(sig) == 0:
            return
        if i < 0:
            sig = sig[-i:]
            i = 0
        sig = sig[: self.n - i]
        a = (pan + 1) * np.pi / 4
        self.L[i:i + len(sig)] += sig * gain * np.cos(a) * 1.4142
        self.R[i:i + len(sig)] += sig * gain * np.sin(a) * 1.4142

    def stereo(self):
        return np.stack([self.L, self.R])


def env(n, a, d, s, r, total=None):
    """ADSR in seconds -> array of n samples (r ends the array)"""
    out = np.full(n, float(s))
    A, D, Rr = int(a * SR), int(d * SR), int(r * SR)
    A = min(A, n)
    out[:A] = np.linspace(0, 1, A, endpoint=False) if A else out[:A]
    De = min(A + D, n)
    out[A:De] = np.linspace(1, s, De - A, endpoint=False)
    if Rr and n > Rr:
        out[n - Rr:] *= np.linspace(1, 0, Rr) ** 2
    return out


def lp(x, f, order=2):
    sos = signal.butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def hp(x, f, order=2):
    sos = signal.butter(order, f, 'high', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def bp(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos')
    return signal.sosfilt(sos, x)


def noise(d):
    return RNG.standard_normal(int(d * SR))


def msum(*xs):
    """sum signals of different lengths"""
    n = max(len(x) for x in xs)
    out = np.zeros(n)
    for x in xs:
        out[: len(x)] += x
    return out


def tt(d):
    return np.arange(int(d * SR)) / SR


# ---------------------------------------------------------------- instruments
def saw(f, d, harm=10, detune=0.0):
    t = tt(d)
    out = np.zeros_like(t)
    for k in range(1, harm + 1):
        if f * k > 9000:
            break
        out += np.sin(2 * np.pi * f * k * (1 + detune) * t + k * 0.7) / k
    return out


def pad(notes, d, cut=1400, a=1.4, r=1.8, bright=10):
    """detuned saw stack, slow filter; notes are midi"""
    out = np.zeros(int(d * SR))
    for m in notes:
        f = mtof(m)
        out += saw(f, d, bright, -0.0035) + saw(f, d, bright, 0.0035) * 0.9
    out = lp(out, cut, 2) / (len(notes) * 2.5)
    return out * env(len(out), a, 0.5, 0.85, r)


def bell(m, d=2.6, bright=1.0):
    t = tt(d)
    f = mtof(m)
    out = np.zeros_like(t)
    for ratio, amp, dec in [(1, 1, 2.2), (2.756, 0.45 * bright, 4.5), (5.404, 0.22 * bright, 7.5), (2.0, 0.25, 3)]:
        out += amp * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t * dec)
    return out * np.minimum(1, t / 0.004)


def epiano(m, d=3.0):
    t = tt(d)
    f = mtof(m)
    mod = np.sin(2 * np.pi * f * 1.0 * t) * 1.6 * np.exp(-t * 3)
    out = np.sin(2 * np.pi * f * t + mod) * np.exp(-t * 1.1) + 0.3 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 2.5)
    return out * np.minimum(1, t / 0.006) * (1 + 0.12 * np.sin(2 * np.pi * 4.8 * t))


def pluck(m, d=0.9, damp=0.996, bright=0.6):
    f = mtof(m)
    N = int(SR / f)
    n = int(d * SR)
    x = np.zeros(n)
    burst = RNG.uniform(-1, 1, N)
    burst = lp(burst, 1500 + 6000 * bright, 1)
    x[:N] = burst
    a = np.zeros(N + 2)
    a[0] = 1
    a[N] = -0.5 * damp
    a[N + 1] = -0.5 * damp
    y = signal.lfilter([1.0], a, x)
    return y * env(n, 0.002, 0.05, 1, 0.08) * 0.8


def kick(d=0.45):
    t = tt(d)
    f = 45 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    click = hp(noise(0.012), 2500) * 0.25
    out = np.sin(ph) * np.exp(-t * 7)
    out[: len(click)] += click
    return out


def hat(d=0.05, op=False):
    n = hp(noise(0.3 if op else d), 7500)
    t = tt(len(n) / SR)
    return n * np.exp(-t * (10 if op else 70)) * 0.35


def sub(m, d):
    t = tt(d)
    return np.sin(2 * np.pi * mtof(m) * t) * env(len(t), 0.05, 0.2, 0.8, 0.3)


# ---------------------------------------------------------------- Foley
def whoosh(d=0.9, lo=300, hi=3000, up=True):
    n = noise(d)
    t = tt(d)
    a = bp(n, lo, (lo + hi) / 2) * (1 - t / d) + bp(n, (lo + hi) / 2, hi) * (t / d)
    if not up:
        a = a[::-1]
    shape = np.sin(np.pi * np.clip(t / d, 0, 1)) ** 1.6
    return a * shape * 0.9


def impact(d=1.2, f0=80, f1=38, grit=0.5):
    t = tt(d)
    f = f1 + (f0 - f1) * np.exp(-t * 9)
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 4.5)
    crack = lp(noise(d), 2200) * np.exp(-t * 18) * grit
    return body + crack


def clink(f=2400, d=0.6, n=3):
    t = tt(d)
    out = np.zeros_like(t)
    for k, r in enumerate([1, 2.76, 5.4, 8.9][:n]):
        out += np.sin(2 * np.pi * f * r * t + k) * np.exp(-t * (9 + 7 * k)) / (k + 1)
    return out * np.minimum(1, t / 0.0015)


def glass(d=1.6):
    out = np.zeros(int(d * SR))
    for i in range(46):
        s = clink(RNG.uniform(2600, 7800), 0.5, 3) * RNG.uniform(0.1, 0.5)
        o = int(RNG.uniform(0, d - 0.55) ** 1.6 / (d ** 0.6) * SR)
        out[o:o + len(s)] += s[: len(out) - o]
    hiss = hp(noise(d), 3500) * np.exp(-tt(d) * 3.5) * 0.35
    return out + hiss


def click(d=0.05, f=3200):
    t = tt(d)
    return bp(noise(d), f * 0.6, f * 1.6) * np.exp(-t * 90) * 0.9 + np.sin(2 * np.pi * 180 * t) * np.exp(-t * 60) * 0.4


def rain(d):
    n = noise(d)
    n = lp(hp(n, 400), 5200) * 0.12
    drops = np.zeros_like(n)
    for i in range(int(d * 26)):
        o = int(RNG.uniform(0, d - 0.05) * SR)
        s = clink(RNG.uniform(3000, 6500), 0.04, 1) * RNG.uniform(0.05, 0.18)
        drops[o:o + len(s)] += s
    return n + drops


def crackle(d):
    out = np.zeros(int(d * SR))
    for i in range(int(d * 9)):
        o = int(RNG.uniform(0, d - 0.01) * SR)
        out[o:o + 40] += RNG.standard_normal(40) * RNG.uniform(0.02, 0.12)
    return hp(out, 900)


# ---------------------------------------------------------------- reverb
def reverb(st, secs=2.6, wet=0.32, dark=5200):
    n = int(secs * SR)
    t = np.arange(n) / SR
    irs = []
    for s in (11, 12):
        r = np.random.default_rng(s).standard_normal(n) * np.exp(-t * 6.9 / secs)
        irs.append(lp(r, dark, 1) / np.sqrt(np.sum(r ** 2)) * 0.9)
    out = np.stack([signal.fftconvolve(st[0], irs[0])[: st.shape[1]], signal.fftconvolve(st[1], irs[1])[: st.shape[1]]])
    return st * (1 - wet * 0.4) + out * wet


# ---------------------------------------------------------------- the score
CH = {  # chord voicings, midi
    'D': [50, 57, 61, 64, 66], 'Bm': [47, 54, 57, 61, 62], 'G': [43, 50, 54, 59, 62], 'A': [45, 52, 54, 59, 61],
    'Em': [40, 52, 55, 59, 62], 'F#m': [42, 54, 57, 61, 64],
}
ROOT = {'D': 38, 'Bm': 35, 'G': 31, 'A': 33, 'Em': 28, 'F#m': 30}


def progression(bus, t0, t1, chords, bar, cut=1400, gain=0.5, bright=10, a=1.2, bass=0.0):
    t = t0
    i = 0
    while t < t1 - 0.3:
        d = min(bar, t1 - t)
        ch = chords[i % len(chords)]
        bus.add(t, pad(CH[ch], d + 1.6, cut, a, 1.6, bright), gain, 0)
        if bass:
            bus.add(t, lp(sub(ROOT[ch] + 12, d + 0.6), 400), bass, 0)
        t += bar
        i += 1


def arps(bus, t0, t1, chords, bar, step, gain=0.18, octave=12, pan=0.25, bright=0.6, pattern=(0, 2, 1, 3, 2, 4, 3, 1)):
    t = t0
    k = 0
    while t < t1:
        ch = chords[int((t - t0) // bar) % len(chords)]
        notes = sorted(CH[ch][1:])
        m = notes[pattern[k % len(pattern)] % len(notes)] + octave
        bus.add(t, pluck(m, 0.7, 0.995, bright), gain * (1.0 if k % 4 == 0 else 0.75), pan * (1 if k % 2 else -1))
        t += step
        k += 1


def beat(bus, t0, t1, bpm, gain=0.5, hats=True, four=True):
    b = 60 / bpm
    t = t0
    k = 0
    while t < t1:
        if four or k % 2 == 0:
            bus.add(t, kick(), gain)
        if hats:
            bus.add(t + b / 2, hat(), gain * 0.55, 0.3)
        t += b
        k += 1


def decode2(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.astype(np.float64)


def build(cues, vo_dir):
    C = cues['C']
    end = cues['end']
    seg = {s[0]: (s[1], s[2]) for s in cues['segments']}
    mus = Bus(end)   # music (ducked under the voice)
    sfx = Bus(end)   # Foley
    voi = Bus(end)   # narration

    # --- opening room: lofi night, rain, e-piano
    r0, r1 = 0.0, C['r2'] - 0.2
    sfx.add(0, rain(C['rt'] + 0.5) * env(int((C['rt'] + 0.5) * SR), 1.5, 0, 1, 2.5), 0.45)
    sfx.add(0, crackle(C['rt']), 0.6)
    t = 0.6
    for i, ch in enumerate(['D', 'Bm', 'G', 'A', 'D']):
        if t > r1:
            break
        for j, m in enumerate(CH[ch][1:]):
            mus.add(t + j * 0.045, epiano(m + 12, 3.2), 0.16, (j - 2) * 0.2)
        mus.add(t, lp(sub(ROOT[ch] + 12, 2.6), 300), 0.35)
        t += 2.6
    # title: a riser into the letters, then a soft boom + chime as they land
    rt = C['rt']
    mus.add(C['r2'], pad(CH['D'], rt - C['r2'] + 1.2, 900, 2.5, 0.8, 6), 0.55)
    sfx.add(rt - 2.2, whoosh(2.2, 400, 6000, True), 0.35)
    sfx.add(rt - 0.05, impact(1.8, 70, 34, 0.3), 0.55)
    for j, m in enumerate([74, 78, 81, 86]):
        mus.add(rt + j * 0.08, bell(m, 2.4), 0.12, (j - 1.5) * 0.3)

    # --- wake: power-on, three ribbons, logos orbit
    a1 = C['a1']
    sfx.add(a1 + 0.3, bell(86, 1.2, 0.4), 0.18)
    progression(mus, a1, seg['opening'][1] - 16.5, ['D', 'G'], 4.2, 1100, 0.45, 8, 1.8)
    for tr, m in zip(cues['ribbons'], [74, 78, 81]):
        sfx.add(tr, whoosh(0.6, 500, 4000), 0.3)
    arps(mus, C['a9'], C['a3'] - 0.4, ['D', 'G'], 4.2, 0.25, 0.1, 24, 0.5, 0.4)

    # --- the chase: driving 112 bpm
    c0, c1 = C['a3'] - 0.4, seg['orbit'][0] + 0.3
    bpm = 112
    bar = 240 / bpm
    beat(mus, c0, c1, bpm, 0.42)
    progression(mus, c0, c1, ['D', 'Bm', 'G', 'A'], bar, 1800, 0.36, 10, 0.3, 0.35)
    arps(mus, c0, c1, ['D', 'Bm', 'G', 'A'], bar, 60 / bpm / 4, 0.12, 12, 0.35, 0.7)

    # --- orbit: space, sonar thumps, slingshot
    o0, o1 = seg['orbit']
    progression(mus, o0, o1, ['G', 'A'], 3.2, 900, 0.5, 8, 1.0, 0.4)
    O = cues['orbit']
    sfx.add(O['grab'], whoosh(0.8, 300, 2500), 0.4)
    sfx.add(O['strike'], impact(1.4, 90, 40, 0.4), 0.5)
    for i, s in enumerate(O['sonar']):
        sfx.add(s, impact(0.9, 120, 55, 0.1), 0.45)
        mus.add(s, bell(74 + [0, 4, 7, 12][i], 1.5, 0.5), 0.1)
    sfx.add(O['fire'], whoosh(0.7, 800, 6000), 0.45)
    for c in O['catch']:
        sfx.add(c, clink(1800, 0.4), 0.25)
    sfx.add(O['dock'], impact(0.6, 160, 80, 0.6), 0.35)
    for f in O['flips']:
        sfx.add(f, click(0.05, 2600), 0.25)
    sfx.add(O['leap'], whoosh(1.0, 300, 5000, False), 0.4)

    # --- vault: archive mystery, then the storm and the clunk
    v0, v1 = seg['vault']
    V = cues['vault']
    progression(mus, v0, V['storm'] - 0.5, ['Bm', 'G', 'Em', 'F#m'], 3.4, 1300, 0.42, 8, 0.8, 0.3)
    arps(mus, v0 + 1.2, V['storm'] - 0.8, ['Bm', 'G', 'Em', 'F#m'], 3.4, 0.2125, 0.09, 12, 0.4, 0.5, (0, 2, 4, 2, 1, 3))
    sd = V['clunk'] - V['storm']
    storm = lp(noise(sd + 0.3), 600) * np.linspace(0.1, 1, int((sd + 0.3) * SR)) ** 2 * 0.7
    sfx.add(V['storm'], storm, 0.5)
    mus.add(V['storm'], pad([35, 42, 47], sd + 0.5, 500, 1.0, 0.3, 6), 0.6)
    sfx.add(V['clunk'], impact(2.2, 70, 30, 0.8), 0.8)
    sfx.add(V['clunk'] + 0.6, whoosh(1.6, 600, 7000, True), 0.25)
    mus.add(V['clunk'] + 0.4, pad(CH['D'], v1 - V['clunk'] + 0.5, 2200, 0.6, 0.6, 10), 0.4)

    # --- send: typing, enter, train, hyperspace, sea
    s0, s1 = seg['send']
    S = cues['send']
    for k in S['keys']:
        sfx.add(k, msum(click(0.06, 2800), impact(0.15, 150, 90, 0.2) * 0.5), 0.45, RNG.uniform(-0.4, 0.4))
    sfx.add(S['enter'], impact(1.0, 110, 45, 0.6), 0.7)
    sfx.add(S['pop'], bell(90, 0.8, 0.6), 0.15)
    progression(mus, S['pop'], S['go'], ['D', 'A', 'Bm', 'G'], bar, 1600, 0.38, 10, 0.4, 0.3)
    beat(mus, S['eng'], S['go'], bpm, 0.32, True, False)
    for c in S['couple']:
        sfx.add(c, msum(impact(0.5, 200, 90, 0.9), clink(900, 0.4, 2) * 0.4), 0.5, 0.2)
    sfx.add(S['tink'], clink(4200, 0.5), 0.25)
    sfx.add(S['go'] - 0.3, whoosh(1.4, 200, 4000), 0.5)
    sfx.add(S['fib'], whoosh(1.2, 1200, 9000), 0.35)
    sea = pad([38, 45, 50, 57], S['rush'] - S['sea'] + 0.5, 600, 0.8, 0.6, 6)
    mus.add(S['sea'], sea, 0.55)
    sfx.add(S['kick'], impact(0.5, 220, 120, 0.7), 0.4)
    sfx.add(S['scan'], bp(noise(0.9), 800, 1600) * np.sin(np.pi * tt(0.9) / 0.9), 0.15)
    sfx.add(S['rush'], whoosh(1.0, 1500, 9000), 0.4)

    # --- loop: laps at 112, brass counting machine
    l0, l1 = seg['loop']
    L = cues['loop']
    progression(mus, l0, l1, ['G', 'A', 'F#m', 'Bm'], bar, 2000, 0.36, 10, 0.5, 0.3)
    beat(mus, L['fire'], L['land'] - 0.2, bpm, 0.38)
    arps(mus, L['fire'], l1 - 0.6, ['G', 'A', 'F#m', 'Bm'], bar, 60 / bpm / 4, 0.11, 24, 0.4, 0.6)
    sfx.add(L['fire'], whoosh(0.5, 900, 5000), 0.35)
    for b in L['brass']:
        sfx.add(b, msum(impact(0.4, 240, 140, 0.8), clink(1500, 0.5, 3) * 0.5), 0.45)
    tk = L['land']
    while tk < l1 - 0.2:
        sfx.add(tk, click(0.03, 4200), 0.12)
        tk += 60 / bpm / 2

    # --- answer: anvils, the gate opens, coins, crank, shatter, letter
    e0, e1 = seg['answer']
    A = cues['answer']
    mus.add(e0, pad(CH['Bm'], A['open'] - e0 + 0.5, 1100, 0.6, 0.6, 8), 0.4)
    sfx.add(A['hit'], impact(0.8, 130, 60, 0.6), 0.5)
    for i, b in enumerate(A['anvil']):
        sfx.add(b, msum(clink(1300 + i * 140, 1.1, 4), impact(0.4, 180, 90, 0.5) * 0.6), 0.5, (i - 1.5) * 0.2)
    sfx.add(A['open'], whoosh(1.2, 800, 8000), 0.3)
    for j, m in enumerate([74, 78, 81, 86, 90]):
        mus.add(A['open'] + j * 0.06, bell(m, 2.6), 0.13, (j - 2) * 0.25)
    progression(mus, A['open'], A['crack'] - 0.2, ['D', 'G', 'A', 'D'], bar, 2400, 0.36, 12, 0.3, 0.32)
    beat(mus, A['rain'] + 0.3, A['undo'] - 0.2, bpm, 0.3)
    for i in range(40):
        tc = A['rain'] + i * 0.055 + RNG.uniform(0, 0.04)
        sfx.add(tc, clink(RNG.uniform(2400, 4200), 0.3, 3), 0.12, RNG.uniform(-0.6, 0.6))
    sfx.add(A['undo'], whoosh(1.2, 300, 3000, False), 0.4)
    sfx.add(A['kept'], impact(0.5, 160, 80, 0.4), 0.35)
    sfx.add(A['crack'], glass(1.8), 0.6)
    sfx.add(A['crack'], impact(1.4, 80, 35, 0.4), 0.45)
    mus.add(A['crack'] + 0.4, pad(CH['G'], e1 - A['crack'] + 0.5, 1300, 1.0, 1.0, 8), 0.4)
    arps(mus, A['crack'] + 1.0, e1 - 0.8, ['G', 'D'], 3.0, 0.25, 0.08, 24, 0.5, 0.4)
    sfx.add(A['throw'], whoosh(0.7, 700, 5000), 0.3)
    sfx.add(A['pop'], bell(93, 0.6, 0.4), 0.15)
    sfx.add(A['letter'], whoosh(0.8, 500, 3000), 0.3)
    sfx.add(e1 - 0.35, whoosh(0.5, 3000, 9000, False), 0.25)   # lid closes to a line

    # --- after: melancholy, music box
    f0, f1 = seg['after']
    F = cues['after']
    progression(mus, f0 + 0.4, f1, ['Bm', 'G', 'D', 'A'], 3.6, 1000, 0.48, 8, 1.6, 0.3)
    t = f0 + 1.2
    melody = [81, 78, 74, 76, 78, 74, 71, 73]
    k = 0
    while t < f1 - 1:
        mus.add(t, bell(melody[k % len(melody)], 2.0, 0.6), 0.08, 0.2 * (1 if k % 2 else -1))
        t += 0.9
        k += 1
    sfx.add(F['crash'], impact(0.9, 120, 50, 0.6), 0.45)
    sfx.add(F['crum'], lp(noise(1.0), 3000) * np.exp(-tt(1.0) * 3), 0.25)
    sfx.add(F['clunk'], impact(0.6, 180, 90, 0.7), 0.4)
    sfx.add(F['shut'], impact(1.0, 100, 45, 0.6), 0.5)
    sfx.add(F['jet'], whoosh(0.9, 600, 6000), 0.35)
    sfx.add(F['slap'], click(0.08, 1800) * 1.5, 0.5)
    sfx.add(F['suck'], whoosh(0.6, 300, 3000), 0.35)
    sfx.add(F['boom'], whoosh(1.4, 200, 6000), 0.35)

    # --- finale: two agents, four word-hits, the bloom, morning
    g0, g1 = seg['finale']
    G = cues['finale']
    mus.add(g0, pad([38, 45, 50, 57], G['hits'][0] - g0 + 0.5, 900, 1.2, 0.5, 8), 0.45)
    sfx.add(G['land'], impact(0.8, 110, 50, 0.5), 0.45)
    sfx.add(G['sneeze'], whoosh(0.5, 2000, 9000), 0.25)
    for i, (h, m) in enumerate(zip(G['hits'], [62, 66, 69, 74])):
        mus.add(h, bell(m + 12, 2.2), 0.16)
        sfx.add(h, impact(0.5, 140, 70, 0.2), 0.3)
    sfx.add(G['erupt'], impact(2.4, 60, 28, 0.3), 0.7)
    sfx.add(G['erupt'] - 0.6, whoosh(0.9, 300, 8000, True), 0.35)
    bloom0 = G['erupt']
    progression(mus, bloom0, G['fall'], ['G', 'A', 'Bm', 'D'], 2.4, 2600, 0.42, 12, 0.4, 0.35)
    arps(mus, bloom0 + 0.2, G['fall'], ['G', 'A', 'Bm', 'D'], 2.4, 0.15, 0.1, 24, 0.6, 0.7)
    for st in G['stops']:
        sfx.add(st - 0.3, whoosh(0.5, 600, 5000), 0.2)
    mus.add(G['wide'], pad(CH['D'] + [69, 74], G['room'] - G['wide'] + 1.5, 2400, 0.8, 1.6, 12), 0.45)
    for j, m in enumerate([74, 78, 81, 86, 90, 93]):
        mus.add(G['wide'] + j * 0.12, bell(m, 3.0), 0.1, (j - 2.5) * 0.25)
    # the room: warm e-piano, a soft tick for the green check, then air as the lanterns lift away
    t = G['room'] - 0.3
    for ch in ['D', 'G', 'D']:
        for j, m in enumerate(CH[ch][1:]):
            mus.add(t + j * 0.05, epiano(m + 12, 3.4), 0.14, (j - 2) * 0.2)
        mus.add(t, lp(sub(ROOT[ch] + 12, 3), 300), 0.3)
        t += 2.2
    sfx.add(G['fixed'], msum(click(0.03, 2600) * 0.5, bell(91, 0.9, 0.35) * 0.6), 0.22)
    sfx.add(G['leave'] - 0.2, whoosh(3.2, 250, 2600, True), 0.16)
    for j, m in enumerate([86, 90, 93, 98]):
        sfx.add(G['leave'] + 0.5 + j * 0.62, bell(m, 2.4, 0.3), 0.05, (j - 1.5) * 0.3)
    mus.add(G['room'] - 0.4, pad(CH['D'] + [69], end - G['room'] + 0.4, 1500, 2.0, 3.5, 8), 0.4)   # hold the morning under the fade

    # (no per-item chimes and no seam whooshes: repeated effects felt monotonous)
    # --- quiet room tone so silences never go digitally dead
    rt = lp(noise(end), 700, 2) * 0.012
    sfx.add(0, rt, 1.0)

    # --- narration
    meta = json.load(open(f'{vo_dir}/vo.json'))
    # every line at the same speech level: RMS over voiced 20 ms frames, matched to the median line (within +-9 dB)
    clips, lev = {}, {}
    for line in cues['vo']:
        if line['id'] in meta:
            x = decode(f"{vo_dir}/{line['id']}.mp3"); clips[line['id']] = x; lev[line['id']] = speech_rms(x)
    ref = float(np.median(list(lev.values()))) if lev else 1.0
    for line in cues['vo']:
        m = meta.get(line['id'])
        if not m:
            continue
        g = float(np.clip(ref / (lev[line['id']] + 1e-9), 10 ** (-9 / 20), 10 ** (9 / 20)))
        voi.add(line['t'] - m['lead'], clips[line['id']], g, 0)

    # --- mix: reverb on music, duck under the voice, gentle master
    music = reverb(mus.stereo(), 2.8, 0.38)
    fx = reverb(sfx.stereo(), 1.6, 0.18, 7000)
    v = voi.stereo()
    vm = np.abs(v[0]) + np.abs(v[1])
    w = int(0.08 * SR)
    envv = np.convolve(vm, np.ones(w) / w, 'same')
    envv = envv / (np.percentile(envv[envv > 1e-4], 90) + 1e-9)
    envv = np.clip(envv, 0, 1)
    att = signal.lfilter([0.002], [1, -0.998], envv)   # smooth release
    duck = 1 - 0.68 * np.clip(np.maximum(envv, att * 1.2), 0, 1)
    music *= duck * MUSIC
    if MUSIC_FILE:
        # produced music bed: level-matched to the voice, ducked smoothly under speech (no pumping), soft fade-in
        m = decode2(MUSIC_FILE)[:, :v.shape[1]]
        # make room for the voice: no sub rumble, and a broad dip where speech lives
        m = hp(m, 55); m = m - 0.38 * bp(m, 700, 3800)
        mm = np.zeros_like(v); mm[:, :m.shape[1]] = m
        sp = envv > 0.35
        vr = np.sqrt(np.mean(v[:, sp] ** 2)) if sp.any() else 0.05
        mr = np.sqrt(np.mean(mm[:, :m.shape[1]] ** 2)) + 1e-9
        mm *= vr / mr * 10 ** (-MUSIC_GAP_DB / 20)
        sw = int(0.35 * SR); slow = np.convolve(envv, np.ones(sw) / sw, 'same')
        slow = signal.lfilter([0.0006], [1, -0.9994], np.clip(slow * 2.2, 0, 1)) * 1.0
        slow = np.maximum(slow, np.convolve(np.clip(envv * 2, 0, 1), np.ones(sw) / sw, 'same'))
        duckm = 10 ** (-MUSIC_DUCK_DB * np.clip(slow, 0, 1) / 20)
        mm *= duckm
        fi = int(2.5 * SR); mm[:, :fi] *= np.linspace(0, 1, fi) ** 2
        music = mm
        build.music = mm
    bed = music + fx * 0.2
    mix = bed + v * 1.0
    # final fade on the last half second of the film
    fe = int((cues['C']['end'] - 0.6) * SR)
    for m in (mix, bed, v):
        m[:, fe:] *= np.linspace(1, 0, m.shape[1] - fe) ** 2
    k = 0.9 / (np.max(np.abs(mix)) + 1e-9)
    build.stems = {'bed': bed * k, 'voice': v * k}
    if MUSIC_FILE: build.stems['music'] = build.music * k
    return mix * k


def write_wav(path, st):
    data = (np.clip(st.T, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', path], input=data, check=True)


def measure(vo_dir):
    import glob, os
    out = {}
    for p in sorted(glob.glob(f'{vo_dir}/*.mp3')):
        x = decode(p)
        a, b = speech_bounds(x)
        out[os.path.basename(p)[:-4]] = {'lead': round(a, 3), 'speech': round(b - a, 3), 'file': round(len(x) / SR, 3)}
    json.dump(out, open(f'{vo_dir}/vo.json', 'w'), indent=1)
    print('export const VO = {' + ', '.join(f"{k}: {v['speech']}" for k, v in out.items()) + '};')


if __name__ == '__main__':
    if sys.argv[1] == 'measure':
        measure(sys.argv[2])
    elif sys.argv[1] == 'mix':
        if '--music' in sys.argv: MUSIC_FILE = sys.argv[sys.argv.index('--music') + 1]
        cues = json.load(open(sys.argv[2]))
        st = build(cues, sys.argv[3])
        write_wav(sys.argv[4], st)
        if '--stems' in sys.argv:
            for name, x in build.stems.items():
                write_wav(sys.argv[4].replace('.wav', f'-{name}.wav'), x)
        print('wrote', sys.argv[4], f'{st.shape[1] / SR:.1f}s')
