"""D01 — INT night (minor key): the lantern on the table glows — but weaker now; its warm pool no longer reaches the
corners, and the room sinks into darkness around it. Claude, at the table, notices: looks at the lantern, then around at
the dark edges of the room, then back — worry settling in (inner brows up, a slow head tilt)."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu import claude as CL, star as ST


def anchor(tr, defaults):
    """Track params take their FIRST key's value before that key; give every param keyed only later in the shot its
    default value at t=0, so a head turn keyed at 2 s doesn't start the shot already turned."""
    missing = {k: defaults[k] for k, ks in tr._chan().items() if ks[0][0] > 1e-6 and k in defaults}
    if missing:
        tr.key(0.0, "linear", **missing)
    return tr


def face_light(ch, cam_loc, lamp_loc=None, energy=40.0, col=(1.0, 0.74, 0.5), dist=2.2, size=1.4, frame=None):
    """Like finish.face_key, but aimed for a given camera position (multi-camera shots: finish aims at whichever camera
    is live at mid-shot). Soft warm area light between camera and practical, light-linked to the character only."""
    from lu.scene import look_at
    if frame is not None:
        bpy.context.scene.frame_set(frame)
    is_star = hasattr(ch, "body")
    head = ch.rig.matrix_world.translation + Vector((0, 0, 0.1 if is_star else 0.55))
    to_cam = Vector(cam_loc) - head
    to_cam.z = 0
    to_cam.normalize()
    dirv = to_cam
    if lamp_loc is not None:
        to_l = Vector(lamp_loc) - head
        to_l.z = 0
        if to_l.length > 1e-3:
            dirv = (to_cam * 0.6 + to_l.normalized() * 0.4).normalized()
    ld = bpy.data.lights.new(f"FaceLight_{ch.rig.name}", "AREA")
    ld.energy = energy
    ld.color = col
    ld.size = size
    ld.use_shadow = False
    ob = bpy.data.objects.new(ld.name, ld)
    bpy.context.scene.collection.objects.link(ob)
    look_at(ob, head + dirv * dist + Vector((0, 0, 0.9)), head)
    ob.light_linking.receiver_collection = ch.col
    return ob


def close_door(W):
    """Interior shots build no mill exterior, so the door opening (-90 deg) shows the open night: hang a closed
    plank door in it."""
    from lu import geo
    from lu.interior import RI
    O = W.origin
    M = W.I["mats"]
    parts = []
    for i in range(5):
        parts.append(geo.box(f"IDoorPlank{i}", (0.2, 0.06, 2.1), loc=(-0.4 + i * 0.2, 0, 1.05), mat=M["wood"], bevel=0.008))
    for z in (0.5, 1.6):
        parts.append(geo.box("IDoorBrace", (0.96, 0.04, 0.1), loc=(0, -0.05, z), mat=M["beam"], bevel=0.008))
    d = geo.join(parts, "IntDoor")
    d.location = O + Vector((0, -(RI + 0.2), 0))
    return d


def lantern_on_table(W, scale_star=0.55):
    O = W.origin
    tbl = W.I["table"]["top"]
    for nm in ("cup", "pot"):
        W.I["table"][nm].hide_render = True
    lan = interior.lantern(bpy.context.scene.collection, W.I["mats"])
    lp = O + tbl + Vector((-0.1, -0.06, 0.0))
    lan["root"].location = lp
    return lan, lp, lp + Vector((0, 0, 0.17))


def make(f0, f1):
    W = world.World("int", "night")
    O = W.origin
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    W.practicals(stove=0.35)
    W.I["table"]["flame"].hide_render = True
    close_door(W)
    lan, lp, sp = lantern_on_table(W)
    lp = O + W.I["table"]["top"] + Vector((0.05, 0.2, 0.0))       # toward camera, so it sits clear of Claude in frame
    lan["root"].location = lp
    sp = lp + Vector((0, 0, 0.17))
    seat = W.I["table"]["seat"]
    cpos = O + Vector((seat.x, seat.y, 0))
    # camera across the table, beside the workbench end: the weak lantern soft in the foreground at frame left,
    # Claude's face at frame right, the dark room behind
    eye = O + Vector((1.18, 2.42, 1.0))
    s = W.star()
    s.light_scale = 4.0
    hs = S.heading_to((lp.x, lp.y), (eye.x, eye.y)) - 20
    st = Track()
    st.pose(0.0, S.merge(S.S_SLEEP, x=sp.x, y=sp.y, z=sp.z, heading=hs, scale=0.56, glow=0.7, warmth=0.75, eye_open=0.0,
                         droop=22))

    def flick(t, p):
        # a tired, uneven glow: it sags (the moment Claude notices) and only half catches again
        sag = 0.5 * math.exp(-((t - 0.7) / 0.22) ** 2) + 0.3 * math.exp(-((t - 3.3) / 0.35) ** 2)
        tired = 1.0 if t < 0.5 else 0.82
        p["glow"] = p.get("glow", 0.7) * tired * (1 + 0.07 * math.sin(t * 9.0) - sag)
    st.layer(flick)
    anchor(st, ST.DEFAULT)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    lan["root"].rotation_euler.z = math.atan2(eye.y - lp.y, eye.x - lp.x) - math.radians(30)
    c = W.claude()
    hd = S.heading_to((cpos.x, cpos.y), (lp.x, lp.y)) + 8
    tr = Track()
    tr.pose(0.0, S.merge(S.C_SIT(seat.z), x=cpos.x, y=cpos.y, z=O.z, heading=hd, look_y=-0.15, look_x=-0.1, eye_open=0.8,
                         armL_up=-20, armR_up=-20, armL_fwd=38, armR_fwd=38, eye_tilt=0.1))
    # the lantern flickers low — Claude notices
    tr.key(0.9, "inout", look_y=-0.05, eye_open=0.95, pupil=1.05, eye_tilt=0.25)
    # looks around at the dark edges of the room... one side...
    tr.key(1.75, "inout", head_turn=34, look_x=0.9, look_y=0.25, pupil=0.95, eye_tilt=0.35, lean=-3)
    tr.key(2.05, "linear", head_turn=36, look_x=0.95)
    # ...the other
    tr.key(2.8, "inout", head_turn=-30, look_x=-0.9, look_y=0.3, eye_tilt=0.4)
    tr.key(3.05, "linear", head_turn=-31, look_x=-0.95)
    # ...and back to the lantern: worry settles in
    tr.key(3.75, "inout", head_turn=0, look_x=-0.1, look_y=-0.1, eye_tilt=0.65, eye_open=0.82, head_tilt=10, slump=5,
           lean=4, pupil=1.0)
    tr.key(dur, "soft", eye_tilt=0.75, head_tilt=14, slump=8, eye_open=0.76, armL_fwd=50, armR_fwd=50, armL_up=-8,
           armR_up=-8)
    tr.layer(anim.blinks(times=[0.45, 4.25], dur=0.2))
    tr.layer(anim.breathe(0.01, 0.25))
    anchor(tr, CL.DEFAULT)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # rack focus: from the lantern to Claude's face as it notices
    face = cpos + Vector((0, 0, 0.88))
    tgt = face * 0.5 + sp * 0.5 + Vector((0, 0, 0.07))
    d_lan, d_face = (sp - eye).length, (face - eye).length
    cam = scene.camera("Cam", lens=33)
    ct = Track(CAM_DEFAULT)
    e1 = eye + (tgt - eye).normalized() * 0.12
    ct.key(0, cx=eye.x, cy=eye.y, cz=eye.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=33, fstop=2.4, focus=d_lan)
    ct.key(0.45, "linear", focus=d_lan)
    ct.key(1.15, "inout", focus=d_face)
    ct.key(dur, "soft", cx=e1.x, cy=e1.y, cz=e1.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=35, fstop=2.4, focus=d_face - 0.12)
    ct.layer(lambda t, p: p.update(shake=0.15))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=41)
    return dict(face_key=32.0, post=dict(haze_amt=0.0, bloom=0.55, bloom_thr=0.6, kuw_near=3, kuw_far=4, vignette=0.6,
                                        gain=(0.96, 0.95, 0.98)))
