"""Painted sky (world shader) + sun/fill/rim light rigs per time of day (the color script).

The sky is painted in the world shader: elevation gradient, sun glow + disk, brushed cloud bands and
stippled cirrus sampled on the sky sphere, stars at night. Lighting rigs are tuned per preset.
"""
import math
import bpy
from mathutils import Vector, Euler

from .mat import NB, image

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
        ramp=[(-0.2, (0.02, 0.04, 0.06)), (0.0, (0.07, 0.13, 0.17)), (0.08, (0.05, 0.10, 0.15)),
              (0.3, (0.025, 0.05, 0.10)), (0.7, (0.01, 0.02, 0.05))],
        sun_dir=(0.3, 0.8, 0.5), sun_col=(0.55, 0.7, 1.0), sun_glow=(0.4, 0.6, 0.8), glow=0.25, disk=0.0,
        cloud_lit=(0.25, 0.38, 0.48), cloud_dark=(0.04, 0.07, 0.11), cloud_amt=0.22, stars=1.0, cirrus=0.25,
        key=(0.55, 0.72, 1.0), key_e=0.7, fill=(0.2, 0.35, 0.45), fill_e=0.0, rim=(0.5, 0.7, 1.0), rim_e=0.0,
        world_e=0.35, haze=(0.06, 0.12, 0.16),
        look=dict(ShadowTint=(0.035, 0.07, 0.10), ShadowKeep=0.45, TermLo=0.03, TermHi=0.16, Sat=1.08),
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


def build(preset):
    """Create (or rebuild) the world sky + lights for a preset. Returns dict of light objects."""
    P = PRESETS[preset] if isinstance(preset, str) else preset
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

    # camera sees the painting; lighting sees a softer version (less glow)
    lp = nb.n("ShaderNodeLightPath")
    bg_cam = nb.n("ShaderNodeBackground", inputs={"Strength": 1.0})
    nb.inp(bg_cam, "Color", sky)
    bg_lit = nb.n("ShaderNodeBackground", inputs={"Strength": P["world_e"]})
    nb.inp(bg_lit, "Color", rmp.outputs[0])
    mx = nb.n("ShaderNodeMixShader")
    nb.link(lp.outputs["Is Camera Ray"], mx.inputs[0])
    nb.link(bg_lit.outputs[0], mx.inputs[1])
    nb.link(bg_cam.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputWorld")
    nb.link(mx.outputs[0], out.inputs[0])

    # lights
    for n in ("Sun", "Fill", "Rim"):
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
    from . import mat as M
    look = dict(P["look"])
    # terminator relative to the key light: ambient-only surfaces must read as shadow side
    amb = P["world_e"] * 0.75
    look.setdefault("TermLo", 0.0)
    look["TermLo"] = amb + 0.10 * P["key_e"]
    look["TermHi"] = amb + 0.32 * P["key_e"]
    M.set_look(**look)
    return lights, P
