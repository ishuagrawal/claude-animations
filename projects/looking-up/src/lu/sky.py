"""Painted sky (world shader) + sun/fill/rim light rigs per time of day (the color script).

The sky is painted in the world shader: elevation gradient, sun glow + disk, brushed cloud bands and
stippled cirrus sampled on the sky sphere, stars at night. Lighting rigs are tuned per preset.

v2 "night" (the whole film is one night) uses its own painter (_night_sky): a brushed deep-ultramarine ->
teal gradient with a thin warm twilight band low over the cloud sea, a painted moon (NE, high: the cool key),
moonlit cloud wisps, a dense three-layer star field (size / brightness / colour / slow twinkle), a soft brushy
Milky Way, and a violet/pink glow around the constellation for the emotional beats (emotion(), key_ignite()).
"""
import math
import bpy
from mathutils import Vector, Euler

from .mat import NB, image

CURRENT = {}          # the preset dict of the last build() (read by clouds/post/scene for preset-aware defaults)
NIGHT_MOON = (42.0, 52.0)     # moon azimuth (deg, 0 = +X east, 90 = +Y north), elevation: north-east, high


def sky_dir(az_deg, el_deg):
    a, e = math.radians(az_deg), math.radians(el_deg)
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


def is_night():
    return CURRENT.get("painter") == "night2"

# colour script (linear RGB). Elevation ramp: below, horizon, low, mid, zenith.
PRESETS = {
    "golden": dict(
        ramp=[(-0.2, (0.55, 0.34, 0.32)), (0.0, (1.0, 0.68, 0.40)), (0.05, (0.98, 0.58, 0.42)),
              (0.2, (0.52, 0.44, 0.66)), (0.6, (0.13, 0.17, 0.42))],
        sun_dir=(-0.70, 0.66, 0.22), sun_col=(1.0, 0.72, 0.42), sun_glow=(1.0, 0.62, 0.30), glow=2.2, disk=14.0,
        cloud_lit=(1.0, 0.80, 0.58), cloud_dark=(0.50, 0.40, 0.62), cloud_amt=0.95, stars=0.0, cirrus=0.5,
        key=(1.0, 0.64, 0.34), key_e=3.6, fill=(0.45, 0.42, 0.75), fill_e=0.0, rim=(1.0, 0.55, 0.38), rim_e=0.0,
        world_e=0.28, haze=(0.98, 0.70, 0.52),
        look=dict(ShadowTint=(0.10, 0.12, 0.17), ShadowKeep=0.35, Sat=1.2, SkyFill=(0.05, 0.09, 0.16), Bounce=(0.05, 0.035, 0.02), FrontFill=(0.16, 0.12, 0.13)),
    ),
    "day": dict(
        ramp=[(-0.2, (0.6, 0.7, 0.85)), (0.0, (0.82, 0.88, 0.95)), (0.08, (0.62, 0.76, 0.95)),
              (0.3, (0.32, 0.52, 0.9)), (0.7, (0.14, 0.3, 0.75))],
        sun_dir=(-0.4, 0.5, 0.75), sun_col=(1.0, 0.95, 0.85), sun_glow=(1.0, 0.95, 0.85), glow=0.6, disk=10.0,
        cloud_lit=(1.0, 1.0, 1.0), cloud_dark=(0.62, 0.68, 0.82), cloud_amt=0.7, stars=0.0,
        key=(1.0, 0.94, 0.82), key_e=5.0, fill=(0.5, 0.6, 0.9), fill_e=0.0, rim=(1, 1, 1), rim_e=0.0,
        world_e=0.7, haze=(0.75, 0.84, 0.95),
        look=dict(ShadowTint=(0.20, 0.26, 0.45), ShadowKeep=0.35, TermLo=0.06, TermHi=0.3, Sat=1.1),
    ),
    "dusk": dict(
        ramp=[(-0.2, (0.12, 0.10, 0.18)), (0.0, (0.85, 0.42, 0.25)), (0.05, (0.55, 0.32, 0.38)),
              (0.2, (0.16, 0.16, 0.34)), (0.6, (0.04, 0.06, 0.16))],
        sun_dir=(-0.8, 0.6, -0.03), sun_col=(1.0, 0.45, 0.25), sun_glow=(1.0, 0.42, 0.22), glow=1.2, disk=0.0,
        cloud_lit=(0.95, 0.5, 0.42), cloud_dark=(0.18, 0.16, 0.3), cloud_amt=0.7, stars=0.25,
        key=(1.0, 0.45, 0.28), key_e=1.2, fill=(0.3, 0.32, 0.6), fill_e=0.25, rim=(1.0, 0.5, 0.35), rim_e=0.0,
        world_e=0.3, haze=(0.45, 0.30, 0.40),
        look=dict(ShadowTint=(0.045, 0.05, 0.12), ShadowKeep=0.32, TermLo=0.04, TermHi=0.22, Sat=1.12,
                  SkyFill=(0.03, 0.04, 0.09), Bounce=(0.02, 0.015, 0.015), FrontFill=(0.06, 0.05, 0.07)),
    ),
    "night": dict(
        painter="night2",
        # elevation ramp (also the fallback lighting gradient): deep ultramarine zenith -> teal -> horizon haze
        ramp=[(-0.2, (0.040, 0.058, 0.080)), (0.0, (0.080, 0.100, 0.124)), (0.035, (0.060, 0.088, 0.118)),
              (0.10, (0.038, 0.068, 0.104)), (0.30, (0.020, 0.040, 0.084)), (0.60, (0.012, 0.023, 0.068)),
              (1.0, (0.008, 0.014, 0.052))],
        sun_dir=tuple(sky_dir(*NIGHT_MOON)), sun_col=(0.62, 0.75, 1.0), sun_glow=(0.42, 0.55, 0.70), glow=0.25,
        disk=0.0, cloud_lit=(0.25, 0.33, 0.42), cloud_dark=(0.03, 0.05, 0.075), cloud_amt=0.6, stars=1.0, cirrus=0.3,
        key=(0.60, 0.74, 1.0), key_e=1.6, fill=(0.2, 0.35, 0.45), fill_e=0.0, rim=(0.55, 0.72, 1.0), rim_e=0.0,
        world_e=1.0, haze=(0.070, 0.105, 0.130),
        # lighting seen by surfaces (not the camera): cool sky above, darker below
        light_ramp=((0.060, 0.090, 0.135), (0.050, 0.066, 0.078), (0.022, 0.028, 0.034)),
        term=(0.045, 0.17),            # painterly terminator (irradiance luminance), relative to this rig
        # cool sky-fill from the south-south-west, low, no shadows: the windmill's south front, the sails and Claude
        # riding them stay readable from SH01/SH15/SH19 (the moon is behind them) while the silhouette keeps its drama
        south_fill=dict(az=258.0, el=16.0, col=(0.50, 0.64, 0.88), e=0.62),
        look=dict(ShadowTint=(0.026, 0.048, 0.068), ShadowKeep=0.42, Sat=1.06, SkyFill=(0.016, 0.030, 0.046),
                  Bounce=(0.010, 0.011, 0.013), FrontFill=(0.075, 0.060, 0.070), Breakup=0.6, LitTex=0.6),
        night=dict(
            moon=NIGHT_MOON, moon_disk=1.0, moon_glow=1.0,
            band=(0.36, 0.17, 0.085), band_amt=1.0, band_az=145.0, band_el=0.010, band_w=0.020,
            afterglow=(0.085, 0.048, 0.085),
            stars=1.0, milky=1.0, milky_a=(140.0, 0.0), milky_b=(120.0, 50.0),
            wisps=1.0, wisp_lit=(0.20, 0.265, 0.345), wisp_dark=(0.026, 0.042, 0.062),
            emo_violet=(0.13, 0.045, 0.20), emo_pink=(0.34, 0.095, 0.17), emotion=0.0,
            brush=1.0,
        ),
        clouds=dict(lit=(0.158, 0.218, 0.300), mid=(0.052, 0.084, 0.130), shade=(0.024, 0.042, 0.075),
                    rim=(0.42, 0.56, 0.80), warm=(0.30, 0.17, 0.10), haze=(0.058, 0.082, 0.112),
                    fog_near=300.0, fog_far=4400.0, rock=(0.030, 0.105, 0.110), snow=(0.27, 0.40, 0.47)),
    ),
    "pink": dict(
        ramp=[(-0.2, (0.5, 0.3, 0.4)), (0.0, (1.0, 0.62, 0.52)), (0.06, (0.95, 0.48, 0.6)),
              (0.25, (0.62, 0.45, 0.75)), (0.65, (0.25, 0.30, 0.62))],
        sun_dir=(0.6, 0.78, 0.05), sun_col=(1.0, 0.68, 0.5), sun_glow=(1.0, 0.7, 0.55), glow=1.4, disk=16.0,
        cloud_lit=(1.0, 0.66, 0.74), cloud_dark=(0.55, 0.45, 0.68), cloud_amt=0.9, stars=0.0,
        key=(1.0, 0.68, 0.52), key_e=4.5, fill=(0.6, 0.5, 0.85), fill_e=0.0, rim=(1, 0.6, 0.6), rim_e=0.0,
        world_e=0.6, haze=(0.95, 0.66, 0.72),
        look=dict(ShadowTint=(0.28, 0.22, 0.45), ShadowKeep=0.35, TermLo=0.06, TermHi=0.3, Sat=1.12),
    ),
    "storm": dict(
        ramp=[(-0.2, (0.05, 0.06, 0.08)), (0.0, (0.16, 0.2, 0.25)), (0.1, (0.12, 0.15, 0.2)),
              (0.4, (0.07, 0.09, 0.13)), (0.8, (0.04, 0.05, 0.08))],
        sun_dir=(0.2, 0.7, 0.7), sun_col=(0.6, 0.7, 0.85), sun_glow=(0.3, 0.35, 0.45), glow=0.1, disk=0.0,
        cloud_lit=(0.3, 0.34, 0.4), cloud_dark=(0.06, 0.07, 0.1), cloud_amt=1.0, stars=0.0,
        key=(0.6, 0.7, 0.9), key_e=0.6, fill=(0.2, 0.25, 0.35), fill_e=0.0, rim=(0.6, 0.7, 0.9), rim_e=0.0,
        world_e=0.25, haze=(0.06, 0.075, 0.1),
        look=dict(ShadowTint=(0.03, 0.035, 0.055), ShadowKeep=0.4, TermLo=0.03, TermHi=0.18, Sat=1.0,
                  SkyFill=(0.02, 0.025, 0.04), Bounce=(0.01, 0.01, 0.012), FrontFill=(0.04, 0.04, 0.05)),
    ),
    "winter": dict(
        ramp=[(-0.2, (0.6, 0.65, 0.75)), (0.0, (0.82, 0.84, 0.9)), (0.1, (0.7, 0.75, 0.86)),
              (0.35, (0.5, 0.58, 0.75)), (0.8, (0.32, 0.4, 0.6))],
        sun_dir=(-0.5, 0.6, 0.35), sun_col=(1.0, 0.9, 0.8), sun_glow=(1.0, 0.92, 0.85), glow=0.5, disk=6.0,
        cloud_lit=(0.95, 0.95, 1.0), cloud_dark=(0.6, 0.65, 0.78), cloud_amt=0.85, stars=0.0,
        key=(1.0, 0.92, 0.82), key_e=3.0, fill=(0.6, 0.7, 0.9), fill_e=0.0, rim=(1, 1, 1), rim_e=0.0,
        world_e=0.8, haze=(0.8, 0.84, 0.92),
        look=dict(ShadowTint=(0.30, 0.36, 0.55), ShadowKeep=0.35, TermLo=0.06, TermHi=0.3, Sat=1.05),
    ),
}


INTERIOR_LOOK = {
    "night": dict(ShadowTint=(0.022, 0.03, 0.055), ShadowKeep=0.6, Sat=1.2, SkyFill=(0.010, 0.016, 0.034),
                  Bounce=(0.035, 0.019, 0.008), FrontFill=(0.05, 0.04, 0.035), TermLo=0.04, TermHi=0.5),
    "day": dict(ShadowTint=(0.07, 0.065, 0.08), ShadowKeep=0.5, Sat=1.12, SkyFill=(0.03, 0.04, 0.06),
                Bounce=(0.05, 0.035, 0.02), FrontFill=(0.08, 0.06, 0.05), TermLo=0.08, TermHi=0.7),
}


def interior_mode(kind="night", world_e=0.008):
    """Interiors: EEVEE doesn't occlude sky light indoors, so dim the world's lighting branch and use a
    smoother, practical-light-driven ramp."""
    from . import mat as M
    w = bpy.context.scene.world
    for n in w.node_tree.nodes:
        if n.type == "BACKGROUND" and abs(n.inputs["Strength"].default_value - 1.0) > 1e-6:
            n.inputs["Strength"].default_value = world_e
    M.set_look(**INTERIOR_LOOK[kind])


def _classic_sky(nb, P, d, sep, sky):
    """v1 painter (golden/day/dusk/pink/storm/winter): sun glow + disk, painted cloud planes, simple stars."""
    elev = sep.outputs[2]
    # sun glow + disk
    sd = Vector(P["sun_dir"]).normalized()
    sdn = nb.n("ShaderNodeCombineXYZ", inputs={"X": sd.x, "Y": sd.y, "Z": sd.z})
    dot = nb.vmath("DOT_PRODUCT", d, sdn.outputs[0])
    dp = nb.math("MAXIMUM", dot, 0.0)
    g1 = nb.math("POWER", dp, 6.0)
    g2 = nb.math("POWER", dp, 60.0)
    glow = nb.add(nb.mul(g1, 0.35 * P["glow"]), nb.mul(g2, 0.9 * P["glow"]))
    disk = nb.mul(nb.mapr(dot, 0.99955, 0.99975), P["disk"])
    gc = nb.n("ShaderNodeRGB")
    gc.outputs[0].default_value = (*P["sun_glow"], 1)
    sky = nb.mix(1.0, sky, nb.mix(nb.math("MINIMUM", nb.add(glow, disk), 30.0), (0, 0, 0), gc.outputs[0]), blend="ADD")
    sky = nb.mix(1.0, sky, nb.mix(disk, (0, 0, 0), gc.outputs[0]), blend="ADD")

    # painted clouds projected on two cloud planes (perspective toward the horizon)
    dz = nb.math("MAXIMUM", elev, 0.025)
    px = nb.math("DIVIDE", sep.outputs[0], dz)
    py = nb.math("DIVIDE", sep.outputs[1], dz)

    def plane_tex(img, scale, offx, offy):
        cv = nb.n("ShaderNodeCombineXYZ")
        nb.inp(cv, "X", nb.add(nb.mul(px, scale), offx))
        nb.inp(cv, "Y", nb.add(nb.mul(py, scale), offy))
        tx = nb.n("ShaderNodeTexImage", image=image(img), interpolation="Cubic", extension="REPEAT")
        nb.link(cv.outputs[0], tx.inputs[0])
        return nb.n("ShaderNodeSeparateColor", inputs={"Color": tx.outputs[0]})

    cm = plane_tex("cloudmass", P.get("cu_scale", 0.11), P.get("cu_off", (0.3, 0.1))[0], P.get("cu_off", (0.3, 0.1))[1])
    m1, t1, s1 = cm.outputs[0], cm.outputs[1], cm.outputs[2]
    ci = plane_tex("stipple", P.get("ci_scale", 0.05), 0.7, 0.2)
    m2 = nb.mul(nb.mapr(ci.outputs[2], 0.52, 0.66), P.get("cirrus", 0.6))
    hfade = nb.mapr(elev, 0.012, 0.09)
    m1 = nb.mul(nb.mul(m1, hfade), P["cloud_amt"])
    m2 = nb.mul(nb.mul(m2, nb.mapr(elev, 0.05, 0.25)), P["cloud_amt"])
    sunp = nb.math("POWER", dp, 3.0)
    litf = nb.add(nb.add(nb.mul(t1, 0.55), nb.mul(sunp, 0.7)), nb.mul(nb.sub(s1, 0.5), 0.5))
    litf = nb.mapr(litf, 0.15, 0.95)
    cl = nb.n("ShaderNodeRGB")
    cl.outputs[0].default_value = (*P["cloud_lit"], 1)
    cdk = nb.n("ShaderNodeRGB")
    cdk.outputs[0].default_value = (*P["cloud_dark"], 1)
    ccol = nb.mix(litf, cdk.outputs[0], cl.outputs[0])
    # silver lining: thin cloud edges near the sun glow
    silver = nb.mul(nb.mul(nb.sub(1.0, t1), nb.math("POWER", dp, 10.0)), 2.5 * P["glow"])
    ccol = nb.mix(silver, ccol, gc.outputs[0], blend="ADD")
    # cirrus: lighter wisps tinted by the horizon glow
    cicol = nb.mix(nb.add(nb.mul(sunp, 0.8), 0.25), cdk.outputs[0], cl.outputs[0])
    sky = nb.mix(m2, sky, cicol)
    sky = nb.mix(m1, sky, ccol)
    cmask = nb.math("MAXIMUM", m1, m2)

    # stars
    if P["stars"] > 0:
        vor = nb.n("ShaderNodeTexVoronoi", feature="F1", voronoi_dimensions="3D")
        vor.inputs["Scale"].default_value = 220.0
        nb.link(d, vor.inputs["Vector"])
        wn = nb.n("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
        nb.link(vor.outputs["Position"], wn.inputs["Vector"])
        sz = nb.mapr(wn.outputs["Value"], 0.7, 1.0, 0.0, 0.065, interp="LINEAR")
        star = nb.mapr(nb.sub(vor.outputs["Distance"], sz), 0.0, -0.02)
        star = nb.mul(star, nb.mapr(wn.outputs["Value"], 0.7, 0.72))
        bright = nb.mul(nb.math("POWER", wn.outputs["Value"], 8.0), 6.0 * P["stars"])
        star = nb.mul(nb.mul(star, bright), nb.mapr(elev, 0.02, 0.15))
        star = nb.mul(star, nb.sub(1.0, cmask))
        sc = nb.n("ShaderNodeRGB")
        sc.outputs[0].default_value = (0.85, 0.9, 1.0, 1)
        sky = nb.mix(1.0, sky, nb.mix(star, (0, 0, 0), sc.outputs[0]), blend="ADD")

    return sky


def build(preset):
    """Create (or rebuild) the world sky + lights for a preset. Returns (dict of light objects, preset dict)."""
    P = PRESETS[preset] if isinstance(preset, str) else preset
    CURRENT.clear()
    CURRENT.update(P)
    w = bpy.data.worlds.get("LU_Sky") or bpy.data.worlds.new("LU_Sky")
    bpy.context.scene.world = w
    w.use_nodes = True
    t = w.node_tree
    t.nodes.clear()
    nb = NB(t)
    tc = nb.n("ShaderNodeTexCoord")
    d = nb.vmath("NORMALIZE", tc.outputs["Generated"])
    sep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": d})
    elev = sep.outputs[2]
    # elevation ramp
    rmp = nb.n("ShaderNodeValToRGB")
    cr = rmp.color_ramp
    cr.interpolation = "B_SPLINE"
    # map elevation -0.2..1 -> 0..1
    e01 = nb.mapr(elev, -0.2, 1.0, 0.0, 1.0, interp="LINEAR")
    nb.link(e01, rmp.inputs[0])
    pts = P["ramp"]
    cr.elements[0].position = (pts[0][0] + 0.2) / 1.2
    cr.elements[0].color = (*pts[0][1], 1)
    cr.elements[1].position = (pts[-1][0] + 0.2) / 1.2
    cr.elements[1].color = (*pts[-1][1], 1)
    for e, c in pts[1:-1]:
        el = cr.elements.new((e + 0.2) / 1.2)
        el.color = (*c, 1)
    sky = rmp.outputs[0]
    sd = Vector(P["sun_dir"]).normalized()
    lit_col = rmp.outputs[0]
    if P.get("painter") == "night2":
        sky, lit_col = _night_sky(nb, P, d, sep)
    else:
        sky = _classic_sky(nb, P, d, sep, sky)

    # camera sees the painting; lighting sees a softer version (less glow)
    lp = nb.n("ShaderNodeLightPath")
    bg_cam = nb.n("ShaderNodeBackground", inputs={"Strength": 1.0})
    nb.inp(bg_cam, "Color", sky)
    bg_lit = nb.n("ShaderNodeBackground", inputs={"Strength": P["world_e"]})
    nb.inp(bg_lit, "Color", lit_col)
    mx = nb.n("ShaderNodeMixShader")
    nb.link(lp.outputs["Is Camera Ray"], mx.inputs[0])
    nb.link(bg_lit.outputs[0], mx.inputs[1])
    nb.link(bg_cam.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputWorld")
    nb.link(mx.outputs[0], out.inputs[0])

    # lights
    for n in ("Sun", "Fill", "Rim", "SouthFill"):
        o = bpy.data.objects.get("LU_" + n)
        if o:
            bpy.data.objects.remove(o)
    lights = {}

    def mk(n, direction, col, e, shadow, angle):
        ld = bpy.data.lights.new("LU_" + n, "SUN")
        ld.color = col
        ld.energy = e
        ld.angle = math.radians(angle)
        ld.use_shadow = shadow
        o = bpy.data.objects.new("LU_" + n, ld)
        bpy.context.scene.collection.objects.link(o)
        dv = Vector(direction).normalized()
        o.rotation_euler = (-dv).to_track_quat("-Z", "Y").to_euler()
        return o

    lights["sun"] = mk("Sun", P["sun_dir"], P["key"], P["key_e"], True, 1.5)
    if P.get("fill_e", 0) > 0:
        lights["fill"] = mk("Fill", (-sd.x, -sd.y, 0.6), P["fill"], P["fill_e"], False, 10)
    sf = P.get("south_fill")
    if sf and sf.get("e", 0) > 0:
        lights["south_fill"] = mk("SouthFill", tuple(sky_dir(sf["az"], sf["el"])), sf["col"], sf["e"], False, 12)
    from . import mat as M
    look = dict(P["look"])
    # terminator relative to the key light: ambient-only surfaces must read as shadow side
    if "term" in P:
        look["TermLo"], look["TermHi"] = P["term"]
    else:
        amb = P["world_e"] * 0.75
        look.setdefault("TermLo", 0.0)
        look["TermLo"] = amb + 0.10 * P["key_e"]
        look["TermHi"] = amb + 0.32 * P["key_e"]
    M.set_look(**look)
    return lights, P


# ====================================================================== v2 night painter
def _vec(nb, v):
    return nb.n("ShaderNodeCombineXYZ", inputs={"X": v[0], "Y": v[1], "Z": v[2]}).outputs[0]


def _rgb(nb, c):
    n = nb.n("ShaderNodeRGB")
    n.outputs[0].default_value = (*c[:3], 1.0)
    return n.outputs[0]


def _value(nb, name, v=0.0):
    n = nb.n("ShaderNodeValue")
    n.name = name
    n.label = name
    n.outputs[0].default_value = v
    return n.outputs[0]


def _vscale(nb, c, k):
    m = nb.n("ShaderNodeVectorMath", operation="SCALE")
    nb.inp(m, 0, c)
    nb.inp(m, "Scale", k)
    return m.outputs[0]


def _vadd(nb, a, b):
    m = nb.n("ShaderNodeVectorMath", operation="ADD")
    nb.inp(m, 0, a)
    nb.inp(m, 1, b)
    return m.outputs[0]


def _ramp(nb, fac, stops, interp="LINEAR"):
    r = nb.n("ShaderNodeValToRGB")
    cr = r.color_ramp
    cr.interpolation = interp
    cr.elements[0].position, cr.elements[0].color = stops[0][0], (*stops[0][1], 1)
    cr.elements[1].position, cr.elements[1].color = stops[-1][0], (*stops[-1][1], 1)
    for p, c in stops[1:-1]:
        cr.elements.new(p).color = (*c, 1)
    nb.link(fac, r.inputs[0])
    return r.outputs[0]


def _gauss(nb, x, w):
    """exp(-(x/w)^2)"""
    q = nb.math("DIVIDE", x, w)
    return nb.math("EXPONENT", nb.mul(nb.mul(q, q), -1.0))


def _time(nb):
    """Seconds, driven by the frame (simple-expression driver: no Python needed at render time)."""
    v = nb.n("ShaderNodeValue")
    v.name = "LU_Time"
    v.label = "LU_Time"
    fc = v.outputs[0].driver_add("default_value")
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = "frame/24"
    return v.outputs[0]


def _const_dirs():
    from . import props
    return props.const_dir(0.0, -2.5), props.const_dir(*props.EYE_R)


def _night_sky(nb, P, d, sep):
    """The painted night sky. Returns (camera colour socket, lighting colour socket)."""
    N = P["night"]
    x, y, el = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    T = _time(nb)

    # ---------------------------------------------------------------- base gradient
    pts = P["ramp"]
    e01 = nb.mapr(el, -0.2, 1.0, 0.0, 1.0, interp="LINEAR")
    base = _ramp(nb, e01, [((e + 0.2) / 1.2, c) for e, c in pts], interp="B_SPLINE")
    # brushed: long horizontal strokes painted along the sky (azimuth/elevation mapping, seamless in azimuth)
    az = nb.math("ARCTAN2", y, x)
    u = nb.mul(az, 6.0 / (2 * math.pi))
    mp = nb.n("ShaderNodeCombineXYZ")
    nb.inp(mp, "X", nb.mul(u, 0.6))
    nb.inp(mp, "Y", nb.mul(el, 2.0))
    st = nb.n("ShaderNodeTexImage", image=image("strokes_soft"), interpolation="Cubic", extension="REPEAT")
    nb.link(mp.outputs[0], st.inputs[0])
    sp = nb.n("ShaderNodeSeparateColor", inputs={"Color": st.outputs["Color"]})
    s_val, s_jit = sp.outputs[0], sp.outputs[1]
    mp2 = nb.n("ShaderNodeCombineXYZ")
    nb.inp(mp2, "X", nb.mul(u, 2.3))
    nb.inp(mp2, "Y", nb.add(nb.mul(el, 11.0), 0.37))
    st2 = nb.n("ShaderNodeTexImage", image=image("strokes_soft"), interpolation="Cubic", extension="REPEAT")
    nb.link(mp2.outputs[0], st2.inputs[0])
    s_val2 = nb.n("ShaderNodeSeparateColor", inputs={"Color": st2.outputs["Color"]}).outputs[0]
    amp = nb.mul(nb.mapr(el, 0.45, 0.0, 0.035, 0.18, interp="LINEAR"), N["brush"])
    mod = nb.add(1.0, nb.mul(nb.add(nb.mul(nb.sub(s_val, 0.5), 0.45), nb.mul(nb.sub(s_val2, 0.5), 0.55)), amp))
    sky = _vscale(nb, base, mod)
    # per-stroke hue drift: a few strokes lean violet, a few teal (painted, not a CG gradient)
    hue = nb.n("ShaderNodeHueSaturation")
    nb.inp(hue, "Color", sky)
    nb.inp(hue, "Hue", nb.add(0.5, nb.mul(nb.sub(s_jit, 0.5), nb.mul(0.022, N["brush"]))))
    sky = hue.outputs[0]

    # ---------------------------------------------------------------- warm twilight band + afterglow
    baz = math.radians(N["band_az"])
    bdir = _vec(nb, (math.cos(baz), math.sin(baz), 0.0))
    hx = nb.n("ShaderNodeCombineXYZ")
    nb.inp(hx, "X", x)
    nb.inp(hx, "Y", y)
    hdir = nb.vmath("NORMALIZE", hx.outputs[0])
    azw = nb.math("POWER", nb.mul(nb.add(nb.vmath("DOT_PRODUCT", hdir, bdir), 1.0), 0.5), 2.2)
    azw = nb.add(0.30, nb.mul(azw, 0.70))
    band_shape = _gauss(nb, nb.sub(el, N["band_el"]), N["band_w"])
    band_shape = nb.mul(band_shape, nb.mapr(el, -0.012, 0.004))
    # brush-broken band (it is painted in strokes along the horizon)
    band_shape = nb.mul(band_shape, nb.add(0.72, nb.mul(nb.sub(s_val2, 0.5), 1.1)))
    band = _vscale(nb, _rgb(nb, N["band"]), nb.mul(nb.mul(band_shape, azw), N["band_amt"]))
    after = _vscale(nb, _rgb(nb, N["afterglow"]),
                    nb.mul(nb.mul(_gauss(nb, nb.sub(el, 0.07), 0.06), azw), N["band_amt"]))
    sky = _vadd(nb, sky, _vadd(nb, band, after))

    # ---------------------------------------------------------------- moon: glow + painted disk
    md = sky_dir(*N["moon"])
    mdot = nb.vmath("DOT_PRODUCT", d, _vec(nb, md))
    mp_ = nb.math("MAXIMUM", mdot, 0.0)
    mglow = nb.add(nb.add(nb.mul(nb.math("POWER", mp_, 5.0), 0.045), nb.mul(nb.math("POWER", mp_, 60.0), 0.09)),
                   nb.mul(nb.math("POWER", mp_, 1500.0), 0.55))
    sky = _vadd(nb, sky, _vscale(nb, _rgb(nb, (0.40, 0.53, 0.70)), nb.mul(mglow, N["moon_glow"])))
    # painted disc: soft brushed edge, cool maria, a faint corona ring
    mang = nb.math("ARCCOSINE", nb.math("MINIMUM", mdot, 1.0))
    mn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 160.0, "Detail": 3.0, "Roughness": 0.55, "Distortion": 0.4})
    nb.link(d, mn.inputs["Vector"])
    edge = nb.add(math.radians(0.88), nb.mul(nb.sub(mn.outputs["Fac"], 0.5), math.radians(0.12)))
    disk = nb.mapr(nb.sub(mang, edge), math.radians(0.07), math.radians(-0.07))
    maria = nb.mapr(mn.outputs["Fac"], 0.45, 0.64, 1.0, 0.70)
    limb = nb.mapr(mang, math.radians(0.9), math.radians(0.2), 0.82, 1.0)
    sky = _vadd(nb, sky, _vscale(nb, _rgb(nb, (0.90, 0.94, 1.0)), nb.mul(nb.mul(nb.mul(disk, maria), limb),
                                                                        2.2 * N["moon_disk"])))
    corona = nb.mul(_gauss(nb, nb.sub(mang, math.radians(2.6)), math.radians(0.9)), 0.035 * N["moon_glow"])
    sky = _vadd(nb, sky, _vscale(nb, _rgb(nb, (0.62, 0.66, 0.80)), corona))

    # ---------------------------------------------------------------- Milky Way (soft, brushy)
    A, B = sky_dir(*N["milky_a"]), sky_dir(*N["milky_b"])
    pole = A.cross(B).normalized()
    e1 = A.normalized()
    e2 = pole.cross(e1).normalized()
    b = nb.vmath("DOT_PRODUCT", d, _vec(nb, pole))
    lon = nb.math("ARCTAN2", nb.vmath("DOT_PRODUCT", d, _vec(nb, e2)), nb.vmath("DOT_PRODUCT", d, _vec(nb, e1)))
    nz = nb.n("ShaderNodeTexNoise", inputs={"Scale": 3.2, "Detail": 7.0, "Roughness": 0.62, "Distortion": 0.35})
    nb.link(d, nz.inputs["Vector"])
    nzf = nz.outputs["Fac"]
    nzc = nb.n("ShaderNodeSeparateColor", inputs={"Color": nz.outputs["Color"]}).outputs[1]
    mw_uv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(mw_uv, "X", nb.mul(lon, 4.0 / (2 * math.pi)))
    nb.inp(mw_uv, "Y", nb.add(nb.mul(b, 2.2), 0.5))
    mwt = nb.n("ShaderNodeTexImage", image=image("strokes_soft"), interpolation="Cubic", extension="REPEAT")
    nb.link(mw_uv.outputs[0], mwt.inputs[0])
    mws = nb.n("ShaderNodeSeparateColor", inputs={"Color": mwt.outputs["Color"]}).outputs[0]
    bw = nb.add(b, nb.mul(nb.sub(nzf, 0.5), 0.10))          # wavy edges
    core = _gauss(nb, bw, 0.115)
    wide = _gauss(nb, bw, 0.30)
    lane = _gauss(nb, nb.sub(bw, nb.add(0.022, nb.mul(nb.sub(nzc, 0.5), 0.07))), 0.028)
    dens = nb.math("MAXIMUM", nb.add(nb.add(0.45, nb.mul(nb.sub(nzf, 0.5), 2.0)), nb.mul(nb.sub(mws, 0.5), 0.6)), 0.0)
    dens = nb.add(nb.mul(core, dens), nb.mul(wide, 0.22))
    dens = nb.mul(dens, nb.sub(1.0, nb.mul(lane, 0.7)))
    dens = nb.mul(nb.mul(dens, nb.mapr(el, -0.02, 0.28, 0.12, 1.0)), N["milky"])
    mwcol = nb.mix(nb.mapr(nzc, 0.45, 0.62), _rgb(nb, (0.050, 0.058, 0.088)), _rgb(nb, (0.078, 0.064, 0.066)))
    sky = _vadd(nb, sky, _vscale(nb, mwcol, dens))
    mw_mask = nb.add(nb.mul(core, 0.9), nb.mul(wide, 0.25))

    # ---------------------------------------------------------------- constellation zone (keep it clean)
    cdir, edir = _const_dirs()
    cdot = nb.vmath("DOT_PRODUCT", d, _vec(nb, cdir))
    cmask = nb.mapr(cdot, math.cos(math.radians(21)), math.cos(math.radians(11)))

    # ---------------------------------------------------------------- moonlit wisps: painted stratus, brushed edges
    dz = nb.math("MAXIMUM", el, 0.028)
    px = nb.math("DIVIDE", x, dz)
    py = nb.math("DIVIDE", y, dz)
    drift = nb.mul(T, 0.0035)

    def field(sx, sy, ox, oy, scale, detail=4.0, dist=0.3):
        cv = nb.n("ShaderNodeCombineXYZ")
        nb.inp(cv, "X", nb.add(nb.add(nb.mul(px, sx), ox), drift))
        nb.inp(cv, "Y", nb.add(nb.mul(py, sy), oy))
        n = nb.n("ShaderNodeTexNoise", inputs={"Scale": scale, "Detail": detail, "Roughness": 0.55, "Distortion": dist})
        nb.link(cv.outputs[0], n.inputs["Vector"])
        return n.outputs["Fac"]

    def brush(img, sx, sy, ox, oy):
        cv = nb.n("ShaderNodeCombineXYZ")
        nb.inp(cv, "X", nb.add(nb.add(nb.mul(px, sx), ox), nb.mul(drift, sx / 0.035)))
        nb.inp(cv, "Y", nb.add(nb.mul(py, sy), oy))
        tx = nb.n("ShaderNodeTexImage", image=image(img), interpolation="Cubic", extension="REPEAT")
        nb.link(cv.outputs[0], tx.inputs[0])
        return nb.n("ShaderNodeSeparateColor", inputs={"Color": tx.outputs[0]}).outputs[0]

    shp = field(0.06, 0.13, 0.31, 0.17, 1.0)
    bru = brush("strokes_soft", 0.16, 0.42, 0.12, 0.37)
    bru2 = brush("strokes_soft", 0.06, 0.18, 0.61, 0.07)
    sh1 = nb.add(nb.add(shp, nb.mul(nb.sub(bru, 0.5), 0.07)), nb.mul(nb.sub(bru2, 0.5), 0.05))
    thr = 0.50
    a1 = nb.mapr(sh1, thr, thr + 0.08)
    th1 = nb.mapr(sh1, thr, thr + 0.20)
    cover = nb.mapr(field(0.012, 0.03, 4.1, 2.3, 1.0, detail=1.0, dist=0.0), 0.44, 0.58)
    cover = nb.math("MAXIMUM", cover, nb.mul(nb.mapr(el, 0.20, 0.06), 0.85))      # a low band of stratus all round
    a1 = nb.mul(nb.mul(a1, cover), nb.mul(nb.mapr(el, 0.006, 0.035), nb.mapr(el, 0.55, 0.25)))
    a1 = nb.mul(nb.mul(a1, nb.sub(1.0, nb.mul(cmask, 0.8))), nb.mul(nb.add(0.55, nb.mul(th1, 0.35)), N["wisps"]))
    # high, thin streaks (cirrus): drier brush, mostly transparent
    shp2 = field(0.04, 0.16, 0.7, 0.2, 1.0, detail=3.0, dist=0.6)
    bru3 = brush("strokes_soft", 0.08, 0.3, 0.45, 0.83)
    sh2 = nb.add(shp2, nb.mul(nb.sub(bru3, 0.5), 0.1))
    a2 = nb.mul(nb.mapr(sh2, 0.57, 0.68), nb.mul(nb.mapr(el, 0.08, 0.22), nb.mapr(el, 0.8, 0.5)))
    a2 = nb.mul(nb.mul(nb.mul(a2, cover), nb.sub(1.0, nb.mul(cmask, 0.9))), 0.24 * N["wisps"])
    moonp = nb.math("POWER", mp_, 2.5)
    # thin edges catch the moon (silver), thick bellies stay cool and dark; strokes vary the paint
    litf = nb.add(nb.add(nb.mul(nb.sub(1.0, th1), 0.6), nb.mul(moonp, 0.5)), nb.mul(nb.sub(bru, 0.5), 0.7))
    litf = nb.mapr(litf, 0.2, 0.9)
    wl, wd = _rgb(nb, N["wisp_lit"]), _rgb(nb, N["wisp_dark"])
    wcol = nb.mix(litf, wd, wl)
    silver = nb.mul(nb.mul(nb.sub(1.0, th1), nb.math("POWER", mp_, 14.0)), 1.6)
    wcol = _vadd(nb, wcol, _vscale(nb, _rgb(nb, (0.55, 0.70, 0.95)), silver))
    under = nb.mul(nb.mul(_gauss(nb, el, 0.07), azw), nb.mul(th1, 0.9 * N["band_amt"]))
    wcol = _vadd(nb, wcol, _vscale(nb, _rgb(nb, N["band"]), under))
    ccol = nb.mix(nb.add(nb.mul(moonp, 0.6), 0.35), wd, wl)
    sky = nb.mix(a2, sky, ccol)
    sky = nb.mix(a1, sky, wcol)
    veil = nb.math("MINIMUM", nb.add(a1, nb.mul(a2, 0.8)), 1.0)

    # ---------------------------------------------------------------- stars: dust / field / bright (size, colour)
    scol = [(0.0, (0.62, 0.74, 1.0)), (0.35, (0.82, 0.88, 1.0)), (0.62, (1.0, 0.98, 0.94)),
            (0.84, (1.0, 0.88, 0.68)), (1.0, (1.0, 0.70, 0.48))]
    star_fade = nb.mul(nb.mul(nb.mapr(el, 0.004, 0.06), nb.sub(1.0, nb.mul(veil, 0.92))), N["stars"])

    def layer(scale, pres, rad, a_lo, a_hi, pw, off, twinkle=0.0, halo=0.0):
        dv = _vadd(nb, d, _vec(nb, off))
        vor = nb.n("ShaderNodeTexVoronoi", feature="F1", voronoi_dimensions="3D")
        vor.inputs["Scale"].default_value = scale
        nb.link(dv, vor.inputs["Vector"])
        wn = nb.n("ShaderNodeTexWhiteNoise", noise_dimensions="3D")
        nb.link(vor.outputs["Position"], wn.inputs["Vector"])
        rs = nb.n("ShaderNodeSeparateColor", inputs={"Color": wn.outputs["Color"]})
        r0, r1, r2 = wn.outputs["Value"], rs.outputs[0], rs.outputs[1]
        present = nb.math("GREATER_THAN", r0, nb.sub(1.0, pres))
        D = vor.outputs["Distance"]
        prof = _gauss(nb, D, rad)
        if halo > 0:
            prof = nb.add(prof, nb.mul(nb.math("EXPONENT", nb.mul(nb.math("DIVIDE", D, rad * 6.0), -1.0)), halo))
        a = nb.add(a_lo, nb.mul(nb.math("POWER", r1, pw), a_hi - a_lo))
        if twinkle > 0:
            ph = nb.add(nb.mul(T, nb.add(1.7, nb.mul(r2, 4.0))), nb.mul(r1, 37.0))
            a = nb.mul(a, nb.add(1.0 - twinkle, nb.mul(nb.mul(nb.add(nb.math("SINE", ph), 1.0), 0.5), twinkle)))
        inten = nb.mul(nb.mul(prof, present), a)
        col = _ramp(nb, r2, scol)
        return _vscale(nb, col, inten)

    p_dust = nb.mul(nb.add(0.085, nb.mul(mw_mask, 0.6)), nb.sub(1.0, nb.mul(cmask, 0.7)))
    p_field = nb.mul(nb.add(0.30, nb.mul(mw_mask, 0.25)), nb.sub(1.0, nb.mul(cmask, 0.55)))
    p_bright = nb.mul(0.05, nb.sub(1.0, nb.mul(cmask, 0.6)))
    pn2 = nb.n("ShaderNodeTexNoise", inputs={"Scale": 2.6, "Detail": 3.0, "Roughness": 0.55})
    nb.link(d, pn2.inputs["Vector"])
    patchy = nb.mapr(pn2.outputs["Fac"], 0.35, 0.68, 0.35, 1.25)
    p_dust = nb.mul(p_dust, patchy)
    s1 = layer(430.0, p_dust, 0.15, 0.2, 1.3, 2.5, (11.3, 5.1, 7.7))
    s2 = layer(165.0, p_field, 0.08, 0.7, 4.0, 3.0, (3.7, 19.1, 2.9), twinkle=0.15)
    s3 = layer(46.0, p_bright, 0.022, 2.5, 9.0, 2.0, (27.1, 1.3, 13.9), twinkle=0.3)
    stars = _vadd(nb, _vadd(nb, s1, s2), s3)
    sky = _vadd(nb, sky, _vscale(nb, stars, star_fade))

    # ---------------------------------------------------------------- emotion: violet / pink glow round the constellation
    emo = nb.add(_value(nb, "LU_Emotion", N.get("emotion", 0.0)), _value(nb, "LU_Ignite", 0.0))
    gd = nb.math("MAXIMUM", cdot, 0.0)
    g_soft = nb.math("POWER", gd, 46.0)
    g_wide = nb.math("POWER", gd, 7.0)
    glow = _vadd(nb, _vscale(nb, _rgb(nb, N["emo_violet"]), nb.mul(nb.math("POWER", gd, 14.0), 0.42)),
                 _vscale(nb, _rgb(nb, N["emo_pink"]), nb.mul(g_soft, 0.62)))
    glow = _vadd(nb, glow, _vscale(nb, _rgb(nb, (0.025, 0.010, 0.035)), nb.mapr(el, 0.0, 0.6)))
    sky = _vadd(nb, sky, _vscale(nb, glow, emo))
    # ignition: a hot gold bloom in the sky around the eye
    eg = nb.math("MAXIMUM", nb.vmath("DOT_PRODUCT", d, _vec(nb, edir)), 0.0)
    gold = nb.add(nb.mul(nb.math("POWER", eg, 2500.0), 2.5), nb.mul(nb.math("POWER", eg, 160.0), 0.45))
    ig = nb.nodes["LU_Ignite"].outputs[0]
    sky = _vadd(nb, sky, _vscale(nb, _rgb(nb, (1.0, 0.62, 0.24)), nb.mul(gold, ig)))

    # ---------------------------------------------------------------- lighting (what surfaces see)
    lr = P["light_ramp"]
    lit = _ramp(nb, nb.mapr(el, -0.4, 1.0, 0.0, 1.0, interp="LINEAR"),
                [(0.0, lr[2]), (0.28, lr[1]), (1.0, lr[0])])
    lit = _vadd(nb, lit, _vscale(nb, _rgb(nb, (0.10, 0.04, 0.12)), nb.mul(emo, 0.25)))
    lit = _vadd(nb, lit, _vscale(nb, _rgb(nb, (0.20, 0.12, 0.05)), ig))
    return sky, lit


# ====================================================================== emotional-beat controls
def _world_value(name):
    w = bpy.context.scene.world
    if not w or not w.node_tree:
        return None
    return w.node_tree.nodes.get(name)


def emotion(amount, frame=None):
    """Violet/pink glow around the constellation (0 = none .. 1 = full). With frame, keys it (animate the beat).
    Night painter only (no-op otherwise). Peaks: SH08 ~0.35, SH16-SH19 ~0.5-0.7."""
    n = _world_value("LU_Emotion")
    if n is None:
        return
    n.outputs[0].default_value = amount
    if frame is not None:
        n.outputs[0].keyframe_insert("default_value", frame=frame)


def key_ignite(value, frame):
    """Ignition sky flash (gold around the eye + violet/pink glow). props.ignite() keys this for you."""
    n = _world_value("LU_Ignite")
    if n is None:
        return
    n.outputs[0].default_value = value
    n.outputs[0].keyframe_insert("default_value", frame=frame)


def moon_dir():
    return sky_dir(*CURRENT.get("night", {}).get("moon", NIGHT_MOON))
