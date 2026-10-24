"""Environment materials for BLOOM, built on mat.painterly (Shader-to-RGB painterly lighting, LU_Look grade) plus
shared, keyable environment controls.

Controls (one shader node group "LU_Env", read by every environment material):
  BloomR   bloom wave radius (m from PEAK_SOIL), driven by the Empty "LU_Bloom" (location.x) -> keyable with
           world.bloom_wave(); geometry nodes read the same Empty, so ground, cover, trees and FX agree.
  BloomW   width (m) of the glowing wave front (LU_Bloom location.y).
  Time     seconds (frame / 24).
  Wet      0..1 storm wetness (darker ground, sheen at grazing angles).
  Ember    0..1 glow of embers in ash, cracks and char.
  Flash    0..1 lightning flash (cool rim sheen on wet surfaces; the light itself comes from fx.lightning).
  Lush     0..1.5 extra lushness of bloomed surfaces (the coda is greener and denser).
  CloudShade 0..1 drifting cloud shadows across the land (bloom / coda / threat); see cloud_shadows().
set_env(frame=None, **values) sets (and with frame, keys) Wet / Ember / Flash / Lush / CloudShade.

Materials: ground() terrain, char_bark(name, cell) charred wood (alligator checks, ember cracks, silver sheen; turns
into living bark behind the bloom wave), rock(name) strata rock with lichen (moss after the bloom), far_ridge(layer)
painted haze silhouettes, soil(), plus helpers bloom_nodes(nb, pos) that return the (grown, front) sockets.
"""
import math
import bpy

from . import mat, layout
from .terrain import BLOOM_WARP, BLOOM_WARP_R

NB = mat.NB
ENV = "LU_Env"
BLOOM_EMPTY = "LU_Bloom"
ENV_DEFAULTS = dict(Wet=0.0, Ember=0.0, Flash=0.0, Lush=0.0, CloudShade=0.0)
GROW_LEN = 22.0           # metres behind the wave front over which the ground's colour turns
BAND_W = 7.0


# ====================================================================== controls
def bloom_empty():
    o = bpy.data.objects.get(BLOOM_EMPTY)
    if o is None:
        o = bpy.data.objects.new(BLOOM_EMPTY, None)
        bpy.context.scene.collection.objects.link(o)
        o.location = (-80.0, BAND_W, 0.0)        # radius < 0: nothing has bloomed
        o.hide_render = True
        o.empty_display_size = 2.0
    return o


def env_group():
    g = bpy.data.node_groups.get(ENV)
    if g:
        return g
    g = bpy.data.node_groups.new(ENV, "ShaderNodeTree")
    out = g.nodes.new("NodeGroupOutput")
    E = bloom_empty()
    for k in ("BloomR", "BloomW", "Time") + tuple(ENV_DEFAULTS):
        g.interface.new_socket(k, in_out="OUTPUT", socket_type="NodeSocketFloat")
        v = g.nodes.new("ShaderNodeValue")
        v.name = v.label = k
        g.links.new(v.outputs[0], out.inputs[k])
        if k in ENV_DEFAULTS:
            v.outputs[0].default_value = ENV_DEFAULTS[k]
        elif k == "Time":
            fc = v.outputs[0].driver_add("default_value")
            fc.driver.type = "SCRIPTED"
            fc.driver.expression = "frame/24"
        else:
            fc = v.outputs[0].driver_add("default_value")
            fc.driver.type = "AVERAGE"
            var = fc.driver.variables.new()
            var.type = "TRANSFORMS"
            var.targets[0].id = E
            var.targets[0].transform_type = "LOC_X" if k == "BloomR" else "LOC_Y"
            var.targets[0].transform_space = "WORLD_SPACE"
    return g


def set_env(frame=None, **kw):
    """Set (and with frame=, key) LU_Env values: Wet, Ember, Flash, Lush."""
    g = env_group()
    for k, v in kw.items():
        node = g.nodes[k]
        node.outputs[0].default_value = float(v)
        if frame is not None:
            node.outputs[0].keyframe_insert("default_value", frame=frame)


def env(nb):
    n = nb.n("ShaderNodeGroup")
    n.node_tree = env_group()
    return n


# ====================================================================== shared node snippets
def _rgb(nb, c):
    n = nb.n("ShaderNodeRGB")
    n.outputs[0].default_value = (*c[:3], 1.0)
    return n.outputs[0]


def _sep(nb, v):
    s = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": v})
    return s.outputs[0], s.outputs[1], s.outputs[2]


def _sepc(nb, c):
    s = nb.n("ShaderNodeSeparateColor", inputs={"Color": c})
    return s.outputs[0], s.outputs[1], s.outputs[2]


def _attr(nb, name, kind="GEOMETRY"):
    return nb.n("ShaderNodeAttribute", attribute_name=name, attribute_type=kind)


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


def _noise(nb, vec, scale, detail=2.0, rough=0.5, dist=0.0):
    n = nb.n("ShaderNodeTexNoise", inputs={"Scale": scale, "Detail": detail, "Roughness": rough, "Distortion": dist})
    nb.link(vec, n.inputs["Vector"])
    return n


def _gauss(nb, x, w):
    q = nb.math("DIVIDE", x, w)
    return nb.math("EXPONENT", nb.mul(nb.mul(q, q), -1.0))


def position(nb):
    return nb.n("ShaderNodeNewGeometry").outputs["Position"]


def bloom_dist_nodes(nb, pos):
    """The analytic bloom distance (terrain.bloom_dist) in shader nodes."""
    x, y, _z = _sep(nb, pos)
    px, py = layout.PEAK_SOIL
    dx, dy = nb.sub(x, px), nb.sub(y, py)
    d = nb.math("SQRT", nb.add(nb.mul(dx, dx), nb.mul(dy, dy)))
    w = None
    for (A, k1x, k1y, p1, k2x, k2y, p2) in BLOOM_WARP:
        s1 = nb.math("SINE", nb.add(nb.add(nb.mul(x, k1x), nb.mul(y, k1y)), p1))
        s2 = nb.math("SINE", nb.add(nb.add(nb.mul(x, k2x), nb.mul(y, k2y)), p2))
        t = nb.mul(nb.mul(s1, s2), A)
        w = t if w is None else nb.add(w, t)
    return nb.add(d, nb.mul(w, nb.mapr(d, BLOOM_WARP_R[0], BLOOM_WARP_R[1])))


def front_glow(nb, pos, front, xw, E, k=1.0):
    """The wave front's light: a thin bright gold line exactly at the front, a soft spring-green glow trailing behind
    it, both broken by noise into flickering filaments of growth."""
    T = E.outputs["Time"]
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 0.35, "Detail": 3.0, "Roughness": 0.6, "Distortion": 1.2},
              noise_dimensions="4D")
    nb.link(pos, nz.inputs["Vector"])
    nb.link(nb.mul(T, 0.8), nz.inputs["W"])
    brk = nb.mapr(nz.outputs["Fac"], 0.35, 0.65, 0.25, 1.3)
    line = nb.mul(_gauss(nb, nb.sub(xw, 0.6), 0.9), nb.mapr(xw, -1.0, 0.0))
    trail = nb.mul(front, 0.55)
    gold = _scale(nb, _rgb(nb, (1.0, 0.78, 0.30)), nb.mul(nb.mul(line, brk), 1.6 * k))
    green = _scale(nb, _rgb(nb, (0.45, 0.95, 0.30)), nb.mul(nb.mul(trail, brk), 0.7 * k))
    return _vadd(nb, gold, green)


def bloom_nodes(nb, pos=None, delay=None, grow=GROW_LEN, E=None):
    """(grown 0..1, front band 0..1, x = R - d) at pos (default: shading point). delay: socket/float metres added to
    the distance (e.g. height along a trunk, so the change climbs it)."""
    E = E or env(nb)
    pos = pos if pos is not None else position(nb)
    d = bloom_dist_nodes(nb, pos)
    if delay is not None:
        d = nb.add(d, delay)
    x = nb.sub(E.outputs["BloomR"], d)
    grown = nb.mapr(x, 0.0, grow)
    front = nb.mul(_gauss(nb, nb.sub(x, nb.mul(E.outputs["BloomW"], 0.5)), E.outputs["BloomW"]),
                   nb.mapr(x, -2.0, 0.5))
    return grown, front, x


def _patch_emission(m, col_socket_fn):
    """Add an emissive term (built by col_socket_fn(nb) -> colour socket) to a painterly material's output colour."""
    nt = m.node_tree
    nb = NB(nt)
    em = [n for n in nt.nodes if n.type == "EMISSION"][-1]
    src = em.inputs["Color"].links[0].from_socket
    add = nb.mix(1.0, src, col_socket_fn(nb), blend="ADD")
    nt.links.new(add, em.inputs["Color"])


def _patch_bump(m, height_fn, strength=0.3, distance=0.02):
    """Chain an extra bump (height_fn(nb) -> float socket) under the painterly material's own brush bump."""
    nt = m.node_tree
    nb = NB(nt)
    bm = [n for n in nt.nodes if n.type == "BUMP"][0]
    b2 = nb.n("ShaderNodeBump", inputs={"Strength": strength, "Distance": distance})
    nb.inp(b2, "Height", height_fn(nb))
    nt.links.new(b2.outputs[0], bm.inputs["Normal"])
    return b2


def _wet_flash(nb, E, k_wet=0.07, k_flash=0.5, mask=None):
    """Sheen at grazing angles on wet surfaces + a cold rim when lightning flashes."""
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.25})
    fr = nb.math("POWER", lw.outputs["Facing"], 3.0)
    w = nb.add(nb.mul(E.outputs["Wet"], k_wet), nb.mul(nb.mul(E.outputs["Flash"], E.outputs["Wet"]), k_flash))
    if mask is not None:
        w = nb.mul(w, mask)
    return _scale(nb, _rgb(nb, (0.62, 0.68, 0.9)), nb.mul(fr, w))


def backlight(nb, pos=None, k=1.0):
    """Sun-side rim: surfaces seen edge-on while looking toward the low sun glow gold (dust and ash catching the
    backlight), strongly near the summit where the sun patch / beam falls (LU_SkyCtl Hole / Tear)."""
    from . import sky
    pos = pos if pos is not None else position(nb)
    g = nb.n("ShaderNodeNewGeometry")
    sd = sky.sun_vec()
    sv = nb.n("ShaderNodeCombineXYZ", inputs={"X": sd.x, "Y": sd.y, "Z": sd.z}).outputs[0]
    toward = nb.math("MAXIMUM", nb.mul(nb.vmath("DOT_PRODUCT", g.outputs["Incoming"], sv), -1.0), 0.0)
    graze = nb.math("POWER", nb.sub(1.0, nb.math("ABSOLUTE", nb.vmath("DOT_PRODUCT", g.outputs["Normal"],
                                                                        g.outputs["Incoming"]))), 3.0)
    face_sun = nb.mapr(nb.vmath("DOT_PRODUCT", g.outputs["Normal"], sv), -0.2, 0.4)
    x, y, z = _sep(nb, pos)
    px, py = layout.PEAK_SOIL
    dd = nb.math("SQRT", nb.add(nb.mul(nb.sub(x, px), nb.sub(x, px)), nb.mul(nb.sub(y, py), nb.sub(y, py))))
    C = sky.ctl_node(nb)
    nopart = nb.sub(1.0, C.outputs["Part"])
    p_ash = nb.mul(nb.mul(nb.mapr(dd, 26.0, 6.0), nb.mapr(C.outputs["Hole"], 0.0, 0.3)), nopart)
    p_beam = nb.mul(nb.mul(nb.mapr(dd, 6.0, 1.5), nb.mapr(C.outputs["Tear"], 0.1, 0.5)), nopart)
    nz = _sep(nb, g.outputs["Normal"])[2]
    steep = nb.mapr(nz, 0.85, 0.45)                    # silhouettes / walls, not open ground (emission ignores shadow)
    amt = nb.add(nb.mul(nb.mul(nb.math("POWER", toward, 6.0), 0.18), steep), nb.add(nb.mul(p_ash, 1.1), nb.mul(p_beam, 1.0)))
    rim = nb.mul(nb.mul(nb.mul(graze, face_sun), amt), k)
    P = sky.pal_node(nb)
    return _scale(nb, P.outputs["SunGlow"], rim)


# ====================================================================== the terrain
FLOWER_COLS = ((0.80, 0.07, 0.40), (0.95, 0.42, 0.62), (0.92, 0.90, 0.84), (1.0, 0.72, 0.06), (0.22, 0.36, 0.98),
               (0.62, 0.20, 0.85))


def _flower_ramp(nb, fac):
    r = nb.n("ShaderNodeValToRGB")
    cr = r.color_ramp
    cr.interpolation = "CONSTANT"
    n = len(FLOWER_COLS)
    cr.elements[0].position, cr.elements[0].color = 0.0, (*FLOWER_COLS[0], 1)
    cr.elements[1].position, cr.elements[1].color = 1.0 - 1.0 / n + 0.001, (*FLOWER_COLS[-1], 1)
    for i, c in enumerate(FLOWER_COLS[1:-1], 1):
        cr.elements.new(i / n).color = (*c, 1)
    nb.link(fac, r.inputs[0])
    return r.outputs[0]


def dots(nb, pos, scale, size=0.32, density=1.0, rnd=0.0, seed_off=(0.0, 0.0, 0.0)):
    """Procedural speckles (no image samplers): voronoi cells, a soft dot in some of them. Returns (mask, cell
    colour socket, cell random 0..1)."""
    v = nb.n("ShaderNodeTexVoronoi", feature="F1", voronoi_dimensions="3D")
    v.inputs["Scale"].default_value = scale
    v.inputs["Randomness"].default_value = 1.0
    p = pos if seed_off == (0.0, 0.0, 0.0) else _vadd(nb, pos, seed_off)
    nb.link(p, v.inputs["Vector"])
    r = _sepc(nb, v.outputs["Color"])[0]
    m = nb.mapr(v.outputs["Distance"], size, size * 0.55)
    if density < 1.0:
        m = nb.mul(m, nb.mapr(r, 1.0 - density, 1.0 - density + 0.02))
    return m, v.outputs["Color"], r


def ground():
    m = bpy.data.materials.get("Ground")
    if m:
        return m
    S = {}

    def albedo(nb, co):
        E = env(nb)
        S["E"] = E
        pos = position(nb)
        S["pos"] = pos
        A = _attr(nb, "ashc").outputs["Color"]
        G = _attr(nb, "grnc")
        Mk = _attr(nb, "msk")
        rock, crack, ember = _sepc(nb, Mk.outputs["Color"])
        crest = Mk.outputs["Alpha"]
        S["rock"], S["ember"] = rock, ember
        fl = G.outputs["Alpha"]
        # --- ash phase: big painted value patches, cinder specks, cracked scorched earth, strata + lichen on rock
        bigN = _noise(nb, pos, 0.07, 3.0, 0.55, 0.4)
        big = nb.mapr(bigN.outputs["Fac"], 0.3, 0.7)
        S["big"] = big
        a = _scale(nb, A, nb.add(0.86, nb.mul(big, 0.28)))
        grain = _noise(nb, pos, 28.0, 2.0, 0.6, 0.0)
        a = _scale(nb, a, nb.add(0.9, nb.mul(grain.outputs["Fac"], 0.2)))
        midN = _noise(nb, pos, 0.32, 3.0, 0.6, 0.6)
        mid_ = nb.mapr(midN.outputs["Fac"], 0.3, 0.7)
        a = _scale(nb, a, nb.add(0.78, nb.mul(mid_, 0.44)))
        smN = _noise(nb, pos, 0.55, 4.0, 0.6, 0.5)
        smudge = nb.mapr(smN.outputs["Fac"], 0.5, 0.68)                             # soot smudges
        a = nb.mix(nb.mul(nb.mul(smudge, nb.sub(1.0, crest)), 0.55), a, (0.045, 0.038, 0.034))
        d1, _c1, _r1 = dots(nb, pos, 6.5, 0.2, 0.55)
        a = nb.mix(nb.mul(nb.mul(d1, nb.sub(1.0, nb.mul(crest, 0.7))), 0.85), a, (0.025, 0.022, 0.02))
        d3, _c3, _r3 = dots(nb, pos, 19.0, 0.22, 0.5, seed_off=(7.0, 2.0, 4.0))
        a = nb.mix(nb.mul(d3, 0.6), a, (0.03, 0.026, 0.024))                       # fine cinders
        d2, _c2, _r2 = dots(nb, pos, 11.0, 0.2, 0.45, seed_off=(3.1, 7.7, 1.3))
        a = nb.mix(nb.mul(d2, 0.5), a, (0.52, 0.5, 0.47))                          # pale ash flecks
        wn = _noise(nb, pos, 1.2, 2.0)
        warped = _vadd(nb, pos, _scale(nb, nb.vmath("SUBTRACT", wn.outputs["Color"], (0.5, 0.5, 0.5)), 0.35))
        vor = nb.n("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE", voronoi_dimensions="3D")
        vor.inputs["Scale"].default_value = 2.3
        nb.link(warped, vor.inputs["Vector"])
        line = nb.mapr(vor.outputs["Distance"], 0.045, 0.012)
        plate_edge = nb.mapr(vor.outputs["Distance"], 0.12, 0.05)
        cr_amt = nb.mapr(crack, 0.25, 0.6)
        a = nb.mix(nb.mul(nb.mul(plate_edge, cr_amt), 0.25), a, (0.36, 0.22, 0.13))
        a = nb.mix(nb.mul(line, cr_amt), a, (0.02, 0.015, 0.012))
        S["crackline"] = nb.mul(line, cr_amt)
        # rock: world-z strata bands (continuous across terrain and rocks), lichen
        x_, y_, z_ = _sep(nb, pos)
        sz = nb.add(nb.add(nb.mul(z_, 2.4), nb.mul(x_, 0.12)), nb.mul(y_, -0.08))
        bn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 1.0, "Detail": 3.0, "Roughness": 0.6, "Distortion": 0.4},
                  noise_dimensions="1D")
        nb.link(nb.add(sz, nb.mul(_noise(nb, pos, 0.3, 2.0).outputs["Fac"], 3.0)), bn.inputs["W"])
        bands = nb.mapr(bn.outputs["Fac"], 0.3, 0.7, 0.72, 1.22)
        ar = _scale(nb, a, nb.add(1.0, nb.mul(nb.sub(bands, 1.0), rock)))
        lichN = _noise(nb, pos, 9.0, 4.0, 0.6, 0.3)
        lich = lichN.outputs["Fac"]
        lm = nb.mul(nb.mapr(lich, 0.6, 0.68), rock)
        lc = nb.mix(nb.mapr(_noise(nb, pos, 0.8).outputs["Fac"], 0.4, 0.6), (0.48, 0.22, 0.05), (0.42, 0.44, 0.24))
        a = nb.mix(nb.mul(lm, 0.8), ar, lc)
        # --- bloom phase: lush greens, flower dabs (drift colour + per-dab variety), moss on rock
        g = _scale(nb, G.outputs["Color"], nb.add(0.85, nb.mul(big, 0.3)))
        gs = _sepc(nb, mat.tex_node(nb, "strokes_fine", pos, 0.9).outputs["Color"])
        g = _scale(nb, g, nb.add(0.8, nb.mul(gs[0], 0.4)))
        g = _scale(nb, g, nb.add(1.0, nb.mul(E.outputs["Lush"], 0.25)))
        fd1, _fc1, fr1 = dots(nb, pos, 3.4, 0.36, 0.75, seed_off=(11.0, 3.0, 5.0))
        fd2, _fc2, fr2 = dots(nb, pos, 0.9, 0.42, 0.6, seed_off=(1.0, 13.0, 2.0))
        fmask = nb.mul(nb.math("MAXIMUM", fd1, nb.mul(fd2, 0.9)), nb.mapr(fl, 0.15, 0.6))
        hue = _noise(nb, pos, 0.11, 1.0)
        hsel = nb.add(nb.mapr(hue.outputs["Fac"], 0.32, 0.68, 0.0, 0.85), nb.mul(fr1, 0.3))
        fcol = _flower_ramp(nb, nb.math("FRACT", hsel))
        g = nb.mix(nb.mul(fmask, 0.92), g, fcol)
        gn = nb.n("ShaderNodeNewGeometry")
        nz = _sep(nb, gn.outputs["Normal"])[2]
        moss = nb.mul(nb.mul(rock, nb.mapr(nz, 0.35, 0.7)), nb.mapr(lich, 0.4, 0.55))
        g = nb.mix(nb.mul(moss, 0.85), g, (0.13, 0.30, 0.05))
        grown, front, xw = bloom_nodes(nb, pos, E=E)
        S["grown"], S["front"], S["xw"] = grown, front, xw
        out = nb.mix(grown, a, g)
        # storm: wet surfaces darken (rock less, it sheds)
        wet = nb.mul(E.outputs["Wet"], nb.sub(1.0, nb.mul(rock, 0.3)))
        out = nb.mix(nb.mul(wet, 0.58), out, (0.012, 0.014, 0.02))
        return out

    m = mat.painterly("Ground", (1, 1, 1), stroke="strokes_broad", scale=0.4, coord="Object", tex_amt=1.0,
                      hue_jit=0.05, bump=0.18, breakup=1.3, ao=0.35, albedo_fn=albedo, snow=0.0)

    def ripple(nb):
        pos = S["pos"]
        x, y, z = _sep(nb, pos)
        from .terrain import WIND
        w = _noise(nb, pos, 0.45, 2.0)
        s = nb.add(nb.math("DIVIDE", nb.add(nb.mul(x, float(WIND[0])), nb.mul(y, float(WIND[1]))), 0.31),
                   nb.mul(w.outputs["Fac"], 4.0))
        f = nb.math("FRACT", s)
        prof = nb.math("MINIMUM", nb.mapr(f, 0.0, 0.72), nb.mapr(f, 1.0, 0.72))
        cam = nb.n("ShaderNodeCameraData")
        fade = nb.mapr(cam.outputs["View Distance"], 25.0, 70.0, 1.0, 0.0)
        amt = nb.mul(nb.mul(nb.sub(1.0, S["rock"]), nb.sub(1.0, S["grown"])), fade)
        crack = nb.mul(S["crackline"], -0.6)
        return nb.add(nb.mul(prof, amt), crack)

    _patch_bump(m, ripple, strength=0.5, distance=0.03)

    def glow(nb):
        E = S["E"]
        pos = S["pos"]
        T = E.outputs["Time"]
        dm, _dc, _dr = dots(nb, pos, 9.0, 0.2, 0.55, seed_off=(5.0, 1.0, 9.0))
        tn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 2.8, "Detail": 1.0}, noise_dimensions="4D")
        nb.link(pos, tn.inputs["Vector"])
        nb.link(nb.mul(T, 0.9), tn.inputs["W"])
        flick = nb.mapr(tn.outputs["Fac"], 0.35, 0.7, 0.25, 1.4)
        emb = nb.mul(nb.mul(dm, nb.mapr(S["ember"], 0.15, 0.6)), flick)
        emb = nb.add(emb, nb.mul(nb.mul(S["crackline"], nb.mapr(S["ember"], 0.35, 0.8)), nb.mul(flick, 0.12)))
        emb = nb.mul(nb.mul(emb, E.outputs["Ember"]), nb.mul(nb.sub(1.0, S["grown"]), nb.sub(1.0, E.outputs["Wet"])))
        c = _scale(nb, _rgb(nb, (1.0, 0.30, 0.045)), nb.mul(emb, 4.0))
        fr = front_glow(nb, pos, S["front"], S["xw"], E)
        return _vadd(nb, _vadd(nb, _vadd(nb, c, fr), _wet_flash(nb, E)), backlight(nb, pos))

    _patch_emission(m, glow)
    return m


# ====================================================================== charred wood
def char_bark(name="CharBark", cell=14.0, living=True, base_glow=True, scale_z=0.45, geo_crack=False, glow_k=1.0):
    """Charred wood: blocky alligator checks (voronoi stretched along the grain = object Z), deep black cracks with
    ember glow near the base, a silvery charcoal sheen on lit check faces, patches of grey ash and of surviving
    brown bark. Behind the bloom wave it turns into living bark (warm grey-brown with green moss), climbing from the
    base. cell = checks per metre."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    S = {}

    def albedo(nb, co):
        E = env(nb)
        S["E"] = E
        oi = nb.n("ShaderNodeObjectInfo")
        rnd = oi.outputs["Random"]
        stretch = nb.n("ShaderNodeVectorMath", operation="MULTIPLY")
        nb.inp(stretch, 0, co)
        nb.inp(stretch, 1, (1.0, 1.0, scale_z))
        wn = _noise(nb, co, 3.0, 2.0)
        warped = _vadd(nb, stretch.outputs[0], _scale(nb, nb.vmath("SUBTRACT", wn.outputs["Color"], (0.5, 0.5, 0.5)),
                                                         0.6 / cell))
        vor = nb.n("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE", voronoi_dimensions="3D")
        vor.inputs["Scale"].default_value = cell
        nb.link(warped, vor.inputs["Vector"])
        vf = nb.n("ShaderNodeTexVoronoi", feature="F1", voronoi_dimensions="3D")
        vf.inputs["Scale"].default_value = cell
        nb.link(warped, vf.inputs["Vector"])
        crack = nb.mapr(vor.outputs["Distance"], 0.07, 0.02)
        dome = nb.mapr(vor.outputs["Distance"], 0.02, 0.3)
        if geo_crack:
            gr = _attr(nb, "groove").outputs["Fac"]
            crack = nb.math("MAXIMUM", nb.mul(crack, 0.45), gr)
            dome = nb.mul(dome, nb.sub(1.0, nb.mul(gr, 0.8)))
        S["crack"], S["dome"] = crack, dome
        cellrnd = _sepc(nb, vf.outputs["Color"])[0]
        # charcoal: per-check value variation, sheen comes from spec
        base = nb.mix(nb.mapr(cellrnd, 0.0, 1.0), (0.016, 0.014, 0.013), (0.055, 0.048, 0.044))
        base = nb.mix(crack, base, (0.004, 0.003, 0.003))
        # patches of grey ash (up-facing + noise) and surviving brown bark
        gn = nb.n("ShaderNodeNewGeometry")
        nz = _sep(nb, gn.outputs["Normal"])[2]
        pn = _noise(nb, co, 1.6, 3.0)
        ash = nb.mul(nb.mul(nb.mapr(nb.add(nz, nb.mul(nb.sub(pn.outputs["Fac"], 0.5), 1.4)), 0.6, 0.95), nb.sub(1.0, crack)), 0.55)
        base = nb.mix(ash, base, (0.30, 0.29, 0.28))
        brown = nb.mul(nb.mapr(pn.outputs["Fac"], 0.62, 0.7), nb.mapr(rnd, 0.3, 0.6))
        base = nb.mix(nb.mul(nb.mul(brown, dome), 0.8), base, (0.15, 0.09, 0.055))
        S["base"] = base
        if not living:
            return base
        # living bark (bloom)
        lv = nb.mix(nb.mapr(cellrnd, 0.0, 1.0), (0.13, 0.085, 0.055), (0.26, 0.19, 0.13))
        lv = nb.mix(nb.mul(crack, 0.7), lv, (0.06, 0.04, 0.03))
        moss = nb.mul(nb.mapr(nb.add(pn.outputs["Fac"], nb.mul(nz, 0.2)), 0.52, 0.62), 0.9)
        lv = nb.mix(moss, lv, (0.12, 0.26, 0.05))
        _x, _y, lz = _sep(nb, co)
        grown, front, xw = bloom_nodes(nb, delay=nb.mul(lz, 2.2), grow=6.0, E=E)
        S["grown"], S["front"] = grown, front
        return nb.mix(grown, base, lv)

    m = mat.painterly(name, (1, 1, 1), stroke="strokes_vert", scale=2.2, coord="Object", tex_amt=1.0, hue_jit=0.03,
                      bump=0.25, breakup=1.4, spec=0.2, rough=0.35, spec_col=(0.42, 0.43, 0.48), ao=0.45,
                      albedo_fn=albedo, snow=0.0)
    _patch_bump(m, lambda nb: nb.add(nb.mul(S["dome"], 0.7), nb.mul(S["crack"], -0.4)), strength=0.7,
                distance=0.6 / cell)

    def glow(nb):
        E = S["E"]
        co = nb.n("ShaderNodeTexCoord").outputs["Object"]
        _x, _y, z = _sep(nb, co)
        T = E.outputs["Time"]
        tn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 3.0, "Detail": 1.0}, noise_dimensions="4D")
        nb.link(co, tn.inputs["Vector"])
        nb.link(nb.mul(T, 0.7), tn.inputs["W"])
        alive = nb.mul(nb.mapr(tn.outputs["Fac"], 0.5, 0.7), nb.mapr(_noise(nb, co, 2.0).outputs["Fac"], 0.55, 0.68))
        hgt = nb.mapr(z, 1.6, 0.0) if base_glow else 1.0
        e = nb.mul(nb.mul(nb.mul(S["crack"], alive), hgt), E.outputs["Ember"])
        if living:
            e = nb.mul(e, nb.sub(1.0, S["grown"]))
        e = nb.mul(e, nb.sub(1.0, E.outputs["Wet"]))
        c = _scale(nb, _rgb(nb, (1.0, 0.28, 0.04)), nb.mul(e, 4.0 * glow_k))
        if living:
            c = _vadd(nb, c, _scale(nb, _rgb(nb, (0.85, 1.0, 0.4)), nb.mul(S["front"], 0.6)))
        return _vadd(nb, _vadd(nb, c, _wet_flash(nb, E, 0.05, 0.4)), backlight(nb, k=0.8))

    _patch_emission(m, glow)
    return m


# ====================================================================== strata rock
def rock(name="Rock", base=(0.30, 0.285, 0.30), lichen=1.0, ash=1.0, coord="Object", scale=1.0):
    """Sedimentary rock: horizontal strata bands in WORLD z (continuous with the terrain's bands), horizontal brush
    strokes, crisp ledges (bump), orange and grey-green lichen, ash dusting on top faces (ash phases), dark when wet,
    moss on top faces behind the bloom wave. Per-object value jitter (Object Info random)."""
    m = bpy.data.materials.get(name)
    if m:
        return m
    S = {}

    def albedo(nb, co):
        E = env(nb)
        S["E"] = E
        pos = position(nb)
        x_, y_, z_ = _sep(nb, pos)
        oi = nb.n("ShaderNodeObjectInfo")
        sz = nb.add(nb.add(nb.mul(z_, 2.4), nb.mul(x_, 0.12)), nb.mul(y_, -0.08))
        bn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 1.0, "Detail": 4.0, "Roughness": 0.62, "Distortion": 0.5},
                  noise_dimensions="1D")
        nb.link(nb.add(sz, nb.mul(_noise(nb, pos, 0.3, 2.0).outputs["Fac"], 3.0)), bn.inputs["W"])
        bands = nb.mapr(bn.outputs["Fac"], 0.3, 0.7, 0.84, 1.14)
        S["bands"] = bn.outputs["Fac"]
        b = _rgb(nb, base)
        warm = nb.mix(nb.mapr(_noise(nb, pos, 0.5).outputs["Fac"], 0.4, 0.62), b, (0.38, 0.31, 0.25))
        a = _scale(nb, warm, nb.mul(bands, nb.add(0.85, nb.mul(oi.outputs["Random"], 0.3))))
        lich = _sepc(nb, mat.tex_node(nb, "sponge", co, 4.0 * scale).outputs["Color"])[2]
        lm = nb.mul(nb.mapr(lich, 0.62, 0.68), lichen)
        lc = nb.mix(nb.mapr(_noise(nb, pos, 1.3).outputs["Fac"], 0.42, 0.58), (0.52, 0.25, 0.05), (0.46, 0.48, 0.28))
        a = nb.mix(nb.mul(lm, 0.85), a, lc)
        ld, _lc, _lr = dots(nb, co, 9.0 * scale, 0.3, 0.45)
        a = nb.mix(nb.mul(ld, 0.6 * lichen), a, (0.62, 0.6, 0.5))
        gn = nb.n("ShaderNodeNewGeometry")
        nz = _sep(nb, gn.outputs["Normal"])[2]
        pn = _noise(nb, co, 2.2 * scale, 3.0)
        top = nb.mapr(nb.add(nz, nb.mul(nb.sub(pn.outputs["Fac"], 0.5), 0.9)), 0.4, 0.75)
        a = nb.mix(nb.mul(nb.mul(nb.mul(top, 0.45), ash), nb.sub(1.0, nb.mul(E.outputs["Wet"], 0.8))), a, (0.30, 0.29, 0.28))
        mb = _noise(nb, co, 9.0 * scale, 3.0, 0.65, 0.4).outputs["Fac"]
        moss = nb.mul(nb.mapr(nb.add(nb.add(nz, nb.mul(nb.sub(pn.outputs["Fac"], 0.5), 1.2)), nb.mul(nb.sub(mb, 0.5), 0.8)),
                              0.35, 0.65), 0.92)
        mo = nb.mix(moss, a, nb.mix(nb.mapr(pn.outputs["Fac"], 0.4, 0.6), (0.07, 0.22, 0.04), (0.2, 0.36, 0.06)))
        grown, front, xw = bloom_nodes(nb, pos, grow=10.0, E=E)
        S["grown"], S["front"] = grown, front
        out = nb.mix(grown, a, mo)
        return nb.mix(nb.mul(E.outputs["Wet"], 0.5), out, (0.01, 0.012, 0.018))

    m = mat.painterly(name, (1, 1, 1), stroke="strokes_fine", scale=2.4 * scale, coord=coord, tex_amt=0.8,
                      hue_jit=0.04, bump=0.3, breakup=1.45, ao=0.5, albedo_fn=albedo, snow=0.0)
    _patch_bump(m, lambda nb: nb.mapr(S["bands"], 0.45, 0.55), strength=0.2, distance=0.03)
    _patch_emission(m, lambda nb: _vadd(nb, _vadd(nb, _wet_flash(nb, S["E"], 0.06, 0.45),
                                                  _scale(nb, _rgb(nb, (0.85, 1.0, 0.42)), nb.mul(S["front"], 0.5))),
                                        backlight(nb, k=1.2)))
    return m


# ====================================================================== far ridges (painted silhouettes)
def far_ridge(layer):
    """Painted far ridge: flat colour from the sky palette (LU_SkyPal: Ridge0..3, Haze, HazeLow), lighter and hazier
    toward its foot (mist pooling in the valleys between layers), soft vertical brush texture, sun-facing slopes a
    touch warmer. Emission only (the haze already carries the light)."""
    name = f"FarRidge{layer}"
    m = bpy.data.materials.get(name)
    if m:
        return m
    from . import sky
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    pal = sky.pal_node(nb)
    co = nb.n("ShaderNodeTexCoord").outputs["Object"]
    st = _sepc(nb, mat.tex_node(nb, "strokes_vert", co, 0.012 / (1 + layer * 0.5)).outputs["Color"])
    st2 = _sepc(nb, mat.tex_node(nb, "strokes_broad", co, 0.004 / (1 + layer * 0.5)).outputs["Color"])
    crest = _attr(nb, "crest").outputs["Fac"]
    col = pal.outputs[f"Ridge{layer}"]
    col = _scale(nb, col, nb.add(nb.add(0.9, nb.mul(st[0], 0.14)), nb.mul(st2[0], 0.08)))
    gn = nb.n("ShaderNodeNewGeometry")
    sd = sky.sun_vec()
    sv = nb.n("ShaderNodeCombineXYZ", inputs={"X": sd[0], "Y": sd[1], "Z": max(sd[2], 0.3)})
    lit = nb.mapr(nb.vmath("DOT_PRODUCT", gn.outputs["Normal"], sv.outputs[0]), 0.1, 0.7)
    col = nb.mix(nb.mul(lit, 0.35), col, pal.outputs["RidgeLit"])
    mist = nb.mapr(crest, 0.62, 0.0)
    col = nb.mix(nb.mul(mist, 0.85), col, pal.outputs["HazeLow"])
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(em.outputs[0], out.inputs["Surface"])
    return m


CLOUD_SHADOW_MATS = ("Ground", "CoverGrass", "CoverGrassHero", "CoverFlower", "CoverLeaf", "CoverStone", "StrataRock",
                     "CharBark", "CharLog", "StumpChar", "StumpRootChar", "Soil", "CoverChar")


def cloud_shadows(names=CLOUD_SHADOW_MATS):
    """Drifting cloud shadows: scale the captured light of the environment materials by a slow world-space noise
    field (patches of ~40-90 m sliding with the wind), so whole slopes fall into the painted shadow tone and out of
    it. Strength = LU_Env CloudShade (0 = off). Idempotent."""
    for nm in names:
        m = bpy.data.materials.get(nm)
        if m is None or "CloudShadow" in m.node_tree.nodes:
            continue
        nt = m.node_tree
        s2r = [n for n in nt.nodes if n.type == "SHADER_TO_RGB"]
        if not s2r:
            continue
        s2r = s2r[0]
        links = [l for l in nt.links if l.from_node == s2r and l.from_socket.name == "Color"]
        nb = NB(nt)
        E = env(nb)
        pos = position(nb)
        x, y, _z = _sep(nb, pos)
        T = E.outputs["Time"]
        cv = nb.n("ShaderNodeCombineXYZ")
        nb.inp(cv, "X", nb.sub(x, nb.mul(T, 4.0)))
        nb.inp(cv, "Y", nb.add(y, nb.mul(T, 1.4)))
        nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 0.016, "Detail": 3.0, "Roughness": 0.55, "Distortion": 0.6})
        nb.link(cv.outputs[0], nz.inputs["Vector"])
        sh = nb.mul(nb.mapr(nz.outputs["Fac"], 0.5, 0.6), E.outputs["CloudShade"])
        mul = nb.n("ShaderNodeMix", data_type="RGBA", blend_type="MULTIPLY")
        mul.name = "CloudShadow"
        mul.inputs[0].default_value = 1.0
        nb.link(s2r.outputs["Color"], mul.inputs[6])
        f = nb.sub(1.0, nb.mul(sh, 0.85))
        nb.link(nb.n("ShaderNodeCombineColor", inputs={"Red": f, "Green": f, "Blue": f}).outputs[0], mul.inputs[7])
        for l in links:
            to = l.to_socket
            nt.links.remove(l)
            nt.links.new(mul.outputs[2], to)


def canopy_normals(m, k=0.75):
    """Leaves / blossom clusters shade as one tree canopy: blend the shading normal toward the instance's canopy
    normal (INSTANCER attribute 'cn', the direction from the tree's crown centre; zero = keep the cluster's own)."""
    nt = m.node_tree
    nb = NB(nt)
    bm = [n for n in nt.nodes if n.type == "BUMP"][0]
    cn = nb.n("ShaderNodeAttribute", attribute_name="cn", attribute_type="INSTANCER").outputs["Vector"]
    w = nb.mul(nb.math("MINIMUM", nb.vmath("LENGTH", cn), 1.0), k)
    gn = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    mixv = nb.n("ShaderNodeMix", data_type="VECTOR")
    nb.inp(mixv, "Factor", w)
    nb.link(gn, mixv.inputs[4])
    nb.link(nb.vmath("NORMALIZE", cn), mixv.inputs[5])
    nt.links.new(nb.vmath("NORMALIZE", mixv.outputs[1]), bm.inputs["Normal"])
    return m


def soil():
    """Rich dark loam: crumbly (fine voronoi clods in the bump + value), damp sheen, a few root threads of pale."""
    m = bpy.data.materials.get("Soil")
    if m:
        return m
    S = {}

    def alb(nb, co):
        v = nb.n("ShaderNodeTexVoronoi", feature="F1", voronoi_dimensions="3D")
        v.inputs["Scale"].default_value = 70.0
        nb.link(co, v.inputs["Vector"])
        S["clod"] = nb.mapr(v.outputs["Distance"], 0.45, 0.0)
        r = _sepc(nb, v.outputs["Color"])[0]
        base = nb.mix(nb.mapr(r, 0.0, 1.0), (0.035, 0.022, 0.014), (0.11, 0.07, 0.042))
        d, _c, _r = dots(nb, co, 150.0, 0.25, 0.25)
        return nb.mix(nb.mul(d, 0.5), base, (0.20, 0.16, 0.11))

    m = mat.painterly("Soil", (1, 1, 1), stroke="strokes_fine", scale=6.0, coord="Object", tex_amt=1.0, breakup=1.3,
                      bump=0.3, spec=0.25, rough=0.4, spec_col=(0.5, 0.45, 0.4), ao=0.5, albedo_fn=alb, snow=0.0)
    _patch_bump(m, lambda nb: S["clod"], strength=0.9, distance=0.006)
    return m


def simple_emit(name, color, strength=1.0):
    m = bpy.data.materials.get(name)
    if m:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    nb = NB(nt)
    em = nb.n("ShaderNodeEmission", inputs={"Color": color, "Strength": strength})
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(em.outputs[0], out.inputs["Surface"])
    return m
