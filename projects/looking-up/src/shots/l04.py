"""L04 — STORM. (A) The little balloon tossed inside black churning cloud: rain, lightning, the canvas straining and a
panel tearing. It's sinking. (B) In the basket, Claude heaves its tools over the side... then lifts the telescope. It
holds it — a long look (all those nights) — then lets it go. (C) The brass telescope tumbles away into the dark."""
import math
import bpy
from mathutils import Vector, Matrix, Euler
from lu import world, anim, scene, stage as S, interior, finale, fx, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT

T_B = 2.4
T_HOLD = 4.1
T_DROP = 6.2
T_C = 6.6
ALT = Vector((0.0, -40.0, 90.0))
T_B2 = T_HOLD - 0.05       # cut in closer as Claude lifts the telescope
G = Vector((0, 0, -9.0))


def bpos(t):
    return ALT + Vector((1.2 * math.sin(t * 1.3), 0.8 * math.sin(t * 0.9), -0.6 * t + 0.5 * math.sin(t * 2.1)))


def brot(t):
    return (0.13 * math.sin(t * 2.3), 0.16 * math.sin(t * 1.9 + 1), 0.1 * math.sin(t * 0.7))


def bmat(t):
    return Matrix.Translation(bpos(t)) @ Euler(brot(t)).to_matrix().to_4x4()


def ride_cam(name, f0, f1, keys, base=bpos, rot=brot, follow_rot=0.35, seed=0, shake=0.8, track=None):
    """Camera riding with the tossed balloon (position + a share of its rocking). keys: [(t, ease, eye_rel, tgt_rel,
    lens, fstop)]. track(t) -> world point overrides the target (e.g. a falling prop)."""
    cam = scene.camera(name, lens=keys[0][4])
    ct = Track(CAM_DEFAULT)
    for (t, e, eye, tgt, lens, fs) in keys:
        ct.key(t, e, cx=eye.x, cy=eye.y, cz=eye.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=lens, fstop=fs)

    def ride(t, p):
        R = Euler(tuple(follow_rot * v for v in rot(t))).to_matrix()
        b = base(t)
        e = b + R @ Vector((p["cx"], p["cy"], p["cz"]))
        g = b + R @ Vector((p["tx"], p["ty"], p["tz"]))
        if track is not None:
            g = track(t, g)
        p.update(cx=e.x, cy=e.y, cz=e.z, tx=g.x, ty=g.y, tz=g.z, shake=shake)
    ct.layer(ride)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=seed)
    return cam


def make(f0, f1):
    W = world.World("sky", "storm", overrides=dict(key_e=1.0))
    dur = (f1 - f0) / 24
    fps = 24
    B = finale.balloon(sag=0.15)
    lan = interior.lantern(bpy.context.scene.collection, interior.mats())
    lan["root"].parent = B["root"]
    lan["root"].location = (0, 0, -0.42)
    for f in range(f0, f1):
        t = (f - f0) / fps
        B["root"].location = bpos(t)
        B["root"].rotation_euler = brot(t)
        B["root"].keyframe_insert("location", frame=f)
        B["root"].keyframe_insert("rotation_euler", frame=f)
    fz = B["basket_floor"].z + 0.02
    eye_z = fz + 0.574
    rim_z = B["rim_z"]
    # ------------------------------------------------------------------ cameras' positions first (clouds keep clear)
    eA = bpos(0.0) + Vector((10.5, -12.5, -2.6))
    # ------------------------------------------------------------------ the storm
    view = (bpos(1.0) - eA).normalized()
    sideA = view.cross(Vector((0, 0, 1))).normalized()
    tele_end = bpos(6.2) + Vector((2.0, -1.5, -25.0))
    path = (bpos(0.0) + Vector((0, 0, 4.5)), bpos(8.4) + Vector((0, 0, -2.0)), 7.0)
    finale.storm_clouds(ALT + Vector((0, 0, -4)), radius=95, n=38, seed=4, level_lo=-38, level_hi=30, near=0.22,
                        avoid=[path, (eA, bpos(1.2), 3.5), (eA, 5.0), (bpos(6.2), tele_end, 4.0)], f0=f0, f1=f1,
                        drift=(0.0, 0.0, 0.5))
    finale.storm_clouds(tele_end + Vector((0, 0, -14)), radius=40, n=14, seed=12, level_lo=-14, level_hi=10, near=0.15,
                        avoid=[(bpos(6.2), tele_end + Vector((0, 0, -6)), 5.0), path], f0=f0, f1=f1, drift=(0, 0, 0.5))
    # heaps framing the wide: a dark mass low on the left, one high on the right, a tower behind the balloon
    for k, off in enumerate((-sideA * 13 + view * 22 + Vector((0, 0, -9)), sideA * 15 + view * 26 + Vector((0, 0, 8)),
                             view * 52 - sideA * 4 + Vector((0, 0, -4)))):
        finale.storm_clouds(eA + off, radius=1.0, n=1, seed=30 + k, level_lo=0, level_hi=0, near=0.0,
                            size=0.75 if k < 2 else 1.3, f0=f0, f1=f1, drift=(0.0, 0.0, 0.5))
    finale.rain(eA + view * 6, size=(14, 14, 14), n=2200, f0=f0, f1=f1, seed=2, speed=24, length=0.7, strength=0.65,
                width=0.005)
    finale.rain(bpos(3.0), size=(12, 12, 14), n=2600, f0=f0, f1=f1, seed=7, speed=24, length=0.6, strength=0.5,
                width=0.0035)
    finale.rain(ALT, size=(60, 60, 50), n=4000, f0=f0, f1=f1, seed=9, speed=24, length=1.2, width=0.02, strength=0.5)
    # lightning: each strike just ahead of a thunder clap
    behind = bpos(1.0) + view * 42
    finale.lightning("Bolt0", behind - sideA * 9 + Vector((0, 0, 34)), behind - sideA * 4 + Vector((0, 0, -14)), 0.2,
                     f0, branches=4, seed=1, flash_energy=90000)
    finale.lightning("Bolt1", behind + sideA * 30 + Vector((0, 20, 30)), behind + sideA * 26 + Vector((0, 20, 0)), 1.45,
                     f0, branches=2, seed=2, flash_energy=45000)
    b2 = bpos(2.8)
    finale.lightning("Bolt2", b2 + Vector((14, 34, 26)), b2 + Vector((9, 30, -18)), 2.75, f0, branches=3, seed=3,
                     flash_energy=80000)
    b4 = bpos(4.9)
    finale.lightning("Bolt3", b4 + Vector((-22, 30, 28)), b4 + Vector((-15, 26, -16)), 4.85, f0, branches=3, seed=4,
                     flash_energy=70000)
    b7 = bpos(7.0)
    finale.lightning("Bolt4", b7 + Vector((26, -14, -16)), b7 + Vector((20, -10, -52)), 7.05, f0, branches=4, seed=5,
                     flash_energy=50000)
    # ------------------------------------------------------------------ a patch tearing loose (strains, flaps, rips away)
    pm = bpy.data.materials.get("CanvasC")
    ga = math.radians(-52)                                  # the gore facing the wide camera
    pw, ph, pz0 = 0.85, 1.0, 1.3
    hole_m = bpy.data.materials.get("TearHole") or mat.emissive("TearHole", (0.025, 0.02, 0.02), 1.0)
    hole = geo.obj_from("TearHole", [(0, -pw / 2 + 0.06, 0), (0, pw / 2 - 0.06, 0), (0, pw / 2 - 0.08, -ph + 0.1),
                                    (0, -pw / 2 + 0.08, -ph + 0.1)], [(0, 1, 2, 3)], None, hole_m, smooth=False)
    hole.visible_shadow = False
    rr = 1.43
    verts = [(0, -pw / 2, 0), (0, pw / 2, 0), (0, pw / 2, -ph), (0, -pw / 2, -ph)]
    panel = geo.obj_from("TornPatch", verts, [(0, 1, 2, 3)], None, pm, smooth=False)
    panel.visible_shadow = False
    hinge = bpy.data.objects.new("PatchHinge", None)
    bpy.context.scene.collection.objects.link(hinge)
    hinge.parent = B["root"]
    hinge.location = (rr * math.cos(ga), rr * math.sin(ga), pz0 + ph)
    hinge.rotation_euler = (0, 0, ga)
    panel.parent = hinge
    panel.location = (0.02, 0, 0)
    hole.parent = hinge
    hole.location = (0.012, 0, 0)
    T_RIP = 4.0
    for f in range(f0, f1):
        t = (f - f0) / fps
        if t < 1.5:
            ang, loc = 4 * math.sin(t * 9), Vector((0.02, 0, 0))
        elif t < T_RIP:
            u = t - 1.5
            ang = 38 + 26 * math.sin(u * 17.0) + 10 * math.sin(u * 29.0)
            loc = Vector((0.02, 0, 0))
        else:
            u = t - T_RIP
            ang = 70 + 400 * u
            loc = Vector((0.02 + 3.5 * u, 2.0 * u, 1.5 * u - 3.0 * u * u))
        panel.location = loc
        panel.rotation_euler = (math.radians(ang * 0.15), math.radians(-ang), 0)
        panel.keyframe_insert("location", frame=f)
        panel.keyframe_insert("rotation_euler", frame=f)
    # ------------------------------------------------------------------ the star (dim, in its lantern) and Claude
    s = W.star()
    s.light_scale = 34.0
    s.bake(lambda f: S.merge(S.S_DIM, **dict(zip(("x", "y", "z"), (bmat((f - f0) / fps) @ Vector((0, 0, -0.25)))[:])),
                             scale=0.55, glow=0.42, warmth=0.5), f0, f1 - 1)
    c = W.claude()
    HD = -12.0
    tr = Track()
    tr.pose(0.0, S.merge(S.C_FEAR, heading=HD, armL_up=60, armR_up=60, armL_fwd=35, armR_fwd=35, armL_bend=20,
                         armR_bend=20, look_x=0.0, look_y=0.2, eye_tilt=0.3, lean=-6, twist=0, head_turn=0, head_nod=0,
                         eye_happy=0.0, slump=0, head_tilt=0))
    # (B) tools over the side: grab low, heave, release (two throws to its left, +X)
    for (tg, tt) in ((2.5, 2.85), (3.15, 3.5)):
        tr.key(tg, "inout", lean=16, armL_up=-30, armL_fwd=60, twist=10, look_y=-0.7, look_x=0.3, pupil=0.85,
               eye_open=1.0, eye_tilt=0.45, squash=-0.06, head_turn=6)
        tr.key(tt - 0.1, "backin", lean=-4, armL_up=85, armL_fwd=30, twist=-6, look_y=0.3, look_x=0.7, head_turn=20,
               squash=0.08)
        tr.key(tt + 0.15, "out", armL_up=40, lean=2, twist=4, squash=0.0)
    # looks down at what is left: the telescope
    tr.key(3.95, "inout", **S.merge(dict(lean=10, armL_up=-15, armR_up=-15, armL_fwd=30, armR_fwd=30, look_y=-0.85,
                                         look_x=0.0, head_turn=0, twist=0, eye_tilt=0.6, eye_open=0.8, pupil=1.0,
                                         squash=-0.04, head_nod=8)))
    # lifts it, holds it: a long look
    # cradled against its left side, upright like a child; Claude turns to it: a long look (all those nights)
    hold = dict(armL_up=30, armR_up=24, armL_fwd=62, armR_fwd=88, armL_bend=14, armR_bend=10, twist=10)
    tr.key(T_HOLD + 0.55, "inout", **S.merge(hold, lean=2, look_y=0.12, look_x=0.6, eye_tilt=0.75, eye_open=0.8,
                                             head_nod=-2, head_turn=12, head_tilt=9, slump=6, squash=-0.03))
    tr.key(5.6, "inout", look_y=0.18, look_x=0.68, head_turn=15, head_tilt=12, eye_tilt=0.9, eye_open=0.66, slump=10)
    tr.key(5.95, "inout", look_y=-0.05, look_x=0.15, head_turn=4, head_tilt=2, eye_tilt=0.5, eye_open=0.85,
           slump=4)   # resolve
    # lets it go over the side
    tr.key(T_DROP, "inout", armL_up=10, armR_up=10, armL_fwd=85, armR_fwd=85, twist=0, lean=14, look_x=0.1,
           look_y=-0.6, head_turn=2, head_tilt=0)
    tr.key(T_DROP + 0.45, "inout", armL_up=-25, armR_up=-25, armL_fwd=40, armR_fwd=40, lean=18, look_y=-1.0,
           look_x=0.05, eye_open=0.6, eye_tilt=0.85, slump=16, head_nod=10)
    tr.key(dur, "soft", slump=20, eye_open=0.5)
    tr.layer(anim.blink_at(5.3, 0.5))
    tr.layer(anim.blinks(times=[1.1, 2.2, 3.75], dur=0.14))
    tr.layer(anim.tremble(0.0, 2.4, amp=1.2, freq=14.0))

    def cplace(t, p):
        M = bmat(t)
        q = M @ Vector((0, 0, fz))
        rx, ry, rz = brot(t)
        p.update(x=q.x, y=q.y, z=q.z, heading=p.get("heading", 0) + math.degrees(rz), tilt_x=math.degrees(rx),
                 tilt_y=math.degrees(ry))
    tr.layer(cplace)
    c.bake(lambda f: tr.at((f - f0) / fps), f0, f1 - 1)
    hdr = math.radians(HD)
    R_hd = Matrix.Rotation(hdr, 4, "Z")

    def local(v):            # Claude-facing local (x = its left, -y = its front) -> basket local
        return (R_hd @ Vector(v).to_4d()).to_3d()
    # ------------------------------------------------------------------ the tools it throws
    wood = interior.mats()["wood"]
    iron = bpy.data.materials.get("Iron") or mat.painterly("Iron", (0.12, 0.12, 0.13), spec=0.6, rough=0.3)
    tbox = geo.join([geo.box("TB", (0.34, 0.17, 0.15), loc=(0, 0, 0), mat=wood, bevel=0.01),
                     geo.box("TBh", (0.03, 0.03, 0.12), loc=(-0.12, 0, 0.1), mat=wood),
                     geo.box("TBh2", (0.03, 0.03, 0.12), loc=(0.12, 0, 0.1), mat=wood),
                     geo.box("TBh3", (0.27, 0.03, 0.03), loc=(0, 0, 0.16), mat=wood)], "Toolbox")
    hammer = geo.join([geo.box("Hh", (0.03, 0.03, 0.32), loc=(0, 0, 0), mat=wood),
                       geo.box("Hd", (0.13, 0.045, 0.05), loc=(0, 0, 0.17), mat=iron, bevel=0.005)], "Hammer")
    for obj, (tg, tt), floor_p, spin in ((tbox, (2.5, 2.85), (0.2, 0.2), (3.0, 5.0, 2.0)),
                                         (hammer, (3.15, 3.5), (-0.15, 0.25), (9.0, 2.0, 6.0))):
        hand = local((0.42, -0.08, fz + 0.62))
        rel_v = local((2.6, -0.4, 2.2))
        p_rel = None
        for f in range(f0, f1):
            t = (f - f0) / fps
            if t < tt:
                u = anim.ease("inout", (t - tg) / (tt - tg)) if t > tg else 0.0
                lp = Vector((floor_p[0], floor_p[1], fz + 0.08)).lerp(hand, u)
                M = bmat(t) @ Matrix.Translation(lp) @ Matrix.Rotation(u * 1.2, 4, "Y")
                obj.matrix_basis = M
                p_rel = (bmat(tt) @ Matrix.Translation(hand)).to_translation()
            else:
                u = t - tt
                Rb = Euler(brot(tt)).to_matrix()
                vw = Rb @ rel_v + (bpos(tt + 0.02) - bpos(tt)) / 0.02
                p = p_rel + vw * u + G * (0.5 * u * u)
                obj.matrix_basis = Matrix.Translation(p) @ Euler((spin[0] * u, spin[1] * u, spin[2] * u)).to_matrix().to_4x4()
            obj.keyframe_insert("location", frame=f)
            obj.keyframe_insert("rotation_euler", frame=f)
    # ------------------------------------------------------------------ the telescope (from the mill)
    T_ = interior.telescope(bpy.context.scene.collection, interior.mats())
    for o in [T_["root"]] + list(T_["root"].children_recursive):
        o.hide_render = True
    src = bpy.data.objects["TeleTube"]
    tube = src.copy()
    bpy.context.scene.collection.objects.link(tube)
    tube.parent = None
    tube.hide_render = False
    ep = bpy.data.objects["Eyepiece"].copy()
    bpy.context.scene.collection.objects.link(ep)
    ep.parent = tube
    ep.matrix_parent_inverse = Matrix.Identity(4)
    ep.location = (0, 0, 0)
    ep.rotation_euler = (0, 0, 0)
    ep.hide_render = False
    lie = Matrix.Rotation(math.pi / 2, 4, "Y")              # tube axis (Z) along the basket's X: lying across
    floor_m = Matrix.Translation(local((0.0, 0.18, fz + 0.09))) @ R_hd @ lie
    ax = Vector((0.38, -0.3, 0.88)).normalized()            # standing up against its left shoulder, big end up
    held = Matrix.Translation(local((0.33, -0.34, fz + 0.36))) @ R_hd @ \
        Vector((0, 0, 1)).rotation_difference(ax).to_matrix().to_4x4()
    over = Matrix.Translation(local((0.12, -0.66, fz + 0.4))) @ R_hd @ Matrix.Rotation(math.radians(18), 4, "Z") @ \
        Matrix.Rotation(math.radians(-10), 4, "Y") @ lie        # held out over the front rim, low

    def mlerp(A, Bm, u):
        la, lb = A.to_translation(), Bm.to_translation()
        qa, qb = A.to_quaternion(), Bm.to_quaternion()
        return Matrix.Translation(la.lerp(lb, u)) @ qa.slerp(qb, u).to_matrix().to_4x4()
    drop_world = (bmat(T_DROP) @ over)
    v_drop = (bpos(T_DROP + 0.02) - bpos(T_DROP)) / 0.02 + Euler(brot(T_DROP)).to_matrix() @ local((0.15, -0.5, 0.2))

    def tele_world(t):
        if t < T_HOLD:
            return bmat(t) @ floor_m
        if t < T_HOLD + 0.55:
            return bmat(t) @ mlerp(floor_m, held, anim.ease("inout", (t - T_HOLD) / 0.55))
        if t < 5.95:
            wob = Matrix.Translation(local((0, 0, 0.008 * math.sin(t * 3.0)))) @ \
                Matrix.Rotation(0.03 * math.sin(t * 1.7), 4, "Z")
            return bmat(t) @ wob @ held
        if t < T_DROP:
            return bmat(t) @ mlerp(held, over, anim.ease("inout", (t - 5.95) / (T_DROP - 5.95)))
        u = t - T_DROP
        p = drop_world.to_translation() + v_drop * u + G * (0.5 * u * u)
        return Matrix.Translation(p) @ drop_world.to_3x3().to_4x4() @ Euler((2.2 * u, 0.0, 3.1 * u)).to_matrix().to_4x4()
    for f in range(f0, f1):
        t = (f - f0) / fps
        tube.matrix_basis = tele_world(t)
        tube.keyframe_insert("location", frame=f)
        tube.keyframe_insert("rotation_euler", frame=f)
    # ------------------------------------------------------------------ cameras
    camA = scene.camera("CamA", lens=30)
    ca = Track(CAM_DEFAULT)
    ca.key(0, cx=eA.x, cy=eA.y, cz=eA.z, tx=0, ty=0, tz=0, lens=30)
    ca.key(T_B, "linear", cx=eA.x - 0.4, cy=eA.y + 0.5, cz=eA.z - 1.0, lens=31)

    def aimA(t, p):
        g = bpos(t) + Vector((0, 0, 0.9))
        p.update(tx=g.x, ty=g.y, tz=g.z, shake=2.2)
    ca.layer(aimA)
    anim.bake_camera(camA, ca, f0, f1 - 1, seed=66)
    face = local((0.0, -0.21, eye_z))
    camB = ride_cam("CamB", f0, f1, [
        (T_B, "linear", local((1.05, -2.15, eye_z + 0.18)), local((0.12, -0.1, eye_z - 0.02)), 34, 2.8),
        (T_B2, "soft", local((0.95, -2.0, eye_z + 0.16)), local((0.12, -0.1, eye_z - 0.02)), 35, 2.8)], seed=67, shake=0.9)
    camB2 = ride_cam("CamB2", f0, f1, [
        (T_B2, "linear", local((0.2, -2.05, eye_z + 0.1)), local((0.16, -0.25, eye_z + 0.04)), 32, 2.4),
        (T_DROP, "soft", local((0.18, -1.8, eye_z + 0.1)), local((0.16, -0.25, eye_z + 0.02)), 34, 2.4),
        (T_C, "soft", local((0.2, -1.85, eye_z + 0.18)), local((0.12, -0.4, eye_z - 0.12)), 33, 2.4)], seed=68, shake=0.7)

    def follow_tele(t, g):
        tp = tele_world(max(t, T_DROP)).to_translation()
        return g.lerp(tp, 0.8)
    camC = ride_cam("CamC", f0, f1, [
        (T_C, "linear", local((0.72, -0.62, rim_z + 0.55)), local((1.3, -0.9, rim_z - 2.5)), 26, 0),
        (dur, "linear", local((0.75, -0.6, rim_z + 0.6)), local((1.4, -1.0, rim_z - 4.0)), 26, 0)], seed=69, shake=1.0,
        track=follow_tele)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(round(T_B * fps)))
    S.cut(camB2, f0 + int(round(T_B2 * fps)))
    S.cut(camC, f0 + int(round(T_C * fps)))
    bpy.context.scene.camera = camA
    # Claude's face: a cold storm fill from the front and a rim from behind (light-linked); the lantern's warmth above
    b3 = bpos(4.5)
    scene.char_lights(c.col, b3 + Vector((0, 0, fz + 0.45)), b3 + local((0.5, -1.5, eye_z)), (0.2, 0.9, 0.6),
                      rim_col=(0.6, 0.7, 0.95), rim_w=30.0, fill_col=(0.66, 0.68, 0.86), fill_w=36.0)
    return dict(post=dict(haze=(0.11, 0.13, 0.18), haze_amt=0.6, mist_start=6.0, mist_depth=120.0, bloom=0.75,
                          bloom_thr=0.6, kuw_near=3, kuw_far=6, vignette=0.5))
