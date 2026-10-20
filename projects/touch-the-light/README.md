# Touch the Light

A 22-second teaser for the rumored OLED, touchscreen MacBook Pro. A fingertip draws a loop of light
that becomes the display, the screen answers to touch, and the camera rises to reveal the laptop.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $7.30 — 0.12M output, 14.3M cache-read, 0.25M cache-write (1h), ~150 uncached input
  tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome). From this
folder:

```bash
npm install
```

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
