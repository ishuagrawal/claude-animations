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

SECTIONS = [   # (label, start bar, end bar, intent)
    ("S01 dusk establishing", 1, 3.5, "quiet"), ("S02-S04 routine", 3.5, 7.75, "quiet"),
    ("S05 constellation", 7.75, 9.5, "soft swell"), ("S06 sleep", 9.5, 10.5, "near-silence"),
    ("S07 meteors", 10.5, 11.5, "rising"), ("S08 crash", 11.5, 12.25, "BIG hit"), ("S09 creeping", 12.25, 13.75, "tense"),
    ("S10-S12 reveal/hiss/offer", 13.75, 17.5, "fragile"), ("S13 dawn trust", 17.5, 19, "soft"),
    ("M01-M05 montage I", 19, 25.75, "warm, building"), ("M06 goodnight", 25.75, 27.25, "intimate"),
    ("M07-M10 montage II", 27.25, 33, "varied"), ("M11 montage climax", 33, 35, "LOUD"),
    ("D01-D04 dimming", 35, 41.5, "sparse"), ("H01-H02 the pull", 41.5, 43.75, "rising"),
    ("H03 shutters/music box", 43.75, 45.25, "cut to almost nothing"), ("H04 the sky", 45.25, 46.25, "huge swell"),
    ("H05 silence", 46.25, 48.5, "SILENCE"), ("L01-L03 resolve/launch", 48.5, 53.5, "building"),
    ("L04-L05 storm", 53.5, 57, "intense"), ("L06 above the clouds", 57, 60, "tender, quiet"),
    ("L07 ignition", 60, 61.5, "LOUDEST"), ("L08 guided home", 61.5, 63.5, "dark -> warm"),
    ("C01 spring", 63.5, 66, "gentle"), ("C02 night blinks", 66, 69, "intimate"), ("C03 final", 69, 73, "warm, fade"),
]


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
    n = min(len(pre), len(out), int((cues.DURATION - 3.2) * SR))
    blk = 480
    nb = n // blk
    a = np.abs(pre[:nb * blk]).max(axis=1).reshape(nb, blk).max(axis=1)
    b = np.abs(out[:nb * blk]).max(axis=1).reshape(nb, blk).max(axis=1)
    gr = np.where(a > 0.05, 20 * np.log10(np.maximum(a, 1e-9) / np.maximum(b, 1e-9)), 0.0)
    return float(gr.max()), float((gr > 1).sum() * 0.01), float((gr > 3).sum() * 0.01)


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
    for (lab, b0, b1, intent) in SECTIONS:
        v = row(cues.bar(b0), cues.bar(b1))
        print(f"{lab:26s}" + "".join(f"{u:8.1f} " if i else f"{u:8.1f} " for i, u in enumerate(v)) + f"  {intent}")
    print("\nper-shot")
    print(hdr)
    for (name, a, b, _d) in cues.SHOTS:
        v = row(cues.bar(a), cues.bar(b))
        print(f"{name:26s}" + "".join(f"{u:8.1f} " for u in v))
    print("\nsilence checks (mix RMS dBFS)")
    for lab, t0, t1 in (("H05 silence (room tone only)", cues.end("H04") + 0.05, cues.SYNC["H05_drop"] + 3.9),
                        ("L06 smash to silence", cues.end("L05") + 0.05, cues.end("L05") + 1.5),
                        ("S06 near-silence", cues.start("S06"), cues.end("S06") - 0.8)):
        a, b = int(t0 * SR), int(t1 * SR)
        mus = rms(np.asarray(buses["music"][a:b])) if "music" in buses else float("nan")
        print(f"  {lab:32s} mix {rms(x[a:b]):6.1f}   music {mus:6.1f}")
    png = os.path.join(OUT, "spectrogram.png")
    spectrogram(path, png)
    print(f"\nspectrogram: {png}")


if __name__ == "__main__":
    main()
