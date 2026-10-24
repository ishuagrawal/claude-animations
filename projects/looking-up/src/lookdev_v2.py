"""Night look-dev v2: the sky, the sea of clouds, the constellation and the image finish, from four story views.

    Blender -b --python src/lookdev_v2.py -- [--views abcde] [--pct 50] [--samples 24] [--eye 1.0] [--glow 0]
                                             [--suffix _full] [--story] [--wb]

Builds world.World("ext", "night") + the constellation once, then renders (at --pct % of 1920x816) into
out/lookdev_v2/:
  a.png  SH01/SH19 bookend wide from the south: the windmill on its peak, the constellation above it
  b.png  SH02: behind Claude at the north gallery rail, looking north (meadow, cloud sea, constellation)
  c.png  SH13/SH14: low in the north meadow near the crater, Claude + the star, the sky to the north
  d.png  SH16: from the sail apex ~20 m up, looking down over the moonlit cloud sea
  e.png  (extra) SH11 top-down: Claude and the star lying in the flowers (night paint, star light reach)
sheet.png (2x2 of a-d via ffmpeg xstack), compare.png (a-d beside The Wild Robot frames), timing.txt.
--story renders s1-s5: the eye's twinkle, the falling streak (2 frames), ignition peak and after (story.png).
"""
import sys, os, time, math, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy
from mathutils import Vector

from lu import scene, world, props, post, windmill, layout, stage, sky
from lu.paths import OUT

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default, cast=str):
    return cast(argv[argv.index(name) + 1]) if name in argv else default


VIEWS = arg("--views", "abcde")
PCT = arg("--pct", 50, int)
SAMPLES = arg("--samples", 24, int)
EYE = arg("--eye", 1.0, float)
GLOW = arg("--glow", 0.0, float)
WB = "--wb" in argv          # fast Workbench framing check
SUF = arg("--suffix", "")     # e.g. --pct 100 --suffix _full writes a_full.png ...
OUTDIR = os.path.join(OUT, "lookdev_v2")
os.makedirs(OUTDIR, exist_ok=True)

t0 = time.time()
sc = scene.reset()
W = world.World("ext", "night", windmill_state=dict(sails_angle=0.0, window_glow=0.9))
P = W.P
C = props.constellation(origin=(0, 0, 0), lines=0.55, eye=EYE)
if GLOW and hasattr(sky, "emotion"):
    sky.emotion(GLOW)
t_build = time.time() - t0
print("BUILD", round(t_build, 1))

g_deck = W.origin.z + windmill.GALLERY_Z + 0.165


def dir_az_el(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


# ---------------------------------------------------------------- characters (Claude + the star)
CL = W.claude()
ST = W.star()


def pose_chars(view):
    """Claude and the star for a view; returns (focus point, lantern location or None)."""
    if view == "b":
        x, y = layout.GALLERY_N
        CL.apply(dict(x=x, y=y, z=g_deck, heading=180, head_nod=-12, look_y=0.9, armL_up=-20, armR_up=-20))
        ST.apply(dict(x=0, y=0, z=-50, glow=0.0))
        return Vector((x, y, g_deck + 0.6)), None
    if view == "c":
        x, y = layout.CRATER[0] - 0.4, layout.CRATER[1] + 0.6
        z = W.ground(x, y)
        CL.apply(dict(x=x, y=y, z=z - 0.02, heading=-18, lean=-8, head_nod=-8, look_y=0.35, look_x=-0.2,
                      armL_up=18, armR_up=18, armL_fwd=62, armR_fwd=62, armL_bend=35, armR_bend=35, eye_happy=0.25))
        h = math.radians(-18)
        fwd = Vector((math.sin(h), -math.cos(h), 0))
        sp = Vector((x, y, z)) + fwd * 0.52 + Vector((0, 0, 0.62))
        ST.apply(dict(x=sp.x, y=sp.y, z=sp.z, heading=-18, pitch=-8, glow=1.1, warmth=1.0, eye_happy=0.4, arms=10,
                      look_y=0.5))
        return Vector((x, y, z + 0.55)), None
    if view == "e":       # SH11 top-down: lying side by side in the flowers
        x, y = layout.LIE
        z = W.ground(x, y)
        CL.apply(dict(x=x, y=y, z=z + 0.30, heading=0, tilt_x=-90, look_y=0.0, eye_happy=0.6, armL_up=30))
        ST.apply(dict(x=x + 0.62, y=y + 0.05, z=z + 0.16, pitch=-90, glow=1.0, eye_happy=0.5))
        return Vector((x, y, z + 0.3)), None
    if view == "d":
        tip = sail_apex()
        CL.apply(dict(x=tip.x, y=tip.y, z=tip.z, heading=150, head_nod=-6, look_y=0.4, look_x=-0.3,
                      armL_up=40, armR_up=40, armL_fwd=40, armR_fwd=40, armL_bend=30, armR_bend=30))
        h = math.radians(150)
        fwd = Vector((math.sin(h), -math.cos(h), 0))
        sp = tip + fwd * 0.45 + Vector((0, 0, 0.75))
        ST.apply(dict(x=sp.x, y=sp.y, z=sp.z, heading=150, glow=1.2, eye_happy=0.3, look_y=0.4))
        return tip + Vector((0, 0, 0.5)), None
    CL.apply(dict(x=0, y=0, z=-50))
    ST.apply(dict(x=0, y=0, z=-50, glow=0.0))
    return None, None


def sail_apex():
    """Top of the highest sail stock (world)."""
    bpy.context.view_layer.update()
    best = None
    for o in bpy.data.objects:
        if o.name.startswith("SailFrame") and o.type == "MESH":
            for v in o.data.vertices:
                p = o.matrix_world @ v.co
                if best is None or p.z > best.z:
                    best = p
    return best


# ---------------------------------------------------------------- cameras
def cam_for(view):
    cam = bpy.data.objects.get("LD_Cam")
    if cam is None:
        cam = scene.camera("LD_Cam", lens=24)
    cd = cam.data
    cd.clip_start, cd.clip_end = 0.05, 6000.0
    cd.dof.use_dof = False
    if view == "a":       # bookend wide from the south, end of the SH01 crane
        eye = Vector((2.0, -60.0, 4.0))
        cd.lens = 20
        tgt = eye + dir_az_el(91.0, 17.0)
    elif view == "b":     # behind Claude at the north rail (clip cheat through the tower wall)
        eye = Vector((-3.4, -0.3, g_deck + 2.4))
        cd.lens = 18
        cd.clip_start = 10.45     # clip depth (along the view axis) cuts the tower, keeps Claude
        tgt = eye + dir_az_el(84.0, 9.0)
    elif view == "c":     # low in the north meadow: the pair in the flowers, the sky to the north above them
        x, y = layout.CRATER[0] - 0.4, layout.CRATER[1] + 0.6
        eye = Vector((x + 0.9, y - 2.6, W.ground(x + 0.9, y - 2.6) + 0.6))
        cd.lens = 16
        tgt = eye + dir_az_el(103.0, 9.0)
        cd.dof.use_dof = True
        cd.dof.aperture_fstop = 5.6
        cd.dof.focus_distance = 2.8
    elif view == "e":     # SH11 top-down
        x, y = layout.LIE
        eye = Vector((x + 0.28, y + 0.38, W.ground(x, y) + 3.4))
        cd.lens = 35
        tgt = eye + Vector((0.0, 0.001, -1.0))
    else:                 # the sail apex, high over the cloud sea (Claude on the top sail tip)
        eye = Vector((5.0, -5.5, 23.6))
        cd.lens = 26
        tgt = eye + dir_az_el(118.0, -9.0)
    scene.look_at(cam, eye, tgt)
    sc.camera = cam
    return cam


POST = dict(
    a=dict(focus_xy=(0.5, 0.35)),
    b=dict(focus_xy=(0.5, 0.3)),
    c=dict(focus_xy=(0.5, 0.35)),
    d=dict(focus_xy=(0.45, 0.45)),
    e=dict(focus_xy=(0.5, 0.5)),
)

STORY = "--story" in argv


def story():
    """Exercise the helpers: twinkle (SH04), the falling streak (SH04), ignition (SH17). Renders s1..s4."""
    x, y = layout.GALLERY_N
    eye = Vector((x + 0.3, y + 0.2, g_deck + 0.75))
    f0 = 100
    props.twinkle(C["eye"], f0, (0.35, 1.0))
    FS = props.falling_star(None, None, f0 + 40, f0 + 80, view_from=eye)
    fi = 300
    props.key_lines(0.55, fi - 30)
    props.key_bright(1.0, fi - 30)
    C["eye"]["eye"] = 0.0
    C["eye"].keyframe_insert('["eye"]', frame=fi - 30)
    IG = props.ignite(fi)
    sky.emotion(0.0, fi - 30)
    sky.emotion(0.45, fi + 40)
    cam = scene.camera("ST_Cam", lens=30)
    cam.data.clip_end = 6000.0
    shots = [("s1", f0 + int(0.35 * 24), dir_az_el(92, 26), 30, eye),
             ("s2", f0 + 62, dir_az_el(80, 12), 24, eye),
             ("s3", f0 + 76, dir_az_el(74, -20), 22, eye),
             ("s4", fi + 4, dir_az_el(90, 28), 30, Vector((0.0, 0.6, 22.5))),
             ("s5", fi + 50, dir_az_el(90, 28), 30, Vector((0.0, 0.6, 22.5)))]
    for nm, fr, dv, lens, e in shots:
        sc.frame_set(fr)
        cam.data.lens = lens
        scene.look_at(cam, e, e + dv)
        sc.camera = cam
        post.setup(focus_xy=(0.5, 0.5))
        scene.render_still(os.path.join(OUTDIR, f"{nm}.png"))
        print("STORY", nm)
    ins = sum((["-i", os.path.join(OUTDIR, f"{n}.png")] for n in ("s1", "s2", "s3", "s4")), [])
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex",
                    "[0:v][1:v][2:v][3:v]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0", "-frames:v", "1",
                    os.path.join(OUTDIR, "story.png")])


timing = []
paths = []
if STORY:
    CL.apply(dict(x=0, y=0, z=-50))
    ST.apply(dict(x=0, y=0, z=-50, glow=0.0))
    sc.render.resolution_percentage = PCT
    sc.eevee.taa_render_samples = SAMPLES
    story()
    VIEWS = ""
sc.render.resolution_percentage = PCT
sc.eevee.taa_render_samples = SAMPLES
if WB:
    sc.render.engine = "BLENDER_WORKBENCH"
    sc.display.shading.light = "STUDIO"
    sc.display.shading.color_type = "MATERIAL"
    sc.render.use_compositing = False
CHEAT_B = ("Tower", "CornerPosts", "Cap", "Curb", "TailPole", "TailStrut", "TailWheel", "Windshaft", "SailMount",
           "SailFrame", "Canvas", "PollEnd")


def cheat(view):
    """SH02-style cheat: from behind the north rail the tower top, cap and tail assembly would fill the frame."""
    for o in bpy.data.objects:
        if o.name.startswith(CHEAT_B):
            o.hide_render = (view == "b")


for v in VIEWS:
    t1 = time.time()
    cheat(v)
    focus, _ = pose_chars(v)
    cam = cam_for(v)
    for o in [o for o in bpy.data.objects if o.name.startswith("CharRig")]:
        bpy.data.objects.remove(o)
    if focus is not None:
        for ch in (CL, ST):
            scene.char_lights(ch.col, focus, cam.location, P["sun_dir"], name=f"CharRig_{ch.name}")
    if not WB:
        post.setup(**POST[v])
    pth = os.path.join(OUTDIR, f"{v}{SUF}.png")
    scene.render_still(pth)
    dt = time.time() - t1
    timing.append(f"{v}: {dt:.1f}s @ {PCT}% {SAMPLES} spp")
    print("VIEW", v, round(dt, 1))
    paths.append(pth)

with open(os.path.join(OUTDIR, f"timing{SUF}.txt"), "w") as f:
    f.write(f"build {t_build:.1f}s\n" + "\n".join(timing) + "\n")

abcd = [os.path.join(OUTDIR, f"{v}{SUF}.png") for v in "abcd"]
if all(os.path.exists(p) for p in abcd) and set("abcd") <= set(VIEWS):
    ins = sum((["-i", p] for p in abcd), [])
    subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex",
                    "[0:v][1:v][2:v][3:v]xstack=inputs=4:layout=0_0|w0_0|0_h0|w0_h0", "-frames:v", "1",
                    os.path.join(OUTDIR, f"sheet{SUF}.png")])
    # side by side with The Wild Robot (active 2.35:1 picture of the reference frames, same size as ours)
    from lu.paths import PROJECT
    refs = [os.path.join(PROJECT, "ref", "frames", f) for f in ("f_52.png", "f_116.png", "f_83.png", "f_121.png")]
    if all(os.path.exists(r) for r in refs):
        ins = sum((["-i", p] for p in abcd + refs), [])
        w = int(1920 * PCT / 100)
        h = int(816 * PCT / 100)
        fc = "".join(f"[{i}:v]scale={w}:{h}[o{i}];" for i in range(4))
        fc += "".join(f"[{i + 4}:v]crop=1920:816:0:132,scale={w}:{h}[r{i}];" for i in range(4))
        fc += "[o0][r0][o1][r1][o2][r2][o3][r3]xstack=inputs=8:layout=0_0|w0_0|0_h0|w0_h0|0_h0+h0|w0_h0+h0|0_h0+h0+h0|w0_h0+h0+h0"
        subprocess.run(["ffmpeg", "-v", "error", "-y"] + ins + ["-filter_complex", fc, "-frames:v", "1",
                        os.path.join(OUTDIR, f"compare{SUF}.png")])
print("DONE", round(time.time() - t0, 1))
