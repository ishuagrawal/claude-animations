"""M09 — EXT winter day, snow on the peak: Claude winds up and lobs a snowball at the star. The star flares hot — the
snowball melts to a puff of steam midair. Claude bursts out laughing (bouncing, eyes squeezed happy); the star, cheeky.

Staged as a two-shot in the snowy yard, both characters cheated toward camera, the windmill's stone base behind so the
snowball and the (star-lit, warm) steam puff read; the camera then drifts in on Claude's laugh."""
import math
import bpy
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, fx, geo, mat, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF
from lu.star import DEFAULT as S_DEF
from shots.m01 import settle

T_THROW = 1.0
T_MELT = 1.6


def hand_local(c, bone, pose):
    """Tip of `bone` (character-local metres, character at the origin, heading 0) in `pose`."""
    p = dict(pose)
    p.update(x=0.0, y=0.0, z=0.0, heading=0.0, hop=0.0)
    c.apply(p)
    bpy.context.view_layer.update()
    pb = c.rig.pose.bones[bone]
    return c.rig.matrix_world @ pb.tail


def make(f0, f1):
    W = world.World("ext", "winter", season="winter", sun_dir=(0.55, -0.62, 0.42), windmill_state=dict(sails_angle=8.0))
    O = W.origin
    dur = (f1 - f0) / 24
    M = Vector((1.4, -2.6, 0))
    cx, cy = M.x - 0.92, M.y
    gz = W.ground(cx, cy)
    sx, sy = M.x + 0.85, M.y - 0.55
    sz = W.ground(sx, sy) + 0.8
    c = W.claude()
    snow_m = mat.painterly("Snowball", (0.92, 0.94, 1.0), stroke="strokes_soft", scale=8, tex_amt=0.6, snow=0.0)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.075)
    sb = bpy.context.active_object
    sb.name = "Snowball"
    sb.data.materials.append(snow_m)
    sb.data.shade_smooth()
    hd = S.heading_to((cx, cy), (sx, sy)) - 32          # cheated toward camera
    # wind-up with the near (right) arm: arm cocked up and back, body coiled away from the target
    windup = dict(armR_up=85, armR_fwd=-45, armR_bend=40, lean=-8, twist=-12, squash=-0.06)
    hand = hand_local(c, "armR2", windup)
    S.attach(sb, c, "armR2", Matrix.Translation(hand + Vector((-0.05, 0.0, 0.03))), pose=windup)
    tr = Track()
    tr.pose(0.0, S.merge(dict(armR_up=20, armR_fwd=10, armL_up=-10), x=cx, y=cy, z=gz, heading=hd, eye_tilt=-0.2,
                         eye_open=0.9, look_x=-0.3, look_y=0.1, eye_happy=0.3, twist=0, lean=0, squash=0, pupil=1.0,
                         head_tilt=0, armR_bend=0, armL_bend=0))
    # (0.55 crunch) gathers itself, cocks the arm: a sly, determined squint at the star
    tr.key(0.6, "inout", **S.merge(windup, eye_tilt=-0.5, eye_open=0.72, eye_happy=0.0, look_x=-0.45))
    tr.key(T_THROW - 0.08, "in", armR_up=95, armR_fwd=-55, twist=-16, lean=-11, squash=-0.08)
    # the lob (1.0): body uncoils, arm whips through
    tr.key(T_THROW + 0.18, "snap", armR_fwd=75, armR_up=35, armR_bend=-10, twist=14, lean=14, squash=0.07, eye_tilt=-0.2,
           eye_open=0.95)
    tr.key(T_THROW + 0.45, "out", armR_up=0, armR_fwd=40, twist=6, lean=6, squash=0.0, eye_tilt=0.0, pupil=1.12,
           look_x=-0.45, look_y=0.15)
    # the melt (1.6): a startled jolt...
    tr.key(T_MELT + 0.15, "snap", squash=0.12, eye_open=1.0, pupil=1.25, armL_up=40, armR_up=40, lean=-6, twist=0)
    # ...then it bursts out laughing: eyes squeezed, arms flung up, rocking back
    tr.key(T_MELT + 0.5, "out", **S.merge(S.C_HAPPY, eye_happy=1.0, eye_open=1.0, armL_up=62, armR_up=62, armL_bend=20,
                                          armR_bend=20, armR_fwd=0, lean=-14, squash=0.08, head_tilt=8, pupil=1.0,
                                          look_x=-0.2, look_y=0.2, twist=0))
    tr.key(dur, "linear", eye_happy=1.0, lean=-10, head_tilt=-6, armL_up=55, armR_up=70)

    def laugh(t, p):
        if t > T_MELT + 0.32:
            u = t - (T_MELT + 0.4)
            w = min(1.0, (t - T_MELT - 0.32) / 0.2)
            # bounces land on the crunches (2.0, 2.33, 2.66 ...)
            b = abs(math.sin(math.pi * (t - 2.0) / 0.33))
            p["hop"] = p.get("hop", 0) + 0.055 * w * b
            p["squash"] = p.get("squash", 0) + 0.06 * w * (b - 0.5)
            p["roll"] = p.get("roll", 0) + 6 * w * math.sin(u * 4.5)
            p["armL_up"] = p.get("armL_up", 0) + 10 * w * math.sin(u * 9.5)
            p["armR_up"] = p.get("armR_up", 0) + 10 * w * math.sin(u * 9.5 + 1)
    tr.layer(laugh)
    tr.layer(anim.blinks(times=[0.3], dur=0.14))
    settle(tr, C_DEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    # free-flying snowball after release: from the hand to just short of the star, in an arc
    f_rel = f0 + int((T_THROW + 0.12) * 24)
    bpy.context.scene.frame_set(f_rel)
    bpy.context.view_layer.update()
    p0 = sb.matrix_world.translation.copy()
    fly = sb.copy()
    fly.data = sb.data
    bpy.context.scene.collection.objects.link(fly)
    fly.parent = None
    tgt = Vector((sx, sy, sz))
    p1 = tgt - (tgt - p0).normalized() * 0.38
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = min(max((t - T_THROW - 0.12) / (T_MELT - T_THROW - 0.12), 0), 1)
        fly.location = p0.lerp(p1, u) + Vector((0, 0, 0.55 * math.sin(math.pi * u)))
        k = max(0.02, 1 - max(0.0, (t - T_MELT + 0.1) / 0.14))
        fly.scale = (k, k, k)
        fly.rotation_euler = (t * 9, t * 5, 0)
        fly.keyframe_insert("location", frame=f)
        fly.keyframe_insert("scale", frame=f)
        fly.keyframe_insert("rotation_euler", frame=f)
    S.vis_range(sb, f0, f_rel, f0, f1)
    S.vis_range(fly, f_rel, f0 + int((T_MELT + 0.06) * 24), f0, f1)
    fx.puff("Steam", p1, T_MELT - 0.02, f0, n=12, spread=0.07, grow=(0.05, 0.2), life=(0.8, 1.4), rise=0.25,
            color=(1.0, 0.86, 0.7), opacity=0.6, seed=91, emit=0.35)
    fx.sparks("MeltSparks", p1, T_MELT - 0.02, f0, n=16, speed=(0.4, 1.3), life=(0.2, 0.45), gravity=-1, strength=18,
              size=0.012, seed=92)
    # the star: watches, braces, flares white-hot to vaporise the snowball, then a cheeky little victory wiggle
    s = W.star()
    s.light_scale = 3.0
    hs = S.heading_to((sx, sy), (cx, cy)) + 32          # cheated toward camera
    st = Track()
    st.pose(0.0, S.merge(S.S_HAPPY, x=sx, y=sy, z=sz, heading=hs, glow=1.3, look_x=0.35, eye_happy=0.4, eye_tilt=0.0,
                         curl=0, squash=0, legs=0, pupil=1.0, eye_open=1.0, look_y=0.0, roll=0))
    st.key(T_THROW + 0.1, "inout", eye_happy=0.0, pupil=1.2, eye_open=1.0, look_y=0.25, squash=0.05)
    st.key(T_MELT - 0.1, "in", glow=1.4, squash=-0.12, curl=10, eye_tilt=-0.5, eye_open=0.8, pupil=1.0)
    st.key(T_MELT + 0.05, "snap", glow=3.4, squash=0.16, curl=-8, arms=35, legs=15, eye_tilt=-0.6, eye_open=0.75)
    st.key(T_MELT + 0.55, "out", **S.merge(S.S_JOY, glow=1.6, eye_happy=0.85, eye_tilt=-0.2, roll=12, look_x=0.5,
                                          curl=0, arms=20, legs=0))
    # ...and swaggers over to gloat right beside the laughing Claude
    gl = Vector((cx, cy, gz)) + Vector((0.92, -0.62, 0.66))
    cam_end = Vector((cx, cy, gz)) + Vector((0.95, -2.3, 0.58))
    st.key(T_MELT + 0.7, "linear", x=sx, y=sy, z=sz, heading=hs)
    st.key(T_MELT + 1.4, "inout", x=gl.x, y=gl.y, z=gl.z, heading=S.heading_to((gl.x, gl.y), (cam_end.x, cam_end.y)) + 35)
    st.key(dur, "soft", roll=-8, eye_happy=0.9)

    def hover(t, p):
        p["z"] = p.get("z", 0) + 0.035 * math.sin(t * 2.4)
        if t > T_MELT + 0.5:
            u = t - T_MELT - 0.5
            p["roll"] = p.get("roll", 0) + 10 * math.sin(u * 7)          # a smug little wiggle
            p["p1"] = p.get("p1", 0) + 12 * math.sin(u * 7 + 1)
    st.layer(hover)
    st.layer(anim.blinks(times=[0.7, 2.8], dur=0.13))
    settle(st, S_DEF)
    s.bake(lambda f: st.at((f - f0) / 24), f0, f1 - 1)
    # camera: two-shot from the south, low, the windmill's stone base behind; drifts in on Claude for the laugh
    mid = Vector(((cx + sx) / 2, (cy + sy) / 2, gz + 0.52))
    e0 = mid + Vector((0.2, -3.25, 0.12))
    t0 = mid + Vector((0.0, 0.0, 0.2))
    ch = Vector((cx, cy, gz + 0.48))
    e1 = ch + Vector((0.95, -2.3, 0.1))
    t1 = ch + Vector((0.55, 0.0, 0.1))
    cam = scene.camera("Cam", lens=35)
    ct = Track(CAM_DEFAULT)
    ct.key(0, cx=e0.x, cy=e0.y, cz=e0.z, tx=t0.x, ty=t0.y, tz=t0.z, lens=35, fstop=4.0, focus=(t0 - e0).length, shake=0.15)
    ct.key(T_MELT + 0.25, "linear", cx=e0.x, cy=e0.y, cz=e0.z, tx=t0.x, ty=t0.y, tz=t0.z, lens=35, focus=(t0 - e0).length)
    ct.key(dur, "inout", cx=e1.x, cy=e1.y, cz=e1.z, tx=t1.x, ty=t1.y, tz=t1.z, lens=38, focus=(ch - e1).length)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=31)
    scene.char_lights(c.col, Vector((cx, cy, gz + 0.4)), e0, W.P["sun_dir"], rim_col=(1.0, 0.95, 0.9), rim_w=40.0)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.4, mist_start=70.0, mist_depth=2200.0, bloom=0.35, bloom_thr=0.9,
                          exposure=-0.25, sat=1.1))
