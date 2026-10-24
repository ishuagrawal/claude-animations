"""Handheld / small story props: broom, water bowl, folded blanket, spinning top, star book, lantern placement."""
import math
import bpy
from mathutils import Vector, Matrix

from . import geo, mat


def _m(name, col, **kw):
    return bpy.data.materials.get(name) or mat.painterly(name, col, **kw)


def broom(name="Broom"):
    """Origin at the handle's middle; handle along local +Z (bristles at -Z)."""
    wood = _m("BroomWood", (0.42, 0.28, 0.15), stroke="strokes_vert", scale=4, tex_amt=1.0, breakup=1.1)
    straw = _m("Straw", (0.72, 0.56, 0.26), stroke="strokes_vert", scale=5, tex_amt=1.2, breakup=1.3, bump=0.3)
    h = geo.lathe(name + "_h", [(0.016, -0.45), (0.016, 0.62), (0.0, 0.63)], seg=10, mat=wood)
    b = geo.lathe(name + "_b", [(0.03, -0.42), (0.055, -0.52), (0.11, -0.78), (0.12, -0.84), (0.0, -0.845)], seg=16, mat=straw)
    tie = geo.lathe(name + "_t", [(0.034, -0.46), (0.036, -0.43)], seg=12, mat=_m("Twine", (0.3, 0.12, 0.08)), cap_top=False, cap_bot=False)
    o = geo.join([h, b, tie], name)
    return o


def bowl(name="WaterBowl"):
    clay = _m("BowlClay", (0.62, 0.36, 0.22), stroke="strokes_soft", scale=6, tex_amt=0.7, spec=0.3, rough=0.4)
    bw = geo.lathe(name, [(0.0, 0.0), (0.07, 0.0), (0.11, 0.03), (0.13, 0.075), (0.12, 0.08), (0.095, 0.03), (0.0, 0.03)],
                   seg=24, mat=clay)
    water = _m("Water", (0.18, 0.32, 0.38), stroke="strokes_soft", scale=8, tex_amt=0.4, spec=1.0, rough=0.1)
    w = geo.lathe(name + "_w", [(0.0, 0.055), (0.112, 0.055), (0.0, 0.0551)], seg=24, mat=water)
    return geo.join([bw, w], name)


def blanket(name="Blanket", folded=True):
    q = bpy.data.materials.get("Quilt")
    if folded:
        o = geo.rounded_box(name, (0.42, 0.32, 0.07), 0.03, seg=(4, 3, 1), n_r=3, mat=q)
    else:
        o = geo.rounded_box(name, (0.8, 0.6, 0.04), 0.02, seg=(6, 5, 1), n_r=3, mat=q)
    geo.displace_noise(o, 0.01, 0.08, seed=5)
    return o


def top(name="Top"):
    red = _m("TopRed", (0.6, 0.12, 0.08), stroke="strokes_soft", scale=8, tex_amt=0.6, spec=0.4)
    yel = _m("TopYellow", (0.85, 0.62, 0.18), stroke="strokes_soft", scale=8, tex_amt=0.6, spec=0.4)
    a = geo.lathe(name + "_a", [(0.0, 0.0), (0.04, 0.03), (0.07, 0.06), (0.0, 0.065)], seg=20, mat=red)
    b = geo.lathe(name + "_b", [(0.0, 0.065), (0.07, 0.06), (0.03, 0.09), (0.008, 0.1), (0.008, 0.14), (0.0, 0.14)], seg=20, mat=yel)
    return geo.join([a, b], name)
