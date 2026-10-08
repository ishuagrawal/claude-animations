"""D02 — INT evening: the star rests by the stove. Claude, at the workbench, glances over — instantly the star scoots
closer to the stove's warmth, puffs up and forces a bright smile and a brighter glow. Claude turns back to its work...
and behind its back the star sags: the glow drains, the points droop. It's hiding how weak it's getting."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, framing as FR
from lu import claude as CL, star as ST
from lu.anim import Track, CAM_DEFAULT
from shots.s13 import stove_spot
from shots.d01 import anchor, face_light, close_door
from shots.h05 import ang_diff

T_LOOK = 0.8
T_AWAY = 2.7
T_CUT = T_AWAY + 0.2


def make(f0, f1):
    W = world.World("int", "dusk")
    O = W.origin
    dur = (f1 - f0) / 24
    fc = f0 + int(T_CUT * 24)
    pr = W.practicals(lamp=3.0, stove=2.4, fill=2.0)
    st_ = W.I["stove"]
    side = Vector((-st_["front"].y, st_["front"].x, 0))
    pr["stove"].location = O + st_["pos"] + st_["front"] * 0.5 + side * 0.25 + Vector((0, 0, 0.42))
    close_door(W)
    # the star rests on the little second stool, drawn up to the stove's warmth
    stool = stove_spot(W, 0.6)
    spot = stove_spot(W, 0.64) + Vector((0, 0, 0.5))
    near = stove_spot(W, 0.5) + Vector((0, 0, 0.5))
    # Claude works at the bench standing on the step crate (the bench top is above its head otherwise)
    cpos = O + Vector((-0.12, 2.06, 0))
    crate = W.I["crate"]["crate"]
    bpy.context.view_layer.update()
    crate.matrix_world = Matrix.Translation(Vector((cpos.x, cpos.y, O.z))) @ Matrix.Rotation(0.0, 4, "Z")
    W.I["table"]["stool2"].matrix_world = Matrix.Translation(Vector((stool.x, stool.y, O.z)))
    ctop = O.z + 0.42
    # cameras: A, the two-shot from the room; B, low beside the bed: the star close, Claude's back at the bench behind
    eA = O + Vector((0.18, -0.12, 0.78))
    eB = O + Vector((-1.6, 0.4, 0.74))
    s = W.star()
    s.light_scale = 5.0
    h_sc = S.heading_to((spot.x, spot.y), (cpos.x, cpos.y))
    h_sa = S.heading_to((spot.x, spot.y), (eA.x, eA.y))
    hs = h_sc + 0.55 * ang_diff(h_sa, h_sc)
    ls = -1.0 if ang_diff(h_sa, h_sc) > 0 else 1.0
    h_sb = S.heading_to((near.x, near.y), (eB.x, eB.y)) - 12
    st = Track()
    st.pose(0.0, S.merge(S.S_SAD, x=spot.x, y=spot.y, z=spot.z + 0.13, heading=hs, glow=0.55, warmth=0.7, look_x=0.3 * ls,
                         look_y=-0.3))
    st.key(T_LOOK + 0.08, "linear", glow=0.55, look_x=0.3 * ls)
    # caught looking: it scoots closer to the stove, puffs up, a big bright smile
    st.key(T_LOOK + 0.45, "back", **S.merge(S.S_HAPPY, x=near.x, y=near.y, glow=1.3, warmth=1.0, eye_happy=0.9, arms=32,
                                            squash=0.1, droop=0, look_x=0.75 * ls, look_y=0.25, head=-10))
    st.key(T_AWAY, "linear", glow=1.22, eye_happy=0.85, squash=0.08, arms=30)
    st.hold(T_AWAY + 0.35, "heading", "droop", "glow", "warmth", "eye_happy", "eye_open", "eye_tilt", "arms", "squash",
            "look_x", "look_y", "head", "legs")
    # the mask slips: the smile goes, the glow drains, and it turns its face from Claude
    st.key(T_AWAY + 0.85, "inout", eye_happy=0.0, eye_open=0.55, eye_tilt=0.7, glow=0.6, warmth=0.6, squash=-0.04, arms=8,
           look_x=0.3 * ls, look_y=-0.2)
    st.key(T_AWAY + 1.6, "inout", **S.merge(S.S_DIM, glow=0.32, warmth=0.45, heading=h_sb, look_x=0.0, look_y=-0.5,
                                            squash=-0.06))
    st.key(dur, "soft", droop=54, glow=0.28, eye_open=0.4)
    st.layer(anim.blinks(times=[0.4, T_AWAY + 0.95], dur=0.16))
    anchor(st, ST.DEFAULT)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    c = W.claude()
    h_bench = 180.0
    h_star = S.heading_to((cpos.x, cpos.y), (near.x, near.y))
    h_camA = S.heading_to((cpos.x, cpos.y), (eA.x, eA.y))
    h_glance = h_star + 0.45 * ang_diff(h_camA, h_star)
    lc = -1.0 if ang_diff(h_camA, h_star) > 0 else 1.0       # look_x sign toward the star
    tr = Track()
    tr.pose(0.0, dict(x=cpos.x, y=cpos.y, z=ctop, heading=h_bench, armL_fwd=55, armR_fwd=60, armR_up=25, armL_up=15,
                      lean=6, look_y=-0.3))
    tr.key(T_LOOK - 0.15, "linear", heading=h_bench, lean=6)
    tr.key(T_LOOK + 0.2, "inout", heading=h_glance, lean=0, look_x=0.6 * lc, look_y=-0.25, head_turn=0, eye_open=0.95,
           armR_up=5, armL_up=0, armL_fwd=35, armR_fwd=35)
    tr.key(T_LOOK + 0.75, "inout", eye_happy=0.55, head_tilt=8 * lc, look_x=0.65 * lc)
    tr.key(T_AWAY - 0.25, "linear", eye_happy=0.5, heading=h_glance, head_tilt=8 * lc)
    tr.key(T_AWAY + 0.15, "inout", heading=h_bench, eye_happy=0.0, lean=6, look_x=0.0, head_tilt=0, look_y=-0.3,
           armR_up=25, armL_up=15, armL_fwd=55, armR_fwd=60)
    tr.key(dur, "linear", lean=8)

    def work(t, p):
        if t < T_LOOK - 0.15 or t > T_AWAY + 0.2:
            p["armR_up"] = p.get("armR_up", 0) + 12 * math.sin(t * 7)
            p["armL_fwd"] = p.get("armL_fwd", 0) + 5 * math.sin(t * 7 + 1.0)
    tr.layer(work)
    tr.layer(anim.blinks(times=[1.9], dur=0.16))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # A: two-shot from the middle of the room — Claude up at the bench (right), the star by the glowing stove (left)
    tA = (near + Vector((0, 0, 0.25))) * 0.48 + (cpos + Vector((0, 0, 0.42 + 0.5))) * 0.52
    camA = FR.shot_cam("CamA", f0, fc, eA, tA, 26, push=0.05, fstop=3.2, seed=42, check=False,
                       focus_on=(near + cpos) / 2 + Vector((0, 0, 0.5)))
    # B: low and close on the star as the mask slips; Claude's back at the bench, soft, behind it
    tB = (near + Vector((0, 0, 0.14))) * 0.68 + (cpos + Vector((0, 0, 0.9))) * 0.32
    camB = FR.shot_cam("CamB", fc, f1, eB, tB, 32, push=0.06, fstop=2.6, seed=47, check=False,
                       focus_on=near + Vector((0, 0, 0.15)))
    S.cut(camA, f0)
    S.cut(camB, fc)
    bpy.context.scene.camera = camA
    face_light(c, eA, None, energy=35.0, frame=f0 + int((T_LOOK + 1.0) * 24))
    face_light(s, eB, O + W.I["stove"]["pos"], energy=10.0, frame=f0 + int((T_AWAY + 1.0) * 24))
    return dict(face_key=0.0, post=dict(haze_amt=0.0, bloom=0.5, bloom_thr=0.7, kuw_near=3, kuw_far=4, vignette=0.45))
