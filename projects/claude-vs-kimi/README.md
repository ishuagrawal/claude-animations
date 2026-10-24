# Claude vs Kimi

A ~34-second comic-shaded 3D fight celebrating Kimi K3.1's launch, in the style of the "Eggman and Gerald Dance
Off" fan animation. Claude gets distilled into Kimi, they fight dead even (GPT-6 Astra and GPT-6.1 Sol never get a
spotlight), and Kimi wins the tiebreaker on price.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $23 — 0.31M output, 60.6M cache-read, 0.55M cache-write (1h), ~360 uncached input
  tokens at $4 / $20 per MTok in/out, $0.20 cache read, $8 cache write (1h)

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome) with WebGL.
macOS system fonts are used (Futura, Arial Rounded MT Bold, Songti SC, PingFang SC). From this folder:

```bash
npm install
```

```bash
node render/render.mjs --audio-only
```

```bash
node render/render.mjs --reuse-audio
```

Writes `out/claude-vs-kimi.mp4` (1920×1080, 24 fps, soundtrack synthesized in-browser). Optional flags:
`--from 10 --to 14` (partial render), `--stills 3.2,10.5` (PNG stills).

To preview live in a browser (space = play, ←/→ = step), serve this folder on the project's port:

```bash
npx serve -l 4104 .
```

then open http://localhost:4104/
