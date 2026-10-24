"""B03 (8.13-10.63, 4 beats): ECU on the ash under Claude's mittens, which sift once more and slow. A faint green glow
pulses up through the ash between them (T_PULSE[0]); the hands stop. Cut to an ECU of Claude's eyes, heavy-lidded:
the second, stronger pulse lights its face green from below (T_PULSE[1]) and at T_NOTICE the eyes go wide.
Feeling: curiosity breaking through grief (valence -2 -> -1)."""
import math
import bpy
from mathutils import Vector
from lu import world, anim, acting, post, fx, dress
from lu.anim import Track
from shots import act_ash as A

T_PULSE = (0.6, 1.5)
T_NOTICE = 1.6
T_CUT = 1.2                 # ash ECU -> eye ECU (before the second pulse, so the pulse is seen on Claude's face)


def make(f0, f1):
    dur = (f1 - f0) / 24
    F = lambda t: f0 + int(round(t * 24))
    W = world.World("ash", focus=A.SEED_SPOT, frames=(f0, f1))
    g = W.ground
    kx, ky = A.KNEEL_XY
    hd = A.KNEEL_HEADING
    sx, sy = A.SEED_SPOT
    A.seed_ground(W)
    fw, lf = A.front(hd), A.left(hd)
    # ---- the glow under the ash (two pulses, then it keeps breathing)
    dec, lt = A.glow_under_ash((sx, sy), g, radius=0.15, light_h=0.08)
    for t, gl, e in ((0.0, 0.0, 0.0), (T_PULSE[0] - 0.18, 0.0, 0.0), (T_PULSE[0], 0.3, 0.3), (T_PULSE[0] + 0.35, 0.05, 0.04),
                     (T_PULSE[1] - 0.16, 0.08, 0.15), (T_PULSE[1], 1.0, 4.5), (T_PULSE[1] + 0.3, 0.55, 2.4),
                     (T_PULSE[1] + 0.6, 0.75, 3.2), (dur, 0.62, 2.7)):
        A.key_glow(dec, lt, F(t), gl, e)
    # ---- Claude: still kneeling in grief, the mittens sift once more, freeze at the first pulse; the eyes widen
    c = W.claude()
    base = dict(acting.B_SIFT)
    base.update(acting.F_GRIEF)
    base.update(A.ASH, x=kx, y=ky, z=g(kx, ky), heading=hd, lean=8.0, bend=3.0, head_nod=0.0, eye_open=0.42,
                eye_tilt=1.0, look_y=-0.85, squash=-0.085, wobble=0.15, smile=-0.6,
                handL_x=0.17, handL_y=-0.38, handL_z=0.12, handR_x=-0.17, handR_y=-0.39, handR_z=0.12,
                handL_curl=0.2, handR_curl=0.2, brand=0.2, vivid=0.5)
    tr = Track()
    tr.pose(0.0, base)
    # one last slow sift with the left mitten, freezing when the light comes
    tr.key(0.3, "inout", handL_z=0.15, handL_y=-0.36, handL_curl=0.45)
    tr.key(T_PULSE[0] - 0.05, "inout", handL_z=0.115, handL_y=-0.40, handL_curl=0.3)
    tr.key(T_PULSE[0] + 0.12, "out", handL_z=0.125, handR_z=0.13, handL_curl=0.15, handR_curl=0.12, squash=-0.07)
    # the eyes: a breath of disbelief before the second pulse, then wide open at T_NOTICE
    tr.key(T_PULSE[0] + 0.3, "inout", eye_open=0.5, eye_tilt=0.9, look_y=-0.9)
    tr.key(T_PULSE[1] - 0.05, "inout", eye_open=0.55, eye_tilt=0.8, pupil=1.15, glint=1.0, wobble=0.1)
    tr.key(T_NOTICE, "snap", eye_open=1.28, eye_tilt=0.3, lower_lid=0.0, pupil=1.55, glint=1.5, iris_glow=0.9,
           squash=-0.04, head_nod=-2.0, wobble=0.0, smile=-0.1, mouth_open=0.0, look_y=-0.95)
    tr.key(T_NOTICE + 0.45, "inout", eye_open=1.2, squash=-0.05, head_nod=2.0, lean=10.0)
    tr.key(dur, "soft", eye_open=1.22, head_nod=3.0, lean=11.0, pupil=1.6)
    tr.layer(acting.breathe(0.009, 0.3, arms=0.8))
    tr.layer(anim.saccades(seed=33, amp=0.035, every=(0.5, 1.0)))
    A.bake_claude(c, tr, f0, f1)
    # ---- camera 1: ECU over the ash between the mittens (a slow drift in)
    S = Vector((sx, sy, g(sx, sy)))
    e0 = S + fw * 0.42 + lf * 0.12 + Vector((0, 0, 0.44))
    t0 = S + fw * -0.02 + Vector((0, 0, 0.01))
    e1 = e0 + (t0 - e0) * 0.12
    cam1 = A.cam_move("CamB03ash", f0, f1, [(0.0, "linear", e0, t0, 50.0, (S - e0).length),
                                            (T_CUT + 0.1, "linear", e1, t0, 50.0, (S - e1).length)],
                      shake=0.03, seed=303, fstop=2.8)
    # ---- camera 2: ECU of both eyes, from a little below (the light comes from below)
    E = (c.point("eyeL", F(T_NOTICE)) + c.point("eyeR", F(T_NOTICE))) * 0.5 + Vector((0, 0, -0.04))
    dirv = (fw * math.cos(math.radians(4.0)) - Vector((0, 0, math.sin(math.radians(4.0))))).normalized()
    e2 = E + dirv * 1.3
    e2.z = max(e2.z, g(e2.x, e2.y) + 0.07)
    e3 = e2 + (E - e2) * 0.08
    cam2 = A.cam_move("CamB03eye", f0, f1, [(0.0, "linear", e2, E, 60.0, (E - e2).length),
                                            (T_CUT, "linear", e2, E, 60.0, (E - e2).length),
                                            (dur, "soft", e3, E + Vector((0, 0, -0.005)), 60.0, (E - e3).length)],
                      shake=0.025, seed=304, fstop=2.8, bind=False)
    A.cut(cam1, f0)
    A.cut(cam2, F(T_CUT))
    bpy.context.scene.camera = cam1
    # a whisper of warm key on the face so the eyes read before the glow arrives
    c.face_light(e2, energy=3.0, col=(0.95, 0.9, 0.85), dist=1.2, size=0.8, frame=F(T_NOTICE))
    A.safe_shadows()
    A.animatic_readability()
    return dict(post=post.preset("ash", focus_xy=(0.5, 0.5), sat=A.SAT, bloom=0.7, bloom_thr=0.6))
