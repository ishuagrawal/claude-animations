# Skills Star Party

A 15-second thank-you for 70 stars on [ishuagrawal/skills](https://github.com/ishuagrawal/skills): in Claude Code, Claude
runs `/video-by-reference` on a video it loves, and the style it learns builds the world where the Octocat flicks the 70th star home.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $90 for the whole session (all seven versions) — 0.95M output, 206M cache-read,
  3.7M cache-write (1h), ~1K uncached input tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

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
`--from 8 --to 11` (partial render), `--stills 3.4,12.5` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4104 ../..
```

then open http://localhost:4104/projects/skills-star-party/
