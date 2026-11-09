![The Spark: the Spark meets Claude inside the processor](preview.png)

# The Spark

Someone asks Claude for a poem about a spark, and one wakes in the wall outlet: it rides the cord, the power supply
and the motherboard to find Claude asleep inside the processor, and the answer flies back as a flock of light.
A wordless ~93-second 3D short in the painterly style of *The Wild Robot*, made with the
[video-by-reference skill](https://github.com/ishuagrawal/skills/tree/main/skills/video-by-reference).

## Generate the video

Requires Node 22+, `ffmpeg` on `PATH`, and Playwright's `chrome-headless-shell` (or Google Chrome) with WebGL 2
(software rendering works). From this folder:

```bash
npm install
```

```bash
node render/render.mjs --audio-only
```

```bash
node render/render.mjs --reuse-audio
```

Writes `out/the-spark.mp4` (1920×1080, 2.39:1 picture, 24 fps, soundtrack synthesized in-browser). The picture is
about 2–3 s per frame on a CPU, so the full film takes around two hours. Optional flags: `--from 40 --to 47`
(partial render to `out/preview.mp4`), `--stills 44,60.6 --still-scale 0.5` (PNG stills), `--query only=chip`
(load one set).

To preview live in a browser (space = play, ←/→ = step), serve the repo root on this project's port:

```bash
npx serve -l 4107 ../..
```

then open http://localhost:4107/projects/the-spark/
