"""L02 — Work montage, night. (A) EXT, the gallery: Claude hauls the canvas off a sail — it slides free and drops in a
long billow; the sails above stand bare. (B) INT by lantern light: Claude sews panels into one great envelope, the quilt
square stitched in among them; the dim star watches from its lantern. Hours pass (the candle burns down)."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, finale, windmill, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT
from shots.d04 import oil_lamp
from shots.d01 import anchor
from lu import claude as CL, star as ST

T_CUT = 3.0
T_FREE = 1.15      # the canvas comes free and starts to fall
T_A2 = 1.3         # cut: the canvas billows down past the gallery


def drape(name, origin, heading, mats, quilt_mat):
    """The envelope in progress: a sheet of sewn canvas panels spread over the floor and Claude's lap, the bulk of it
    heaped at Claude's side. Built in Claude-local coords (Claude at the origin facing -Y)."""
    nx, ny = 46, 40
    x0, x1, y0, y1 = -1.05, 1.25, -1.15, 0.75
    verts, faces = [], []
    rng = np.random.default_rng(3)
    ph = rng.uniform(0, 6.28, 6)

    def h(x, y):
        z = 0.015 + 0.022 * (math.sin(x * 7.0 + ph[0] + 2.0 * math.sin(y * 3.1 + ph[1])) + 1)
        z += 0.012 * math.sin(y * 13.0 + x * 4.0 + ph[2])
        # over the lap and up to the hands
        z += 0.1 * math.exp(-((x / 0.42) ** 2 + ((y + 0.3) / 0.2) ** 2))
        z += 0.05 * math.exp(-((x / 0.3) ** 2 + ((y + 0.45) / 0.1) ** 2))
        # the bulk of the envelope piled at Claude's left
        z += 0.4 * math.exp(-(((x - 0.85) / 0.36) ** 2 + ((y - 0.2) / 0.42) ** 2))
        z += 0.1 * math.exp(-(((x - 0.6) / 0.3) ** 2 + ((y + 0.45) / 0.3) ** 2))
        # soft folds radiating from the heap
        z += 0.03 * max(0.0, math.sin((x - 0.85) * 9.0 + (y - 0.2) * 4.0)) * math.exp(-((x - 0.6) ** 2 + y ** 2) / 0.6)
        # tucked under Claude
        if abs(x) < 0.36 and -0.22 < y < 0.22:
            z = min(z, 0.03)
        return z
    for j in range(ny + 1):
        for i in range(nx + 1):
            x = x0 + (x1 - x0) * i / nx
            y = y0 + (y1 - y0) * j / ny
            verts.append((x, y, h(x, y)))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    o = geo.obj_from(name, verts, faces, None, None)
    for m in mats + [quilt_mat]:
        o.data.materials.append(m)
    bs = 0.3
    for p in o.data.polygons:
        c = p.center
        bi, bj = int(math.floor((c.x + 0.05) / bs)), int(math.floor((c.y + 0.02) / bs))
        hsh = (bi * 7919 + bj * 104729) % 97
        k = (bi + 2 * bj) % 3
        if hsh < 8:
            k = 3 + hsh % 2
        elif hsh < 50:
            k = 1
        if bi == -1 and bj == -2:          # the quilt square, right in front of Claude's hands
            k = 6
        p.material_index = k
    o.matrix_world = Matrix.Translation(origin) @ Matrix.Rotation(math.radians(heading), 4, "Z")
    return o, h


def key_rope(o, p0, p1, f):
    d = p1 - p0
    o.matrix_world = Matrix.Translation(p0) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4() @ Matrix.Diagonal((1, 1, d.length, 1))
    for k in ("location", "rotation_euler", "scale"):
        o.keyframe_insert(k, frame=f)


def interior_switch(frame):
    """From `frame` on, light the shot like an interior (EEVEE doesn't occlude sky light indoors): dim the world's
    lighting branch and switch the painterly grade to the interior night look (see sky.interior_mode)."""
    from lu import sky
    g = mat.look_group()
    w = bpy.context.scene.world
    socks = [n.inputs["Strength"] for n in w.node_tree.nodes
             if n.type == "BACKGROUND" and abs(n.inputs["Strength"].default_value - 1.0) > 1e-6]
    looks = [(g.nodes[k].outputs[0], v) for k, v in sky.INTERIOR_LOOK["night"].items()]
    for sk in socks:
        sk.keyframe_insert("default_value", frame=frame - 1)
        sk.default_value = 0.008
        sk.keyframe_insert("default_value", frame=frame)
    for sk, v in looks:
        sk.keyframe_insert("default_value", frame=frame - 1)
        sk.default_value = (*v[:3], 1) if isinstance(v, (tuple, list)) else v
        sk.keyframe_insert("default_value", frame=frame)
    for idb in (w.node_tree, g):
        ad = idb.animation_data
        if ad and ad.action:
            for fc in getattr(ad.action, "fcurves", []):
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT"


def make(f0, f1):
    # A and B share one scene: the exterior with the miller's room built inside the stone base
    W = world.World("ext", "night", windmill_state=dict(sails_angle=90.0, canvas=(0, 1, 0, 0)), with_interior=True)
    O = W.origin
    dur = (f1 - f0) / 24
    fc = f0 + int(T_CUT * 24)
    from lu import props
    props.constellation(origin=(O.x, O.y, 0), lines=0.0)
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    pr = W.practicals(candle=2.6, fill=0.6, stove=1.2)
    # --- A: the last canvas (Canvas1, on the sail arm hanging straight down) is hauled down, slides free and falls
    cv = bpy.data.objects["Canvas1"]
    m0 = cv.matrix_world.copy()
    lo = min(cv.data.vertices, key=lambda v: (m0 @ v.co).z * 10 + (m0 @ v.co).x)     # lower-left corner
    corner_local = lo.co.copy()

    def canvas_m(t):
        s = 0.35 * anim.ease("inout", t / T_FREE)                 # hauled down the sail a little
        u = anim.ease("in", (t - T_FREE) / 1.5)                    # then it slides free and drops
        off = Vector((1.7 * u + 0.15 * math.sin(u * 5.0) * u, -0.35 * u, -s - 8.5 * u * u))
        sq = max(0.3, 1 - 0.65 * u)
        tw = Matrix.Rotation(0.5 * u * math.sin(u * 3.0), 4, "Y")
        return Matrix.Translation(off) @ m0 @ tw @ Matrix.Diagonal((1 + 0.25 * u, 1 + 1.6 * u, sq, 1))
    for f in range(f0, fc + 2):
        cv.matrix_world = canvas_m((f - f0) / 24)
        for k in ("location", "rotation_euler", "scale"):
            cv.keyframe_insert(k, frame=f)
    S.vis_range(cv, f0, fc + 1, f0, f1)
    # once free it billows: subdivide and ripple the sheet
    sub = cv.modifiers.new("Sub", "SUBSURF")
    sub.levels = sub.render_levels = 2
    wv = cv.modifiers.new("Billow", "WAVE")
    wv.use_normal = True
    wv.width, wv.narrowness, wv.speed = 1.4, 1.2, 0.18
    wv.start_position_x, wv.start_position_y = 0.0, 0.0
    ff = f0 + int(T_FREE * 24)
    for f, hgt in ((f0, 0.0), (ff, 0.0), (ff + 10, 0.35), (fc, 0.5)):
        wv.height = hgt
        wv.keyframe_insert("height", frame=f)
    # Claude hauls the line over its shoulder, walking along the gallery boards toward camera
    gz = O.z + windmill.GALLERY_Z + 0.17
    ga = lambda a_deg, r=3.42: O + Vector((r * math.cos(math.radians(a_deg)), r * math.sin(math.radians(a_deg)), 0))
    p_start = ga(-115.0, 3.47)
    eA = ga(-139.0, 4.45)                                # A1 camera: on the boards ahead of Claude
    eA.z = gz + 0.42
    h_cam = S.heading_to((p_start.x, p_start.y), (eA.x, eA.y))
    hA = h_cam + 28.0                                    # face 3/4 to camera, turned toward the line's side
    step = Vector((math.sin(math.radians(h_cam)), -math.cos(math.radians(h_cam)), 0))
    c = W.claude()
    # --- B: sewing on the floor in the middle of the room, by candle and lantern light
    cposB = O + Vector((0.1, -0.45, 0))
    hB = 8.0
    tr = Track()
    haul = dict(heading=hA, lean=12, squash=-0.04, armL_up=72, armL_fwd=18, armL_bend=20, armR_up=48, armR_fwd=62,
                armR_bend=30, legs_splay=8, eye_open=0.5, eye_tilt=-0.65, look_y=0.1, look_x=-0.15)
    tr.pose(0.0, haul, x=p_start.x, y=p_start.y, z=gz)
    # heave... heave... a step forward each time
    for k, tk in enumerate((0.3, 0.62, 0.92)):
        pk = p_start + step * 0.04 * (k + 1)
        tr.key(tk, "inout", x=pk.x, y=pk.y, lean=18 + 2 * k, squash=-0.09, armL_up=60, armR_up=36, eye_open=0.32)
        tr.key(tk + 0.14, "out", lean=10 + 2 * k, squash=0.03, armL_up=74, armR_up=50, eye_open=0.5)
    # it gives — Claude pitches forward, arms flung out, eyes wide
    p_free = p_start + step * 0.15
    tr.key(T_FREE, "in", x=p_free.x, y=p_free.y, lean=20, squash=-0.06, eye_open=0.45)
    p_stum = p_start + step * 0.28
    tr.key(T_FREE + 0.25, "snap", x=p_stum.x, y=p_stum.y, lean=38, squash=-0.16, armL_up=40, armR_up=40, armL_fwd=60,
           armR_fwd=60, armL_bend=0, armR_bend=0, eye_open=1.0, pupil=1.2, eye_tilt=0.1, look_y=0.0, look_x=0.0)
    # ...catches itself and looks back over its shoulder: the canvas billows down past the gallery
    tr.key(T_FREE + 0.8, "inout", lean=4, squash=0.04, armL_up=-20, armR_up=-15, armL_fwd=30, armR_fwd=30, head_turn=38,
           look_x=0.95, look_y=-0.1, eye_open=0.95, pupil=1.1)
    tr.key(T_CUT, "soft", look_y=-0.55, head_turn=42, head_tilt=6, eye_open=0.85, eye_happy=0.25, eye_tilt=-0.3,
           pupil=1.0)
    tr.layer(anim.blinks(times=[2.3], dur=0.15))
    anchor(tr, CL.DEFAULT)

    def pose_at(t):
        if t < T_CUT:
            return tr.at(t)
        u = t - T_CUT
        p = S.merge(S.C_SIT(0.0), dict(x=cposB.x, y=cposB.y, z=O.z, heading=hB, lean=8, look_y=-0.85, look_x=0.1,
                                       eye_tilt=-0.4, eye_open=0.62, armL_fwd=66, armR_fwd=72, armL_up=-4, armR_up=2,
                                       armL_curl=25, head_nod=12))
        k = math.sin(u * 6.5)
        p["armR_up"] += 22 * max(0, k)
        p["armR_fwd"] += 8 * k
        p["armR_curl"] = 30 * max(0, k)
        p["head_nod"] += 3 * max(0, k)
        # late in the night: a heavy blink, a nod, a shake of the head — keep going
        if 2.2 < u < 2.55:
            p["eye_open"] = 0.12
            p["head_nod"] = 14
        if 2.55 < u < 2.9:
            p["head_turn"] = 7 * math.sin((u - 2.55) * 36)
        return p
    c.bake(lambda f: pose_at((f - f0) / 24), f0, f1 - 1)
    # the haul line: from Claude's left hand to the canvas's lower corner (whips away with the canvas once it's free)
    rope_m = bpy.data.materials.get("Rope") or mat.painterly("Rope", (0.42, 0.33, 0.22), stroke="strokes_fine", scale=6)
    rope = geo.lathe("HaulRope", [(0.014, 0.0), (0.014, 1.0)], seg=6, mat=rope_m, cap_top=False, cap_bot=False)
    sc = bpy.context.scene
    hand_last = None
    for f in range(f0, fc + 2):
        sc.frame_set(f)
        t = (f - f0) / 24
        hand = c.rig.matrix_world @ c.rig.pose.bones["armL2"].tail
        corner = canvas_m(t) @ corner_local
        if t <= T_FREE + 0.04:
            hand_last = hand.copy()
            p0 = hand
        else:
            u = min(1.0, (t - T_FREE) / 0.45)
            p0 = hand_last.lerp(corner + Vector((-0.3, 1.0, 0.8)), anim.ease("out", u))
        key_rope(rope, p0, corner, f)
    S.vis_range(rope, f0, fc + 1, f0, f1)
    # a lamp on the gallery boards: warm light on Claude's face against the blue night
    lamp = oil_lamp("GalleryLamp", W.I["mats"])
    lamp_p = ga(-123.0, 3.95)
    lamp_p.z = gz - 0.17
    lamp.location = lamp_p
    S.vis_range(lamp, f0, fc, f0, f1)
    gl = scene.point("GalleryLampL", lamp_p + Vector((0, 0, 0.14)), (1.0, 0.6, 0.28), 28.0, 0.12)
    for f, e in ((f0, 28.0), (fc - 1, 28.0), (fc, 0.0)):
        gl.data.energy = e
        gl.data.keyframe_insert("energy", frame=f)
    # needle and thread: the needle rides on Claude's right arm tip, the thread runs down into the work
    nmat = mat.emissive("NeedleGlint", (1.0, 0.85, 0.6), 0.35)
    needle = geo.lathe("Needle", [(0.0025, 0.0), (0.0025, 0.05), (0.0, 0.06)], seg=6, mat=nmat)
    thread = geo.lathe("Thread", [(0.0025, 0.0), (0.0025, 1.0)], seg=5, mat=rope_m, cap_top=False, cap_bot=False)
    for f in range(fc, f1):
        sc.frame_set(f)
        tip = c.rig.matrix_world @ c.rig.pose.bones["armR2"].tail
        rgt_w = c.rig.matrix_world.to_3x3() @ Vector((-1, 0, 0))
        np_ = tip - rgt_w * 0.0 + Vector((0, 0, 0.0))
        needle.matrix_world = Matrix.Translation(np_) @ Matrix.Rotation(math.radians(20), 4, "X")
        needle.keyframe_insert("location", frame=f)
        needle.keyframe_insert("rotation_euler", frame=f)
        anchor_pt = cposB + (c.rig.matrix_world.to_3x3() @ Vector((-0.12, -0.42, 0))) + Vector((0, 0, 0.13))
        key_rope(thread, np_, anchor_pt, f)
    for o in (needle, thread):
        S.vis_range(o, fc, f1 + 5, f0, f1)
    # the envelope in progress
    env, hfab = drape("SewnEnvelope", cposB, hB, finale.canvas_mats(), W.I["mats"]["quilt"])
    hr = math.radians(hB)
    fwd = Vector((math.sin(hr), -math.cos(hr), 0))
    rgt = Vector((-math.cos(hr), -math.sin(hr), 0))       # Claude's right
    loc = lambda lx, ly: cposB - rgt * lx + fwd * -ly       # Claude-local (x = its left, y = behind) -> world
    eB = cposB + fwd * 2.3 + rgt * 0.5 + Vector((0, 0, 0.74))
    tB = cposB + rgt * 0.5 + fwd * 0.35 + Vector((0, 0, 0.3))
    # the star's lantern on the floor at Claude's right, watching; the candle at its left burns down as hours pass
    lan = interior.lantern(bpy.context.scene.collection, W.I["mats"])
    lan_p = loc(-1.0, -0.62)
    lan_p.z += hfab(-1.0, -0.62)
    lan["root"].location = lan_p
    # turn a glass pane (not a post) toward camera so the star's face reads
    lan["root"].rotation_euler.z = math.atan2(eB.y - lan_p.y, eB.x - lan_p.x) - math.radians(30)
    s = W.star()
    s.light_scale = 2.5
    sp = lan_p + Vector((0, 0, 0.17))
    hs = S.heading_to((sp.x, sp.y), (eB.x, eB.y)) + 22
    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, x=sp.x, y=sp.y, z=sp.z, scale=0.6, glow=0.6, warmth=0.72, heading=hs, eye_open=0.72,
                         look_x=1.0, look_y=0.25, eye_tilt=0.5, head=-4, droop=24, legs=-6))
    st.key(T_CUT + 2.3, "inout", eye_open=0.45, look_y=-0.05)
    st.key(dur, "soft", eye_open=0.55, eye_happy=0.2)
    st.layer(anim.blinks(times=[T_CUT + 1.2], dur=0.25))
    anchor(st, ST.DEFAULT)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    cnd, flm = W.I["table"]["candle"], W.I["table"]["flame"]
    cnd_p = loc(-0.48, -0.5)
    cnd_p.z += hfab(-0.48, -0.5) - 0.01
    for o in (cnd, flm):
        o.parent = None
    ld = pr.get("candle")
    for f in range(fc - 1, f1):
        u = max(0.0, (f - fc) / max(1, f1 - fc))
        hgt = 0.12 * (1 - 0.7 * u)
        cnd.location = cnd_p
        cnd.scale = (1, 1, 1 - 0.7 * u)
        flm.location = cnd_p + Vector((0, 0, hgt + 0.005))
        flm.scale = (1 + 0.15 * math.sin(f * 1.3), 1 + 0.15 * math.sin(f * 1.3), 1 + 0.25 * math.sin(f * 2.1))
        for o in (cnd, flm):
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
        if ld:
            ld.location = cnd_p + Vector((0, 0, hgt + 0.03))
            ld.data.energy = 2.6 * W.INT_GAIN * (1 - 0.3 * u) * (1 + 0.06 * math.sin(f * 1.7))
            ld.keyframe_insert("location", frame=f)
            ld.data.keyframe_insert("energy", frame=f)
    warm = scene.point("CandleFill", cnd_p + fwd * 0.6 - rgt * 0.4 + Vector((0, 0, 0.5)), (1.0, 0.62, 0.32), 0.0, 0.4)
    for f, e in ((fc - 1, 0.0), (fc, 9.0)):
        warm.data.energy = e
        warm.data.keyframe_insert("energy", frame=f)
    interior_switch(fc)
    # --- cameras
    # A1: on the gallery boards ahead of Claude, face on, straining at the line
    fa2 = f0 + int(T_A2 * 24)
    tA = p_start + step * 0.1 + Vector((0, 0, 0))
    tA.z = gz + 0.5
    camA = FR.shot_cam("CamA", f0, fa2, eA, tA, 27, push=0.04, fstop=2.4, shake=0.25, seed=63, check=False,
                       focus_on=Vector((p_start.x, p_start.y, gz + 0.45)) + step * 0.2)
    # A2: low and wide from in front of the mill: the canvas slides off the bare lattice and billows down past the
    # gallery where Claude stands
    eA2 = O + Vector((-7.0, -15.5, 1.6))
    tA2 = O + Vector((-0.6, -3.0, 6.4))
    camA2 = FR.shot_cam("CamA2", fa2, fc, eA2, tA2, 24, push=0.03, fstop=0, shake=0.15, seed=65, check=False)
    # B: low across the work, the stove glowing behind
    camB = FR.shot_cam("CamB", fc, f1, eB, tB, 32, push=0.07, fstop=2.8, seed=64, check=False,
                       focus_on=cposB + Vector((0, 0, 0.4)))
    S.cut(camA, f0)
    S.cut(camA2, fa2)
    S.cut(camB, fc)
    bpy.context.scene.camera = camB
    # moonlight rim + soft fill on Claude for the exterior half only
    cl = scene.char_lights(c.col, p_free + Vector((0, 0, 0.4)), eA, (0.3, 0.8, 0.4), rim_col=(0.55, 0.7, 1.0), rim_w=30.0,
                           fill_col=(0.75, 0.82, 1.0), fill_w=4.0)
    for o in cl.values():
        e = o.data.energy
        for f, v in ((f0, e), (fc - 1, e), (fc, 0.0)):
            o.data.energy = v
            o.data.keyframe_insert("energy", frame=f)
    bpy.context.scene.frame_set(f0)
    return dict(face_key=30.0, post=dict(haze=W.P["haze"], haze_amt=0.4, mist_start=60.0, mist_depth=2000.0, bloom=0.6,
                                        bloom_thr=0.6, kuw_near=3, kuw_far=5, vignette=0.4))
