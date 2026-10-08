"""S07 — EXT night: a meteor shower streaks over the peak. One bright streak breaks away and curves down —
straight at the windmill. Impact flash at the cap."""
import math
from mathutils import Vector
from mathutils import Matrix
from lu import world, anim, scene, props, fx, geo
from lu.anim import Track, CAM_DEFAULT

T_HERO = 0.95
T_HIT = 2.55


def screen_point(cam, f, sx, sy, depth):
    """World point seen at screen (sx, sy) (0..1, from bottom-left) at `depth` metres in front of the camera at f."""
    import bpy
    from lu.scene import W, H
    bpy.context.scene.frame_set(f)
    bpy.context.view_layer.update()
    M = cam.matrix_world
    k = cam.data.sensor_width / cam.data.lens
    v = Vector(((sx - 0.5) * k * depth, (sy - 0.5) * k * H / W * depth, -depth))
    return M @ v


def hero_streak(f0, f1, ridge, cam, cam_loc, t0=T_HERO, t1=T_HIT):
    """The one meteor that breaks from the shower: it enters at the top left of frame, arcs and curves down onto
    the windmill cap, arriving exactly at t1. The path is laid out in screen space so the whole fall reads; its
    width is scaled with distance so it never becomes a fat cone near the camera."""
    m = props.meteor_mat()
    col = geo.coll("Meteors")
    o = geo.lathe("HeroStreak", [(0.0, 0.0), (0.35, 0.6), (0.9, 0.97), (0.0, 1.0)], seg=10, collection=col, mat=m)
    o.visible_shadow = False
    import bpy
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    fh = f0 + int(round(t1 * 24))
    sc.frame_set(fh)
    bpy.context.view_layer.update()
    rs = world_to_camera_view(sc, cam, ridge)
    P0, C, P2 = Vector((0.02, 0.97)), Vector((0.34, 0.99)), Vector((rs.x, rs.y))
    heads = {}
    for f in range(f0, f1):
        t = (f - f0) / 24
        s = (t - t0) / (t1 - t0)
        if 0.0 <= s <= 1.0:
            sp = P0 * (1 - s) ** 2 + C * (2 * (1 - s) * s) + P2 * (s * s)
            dep = 420.0 * (rs.z / 420.0) ** (s ** 0.7)
            hd = screen_point(cam, f, sp.x, sp.y, dep)
            heads[f] = hd.lerp(ridge, max(0.0, (s - 0.9) / 0.1))
    for f in range(f0, f1):
        t = (f - f0) / 24
        s = (t - t0) / (t1 - t0)
        if f in heads:
            head = heads[f]
            prev = heads.get(f - 1)
            nxt = heads.get(f + 1)
            d = ((nxt if nxt is not None else head) - (prev if prev is not None else head))
            d = d.normalized() if d.length > 1e-6 else Vector((0, 0, -1))
            L = min(90.0, 6.0 + 0.5 * (head - ridge).length)
            w = min(4.0, max(0.1, (head - Vector(cam_loc)).length * 0.008))
            o.matrix_basis = Matrix.Translation(head - d * L) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4() @ \
                Matrix.Diagonal((w, w, L, 1))
            o["life"] = min(1.0, 4 * s) * 1.6
        else:
            o["life"] = 0.0
            o.matrix_basis = Matrix.Translation(ridge) @ Matrix.Diagonal((0.01, 0.01, 0.01, 1))
        o.keyframe_insert("location", frame=f)
        o.keyframe_insert("rotation_euler", frame=f)
        o.keyframe_insert("scale", frame=f)
        o.keyframe_insert('["life"]', frame=f)
    return o


def make(f0, f1):
    W = world.World("ext", "night", windmill_state=dict(window_glow=0.0, sails_angle=33.0))
    O = W.origin
    dur = (f1 - f0) / 24
    props.constellation(origin=(O.x, O.y, 0), lines=0.0)
    hit = O + Vector((0.2, 0.2, 13.0))       # inside the cap, just under its ridge (S08 continues the fall)
    ridge = O + Vector((0.2, 0.0, 13.5))     # the visible strike point on the ridge
    props.meteors(48, 0.0, dur, f0, seed=7, origin=(O.x, O.y, 0), az_range=(40, 150), el_range=(25, 70),
                  length=(110, 240), dur=(0.5, 1.0))
    from shots.h01 import bold_meteors
    bold_meteors(3.0)
    a = O + Vector((-5.5, -11.5, 0.7))
    cam = scene.camera(lens=24)
    tg = O + Vector((0.0, 3.0, 10.5))
    ct = Track(CAM_DEFAULT)
    ct.key(0, cx=a.x, cy=a.y, cz=a.z, tx=tg.x, ty=tg.y, tz=tg.z + 6, lens=22)
    ct.key(T_HIT, "inout", tx=hit.x, ty=hit.y, tz=hit.z, lens=24)
    ct.key(dur, "out", tx=hit.x, ty=hit.y, tz=hit.z - 0.5)
    ct.layer(lambda t, p: p.update(shake=0.3 + (5.0 * max(0, 1 - (t - T_HIT) / 0.6) if t > T_HIT else 0)))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=7)
    hero_streak(f0, f1, ridge, cam, a)
    # impact: a white-hot burst on the cap, a flash light just in front of it (outside the cap, toward camera)
    toward_cam = (a - ridge).normalized()
    # flash lights outside the cap: one above/in front of the ridge, one lower toward the camera (lights the tower)
    fl = scene.point("ImpactFlash", ridge + Vector((0, -3.6, 1.2)), (1.0, 0.85, 0.6), 0.0, 0.5)
    fl2 = scene.point("ImpactFlash2", ridge + toward_cam * 6.0, (1.0, 0.8, 0.55), 0.0, 0.8)
    burst = geo.lathe("ImpactBurst", [(0.0, -1.0), (0.6, -0.8), (1.0, 0.0), (0.6, 0.8), (0.0, 1.0)], seg=16,
                      mat=fx._life_emissive("BurstGlow", (1.0, 0.86, 0.6), 40.0))
    burst.visible_shadow = False
    for f in range(f0, f1):
        t = (f - f0) / 24
        u = (t - T_HIT) / 0.5
        fl.data.energy = 4000.0 * max(0.0, 1 - u) ** 2 if u >= 0 else 0.01
        fl.data.keyframe_insert("energy", frame=f)
        fl2.data.energy = 3000.0 * max(0.0, 1 - u * 1.4) ** 2 if u >= 0 else 0.01
        fl2.data.keyframe_insert("energy", frame=f)
        v = (t - T_HIT) / 0.4
        r = 0.01 if v < 0 else 0.4 + 1.6 * anim.ease("out", min(v * 3, 1.0))
        burst.location = ridge + toward_cam * 0.5 + Vector((0, 0, 0.3))
        burst.scale = (r, r, r)
        burst["life"] = 0.0 if (v < 0 or v > 1) else (1 - v) ** 1.5
        burst.keyframe_insert("location", frame=f)
        burst.keyframe_insert("scale", frame=f)
        burst.keyframe_insert('["life"]', frame=f)
    fx.sparks("CapSparks", ridge + toward_cam * 0.4, T_HIT, f0, n=50, speed=(2, 6), life=(0.4, 0.9), gravity=-6, up=0.3,
              strength=40, size=0.06, seed=3)
    fx.puff("CapDust", ridge + toward_cam * 0.3, T_HIT, f0, n=8, spread=0.6, grow=(0.4, 1.8), life=(1.0, 1.6), rise=0.4,
            color=(0.6, 0.6, 0.7), opacity=0.35, seed=2)
    return dict(post=dict(haze=W.P["haze"], haze_amt=0.5, mist_start=60.0, mist_depth=2000.0, bloom=0.8, bloom_thr=0.55,
                          bloom_size=8))
