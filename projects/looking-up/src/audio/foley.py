"""Procedural foley + ambience beds for "Looking Up", rendered from cues.py to out/audio/foley.wav (effects, with
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


def fx_sack_drag(dur=2.5, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    base = bp(brown(n, seed), 500, q=0.6) * 0.6 + bp(pink(n, seed + 1), 1400, q=0.8) * 0.4
    push = 0.65 + 0.35 * np.abs(np.sin(np.pi * 2.0 * t)) + 0.15 * smooth_noise(n, 9, seed)
    grit = grains(n, 140, seed + 2, dur_ms=(1, 4), band=(1200, 6000)) * 0.6
    y = (base + grit) * push * env_bell(n, 0.5, 0.35)
    return norm(lp(y, 5000))


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


def fx_sack_thump(seed=0, **_):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    body = np.sin(TWO_PI * (55 + 50 * np.exp(-t / 0.03)) * t) * np.exp(-t / 0.08)
    nz = lp(white(n, seed), 500, order=2) * np.exp(-t / 0.05) * 0.8
    sand = grains(n, 400, seed + 1, dur_ms=(1, 3), band=(1500, 6000), decay=0.12) * 0.35
    return norm(body + nz + sand)


def fx_dust_poof(seed=0, big=False, **_):
    dur = 1.4 if big else 0.8
    n = int(dur * SR)
    y = bp(pink(n, seed), 1400, q=0.5) * env_exp(n, dur / 3.5, att=0.03)
    return norm(lp(y, 4000))


def fx_cloth_rustle(dur=0.5, seed=0, **_):
    n = int(dur * SR)
    src = hp(white(n, seed), 900)
    am = np.clip(smooth_noise(n, 22, seed) * 0.8 + 0.4, 0, None) ** 2
    y = lp(src * am, 5000) * env_bell(n, 0.35, 1.0)
    return norm(y)


def fx_quilt_rustle(dur=0.5, seed=0, tremble=False, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    src = bp(pink(n, seed), 1100, q=0.6)
    am = np.clip(smooth_noise(n, 12, seed) * 0.7 + 0.5, 0, None) ** 1.5
    if tremble:
        am *= 0.6 + 0.4 * np.sin(TWO_PI * 15 * t)
    return norm(src * am * env_bell(n, 0.3, 0.9))


def fx_cup_clink(seed=0, **_):
    n = int(0.35 * SR)
    y = modal(n, [2350, 3480, 5120, 6900], [1, .6, .4, .2], [0.09, 0.06, 0.04, 0.02], seed)
    y += 0.3 * hp(white(n, seed), 3000) * env_exp(n, 0.002)
    return norm(y)


def fx_cup_set(seed=0, **_):
    n = int(0.4 * SR)
    knock = resonators(white(n, seed) * env_exp(n, 0.004), [260, 520, 1100], [6, 8, 10], [1, .6, .3])
    ring = modal(n, [2200, 3300, 4700], [.5, .3, .2], [0.07, 0.05, 0.03], seed)
    return norm(knock + ring)


def fx_candle(dur=4.0, seed=0, **_):
    n = int(dur * SR)
    y = lp(brown(n, seed), 260) * (0.6 + 0.4 * smooth_noise(n, 5, seed))
    y += grains(n, 1.5, seed + 1, dur_ms=(2, 5), band=(800, 3000)) * 0.6
    return norm(dsp.fade(y, 0.4, 0.4))


def fx_shutter_creak(dur=0.8, seed=0, pitch=1.0, **_):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    f0 = r.uniform(380, 520) * pitch
    ex = stick_slip(n, lambda t: f0 * (1 + 0.35 * math.sin(math.pi * t / dur) + 0.08 * math.sin(t * 23)), seed,
                    jitter=0.08, amp_fn=lambda t: math.sin(math.pi * min(1, t / dur)) ** 0.5)
    y = resonators(ex, [f0 * 1.0, f0 * 2.02, f0 * 3.1, 1500], [30, 25, 20, 6], [1, .5, .25, .3])
    return norm(lp(y, 5000))


def fx_shutter_thunk(seed=0, **_):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    ex = white(n, seed) * env_exp(n, 0.003)
    y = resonators(ex, [170, 390, 820, 1600], [5, 7, 9, 6], [1.2, 1, .6, .25])
    y += 0.8 * np.sin(TWO_PI * (80 + 60 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05)
    return norm(y)


def fx_lamp_blow(seed=0, **_):
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    breath = bp(white(n, seed), 2000, q=0.7) * np.clip(t / 0.05, 0, 1) * np.exp(-np.clip(t - 0.25, 0, None) / 0.08)
    flutter = lp(white(n, seed + 1), 300) * (0.5 + 0.5 * np.sin(TWO_PI * 22 * t)) * np.exp(-t / 0.15) * 0.6
    return norm(breath + flutter)


def fx_breathing(dur=3.0, rate=0.25, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    cyc = np.sin(TWO_PI * rate * t) ** 2
    y = bp(pink(n, seed), 900, q=0.5) * (0.15 + cyc) * (0.8 + 0.2 * smooth_noise(n, 1, seed))
    return norm(dsp.fade(lp(y, 2500), 0.3, 0.3))


def fx_meteor_swish(dur=0.7, seed=0, muffled=False, pan=0.0, **_):
    r = np.random.default_rng(seed)
    y = whoosh(dur, r.uniform(4000, 6000), r.uniform(500, 900), q=1.6, seed=seed, peak_at=0.35)
    n = len(y)
    y += 0.25 * grains(n, 60, seed + 1, dur_ms=(1, 3), band=(3000, 9000)) * env_bell(n, 0.3, 1.0)
    if muffled:
        y = lp(y, 650, order=2)
    return norm(y)


def fx_meteor_whistle(dur=1.6, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    f = 700 * (2.6 ** u)
    tone = np.sin(TWO_PI * np.cumsum(f) / SR) * (0.3 + 0.7 * u ** 2)
    roar = dsp.sweep_filter(pink(n, seed), "lp", 300, 4000) * (0.1 + u ** 2.5)
    crackle = grains(n, 200, seed + 1, dur_ms=(1, 3), band=(2000, 8000)) * u ** 2 * 0.3
    return norm(0.5 * tone + roar + crackle)


def fx_impact_boom(seed=0, **_):
    n = int(2.5 * SR)
    t = np.arange(n) / SR
    sub = np.sin(TWO_PI * np.cumsum(32 + 40 * np.exp(-t / 0.12)) / SR) * np.exp(-t / 0.7)
    body = lp(white(n, seed), 400, order=2) * np.exp(-t / 0.35)
    crunch = bp(white(n, seed + 1), 1800, q=0.6) * np.exp(-t / 0.06)
    y = np.tanh(1.5 * (sub + 0.9 * body + 0.6 * crunch))
    return norm(y)


def fx_wood_crack(seed=0, big=False, **_):
    dur = 1.2 if big else 0.6
    n = int(dur * SR)
    t = np.arange(n) / SR
    snap = hp(white(n, seed), 400) * np.exp(-t / 0.004)
    split = grains(n, 900 if big else 500, seed + 1, dur_ms=(1, 4), band=(900, 6000), decay=0.12 if big else 0.07)
    wood = resonators(white(n, seed + 2) * np.exp(-t / 0.01), [240, 610, 1300], [6, 8, 7], [1, .7, .4])
    groan = 0.0
    if big:
        groan = resonators(stick_slip(n, lambda tt: 120 + 200 * math.exp(-tt / 0.2), seed + 3), [300, 700], [8, 8]) * \
            np.exp(-t / 0.3)
    return norm(1.4 * snap + split + wood + 0.5 * groan)


def fx_sparks(dur=0.9, seed=0, **_):
    n = int(dur * SR)
    return norm(grains(n, 250, seed, dur_ms=(0.5, 2), band=(2500, 11000), decay=dur / 3))


def fx_fall_whoosh(dur=0.3, seed=0, **_):
    return norm(whoosh(max(dur, 0.15), 3000, 500, q=1.0, seed=seed, peak_at=0.8))


def fx_flour_thud(seed=0, **_):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    body = np.sin(TWO_PI * (48 + 60 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.12)
    soft = lp(white(n, seed), 900, order=2) * np.exp(-t / 0.08)
    return norm(np.tanh(2.0 * (body + 0.8 * soft)))


def fx_flour_poof(seed=0, **_):
    n = int(2.0 * SR)
    y = bp(pink(n, seed), 900, q=0.45) * env_exp(n, 0.5, att=0.015)
    return norm(lp(y, 3500))


def fx_star_sizzle(dur=2.0, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = grains(n, 180, seed, dur_ms=(0.5, 2), band=(2500, 10000)) * (0.4 + 0.6 * np.exp(-t / 0.6))
    y += 0.15 * hp(white(n, seed + 1), 5000) * np.exp(-t / 0.8)
    return norm(dsp.fade(y, 0.01, 0.4))


def fx_splinter_clatter(dur=1.0, seed=0, **_):
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    for k in range(14):
        t0 = r.uniform(0, dur * 0.9) ** 1.3 / dur ** 0.3
        i = int(t0 * SR)
        m = int(0.05 * SR)
        if i + m < n:
            ex = white(m, seed + k) * env_exp(m, 0.002)
            y[i:i + m] += r.uniform(0.3, 1.0) * np.exp(-t0 / 0.6) * resonators(ex, [r.uniform(900, 3200)], [9])
    return norm(y)


def fx_floor_creak(seed=0, **_):
    n = int(0.7 * SR)
    ex = stick_slip(n, lambda t: 70 + 60 * math.sin(math.pi * t / 0.7), seed,
                    amp_fn=lambda t: math.sin(math.pi * t / 0.7))
    return norm(resonators(ex, [210, 470, 900], [10, 12, 9], [1, .7, .4]))


def fx_star_hum(dur=4.0, seed=0, flicker=False, **_):
    """The star's voice: a warm, faintly beating tone (E) with a soft sizzle."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for f, a, beat in ((329.6, 1.0, 0.6), (493.9, 0.5, 0.9), (659.3, 0.35, 1.3), (987.8, 0.15, 1.7)):
        y += a * (np.sin(TWO_PI * f * t) + np.sin(TWO_PI * (f + beat) * t + 1.3)) * 0.5
    am = 1 + 0.12 * np.sin(TWO_PI * 1.1 * t)
    if flicker:
        am *= 1 + 0.12 * np.sin(t * 31) + 0.08 * np.sin(t * 13.7)
    y = y * am + 0.35 * grains(n, 40, seed, dur_ms=(0.5, 2), band=(3000, 9000))
    return norm(dsp.fade(y, 0.25, 0.4))


def fx_flare_whoomph(seed=0, **_):
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    y = dsp.sweep_filter_fn(pink(n, seed), "bp", lambda tt: 180 + 900 * math.sin(math.pi * min(1, tt / 0.5)), q=0.8)
    y *= np.clip(t / 0.04, 0, 1) * np.exp(-t / 0.22)
    y += 0.4 * grains(n, 300, seed + 1, dur_ms=(0.5, 2), band=(2500, 9000), decay=0.25)
    return norm(y)


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


def fx_smoke_hiss(dur=2.0, seed=0, **_):
    n = int(dur * SR)
    y = hp(white(n, seed), 3500) * (0.7 + 0.3 * smooth_noise(n, 3, seed))
    return norm(dsp.fade(lp(y, 9000), 0.3, min(1.0, dur / 2)))


def fx_straw_rustle(dur=1.5, seed=0, **_):
    n = int(dur * SR)
    y = grains(n, 160, seed, dur_ms=(2, 6), band=(1500, 7000)) * (0.6 + 0.4 * smooth_noise(n, 6, seed))
    return norm(dsp.fade(y, 0.2, 0.3))


def fx_broom_clack(seed=0, **_):
    n = int(0.4 * SR)
    a = resonators(white(n, seed) * env_exp(n, 0.002), [650, 1450, 2600], [10, 12, 8], [1, .7, .3])
    b = np.zeros(n, np.float32)
    k = int(0.085 * SR)
    b[k:] = 0.4 * a[:n - k]
    return norm(a + b)


def fx_hiss_crackle(seed=0, **_):
    n = int(1.1 * SR)
    t = np.arange(n) / SR
    hiss = hp(white(n, seed), 2500) * np.clip(t / 0.008, 0, 1) * np.exp(-t / 0.28)
    crack = grains(n, 600, seed + 1, dur_ms=(0.5, 2.5), band=(1500, 9000), decay=0.2)
    pop = lp(white(n, seed + 2), 700) * np.exp(-t / 0.03)
    return norm(hiss + 0.9 * crack + 0.6 * pop)


def fx_yank_whoosh(seed=0, **_):
    return norm(whoosh(0.22, 2500, 700, q=1.3, seed=seed, peak_at=0.3))


def fx_arm_flaps(dur=0.8, rate=6.0, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    src = bp(pink(n, seed), 1200, q=0.8)
    am = np.abs(np.sin(np.pi * rate * t)) ** 3
    return norm(src * am * env_bell(n, 0.4, 0.6))


def fx_bowl_clunk(seed=0, **_):
    n = int(0.5 * SR)
    y = resonators(white(n, seed) * env_exp(n, 0.003), [190, 480, 1050], [8, 9, 10], [1, .6, .4])
    y += 0.5 * modal(n, [1250, 2650], [.4, .2], [0.08, 0.05], seed)
    return norm(y)


def fx_water_slosh(seed=0, **_):
    n = int(0.5 * SR)
    r = np.random.default_rng(seed)
    y = bp(pink(n, seed), 700, q=0.7) * env_bell(n, 0.2, 1.5) * 0.4
    for k in range(5):
        i = int(r.uniform(0, 0.3) * SR)
        m = int(0.06 * SR)
        tt = np.arange(m) / SR
        f = r.uniform(500, 1100) * (1 + 3 * tt)
        if i + m < n:
            y[i:i + m] += np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-tt / 0.015) * r.uniform(0.3, 1)
    return norm(y)


def fx_blanket_slide(dur=0.4, seed=0, **_):
    n = int(dur * SR)
    y = bp(pink(n, seed), 1600, q=0.6) * env_bell(n, 0.3, 1.0)
    return norm(y)


def fx_stove(dur=4.0, seed=0, **_):
    n = int(dur * SR)
    fire = lp(brown(n, seed), 180) * (0.6 + 0.4 * smooth_noise(n, 2, seed)) * 0.6
    cr = grains(n, 9, seed + 1, dur_ms=(1, 6), band=(700, 5000))
    pops = grains(n, 0.8, seed + 2, dur_ms=(4, 12), band=(300, 1500)) * 1.5
    return norm(dsp.fade(fire + cr + pops, 0.3, 0.3))


def fx_star_breath(dur=2.4, rate=2.1, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    sw = 0.5 + 0.5 * np.sin(rate * t - 1.2)
    y = (np.sin(TWO_PI * 1318.5 * t) + 0.6 * np.sin(TWO_PI * 1975.5 * t + 1) + 0.3 * np.sin(TWO_PI * 2637 * t)) * sw ** 2
    y += 0.3 * bp(white(n, seed), 3000, q=1.5) * sw ** 2
    return norm(dsp.fade(y, 0.3, 0.5))


def fx_hammer_tap(seed=0, **_):
    n = int(0.45 * SR)
    r = np.random.default_rng(seed)
    y = modal(n, [2310 * r.uniform(0.98, 1.02), 3870, 6150, 8300], [1, .6, .35, .15], [0.12, 0.08, 0.05, 0.03], seed)
    y += 0.7 * resonators(white(n, seed) * env_exp(n, 0.002), [420, 900], [6, 6])
    return norm(y)


def fx_lantern_door(seed=0, **_):
    n = int(0.35 * SR)
    sq = resonators(stick_slip(n, lambda t: 900 + 400 * t, seed, jitter=0.05,
                               amp_fn=lambda t: math.sin(math.pi * min(1, t / 0.25))), [1800, 3600], [25, 20])
    click = modal(n, [3100, 5200], [.6, .3], [0.02, 0.012], seed)
    k = int(0.27 * SR)
    sq[k:] += click[:n - k]
    return norm(sq)


def fx_hop_whoosh(seed=0, **_):
    y = whoosh(0.28, 900, 3500, q=1.0, seed=seed, peak_at=0.5)
    n = len(y)
    y += 0.2 * grains(n, 40, seed + 1, dur_ms=(1, 3), band=(4000, 9000))
    return norm(y)


def fx_glass_tinkle(seed=0, **_):
    n = int(0.6 * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    for k in range(6):
        i = int(r.uniform(0, 0.18) * SR)
        m = n - i
        y[i:] += modal(m, [r.uniform(2400, 7000), r.uniform(5000, 9000)], [1, .4], [0.08, 0.04], seed + k) * \
            r.uniform(0.3, 1.0)
    return norm(y)


def fx_flower_thump(seed=0, **_):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    thud = np.sin(TWO_PI * (90 + 70 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.04)
    leaves = bp(white(n, seed), 3000, q=0.7) * env_exp(n, 0.09, att=0.004) * 0.6
    return norm(thud + leaves)


def fx_sparkle(seed=0, **_):
    n = int(0.7 * SR)
    y = np.zeros(n, np.float32)
    for k in range(8):
        i = int(k * 0.05 * SR)
        y[i:] += modal(n - i, [2000 * 1.18 ** k], [1.0 - 0.06 * k], [0.12], seed + k)
    return norm(y)


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


def fx_stitch(seed=0, **_):
    n = int(0.25 * SR)
    pull = bp(white(n, seed), 2600, q=1.5) * env_bell(n, 0.25, 1.2)
    tick = modal(n, [4200], [0.4], [0.01], seed)
    return norm(pull + tick)


def fx_sheet_whoosh(seed=0, **_):
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    y = dsp.sweep_filter(pink(n, seed), "bp", 300, 2400, q=0.7) * env_bell(n, 0.4, 1.2)
    flap = bp(white(n, seed + 1), 900, q=0.8) * np.exp(-np.abs(t - 0.42) / 0.012) * 1.5
    return norm(y + flap)


def fx_sneeze_puff(seed=0, **_):
    n = int(0.4 * SR)
    t = np.arange(n) / SR
    tch = bp(white(n, seed), 3800, q=1.0) * np.clip(t / 0.004, 0, 1) * np.exp(-t / 0.05)
    puff = lp(pink(n, seed + 1), 900) * np.exp(-t / 0.08) * 0.6
    return norm(tch + puff)


def fx_metal_tink(seed=0, **_):
    n = int(0.3 * SR)
    return norm(modal(n, [3300, 5600, 7900], [1, .5, .25], [0.05, 0.03, 0.02], seed))


def fx_snow_crunch(seed=0, **_):
    n = int(0.22 * SR)
    y = grains(n, 900, seed, dur_ms=(0.5, 2), band=(1200, 7000)) * env_exp(n, 0.06, att=0.005)
    t = np.arange(n) / SR
    y += 0.4 * np.sin(TWO_PI * 110 * t) * np.exp(-t / 0.02)
    return norm(y)


def fx_throw_whoosh(seed=0, **_):
    return norm(whoosh(0.4, 600, 2600, q=1.1, seed=seed, peak_at=0.35))


def fx_steam_sizzle(seed=0, **_):
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    siz = grains(n, 800, seed, dur_ms=(0.5, 2), band=(2500, 10000), decay=0.35)
    hiss = hp(white(n, seed + 1), 3000) * np.clip(t / 0.01, 0, 1) * np.exp(-t / 0.35) * 0.6
    puff = bp(pink(n, seed + 2), 900, q=0.5) * env_exp(n, 0.25, att=0.03) * 0.5
    return norm(siz + hiss + puff)


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


def fx_bench_tap(seed=0, **_):
    n = int(0.25 * SR)
    r = np.random.default_rng(seed)
    return norm(resonators(white(n, seed) * env_exp(n, 0.002), [r.uniform(700, 1100), r.uniform(1800, 2600)], [9, 10]))


def fx_telescope_squeak(seed=0, **_):
    n = int(0.3 * SR)
    ex = stick_slip(n, lambda t: 1300 + 500 * t, seed, jitter=0.05, amp_fn=lambda t: math.sin(math.pi * min(1, t / 0.3)))
    return norm(resonators(ex, [1300, 2600], [30, 20]))


def fx_lamp_clink(seed=0, **_):
    n = int(0.6 * SR)
    glass = modal(n, [2900, 4400, 6300, 8100], [1, .55, .3, .15], [0.15, 0.1, 0.06, 0.04], seed)
    knock = resonators(white(n, seed) * env_exp(n, 0.003), [380, 950], [7, 8], [1, .5])
    return norm(glass + 0.8 * knock)


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


def fx_chair_scrape(seed=0, **_):
    n = int(0.35 * SR)
    ex = stick_slip(n, lambda t: 140 + 100 * t, seed, amp_fn=lambda t: math.sin(math.pi * t / 0.35))
    y = resonators(ex, [320, 760, 1500], [8, 9, 7]) + 0.3 * bp(pink(n, seed), 600, q=0.8) * env_bell(n, 0.4, 1)
    return norm(y)


def fx_top_flick(seed=0, **_):
    n = int(0.2 * SR)
    return norm(resonators(white(n, seed) * env_exp(n, 0.0015), [1500, 3200], [10, 12]))


def fx_top_whir(dur=2.4, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    spin = 26 - 6 * t / dur
    f = 240 + 20 * np.sin(TWO_PI * 1.3 * t)
    tone = sum(np.sin(TWO_PI * np.cumsum(f * h) / SR) / h for h in (1, 2, 3))
    y = tone * (0.7 + 0.3 * np.sin(TWO_PI * np.cumsum(spin) / SR))
    y += 0.4 * bp(white(n, seed), 1800, q=1.0) * (0.6 + 0.4 * np.sin(TWO_PI * np.cumsum(spin) / SR))
    return norm(dsp.fade(lp(y, 4000), 0.04, 0.4))


def fx_drop_thud(seed=0, **_):
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    thud = np.sin(TWO_PI * (110 + 50 * np.exp(-t / 0.01)) * t) * np.exp(-t / 0.05)
    tink = modal(n, [3600, 5100], [.25, .12], [0.05, 0.03], seed)
    return norm(thud + tink + 0.3 * lp(white(n, seed), 700) * np.exp(-t / 0.02))


def fx_page_turn(seed=0, **_):
    n = int(0.45 * SR)
    y = hp(white(n, seed), 1500) * (0.4 + np.clip(smooth_noise(n, 30, seed), 0, None)) * env_bell(n, 0.6, 1.2)
    return norm(lp(y, 9000))


def fx_canvas_rip(dur=0.7, seed=0, **_):
    n = int(dur * SR)
    ex = stick_slip(n, lambda t: 350 + 400 * math.sin(math.pi * t / dur), seed, jitter=0.5,
                    amp_fn=lambda t: 0.4 + 0.6 * math.sin(math.pi * t / dur))
    y = bp(ex, 2200, q=0.5) + 0.5 * bp(white(n, seed + 1), 1500, q=0.8) * env_bell(n, 0.5, 1.0)
    return norm(y)


def fx_rope_creak(seed=0, **_):
    n = int(0.8 * SR)
    ex = stick_slip(n, lambda t: 55 + 50 * math.sin(math.pi * t / 0.8), seed, jitter=0.3,
                    amp_fn=lambda t: math.sin(math.pi * t / 0.8))
    return norm(resonators(ex, [180, 410, 820], [9, 10, 8], [1, .7, .4]))


def fx_canvas_fill(dur=1.5, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = dsp.sweep_filter(pink(n, seed), "bp", 200, 900, q=0.6) * env_bell(n, 0.6, 0.8)
    y *= 0.7 + 0.3 * np.abs(np.sin(np.pi * 8 * t))
    return norm(y)


def fx_thunder(seed=0, **_):
    n = int(6.0 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    rumble = hp(lp(brown(n, seed), 160, order=2), 38, order=2)
    roll = np.clip(smooth_noise(n, 3.5, seed) * 0.6 + 0.6, 0, None) ** 2
    e = np.clip(t / 0.05, 0, 1) * np.exp(-t / 1.3)
    crack = hp(white(n, seed + 1), 300) * np.exp(-t / 0.08) * r.uniform(0.6, 1.0)
    mid = bp(white(n, seed + 2), 600, q=0.5) * np.exp(-t / 0.5) * 0.5
    y = np.tanh(1.6 * (rumble * roll * e * 2.5 + crack + mid))
    return norm(y)


def fx_canvas_flap(dur=4.0, seed=0, **_):
    n = int(dur * SR)
    src = bp(pink(n, seed), 650, q=0.5)
    rate = 6 + 3 * smooth_noise(n, 0.7, seed)
    ph = np.cumsum(rate) / SR
    am = np.abs(np.sin(np.pi * ph)) ** 4 * (0.6 + 0.4 * smooth_noise(n, 1.5, seed + 1))
    return norm(dsp.fade(src * am, 0.2, 0.3))


def fx_telescope_toss(seed=0, **_):
    n = int(2.2 * SR)
    t = np.arange(n) / SR
    w = np.zeros(n, np.float32)
    w[:int(0.45 * SR)] = whoosh(0.45, 700, 2400, q=1.0, seed=seed, peak_at=0.4)
    f = 1500 * 0.55 ** (t / 2.2)
    fall = np.sin(TWO_PI * np.cumsum(f) / SR) * np.clip((t - 0.3) / 0.2, 0, 1) * np.exp(-(t - 0.3).clip(0) / 0.9) * 0.4
    tumble = bp(white(n, seed + 1), 1100, q=2) * (0.5 + 0.5 * np.sin(TWO_PI * 5 * t)) * np.exp(-t / 0.8) * 0.3
    return norm(w + fall + tumble)


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


def fx_beam_shimmer(dur=3.0, seed=0, **_):
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    y = np.zeros(n)
    for k in range(16):
        f = r.uniform(2500, 7000)
        y += np.sin(TWO_PI * f * t) * (0.5 + 0.5 * np.sin(TWO_PI * r.uniform(0.5, 2) * t + k))
    return norm(y * env_bell(n, 0.4, 1.0))


def fx_landing_thump(seed=0, **_):
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    thud = np.sin(TWO_PI * (55 + 50 * np.exp(-t / 0.02)) * t) * np.exp(-t / 0.12)
    wicker = grains(n, 500, seed, dur_ms=(1, 4), band=(800, 4000), decay=0.12) * 0.6
    return norm(np.tanh(1.5 * (thud + 0.5 * lp(white(n, seed + 1), 600) * np.exp(-t / 0.05))) + wicker)


EFFECTS = {k[3:]: v for k, v in globals().items() if k.startswith("fx_")}


# ============================================================================================= ambience beds
def bird_chirps(n, density, seed, dist=1.0):
    """Synthesised birdsong: phrases of FM chirps from a few 'species'."""
    r = np.random.default_rng(seed)
    y = np.zeros((n, 2), np.float32)
    species = [dict(f=(2800, 4200), d=(0.04, 0.09), k=(3, 7), gap=0.07), dict(f=(3500, 6000), d=(0.02, 0.05), k=(5, 12), gap=0.04),
               dict(f=(1800, 2600), d=(0.12, 0.25), k=(2, 3), gap=0.15)]
    t = r.uniform(0, 1.0)
    dur = n / SR
    while t < dur:
        sp = species[int(r.integers(0, len(species)))]
        p = r.uniform(-0.8, 0.8)
        g = r.uniform(0.3, 1.0) / dist
        tt = t
        for _ in range(int(r.integers(*sp["k"]))):
            d = r.uniform(*sp["d"])
            m = int(d * SR)
            i = int(tt * SR)
            if i + m >= n:
                break
            u = np.arange(m) / m
            f0 = r.uniform(*sp["f"])
            sweep = f0 * (1 + r.uniform(-0.35, 0.45) * u + 0.08 * np.sin(TWO_PI * r.uniform(20, 60) * u * d))
            c = np.sin(TWO_PI * np.cumsum(sweep) / SR) * np.sin(np.pi * u) ** 1.5 * g
            y[i:i + m] += pan(c.astype(np.float32), p)
            tt += d + sp["gap"] * r.uniform(0.6, 1.4)
        t = tt + r.exponential(1.0 / density)
    return lp(y, 7500 / max(1.0, dist ** 0.5))


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


def rain(n, seed, heavy=1.0):
    hiss = hp(np.stack([pink(n, seed), pink(n, seed + 1)], axis=1), 1200) * 0.5
    drops = np.stack([grains(n, 900 * heavy, seed + 2, dur_ms=(0.5, 2), band=(1000, 9000)),
                      grains(n, 900 * heavy, seed + 3, dur_ms=(0.5, 2), band=(1000, 9000))], axis=1) * 1.2
    low = lp(np.stack([brown(n, seed + 4), brown(n, seed + 5)], axis=1), 200) * 0.2
    return hiss + drops + low


def room_tone(n, seed, warm=1.0):
    lo = hp(lp(np.stack([brown(n, seed), brown(n, seed + 1)], axis=1), 220), 70, order=2) * 0.8 * warm
    air = bp(np.stack([pink(n, seed + 2), pink(n, seed + 3)], axis=1), 2500, q=0.4) * 0.07
    return lo + air


def bed(kind, dur, seed):
    n = int(dur * SR)
    if kind == "room_day":
        y = room_tone(n, seed) + 0.25 * stereoize(fx_stove(dur, seed + 1))
    elif kind == "room_dawn":
        y = room_tone(n, seed) + lp(bird_chirps(n, 0.8, seed + 2, dist=2.5), 3000) * 0.5
    elif kind == "room_night":
        y = room_tone(n, seed, warm=0.7)
    elif kind == "room_winter":
        y = room_tone(n, seed) + lp(wind(n, seed + 3, 0.8), 500) * 0.6
    elif kind == "room_cold":
        y = room_tone(n, seed, warm=0.5) + lp(wind(n, seed + 3, 0.5), 400) * 0.3
    elif kind == "ext_dusk":
        y = wind(n, seed, 0.8, airy=0.5) + bird_chirps(n, 0.25, seed + 1, dist=3.0) * 0.35
    elif kind == "ext_day":
        y = wind(n, seed, 0.7, airy=0.4) * 0.8 + bird_chirps(n, 1.1, seed + 1, dist=1.8) * 0.6
    elif kind == "ext_autumn":
        y = wind(n, seed, 0.9, airy=0.6) + bird_chirps(n, 0.3, seed + 1, dist=3.0) * 0.35
    elif kind == "ext_night":
        y = wind(n, seed, 0.5, airy=0.3) * 0.6 + crickets(n, seed + 1, 5, 0.3)
    elif kind == "meadow_night":
        y = wind(n, seed, 0.4) * 0.4 + crickets(n, seed + 1, 12, 0.45)
    elif kind == "ext_winter":
        y = wind(n, seed, 1.0, airy=0.9)
    elif kind == "ext_wind":
        y = wind(n, seed, 1.4, howl=0.15, airy=0.8)
    elif kind == "storm":
        y = rain(n, seed, 1.0) + wind(n, seed + 7, 2.0, howl=0.35, airy=1.0) * 1.3
    elif kind == "storm_dark":
        y = rain(n, seed, 0.5) * 0.7 + wind(n, seed + 7, 1.6, howl=0.25, airy=0.6)
    elif kind == "high_wind":
        y = hp(wind(n, seed, 0.6, airy=1.2), 400) * 0.8
    else:
        raise ValueError(kind)
    return y.astype(np.float32)


def stereoize(y):
    y = np.asarray(y, np.float32)
    if y.ndim == 2:
        return y
    return np.stack([y, np.roll(y, 211)], axis=1)


# ============================================================================================= rendering
SPACES = {
    "room": dict(ir=lambda: dsp.make_ir(0.5, predelay=0.004, seed=21, er=dict(n=18, spread=0.025, gain=0.7, lp=7000),
                                       hf_damp=0.6, bright=7000), wet=0.32),
    "open": dict(ir=lambda: dsp.make_ir(1.8, predelay=0.06, seed=22, er=dict(n=4, spread=0.35, gain=0.5, lp=3000),
                                       hf_damp=0.35, bright=4000), wet=0.10),
    "storm": dict(ir=lambda: dsp.make_ir(1.2, predelay=0.02, seed=23, hf_damp=0.4, bright=5000), wet=0.15),
    "sky": dict(ir=lambda: dsp.make_ir(2.6, predelay=0.05, seed=24, hf_damp=0.3, bright=5000), wet=0.14),
}


def shot_at(t):
    for name, a, b, _d in cues.SHOTS:
        if cues.bar(a) <= t < cues.bar(b):
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
