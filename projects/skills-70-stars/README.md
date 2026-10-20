# Seventy (skills-70-stars)

A ~39-second thank-you for 70+ stars on [ishuagrawal/skills](https://github.com/ishuagrawal/skills) in the style of allkustom's
IKEA "Together" motion piece: the 70th star lands, and Claude throws a party that `video-by-reference` restyles with every reference it's handed.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $26 — 0.27M output, 81M cache-read, 0.56M cache-write (1h), ~440 uncached input tokens
  at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome). From this folder:

```bash
npm install
```

```bash
node render/render.mjs --audio-only
```

```bash
node render/render.mjs --reuse-audio
```

Writes `out/skills-70-stars.mp4` (1920×1080, 24 fps, soundtrack synthesized in-browser). Optional flags:
`--from 8 --to 12` (partial render), `--stills 8.4,21.0` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4105 ../..
```

then open http://localhost:4105/projects/skills-70-stars/
