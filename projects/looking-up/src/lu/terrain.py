"""The peak: a grassy summit plateau with rocky cliffs falling into the sea of clouds."""
import math
import bpy
import numpy as np

from . import geo, mat

R_TOP = 19.0      # gentle summit dome radius
R_EDGE = 27.0     # cliff lip
WINDMILL = (0.0, 7.0)


def _n2(x, y, seed=0):
    """Smooth deterministic 2-D noise from summed sines (vectorised)."""
    rng = np.random.default_rng(seed)
    acc = np.zeros_like(x, dtype=float)
    amp = 1.0
    for i in range(5):
        k = rng.normal(0, 1, 2) * (0.07 * 2 ** i)
        k2 = rng.normal(0, 1, 2) * (0.07 * 2 ** i)
        acc += amp * np.sin(x * k[0] + y * k[1] + rng.random() * 6.28) * np.cos(x * k2[0] - y * k2[1] + rng.random() * 6.28)
        amp *= 0.5
    return acc


def height(x, y):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    r = np.hypot(x, y)
    dome = 1.6 * (1 - np.clip(r / R_TOP, 0, 1.4) ** 2)
    shoulder = -np.clip((r - R_TOP) / (R_EDGE - R_TOP), 0, 1) ** 2 * 3.5
    cliff = -np.clip((r - R_EDGE) / 6.0, 0, None) ** 1.6 * 14.0
    bump = _n2(x, y, 3) * 0.35 * np.clip(1 - r / 40, 0.2, 1)
    # flatten a pad for the windmill
    dw = np.hypot(x - WINDMILL[0], y - WINDMILL[1])
    z = dome + shoulder + cliff + bump
    pad = np.clip(1 - (dw - 4.5) / 3.0, 0, 1)
    zw = 1.6 * (1 - (math.hypot(*WINDMILL) / R_TOP) ** 2)
    return z * (1 - pad) + zw * pad


def build(collection=None):
    col = collection or geo.coll("Terrain")
    rings = np.concatenate([np.linspace(0.0, R_EDGE, 70)[1:], np.linspace(R_EDGE, 58, 46)[1:]])
    seg = 300
    verts = [(0.0, 0.0, float(height(0, 0)))]
    tints = [(0.36, 0.5, 0.16)]
    for i, r in enumerate(rings):
        a = np.linspace(0, 2 * math.pi, seg, endpoint=False)
        jitter = _n2(np.cos(a) * 10, np.sin(a) * 10, 9) * 2.0 * min(1, r / R_EDGE)
        rr = r + jitter * (r > R_EDGE - 2)
        x, y = rr * np.cos(a), rr * np.sin(a)
        z = height(x, y)
        if r > R_EDGE:
            # rock face relief
            z = z + _n2(x * 3, y * 3 + z, 4) * 1.2 * min(1, (r - R_EDGE) / 4)
        for k in range(seg):
            verts.append((x[k], y[k], z[k]))
    faces = []
    for k in range(seg):
        faces.append((0, 1 + k, 1 + (k + 1) % seg))
    for i in range(len(rings) - 1):
        b0 = 1 + i * seg
        b1 = 1 + (i + 1) * seg
        for k in range(seg):
            k2 = (k + 1) % seg
            faces.append((b0 + k, b1 + k, b1 + k2, b0 + k2))
    ob = geo.obj_from("Peak", verts, faces, col, None)
    # per-vertex paint: grass variation, dirt path, rock faces (as 'tint' + 'rock' attributes)
    me = ob.data
    co = np.array([v.co for v in me.vertices])
    x, y, z = co[:, 0], co[:, 1], co[:, 2]
    r = np.hypot(x, y)
    n1 = _n2(x * 0.8, y * 0.8, 11)
    n2 = _n2(x * 2.5, y * 2.5, 12)
    grass = np.stack([0.30 + 0.06 * n1, 0.46 + 0.06 * n1 + 0.04 * n2, 0.12 + 0.02 * n2], 1)
    dry = np.clip(0.5 + 0.5 * _n2(x * 0.35, y * 0.35, 13), 0, 1)[:, None]
    grass = grass * (1 - 0.45 * dry) + np.array([0.55, 0.45, 0.16]) * 0.45 * dry
    # dirt path from the windmill door (0, 7-3) toward the front edge, winding
    py = np.clip(y, -26, 4)
    pcx = 1.8 * np.sin(py * 0.18) - py * 0.06
    pd = np.abs(x - pcx)
    path = np.clip(1 - (pd - 0.45) / 0.5, 0, 1) * (y < 4.5) * (y > -24)
    path *= np.clip(0.75 + 0.5 * n2, 0, 1)
    dirt = np.array([0.38, 0.27, 0.16])
    col_ = grass * (1 - path[:, None]) + dirt * path[:, None]
    rock = np.clip((r - (R_EDGE - 1.5)) / 3.0, 0, 1)
    rockc = np.array([0.40, 0.36, 0.38]) * (0.85 + 0.25 * n2[:, None])
    col_ = col_ * (1 - rock[:, None]) + rockc * rock[:, None]
    att = me.color_attributes.new("tint", "FLOAT_COLOR", "POINT")
    rgba = np.concatenate([col_, np.ones((len(col_), 1))], 1)
    att.data.foreach_set("color", rgba.ravel())
    m = mat.painterly("PeakGround", (1, 1, 1), stroke="strokes_broad", scale=0.55, tex_amt=1.0, hue_jit=0.06,
                      bump=0.15, breakup=1.3, vcol="tint", ao=0.3)
    me.materials.append(m)
    ob["path_fn"] = "pcx"
    return ob


def path_x(y):
    py = min(max(y, -26), 4)
    return 1.8 * math.sin(py * 0.18) - py * 0.06


def rocks(collection=None, seed=4, count=26, keep_clear=()):
    col = collection or geo.coll("Terrain")
    rng = np.random.default_rng(seed)
    m = mat.painterly("Rock", (0.42, 0.39, 0.42), stroke="strokes_vert", scale=0.9, tex_amt=1.0, breakup=1.4,
                      color2=(0.36, 0.42, 0.18), bump=0.3, ao=0.4)
    out = []
    for i in range(count):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(R_TOP - 2, R_EDGE + 1) if i > 5 else rng.uniform(6, R_TOP)
        x, y = r * math.cos(a), r * math.sin(a)
        if math.hypot(x - WINDMILL[0], y - WINDMILL[1]) < 6 or abs(x - path_x(y)) < 1.6:
            continue
        if any(math.hypot(x - kx, y - ky) < kr for (kx, ky, kr) in keep_clear):
            continue
        s = rng.uniform(0.4, 1.6) * (1.6 if r > R_TOP else 0.7)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0)
        o = bpy.context.active_object
        o.name = f"Rock{i}"
        for c in o.users_collection:
            c.objects.unlink(o)
        col.objects.link(o)
        geo.displace_noise(o, 0.35, 0.9, seed=i)
        o.scale = (s * rng.uniform(0.9, 1.5), s * rng.uniform(0.8, 1.3), s * rng.uniform(0.45, 0.8))
        o.location = (x, y, float(height(x, y)) - s * 0.25)
        o.rotation_euler = (rng.normal(0, 0.15), rng.normal(0, 0.15), rng.uniform(0, 6.28))
        o.data.shade_smooth()
        o.data.materials.append(m)
        out.append(o)
    return out
