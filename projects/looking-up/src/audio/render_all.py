"""Render the whole soundtrack: sampler check -> score -> foley/ambience -> mix -> report.

    python3 src/audio/render_all.py            # everything (first run decodes and caches samples, ~1-2 min)
    python3 src/audio/render_all.py --no-check # skip the sampler pitch validation
Outputs in out/audio/: score.wav, foley.wav, ambience.wav, soundtrack.wav (final, 48 kHz 24-bit, 240.0 s),
spectrogram.png. Decoded samples, tuning measurements and stems are cached in cache/audio/."""
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def step(name, fn):
    t = time.time()
    print(f"== {name}")
    fn()
    print(f"   ({time.time() - t:.1f} s)")


def main():
    import sampler
    import score
    import foley
    import mix
    import report
    if "--no-check" not in sys.argv:
        def check():
            w = sampler.validate()
            assert w < 10.0, f"sampler pitch check failed ({w:.1f} cents)"
        step("sampler: C major scale pitch check (FFT)", check)
    step("score  -> out/audio/score.wav", score.main)
    step("foley  -> out/audio/foley.wav + ambience.wav", foley.main)
    step("mix    -> out/audio/soundtrack.wav", mix.main)
    step("report", report.main)


if __name__ == "__main__":
    main()
