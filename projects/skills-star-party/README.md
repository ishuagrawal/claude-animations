# Skills Star Party

A 26-second product-marketing milestone video for 70 stars on [ishuagrawal/skills](https://github.com/ishuagrawal/skills):
GitHub's app icon comes alive as the Octocat, opens the repo's milestone page, and a live cursor stars and installs it.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $45 — 0.59M output, 119M cache-read, 1.09M cache-write (1h), ~600 uncached input
  tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome). The star and
fork counts are `STARS` / `FORKS` in `src/timeline.js`. From this folder:

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
`--from 10 --to 14` (partial render), `--stills 3.2,10.5` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4104 ../..
```

then open http://localhost:4104/projects/skills-star-party/
