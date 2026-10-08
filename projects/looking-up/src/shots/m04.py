"""M04 — EXT summer day: the star swoops in a big loop around the turning sails, trailing sparkles. Down below,
Claude spins on the spot trying to follow it with its eyes — and ends up dizzy, wobbling, eyes swimming.

(A) low wide from behind Claude: the windmill and its turning sails fill the frame, the star draws a glowing loop
around them while Claude (foreground) cranes its head to follow. (B) low medium on Claude's face: the star dives and
whirls round Claude's head; Claude spins on the spot after it, then (3.0) staggers dizzy, eyes swimming, while the
star hovers beside it, giggling."""
import math
import bpy
import bmesh
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, fx, windmill, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_CUT = 1.67      # two beats in: cut from the sails loop to Claude
T_DIZZY = 3.0     # the spin ends (audio: M04_dizzy)


def mow(center, radius, names=("Meadow",)):
    """Remove tall meadow cards around a spot so Claude's legs and the low camera's foreground read."""
    c = Vector(center)
    for nm in names:
        for o in [o for o in bpy.data.objects if o.name.startswith(nm) and o.type == "MESH"]:
            bm = bmesh.new()
            bm.from_mesh(o.data)
            mw = o.matrix_world
            dead = [f for f in bm.faces if ((mw @ f.calc_center_median()) - c).to_2d().length < radius]
            bmesh.ops.delete(bm, geom=dead, context="FACES")
            bm.to_mesh(o.data)
            bm.free()


def glow_trail(name, pos_fn, t0, t1, f0, step=1 / 40, life=0.75, size=0.07, strength=26.0, drop=0.25, color=(1.0, 0.78, 0.35),
               t_kill=None):
    """A comet trail: glowing dabs left along the star's path, each fading over `life` seconds."""
    m = fx._life_emissive(name + "Mat", color, strength)
    col = bpy.data.collections.get("FX") or bpy.context.scene.collection
    t = t0
    k = 0
    while t < t1:
        p = pos_fn(t)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size)
        o = bpy.context.active_object
        o.name = f"{name}{k}"
        for cc in o.users_collection:
            cc.objects.unlink(o)
        col.objects.link(o)
        o.data.materials.append(m)
        o.visible_shadow = False
        fa, fb = f0 + int(t * 24) - 1, f0 + int((t + life) * 24) + 1
        for f in range(fa, fb + 1):
            u = (f - f0) / 24 - t
            if u < 0:
                o["life"] = 0.0
                o.scale = (0.001,) * 3
                o.location = p
            else:
                w = max(0.0, 1 - u / life)
                if t_kill is not None and (f - f0) / 24 >= t_kill:
                    w = 0.0
                o["life"] = w ** 1.6
                s = 0.35 + 0.65 * w
                o.scale = (s, s, s)
                o.location = p + Vector((0, 0, -drop * u * u))
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        t += step
        k += 1


def make(f0, f1):
    W = world.World("ext", "day", sun_dir=(0.72, 0.3, 0.63), windmill_state=dict(sails_angle=40.0))
    O = W.origin
    dur = (f1 - f0) / 24
    hub = W.wm["hub"]
    for f in range(f0, f1):
        windmill.sails_set_angle(hub, 40.0 + 14.0 * (f - f0) / 24)
        hub.keyframe_insert("rotation_euler", frame=f)
    cx, cy = 3.0, -12.5
    gz = W.ground(cx, cy)
    C = Vector((cx, cy, gz))
    mow(C + Vector((-0.2, 0.0, 0)), 3.7)
    W.grass_patch((cx, cy), 3.9, 20000, blade=(0.05, 0.13), flowers=0.035, seed=41)
    # ---------------------------------------------------------------- the star's flight
    centre = O + Vector((0.6, -7.6, 7.9))       # round the sails' lower half, tilted: top behind them, bottom forward
    R = 4.4
    orb_c = C + Vector((0, 0, 0.84))            # the whirl round Claude's head
    orb_r = 0.85
    eB = C + Vector((-0.45, 2.9, 0.5))          # camera B: the reverse, north of Claude looking out to the clouds
    rest = C + Vector((-0.66, -0.05, 0.74))       # where the star ends: beside Claude's head, screen right

    def loop_pt(t):
        a = math.radians(-25) + 2 * math.pi * anim.ease("inout", min(t / 1.75, 1.0)) * 1.08
        return centre + Vector((math.cos(a) * R, 1.8 * math.sin(a), math.sin(a) * R))

    def orbit_pt(t):
        # 1.25 turns, starting on the camera side of Claude, slowing toward the end (ends screen right)
        u = anim.ease("out", (t - 2.05) / (T_DIZZY - 2.05))
        a = math.radians(90) + 2 * math.pi * 1.25 * u
        return orb_c + Vector((math.cos(a) * orb_r, math.sin(a) * orb_r, 0.12 * math.sin(3 * a)))

    def star_pos(t):
        if t <= 1.75:
            return loop_pt(t)
        if t <= 2.05:          # the dive from the loop down to Claude
            u = anim.ease("inout", (t - 1.75) / 0.3)
            a, b = loop_pt(1.75), orbit_pt(2.05)
            mid = (a + b) / 2 + Vector((0.8, 0.0, 2.0))
            return a.lerp(mid, u).lerp(mid.lerp(b, u), u)
        if t <= T_DIZZY:
            return orbit_pt(t)
        u = anim.ease("inout", (t - T_DIZZY) / 0.45)
        return orbit_pt(T_DIZZY).lerp(rest, u) + Vector((0, 0, 0.035 * math.sin(t * 7)))

    s = W.star()
    s.light_scale = 3.0
    st = Track()
    st.pose(0.0, S.merge(S.S_JOY, glow=1.7, arms=55))
    st.key(T_DIZZY, "linear", eye_happy=0.95, arms=55)
    st.key(T_DIZZY + 0.4, "inout", eye_happy=1.0, arms=30, legs=20, head=-6, glow=1.6)
    st.key(dur, "soft", eye_happy=1.0, arms=36)

    def follow(t, p):
        q = star_pos(t)
        p["x"], p["y"], p["z"] = q.x, q.y, q.z
        if t < T_DIZZY + 0.2:
            d = star_pos(t + 0.04) - q
            p["heading"] = math.degrees(math.atan2(d.x, -d.y))
            p["spin"] = t * 260
            p["roll"] = p.get("roll", 0) + 25 * math.sin(t * 6)
        else:
            # hover facing Claude / camera, giggling (rocking)
            p["heading"] = S.heading_to((q.x, q.y), (eB.x, eB.y)) + 35
            p["roll"] = 12 * math.sin((t - T_DIZZY) * 13)
            p["squash"] = p.get("squash", 0) + 0.06 * math.sin((t - T_DIZZY) * 26)
    st.layer(follow)
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    glow_trail("LoopTrail", star_pos, 0.05, 1.72, f0, step=1 / 96, life=0.9, size=0.15, t_kill=T_CUT)
    glow_trail("OrbitTrail", star_pos, 1.95, T_DIZZY, f0, step=1 / 72, life=0.45, size=0.022, drop=0.1)
    # left-over sparkles still circling Claude's head once it stops: the cartoon "seeing stars"
    halo = fx._life_emissive("DizzyMat", (1.0, 0.62, 0.15), 9.0)
    for k in range(5):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.021)
        o = bpy.context.active_object
        o.name = f"DizzySpark{k}"
        o.data.materials.append(halo)
        o.visible_shadow = False
        for f in range(f0 + int((T_DIZZY - 0.05) * 24), f1):
            u = (f - f0) / 24 - T_DIZZY
            a = 2 * math.pi * (k / 5 + 1.1 * u)
            hc = C + Vector((0.0, 0.0, 0.8))
            o.location = hc + Vector((math.cos(a) * 0.34, math.sin(a) * 0.28, 0.04 * math.sin(a * 2 + k)))
            o["life"] = max(0.0, min(1.0, u / 0.2, (dur - 0.05 - (f - f0) / 24) / 0.5)) * (0.75 + 0.25 * math.sin(u * 20 + k))
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert('["life"]', frame=f)
    for k in range(10):
        t = 0.2 + k * 0.28
        fx.sparks(f"Trail{k}", star_pos(t), t, f0, n=4, speed=(0.2, 0.6), life=(0.4, 0.8), gravity=-0.8, up=0.2,
                  strength=18, size=0.02, seed=100 + k)
    # ---------------------------------------------------------------- Claude
    c = W.claude()
    tr = Track()
    look_up = dict(x=cx, y=cy, z=gz, lean=-18, head_nod=-14, eye_open=1.0, pupil=1.12, armL_up=5, armR_up=5, armL_fwd=15,
                   armR_fwd=15, eye_happy=0.0, legs_splay=0.0, squash=0.0)
    tr.pose(0.0, look_up)
    tr.key(T_DIZZY - 0.15, "linear", lean=-12, head_nod=-10)
    tr.key(T_DIZZY + 0.25, "out", lean=4, head_nod=4, eye_open=0.8, pupil=1.0, armL_up=28, armR_up=22, armL_fwd=20,
           armR_fwd=-10, legs_splay=9, eye_happy=0.25, squash=-0.04)
    tr.key(dur, "soft", lean=2, armL_up=36, armR_up=14, eye_happy=0.35, legs_splay=11)
    hd_face = S.heading_to((cx, cy), (eB.x, eB.y))

    def star_heading(t):
        q = star_pos(t)
        return math.degrees(math.atan2(q.x - cx, -(q.y - cy)))

    # unwrap the heading so Claude turns continuously after the star (with a little lag)
    hs, prev, acc = {}, None, 0.0
    for i in range(int(dur * 24) + 30):
        t = i / 24
        h = star_heading(max(0.0, t - 0.1))
        if prev is not None:
            dh = (h - prev + 180) % 360 - 180
            acc += dh
        else:
            acc = h
        prev = h
        hs[i] = acc
    h_end = hs[int(T_DIZZY * 24)]
    h_target = hd_face + 360 * round((h_end - hd_face) / 360)

    def spin(t, p):
        i = int(round(t * 24))
        if t <= T_DIZZY:
            p["heading"] = hs[i]
        else:
            # momentum carries it past, then it sways back and forth, unable to settle
            u = t - T_DIZZY
            p["heading"] = h_target + (h_end - h_target) * math.exp(-4 * u) + 22 * math.sin(u * 5.5) * min(1, u * 3)
        if t < T_DIZZY + 0.1:
            # quick little stepping feet while turning
            ph = t * 16
            for k in range(4):
                off = 0 if k in (0, 2) else math.pi
                p[f"leg{k}_swing"] = p.get(f"leg{k}_swing", 0) + 16 * math.sin(ph + off)
            p["hop"] = p.get("hop", 0) + 0.012 * abs(math.sin(ph))
            p["roll"] = p.get("roll", 0) + 4 * math.sin(ph * 0.5)
        else:
            u = t - T_DIZZY
            w = min(1.0, u / 0.3)
            # wobbling in a slow circle, the head lolling the other way
            p["roll"] = p.get("roll", 0) + 13 * w * math.sin(u * 6.0)
            p["lean"] = p.get("lean", 0) + 9 * w * math.cos(u * 6.0)
            p["head_tilt"] = p.get("head_tilt", 0) - 12 * w * math.sin(u * 6.0 - 0.8)
            p["leg0_swing"] = p.get("leg0_swing", 0) + 14 * w * math.sin(u * 6.0)
            p["leg3_swing"] = p.get("leg3_swing", 0) - 14 * w * math.sin(u * 6.0)

    tr.layer(spin)

    def eyes_follow(t, p):
        if t <= T_DIZZY:
            q = star_pos(t)
            lp = S.look_params((cx, cy), p["heading"] + p.get("head_turn", 0), gz + 0.57, q)
            p["look_x"] = lp["look_x"]
            p["look_y"] = max(lp["look_y"], 0.2)
    tr.layer(eyes_follow)
    tr.layer(anim.breathe(0.012, 0.4))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # eyes swimming: each eye circles on its own, opposite ways, lids uneven
    for f in range(f0 + int(T_DIZZY * 24), f1):
        u = (f - f0) / 24 - T_DIZZY
        w = min(1.0, u / 0.25)
        for e, sg, ph in ((c.eyes[0], 1, 0.0), (c.eyes[1], -1, 1.3)):
            e["look_x"] = 1.5 * w * math.cos(u * 9 * sg + ph)
            e["look_y"] = 1.3 * w * math.sin(u * 9 * sg + ph)
            e["eye_open"] = 0.72 + 0.2 * math.sin(u * 4 + ph * 2)
            e["eye_tilt"] = 0.45 * sg * math.sin(u * 3.5)
            e["eye_round"] = 0.12 + 0.25 * w
            e["eye_happy"] = 0.0
            e["pupil"] = 0.92 + 0.16 * math.sin(u * 7 + ph)
            for k in ("look_x", "look_y", "eye_open", "eye_tilt", "eye_round", "eye_happy", "pupil"):
                e.keyframe_insert(f'["{k}"]', frame=f)
    # ---------------------------------------------------------------- cameras
    # A: low behind Claude, the windmill and the loop above; Claude bottom-left foreground, head craned up
    eA = C + Vector((1.15, -1.75, 0.17))
    hA = (centre - eA).to_2d().length
    tA = Vector((centre.x - 1.2, centre.y, eA.z + hA * math.tan(math.radians(20.5))))
    camA = scene.camera("CamA", lens=16)
    ct = Track(CAM_DEFAULT)
    ct.key(0, cx=eA.x, cy=eA.y, cz=eA.z, tx=tA.x, ty=tA.y, tz=tA.z, lens=16, fstop=0, shake=0.12)
    ct.key(T_CUT, "inout", cx=eA.x - 0.08, cy=eA.y + 0.18, cz=eA.z + 0.02, tx=tA.x, ty=tA.y, tz=tA.z - 0.3, lens=16.5, shake=0.12)
    anim.bake_camera(camA, ct, f0, f1 - 1, seed=24)
    # B: low in front of Claude, the windmill soft behind it
    tB = C + Vector((-0.3, 0, 0.62))
    camB = scene.camera("CamB", lens=30)
    cb = Track(CAM_DEFAULT)
    fd = (C + Vector((0, 0, 0.5)) - eB).length
    cb.key(0, cx=eB.x, cy=eB.y, cz=eB.z, tx=tB.x, ty=tB.y, tz=tB.z + 0.1, lens=30, fstop=4.0, focus=fd, shake=0.2)
    cb.key(T_DIZZY, "inout", tz=tB.z + 0.1, lens=30)
    e2 = eB + (tB - eB).normalized() * 0.5
    cb.key(dur, "soft", cx=e2.x, cy=e2.y, cz=e2.z, tz=tB.z + 0.04, lens=34, focus=fd - 0.5)
    anim.bake_camera(camB, cb, f0, f1 - 1, seed=25)
    S.cut(camA, f0)
    S.cut(camB, f0 + int(T_CUT * 24))
    bpy.context.scene.camera = camA
    scene.char_lights(c.col, C + Vector((0, 0, 0.45)), eB, W.P["sun_dir"], rim_col=(1.0, 0.95, 0.85), rim_w=60.0,
                      fill_col=(1.0, 0.86, 0.7), fill_w=160.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.45, mist_start=80.0, mist_depth=2500.0, bloom=0.45, bloom_thr=0.8,
                          vignette=0.3))
