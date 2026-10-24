"""Compositor (the image finish). Blender 5.x node-group API.

Order: aerial haze on geometry (mist pass, phase colour) -> painterly consolidation that keeps brush detail at the
focal point and simplifies with distance (depth AND distance from the focus point on screen; the sky and glows are
never smeared) -> brushed edge smear -> heat shimmer regions -> bloom on glows -> highlight roll-off -> lifted
shadows (toe) -> lift/gamma/gain + saturation (the act's grade) -> vignette -> animated film grain.

Per-phase presets (the colour script's grade, one call per shot):
  post.preset("ash" | "threat" | "storm" | "low" | "beam" | "bloom" | "coda", **overrides) -> dict for setup()
  shots: return dict(post=post.preset("storm", focus_xy=(0.45, 0.55)), ...)
Keyable grade: any of haze, haze_amt, lift, gamma, gain, sat, exposure, bloom may be given as [(frame, value), ...]
and is keyframed (e.g. B18: post.transition("beam", "bloom", f0, f1, **overrides)).
Heat shimmer: shimmer=[(x0, y0, x1, y1, amount_px), ...] in 0..1 screen coords (bottom-left origin).

All pixel sizes scale with the render resolution percentage, so half-res previews match the final look."""
import bpy

from . import mat

DEFAULT = dict(
    haze=None, haze_amt=0.42, mist_start=40.0, mist_depth=2600.0, haze_pow=0.85, haze_max=0.78, haze_env=0.6, haze_far=1700.0, haze_warm=None,
    sun_xy=None, sun_glow=0.0, sun_size=0.9, sun_col=(1.0, 0.62, 0.30),
    kuw_near=2, kuw_far=5, focus_xy=(0.5, 0.52), focus_r=(0.30, 0.42), paint=1.0, smear=0.9,
    paint_near=None, paint_far=None,
    bloom=0.55, bloom_thr=0.65, bloom_size=8, bloom_sat=1.0,
    rolloff=0.80, toe=(0.0052, 0.0100, 0.0130),
    lift=(1.0, 1.0, 1.0), gamma=(1.0, 1.0, 1.0), gain=(1.0, 1.0, 1.0), sat=1.0, exposure=0.0,
    vignette=0.17, grain=0.022, shimmer=(),
    iris=0.0, iris_frames=None,
)

# the colour script's grades (ash desaturated warm-grey, storm cold, beam gold, bloom saturated, coda warm)
PRESETS = {
    "ash": dict(haze=(0.46, 0.43, 0.37), haze_amt=0.75, mist_start=10.0, mist_depth=420.0, sat=0.80,
                lift=(1.0, 1.0, 1.0), gamma=(1.0, 0.995, 1.01), gain=(1.03, 1.0, 0.93), toe=(0.014, 0.013, 0.012),
                bloom=0.5, bloom_thr=0.78, vignette=0.22, rolloff=0.82),
    "threat": dict(haze=(0.40, 0.385, 0.36), haze_amt=0.72, mist_start=10.0, mist_depth=400.0, sat=0.86,
                   gamma=(1.0, 1.0, 1.02), gain=(1.02, 0.99, 0.95), toe=(0.012, 0.012, 0.014), bloom=0.35,
                   bloom_thr=0.85, vignette=0.24),
    "storm": dict(haze=(0.21, 0.235, 0.29), haze_amt=0.75, mist_start=5.0, mist_depth=300.0, sat=0.78,
                  lift=(0.985, 1.0, 1.035), gamma=(0.98, 1.0, 1.04), gain=(0.95, 0.99, 1.06), toe=(0.010, 0.014, 0.020),
                  bloom=0.65, bloom_thr=0.62, vignette=0.26, rolloff=0.8),
    "low": dict(haze=(0.26, 0.28, 0.31), haze_amt=0.72, mist_start=5.0, mist_depth=320.0, sat=0.55,
                lift=(0.99, 1.0, 1.03), gamma=(0.99, 1.0, 1.03), gain=(0.97, 0.99, 1.04), toe=(0.012, 0.014, 0.018),
                bloom=0.45, vignette=0.28),
    "beam": dict(haze=(0.22, 0.235, 0.28), haze_amt=0.7, mist_start=6.0, mist_depth=380.0, sat=0.95,
                 gamma=(1.0, 1.0, 1.02), gain=(1.05, 1.0, 0.93), toe=(0.010, 0.012, 0.018), bloom=0.9, bloom_thr=0.55,
                 bloom_size=9, vignette=0.24),
    "bloom": dict(haze=(0.86, 0.70, 0.68), haze_amt=0.45, mist_start=15.0, mist_depth=950.0, sat=1.1, kuw_far=5,
                  gamma=(1.0, 1.0, 1.0), gain=(1.04, 1.0, 0.97), toe=(0.012, 0.010, 0.014), bloom=0.62, bloom_thr=0.68,
                  vignette=0.15),
    "coda": dict(haze=(0.74, 0.76, 0.82), haze_amt=0.5, mist_start=12.0, mist_depth=800.0, sat=1.08, kuw_far=5,
                 gamma=(1.0, 1.0, 0.99), gain=(1.06, 1.0, 0.93), toe=(0.010, 0.010, 0.014), bloom=0.55, bloom_thr=0.7,
                 vignette=0.16),
}
KEYABLE = ("haze", "haze_amt", "lift", "gamma", "gain", "sat", "exposure", "bloom")


def preset(phase, **over):
    """The post settings for a phase of the colour script (+ overrides). Use as ctx['post'] in a shot."""
    P = dict(PRESETS[phase])
    P.update(over)
    return P


def transition(a, b, f0, f1, **over):
    """A grade that moves from phase a's preset to phase b's between absolute frames f0..f1 (keyed)."""
    A, B = PRESETS[a], PRESETS[b]
    P = dict(B)
    for k in KEYABLE:
        if k in A or k in B:
            va = A.get(k, DEFAULT[k] if DEFAULT.get(k) is not None else B.get(k))
            vb = B.get(k, DEFAULT[k] if DEFAULT.get(k) is not None else A.get(k))
            P[k] = [(f0, va), (f1, vb)]
    P.update(over)
    return P


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
    clips = [o.data.clip_end for o in bpy.data.objects if o.type == "CAMERA"]
    return 0.98 * min(clips) if clips else 1e9


def _is_keys(v):
    return isinstance(v, list) and v and isinstance(v[0], tuple) and len(v[0]) == 2 and isinstance(v[0][0], (int, float))


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
    px = sc.render.resolution_percentage / 100.0 * sc.render.resolution_x / 1920.0
    vl = bpy.context.view_layer
    vl.use_pass_mist = True
    vl.use_pass_z = True
    try:
        vl.use_pass_environment = True
    except Exception:
        pass
    w = sc.world
    if w:
        w.mist_settings.start = P["mist_start"]
        w.mist_settings.depth = P["mist_depth"]
        w.mist_settings.falloff = "LINEAR"
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

    def value(v):
        """A float socket for a param (keyed when v is [(frame, value), ...])."""
        nd = N.new("ShaderNodeValue")
        s = nd.outputs[0]
        if _is_keys(v):
            for f, x in v:
                s.default_value = float(x)
                s.keyframe_insert("default_value", frame=f)
        else:
            s.default_value = float(v)
        return s

    def color(v):
        nd = N.new("CompositorNodeRGB")
        s = nd.outputs[0]
        if _is_keys(v):
            for f, x in v:
                s.default_value = (*x[:3], 1.0)
                s.keyframe_insert("default_value", frame=f)
        else:
            s.default_value = (*v[:3], 1.0)
        return s

    def first(v):
        return v[0][1] if _is_keys(v) else v

    rl = N.new("CompositorNodeRLayers")
    img = rl.outputs["Image"]
    mist = rl.outputs["Mist"]
    depth = rl.outputs["Depth"]
    not_sky = math("LESS_THAN", depth, _sky_depth())
    coords = N.new("CompositorNodeImageCoordinates")
    L.new(img, coords.inputs[0])
    uv = coords.outputs["Normalized"]
    pix = coords.outputs["Pixel"]
    if _is_keys(P["exposure"]) or P["exposure"]:
        ex = n("CompositorNodeExposure", Image=img)
        L.new(value(P["exposure"]), ex.inputs["Exposure"])
        img = ex.outputs[0]

    # ---------------------------------------------------------------- aerial perspective haze (geometry only)
    hz = math("MULTIPLY", math("MINIMUM", math("MULTIPLY", math("POWER", mist, P["haze_pow"]), value(P["haze_amt"])), P["haze_max"]), not_sky)
    # very far things (the storm wall, the outer ridges) carry their own painted haze: fade the post haze out
    hz = math("MULTIPLY", hz, mapr(depth, P["haze_far"], P["haze_far"] * 0.7))
    hcol = color(P["haze"])
    env_name = "Environment" if "Environment" in rl.outputs else ("Env" if "Env" in rl.outputs else None)
    if P["haze_env"] > 0 and env_name:
        # distant things dissolve into the painted sky behind them (dark under the storm, gold toward the sun)
        hcol = mix(P["haze_env"], hcol, rl.outputs[env_name])
    img = mix(hz, img, hcol)
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
    scr = mapr(rr, 0.5, 1.25)
    fd = 6.0
    cam = sc.camera
    if cam is not None and cam.data.dof.use_dof and cam.data.dof.focus_distance > 0:
        fd = cam.data.dof.focus_distance
    pn = P["paint_near"] if P["paint_near"] is not None else max(1.6 * fd, 3.0)
    pf = P["paint_far"] if P["paint_far"] is not None else max(7.0 * fd, 24.0)
    dfar = mapr(depth, pn, pf)
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
        img = mix(math("MULTIPLY", not_sky, P["paint"]), img, painted)
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

    # ---------------------------------------------------------------- heat shimmer (screen regions, animated)
    if P["shimmer"]:
        st = N.new("CompositorNodeSceneTime")
        tot = None
        for (x0, y0, x1, y1, a) in P["shimmer"]:
            mx = math("MULTIPLY", mapr(sxu.outputs[0], x0, x0 + 0.05), mapr(sxu.outputs[0], x1, x1 - 0.05))
            my = math("MULTIPLY", mapr(sxu.outputs[1], y0, y0 + 0.04), mapr(sxu.outputs[1], y1, y1 - 0.04))
            m_ = math("MULTIPLY", math("MULTIPLY", mx, my), a * px)
            tot = m_ if tot is None else math("MAXIMUM", tot, m_)
        nz = N.new("ShaderNodeTexNoise")
        nz.noise_dimensions = "3D"
        nz.inputs["Scale"].default_value = 1.0
        nz.inputs["Detail"].default_value = 2.0
        vs = N.new("ShaderNodeVectorMath")
        vs.operation = "MULTIPLY"
        L.new(pix, vs.inputs[0])
        vs.inputs[1].default_value = (1.0 / (14.0 * px), 1.0 / (5.0 * px), 0.0)
        va = N.new("ShaderNodeVectorMath")
        va.operation = "ADD"
        L.new(vs.outputs[0], va.inputs[0])
        cz = N.new("ShaderNodeCombineXYZ")
        L.new(math("MULTIPLY", st.outputs["Seconds"], 0.0), cz.inputs[0])
        L.new(math("MULTIPLY", st.outputs["Seconds"], -1.6), cz.inputs[1])
        L.new(math("MULTIPLY", st.outputs["Seconds"], 0.9), cz.inputs[2])
        L.new(cz.outputs[0], va.inputs[1])
        L.new(va.outputs[0], nz.inputs["Vector"])
        r_, g_, _b = sep(nz.outputs["Color"])
        cmb = N.new("ShaderNodeCombineXYZ")
        L.new(math("MULTIPLY", math("SUBTRACT", r_, 0.5), math("MULTIPLY", tot, 0.6)), cmb.inputs[0])
        L.new(math("MULTIPLY", math("SUBTRACT", g_, 0.5), tot), cmb.inputs[1])
        ds = n("CompositorNodeDisplace", Image=img, **{"Extension X": "Extend", "Extension Y": "Extend"})
        L.new(cmb.outputs[0], ds.inputs["Displacement"])
        img = ds.outputs[0]

    # ---------------------------------------------------------------- bloom on glows
    if _is_keys(P["bloom"]) or P["bloom"] > 0:
        gl = n("CompositorNodeGlare", Image=img, Type="Bloom", Quality="High", Threshold=P["bloom_thr"],
               Size=P["bloom_size"] / 9.0 if P["bloom_size"] > 1 else P["bloom_size"])
        L.new(value(P["bloom"]), gl.inputs["Strength"])
        try:
            gl.inputs["Saturation"].default_value = P["bloom_sat"]
        except Exception:
            pass
        img = gl.outputs[0]

    # ---------------------------------------------------------------- highlight roll-off
    k = P["rolloff"]
    if k and k < 1.0:
        chans = []
        for c in sep(img):
            over = math("MAXIMUM", math("SUBTRACT", c, k), 0.0)
            comp = math("MULTIPLY", math("SUBTRACT", 1.0, math("EXPONENT", math("MULTIPLY", over, -1.0 / (1.0 - k)))),
                        1.0 - k)
            chans.append(math("ADD", math("MINIMUM", c, k), comp))
        img = comb(*chans)

    # ---------------------------------------------------------------- lifted shadows (never black)
    toe = P["toe"]
    if toe and max(toe) > 0:
        chans = []
        for c, t in zip(sep(img), toe):
            chans.append(math("ADD", math("MULTIPLY", c, 1.0 - t), t))
        img = comb(*chans)

    # ---------------------------------------------------------------- grade (lift / gamma / gain) + saturation
    if any(_is_keys(P[k_]) or tuple(P[k_]) != (1.0, 1.0, 1.0) for k_ in ("lift", "gamma", "gain")):
        cb = N.new("CompositorNodeColorBalance")
        L.new(img, cb.inputs["Image"])
        _menu(cb, "Type", "Lift/Gamma/Gain")
        for s in cb.inputs:
            if s.name in ("Lift", "Gamma", "Gain") and hasattr(s.default_value, "__len__") and len(s.default_value) in (3, 4):
                v = {"Lift": P["lift"], "Gamma": P["gamma"], "Gain": P["gain"]}[s.name]
                if _is_keys(v):
                    for f, x in v:
                        s.default_value = (*x, 1.0)[: len(s.default_value)]
                        s.keyframe_insert("default_value", frame=f)
                else:
                    s.default_value = (*v, 1.0)[: len(s.default_value)]
        img = cb.outputs[0]
    if _is_keys(P["sat"]) or P["sat"] != 1.0:
        hs = N.new("CompositorNodeHueSat")
        L.new(img, hs.inputs["Image"])
        L.new(value(P["sat"]), hs.inputs["Saturation"])
        img = hs.outputs[0]

    # ---------------------------------------------------------------- vignette
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
        el = n("CompositorNodeEllipseMask", Size=(P["iris"] * 816 / 1920, P["iris"]))
        bl = n("CompositorNodeBlur", Image=el.outputs[0], Size=(14, 14))
        mm = N.new("ShaderNodeMix")
        mm.data_type = "RGBA"
        mm.blend_type = "MULTIPLY"
        mm.inputs[0].default_value = 1.0
        L.new(img, mm.inputs[6])
        L.new(bl.outputs[0], mm.inputs[7])
        img = mm.outputs[2]

    # ---------------------------------------------------------------- film grain
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
