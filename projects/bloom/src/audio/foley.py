"""Procedural foley + ambience beds for BLOOM, rendered from cues.py to out/audio/foley.wav (effects, with per-space
reverb) and out/audio/ambience.wav (beds).

Every sound is synthesised (filtered noise, modal resonators, stick-slip friction trains, Poisson impact trains
convolved with small "stone"/"ice"/"clay" kernels, FM chirps for the birds and the sprout's voice ...) and is a pure
function of its parameters + seed: no recordings. Effects are peak-normalised, then placed at `gain` dBFS peak."""
import math
import os
import sys

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import oaconvolve

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import dsp  # noqa: E402
from dsp import SR, bp, hp, lp, white, pink, brown, smooth_noise, pan  # noqa: E402
import cues  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.dirname(HERE)), "out", "audio")
TWO_PI = 2 * math.pi


# ============================================================================================= building blocks
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
    """Friction impulse train (creaks, squeaks, scrapes): impulses at a time-varying rate with jitter."""
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


def poisson_times(dur, rate_fn, seed, tmin=0.0):
    """Event times of an inhomogeneous Poisson process (thinning)."""
    r = np.random.default_rng(seed)
    grid = np.linspace(0, dur, 200)
    rmax = max(1e-3, float(np.max([rate_fn(x) for x in grid])))
    k = int(rmax * dur * 1.3) + 10
    ts = np.cumsum(r.exponential(1.0 / rmax, k))
    ts = ts[ts < dur]
    keep = r.uniform(0, 1, len(ts)) < np.array([rate_fn(x) for x in ts]) / rmax
    return ts[keep & (ts >= tmin)]


def impacts(n, times, kernels, seed, amp=None):
    """Impulse train at `times` (s) convolved with randomly chosen kernels (vectorised: one convolution per
    kernel). amp: per-impact amplitudes (default random 0.2-1)."""
    r = np.random.default_rng(seed)
    out = np.zeros(n, np.float32)
    if len(times) == 0:
        return out
    a = r.uniform(0.2, 1.0, len(times)) if amp is None else np.asarray(amp)
    which = r.integers(0, len(kernels), len(times))
    idx = (np.asarray(times) * SR).astype(int)
    for k, ker in enumerate(kernels):
        sel = (which == k) & (idx < n)
        if not np.any(sel):
            continue
        imp = np.zeros(n, np.float32)
        np.add.at(imp, idx[sel], a[sel] * np.where(r.random(sel.sum()) > 0.5, 1, -1))
        out += oaconvolve(imp, ker)[:n].astype(np.float32)
    return out


def kernel_bank(kind, count, seed):
    """Small impact sounds: 'stone' (gravel/scree), 'ice' (hail on rock), 'clay' (hits on Claude), 'drop' (rain),
    'ember' (crackle), 'twig'."""
    r = np.random.default_rng(seed)
    ks = []
    for i in range(count):
        if kind == "stone":
            n = int(r.uniform(0.02, 0.06) * SR)
            fr = r.uniform(700, 3200, 3)
            k = modal(n, fr, [1, .5, .3], [r.uniform(0.004, 0.012)] * 3, seed + i) + \
                0.6 * hp(white(n, seed + i), 1500) * env_exp(n, 0.002)
        elif kind == "ice":                 # short, broadband (low-Q) ticks: no audible pitch when massed
            n = int(0.02 * SR)
            fr = r.uniform(1800, 11000, 3)
            k = modal(n, fr, [1, .6, .3], [r.uniform(0.0005, 0.0018)] * 3, seed + i) + \
                1.0 * hp(white(n, seed + i), r.uniform(1500, 4000)) * env_exp(n, r.uniform(0.0004, 0.0012))
        elif kind == "clay":
            n = int(0.09 * SR)
            t = np.arange(n) / SR
            f0 = r.uniform(140, 260)
            k = np.sin(TWO_PI * f0 * t * (1 + 0.5 * np.exp(-t / 0.006))) * np.exp(-t / 0.018) + \
                0.4 * bp(white(n, seed + i), r.uniform(900, 1600), q=2.0) * env_exp(n, 0.006)
        elif kind == "drop":
            n = int(0.012 * SR)
            k = hp(white(n, seed + i), r.uniform(1500, 4000)) * env_exp(n, r.uniform(0.0008, 0.003))
        elif kind == "ember":
            n = int(r.uniform(0.004, 0.012) * SR)
            k = bp(white(n, seed + i), r.uniform(1500, 6000), q=1.0) * env_exp(n, n / SR / 4)
        elif kind == "twig":
            n = int(0.03 * SR)
            k = modal(n, r.uniform(1500, 4500, 2), [1, .5], [0.004, 0.003], seed + i) + \
                0.5 * white(n, seed + i) * env_exp(n, 0.0015)
        else:
            raise ValueError(kind)
        ks.append(np.asarray(k, np.float32) / (np.max(np.abs(k)) + 1e-9))
    return ks


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


def pan_sweep(y, p0, p1):
    y = np.asarray(y, np.float32)
    p = np.linspace(p0, p1, len(y))
    return np.stack([y * np.sqrt(0.5 * (1 - p)), y * np.sqrt(0.5 * (1 + p))], axis=1)


def stereo_noise(fn, n, seed):
    return np.stack([fn(n, seed), fn(n, seed + 1)], axis=1)


# ============================================================================================= effects: ash valley
def fx_ash_step(seed=0, soft=False, run=False, heavy=False, dist=1.0, **_):
    """A foot pressing into deep ash over charcoal: a muffled thump, a powdery 'pff', a few charcoal crunches."""
    n = int((0.35 if heavy else 0.25) * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    f = r.uniform(70, 110) if heavy else r.uniform(95, 140)
    thump = np.sin(TWO_PI * f * t * (1 + 0.5 * np.exp(-t / 0.012))) * np.exp(-t / (0.05 if heavy else 0.03))
    puff = bp(pink(n, seed + 1), r.uniform(600, 1100), q=0.7) * env_exp(n, 0.06 if run else 0.08, att=0.006)
    crunch = impacts(n, r.uniform(0.0, 0.07, int(r.integers(2, 6))), kernel_bank("twig", 3, seed + 2), seed + 3) * 0.25
    y = (0.9 if heavy else 0.6) * thump + 0.9 * puff + crunch
    if dist > 1.0:
        y = lp(y, 2500 / dist)
    return norm(y) * (0.65 if soft else 1.0)


def fx_ash_kick(seed=0, **_):
    """Ash kicked up by a running foot: a short spray and grains pattering back down."""
    n = int(0.45 * SR)
    spray = bp(pink(n, seed), 1800, q=0.5) * env_exp(n, 0.07, att=0.01)
    patter = impacts(n, poisson_times(0.45, lambda x: 60 * math.exp(-x / 0.2), seed + 1, tmin=0.05),
                     kernel_bank("drop", 4, seed + 2), seed + 3) * 0.35
    return norm(spray + patter)


def fx_ash_sift(dur=2.0, seed=0, **_):
    """Hands sifting ash: a soft powdery hiss with fine charcoal grit, swelling with each stroke of the hands."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    strokes = np.clip(0.55 + 0.45 * np.sin(TWO_PI * 0.9 * t + seed) + 0.25 * smooth_noise(n, 2.5, seed), 0, None)
    hiss = bp(pink(n, seed + 1), 1400, q=0.6) * strokes ** 1.5
    grit = hp(impacts(n, poisson_times(dur, lambda x: 90.0, seed + 2), kernel_bank("twig", 5, seed + 3), seed + 4),
              2500) * 0.18
    return norm(dsp.fade(hiss + grit * strokes, 0.25, 0.4))


def fx_ash_puff(seed=0, **_):
    """A puff of ash (the sigh blowing it, a body landing): a soft 'poof' with a fine settling hiss."""
    n = int(0.7 * SR)
    poof = bp(pink(n, seed), 750, q=0.6) * env_exp(n, 0.1, att=0.015)
    settle = hp(white(n, seed + 1), 4000) * env_exp(n, 0.25, att=0.05) * 0.12
    return norm(poof + settle)


def fx_breath(mood="sigh", seed=0, **_):
    """Breath shaped by vocal-tract formants (no voice). sigh: a short catch then a long falling exhale;
    determined: a hard exhale through gritted teeth; inhale: a soft, hushed in-breath."""
    if mood == "sigh":
        dur, shape = 1.5, [(0.0, 0.0), (0.15, 0.25), (0.35, 0.1), (0.45, 1.0), (1.5, 0.0)]
        forms, teeth = (550, 1100, 2500), 0.15
    elif mood == "determined":
        dur, shape = 0.6, [(0.0, 0.0), (0.04, 1.0), (0.25, 0.6), (0.6, 0.0)]
        forms, teeth = (700, 1300, 2800), 0.9
    else:   # inhale
        dur, shape = 0.55, [(0.0, 0.0), (0.4, 1.0), (0.55, 0.0)]
        forms, teeth = (400, 1000, 2400), 0.1
    n = int(dur * SR)
    t = np.arange(n) / SR
    src = pink(n, seed)
    y = resonators(src, forms, [3.0, 4.0, 5.0], [1.0, 0.6, 0.35]) + teeth * hp(white(n, seed + 1), 4500) * 0.5
    e = np.interp(t, [p[0] for p in shape], [p[1] for p in shape]) ** 1.3
    return norm(y * e)


def fx_swing_creak(seed=0, mood="sad", **_):
    """The rope swing on its branch: rope fibres creaking against wood. sad: slow, low, dry and charred; happy:
    light, quick and gentle."""
    sad = mood == "sad"
    dur = 0.95 if sad else 0.55
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    base = r.uniform(38, 55) if sad else r.uniform(70, 100)
    ex = stick_slip(n, lambda t: base * (1 + 0.8 * math.sin(math.pi * t / dur) ** 2) + 12 * math.sin(t * 13), seed,
                    jitter=0.3, amp_fn=lambda t: math.sin(math.pi * min(1, t / dur)) ** 0.8)
    fr = [r.uniform(320, 420), r.uniform(700, 900), r.uniform(1300, 1700)] if sad else \
        [r.uniform(500, 650), r.uniform(1100, 1400), r.uniform(2100, 2500)]
    y = resonators(ex, fr, [14, 12, 10], [1, .6, .3])
    if sad:
        y += 0.2 * bp(white(n, seed + 1), 2500, q=1) * env_bell(n, 0.5, 2) * (np.abs(ex) > 0).astype(np.float32)
    return norm(lp(y, 3500 if sad else 5000))


def fx_ember_pop(seed=0, **_):
    n = int(0.25 * SR)
    pop = bp(white(n, seed), 2500, q=0.8) * env_exp(n, 0.0015)
    sizzle = grains(n, 140, seed + 1, dur_ms=(0.3, 1.0), band=(3000, 9000), decay=0.06) * 0.3
    return norm(pop + sizzle)


# ============================================================================================= effects: the seed
def fx_seed_pulse(seed=0, **_):
    """A soft magical pulse of green light under the ash: a warm low 'whum' and an airy shimmer swelling and
    fading."""
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    e = np.clip(t / 0.25, 0, 1) ** 2 * np.exp(-np.clip(t - 0.25, 0, None) / 0.22)
    whum = (np.sin(TWO_PI * 147 * t) + 0.5 * np.sin(TWO_PI * 220.5 * t + 1) + 0.3 * np.sin(TWO_PI * 294 * t + 2))
    whum *= 1 + 0.2 * np.sin(TWO_PI * 5.5 * t)
    air = bp(white(n, seed), 5200, q=2.5) * 0.6 + bp(white(n, seed + 1), 2900, q=4) * 0.3
    return norm((0.6 * whum + air) * e)


def fx_seed_hum(dur=4.0, weak=False, seed=0, **_):
    """The seed glowing: a quiet, slowly beating harmonic hum with a sparkling air on top. weak: flickering and
    dimming (the dying sprout)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, (f, a) in enumerate(((293.7, 1.0), (440.0, 0.55), (587.3, 0.4), (880.0, 0.2))):
        y += a * np.sin(TWO_PI * (f + 0.4 * k) * t + k) * (1 + 0.25 * np.sin(TWO_PI * (0.6 + 0.37 * k) * t))
    air = bp(white(n, seed), 6000, q=2.0) * (0.5 + 0.5 * smooth_noise(n, 3, seed)) * 0.5
    y = y + air
    if weak:
        flick = np.clip(0.5 + 0.6 * smooth_noise(n, 9, seed + 2), 0.05, 1) ** 2
        y = y * flick * np.linspace(1.0, 0.3, n)
    return norm(dsp.fade(y, 0.4, 0.6))


def fx_glint(seed=0, **_):
    n = int(0.8 * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    for k in range(5):
        i = int(k * 0.035 * SR)
        y[i:] += modal(n - i, [r.uniform(5500, 9500)], [1.0 - 0.12 * k], [0.12], seed + k)
    y += 0.05 * hp(white(n, seed), 7000) * env_exp(n, 0.1, att=0.02)
    return norm(y)


def fx_brush(seed=0, **_):
    """A hand brushing ash aside."""
    n = int(0.32 * SR)
    sw = dsp.sweep_filter(pink(n, seed), "bp", 900, 2600, q=0.8) * env_bell(n, 0.35, 1.2)
    grit = impacts(n, poisson_times(0.32, lambda x: 80.0, seed + 1), kernel_bank("twig", 3, seed + 2), seed + 3)
    return norm(sw + 0.15 * hp(grit, 3000))


def fx_shell_crack(seed=0, **_):
    """The seed's shell cracking: two crisp clicks, a woody ping, a crumble of shell, then a breath of sparkle."""
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    y = np.zeros(n, np.float32)
    for k, (dt, a) in enumerate(((0.0, 1.0), (0.045, 0.7), (0.08, 0.4))):
        i = int(dt * SR)
        m_ = int(0.05 * SR)
        y[i:i + m_] += a * (hp(white(m_, seed + k), 1800) * env_exp(m_, 0.0012) +
                            modal(m_, [2300 + 400 * k, 3900, 5600], [0.8, 0.5, 0.3], [0.01, 0.007, 0.004], seed + k))
    crumble = impacts(n, poisson_times(0.25, lambda x: 70 * math.exp(-x / 0.08), seed + 5, tmin=0.06),
                      kernel_bank("twig", 4, seed + 6), seed + 7) * 0.3
    sparkle = np.zeros(n)
    r = np.random.default_rng(seed)
    for k in range(6):
        i = int((0.08 + 0.05 * k) * SR)
        sparkle[i:] += modal(n - i, [r.uniform(4500, 9000)], [0.25], [0.15], seed + 20 + k)
    return norm(y + crumble + sparkle * np.clip(t / 0.1, 0, 1))


def fx_unfurl(dur=1.0, seed=0, **_):
    """The sprout unfurling: a tiny green creak of growth, leaves whispering open, a rising shimmer."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    creak = resonators(stick_slip(n, lambda tt: 160 + 220 * tt / dur, seed, jitter=0.2,
                                  amp_fn=lambda tt: math.sin(math.pi * min(1.0, tt / dur)) ** 0.6),
                       [1800, 3100], [12, 14], [1, .5]) * 0.5
    leaf = hp(white(n, seed + 1), 3500) * (np.clip(smooth_noise(n, 25, seed + 2), 0, None) ** 2) * 0.6
    gl = np.zeros(n)
    for k, f in enumerate((1175, 1760, 2349)):
        gl += np.sin(TWO_PI * np.cumsum(f * 2 ** (0.6 * t / dur)) / SR + k) / (k + 1)
    gl *= np.clip(t / (0.6 * dur), 0, 1) * 0.25
    return norm((creak + leaf + gl) * env_bell(n, 0.6, 0.8))


# the sprout's tiny voice: bell-like, wordless. (notes as (Hz, start s, length s), vibrato Hz, depth cents, slide)
_VOICE = {
    "curious": ([(1568, 0.0, 0.09), (1976, 0.1, 0.22)], 6.0, 18, 0.06),             # "mm?" (rising)
    "happy": ([(1760, 0.0, 0.07), (2217, 0.07, 0.07), (2637, 0.14, 0.3)], 7.5, 22, 0.0),
    "shiver": ([(1976, 0.0, 0.5), (1760, 0.42, 0.45)], 13.0, 70, 0.0),               # a trembling whimper
    "weak": ([(1319, 0.0, 0.35), (1175, 0.3, 0.55)], 4.0, 20, -0.04),                # faint, falling
    "happy_again": ([(1568, 0.0, 0.07), (1976, 0.07, 0.07), (2349, 0.14, 0.07), (3136, 0.21, 0.35)], 7.0, 20, 0.0),
}


def fx_sprout_voice(mood="happy", seed=0, **_):
    notes, vib, depth, slide = _VOICE[mood]
    total = max(s + d for _, s, d in notes) + 0.5
    n = int(total * SR)
    y = np.zeros(n)
    for k, (f, s, d) in enumerate(notes):
        i = int(s * SR)
        m_ = min(int((d + 0.4) * SR), n - i)
        tt = np.arange(m_) / SR
        sl = 1.0 + slide * np.clip(tt / max(d, 0.05), 0, 1)
        fv = f * sl * (2 ** (depth * np.sin(TWO_PI * vib * tt) * np.clip(tt / 0.06, 0, 1) / 1200) if vib else 1.0)
        ph = TWO_PI * np.cumsum(fv) / SR
        tone = np.sin(ph) + 0.22 * np.sin(2 * ph + 0.4) + 0.06 * np.sin(3 * ph) + 0.04 * np.sin(5.2 * ph)
        e = np.clip(tt / 0.008, 0, 1) * np.where(tt < d, 1.0, np.exp(-(tt - d) / 0.07)) * np.exp(-tt / (d + 0.35))
        breath = bp(white(m_, seed + k), f, q=5) * 0.3
        y[i:i + m_] += (tone + breath) * e * (0.6 if mood == "weak" else 1.0)
    if mood == "weak":
        y = lp(y, 3000) + 0.15 * bp(white(n, seed + 9), 1300, q=2) * env_bell(n, 0.3, 1.5)
    return norm(y)


def fx_leaf_rustle(dur=0.5, tremble=False, wide=False, seed=0, **_):
    n = int(dur * SR)
    rate = 40 if tremble else 18
    am = np.clip(smooth_noise(n, rate, seed) * 0.9 + 0.3, 0, None) ** 2
    src = bp(white(n, seed + 1), 4200, q=0.7) * am + 0.25 * bp(pink(n, seed + 2), 1500, q=0.8) * am
    y = src * env_bell(n, 0.3, 0.7)
    if wide:
        am2 = np.clip(smooth_noise(n, rate, seed + 7) * 0.9 + 0.3, 0, None) ** 2
        y2 = (bp(white(n, seed + 8), 4200, q=0.7) * am2 + 0.25 * bp(pink(n, seed + 9), 1500, q=0.8) * am2) * \
            env_bell(n, 0.3, 0.7)
        return np.stack([y, y2], axis=1) / (max(np.abs(y).max(), np.abs(y2).max()) + 1e-9)
    return norm(y)


# ============================================================================================= effects: the storm
def fx_thunder(dur=4.0, dist=1.0, seed=0, **_):
    """Thunder: (close) a cracking onset, then a long rolling rumble of random bursts. dist ~0.3 close .. 3 far."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    base = stereo_noise(brown, n, seed)
    cut = 900 / (0.6 + dist)
    rum = lp(base, cut, order=2)
    roll = np.zeros(n)
    tt = 0.0
    while tt < dur * 0.85:
        a = r.uniform(0.4, 1.0) * math.exp(-tt / (dur * 0.45))
        w = r.uniform(0.08, 0.4)
        roll += a * np.exp(-0.5 * ((t - tt) / w) ** 2)
        tt += r.exponential(0.25)
    env = (0.25 + roll) * np.clip(t / (0.03 + 0.15 * dist), 0, 1) * np.exp(-t / (dur * 0.5))
    y = rum * env[:, None]
    body = lp(stereo_noise(pink, n, seed + 2), 1800 / (0.5 + dist), order=2) * \
        (roll * np.exp(-t / (dur * 0.3)))[:, None]
    y = y + 0.25 * body
    if dist < 0.9:      # the crack of a close strike
        k = int(0.35 * SR)
        crack = hp(stereo_noise(white, k, seed + 4), 600) * env_exp(k, 0.06 * (1 + dist), att=0.002)[:, None]
        crack += lp(stereo_noise(white, k, seed + 6), 3000) * env_exp(k, 0.012)[:, None]
        y[:k] += crack * (1.2 - dist)
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_lightning_crack(far=False, seed=0, **_):
    """A lightning strike: a white-hot crack, a sizzling tear, a deep air-punch."""
    n = int(1.6 * SR)
    t = np.arange(n) / SR
    snap = white(n, seed) * env_exp(n, 0.004 if not far else 0.012, att=0.0005)
    tear = hp(white(n, seed + 1), 1500 if not far else 800) * \
        (np.clip(smooth_noise(n, 140, seed + 2), 0, None) ** 2) * env_exp(n, 0.12, att=0.005) * 1.6
    sizzle = grains(n, 900, seed + 3, dur_ms=(0.2, 1.0), band=(2500, 12000), decay=0.25) * 0.5
    punch = np.sin(TWO_PI * np.cumsum(30 + 70 * np.exp(-t / 0.05)) / SR) * env_exp(n, 0.35, att=0.003)
    y = snap + tear + sizzle + 1.2 * punch
    if far:
        y = lp(y, 4000)
    y = np.stack([y, np.roll(y, 23)], axis=1)
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_lightning_far(seed=0, **_):
    """Lightning flickering inside the storm wall far off: a dry crackle, then the low rumble arriving."""
    n = int(3.0 * SR)
    crackle = grains(n, 200, seed, dur_ms=(0.5, 3), band=(800, 4000), decay=0.3) * 0.5
    th = fx_thunder(dur=2.6, dist=2.0, seed=seed + 1)
    y = np.zeros((n, 2), np.float32)
    y[:, 0] += crackle
    y[:, 1] += np.roll(crackle, 41)
    i = int(0.45 * SR)
    y[i:i + len(th)] += th[:n - i] * 1.4
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_gust(dur=2.5, seed=0, **_):
    """A cold gust: a swelling wind surge sweeping across, with ash hissing sideways under it."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    a, b = pink(n, seed), pink(n, seed + 1)
    fc = lambda tt: 300 + 900 * math.sin(math.pi * min(1.0, tt / dur)) ** 1.5
    y = np.stack([dsp.sweep_filter_fn(a, "bp", fc, q=0.6), dsp.sweep_filter_fn(b, "bp", fc, q=0.6)], axis=1)
    swell = np.clip(u / 0.2, 0, 1) ** 2 * np.clip((1 - u) / 0.6, 0, 1) ** 1.3
    hiss = hp(stereo_noise(white, n, seed + 2), 3000) * 0.4
    hiss *= (0.5 + 0.5 * np.clip(smooth_noise(n, 12, seed + 3), 0, None))[:, None]
    howl = dsp.sweep_filter_fn(white(n, seed + 4), "bp", lambda tt: 500 + 300 * tt / dur, q=12)[:, None] * 1.2
    y = (y + hiss + howl) * swell[:, None]
    p = -0.7 + 1.4 * u
    y[:, 0] *= np.sqrt(0.5 * (1 - p))
    y[:, 1] *= np.sqrt(0.5 * (1 + p))
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_body_whoosh(dur=0.3, seed=0, **_):
    return norm(whoosh(dur, 350, 1500, q=0.9, seed=seed, peak_at=0.45))


def fx_body_rustle(dur=0.5, seed=0, **_):
    """Claude moving (a painted clay/wood body): a soft dry rub with a little ash grit."""
    n = int(dur * SR)
    src = bp(pink(n, seed), 1200, q=0.7)
    am = np.clip(smooth_noise(n, 14, seed + 1) * 0.8 + 0.4, 0, None) ** 2
    grit = hp(grains(n, 120, seed + 2, dur_ms=(0.5, 2), band=(2500, 7000)), 2000) * 0.3
    return norm((src * am + grit) * env_bell(n, 0.35, 1.0))


def fx_ash_burst(seed=0, **_):
    """The launch: a heavy push-off and an explosion of ash at the feet."""
    n = int(1.0 * SR)
    t = np.arange(n) / SR
    thump = np.sin(TWO_PI * 70 * t * (1 + 0.8 * np.exp(-t / 0.01))) * np.exp(-t / 0.06)
    burst = dsp.sweep_filter(pink(n, seed), "bp", 500, 2400, q=0.6) * env_exp(n, 0.16, att=0.008)
    patter = impacts(n, poisson_times(0.9, lambda x: 120 * math.exp(-x / 0.3), seed + 1, tmin=0.08),
                     kernel_bank("drop", 5, seed + 2), seed + 3) * 0.3
    return norm(1.1 * thump + burst + patter)


def fx_wind_streak(dur=0.9, direction=1, seed=0, **_):
    y = whoosh(dur, 500, 2200, q=0.8, seed=seed, peak_at=0.55) + \
        0.3 * whoosh(dur, 2500, 6000, q=1.2, seed=seed + 1, peak_at=0.5, color="white")
    return pan_sweep(norm(y), -0.8 * direction, 0.8 * direction)


def fx_ground_crack(seed=0, **_):
    """The slope gives way: a deep crunch, rock splitting, a lurch of earth."""
    n = int(1.2 * SR)
    t = np.arange(n) / SR
    low = np.sin(TWO_PI * np.cumsum(55 + 40 * np.exp(-t / 0.05)) / SR) * env_exp(n, 0.25, att=0.004)
    split = impacts(n, poisson_times(0.25, lambda x: 120.0, seed), kernel_bank("stone", 6, seed + 1), seed + 2)
    crunch = bp(white(n, seed + 3), 1200, q=0.5) * env_exp(n, 0.08, att=0.002)
    rumble = lp(brown(n, seed + 4), 200) * env_exp(n, 0.5, att=0.05) * 0.6
    return norm(1.0 * low + 0.8 * split + 0.6 * crunch + rumble)


def fx_rockfall(dur=2.0, seed=0, **_):
    """The scree slide: a torrent of gravel and stones tumbling over each other, with a ground rumble; it builds,
    pours, and trickles out."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    dens = lambda x: 40 + 900 * math.sin(math.pi * min(1.0, x / (dur * 0.85))) ** 0.7
    ch = []
    for c in range(2):
        g = impacts(n, poisson_times(dur, dens, seed + c), kernel_bank("stone", 10, seed + 10 + c), seed + 20 + c)
        big = impacts(n, poisson_times(dur, lambda x: 0.5 * dens(x) / 40, seed + 30 + c),
                      kernel_bank("clay", 4, seed + 40 + c), seed + 50 + c)
        ch.append(g + 0.8 * lp(big, 900))
    y = np.stack(ch, axis=1)
    rumble = lp(stereo_noise(brown, n, seed + 60), 160, order=2) * np.interp(t, [0, 0.15, dur * 0.7, dur],
                                                                             [0, 1, 0.7, 0])[:, None]
    hiss = bp(stereo_noise(pink, n, seed + 70), 2500, q=0.5) * 0.3 * env_bell(n, 0.35, 1.0)[:, None]
    y = y * np.interp(t, [0, 0.1, dur * 0.75, dur], [0.2, 1, 0.7, 0])[:, None] + 1.4 * rumble + hiss
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_body_thud(heavy=False, seed=0, **_):
    """Claude's body hitting the slope: a low thump with gravel and ash."""
    n = int(0.6 * SR)
    t = np.arange(n) / SR
    f = 60 if heavy else 85
    thud = np.sin(TWO_PI * f * t * (1 + 0.7 * np.exp(-t / 0.012))) * np.exp(-t / (0.09 if heavy else 0.05))
    grav = impacts(n, poisson_times(0.2, lambda x: 160.0, seed), kernel_bank("stone", 5, seed + 1), seed + 2) * 0.4
    puff = bp(pink(n, seed + 3), 700, q=0.6) * env_exp(n, 0.12, att=0.01) * 0.6
    return norm(thud + grav + puff)


def fx_hand_slap(seed=0, **_):
    """A hand slapping down on wet rock."""
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    slap = bp(white(n, seed), 1800, q=0.9) * env_exp(n, 0.006, att=0.0005)
    body = np.sin(TWO_PI * 160 * t) * np.exp(-t / 0.02) * 0.6
    wet = hp(white(n, seed + 1), 3500) * env_exp(n, 0.03) * 0.3
    return norm(slap + body + wet)


def fx_rock_scrape(dur=0.5, seed=0, **_):
    n = int(dur * SR)
    ex = stick_slip(n, lambda tt: 300 + 200 * math.sin(math.pi * tt / dur), seed, jitter=0.5,
                    amp_fn=lambda tt: math.sin(math.pi * min(1.0, tt / dur)) ** 0.5)
    y = resonators(ex, [700, 1400, 2600], [4, 5, 6], [1, .6, .3]) + 0.4 * bp(white(n, seed + 1), 2000, q=0.6) * \
        env_bell(n, 0.4, 1.0)
    return norm(y)


def fx_hail_burst(seed=0, **_):
    """The hail arriving: a sudden smash of ice stones on rock, bouncing."""
    n = int(1.4 * SR)
    t = np.arange(n) / SR
    ch = []
    for c in range(2):
        g = impacts(n, poisson_times(1.4, lambda x: 900 * math.exp(-x / 0.5) + 200, seed + c),
                    kernel_bank("ice", 32, seed + 5 + c), seed + 9 + c)
        ch.append(g)
    y = np.stack(ch, axis=1)
    smash = hp(stereo_noise(white, n, seed + 20), 1200) * env_exp(n, 0.05, att=0.002)[:, None] * 0.8
    return (y + smash) / (np.max(np.abs(y + smash)) + 1e-9)


def fx_hail_body(dur=4.0, seed=0, **_):
    """Hail drumming on Claude's curled body (dull clay 'toks'), the occasional big stone."""
    n = int(dur * SR)
    small = impacts(n, poisson_times(dur, lambda x: 11.0, seed), kernel_bank("clay", 6, seed + 1), seed + 2)
    big = impacts(n, poisson_times(dur, lambda x: 1.6, seed + 3), kernel_bank("clay", 3, seed + 4), seed + 5,
                  amp=None) * 1.8
    ice = impacts(n, poisson_times(dur, lambda x: 25.0, seed + 6), kernel_bank("ice", 24, seed + 7), seed + 8) * 0.4
    return norm(small + lp(big, 1200) + ice)


def fx_chip(seed=0, **_):
    """A chip of Claude's painted clay cracking off: a sharp ceramic crack, the fragment skittering away."""
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    crack = hp(white(n, seed), 1500) * env_exp(n, 0.0025, att=0.0003) * 1.5
    ping = modal(n, r.uniform(2500, 6000, 4), [1, .7, .5, .3], [0.03, 0.02, 0.015, 0.01], seed + 1)
    thunk = np.sin(TWO_PI * 210 * t) * np.exp(-t / 0.015) * 0.7
    bounces = np.zeros(n, np.float32)
    tt, a = 0.12, 0.5
    for k in range(5):
        i = int(tt * SR)
        m_ = int(0.04 * SR)
        if i + m_ < n:
            bounces[i:i + m_] += a * modal(m_, r.uniform(3000, 7000, 2), [1, .5], [0.006, 0.004], seed + 10 + k)
        tt += 0.12 * (0.7 ** k)
        a *= 0.6
    return norm(crack + 0.8 * ping + thunk + bounces)


def fx_hail_stone(seed=0, **_):
    """One last hailstone bouncing on rock (three ticks, closer and quieter)."""
    n = int(0.6 * SR)
    r = np.random.default_rng(seed)
    y = np.zeros(n, np.float32)
    tt, a = 0.0, 1.0
    for k in range(4):
        i = int(tt * SR)
        m_ = int(0.03 * SR)
        if i + m_ < n:
            y[i:i + m_] += a * modal(m_, r.uniform(3500, 7000, 2), [1, .5], [0.004, 0.003], seed + k)
        tt += 0.16 * (0.62 ** k)
        a *= 0.55
    return norm(y)


# ============================================================================================= effects: low point
def fx_uncurl(dur=0.8, seed=0, **_):
    """Claude slowly uncurling, battered: low clay creaks, grit and ash sliding off."""
    n = int(dur * SR)
    creak = resonators(stick_slip(n, lambda tt: 45 + 30 * math.sin(tt * 4), seed, jitter=0.4,
                                  amp_fn=lambda tt: 0.4 + 0.6 * math.sin(math.pi * min(1.0, tt / dur))),
                       [260, 610, 1150], [9, 10, 8], [1, .6, .3])
    trickle = impacts(n, poisson_times(dur, lambda x: 25.0, seed + 1), kernel_bank("stone", 4, seed + 2), seed + 3)
    rub = bp(pink(n, seed + 4), 900, q=0.7) * env_bell(n, 0.4, 1.0) * 0.4
    return norm(0.8 * creak + 0.25 * trickle + rub)


def fx_tear(seed=0, **_):
    """A tear falling onto the sprout's leaf: a tiny bright 'plip'."""
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 1400 + 1500 * (1 - np.exp(-t / 0.01))
    plip = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / 0.03)
    tick = hp(white(n, seed), 4000) * env_exp(n, 0.002) * 0.4
    return norm(plip + tick)


def drip(seed=0, size=1.0):
    """A water drop into a small rock pool (the classic rising 'bloop')."""
    n = int(0.25 * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    f0 = r.uniform(700, 1300) / size
    f = f0 * (1 + 0.9 * (1 - np.exp(-t / 0.012)))
    y = np.sin(TWO_PI * np.cumsum(f) / SR) * np.exp(-t / r.uniform(0.02, 0.05))
    y += 0.25 * hp(white(n, seed), 3000) * env_exp(n, 0.002)
    return y.astype(np.float32)


def fx_gravel_step(heavy=False, seed=0, **_):
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    thump = np.sin(TWO_PI * (75 if heavy else 105) * t * (1 + 0.5 * np.exp(-t / 0.01))) * np.exp(-t / 0.04)
    crunch = impacts(n, poisson_times(0.12, lambda x: 260.0, seed), kernel_bank("stone", 6, seed + 1), seed + 2)
    return norm(0.8 * thump + 0.7 * crunch)


# ============================================================================================= effects: summit
def fx_cloud_tear(dur=1.3, seed=0, **_):
    """The clouds tearing open: a vast airy rip that rises and bursts open into light."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    a, b = pink(n, seed), pink(n, seed + 1)
    fc = lambda tt: 250 * (14.0 ** min(1.0, tt / (dur * 0.62)))
    y = np.stack([dsp.sweep_filter_fn(a, "bp", fc, q=0.7), dsp.sweep_filter_fn(b, "bp", fc, q=0.7)], axis=1)
    rip = (np.clip(smooth_noise(n, 90, seed + 2), 0, None) ** 2)[:, None] * \
        hp(stereo_noise(white, n, seed + 3), 1500) * 0.8
    swell = np.interp(u, [0, 0.62, 0.7, 1.0], [0.0, 1.0, 0.75, 0.0]) ** 1.3
    low = lp(stereo_noise(brown, n, seed + 4), 140) * np.interp(u, [0, 0.6, 1], [0, 1, 0])[:, None] * 1.2
    y = (y + rip * np.clip((u - 0.3) / 0.3, 0, 1)[:, None]) * swell[:, None] + low
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_beam_shimmer(dur=2.5, seed=0, **_):
    """The sunbeam: a high glassy shimmer swelling in, motes glinting."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ch = []
    for c in range(2):
        y = np.zeros(n)
        for k in range(14):
            f = r.uniform(2400, 8500)
            am = 0.5 + 0.5 * smooth_noise(n, r.uniform(0.8, 3), seed + k + c * 50)
            y += np.sin(TWO_PI * f * t + r.uniform(0, 6)) * am
        ch.append(y / 14)
    y = np.stack(ch, axis=1)
    glints = impacts(n, poisson_times(dur, lambda x: 7.0, seed + 99), kernel_bank("ice", 4, seed + 98), seed + 97)
    y += 0.25 * np.stack([glints, np.roll(glints, 300)], axis=1)
    e = np.clip(t / 0.35, 0, 1) ** 1.5 * np.clip((dur - t) / 0.5, 0, 1)
    return y * e[:, None] / (np.max(np.abs(y * e[:, None])) + 1e-9)


def fx_soil_plant(seed=0, **_):
    """Pressing the sprout into soil: a soft crumbly squeeze and two gentle pats."""
    n = int(0.8 * SR)
    t = np.arange(n) / SR
    squeeze = bp(pink(n, seed), 600, q=0.6) * env_bell(n, 0.25, 1.2) * 0.6
    crumble = lp(impacts(n, poisson_times(0.35, lambda x: 120.0, seed + 1), kernel_bank("stone", 5, seed + 2),
                         seed + 3), 2500) * 0.4
    pats = np.zeros(n)
    for dt in (0.32, 0.52):
        i = int(dt * SR)
        tt = t[:n - i]
        pats[i:] += np.sin(TWO_PI * 120 * tt) * np.exp(-tt / 0.03) + 0.3 * lp(white(n - i, seed + 5), 900) * \
            np.exp(-tt / 0.01)
    return norm(squeeze + crumble + 0.7 * pats)


def fx_glow_surge(dur=1.6, seed=0, **_):
    """The sprout drinking the light: a rising magical surge (sweeping air, gliding harmonics, sparks)."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    air = dsp.sweep_filter(pink(n, seed), "bp", 400, 6000, q=1.0)
    gl = np.zeros(n)
    for k, f in enumerate((330, 495, 660, 990)):
        gl += np.sin(TWO_PI * np.cumsum(f * 2 ** (1.0 * u ** 1.3)) / SR + k) / (k + 1)
    sparks = impacts(n, poisson_times(dur, lambda x: 10 + 120 * (x / dur) ** 2, seed + 1),
                     kernel_bank("ice", 5, seed + 2), seed + 3)
    y = (air + 0.6 * gl + 0.4 * sparks) * (np.clip(u, 0, 1) ** 1.8) * np.clip((1 - u) / 0.05, 0, 1)
    return norm(y)


# ============================================================================================= effects: bloom + coda
def fx_bloom_wave(dur=5.0, seed=0, **_):
    """THE BLOOM: a huge rushing wave of growth racing out from the summit across the valley: a breaking 'fwoosh'
    that widens across the stereo field, grass and leaves hissing under it, then rolling away into the distance."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    u = t / dur
    a, b = pink(n, seed), pink(n, seed + 1)
    fc = lambda tt: 2200 * math.exp(-1.6 * tt / dur) + 350
    rush = np.stack([dsp.sweep_filter_fn(a, "bp", fc, q=0.5), dsp.sweep_filter_fn(b, "bp", fc, q=0.5)], axis=1)
    leaves = hp(stereo_noise(white, n, seed + 2), 2800) * \
        (np.clip(np.stack([smooth_noise(n, 22, seed + 3), smooth_noise(n, 22, seed + 4)], axis=1) * 0.8 + 0.35, 0,
                 None) ** 2) * 0.5
    low = lp(stereo_noise(brown, n, seed + 5), 120, order=2) * 0.8
    e = np.interp(u, [0, 0.04, 0.15, 0.6, 1.0], [0.0, 1.0, 0.85, 0.4, 0.0])
    y = (rush + leaves * np.interp(u, [0, 0.1, 0.8, 1], [0.3, 1, 0.6, 0])[:, None] +
         low * np.interp(u, [0, 0.05, 0.4, 1], [0, 1, 0.3, 0])[:, None]) * e[:, None]
    # the wave travels away: the highs roll off as it recedes
    y = dsp.sweep_filter_fn(y, "lp", lambda tt: 14000 * math.exp(-1.5 * tt / dur) + 1500, q=0.6)
    # widen: start narrow (mid), end wide (side)
    mid, side = (y[:, 0] + y[:, 1]) / 2, (y[:, 0] - y[:, 1]) / 2
    w = np.interp(u, [0, 0.4, 1], [0.3, 1.2, 1.4])
    y = np.stack([mid + side * w, mid - side * w], axis=1)
    return y / (np.max(np.abs(y)) + 1e-9)


def fx_blossom_pops(dur=4.0, seed=0, **_):
    """Blossoms and buds popping open everywhere: soft 'puk's racing outward, thinning into the distance."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    r = np.random.default_rng(seed)
    ch = []
    for c in range(2):
        times = poisson_times(dur, lambda x: 70 * math.exp(-1.2 * x / dur) + 6, seed + c)
        kers = []
        for k in range(8):
            m_ = int(0.05 * SR)
            tt = np.arange(m_) / SR
            f0 = r.uniform(380, 1300)
            kk = np.sin(TWO_PI * np.cumsum(f0 * (1 + 0.6 * np.exp(-tt / 0.006))) / SR) * np.exp(-tt / 0.012)
            kk += 0.2 * hp(white(m_, seed + 10 * c + k), 2500) * np.exp(-tt / 0.002)
            kers.append(kk.astype(np.float32))
        y = impacts(n, times, kers, seed + 20 + c)
        ch.append(y)
    y = np.stack(ch, axis=1)
    y = dsp.sweep_filter_fn(y, "lp", lambda tt: 9000 * math.exp(-1.4 * tt / dur) + 1200, q=0.6)
    return y / (np.max(np.abs(y)) + 1e-9)


def _bird_call(kind, r, seed):
    """One phrase of a procedural songbird (FM-swept sines with a little harmonic)."""
    if kind == "warble":                       # robin-like: a run of short swept notes
        notes = []
        tt = 0.0
        for k in range(int(r.integers(3, 7))):
            d = r.uniform(0.05, 0.13)
            f0, f1 = r.uniform(2200, 3600), r.uniform(2200, 4200)
            notes.append((tt, d, f0, f1, r.uniform(25, 60), r.uniform(80, 250)))
            tt += d + r.uniform(0.02, 0.07)
    elif kind == "whistle":                    # two clear falling whistles ("fee-bee")
        f = r.uniform(3400, 4100)
        notes = [(0.0, 0.28, f, f * 0.98, 0, 0), (0.36, 0.3, f * 0.86, f * 0.84, 0, 0)]
    elif kind == "trill":                      # a rapid trill of tiny down-chirps
        rate = r.uniform(14, 22)
        f = r.uniform(4500, 6500)
        notes = [(k / rate, 0.6 / rate, f * 1.12, f * 0.9, 0, 0) for k in range(int(r.uniform(8, 18)))]
    else:                                      # chip
        f = r.uniform(3500, 5500)
        notes = [(0.0, 0.035, f * 1.2, f * 0.85, 0, 0)]
    total = max(a + d for a, d, *_ in notes) + 0.05
    n = int(total * SR)
    y = np.zeros(n)
    for (a, d, f0, f1, vr, vd) in notes:
        i = int(a * SR)
        m_ = min(int(d * SR), n - i)
        tt = np.arange(m_) / SR
        f = f0 + (f1 - f0) * (tt / max(d, 1e-3))
        if vr:
            f = f + vd * np.sin(TWO_PI * vr * tt)
        ph = TWO_PI * np.cumsum(f) / SR
        e = np.sin(np.pi * np.clip(tt / d, 0, 1)) ** 0.7
        y[i:i + m_] += (np.sin(ph) + 0.12 * np.sin(2 * ph)) * e
    return y.astype(np.float32)


def fx_birds(dur=4.0, density=1.0, seed=0, **_):
    """Birdsong: a few songbirds at different places and distances, arriving one by one."""
    n = int(dur * SR)
    r = np.random.default_rng(seed)
    out = np.zeros((n, 2), np.float32)
    kinds = ["warble", "whistle", "trill", "chip", "warble"]
    for b in range(5):
        kind = kinds[b]
        p = r.uniform(-0.85, 0.85)
        dist = r.uniform(1.0, 3.0)
        t = r.uniform(0.0, 0.8) + b * 0.35 / max(density, 0.2)
        while t < dur - 0.3:
            call = _bird_call(kind, r, seed + b)
            call = lp(call, 9000 / dist ** 0.5) * (1.0 / dist)
            dsp.place(out, pan(call, p), t)
            t += r.uniform(0.9, 2.6) / max(density, 0.2) + len(call) / SR
    return dsp.fade(out, 0.3, 0.5) / (np.max(np.abs(out)) + 1e-9)


def fx_petal_swirl(dur=2.0, seed=0, **_):
    """Petals swirling up around Claude: a soft airy eddy circling the stereo field."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = dsp.sweep_filter_fn(pink(n, seed), "bp", lambda tt: 1200 + 900 * math.sin(TWO_PI * tt / 1.3), q=1.0)
    flutter = bp(white(n, seed + 1), 4500, q=0.8) * (np.clip(smooth_noise(n, 30, seed + 2), 0, None) ** 2) * 0.4
    y = (y + flutter) * env_bell(n, 0.4, 0.8)
    p = 0.7 * np.sin(TWO_PI * t / 1.3)
    return np.stack([y * np.sqrt(0.5 * (1 - p)), y * np.sqrt(0.5 * (1 + p))], axis=1) / (np.max(np.abs(y)) + 1e-9)


def fx_leaf_land(seed=0, **_):
    """A leaf landing on Claude's head: a whisper of air, a tiny papery tap."""
    n = int(0.5 * SR)
    t = np.arange(n) / SR
    air = bp(pink(n, seed), 1800, q=0.8) * np.clip(1 - np.abs(t - 0.12) / 0.12, 0, 1) * 0.3
    i = int(0.2 * SR)
    tap = np.zeros(n)
    tap[i:] = (np.sin(TWO_PI * 420 * t[:n - i]) * np.exp(-t[:n - i] / 0.012) +
               0.6 * bp(white(n - i, seed + 1), 3500, q=1.0) * np.exp(-t[:n - i] / 0.02))
    return norm(air + tap)


EFFECTS = {k[3:]: v for k, v in globals().items() if k.startswith("fx_")}


# ============================================================================================= ambience beds
def wind(n, seed, strength=1.0, howl=0.0, airy=0.0):
    a = pink(n, seed)
    b = pink(n, seed + 1)
    fcl = 350 + 250 * strength
    y = np.stack([dsp.sweep_filter_fn(a, "bp", lambda tt: fcl * (1 + 0.5 * math.sin(tt * 0.31 + seed)), q=0.5),
                  dsp.sweep_filter_fn(b, "bp", lambda tt: fcl * (1 + 0.5 * math.sin(tt * 0.27 + seed + 2)), q=0.5)],
                 axis=1)
    gust = (0.55 + 0.45 * smooth_noise(n, 0.25 * max(1.0, strength), seed + 3)) ** 2
    y = y * gust[:, None]
    if howl > 0:
        h = dsp.sweep_filter_fn(white(n, seed + 4), "bp", lambda tt: 420 + 220 * math.sin(tt * 0.5 + seed), q=14)
        y += howl * np.stack([h, np.roll(h, 331)], axis=1) * gust[:, None] * 2.0
    if airy > 0:
        air = hp(np.stack([white(n, seed + 5), white(n, seed + 6)], axis=1), 3500) * 0.15 * airy
        y += air * gust[:, None]
    return hp(lp(y, 6000), 70, order=2)


def ember_crackle(n, seed, rate=6.0, dist=1.0):
    t_ = poisson_times(n / SR, lambda x: rate, seed)
    y = impacts(n, t_, kernel_bank("ember", 6, seed + 1), seed + 2)
    y += 0.5 * grains(n, rate * 6, seed + 3, dur_ms=(0.3, 1.2), band=(2500, 8000))
    if dist > 1:
        y = lp(y, 6000 / dist)
    return np.stack([y, np.roll(y, 517)], axis=1)


def ash_hush(n, seed):
    """Falling ash: the faintest dry, snowy hiss."""
    y = lp(hp(np.stack([pink(n, seed), pink(n, seed + 1)], axis=1), 2500), 8000, order=2)
    return y * (0.6 + 0.4 * smooth_noise(n, 0.4, seed + 2))[:, None] * 0.25


def rain(n, seed, amount=1.0):
    dur = n / SR
    ch = []
    for c in range(2):
        drops = impacts(n, poisson_times(dur, lambda x: 900 * amount, seed + c), kernel_bank("drop", 8, seed + 5 + c),
                        seed + 10 + c)
        ch.append(drops)
    y = np.stack(ch, axis=1) * 0.5
    wash = lp(hp(np.stack([white(n, seed + 20), white(n, seed + 21)], axis=1), 600), 7000) * 0.35
    splat = bp(np.stack([pink(n, seed + 22), pink(n, seed + 23)], axis=1), 1500, q=0.6) * 0.3
    return y + (wash + splat) * (0.8 + 0.2 * smooth_noise(n, 0.5, seed + 24))[:, None]


def hail(n, seed, amount=1.0):
    dur = n / SR
    ch = []
    for c in range(2):
        ice = impacts(n, poisson_times(dur, lambda x: 700 * amount, seed + c), kernel_bank("ice", 96, seed + 5 + c),
                      seed + 10 + c)
        rock = impacts(n, poisson_times(dur, lambda x: 120 * amount, seed + 30 + c),
                       kernel_bank("stone", 32, seed + 35 + c), seed + 40 + c)
        ch.append(ice + 0.6 * rock)
    roar = bp(np.stack([pink(n, seed + 50), pink(n, seed + 51)], axis=1), 2500, q=0.4) * 0.5
    return np.stack(ch, axis=1) + roar


def drips(n, seed, rate=1.4):
    out = np.zeros((n, 2), np.float32)
    r = np.random.default_rng(seed)
    for k, t in enumerate(poisson_times(n / SR, lambda x: rate, seed)):
        d = drip(seed + k, size=r.uniform(0.8, 1.3)) * r.uniform(0.3, 1.0)
        dsp.place(out, pan(d, r.uniform(-0.7, 0.7)), t)
    return out


def rumble(n, seed, level=1.0):
    y = lp(np.stack([brown(n, seed), brown(n, seed + 1)], axis=1), 110, order=2)
    return y * (0.5 + 0.5 * smooth_noise(n, 0.3, seed + 2))[:, None] * level


def leaves(n, seed, level=1.0):
    am = np.clip(np.stack([smooth_noise(n, 6, seed), smooth_noise(n, 6, seed + 1)], axis=1) * 0.8 + 0.3, 0, None) ** 2
    return bp(np.stack([white(n, seed + 2), white(n, seed + 3)], axis=1), 4000, q=0.6) * am * level


def bed(kind, dur, seed):
    n = int(dur * SR)
    if kind == "ash_wind":          # the burnt valley: desolate moaning wind, falling ash, far embers
        y = wind(n, seed, 0.6, howl=0.22, airy=0.2) + 0.5 * ash_hush(n, seed + 7) + \
            0.12 * ember_crackle(n, seed + 9, rate=3.0, dist=2.0)
    elif kind == "ash_close":       # at the stump: a low breeze, the hush of ash, embers ticking close
        y = wind(n, seed, 0.35, howl=0.08, airy=0.1) * 0.7 + 0.45 * ash_hush(n, seed + 7) + \
            0.2 * ember_crackle(n, seed + 9, rate=5.0)
    elif kind == "storm_wind":      # the storm rolling in: hard gusting wind, a far rumble
        y = wind(n, seed, 1.5, howl=0.25, airy=0.6) + 0.9 * rumble(n, seed + 11) + 0.2 * ash_hush(n, seed + 12)
    elif kind == "storm_run":       # running in it: wind streaming past, rumble
        y = wind(n, seed, 1.8, howl=0.15, airy=1.0) + 0.8 * rumble(n, seed + 11)
    elif kind == "storm_rain":
        y = 0.7 * wind(n, seed, 1.5, howl=0.2, airy=0.6) + 0.9 * rain(n, seed + 13) + 0.6 * rumble(n, seed + 11)
    elif kind == "storm_hail":      # hail roaring on rock, rain, the wind howling
        y = 0.6 * wind(n, seed, 1.7, howl=0.3, airy=0.6) + 1.2 * hail(n, seed + 14) + 0.5 * rain(n, seed + 13) + \
            0.6 * rumble(n, seed + 11)
    elif kind == "hush":            # after the hail: drips, a faint wind, nothing else
        y = 0.35 * wind(n, seed, 0.25, airy=0.1) + 1.2 * drips(n, seed + 15) + 0.15 * rumble(n, seed + 11)
    elif kind == "summit_wind":     # the last ledge: thin high wind
        y = hp(wind(n, seed, 1.0, howl=0.1, airy=1.0), 300, order=2)
    elif kind == "summit_light":    # in the beam: the wind settling
        y = hp(wind(n, seed, 0.45, airy=0.6), 250, order=2) * 0.8
    elif kind == "meadow":          # the valley alive: breeze, leaves, distant birds
        y = 0.5 * wind(n, seed, 0.35, airy=0.4) + 0.5 * leaves(n, seed + 16) + \
            0.5 * stereo_mix(fx_birds(dur, density=0.35, seed=seed + 17), n)
    elif kind == "coda":            # a warm afternoon: a gentle breeze, leaves, birds far off
        y = 0.4 * wind(n, seed, 0.25, airy=0.3) + 0.45 * leaves(n, seed + 16, 0.8) + \
            0.4 * stereo_mix(fx_birds(dur, density=0.3, seed=seed + 18), n)
    else:
        raise ValueError(kind)
    return y.astype(np.float32)


def stereo_mix(y, n):
    y = stereoize(y)
    out = np.zeros((n, 2), np.float32)
    out[:min(n, len(y))] = y[:n]
    return out


def stereoize(y):
    y = np.asarray(y, np.float32)
    if y.ndim == 2:
        return y
    return np.stack([y, np.roll(y, 211)], axis=1)


# ============================================================================================= rendering
SPACES = {
    "valley": dict(ir=lambda: dsp.make_ir(2.2, predelay=0.07, seed=22, er=dict(n=4, spread=0.4, gain=0.4, lp=2500),
                                         hf_damp=0.35, bright=3500), wet=0.12),
    "storm": dict(ir=lambda: dsp.make_ir(1.4, predelay=0.03, seed=23, er=dict(n=8, spread=0.12, gain=0.55, lp=5000),
                                        hf_damp=0.4, bright=5000), wet=0.10),
    "rock": dict(ir=lambda: dsp.make_ir(1.6, predelay=0.02, seed=24, er=dict(n=10, spread=0.08, gain=0.6, lp=6000),
                                       hf_damp=0.45, bright=6000), wet=0.22),
    "summit": dict(ir=lambda: dsp.make_ir(2.4, predelay=0.05, seed=25, hf_damp=0.3, bright=5000), wet=0.12),
    "meadow": dict(ir=lambda: dsp.make_ir(1.8, predelay=0.04, seed=26, er=dict(n=5, spread=0.2, gain=0.3, lp=4000),
                                         hf_damp=0.35, bright=5000), wet=0.10),
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
    """Ambience: consecutive segments with the same bed kind share one continuous bed; beds hard-cut with picture
    (30 ms crossfades). Level per segment is automated with short ramps."""
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
        y = bed(kind, b - a, seed=1000 + 37 * k)
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
