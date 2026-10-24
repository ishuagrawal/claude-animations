"""Environment look-dev: the meadow, the windmill and its yard at night, against the Wild Robot reference.

  Blender -b --python src/lookdev_ground.py -- [a,b,c,d] [--full] [--samples N] [--frame F] [--save]

Renders (half resolution unless --full) into out/lookdev_ground/:
  a  SH06: low in the north meadow at CRATER, through flowers, looking south to the windmill (crater glowing)
  b  SH11: top-down over LIE, Claude and the star lying in the flowers
  c  SH15: low in the south meadow looking up at the windmill front, a gust rolling through the grass
  d  close detail of the windmill dressing by the door (lantern, bench, pots, sacks, ivy, flower box)
extra views (QA, not rendered by default): e = SH07-like high close-up into the crater, f = SH02-like view from above
the north gallery over the meadow, g = SH01-like start low in the south-meadow flowers
then a contact sheet (sheet.png) and a reference comparison (compare.png, next to ref/frames/tileB/tileC)."""
import sys, os, time, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector
from lu import scene, world, windmill, foliage, fx, post, layout, dress
from lu.paths import OUT, PROJECT

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
views = argv[0].split(",") if argv and not argv[0].startswith("--") else ["a", "b", "c", "d"]
full = "--full" in argv
samples = int(argv[argv.index("--samples") + 1]) if "--samples" in argv else (24 if full else 16)
FR = int(argv[argv.index("--frame") + 1]) if "--frame" in argv else 30
outdir = os.path.join(OUT, "lookdev_ground")
os.makedirs(outdir, exist_ok=True)

t0 = time.time()
sc = scene.reset()
sc.frame_start, sc.frame_end = 1, 96
W = world.World("ext", "night", windmill_state=dict(sails_angle=0.0, window_glow=0.85, door_lantern=True,
                                                     gallery_hook="lantern"))
O = W.origin
H = W.ground
CR = layout.CRATER
LIE = layout.LIE
# the fallen star's crater, fireflies over the north meadow and by the mill
cr = fx.crater(CR, 1, 96, radius=0.5, glow=1.0)
fx.fireflies((1.5, 13.5), 6.0, 22, 1, 96, seed=3)
fx.fireflies((0.5, -3.0), 7.0, 18, 1, 96, seed=4)
foliage.gust(12, 80, 0.7, speed=9.0, start=(1.5, -9.0))
c = W.claude()
s = W.star()
print("BUILD", round(time.time() - t0, 1), "s")


def pose(view):
    if view == "a":       # creeping toward the crater from the windmill side
        x, y = CR[0] - 0.9, CR[1] - 1.9
        c.apply(dict(x=x, y=y, z=H(x, y), heading=200.0, lean=12, squash=-0.06, armL_up=20, armL_fwd=40, armR_up=-10,
                     look_y=-0.3, pupil=0.9))
        p = cr["center"]
        s.apply(dict(x=p.x, y=p.y, z=p.z + 0.07, heading=160.0, scale=0.62, curl=38, squash=-0.14, glow=0.55,
                     pupil=0.8, look_y=0.4))
    elif view == "b":     # lying on its back in the flower bed, the star nestled at its side
        x, y = LIE[0] - 0.12, LIE[1] - 0.42
        c.apply(dict(x=x, y=y, z=H(x, y) + 0.04, heading=0.0, tilt_x=-90.0, armL_up=40, armR_up=-20, eye_happy=0.6,
                     look_y=0.5))
        s.apply(dict(x=LIE[0] + 0.42, y=LIE[1] + 0.02, z=H(LIE[0] + 0.42, LIE[1]) + 0.08, pitch=-90.0, heading=20.0,
                     scale=0.62, glow=1.2, eye_happy=0.7))
    elif view == "e":
        c.apply(dict(x=0.0, y=7.0, z=-5.0))
        p = cr["center"]
        s.apply(dict(x=p.x, y=p.y, z=p.z + 0.06, heading=200.0, scale=0.62, curl=38, squash=-0.14, glow=0.5,
                     pupil=0.8, look_y=0.6))
    else:                 # out of the way (in the house)
        c.apply(dict(x=0.0, y=7.0, z=-5.0))
        s.apply(dict(x=0.5, y=7.0, z=-5.0))


def cam(view):
    if view == "a":
        e = Vector((CR[0] + 0.7, CR[1] + 3.3, H(CR[0] + 0.7, CR[1] + 3.3) + 0.5))
        return scene.camera("CamA", lens=24, loc=e, target=(0.6, 7.0, O.z + 1.2), fstop=2.8,
                            focus=(e - Vector((CR[0], CR[1], H(*CR)))).length)
    if view == "b":
        e = Vector((LIE[0] + 0.12, LIE[1] - 0.05, H(*LIE) + 2.7))
        cm = scene.camera("CamB", lens=30, loc=e, target=(LIE[0] + 0.12, LIE[1] - 0.04, H(*LIE)), fstop=5.6, focus=2.6)
        return cm
    if view == "c":
        e = Vector((2.2, -14.5, H(2.2, -14.5) + 0.42))
        return scene.camera("CamC", lens=16, loc=e, target=(0.0, 4.0, O.z + 6.8), fstop=4.0, focus=19.0)
    if view == "e":
        p = cr["center"]
        e = Vector((p.x - 0.55, p.y - 0.75, p.z + 1.05))
        return scene.camera("CamE", lens=45, loc=e, target=p + Vector((0, 0, 0.05)), fstop=2.8, focus=1.3)
    if view == "f":
        e = Vector((-2.2, 9.6, O.z + 7.2))
        return scene.camera("CamF", lens=24, loc=e, target=(1.8, 22.0, O.z - 2.5), fstop=8.0, focus=10.0)
    if view == "h":       # SH13-like: from the flowers at LIE, up at the north sky over the pine edge
        e = Vector((LIE[0] - 0.6, LIE[1] + 0.4, H(*LIE) + 0.35))
        el, az = math.radians(17.0), math.radians(88.0)
        t = e + Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el))) * 20.0
        return scene.camera("CamH", lens=28, loc=e, target=t, fstop=4.0, focus=12.0)
    if view == "g":
        e = Vector((1.3, -12.5, H(1.3, -12.5) + 0.2))
        return scene.camera("CamG", lens=18, loc=e, target=(0.0, 7.0, O.z + 6.8), fstop=2.0, focus=19.0)
    e = Vector((3.3, -1.7, H(3.3, -1.7) + 1.45))
    return scene.camera("CamD", lens=30, loc=e, target=(-0.5, 3.4, O.z + 1.35), fstop=4.0, focus=6.0)


hazes = dict(a=dict(haze_amt=0.45, mist_start=30.0, mist_depth=900.0), b=dict(haze_amt=0.0),
             c=dict(haze_amt=0.45, mist_start=40.0, mist_depth=1200.0), d=dict(haze_amt=0.2, mist_start=20.0, mist_depth=600.0),
             e=dict(haze_amt=0.0), f=dict(haze_amt=0.45, mist_start=30.0, mist_depth=900.0),
             g=dict(haze_amt=0.45, mist_start=40.0, mist_depth=1200.0), h=dict(haze_amt=0.45, mist_start=30.0, mist_depth=900.0))
sc.render.resolution_percentage = 100 if full else 50
sc.eevee.taa_render_samples = samples
paths = []
for v in views:
    pose(v)
    cm = cam(v)
    sc.camera = cm
    hz = hazes[v]
    post.setup(haze=W.P.get("haze", (0.06, 0.12, 0.16)), bloom=0.55, bloom_thr=0.6, vignette=0.32, **hz)
    sc.frame_set(FR)
    t1 = time.time()
    p = os.path.join(outdir, f"{v}{'_full' if full else ''}.png")
    scene.render_still(p)
    print("RENDER", v, round(time.time() - t1, 1), "s")
    paths.append(p)
if "--save" in argv:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, "lookdev_ground.blend"))

# contact sheet + reference comparison
w = 960
if len(paths) > 1:
    args = sum((["-i", p_] for p_ in paths), [])
    n = len(paths)
    fc = "".join(f"[{i}:v]scale={w}:-2[v{i}];" for i in range(n))
    if n == 4:
        fc += "[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0"
    else:
        fc += "".join(f"[v{i}]" for i in range(n)) + f"hstack=inputs={n}"
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + ["-filter_complex", fc, os.path.join(outdir, "sheet.png")])
    ref = os.path.join(PROJECT, "ref", "frames")
    refs = [os.path.join(ref, "f_92.png"), os.path.join(ref, "f_131.png")]
    args = sum((["-i", p_] for p_ in paths[:2] + refs), [])
    fc = "".join(f"[{i}:v]scale={w}:408:force_original_aspect_ratio=increase,crop={w}:408[v{i}];" for i in range(4))
    fc += "[v0][v1][v2][v3]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0"
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + ["-filter_complex", fc, os.path.join(outdir, "compare.png")])
print("TOTAL", round(time.time() - t0, 1), "s")
