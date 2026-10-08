"""M05 — EXT night, on the gallery: Claude stitches a torn sail canvas, reaching up, needle flashing; the star
hovers close, its glow the only light on the work. Claude pauses, turns, and gives it a fond look (eyes soften).

Staged as a cosy medium shot: Claude sits on the gallery boards with its back to the tower, the torn sail canvas
gathered over its lap; each stitch pulls the needle up high in a big arc. The star hovers just in front, low over the
work, lighting Claude's face and the boards behind. Claude pauses, turns to it (toward the lens) and its eyes soften."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, fx, windmill, props, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_PAUSE = 2.6


def lap_canvas(name, cpos, hd, m, width=0.95):
    """Sail canvas gathered on a sitting Claude's lap: the near edge lifted to its hands, sagging over its legs and
    spreading out on the boards. Returns (object, local->world function)."""
    h = math.radians(hd)
    R = Matrix.Rotation(h, 3, "Z")

    def W_(p):
        return cpos + R @ Vector(p)
    nu, nv = 20, 16
    verts, faces = [], []

    def P(u, v):
        x = width * (u - 0.5)
        x *= 1.0 + 0.35 * v                       # spreads out on the floor
        # lifted edge (v=0) -> over the legs (v~0.35) -> flat on the boards (v=1)
        if v < 0.35:
            k = v / 0.35
            y = -0.25 - 0.17 * k
            z = 0.24 - 0.13 * math.sin(k * math.pi / 2) - 0.03 * math.sin(math.pi * u) * (1 - k)
        else:
            k = (v - 0.35) / 0.65
            y = -0.42 - 0.55 * k
            z = 0.12 * (1 - k) ** 2 + 0.012
        z += 0.012 * math.sin(u * 19 + v * 7) + 0.01 * math.sin(u * 31)
        return W_((x, y, z))
    for j in range(nv + 1):
        for i in range(nu + 1):
            verts.append(P(i / nu, j / nv))
    for j in range(nv):
        for i in range(nu):
            a = j * (nu + 1) + i
            faces.append((a, a + 1, a + nu + 2, a + nu + 1))
    ob = geo.obj_from(name, verts, faces, None, m)
    return ob, P


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=45.0))
    O = W.origin
    dur = (f1 - f0) / 24
    props.constellation(origin=(O.x, O.y, 0), lines=0.0)
    floor = O.z + windmill.GALLERY_Z + 0.17
    a = math.radians(28)
    n = Vector((math.cos(a), math.sin(a), 0))             # outward
    t = Vector((-n.y, n.x, 0))                            # along the walkway (counter-clockwise)
    cpos = Vector((O.x, O.y, floor)) + n * 3.4
    a_cam = a + math.radians(19)
    eye = Vector((O.x, O.y, floor)) + Vector((math.cos(a_cam), math.sin(a_cam), 0)) * 4.6 + Vector((0, 0, 0.72))
    to_cam = eye - cpos
    to_cam.z = 0
    to_cam.normalize()
    face_v = (n * 0.62 + to_cam * 0.38).normalized()
    face = math.degrees(math.atan2(face_v.x, -face_v.y))
    fwd = Vector((math.sin(math.radians(face)), -math.cos(math.radians(face)), 0))
    left = Vector((math.cos(math.radians(face)), math.sin(math.radians(face)), 0))
    cam_side = 1.0 if left.dot(to_cam) > 0 else -1.0      # +1: Claude's left is toward the camera
    canvas, cP = lap_canvas("TornCanvas", cpos, face, W.wm["mats"]["canvas"])
    # the tear (a dark ragged slit) near the lifted edge, its finished half laced with stitches
    tear_m = mat.painterly("CanvasTear", (0.05, 0.035, 0.03), stroke="strokes_fine", scale=6, tex_amt=0.6)
    thread_m = mat.painterly("Thread", (0.95, 0.86, 0.66), stroke="strokes_fine", scale=8, tex_amt=0.3)
    tv, tf = [], []
    nseg = 14
    for i in range(nseg + 1):
        u = 0.25 + 0.5 * i / nseg
        c0 = cP(u, 0.12 + 0.03 * math.sin(i * 2.1))
        c1 = cP(u, 0.128 + 0.03 * math.sin(i * 2.1) + 0.004 * (1 + math.sin(i * 1.3)))
        tv += [c0 + Vector((0, 0, 0.006)), c1 + Vector((0, 0, 0.006))]
    for i in range(nseg):
        tf.append((2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1))
    geo.obj_from("CanvasTearSlit", tv, tf, None, tear_m, smooth=False)
    for k in range(5):
        u = 0.27 + 0.05 * k
        cc = (cP(u, 0.1) + cP(u, 0.19)) / 2 + Vector((0, 0, 0.01))
        geo.box(f"Stitch{k}", (0.006, 0.075, 0.006), loc=cc, rot=(0, 0, math.radians(face + 20)), mat=thread_m)
    # ---------------------------------------------------------------- Claude
    c = W.claude()
    needle_m = mat.painterly("Needle", (0.8, 0.8, 0.84), stroke="strokes_fine", scale=6, tex_amt=0.2, spec=1.0, rough=0.1,
                             emission=(1.0, 0.92, 0.75), emit_str=1.2)
    needle = geo.box("Needle", (0.007, 0.007, 0.1), mat=needle_m)
    sew = "L" if cam_side > 0 else "R"                    # the near hand sews: its arc rises beside the face
    hold = "R" if sew == "L" else "L"
    sit = S.C_SIT(0.0)
    work = {f"arm{sew}_up": 0, f"arm{sew}_fwd": 70, f"arm{sew}_bend": 10, f"arm{hold}_up": -8, f"arm{hold}_fwd": 75,
            f"arm{hold}_bend": 5}
    wp = dict(sit, **work, x=0.0, y=0.0, z=0.0, heading=0.0)
    c.apply(wp)
    bpy.context.view_layer.update()
    hand = c.rig.matrix_world @ c.rig.pose.bones[f"arm{sew}2"].tail
    S.attach(needle, c, f"arm{sew}2", Matrix.Translation(hand + Vector((0, -0.03, 0.04))) @
             Matrix.Rotation(math.radians(-30), 4, "X"), pose=dict(sit, **work))
    tr = Track()
    lk_work = S.look_params((cpos.x, cpos.y), face, floor + 0.4, cP(0.5, 0.15))
    base = S.merge(sit, work, dict(x=cpos.x, y=cpos.y, z=floor, heading=face, look_x=lk_work["look_x"],
                                   look_y=lk_work["look_y"], lean=8, head_nod=6, eye_open=0.8, eye_tilt=-0.1, eye_happy=0.0,
                                   head_turn=0.0, head_tilt=0.0, squash=0.0, slump=2))
    tr.pose(0.0, base)

    def stitch(tt, p):
        # push the needle down through the canvas... then pull the thread up high in a long arc (one stitch / 0.8 s)
        if tt < T_PAUSE:
            ph = (tt - 0.1) / 0.8 % 1.0
            w = min(1.0, (T_PAUSE - tt) / 0.25, tt / 0.15)
            up = math.sin(math.pi * min(ph / 0.55, 1.0)) if ph < 0.55 else 0.0
            p[f"arm{sew}_up"] = p.get(f"arm{sew}_up", 0) + 42 * w * up
            p[f"arm{sew}_fwd"] = p.get(f"arm{sew}_fwd", 0) - 35 * w * up
            p[f"arm{sew}_bend"] = p.get(f"arm{sew}_bend", 0) + 25 * w * up
            p["lean"] = p.get("lean", 0) - 5 * w * up
            p["head_nod"] = p.get("head_nod", 0) - 6 * w * up         # eyes follow the needle up
            p["look_y"] = p.get("look_y", 0) + 0.5 * w * up
    tr.layer(stitch)
    # the star's place: low in front, on the camera side, right over the work
    s_pos = cpos + fwd * 0.32 + left * cam_side * 0.7 + Vector((0, 0, 0.5))
    lk_star = S.look_params((cpos.x, cpos.y), face + cam_side * 18, floor + 0.4, s_pos)
    tr.key(T_PAUSE, "linear", look_x=lk_work["look_x"], look_y=lk_work["look_y"], lean=8, head_nod=6, slump=2)
    # pause... lowers the work, turns to the star; the eyes soften into a fond smile
    tr.key(3.05, "inout", **{f"arm{sew}_up": -10, f"arm{sew}_fwd": 50, f"arm{hold}_fwd": 55, "look_x": lk_star["look_x"],
                             "look_y": lk_star["look_y"], "head_turn": cam_side * 18, "lean": -2, "head_nod": -3,
                             "eye_tilt": 0.0, "eye_open": 0.9})
    tr.key(3.5, "inout", eye_happy=0.62, eye_open=0.8, head_tilt=cam_side * 9, slump=4)
    tr.key(dur, "soft", eye_happy=0.72, head_tilt=cam_side * 11, eye_open=0.76)
    tr.layer(anim.blinks(times=[1.3, 3.28], dur=0.15))
    tr.layer(anim.breathe(0.012, 0.3))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # ---------------------------------------------------------------- the star
    s = W.star()
    s.light_scale = 6.0
    hs = S.heading_to((s_pos.x, s_pos.y), (cpos.x * 0.5 + eye.x * 0.5, cpos.y * 0.5 + eye.y * 0.5))
    st = Track()
    lk_s = S.look_params((s_pos.x, s_pos.y), hs, s_pos.z, cP(0.5, 0.15))
    st.pose(0.0, S.merge(S.S_CURIOUS, x=s_pos.x, y=s_pos.y, z=s_pos.z, heading=hs, glow=1.5, look_x=lk_s["look_x"],
                         look_y=lk_s["look_y"], pitch=10, eye_happy=0.0, roll=0))
    st.key(T_PAUSE + 0.35, "inout", look_x=-cam_side * 0.6, look_y=-0.1, pitch=4)
    st.key(3.6, "inout", **S.merge(S.S_HAPPY, glow=1.7, eye_happy=0.8, look_x=-cam_side * 0.6, look_y=-0.1, roll=0))
    st.key(dur, "soft", eye_happy=0.85, roll=-cam_side * 8)

    def hover(tt, p):
        p["z"] = p.get("z", 0) + 0.025 * math.sin(tt * 2.2)
    st.layer(hover)
    st.layer(anim.blinks(times=[0.9, 2.2], dur=0.14))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # ---------------------------------------------------------------- camera
    tgt = cpos * 0.55 + s_pos * 0.45 + Vector((0, 0, 0.12))
    tgt.z = floor + 0.4
    cam = FR.shot_cam("Cam", f0, f1, eye, tgt, 28, push=0.07, lens_end=30, fstop=2.8, seed=25, check=False,
                      focus_on=cpos + Vector((0, 0, 0.4)))
    scene.char_lights(c.col, cpos + Vector((0, 0, 0.35)), eye, (0.3, 0.8, 0.4), rim_col=(0.55, 0.7, 1.0), rim_w=18.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=60.0, mist_depth=2000.0, bloom=0.7, bloom_thr=0.6))
