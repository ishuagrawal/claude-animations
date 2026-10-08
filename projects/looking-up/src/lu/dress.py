"""Art-directed set dressing, after the Wild Robot's "Sprinkles" tool: a painterly ground-cover library (grass clumps,
wildflowers, ferns, seed-head grass, clover, mossy stones, pebbles) scattered as Geometry-Nodes instances. Density
maps concentrate detail in the hero areas (north meadow around CRATER/LIE, the south meadow and path, the windmill's
skirt) and let it dissolve toward the edges of the plateau.

Data model: one point cloud per layer ("Meadow*" objects; vertices only) carrying per-point attributes
  proto (int)  prototype index in the LU_Protos collection     rot (vec)   euler tilt_x, tilt_y, rot_z
  scale (f)    uniform scale                                   tint (col)  per-instance colour multiplier
  flex (f)     how much the wind moves it (0 = stone)          lean (vec)  static world-space lean (flattened grass)
and the shared GN group LU_CoverGN instancing the prototypes and swaying them with foliage.wind (time driven,
deterministic per frame, keyable gusts). Shaders read the instance tint via an INSTANCER attribute.

Everything is seeded and deterministic."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, mat, terrain, layout

PROTO_COLL = "LU_Protos"
TAU = 2 * math.pi

# hero areas (world xy, metres)
NORTH_C, NORTH_R = (1.8, 14.2), (5.5, 9.5)
SOUTH_C, SOUTH_R = (0.8, -5.5), (7.5, 12.5)
WM = layout.WM_XY


# ===================================================================== small helpers
def _ss(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _noise(x, y, seed, freq=1.0):
    """Smooth deterministic noise in ~[-1, 1] (sum of sines; vectorised). freq ~ 1 gives features of about 1.5 m
    (terrain._n2's own base wavelength is ~90 m, hence the scale)."""
    k = 14.0 * freq
    return np.clip(terrain._n2(np.asarray(x) * k + seed * 1.7, np.asarray(y) * k - seed * 2.3, seed) / 1.1, -1, 1)


def path_dist(x, y):
    """Distance from the worn dirt path (inf where there is no path)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    py = np.clip(y, -26, 4)
    pcx = 1.8 * np.sin(py * 0.18) - py * 0.06
    d = np.abs(x - pcx)
    return np.where((y < 3.7) & (y > -24.5), d, 99.0)


def hero(x, y):
    """0..1 how much a spot is a hero area (dense, detailed cover)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    hn = 1 - _ss(NORTH_R[0], NORTH_R[1], np.hypot(x - NORTH_C[0], y - NORTH_C[1]))
    hs = 1 - _ss(SOUTH_R[0], SOUTH_R[1], np.hypot(x - SOUTH_C[0], y - SOUTH_C[1]))
    pd = path_dist(x, y)
    hp = (1 - _ss(2.0, 4.5, pd)) * (y > -19)
    dw = np.hypot(x - WM[0], y - WM[1])
    hw = 1 - _ss(6.5, 9.5, dw)
    return np.maximum.reduce([hn, hs, hp, hw])


# ===================================================================== mesh builder
class MB:
    """Accumulates a mesh with per-vertex uv, colour and custom normal."""

    def __init__(self):
        self.v, self.f, self.uv, self.c, self.n, self.ub = [], [], [], [], [], []

    def vert(self, p, uv=(0.0, 0.0), c=(1, 1, 1), n=(0, 0, 1), ub=(0.5, 0.3)):
        self.v.append((float(p[0]), float(p[1]), float(p[2])))
        self.uv.append((float(uv[0]), float(uv[1])))
        self.ub.append((float(ub[0]), float(ub[1])))
        self.c.append((float(c[0]), float(c[1]), float(c[2])))
        nn = Vector(n)
        if nn.length < 1e-6:
            nn = Vector((0, 0, 1))
        self.n.append(tuple(nn.normalized()))
        return len(self.v) - 1

    def face(self, *idx):
        self.f.append(tuple(idx))

    def build(self, name, collection, material):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.validate()
        me.update()
        me.shade_smooth()
        uvl = me.uv_layers.new(name="UVMap")
        lv = np.empty(len(me.loops), dtype=np.int64)
        me.loops.foreach_get("vertex_index", lv)
        uva = np.array(self.uv)[lv]
        uvl.data.foreach_set("uv", uva.ravel())
        ubl = me.uv_layers.new(name="UVb")
        ubl.data.foreach_set("uv", np.array(self.ub)[lv].ravel())
        att = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
        att.data.foreach_set("color", np.concatenate([np.array(self.c), np.ones((len(self.c), 1))], 1).ravel())
        me.normals_split_custom_set_from_vertices([Vector(n) for n in self.n])
        if material is not None:
            me.materials.append(material)
        ob = bpy.data.objects.new(name, me)
        collection.objects.link(ob)
        return ob


def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def _scale_c(c, k):
    return tuple(min(1.0, x * k) for x in c)


def _blade(mb, base, h, w, az, tilt, bend, segs, c0, c1, nf, uvo=(0.0, 0.0), side_rot=0.0, wshape=1.3, bulge=0.3,
           cpow=0.8):
    """A tapered, curving strap (grass blade, leaf, stem). tilt/bend in radians from vertical (bend grows as s^2)."""
    d = Vector((math.cos(az), math.sin(az), 0.0))
    z = Vector((0.0, 0.0, 1.0))
    side = Vector((-math.sin(az + side_rot), math.cos(az + side_rot), 0.0))
    p = Vector(base)
    pts = [p.copy()]
    for i in range(1, segs + 1):
        sm = (i - 0.5) / segs
        ang = tilt + bend * sm * sm
        p = p + (d * math.sin(ang) + z * math.cos(ang)) * (h / segs)
        pts.append(p.copy())
    rows = []
    for i, q in enumerate(pts):
        s = i / segs
        col = _lerp(c0, c1, s ** cpow)
        if i == segs:
            rows.append((mb.vert(q, (uvo[0] + 0.04, uvo[1] + s * 0.4), col, nf(q), (0.5, 1.0)),))
            continue
        wi = w * (1 - s ** wshape) * (1 - bulge + bulge * 2.2 * math.sin(math.pi * min(1.0, s + 0.2)))
        a = mb.vert(q - side * wi * 0.5, (uvo[0], uvo[1] + s * 0.4), col, nf(q), (0.0, s))
        b = mb.vert(q + side * wi * 0.5, (uvo[0] + 0.08, uvo[1] + s * 0.4), col, nf(q), (1.0, s))
        rows.append((a, b))
    for i in range(segs - 1):
        (a0, b0), (a1, b1) = rows[i], rows[i + 1]
        mb.face(a0, b0, b1, a1)
    a0, b0 = rows[segs - 1]
    mb.face(a0, b0, rows[segs][0])
    return pts


def _dome_nf(center):
    c = Vector(center)
    return lambda p: (Vector(p) - c)


# ===================================================================== colours (linear)
G_ROOT = (0.045, 0.085, 0.035)
G_LUSH = (0.26, 0.42, 0.11)
G_YEL = (0.40, 0.45, 0.12)
G_BLUE = (0.17, 0.34, 0.17)
G_DRY_R = (0.16, 0.13, 0.06)
G_DRY = (0.55, 0.47, 0.24)
STEM = (0.10, 0.22, 0.06)
DAISY = (0.92, 0.90, 0.82)
DAISY_C = (0.98, 0.62, 0.06)
CORN = (0.13, 0.36, 1.0)
CORN_C = (0.20, 0.10, 0.45)
VIOLET = (0.36, 0.15, 0.78)
CLOVER_P = (0.92, 0.32, 0.58)
BUTTER = (1.0, 0.70, 0.04)
STRAW = (0.60, 0.53, 0.34)
SILVER = (0.80, 0.78, 0.68)
FERN = (0.10, 0.25, 0.06)
FERN_T = (0.26, 0.44, 0.10)


# ===================================================================== prototypes
GRASS_PAL = {        # (root, tip) per clump palette (moonlit meadow: cool greens, a few warm straw-green patches)
    "lush": ((0.03, 0.07, 0.035), (0.17, 0.34, 0.12)),
    "yellow": ((0.045, 0.075, 0.03), (0.32, 0.40, 0.13)),
    "blue": ((0.025, 0.065, 0.055), (0.11, 0.29, 0.21)),
    "olive": ((0.045, 0.065, 0.035), (0.23, 0.29, 0.13)),
}


def _grass_clump(rng, n, h_rng, w_rng, rc, segs=5, dry=0.06, tilt=(0.05, 0.45), bend=(0.2, 1.1), pal="lush"):
    """A tuft of brush-stroke blades sharing one palette (so a clump reads as one dab of colour)."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.5 * h_rng[1] - rc * 2.0))
    root, tip = GRASS_PAL[pal]
    for b in range(n):
        r = rc * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        base = (r * math.cos(a), r * math.sin(a), -0.01)
        az = a + rng.normal(0, 0.6)
        h = rng.uniform(*h_rng) * (1 - 0.3 * r / max(rc, 1e-3))
        if rng.random() < dry:
            c0, c1 = G_DRY_R, _scale_c(G_DRY, rng.uniform(0.8, 1.1))
        else:
            k = rng.uniform(0.85, 1.12)
            c0, c1 = root, tuple(min(1.0, x * k * rng.uniform(0.95, 1.05)) for x in tip)
        _blade(mb, base, h, rng.uniform(*w_rng), az, rng.uniform(*tilt) * (0.4 + 0.6 * r / max(rc, 1e-3)),
               rng.uniform(*bend), segs, c0, c1, nf, (rng.random() * 0.9, rng.random() * 0.6),
               side_rot=rng.normal(0, 0.35))
    return mb


def _seed_grass(rng, stems=2, h_rng=(0.5, 0.85)):
    mb = MB()
    nf = _dome_nf((0, 0, -0.5))
    for b in range(int(rng.integers(4, 8))):      # basal leaves
        a = rng.uniform(0, TAU)
        _blade(mb, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(0.12, 0.28), rng.uniform(0.006, 0.01),
               a, rng.uniform(0.2, 0.5), rng.uniform(0.6, 1.3), 4, G_ROOT, G_YEL, nf, (rng.random() * 0.9, 0.0))
    for s in range(stems):
        a = rng.uniform(0, TAU)
        h = rng.uniform(*h_rng)
        tilt = rng.uniform(0.02, 0.16)
        bend = rng.uniform(0.1, 0.45)
        pts = _blade(mb, (0.012 * math.cos(a), 0.012 * math.sin(a), -0.01), h, 0.0045, a, tilt, bend, 7,
                     (0.18, 0.2, 0.08), STRAW, nf, (rng.random() * 0.9, 0.5), wshape=3.0, bulge=0.0)
        # panicle: spikelets hanging off the top quarter
        top = pts[-1]
        d = Vector((math.cos(a), math.sin(a), 0))
        nseeds = int(rng.integers(12, 20))
        for k in range(nseeds):
            t = 0.74 + 0.26 * k / nseeds
            i = min(int(t * (len(pts) - 1)), len(pts) - 2)
            q = pts[i].lerp(pts[i + 1], t * (len(pts) - 1) - i)
            sa = a + (k * 2.4) + rng.normal(0, 0.3)
            sd = Vector((math.cos(sa), math.sin(sa), 0))
            droop = rng.uniform(0.5, 1.1)
            L = rng.uniform(0.012, 0.02) * (1.15 - 0.5 * (t - 0.74) / 0.26)
            tipc = _lerp(STRAW, SILVER, rng.uniform(0.3, 1.0))
            _blade(mb, q, L, 0.0042, sa, droop, 0.4, 2, STRAW, tipc, nf, (0.5, 0.5), wshape=1.0, bulge=0.5)
    return mb


def _stem(mb, rng, base, h, az, tilt, bend, nf, w=0.0035, col=STEM):
    pts = _blade(mb, base, h, w, az, tilt, bend, 5, _scale_c(col, 0.6), col, nf, (rng.random() * 0.9, 0.2),
                 wshape=4.0, bulge=0.0)
    # cross ribbon so the stem has volume from every side
    _blade(mb, base, h, w, az, tilt, bend, 5, _scale_c(col, 0.6), col, nf, (rng.random() * 0.9, 0.2),
           side_rot=math.pi / 2, wshape=4.0, bulge=0.0)
    return pts


def _head_frame(pts, rng, face_up=0.75):
    """Head centre + orthonormal frame (u, v, n) at the top of a stem (n = facing direction)."""
    top = pts[-1]
    tdir = (pts[-1] - pts[-2]).normalized()
    n = (tdir * (1 - face_up) + Vector((0, 0, 1)) * face_up + Vector(rng.normal(0, 0.15, 3))).normalized()
    u = n.cross(Vector((0.31, 0.77, 0.12))).normalized()
    v = n.cross(u).normalized()
    return top, u, v, n


def _petal_ring(mb, c, u, v, n, count, r0, length, width, cup, col_base, col_tip, rng, notch=False, jag=0.0,
                start=0.0):
    for k in range(count):
        a = start + TAU * k / count + rng.normal(0, 0.06)
        dvec = (u * math.cos(a) + v * math.sin(a))
        side = n.cross(dvec).normalized()
        L = length * rng.uniform(0.85, 1.12)
        W = width * rng.uniform(0.85, 1.15)
        lift = cup + rng.normal(0, 0.08)
        out = (dvec * math.cos(lift) + n * math.sin(lift)).normalized()
        p0 = c + dvec * r0
        p1 = p0 + out * L * 0.45
        p2 = p0 + out * L
        nn = (n * 0.8 + dvec * 0.35)
        cb = _scale_c(col_base, rng.uniform(0.92, 1.05))
        ct = _scale_c(col_tip, rng.uniform(0.9, 1.06))
        i0 = mb.vert(p0 - side * W * 0.18, (0.1, 0.1), cb, nn)
        i1 = mb.vert(p0 + side * W * 0.18, (0.2, 0.1), cb, nn)
        i2 = mb.vert(p1 - side * W * 0.5, (0.1, 0.3), _lerp(cb, ct, 0.6), nn)
        i3 = mb.vert(p1 + side * W * 0.5, (0.2, 0.3), _lerp(cb, ct, 0.6), nn)
        mb.face(i0, i1, i3, i2)
        if notch:
            i4 = mb.vert(p2 - side * W * (0.55 + jag), (0.1, 0.5), ct, nn)
            i5 = mb.vert(p2 + side * W * (0.55 + jag), (0.2, 0.5), ct, nn)
            i6 = mb.vert(p1 + out * L * 0.42, (0.15, 0.45), ct, nn)
            mb.face(i2, i3, i5, i6, i4)
        else:
            i4 = mb.vert(p2 - side * W * 0.3, (0.1, 0.5), ct, nn)
            i5 = mb.vert(p2 + side * W * 0.3, (0.2, 0.5), ct, nn)
            i6 = mb.vert(p2 + out * W * 0.3, (0.15, 0.55), ct, nn)
            mb.face(i2, i3, i5, i6, i4)


def _dome(mb, c, u, v, n, r, h, col, seg=8, col_rim=None):
    ci = mb.vert(c + n * h, (0.5, 0.5), col, n)
    ring = []
    for k in range(seg):
        a = TAU * k / seg
        d = u * math.cos(a) + v * math.sin(a)
        ring.append(mb.vert(c + d * r + n * h * 0.25, (0.5, 0.5), col_rim or col, (n + d * 0.6)))
    for k in range(seg):
        mb.face(ci, ring[k], ring[(k + 1) % seg])
    # underside so it doesn't look hollow from below
    bi = mb.vert(c - n * h * 0.4, (0.5, 0.5), _scale_c(col, 0.6), -n)
    for k in range(seg):
        mb.face(bi, ring[(k + 1) % seg], ring[k])


def _ball(mb, c, r, col, col2, rng, n=(0, 0, 1), elong=1.25, spikes=0.25):
    """Low-poly bumpy ball (clover head, buds)."""
    c = Vector(c)
    rings, seg = 5, 8
    idx = []
    for i in range(rings + 1):
        th = math.pi * i / rings
        row = []
        for k in range(seg):
            ph = TAU * k / seg + (0.5 * TAU / seg if i % 2 else 0)
            d = Vector((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th) * elong))
            rr = r * (1 + spikes * (rng.random() - 0.3))
            colv = _lerp(col2, col, (math.cos(th) * 0.5 + 0.5) ** 0.7)
            row.append(mb.vert(c + d * rr, (0.5, 0.5), colv, d + Vector(n) * 0.6))
            if i in (0, rings):
                break
        idx.append(row)
    for i in range(rings):
        a, b = idx[i], idx[i + 1]
        if len(a) == 1:
            for k in range(seg):
                mb.face(a[0], b[k], b[(k + 1) % seg])
        elif len(b) == 1:
            for k in range(seg):
                mb.face(a[k], a[(k + 1) % seg], b[0])
        else:
            for k in range(seg):
                mb.face(a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k])


def _leaflet(mb, base, az, size, up, col, nf, heart=True):
    """Small rounded/heart leaf as a fan (clover leaflet, violet leaf)."""
    d = Vector((math.cos(az), math.sin(az), 0))
    side = Vector((-math.sin(az), math.cos(az), 0))
    z = Vector((0, 0, 1))
    fwd = (d * math.cos(up) + z * math.sin(up))
    pts = []
    for k in range(7):
        t = k / 6.0
        a = -math.pi * 0.5 + math.pi * t
        r = size * (0.75 + 0.25 * math.cos(a * 2)) if heart else size
        if heart and k == 3:
            r *= 0.8          # notch
        pts.append(Vector(base) + fwd * (r * math.cos(a) * 0.6 + size * 0.55) + side * r * math.sin(a))
    ci = mb.vert(base, (0.5, 0.1), _scale_c(col, 0.7), nf(base))
    ids = [mb.vert(p, (0.5, 0.5), col, nf(p)) for p in pts]
    mid = mb.vert(Vector(base) + fwd * size * 0.6, (0.5, 0.3), _scale_c(col, 1.15), nf(base))
    for k in range(6):
        mb.face(mid, ids[k], ids[k + 1])
    mb.face(ci, ids[0], mid)
    mb.face(ci, mid, ids[6])


def _daisy(rng, heads=2):
    mb = MB()
    nf = _dome_nf((0, 0, -0.35))
    for k in range(int(rng.integers(3, 6))):
        a = rng.uniform(0, TAU)
        _blade(mb, (0, 0, -0.005), rng.uniform(0.05, 0.1), rng.uniform(0.008, 0.013), a, rng.uniform(0.5, 0.9), 0.9, 3,
               G_ROOT, STEM, nf, (rng.random() * 0.9, 0.0))
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        h = rng.uniform(0.24, 0.46)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), h, a, rng.uniform(0.03, 0.2),
                    rng.uniform(0.1, 0.4), nf)
        c, u, v, n = _head_frame(pts, rng, 0.7)
        R = rng.uniform(0.026, 0.035)
        _petal_ring(mb, c, u, v, n, int(rng.integers(14, 19)), R * 0.28, R * 0.8, R * 0.26, rng.uniform(0.0, 0.25),
                    (0.9, 0.86, 0.72), DAISY, rng, notch=True)
        _dome(mb, c, u, v, n, R * 0.3, R * 0.16, DAISY_C, col_rim=(0.85, 0.5, 0.05))
    return mb


def _cornflower(rng, heads=2):
    mb = MB()
    nf = _dome_nf((0, 0, -0.35))
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        h = rng.uniform(0.28, 0.5)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), h, a, rng.uniform(0.04, 0.22),
                    rng.uniform(0.1, 0.5), nf, col=(0.14, 0.24, 0.10))
        for k in range(2):        # narrow leaves on the stem
            q = pts[int(rng.integers(1, 3))]
            _blade(mb, q, rng.uniform(0.05, 0.09), 0.006, rng.uniform(0, TAU), 0.7, 0.6, 3, STEM, (0.2, 0.3, 0.15), nf,
                   (rng.random() * 0.9, 0.0))
        c, u, v, n = _head_frame(pts, rng, 0.6)
        R = rng.uniform(0.02, 0.027)
        _dome(mb, c, u, v, n, R * 0.35, R * 0.35, (0.10, 0.12, 0.08), seg=6)       # green bract cup
        _petal_ring(mb, c + n * R * 0.25, u, v, n, int(rng.integers(8, 11)), R * 0.2, R * 0.85, R * 0.42,
                    rng.uniform(0.35, 0.6), _scale_c(CORN, 0.7), CORN, rng, notch=True, jag=0.25)
        _dome(mb, c + n * R * 0.3, u, v, n, R * 0.25, R * 0.2, CORN_C, seg=6)
    return mb


def _violet(rng, heads=3):
    mb = MB()
    nf = _dome_nf((0, 0, -0.2))
    for k in range(int(rng.integers(4, 7))):
        _leaflet(mb, Vector((0, 0, 0.005)), rng.uniform(0, TAU), rng.uniform(0.018, 0.03), rng.uniform(0.2, 0.6),
                 (0.08, 0.2, 0.06), nf)
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.008 * math.cos(a), 0.008 * math.sin(a), -0.01), rng.uniform(0.06, 0.12), a,
                    rng.uniform(0.2, 0.5), 1.2, nf, w=0.0025)
        c, u, v, n = _head_frame(pts, rng, 0.25)
        R = rng.uniform(0.014, 0.02)
        _petal_ring(mb, c, u, v, n, 5, R * 0.1, R, R * 0.75, 0.05, (0.85, 0.82, 0.9), VIOLET, rng, start=math.pi / 2)
        _dome(mb, c + n * 0.001, u, v, n, R * 0.18, R * 0.15, (1.0, 0.85, 0.3), seg=5)
    return mb


def _pink_clover(rng, heads=3, col=CLOVER_P, col2=(0.55, 0.22, 0.35), r_head=(0.012, 0.016), h=(0.14, 0.3),
                 leaf=(0.09, 0.22, 0.07)):
    mb = MB()
    nf = _dome_nf((0, 0, -0.25))
    for k in range(int(rng.integers(3, 6))):
        a = rng.uniform(0, TAU)
        base = Vector((0.02 * math.cos(a), 0.02 * math.sin(a), 0.0))
        pts = _blade(mb, base, rng.uniform(0.03, 0.07), 0.002, a, 0.3, 0.3, 2, STEM, STEM, nf, (0.5, 0.2))
        for j in range(3):
            _leaflet(mb, pts[-1], a + j * TAU / 3 + rng.normal(0, 0.2), rng.uniform(0.01, 0.015) * (r_head[0] / 0.01),
                     0.25, leaf, nf, heart=False)
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(*h), a,
                    rng.uniform(0.05, 0.3), rng.uniform(0.2, 0.6), nf, w=0.003)
        c, u, v, n = _head_frame(pts, rng, 0.8)
        r = rng.uniform(*r_head)
        _ball(mb, c + n * r * 0.8, r, col, col2, rng, n=n)
        for j in range(2):
            _leaflet(mb, c - n * 0.004, rng.uniform(0, TAU), 0.011, 0.1, (0.1, 0.24, 0.08), nf, heart=False)
    return mb


def _buttercup(rng, heads=3):
    mb = MB()
    nf = _dome_nf((0, 0, -0.35))
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(0.26, 0.46), a,
                    rng.uniform(0.05, 0.3), rng.uniform(0.2, 0.7), nf, w=0.0028)
        c, u, v, n = _head_frame(pts, rng, 0.85)
        R = rng.uniform(0.013, 0.018)
        _petal_ring(mb, c, u, v, n, 5, R * 0.15, R, R * 0.95, rng.uniform(0.5, 0.75), (0.95, 0.55, 0.03), BUTTER, rng)
        _dome(mb, c + n * R * 0.2, u, v, n, R * 0.25, R * 0.2, (0.7, 0.6, 0.1), seg=6)
    return mb


def _fern(rng, fronds=7, L_rng=(0.32, 0.62)):
    mb = MB()
    nf = _dome_nf((0, 0, -0.45))
    for f in range(fronds):
        a = TAU * f / fronds + rng.normal(0, 0.25)
        L = rng.uniform(*L_rng)
        tilt = rng.uniform(0.45, 0.95)
        pts = _blade(mb, (0.015 * math.cos(a), 0.015 * math.sin(a), -0.01), L, 0.006, a, tilt, rng.uniform(0.9, 1.6),
                     10, (0.05, 0.1, 0.03), (0.14, 0.26, 0.06), nf, (rng.random() * 0.9, 0.0), wshape=3.0, bulge=0.0)
        yel = rng.random() < 0.15
        npair = int(rng.integers(11, 16))
        for k in range(npair):
            t = 0.12 + 0.86 * k / npair
            i = min(int(t * (len(pts) - 1)), len(pts) - 2)
            q = pts[i].lerp(pts[i + 1], t * (len(pts) - 1) - i)
            tang = (pts[i + 1] - pts[i]).normalized()
            side = tang.cross(Vector((0, 0, 1)))
            if side.length < 1e-4:
                side = Vector((1, 0, 0))
            side.normalize()
            up = side.cross(tang).normalized()
            if up.z < 0:
                up = -up
            pl = 0.075 * L / 0.5 * math.sin(math.pi * (0.15 + 0.85 * t)) ** 0.8 * rng.uniform(0.85, 1.1)
            for sgn in (-1, 1):
                dirp = (side * sgn * 0.82 + tang * 0.5 - up * 0.18).normalized()
                w = pl * 0.28
                p_tip = q + dirp * pl
                wv = tang.cross(dirp).normalized() if tang.cross(dirp).length > 1e-4 else up
                c0 = (0.08, 0.19, 0.05) if not yel else (0.25, 0.25, 0.06)
                c1 = _scale_c(FERN_T, rng.uniform(0.85, 1.15)) if not yel else (0.55, 0.45, 0.12)
                i0 = mb.vert(q, (0.1, 0.0), c0, nf(q))
                i1 = mb.vert(q + dirp * pl * 0.4 + wv * w, (0.0, 0.2), _lerp(c0, c1, 0.5), nf(q))
                i2 = mb.vert(p_tip, (0.1, 0.4), c1, nf(p_tip))
                i3 = mb.vert(q + dirp * pl * 0.4 - wv * w, (0.2, 0.2), _lerp(c0, c1, 0.5), nf(q))
                mb.face(i0, i1, i2, i3)
    return mb


def _clover_patch(rng, leaves=24, r=0.16, flowers=2):
    mb = MB()
    nf = _dome_nf((0, 0, -0.25))
    for k in range(leaves):
        rr = r * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        base = Vector((rr * math.cos(a), rr * math.sin(a), -0.005))
        pts = _blade(mb, base, rng.uniform(0.025, 0.07), 0.0018, rng.uniform(0, TAU), rng.uniform(0.0, 0.35), 0.2, 2,
                     STEM, STEM, nf, (0.5, 0.2))
        base_az = rng.uniform(0, TAU)
        colv = _lerp((0.07, 0.18, 0.05), (0.15, 0.32, 0.09), rng.random())
        for j in range(3):
            _leaflet(mb, pts[-1], base_az + j * TAU / 3, rng.uniform(0.008, 0.012), rng.uniform(0.0, 0.3), colv, nf)
    for k in range(flowers):
        rr = r * 0.8 * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (rr * math.cos(a), rr * math.sin(a), -0.005), rng.uniform(0.06, 0.12), a, 0.1, 0.3, nf,
                    w=0.0022)
        _ball(mb, pts[-1] + Vector((0, 0, 0.006)), rng.uniform(0.007, 0.009), (0.95, 0.92, 0.88), (0.75, 0.6, 0.55),
              rng, elong=1.0)
    return mb


def _rock_mesh(name, coll, m, seed, sub=2, squash=0.55, amt=0.28, scale=0.9):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=1.0)
    o = bpy.context.active_object
    for c in o.users_collection:
        c.objects.unlink(o)
    coll.objects.link(o)
    o.name = name
    geo.displace_noise(o, amt, scale, seed=seed)
    me = o.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    co[:, 2] *= squash
    co[:, 2] += squash * 0.55
    rng = np.random.default_rng(seed)
    co[:, 0] *= rng.uniform(0.8, 1.25)
    me.vertices.foreach_set("co", co.ravel())
    me.update()
    me.shade_smooth()
    att = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.ones(len(me.vertices) * 4))
    me.uv_layers.new(name="UVMap")
    me.materials.append(m)
    return o


# ===================================================================== materials
def _inst_albedo(base=(1, 1, 1)):
    def f(nb, co):
        a = nb.n("ShaderNodeAttribute", attribute_name="col", attribute_type="GEOMETRY").outputs["Color"]
        b = nb.n("ShaderNodeAttribute", attribute_name="tint", attribute_type="INSTANCER").outputs["Color"]
        out = nb.mix(1.0, a, b, blend="MULTIPLY")
        if base != (1, 1, 1):
            out = nb.mix(1.0, out, base, blend="MULTIPLY")
        return out
    return f


def _lift(m, k):
    """Add k * albedo to the emitted colour: flowers keep reading as colour in moonlight (painter's cheat)."""
    nt = m.node_tree
    em = [n for n in nt.nodes if n.type == "EMISSION"][-1]
    hs = [n for n in nt.nodes if n.type == "HUE_SAT"][0]
    src = em.inputs["Color"].links[0].from_socket
    mx = nt.nodes.new("ShaderNodeMix")
    mx.data_type = "RGBA"
    mx.blend_type = "ADD"
    mx.inputs[0].default_value = k
    nt.links.new(src, mx.inputs[6])
    nt.links.new(hs.outputs[0], mx.inputs[7])
    nt.links.new(mx.outputs[2], em.inputs["Color"])
    mx.name = "Lift"
    return mx


def set_lift(k):
    """Re-grade the moonlight 'lift' of flowers (and, at 1/3, of grass) for the whole scene."""
    for nm, f in (("CoverFlower", 1.0), ("CoverGrass", 0.2)):
        m = bpy.data.materials.get(nm)
        if m and "Lift" in m.node_tree.nodes:
            m.node_tree.nodes["Lift"].inputs[0].default_value = k * f


def _fray(nb):
    """Brush-stroke alpha for blades/leaves: bristle gaps eat the edges, the tip runs dry."""
    uv = nb.n("ShaderNodeUVMap", uv_map="UVMap")
    ub = nb.n("ShaderNodeUVMap", uv_map="UVb")
    sep = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": ub.outputs[0]})
    across = nb.math("ABSOLUTE", nb.mul(nb.sub(sep.outputs[0], 0.5), 2.0))
    t = mat.tex_node(nb, "strokes_vert", uv.outputs[0], 2.0)
    br = nb.n("ShaderNodeSeparateColor", inputs={"Color": t.outputs["Color"]}).outputs[0]
    edge = nb.mapr(nb.add(across, nb.mul(nb.sub(br, 0.5), 1.4)), 1.0, 0.72)
    tip = nb.mapr(nb.add(sep.outputs[1], nb.mul(nb.sub(br, 0.5), 0.5)), 1.02, 0.86)
    return nb.mul(edge, tip)


def cover_mats():
    M = {}
    M["grass"] = bpy.data.materials.get("CoverGrass") or mat.painterly(
        "CoverGrass", (1, 1, 1), stroke="strokes_vert", scale=1.0, coord="UV", tex_amt=0.8, hue_jit=0.06, bump=0.0,
        breakup=1.3, wrap=0.3, translucent=0.35, albedo_fn=_inst_albedo(), backface=True, snow=0.0)
    if "Lift" not in M["grass"].node_tree.nodes:
        _lift(M["grass"], 0.02)
    # hero grass for close/foreground patches: the same strokes with frayed, dry-brush alpha edges (costlier)
    M["grass_hero"] = bpy.data.materials.get("CoverGrassHero") or mat.painterly(
        "CoverGrassHero", (1, 1, 1), stroke="strokes_vert", scale=1.0, coord="UV", tex_amt=0.8, hue_jit=0.06, bump=0.0,
        breakup=1.3, wrap=0.3, translucent=0.35, albedo_fn=_inst_albedo(), backface=True, snow=0.0,
        alpha_tex=_fray)
    if "Lift" not in M["grass_hero"].node_tree.nodes:
        _lift(M["grass_hero"], 0.02)
    M["flower"] = bpy.data.materials.get("CoverFlower") or mat.painterly(
        "CoverFlower", (1, 1, 1), stroke="strokes_fine", scale=1.5, coord="UV", tex_amt=0.45, hue_jit=0.04, bump=0.0,
        breakup=1.0, wrap=0.35, translucent=0.3, albedo_fn=_inst_albedo(), backface=True, snow=0.0)
    if "Lift" not in M["flower"].node_tree.nodes:
        _lift(M["flower"], 0.1)

    def moss_mask(nb, co):
        gn = nb.n("ShaderNodeNewGeometry")
        z = nb.n("ShaderNodeSeparateXYZ", inputs={"Vector": gn.outputs["Normal"]}).outputs[2]
        sp = mat.tex_node(nb, "sponge", co, 2.2)
        s = nb.n("ShaderNodeSeparateColor", inputs={"Color": sp.outputs["Color"]}).outputs[2]
        return nb.mul(nb.mapr(nb.add(z, nb.mul(nb.sub(s, 0.5), 1.1)), 0.45, 0.7), 0.85)

    def stone_albedo(nb, co):
        base = _inst_albedo((0.40, 0.39, 0.40))(nb, co)
        sp = mat.tex_node(nb, "sponge", co, 5.0)
        lich = nb.mapr(nb.n("ShaderNodeSeparateColor", inputs={"Color": sp.outputs["Color"]}).outputs[2], 0.62, 0.7)
        return nb.mix(nb.mul(lich, 0.8), base, (0.72, 0.68, 0.42))

    M["stone"] = bpy.data.materials.get("CoverStone") or mat.painterly(
        "CoverStone", (1, 1, 1), stroke="strokes_broad", scale=2.5, coord="Object", tex_amt=1.1, breakup=1.4,
        bump=0.3, color2=(0.10, 0.16, 0.05), color2_mask=moss_mask, albedo_fn=stone_albedo, snow=0.0)
    return M


# ===================================================================== prototype library
_LIB = None


def protos():
    """Build (once per scene) the prototype collection; returns dict kind -> list of proto indices."""
    global _LIB
    coll = bpy.data.collections.get(PROTO_COLL)
    if coll is not None and _LIB is not None and _LIB.get("_coll") == coll:
        return _LIB
    coll = bpy.data.collections.new(PROTO_COLL)
    bpy.context.scene.collection.children.link(coll)
    M = cover_mats()
    rng = np.random.default_rng(101)
    lib = {"_coll": coll}
    idx = [0]

    def add(kind, mb_or_obj, m):
        name = f"p{idx[0]:03d}_{kind}"
        if isinstance(mb_or_obj, MB):
            ob = mb_or_obj.build(name, coll, m)
        else:
            ob = mb_or_obj
            ob.name = name
        lib.setdefault(kind, []).append(idx[0])
        idx[0] += 1
        return ob

    # grass: hero clumps (fine, many blades) and far clumps (fewer, broader)
    pals = ["lush", "yellow", "blue", "olive"]
    for i in range(4):
        add("grass_s", _grass_clump(rng, 16, (0.08, 0.17), (0.010, 0.016), 0.06, segs=4, pal=pals[i]), M["grass"])
    for i in range(4):
        add("grass_m", _grass_clump(rng, 16, (0.16, 0.34), (0.012, 0.02), 0.08, segs=5, dry=0.08, pal=pals[i]),
            M["grass"])
    for i in range(2):
        add("grass_t", _grass_clump(rng, 12, (0.3, 0.52), (0.012, 0.02), 0.07, segs=6, dry=0.12, bend=(0.5, 1.5),
                                    pal=pals[i * 2 + 1]), M["grass"])
    for i in range(4):
        add("grass_far", _grass_clump(rng, 9, (0.18, 0.38), (0.025, 0.04), 0.13, segs=3, dry=0.08, pal=pals[i]),
            M["grass"])
    # hero copies (frayed alpha) of the short/medium clumps, for patches near the camera
    for src, dst in (("grass_s", "grass_s_h"), ("grass_m", "grass_m_h")):
        for i in list(lib[src]):
            o = [x for x in coll.objects if x.name.startswith(f"p{i:03d}_")][0]
            me = o.data.copy()
            me.materials.clear()
            me.materials.append(M["grass_hero"])
            ob = bpy.data.objects.new("tmp", me)
            coll.objects.link(ob)
            add(dst, ob, None)
    for i in range(3):
        add("seed", _seed_grass(rng, stems=int(rng.integers(1, 4))), M["grass"])
    for i in range(3):
        add("fern", _fern(rng, fronds=int(rng.integers(5, 8))), M["grass"])
    for i in range(2):
        add("clover", _clover_patch(rng, leaves=int(rng.integers(20, 30)), flowers=int(rng.integers(1, 4))), M["grass"])
    for i in range(3):
        add("daisy", _daisy(rng, heads=int(rng.integers(1, 4))), M["flower"])
    for i in range(2):
        add("corn", _cornflower(rng, heads=int(rng.integers(1, 3))), M["flower"])
    for i in range(2):
        add("violet", _violet(rng, heads=int(rng.integers(2, 4))), M["flower"])
    for i in range(2):
        add("pclover", _pink_clover(rng, heads=int(rng.integers(2, 4))), M["flower"])
    for i in range(2):
        add("butter", _buttercup(rng, heads=int(rng.integers(2, 4))), M["flower"])
    for i in range(2):     # window-box geraniums (coral-red balls of florets, round leaves)
        add("geranium", _pink_clover(rng, heads=int(rng.integers(3, 5)), col=(0.95, 0.16, 0.10), col2=(0.5, 0.06, 0.05),
                                     r_head=(0.022, 0.03), h=(0.1, 0.18), leaf=(0.07, 0.2, 0.05)), M["flower"])
    for i in range(5):
        add("stone", _rock_mesh("stone", coll, M["stone"], seed=300 + i, sub=2, squash=rng.uniform(0.45, 0.7)), None)
    for i in range(3):
        add("pebble", _rock_mesh("pebble", coll, M["stone"], seed=400 + i, sub=1, squash=0.5, amt=0.2), None)
    # prototypes must not render where they stand (origin): exclude the collection from the view layer
    lc = bpy.context.view_layer.layer_collection.children.get(PROTO_COLL)
    if lc:
        lc.exclude = True
    _LIB = lib
    return lib


# ===================================================================== geometry nodes
class GB:
    """Tiny geometry-node builder."""

    def __init__(self, tree):
        self.t, self.N, self.L = tree, tree.nodes, tree.links

    def n(self, kind, **props):
        node = self.N.new(kind)
        for k, v in props.items():
            setattr(node, k, v)
        return node

    def set(self, node, key, val):
        sock = node.inputs[key]
        if isinstance(val, bpy.types.NodeSocket):
            self.L.new(val, sock)
        elif isinstance(val, bpy.types.Node):
            self.L.new(val.outputs[0], sock)
        else:
            sock.default_value = val

    def math(self, op, a, b=0.0, c=0.0):
        m = self.n("ShaderNodeMath", operation=op)
        for i, v in enumerate((a, b, c)):
            self.set(m, i, v)
        return m.outputs[0]

    def add(self, a, b): return self.math("ADD", a, b)
    def mul(self, a, b): return self.math("MULTIPLY", a, b)
    def sub(self, a, b): return self.math("SUBTRACT", a, b)

    def madd(self, a, b, c):
        return self.math("MULTIPLY_ADD", a, b, c)

    def vm(self, op, a, b=None, scale=None):
        m = self.n("ShaderNodeVectorMath", operation=op)
        self.set(m, 0, a)
        if b is not None:
            self.set(m, 1, b)
        if scale is not None:
            self.set(m, 3, scale)
        return m.outputs[1] if op in ("DOT_PRODUCT", "LENGTH", "DISTANCE") else m.outputs[0]

    def xyz(self, x=0.0, y=0.0, z=0.0):
        c = self.n("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.set(c, i, v)
        return c.outputs[0]

    def sep(self, v):
        s = self.n("ShaderNodeSeparateXYZ")
        self.set(s, 0, v)
        return s.outputs

    def attr(self, name, dtype="FLOAT"):
        a = self.n("GeometryNodeInputNamedAttribute", data_type=dtype)
        a.inputs["Name"].default_value = name
        return a.outputs[0]

    def mapr(self, v, a, b, c=0.0, d=1.0, interp="SMOOTHSTEP"):
        m = self.n("ShaderNodeMapRange", interpolation_type=interp, clamp=True)
        self.set(m, 0, v)
        for i, x in zip((1, 2, 3, 4), (a, b, c, d)):
            self.set(m, i, x)
        return m.outputs[0]

    def noise(self, vec, scale=1.0, detail=1.0):
        n = self.n("ShaderNodeTexNoise", noise_dimensions="3D")
        self.set(n, "Vector", vec)
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        return n.outputs[0]

    def rand(self, lo=0.0, hi=1.0, seed=0):
        r = self.n("FunctionNodeRandomValue", data_type="FLOAT")
        r.inputs[2].default_value = lo
        r.inputs[3].default_value = hi
        r.inputs[8].default_value = seed
        return r.outputs[1]


def wind_lean(G, pos, flex, rnd):
    """World-space lean vector (top of a plant tilts toward it, |v| = angle in radians) for breeze + gusts, read from
    the LU_Wind empty (see foliage.wind)."""
    from . import foliage
    W = foliage.wind()
    oi = G.n("GeometryNodeObjectInfo", transform_space="ORIGINAL")
    oi.inputs["Object"].default_value = W
    gust, front, breeze = G.sep(oi.outputs["Location"])
    lam = G.sep(oi.outputs["Scale"])[0]
    td = G.n("FunctionNodeTransformDirection")
    G.set(td, "Direction", (1.0, 0.0, 0.0))
    G.set(td, "Transform", oi.outputs["Transform"])
    dx, dy, _ = G.sep(td.outputs[0])
    dirv = G.vm("NORMALIZE", G.xyz(dx, dy, 0.0))
    perp = G.vm("NORMALIZE", G.xyz(G.mul(dy, -1.0), dx, 0.0))
    t = G.n("GeometryNodeInputSceneTime").outputs["Seconds"]
    s = G.vm("DOT_PRODUCT", pos, dirv)
    ph = G.mul(rnd, TAU)
    # breeze: travelling sine + drifting noise
    w1 = G.math("SINE", G.add(G.sub(G.mul(t, 1.9), G.mul(s, 0.55)), ph))
    drift = G.vm("SUBTRACT", G.vm("SCALE", pos, scale=0.22), G.vm("SCALE", dirv, scale=G.mul(t, 0.8)))
    n1 = G.mul(G.sub(G.noise(drift, 1.0, 1.0), 0.5), 3.0)
    n2 = G.mul(G.sub(G.noise(G.vm("ADD", drift, (13.1, 7.7, 3.3)), 1.0, 1.0), 0.5), 3.0)
    bz = G.mul(breeze, flex)
    b_amt = G.mul(bz, G.add(G.add(0.045, G.mul(w1, 0.04)), G.mul(n1, 0.06)))
    # gust: rolling bands behind a travelling front
    u = G.sub(front, s)
    mask = G.mapr(u, -0.4, 2.5)
    band = G.math("POWER", G.add(0.5, G.mul(G.math("COSINE", G.math("DIVIDE", G.mul(u, TAU), G.math("MAXIMUM", lam, 0.5))), 0.5)), 2.0)
    gz = G.mul(G.mul(gust, flex), mask)
    g_amt = G.mul(gz, G.add(0.3, G.mul(band, 0.55)))
    flutter = G.mul(gz, G.mul(0.07, G.math("SINE", G.add(G.add(G.mul(t, 13.0), G.mul(s, 6.0)), ph))))
    along = G.add(G.add(b_amt, g_amt), flutter)
    across = G.mul(n2, G.add(G.mul(bz, 0.035), G.mul(gz, 0.09)))
    return G.vm("ADD", G.vm("SCALE", dirv, scale=along), G.vm("SCALE", perp, scale=across))


def cover_group():
    name = "LU_CoverGN"
    g = bpy.data.node_groups.get(name)
    if g:
        return g
    lib = protos()
    g = bpy.data.node_groups.new(name, "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    G = GB(g)
    gi = G.n("NodeGroupInput")
    go = G.n("NodeGroupOutput")
    ci = G.n("GeometryNodeCollectionInfo", transform_space="ORIGINAL")
    ci.inputs["Collection"].default_value = lib["_coll"]
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    iop = G.n("GeometryNodeInstanceOnPoints")
    G.set(iop, "Points", gi.outputs[0])
    G.set(iop, "Instance", ci.outputs[0])
    iop.inputs["Pick Instance"].default_value = True
    G.set(iop, "Instance Index", G.attr("proto", "INT"))
    e2r = G.n("FunctionNodeEulerToRotation")
    G.set(e2r, 0, G.attr("rot", "FLOAT_VECTOR"))
    G.set(iop, "Rotation", e2r.outputs[0])
    sc = G.attr("scale", "FLOAT")
    G.set(iop, "Scale", G.xyz(sc, sc, sc))
    # wind + static lean, applied in world space around each plant's base
    pos = G.n("GeometryNodeInputPosition").outputs[0]
    lean = G.vm("ADD", wind_lean(G, pos, G.attr("flex", "FLOAT"), G.rand(0, 1, 11)), G.attr("lean", "FLOAT_VECTOR"))
    lx, ly, _ = G.sep(lean)
    axis = G.vm("NORMALIZE", G.xyz(G.sub(-1e-5, ly), lx, 0.0))
    ang = G.vm("LENGTH", G.xyz(lx, ly, 0.0))
    aa = G.n("FunctionNodeAxisAngleToRotation")
    G.set(aa, "Axis", axis)
    G.set(aa, "Angle", ang)
    ri = G.n("GeometryNodeRotateInstances")
    G.set(ri, "Instances", iop.outputs[0])
    G.set(ri, "Rotation", aa.outputs[0])
    G.set(ri, "Pivot Point", pos)
    ri.inputs["Local Space"].default_value = False
    G.set(go, 0, ri.outputs[0])
    return g


# ===================================================================== point clouds
ATTRS = (("proto", "INT", 1), ("rot", "FLOAT_VECTOR", 3), ("scale", "FLOAT", 1), ("tint", "FLOAT_COLOR", 4),
         ("flex", "FLOAT", 1), ("lean", "FLOAT_VECTOR", 3))


def _cloud(name, P, collection=None):
    """P: dict of numpy arrays (co (n,3), proto, rot (n,3), scale, tint (n,3), flex, lean (n,3)) -> point object
    instanced by LU_CoverGN."""
    col = collection or geo.coll("Meadow")
    n = len(P["co"])
    me = bpy.data.meshes.new(name)
    me.vertices.add(n)
    me.vertices.foreach_set("co", np.asarray(P["co"], dtype=np.float32).ravel())
    for an, at, k in ATTRS:
        a = me.attributes.new(an, at, "POINT")
        v = np.asarray(P[an])
        if an == "tint":
            v = np.concatenate([v, np.ones((n, 1))], 1)
        key = "value" if k == 1 else ("color" if at == "FLOAT_COLOR" else "vector")
        a.data.foreach_set(key, v.astype(np.int32 if at == "INT" else np.float32).ravel())
    me.update()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    mod = ob.modifiers.new("Cover", "NODES")
    mod.node_group = cover_group()
    return ob


def _read(ob):
    me = ob.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    P = {"co": co.reshape(-1, 3)}
    for an, at, k in ATTRS:
        a = me.attributes[an]
        kk = 4 if at == "FLOAT_COLOR" else k
        buf = np.empty(n * kk, dtype=np.int32 if at == "INT" else np.float32)
        a.data.foreach_get("value" if k == 1 else ("color" if at == "FLOAT_COLOR" else "vector"), buf)
        P[an] = buf.reshape(-1, kk)[:, :3] if kk > 1 else buf
    return P


def _write(ob, P, keep=None):
    """Rewrite a cloud (optionally keeping only mask `keep`)."""
    if keep is not None:
        P = {k: v[keep] for k, v in P.items()}
    me = ob.data
    nm = me.name
    new = bpy.data.meshes.new(nm + "_")
    n = len(P["co"])
    new.vertices.add(n)
    new.vertices.foreach_set("co", np.asarray(P["co"], dtype=np.float32).ravel())
    for an, at, k in ATTRS:
        a = new.attributes.new(an, at, "POINT")
        v = np.asarray(P[an])
        if an == "tint":
            v = np.concatenate([v[:, :3], np.ones((n, 1))], 1)
        a.data.foreach_set("value" if k == 1 else ("color" if at == "FLOAT_COLOR" else "vector"),
                           v.astype(np.int32 if at == "INT" else np.float32).ravel())
    new.update()
    ob.data = new
    bpy.data.meshes.remove(me)
    new.name = nm


def clouds(prefix=("Meadow",)):
    return [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith(tuple(prefix))
            and o.modifiers.get("Cover")]


# ===================================================================== scatter
def _grid(x0, x1, y0, y1, spacing, rng):
    xs = np.arange(x0, x1, spacing)
    ys = np.arange(y0, y1, spacing)
    X, Y = np.meshgrid(xs, ys)
    X = X.ravel() + rng.uniform(-0.5, 0.5, X.size) * spacing
    Y = Y.ravel() + rng.uniform(-0.5, 0.5, Y.size) * spacing
    return X, Y


def _thin(X, Y, dens, spacing, rng):
    keep = rng.random(X.size) < np.clip(dens * spacing * spacing, 0, 1)
    return X[keep], Y[keep]


def _choose(rng, kinds, lib, n):
    """Random prototype index for each of n points from the list of kinds (uniform over their variants)."""
    pool = np.array(sum((lib[k] for k in kinds), []))
    return pool[rng.integers(0, len(pool), n)]


def _tints(x, y, rng, n, val=0.14, hue=0.5, seed=0):
    """Per-instance colour multiplier: broad painterly value/hue patches (2-4 m), smaller dab clusters (~0.5 m) and
    per-plant jitter."""
    nv = 0.65 * _noise(x, y, 40 + seed, 0.45) + 0.35 * _noise(x, y, 45 + seed, 1.9)
    nh = _noise(x, y, 50 + seed, 0.3) + 0.4 * _noise(x, y, 55 + seed, 1.4)
    v = 1.0 + val * nv * 1.6 + rng.normal(0, 0.06, n)
    warm = np.clip(nh, 0, 1)[:, None] * hue
    cool = np.clip(-nh, 0, 1)[:, None] * hue
    t = np.ones((n, 3)) * v[:, None]
    t = t * (1 + warm * 0.45 * (np.array([1.35, 1.1, 0.55]) - 1))
    t = t * (1 + cool * 0.45 * (np.array([0.75, 0.98, 1.3]) - 1))
    return np.clip(t, 0.3, 1.7)


def _pick_pal(lib, kind, X, Y, rng, seed=73):
    """Palette variants of a 4-palette grass kind chosen by a noise field (cool -> warm), so palettes form patches."""
    order = [2, 0, 3, 1]                    # blue, lush, olive, yellow
    nz = _noise(X, Y, seed, 0.6) * 0.5 + 0.5 + rng.normal(0, 0.18, len(X))
    k = np.clip((nz * 4).astype(int), 0, 3)
    ids = np.array(lib[kind])[np.array(order)]
    return ids[k]


def _pack(lib, X, Y, protos_, scale, flex, tint, rng, tilt=0.08, zoff=0.0):
    n = len(X)
    Z = terrain.height(X, Y) + zoff
    rot = np.stack([rng.normal(0, tilt, n), rng.normal(0, tilt, n), rng.uniform(0, TAU, n)], 1)
    return dict(co=np.stack([X, Y, Z], 1), proto=protos_.astype(np.int32), rot=rot, scale=scale,
                tint=tint, flex=flex, lean=np.zeros((n, 3)))


def _cat(parts):
    parts = [p for p in parts if p is not None and len(p["co"])]
    return {k: np.concatenate([p[k] for p in parts], 0) for k in parts[0]}


def meadow(detail=1.0, keep_clear=(), keep_rects=(), seed=7, name="MeadowCover", collection=None, R=25.5):
    """Scatter the whole plateau's ground cover. keep_clear: [(x, y, r)] circles left bare (props, trunks, rocks);
    keep_rects: [(x0, x1, y0, y1)] bare rectangles (the garden bed)."""
    lib = protos()
    rng = np.random.default_rng(seed)
    parts = []
    dw_min = 3.95                                  # stone base footprint (+ a hair)

    def base_mask(X, Y):
        r = np.hypot(X, Y)
        dw = np.hypot(X - WM[0], Y - WM[1])
        ok = (r < R) & (dw > dw_min)
        for (kx, ky, kr) in keep_clear:
            ok &= np.hypot(X - kx, Y - ky) > kr
        for (x0, x1, y0, y1) in keep_rects:
            ok &= ~((X > x0) & (X < x1) & (Y > y0) & (Y < y1))
        return ok

    lie = np.array(layout.LIE)

    def lie_d(X, Y):
        return np.hypot(X - lie[0], Y - lie[1])

    # ---------------- grass
    sp = 0.135 / math.sqrt(detail)
    X, Y = _grid(-R, R, -R, R, sp, rng)
    m = base_mask(X, Y)
    X, Y = X[m], Y[m]
    h = hero(X, Y)
    pd = path_dist(X, Y)
    r = np.hypot(X, Y)
    thin = 0.55 + 0.45 * _ss(-0.6, 0.4, _noise(X, Y, 61, 0.7))                 # bare-ish patches
    dens = (7.0 + 44.0 * h) * thin * (1 - _ss(R - 4, R, r))
    dens *= _ss(0.38, 0.75, pd)                                                   # worn path
    X, Y = _thin(X, Y, dens, sp, rng)
    n = X.size
    h = hero(X, Y)
    pd = path_dist(X, Y)
    tall = _noise(X, Y, 62, 0.35)                                                 # tall/short grass areas
    near = rng.random(n) < (0.15 + 0.85 * h)
    pr = np.where(near, _pick_pal(lib, "grass_m", X, Y, rng), _pick_pal(lib, "grass_far", X, Y, rng))
    short = (tall < -0.25) | (pd < 1.1) | (lie_d(X, Y) < 1.9)
    pr = np.where(short & near, _pick_pal(lib, "grass_s", X, Y, rng), pr)
    tl = (tall > 0.35) & near & (rng.random(n) < 0.5) & (lie_d(X, Y) > 2.2)
    pr = np.where(tl, _choose(rng, ["grass_t"], lib, n), pr)
    sc = rng.uniform(0.8, 1.25, n) * (1 + 0.18 * tall)
    sc = np.where(pd < 1.1, sc * (0.55 + 0.45 * _ss(0.4, 1.1, pd)), sc)
    sc = np.where(lie_d(X, Y) < 1.9, sc * 0.75, sc)
    parts.append(_pack(lib, X, Y, pr, sc, np.full(n, 1.0) * rng.uniform(0.8, 1.2, n),
                       _tints(X, Y, rng, n, 0.26, 0.8, 0), rng, tilt=0.07))

    # ---------------- tall seed-head grass (drifts; edges of the meadow and the path)
    sp = 0.35
    X, Y = _grid(-R, R, -R, R, sp, rng)
    m = base_mask(X, Y)
    X, Y = X[m], Y[m]
    nz = _noise(X, Y, 63, 0.4)
    r = np.hypot(X, Y)
    dens = 3.2 * _ss(0.05, 0.6, nz) * (0.5 + 0.5 * hero(X, Y)) * (1 - _ss(R - 3, R, r))
    dens += 2.0 * (1 - _ss(1.0, 2.2, path_dist(X, Y))) * _ss(0.6, 1.0, path_dist(X, Y))
    dens *= _ss(1.6, 2.6, lie_d(X, Y)) * _ss(1.6, 2.4, np.hypot(X - layout.CRATER[0], Y - layout.CRATER[1]))
    X, Y = _thin(X, Y, dens, sp, rng)
    n = X.size
    parts.append(_pack(lib, X, Y, _choose(rng, ["seed"], lib, n), rng.uniform(0.75, 1.2, n), np.full(n, 1.5),
                       _tints(X, Y, rng, n, 0.12, 0.3, 1), rng, tilt=0.1))

    # ---------------- wildflowers: drifts by species
    sp = 0.085 / math.sqrt(detail)
    X, Y = _grid(-R, R, -R, R, sp, rng)
    m = base_mask(X, Y) & (path_dist(X, Y) > 0.5)
    X, Y = X[m], Y[m]
    h = hero(X, Y)
    r = np.hypot(X, Y)
    drift = _ss(-0.45, 0.55, _noise(X, Y, 64, 0.55))
    bed = 1 - _ss(1.0, 2.4, lie_d(X, Y))                                         # the flower bed they lie in
    dens = (2.5 + 30.0 * h * drift + 85.0 * bed) * (1 - _ss(R - 5, R - 1, r))
    X, Y = _thin(X, Y, dens, sp, rng)
    n = X.size
    bedw = 1 - _ss(1.2, 2.6, lie_d(X, Y))
    w = np.stack([
        0.7 + _noise(X, Y, 65, 0.5) + 0.25 * bedw,                                       # daisy
        0.3 + _noise(X, Y, 66, 0.6) + 0.3 * bedw,                                        # cornflower
        0.05 + _noise(X, Y, 67, 0.7) + 0.8 * (np.hypot(X - WM[0], Y - WM[1]) < 5.6) + 0.3 * bedw,   # violet
        0.4 + _noise(X, Y, 68, 0.5) + 0.6 * (path_dist(X, Y) < 2.0) + 0.6 * bedw,       # pink clover
        0.1 + _noise(X, Y, 69, 0.6) + 0.55 * bedw,                                       # buttercup
    ], 1)
    # small-scale clustering (~0.8 m): species grow in dabs of one colour, like the reference's flower splatters
    w = w + 0.75 * np.stack([_noise(X, Y, 80 + i, 1.8) for i in range(5)], 1)
    w = np.clip(w, 0.02, None) * rng.uniform(0.6, 1.4, (n, 5))
    sp_i = np.argmax(w, 1)
    kinds = ["daisy", "corn", "violet", "pclover", "butter"]
    pr = np.zeros(n, dtype=np.int32)
    for i, k in enumerate(kinds):
        sel = sp_i == i
        pr[sel] = _choose(rng, [k], lib, int(sel.sum()))
    sc = rng.uniform(0.85, 1.2, n)
    sc = np.where(lie_d(X, Y) < 2.0, sc * (0.62 + 0.25 * _ss(0.6, 2.0, lie_d(X, Y))), sc)
    tint = np.clip(1 + rng.normal(0, 0.07, (n, 1)) * np.ones((1, 3)), 0.7, 1.3)
    parts.append(_pack(lib, X, Y, pr, sc, np.full(n, 0.85), tint, rng, tilt=0.12))

    # ---------------- ferns (pine edges, rocks, the shady north-west of the mill)
    sp = 0.5
    X, Y = _grid(-R, R, -R, R, sp, rng)
    m = base_mask(X, Y)
    X, Y = X[m], Y[m]
    from . import world as _w
    near = np.zeros(X.size)
    for (px, py, ph) in _w.all_pines():
        near = np.maximum(near, 1 - _ss(1.2, 4.5, np.hypot(X - px, Y - py)))
    for (px, py, ps) in _w.ROCKS:
        near = np.maximum(near, 1 - _ss(ps * 0.9, ps * 2.4, np.hypot(X - px, Y - py)))
    dwv = np.hypot(X - WM[0], Y - WM[1])
    near = np.maximum(near, (1 - _ss(4.4, 6.5, dwv)) * _ss(-0.3, 0.6, (Y - WM[1]) / 4.0 - (X - WM[0]) / 4.0))
    rr = np.hypot(X, Y)
    near = np.maximum(near, _ss(16.0, 20.0, rr) * 0.45 * _ss(0, 0.6, _noise(X, Y, 70, 0.5)))
    dens = 1.8 * near * _ss(2.4, 3.4, lie_d(X, Y)) * _ss(0.8, 1.5, path_dist(X, Y))
    X, Y = _thin(X, Y, dens, sp, rng)
    n = X.size
    parts.append(_pack(lib, X, Y, _choose(rng, ["fern"], lib, n), rng.uniform(0.7, 1.3, n), np.full(n, 0.45),
                       _tints(X, Y, rng, n, 0.12, 0.3, 2), rng, tilt=0.12))

    # ---------------- clover patches (path verges, around the mill, sprinkled in the meadow)
    sp = 0.3
    X, Y = _grid(-R, R, -R, R, sp, rng)
    m = base_mask(X, Y) & (path_dist(X, Y) > 0.32)
    X, Y = X[m], Y[m]
    pd = path_dist(X, Y)
    dwv = np.hypot(X - WM[0], Y - WM[1])
    dens = (1.2 + 6.0 * (1 - _ss(0.5, 1.6, pd)) + 3.0 * (1 - _ss(4.2, 6.0, dwv))) * _ss(0.1, 0.8, _noise(X, Y, 71, 0.8))
    dens *= hero(X, Y) * 0.8 + 0.2
    dens += 3.5 * (1 - _ss(1.0, 1.9, lie_d(X, Y)))
    X, Y = _thin(X, Y, dens, sp, rng)
    n = X.size
    parts.append(_pack(lib, X, Y, _choose(rng, ["clover"], lib, n), rng.uniform(0.8, 1.3, n), np.full(n, 0.25),
                       _tints(X, Y, rng, n, 0.1, 0.2, 3), rng, tilt=0.03))

    # ---------------- mossy stones (path edges, mill skirt, a few in the meadow)
    sp = 0.6
    X, Y = _grid(-R, R, -R, R, sp, rng)
    m = base_mask(X, Y)
    X, Y = X[m], Y[m]
    pd = path_dist(X, Y)
    dwv = np.hypot(X - WM[0], Y - WM[1])
    dens = 0.08 + 0.9 * (1 - _ss(0.5, 1.2, pd)) * _ss(0.3, 0.5, pd) + 0.5 * (1 - _ss(4.0, 5.0, dwv))
    dens *= _ss(2.2, 3.0, lie_d(X, Y)) * _ss(2.0, 2.8, np.hypot(X - layout.CRATER[0], Y - layout.CRATER[1]))
    X, Y = _thin(X, Y, dens, sp, rng)
    n = X.size
    st = dict(_pack(lib, X, Y, _choose(rng, ["stone"], lib, n), rng.uniform(0.07, 0.28, n) ** 1.0, np.zeros(n),
                    _tints(X, Y, rng, n, 0.12, 0.2, 4), rng, tilt=0.15, zoff=-0.03))
    parts.append(st)

    # ---------------- pebbles on the worn path
    sp = 0.16
    X, Y = _grid(-6, 6, -22, 4.0, sp, rng)
    pd = path_dist(X, Y)
    dens = 9.0 * (1 - _ss(0.25, 0.55, pd)) * _ss(0.0, 0.7, _noise(X, Y, 72, 1.3) + 0.4)
    X, Y = _thin(X, Y, dens, sp, rng)
    n = X.size
    parts.append(_pack(lib, X, Y, _choose(rng, ["pebble"], lib, n), rng.uniform(0.015, 0.05, n), np.zeros(n),
                       np.clip(0.9 + rng.normal(0, 0.12, (n, 1)) * np.ones((1, 3)), 0.6, 1.3), rng, tilt=0.3,
                       zoff=-0.008))
    P = _cat(parts)
    return _cloud(name, P, collection)


def patch(center, radius, count=1500, flowers=0.25, seed=5, name=None, scale=1.0, short=False, collection=None,
          kinds=None):
    """Extra-dense hero cover (close or foreground shots). count = grass clumps; flowers = flower fraction."""
    lib = protos()
    rng = np.random.default_rng(seed)
    cx, cy = center
    rr = radius * np.sqrt(rng.random(count))
    a = rng.uniform(0, TAU, count)
    X, Y = cx + rr * np.cos(a), cy + rr * np.sin(a)
    dw = np.hypot(X - WM[0], Y - WM[1])
    ok = (dw > 3.95) & (path_dist(X, Y) > 0.42)
    X, Y = X[ok], Y[ok]
    n = X.size
    isfl = rng.random(n) < flowers
    g_kinds = kinds or (["grass_s_h"] if short else ["grass_s_h", "grass_m_h", "grass_m_h"])
    pr = np.where(isfl, _choose(rng, ["daisy", "corn", "pclover", "violet", "butter", "daisy"], lib, n),
                  _choose(rng, g_kinds, lib, n))
    sc = rng.uniform(0.8, 1.2, n) * scale
    tint = np.where(isfl[:, None], 1.0, _tints(X, Y, rng, n, 0.16, 0.6, 0))
    P = _pack(lib, X, Y, pr, sc, np.where(isfl, 0.85, 1.0), tint, rng, tilt=0.08)
    return _cloud(name or f"MeadowPatch{seed}", P, collection)


# ===================================================================== per-shot culling
def cull(f0=None, f1=None, cams=None, margin=0.12, far=70.0, step=4, keep_radius=2.0, prefix=("Meadow",)):
    """Drop cover instances no camera of the shot can see (outside every sampled frustum, with a margin, or farther
    than `far`); a big render-time saving for close shots. Call at the end of a shot's make(), after the camera is
    animated. cams: list of camera objects (default: the scene camera + any camera bound to timeline markers).
    Instances within keep_radius of a camera are always kept (shadows/DOF foreground)."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    f0 = sc.frame_start if f0 is None else f0
    f1 = sc.frame_end if f1 is None else f1
    if cams is None:
        cams = {sc.camera} if sc.camera else set()
        cams |= {m.camera for m in sc.timeline_markers if m.camera}
        cams = [c for c in cams if c]
    if not cams:
        return 0
    cur = sc.frame_current
    views = []
    for f in list(range(f0, f1 + 1, step)) + [f1]:
        sc.frame_set(f)
        for c in cams:
            mw = c.matrix_world.copy()
            cd = c.data
            views.append((mw, cd.lens, cd.sensor_width, cd.shift_x, cd.shift_y))
    sc.frame_set(cur)
    rx, ry = sc.render.resolution_x, sc.render.resolution_y
    aspect = ry / rx
    removed = 0
    for ob in clouds(prefix):
        P = _read(ob)
        co = P["co"].astype(np.float64)
        n = len(co)
        vis = np.zeros(n, dtype=bool)
        homo = np.concatenate([co, np.ones((n, 1))], 1)
        for (mw, lens, sw, sx, sy) in views:
            inv = np.array(mw.inverted())
            pc = homo @ inv.T                        # camera space: looks down -Z
            z = -pc[:, 2]
            d = np.linalg.norm(pc[:, :3], axis=1)
            fx = lens / sw                           # horizontal: x/z in [-0.5, 0.5] * (sw/lens)
            with np.errstate(divide="ignore", invalid="ignore"):
                u = pc[:, 0] / np.maximum(z, 1e-3) * fx - sx
                v = pc[:, 1] / np.maximum(z, 1e-3) * fx - sy
            m = 0.5 + margin
            ok = (z > -0.5) & (np.abs(u) < m) & (np.abs(v) < aspect * 0.5 + margin) & (d < far)
            ok |= d < keep_radius
            vis |= ok
        if not vis.all():
            removed += int((~vis).sum())
            _write(ob, P, vis)
    return removed


# ===================================================================== edits (mow / flatten / burn)
def mow(center, radius, prefix=("Meadow",), keep_stones=False):
    """Remove cover instances whose base lies within radius of center (xy)."""
    c = np.array(center[:2], dtype=float)
    for ob in clouds(prefix):
        P = _read(ob)
        d = np.hypot(P["co"][:, 0] - c[0], P["co"][:, 1] - c[1])
        keep = d >= radius
        if keep_stones:
            keep |= P["flex"] == 0
        if not keep.all():
            _write(ob, P, keep)


def flatten(center, radius, burn_radius=0.0, angle=1.25, prefix=("Meadow",), burnt=(0.10, 0.065, 0.045),
            scorch=(0.42, 0.33, 0.2)):
    """Lay cover flat, radially outward from center (impact / tumble), up to radius; within burn_radius it is burnt
    (dark char at the centre, scorched straw at the rim)."""
    c = np.array(center[:2], dtype=float)
    for ob in clouds(prefix):
        P = _read(ob)
        dx = P["co"][:, 0] - c[0]
        dy = P["co"][:, 1] - c[1]
        d = np.hypot(dx, dy)
        sel = d < radius
        if not sel.any():
            continue
        f = (1 - _ss(radius * 0.45, radius, d)) * (P["flex"] > 0)
        ux, uy = dx / np.maximum(d, 1e-4), dy / np.maximum(d, 1e-4)
        P["lean"][:, 0] = np.where(sel, ux * angle * f, P["lean"][:, 0])
        P["lean"][:, 1] = np.where(sel, uy * angle * f, P["lean"][:, 1])
        if burn_radius > 0:
            b = 1 - _ss(burn_radius * 0.55, burn_radius, d)
            s = (1 - _ss(burn_radius * 0.9, burn_radius * 1.5, d)) * (1 - b)
            t = P["tint"]
            t = t * (1 - b[:, None]) + np.array(burnt)[None, :] * 2.2 * b[:, None]
            t = t * (1 - s[:, None] * 0.6) + np.array(scorch)[None, :] * 2.0 * s[:, None] * 0.6
            P["tint"] = t
        P["flex"] = np.where(sel, P["flex"] * (1 - 0.8 * f), P["flex"])
        _write(ob, P)


# ===================================================================== the miller's yard
def _log(name, r, L, col, M, end_m):
    o = geo.lathe(name, [(0.0, -L / 2), (r * 0.97, -L / 2), (r, -L / 2 + 0.02), (r, L / 2 - 0.02), (r * 0.97, L / 2),
                         (0.0, L / 2)], seg=10, collection=col, mat=M["wood"], jitter=0.04, seed=hash(name) % 997)
    o.data.materials.append(end_m)
    for p in o.data.polygons:
        if abs(p.normal.z) > 0.7:
            p.material_index = 1
    return o


def _end_mat():
    return bpy.data.materials.get("LogEnd") or mat.painterly(
        "LogEnd", (0.62, 0.48, 0.30), stroke="strokes_fine", scale=8.0, tex_amt=1.0, breakup=1.2, bump=0.2,
        color2=(0.45, 0.30, 0.18), ao=0.4, snow=0.0)


def _barrel(name, col, M, h=0.9, r=0.4, water=False):
    prof = [(r * 0.84, 0.0), (r * 0.94, h * 0.22), (r, h * 0.5), (r * 0.94, h * 0.78), (r * 0.84, h)]
    parts = [geo.lathe(name + "_staves", prof, seg=20, collection=col, mat=M["wood"], cap_bot=True, cap_top=False)]
    for t in (0.1, 0.32, 0.68, 0.9):
        z = h * t
        rr = r * (0.84 + 0.16 * math.sin(math.pi * t)) + 0.012
        parts.append(geo.lathe(name + "_hoop", [(rr, z - 0.025), (rr + 0.006, z), (rr, z + 0.025)], seg=20, collection=col,
                               mat=M["iron"], cap_top=False, cap_bot=False))
    if water:
        wm = bpy.data.materials.get("ButtWater") or mat.painterly(
            "ButtWater", (0.02, 0.03, 0.04), stroke="strokes_horiz", scale=3, tex_amt=0.3, spec=0.9, rough=0.08, snow=0.0)
        parts.append(geo.lathe(name + "_water", [(0.0, h * 0.9), (r * 0.82, h * 0.9)], seg=20, collection=col, mat=wm,
                               cap_top=False, cap_bot=False))
    else:
        parts.append(geo.lathe(name + "_lid", [(0.0, h - 0.03), (r * 0.82, h - 0.03), (r * 0.82, h - 0.01), (0.0, h - 0.01)],
                               seg=20, collection=col, mat=M["wood_dark"]))
    return geo.join(parts, name)


def _sack(name, col, M, size, seed):
    sk = geo.rounded_box(name, size, min(size) * 0.38, seg=(2, 2, 2), n_r=3, collection=col, mat=M["sack"])
    geo.displace_noise(sk, 0.03, 0.18, seed=seed)
    tie = geo.lathe(name + "_neck", [(0.06, 0.0), (0.035, 0.05), (0.05, 0.1), (0.0, 0.12)], seg=10, collection=col,
                    mat=M["sack"])
    tie.location = (0, 0, size[2] / 2 - 0.02)
    return geo.join([sk, tie], name)


def _wheel(name, col, M, r=0.42, w=0.07, spokes=10):
    parts = [geo.lathe(name + "_rim", [(r - 0.05, -w / 2), (r, -w / 2), (r, w / 2), (r - 0.05, w / 2)], seg=28,
                       collection=col, mat=M["wood_dark"], cap_top=False, cap_bot=False)]
    parts.append(geo.lathe(name + "_tyre", [(r, -w / 2 - 0.004), (r + 0.012, -w / 2), (r + 0.012, w / 2), (r, w / 2 + 0.004)],
                           seg=28, collection=col, mat=M["iron"], cap_top=False, cap_bot=False))
    parts.append(geo.lathe(name + "_hub", [(0.0, -0.09), (0.08, -0.09), (0.09, 0.0), (0.08, 0.09), (0.0, 0.09)], seg=12,
                           collection=col, mat=M["wood"]))
    for k in range(spokes):
        a = TAU * k / spokes
        sp = geo.box(name + "_spoke", (0.035, 0.03, r - 0.08), collection=col, mat=M["wood"])
        sp.matrix_basis = Matrix.Rotation(a, 4, "Z") @ Matrix.Translation((0, (r - 0.04) / 2 + 0.03, 0)) @ \
            Matrix.Rotation(math.pi / 2, 4, "X")
        parts.append(sp)
    return geo.join(parts, name)


def yard(origin, collection=None):
    """The miller's yard around the mill (world space): porch bench and pots, sacks, barrels + water butt, a stacked
    woodpile under a lean-to with chopping block, a spare millstone, a handcart, a split-rail fence round a little
    vegetable garden. Both gallery decks stay clear. Returns dict(objects=[...], keep_clear=[(x, y, r)])."""
    from . import windmill as WMod
    col = collection or geo.coll("Yard")
    M = WMod.mats()
    endm = _end_mat()
    O = Vector(origin)
    H = terrain.height
    rng = np.random.default_rng(31)
    objs, keep = [], []

    def place(o, x, y, rz=0.0, dz=0.0, tilt=(0.0, 0.0)):
        z = float(H(x, y))
        o.matrix_basis = Matrix.Translation((x, y, z + dz)) @ Matrix.Rotation(rz, 4, "Z") @ \
            Matrix.Rotation(tilt[0], 4, "X") @ Matrix.Rotation(tilt[1], 4, "Y")
        objs.append(o)
        return o

    fy = O.y - WMod.BASE_R - 0.06        # door face (world y)
    # -- porch bench (west of the door) + a pair of pots
    bench = [geo.box("BenchSeat", (1.55, 0.36, 0.07), loc=(0, 0, 0.46), collection=col, mat=M["wood"], bevel=0.015)]
    bench.append(geo.box("BenchSeat2", (1.55, 0.06, 0.05), loc=(0, 0.2, 0.44), collection=col, mat=M["wood_dark"], bevel=0.01))
    for sx in (-0.62, 0.62):
        bench.append(geo.box("BenchSlab", (0.09, 0.34, 0.44), loc=(sx, 0, 0.22), collection=col, mat=M["wood_grey"], bevel=0.015))
    place(geo.join(bench, "Bench"), O.x - 2.25, fy - 0.5, math.radians(12))
    keep.append((O.x - 2.25, fy - 0.5, 0.95))
    potm = bpy.data.materials.get("Terracotta") or mat.painterly(
        "Terracotta", (0.55, 0.24, 0.13), stroke="strokes_fine", scale=6, tex_amt=1.0, breakup=1.2, bump=0.15,
        color2=(0.36, 0.38, 0.22), c2_thresh=(0.66, 0.74), ao=0.4, snow=0.0)
    pots = []
    for i, (px, py, pr) in enumerate(((O.x - 0.98, fy - 0.42, 0.17), (O.x - 1.32, fy - 0.3, 0.12), (O.x + 1.35, fy - 0.38, 0.15))):
        pot = geo.lathe(f"Pot{i}", [(0.0, 0.0), (pr * 0.72, 0.0), (pr, pr * 1.5), (pr * 1.08, pr * 1.55), (pr * 1.08, pr * 1.7),
                                    (pr * 0.95, pr * 1.7), (pr * 0.9, pr * 1.45)], seg=16, collection=col, mat=potm)
        place(pot, px, py, rng.uniform(0, 6))
        pots.append((px, py, float(H(px, py)) + pr * 1.42, pr))
        keep.append((px, py, pr + 0.08))
    # -- sacks east of the door
    for i, (x, y, rz, sz, zz) in enumerate(((2.05, -0.42, 0.3, (0.55, 0.42, 0.7), 0.0), (2.6, -0.2, -0.4, (0.5, 0.4, 0.6), 0.0),
                                            (2.3, -0.15, 0.9, (0.5, 0.38, 0.5), 0.6), (2.95, -0.62, 1.4, (0.48, 0.36, 0.42), 0.0))):
        sk = _sack(f"Sack{i}", col, M, sz, seed=i + 3)
        place(sk, O.x + x, fy + y, rz, dz=sz[2] / 2 - 0.05 + zz, tilt=(0.0, math.radians(8 * (i - 1))))
    keep.append((O.x + 2.5, fy - 0.35, 0.8))
    # -- barrels + water butt (south-west of the base) and a bucket
    b = _barrel("WaterButt", col, M, 0.95, 0.42, water=True)
    place(b, O.x - 3.25, O.y - 2.85, 0.0)
    b2 = _barrel("Barrel", col, M, 0.85, 0.36)
    place(b2, O.x - 3.95, O.y - 2.2, 0.4)
    bu = _barrel("Bucket", col, M, 0.28, 0.15)
    place(bu, O.x - 2.6, O.y - 3.4, 0.0, tilt=(0.0, 0.0))
    keep += [(O.x - 3.25, O.y - 2.85, 0.55), (O.x - 3.95, O.y - 2.2, 0.48), (O.x - 2.6, O.y - 3.4, 0.2)]
    # -- woodpile under a lean-to against the east side of the base, chopping block + axe
    wx, wy = O.x + 4.25, O.y + 0.9
    logs = []
    for row in range(5):
        for k in range(7 - (row // 2)):
            lg = _log(f"Log{row}_{k}", rng.uniform(0.07, 0.1), rng.uniform(0.55, 0.7), col, M, endm)
            lg.matrix_basis = Matrix.Translation((0, (k - 3) * 0.19 + (0.09 if row % 2 else 0), 0.09 + row * 0.165)) @ \
                Matrix.Rotation(math.pi / 2, 4, "Y") @ Matrix.Rotation(rng.normal(0, 0.05), 4, "X")
            logs.append(lg)
    for sy in (-0.75, 0.75):
        logs.append(geo.box("WPPost", (0.09, 0.09, 1.45), loc=(0.35, sy, 0.72), collection=col, mat=M["wood_grey"], bevel=0.01))
        logs.append(geo.box("WPPost", (0.09, 0.09, 1.7), loc=(-0.45, sy, 0.85), collection=col, mat=M["wood_grey"], bevel=0.01))
    roof = geo.box("WPRoof", (1.2, 1.8, 0.05), collection=col, mat=M["shingle"], bevel=0.01)
    roof.location = (-0.05, 0, 1.6)
    roof.rotation_euler = (0, math.radians(-14), 0)
    from . import windmill as _wmm
    roof.data.color_attributes.new("tint", "FLOAT_COLOR", "POINT").data.foreach_set(
        "color", np.ones(len(roof.data.vertices) * 4))
    logs.append(roof)
    wp = geo.join(logs, "WoodPile")
    place(wp, wx, wy, 0.0)
    keep.append((wx, wy, 1.1))
    blk = _log("ChopBlock", 0.24, 0.42, col, M, endm)
    place(blk, wx + 0.15, wy - 1.55, 0.0, dz=0.21)
    axe = [geo.box("AxeHandle", (0.035, 0.035, 0.75), loc=(0, 0, 0.3), collection=col, mat=M["wood"])]
    axe.append(geo.box("AxeHead", (0.16, 0.025, 0.1), loc=(0.05, 0, 0.66), collection=col, mat=M["iron"]))
    ax = geo.join(axe, "Axe")
    place(ax, wx + 0.15, wy - 1.55, 0.6, dz=0.36, tilt=(math.radians(30), 0.0))
    keep.append((wx + 0.15, wy - 1.55, 0.35))
    # -- a spare millstone leaning against the base (north-east)
    ms = geo.lathe("Millstone", [(0.09, -0.11), (0.55, -0.11), (0.57, -0.08), (0.57, 0.08), (0.55, 0.11), (0.09, 0.11)],
                   seg=36, collection=col, mat=M["stone"], cap_top=False, cap_bot=False, jitter=0.01, seed=4)
    ms.data.color_attributes.new("tint", "FLOAT_COLOR", "POINT").data.foreach_set("color", np.ones(len(ms.data.vertices) * 4))
    a = math.radians(32)
    mx, my = O.x + math.cos(a) * 4.05, O.y + math.sin(a) * 4.05
    place(ms, mx, my, a + math.pi / 2, dz=0.5, tilt=(math.radians(76), 0.0))
    keep.append((mx, my, 0.65))
    # -- handcart (south-east), handles resting on the ground, a sack in it
    cart = [geo.box("CartBed", (1.25, 0.82, 0.05), loc=(0, 0, 0.5), collection=col, mat=M["wood"], bevel=0.01)]
    for sx in (-0.62, 0.62):
        cart.append(geo.box("CartSide", (0.04, 0.82, 0.3), loc=(sx, 0, 0.66), collection=col, mat=M["wood_grey"], bevel=0.008))
    for sy in (-0.4, 0.4):
        cart.append(geo.box("CartSide", (1.25, 0.04, 0.3), loc=(0, sy, 0.66), collection=col, mat=M["wood_grey"], bevel=0.008))
        cart.append(geo.box("CartHandle", (1.9, 0.05, 0.05), loc=(-0.55, sy * 1.1, 0.47), collection=col, mat=M["wood"]))
    cart.append(geo.box("CartAxle", (0.06, 1.2, 0.06), loc=(0.25, 0, 0.42), collection=col, mat=M["iron"]))
    for sy in (-0.56, 0.56):
        wh = _wheel("CartWheel", col, M)
        wh.matrix_basis = Matrix.Translation((0.25, sy, 0.42)) @ Matrix.Rotation(math.pi / 2, 4, "X")
        cart.append(wh)
    ck = _sack("CartSack", col, M, (0.5, 0.4, 0.45), seed=9)
    ck.matrix_basis = Matrix.Translation((0.2, 0.05, 0.75)) @ Matrix.Rotation(1.2, 4, "Z") @ Matrix.Rotation(0.5, 4, "Y")
    cart.append(ck)
    cj = geo.join(cart, "Cart")
    cx, cy = O.x + 3.55, O.y - 5.1
    place(cj, cx, cy, math.radians(-118), dz=-0.02, tilt=(0.0, math.radians(-13)))
    keep.append((cx, cy, 1.15))
    # -- vegetable garden inside a split-rail fence (west)
    gx0, gx1, gy0, gy1 = O.x - 8.3, O.x - 4.9, O.y - 5.6, O.y - 1.7
    soil = bpy.data.materials.get("GardenSoil") or mat.painterly(
        "GardenSoil", (0.20, 0.13, 0.08), stroke="strokes_horiz", scale=1.5, tex_amt=1.2, breakup=1.4, bump=0.35,
        color2=(0.14, 0.10, 0.06), ao=0.4, snow=0.0)
    nx, ny = 34, 40
    verts, faces = [], []
    for j in range(ny + 1):
        for i in range(nx + 1):
            x = gx0 + 0.15 + (gx1 - gx0 - 0.3) * i / nx
            y = gy0 + 0.15 + (gy1 - gy0 - 0.3) * j / ny
            ridge = 0.045 * (0.5 + 0.5 * math.cos((x - gx0) / 0.55 * TAU))
            verts.append((x, y, float(H(x, y)) + 0.02 + ridge))
    for j in range(ny):
        for i in range(nx):
            a0 = j * (nx + 1) + i
            faces.append((a0, a0 + 1, a0 + nx + 2, a0 + nx + 1))
    objs.append(geo.obj_from("GardenBed", verts, faces, col, soil))
    veg = []
    cab_m = bpy.data.materials.get("Cabbage") or mat.painterly(
        "Cabbage", (0.22, 0.36, 0.24), stroke="strokes_fine", scale=6, tex_amt=0.8, breakup=1.2, wrap=0.3,
        translucent=0.2, color2=(0.36, 0.46, 0.3), snow=0.0, vcol="col")
    for row in range(5):
        x = gx0 + 0.15 + 0.275 + row * 0.55
        for k in range(6):
            y = gy0 + 0.45 + k * 0.55 + rng.normal(0, 0.04)
            if row == 4:
                break
            mbv = MB()
            nfv = _dome_nf((0, 0, -0.25))
            for lf in range(11):
                aa = lf * 2.4
                ring = lf / 11
                s_ = 0.12 + 0.1 * ring
                _leaflet(mbv, Vector((0, 0, 0.06 - 0.04 * ring)), aa, s_, 0.9 - 0.75 * ring,
                         _lerp((0.25, 0.42, 0.3), (0.12, 0.26, 0.16), ring), nfv, heart=False)
            cb = mbv.build(f"Cabbage{row}_{k}", col, cab_m)
            place(cb, x, y, rng.uniform(0, 6), dz=0.04)
    # bean poles (teepees) with vines along the last row
    for k in range(3):
        y = gy0 + 0.7 + k * 1.15
        x = gx0 + 0.15 + 0.275 + 4 * 0.55
        for j in range(4):
            aa = TAU * j / 4 + 0.4
            pole = geo.box("BeanPole", (0.025, 0.025, 1.7), collection=col, mat=M["wood_grey"])
            pole.matrix_basis = Matrix.Translation((x + 0.18 * math.cos(aa), y + 0.18 * math.sin(aa), float(H(x, y)) + 0.8)) @ \
                Matrix.Rotation(-0.13 * math.cos(aa), 4, "Y") @ Matrix.Rotation(0.13 * math.sin(aa), 4, "X")
            veg.append(pole)
        mbv = MB()
        nfv = _dome_nf((0, 0, -0.3))
        for j in range(60):
            aa = rng.uniform(0, TAU)
            zz = rng.uniform(0.15, 1.45)
            rr = 0.18 * (1 - zz / 1.8) + 0.02
            _leaflet(mbv, Vector((rr * math.cos(aa), rr * math.sin(aa), zz)), aa, rng.uniform(0.035, 0.055),
                     rng.uniform(-0.3, 0.4), _lerp((0.08, 0.2, 0.06), (0.18, 0.34, 0.1), rng.random()), nfv)
        vb = mbv.build(f"BeanVine{k}", col, cab_m)
        place(vb, x, y, 0.0)
    if veg:
        objs.append(geo.join(veg, "BeanPoles"))
    # split-rail fence round the garden, gate gap on the east side
    fence = []
    corners = [(gx0, gy0), (gx1, gy0), (gx1, gy1), (gx0, gy1), (gx0, gy0)]
    for (ax_, ay_), (bx_, by_) in zip(corners, corners[1:]):
        L = math.hypot(bx_ - ax_, by_ - ay_)
        nseg = max(1, int(round(L / 1.15)))
        for k in range(nseg + 1):
            t = k / nseg
            px, py = ax_ + (bx_ - ax_) * t, ay_ + (by_ - ay_) * t
            pz = float(H(px, py))
            p = geo.box("FencePost", (0.1, 0.1, 1.05), loc=(px, py, pz + 0.42), collection=col, mat=M["wood_grey"], bevel=0.015)
            p.rotation_euler = (rng.normal(0, 0.04), rng.normal(0, 0.04), rng.uniform(0, 1.5))
            fence.append(p)
        for k in range(nseg):
            t0_, t1_ = k / nseg, (k + 1) / nseg
            gate = abs(ax_ - gx1) < 1e-6 and abs(bx_ - gx1) < 1e-6 and k == nseg // 2
            if gate:
                continue
            for hz in (0.42, 0.8):
                p0 = Vector((ax_ + (bx_ - ax_) * t0_, ay_ + (by_ - ay_) * t0_, 0))
                p1 = Vector((ax_ + (bx_ - ax_) * t1_, ay_ + (by_ - ay_) * t1_, 0))
                p0.z = float(H(p0.x, p0.y)) + hz + rng.normal(0, 0.02)
                p1.z = float(H(p1.x, p1.y)) + hz + rng.normal(0, 0.02)
                d = p1 - p0
                rl = geo.lathe("FenceRail", [(0.045, 0.0), (0.05, d.length * 0.5), (0.042, d.length + 0.12)], seg=6,
                               collection=col, mat=M["wood_grey"], jitter=0.08, seed=k)
                rl.matrix_basis = Matrix.Translation(p0 - d.normalized() * 0.06) @ d.to_track_quat("Z", "Y").to_matrix().to_4x4()
                fence.append(rl)
    objs.append(geo.join(fence, "Fence"))
    # watering can by the gate
    can = [geo.lathe("CanBody", [(0.0, 0.0), (0.13, 0.0), (0.13, 0.24), (0.1, 0.27), (0.0, 0.27)], seg=16, collection=col,
                     mat=M["iron"])]
    sp = geo.lathe("CanSpout", [(0.02, 0.0), (0.015, 0.32), (0.03, 0.34)], seg=8, collection=col, mat=M["iron"])
    sp.matrix_basis = Matrix.Translation((0.1, 0, 0.06)) @ Matrix.Rotation(math.radians(-55), 4, "Y")
    can.append(sp)
    place(geo.join(can, "WateringCan"), gx1 + 0.45, (gy0 + gy1) / 2 - 0.5, 2.2)
    keep.append((gx1 + 0.45, (gy0 + gy1) / 2 - 0.5, 0.25))
    # pot plants (instanced cover prototypes)
    lib = protos()
    pts = []
    for (px, py, pz, pr) in pots:
        for k in range(3 if pr > 0.14 else 2):
            kind = "geranium" if k == 0 else ["daisy", "violet", "geranium"][int(rng.integers(0, 3))]
            q = (px + rng.normal(0, pr * 0.3), py + rng.normal(0, pr * 0.3), pz)
            pts.append((q, lib[kind][int(rng.integers(0, len(lib[kind])))], rng.uniform(0.8, 1.05) * (pr / 0.15)))
    n = len(pts)
    P = dict(co=np.array([p for p, _, _ in pts]), proto=np.array([i for _, i, _ in pts], dtype=np.int32),
             rot=np.stack([rng.normal(0, 0.08, n), rng.normal(0, 0.08, n), rng.uniform(0, TAU, n)], 1),
             scale=np.array([s_ for _, _, s_ in pts]), tint=np.ones((n, 3)), flex=np.full(n, 0.5), lean=np.zeros((n, 3)))
    objs.append(_cloud("YardPotPlants", P, col))
    rect = (gx0 - 0.05, gx1 + 0.05, gy0 - 0.05, gy1 + 0.05)
    return dict(objects=objs, keep_clear=keep, garden=rect, pots=pots)
