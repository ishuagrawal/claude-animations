"""Character materials for BLOOM (Claude + the Sprout): painterly clay with keyable material states, deep lens eyes,
the mouth (drawn in the body shader), tears, the seed's jade glow, and the geometry-nodes damage (chips / cracks /
dents) that the clay shader colours.

Every channel a material reads is an OBJECT custom property on the shaded object. Characters keep the keyed values
on their rig object and copy them to the parts with simple-expression drivers (`drive`), so a shot keys only the rig.

Clay shading follows mat.painterly (Shader-to-RGB, terminator ramp from the shared LU_Look group, flat cool shadow,
brush texture only in the light) and adds:
  * brand: the light colour is partly neutralised on the lit side so Claude reads as its brand orange in any light
    (grey day, storm, gold beam) while practicals (the seed's green) still tint it when brand is lowered;
  * a warm character shadow mixed into the scene shadow tint (no muddy brown on the dark side);
  * painted wear: broad mottling, worn lighter edges (GN 'edge' attribute), sparse scuffs, fine grain, a soft
    clay 'fuzz' sheen on grazing angles; no plastic specular (only small brush-dab gloss, more when wet);
  * states: ash (grey dust on up-facing planes and the legs), wet (darker, saturated, glossy, running rain streaks),
    damage (pale clay in chips, dark cracks: from the GN attributes 'chip'/'crack'), gold (kintsugi: chips and cracks
    filled with glinting gold).
"""
import math
import bpy

from . import mat

TAU = 2 * math.pi


class G(mat.NB):
    """mat.NB plus the math helpers the character shaders need."""

    def mapr(self, v, a, b, c=0.0, d=1.0, interp="SMOOTHSTEP", clamp=True):
        m = self.n("ShaderNodeMapRange", interpolation_type=interp, clamp=clamp)
        self.inp(m, "Value", v)
        self.inp(m, "From Min", a)
        self.inp(m, "From Max", b)
        self.inp(m, "To Min", c)
        self.inp(m, "To Max", d)
        return m.outputs["Result"]

    def sq(self, a): return self.mul(a, a)
    def sqrt(self, a): return self.math("SQRT", self.math("MAXIMUM", a, 0.0))
    def abs(self, a): return self.math("ABSOLUTE", a)
    def mx(self, a, b): return self.math("MAXIMUM", a, b)
    def mn(self, a, b): return self.math("MINIMUM", a, b)
    def div(self, a, b): return self.math("DIVIDE", a, b)
    def neg(self, a): return self.mul(a, -1.0)
    def c01(self, a): return self.math("ADD", a, 0.0, clamp=True)
    def ss(self, e0, e1, x): return self.mapr(x, e0, e1)
    def lin(self, x, a, b, c=0.0, d=1.0): return self.mapr(x, a, b, c, d, interp="LINEAR")

    def lerp(self, t, a, b):
        return self.add(a, self.mul(self.sub(b, a), t))

    def rgb(self, c):
        n = self.n("ShaderNodeRGB")
        n.outputs[0].default_value = (*c[:3], 1)
        return n.outputs[0]

    def val(self, v):
        n = self.n("ShaderNodeValue")
        n.outputs[0].default_value = v
        return n.outputs[0]

    packs = {}

    def prop(self, name):
        """An object property. Channels listed in PACKS are read from 3-float vector properties (EEVEE allows only a
        few object attributes per material, so scalars are packed three to an attribute)."""
        if name in PACK_OF:
            pk, i = PACK_OF[name]
            cache = self.__dict__.setdefault("_packcache", {})
            if pk not in cache:
                a_ = self.n("ShaderNodeAttribute", attribute_name=pk, attribute_type="OBJECT")
                cache[pk] = self.xyz(a_.outputs["Vector"])
            return cache[pk][i]
        return self.n("ShaderNodeAttribute", attribute_name=name, attribute_type="OBJECT").outputs["Fac"]

    def gattr(self, name, out="Fac"):
        return self.n("ShaderNodeAttribute", attribute_name=name, attribute_type="GEOMETRY").outputs[out]

    def xyz(self, v):
        s = self.n("ShaderNodeSeparateXYZ", inputs={"Vector": v})
        return s.outputs[0], s.outputs[1], s.outputs[2]

    def vec(self, x, y, z):
        return self.n("ShaderNodeCombineXYZ", inputs={"X": x, "Y": y, "Z": z}).outputs[0]

    def cmul(self, c, k):
        """colour * scalar (socket or float)."""
        if isinstance(k, (int, float)):
            k = self.val(float(k))
        g = self.n("ShaderNodeCombineColor", inputs={"Red": k, "Green": k, "Blue": k}).outputs[0]
        return self.mix(1.0, c, g, blend="MULTIPLY")

    def cadd(self, a, b):
        return self.mix(1.0, a, b, blend="ADD")

    def cmulc(self, a, b):
        return self.mix(1.0, a, b, blend="MULTIPLY")

    def noise(self, v, scale, detail=2.0, rough=0.5, out="Factor"):
        n = self.n("ShaderNodeTexNoise", inputs={"Scale": scale, "Detail": detail, "Roughness": rough})
        self.inp(n, "Vector", v)
        return n.outputs[out]

    def vor(self, v, scale, feature="F1", out="Distance", rnd=1.0):
        n = self.n("ShaderNodeTexVoronoi", feature=feature, inputs={"Scale": scale, "Randomness": rnd})
        self.inp(n, "Vector", v)
        return n.outputs[out]

    def vscale(self, v, s):
        return self.n("ShaderNodeVectorMath", operation="MULTIPLY", inputs={0: v, 1: s}).outputs[0]

    def emission_out(self, col, alpha=None, method="DITHERED", transp_col=(1, 1, 1), m=None):
        em = self.n("ShaderNodeEmission", inputs={"Strength": 1.0})
        self.inp(em, "Color", col)
        surf = em.outputs[0]
        if alpha is not None:
            tr = self.n("ShaderNodeBsdfTransparent", inputs={"Color": transp_col})
            mx = self.n("ShaderNodeMixShader")
            self.inp(mx, "Fac", alpha)
            self.link(tr.outputs[0], mx.inputs[1])
            self.link(surf, mx.inputs[2])
            surf = mx.outputs[0]
            if m is not None:
                m.surface_render_method = method
        out = self.n("ShaderNodeOutputMaterial")
        self.link(surf, out.inputs["Surface"])
        return out


# channel -> (packed vector property, component). A part's material reads one property per pack.
PACKS = {"matA": ("ash", "wet", "damage"), "matB": ("gold", "brand", "vivid"),
         "mouthA": ("mouth_open", "smile", "mouth_wide"), "mouthB": ("mouth_o", "teeth", "wobble"),
         "mouthC": ("mouth_skew", "mouth_press", "time"),
         "eyeA": ("e_open", "e_tilt", "e_happy"), "eyeB": ("e_sag", "e_squeeze", "e_lower"),
         "eyeC": ("e_lookx", "e_looky", "e_pupil"), "eyeD": ("e_glint", "e_tears", "e_wet")}
PACK_OF = {ch: (pk, i) for pk, chs in PACKS.items() for i, ch in enumerate(chs)}


def drive_pack(target, pack, src, srcmap=None):
    """Create target[pack] = [a, b, c] driven element-wise from src's scalar props ('time' = frame / 24). srcmap maps
    a pack channel to a differently named source property."""
    target[pack] = [0.0, 0.0, 0.0]
    for i, ch0 in enumerate(PACKS[pack]):
        ch = (srcmap or {}).get(ch0, ch0)
        fc = target.driver_add(f'["{pack}"]', i)
        dr = fc.driver
        dr.type = "SCRIPTED"
        if ch == "time":
            dr.expression = "frame/24"
            continue
        dr.expression = "v"
        v = dr.variables.new()
        v.name = "v"
        v.type = "SINGLE_PROP"
        v.targets[0].id_type = "OBJECT"
        v.targets[0].id = src
        v.targets[0].data_path = f'["{ch}"]'


def _new(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    m.node_tree.nodes.clear()
    return m, G(m.node_tree)


# ---------------------------------------------------------------- drivers
def drive(target, prop, src, src_prop=None, expr="v", default=0.0):
    """target[prop] (or a data path like 'modifiers["Dmg"]["Socket_1"]') follows src[src_prop] via a
    simple-expression driver (evaluated without Python)."""
    src_prop = src_prop or prop
    rna = prop.startswith(("modifiers", "key_blocks", "data.", "[")) or prop in target.bl_rna.properties
    path = prop if rna else f'["{prop}"]'
    if not rna:
        target[prop] = float(src.get(src_prop, default))
    fc = target.driver_add(path)
    dr = fc.driver
    dr.type = "SCRIPTED"
    dr.expression = expr
    v = dr.variables.new()
    v.name = "v"
    v.type = "SINGLE_PROP"
    v.targets[0].id_type = "OBJECT"
    v.targets[0].id = src
    v.targets[0].data_path = f'["{src_prop}"]'
    return fc


def drive_time(target, prop="time"):
    target[prop] = 0.0
    fc = target.driver_add(f'["{prop}"]')
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = "frame/24"
    return fc


# ---------------------------------------------------------------- shared lighting block
def _paint_light(nb, look, nrm, s_val, *, tex_amt=0.3, breakup=0.9, ao=0.45, front_fill=1.0, brand=None,
                 shadow_warm=0.45, warm=(1.30, 0.86, 0.74), keep_boost=0.0, term=(0.8, 0.55), vivid=None):
    """Painterly light term (colour) for a surface with normal nrm. Returns (light, E, lit_f)."""
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1), "Roughness": 0.0})
    nb.inp(dif, "Normal", nrm)
    s2r = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2r.inputs[0])
    E = s2r.outputs["Color"]
    nb.E_raw = E
    if ao > 0:
        aon = nb.n("ShaderNodeAmbientOcclusion", inputs={"Distance": 0.25})
        nb.inp(aon, "Normal", nrm)
        E = nb.mix(ao, E, nb.mix(1.0, E, aon.outputs["AO"], blend="MULTIPLY"))
    L = nb.bw(E)
    if brand is not None:
        # neutralise the light's hue (keep its brightness): brand orange survives blue/green/violet light
        grey = nb.cmul(nb.rgb((1.0, 0.97, 0.93)), L)
        E = nb.mix(brand, E, grey)
    brk = nb.mul(nb.sub(s_val, 0.5), nb.mul(look.outputs["Breakup"], breakup))
    Lb = nb.add(L, nb.mul(brk, nb.add(L, 0.15)))
    # character cheat: the terminator sits a little earlier and crisper than the set's (term = (lo scale, position
    # of hi between lo and the set's hi)), so key-facing planes read fully lit and the form turns clearly
    lo = nb.mul(look.outputs["TermLo"], term[0])
    hi = nb.lerp(term[1], look.outputs["TermLo"], look.outputs["TermHi"])
    rmp = nb.n("ShaderNodeMapRange", interpolation_type="SMOOTHSTEP", clamp=True)
    nb.inp(rmp, "Value", Lb)
    nb.inp(rmp, "From Min", lo)
    nb.inp(rmp, "From Max", hi)
    lit_f = rmp.outputs["Result"]
    # shadow side: scene tint mixed with a warm character shadow of equal brightness + kept real light + fills
    tint = look.outputs["ShadowTint"]
    tl = nb.bw(tint)
    warm_c = nb.n("ShaderNodeCombineColor", inputs={"Red": nb.mul(tl, warm[0]), "Green": nb.mul(tl, warm[1]),
                                                   "Blue": nb.mul(tl, warm[2])}).outputs[0]
    sh = nb.mix(shadow_warm, tint, warm_c)
    keep = look.outputs["ShadowKeep"] if keep_boost == 0 else nb.add(look.outputs["ShadowKeep"], keep_boost)
    kE = nb.n("ShaderNodeMix", data_type="RGBA", blend_type="MIX")
    nb.inp(kE, "Factor", keep)
    nb.inp(kE, 6, (0, 0, 0))
    nb.inp(kE, 7, E)
    shadow_light = nb.mix(1.0, sh, kE.outputs[2], blend="ADD")
    nx, ny, nz = nb.xyz(nrm)
    up = nb.mx(nz, 0.0)
    dn = nb.mx(nb.neg(nz), 0.0)
    shadow_light = nb.mix(up, shadow_light, nb.cadd(shadow_light, look.outputs["SkyFill"]))
    shadow_light = nb.mix(dn, shadow_light, nb.cadd(shadow_light, look.outputs["Bounce"]))
    if front_fill > 0:
        lwf = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.5})
        nb.inp(lwf, "Normal", nrm)
        ff = nb.mul(nb.sub(1.0, lwf.outputs["Facing"]), front_fill)
        shadow_light = nb.mix(ff, shadow_light, nb.cadd(shadow_light, look.outputs["FrontFill"]))
    lit_tex = nb.add(1.0, nb.mul(nb.mul(nb.sub(s_val, 0.5), look.outputs["LitTex"]), tex_amt * 1.4))
    lit_light = nb.cmul(E, lit_tex)
    light = nb.mix(lit_f, shadow_light, nb.mix(1.0, lit_light, shadow_light, blend="LIGHTEN"))
    if vivid is not None:
        # the hero stays the brightest warm note in a dark set: exposure lift that grows as the scene's light level
        # (its 'fully lit' irradiance TermHi) drops below a bright day's
        k = nb.add(1.0, nb.mul(vivid, nb.mul(2.0, nb.c01(nb.sub(1.0, nb.div(look.outputs["TermHi"], 1.1))))))
        light = nb.cmul(light, k)
    return light, E, lit_f


def _gloss(nb, nrm, rough, col=(1, 1, 1)):
    gl = nb.n("ShaderNodeBsdfAnisotropic")
    nb.inp(gl, "Color", col)
    nb.inp(gl, "Roughness", rough)
    nb.inp(gl, "Normal", nrm)
    s2 = nb.n("ShaderNodeShaderToRGB")
    nb.link(gl.outputs[0], s2.inputs[0])
    return s2.outputs["Color"]


# ---------------------------------------------------------------- the mouth (drawn in the body shader)
def _mouth(nb, co, face):
    """A small flat matte-black graphic mouth (the mascot has none: it is invisible until a mouth channel is used).
    smile (+ smile line / - frown), mouth_open (a 'D' laugh), mouth_o (round gasp), wobble (wavy despair line),
    teeth (gritted bar with tooth gaps), mouth_press (short tight line), mouth_wide, mouth_skew.
    Returns (inside mask, colour). face: dict(front_y, z, s) in rest coordinates (metres)."""
    fy, mz, s = face["front_y"], face["z"], face["s"]
    cx, cy, cz = nb.xyz(co)
    t = nb.prop("time")
    o, sm, wd = nb.prop("mouth_open"), nb.prop("smile"), nb.prop("mouth_wide")
    oo, te, wb = nb.prop("mouth_o"), nb.prop("teeth"), nb.prop("wobble")
    sk, pr = nb.prop("mouth_skew"), nb.prop("mouth_press")
    vis = nb.mx(nb.mx(nb.mx(o, oo), nb.mx(te, wb)), nb.mx(pr, nb.sub(nb.abs(sm), 0.04)))
    vis = nb.c01(nb.mul(vis, 12.0))
    front = nb.ss(fy + 0.010, fy + 0.003, cy)
    u = nb.div(cx, s)
    v = nb.div(nb.sub(cz, mz), s)
    W = nb.mul(nb.add(1.0, nb.mul(wd, 0.30)), nb.sub(1.0, nb.add(nb.mul(oo, 0.55), nb.mul(pr, 0.2))))
    W = nb.mul(W, nb.add(1.0, nb.mul(te, 0.15)))
    x = nb.div(u, W)
    x2 = nb.sq(x)
    yc = nb.mul(sm, nb.mul(0.50, nb.sub(x2, 0.35)))
    yc = nb.add(yc, nb.mul(sk, nb.mul(x, 0.25)))
    wav = nb.add(nb.mul(nb.math("SINE", nb.add(nb.mul(x, 9.0), nb.mul(t, 14.0))), 0.10),
                 nb.mul(nb.math("SINE", nb.add(nb.mul(x, 17.0), nb.mul(t, 23.0))), 0.04))
    yc = nb.add(yc, nb.mul(nb.mul(wb, wav), nb.sub(1.0, nb.mul(x2, 0.6))))
    # opening: flat-topped 'D' for a laugh, an ellipse for the gasp, a rounded bar for gritted teeth
    f = nb.sqrt(nb.sub(1.0, nb.math("POWER", nb.abs(x), nb.add(2.0, nb.mul(te, 4.0)))))
    H = nb.add(nb.mul(o, 0.95), nb.mul(te, 0.30))
    yu = nb.add(yc, nb.mul(f, nb.add(nb.mul(H, nb.lerp(oo, 0.08, 0.55)), nb.mul(te, 0.0))))
    yl = nb.sub(yc, nb.mul(f, nb.mul(H, nb.lerp(oo, 1.0, 0.55))))
    lw = nb.mul(nb.sub(0.11, nb.mul(pr, 0.03)), nb.sqrt(nb.sub(1.0, nb.sq(x2))))
    d = nb.mx(nb.mn(nb.sub(v, yl), nb.sub(yu, v)), nb.sub(lw, nb.abs(nb.sub(v, yc))))
    inside = nb.mul(nb.mul(nb.ss(-0.04, 0.04, d), nb.ss(1.04, 0.96, nb.abs(x))), nb.mul(front, vis))
    # gritted teeth: thin vertical gaps (the face colour shows through) across the bar
    gap = nb.mul(nb.ss(0.10, 0.04, nb.abs(nb.math("SINE", nb.mul(x, 7.5)))), nb.ss(0.3, 0.6, te))
    inside = nb.mul(inside, nb.sub(1.0, nb.mul(gap, nb.ss(0.95, 0.7, nb.abs(x)))))
    return inside, nb.rgb((0.012, 0.010, 0.010))


# ---------------------------------------------------------------- clay
def clay(name, color, kind="body", face=None, z_feet=0.19, scale=1.6, lash=False):
    """Matte painted block (the mascot's flat terracotta): flat colour with gentle painterly value variation, brush
    texture only on the lit side, no gloss (except when wet). kind: 'body' (mouth, GN damage layout), 'limb'.
    face: mouth placement + damage box (body only). z_feet: below this rest height the legs collect ash/dust."""
    m, nb = _new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    co = nb.gattr("rest", "Vector")
    ash, wet, dmg, gold, brand, vivid = (nb.prop(k) for k in ("ash", "wet", "damage", "gold", "brand", "vivid"))
    t = nb.prop("time")
    st = mat.tex_node(nb, "strokes_soft", co, scale)
    sp = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]})
    s_val, s_jit, s_h = sp.outputs[0], sp.outputs[1], sp.outputs[2]

    # ---------------- albedo: flat paint, gentle broad value variation (hand-painted, not noisy)
    big = nb.noise(co, 2.4, 2.0, 0.5)
    alb = nb.cmul(nb.rgb(color), nb.add(1.0, nb.mul(nb.sub(big, 0.5), 0.10)))
    hsv = nb.n("ShaderNodeHueSaturation")
    nb.inp(hsv, "Color", alb)
    nb.inp(hsv, "Hue", nb.add(nb.mul(nb.sub(s_jit, 0.5), 0.006), 0.5))
    nb.inp(hsv, "Value", nb.add(nb.mul(nb.sub(s_val, 0.5), 0.04), 1.0))
    nb.inp(hsv, "Saturation", look.outputs["Sat"])
    alb = hsv.outputs[0]
    # a little dust climbing up the legs from the ground
    _, _, rz0 = nb.xyz(co)
    dirt = nb.mul(nb.ss(z_feet * 0.55, -0.01, rz0), nb.add(0.15, nb.mul(nb.noise(co, 16.0, 3.0), 0.25)))
    alb = nb.mix(dirt, alb, nb.rgb((0.36, 0.25, 0.19)))

    # ---------------- mouth (body only; invisible unless a mouth channel is used)
    inside = None
    if kind == "body" and face is not None and "z" in face:
        inside, mcol = _mouth(nb, co, face)

    # ---------------- damage / gold (per pixel; the body uses the exact layout of its GN relief)
    if kind == "body" and face is not None and "box" in face:
        F = damage_fields(nb, co, dmg, face["box"][0], face["box"][1])
        chip, crack, vein, outline, bead = F["chip"], F["crack"], F["vein"], F["outline"], F["bead"]
    else:
        vc = nb.vor(co, 11.0, "DISTANCE_TO_EDGE")
        wob = nb.add(0.75, nb.mul(nb.noise(co, 9.0, 2.0, 0.5), 0.5))
        reg = nb.noise(co, 4.0, 2.0)
        thr_c = nb.sub(1.0, nb.mul(dmg, 0.40))
        rmask = nb.ss(thr_c, nb.add(thr_c, 0.05), reg)
        crack = nb.mul(nb.ss(nb.mul(wob, 0.024), nb.mul(wob, 0.008), vc), rmask)
        vein = nb.mul(nb.ss(nb.mul(wob, 0.052), nb.mul(wob, 0.036), vc), rmask)
        outline = nb.mul(nb.mul(nb.ss(nb.mul(wob, 0.075), nb.mul(wob, 0.055), vc), nb.sub(1.0, vein)), rmask)
        bead = nb.mul(nb.sqrt(nb.c01(nb.sub(1.0, nb.div(vc, nb.mul(wob, 0.052))))), rmask)
        pale = nb.vor(co, 18.0, "F1", "Color")
        pr_ = nb.n("ShaderNodeSeparateColor", inputs={"Color": pale}).outputs[0]
        chip = nb.mul(nb.ss(nb.mul(dmg, 0.22), nb.sub(nb.mul(dmg, 0.22), 0.03), pr_),
                      nb.ss(0.5, 0.6, nb.noise(co, 9.0, 3.0)))
    clay_c = nb.rgb((0.74, 0.60, 0.47))
    chip_rim = nb.mul(nb.ss(0.02, 0.25, chip), nb.ss(0.75, 0.35, chip))
    alb_d = nb.mix(nb.ss(0.15, 0.45, chip), alb, nb.mix(nb.noise(co, 60.0), clay_c, nb.rgb((0.62, 0.49, 0.38))))
    alb_d = nb.cmul(alb_d, nb.sub(1.0, nb.mul(chip_rim, 0.45)))
    alb_d = nb.mix(nb.ss(0.2, 0.7, crack), alb_d, nb.rgb((0.07, 0.03, 0.02)))
    chip_g = nb.ss(0.25, 0.55, chip)
    gold_m = nb.mul(nb.mx(chip_g, nb.ss(0.15, 0.6, vein)), gold)
    alb_d = nb.cmul(alb_d, nb.sub(1.0, nb.mul(nb.mul(outline, gold), 0.6)))
    alb = alb_d

    # ---------------- ash (grey dust on up-facing planes, the legs and lower body)
    gnrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    gx, gy, gz = nb.xyz(gnrm)
    stp = mat.tex_node(nb, "stipple", co, 2.2)
    stv = nb.n("ShaderNodeSeparateColor", inputs={"Color": stp.outputs["Color"]}).outputs[0]
    _, _, rz = nb.xyz(co)
    low = nb.ss(z_feet + 0.05, z_feet - 0.06, rz)
    cover = nb.mx(nb.ss(0.15, 0.8, gz), nb.mul(low, nb.add(0.45, nb.mul(nb.noise(co, 9.0, 3.0), 0.5))))
    cover = nb.add(cover, 0.18)
    an = nb.add(nb.mul(cover, 0.75), nb.mul(nb.sub(stv, 0.5), 0.9))
    an = nb.add(an, nb.mul(nb.sub(nb.noise(co, 14.0, 3.0), 0.5), 0.6))
    thr = nb.sub(1.05, nb.mul(ash, 1.0))
    ash_m = nb.mul(nb.ss(thr, nb.add(thr, 0.30), an), nb.ss(0.0, 0.15, ash))
    ash_m = nb.mul(ash_m, nb.add(0.55, nb.mul(nb.ss(0.3, 0.7, nb.noise(co, 55.0, 2.0)), 0.45)))
    ash_c = nb.mix(nb.ss(0.55, 0.8, nb.noise(co, 90.0, 2.0)), nb.rgb((0.31, 0.30, 0.29)), nb.rgb((0.13, 0.125, 0.12)))
    alb = nb.mix(nb.mul(ash_m, 0.92), alb, ash_c)

    # ---------------- wet (darker + saturated, running rain runnels)
    wcol = nb.n("ShaderNodeHueSaturation", inputs={"Saturation": 1.2, "Value": 0.72})
    nb.inp(wcol, "Color", alb)
    alb = nb.mix(nb.mul(wet, nb.sub(1.0, nb.mul(ash_m, 0.5))), alb, wcol.outputs[0])
    cx_, cy_, _ = nb.xyz(co)
    wv = nb.vec(nb.mul(cx_, 55.0), nb.mul(cy_, 55.0), nb.add(nb.mul(rz, 3.0), nb.mul(t, 1.6)))
    rn = nb.noise(wv, 1.0, 1.0, 0.5)
    streak = nb.mul(nb.ss(0.035, 0.008, nb.abs(nb.sub(rn, 0.5))), nb.ss(0.48, 0.62, nb.noise(co, 6.0, 2.0)))
    streak = nb.mul(streak, wet)
    alb = nb.cmul(alb, nb.sub(1.0, nb.mul(streak, 0.18)))

    # ---------------- normals: faint brush relief; gold seams are a raised bead
    bmp = nb.n("ShaderNodeBump", inputs={"Strength": 0.01, "Distance": 0.02})
    nb.inp(bmp, "Height", nb.add(s_h, nb.mul(nb.mul(nb.mx(chip, crack), -0.6), nb.sub(1.0, gold))))
    nrm = bmp.outputs[0]
    bmg = nb.n("ShaderNodeBump", inputs={"Strength": 0.9, "Distance": 0.004})
    nb.inp(bmg, "Height", nb.add(nb.mul(bead, 0.9), nb.mul(chip_g, nb.add(0.35, nb.mul(nb.noise(co, 40.0), 0.3)))))
    nb.inp(bmg, "Normal", nrm)
    nrm_g = bmg.outputs[0]

    light, E, lit_f = _paint_light(nb, look, nrm, s_val, tex_amt=0.14, breakup=0.8, ao=0.3, front_fill=1.0,
                                   brand=brand, vivid=vivid)
    col = nb.cmulc(alb, light)
    Er = nb.E_raw
    chroma = nb.mix(1.0, Er, nb.cmul(nb.rgb((1, 1, 1)), nb.mul(nb.bw(Er), 0.92)), blend="SUBTRACT")
    chroma = nb.n("ShaderNodeMix", data_type="RGBA", blend_type="LIGHTEN", clamp_result=True,
                  inputs={"Factor": 1.0, 6: chroma, 7: (0.0, 0.0, 0.0)}).outputs[2]
    col = nb.cadd(col, nb.cmul(chroma, nb.mul(nb.sub(1.0, brand), 0.42)))

    # ---------------- gloss only when wet
    rough = nb.lerp(wet, 0.42, 0.22)
    S = _gloss(nb, nrm, rough)
    sL = nb.add(nb.bw(S), nb.mul(nb.sub(s_val, 0.5), 0.9))
    stv_w = nb.noise(co, 30.0, 2.0, 0.6)
    dab = nb.ss(0.55, 0.85, nb.mul(sL, nb.add(0.75, nb.mul(stv_w, 0.5))))
    spec_amt = nb.mul(nb.add(nb.mul(wet, 0.11), nb.mul(streak, 0.7)), nb.sub(1.0, nb.mul(ash_m, 0.8)))
    col = nb.cadd(col, nb.cmul(S, nb.mul(dab, spec_amt)))
    if inside is not None:
        Lm = nb.add(nb.mul(nb.bw(light), 0.6), 0.25)
        col = nb.mix(inside, col, nb.cmul(mcol, Lm))

    # ---------------- gold: kintsugi seams (tinted metal reflections, rolling highlight, glints)
    Sg = nb.cmulc(_gloss(nb, nrm_g, 0.18), nb.rgb((1.0, 0.66, 0.16)))
    Lw = nb.bw(light)
    hi = nb.ss(0.30, 0.85, nb.add(nb.mul(nb.bw(Sg), 1.4), nb.mul(nb.sub(s_val, 0.5), 0.35)))
    dgl = _paint_light(nb, look, nrm_g, s_val, ao=0.0, front_fill=0.5, brand=brand, vivid=vivid)[0]
    gcol = nb.cmul(nb.cmulc(nb.rgb((0.62, 0.32, 0.035)), dgl), 0.95)
    gcol = nb.cadd(gcol, nb.cmul(Sg, nb.add(0.35, nb.mul(hi, 1.1))))
    gcol = nb.cadd(gcol, nb.cmul(nb.rgb((1.0, 0.80, 0.30)), nb.mul(hi, nb.mul(Lw, 0.9))))
    spark = nb.ss(0.80, 0.86, nb.noise(co, 260.0, 1.0, 0.5))
    gcol = nb.cadd(gcol, nb.cmul(nb.rgb((1.0, 0.93, 0.62)), nb.mul(nb.mul(spark, nb.add(0.3, hi)), nb.mul(Lw, 2.6))))
    lwg2 = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.35})
    nb.inp(lwg2, "Normal", nrm_g)
    gcol = nb.cadd(gcol, nb.cmul(nb.rgb((1.0, 0.6, 0.12)), nb.mul(nb.ss(0.5, 0.95, lwg2.outputs["Facing"]),
                                                                  nb.mul(Lw, 0.45))))
    col = nb.mix(gold_m, col, gcol)

    # ---------------- painterly rim on the lit side only
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.35})
    nb.inp(lw, "Normal", nrm)
    rf = nb.ss(0.6, 0.92, nb.add(lw.outputs["Facing"], nb.mul(nb.sub(s_val, 0.5), 0.3)))
    col = nb.cadd(col, nb.cmul(nb.cmulc(E, nb.rgb((1.0, 0.82, 0.62))), nb.mul(nb.mul(rf, 0.14), lit_f)))
    nb.emission_out(col)
    m.use_backface_culling = False
    return m


def socket_mat(name, front_y, color=(0.70, 0.18, 0.10)):
    """Inside of the eye sockets: the orange rim darkens into a deep warm tunnel with a lighter bezel ring that
    frames the lens (depth measured from the face plane in rest coordinates)."""
    m, nb = _new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    co = nb.gattr("rest", "Vector")
    _, cy, _ = nb.xyz(co)
    depth = nb.sub(cy, front_y)
    st = mat.tex_node(nb, "strokes_soft", co, 4.0)
    s_val = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]}).outputs[0]
    orange = nb.rgb((color[0] * 0.7, color[1] * 0.6, color[2] * 0.6))
    tunnel = nb.rgb((0.030, 0.014, 0.011))
    bezel = nb.rgb((0.32, 0.20, 0.13))
    alb = nb.mix(nb.ss(0.010, 0.018, depth), orange, tunnel)
    ring = nb.mul(nb.ss(0.016, 0.019, depth), nb.ss(0.026, 0.023, depth))
    alb = nb.mix(ring, alb, bezel)
    light, E, lit_f = _paint_light(nb, look, nb.n("ShaderNodeNewGeometry").outputs["Normal"], s_val, ao=0.8,
                                   front_fill=0.6, brand=nb.prop("brand"), keep_boost=0.1)
    col = nb.cmulc(alb, light)
    S = _gloss(nb, nb.n("ShaderNodeNewGeometry").outputs["Normal"], 0.25)
    col = nb.cadd(col, nb.cmul(S, nb.mul(ring, 0.5)))
    nb.emission_out(col)
    m.use_backface_culling = False
    return m


def lash_mat(name):
    """The rolled edge of the eyelids: a dark warm line so the lid shapes read against the lens (and the face)."""
    m, nb = _new(name)
    look = nb.n("ShaderNodeGroup")
    look.node_tree = mat.look_group()
    nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    light, E, lit_f = _paint_light(nb, look, nrm, nb.val(0.5), ao=0.0, front_fill=0.5, brand=nb.prop("brand"),
                                   vivid=nb.prop("vivid"))
    col = nb.cmulc(nb.rgb((0.10, 0.035, 0.022)), light)
    S = _gloss(nb, nrm, 0.3)
    col = nb.cadd(col, nb.cmul(S, 0.06))
    nb.emission_out(col)
    m.use_backface_culling = False
    return m


# ---------------------------------------------------------------- eyes
def eye_flat_mat(name, side=1.0, half=0.0405):
    """The mascot's eye: a flat matte-black square flush on the face, drawn as an SDF on a plane (object coords,
    origin = eye centre, the plane in XZ). All expression is the SHAPE of the square, from packed object props
    (eyeA..eyeD, see PACKS): e_open (blink: squashes to a thin bar; > 1 = wide), e_tilt (+ sad: the top edge droops
    toward the outside; - angry/determined: it slants down toward the centre), e_happy (an upturned arc '^'),
    e_sag (closed eyes curve down: sleep), e_squeeze ('> <' chevrons pointing inward), e_lower (bottom edge rises:
    squint), e_lookx / e_looky (the square shifts across the face), e_pupil (slight scale: wonder / fear),
    e_glint (one tiny soft highlight), e_tears (water wells under the square, a bead hangs), e_wet (wet gloss).
    side: +1 for the left eye (+X), -1 for the right."""
    m, nb = _new(name)
    po = nb.n("ShaderNodeTexCoord").outputs["Object"]
    px, py, pz = nb.xyz(po)
    u = nb.div(px, half)
    v = nb.div(pz, half)
    o, tilt, hp = nb.prop("e_open"), nb.prop("e_tilt"), nb.prop("e_happy")
    sag, sq, low = nb.prop("e_sag"), nb.prop("e_squeeze"), nb.prop("e_lower")
    lx, ly, pup = nb.prop("e_lookx"), nb.prop("e_looky"), nb.prop("e_pupil")
    gl, tears, ewet = nb.prop("e_glint"), nb.prop("e_tears"), nb.prop("e_wet")
    sc = nb.add(1.0, nb.mul(nb.mx(nb.mn(nb.sub(pup, 1.0), 0.6), -0.6), 0.22))
    wide = nb.mx(nb.sub(o, 1.0), 0.0)
    sw = nb.mul(sc, nb.add(1.0, nb.mul(wide, 0.12)))
    sh = nb.mul(sc, nb.add(1.0, nb.mul(wide, 0.40)))
    x = nb.div(nb.sub(u, nb.mul(lx, 0.30)), sw)
    y = nb.div(nb.sub(v, nb.mul(ly, 0.24)), sh)
    xo = nb.mul(x, side)
    oc = nb.c01(o)
    h = nb.add(0.085, nb.mul(oc, 0.915))
    c = nb.mul(nb.sub(1.0, oc), -0.08)
    c = nb.sub(c, nb.mul(nb.mul(sag, nb.mul(0.42, nb.sub(1.0, nb.sq(x)))), nb.sub(1.0, nb.mul(oc, 0.8))))
    top = nb.add(c, h)
    bot = nb.sub(c, h)
    bot = nb.add(bot, nb.mul(nb.mul(low, 1.05), h))
    drop = nb.add(nb.mul(nb.mx(tilt, 0.0), nb.mul(0.55, nb.add(1.0, xo))),
                  nb.mul(nb.mx(nb.neg(tilt), 0.0), nb.mul(0.55, nb.sub(1.0, xo))))
    top = nb.sub(top, nb.mul(drop, nb.mx(oc, 0.15)))
    top = nb.mx(top, nb.add(bot, 0.17))
    ar = nb.add(-0.62, nb.mul(1.30, nb.sub(1.0, nb.math("POWER", nb.abs(x), 1.35))))
    top = nb.lerp(hp, top, nb.add(ar, 0.30))
    bot = nb.lerp(hp, bot, nb.sub(ar, 0.30))
    # rounded square
    r = 0.13
    qx = nb.sub(nb.abs(x), 1.0 - r)
    qy = nb.sub(nb.abs(y), 1.0 - r)
    d_box = nb.sub(nb.add(nb.sqrt(nb.add(nb.sq(nb.mx(qx, 0.0)), nb.sq(nb.mx(qy, 0.0)))),
                          nb.mn(nb.mx(qx, qy), 0.0)), r)
    d = nb.mx(d_box, nb.mx(nb.sub(y, top), nb.sub(bot, y)))
    # squeeze: '> <' chevrons, vertex toward the nose
    xn = nb.mul(nb.sub(1.0, xo), 0.5)
    d_ch = nb.sub(nb.mul(nb.abs(nb.sub(nb.abs(y), nb.mul(0.80, nb.sub(1.0, xn)))), 0.93), 0.16)
    d_ch = nb.mx(d_ch, nb.sub(nb.abs(x), 0.92))
    d = nb.lerp(sq, d, d_ch)
    a_eye = nb.ss(0.035, -0.035, d)
    # tears: water welling along the bottom edge, a bead hanging at the outer corner
    bw = nb.lerp(hp, bot, nb.sub(ar, 0.30))
    wl = nb.mul(nb.mul(nb.ss(0.10, 0.03, nb.abs(nb.sub(y, nb.sub(bot, 0.08)))), nb.ss(0.95, 0.70, nb.abs(x))),
                nb.c01(nb.mul(tears, 1.4)))
    wl = nb.mul(wl, nb.mul(nb.sub(1.0, nb.mul(hp, 0.85)), nb.sub(1.0, nb.mul(sq, 0.85))))
    bd = nb.sqrt(nb.add(nb.sq(nb.sub(xo, 0.55)), nb.sq(nb.div(nb.sub(y, nb.sub(bot, nb.mul(tears, 0.34))), 1.25))))
    bead = nb.mul(nb.ss(nb.mul(tears, 0.19), nb.mul(tears, 0.13), bd), nb.ss(0.2, 0.6, tears))
    a_w = nb.mul(nb.mx(wl, bead), nb.sub(1.0, a_eye))
    # light response (matte black stays black; a hint of the light so it isn't a hole)
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
    s2 = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2.inputs[0])
    E = s2.outputs["Color"]
    L = nb.bw(E)
    nrm = nb.n("ShaderNodeNewGeometry").outputs["Normal"]
    S = _gloss(nb, nrm, nb.lerp(nb.mx(ewet, tears), 0.35, 0.12))
    Sc = nb.n("ShaderNodeMix", data_type="RGBA", blend_type="DARKEN", inputs={"Factor": 1.0, 6: S, 7: (0.9, 0.9, 0.9)})
    S = Sc.outputs[2]
    black = nb.cadd(nb.cmul(nb.rgb((0.004, 0.0035, 0.004)), nb.add(0.7, nb.mul(L, 0.3))),
                    nb.cmul(S, nb.add(0.01, nb.mul(nb.mx(ewet, tears), 0.07))))
    # one tiny, soft highlight (upper left on screen) while the eye is open
    hd = nb.sqrt(nb.add(nb.sq(nb.add(x, 0.48)), nb.sq(nb.sub(y, nb.sub(top, 0.42)))))
    hl = nb.mul(nb.mul(nb.ss(0.15, 0.05, hd), nb.mul(gl, 0.30)), nb.mul(nb.ss(0.55, 0.85, oc), nb.sub(1.0, hp)))
    col = nb.cadd(black, nb.cmul(nb.cmul(E, 1.0), hl))
    # water: mostly clear (the face shows through), a bright wet edge and real reflections
    edge = nb.ss(0.02, 0.0, nb.abs(nb.sub(y, nb.sub(bot, 0.11))))
    water = nb.cadd(nb.cmul(nb.cmulc(nb.rgb((0.80, 0.88, 0.95)), E), nb.add(0.25, nb.mul(edge, 0.9))),
                    nb.cmul(S, 0.8))
    col = nb.mix(nb.div(a_w, nb.mx(nb.add(a_w, a_eye), 1e-4)), col, water)
    alpha = nb.c01(nb.add(a_eye, nb.mul(a_w, 0.55)))
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


def glass_mat(name, half=(0.074, 0.083)):
    """The lens glass: transparent smoky glass with real reflections (lights + sky) plus painted catch-lights. The
    painted ones live in lens coordinates but are aligned to the screen (upper-left window, lower-right dot), so
    they always sit inside the lens at any view angle; their colour follows the light reaching the eye (green from
    the seed, gold in the beam). half: the lens opening half size (m)."""
    m, nb = _new(name)
    glint = nb.prop("glint")
    tears = nb.prop("tears")
    wet = nb.prop("wet")
    gn = nb.n("ShaderNodeNewGeometry")
    nrm = gn.outputs["Normal"]
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.22})
    fr = lw.outputs["Fresnel"]
    rough = nb.lerp(nb.mx(tears, nb.mul(wet, 0.5)), 0.06, 0.02)
    S = _gloss(nb, nrm, rough)
    refl = nb.cmul(S, nb.add(nb.add(0.05, nb.mul(fr, 0.55)), nb.mul(tears, 0.25)))
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
    s2 = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2.inputs[0])
    Ein = s2.outputs["Color"]
    lum = nb.mx(nb.bw(Ein), 0.002)
    hue = nb.cmul(Ein, nb.div(1.0, lum))
    level = nb.add(0.35, nb.mul(nb.math("POWER", lum, 0.5), 0.45))
    # lens coordinates (+-1 at the opening edges) -> screen-aligned axes
    po = nb.n("ShaderNodeTexCoord").outputs["Object"]
    px, py, pz = nb.xyz(po)
    u = nb.div(px, half[0])
    v = nb.div(pz, half[1])

    def cam_axis(vec):
        vt_ = nb.n("ShaderNodeVectorTransform", vector_type="VECTOR", convert_from="CAMERA", convert_to="OBJECT")
        vt_.inputs[0].default_value = vec
        ax_, _, az_ = nb.xyz(vt_.outputs[0])
        ln = nb.mx(nb.sqrt(nb.add(nb.sq(ax_), nb.sq(az_))), 1e-4)
        return nb.div(ax_, ln), nb.div(az_, ln)
    def irr(dz):
        vt2 = nb.n("ShaderNodeVectorTransform", vector_type="VECTOR", convert_from="CAMERA", convert_to="WORLD")
        vt2.inputs[0].default_value = (0.0, 0.0, 1.0)
        nn = nb.vmath("NORMALIZE", nb.vmath("ADD", vt2.outputs[0], (0.0, 0.0, dz)))
        d_ = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
        nb.inp(d_, "Normal", nn)
        s_ = nb.n("ShaderNodeShaderToRGB")
        nb.link(d_.outputs[0], s_.inputs[0])
        e_ = s_.outputs["Color"]
        l_ = nb.mx(nb.bw(e_), 0.002)
        return nb.cmul(e_, nb.div(1.0, l_)), nb.add(0.35, nb.mul(nb.math("POWER", l_, 0.5), 0.45))
    hue_up, lev_up = irr(0.9)
    hue_dn, lev_dn = irr(-1.2)
    rx, rz = cam_axis((1.0, 0.0, 0.0))
    ux, uz = cam_axis((0.0, 1.0, 0.0))
    sx = nb.add(nb.mul(u, rx), nb.mul(v, rz))
    sy = nb.add(nb.mul(u, ux), nb.mul(v, uz))
    qx = nb.mx(nb.sub(nb.abs(nb.sub(sx, -0.36)), 0.13), 0.0)
    qy = nb.mx(nb.sub(nb.abs(nb.sub(sy, 0.40)), 0.08), 0.0)
    d1 = nb.sqrt(nb.add(nb.sq(qx), nb.sq(qy)))
    c1 = nb.ss(0.10, 0.06, d1)
    d2 = nb.sqrt(nb.add(nb.sq(nb.sub(sx, 0.40)), nb.sq(nb.mul(nb.sub(sy, -0.42), 1.1))))
    c2 = nb.mul(nb.ss(0.10, 0.06, d2), 0.7)
    vt = nb.n("ShaderNodeVectorTransform", vector_type="NORMAL", convert_from="WORLD", convert_to="CAMERA")
    nb.inp(vt, "Vector", nrm)
    nx, ny, nz = nb.xyz(vt.outputs[0])
    # soft sky sheen over the top of the glass, and a wet crescent along the bottom when tearful
    sheen = nb.mul(nb.ss(0.0, 0.9, sy), 0.12)
    pool = nb.mul(nb.mul(nb.ss(-0.55, -0.85, sy), nb.ss(0.75, 0.3, nb.abs(sx))), nb.mul(tears, 0.9))
    refl = nb.cadd(refl, nb.cmul(nb.cmulc(Ein, nb.rgb((0.6, 0.7, 0.8))), nb.mul(sheen, 0.25)))
    w_ = nb.rgb((1, 1, 1))
    ccol = nb.cadd(nb.cmul(nb.mix(0.25, hue_up, w_), nb.mul(lev_up, nb.mul(nb.add(c1, pool), glint))),
                   nb.cmul(nb.mix(0.15, hue_dn, w_), nb.mul(lev_dn, nb.mul(c2, glint))))
    refl = nb.cadd(refl, nb.cmul(nb.cmulc(Ein, nb.rgb((0.6, 0.7, 0.8))), nb.mul(sheen, 0.25)))
    col = nb.cadd(refl, nb.cmul(ccol, 2.4))
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    tr = nb.n("ShaderNodeBsdfTransparent", inputs={"Color": (0.62, 0.64, 0.68)})
    add = nb.n("ShaderNodeAddShader")
    nb.link(tr.outputs[0], add.inputs[0])
    nb.link(em.outputs[0], add.inputs[1])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(add.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    return m


def eyeball_mat(name, iris=(0.030, 0.20, 0.25), iris_in=(0.006, 0.040, 0.055), coat=(0.20, 0.50, 0.52)):
    """The eye behind the glass (local coords, forward = -Y): a camera iris. A softly hexagonal aperture pupil that
    dilates ('pupil'), a deep teal iris with radial striations and fine concentric engraving, a thin pale coated
    ring and a dark limbal ring, inside near-black glass; a faint glow ('iris_glow') lets the iris read inside the
    dark lens. Lids and socket occlude it (AO)."""
    m, nb = _new(name)
    pupil = nb.prop("pupil")
    glow = nb.prop("iris_glow")
    tc = nb.n("ShaderNodeTexCoord").outputs["Object"]
    px, py, pz = nb.xyz(tc)
    r = nb.sqrt(nb.add(nb.add(nb.sq(px), nb.sq(py)), nb.sq(pz)))
    rho = nb.div(nb.sqrt(nb.add(nb.sq(px), nb.sq(pz))), r)           # sin(angle from the eye axis)
    phi = nb.math("ARCTAN2", pz, px)
    Ri = 0.34
    Rp = nb.lerp(nb.c01(nb.div(nb.sub(pupil, 0.4), 1.2)), 0.08, 0.25)
    k = nb.sub(nb.math("FLOORED_MODULO", nb.add(phi, nb.add(0.3, nb.mul(pupil, 0.6))), math.pi / 3), math.pi / 6)
    rhex = nb.div(nb.mul(Rp, math.cos(math.pi / 6)), nb.math("COSINE", k))
    rp = nb.lerp(0.35, Rp, rhex)
    pup = nb.ss(nb.add(rp, 0.010), nb.sub(rp, 0.004), rho)
    irm = nb.ss(Ri + 0.016, Ri - 0.004, rho)
    tt = nb.c01(nb.div(nb.sub(rho, rp), nb.sub(Ri, rp)))
    icol = nb.mix(nb.ss(0.0, 0.8, tt), nb.rgb(iris_in), nb.rgb(iris))
    icol = nb.mix(nb.mul(nb.ss(0.74, 0.84, tt), nb.ss(0.93, 0.86, tt)), icol, nb.rgb(coat))
    icol = nb.mix(nb.ss(0.88, 1.0, tt), icol, nb.rgb((0.004, 0.014, 0.02)))
    stri = nb.noise(nb.vec(nb.math("COSINE", phi), nb.math("SINE", phi), nb.mul(rho, 3.0)), 7.0, 3.0, 0.6)
    icol = nb.cmul(icol, nb.add(0.62, nb.mul(stri, 0.78)))
    ring = nb.add(0.86, nb.mul(nb.math("SINE", nb.mul(rho, 160.0)), 0.14))
    icol = nb.cmul(icol, ring)
    # thin bright ring at the aperture edge (the blades catch the light)
    blade = nb.mul(nb.ss(0.014, 0.0, nb.abs(nb.sub(rho, nb.add(rp, 0.010)))), 0.30)
    icol = nb.cadd(icol, nb.cmul(nb.rgb(coat), blade))
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
    s2 = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2.inputs[0])
    Lr = nb.bw(s2.outputs["Color"])
    lit = nb.add(nb.mul(glow, 0.9), nb.mul(nb.math("POWER", nb.mx(Lr, 0.0), 0.6), 0.45))
    col = nb.cmul(icol, lit)
    sclera = nb.cmul(nb.rgb((0.004, 0.005, 0.007)), nb.add(0.5, Lr))
    col = nb.mix(irm, sclera, col)
    col = nb.mix(pup, col, nb.rgb((0.0, 0.0, 0.0)))
    ao = nb.n("ShaderNodeAmbientOcclusion", inputs={"Distance": 0.035})
    col = nb.cmul(col, nb.lerp(ao.outputs["AO"], 0.15, 1.0))
    nb.emission_out(col)
    return m


def water_mat(name, alpha_prop="tears"):
    """Tear water: clear glossy drops/welling (reflections + a bright painted highlight), alpha by a property."""
    m, nb = _new(name)
    a = nb.c01(nb.mul(nb.prop(alpha_prop), 1.6))
    gn = nb.n("ShaderNodeNewGeometry")
    nrm = gn.outputs["Normal"]
    S = _gloss(nb, nrm, 0.03)
    lw = nb.n("ShaderNodeLayerWeight", inputs={"Blend": 0.3})
    fr = lw.outputs["Fresnel"]
    vt = nb.n("ShaderNodeVectorTransform", vector_type="NORMAL", convert_from="WORLD", convert_to="CAMERA")
    nb.inp(vt, "Vector", nrm)
    nx, ny, nz = nb.xyz(vt.outputs[0])
    hl = nb.ss(0.35, 0.15, nb.sqrt(nb.add(nb.sq(nb.sub(nx, -0.3)), nb.sq(nb.sub(ny, 0.45)))))
    dif = nb.n("ShaderNodeBsdfDiffuse", inputs={"Color": (1, 1, 1)})
    s2 = nb.n("ShaderNodeShaderToRGB")
    nb.link(dif.outputs[0], s2.inputs[0])
    L = nb.add(0.25, nb.math("POWER", nb.mx(nb.bw(s2.outputs["Color"]), 0.0), 0.5))
    col = nb.cadd(nb.cmul(S, nb.add(0.5, fr)), nb.cmul(nb.rgb((1, 1, 1)), nb.mul(hl, nb.mul(L, 1.4))))
    em = nb.n("ShaderNodeEmission", inputs={"Strength": 1.0})
    nb.inp(em, "Color", col)
    tr = nb.n("ShaderNodeBsdfTransparent", inputs={"Color": (0.86, 0.88, 0.9)})
    add = nb.n("ShaderNodeAddShader")
    nb.link(tr.outputs[0], add.inputs[0])
    nb.link(em.outputs[0], add.inputs[1])
    full = nb.n("ShaderNodeBsdfTransparent")
    mx = nb.n("ShaderNodeMixShader")
    nb.inp(mx, "Fac", a)
    nb.link(full.outputs[0], mx.inputs[1])
    nb.link(add.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputMaterial")
    nb.link(mx.outputs[0], out.inputs["Surface"])
    m.surface_render_method = "BLENDED"
    m.use_backface_culling = True
    return m


# ---------------------------------------------------------------- geometry-nodes damage
def damage_fields(nb, R, dmg, half, center):
    """The damage layout as a pure function of rest position R and Damage (node graph; works in shader AND geometry
    trees, so the GN relief and the per-pixel shader use the identical crack network). Returns a dict of sockets:
    edge (1 on the box bevels), chip (knocked-out cells in a noisy edge band, more as damage rises), crack (dark
    hairline), vein (the wider kintsugi seam along the same cracks), outline (thin rim just outside the vein),
    bead (rounded vein profile for the raised gold), dent."""
    p = nb.vmath("SUBTRACT", R, tuple(center))
    ap = nb.vmath("ABSOLUTE", p)
    q = nb.vmath("SUBTRACT", tuple(half), ap)
    qx, qy, qz = nb.xyz(q)
    dmin = nb.mn(qx, nb.mn(qy, qz))
    dmax = nb.mx(qx, nb.mx(qy, qz))
    dmid = nb.sub(nb.sub(nb.add(nb.add(qx, qy), qz), dmin), dmax)
    edge = nb.ss(0.075, 0.0, dmid)
    n1 = nb.noise(R, 7.0, 3.0, 0.6)
    em = nb.add(edge, nb.mul(nb.sub(n1, 0.5), 0.75))
    cell = nb.vor(R, 18.0, "F1", "Color")
    rnd = nb.xyz(cell)[0]
    de = nb.div(nb.vor(R, 18.0, "DISTANCE_TO_EDGE"), 18.0)
    thr = nb.mul(dmg, 0.34)
    present = nb.ss(thr, nb.sub(thr, 0.04), rnd)
    band = nb.ss(0.68, 0.78, em)
    chip = nb.mul(nb.mul(present, band), nb.ss(0.0, 0.0035, de))
    # cracks: a larger Voronoi net, spreading from the damaged edges as Damage rises; the width wanders
    vc = nb.vor(R, 6.5, "DISTANCE_TO_EDGE")
    wob = nb.add(0.75, nb.mul(nb.noise(R, 9.0, 2.0, 0.5), 0.5))
    n2 = nb.noise(R, 2.6, 2.0, 0.5)
    reach = nb.add(nb.mul(edge, 0.45), nb.mul(n2, 0.75))
    thr_c = nb.sub(1.22, nb.mul(dmg, 0.80))
    rmask = nb.ss(thr_c, nb.add(thr_c, 0.06), reach)
    crack = nb.mul(nb.ss(nb.mul(wob, 0.016), nb.mul(wob, 0.006), vc), rmask)
    vein = nb.mul(nb.ss(nb.mul(wob, 0.034), nb.mul(wob, 0.022), vc), rmask)
    outline = nb.mul(nb.mul(nb.ss(nb.mul(wob, 0.050), nb.mul(wob, 0.036), vc), nb.sub(1.0, vein)), rmask)
    bead = nb.mul(nb.sqrt(nb.c01(nb.sub(1.0, nb.div(vc, nb.mul(wob, 0.034))))), rmask)
    dent = nb.mul(nb.ss(0.62, 0.74, nb.noise(R, 4.2, 2.0, 0.5)), dmg)
    return dict(edge=edge, chip=chip, crack=crack, vein=vein, outline=outline, bead=bead, dent=dent)


def damage_group(name, half, center):
    """GN group (modifier after Armature + Subsurf): the geometric relief of damage_fields: chips knocked out of the
    edges, hairline grooves, soft dents; Gold fills chips and seams slightly proud of the surface (kintsugi). Stores
    'edge' (+ coarse chip / crack) for the shader; the shader recomputes chip / crack / vein per pixel from the same
    layout, so seams stay crisp. half/center: the body box (rest coordinates, metres)."""
    g = bpy.data.node_groups.new(name, "GeometryNodeTree")
    if hasattr(g, "is_modifier"):
        g.is_modifier = True
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    sd = g.interface.new_socket("Damage", in_out="INPUT", socket_type="NodeSocketFloat")
    sg = g.interface.new_socket("Gold", in_out="INPUT", socket_type="NodeSocketFloat")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    nb = G(g)
    gi = nb.n("NodeGroupInput")
    go = nb.n("NodeGroupOutput")
    rest = nb.n("GeometryNodeInputNamedAttribute", data_type="FLOAT_VECTOR")
    rest.inputs["Name"].default_value = "rest"
    R = rest.outputs["Attribute"]
    dmg = gi.outputs["Damage"]
    gold = gi.outputs["Gold"]
    F = damage_fields(nb, R, dmg, half, center)
    chip, crack, edge, dent = F["chip"], F["crack"], F["edge"], F["dent"]
    # gold: chips refilled ~1 mm proud, seams a raised bead
    depth = nb.add(nb.add(nb.mul(nb.mul(chip, 0.0085), nb.sub(1.0, nb.mul(gold, 1.12))),
                          nb.mul(nb.mul(crack, 0.0016), nb.sub(1.0, nb.mul(gold, 1.6)))),
                   nb.mul(dent, nb.mul(0.004, nb.sub(1.0, nb.mul(gold, 0.5)))))
    nrm = nb.n("GeometryNodeInputNormal").outputs["Normal"]
    off = nb.n("ShaderNodeVectorMath", operation="SCALE")
    nb.link(nrm, off.inputs[0])
    nb.inp(off, "Scale", nb.neg(depth))
    sp = nb.n("GeometryNodeSetPosition")
    nb.link(gi.outputs[0], sp.inputs["Geometry"])
    nb.link(off.outputs[0], sp.inputs["Offset"])
    geo_ = sp.outputs[0]
    for nm, val in (("chip", chip), ("crack", crack), ("edge", edge)):
        s_ = nb.n("GeometryNodeStoreNamedAttribute", data_type="FLOAT", domain="POINT")
        nb.link(geo_, s_.inputs["Geometry"])
        s_.inputs["Name"].default_value = nm
        nb.link(val, s_.inputs["Value"])
        geo_ = s_.outputs[0]
    nb.link(geo_, go.inputs[0])
    return g, sd.identifier, sg.identifier
