"""SH13 (2 beats) - insert, the star's eyeline: from down in the flowers beside it, looking up past soft flower heads
at the Claude-shaped constellation - its right eye a dark, hollow socket; the chart lines flicker weakly, as if sad."""
import math
import bpy
from mathutils import Vector

from lu import props, anim
from shots.sh10 import meadow_world, cam_track, night_post, FPS, dress, LIE, mow_all
from shots.sh11 import lying_transform, star_nestle


def make(f0, f1):
    W, K = meadow_world(dense=False, frames=(f0, f1))
    dur = (f1 - f0) / FPS
    loc, R = lying_transform(W)
    sp, SR = star_nestle(loc, R)
    eye = sp + Vector((0.05, 0.1, 0.14))
    cdir = props.const_dir(0.4, -1.6)
    flat = Vector((cdir.x, cdir.y, 0)).normalized()
    tgt = eye + (flat * math.cos(math.radians(20.5)) + Vector((0, 0, math.sin(math.radians(20.5))))) * 60.0
    mow_all((eye.x, eye.y), 0.4)
    # a soft fringe of grass and flower heads along the bottom of frame, then the meadow edge and the cloud sea
    if dress is not None and hasattr(dress, "patch"):
        for i, (d, r, n) in enumerate(((1.1, 0.5, 160), (2.2, 1.2, 420))):
            c = eye + flat * d
            try:
                dress.patch((c.x, c.y), r, count=n, flowers=0.45, seed=130 + i, name=f"MeadowFore{i}", short=False)
            except Exception as e:
                print("SH13: dress.patch failed", e)
    if K is not None:
        if hasattr(props, "flicker_lines"):
            props.flicker_lines(f0 - 2, f1 + 2, base=0.42, amp=0.28, rate=6.0, seed=13)
        eo = K["eye"]
        eo["eye"] = 0.0
        if "socket" in eo.keys():
            eo["socket"] = 1.0
        if hasattr(props, "key_bright"):
            props.key_bright(0.92, f0)
            props.key_bright(0.85, f1)
    cam = cam_track("Cam", [
        (0.0, "linear", eye, tgt, 20, 0.0, None),
        (dur, "soft", eye + flat * 0.05, tgt + Vector((0, 0, 0.3)), 21, 0.0, None)], f0, f1, seed=131, shake=0.05)
    cd = cam.data
    cd.dof.use_dof = True
    cd.dof.aperture_fstop = 2.8
    cd.dof.focus_distance = 60.0
    bpy.context.scene.camera = cam
    return dict(post=night_post(W, bloom=0.85, bloom_thr=0.45, vignette=0.42, haze_amt=0.3))
