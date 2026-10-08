"""Synthesised instruments (only for timbres with no usable sample in the system libraries):
celesta, glockenspiel, music box, bowed crotales, string harmonics, pizzicato/harp (modal plucked string),
timpani, taiko-ish toms, sub boom, cymbals (crash / mallet swell), sleigh bells.
Each voice returns a float32 stereo array (n, 2) at SR. All randomness is seeded from the call arguments."""
import math

import numpy as np

from dsp import SR, bp, hp, lp, pan, white, smooth_noise

TWO_PI = 2 * math.pi


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def _seed(*a):
    import hashlib
    return int(hashlib.md5(repr(tuple(round(float(x), 4) for x in a)).encode()).hexdigest()[:8], 16)


def _partials(n, f0, parts, t60s, phase_seed=0, detune_cents=0.0, vib=None):
    """Sum of exponentially decaying sines. parts: list of (ratio, amp); t60s: per-partial T60 (s)."""
    t = np.arange(n) / SR
    y = np.zeros(n, np.float64)
    r = np.random.default_rng(phase_seed)
    for (ratio, amp), t60 in zip(parts, t60s):
        f = f0 * ratio * 2 ** (detune_cents / 1200)
        if f >= SR * 0.45 or amp <= 0:
            continue
        ph = r.uniform(0, TWO_PI)
        if vib is None:
            y += amp * np.sin(TWO_PI * f * t + ph) * np.exp(-6.9078 * t / t60)
        else:
            inst_f = f * 2 ** (vib / 1200)
            y += amp * np.sin(TWO_PI * np.cumsum(inst_f) / SR + ph) * np.exp(-6.9078 * t / t60)
    return y


def _attack(n, a):
    e = np.ones(n)
    k = min(n, max(1, int(a * SR)))
    e[:k] = 0.5 - 0.5 * np.cos(np.linspace(0, math.pi, k))
    return e


def _tail(y, sec=0.01):
    k = min(len(y), int(sec * SR))
    y[len(y) - k:] *= np.linspace(1, 0, k)
    return y


# ------------------------------------------------------------------------------------------- keyboard percussion
def celesta(m, vel=80, dur=None, p=0.0):
    f0 = hz(m)
    v = vel / 127
    t60 = float(np.clip(3.0 * (261.6 / f0) ** 0.5, 0.5, 4.0))
    length = t60 * 0.8 + 0.05
    n = int(length * SR)
    parts = [(1.0, 1.0), (2.0, 0.20 * (0.6 + 0.4 * v)), (3.0, 0.04), (4.0, 0.05 * v), (2.76, 0.04 * v), (5.40, 0.025 * v)]
    t60s = [t60, t60 * 0.45, t60 * 0.3, t60 * 0.22, t60 * 0.15, t60 * 0.08]
    sd = _seed(m, vel, 1)
    y = _partials(n, f0, parts, t60s, sd) * 0.5 + _partials(n, f0, parts[:2], t60s[:2], sd + 1, detune_cents=1.2) * 0.5
    y *= _attack(n, 0.0012)
    click = lp(white(int(0.008 * SR), sd), min(6000, f0 * 4)) * np.exp(-np.arange(int(0.008 * SR)) / (0.0015 * SR))
    y[:len(click)] += 0.04 * click * v
    if dur is not None:       # damper (celesta has a pedal; short notes are damped)
        k = int((dur + 0.12) * SR)
        if k < n:
            y[k:] *= np.exp(-np.arange(n - k) / (0.06 * SR))
    y = _tail(y) * (v ** 1.4) * 0.5
    return pan(y.astype(np.float32), p)


def glock(m, vel=80, p=0.0):
    f0 = hz(m)
    v = vel / 127
    t60 = float(np.clip(5.0 * (523.0 / f0) ** 0.35, 1.2, 6.0))
    n = int(min(t60, 4.5) * SR)
    parts = [(1.0, 1.0), (2.756, 0.32 * (0.5 + 0.5 * v)), (5.404, 0.12 * v), (8.933, 0.05 * v)]
    t60s = [t60, t60 * 0.4, t60 * 0.18, t60 * 0.1]
    sd = _seed(m, vel, 2)
    y = _partials(n, f0, parts, t60s, sd)
    y *= _attack(n, 0.0006)
    k = int(0.004 * SR)
    y[:k] += 0.06 * v * hp(white(k, sd), 2500) * np.exp(-np.arange(k) / (0.0008 * SR))
    y = _tail(y) * (v ** 1.3) * 0.45
    return pan(y.astype(np.float32), p)


def musicbox(m, vel=80, p=0.0, detune_seed=0):
    """Comb-tine music box: clamped-free bar modes (1, 6.27, 17.55), pin-release click, slightly out of tune."""
    f0 = hz(m)
    v = vel / 127
    r = np.random.default_rng(detune_seed * 131 + m)
    cents = r.normal(0, 7)
    t60 = float(np.clip(2.6 * (1046.0 / f0) ** 0.4, 0.8, 3.5))
    n = int(t60 * 0.9 * SR)
    parts = [(1.0, 1.0), (6.267, 0.22), (2.0, 0.05), (17.55, 0.04)]
    t60s = [t60, t60 * 0.18, t60 * 0.5, t60 * 0.05]
    y = _partials(n, f0 * 2 ** (cents / 1200), parts, t60s, _seed(m, vel, 3))
    y *= _attack(n, 0.0008)
    k = int(0.003 * SR)
    y[:k] += 0.12 * hp(white(k, m + detune_seed), 3000) * np.exp(-np.arange(k) / (0.0006 * SR))
    y = hp(lp(y, 9000), 500)
    y = _tail(y) * (v ** 1.2) * 0.4
    return pan(y.astype(np.float32), p)


def crotale_bow(m, dur, vel=70, p=0.0, attack=0.5, release=1.2):
    """Bowed crotale / glass shimmer: slow attack, beating detuned pairs."""
    f0 = hz(m)
    v = vel / 127
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp, beat in ((1.0, 1.0, 0.7), (2.42, 0.18, 1.3), (4.48, 0.06, 2.1)):
        f = f0 * ratio
        if f > SR * 0.45:
            continue
        y += amp * (np.sin(TWO_PI * f * t) + np.sin(TWO_PI * (f + beat) * t + 1.0)) * 0.5
    e = np.clip(t / attack, 0, 1) ** 1.5
    e *= np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 4)))
    y = _tail(y * e) * v * 0.18
    return pan(y.astype(np.float32), p)


def harmonic(m, dur, vel=60, p=0.0, attack=0.45, release=0.9, seed=0):
    """String harmonic / flautando: near-sine with bow air and gentle delayed vibrato."""
    f0 = hz(m)
    v = vel / 127
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    vib = 7.0 * np.clip((t - 0.4) / 0.8, 0, 1) * np.sin(TWO_PI * 5.3 * t + seed)
    vib += 3.0 * smooth_noise(n, 2.0, seed + m)
    ph = TWO_PI * np.cumsum(f0 * 2 ** (vib / 1200)) / SR
    y = np.sin(ph) + 0.07 * np.sin(2 * ph + 0.3) + 0.02 * np.sin(3 * ph)
    air = bp(white(n, seed + 7 * m), f0, q=18) * 0.25
    y = y + air
    e = np.clip(t / attack, 0, 1) ** 1.8 * np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 4)))
    y = _tail(y * e) * v * 0.16
    return pan(y.astype(np.float32), p)


# ------------------------------------------------------------------------------------------- plucked strings
def pluck(m, vel=80, p=0.0, kind="pizz", dur=None, seed=0):
    """Modal plucked string. kind 'pizz' (orchestral pizzicato: short, woody body) or 'harp' (round, long)."""
    f0 = hz(m)
    v = vel / 127
    if kind == "harp":
        t60 = float(np.clip(5.0 * (130.0 / f0) ** 0.45, 0.8, 7.0))
        pos, roll, body_mix = 0.32, 1.6, 0.0
    else:
        t60 = float(np.clip(1.5 * (130.0 / f0) ** 0.55, 0.18, 2.2))
        pos, roll, body_mix = 0.18, 1.15, 1.0
    if dur is not None:
        t60 = min(t60, dur + 0.25)
    n = int(t60 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    r = np.random.default_rng(_seed(m, vel, seed, 4))
    kmax = int(min(40, (SR * 0.42) / f0))
    bright = 0.55 + 0.45 * v
    for k in range(1, kmax + 1):
        a = abs(math.sin(k * math.pi * pos)) / k ** roll * (bright ** (k - 1) if k > 1 else 1)
        if a < 1e-4:
            continue
        tk = t60 / (1 + 0.35 * (k - 1) ** 1.2)
        fk = f0 * k * (1 + 0.0002 * k * k)
        y += a * np.sin(TWO_PI * fk * t + r.uniform(0, 0.4)) * np.exp(-6.9078 * t / tk)
    y *= _attack(n, 0.0015)
    if body_mix:
        k = min(n, int(0.03 * SR))
        y[:k] += 0.08 * bp(white(k, seed + m), 1800, q=1.5) * np.exp(-np.arange(k) / (0.004 * SR)) * v
        body = bp(y, 290, q=2.0) * 1.2 + bp(y, 480, q=2.5) * 0.8 + bp(y, 2600, q=1.2) * 0.35
        y = 0.55 * y + body_mix * body
    y = lp(y, 7000 if kind == "pizz" else 9000)
    y = _tail(y) * (v ** 1.3) * 0.5
    return pan(y.astype(np.float32), p)


# ------------------------------------------------------------------------------------------- drums
def timpani(m, vel=90, p=0.0, seed=0):
    f0 = hz(m)
    v = vel / 127
    t60 = float(np.clip(3.2 * (87.0 / f0) ** 0.4, 1.5, 4.5))
    n = int(t60 * SR)
    t = np.arange(n) / SR
    glide = 1 + 0.008 * v * np.exp(-t / 0.05)
    y = np.zeros(n)
    for ratio, amp, tm in ((1.0, 1.0, 1.0), (1.504, 0.45, 0.65), (1.98, 0.28, 0.5), (2.44, 0.15, 0.35),
                           (2.9, 0.08, 0.25), (0.62, 0.15, 0.12)):
        ph = TWO_PI * np.cumsum(f0 * ratio * glide) / SR
        y += amp * np.sin(ph) * np.exp(-6.9078 * t / (t60 * tm))
    k = int(0.03 * SR)
    y[:k] += 0.5 * lp(white(k, seed + m), 1400) * np.exp(-np.arange(k) / (0.006 * SR)) * v
    y *= _attack(n, 0.002)
    y = _tail(y) * (v ** 1.5) * 0.55
    return pan(y.astype(np.float32), p)


def tom(f0, vel=90, p=0.0, decay=0.8, drop=1.3, seed=0, taiko=True):
    """Taiko-ish drum: pitch drop membrane + stick/hand attack + low thump."""
    v = vel / 127
    n = int(decay * 1.3 * SR)
    t = np.arange(n) / SR
    glide = 1 + (drop - 1) * np.exp(-t / 0.045)
    y = np.zeros(n)
    for ratio, amp, tm in ((1.0, 1.0, 1.0), (1.59, 0.32, 0.5), (2.14, 0.18, 0.35), (2.65, 0.1, 0.25)):
        ph = TWO_PI * np.cumsum(f0 * ratio * glide) / SR
        y += amp * np.sin(ph) * np.exp(-6.9078 * t / (decay * tm))
    if taiko:
        y += 0.35 * np.sin(TWO_PI * np.cumsum(f0 * 0.5 * glide) / SR) * np.exp(-6.9078 * t / (decay * 0.5))
    k = int(0.02 * SR)
    y[:k] += 0.35 * bp(white(k, seed), 2200, q=0.9) * np.exp(-np.arange(k) / (0.003 * SR)) * v
    y = _tail(y * _attack(n, 0.001)) * (v ** 1.4) * 0.6
    return pan(y.astype(np.float32), p)


def boom(vel=110, p=0.0, f_hi=78.0, f_lo=38.0, decay=2.4, seed=0):
    """Cinematic sub boom: falling sine + saturated body + noise bloom."""
    v = vel / 127
    n = int(decay * SR)
    t = np.arange(n) / SR
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.18)
    y = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-6.9078 * t / decay)
    y = np.tanh(1.8 * y) / np.tanh(1.8)
    nz = lp(white(n, seed + 11), 900, order=2) * np.exp(-t / 0.25) * 0.35
    y = _tail((y + nz) * _attack(n, 0.003)) * v * 0.8
    return pan(y.astype(np.float32), p)


def _metal(n, seed, lo=350.0, hi=13000.0, k=70):
    r = np.random.default_rng(seed)
    t = np.arange(n) / SR
    fs = np.exp(r.uniform(math.log(lo), math.log(hi), k))
    y = np.zeros(n)
    for f in fs:
        y += np.sin(TWO_PI * f * t + r.uniform(0, TWO_PI)) * r.uniform(0.3, 1.0) / (f / 1000) ** 0.3
    return y / k


def cymbal(vel=100, p=0.0, decay=3.5, seed=0):
    """Suspended cymbal crash."""
    v = vel / 127
    n = int(decay * SR)
    t = np.arange(n) / SR
    tone = _metal(n, seed)
    nz = hp(white(n, seed + 1), 2500)
    y = (tone * 2.0 + 0.5 * nz)
    lo_part = lp(y, 4000)
    hi_part = y - lo_part
    y = lo_part * np.exp(-6.9 * t / decay) + hi_part * np.exp(-6.9 * t / (decay * 0.55))
    y = _tail(y * _attack(n, 0.001)) * v * 0.4
    yl = y
    yr = np.roll(y, 37)
    out = np.stack([yl, yr], axis=1).astype(np.float32)
    return out * np.array(pan(np.ones(1, np.float32), p)[0])


def cymbal_swell(dur, vel=100, p=0.0, seed=0, choke=False, ring=2.5):
    """Mallet roll on a suspended cymbal: crescendo over `dur`, then rings (or is choked)."""
    v = vel / 127
    n = int((dur + (0.05 if choke else ring)) * SR)
    t = np.arange(n) / SR
    tone = _metal(n, seed + 5)
    nz = bp(white(n, seed + 6), 6000, q=0.4)
    y = tone * 2.2 + 0.4 * nz
    u = np.clip(t / dur, 0, 1)
    e = (np.exp(4.0 * u) - 1) / (math.e ** 4 - 1)
    e *= 1 + 0.08 * np.sin(TWO_PI * 15 * t)
    after = t > dur
    e[after] = np.exp(-(t[after] - dur) / (0.012 if choke else ring / 6.9))
    y = _tail(y * e) * v * 0.35
    y = lp(y, 9000)
    return np.stack([y, np.roll(y, 53)], axis=1).astype(np.float32) * np.array(pan(np.ones(1, np.float32), p)[0])


def sleigh(dur, vel=70, rate=7.0, p=0.0, seed=0):
    """Sleigh-bell shimmer: clusters of tiny inharmonic jingles."""
    v = vel / 127
    n = int((dur + 0.4) * SR)
    y = np.zeros(n)
    r = np.random.default_rng(seed)
    k = int(0.09 * SR)
    tt = np.arange(k) / SR
    t = 0.0
    while t < dur:
        for _ in range(r.integers(3, 7)):
            i = int((t + r.uniform(0, 0.025)) * SR)
            j = np.zeros(k)
            for _p in range(4):
                f = r.uniform(3500, 9500)
                j += np.sin(TWO_PI * f * tt + r.uniform(0, 6)) * r.uniform(0.3, 1.0)
            j *= np.exp(-tt / r.uniform(0.012, 0.03))
            e = min(n, i + k) - i
            if e > 0:
                y[i:i + e] += j[:e] * r.uniform(0.4, 1.0)
        t += 1.0 / rate * r.uniform(0.8, 1.2)
    y = _tail(hp(y, 2500)) * v * 0.08
    return pan(y.astype(np.float32), p)


def sub(m, dur, vel=80, attack=0.6, release=1.0):
    """Sine sub-drone reinforcing a low pedal."""
    f0 = hz(m)
    n = int((dur + release) * SR)
    t = np.arange(n) / SR
    y = np.sin(TWO_PI * f0 * t) + 0.15 * np.sin(TWO_PI * 2 * f0 * t)
    e = np.clip(t / attack, 0, 1) * np.where(t < dur, 1.0, np.exp(-(t - dur) / (release / 5)))
    y = _tail(y * e) * (vel / 127) * 0.25
    return pan(y.astype(np.float32), 0.0)
