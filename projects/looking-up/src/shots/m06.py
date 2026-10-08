"""M06 — INT night: the goodnight ritual. (A) Claude in bed turns to the lantern glowing on the bedside crate and
blinks twice, slowly. (B) In the lantern, the star blinks twice back — its glow pulsing twice with the blinks. (A) Claude
smiles and settles; eyes close."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, geo, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle
from shots.s06 import bed_pose, quilt_over, bed_camera, face_point

T_B = 2.15     # cut to the star
T_A2 = 3.75    # back to Claude
BLINKS_C = (0.85, 1.35)
BLINKS_S = (2.55, 3.05)


def make(f0, f1):
    W = world.World("int", "night")
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    W.practicals(stove=1.0, fill=1.5)
    bp = W.I["bed"]["pos"]
    crate = geo.box("BedsideCrate", (0.36, 0.36, 0.42), loc=O + Vector((bp[0] + 0.62, bp[1] + 0.55, 0.21)),
                    mat=W.I["mats"]["wood"], bevel=0.015)
    lan = interior.lantern(bpy.context.scene.collection, W.I["mats"])
    lp = O + Vector((bp[0] + 0.62, bp[1] + 0.55, 0.42))
    lan["root"].location = lp
    lan["root"].rotation_euler = (0, 0, math.radians(15))     # a gap between the posts faces Claude
    s = W.star()
    s.light_scale = 7.0
    sp = lp + Vector((0, 0, 0.17))
    hs = S.heading_to((lp.x, lp.y), (O.x + bp[0], O.y + bp[1] - 0.3))
    st = Track()
    st.pose(0.0, S.merge(S.S_SLEEP, x=sp.x, y=sp.y, z=sp.z, heading=hs, scale=0.55, eye_open=0.8, glow=1.0, curl=10,
                         pitch=-26, look_x=0.0, eye_happy=0.0))
    st.key(2.3, "inout", eye_open=0.95, look_x=0.4, glow=1.1, eye_happy=0.3)
    st.key(3.4, "linear", eye_happy=0.35)
    st.key(3.8, "inout", eye_happy=0.7, eye_open=0.6, glow=1.05)
    st.key(dur, "soft", eye_open=0.2, eye_happy=0.6)
    for b in BLINKS_S:
        st.layer(anim.blink_at(b, 0.34))

    def pulse(t, p):
        for b in BLINKS_S:
            u = (t - b) / 0.34
            if 0 <= u <= 1:
                p["glow"] = p.get("glow", 1) * (1 + 0.6 * math.sin(math.pi * u))
    st.layer(pulse)
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    c = W.claude()
    quilt_over(W, top_y=-0.24)          # tucked a little lower so the turning head never meets the quilt's edge
    bed = bed_pose(W, c)
    tr = Track()
    tr.pose(0.0, S.merge(bed, tilt_x=-80, head_turn=18, look_x=0.85, look_y=0.1, eye_open=0.85, eye_happy=0.15))
    for b in BLINKS_C:
        tr.layer(anim.blink_at(b, 0.36))
    tr.key(T_A2 + 0.2, "linear", eye_happy=0.2)
    tr.key(T_A2 + 0.6, "inout", eye_happy=0.75, eye_open=0.7)
    tr.key(dur, "soft", eye_open=0.05, eye_happy=0.6, head_turn=12, look_x=0.4)
    tr.layer(anim.breathe(0.015, 0.25))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # A: above the foot of the bed on the lantern side: Claude's face (turned to the lantern) and the lantern in frame
    fp, fn = face_point(c, f0 + 12)
    lan_top = lp + Vector((0, 0, 0.3))
    tA = fp * 0.72 + lan_top * 0.28 + Vector((0, 0, -0.05))
    eA = fp + Vector((0.42, -1.1, 1.0))
    camA = FR.shot_cam("CamA", f0, f1, eA, tA, 33, push=0.08, fstop=2.8, seed=27, check=False, focus_on=fp)
    # B: Claude's point of view: the star looks straight back out of its lantern
    eB = fp + (sp - fp) * 0.3 + Vector((0.03, -0.05, 0.0))
    camB = FR.shot_cam("CamB", f0, f1, eB, sp + Vector((0, 0, 0.01)), 50, push=0.12, fstop=2.2, seed=26, check=False)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_B * 24))
    S.cut(camA, f0 + int(T_A2 * 24))
    bpy.context.scene.camera = camA
    return dict(post=dict(haze_amt=0.0, bloom=0.6, bloom_thr=0.65, kuw_near=3, kuw_far=4, vignette=0.45))
