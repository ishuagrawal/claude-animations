# Touch the Light

A 19-second teaser for the rumored OLED, touchscreen MacBook Pro, told only in hints: one soft brush stroke
of light, moved by fingertip gestures, parts round a hidden island, rubber-bands, folds into a single
pixel, opens like a lid, and pours out the light that leaves the logo in true black.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $11.40 for the whole session (both versions) — 0.19M output, 24.2M cache-read,
  0.34M cache-write (1h), ~200 uncached input tokens at $4 / $20 per MTok in/out, $0.20 cache read,
  $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome). No npm
install needed. From this folder:

```bash
node render/render.mjs --audio-only
```

```bash
node render/render.mjs --reuse-audio
```

Writes `out/touch-the-light.mp4` (1080×1080, 30 fps, soundtrack synthesized in-browser). Optional flags:
`--from 8 --to 11` (partial render), `--stills 3.4,12.5` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4105 ../..
```

then open http://localhost:4105/projects/touch-the-light/
