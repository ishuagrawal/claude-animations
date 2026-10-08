"""SH10 (4 beats) - the play peaks. Medium, handheld, from the north-east of the pair: the star loops high in the
upper right, turns and swoops in low over the flowers; Claude crouches (anticipation), lunges with its arms out and
catches it - the impact rocks it back onto its hind legs, it teeters ("whoa"), and the two of them tumble backward
into the flowers in a burst of petals and pollen (T_TUMBLE), laughing.

Geography (shared with SH11-SH14): Claude ends lying on its back at LIE, head to the SOUTH (uphill, toward the
windmill), feet to the north, face up - so lying there it looks over its feet to the constellation (due north,
30 deg up). The cameras for SH10-SH14 all stay on the EAST side of that axis (screen direction holds: the star is at
Claude's right = screen-left in every shot).

Also the shared toolkit for the meadow shots (oriented bakes, lying poses, the held star, flower bed, petals,
pollen, fireflies, sparkle trail, aimed face lights)."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Quaternion

from lu import world, anim, scene, stage as S, fx, geo, mat, props, foliage, layout, framing as FR
from lu.anim import Track, CAM_DEFAULT
from lu.claude import DEFAULT as C_DEF, S as CS
from lu.star import DEFAULT as S_DEF
try:
    from lu import dress
except Exception:
    dress = None
try:
    from shots import act1
    STAR_SCALE = act1.STAR_SCALE
except Exception:          # the act-one module is another department's; keep working without it
    act1 = None
    STAR_SCALE = 0.62

T_TUMBLE = 2.0          # they hit the flowers (petal burst, the "whumpf")
T_CATCH = 1.15          # the star lands in Claude's arms
FPS = 24

LIE = Vector((layout.LIE[0], layout.LIE[1], 0.0))
BETA = 15.0             # lying: the body reclines this far off flat (head uphill, face tipped toward the feet/north)
STAND = Vector((LIE.x, LIE.y + 0.42, 0.0))   # where Claude stands before the fall (it falls back onto LIE)


# ====================================================================== orientation helpers
def frame_from(face, up):
    """3x3 rotation for a character whose FRONT (-Y local) points along `face` and whose top (+Z) along `up`."""
    f = Vector(face).normalized()
    u = Vector(up)
    u = (u - f * u.dot(f)).normalized()
    y = -f
    z = u
    x = y.cross(z)
    return Matrix((x, y, z)).transposed()


def lie_frame(beta=BETA, head=(0.0, -1.0)):
    """Lying on its back, head toward `head` (horizontal dir), body reclined `beta` deg (head raised)."""
    h = Vector((head[0], head[1], 0.0)).normalized()
    b = math.radians(beta)
    face = Vector((0, 0, 1)) * math.cos(b) - h * math.sin(b)
    up = h * math.cos(b) + Vector((0, 0, 1)) * math.sin(b)
    return frame_from(face, up)


def heading_frame(hd):
    return Matrix.Rotation(math.radians(hd), 3, "Z")


# body hull in rig space (metres): (y, z) pairs used for ground contact while tipping over
_HULL = [(-0.07, 0.0), (0.07, 0.0), (-0.20, 0.20), (0.20, 0.20), (-0.20, 0.68), (0.20, 0.68)]


def tip_table(phi_max, steps=400):
    """Rigid rolling of Claude's hull tipping BACKWARD about the world X axis on flat ground (facing +Y, i.e. north):
    returns [(phi_deg, origin_offset Vector)] where origin_offset is the rig origin relative to its start (feet)."""
    O = Vector((0.0, 0.0, 0.0))
    R = heading_frame(180.0)
    out = [(0.0, O.copy())]
    dphi = phi_max / steps
    for i in range(steps):
        pts = [O + R @ Vector((0.0, y, z)) for (y, z) in _HULL]
        zmin = min(p.z for p in pts)
        # contact: the lowest point(s); pivot about the hindmost of them (the rearmost in world -Y)
        low = [p for p in pts if p.z < zmin + 1e-4]
        c = min(low, key=lambda p: p.y)
        Rx = Matrix.Rotation(math.radians(dphi), 3, "X")
        O = c + Rx @ (O - c)
        R = Rx @ R
        pts = [O + R @ Vector((0.0, y, z)) for (y, z) in _HULL]
        zmin = min(p.z for p in pts)
        O.z -= zmin          # keep on the ground (numerical drift)
        out.append(((i + 1) * dphi, O.copy()))
    return out


def tip_lookup(table, phi):
    phis = [a for a, _ in table]
    i = int(np.clip(np.searchsorted(phis, phi), 1, len(table) - 1))
    (a0, o0), (a1, o1) = table[i - 1], table[i]
    u = 0.0 if a1 == a0 else (phi - a0) / (a1 - a0)
    return o0.lerp(o1, min(max(u, 0.0), 1.0))


# ====================================================================== baking
def bake(ch, track, f0, f1, orient=None, after=None):
    """Bake a character track frame by frame. orient(t, p) -> (location Vector, Matrix3) | None overrides the rig
    root transform (lying, tumbling, riding a sail). after(f, t, p) runs after the pose is applied (e.g. hold props)."""
    anim.prepare_layers(track)
    prev = None
    for f in range(f0, f1):
        t = (f - f0) / FPS
        p = track.at(t)
        ch.apply(p)
        if orient is not None:
            r = orient(t, p)
            if r is not None:
                loc, R = r
                ch.rig.location = loc
                ch.rig.rotation_mode = "ZXY"
                e = R.to_euler("ZXY", prev) if prev is not None else R.to_euler("ZXY")
                ch.rig.rotation_euler = e
                prev = e.copy()
        if after:
            after(f, t, p)
        ch.key(f)


def chest_matrix(c):
    """World matrix of Claude's chest bone (call after apply + view_layer.update)."""
    pb = c.rig.pose.bones["chest"]
    return c.rig.matrix_world @ pb.matrix


HOLD = Vector((0.0, -0.28, 0.42))     # held star centre in Claude's rest rig space (against its chest)


def hold_point(c, off=HOLD):
    """World position of a rig-space point carried by the chest bone."""
    pb = c.rig.pose.bones["chest"]
    rest = pb.bone.matrix_local
    return c.rig.matrix_world @ pb.matrix @ rest.inverted() @ off


# ====================================================================== meadow dressing
FLOWER_COLS = [(0.86, 0.84, 0.78), (0.86, 0.84, 0.78), (0.9, 0.88, 0.8), (0.30, 0.42, 0.95), (0.36, 0.48, 1.0),
               (0.58, 0.36, 0.82), (0.95, 0.48, 0.62), (0.98, 0.58, 0.68), (1.0, 0.80, 0.22)]


def flower_bed(name, center, radius, height_fn, n_leaf=2600, n_flower=1500, seed=11, clear=None, hole=0.0,
               tilt=0.5):
    """A painterly carpet seen from above as well as from the side: low leaf/grass dabs and up-facing flower heads
    (white daisies, blue cornflowers, violet, pink clover, a few yellow). clear(x, y) -> True skips a spot."""
    rng = np.random.default_rng(seed)
    cx, cy = center
    leaf, flw = [], []
    greens = ((0.12, 0.24, 0.08), (0.30, 0.42, 0.12), (0.22, 0.36, 0.16), (0.36, 0.40, 0.14))
    for i in range(n_leaf + n_flower):
        is_f = i >= n_leaf
        rr = radius * math.sqrt(rng.random())
        if rr < hole:
            continue
        a = rng.uniform(0, 2 * math.pi)
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        if clear and clear(x, y):
            continue
        z = float(height_fn(x, y))
        nrm = Vector((rng.normal(0, tilt * 0.6), rng.normal(0, tilt * 0.6), 1.0)).normalized()
        ang = rng.uniform(0, 2 * math.pi)
        t0 = Vector((math.cos(ang), math.sin(ang), 0.0))
        t0 = (t0 - nrm * t0.dot(nrm)).normalized()
        t1 = nrm.cross(t0)
        if is_f:
            s = rng.uniform(0.022, 0.045)
            h = rng.uniform(0.05, 0.2)
            col = FLOWER_COLS[int(rng.integers(0, len(FLOWER_COLS)))]
            j = rng.uniform(0.85, 1.1)
            flw.append((Vector((x, y, z + h)), t0 * s, t1 * s, nrm, int(rng.integers(0, 16)),
                        tuple(min(1.0, c_ * j) for c_ in col)))
        else:
            s = rng.uniform(0.05, 0.11)
            h = rng.uniform(0.02, 0.12)
            g = greens[int(rng.integers(0, len(greens)))]
            j = rng.uniform(0.75, 1.2)
            leaf.append((Vector((x, y, z + h)), t0 * s, t1 * s * 1.4, nrm, int(rng.integers(0, 16)),
                         tuple(c_ * j for c_ in g)))
    out = []
    if leaf:
        out.append(foliage._cards(name + "_leaf", leaf, geo.coll("Grass"), foliage.card_mat("Leaves", "dab_leaf",
                                                                                        translucent=0.3, scale=1.5)))
    if flw:
        out.append(foliage._cards(name + "_fl", flw, geo.coll("Grass"), foliage.card_mat("Flowers", "dab_leaf",
                                                                                      translucent=0.2, scale=3.0)))
    for o in out:
        o.visible_shadow = False
    return out


def _petal_mat(name, color):
    m = bpy.data.materials.get(name)
    if m:
        return m
    return mat.painterly(name, color, stroke="strokes_soft", scale=4.0, tex_amt=0.4, translucent=0.5, wrap=0.3,
                         backface=True, emission=color, emit_str=0.0)


def petals(name, origin, t0, f0, f1, n=60, speed=(0.8, 2.2), up=1.2, drag=1.6, fall=0.35, seed=0, spread=0.25,
           size=(0.008, 0.016), cols=None, wind=(0.0, 0.0, 0.0)):
    """Petal burst: little flat petals fly up from `origin` at shot-local t0, then flutter down (drag + sway +
    spin). Keyframed on every frame from t0 to the end of the shot."""
    col = geo.coll("FX")
    rng = np.random.default_rng(seed)
    cols = cols or FLOWER_COLS
    objs = []
    O = Vector(origin)
    fa = f0 + int(t0 * FPS)
    for i in range(n):
        c_ = cols[int(rng.integers(0, len(cols)))]
        m = _petal_mat(f"Petal_{int(c_[0] * 9)}{int(c_[1] * 9)}{int(c_[2] * 9)}", c_)
        s = rng.uniform(*size)
        w = s * rng.uniform(0.45, 0.7)
        o = geo.obj_from(f"{name}{i}", [(0, 0, -s), (w, 0.004, -s * 0.35), (w * 0.8, 0.006, s * 0.45), (0, 0.003, s),
                                        (-w * 0.8, 0.006, s * 0.45), (-w, 0.004, -s * 0.35)],
                         [(0, 1, 2, 3, 4, 5)], col, m, smooth=True)
        o.visible_shadow = False
        d = Vector((rng.normal(0, 1), rng.normal(0, 1), 0.0)).normalized() * rng.uniform(0.2, 1.0)
        d.z = up * rng.uniform(0.6, 1.3)
        v0 = d.normalized() * rng.uniform(*speed)
        p0 = O + Vector((rng.normal(0, spread), rng.normal(0, spread), rng.uniform(0, 0.08)))
        spin = Vector(rng.normal(0, 7.0, 3))
        ph = rng.uniform(0, 6.28)
        fr = rng.uniform(1.2, 2.6)
        delay = rng.uniform(0.0, 0.08)
        for f in range(fa - 1, f1):
            t = (f - f0) / FPS - t0 - delay
            if t < 0:
                o.location = p0
                o.scale = (0.001, 0.001, 0.001)
            else:
                # velocity decays toward a slow fall (drag), with a sideways flutter
                k = math.exp(-drag * t)
                pos = p0 + v0 * (1 - k) / drag + Vector(wind) * t + Vector((0, 0, -fall * (t - (1 - k) / drag)))
                pos += Vector((math.sin(ph + fr * 6.28 * t), math.cos(ph * 1.3 + fr * 5.0 * t), 0)) * 0.05 * min(1.0, t)
                o.location = pos
                o.scale = (1, 1, 1)
                o.rotation_euler = (spin.x * t + ph, spin.y * t, spin.z * t)
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
            o.keyframe_insert("scale", frame=f)
        objs.append(o)
    return objs


def pollen(name, origin, t0, f0, f1, n=40, seed=0, spread=0.35, rise=0.35, color=(1.0, 0.86, 0.5), strength=6.0):
    """Glowing pollen specks puffing up and drifting (they catch the star's light)."""
    col = geo.coll("FX")
    rng = np.random.default_rng(seed)
    m = fx._life_emissive("Pollen", color, strength)
    O = Vector(origin)
    objs = []
    fa = f0 + int(t0 * FPS)
    for i in range(n):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.uniform(0.004, 0.008))
        o = bpy.context.active_object
        o.name = f"{name}{i}"
        for c_ in o.users_collection:
            c_.objects.unlink(o)
        col.objects.link(o)
        o.data.materials.append(m)
        o.visible_shadow = False
        d = Vector((rng.normal(0, 1), rng.normal(0, 1), abs(rng.normal(0.6, 0.4)))).normalized()
        v = d * rng.uniform(0.3, 1.1)
        p0 = O + Vector((rng.normal(0, spread * 0.4), rng.normal(0, spread * 0.4), 0.02))
        ph = rng.uniform(0, 6.28)
        L = rng.uniform(1.2, 3.0)
        for f in range(fa - 1, f1, 2):
            t = (f - f0) / FPS - t0
            if t < 0:
                o.location = p0
                o["life"] = 0.0
            else:
                k = math.exp(-2.5 * t)
                o.location = p0 + v * (1 - k) / 2.5 + Vector((0.04 * math.sin(ph + 2 * t), 0.04 * math.cos(ph + 1.7 * t),
                                                             rise * 0.2 * t))
                o["life"] = max(0.0, 1 - t / L) * (0.6 + 0.4 * math.sin(ph + 9 * t))
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        objs.append(o)
    return objs


def fireflies(center, n, f0, f1, seed=0, spread=(3.0, 3.0, 1.2), strength=40.0, swirl=None):
    """Drifting, pulsing fireflies. swirl = (fn(t) -> Vector attractor, t_start, gain) pulls them into the star's
    wake."""
    rng = np.random.default_rng(seed)
    m = bpy.data.materials.get("Firefly") or fx._life_emissive("Firefly", (0.75, 1.0, 0.35), strength)
    col = geo.coll("FX")
    objs = []
    for i in range(n):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.011)
        o = bpy.context.active_object
        o.name = f"Firefly{i}"
        for c_ in o.users_collection:
            c_.objects.unlink(o)
        col.objects.link(o)
        o.data.materials.append(m)
        o.visible_shadow = False
        p0 = Vector(center) + Vector(rng.uniform(-0.5, 0.5, 3)) * Vector(spread)
        ph = rng.uniform(0, 6.28, 4)
        fq = rng.uniform(0.3, 0.8, 3)
        for f in range(f0, f1, 2):
            t = (f - f0) / FPS
            d = Vector((math.sin(t * fq[0] + ph[0]) * 0.4, math.cos(t * fq[1] + ph[1]) * 0.4,
                        math.sin(t * fq[2] + ph[2]) * 0.2))
            p = p0 + d
            if swirl is not None:
                fn, ts, g = swirl
                if t > ts:
                    a = fn(t - 0.25)
                    p = p.lerp(a + (p - a) * 0.6, min(1.0, (t - ts) * g) * 0.5)
            o.location = p
            o["life"] = max(0.0, math.sin(t * 2.2 + ph[3])) ** 3
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        objs.append(o)
    return objs


def sparkle_trail(name, pos_fn, f0, f1, n=18, lag=0.022, size=0.024, strength=16.0, color=(1.0, 0.72, 0.32),
                  alive=None, jitter=0.012):
    """Glowing dabs at the star's recent positions, shrinking and fading behind it. alive(t) -> 0..1."""
    m = fx._life_emissive(f"{name}Mat", color, strength)
    col = geo.coll("FX")
    objs = []
    for k in range(n):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0)
        o = bpy.context.active_object
        o.name = f"{name}{k}"
        for c_ in o.users_collection:
            c_.objects.unlink(o)
        col.objects.link(o)
        o.data.materials.append(m)
        o.visible_shadow = False
        for f in range(f0, f1):
            t = (f - f0) / FPS
            tk = t - lag * (k + 1)
            p = pos_fn(max(tk, 0.0))
            a = alive(tk) if alive else 1.0
            jj = jitter * (1 + k * 0.25)
            o.location = p + Vector((jj * math.sin(k * 2.1 + t * 13), jj * math.cos(k * 1.7 + t * 11), jj * math.sin(k * 3.3 + t * 9)))
            r = size * (1 - k / (n + 2)) * (0.3 + 0.7 * a)
            o.scale = (r, r, r)
            o["life"] = (1 - k / n) ** 1.3 * 0.8 * a
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        objs.append(o)
    return objs


def aimed_light(name, collection, pos, target, energy, col=(1.0, 0.74, 0.5), size=1.2, shadow=False, spec=0.3):
    """A soft area light at `pos` aimed at `target`, light-linked to `collection` only (character face keys/rims).
    spec scales its specular (cheat lights shouldn't paint plastic highlights on the painterly characters)."""
    ld = bpy.data.lights.new(name, "AREA")
    ld.energy = energy
    ld.specular_factor = spec
    ld.color = col
    ld.size = size
    ld.use_shadow = shadow
    ob = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(ob)
    scene.look_at(ob, Vector(pos), Vector(target))
    if collection is not None:
        ob.light_linking.receiver_collection = collection
    return ob


def key_energy(light, f0, f1, fn, step=1):
    for f in range(f0, f1, step):
        light.data.energy = fn((f - f0) / FPS)
        light.data.keyframe_insert("energy", frame=f)


def cam_track(name, keys, f0, f1, seed=0, shake=0.0, layer=None):
    """keys: [(t, ease, eye, target, lens, fstop, focus)] -> baked camera."""
    cam = scene.camera(name, lens=keys[0][4])
    ct = Track(CAM_DEFAULT)
    for (t, e, eye, tgt, lens, fs, fd) in keys:
        ct.key(t, e, cx=eye.x, cy=eye.y, cz=eye.z, tx=tgt.x, ty=tgt.y, tz=tgt.z, lens=lens, fstop=fs,
               focus=fd if fd else (Vector(tgt) - Vector(eye)).length)
    sh = shake

    def lay(t, p):
        p["shake"] = sh(t) if callable(sh) else sh
        if layer:
            layer(t, p)
    ct.layer(lay)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=seed)
    return cam


def mow_all(center, radius):
    """Clear ground cover around a spot: the card grass (foliage) and the instanced cover (dress) if present."""
    foliage.mow((center[0], center[1], 0.0), radius, names=("Meadow", "Patch", "Bed"))
    if dress is not None:
        try:
            dress.mow((center[0], center[1]), radius)
        except Exception as e:      # the cover library is another department's work in progress
            print("SH10: dress.mow failed", e)


def hero_bed(W, center, radius, count=2600, seed=11, clear_r=0.55, clear_c=None):
    """Dense flowers where the pair lies: instanced flower heads (dress.patch) over a flat painterly carpet."""
    cc = clear_c or (LIE.x, LIE.y + 0.1)
    flower_bed("Bed", center, radius, W.H, n_leaf=3200, n_flower=1900, seed=seed,
               clear=lambda x, y: abs(x - cc[0]) < 0.42 and -0.6 < y - cc[1] < 0.62)
    if dress is not None and hasattr(dress, "patch"):
        try:
            dress.patch(center, radius, count=count, flowers=0.4, seed=seed, name="MeadowHeroBed", short=True)
            dress.mow(cc, clear_r)
            return
        except Exception as e:
            print("SH10: dress.patch failed", e)
    W.grass_patch(center, radius * 1.2, 9000, blade=(0.08, 0.2), flowers=0.12, seed=101)
    foliage.mow((cc[0], cc[1], 0.0), clear_r, names=("Patch",))


def act_sails(t_abs):
    """The sails' slow night turn, as in act one (SH01-SH09: 14 deg + 4.5 deg/s of film time)."""
    return 14.0 + 4.5 * t_abs


def meadow_world(sails=0.0, glow=0.85, stars=1.15, dense=True, frames=None):
    """The night meadow at LIE: world + constellation (empty eye) + the flower bed under the pair. frames=(f0, f1)
    keys the sails turning slowly as in act one."""
    if frames is not None:
        sails = act_sails(frames[0] / FPS)
    W = world.World("ext", "night", windmill_state=dict(sails_angle=sails, window_glow=glow),
                    overrides=dict(stars=stars))
    if frames is not None and W.wm:
        from lu import windmill as _wmod
        hub = W.wm["hub"]
        for f in range(frames[0] - 1, frames[1] + 1, 2):
            _wmod.sails_set_angle(hub, act_sails(f / FPS))
            hub.keyframe_insert("rotation_euler", frame=f)
    O = W.origin
    try:
        K = props.constellation(origin=(O.x, O.y, 0), lines=0.12, eye=0.0)
    except Exception as e:      # the sky department's constellation is mid-rework; the meadow shots don't need it
        print("SH1x WARNING: constellation failed:", e)
        K = None
    if act1 and hasattr(act1, "hide_tail"):
        act1.hide_tail()          # the tail pole runs north over the meadow (hidden in every meadow shot)
    mow_all((LIE.x, LIE.y + 0.15), 0.95)
    if dense:
        hero_bed(W, (LIE.x + 0.1, LIE.y + 0.3), 2.6)
    return W, K


def night_post(W, **kw):
    P = dict(haze=W.P["haze"], haze_amt=0.42, mist_start=40.0, mist_depth=1600.0, bloom=0.8, bloom_thr=0.5,
             vignette=0.32)
    P.update(kw)
    return P


# ====================================================================== SH10
def make(f0, f1):
    W, K = meadow_world(frames=(f0, f1))
    dur = (f1 - f0) / FPS
    gz = W.ground(STAND.x, STAND.y)
    P0 = Vector((STAND.x, STAND.y, gz))
    lie_gz = W.ground(LIE.x, LIE.y)
    c = W.claude()
    s = W.star()
    s.light_scale = 14.0

    # ------------------------------------------------------------------ camera (designed first: the star's path is
    # laid out in its screen space so the swoop reads right-to-left across the frame)
    eye0 = P0 + Vector((2.45, 2.35, 0.82))
    tgt0 = P0 + Vector((-0.3, 0.0, 0.6))
    fwd = (tgt0 - eye0).normalized()
    right = fwd.cross(Vector((0, 0, 1))).normalized()
    upc = right.cross(fwd)

    def scr(x, y, depth, lens=32.0):
        """World point at normalised screen (x, y) [-1..1 of the half-frame] and depth (m) from eye0."""
        hx = 18 / lens
        hy = hx * 816 / 1920
        return eye0 + fwd * depth + right * (x * hx * depth) + upc * (y * hy * depth)

    # ------------------------------------------------------------------ Claude: timing
    T_SPOT, T_CROUCH, T_LUNGE = 0.42, 0.62, 0.9
    T_ROCK, T_TEETER, T_FALL = 1.42, 1.6, 1.72
    PHI_LIE = 52.0          # lands sitting back against the flowers, reclined, face up toward the sky (and the lens)
    TIP = tip_table(PHI_LIE + 8.0)
    R_end = Matrix.Rotation(math.radians(PHI_LIE), 3, "X") @ heading_frame(184.0)
    face_end = P0 + tip_lookup(TIP, PHI_LIE) + R_end @ Vector((0, -0.21, 0.5))
    face_end.z += lie_gz - gz
    tgt1 = face_end + Vector((0.0, 0.0, -0.05))
    eye1 = face_end + Vector((1.55, 1.75, 0.85))
    # body tilt over time: rocked back onto the hind legs, a teeter, the fall, a bounce
    phi_keys = [(0.0, 0.0, "linear"), (T_CATCH, 0.0, "linear"), (T_CATCH + 0.12, 11.0, "out"), (T_ROCK, 24.0, "out"),
                (T_TEETER - 0.05, 18.0, "inout"), (T_FALL, 27.0, "inout"), (T_TUMBLE, PHI_LIE + 7.0, "in"),
                (T_TUMBLE + 0.14, PHI_LIE - 6.0, "out"), (T_TUMBLE + 0.32, PHI_LIE + 2.0, "inout"),
                (T_TUMBLE + 0.5, PHI_LIE, "inout")]

    def phi_at(t):
        for i in range(1, len(phi_keys)):
            t0_, a0, _ = phi_keys[i - 1]
            t1_, a1, e = phi_keys[i]
            if t <= t1_:
                u = anim.ease(e, (t - t0_) / (t1_ - t0_) if t1_ > t0_ else 1.0)
                return a0 + (a1 - a0) * u
        return phi_keys[-1][1]

    def base_xy(t):
        """The lunge: a hop forward (north) toward the star, then shoved back by the catch."""
        y = 0.0
        if t > T_LUNGE:
            y = 0.30 * anim.ease("out", (t - T_LUNGE) / (T_CATCH - T_LUNGE))
        if t > T_CATCH:
            y = 0.30 - 0.30 * anim.ease("out", (t - T_CATCH) / (T_ROCK - T_CATCH))
        return Vector((0.0, y, 0.0))

    def hop_z(t):
        if T_LUNGE <= t <= T_CATCH + 0.06:
            u = (t - T_LUNGE) / (T_CATCH + 0.06 - T_LUNGE)
            return 0.13 * 4 * u * (1 - u)
        return 0.0

    def claude_orient(t, p):
        phi = phi_at(t)
        off = tip_lookup(TIP, max(0.0, phi))
        R = Matrix.Rotation(math.radians(phi), 3, "X") @ heading_frame(p.get("heading", 180.0))
        loc = P0 + base_xy(t) + off
        g = W.ground(loc.x, loc.y) if phi < 40 else lie_gz
        loc.z = g + off.z + hop_z(t) + p.get("hop", 0.0) - 0.04 * min(1.0, phi / 60.0)
        if t > T_TUMBLE:
            u = t - T_TUMBLE
            loc.z += 0.05 * math.exp(-6 * u) * abs(math.sin(u * 13))
        return loc, R

    tr = Track()
    # (A) laughing, spinning after the star (continues SH09): head up, arms up, eyes squeezed
    tr.pose(0.0, S.merge(S.C_HAPPY, heading=150.0, eye_happy=0.95, eye_open=0.7, armL_up=50, armR_up=42, armL_bend=18,
                         armR_bend=12, head_nod=-12, look_y=0.85, look_x=-0.35, squash=0.06, lean=-6, roll=-5))
    tr.key(0.3, "inout", heading=174.0, look_x=0.5, look_y=0.6, roll=4, head_tilt=8, eye_happy=0.95)
    # (B) spots it coming: eyes pop, then the anticipation crouch
    tr.key(T_SPOT, "out", eye_happy=0.3, eye_open=1.0, pupil=1.18, look_x=0.45, look_y=0.3, head_nod=-4,
           armL_up=20, armR_up=20)
    tr.key(T_CROUCH, "inout", heading=184.0, squash=-0.15, lean=-9, armL_up=-35, armR_up=-35, armL_fwd=-25,
           armR_fwd=-25, armL_bend=0, armR_bend=0, look_y=0.0, look_x=0.25, head_nod=4, roll=0, head_tilt=0,
           leg0_knee=18, leg1_knee=18, leg2_knee=18, leg3_knee=18, eye_happy=0.45)
    tr.key(T_LUNGE - 0.04, "linear", squash=-0.15)
    # (C) LUNGE: stretch, lean in, arms out
    tr.key(T_LUNGE + 0.12, "out", squash=0.16, lean=24, armL_up=22, armR_up=22, armL_fwd=80, armR_fwd=80,
           armL_bend=10, armR_bend=10, eye_happy=0.7, pupil=1.1, look_y=-0.15, look_x=0.1, head_nod=8,
           leg0_knee=0, leg1_knee=0, leg2_knee=0, leg3_knee=0, leg0_swing=-25, leg1_swing=-25, leg2_swing=-25,
           leg3_swing=-25)
    # (D) CATCH: impact squash, arms wrap, eyes squeeze
    tr.key(T_CATCH, "linear", squash=0.1, lean=20)
    tr.key(T_CATCH + 0.08, "out", squash=-0.13, lean=-6, armL_fwd=88, armR_fwd=88, armL_curl=40, armR_curl=40,
           armL_up=6, armR_up=6, eye_happy=1.0, eye_open=0.55, look_y=-0.4, look_x=0.0, head_nod=10, leg0_swing=0,
           leg1_swing=0, leg2_swing=0, leg3_swing=0)
    tr.key(T_CATCH + 0.2, "inout", squash=0.04)
    # (E) rocked back on its hind legs: "whoa" - eyes wide, front legs paddle
    tr.key(T_ROCK, "inout", eye_happy=0.0, eye_open=1.0, pupil=1.22, look_y=0.3, look_x=-0.2, head_nod=-6, lean=-8,
           squash=0.02, leg0_swing=30, leg1_swing=22, leg2_swing=26, leg3_swing=34)
    tr.key(T_TEETER, "inout", look_x=0.3, leg0_swing=-10, leg3_swing=-14, roll=6)
    tr.key(T_FALL, "inout", look_x=-0.1, leg0_swing=35, leg1_swing=28, leg3_swing=40, roll=-4, eye_open=1.0)
    # (F) the fall: eyes squeeze, legs fly up
    tr.key(T_TUMBLE - 0.06, "in", eye_happy=0.6, eye_open=0.6, leg0_swing=70, leg1_swing=62, leg2_swing=64,
           leg3_swing=72, roll=0, lean=-4, head_nod=4)
    # (G) landing squash and the laugh, legs up in the air
    tr.key(T_TUMBLE + 0.07, "out", squash=-0.16, eye_happy=0.9, eye_open=0.6, head_nod=10, look_y=0.0, look_x=0.0)
    tr.key(T_TUMBLE + 0.25, "inout", squash=0.05, leg0_swing=60, leg1_swing=66, leg2_swing=70, leg3_swing=58,
           head_nod=14, slump=8)
    tr.key(dur, "inout", squash=0.0, eye_happy=0.85, eye_open=0.75, head_nod=16, slump=8, leg0_swing=68,
           leg1_swing=58, leg2_swing=62, leg3_swing=72, armL_curl=48, armR_curl=48, look_y=-0.3)

    def giggle(t, p):
        if t > T_TUMBLE + 0.2:
            u = t - T_TUMBLE - 0.2
            w = min(1.0, u / 0.15)
            p["squash"] = p.get("squash", 0) + 0.025 * w * math.sin(u * 2 * math.pi * 6.5)
            p["head_nod"] = p.get("head_nod", 0) + 3.0 * w * math.sin(u * 2 * math.pi * 6.5 + 1.0)
            for i, ph in enumerate((0.0, 1.3, 2.4, 0.7)):
                p[f"leg{i}_swing"] = p.get(f"leg{i}_swing", 0) + 16 * w * math.sin(u * 2 * math.pi * 3.2 + ph)
        if t < T_SPOT:
            p["hop"] = p.get("hop", 0) + 0.05 * abs(math.sin(t * 2 * math.pi * 2.1))
    tr.layer(giggle)
    tr.layer(anim.breathe(0.012, 0.4))
    anim.anchor(tr, C_DEF)

    # ------------------------------------------------------------------ the star: a loop in the upper right, the
    # swoop low over the flowers, into Claude's arms (catch), bounced on its chest when they land
    A2 = scr(0.8, 0.2, 3.4)
    B = scr(0.32, -0.62, 3.0)
    loop_c = scr(0.5, 0.45, 3.8)
    catch_pt = [None]

    def loop_p(a):
        return loop_c + right * (0.5 * math.cos(a)) + upc * (0.34 * math.sin(a))

    def free_path(t):
        if t < 0.38:              # finishing a loop (screen upper right)
            return loop_p(math.pi * 0.2 + t / 0.38 * math.pi * 1.4)
        if t < 0.62:
            u = anim.ease("inout", (t - 0.38) / 0.24)
            return loop_p(math.pi * 1.6).lerp(A2, u) + upc * 0.25 * math.sin(math.pi * u)
        u = min(1.0, (t - 0.62) / (T_CATCH - 0.62))
        u = anim.ease("in", u) * 0.55 + u * 0.45
        return A2 * (1 - u) ** 2 + B * 2 * u * (1 - u) + catch_pt[0] * u * u

    st = Track()
    st.pose(0.0, S.merge(S.S_JOY, scale=STAR_SCALE, glow=1.55, arms=40, legs=14, head=-12, eye_happy=0.9))
    st.key(0.5, "inout", eye_happy=0.7, arms=55, head=-18, legs=-10)          # tucks in for the dive
    st.key(0.75, "inout", curl=-6, arms=62, eye_happy=0.85, glow=1.75, pupil=1.0)
    st.key(T_CATCH, "linear", squash=0.0)
    st.key(T_CATCH + 0.06, "out", squash=-0.28, curl=22, eye_happy=1.0, eye_open=0.6)
    st.key(T_CATCH + 0.22, "inout", squash=0.08, curl=10)
    st.key(T_ROCK, "inout", squash=0.0, eye_happy=0.2, eye_open=1.0, pupil=1.15, arms=20, glow=1.5, curl=4)
    st.key(T_TUMBLE - 0.05, "inout", eye_happy=0.6, eye_open=0.7, arms=30)
    st.key(T_TUMBLE + 0.06, "out", squash=-0.25, arms=50, eye_happy=1.0, eye_open=0.5, glow=1.5)
    st.key(T_TUMBLE + 0.24, "inout", squash=0.1, legs=18)
    st.key(dur, "inout", squash=0.0, arms=46, legs=10, eye_happy=1.0, eye_open=0.55, glow=1.25)

    def st_play(t, p):
        if t > T_TUMBLE + 0.2:
            u = t - T_TUMBLE - 0.2
            p["squash"] = p.get("squash", 0) + 0.04 * math.sin(u * 2 * math.pi * 7.0)
            p["arms"] = p.get("arms", 0) + 8 * math.sin(u * 2 * math.pi * 3.5)
    st.layer(st_play)
    anim.anchor(st, S_DEF)

    # Claude first (the star's held position comes from its chest, frame by frame)
    held = {}

    def after_c(f, t, p):
        bpy.context.view_layer.update()
        held[f] = (hold_point(c), c.rig.matrix_world.to_3x3().normalized())
    bake(c, tr, f0, f1, orient=claude_orient, after=after_c)
    catch_pt[0] = held[f0 + int(round(T_CATCH * FPS))][0]
    star_pos = {}

    def star_orient(t, p):
        f = f0 + int(round(t * FPS))
        if t < T_CATCH:
            q = free_path(t)
            v = free_path(min(t + 0.04, T_CATCH - 1e-3)) - q
            face = (eye0 - q).normalized()
            bank = max(-1.0, min(1.0, v.dot(right) * 8.0))
            up = (upc + right * (-0.6 * bank)).normalized()
            star_pos[f] = q
            return q, frame_from(face, up)
        hp, Rc = held[f]
        bounce = 0.0
        if t > T_TUMBLE:
            w = t - T_TUMBLE
            bounce = 0.13 * math.exp(-5.5 * w) * abs(math.sin(w * 9.5))
        cface = Rc @ Vector((0, -1, 0))
        cup = Rc @ Vector((0, 0, 1))
        q = hp + cface * bounce - cup * (0.11 * anim.ease("inout", (t - T_FALL) / 0.45))
        face = (cface * 0.5 + (eye1 - q).normalized() * 0.5).normalized()
        star_pos[f] = q
        return q, frame_from(face, cup)

    def star_light(f, t, p):
        if s.light:      # held against Claude its own light would flood its chest: ease the lamp down
            k = 1.0 - 0.9 * anim.ease("out", (t - T_CATCH + 0.1) / 0.3)
            s.light.data.energy *= k
    bake(s, st, f0, f1, orient=star_orient, after=star_light)

    # ------------------------------------------------------------------ FX
    def spos(t):
        f = f0 + int(round(min(max(t, 0), dur - 1 / FPS) * FPS))
        return star_pos[f]

    def svel(t):
        return (spos(t + 1 / FPS) - spos(t - 1 / FPS)) * (FPS / 2)
    sparkle_trail("Trail", spos, f0, f1, n=18, lag=0.022, size=0.02,
                  alive=lambda t: 1.0 if t < T_CATCH - 0.05 else max(0.0, 1 - (t - T_CATCH) / 0.3))
    impact = Vector((LIE.x, LIE.y + 0.05, lie_gz + 0.08))
    fT = f0 + int(round(T_TUMBLE * FPS))
    fC = f0 + int(round(T_CATCH * FPS))
    if hasattr(fx, "petal_burst"):
        fx.petal_burst(impact, fT, n=130, f1=f1, speed=(1.0, 2.8), up=1.0, seed=3, spread=0.35, name="PetalsT")
        fx.petal_burst(catch_pt[0] + Vector((0, 0, -0.32)), fC, n=28, f1=f1, speed=(0.4, 1.1), seed=5, spread=0.15,
                       name="PetalsC")
    else:
        petals("PetalT", impact, T_TUMBLE, f0, f1, n=160, speed=(1.0, 2.8), up=1.4, seed=3, spread=0.4,
               size=(0.012, 0.022))
    if hasattr(fx, "pollen_burst"):
        fx.pollen_burst(impact + Vector((0, 0, 0.1)), fT + 1, n=110, f1=f1, seed=4, spread=0.35)
    else:
        pollen("PollenT", impact + Vector((0, 0, 0.1)), T_TUMBLE + 0.02, f0, f1, n=50, seed=4)
    if dress is not None and hasattr(dress, "flatten"):
        try:
            dress.flatten((impact.x, impact.y), 1.0)      # the grass laid flat where they landed
        except Exception as e:
            print("SH10: flatten failed", e)
    if hasattr(fx, "fireflies"):
        fx.fireflies((P0.x + 0.3, P0.y + 0.6), 3.2, 46, f0, f1, seed=21, height=(0.25, 1.7),
                     attract=dict(obj=s.rig, radius=1.4, swirl=2.6, pull=0.4))
    elif act1 and hasattr(act1, "fireflies"):
        act1.fireflies(P0 + Vector((0.3, 0.7, 0.95)), 40, f0, f1, seed=21, spread=(4.5, 4.0, 1.5),
                       wake=(spos, svel, 0.9, 1.4))
    else:
        fireflies(P0 + Vector((0.3, 0.7, 0.95)), 40, f0, f1, seed=21, spread=(4.5, 4.0, 1.5), swirl=(spos, 0.3, 1.2))

    # ------------------------------------------------------------------ camera: handheld energy; cranes up with the
    # fall so the faces (now turned up to the sky) stay in the light
    cam = cam_track("Cam", [
        (0.0, "linear", eye0, tgt0, 32, 4.0, None),
        (T_CATCH, "inout", eye0 + Vector((-0.1, -0.12, 0.05)), P0 + Vector((-0.1, 0.22, 0.48)), 32, 4.0, None),
        (T_TUMBLE + 0.15, "inout", eye1, tgt1 + Vector((0, 0.04, 0.06)), 32, 4.0, None),
        (dur, "soft", eye1 + Vector((-0.1, -0.1, -0.05)), tgt1, 33, 4.0, None)],
        f0, f1, seed=101, shake=lambda t: 0.5 if t < T_TUMBLE + 0.3 else 0.28)
    bpy.context.scene.camera = cam

    # ------------------------------------------------------------------ lights: cool moon rim from behind, warm face
    # key motivated by the star
    aimed_light("RimC", c.col, P0 + Vector((-2.2, -2.0, 2.4)), P0 + Vector((0, 0, 0.45)), 30.0, col=(0.55, 0.72, 1.0),
                size=1.5)
    aimed_light("FaceC", c.col, P0 + Vector((1.3, 1.9, 1.9)), P0 + Vector((0, -0.2, 0.4)), 12.0, col=(1.0, 0.72, 0.45),
                size=1.6)
    aimed_light("FaceS", s.col, eye0 + Vector((0, 0, 0.5)), P0 + Vector((0, 0.3, 0.5)), 4.0, col=(1.0, 0.85, 0.65))
    return dict(post=night_post(W, bloom=0.85))
