"""Shared staging for BLOOM acts I-II (ASH + THE CLOCK, shots B01-B07): the kneeling mark at the seed, Claude and
the Sprout set-up and baking, designed cameras with cuts, and the act's small effects (the glow under the ash, the
ash heap over the seed, breath puffs).

Staging (world metres, +Y north, +X east; Claude faces -Y at heading 0):
  The seed lies in the ash at the stump's south foot. layout.SEED is only 0.3 m from the trunk's flared base, too close
  for Claude to kneel at it facing the camera, so these shots use SEED_SPOT, 0.75 m further out along the same radius
  (SSE of the trunk, between the door-hole and the south-east root). Claude kneels just north of it facing south
  (KNEEL), so a camera to the south sees its face with its ruined home behind it: the door-hole on the left, the charred
  swing on the right. B05 looks north-west past it at the storm wall; in B06 Claude turns to the peak (north-north-east,
  az ~79 deg) and in B07 it runs north, screen right, toward the climb (B08)."""
import math
import bpy
import numpy as np
from mathutils import Vector

from lu import anim, layout, claude as CL, sprout as SP, geo, mat, fx, stage
from lu.anim import Track, CAM_DEFAULT

FPS = 24
# ---------------------------------------------------------------- the marks
_rad = Vector((layout.SEED[0] - layout.STUMP[0], layout.SEED[1] - layout.STUMP[1], 0.0)).normalized()
SEED_SPOT = (layout.SEED[0] + _rad.x * 0.75, layout.SEED[1] + _rad.y * 0.75)      # ~(1.23, -3.05)
KNEEL_HEADING = 0.0                       # faces south
KNEEL_REACH = 0.40                        # root -> hands (m)
_h = math.radians(KNEEL_HEADING)
_front = Vector((math.sin(_h), -math.cos(_h), 0.0))
KNEEL_XY = (SEED_SPOT[0] - _front.x * KNEEL_REACH, SEED_SPOT[1] - _front.y * KNEEL_REACH)
# B06-B07: the trunk hides the peak from the kneeling mark, so Claude stands at a lookout just east of it (a cheat
# across the B05/B06 cut) from where the peak is clear of the trunk and the run north passes east of the swing
LOOKOUT_XY = (3.25, -2.15)
PEAK_AZ = math.degrees(math.atan2(layout.PEAK[1] - LOOKOUT_XY[1], layout.PEAK[0] - LOOKOUT_XY[0]))
PEAK_HEADING = PEAK_AZ + 90.0             # heading that faces the peak (heading h faces azimuth h - 90)

ASH_PUFF = (0.30, 0.285, 0.27)             # ash dust colour for puffs (the palette default glows too white here)

# Claude's material state through the ash act
ASH = dict(ash=0.55)
# the act's grade: the phase presets desaturate globally (sat 0.80 / 0.86), which turns Claude's orange salmon-pink;
# the ash world is grey by itself, so these shots keep saturation at 1 and Claude stays the one warm colour
SAT = 1.0


def front(heading):
    h = math.radians(heading)
    return Vector((math.sin(h), -math.cos(h), 0.0))


def left(heading):
    h = math.radians(heading)
    return Vector((math.cos(h), math.sin(h), 0.0))


def at_char(x, y, heading, fwd=0.0, side=0.0):
    """World xy of a point fwd metres in front of / side metres to the left of a character at (x, y, heading)."""
    f, l_ = front(heading), left(heading)
    return (x + f.x * fwd + l_.x * side, y + f.y * fwd + l_.y * side)


# ---------------------------------------------------------------- characters
def bake_claude(c, tr, f0, f1, mouth=(), settle=0.7):
    """anchor (every channel keyed only later starts at DEFAULT) + bake the track over the shot. The mascot has no
    mouth: every mouth channel is zeroed except those named in `mouth` (B04's tiny smile); the eyes, the body and the
    arms carry the acting. settle: no channel glides longer than this before the key that ends it (anim.settle,
    which also anchors every channel at its default)."""
    keep = set(mouth)

    def no_mouth(t, p):
        for k in CL.MOUTH_PROPS:
            if k not in keep:
                p[k] = 0.0
    tr.layer(no_mouth)
    anim.settle(tr, CL.DEFAULT, max_gap=settle)
    anim.prepare_layers(tr)
    c.bake(lambda f: tr.at((f - f0) / FPS), f0, f1 - 1)


def bake_sprout(s, tr, f0, f1, settle=0.7):
    anim.settle(tr, SP.DEFAULT, max_gap=settle)
    anim.prepare_layers(tr)
    s.bake(lambda f: tr.at((f - f0) / FPS), f0, f1 - 1)


def ground_z(x, y):
    """Terrain height (with the hero micro-relief) without needing the World (dress.surface)."""
    from lu import dress
    return float(dress.surface(np.array([x]), np.array([y]))[0])


def new_claude(name="Claude"):
    """Claude without the World (build characters before World(...) when a shot needs pose solves: frame_set is cheap
    while the heavy GN world doesn't exist yet)."""
    from lu import framing
    c = CL.Claude(name)
    framing.register_char(c)
    return c


def sprout(name="Sprout", light=True, light_scale=1.0):
    """The Sprout, registered for framing. light_scale scales its practical light only (not its glow on screen):
    at close range under Claude's face the full light bleaches the terracotta to pale yellow."""
    from lu import framing
    s = SP.Sprout(name, light=light)
    framing.register_char(s)
    if light and s.light is not None and light_scale != 1.0:
        ad = s.light.data.animation_data
        for fc in (ad.drivers if ad else []):
            if fc.data_path == "energy":
                fc.driver.expression = f"v*{light_scale:.4f}"
    return s


def cam_move(name, f0, f1, keys, shake=0.0, seed=0, fstop=0.0, layers=(), roll_keys=None, bind=True):
    """Designed camera: keys = [(t, ease, eye, target, lens, focus_dist or None)] (shot-local seconds).
    fstop > 0 turns on depth of field (focus = focus_dist, or the eye->target distance)."""
    from lu import scene
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
    cam.data.clip_start = 0.01
    if bind:
        bpy.context.scene.camera = cam
    return cam


def hide_render_range(cols, fa, fb):
    """Hide every renderable object of the given collections in [fa, fb) (e.g. Claude during its own POV). Only
    hide_render is keyed so rigs, drivers and constraints keep evaluating."""
    for col in cols:
        for o in col.all_objects:
            if o.type in ("MESH", "CURVE", "LIGHT"):
                o.hide_render = True
                o.keyframe_insert("hide_render", frame=fa)
                o.hide_render = False
                o.keyframe_insert("hide_render", frame=fb)
                o.hide_render = False


def mow_line(a, b, radius=0.5, step=0.5):
    """Clear ground cover along a segment (a camera move, a run path): no grass blade or twig across the lens."""
    from lu import dress
    a, b = Vector((a[0], a[1], 0.0)), Vector((b[0], b[1], 0.0))
    n = max(1, int((b - a).length / step))
    for i in range(n + 1):
        p = a.lerp(b, i / n)
        dress.mow((p.x, p.y), radius)


def safe_shadows(no_shadow=("Sprout",)):
    """EEVEE can hang forever in ShadowModule::shadow_update_finished when small, close practical lights flood the
    virtual shadow pool (seen on the 2nd still of B04/B05). Coarsen every local light's shadow map and switch the
    shadows off for the named practicals (the sprout's glow lights Claude through its block hands anyway)."""
    for o in bpy.data.objects:
        if o.type != "LIGHT" or o.data.type == "SUN":
            continue
        ld = o.data
        if any(o.name.startswith(n) for n in no_shadow):
            ld.use_shadow = False
        if hasattr(ld, "shadow_maximum_resolution"):
            ld.shadow_maximum_resolution = max(ld.shadow_maximum_resolution, 0.004)


ANIM_HIDE = ("SmokeCol", "SmokeWisp", "PatchGlow", "PatchBeam", "GlowOrb", "Sunbeam", "RainSheet", "SeedGlow",
             "Dust", "SighPuff", "Bolt")


def animatic_readability():
    """Only for --anim (Workbench) renders: give Claude and the Sprout their colours and hide the camera-facing FX
    cards and puffs that Workbench draws as opaque grey planes and balls."""
    import sys
    if "--anim" not in sys.argv:
        return
    for o in bpy.data.objects:
        if o.name.startswith(ANIM_HIDE):
            o.hide_render = True
            if o.animation_data and o.animation_data.action:
                for fc in list(getattr(o.animation_data.action, "fcurves", [])):
                    if fc.data_path == "hide_render":
                        o.animation_data.action.fcurves.remove(fc)
    for m in bpy.data.materials:
        n = m.name
        if "_eye" in n or "lash" in n or "Eye" in n:
            m.diffuse_color = (0.01, 0.01, 0.01, 1.0)
        elif "_clay" in n:
            m.diffuse_color = (0.85, 0.32, 0.2, 1.0)
        elif "_jade" in n or "_leaf" in n or "_stem" in n:
            m.diffuse_color = (0.2, 0.9, 0.35, 1.0)
        elif "_shell" in n or "_cap" in n:
            m.diffuse_color = (0.4, 0.25, 0.12, 1.0)


def cut(cam, frame):
    return stage.cut(cam, frame)


def _glow_decal_mat(name="SeedGlowDecal"):
    """Green light seeping up through the ash: additive emission, a soft irregular bloom of light with a few thin,
    broken cracks in the ash crust glowing brighter, fading out radially. Object property 'glow' (keyable) scales
    it."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    nb = mat.NB(nt)
    k = nb.n("ShaderNodeAttribute", attribute_name="glow", attribute_type="OBJECT").outputs["Fac"]
    gen = nb.n("ShaderNodeTexCoord").outputs["Object"]
    wn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 2.2, "Detail": 3.0, "Roughness": 0.6})
    nb.inp(wn, "Vector", gen)
    warp = nb.n("ShaderNodeVectorMath", operation="MULTIPLY_ADD")
    nb.inp(warp, 0, wn.outputs["Color"])
    nb.inp(warp, 1, (0.55, 0.55, 0.55))
    nb.inp(warp, 2, gen)
    wp = warp.outputs[0]
    sep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen})
    x, y = sep.outputs[0], sep.outputs[1]
    r = nb.math("SQRT", nb.add(nb.mul(x, x), nb.mul(y, y)))
    rn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 1.6, "Detail": 2.0})
    nb.inp(rn, "Vector", gen)
    rr = nb.math("DIVIDE", r, nb.mapr(rn.outputs["Fac"], 0.3, 0.7, 0.55, 1.0))
    fall = nb.math("POWER", nb.mapr(rr, 1.0, 0.0, 0.0, 1.0, interp="LINEAR"), 2.0)
    vor = nb.n("ShaderNodeTexVoronoi", inputs={"Scale": 4.5, "Randomness": 1.0}, feature="DISTANCE_TO_EDGE")
    nb.inp(vor, "Vector", wp)
    cn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 3.5, "Detail": 2.0})
    nb.inp(cn, "Vector", gen)
    cracks = nb.mul(nb.mapr(vor.outputs["Distance"], 0.035, 0.0), nb.mapr(cn.outputs["Fac"], 0.45, 0.62))
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 5.0, "Detail": 4.0, "Roughness": 0.65})
    nb.inp(nz, "Vector", wp)
    seep = nb.mapr(nz.outputs["Fac"], 0.38, 0.75)
    a = nb.mul(fall, nb.add(nb.mul(cracks, 0.8), nb.mul(seep, 0.55)))
    core = nb.mul(nb.math("POWER", nb.mapr(rr, 0.5, 0.0, 0.0, 1.0, interp="LINEAR"), 2.0), 1.3)
    a = nb.mul(nb.add(a, core), k)
    col = nb.mix(nb.mapr(rr, 0.0, 0.6), (0.55, 1.0, 0.35), (0.12, 0.85, 0.32))
    em = nb.n("ShaderNodeEmission")
    vm = nb.n("ShaderNodeVectorMath", operation="SCALE")
    nb.inp(vm, 0, col)
    nb.inp(vm, "Scale", a)
    nb.inp(em, "Color", vm.outputs[0])
    tr = nb.n("ShaderNodeBsdfTransparent")
    ad = nb.n("ShaderNodeAddShader")
    nb.link(tr.outputs[0], ad.inputs[0])
    nb.link(em.outputs[0], ad.inputs[1])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(ad.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = False
    return m


def glow_under_ash(at_xy, ground, radius=0.16, name="SeedGlow", light_e=0.0, light_h=0.05):
    """A green glow seeping up through the ash at at_xy (a ground-hugging additive decal) + a small green point light
    just above the surface (uplights hands and face). Returns (decal, light); key decal['glow'] and light energy."""
    x, y = at_xy
    n = 24
    verts, faces = [], []
    for j in range(n + 1):
        for i in range(n + 1):
            u, v = -1 + 2 * i / n, -1 + 2 * j / n
            wx, wy = x + u * radius, y + v * radius
            verts.append((u, v, (ground(wx, wy) - ground(x, y)) / radius + 0.025 / radius))
    for j in range(n):
        for i in range(n):
            a = j * (n + 1) + i
            faces.append((a, a + 1, a + n + 2, a + n + 1))
    o = geo.obj_from(name, verts, faces, geo.coll("FX"), _glow_decal_mat(), smooth=True)
    o.location = (x, y, ground(x, y))
    o.scale = (radius, radius, radius)
    o.visible_shadow = False
    o["glow"] = 0.0
    ld = bpy.data.lights.new(name + "Light", "POINT")
    ld.color = (0.25, 1.0, 0.42)
    ld.energy = light_e
    ld.shadow_soft_size = 0.05
    ld.use_shadow = False
    lo = bpy.data.objects.new(name + "Light", ld)
    bpy.context.scene.collection.objects.link(lo)
    lo.location = (x, y, ground(x, y) + light_h)
    return o, lo


def key_glow(decal, light, frame, glow, energy):
    decal["glow"] = glow
    decal.keyframe_insert('["glow"]', frame=frame)
    light.data.energy = energy
    light.data.keyframe_insert("energy", frame=frame)


def ash_heap(at_xy, ground, radius=0.11, height=0.035, name="SeedAsh", seed=3):
    """A soft little heap of ash covering the seed (B03/B04): a displaced disc using the terrain's ash material so it
    blends with the ground. Returns the object (shape it with heap_key)."""
    from lu import envmat
    x, y = at_xy
    g0 = ground(x, y)
    rng = np.random.default_rng(seed)
    n_r, n_a = 10, 40
    verts, faces = [(0.0, 0.0, height)], []
    ph = rng.uniform(0, 6.28, 4)
    for i in range(1, n_r + 1):
        rr = i / n_r
        for j in range(n_a):
            a = 2 * math.pi * j / n_a
            wob = 1 + 0.12 * math.sin(3 * a + ph[0]) + 0.07 * math.sin(5 * a + ph[1])
            R = rr * radius * wob
            wx, wy = x + R * math.cos(a), y + R * math.sin(a)
            h = height * (1 - rr ** 2) ** 1.5 * (1 + 0.15 * math.sin(7 * a + ph[2]) * rr)
            verts.append((R * math.cos(a), R * math.sin(a), ground(wx, wy) - g0 + h - 0.004 * rr))
    for j in range(n_a):
        faces.append((0, 1 + j, 1 + (j + 1) % n_a))
    for i in range(n_r - 1):
        for j in range(n_a):
            a = 1 + i * n_a + j
            b = 1 + i * n_a + (j + 1) % n_a
            faces.append((a, b, b + n_a, a + n_a))
    o = geo.obj_from(name, verts, faces, geo.coll("Props"), envmat.ground(), smooth=True)
    o.location = (x, y, g0)
    _paint_attrs(o)
    return o


def _paint_attrs(o):
    """The terrain's paint attributes (ash colour, mask) on a ground-material prop, from its world positions."""
    from lu import terrain
    me = o.data
    co = np.array([o.matrix_world @ v.co for v in me.vertices])
    terrain._attrs(o, co[:, 0], co[:, 1], co[:, 2])


def ash_bed(center, radius, ground, furrows=(), seed=5, name="AshBed", res=0.006):
    """Close-up ash relief around a spot (ECUs): a fine grid on the terrain with soft lumps, a few flakes of crust
    and the furrows Claude's mittens raked through the ash (furrows = [((x0, y0), (x1, y1)), ...] world xy, each a
    groove with soft ridges beside it). Uses the terrain material and paint, and sinks under the terrain at its rim."""
    from lu import envmat, terrain
    cx, cy = center
    n = int(2 * radius / res) + 1
    u = np.linspace(-radius, radius, n)
    X, Y = np.meshgrid(u + cx, u + cy)
    R = np.hypot(X - cx, Y - cy) / radius
    from lu import dress
    G = dress.surface(X.ravel(), Y.ravel()).reshape(X.shape)
    lump = terrain.fbm(X * 9.0, Y * 9.0, seed, 1.0, 4) * 0.004 + terrain.fbm(X * 30.0, Y * 30.0, seed + 1, 1.0, 2) * 0.0015
    d = np.full(X.shape, 0.004) + lump
    for (a, b) in furrows:
        a, b = np.array(a), np.array(b)
        ab = b - a
        L2 = float(ab @ ab)
        t = np.clip(((X - a[0]) * ab[0] + (Y - a[1]) * ab[1]) / L2, 0, 1)
        px, py = a[0] + t * ab[0], a[1] + t * ab[1]
        dist = np.hypot(X - px, Y - py)
        taper = np.sin(np.pi * np.clip(t, 0.02, 0.98)) ** 0.5
        d += (-0.006 * np.exp(-(dist / 0.007) ** 2) + 0.0028 * np.exp(-((dist - 0.014) / 0.006) ** 2)) * taper
    edge = np.clip((1.0 - R) / 0.25, 0.0, 1.0)
    d = d * edge - 0.003 * (1 - edge)
    Z = G + d
    keep = R <= 1.0
    ob = terrain.mesh_grid(name, X, Y, Z, geo.coll("Props"), envmat.ground())
    terrain._attrs(ob, X.ravel(), Y.ravel(), Z.ravel())
    return ob


def seed_ground(W):
    """The ground at the seed for the close shots (B03, B04, B05): clear the cover where Claude kneels and around the
    seed, and lay the close-up ash relief with the furrows its mittens raked. Returns the ash bed."""
    from lu import dress
    kx, ky = KNEEL_XY
    sx, sy = SEED_SPOT
    hd = KNEEL_HEADING
    dress.mow((kx, ky), 0.42)
    dress.mow((sx, sy), 0.3)
    fw = front(hd)
    dress.mow((sx + fw.x * 0.45, sy + fw.y * 0.45), 0.3)
    fur = []
    for side, xs in ((1, (0.10, 0.13, 0.17)), (-1, (-0.09, -0.12, -0.16))):
        for k, xo in enumerate(xs):
            a = at_char(kx, ky, hd, fwd=0.30 + 0.02 * k, side=xo)
            b = at_char(kx, ky, hd, fwd=0.47 - 0.02 * k, side=xo + 0.03 * side)
            fur.append((a, b))
    return ash_bed((sx, sy - 0.02), 0.34, W.ground, furrows=fur, seed=7)


def hero_trunks(specs, name="ForestHero"):
    """A few placed charred trunks for a shot's composition (foreground repoussoirs, framing snags), instanced from
    the forest's trunk library. specs: [(x, y, kind, height_or_log_scale, yaw_deg, lean_x_deg, lean_y_deg)], kind in
    snag / dead / stub / log. The cloud's name starts with 'Forest' so the culling treats it like the forest."""
    from lu import foliage, terrain, dress
    lib = foliage.trunk_protos()
    pts = []
    for sp in specs:
        x, y, kind, h, yaw = sp[:5]
        lx, ly = (sp[5], sp[6]) if len(sp) > 6 else (0.0, 0.0)
        pool = lib[kind]
        p = pool[int(abs(hash((round(x, 2), round(y, 2)))) % len(pool))]
        s = h / lib["height"][p] if kind != "log" else h
        pts.append((x, y, p, s, (math.radians(lx), math.radians(ly), math.radians(yaw))))
    X = np.array([p[0] for p in pts])
    Y = np.array([p[1] for p in pts])
    Z = terrain.height(X, Y) - 0.05
    P = dict(co=np.stack([X, Y, Z], 1), proto=np.array([p[2] for p in pts], dtype=np.int32),
             scale=np.array([p[3] for p in pts]), rot=np.array([p[4] for p in pts]),
             tint=np.ones((len(pts), 3)), flex=np.zeros(len(pts)))
    return dress._cloud(name, P, geo.coll("Forest"), group=foliage.tree_group())


