"""Painterly foliage: stroke-mass conifers and grass/wildflower dab cards.

Like the Wild Robot's Doodle/Sprinkles approach, plants are built from brush strokes (alpha cards from the
dab atlas), not leaves. Cards get custom normals pointing away from the plant's volume so a clump shades
as one soft painted mass.
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, mat


def _bough_cells(cell=256, grid=4, seed=27):
    """Atlas of drooping fir sprays: an arched twig near the top of each cell with needle strokes hanging down and out
    of it (a crescent / fan silhouette with a ragged lower edge). R = value, B = vertical gradient, A = coverage."""
    from . import tex as T
    rng = np.random.default_rng(seed)
    bris = T._Bristles(rng)
    n = cell * grid
    out = np.zeros((n, n, 4))
    yy, xx = np.mgrid[0:cell, 0:cell].astype(float)

    def stroke(acc_a, acc_v, x0, y0, x1, y1, w, val, dry=0.3):
        dx, dy = x1 - x0, y1 - y0
        L = math.hypot(dx, dy)
        if L < 2.0:
            return
        ux, uy = dx / L, dy / L
        px, py = xx - x0, yy - y0
        along = (px * ux + py * uy) / L
        across = (-px * uy + py * ux) / max(w, 0.5)
        prof = np.clip(1 - along, 0, 1) ** 0.7 * (along > -0.05)
        m = T.smoothstep(1.0, 0.6, np.abs(across) / np.maximum(prof, 1e-3)) * (along < 1.0) * (along > -0.05)
        b = bris(across * 3 + rng.random() * 300)
        m = m * T.smoothstep(dry * along - 0.1, dry * along + 0.15, b)
        acc_v[:] = acc_v * (1 - m) + val * m
        acc_a[:] = np.maximum(acc_a, m)

    for gy in range(grid):
        for gx in range(grid):
            A = np.zeros((cell, cell))
            V = np.full((cell, cell), 0.5)
            arch = rng.uniform(0.04, 0.12)
            y_top = rng.uniform(0.2, 0.3)
            pts = []
            for k in range(13):
                t = k / 12
                x = 0.06 + 0.88 * t
                y = y_top + arch * math.sin(math.pi * t) - 0.06 * t
                pts.append((x * cell, y * cell))
            # needles hanging from the twig (longest in the middle: a fan)
            nn = int(rng.integers(90, 130))
            for k in range(nn):
                t = rng.uniform(0.0, 1.0)
                i = min(int(t * 12), 11)
                fx, fy = pts[i]
                fx2, fy2 = pts[i + 1]
                u = t * 12 - i
                bx, by = fx + (fx2 - fx) * u, fy + (fy2 - fy) * u
                Lk = cell * (0.07 + 0.26 * math.sin(math.pi * min(1.0, 0.08 + t * 1.05)) ** 0.8) * rng.uniform(0.55, 1.1)
                ang = math.radians(rng.uniform(28, 80))
                ex, ey = bx + math.cos(ang) * Lk, by + math.sin(ang) * Lk
                stroke(A, V, bx, by, ex, ey, cell * rng.uniform(0.014, 0.026), 0.5 + rng.normal(0, 0.12) + 0.15 * (ey / cell))
            for k in range(int(rng.integers(25, 40))):    # shorter needles on the upper side, swept toward the tip
                t = rng.uniform(0.05, 0.95)
                i = min(int(t * 12), 11)
                bx, by = pts[i]
                Lk = cell * rng.uniform(0.04, 0.11) * math.sin(math.pi * min(1.0, 0.1 + t))
                ang = math.radians(rng.uniform(-65, -25))
                stroke(A, V, bx, by, bx + math.cos(ang) * Lk, by + math.sin(ang) * Lk, cell * 0.016, 0.62)
            for (x0, y0), (x1, y1) in zip(pts, pts[1:]):   # the twig
                stroke(A, V, x0, y0, x1 + (x1 - x0) * 0.3, y1 + (y1 - y0) * 0.3, cell * 0.022, 0.3, dry=0.0)
            edge = T.smoothstep(0, cell * 0.04, np.minimum(np.minimum(xx, cell - 1 - xx), np.minimum(yy, cell - 1 - yy)))
            sl = (slice(gy * cell, (gy + 1) * cell), slice(gx * cell, (gx + 1) * cell))
            out[sl[0], sl[1], 0] = np.clip(V, 0, 1)
            out[sl[0], sl[1], 1] = rng.random()
            out[sl[0], sl[1], 2] = 1 - yy / cell
            out[sl[0], sl[1], 3] = np.clip(A * edge, 0, 1)
    return out


def bough_atlas():
    """Path of the fir-spray atlas (generated once into cache/tex) registered as image 'dab_bough'."""
    from . import tex as T
    path = T.cached("dab_bough", _bough_cells)
    mat.textures()["dab_bough"] = path
    return path


def _atlas_alpha(atlas):
    def f(nb):
        uv = nb.n("ShaderNodeUVMap")
        t = nb.n("ShaderNodeTexImage", image=mat.image(atlas), interpolation="Cubic", extension="CLIP")
        nb.link(uv.outputs[0], t.inputs[0])
        return nb.mapr(t.outputs["Alpha"], 0.35, 0.6)
    return f


def card_mat(name, atlas, color=(1, 1, 1), translucent=0.35, scale=1.5):
    m = bpy.data.materials.get(name)
    if m:
        return m
    return mat.painterly(name, color, stroke="strokes_fine", scale=scale, tex_amt=0.6, hue_jit=0.05, bump=0.0,
                         breakup=1.2, wrap=0.25, translucent=translucent, vcol="tint", alpha_tex=_atlas_alpha(atlas),
                         backface=True, foliage=name not in ("Needles", "Flowers", "Boughs", "BoughsFar"), snow=0.0)


def _cards(name, specs, collection, material, grid=4):
    """specs: list of (center Vector, right Vector, up Vector, normal Vector, cell index, rgb tint)."""
    verts, faces, uvs, nrms, tints = [], [], [], [], []
    for (c, rt, up, n, cell, tint) in specs:
        b = len(verts)
        for (sx, sy) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            verts.append(c + rt * sx + up * sy)
        faces.append((b, b + 1, b + 2, b + 3))
        gx, gy = cell % grid, cell // grid
        u0, v0 = gx / grid, 1 - (gy + 1) / grid
        du = 1 / grid
        uvs += [(u0, v0), (u0 + du, v0), (u0 + du, v0 + du), (u0, v0 + du)]
        nrms += [n] * 4
        tints += [tint] * 4
    ob = geo.obj_from(name, verts, faces, collection, material, smooth=True)
    me = ob.data
    uvl = me.uv_layers.new(name="UVMap")
    for li, loop in enumerate(me.loops):
        uvl.data[li].uv = uvs[loop.vertex_index]
    me.normals_split_custom_set([nrms[l.vertex_index] for l in me.loops])
    att = me.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.array([(*t, 1.0) for t in tints]).ravel())
    return ob


def pine(name, base, height=9.0, radius=2.6, seed=0, collection=None, lean=(0.0, 0.0), tiers=None,
         colors=((0.026, 0.066, 0.055), (0.11, 0.20, 0.11)), density=2.2, detail=1.0, broken=False):
    """A painterly conifer: a slim trunk + whorls of drooping boughs, each a spray of fir-stroke cards (Wild Robot
    "Doodle" foliage: strokes, not needles). Cards carry normals pointing out of the crown so the tree shades as one
    layered mass; silhouettes are broken (gaps, uneven whorls, upturned tips, a heavier skirt). detail < 1 -> fewer,
    bigger, softer dabs (a painted blob for distant trees)."""
    col = collection or geo.coll("Trees")
    rng = np.random.default_rng(seed)
    bx, by, bz = base
    lx, ly = lean
    trunk_m = bpy.data.materials.get("Bark") or mat.painterly("Bark", (0.20, 0.12, 0.08), stroke="strokes_vert",
                                                               scale=2.5, tex_amt=1.2, breakup=1.5, bump=0.3,
                                                               color2=(0.32, 0.22, 0.15))
    prof = [(radius * 0.06, 0), (radius * 0.05, height * 0.3), (radius * 0.03, height * 0.7), (0.015, height * 1.0)]
    tr = geo.lathe(name + "_trunk", prof, seg=8, collection=col, mat=trunk_m)
    tr.location = (bx, by, bz - 0.3)
    tr.rotation_euler = (math.atan(ly / height) * -1, math.atan(lx / height), 0)
    specs = []
    Z = Vector((0, 0, 1))
    nw = tiers or int(height * 1.5 + 4)
    top_h = height * (0.86 if broken else 1.0)
    golden = 2.39996
    dens = density / 2.2
    for k in range(nw):
        t = (k + rng.uniform(0, 0.5)) / nw
        hz = height * (0.1 + 0.88 * t)
        if hz > top_h:
            break
        R = radius * (1 - t) ** 0.9 * rng.uniform(0.85, 1.12) * (1.12 if t < 0.15 else 1.0) + 0.25
        ax = Vector((bx + lx * hz / height, by + ly * hz / height, bz + hz))
        nb = int(rng.integers(6, 9))
        for j in range(nb):
            if rng.random() < 0.08:
                continue                                    # a gap in the silhouette
            a = golden * (k * 7 + j) + rng.normal(0, 0.2)
            out = Vector((math.cos(a), math.sin(a), 0))
            Lb = R * rng.uniform(0.8, 1.15)
            droop = rng.uniform(0.2, 0.42) * (1.3 if t < 0.2 else 1.0)
            upturn = rng.uniform(0.08, 0.2)
            ncards = max(3, int((2.5 + Lb * 2.6) * dens * max(detail, 0.75)))
            for c in range(ncards):
                u = 0.12 + 0.88 * (c + rng.uniform(0, 0.7)) / ncards
                p = ax + out * Lb * u + Z * Lb * (-droop * u * u + upturn * u ** 4)
                p += Vector(rng.normal(0, 0.05 * (0.5 + Lb), 3))
                sz = (0.42 + 0.36 * (1 - u)) * (0.6 + 0.3 * R) / max(detail, 0.35) ** 0.45
                tang = (out + Z * (-2 * droop * u + 4 * upturn * u ** 3)).normalized()
                side = out.cross(Z).normalized()
                roll = rng.normal(0, 0.35) + (0.9 if rng.random() < 0.35 else 0.0) * rng.choice((-1, 1))
                upv = (Z * math.cos(roll) + side * math.sin(roll)).normalized()
                rt = tang * sz
                up = upv * sz * 0.62
                n = (out * 0.7 + Z * (0.55 + 0.25 * t) + side * rng.normal(0, 0.15)).normalized()
                shade = min(1.0, max(0.0, 0.2 + 0.45 * u + 0.25 * t + rng.normal(0, 0.14)))
                tint = tuple(np.array(colors[0]) * (1 - shade) + np.array(colors[1]) * shade)
                # the card's left edge sits at p (twig base) and it extends outward along the bough
                specs.append((p + rt * 0.75, rt, up, n, int(rng.integers(0, 16)), tint))
    for c in range(int(6 * detail) + 3):                   # leader
        u = c / 8.0
        p = Vector((bx + lx, by + ly, bz + top_h * (0.9 + 0.1 * u)))
        sz = 0.4 * (1 - u * 0.6)
        a = rng.uniform(0, 6.28)
        rt = Vector((math.cos(a), math.sin(a), 0)) * sz * 0.5
        specs.append((p, rt, Z * sz * 0.8, (Z + Vector((math.cos(a), math.sin(a), 0)) * 0.5).normalized(),
                      int(rng.integers(0, 16)), colors[1]))
    bough_atlas()
    m = card_mat("Boughs", "dab_bough", translucent=0.45, scale=1.2) if detail >= 0.6 else \
        card_mat("BoughsFar", "dab_bough", translucent=0.3, scale=0.8)
    ob = _cards(name + "_crown", specs, col, m)
    return tr, ob


def grass(name, center, radius, count, height_fn, seed=0, collection=None, avoid=None,
          colors=((0.20, 0.34, 0.10), (0.42, 0.46, 0.14)), flowers=0.06, blade=(0.18, 0.42), falloff=1.0):
    """Ground cover of blade-stroke cards (and a few wildflower dabs) scattered on the terrain."""
    col = collection or geo.coll("Grass")
    rng = np.random.default_rng(seed)
    cx, cy = center
    specs = []
    fl_specs = []
    flower_cols = [(0.85, 0.80, 0.68), (1.0, 0.72, 0.18), (0.92, 0.38, 0.40), (0.62, 0.52, 0.85), (0.95, 0.55, 0.2)]
    for i in range(count):
        rr = radius * math.sqrt(rng.random()) ** falloff
        a = rng.uniform(0, 2 * math.pi)
        x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
        if avoid and avoid(x, y):
            continue
        z = float(height_fn(x, y))
        h = rng.uniform(*blade)
        ang = rng.uniform(0, math.pi)
        rt = Vector((math.cos(ang), math.sin(ang), 0)) * h * 0.55
        tilt = Vector((rng.normal(0, 0.15), rng.normal(0, 0.15), 1)).normalized()
        up = tilt * h * 0.5
        c = Vector((x, y, z + h * 0.45))
        shade = rng.random()
        tint = tuple(np.array(colors[0]) * (1 - shade) + np.array(colors[1]) * shade)
        n = Vector((rng.normal(0, 0.2), rng.normal(0, 0.2), 1)).normalized()
        specs.append((c, rt, up, n, int(rng.integers(0, 16)), tint))
        if rng.random() < flowers:
            fs = rng.uniform(0.03, 0.055)
            fc = flower_cols[int(rng.integers(0, len(flower_cols)))]
            frt = Vector((math.cos(ang + 1.2), math.sin(ang + 1.2), 0)) * fs
            fl_specs.append((c + Vector((0, 0, h * 0.5)), frt, Vector((0, 0, fs)), Vector((0, 0, 1)), int(rng.integers(0, 16)), fc))
    gm = card_mat("GrassBlades", "dab_blade", translucent=0.3, scale=2.0)
    out = [_cards(name, specs, col, gm)]
    if fl_specs:
        fm = card_mat("Flowers", "dab_leaf", translucent=0.2, scale=3.0)
        out.append(_cards(name + "_fl", fl_specs, col, fm))
    return out


def bush(name, center, radius, seed=0, collection=None, colors=((0.035, 0.085, 0.04), (0.16, 0.26, 0.09)), count=None,
         blossoms=0.0, blossom_col=(0.95, 0.55, 0.62)):
    """Shrub: 3-5 lobes of leaf-dab cards, each lobe shaded as a soft mass (dark heart, lighter crown). blossoms > 0
    sprinkles small flower dabs over the lit crown (wild rose)."""
    col = collection or geo.coll("Trees")
    rng = np.random.default_rng(seed)
    c0 = Vector(center)
    specs, fl = [], []
    nl = int(rng.integers(3, 6))
    lobes = []
    for k in range(nl):
        a = rng.uniform(0, 6.28)
        off = Vector((math.cos(a), math.sin(a), 0)) * radius * rng.uniform(0.2, 0.55) + Vector((0, 0, rng.uniform(-0.1, 0.25) * radius))
        lobes.append((c0 + off, radius * rng.uniform(0.55, 0.8)))
    n_total = count or int(55 * radius ** 2 + 30)
    for i in range(n_total):
        lc, lr = lobes[i % nl]
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * 0.85 + 0.05
        d.normalize()
        p = lc + Vector((d.x * lr, d.y * lr, d.z * lr * 0.85)) * rng.uniform(0.55, 1.0)
        sz = rng.uniform(0.22, 0.4) * radius
        rt = d.cross(Vector((0, 0, 1)))
        if rt.length < 1e-3:
            rt = Vector((1, 0, 0))
        rt = rt.normalized() * sz
        up = d.cross(rt).normalized() * sz
        nrm = (p - (c0 - Vector((0, 0, radius * 0.6)))).normalized()
        shade = min(1.0, max(0.0, 0.3 + 0.6 * d.z + rng.normal(0, 0.15)))
        tint = tuple(np.array(colors[0]) * (1 - shade) + np.array(colors[1]) * shade)
        specs.append((p, rt, up, nrm, int(rng.integers(0, 16)), tint))
        if blossoms > 0 and d.z > 0.25 and rng.random() < blossoms:
            fs = rng.uniform(0.03, 0.05)
            fl.append((p + nrm * 0.03, Vector((fs, 0, 0)), Vector((0, fs * 0.9, fs * 0.3)), nrm, int(rng.integers(0, 16)),
                       tuple(np.array(blossom_col) * rng.uniform(0.85, 1.1))))
    m = card_mat("Leaves", "dab_leaf", translucent=0.3, scale=1.5)
    ob = _cards(name, specs, col, m)
    if fl:
        _cards(name + "_bl", fl, col, card_mat("Flowers", "dab_leaf", translucent=0.2, scale=3.0))
    return ob


def mow(center, radius, names=("Meadow", "Patch")):
    """Remove ground cover around a spot (characters' feet, low cameras' foreground). Works on the instanced cover
    (dress point clouds) and on legacy card meshes."""
    import bmesh
    from mathutils import Vector
    from . import dress
    dress.mow(center, radius, prefix=tuple(names))
    c = Vector(center)
    for nm in names:
        for o in [o for o in bpy.data.objects if o.name.startswith(nm) and o.type == "MESH" and not o.modifiers.get("Cover")]:
            bm = bmesh.new()
            bm.from_mesh(o.data)
            mw = o.matrix_world
            dead = [f for f in bm.faces if ((mw @ f.calc_center_median()) - c).to_2d().length < radius]
            bmesh.ops.delete(bm, geom=dead, context="FACES")
            bm.to_mesh(o.data)
            bm.free()


# ===================================================================== wind
WIND = "LU_Wind"
WIND_HEADING = 90.0      # degrees; 90 = blowing toward +Y (north): the sails face south, into the wind


def wind(heading=None, breeze=None):
    """The scene's wind controller (an Empty read by the cover / tree geometry nodes):
      location.x = gust strength (0 = none, 1 = strong), location.y = gust front position along the wind axis (m),
      location.z = breeze strength (1 = default gentle sway), rotation z = direction the wind blows toward,
      scale.x = gust band wavelength (m).
    Everything is time driven (Scene Time) and keyable, so every frame is deterministic."""
    o = bpy.data.objects.get(WIND)
    if o is None:
        o = bpy.data.objects.new(WIND, None)
        bpy.context.scene.collection.objects.link(o)
        o.empty_display_type = "SINGLE_ARROW"
        o.location = (0.0, -1000.0, 1.0)
        o.rotation_euler = (0.0, 0.0, math.radians(WIND_HEADING))
        o.scale = (4.0, 1.0, 1.0)
        o.hide_render = True
    if heading is not None:
        o.rotation_euler.z = math.radians(heading)
    if breeze is not None:
        o.location.z = breeze
    return o


def breeze(strength=1.0, frame=None):
    """Set (or key at `frame`) the constant gentle breeze. 0 = still air."""
    o = wind()
    o.location.z = strength
    if frame is not None:
        o.keyframe_insert("location", index=2, frame=frame)
    return o


def _set_interp(o, data_path, index, kind):
    ad = o.animation_data
    if not ad or not ad.action:
        return
    from bpy_extras import anim_utils
    try:
        fcs = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot).fcurves
    except Exception:
        fcs = getattr(ad.action, "fcurves", [])
    for fc in fcs:
        if fc.data_path == data_path and fc.array_index == index:
            for kp in fc.keyframe_points:
                kp.interpolation = kind


def gust(f0, f1, strength=1.0, speed=11.0, start=None, ramp=0.35, wavelength=4.0, heading=None):
    """A gust: rolling bands of motion through the meadow. The front enters at f0 at `start` (a world (x, y) point or
    a distance along the wind axis; default: the scene camera, so the wave runs away from it) and travels at `speed`
    m/s; strength ramps in over `ramp` s, holds, and dies out by f1. Grass, flowers and trees lean with it."""
    o = wind(heading=heading)
    fps = bpy.context.scene.render.fps
    h = o.rotation_euler.z
    d = (math.cos(h), math.sin(h))
    if start is None:
        cam = bpy.context.scene.camera
        start = (cam.location.x, cam.location.y) if cam else (0.0, -20.0)
    s0 = start[0] * d[0] + start[1] * d[1] if isinstance(start, (tuple, list)) else float(start)
    s0 -= 1.0
    o.scale.x = wavelength
    fr = max(1, int(round(ramp * fps)))
    for f, g in ((f0 - 1, 0.0), (f0 + fr, strength), (max(f0 + fr, f1 - 2 * fr), strength * 0.85), (f1, 0.0)):
        o.location.x = g
        o.keyframe_insert("location", index=0, frame=f)
    for f, s in ((f0, s0), (f1, s0 + speed * (f1 - f0) / fps)):
        o.location.y = s
        o.keyframe_insert("location", index=1, frame=f)
    _set_interp(o, "location", 1, "LINEAR")
    return o
