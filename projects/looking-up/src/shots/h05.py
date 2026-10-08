"""H05 — INT grey dawn, cold light seeping round the closed shutters. The star lies on the floor by the stove, barely
glowing. It tries to float up — rises a hand's width, trembling — and drops back. It turns to look at Claude, sitting
nearby on the floor. Claude can't meet its eyes: it looks away, turns its body away, and folds in on itself.
(Music: silence.)"""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, framing as FR
from lu import claude as CL, star as ST
from lu.anim import Track, CAM_DEFAULT
from shots.s13 import stove_spot
from shots.d01 import anchor, face_light

T_TRY = (1.0, 2.2)
T_LOOK = 3.3
T_AWAY = 4.4


def ang_diff(a, b):
    return (a - b + 180.0) % 360.0 - 180.0


def make(f0, f1):
    W = world.World("int", "winter", sun_dir=(0.6, -0.65, 0.12))
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    __import__("lu.sky", fromlist=["x"]).interior_mode("night", world_e=0.012)
    W.practicals(fill=2.2)
    W.I["table"]["flame"].hide_render = True          # the candle burnt out in the night
    # grey light seeping in at the window seams
    for a_deg in (-45, 45):
        a = math.radians(a_deg)
        scene.point(f"Seam{a_deg}", O + Vector((math.cos(a), math.sin(a), 0)) * 2.7 + Vector((0, 0, 1.15)), (0.7, 0.78, 0.9),
                    6.0, 0.4)
    spot = stove_spot(W, 0.78)
    cpos = spot + Vector((0.84, -0.42, 0))
    cpos.z = O.z
    # camera: low on the floor, off the line between them, a little nearer the star; the cold stove behind it
    mid = (spot + cpos) / 2
    eye = O + Vector((-1.72, -0.3, 0.0))
    eye.z = O.z + 0.34
    s = W.star()
    s.light_scale = 1.6
    h_to_c = S.heading_to((spot.x, spot.y), (cpos.x, cpos.y))
    h_to_k = S.heading_to((spot.x, spot.y), (eye.x, eye.y))
    dk = ang_diff(h_to_k, h_to_c)
    hs = h_to_c + 0.45 * dk                                 # cheat its face toward camera; eyes find Claude
    ls = -1.0 if dk > 0 else 1.0                            # look_x sign toward Claude
    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, x=spot.x, y=spot.y, z=spot.z + 0.09, heading=hs, pitch=-50, glow=0.2, warmth=0.3,
                         eye_open=0.35, look_y=0.6, look_x=0.0, droop=40))
    # gathers itself... and tries to float
    st.key(T_TRY[0], "inout", pitch=-5, z=spot.z + 0.12, eye_open=0.75, eye_tilt=-0.45, squash=-0.14, droop=20, look_y=0.5)
    st.key(T_TRY[0] + 0.55, "out", z=spot.z + 0.24, squash=0.07, glow=0.34, warmth=0.42, arms=22, eye_tilt=-0.6, droop=8)
    st.key(T_TRY[1] - 0.25, "linear", z=spot.z + 0.25, glow=0.32)
    # ...and drops back
    st.key(T_TRY[1], "in", z=spot.z + 0.1, squash=-0.22, pitch=-12, glow=0.17, warmth=0.28, eye_open=0.3, arms=0, droop=44,
           eye_tilt=0.3, look_y=-0.3)
    st.key(T_TRY[1] + 0.35, "out", squash=-0.06)
    # it turns to look at Claude
    st.key(T_LOOK, "inout", pitch=-14, squash=-0.05, eye_open=0.66, eye_tilt=0.75, look_x=0.6 * ls, look_y=0.35, glow=0.2,
           droop=40, head=-4)
    st.key(T_AWAY + 0.6, "linear", eye_open=0.6, look_x=0.6 * ls)
    # ...Claude won't look back; it lowers its eyes
    st.key(dur, "soft", eye_open=0.45, eye_tilt=0.85, droop=55, glow=0.16, look_y=-0.2, look_x=0.3 * ls, head=14)
    st.layer(anim.tremble(T_TRY[0] + 0.4, T_TRY[1], amp=3.0, freq=19))
    st.layer(anim.blinks(times=[T_LOOK + 0.6], dur=0.22))
    anchor(st, ST.DEFAULT)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    c = W.claude()
    h_star = S.heading_to((cpos.x, cpos.y), (spot.x, spot.y))
    h_cam = S.heading_to((cpos.x, cpos.y), (eye.x, eye.y))
    d = ang_diff(h_cam, h_star)
    hc = h_star + 0.4 * d                       # faces the star, opened up a little to camera
    h_away = h_star + 1.45 * d                  # turned away from the star: past the camera, still readable
    sg = 1.0 if d > 0 else -1.0                 # the star is on Claude's right when sg > 0
    tr = Track()
    tr.pose(0.0, S.merge(S.C_SIT(0.0), x=cpos.x, y=cpos.y, z=O.z, heading=hc, slump=10, eye_open=0.72, look_y=-0.35,
                         look_x=-0.35 * sg, armL_up=-30, armR_up=-30, eye_tilt=0.45))
    # hope: leans in as the star tries
    tr.key(T_TRY[0] + 0.3, "inout", lean=10, slump=4, eye_open=0.95, pupil=1.08, eye_tilt=0.55, look_y=-0.2)
    tr.key(T_TRY[1] - 0.1, "linear", lean=12)
    # it falls — a flinch
    tr.key(T_TRY[1] + 0.15, "snap", squash=-0.05, lean=6, eye_open=0.85, eye_tilt=0.7)
    # the star looks at Claude... Claude holds it a moment
    tr.key(T_LOOK + 0.2, "inout", look_y=-0.1, look_x=-0.5 * sg, eye_open=0.8, squash=0.0)
    tr.key(T_AWAY - 0.15, "linear", look_x=-0.5 * sg)
    tr.hold(T_AWAY - 0.1, "heading", "slump", "lean", "squash", "eye_tilt", "armL_up", "armR_up", "eye_open", "look_y",
            "pupil")
    # ...and can't: eyes slide away, the head follows, then the whole body turns away and folds in
    tr.key(T_AWAY + 0.25, "inout", look_x=0.95 * sg, look_y=-0.5, head_turn=22 * sg, eye_open=0.55, eye_tilt=0.8)
    tr.key(T_AWAY + 1.1, "inout", **S.merge(S.C_GUILT, heading=h_away, look_x=0.4 * sg, look_y=-0.7, head_turn=8 * sg,
                                            slump=24, eye_open=0.3, squash=-0.1, lean=10, armL_up=-55, armR_up=-50,
                                            armL_fwd=40, armR_fwd=45))
    tr.key(dur, "soft", slump=30, eye_open=0.05, squash=-0.12, lean=14)
    tr.layer(anim.breathe(0.012, 0.2))
    tr.layer(anim.blinks(times=[T_TRY[1] + 0.6], dur=0.18))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    tgt = spot * 0.44 + cpos * 0.56 + Vector((0, 0, 0.24))
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 26, push=0.03, fstop=3.2, shake=0.12, seed=55, check=False,
                      focus_on=spot * 0.5 + cpos * 0.5 + Vector((0, 0, 0.25)))
    fm = f0 + int(T_AWAY * 24)
    face_light(c, eye, None, energy=30.0, col=(0.82, 0.86, 1.0), frame=fm)
    face_light(s, eye, None, energy=6.0, col=(0.9, 0.9, 1.0), frame=fm)
    return dict(face_key=0.0, post=dict(haze_amt=0.0, bloom=0.3, bloom_thr=0.8, kuw_near=3, kuw_far=4, vignette=0.5,
                                        sat=0.78, gain=(0.94, 0.97, 1.03)))
