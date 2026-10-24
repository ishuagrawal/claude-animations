"""B10 (26.25-28.13 s, 3 beats): CU at ground level, in the settling ash at the foot of the step. Claude lies face
down; it lifts its head (ash sliding off its top), and its eyes go straight to its hands: it opens them on the
sprout, still glowing (T_CHECK) - relief. Then the brows come down, a hard exhale blows a puff of ash, and it
pushes itself up (T_UP), rising out of the low frame, its eyes on the summit past the lens (screen right)."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from lu import world, acting, anim, claude, sprout, fx, post, sky, mountain
from shots import act_climb as A

T_CHECK = 0.7
T_UP = 1.4


def lowest(phi_deg, crouch=0.0):
    """Centre height that keeps the lowest corner / foot of a body pitched forward phi on the ground."""
    ph = math.radians(phi_deg)
    hz = 0.26 - 0.075 * crouch
    leg = 0.19 * (1 - 0.6 * crouch)
    c1 = 0.22 * math.sin(ph) + hz * math.cos(ph)
    c2 = 0.07 * abs(math.sin(ph)) * -1 + (hz + leg) * math.cos(ph)
    c3 = -0.22 * math.sin(ph) + hz * math.cos(ph) + 0.0
    return max(c1, c2, c3) - 0.01


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    W = world.World("storm", focus=(15.0, 104.0), frames=(f0, f1), storm=0.88, ambient=False)
    W.set_env(Wet=0.0)
    C = A.make_claude(W)
    S = A.make_sprout(C)
    A.sprout_light(S, scale=0.35, soft=0.05)
    G = A.fast_ground(12.0, 21.0, 100.0, 110.0, res=0.03)
    SC = W.mtn["scree"]
    down = SC["down"]
    down3 = Vector((down.x, down.y, 0.0))
    P0 = Vector((SC["center"].x, SC["center"].y, 0.0)) - down3 * (mountain.SCREE_SIZE[1] * 0.3)
    X = P0 + down3 * 6.0 + Vector((0.0, 0.0, 0.0))            # where B09 left it
    h_up = A.heading_to(-down.x, -down.y)

    # pitch forward (deg): 72 face down -> head lifted -> the push up
    PH = [(0.0, 72.0), (0.32, 72.0), (0.62, 36.0), (0.75, 32.0), (T_UP - 0.12, 34.0), (T_UP + 0.25, 4.0),
          (T_UP + 0.38, -3.0), (dur, 0.0)]

    def phi(t):
        for (ta, a), (tb, b) in zip(PH, PH[1:]):
            if ta <= t <= tb:
                u = (t - ta) / (tb - ta)
                return a + (b - a) * (u * u * (3 - 2 * u))
        return PH[-1][1] if t > PH[-1][0] else PH[0][1]

    def crouch_t(t):
        return 0.6 * (1 - A.smooth((t - (T_UP + 0.05)) / 0.35)) + 0.15 * A.smooth((t - (T_UP + 0.25)) / 0.2)

    def centre(t):
        hop = 0.06 * math.sin(math.pi * min(1.0, max(0.0, (t - (T_UP + 0.1)) / 0.3)))
        z = G(X.x, X.y) + lowest(phi(t), crouch_t(t)) + hop
        q = X - down3 * (0.12 * A.smooth((t - T_UP) / 0.4))
        return Vector((q.x, q.y, z))

    tr = anim.Track(claude.DEFAULT)
    P = dict(acting.B_HOLD)
    P.update(acting.F_FLINCH)
    P.update(teeth=0.0, mouth_open=0.0, mouth_wide=0.0, smile=-0.2, ash=0.42, vivid=0.3, brand=0.9, bend=6.0,
             crouch=0.6, handL_y=-0.36, handR_y=-0.36, handL_z=0.18, handR_z=0.18, handL_x=0.07, handR_x=-0.07,
             cradle_y=-0.08, cradle_z=-0.06, handL_curl=0.7, handR_curl=0.7, legs_ik=0.0, leg0_swing=-40.0,
             leg3_swing=-40.0, leg1_swing=-45.0, leg2_swing=-45.0, head_nod=6.0)
    tr.pose(0.0, P)
    # eyes open as the head comes up; straight down to the hands
    tr.key(0.42, eye_squeeze=1.0, eye_open=0.0)
    tr.key(0.62, "out", eye_squeeze=0.0, eye_open=0.85, eye_tilt=0.7, lower_lid=0.15, look_y=-0.9, look_x=0.0,
           head_nod=-6.0)
    # T_CHECK: the hands open on the sprout, the glow on its face: relief
    tr.key(T_CHECK - 0.1, handL_x=0.07, handR_x=-0.07, handL_curl=0.7, handR_curl=0.7)
    tr.key(T_CHECK + 0.12, "out", handL_x=0.12, handR_x=-0.12, handL_curl=0.3, handR_curl=0.3, handL_y=-0.4,
           handR_y=-0.4, eye_open=1.05, eye_tilt=0.85, lower_lid=0.1, pupil=1.3, eye_happy=0.25)
    # resolve: brows down, a squint; the hard exhale
    tr.key(0.98, eye_open=1.0, eye_tilt=0.75, lower_lid=0.12, eye_happy=0.2, look_y=-0.9)
    tr.key(1.15, "out", eye_open=0.7, eye_tilt=-0.85, lower_lid=0.4, eye_happy=0.0, look_y=0.1, look_x=-0.35,
           squash=-0.05, handL_x=0.085, handR_x=-0.085, handL_y=-0.31, handR_y=-0.31, handL_z=0.265, handR_z=0.265,
           handL_curl=0.55, handR_curl=0.55, cradle_y=0.0, cradle_z=0.0)
    tr.key(T_UP - 0.05, squash=-0.08, legs_ik=0.0, leg0_swing=-40.0, leg3_swing=-40.0, leg1_swing=-45.0,
           leg2_swing=-45.0)
    # T_UP: the push
    tr.key(T_UP + 0.22, "out", squash=0.1, legs_ik=1.0, leg0_swing=0.0, leg3_swing=0.0, leg1_swing=0.0,
           leg2_swing=0.0, bend=2.0, head_nod=-6.0, look_y=0.35, look_x=-0.6)
    tr.key(T_UP + 0.4, squash=-0.04, ash=0.38)
    tr.key(dur, squash=0.02, lean=8.0, look_x=-0.75, head_turn=-6.0)
    A.freeze(tr, 0.0, claude.DEFAULT)
    tr.layer(acting.breathe(amp=0.012, rate=0.9))
    tr.layer(anim.blinks(times=[1.6], dur=0.12))

    def body(t, p):
        R = Matrix.Rotation(math.radians(h_up), 3, "Z") @ Matrix.Rotation(math.radians(phi(t)), 3, "X")
        p["crouch"] = crouch_t(t)
        A.rot_about_centre(p, R, centre(t), zc=0.45 - 0.15 * p["crouch"])
    tr.layer(body)
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)

    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, dict(acting.S_SHIVER, grow=A.GROW, clod=1.0, heading=180.0, glow=1.0, health=0.45, eye_open=0.0,
                      leafL_curl=0.9, leafR_curl=0.9, head_nod=20.0))
    st.key(T_CHECK - 0.05, glow=1.0, eye_open=0.0, head_nod=20.0)
    st.key(T_CHECK + 0.25, "out", glow=1.9, health=0.55, eye_open=0.75, head_nod=-12.0, look_y=0.6,
           leafL_curl=0.3, leafR_curl=0.3, leafL_reach=20.0, leafR_reach=25.0, mouth=0.25)
    st.key(dur, glow=1.6, eye_open=0.6)
    st.layer(acting.sprout_shiver(0.0, dur, amp=0.6, freq=12.0))
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- FX: settling dust, ash sliding off its top as the head lifts, the exhale, the push off
    c0 = centre(0.0)
    fx.dust_puff((c0.x, c0.y), f0 - 4, size=2.4, n=8, color=(0.24, 0.24, 0.26), opacity=0.4,
                 drift=(down.x * 0.3, down.y * 0.3, 0.1))
    for k, t in enumerate((0.45, 0.55, 0.66)):
        top = A.body_pt(C, (0.0, 0.05, claude.Z0 + claude.BODY_H + 0.01), f0 + int(t * A.FPS))
        fx.chips(top, f0 + int(t * A.FPS), n=12, direction=(down.x, down.y, 0.4), speed=(0.3, 0.9),
                 size=(0.006, 0.016), color=(0.40, 0.39, 0.37), inner=(0.30, 0.29, 0.28), seed=40 + k, name="AshSlide",
                 floor_z=G(top.x, top.y))
    m = A.body_pt(C, (0.0, claude.FRONT_Y - 0.03, claude.MOUTH_Z), f0 + int(1.12 * A.FPS))
    fx.puff("Exhale", m + Vector((0, 0, -0.04)), f0 + int(1.1 * A.FPS), n=6, spread=0.03, grow=(0.02, 0.12),
            life=(0.5, 0.9), rise=0.05, drift=(-down.x * 0.25, -down.y * 0.25, -0.05), color=(0.30, 0.30, 0.32),
            opacity=0.35, seed=12)
    cu = centre(T_UP + 0.1)
    fx.dust_puff((cu.x, cu.y), f0 + int((T_UP + 0.1) * A.FPS), size=1.3, n=7, color=(0.24, 0.24, 0.26),
                 opacity=0.4)
    W.fx["ash"] = fx.ash_snow((X.x - 6.0, X.y, G(X.x, X.y) + 3.0), (12.0, 10.0, 6.0), 1800, f0, wind=(2.5, -0.9),
                              fall=0.5)

    # ---- camera: on the ground in front of its face, a little to its right, 50 mm; tilts up with the push
    u = Vector((-down.x, -down.y, 0.0))
    R = Matrix.Rotation(math.radians(-24.0), 3, "Z")
    dirc = R @ u
    E = X + dirc * 2.05
    E.z = G(E.x, E.y) + 0.13
    ct = anim.Track(anim.CAM_DEFAULT)

    def face(t):
        return A.body_pt(C, (0.0, claude.FRONT_Y, claude.EYE_Z - 0.07), f0 + int(round(t * A.FPS)))
    fa, fb, fc, fd = face(0.0), face(0.75), face(T_UP), face(dur)
    lo = Vector((0, 0, -0.05))
    A.ckey(ct, 0.0, E, fa.lerp(fb, 0.5) + lo, lens=55.0, fstop=2.8, focus=(fb - E).length)
    A.ckey(ct, 0.6, E, fb + lo, focus=(fb - E).length)
    A.ckey(ct, T_UP, E + Vector((0, 0, 0.02)), fc + lo, focus=(fc - E).length)
    A.ckey(ct, dur, E + Vector((0, 0, 0.1)) - dirc * 0.1, fd + Vector((0, 0, -0.02)), focus=(fd - E).length,
           ease="out")
    ct.layer(A.handheld(amp=0.006, ang=0.35, freq=1.2, seed=101))
    ct.layer(A.impact_shake([T_UP + 0.15], amp=0.01, ang=0.5, dur=0.25))
    cam = A.make_camera("CamB10", ct, f0, f1, seed=10)

    sc = bpy.context.scene
    sc.frame_set(f0 + 20)
    cl = cam.matrix_world.translation.copy()
    fl = C.face_light(cl, energy=4.0, col=(0.85, 0.92, 1.0), dist=1.4, size=0.8)
    rim = C.rim_light(cl, sky.storm_vec() + Vector((0, 0, 0.7)), col=(0.82, 0.84, 1.0), energy=200.0, dist=2.0)
    for lo in (fl, rim):
        A.follow_fn(lo, centre, f0, f1)
    W.gust(f0, f1, 1.0)
    return dict(post=A.post_storm(focus_xy=(0.5, 0.5), haze_amt=0.7))
