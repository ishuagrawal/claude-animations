# Claude & the Tool Squad

A faux 90s-anime TV opening: tiny Claude sets out across the codebase land with a squad of
tool-creatures (Read, WebFetch, Edit, Write, Bash), throws a prompt token that splits into
parallel subagents, and turns a stadium scoreboard from all-red to all-green.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $21 — 0.32M output, 50.8M cache-read, 0.55M cache-write (1h), ~300
  uncached input tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Google Chrome (or Playwright's `chrome-headless-shell`).
No npm install needed. From this folder:

```bash
node render/render.mjs --audio-only
node render/render.mjs --reuse-audio
```

Writes `out/claude-tool-squad.mp4` (1920×1080, 24 fps, soundtrack synthesized in-browser).
Optional: `--from 20 --to 26` (partial render), `--stills 3.2,10.5` (PNG stills).

To preview live (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4102 ../..
```

then open http://localhost:4102/projects/claude-tool-squad/
