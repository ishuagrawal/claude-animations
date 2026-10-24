"""Character look-dev and acting harness for BLOOM (Claude + the Sprout).

    Blender -b --python src/lookdev_chars.py -- [--parts abcdefg] [--pct 50] [--samples 16] [--nopost] [--only k1,k2]

Renders into out/lookdev_chars/ (each part: individual frames + a labelled sheet):
  a  Claude turnaround in neutral grey-day light: front, 3/4, side, back            -> a_sheet.png
  b  expression sheet, 12 face close-ups: neutral, grief, curious, wonder, worried, determined, effort, flinch,
     despair (tears), joyful laugh, sleep, smile                                     -> b_sheet.png
  c  body-language: hunched grief, running, curled over the sprout, hauling up a ledge, kneeling and planting,
     arms-up joy (+ flat silhouettes)                                                -> c_sheet.png, c_silhouettes.png
  d  material states in their story light: ash (grey day), wet (storm), damaged (storm), gold kintsugi (coda)
     (+ the same four in neutral light)                                              -> d_sheet.png
  e  Sprout: growth stages (seed, cracking, sprout, bigger, sapling, great tree) + expressions (shy, happy, wilted)
                                                                                     -> e_sheet.png
  f  emotional two-shot: Claude's face lit by the seed's green glow, the sprout's leaf curled round its finger
                                                                                     -> f_twoshot.png
  g  lighting response: one pose in grey day / storm / gold beam / spring (brand orange check) -> g_sheet.png
Frames are 1920x816 x pct%. Uses the shared post finish (post.py) unless --nopost.
"""
import sys, os, time, math, subprocess
SRC = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, SRC)
import bpy
from mathutils import Vector, Matrix

from lu import scene, mat, geo, claude, acting, charmat, anim
from lu.paths import OUT

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default, cast=str):
    return cast(argv[argv.index(name) + 1]) if name in argv else default


PARTS = arg("--parts", "rabcdefg")
PCT = arg("--pct", 50, int)
SAMPLES = arg("--samples", 16, int)
ONLY = [s for s in arg("--only", "").split(",") if s]
POST = "--nopost" not in argv
OUTDIR = os.path.join(OUT, "lookdev_chars")
os.makedirs(OUTDIR, exist_ok=True)
T0 = time.time()
TIMES = []


# ---------------------------------------------------------------- scene / lights
def sdir(az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


RIGS = {
    # world (top, horizon, bottom), strength; key (az from camera: 0 = camera side, +90 camera-right, 180 behind;
    # elevation; colour; energy; angle); optional rim area light; look values
    "grey": dict(world=((0.50, 0.50, 0.48), (0.70, 0.67, 0.60), (0.26, 0.25, 0.23)), we=0.95,
                 key=(-42, 42, (1.0, 0.96, 0.90), 2.80, 14), rim=None, term=(0.40, 1.00),
                 look=dict(ShadowTint=(0.20, 0.205, 0.235), ShadowKeep=0.36, Sat=1.0, SkyFill=(0.04, 0.045, 0.05),
                           Bounce=(0.03, 0.028, 0.025), FrontFill=(0.08, 0.075, 0.075))),
    "storm": dict(world=((0.035, 0.042, 0.075), (0.085, 0.095, 0.14), (0.03, 0.03, 0.04)), we=1.0,
                  key=(-60, 55, (0.62, 0.70, 0.95), 1.2, 8), rim=(160, 30, (0.78, 0.74, 1.0), 140.0),
                  look=dict(ShadowTint=(0.035, 0.04, 0.065), ShadowKeep=0.45, Sat=1.0, SkyFill=(0.02, 0.025, 0.04),
                            Bounce=(0.01, 0.01, 0.012), FrontFill=(0.04, 0.04, 0.05))),
    "beam": dict(world=((0.04, 0.04, 0.08), (0.09, 0.08, 0.12), (0.03, 0.03, 0.04)), we=1.0,
                 key=(135, 42, (1.0, 0.70, 0.32), 5.5, 3), rim=None, fill=(-40, 20, (0.35, 0.40, 0.62), 0.45),
                 look=dict(ShadowTint=(0.06, 0.055, 0.10), ShadowKeep=0.42, Sat=1.15, SkyFill=(0.02, 0.02, 0.04),
                           Bounce=(0.02, 0.015, 0.01), FrontFill=(0.05, 0.045, 0.06))),
    "spring": dict(world=((0.30, 0.45, 0.80), (0.85, 0.80, 0.70), (0.25, 0.30, 0.18)), we=0.9,
                   key=(-50, 45, (1.0, 0.86, 0.66), 4.0, 4), rim=None,
                   look=dict(ShadowTint=(0.20, 0.20, 0.34), ShadowKeep=0.35, Sat=1.15, SkyFill=(0.05, 0.08, 0.15),
                             Bounce=(0.05, 0.04, 0.02), FrontFill=(0.10, 0.09, 0.10))),
    "dusk": dict(world=((0.075, 0.075, 0.085), (0.13, 0.12, 0.115), (0.04, 0.04, 0.04)), we=0.8,
                 key=(-35, 55, (0.85, 0.85, 0.82), 0.55, 10), rim=None,
                 look=dict(ShadowTint=(0.05, 0.05, 0.06), ShadowKeep=0.5, Sat=1.05, SkyFill=(0.015, 0.015, 0.02),
                           Bounce=(0.01, 0.01, 0.01), FrontFill=(0.03, 0.03, 0.03))),
}


def build_base():
    sc = scene.reset()
    sc.render.resolution_percentage = PCT
    sc.eevee.taa_render_samples = SAMPLES
    sc.render.use_motion_blur = False
    sc.frame_start, sc.frame_end = 1, 200
    gm = mat.painterly("LD_ground", (0.30, 0.29, 0.28), stroke="strokes_broad", scale=0.6, tex_amt=0.8)
    g = geo.box("LD_ground", (40, 40, 0.1), (0, 0, -0.05), mat=gm)
    return sc


def set_rig(name, cam_loc, target):
    R = RIGS[name]
    for o in [o for o in bpy.data.objects if o.name.startswith("LD_L_")]:
        bpy.data.objects.remove(o)
    top, hor, bot = R["world"]
    scene.world_color(top, hor, R["we"], bottom=bot)
    view = Vector(target) - Vector(cam_loc)
    view.z = 0
    view.normalize()
    right = view.cross(Vector((0, 0, 1))).normalized()

    def ldir(az, el):
        a, e = math.radians(az), math.radians(el)
        return ((-view) * math.cos(a) + right * math.sin(a)) * math.cos(e) + Vector((0, 0, math.sin(e)))

    az, el, col, e, ang = R["key"]
    k = scene.sun("LD_L_key", (0, 0, 0), col, e, angle=ang)
    k.rotation_euler = (-ldir(az, el)).to_track_quat("-Z", "Y").to_euler()
    if R.get("fill"):
        az, el, col, e = R["fill"]
        f = scene.sun("LD_L_fill", (0, 0, 0), col, e, angle=20, shadow=False)
        f.rotation_euler = (-ldir(az, el)).to_track_quat("-Z", "Y").to_euler()
    if R.get("rim"):
        az, el, col, e = R["rim"]
        ld = bpy.data.lights.new("LD_L_rim", "AREA")
        ld.energy, ld.color, ld.size = e, col, 1.5
        o = bpy.data.objects.new("LD_L_rim", ld)
        bpy.context.scene.collection.objects.link(o)
        scene.look_at(o, Vector(target) + ldir(az, el) * 3.0, target)
    amb = R["we"] * 0.62 * sum(hor) / 3
    look = dict(R["look"])
    look["TermLo"] = amb * 0.9 + 0.10 * R["key"][3]
    look["TermHi"] = amb * 1.2 + 0.34 * R["key"][3]
    if "term" in R:
        look["TermLo"], look["TermHi"] = R["term"]
    mat.set_look(**look)


def camera(loc, target, lens=50.0, fstop=None, focus=None):
    for o in [o for o in bpy.data.objects if o.type == "CAMERA"]:
        bpy.data.objects.remove(o)
    return scene.camera("LD_cam", lens=lens, loc=loc, target=target, fstop=fstop, focus=focus)


def finish_and_render(path, post_kw=None):
    if POST:
        try:
            from lu import post
            kw = dict(haze_amt=0.0, vignette=0.12)
            kw.update(post_kw or {})
            post.setup(**kw)
        except Exception as ex:
            print("POST failed (rendering without the finish):", ex)
            sc_ = bpy.context.scene
            try:
                sc_.compositing_node_group = None
            except Exception:
                pass
            sc_.render.use_compositing = False
    t = time.time()
    scene.render_still(path)
    TIMES.append((os.path.basename(path), round(time.time() - t, 1)))
    print("RENDER", path, TIMES[-1][1])


def sheet(out, cols, items):
    subprocess.run(["python3", os.path.join(SRC, "sheet.py"), out, str(cols)] + [f"{p}={l}" for p, l in items])
    print("SHEET", out)


def head_frame(c):
    """(face point, forward unit vector) of Claude's face block at the current pose."""
    bpy.context.view_layer.update()
    pb = c.rig.pose.bones["head"]
    R = c.rig.matrix_world.to_3x3() @ pb.matrix.to_3x3() @ c.rest3i["head"]
    return c.point("face"), (R @ Vector((0, -1, 0))).normalized()


def frame_root(P, yaw, dist, h, tz, lens=50.0, fstop=None, tx=0.0):
    """Camera from the character's front (yaw deg toward its left = screen-right), looking at height tz."""
    hd = math.radians(P.get("heading", 0.0) + yaw)
    root = Vector((P.get("x", 0.0), P.get("y", 0.0), P.get("z", 0.0)))
    tgt = root + Vector((tx, 0, tz))
    loc = tgt + Vector((math.sin(hd), -math.cos(hd), 0)) * dist + Vector((0, 0, h))
    camera(loc, tgt, lens=lens, fstop=fstop)
    return loc, tgt


def remove_face_lights():
    for o in [o for o in bpy.data.objects if o.name.startswith(("FaceLight_", "LD_face"))]:
        bpy.data.objects.remove(o)


def face_light(c, cam_loc, e=18.0, col=(1.0, 0.9, 0.8)):
    remove_face_lights()
    return c.face_light(cam_loc, energy=e, col=col, dist=1.4, size=0.8)


def wanted(key):
    return not ONLY or key in ONLY


# ---------------------------------------------------------------- sprout (real if available, else a proxy)
def make_sprout(name="Sprout", light=True):
    try:
        from lu import sprout
        return sprout.Sprout(name, light=light)
    except Exception as ex:
        import traceback
        traceback.print_exc()
        print("SPROUT unavailable, proxy:", ex)
        return None


# ================================================================ parts
sc = build_base()
C = claude.Claude("Claude")
print("BUILD claude", round(time.time() - T0, 1))

if "r" in PARTS:
    # orthographic FRONT view at the reference's scale, beside refs/claude-mascot.png (4x), + a colour measurement
    from lu.paths import REFS
    C.apply({})
    sc.frame_set(1)
    W_PX, H_PX, K = 1000, 756, 4                         # 250 x 189 ref px at 4x
    res = (sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage)
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = W_PX, H_PX, 100
    ortho = 0.70 * W_PX / (147 * K)
    zc = claude.ZC - (94.5 - 70.0) / 147.0 * 0.70        # ref body centre is 24.5 px above the image centre
    xc = -(125.0 - 125.0) / 147.0 * 0.70
    cam = camera((xc, -6.0, zc), (xc, 0.0, zc), lens=50)
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ortho
    set_rig("grey", (0, -6.0, zc), (0, 0, zc))
    p = os.path.join(OUTDIR, "ref_front.png")
    finish_and_render(p, dict(focus_xy=(0.5, 0.5), vignette=0.0, grain=0.0))
    sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = res
    if True:     # compare + measurement with the system python's Pillow
        subprocess.run(["python3", "-c", f"""
from PIL import Image
import numpy as np
ref = Image.open({os.path.join(REFS, 'claude-mascot.png')!r}).convert('RGB').resize(({W_PX}, {H_PX}), Image.NEAREST)
ren = Image.open({p!r}).convert('RGB')
a = np.array(ren).astype(float)
def patch(x, y, r=6):
    return a[y - r:y + r, x - r:x + r].reshape(-1, 3).mean(0)
# lit front-face samples between the eyes and the arms, and on the cheeks
pts = [(500, 230), (440, 300), (560, 300), (380, 250), (620, 250)]
vals = [patch(x, y) for x, y in pts]
m = np.mean(vals, 0)
out = Image.new('RGB', ({W_PX} * 2 + 30, {H_PX}), (20, 20, 22))
out.paste(ref, (0, 0)); out.paste(ren, ({W_PX} + 30, 0))
from PIL import ImageDraw, ImageFont
d = ImageDraw.Draw(out)
f = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 26)
d.text((12, 10), 'refs/claude-mascot.png (4x)', fill=(20, 20, 20), font=f)
d.text(({W_PX} + 42, 10), 'Claude 3D, ortho front, neutral grey light + post', fill=(20, 20, 20), font=f)
d.rectangle([{W_PX} + 42, 46, {W_PX} + 102, 86], fill=tuple(int(c) for c in m))
d.rectangle([{W_PX} + 102, 46, {W_PX} + 162, 86], fill=(218, 119, 88))
d.text(({W_PX} + 172, 50), 'lit front face %s vs ref (218,119,88)' % (tuple(int(round(c)) for c in m),), fill=(20, 20, 20), font=f)
out.save({os.path.join(OUTDIR, 'ref_compare.png')!r})
print('FRONT_COLOUR', tuple(int(round(c)) for c in m), [tuple(int(round(c)) for c in v) for v in vals])
"""])
    print("SHEET", os.path.join(OUTDIR, "ref_compare.png"))

if "a" in PARTS:
    C.apply(acting.emotion("smile", smile=0.0, eye_happy=0.0))
    items = []
    for key, yaw in (("front", 0), ("threequarter", 38), ("side", 90), ("back", 180)):
        if not wanted(key):
            continue
        h = math.radians(yaw)
        tgt = Vector((0, 0, 0.36))
        loc = tgt + Vector((math.sin(h), -math.cos(h), 0)) * 3.4 + Vector((0, 0, 0.42))
        camera(loc, tgt, lens=50)
        set_rig("grey", loc, tgt)
        p = os.path.join(OUTDIR, f"a_{key}.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        items.append((p, key))
    if items:
        sheet(os.path.join(OUTDIR, "a_sheet.png"), 2, items)

if "b" in PARTS:
    names = ["neutral", "grief", "curious", "wonder", "worried", "determined", "effort", "flinch", "despair",
             "laugh", "sleep", "smile"]
    items = []
    tear_drop = None
    for nm in names:
        if not wanted(nm):
            continue
        Fc, Bd = acting.EMOTIONS[nm]
        # close-ups: the face preset + only the head/upper-body attitude of the body preset (hands out of frame)
        P = {k: v for k, v in Bd.items() if k in ("head_nod", "head_tilt", "head_turn", "squash")}
        P["bend"] = Bd.get("bend", 0.0) * 0.35
        P.update(Fc)
        frame = 1
        if nm == "despair":
            if tear_drop is None:
                tear_drop = C.tear("R", 20, dur=1.6)
            frame = 20 + int(0.55 * 1.6 * 24)
        sc.frame_set(frame)
        C.apply(P)
        f, fwd = head_frame(C)
        fwd.z = max(-0.15, min(0.25, fwd.z))
        fwd.normalize()
        side = Vector((fwd.y, -fwd.x, 0)).normalized()
        loc = f + fwd * 1.35 + side * 0.30 + Vector((0, 0, 0.04))
        camera(loc, f + Vector((0, 0, 0.0)), lens=50, fstop=4.0)
        set_rig("grey", loc, f)
        face_light(C, loc, e=14.0)
        p = os.path.join(OUTDIR, f"b_{nm}.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        items.append((p, nm if nm != "despair" else "despair + tears"))
    remove_face_lights()
    if items:
        sheet(os.path.join(OUTDIR, "b_sheet.png"), 3, items)
    sc.frame_set(1)

if "c" in PARTS:
    SP = make_sprout("SproutC", light=True)
    ledge = None
    poses = []
    # 1 grief (kneeling, hunched over the ash)
    poses.append(("grief", acting.emotion("grief"), 38, None))
    # 2 running (mid-bound, sprout clutched), sampled from the run gait
    path = anim.Path([(0.0, 0.0, 2.0), (3.0, 0.0, -2.0)], ease_="linear")
    runl = acting.run(path)
    pr = dict(acting.B_RUN_HOLD)
    pr.update(acting.F_DETERMINED)
    runl(1.43, pr)
    pr["x"], pr["y"] = 0.0, 0.0
    poses.append(("running", pr, 72, None))
    # 3 curled over the sprout (hail)
    poses.append(("curled over the sprout", acting.emotion("flinch"), 40, None))
    # 4 hauling up a ledge (one arm on the rock, the other clutching the sprout)
    ph = dict(acting.B_HAUL)
    ph.update(acting.F_EFFORT)
    poses.append(("hauling up a ledge", ph, 95, "ledge"))
    # 5 kneeling and planting
    pk = dict(acting.B_KNEEL_PLANT)
    pk.update(acting.F_TENDER)
    pk["look_y"] = -0.8
    poses.append(("kneeling, planting", pk, 40, "soil"))
    # 6 arms-up joy
    pj = acting.emotion("laugh")
    pj.update(acting.B_JOY)
    pj["hop"] = 0.06
    poses.append(("arms-up joy", pj, 28, None))
    items, sil = [], []
    for nm, P, yaw, prop in poses:
        key = nm.split()[0].replace(",", "")
        if not wanted(key):
            continue
        for o in [o for o in bpy.data.objects if o.name.startswith("LD_prop")]:
            bpy.data.objects.remove(o)
        C.apply(P)
        if prop == "ledge":
            rock = mat.painterly("LD_rock", (0.22, 0.21, 0.22), stroke="strokes_broad", scale=2.0)
            geo.box("LD_prop_ledge", (0.75, 0.9, 0.78), (0.0, -0.265 - 0.45, 0.39), mat=rock, bevel=0.03)
        if SP is not None:
            sp_pose = dict(acting.S_SPROUT)
            if nm.startswith("curled"):
                sp_pose = dict(acting.S_SHIVER)
            if prop == "soil":
                SP.apply(dict(sp_pose, x=0.0, y=-0.47, z=0.0, heading=180.0))
            elif nm.startswith(("grief", "arms")):
                SP.apply(dict(sp_pose, x=0.0, y=-0.62, z=-0.5))     # out of shot
            else:
                bpy.context.view_layer.update()
                cp = C.point("cradle")
                SP.apply(dict(sp_pose, x=cp.x, y=cp.y, z=cp.z - 0.05, heading=180.0 + P.get("heading", 0.0),
                              clod=1.0))
        loc, tgt = frame_root(P, yaw, 3.6, 0.35, 0.40 if prop != "ledge" else 0.52, lens=42)
        set_rig("grey", loc, tgt)
        remove_face_lights()
        p = os.path.join(OUTDIR, f"c_{key}.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        items.append((p, nm))
        # flat silhouette (Workbench, black on white)
        eng = sc.render.engine
        sc.render.engine = "BLENDER_WORKBENCH"
        sh = sc.display.shading
        sh.light, sh.color_type, sh.single_color = "FLAT", "SINGLE", (0.0, 0.0, 0.0)
        sh.background_type = "WORLD"
        sc.world.color = (1.0, 1.0, 1.0)
        gnd = bpy.data.objects["LD_ground"]
        gnd.hide_render = True
        led = bpy.data.objects.get("LD_prop_ledge")
        if led:
            led.hide_render = True
        uc = sc.render.use_compositing
        sc.render.use_compositing = False
        ps = os.path.join(OUTDIR, f"c_{key}_sil.png")
        scene.render_still(ps)
        sc.render.use_compositing = uc
        sc.render.engine = eng
        gnd.hide_render = False
        if led:
            led.hide_render = False
        sil.append((ps, nm))
    if items:
        sheet(os.path.join(OUTDIR, "c_sheet.png"), 3, items)
        sheet(os.path.join(OUTDIR, "c_silhouettes.png"), 3, sil)
    for o in [o for o in bpy.data.objects if o.name.startswith("LD_prop")]:
        bpy.data.objects.remove(o)
    if SP is not None:
        SP.apply(dict(z=-5.0))

if "d" in PARTS:
    states = [("ash", dict(acting.emotion("grief"), ash=1.0), "grey"),
              ("wet", dict(acting.emotion("determined"), wet=1.0, ash=0.25), "storm"),
              ("damaged", dict(acting.emotion("despair"), damage=1.0, wet=0.6, ash=0.15), "storm"),
              ("gold", dict(acting.emotion("smile"), damage=1.0, gold=1.0), "spring")]
    items, items_n = [], []
    for nm, P, rigname in states:
        if not wanted(nm):
            continue
        C.apply(P)
        f, fwd = head_frame(C)
        loc, tgt = frame_root(P, 30, 2.2, 0.15, f.z - 0.12, lens=50, fstop=5.6)
        for rn, lst in ((rigname, items), ("grey", items_n)):
            set_rig(rn, loc, tgt)
            face_light(C, loc, e=12.0 if rn != "storm" else 6.0,
                       col=(1.0, 0.9, 0.8) if rn != "storm" else (0.75, 0.8, 1.0))
            p = os.path.join(OUTDIR, f"d_{nm}{'' if lst is items else '_neutral'}.png")
            finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
            lst.append((p, f"{nm} ({rn})"))
    # the coda payoff at medium-wide distance in warm afternoon light (the gold must read as gold from here)
    if wanted("goldwide"):
        P = dict(acting.emotion("smile"), damage=1.0, gold=1.0, heading=-25.0)
        C.apply(P)
        loc, tgt = frame_root(P, 30, 4.4, 0.6, 0.40, lens=40)
        set_rig("spring", loc, tgt)
        p = os.path.join(OUTDIR, "d_gold_wide.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        items_n.append((p, "gold kintsugi, medium-wide (spring)"))
        P = dict(acting.emotion("despair"), damage=1.0, gold=0.0, heading=-25.0, wet=0.4)
        C.apply(P)
        set_rig("grey", loc, tgt)
        p = os.path.join(OUTDIR, "d_damaged_wide.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        items_n.append((p, "same cracks before the gold, medium-wide"))
    remove_face_lights()
    if items:
        sheet(os.path.join(OUTDIR, "d_sheet.png"), 2, items + items_n)

if "g" in PARTS:
    C.apply(acting.emotion("smile", smile=0.5, mouth_open=0.0))
    items = []
    tgt = Vector((0, 0, 0.42))
    h = math.radians(30)
    loc = tgt + Vector((math.sin(h), -math.cos(h), 0)) * 2.4 + Vector((0, 0, 0.25))
    camera(loc, tgt, lens=50)
    for rn in ("grey", "storm", "beam", "spring"):
        if not wanted(rn):
            continue
        set_rig(rn, loc, tgt)
        FL = {"grey": (10.0, (1.0, 0.92, 0.82)), "storm": (8.0, (0.70, 0.78, 1.0)), "beam": (8.0, (1.0, 0.78, 0.5)),
              "spring": (8.0, (1.0, 0.92, 0.8))}[rn]
        face_light(C, loc, e=FL[0], col=FL[1])
        for o in [o for o in bpy.data.objects if o.name.startswith("Claude_Rim")]:
            bpy.data.objects.remove(o)
        if rn == "beam":
            C.rim_light(loc, sdir(110, 38), col=(1.0, 0.72, 0.36), energy=260.0)
        p = os.path.join(OUTDIR, f"g_{rn}.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        items.append((p, rn))
    remove_face_lights()
    if items:
        sheet(os.path.join(OUTDIR, "g_sheet.png"), 2, items)

def hide_claude(hide=True):
    for o in C.col.objects:
        if o.type in ("MESH", "LIGHT"):
            o.hide_render = hide


if "e" in PARTS:
    from lu import sprout as SPM
    S = make_sprout("SproutE")
    hide_claude(True)
    items = []
    stages = [("seed", dict(acting.S_SEED, glow=0.6), 0.055),
              ("cracking", dict(acting.S_SEED, grow=0.12, crack=0.65, glow=1.3, health=0.9), 0.06),
              ("sprout (grow 1)", dict(acting.S_SPROUT, mouth=0.3), 0.13),
              ("bigger (grow 2)", dict(acting.S_SPROUT, grow=2.0, mouth=0.3, leafL_reach=15, leafR_reach=15), 0.23),
              ("sapling (grow 3)", dict(acting.S_SPROUT, grow=3.0, mouth=0.4, leafL_reach=20, leafR_reach=25), 0.70),
              ("shy", dict(acting.S_SHY), 0.13), ("happy", dict(acting.S_HAPPY), 0.13),
              ("wilted", dict(acting.S_WILT), 0.13), ("curl (finger)", dict(acting.S_CURL_FINGER), 0.13)]
    for nm, P, h in stages:
        key = nm.split()[0]
        if not wanted(key):
            continue
        S.apply(P)
        tgt = Vector((0, 0, h * 0.5))
        hd = math.radians(24)
        loc = tgt + Vector((math.sin(hd), -math.cos(hd), 0)) * h * 3.1 + Vector((0, 0, h * 0.45))
        camera(loc, tgt, lens=50, fstop=2.8)
        bpy.data.objects["LD_cam"].data.dof.focus_distance = (tgt - loc).length
        set_rig("grey", loc, tgt)
        p = os.path.join(OUTDIR, f"e_{key}.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        items.append((p, nm))
    # B19: the sapling leans against Claude like a hug (close-up read)
    if wanted("hug"):
        hide_claude(False)
        Pc = acting.emotion("laugh", tears=0.8, head_tilt=-12.0, head_turn=-10.0, look_x=0.7, look_y=0.1)
        Pc.update(acting.B_STAND)
        Pc.update(armL_ik=1.0, armL_follow=0.0, handL_x=0.53, handL_y=0.02, handL_z=0.36, armL_twist=60.0,
                  handL_curl=0.7, handL_thumb=0.6, armL_pole=20.0, roll=-4.0)
        C.apply(Pc)
        S.apply(dict(acting.S_HUG, grow=3.0, x=0.50, y=-0.16, heading=-58.0, lean=22.0, side=-4.0, head_nod=-6.0,
                     leafL_reach=70.0, leafR_reach=60.0, leafL_curl=0.6, leafR_curl=0.55, glow=1.2, look_x=-0.3))
        sc.frame_set(1)
        f = C.point("face")
        tgt = f + Vector((0.26, 0, -0.10))
        loc = tgt + Vector((0.25, -2.0, 0.10))
        camera(loc, tgt, lens=50, fstop=4.0)
        set_rig("spring", loc, tgt)
        face_light(C, loc, e=8.0, col=(1.0, 0.9, 0.78))
        p = os.path.join(OUTDIR, "e_sapling_hug.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        remove_face_lights()
        items.append((p, "B19: the sapling leans into Claude (hug)"))
        hide_claude(True)
    if items:
        sheet(os.path.join(OUTDIR, "e_sheet.png"), 3, items)
    # the great tree of the coda, with the new swing and Claude napping on it (gold kintsugi)
    if wanted("tree"):
        S.apply(dict(z=-5.0))
        T = SPM.great_tree("GreatTree", base=(0, 6.0, 0), height=7.5, swing_dir=(1.0, -0.35))
        sw = SPM.swing("Swing", hang_point=T["swing_point"], length=T["swing_length"], heading=-15.0)
        hide_claude(False)
        Pc = acting.emotion("sleep", damage=1.0, gold=1.0, head_tilt=12.0, head_nod=8.0)
        Pc.update(SPM.sit_on(C, sw))
        C.apply(Pc)
        sc.frame_set(30)
        tgt = Vector((T["swing_point"].x - 1.6, 6.0, 4.1))
        loc = tgt + Vector((3.5, -21.0, -2.6))
        camera(loc, tgt, lens=28)
        set_rig("spring", loc, tgt)
        p = os.path.join(OUTDIR, "e_greattree.png")
        finish_and_render(p, dict(focus_xy=(0.5, 0.5)))
        # medium: the swing, the gold-mended Claude napping on it under the blossom
        f = C.point("face")
        loc_m = f + Vector((1.2, -3.2, 0.35))
        camera(loc_m, f + Vector((0, 0, 0.25)), lens=40, fstop=4.0)
        set_rig("spring", loc_m, f)
        face_light(C, loc_m, e=6.0, col=(1.0, 0.9, 0.75))
        pm = os.path.join(OUTDIR, "e_coda_swing.png")
        finish_and_render(pm, dict(focus_xy=(0.5, 0.5)))
        # close on the napping, gold-mended Claude
        loc2 = f + Vector((0.55, -1.25, 0.15))
        camera(loc2, f + Vector((0, 0, -0.05)), lens=50, fstop=2.8)
        set_rig("spring", loc2, f)
        face_light(C, loc2, e=8.0, col=(1.0, 0.9, 0.75))
        p2 = os.path.join(OUTDIR, "e_coda_nap.png")
        finish_and_render(p2, dict(focus_xy=(0.5, 0.5)))
        remove_face_lights()
        sheet(os.path.join(OUTDIR, "e_tree_sheet.png"), 1, [(p, "great tree + swing (coda)"),
                                                            (pm, "the swing: seat 0.45 m, Claude napping"),
                                                            (p2, "gold kintsugi nap")])
        C.rig.constraints.remove(C.rig.constraints["swing"])
        for o in list(T["objects"]) + [sw["seat"]] + sw["ropes"]:
            o.hide_render = True
        sc.frame_set(1)
    S.apply(dict(z=-5.0))
    hide_claude(False)

def circumcentre(a, b, c):
    ab, ac = b - a, c - a
    n = ab.cross(ac)
    if n.length < 1e-9:
        return (a + c) / 2
    return a + (n.cross(ab) * ac.length_squared + ac.cross(n) * ab.length_squared) / (2 * n.length_squared)


if "f" in PARTS:
    # the emotional two-shot: a dark ash dusk; Claude kneels with the sprout on its cupped right palm; the sprout's
    # leaf curls round Claude's left thumb; the seed's green glow lights Claude's face and fills its eyes
    S = make_sprout("SproutF")
    sc.frame_set(1)
    Pc = dict(acting.B_HOLD)
    Pc.update(acting.F_WONDER)
    Pc.update(smile=0.7, mouth_open=0.30, mouth_o=0.05, look_y=-0.75, look_x=0.0, eye_tilt=0.45, pupil=1.55,
              eye_happy=0.15, crouch=0.6, lean=3.0, head_nod=8.0, brand=0.0, vivid=0.25, ash=0.35,
              handL_z=0.31, handR_z=0.31, cradle_y=-0.03, cradle_z=-0.02)
    C.apply(Pc)
    sc.frame_set(1)
    S.ride(C, "cradle")
    Ps = dict(acting.S_CURL_FINGER, x=0.0, y=0.0, z=0.0, heading=150.0, grow=1.15, glow=2.0, look_y=0.7,
              look_x=0.5, head_turn=20.0, leafR_reach=20.0, leafR_curl=0.15, eye_happy=0.45, mouth=0.75, blush=0.6)
    S.apply(Ps)
    thumb = C.point("thumbR")
    # slide the sprout in Claude's cupped hands until its curled left leaf rings Claude's right thumb
    Ps.update(leafL_reach=25.0, leafL_curl=0.65, lean=10.0)
    for _ in range(6):
        S.apply(Ps)
        sc.frame_set(1)
        pb, mw = S.rig.pose.bones, S.rig.matrix_world
        cc = circumcentre(mw @ pb["leafL1"].head, mw @ pb["leafL2"].head, mw @ pb["leafL2"].tail)
        dlt = S.anchor.matrix_world.to_3x3().inverted() @ (thumb - cc)
        Ps["x"] += dlt.x
        Ps["y"] += dlt.y
        Ps["z"] += dlt.z * 0.5
    print("LEAF-RING", round((cc - thumb).length, 4))
    S.apply(Ps)
    palm = C.point("cradle")
    f = C.point("face")
    eye = C.point("eyeL").lerp(C.point("eyeR"), 0.5)
    tgt_c = eye.lerp(palm, 0.5)
    loc = tgt_c + Vector((0.36, -1.75, -0.04))
    camera(loc, tgt_c, lens=40, fstop=2.2)
    bpy.data.objects["LD_cam"].data.dof.focus_distance = (S.point("head") - loc).length * 0.6 + (f - loc).length * 0.4
    set_rig("dusk", loc, tgt_c)
    p = os.path.join(OUTDIR, "f_twoshot.png")
    finish_and_render(p, dict(focus_xy=(0.5, 0.5), bloom=0.8))
    # insert: the leaf curled round Claude's thumb
    hs = S.point("head")
    ti = hs.lerp(thumb, 0.5)
    loc2 = ti + Vector((-0.20, -0.40, 0.02))
    camera(loc2, ti, lens=55, fstop=4.0)
    bpy.data.objects["LD_cam"].data.dof.focus_distance = (ti - loc2).length
    set_rig("dusk", loc2, ti)
    p2 = os.path.join(OUTDIR, "f_insert.png")
    finish_and_render(p2, dict(focus_xy=(0.5, 0.5), bloom=0.8))
    sheet(os.path.join(OUTDIR, "f_sheet.png"), 1, [(p, "two-shot: the seed's green glow on Claude's face"),
                                                   (p2, "insert: the leaf curls round the end of Claude's hand")])

with open(os.path.join(OUTDIR, "timing.txt"), "w") as fh:
    fh.write(f"total {round(time.time() - T0, 1)} s\n")
    for n, t in TIMES:
        fh.write(f"{n} {t}\n")
print("DONE", round(time.time() - T0, 1))
