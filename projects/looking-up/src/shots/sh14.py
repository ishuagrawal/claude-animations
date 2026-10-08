"""SH14 (5 beats) - the decision. Close, from above Claude's feet-side shoulder: lying in the flowers, its eyes on
the sky; the star's dying flicker catches its eye - it looks down at the pale little thing at its side, and
understands (brows up, eyes wet). It rolls toward it and pulls it in tight against its chest, eyes squeezed shut:
it doesn't want to let go (T_HUG). A breath. Eyes open - firm (T_RESOLVE) - and it sits up, the star held to its
chest, rising into the lens."""
import math
import bpy
from mathutils import Vector, Matrix

from lu import anim, stage as S
from lu.anim import Track
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.sh10 import (meadow_world, bake, frame_from, hold_point, aimed_light, cam_track, night_post, FPS, STAR_SCALE,
                        mow_all, key_energy, tip_table, tip_lookup, heading_frame)
from shots.sh11 import lying_transform, star_nestle, C_LIE, BETA_LIE

T_HUG = 1.6             # pulls the star into a tight hug, eyes squeezed shut
T_RESOLVE = 2.8         # eyes open, firm - and it sits up

T_LOOK = 0.55           # eyes go from the sky to the star
T_KNOW = 1.0            # understanding
T_BREATH = 2.35         # the breath before the resolve


def make(f0, f1):
    W, K = meadow_world(frames=(f0, f1))
    dur = (f1 - f0) / FPS
    c = W.claude()
    s = W.star()
    s.light_scale = 4.0
    if s.light:
        s.light.data.shadow_soft_size = 0.25
        s.light.location = (0, -0.12, 0)
    loc0, R0 = lying_transform(W)
    sp0, SR0 = star_nestle(loc0, R0)
    mow_all((sp0.x, sp0.y), 0.3)
    PHI_LIE = 90.0 - BETA_LIE
    TIP = tip_table(PHI_LIE + 2.0)
    off_lie = tip_lookup(TIP, PHI_LIE)
    gz = W.ground(loc0.x, loc0.y + 0.3)

    # ------------------------------------------------------------------ body: lying -> roll toward the star (hug) ->
    # sit up (resolve)
    def phi_at(t):
        if t < T_RESOLVE:
            return PHI_LIE
        u = anim.ease("inout", (t - T_RESOLVE + 0.06) / (dur - T_RESOLVE + 0.2))
        return PHI_LIE + (36.0 - PHI_LIE) * u

    def roll_at(t):        # rolls onto its right side, toward the star, for the hug; back as it sits up
        a = 11.0 * anim.ease("inout", (t - T_LOOK + 0.2) / 0.5)          # turns toward it
        if t > T_HUG - 0.25:
            a = 11.0 + 15.0 * anim.ease("inout", (t - T_HUG + 0.25) / 0.4)
        if t > T_RESOLVE:
            a *= 1 - anim.ease("inout", (t - T_RESOLVE) / 0.35)
        return a

    def c_orient(t, p):
        phi = phi_at(t)
        R = Matrix.Rotation(math.radians(phi), 3, "X") @ heading_frame(180.0)
        headv = R @ Vector((0, 0, 1))
        R = Matrix.Rotation(math.radians(-roll_at(t)), 3, headv) @ R
        off = tip_lookup(TIP, phi)
        loc = loc0 + (off - off_lie)
        # keep the sit-up on the ground (rolling on its seat)
        return loc, R

    tr = Track()
    tr.pose(0.0, S.merge(C_LIE, eye_happy=0.25, eye_open=0.88, eye_tilt=0.15, look_y=-0.55, look_x=0.05, pupil=1.05,
                         head_nod=6))
    # the flicker catches its eye: it looks down at the star
    tr.key(T_LOOK, "out", look_x=-1.0, look_y=-0.4, head_turn=-14, eye_happy=0.0, eye_open=0.95, eye_tilt=0.3)
    # understanding: inner brows up, eyes wide and wet, a small pull back of the head
    tr.key(T_KNOW, "inout", eye_tilt=0.95, pupil=1.3, glint=1.5, head_turn=-22, head_nod=14, eye_open=1.0,
           look_x=-1.1, look_y=-0.5, squash=-0.03)
    tr.key(T_HUG - 0.3, "inout", eye_tilt=0.85, eye_open=0.8)
    # the hug: arms gather it in, eyes squeeze shut
    tr.key(T_HUG, "out", armR_up=-4, armR_fwd=70, armR_curl=62, armR_bend=0, armL_up=-6, armL_fwd=72, armL_curl=62,
           eye_open=0.0, eye_tilt=0.6, head_nod=18, head_turn=-6, look_x=0.0, look_y=0.0, squash=-0.08, slump=10,
           leg0_swing=40, leg1_swing=36, leg2_swing=34, leg3_swing=42)
    tr.key(T_BREATH, "inout", squash=-0.06, eye_open=0.0)
    tr.key(T_BREATH + 0.3, "inout", squash=0.06)                       # the breath in
    # resolve: eyes open, firm
    tr.key(T_RESOLVE - 0.08, "out", eye_open=0.78, eye_tilt=-0.55, pupil=1.0, glint=1.3, look_x=0.0, look_y=-0.15,
           head_turn=0, head_nod=8)
    tr.key(dur, "out", squash=0.04, eye_tilt=-0.6, eye_open=0.8, head_nod=-4, lean=4, slump=0, leg0_swing=70,
           leg1_swing=70, leg2_swing=70, leg3_swing=70, look_y=0.05)
    tr.layer(anim.tremble(T_HUG + 0.05, T_BREATH, amp=0.8, freq=9.0, seed=4))
    tr.layer(anim.breathe(0.012, 0.3))
    anim.anchor(tr, C_DEF)
    held = {}

    def after_c(f, t, p):
        bpy.context.view_layer.update()
        held[f] = (hold_point(c, Vector((0.0, -0.27, 0.36))), c.rig.matrix_world.to_3x3().normalized())
    bake(c, tr, f0, f1, orient=c_orient, after=after_c)

    # ------------------------------------------------------------------ the star: dim, shivering; gathered into the hug
    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, scale=STAR_SCALE, glow=0.32, warmth=0.3, eye_open=0.5, eye_tilt=0.8, look_y=0.25,
                         look_x=0.0, head=18, droop=44))
    st.key(T_LOOK + 0.2, "inout", look_x=0.5, look_y=-0.1, eye_open=0.55)            # it looks back at Claude
    st.key(T_HUG, "out", curl=26, droop=30, eye_open=0.3, glow=0.36, warmth=0.36)    # nestles in
    st.key(T_RESOLVE, "inout", eye_open=0.45, look_y=0.3, look_x=0.3)
    st.key(dur, "inout", eye_open=0.6, look_y=0.5, glow=0.4)

    def flick(t, p):
        for (tc, depth, w) in ((0.35, 0.5, 0.12), (0.62, 0.4, 0.08)):
            u = (t - tc) / w
            if 0 <= u <= 1:
                p["glow"] = p.get("glow", 1) * (1 + depth * math.sin(math.pi * u))
    st.layer(flick)
    st.layer(anim.tremble(0.0, T_HUG, amp=1.6, freq=14.0, seed=5))
    anim.anchor(st, S_DEF)
    cam_eye = [None]

    def s_orient(t, p):
        f = f0 + int(round(t * FPS))
        hp, Rc = held[f]
        u = anim.ease("inout", (t - (T_HUG - 0.3)) / 0.45)
        q = sp0.lerp(hp, u)
        cface = Rc @ Vector((0, -1, 0))
        cup = Rc @ Vector((0, 0, 1))
        face_h = (cface * 0.35 + (cam_eye[0] - q).normalized() * 0.65).normalized()
        if u <= 0:
            return q, SR0
        R1 = frame_from(face_h, cup)
        q0 = SR0.to_quaternion()
        return q, q0.slerp(R1.to_quaternion(), u).to_matrix()

    # ------------------------------------------------------------------ camera: above, on its right/feet side;
    # a slow push in, then it rides up with the sit-up
    face0 = loc0 + R0 @ Vector((0, -0.21, 0.56))
    tgt0 = face0.lerp(sp0, 0.38) + Vector((0, 0.08, 0.0))
    e0 = tgt0 + Vector((0.5, 1.55, 1.3))
    e1 = tgt0 + Vector((0.45, 1.4, 1.18))
    cam_eye[0] = e0
    bake(s, st, f0, f1, orient=s_orient)
    fz = W.ground(face0.x, face0.y)
    sit_t = tgt0 + Vector((0.0, 0.16, 0.2))
    cam = cam_track("Cam", [
        (0.0, "linear", e0, tgt0, 34, 2.8, None),
        (T_RESOLVE - 0.1, "soft", e1, tgt0 + Vector((0, 0.02, 0)), 37, 2.8, None),
        (dur, "inout", e1 + Vector((0.03, 0.06, 0.12)), sit_t, 36, 2.8, None)], f0, f1, seed=141, shake=0.1)
    bpy.context.scene.camera = cam

    # ------------------------------------------------------------------ lights: cool sky key on the face (the star
    # can't light it any more), a soft rim
    fl = aimed_light("FaceSky", c.col, face0 + Vector((0.6, 1.4, 1.8)), face0, 4.0, col=(0.72, 0.82, 1.0), size=4.0)
    aimed_light("RimC", c.col, face0 + Vector((-1.2, -1.4, 1.2)), face0, 10.0, col=(0.55, 0.7, 1.0), size=2.6)
    aimed_light("StarFace", s.col, e0 + Vector((0, 0, 0.3)), sp0, 1.6, col=(0.85, 0.9, 1.0), size=0.8)
    return dict(post=night_post(W, bloom=0.7, vignette=0.4, sat=0.92))
