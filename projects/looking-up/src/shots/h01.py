"""H01 — EXT night: the meteor shower returns — streaks crossing the sky over the peak and the windmill, the
constellation above with its empty eye. Beautiful, and ominous: the way home is open."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, props, framing as FR


def bold_meteors(k=3.0):
    """Thicken the meteor streaks (they read as hairlines at this distance)."""
    for o in bpy.data.objects:
        if o.name.startswith("Meteor") and o.type == "MESH" and not o.get("bold"):
            o.data.transform(Matrix.Diagonal((k, k, 1.0, 1.0)))
            o["bold"] = 1


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(window_glow=0.6, sails_angle=33.0))
    O = W.origin
    dur = (f1 - f0) / 24
    props.constellation(origin=(O.x, O.y, 0), lines=0.16)
    props.meteors(60, 0.0, dur, f0, seed=13, origin=(O.x, O.y, 0), az_range=(40, 150), el_range=(20, 70),
                  length=(110, 240), dur=(0.5, 1.0))
    bold_meteors(3.0)
    eye = O + Vector((9.0, -16.0, 1.2))
    tgt = O + Vector((0.2, 7.0, 16.0))
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 22, push=0.03, fstop=0, shake=0.1, seed=51)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.5, mist_start=60.0, mist_depth=2000.0, bloom=0.85, bloom_thr=0.5,
                          bloom_size=8))
