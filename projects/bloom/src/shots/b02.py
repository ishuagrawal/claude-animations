"""B02 (5.00-8.13, 5 beats): MS, eye level, 40 mm. The massive charred stump of Claude's home tree, its door-hole dark
behind Claude's right shoulder, the burnt rope swing hanging askew from the dead branch on the right, creaking. Claude
kneels in the ash at the stump's foot, head low, sifting the ash with both hands, slower and slower. A slow sad blink;
a breath in; at T_SIGH the sigh: the whole block deflates, the head sinks, and the breath puffs ash from its mouth.
Feeling: grief (valence -3)."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, acting, post, fx, sky, dress
from lu.anim import Track
from shots import act_ash as A

T_SIGH = 2.0


def sift(t0, t1, period=1.15, amp=1.0):
    """Both mittens scoop into the ash and let it run out between the fingers, alternating, dying away by t1."""
    def f(t, p):
        if t > t1:
            return
        w = amp * min(1.0, (t - t0) / 0.2) * (1.0 - anim.ease("inout", (t - t0) / (t1 - t0)) * 0.85)
        for side, ph in (("L", 0.0), ("R", 0.47)):
            u = ((t - t0) / period + ph) % 1.0
            dig = math.sin(2 * math.pi * u)
            p[f"hand{side}_z"] = p.get(f"hand{side}_z", 0.08) + 0.035 * w * dig
            p[f"hand{side}_y"] = p.get(f"hand{side}_y", -0.4) - 0.03 * w * math.cos(2 * math.pi * u)
            p[f"hand{side}_curl"] = p.get(f"hand{side}_curl", 0.35) + 0.3 * w * max(0.0, dig)
            p[f"hand{side}_bend"] = p.get(f"hand{side}_bend", 25.0) + 14.0 * w * dig
    return f


def make(f0, f1):
    dur = (f1 - f0) / 24
    W = world.World("ash", focus=A.SEED_SPOT, frames=(f0, f1))
    g = W.ground
    kx, ky = A.KNEEL_XY
    hd = A.KNEEL_HEADING
    dress.mow((kx, ky), 0.42)
    # ---- Claude: kneeling, sifting, the slow blink, the breath in, the sigh, stillness
    c = W.claude()
    base = dict(acting.B_SIFT)
    base.update(acting.F_GRIEF)
    base.update(A.ASH, x=kx, y=ky, z=g(kx, ky), heading=hd, eye_open=0.55, look_y=-0.75, head_tilt=4.0, lean=10.0,
                bend=3.0, head_nod=0.0,
                handL_x=0.17, handL_y=-0.38, handL_z=0.13, handR_x=-0.17, handR_y=-0.39, handR_z=0.13)
    tr = Track()
    tr.pose(0.0, base)
    tr.key(0.9, "inout", eye_open=0.5, head_tilt=5.5)
    # the breath in (lift, lids heavy)
    tr.key(T_SIGH - 0.62, "inout", squash=-0.06, head_nod=0.0, lean=10.0, bend=3.0, mouth_open=0.0, mouth_o=0.0)
    tr.key(T_SIGH - 0.05, "inout", squash=0.0, head_nod=-5.0, lean=7.0, bend=0.0, eye_open=0.32, mouth_open=0.05)
    # the sigh out: deflate, the head sinks lower than before, the mouth puffs
    tr.key(T_SIGH + 0.3, "out", squash=-0.1, head_nod=6.0, lean=12.0, bend=7.0, eye_open=0.42, mouth_open=0.24,
           mouth_o=0.55, smile=-0.35, eye_tilt=1.0)
    tr.key(T_SIGH + 0.85, "inout", squash=-0.085, head_nod=7.0, bend=8.0, mouth_open=0.02, mouth_o=0.0,
           smile=-0.6, wobble=0.25, eye_open=0.45, handL_z=0.12, handR_z=0.12, handL_curl=0.2, handR_curl=0.2)
    tr.key(dur, "soft", head_nod=8.0, eye_open=0.42, wobble=0.18)
    tr.layer(sift(0.0, T_SIGH - 0.3))
    tr.layer(acting.breathe(0.010, 0.3, arms=1.0))
    tr.layer(anim.blink_at(0.75, dur=0.7, depth=1.0))
    tr.layer(anim.saccades(seed=21, amp=0.06, every=(0.7, 1.4)))
    A.bake_claude(c, tr, f0, f1)
    # the sigh's breath blows a little cloud of ash up off the ground in front of the hands
    hx, hy = A.at_char(kx, ky, hd, fwd=0.46)
    fx.dust_puff((hx, hy), f0 + int((T_SIGH + 0.12) * 24), size=0.42, n=7, opacity=0.4, seed=26,
                 drift=(A.front(hd).x * 0.22, A.front(hd).y * 0.22, 0.02), color=A.ASH_PUFF)
    # a few ash grains trickling from the sifting mittens
    for k, t in enumerate((0.45, 1.05, 1.55)):
        sx, sy = A.at_char(kx, ky, hd, fwd=0.40, side=0.14 if k % 2 == 0 else -0.13)
        fx.dust_puff((sx, sy), f0 + int(t * 24), size=0.22, n=3, opacity=0.35, seed=30 + k, drift=(0.02, -0.03, 0.0),
                     color=A.ASH_PUFF)
    # ---- camera: south of Claude, low at its eye level; Claude left of centre, the door-hole behind it on the left,
    #      the swing on the right
    face = Vector((kx, ky, g(kx, ky) + 0.24))
    cam0 = Vector((2.35, -7.3, 0.0))
    cam0.z = g(cam0.x, cam0.y) + 1.0
    dress.mow((cam0.x - 0.5, cam0.y + 1.6), 1.5)
    tgt = Vector((0.95, -1.2, g(kx, ky) + 0.55))
    cam1 = cam0 + (face - cam0) * 0.16
    cam1.z -= 0.1
    tgt1 = tgt + Vector((0.0, 0.0, -0.12))
    A.cam_move("CamB02", f0, f1, [(0.0, "linear", cam0, tgt, 40.0, (face - cam0).length),
                                  (dur, "soft", cam1, tgt1, 40.0, (face - cam1).length)],
               shake=0.05, seed=202, fstop=4.0)
    # the last embers of its home smoulder inside the hollow: the door-hole reads as a faintly glowing arch
    lo = bpy.data.objects.new("HollowEmberLight", bpy.data.lights.new("HollowEmberLight", "POINT"))
    bpy.context.scene.collection.objects.link(lo)
    lo.data.color = (1.0, 0.32, 0.08)
    lo.data.energy = 9.0
    lo.data.shadow_soft_size = 0.4
    lo.location = (-0.05, -0.75, W.stump["ground_z"] + 0.25)
    for k, (t, e) in enumerate(((0.0, 9.0), (0.7, 7.0), (1.3, 10.0), (2.1, 6.5), (2.6, 8.5), (dur, 7.5))):
        lo.data.energy = e
        lo.data.keyframe_insert("energy", frame=f0 + int(t * 24))
    # ---- light: a soft grey-warm key on the face from the camera side, a cool rim from the sun behind
    c.face_light(cam0, energy=4.0, col=(1.0, 0.9, 0.8), dist=1.4, size=0.9, frame=f0)
    c.rim_light(cam0, sky.sun_vec(), col=(1.0, 0.86, 0.66), energy=40.0, dist=1.8, frame=f0)
    A.safe_shadows()
    A.animatic_readability()
    return dict(post=post.preset("ash", focus_xy=(0.45, 0.36), sat=A.SAT))
