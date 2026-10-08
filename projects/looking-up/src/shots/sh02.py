"""SH02 - "Every day". Wide, from behind Claude's right shoulder and above, along the tower: Claude, tiny on its crate
perch at the north gallery rail, its lantern hanging on the hook beside it, looks up. Below and beyond: the meadow
falling away, the dark pine edge, the moonlit sea of clouds, the far peaks - and filling the sky above, the
Claude-shaped constellation, its chart lines faintly drawn. Loneliness: Claude small in the lower third, a huge sky.
A slow push-in; Claude breathes, and its head tilts up a little further toward its friend.

Staging note: the tower stands right behind Claude's mark, so a true rear view is impossible; the camera sits beside
the tower, behind-right, and the constellation is cheated lower/left for this one wide (CONST_CHEAT)."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, scene, windmill, finish
from lu import stage as S
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from shots import act1 as A

CONST_CHEAT = (137.0, 11.5)     # (azimuth, elevation) of the constellation centre in this shot only
T_TILT = 1.35                   # the small head tilt up toward the constellation


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=14.0 + 4.5 * 4.67, window_glow=0.85))
    O = W.origin
    dur = (f1 - f0) / 24
    G = A.gallery_set(W, f0, f1, sway=0.05, seed=2)
    p, hd = G["p"], G["hd"]
    hub = W.wm["hub"]
    for f in range(f0, f1, 2):
        windmill.sails_set_angle(hub, 14.0 + 4.5 * (f - f0 + 112) / 24)
        hub.keyframe_insert("rotation_euler", frame=f)
    K = A.constellation(O, lines=0.3, eye=1.0, center=CONST_CHEAT)
    # Claude, from behind: breathing, settled weight, the head tips further back toward the sky
    c = W.claude()
    tr = Track()
    tr.pose(0.0, dict(x=p.x, y=p.y, z=p.z, heading=hd + 44, head_nod=-6, head_turn=-4, lean=-3, armL_up=-12,
                      armR_up=-8, look_y=0.6, head_tilt=0))
    tr.key(T_TILT - 0.35, "inout", head_nod=-6, head_tilt=0)
    tr.key(T_TILT + 0.55, "inout", head_nod=-13, head_tilt=-5, lean=-5)
    tr.key(dur, "soft", head_nod=-14, head_tilt=-6)
    tr.layer(anim.breathe(0.014, 0.3))
    anim.anchor(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # fireflies drifting over the meadow below
    A.fireflies((1.5, 15.5, 1.4), 40, f0, f1, seed=21, spread=(9.0, 7.0, 1.6))
    # camera: beside the tower, behind-right of Claude and above; slow push-in
    e0 = Vector((6.5, 9.3, 6.75))
    az, el = math.radians(151.0), math.radians(4.0)
    aim = Vector((math.cos(el) * math.cos(az), math.cos(el) * math.sin(az), math.sin(el)))
    t0 = e0 + aim * 20
    e1 = e0 + (p + Vector((0, 0, 0.4)) - e0) * 0.08
    t1 = t0 + Vector((0, 0, 0.25))
    cam = A.cam_move("Cam", f0, f1, [(0.0, "linear", e0, t0, 24.0, None), (dur, "soft", e1, t1, 24.5, None)],
                     shake=0.05, seed=202)
    bpy.context.scene.camera = cam
    # flag the moonlight off the tower beside the lens: a dark repoussoir instead of bright boards
    A.moon_flag()
    scene.char_lights(c.col, p + Vector((0, 0, 0.4)), e0, (0.3, 0.8, 0.5), rim_col=(0.62, 0.78, 1.0), rim_w=26.0,
                      fill_col=(1.0, 0.7, 0.42), fill_w=4.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.5, mist_start=40.0, mist_depth=1800.0, bloom=0.85, bloom_thr=0.45,
                          vignette=0.42))
