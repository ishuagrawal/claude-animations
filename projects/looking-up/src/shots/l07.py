"""L07 — SKY: the star climbs into the constellation, smaller and smaller — then reaches the empty eye and IGNITES: a
burst of gold light, rays across the sky, the star-chart lines flaring bright for a moment. The Claude-shaped
constellation opens its eye. (Over Claude's shoulder in the basket, small below.)"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, finale, clouds, props, fx, geo, framing as FR
from lu.anim import Track, CAM_DEFAULT
from shots.l06 import POS, SKY_C, basket as basket6, rel_cam

T_IGNITE = 2.5     # bar 60 beat 4: the orchestral hit lands here; the burst peaks exactly at this time
L06_DUR = 10.0     # L07 picks up where L06 ends (balloon drift, the star's climb)


def basket(t):
    return basket6(L06_DUR + t)


def bezier(p0, p1, p2, p3, u):
    a = 1 - u
    return p0 * a ** 3 + p1 * 3 * a * a * u + p2 * 3 * a * u * u + p3 * u ** 3


def make(f0, f1):
    W = world.World("sky", "night", overrides=dict(cloud_amt=0.12, stars=1.4))
    dur = (f1 - f0) / 24
    fps = 24
    fT = f0 + int(round(T_IGNITE * fps))          # the ignition frame (the burst's peak)
    clouds.floor(level=POS.z - 30, r_in=1.0, r_out=9000)
    K = props.constellation(center=SKY_C, origin=tuple(POS), lines=0.22)
    props.comet(az=67, el=11, origin=tuple(POS), tail_dir=(0.45, -0.35, 0.6))
    eye = K["eye"]
    eye_pos = eye.location.copy()

    def burst(t, rise=0.1, decay=2.2):
        """0 before, ramps to 1 exactly at T_IGNITE, then decays."""
        u = t - T_IGNITE
        if u < -rise:
            return 0.0
        if u < 0:
            return anim.ease("in", (u + rise) / rise)
        return math.exp(-u * decay)
    for f in range(f0, f1):
        t = (f - f0) / fps
        e = (1.0 + 7.0 * burst(t, 0.1, 1.6)) if t >= T_IGNITE else 8.0 * burst(t, 0.1)
        eye["eye"] = e
        eye.scale = (1 + 1.1 * burst(t, 0.1, 1.4),) * 3
        eye.keyframe_insert('["eye"]', frame=f)
        eye.keyframe_insert("scale", frame=f)
        for ln in K["lines"]:
            ln["line"] = 0.22 + 0.95 * burst(t, 0.12, 1.3)
            ln.keyframe_insert('["line"]', frame=f)
        for st_ in K["stars"].values():
            big = st_.name.split("_")[1] in ("TL", "TR", "BR", "BL", "EYE", "AL", "AR")
            st_["bright"] = (1.0 if big else 0.7) * (1 + 1.6 * burst(t, 0.12, 1.8))
            st_.keyframe_insert('["bright"]', frame=f)
    # ------------------------------------------------------------------ the climbing star
    # still close above the balloon, it climbs away in a long rising arc and curls into the empty eye
    p_hover = basket(0.0) + Vector((0.2, 0.72, -0.73 + 0.16))
    d0 = (eye_pos - p_hover).normalized()
    upv = Vector((0, 0, 1))
    east = d0.cross(upv).normalized()
    flat = Vector((d0.x, d0.y, 0)).normalized()
    P0 = p_hover + flat * 3.5 + upv * 0.6
    D = (eye_pos - P0).length
    P1 = P0 + flat * 30.0 + upv * 7.0
    P2 = eye_pos - d0 * D * 0.6 - upv * D * 0.08 - east * D * 0.04
    P3 = eye_pos

    def ufun(t):
        x = min(1.0, max(0.0, t / T_IGNITE))
        return 0.35 * x + 0.65 * x ** 3.0           # slowly at first, then racing into the eye

    def star_pos(t):
        return bezier(P0, P1, P2, P3, ufun(t))
    s = W.star(light=False)
    for f in range(f0, f1):
        t = (f - f0) / fps
        p = star_pos(min(t, T_IGNITE))
        dist = max(1.0, (p - basket(t)).length)
        ang = math.radians(1.3 + (0.42 - 1.3) * min(1.0, t / T_IGNITE) ** 0.7)      # apparent radius, degrees
        sc = dist * math.tan(ang) / 0.17
        to_b = basket(t) - p
        hd = math.degrees(math.atan2(to_b.x, -to_b.y))
        s.apply(dict(x=p.x, y=p.y, z=p.z, scale=sc, heading=hd, pitch=-20, glow=2.6 + 3.5 * min(1.0, t / T_IGNITE),
                     warmth=1.0, eye_open=0.8, eye_happy=0.85, arms=24, head=-10))
        s.key(f)
    for o in [s.rig, s.body] + s.eyes:
        S.vis_range(o, f0, fT, f0, f1)
    # sparkle trail: glowing dabs at the star's recent positions, shrinking and fading behind it
    tm = fx._life_emissive("TrailDab", (1.0, 0.78, 0.4), 14.0)
    for k in range(14):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0)
        o = bpy.context.active_object
        o.name = f"Trail{k}"
        o.data.materials.append(tm)
        o.visible_shadow = False
        lag = 0.035 * (k + 1)
        for f in range(f0, f1):
            t = (f - f0) / fps
            tk = t - lag
            p = star_pos(min(max(tk, 0.0), T_IGNITE))
            dist = max(1.0, (p - basket(t)).length)
            rr = dist * math.tan(math.radians((1.1 - 0.7 * min(1.0, tk / T_IGNITE)) * 0.45 * (1 - k / 15.0)))
            alive = 1.0 if tk < T_IGNITE else max(0.0, 1 - (tk - T_IGNITE) / 0.08)
            o.location = p
            o.scale = (rr,) * 3
            o["life"] = (1 - k / 14.0) ** 1.4 * 0.7 * alive
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
    # ------------------------------------------------------------------ ignition: rays across the sky
    m = fx._life_emissive("Ray", (1.0, 0.82, 0.45), 26.0)
    rng = np.random.default_rng(3)
    dv = (eye_pos - Vector(POS)).normalized()
    side = dv.cross(upv).normalized()
    up2 = side.cross(dv)
    for k in range(14):
        a = 2 * math.pi * k / 14 + rng.normal(0, 0.12)
        dirv = side * math.cos(a) + up2 * math.sin(a)
        L = rng.uniform(260, 520) * (1.4 if k % 2 == 0 else 0.8)
        r = geo.lathe(f"Ray{k}", [(0.0, 0.0), (5.5, 0.04 * L), (2.2, 0.4 * L), (0.0, L)], seg=6, mat=m)
        r.matrix_basis = Matrix.Translation(eye_pos) @ dirv.to_track_quat("Z", "Y").to_matrix().to_4x4()
        r.visible_shadow = False
        for f in range(f0, f1):
            t = (f - f0) / fps
            u = t - T_IGNITE
            r["life"] = burst(t, 0.08, 2.0)
            r.scale = (1, 1, 0.01 if u < -0.08 else 0.35 + 0.65 * min(1.0, (u + 0.08) / 0.3))
            r.keyframe_insert('["life"]', frame=f)
            r.keyframe_insert("scale", frame=f)
    # a soft gold glow spreading from the eye (big halo shell) + gold light washing over the balloon
    hm = fx._life_emissive("IgniteGlow", (1.0, 0.8, 0.45), 2.5)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=eye_pos)
    glow = bpy.context.active_object
    glow.name = "IgniteGlow"
    glow.data.materials.append(hm)
    glow.visible_shadow = False
    for f in range(f0, f1):
        t = (f - f0) / fps
        glow["life"] = 0.45 * burst(t, 0.08, 1.6)
        glow.scale = (40 + 160 * min(1.0, max(0.0, t - T_IGNITE + 0.08) / 0.6),) * 3
        glow.keyframe_insert('["life"]', frame=f)
        glow.keyframe_insert("scale", frame=f)
    gl = scene.sun("IgniteLight", (0, 0, 0), (1.0, 0.78, 0.45), 0.0, angle=3.0, shadow=True)
    gl.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
    for f in range(f0, f1):
        t = (f - f0) / fps
        gl.data.energy = 4.5 * burst(t, 0.08, 1.4) + 0.001
        gl.data.keyframe_insert("energy", frame=f)
    # ------------------------------------------------------------------ the balloon and Claude, watching
    B = finale.balloon(sag=0.05)
    lan = interior.lantern(bpy.context.scene.collection, interior.mats())
    lan["root"].parent = B["root"]
    lan["root"].location = (0, 0, -0.42)
    for f in range(f0, f1):
        t = (f - f0) / fps
        B["root"].location = basket(t)
        B["root"].rotation_euler = (0.015 * math.sin((t + 10) * 0.9), 0.015 * math.sin((t + 10) * 0.7), 0.0)
        B["root"].keyframe_insert("location", frame=f)
        B["root"].keyframe_insert("rotation_euler", frame=f)
    fz = B["basket_floor"].z + 0.02
    eye_z = fz + 0.574
    c = W.claude()
    tr = Track()
    tr.pose(0.0, dict(heading=180.0, look_y=1.15, look_x=0.0, head_nod=-14, lean=-10, eye_happy=0.7, eye_open=0.9,
                      eye_tilt=0.5, armL_up=82, armL_fwd=5, armL_bend=25, armR_up=-12, armR_fwd=20, squash=0.0, hop=0.0,
                      pupil=1.0, head_tilt=0))
    tr.key(T_IGNITE - 0.3, "inout", armL_up=70, eye_happy=0.6, eye_open=0.92)
    tr.key(T_IGNITE, "linear", squash=0.0, pupil=1.0, eye_happy=0.4, eye_open=1.0, armR_up=-12, lean=-10, eye_tilt=0.5,
           hop=0.0, armL_up=70)
    tr.key(T_IGNITE + 0.15, "out", squash=0.12, hop=0.04, pupil=1.22, eye_happy=0.0, eye_tilt=0.1, armL_up=88,
           armR_up=40, lean=-14)
    tr.key(T_IGNITE + 0.6, "inout", squash=0.02, hop=0.0)
    tr.key(T_IGNITE + 1.3, "inout", eye_happy=0.8, eye_tilt=0.45, pupil=1.08, eye_open=0.8, armR_up=10)
    tr.key(dur, "soft", eye_happy=0.85, head_tilt=8, armL_up=60)

    def cplace(t, p):
        b = basket(t)
        p.update(x=b.x, y=b.y, z=b.z + fz + p.get("hop", 0.0))
        p["hop"] = 0.0
    tr.layer(anim.breathe(0.01, 0.22))
    tr.layer(cplace)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # ------------------------------------------------------------------ camera: low behind Claude's shoulder (as L06 E)
    def aim(e, az, el, dd=10.0):
        a_, e_ = math.radians(az), math.radians(el)
        return e + Vector((math.cos(e_) * math.cos(a_), math.cos(e_) * math.sin(a_), math.sin(e_))) * dd
    eC = Vector((-2.6, -2.2, eye_z - 0.47))
    cam = rel_cam("Cam", f0, f1, basket, [
        (0.0, "linear", eC, aim(eC, 72, 19), 22, 0),
        (T_IGNITE, "soft", eC + Vector((0.1, 0.08, 0.0)), aim(eC, 74, 20), 22.5, 0),
        (dur, "soft", eC + Vector((0.25, 0.2, 0.0)), aim(eC, 76, 20.5), 23.5, 0)], seed=75, shake=0.03)
    bpy.context.scene.camera = cam
    b0 = basket(1.0)
    scene.char_lights(c.col, b0 + Vector((0, 0, fz + 0.4)), b0 + eC, (0.0, 0.9, 0.45), rim_col=(0.6, 0.75, 1.0),
                      rim_w=18.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.35, mist_start=80.0, mist_depth=3000.0, bloom=0.95, bloom_thr=0.45,
                          bloom_size=9, vignette=0.35))
