"""Environment look-dev for BLOOM: the world, its phases and FX at the film's key environment beats.

  Blender -b --python src/lookdev_env.py -- [a,b,c,d,d2,e,f,f2,g] [--full] [--samples N] [--save]

Renders (half resolution unless --full; 16 samples, 24 with --full) into out/lookdev_env/<view>.png, then a contact
sheet (sheet.png) and a reference comparison (compare.png, next to ref/frames/tileA..C):
  a   B01  the burnt valley wide: charred forest, ash snow, smoke columns, the peak with its patch of sun
  b   B02  the stump close-up: charred home tree, door-hole, rope swing; Claude (block) kneeling at SEED
  b2  B03/B04  ground level at SEED: the ash, cinders and embers at the stump's roots (close range)
  c   B05  the violet storm wall rolling over the west ridge, lightning inside, ash whipped by the gust
  d   B13  wide: the mountainside under hail and rain, tiny Claude curled at HAIL_SPOT
  d3  B11  low angle under the LEDGE: the ~1.15 m strata step against the storm, rain, lightning
  d2  B12  close: hail smashing into the rock and bouncing round curled Claude, chips flying
  e   B16  the beam: the storm torn open, one golden shaft striking the summit, motes
  f0  B18  the wave leaving the summit (ground level, 0.6 s in: grass and flowers springing up, petals swirling)
  f   B18  the bloom mid-wave (crane above the summit looking down the valley)
  f2  B18  fully bloomed (same camera, wave past)
  g   B20  the coda summit: golden afternoon
  h   B18/B19  the bloomed valley from the foot of the mountain (blossoming forest, meadow)
An orange block stands in for Claude at the marks so the scale reads."""
import sys, os, time, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
import numpy as np
from mathutils import Vector
from lu import scene, world, fx, post, layout, sky, envmat, mat, terrain
from lu.paths import OUT, PROJECT

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
views = argv[0].split(",") if argv and not argv[0].startswith("--") else ["a", "b", "c", "d", "d2", "e", "f", "f2", "g"]
full = "--full" in argv
samples = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else (24 if full else 16)
save = "--save" in argv
outdir = os.path.join(OUT, "lookdev_env")
os.makedirs(outdir, exist_ok=True)
F0, F1 = 1, 120
FR = 48


def placeholder(at, heading=0.0, pose="stand", name="ClaudeBlock"):
    """An orange block with four legs and two dark eyes (Claude's scale: 0.7 m wide, ~0.69 m tall)."""
    from lu import geo
    m = bpy.data.materials.get("PH_Orange") or mat.painterly("PH_Orange", (0.70, 0.18, 0.10), stroke="strokes_soft",
                                                             scale=1.5, tex_amt=0.5, snow=0.0, rim=0.3)
    e = bpy.data.materials.get("PH_Eye") or mat.painterly("PH_Eye", (0.01, 0.01, 0.012), snow=0.0, spec=0.8, rough=0.2)
    parts = []
    if pose == "curl":
        parts.append(geo.rounded_box("PHBody", (0.72, 0.62, 0.42), 0.08, collection=geo.coll("PH"), mat=m,
                                     center=(0, 0, 0.21)))
    elif pose == "kneel":
        parts.append(geo.rounded_box("PHBody", (0.7, 0.42, 0.5), 0.06, collection=geo.coll("PH"), mat=m,
                                     center=(0, 0.05, 0.3)))
        for sx in (-0.3, 0.3):
            parts.append(geo.box("PHArm", (0.17, 0.32, 0.12), loc=(sx * 1.25, -0.2, 0.22), collection=geo.coll("PH"), mat=m))
    else:
        parts.append(geo.rounded_box("PHBody", (0.7, 0.42, 0.5), 0.06, collection=geo.coll("PH"), mat=m,
                                     center=(0, 0, 0.44)))
        for sx in (-0.306, -0.129, 0.129, 0.306):
            parts.append(geo.box("PHLeg", (0.087, 0.14, 0.19), loc=(sx, 0, 0.095), collection=geo.coll("PH"), mat=m))
        for sx in (-0.42, 0.42):
            parts.append(geo.box("PHArm", (0.17, 0.15, 0.17), loc=(sx, 0, 0.5), collection=geo.coll("PH"), mat=m))
    if pose != "curl":
        z = 0.56 if pose == "stand" else 0.42
        for sx in (-0.215, 0.215):
            parts.append(geo.box("PHEye", (0.08, 0.02, 0.08), loc=(sx, -0.215, z), collection=geo.coll("PH"), mat=e))
    o = geo.join(parts, name)
    o.location = at
    o.rotation_euler = (0, 0, math.radians(heading))
    return o


def gz(x, y):
    return world.World.current.ground(x, y)


def cam(name, eye, tgt, lens, fstop=None, focus=None):
    c = scene.camera(name, lens=lens, loc=eye, target=tgt, fstop=fstop, focus=focus)
    return c


def build(view):
    sc = scene.reset()
    sc.frame_start, sc.frame_end = F0, F1
    fr = FR
    if view == "a":
        W = world.World("ash", focus=(0.0, -10.0), frames=(F0, F1))
        placeholder((-2.0, -16.0, gz(-2.0, -16.0)), heading=-90.0)
        c = cam("CamA", (-9.0, -40.0, gz(-9.0, -40.0) + 2.2), (16.0, 90.0, 22.0), 24.0)
        P = post.preset("ash", focus_xy=(0.45, 0.4))
    elif view == "b":
        W = world.World("ash", focus=(0.5, -3.0), frames=(F0, F1))
        sx, sy = layout.SEED
        placeholder((sx, sy - 0.55, gz(sx, sy - 0.55)), heading=0.0, pose="kneel")
        e = Vector((-3.6, -13.5, gz(-3.6, -13.5) + 1.7))
        t = Vector((0.9, -0.8, gz(0.0, 0.0) + 1.55))
        c = cam("CamB", e, t, 35.0, fstop=4.0, focus=(Vector((sx, sy, gz(sx, sy))) - e).length)
        P = post.preset("ash", focus_xy=(0.55, 0.45), shimmer=[(0.2, 0.05, 0.55, 0.4, 2.5)])
    elif view == "b2":
        W = world.World("ash", focus=layout.SEED, frames=(F0, F1))
        sx, sy = layout.SEED
        e = Vector((sx - 0.5, sy - 1.5, gz(sx - 0.5, sy - 1.5) + 0.55))
        c = cam("CamB2", e, (sx + 0.1, sy + 0.4, gz(sx, sy) + 0.15), 45.0, fstop=2.8,
                focus=(Vector((sx, sy, gz(sx, sy))) - e).length)
        P = post.preset("ash", focus_xy=(0.5, 0.45))
    elif view == "c":
        W = world.World("threat", focus=(-4.0, 6.0), storm=0.42, frames=(F0, F1))
        placeholder((1.2, -2.8, gz(1.2, -2.8)), heading=145.0)
        e = Vector((3.4, -5.6, gz(3.4, -5.6) + 0.35))
        c = cam("CamC", e, (-70.0, 30.0, 40.0), 24.0, fstop=5.6, focus=4.5)
        sky.flash(fr - 2, 0.6, az=172.0, el=12.0)
        fx.amount(W.fx["wind_ash"], fr, 1.0)
        P = post.preset("threat", focus_xy=(0.6, 0.35))
    elif view in ("d", "d2"):
        W = world.World("storm", focus=layout.HAIL_SPOT, frames=(F0, F1))
        hx, hy = layout.HAIL_SPOT
        hz = gz(hx, hy)
        ph = placeholder((hx, hy, hz), heading=200.0, pose="curl")
        fx.hail((hx, hy), 6.0 if view == "d2" else 16.0, 2600 if view == "d2" else 4000, F0, height=14.0)
        fx.rain((hx, hy, hz + 8.0), (30.0, 30.0, 20.0), 5000, F0, name="RainNear")
        if view == "d":
            e = Vector((8.0, 112.0, gz(8.0, 112.0) + 4.0))
            c = cam("CamD", e, (hx + 1.0, hy + 3.0, hz + 4.0), 28.0)
            fx.lightning(fr - 3, start=Vector((40.0, 330.0, 250.0)), end=Vector((58.0, 255.0, 25.0)), seed=5)
            P = post.preset("storm", focus_xy=(0.55, 0.45))
        else:
            e = Vector((hx - 2.6, hy - 3.6, hz + 0.75))
            c = cam("CamD2", e, (hx + 0.2, hy + 0.6, hz + 0.6), 40.0, fstop=4.0, focus=4.4)
            for k, t in enumerate((0.7, 1.2, 1.8)):
                fx.chips((hx + 0.3 * (k - 1), hy - 0.1, hz + 0.4), int(fr - 6 + k * 3), n=6, seed=k,
                         direction=(0.3 * (k - 1), -0.5, 0.8))
            fx.lightning(fr - 4, seed=8, flash=0.5)
            P = post.preset("storm", focus_xy=(0.5, 0.45))
    elif view == "d3":
        W = world.World("storm", focus=layout.LEDGE, frames=(F0, F1))
        L = W.mtn["ledge"]
        placeholder((L["lip"].x + 0.3, L["lip"].y + 0.45, L["lip"].z), heading=180.0, pose="stand")
        e = L["foot"] + Vector((-1.8, -2.6, 0.35))
        c = cam("CamD3", e, L["lip"] + Vector((0.4, 0.0, 0.9)), 20.0)
        fx.lightning(fr - 3, start=Vector((10.0, 260.0, 240.0)), end=Vector((-10.0, 200.0, 20.0)), seed=9)
        P = post.preset("storm", focus_xy=(0.55, 0.6))
    elif view == "e":
        W = world.World("beam", focus=layout.PEAK, tear=0.55, frames=(F0, F1))
        px, py = layout.PEAK_SOIL
        fx.sunbeam(f0=F0)
        placeholder((px - 0.6, py - 1.4, gz(px - 0.6, py - 1.4)), heading=20.0, pose="kneel")
        e = Vector((27.4, 140.5, gz(27.4, 140.5) + 0.7))
        c = cam("CamE", e, (px + 1.0, py + 2.0, gz(px, py) + 4.5), 22.0)
        P = post.preset("beam", focus_xy=(0.5, 0.5))
    elif view == "f0":
        W = world.World("bloom", focus=layout.PEAK, wave=True, frames=(F0, F1))
        W.bloom_wave(10, 10 + 106)
        W.sky_transition(4, 110, "beam", "bloom")
        px, py = layout.PEAK_SOIL
        placeholder((px - 0.6, py - 0.9, gz(px - 0.6, py - 0.9)), heading=160.0, pose="kneel")
        e = Vector((px + 1.5, py + 2.5, gz(px + 1.5, py + 2.5) + 1.3))
        c = cam("CamF0", e, (px - 6.0, py - 22.0, gz(px - 6.0, py - 22.0) + 1.0), 24.0)
        fr = 24
        P = post.transition("beam", "bloom", 4, 110, focus_xy=(0.5, 0.45))
    elif view in ("f", "f2"):
        W = world.World("bloom", focus=layout.PEAK, wave=True, frames=(F0, F1))
        W.bloom_wave(10, 10 + 106)
        W.sky_transition(4, 110, "beam", "bloom")
        px, py = layout.PEAK_SOIL
        placeholder((px - 0.8, py - 1.0, gz(px - 0.8, py - 1.0)), heading=200.0, pose="kneel")
        e = Vector((40.0, 128.0, 74.0))
        c = cam("CamF", e, (0.0, 10.0, 4.0), 24.0)
        fr = 52 if view == "f" else 118
        P = post.transition("beam", "bloom", 4, 110, focus_xy=(0.5, 0.5))
    elif view == "h":
        W = world.World("bloom", focus=(6.0, 40.0), frames=(F0, F1))
        e = Vector((12.0, 78.0, gz(12.0, 78.0) + 3.0))
        c = cam("CamH", e, (-6.0, 0.0, 6.0), 28.0)
        P = post.preset("bloom", focus_xy=(0.5, 0.45))
    elif view == "g":
        W = world.World("coda", focus=layout.PEAK, frames=(F0, F1))
        px, py = layout.PEAK_SOIL
        placeholder((px + 1.4, py - 0.8, gz(px + 1.4, py - 0.8)), heading=230.0)
        e = Vector((px - 6.5, py - 7.5, gz(px - 6.5, py - 7.5) + 1.4))
        c = cam("CamG", e, (px + 2.0, py + 1.0, gz(px, py) + 1.8), 30.0, fstop=5.6, focus=9.0)
        P = post.preset("coda", focus_xy=(0.5, 0.5))
    else:
        raise ValueError(view)
    return W, c, P, fr


timings = {}
for v in views:
    t0 = time.time()
    W, c, P, fr = build(v)
    sc = bpy.context.scene
    sc.camera = c
    n = W.cull_cover(fr, fr)
    post.setup(**P)
    sc.render.resolution_percentage = 100 if full else 50
    sc.eevee.taa_render_samples = samples
    tb = time.time() - t0
    sc.frame_set(fr)
    pth = os.path.join(outdir, f"{v}{'_full' if full else ''}.png")
    t1 = time.time()
    scene.render_still(pth)
    tr = time.time() - t1
    timings[v] = (round(tb, 1), round(tr, 1))
    print(f"VIEW {v}: build {tb:.1f}s render {tr:.1f}s culled {n} -> {pth}", flush=True)
    if save:
        os.makedirs(os.path.join(OUT, "blend"), exist_ok=True)
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "blend", f"lookdev_env_{v}.blend"))
print("TIMINGS", timings)

# contact sheet
suffix = "_full" if full else ""
paths = [os.path.join(outdir, f"{v}{suffix}.png") for v in views if os.path.exists(os.path.join(outdir, f"{v}{suffix}.png"))]
if paths:
    w = 960
    args = []
    for p in paths:
        args += ["-i", p]
    k = len(paths)
    cols = 2 if k > 1 else 1
    rows = (k + cols - 1) // cols
    fc = "".join(f"[{i}:v]scale={w}:408,format=rgb24[v{i}];" for i in range(k))
    if k % cols:
        fc += f"color=black:s={w}x408,format=rgb24[pad];"
    ins = "".join(f"[v{i}]" for i in range(k)) + ("[pad]" if k % cols else "")
    lay = "|".join(f"{(i % cols) * w}_{(i // cols) * 408}" for i in range(k + (1 if k % cols else 0)))
    if k == 1:
        fc += "[v0]copy"
    else:
        fc += f"{ins}xstack=inputs={k + (1 if k % cols else 0)}:layout={lay}"
    sheet = os.path.join(outdir, f"sheet{suffix}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + ["-filter_complex", fc, "-frames:v", "1", sheet])
    print("SHEET", sheet)

    # reference comparison: the three reference tiles above the sheet
    refs = [os.path.join(PROJECT, "ref", "frames", f"tile{k}.png") for k in "ABC"]
    if all(os.path.exists(r) for r in refs):
        cmp_ = os.path.join(outdir, f"compare{suffix}.png")
        fc2 = "".join(f"[{i}:v]scale=640:-2,format=rgb24[r{i}];" for i in range(3))
        fc2 += "[r0][r1][r2]hstack=inputs=3[top];[3:v]scale=1920:-2,format=rgb24[sh];[top][sh]vstack=inputs=2"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", refs[0], "-i", refs[1], "-i", refs[2], "-i", sheet,
                        "-filter_complex", fc2, "-frames:v", "1", cmp_])
        print("COMPARE", cmp_)
