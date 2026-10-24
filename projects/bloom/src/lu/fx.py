"""BLOOM's effects. Everything is deterministic: GN particle fields use closed-form motion driven by scene time (each
frame independent), the rest are keyed objects. Colours follow the sky palette (LU_SkyPal), so the same call reads
right in every phase.

Particle fields (Geometry Nodes, return the field object; each has a keyable amount: fx.amount(field, frame, value))
  ash_snow(center, size, count, f0, ...)       drifting ash flakes, falling slowly, wind-blown (wind=(x, y) m/s)
  wind_ash(center, size, count, f0, ...)       ash and grit streaming sideways in a gust (storm arrival)
  embers(center, size, count, f0, ...)         glowing embers rising, wobbling, flickering out
  rain(center, size, count, f0, ...)           rain streaks (aligned to fall + wind) + rain_splashes(center, r, n, f0)
  hail(center, radius, count, f0, ...)         hailstones falling, bouncing twice, lying a moment then melting, with an
                                               impact puff (ash/water) at every hit; lands on terrain AND rocks/props
  motes(center, size, count, f0, ...)          drifting dust motes (sunbeam), pollen(...) golden floating specks
  bloom_burst(f0, f1, ...)                     petals, leaves and pollen swirling up at the bloom wave front (uses the
                                               keyed LU_Bloom radius, call after world.bloom_wave)
Keyed / mesh effects
  dust_puff(at, frame, size=1, n=7, color=None)         footfall / impact puff (ash coloured by default)
  slide_dust(points)                                     dust for mountain.scree_slide's list of (pos, frame)
  sparks(origin, frame, n, ...)                          ember sparks bursting from a point
  smoke_column(at, height, ...), smoke_wisps(center, r, n, ...)   painted smoke billboards (animated shader)
  lightning(frame, start=None, end=None, ...)            forked bolt + light + sky flash + wet-surface flash
  chips(origin, frame, n=7, direction=None, ...)         orange shell chips + pale clay crumbs flying off a point
  sunbeam(target=PEAK_SOIL, radius=2.6, ...)             the volumetric golden shaft (keyable open/close) + motes
  rain_sheets(center, radius, n, f0, ...)                big rain curtains (scrolling streak cards facing the camera)
  petal_burst(origin, frame, n, ...), pollen_burst(...)  bursts that flutter down and settle
  falling_petal(target, f_land, dur=3.0, ...)            one blossom petal / leaf that drifts down and lands on target
                                                         (an object -> it stays parented there, e.g. Claude's head)
  heat shimmer: post.setup(shimmer=[(x0, y0, x1, y1, amount), ...]) (screen-space, in the compositor)
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix, Euler

from . import geo, mat, layout

FPS = 24
TAU = 2 * math.pi
NB = mat.NB
PROTO = "LU_FXProtos"


# ===================================================================== small helpers
def _fps():
    return bpy.context.scene.render.fps


def _ground(x, y):
    from . import terrain
    return float(terrain.height(x, y))


def _fcurves_for(o, data_path, n):
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
        fc.keyframe_points.foreach_set("co", np.stack([fr, values[:, i]], 1).ravel())
        fc.keyframe_points.foreach_set("interpolation", [2 if interp == "LINEAR" else 0] * len(fr))
        fc.update()


def _vis_window(o, f0, f1):
    sc = bpy.context.scene
    _bake(o, [min(f0 - 1, sc.frame_start - 1), f0, f1 + 1], np.array([1.0, 0.0, 1.0])[:, None], "hide_render",
          interp="CONSTANT")


def _proto_coll():
    col = bpy.data.collections.get(PROTO)
    if col is None:
        col = bpy.data.collections.new(PROTO)
        bpy.context.scene.collection.children.link(col)
        lc = bpy.context.view_layer.layer_collection.children.get(PROTO)
        if lc:
            lc.exclude = True
    return col


def _proto(name, verts, faces, material, smooth=False):
    o = bpy.data.objects.get(name)
    if o:
        return o
    o = geo.obj_from(name, verts, faces, _proto_coll(), material, smooth=smooth)
    o.visible_shadow = False
    return o


def _ico_proto(name, r, material, sub=1, squash=1.0):
    o = bpy.data.objects.get(name)
    if o:
        return o
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r)
    o = bpy.context.active_object
    o.name = name
    o.scale = (1, 1, squash)
    o.data.transform(o.matrix_basis)
    o.matrix_basis = Matrix.Identity(4)
    for c in o.users_collection:
        c.objects.unlink(o)
    _proto_coll().objects.link(o)
    o.data.materials.append(material)
    o.data.shade_smooth()
    o.visible_shadow = False
    return o


def _pal(nb):
    from . import sky
    return sky.pal_node(nb)


def _rgb(nb, c):
    n = nb.n("ShaderNodeRGB")
    n.outputs[0].default_value = (*c[:3], 1.0)
    return n.outputs[0]


def _scale(nb, c, k):
    m = nb.n("ShaderNodeVectorMath", operation="SCALE")
    nb.inp(m, 0, c)
    nb.inp(m, "Scale", k)
    return m.outputs[0]


def _finish(m, nb, col, alpha, method="BLENDED", additive=False):
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    tr = nb.n("ShaderNodeBsdfTransparent")
    out = nb.n("ShaderNodeOutputMaterial")
    if additive:
        ad = nb.n("ShaderNodeAddShader")
        nb.link(tr.outputs[0], ad.inputs[0])
        em2 = em
        if alpha is not None:
            em2 = nb.n("ShaderNodeEmission")
            nb.inp(em2, "Color", _scale(nb, col, alpha))
        nb.link(em2.outputs[0], ad.inputs[1])
        nb.link(ad.outputs[0], out.inputs[0])
    else:
        mx = nb.n("ShaderNodeMixShader")
        nb.inp(mx, "Fac", nb.math("MINIMUM", nb.math("MAXIMUM", alpha, 0.0), 1.0))
        nb.link(tr.outputs[0], mx.inputs[1])
        nb.link(em.outputs[0], mx.inputs[2])
        nb.link(mx.outputs[0], out.inputs[0])
    m.surface_render_method = method
    m.use_backface_culling = False
    return m


def _new_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    return m, NB(m.node_tree)


def _inst(nb, name):
    return nb.n("ShaderNodeAttribute", attribute_name=name, attribute_type="INSTANCER").outputs["Fac"]


# ===================================================================== FX materials (palette-aware)
def _flake_mat():
    m = bpy.data.materials.get("FXFlake")
    if m:
        return m
    m, nb = _new_mat("FXFlake")
    P = _pal(nb)
    oi = nb.n("ShaderNodeObjectInfo")
    base = nb.mix(0.35, P.outputs["Light"], P.outputs["HazeLow"])
    col = _scale(nb, base, nb.add(0.85, nb.mul(oi.outputs["Random"], 0.35)))
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    a = nb.mul(nb.mapr(lw.outputs["Facing"], 0.9, 0.3), 0.9)
    return _finish(m, nb, col, a)


def _ember_mat():
    m = bpy.data.materials.get("FXEmber")
    if m:
        return m
    m, nb = _new_mat("FXEmber")
    life = nb.math("MAXIMUM", _inst(nb, "life"),
                   nb.n("ShaderNodeAttribute", attribute_name="life", attribute_type="OBJECT").outputs["Fac"])
    col = nb.mix(nb.mapr(life, 0.2, 1.0), (0.9, 0.12, 0.01), (1.0, 0.62, 0.18))
    col = _scale(nb, col, nb.mul(life, 14.0))
    return _finish(m, nb, col, None, additive=True)


def _mote_mat(color=(1.0, 0.82, 0.45), name="FXMote", k=6.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m, nb = _new_mat(name)
    life = _inst(nb, "life")
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    soft = nb.math("POWER", nb.mapr(lw.outputs["Facing"], 0.0, 1.0, 1.0, 0.0, interp="LINEAR"), 2.0)
    col = _scale(nb, _rgb(nb, color), nb.mul(nb.mul(life, soft), k))
    return _finish(m, nb, col, None, additive=True)


def _rain_mat():
    m = bpy.data.materials.get("FXRain")
    if m:
        return m
    m, nb = _new_mat("FXRain")
    P = _pal(nb)
    uv = nb.n("ShaderNodeTexCoord").outputs["Generated"]
    sx, sy, sz = (nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": uv}).outputs[i] for i in range(3))
    a = nb.mul(nb.mul(nb.mapr(sz, 0.0, 0.4), nb.mapr(sz, 1.0, 0.6)), 0.38)
    col = nb.mix(0.5, P.outputs["Light"], (0.75, 0.8, 0.9))
    col = _scale(nb, col, 1.3)
    return _finish(m, nb, col, a)


def _hail_mat():
    m = bpy.data.materials.get("FXHail")
    if m:
        return m
    from . import mat as M
    m = M.painterly("FXHail", (0.80, 0.85, 0.95), stroke="strokes_fine", scale=40.0, tex_amt=0.3, wrap=0.4,
                    translucent=0.5, spec=0.8, rough=0.15, spec_col=(1, 1, 1), snow=0.0)
    from . import envmat
    envmat._patch_emission(m, lambda nb: _scale(nb, nb.mix(0.5, _pal(nb).outputs["Light"], (0.8, 0.85, 1.0)), 0.75))
    return m


def _puff_mat(name="FXPuff", color=None, opacity=0.55, lit=True):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m, nb = _new_mat(name)
    life = _inst(nb, "life")
    oa = nb.n("ShaderNodeAttribute", attribute_name="life", attribute_type="OBJECT").outputs["Fac"]
    life = nb.math("MAXIMUM", life, oa)
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
    tc = nb.n("ShaderNodeTexCoord")
    st = mat.tex_node(nb, "strokes_soft", tc.outputs["Object"], 2.0)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 3.0, "Detail": 3.0, "Roughness": 0.6, "Distortion": 0.5})
    nb.link(tc.outputs["Object"], nz.inputs["Vector"])
    edge = nb.math("POWER", nb.mapr(lw.outputs["Facing"], 0.0, 1.0, 1.0, 0.0, interp="LINEAR"), 1.8)
    soft = nb.mapr(nb.add(nb.add(edge, nb.mul(nb.sub(sv, 0.5), 0.5)), nb.mul(nb.sub(nz.outputs["Fac"], 0.5), 0.9)),
                   0.15, 0.85)
    alpha = nb.mul(nb.mul(soft, life), opacity)
    P = _pal(nb)
    base = _rgb(nb, color) if color is not None else _scale(nb, nb.mix(0.45, P.outputs["Light"], P.outputs["HazeLow"]), 1.25)
    if lit:
        dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
        s2r = nb.n("ShaderNodeShaderToRGB")
        nb.link(dif.outputs[0], s2r.inputs[0])
        L = nb.mix(1.0, s2r.outputs["Color"], (0.35, 0.35, 0.35), blend="ADD")
        base = nb.mix(1.0, base, nb.mix(0.6, (1, 1, 1), L), blend="MULTIPLY")
    return _finish(m, nb, base, alpha)


# ===================================================================== prototypes
def _flake_proto():
    v = [(-0.5, 0, -0.3), (0.1, 0, -0.5), (0.5, 0, 0.0), (0.2, 0, 0.45), (-0.4, 0, 0.35)]
    return _proto("FXP_Flake", v, [(0, 1, 2, 3, 4)], _flake_mat())


def _streak_proto(name="FXP_Rain", L=0.55, w=0.006):
    v = [(-w, 0, -L / 2), (w, 0, -L / 2), (w, 0, L / 2), (-w, 0, L / 2), (0, -w, -L / 2), (0, w, -L / 2), (0, w, L / 2),
         (0, -w, L / 2)]
    return _proto(name, v, [(0, 1, 2, 3), (4, 5, 6, 7)], _rain_mat())


def _petal_meshes():
    from . import dress
    out = []
    for i, c in enumerate(PETAL_COLS):
        out.append(_petal_obj(c, f"FXP_Petal{i}"))
    return out


PETAL_COLS = ((1.0, 0.52, 0.70), (0.97, 0.92, 0.92), (0.80, 0.05, 0.42), (1.0, 0.72, 0.05), (0.28, 0.55, 0.07),
              (1.0, 0.62, 0.78))


def _petal_obj(color, name):
    o = bpy.data.objects.get(name)
    if o:
        return o
    verts = [(0, -0.5, 0), (0.28, -0.05, 0.03), (0.18, 0.4, 0.0), (0, 0.5, -0.02), (-0.18, 0.4, 0.0), (-0.28, -0.05, 0.03)]
    m = bpy.data.materials.get(name + "M") or mat.painterly(name + "M", color, stroke="strokes_fine", scale=20,
                                                            tex_amt=0.5, wrap=0.45, translucent=0.45, backface=True,
                                                            snow=0.0)
    return _proto(name, verts, [(0, 1, 2, 3, 4, 5)], m)


# ===================================================================== the GN field builder
def _ctl_empty(name, amount=1.0):
    e = bpy.data.objects.new(name + "_Ctl", None)
    bpy.context.scene.collection.objects.link(e)
    e.location = (amount, 0.0, 0.0)
    e.hide_render = True
    return e


def amount(field, frame, value):
    """Key a field's amount (0 = none .. 1 = all its particles) at frame."""
    e = field["ctl"] if isinstance(field, dict) else bpy.data.objects.get(field.name + "_Ctl")
    e.location.x = value
    e.keyframe_insert("location", index=0, frame=frame)


def _field_obj(name, n, attrs, seed):
    me = bpy.data.meshes.new(name)
    me.vertices.add(n)
    me.vertices.foreach_set("co", np.zeros(n * 3, dtype=np.float32))
    for an, arr in attrs.items():
        arr = np.asarray(arr, dtype=np.float32)
        if arr.ndim == 2:
            a = me.attributes.new(an, "FLOAT_VECTOR", "POINT")
            a.data.foreach_set("vector", arr.ravel())
        else:
            a = me.attributes.new(an, "FLOAT", "POINT")
            a.data.foreach_set("value", arr)
    ob = bpy.data.objects.new(name, me)
    geo.coll("FX").objects.link(ob)
    ob.visible_shadow = False
    return ob


def _gn_field(name, kind, center, size, t0, protos, P, ctl):
    from .dress import GB
    g = bpy.data.node_groups.new(name + "GN", "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    G = GB(g)
    gi, go = G.n("NodeGroupInput"), G.n("NodeGroupOutput")
    T = G.sub(G.time(), t0)
    U = G.attr("u", "FLOAT_VECTOR")
    R = G.attr("r", "FLOAT_VECTOR")
    ux, uy, uz = G.sep(U)
    rx, ry, rz = G.sep(R)
    cx, cy, cz = center
    W, D, H = size
    oi = G.n("GeometryNodeObjectInfo", transform_space="ORIGINAL")
    oi.inputs["Object"].default_value = ctl
    amt = G.sep(oi.outputs["Location"])[0]
    fmod = lambda a, b: G.math("FLOORED_MODULO", a, b)
    life = None
    rot = None
    extra = None
    if kind in ("fall", "rain", "wind"):
        vz = G.mul(P["fall"], G.add(1.0 - P.get("fall_var", 0.3), G.mul(rx, 2 * P.get("fall_var", 0.3))))
        wx, wy = P.get("wind", (0.0, 0.0))
        gst = P.get("gust", 1.0)
        wxs = G.mul(wx, G.add(0.7, G.mul(ry, 0.6 * gst)))
        wys = G.mul(wy, G.add(0.7, G.mul(rz, 0.6 * gst)))
        fz = fmod(G.add(G.mul(uz, H), G.mul(vz, T)), H)
        z = G.sub(cz + H / 2, fz)
        A = P.get("flutter", 0.0)
        om = P.get("flutter_f", 1.3)
        fx_ = G.mul(A, G.math("SINE", G.add(G.mul(T, G.mul(om, G.add(0.7, rz))), G.mul(rx, TAU))))
        fy_ = G.mul(A, G.math("COSINE", G.add(G.mul(T, G.mul(om * 0.8, G.add(0.7, rx))), G.mul(ry, TAU))))
        x = G.add(cx - W / 2, fmod(G.add(G.add(G.mul(ux, W), G.mul(wxs, T)), fx_), W))
        y = G.add(cy - D / 2, fmod(G.add(G.add(G.mul(uy, D), G.mul(wys, T)), fy_), D))
        pos = G.xyz(x, y, z)
        fr = G.math("DIVIDE", fz, H)
        fade = G.mul(G.mapr(fr, 0.0, 0.06), G.mapr(fr, 1.0, 0.92))
        ex = G.math("DIVIDE", fmod(G.add(G.mul(ux, W), G.mul(wxs, T)), W), W)
        fade = G.mul(fade, G.mul(G.mapr(ex, 0.0, 0.05), G.mapr(ex, 1.0, 0.95)))
        if kind in ("rain", "wind"):
            al = G.n("FunctionNodeAlignRotationToVector")
            al.axis = "Z"
            G.set(al, "Vector", G.xyz(G.mul(wxs, -1.0) if kind == "rain" else wxs,
                                      G.mul(wys, -1.0) if kind == "rain" else wys, G.mul(vz, 1.0)))
            rot = al.outputs[0]
        else:
            sp = P.get("spin", 2.5)
            e2r = G.n("FunctionNodeEulerToRotation")
            G.set(e2r, 0, G.xyz(G.mul(T, G.mul(sp, G.sub(rx, 0.5))), G.mul(T, G.mul(sp, G.sub(ry, 0.5))),
                                G.add(G.mul(rz, TAU), G.mul(T, 0.4))))
            rot = e2r.outputs[0]
        s = G.mul(G.add(P["size"][0], G.mul(rz, P["size"][1] - P["size"][0])), fade)
    elif kind == "rise":
        vz = G.mul(P["rise"], G.add(0.6, G.mul(rx, 0.8)))
        f = fmod(G.add(uz, G.math("DIVIDE", G.mul(vz, T), H)), 1.0)
        age = G.math("DIVIDE", G.mul(f, H), P["rise"])
        wx, wy = P.get("wind", (0.0, 0.0))
        wob = P.get("wobble", 0.12)
        x = G.add(G.add(cx + -W / 2, G.mul(ux, W)), G.add(G.mul(wx, age), G.mul(wob, G.math("SINE", G.add(G.mul(T, 3.1), G.mul(rx, 40.0))))))
        y = G.add(G.add(cy - D / 2, G.mul(uy, D)), G.add(G.mul(wy, age), G.mul(wob, G.math("COSINE", G.add(G.mul(T, 2.7), G.mul(ry, 40.0))))))
        z = G.add(cz - H / 2, G.mul(f, H))
        if P.get("ground"):
            z = G.add(z, G.attr("gz"))
        pos = G.xyz(x, y, z)
        fl = G.n("ShaderNodeTexNoise", noise_dimensions="2D")
        G.set(fl, "Vector", G.xyz(G.mul(T, 4.0), G.mul(rz, 30.0), 0.0))
        fl.inputs["Scale"].default_value = 1.0
        flick = G.mapr(fl.outputs[0], 0.3, 0.7, 0.35, 1.25)
        life = G.mul(G.math("POWER", G.math("SINE", G.mul(f, math.pi)), 0.6), flick)
        s = G.mul(G.add(P["size"][0], G.mul(rz, P["size"][1] - P["size"][0])), G.add(0.4, G.mul(life, 0.6)))
    elif kind == "drift":
        base = G.vm("ADD", G.vm("MULTIPLY", G.vm("SUBTRACT", U, (0.5, 0.5, 0.5)), (W, D, H)), (cx, cy, cz))
        sp = P.get("speed", 0.15)
        nz = G.n("ShaderNodeTexNoise", noise_dimensions="4D")
        G.set(nz, "Vector", G.vm("SCALE", U, scale=4.0))
        G.set(nz, "W", G.mul(T, sp))
        nz.inputs["Scale"].default_value = 1.0
        off = G.vm("MULTIPLY", G.vm("SUBTRACT", nz.outputs["Color"], (0.5, 0.5, 0.5)), (P.get("amp", 0.6),) * 3)
        rise = G.xyz(G.mul(P.get("wind", (0, 0))[0], T), G.mul(P.get("wind", (0, 0))[1], T), G.mul(P.get("rise", 0.0), T))
        pos = G.vm("ADD", G.vm("ADD", base, off), rise)
        tw = G.n("ShaderNodeTexNoise", noise_dimensions="2D")
        G.set(tw, "Vector", G.xyz(G.mul(T, 0.9), G.mul(rx, 37.0), 0.0))
        tw.inputs["Scale"].default_value = 1.0
        life = G.add(0.35, G.mul(G.mapr(tw.outputs[0], 0.35, 0.7), 0.65))
        s = G.add(P["size"][0], G.mul(rz, P["size"][1] - P["size"][0]))
    elif kind == "hail":
        gz = G.attr("gz")
        Hh, vzf, vb, grav, hs, trest = P["height"], P["fall"], P["bounce"], 9.8, P.get("hs", 0.7), P.get("rest", 0.9)
        tf = Hh / vzf
        tb1 = 2 * vb / grav
        vb2 = vb * 0.38
        tb2 = 2 * vb2 / grav
        Tc = tf + tb1 + tb2 + trest + P.get("gap", 0.6)
        tau = fmod(G.add(T, G.mul(rx, Tc)), Tc)
        t1 = G.sub(tau, tf)
        t2 = G.sub(t1, tb1)
        t3 = G.sub(t2, tb2)
        m0 = G.math("LESS_THAN", tau, tf)
        m1 = G.mul(G.sub(1.0, m0), G.math("LESS_THAN", t1, tb1))
        m2 = G.mul(G.math("GREATER_THAN", t1, tb1 - 1e-4), G.math("LESS_THAN", t2, tb2))
        m3 = G.math("GREATER_THAN", t2, tb2 - 1e-4)
        z0 = G.sub(G.add(gz, Hh), G.mul(vzf, tau))
        z1 = G.add(gz, G.sub(G.mul(vb, t1), G.mul(0.5 * grav, G.mul(t1, t1))))
        z2 = G.add(gz, G.sub(G.mul(vb2, t2), G.mul(0.5 * grav, G.mul(t2, t2))))
        z = G.add(G.add(G.mul(m0, z0), G.mul(m1, z1)), G.add(G.mul(m2, z2), G.mul(m3, gz)))
        dxy = G.add(G.add(G.mul(m1, G.mul(hs, t1)), G.mul(m2, G.add(hs * tb1, G.mul(0.5 * hs, t2)))),
                    G.mul(m3, hs * tb1 + 0.5 * hs * tb2))
        ang = G.mul(ry, TAU)
        bx, by = G.attr("bx"), G.attr("by")
        x = G.add(bx, G.mul(dxy, G.math("COSINE", ang)))
        y = G.add(by, G.mul(dxy, G.math("SINE", ang)))
        pos = G.xyz(x, y, G.add(z, P["size"][1] * 0.5))
        melt = G.sub(1.0, G.mul(m3, G.mapr(t3, 0.0, trest)))
        s = G.mul(G.add(P["size"][0], G.mul(rz, P["size"][1] - P["size"][0])), melt)
        e2r = G.n("FunctionNodeEulerToRotation")
        G.set(e2r, 0, G.xyz(G.mul(tau, G.mul(rx, 9.0)), G.mul(tau, G.mul(ry, 7.0)), G.mul(rz, TAU)))
        rot = e2r.outputs[0]
        # impact puffs
        pp = P.get("puff", 0.12)
        pulse1 = G.mul(G.mul(G.math("GREATER_THAN", t1, 0.0), G.math("LESS_THAN", t1, 0.45)),
                       G.math("POWER", G.mapr(t1, 0.0, 0.45, 0.25, 1.0, interp="LINEAR"), 0.6))
        plife = G.mul(G.mul(G.math("GREATER_THAN", t1, 0.0), G.mapr(t1, 0.45, 0.02)), 1.0)
        extra = dict(pos=G.xyz(bx, by, G.add(gz, 0.02)), scale=G.mul(pulse1, G.mul(pp, G.add(0.6, rz))), life=plife)
    elif kind == "splash":
        Tp = P.get("period", 0.6)
        tau = fmod(G.add(T, G.mul(rx, Tp)), Tp)
        pos = G.xyz(G.attr("bx"), G.attr("by"), G.add(G.attr("gz"), 0.01))
        life = G.mapr(tau, 0.25, 0.0)
        s = G.mul(G.mul(G.math("POWER", G.mapr(tau, 0.0, 0.25, 0.2, 1.0, interp="LINEAR"), 0.5),
                        G.math("LESS_THAN", tau, 0.25)), G.add(P["size"][0], G.mul(rz, P["size"][1] - P["size"][0])))
    elif kind == "front":
        ta = G.attr("ta")
        L = G.attr("life")
        tau = G.sub(G.time(), ta)
        alive = G.mul(G.math("GREATER_THAN", tau, 0.0), G.math("LESS_THAN", tau, L))
        tc = G.math("MAXIMUM", tau, 0.0)
        v0 = P.get("up", 3.2)
        zup = G.sub(G.mul(v0 / 1.4, G.sub(1.0, G.math("EXPONENT", G.mul(tc, -1.4)))), G.mul(0.16, G.mul(tc, tc)))
        Rs = G.mul(P.get("swirl_r", 0.9), G.add(0.4, rz))
        om = G.mul(P.get("swirl", 2.2), G.add(0.6, ry))
        ph = G.mul(rx, TAU)
        wx, wy = P.get("wind", (0.6, -0.2))
        x = G.add(G.attr("bx"), G.add(G.mul(Rs, G.math("SINE", G.add(G.mul(om, tc), ph))), G.mul(wx, tc)))
        y = G.add(G.attr("by"), G.add(G.mul(Rs, G.math("COSINE", G.add(G.mul(om, tc), ph))), G.mul(wy, tc)))
        z = G.add(G.attr("gz"), G.add(0.05, G.math("MAXIMUM", zup, 0.0)))
        pos = G.xyz(x, y, z)
        e2r = G.n("FunctionNodeEulerToRotation")
        G.set(e2r, 0, G.xyz(G.mul(tc, G.mul(rx, 8.0)), G.mul(tc, G.mul(ry, 6.0)), G.add(G.mul(rz, TAU), tc)))
        rot = e2r.outputs[0]
        s = G.mul(G.mul(G.add(P["size"][0], G.mul(rz, P["size"][1] - P["size"][0])), alive),
                  G.mul(G.mapr(tc, 0.0, 0.25), G.mapr(G.sub(L, tc), 0.0, 0.5)))
        life = G.mul(alive, G.mapr(G.sub(L, tc), 0.0, 0.5))
    else:
        raise ValueError(kind)
    # amount: show particles whose random < amount
    show = G.math("LESS_THAN", G.math("FRACT", G.mul(ry, 7.31)), amt)
    s = G.mul(s, show)
    # a stable id (before any deletion) so motion blur matches instances across frames
    sid = G.n("GeometryNodeStoreNamedAttribute", data_type="INT", domain="POINT")
    G.set(sid, "Geometry", gi.outputs[0])
    sid.inputs["Name"].default_value = "id"
    G.set(sid, 3, G.n("GeometryNodeInputIndex").outputs[0])
    src_pts = sid.outputs[0]
    sp_ = G.n("GeometryNodeSetPosition")
    G.set(sp_, "Geometry", src_pts)
    G.set(sp_, "Position", pos)
    dl = G.n("GeometryNodeDeleteGeometry", domain="POINT")
    G.set(dl, "Geometry", sp_.outputs[0])
    G.set(dl, "Selection", G.math("LESS_THAN", s, 1e-5))

    def instance(points, scale, rotation, lifev, protos_):
        iop = G.n("GeometryNodeInstanceOnPoints")
        G.set(iop, "Points", points)
        if len(protos_) == 1:
            oi2 = G.n("GeometryNodeObjectInfo", transform_space="ORIGINAL")
            oi2.inputs["Object"].default_value = protos_[0]
            oi2.inputs["As Instance"].default_value = True
            G.set(iop, "Instance", oi2.outputs["Geometry"])
        else:
            jg = G.n("GeometryNodeJoinGeometry")
            for pr in reversed(protos_):
                oi2 = G.n("GeometryNodeObjectInfo", transform_space="ORIGINAL")
                oi2.inputs["Object"].default_value = pr
                oi2.inputs["As Instance"].default_value = True
                G.L.new(oi2.outputs["Geometry"], jg.inputs[0])
            G.set(iop, "Instance", jg.outputs[0])
            iop.inputs["Pick Instance"].default_value = True
            G.set(iop, "Instance Index", G.math("FLOOR", G.mul(rx, len(protos_) - 1e-3)))
        G.set(iop, "Scale", G.xyz(scale, scale, scale))
        if rotation is not None:
            G.set(iop, "Rotation", rotation)
        out = iop.outputs[0]
        if lifev is not None:
            st = G.n("GeometryNodeStoreNamedAttribute", data_type="FLOAT", domain="INSTANCE")
            G.set(st, "Geometry", out)
            st.inputs["Name"].default_value = "life"
            G.set(st, 3, lifev)
            out = st.outputs[0]
        return out

    main = instance(dl.outputs[0], s, rot, life, protos)
    if extra is not None:
        sid2 = G.n("GeometryNodeStoreNamedAttribute", data_type="INT", domain="POINT")
        G.set(sid2, "Geometry", gi.outputs[0])
        sid2.inputs["Name"].default_value = "id"
        G.set(sid2, 3, G.add(G.n("GeometryNodeInputIndex").outputs[0], 1000000))
        sp2 = G.n("GeometryNodeSetPosition")
        G.set(sp2, "Geometry", sid2.outputs[0])
        G.set(sp2, "Position", extra["pos"])
        es = G.mul(extra["scale"], show)
        dl2 = G.n("GeometryNodeDeleteGeometry", domain="POINT")
        G.set(dl2, "Geometry", sp2.outputs[0])
        G.set(dl2, "Selection", G.math("LESS_THAN", es, 1e-5))
        e2r = G.n("FunctionNodeEulerToRotation")
        G.set(e2r, 0, G.xyz(0.0, 0.0, G.mul(rz, TAU)))
        puffs = instance(dl2.outputs[0], es, e2r.outputs[0], extra["life"], [P["puff_proto"]])
        jg = G.n("GeometryNodeJoinGeometry")
        G.L.new(puffs, jg.inputs[0])
        G.L.new(main, jg.inputs[0])
        main = jg.outputs[0]
    G.set(go, 0, main)
    return g


def _make_field(name, kind, center, size, count, f0, protos, P, seed, attrs=None, amount_=1.0, f1=None):
    rng = np.random.default_rng(seed)
    n = count
    A = dict(u=rng.random((n, 3)), r=rng.random((n, 3)))
    if attrs:
        A.update(attrs(rng, n, A))
    ob = _field_obj(name, n, A, seed)
    ctl = _ctl_empty(name, amount_)
    t0 = (f0 if f0 is not None else bpy.context.scene.frame_start) / _fps()
    g = _gn_field(name, kind, center, size, t0, protos, P, ctl)
    mod = ob.modifiers.new("FX", "NODES")
    mod.node_group = g
    if f1 is not None:
        _vis_window(ob, f0, f1)
    return dict(obj=ob, ctl=ctl, group=g)


# ===================================================================== public particle fields
def ash_snow(center, size=(60.0, 60.0, 18.0), count=4000, f0=None, wind=(0.35, -0.12), fall=0.45, flake=(0.012, 0.03),
             seed=1, amount_=1.0, name="AshSnow"):
    """Slow ash flakes falling and drifting in a box (center, size) around the camera. Flutter + tumble."""
    return _make_field(name, "fall", center, size, count, f0, [_flake_proto()],
                       dict(fall=fall, fall_var=0.4, wind=wind, flutter=0.35, flutter_f=1.1, spin=2.4, size=flake),
                       seed, amount_=amount_)


def wind_ash(center, size=(40.0, 30.0, 6.0), count=2500, f0=None, wind=(9.0, -3.0), fall=0.6, flake=(0.01, 0.025),
             seed=2, amount_=1.0, name="WindAsh"):
    """Ash, grit and soot streaming sideways low over the ground in a gust (the storm's arrival)."""
    return _make_field(name, "fall", center, size, count, f0, [_flake_proto()],
                       dict(fall=fall, fall_var=0.6, wind=wind, gust=1.5, flutter=0.5, flutter_f=3.0, spin=9.0,
                            size=flake), seed, amount_=amount_)


def embers(center, size=(8.0, 8.0, 5.0), count=120, f0=None, rise=0.55, wind=(0.12, -0.04), ember=(0.01, 0.022),
           seed=3, amount_=1.0, ground=True, name="Embers"):
    """Glowing embers rising from the ash (box base on the terrain when ground=True), wobbling and flickering out."""
    proto = _ico_proto("FXP_Ember", 0.5, _ember_mat(), sub=1)
    cx, cy, cz = center if len(center) == 3 else (center[0], center[1], 0.0)

    def attrs(rng, n, A):
        bx = cx + (A["u"][:, 0] - 0.5) * size[0]
        by = cy + (A["u"][:, 1] - 0.5) * size[1]
        from . import terrain
        return dict(gz=terrain.height(bx, by) if ground else np.zeros(n))
    c = (cx, cy, size[2] / 2 if ground else cz)
    return _make_field(name, "rise", c, size, count, f0, [proto],
                       dict(rise=rise, wind=wind, wobble=0.1, size=ember, ground=ground), seed, attrs, amount_)


def rain(center, size=(40.0, 40.0, 20.0), count=6000, f0=None, wind=(2.5, -0.9), fall=9.5, seed=4, amount_=1.0,
         streak=(0.45, 0.85), name="Rain"):
    """Rain streaks falling fast, slanted by the wind (streaks are aligned to the drop's velocity)."""
    return _make_field(name, "rain", center, size, count, f0, [_streak_proto()],
                       dict(fall=fall, fall_var=0.15, wind=wind, size=streak), seed, amount_=amount_)


HIT_PREFIX = ("Terrain", "Ledge", "HailWall", "HailRock", "Crown", "Stump", "Scree", "SummitSoil")


def _ground_hits(xs, ys, z_from=200.0, prefix=HIT_PREFIX):
    """Impact heights: ray-cast straight down on the hero meshes (terrain patches, rocks, stump, props) near the
    points (one BVH), else the heightfield."""
    from . import terrain
    from mathutils.bvhtree import BVHTree
    gz = terrain.height(xs, ys).astype(float)
    x0, x1, y0, y1 = xs.min() - 2, xs.max() + 2, ys.min() - 2, ys.max() + 2
    objs = []
    for o in bpy.data.objects:
        if o.type != "MESH" or not o.name.startswith(prefix) or o.modifiers:
            continue
        bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
        if max(v.x for v in bb) < x0 or min(v.x for v in bb) > x1 or max(v.y for v in bb) < y0 or min(v.y for v in bb) > y1:
            continue
        objs.append(o)
    if not objs:
        return gz
    verts, polys = [], []
    base = 0
    for o in objs:
        me = o.data
        me.calc_loop_triangles()
        n = len(me.vertices)
        co = np.empty(n * 3, dtype=np.float64)
        me.vertices.foreach_get("co", co)
        co = co.reshape(-1, 3)
        mw = np.array(o.matrix_world)
        co = co @ mw[:3, :3].T + mw[:3, 3]
        tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int64)
        me.loop_triangles.foreach_get("vertices", tri)
        tri = tri.reshape(-1, 3)
        cen = co[tri].mean(1)
        keep = (cen[:, 0] > x0) & (cen[:, 0] < x1) & (cen[:, 1] > y0) & (cen[:, 1] < y1)
        tri = tri[keep]
        used = np.unique(tri)
        remap = np.full(n, -1, dtype=np.int64)
        remap[used] = np.arange(len(used)) + base
        verts.append(co[used])
        polys.append(remap[tri])
        base += len(used)
    if base == 0:
        return gz
    verts = [Vector(v) for v in np.concatenate(verts, 0).tolist()]
    polys = [tuple(p) for p in np.concatenate(polys, 0).tolist()]
    bvh = BVHTree.FromPolygons(verts, polys)
    for i in range(len(xs)):
        hit = bvh.ray_cast(Vector((xs[i], ys[i], gz[i] + 30.0)), Vector((0, 0, -1)), 60.0)
        if hit[0] is not None:
            gz[i] = max(gz[i], hit[0].z)
    return gz


def hail(center, radius=6.0, count=600, f0=None, height=12.0, fall=16.0, bounce=2.6, stone=(0.022, 0.04), seed=5,
         amount_=1.0, puff_color=None, name="Hail"):
    """Hailstones falling, bouncing (two hops), lying a moment and melting, each hit kicking up a small puff."""
    hm = _hail_mat()
    proto = _ico_proto("FXP_Hail", 0.5, hm, sub=1, squash=0.85)
    pm = _puff_mat("FXHailPuff", color=puff_color, opacity=0.5)
    puff = _ico_proto("FXP_HailPuff", 0.5, pm, sub=2, squash=0.55)
    cx, cy = center[0], center[1]

    def attrs(rng, n, A):
        r = radius * np.sqrt(A["u"][:, 0])
        a = A["u"][:, 1] * TAU
        bx, by = cx + r * np.cos(a), cy + r * np.sin(a)
        return dict(bx=bx, by=by, gz=_ground_hits(bx, by))
    return _make_field(name, "hail", (cx, cy, 0.0), (radius * 2, radius * 2, height), count, f0, [proto],
                       dict(height=height, fall=fall, bounce=bounce, size=stone, puff=0.13, puff_proto=puff, hs=0.8,
                            rest=1.1, gap=0.5), seed, attrs, amount_)


def rain_splashes(center, radius=8.0, count=500, f0=None, seed=6, amount_=1.0, size=(0.04, 0.09), name="RainSplash"):
    pm = _puff_mat("FXSplash", color=(0.7, 0.75, 0.85), opacity=0.45, lit=False)
    proto = _ico_proto("FXP_Splash", 0.5, pm, sub=1, squash=0.35)
    cx, cy = center[0], center[1]

    def attrs(rng, n, A):
        r = radius * np.sqrt(A["u"][:, 0])
        a = A["u"][:, 1] * TAU
        bx, by = cx + r * np.cos(a), cy + r * np.sin(a)
        return dict(bx=bx, by=by, gz=_ground_hits(bx, by))
    return _make_field(name, "splash", (cx, cy, 0), (radius * 2, radius * 2, 1.0), count, f0, [proto],
                       dict(period=0.55, size=size), seed, attrs, amount_)


def motes(center, size=(3.0, 3.0, 6.0), count=300, f0=None, mote=(0.004, 0.009), color=(1.0, 0.82, 0.45), k=6.0,
          speed=0.12, amp=0.5, rise=0.03, seed=7, amount_=1.0, name="Motes"):
    """Drifting dust motes glinting in light (the sunbeam)."""
    m = _mote_mat(color, "FXMote_" + name, k)
    proto = _ico_proto("FXP_Mote_" + name, 0.5, m, sub=1)
    return _make_field(name, "drift", tuple(center), size, count, f0, [proto],
                       dict(speed=speed, amp=amp, rise=rise, size=mote), seed, amount_=amount_)


def pollen(center, size=(6.0, 6.0, 3.0), count=400, f0=None, seed=8, amount_=1.0, name="Pollen"):
    return motes(center, size, count, f0, mote=(0.006, 0.014), color=(1.0, 0.86, 0.35), k=2.2, speed=0.2, amp=0.8,
                 rise=0.08, seed=seed, amount_=amount_, name=name)


def bloom_burst(f0=None, f1=None, areas=((30.0, 149.0, 60.0), (5.0, 60.0, 160.0)), count=6000, life=(1.6, 3.2),
                seed=9, name="BloomBurst", wind=(0.9, -0.35), petal_size=(0.03, 0.06), sparkle=4000,
                sparkle_size=(0.04, 0.1)):
    """Petals, leaves and pollen swirling up at the bloom wave front: each particle sits on the ground and launches
    when the (keyed) wave reaches it. Call after world.bloom_wave(). areas: [(x, y, r)] where particles live."""
    from . import envmat, terrain
    sc = bpy.context.scene
    f0 = sc.frame_start if f0 is None else f0
    f1 = sc.frame_end if f1 is None else f1
    E = envmat.bloom_empty()
    fr = np.arange(f0 - 2, f1 + 30)
    Rs = []
    cur = sc.frame_current
    for f in fr:
        sc.frame_set(int(f))
        Rs.append(E.matrix_world.translation.x)
    sc.frame_set(cur)
    Rs = np.maximum.accumulate(np.array(Rs))
    rng = np.random.default_rng(seed)
    pts = []
    per = count // len(areas)
    for (ax, ay, ar) in areas:
        r = ar * np.sqrt(rng.random(per))
        a = rng.uniform(0, TAU, per)
        pts.append(np.stack([ax + r * np.cos(a), ay + r * np.sin(a)], 1))
    pts = np.concatenate(pts, 0)
    bd = terrain.bloom_dist(pts[:, 0], pts[:, 1])
    idx = np.searchsorted(Rs, bd)
    ok = idx < len(fr)
    pts, bd, idx = pts[ok], bd[ok], idx[ok]
    ta = fr[idx] / _fps() + rng.uniform(0.0, 0.35, len(pts))
    n = len(pts)
    protos = _petal_meshes()

    def attrs(rng_, n_, A):
        return dict(bx=pts[:, 0], by=pts[:, 1], gz=terrain.height(pts[:, 0], pts[:, 1]), ta=ta,
                    life=rng.uniform(*life, n))
    out = _make_field(name, "front", (0, 0, 0), (1, 1, 1), n, 0, protos,
                      dict(up=3.4, swirl_r=1.1, swirl=2.4, wind=wind, size=petal_size), seed, attrs)
    if sparkle:
        # glowing pollen sparks bursting at the front (readable from the crane)
        m = _mote_mat((1.0, 0.86, 0.45), "FXFrontSpark", 4.0)
        sp_proto = _ico_proto("FXP_FrontSpark", 0.5, m, sub=1)
        far_ok = np.nonzero(bd > 15.0)[0]                # not in the planting close-up
        ns = min(sparkle, len(far_ok))
        ids = rng.choice(far_ok, ns, replace=False)

        def attrs2(rng_, n_, A):
            return dict(bx=pts[ids, 0] + rng.normal(0, 1.0, ns), by=pts[ids, 1] + rng.normal(0, 1.0, ns),
                        gz=terrain.height(pts[ids, 0], pts[ids, 1]), ta=ta[ids] + rng.uniform(-0.1, 0.2, ns),
                        life=rng.uniform(0.7, 1.6, ns))
        out["sparks"] = _make_field(name + "Spark", "front", (0, 0, 0), (1, 1, 1), ns, 0, [sp_proto],
                                    dict(up=1.6, swirl_r=0.6, swirl=1.5, wind=wind, size=sparkle_size), seed + 1,
                                    attrs2)
    return out


# ===================================================================== keyed effects
def _life_keys(o, f, life):
    o["life"] = life
    o.keyframe_insert("location", frame=f)
    o.keyframe_insert("rotation_euler", frame=f)
    o.keyframe_insert("scale", frame=f)
    o.keyframe_insert('["life"]', frame=f)


def puff(name, origin, frame, n=8, spread=0.25, grow=(0.12, 0.6), life=(0.8, 2.0), rise=0.25, drift=(0, 0, 0),
         color=None, opacity=0.55, seed=0, collection=None):
    """Soft painted puffs (dust, ash, smoke) expanding and fading from origin at absolute frame."""
    col = collection or geo.coll("FX")
    rng = np.random.default_rng(seed)
    m = _puff_mat(f"FXPuff_{'pal' if color is None else '%.2f_%.2f_%.2f' % tuple(color)}_{opacity:.2f}", color, opacity)
    O = Vector(origin)
    fps = _fps()
    objs = []
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=1.0)
    base = bpy.context.active_object
    base.data.materials.append(m)
    base.data.shade_smooth()
    me = base.data
    bpy.data.objects.remove(base)
    for i in range(n):
        o = bpy.data.objects.new(f"{name}{i}", me)
        col.objects.link(o)
        o.visible_shadow = False
        off = Vector(rng.normal(0, spread, 3))
        off.z = abs(off.z) * 0.5
        vel = off.normalized() * rng.uniform(0.2, 0.6) + Vector(drift) + Vector((0, 0, rise))
        L = rng.uniform(*life)
        r0, r1 = grow[0] * rng.uniform(0.6, 1.2), grow[1] * rng.uniform(0.7, 1.3)
        ts = rng.uniform(0, 0.12)
        fa, fb = frame + int(ts * fps) - 1, frame + int((ts + L) * fps) + 1
        rot = Euler(rng.uniform(0, 6.28, 3))
        frames, locs, scs, lifev = [], [], [], []
        for f in range(fa, fb + 1):
            t = (f - frame) / fps - ts
            u = min(max(t / L, 0.0), 1.0)
            eo = 1 - (1 - u) ** 3
            frames.append(f)
            locs.append(tuple(O + off * 0.4 + vel * L * eo))
            s = r0 + (r1 - r0) * eo if t >= 0 else 0.001
            scs.append((s, s, s * 0.8))
            lifev.append((math.sin(math.pi * min(1, u * 1.6)) if u < 0.6 else (1 - u) / 0.4 * 0.95) if t >= 0 else 0.0)
        o.rotation_euler = rot
        o["life"] = 0.0
        _bake(o, frames, np.array(locs), "location")
        _bake(o, frames, np.array(scs), "scale")
        _bake(o, frames, np.array(lifev)[:, None], '["life"]')
        objs.append(o)
    return objs


_PUFF_N = [0]


def dust_puff(at, frame, size=1.0, n=9, color=None, opacity=0.5, seed=None, drift=(0.15, -0.05, 0.0)):
    """A footfall / impact puff of ash at `at` ((x, y) on the terrain or (x, y, z)) on absolute `frame`.
    size 1 = a footstep; 2-3 = a body hitting the ground."""
    _PUFF_N[0] += 1
    p = Vector((at[0], at[1], _ground(at[0], at[1]) if len(at) == 2 else at[2]))
    sd = seed if seed is not None else 1000 + _PUFF_N[0]
    return puff(f"Dust{_PUFF_N[0]}_", p + Vector((0, 0, 0.03 * size)), frame, n=n, spread=0.08 * size,
                grow=(0.04 * size, 0.28 * size), life=(0.6, 1.3 * (0.7 + 0.3 * size)), rise=0.12 * size,
                drift=drift, color=color, opacity=opacity, seed=sd)


def slide_dust(points, size=1.6):
    """Dust clouds for mountain.scree_slide's [(pos, frame)]."""
    out = []
    for i, (p, f) in enumerate(points):
        out += dust_puff((p.x, p.y, p.z), f, size=size * (0.8 + 0.4 * ((i * 7) % 5) / 5), n=6, seed=4000 + i,
                         opacity=0.6)
    return out


def sparks(origin, frame, n=30, speed=(1.2, 3.2), life=(0.3, 0.9), gravity=-2.5, up=0.7, size=0.012, seed=0,
           name="Sparks"):
    """A burst of glowing ember sparks from origin at absolute frame (streaks, gravity, fading)."""
    col = geo.coll("FX")
    rng = np.random.default_rng(seed)
    m = _ember_mat()
    O = Vector(origin)
    fps = _fps()
    me = None
    objs = []
    for i in range(n):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * up + d.z * (1 - up)
        v = d * rng.uniform(*speed)
        L = rng.uniform(*life)
        o = geo.lathe(f"{name}{i}", [(0.0, -1.0), (size, -0.6), (size * 0.6, 0.0), (0.0, 0.05)], seg=6, collection=col,
                      mat=m)
        o.visible_shadow = False
        frames, mats, lifev = [], [], []
        for f in range(frame - 1, frame + int(L * fps) + 2):
            t = max(0.0, (f - frame) / fps)
            p = O + v * t + Vector((0, 0, 0.5 * gravity * t * t))
            vel = v + Vector((0, 0, gravity * t))
            lv = max(0.0, 1 - t / L) ** 1.5 if f >= frame else 0.0
            o.matrix_world = Matrix.Translation(p) @ vel.normalized().to_track_quat("Z", "Y").to_matrix().to_4x4() @ \
                Matrix.Diagonal((1, 1, max(0.02, vel.length * 0.03), 1))
            o["life"] = lv
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
            o.keyframe_insert("scale", frame=f)
            o.keyframe_insert('["life"]', frame=f)
        objs.append(o)
    # sparks use the instancer 'life' attribute in the shader; for plain objects read the object attribute instead
    return objs


# --------------------------------------------------------------------- smoke
def _smoke_mat(name="FXSmoke", dark=0.55, opacity=0.6):
    m = bpy.data.materials.get(name)
    if m:
        return m
    from . import envmat
    m, nb = _new_mat(name)
    P = _pal(nb)
    E = envmat.env(nb)
    T = E.outputs["Time"]
    gen = nb.n("ShaderNodeTexCoord").outputs["Generated"]
    gx, gy, gz = (nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen}).outputs[i] for i in range(3))
    oi = nb.n("ShaderNodeObjectInfo")
    rnd = oi.outputs["Random"]
    # column: widens with height, wavers; scrolling noise rising
    v = nb.n("ShaderNodeCombineXYZ")
    nb.inp(v, "X", nb.mul(gx, 2.0))
    nb.inp(v, "Y", nb.sub(nb.mul(gz, 3.0), nb.mul(T, 0.22)))
    nb.inp(v, "Z", nb.add(nb.mul(rnd, 20.0), nb.mul(T, 0.05)))
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 2.2, "Detail": 4.0, "Roughness": 0.6, "Distortion": 0.6})
    nb.link(v.outputs[0], nz.inputs["Vector"])
    st = mat.tex_node(nb, "strokes_soft", v.outputs[0], 0.6)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    width = nb.add(0.06, nb.mul(gz, 0.22))
    cxw = nb.add(0.5, nb.mul(nb.sub(nz.outputs["Fac"], 0.5), nb.mul(gz, 0.25)))
    dx = nb.math("ABSOLUTE", nb.sub(gx, cxw))
    shape = nb.mapr(nb.math("DIVIDE", dx, width), 1.0, 0.25)
    dens = nb.mapr(nb.add(nz.outputs["Fac"], nb.mul(nb.sub(sv, 0.5), 0.6)), 0.38, 0.7)
    alpha = nb.mul(nb.mul(shape, dens), nb.mul(nb.mapr(gz, 0.0, 0.08), nb.mapr(gz, 1.0, 0.65)))
    alpha = nb.mul(alpha, opacity)
    # soft contact with the ground: the card starts 1 m below it; fade in over obj['fadeh'] metres above the ground
    oz = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": nb.n("ShaderNodeTexCoord").outputs["Object"]}).outputs[2]
    fh = nb.n("ShaderNodeAttribute", attribute_name="fadeh", attribute_type="OBJECT").outputs["Fac"]
    alpha = nb.mul(alpha, nb.math("POWER", nb.math("MINIMUM", nb.math("MAXIMUM", nb.math("DIVIDE", nb.sub(oz, 1.0),
                                                                                             nb.math("MAXIMUM", fh, 0.1)), 0.0), 1.0), 1.5))
    lit = nb.mapr(nb.sub(gx, cxw), -0.2, 0.25)
    col = nb.mix(lit, _scale(nb, P.outputs["Haze"], dark * 0.75), _scale(nb, P.outputs["HazeLow"], dark * 1.15))
    return _finish(m, nb, col, alpha)


def smoke_column(at, height=40.0, width=None, name="SmokeCol", lean=0.25, opacity=0.45, dark=0.55):
    """A painted smoke column rising from `at` (x, y): a camera-facing billboard (Z up) with a rising, wavering,
    widening animated shader. Leans downwind (ESE)."""
    w = width or height * 0.6
    x, y = at[0], at[1]
    z = _ground(x, y)
    m = _smoke_mat(f"FXSmoke_{dark:.2f}_{opacity:.2f}", dark, opacity)
    verts = [(-w / 2, 0, 0), (w / 2, 0, 0), (w / 2 + lean * height, 0, height), (-w / 2 + lean * height, 0, height)]
    o = geo.obj_from(name, verts, [(0, 1, 2, 3)], geo.coll("FX"), m, smooth=False)
    o.location = (x, y, z - 1.0)
    o["fadeh"] = max(0.9, 0.08 * height)
    o.visible_shadow = False
    cam = bpy.context.scene.camera
    if cam:
        c = o.constraints.new("LOCKED_TRACK")
        c.target = cam
        c.track_axis = "TRACK_NEGATIVE_Y"
        c.lock_axis = "LOCK_Z"
    return o


def smoke_wisps(center, radius=20.0, n=12, height=(1.5, 4.0), seed=11, name="SmokeWisp", opacity=0.35):
    """Low smouldering wisps scattered on the valley floor (short smoke billboards)."""
    rng = np.random.default_rng(seed)
    out = []
    for i in range(n):
        r = radius * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        h = rng.uniform(*height)
        out.append(smoke_column((center[0] + r * math.cos(a), center[1] + r * math.sin(a)), h, h * 0.7,
                                name=f"{name}{i}", lean=0.6, opacity=opacity, dark=0.75))
    return out


# --------------------------------------------------------------------- lightning
def _bolt_mat():
    m = bpy.data.materials.get("FXBolt")
    if m:
        return m
    m, nb = _new_mat("FXBolt")
    k = nb.n("ShaderNodeAttribute", attribute_name="bolt", attribute_type="OBJECT").outputs["Fac"]
    col = _scale(nb, _rgb(nb, (0.86, 0.84, 1.0)), nb.mul(k, 40.0))
    return _finish(m, nb, col, None, additive=True)


def _fork(rng, a, b, depth, jag, out, branch_p=0.45, w=1.0):
    pts = [a, b]
    for d in range(depth):
        new = [pts[0]]
        for p, q in zip(pts[:-1], pts[1:]):
            mid = (p + q) * 0.5
            L = (q - p).length
            off = Vector(rng.normal(0, 1, 3))
            off -= (q - p).normalized() * off.dot((q - p).normalized())
            new += [mid + off * L * jag, q]
        pts = new
    out.append((pts, w))
    if w > 0.25:
        for i in range(2, len(pts) - 3, 3):
            if rng.random() < branch_p * w:
                p = pts[i]
                dvec = (pts[-1] - pts[0]).normalized()
                bd = (dvec + Vector(rng.normal(0, 0.8, 3))).normalized()
                bd.z = -abs(bd.z) - 0.3
                L = (pts[-1] - pts[0]).length * rng.uniform(0.12, 0.3) * w
                _fork(rng, p, p + bd.normalized() * L, max(3, depth - 2), jag, out, branch_p * 0.6, w * 0.5)


def lightning(frame, start=None, end=None, width=0.6, flash=1.0, light=True, seed=0, sky_flash=True, name="Bolt",
              az=None, el=None):
    """A forked lightning bolt visible for ~5 frames from `frame` (flicker: on, dim, on, fading), a huge cold light
    at its root for the flash, the sky lit from inside the storm (sky.flash) and the wet-surface sheen (LU_Env Flash).
    start/end: world points (default a bolt in the storm to the WNW striking the far valley)."""
    from . import sky, envmat
    rng = np.random.default_rng(seed)
    us = sky.storm_vec()
    if end is None:
        end = Vector((us.x * 260.0 + rng.normal(0, 40), us.y * 260.0 + 60 + rng.normal(0, 40), 0.0))
        end.z = _ground(end.x, end.y)
    end = Vector(end)
    if start is None:
        start = end + Vector((rng.normal(0, 30), rng.normal(0, 30), 230.0))
    start = Vector(start)
    segs = []
    _fork(rng, start, end, 7, 0.11, segs)
    from .dress import MB, tube
    mb = MB()
    for pts, w in segs:
        r = width * w * 0.5
        tube(mb, pts, [r * (1.0 - 0.55 * i / len(pts)) for i in range(len(pts))], 5, (1, 1, 1), (1, 1, 1), cap=False)
    o = mb.build(name, geo.coll("FX"), _bolt_mat())
    o.visible_shadow = False
    seq_b = [(frame - 1, 0.0), (frame, 1.0), (frame + 1, 0.4), (frame + 2, 1.0), (frame + 3, 0.7), (frame + 4, 0.45),
             (frame + 6, 0.0)]
    seq = [(frame - 1, 0.0), (frame, 1.0), (frame + 1, 0.15), (frame + 2, 0.8), (frame + 3, 0.1), (frame + 4, 0.0)]
    for f, v in seq_b:
        o["bolt"] = v
        o.keyframe_insert('["bolt"]', frame=f)
    _bake(o, [frame - 2, frame, frame + 6], np.array([1.0, 0.0, 1.0])[:, None], "hide_render", interp="CONSTANT")
    out = dict(bolt=o)
    if light:
        ld = bpy.data.lights.new(name + "Light", "POINT")
        ld.color = (0.78, 0.8, 1.0)
        ld.shadow_soft_size = 20.0
        lo = bpy.data.objects.new(name + "Light", ld)
        bpy.context.scene.collection.objects.link(lo)
        lo.location = start * 0.5 + end * 0.5
        d = (lo.location - Vector((0, 0, 0))).length
        e = 2.2e6 * flash * (d / 250.0) ** 2
        for f, v in seq:
            ld.energy = e * v
            ld.keyframe_insert("energy", frame=f)
        out["light"] = lo
    if sky_flash:
        h = Vector((start.x, start.y, 0))
        a = math.degrees(math.atan2(h.y, h.x)) if az is None else az
        sky.flash(frame, flash, az=a, el=el if el is not None else 12.0)
    for f, v in seq:
        envmat.set_env(f, Flash=v * flash)
    return out


# --------------------------------------------------------------------- chips (Claude's hail damage)
def _chip_mat():
    m = bpy.data.materials.get("FXChip")
    if m:
        return m
    from .dress import _inst_albedo
    return mat.painterly("FXChip", (1, 1, 1), stroke="strokes_fine", scale=20.0, tex_amt=0.6, breakup=1.2, snow=0.0,
                         albedo_fn=lambda nb, co: nb.n("ShaderNodeAttribute", attribute_name="col",
                                                       attribute_type="GEOMETRY").outputs["Color"])


def chips(origin, frame, n=7, direction=None, speed=(1.2, 2.6), gravity=-9.0, floor_z=None, size=(0.012, 0.03),
          color=(0.70, 0.18, 0.10), inner=(0.86, 0.74, 0.60), seed=0, name="Chip"):
    """Small fragments knocked off a point (Claude's body edge under the hail): orange painted shell outside, pale
    clay inside, plus a few clay crumbs; they fly out (cone around `direction`), spin, fall and settle on the ground."""
    from .dress import MB
    rng = np.random.default_rng(seed)
    O = Vector(origin)
    fps = _fps()
    col = geo.coll("FX")
    m = _chip_mat()
    dirv = Vector(direction).normalized() if direction is not None else Vector((0, 0, 1))
    fz = floor_z if floor_z is not None else _ground(O.x, O.y)
    objs = []
    for i in range(n):
        crumb = i >= n * 0.65
        s = rng.uniform(*size) * (0.6 if crumb else 1.0)
        mb = MB()
        # a wedge: outer face orange, inner faces clay
        pts = [Vector((rng.uniform(-1, 1), rng.uniform(-1, 1), 0)).normalized() * s * rng.uniform(0.7, 1.2) for _ in range(5)]
        top = [p + Vector((0, 0, s * 0.45)) for p in pts]
        oc = inner if crumb else color
        ids_b = [mb.vert(p, (0, 0), inner, (0, 0, -1)) for p in pts]
        ids_t = [mb.vert(p, (0, 0), oc, (0, 0, 1)) for p in top]
        mb.face(*reversed(ids_b))
        mb.face(*ids_t)
        for k in range(5):
            k2 = (k + 1) % 5
            a, b = mb.vert(pts[k], (0, 0), inner, pts[k]), mb.vert(pts[k2], (0, 0), inner, pts[k2])
            c, d = mb.vert(top[k2], (0, 0), inner, pts[k2]), mb.vert(top[k], (0, 0), inner, pts[k])
            mb.face(a, b, c, d)
        o = mb.build(f"{name}{seed}_{i}", col, m)
        o.visible_shadow = True
        d = (dirv + Vector(rng.normal(0, 0.55, 3))).normalized()
        v = d * rng.uniform(*speed)
        spin = Vector(rng.normal(0, 14, 3))
        frames, locs, rots = [], [], []
        landed = None
        for f in range(frame - 1, frame + int(1.6 * fps)):
            t = max(0.0, (f - frame) / fps)
            p = O + v * t + Vector((0, 0, 0.5 * gravity * t * t))
            if p.z < fz + s * 0.3:
                if landed is None:
                    landed = (p.x, p.y, t)
                p = Vector((landed[0], landed[1], fz + s * 0.3))
                r = spin * landed[2]
            else:
                r = spin * t
            frames.append(f)
            locs.append(tuple(p))
            rots.append(tuple(r))
        _bake(o, frames, np.array(locs), "location")
        _bake(o, frames, np.array(rots), "rotation_euler")
        _vis_window(o, frame, bpy.context.scene.frame_end + 1000)
        objs.append(o)
    return objs


# --------------------------------------------------------------------- the sunbeam
def _beam_mat():
    m = bpy.data.materials.get("FXSunbeam")
    if m:
        return m
    from . import envmat
    m, nb = _new_mat("FXSunbeam")
    P = _pal(nb)
    E = envmat.env(nb)
    k = nb.n("ShaderNodeAttribute", attribute_name="beam", attribute_type="OBJECT").outputs["Fac"]
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.55})
    core = nb.math("POWER", nb.mapr(lw.outputs["Facing"], 0.0, 1.0, 1.0, 0.0, interp="LINEAR"), 2.6)
    gen = nb.n("ShaderNodeTexCoord").outputs["Generated"]
    gx, gy, gz = (nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen}).outputs[i] for i in range(3))
    ob = nb.n("ShaderNodeTexCoord").outputs["Object"]
    sx, sy, sz = (nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": ob}).outputs[i] for i in range(3))
    ang = nb.math("ARCTAN2", sy, sx)
    sv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(sv, "X", nb.mul(ang, 3.0))
    nb.inp(sv, "Y", nb.sub(nb.mul(sz, 0.02), nb.mul(E.outputs["Time"], 0.03)))
    st = mat.tex_node(nb, "strokes_vert", sv.outputs[0], 1.0)
    streak = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    along = nb.mul(nb.mapr(gz, 0.0, 0.03), nb.mapr(gz, 1.0, 0.35))
    a = nb.mul(nb.mul(core, along), nb.add(0.45, nb.mul(streak, 0.9)))
    col = nb.mix(0.35, P.outputs["Ray"], (1.0, 0.92, 0.7))
    col = _scale(nb, col, nb.mul(nb.mul(a, k), 1.8))
    return _finish(m, nb, col, None, additive=True)


def _glow_mat():
    m = bpy.data.materials.get("FXGlowOrb")
    if m:
        return m
    m, nb = _new_mat("FXGlowOrb")
    P = _pal(nb)
    k = nb.n("ShaderNodeAttribute", attribute_name="glow", attribute_type="OBJECT").outputs["Fac"]
    gen = nb.n("ShaderNodeTexCoord").outputs["Generated"]
    gx, gy, gz = (nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen}).outputs[i] for i in range(3))
    dx, dz = nb.sub(gx, 0.5), nb.sub(gz, 0.5)
    r = nb.math("SQRT", nb.add(nb.mul(dx, dx), nb.mul(dz, dz)))
    a = nb.math("POWER", nb.mapr(r, 0.5, 0.0, 0.0, 1.0, interp="LINEAR"), 2.2)
    col = _scale(nb, nb.mix(0.4, P.outputs["SunGlow"], P.outputs["HoleSky"]), nb.mul(a, k))
    return _finish(m, nb, col, None, additive=True)


def glow_orb(at, radius=30.0, strength=0.35, name="GlowOrb"):
    """A soft additive glow (lit haze) around a point, a camera-facing disc: the summit's patch of sun seen from
    the valley. obj['glow'] is keyable."""
    m = _glow_mat()
    verts = [(-radius, 0, -radius), (radius, 0, -radius), (radius, 0, radius), (-radius, 0, radius)]
    o = geo.obj_from(name, verts, [(0, 1, 2, 3)], geo.coll("FX"), m, smooth=False)
    o.location = at
    o["glow"] = strength
    o.visible_shadow = False
    cam = bpy.context.scene.camera
    if cam:
        c = o.constraints.new("TRACK_TO")
        c.target = cam
        c.track_axis = "TRACK_NEGATIVE_Y"
        c.up_axis = "UP_Z"
    return o


def track_camera(objs, cam=None):
    """(Re)aim camera-facing FX billboards (smoke columns, rain sheets, glows) at the shot camera (call after the
    camera exists if the FX were built before it)."""
    cam = cam or bpy.context.scene.camera
    for o in objs:
        for c in o.constraints:
            if c.type in ("LOCKED_TRACK", "TRACK_TO"):
                c.target = cam
        if not o.constraints and cam:
            c = o.constraints.new("LOCKED_TRACK")
            c.target = cam
            c.track_axis = "TRACK_NEGATIVE_Y"
            c.lock_axis = "LOCK_Z"


def sunbeam(target=None, radius=2.4, length=420.0, f0=None, keys=None, spread=1.2, motes_n=260, name="Sunbeam",
            strength=1.0, contact=True):
    """The golden shaft of the last sun: a long soft cone from the sky (along the sun direction) down onto target
    (default PEAK_SOIL), additive painted streaks drifting down it, dust motes dancing inside its lower part.
    keys = [(frame, 0..1), ...] opens / closes it (scales its glow and width). Returns dict(beam, motes)."""
    from . import sky, terrain
    if target is None:
        target = (layout.PEAK_SOIL[0], layout.PEAK_SOIL[1], float(terrain.height(*layout.PEAK_SOIL)))
    T = Vector(target)
    sd = sky.sun_vec()
    o = geo.lathe(name, [(radius * 0.92, -1.0), (radius, 0.0), (radius * spread, length)], seg=40, collection=geo.coll("FX"),
                  mat=_beam_mat(), cap_top=False, cap_bot=False)
    o.matrix_basis = Matrix.Translation(T) @ sd.to_track_quat("Z", "Y").to_matrix().to_4x4()
    o.visible_shadow = False
    o["beam"] = strength
    if keys:
        for f, v in keys:
            o["beam"] = v
            o.keyframe_insert('["beam"]', frame=f)
            s = 0.25 + 0.75 * v
            o.scale = (s, s, 1.0)
            o.keyframe_insert("scale", frame=f)
    out = dict(beam=o)
    if contact:
        g = glow_orb(T + Vector((0, 0, 0.5)), radius * 1.1, 0.22 * strength, name=name + "Contact")
        out["contact"] = g
        if keys:
            for f, v in keys:
                g["glow"] = 0.22 * strength * v
                g.keyframe_insert('["glow"]', frame=f)
    if motes_n:
        c = T + sd * 3.0
        out["motes"] = motes(tuple(c), (radius * 1.6, radius * 1.6, 6.5), motes_n, f0, mote=(0.006, 0.014),
                             color=(1.0, 0.8, 0.45), k=4.5, speed=0.1, amp=0.7, rise=-0.02, seed=31, name=name + "Motes")
        if keys:
            for f, v in keys:
                amount(out["motes"], f, v)
    return out


# --------------------------------------------------------------------- rain sheets
def _sheet_mat():
    m = bpy.data.materials.get("FXRainSheet")
    if m:
        return m
    from . import envmat
    m, nb = _new_mat("FXRainSheet")
    P = _pal(nb)
    E = envmat.env(nb)
    gen = nb.n("ShaderNodeTexCoord").outputs["Generated"]
    gx, gy, gz = (nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gen}).outputs[i] for i in range(3))
    oi = nb.n("ShaderNodeObjectInfo")
    v = nb.n("ShaderNodeCombineXYZ")
    nb.inp(v, "X", nb.add(nb.mul(gx, 3.0), nb.mul(oi.outputs["Random"], 9.0)))
    nb.inp(v, "Y", nb.add(nb.mul(gz, 0.6), nb.mul(E.outputs["Time"], 1.4)))
    st = mat.tex_node(nb, "strokes_vert", v.outputs[0], 1.0)
    sv = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 3.0, "Detail": 2.0})
    v2 = nb.n("ShaderNodeCombineXYZ")
    nb.inp(v2, "X", nb.mul(gx, 2.0))
    nb.inp(v2, "Y", nb.add(gz, nb.mul(E.outputs["Time"], 0.4)))
    nb.inp(v2, "Z", nb.mul(oi.outputs["Random"], 5.0))
    nb.link(v2.outputs[0], nz.inputs["Vector"])
    a = nb.mul(nb.mapr(nb.add(sv, nb.mul(nb.sub(nz.outputs["Fac"], 0.5), 0.8)), 0.45, 0.85), 0.42)
    a = nb.mul(a, nb.mul(nb.mul(nb.mapr(gx, 0.0, 0.18), nb.mapr(gx, 1.0, 0.82)), nb.mapr(gz, 1.0, 0.7)))
    col = _scale(nb, nb.mix(0.4, P.outputs["Rain"], P.outputs["Light"]), 1.15)
    return _finish(m, nb, col, a)


def rain_sheets(center, radius=60.0, n=10, f0=None, height=(25.0, 60.0), width=(20.0, 45.0), seed=12, name="RainSheet",
                lean=0.18):
    """Big drifting rain curtains (veils of streaks) around center, facing the camera."""
    rng = np.random.default_rng(seed)
    out = []
    m = _sheet_mat()
    cam = bpy.context.scene.camera
    for i in range(n):
        r = radius * (0.35 + 0.65 * math.sqrt(rng.random()))
        a = rng.uniform(0, TAU)
        x, y = center[0] + r * math.cos(a), center[1] + r * math.sin(a)
        h = rng.uniform(*height)
        w = rng.uniform(*width)
        verts = [(-w / 2, 0, 0), (w / 2, 0, 0), (w / 2 + lean * h, 0, h), (-w / 2 + lean * h, 0, h)]
        o = geo.obj_from(f"{name}{i}", verts, [(0, 1, 2, 3)], geo.coll("FX"), m, smooth=False)
        o.location = (x, y, _ground(x, y) - 2.0)
        o.visible_shadow = False
        if cam:
            c = o.constraints.new("LOCKED_TRACK")
            c.target = cam
            c.track_axis = "TRACK_NEGATIVE_Y"
            c.lock_axis = "LOCK_Z"
        out.append(o)
    return out


# --------------------------------------------------------------------- petals
def _petal_paths(rng, n, p0s, t0s, v0s, f0, f1, wind, drag=2.2, sink=0.28, flutter=0.06):
    fps = _fps()
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
                frames.append(f)
                locs.append(tuple(p0s[i]))
                rots.append((0.0, 0.0, 0.0))
                continue
            e = (1 - math.exp(-drag * t)) / drag
            p = p0s[i] + vt * t + (v0s[i] - vt) * e
            p += Vector((math.sin(t * 6 + ph[0]), math.cos(t * 5 + ph[1]), 0.4 * math.sin(t * 7 + ph[2]))) * flutter * min(1, t * 2)
            g = _ground(p.x, p.y) + 0.04
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


def petal_burst(origin, frame, n=60, f1=None, speed=(0.8, 2.4), up=0.75, size=(0.02, 0.034), seed=0,
                colors=PETAL_COLS, wind=(0.4, -0.15, 0.0), spread=0.25, name="Petals"):
    """Petals bursting up from origin at absolute frame: they fly out, flutter, drift down and settle."""
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
    paths = _petal_paths(rng, n, p0s, t0s, v0s, frame, f1, wind)
    objs = []
    for i, (frames, locs, rots) in enumerate(paths):
        c = colors[int(rng.integers(0, len(colors)))]
        src = _petal_obj(c, f"FXP_PetalC{colors.index(c)}")
        o = bpy.data.objects.new(f"{name}{i}", src.data)
        col.objects.link(o)
        s = rng.uniform(*size) / 0.5
        o.scale = (s, s * rng.uniform(1.0, 1.6), s)
        o.visible_shadow = False
        _bake(o, frames, np.array(locs), "location")
        _bake(o, frames, np.array(rots), "rotation_euler")
        _vis_window(o, frame, f1)
        objs.append(o)
    return objs


def pollen_burst(origin, frame, n=90, f1=None, seed=0, name="PollenBurst"):
    """A puff of glowing pollen specks drifting up and out from origin at absolute frame (a GN drift field)."""
    f = pollen(tuple(Vector(origin) + Vector((0, 0, 0.6))), (1.6, 1.6, 1.2), n, frame, seed=seed, name=name)
    amount(f, frame - 1, 0.0)
    amount(f, frame + 2, 1.0)
    if f1:
        amount(f, f1 - 12, 1.0)
        amount(f, f1, 0.0)
    return f


def falling_petal(target, f_land, dur=3.0, height=2.6, sway=0.45, color=(1.0, 0.55, 0.72), size=0.045, seed=0,
                  offset=(0.0, 0.0, 0.0), name="FallingPetal", leaf=False):
    """One petal (or a fresh leaf, leaf=True) drifting down in a lazy pendulum flutter and landing exactly on target
    at absolute frame f_land (B20 'the pat'). target: an object (the petal lands on its origin + offset and stays
    parented to it, riding along) or a world point. The path is built backwards from the landing point."""
    fps = _fps()
    rng = np.random.default_rng(seed)
    src = _petal_obj((0.28, 0.55, 0.07) if leaf else color, "FXP_LeafFall" if leaf else f"FXP_PetalFall")
    o = bpy.data.objects.new(name, src.data)
    geo.coll("FX").objects.link(o)
    o.visible_shadow = True
    s = size / 0.5
    o.scale = (s, s * 1.3, s)
    sc = bpy.context.scene
    is_obj = hasattr(target, "matrix_world")
    f0 = f_land - int(dur * fps)
    frames, locs, rots = [], [], []
    ph = rng.uniform(0, TAU)
    for f in range(f0, f_land + 1):
        u = (f - f0) / max(f_land - f0, 1)
        t = (f - f0) / fps
        if is_obj:
            sc.frame_set(f)
            L = target.matrix_world @ Vector(offset)
        else:
            L = Vector(target) + Vector(offset)
        rem = 1 - u
        sw = math.sin(t * 2.4 + ph) * sway * rem ** 0.8
        p = L + Vector((sw, 0.4 * sway * math.sin(t * 1.3 + ph) * rem, height * (rem ** 1.15)))
        roll = 0.9 * math.cos(t * 2.4 + ph) * rem
        frames.append(f)
        locs.append(tuple(p))
        rots.append((roll, 0.25 * math.sin(t * 3.1) * rem, t * 0.8 * rem + ph))
    _bake(o, frames, np.array(locs), "location")
    _bake(o, frames, np.array(rots), "rotation_euler")
    _vis_window(o, f0, sc.frame_end + 1000)
    if is_obj:
        # after landing: stay on the target (a Child Of constraint switched on at f_land)
        c = o.constraints.new("CHILD_OF")
        c.target = target
        sc.frame_set(f_land)
        c.inverse_matrix = target.matrix_world.inverted()
        c.influence = 0.0
        c.keyframe_insert("influence", frame=f_land - 1)
        c.influence = 1.0
        c.keyframe_insert("influence", frame=f_land)
    return o
