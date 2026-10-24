"""Act III helpers (B08-B15, THE CLIMB): cameras with handheld energy and whips, footfall dust, timed hail that
starts / stops on cue, hailstones that hit Claude and bounce off, chips from Claude's body edges, a tumble pose
(rotation about the body centre) and small acting utilities shared by the act's shots.

Everything is a pure function of shot-local time t (seconds) like the rest of the engine."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Quaternion

from lu import anim, acting, claude, sprout, fx, framing, scene, layout, sky, envmat, geo

FPS = 24
GROW = 1.0                  # the sprout's size through the act (as B04-B07 and B16)
ZC_STAND = claude.ZC        # body centre height above the root when standing (0.45)


# ===================================================================== small maths
def heading_to(dx, dy):
    """Claude's heading (deg) that faces travel direction (dx, dy) (heading 0 faces -Y)."""
    return math.degrees(math.atan2(dx, -dy))


def fwd(heading):
    h = math.radians(heading)
    return Vector((math.sin(h), -math.cos(h), 0.0))


def left(heading):
    h = math.radians(heading)
    return Vector((math.cos(h), math.sin(h), 0.0))


def smooth(u):
    u = min(max(u, 0.0), 1.0)
    return u * u * (3 - 2 * u)


def window(t, a, b, ramp=0.1):
    """1 inside [a, b] with soft ramps."""
    if t < a - ramp or t > b + ramp:
        return 0.0
    return min(smooth((t - (a - ramp)) / ramp) if ramp > 0 else 1.0, smooth(((b + ramp) - t) / ramp) if ramp > 0 else 1.0)


def pulse(t, t0, rise=0.03, fall=0.25):
    """A quick impact pulse at t0 (0 -> 1 -> 0)."""
    if t < t0 - rise or t > t0 + fall:
        return 0.0
    if t < t0:
        return smooth((t - (t0 - rise)) / rise)
    return (1 - (t - t0) / fall) ** 2


# ===================================================================== characters
def make_claude(W, name="Claude"):
    C = W.claude(name)
    return C


def make_sprout(C, name="Sprout"):
    S = sprout.Sprout(name)
    framing.register_char(S)
    S.ride(C, "cradle")
    return S


def bake_char(ch, tr, f0, f1, defaults):
    """anchor + evaluate the track once per frame (cached on tr._baked for follow_root etc.) + bake."""
    anim.anchor(tr, defaults)
    anim.prepare_layers(tr)
    cache = {f: tr.at((f - f0) / FPS) for f in range(f0 - 1, f1 + 2)}
    tr._baked = cache
    tr._f0 = f0
    ch.bake(lambda f: cache[f], f0, f1)


def pose_at(tr, f):
    c = getattr(tr, "_baked", None)
    if c is not None and f in c:
        return c[f]
    return tr.at((f - getattr(tr, "_f0", 0)) / FPS)


def fast_ground(x0, x1, y0, y1, res=0.04):
    """A cached bilinear height grid over a box (W.ground / dress.surface is ~40 ms per call; gait layers call it
    many times per frame). Returns z(x, y); outside the box it falls back to the exact surface."""
    from lu import dress
    xs = np.arange(x0, x1 + res, res)
    ys = np.arange(y0, y1 + res, res)
    X, Y = np.meshgrid(xs, ys)
    Z = dress.surface(X.ravel(), Y.ravel()).reshape(X.shape)

    def z(x, y):
        fx_ = (x - x0) / res
        fy_ = (y - y0) / res
        i, j = int(math.floor(fx_)), int(math.floor(fy_))
        if i < 0 or j < 0 or i >= len(xs) - 1 or j >= len(ys) - 1:
            return float(dress.surface(np.array([x]), np.array([y]))[0])
        u, v = fx_ - i, fy_ - j
        return float(Z[j, i] * (1 - u) * (1 - v) + Z[j, i + 1] * u * (1 - v) + Z[j + 1, i] * (1 - u) * v
                     + Z[j + 1, i + 1] * u * v)
    return z


def body_pt(C, p, frame, bone="head"):
    """World position of a point given in Claude's REST armature space (x, y, z), carried by `bone` at frame."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    pb = C.rig.pose.bones[bone]
    return C.rig.matrix_world @ pb.matrix @ C.rest[bone].inverted() @ Vector(p)


def look_layer(t_fn):
    """A layer that adds look_x/look_y from a function of t -> (lx, ly) or None."""
    def f(t, p):
        v = t_fn(t)
        if v is None:
            return
        p["look_x"] = p.get("look_x", 0.0) + v[0]
        p["look_y"] = p.get("look_y", 0.0) + v[1]
    return f


def flinch_layer(times, amp=1.0, dur=0.28):
    """Impact flinches: squash dip, head jerk down, a shudder and squeezed eyes at each time."""
    def f(t, p):
        k = 0.0
        for tt in times:
            k = max(k, pulse(t, tt, 0.02, dur))
        if k <= 0:
            return
        a = amp * k
        p["squash"] = p.get("squash", 0.0) - 0.06 * a
        p["head_nod"] = p.get("head_nod", 0.0) + 5.0 * a
        p["bend"] = p.get("bend", 0.0) + 3.0 * a
        p["eye_squeeze"] = min(1.0, p.get("eye_squeeze", 0.0) + 0.6 * a)
        p["eye_open"] = max(0.0, p.get("eye_open", 1.0) - 0.5 * a)
        p["teeth"] = min(1.0, p.get("teeth", 0.0) + 0.5 * a)
        p["mouth_wide"] = p.get("mouth_wide", 0.0) + 0.2 * a
        p["roll"] = p.get("roll", 0.0) + 2.5 * a * math.sin((t - times[0]) * 60.0)
    return f


def rot_about_centre(P, R, centre, zc=ZC_STAND):
    """Set root x/y/z + tilt_x/tilt_y/heading in pose P so the body (whose centre is zc above the root when upright)
    has world orientation R (3x3) with its centre at `centre`."""
    c = Vector(centre)
    root = c - R @ Vector((0.0, 0.0, zc))
    e = R.to_euler("YXZ")
    P["x"], P["y"], P["z"] = root.x, root.y, root.z
    P["tilt_x"], P["tilt_y"], P["heading"] = math.degrees(e.x), math.degrees(e.y), math.degrees(e.z)
    P["hop"] = 0.0
    return P


# ===================================================================== camera
def handheld(amp=0.02, ang=0.5, freq=1.0, seed=0, env=None):
    """Camera layer: handheld energy. amp = position jitter (m), ang = aim jitter (deg); env(t) scales it."""
    def f(t, p):
        k = env(t) if env else 1.0
        if k <= 0:
            return
        ex = Vector((p["cx"], p["cy"], p["cz"]))
        tg = Vector((p["tx"], p["ty"], p["tz"]))
        d = max((tg - ex).length, 0.1)
        for i, ch in enumerate(("cx", "cy", "cz")):
            p[ch] += k * amp * (anim.snoise(t, seed + i, 1.1 * freq) + 0.45 * anim.snoise(t, seed + 10 + i, 3.7 * freq))
        a = math.tan(math.radians(ang)) * d * k
        for i, ch in enumerate(("tx", "ty", "tz")):
            p[ch] += a * (anim.snoise(t, seed + 20 + i, 0.8 * freq) + 0.4 * anim.snoise(t, seed + 30 + i, 2.9 * freq))
        p["roll"] = p.get("roll", 0.0) + k * ang * 0.8 * anim.snoise(t, seed + 40, 0.6 * freq)
    return f


def impact_shake(times, amp=0.03, ang=1.2, dur=0.35, seed=7):
    """Camera layer: a jolt at each time (impacts, thunder)."""
    def f(t, p):
        k = 0.0
        for tt in times:
            if tt <= t <= tt + dur:
                u = (t - tt) / dur
                k = max(k, (1 - u) ** 2)
        if k <= 0:
            return
        s1 = math.sin((t * 47.0) + seed)
        s2 = math.sin((t * 61.0) + seed * 1.7)
        p["cz"] += amp * k * s1
        ex = Vector((p["cx"], p["cy"], p["cz"]))
        tg = Vector((p["tx"], p["ty"], p["tz"]))
        d = (tg - ex).length
        a = math.tan(math.radians(ang)) * d * k
        p["tz"] += a * s2
        p["tx"] += a * 0.6 * s1
        p["roll"] = p.get("roll", 0.0) + ang * k * s2
    return f


def make_camera(name, tr, f0, f1, seed=0):
    cam = scene.camera(name, lens=tr.at(0.0)["lens"])
    anim.bake_camera(cam, tr, f0, f1, seed=seed)
    bpy.context.scene.camera = cam
    return cam


def cam_track(**k0):
    tr = anim.Track(anim.CAM_DEFAULT)
    tr.key(0.0, "linear", **k0)
    return tr


def V(p):
    return Vector(p)


def ckey(tr, t, eye, tgt, lens=None, fstop=None, focus=None, ease="inout", roll=None):
    d = dict(cx=eye[0], cy=eye[1], cz=eye[2], tx=tgt[0], ty=tgt[1], tz=tgt[2])
    if lens is not None:
        d["lens"] = lens
    if fstop is not None:
        d["fstop"] = fstop
    if focus is not None:
        d["focus"] = focus
    if roll is not None:
        d["roll"] = roll
    tr.key(t, ease, **d)
    return tr


# ===================================================================== footfalls
def footfalls(path, f0, t_range, z_fn, stride, phases, cyc_shift=0.0, rest=None, heading_offset=0.0):
    """[(t, world pos, leg)] of every foot landing of an acting.gait along path within t_range (same maths as
    acting.gait: leg i lands when path.dist(t) / (2 stride) + phases[i] crosses an integer)."""
    rest = rest or [(claude.LEG_X[i], claude.LEG_Y[i]) for i in range(4)]
    cyc = 2.0 * stride
    out = []
    ts = np.arange(t_range[0], t_range[1], 1.0 / 96.0)
    prev = None
    for t in ts:
        d = path.dist(t)
        cs = [((d / cyc + phases[i]) % 1.0) for i in range(4)]
        if prev is not None:
            for i in range(4):
                if cs[i] < prev[i] - 0.5:          # wrapped: landed
                    x, y = path.pos(t)
                    hd = path.heading(t)
                    h = math.radians((hd if hd is not None else 0.0) + heading_offset)
                    ox, oy = rest[i]
                    wx = x + ox * math.cos(h) - oy * math.sin(h)
                    wy = y + ox * math.sin(h) + oy * math.cos(h)
                    out.append((float(t), Vector((wx, wy, z_fn(wx, wy))), i))
        prev = cs
    return out


def footfall_dust(falls, f0, size=1.0, drift=(0.0, 0.0, 0.0), pairs=True, opacity=0.5, color=None):
    """Dust puffs at footfalls; with pairs=True, legs landing together share one puff."""
    done = []
    objs = []
    for (t, p, i) in falls:
        if pairs and any(abs(t - t2) < 0.03 and (p - p2).length < 0.5 for (t2, p2) in done):
            continue
        done.append((t, p))
        objs += fx.dust_puff((p.x, p.y, p.z), f0 + int(round(t * FPS)), size=size, n=6, drift=drift,
                             opacity=opacity, color=color)
    return objs


# ===================================================================== hail
def _hail_attrs_fn(center, radius, starts, Tc, exclude, seed, ground_fn=None):
    cx, cy = center[0], center[1]

    def attrs(rng, n, A):
        r = radius * np.sqrt(A["u"][:, 0])
        a = A["u"][:, 1] * 2 * math.pi
        bx, by = cx + r * np.cos(a), cy + r * np.sin(a)
        for (ex, ey, ea, eb, eh) in (exclude or ()):
            # push points out of an excluded ellipse (ea along the heading eh, eb across)
            c, s = math.cos(math.radians(eh)), math.sin(math.radians(eh))
            dx, dy = bx - ex, by - ey
            u = (dx * c + dy * s) / ea
            v = (-dx * s + dy * c) / eb
            q = np.hypot(u, v)
            k = (q < 1.0) & (q > 1e-6)
            sc = np.where(k, (1.0 + 0.15 * A["u"][:, 2]) / np.maximum(q, 1e-6), 1.0)
            u, v = u * sc, v * sc
            bx = np.where(k, ex + (u * ea) * c - (v * eb) * s, bx)
            by = np.where(k, ey + (u * ea) * s + (v * eb) * c, by)
        gz = fx._ground_hits(bx, by)
        r_ = A["r"].copy()
        # stone i starts its fall at starts[i] (shot-local s): tau = (T + rx Tc) mod Tc = 0 at T = starts[i]
        r_[:, 0] = np.mod(-np.asarray(starts[:n]), Tc) / Tc
        A["r"] = r_
        return dict(bx=bx, by=by, gz=gz, r=r_)
    return attrs


def timed_hail(center, radius, starts, f0, height=12.0, fall=16.0, bounce=2.4, stone=(0.022, 0.042), rest=8.0,
               gap=9.0, exclude=None, seed=5, name="HailT", puff=0.13, hs=0.7):
    """Hail whose stones each fall ONCE at their own start time (shot-local seconds, `starts`): the storm can begin
    and end on cue (fx.hail is a steady state). Each stone falls `height` m at `fall` m/s, bounces twice, lies and
    slowly melts (`rest` s). exclude: [(x, y, a, b, heading_deg)] ellipses kept free (stones that would fall through
    a character); starts are shot-local seconds with t=0 at absolute frame f0."""
    starts = np.asarray(starts, dtype=float)
    n = len(starts)
    tf = height / fall
    tb1 = 2 * bounce / 9.8
    tb2 = 2 * bounce * 0.38 / 9.8
    Tc = tf + tb1 + tb2 + rest + gap
    hm = fx._hail_mat()
    proto = fx._ico_proto("FXP_Hail", 0.5, hm, sub=1, squash=0.85)
    pm = fx._puff_mat("FXHailPuff", color=None, opacity=0.5)
    puffp = fx._ico_proto("FXP_HailPuff", 0.5, pm, sub=2, squash=0.55)
    attrs = _hail_attrs_fn(center, radius, starts, Tc, exclude, seed)
    return fx._make_field(name, "hail", (center[0], center[1], 0.0), (radius * 2, radius * 2, height), n, f0, [proto],
                          dict(height=height, fall=fall, bounce=bounce, size=stone, puff=puff, puff_proto=puffp,
                               hs=hs, rest=rest, gap=gap), seed, attrs, 1.0)


def hail_starts(n, t_first, t_last, ramp=0.25, seed=0, before=0.0):
    """Start times so impacts begin at t_first + tf ... use with tf subtracted by the caller. A quick ramp-up then a
    steady rate; `before` > 0 also scatters starts earlier (stones already lying around at the start)."""
    rng = np.random.default_rng(seed)
    u = rng.random(n)
    span = t_last - t_first
    # inverse of a ramped density: dense from t_first + ramp
    t = t_first + span * u
    k = rng.random(n) < 0.12
    t = np.where(k, t_first + ramp * np.sqrt(rng.random(n)), t)
    if before > 0:
        b = rng.random(n) < before
        t = np.where(b, t_first - rng.random(n) * 4.0, t)
    return t


_STONE_N = [0]


def body_stone(C_top_fn, t_hit, f0, f1, out_dir, ground_fn, size=0.034, seed=0, speed=1.6, name="BodyStone"):
    """One hailstone that falls onto a point on Claude (C_top_fn(t) -> world Vector at shot-local t), bounces off in
    out_dir (horizontal Vector) and falls to the ground, rolls a little and lies there. Keyed object."""
    _STONE_N[0] += 1
    rng = np.random.default_rng(seed)
    hm = fx._hail_mat()
    proto = bpy.data.objects.get("FXP_Hail") or fx._ico_proto("FXP_Hail", 0.5, hm, sub=1, squash=0.85)
    o = bpy.data.objects.new(f"{name}{_STONE_N[0]}", proto.data)
    geo.coll("FX").objects.link(o)
    o.visible_shadow = False
    s = size * rng.uniform(0.85, 1.25)
    o.scale = (s, s, s)
    o["life"] = 1.0
    hit = C_top_fn(t_hit)
    vfall = 16.0
    d = Vector(out_dir)
    d.z = 0
    d = d.normalized() if d.length > 1e-4 else Vector((1, 0, 0))
    v0 = d * speed * rng.uniform(0.7, 1.2) + Vector((0, 0, rng.uniform(1.2, 2.0)))
    frames, locs, scs, rots = [], [], [], []
    fa = f0 + int(math.floor((t_hit - 0.35) * FPS))
    fb = f1 + 1
    landed = None
    spin = Vector(rng.normal(0, 12, 3))
    for f in range(max(f0 - 1, fa), fb + 1):
        t = (f - f0) / FPS
        if t < t_hit:
            p = hit + Vector((0, 0, vfall * (t_hit - t)))
            sc_ = s if t > t_hit - 0.34 else 0.0001
        else:
            tt = t - t_hit
            if landed is None:
                p = hit + v0 * tt + Vector((0, 0, -4.9 * tt * tt))
                gzz = ground_fn(p.x, p.y) + s * 0.5
                if p.z <= gzz and tt > 0.05:
                    landed = (tt, Vector((p.x, p.y, gzz)))
                    p = landed[1]
            else:
                t2 = tt - landed[0]
                roll = 0.12 * (1 - math.exp(-4 * t2))
                p = landed[1] + d * roll
                p.z = ground_fn(p.x, p.y) + s * 0.5
            sc_ = s
        frames.append(f)
        locs.append(tuple(p))
        scs.append((sc_, sc_, sc_ * 0.85))
        rots.append(tuple(spin * t))
    fx._bake(o, frames, np.array(locs), "location")
    fx._bake(o, frames, np.array(scs), "scale")
    fx._bake(o, frames, np.array(rots), "rotation_euler")
    return o


# ===================================================================== world helpers
def dry_ground(W, wet=0.0, frame=None):
    envmat.set_env(frame, Wet=wet)


def key_rain(field, f0, keys):
    """keys: [(t, amount)]"""
    for t, a in keys:
        fx.amount(field, f0 + int(round(t * FPS)), a)


def key_light(lo, keys, f0, attr="energy"):
    for t, v in keys:
        setattr(lo.data, attr, v)
        lo.data.keyframe_insert(attr, frame=f0 + int(round(t * FPS)))


def key_mat(C, keys):
    """Material channels are baked through the pose track; this is a convenience to build key dicts."""
    return keys


def follow_root(obj, tr, f0, f1, step=1, zoff=0.0):
    """Key obj's location so it keeps its current offset from the character root (pose track tr: x, y, z) - lights
    that travel with a running / tumbling character without inheriting its rotation."""
    f_ = getattr(tr, "_f0", f0)
    p0 = pose_at(tr, f_)
    base = Vector((p0.get("x", 0.0), p0.get("y", 0.0), p0.get("z", 0.0)))
    off = obj.location - base
    frames, locs = [], []
    for f in range(f0 - 1, f1 + 2, step):
        p = pose_at(tr, f)
        frames.append(f)
        locs.append(tuple(Vector((p.get("x", 0.0), p.get("y", 0.0), p.get("z", 0.0) + zoff)) + off))
    fx._bake(obj, frames, np.array(locs), "location")
    return obj


def fg_trunk(kind, k, pos, yaw=0.0, scale=1.0, tilt=(0.0, 0.0), name="FGTrunk"):
    """A charred trunk / stub / log from the forest library placed by hand (foreground parallax and framing)."""
    from lu import foliage
    lib = foliage.trunk_protos()
    i = lib[kind][k % len(lib[kind])]
    src = [o for o in bpy.data.collections[foliage.TRUNK_COLL].objects if o.name.startswith(f"t{i:03d}_")][0]
    o = bpy.data.objects.new(name, src.data)
    bpy.context.scene.collection.objects.link(o)
    o.location = pos
    o.rotation_euler = (math.radians(tilt[0]), math.radians(tilt[1]), math.radians(yaw))
    o.scale = (scale, scale, scale)
    return o


def lin_z(W, path, t0, t1, n=12):
    """A smooth (least-squares line) ground height along a path, for camera heights that don't bump."""
    ts = np.linspace(t0, t1, n)
    zs = [W.ground(*path.pos(t)) for t in ts]
    a, b = np.polyfit(ts, zs, 1)
    return lambda t: float(a * t + b)


def freeze(tr, t, defaults, names=None):
    """Key, at time t, every channel (or `names`) whose next key lies after t at the value it holds from the keys at
    or before t (else its default): a move keyed later then starts at t instead of gliding from the shot start."""
    ch = tr._chan()
    add = {}
    for k, ks in ch.items():
        if names is not None and k not in names:
            continue
        if not any(kt > t + 1e-6 for (kt, _, _) in ks):
            continue
        if any(abs(kt - t) < 1e-6 for (kt, _, _) in ks):
            continue
        before = [(kt, v) for (kt, v, _) in ks if kt <= t]
        if before:
            add[k] = before[-1][1]
        elif k in defaults:
            add[k] = defaults[k]
    if add:
        tr.key(t, "linear", **add)
    return tr


def follow_fn(obj, pos_fn, f0, f1):
    """Key obj's location = pos_fn(t) + its current offset from pos_fn(0)."""
    off = obj.location - pos_fn(0.0)
    frames, locs = [], []
    for f in range(f0 - 1, f1 + 2):
        frames.append(f)
        locs.append(tuple(pos_fn((f - f0) / FPS) + off))
    fx._bake(obj, frames, np.array(locs), "location")
    return obj


def soft_fill(collection, target, cam_loc, energy=2.0, col=(0.8, 0.86, 1.0), dist=1.2, size=0.8, up=0.5,
              name="SoftFill"):
    """A small soft area light from the camera side, light-linked to `collection` only (e.g. the sprout, so a dim,
    wilted sprout still reads as a grey-green plant instead of a black blob)."""
    from lu.scene import look_at
    t = Vector(target)
    d = Vector(cam_loc) - t
    d.z = 0
    d = d.normalized() if d.length > 1e-4 else Vector((0, -1, 0))
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.color = col
    ld.size = size
    ld.use_shadow = False
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    look_at(ob, t + d * dist + Vector((0, 0, up)), t)
    ob.light_linking.receiver_collection = collection
    return ob


def ride_offset(heading, toward_face=0.0, up=0.0, side=0.0):
    """World offset (x, y, z) for a sprout riding a hand point (follow_rotation off): `toward_face` metres back
    toward Claude's face (against its facing), `side` toward its left, `up` metres up."""
    f = fwd(heading)
    l = left(heading)
    v = -f * toward_face + l * side
    return dict(x=v.x, y=v.y, z=up)


def hand_tops(C, side, f0, f1, toward=None):
    """{frame: world Vector} - the centre of the flat top face of Claude's hand block (the end of the arm), read from
    the evaluated arm mesh, so a small prop can sit ON the hand whatever IK did to the block."""
    sc = bpy.context.scene
    arm = C.arm_parts[0 if side == "L" else 1]
    out = {}
    for f in range(f0 - 1, f1 + 2):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = arm.evaluated_get(dg)
        me = ev.to_mesh()
        n = len(me.vertices)
        co = np.empty(n * 3)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        rest = np.empty(n * 3)
        me.attributes["rest"].data.foreach_get("vector", rest)
        rest = rest.reshape(-1, 3)
        ev.to_mesh_clear()
        hx = np.abs(rest[:, 0])
        sel = hx > claude.WR_X - 0.005
        mw = np.array(ev.matrix_world)
        w = co[sel] @ mw[:3, :3].T + mw[:3, 3]
        c = w.mean(0)
        top = w[:, 2].max()
        out[f] = Vector((c[0], c[1], top))
    return out


def sprout_light(S, scale=0.3, soft=0.05):
    """Tame the sprout's practical for close shots (its point light sits a few cm from Claude's hands/face and blows
    them out): scale its driven energy and soften it."""
    lo = getattr(S, "light", None)
    if lo is None:
        return
    lo.data.shadow_soft_size = soft
    ad = lo.data.animation_data
    if ad:
        for fc in ad.drivers:
            if fc.data_path == "energy":
                fc.driver.expression = f"v*{scale}"


def char_point(C, pose, rest_pt):
    """Character-space (root frame, unrotated by heading/tilt) position of a point given in Claude's REST space and
    carried by the head (face block) for `pose` (crouch, lean, bend, squash, head_nod...): analytic, no evaluation."""
    P = dict(claude.DEFAULT)
    P.update(pose)
    return C._chain_matrix(P) @ Vector(rest_pt)


def hands_to_root(C, pose):
    """Convert a pose's follow-mode hand IK targets to root-space targets (armX_follow = 0) at that pose, so a move
    can switch to fixed targets without a jump."""
    out = {}
    for s in "LR":
        p = Vector((pose.get(f"hand{s}_x", claude.DEFAULT[f"hand{s}_x"]), pose.get(f"hand{s}_y", claude.DEFAULT[f"hand{s}_y"]),
                    pose.get(f"hand{s}_z", claude.DEFAULT[f"hand{s}_z"])))
        if pose.get(f"arm{s}_follow", 1.0) > 0.5:
            P = dict(claude.DEFAULT)
            P.update(pose)
            p = C._chain_matrix(P) @ p
        out.update({f"hand{s}_x": p.x, f"hand{s}_y": p.y, f"hand{s}_z": p.z, f"arm{s}_follow": 0.0})
    return out


def post_storm(**over):
    """The act's storm grade with a gentler cool cast in the shadows (the preset's blue lift/gamma pushes Claude's
    terracotta to pink); Claude stays the warm note."""
    from lu import post
    P = dict(lift=(0.995, 1.0, 1.012), gamma=(0.995, 1.0, 1.012), gain=(0.97, 0.99, 1.03), sat=1.1)
    P.update(over)
    return post.preset("storm", **P)


def post_low(**over):
    """The low point's near-monochrome cold grade without the blue lift that turns Claude pink."""
    from lu import post
    P = dict(lift=(1.0, 1.0, 1.0), gamma=(1.0, 1.0, 1.005), gain=(0.985, 0.99, 1.015), sat=1.2)
    P.update(over)
    return post.preset("low", **P)


def hand_top_now(C, side):
    """Top-centre of the hand block for Claude's CURRENT applied pose (evaluates the arm mesh)."""
    arm = C.arm_parts[0 if side == "L" else 1]
    dg = bpy.context.evaluated_depsgraph_get()
    ev = arm.evaluated_get(dg)
    me = ev.to_mesh()
    n = len(me.vertices)
    co = np.empty(n * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    rest = np.empty(n * 3)
    me.attributes["rest"].data.foreach_get("vector", rest)
    rest = rest.reshape(-1, 3)
    mw = np.array(ev.matrix_world)
    ev.to_mesh_clear()
    sel = np.abs(rest[:, 0]) > claude.WR_X - 0.005
    w = co[sel] @ mw[:3, :3].T + mw[:3, 3]
    c = w.mean(0)
    return Vector((c[0], c[1], w[:, 2].max()))


def fit_hand_top(C, P, side, target_fn, iters=4):
    """Adjust a ROOT-SPACE (follow 0) hand target in pose P until the top-centre of that hand block lands on
    target_fn() (a world point, re-evaluated each pass, e.g. relative to the cheek). Returns the updated pose."""
    sc = bpy.context.scene
    P = dict(P)
    hd = P.get("heading", 0.0)
    f, l = fwd(hd), left(hd)
    for _ in range(iters):
        C.apply(P)
        sc.frame_set(sc.frame_current)
        top = hand_top_now(C, side)
        d = target_fn() - top
        P[f"hand{side}_x"] += d.dot(l)
        P[f"hand{side}_y"] += -d.dot(f)
        P[f"hand{side}_z"] += d.z
    return P


def clear_line(eye, target, radius=0.45, u0=0.12, u1=0.8, step=0.25):
    """Mow the ground cover (logs, twigs, tufts) out of a low camera's line of sight to the subject."""
    from lu import dress
    e, t = Vector(eye), Vector(target)
    n = max(2, int((t - e).length / step))
    for k in range(n + 1):
        u = u0 + (u1 - u0) * k / n
        p = e.lerp(t, u)
        dress.mow((p.x, p.y), radius)
