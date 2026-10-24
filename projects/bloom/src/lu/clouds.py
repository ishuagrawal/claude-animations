"""BLOOM's 3D clouds: the towering cumulonimbus storm wall that rolls in from layout.STORM_FROM (B05-B13).

  S = storm_wall(advance=0.3)        build it (metaball towers -> mesh: flat dark base, billowing columns, cauliflower
                                     tops, anvils spreading toward the valley; rain shafts hanging under the base)
  storm_advance(S, f0, f1, a0, a1)   key it rolling in (advance 0 = 3 km out, rising over the west ridge (B05); 0.4 =
                                     looming over the valley's west side; 0.8 = its front over the valley; 1 = overhead)
World builds it for "threat" (advance 0.3) and "storm" (0.85); W.storm_advance(...) keys both the 3D wall and the
painted sky deck. While it exists the sky's painted wall is switched off (sky control Wall = 0).

Shading (emission only, painterly): a virtual key from above the sun's side so the towers model (lit cauliflower
tops, dark bellies and base) whatever the camera, billow bumps at three scales, three painted tones from the sky
palette (StormDark / mid / StormLit), lighter rims on the silhouettes, internal lightning glow where sky.flash()
points (FlashAz) driven by the sky's Flash control, distance haze, brushed broken edges.
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, mat, layout, sky

NB = mat.NB
CENTER = Vector((20.0, 60.0, 0.0))
D_FAR, D_NEAR = 3000.0, 400.0
BASE_Z = 380.0


def _pos_for(advance):
    us = sky.storm_vec()
    d = D_FAR + (D_NEAR - D_FAR) * advance
    return CENTER + us * d


def _scale(nb, c, k):
    m = nb.n("ShaderNodeVectorMath", operation="SCALE")
    nb.inp(m, 0, c)
    nb.inp(m, "Scale", k)
    return m.outputs[0]


def _vadd(nb, a, b):
    m = nb.n("ShaderNodeVectorMath", operation="ADD")
    nb.inp(m, 0, a)
    nb.inp(m, 1, b)
    return m.outputs[0]


def _gauss(nb, x, w):
    q = nb.math("DIVIDE", x, w)
    return nb.math("EXPONENT", nb.mul(nb.mul(q, q), -1.0))


def storm_mat(name="StormCloud"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    P = sky.pal_node(nb)
    C = sky.ctl_node(nb)
    geo_ = nb.n("ShaderNodeNewGeometry")
    pos = geo_.outputs["Position"]
    co = nb.n("ShaderNodeTexCoord").outputs["Object"]
    h = None
    for sc_, k in ((1.0 / 230.0, 1.0), (1.0 / 85.0, 0.45), (1.0 / 32.0, 0.15)):
        v = nb.n("ShaderNodeTexVoronoi", feature="SMOOTH_F1", voronoi_dimensions="3D")
        v.inputs["Scale"].default_value = sc_
        v.inputs["Smoothness"].default_value = 0.7
        nb.link(co, v.inputs["Vector"])
        t = nb.mul(nb.sub(1.0, v.outputs["Distance"]), k)
        h = t if h is None else nb.add(h, t)
    bmp = nb.n("ShaderNodeBump", inputs={"Strength": 0.85, "Distance": 60.0})
    nb.inp(bmp, "Height", h)
    N = bmp.outputs[0]
    sd = sky.sun_vec()
    L = Vector((sd.x * 0.55, sd.y * 0.55, 1.0)).normalized()
    lv = nb.n("ShaderNodeCombineXYZ", inputs={"X": L.x, "Y": L.y, "Z": L.z}).outputs[0]
    lam = nb.vmath("DOT_PRODUCT", N, lv)
    zw = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": pos}).outputs[2]
    hz = nb.mapr(zw, BASE_Z, BASE_Z + 2300.0)
    ao = nb.n("ShaderNodeAmbientOcclusion", inputs={"Distance": 160.0}).outputs["AO"]
    st = mat.tex_node(nb, "strokes_soft", co, 0.006)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    st2 = mat.tex_node(nb, "strokes_broad", co, 0.0012)
    sv2 = nb.n("ShaderNodeSeparateColor", inputs={"Color": st2.outputs["Color"]}).outputs[0]
    lit = nb.add(nb.add(nb.mul(lam, 0.72), nb.mul(hz, 0.38)), nb.add(nb.mul(ao, 0.2), -0.3))
    lit = nb.add(lit, nb.add(nb.mul(nb.sub(sv, 0.5), 0.22), nb.mul(nb.sub(sv2, 0.5), 0.18)))
    base_dark = nb.mapr(zw, BASE_Z + 260.0, BASE_Z)
    lit = nb.sub(lit, nb.mul(base_dark, 0.35))
    dark, lite = P.outputs["StormDark"], P.outputs["StormLit"]
    indigo = nb.mix(0.5, dark, (0.03, 0.035, 0.11))
    dark_g = nb.mix(hz, indigo, dark)                      # bruised: indigo at the base, violet up the towers
    mid = nb.mix(0.42, dark, lite)
    col = nb.mix(nb.mapr(lit, 0.1, 0.5), dark_g, mid)
    col = nb.mix(nb.mapr(lit, 0.48, 0.92), col, lite)
    col = _scale(nb, col, nb.add(1.0, nb.mul(nb.mul(nb.sub(sv, 0.5), 0.3), nb.mapr(lit, 0.3, 0.8))))
    hue = nb.n("ShaderNodeHueSaturation")
    nb.inp(hue, "Color", col)
    nb.inp(hue, "Hue", nb.add(0.5, nb.mul(nb.sub(sv2, 0.5), 0.03)))
    col = hue.outputs[0]
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.2})
    rim = nb.mul(nb.mapr(nb.add(lw.outputs["Facing"], nb.mul(nb.sub(sv, 0.5), 0.15)), 0.8, 0.98), nb.mapr(hz, 0.2, 0.6))
    rim = nb.mul(rim, nb.mapr(lam, 0.0, 0.5))
    col = _vadd(nb, col, _scale(nb, P.outputs["StormRim"], nb.mul(rim, 0.35)))
    col = _vadd(nb, col, _scale(nb, P.outputs["SunGlow"], nb.mul(nb.mul(nb.mapr(lam, 0.65, 1.0), nb.mapr(hz, 0.3, 0.8)), 0.12)))
    # internal lightning toward FlashAz (sky.flash / fx.lightning set it), driven by the sky's Flash control
    rel = nb.vmath("SUBTRACT", pos, (CENTER.x, CENTER.y, 0.0))
    rs = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": rel})
    az = nb.math("ARCTAN2", rs.outputs[1], rs.outputs[0])
    faz = nb.mul(C.outputs["FlashAz"], math.pi / 180.0)
    da = nb.math("ARCCOSINE", nb.math("COSINE", nb.sub(az, faz)))
    blob = nb.mul(_gauss(nb, da, 0.07), _gauss(nb, nb.sub(zw, BASE_Z + 650.0), 380.0))
    blob = nb.mul(blob, nb.add(0.3, nb.mul(nb.mapr(lam, -0.2, 0.6), 0.9)))
    glow = nb.mul(C.outputs["Flash"], nb.add(nb.mul(blob, 0.9), nb.mul(nb.mapr(hz, 0.0, 0.5), 0.06)))
    glow = nb.mul(glow, nb.add(0.5, nb.mul(sv, 0.8)))
    col = _vadd(nb, col, _scale(nb, P.outputs["FlashC"], glow))
    cam = nb.n("ShaderNodeCameraData")
    fz = nb.mul(nb.mapr(cam.outputs["View Distance"], 1500.0, 5000.0), 0.18)
    col = nb.mix(fz, col, P.outputs["Haze"])
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    lw2 = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    e = nb.add(lw2.outputs["Facing"], nb.mul(nb.sub(sv, 0.5), 0.5))
    alpha = nb.mapr(e, 1.0, 0.86, 0.0, 1.0)
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", alpha)
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "DITHERED"
    return m


def _rain_shaft_mat(name="StormRain"):
    m = bpy.data.materials.get(name)
    if m:
        return m
    from . import envmat
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    P = sky.pal_node(nb)
    E = envmat.env(nb)
    gen = nb.n("ShaderNodeTexCoord").outputs["Generated"]
    gs = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen})
    gx, gz = gs.outputs[0], gs.outputs[2]
    oi = nb.n("ShaderNodeObjectInfo")
    v = nb.n("ShaderNodeCombineXYZ")
    nb.inp(v, "X", nb.add(nb.mul(gx, 2.5), nb.mul(oi.outputs["Random"], 9.0)))
    nb.inp(v, "Y", nb.add(nb.mul(gz, 0.35), nb.mul(E.outputs["Time"], 0.15)))
    st = mat.tex_node(nb, "strokes_vert", v.outputs[0], 1.0)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 2.5, "Detail": 2.0})
    v2 = nb.n("ShaderNodeCombineXYZ")
    nb.inp(v2, "X", nb.mul(gx, 3.0))
    nb.inp(v2, "Y", nb.add(nb.mul(gz, 0.8), nb.mul(E.outputs["Time"], 0.05)))
    nb.inp(v2, "Z", nb.mul(oi.outputs["Random"], 7.0))
    nb.link(v2.outputs[0], nz.inputs["Vector"])
    a = nb.mapr(nb.add(nb.mul(sv, 0.6), nb.mul(nz.outputs["Fac"], 0.7)), 0.45, 0.85)
    shape = nb.mul(nb.mul(nb.mapr(gx, 0.0, 0.3), nb.mapr(gx, 1.0, 0.7)), nb.mul(nb.mapr(gz, 1.0, 0.85), nb.mapr(gz, 0.0, 0.3)))
    a = nb.mul(nb.mul(a, shape), 0.55)
    col = nb.mix(0.35, P.outputs["Rain"], P.outputs["StormDark"])
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    tr = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", a)
    nb.link(tr.outputs[0], mx.inputs[1])
    nb.link(em.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = False
    return m


def _metaball_mesh(name, balls, res, collection, thresh=0.42):
    mb = bpy.data.metaballs.new(name)
    mb.resolution = res
    mb.render_resolution = res
    mb.threshold = thresh
    ob = bpy.data.objects.new(name, mb)
    collection.objects.link(ob)
    for (x, y, z, r, sz) in balls:
        el = mb.elements.new()
        el.co = (x, y, z)
        el.radius = r
        el.type = "ELLIPSOID"
        el.size_x, el.size_y, el.size_z = 1.0, 1.0, sz
        el.stiffness = 1.3
    dg = bpy.context.evaluated_depsgraph_get()
    dg.update()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    bpy.data.objects.remove(ob)
    bpy.data.metaballs.remove(mb)
    mo = bpy.data.objects.new(name, me)
    collection.objects.link(mo)
    me.shade_smooth()
    return mo


def _tower(R, H, seed, seg=96, rows=72, squash_y=1.25, flare=1.35, lean=(0.0, 0.0)):
    """One cumulonimbus tower as (verts, quads): a lathe (wide flat base, column, rounded crown) covered in fused
    spherical billows at three scales (the union of spheres sitting on the surface -> cauliflower, with crisp
    crevices between the domes). Local coords, base at z = 0."""
    rng = np.random.default_rng(seed)
    t = np.linspace(0.0, 1.0, rows)
    zs = H * t
    # profile: flat base flaring out, narrower column, a broad rounded crown
    r = R * (0.88 + 0.08 * np.sin(t * 5.0 + seed))
    r = r + R * (flare - 0.9) * np.exp(-(t / 0.07) ** 2)
    crown = np.clip((t - 0.72) / 0.28, 0, 1)
    r = r * np.sqrt(np.clip(1 - crown ** 2, 0, 1)) * (1 + 0.15 * crown * (1 - crown))
    r[0] = R * flare * 0.98
    th = np.linspace(0, 2 * math.pi, seg, endpoint=False)
    TH, T = np.meshgrid(th, t)
    RR = r[:, None] * np.ones((1, seg))
    X = RR * np.cos(TH) + lean[0] * T ** 1.5
    Y = RR * np.sin(TH) * squash_y + lean[1] * T ** 1.5
    Z = zs[:, None] * np.ones((1, seg))
    P = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1)
    # normals of the lathe (radial + slope)
    dr = np.gradient(r, zs)
    Nn = np.stack([np.cos(TH).ravel(), (np.sin(TH) / squash_y).ravel(), -np.repeat(dr, seg)], 1)
    Nn /= np.linalg.norm(Nn, axis=1, keepdims=True)
    Nn[np.repeat(t, seg) > 0.995] = (0, 0, 1)
    # billows: seed points on the surface, three scales, union of spherical caps
    disp = np.zeros(len(P))
    up = np.repeat(t, seg)
    for (rad, count, k) in ((0.42 * R, 34, 1.0), (0.2 * R, 120, 0.85), (0.085 * R, 420, 0.6)):
        w = np.clip(up - 0.04, 0, 1) ** 0.5 * (1 + 0.6 * crown.repeat(seg))
        idx = rng.choice(len(P), size=count, replace=False, p=w / w.sum())
        S = P[idx] + Nn[idx] * rad * rng.uniform(-0.15, 0.25, (count, 1))
        rs = rad * rng.uniform(0.7, 1.3, count)
        best = np.zeros(len(P))
        for j0 in range(0, count, 60):
            d = np.linalg.norm(P[:, None, :] - S[None, j0:j0 + 60, :], axis=2)
            h = rs[None, j0:j0 + 60] * (1 - (d / rs[None, j0:j0 + 60]) ** 2)
            best = np.maximum(best, h.max(1))
        disp = disp + k * np.maximum(best, 0.0)
    disp = disp * np.clip(up / 0.06, 0, 1)                    # the base stays flat
    P = P + Nn * disp[:, None]
    P[:, 2] = np.maximum(P[:, 2], 0.0)
    j = np.arange(rows - 1)[:, None]
    i = np.arange(seg)[None, :]
    a = j * seg + i
    b = j * seg + (i + 1) % seg
    Q = np.stack([a, b, b + seg, a + seg], -1).reshape(-1, 4)
    # close the bottom with a flat cap (dark base) and the top with a pole
    nv = len(P)
    P = np.concatenate([P, [[lean[0], lean[1], 0.0], [lean[0], lean[1], H + disp[-seg:].mean()]]], 0)
    bot = [(nv, (k + 1) % seg, k, k) for k in range(seg)]
    top0 = (rows - 1) * seg
    topq = [(top0 + k, top0 + (k + 1) % seg, nv + 1, nv + 1) for k in range(seg)]
    Q = np.concatenate([Q, np.array(bot), np.array(topq)], 0)
    return P, Q


def storm_wall(advance=0.3, width=6400.0, seed=5, rain=True, name="StormWall", height=0.75):
    """Build the cumulonimbus wall (local frame: +X = toward where the storm comes from, +Y lateral, z up; the
    front at local x = 0). Returns dict(obj, rig (the Empty that moves it), rain [shaft cards])."""
    rng = np.random.default_rng(seed)
    col = geo.coll("Storm")
    specs = [(-2700, 0.5), (-1750, 0.75), (-700, 1.0), (350, 0.85), (1350, 0.95), (2350, 0.6), (3100, 0.45),
             (-3400, 0.4)]
    allv, allq, off = [], [], 0
    for ti, (v0, size) in enumerate(specs):
        R = (380 + 300 * size) * rng.uniform(0.9, 1.1) * (0.6 + 0.4 * height)
        H = (1000 + 1300 * size) * rng.uniform(0.9, 1.1) * height
        u0 = rng.uniform(500, 1000)
        P, Q = _tower(R, H, seed * 31 + ti, lean=(-rng.uniform(120, 320), rng.normal(0, 80)))
        P = P + np.array([u0, v0 + rng.normal(0, 120), BASE_Z])
        allv.append(P)
        allq.append(Q + off)
        off += len(P)
    # low cumulus lumps along the shelf between the towers
    for k in range(10):
        v0 = rng.uniform(-width / 2, width / 2)
        R = rng.uniform(250, 420)
        P, Q = _tower(R, R * rng.uniform(0.9, 1.5), seed * 97 + k, seg=48, rows=28, flare=1.5)
        P = P + np.array([rng.uniform(150, 600), v0, BASE_Z])
        allv.append(P)
        allq.append(Q + off)
        off += len(P)
    V = np.concatenate(allv, 0)
    Qa = np.concatenate(allq, 0)
    tris = Qa[Qa[:, 2] == Qa[:, 3]][:, :3]
    quads = Qa[Qa[:, 2] != Qa[:, 3]]
    me = bpy.data.meshes.new(name)
    me.from_pydata(V.tolist(), [], [tuple(q) for q in quads.tolist()] + [tuple(t) for t in tris.tolist()])
    me.validate()
    me.update()
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    geo.displace_noise(ob, 12.0, 60.0, seed=seed + 2)
    ob.data.materials.append(storm_mat())
    ob.visible_shadow = False
    rig = bpy.data.objects.new(name + "Rig", None)
    bpy.context.scene.collection.objects.link(rig)
    us = sky.storm_vec()
    rig.rotation_euler = (0.0, 0.0, math.atan2(us.y, us.x))
    rig.location = _pos_for(advance)
    ob.parent = rig
    rig["advance"] = advance
    out = dict(obj=ob, rig=rig, rain=[])
    if rain:
        m = _rain_shaft_mat()
        for k in range(14):
            v0 = rng.uniform(-width * 0.42, width * 0.42)
            u0 = rng.uniform(150, 1300)
            w = rng.uniform(260, 700)
            hgt = BASE_Z + 120.0
            verts = [(-w / 2, 0, -60), (w / 2, 0, -60), (w / 2 + 120, 0, hgt), (-w / 2 + 120, 0, hgt)]
            c = geo.obj_from(f"{name}Rain{k}", verts, [(0, 1, 2, 3)], col, m, smooth=False)
            c.parent = rig
            c.location = (u0, v0, 0.0)
            c.visible_shadow = False
            cam = bpy.context.scene.camera
            if cam:
                cn = c.constraints.new("LOCKED_TRACK")
                cn.target = cam
                cn.track_axis = "TRACK_NEGATIVE_Y"
                cn.lock_axis = "LOCK_Z"
            out["rain"].append(c)
    sky.key(None, Wall=0.0)
    return out


def storm_advance(S, f0, f1, a0, a1):
    """Key the 3D storm wall rolling in from advance a0 at frame f0 to a1 at f1."""
    rig = S["rig"] if isinstance(S, dict) else S
    for f, a in ((f0, a0), (f1, a1)):
        rig.location = _pos_for(a)
        rig["advance"] = a
        rig.keyframe_insert("location", frame=f)
    return rig
