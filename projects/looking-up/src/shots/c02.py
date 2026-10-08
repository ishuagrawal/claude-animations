"""C02 — EXT night, the gallery: Claude by its telescope, but not looking through it — just looking up. Above: the
Claude-shaped constellation, complete now, both eyes bright. Claude blinks twice, slowly. A beat... and the new eye-star
twinkles twice back. Claude's eyes fill with a gentle smile."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, finale, windmill, props, geo, framing as FR
from lu.anim import Track, CAM_DEFAULT

BL_C = (4.0, 4.5)
BL_S = (6.0, 6.5)
T_SKY = 5.2
T_BACK = 7.3
GAL_A = 6.0          # Claude's spot on the gallery (deg, 0 = +X): the east side, facing north to the constellation


PERCH = 0.64         # two stacked crates by the rail (as in C01): Claude's lookout perch, its face above the top rail


def gallery_spot(O, a_deg=GAL_A, inset=0.6):
    a = math.radians(a_deg)
    r = windmill.BASE_R / math.cos(windmill.K) + 0.9 - 0.07 - inset
    out = Vector((math.cos(a), math.sin(a), 0))
    return O + out * r, out


def perch(W, cpos, hd):
    """The crate stack Claude stands on (top at cpos.z + PERCH)."""
    for k, (h, w, rz) in enumerate(((0.36, 0.66, 0.0), (0.28, 0.58, 6.0))):
        zb = cpos.z - 0.01 + (0.0 if k == 0 else 0.36)
        st_ = geo.box(f"RailStep{k}", (w, 0.48, h), loc=(0, 0, 0), mat=W.wm["mats"]["wood"], bevel=0.015)
        st_.location = (cpos.x, cpos.y, zb + h / 2)
        st_.rotation_euler = (0, 0, math.radians(hd + rz))


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=0.0, window_glow=0.6), overrides=dict(stars=1.3))
    O = W.origin
    dur = (f1 - f0) / 24
    finale.patch_canvas()
    K = props.constellation(origin=(O.x, O.y, 0), lines=0.32, eye=1.0)
    eye = K["eye"]
    for f in range(f0, f1):
        t = (f - f0) / 24
        e = 1.0
        for b in BL_S:
            u = (t - b) / 0.34
            if 0 <= u <= 1:
                e += 2.6 * math.sin(math.pi * u)
        eye["eye"] = e
        eye.scale = (1 + 0.35 * (e - 1) / 2.6,) * 3
        eye.keyframe_insert('["eye"]', frame=f)
        eye.keyframe_insert("scale", frame=f)
    gz = O.z + windmill.GALLERY_Z + 0.17
    cpos, out = gallery_spot(O)
    cpos.z = gz
    look = props.const_dir(0, 0)
    flat = Vector((look.x, look.y, 0)).normalized()
    hd = math.degrees(math.atan2(flat.x, -flat.y))
    side = Vector((math.cos(math.radians(hd)), math.sin(math.radians(hd)), 0))     # Claude's left (screen right)
    T = finale.scrap_telescope()
    tp = cpos + side * 0.62 - flat * 0.45            # beside it, just behind its left shoulder
    T["root"].location = (tp.x, tp.y, gz)
    T["root"].rotation_euler = (0, 0, math.radians(hd) + math.radians(25))
    T["root"].scale = (1.25, 1.25, 1.25)
    perch(W, cpos, hd)
    gz += PERCH
    cpos.z = gz
    c = W.claude()
    eye_c = cpos + Vector((0, 0, 0.574))
    lp = S.look_params((cpos.x, cpos.y), hd, eye_c.z, eye.location)
    tr = Track()
    tr.pose(0.0, S.merge(S.C_WONDER, x=cpos.x, y=cpos.y, z=gz, heading=hd, look_y=1.0, look_x=lp["look_x"], head_nod=-13,
                         eye_open=0.88, lean=-11, armL_up=-22, armR_up=-22, eye_happy=0.0, head_tilt=0, pupil=1.08))
    tr.key(2.2, "inout", head_tilt=4, eye_open=0.85)
    tr.key(BL_C[0] - 0.3, "inout", head_tilt=5, eye_happy=0.12, eye_open=0.8)
    for b in BL_C:
        tr.layer(anim.blink_at(b, 0.42))
    tr.key(T_BACK - 0.2, "linear", eye_happy=0.12, head_tilt=5)
    tr.key(T_BACK + 0.7, "inout", eye_happy=0.85, eye_open=0.66, head_tilt=9, squash=0.04)
    tr.key(dur, "soft", eye_happy=0.9, head_tilt=10)
    tr.layer(anim.breathe(0.012, 0.25))
    tr.layer(anim.blinks(times=[1.3], dur=0.16))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # A / B: in front of it along the gallery, just under its eye line: Claude's upturned face against the night sky
    face = cpos + Vector((0, 0, 0.6))
    va = (flat * math.cos(math.radians(8)) + side * math.sin(math.radians(8))).normalized()
    eA = face + va * 2.2 + Vector((0, 0, -0.1))
    tA = face + Vector((0, 0, -0.02)) - side * 0.25
    camA = FR.shot_cam("CamA", f0, f1, eA, tA, 30, push=0.12, fstop=2.4, seed=83, check=False, focus_on=face)
    eB = face + va * 1.75 + Vector((0, 0, -0.08))
    tB = face + Vector((0, 0, -0.04)) - side * 0.12
    camB = FR.shot_cam("CamB", f0, f1, eB, tB, 34, push=0.06, fstop=2.2, seed=86, check=False, focus_on=face)
    # S: from just behind Claude's head, up at the whole constellation; the new eye twinkles twice
    eS = face - flat * 0.55 - side * 0.3 + Vector((0, 0, -0.12))
    tS = O + props.const_dir(1.0, -4.0) * 1800
    camS = FR.shot_cam("CamS", f0, f1, eS, tS, 30, push=0.0, lens_end=33, fstop=0, shake=0.04, seed=84, check=False)
    S.cut(camA, f0)
    S.cut(camS, f0 + int(T_SKY * 24))
    S.cut(camB, f0 + int(T_BACK * 24))
    bpy.context.scene.camera = camA
    scene.char_lights(c.col, cpos + Vector((0, 0, 0.4)), eA, (0.3, 0.8, 0.4), rim_col=(0.6, 0.75, 1.0), rim_w=22.0,
                      fill_col=(0.55, 0.65, 0.95), fill_w=5.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.4, mist_start=60.0, mist_depth=2000.0, bloom=0.85, bloom_thr=0.45))
