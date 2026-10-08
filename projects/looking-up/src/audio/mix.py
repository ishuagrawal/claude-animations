"""Final mix: score + foley + ambience -> out/audio/soundtrack.wav (48 kHz, 24-bit stereo, exactly 240.0 s).

Music automation from cues.py (ducking under key effects, hard mutes at smash cuts), bus EQ/compression, master
limiter (true-peak aware) and loudness normalisation to the target integrated loudness. Quiet passages are never
lifted separately: one static master gain is applied, so the film's dynamics survive."""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import cues  # noqa: E402
import dsp  # noqa: E402
from dsp import SR  # noqa: E402

PROJECT = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(PROJECT, "out", "audio")
CACHE = os.path.join(PROJECT, "cache", "audio")
TARGET_LUFS = -15.0
CEILING_DBTP = -1.3
BUS_DB = {"music": 0.0, "foley": -1.0, "ambience": 0.0}


def automation(n):
    """Music gain curve (linear) from DUCK and MUTE."""
    t = np.arange(n) / SR
    gdb = np.zeros(n, np.float32)
    for (t0, depth, att, hold, rel) in cues.DUCK:
        d = np.zeros(n, np.float32)
        a, b, c = t0 - att, t0 + hold, t0 + hold + rel
        i0, i3 = max(0, int(a * SR)), min(n, int(c * SR) + 1)
        tt = t[i0:i3]
        d[i0:i3] = np.interp(tt, [a, t0, b, c], [0.0, depth, depth, 0.0])
        gdb = np.minimum(gdb, d)
    g = dsp.db(gdb).astype(np.float32)
    for (t0, t1, f) in cues.MUTE:
        m = np.interp(t, [t0 - f, t0, t1, t1 + f], [1.0, 0.0, 0.0, 1.0]).astype(np.float32)
        g *= m
    return g


def load(name, n):
    x = dsp.read_wav(os.path.join(OUT, name))
    out = np.zeros((n, 2), np.float32)
    out[:min(n, len(x))] = x[:n]
    return out


def mix_buses(n):
    music = load("score.wav", n)
    foley = load("foley.wav", n)
    amb = load("ambience.wav", n)
    music *= automation(n)[:, None]
    # bus processing
    music = dsp.eq(music, [("hp", 30, 0.7, 0), ("peak", 3200, 1.0, 0.8), ("highshelf", 7000, 0.7, 1.5)])
    # music: slow leveller on the loudest passages only (quiet scenes sit far below the threshold), then peak taming
    music, _ = dsp.compress(music, thresh_db=-24.0, ratio=2.0, attack=0.08, release=0.6, knee_db=8.0)
    music, _ = dsp.compress(music, thresh_db=-12.0, ratio=4.0, attack=0.003, release=0.1, knee_db=4.0)
    foley = dsp.eq(foley, [("hp", 40, 0.7, 0), ("hp", 40, 0.7, 0), ("peak", 4500, 1.2, 1.0)])
    foley, _ = dsp.compress(foley, thresh_db=-14.0, ratio=3.0, attack=0.001, release=0.1, knee_db=4.0)
    amb = dsp.eq(amb, [("hp", 60, 0.7, 0), ("lowshelf", 180, 0.7, -3.0)])
    amb[:int(1.5 * SR)] *= np.linspace(0, 1, int(1.5 * SR))[:, None] ** 2          # the film fades up from silence
    return {"music": music * dsp.db(BUS_DB["music"]), "foley": foley * dsp.db(BUS_DB["foley"]),
            "ambience": amb * dsp.db(BUS_DB["ambience"])}


def master(x, fade_out=3.0):
    n = len(x)
    x = dsp.hp(x, 22.0, order=2)
    # end-of-film fade (last 3 s), equal-power
    k = int(fade_out * SR)
    x[n - k:] *= np.cos(np.linspace(0, np.pi / 2, k))[:, None] ** 1.2
    # static gain so that the limited result hits the target loudness (2 refinement passes)
    gain = 0.0
    for _ in range(3):
        y = dsp.limiter(x * dsp.db(gain), ceiling_db=CEILING_DBTP)
        L = dsp.lufs_integrated(y)
        gain += TARGET_LUFS - L
    y = dsp.limiter(x * dsp.db(gain), ceiling_db=CEILING_DBTP)
    return y, gain


def main():
    n = int(round(cues.DURATION * SR))
    buses = mix_buses(n)
    pre = buses["music"] + buses["foley"] + buses["ambience"]
    out, gain = master(pre)
    out = out[:n]
    assert len(out) == n
    dsp.write_wav(os.path.join(OUT, "soundtrack.wav"), out)
    # keep the master gain + bus versions for the report
    for k, v in buses.items():
        dsp.save_stem(os.path.join(CACHE, "buses", f"{k}.npy"), v * dsp.db(gain))
    print(f"soundtrack.wav: {n / SR:.3f} s, master gain {gain:+.2f} dB, "
          f"integrated {dsp.lufs_integrated(out):.2f} LUFS (internal), true peak {dsp.true_peak_db(out):.2f} dBTP")


if __name__ == "__main__":
    main()
