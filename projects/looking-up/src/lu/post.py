"""Compositor (the image finish). Blender 5.x node-group API.

Order: aerial haze on geometry -> painterly consolidation that keeps brush detail at the focal point and
simplifies with distance (depth AND distance from the focus point on screen; the sky, stars and glows are never
smeared) -> brushed edge smear (same mask) -> bloom on glows -> highlight roll-off (soft shoulder: glows burn to
white-gold instead of clipping) -> lifted teal shadows (toe) -> lift/gamma/gain + saturation -> gentle vignette ->
subtle animated film grain.

All pixel sizes scale with the render resolution percentage, so half-res previews match the final look.
v1 keys keep their meaning (lift/gamma/gain = Lift/Gamma/Gain colour balance, neutral 1.0).
"""
import bpy

from . import mat

DEFAULT = dict(
    # aerial perspective (geometry only). haze=None -> the sky preset's haze colour
    haze=None, haze_amt=0.42, mist_start=40.0, mist_depth=2600.0, haze_warm=None,
    sun_xy=None, sun_glow=0.0, sun_size=0.9, sun_col=(1.0, 0.62, 0.30),
    # painterly consolidation: Kuwahara sizes (px at 1920 wide) near the focus / far away; focus point on screen
    kuw_near=2, kuw_far=7, focus_xy=(0.5, 0.52), focus_r=(0.30, 0.42), paint=1.0, smear=1.2,
    # depth falloff of the brush detail (m). None -> from the shot camera's focus distance (DOF) or 6 m
    paint_near=None, paint_far=None,
    # glows
    bloom=0.55, bloom_thr=0.65, bloom_size=8, bloom_sat=1.0,
    # tone
    rolloff=0.80, toe=(0.0052, 0.0100, 0.0130),
    lift=(1.0, 1.0, 1.0), gamma=(1.0, 1.0, 1.0), gain=(1.0, 1.0, 1.0), sat=1.0, exposure=0.0,
    vignette=0.17, grain=0.022,
    iris=0.0, iris_frames=None,
)


def _menu(node, name, value):
    sock = node.inputs[name]
    for cand in (value, value.upper(), value.title(), value.replace(" ", "_").upper()):
        try:
            sock.default_value = cand
            return
        except Exception:
            continue
    raise RuntimeError(f"menu {node.bl_idname}.{name} has no value {value}")


def _sky_depth():
    """Depth beyond which a pixel is the world background (EEVEE writes the far clip there)."""
    clips = [o.data.clip_end for o in bpy.data.objects if o.type == "CAMERA"]
    return 0.98 * min(clips) if clips else 1e9


def setup(**kw):
    P = dict(DEFAULT)
    P.update(kw)
    if P["haze"] is None:
        try:
            from . import sky
            P["haze"] = tuple(sky.CURRENT.get("haze", (0.07, 0.105, 0.13)))
        except Exception:
            P["haze"] = (0.07, 0.105, 0.13)
    sc = bpy.context.scene
    px = sc.render.resolution_percentage / 100.0 * sc.render.resolution_x / 1920.0     # pixel scale
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

    def mapr(v, a, b, c=0.0, d=1.0):
        m = N.new("ShaderNodeMapRange")
        m.interpolation_type = "SMOOTHSTEP"
        m.clamp = True
        L.new(v, m.inputs["Value"])
        m.inputs["From Min"].default_value = a
        m.inputs["From Max"].default_value = b
        m.inputs["To Min"].default_value = c
        m.inputs["To Max"].default_value = d
        return m.outputs["Result"]

    def sep(img):
        s = N.new("CompositorNodeSeparateColor")
        L.new(img, s.inputs[0])
        return s.outputs[0], s.outputs[1], s.outputs[2]

    def comb(r, g_, b):
        c = N.new("CompositorNodeCombineColor")
        for i, v in enumerate((r, g_, b)):
            L.new(v, c.inputs[i])
        return c.outputs[0]

    rl = N.new("CompositorNodeRLayers")
    img = rl.outputs["Image"]
    mist = rl.outputs["Mist"]
    depth = rl.outputs["Depth"]
    not_sky = math("LESS_THAN", depth, _sky_depth())
    coords = N.new("CompositorNodeImageCoordinates")
    L.new(img, coords.inputs[0])
    uv = coords.outputs["Normalized"]          # 0..1 across the frame
    pix = coords.outputs["Pixel"]
    if P["exposure"]:
        ex = n("CompositorNodeExposure", Image=img, Exposure=P["exposure"])
        img = ex.outputs[0]

    # ---------------------------------------------------------------- aerial perspective haze (geometry only)
    hz = math("MULTIPLY", math("MULTIPLY", math("POWER", mist, 1.15), P["haze_amt"]), not_sky)
    img = mix(hz, img, P["haze"])
    if P["sun_xy"] is not None and P["sun_glow"] > 0:
        sx, sy = P["sun_xy"]
        el = n("CompositorNodeEllipseMask", Position=(sx, sy), Size=(P["sun_size"] * 0.8, P["sun_size"] * 0.8 * 1920 / 816))
        bl = n("CompositorNodeBlur", Image=el.outputs[0], Size=(int(700 * P["sun_size"] * px), int(700 * P["sun_size"] * px)))
        glowm = math("POWER", bl.outputs[0], 1.6)
        glowm = math("MULTIPLY", glowm, math("ADD", math("MULTIPLY", not_sky, -0.75), 1.0))
        gcol = mix(math("MULTIPLY", glowm, P["sun_glow"]), (0, 0, 0), P["sun_col"])
        img = mix(1.0, img, gcol, blend="SCREEN")
        if P["haze_warm"] is not None:
            hz2 = math("MULTIPLY", hz, glowm)
            img = mix(math("MULTIPLY", hz2, 1.2), img, P["haze_warm"])

    # ---------------------------------------------------------------- painterly consolidation (focal-aware)
    sxu = N.new("ShaderNodeSeparateXYZ")
    L.new(uv, sxu.inputs[0])
    fx, fy = P["focus_xy"]
    rx, ry = P["focus_r"] if isinstance(P["focus_r"], (tuple, list)) else (P["focus_r"], P["focus_r"])
    dx = math("DIVIDE", math("SUBTRACT", sxu.outputs[0], fx), rx)
    dy = math("DIVIDE", math("SUBTRACT", sxu.outputs[1], fy), ry)
    rr = math("SQRT", math("ADD", math("MULTIPLY", dx, dx), math("MULTIPLY", dy, dy)))
    scr = mapr(rr, 0.5, 1.25)                                  # 0 at the focal point .. 1 toward the frame edges
    fd = 6.0
    cam = sc.camera
    if cam is not None and cam.data.dof.use_dof and cam.data.dof.focus_distance > 0:
        fd = cam.data.dof.focus_distance
    pn = P["paint_near"] if P["paint_near"] is not None else max(1.6 * fd, 3.0)
    pf = P["paint_far"] if P["paint_far"] is not None else max(7.0 * fd, 24.0)
    dfar = mapr(depth, pn, pf)                                 # simplify behind the subject (far meadow, trees)
    far = math("MAXIMUM", math("MAXIMUM", mapr(mist, 0.05, 0.55), dfar), math("MULTIPLY", scr, 0.9))
    far = math("MULTIPLY", far, not_sky)
    if P["paint"] > 0 and P["kuw_far"] > 0:
        kn = max(1, round(P["kuw_near"] * px))
        kf = max(2, round(P["kuw_far"] * px))
        k1 = n("CompositorNodeKuwahara", Image=img, Size=kn, Type="Anisotropic", Uniformity=2, Sharpness=0.75,
               Eccentricity=1.0)
        k2 = n("CompositorNodeKuwahara", Image=img, Size=kf, Type="Anisotropic", Uniformity=4, Sharpness=0.55,
               Eccentricity=1.25)
        painted = mix(far, k1.outputs[0], k2.outputs[0])
        # geometry gets painted; the sky / stars / blended glows (no depth) keep their own painted detail
        img = mix(math("MULTIPLY", not_sky, P["paint"]), img, painted)
    # brushed edge smear: a painterly warp field, stronger away from the focus
    if P["smear"] > 0:
        nz = N.new("ShaderNodeTexNoise")
        nz.inputs["Scale"].default_value = 1.0
        nz.inputs["Detail"].default_value = 3.0
        nz.inputs["Roughness"].default_value = 0.55
        nz.inputs["Distortion"].default_value = 0.6
        vs = N.new("ShaderNodeVectorMath")
        vs.operation = "SCALE"
        L.new(pix, vs.inputs[0])
        vs.inputs["Scale"].default_value = 1.0 / (9.0 * px)
        L.new(vs.outputs[0], nz.inputs["Vector"])
        r_, g_, _b = sep(nz.outputs["Color"])
        amt = math("MULTIPLY", math("ADD", math("MULTIPLY", far, 0.75), 0.25), not_sky)
        amt = math("MULTIPLY", amt, P["smear"] * 2.0 * px)
        cmb = N.new("ShaderNodeCombineXYZ")
        L.new(math("MULTIPLY", math("SUBTRACT", r_, 0.5), amt), cmb.inputs[0])
        L.new(math("MULTIPLY", math("SUBTRACT", g_, 0.5), amt), cmb.inputs[1])
        ds = n("CompositorNodeDisplace", Image=img, **{"Extension X": "Extend", "Extension Y": "Extend"})
        L.new(cmb.outputs[0], ds.inputs["Displacement"])
        img = ds.outputs[0]

    # ---------------------------------------------------------------- bloom on glows
    if P["bloom"] > 0:
        gl = n("CompositorNodeGlare", Image=img, Type="Bloom", Quality="High", Threshold=P["bloom_thr"],
               Strength=P["bloom"], Size=P["bloom_size"] / 9.0 if P["bloom_size"] > 1 else P["bloom_size"])
        try:
            gl.inputs["Saturation"].default_value = P["bloom_sat"]
        except Exception:
            pass
        img = gl.outputs[0]

    # ---------------------------------------------------------------- highlight roll-off (soft shoulder per channel)
    k = P["rolloff"]
    if k and k < 1.0:
        chans = []
        for c in sep(img):
            over = math("MAXIMUM", math("SUBTRACT", c, k), 0.0)
            comp = math("MULTIPLY", math("SUBTRACT", 1.0, math("EXPONENT", math("MULTIPLY", over, -1.0 / (1.0 - k)))),
                        1.0 - k)
            chans.append(math("ADD", math("MINIMUM", c, k), comp))
        img = comb(*chans)

    # ---------------------------------------------------------------- lifted teal shadows (never black)
    toe = P["toe"]
    if toe and max(toe) > 0:
        chans = []
        for c, t in zip(sep(img), toe):
            chans.append(math("ADD", math("MULTIPLY", c, 1.0 - t), t))
        img = comb(*chans)

    # ---------------------------------------------------------------- grade (lift / gamma / gain) + saturation
    if any(tuple(P[k_]) != (1.0, 1.0, 1.0) for k_ in ("lift", "gamma", "gain")):
        cb = N.new("CompositorNodeColorBalance")
        L.new(img, cb.inputs["Image"])
        _menu(cb, "Type", "Lift/Gamma/Gain")
        for s in cb.inputs:
            if s.name in ("Lift", "Gamma", "Gain") and hasattr(s.default_value, "__len__") and len(s.default_value) in (3, 4):
                v = {"Lift": P["lift"], "Gamma": P["gamma"], "Gain": P["gain"]}[s.name]
                s.default_value = (*v, 1.0)[: len(s.default_value)]
        img = cb.outputs[0]
    if P["sat"] != 1.0:
        hs = N.new("CompositorNodeHueSat")
        L.new(img, hs.inputs["Image"])
        hs.inputs["Saturation"].default_value = P["sat"]
        img = hs.outputs[0]

    # ---------------------------------------------------------------- vignette (gentle, slightly cool in the corners)
    if P["vignette"] > 0:
        cx = math("MULTIPLY", math("SUBTRACT", sxu.outputs[0], 0.5), 2.0)
        cy = math("MULTIPLY", math("SUBTRACT", sxu.outputs[1], 0.5), 2.0)
        r2 = math("ADD", math("MULTIPLY", cx, cx), math("MULTIPLY", math("MULTIPLY", cy, cy), 0.8))
        vig = math("SUBTRACT", 1.0, math("MULTIPLY", mapr(r2, 0.35, 2.0), P["vignette"]))
        mm = N.new("ShaderNodeMix")
        mm.data_type = "RGBA"
        mm.blend_type = "MULTIPLY"
        mm.inputs[0].default_value = 1.0
        L.new(img, mm.inputs[6])
        vc = comb(math("MULTIPLY", vig, 1.0), math("ADD", math("MULTIPLY", vig, 0.97), 0.03),
                  math("ADD", math("MULTIPLY", vig, 0.94), 0.06))
        L.new(vc, mm.inputs[7])
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

    # ---------------------------------------------------------------- film grain (animated, slightly clumpy, mostly luma)
    if P["grain"] > 0:
        st = N.new("CompositorNodeSceneTime")
        gv = N.new("ShaderNodeVectorMath")
        gv.operation = "SCALE"
        L.new(pix, gv.inputs[0])
        gv.inputs["Scale"].default_value = 1.0 / (1.15 * px)
        gn = N.new("ShaderNodeTexNoise")
        gn.noise_dimensions = "4D"
        gn.inputs["Scale"].default_value = 1.0
        gn.inputs["Detail"].default_value = 0.0
        L.new(gv.outputs[0], gn.inputs["Vector"])
        L.new(math("MULTIPLY", st.outputs["Frame"], 7.31), gn.inputs["W"])
        gr, gg, gb = sep(gn.outputs["Color"])
        luma = gn.outputs["Fac"]
        lum_img = N.new("CompositorNodeRGBToBW")
        L.new(img, lum_img.inputs[0])
        # grain lives in the mid-tones (film): weaker in deep shadow and highlights
        wgt = math("MULTIPLY", mapr(lum_img.outputs[0], 0.0, 0.05, 0.45, 1.0), mapr(lum_img.outputs[0], 0.9, 0.4, 0.4, 1.0))
        chans = []
        for c, cc in zip(sep(img), (gr, gg, gb)):
            gval = math("ADD", math("MULTIPLY", math("SUBTRACT", luma, 0.5), 0.8), math("MULTIPLY", math("SUBTRACT", cc, 0.5), 0.2))
            chans.append(math("MAXIMUM", math("ADD", c, math("MULTIPLY", math("MULTIPLY", gval, wgt),
                                                              math("ADD", math("MULTIPLY", c, P["grain"] * 2.2), P["grain"] * 0.06))), 0.0))
        img = comb(*chans)

    out = N.new("NodeGroupOutput")
    L.new(img, out.inputs[0])
    return g
