"""Story props in the sky: the Claude-shaped constellation (with its falling / returning eye), the falling-star
streak, the ignition burst, meteors, the comet.

The constellation (v2 look)
  * Every star is a camera-facing painted sprite drawn on a sphere (works for any camera): white-hot core, soft
    halo, thin four-point sparkle. Faint brushy star-chart lines (dry-brush breaks, hand-drawn wobble, gaps at
    the stars) join them into the mascot: a box body, two arms, four legs and two eyes.
  * One shared node group "CS_Ctrl" drives the whole figure, so ONE keyframe animates every star/line:
        key_lines(v, frame)   chart-line visibility (0 hidden .. 1 normal .. 3 flare)
        key_bright(v, frame)  every star's brightness multiplier
        key_glow(v, frame)    halo / sparkle size multiplier
    Per-object properties still work and multiply: star["bright"], star["spike"], line["line"],
    CS_EYE_R["eye"] (the gold eye that falls and returns; 0 = gone: a faint empty socket shows instead),
    CS_EYE_R["socket"] (empty-socket ring visibility, default 1).
Helpers for the shots
    twinkle(eye_obj, f0, times)                     eye twinkles back (SH04, SH19)
    flicker(eye_obj, f0, f1)                        nervous flicker before it breaks loose (SH04)
    falling_star(start_world, end_world, f0, f1)    curving sparkling streak with a trail -> layout.CRATER (SH04)
                                                    (also works upward: Claude's arms -> the eye, SH17)
    ignite(f_ignite)                                gold burst + rays, chart lines flare, violet/pink sky (SH17)
    flicker_lines(f0, f1), breathe_lines(f0, f1)    sad flicker (SH13) / lines breathing in (SH01)
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Quaternion

from . import geo, mat

# ---------------------------------------------------------------- the figure (sky degrees: u right, v up)
# Proportions from refs/claude-mascot.png (body 1 x 0.72, legs 0.27, arms 0.245, eyes at x +-0.307, 0.236 of the body
# height below its top) at 20 deg per body width. Outer legs hang from the bottom corners (BL / BR).
CONST_STARS = {
    "TL": (-10, 7.0), "TR": (10, 7.0), "BR": (10, -6.0), "BL": (-10, -6.0),
    "ML": (-10, 0.5), "MR": (10, 0.5), "AL": (-15.5, 0.5), "AR": (15.5, 0.5),
    "L1t": (-3.7, -6.0), "L2t": (3.7, -6.0),
    "L0": (-9.3, -11.0), "L1": (-3.7, -11.0), "L2": (3.7, -11.0), "L3": (9.3, -11.0),
    "EYE_L": (-6.1, 3.9),
}
EYE_R = (6.1, 3.9)       # the gold eye: where the star belongs (falls in SH04, returns in SH17)
CONST_LINES = [("TL", "TR"), ("TR", "MR"), ("MR", "BR"), ("BR", "L2t"), ("L2t", "L1t"), ("L1t", "BL"),
               ("BL", "ML"), ("ML", "TL"), ("ML", "AL"), ("MR", "AR"),
               ("BL", "L0"), ("L1t", "L1"), ("L2t", "L2"), ("BR", "L3")]
BIG = ("TL", "TR", "BR", "BL", "EYE_L", "AL", "AR")
SMALL = ("L0", "L1", "L2", "L3", "L1t", "L2t")
CONST_CENTER = (90.0, 30.0)    # azimuth (deg, 0=+X, 90=+Y), elevation (deg): due north, above the meadow
CONST_DIST = 1800.0
STAR_COL = (0.80, 0.88, 1.0)
EYE_COL = (1.0, 0.70, 0.26)
LINE_COL = (0.50, 0.64, 1.0)

_LAST = {}               # the last constellation built (helpers default to it)


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


def const_world(u, v, origin=(0, 0, 0), center=CONST_CENTER, dist=CONST_DIST):
    """World position of constellation coords (u, v)."""
    return Vector(origin) + const_dir(u, v, center) * dist


def eye_world(C=None):
    """World position of the gold eye (CS_EYE_R)."""
    C = C or _LAST
    if C and C.get("eye"):
        return C["eye"].matrix_world.translation.copy()
    return const_world(*EYE_R)


# ---------------------------------------------------------------- v1 helpers (kept for compatibility)
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
    """Soft glow that fades from the centre of the shape to its silhouette. Brightness/opacity follow `prop`."""
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


# ---------------------------------------------------------------- shared controls (one keyframe drives the figure)
def ctrl_group(lines=1.0, bright=1.0, glow=1.0):
    """Node group 'CS_Ctrl' (outputs Bright, Line, Glow, Time) instanced by every constellation material."""
    g = bpy.data.node_groups.get("CS_Ctrl")
    if g:
        return g
    g = bpy.data.node_groups.new("CS_Ctrl", "ShaderNodeTree")
    out = g.nodes.new("NodeGroupOutput")
    for k, v in (("Bright", bright), ("Line", lines), ("Glow", glow), ("Time", 0.0)):
        g.interface.new_socket(k, in_out="OUTPUT", socket_type="NodeSocketFloat")
        n = g.nodes.new("ShaderNodeValue")
        n.name = n.label = k
        n.outputs[0].default_value = v
        g.links.new(n.outputs[0], out.inputs[k])
    fc = g.nodes["Time"].outputs[0].driver_add("default_value")
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = "frame/24"
    return g


def _ctrl(nb):
    n = nb.n("ShaderNodeGroup")
    n.node_tree = ctrl_group()
    return n


def _key_ctrl(name, value, frame, interp=None):
    g = ctrl_group()
    s = g.nodes[name].outputs[0]
    s.default_value = value
    if frame is not None:
        s.keyframe_insert("default_value", frame=frame)
        if interp and g.animation_data and g.animation_data.action:
            _set_interp(g.animation_data.action, f'nodes["{name}"]', frame, interp)


def _set_interp(action, path_prefix, frame, interp):
    for fc in _fcurves(action):
        if fc.data_path.startswith(path_prefix):
            for kp in fc.keyframe_points:
                if abs(kp.co.x - frame) < 0.5:
                    kp.interpolation = interp


def _fcurves(action):
    """Every F-curve of an action (Blender 5 layered actions or legacy)."""
    if hasattr(action, "fcurves") and action.fcurves is not None:
        try:
            return list(action.fcurves)
        except Exception:
            pass
    out = []
    for layer in getattr(action, "layers", []):
        for strip in layer.strips:
            for cb in getattr(strip, "channelbags", []):
                out += list(cb.fcurves)
    return out


def key_lines(value, frame=None, interp=None):
    """Chart-line visibility for the whole figure (0 hidden, ~0.5 faint, 1 normal, 2-3 flaring)."""
    _key_ctrl("Line", value, frame, interp)


def key_bright(value, frame=None, interp=None):
    """Brightness multiplier of every constellation star (the eye too)."""
    _key_ctrl("Bright", value, frame, interp)


def key_glow(value, frame=None, interp=None):
    """Halo + sparkle size multiplier of every constellation star."""
    _key_ctrl("Glow", value, frame, interp)


# ---------------------------------------------------------------- painted star sprite
def _sprite_frame(nb):
    """Screen-aligned sprite coordinates on a sphere: q = 0 at the centre .. 1 at the silhouette (as seen from the
    camera), x/y along screen right/up. Returns (q, x, y)."""
    g = nb.n("ShaderNodeNewGeometry")
    oi = nb.n("ShaderNodeObjectInfo")
    v = nb.vmath("SUBTRACT", g.outputs["Position"], oi.outputs["Location"])
    I = g.outputs["Incoming"]
    vn = nb.math("MAXIMUM", nb.vmath("LENGTH", v), 1e-6)
    m = nb.n("ShaderNodeVectorMath", operation="SCALE")
    nb.inp(m, 0, I)
    nb.inp(m, "Scale", nb.vmath("DOT_PRODUCT", v, I))
    vp = nb.vmath("SUBTRACT", v, m.outputs[0])
    q = nb.math("DIVIDE", nb.vmath("LENGTH", vp), vn)
    zup = nb.n("ShaderNodeCombineXYZ", inputs={"X": 0.0, "Y": 0.0, "Z": 1.0}).outputs[0]
    right = nb.vmath("NORMALIZE", nb.vmath("CROSS_PRODUCT", I, zup))
    up = nb.vmath("CROSS_PRODUCT", right, I)
    x = nb.math("DIVIDE", nb.vmath("DOT_PRODUCT", vp, right), vn)
    y = nb.math("DIVIDE", nb.vmath("DOT_PRODUCT", vp, up), vn)
    return q, x, y, oi


def _mr(nb, v, a, b, c=0.0, d=1.0):
    """Map range (smoothstep, clamped) whose bounds may be sockets."""
    m = nb.n("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", clamp=True)
    nb.inp(m, "Value", v)
    nb.inp(m, "From Min", a)
    nb.inp(m, "From Max", b)
    nb.inp(m, "To Min", c)
    nb.inp(m, "To Max", d)
    return m.outputs["Result"]


def _gauss(nb, x, w):
    q = nb.math("DIVIDE", x, w)
    return nb.math("EXPONENT", nb.mul(nb.mul(q, q), -1.0))


def _additive(nb, col, strength, out):
    em = nb.n("ShaderNodeEmission")
    nb.inp(em, "Color", col)
    nb.inp(em, "Strength", strength)
    tr = nb.n("ShaderNodeBsdfTransparent")
    add = nb.n("ShaderNodeAddShader")
    nb.link(tr.outputs[0], add.inputs[0])
    nb.link(em.outputs[0], add.inputs[1])
    nb.link(add.outputs[0], out.inputs["Surface"])


def sprite_mat(name, color, prop="bright", *, gain=1.0, core=0.07, halo=0.26, halo_amt=0.45, spikes=0.85,
               spike_w=0.011, hot=(1.0, 0.98, 0.94), twinkle=0.07, ctrl=True, socket=False):
    """A painted star on a sphere (see _sprite_frame). Brightness = obj[prop] (x CS_Ctrl.Bright); sparkle length =
    obj['spike'] (x CS_Ctrl.Glow). socket=True draws the empty eye socket instead (faint ring + darker hollow,
    visible as obj[prop] -> 0, scaled by obj['socket'])."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    q, x, y, oi = _sprite_frame(nb)
    a = nb.n("ShaderNodeAttribute", attribute_name=prop, attribute_type="OBJECT").outputs["Fac"]
    out = nb.n("ShaderNodeOutputMaterial")
    if ctrl:
        cg = _ctrl(nb)
        bright, glow, T = cg.outputs["Bright"], cg.outputs["Glow"], cg.outputs["Time"]
    else:
        bright, glow, T = 1.0, 1.0, None
    if socket:
        empty = nb.mul(nb.math("MAXIMUM", nb.sub(1.0, a), 0.0),
                       nb.n("ShaderNodeAttribute", attribute_name="socket", attribute_type="OBJECT").outputs["Fac"])
        ring = nb.mul(_gauss(nb, nb.sub(q, 0.62), 0.07), nb.mul(empty, 0.55))
        # brushy, broken ring (a chart circle drawn by hand)
        ang = nb.math("ARCTAN2", y, x)
        nz = nb.n("ShaderNodeTexNoise", noise_dimensions="1D", inputs={"Scale": 1.3, "Detail": 3.0})
        nb.inp(nz, "W", nb.add(ang, 3.2))
        ring = nb.mul(ring, nb.mapr(nz.outputs["Fac"], 0.32, 0.52))
        if ctrl:
            ring = nb.mul(ring, nb.math("MINIMUM", nb.add(cg.outputs["Line"], 0.35), 1.6))
        hollow = nb.mul(nb.mapr(q, 0.62, 0.35), nb.mul(empty, 0.55))
        em = nb.n("ShaderNodeEmission", inputs={"Color": (0.004, 0.008, 0.022)})
        tr = nb.n("ShaderNodeBsdfTransparent")
        mx = nb.n("ShaderNodeMixShader")
        nb.inp(mx, "Fac", hollow)
        nb.link(tr.outputs[0], mx.inputs[1])
        nb.link(em.outputs[0], mx.inputs[2])
        em2 = nb.n("ShaderNodeEmission", inputs={"Color": (*LINE_COL, 1.0)})
        nb.inp(em2, "Strength", ring)
        add = nb.n("ShaderNodeAddShader")
        nb.link(mx.outputs[0], add.inputs[0])
        nb.link(em2.outputs[0], add.inputs[1])
        nb.link(add.outputs[0], out.inputs["Surface"])
        m.surface_render_method = "BLENDED"
        m.use_backface_culling = True
        return m
    spk = nb.mul(nb.n("ShaderNodeAttribute", attribute_name="spike", attribute_type="OBJECT").outputs["Fac"], glow)
    c_core = _gauss(nb, q, core)
    hw = nb.mul(halo, nb.math("MAXIMUM", glow, 0.05))
    c_halo = nb.math("MAXIMUM", nb.sub(nb.math("EXPONENT", nb.mul(nb.math("DIVIDE", q, hw), -1.0)),
                                       nb.math("EXPONENT", nb.mul(nb.math("DIVIDE", 1.0, hw), -1.0))), 0.0)
    ax, ay = nb.math("ABSOLUTE", x), nb.math("ABSOLUTE", y)
    sl = nb.math("MAXIMUM", spk, 0.0)
    tail_x = nb.math("POWER", nb.math("MAXIMUM", nb.sub(1.0, nb.math("DIVIDE", ax, nb.math("MAXIMUM", nb.mul(sl, 0.95), 0.01))), 0.0), 3.0)
    tail_y = nb.math("POWER", nb.math("MAXIMUM", nb.sub(1.0, nb.math("DIVIDE", ay, nb.math("MAXIMUM", nb.mul(sl, 0.95), 0.01))), 0.0), 3.0)
    c_spk = nb.add(nb.mul(_gauss(nb, y, spike_w), tail_x), nb.mul(_gauss(nb, x, spike_w), tail_y))
    c_spk = nb.mul(c_spk, nb.mapr(q, 0.97, 0.85))
    inten = nb.add(nb.add(nb.mul(c_core, 7.0), nb.mul(c_halo, halo_amt)), nb.mul(c_spk, spikes))
    if T is not None and twinkle > 0:
        ph = nb.add(nb.mul(T, nb.add(2.3, nb.mul(oi.outputs["Random"], 3.0))), nb.mul(oi.outputs["Random"], 40.0))
        inten = nb.mul(inten, nb.add(1.0, nb.mul(nb.math("SINE", ph), twinkle)))
    inten = nb.mul(nb.mul(nb.mul(inten, a), bright), gain)
    base = nb.n("ShaderNodeRGB")
    base.outputs[0].default_value = (*color, 1)
    hotc = nb.n("ShaderNodeRGB")
    hotc.outputs[0].default_value = (*hot, 1)
    col = nb.mix(nb.math("MINIMUM", nb.mul(c_core, 1.3), 1.0), base.outputs[0], hotc.outputs[0])
    _additive(nb, col, inten, out)
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    return m


def _sprite_obj(name, loc, radius, col, mats, extra_radius=()):
    """Icosphere sprite shell(s) (material index i on shell i) with origin at the star."""
    import bmesh
    bm = bmesh.new()
    counts = []
    for r in (radius,) + tuple(extra_radius):
        n0 = len(bm.faces)
        bmesh.ops.create_icosphere(bm, subdivisions=3, radius=r)
        counts.append(len(bm.faces) - n0)
    bm.faces.ensure_lookup_table()
    i0 = 0
    for k, c in enumerate(counts):
        for f in bm.faces[i0:i0 + c]:
            f.material_index = k
            f.smooth = True
        i0 += c
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    o = bpy.data.objects.new(name, me)
    col.objects.link(o)
    o.location = loc
    o.visible_shadow = False
    o["spike"] = 1.0
    return o


# ---------------------------------------------------------------- brushy chart lines
def line_mat(name="ConstLine2"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    cg = _ctrl(nb)
    u = nb.n("ShaderNodeAttribute", attribute_name="u", attribute_type="GEOMETRY").outputs["Fac"]

    def prop(p):
        return nb.n("ShaderNodeAttribute", attribute_name=p, attribute_type="OBJECT").outputs["Fac"]
    L = nb.math("MAXIMUM", prop("len"), 1.0)
    z = nb.mul(u, L)
    fl = 22.0
    endf = nb.mul(_mr(nb, z, prop("g0"), nb.add(prop("g0"), fl)), _mr(nb, nb.sub(L, z), prop("g1"), nb.add(prop("g1"), fl)))
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    core = nb.math("MAXIMUM", nb.sub(1.0, lw.outputs["Facing"]), 0.0)
    oi = nb.n("ShaderNodeObjectInfo")
    # dry brush along the stroke: pressure varies, the paint runs out in places
    n1 = nb.n("ShaderNodeTexNoise", noise_dimensions="1D", inputs={"Scale": 1.0, "Detail": 4.0, "Roughness": 0.6})
    nb.inp(n1, "W", nb.add(nb.math("DIVIDE", z, 95.0), nb.mul(oi.outputs["Random"], 50.0)))
    n2 = nb.n("ShaderNodeTexNoise", noise_dimensions="1D", inputs={"Scale": 1.0, "Detail": 2.0})
    nb.inp(n2, "W", nb.add(nb.math("DIVIDE", z, 260.0), nb.mul(oi.outputs["Random"], 13.0)))
    press = nb.add(0.35, nb.mul(nb.mapr(n1.outputs["Fac"], 0.3, 0.7), 0.75))
    gaps = nb.mapr(n2.outputs["Fac"], 0.28, 0.38, 0.15, 1.0)
    width = _mr(nb, core, nb.mul(nb.sub(1.0, press), 0.35), 1.0)
    # a crisp painted line plus a soft glow wing around it
    shape = nb.add(nb.math("POWER", width, 7.0), nb.mul(nb.math("POWER", core, 1.6), 0.10))
    inten = nb.mul(nb.mul(nb.mul(shape, press), gaps), endf)
    lv = nb.mul(cg.outputs["Line"], prop("line"))
    inten = nb.mul(nb.mul(inten, lv), 1.5)
    c1 = nb.n("ShaderNodeRGB")
    c1.outputs[0].default_value = (*LINE_COL, 1)
    c2 = nb.n("ShaderNodeRGB")
    c2.outputs[0].default_value = (0.72, 0.62, 1.0, 1)
    col = nb.mix(nb.mapr(n2.outputs["Fac"], 0.35, 0.7), c1.outputs[0], c2.outputs[0])
    gold = nb.n("ShaderNodeRGB")
    gold.outputs[0].default_value = (1.0, 0.72, 0.36, 1)
    col = nb.mix(nb.mapr(cg.outputs["Line"], 1.3, 2.6), col, gold.outputs[0])
    out = nb.n("ShaderNodeOutputMaterial")
    _additive(nb, col, inten, out)
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    return m


def _line_obj(name, pa, pb, radius, col, m, g0, g1, seed=0, segs=14, wobble=0.0035):
    """A hand-drawn chart line from pa to pb: a slim tube with a slight bow and wiggle, attribute u = 0..1 along."""
    rng = np.random.default_rng(seed)
    dv = pb - pa
    L = dv.length
    t_ = dv.normalized()
    mid = (pa + pb) * 0.5
    side = t_.cross(mid.normalized()).normalized()
    bow = rng.normal(0, 1) * wobble * L
    ph = rng.uniform(0, 6.28)
    k = 8
    verts, faces, us = [], [], []
    a0 = t_.orthogonal().normalized()
    a1 = t_.cross(a0).normalized()
    for i in range(segs + 1):
        s = i / segs
        off = side * (bow * math.sin(math.pi * s) + wobble * 0.25 * L * math.sin(ph + s * 9.0) * math.sin(math.pi * s))
        c = pa + dv * s + off
        r = radius * (0.85 + 0.3 * math.sin(ph * 2 + s * 5.0))
        for j in range(k):
            an = 2 * math.pi * j / k
            verts.append(c + (a0 * math.cos(an) + a1 * math.sin(an)) * r)
            us.append(s)
    for i in range(segs):
        for j in range(k):
            j2 = (j + 1) % k
            faces.append((i * k + j, i * k + j2, (i + 1) * k + j2, (i + 1) * k + j))
    o = geo.obj_from(name, [tuple(v) for v in verts], faces, col, m)
    at = o.data.attributes.new("u", "FLOAT", "POINT")
    at.data.foreach_set("value", np.array(us, dtype=float))
    o["len"] = L
    o["g0"], o["g1"] = g0, g1
    o["line"] = 1.0
    o.visible_shadow = False
    return o


# ---------------------------------------------------------------- the constellation
def _rad(deg, dist=CONST_DIST):
    return dist * math.tan(math.radians(deg))


def constellation(center=CONST_CENTER, origin=(0, 0, 0), collection=None, lines=0.0, bright=1.0, eye=0.0):
    """Build the Claude-shaped constellation. Returns dict(stars, lines, eye, eye_dir, ctrl).
    lines: chart-line visibility (sets CS_Ctrl.Line; animate with key_lines). bright: star brightness.
    eye: the gold eye (CS_EYE_R["eye"]: 0 = empty socket .. 1 = shining .. >1 blazing).
    Object props (all animatable): star['bright'], star['spike'], line['line'], CS_EYE_R['eye'], ['socket']."""
    col = collection or geo.coll("Constellation")
    O = Vector(origin)
    g = ctrl_group(lines=lines)
    g.nodes["Line"].outputs[0].default_value = lines
    sm = sprite_mat("ConstStar2", STAR_COL, "bright")
    em = sprite_mat("ConstEye2", EYE_COL, "eye", gain=1.35, core=0.075, halo=0.30, halo_amt=0.7, spikes=1.1,
                    hot=(1.0, 0.95, 0.8), twinkle=0.05)
    skm = sprite_mat("ConstSocket2", LINE_COL, "eye", socket=True)
    lm = line_mat()
    stars = {}
    size = {}
    for k, (u, v) in CONST_STARS.items():
        d = const_dir(u, v, center)
        deg = 1.75 if k in BIG else (1.15 if k in SMALL else 1.4)
        if k == "EYE_L":
            deg = 1.9
        o = _sprite_obj(f"CS_{k}", O + d * CONST_DIST, _rad(deg), col, [sm])
        o["bright"] = bright * (1.0 if k in BIG else 0.62 if k in SMALL else 0.8)
        o["spike"] = 1.0 if k in BIG else 0.55
        stars[k] = o
        size[k] = deg
    ls = []
    for i, (a, b) in enumerate(CONST_LINES):
        pa, pb = stars[a].location, stars[b].location
        gap = lambda k: _rad(0.62 if k in BIG else 0.5)
        ls.append(_line_obj(f"CL_{a}_{b}", pa, pb, _rad(0.17), col, lm, gap(a), gap(b), seed=i))
    de = const_dir(*EYE_R, center)
    eo = _sprite_obj("CS_EYE_R", O + de * CONST_DIST, _rad(2.1), col, [em, skm], extra_radius=(_rad(1.2),))
    eo["eye"] = eye
    eo["socket"] = 1.0
    eo["spike"] = 1.0
    stars["L0t"], stars["L3t"] = stars["BL"], stars["BR"]      # v1 names
    C = dict(stars=stars, lines=ls, eye=eo, eye_dir=de, ctrl=g, center=center, origin=O, collection=col)
    _LAST.clear()
    _LAST.update(C)
    return C


# ---------------------------------------------------------------- story helpers
def _key_prop(o, prop, value, frame, interp=None):
    o[prop] = value
    o.keyframe_insert(f'["{prop}"]', frame=frame)
    if interp:
        ad = o.animation_data
        if ad and ad.action:
            _set_interp(ad.action, f'["{prop}"]', frame, interp)


def twinkle(eye_obj, f0, times, dur=0.42, peak=2.3, spike=2.4, fps=24, prop=None):
    """The star twinkles at each shot-local time in `times` (seconds from f0): a quick swell of brightness with the
    sparkle spikes stretching, then back. eye_obj: CS_EYE_R (keys 'eye') or any star (keys 'bright').
    Example (SH04): props.twinkle(C["eye"], f0, TWINKLES)."""
    prop = prop or ("eye" if "eye" in eye_obj.keys() else "bright")
    base = float(eye_obj.get(prop, 1.0))
    sb = float(eye_obj.get("spike", 1.0))
    for t in times:
        fc = f0 + t * fps
        fa, fb = int(round(fc - dur * fps * 0.35)), int(round(fc + dur * fps * 0.65))
        fp = int(round(fc))
        for f, v, s in ((fa, base, sb), (fp, base * peak, sb * spike), (fp + 2, base * (1 + (peak - 1) * 0.75), sb * (1 + (spike - 1) * 0.8)),
                        (fb, base, sb)):
            _key_prop(eye_obj, prop, v, f)
            _key_prop(eye_obj, "spike", s, f)
    return eye_obj


def flicker(obj, f0, f1, depth=0.65, rate=9.0, seed=1, prop=None):
    """Nervous flicker between frames f0..f1 (SH04 T_FLICKER: the eye about to break loose): brightness dips and
    recovers irregularly, keyed every frame, back to its base value at f1."""
    prop = prop or ("eye" if "eye" in obj.keys() else "bright")
    base = _eval(obj, f'["{prop}"]', f0, float(obj.get(prop, 1.0)))
    rng = np.random.default_rng(seed)
    _key_prop(obj, prop, base, f0)
    for f in range(f0 + 1, f1):
        t = (f - f0) / 24.0
        dip = depth * (0.5 + 0.5 * math.sin(t * rate * 2 * math.pi + rng.uniform(0, 1.5))) * rng.uniform(0.4, 1.0)
        _key_prop(obj, prop, base * (1.0 - dip), f)
    _key_prop(obj, prop, base, f1)
    return obj


def breathe_lines(f0, f1, v0=0.0, v1=0.6, fps=24):
    """Chart lines breathe in (SH01): v0 at f0 -> v1 at f1 with a soft swell. Uses the shared CS_Ctrl.Line."""
    key_lines(v0, f0)
    fm = int(f0 + (f1 - f0) * 0.55)
    key_lines(v0 + (v1 - v0) * 0.8, fm)
    key_lines(v1, f1)


def flicker_lines(f0, f1, base=0.45, amp=0.3, rate=7.0, seed=3):
    """Sad, weak flicker of the chart lines (SH13): keyed every 2 frames on CS_Ctrl.Line."""
    rng = np.random.default_rng(seed)
    for f in range(f0, f1 + 1, 2):
        t = (f - f0) / 24.0
        v = base + amp * (0.5 * math.sin(t * rate * 2 * math.pi * 0.25) + 0.5 * rng.uniform(-1, 1))
        key_lines(max(0.0, v), f)


# ------------------------------------------- the falling (or rising) star streak
def _trail_mats():
    tm = bpy.data.materials.get("FallTrail")
    if tm is None:
        tm = bpy.data.materials.new("FallTrail")
        tm.use_nodes = True
        t = tm.node_tree
        t.nodes.clear()
        nb = mat.NB(t)
        u = nb.n("ShaderNodeAttribute", attribute_name="trail_u", attribute_type="GEOMETRY").outputs["Fac"]
        lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
        core = nb.math("POWER", nb.math("MAXIMUM", nb.sub(1.0, lw.outputs["Facing"]), 0.0), 1.3)
        nz = nb.n("ShaderNodeTexNoise", noise_dimensions="1D", inputs={"Scale": 18.0, "Detail": 3.0})
        nb.inp(nz, "W", u)
        brush = nb.add(0.6, nb.mul(nz.outputs["Fac"], 0.8))
        inten = nb.mul(nb.mul(nb.mul(nb.math("POWER", u, 2.2), core), brush), 10.0)
        a = nb.n("ShaderNodeRGB")
        a.outputs[0].default_value = (1.0, 0.45, 0.10, 1)
        b = nb.n("ShaderNodeRGB")
        b.outputs[0].default_value = (1.0, 0.86, 0.55, 1)
        col = nb.mix(nb.math("POWER", u, 2.0), a.outputs[0], b.outputs[0])
        out = nb.n("ShaderNodeOutputMaterial")
        _additive(nb, col, inten, out)
        tm.surface_render_method = "BLENDED"
    sm = bpy.data.materials.get("FallSparkle")
    if sm is None:
        sm = bpy.data.materials.new("FallSparkle")
        sm.use_nodes = True
        t = sm.node_tree
        t.nodes.clear()
        nb = mat.NB(t)
        lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
        core = nb.math("POWER", nb.math("MAXIMUM", nb.sub(1.0, lw.outputs["Facing"]), 0.0), 2.0)
        c = nb.n("ShaderNodeRGB")
        c.outputs[0].default_value = (1.0, 0.80, 0.42, 1)
        out = nb.n("ShaderNodeOutputMaterial")
        _additive(nb, c.outputs[0], nb.mul(core, 14.0), out)
        sm.surface_render_method = "BLENDED"
    return tm, sm


def _sock(node, ident, out=False):
    for s in (node.outputs if out else node.inputs):
        if s.identifier == ident:
            return s
    raise KeyError(ident)


def _trail_group():
    ng = bpy.data.node_groups.get("FallTrailGN")
    if ng:
        return ng
    tm, sm = _trail_mats()
    ng = bpy.data.node_groups.new("FallTrailGN", "GeometryNodeTree")
    ng.is_modifier = True
    it = ng.interface
    it.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    for nm, typ in (("Start", "NodeSocketFloat"), ("End", "NodeSocketFloat"), ("Seed", "NodeSocketInt"),
                    ("Sparkle", "NodeSocketFloat"), ("Width", "NodeSocketFloat")):
        it.new_socket(nm, in_out="INPUT", socket_type=typ)
    it.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    N, Lk = ng.nodes, ng.links
    gi = N.new("NodeGroupInput")
    go = N.new("NodeGroupOutput")

    def math_(op, a, b=None):
        m = N.new("ShaderNodeMath")
        m.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, bpy.types.NodeSocket):
                Lk.new(v, m.inputs[i])
            else:
                m.inputs[i].default_value = v
        return m.outputs[0]

    trim = N.new("GeometryNodeTrimCurve")
    trim.mode = "FACTOR"
    Lk.new(gi.outputs["Geometry"], trim.inputs["Curve"])
    Lk.new(gi.outputs["Start"], _sock(trim, "Start"))
    Lk.new(gi.outputs["End"], _sock(trim, "End"))
    sp = N.new("GeometryNodeSplineParameter")
    st = N.new("GeometryNodeStoreNamedAttribute")
    st.data_type = "FLOAT"
    st.domain = "POINT"
    st.inputs["Name"].default_value = "trail_u"
    Lk.new(trim.outputs[0], st.inputs["Geometry"])
    Lk.new(sp.outputs["Factor"], st.inputs["Value"])
    rad = N.new("GeometryNodeInputRadius")
    taper = math_("ADD", math_("MULTIPLY", math_("POWER", sp.outputs["Factor"], 0.75), 0.88), 0.12)
    scl = math_("MULTIPLY", math_("MULTIPLY", rad.outputs[0], taper), gi.outputs["Width"])
    circ = N.new("GeometryNodeCurvePrimitiveCircle")
    circ.inputs["Resolution"].default_value = 8
    circ.inputs["Radius"].default_value = 1.0
    c2m = N.new("GeometryNodeCurveToMesh")
    Lk.new(st.outputs[0], c2m.inputs["Curve"])
    Lk.new(circ.outputs["Curve"], c2m.inputs["Profile Curve"])
    Lk.new(scl, c2m.inputs["Scale"])
    m1 = N.new("GeometryNodeSetMaterial")
    m1.inputs["Material"].default_value = tm
    Lk.new(c2m.outputs[0], m1.inputs["Geometry"])
    # sparkles shed along the trail: they drift out and sink as they age
    c2p = N.new("GeometryNodeCurveToPoints")
    c2p.mode = "COUNT"
    c2p.inputs["Count"].default_value = 110
    Lk.new(st.outputs[0], c2p.inputs["Curve"])
    na = N.new("GeometryNodeInputNamedAttribute")
    na.data_type = "FLOAT"
    na.inputs["Name"].default_value = "trail_u"
    age = math_("SUBTRACT", 1.0, na.outputs["Attribute"])
    rv = N.new("FunctionNodeRandomValue")
    rv.data_type = "FLOAT_VECTOR"
    _sock(rv, "Min").default_value = (-1, -1, -1)
    _sock(rv, "Max").default_value = (1, 1, 1)
    Lk.new(gi.outputs["Seed"], _sock(rv, "Seed"))
    spread = math_("MULTIPLY", rad.outputs[0], math_("ADD", 1.5, math_("MULTIPLY", age, 9.0)))
    vs = N.new("ShaderNodeVectorMath")
    vs.operation = "SCALE"
    Lk.new(_sock(rv, "Value", out=True), vs.inputs[0])
    Lk.new(spread, vs.inputs["Scale"])
    sink = N.new("ShaderNodeCombineXYZ")
    Lk.new(math_("MULTIPLY", math_("MULTIPLY", age, rad.outputs[0]), -4.0), sink.inputs["Z"])
    va = N.new("ShaderNodeVectorMath")
    va.operation = "ADD"
    Lk.new(vs.outputs[0], va.inputs[0])
    Lk.new(sink.outputs[0], va.inputs[1])
    setp = N.new("GeometryNodeSetPosition")
    Lk.new(c2p.outputs["Points"], setp.inputs["Geometry"])
    Lk.new(va.outputs[0], setp.inputs["Offset"])
    rs = N.new("FunctionNodeRandomValue")
    rs.data_type = "FLOAT"
    _sock(rs, "Min_001").default_value = 0.15
    _sock(rs, "Max_001").default_value = 1.0
    sd2 = math_("ADD", gi.outputs["Seed"], 17.0)
    Lk.new(sd2, _sock(rs, "Seed"))
    keep = N.new("FunctionNodeRandomValue")
    keep.data_type = "BOOLEAN"
    _sock(keep, "Probability").default_value = 0.55
    Lk.new(math_("ADD", gi.outputs["Seed"], 5.0), _sock(keep, "Seed"))
    ico = N.new("GeometryNodeMeshIcoSphere")
    ico.inputs["Radius"].default_value = 1.0
    ico.inputs["Subdivisions"].default_value = 1
    iop = N.new("GeometryNodeInstanceOnPoints")
    Lk.new(setp.outputs[0], iop.inputs["Points"])
    Lk.new(_sock(keep, "Value_003", out=True), iop.inputs["Selection"])
    Lk.new(ico.outputs["Mesh"], iop.inputs["Instance"])
    isc = math_("MULTIPLY", math_("MULTIPLY", math_("MULTIPLY", rad.outputs[0], _sock(rs, "Value_001", out=True)),
                                  gi.outputs["Sparkle"]), math_("ADD", 0.22, math_("MULTIPLY", na.outputs["Attribute"], 0.38)))
    Lk.new(isc, iop.inputs["Scale"])
    real = N.new("GeometryNodeRealizeInstances")
    Lk.new(iop.outputs[0], real.inputs[0])
    m2 = N.new("GeometryNodeSetMaterial")
    m2.inputs["Material"].default_value = sm
    Lk.new(real.outputs[0], m2.inputs["Geometry"])
    j = N.new("GeometryNodeJoinGeometry")
    Lk.new(m2.outputs[0], j.inputs[0])
    Lk.new(m1.outputs[0], j.inputs[0])
    Lk.new(j.outputs[0], go.inputs[0])
    return ng


def _mod_key(mod, name, value, frame, const=False):
    ident = None
    for it in mod.node_group.interface.items_tree:
        if getattr(it, "in_out", None) == "INPUT" and it.name == name:
            ident = it.identifier
    mod[ident] = value
    mod.id_data.keyframe_insert(f'modifiers["{mod.name}"]["{ident}"]', frame=frame)
    if const:
        ad = mod.id_data.animation_data
        _set_interp(ad.action, f'modifiers["{mod.name}"]["{ident}"]', frame, "CONSTANT")


def falling_star(start_world=None, end_world=None, f0=0, f1=40, view_from=None, bow=0.22, ease=1.9,
                 trail=0.38, head_deg=3.0, trail_deg=0.15, head_min=0.6, sparkle=1.0, drain=7, flash=1.0,
                 take_eye=True, collection=None, name="FallStreak", fps=24):
    """A curving, sparkling streak with a glowing trail from start_world to end_world over frames [f0, f1].

    start_world: default the gold eye (CS_EYE_R) of the last constellation. end_world: default layout.CRATER on the
    ground. The path is designed as seen from `view_from` (default: the scene camera at f0, else Claude's eye at
    the north gallery): it sweeps across the sky on a bowed arc at an accelerating pace (ease > 1) while its
    distance closes geometrically, so the head and trail keep a steady painted size on screen (head_deg, trail_deg)
    until it lands. trail: trail length as a fraction of the path. After f1 the trail drains into the impact point
    over `drain` frames; flash > 0 adds a gold impact light at end_world. take_eye: CS_EYE_R['eye'] goes 1 -> 0 at f0
    (the eye leaves the constellation). Reverse use (SH17): start=Claude's raised arms, end=props.eye_world(),
    take_eye=False, flash=0, then props.ignite(f1).
    Returns dict(head, trail, light, flash, pos(t_local_seconds) -> Vector)."""
    from . import layout
    col = collection or geo.coll("FallStreak")
    sc = bpy.context.scene
    if start_world is None:
        start_world = eye_world()
    if end_world is None:
        try:
            from . import terrain
            gz = float(terrain.height(*layout.CRATER))
        except Exception:
            gz = 0.7
        end_world = Vector((layout.CRATER[0], layout.CRATER[1], gz + 0.25))
    S, E = Vector(start_world), Vector(end_world)
    if view_from is None:
        if sc.camera is not None:
            sc.frame_set(f0)
            view_from = sc.camera.matrix_world.translation.copy()
        else:
            view_from = Vector((layout.GALLERY_N[0], layout.GALLERY_N[1], 5.7))
    V = Vector(view_from)
    s, e = S - V, E - V
    d0, d1 = s.normalized(), e.normalized()
    L0, L1 = max(s.length, 0.05), max(e.length, 0.05)
    ang = d0.angle(d1)
    axis = d0.cross(d1)
    axis = axis.normalized() if axis.length > 1e-6 else d0.orthogonal().normalized()

    def path(u):
        dirv = (Quaternion(axis, ang * u) @ d0)
        dirv = (dirv + axis * (bow * math.sin(math.pi * u))).normalized()
        dist = math.exp(math.log(L0) * (1 - u) + math.log(L1) * u)
        return V + dirv * dist, dist

    # static path curve (radius ~ distance so the trail keeps its painted width on screen)
    n = 360
    pts = [path(i / (n - 1)) for i in range(n)]
    cum = [0.0]
    for i in range(1, n):
        cum.append(cum[-1] + (pts[i][0] - pts[i - 1][0]).length)
    total = cum[-1]

    def fac(u):
        x = u * (n - 1)
        i = min(int(x), n - 2)
        w = x - i
        return (cum[i] * (1 - w) + cum[i + 1] * w) / total

    cu = bpy.data.curves.new(name + "_curve", "CURVE")
    cu.dimensions = "3D"
    spl = cu.splines.new("POLY")
    spl.points.add(n - 1)
    tw = math.tan(math.radians(trail_deg))
    for i, (p, dist) in enumerate(pts):
        spl.points[i].co = (p.x, p.y, p.z, 1.0)
        spl.points[i].radius = max(tw * dist, 0.035)
    tr = bpy.data.objects.new(name + "_trail", cu)
    col.objects.link(tr)
    tr.visible_shadow = False
    mod = tr.modifiers.new("trail", "NODES")
    mod.node_group = _trail_group()
    tm, sm = _trail_mats()
    cu.materials.append(tm)
    cu.materials.append(sm)

    # head: a gold painted star sprite (+ a light that warms the meadow as it nears)
    hm = sprite_mat("FallHead", (1.0, 0.64, 0.22), "glow", gain=1.7, core=0.075, halo=0.28, halo_amt=1.3,
                    spikes=1.0, hot=(1.0, 0.96, 0.82), twinkle=0.0, ctrl=False)
    head = _sprite_obj(name + "_head", S, 1.0, col, [hm])
    head["glow"] = 0.0
    head["spike"] = 1.0
    ld = bpy.data.lights.new(name + "_light", "POINT")
    ld.color = (1.0, 0.62, 0.25)
    ld.shadow_soft_size = 0.2
    ld.use_shadow = False
    lo = bpy.data.objects.new(name + "_light", ld)
    col.objects.link(lo)
    hd = math.tan(math.radians(head_deg))

    def u_of(fr):
        t = min(max((fr - f0) / max(f1 - f0, 1), 0.0), 1.0)
        return t ** ease

    seed = 0
    for fr in range(f0 - 1, f1 + drain + 2):
        if fr < f0:
            uh, ut, on = 0.0, 0.0, 0.0
        elif fr <= f1:
            uh = u_of(fr)
            ut = max(uh - trail, 0.0)
            on = 1.0
        else:
            k = min((fr - f1) / max(drain, 1), 1.0)
            uh = 1.0
            ut = (1.0 - trail) + trail * k ** 0.7
            on = 1.0 - k
        p, dist = path(uh)
        _mod_key(mod, "Start", fac(ut), fr)
        _mod_key(mod, "End", fac(uh), fr)
        _mod_key(mod, "Width", 1.0 if fr >= f0 else 0.0, fr)
        _mod_key(mod, "Sparkle", sparkle * on, fr)
        seed += 1
        _mod_key(mod, "Seed", seed, fr, const=True)
        alive = f0 <= fr <= f1
        head.location = p
        r = max(hd * dist, head_min)
        head.scale = (r, r, r) if alive else (1e-4, 1e-4, 1e-4)
        head["glow"] = (1.0 + 0.25 * math.sin(fr * 1.7)) if alive else 0.0
        head.keyframe_insert("location", frame=fr)
        head.keyframe_insert("scale", frame=fr)
        head.keyframe_insert('["glow"]', frame=fr)
        lo.location = p
        near = min(max((40.0 - dist) / 38.0, 0.0), 1.0)
        ld.energy = (900.0 * near ** 2) if alive else 0.0
        lo.keyframe_insert("location", frame=fr)
        ld.keyframe_insert("energy", frame=fr)
    fl = None
    if flash > 0:
        fd = bpy.data.lights.new(name + "_flash", "POINT")
        fd.color = (1.0, 0.82, 0.55)
        fd.shadow_soft_size = 0.4
        fd.use_shadow = True
        fl = bpy.data.objects.new(name + "_flash", fd)
        col.objects.link(fl)
        fl.location = E + Vector((0, 0, 0.45))
        for fr, en in ((f1 - 1, 0.0), (f1, 2600.0 * flash), (f1 + 2, 1800.0 * flash), (f1 + 8, 450.0 * flash),
                       (f1 + 20, 60.0 * flash), (f1 + 36, 0.0)):
            fd.energy = en
            fd.keyframe_insert("energy", frame=fr)
    if take_eye and _LAST.get("eye") is not None:
        eo = _LAST["eye"]
        _key_prop(eo, "eye", _eval(eo, '["eye"]', f0 - 1, float(eo.get("eye", 1.0))), f0 - 1)
        _key_prop(eo, "eye", 0.0, f0 + 2)

    def pos(t):
        return path(u_of(f0 + t * fps))[0]
    return dict(head=head, trail=tr, light=lo, flash=fl, pos=pos, modifier=mod)


# ------------------------------------------- ignition
def _burst_mat():
    m = bpy.data.materials.get("IgniteBurst")
    if m:
        return m
    m = bpy.data.materials.new("IgniteBurst")
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    q, x, y, oi = _sprite_frame(nb)

    def prop(p):
        return nb.n("ShaderNodeAttribute", attribute_name=p, attribute_type="OBJECT").outputs["Fac"]
    burst, spread, spin = prop("burst"), prop("spread"), prop("spin")
    ang = nb.add(nb.math("ARCTAN2", y, x), spin)
    cv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(cv, "X", nb.math("COSINE", ang))
    nb.inp(cv, "Y", nb.math("SINE", ang))
    n1 = nb.n("ShaderNodeTexNoise", inputs={"Scale": 4.2, "Detail": 2.0, "Roughness": 0.5})
    nb.link(cv.outputs[0], n1.inputs["Vector"])
    n2 = nb.n("ShaderNodeTexNoise", inputs={"Scale": 9.0, "Detail": 1.0})
    nb.link(cv.outputs[0], n2.inputs["Vector"])
    rays = nb.math("POWER", nb.mapr(n1.outputs["Fac"], 0.42, 0.72), 2.2)
    rays = nb.add(rays, nb.mul(nb.math("POWER", nb.mapr(n2.outputs["Fac"], 0.5, 0.75), 3.0), 0.6))
    rlen = nb.mul(nb.math("MAXIMUM", spread, 0.01), nb.add(0.30, nb.mul(n2.outputs["Fac"], 0.9)))
    ray_i = nb.mul(rays, nb.math("EXPONENT", nb.mul(nb.math("DIVIDE", q, rlen), -2.2)))
    ring = nb.mul(_gauss(nb, nb.sub(q, nb.mul(spread, 0.85)), 0.035), nb.sub(1.0, nb.math("MINIMUM", spread, 1.0)))
    core = _gauss(nb, q, 0.04)
    inten = nb.add(nb.add(nb.mul(ray_i, 2.2), nb.mul(ring, 1.2)), nb.mul(core, 4.0))
    inten = nb.mul(nb.mul(inten, burst), nb.mapr(q, 1.0, 0.8))
    a = nb.n("ShaderNodeRGB")
    a.outputs[0].default_value = (1.0, 0.62, 0.22, 1)
    b = nb.n("ShaderNodeRGB")
    b.outputs[0].default_value = (1.0, 0.93, 0.75, 1)
    pk = nb.n("ShaderNodeRGB")
    pk.outputs[0].default_value = (1.0, 0.45, 0.62, 1)
    col = nb.mix(nb.math("MINIMUM", nb.mul(core, 1.5), 1.0), a.outputs[0], b.outputs[0])
    col = nb.mix(nb.mul(ring, 0.6), col, pk.outputs[0])
    out = nb.n("ShaderNodeOutputMaterial")
    _additive(nb, col, inten, out)
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    return m


def ignite(f_ignite, C=None, burst=1.0, rays=True, line_peak=3.0, line_after=1.15, eye_peak=5.0, eye_after=1.3,
           bright_peak=1.9, bright_after=1.15, sky=1.0, sky_after=0.3, flood=1.0, fps=24, collection=None):
    """IGNITION (SH17): the eye blazes, a gold burst of rays and a ring bloom out of it, the chart lines flare gold,
    every star flares, the sky round the constellation glows violet/pink (sky.key_ignite) and a gold wash floods the
    scene. Everything settles into the whole, shining constellation (…_after values). Call after constellation().
    Returns dict(burst, flood)."""
    from . import sky as SKY
    C = C or _LAST
    f = int(f_ignite)
    eo = C["eye"]
    e_prev = _eval(eo, '["eye"]', f - 1, float(eo.get("eye", 0.0)))
    _key_prop(eo, "eye", e_prev, f - 1)
    _key_prop(eo, "eye", eye_peak, f + 2)
    _key_prop(eo, "eye", eye_peak * 0.55, f + 12)
    _key_prop(eo, "eye", eye_after, f + 40)
    _key_prop(eo, "spike", 1.0, f - 1)
    _key_prop(eo, "spike", 3.2, f + 3)
    _key_prop(eo, "spike", 1.3, f + 40)
    key_lines(_cur("Line", f - 1), f - 1)
    key_lines(line_peak, f + 4)
    key_lines(line_after, f + 48)
    key_bright(_cur("Bright", f - 1), f - 1)
    key_bright(bright_peak, f + 5)
    key_bright(bright_after, f + 44)
    key_glow(_cur("Glow", f - 1), f - 1)
    key_glow(1.6, f + 5)
    key_glow(1.0, f + 44)
    if sky > 0:
        SKY.key_ignite(0.0, f - 1)
        SKY.key_ignite(1.0 * sky, f + 3)
        SKY.key_ignite(sky_after * sky, f + 60)
    bo = None
    if rays:
        col = collection or C.get("collection") or geo.coll("Constellation")
        bo = _sprite_obj("CS_IgniteBurst", eo.matrix_world.translation.copy(), _rad(24.0), col, [_burst_mat()])
        for fr, b, s, sp in ((f - 1, 0.0, 0.05, 0.0), (f, 0.2 * burst, 0.08, 0.0), (f + 3, 1.0 * burst, 0.35, 0.05),
                             (f + 14, 0.75 * burst, 0.75, 0.25), (f + 34, 0.25 * burst, 1.0, 0.5), (f + 60, 0.0, 1.1, 0.7)):
            bo["burst"], bo["spread"], bo["spin"] = b, s, sp
            for p in ("burst", "spread", "spin"):
                bo.keyframe_insert(f'["{p}"]', frame=fr)
    fo = None
    if flood > 0:
        ld = bpy.data.lights.new("IgniteFlood", "SUN")
        ld.color = (1.0, 0.70, 0.36)
        ld.use_shadow = False
        ld.angle = math.radians(8)
        fo = bpy.data.objects.new("IgniteFlood", ld)
        bpy.context.scene.collection.objects.link(fo)
        dv = C["eye_dir"]
        fo.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
        for fr, en in ((f - 1, 0.0), (f + 3, 3.2 * flood), (f + 16, 1.4 * flood), (f + 60, 0.35 * flood)):
            ld.energy = en
            ld.keyframe_insert("energy", frame=fr)
    return dict(burst=bo, flood=fo)


def _eval(id_data, path, frame, default):
    ad = getattr(id_data, "animation_data", None)
    if ad and ad.action:
        for fc in _fcurves(ad.action):
            if fc.data_path == path:
                return fc.evaluate(frame)
    return default


def _cur(name, frame=None):
    g = ctrl_group()
    v = g.nodes[name].outputs[0].default_value
    return v if frame is None else _eval(g, f'nodes["{name}"].outputs[0].default_value', frame, v)


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
