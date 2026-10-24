"""B12 (30.63-33.13 s, 4 beats): CU, low, on the little bench under the rock band. HAIL: the first stones smash into
the rock and bounce around Claude (T_HAIL); it flinches and curls its whole body over the sprout - a shell over the
green glow - eyes squeezed shut. Stones keep hammering its back and bouncing off; at each big hit (T_CHIPS) a chunk
of its painted edge flies off in a spray of chips and clay crumbs, the cracks spread (damage builds), and it flinches
but does not move. The sprout's light leaks out under it, dimming."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from lu import world, acting, anim, claude, sprout, fx, post, sky
from shots import act_climb as A

T_HAIL = 0.2
T_CHIPS = (0.7, 1.2, 1.8, 2.2)

HEADING = 25.0       # Claude faces south-south-east on the bench (the rock band at its back)
HITS = (0.42, 0.58, 0.95, 1.05, 1.42, 1.6, 1.97, 2.36)      # smaller hits on its back (flinches, no chips)


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    W = world.World("storm", focus=(26.0, 136.0), frames=(f0, f1), storm=1.0, ambient=False)
    spot = W.mtn["hail"]["spot"]
    G = A.fast_ground(21.0, 31.0, 131.0, 141.0, res=0.03)
    C = A.make_claude(W)
    S = A.make_sprout(C)
    X = Vector((spot.x, spot.y, G(spot.x, spot.y)))
    fw, lf = A.fwd(HEADING), A.left(HEADING)

    tr = anim.Track(claude.DEFAULT)
    P = dict(acting.B_HOLD)
    P.update(acting.F_WORRIED)
    P.update(x=X.x, y=X.y, z=X.z, heading=HEADING, ash=0.25, wet=0.6, vivid=0.35, brand=0.9, crouch=0.3,
             look_y=0.9, look_x=0.3, head_nod=-14.0, eye_open=1.15, pupil=0.75, mouth_open=0.0, smile=-0.2)
    tr.pose(0.0, P)
    tr.key(T_HAIL - 0.02, crouch=0.3, look_y=0.9, eye_open=1.15, head_nod=-14.0)
    # the first stones: a flinch, then it folds down over the sprout
    tr.key(T_HAIL + 0.08, "out", eye_open=0.0, eye_squeeze=1.0, eye_tilt=-0.4, squash=-0.1, head_nod=0.0)
    curl = dict(acting.B_CURL)
    curl.update(acting.F_FLINCH)
    curl.update(teeth=0.0, mouth_open=0.0, mouth_wide=0.0, smile=-0.4, eye_tilt=0.3, look_y=0.0, look_x=0.0,
                squash=-0.12, crouch=0.9, bend=16.0, head_nod=16.0)
    tr.pose(0.55, curl, ease="out")
    for k, tc in enumerate(T_CHIPS):                     # damage builds in steps with every big hit
        tr.key(tc - 0.01, damage=0.2 * k)
        tr.key(tc + 0.06, "out", damage=0.2 * (k + 1) + (0.05 if k == 3 else 0.0))
    tr.key(dur, wet=0.65)
    A.freeze(tr, 0.0, claude.DEFAULT)
    tr.layer(A.flinch_layer([T_HAIL + 0.02] + list(HITS), amp=0.55, dur=0.22))
    tr.layer(A.flinch_layer(list(T_CHIPS), amp=1.2, dur=0.35))
    tr.layer(acting.shiver(0.6, dur, amp=0.5, freq=15.0))
    tr.layer(acting.breathe(amp=0.012, rate=1.6, arms=0.5))
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)

    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, dict(acting.S_SHIVER, grow=A.GROW, clod=1.0, heading=180.0, glow=1.5, health=0.5, eye_open=0.6, look_y=0.5))
    st.key(0.5, eye_open=0.0, leafL_curl=1.0, leafR_curl=1.0, head_nod=24.0, glow=1.4)
    st.key(dur, glow=0.9, health=0.32)
    st.layer(acting.sprout_shiver(0.0, dur, amp=1.0, freq=13.0))
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- the camera: CU from the south-east, low on the bench edge, pushing in slowly
    cam_dir = Vector((math.cos(math.radians(-42.0)), math.sin(math.radians(-42.0)), 0.0))
    E0 = X + cam_dir * 2.2 + Vector((0, 0, 0.3))
    E1 = X + cam_dir * 1.9 + Vector((0, 0, 0.27))
    T0 = X + Vector((0, 0, 0.45)) + fw * 0.1
    T1 = X + Vector((0, 0, 0.30)) + fw * 0.2
    ct = anim.Track(anim.CAM_DEFAULT)
    A.ckey(ct, 0.0, E0, T0, lens=42.0, fstop=2.8, focus=(T0 - E0).length)
    A.ckey(ct, 0.6, E0.lerp(E1, 0.25), T1, focus=(T1 - E0).length - 0.1)
    A.ckey(ct, dur, E1, T1, focus=(T1 - E1).length - 0.1, ease="linear")
    ct.layer(A.handheld(amp=0.008, ang=0.45, freq=1.4, seed=121))
    ct.layer(A.impact_shake(list(T_CHIPS), amp=0.012, ang=0.7, dur=0.28))
    ct.layer(A.impact_shake([T_HAIL], amp=0.02, ang=0.9, dur=0.35, seed=3))
    cam = A.make_camera("CamB12", ct, f0, f1, seed=12)

    # ---- hail: timed so the storm of stones begins on T_HAIL; none fall through Claude (they hit it: below)
    tf = 12.0 / 16.0
    rng = np.random.default_rng(12)
    n = 2600
    st_ = T_HAIL - tf + np.concatenate([rng.random(int(n * 0.1)) * 0.25,               # the first volley
                                        0.15 + rng.random(n - int(n * 0.1)) * (dur + 0.1)])
    W.fx["hail"] = A.timed_hail((X.x, X.y), 4.8, st_, f0, exclude=[(X.x, X.y, 0.55, 0.5, HEADING)], rest=7.0,
                                stone=(0.02, 0.045))
    W.fx["hail_far"] = A.timed_hail((X.x - 3.0, X.y + 3.0), 11.0, T_HAIL - tf + 0.1 + np.random.default_rng(14).random(2200) * (dur + 0.2),
                                    f0, rest=7.0, seed=9, name="HailFar", exclude=[(X.x, X.y, 5.0, 5.0, 0.0)])
    W.fx["rain"] = fx.rain((X.x - 4.0, X.y + 2.0, X.z + 5.0), (16.0, 16.0, 12.0), 6000, f0, wind=(2.6, -0.9),
                           fall=9.5, amount_=0.8)
    W.fx["splash"] = fx.rain_splashes((X.x, X.y), 4.0, 500, f0)
    W.set_env(Wet=1.0)

    # stones hitting Claude's back (and the four that take chips off) - keyed, they bounce off and roll
    def top_pt(t, side):
        f = f0 + int(round(t * A.FPS))
        return A.body_pt(C, (side * 0.2, 0.02, claude.Z0 + claude.BODY_H + 0.012), f)
    rng = np.random.default_rng(5)
    for k, t in enumerate(list(HITS) + list(T_CHIPS)):
        side = float(rng.uniform(-1, 1))
        hit = top_pt(t, side)
        out = (lf * side + fw * rng.uniform(-0.6, 0.6))
        A.body_stone(lambda tt, h=hit: h, t, f0, f1, out, G, size=0.04 if t in T_CHIPS else 0.03, seed=k,
                     speed=1.8)
    # chips: off the top edges / corners that take the big hits, flying outward
    corners = [(0.33, -0.2, 0.69), (-0.33, -0.18, 0.7), (0.3, 0.2, 0.69), (-0.1, -0.22, 0.71)]
    for k, (t, c) in enumerate(zip(T_CHIPS, corners)):
        f = f0 + int(round(t * A.FPS))
        o = A.body_pt(C, c, f)
        d = (lf * math.copysign(1.0, c[0]) * 0.8 - fw * (0.3 if c[1] < 0 else -0.3) + Vector((0, 0, 0.9)))
        fx.chips(o, f, n=9, direction=tuple(d), speed=(1.0, 2.4), size=(0.012, 0.03), seed=20 + k,
                 floor_z=G(o.x, o.y), name="ClaudeChip")
        fx.puff(f"ChipDust{k}", o, f, n=4, spread=0.03, grow=(0.02, 0.1), life=(0.3, 0.6), rise=0.1,
                color=(0.75, 0.62, 0.5), opacity=0.4, seed=30 + k)

    # ---- light: the sprout's glow under it; a soft cool key on the face; a cold rim from the storm
    sc = bpy.context.scene
    sc.frame_set(f0 + 30)
    cl = cam.matrix_world.translation.copy()
    C.face_light(cl, energy=5.0, col=(0.82, 0.9, 1.0), dist=1.5, size=0.9)
    C.rim_light(cl, sky.storm_vec() + Vector((0, 0, 0.8)), col=(0.78, 0.8, 1.0), energy=150.0, dist=2.0)
    fx.lightning(f0 + 30, seed=21, flash=0.45)
    W.gust(f0, f1, 1.2)
    return dict(post=A.post_storm(focus_xy=(0.5, 0.45), haze_amt=0.7))
