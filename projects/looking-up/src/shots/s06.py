"""S06 — INT night: Claude asleep on its back under the quilt, slow breathing. Faint flickers of cold light leak
through the closed shutters (meteors outside, unseen): thin slats of blue light sweep across the sleeping face."""
import math
from mathutils import Vector, Matrix
from lu import world, anim, scene, stage as S, interior
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as CDEF


def anchor(tr, defaults):
    """anim.Track gives a channel its FIRST key's value for all time before that key: key every channel that is
    first keyed later in the shot with its default at t=0 (same as shots.d01.anchor). Call after all keys."""
    missing = {k: defaults[k] for k, ks in tr._chan().items() if ks[0][0] > 1e-6 and k in defaults}
    if missing:
        tr.key(0.0, "linear", **missing)
    return tr


def face_light(c, at, target, energy=30.0, col=(1.0, 0.68, 0.42), size=1.0, name="FaceLight"):
    """Soft warm area light at `at` aimed at `target`, light-linked to the character only."""
    import bpy
    ld = bpy.data.lights.new(f"{name}_{c.rig.name}", "AREA")
    ld.energy = energy
    ld.color = col
    ld.size = size
    ld.use_shadow = False
    ob = bpy.data.objects.new(ld.name, ld)
    bpy.context.scene.collection.objects.link(ob)
    scene.look_at(ob, at, target)
    ob.light_linking.receiver_collection = c.col
    return ob


def bed_pose(W, c, roll=0.0, recline=0.0):
    """Lying on its back in the bed; returns base pose dict (world). roll (deg) turns the body onto its side toward
    the room (+X), recline (deg) props the head end up on the pillow."""
    O = W.origin
    bp = W.I["bed"]["pos"]
    from lu.claude import DEPTH, S as SC
    hw, hd = 0.35, DEPTH / 2 * SC
    r = math.radians(abs(roll))
    lift = 0.6 * max(0.0, hw * math.sin(r) + hd * math.cos(r) - hd)
    return dict(x=O.x + bp[0], y=O.y + bp[1] - 0.55, z=O.z + 0.61 + DEPTH / 2 * SC + lift, heading=0.0,
                tilt_x=-90.0 + recline, tilt_y=roll,
                armL_up=-12, armR_up=-12, leg0_swing=-10, leg1_swing=-10, leg2_swing=-10, leg3_swing=-10)


def quilt_over(W, top_y=-0.07, roll=0.0, recline=0.0, thick=False):
    """Replace the flat quilt with one draped over Claude's body (lying on its back), ending just below its eyes.
    roll / recline match bed_pose so the drape follows the body; the skirts stay on the mattress. thick=True drapes
    a fuller quilt that clears the body's corners and arms (no poke-through) and hangs over the bed sides."""
    import bpy, numpy as np
    from lu import geo
    from lu.claude import DEPTH, S as SC
    I = W.I
    old = I["bed"]["quilt"]
    m = old.data.materials[0]
    old.hide_render = True
    bp = I["bed"]["pos"]
    nx, ny = 22, 26
    y0, y1 = -0.92, top_y
    piv = Vector((bp[0], bp[1] - 0.55, 0.61 + DEPTH / 2 * SC))
    R = Matrix.Rotation(math.radians(roll), 3, "Y") @ Matrix.Rotation(math.radians(recline), 3, "X")
    hw, hd = 0.35, DEPTH / 2 * SC
    rr = math.radians(abs(roll))
    lift = 0.6 * max(0.0, hw * math.sin(rr) + hd * math.cos(rr) - hd)
    verts, faces, rest = [], [], []
    if thick:
        nx, ny = 30, 30
    ss = lambda e0, e1, a: (lambda k: k * k * (3 - 2 * k))(min(max((a - e0) / (e1 - e0), 0.0), 1.0))
    for j in range(ny + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / ny
            y = y0 + (y1 - y0) * v
            if thick:
                x = (u - 0.5) * 1.34
                ax = abs(x)
                body = 1.0 - ss(0.47, 0.6, ax)
                z = 0.62 + 0.47 * body - 0.2 * ss(0.5, 0.67, ax)
                z += 0.012 * math.sin(u * 17 + v * 9) * body + 0.008 * math.sin(v * 31) * body
                z += 0.015 * ss(0.85, 1.0, v) * body          # the turned-down edge under the chin
            else:
                x = (u - 0.5) * 1.02
                body = max(0.0, 1 - (abs(x) / 0.4) ** 4)
                hump = 0.43 * body ** 0.35
                edge = 0.03 * math.sin(u * 17 + v * 9)
                z = 0.62 + hump + edge * body - 0.08 * (1 - body) * (abs(x) > 0.46)
                z += 0.012 * math.sin(v * 31) * body
            p = Vector((bp[0] + x, bp[1] + y, z))
            if roll or recline:
                q = piv + R @ (p - piv) + Vector((0, 0, lift))
                w = body ** 0.5
                p = p.lerp(q, w)
                p.z = max(p.z, 0.6 if abs(x) < 0.45 else 0.42)
            verts.append(tuple(p))
            rest.append((x * 2, y * 2, 0))
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    q = geo.obj_from("QuiltDraped", verts, faces, None, m)
    q.data.attributes.new("rest", "FLOAT_VECTOR", "POINT").data.foreach_set("vector", np.array(rest).ravel())
    q.parent = I["root"]
    return q


def bed_camera(W, f0, f1, name="Cam", lens=40, push=0.0, fstop=2.8, raise_=0.0):
    """Camera at the foot of the bed looking at Claude's face (upright on screen)."""
    from lu import anim
    bp = W.I["bed"]["pos"]
    O = W.origin
    e0 = O + Vector((bp[0] + 0.35, bp[1] - 1.25, 2.05 + raise_))
    tg = O + Vector((bp[0], bp[1] - 0.08, 1.0 + raise_ * 0.6))
    e1 = e0 + (tg - e0).normalized() * push
    cam = scene.camera(name, lens=lens)
    ct = Track(CAM_DEFAULT)
    ct.key(0, cx=e0.x, cy=e0.y, cz=e0.z, tx=tg.x, ty=tg.y, tz=tg.z, lens=lens, fstop=fstop)
    ct.key((f1 - f0) / 24, "soft", cx=e1.x, cy=e1.y, cz=e1.z, tx=tg.x, ty=tg.y, tz=tg.z, lens=lens + 4, fstop=fstop)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=f0)
    return cam


def face_point(c, frame):
    """World centre of Claude's eyes and its face normal at a frame (after baking)."""
    import bpy
    sc = bpy.context.scene
    sc.frame_set(frame)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    pts, nrm = [], Vector()
    for e in c.eyes:
        ev = e.evaluated_get(dg)
        me = ev.to_mesh()
        pts.append(sum((ev.matrix_world @ v.co for v in me.vertices), Vector()) / len(me.vertices))
        nrm += ev.matrix_world.to_3x3() @ me.polygons[0].normal
        ev.to_mesh_clear()
    return (pts[0] + pts[1]) / 2, nrm.normalized()


def slat_lights(W, f0, f1, flashes, target, name="Slat", win=-45, n=3, energy=900.0, sweep=4.0,
                col=(0.38, 0.55, 1.0)):
    """Thin slit spots from just inside a shuttered window (light leaking through the board gaps), aimed at
    `target`; each flash (t, amp) sweeps the slats a few degrees, like a meteor crossing outside."""
    import bpy
    O = W.origin
    a = math.radians(win)
    nrm = Vector((math.cos(a), math.sin(a), 0))
    tng = Vector((-nrm.y, nrm.x, 0))
    out = []
    for k in range(n):
        u = (k - (n - 1) / 2) * 0.11
        src = O + nrm * (interior.RI - 0.08) + tng * u + Vector((0, 0, 1.3 + 0.04 * k))
        ld = bpy.data.lights.new(f"{name}{win}_{k}", "SPOT")
        ld.color = col
        ld.spot_size = math.radians(9.0)
        ld.spot_blend = 0.15
        ld.shadow_soft_size = 0.0
        ld.use_shadow = True
        ob = bpy.data.objects.new(ld.name, ld)
        bpy.context.scene.collection.objects.link(ob)
        ob.scale = (0.035, 1.0, 1.0)
        aim0 = Vector(target) + tng * (u * 1.4)
        for f in range(f0, f1):
            t = (f - f0) / 24
            e, sw = 0.0, 0.0
            for (ts, amp) in flashes:
                v = (t - ts) / 0.45
                if 0 <= v <= 1:
                    e += amp * math.sin(math.pi * v) ** 2
                    sw = (v - 0.5) * sweep
            d = (aim0 - src)
            d = Matrix.Rotation(math.radians(sw), 3, "Z") @ d
            ob.location = src
            ob.rotation_mode = "QUATERNION"
            ob.rotation_quaternion = d.to_track_quat("-Z", "Y")
            ld.energy = energy * e + 0.01
            ob.keyframe_insert("location", frame=f)
            ob.keyframe_insert("rotation_quaternion", frame=f)
            ld.keyframe_insert("energy", frame=f)
        out.append(ob)
    return out


ROLL, RECLINE = 8.0, 12.0
CAM_ROLL = -3.0
FLASHES = ((0.6, 0.65), (1.5, 0.45), (2.1, 1.0), (2.75, 0.6))


def make(f0, f1):
    W = world.World("int", "night", interior_state=dict())
    O = W.origin
    L = lambda x, y, z=0.0: O + Vector((x, y, z))
    dur = (f1 - f0) / 24
    for p in W.I["win_front"][1] + W.I["win_side"][1]:
        interior.set_ishutter(p, 0.0)
    pr = W.practicals(stove=1.6)
    c = W.claude()
    quilt_over(W, top_y=-0.15, roll=ROLL, recline=RECLINE, thick=True)
    base = bed_pose(W, c, roll=ROLL, recline=RECLINE)
    tr = Track()
    tr.pose(0.0, base, **S.merge(S.C_SLEEP, pupil=1.25, head_tilt=-4))
    # the brightest flash makes it stir: a small settle of the head, then still again
    tr.key(2.15, "inout", head_tilt=-4, head_turn=0, squash=-0.03)
    tr.key(2.45, "inout", head_tilt=-9, head_turn=-5, squash=-0.05)
    tr.key(3.2, "soft", head_tilt=-7, head_turn=-4, squash=-0.035)
    tr.layer(anim.breathe(0.025, 0.22))
    anchor(tr, CDEF)
    c.bake(lambda f: tr.at((f - f0) / 24), f0, f1 - 1)
    face, fn = face_point(c, f0 + 30)
    # flickers through the shutter gaps: cold lights just outside both windows (they edge the shutters) ...
    for a_deg, name in ((-45, "FlickA"), (45, "FlickB")):
        a = math.radians(a_deg)
        p = Vector((math.cos(a), math.sin(a), 0)) * 3.4 + Vector((0, 0, 1.45))
        l = scene.point(name, O + p, (0.7, 0.8, 1.0), 0.0, 0.05)
        for f in range(f0, f1):
            t = (f - f0) / 24
            e = 0.0
            for (ts, amp) in ((0.6, 40), (1.5, 25), (2.1, 60), (2.75, 35)):
                if a_deg > 0:
                    ts += 0.25
                u = (t - ts) / 0.35
                if 0 <= u <= 1:
                    e += amp * math.sin(math.pi * u) ** 2
            l.data.energy = e + 0.01
            l.data.keyframe_insert("energy", frame=f)
    # ... and the slats of light that leak through the board gaps onto the bed
    slat_lights(W, f0, f1, FLASHES, face + Vector((0, 0, 0.05)), win=-45, n=3, energy=2400.0)
    slat_lights(W, f0, f1, tuple((t + 0.25, a * 0.6) for t, a in FLASHES), face + Vector((0, 0.25, 0.25)), win=45,
                n=2, energy=1000.0, sweep=-4.0)
    moon = scene.point("Moonfill", L(0.0, -1.0, 3.0), (0.4, 0.5, 0.8), 3.0, 1.0)
    # high three-quarter view from the foot of the bed: the sleeping face on the pillow (left), the stove and the
    # flour sacks glowing beyond (right) - where the star will land. A slow creeping push onto the face.
    cam = scene.camera("Cam", lens=32)
    d0 = Vector((0.22, -0.7, 0.68)).normalized()
    side = Vector((1.0, 0.0, 0.0))
    e0 = face + d0 * 1.85
    tg0 = face + Vector((0.0, 0.03, 0.01)) + side * 0.33
    e1 = face + d0 * 1.4
    tg1 = face + Vector((0.0, 0.02, 0.0)) + side * 0.2
    ct = Track(CAM_DEFAULT)
    ct.key(0, cx=e0.x, cy=e0.y, cz=e0.z, tx=tg0.x, ty=tg0.y, tz=tg0.z, lens=32, fstop=2.8,
           focus=(face - e0).length, roll=CAM_ROLL)
    ct.key(dur, "soft", cx=e1.x, cy=e1.y, cz=e1.z, tx=tg1.x, ty=tg1.y, tz=tg1.z, lens=36, fstop=2.8,
           focus=(face - e1).length, roll=CAM_ROLL)
    ct.layer(lambda t, p: p.update(shake=0.15))
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=6)
    scene.char_lights(c.col, face, e0, (-0.8, 0.5, 0.3), rim_col=(0.55, 0.65, 1.0), rim_w=8.0,
                      fill_col=(0.6, 0.7, 1.0), fill_w=6.0)
    # a soft warm key on the sleeping face from the stove side (explicit: the automatic face key can lock onto
    # the slat spots and go cold)
    face_light(c, face + Vector((1.1, -0.4, 0.75)), face, energy=26.0)
    return dict(face_key=0.0,
                post=dict(haze_amt=0.0, bloom=0.5, bloom_thr=0.7, kuw_near=3, kuw_far=4, vignette=0.45))
