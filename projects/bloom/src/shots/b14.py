"""B14 (35.63-38.75 s, 5 beats): the low point. MCU on a long lens, soft cold light. The last stones bounce and the
hail stops (T_STOP): silence, the music drops out; only a thin rain. A held beat - then Claude slowly uncurls:
battered, chipped, cracked, wet, the ground round it white with hailstones. It brings its hand out from under its
body (T_REVEAL): the sprout lies on it, dim grey-green and limp, its light almost out. Claude stares. Its face
crumples - the eyes tilt into grief, a tiny wavering line of a mouth, the eyes well - and a tear rolls down and falls
(T_TEAR). Then its eyes squeeze shut and it lifts the sprout to its cheek, shoulders hitching. Focus racks from the
sprout to the face."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from lu import world, acting, anim, claude, sprout, fx, post, sky
from shots import act_climb as A
from shots.b12 import HEADING

T_STOP = 0.3
T_REVEAL = 1.2
T_TEAR = 2.4

DAMAGE = 0.86
LOOK = dict(vivid=0.0, brand=1.0)              # soft, low, cold: the terracotta stays, never pale
# the end of B14 = the start of B15: bowed over the sprout, which is back at its chest (the cradle) between its
# hands; its face hangs just above it (the leaf can reach it)
BOW = dict(crouch=0.62, lean=10.0, bend=12.0, head_nod=14.0, squash=-0.08, armL_ik=1.0, armR_ik=1.0,
           armL_follow=1.0, armR_follow=1.0, handL_x=0.135, handR_x=-0.035, handL_y=-0.345, handR_y=-0.35,
           handL_z=0.255, handR_z=0.25, handL_bend=0.0, handR_bend=0.0, armL_pole=15.0, armR_pole=15.0,
           cradle_x=0.05, cradle_y=0.01, cradle_z=-0.02)       # the sprout stands on its two hands, held up
CHEEK = (0.1, claude.FRONT_Y - 0.004, claude.EYE_Z - 0.12)     # on its face below the left eye


CUP = dict(handL_x=0.135, handR_x=-0.035, handL_y=-0.37, handR_y=-0.375, handL_z=0.22, handR_z=0.215,
           handL_bend=0.0, handR_bend=0.0, cradle_x=0.05, cradle_y=-0.035, cradle_z=0.025)   # cupped at its chest


def bow_pose(C):
    """BOW with root-space (follow 0) hand targets, so it blends with the other fixed-target holds."""
    P = dict(BOW)
    P.update(A.hands_to_root(C, BOW))
    return P


WILT = dict(acting.S_WILT, grow=1.0, clod=1.0, glow=0.5, health=0.24, eye_open=0.15, lean=22.0, head_nod=55.0,
            bend=25.0)                     # limp: the stem arcs right over, the head hangs
WILT_HEADING = 115.0                          # turned across, so the droop reads in profile


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    W = world.World("low", focus=(26.0, 136.0), frames=(f0, f1), ambient=False)
    spot = W.mtn["hail"]["spot"]
    G = A.fast_ground(21.0, 31.0, 131.0, 141.0, res=0.03)
    X = Vector((spot.x, spot.y, G(spot.x, spot.y)))
    C = A.make_claude(W)
    S = A.make_sprout(C)                     # in the cradle at its chest, between its hands
    A.sprout_light(S, scale=0.05, soft=0.06)
    fw, lf = A.fwd(HEADING), A.left(HEADING)

    tr = anim.Track(claude.DEFAULT)
    curl = dict(acting.B_CURL)
    curl.update(acting.F_FLINCH)
    curl.update(LOOK, x=X.x, y=X.y, z=X.z, heading=HEADING, teeth=0.0, mouth_wide=0.0, squash=-0.12, crouch=0.88,
                bend=16.0, head_nod=16.0, ash=0.15, wet=0.45, damage=DAMAGE, handL_bend=30.0, handR_bend=30.0,
                cradle_y=0.02, cradle_z=-0.04)
    tr.pose(0.0, curl)
    # the hail stops: a frozen beat, then one eye cracks open
    tr.key(0.55, eye_squeeze=1.0, eye_open=0.0, eyeR_open=0.0)
    tr.key(0.8, eye_squeeze=0.0, eye_open=0.18, eyeR_open=0.12, eye_tilt=0.6, look_y=-0.6)
    # it slowly uncurls, lifting its head to look down at what it has been holding
    tr.key(0.62, bend=16.0, head_nod=16.0, crouch=0.88, squash=-0.12, lean=10.0)
    tr.key(1.12, bend=7.0, head_nod=10.0, crouch=0.56, squash=-0.05, lean=4.0, eye_open=0.55, eyeR_open=0.0,
           eye_tilt=0.55, look_y=-0.95, look_x=0.1, pupil=1.1)
    # T_REVEAL: the arms that were wrapped round it open into a cup: the sprout stands in its two hands
    hk = ("handL_x", "handL_y", "handL_z", "handR_x", "handR_y", "handR_z", "handL_bend", "handR_bend",
          "cradle_x", "cradle_y", "cradle_z")
    tr.key(T_REVEAL - 0.22, **{k: curl.get(k, claude.DEFAULT[k]) for k in hk})
    tr.key(T_REVEAL + 0.25, "out", eye_open=0.98, eye_tilt=0.45, pupil=1.3, look_y=-1.0, look_x=0.1,
           **{k: CUP[k] for k in hk})
    tr.key(1.5, squash=-0.03, head_tilt=0.0)
    tr.key(1.85, eye_open=0.95, eye_tilt=0.5, smile=0.0, wobble=0.0, tears=0.0, squash=-0.05, head_tilt=7.0)
    # it breaks: grief eyes, the lip wavers, the eyes well
    tr.key(2.3, eye_open=0.6, eye_tilt=1.0, lower_lid=0.12, smile=-0.55, wobble=0.85, tears=1.0, pupil=1.15,
           head_nod=12.0, bend=10.0, squash=-0.09)
    # then squeezed shut; it bows over the sprout, raising it to its face
    tr.key(T_TEAR + 0.15, eye_open=0.6, eye_squeeze=0.0, **{k: CUP[k] for k in hk})
    hold = dict(BOW)
    hold.update(eye_open=0.25, eye_squeeze=0.95, eye_tilt=1.0, smile=-0.5, wobble=0.6, tears=1.0)
    tr.pose(2.95, hold)
    tr.key(dur, head_nod=BOW["head_nod"] - 2.0)
    A.freeze(tr, 0.0, claude.DEFAULT)
    tr.layer(A.flinch_layer([0.08, 0.22], amp=0.6, dur=0.2))
    tr.layer(acting.shiver(0.0, T_STOP + 0.15, amp=0.5, freq=15.0))
    tr.layer(acting.breathe(amp=0.01, rate=0.5, arms=0.0))
    tr.layer(acting.sob(2.6, dur + 0.5, rate=2.2, amp=0.9))
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)
    C.tear("R", f0 + int(round((T_TEAR - 0.86) * A.FPS)), dur=1.05)
    C.tear("L", f0 + int(round((T_TEAR + 0.3) * A.FPS)), dur=1.3)

    # the sprout: limp in its hands, dim grey-green; a feeble flicker as Claude looks at it
    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, dict(WILT, heading=WILT_HEADING, x=0.0, y=0.0, z=0.0))
    st.key(1.9, glow=WILT["glow"])
    st.key(2.05, glow=WILT["glow"] + 0.1)
    st.key(2.3, glow=WILT["glow"] - 0.08)
    st.key(dur, glow=WILT["glow"] - 0.1, health=WILT["health"] - 0.04)
    A.freeze(st, 0.0, sprout.DEFAULT)
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- the end of the hail: stones lying white all round, the last ones bouncing; thin rain
    tf = 12.0 / 16.0
    rng = np.random.default_rng(14)
    n = 1700
    starts = np.concatenate([-5.5 + rng.random(n - 120) * (5.5 + T_STOP - tf - 0.05),       # already lying there
                             T_STOP - tf - 0.35 + rng.random(120) * 0.3])                  # the last stones
    W.fx["hail"] = A.timed_hail((X.x, X.y), 4.5, starts, f0, exclude=[(X.x, X.y, 0.6, 0.55, HEADING)], rest=9.0,
                                stone=(0.02, 0.042))
    for k, t in enumerate((T_STOP + 0.1, T_STOP + 0.27, T_STOP + 0.5)):           # the last three, off its back
        hit = A.body_pt(C, (0.15 * (k - 1), 0.05, claude.ZTOP + 0.01), f0 + int(round(t * A.FPS)))
        A.body_stone(lambda tt, h=hit: h, t, f0, f1, lf * (1 if k % 2 else -1) + fw * 0.3, G, size=0.03, seed=50 + k,
                     speed=1.2)
    W.fx["rain"] = fx.rain((X.x - 3.0, X.y + 1.0, X.z + 5.0), (14.0, 14.0, 10.0), 2200, f0, wind=(1.2, -0.4),
                           fall=8.5, amount_=0.4)
    A.key_rain(W.fx["rain"], f0, [(0.0, 0.7), (T_STOP, 0.7), (T_STOP + 0.4, 0.25), (dur, 0.2)])
    W.set_env(Wet=1.0)

    # ---- camera: MCU, 85 mm, from its front-left (the hand side), at the hand's height; slow push; rack focus
    sc = bpy.context.scene

    def face_at(t):
        return A.body_pt(C, (0.0, claude.FRONT_Y, claude.EYE_Z - 0.02), f0 + int(round(t * A.FPS)))

    def sprout_at(t):
        return S.point("head", f0 + int(round(t * A.FPS)))
    a = math.radians(-90.0 + HEADING + 16.0)
    cam_dir = Vector((math.cos(a), math.sin(a), 0.0))
    fA, fB, fC = face_at(0.2), face_at(1.7), face_at(2.9)
    sA, sB, sC = sprout_at(0.2), sprout_at(1.7), sprout_at(2.9)
    up = Vector((0, 0, 0.05))
    T0, T1, T2 = fA.lerp(sA, 0.3) + up, fB.lerp(sB, 0.4) + up, fC.lerp(sC, 0.35) + up
    E0 = X + cam_dir * 3.75
    E0.z = sB.z + 0.12
    E1 = X + cam_dir * 3.35
    E1.z = sB.z + 0.12
    ct = anim.Track(anim.CAM_DEFAULT)
    A.ckey(ct, 0.0, E0, T0, lens=75.0, fstop=2.0, focus=(fA - E0).length)
    A.ckey(ct, 0.9, E0.lerp(E1, 0.2), T0.lerp(T1, 0.3), focus=(fA - E0).length)
    A.ckey(ct, T_REVEAL + 0.15, E0.lerp(E1, 0.4), T1, focus=(sB - E0).length)
    A.ckey(ct, 1.85, E0.lerp(E1, 0.6), T1, focus=(sB - E0).length)
    A.ckey(ct, 2.2, E0.lerp(E1, 0.75), T1.lerp(T2, 0.5), focus=(fB - E1).length)
    A.ckey(ct, dur, E1, T2, focus=(fC - E1).length, ease="linear")
    ct.layer(A.handheld(amp=0.003, ang=0.1, freq=0.6, seed=141))
    cam = A.make_camera("CamB14", ct, f0, f1, seed=14)
    A.clear_line(E0, X, radius=0.5, u1=0.85)
    A.clear_line(E0, X, radius=1.1, u0=0.8, u1=0.95, step=0.2)

    sc.frame_set(f0 + 50)
    cl = cam.matrix_world.translation.copy()
    C.face_light(cl, energy=1.6, col=(1.0, 0.8, 0.64), dist=1.6, size=0.7)    # a warm cheat: Claude stays terracotta
    C.rim_light(cl, sky.sun_vec(), col=(0.72, 0.78, 0.95), energy=50.0, dist=2.2)
    A.soft_fill(S.col, sB, cl, energy=2.5, col=(0.85, 0.92, 1.0), dist=0.9, size=0.6, up=0.35, name="SproutFill14")
    return dict(post=A.post_low(focus_xy=(0.5, 0.5)))
