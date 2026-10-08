"""S08 — INT night: CRASH. (a) The ceiling bursts — flash, splinters and dust as a burning streak plunges into
the flour sacks (wide: Claude asleep in its bed at the left of frame). (b) Claude jolts awake: eyes snap wide, it
bolts upright (the quilt slides into its lap), freezes, trembling, staring at the glow across the room."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, fx, geo, mat
from lu.anim import Track, CAM_DEFAULT
from shots.s06 import bed_pose, quilt_over, face_point, anchor, ROLL, RECLINE
from lu.claude import DEFAULT as CDEF

T_BURST = 0.12
T_LAND = 0.42
T_CUT = 0.9


def quilt_sit_key(W, q):
    """Shape key 'Sit' on the draped quilt: pushed down into the lap when Claude sits bolt upright."""
    bp = W.I["bed"]["pos"]
    q.shape_key_add(name="Basis")
    sk = q.shape_key_add(name="Sit")
    for i, v in enumerate(q.data.vertices):
        x, y, z = v.co
        lx, ly = x - bp[0], y - bp[1]
        hump = max(0.0, z - 0.62)
        body = min(1.0, hump / 0.4)
        u = min(max((ly + 0.92) / 0.77, 0.0), 1.0)          # 0 at the foot, 1 at the top edge
        ny = -0.92 + (ly + 0.92) * 0.52
        nz = z if z < 0.62 else 0.62 + body * (0.1 + 0.27 * u ** 1.6) + 0.025 * body * math.sin(lx * 19 + u * 7)
        sk.data[i].co = (x, bp[1] + ny, nz)
    return sk


def make(f0, f1):
    W = world.World("int", "night", interior_state=dict(crater=True))
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    pr = W.practicals(stove=1.6)
    pile = W.I["flour"]["pos"]
    land = L(pile.x + 0.55, pile.y - 0.55, 0.1)
    top = L(pile.x + 0.3, pile.y + 0.2, 3.25)
    # streak: a glowing falling body (the star, unseen yet) from the ceiling into the flour
    streak = geo.lathe("FallStreak", [(0.0, 0.0), (0.06, 0.3), (0.12, 0.95), (0.0, 1.0)], seg=10,
                       mat=__import__("lu.props", fromlist=["x"]).meteor_mat())
    streak["life"] = 0.0
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = (t - T_BURST) / (T_LAND - T_BURST)
        if 0 <= u <= 1:
            p = top.lerp(land, anim.ease("in", u))
            d = (land - top).normalized()
            streak.matrix_world = Matrix.Translation(p - d * 0.9) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4() @ Matrix.Diagonal((1.3, 1.3, 1.2, 1))
            streak["life"] = 1.0
        else:
            streak["life"] = 0.0
        streak.keyframe_insert("location", frame=f)
        streak.keyframe_insert("rotation_euler", frame=f)
        streak.keyframe_insert("scale", frame=f)
        streak.keyframe_insert('["life"]', frame=f)
    # the head of the streak carries its own light down the room
    sl = scene.point("StreakLight", top, (1.0, 0.75, 0.4), 0.0, 0.1)
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = (t - T_BURST) / (T_LAND - T_BURST)
        sl.location = top.lerp(land, anim.ease("in", min(max(u, 0.0), 1.0))) + Vector((0, 0, 0.12))
        sl.data.energy = 300.0 if 0 <= u <= 1 else 0.01
        sl.keyframe_insert("location", frame=f)
        sl.data.keyframe_insert("energy", frame=f)
    # a jagged hole torn in the ceiling boards, night sky beyond
    import bpy, numpy as np
    rng = np.random.default_rng(4)
    hv = [(0.0, 0.0, 0.0)]
    nseg = 22
    for i in range(nseg):
        a_ = 2 * math.pi * i / nseg
        r_ = rng.uniform(0.16, 0.36) * (1.0 + 0.35 * math.cos(a_))
        hv.append((r_ * math.cos(a_), r_ * 0.8 * math.sin(a_), 0.0))
    hf = [(0, i + 1, (i + 1) % nseg + 1) for i in range(nseg)]
    hole = geo.obj_from("CeilHole", hv, hf, None, mat.emissive("NightHole", (0.06, 0.09, 0.2), 1.2), smooth=False)
    hole.location = Vector((top.x, top.y, O.z + 3.293))
    hole.visible_shadow = False
    S.vis_range(hole, f0 + int(round(T_BURST * 24)), f1 + 10, f0, f1)
    flash = scene.point("CrashFlash", top + Vector((0, 0, -0.4)), (1.0, 0.8, 0.5), 0.0, 0.3)
    glow = scene.point("PileGlow", land + Vector((0, 0, 0.25)), (1.0, 0.7, 0.35), 0.0, 0.2)
    for f in range(f0, f1):
        t = (f - f0) / 24
        e1 = 520.0 * max(0.0, 1 - (t - T_BURST) / 0.2) ** 2 if t >= T_BURST else 0.01
        e2 = (700.0 * max(0.0, 1 - (t - T_LAND) / 0.3) ** 2 + 70.0 + 22 * math.sin(t * 23)) if t >= T_LAND else 0.01
        flash.data.energy = e1
        glow.data.energy = e2
        flash.data.keyframe_insert("energy", frame=f)
        glow.data.keyframe_insert("energy", frame=f)
    fx.splinters("Ceil", top, T_BURST, f0, n=34, speed=(1.2, 3.4), floor_z=O.z, seed=8, m=W.I["mats"]["wood"])
    fx.puff("CeilDust", top + Vector((0, 0, -0.2)), T_BURST, f0, n=12, spread=0.45, grow=(0.15, 0.6), life=(1.2, 2.5),
            rise=-0.3, color=(0.6, 0.55, 0.5), opacity=0.4, seed=9)
    fx.puff("FlourBurst", land + Vector((0, 0, 0.2)), T_LAND, f0, n=16, spread=0.4, grow=(0.1, 0.42), life=(0.8, 1.5),
            rise=0.3, color=(0.92, 0.88, 0.82), opacity=0.35, seed=10, emit=0.15)
    fx.sparks("LandSparks", land + Vector((0, 0, 0.15)), T_LAND, f0, n=44, speed=(1.0, 3.4), life=(0.3, 0.8), gravity=-5,
              up=0.8, strength=30, size=0.022, seed=11)
    # Claude: asleep through the burst (a startled twitch at the thud), then - on the cut - eyes snap open and it
    # bolts upright, freezes, trembling, eyes locked on the glow
    c = W.claude()
    q = quilt_over(W, top_y=-0.15, roll=ROLL, recline=RECLINE, thick=True)
    sk = quilt_sit_key(W, q)
    base = bed_pose(W, c, roll=ROLL, recline=RECLINE)
    T_SNAP = T_CUT + 0.1
    tr = Track()
    tr.pose(0.0, base, **S.merge(S.C_SLEEP, pupil=1.25, head_tilt=-4))
    tr.key(T_LAND + 0.08, "linear", squash=-0.03, head_tilt=-4)
    tr.key(T_LAND + 0.18, "out", squash=-0.09, head_tilt=-9)                 # twitch at the thud
    tr.key(T_LAND + 0.5, "inout", squash=-0.04, head_tilt=-5)
    tr.key(T_SNAP - 0.04, "linear", eye_open=0.0, pupil=1.25)
    tr.key(T_SNAP + 0.06, "snap", eye_open=1.0, pupil=1.25, eye_round=0.12)   # eyes SNAP wide
    tr.key(T_SNAP + 0.1, "linear", tilt_x=base["tilt_x"], tilt_y=ROLL, y=base["y"], z=base["z"], squash=0.0,
           armL_up=-30, armR_up=-30, head_tilt=-5, head_turn=0, lean=0, armL_fwd=0, armR_fwd=0, armL_bend=0,
           armR_bend=0, twist=0, eye_tilt=0.0, look_x=0.0, look_y=0.0)
    tr.key(T_SNAP + 0.42, "back", tilt_x=-18, tilt_y=-4.0, y=base["y"] + 0.12, z=base["z"] - 0.33, squash=0.16,
           armL_up=72, armR_up=72, armL_fwd=10, armR_fwd=10, pupil=0.95, lean=-4, head_tilt=0)  # bolts upright
    tr.key(T_SNAP + 0.7, "out", squash=-0.06, armL_up=44, armR_up=44, armL_fwd=48, armR_fwd=48, armL_bend=42,
           armR_bend=42, pupil=0.78, look_x=0.9, look_y=-0.3, head_turn=22, twist=8, lean=-5,
           tilt_y=-8.0, eye_tilt=0.3)                                              # freezes, staring
    tr.key(dur, "linear", pupil=0.74, look_x=0.95, look_y=-0.35, head_turn=25, squash=-0.08)
    anchor(tr, CDEF)
    tr.layer(anim.tremble(T_SNAP + 0.62, dur, amp=1.7, freq=16))
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    for f in range(f0, f1):
        t = (f - f0) / 24
        sk.value = anim.ease("inout", (t - T_SNAP - 0.08) / 0.4)
        sk.keyframe_insert("value", frame=f)
    face, fn = face_point(c, f0 + int(round((dur - 0.2) * 24)))
    # (a) wide from the window side: Claude's bed at the left, the stove, the ceiling bursting above the sacks
    camA = scene.camera("CamA", lens=18)
    a = L(1.55, -1.62, 1.8)
    ta = L(-1.0, 1.05, 1.55)
    ca = Track(CAM_DEFAULT)
    ca.key(0, cx=a.x, cy=a.y, cz=a.z, tx=ta.x, ty=ta.y, tz=ta.z, lens=18)
    ca.key(T_CUT, "linear", cx=a.x - 0.06, cy=a.y + 0.06, tx=ta.x, ty=ta.y, tz=ta.z - 0.05, lens=19)
    ca.layer(lambda t, p: p.update(shake=0.3 + 5.0 * max(0, 1 - abs(t - T_BURST - 0.05) / 0.25)
                                   + 7.0 * max(0, 1 - abs(t - T_LAND - 0.04) / 0.3)))
    anim.bake_camera(camA, ca, f0, f1 - 1, seed=8)
    # (b) from the foot of the bed: the face rises into a medium close-up; the glow is off to screen-right
    camB = scene.camera("CamB", lens=30)
    eb = L(-1.62, -1.58, 1.48)              # clear of the shelves (-135 deg wall) and the bed's foot board
    side = (face - eb).cross(Vector((0, 0, 1))).normalized()      # camera-right
    tb0 = face + side * 0.34 + Vector((0, 0.35, 0.02))
    tb1 = face + side * 0.34 + Vector((0, 0.0, -0.08))
    cb = Track(CAM_DEFAULT)
    # starts high enough to see the sleeping face over the quilt, booms down with the bolt upright
    cb.key(T_CUT, cx=eb.x, cy=eb.y, cz=eb.z + 0.85, tx=tb0.x, ty=tb0.y, tz=tb0.z, lens=30, fstop=2.8,
           focus=(face - eb).length)
    cb.key(T_SNAP + 0.08, "linear", cz=eb.z + 0.82, tx=tb0.x, ty=tb0.y, tz=tb0.z)
    cb.key(T_SNAP + 0.5, "inout", cz=eb.z, tx=tb1.x, ty=tb1.y, tz=tb1.z)
    cb.key(dur, "soft", cx=eb.x + 0.02, cy=eb.y + 0.12, cz=eb.z - 0.02, tx=tb1.x, ty=tb1.y, tz=tb1.z, lens=33)
    cb.layer(lambda t, p: p.update(shake=0.25 + 1.2 * max(0, 1 - abs(t - T_SNAP - 0.35) / 0.3)))
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=18)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_CUT * 24))
    __import__("bpy").context.scene.camera = camA
    scene.char_lights(c.col, face, camB.location, (0.8, 0.6, 0.2), rim_col=(1.0, 0.7, 0.4), rim_w=14.0)
    return dict(face_key=30.0,
                post=dict(haze_amt=0.0, bloom=0.7, bloom_thr=0.6, kuw_near=3, kuw_far=4, vignette=0.45))
