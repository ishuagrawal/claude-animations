"""L06 — ABOVE THE STORM: sudden silence. The balloon drifts over a moonlit sea of cloud tops under every star; the
constellation hangs close, its eye empty; the comet. (A) Wide. (B) The star floats up out of the lantern, its glow
returning — then stops, turns back to Claude, and won't go. (C) Claude, close: it blinks twice, slowly — goodnight,
it's okay, go. (D) The star blinks twice back. (E) It rises, slowly at first, looking back until it is high above."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior, finale, clouds, props, framing as FR
from lu.anim import Track, CAM_DEFAULT

T_B, T_C, T_D, T_E = 2.0, 3.6, 5.2, 6.8
BL_C = (4.0, 4.5)
BL_S = (5.6, 6.1)
POS = Vector((0.0, -60.0, 140.0))
T_E2 = 8.5          # (E2) back on Claude, watching it go
SKY_C = (90.0, 28.0)  # above the storm the constellation hangs lower, closer (azimuth, elevation)


def basket(t):
    """Balloon root (envelope mouth) position: a slow, silent drift."""
    return POS + Vector((0.2 * t, 0, 0.15 * math.sin(t * 0.8)))


def rel_cam(name, f0, f1, base, keys, seed=0, shake=0.04):
    """Camera riding with the balloon. keys: [(t, ease, eye_rel, tgt_rel, lens, fstop)] relative to base(t)."""
    cam = scene.camera(name, lens=keys[0][4])
    ct = Track(CAM_DEFAULT)
    for (t, e, eye, tgt, lens, fs) in keys:
        ct.key(t, e, cx=eye.x, cy=eye.y, cz=eye.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=lens, fstop=fs)

    def ride(t, p):
        b = base(t)
        p.update(cx=p["cx"] + b.x, cy=p["cy"] + b.y, cz=p["cz"] + b.z, tx=p["tx"] + b.x, ty=p["ty"] + b.y,
                 tz=p["tz"] + b.z, shake=shake)
    ct.layer(ride)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=seed)
    return cam


def make(f0, f1):
    W = world.World("sky", "night", overrides=dict(cloud_amt=0.12, stars=1.4))
    dur = (f1 - f0) / 24
    clouds.floor(level=POS.z - 30, r_in=1.0, r_out=9000)
    K = props.constellation(center=SKY_C, origin=tuple(POS), lines=0.22)
    props.comet(az=67, el=11, origin=tuple(POS), tail_dir=(0.45, -0.35, 0.6))
    B = finale.balloon(sag=0.05)
    lan = interior.lantern(bpy.context.scene.collection, interior.mats())
    lan["root"].parent = B["root"]
    lan["root"].location = (0, 0, -0.42)
    for f in range(f0, f1):
        t = (f - f0) / 24
        B["root"].location = basket(t)
        B["root"].rotation_euler = (0.015 * math.sin(t * 0.9), 0.015 * math.sin(t * 0.7), 0.0)
        B["root"].keyframe_insert("location", frame=f)
        B["root"].keyframe_insert("rotation_euler", frame=f)
    fz = B["basket_floor"].z + 0.02            # Claude's feet (basket-relative)
    eye_z = fz + 0.574                          # Claude's eye line
    # Claude faces north (+Y): toward the moon and the constellation
    HD = 180.0
    c = W.claude()
    s = W.star()
    s.light_scale = 16.0
    eye_star = K["eye"].location.copy()

    # ------------------------------------------------------------------ the star (basket-relative path)
    inside = Vector((0, 0, -0.25))
    out1 = Vector((0.04, 0.5, -0.2))            # floating up and out, toward the sky...
    out2 = Vector((0.1, 0.95, -0.3))           # ...it stops
    hover = Vector((0.2, 0.72, eye_z + 0.16))   # turned back, drifted down to Claude: won't go

    def star_rel(t):
        if t < T_B:
            return inside
        if t < T_B + 0.75:
            u = anim.ease("inout", (t - T_B) / 0.75)
            return inside.lerp(out1, u) + Vector((0, 0, 0.12 * math.sin(math.pi * u)))
        if t < T_B + 1.15:
            return out1.lerp(out2, anim.ease("out", (t - T_B - 0.75) / 0.4))
        if t < T_E:
            u = anim.ease("inout", (t - T_B - 1.15) / 0.9)
            return out2.lerp(hover, u) + Vector((0, 0, 0.018 * math.sin(t * 2.2)))
        return hover + Vector((0, 0, 0.018 * math.sin(t * 2.2)))

    def star_at(t):
        if t < T_E:
            return basket(t) + star_rel(t)
        p0 = basket(T_E) + star_rel(T_E)
        u = t - T_E
        d = (eye_star - p0).normalized()
        return p0 + d * (0.12 * u + 0.55 * u * u + 0.35 * u ** 3)

    st = Track()
    st.pose(0.0, S.merge(S.S_DIM, scale=0.55, glow=0.35, warmth=0.45, eye_open=0.4, eye_happy=0.0, arms=0))
    st.key(T_B, "linear", glow=0.4, eye_open=0.45)
    st.key(T_B + 0.6, "inout", eye_open=0.9, droop=20, head=-10, look_y=0.6, eye_tilt=0.0, legs=0, scale=0.9)
    st.key(T_B + 1.0, "inout", glow=0.95, warmth=0.85, droop=6, arms=14, head=-16, look_y=0.9, scale=1.0)
    st.key(T_B + 1.5, "inout", droop=26, arms=-4, head=12, look_y=-0.35, eye_tilt=0.55, eye_open=0.85)   # turns back
    st.key(T_C, "inout", droop=34, head=16, eye_tilt=0.75, eye_open=0.8, glow=0.9, look_y=-0.45)
    st.key(BL_S[0] - 0.15, "inout", eye_tilt=0.7, droop=30, eye_happy=0.0, head=16, arms=-4, glow=0.9, eye_open=0.8)
    st.key(BL_S[1] + 0.45, "inout", eye_tilt=0.1, eye_happy=0.8, eye_open=0.75, droop=6, head=-4, arms=16, glow=1.2)
    st.key(T_E + 0.4, "inout", glow=1.3, eye_happy=0.6, look_y=-0.7, head=14)
    st.key(dur, "soft", glow=2.4, warmth=1.0, eye_happy=0.65, look_y=-0.85, arms=24)
    for b0 in BL_S:
        st.layer(anim.blink_at(b0, 0.36))

    def spulse(t, p):
        for b0 in BL_S:
            u = (t - b0) / 0.36
            if 0 <= u <= 1:
                p["glow"] = p.get("glow", 1) * (1 + 0.6 * math.sin(math.pi * u))

    def splace(t, p):
        q = star_at(t)
        p.update(x=q.x, y=q.y, z=q.z)
        claude_face = basket(t) + Vector((0, 0.21, eye_z))
        to_c = S.heading_to((q.x, q.y), (claude_face.x, claude_face.y))
        turn = ((to_c - 180.0 + 180.0) % 360.0) - 180.0
        u = anim.ease("inout", (t - T_B - 1.05) / 0.5)   # facing out toward the sky (its back to Claude)... turns back
        hd = 180.0 + turn * u
        if t > T_E:
            p["pitch"] = -min(35.0, 14 * (t - T_E))    # tips its face down toward Claude as it climbs
        p["heading"] = hd
    st.layer(spulse)
    st.layer(splace)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)

    # ------------------------------------------------------------------ Claude
    tr = Track()
    tr.pose(0.0, S.merge(S.C_TIRED, heading=HD, armL_up=-12, armR_up=-12, armL_fwd=20, armR_fwd=20, look_y=0.2,
                         eye_open=0.8, eye_tilt=0.3, eye_happy=0.0, head_nod=0, head_tilt=0, look_x=0, pupil=1.0,
                         armL_bend=0))
    tr.key(T_B + 0.4, "inout", look_y=0.9, look_x=0.0, head_nod=-10, eye_open=0.95, eye_tilt=0.45, slump=4, pupil=1.08)
    tr.key(T_B + 1.4, "inout", look_y=1.0, head_nod=-14, lean=-6, eye_tilt=0.6, eye_happy=0.0, head_tilt=0, look_x=0.0)
    tr.key(T_C, "inout", **S.merge(S.C_TENDER, look_y=0.55, look_x=-0.2, head_nod=-6, head_tilt=10, eye_tilt=0.55,
                                   eye_happy=0.25, eye_open=0.85, lean=0, slump=6))
    tr.key(BL_C[1] + 0.45, "inout", eye_happy=0.5, eye_tilt=0.45, head_tilt=12, head_nod=-2)
    tr.key(BL_C[1] + 0.9, "inout", head_nod=-9)        # a small nod: go on
    tr.key(BL_C[1] + 1.3, "inout", head_nod=-4)
    tr.key(T_E, "inout", eye_happy=0.55, look_y=0.6, armL_up=-12, armL_fwd=20, armL_bend=0, lean=0, head_nod=-4)
    tr.key(T_E + 1.4, "inout", look_y=1.1, head_nod=-12, lean=-8, eye_happy=0.6, eye_tilt=0.5, armL_up=70,
           armL_fwd=8, armL_bend=25)
    tr.key(dur, "soft", look_y=1.2, head_nod=-14, lean=-10, eye_happy=0.7, armL_up=82, armL_fwd=5)
    for b0 in BL_C:
        tr.layer(anim.blink_at(b0, 0.38))

    def wave(t, p):
        if t > T_E + 1.2:
            p["armL_bend"] = p.get("armL_bend", 0) + 14 * math.sin((t - T_E - 1.2) * 5.0)

    def cplace(t, p):
        b = basket(t)
        p.update(x=b.x, y=b.y, z=b.z + fz)
    tr.layer(wave)
    tr.layer(anim.breathe(0.01, 0.22))
    tr.layer(anim.blinks(times=[1.1, 3.0, 7.6], dur=0.15))
    tr.layer(cplace)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)

    # ------------------------------------------------------------------ cameras
    face = Vector((0, 0.21, eye_z))
    def aim(eye, az, el, d=10.0):
        a_, e_ = math.radians(az), math.radians(el)
        return eye + Vector((math.cos(e_) * math.cos(a_), math.cos(e_) * math.sin(a_), math.sin(e_))) * d
    eA = Vector((10.0, -13.5, -2.2))
    camA = rel_cam("CamA", f0, f1, basket, [
        (0.0, "linear", eA, aim(eA, 106, 17, 30), 18, 0),
        (T_B, "soft", eA * 0.96, aim(eA * 0.96, 106, 17, 30), 18, 0)], seed=70, shake=0.03)
    # B: low in front of Claude: its face turned up to the lantern as the star floats out toward the sky (toward us),
    # stops... and turns back to Claude
    camB = rel_cam("CamB", f0, f1, basket, [
        (T_B, "linear", Vector((-0.8, 2.5, eye_z - 0.12)), Vector((0.0, 0.35, eye_z + 0.42)), 26, 0),
        (T_C, "soft", Vector((-0.75, 2.38, eye_z - 0.1)), Vector((0.02, 0.4, eye_z + 0.36)), 26, 0)], seed=71)
    # C: Claude close, three-quarter front, past the star (soft glow at the frame edge)
    camC = rel_cam("CamC", f0, f1, basket, [
        (T_C, "linear", Vector((-0.5, 2.1, eye_z + 0.12)), face + Vector((0.3, 0, 0.02)), 36, 2.4),
        (T_D, "soft", Vector((-0.47, 1.97, eye_z + 0.1)), face + Vector((0.3, 0, 0.02)), 37, 2.4)], seed=72)
    # D: the star close, over Claude's shoulder
    camD = rel_cam("CamD", f0, f1, basket, [
        (T_D, "linear", Vector((-0.62, -0.08, eye_z + 0.17)), hover + Vector((-0.06, 0, -0.04)), 30, 2.4),
        (T_E, "soft", Vector((-0.58, -0.02, eye_z + 0.17)), hover + Vector((-0.06, 0, -0.04)), 32, 2.4)], seed=73)
    # E1: low behind Claude's shoulder, looking up along the star's climb toward the constellation's empty eye
    eE = Vector((-1.45, -0.8, eye_z + 0.06))
    camE = rel_cam("CamE", f0, f1, basket, [
        (T_E, "linear", eE, aim(eE, 70, 17), 24, 0),
        (T_E2, "soft", eE + Vector((0.05, 0.05, -0.05)), aim(eE, 73, 21), 24, 0)], seed=74)
    # E2: Claude from the front, watching it go: a bittersweet smile and a small wave
    camE2 = rel_cam("CamE2", f0, f1, basket, [
        (T_E2, "linear", Vector((-0.5, 2.4, eye_z + 0.1)), face + Vector((-0.1, 0, 0.24)), 30, 2.8),
        (dur, "soft", Vector((-0.47, 2.26, eye_z + 0.1)), face + Vector((-0.1, 0, 0.26)), 31, 2.8)], seed=79)
    for cam, t in ((camA, 0), (camB, T_B), (camC, T_C), (camD, T_D), (camE, T_E), (camE2, T_E2)):
        S.cut(cam, f0 + int(round(t * 24)))
    bpy.context.scene.camera = camA
    b0 = basket(T_C)
    scene.char_lights(c.col, b0 + Vector((0, 0, fz + 0.4)), b0 + Vector((0, 3, 0)), (-0.3, -0.8, 0.5),
                      rim_col=(0.6, 0.75, 1.0), rim_w=18.0, fill_col=(0.55, 0.65, 0.9), fill_w=6.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.4, mist_start=80.0, mist_depth=3000.0, bloom=0.75, bloom_thr=0.5,
                          vignette=0.4))
