"""Shared staging for SH01-SH09 (act one: the ritual, the fall, the rescue, the play).

Claude's nightly spot on the north gallery (a crate perch at the rail so its face clears the top rail, the lantern
on an iron hook at its right), the lantern (the warm practical: flame, halo, light; hangs and swings from a hand),
the eye-star's twinkle and its fall, the crater, fireflies, designed camera moves. The lu/ library's helpers
(props.twinkle / falling_star, fx.crater / fireflies) are used when present; simple local versions otherwise."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler

from lu import windmill, interior, geo, mat, props, layout, anim, fx, foliage, scene
from lu import stage as S
from lu.anim import Track, CAM_DEFAULT

FPS = 24
STAR_SCALE = 0.62          # the living star's size (about 0.21 m tip to tip): continuity for every shot
C_EYE = 0.574              # Claude: eye height above its feet (m)
C_H = 0.693                # Claude: total height (m)
LANTERN_SCALE = 0.6        # Claude's hand lantern (0.26 m to the ring)

# ---------------------------------------------------------------- the gallery spot
GAL_R = 4.12               # radius of Claude's mark from the mill axis (the rail posts stand at 4.62)
PERCH_H = 0.85             # crate perch: lifts Claude's whole body above the top rail
HOOK_A = 78.75             # the rail post (deg, 0 = +X) carrying the lantern hook: at Claude's right (east)


def deck_z(O):
    return O.z + windmill.GALLERY_Z + 0.165


def rail_r():
    return windmill.BASE_R / math.cos(windmill.K) + 0.9 - 0.07


def gallery_spot(O):
    """Claude's nightly mark on its perch at the north rail, facing north. Returns (feet position, heading)."""
    gx, gy = layout.GALLERY_N
    d = Vector((gx - O.x, gy - O.y, 0.0)).normalized()
    p = Vector((O.x, O.y, 0.0)) + d * GAL_R
    p.z = deck_z(O) + PERCH_H
    return p, math.degrees(math.atan2(d.x, -d.y))


def hide_tail():
    """The windmill's long tail pole + struts run north over the gallery and the meadow, straight through Claude's
    view of the constellation: keep them out of these shots."""
    for o in bpy.data.objects:
        if o.name.startswith(("TailPole", "TailStrut", "TailWheel")):
            o.hide_render = True
            o.hide_viewport = True


def perch(W, p, hd):
    """Two stacked crates (a worn grain crate + a flat box on top) and a sack slumped against them."""
    M = W.wm["mats"] if W.wm else windmill.mats()
    O = W.origin
    dz = deck_z(O)
    parts = []
    parts.append(geo.box("PerchCrate", (0.86, 0.54, 0.38), loc=(0, 0, 0.19), mat=M["wood"], bevel=0.015))
    for z in (0.07, 0.31):
        parts.append(geo.box("PerchSlat", (0.88, 0.56, 0.05), loc=(0, 0, z), mat=M["wood_dark"], bevel=0.008))
    for sx in (-0.41, 0.41):
        parts.append(geo.box("PerchPost", (0.06, 0.58, 0.38), loc=(sx, 0, 0.19), mat=M["wood_dark"], bevel=0.008))
    top = geo.box("PerchTop", (0.8, 0.5, 0.47), loc=(0.02, 0.01, 0.38 + 0.235), mat=M["wood_grey"], bevel=0.02)
    top.rotation_euler = (0, 0, math.radians(4))
    parts.append(top)
    ob = geo.join(parts, "Perch")
    ob.matrix_basis = Matrix.Translation((p.x, p.y, dz - 0.005)) @ Matrix.Rotation(math.radians(hd), 4, "Z")
    sk = geo.rounded_box("PerchSack", (0.42, 0.3, 0.42), 0.12, seg=(2, 2, 2), n_r=3, mat=M["sack"])
    geo.displace_noise(sk, 0.025, 0.2, seed=3)
    side = Vector((math.cos(math.radians(hd)), math.sin(math.radians(hd)), 0))     # Claude's left
    fwd = Vector((math.sin(math.radians(hd)), -math.cos(math.radians(hd)), 0))
    sp = p - side * 0.58 - fwd * 0.12
    sk.location = (sp.x, sp.y, dz + 0.19)
    sk.rotation_euler = (0.1, -0.2, math.radians(hd + 20))
    return ob


def hook(W):
    """Iron lantern hook on the rail post at Claude's right, its arm reaching back along the rail toward Claude so the
    lantern hangs right beside it at face height: returns the hanging point (the lantern ring)."""
    M = W.wm["mats"] if W.wm else windmill.mats()
    O = W.origin
    dz = deck_z(O)
    a = math.radians(HOOK_A)
    out = Vector((math.cos(a), math.sin(a), 0))
    post = Vector((O.x, O.y, 0)) + out * rail_r()
    spot, _ = gallery_spot(O)
    toward = Vector((spot.x - post.x, spot.y - post.y, 0)).normalized()
    parts = [geo.box("HookBar", (0.03, 0.03, 0.66), loc=(post.x, post.y, dz + 1.0 + 0.33), mat=M["iron"])]
    L = 0.36
    arm_c = post + toward * (L / 2) + Vector((0, 0, dz + 1.64))
    arm = geo.box("HookArm", (0.03, L, 0.025), mat=M["iron"])
    arm.location = arm_c
    arm.rotation_euler = (0, 0, math.atan2(toward.y, toward.x) - math.pi / 2)
    parts.append(arm)
    brace = geo.box("HookBrace", (0.02, 0.22, 0.02), mat=M["iron"])
    bc = post + toward * 0.09 + Vector((0, 0, dz + 1.55))
    brace.location = bc
    brace.rotation_euler = (math.radians(-40), 0, math.atan2(toward.y, toward.x) - math.pi / 2)
    parts.append(brace)
    hk = geo.lathe("HookCurl", [(0.012, -0.03), (0.02, 0.0), (0.012, 0.01)], seg=8, mat=M["iron"])
    tip = post + toward * (L - 0.02)
    hk.location = (tip.x, tip.y, dz + 1.62)
    parts.append(hk)
    geo.join(parts, "LanternHook")
    return Vector((tip.x, tip.y, dz + 1.605))


def gallery_set(W, f0, f1, lantern_on_hook=True, sway=0.06, seed=0):
    """Claude's nightly spot: perch + hook + the lantern hanging (gently swaying). Returns dict(p, hd, lan, hook)."""
    O = W.origin
    hide_tail()
    p, hd = gallery_spot(O)
    perch(W, p, hd)
    hp = hook(W)
    lan = lantern("Lantern", energy=16.0)
    if lantern_on_hook:
        hang(lan, lambda t: hp, f0, f1, init=(sway, sway * 0.6), damp=0.25, seed=seed)
    return dict(p=p, hd=hd, lan=lan, hook=hp)


def mow(center, radius):
    """Clear ground cover around a spot: the card meadow (foliage.mow) and the dressed cover (dress.mow) if present."""
    c = Vector(center)
    foliage.mow(c, radius)
    try:
        from lu import dress
        if hasattr(dress, "mow"):
            dress.mow((c.x, c.y), radius)
    except Exception as e:      # the dressing module is under construction by the environment agents
        print("act1.mow: dress.mow unavailable:", e)


def flag(name, center, size, normal):
    """A lighting 'flag': a plane that only casts shadows (invisible to camera and bounce), to cut moonlight off a
    surface that pulls focus (a cinematographer's solid)."""
    o = geo.box(name, (size[0], 0.01, size[1]))
    n = Vector(normal).normalized()
    o.matrix_basis = Matrix.Translation(Vector(center)) @ n.to_track_quat("Y", "Z").to_matrix().to_4x4()
    o.visible_camera = False
    o.visible_diffuse = False
    o.visible_glossy = False
    o.visible_transmission = False
    o.visible_volume_scatter = False
    o.visible_shadow = True
    return o


def moon_flag(names=("Tower", "CornerPosts"), lights=("LU_Sun", "LU_SouthFill"), name="MoonFlag"):
    """Light-link the moon (and fill) to exclude objects - the CG flag: in the close-ups the timber tower behind
    Claude drops into soft shadow so its moonlit boards don't pull focus from the face."""
    coll = bpy.data.collections.new(name)
    for nm in names:
        o = bpy.data.objects.get(nm)
        if o is not None:
            coll.objects.link(o)
    for co in coll.collection_objects:
        co.light_linking.link_state = "EXCLUDE"
    for ln in lights:
        lo = bpy.data.objects.get(ln)
        if lo is not None:
            lo.light_linking.receiver_collection = coll
    return coll


# ---------------------------------------------------------------- the lantern
def _flame_mat():
    m = bpy.data.materials.get("LanternFlame")
    if m:
        return m
    return mat.emissive("LanternFlame", (1.0, 0.62, 0.22), 14.0)


def lantern(name="Lantern", energy=9.0, scale=LANTERN_SCALE, halo=0.75):
    """Claude's hand lantern: brass + glass (interior.lantern) with a flame, an amber halo and a practical light.
    Origin at its base; the ring is at ring_h above it."""
    M = interior.mats()
    L = interior.lantern(bpy.context.scene.collection, M, name=name)
    root = L["root"]
    root.scale = (scale, scale, scale)
    fl = geo.lathe(name + "_flame", [(0.0, 0.0), (0.022, 0.02), (0.016, 0.05), (0.0, 0.085)], seg=10, mat=_flame_mat())
    fl.parent = root
    fl.location = (0, 0, 0.1)
    fl.visible_shadow = False
    hm = props._soft_mat("LanternHalo", (1.0, 0.58, 0.22), "halo", 2.2, power=2.4, alpha=0.5)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=0.3)
    h = bpy.context.active_object
    h.name = name + "_halo"
    h.data.materials.append(hm)
    h.data.shade_smooth()
    h.parent = root
    h.location = (0, 0, 0.17)
    h.visible_shadow = False
    h["halo"] = halo
    ld = bpy.data.lights.new(name + "_light", "POINT")
    ld.color = (1.0, 0.6, 0.26)
    ld.energy = energy
    ld.shadow_soft_size = 0.04
    lo = bpy.data.objects.new(name + "_light", ld)
    bpy.context.scene.collection.objects.link(lo)
    lo.parent = root
    lo.location = (0, 0, 0.17)
    for o in (L["frame"], L["glass"]):
        o.visible_shadow = True
    return dict(root=root, light=lo, flame=fl, halo=h, ring_h=0.44 * scale, scale=scale)


def hang(lan, pivot_fn, f0, f1, yaw_fn=None, damp=2.6, gain=1.0, init=(0.0, 0.0), flicker=0.06, seed=0):
    """Key a hanging lantern whose ring follows pivot_fn(t) -> world Vector, as a damped 2-D pendulum driven by the
    pivot's acceleration (it lags, swings and settles when carried). yaw_fn(t) -> degrees turns it with its carrier."""
    root = lan["root"]
    L = lan["ring_h"]
    g = 9.81
    sub = 8
    dt = 1.0 / FPS / sub
    thx, thy = init
    vx = vy = 0.0
    n = f1 - f0
    piv = [Vector(pivot_fn(i / FPS)) for i in range(-2, n + 3)]
    ld = lan["light"].data
    e0 = ld.energy
    for i in range(n):
        f = f0 + i
        p_prev, p0, p_next = piv[i + 1], piv[i + 2], piv[i + 3]
        acc = (p_next - 2 * p0 + p_prev) * (FPS * FPS) * gain
        for _ in range(sub):
            ax = -(g * math.sin(thx) + acc.x * math.cos(thx)) / L - damp * vx
            ay = -(g * math.sin(thy) + acc.y * math.cos(thy)) / L - damp * vy
            vx += ax * dt
            vy += ay * dt
            thx += vx * dt
            thy += vy * dt
        t = i / FPS
        yaw = math.radians(yaw_fn(t)) if yaw_fn else 0.0
        R = Matrix.Rotation(-thx, 4, "Y") @ Matrix.Rotation(thy, 4, "X")
        hang_v = (R @ Vector((0, 0, -L, 0))).to_3d()
        s = lan["scale"]
        root.matrix_world = Matrix.Translation(p0 + hang_v) @ R @ Matrix.Rotation(yaw, 4, "Z") @ \
            Matrix.Diagonal((s, s, s, 1.0))
        root.keyframe_insert("location", frame=f)
        root.keyframe_insert("rotation_euler", frame=f)
        root.keyframe_insert("scale", frame=f)
        ld.energy = e0 * (1 + flicker * (math.sin(t * 23 + seed) * 0.6 + math.sin(t * 37.7 + 2 * seed) * 0.4))
        ld.keyframe_insert("energy", frame=f)


def place_lantern(lan, pos, yaw=0.0):
    s = lan["scale"]
    lan["root"].matrix_world = Matrix.Translation(Vector(pos)) @ Matrix.Rotation(math.radians(yaw), 4, "Z") @ \
        Matrix.Diagonal((s, s, s, 1.0))


# ---------------------------------------------------------------- characters: baking with the hand tracked
def bake_tracking(ch, fn, f0, f1, bones=()):
    """Bake a character like ch.bake and also return {bone: [world tail position per frame]} for the given bones."""
    out = {b: [] for b in bones}
    vl = bpy.context.view_layer
    for f in range(f0, f1 + 1):
        ch.apply(fn(f))
        ch.key(f)
        if bones:
            vl.update()
            for b in bones:
                pb = ch.rig.pose.bones[b]
                out[b].append((ch.rig.matrix_world @ pb.tail).copy())
    return out


def star_rot(heading, pitch, roll=0.0):
    """The star rig applies its euler in ZXY order (heading first, then pitch about the WORLD X axis), so a pitch
    doesn't follow its heading. Returns the rig's (heading, pitch, roll) for 'face `heading`, then lean back by
    `pitch` about its own X axis, then roll about its own Y' as a dict to merge into a star pose."""
    M = Matrix.Rotation(math.radians(heading), 3, "Z") @ Matrix.Rotation(math.radians(pitch), 3, "X") @ \
        Matrix.Rotation(math.radians(roll), 3, "Y")
    e = M.to_euler("ZXY")
    return dict(heading=math.degrees(e.z), pitch=math.degrees(e.x), roll=math.degrees(e.y))


def hand_local(c, bone, pose):
    """Tip of `bone` (character-local metres, character at the origin, heading 0) in `pose`."""
    p = dict(pose)
    p.update(x=0.0, y=0.0, z=0.0, heading=0.0, hop=0.0)
    c.apply(p)
    bpy.context.view_layer.update()
    pb = c.rig.pose.bones[bone]
    return c.rig.matrix_world @ pb.tail


# ---------------------------------------------------------------- the constellation
def constellation(O, lines=0.3, eye=1.0, center=None):
    kw = dict(origin=(O.x, O.y, 0), lines=lines, eye=eye)
    if center is not None:
        kw["center"] = center
    return props.constellation(**kw)


def key_lines(K, f0, f1, fn, step=2):
    """Chart-line visibility over the shot (shared CS_Ctrl.Line when available)."""
    for f in range(f0, f1 + 1, step):
        v = fn((f - f0) / FPS)
        if hasattr(props, "key_lines"):
            props.key_lines(v, f)
        else:
            for ln in K["lines"]:
                ln["line"] = v
                ln.keyframe_insert('["line"]', frame=f)


def key_eye(K, f0, f1, fn, wobble=None):
    """fn(t) -> (brightness, scale) for the right-eye star; wobble(t) -> world offset Vector (or None)."""
    eo = K["eye"]
    base = eo.location.copy()
    for f in range(f0, f1 + 1):
        t = (f - f0) / FPS
        b, s = fn(t)
        eo["eye"] = b
        eo.scale = (s, s, s)
        eo.location = base + (wobble(t) if wobble else Vector())
        eo.keyframe_insert('["eye"]', frame=f)
        eo.keyframe_insert("scale", frame=f)
        eo.keyframe_insert("location", frame=f)


def twinkle_fn(times, base=1.0, peak=2.8, dur=0.36, grow=0.45):
    """Brightness/scale pulses (the eye's 'blink back')."""
    def f(t):
        e = base
        for tb in times:
            u = (t - tb) / dur
            if 0 <= u <= 1:
                e += (peak - base) * math.sin(math.pi * u) ** 1.5
        return e, 1 + grow * (e - base) / max(peak - base, 1e-3)
    return f


# ---------------------------------------------------------------- glowing bead streaks (the falling eye-star)
def _bead_mat(name, color, strength=6.0, power=1.6, alpha=1.0):
    return props._soft_mat(name, color, "life", strength, power=power, alpha=alpha)


def _bead(name, m, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1.0)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(m)
    o.data.shade_smooth()
    o.visible_shadow = False
    return o


def streak(name, pos_fn, t0, t1, f0, f1, cam_fn, n=34, tail=0.42, size=0.0065, head=2.2, color=(1.0, 0.72, 0.32),
           core_col=(1.0, 0.93, 0.75), sparkle_n=46, seed=0, size_fn=None):
    """A sparkling falling streak: a hot core + halo at pos_fn(t), a chain of glow beads along the recent path
    (tail seconds long, tapering and fading), and sparkles shed along the way that drift and wink out. Sizes are
    angular (radians at the camera position cam_fn(t)) so it reads the same from 600 m to 5 m."""
    rng = np.random.default_rng(seed)
    hm = _bead_mat(name + "_HaloM", color, 3.2, power=2.2, alpha=0.75)
    cm = _bead_mat(name + "_CoreM", core_col, 30.0, power=0.6, alpha=2.0)
    tm = _bead_mat(name + "_TailM", color, 7.0, power=1.3, alpha=1.0)
    sm = _bead_mat(name + "_SparkM", (1.0, 0.85, 0.55), 18.0, power=0.8, alpha=1.5)
    core = _bead(name + "_core", cm)
    halo = _bead(name + "_halo", hm)
    beads = [_bead(f"{name}_t{i}", tm, sub=1) for i in range(n)]
    sparks = [_bead(f"{name}_s{i}", sm, sub=1) for i in range(sparkle_n)]
    sp_specs = []
    for i in range(sparkle_n):
        ts = rng.uniform(t0 + 0.05, t1 - 0.05)
        sp_specs.append((ts, rng.uniform(0.25, 0.7), Vector(rng.normal(0, 1, 3)), rng.uniform(0.25, 0.6)))

    def ang(p, t):
        return max((Vector(p) - Vector(cam_fn(t))).length, 0.05)

    for f in range(f0, f1 + 1):
        t = (f - f0) / FPS
        live = t0 <= t <= t1 + 0.01
        k = size_fn(t) if size_fn else 1.0
        if live:
            p = Vector(pos_fn(t))
            d = ang(p, t)
            for o, r, lf in ((core, size * k * d, 1.0), (halo, size * head * 2.2 * k * d, 1.0)):
                o.location = p
                o.scale = (r, r, r)
                o["life"] = lf
        else:
            for o in (core, halo):
                o.scale = (1e-4,) * 3
                o["life"] = 0.0
        for o in (core, halo):
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        for i, o in enumerate(beads):
            u = (i + 1) / n
            tb = t - u * tail
            if live and tb >= t0:
                p = Vector(pos_fn(tb))
                d = ang(p, t)
                r = size * k * d * (1.6 * (1 - u) ** 0.8 + 0.25)
                o.location = p
                o.scale = (r, r, r)
                o["life"] = (1 - u) ** 1.4
            else:
                o.scale = (1e-4,) * 3
                o["life"] = 0.0
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        for o, (ts, life, dirv, spd) in zip(sparks, sp_specs):
            u = (t - ts) / life
            if 0 <= u <= 1:
                p0 = Vector(pos_fn(ts))
                d = ang(p0, t)
                p = p0 + dirv.normalized() * spd * d * 0.02 * u + Vector((0, 0, -0.012 * d * u * u))
                r = size * 0.5 * k * d * (1 - u) ** 0.5
                o.location = p
                o.scale = (r, r, r)
                o["life"] = (1 - u) * (0.6 + 0.4 * math.sin(u * 40 + ts * 13))
            else:
                o.scale = (1e-4,) * 3
                o["life"] = 0.0
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
    return dict(core=core, halo=halo, beads=beads, sparks=sparks)


# ---------------------------------------------------------------- the crater
def _char_mat():
    m = bpy.data.materials.get("Scorch")
    if m:
        return m
    return mat.painterly("Scorch", (0.09, 0.07, 0.06), stroke="strokes_broad", scale=2.0, tex_amt=1.2, breakup=1.4,
                         bump=0.3, color2=(0.24, 0.16, 0.10), c2_thresh=(0.55, 0.7), ao=0.6)


def _dirt_mat():
    m = bpy.data.materials.get("CraterDirt")
    if m:
        return m
    return mat.painterly("CraterDirt", (0.30, 0.21, 0.14), stroke="strokes_broad", scale=2.5, tex_amt=1.2, breakup=1.4,
                         bump=0.35, color2=(0.20, 0.24, 0.12), c2_thresh=(0.6, 0.7), ao=0.6)


def crater(W, center, f0, f1, radius=0.5, heading=180.0, smoke=True, embers=40, seed=7, furrow=1.6, glow=1.0):
    """The scorched crater the star fell into (local version until fx.crater exists): a shallow charred bowl with a
    thrown-up rim of turf and dirt clods, a burnt furrow behind it (where it skidded in, from `heading`), glowing
    embers and rising smoke. Grass is mowed around it. Returns dict(center=bowl centre (world, on the bowl floor))."""
    if hasattr(fx, "crater"):
        # fx.crater's heading = where the star came FROM (0 = +X, 90 = north); ours is a character heading
        h = math.radians(heading)
        frm = -Vector((math.sin(h), -math.cos(h), 0))
        R = fx.crater((center[0], center[1]), f0, f1, radius=radius, heading=math.degrees(math.atan2(frm.y, frm.x)),
                      furrow=furrow, seed=seed, glow=glow, smoke_on=False)
        if smoke:
            fx.smoke("CraterSmoke", (center[0], center[1], R["floor_z"] + 0.05), f0, f1, rate=8.0, seed=seed,
                     color=(0.42, 0.41, 0.45), opacity=0.06, rise=0.45, grow=(0.015, 0.11), drift=(0.05, -0.04, 0.0))
        R["ground"] = W.ground(center[0], center[1])
        R["glow"] = R.get("light")
        return R
    rng = np.random.default_rng(seed)
    cx, cy = center[0], center[1]
    gz = W.ground(cx, cy)
    mow((cx, cy, gz), radius * 1.45)
    # bowl: a displaced disc, depressed centre, raised lip
    nr, na = 14, 48
    verts, faces = [(0.0, 0.0, -0.09)], []
    R_out = radius * 1.9
    for j in range(1, nr + 1):
        r = R_out * j / nr
        for i in range(na):
            a = 2 * math.pi * i / na
            jit = 1 + 0.12 * math.sin(a * 3 + seed) + 0.07 * math.sin(a * 7 + 1.3)
            rr = r * jit
            x, y = rr * math.cos(a), rr * math.sin(a)
            q = rr / radius
            z = -0.09 * max(0.0, 1 - q * q) + 0.07 * math.exp(-((q - 1.05) / 0.28) ** 2) - 0.03 * max(0.0, q - 1.7)
            z += float(W.ground(cx + x, cy + y)) - gz + rng.normal(0, 0.006)
            verts.append((x, y, z))
    for i in range(na):
        faces.append((0, 1 + i, 1 + (i + 1) % na))
    for j in range(nr - 1):
        for i in range(na):
            a = 1 + j * na + i
            b = 1 + j * na + (i + 1) % na
            faces.append((a, b, b + na, a + na))
    bowl = geo.obj_from("CraterBowl", verts, faces, mat=_char_mat())
    bowl.location = (cx, cy, gz + 0.012)
    # charred-to-dirt blend: a second ring of dirt clods on the lip
    dm = _dirt_mat()
    clods = []
    for i in range(26):
        a = rng.uniform(0, 2 * math.pi)
        r = radius * rng.uniform(0.95, 1.6)
        s = rng.uniform(0.03, 0.08)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        c = geo.rounded_box("Clod", (s * 1.6, s * 1.2, s), s * 0.4, seg=(2, 2, 2), n_r=2, mat=dm)
        geo.displace_noise(c, s * 0.3, 0.05, seed=i)
        c.location = (x, y, float(W.ground(x, y)) + s * 0.25 + 0.04 * math.exp(-((r / radius - 1.05) / 0.3) ** 2))
        c.rotation_euler = Euler(rng.uniform(0, 3, 3))
        clods.append(c)
    geo.join(clods, "CraterClods")
    # the furrow it skidded along
    if furrow > 0:
        h = math.radians(heading)
        back = Vector((math.sin(h), -math.cos(h), 0)) * -1      # from the crater back along where it came from
        fv, ff = [], []
        nseg = 16
        for k in range(nseg + 1):
            u = k / nseg
            pc = Vector((cx, cy, 0)) + back * (radius * 0.6 + furrow * u)
            w = 0.16 * (1 - u * 0.7)
            sd = Vector((-back.y, back.x, 0))
            for s in (-1, 1):
                q = pc + sd * w * s
                fv.append((q.x, q.y, float(W.ground(q.x, q.y)) + 0.012))
        for k in range(nseg):
            a = 2 * k
            ff.append((a, a + 1, a + 3, a + 2))
        fob = geo.obj_from("CraterFurrow", fv, ff, mat=_char_mat())
        mow((cx + back.x * (radius + furrow * 0.5), cy + back.y * (radius + furrow * 0.5), gz), 0.32)
        for k in range(4):
            q = Vector((cx, cy, 0)) + back * (radius + furrow * (k + 0.5) / 4)
            mow((q.x, q.y, gz), 0.22)
    # embers: tiny hot dabs in the bowl and on the lip, pulsing
    em_m = fx._life_emissive("Ember", (1.0, 0.45, 0.12), 30.0)
    ems = []
    for i in range(embers):
        a = rng.uniform(0, 2 * math.pi)
        r = radius * math.sqrt(rng.uniform(0.0, 1.0)) * 1.25
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        q = r / radius
        z = gz + 0.012 - 0.09 * max(0.0, 1 - q * q) + 0.07 * math.exp(-((q - 1.05) / 0.28) ** 2) + 0.008
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=rng.uniform(0.006, 0.014), location=(x, y, z))
        o = bpy.context.active_object
        o.name = f"Ember{i}"
        o.data.materials.append(em_m)
        o.visible_shadow = False
        ph, fq = rng.uniform(0, 6.28), rng.uniform(1.5, 4.0)
        for f in range(f0, f1 + 1, 2):
            t = (f - f0) / FPS
            o["life"] = 0.25 + 0.75 * max(0.0, math.sin(t * fq + ph)) ** 2
            o.keyframe_insert('["life"]', frame=f)
        ems.append(o)
    # rising smoke wisps
    if smoke:
        fx.steam("CraterSmoke", (cx, cy, gz + 0.05), f0 - 48, f1, rate=4.0, seed=seed, color=(0.42, 0.42, 0.46),
                 opacity=0.32)
    glow = scene.point("CraterGlow", (cx, cy, gz + 0.12), (1.0, 0.5, 0.18), 6.0, 0.3, shadow=False)
    return dict(center=Vector((cx, cy, gz - 0.07)), ground=gz, glow=glow, bowl=bowl)


# ---------------------------------------------------------------- foreground flowers (for low cameras)
FLOWER_COLS = [(0.86, 0.83, 0.74), (0.86, 0.83, 0.74), (0.22, 0.36, 0.86), (0.56, 0.40, 0.82), (0.92, 0.46, 0.62),
               (1.0, 0.76, 0.22)]


def fg_flowers(name, center, radius, count, ground_fn, seed=0, height=(0.12, 0.36), head=(0.03, 0.06), avoid=None):
    """Wildflowers on stems (daisies, cornflowers, violets, clover, a few yellow) - big enough to read as soft
    petals in a low camera's foreground. Named Patch* so foliage.mow clears them too."""
    rng = np.random.default_rng(seed)
    stems, heads = [], []
    for i in range(count):
        r = radius * math.sqrt(rng.random())
        a = rng.uniform(0, 2 * math.pi)
        x, y = center[0] + r * math.cos(a), center[1] + r * math.sin(a)
        if avoid and avoid(x, y):
            continue
        z = float(ground_fn(x, y))
        h = rng.uniform(*height)
        ang = rng.uniform(0, math.pi)
        lean = Vector((rng.normal(0, 0.14), rng.normal(0, 0.14), 1.0)).normalized()
        base = Vector((x, y, z))
        top = base + lean * h
        rt = Vector((math.cos(ang), math.sin(ang), 0)) * 0.014
        sh = rng.random()
        stems.append((base + lean * h * 0.5, rt, lean * h * 0.5, Vector((0, 0, 1)), int(rng.integers(0, 16)),
                      (0.16 + 0.1 * sh, 0.30 + 0.08 * sh, 0.10)))
        hs = rng.uniform(*head)
        fc = FLOWER_COLS[int(rng.integers(0, len(FLOWER_COLS)))]
        fc = tuple(min(1.0, c * rng.uniform(0.85, 1.1)) for c in fc)
        for k in range(2):
            aa = ang + k * math.pi / 2
            hrt = Vector((math.cos(aa), math.sin(aa), 0)) * hs
            heads.append((top + Vector((0, 0, hs * 0.3)), hrt, Vector((0, 0, hs * 0.85)), Vector((0, 0, 1)),
                          int(rng.integers(0, 16)), fc))
    col = geo.coll("Grass")
    out = []
    if stems:
        out.append(foliage._cards(name + "_stems", stems, col,
                                  foliage.card_mat("GrassBlades", "dab_blade", translucent=0.3, scale=2.0)))
        out.append(foliage._cards(name + "_heads", heads, col,
                                  foliage.card_mat("Flowers", "dab_leaf", translucent=0.2, scale=3.0)))
    return out


def glow_pool(name, center, radius, f0, f1, fn, color=(1.0, 0.6, 0.2), strength=2.4, alpha=0.5, light=0.0):
    """A soft painted pool of glow (camera-facing falloff) hovering over a hot spot, keyed by fn(t) (0..>1); with
    light > 0 also a warm point light (W at fn = 1)."""
    m = props._soft_mat(name + "M", color, "glow", strength, power=2.0, alpha=alpha)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0, location=center)
    o = bpy.context.active_object
    o.name = name
    o.data.materials.append(m)
    o.data.shade_smooth()
    o.visible_shadow = False
    o.scale = (radius, radius, radius * 0.55)
    lo = scene.point(name + "_light", Vector(center) + Vector((0, 0, 0.08)), color, 0.0, radius * 0.5,
                     shadow=False) if light > 0 else None
    for f in range(f0, f1 + 1):
        t = (f - f0) / FPS
        v = fn(t)
        o["glow"] = v
        o.keyframe_insert('["glow"]', frame=f)
        if lo:
            lo.data.energy = light * v
            lo.data.keyframe_insert("energy", frame=f)
    return o


# ---------------------------------------------------------------- fireflies
def fireflies(center, n, f0, f1, seed=0, spread=(3.0, 3.0, 1.2), wake=None, size=0.012, strength=40.0):
    """Drifting fireflies (local version). wake = (pos_fn(t), vel_fn(t), radius, push): fireflies near the moving
    star are swept along its path and spiral back (the swirl in its wake)."""
    if hasattr(fx, "fireflies") and wake is None:
        rad = 0.5 * max(spread[0], spread[1])
        z = center[2] if len(center) > 2 else None
        return fx.fireflies((center[0], center[1]), rad, n, f0, f1, seed=seed,
                            height=(0.2, 0.2 + spread[2] * 1.2) if z is None else (0.2, 1.6), name=f"Fireflies{seed}")
    rng = np.random.default_rng(seed)
    m = bpy.data.materials.get("Firefly") or fx._life_emissive("Firefly", (0.78, 1.0, 0.38), strength)
    objs = []
    for i in range(n):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size * rng.uniform(0.7, 1.3))
        o = bpy.context.active_object
        o.name = f"Firefly{i}"
        o.data.materials.append(m)
        o.visible_shadow = False
        p0 = Vector(center) + Vector(rng.uniform(-0.5, 0.5, 3)) * Vector(spread)
        ph = rng.uniform(0, 6.28, 4)
        fq = rng.uniform(0.3, 0.8, 3)
        off = Vector()
        vel = Vector()
        for f in range(f0, f1 + 1):
            t = (f - f0) / FPS
            d = Vector((math.sin(t * fq[0] + ph[0]) * 0.4, math.cos(t * fq[1] + ph[1]) * 0.4,
                        math.sin(t * fq[2] + ph[2]) * 0.2))
            if wake is not None:
                pf, vf, rad, push = wake
                sp = Vector(pf(t))
                here = p0 + d + off
                dist = (here - sp).length
                if dist < rad:
                    w = (1 - dist / rad) ** 2
                    sv = Vector(vf(t))
                    swirl = sv.cross(Vector((0, 0, 1))).normalized() * sv.length * 0.35 if sv.length > 1e-3 else Vector()
                    vel += (sv * 0.9 + swirl) * w * push / FPS
                vel *= 0.93
                off += vel / FPS
                off *= 0.985
            o.location = p0 + d + off
            o["life"] = 0.15 + 0.85 * max(0.0, math.sin(t * 2.2 + ph[3])) ** 3
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        objs.append(o)
    return objs


# ---------------------------------------------------------------- cameras
def cam_move(name, f0, f1, keys, shake=0.0, seed=0, fstop=0.0, roll_keys=None, layers=()):
    """Designed camera: keys = [(t, ease, eye, target, lens, focus_dist or None)]. Returns the camera object."""
    cam = scene.camera(name, lens=keys[0][4])
    ct = Track(CAM_DEFAULT)
    for (t, e, eye, tgt, lens, foc) in keys:
        kw = dict(cx=eye[0], cy=eye[1], cz=eye[2], tx=tgt[0], ty=tgt[1], tz=tgt[2], lens=lens, fstop=fstop)
        kw["focus"] = foc if foc else (Vector(tgt) - Vector(eye)).length
        ct.key(t, e, **kw)
    if roll_keys:
        for (t, e, r) in roll_keys:
            ct.key(t, e, roll=r)
    ct.layer(lambda t, p: p.update(shake=p.get("shake", 0.0) + shake))
    for ly in layers:
        ct.layer(ly)
    anim.bake_camera(cam, ct, f0, f1 - 1, seed=seed)
    return cam


def cam_pos(cam, f):
    sc = bpy.context.scene
    sc.frame_set(f)
    return cam.matrix_world.translation.copy()
