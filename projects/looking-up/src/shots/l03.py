"""L03 — EXT night: the patchwork balloon, filled with the dying star's warmth (its lantern hung at the mouth), tugs at
its tether in front of the windmill — the sails stand bare. Claude unties it; the basket lifts off the peak. High above:
the comet, its long tail across the sky. Claude looks up at it, holding on."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, finale, props, windmill, geo, framing as FR
from lu.anim import Track, CAM_DEFAULT
from shots.l06 import rel_cam

T_LIFT = 1.2
T_B = 1.75         # cut: wide from the meadow, the balloon lifting past the bare sails toward the comet
T_C = 3.35         # cut: Claude close, looking up at the comet, holding on
COMET = (52.0, 30.0)


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(sails_angle=45.0, canvas=(0, 0, 0, 0)), overrides=dict(stars=1.2))
    O = W.origin
    dur = (f1 - f0) / 24
    fps = 24
    props.constellation(origin=(O.x, O.y, 0), lines=0.0)
    props.comet(az=COMET[0], el=COMET[1], dist=1300.0, origin=(O.x, O.y, 0), tail_dir=(0.85, -0.2, 0.45), scale=1.5)
    B = finale.balloon()
    bx, by = 1.8, -8.5
    gz = W.ground(bx, by)
    base_z = gz + 1.38
    lan = interior.lantern(bpy.context.scene.collection, interior.mats())
    lan["root"].parent = B["root"]
    lan["root"].location = (0, 0, -0.42)

    def basket(t):
        u = max(0.0, t - T_LIFT)
        tug = 0.05 * math.sin(t * 2.0) if t < T_LIFT else 0.0
        return Vector((bx + 0.25 * u, by + 0.1 * u, base_z + tug + 1.6 * u * u + 0.5 * u))

    cd = props.sky_dir(*COMET)
    HD = math.degrees(math.atan2(cd.x, -cd.y))            # facing the comet's quarter
    hdr = math.radians(HD)                                 # the basket turned square to Claude

    def brot(t):
        k = 1.0 if t < T_LIFT else 0.6
        return (0.03 * k * math.sin(t * 2.6), 0.04 * k * math.sin(t * 2.1), hdr + 0.02 * math.sin(t * 0.9))
    for f in range(f0, f1):
        t = (f - f0) / fps
        B["root"].location = basket(t)
        B["root"].rotation_euler = brot(t)
        B["root"].keyframe_insert("location", frame=f)
        B["root"].keyframe_insert("rotation_euler", frame=f)
    fz = B["basket_floor"].z + 0.02
    eye_z = fz + 0.574
    c = W.claude()
    s = W.star()
    s.light_scale = 22.0
    R_hd = Matrix.Rotation(math.radians(HD), 4, "Z")

    def local(v):                                          # Claude-facing local -> basket-relative
        return (R_hd @ Vector(v).to_4d()).to_3d()
    # the tether: from Claude's hands at the front-left corner down to a stake in the grass
    corner = local((0.42, -0.5, fz + 0.5))
    stake_p = Vector((bx, by, gz)) + local((1.05, -1.25, 0.0))
    stake = geo.box("TetherStake", (0.06, 0.06, 0.4), loc=stake_p + Vector((0, 0, 0.12)), mat=interior.mats()["wood"])
    rope_m = bpy.data.materials.get("Rope")
    rope = geo.lathe("Tether", [(0.016, 0.0), (0.016, 1.0)], seg=6, mat=rope_m, cap_top=False, cap_bot=False)
    rope.visible_shadow = False
    for f in range(f0, f1):
        t = (f - f0) / fps
        a = stake_p + Vector((0, 0, 0.3))
        if t < T_LIFT:
            b = basket(t) + corner
        else:
            u = anim.ease("in", min(1.0, (t - T_LIFT) / 0.45))
            b = (basket(T_LIFT) + corner).lerp(a + local((-0.35, 0.7, -0.28)), u)   # the freed end drops to the grass
        d = b - a
        rope.matrix_basis = Matrix.Translation(a) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4() @ \
            Matrix.Diagonal((1, 1, max(d.length, 0.01), 1))
        rope.keyframe_insert("location", frame=f)
        rope.keyframe_insert("rotation_euler", frame=f)
        rope.keyframe_insert("scale", frame=f)
    tr = Track()
    tr.pose(0.0, S.merge(S.C_DETERMINED, heading=HD, lean=22, look_x=0.55, look_y=-0.75, armL_up=-10, armL_fwd=70,
                         armR_up=-10, armR_fwd=55, armL_bend=20, twist=-10, head_turn=8, eye_happy=0.0, slump=0,
                         head_nod=8, pupil=1.0, squash=0.0, armR_bend=0))
    # working the knot (little tugs)
    tr.key(T_LIFT - 0.05, "linear", lean=22)
    tr.key(T_LIFT + 0.12, "out", lean=10, armL_up=20, armL_fwd=40, look_y=-0.3, eye_open=1.0, pupil=1.1, squash=-0.06)
    tr.key(T_LIFT + 0.55, "inout", lean=-6, armL_up=-15, armR_up=-15, armL_fwd=62, armR_fwd=62, armL_bend=30,
           armR_bend=30, twist=0, head_turn=0, look_x=0.0, look_y=0.6, eye_tilt=0.2, head_nod=-6, squash=0.04)
    # (C) looks up at the comet, holding on to the rim: wonder, a breath of fear, resolve
    tr.key(T_C, "inout", look_y=1.1, head_nod=-15, lean=-12, eye_open=1.0, pupil=1.18, eye_tilt=0.35, squash=0.05)
    tr.key(dur - 0.6, "inout", eye_tilt=0.1, eye_open=0.9, pupil=1.1, eye_happy=0.25)
    tr.key(dur, "soft", eye_happy=0.35)

    def tugs(t, p):
        if t < T_LIFT:
            p["armL_fwd"] = p.get("armL_fwd", 0) + 10 * math.sin(t * 15.0)
            p["armR_fwd"] = p.get("armR_fwd", 0) + 8 * math.sin(t * 15.0 + 1.0)

    def cplace(t, p):
        q = basket(t)
        p.update(x=q.x, y=q.y, z=q.z + fz)
    tr.layer(tugs)
    tr.layer(anim.breathe(0.012, 0.25))
    tr.layer(anim.blinks(times=[0.35, 2.7, 4.2], dur=0.15))
    tr.layer(cplace)
    c.bake(lambda f: tr.at((f - f0) / fps), f0, f1 - 1)

    def spose(t):
        b = basket(t)
        return S.merge(S.S_DIM, x=b.x, y=b.y, z=b.z - 0.25, scale=0.55, glow=0.6, warmth=0.6, heading=HD)
    s.bake(lambda f: spose((f - f0) / fps), f0, f1 - 1)
    # ------------------------------------------------------------------ cameras
    face = local((0.0, -0.21, eye_z))
    # A: on the grass in front-left of the basket, low: Claude bent over the knot, the glowing envelope above
    camA = rel_cam("CamA", f0, f1, lambda t: Vector((bx, by, base_z)), [
        (0.0, "linear", local((1.55, -2.35, fz + 1.15)), local((0.3, -0.35, fz + 0.62)), 28, 2.8),
        (T_B, "soft", local((1.45, -2.2, fz + 1.05)), local((0.2, -0.3, fz + 0.9)), 28, 2.8)], seed=65, shake=0.1)
    # B: from the meadow below, looking up past the bare windmill: the balloon lifting off toward the comet
    eB = Vector((bx - 9.0, by - 7.0, gz + 1.0))
    camB = scene.camera("CamB", lens=20)
    cb = Track(CAM_DEFAULT)
    cb.key(T_B, cx=eB.x, cy=eB.y, cz=eB.z, lens=20)
    cb.key(T_C, "linear", cx=eB.x + 0.3, cy=eB.y - 0.3, cz=eB.z - 0.2, lens=20)

    def aimB(t, p):
        g = basket(t) + Vector((0, 0, 1.2))
        g = g.lerp(Vector((O.x, O.y, O.z + 8.0)), 0.3) + Vector((0, 0, 3.5))
        p.update(tx=g.x, ty=g.y, tz=g.z, shake=0.1)
    cb.layer(aimB)
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=66)
    # C: riding with the balloon, in front and below: Claude's face turned up to the comet, hands on the rim
    camC = rel_cam("CamC", f0, f1, basket, [
        (T_C, "linear", local((-0.08, -1.75, eye_z - 0.16)), local((0.0, -0.2, eye_z + 0.12)), 32, 2.4),
        (dur, "soft", local((-0.08, -1.6, eye_z - 0.18)), local((0.0, -0.2, eye_z + 0.16)), 33, 2.4)], seed=67, shake=0.12)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(round(T_B * fps)))
    S.cut(camC, f0 + int(round(T_C * fps)))
    bpy.context.scene.camera = camA
    # the comet's cold light on Claude's upturned face + the lantern's warmth from above
    b4 = basket(4.0)
    scene.char_lights(c.col, b4 + Vector((0, 0, fz + 0.45)), b4 + local((0.35, -1.6, eye_z)), (-cd.x, -cd.y, 0.5),
                      rim_col=(0.6, 0.75, 1.0), rim_w=18.0, fill_col=(0.6, 0.72, 1.0), fill_w=10.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=60.0, mist_depth=2000.0, bloom=0.8, bloom_thr=0.5))
