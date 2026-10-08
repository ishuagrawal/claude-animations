"""H02 — INT night: meteor light flickers through the side window. In its lantern on the table, the dim star stirs,
eyes opening toward the window... it rises, as if pulled — glow brightening with every streak, drifting toward the
glass. Behind, Claude sits up from the table, alarmed."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, props, framing as FR
from lu import claude as CL, star as ST
from lu.anim import Track, CAM_DEFAULT
from shots.d01 import lantern_on_table, anchor, face_light, close_door

STREAKS = (0.3, 1.0, 1.7, 2.3, 2.9, 3.5)


def make(f0, f1):
    W = world.World("int", "night")
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_side"][1]:
        interior.set_ishutter(p, 1.0)
    for p in W.I["win_front"][1]:
        interior.set_ishutter(p, 0.0)
    W.practicals(stove=0.6, candle=1.2)
    close_door(W)
    props.meteors(30, 0.0, dur, f0, seed=17, origin=(O.x, O.y, 0), az_range=(10, 80), el_range=(10, 45))
    lan, lp, sp = lantern_on_table(W)
    # the side window frame (mill-local): outward normal n, tangent t
    a = math.radians(45)
    n = Vector((math.cos(a), math.sin(a), 0))
    t_ = Vector((-n.y, n.x, 0))
    win = lambda proj, u, z: O + n * proj + t_ * u + Vector((0, 0, z))
    lp = win(1.74, 0.17, 0.77)                    # the lantern at the window-side corner of the table
    lan["root"].location = lp
    sp = lp + Vector((0, 0, 0.17))
    # meteor light flashing in through the window, one flash per streak
    fl = scene.point("MeteorFlicker", win(3.8, 0.0, 1.6), (0.8, 0.85, 1.0), 0.0, 0.3)
    flash = lambda t: sum(math.sin(math.pi * min(1, max(0, (t - ts) / 0.3))) ** 2 for ts in STREAKS)
    for f in range(f0, f1):
        t = (f - f0) / 24
        fl.data.energy = 70 * flash(t) + 0.01
        fl.data.keyframe_insert("energy", frame=f)
    # camera: just inside the open window, looking back into the room — the star rises toward us (toward the glass),
    # Claude at the table behind it
    eye = win(3.12, -0.36, 1.24)
    s = W.star()
    s.light_scale = 5.0
    h_win = S.heading_to((sp.x, sp.y), (eye.x, eye.y))
    end = win(2.18, 0.2, 1.13)
    st = Track()
    st.pose(0.0, S.merge(S.S_SLEEP, x=sp.x, y=sp.y, z=sp.z, heading=h_win + 150, scale=0.55, glow=0.38, warmth=0.55,
                         droop=24))
    # it stirs; eyes open toward the window
    st.key(0.9, "inout", eye_open=0.7, look_y=0.4, head=-10, glow=0.48, heading=h_win + 110, curl=8)
    st.key(1.6, "inout", heading=h_win, eye_open=1.0, pupil=1.12, look_y=0.35, glow=0.75, warmth=0.85, curl=0, droop=8,
           scale=0.62, z=sp.z + 0.04)
    # ...and rises, as if pulled, out of the lantern toward the glass
    st.key(dur, "inout", **S.merge(S.S_LONGING, x=end.x, y=end.y, z=end.z, scale=0.95, heading=h_win, glow=1.35,
                                   warmth=1.0, look_y=0.3, arms=22))

    def pull(t, p):
        p["glow"] = p.get("glow", 1) * (1 + 0.35 * flash(t))
    st.layer(pull)
    anchor(st, ST.DEFAULT)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    lan["root"].rotation_euler.z = math.atan2(eye.y - lp.y, eye.x - lp.x) - math.radians(30)
    c = W.claude()
    seat = W.I["table"]["seat"]
    cpos = O + Vector((seat.x, seat.y, 0)) - t_ * 0.2          # stool drawn a little to the side
    W.I["table"]["stool"].location = cpos - O
    hd = S.heading_to((cpos.x, cpos.y), (lp.x, lp.y))
    tr = Track()
    # dozing at the table, head down on its arms
    tr.pose(0.0, S.merge(S.C_SIT(seat.z), x=cpos.x, y=cpos.y, z=O.z, heading=hd, slump=16, eye_open=0.0, armL_fwd=62,
                         armR_fwd=62, armL_up=12, armR_up=12, lean=18, head_nod=6))
    tr.key(2.0, "linear", eye_open=0.0, lean=18, slump=16)
    # a flash — it jolts upright, eyes wide
    tr.key(2.35, "snap", eye_open=1.0, pupil=1.25, slump=0, lean=-8, squash=0.12, head_nod=-4, armL_up=40, armR_up=40,
           armL_fwd=45, armR_fwd=45, look_y=0.25)
    tr.key(3.0, "inout", look_y=0.45, look_x=0.45, pupil=0.78, eye_tilt=0.75, squash=0.02, lean=-10, armL_up=48, armR_up=40,
           armL_fwd=55, armR_fwd=50, head_tilt=-4)
    tr.key(dur, "linear", pupil=0.74, eye_tilt=0.8, lean=-12)
    tr.layer(anim.breathe(0.012, 0.18))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    tgt = end * 0.5 + (cpos + Vector((0, 0, 0.9))) * 0.5
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 30, push=0.05, fstop=3.2, seed=52, check=False,
                      focus_on=sp.lerp(end, 0.4))
    face_light(c, eye, None, energy=28.0, col=(0.82, 0.86, 1.0), frame=f0 + int(3.0 * 24))
    return dict(face_key=0.0, post=dict(haze_amt=0.0, bloom=0.65, bloom_thr=0.55, kuw_near=3, kuw_far=4, vignette=0.45))
