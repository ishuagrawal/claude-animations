![The whole tapestry, with one square still unwoven](preview.png)

# One Thread

A red-gold thread runs through nineteen cultures, and every square it crosses is made in that people's own technique,
from papyrus, kente and batik to wampum, felt and sashiko. At the end the whole tapestry appears, with one square left to weave.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $112 for the main session and its 6 subagents: 1.80M output, 145.5M cache-read, 1.22M cache-write
  (1h) and 7.54M cache-write (5m) tokens, at $4 / $20 per MTok in/out, $0.20 cache read and $8 / $5 cache write (1h / 5m)

## Generate the video

Requires macOS with Node 22+, `ffmpeg` on `PATH`, Playwright's `chrome-headless-shell` (or Google Chrome), `/usr/bin/python3`
with `numpy` and `scipy`, and the GarageBand / Logic sound library (sampled strings, horns, bass). From this folder:

```bash
node render/cues.mjs
```

```bash
/usr/bin/python3 src/audio/score.py
```

```bash
node render/render.mjs --jobs 2
```

Writes `out/one-thread.mp4` (1920×1080, 24 fps). `--h 2160 --jobs 1` renders 4K (checked as stills only), `--from 20 --to 25` a part,
`--stills 20,33` single frames, and `--panel japan --t 4 --view full` one square of the tapestry.

To preview live (space = play, ←/→ = step):

```bash
npx serve -l 4109 .
```

then open http://localhost:4109/
