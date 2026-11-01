# Grok Bot — now has taste

A ~24-second showcase of a Grok Bot skill that finds the top design posts on X: Grok Bot turns into the X search
bar, searches "top design posts", and retrieves 12 creators' UI, motion and visual work, ending on the Grok Bot end
card with "now has taste".

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $24 — 0.32M output, 64.6M cache-read, 0.56M cache-write (1h), ~470 uncached input
  tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, Playwright's `chrome-headless-shell` (or Google Chrome), and macOS's SF Pro
fonts. Source media is not in the repo: a folder of the creators' clips named after their X handles
(`cerpow.mp4`, `zarazhangrui.mp4`, … `nono_ai_archive.jpeg`, see `src/clips.js`) and the Grok Bot reference film.
From this folder:

```bash
node render/prep.mjs --sources ~/Desktop/sources --ref ~/Desktop/M9VKUr0ZYmdggYB6.mp4
```

```bash
node render/render.mjs
```

Writes `out/grok-taste-bot.mp4` (1920×1080, 30 fps, soundtrack synthesized in-browser). Optional flags:
`--stills 1.2,5` (PNG stills), `--from 10 --to 14` (partial render), `--no-audio`.

To preview live (space = play, ←/→ = step):

```bash
npx serve -l 4106 .
```

then open http://localhost:4106/
