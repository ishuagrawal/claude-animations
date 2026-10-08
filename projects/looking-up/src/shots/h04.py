"""H04 — EXT night: the windmill, every shutter closed, a faint warm seam of light at the windows — and above it the
sky is ablaze with falling stars. Nobody inside sees it."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, props, windmill, geo, mat, framing as FR
from shots.h01 import bold_meteors


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(window_glow=0.25, sails_angle=33.0))
    O = W.origin
    dur = (f1 - f0) / 24
    for nm, (frm, piv) in W.wm["windows"].items():
        for p in piv:
            windmill.set_shutter(p, 0.0)
    props.constellation(origin=(O.x, O.y, 0), lines=0.0)
    props.meteors(110, 0.0, dur, f0, seed=19, origin=(O.x, O.y, 0), az_range=(20, 170), el_range=(15, 75),
                  length=(110, 260), dur=(0.4, 1.0))
    bold_meteors(3.2)
    # a faint warm seam of lamplight where each pair of shutters meets
    seam_m = mat.emissive("ShutterSeam", (1.0, 0.62, 0.28), 4.0)
    for a_deg, z, h in ((-45, 1.16, 0.85), (45, 1.16, 0.85), (-90, windmill.BASE_H + 2.6, 0.72),
                        (135, windmill.BASE_H + 4.3, 0.65)):
        a = math.radians(a_deg)
        nrm = Vector((math.cos(a), math.sin(a), 0))
        r = windmill.tower_r(z) + 0.07
        p = O + nrm * (r + 0.155) + Vector((0, 0, z))
        sm = geo.box(f"Seam{a_deg}", (0.018, 0.01, h * 0.96), mat=seam_m)
        sm.matrix_world = Matrix.Translation(p) @ Matrix.Rotation(a + math.pi / 2, 4, "Z")
        sm.visible_shadow = False
    eye = O + Vector((4.5, -13.0, 0.6))
    tgt = O + Vector((0.5, 4.0, 12.0))
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 20, push=0.04, fstop=0, shake=0.05, seed=54)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.5, mist_start=60.0, mist_depth=2000.0, bloom=0.9, bloom_thr=0.5,
                          bloom_size=8))
