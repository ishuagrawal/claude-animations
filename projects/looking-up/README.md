# Looking Up

A lonely miller (Claude) in a windmill above a sea of clouds takes in a tiny star that fell from the sky, and raises
it until it has to be let go. A wordless 4-minute 3D short made in the painterly style of *The Wild Robot*.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code
- **Equivalent API cost:** ≈ $200: 0.77M output, 708M cache-read, 6.2M cache-write (5m) and 1.3M cache-write (1h)
  tokens across the main session and its 5 subagents, at $4 / $20 per MTok in/out, $0.20 cache read and $5 / $8 cache
  write (5m / 1h)

## Generate the video

Prerequisites (macOS):
- Blender 5.1 at `/Applications/Blender.app` (EEVEE renders headless; Metal GPU recommended)
- `ffmpeg` on `PATH`
- `python3` with `numpy`, `scipy` and `Pillow` (the audio uses the macOS system `/usr/bin/python3`)
- GarageBand / Logic sound library installed (`/Library/Application Support/Logic` and
  `/Library/Application Support/GarageBand`) for the sampled piano and strings

From this folder:

```bash
python3 src/render_all.py
```

Renders all 44 shots into `out/frames/` (about 3.5 h at the default 24 samples on an M5 Pro; brush textures are
generated into `cache/` on first run). Re-running skips finished shots.

```bash
/usr/bin/python3 src/audio/render_all.py
```

Builds the score, foley and mix into `out/audio/soundtrack.wav`.

```bash
python3 src/assemble.py
```

Writes `out/looking-up.mp4` (1920×1080, 24 fps, 2.35:1 letterbox, H.264 + AAC) with the title cards.

Single shots, previews and animatics: `/Applications/Blender.app/Contents/MacOS/Blender -b --python
src/render_shot.py -- M11 [--preview --stills 1.0,3.0] [--anim]`.
