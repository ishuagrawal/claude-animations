"""Sea of clouds: metaball cumulus heaps near the peak + a painted far cloud floor + distant peaks."""
import math
import bpy
import numpy as np
from mathutils import Vector

from . import geo, mat


def cloud_mat(name="Cloud", tint=(1.0, 0.98, 0.96)):
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
        exclude=None):
    """Cumulus heaps on a ring around the peak. Returns list of cloud objects."""
    rng = np.random.default_rng(seed)
    col = collection or geo.coll("Clouds")
    m = mat_ or cloud_mat()
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
            nb = int(rng.integers(7, 14))
            balls = []
            for _ in range(nb):
                rr = rng.uniform(7, 16) * (1 + far * 1.2)
                bx = cx + rng.normal(0, cell * 0.28)
                by = cy + rng.normal(0, cell * 0.28)
                bz = level + rng.normal(0, 2.0) - rr * 0.15
                balls.append((bx, by, bz, rr, rng.uniform(0.45, 0.7)))
            # a few towering puffs
            if rng.random() < 0.25:
                rr = rng.uniform(10, 18)
                balls.append((cx, cy, level + rr * 0.6, rr, 1.0))
            res = 1.1 + far * 4.0
            o = _metaball_mesh(f"CloudHeap{k:03d}", balls, res, col)
            geo.displace_noise(o, 1.6 + far * 4, 7 + far * 15, seed=k)
            o.data.materials.append(m)
            o.visible_shadow = False
            objs.append(o)
            k += 1
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
    soft horizon. Painterly-shaded like the heaps (lit tops, cool valleys)."""
    col = collection or geo.coll("Clouds")
    rings = np.concatenate([np.geomspace(r_in, 1500, 90), np.geomspace(1500, r_out, 40)[1:]])
    seg = 360
    a = np.linspace(0, 2 * math.pi, seg, endpoint=False)
    R, A = np.meshgrid(rings, a, indexing="ij")
    X, Y = R * np.cos(A), R * np.sin(A)
    big = _billow(X, Y, seed, 160.0)
    mid = _billow(X, Y, seed + 1, 45.0)
    near = np.clip(1 - (R - 300) / 2500, 0.25, 1.0)
    H = level + (big * 34 + mid * 12 * near - 18) * np.clip((R - r_in) / 80, 0.3, 1.0)
    verts = np.stack([X.ravel(), Y.ravel(), H.ravel()], 1)
    faces = []
    for i in range(len(rings) - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            faces.append((i * seg + j, i * seg + j2, (i + 1) * seg + j2, (i + 1) * seg + j))
    m = mat_ or bpy.data.materials.get("CloudFloor") or mat.painterly(
        "CloudFloor", (1.0, 0.98, 0.96), stroke="strokes_broad", scale=0.03, tex_amt=0.8, hue_jit=0.03, bump=0.0,
        breakup=1.6, wrap=0.65, translucent=0.2, rim=0.4, rim_col=(1.0, 0.9, 0.8))
    o = geo.obj_from("CloudFloor", verts, faces, col, m)
    o.visible_shadow = False
    return o


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


def massif(name, center, width=1400.0, height=420.0, seed=0, level=-34.0, res=150, collection=None):
    height *= 0.72
    center = (center[0] * 1.2, center[1] * 1.2, center[2])
    """A ridged, snow-capped mountain massif (heightfield) rising out of the cloud sea."""
    col = collection or geo.coll("Peaks")
    rng = np.random.default_rng(seed)
    n = res
    xs = np.linspace(-0.5, 0.5, n)
    X, Y = np.meshgrid(xs, xs)
    h = np.zeros_like(X)
    amp, f = 1.0, 2.2
    for o in range(6):
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
    Z = (h ** 2.2 * 0.7 + peak_bias * 0.6) * fall
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
    m = bpy.data.materials.get("Massif") or mat.painterly("Massif", (1, 1, 1), stroke="strokes_vert", scale=0.004,
                                                           tex_amt=1.2, breakup=1.6, vcol="tint", bump=0.0)
    me.materials.append(m)
    o.visible_shadow = False
    return o


def massifs(collection=None):
    specs = [((-1700, 1900, 0), 1500, 420, 1), ((-700, 3000, 0), 1900, 560, 2), ((900, 2600, 0), 1400, 400, 3),
             ((2100, 1500, 0), 1700, 600, 4), ((2600, -300, 0), 1200, 380, 5), ((-2500, 300, 0), 1500, 450, 6),
             ((-2000, -2000, 0), 1600, 450, 7), ((1300, -2700, 0), 1500, 430, 8), ((-200, 4600, 0), 2600, 760, 9),
             ((3800, 2600, 0), 2200, 700, 10), ((-3900, 2400, 0), 2200, 760, 11)]
    return [massif(f"Massif{i}", c, w, h, seed=s, collection=collection) for i, (c, w, h, s) in enumerate(specs)]
