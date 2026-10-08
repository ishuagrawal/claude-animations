"""Story props in the sky: the Claude-shaped constellation (with its missing eye), meteors, the comet."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, mat

# constellation in sky degrees (u right, v up) around a centre direction
CONST_STARS = {
    "TL": (-10, 6), "TR": (10, 6), "BR": (10, -5), "BL": (-10, -5),
    "ML": (-10, 1.5), "MR": (10, 1.5), "AL": (-15.5, 1.5), "AR": (15.5, 1.5),
    "L0t": (-8.0, -5), "L1t": (-3.2, -5), "L2t": (3.2, -5), "L3t": (8.0, -5),
    "L0": (-8.0, -11), "L1": (-3.2, -11), "L2": (3.2, -11), "L3": (8.0, -11),
    "EYE_L": (-5.2, 2.6),
}
EYE_R = (5.2, 2.6)       # the missing eye: where the star belongs
CONST_LINES = [("TL", "TR"), ("TR", "MR"), ("MR", "BR"), ("BR", "L3t"), ("L3t", "L2t"), ("L2t", "L1t"), ("L1t", "L0t"),
               ("L0t", "BL"), ("BL", "ML"), ("ML", "TL"), ("ML", "AL"), ("MR", "AR"),
               ("L0t", "L0"), ("L1t", "L1"), ("L2t", "L2"), ("L3t", "L3")]
CONST_CENTER = (90.0, 46.0)    # azimuth (deg, 0=+X, 90=+Y), elevation (deg)
CONST_DIST = 1800.0


def sky_dir(az_deg, el_deg):
    a, e = math.radians(az_deg), math.radians(el_deg)
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


def const_dir(u, v, center=CONST_CENTER):
    """Direction for constellation coords (u, v) degrees around the centre (small-angle tangent plane)."""
    c = sky_dir(*center)
    up = Vector((0, 0, 1))
    right = c.cross(up).normalized() * -1
    upv = right.cross(c).normalized() * -1
    d = (c + right * math.tan(math.radians(u)) + upv * math.tan(math.radians(v))).normalized()
    return d


def _glow_mat(name, color, prop, strength=1.0, alpha_prop=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    a = nb.n("ShaderNodeAttribute", attribute_name=prop, attribute_type="OBJECT").outputs["Fac"]
    em = nb.n("ShaderNodeEmission", inputs={"Color": color})
    nb.inp(em, "Strength", nb.mul(a, strength))
    out = nb.n("ShaderNodeOutputMaterial")
    if alpha_prop:
        al = nb.math("MINIMUM", nb.n("ShaderNodeAttribute", attribute_name=alpha_prop, attribute_type="OBJECT").outputs["Fac"], 1.0)
        tr = nb.n("ShaderNodeBsdfTransparent")
        mx = nb.n("ShaderNodeMixShader")
        nb.inp(mx, "Fac", al)
        nb.link(tr.outputs[0], mx.inputs[1])
        nb.link(em.outputs[0], mx.inputs[2])
        nb.link(mx.outputs[0], out.inputs[0])
        m.surface_render_method = "BLENDED"
    else:
        nb.link(em.outputs[0], out.inputs[0])
    return m


def _sphere(name, loc, r, col, m, sub=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.active_object
    o.name = name
    for c in o.users_collection:
        c.objects.unlink(o)
    col.objects.link(o)
    o.data.materials.append(m)
    return o


def _soft_mat(name, color, prop, strength=1.0, power=2.0, alpha=1.0):
    """Soft glow that fades from the centre of the shape to its silhouette (star halos, star-chart lines).
    Brightness and opacity follow the object property `prop`."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    a = nb.n("ShaderNodeAttribute", attribute_name=prop, attribute_type="OBJECT").outputs["Fac"]
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    core = nb.math("POWER", nb.math("MAXIMUM", nb.sub(1.0, lw.outputs["Facing"]), 0.0), power)
    em = nb.n("ShaderNodeEmission", inputs={"Color": color})
    nb.inp(em, "Strength", nb.mul(nb.mul(a, core), strength))
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", nb.math("MINIMUM", nb.mul(nb.mul(a, core), alpha), 1.0))
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    return m


def _haloed_star(name, loc, r, col, core_m, halo_m, halo=3.2):
    """A star point: a bright core sphere plus a soft halo shell in the same object (so one keyed property drives
    both), origin at the star."""
    import bmesh
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
    n_core = len(bm.faces)
    bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r * halo)
    bm.faces.ensure_lookup_table()
    for i, f in enumerate(bm.faces):
        f.material_index = 0 if i < n_core else 1
        f.smooth = True
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.materials.append(core_m)
    me.materials.append(halo_m)
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    o.location = loc
    return o


def constellation(center=CONST_CENTER, origin=(0, 0, 0), collection=None, lines=0.0, bright=1.0, eye=0.0):
    """Build the constellation. Returns dict(stars, lines, eye). Object props: 'bright' (stars),
    'line' (line visibility), 'eye' (the returning eye star brightness).
    Each star has a soft halo and the star-chart lines are soft glowing strokes, so the Claude shape reads as a
    figure (not a scatter of dots) even in wide shots."""
    col = collection or geo.coll("Constellation")
    O = Vector(origin)
    sm = _glow_mat("ConstStar", (0.85, 0.92, 1.0), "bright", 9.0)
    hm = _soft_mat("ConstHalo", (0.7, 0.82, 1.0), "bright", 2.2, power=3.0, alpha=0.55)
    lm = _soft_mat("ConstLine", (0.55, 0.72, 1.0), "line", 3.2, power=1.4, alpha=1.6)
    em = _glow_mat("ConstEye", (1.0, 0.85, 0.55), "eye", 40.0, alpha_prop="eye")
    ehm = _soft_mat("ConstEyeHalo", (1.0, 0.78, 0.42), "eye", 3.0, power=2.6, alpha=0.6)
    stars = {}
    for k, (u, v) in CONST_STARS.items():
        d = const_dir(u, v, center)
        big = k in ("TL", "TR", "BR", "BL", "EYE_L", "AL", "AR")
        o = _haloed_star(f"CS_{k}", O + d * CONST_DIST, 10.0 if big else 7.0, col, sm, hm,
                         halo=4.2 if k == "EYE_L" else 3.4)
        o["bright"] = bright * (1.0 if big else 0.7)
        o.visible_shadow = False
        stars[k] = o
    ls = []
    for a, b in CONST_LINES:
        pa, pb = stars[a].location, stars[b].location
        dv = pb - pa
        cyl = geo.lathe(f"CL_{a}_{b}", [(3.4, 0.0), (3.4, dv.length)], seg=10, collection=col, mat=lm, cap_top=False, cap_bot=False)
        cyl.matrix_basis = Matrix.Translation(pa) @ dv.to_track_quat("Z", "Y").to_matrix().to_4x4()
        cyl["line"] = lines
        cyl.visible_shadow = False
        ls.append(cyl)
    de = const_dir(*EYE_R, center)
    eo = _haloed_star("CS_EYE_R", O + de * CONST_DIST, 12.0, col, em, ehm, halo=4.6)
    eo["eye"] = eye
    eo.visible_shadow = False
    return dict(stars=stars, lines=ls, eye=eo, eye_dir=de)


def meteor_mat():
    m = bpy.data.materials.get("Meteor")
    if m:
        return m
    m = bpy.data.materials.new("Meteor")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    gen = nb.n("ShaderNodeTexCoord")
    sep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen.outputs["Generated"]})
    # generated Z: 0 at tail, 1 at head
    fade = nb.math("POWER", sep.outputs[2], 2.2)
    a = nb.n("ShaderNodeAttribute", attribute_name="life", attribute_type="OBJECT").outputs["Fac"]
    col = nb.n("ShaderNodeRGB")
    col.outputs[0].default_value = (1.0, 0.92, 0.75, 1)
    em = nb.n("ShaderNodeEmission")
    nb.inp(em, "Color", col.outputs[0])
    nb.inp(em, "Strength", nb.mul(nb.mul(fade, a), 30.0))
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", nb.math("MINIMUM", nb.mul(fade, nb.mul(a, 3.0)), 1.0))
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs[0])
    m.surface_render_method = "BLENDED"
    return m


def meteors(n, t0, t1, f0, seed=0, collection=None, dist=1400.0, az_range=(30, 150), el_range=(25, 70),
            length=(60, 160), dur=(0.5, 1.1), origin=(0, 0, 0), hero=None):
    """Meteor shower keyframed over shot-local [t0, t1]. hero = (t_start, end_point Vector) for the one that
    falls toward the windmill (drawn bigger, ends near end_point)."""
    col = collection or geo.coll("Meteors")
    rng = np.random.default_rng(seed)
    m = meteor_mat()
    O = Vector(origin)
    objs = []
    specs = []
    for i in range(n):
        ts = rng.uniform(t0, t1)
        d = sky_dir(rng.uniform(*az_range), rng.uniform(*el_range))
        p0 = O + d * dist
        mv = Vector((rng.normal(0, 1), rng.normal(0, 1), -abs(rng.normal(1.2, 0.3)))).normalized()
        specs.append((ts, rng.uniform(*dur), p0, mv * rng.uniform(220, 420), rng.uniform(*length), 1.0))
    if hero is not None:
        th, pe = hero
        p0 = O + sky_dir(105, 34) * 900
        specs.append((th, 1.0, p0, (Vector(pe) - p0), 70.0, 2.5))
    for i, (ts, du, p0, vel, L, w) in enumerate(specs):
        o = geo.lathe(f"Meteor{i}", [(0.0, 0.0), (0.35 * w, 0.6), (0.9 * w, 0.97), (0.0, 1.0)], seg=8, collection=col, mat=m)
        o.visible_shadow = False
        o["life"] = 0.0
        objs.append((o, ts, du, p0, vel, L))
    fps = 24
    fa = f0 + int(t0 * fps) - 2
    fb = f0 + int(t1 * fps) + 30
    for (o, ts, du, p0, vel, L) in objs:
        for f in range(fa, fb + 1):
            t = (f - f0) / fps
            u = (t - ts) / du
            life = 0.0 if (u < 0 or u > 1) else math.sin(math.pi * u) ** 0.6
            head = p0 + vel * max(0.0, min(u, 1.0))
            d = vel.normalized()
            o.matrix_basis = Matrix.Translation(head - d * L * life) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4() @ \
                Matrix.Diagonal((1, 1, max(L * life, 0.01), 1))
            o["life"] = life
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
    return [x[0] for x in objs]


def comet(az=60.0, el=30.0, dist=2600.0, origin=(0, 0, 0), collection=None, tail_dir=None, scale=1.0):
    """A bright comet: glowing head and a long two-part painterly tail."""
    col = collection or geo.coll("Comet")
    O = Vector(origin)
    d = sky_dir(az, el)
    head_p = O + d * dist
    hm = _glow_mat("CometHead", (0.85, 0.95, 1.0), "glow", 60.0)
    h = _sphere("CometHead", head_p, 9 * scale, col, hm, sub=3)
    h["glow"] = 1.0
    tail_dir = Vector(tail_dir) if tail_dir else Vector((-0.6, 0.15, 0.45)).normalized()
    tm = bpy.data.materials.new("CometTail")
    tm.use_nodes = True
    t = tm.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    gen = nb.n("ShaderNodeTexCoord")
    sep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen.outputs["Generated"]})
    st = mat.tex_node(nb, "strokes_vert", gen.outputs["Object"], 0.02)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    fade = nb.math("POWER", nb.sub(1.0, sep.outputs[2]), 1.8)
    fade = nb.mul(fade, nb.add(0.6, nb.mul(sv, 0.8)))
    col_ = nb.n("ShaderNodeRGB")
    col_.outputs[0].default_value = (0.7, 0.85, 1.0, 1)
    em = nb.n("ShaderNodeEmission")
    nb.inp(em, "Color", col_.outputs[0])
    nb.inp(em, "Strength", nb.mul(fade, 6.0))
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", nb.math("MINIMUM", nb.mul(fade, 0.9), 1.0))
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs[0])
    tm.surface_render_method = "BLENDED"
    tails = []
    for k, (L, R, off) in enumerate([(520, 60, 0.0), (380, 34, 0.08)]):
        prof = [(0.0, 0.0), (R * 0.25 * scale, 0.04 * L), (R * 0.7 * scale, 0.4 * L), (R * scale, L), (0.0, L * 1.001)]
        o = geo.lathe(f"CometTail{k}", prof, seg=16, collection=col, mat=tm)
        td = (tail_dir + Vector((0, 0, off))).normalized()
        o.matrix_basis = Matrix.Translation(head_p) @ td.to_track_quat("Z", "Y").to_matrix().to_4x4()
        o.visible_shadow = False
        tails.append(o)
    return dict(head=h, tails=tails, dir=d)
