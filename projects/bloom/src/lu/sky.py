"""BLOOM's painted sky (world shader) + light rig, per phase of the colour script, with keyable controls.

One painter covers the whole film; phases are presets of its palette and controls:
  "ash"     dirty cream overcast with a sickly yellow cast; a hole near the sun lets a soft gold patch of sun fall on
            the summit (Hole, keyable; the patch is the spot light LU_SunPatch).
  "threat"  the ash sky with a bruised violet/indigo storm wall rolling in from layout.STORM_FROM (Storm, keyable
            advance -0.3..1), lightning flickering inside it (Flash), the gold patch still on the peak.
  "storm"   the storm overhead: indigo / slate / cold teal, rain veils, internal flashes.
  "low"     the hail has stopped: near-monochrome cold blue-grey (B14-B15).
  "beam"    the storm tears open around the sun (Tear, keyable) and one golden beam strikes PEAK_SOIL (the spot light
            narrows to the beam; fx.sunbeam draws the shaft).
  "bloom"   the clouds part (Part) into cyan, peach, rose and gold, crepuscular rays (Rays).
  "coda"    a warm golden afternoon: blue sky, soft clouds.

API
  build(phase, **ctl)            builds the world + lights for a phase; returns (lights dict, preset dict).
  key(frame, **ctl)              set/key controls: Overcast, Hole, Storm, Flash, FlashAz, FlashEl, Tear, Part, Rays,
                                 SunDisk (values below), e.g. key(f0, Storm=0.3); key(f1, Storm=0.7).
  key_phase(frame, phase, ctl=True, lights=True, look=True)   key the whole palette (+ controls, lights, LU_Look) to a
                                 phase at frame: two calls make a transition (B16 storm->beam, B18 beam->bloom).
  flash(frame, amount=1, az=None, el=None, decay=0.25)   a lightning flash in the sky (also fx.lightning).
  sun_vec()                      unit vector toward the sun (layout.SUN_AZ_EL).
  pal_node(nb)                   a node reading the palette (far ridges, clouds and haze use it, so they follow keys).
CURRENT holds the active preset (CURRENT["key"] = sun colour, CURRENT["haze"] = post haze colour)."""
import math
import bpy
from mathutils import Vector

from . import layout
from .mat import NB, image

CURRENT = {}

PAL = "LU_SkyPal"
CTL = "LU_SkyCtl"
PAL_KEYS = ("Zenith", "Mid", "Horizon", "Below", "SunGlow", "HoleSky", "CloudLit", "CloudMid", "CloudDark",
            "StormLit", "StormDark", "StormRim", "Rain", "Ray", "FlashC", "Haze", "HazeLow",
            "Ridge0", "Ridge1", "Ridge2", "Ridge3", "RidgeLit", "Light", "LightLow")
CTL_DEFAULTS = dict(Overcast=0.9, Hole=0.0, Storm=-0.3, Flash=0.0, FlashAz=165.0, FlashEl=10.0, Tear=0.0, Part=0.0,
                    Rays=0.0, SunDisk=0.0, Wall=1.0)


def sky_dir(az_deg, el_deg):
    a, e = math.radians(az_deg), math.radians(el_deg)
    return Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e)))


def sun_vec():
    """Toward the sun: layout.SUN_AZ_EL (behind the peak), except phases that override it (the coda)."""
    ae = CURRENT.get("sun_az_el") or layout.SUN_AZ_EL
    return sky_dir(*ae)


def is_night():
    return False


def storm_vec():
    v = Vector((layout.STORM_FROM[0], layout.STORM_FROM[1], 0.0))
    return v.normalized()


# ====================================================================== phases (the colour script)
ASH_PAL = dict(
    Zenith=(0.25, 0.24, 0.225), Mid=(0.39, 0.365, 0.32), Horizon=(0.55, 0.49, 0.37), Below=(0.30, 0.28, 0.24),
    SunGlow=(1.0, 0.74, 0.36), HoleSky=(1.0, 0.82, 0.50),
    CloudLit=(0.52, 0.475, 0.38), CloudMid=(0.36, 0.335, 0.30), CloudDark=(0.19, 0.18, 0.17),
    StormLit=(0.52, 0.34, 0.47), StormDark=(0.04, 0.03, 0.085), StormRim=(0.85, 0.62, 0.68), Rain=(0.24, 0.22, 0.31),
    Ray=(1.0, 0.82, 0.50), FlashC=(0.86, 0.82, 1.0),
    Haze=(0.46, 0.43, 0.37), HazeLow=(0.52, 0.48, 0.40),
    Ridge0=(0.27, 0.26, 0.245), Ridge1=(0.34, 0.325, 0.30), Ridge2=(0.41, 0.385, 0.345), Ridge3=(0.47, 0.44, 0.39),
    RidgeLit=(0.55, 0.48, 0.36), Light=(0.56, 0.53, 0.47), LightLow=(0.22, 0.20, 0.18),
)
STORM_PAL = dict(
    Zenith=(0.06, 0.065, 0.11), Mid=(0.13, 0.15, 0.20), Horizon=(0.24, 0.28, 0.32), Below=(0.09, 0.09, 0.11),
    SunGlow=(0.38, 0.40, 0.50), HoleSky=(1.0, 0.85, 0.52),
    CloudLit=(0.30, 0.34, 0.40), CloudMid=(0.15, 0.17, 0.23), CloudDark=(0.06, 0.065, 0.10),
    StormLit=(0.24, 0.26, 0.36), StormDark=(0.035, 0.04, 0.07), StormRim=(0.55, 0.55, 0.75), Rain=(0.22, 0.25, 0.30),
    Ray=(0.8, 0.82, 0.92), FlashC=(0.86, 0.84, 1.0),
    Haze=(0.21, 0.235, 0.29), HazeLow=(0.25, 0.275, 0.33),
    Ridge0=(0.10, 0.105, 0.145), Ridge1=(0.135, 0.145, 0.19), Ridge2=(0.17, 0.18, 0.225), Ridge3=(0.20, 0.215, 0.26),
    RidgeLit=(0.18, 0.19, 0.25), Light=(0.26, 0.29, 0.37), LightLow=(0.07, 0.075, 0.095),
)
LOW_PAL = dict(STORM_PAL, Zenith=(0.12, 0.13, 0.16), Mid=(0.21, 0.225, 0.26), Horizon=(0.33, 0.35, 0.38),
               CloudLit=(0.38, 0.40, 0.44), CloudMid=(0.24, 0.255, 0.29), CloudDark=(0.12, 0.13, 0.155),
               StormLit=(0.30, 0.30, 0.38), StormDark=(0.08, 0.085, 0.11), Haze=(0.26, 0.28, 0.31),
               HazeLow=(0.30, 0.32, 0.35), Light=(0.30, 0.32, 0.37), LightLow=(0.08, 0.085, 0.10))
BEAM_PAL = dict(STORM_PAL, SunGlow=(1.0, 0.74, 0.34), HoleSky=(1.0, 0.80, 0.46), Ray=(1.0, 0.78, 0.42),
                StormRim=(1.0, 0.78, 0.45), CloudLit=(0.55, 0.45, 0.42))
BLOOM_PAL = dict(
    Zenith=(0.16, 0.42, 0.80), Mid=(0.52, 0.62, 0.86), Horizon=(1.0, 0.66, 0.46), Below=(0.62, 0.45, 0.40),
    SunGlow=(1.0, 0.70, 0.36), HoleSky=(1.0, 0.86, 0.62),
    CloudLit=(1.0, 0.74, 0.62), CloudMid=(0.88, 0.52, 0.60), CloudDark=(0.46, 0.38, 0.64),
    StormLit=(0.96, 0.58, 0.62), StormDark=(0.40, 0.31, 0.55), StormRim=(1.0, 0.82, 0.60), Rain=(0.62, 0.56, 0.72),
    Ray=(1.0, 0.82, 0.52), FlashC=(1.0, 0.9, 0.8),
    Haze=(0.86, 0.70, 0.68), HazeLow=(0.96, 0.76, 0.66),
    Ridge0=(0.30, 0.29, 0.47), Ridge1=(0.46, 0.41, 0.60), Ridge2=(0.63, 0.54, 0.69), Ridge3=(0.80, 0.66, 0.73),
    RidgeLit=(0.95, 0.62, 0.48), Light=(0.55, 0.62, 0.86), LightLow=(0.22, 0.17, 0.15),
)
CODA_PAL = dict(
    Zenith=(0.10, 0.27, 0.70), Mid=(0.33, 0.53, 0.86), Horizon=(0.96, 0.82, 0.62), Below=(0.52, 0.46, 0.40),
    SunGlow=(1.0, 0.76, 0.42), HoleSky=(1.0, 0.9, 0.7),
    CloudLit=(1.0, 0.94, 0.82), CloudMid=(0.80, 0.76, 0.82), CloudDark=(0.52, 0.56, 0.74),
    StormLit=(0.9, 0.8, 0.8), StormDark=(0.5, 0.5, 0.65), StormRim=(1.0, 0.9, 0.75), Rain=(0.6, 0.6, 0.7),
    Ray=(1.0, 0.85, 0.55), FlashC=(1.0, 1.0, 1.0),
    Haze=(0.72, 0.75, 0.82), HazeLow=(0.88, 0.82, 0.72),
    Ridge0=(0.21, 0.30, 0.33), Ridge1=(0.35, 0.44, 0.51), Ridge2=(0.50, 0.58, 0.67), Ridge3=(0.63, 0.69, 0.78),
    RidgeLit=(0.86, 0.72, 0.50), Light=(0.46, 0.56, 0.82), LightLow=(0.19, 0.17, 0.13),
)

# lights: sun = (colour, energy W/m2, angle deg); patch = spot on the summit (colour, irradiance, radius m) or None
PHASES = {
    "ash": dict(pal=ASH_PAL, ctl=dict(Overcast=0.92, Hole=0.3, Storm=-0.3, Rays=0.3),
                sun=((1.0, 0.86, 0.64), 1.45, 14.0), patch=((1.0, 0.72, 0.36), 7.0, 22.0), world_e=1.0,
                look=dict(ShadowTint=(0.15, 0.145, 0.155), ShadowKeep=0.5, Sat=0.95, SkyFill=(0.05, 0.05, 0.05),
                          Bounce=(0.035, 0.03, 0.025), FrontFill=(0.08, 0.075, 0.07), Breakup=0.6, LitTex=0.6),
                haze=(0.46, 0.43, 0.37)),
    "threat": dict(pal=dict(ASH_PAL, Light=(0.47, 0.45, 0.43), LightLow=(0.17, 0.16, 0.16), Haze=(0.40, 0.385, 0.36),
                            HazeLow=(0.45, 0.42, 0.38), Ridge0=(0.22, 0.21, 0.22), RidgeLit=(0.5, 0.44, 0.35)),
                   ctl=dict(Overcast=0.95, Hole=0.3, Storm=0.35, Rays=0.3),
                   sun=((0.95, 0.85, 0.7), 1.15, 16.0), patch=((1.0, 0.72, 0.36), 5.5, 22.0), world_e=1.0,
                   look=dict(ShadowTint=(0.12, 0.115, 0.14), ShadowKeep=0.5, Sat=0.95, SkyFill=(0.045, 0.045, 0.055),
                             Bounce=(0.03, 0.026, 0.024), FrontFill=(0.07, 0.065, 0.07), Breakup=0.6, LitTex=0.6),
                   haze=(0.40, 0.385, 0.36)),
    "storm": dict(pal=STORM_PAL, ctl=dict(Overcast=1.0, Hole=0.0, Storm=1.0, Rays=0.0),
                  sun=((0.66, 0.72, 0.9), 1.1, 25.0), patch=None, world_e=1.0, sun_az_el=(-25.0, 42.0),
                  look=dict(ShadowTint=(0.05, 0.055, 0.08), ShadowKeep=0.5, Sat=0.85, SkyFill=(0.03, 0.035, 0.05),
                            Bounce=(0.012, 0.012, 0.015), FrontFill=(0.05, 0.05, 0.06), Breakup=0.6, LitTex=0.55),
                  haze=(0.21, 0.235, 0.29)),
    "low": dict(pal=LOW_PAL, ctl=dict(Overcast=1.0, Hole=0.0, Storm=1.0, Rays=0.0),
                sun=((0.72, 0.76, 0.88), 1.0, 25.0), patch=None, world_e=1.0, sun_az_el=(-25.0, 42.0),
                look=dict(ShadowTint=(0.07, 0.075, 0.095), ShadowKeep=0.5, Sat=0.6, SkyFill=(0.035, 0.04, 0.05),
                          Bounce=(0.015, 0.015, 0.017), FrontFill=(0.06, 0.06, 0.065), Breakup=0.6, LitTex=0.55),
                haze=(0.26, 0.28, 0.31)),
    "beam": dict(pal=BEAM_PAL, ctl=dict(Overcast=1.0, Hole=0.0, Storm=1.0, Tear=0.32, Rays=0.5),
                 sun=((0.62, 0.68, 0.86), 0.8, 30.0), patch=((1.0, 0.76, 0.42), 10.0, 3.6), world_e=1.0,
                 sun_az_el=(72.0, 50.0),
                 look=dict(ShadowTint=(0.06, 0.06, 0.09), ShadowKeep=0.5, Sat=0.95, SkyFill=(0.03, 0.035, 0.05),
                           Bounce=(0.02, 0.016, 0.012), FrontFill=(0.05, 0.05, 0.06), Breakup=0.6, LitTex=0.6),
                 haze=(0.21, 0.23, 0.28)),
    "bloom": dict(pal=BLOOM_PAL, ctl=dict(Overcast=0.8, Hole=0.0, Storm=1.0, Tear=0.5, Part=1.0, Rays=0.85),
                  sun=((1.0, 0.80, 0.55), 4.2, 3.0), patch=None, world_e=1.0, sun_az_el=(20.0, 30.0),
                  look=dict(ShadowTint=(0.10, 0.10, 0.22), ShadowKeep=0.4, Sat=1.08, SkyFill=(0.05, 0.07, 0.13),
                            Bounce=(0.05, 0.04, 0.02), FrontFill=(0.12, 0.09, 0.11), Breakup=0.55, LitTex=0.6),
                  haze=(0.86, 0.70, 0.68)),
    "coda": dict(pal=CODA_PAL, ctl=dict(Overcast=0.42, Hole=0.0, Storm=-1.0, Part=0.25, Rays=0.0),
                 sun=((1.0, 0.78, 0.50), 4.4, 2.5), patch=None, world_e=1.0, sun_az_el=(150.0, 28.0),
                 look=dict(ShadowTint=(0.08, 0.10, 0.20), ShadowKeep=0.38, Sat=1.06, SkyFill=(0.05, 0.08, 0.15),
                           Bounce=(0.05, 0.04, 0.02), FrontFill=(0.12, 0.10, 0.10), Breakup=0.55, LitTex=0.6),
                 haze=(0.74, 0.76, 0.82)),
}


# ====================================================================== palette / control groups
def _value_group(name, keys, kind):
    g = bpy.data.node_groups.get(name)
    if g:
        return g
    g = bpy.data.node_groups.new(name, "ShaderNodeTree")
    out = g.nodes.new("NodeGroupOutput")
    for k in keys:
        if kind == "color":
            g.interface.new_socket(k, in_out="OUTPUT", socket_type="NodeSocketColor")
            n = g.nodes.new("ShaderNodeRGB")
        else:
            g.interface.new_socket(k, in_out="OUTPUT", socket_type="NodeSocketFloat")
            n = g.nodes.new("ShaderNodeValue")
        n.name = n.label = k
        g.links.new(n.outputs[0], out.inputs[k])
    if kind == "time":
        pass
    return g


def pal_group():
    return _value_group(PAL, PAL_KEYS, "color")


def ctl_group():
    g = bpy.data.node_groups.get(CTL)
    if g:
        return g
    g = _value_group(CTL, tuple(CTL_DEFAULTS) + ("Time",), "value")
    for k, v in CTL_DEFAULTS.items():
        g.nodes[k].outputs[0].default_value = v
    fc = g.nodes["Time"].outputs[0].driver_add("default_value")
    fc.driver.type = "SCRIPTED"
    fc.driver.expression = "frame/24"
    return g


def pal_node(nb):
    n = nb.n("ShaderNodeGroup")
    n.node_tree = pal_group()
    return n


def ctl_node(nb):
    n = nb.n("ShaderNodeGroup")
    n.node_tree = ctl_group()
    return n


def set_pal(pal, frame=None):
    g = pal_group()
    for k, c in pal.items():
        s = g.nodes[k].outputs[0]
        s.default_value = (*c[:3], 1.0)
        if frame is not None:
            s.keyframe_insert("default_value", frame=frame)


def key(frame=None, **ctl):
    """Set (and with frame, key) sky controls. Overcast 0..1 cloud cover; Hole 0..1 the gap near the sun (ash);
    Storm -0.3 (none) .. 0 (a low wall on the WNW horizon) .. 1 (overhead); Flash 0..1 (+ FlashAz/FlashEl deg: where
    in the storm it glows); Tear 0..1 the storm torn open around the sun (beam); Part 0..1 clouds parting (bloom);
    Rays 0..1 crepuscular rays; SunDisk 0..1; Wall 0..1 the painted storm wall (0 when clouds.storm_wall is built)."""
    g = ctl_group()
    for k, v in ctl.items():
        s = g.nodes[k].outputs[0]
        s.default_value = float(v)
        if frame is not None:
            s.keyframe_insert("default_value", frame=frame)
    if "Hole" in ctl or "Tear" in ctl:
        _patch_follow(frame, ctl)


def flash(frame, amount=1.0, az=None, el=None, decay=0.25, double=True):
    """A lightning flash lighting the storm from inside (sky only; fx.lightning adds the bolt and the light)."""
    fps = bpy.context.scene.render.fps
    g = ctl_group()
    if az is not None:
        key(frame - 1, FlashAz=az)
    if el is not None:
        key(frame - 1, FlashEl=el)
    seq = [(frame - 1, 0.0), (frame, amount), (frame + 1, amount * 0.35), (frame + 2, amount * 0.9)] if double else \
        [(frame - 1, 0.0), (frame, amount)]
    seq += [(frame + 2 + max(1, int(decay * fps)), 0.0)]
    s = g.nodes["Flash"].outputs[0]
    for f, v in seq:
        s.default_value = v
        s.keyframe_insert("default_value", frame=f)


# ====================================================================== the painter
def _rgbn(nb, c):
    n = nb.n("ShaderNodeRGB")
    n.outputs[0].default_value = (*c[:3], 1.0)
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


def _gauss(nb, x, w):
    q = nb.math("DIVIDE", x, w)
    return nb.math("EXPONENT", nb.mul(nb.mul(q, q), -1.0))


def _tex(nb, img, u, v):
    cv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(cv, "X", u)
    nb.inp(cv, "Y", v)
    tx = nb.n("ShaderNodeTexImage", image=image(img), interpolation="Cubic", extension="REPEAT")
    nb.link(cv.outputs[0], tx.inputs[0])
    s = nb.n("ShaderNodeSeparateColor", inputs={"Color": tx.outputs[0]})
    return s.outputs[0], s.outputs[1], s.outputs[2]


def _noise2(nb, u, v, scale, detail=3.0, dist=0.3, w=None):
    cv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(cv, "X", u)
    nb.inp(cv, "Y", v)
    if w is not None:
        nb.inp(cv, "Z", w)
    n = nb.n("ShaderNodeTexNoise", inputs={"Scale": scale, "Detail": detail, "Roughness": 0.55, "Distortion": dist})
    nb.link(cv.outputs[0], n.inputs["Vector"])
    return n.outputs["Fac"]


def _towers(seed=77, n=9, spread=85.0, w=(14.0, 30.0), hgt=(0.55, 1.0)):
    """Billows of the storm wall: (azimuth offset rad from STORM_FROM, half-width rad, relative height)."""
    import numpy as np
    rng = np.random.default_rng(seed)
    out = []
    if n <= 12:
        out.append((0.0, math.radians(w[1]), hgt[1]))
    for i in range(n):
        da = rng.uniform(-spread, spread)
        ww = rng.uniform(*w)
        h = rng.uniform(*hgt) * (1.0 - 0.4 * abs(da) / spread)
        out.append((math.radians(da), math.radians(ww), h))
    return out


TOWERS = (_towers(77, 12, 85.0, (16.0, 34.0), (0.6, 1.0)),       # big masses
          _towers(78, 24, 90.0, (4.0, 9.0), (0.3, 1.0)),          # billows on them
          _towers(79, 52, 95.0, (1.2, 2.8), (0.3, 1.0)))          # cauliflower knobs
TOWER_W = (1.0, 0.32, 0.14)
TIERS = ((0.74, _towers(81, 16, 90.0, (3.5, 8.0), (0.3, 1.0))),    # lower stacked billows inside the wall
         (0.50, _towers(82, 16, 90.0, (3.5, 8.0), (0.3, 1.0))),
         (0.27, _towers(83, 16, 90.0, (3.0, 7.0), (0.3, 1.0))))


def _painter(nb, d):
    """Camera colour + lighting colour sockets."""
    P = pal_node(nb)
    C = ctl_node(nb)
    p = lambda k: P.outputs[k]
    c = lambda k: C.outputs[k]
    sep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": d})
    x, y, el = sep.outputs[0], sep.outputs[1], sep.outputs[2]
    T = c("Time")
    az = nb.math("ARCTAN2", y, x)
    u = nb.mul(az, 6.0 / (2 * math.pi))
    # screen-space brushwork (horizontal strokes along the sky; seam-free enough at the az = 180 deg back)
    s1, sj, _ = _tex(nb, "strokes_soft", nb.mul(u, 0.6), nb.mul(el, 2.0))
    s2, _, _ = _tex(nb, "strokes_soft", nb.mul(u, 2.3), nb.add(nb.mul(el, 11.0), 0.37))
    s3, _, _ = _tex(nb, "strokes_soft", nb.mul(u, 1.1), nb.add(nb.mul(el, 4.0), 0.61))
    brush = nb.add(nb.add(nb.mul(nb.sub(s1, 0.5), 0.45), nb.mul(nb.sub(s2, 0.5), 0.35)), nb.mul(nb.sub(s3, 0.5), 0.3))
    # ------------------------------------------------ base gradient, brushed
    col = nb.mix(nb.mapr(el, -0.08, 0.0), p("Below"), p("Horizon"))
    col = nb.mix(nb.mapr(el, 0.0, 0.22), col, p("Mid"))
    col = nb.mix(nb.mapr(el, 0.16, 0.85), col, p("Zenith"))
    col = _vscale(nb, col, nb.add(1.0, nb.mul(brush, nb.mapr(el, 0.5, 0.0, 0.05, 0.12, interp="LINEAR"))))
    hue = nb.n("ShaderNodeHueSaturation")
    nb.inp(hue, "Color", col)
    nb.inp(hue, "Hue", nb.add(0.5, nb.mul(nb.sub(sj, 0.5), 0.02)))
    col = hue.outputs[0]
    # ------------------------------------------------ sun
    sd = sun_vec()
    sdn = nb.n("ShaderNodeCombineXYZ", inputs={"X": sd.x, "Y": sd.y, "Z": sd.z})
    dot = nb.vmath("DOT_PRODUCT", d, sdn.outputs[0])
    dp = nb.math("MAXIMUM", dot, 0.0)
    ang = nb.math("ARCCOSINE", nb.math("MINIMUM", nb.math("MAXIMUM", dot, -1.0), 1.0))
    glow = nb.add(nb.mul(nb.math("POWER", dp, 12.0), 0.07), nb.mul(nb.math("POWER", dp, 140.0), 0.5))
    sunp = nb.math("POWER", dp, 3.0)
    # ------------------------------------------------ cloud deck coordinates (isotropic cloud textures only)
    dz = nb.math("MAXIMUM", el, 0.035)
    flat = nb.mapr(el, 0.0, 0.35, 0.3, 1.0)
    px = nb.mul(nb.math("DIVIDE", x, dz), flat)
    py = nb.mul(nb.math("DIVIDE", y, dz), flat)
    drift = nb.mul(T, 0.006)
    m1, t1, b1 = _tex(nb, "cloudmass", nb.add(nb.mul(px, 0.05), drift), nb.add(nb.mul(py, 0.05), 0.3))
    m2, t2, b2 = _tex(nb, "cloudmass", nb.add(nb.mul(px, 0.14), 0.37), nb.add(nb.mul(py, 0.14), nb.add(0.61, drift)))
    n1 = _noise2(nb, nb.add(nb.mul(px, 0.06), drift), nb.mul(py, 0.06), 1.0, 5.0, 0.9)
    n2 = _noise2(nb, nb.mul(px, 0.035), nb.add(nb.mul(py, 0.035), 7.0), 1.0, 2.0, 0.2)
    hfade = nb.mapr(el, 0.0, 0.11)
    dens = nb.add(nb.add(nb.mul(t1, 0.45), nb.mul(t2, 0.3)), nb.mul(nb.sub(n1, 0.3), 0.6))
    field = nb.add(nb.add(nb.mul(m1, 0.3), nb.mul(n1, 0.7)), nb.mul(brush, 0.15))
    thr = nb.sub(1.0, c("Overcast"))
    ovc = nb.mapr(nb.sub(field, thr), -0.14, 0.06)
    ovc = nb.math("MAXIMUM", ovc, nb.mul(nb.sub(1.0, hfade), nb.mapr(c("Overcast"), 0.3, 0.8)))
    # the hole near the sun (ash) and the tear (beam): noisy-edged openings
    en = _noise2(nb, nb.mul(px, 0.3), nb.mul(py, 0.3), 1.0, 3.0, 0.6)
    hole_r = nb.mul(c("Hole"), 0.30)
    holeM = nb.mapr(nb.math("DIVIDE", nb.add(ang, nb.mul(nb.sub(en, 0.5), 0.16)), nb.add(hole_r, 1e-3)), 0.55, 1.0)
    holeM = nb.math("MAXIMUM", holeM, nb.mapr(c("Hole"), 0.02, 0.0))
    tear_r = nb.mul(c("Tear"), 0.62)
    en2 = _noise2(nb, nb.mul(px, 0.45), nb.mul(py, 0.45), 1.0, 5.0, 0.9)
    tearM = nb.mapr(nb.math("DIVIDE", nb.add(ang, nb.add(nb.mul(nb.sub(en, 0.5), 0.25), nb.mul(nb.sub(en2, 0.5), 0.55))),
                                   nb.add(tear_r, 0.02)), 0.74, 1.0)
    tearM = nb.math("MAXIMUM", tearM, nb.mul(nb.mapr(n1, 0.58, 0.72), nb.mapr(ang, 0.05, 0.2)))     # wisps left
    tearM = nb.math("MAXIMUM", tearM, nb.mapr(c("Tear"), 0.02, 0.0))
    partM = nb.sub(1.0, nb.mul(c("Part"), nb.mapr(nb.add(n2, nb.mul(nb.sub(m1, 0.5), 0.4)), 0.30, 0.62)))
    open_ = nb.mul(nb.mul(holeM, tearM), partM)
    ovc = nb.mul(ovc, open_)
    # overcast colour: three painted tones (dark bellies / mid / lit thin parts and the sun side), brushed
    lit = nb.add(nb.add(nb.mul(nb.sub(1.0, dens), 0.62), nb.mul(sunp, 0.4)),
                 nb.add(nb.mul(nb.sub(b1, 0.5), 0.3), nb.mul(brush, 0.35)))
    lit = nb.mapr(lit, 0.1, 1.05, 0.0, 1.0, interp="LINEAR")
    ccol = nb.mix(nb.mapr(lit, 0.12, 0.42), p("CloudDark"), p("CloudMid"))
    ccol = nb.mix(nb.mapr(lit, 0.58, 0.88), ccol, p("CloudLit"))
    ccol = nb.mix(nb.mul(nb.sub(1.0, hfade), 0.75), ccol, p("Horizon"))
    tedge = nb.mul(nb.mul(nb.mapr(tearM, 0.0, 0.6), nb.mapr(tearM, 1.0, 0.35)), nb.mapr(c("Tear"), 0.0, 0.2))
    rim = nb.add(nb.mul(_gauss(nb, nb.sub(ang, hole_r), 0.035), nb.mul(c("Hole"), 0.6)), nb.mul(tedge, 0.9))
    silver = nb.mul(nb.mul(nb.sub(1.0, dens), nb.math("POWER", dp, 14.0)), 1.1)
    ccol = _vadd(nb, ccol, _vscale(nb, p("SunGlow"), nb.add(nb.mul(rim, 1.3), silver)))
    # ------------------------------------------------ the storm: a wall of rounded cumulonimbus towers rolling in
    us = storm_vec()
    s_az = math.atan2(us.y, us.x)
    storm01 = nb.math("MAXIMUM", nb.math("MINIMUM", c("Storm"), 1.0), 0.0)
    H = nb.add(0.05, nb.mul(storm01, 0.85))
    top = None
    layers = []
    for li, (layer, wt_) in enumerate(zip(TOWERS, TOWER_W)):
        lt = None
        for (da, w, h) in layer:
            q = nb.math("DIVIDE", nb.math("ARCSINE", nb.math("SINE", nb.sub(az, s_az + da))), w)
            dome = nb.mul(nb.math("SQRT", nb.math("MAXIMUM", nb.sub(1.0, nb.mul(q, q)), 0.0)), h)
            lt = dome if lt is None else nb.math("MAXIMUM", lt, dome)
        layers.append(lt)
        top = nb.mul(lt, wt_) if top is None else nb.add(top, nb.mul(lt, wt_))
    azm = nb.math("COSINE", nb.sub(az, s_az))
    top = nb.mul(nb.mul(H, top), nb.mapr(azm, -0.1, 0.5))
    wall = nb.mapr(nb.sub(top, el), -0.004, 0.006)
    wfade = nb.mul(nb.mapr(c("Storm"), 0.95, 0.7), c("Wall"))   # merges into the deck once overhead; 0 = 3D wall
    wall = nb.mul(wall, wfade)
    s_ = nb.add(nb.mul(px, us.x), nb.mul(py, us.y))
    fa = nb.math("MINIMUM", nb.add(nb.mul(H, 1.25), nb.mul(nb.math("MAXIMUM", nb.sub(c("Storm"), 0.55), 0.0), 5.5)), 3.0)
    front = nb.math("DIVIDE", nb.math("COSINE", fa), nb.math("MAXIMUM", nb.math("SINE", fa), 0.02))
    sn = _noise2(nb, nb.mul(px, 0.22), nb.mul(py, 0.22), 1.0, 4.0, 0.5)
    deck = nb.mapr(nb.add(nb.sub(s_, front), nb.mul(nb.sub(sn, 0.5), 3.0)), -0.3, 0.5)
    stormM = nb.math("MAXIMUM", deck, wall)
    stormM = nb.mul(nb.mul(stormM, nb.mapr(c("Storm"), -0.25, 0.0)), nb.mul(tearM, partM))
    # wall shading: lit cauliflower tops, a dark body, billows (texture in az/el), a crisp rim on the crest
    wt = _noise2(nb, nb.mul(az, 3.0), nb.mul(el, 6.0), 1.0, 3.0, 0.3)
    wb = _noise2(nb, nb.mul(az, 9.0), nb.add(nb.mul(el, 18.0), 3.0), 1.0, 2.0, 0.2)
    depth_in = nb.math("DIVIDE", nb.sub(top, el), nb.math("MAXIMUM", H, 0.02))
    # stacked billows inside the wall: under each tier's lumpy contour a lobe's lit top, above it the shaded
    # underside of the lobe overhanging it (cauliflower)
    shade = None
    for (fk, layer) in TIERS:
        lt = None
        for (da, w, h) in layer:
            q = nb.math("DIVIDE", nb.math("ARCSINE", nb.math("SINE", nb.sub(az, s_az + da))), w)
            dome = nb.mul(nb.math("SQRT", nb.math("MAXIMUM", nb.sub(1.0, nb.mul(q, q)), 0.0)), h)
            lt = dome if lt is None else nb.math("MAXIMUM", lt, dome)
        fkv = nb.add(fk, nb.mul(nb.sub(_noise2(nb, nb.mul(az, 3.5), fk * 13.0, 1.0, 2.0, 0.2), 0.5), 0.3))
        tier = nb.mul(nb.mul(H, nb.add(nb.mul(layers[0], fkv), nb.mul(lt, 0.3))), nb.mapr(azm, -0.1, 0.5))
        dk = nb.math("DIVIDE", nb.sub(tier, el), nb.math("MAXIMUM", H, 0.02))
        band = nb.sub(nb.mapr(dk, 0.0, 0.05), nb.mapr(dk, 0.06, 0.22))          # lit top of the lower lobe
        under = nb.sub(nb.mapr(dk, -0.12, -0.02), nb.mapr(dk, -0.015, 0.0))     # shadow under the upper lobe
        t_ = nb.sub(nb.mul(band, 0.42), nb.mul(under, 0.28))
        shade = t_ if shade is None else nb.add(shade, t_)
    w_lit = nb.add(nb.mul(nb.mapr(depth_in, 0.16, 0.0), 0.55), nb.mul(shade, 0.8))
    w_lit = nb.add(w_lit, nb.add(nb.mul(nb.sub(wt, 0.5), 0.35), nb.mul(nb.sub(wb, 0.5), 0.2)))
    w_lit = nb.add(w_lit, nb.add(nb.mul(brush, 0.3), nb.mul(nb.mapr(depth_in, 0.4, 1.0), -0.25)))
    w_lit = nb.sub(w_lit, 0.16)
    # the deck (overhead): heavy, lumpy (mammatus), darker bellies
    sm1, st1, sb1 = _tex(nb, "cloudmass", nb.add(nb.mul(px, 0.07), nb.mul(drift, 1.6)), nb.add(nb.mul(py, 0.07), 0.71))
    sm2, st2, sb2 = _tex(nb, "cloudmass", nb.add(nb.mul(px, 0.2), 0.13), nb.add(nb.mul(py, 0.2), nb.mul(drift, 2.2)))
    d_lit = nb.add(nb.add(nb.mul(nb.sub(1.0, st1), 0.4), nb.mul(nb.sub(1.0, st2), 0.25)),
                   nb.add(nb.mul(nb.sub(sb1, 0.5), 0.35), nb.mul(brush, 0.4)))
    d_lit = nb.add(nb.mul(nb.sub(d_lit, 0.45), 1.6), 0.45)
    d_lit = nb.add(d_lit, nb.mul(sunp, 0.25))
    s_lit = nb.add(nb.mul(wall, w_lit), nb.mul(nb.sub(1.0, wall), nb.mul(d_lit, 0.75)))
    scol = nb.mix(nb.mapr(s_lit, 0.1, 0.5), p("StormDark"), nb.mix(0.5, p("StormDark"), p("StormLit")))
    scol = nb.mix(nb.mapr(s_lit, 0.45, 0.95), scol, p("StormLit"))
    edge = nb.mul(nb.mul(_gauss(nb, nb.sub(nb.sub(top, el), 0.002), 0.0035), nb.mapr(top, 0.02, 0.05)),
                  nb.mul(nb.mapr(_noise2(nb, nb.mul(az, 14.0), 0.7, 1.0, 2.0, 0.0), 0.35, 0.7), wfade))
    scol = _vadd(nb, scol, _vscale(nb, p("StormRim"), nb.mul(edge, nb.add(0.3, nb.mul(sunp, 1.2)))))
    scol = _vadd(nb, scol, _vscale(nb, p("SunGlow"), nb.mul(nb.mul(tedge, 1.3), nb.add(0.3, nb.mul(nb.sub(1.0, st1), 0.7)))))
    # rain veils: lighter streaky curtains hanging under the storm near the horizon
    rs, _, _ = _tex(nb, "strokes_vert", nb.mul(u, 5.0), nb.mul(el, 0.8))
    veil = nb.mul(nb.mul(nb.mapr(el, 0.07, 0.0), nb.mapr(rs, 0.4, 0.8)), nb.mul(stormM, 0.3))
    scol = nb.mix(veil, scol, p("Rain"))
    # internal lightning: a glow blob at (FlashAz, FlashEl) inside the storm + a general brightening
    faz = nb.mul(c("FlashAz"), math.pi / 180.0)
    fel = nb.mul(c("FlashEl"), math.pi / 180.0)
    da = nb.math("ARCCOSINE", nb.math("COSINE", nb.sub(az, faz)))
    blob = nb.mul(_gauss(nb, da, 0.16), _gauss(nb, nb.sub(el, fel), 0.09))
    blob = nb.mul(blob, nb.add(0.35, nb.mul(nb.add(st1, wt), 0.6)))
    fl = nb.mul(c("Flash"), nb.add(nb.mul(blob, 1.25), 0.07))
    scol = _vadd(nb, scol, _vscale(nb, p("FlashC"), nb.mul(fl, stormM)))
    # ------------------------------------------------ crepuscular rays around the sun
    a1 = sd.cross(Vector((0, 0, 1))).normalized()
    a2 = sd.cross(a1).normalized()
    e1 = nb.n("ShaderNodeCombineXYZ", inputs={"X": a1.x, "Y": a1.y, "Z": a1.z})
    e2 = nb.n("ShaderNodeCombineXYZ", inputs={"X": a2.x, "Y": a2.y, "Z": a2.z})
    phi = nb.math("ARCTAN2", nb.vmath("DOT_PRODUCT", d, e2.outputs[0]), nb.vmath("DOT_PRODUCT", d, e1.outputs[0]))
    rn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 1.0, "Detail": 2.0, "Roughness": 0.5}, noise_dimensions="2D")
    rv = nb.n("ShaderNodeCombineXYZ")
    nb.inp(rv, "X", nb.mul(nb.math("SINE", phi), 1.7))
    nb.inp(rv, "Y", nb.mul(nb.math("COSINE", phi), 1.7))
    nb.link(rv.outputs[0], rn.inputs["Vector"])
    rays = nb.mapr(rn.outputs["Fac"], 0.45, 0.64)
    rays = nb.mul(nb.mul(rays, nb.math("POWER", dp, 3.0)), nb.mul(nb.mapr(ang, 0.06, 0.2), nb.mapr(ang, 0.9, 0.4)))
    rays = nb.mul(rays, c("Rays"))
    # ------------------------------------------------ compose
    clear = _vadd(nb, col, _vscale(nb, p("SunGlow"), nb.mul(glow, nb.add(0.25, nb.mul(nb.sub(1.0, open_), 1.2)))))
    clear = nb.mix(nb.mul(nb.mul(nb.math("POWER", dp, 4.0), 0.6), nb.sub(1.0, holeM)), clear, p("HoleSky"))
    clear = _vadd(nb, clear, _vscale(nb, p("SunGlow"), nb.mul(nb.sub(1.0, holeM), nb.mul(nb.math("POWER", dp, 30.0), 0.6))))
    clear = nb.mix(nb.mul(nb.mul(nb.math("POWER", dp, 6.0), 0.75), nb.sub(1.0, tearM)), clear, p("HoleSky"))
    disk = nb.mul(nb.mapr(dot, 0.99955, 0.99975), nb.mul(c("SunDisk"), 14.0))
    clear = _vadd(nb, clear, _vscale(nb, p("SunGlow"), disk))
    sky = nb.mix(ovc, clear, ccol)
    sky = nb.mix(stormM, sky, scol)
    sky = _vadd(nb, sky, _vscale(nb, p("Ray"), nb.mul(nb.mul(rays, 0.2), nb.sub(1.0, nb.mul(stormM, 0.6)))))
    sky = _vadd(nb, sky, _vscale(nb, p("FlashC"), nb.mul(c("Flash"), 0.025)))
    # ------------------------------------------------ lighting (what surfaces see)
    lit_col = nb.mix(nb.mapr(el, -0.45, 0.7), p("LightLow"), p("Light"))
    lit_col = _vadd(nb, lit_col, _vscale(nb, p("FlashC"), nb.mul(c("Flash"), 0.35)))
    return sky, lit_col


# ====================================================================== lights
def _mk_light(name, kind, col, e, shadow=True, angle=2.0):
    o = bpy.data.objects.get(name)
    if o:
        bpy.data.objects.remove(o)
    ld = bpy.data.lights.new(name, kind)
    ld.color = col
    ld.energy = e
    if kind == "SUN":
        ld.angle = math.radians(angle)
    ld.use_shadow = shadow
    o = bpy.data.objects.new(name, ld)
    bpy.context.scene.collection.objects.link(o)
    return o


PATCH_DIST = 420.0


def _patch_light(col, irr, radius):
    """A spot from the sun direction onto the summit: the gold patch (ash/threat) or the beam (beam)."""
    from . import terrain
    tgt = Vector((layout.PEAK_SOIL[0], layout.PEAK_SOIL[1], float(terrain.height(*layout.PEAK_SOIL))))
    sd = sun_vec()
    o = _mk_light("LU_SunPatch", "SPOT", col, 1.0, shadow=True)
    o.location = tgt + sd * PATCH_DIST
    o.rotation_euler = (-sd).to_track_quat("-Z", "Y").to_euler()
    o.data.shadow_soft_size = 2.0
    o["irr"] = irr
    _patch_set(o, irr, radius)
    return o


def _patch_set(o, irr, radius, frame=None):
    o.data.spot_size = 2.0 * math.atan(max(radius, 0.05) / PATCH_DIST)
    o.data.spot_blend = 0.4
    o.data.energy = irr * 4 * math.pi * PATCH_DIST ** 2 / 3.0
    if frame is not None:
        o.data.keyframe_insert("spot_size", frame=frame)
        o.data.keyframe_insert("energy", frame=frame)


def patch_key(frame, radius, irr=None):
    """Key the sun patch / beam spot radius (m at the summit) and irradiance (W/m2-ish)."""
    o = bpy.data.objects.get("LU_SunPatch")
    if o is None:
        return
    _patch_set(o, o.get("irr", 5.0) if irr is None else irr, radius, frame)


def _patch_follow(frame, ctl):
    o = bpy.data.objects.get("LU_SunPatch")
    if o is None:
        return
    ph = PHASES.get(CURRENT.get("phase", "ash"), {})
    pt = ph.get("patch")
    if not pt:
        return
    if "Hole" in ctl:
        r = pt[2] * ctl["Hole"] / max(ph["ctl"].get("Hole", 0.35), 1e-3)
        _patch_set(o, o.get("irr", pt[1]) * (1.0 if ctl["Hole"] > 0.02 else 0.0), r, frame)
    if "Tear" in ctl:
        on = ctl["Tear"] > 0.05
        _patch_set(o, pt[1] if on else 0.0, pt[2] * (0.4 + 0.6 * min(1.0, ctl["Tear"] / 0.32)), frame)


def lights_key(frame, phase):
    """Key the sun (colour, energy) and the patch to a phase at frame (for transitions)."""
    ph = PHASES[phase]
    s = bpy.data.objects.get("LU_Sun")
    if s:
        s.data.color = ph["sun"][0]
        s.data.energy = ph["sun"][1]
        s.data.keyframe_insert("color", frame=frame)
        s.data.keyframe_insert("energy", frame=frame)
    o = bpy.data.objects.get("LU_SunPatch")
    if o:
        if ph["patch"]:
            o.data.color = ph["patch"][0]
            _patch_set(o, ph["patch"][1], ph["patch"][2], frame)
            o.data.keyframe_insert("color", frame=frame)
        else:
            o.data.energy = 0.0
            o.data.keyframe_insert("energy", frame=frame)


def _look(phase):
    """LU_Look for a phase. The painterly terminator is set from the rig: surfaces lit only by the sky sit at ~ the
    sky-light luminance, sunlit ones above it, so the ramp separates real light from shadow."""
    ph = PHASES[phase]
    look = dict(ph["look"])
    k = ph["sun"][1]
    L = ph["pal"]["Light"]
    amb = (0.2126 * L[0] + 0.7152 * L[1] + 0.0722 * L[2]) * ph["world_e"]
    look.setdefault("TermLo", amb * 1.0 + 0.03 * k)
    look.setdefault("TermHi", amb + 0.2 * k)
    return look


def look_key(frame, phase):
    from . import mat as M
    g = M.look_group()
    for k, v in _look(phase).items():
        s = g.nodes[k].outputs[0]
        s.default_value = (*v[:3], 1) if isinstance(v, tuple) else v
        s.keyframe_insert("default_value", frame=frame)


def key_phase(frame, phase, ctl=True, lights=True, look=True, **ctl_over):
    """Key the palette (+ controls, lights, LU_Look) to phase at frame. Two calls = a transition."""
    ph = PHASES[phase]
    set_pal(ph["pal"], frame)
    if ctl:
        cc = dict(CTL_DEFAULTS)
        cc.update(ph["ctl"])
        cc.update(ctl_over)
        cc.pop("FlashAz", None)
        cc.pop("FlashEl", None)
        cc.pop("Flash", None)
        cc.pop("Wall", None)
        g = ctl_group()
        for k, v in cc.items():
            s = g.nodes[k].outputs[0]
            s.default_value = float(v)
            s.keyframe_insert("default_value", frame=frame)
    if lights:
        lights_key(frame, phase)
    if look:
        look_key(frame, phase)


# ====================================================================== build
def build(phase="ash", **ctl):
    """Create the world sky + lights for a phase (see PHASES); ctl overrides controls. Returns (lights, preset)."""
    ph = PHASES[phase]
    CURRENT.clear()
    CURRENT.update(dict(phase=phase, key=ph["sun"][0], key_e=ph["sun"][1], haze=ph["haze"],
                        world_e=ph["world_e"], sun_az_el=ph.get("sun_az_el")))
    CURRENT["sun_dir"] = tuple(sun_vec())
    set_pal(ph["pal"])
    cc = dict(CTL_DEFAULTS)
    cc.update(ph["ctl"])
    cc.update(ctl)
    g = ctl_group()
    for k, v in cc.items():
        g.nodes[k].outputs[0].default_value = float(v)
    w = bpy.data.worlds.get("LU_Sky") or bpy.data.worlds.new("LU_Sky")
    bpy.context.scene.world = w
    w.use_nodes = True
    t = w.node_tree
    t.nodes.clear()
    nb = NB(t)
    tc = nb.n("ShaderNodeTexCoord")
    d = nb.vmath("NORMALIZE", tc.outputs["Generated"])
    sky_c, lit_c = _painter(nb, d)
    lp = nb.n("ShaderNodeLightPath")
    bg_cam = nb.n("ShaderNodeBackground", inputs={"Strength": 1.0})
    nb.inp(bg_cam, "Color", sky_c)
    bg_lit = nb.n("ShaderNodeBackground", inputs={"Strength": ph["world_e"]})
    nb.inp(bg_lit, "Color", lit_c)
    mx = nb.n("ShaderNodeMixShader")
    nb.link(lp.outputs["Is Camera Ray"], mx.inputs[0])
    nb.link(bg_lit.outputs[0], mx.inputs[1])
    nb.link(bg_cam.outputs[0], mx.inputs[2])
    out = nb.n("ShaderNodeOutputWorld")
    nb.link(mx.outputs[0], out.inputs[0])
    # lights
    for n in ("LU_Sun", "LU_SunPatch", "LU_Fill"):
        o = bpy.data.objects.get(n)
        if o:
            bpy.data.objects.remove(o)
    lights = {}
    sd = sun_vec()
    sun = _mk_light("LU_Sun", "SUN", ph["sun"][0], ph["sun"][1], True, ph["sun"][2])
    sun.rotation_euler = (-sd).to_track_quat("-Z", "Y").to_euler()
    lights["sun"] = sun
    if ph["patch"]:
        pc, irr, rad = ph["patch"]
        if phase == "beam":
            rad = rad * (0.4 + 0.6 * min(1.0, cc["Tear"] / 0.32)) if cc["Tear"] > 0.05 else rad
            irr = irr if cc["Tear"] > 0.05 else 0.0
        elif "Hole" in ctl:
            rad = rad * cc["Hole"] / max(ph["ctl"].get("Hole", 0.35), 1e-3)
        lights["patch"] = _patch_light(pc, irr, rad)
    from . import mat as M
    M.set_look(**_look(phase))
    return lights, ph


def sun_screen(cam, frame=None):
    """Screen position (0..1) of the sun for a camera (for post sun glow), or None if behind."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    if frame is not None:
        sc.frame_set(frame)
    bpy.context.view_layer.update()
    p = cam.matrix_world.translation + sun_vec() * 3000.0
    v = world_to_camera_view(sc, cam, p)
    return (v.x, v.y) if v.z > 0 else None
