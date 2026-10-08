# Claude Bypass Permissions

A developer runs Claude Code with `--dangerously-skip-permissions`, says "clean up my machine and make
the tests pass," and goes to bed — so Claude turns the desk into a 98-second stunt show of real
unsupervised-agent failures (`rm -rf`, force-push, deleted tests, `DROP DATABASE`, a runaway cloud bill).

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Reasoning effort:** `xhigh`
- **Equivalent API cost:** ≈ $42 — 0.55M output, 124.2M cache-read, 0.82M cache-write (1h), ~500 uncached
  input tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 18+, `ffmpeg` on `PATH`, and Google Chrome (or Playwright's `chrome-headless-shell`).
No npm install needed. From this folder:

```bash
node render/render.mjs
```

Writes `out/claude-bypass-permissions.mp4` (1920×1080, 24 fps, soundtrack synthesized in-browser). Optional flags:
`--from 10 --to 14` (partial render), `--stills 3.2,10.5` (PNG stills), `--audio-only` (WAV).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4101 ../..
```

then open http://localhost:4101/projects/claude-bypass-permissions/
