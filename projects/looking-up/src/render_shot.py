"""Render one shot from the cue sheet.

  blender -b --python src/render_shot.py -- S01 [--preview] [--still 2.5] [--frames a-b] [--save]

Frames are written to out/frames/<shot>/f_<global frame>.png (global numbering = position in the film)."""
import sys, os, time, importlib
SRC = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SRC)
import bpy
import timeline as TL
from lu import scene, post, anim
from lu.paths import OUT

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
name = argv[0]
preview = "--preview" in argv
animatic = "--anim" in argv
save = "--save" in argv
still = float(argv[argv.index("--still") + 1]) if "--still" in argv else None
stills = [float(x) for x in argv[argv.index("--stills") + 1].split(",")] if "--stills" in argv else None
fr = argv[argv.index("--frames") + 1] if "--frames" in argv else None

t0 = time.time()
sc = scene.reset()
f0, f1 = TL.shot_frames(name)
sc.frame_start, sc.frame_end = f0, f1 - 1
mod = importlib.import_module(f"shots.{name.lower()}")
ctx = mod.make(f0, f1)          # builds the world, characters, camera, keys; returns dict with 'post'
from lu import finish, world as _world
finish.apply(ctx, _world.World.current.kind if _world.World.current else "ext")
post.setup(**ctx.get("post", {}))
if animatic:
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.render.resolution_percentage = 40
    sh = sc.display.shading
    sh.light = "STUDIO"
    sh.color_type = "MATERIAL"
    sc.render.use_compositing = False
    sc.render.use_motion_blur = False
elif preview:
    sc.render.resolution_percentage = 50
    sc.eevee.taa_render_samples = 16
else:
    sc.eevee.taa_render_samples = ctx.get("samples", int(os.environ.get("LU_SAMPLES", "48")))
print("BUILD", round(time.time() - t0, 1), "s")
outdir = os.path.join(OUT, "frames" + ("_anim" if animatic else "_preview" if preview else ""), name)
os.makedirs(outdir, exist_ok=True)
if save:
    os.makedirs(os.path.join(OUT, "blend"), exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "blend", f"{name}.blend"))
if stills is not None:
    paths = []
    for st in stills:
        sc.frame_set(f0 + int(round(st * TL.FPS)))
        pth = os.path.join(outdir, f"still_{st:05.2f}.png")
        scene.render_still(pth)
        paths.append(pth)
    # contact sheet
    import subprocess
    sheet = os.path.join(outdir, "sheet.png")
    n = len(paths)
    cols = 2 if n > 1 else 1
    args = []
    for pth in paths:
        args += ["-i", pth]
    w = 960
    fc = "".join(f"[{i}:v]scale={w}:-1[v{i}];" for i in range(n))
    if n == 1:
        fc += "[v0]copy"
    else:
        rows = (n + cols - 1) // cols
        lay = "|".join(f"{(i % cols) * w}_{(i // cols)}*h0".replace("*h0", "") for i in range(n))
        lay = "|".join(f"{'w0' if i % cols else '0'}_{'+'.join(['h0'] * (i // cols)) if i // cols else '0'}" for i in range(n))
        if n % cols:
            fc += f"color=black:s={w}x{int(w * 816 / 1920)}[pad];"
            lay += f"|w0_{'+'.join(['h0'] * (n // cols))}"
            fc += "".join(f"[v{i}]" for i in range(n)) + f"[pad]xstack=inputs={n + 1}:layout={lay}"
        else:
            fc += "".join(f"[v{i}]" for i in range(n)) + f"xstack=inputs={n}:layout={lay}"
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + ["-filter_complex", fc, "-frames:v", "1", sheet])
    print("SHEET", sheet)
elif still is not None:
    sc.frame_set(f0 + int(round(still * TL.FPS)))
    scene.render_still(os.path.join(outdir, f"still_{still:05.2f}.png"))
else:
    if fr:
        a, b = [int(x) for x in fr.split("-")]
        sc.frame_start, sc.frame_end = f0 + a, min(f0 + b, f1 - 1)
    sc.render.filepath = os.path.join(outdir, "f_")
    t1 = time.time()
    bpy.ops.render.render(animation=True)
    n = sc.frame_end - sc.frame_start + 1
    print("RENDER", round(time.time() - t1, 1), "s", round((time.time() - t1) / n, 2), "s/frame")
    if animatic:
        import subprocess
        mp4 = os.path.join(OUT, "anim", f"{name}.mp4")
        os.makedirs(os.path.dirname(mp4), exist_ok=True)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", "24", "-start_number", str(sc.frame_start), "-i",
                        os.path.join(outdir, "f_%04d.png"), "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", mp4])
        print("ANIM", mp4)
