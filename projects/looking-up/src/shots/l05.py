"""L05 — STORM: still falling — then, in the lantern, the star opens its eyes and burns: brighter, brighter, white-gold,
everything it has left. The canvas swells with its heat; the balloon stops falling and rises, faster, up through the
churning cloud — and bursts out through the top."""
import math
import bpy
from mathutils import Vector, Matrix, Euler
from lu import world, anim, scene, stage as S, interior, finale, fx, framing as FR
from lu.anim import Track, CAM_DEFAULT
from shots.l04 import ALT, ride_cam

T_FLARE = 0.7
T_B = 1.6          # cut out: the glowing balloon climbing through the storm
T_C = 2.35         # from above the cloud tops: it bursts out
TOP = 109.0        # height of the storm's ceiling


def make(f0, f1):
    W = world.World("sky", "storm", overrides=dict(key_e=1.0, stars=1.2, cloud_amt=0.2,
                                                   ramp=[(-0.2, (0.03, 0.04, 0.06)), (0.0, (0.09, 0.13, 0.18)), (0.1, (0.05, 0.08, 0.13)), (0.4, (0.025, 0.04, 0.08)), (0.8, (0.01, 0.02, 0.045))]))
    dur = (f1 - f0) / 24
    fps = 24
    A = ALT + Vector((0, 0, -4.0))

    def bpos(t):
        u = max(0.0, t - T_FLARE)
        return A + Vector((0.6 * math.sin(t * 1.2), 0.4 * math.sin(t), -0.3 * min(t, T_FLARE) + 3.0 * u * u + 0.8 * u
                           + 0.9 * u ** 3))

    def brot(t):
        k = max(0.25, 1.0 - max(0.0, t - T_FLARE) * 0.5)
        return (0.12 * k * math.sin(t * 2.0), 0.14 * k * math.sin(t * 1.7), 0.08 * math.sin(t * 0.8))
    B = finale.balloon(sag=0.1)
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
    # ------------------------------------------------------------------ the storm, and its ceiling
    bT = bpos(dur)
    path = (bpos(0.0) + Vector((0, 0, -2)), bT + Vector((0, 0, 3)), 6.5)
    eB = bpos(T_B) + Vector((7.5, -9.0, -6.0))
    finale.storm_clouds(A + Vector((0, 0, 4)), radius=80, n=34, seed=6, level_lo=-26, level_hi=TOP - A.z - 12, near=0.22,
                        avoid=[path, (eB, 5.0), (eB, bpos(T_B), 3.0), (eB, bpos(T_C), 3.0)], f0=f0, f1=f1,
                        drift=(0, 0, -1.2))
    # the cloud tops: a broad lid of heaps right over the balloon (it breaks out through the middle one)
    eC = Vector((bT.x + 11.0, bT.y - 15.0, TOP + 4.5))
    finale.storm_clouds(Vector((bT.x, bT.y, TOP - 8)), radius=75, n=28, seed=15, level_lo=-2, level_hi=2, near=0.12,
                        size=1.0, f0=f0, f1=f1, drift=(0, 0, -0.3),
                        avoid=[(eC, 4.0), (eC, Vector((bT.x, bT.y, TOP + 2)), 2.0), (eB, bpos(T_C), 3.0),
                               (eB, bpos(T_B), 3.0)])
    finale.storm_clouds(Vector((bT.x + 2, bT.y - 1, TOP - 9)), radius=1.0, n=1, seed=16, level_lo=0, level_hi=0, near=0.0,
                        size=1.0)
    finale.rain(A + Vector((0, 0, 2)), size=(14, 14, 16), n=2400, f0=f0, f1=f1, seed=3, speed=24, strength=0.6,
                width=0.005)
    finale.rain(A + Vector((0, 0, -2)), size=(60, 60, 40), n=3000, f0=f0, f1=f1, seed=8, speed=24, length=1.2, width=0.02,
                strength=0.45)
    b1 = bpos(1.2)
    finale.lightning("Bolt0", b1 + Vector((-26, 30, 24)), b1 + Vector((-18, 26, -20)), 1.0, f0, branches=3, seed=7,
                     flash_energy=60000)
    # ------------------------------------------------------------------ the star: opens its eyes, burns
    s = W.star()
    s.light_scale = 40.0
    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, scale=0.55, heading=180, glow=0.42, warmth=0.45, eye_open=0.25, eye_happy=0.0,
                         arms=0, curl=0, eye_tilt=0.8, look_y=-0.6))
    st.key(T_FLARE - 0.25, "linear", eye_open=0.25, glow=0.42)
    st.key(T_FLARE + 0.1, "out", eye_open=1.0, pupil=1.15, eye_tilt=0.0, look_y=-0.2, droop=30, glow=0.9)
    st.key(T_FLARE + 0.55, "inout", eye_tilt=-0.65, eye_open=0.85, pupil=1.0, droop=0, head=-12, arms=30, curl=-10,
           legs=8, glow=2.4, warmth=0.85)
    st.key(dur, "in", glow=5.0, warmth=1.0, arms=40, eye_tilt=-0.75)

    def flare_tremble(t, p):
        if t > T_FLARE + 0.3:
            p["roll"] = p.get("roll", 0.0) + 2.5 * math.sin(t * 47.0)
    st.layer(flare_tremble)

    def splace(t, p):
        q = Matrix.Translation(bpos(t)) @ Euler(brot(t)).to_matrix().to_4x4() @ Vector((0, 0, -0.25))
        p.update(x=q.x, y=q.y, z=q.z, heading=180 + math.degrees(brot(t)[2]))
    st.layer(splace)
    s.bake(lambda f: st.at((f - f0) / fps), f0, f1 - 1)
    # the canvas swells with its heat: the envelope glows from inside
    env_light = bpy.data.lights.new("EnvelopeGlow", "POINT")
    env_light.color = (1.0, 0.62, 0.25)
    env_light.shadow_soft_size = 0.8
    el = bpy.data.objects.new("EnvelopeGlow", env_light)
    bpy.context.scene.collection.objects.link(el)
    el.parent = B["root"]
    el.location = (0, 0, 1.4)
    for f in range(f0, f1):
        t = (f - f0) / fps
        u = anim.ease("in", min(1.0, max(0.0, (t - T_FLARE) / 1.6)))
        env_light.energy = 4.0 + 900.0 * u
        env_light.keyframe_insert("energy", frame=f)
    # ------------------------------------------------------------------ Claude: looks up at the light, lit gold
    c = W.claude()
    HD = 180.0
    tr = Track()
    tr.pose(0.0, S.merge(S.C_SAD, heading=HD, look_y=-0.6, eye_open=0.55, armL_up=-30, armR_up=-30, head_nod=6,
                         eye_happy=0.0, pupil=1.0, lean=6, squash=-0.06, head_tilt=0))
    tr.key(T_FLARE, "linear", look_y=-0.5, head_nod=5, eye_open=0.55)
    tr.key(T_FLARE + 0.3, "out", look_y=1.1, head_nod=-16, lean=-12, eye_open=1.0, pupil=1.25, eye_tilt=0.0, slump=0,
           squash=0.1, armL_up=40, armR_up=40)
    tr.key(T_FLARE + 0.9, "inout", eye_tilt=-0.2, pupil=1.15, armL_up=70, armR_up=70, armL_bend=15, armR_bend=15,
           eye_happy=0.2, squash=0.04)
    tr.key(dur, "soft", eye_happy=0.45, armL_up=82, armR_up=82)

    def cplace(t, p):
        q = Matrix.Translation(bpos(t)) @ Euler(brot(t)).to_matrix().to_4x4() @ Vector((0, 0, fz))
        rx, ry, rz = brot(t)
        p.update(x=q.x, y=q.y, z=q.z, heading=HD + math.degrees(rz), tilt_x=math.degrees(rx), tilt_y=math.degrees(ry))
    tr.layer(anim.blinks(times=[0.3], dur=0.16))
    tr.layer(cplace)
    c.bake(lambda f: tr.at((f - f0) / fps), f0, f1 - 1)
    # ------------------------------------------------------------------ cameras
    # A: low in front of Claude, up at its face and the lantern above it
    camA = ride_cam("CamA", f0, f1, [
        (0.0, "linear", Vector((-0.35, 1.9, eye_z - 0.28)), Vector((0.0, 0.1, eye_z + 0.22)), 28, 2.4),
        (T_B, "soft", Vector((-0.32, 1.65, eye_z - 0.3)), Vector((0.0, 0.1, eye_z + 0.28)), 29, 2.4)],
        base=bpos, rot=brot, seed=69, shake=0.8)
    # B: from below and beside: the glowing balloon climbing away through the churning cloud
    camB = scene.camera("CamB", lens=24)
    cb = Track(CAM_DEFAULT)
    cb.key(T_B, cx=eB.x, cy=eB.y, cz=eB.z, lens=24)
    cb.key(T_C, "linear", cx=eB.x, cy=eB.y, cz=eB.z + 2.5, lens=24)

    def aimB(t, p):
        g = bpos(t) + Vector((0, 0, 1.2))
        p.update(tx=g.x, ty=g.y, tz=g.z, shake=1.2)
    cb.layer(aimB)
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=70)
    # C: above the cloud tops, looking down at the lid as the balloon breaks out through it
    camC = scene.camera("CamC", lens=26)
    cc = Track(CAM_DEFAULT)
    cc.key(T_C, cx=eC.x, cy=eC.y, cz=eC.z, lens=26)
    cc.key(dur, "out", cx=eC.x + 0.6, cy=eC.y - 0.8, cz=eC.z + 0.8, lens=26)

    def aimC(t, p):
        g = bpos(t)
        p.update(tx=g.x, ty=g.y, tz=max(TOP + 1.5, g.z + 1.0 + 0.5 * (g.z - TOP)), shake=0.6)
    cc.layer(aimC)
    anim.bake_camera(camC, cc, f0, f1 - 1, seed=71)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(round(T_B * fps)))
    S.cut(camC, f0 + int(round(T_C * fps)))
    bpy.context.scene.camera = camA
    b0 = bpos(0.8)
    scene.char_lights(c.col, b0 + Vector((0, 0, fz + 0.45)), b0 + Vector((-0.3, 1.6, eye_z)), (0.2, -0.9, 0.6),
                      rim_col=(0.6, 0.7, 0.95), rim_w=24.0, fill_col=(0.6, 0.66, 0.88), fill_w=14.0)
    return dict(post=dict(haze=(0.11, 0.13, 0.18), haze_amt=0.55, mist_start=6.0, mist_depth=120.0, bloom=0.95,
                          bloom_thr=0.5, bloom_size=8, kuw_near=3, kuw_far=6, vignette=0.45))
