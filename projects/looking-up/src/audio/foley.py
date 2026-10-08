"""Procedural foley + ambience beds for "Looking Up" (v2), rendered from cues.py to out/audio/foley.wav (effects, with
per-space reverb) and out/audio/ambience.wav (beds).

Every effect is synthesised (filtered noise, modal resonators, stick-slip friction trains, FM chirps...) and is a
pure function of its parameters + seed. Effects are peak-normalised, then placed at `gain` dBFS peak."""
import math
import os
import sys

import numpy as np
from scipy.ndimage import uniform_filter1d

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import dsp  # noqa: E402
from dsp import SR, bp, hp, lp, white, pink, brown, smooth_noise, pan  # noqa: E402
import cues  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "out", "audio")
TWO_PI = 2 * math.pi


def norm(y):
    y = np.asarray(y, np.float32)
    pk = float(np.max(np.abs(y))) if len(y) else 0.0
    return y / pk if pk > 0 else y


def env_exp(n, tau, att=0.001):
    t = np.arange(n) / SR
    return (np.clip(t / max(att, 1e-6), 0, 1) * np.exp(-t / tau)).astype(np.float32)


def env_bell(n, peak_at=0.4, power=2.0):
    u = np.linspace(0, 1, n)
    e = np.where(u < peak_at, (u / peak_at), (1 - u) / (1 - peak_at))
    return (np.clip(e, 0, 1) ** power).astype(np.float32)


def resonators(x, freqs, qs, gains=None):
    y = np.zeros_like(x)
    gains = gains or [1.0] * len(freqs)
    for f, q, g in zip(freqs, qs, gains):
        y += g * bp(x, f, q=q)
    return y


def modal(n, freqs, amps, taus, seed=0):
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    y = np.zeros(n)
    for f, a, tau in zip(freqs, amps, taus):
        if f < SR * 0.45:
            y += a * np.sin(TWO_PI * f * t + r.uniform(0, TWO_PI)) * np.exp(-t / tau)
    return y.astype(np.float32)


def stick_slip(n, rate_fn, seed, jitter=0.25, amp_fn=None):
    """Friction impulse train (creaks, squeaks, rips): impulses at a time-varying rate with jitter."""
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    t = 0.0
    dur = n / SR
    while t < dur:
        rate = max(5.0, float(rate_fn(t)))
        i = int(t * SR)
        if i < n:
            a = float(amp_fn(t)) if amp_fn else 1.0
            y[i] += a * r.uniform(0.4, 1.0) * (1 if r.random() > 0.15 else -1)
        t += (1.0 / rate) * (1 + r.uniform(-jitter, jitter))
    return y


def grains(n, rate, seed, dur_ms=(2, 8), band=(1500, 7000), decay=None):
    """Random crackle grains (Poisson), optionally with decaying density."""
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    t = 0.0
    dur = n / SR
    while t < dur:
        dens = rate * (math.exp(-t / decay) if decay else 1.0)
        t += r.exponential(1.0 / max(dens, 0.1))
        i = int(t * SR)
        k = int(r.uniform(*dur_ms) / 1000 * SR)
        if i + k < n and k > 4:
            g = r.standard_normal(k) * np.exp(-np.arange(k) / (k / 3)) * r.uniform(0.2, 1.0)
            y[i:i + k] += g.astype(np.float32)
    return bp(y, math.sqrt(band[0] * band[1]), q=max(0.3, math.sqrt(band[0] * band[1]) / (band[1] - band[0])))


def whoosh(dur, f0, f1, q=1.2, seed=0, peak_at=0.5, color="pink"):
    n = int(dur * SR)
    src = pink(n, seed) if color == "pink" else white(n, seed)
    y = dsp.sweep_filter(src, "bp", f0, f1, q=q)
    return y * env_bell(n, peak_at, 1.6)


# ============================================================================================= effects
def fx_sail_creak(seed=0, dist=1.0, **_):
    dur = 0.9 + 0.4 * (seed % 3) / 2
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    base = r.uniform(60, 110)
    ex = stick_slip(n, lambda t: base * (1 + 0.6 * math.sin(math.pi * t / dur)) + 30 * math.sin(t * 9),
                    seed, amp_fn=lambda t: math.sin(math.pi * min(1, t / dur)) ** 0.7)
    fr = list(r.uniform(280, 1400, 4))
    y = resonators(ex, fr, [12, 10, 14, 9], [1, .7, .5, .4])
    y = lp(y, 2600 * (0.5 + 0.5 / dist))
    return norm(y)


def fx_footstep(seed=0, surface="wood", soft=False, **_):
    n = int(0.18 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    f = r.uniform(120, 170)
    thump = np.sin(TWO_PI * f * t * (1 + 0.6 * np.exp(-t / 0.01))) * np.exp(-t / 0.022)
    if surface == "grass":
        rust = hp(white(n, seed), 2200) * np.exp(-t / 0.05) * 0.5
        y = 0.6 * thump + rust
    else:
        click = lp(white(n, seed), 1800 if soft else 3000) * np.exp(-t / 0.006) * 0.5
        y = thump + click + 0.3 * bp(white(n, seed + 3), r.uniform(500, 900), q=6) * np.exp(-t / 0.03)
    return norm(y) * (0.7 if soft else 1.0)


def fx_cloth_whoosh(dur=0.4, seed=0, **_):
    return norm(whoosh(dur, 400, 1800, q=0.9, seed=seed, peak_at=0.45))


def fx_cloth_rustle(dur=0.5, seed=0, **_):
    n = int(dur * SR)
    src = hp(white(n, seed), 900)
    am = np.clip(smooth_noise(n, 22, seed) * 0.8 + 0.4, 0, None) ** 2
    y = lp(src * am, 5000) * env_bell(n, 0.35, 1.0)
    return norm(y)


def fx_impact_boom(seed=0, **_):
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    sub = np.sin(TWO_PI * np.cumsum(32 + 40 * np.exp(-t / 0.12)) / SR) * np.exp(-t / 0.7)
    body = lp(white(n, seed), 400, order=2) * np.exp(-t / 0.35)
    crunch = bp(white(n, seed + 1), 1800, q=0.6) * np.exp(-t / 0.06)
    y = np.tanh(1.5 * (sub + 0.9 * body + 0.6 * crunch))
    return norm(y)


def fx_sparks(dur=0.9, seed=0, **_):
    n = int(dur * SR)
    return norm(grains(n, 250, seed, dur_ms=(0.5, 2), band=(2500, 11000), decay=dur / 3))


def fx_floor_creak(seed=0, **_):
    n = int(0.7 * SR)
    ex = stick_slip(n, lambda t: 70 + 60 * math.sin(math.pi * t / 0.7), seed,
                    amp_fn=lambda t: math.sin(math.pi * t / 0.7))
    return norm(resonators(ex, [210, 470, 900], [10, 12, 9], [1, .7, .4]))


def fx_tremble_tinkle(dur=2.0, seed=0, **_):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    t = 0.0
    while t < dur:
        i = int(t * SR)
        m = int(0.05 * SR)
        if i + m < n:
            y[i:i + m] += modal(m, [r.uniform(3000, 7500)], [r.uniform(0.2, 1)], [0.012], seed + i)
        t += r.uniform(0.04, 0.09)
    return norm(dsp.fade(y, 0.2, 0.3))


def fx_hop_whoosh(seed=0, **_):
    y = whoosh(0.28, 900, 3500, q=1.0, seed=seed, peak_at=0.5)
    n = len(y)
    y += 0.2 * grains(n, 40, seed + 1, dur_ms=(1, 3), band=(4000, 9000))
    return norm(y)


def fx_flower_thump(seed=0, **_):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    thud = np.sin(TWO_PI * (90 + 70 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.04)
    leaves = bp(white(n, seed), 3000, q=0.7) * env_exp(n, 0.09, att=0.004) * 0.6
    return norm(thud + leaves)


def fx_sparkle_whoosh(dur=3.0, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    src = pink(n, seed)
    y = dsp.sweep_filter_fn(src, "bp", lambda tt: 900 + 1800 * (0.5 + 0.5 * math.sin(TWO_PI * tt / 3.1 - 1.5)), q=1.2)
    y = y * (0.5 + 0.5 * np.sin(TWO_PI * t / 3.1 - 1.5) ** 2) * env_bell(n, 0.5, 0.4)
    r = np.random.default_rng(seed)
    for k in range(18):
        i = int((0.15 + 0.17 * k) * SR)
        if i < n:
            y[i:] += 0.15 * modal(n - i, [r.uniform(3000, 8000)], [1.0], [0.06], seed + k)
    p = np.sin(TWO_PI * t / 3.1 - 1.5)
    return np.stack([y * np.sqrt(0.5 * (1 - p)), y * np.sqrt(0.5 * (1 + p))], axis=1) / (np.max(np.abs(y)) + 1e-9)


def fx_throw_whoosh(seed=0, **_):
    return norm(whoosh(0.4, 600, 2600, q=1.1, seed=seed, peak_at=0.35))


def fx_fireflies(dur=4.0, seed=0, **_):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    t = 0.0
    while t < dur:
        i = int(t * SR)
        m = int(0.12 * SR)
        if i + m < n:
            tt = np.arange(m) / SR
            y[i:i + m] += np.sin(TWO_PI * r.uniform(4200, 6200) * tt) * np.sin(np.pi * tt / 0.12) ** 2 * r.uniform(0.3, 1)
        t += r.uniform(0.12, 0.5)
    return norm(dsp.fade(y, 0.3, 0.5))


def fx_star_rise(dur=2.5, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    y = np.zeros(n)
    for k, ratio in enumerate((1.0, 1.5, 2.0, 3.0)):
        f = 660 * ratio * 2 ** (1.2 * u)
        y += np.sin(TWO_PI * np.cumsum(f) / SR + k) / (k + 1)
    y = y * (0.6 + 0.4 * np.sin(TWO_PI * 7 * t)) + 0.4 * dsp.sweep_filter(white(n, seed), "bp", 1500, 6000, q=2.0)
    return norm(dsp.fade(y * env_bell(n, 0.7, 1.0), 0.05, 0.3))


def fx_ignition(seed=0, **_):
    n = int(3.5 * SR)
    t = np.arange(n) / SR
    rise = dsp.sweep_filter(pink(n, seed), "bp", 300, 7000, q=1.0) * np.clip(t / 0.3, 0, 1) ** 2 * np.exp(-(t - 0.3).clip(0) / 0.9)
    r = np.random.default_rng(seed)
    sh = np.zeros(n)
    for k in range(40):
        f = r.uniform(2000, 9000)
        sh += np.sin(TWO_PI * f * t + r.uniform(0, 6)) * (0.5 + 0.5 * np.sin(TWO_PI * r.uniform(8, 20) * t))
    sh *= np.clip((t - 0.2) / 0.2, 0, 1) * np.exp(-(t - 0.3).clip(0) / 1.2) / 40
    boom = np.sin(TWO_PI * np.cumsum(40 + 30 * np.exp(-(t - 0.3).clip(0) / 0.1)) / SR) * \
        np.clip((t - 0.3) / 0.01, 0, 1) * np.exp(-(t - 0.3).clip(0) / 0.6) * 0.5
    return norm(rise + 2.0 * sh + boom)



# ---------------------------------------------------------------------------------------------- v2 effects
def fx_grass_rustle(dur=0.6, seed=0, **_):
    n = int(dur * SR)
    src = bp(white(n, seed), 3600, q=0.7)
    am = np.clip(smooth_noise(n, 18, seed) * 0.8 + 0.35, 0, None) ** 2
    swish = bp(pink(n, seed + 1), 900, q=0.6) * 0.3
    return norm((src * am + swish) * env_bell(n, 0.35, 0.8))


def fx_lantern_creak(seed=0, fast=False, **_):
    """Brass lantern swinging on its hook/handle: a short metallic stick-slip squeak with a faint rattle."""
    dur = 0.22 if fast else 0.45
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    f0 = r.uniform(520, 760)
    ex = stick_slip(n, lambda t: f0 * (0.8 + 0.4 * math.sin(math.pi * t / dur)), seed, jitter=0.12,
                    amp_fn=lambda t: math.sin(math.pi * min(1, t / dur)) ** 0.6)
    y = resonators(ex, [f0 * 2.0, f0 * 3.3, 2700, 4100], [30, 25, 18, 14], [1, .5, .35, .2])
    y += 0.2 * modal(n, [2350, 3900], [.4, .2], [0.03, 0.02], seed)
    return norm(lp(y, 7000))


def fx_sparkle_ting(seed=0, **_):
    """A tiny bell sparkle (the star's twinkle): a few high glassy pings in quick succession + shimmer."""
    n = int(1.0 * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    for k in range(4):
        i = int(k * r.uniform(0.02, 0.05) * SR)
        y[i:] += modal(n - i, [r.uniform(4200, 8800), r.uniform(6000, 10000)], [1.0 - 0.15 * k, 0.3], [0.18, 0.08],
                       seed + k)
    y += 0.06 * hp(white(n, seed), 6000) * env_exp(n, 0.12, att=0.01)
    return norm(y)


def fx_sputter(dur=0.6, seed=0, **_):
    """A failing glow: irregular fizz bursts (a light trying to stay lit)."""
    n = int(dur * SR)
    gate = (smooth_noise(n, 22, seed) > 0.05).astype(np.float32)
    gate = np.convolve(gate, np.ones(96) / 96, mode="same")
    fizz = grains(n, 900, seed + 1, dur_ms=(0.3, 1.5), band=(3000, 11000)) + 0.3 * hp(white(n, seed + 2), 5000)
    return norm(fizz * gate * env_bell(n, 0.3, 0.6))


def fx_streak_whoosh(dur=1.6, direction="down", seed=0, **_):
    """A falling (or rising) star: a long whoosh with a gliding whistle and a crackling sparkle trail."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f0, f1 = (5200.0, 380.0) if direction == "down" else (450.0, 5200.0)
    body = dsp.sweep_filter(pink(n, seed), "bp", f0, f1, q=1.4)
    wf = (1900 * (0.3 ** u)) if direction == "down" else (500 * (4.0 ** u))
    whistle = np.sin(TWO_PI * np.cumsum(wf) / SR) * 0.25
    trail = grains(n, 260, seed + 1, dur_ms=(0.4, 1.8), band=(3500, 11000)) * 0.45
    e = np.clip(u / 0.12, 0, 1) ** 1.5 * (np.clip((1 - u) / 0.15, 0, 1) if direction == "down" else
                                          (0.4 + 0.6 * u ** 1.5))
    y = (body + whistle + trail) * e
    p = (-0.5 + 1.0 * u) if direction == "down" else (0.3 - 0.3 * u)
    return np.stack([y * np.sqrt(0.5 * (1 - p)), y * np.sqrt(0.5 * (1 + p))], axis=1) / (np.max(np.abs(y)) + 1e-9)


def fx_lantern_grab(seed=0, **_):
    n = int(0.5 * SR)
    clank = modal(n, [1250, 2950, 4400, 6100], [1, .6, .35, .2], [0.08, 0.05, 0.035, 0.02], seed)
    thump = resonators(white(n, seed) * env_exp(n, 0.002), [480, 1100], [7, 8], [1, .5])
    squeak = np.zeros(n, np.float32)
    c = fx_lantern_creak(seed + 1, fast=True)
    i = int(0.06 * SR)
    k = min(len(c), n - i)
    squeak[i:i + k] = 0.5 * c[:k]
    return norm(clank + 0.6 * thump + squeak)


def fx_skid(seed=0, **_):
    n = int(0.45 * SR)
    y = dsp.sweep_filter(pink(n, seed), "bp", 1600, 350, q=0.9) * env_bell(n, 0.25, 0.9)
    y += 0.5 * grains(n, 500, seed + 1, dur_ms=(0.5, 2), band=(1200, 6000), decay=0.25)
    t = np.arange(n) / SR
    y += 0.5 * np.sin(TWO_PI * 130 * t) * np.exp(-np.abs(t - 0.36) / 0.02) * (t > 0.34)
    return norm(y)


def fx_crater(dur=6.0, seed=0, **_):
    """The smoking crater: embers ticking, a soft hot hiss and an occasional ember pop over a low smoulder."""
    n = int(dur * SR)
    embers = grains(n, 45, seed, dur_ms=(0.4, 2.0), band=(2500, 9000))
    pops = grains(n, 1.2, seed + 1, dur_ms=(3, 9), band=(500, 2500)) * 1.6
    hiss = hp(white(n, seed + 2), 4500) * 0.12 * (0.7 + 0.3 * smooth_noise(n, 2, seed))
    smoulder = lp(brown(n, seed + 3), 220) * 0.25 * (0.6 + 0.4 * smooth_noise(n, 1, seed + 4))
    return norm(dsp.fade(embers + pops + hiss + smoulder, 0.3, 0.6))


# the star's tiny bell-like "voice": (notes as (pitch Hz, start s, length s), vibrato Hz, vibrato depth cents)
_VOICE = {
    "scared": ([(1480, 0.0, 0.16), (1319, 0.13, 0.16), (1175, 0.27, 0.32)], 9.0, 35),
    "flinch": ([(1760, 0.0, 0.07), (2349, 0.05, 0.12)], 0.0, 0),
    "ask": ([(1175, 0.0, 0.14), (1760, 0.13, 0.32)], 5.5, 15),
    "happy": ([(1175, 0.0, 0.1), (1480, 0.08, 0.1), (1760, 0.16, 0.35)], 6.0, 12),
    "giggle": ([(1760, 0.0, 0.07), (1480, 0.08, 0.07), (1760, 0.16, 0.07), (1480, 0.24, 0.07), (1319, 0.32, 0.18)],
               0.0, 0),
    "sad": ([(1480, 0.0, 0.35), (1175, 0.3, 0.6)], 5.0, 25),
    "tender": ([(1760, 0.0, 0.25), (1480, 0.22, 0.55)], 4.5, 10),
}


def fx_star_voice(mood="happy", seed=0, **_):
    notes, vib, depth = _VOICE[mood]
    total = max(s + d for _, s, d in notes) + 0.5
    n = int(total * SR)
    y = np.zeros(n)
    for k, (f, s, d) in enumerate(notes):
        i = int(s * SR)
        m_ = int((d + 0.45) * SR)
        m_ = min(m_, n - i)
        tt = np.arange(m_) / SR
        slide = 1.0 + (0.04 if mood == "sad" and k == 1 else 0.0) * np.exp(-tt / 0.08)
        fv = f * slide * 2 ** (depth * np.sin(TWO_PI * vib * tt) / 1200) if vib else f * slide
        ph = TWO_PI * np.cumsum(fv) / SR
        tone = np.sin(ph) + 0.28 * np.sin(2 * ph + 0.4) + 0.08 * np.sin(3 * ph) + 0.05 * np.sin(4.17 * ph)
        e = np.clip(tt / 0.006, 0, 1) * np.where(tt < d, 1.0, np.exp(-(tt - d) / 0.09)) * np.exp(-tt / (d + 0.3))
        breath = bp(white(m_, seed + k), f, q=6) * 0.35
        y[i:i + m_] += (tone + breath) * e
    return norm(y)


def fx_lantern_set(seed=0, **_):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    thud = np.sin(TWO_PI * (150 + 60 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.035)
    rattle = modal(n, [2100, 3300, 5200], [.5, .3, .15], [0.05, 0.035, 0.02], seed)
    glass = modal(n, [4700], [0.2], [0.04], seed + 1)
    return norm(thud + rattle + glass + 0.3 * grains(n, 200, seed, dur_ms=(1, 3), band=(1500, 5000), decay=0.05))


def fx_soft_pat(seed=0, **_):
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    y = np.sin(TWO_PI * (180 + 80 * np.exp(-t / 0.008)) * t) * np.exp(-t / 0.03)
    y += 0.4 * bp(white(n, seed), 1200, q=0.8) * np.exp(-t / 0.015)
    return norm(y)


def fx_glow_swell(dur=1.2, seed=0, **_):
    """The star's warmth returning: a soft harmonic swell (D) with a rising airy shimmer."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    y = np.zeros(n)
    for k, (f, a) in enumerate(((587.3, 1.0), (880.0, 0.6), (1174.7, 0.45), (1760.0, 0.25), (2349.3, 0.12))):
        y += a * np.sin(TWO_PI * f * t + k) * (1 + 0.15 * np.sin(TWO_PI * (0.8 + 0.3 * k) * t))
    air = dsp.sweep_filter(white(n, seed), "bp", 1500, 7000, q=2.0) * 0.4
    return norm((y + air) * np.clip(u / 0.35, 0, 1) ** 2 * np.clip((1 - u) / 0.5, 0, 1))


def fx_petal_burst(seed=0, **_):
    n = int(0.9 * SR)
    puff = bp(pink(n, seed), 2200, q=0.6) * env_exp(n, 0.22, att=0.02)
    flutter = grains(n, 160, seed + 1, dur_ms=(2, 6), band=(2000, 7000), decay=0.3) * 0.5
    return norm(puff + flutter)


def fx_gust(dur=2.5, seed=0, **_):
    """A big gust: a swelling wind surge sweeping across, with grass rolling in waves under it."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    a, b = pink(n, seed), pink(n, seed + 1)
    fc = lambda tt: 300 + 900 * math.sin(math.pi * min(1.0, tt / dur)) ** 1.5
    y = np.stack([dsp.sweep_filter_fn(a, "bp", fc, q=0.6), dsp.sweep_filter_fn(b, "bp", fc, q=0.6)], axis=1)
    swell = np.clip(u / 0.3, 0, 1) ** 2 * np.clip((1 - u) / 0.55, 0, 1) ** 1.3
    grass = hp(np.stack([white(n, seed + 2), white(n, seed + 3)], axis=1), 2500) * 0.35
    grass *= (0.5 + 0.5 * np.sin(TWO_PI * 1.6 * t[:, None] + np.array([[0.0, 1.2]])) ** 2)
    howl = dsp.sweep_filter_fn(white(n, seed + 4), "bp", lambda tt: 600 + 400 * tt / dur, q=14)[:, None] * 1.5
    y = (y + grass + howl) * swell[:, None]
    p = -0.6 + 1.2 * u
    y[:, 0] *= np.sqrt(0.5 * (1 - p))
    y[:, 1] *= np.sqrt(0.5 * (1 + p))
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_sail_groan(dur=2.5, seed=0, **_):
    """The great sails turning: slow wooden groans through the shaft, rope creaks, canvas flutter."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    groan = stick_slip(n, lambda tt: 38 + 25 * math.sin(tt * 2.1) + 12 * math.sin(tt * 5.3), seed, jitter=0.35,
                       amp_fn=lambda tt: 0.5 + 0.5 * math.sin(math.pi * min(1.0, tt / dur)))
    y = resonators(groan, [120, 265, 540, 980], [8, 9, 10, 8], [1, .8, .5, .25])
    for k, tc in enumerate(np.linspace(0.2, dur - 0.5, 4)):
        i = int(tc * SR)
        c = fx_sail_creak(seed=seed + 10 + k, dist=0.8)
        j = min(n - i, len(c))
        y[i:i + j] += 0.5 * c[:j]
    canvas = bp(pink(n, seed + 2), 600, q=0.6) * (0.5 + 0.5 * np.abs(np.sin(np.pi * 6.5 * t))) * 0.35
    return norm(dsp.fade(y + canvas, 0.15, 0.5))


def fx_sparkle_cascade(dur=2.0, seed=0, **_):
    """Ignition sparks: a shower of tiny chimes, falling in pitch, thinning out."""
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    t = 0.0
    while t < dur * 0.9:
        i = int(t * SR)
        u = t / dur
        f = r.uniform(3500, 9500) * (1 - 0.45 * u)
        y[i:] += modal(n - i, [f, f * 2.4], [1.0, 0.25], [r.uniform(0.08, 0.3), 0.05], seed + i)[:n - i] * \
            (1 - 0.8 * u) * r.uniform(0.3, 1.0)
        t += r.exponential(0.02 + 0.12 * u)
    return norm(y)


EFFECTS = {k[3:]: v for k, v in globals().items() if k.startswith("fx_")}


# ============================================================================================= ambience beds
def crickets(n, seed, count=5, level=1.0):
    r = np.random.default_rng(seed)
    t = np.arange(n) / SR
    y = np.zeros((n, 2), np.float32)
    for k in range(count):
        fc = r.uniform(3800, 5200) * (1 + 0.004 * smooth_noise(n, 0.3, seed + 50 + k))
        pulse_rate = r.uniform(28, 40)
        chirp_period = r.uniform(0.35, 0.8)
        npulse = int(r.integers(2, 5))
        ph = (t + r.uniform(0, chirp_period)) % chirp_period
        gate = (ph < npulse / pulse_rate) * (np.sin(np.pi * pulse_rate * ph) ** 2)
        tone = np.sin(TWO_PI * np.cumsum(fc) / SR + k) * gate
        amp = r.uniform(0.3, 1.0) * (0.7 + 0.3 * smooth_noise(n, 0.2, seed + k))
        y += pan((tone * amp).astype(np.float32), r.uniform(-0.9, 0.9))
    return y * level


def wind(n, seed, strength=1.0, howl=0.0, airy=0.0):
    a = pink(n, seed)
    b = pink(n, seed + 1)
    fcl = 350 + 250 * strength
    y = np.stack([dsp.sweep_filter_fn(a, "bp", lambda tt: fcl * (1 + 0.5 * math.sin(tt * 0.31 + seed)), q=0.5),
                  dsp.sweep_filter_fn(b, "bp", lambda tt: fcl * (1 + 0.5 * math.sin(tt * 0.27 + seed + 2)), q=0.5)], axis=1)
    gust = (0.55 + 0.45 * smooth_noise(n, 0.25, seed + 3)) ** 2
    y = y * gust[:, None]
    if howl > 0:
        h = dsp.sweep_filter_fn(white(n, seed + 4), "bp", lambda tt: 700 + 300 * math.sin(tt * 0.6 + seed), q=12)
        y += howl * np.stack([h, np.roll(h, 331)], axis=1) * gust[:, None] * 2.0
    if airy > 0:
        air = hp(np.stack([white(n, seed + 5), white(n, seed + 6)], axis=1), 3500) * 0.15 * airy
        y += air * gust[:, None]
    return hp(lp(y, 6000), 90, order=2)


def bed(kind, dur, seed):
    """Night ambience beds (exterior, one night)."""
    n = int(dur * SR)
    if kind == "night_meadow":          # crickets close + a soft wind bed + a distant breeze
        y = crickets(n, seed + 1, 8, 0.3) + wind(n, seed, 0.45, airy=0.3) * 0.55 + lp(wind(n, seed + 9, 0.8), 500) * 0.4
    elif kind == "night_gallery":       # higher up: more breeze, the crickets further away
        y = wind(n, seed, 0.7, airy=0.45) * 0.8 + lp(crickets(n, seed + 1, 6, 0.3), 5000) * 0.6
    elif kind == "night_hush":          # the crickets stop: only the wind
        y = wind(n, seed, 0.45, airy=0.25) * 0.7
    elif kind == "high_air":            # far above the cloud sea, the wind dropped: thin moving air
        y = hp(wind(n, seed, 0.5, airy=1.0), 500, order=2) * 0.8
    elif kind == "gust_wind":           # the gust builds
        y = wind(n, seed, 1.3, howl=0.1, airy=0.8)
    else:
        raise ValueError(kind)
    return y.astype(np.float32)


def stereoize(y):
    y = np.asarray(y, np.float32)
    if y.ndim == 2:
        return y
    return np.stack([y, np.roll(y, 211)], axis=1)


# ============================================================================================= rendering
SPACES = {   # v2 is all exterior: the open mountain night, and the sky high above the cloud sea
    "open": dict(ir=lambda: dsp.make_ir(1.8, predelay=0.06, seed=22, er=dict(n=4, spread=0.35, gain=0.5, lp=3000),
                                       hf_damp=0.35, bright=4000), wet=0.10),
    "sky": dict(ir=lambda: dsp.make_ir(2.6, predelay=0.05, seed=24, hf_damp=0.3, bright=5000), wet=0.14),
}


def shot_at(t):
    for name, *_ in cues.SHOTS:
        if cues.start(name) <= t < cues.end(name):
            return name
    return cues.SHOTS[-1][0]


def _render_events(events, n):
    buses = {k: np.zeros((n, 2), np.float32) for k in SPACES}
    for (t, kind, p) in events:
        p = dict(p)
        gain = p.pop("gain", -30)
        pn = p.pop("pan", 0.0)
        y = EFFECTS[kind](**p)
        y = stereoize(y) if np.ndim(y) == 2 else pan(y, pn)
        dsp.place(buses[cues.SPACE[shot_at(t + 0.01)]], y * dsp.db(gain), t)
    out = np.zeros((n, 2), np.float32)
    for k, bus in buses.items():
        if np.any(bus):
            out += bus + SPACES[k]["wet"] * dsp.convolve(bus, SPACES[k]["ir"]())[:n]
    return out


def render_foley(length=cues.DURATION + 3.0):
    """Effects in segments between smash cuts (cues.HARD_CUTS): each segment's tails, reverb included, are cut
    dead (10 ms fade) at the next smash cut."""
    n = int(length * SR)
    bounds = [0.0] + sorted(cues.HARD_CUTS) + [length]
    out = np.zeros((n, 2), np.float32)
    k = int(0.010 * SR)
    for t0, t1 in zip(bounds[:-1], bounds[1:]):
        seg = _render_events([e for e in cues.FOLEY if t0 <= e[0] < t1], n)
        j = int(t1 * SR)
        if j < n:
            seg[j:] = 0.0
            seg[j - k:j] *= np.linspace(1, 0, k)[:, None]
        out += seg
    return out


def render_beds(length=cues.DURATION + 3.0, xfade=0.03):
    """Ambience: consecutive shots with the same bed kind share one continuous bed; beds hard-cut with picture
    (30 ms crossfades). Level per shot is automated with short ramps."""
    n = int(length * SR)
    out = np.zeros((n, 2), np.float32)
    runs = []
    for (t0, t1, kind, lev) in cues.BEDS:
        if runs and runs[-1][2] == kind and abs(runs[-1][1] - t0) < 1e-6:
            runs[-1][1] = t1
            runs[-1][3].append((t0, t1, lev))
        else:
            runs.append([t0, t1, kind, [(t0, t1, lev)]])
    for k, (t0, t1, kind, levs) in enumerate(runs):
        a = max(0.0, t0 - xfade)
        last = k == len(runs) - 1
        b = min(length, t1 + (2.5 if last else xfade))
        y = bed(kind, b - a, seed=1000 + k)
        y = y / (np.sqrt(np.mean(y ** 2)) + 1e-9)          # unit RMS, then level from the cue sheet (dB RMS)
        tt = a + np.arange(len(y)) / SR
        lv = np.full(len(y), levs[0][2], np.float64)
        for (s0, s1, l) in levs:
            lv[(tt >= s0) & (tt < s1)] = l
        lv = uniform_filter1d(lv, int(0.2 * SR), mode="nearest")
        g = 10 ** (lv / 20)
        e = np.ones(len(y), np.float32)
        kx = int(2 * xfade * SR)
        e[:kx] = np.linspace(0, 1, kx)
        if not last:
            e[-kx:] = np.linspace(1, 0, kx)
        dsp.place(out, y * (g * e)[:, None], a)
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    fol = render_foley()
    amb = render_beds()
    L = int((cues.DURATION + 0.5) * SR)
    dsp.write_wav(os.path.join(OUT, "foley.wav"), fol[:L])
    dsp.write_wav(os.path.join(OUT, "ambience.wav"), amb[:L])
    print(f"foley: {len(cues.FOLEY)} events, peak {dsp.to_db(np.abs(fol).max()):.1f} dBFS; "
          f"ambience peak {dsp.to_db(np.abs(amb).max()):.1f} dBFS")


if __name__ == "__main__":
    main()
