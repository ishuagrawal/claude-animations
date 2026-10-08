"""C01 — EXT spring morning, some time later: the windmill turns again — its sails re-covered in mismatched patches
(the red, the blue, a square of the old quilt). Birds. On the gallery stands a new, home-made telescope of wood and
brass bands. Claude (a little more weathered) leans on the rail beside it, at peace."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, finale, windmill, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT

T_CUT = 4.3
SUN = (0.72, -0.5, 0.48)       # morning sun, low in the south-east: lights the sails' face and Claude


def birds(center, n, f0, f1, seed=0, spread=(30.0, 12.0, 6.0), vel=(-3.0, 1.0, 0.3), size=0.35):
    """A loose flock of little painted birds (two flapping wing quads each) crossing the sky."""
    rng = np.random.default_rng(seed)
    m = bpy.data.materials.get("Bird") or mat.painterly("Bird", (0.12, 0.1, 0.1), stroke="strokes_fine", scale=8,
                                                       tex_amt=0.4, snow=0.0)
    out = []
    for i in range(n):
        w = size * rng.uniform(0.8, 1.25)
        verts = [(0, -0.12 * w, 0), (0, 0.18 * w, 0), (-w, 0.02 * w, 0), (w, 0.02 * w, 0)]
        faces = [(0, 1, 2), (1, 0, 3)]
        o = geo.obj_from(f"Bird{i}", verts, faces, None, m, smooth=False)
        o.visible_shadow = False
        p0 = Vector(center) + Vector(rng.uniform(-0.5, 0.5, 3)) * Vector(spread)
        v = Vector(vel) * rng.uniform(0.85, 1.15)
        hd = math.atan2(v.y, v.x) - math.pi / 2
        ph, fr = rng.uniform(0, 6.28), rng.uniform(4.5, 6.5)
        me = o.data
        sk = o.shape_key_add(name="Basis")
        up = o.shape_key_add(name="Up")
        dn = o.shape_key_add(name="Down")
        for kb, dz in ((up, 0.55), (dn, -0.45)):
            kb.data[2].co.z = dz * w
            kb.data[3].co.z = dz * w
        for f in range(f0, f1, 2):
            t = (f - f0) / 24
            o.location = p0 + v * t + Vector((0, 0, 0.3 * math.sin(t * 1.3 + ph)))
            o.rotation_euler = (0, 0, hd)
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
            s_ = math.sin(t * fr * 2 * math.pi / 2 + ph)
            up.value, dn.value = max(0.0, s_), max(0.0, -s_)
            up.keyframe_insert("value", frame=f)
            dn.keyframe_insert("value", frame=f)
        out.append(o)
    return out


def make(f0, f1):
    W = world.World("ext", "day", season="spring", sun_dir=SUN, windmill_state=dict(sails_angle=0.0))
    O = W.origin
    dur = (f1 - f0) / 24
    finale.patch_canvas()
    hub = W.wm["hub"]
    for f in range(f0, f1):
        windmill.sails_set_angle(hub, 12.0 + 11.0 * (f - f0) / 24)
        hub.keyframe_insert("rotation_euler", frame=f)
    # Claude at the outer rail of the gallery (south-east side, between two posts), arms folded over the middle rail,
    # face pushed between the rails, looking out over the morning
    gz = O.z + windmill.GALLERY_Z + 0.17
    a = math.radians(-53.0)
    out = Vector((math.cos(a), math.sin(a), 0))
    side = Vector((-out.y, out.x, 0))           # along the rail (counter-clockwise)
    r_rail = windmill.BASE_R / math.cos(windmill.K) + 0.9 - 0.07
    cpos = O + out * (r_rail - 0.27)
    cpos.z = gz
    hd = math.degrees(math.atan2(out.x, -out.y))
    STEP = 0.64                                  # two stacked crates: its lookout perch, arms on the top rail
    for k, (h, w, rz) in enumerate(((0.36, 0.66, 0.0), (0.28, 0.58, 6.0))):
        zb = gz - 0.01 + (0.0 if k == 0 else 0.36)
        st_ = geo.box(f"RailStep{k}", (w, 0.46, h), loc=(0, 0, 0), mat=W.wm["mats"]["wood"], bevel=0.015)
        st_.location = (cpos.x, cpos.y, zb + h / 2)
        st_.rotation_euler = (0, 0, math.radians(hd + rz))
    T = finale.scrap_telescope()
    tp = cpos - side * 0.85 - out * 0.05
    T["root"].location = (tp.x, tp.y, gz)
    T["root"].rotation_euler = (0, 0, math.atan2(out.y, out.x) - math.pi / 2 - math.radians(62))
    c = W.claude("Claude")
    tr = Track()
    lean_on = dict(armL_up=-14, armR_up=-14, armL_fwd=50, armR_fwd=50, armL_bend=-12, armR_bend=-12, lean=10, slump=3)
    tr.pose(0.0, S.merge(lean_on, x=cpos.x, y=cpos.y, z=gz + STEP, heading=hd, eye_happy=0.5, eye_open=0.78, look_y=-0.05,
                         look_x=0.0, head_tilt=5, head_turn=0, squash=-0.02))
    tr.key(2.4, "inout", look_x=0.35, head_turn=10, head_tilt=7)
    tr.key(T_CUT + 0.4, "inout", look_x=0.25, head_turn=8, eye_happy=0.55)
    tr.key(6.3, "inout", look_x=-0.5, look_y=0.25, head_turn=-6, head_tilt=2, eye_happy=0.65, eye_open=0.72)  # a glance at the telescope
    tr.key(dur, "soft", look_x=0.1, look_y=0.1, head_turn=6, head_tilt=6, eye_happy=0.7, eye_open=0.7)
    tr.layer(anim.breathe(0.014, 0.22))
    tr.layer(anim.blinks(times=[1.6, 3.7, 5.2, 7.4], dur=0.17))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # birds crossing the morning sky
    birds(O + Vector((12.0, -9.0, 13.5)), 7, f0, f1, seed=4, spread=(14.0, 8.0, 4.0), vel=(-3.4, 0.9, 0.2), size=0.6)
    birds(O + Vector((-11.0, -12.0, 10.0)), 4, f0, f1, seed=9, spread=(8, 5, 3), vel=(2.6, 0.4, 0.4), size=0.5)
    # A: from the spring meadow, a slow crane up toward the gallery: the patched sails turning, Claude at the rail
    face = cpos + Vector((0, 0, STEP + 0.6))
    eA0 = O + Vector((6.0, -26.0, 0.0))
    eA0.z = W.ground(eA0.x, eA0.y) + 1.3
    eA1 = O + Vector((7.6, -14.5, 0.0))
    eA1.z = O.z + 2.6
    camA = scene.camera("CamA", lens=20)
    ca = Track(CAM_DEFAULT)
    tA0 = O + Vector((0.6, -2.5, 8.8))
    tA1 = O + Vector((1.0, -3.6, 6.8))
    ca.key(0.0, cx=eA0.x, cy=eA0.y, cz=eA0.z, tx=tA0.x, ty=tA0.y, tz=tA0.z, lens=22)
    ca.key(T_CUT, "soft", cx=eA1.x, cy=eA1.y, cz=eA1.z, tx=tA1.x, ty=tA1.y, tz=tA1.z, lens=24)
    ca.layer(lambda t, p: p.update(shake=0.12))
    anim.bake_camera(camA, ca, f0, f1 - 1, seed=81)
    # B: Claude close at the rail (long lens from the air), three-quarter front, the telescope beside it; the sunlit
    # tower falls soft behind, the patched sails' shadows sweeping across it
    vb = (out * math.cos(math.radians(30)) + side * math.sin(math.radians(30))).normalized()
    eB = face + vb * 5.6 + Vector((0, 0, 0.06))
    tB = face - side * 0.3 + Vector((0, 0, -0.08))
    camB = FR.shot_cam("CamB", f0, f1, eB, tB, 75, push=0.04, fstop=1.8, shake=0.1, seed=82, check=False, focus_on=face)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_CUT * 24))
    bpy.context.scene.camera = camA
    scene.char_lights(c.col, cpos + Vector((0, 0, 0.4)), eB, (-SUN[0], -SUN[1], SUN[2]), rim_col=(1.0, 0.95, 0.85),
                      rim_w=30.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=80.0, mist_depth=2500.0, bloom=0.35, bloom_thr=0.85))
