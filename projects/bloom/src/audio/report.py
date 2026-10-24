"""Measurement report for the rendered soundtrack: ffmpeg EBU R128 loudness + true peak, per-shot and per-section
RMS (mix and buses), clipping/DC/rumble checks, and a spectrogram PNG (out/audio/spectrogram.png)."""
import os
import re
import subprocess
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

def ffmpeg_loudness(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-filter_complex", "ebur128=peak=true",
                        "-f", "null", "-"], capture_output=True, text=True)
    txt = r.stderr[r.stderr.rfind("Summary:"):]
    get = lambda pat: float(re.search(pat, txt, re.S).group(1))
    return dict(I=get(r"I:\s+(-?[\d.]+) LUFS"), LRA=get(r"LRA:\s+(-?[\d.]+) LU"), TP=get(r"Peak:\s+(-?[\d.]+) dBFS"))


def ffmpeg_loudnorm(path):
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", path, "-af", "loudnorm=print_format=json", "-f",
                        "null", "-"], capture_output=True, text=True)
    js = r.stderr[r.stderr.rfind("{"):r.stderr.rfind("}") + 1]
    d = dict(re.findall(r'"(\w+)"\s*:\s*"([^"]*)"', js))
    return {k: float(d[k]) for k in ("input_i", "input_tp", "input_lra", "input_thresh")}


def spectrogram(path, png):
    subprocess.run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-i", path, "-lavfi",
                    "showspectrumpic=s=2400x900:mode=combined:color=intensity:scale=log:fscale=log:legend=1:gain=1",
                    png], check=True)


def limiter_stats(out):
    """Gain reduction of the master limiter: pre-limiter sum of the buses (already at master gain) vs output,
    in 10 ms blocks (end fade excluded)."""
    try:
        pre = sum(np.asarray(np.load(os.path.join(CACHE, "buses", f"{k}.npy"))) for k in ("music", "foley", "ambience"))
    except FileNotFoundError:
        return None
    pre = dsp.hp(pre, 22.0, order=2)
    n = min(len(pre), len(out), int((cues.DURATION - getattr(cues, "FADE_OUT", 3.0) - 0.2) * SR))
    blk = 480
    nb = n // blk
    a = np.abs(pre[:nb * blk]).max(axis=1).reshape(nb, blk).max(axis=1)
    b = np.abs(out[:nb * blk]).max(axis=1).reshape(nb, blk).max(axis=1)
    gr = np.where(a > 0.05, 20 * np.log10(np.maximum(a, 1e-9) / np.maximum(b, 1e-9)), 0.0)
    return float(gr.max()), float((gr > 1).sum() * 0.01), float((gr > 3).sum() * 0.01)


def _onsets(x):
    """1 ms-resolution onset strength: level rise (dB) of a 5 ms RMS envelope over 30 ms."""
    m = np.abs(np.asarray(x)).max(axis=1)
    env = np.sqrt(np.convolve(m ** 2, np.ones(240) / 240, mode="same"))[::48] + 1e-6
    ld = 20 * np.log10(env)
    return np.concatenate([np.zeros(30), ld[30:] - ld[:-30]])


def sync_check(buses, win=0.06):
    """Measured sync: at each named picture event, the strongest onset (level jump over 30 ms) within +-60 ms in the
    music bus and in the foley bus. Sync events where the sound is a sustained swell/continuation rather than an
    attack show small jumps by design."""
    if "music" not in buses:
        return
    S = cues.SYNC
    pts = [(k, v) for k, v in S.items() if not isinstance(v, list)]
    pts += [(f"{k}{i + 1}", t) for k, v in S.items() if isinstance(v, list) for i, t in enumerate(v)]
    pts.sort(key=lambda kv: kv[1])
    ons = {k: _onsets(buses[k]) for k in ("music", "foley") if k in buses}
    print("\nsync check (strongest onset within +-60 ms of each picture event: offset ms / jump dB)")
    w = int(win * 1000)
    for name, t in pts:
        i = int(round(t * 1000))
        cells = []
        for k, o in ons.items():
            seg = o[max(0, i - w):i + w]
            j = int(np.argmax(seg))
            cells.append(f"{k} {j - min(i, w):+4d} ms {seg[j]:+5.1f} dB")
        print(f"  {name:10s} {t:7.3f} s   " + "   ".join(cells))


def rms(x):
    return dsp.rms_db(x) if len(x) else -200.0


def main():
    path = os.path.join(OUT, "soundtrack.wav")
    x = dsp.read_wav(path)
    n = len(x)
    print(f"file: {path}\n  duration {n / SR:.4f} s ({n} samples @ {SR} Hz), channels {x.shape[1]}")
    L = ffmpeg_loudness(path)
    LN = ffmpeg_loudnorm(path)
    print(f"  ffmpeg ebur128 : integrated {L['I']:.1f} LUFS, LRA {L['LRA']:.1f} LU, true peak {L['TP']:.1f} dBFS")
    print(f"  ffmpeg loudnorm: integrated {LN['input_i']:.2f} LUFS, true peak {LN['input_tp']:.2f} dBTP, "
          f"LRA {LN['input_lra']:.1f} LU")
    print(f"  sample peak {dsp.to_db(np.abs(x).max()):.2f} dBFS, clipped samples {(np.abs(x) >= 0.9999).sum()}, "
          f"DC L/R {x[:, 0].mean():+.5f}/{x[:, 1].mean():+.5f}")
    lim = limiter_stats(x)
    if lim:
        print(f"  limiter gain reduction: max {lim[0]:.1f} dB, >1 dB for {lim[1]:.1f} s, >3 dB for {lim[2]:.1f} s")
    sub = dsp.lp(x, 25, order=4)
    print(f"  sub-25 Hz energy {rms(sub) - rms(x):.1f} dB rel. to full band (rumble check)")
    buses = {}
    for k in ("music", "foley", "ambience"):
        p = os.path.join(CACHE, "buses", f"{k}.npy")
        if os.path.exists(p):
            buses[k] = np.load(p, mmap_mode="r")

    def row(t0, t1):
        a, b = int(t0 * SR), int(t1 * SR)
        seg = x[a:b]
        vals = [rms(seg), float(dsp.to_db(np.abs(seg).max()))]
        vals += [rms(np.asarray(buses[k][a:b])) for k in ("music", "foley", "ambience") if k in buses]
        st = dsp.short_term_lufs(seg, win=min(3.0, (t1 - t0) * 0.99), hop=0.5) if t1 - t0 > 0.5 else [(0, -70)]
        vals.append(max(v for _, v in st))
        return vals

    hdr = f"{'':26s}{'mix RMS':>9s}{'peak':>7s}{'music':>8s}{'foley':>8s}{'amb':>8s}{'maxST':>8s}"
    print("\nper-section (dBFS RMS / peak; buses after master gain, before limiter; max short-term LUFS)")
    print(hdr + "   intent")
    for (lab, t0, t1, intent) in cues.SECTIONS:
        v = row(t0, t1)
        print(f"{lab:26s}" + "".join(f"{u:8.1f} " if i else f"{u:8.1f} " for i, u in enumerate(v)) + f"  {intent}")
    print("\nper-shot")
    print(hdr)
    for (name, *_r) in cues.SHOTS:
        v = row(cues.start(name), cues.end(name))
        print(f"{name:26s}" + "".join(f"{u:8.1f} " for u in v))
    print("\nsilence checks (RMS dBFS)")
    for lab, t0, t1, bus in cues.SILENCE_CHECKS:
        a, b = int(t0 * SR), int(t1 * SR)
        mus = rms(np.asarray(buses["music"][a:b])) if "music" in buses else float("nan")
        print(f"  {lab:36s} mix {rms(x[a:b]):6.1f}   music {mus:6.1f}   ({t0:.2f}-{t1:.2f} s)")
    sync_check(buses)
    png = os.path.join(OUT, "spectrogram.png")
    spectrogram(path, png)
    print(f"\nspectrogram: {png}")


if __name__ == "__main__":
    main()
