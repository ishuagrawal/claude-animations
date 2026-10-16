# Skills Star Party

An 8-second celebration of 70 stars on [ishuagrawal/skills](https://github.com/ishuagrawal/skills): GitHub's
Invertocat turns into the official Octocat, Claude hops in, and the two cheer the count and the `video-by-reference` skill.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $61 for the whole session (all four versions) — 0.72M output, 161M cache-read,
  1.67M cache-write (1h), ~800 uncached input tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome). The star count is
`STARS` in `src/timeline.js`. From this folder:

```bash
npm install
```

```bash
node render/render.mjs --audio-only
```

```bash
node render/render.mjs --reuse-audio
```

Writes `out/skills-star-party.mp4` (1920×1080, 60 fps, soundtrack synthesized in-browser). Optional flags:
`--from 3 --to 5` (partial render), `--stills 1.2,4.0` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4104 ../..
```

then open http://localhost:4104/projects/skills-star-party/
