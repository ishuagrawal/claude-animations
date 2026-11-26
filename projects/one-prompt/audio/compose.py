#!/usr/bin/env python3
"""Original underscore for One Prompt, composed to the picture: each act gets its own key, texture and energy, and every
section starts on the film's own cue times (out/cues-audio.json), so the music re-times with the voice.
  python3 audio/compose.py out/cues-audio.json out/music.wav
Instruments are synthesized here (piano with stretched partials and hammer noise, detuned string/pad section, FM bells,
Karplus-Strong plucks, sine bass, soft acoustic-style drums); nothing is sampled.
"""
import json, subprocess, sys
import numpy as np
from scipy import signal

SR = 48000
RNG = np.random.default_rng(11)
BPM = 88.0
BEAT = 60 / BPM
BAR = 4 * BEAT
NOTE = {n: i for i, n in enumerate(['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'])}
QUAL = {'': [0, 4, 7], 'm': [0, 3, 7], 'maj7': [0, 4, 7, 11], 'm7': [0, 3, 7, 10], 'sus2': [0, 2, 7], 'sus4': [0, 5, 7],
        'add9': [0, 4, 7, 14], 'madd9': [0, 3, 7, 14], '6': [0, 4, 7, 9], 'maj9': [0, 4, 7, 11, 14], 'm9': [0, 3, 7, 10, 14]}


def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(max(d, 0.001) * SR)) / SR
def lp(x, f, o=2): return signal.sosfilt(signal.butter(o, min(f, SR * 0.45), 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return signal.sosfilt(signal.butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, a, b, o=2): return signal.sosfilt(signal.butter(o, [a, min(b, SR * 0.45)], 'band', fs=SR, output='sos'), x)
def noise(d): return RNG.standard_normal(int(d * SR))


def chord(name):
    """'F#m7' or 'D/F#' -> (root midi class, pcs, bass pc)"""
    slash = None
    if '/' in name: name, slash = name.split('/')
    r = name[:2] if len(name) > 1 and name[1] == '#' else name[:1]
    q = name[len(r):]
    root = NOTE[r]; pcs = [(root + i) % 12 for i in QUAL[q]]
    return root, pcs, NOTE[slash] if slash else root


def voice(pcs, prev=None, lo=52, hi=74, n=4):
    """pick n chord tones in [lo, hi] close to the previous voicing (smooth voice leading)"""
    cands = sorted(m for m in range(lo, hi + 1) if m % 12 in pcs)
    best, bs = None, 1e9
    for start in range(len(cands)):
        v = []
        for m in cands[start:]:
            if m % 12 not in [x % 12 for x in v] or len(v) >= len(set(pcs)): v.append(m)
            if len(v) == n: break
        if len(v) < min(n, 3): continue
        s = sum(min(abs(a - b) for b in prev) for a in v) if prev else abs(np.mean(v) - 62) * 2
        if s < bs: bs, best = s, v
    return best


# ---------------------------------------------------------------- instruments (cached where it pays)
CACHE = {}
def piano(m, vel=0.5, dur=2.0):
    key = ('p', m, round(vel * 8), round(min(dur, 6) * 4))
    if key in CACHE: return CACHE[key]
    d = min(dur, 6) + 1.2; t = tt(d); f = mtof(m); out = np.zeros_like(t)
    tau = 3.2 * (440 / f) ** 0.4; B = 0.00035
    for k in range(1, 14):
        fk = f * k * np.sqrt(1 + B * k * k)
        if fk > 9000: break
        amp = (1 / k ** (1.9 - 0.9 * vel)) * (1 + 0.25 * np.sin(k * 1.7))
        dec = np.exp(-t * (1.1 + 0.55 * k) / tau) * 0.7 + np.exp(-t * 0.35 * (1 + 0.2 * k) / tau) * 0.3
        for det in (-0.0006, 0.0006):
            out += amp * dec * np.sin(2 * np.pi * fk * (1 + det) * t + k * 0.9) * 0.5
    ham = bp(noise(0.03), 900, 5000) * np.exp(-tt(0.03) * 140) * 0.06 * vel
    out[:len(ham)] += ham
    out = lp(out, 1800 + 5200 * vel, 1)
    rel = int(min(dur, 6) * SR); n = len(out)
    if rel < n: out[rel:] *= np.exp(-np.arange(n - rel) / SR * 7)
    out *= np.minimum(1, t / 0.003) * vel
    CACHE[key] = out; return out


def saw(f, d, det=0.0):
    t = tt(d); ph = (f * (1 + det) * t + RNG.random()) % 1.0
    return 2 * ph - 1


def pad(ms, d, cut=1600, a=1.2, r=1.6, bright=1.0, vib=0.0):
    t = tt(d + r); out = np.zeros_like(t)
    for m in ms:
        f = mtof(m)
        for det in (-0.004, 0.0, 0.0045):
            if vib:
                ph = np.cumsum(f * (1 + det) * (1 + vib * np.sin(2 * np.pi * 5.2 * t + m))) / SR
                out += (2 * (ph % 1.0) - 1)
            else:
                out += saw(f, d + r, det)[:len(t)]
    out = lp(out, cut * bright, 2) / (len(ms) * 3)
    env = np.minimum(1, t / a) * np.where(t < d, 1, np.exp(-(t - d) * 3 / r))
    return out * env


def bell(m, d=3.0, vel=0.5, ratio=3.5):
    t = tt(d); f = mtof(m); idx = 2.2 * vel * np.exp(-t * 3)
    out = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * ratio * t)) * np.exp(-t * 1.4)
    out += 0.25 * np.sin(2 * np.pi * f * 2 * t) * np.exp(-t * 3)
    return out * np.minimum(1, t / 0.002) * vel


def pluck(m, d=0.9, bright=0.5, vel=0.6):
    key = ('k', m, round(d * 4), round(bright * 4), round(vel * 6))
    if key in CACHE: return CACHE[key]
    f = mtof(m); N = int(SR / f); n = int(d * SR); x = np.zeros(n)
    b = lp(RNG.uniform(-1, 1, N), 1200 + 6000 * bright, 1); x[:N] = b
    a = np.zeros(N + 2); a[0] = 1; a[N] = -0.4985; a[N + 1] = -0.4985
    y = signal.lfilter([1.0], a, x) * vel
    y[-int(0.06 * SR):] *= np.linspace(1, 0, int(0.06 * SR))
    CACHE[key] = y; return y


def bass(m, d, vel=0.6):
    t = tt(d + 0.25); f = mtof(m)
    out = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 0.012) * np.where(t < d, np.exp(-t * 0.6), np.exp(-d * 0.6) * np.exp(-(t - d) * 14))
    return np.tanh(out * 1.3) * env * vel


def lead(m, d, vel=0.4):
    t = tt(d + 0.3); f = mtof(m)
    ph = np.cumsum(f * (1 + 0.004 * np.sin(2 * np.pi * 5 * t) * np.minimum(1, t / 0.4))) / SR
    out = 0.6 * np.sin(2 * np.pi * ph) + 0.25 * np.sin(6 * np.pi * ph) + 0.1 * np.sin(10 * np.pi * ph)
    env = np.minimum(1, t / 0.05) * np.where(t < d, 1, np.exp(-(t - d) * 10))
    return lp(out, 2600, 1) * env * vel


def kick(vel=0.6):
    t = tt(0.5); f = 42 + 90 * np.exp(-t * 30)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7) * vel


def hat(vel=0.3, open_=False):
    d = 0.25 if open_ else 0.05; n = hp(noise(d), 7000); return n * np.exp(-tt(d) * (12 if open_ else 80)) * vel


def shaker(vel=0.2):
    n = bp(noise(0.09), 4000, 11000); t = tt(0.09); return n * np.minimum(1, t / 0.02) * np.exp(-t * 40) * vel


def rim(vel=0.3):
    t = tt(0.08); return (bp(noise(0.08), 1500, 4000) * 0.5 + np.sin(2 * np.pi * 820 * t)) * np.exp(-t * 60) * vel


def brush(vel=0.3):
    n = bp(noise(0.25), 1500, 7000); t = tt(0.25); return n * np.minimum(1, t / 0.01) * np.exp(-t * 14) * vel


def swell(d, up=True, lo=300, hi=6000):
    t = tt(d); n = noise(d); x = bp(n, lo, hi) * (t / d) ** 2.2
    return x if up else x[::-1]


def boom(vel=0.6):
    t = tt(2.5); f = 38 + 30 * np.exp(-t * 6)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 1.6) + lp(noise(2.5), 300) * np.exp(-t * 3) * 0.3) * vel


# ---------------------------------------------------------------- buses
class Bus:
    def __init__(self, n): self.L = np.zeros(n); self.R = np.zeros(n); self.n = n
    def add(self, t, x, g=1.0, pan=0.0):
        i = int(round(t * SR))
        if i < 0: x = x[-i:]; i = 0
        if i >= self.n or not len(x): return
        x = x[:self.n - i]; a = (pan + 1) * np.pi / 4
        self.L[i:i + len(x)] += x * g * np.cos(a) * 1.414; self.R[i:i + len(x)] += x * g * np.sin(a) * 1.414
    def st(self): return np.stack([self.L, self.R])


def reverb(st, secs=2.6, pre=0.02, dark=6000):
    n = int(secs * SR); t = np.arange(n) / SR; out = []
    for s in (3, 4):
        r = np.random.default_rng(s).standard_normal(n) * np.exp(-t * 6.9 / secs); r[:int(pre * SR)] = 0
        r = lp(r, dark, 1); r /= np.sqrt(np.sum(r ** 2))
        out.append(signal.fftconvolve(st[0 if s == 3 else 1], r)[:st.shape[1]])
    return np.stack(out)


# ---------------------------------------------------------------- helpers to write music
class Score:
    def __init__(self, n):
        self.dry = Bus(n); self.wet = Bus(n); self.drums = Bus(n)
    def note(self, t, x, g, pan=0.0, rev=0.3, drums=False):
        (self.drums if drums else self.dry).add(t, x, g * (1 - rev * 0.5), pan); self.wet.add(t, x, g * rev, pan)
    def piano_chord(self, t, ms, vel, dur, spread=0.0, g=1.0):
        for i, m in enumerate(sorted(ms)):
            self.note(t + i * spread + RNG.uniform(0, 0.012), piano(m, vel * RNG.uniform(0.9, 1.05), dur), g * 0.32, (m - 62) / 30, 0.35)
    def melody(self, t0, motif, tonic, inst='piano', vel=0.5, g=1.0, beat=BEAT, oct=0):
        t = t0
        for off, ln in motif:
            if off is not None:
                m = tonic + off + 12 * oct; d = ln * beat
                if inst == 'piano': x, gg, rv = piano(m, vel, d * 1.1), 0.36, 0.38
                elif inst == 'bell': x, gg, rv = bell(m, max(2.0, d * 1.5), vel), 0.16, 0.5
                else: x, gg, rv = lead(m, d * 0.95, vel), 0.3, 0.35
                self.note(t + RNG.uniform(0, 0.01), x, g * gg, 0.12, rv)
            t += ln * beat
        return t


MOTIF = [(-5, 1), (0, 1), (2, 1), (4, 1), (2, 1.5), (0, .5), (-3, 1), (-5, 1), (4, 2), (2, 1), (0, 1), (0, 3), (None, 1)]
MOTIF_M = [(-5, 1), (0, 1), (2, 1), (3, 1), (2, 1.5), (0, .5), (-2, 1), (-5, 1), (3, 2), (2, 1), (0, 1), (0, 3), (None, 1)]
MOTIF_B = [(4, 1), (7, 1), (9, 1.5), (7, .5), (4, 2), (2, 1), (4, 1), (2, 1), (0, 1), (-1, 1), (0, 3), (None, 1)]


def compose(cues):
    C = cues['C']; seg = {s[0]: s[1] for s in cues['segments']}; end = cues['end']; n = int((end + 2) * SR)
    S = Score(n)
    fade_marks = []

    def prog(t0, t1, chords, per, fn):
        """walk a chord progression from t0 to t1, 'per' seconds per chord, calling fn(t, chord_name, voicing, idx)"""
        t, i, prev = t0, 0, None
        while t < t1 - 0.05:
            name = chords[i % len(chords)]; root, pcs, bpc = chord(name); v = voice(pcs, prev); prev = v
            fn(t, name, v, i, min(per, t1 - t), bpc); t += per; i += 1

    # --- 1. Intro: felt piano in the rain (D major) ------------------------------------------------
    rt = C['rt']; per = (rt - 0.6) / 4
    def intro(t, name, v, i, d, bpc):
        S.note(t, piano(38 + (bpc - 2) % 12, 0.32, d * 1.2), 0.3, -0.1, 0.4)
        for k, m in enumerate(sorted(v)): S.note(t + 0.18 + k * 0.42, piano(m, 0.30, d - k * 0.4), 0.3, (m - 62) / 30, 0.45)
    prog(0.6, rt - 0.3, ['D', 'Bm', 'Gmaj7', 'Asus4'], per, intro)
    S.melody(0.6 + per * 1.0, MOTIF[:8], 74, 'piano', 0.33, 0.8, beat=per / 4 * 1.0)
    # title: a soft swell, then a bell chord as the letters land
    S.note(rt - 1.9, swell(1.9, True, 400, 7000), 0.05, 0, 0.6)
    S.note(rt, boom(0.5), 0.35, 0, 0.3)
    for k, m in enumerate([62, 69, 74, 78, 81]): S.note(rt + k * 0.05, bell(m, 4.0, 0.45), 0.13, (k - 2) * 0.3, 0.6)
    S.note(rt, pad([50, 57, 62, 66], C['a1'] - rt + 0.5, 1100, 0.3, 1.5), 0.34, 0, 0.5)

    # --- 2. Wake: pad and celesta, curious (D major) -------------------------------------------------
    a1, a3 = C['a1'], C['a3']; per = (a3 - a1) / 5
    def wake(t, name, v, i, d, bpc):
        S.note(t, pad(v, d, 1300, 1.0, 1.4), 0.42, 0, 0.45)
        if t > C['a2'] - 0.5:
            S.note(t, bass(26 + bpc, d * 0.95, 0.5), 0.26, 0, 0.1)
            st = BEAT / 2; k = 0; tt0 = t
            while tt0 < t + d - 0.05:
                m = sorted(v)[[0, 1, 2, 3, 2, 1][k % 6] % len(v)] + 12
                S.note(tt0, bell(m, 1.4, 0.22 + 0.06 * (k % 4 == 0)), 0.14, 0.35 * (1 if k % 2 else -1), 0.55); tt0 += st; k += 1
    prog(a1, a3 - 0.2, ['Dmaj9', 'Gmaj7', 'Bm7', 'Gmaj7', 'Asus4'], per, wake)
    S.note(a3 - 1.4, swell(1.4, True, 600, 9000), 0.05, 0, 0.5)

    # --- 3. Chase: a light, curious pulse (D major, 88 bpm) -----------------------------------------
    o0 = seg['orbit']
    def chase(t, name, v, i, d, bpc):
        r = 38 + (bpc - 2) % 12
        for b in range(4):
            tb = t + b * BEAT
            if tb > o0 - 0.1: break
            S.note(tb, kick(0.55 if b in (0, 2) else 0.0), 0.5, 0, 0, True) if b in (0, 2) else None
            if b in (1, 3): S.note(tb, brush(0.22), 0.4, 0.1, 0.15, True)
            S.note(tb, bass(r + (7 if b == 2 and i % 2 else 0), BEAT * 0.8, 0.5), 0.3, 0, 0.05)
            for s in range(4):
                ts = tb + s * BEAT / 4 + (0.025 if s % 2 else 0)
                S.note(ts, shaker(0.16 + 0.08 * (s == 0)), 0.5, 0.45, 0.1, True)
        S.piano_chord(t, v, 0.34, BEAT * 2, 0.0, 0.8)
        pat = [0, 1, 2, 3, 2, 1, 0, 2]
        for s in range(8):
            ts = t + s * BEAT / 2
            if ts > o0 - 0.1: break
            S.note(ts, pluck(sorted(v)[pat[s] % len(v)] + 12, 0.6, 0.45, 0.5), 0.2, 0.3 * (1 if s % 2 else -1), 0.3)
    prog(a3, o0, ['D', 'D', 'Bm', 'Bm', 'G', 'G', 'Asus4', 'A', 'D', 'Bm'], BAR, chase)
    S.melody(a3 + 2 * BAR, MOTIF, 74, 'bell', 0.5, 1.0)
    S.melody(a3 + 6 * BAR, MOTIF_B, 74, 'piano', 0.42, 0.9)
    S.note(o0 - 1.6, swell(1.6, True, 500, 9000), 0.06, 0, 0.4)

    # --- 4. Orbit: open space, half-time (G major colour) -------------------------------------------
    v0 = seg['vault']
    def orbit(t, name, v, i, d, bpc):
        S.note(t, pad(v + [sorted(v)[0] + 12], d, 1500, 0.8, 1.6), 0.4, 0, 0.55)
        S.note(t, bass(26 + bpc, d * 0.9, 0.45), 0.28, 0, 0.1)
        if i % 2 == 0: S.note(t, kick(0.4), 0.45, 0, 0.05, True)
        for s in range(int(d / BEAT)):
            m = sorted(v)[[3, 2, 1, 2][s % 4] % len(v)] + 24
            S.note(t + s * BEAT, pluck(m, 1.0, 0.3, 0.35), 0.16, 0.5 * (1 if s % 2 else -1), 0.6)
    prog(o0, v0 - 0.2, ['Gmaj7', 'A', 'F#m7', 'Bm', 'Gmaj7', 'Asus4'], BAR * 1.2, orbit)
    S.melody(C['a5'] + 0.4, MOTIF_B[:6], 74, 'bell', 0.4, 0.8)
    S.note(v0 - 1.4, swell(1.4, False, 300, 5000), 0.06, 0, 0.5)

    # --- 5. Vault: the archive, mysterious and curious (B minor) -------------------------------------
    storm, clunk = cues['vault']['storm'], cues['vault']['clunk']
    def vault(t, name, v, i, d, bpc):
        r = 35 + (bpc - 11) % 12
        S.note(t, pad(v, d, 1100, 0.9, 1.4), 0.34, 0, 0.45)
        S.note(t, bass(r, d * 0.7, 0.5), 0.3, 0, 0.1)
        pat = [0, 2, 1, 2, 3, 2, 1, 2]
        for s in range(8):
            ts = t + s * BEAT / 2
            S.note(ts, pluck(sorted(v)[pat[s] % len(v)], 0.35, 0.15, 0.55 + 0.1 * (s == 0)), 0.26, -0.25 + 0.5 * (s % 2), 0.25)
        if C['b3'] - 1 < t < storm: S.note(t + BEAT, rim(0.25), 0.4, 0.2, 0.2, True); S.note(t + 3 * BEAT, rim(0.25), 0.4, 0.2, 0.2, True)
        if C['b4'] - 0.5 < t < storm:
            for s in range(8): S.note(t + s * BEAT / 2, bell(sorted(v)[s % len(v)] + 24, 1.6, 0.2), 0.1, 0.4 * (1 if s % 2 else -1), 0.6)
    prog(v0, storm - 0.3, ['Bm', 'Gmaj7', 'Em7', 'F#sus4', 'Bm', 'Gmaj7', 'Em9', 'F#'], BAR, vault)
    S.melody(C['b2'] + 0.3, MOTIF_M, 71, 'piano', 0.38, 0.9)
    # storm: drone and rising tremolo, then everything stops for the switch
    sd = clunk - storm
    S.note(storm, pad([35, 42, 47], sd + 0.2, 500, 0.8, 0.1), 0.55, 0, 0.3)
    for k, m in enumerate([59, 60, 61, 62]):
        tk = storm + k * sd / 4; trem = pad([m, m + 7], sd / 4 + 0.1, 2400, 0.2, 0.1, 1.0, 0.0)
        trem *= 0.6 + 0.4 * np.sign(np.sin(2 * np.pi * 9 * tt(len(trem) / SR)))
        S.note(tk, lp(trem, 3000), 0.22 + 0.06 * k, 0, 0.35)
    tb = storm; k = 0
    while tb < clunk - 0.2: S.note(tb, kick(0.35 + 0.05 * k), 0.45, 0, 0.2, True); tb += BEAT * max(0.4, 1 - k * 0.07); k += 1
    fade_marks.append((clunk - 0.05, clunk + 0.35))   # silence for the switch
    S.note(clunk + 0.35, pad([50, 57, 62, 66, 69], seg['send'] - clunk + 1.0, 1700, 0.6, 1.2), 0.42, 0, 0.55)
    S.note(clunk + 0.35, bell(74, 3.5, 0.4), 0.14, -0.2, 0.6); S.note(clunk + 0.55, bell(81, 3.0, 0.35), 0.12, 0.2, 0.6)

    # --- 6. Send + work: a brighter, steady groove (G major) ----------------------------------------
    s0, l0, a0 = seg['send'], seg['loop'], seg['answer']; enter = cues['send']['enter']
    def typing(t, name, v, i, d, bpc):
        S.piano_chord(t, v, 0.3, d, 0.05, 0.8)
        for s in range(int(d / (BEAT / 2))): S.note(t + s * BEAT / 2, hat(0.14), 0.35, 0.3, 0.05, True)
    prog(C['c1'], enter, ['Gadd9', 'D/F#'], BAR, typing)
    S.note(enter, boom(0.45), 0.3, 0, 0.3); S.note(enter, swell(0.3, False, 2000, 9000), 0.05, 0, 0.4)
    def groove(t, name, v, i, d, bpc, work=False):
        r = 31 + (bpc - 7) % 12
        for b in range(4):
            tb = t + b * BEAT
            if b in (0, 2): S.note(tb, kick(0.5), 0.5, 0, 0, True)
            if b in (1, 3): S.note(tb, brush(0.28), 0.45, 0.1, 0.2, True)
            for e in range(2): S.note(tb + e * BEAT / 2 + (0.02 if e else 0), hat(0.12 + 0.05 * (e == 0)), 0.35, 0.3, 0.05, True)
            bl = [0, 0, 7, 12][b] if not work else [0, 12, 7, 10][b]
            S.note(tb + (BEAT / 2 if b == 3 else 0), bass(r + bl, BEAT * 0.55, 0.5), 0.3, 0, 0.05)
            # offbeat piano chords, soft and short
            S.piano_chord(tb + BEAT / 2, v, 0.24 + 0.04 * (b == 1), BEAT * 0.45, 0.0, 0.7)
        if work and i % 2 == 1:
            for s in range(8): S.note(t + s * BEAT / 2, pluck(sorted(v)[[0, 1, 2, 3][s % 4] % len(v)] + 12, 0.5, 0.5, 0.45), 0.17, 0.3 * (1 if s % 2 else -1), 0.3)
    prog(enter, l0, ['G', 'D/F#', 'Em7', 'Cmaj7'], BAR, groove)
    S.melody(C['c2'] + 3 * BAR, MOTIF, 67, 'lead', 0.4, 0.9, oct=1)
    d4 = C['d4']
    prog(l0, d4, ['Em7', 'Cmaj7', 'G', 'D'], BAR, lambda *q: groove(*q, work=True))
    S.melody(C['d2'] - 0.2, MOTIF_B, 67, 'lead', 0.38, 0.9, oct=1)
    # the brass counting machine: the groove turns into a clock
    def clock(t, name, v, i, d, bpc):
        r = 31 + (bpc - 7) % 12
        for s in range(16):
            S.note(t + s * BEAT / 4, rim(0.12 + 0.12 * (s % 4 == 0)), 0.38, 0.35 * (1 if s % 2 else -1), 0.1, True)
        for b in range(4): S.note(t + b * BEAT, bass(r + (0 if b % 2 == 0 else 7), BEAT * 0.3, 0.55), 0.3, 0, 0.05)
        S.note(t, kick(0.45), 0.45, 0, 0, True)
        S.note(t, pad(v, d, 1300, 0.5, 0.8), 0.28, 0, 0.4)
        for s in range(4): S.note(t + s * BEAT + BEAT / 2, bell(sorted(v)[s % len(v)] + 24, 1.0, 0.25), 0.1, 0.4, 0.5)
    prog(d4, a0 - 0.2, ['Em', 'C', 'Am7', 'D', 'Em', 'C', 'D', 'Dsus4'], BAR, clock)
    S.note(a0 - 1.5, swell(1.5, True, 600, 10000), 0.07, 0, 0.4)

    # --- 7. Answer: the fix lands, a lift into A major -----------------------------------------------
    A = cues['answer']; op, crack = A['open'], A['crack']
    def build(t, name, v, i, d, bpc):
        S.note(t, pad(v, d, 1500, 0.4, 0.6), 0.36, 0, 0.4)
        S.note(t, bass(31 + (bpc - 7) % 12, d * 0.9, 0.5), 0.28, 0, 0.1)
        for b in range(int(d / BEAT) * 2): S.note(t + b * BEAT / 2, brush(0.12 + 0.04 * b), 0.4, 0, 0.2, True)
    prog(C['e1'] - 0.2, op - 0.05, ['Em7', 'C', 'Dsus4'], max(1.0, (op - C['e1']) / 3), build)
    S.note(op, boom(0.55), 0.36, 0, 0.3)
    for k, m in enumerate([69, 73, 76, 81, 85]): S.note(op + k * 0.06, bell(m, 3.5, 0.45), 0.13, (k - 2) * 0.3, 0.6)
    def lift(t, name, v, i, d, bpc, full=True):
        r = 33 + (bpc - 9) % 12
        S.note(t, pad(v + [sorted(v)[-1] + 5], d, 2200, 0.25, 1.0, 1.0, 0.003), 0.42, 0, 0.5)
        S.note(t, bass(r, d * 0.9, 0.55), 0.3, 0, 0.1)
        for s in range(8): S.note(t + s * BEAT / 2, piano(sorted(v)[[0, 1, 2, 3, 2, 3, 1, 2][s] % len(v)] + 12, 0.32, BEAT), 0.26, 0.2 * (1 if s % 2 else -1), 0.35)
        if full:
            for b in range(4):
                if b in (0, 2): S.note(t + b * BEAT, kick(0.5), 0.48, 0, 0, True)
                if b in (1, 3): S.note(t + b * BEAT, brush(0.26), 0.45, 0.1, 0.2, True)
    prog(op, C['e2'], ['A', 'E/G#', 'F#m7', 'D'], BAR, lift)
    S.melody(op + 0.2, MOTIF[:8], 81, 'bell', 0.5, 1.0)
    undo, kept = A['undo'], A['kept']
    prog(C['e2'], undo - 0.1, ['A', 'E/G#', 'F#m7', 'Dmaj7'], BAR, lambda *q: lift(*q, full=False))
    S.note(undo - 0.9, swell(0.9, True, 800, 8000)[::-1] * 0 + swell(0.9, True, 800, 8000), 0.06, 0, 0.5)   # reverse whoosh into the undo
    S.note(undo, pad([57, 61, 64, 68], kept - undo, 900, 0.1, 0.3), 0.28, 0, 0.5)              # a held breath while it rewinds
    S.note(kept, bell(81, 2.5, 0.45), 0.14, 0.2, 0.6); S.note(kept, bell(88, 2.0, 0.3), 0.1, -0.2, 0.6)
    prog(kept + 0.05, crack - 0.15, ['A', 'D'], BAR / 2, lambda *q: lift(*q, full=False))
    fade_marks.append((crack - 0.1, crack + 0.9))     # the glass shatters in near-silence

    # --- 8. Crash reports, ratings, feedback: delicate (B minor) ------------------------------------
    f1 = C['f1']
    def delicate(t, name, v, i, d, bpc):
        S.note(t, pad(v, d, 900, 1.0, 1.2), 0.3, 0, 0.5)
        for s in range(4): S.note(t + s * BEAT, pluck(sorted(v)[s % len(v)] + 12, 0.8, 0.25, 0.4), 0.17, 0.3 * (1 if s % 2 else -1), 0.45)
    prog(crack + 0.9, f1 - 0.2, ['Bm7', 'Gmaj7', 'Dmaj7', 'Asus4'], BAR, delicate)
    fade_marks.append((f1 - 0.15, f1 + 1.2))          # the lid closes

    # --- 9. After: reflective piano, then strings (B minor -> D) ------------------------------------
    g1 = C['g1']; t0 = f1 + 1.2; per = BAR * 1.25
    def after(t, name, v, i, d, bpc):
        r = 35 + (bpc - 11) % 12
        S.note(t, piano(r, 0.34, d), 0.32, -0.1, 0.4)
        for k, m in enumerate(sorted(v)): S.note(t + 0.25 + k * 0.34, piano(m + (12 if k == len(v) - 1 else 0), 0.27, d - 0.3), 0.28, (m - 62) / 30, 0.45)
        if t > C['f2'] - 0.5: S.note(t, pad(v, d, 1300, 1.4, 1.6, 1.0, 0.0025), 0.24, 0, 0.55)
        if t > C['f3'] - 0.5:
            S.note(t, bass(r, d * 0.9, 0.4), 0.2, 0, 0.1)
            for s in range(int(d / (BEAT / 2))): S.note(t + s * BEAT / 2, pluck(sorted(v)[[0, 2, 1, 2][s % 4] % len(v)] + 12, 0.45, 0.3, 0.32), 0.1, 0.3 * (1 if s % 2 else -1), 0.35)
    prog(t0, C['f5'], ['Bm', 'Gmaj7', 'D/F#', 'Em7', 'Bm', 'G', 'D', 'Asus4', 'Bm', 'Gmaj7'], per, after)
    S.melody(t0 + per, MOTIF_M, 71, 'piano', 0.32, 0.85, beat=per / 4)
    prog(C['f5'], g1 - 0.4, ['D', 'G', 'D/F#', 'Asus4'], BAR, lambda t, name, v, i, d, bpc: (S.note(t, pad(v, d, 1500, 0.8, 1.2), 0.24, 0, 0.5), [S.note(t + s * BEAT / 2, pluck(sorted(v)[s % len(v)] + 12, 0.4, 0.5, 0.4), 0.16, 0.3 * (1 if s % 2 else -1), 0.3) for s in range(8)]))

    # --- 10. Finale: two agents, then the bloom (D major), then morning --------------------------
    F = cues['finale']; erupt, wide, room = F['erupt'], F['wide'], F['room']
    S.note(g1, pad([50, 57, 64, 69], erupt - g1, 1200, 1.5, 0.6), 0.34, 0, 0.55)
    for k in range(int((erupt - g1) / BEAT)):
        if k % 2 == 0: S.note(g1 + k * BEAT, bell([74, 76, 81, 78][(k // 2) % 4], 2.0, 0.28), 0.11, 0.4 * (1 if k % 4 else -1), 0.6)
    S.note(erupt - 2.2, swell(2.2, True, 300, 9000), 0.09, 0, 0.4)
    S.note(erupt, boom(0.65), 0.4, 0, 0.35)
    def bloom(t, name, v, i, d, bpc):
        r = 38 + (bpc - 2) % 12
        S.note(t, pad(v + [sorted(v)[0] + 12, sorted(v)[1] + 12], d, 2600, 0.3, 1.4, 1.0, 0.003), 0.48, 0, 0.55)
        S.note(t, bass(r - 12, d * 0.9, 0.55), 0.32, 0, 0.1)
        for s in range(int(d / (BEAT / 2))): S.note(t + s * BEAT / 2, piano(sorted(v)[[0, 1, 2, 3, 2, 1][s % 6] % len(v)] + 12, 0.3, BEAT), 0.24, 0.25 * (1 if s % 2 else -1), 0.4)
        S.note(t, kick(0.42), 0.45, 0, 0.1, True)
    prog(erupt, wide, ['D', 'A/C#', 'Bm7', 'Gmaj7'], BAR, bloom)
    S.melody(erupt + BAR * 0.5, MOTIF, 74, 'bell', 0.55, 1.0)
    S.melody(erupt + BAR * 0.5, MOTIF, 62, 'piano', 0.4, 0.8)
    S.note(wide, pad([43, 50, 59, 62, 66, 71], room - wide + 1.0, 2200, 0.6, 1.8, 1.0, 0.003), 0.46, 0, 0.6)   # hold the full bloom
    for k, m in enumerate([74, 78, 81, 86]): S.note(wide + k * 0.12, bell(m, 3.5, 0.35), 0.11, (k - 1.5) * 0.3, 0.6)
    # morning: the theme, alone, on piano, and a last chord
    S.melody(room + 0.4, MOTIF, 74, 'piano', 0.32, 0.9, beat=BEAT * 1.1)
    S.piano_chord(room + 0.4, [50, 57, 62, 66], 0.24, 6.0, 0.08, 0.8)
    last = min(end - 3.0, room + 0.4 + 15 * BEAT * 1.1)
    S.piano_chord(last, [38, 50, 57, 62, 66, 69], 0.3, 4.0, 0.06, 0.9)
    S.note(last, bell(86, 4.0, 0.3), 0.1, 0.2, 0.7)
    return S, fade_marks, end


def master(S, marks, end):
    dry = S.dry.st() + S.drums.st() * 0.9
    mix = dry + reverb(S.wet.st(), 2.6, 0.025, 6500) * 0.9
    # sidechain-free gentle glue: soft clip
    mix = np.tanh(mix * 1.1) / 1.1
    # timed silences (fast dip, smooth return)
    n = mix.shape[1]; g = np.ones(n)
    for a, b in marks:
        i, j = int(a * SR), int(b * SR); k = int(0.04 * SR)
        g[i:j] = 0.0; g[max(0, i - k):i] = np.minimum(g[max(0, i - k):i], np.linspace(1, 0, i - max(0, i - k)))
        r = int(0.6 * SR); g[j:j + r] = np.minimum(g[j:j + r], np.linspace(0, 1, len(g[j:j + r])))
    mix *= g
    fe = int((end - 2.0) * SR); mix[:, fe:] *= np.linspace(1, 0, n - fe) ** 2
    return mix / (np.max(np.abs(mix)) + 1e-9) * 0.8


if __name__ == '__main__':
    cues = json.load(open(sys.argv[1]))
    S, marks, end = compose(cues)
    mix = master(S, marks, end)
    data = (np.clip(mix.T, -1, 1) * 32767).astype('<i2').tobytes()
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', sys.argv[2]], input=data, check=True)
    print('wrote', sys.argv[2], f'{mix.shape[1] / SR:.1f}s')
