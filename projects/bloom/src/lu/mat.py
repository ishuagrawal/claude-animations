"""Painterly NPR materials for EEVEE (Wild Robot look).

Principles reproduced (from DreamWorks' talks on The Wild Robot):
  * Non-physical shading: the light term is captured with Shader-to-RGB and re-painted.
  * The terminator is broken up by brush strokes (not a smooth CG falloff).
  * High-frequency brush texture shows only in the key light; shadow side is simplified/flat.
  * Brushed, partially transparent edges on organic things (foliage, clouds, rocks).
  * Specular highlights become brush-shaped dabs.

Scene-wide look parameters (shadow tint, ambient keep, etc.) live in a shared node group
"LU_Look" so a whole act can be re-graded by changing a few values.
"""
import bpy

from . import tex as T

_TEX = None


def textures():
    global _TEX
    if _TEX is None:
        _TEX = T.ensure_all()
    return _TEX


def image(name, colorspace="Non-Color"):
    path = textures()[name]
    img = bpy.data.images.get(name)
    if img is None:
        img = bpy.data.images.load(path)
        img.name = name
        img.colorspace_settings.name = colorspace
    return img


# ---------------------------------------------------------------- node DSL
class NB:
    """Tiny helper to build node trees in code: nb.n('ShaderNodeMath', operation='ADD', inputs=...)"""

    def __init__(self, tree):
        self.t = tree
        self.nodes = tree.nodes
        self.links = tree.links
        self.x = 0

    def n(self, kind, inputs=None, **props):
        node = self.nodes.new(kind)
        node.location = (self.x, 0)
        self.x += 40
        for k, v in props.items():
            setattr(node, k, v)
        if inputs:
            for key, val in inputs.items():
                self.inp(node, key, val)
        return node

    def inp(self, node, key, val):
        sock = node.inputs[key]
        if isinstance(val, bpy.types.NodeSocket):
            self.links.new(val, sock)
        elif isinstance(val, bpy.types.Node):
            self.links.new(val.outputs[0], sock)
        else:
            if hasattr(sock, "default_value"):
                if isinstance(val, (int, float)) and hasattr(sock.default_value, "__len__"):
                    val = [val] * len(sock.default_value)
                elif isinstance(val, (tuple, list)) and len(val) == 3 and len(sock.default_value) == 4:
                    val = (*val, 1.0)
                sock.default_value = val

    def link(self, a, b):
        self.links.new(a, b)

    # math shorthands
    def math(self, op, a, b=0.0, clamp=False):
        m = self.n("ShaderNodeMath", operation=op, use_clamp=clamp)
        self.inp(m, 0, a)
        if len(m.inputs) > 1:
            self.inp(m, 1, b)
        return m.outputs[0]

    def mul(self, a, b): return self.math("MULTIPLY", a, b)
    def add(self, a, b): return self.math("ADD", a, b)
    def sub(self, a, b): return self.math("SUBTRACT", a, b)

    def mapr(self, v, a, b, c=0.0, d=1.0, interp="SMOOTHSTEP", clamp=True):
        m = self.n("ShaderNodeMapRange", interpolation_type=interp, clamp=clamp)
        self.inp(m, "Value", v)
        m.inputs["From Min"].default_value = a
        m.inputs["From Max"].default_value = b
        m.inputs["To Min"].default_value = c
        m.inputs["To Max"].default_value = d
        return m.outputs["Result"]

    def mix(self, fac, a, b, blend="MIX"):
        m = self.n("ShaderNodeMix", data_type="RGBA", blend_type=blend)
        self.inp(m, "Factor", fac)
        self.inp(m, 6, a)
        self.inp(m, 7, b)
        return m.outputs[2]

    def vmath(self, op, a, b=None):
        m = self.n("ShaderNodeVectorMath", operation=op)
        self.inp(m, 0, a)
        if b is not None:
            self.inp(m, 1, b)
        return m.outputs[0] if op not in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else m.outputs["Value"]

    def bw(self, c):
        return self.n("ShaderNodeRGBToBW", inputs={"Color": c}).outputs[0]


# ---------------------------------------------------------------- shared look group
LOOK_DEFAULTS = {
    "ShadowTint": (0.30, 0.34, 0.52),   # cool violet-teal shadow side
    "ShadowKeep": 0.30,                 # how much real lighting variation survives in shadow
    "TermLo": 0.08,                     # terminator ramp (irradiance luminance)
    "TermHi": 0.30,
    "Breakup": 0.55,                    # brush breakup of the terminator
    "LitTex": 0.55,                     # brush texture strength on lit side
    "Sat": 1.12,                        # painterly saturation boost
    "SkyFill": (0.05, 0.08, 0.13),      # cool sky light on up-facing shadow sides
    "Bounce": (0.035, 0.03, 0.02),      # warm ground bounce on down-facing shadow sides
    "FrontFill": (0.10, 0.09, 0.11),    # soft camera-side fill (characters only, scaled per material)
    "Snow": 0.0,                        # season: snow on up-facing surfaces (0..1)
    "Autumn": 0.0,                      # season: foliage turns gold/red (foliage materials only)
}


def look_group():
    g = bpy.data.node_groups.get("LU_Look")
    if g:
        return g
    g = bpy.data.node_groups.new("LU_Look", "ShaderNodeTree")
    out = g.nodes.new("NodeGroupOutput")
    for k, v in LOOK_DEFAULTS.items():
        if isinstance(v, tuple):
            s = g.interface.new_socket(k, in_out="OUTPUT", socket_type="NodeSocketColor")
            node = g.nodes.new("ShaderNodeRGB")
            node.outputs[0].default_value = (*v, 1)
        else:
            s = g.interface.new_socket(k, in_out="OUTPUT", socket_type="NodeSocketFloat")
            node = g.nodes.new("ShaderNodeValue")
            node.outputs[0].default_value = v
        node.name = k
        node.label = k
        g.links.new(node.outputs[0], out.inputs[k])
    return g


def set_look(**kw):
    """Re-grade every painterly material at once (call per shot/act)."""
    g = look_group()
    for k, v in kw.items():
        node = g.nodes[k]
        if isinstance(v, (tuple, list)):
            node.outputs[0].default_value = (*v[:3], 1)
        else:
            node.outputs[0].default_value = v


# ---------------------------------------------------------------- texture sampling
def tex_node(nb, name, coord, scale=1.0, proj="BOX", blend=0.35, colorspace="Non-Color"):
    mp = nb.n("ShaderNodeMapping")
    nb.inp(mp, "Vector", coord)
    mp.inputs["Scale"].default_value = (scale, scale, scale)
    t = nb.n("ShaderNodeTexImage", image=image(name, colorspace), projection=proj, interpolation="Cubic")
    if proj == "BOX":
        t.projection_blend = blend
    nb.link(mp.outputs[0], t.inputs["Vector"])
    return t


# ---------------------------------------------------------------- the painterly material
def painterly(name, color, *, shadow=None, stroke="strokes_fine", scale=1.0, coord="Object",
              tex_amt=1.0, hue_jit=0.04, bump=0.25, breakup=1.0, rough=0.6, spec=0.0, spec_col=(1, 0.95, 0.85),
              rim=0.0, rim_col=(1.0, 0.85, 0.6), edge_break=0.0, edge_soft=0.25, emission=None, emit_str=0.0,
              color2=None, color2_mask=None, c2_thresh=(0.5, 0.62), c2_scale=0.35, albedo_fn=None, vcol=None, alpha_tex=None, translucent=0.0, ao=0.0,
              wrap=0.0, backface=True, front_fill=0.0, foliage=False, snow=1.0):
    """Build a painterly EEVEE material.

    color: base albedo (linear RGB). shadow: optional per-material shadow tint (else LU_Look).
    stroke: brush texture name. coord: 'Object'|'Generated'|'UV'. edge_break: 0..1 brushed silhouette.
    color2/color2_mask: second paint color mixed by a stroke-mask (e.g. moss on stone).
    vcol: name of a color attribute multiplied into albedo (per-instance tint).
    wrap: wrap lighting (soft materials like clouds, foliage).
    """
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = NB(t)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = look_group()

    if coord == "rest":
        co = nb.n("ShaderNodeAttribute", attribute_name="rest", attribute_type="GEOMETRY").outputs["Vector"]
    else:
        tc = nb.n("ShaderNodeTexCoord")
        co = tc.outputs[coord]
    st = tex_node(nb, stroke, co, scale)
    sv = st.outputs["Color"]
    sep = nb.n("ShaderNodeSeparateColor", inputs={"Color": sv})
    s_val, s_jit, s_h = sep.outputs[0], sep.outputs[1], sep.outputs[2]

    # albedo with per-stroke hue/value jitter (painted, not flat)
    alb = nb.n("ShaderNodeRGB")
    alb.outputs[0].default_value = (*color, 1)
    albedo = alb.outputs[0] if albedo_fn is None else albedo_fn(nb, co)
    if color2 is not None:
        c2 = nb.n("ShaderNodeRGB")
        c2.outputs[0].default_value = (*color2, 1)
        if color2_mask is None:
            mk = tex_node(nb, "sponge", co, scale * c2_scale)
            mask = nb.mapr(nb.add(nb.n("ShaderNodeSeparateColor", inputs={"Color": mk.outputs["Color"]}).outputs[2],
                                  nb.mul(nb.sub(s_val, 0.5), 0.25)), c2_thresh[0], c2_thresh[1])
        else:
            mask = color2_mask(nb, co)
        albedo = nb.mix(mask, albedo, c2.outputs[0])
    if vcol:
        va = nb.n("ShaderNodeAttribute", attribute_name=vcol, attribute_type="GEOMETRY")
        albedo = nb.mix(1.0, albedo, va.outputs["Color"], blend="MULTIPLY")
    hsv = nb.n("ShaderNodeHueSaturation")
    nb.inp(hsv, "Color", albedo)
    nb.inp(hsv, "Hue", nb.add(nb.mul(nb.sub(s_jit, 0.5), hue_jit), 0.5))
    nb.inp(hsv, "Value", nb.add(nb.mul(nb.sub(s_val, 0.5), 0.35 * tex_amt), 1.0))
    nb.inp(hsv, "Saturation", look.outputs["Sat"])
    albedo_t = hsv.outputs[0]
    if foliage:
        # autumn: per-stroke mix toward gold / rust / crimson
        au = nb.n("ShaderNodeValToRGB")
        cr = au.color_ramp
        cr.elements[0].color = (0.85, 0.42, 0.06, 1)
        cr.elements[1].color = (0.62, 0.10, 0.05, 1)
        e = cr.elements.new(0.5)
        e.color = (0.95, 0.66, 0.12, 1)
        nb.link(s_jit, au.inputs[0])
        albedo_t = nb.mix(look.outputs["Autumn"], albedo_t, nb.mix(1.0, au.outputs[0], albedo_t, blend="MIX") if False else au.outputs[0])
    if snow > 0:
        gn = nb.n("ShaderNodeNewGeometry")
        gz = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gn.outputs["Normal"]})
        cover = nb.mapr(nb.add(gz.outputs[2], nb.mul(nb.sub(s_val, 0.5), 0.5)), 0.45, 0.62)
        cover = nb.mul(nb.mul(cover, look.outputs["Snow"]), snow)
        albedo_t = nb.mix(cover, albedo_t, (0.92, 0.94, 1.0))

    # normal perturbed by paint height (brush relief catches the light)
    bmp = nb.n("ShaderNodeBump", inputs={"Strength": bump, "Distance": 0.02})
    nb.inp(bmp, "Height", s_h)
    nrm = bmp.outputs[0]

    # captured lighting (irradiance) -> painterly ramp
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1), "Roughness": 0.0})
    nb.inp(dif, "Normal", nrm)
    if translucent > 0:
        tr = nb.n("ShaderNodeBsdfTranslucent", inputs={"Color": (translucent,) * 3})
        add = nb.n("ShaderNodeAddShader")
        nb.link(dif.outputs[0], add.inputs[0])
        nb.link(tr.outputs[0], add.inputs[1])
        light_sh = add.outputs[0]
    else:
        light_sh = dif.outputs[0]
    s2r = nb.n("ShaderNodeShaderToRGB")
    nb.link(light_sh, s2r.inputs[0])
    E = s2r.outputs["Color"]
    if ao > 0:
        aon = nb.n("ShaderNodeAmbientOcclusion", inputs={"Distance": 0.6})
        E = nb.mix(ao, E, nb.mix(1.0, E, aon.outputs["AO"], blend="MULTIPLY"))
    L = nb.bw(E)
    if wrap > 0:
        L = nb.add(nb.mul(L, 1 - wrap), wrap * 0.4)
    # brush breakup of the terminator
    brk = nb.mul(nb.sub(s_val, 0.5), nb.mul(look.outputs["Breakup"], breakup))
    Lb = nb.add(L, nb.mul(brk, nb.add(L, 0.15)))
    rmp = nb.n("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", clamp=True)
    nb.inp(rmp, "Value", Lb)
    nb.inp(rmp, "From Min", look.outputs["TermLo"])
    nb.inp(rmp, "From Max", look.outputs["TermHi"])
    lit_f = rmp.outputs["Result"]

    # shadow side: flat cool tint + a little of the real lighting (bounce/AO)
    if shadow is None:
        sh_col = look.outputs["ShadowTint"]
    else:
        shn = nb.n("ShaderNodeRGB")
        shn.outputs[0].default_value = (*shadow, 1)
        sh_col = shn.outputs[0]
    # shadow = tint + keep * real light (so fill/bounce still model the form a little)
    kE = nb.n("ShaderNodeMix", data_type="RGBA", blend_type="MIX")
    nb.inp(kE, "Factor", look.outputs["ShadowKeep"])
    nb.inp(kE, 6, (0, 0, 0))
    nb.inp(kE, 7, E)
    shadow_light = nb.mix(1.0, sh_col, kE.outputs[2], blend="ADD")
    # painterly fills on the shadow side: cool sky on top planes, warm bounce below, optional front fill
    nsep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": nrm})
    up = nb.math("MAXIMUM", nsep.outputs[2], 0.0)
    dn = nb.math("MAXIMUM", nb.mul(nsep.outputs[2], -1.0), 0.0)
    shadow_light = nb.mix(up, shadow_light, nb.mix(1.0, shadow_light, look.outputs["SkyFill"], blend="ADD"))
    shadow_light = nb.mix(dn, shadow_light, nb.mix(1.0, shadow_light, look.outputs["Bounce"], blend="ADD"))
    if front_fill > 0:
        lwf = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
        nb.inp(lwf, "Normal", nrm)
        ff = nb.mul(nb.sub(1.0, lwf.outputs["Facing"]), front_fill)
        shadow_light = nb.mix(ff, shadow_light, nb.mix(1.0, shadow_light, look.outputs["FrontFill"], blend="ADD"))
    # lit side keeps the real (coloured) light, with brush texture only here
    lit_tex = nb.add(1.0, nb.mul(nb.mul(nb.sub(s_val, 0.5), look.outputs["LitTex"]), tex_amt * 1.4))
    lit_light = nb.mix(1.0, E, nb.n("ShaderNodeCombineColor", inputs={"Red": lit_tex, "Green": lit_tex, "Blue": lit_tex}).outputs[0], blend="MULTIPLY")
    light = nb.mix(lit_f, shadow_light, nb.mix(1.0, lit_light, shadow_light, blend="LIGHTEN"))
    col = nb.mix(1.0, albedo_t, light, blend="MULTIPLY")

    # brush-dab specular
    if spec > 0:
        gl = nb.n("ShaderNodeBsdfAnisotropic")  # "Glossy BSDF" in Blender 4+
        gl.inputs["Roughness"].default_value = rough
        nb.inp(gl, "Normal", nrm)
        s2 = nb.n("ShaderNodeShaderToRGB")
        nb.link(gl.outputs[0], s2.inputs[0])
        sL = nb.bw(s2.outputs["Color"])
        sL = nb.add(sL, nb.mul(nb.sub(s_val, 0.5), 0.6))
        sm = nb.mapr(sL, 0.55, 0.75)
        sc = nb.n("ShaderNodeRGB")
        sc.outputs[0].default_value = (*spec_col, 1)
        col = nb.mix(nb.mul(sm, spec), col, nb.mix(1.0, sc.outputs[0], s2.outputs["Color"], blend="MULTIPLY"), blend="ADD")

    if rim > 0:
        lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.35})
        nb.inp(lw, "Normal", nrm)
        rf = nb.mapr(nb.add(lw.outputs["Facing"], nb.mul(nb.sub(s_val, 0.5), 0.3)), 0.55, 0.85)
        rc = nb.n("ShaderNodeRGB")
        rc.outputs[0].default_value = (*rim_col, 1)
        col = nb.mix(nb.mul(nb.mul(rf, rim), lit_f), col, nb.mix(1.0, rc.outputs[0], E, blend="MULTIPLY"), blend="ADD")

    if emission is not None:
        ec = nb.n("ShaderNodeRGB")
        ec.outputs[0].default_value = (*emission, 1)
        col = nb.mix(1.0, col, nb.mix(emit_str, (0, 0, 0), ec.outputs[0]), blend="ADD")

    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    surf = em.outputs[0]

    alpha = None
    if edge_break > 0:
        lw2 = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
        fac = lw2.outputs["Facing"]
        e = nb.add(fac, nb.mul(nb.sub(s_val, 0.5), 0.9 * edge_break))
        alpha = nb.mapr(e, 1.0 - edge_soft * edge_break - 0.05, 1.0 - 0.02, 1.0, 0.0)
    if alpha_tex is not None:
        a2 = alpha_tex(nb)
        alpha = a2 if alpha is None else nb.mul(alpha, a2)
    if alpha is not None:
        tr = nb.n("ShaderNodeBsdfTransparent")
        mx = nb.n("ShaderNodeMixShader")
        nb.inp(mx, "Fac", alpha)
        nb.link(tr.outputs[0], mx.inputs[1])
        nb.link(surf, mx.inputs[2])
        surf = mx.outputs[0]
        m.surface_render_method = "DITHERED"
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(surf, out.inputs["Surface"])
    m.use_backface_culling = not backface
    return m


# ---------------------------------------------------------------- expressive eyes
EYE_PROPS = {
    "eye_open": 1.0,    # 1 = full square, 0 = closed line
    "eye_tilt": 0.0,    # + = sad (outer corner low), - = angry/determined (inner low)
    "eye_happy": 0.0,   # 0..1 bottom edge arches up (smiling eyes)
    "eye_round": 0.12,  # corner roundness (0 = square, 0.5 = circle)
    "look_x": 0.0,      # gaze offset (-1..1)
    "look_y": 0.0,
    "glint": 1.0,       # catch-light strength
    "pupil": 1.0,       # overall size multiplier
}


def eye_material(name, side=1.0, color=(0.012, 0.010, 0.012), glint_col=(1.0, 0.97, 0.9), rim=(0.05, 0.035, 0.03)):
    """Procedural eye drawn on a plane (local XZ in [-0.5,0.5]). Shape is driven by object custom
    properties (EYE_PROPS) so expressions are keyframed per object."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = NB(t)

    def prop(p):
        a = nb.n("ShaderNodeAttribute", attribute_name=p, attribute_type="OBJECT")
        return a.outputs["Fac"]

    uvn = nb.n("ShaderNodeAttribute", attribute_name="eyeuv", attribute_type="GEOMETRY")
    sx = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": uvn.outputs["Vector"]})
    size = nb.mul(prop("pupil"), 0.40)
    x0 = nb.sub(sx.outputs[0], nb.mul(prop("look_x"), 0.06))
    z0 = nb.sub(sx.outputs[2], nb.mul(prop("look_y"), 0.05))
    x = nb.math("DIVIDE", x0, size)
    z = nb.math("DIVIDE", z0, size)
    # rounded square SDF (half size 1)
    r = prop("eye_round")
    ax = nb.math("ABSOLUTE", x)
    az = nb.math("ABSOLUTE", z)
    qx = nb.math("MAXIMUM", nb.sub(ax, nb.sub(1.0, r)), 0.0)
    qz = nb.math("MAXIMUM", nb.sub(az, nb.sub(1.0, r)), 0.0)
    ql = nb.math("SQRT", nb.add(nb.mul(qx, qx), nb.mul(qz, qz)))
    inner = nb.math("MINIMUM", nb.math("MAXIMUM", nb.sub(ax, nb.sub(1.0, r)), nb.sub(az, nb.sub(1.0, r))), 0.0)
    sdf = nb.sub(nb.add(ql, inner), r)
    # top lid: z < top - tilt*side*x  (tilt>0: outer corner drops = sad; tilt<0: inner drops = cross)
    top = nb.sub(nb.mul(prop("eye_open"), 2.0), 1.0)
    lidz = nb.add(top, nb.mul(nb.mul(prop("eye_tilt"), -side * 0.6), x))
    # happy: the eye becomes a crescent ( ^ ): bottom edge arches up, top follows at a thinning gap
    hp = prop("eye_happy")
    arch = nb.add(-1.0, nb.mul(nb.mul(hp, 1.45), nb.sub(1.0, nb.mul(x, x))))
    toph = nb.add(arch, nb.add(2.0, nb.mul(hp, -1.35)))
    lidz = nb.math("MINIMUM", lidz, toph)
    lid = nb.sub(lidz, z)
    bot = nb.sub(z, arch)
    # closed line: keep a thin line when open ~ 0 (min thickness)
    soft = 0.035
    a_shape = nb.mapr(sdf, soft, -soft, 0.0, 1.0)
    a_lid = nb.mapr(lid, -soft, soft, 0.0, 1.0)
    a_bot = nb.mapr(bot, -soft, soft, 0.0, 1.0)
    # thin closed line so a shut eye still reads
    line = nb.mapr(nb.math("ABSOLUTE", nb.sub(z, lidz)), 0.11, 0.06, 0.0, 1.0)
    line = nb.mul(line, nb.mapr(prop("eye_open"), 0.12, 0.0))
    line = nb.mul(line, nb.mapr(nb.sub(ax, 1.0), 0.0, -0.05))
    alpha = nb.math("MAXIMUM", nb.mul(nb.mul(a_shape, a_lid), a_bot), line)
    # glint (upper-left catch light) + small secondary
    gx = nb.add(x, nb.sub(0.42, nb.mul(prop("look_x"), 0.15)))
    gz = nb.sub(z, nb.add(0.38, nb.mul(prop("look_y"), 0.1)))
    gd = nb.math("SQRT", nb.add(nb.mul(gx, gx), nb.mul(gz, gz)))
    g1 = nb.mapr(gd, 0.26, 0.19)
    gx2 = nb.sub(x, 0.38)
    gz2 = nb.add(z, 0.42)
    g2 = nb.mul(nb.mapr(nb.math("SQRT", nb.add(nb.mul(gx2, gx2), nb.mul(gz2, gz2))), 0.12, 0.07), 0.6)
    glint = nb.mul(nb.math("MAXIMUM", g1, g2), nb.mul(prop("glint"), nb.mul(a_lid, a_bot)))
    # inner sheen: slightly lighter toward the bottom (wet, alive)
    sheen = nb.mapr(z, 0.2, -1.0, 0.0, 1.0)
    base = nb.n("ShaderNodeRGB")
    base.outputs[0].default_value = (*color, 1)
    rimc = nb.n("ShaderNodeRGB")
    rimc.outputs[0].default_value = (*rim, 1)
    col = nb.mix(nb.mul(sheen, 0.8), base.outputs[0], rimc.outputs[0])
    gc = nb.n("ShaderNodeRGB")
    gc.outputs[0].default_value = (*glint_col, 1)
    col = nb.mix(glint, col, gc.outputs[0])
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", alpha)
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    return m


def emissive(name, color, strength=1.0, alpha_tex=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = NB(t)
    em = nb.n("ShaderNodeEmission", inputs={"Color": color, "Strength": strength})
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(em.outputs[0], out.inputs["Surface"])
    return m
