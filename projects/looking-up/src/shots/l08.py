"""L08 — Without the star's warmth the balloon sinks back into the storm; inside the black cloud Claude is alone,
holding the empty lantern, lost. Then — a single beam of golden starlight pierces the clouds from above and wraps the
balloon; it steadies, and drifts down along the beam... out of the cloud base, toward the peak and the windmill below,
and settles on the grass with a soft bump."""
import math
import bpy
from mathutils import Vector, Matrix, Euler
from lu import world, anim, scene, stage as S, interior, finale, fx, props, framing as FR
from lu.anim import Track, CAM_DEFAULT
from shots.l04 import ride_cam

T_BEAM = 2.7
T_LAND = 6.0
T_B = 3.45         # cut to the wide: down the beam to the peak


def make(f0, f1):
    W = world.World("ext", "storm", windmill_state=dict(sails_angle=45.0, canvas=(0, 0, 0, 0)))
    O = W.origin
    dur = (f1 - f0) / 24
    fps = 24
    land = Vector((2.4, -9.0, W.ground(2.4, -9.0) + 1.38))
    top = land + Vector((3.0, -4.0, 40.0))
    p_beam = top + Vector((0.4 * math.sin(T_BEAM * 2), 0.3 * math.sin(T_BEAM * 1.6), -1.2 * T_BEAM))

    def bpos(t):
        if t < T_BEAM:
            return top + Vector((0.4 * math.sin(t * 2), 0.3 * math.sin(t * 1.6), -1.2 * t))
        u = anim.ease("inout", min(1.0, (t - T_BEAM) / (T_LAND - T_BEAM)))
        return p_beam.lerp(land, u) + Vector((0, 0, 0.6 * math.sin(math.pi * u) * (1 - u)))

    def brot(t):
        k = 1.0 if t < T_BEAM else max(0.0, 1 - (t - T_BEAM) / 1.5)
        return (0.14 * k * math.sin(t * 2.4), 0.16 * k * math.sin(t * 2.0), 0.15 * math.sin(t * 0.6))
    B = finale.balloon(sag=0.3)
    for f in range(f0, f1):
        t = (f - f0) / fps
        B["root"].location = bpos(t)
        B["root"].rotation_euler = brot(t)
        B["root"].keyframe_insert("location", frame=f)
        B["root"].keyframe_insert("rotation_euler", frame=f)
    fz = B["basket_floor"].z + 0.02
    eye_z = fz + 0.574
    # ------------------------------------------------------------------ the storm overhead (cloud base ~28 m up)
    eB0 = land + Vector((13.0, -17.0, -0.2))
    path = (top + Vector((0, 0, 6)), land, 6.0)
    finale.storm_clouds(top + Vector((0, 0, 8)), radius=60, n=30, seed=9, level_lo=-10, level_hi=16, near=0.2,
                        avoid=[path], f0=f0, f1=f1, drift=(0.4, 0.2, 0.6))
    finale.rain(top + Vector((0, 0, -1)), size=(14, 14, 16), n=2400, f0=f0, f1=f1, seed=5, speed=24, strength=0.6,
                width=0.005)
    finale.rain(land + Vector((0, 0, 14)), size=(60, 60, 34), n=3500, f0=f0, f1=f1, seed=6, speed=22, length=1.0,
                width=0.012, strength=0.4)
    finale.lightning("Bolt0", top + Vector((-30, 26, 18)), top + Vector((-22, 22, -16)), 0.9, f0, branches=3, seed=11,
                     flash_energy=50000)
    # ------------------------------------------------------------------ the beam of starlight
    src = land + (p_beam - land) * 4.0           # the beam runs down the line the balloon will follow
    bm = fx.beam("Starbeam", src, land + Vector((0, 0, -1.0)), 3.2, 2.2, color=(1.0, 0.85, 0.5), strength=0.0)
    # (fx.beam fades toward its end: a second shaft rising from the ground keeps it bright where the balloon is)
    bm2 = fx.beam("Starbeam2", land + Vector((0, 0, -1.0)), land + (p_beam - land) * 1.5, 2.2, 2.6,
                  color=(1.0, 0.85, 0.5), strength=0.0)
    sl = bpy.data.lights.new("BeamLight", "SPOT")
    sl.color = (1.0, 0.82, 0.5)
    sl.spot_size = math.radians(4)
    sl.spot_blend = 0.6
    slo = bpy.data.objects.new("BeamLight", sl)
    bpy.context.scene.collection.objects.link(slo)
    scene.look_at(slo, src, land)
    muls = [[n for n in b_.data.materials[0].node_tree.nodes if n.type == "MATH" and n.operation == "MULTIPLY"][-1]
            for b_ in (bm, bm2)]
    # the gold light reaching Claude's face (light-linked to Claude: the envelope would shade the real beam)
    gl = bpy.data.lights.new("BeamFace", "AREA")
    gl.color = (1.0, 0.78, 0.45)
    gl.size = 1.2
    glo = bpy.data.objects.new("BeamFace", gl)
    bpy.context.scene.collection.objects.link(glo)
    for f in range(f0, f1):
        t = (f - f0) / fps
        u = anim.ease("out", min(1.0, max(0.0, (t - T_BEAM) / 0.7)))
        sl.energy = 6.0e5 * u + 0.01
        sl.keyframe_insert("energy", frame=f)
        for mul, k in zip(muls, (0.8, 0.28)):
            mul.inputs[1].default_value = k * u
            mul.inputs[1].keyframe_insert("default_value", frame=f)
        gl.energy = 70.0 * u + 0.01
        gl.keyframe_insert("energy", frame=f)
    # golden motes drifting in the beam around the balloon
    fx.motes("BeamMotes", land + Vector((0, 0, 14)), (5, 5, 30), n=400, f0=f0, f1=f1, drift=(0.0, 0.0, -0.6), seed=3,
             color=(1.0, 0.85, 0.5), strength=6.0)
    # ------------------------------------------------------------------ Claude, alone, holding the empty lantern
    c = W.claude()
    HD = -20.0
    tr = Track()
    hold = dict(armL_up=40, armR_up=10, armL_fwd=55, armR_fwd=86, armL_bend=20, armR_bend=12, twist=8)
    tr.pose(0.0, S.merge(S.C_SAD, hold, heading=HD, look_x=-0.55, look_y=0.05, eye_open=0.8, eye_tilt=0.75, slump=12,
                         head_turn=-12, head_nod=0, pupil=0.95, eye_happy=0.0, lean=4, squash=-0.06, head_tilt=0))
    tr.key(1.0, "inout", look_x=-0.1, head_turn=-2, look_y=0.25)        # searching the dark... nothing
    tr.key(1.8, "inout", look_x=0.6, head_turn=10, head_tilt=8, look_y=-0.05, head_nod=4, eye_open=0.62, eye_tilt=0.9,
           slump=18)                                                    # turns to the empty lantern in its arms
    tr.key(T_BEAM - 0.05, "linear", look_x=0.6, head_turn=10, head_tilt=8, look_y=-0.05, head_nod=4, eye_open=0.62,
           pupil=0.95, lean=4, slump=18, eye_tilt=0.9)
    tr.key(T_BEAM + 0.35, "out", look_y=1.1, look_x=0.0, head_turn=0, head_tilt=0, head_nod=-16, lean=-12, eye_open=1.0,
           pupil=1.25, eye_tilt=0.05, slump=2, squash=0.06)
    tr.key(T_BEAM + 1.1, "inout", eye_happy=0.5, eye_tilt=0.35, pupil=1.1, eye_open=0.85, look_y=1.0)
    tr.key(T_LAND - 0.2, "inout", eye_happy=0.6, look_y=0.6, head_nod=-8, lean=-6)
    tr.key(dur, "soft", eye_happy=0.7, look_y=0.4)

    def bump(t, p):
        if t > T_LAND:
            u = t - T_LAND
            p["squash"] = p.get("squash", 0.0) - 0.12 * math.exp(-u * 6) * math.cos(u * 25)

    def cplace(t, p):
        q = Matrix.Translation(bpos(t)) @ Euler(brot(t)).to_matrix().to_4x4() @ Vector((0, 0, fz))
        rx, ry, rz = brot(t)
        p.update(x=q.x, y=q.y, z=q.z, heading=p["heading"] + math.degrees(rz), tilt_x=math.degrees(rx),
                 tilt_y=math.degrees(ry))
    tr.layer(bump)
    tr.layer(anim.blinks(times=[0.6, 2.25], dur=0.18))
    tr.layer(cplace)
    c.bake(lambda f: tr.at((f - f0) / fps), f0, f1 - 1)
    # the lantern, in its arms (dark glass: the star is gone)
    lan = interior.lantern(bpy.context.scene.collection, interior.mats())
    R_hd = Matrix.Rotation(math.radians(HD), 4, "Z")
    for f in range(f0, f1):
        t = (f - f0) / fps
        close = anim.ease("inout", min(1.0, max(0.0, (t - 1.2) / 0.7)))
        lp = Vector((0.4 - 0.04 * close, -0.3 + 0.03 * close, fz + 0.24 + 0.05 * close))     # beside its cheek
        M = Matrix.Translation(bpos(t)) @ Euler(brot(t)).to_matrix().to_4x4() @ R_hd @ Matrix.Translation(lp) @ \
            Matrix.Rotation(0.15, 4, "Z")
        lan["root"].matrix_basis = M
        lan["root"].keyframe_insert("location", frame=f)
        lan["root"].keyframe_insert("rotation_euler", frame=f)

    def local(v):
        return (R_hd @ Vector(v).to_4d()).to_3d()
    # ------------------------------------------------------------------ cameras
    # A: Claude close in the dark (riding the tossed basket); the gold light falls on it from above
    camA = ride_cam("CamA", f0, f1, [
        (0.0, "linear", local((0.55, -1.75, eye_z + 0.12)), local((0.05, -0.2, eye_z - 0.08)), 36, 2.4),
        (T_BEAM, "soft", local((0.48, -1.5, eye_z + 0.08)), local((0.05, -0.2, eye_z - 0.06)), 38, 2.4),
        (T_B, "soft", local((0.45, -1.55, eye_z - 0.05)), local((0.05, -0.2, eye_z + 0.12)), 36, 2.4)],
        base=bpos, rot=brot, seed=76, shake=0.6)
    # B: from the meadow: the balloon drifting down the beam out of the cloud base to the peak, the windmill beyond
    camB = scene.camera("CamB", lens=24)
    cb = Track(CAM_DEFAULT)
    cb.key(T_B, cx=eB0.x, cy=eB0.y, cz=eB0.z + 1.4, lens=24)
    cb.key(dur, "soft", cx=eB0.x - 3.5, cy=eB0.y + 5.0, cz=eB0.z + 0.9, lens=30)

    def aimB(t, p):
        b = bpos(t)
        g = b + Vector((0, 0, -0.4))
        g = g.lerp(land.lerp(O + Vector((0, 0, 5)), 0.35) + Vector((0, 0, 1.2)), 0.25)
        p.update(tx=g.x, ty=g.y, tz=g.z, shake=0.15)
    cb.layer(aimB)
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=77)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(round(T_B * fps)))
    glo.parent = None
    for f in range(f0, f1):          # the face light rides above-front of Claude
        t = (f - f0) / fps
        q = Matrix.Translation(bpos(t)) @ Euler(brot(t)).to_matrix().to_4x4() @ R_hd @ \
            Matrix.Translation((0.2, -0.9, eye_z + 1.0))
        scene.look_at(glo, q.to_translation(), bpos(t) + Vector((0, 0, eye_z)))
        glo.keyframe_insert("location", frame=f)
        glo.keyframe_insert("rotation_quaternion", frame=f)
    glo.light_linking.receiver_collection = c.col
    bpy.context.scene.camera = camA
    b1 = bpos(1.5)
    scene.char_lights(c.col, b1 + Vector((0, 0, fz + 0.45)), b1 + local((0.5, -1.6, eye_z)), (0.3, 0.8, 0.6),
                      rim_col=(0.55, 0.65, 0.9), rim_w=26.0, fill_col=(0.6, 0.66, 0.88), fill_w=30.0)
    return dict(post=dict(haze=(0.1, 0.12, 0.16), haze_amt=0.5, mist_start=20.0, mist_depth=400.0, bloom=0.85,
                          bloom_thr=0.55, kuw_near=3, kuw_far=6, vignette=0.45))
