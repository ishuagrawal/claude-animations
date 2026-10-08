"""D04 — INT sunny day: Claude has made the windowsill into a sun-trap — the star sits in a pool of sunlight ringed
by oil lamps. Claude sets down the last lamp, steps back, hopeful (hands together). The star manages a small, weak smile
— grateful, but no brighter."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu import claude as CL, star as ST
from shots.d01 import anchor, close_door
from shots.h05 import ang_diff


def oil_lamp(name, mats):
    brass = mats["brass"]
    glass = mats["glass"]
    b = geo.lathe(name + "_b", [(0.0, 0.0), (0.06, 0.0), (0.065, 0.03), (0.04, 0.06), (0.015, 0.07), (0.0, 0.07)], seg=16, mat=brass)
    g = geo.lathe(name + "_g", [(0.02, 0.07), (0.035, 0.09), (0.03, 0.16), (0.022, 0.17)], seg=16, mat=glass, cap_top=False, cap_bot=False)
    fl = geo.lathe(name + "_f", [(0.0, 0.085), (0.008, 0.095), (0.006, 0.11), (0.0, 0.12)], seg=8, mat=mats["flame"])
    return geo.join([b, g, fl], name)


def make(f0, f1):
    W = world.World("int", "day", sun_dir=(0.65, -0.62, 0.42))
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1]:
        interior.set_ishutter(p, 1.72)          # folded right back against the wall: every bit of sun let in
    W.practicals(fill=6.5, stove=1.2)
    close_door(W)
    W.I["telescope"]["sheet"].hide_render = True       # the sheeted telescope would stand between camera and window
    a = math.radians(-45)
    n = Vector((math.cos(a), math.sin(a), 0))
    t = Vector((-n.y, n.x, 0))
    win = lambda proj, u, z: O + n * proj + t * u + Vector((0, 0, z))
    sill_z = 0.73
    sp = win(2.99, 0.02, sill_z + 0.12)
    # Claude on the step crate at the window, a little to the right of the star
    cpos = win(2.72, 0.62, 0)
    ctop = O.z + 0.42
    crate = W.I["crate"]["crate"]
    bpy.context.view_layer.update()
    crate.matrix_world = Matrix.Translation(Vector((cpos.x, cpos.y, O.z))) @ Matrix.Rotation(a + math.pi / 2, 4, "Z")
    # camera inside, left of the window along the wall: the star on the sill (left), Claude on its crate (right)
    eye = win(1.22, -0.56, 0.92)
    s = W.star()
    s.light_scale = 2.0
    h_sc = S.heading_to((sp.x, sp.y), (cpos.x, cpos.y))
    h_sk = S.heading_to((sp.x, sp.y), (eye.x, eye.y))
    dk = ang_diff(h_sk, h_sc)
    hs = h_sc + 0.62 * dk
    ls = -1.0 if dk > 0 else 1.0
    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, x=sp.x, y=sp.y, z=sp.z, heading=hs, glow=0.4, warmth=0.6, eye_open=0.6, look_y=0.0,
                         look_x=0.5 * ls, droop=34))
    st.key(1.9, "linear", eye_open=0.6, look_x=0.5 * ls, droop=34)
    # a small, weak smile — grateful, but no brighter
    st.key(2.7, "inout", eye_happy=0.5, eye_open=0.55, eye_tilt=0.25, glow=0.45, head=4, look_x=0.65 * ls, look_y=0.15,
           droop=28)
    st.key(dur, "soft", eye_happy=0.42, eye_tilt=0.45, glow=0.42, droop=32)
    st.layer(anim.blinks(times=[1.25, 3.9], dur=0.2))
    anchor(st, ST.DEFAULT)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    lamps = []
    for k, u in enumerate((-0.34, -0.18, 0.18, 0.34)):
        L_ = oil_lamp(f"OilLamp{k}", W.I["mats"])
        L_.location = win(2.96, u, sill_z)
        lamps.append(L_)
        scene.point(f"OilLampL{k}", win(2.96, u, sill_z + 0.1), (1.0, 0.65, 0.3), 1.5, 0.02)
    c = W.claude()
    h_star = S.heading_to((cpos.x, cpos.y), (sp.x, sp.y))
    h_cam = S.heading_to((cpos.x, cpos.y), (eye.x, eye.y))
    d = ang_diff(h_cam, h_star)
    hd = h_star + 0.45 * d
    lc = -1.0 if d > 0 else 1.0
    back = cpos - n * 0.08
    hold = dict(armL_up=38, armR_up=38, armL_fwd=72, armR_fwd=72, armL_curl=25, armR_curl=25)
    tr = Track()
    tr.pose(0.0, S.merge(hold, x=cpos.x, y=cpos.y, z=ctop, heading=h_star, lean=14, look_y=-0.3, look_x=0.0,
                         eye_open=0.9))
    # reaches over and sets the last lamp down on the sill
    tr.key(0.85, "inout", lean=22, armL_up=46, armR_up=46, armL_fwd=80, armR_fwd=80)
    tr.key(1.1, "linear", lean=22, heading=h_star)
    # steps back, hands together, hopeful
    tr.key(1.8, "inout", x=back.x, y=back.y, heading=hd, lean=-2, armL_up=-6, armR_up=-6, armL_fwd=66, armR_fwd=66,
           armL_curl=50, armR_curl=50, eye_open=1.0, pupil=1.12, eye_happy=0.25, look_x=0.5 * lc, look_y=-0.1,
           squash=0.05)
    tr.key(2.85, "inout", eye_happy=0.45, head_tilt=7 * lc, squash=0.06)
    # ...the glow doesn't rise; hope wavers
    tr.key(3.7, "inout", eye_happy=0.12, eye_tilt=0.45, head_tilt=11 * lc, slump=4, squash=0.0, pupil=1.0)
    tr.key(dur, "soft", eye_tilt=0.55, slump=6, armL_curl=40, armR_curl=40)
    tr.layer(anim.blinks(times=[2.35], dur=0.16))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # the last lamp travels from Claude's hands to its place on the sill
    lam = lamps[3]
    end = lam.location.copy()
    sc = bpy.context.scene
    hand_pts = []
    for f in range(f0, f1):
        sc.frame_set(f)
        pl = c.rig.matrix_world @ c.rig.pose.bones["armL2"].tail
        pr_ = c.rig.matrix_world @ c.rig.pose.bones["armR2"].tail
        hand_pts.append((pl + pr_) / 2)
    for i, f in enumerate(range(f0, f1)):
        tt = (f - f0) / 24
        u = anim.ease("inout", (tt - 0.15) / 0.85)
        start = hand_pts[i] + (end - hand_pts[i]).normalized() * 0.12 - Vector((0, 0, 0.08))
        lam.location = start.lerp(end, u) if tt < 1.0 else end
        lam.keyframe_insert("location", frame=f)
    fx.beam("SunBeam", win(3.9, 0.0, 1.75), sp + n * -0.25 + Vector((0, 0, -0.55)), 0.3, 0.55, color=(1.0, 0.86, 0.6),
            strength=0.16)
    tgt = sp * 0.46 + (cpos + Vector((0, 0, 0.42 + 0.5))) * 0.54
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 25, push=0.05, fstop=3.2, seed=46, check=False,
                      focus_on=(sp + cpos + Vector((0, 0, 0.9))) / 2)
    return dict(face_key=30.0, post=dict(haze_amt=0.0, bloom=0.45, bloom_thr=0.85, kuw_near=3, kuw_far=4, vignette=0.35,
                                        exposure=-0.05))
