"""H03 — INT night: Claude gets between the star and the window and pulls the shutters closed — slowly, not meeting its
eyes. The meteor light is cut off. Then, too brightly, Claude spins a little top on the floor. The star looks at the
closed shutters... at Claude... and, quietly, sinks down to watch the top. It goes along with it."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, handprops as HP, framing as FR
from lu import claude as CL, star as ST
from lu.anim import Track, CAM_DEFAULT
from shots.d01 import anchor, face_light, close_door
from shots.h05 import ang_diff

T_CLOSE = (0.5, 1.6)
T_TOP = 2.3
T_CUT = 1.98        # cut on Claude's hop down from the table


def make(f0, f1):
    W = world.World("int", "night")
    O = W.origin
    dur = (f1 - f0) / 24
    fc = f0 + int(T_CUT * 24)
    for p in W.I["win_front"][1]:
        interior.set_ishutter(p, 0.0)
    shut = W.I["win_side"][1]
    W.practicals(stove=0.8, candle=1.4)
    close_door(W)
    for nm in ("cup", "pot", "flame", "candle"):
        W.I["table"][nm].hide_render = True
    a = math.radians(45)
    n = Vector((math.cos(a), math.sin(a), 0))
    t_ = Vector((-n.y, n.x, 0))
    win = lambda proj, u, z: O + n * proj + t_ * u + Vector((0, 0, z))
    fl = scene.point("MeteorFlicker", win(4.6, 0.7, 2.7), (0.8, 0.85, 1.0), 0.0, 0.3)
    # we look in through this window: make its glass clear (the painterly glass reads as frost up close)
    clear = bpy.data.materials.new("ClearGlass")
    clear.use_nodes = True
    ct = clear.node_tree
    ct.nodes.clear()
    tr_ = ct.nodes.new("ShaderNodeBsdfTransparent")
    out_ = ct.nodes.new("ShaderNodeOutputMaterial")
    ct.links.new(tr_.outputs[0], out_.inputs[0])
    clear.surface_render_method = "BLENDED"
    wf = W.I["win_side"][0]
    for i, sl in enumerate(wf.material_slots):
        if sl.material and sl.material.name.startswith("IntGlass"):
            wf.material_slots[i].material = clear
    for f in range(f0, f1):
        tt = (f - f0) / 24
        e = sum(110 * math.sin(math.pi * min(1, max(0, (tt - ts) / 0.3))) ** 2 for ts in (0.15, 0.7, 1.25))
        k = 1 - anim.ease("inout", (tt - T_CLOSE[0]) / (T_CLOSE[1] - T_CLOSE[0]))
        fl.data.energy = e * k + 0.01
        fl.data.keyframe_insert("energy", frame=f)
        for p in shut:
            interior.set_ishutter(p, k)
            p.keyframe_insert("rotation_euler", frame=f)
    # cameras: A outside, looking in through the open window — Claude pulls the shutters shut in our face, the star
    # glowing behind it in the room; B low in the room, facing the shut window: Claude, the top, the star coming down
    eA = win(3.95, -0.15, 1.45)
    eB = win(-0.75, -0.6, 0.38)
    # Claude up on the table at the window
    cpos = win(2.12, -0.12, 0)
    hd = math.degrees(math.atan2(n.x, -n.y))
    c = W.claude()
    floor_p = win(1.0, 0.02, 0)
    tp = floor_p - n * 0.55 + t_ * 0.16
    h_top = S.heading_to((floor_p.x, floor_p.y), (tp.x, tp.y))
    h_camB = S.heading_to((floor_p.x, floor_p.y), (eB.x, eB.y))
    hB = h_top + 0.35 * ang_diff(h_camB, h_top)
    tr = Track()
    tr.pose(0.0, dict(x=cpos.x, y=cpos.y, z=O.z + 0.77, heading=hd, armL_up=70, armR_up=70, armL_fwd=-15, armR_fwd=-15,
                      look_y=0.05, look_x=-0.35, eye_open=0.62, eye_tilt=0.55, head_nod=6))
    # pulls the shutters to — slowly, eyes down and away from the star behind it
    tr.key(T_CLOSE[1], "inout", armL_fwd=65, armR_fwd=65, armL_up=55, armR_up=55, lean=4, look_y=-0.35, look_x=-0.5,
           eye_open=0.5, head_nod=10, heading=hd)
    # turns from the window without looking at the star
    tr.key(T_CLOSE[1] + 0.28, "inout", **S.merge(S.C_GUILT, heading=hd + 120, x=cpos.x, y=cpos.y, z=O.z + 0.77))
    # hops down off the table
    tr.key(2.18, "out", x=floor_p.x, y=floor_p.y, z=O.z, heading=hB)
    # spinning the top: crouch, flick, forced brightness
    tr.key(T_TOP, "in", lean=24, armR_fwd=70, armR_up=-30, squash=-0.06, look_y=-0.6, look_x=0.0, head_turn=0, slump=0,
           eye_open=0.8, eye_tilt=0.3)
    tr.key(T_TOP + 0.25, "snap", armR_fwd=10, armR_up=10, armR_curl=-50, lean=10, squash=0.02)
    tr.key(T_TOP + 0.8, "inout", eye_happy=0.75, eye_open=0.85, eye_tilt=0.15, look_x=0.0, look_y=-0.3, armR_curl=0, lean=2,
           head_tilt=8, armL_up=30, armR_up=35, squash=0.08)
    tr.key(T_TOP + 1.6, "inout", eye_happy=0.7, eye_tilt=0.3, armL_up=18, armR_up=20, squash=0.05, head_tilt=6)
    tr.key(dur, "linear", eye_happy=0.6, eye_tilt=0.4)
    tr.layer(anim.hop_arc(1.92, 2.18, 0.16, 0.1))
    tr.layer(anim.blinks(times=[1.0, 3.6], dur=0.15))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    top = HP.top()
    top.scale = (1.6, 1.6, 1.6)
    for f in range(f0, f1):
        tt = (f - f0) / 24
        spin = tt > T_TOP + 0.25
        wob = max(0.0, 1 - (tt - T_TOP - 0.25) / 4) if spin else 0
        top.location = tp + Vector((0.04 * math.sin(tt * 3), 0.04 * math.cos(tt * 3), 0)) * spin
        top.rotation_euler = (0.06 * math.sin(tt * 5) * (1.4 - wob), 0.06 * math.cos(tt * 5) * (1.4 - wob),
                              tt * 40 if spin else 0)
        top.keyframe_insert("location", frame=f)
        top.keyframe_insert("rotation_euler", frame=f)
    S.vis_range(top, f0 + int((T_TOP - 0.05) * 24), f1 + 5, f0, f1)
    s = W.star()
    s.light_scale = 5.0
    sp0 = win(1.95, 0.56, 1.22)
    sp1 = tp + t_ * 0.42 - n * 0.12 + Vector((0, 0, 0.2))
    h_shut = S.heading_to((sp0.x, sp0.y), (sp0.x + n.x, sp0.y + n.y))
    h_a = S.heading_to((sp0.x, sp0.y), (eA.x, eA.y))
    h_b = S.heading_to((sp1.x, sp1.y), (eB.x, eB.y))
    h_watch = S.heading_to((sp1.x, sp1.y), (tp.x, tp.y))
    st = Track()
    # floating near the window, longing, its face lit by the meteor light
    st.pose(0.0, S.merge(S.S_LONGING, x=sp0.x, y=sp0.y, z=sp0.z, heading=h_shut + 0.45 * ang_diff(h_a, h_shut), glow=1.3,
                         look_y=0.5))
    st.key(T_CLOSE[0] + 0.3, "inout", look_x=-0.5, look_y=0.1, eye_open=1.0)        # watches Claude close them
    st.key(T_CLOSE[1], "inout", glow=0.95, look_y=0.0, eye_open=0.85, eye_tilt=0.25)
    # (B) looks at the shut window...
    st.key(T_CUT + 0.15, "inout", heading=h_b, look_x=0.0, look_y=0.55, eye_tilt=0.4, head=-12, glow=0.85)
    st.key(T_TOP + 0.3, "linear", look_y=0.55, head=-12)
    # ...at Claude, spinning its top too brightly...
    st.key(T_TOP + 0.75, "inout", look_x=0.6, look_y=-0.25, head=4, eye_open=0.75, eye_tilt=0.6)
    st.key(T_TOP + 1.05, "linear", look_x=0.6, z=sp0.z, x=sp0.x, y=sp0.y)
    # ...and quietly sinks down to watch the top. It goes along with it.
    st.key(T_TOP + 2.0, "inout", **S.merge(S.S_SAD, x=sp1.x, y=sp1.y, z=sp1.z, glow=0.72, eye_open=0.6, look_y=-0.6,
                                           look_x=0.15, heading=h_b + 0.4 * ang_diff(h_watch, h_b), eye_happy=0.15))
    st.key(dur, "soft", droop=44, eye_happy=0.2)
    st.layer(anim.blinks(times=[T_TOP + 0.55], dur=0.2))
    anchor(st, ST.DEFAULT)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    tA = Vector((cpos.x, cpos.y, O.z + 1.28)) * 0.7 + sp0 * 0.3
    camA = FR.shot_cam("CamA", f0, fc, eA, tA, 32, push=0.05, fstop=3.2, seed=53, check=False,
                       focus_on=Vector((cpos.x, cpos.y, O.z + 1.3)))
    tB = (floor_p + Vector((0, 0, 0.36))) * 0.6 + win(1.8, 0.25, 0.7) * 0.4
    camB = FR.shot_cam("CamB", fc, f1, eB, tB, 22, push=0.05, fstop=3.2, seed=56, check=False,
                       focus_on=floor_p + Vector((0, 0, 0.4)))
    S.cut(camA, f0)
    S.cut(camB, fc)
    bpy.context.scene.camera = camB
    face_light(c, eB, None, energy=30.0, frame=f0 + int((T_TOP + 0.8) * 24))
    face_light(s, eA, None, energy=6.0, col=(0.8, 0.85, 1.0), frame=f0 + int(1.0 * 24))
    face_light(c, eA, None, energy=18.0, col=(0.78, 0.84, 1.0), frame=f0 + int(0.8 * 24))
    return dict(face_key=0.0, post=dict(haze_amt=0.0, bloom=0.6, bloom_thr=0.6, kuw_near=3, kuw_far=4, vignette=0.5))
