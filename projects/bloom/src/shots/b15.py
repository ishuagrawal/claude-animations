"""B15 (38.75-41.25 s, 4 beats): CU two-shot, long lens, low. Claude weeps bowed over the dim sprout held at its
chest, eyes squeezed shut. The sprout's leaf weakly lifts, trembling, and touches Claude's face (T_TOUCH) - the
gesture of B04, when its leaf curled round Claude's finger - and its light flickers up a little, green on the face.
Claude's eyes open. It looks at the sprout... then straightens, wipes its eyes with its arm, the eyes set (the
determined slant), and it turns to the summit (T_SET): eyes first, then head, then body, off screen right."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from lu import world, acting, anim, claude, sprout, fx, post, sky, framing
from shots import act_climb as A
from shots.b12 import HEADING
from shots.b14 import DAMAGE, LOOK, WILT, WILT_HEADING, CHEEK, bow_pose

T_TOUCH = 0.8
T_SET = 2.0


def make(f0, f1):
    dur = (f1 - f0) / A.FPS
    W = world.World("low", focus=(26.0, 136.0), frames=(f0, f1), ambient=False)
    spot = W.mtn["hail"]["spot"]
    G = A.fast_ground(21.0, 31.0, 131.0, 141.0, res=0.03)
    X = Vector((spot.x, spot.y, G(spot.x, spot.y)))
    C = A.make_claude(W)
    S = A.make_sprout(C)                     # rides the cradle at its chest
    A.sprout_light(S, scale=0.12, soft=0.05)
    fw, lf = A.fwd(HEADING), A.left(HEADING)

    tr = anim.Track(claude.DEFAULT)
    H = bow_pose(C)
    P = dict(H)
    P.update(LOOK, x=X.x, y=X.y, z=X.z, heading=HEADING, ash=0.15, wet=0.4, damage=DAMAGE, eye_open=0.25,
             eye_squeeze=0.95, eye_tilt=1.0, smile=-0.5, wobble=0.6, tears=1.0)
    tr.pose(0.0, P)
    # the touch: it goes still
    tr.key(T_TOUCH, eye_squeeze=0.95, eye_open=0.25, wobble=0.6)
    tr.key(T_TOUCH + 0.12, "out", eye_squeeze=1.0, eye_open=0.15, wobble=0.25, squash=-0.06)
    # eyes open, slowly, down onto the sprout
    tr.key(1.05, eye_squeeze=0.45, eye_open=0.3, look_x=0.0, look_y=0.0)
    tr.key(1.32, "out", eye_squeeze=0.0, eye_open=0.8, eye_tilt=0.75, lower_lid=0.1, look_x=0.2, look_y=-0.9,
           head_tilt=6.0, wobble=0.1, smile=-0.25, pupil=1.25)
    tr.key(1.48, eye_tilt=0.5, eye_happy=0.25, lower_lid=0.15)
    # it straightens, wipes its eyes with its right arm, and sets
    hold_keys = {k: H[k] for k in ("handL_x", "handL_y", "handL_z", "handR_x", "handR_y", "handR_z", "crouch", "bend",
                                   "squash", "lean", "head_nod")}
    tr.key(1.5, armR_pole=0.0, handR_bend=H["handR_bend"], **hold_keys)
    up = dict(crouch=0.4, lean=4.0, bend=4.0, head_nod=3.0, squash=0.0)
    wipe_a = A.char_point(C, up, (-0.17, claude.FRONT_Y - 0.13, claude.EYE_Z - 0.02))
    wipe_b = A.char_point(C, up, (0.08, claude.FRONT_Y - 0.13, claude.EYE_Z))
    tr.key(1.68, "out", handR_x=wipe_a.x, handR_y=wipe_a.y, handR_z=wipe_a.z, armR_pole=55.0, handR_bend=30.0,
           eye_open=0.3, eye_squeeze=0.55, eye_happy=0.0, head_tilt=3.0, **up)
    tr.key(1.81, handR_x=wipe_b.x, handR_y=wipe_b.y, handR_z=wipe_b.z, eye_open=0.35)
    hr = A.hands_to_root(C, dict(up, handR_x=-0.19, handR_y=-0.37, handR_z=0.3))
    tr.key(1.95, "out", handR_x=hr["handR_x"], handR_y=hr["handR_y"], handR_z=hr["handR_z"], armR_pole=10.0,
           handR_bend=30.0, eye_squeeze=0.0, eye_open=0.72, eye_tilt=-0.85, lower_lid=0.42, tears=0.35, smile=0.0,
           wobble=0.0, squash=0.04, head_tilt=0.0, look_x=0.35, look_y=-0.2)
    hl = A.hands_to_root(C, dict(up, handL_x=0.19, handL_y=-0.37, handL_z=0.3))
    tr.key(1.81, handL_x=H["handL_x"], handL_y=H["handL_y"], handL_z=H["handL_z"])
    tr.key(1.98, handL_x=hl["handL_x"], handL_y=hl["handL_y"], handL_z=hl["handL_z"])
    # T_SET: it turns to the summit - eyes, then head, then body
    tr.key(T_SET - 0.1, look_x=0.35, look_y=-0.2, head_turn=0.0)
    tr.key(T_SET + 0.02, "out", look_x=1.25, look_y=0.5)
    tr.key(T_SET + 0.18, "out", head_turn=24.0, head_nod=-5.0, look_x=1.05)
    tr.key(T_SET + 0.06, heading=HEADING)
    tr.key(dur, heading=HEADING + 14.0, head_turn=26.0, look_x=1.0, look_y=0.55, squash=0.06, lean=7.0)
    A.freeze(tr, 0.0, claude.DEFAULT)
    tr.layer(acting.sob(0.0, T_TOUCH + 0.1, rate=2.2, amp=0.9, seed=0.3))
    tr.layer(acting.breathe(amp=0.012, rate=0.6, arms=0.0))
    tr.layer(anim.blinks(times=[2.24], dur=0.12))
    A.bake_char(C, tr, f0, f1, claude.DEFAULT)
    C.tear("L", f0 - 6, dur=1.3)
    C.tear("R", f0 + int(round(1.3 * A.FPS)), dur=0.85)

    # ---- the sprout's leaf (the one on the face's side) lifts and touches Claude's face
    sc = bpy.context.scene
    ft = f0 + int(round(T_TOUCH * A.FPS))
    sc.frame_set(ft)
    cheek = A.body_pt(C, CHEEK, ft)
    base = dict(WILT, heading=WILT_HEADING, x=0.0, y=0.0, z=0.0)
    touch = dict(acting.S_TOUCH, grow=1.0, clod=1.0, heading=180.0, x=0.0, y=0.0, z=0.0, droop=0.4, leafL_droop=0.8,
                 leafR_droop=0.0, glow=0.75, health=0.32, eye_open=0.45, head_nod=-20.0, bend=0.0)
    sols = {sd: S.reach_leaf(sd, cheek, touch, frame=ft, mode="tip", reach_range=(-40.0, 110.0)) for sd in "LR"}
    print("B15 leaf-touch errors (m):", {k: round(v["_error"], 4) for k, v in sols.items()})
    LEAF = min(sols, key=lambda k: sols[k]["_error"])
    sol = sols[LEAF]
    sol.pop("_error", None)
    touch.update(sol)
    # close the last centimetres: slide the sprout in the cradle so the leaf tip lands exactly on the face
    S.apply(touch)
    sc.frame_set(ft)
    tip = S.point(f"leaf{LEAF}_tip", ft)
    resid = S.anchor.matrix_world.to_3x3().inverted() @ (cheek - tip)
    print("B15 leaf:", LEAF, sol, "slide (m):", round(resid.length, 4))

    def touch_w(t):
        return A.smooth((t - 0.45) / 0.35) * (1.0 - A.smooth((t - 1.55) / 0.35))
    Lr, Ld, Lc = f"leaf{LEAF}_reach", f"leaf{LEAF}_droop", f"leaf{LEAF}_curl"
    st = anim.Track(sprout.DEFAULT)
    st.pose(0.0, base)
    st.key(0.25, head_nod=WILT["head_nod"], eye_open=0.15, lean=WILT["lean"], heading=WILT_HEADING,
           **{Lr: 0.0, Ld: 1.0})
    # it stirs: turns toward Claude and lifts its head a little as the leaf rises
    # the leaf lifts weakly, falters half way, then reaches
    st.key(0.5, head_nod=30.0, eye_open=0.3, heading=160.0, bend=12.0, **{Lr: touch[Lr] * 0.45, Ld: 0.5})
    st.key(0.58, **{Lr: touch[Lr] * 0.36, Ld: 0.6})
    st.pose(T_TOUCH, {k: v for k, v in touch.items() if k not in ("x", "y", "z")}, ease="out")
    st.key(T_TOUCH + 0.3, glow=0.75, mouth=0.15)
    st.key(1.6, glow=0.6, health=0.3, lean=touch["lean"], **{Lr: touch[Lr]})
    st.key(T_SET, lean=10.0, **{Lr: touch[Lr] * 0.6, Lc: 0.3})
    st.key(dur, glow=0.55, droop=0.5, look_y=0.5, look_x=0.4, **{Lr: touch[Lr] * 0.3})
    A.freeze(st, 0.0, sprout.DEFAULT)
    st.layer(acting.sprout_shiver(0.25, T_TOUCH + 0.5, amp=0.35, freq=9.0))

    def slide(t, p):
        w = touch_w(t)
        p["x"], p["y"], p["z"] = resid.x * w, resid.y * w, resid.z * w
    st.layer(slide)
    A.bake_char(S, st, f0, f1, sprout.DEFAULT)

    # ---- camera: a low CU two-shot from its front-left, under the bowed face: the sprout and Claude's eyes;
    # rack sprout -> eyes; it eases back as Claude straightens and turns to the summit
    def at(where, t):
        f = f0 + int(round(t * A.FPS))
        if where == "sprout":
            return S.point("head", f)
        return A.body_pt(C, (0.0, claude.FRONT_Y, claude.EYE_Z - 0.04), f)
    a = math.radians(-90.0 + HEADING + 18.0)
    cd = Vector((math.cos(a), math.sin(a), 0.0))
    s0, s1 = at("sprout", 0.6), at("sprout", 1.3)
    e0, e1, e2 = at("eyes", 0.6), at("eyes", 1.3), at("eyes", dur)
    T0 = s0.lerp(e0, 0.45)
    T1 = s1.lerp(e1, 0.5)
    T2 = e2 + lf * 0.12 + Vector((0, 0, -0.05))
    E0 = T0 + cd * 2.15
    E0.z = s0.z + 0.1
    E1 = T1 + cd * 2.25
    E1.z = s1.z + 0.1
    E2 = T2 + cd * 3.0
    E2.z = T2.z - 0.04
    ct = anim.Track(anim.CAM_DEFAULT)
    A.ckey(ct, 0.0, E0, T0, lens=85.0, fstop=2.0, focus=(s0 - E0).length)
    A.ckey(ct, T_TOUCH + 0.1, E0.lerp(E1, 0.3), T0.lerp(T1, 0.3), focus=(s0 - E0).length)
    A.ckey(ct, 1.25, E1, T1, focus=(e1 - E1).length)
    A.ckey(ct, 1.6, E1, T1, focus=(e1 - E1).length)
    A.ckey(ct, dur, E2, T2, focus=(e2 - E2).length)
    ct.layer(A.handheld(amp=0.003, ang=0.1, freq=0.6, seed=151))
    cam = A.make_camera("CamB15", ct, f0, f1, seed=15)
    A.clear_line(E0, X, radius=0.5)
    A.clear_line(E2, X, radius=0.5)
    A.clear_line(E0, X, radius=1.1, u0=0.75, u1=0.95, step=0.2)

    W.fx["hail"] = A.timed_hail((X.x, X.y), 4.5, -8.0 + np.random.default_rng(15).random(1500) * 7.0, f0,
                                exclude=[(X.x, X.y, 0.6, 0.55, HEADING)], rest=11.0, stone=(0.02, 0.04))
    W.fx["rain"] = fx.rain((X.x - 3.0, X.y + 1.0, X.z + 5.0), (14.0, 14.0, 10.0), 2200, f0, wind=(1.2, -0.4),
                           fall=8.5, amount_=0.2)
    W.set_env(Wet=1.0)
    sc.frame_set(f0 + 30)
    cl = cam.matrix_world.translation.copy()
    C.face_light(cl, energy=1.4, col=(1.0, 0.8, 0.64), dist=1.4, size=0.6)    # a warm cheat: Claude stays terracotta
    C.rim_light(cl, sky.sun_vec(), col=(0.72, 0.78, 0.95), energy=45.0, dist=2.0)
    A.soft_fill(S.col, s0, cl, energy=2.5, col=(0.85, 0.92, 1.0), dist=0.8, size=0.5, up=0.1, name="SproutFill15")
    return dict(post=A.post_low(focus_xy=(0.5, 0.5)))
