"""Sea of clouds: metaball cumulus heaps near the peak + a painted far cloud floor + drifting mist wisps + layered
distant peaks fading into the atmosphere.

Night (sky preset "night", the whole v2 film) uses dedicated painterly shaders driven by sky.CURRENT["clouds"]:
moonlit tops (cool silver), flat cool-teal shadow sides with brush breakup, silver rims where the moon backlights
thin edges, a hint of the warm twilight band on far tops, broken brushy edges on the heaps, and distance fog in
the material so the sea and the peaks recede in painted layers (near = contrast and brush detail, far = soft
blobs). Other presets keep the v1 materials.
"""
import math
import bpy
import numpy as np
from mathutils import Vector

from . import geo, mat

R_FAR = 4850.0        # everything stays inside the cameras' 5000 m clip; the sky paints the rest of the sea


def _night():
    try:
        from . import sky
        return sky.is_night()
    except Exception:
        return False


def _CL():
    from . import sky
    return sky.CURRENT.get("clouds", {})


def _band():
    from . import sky
    N = sky.CURRENT.get("night", {})
    return N.get("band", (0.36, 0.17, 0.085)), N.get("band_az", 145.0), sky.moon_dir()


# ====================================================================== night shaders
def _fog(nb, col, fog_near, fog_far, power=0.85, max_fog=0.97):
    """Mix toward the horizon haze by view distance (plus the twilight band reflected on far tops)."""
    from .sky import _rgb, _vadd, _vscale
    C = _CL()
    band, baz, _ = _band()
    cam = nb.n("ShaderNodeCameraData")
    dist = cam.outputs["View Distance"]
    f = nb.math("POWER", nb.mapr(dist, fog_near, fog_far, 0.0, 1.0, interp="LINEAR"), power)
    f = nb.mul(f, max_fog)
    # warm reflection toward the twilight azimuth, on far tops only
    g = nb.n("ShaderNodeNewGeometry")
    pos = g.outputs["Position"]
    sxy = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": pos})
    hv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(hv, "X", sxy.outputs[0])
    nb.inp(hv, "Y", sxy.outputs[1])
    hd = nb.vmath("NORMALIZE", hv.outputs[0])
    bd = nb.n("ShaderNodeCombineXYZ", inputs={"X": math.cos(math.radians(baz)), "Y": math.sin(math.radians(baz)), "Z": 0.0})
    azw = nb.math("POWER", nb.mul(nb.add(nb.vmath("DOT_PRODUCT", hd, bd.outputs[0]), 1.0), 0.5), 2.5)
    haze = _vadd(nb, _rgb(nb, C.get("haze", (0.09, 0.118, 0.14))),
                 _vscale(nb, _rgb(nb, band), nb.mul(nb.mul(nb.math("POWER", f, 3.0), azw), 0.32)))
    return nb.mix(f, col, haze), f


def _billow_normal(nb, co, size=6.0, strength=0.7):
    """Cauliflower bulges: smooth Voronoi domes (two octaves) as a bump on the normal, so every bank breaks into lit
    rounded billows with shaded undersides (cumulus), instead of one smooth pillow."""
    v1 = nb.n("ShaderNodeTexVoronoi", feature="SMOOTH_F1", voronoi_dimensions="3D")
    v1.inputs["Scale"].default_value = 1.0 / size
    v1.inputs["Smoothness"].default_value = 0.6
    nb.link(co, v1.inputs["Vector"])
    v2 = nb.n("ShaderNodeTexVoronoi", feature="SMOOTH_F1", voronoi_dimensions="3D")
    v2.inputs["Scale"].default_value = 2.7 / size
    v2.inputs["Smoothness"].default_value = 0.5
    nb.link(co, v2.inputs["Vector"])
    h = nb.add(nb.mul(nb.sub(1.0, v1.outputs["Distance"]), 1.0), nb.mul(nb.sub(1.0, v2.outputs["Distance"]), 0.4))
    bmp = nb.n("ShaderNodeBump", inputs={"Strength": strength, "Distance": size * 0.35})
    nb.inp(bmp, "Height", h)
    return bmp.outputs[0]


def _light(nb, translucent=0.0, nrm=None):
    """Captured moon/sky irradiance (Shader to RGB) and its luminance."""
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1), "Roughness": 0.0})
    if nrm is not None:
        nb.inp(dif, "Normal", nrm)
    sh = dif.outputs[0]
    if translucent > 0:
        tr = nb.n("ShaderNodeBsdfTranslucent", inputs={"Color": (translucent,) * 3})
        ad = nb.n("ShaderNodeAddShader")
        nb.link(sh, ad.inputs[0])
        nb.link(tr.outputs[0], ad.inputs[1])
        sh = ad.outputs[0]
    s2r = nb.n("ShaderNodeShaderToRGB")
    nb.link(sh, s2r.inputs[0])
    return s2r.outputs["Color"], nb.bw(s2r.outputs["Color"])


def cloud_night_mat(name="CloudNight", scale=0.008, edge=0.6, fog_near=None, fog_far=None, translucent=0.35,
                    brush="strokes_soft", tex_amt=1.0, billow=6.0, billow_amt=0.7):
    """Moonlit painterly cloud: three painted tones (flat cool shade / mid / moonlit top) chosen by the captured
    moon light with broad soft brush breakup, big value patches across the sea, a silvery glow on silhouettes,
    soft brushy semi-transparent edges (edge > 0), fog by distance. Object coords are world metres (the heaps and
    the floor live at the origin) so the brushwork is one continuous painting across the sea."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    from .sky import _rgb, _vadd, _vscale, CURRENT
    C = _CL()
    band, baz, moon = _band()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    tc = nb.n("ShaderNodeTexCoord")
    co = tc.outputs["Object"]
    st = mat.tex_node(nb, brush, co, scale)
    sp = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]})
    s_val, s_jit = sp.outputs[0], sp.outputs[1]
    st2 = mat.tex_node(nb, "strokes_broad", co, scale * 0.42)
    s2 = nb.n("ShaderNodeSeparateColor", inputs={"Color": st2.outputs["Color"]}).outputs[0]
    pn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 0.0045, "Detail": 3.0, "Roughness": 0.55})
    nb.link(co, pn.inputs["Vector"])
    patch = nb.mapr(pn.outputs["Fac"], 0.35, 0.65)
    nrm = _billow_normal(nb, co, billow, billow_amt) if billow_amt > 0 else None
    E, Lm = _light(nb, translucent, nrm)
    key = CURRENT.get("key_e", 1.0)
    brk = nb.add(nb.mul(nb.sub(s_val, 0.5), 0.6 * tex_amt), nb.mul(nb.sub(s2, 0.5), 0.4 * tex_amt))
    ao = nb.n("ShaderNodeAmbientOcclusion", inputs={"Distance": 22.0})
    occ = nb.add(0.72, nb.mul(ao.outputs["AO"], 0.28))       # hollows between the banks sink a little
    Lb = nb.add(nb.add(nb.mul(nb.math("DIVIDE", Lm, 0.32 * key + 0.06), occ), brk), nb.mul(nb.sub(patch, 0.5), 0.25))
    lit = nb.mapr(Lb, 0.45, 0.98)
    col = nb.mix(nb.mapr(Lb, 0.05, 0.50), _rgb(nb, C["shade"]), _rgb(nb, C["mid"]))
    col = nb.mix(lit, col, _rgb(nb, C["lit"]))
    # big value patches (some banks brighter, some in shadow) + brush value only in the light
    col = _vscale(nb, col, nb.add(0.82, nb.mul(patch, 0.36)))
    col = _vscale(nb, col, nb.add(1.0, nb.mul(nb.mul(nb.sub(s_val, 0.5), 0.32 * tex_amt), lit)))
    hue = nb.n("ShaderNodeHueSaturation")
    nb.inp(hue, "Color", col)
    nb.inp(hue, "Hue", nb.add(0.5, nb.mul(nb.sub(s_jit, 0.5), 0.03)))
    col = hue.outputs[0]
    # silhouettes glow silver (moonlit vapour), a bit more when the moon is behind them
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.4})
    g = nb.n("ShaderNodeNewGeometry")
    md = nb.n("ShaderNodeCombineXYZ", inputs={"X": moon.x, "Y": moon.y, "Z": moon.z})
    back = nb.sub(1.0, nb.mul(nb.math("MAXIMUM", nb.vmath("DOT_PRODUCT", g.outputs["Incoming"], md.outputs[0]), 0.0), 0.6))
    rim = nb.mapr(nb.add(lw.outputs["Facing"], nb.mul(nb.sub(s_val, 0.5), 0.35)), 0.5, 0.92)
    rim = nb.mul(nb.mul(rim, back), 0.42)
    col = _vadd(nb, col, _vscale(nb, _rgb(nb, C["rim"]), nb.mul(rim, nb.add(0.35, nb.mul(lit, 0.65)))))
    col, f = _fog(nb, col, fog_near or C.get("fog_near", 250.0), fog_far or C.get("fog_far", 3800.0))
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    surf = em.outputs[0]
    if edge > 0:
        lw2 = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
        e = nb.add(lw2.outputs["Facing"], nb.mul(nb.add(nb.mul(nb.sub(s_val, 0.5), 0.7), nb.mul(nb.sub(s2, 0.5), 0.5)), edge))
        alpha = nb.mapr(e, 1.0 - 0.6 * edge, 0.97, 1.0, 0.0)
        tr = nb.n("ShaderNodeBsdfTransparent")
        mx = nb.n("ShaderNodeMixShader")
        nb.inp(mx, "Fac", alpha)
        nb.link(tr.outputs[0], mx.inputs[1])
        nb.link(surf, mx.inputs[2])
        surf = mx.outputs[0]
        m.surface_render_method = "DITHERED"
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(surf, out.inputs["Surface"])
    return m


def massif_night_mat(name="MassifNight"):
    """Moonlit painted mountains: snow/rock from the 'tint' attribute, flat cool shadow sides, vertical brush
    strokes in the light, strong distance fog (far ranges become soft painted silhouettes)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    from .sky import _rgb, _vadd, _vscale, CURRENT
    C = _CL()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    tc = nb.n("ShaderNodeTexCoord")
    st = mat.tex_node(nb, "strokes_vert", tc.outputs["Object"], 0.0045)
    sp = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]})
    s_val, s_jit = sp.outputs[0], sp.outputs[1]
    st2 = mat.tex_node(nb, "strokes_broad", tc.outputs["Object"], 0.0016)
    s2 = nb.n("ShaderNodeSeparateColor", inputs={"Color": st2.outputs["Color"]}).outputs[0]
    va = nb.n("ShaderNodeAttribute", attribute_name="tint", attribute_type="GEOMETRY")
    snow = nb.mapr(nb.add(nb.bw(va.outputs["Color"]), nb.mul(nb.sub(s_val, 0.5), 0.55)), 0.5, 0.62)
    E, Lm = _light(nb)
    key = CURRENT.get("key_e", 1.0)
    Lb = nb.add(nb.math("DIVIDE", Lm, 0.32 * key + 0.06), nb.mul(nb.sub(s_val, 0.5), 0.6))
    lit = nb.mapr(Lb, 0.32, 0.62)          # crisp painted light / shadow planes
    rock = nb.mix(lit, _rgb(nb, (0.010, 0.026, 0.038)), _rgb(nb, C.get("rock", (0.03, 0.105, 0.11))))
    sn = nb.mix(lit, _rgb(nb, (0.030, 0.058, 0.085)), _rgb(nb, C.get("snow", (0.27, 0.40, 0.47))))
    col = nb.mix(snow, rock, sn)
    col = _vscale(nb, col, nb.add(1.0, nb.mul(nb.add(nb.mul(nb.sub(s_val, 0.5), 0.5), nb.mul(nb.sub(s2, 0.5), 0.35)),
                                             nb.add(0.3, nb.mul(lit, 0.7)))))
    hue = nb.n("ShaderNodeHueSaturation")
    nb.inp(hue, "Color", col)
    nb.inp(hue, "Hue", nb.add(0.5, nb.mul(nb.sub(s_jit, 0.5), 0.05)))
    col = hue.outputs[0]
    col, f = _fog(nb, col, 900.0, 5600.0, power=1.0, max_fog=0.85)
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(em.outputs[0], out.inputs["Surface"])
    return m


def mist_mat(name="CloudMistMat"):
    """Soft drifting mist veil for flat cards: brushy breathing alpha, moonlit top, fades edge-on and near camera."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    from .sky import _rgb, _vadd, _vscale, _time
    C = _CL()
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    t = m.node_tree
    t.nodes.clear()
    nb = mat.NB(t)
    tc = nb.n("ShaderNodeTexCoord")
    gen = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": tc.outputs["Generated"]})
    gx, gy = nb.sub(gen.outputs[0], 0.5), nb.sub(gen.outputs[2], 0.5)
    r = nb.math("SQRT", nb.add(nb.mul(nb.mul(gx, gx), 4.0), nb.mul(nb.mul(gy, gy), 4.0)))
    shape = nb.mapr(r, 1.0, 0.25)
    oi = nb.n("ShaderNodeObjectInfo")
    T = _time(nb)
    pv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(pv, "X", nb.add(nb.mul(gen.outputs[0], 2.6), nb.add(nb.mul(T, 0.012), nb.mul(oi.outputs["Random"], 31.0))))
    nb.inp(pv, "Y", nb.mul(gen.outputs[2], 1.3))
    nb.inp(pv, "Z", nb.add(nb.mul(T, 0.02), nb.mul(oi.outputs["Random"], 7.0)))
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 2.2, "Detail": 2.0, "Roughness": 0.6, "Distortion": 0.0})
    nb.link(pv.outputs[0], nz.inputs["Vector"])
    st = nb.n("ShaderNodeTexImage", image=mat.image("strokes_horiz"), interpolation="Cubic", extension="REPEAT")
    nb.link(pv.outputs[0], st.inputs[0])
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    dens = nb.mapr(nb.add(nz.outputs["Fac"], nb.mul(nb.sub(sv, 0.5), 0.35)), 0.34, 0.62)
    g = nb.n("ShaderNodeNewGeometry")
    face = nb.math("ABSOLUTE", nb.vmath("DOT_PRODUCT", g.outputs["Normal"], g.outputs["Incoming"]))
    cam = nb.n("ShaderNodeCameraData")
    near = nb.mapr(cam.outputs["View Distance"], 12.0, 60.0)
    amt = nb.n("ShaderNodeAttribute", attribute_name="mist", attribute_type="OBJECT").outputs["Fac"]
    alpha = nb.mul(nb.mul(nb.mul(nb.mul(nb.math("POWER", shape, 1.1), dens), nb.mapr(face, 0.03, 0.35)), near), amt)
    alpha = nb.math("MINIMUM", nb.mul(alpha, 1.5), 0.9)
    top = nb.mapr(gen.outputs[2], 0.15, 0.95)
    col = nb.mix(nb.add(nb.mul(top, 0.6), nb.mul(nb.sub(sv, 0.5), 0.5)), _rgb(nb, C["shade"]), _rgb(nb, C["mid"]))
    col = nb.mix(nb.mul(top, 0.35), col, _rgb(nb, C["lit"]))
    col, f = _fog(nb, col, C.get("fog_near", 250.0), C.get("fog_far", 3800.0))
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
    m.use_backface_culling = False
    return m


# ====================================================================== v1 materials (other presets)
def cloud_mat(name="Cloud", tint=(1.0, 0.98, 0.96)):
    if _night():
        return cloud_night_mat("CloudNight", scale=0.009, edge=0.85, fog_near=60.0, fog_far=2600.0, billow=16.0,
                               billow_amt=0.3, translucent=0.6)
    m = bpy.data.materials.get(name)
    if m:
        return m
    return mat.painterly(name, tint, stroke="strokes_broad", scale=0.035, tex_amt=0.7, hue_jit=0.03, bump=0.0,
                         breakup=1.6, wrap=0.65, translucent=0.25, edge_break=0.55, edge_soft=0.35, rim=0.5,
                         rim_col=(1.0, 0.9, 0.8))


def _metaball_mesh(name, balls, res, collection):
    mb = bpy.data.metaballs.new(name)
    mb.resolution = res
    mb.render_resolution = res
    mb.threshold = 0.6
    ob = bpy.data.objects.new(name, mb)
    collection.objects.link(ob)
    for (x, y, z, r, sz) in balls:
        el = mb.elements.new()
        el.co = (x, y, z)
        el.radius = r
        el.type = "ELLIPSOID"
        el.size_x, el.size_y, el.size_z = 1.0, 1.0, sz
        el.stiffness = 1.2
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.metaballs.remove(mb)
    mo = bpy.data.objects.new(name + "_m", me)
    collection.objects.link(mo)
    me.shade_smooth()
    return mo


def sea(level=-27.0, r_in=34.0, r_out=420.0, seed=7, collection=None, mat_=None, cell=40.0, density=0.9,
        exclude=None, mist_wisps=True):
    """Cumulus heaps on a ring around the peak (+ at night: drifting mist wisps, see mist()). Returns the heaps."""
    rng = np.random.default_rng(seed)
    col = collection or geo.coll("Clouds")
    m = mat_ or cloud_mat()
    night = _night()
    if night:
        cell = max(cell, 50.0)
    objs = []
    n = int(r_out / cell) + 1
    k = 0
    for gy in range(-n, n + 1):
        for gx in range(-n, n + 1):
            cx, cy = (gx + rng.uniform(-0.4, 0.4)) * cell, (gy + rng.uniform(-0.4, 0.4)) * cell
            r = math.hypot(cx, cy)
            if r < r_in or r > r_out or rng.random() > density:
                continue
            if exclude and exclude(cx, cy):
                continue
            far = (r - r_in) / (r_out - r_in)
            nb = int(rng.integers(5, 10)) if night else int(rng.integers(7, 14))
            balls = []
            for _ in range(nb):
                rr = rng.uniform(11, 22) * (1 + far * 1.2) if night else rng.uniform(7, 16) * (1 + far * 1.2)
                bx = cx + rng.normal(0, cell * 0.3)
                by = cy + rng.normal(0, cell * 0.3)
                bz = level + rng.normal(0, 2.0) - rr * 0.15
                balls.append((bx, by, bz, rr, rng.uniform(0.30, 0.46) if night else rng.uniform(0.45, 0.7)))
            # a few towering puffs (night: more, the sea has volume and value variation)
            if night and rng.random() < 0.35:
                # a broad billowing tower: stacked, overlapping domes (cauliflower), not a knob
                rr = rng.uniform(16, 26)
                balls.append((cx, cy, level + rr * 0.25, rr, 0.75))
                for _ in range(int(rng.integers(2, 4))):
                    balls.append((cx + rng.normal(0, rr * 0.35), cy + rng.normal(0, rr * 0.35),
                                  level + rr * rng.uniform(0.45, 0.7), rr * rng.uniform(0.5, 0.7), 0.85))
            elif not night and rng.random() < 0.25:
                rr = rng.uniform(10, 18)
                balls.append((cx, cy, level + rr * 0.6, rr, 1.0))
            res = 1.1 + far * 4.0
            o = _metaball_mesh(f"CloudHeap{k:03d}", balls, res, col)
            if night:
                geo.displace_noise(o, 0.7 + far * 2.0, 16 + far * 22, seed=k)
            else:
                geo.displace_noise(o, 1.6 + far * 4, 7 + far * 15, seed=k)
            o.data.materials.append(m)
            o.visible_shadow = False
            objs.append(o)
            k += 1
    if night and mist_wisps:
        mist(collection=col, seed=seed + 100)
    return objs


def _billow(x, y, seed, scale):
    rng = np.random.default_rng(seed)
    acc = np.zeros_like(x)
    amp, tot = 1.0, 0.0
    sc = scale
    for i in range(4):
        k1 = rng.normal(0, 1, 2)
        k2 = rng.normal(0, 1, 2)
        ph = rng.random(2) * 6.28
        n = np.sin((x * k1[0] + y * k1[1]) / sc + ph[0]) * np.cos((x * k2[0] - y * k2[1]) / sc + ph[1])
        acc += amp * (1 - np.abs(n)) ** 1.6       # rounded billows
        tot += amp
        amp *= 0.5
        sc *= 0.47
    return acc / tot


def floor(level=-38.0, r_in=55.0, r_out=9000.0, collection=None, mat_=None, seed=3):
    """A continuous sea of cloud tops: rolling billows (big swells + puffs), denser near the peak, fading to a
    soft horizon. Painterly-shaded like the heaps (lit tops, cool valleys). At night it stops inside the camera
    clip (R_FAR) and the sky's painted horizon carries the sea on (same haze colour)."""
    col = collection or geo.coll("Clouds")
    night = _night()
    if night:
        r_out = min(r_out, R_FAR)
    rings = np.concatenate([np.geomspace(r_in, 1500, 90), np.geomspace(1500, r_out, 40)[1:]])
    seg = 360
    a = np.linspace(0, 2 * math.pi, seg, endpoint=False)
    R, A = np.meshgrid(rings, a, indexing="ij")
    X, Y = R * np.cos(A), R * np.sin(A)
    big = _billow(X, Y, seed, 160.0)
    mid = _billow(X, Y, seed + 1, 45.0)
    near = np.clip(1 - (R - 300) / 2500, 0.25, 1.0)
    if night:
        H = level + (big * 34 + mid * 5 * near - 16) * np.clip((R - r_in) / 80, 0.3, 1.0)
    else:
        H = level + (big * 34 + mid * 12 * near - 18) * np.clip((R - r_in) / 80, 0.3, 1.0)
    if night:
        # long swells (wind-combed rows) + a gentle drop toward the horizon so the sea reads as a vast floor
        swell = np.sin((X * 0.8 + Y * 0.6) / 230.0 + 1.3) * np.sin((X * -0.3 + Y) / 610.0)
        H = H + swell * 9.0 * near - np.clip((R - 1500) / 3300, 0, 1) * 30.0
    verts = np.stack([X.ravel(), Y.ravel(), H.ravel()], 1)
    faces = []
    for i in range(len(rings) - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append((i * seg + j, i * seg + j2, (i + 1) * seg + j2, (i + 1) * seg + j))
    if night:
        m = mat_ or cloud_night_mat("CloudFloorNight", scale=0.006, edge=0.0, translucent=0.3, billow=40.0,
                                    billow_amt=0.3)
    else:
        m = mat_ or bpy.data.materials.get("CloudFloor") or mat.painterly(
            "CloudFloor", (1.0, 0.98, 0.96), stroke="strokes_broad", scale=0.03, tex_amt=0.8, hue_jit=0.03, bump=0.0,
            breakup=1.6, wrap=0.65, translucent=0.2, rim=0.4, rim_col=(1.0, 0.9, 0.8))
    o = geo.obj_from("CloudFloor", verts, faces, col, m)
    o.visible_shadow = False
    return o


def mist(collection=None, seed=107, amount=1.0, drift=True):
    """Drifting mist wisps (night): veils banked over the cloud sea round the peak, flat sheets lying on it (read
    from above, SH16) and long banks wrapping the bases of the distant peaks. Slowly drifts (driver on a rig)."""
    col = collection or geo.coll("Clouds")
    rng = np.random.default_rng(seed)
    m = mist_mat()
    rig = bpy.data.objects.new("CloudMistRig", None)
    col.objects.link(rig)
    if drift:
        fc = rig.driver_add("rotation_euler", 2)
        fc.driver.type = "SCRIPTED"
        fc.driver.expression = "frame*0.00005"
    out = []

    def card(name, c, w, h, yaw, tilt=0.0, amt=1.0):
        verts = [(-w / 2, 0, -h / 2), (w / 2, 0, -h / 2), (w / 2, 0, h / 2), (-w / 2, 0, h / 2)]
        o = geo.obj_from(name, verts, [(0, 1, 2, 3)], col, m, smooth=False)
        o.location = c
        o.rotation_euler = (tilt, 0, yaw)
        o.parent = rig
        o["mist"] = amt * amount
        o.visible_shadow = False
        out.append(o)
        return o

    # veils banked round the peak, facing it (seen layered against the sea from the meadow / gallery)
    for i in range(28):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(60, 420)
        c = (r * math.cos(a), r * math.sin(a), rng.uniform(-30, -12) + r * 0.012)
        w = rng.uniform(60, 190) * (0.6 + r / 420)
        card(f"CloudMistV{i:02d}", c, w, w * rng.uniform(0.16, 0.3), a + math.pi / 2 + rng.normal(0, 0.35),
             amt=rng.uniform(0.45, 0.9))
    # sheets lying on the sea (read from above)
    for i in range(16):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(70, 650)
        c = (r * math.cos(a), r * math.sin(a), rng.uniform(-24, -14))
        w = rng.uniform(120, 360)
        card(f"CloudMistS{i:02d}", c, w, w * rng.uniform(0.35, 0.6), rng.uniform(0, 6.28), tilt=math.pi / 2,
             amt=rng.uniform(0.35, 0.7))
    # long banks wrapping the distant peaks' feet
    for i, (az, d, w) in enumerate(_MIST_BANKS):
        aa = math.radians(az)
        c = (d * math.cos(aa), d * math.sin(aa), rng.uniform(10, 60))
        card(f"CloudMistF{i:02d}", c, w, w * rng.uniform(0.10, 0.16), aa + math.pi / 2, amt=rng.uniform(0.7, 1.0))
    return out


_MIST_BANKS = [(95, 1150, 1500), (108, 1250, 900), (70, 1450, 1100), (88, 2300, 2200), (255, 1150, 1300),
               (282, 1700, 1500), (10, 1350, 1300), (160, 1300, 1200), (200, 2400, 1700), (330, 2400, 1500),
               (45, 2700, 1600), (135, 2700, 1600), (225, 1600, 1200)]


def peaks(collection=None, seed=5, level=-34.0, preset_far=True):
    """Distant mountain peaks poking through the clouds (painterly rock + snow)."""
    col = collection or geo.coll("Peaks")
    rng = np.random.default_rng(seed)
    rock = mat.painterly("FarRock", (0.30, 0.28, 0.34), stroke="strokes_vert", scale=0.012, tex_amt=1.0,
                         breakup=1.5, color2=(0.85, 0.86, 0.95), edge_break=0.25)
    out = []
    specs = [(-1300, 1500, 260, 1.0), (-700, 2300, 380, 1.3), (300, 2600, 300, 1.1), (1500, 1900, 420, 1.4),
             (2400, 900, 260, 0.9), (-2300, 600, 300, 1.0), (900, -2600, 350, 1.2), (-1800, -1700, 300, 1.0),
             (2600, -1200, 240, 0.8), (-2800, 2200, 420, 1.2), (150, 3800, 520, 1.5)]
    for i, (x, y, h, w) in enumerate(specs):
        prof = []
        for k in range(18):
            z = k / 17
            r = (1 - z) ** 1.25 * h * 0.9 * w + 6
            prof.append((r, level - 60 + z * (h + 60)))
        o = geo.lathe(f"Peak{i}", prof, seg=40, collection=col, mat=rock, jitter=0.0, seed=i)
        geo.displace_noise(o, h * 0.14, h * 0.18, seed=i)
        o.location = (x, y, 0)
        o.rotation_euler = (0, 0, rng.uniform(0, 6.28))
        o.scale = (1.0, rng.uniform(0.7, 1.2), 1.0)
        out.append(o)
    return out


def massif(name, center, width=1400.0, height=420.0, seed=0, level=-34.0, res=150, collection=None, octaves=6,
           sharp=2.2):
    """A ridged, snow-capped mountain massif (heightfield) rising out of the cloud sea.
    (v1 convention kept: centre x/y are scaled by 1.2 and the height by 0.72.)"""
    height *= 0.72
    center = (center[0] * 1.2, center[1] * 1.2, center[2])
    col = collection or geo.coll("Peaks")
    rng = np.random.default_rng(seed)
    n = res
    xs = np.linspace(-0.5, 0.5, n)
    X, Y = np.meshgrid(xs, xs)
    h = np.zeros_like(X)
    amp, f = 1.0, 2.2
    for o in range(octaves):
        k = rng.normal(0, 1, (2,))
        ph = rng.random(2) * 6.28
        nse = np.sin((X * k[0] + Y * k[1]) * f * 6.28 + ph[0]) * np.cos((X * k[1] - Y * k[0]) * f * 6.28 + ph[1])
        h += amp * (1 - np.abs(nse))  # ridged
        amp *= 0.5
        f *= 2.05
    h /= 1.9
    r = np.hypot(X * rng.uniform(0.8, 1.2), Y * rng.uniform(0.8, 1.2)) * 2
    fall = np.clip(1 - r, 0, 1) ** 1.3
    peak_bias = np.exp(-((X - rng.uniform(-0.12, 0.12)) ** 2 + (Y - rng.uniform(-0.12, 0.12)) ** 2) / 0.03)
    Z = (h ** sharp * 0.7 + peak_bias * 0.6) * fall
    Z = Z / max(Z.max(), 1e-6)
    verts = np.stack([X.ravel() * width, Y.ravel() * width, (Z.ravel() * height + level - 60)], 1)
    faces = [(j * n + i, j * n + i + 1, (j + 1) * n + i + 1, (j + 1) * n + i) for j in range(n - 1) for i in range(n - 1)]
    o = geo.obj_from(name, verts, faces, col, None)
    o.location = center
    o.rotation_euler = (0, 0, rng.uniform(0, 6.28))
    # snow vs rock by height and slope
    me = o.data
    nz = np.array([v.normal.z for v in me.vertices])
    zz = Z.ravel()
    snow = np.clip((zz - 0.45) / 0.12, 0, 1) * np.clip((nz - 0.35) / 0.25, 0, 1)
    snow = np.maximum(snow, np.clip((zz - 0.8) / 0.1, 0, 1) * 0.8)
    rock = np.array([0.30, 0.29, 0.36])
    sn = np.array([0.92, 0.92, 0.98])
    cc = rock[None, :] * (1 - snow[:, None]) + sn[None, :] * snow[:, None]
    att = me.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.concatenate([cc, np.ones((len(cc), 1))], 1).ravel())
    if _night():
        m = massif_night_mat()
    else:
        m = bpy.data.materials.get("Massif") or mat.painterly("Massif", (1, 1, 1), stroke="strokes_vert", scale=0.004,
                                                               tex_amt=1.2, breakup=1.6, vcol="tint", bump=0.0)
    me.materials.append(m)
    o.visible_shadow = False
    return o


# night layout: (azimuth deg, distance m, width m, height m, seed) -> three receding layers; a gap due north under
# the constellation, framed by a near peak on each side (as seen from the meadow / gallery)
NIGHT_MASSIFS = [
    # near layer (~1.4-2 km): contrast, snow detail
    (110, 1600, 1150, 560, 21), (70, 1850, 1000, 430, 22), (252, 1500, 1200, 520, 23), (12, 1750, 1300, 470, 24),
    (162, 1650, 1150, 500, 25), (205, 2000, 1100, 460, 33),
    # mid layer (~2.6-3.2 km)
    (93, 3000, 1500, 780, 26), (284, 2700, 1350, 660, 27), (135, 3100, 1300, 760, 28), (330, 3000, 1250, 700, 29),
    (40, 3150, 1350, 740, 34),
    # far layer (~4 km): tall, pale, almost sky
    (80, 4150, 1000, 1150, 30), (104, 4100, 1050, 1080, 31), (268, 4050, 1100, 1050, 32), (225, 4000, 1100, 1000, 35),
]


def massifs(collection=None):
    if _night():
        out = []
        for i, (az, d, w, h, s) in enumerate(NIGHT_MASSIFS):
            a = math.radians(az)
            c = (d * math.cos(a) / 1.2, d * math.sin(a) / 1.2, 0)
            w = min(w, (R_FAR - d) / 0.72)
            out.append(massif(f"Massif{i}", c, w, h * 0.78, seed=s, collection=collection, res=170 if d < 2500 else 130,
                              octaves=5 if d < 2500 else 4, sharp=1.9))
        return out
    specs = [((-1700, 1900, 0), 1500, 420, 1), ((-700, 3000, 0), 1900, 560, 2), ((900, 2600, 0), 1400, 400, 3),
             ((2100, 1500, 0), 1700, 600, 4), ((2600, -300, 0), 1200, 380, 5), ((-2500, 300, 0), 1500, 450, 6),
             ((-2000, -2000, 0), 1600, 450, 7), ((1300, -2700, 0), 1500, 430, 8), ((-200, 4600, 0), 2600, 760, 9),
             ((3800, 2600, 0), 2200, 700, 10), ((-3900, 2400, 0), 2200, 760, 11)]
    return [massif(f"Massif{i}", c, w, h, seed=s, collection=collection) for i, (c, w, h, s) in enumerate(specs)]
