"""Shared DSP: filters (RBJ biquads), envelopes, noise, reverb impulse responses, dynamics, loudness, WAV I/O.
Everything is deterministic (explicit seeds) and works on float32/float64 numpy arrays; stereo = shape (n, 2)."""
import math
import os
import wave

import numpy as np
from scipy import signal

SR = 48000


# ------------------------------------------------------------------------------------------------ basics
def db(x):
    return 10.0 ** (np.asarray(x) / 20.0)


def to_db(x, floor=-200.0):
    return np.maximum(20 * np.log10(np.maximum(np.abs(x), 1e-12)), floor)


def secs(n):
    return int(round(n * SR))


def stereo(x):
    x = np.asarray(x, np.float32)
    return np.stack([x, x], axis=1) if x.ndim == 1 else x


def pan(x, p):
    """Equal-power pan of a mono signal (p in [-1, 1]) -> stereo."""
    a = (float(np.clip(p, -1, 1)) + 1) * math.pi / 4
    x = np.asarray(x, np.float32)
    return np.stack([x * math.cos(a) * math.sqrt(2), x * math.sin(a) * math.sqrt(2)], axis=1)


def place(buf, y, t, gain=1.0):
    """Add y (n,2) into buf at time t (s). Clips at buffer edges."""
    i0 = int(round(t * SR))
    if i0 >= len(buf):
        return
    y = stereo(y)
    a = max(0, -i0)
    i1 = min(len(buf), i0 + len(y))
    if i1 > max(i0, 0):
        buf[max(i0, 0):i1] += gain * y[a:a + i1 - max(i0, 0)]


def rms_db(x):
    x = np.asarray(x, np.float64)
    return 10 * np.log10(np.mean(x ** 2) + 1e-20)


# ------------------------------------------------------------------------------------------------ noise
def rng(seed):
    return np.random.default_rng(seed)


def white(n, seed):
    return rng(seed).standard_normal(n).astype(np.float32)


def pink(n, seed):
    """Pink noise via FFT shaping (1/f power), unit RMS."""
    w = rng(seed).standard_normal(n)
    X = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= np.sqrt(f / 1000.0)
    y = np.fft.irfft(X, n)
    return (y / (np.std(y) + 1e-12)).astype(np.float32)


def brown(n, seed):
    w = rng(seed).standard_normal(n)
    X = np.fft.rfft(w)
    f = np.fft.rfftfreq(n, 1 / SR)
    f[0] = f[1]
    X /= (f / 100.0)
    X[f < 15] *= (f[f < 15] / 15) ** 2
    y = np.fft.irfft(X, n)
    return (y / (np.std(y) + 1e-12)).astype(np.float32)


def smooth_noise(n, rate_hz, seed):
    """Slowly varying random control signal in [-1, 1] (cosine-interpolated random points)."""
    k = max(2, int(n / SR * rate_hz) + 3)
    pts = rng(seed).uniform(-1, 1, k)
    x = np.arange(n) / SR * rate_hz
    i = np.floor(x).astype(int)
    u = x - i
    u = 0.5 - 0.5 * np.cos(np.pi * u)
    return (pts[i] * (1 - u) + pts[np.minimum(i + 1, k - 1)] * u).astype(np.float32)


# ------------------------------------------------------------------------------------------------ filters
def _biquad(kind, f, q=0.707, gain_db=0.0):
    f = float(np.clip(f, 5.0, SR * 0.49))
    w = 2 * math.pi * f / SR
    cw, sw = math.cos(w), math.sin(w)
    alpha = sw / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":
        b = [alpha, 0, -alpha]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]
        a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    elif kind == "lowshelf":
        sa = 2 * math.sqrt(A) * alpha
        b = [A * ((A + 1) - (A - 1) * cw + sa), 2 * A * ((A - 1) - (A + 1) * cw), A * ((A + 1) - (A - 1) * cw - sa)]
        a = [(A + 1) + (A - 1) * cw + sa, -2 * ((A - 1) + (A + 1) * cw), (A + 1) + (A - 1) * cw - sa]
    elif kind == "highshelf":
        sa = 2 * math.sqrt(A) * alpha
        b = [A * ((A + 1) + (A - 1) * cw + sa), -2 * A * ((A - 1) + (A + 1) * cw), A * ((A + 1) + (A - 1) * cw - sa)]
        a = [(A + 1) - (A - 1) * cw + sa, 2 * ((A - 1) - (A + 1) * cw), (A + 1) - (A - 1) * cw - sa]
    else:
        raise ValueError(kind)
    return np.array([b[0] / a[0], b[1] / a[0], b[2] / a[0], 1.0, a[1] / a[0], a[2] / a[0]])


def filt(x, kind, f, q=0.707, gain_db=0.0, order=1):
    """Apply an RBJ biquad (order = number of cascaded sections) along axis 0."""
    sos = np.stack([_biquad(kind, f, q, gain_db)] * order)
    return signal.sosfilt(sos, x, axis=0).astype(np.float32)


def lp(x, f, order=1, q=0.707):
    return filt(x, "lp", f, q, order=order)


def hp(x, f, order=1, q=0.707):
    return filt(x, "hp", f, q, order=order)


def bp(x, f, q=1.0, order=1):
    return filt(x, "bp", f, q, order=order)


def eq(x, bands):
    """bands: list of (kind, f, q, gain_db)."""
    for (kind, f, q, g) in bands:
        x = filt(x, kind, f, q, g)
    return x


def sweep_filter(x, kind, f0, f1, q=0.707, seg=0.01, curve="exp"):
    """Block-wise swept biquad (cheap time-varying filter): cutoff moves f0 -> f1 over the signal."""
    x = np.asarray(x, np.float32)
    n = len(x)
    hop = max(64, int(seg * SR))
    out = np.zeros_like(x)
    zi = None
    nb = (n + hop - 1) // hop
    for b in range(nb):
        u = b / max(1, nb - 1)
        f = f0 * (f1 / f0) ** u if curve == "exp" else f0 + (f1 - f0) * u
        sos = _biquad(kind, f, q)[None, :]
        if zi is None:
            zi = np.zeros((1, 2) + x.shape[1:])
        seg_x = x[b * hop:(b + 1) * hop]
        y, zi = signal.sosfilt(sos, seg_x, axis=0, zi=zi)
        out[b * hop:(b + 1) * hop] = y
    return out


def sweep_filter_fn(x, kind, ffn, q=0.707, seg=0.008):
    """Block-wise swept biquad with cutoff given by ffn(t seconds) -> Hz."""
    x = np.asarray(x, np.float32)
    n = len(x)
    hop = max(64, int(seg * SR))
    out = np.zeros_like(x)
    zi = np.zeros((1, 2) + x.shape[1:])
    for b in range(0, n, hop):
        sos = _biquad(kind, float(ffn(b / SR)), q)[None, :]
        y, zi = signal.sosfilt(sos, x[b:b + hop], axis=0, zi=zi)
        out[b:b + hop] = y
    return out


# ------------------------------------------------------------------------------------------------ envelopes
def fade(x, fin=0.0, fout=0.0):
    x = np.array(x, np.float32, copy=True)
    n = len(x)
    if fin > 0:
        k = min(n, secs(fin))
        x[:k] *= np.linspace(0, 1, k)[:, None] if x.ndim == 2 else np.linspace(0, 1, k)
    if fout > 0:
        k = min(n, secs(fout))
        x[n - k:] *= np.linspace(1, 0, k)[:, None] if x.ndim == 2 else np.linspace(1, 0, k)
    return x


# ------------------------------------------------------------------------------------------------ reverb
def make_ir(rt60, length=None, predelay=0.012, seed=1, er=None, hf_damp=0.45, lf_rt_mul=1.15, width=1.0,
            density_ms=0.25, bright=6500.0):
    """Synthetic stereo reverb IR: early reflections + exponentially decaying decorrelated noise with
    frequency-dependent decay (3 bands with different RT60; highs die faster)."""
    length = length or min(8.0, rt60 * 1.4 + 0.2)
    n = secs(length)
    t = np.arange(n) / SR
    out = np.zeros((n, 2), np.float32)
    for ch in range(2):
        nz = white(n, seed * 7 + ch)
        lo = lp(nz, 350, order=2)
        hi = hp(nz, 3500, order=2)
        mid = nz - lo - hi
        bands = [(lo, rt60 * lf_rt_mul), (mid, rt60), (hi, rt60 * hf_damp)]
        y = np.zeros(n, np.float32)
        for b, rt in bands:
            y += b * np.exp(-6.9078 * t / rt)
        y = lp(y, bright)
        # soft onset of the diffuse tail
        y *= np.clip((t - predelay) / 0.03, 0, 1) ** 1.5
        out[:, ch] = y
    # mid/side width
    mid = (out[:, 0] + out[:, 1]) / 2
    side = (out[:, 0] - out[:, 1]) / 2 * width
    out = np.stack([mid + side, mid - side], axis=1)
    if er:
        r = rng(seed + 99)
        for k in range(er.get("n", 12)):
            dt = predelay * 0.5 + r.uniform(0.002, er.get("spread", 0.04))
            g = er.get("gain", 0.5) * r.uniform(0.3, 1.0) * math.exp(-dt / er.get("spread", 0.04))
            i = secs(dt)
            if i < n:
                out[i, 0] += g * r.uniform(0.5, 1)
                out[i + secs(r.uniform(0, 0.002)) if i + 100 < n else i, 1] += g * r.uniform(0.5, 1)
        out[:, :] = lp(out, er.get("lp", 9000))
    out /= np.sqrt(np.sum(out ** 2) / 2) + 1e-12
    return out.astype(np.float32)


def convolve(x, ir):
    """Stereo convolution (x (n,2), ir (m,2)) -> (n + m - 1, 2), each channel with its own IR channel plus a
    small cross-feed for a natural image."""
    from scipy.signal import oaconvolve
    x = stereo(x)
    yl = oaconvolve(x[:, 0], ir[:, 0]) * 0.85 + oaconvolve(x[:, 1], ir[:, 0]) * 0.15
    yr = oaconvolve(x[:, 1], ir[:, 1]) * 0.85 + oaconvolve(x[:, 0], ir[:, 1]) * 0.15
    return np.stack([yl, yr], axis=1).astype(np.float32)


def reverb(x, ir, wet=0.25, dry=1.0, keep_len=True):
    y = convolve(x, ir)
    out = np.zeros_like(y)
    out[:len(x)] += dry * stereo(x)
    out += wet * y
    return out[:len(x)] if keep_len else out


# ------------------------------------------------------------------------------------------------ dynamics
def envelope_follower(x, attack=0.005, release=0.1, rms_win=0.01):
    """Smoothed level (linear) of a stereo/mono signal."""
    m = np.asarray(x, np.float64)
    if m.ndim == 2:
        m = np.max(np.abs(m), axis=1) if rms_win <= 0 else np.sqrt(np.mean(m ** 2, axis=1))
    else:
        m = np.abs(m)
    if rms_win > 0:
        from scipy.ndimage import uniform_filter1d
        m = np.sqrt(np.maximum(uniform_filter1d(m ** 2, max(1, secs(rms_win)), mode="nearest"), 0))
    # asymmetric one-pole smoothing (vectorised via blocks of scipy lfilter is non-trivial; do decimated loop)
    dec = 48
    md = m[::dec]
    out = np.empty_like(md)
    ga = math.exp(-dec / (attack * SR))
    gr = math.exp(-dec / (release * SR))
    s = 0.0
    for i, v in enumerate(md):
        g = ga if v > s else gr
        s = g * s + (1 - g) * v
        out[i] = s
    return np.interp(np.arange(len(m)), np.arange(len(md)) * dec, out)


def compress(x, thresh_db=-18.0, ratio=2.0, attack=0.01, release=0.15, knee_db=6.0, makeup_db=0.0, sidechain=None):
    """Feed-forward compressor with soft knee; optional external sidechain."""
    sc = x if sidechain is None else sidechain
    lev = to_db(envelope_follower(sc, attack, release))
    over = lev - thresh_db
    gr = np.where(over <= -knee_db / 2, 0.0,
                  np.where(over >= knee_db / 2, over * (1 - 1 / ratio),
                           (1 - 1 / ratio) * (over + knee_db / 2) ** 2 / (2 * knee_db)))
    g = db(-gr + makeup_db).astype(np.float32)
    return (stereo(x) * g[:, None]).astype(np.float32), gr


def true_peak_db(x, os_factor=4):
    y = signal.resample_poly(np.asarray(x, np.float64), os_factor, 1, axis=0)
    return float(to_db(np.max(np.abs(y))))


def limiter(x, ceiling_db=-1.3, lookahead=0.004, release=0.12, os_factor=4):
    """Look-ahead brickwall limiter on 4x-oversampled (true) peaks. The gain is a forward minimum over the
    look-ahead window, recovers with a one-pole release, then is box-smoothed backwards over the same window,
    which keeps it at or below the required gain at every sample."""
    from scipy.ndimage import minimum_filter1d
    x = stereo(x).astype(np.float64)
    n = len(x)
    up = signal.resample_poly(x, os_factor, 1, axis=0)[:n * os_factor]
    pk = np.abs(up).max(axis=1).reshape(n, os_factor).max(axis=1)
    need = np.minimum(1.0, db(ceiling_db) / np.maximum(pk, 1e-9))
    L = max(1, secs(lookahead))
    g1 = minimum_filter1d(need, size=L + 1, origin=-(L // 2), mode="nearest")
    dec = 16
    nb = (n + dec - 1) // dec
    g1b = np.pad(g1, (0, nb * dec - n), constant_values=1.0).reshape(nb, dec).min(axis=1)
    a = math.exp(-dec / (release * SR))
    s = 1.0
    out = np.empty(nb)
    for i, v in enumerate(g1b):
        s = v if v < s else v + (s - v) * a
        out[i] = s
    g2 = np.minimum(g1, np.repeat(out, dec)[:n])
    g3 = np.convolve(g2, np.ones(L + 1) / (L + 1))[:n]
    g3[:L] = g2[:L]
    return (x * g3[:, None]).astype(np.float32)


# ------------------------------------------------------------------------------------------------ loudness
def k_weight(x):
    """ITU-R BS.1770 K-weighting (48 kHz coefficients)."""
    b1 = [1.53512485958697, -2.69169618940638, 1.19839281085285]
    a1 = [1.0, -1.69065929318241, 0.73248077421585]
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, -1.99004745483398, 0.99007225036621]
    y = signal.lfilter(b1, a1, x, axis=0)
    return signal.lfilter(b2, a2, y, axis=0)


def lufs_integrated(x):
    x = stereo(x).astype(np.float64)
    y = k_weight(x)
    blk, hop = secs(0.4), secs(0.1)
    ms = []
    for i in range(0, len(y) - blk + 1, hop):
        seg = y[i:i + blk]
        ms.append(np.sum(np.mean(seg ** 2, axis=0)))
    ms = np.array(ms)
    L = -0.691 + 10 * np.log10(ms + 1e-20)
    g1 = ms[L > -70]
    if len(g1) == 0:
        return -70.0
    rel = -0.691 + 10 * np.log10(g1.mean()) - 10
    g2 = ms[(L > -70) & (L > rel)]
    return float(-0.691 + 10 * np.log10(g2.mean()))


def short_term_lufs(x, win=3.0, hop=0.5):
    x = stereo(x).astype(np.float64)
    y = k_weight(x)
    blk, h = secs(win), secs(hop)
    out = []
    for i in range(0, max(1, len(y) - blk + 1), h):
        seg = y[i:i + blk]
        out.append((i / SR, -0.691 + 10 * np.log10(np.sum(np.mean(seg ** 2, axis=0)) + 1e-20)))
    return out


# ------------------------------------------------------------------------------------------------ I/O
def write_wav(path, x, bits=24):
    """Write float audio (n, 2) as PCM WAV (16 or 24 bit) at SR."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    x = np.clip(stereo(x), -1.0, 1.0 - 1e-7)
    if bits == 16:
        data = (x * 32767).round().astype("<i2").tobytes()
    else:
        v = (x * 8388607).round().astype(np.int32).reshape(-1)
        b = v.astype("<i4").view(np.uint8).reshape(-1, 4)[:, :3]
        data = b.tobytes()
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(bits // 8)
        w.setframerate(SR)
        w.writeframes(data)


def read_wav(path):
    with wave.open(path, "rb") as w:
        ch, sw, sr, n = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        raw = w.readframes(n)
    assert sr == SR, (path, sr)
    if sw == 2:
        x = np.frombuffer(raw, "<i2").astype(np.float32) / 32768
    elif sw == 3:
        b = np.frombuffer(raw, np.uint8).reshape(-1, 3)
        v = (b[:, 0].astype(np.int32) | (b[:, 1].astype(np.int32) << 8) | (b[:, 2].astype(np.int32) << 16))
        v = np.where(v >= 1 << 23, v - (1 << 24), v)
        x = v.astype(np.float32) / 8388608
    else:
        raise ValueError(sw)
    return x.reshape(-1, ch) if ch > 1 else stereo(x)


def save_stem(path, x):
    """Intermediate stems as float32 .npy (fast, lossless)."""
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    np.save(path, np.asarray(x, np.float32))
