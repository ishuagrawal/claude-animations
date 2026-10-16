# Skills Star Party

A 14-second celebration of 70 stars on [ishuagrawal/skills](https://github.com/ishuagrawal/skills): Claude studies a video
it loves with the `video-by-reference` skill and claps "action" on a short where the Octocat flicks the 70th star home.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $73 for the whole session (all five versions) — 0.79M output, 184M cache-read,
  2.4M cache-write (1h), ~900 uncached input tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

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
`--from 6 --to 9` (partial render), `--stills 2.8,8.3` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4104 ../..
```

then open http://localhost:4104/projects/skills-star-party/
