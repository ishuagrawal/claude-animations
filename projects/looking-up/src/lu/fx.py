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


# ===================================================================== v2 environment FX
TAU = 2 * math.pi


def _ground(x, y):
    from . import terrain
    return float(terrain.height(x, y))


def _xyz(at):
    """(x, y) -> on the terrain; (x, y, z) as given."""
    if len(at) == 2:
        return Vector((at[0], at[1], _ground(at[0], at[1])))
    return Vector(at)


def _fcurves_for(o, data_path, n):
    """Ensure n fcurves for o.data_path (Blender 5 slotted actions); returns them."""
    if o.animation_data is None:
        o.animation_data_create()
    ad = o.animation_data
    if ad.action is None:
        ad.action = bpy.data.actions.new(o.name + "Action")
    act = ad.action
    out = []
    for i in range(n):
        if hasattr(act, "fcurve_ensure_for_datablock"):
            out.append(act.fcurve_ensure_for_datablock(o, data_path, index=i))
        else:
            fc = act.fcurves.find(data_path, index=i) or act.fcurves.new(data_path, index=i)
            out.append(fc)
    return out


def _bake(o, frames, values, data_path, interp="LINEAR"):
    """Fast keyframing: values (len(frames), k) onto data_path[0..k-1]."""
    values = np.asarray(values, dtype=float)
    if values.ndim == 1:
        values = values[:, None]
    fcs = _fcurves_for(o, data_path, values.shape[1])
    fr = np.asarray(frames, dtype=float)
    for i, fc in enumerate(fcs):
        fc.keyframe_points.clear()
        fc.keyframe_points.add(len(fr))
        co = np.stack([fr, values[:, i]], 1).ravel()
        fc.keyframe_points.foreach_set("co", co)
        fc.keyframe_points.foreach_set("interpolation", [2 if interp == "LINEAR" else 0] * len(fr))  # 2 = LINEAR, 0 = CONSTANT
        fc.update()


def _vis_window(o, f0, f1):
    """Hidden before f0 and after f1 (keyed, constant)."""
    sc = bpy.context.scene
    frames = [min(f0 - 1, sc.frame_start - 1), f0, f1 + 1]
    vals = [1.0, 0.0, 1.0]
    _bake(o, frames, np.array(vals)[:, None], "hide_render", interp="CONSTANT")


# --------------------------------------------------------------------- fireflies
def _firefly_mats():
    core = bpy.data.materials.get("FireflyCore")
    if core is None:
        core = bpy.data.materials.new("FireflyCore")
        core.use_nodes = True
        t = core.node_tree
        t.nodes.clear()
        nb = mat.NB(t)
        b = nb.n("ShaderNodeAttribute", attribute_name="blink", attribute_type="INSTANCER").outputs["Fac"]
        st = nb.n("ShaderNodeAttribute", attribute_name="ff_strength", attribute_type="OBJECT").outputs["Fac"]
        em = nb.n("ShaderNodeEmission", inputs={"Color": (0.86, 1.0, 0.36)})
        nb.inp(em, "Strength", nb.mul(nb.mul(b, st), 1.0))
        tr = nb.n("ShaderNodeBsdfTransparent")
        add = nb.n("ShaderNodeAddShader")             # additive: a dark firefly is invisible, never a black dot
        nb.link(tr.outputs[0], add.inputs[0])
        nb.link(em.outputs[0], add.inputs[1])
        out = nb.n("ShaderNodeOutputMaterial")
        nb.link(add.outputs[0], out.inputs[0])
        core.surface_render_method = "BLENDED"
    halo = bpy.data.materials.get("FireflyHalo")
    if halo is None:
        halo = bpy.data.materials.new("FireflyHalo")
        halo.use_nodes = True
        t = halo.node_tree
        t.nodes.clear()
        nb = mat.NB(t)
        b = nb.n("ShaderNodeAttribute", attribute_name="blink", attribute_type="INSTANCER").outputs["Fac"]
        st = nb.n("ShaderNodeAttribute", attribute_name="ff_halo", attribute_type="OBJECT").outputs["Fac"]
        lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
        a = nb.math("POWER", nb.mapr(lw.outputs["Facing"], 0.0, 1.0, 1.0, 0.0, interp="LINEAR"), 3.0)
        em = nb.n("ShaderNodeEmission", inputs={"Color": (0.75, 1.0, 0.3)})
        nb.inp(em, "Strength", nb.mul(nb.mul(a, b), st))
        tr = nb.n("ShaderNodeBsdfTransparent")
        add = nb.n("ShaderNodeAddShader")
        nb.link(tr.outputs[0], add.inputs[0])
        nb.link(em.outputs[0], add.inputs[1])
        out = nb.n("ShaderNodeOutputMaterial")
        nb.link(add.outputs[0], out.inputs[0])
        halo.surface_render_method = "BLENDED"
    return core, halo


def _firefly_proto(size):
    name = f"FireflyProto_{size:.4f}"
    o = bpy.data.objects.get(name)
    if o:
        return o
    core, halo = _firefly_mats()
    col = bpy.data.collections.get("LU_FXProtos") or bpy.data.collections.new("LU_FXProtos")
    if col.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(col)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size)
    c = bpy.context.active_object
    c.data.materials.append(core)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=size * 7.0)
    h = bpy.context.active_object
    h.data.materials.append(halo)
    h.data.shade_smooth()
    o = geo.join([c, h], name)
    for cc in o.users_collection:
        cc.objects.unlink(o)
    col.objects.link(o)
    o.visible_shadow = False
    lc = bpy.context.view_layer.layer_collection.children.get(col.name)
    if lc:
        lc.exclude = True
    return o


def fireflies(center, radius, count, f0, f1, seed=0, height=(0.15, 1.6), size=0.009, strength=30.0, halo=0.9,
              drift=0.4, speed=0.35, blink=0.55, attract=None, name="Fireflies"):
    """Drifting, blinking warm yellow-green fireflies with a soft glow (Geometry Nodes, closed-form motion: every frame
    is deterministic and independent). center (x, y[, z]); with z they fill height-range around z, else they float
    `height` metres above the terrain. drift = wander amplitude (m), speed = wander rate, blink 0..1 = how much they
    flash (0 = steady). attract = dict(obj=<object>, radius=1.6, swirl=2.5, pull=0.45, lag=None): fireflies within
    radius of obj swirl around it (rad/s near its centre) and are drawn in; obj's animated location is read every
    frame (use the star rig for SH09; lag=<Empty> to follow a delayed copy). Returns the point-cloud object.
    Scene-wide: obj['ff_strength'] scales the glow (keyable)."""
    from . import dress
    rng = np.random.default_rng(seed)
    c = Vector(center)
    pts = []
    for i in range(count):
        r = radius * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        x, y = c.x + r * math.cos(a), c.y + r * math.sin(a)
        if len(center) == 3:
            z = c.z + rng.uniform(-0.5, 0.5) * (height[1] - height[0])
        else:
            z = _ground(x, y) + rng.uniform(*height) ** 1.0
        pts.append((x, y, z))
    me = bpy.data.meshes.new(name)
    me.vertices.add(count)
    me.vertices.foreach_set("co", np.array(pts, dtype=np.float32).ravel())
    ob = bpy.data.objects.new(name, me)
    geo.coll("FX").objects.link(ob)
    ob["ff_strength"] = strength
    ob["ff_halo"] = halo
    ob.visible_shadow = False
    proto = _firefly_proto(size)
    g = bpy.data.node_groups.new(name + "GN", "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    G = dress.GB(g)
    gi, go = G.n("NodeGroupInput"), G.n("NodeGroupOutput")
    fps = bpy.context.scene.render.fps
    t = G.sub(G.n("GeometryNodeInputSceneTime").outputs["Seconds"], f0 / fps)
    pos = G.n("GeometryNodeInputPosition").outputs[0]
    rid = G.rand(0, 100, seed + 3)
    # wander: 3-D noise sampled along a slow path, per firefly
    wv = G.vm("ADD", G.vm("SCALE", pos, scale=0.7), G.xyz(G.mul(t, speed), rid, G.mul(t, speed * 0.6)))
    nz = G.n("ShaderNodeTexNoise", noise_dimensions="3D")
    G.set(nz, "Vector", wv)
    nz.inputs["Scale"].default_value = 1.0
    nz.inputs["Detail"].default_value = 1.0
    off = G.vm("MULTIPLY", G.vm("SUBTRACT", nz.outputs["Color"], (0.5, 0.5, 0.5)), (drift * 4.0, drift * 4.0, drift * 1.6))
    p = G.vm("ADD", pos, off)
    if attract:
        tgt = attract.get("lag") or attract["obj"]
        oi = G.n("GeometryNodeObjectInfo", transform_space="ORIGINAL")
        oi.inputs["Object"].default_value = tgt
        T = oi.outputs["Location"]
        R = attract.get("radius", 1.6)
        rel = G.vm("SUBTRACT", p, T)
        d = G.vm("LENGTH", rel)
        w = G.sub(1.0, G.mapr(d, 0.0, R))
        ang = G.mul(G.mul(w, attract.get("swirl", 2.5)), G.math("MAXIMUM", t, 0.0))
        rx, ry, rz = G.sep(rel)
        ca, sa = G.math("COSINE", ang), G.math("SINE", ang)
        rot = G.xyz(G.sub(G.mul(rx, ca), G.mul(ry, sa)), G.add(G.mul(rx, sa), G.mul(ry, ca)), G.mul(rz, G.sub(1.0, G.mul(w, 0.4))))
        pull = G.sub(1.0, G.mul(w, attract.get("pull", 0.45)))
        p = G.vm("ADD", T, G.vm("SCALE", rot, scale=pull))
    sp = G.n("GeometryNodeSetPosition")
    G.set(sp, "Geometry", gi.outputs[0])
    G.set(sp, "Position", p)
    iop = G.n("GeometryNodeInstanceOnPoints")
    G.set(iop, "Points", sp.outputs[0])
    oi2 = G.n("GeometryNodeObjectInfo", transform_space="ORIGINAL")
    oi2.inputs["Object"].default_value = proto
    oi2.inputs["As Instance"].default_value = True
    G.set(iop, "Instance", oi2.outputs["Geometry"])
    G.set(iop, "Scale", G.xyz(G.rand(0.7, 1.3, seed + 5), G.rand(0.7, 1.3, seed + 5), G.rand(0.7, 1.3, seed + 5)))
    # blink: slow soft flashes with a faint glow in between
    bn = G.n("ShaderNodeTexNoise", noise_dimensions="1D")
    G.set(bn, "W", G.add(G.mul(t, 0.9), G.mul(rid, 3.7)))
    bn.inputs["Scale"].default_value = 1.0
    bn.inputs["Detail"].default_value = 0.0
    flash = G.mapr(bn.outputs[0], 0.5, 0.66)
    bval = G.add(1.0 - blink, G.mul(flash, blink))
    bval = G.mul(bval, G.add(0.15, G.mul(G.rand(0.0, 1.0, seed + 9), 0.85)))
    st = G.n("GeometryNodeStoreNamedAttribute", data_type="FLOAT", domain="INSTANCE")
    G.set(st, "Geometry", iop.outputs[0])
    st.inputs["Name"].default_value = "blink"
    G.set(st, 3, bval)
    G.set(go, 0, st.outputs[0])
    mod = ob.modifiers.new("Fireflies", "NODES")
    mod.node_group = g
    if f0 > bpy.context.scene.frame_start or f1 < bpy.context.scene.frame_end:
        _vis_window(ob, f0, f1)
    return ob


def lag_target(obj, f0, f1, lag_frames=6, name=None):
    """An Empty following obj's animated world location `lag_frames` behind (for fireflies swirling in a wake)."""
    sc = bpy.context.scene
    cur = sc.frame_current
    locs = []
    for f in range(f0 - lag_frames, f1 + 1):
        sc.frame_set(f)
        locs.append(obj.matrix_world.translation.copy())
    sc.frame_set(cur)
    e = bpy.data.objects.new(name or (obj.name + "_Lag"), None)
    sc.collection.objects.link(e)
    frames = list(range(f0, f1 + 1))
    _bake(e, frames, np.array([tuple(locs[i]) for i in range(len(frames))]), "location")
    return e


# --------------------------------------------------------------------- crater
def _crater_mat():
    m = bpy.data.materials.get("CraterChar")
    if m:
        return m

    def emb_albedo(nb, co):
        return nb.n("ShaderNodeAttribute", attribute_name="col", attribute_type="GEOMETRY").outputs["Color"]
    m = mat.painterly("CraterChar", (1, 1, 1), stroke="strokes_broad", scale=3.0, tex_amt=1.2, breakup=1.4, bump=0.35,
                      albedo_fn=emb_albedo, ao=0.5, snow=0.0)
    # glowing ember cracks: thin, wandering voronoi veins (noise-warped), only some alive, + ember specks; x heat
    # (vertex 'heat', strongest at the bottom) x glow (object prop) x flicker (keyed 'flick'); a soft gold bloom at
    # the very bottom where the star lies
    t = m.node_tree
    nb = mat.NB(t)
    em = [n for n in t.nodes if n.type == "EMISSION"][-1]
    src = em.inputs["Color"].links[0].from_socket
    tc = nb.n("ShaderNodeTexCoord")
    co = tc.outputs["Object"]
    wn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 6.0, "Detail": 2.0})
    nb.link(co, wn.inputs["Vector"])
    off = nb.vmath("SUBTRACT", wn.outputs["Color"], (0.5, 0.5, 0.5))
    scl = nb.n("ShaderNodeVectorMath", operation="SCALE")
    nb.link(off, scl.inputs[0])
    scl.inputs[3].default_value = 0.12
    warped = nb.vmath("ADD", co, scl.outputs[0])
    vor = nb.n("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE", voronoi_dimensions="3D")
    vor.inputs["Scale"].default_value = 11.0
    nb.link(warped, vor.inputs["Vector"])
    crack = nb.mapr(vor.outputs["Distance"], 0.03, 0.0)
    alive = nb.n("ShaderNodeTexNoise", inputs={"Scale": 3.0, "Detail": 1.0})
    nb.link(co, alive.inputs["Vector"])
    crack = nb.mul(crack, nb.mapr(alive.outputs["Fac"], 0.48, 0.62))
    sp = mat.tex_node(nb, "sponge", co, 5.0)
    dots = nb.mapr(nb.n("ShaderNodeSeparateColor", inputs={"Color": sp.outputs["Color"]}).outputs[2], 0.69, 0.76)
    heat = nb.n("ShaderNodeAttribute", attribute_name="heat", attribute_type="GEOMETRY").outputs["Fac"]
    glow = nb.n("ShaderNodeAttribute", attribute_name="glow", attribute_type="OBJECT").outputs["Fac"]
    flick = nb.n("ShaderNodeAttribute", attribute_name="flick", attribute_type="OBJECT").outputs["Fac"]
    hot = nb.math("POWER", heat, 1.5)
    e = nb.mul(nb.mul(nb.math("MAXIMUM", crack, nb.mul(dots, 0.6)), hot), nb.mul(glow, flick))
    ramp = nb.n("ShaderNodeValToRGB")
    cr = ramp.color_ramp
    cr.elements[0].color = (0.45, 0.06, 0.01, 1)
    cr.elements[1].color = (1.0, 0.8, 0.4, 1)
    el = cr.elements.new(0.45)
    el.color = (1.0, 0.36, 0.05, 1)
    nb.link(nb.mapr(e, 0.0, 1.0), ramp.inputs[0])
    ecol = nb.mix(1.0, ramp.outputs[0], nb.n("ShaderNodeCombineColor", inputs={"Red": e, "Green": e, "Blue": e}).outputs[0],
                  blend="MULTIPLY")
    bed = nb.mul(nb.mul(nb.math("POWER", heat, 4.0), nb.mul(glow, flick)), 0.35)
    gold = nb.mix(1.0, (1.0, 0.62, 0.2), nb.n("ShaderNodeCombineColor", inputs={"Red": bed, "Green": bed, "Blue": bed}).outputs[0],
                  blend="MULTIPLY")
    add = nb.mix(5.0, src, ecol, blend="ADD")
    add = nb.mix(1.0, add, gold, blend="ADD")
    nb.link(add, em.inputs["Color"])
    return m


def embers(name, origin, f0, f1, rate=10.0, spread=0.35, rise=(0.25, 0.6), life=(0.8, 2.0), size=0.006, seed=0,
           color=(1.0, 0.55, 0.15), strength=40.0, wind=(0.0, 0.08, 0.0)):
    """Glowing embers drifting up out of a hot spot, wobbling and fading (keyed, deterministic)."""
    col = geo.coll("FX")
    rng = np.random.default_rng(seed)
    m = _life_emissive("Ember", color, strength)
    O = Vector(origin)
    fps = bpy.context.scene.render.fps
    dur = (f1 - f0) / fps
    n = max(1, int(rate * dur))
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size)
    base = bpy.context.active_object
    base.data.materials.append(m)
    me = base.data
    bpy.data.objects.remove(base)
    objs = []
    for i in range(n):
        o = bpy.data.objects.new(f"{name}{i}", me)
        col.objects.link(o)
        o.visible_shadow = False
        ts = rng.uniform(-0.5, dur)
        L = rng.uniform(*life)
        p0 = O + Vector((rng.normal(0, spread * 0.5), rng.normal(0, spread * 0.5), 0.02))
        v = Vector((rng.normal(0, 0.12), rng.normal(0, 0.12), rng.uniform(*rise))) + Vector(wind)
        ph = rng.uniform(0, TAU, 2)
        frames, locs, lifev = [], [], []
        fa = max(f0, f0 + int(ts * fps) - 1)
        fb = min(f1, f0 + int((ts + L) * fps) + 1)
        for f in range(f0, f1 + 1):
            tt = (f - f0) / fps - ts
            if tt < 0 or tt > L:
                if f in (f0, f1) or f == fa - 1 or f == fb + 1:
                    frames.append(f)
                    locs.append(tuple(p0))
                    lifev.append(0.0)
                continue
            u = tt / L
            p = p0 + v * tt + Vector((math.sin(tt * 5 + ph[0]) * 0.04, math.cos(tt * 4 + ph[1]) * 0.04, 0)) * tt
            frames.append(f)
            locs.append(tuple(p))
            lifev.append(max(0.0, math.sin(math.pi * min(1, u * 3)) if u < 0.33 else (1 - u) / 0.67) * rng.uniform(0.6, 1.0))
        if len(frames) < 2:
            bpy.data.objects.remove(o)
            continue
        o["life"] = 0.0
        _bake(o, frames, np.array(locs), "location")
        _bake(o, frames, np.array(lifev)[:, None], '["life"]')
        objs.append(o)
    return objs


def smoke(name, origin, f0, f1, rate=3.5, seed=0, color=(0.32, 0.31, 0.34), opacity=0.32, rise=0.35, grow=(0.08, 0.5),
          drift=(0.0, 0.12, 0.0), emit=0.0):
    """A continuous column of soft painted smoke wisps (fx.puff) from origin between absolute frames f0..f1."""
    rng = np.random.default_rng(seed)
    out = []
    fps = bpy.context.scene.render.fps
    t = -1.5                       # pre-roll: the column is already established at f0
    dur = (f1 - f0) / fps
    k = 0
    while t < dur:
        out += puff(f"{name}_{k}", origin, t, f0, n=1, spread=0.05, grow=grow, life=(1.8, 2.8), rise=rise,
                    drift=(drift[0] + rng.normal(0, 0.05), drift[1] + rng.normal(0, 0.05), drift[2]), color=color,
                    opacity=opacity, seed=seed * 100 + k, emit=emit)
        t += 1.0 / rate
        k += 1
    return out


def crater(at=None, f0=1, f1=None, radius=0.5, glow=1.0, glow_keys=None, heading=200.0, furrow=1.4, smoke_on=True,
           embers_on=True, light=True, seed=7, **kw):
    """The scorched crater the star fell into (at layout.CRATER by default): a charred bowl with glowing ember cracks
    and a thrown-up lip of turf and clods, a burnt furrow behind it (where the star skidded in, coming from `heading`
    degrees: 0 = from +X, 90 = from north), the meadow flattened radially and burnt around it, a warm gold light, rising
    smoke and embers. glow = ember/light intensity (or glow_keys=[(frame, value), ...] to animate it; it cools as the
    star dims). Returns dict(center = world point on the bowl floor (where the star curls up), light, objects, radius,
    floor_z, glow_target (object whose ['glow'] drives the cracks))."""
    from . import layout, terrain, dress
    sc = bpy.context.scene
    f1 = f1 if f1 is not None else sc.frame_end
    at = at if at is not None else layout.CRATER
    cx, cy = at[0], at[1]
    gz = _ground(cx, cy)
    rng = np.random.default_rng(seed)
    col = geo.coll("FX")
    R = radius
    R_out = R * 2.4
    # --- the bowl / lip mesh (polar grid), heat painted per vertex
    nr, na = 22, 64
    hd = math.radians(heading)
    back = Vector((math.cos(hd), math.sin(hd), 0))
    verts, faces, cols, heat = [], [], [], []

    def prof(r, a):
        u = r / R
        z = -0.17 * max(0.0, 1 - u * u) ** 1.2
        z += 0.075 * math.exp(-((u - 1.08) / 0.22) ** 2) * (1 + 0.5 * math.sin(a * 5 + 1.3) * math.sin(a * 3))
        z += 0.012 * math.sin(a * 11 + u * 7) * min(1.0, u)
        # skid furrow behind (toward `heading`)
        da = math.atan2(math.sin(a - hd), math.cos(a - hd))
        if u > 0.8:
            z -= 0.05 * math.exp(-(da / 0.18) ** 2) * max(0.0, 1 - (u - 0.8) / 2.2)
        return z * min(1.0, (R_out - r) / (R * 0.5)) if r > R_out - R * 0.5 else z

    verts.append((cx, cy, gz + prof(0.0, 0.0)))
    cols.append((0.02, 0.016, 0.014))
    heat.append(1.0)
    rs = [R_out * (i / nr) ** 1.25 for i in range(1, nr + 1)]
    for i, r in enumerate(rs):
        for j in range(na):
            a = TAU * j / na
            rr = r * (1 + 0.06 * math.sin(a * 4 + 0.7) * min(1, r / R))
            x, y = cx + rr * math.cos(a), cy + rr * math.sin(a)
            g = _ground(x, y)
            verts.append((x, y, g + prof(rr, a) + 0.012))
            u = rr / R
            char = (0.02, 0.016, 0.014)
            dirt = (0.24, 0.16, 0.10)
            scor = (0.30, 0.24, 0.14)
            if u < 0.8:
                c = char
            elif u < 1.25:
                k = (u - 0.8) / 0.45
                c = tuple(char[q] + (dirt[q] - char[q]) * k for q in range(3))
            else:
                k = min(1.0, (u - 1.25) / 1.0)
                c = tuple(dirt[q] + (scor[q] - dirt[q]) * k for q in range(3))
            c = tuple(x_ * rng.uniform(0.8, 1.15) for x_ in c)
            cols.append(c)
            heat.append(max(0.0, 1 - (u / 1.05) ** 2) * (0.6 + 0.4 * rng.random()))
    for j in range(na):
        faces.append((0, 1 + j, 1 + (j + 1) % na))
    for i in range(nr - 1):
        b0, b1 = 1 + i * na, 1 + (i + 1) * na
        for j in range(na):
            j2 = (j + 1) % na
            faces.append((b0 + j, b1 + j, b1 + j2, b0 + j2))
    ob = geo.obj_from("Crater", verts, faces, col, _crater_mat())
    me = ob.data
    att = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.concatenate([np.array(cols), np.ones((len(cols), 1))], 1).ravel())
    ha = me.attributes.new("heat", "FLOAT", "POINT")
    ha.data.foreach_set("value", np.array(heat, dtype=np.float32))
    ob["glow"] = float(glow)
    ob["flick"] = 1.0
    # --- push the terrain down under the bowl so it can't poke through
    peak = bpy.data.objects.get("Peak")
    if peak:
        pm = peak.data
        co = np.empty(len(pm.vertices) * 3)
        pm.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        d = np.hypot(co[:, 0] - cx, co[:, 1] - cy)
        fall = np.clip((R_out - 0.05 - d) / 0.35, 0, 1)
        co[:, 2] -= 0.3 * fall
        pm.vertices.foreach_set("co", co.ravel())
        pm.update()
    # --- clods of turf thrown onto the lip
    rock_m = bpy.data.materials.get("CoverStone")
    clods = []
    dirt_m = bpy.data.materials.get("CraterClod") or mat.painterly(
        "CraterClod", (0.22, 0.15, 0.09), stroke="strokes_broad", scale=6, tex_amt=1.2, breakup=1.4, bump=0.3,
        color2=(0.16, 0.22, 0.07), c2_thresh=(0.55, 0.65), ao=0.5, snow=0.0)
    for k in range(26):
        a = rng.uniform(0, TAU)
        r = R * rng.uniform(1.0, 1.9)
        x, y = cx + r * math.cos(a), cy + r * math.sin(a)
        s = rng.uniform(0.025, 0.07) * (1.3 - 0.4 * (r / R - 1))
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=1.0)
        c = bpy.context.active_object
        geo.displace_noise(c, 0.3, 0.6, seed=k)
        c.scale = (s * 1.3, s, s * 0.7)
        c.location = (x, y, _ground(x, y) + prof(r, a) + s * 0.3)
        c.rotation_euler = tuple(rng.uniform(0, 6.28, 3))
        c.data.materials.append(dirt_m)
        clods.append(c)
    cl = geo.join(clods, "CraterClods")
    for cc in cl.users_collection:
        cc.objects.unlink(cl)
    col.objects.link(cl)
    # --- the meadow: mown inside, flattened radially + burnt around, and along the furrow
    dress.mow((cx, cy), R * 1.12)
    dress.flatten((cx, cy), R * 3.3, burn_radius=R * 2.1, angle=1.3)
    for k in range(5):
        q = Vector((cx, cy, 0)) + back * (R * 1.2 + k * furrow / 5)
        dress.flatten((q.x, q.y), 0.35, burn_radius=0.3, angle=1.1)
        dress.mow((q.x, q.y), 0.12)
    out = dict(obj=ob, clods=cl, radius=R, floor_z=gz + prof(0.0, 0.0), center=Vector((cx, cy, gz + prof(0.0, 0.0))),
               glow_target=ob, objects=[ob, cl])
    # --- warm light (the bowl glows gold)
    if light:
        ld = bpy.data.lights.new("CraterGlow", "POINT")
        ld.color = (1.0, 0.62, 0.24)
        ld.energy = 30.0 * glow
        ld.shadow_soft_size = R * 0.6
        lo = bpy.data.objects.new("CraterGlow", ld)
        sc.collection.objects.link(lo)
        lo.location = (cx, cy, gz + 0.12)
        out["light"] = lo
    # --- animate glow (keys) and a gentle flicker
    fr = list(range(f0, f1 + 1))
    if glow_keys:
        gk = sorted(glow_keys)
        gv = np.interp(fr, [k_[0] for k_ in gk], [k_[1] for k_ in gk])
    else:
        gv = np.full(len(fr), float(glow))
    flick = 0.85 + 0.15 * np.sin(np.array(fr) * 0.9 + 1.3) * np.sin(np.array(fr) * 0.37)
    _bake(ob, fr, gv[:, None], '["glow"]')
    _bake(ob, fr, flick[:, None], '["flick"]')
    if light:
        _bake(out["light"].data, fr, (30.0 * gv * flick)[:, None], "energy")
    if smoke_on:
        out["smoke"] = smoke("CraterSmoke", (cx, cy, gz - 0.02), f0, f1, rate=3.0, seed=seed, color=(0.30, 0.29, 0.32),
                             opacity=0.3, grow=(R * 0.2, R * 1.4), rise=0.32)
    if embers_on:
        out["embers"] = embers("CraterEmber", (cx, cy, gz - 0.05), f0, f1, rate=9.0 * max(glow, 0.3), spread=R * 0.9,
                               seed=seed + 1)
    return out


# --------------------------------------------------------------------- petals, pollen
def _petal_mesh(color, name):
    me = bpy.data.meshes.get(name)
    if me:
        return me
    verts = [(0, -0.5, 0), (0.28, -0.05, 0.03), (0.18, 0.4, 0.0), (0, 0.5, -0.02), (-0.18, 0.4, 0.0), (-0.28, -0.05, 0.03)]
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], [(0, 1, 2, 3, 4, 5)])
    me.update()
    m = bpy.data.materials.get(name + "M") or mat.painterly(name + "M", color, stroke="strokes_fine", scale=20,
                                                            tex_amt=0.5, wrap=0.4, translucent=0.4, backface=True,
                                                            snow=0.0)
    from . import dress
    if "Lift" not in m.node_tree.nodes:
        dress._lift(m, 0.08)
    me.materials.append(m)
    return me


PETAL_COLS = ((0.92, 0.9, 0.82), (0.92, 0.9, 0.82), (0.13, 0.36, 1.0), (0.92, 0.32, 0.58), (0.36, 0.15, 0.78), (1.0, 0.7, 0.04))


def _petal_paths(rng, n, p0s, t0s, v0s, f0, f1, wind, drag=2.2, sink=0.28, flutter=0.06):
    fps = bpy.context.scene.render.fps
    out = []
    for i in range(n):
        frames, locs, rots = [], [], []
        vt = Vector((wind[0], wind[1], wind[2] - sink))
        ph = rng.uniform(0, TAU, 3)
        spin = Vector(rng.normal(0, 6, 3))
        landed = None
        for f in range(f0, f1 + 1):
            t = (f - f0) / fps - t0s[i]
            if t < 0:
                p, r = p0s[i], Vector((0, 0, 0))
                frames.append(f)
                locs.append(tuple(p))
                rots.append(tuple(r))
                continue
            e = (1 - math.exp(-drag * t)) / drag
            p = p0s[i] + vt * t + (v0s[i] - vt) * e
            p += Vector((math.sin(t * 6 + ph[0]), math.cos(t * 5 + ph[1]), 0.4 * math.sin(t * 7 + ph[2]))) * flutter * min(1, t * 2)
            g = _ground(p.x, p.y) + 0.06
            if landed is None and p.z < g and t > 0.2:
                landed = (p.copy(), spin * t)
            if landed is not None:
                p = Vector((landed[0].x, landed[0].y, g))
                r = landed[1]
            else:
                r = spin * t
            frames.append(f)
            locs.append(tuple(p))
            rots.append(tuple(r))
        out.append((frames, locs, rots))
    return out


def petal_burst(origin, f, n=60, f1=None, speed=(0.8, 2.4), up=0.75, life=None, size=(0.02, 0.034), seed=0,
                colors=PETAL_COLS, wind=(0.0, 0.0, 0.0), spread=0.25, name="Petals"):
    """Petals bursting up from origin at absolute frame f (the SH10 tumble into the flowers): they fly out, flutter,
    drift down and settle on the meadow. Returns the petal objects."""
    sc = bpy.context.scene
    f1 = f1 if f1 is not None else sc.frame_end
    rng = np.random.default_rng(seed)
    O = Vector(origin)
    col = geo.coll("FX")
    p0s, t0s, v0s = [], [], []
    for i in range(n):
        p0s.append(O + Vector((rng.normal(0, spread), rng.normal(0, spread), rng.uniform(0.0, 0.15))))
        t0s.append(rng.uniform(0, 0.12))
        d = Vector(rng.normal(0, 1, 3))
        d.z = abs(d.z) * up + 0.6
        v0s.append(d.normalized() * rng.uniform(*speed))
    paths = _petal_paths(rng, n, p0s, t0s, v0s, f, f1, wind)
    objs = []
    for i, (frames, locs, rots) in enumerate(paths):
        c = colors[int(rng.integers(0, len(colors)))]
        me = _petal_mesh(c, f"PetalMesh{colors.index(c)}")
        o = bpy.data.objects.new(f"{name}{i}", me)
        col.objects.link(o)
        s = rng.uniform(*size) / 0.5
        o.scale = (s, s * rng.uniform(1.0, 1.6), s)
        o.visible_shadow = False
        _bake(o, frames, np.array(locs), "location")
        _bake(o, frames, np.array(rots), "rotation_euler")
        _vis_window(o, f, f1)
        objs.append(o)
    return objs


def pollen_burst(origin, f, n=90, f1=None, speed=(0.2, 0.9), seed=0, size=0.0035, color=(1.0, 0.85, 0.35),
                 strength=6.0, rise=0.18, spread=0.3, name="Pollen"):
    """A puff of pollen motes from origin at frame f: specks drift up and outward, wander, and fade (faintly glowing
    so they catch the star's light)."""
    sc = bpy.context.scene
    f1 = f1 if f1 is not None else sc.frame_end
    rng = np.random.default_rng(seed)
    O = Vector(origin)
    col = geo.coll("FX")
    m = _life_emissive("Pollen", color, strength)
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=size)
    base = bpy.context.active_object
    base.data.materials.append(m)
    me = base.data
    bpy.data.objects.remove(base)
    fps = sc.render.fps
    objs = []
    for i in range(n):
        o = bpy.data.objects.new(f"{name}{i}", me)
        col.objects.link(o)
        o.visible_shadow = False
        p0 = O + Vector(rng.normal(0, spread, 3)) * Vector((1, 1, 0.3))
        d = Vector(rng.normal(0, 1, 3))
        d.z = abs(d.z) + 0.3
        v0 = d.normalized() * rng.uniform(*speed)
        L = rng.uniform(1.5, 3.5)
        ph = rng.uniform(0, TAU, 3)
        frames, locs, lifev = [], [], []
        for fr in range(f, f1 + 1):
            t = (fr - f) / fps
            e = (1 - math.exp(-2.5 * t)) / 2.5
            p = p0 + v0 * e + Vector((0.05 * math.sin(t * 1.7 + ph[0]), 0.05 * math.cos(t * 1.3 + ph[1]), rise * t))
            u = t / L
            frames.append(fr)
            locs.append(tuple(p))
            lifev.append(max(0.0, min(1.0, t * 6.0)) * max(0.0, 1 - u) * rng.uniform(0.6, 1.0))
        o["life"] = 0.0
        _bake(o, frames, np.array(locs), "location")
        _bake(o, frames, np.array(lifev)[:, None], '["life"]')
        _vis_window(o, f, f1)
        objs.append(o)
    return objs


def petal_gust(center, radius, f0, f1, n=80, wind=(0.0, 5.5, 1.4), seed=0, size=(0.02, 0.032), colors=PETAL_COLS,
               name="GustPetals"):
    """Petals torn off the meadow by a gust (SH15): they lift from random spots within radius of center at staggered
    times in [f0, f1] and stream away with the wind, fluttering."""
    sc = bpy.context.scene
    rng = np.random.default_rng(seed)
    fps = sc.render.fps
    col = geo.coll("FX")
    p0s, t0s, v0s = [], [], []
    for i in range(n):
        r = radius * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        x, y = center[0] + r * math.cos(a), center[1] + r * math.sin(a)
        p0s.append(Vector((x, y, _ground(x, y) + rng.uniform(0.12, 0.35))))
        t0s.append(rng.uniform(0, (f1 - f0) / fps * 0.6))
        v0s.append(Vector((rng.normal(0, 0.4), rng.normal(0, 0.4), rng.uniform(0.6, 1.6))))
    paths = _petal_paths(rng, n, p0s, t0s, v0s, f0, f1, wind, drag=1.4, sink=-0.25, flutter=0.12)
    objs = []
    for i, (frames, locs, rots) in enumerate(paths):
        c = colors[int(rng.integers(0, len(colors)))]
        me = _petal_mesh(c, f"PetalMesh{colors.index(c)}")
        o = bpy.data.objects.new(f"{name}{i}", me)
        col.objects.link(o)
        s = rng.uniform(*size) / 0.5
        o.scale = (s, s * rng.uniform(1.0, 1.6), s)
        o.visible_shadow = False
        _bake(o, frames, np.array(locs), "location")
        _bake(o, frames, np.array(rots), "rotation_euler")
        objs.append(o)
    return objs
