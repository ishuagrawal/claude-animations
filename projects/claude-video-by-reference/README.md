# Claude: Video by Reference

A cute, ~60-second flat-2D explainer (in the style of Yum Yum Videos' explainer reel) showing how the
`video-by-reference` skill works: hand Claude a video you love, and it studies every frame, keeps the
style, invents a new story, animates it in code, scores it, and hands back a brand-new film.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $21 — 0.29M output, 53.2M cache-read, 0.55M cache-write (1h), ~300 uncached
  input tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome).
No npm install needed. From this folder:

```bash
node render/render.mjs --audio-only
```

```bash
node render/render.mjs --reuse-audio
```

Writes `out/claude-video-by-reference.mp4` (1920×1080, 30 fps, soundtrack synthesized in-browser).
Optional flags: `--from 10 --to 14` (partial render), `--stills 3.2,10.5` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4103 ../..
```

then open http://localhost:4103/projects/claude-video-by-reference/
