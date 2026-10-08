"""Small deterministic FX built from keyframed objects: spark bursts, dust/flour puffs, splinters, steam wisps,
dust motes, light-beam haze. Painterly: sparks are brush dabs of light, puffs are soft painted blobs."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler

from . import geo, mat

FPS = 24


def _life_emissive(name, color, strength):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    a = nb.n("ShaderNodeAttribute", attribute_name="life", attribute_type="OBJECT").outputs["Fac"]
    em = nb.n("ShaderNodeEmission", inputs={"Color": color})
    nb.inp(em, "Strength", nb.mul(a, strength))
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", nb.math("MINIMUM", nb.mul(a, 2.0), 1.0))
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    return m


def _puff_mat(name, color, opacity=0.6, emit=0.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    a = nb.n("ShaderNodeAttribute", attribute_name="life", attribute_type="OBJECT").outputs["Fac"]
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    tc = nb.n("ShaderNodeTexCoord")
    st = mat.tex_node(nb, "strokes_soft", tc.outputs["Object"], 2.0)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    soft = nb.mapr(nb.add(nb.sub(1.0, lw.outputs["Facing"]), nb.mul(nb.sub(sv, 0.5), 0.6)), 0.05, 0.75)
    alpha = nb.mul(nb.mul(soft, a), opacity)
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": color})
    s2r = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2r.inputs[0])
    lit = nb.mix(1.0, s2r.outputs["Color"], (0.12, 0.11, 0.12), blend="ADD")
    lit = nb.mix(1.0, lit, color, blend="MULTIPLY")
    if emit > 0:
        lit = nb.mix(1.0, lit, nb.mix(emit, (0, 0, 0), color), blend="ADD")
    em = nb.n("ShaderNodeEmission")
    nb.inp(em, "Color", lit)
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", alpha)
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    return m


def _keys(o, f, life):
    o["life"] = life
    o.keyframe_insert("location", frame=f)
    o.keyframe_insert("rotation_euler", frame=f)
    o.keyframe_insert("scale", frame=f)
    o.keyframe_insert('["life"]', frame=f)


def sparks(name, origin, t0, f0, n=40, speed=(1.2, 3.5), life=(0.25, 0.7), gravity=-3.0, up=0.6, color=(1.0, 0.7, 0.3),
           strength=25.0, size=0.012, seed=0, cone=None, collection=None):
    """Burst of spark streaks from origin at shot-local time t0."""
    col = collection or geo.coll("FX")
    rng = np.random.default_rng(seed)
    m = _life_emissive("Spark", color, strength)
    O = Vector(origin)
    objs = []
    for i in range(n):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * up + d.z * (1 - up)
        if cone is not None:
            d = (d * 0.6 + Vector(cone)).normalized()
        v = d * rng.uniform(*speed)
        L = rng.uniform(*life)
        ts = t0 + rng.uniform(0, 0.08)
        o = geo.lathe(f"{name}{i}", [(0.0, -1.0), (size, -0.6), (size * 0.6, 0.0), (0.0, 0.05)], seg=6, collection=col, mat=m)
        o.visible_shadow = False
        fa, fb = f0 + int(ts * FPS) - 1, f0 + int((ts + L) * FPS) + 1
        for f in range(fa, fb + 1):
            t = (f - f0) / FPS - ts
            if t < 0:
                o.location = O
                o.scale = (0.001, 0.001, 0.001)
                _keys(o, f, 0.0)
                continue
            p = O + v * t + Vector((0, 0, 0.5 * gravity * t * t))
            vel = v + Vector((0, 0, gravity * t))
            u = t / L
            lifev = max(0.0, 1 - u) ** 1.5
            streak = max(0.02, vel.length * 0.035)
            o.matrix_world = Matrix.Translation(p) @ vel.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4() @ \
                Matrix.Diagonal((1, 1, streak, 1))
            _keys(o, f, lifev)
        objs.append(o)
    return objs


def puff(name, origin, t0, f0, n=10, spread=0.25, grow=(0.15, 0.6), life=(0.8, 2.2), rise=0.25, drift=(0, 0, 0),
         color=(0.9, 0.86, 0.8), opacity=0.55, seed=0, collection=None, emit=0.0):
    """Soft painted puffs (dust, flour, smoke) expanding and fading."""
    col = collection or geo.coll("FX")
    rng = np.random.default_rng(seed)
    m = _puff_mat(f"Puff_{name}", color, opacity, emit)
    O = Vector(origin)
    objs = []
    for i in range(n):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
        o = bpy.context.active_object
        o.name = f"{name}{i}"
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
        o.data.materials.append(m)
        o.data.shade_smooth()
        o.visible_shadow = False
        off = Vector(rng.normal(0, spread, 3))
        off.z = abs(off.z) * 0.5
        vel = off.normalized() * rng.uniform(0.2, 0.6) + Vector(drift) + Vector((0, 0, rise))
        L = rng.uniform(*life)
        r0, r1 = grow[0] * rng.uniform(0.6, 1.2), grow[1] * rng.uniform(0.7, 1.3)
        ts = t0 + rng.uniform(0, 0.15)
        fa, fb = f0 + int(ts * FPS) - 1, f0 + int((ts + L) * FPS) + 1
        rot = Euler(rng.uniform(0, 6.28, 3))
        for f in range(fa, fb + 1):
            t = (f - f0) / FPS - ts
            u = min(max(t / L, 0.0), 1.0)
            eo = 1 - (1 - u) ** 3
            o.location = O + off * 0.4 + vel * L * eo
            s = r0 + (r1 - r0) * eo if t >= 0 else 0.001
            o.scale = (s, s, s * 0.85)
            o.rotation_euler = rot
            _keys(o, f, (math.sin(math.pi * min(1, u * 1.6)) if u < 0.6 else (1 - u) / 0.4 * 0.95) if t >= 0 else 0.0)
        objs.append(o)
    return objs


def splinters(name, origin, t0, f0, n=24, speed=(1.5, 4.0), gravity=-9.0, floor_z=None, seed=0, collection=None, m=None):
    col = collection or geo.coll("FX")
    rng = np.random.default_rng(seed)
    mm = m or mat.painterly("Splinter", (0.42, 0.28, 0.16), stroke="strokes_fine", scale=4, tex_amt=0.8)
    O = Vector(origin)
    objs = []
    for i in range(n):
        o = geo.box(f"{name}{i}", (rng.uniform(0.02, 0.05), rng.uniform(0.08, 0.22), rng.uniform(0.01, 0.025)), collection=col, mat=mm)
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = -abs(d.z) * 0.6 - 0.2
        v = d * rng.uniform(*speed)
        spin = Vector(rng.normal(0, 8, 3))
        fz = floor_z if floor_z is not None else O.z - 3.0
        fa = f0 + int(t0 * FPS) - 1
        landed = None
        for f in range(fa, fa + int(2.5 * FPS)):
            t = (f - f0) / FPS - t0
            if t < 0:
                o.location = O
                o.scale = (0.001, 0.001, 0.001)
            else:
                p = O + v * t + Vector((0, 0, 0.5 * gravity * t * t))
                if p.z <= fz + 0.01:
                    if landed is None:
                        landed = (p.x, p.y, t)
                    p = Vector((landed[0], landed[1], fz + 0.01))
                    o.rotation_euler = Euler((0, 0, spin.z * landed[2]))
                else:
                    o.rotation_euler = Euler(spin * t)
                o.location = p
                o.scale = (1, 1, 1)
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
            o.keyframe_insert("scale", frame=f)
        objs.append(o)
    return objs


def steam(name, origin, f0, f1, rate=3.0, seed=0, collection=None, color=(0.95, 0.92, 0.88), opacity=0.25):
    """Continuous gentle steam wisps (tea cup / kettle) between frames f0..f1 (absolute)."""
    rng = np.random.default_rng(seed)
    out = []
    t = 0.0
    dur = (f1 - f0) / FPS
    k = 0
    while t < dur:
        out += puff(f"{name}_{k}", origin, t, f0, n=1, spread=0.01, grow=(0.012, 0.06), life=(1.2, 1.8), rise=0.18,
                    drift=(rng.normal(0, 0.02), rng.normal(0, 0.02), 0), color=color, opacity=opacity,
                    seed=seed * 100 + k, collection=collection)
        t += 1.0 / rate
        k += 1
    return out


def motes(name, center, size, n=220, f0=0, f1=100, drift=(0.02, 0.0, 0.01), seed=0, collection=None,
          color=(1.0, 0.85, 0.6), strength=3.0):
    """Floating dust specks (one mesh of tiny quads) drifting slowly - catch the light in beams."""
    col = collection or geo.coll("FX")
    rng = np.random.default_rng(seed)
    verts, faces = [], []
    for i in range(n):
        p = Vector(rng.uniform(-0.5, 0.5, 3)) * Vector(size)
        s = rng.uniform(0.002, 0.005)
        b = len(verts)
        verts += [p + Vector((-s, 0, -s)), p + Vector((s, 0, -s)), p + Vector((s, 0, s)), p + Vector((-s, 0, s))]
        faces.append((b, b + 1, b + 2, b + 3))
    m = bpy.data.materials.get("Mote") or mat.emissive("Mote", color, strength)
    o = geo.obj_from(name, verts, faces, col, m, smooth=False)
    o.visible_shadow = False
    o.location = center
    for f in (f0, f1):
        t = (f - f0) / FPS
        o.location = Vector(center) + Vector(drift) * t
        o.rotation_euler = (0, 0, 0.02 * t)
        o.keyframe_insert("location", frame=f)
        o.keyframe_insert("rotation_euler", frame=f)
    return o


def beam(name, start, end, radius0, radius1, color=(1.0, 0.8, 0.55), strength=0.25, collection=None):
    """A soft volumetric-looking light shaft (painted haze cone): emissive, fading at its edges and far end."""
    col = collection or geo.coll("FX")
    m = bpy.data.materials.new(f"Beam_{name}")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.6})
    gen = nb.n("ShaderNodeTexCoord")
    sep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen.outputs["Generated"]})
    edge = nb.mapr(nb.sub(1.0, lw.outputs["Facing"]), 0.1, 0.9)
    along = nb.mapr(sep.outputs[2], 1.0, 0.0)
    st = mat.tex_node(nb, "strokes_vert", gen.outputs["Object"], 1.5)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    a = nb.mul(nb.mul(edge, along), nb.add(0.5, sv))
    em = nb.n("ShaderNodeEmission", inputs={"Color": color})
    nb.inp(em, "Strength", nb.mul(a, strength * 4))
    tr = nb.n("ShaderNodeBsdfTransparent")
    add = nb.n("ShaderNodeAddShader")
    nb.link(tr.outputs[0], add.inputs[0])
    nb.link(em.outputs[0], add.inputs[1])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(add.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    d = Vector(end) - Vector(start)
    o = geo.lathe(name, [(radius0, 0.0), (radius1, d.length)], seg=24, collection=col, mat=m, cap_top=False, cap_bot=False)
    o.matrix_basis = Matrix.Translation(Vector(start)) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
    o.visible_shadow = False
    return o
