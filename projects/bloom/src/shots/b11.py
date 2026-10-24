"""B11 (28.13-30.63 s, 4 beats): low angle from below the ledge. The rain begins - first fat drops, then a downpour,
the rock darkening and Claude going glossy-wet. Claude leaps at the 1.2 m strata step, slaps one hand on the lip
(0.3), hangs with its feet scrabbling on the face, the sprout clutched in the other arm, hauls, re-grips on top
(0.95), drags itself over and stands up on the lip. Lightning splits the sky behind it (T_BOLT): for a few frames it
is a black silhouette against white-violet light, the sprout a green spark at its chest. Left to right and up."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from lu import world, acting, anim, claude, sprout, fx, post, sky
from shots import act_climb as A

T_BOLT = 1.5

SLAP1 = 0.3          # the hand hits the lip (foley)
SLAP2 = 0.95         # the re-grip on top (foley)


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    W = world.World("storm", focus=(24.0, 124.0), frames=(f0, f1), storm=1.0, ambient=False)
    L = W.mtn["ledge"]
    lip, foot, top = L["lip"], L["foot"], L["top"]
    G = A.fast_ground(19.0, 29.0, 119.0, 130.0, res=0.04)
    C = A.make_claude(W)
    S = A.make_sprout(C)
    # the strata block's face runs SW-NE (it faces south-south-west); Claude climbs it square-on at x = 23.5, where
    # the face plane is at y = 124.46 and the lip is the block's flat top (lip.z)
    F = Vector((23.5, 124.46, 0.0))
    u = Vector((0.37, 0.93, 0.0)).normalized()          # climbing direction (into the rock)
    HD = A.heading_to(u.x, u.y)
    lf = A.left(HD)
    zf = G(F.x - u.x * 0.6, F.y - u.y * 0.6)
    TOPZ = lip.z

    # ---- root path along the climb: (t, a = metres along u from the face plane, z)
    RP = [(-0.2, -0.95, zf), (0.12, -0.48, zf), (0.2, -0.38, zf), (0.3, -0.27, TOPZ - 0.93), (0.42, -0.26, TOPZ - 0.98),
          (0.62, -0.26, TOPZ - 0.86), (0.95, -0.24, TOPZ - 0.52), (1.2, -0.04, TOPZ - 0.18), (1.38, 0.33, TOPZ),
          (dur, 0.56, TOPZ)]

    def root(t):
        for (ta, aa, za), (tb, ab, zb) in zip(RP, RP[1:]):
            if ta <= t <= tb:
                w = (t - ta) / (tb - ta)
                e = w * w * (3 - 2 * w)
                q = F + u * (aa + (ab - aa) * e)
                return Vector((q.x, q.y, za + (zb - za) * e))
        a_ = RP[-1] if t > RP[-1][0] else RP[0]
        q = F + u * a_[1]
        return Vector((q.x, q.y, a_[2]))

    # pitch (deg, + forward): leaning into the wall while hanging, tipping over the lip, upright on top
    TX = [(0.0, 6.0), (0.18, 14.0), (0.3, -4.0), (0.62, -6.0), (0.95, 8.0), (1.2, 30.0), (1.38, 10.0),
          (T_BOLT, -4.0), (dur, 2.0)]

    def tilt(t):
        for (ta, a_), (tb, b_) in zip(TX, TX[1:]):
            if ta <= t <= tb:
                w = (t - ta) / (tb - ta)
                return a_ + (b_ - a_) * (w * w * (3 - 2 * w))
        return TX[-1][1] if t > TX[-1][0] else TX[0][1]

    fw = A.fwd(HD)

    def to_char(wp, t):
        d = wp - root(t)
        return Vector((d.dot(lf), -d.dot(fw), d.z))

    grip1 = F + u * 0.13 + lf * 0.17 + Vector((0, 0, TOPZ + 0.02))      # its LEFT hand on the lip
    grip2 = F + u * 0.42 + lf * 0.15 + Vector((0, 0, TOPZ + 0.02))
    x0 = F.x
    face_y = F.y

    tr = anim.Track(claude.DEFAULT)
    P = dict(acting.B_HOLD)
    P.update(acting.F_DETERMINED)
    P.update(ash=0.4, wet=0.1, vivid=0.3, brand=0.9, eye_open=0.8, eye_tilt=-0.8, lower_lid=0.35, look_y=0.8,
             head_nod=-14.0, crouch=0.25, mouth_press=0.0, smile=-0.1)
    tr.pose(0.0, P)
    tr.key(0.12, crouch=0.45, squash=-0.12, eye_squeeze=0.0)              # anticipation
    tr.key(0.24, "out", crouch=0.0, squash=0.14, legs_ik=0.0, leg0_swing=-35.0, leg3_swing=-35.0,
           leg1_swing=-50.0, leg2_swing=-50.0, eye_open=0.6, eye_squeeze=0.2)
    # the free (left) arm reaches for the lip; the right keeps the sprout clutched
    tr.key(0.16, armL_ik=0.0, armL_up=-38.0)
    tr.key(0.28, "out", armL_ik=1.0, armL_follow=0.0, handL_curl=0.85, handL_bend=-35.0, armL_twist=-70.0,
           armL_pole=35.0)
    tr.key(SLAP1, squash=-0.08, eye_squeeze=0.7, eye_open=0.3)
    tr.key(0.42, squash=0.04, legs_ik=0.0, leg0_swing=25.0, leg3_swing=10.0, leg1_swing=-20.0, leg2_swing=-35.0,
           eye_squeeze=0.4, eye_open=0.45)
    tr.key(0.55, leg0_swing=-10.0, leg3_swing=35.0, leg1_swing=-40.0, leg2_swing=-10.0)
    tr.key(0.7, leg0_swing=30.0, leg3_swing=-5.0, leg1_swing=-15.0, leg2_swing=-45.0, squash=-0.06,
           eye_squeeze=0.8, eye_open=0.2)
    tr.key(0.85, leg0_swing=-5.0, leg3_swing=30.0, leg1_swing=-45.0, leg2_swing=-15.0)
    tr.key(SLAP2, squash=0.08, eye_squeeze=0.3, eye_open=0.5)
    tr.key(1.2, leg0_swing=60.0, leg3_swing=55.0, leg1_swing=20.0, leg2_swing=25.0, bend=10.0, crouch=0.4)
    tr.key(1.38, "out", legs_ik=1.0, leg0_swing=0.0, leg3_swing=0.0, leg1_swing=0.0, leg2_swing=0.0, crouch=0.35,
           squash=-0.1, bend=4.0, armL_ik=0.0, armL_follow=1.0, armL_up=-38.0, eye_squeeze=0.0, eye_open=0.7,
           wet=0.45)
    # standing on the lip, it straightens and looks up the mountain (screen right) as the bolt hits
    tr.key(T_BOLT - 0.05, vivid=0.3)
    tr.key(T_BOLT, "linear", vivid=0.0)
    tr.key(T_BOLT + 0.25, vivid=0.0)
    tr.key(T_BOLT + 0.55, vivid=0.3)
    tr.key(T_BOLT - 0.04, crouch=0.15, squash=0.06, head_nod=-12.0, look_x=-0.5, look_y=0.6, head_turn=-12.0,
           eye_open=0.78, eye_tilt=-0.85)
    tr.key(dur, crouch=0.1, squash=0.03, head_nod=-10.0, head_turn=-18.0, look_x=-0.6, wet=0.55, ash=0.25,
           lean=6.0)
    A.freeze(tr, 0.0, claude.DEFAULT)
    tr.layer(acting.breathe(amp=0.02, rate=1.4, arms=1.0))

    def body(t, p):
        r = root(t)
        p["x"], p["y"], p["z"] = r.x, r.y, r.z
        p["heading"] = HD
        p["tilt_x"] = tilt(t)
        if p.get("armL_ik", 0) > 0.01:
            g = grip1 if t < SLAP2 - 0.05 else grip1.lerp(grip2, A.smooth((t - (SLAP2 - 0.05)) / 0.12))
            if t < 0.28:
                g = g + Vector((0, -0.1, -0.25)) * (1 - A.smooth((t - 0.16) / 0.12))
            q = to_char(g, t)
            # IK targets are in the root's frame, which also carries the pitch: undo it
            ph = math.radians(p["tilt_x"])
            y_, z_ = q.y * math.cos(ph) + q.z * math.sin(ph), -q.y * math.sin(ph) + q.z * math.cos(ph)
            p["handL_x"], p["handL_y"], p["handL_z"] = q.x, y_, z_
        # front feet scrabble against the face while hanging (IK off: FK legs keyed above)
    tr.layer(body)
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)

    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, dict(acting.S_SHIVER, grow=A.GROW, clod=1.0, heading=170.0, glow=1.6, health=0.5, eye_open=0.4))
    st.key(0.4, eye_open=0.0, leafL_curl=0.95, leafR_curl=0.95)
    st.key(T_BOLT, glow=1.5, eye_open=0.5)
    st.key(dur, glow=1.4)
    st.layer(acting.sprout_shiver(0.0, dur, amp=0.9, freq=14.0))
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- camera: low, beside the foot of the step (east-south-east), looking along the face toward the west-north-west:
    # Claude climbs left to right in profile, the storm sky (and the bolt) behind it
    look = Vector((-u.y, u.x, 0.0))                      # 90 deg left of the climb direction
    Fz = Vector((F.x, F.y, TOPZ))
    E0 = Fz - look * 2.5 - u * 1.35 + Vector((0, 0, -0.62))
    T0 = Fz - u * 0.15 + Vector((0, 0, -0.3))
    T1 = Fz + u * 0.45 + Vector((0, 0, 0.42))
    ct = anim.Track(anim.CAM_DEFAULT)
    A.ckey(ct, 0.0, E0, T0, lens=24.0, fstop=4.0, focus=(T0 - E0).length)
    A.ckey(ct, 0.9, E0 + u * 0.06 + Vector((0, 0, 0.03)), T0.lerp(T1, 0.4), focus=(T0 - E0).length)
    A.ckey(ct, T_BOLT, E0 + u * 0.14, T1, focus=(T1 - E0).length)
    A.ckey(ct, dur, E0 + u * 0.22 + Vector((0, 0, -0.03)), T1 + u * 0.12 + Vector((0, 0, 0.05)),
           focus=(T1 - E0).length)
    ct.layer(A.handheld(amp=0.012, ang=0.6, freq=1.5, seed=111))
    ct.layer(A.impact_shake([SLAP1, SLAP2, T_BOLT + 0.08], amp=0.012, ang=0.6, dur=0.3))
    cam = A.make_camera("CamB11", ct, f0, f1, seed=11)

    # ---- rain begins: amount ramps, the rock and Claude go wet
    cz = lip.z
    rain = fx.rain((x0 - 6.0, face_y + 2.0, cz + 6.0), (20.0, 22.0, 16.0), 9000, f0, wind=(2.6, -0.9), fall=9.5)
    A.key_rain(rain, f0, [(0.0, 0.08), (0.5, 0.35), (1.2, 0.8), (dur, 1.0)])
    spl = fx.rain_splashes((x0, face_y), 4.0, 700, f0)
    A.key_rain(spl, f0, [(0.0, 0.05), (0.8, 0.5), (dur, 1.0)])
    W.set_env(f0, Wet=0.2)
    W.set_env(f0 + int(1.6 * A.FPS), Wet=0.9)
    # ---- the bolt: behind Claude in the camera's view, a huge branching fork; Claude goes black against it
    fb = f0 + int(round(T_BOLT * A.FPS))
    bpy.context.scene.frame_set(fb)
    ce = cam.matrix_world.translation.copy()
    tc = C.point("head")
    vd = (tc - ce)
    vd.z = 0
    vd.normalize()
    sd_ = Vector((-vd.y, vd.x, 0.0))
    start = ce + vd * 260.0 + sd_ * 30.0 + Vector((0.0, 0.0, 230.0))
    end = ce + vd * 220.0 - sd_ * 20.0 + Vector((0.0, 0.0, -10.0))
    end.z = W.ground(end.x, end.y)
    fx.lightning(fb, start=start, end=end, width=1.6, flash=1.0, seed=17)
    sky.flash(f0 + 6, 0.35, az=150.0, el=20.0, double=False)
    # a cold rim from the bolt's side keyed with the flash (silhouette edge), and a dim face key otherwise
    fl = C.face_light(ce, energy=4.0, col=(1.0, 0.84, 0.7), dist=1.5, size=0.8)
    rim = C.rim_light(ce, vd + Vector((0, 0, 0.9)), col=(0.85, 0.85, 1.0), energy=120.0, dist=2.0)
    A.follow_fn(fl, lambda t: root(t), f0, f1)
    A.follow_fn(rim, lambda t: root(t), f0, f1)
    A.key_light(rim, [(T_BOLT - 0.05, 120.0), (T_BOLT, 700.0), (T_BOLT + 0.05, 200.0), (T_BOLT + 0.09, 550.0),
                      (T_BOLT + 0.2, 120.0)], f0)
    A.key_light(fl, [(T_BOLT - 0.05, 4.0), (T_BOLT, 0.3), (T_BOLT + 0.2, 0.3), (T_BOLT + 0.45, 4.0)], f0)
    # hand slaps: spray off the wet rock
    for t, g in ((SLAP1, grip1), (SLAP2, grip2)):
        fx.puff(f"Slap{int(t * 100)}", g + Vector((0, 0, 0.02)), f0 + int(round(t * A.FPS)), n=6, spread=0.04,
                grow=(0.02, 0.12), life=(0.3, 0.6), rise=0.15, color=(0.55, 0.58, 0.66), opacity=0.35, seed=int(t * 10))
    W.gust(f0, f1, 1.6)
    return dict(post=A.post_storm(focus_xy=(0.5, 0.62), haze_amt=0.75))
