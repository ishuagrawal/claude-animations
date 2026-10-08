"""Compositor: aerial haze, painterly consolidation (anisotropic Kuwahara, stronger with depth),
brushed edge smear (stroke-texture displacement), bloom, grade, vignette.  Blender 5.x node-group API."""
import bpy

from . import mat

DEFAULT = dict(sun_xy=None, sun_glow=0.0, sun_size=0.9, sun_col=(1.0, 0.62, 0.30), haze_warm=None,
               haze=(0.9, 0.62, 0.52), haze_amt=0.65, mist_start=25.0, mist_depth=900.0,
               kuw_near=3, kuw_far=7, smear=1.6, bloom=0.35, bloom_thr=0.85, bloom_size=7,
               lift=(1.0, 1.0, 1.02), gamma=(1.0, 1.0, 1.0), gain=(1.0, 1.0, 1.0), sat=1.0, vignette=0.28,
               exposure=0.0, iris=0.0, iris_frames=None)


def _menu(node, name, value):
    sock = node.inputs[name]
    for cand in (value, value.upper(), value.title(), value.replace(" ", "_").upper()):
        try:
            sock.default_value = cand
            return
        except Exception:
            continue
    raise RuntimeError(f"menu {node.bl_idname}.{name} has no value {value}")


def setup(**kw):
    P = dict(DEFAULT)
    P.update(kw)
    sc = bpy.context.scene
    vl = bpy.context.view_layer
    vl.use_pass_mist = True
    vl.use_pass_z = True
    w = sc.world
    if w:
        w.mist_settings.start = P["mist_start"]
        w.mist_settings.depth = P["mist_depth"]
        w.mist_settings.falloff = "QUADRATIC"
    sc.render.compositor_device = "GPU"
    g = bpy.data.node_groups.get("LU_Comp")
    if g:
        bpy.data.node_groups.remove(g)
    g = bpy.data.node_groups.new("LU_Comp", "CompositorNodeTree")
    g.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
    sc.compositing_node_group = g
    N, L = g.nodes, g.links

    def n(kind, **inputs):
        node = N.new(kind)
        for k, v in inputs.items():
            if isinstance(v, bpy.types.NodeSocket):
                L.new(v, node.inputs[k])
            elif isinstance(v, str):
                _menu(node, k, v)
            else:
                s = node.inputs[k]
                if isinstance(v, (tuple, list)) and len(v) == 3 and hasattr(s.default_value, "__len__") and len(s.default_value) == 4:
                    v = (*v, 1.0)
                s.default_value = v
        return node

    def math(op, a, b=0.0):
        m = N.new("ShaderNodeMath")
        m.operation = op
        for i, v in enumerate((a, b)):
            if isinstance(v, bpy.types.NodeSocket):
                L.new(v, m.inputs[i])
            else:
                m.inputs[i].default_value = v
        return m.outputs[0]

    def mix(fac, a, b, blend="MIX"):
        m = N.new("ShaderNodeMix")
        m.data_type = "RGBA"
        m.blend_type = blend
        for idx, v in ((0, fac), (6, a), (7, b)):
            if isinstance(v, bpy.types.NodeSocket):
                L.new(v, m.inputs[idx])
            else:
                m.inputs[idx].default_value = v if idx == 0 else (*v, 1.0) if len(v) == 3 else v
        return m.outputs[2]

    rl = N.new("CompositorNodeRLayers")
    img = rl.outputs["Image"]
    mist = rl.outputs["Mist"]
    depth = rl.outputs["Depth"]
    not_sky = math("LESS_THAN", depth, 20000.0)
    # aerial perspective haze
    hz = math("MULTIPLY", math("MULTIPLY", math("POWER", mist, 1.15), P["haze_amt"]), not_sky)
    img = mix(hz, img, P["haze"])
    # backlit atmospheric glow around the sun (screen space), and warm/cool haze split
    if P["sun_xy"] is not None and P["sun_glow"] > 0:
        sx, sy = P["sun_xy"]
        el = n("CompositorNodeEllipseMask", Position=(sx, sy), Size=(P["sun_size"] * 0.8, P["sun_size"] * 0.8 * 1920 / 816))
        bl = n("CompositorNodeBlur", Image=el.outputs[0], Size=(int(700 * P["sun_size"]), int(700 * P["sun_size"])))
        glowm = math("POWER", bl.outputs[0], 1.6)
        # glow lives in the sky: geometry only receives a fraction of it (no glow through hills)
        glowm = math("MULTIPLY", glowm, math("ADD", math("MULTIPLY", not_sky, -0.75), 1.0))
        gcol = mix(math("MULTIPLY", glowm, P["sun_glow"]), (0, 0, 0), P["sun_col"])
        img = mix(1.0, img, gcol, blend="SCREEN")
        if P["haze_warm"] is not None:
            hz2 = math("MULTIPLY", hz, glowm)
            img = mix(math("MULTIPLY", hz2, 1.2), img, P["haze_warm"])
    # painterly consolidation: anisotropic Kuwahara, near and far strengths mixed by mist
    k1 = n("CompositorNodeKuwahara", Image=img, Size=P["kuw_near"], Type="Anisotropic", Uniformity=4, Sharpness=0.6,
           Eccentricity=1.0)
    k2 = n("CompositorNodeKuwahara", Image=img, Size=P["kuw_far"], Type="Anisotropic", Uniformity=4, Sharpness=0.5,
           Eccentricity=1.2)
    far = math("MINIMUM", math("MULTIPLY", math("ADD", mist, math("SUBTRACT", 1.0, not_sky)), 2.5), 1.0)
    img = mix(far, k1.outputs[0], k2.outputs[0])
    # brushed edge smear: displace by a brush-stroke field (screen space, a couple of pixels)
    if P["smear"] > 0:
        im = N.new("CompositorNodeImage")
        im.image = mat.image("strokes_fine")
        sep = N.new("CompositorNodeSeparateColor")
        L.new(im.outputs["Image"], sep.inputs[0])
        dx = math("MULTIPLY", math("SUBTRACT", sep.outputs[0], 0.5), P["smear"] * 2)
        dy = math("MULTIPLY", math("SUBTRACT", sep.outputs[1], 0.5), P["smear"] * 2)
        cmb = N.new("CompositorNodeCombineXYZ") if hasattr(bpy.types, "CompositorNodeCombineXYZ") else N.new("ShaderNodeCombineXYZ")
        L.new(dx, cmb.inputs[0])
        L.new(dy, cmb.inputs[1])
        ds = n("CompositorNodeDisplace", Image=img, **{"Extension X": "Extend", "Extension Y": "Extend"})
        L.new(cmb.outputs[0], ds.inputs["Displacement"])
        img = ds.outputs[0]
    # bloom
    if P["bloom"] > 0:
        gl = n("CompositorNodeGlare", Image=img, Type="Bloom", Quality="High", Threshold=P["bloom_thr"],
               Strength=P["bloom"], Size=P["bloom_size"] / 9.0 if P["bloom_size"] > 1 else P["bloom_size"])
        img = gl.outputs[0]
    # grade (lift / gamma / gain)
    cb = N.new("CompositorNodeColorBalance")
    L.new(img, cb.inputs["Image"])
    _menu(cb, "Type", "Lift/Gamma/Gain")
    names = [s for s in cb.inputs if s.name in ("Lift", "Gamma", "Gain")]
    for s in names:
        v = {"Lift": P["lift"], "Gamma": P["gamma"], "Gain": P["gain"]}[s.name]
        if hasattr(s.default_value, "__len__") and len(s.default_value) in (3, 4):
            s.default_value = (*v, 1.0)[: len(s.default_value)]
    img = cb.outputs[0]
    if P["sat"] != 1.0:
        hs = N.new("CompositorNodeHueSat")
        L.new(img, hs.inputs["Image"])
        hs.inputs["Saturation"].default_value = P["sat"]
        img = hs.outputs[0]
    # vignette
    if P["vignette"] > 0:
        el = n("CompositorNodeEllipseMask", Size=(1.15, 1.35))
        bl = n("CompositorNodeBlur", Image=el.outputs[0], Size=(220, 220))
        vig = math("ADD", math("MULTIPLY", bl.outputs[0], P["vignette"]), 1 - P["vignette"])
        img = mix(1.0, img, (1, 1, 1), blend="MULTIPLY") if False else mix(1.0, img, img, blend="MIX")
        mm = N.new("ShaderNodeMix")
        mm.data_type = "RGBA"
        mm.blend_type = "MULTIPLY"
        mm.inputs[0].default_value = 1.0
        L.new(img, mm.inputs[6])
        L.new(vig, mm.inputs[7])
        img = mm.outputs[2]
    if P["iris"] > 0:
        # telescope eyepiece: soft-edged circular mask (aspect-correct)
        el = n("CompositorNodeEllipseMask", Size=(P["iris"] * 816 / 1920, P["iris"]))
        if P["iris_frames"]:
            fa, fb = P["iris_frames"]
            sz = el.inputs["Size"]
            for f, on in ((fa - 1, False), (fa, True), (fb, True), (fb + 1, False)):
                sz.default_value = (P["iris"] * 816 / 1920, P["iris"]) if on else (5.0, 5.0)
                sz.keyframe_insert("default_value", frame=f)
            for fc in (g.animation_data.action.fcurves if g.animation_data and g.animation_data.action and hasattr(g.animation_data.action, "fcurves") else []):
                for kp in fc.keyframe_points:
                    kp.interpolation = "CONSTANT"
        bl = n("CompositorNodeBlur", Image=el.outputs[0], Size=(14, 14))
        mm = N.new("ShaderNodeMix")
        mm.data_type = "RGBA"
        mm.blend_type = "MULTIPLY"
        mm.inputs[0].default_value = 1.0
        L.new(img, mm.inputs[6])
        L.new(bl.outputs[0], mm.inputs[7])
        img = mm.outputs[2]
    out = N.new("NodeGroupOutput")
    L.new(img, out.inputs[0])
    return g
