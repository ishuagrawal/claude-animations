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
                         backface=True, foliage=name not in ("Needles", "Flowers"))


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
         colors=((0.07, 0.17, 0.10), (0.20, 0.32, 0.12)), density=2.2):
    """A stylised conifer: tapering trunk + drooping tiers of needle-stroke cards."""
    col = collection or geo.coll("Trees")
    rng = np.random.default_rng(seed)
    bx, by, bz = base
    lx, ly = lean
    trunk_m = bpy.data.materials.get("Bark") or mat.painterly("Bark", (0.20, 0.12, 0.08), stroke="strokes_vert",
                                                               scale=2.5, tex_amt=1.2, breakup=1.5, bump=0.3,
                                                               color2=(0.32, 0.22, 0.15))
    prof = [(radius * 0.09, 0), (radius * 0.075, height * 0.3), (radius * 0.05, height * 0.7), (0.02, height * 1.02)]
    tr = geo.lathe(name + "_trunk", prof, seg=10, collection=col, mat=trunk_m)
    tr.location = (bx, by, bz - 0.3)
    tr.rotation_euler = (math.atan(ly / height) * -1, math.atan(lx / height), 0)
    specs = []
    nt = tiers or int(height * 1.6)
    for k in range(nt):
        t = (k + rng.uniform(0, 0.6)) / nt
        hz = height * (0.22 + 0.8 * t)
        rad = radius * (1 - t) ** 0.9 * rng.uniform(0.85, 1.1) + 0.25
        ax = Vector((bx + lx * hz / height, by + ly * hz / height, bz + hz))
        n_cards = int((6 + rad * 9) * density)
        for j in range(n_cards):
            a = rng.uniform(0, 2 * math.pi)
            rr = rad * math.sqrt(rng.uniform(0.05, 1.0))
            out = Vector((math.cos(a), math.sin(a), 0))
            c = ax + out * rr + Vector((0, 0, -rr * 0.35 + rng.normal(0, 0.12)))
            sz = rng.uniform(0.55, 1.0) * (0.65 + rad * 0.3)
            rt = Vector((-math.sin(a), math.cos(a), 0)) * sz
            droop = 0.45 + rng.normal(0, 0.15)
            up = (out * math.cos(droop) * -0.0 + Vector((0, 0, 1)) * 0.75 + out * 0.45).normalized() * sz * 0.6
            n = (out * 0.75 + Vector((0, 0, 0.65))).normalized()
            shade = rng.uniform(0, 1)
            tint = tuple(np.array(colors[0]) * (1 - shade) + np.array(colors[1]) * shade)
            specs.append((c, rt, up, n, int(rng.integers(0, 16)), tint))
    m = card_mat("Needles", "dab_needle", translucent=0.5, scale=1.2)
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


def bush(name, center, radius, seed=0, collection=None, colors=((0.12, 0.22, 0.08), (0.30, 0.38, 0.12)), count=None):
    """Rounded shrub: a ball of leaf-dab cards shaded as one mass."""
    col = collection or geo.coll("Trees")
    rng = np.random.default_rng(seed)
    c0 = Vector(center)
    specs = []
    n = count or int(40 * radius ** 2 + 20)
    for i in range(n):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * 0.8 + 0.1
        d.normalize()
        p = c0 + Vector((d.x * radius, d.y * radius, d.z * radius * 0.8)) * rng.uniform(0.6, 1.0)
        sz = rng.uniform(0.25, 0.45) * radius
        rt = d.cross(Vector((0, 0, 1)))
        if rt.length < 1e-3:
            rt = Vector((1, 0, 0))
        rt = rt.normalized() * sz
        up = d.cross(rt).normalized() * sz
        shade = rng.random()
        tint = tuple(np.array(colors[0]) * (1 - shade) + np.array(colors[1]) * shade)
        specs.append((p, rt, up, d, int(rng.integers(0, 16)), tint))
    m = card_mat("Leaves", "dab_leaf", translucent=0.3, scale=1.5)
    return _cards(name, specs, col, m)
