"""World instruments: physical-model plucks, modal percussion, breath, reed, bowed and voice synthesis.
All functions return float32 arrays at 48 kHz, mono unless noted, deterministic by seed."""
import math
import numpy as np
from scipy import signal
from dsp import SR, lp, hp, bp, white, pink, filt, smooth_noise

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)
def rng(*a): return np.random.default_rng(abs(hash(a)) % (2 ** 32) if False else (sum(int(x * 1000) * p for x, p in zip(a, (7919, 104729, 1299709, 15485863, 32452843))) % (2 ** 32)))
def env_ad(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)
def fade_end(y, s=0.02):
    k = min(len(y), int(s * SR)); y = y.copy(); y[-k:] *= np.linspace(1, 0, k) ** 2; return y

# ---------------------------------------------------------------- plucked strings (Karplus-Strong, tuned)
def pluck(m, dur=2.0, vel=0.8, bright=0.5, decay=0.996, pos=0.17, body=None, buzz=0.0, seed=0, attack_noise=0.25, bend=None):
    f = hz(m); n = int(dur * SR); P = SR / f + 1 - (0.5 * (1 - bright) * 0.9 + 0.06); N = int(math.floor(P)); fr = P - N
    r = rng(m, seed, 3); L = N + 2
    ex = r.uniform(-1, 1, L); k = max(1, int(1 + (1 - bright) * 9)); ex = np.convolve(ex, np.ones(k) / k, 'same'); ex -= ex.mean()
    q = max(1, int(pos * L)); ex = ex - np.roll(ex, q) * 0.9; ex /= np.abs(ex).max() + 1e-9
    x = np.zeros(n); x[:min(L, n)] = ex[:min(L, n)]
    s = 0.5 * (1 - bright) * 0.9 + 0.06
    g = decay ** (f / 220) if f > 220 else decay
    c = np.convolve([1 - s, s], [1 - fr, fr]) * g
    a = np.zeros(N + len(c)); a[0] = 1; a[N - 1:N - 1 + len(c)] -= c
    y = signal.lfilter([1], a, x)
    if buzz > 0:
        z = np.tanh(y * (2 + 6 * buzz)) ; z = z + 0.6 * buzz * np.tanh(np.maximum(y, 0) * 14) ; z = hp(z, 300); y = (1 - 0.6 * buzz) * y + 0.5 * buzz * z * np.exp(-np.arange(n) / SR / 1.6)
    y = y * vel
    if attack_noise: t = np.arange(n) / SR; y += hp(r.standard_normal(n), 1800) * np.exp(-t / 0.006) * attack_noise * vel * 0.3
    if body:
        for fb, qb, gb in body: y = filt(y, 'peak', fb, qb, gb)
    if bend is not None: # resample with a pitch curve (semitones over time)
        b = np.interp(np.arange(n) / SR, *bend); ph = np.cumsum(2 ** (b / 12)); ph = ph - ph[0]; y = np.interp(ph, np.arange(n), y, right=0)
    return fade_end(np.asarray(y, np.float32) * 0.55, 0.06)
KIT = {
    'lyre': dict(bright=0.35, decay=0.9955, pos=0.3, body=[(240, 1.2, 4), (2600, 1.0, -4)]),
    'harp': dict(bright=0.42, decay=0.9975, pos=0.4, body=[(180, 1.0, 3)]),
    'kithara': dict(bright=0.5, decay=0.996, pos=0.22, body=[(320, 1.4, 4)]),
    'sitar': dict(bright=0.85, decay=0.9985, pos=0.12, buzz=0.85, body=[(900, 1.2, 3), (2400, 1.4, 4)]),
    'tanpura': dict(bright=0.7, decay=0.9992, pos=0.1, buzz=0.9, body=[(420, 1, 3)]),
    'guzheng': dict(bright=0.8, decay=0.9978, pos=0.14, body=[(500, 1.2, 3), (3200, 1.2, 2)]),
    'pipa': dict(bright=0.9, decay=0.990, pos=0.1, body=[(700, 1.4, 5), (2500, 1.5, 4)]),
    'santur': dict(bright=0.9, decay=0.9975, pos=0.08, body=[(1200, 1, 3)]),
    'oud': dict(bright=0.38, decay=0.9925, pos=0.2, body=[(130, 1.4, 5), (300, 1.2, 4), (3000, 1, -4)]),
    'qanun': dict(bright=0.85, decay=0.996, pos=0.1, body=[(900, 1, 3)]),
    'kora': dict(bright=0.62, decay=0.9958, pos=0.25, body=[(260, 1.3, 5), (1400, 1.2, 2)]),
    'bandura': dict(bright=0.82, decay=0.9982, pos=0.18, body=[(420, 1.2, 3)]),
    'charango': dict(bright=0.85, decay=0.991, pos=0.14, body=[(650, 1.4, 5), (2600, 1.2, 2)]),
    'koto': dict(bright=0.72, decay=0.9968, pos=0.11, body=[(360, 1.4, 5), (1800, 1.2, 2)]),
    'uke': dict(bright=0.55, decay=0.990, pos=0.25, body=[(420, 1.2, 4)]),
    'gut': dict(bright=0.3, decay=0.994, pos=0.3, body=[(200, 1.2, 3)]),
}
def P(kind, m, dur=2.0, vel=0.8, seed=0, **k): return pluck(m, dur, vel, seed=seed, **{**KIT[kind], **k})

# ---------------------------------------------------------------- modal percussion
def modal(f0, ratios, amps, t60, dur, vel=0.8, seed=0, strike=0.3, strike_f=3000, drop=0.0):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.zeros(n); r = rng(f0, seed, 5)
    for q, a, d in zip(ratios, amps, t60):
        f = f0 * q * (1 + r.normal(0, 0.0012)); ph = r.uniform(0, 2 * np.pi)
        if f < SR * 0.45: y += a * np.sin(2 * np.pi * f * (t + drop * (1 - np.exp(-t / 0.03)) * -0.03) + ph) * np.exp(-6.9 * t / d)
    nz = bp(r.standard_normal(n), strike_f, 0.8) * np.exp(-t / 0.008) * strike * 4
    at = np.minimum(1, t / 0.0008); return fade_end(((y + nz) * at * vel * 0.4).astype(np.float32))
def membrane(f0, vel=0.8, decay=0.5, dur=1.2, drop=1.0, tone=0.5, skin=0.5, seed=0, slap=0.0):
    n = int(dur * SR); t = np.arange(n) / SR; r = rng(f0, seed, 9); y = np.zeros(n)
    for q, a, dk in ((1, 1, 1), (1.593, 0.45, 0.6), (2.135, 0.3, 0.45), (2.296, 0.22, 0.4), (2.653, 0.16, 0.35), (2.917, 0.12, 0.3)):
        f = f0 * q; ph = 2 * np.pi * np.cumsum(f * (1 + drop * 0.6 * np.exp(-t / 0.028))) / SR; y += a * (1 if q == 1 else tone) * np.sin(ph) * np.exp(-t / (decay * dk))
    nz = r.standard_normal(n); y += bp(nz, f0 * 6 + 500, 0.6) * np.exp(-t / 0.018) * skin * 1.6 + hp(nz, 2500) * np.exp(-t / 0.004) * (0.25 + slap) * 1.2
    if slap: y += bp(nz, 1800, 1.2) * np.exp(-t / 0.03) * slap * 2
    return fade_end((np.tanh(y * 1.1) * vel * 0.6).astype(np.float32))
def taiko(vel=0.9, f=62, seed=0): return membrane(f, vel, 0.75, 2.0, 1.1, 0.5, 0.6, seed) * 1.25
def frame(vel=0.8, f=92, seed=0): return membrane(f, vel, 0.5, 1.4, 0.5, 0.55, 0.5, seed)
def djembe(kind, vel=0.8, seed=0): return {'b': lambda: membrane(78, vel, 0.32, 0.9, 0.8, 0.35, 0.3, seed), 't': lambda: membrane(290, vel * 0.8, 0.10, 0.5, 0.2, 0.7, 0.6, seed), 's': lambda: membrane(400, vel * 0.75, 0.07, 0.4, 0.1, 0.9, 0.5, seed, 0.9)}[kind]()
def tabla(kind, vel=0.8, seed=0):
    if kind == 'na': return modal(310, [1, 2.0, 3.01, 4.02], [1, .6, .35, .2], [0.5, .4, .3, .2], 0.6, vel * 0.8, seed, 0.5, 3500)
    if kind == 'tin': return modal(300, [1, 2.0, 3.0], [1, .3, .2], [1.0, .5, .3], 1.0, vel * 0.8, seed, 0.2, 2500)
    if kind == 'ge': n = int(0.9 * SR); t = np.arange(n) / SR; f = 78 + 26 * np.exp(-((t - 0.12) / 0.1) ** 2) + 30 * np.exp(-t / 0.02); return fade_end((np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.3) * vel * 0.75 + bp(rng(seed, 1).standard_normal(n), 400, .8) * np.exp(-t / .015) * .2 * vel).astype(np.float32))
    return membrane(350, vel * 0.5, 0.04, 0.2, 0.1, 0.4, 0.9, seed, 0.4)
def rattle(vel=0.6, dur=0.16, f=5200, seed=0, grains=26):
    n = int((dur + 0.1) * SR); y = np.zeros(n); r = rng(f, seed, 2)
    for _ in range(grains):
        i = int(min(0.999, r.beta(1.4, 2.6)) * dur * SR); k = int(0.012 * SR); e = np.exp(-np.arange(k) / (0.0022 * SR)); g = bp(r.standard_normal(k), f * r.uniform(.8, 1.25), 1.2) * e * r.uniform(.3, 1); y[i:i + k] += g[:len(y[i:i + k])]
    return (y * vel * 0.9).astype(np.float32)
def sticks(vel=0.8, f=1150, seed=0): return modal(f, [1, 2.57, 4.2], [1, .5, .25], [0.09, .05, .04], 0.25, vel, seed, 0.7, 2600)
def log(vel=0.8, f=210, seed=0): return modal(f, [1, 2.2, 3.9], [1, .4, .15], [0.22, .12, .08], 0.5, vel, seed, 0.35, 1400)
def bell(f=980, vel=0.7, seed=0): return modal(f, [1, 1.51, 2.31, 3.2, 4.4], [1, .7, .4, .3, .2], [0.5, .4, .3, .2, .15], 0.8, vel, seed, 0.4, 5000)
def gong(m=38, vel=0.8, dur=6.0, seed=0):
    f = hz(m); n = int(dur * SR); t = np.arange(n) / SR; r = rng(m, seed, 4); y = np.zeros(n)
    for q, a, d in zip([1, 1.008, 2.0, 2.76, 3.4, 4.1, 5.2, 6.3, 7.9], [1, .9, .55, .4, .35, .25, .2, .15, .1], [6, 5.5, 4, 3, 2.4, 2, 1.6, 1.2, 1]): y += a * np.sin(2 * np.pi * f * q * t + r.uniform(0, 6)) * np.exp(-6.9 * t / d)
    y *= np.minimum(1, t / 0.012); y += lp(hp(r.standard_normal(n), 400), 5000) * np.exp(-t / 0.9) * np.minimum(1, t / .15) * .25
    return fade_end((y * vel * 0.22).astype(np.float32), 0.4)
def metallophone(f, vel=0.7, dur=2.2, seed=0): return modal(f, [1, 2.76, 5.4, 8.93], [1, .35, .18, .08], [dur * .9, dur * .5, dur * .3, dur * .2], dur, vel, seed, 0.25, 4500) * 0.9
def tibell(m, vel=0.6, dur=4.0, seed=0): return modal(hz(m), [1, 2.0, 3.01, 4.2, 5.43, 6.8], [1, .6, .35, .3, .2, .12], [dur, dur * .8, dur * .6, dur * .4, dur * .3, dur * .2], dur, vel, seed, 0.1, 6000) * .7
def shaker(vel=0.4, seed=0, f=7000): n = int(.12 * SR); t = np.arange(n) / SR; return (bp(rng(seed, f).standard_normal(n), f, .9) * np.minimum(1, t / .02) * np.exp(-t / .03) * vel).astype(np.float32)
def clap(vel=0.7, seed=0):
    n = int(.4 * SR); t = np.arange(n) / SR; r = rng(seed, 77); y = np.zeros(n)
    for d in (0, .011, .019, .031): y += np.where(t >= d, np.exp(-(t - d) / .012), 0) * bp(r.standard_normal(n), 1300 + r.uniform(-200, 300), 1.1)
    return fade_end((y * vel * .8).astype(np.float32))
def foot(vel=0.8, seed=0): return membrane(55, vel, .14, .5, .6, .2, .9, seed) * .9

# ---------------------------------------------------------------- continuous lines
# notes: list of (t, dur, midi, vel). returns f0 and amp curves
def contour(notes, length, glide=0.04, att=0.04, rel=0.08, vib=(5.2, 0.18, 0.25), seed=0, scoop=0.0, legato=True):
    n = int(length * SR); f = np.zeros(n); a = np.zeros(n); t = np.arange(n) / SR; on = np.zeros(n); notes = sorted(notes)
    if not notes: return np.full(n, 440.0), a, on
    f[:] = notes[0][2]
    for i, (t0, d, m, v) in enumerate(notes):
        i0, i1 = int(t0 * SR), min(n, int((t0 + d) * SR));
        if i0 >= n: continue
        prev = notes[i - 1][2] if i else m; tail = f[i0:]; tt = np.arange(len(tail)) / SR; con = legato and i and abs(notes[i - 1][0] + notes[i - 1][1] - t0) < 0.03
        start = prev if con else m - scoop; f[i0:] = m + (start - m) * np.exp(-tt / max(glide, 1e-3))
        L = i1 - i0; e = np.ones(L); ta = np.arange(L) / SR; nxt = legato and i + 1 < len(notes) and abs(t0 + d - notes[i + 1][0]) < 0.03
        e = np.minimum(1, (ta + (0.02 if con else 0)) / att) if not con else 0.72 + 0.28 * np.minimum(1, ta / att)
        a[i0:i1] = np.maximum(a[i0:i1], e * v)
        if not nxt: k = int(rel * SR); seg = a[i1:i1 + k]; seg[:] = np.maximum(seg, v * np.exp(-np.arange(len(seg)) / (rel * 0.3 * SR)))
        if vib[1] > 0: vs = ta - vib[2]; f[i0:i1] += np.where(vs > 0, vib[1] * np.minimum(1, vs / 0.25) * np.sin(2 * np.pi * vib[0] * ta), 0)
        on[i0:min(n, i0 + int(.05 * SR))] = 1
    f += smooth_noise(n, 6, seed + 11)[:n] * 0.05 if n > 100 else 0
    a = lp(a, 60)
    return 440 * 2 ** ((f - 69) / 12), np.maximum(a, 0), on
def _ph(f): return 2 * np.pi * np.cumsum(f) / SR
def flute(notes, length, breath=0.25, bright=0.35, seed=0, kind='flute', **k):
    f, a, on = contour(notes, length, seed=seed, **k); n = len(f); ph = _ph(f); r = rng(seed, 6)
    y = np.sin(ph) + bright * 0.5 * np.sin(2 * ph + .3) + bright * 0.32 * np.sin(3 * ph) + bright * 0.12 * np.sin(4 * ph + 1)
    if kind == 'pan': y = np.sin(ph) + 0.32 * np.sin(3 * ph) + 0.1 * np.sin(5 * ph)
    nz = r.standard_normal(n); fm = float(np.median(f[a > .05])) if (a > .05).any() else 600
    br = bp(nz, fm * 1.0, 1.4) * 1.1 + bp(nz, fm * 3, .8) * .5 + hp(nz, 4000) * .10
    chiff = lp(on.astype(float), 40) * bp(nz, fm * 2.2, .7) * 1.6
    return ((y * 0.5 * (1 + .12 * smooth_noise(n, 9, seed + 3)[:n]) + br * breath + chiff * breath * 1.2) * a * 0.55).astype(np.float32)
def reed(notes, length, duty=0.28, forms=((620, 2.2, 9), (1500, 2, 6), (2900, 2, 2)), seed=0, noise=.03, **k):
    f, a, on = contour(notes, length, seed=seed, **k); ph = _ph(f) / (2 * np.pi); s = (ph % 1); y = np.where(s < duty, 1.0, -duty / (1 - duty)); y = y - np.mean(y); y = lp(y, 5200)
    for fb, q, g in forms: y = filt(y, 'peak', fb, q, g)
    y += rng(seed, 8).standard_normal(len(y)) * noise; return (hp(y, 120) * a * 0.22).astype(np.float32)
def bowed(notes, length, forms=((300, 2, 6), (480, 3, 5), (1100, 2, 4), (2400, 2, 2)), seed=0, rough=.1, cut=4200, **k):
    f, a, on = contour(notes, length, seed=seed, **k); n = len(f); ph = _ph(f) / (2 * np.pi); s = 2 * (ph % 1) - 1; y = lp(s, cut); r = rng(seed, 3); y = y + rough * bp(r.standard_normal(n), 2200, .7) + .5 * on * bp(r.standard_normal(n), 1600, 1) * .5
    for fb, q, g in forms: y = filt(y, 'peak', fb, q, g)
    trem = 1 + .08 * smooth_noise(n, 11, seed + 5)[:n]; return (hp(y, 90) * a * trem * 0.26).astype(np.float32)
VOW = {'a': ((730, 8, 12), (1090, 9, 8), (2440, 10, 4), (3400, 8, 3)), 'o': ((500, 8, 12), (880, 9, 8), (2400, 10, 1), (3200, 8, 0)), 'u': ((340, 8, 11), (800, 9, 5), (2300, 10, -2), (3200, 8, -4)), 'e': ((480, 8, 11), (1800, 10, 7), (2500, 10, 4), (3300, 8, 2)), 'i': ((300, 8, 11), (2200, 10, 7), (2900, 10, 4), (3500, 8, 2)), 'm': ((250, 6, 10), (900, 8, -4), (2200, 8, -8), (3000, 8, -10))}
def voice(notes, length, vowel='a', seed=0, breath=.05, bright=.5, **k):
    k = {**dict(glide=.06, att=.09, rel=.22, vib=(5.1, .22, .3), scoop=.6), **k}; f, a, on = contour(notes, length, seed=seed, **k); n = len(f); ph = _ph(f) / (2 * np.pi); s = ph % 1
    g = np.where(s < .62, .5 * (1 - np.cos(np.pi * s / .62)), np.where(s < .74, np.cos(np.pi / 2 * (s - .62) / .12), 0)); y = np.diff(g, prepend=g[0]); y = lp(y, 1800 + 5200 * bright); y /= np.abs(y).max() + 1e-9
    out = y * .25
    for fb, q, gb in VOW[vowel]: out = out + filt(y, 'bp', fb, q) * 10 ** (gb / 20) * 1.1
    out += hp(rng(seed, 2).standard_normal(n), 2500) * breath * .15; return (hp(out, 90) * a * .34).astype(np.float32)
def choir(notes, length, vowel='a', n=7, seed=0, spread=.16, **k): # → stereo
    out = np.zeros((int(length * SR), 2), np.float32); r = rng(seed, 12)
    for i in range(n):
        dt = r.normal(0, .018); nn = [(max(0, t + dt + r.normal(0, .008)), d, m + r.normal(0, spread), v * r.uniform(.8, 1)) for t, d, m, v in notes]
        kk = {'vib': (r.uniform(4.6, 5.8), r.uniform(.1, .28), .25), **k}; y = voice(nn, length, vowel, seed * 31 + i, **kk); p = -0.8 + 1.6 * (i + .5) / n; out[:, 0] += y * math.cos((p + 1) * math.pi / 4); out[:, 1] += y * math.sin((p + 1) * math.pi / 4)
    return out * (1.5 / math.sqrt(n))
def didge(length, rhythm, m=38, seed=0): # rhythm: [(t, dur, accent)]
    n = int(length * SR); t = np.arange(n) / SR; f = hz(m); a = np.zeros(n); fm = np.full(n, 420.0)
    for t0, d, ac in rhythm: i0, i1 = int(t0 * SR), min(n, int((t0 + d) * SR)); u = np.arange(i1 - i0) / max(1, i1 - i0); a[i0:i1] = np.maximum(a[i0:i1], (.5 + .5 * ac) * np.minimum(1, u * 14) * (1 - .5 * u)); fm[i0:i1] = 380 + ac * 900 * np.sin(np.pi * u)
    a = lp(a, 30); fm = lp(fm, 12); ph = _ph(np.full(n, f) * (1 + .004 * smooth_noise(n, 5, seed)[:n])) / (2 * np.pi); s = 2 * (ph % 1) - 1; src = lp(np.tanh(s * 2), 2400); out = lp(src, 190) * 1.2
    B = 1024; yb = np.zeros(n)
    for i in range(0, n, B): # moving mouth formant
        seg = src[max(0, i - B):i + B]; y = filt(seg, 'bp', float(np.clip(fm[min(n - 1, i)], 200, 2400)), 5); yb[i:i + B] += y[-len(src[i:i + B]):][:len(yb[i:i + B])] if i else y[:B]
    return ((out + yb * 2.4) * a * .5).astype(np.float32)
def throat(length, notes, seed=0): # drone + moving whistle overtones
    out = voice(notes, length, 'o', seed, vib=(5, 0, 9), glide=.03, bright=.8) * 1.2; n = len(out); r = rng(seed, 1); f, a, _ = contour(notes, length, seed=seed, vib=(5, 0, 9)); t = np.arange(n) / SR; har = np.array([6, 8, 9, 10, 8, 12, 10, 9]); hh = har[(np.floor(t / .3125).astype(int)) % len(har)].astype(float); hh = lp(hh, 14); ph = _ph(f * hh); return (out + np.sin(ph) * a * .05 * (1 + .3 * np.sin(2 * np.pi * 6 * t))).astype(np.float32)
def conch(m, length, notes=None, seed=0):
    f, a, on = contour(notes or [(0, length * .8, m, .9)], length, att=.12, rel=.4, scoop=2, vib=(4.5, .12, .4), seed=seed); ph = _ph(f); y = sum(np.sin(k * ph) / k ** 1.15 for k in range(1, 9)); return (lp(y, 1700) * a * .3).astype(np.float32)

# ---------------------------------------------------------------- effects
def whoosh(dur=.6, f0=300, f1=2600, vel=.6, seed=0, peak=.55):
    n = int(dur * SR); t = np.linspace(0, 1, n); r = rng(seed, dur, 5); nz = r.standard_normal(n); e = np.where(t < peak, (t / peak) ** 2.2, ((1 - t) / (1 - peak)) ** 1.6); out = np.zeros(n); K = 12
    for i in range(K): c = f0 * (f1 / f0) ** (i / (K - 1)); w = np.exp(-((t * (K - 1) - i) / 2.2) ** 2); out += bp(nz, c, 1.1) * w
    return (out * e * vel * .8).astype(np.float32)
def boom(vel=.9, f=46, dur=2.6, seed=0):
    n = int(dur * SR); t = np.arange(n) / SR; y = np.sin(2 * np.pi * np.cumsum(f * (1 + 1.3 * np.exp(-t / .05))) / SR) * np.exp(-t / (.32 * dur)); y += lp(rng(seed, 4).standard_normal(n), 220) * np.exp(-t / .22) * .7; return fade_end((np.tanh(y * 1.3) * vel * .75).astype(np.float32), .3)
def shimmer(dur=1.6, vel=.4, seed=0, base=86, n_gr=26):
    n = int((dur + 1.2) * SR); y = np.zeros((n, 2), np.float32); r = rng(seed, 21); sc = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24]
    for i in range(n_gr): t0 = dur * (i + r.uniform(0, 1)) / n_gr; m = base + sc[int(r.integers(0, len(sc)))]; g = modal(hz(m), [1, 2.76], [1, .25], [.9, .4], 1.0, r.uniform(.2, .6), int(r.integers(1e6)), .05); p = r.uniform(-.9, .9); k = int(t0 * SR); y[k:k + len(g), 0] += (g * math.cos((p + 1) * math.pi / 4))[:n - k]; y[k:k + len(g), 1] += (g * math.sin((p + 1) * math.pi / 4))[:n - k]
    return y * vel
def crackle(dur=2.0, vel=.3, rate=26, seed=0):
    n = int(dur * SR); y = np.zeros(n); r = rng(seed, 55)
    for _ in range(int(dur * rate)): i = int(r.uniform(0, dur - .03) * SR); k = int(.02 * SR); y[i:i + k] += bp(r.standard_normal(k), r.uniform(900, 5200), 1.5) * np.exp(-np.arange(k) / (r.uniform(.0008, .004) * SR)) * r.exponential(.5)
    return (y * vel + lp(r.standard_normal(n), 320) * .05 * vel).astype(np.float32)
def twang(m=45, vel=.8, seed=0): return P('gut', m, 1.6, vel, seed, bright=.55, bend=(np.array([0, .03, .5]), np.array([1.6, .4, 0])))
def splash(vel=.5, seed=0): n = int(1.0 * SR); t = np.arange(n) / SR; r = rng(seed, 31); return fade_end((hp(lp(r.standard_normal(n), 5200), 500) * np.minimum(1, t / .03) * np.exp(-t / .22) * vel * .6 + bp(r.standard_normal(n), 900, 1) * np.exp(-((t - .12) / .09) ** 2) * vel * .4).astype(np.float32))
def wind(dur=3, vel=.25, seed=0): n = int(dur * SR); r = rng(seed, 41); m = smooth_noise(n, 1.1, seed + 2)[:n]; y = bp(r.standard_normal(n), 520, .9) * (.6 + .4 * m) + bp(r.standard_normal(n), 1300, 2) * (.3 + .3 * m); return (y * vel * np.sin(np.linspace(0, np.pi, n)) ** .6).astype(np.float32)
def bird(vel=.3, seed=0):
    r = rng(seed, 61); n = int(.9 * SR); y = np.zeros(n)
    for i in range(int(r.integers(2, 5))): t0 = .05 + i * r.uniform(.12, .2); k = int(.09 * SR); t = np.arange(k) / SR; f = r.uniform(2300, 3600) * (1 + r.uniform(-.25, .3) * np.sin(np.pi * t / .09)); s = int(t0 * SR); g = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / .09) ** 1.5; y[s:s + k] += g[:n - s] if s < n else 0
    return (y * vel * .5).astype(np.float32)
def hoof(vel=.5, seed=0): return (membrane(150, vel * .7, .05, .25, .4, .5, .8, seed, .2) + log(vel * .5, 420, seed)[:int(.25 * SR)] if True else 0).astype(np.float32)
def flap(vel=.4, seed=0): n = int(.22 * SR); t = np.arange(n) / SR; return (lp(bp(rng(seed, 71).standard_normal(n), 700, .6), 2600) * np.sin(np.pi * np.minimum(1, t / .2)) ** 2 * vel).astype(np.float32)
def rip(vel=.4, seed=0): n = int(.5 * SR); t = np.arange(n) / SR; r = rng(seed, 81); g = (smooth_noise(n, 90, seed)[:n] > .0) * 1.0; return (bp(r.standard_normal(n), 2600, .7) * (.3 + .7 * lp(g, 200)) * np.sin(np.pi * t / .5) * vel).astype(np.float32)
