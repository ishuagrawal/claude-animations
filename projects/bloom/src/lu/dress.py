"""Set dressing for BLOOM after the Wild Robot's "Sprinkles": a painterly ground-cover library scattered as
Geometry-Nodes instances, with the BLOOM growth built into the instancer.

Prototypes (hidden collection LU_Protos; lib = protos(), lib[kind] -> proto indices, lib["lod"] -> {hi: lo}):
  ash phase   tuft (burnt grass stubble), twigs, cinders, coal (glowing), shrub (dead burnt bush), stone (strata),
              pebble, branch (charred fallen branch)
  bloom       grass_s / grass_m / grass_t (4 spring palettes), grass_far, moss, fern, clover, flowers: daisy (white),
              corn (blue), violet, pclover (magenta), butter (yellow), cosmos (pink), flower_far (dabs)
  trees       leaf (spring leaf clusters), blossom_p / blossom_w (pink / white blossom clusters), leaf_lo,
              (no blob LODs: canopies stay clusters, thinned + scaled with distance)
Point clouds: objects named Cover* (vertices only) with attributes
  proto (int)  scale (f)  rot (vec: tilt x, tilt y, yaw)  tint (col)  flex (f, wind)  lean (vec)
  gmode (f)    +1 grows in behind the bloom wave, -1 withers (ash cover), 0 static
  bdel (f)     extra distance (m) before this instance reacts (stagger)     glen (f) growth length (m)
The shared GN group LU_CoverGN instances them, sways them with foliage.wind and scales them with the bloom wave
(LU_Bloom Empty, same analytic distance as the shaders): a springy grow-in (slight overshoot), never a pop.

API
  ash_cover(areas=..., seed)      ash-phase dressing (tufts, twigs, cinders, coals, shrubs, stones, branches)
  meadow(areas=..., seed, lush)   bloom cover (grass, flowers in drifts, moss, ferns, clover); gmode=+1
  patch(center, radius, kind="ash"|"meadow", density)   extra-dense hero cover around a spot
  cull(f0, f1, cams=None)         camera culling + distance LOD (proto swap) + screen-density thinning
  mow(center, radius) / flatten(center, radius)          clear / flatten cover (props, feet, impacts)
Areas: "stump", "climb", "summit", "valley" (sparse, everywhere visible), or (x, y, r) circles."""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, mat, terrain, layout

PROTO_COLL = "LU_Protos"
TAU = 2 * math.pi


def _ss(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


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

    def build(self, name, collection, material, extra_mats=()):
        me = bpy.data.meshes.new(name)
        me.from_pydata(self.v, [], self.f)
        me.validate()
        me.update()
        me.shade_smooth()
        uvl = me.uv_layers.new(name="UVMap")
        lv = np.empty(len(me.loops), dtype=np.int64)
        me.loops.foreach_get("vertex_index", lv)
        uvl.data.foreach_set("uv", np.array(self.uv)[lv].ravel())
        ubl = me.uv_layers.new(name="UVb")
        ubl.data.foreach_set("uv", np.array(self.ub)[lv].ravel())
        att = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
        att.data.foreach_set("color", np.concatenate([np.array(self.c), np.ones((len(self.c), 1))], 1).ravel())
        me.normals_split_custom_set_from_vertices([Vector(n) for n in self.n])
        if material is not None:
            me.materials.append(material)
        for m in extra_mats:
            me.materials.append(m)
        ob = bpy.data.objects.new(name, me)
        collection.objects.link(ob)
        return ob


def _lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def _scale_c(c, k):
    return tuple(min(1.0, x * k) for x in c)


def _blade(mb, base, h, w, az, tilt, bend, segs, c0, c1, nf, uvo=(0.0, 0.0), side_rot=0.0, wshape=1.3, bulge=0.3,
           cpow=0.8, droop=0.0):
    """A tapered, curving strap (grass blade, leaf, stem). tilt/bend in radians from vertical (bend grows as s^2)."""
    d = Vector((math.cos(az), math.sin(az), 0.0))
    z = Vector((0.0, 0.0, 1.0))
    side = Vector((-math.sin(az + side_rot), math.cos(az + side_rot), 0.0))
    p = Vector(base)
    pts = [p.copy()]
    for i in range(1, segs + 1):
        sm = (i - 0.5) / segs
        ang = tilt + bend * sm * sm + droop * sm ** 3
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


def tube(mb, pts, radii, segs=6, c0=(0.03, 0.03, 0.03), c1=None, cap=True, jitter=0.0, rng=None, nf=None):
    """A tube along a polyline (twigs, branches, logs, shrub stems). Radial normals (or nf)."""
    pts = [Vector(p) for p in pts]
    c1 = c1 or c0
    rings = []
    prev_side = None
    n = len(pts)
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        t = t.normalized() if t.length > 1e-9 else Vector((0, 0, 1))
        ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
        side = t.cross(ref).normalized() if prev_side is None else (prev_side - t * prev_side.dot(t)).normalized()
        prev_side = side
        up = t.cross(side).normalized()
        col = _lerp(c0, c1, i / max(n - 1, 1))
        ring = []
        for k in range(segs):
            a = TAU * k / segs
            dv = side * math.cos(a) + up * math.sin(a)
            r = radii[i] * (1 + (rng.normal(0, jitter) if (rng is not None and jitter) else 0.0))
            q = p + dv * r
            ring.append(mb.vert(q, (k / segs, i / max(n - 1, 1)), col, nf(q) if nf else dv))
        rings.append(ring)
    for i in range(n - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segs):
            k2 = (k + 1) % segs
            mb.face(a[k], a[k2], b[k2], b[k])
    if cap:
        tdir = (pts[-1] - pts[-2]).normalized()
        ci = mb.vert(pts[-1] + tdir * radii[-1] * 0.4, (0.5, 1.0), c1, tdir)
        for k in range(segs):
            mb.face(rings[-1][k], rings[-1][(k + 1) % segs], ci)
    return rings


def _stem(mb, rng, base, h, az, tilt, bend, nf, w=0.0035, col=(0.10, 0.22, 0.06)):
    pts = _blade(mb, base, h, w, az, tilt, bend, 5, _scale_c(col, 0.6), col, nf, (rng.random() * 0.9, 0.2),
                 wshape=4.0, bulge=0.0)
    _blade(mb, base, h, w, az, tilt, bend, 5, _scale_c(col, 0.6), col, nf, (rng.random() * 0.9, 0.2),
           side_rot=math.pi / 2, wshape=4.0, bulge=0.0)
    return pts


def _head_frame(pts, rng, face_up=0.75):
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
    bi = mb.vert(c - n * h * 0.4, (0.5, 0.5), _scale_c(col, 0.6), -n)
    for k in range(seg):
        mb.face(bi, ring[(k + 1) % seg], ring[k])


def _ball(mb, c, r, col, col2, rng, n=(0, 0, 1), elong=1.25, spikes=0.25, rings=5, seg=8):
    """Low-poly bumpy ball (clover head, buds, cinders, foliage blobs)."""
    c = Vector(c)
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
            r *= 0.8
        pts.append(Vector(base) + fwd * (r * math.cos(a) * 0.6 + size * 0.55) + side * r * math.sin(a))
    ci = mb.vert(base, (0.5, 0.1), _scale_c(col, 0.7), nf(base))
    ids = [mb.vert(p, (0.5, 0.5), col, nf(p)) for p in pts]
    mid = mb.vert(Vector(base) + fwd * size * 0.6, (0.5, 0.3), _scale_c(col, 1.15), nf(base))
    for k in range(6):
        mb.face(mid, ids[k], ids[k + 1])
    mb.face(ci, ids[0], mid)
    mb.face(ci, mid, ids[6])


def _leaf(mb, base, dirv, upv, L, W, col0, col1, nf, fold=0.25):
    """A pointed oval leaf (spring foliage): 7 verts, folded along the midrib."""
    dirv, upv = Vector(dirv).normalized(), Vector(upv).normalized()
    side = dirv.cross(upv).normalized()
    b = Vector(base)
    pts = [(0.0, 0.0), (0.25, 0.42), (0.6, 0.5), (1.0, 0.0), (0.6, -0.5), (0.25, -0.42)]
    ids = []
    for (t, s) in pts:
        q = b + dirv * (t * L) + side * (s * W) + upv * (abs(s) * W * -fold + math.sin(math.pi * t) * L * 0.08)
        ids.append(mb.vert(q, (t, 0.5 + s), _lerp(col0, col1, t), nf(q)))
    mid = mb.vert(b + dirv * (0.45 * L) + upv * (L * 0.05), (0.45, 0.5), _lerp(col0, col1, 0.5), nf(b + dirv * 0.45 * L))
    for k in range(6):
        mb.face(mid, ids[k], ids[(k + 1) % 6])


# ===================================================================== colours (linear)
CHAR = (0.022, 0.019, 0.018)
CHAR_B = (0.075, 0.052, 0.036)
ASHG = (0.36, 0.345, 0.33)
STEM = (0.07, 0.24, 0.04)
WHITE = (0.95, 0.93, 0.86)
DAISY_C = (1.0, 0.62, 0.04)
BLUE = (0.10, 0.28, 1.0)
VIOLET = (0.55, 0.40, 0.88)       # lavender
MAGENTA = (0.80, 0.05, 0.42)
PINK = (1.0, 0.42, 0.64)
YELLOW = (1.0, 0.70, 0.03)

GRASS_PAL = {        # spring: emerald, spring green, olive-gold, blue-green (root, tip) - rich, not lime
    "emerald": ((0.010, 0.045, 0.018), (0.05, 0.26, 0.07)),
    "chart": ((0.020, 0.055, 0.012), (0.15, 0.36, 0.05)),
    "yellow": ((0.030, 0.055, 0.012), (0.30, 0.36, 0.08)),
    "blue": ((0.010, 0.04, 0.03), (0.05, 0.24, 0.16)),
}


# ===================================================================== prototype builders: ash phase
def _burnt_tuft(rng):
    """Burnt grass stubble: short charred blades, broken, some flattened, a few ash-grey tips."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.2))
    n = int(rng.integers(12, 22))
    for b in range(n):
        r = 0.05 * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        h = rng.uniform(0.03, 0.14) * (0.5 if rng.random() < 0.3 else 1.0)
        c1 = ASHG if rng.random() < 0.25 else _scale_c(CHAR_B, rng.uniform(0.7, 1.6))
        _blade(mb, (r * math.cos(a), r * math.sin(a), -0.005), h, rng.uniform(0.004, 0.008), a + rng.normal(0, 0.6),
               rng.uniform(0.1, 0.9), rng.uniform(0.3, 2.2), 3, CHAR, c1, nf, (rng.random() * 0.9, 0.2),
               bulge=0.0, wshape=1.0)
    return mb


def _twigs(rng):
    """A few charred twigs lying on the ash, forked."""
    mb = MB()
    for k in range(int(rng.integers(2, 5))):
        a = rng.uniform(0, TAU)
        L = rng.uniform(0.15, 0.5)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        p0 = Vector((rng.normal(0, 0.12), rng.normal(0, 0.12), 0.008))
        pts = [p0 + d * (L * t) + Vector((0, 0, 0.012 * math.sin(math.pi * t) + rng.normal(0, 0.002))) for t in
               np.linspace(0, 1, 5)]
        r0 = rng.uniform(0.004, 0.009)
        tube(mb, pts, [r0 * (1 - 0.6 * t) for t in np.linspace(0, 1, 5)], 5, CHAR, _scale_c(CHAR_B, 1.2))
        if rng.random() < 0.7:
            q = pts[2]
            a2 = a + rng.choice((-1, 1)) * rng.uniform(0.4, 0.9)
            d2 = Vector((math.cos(a2), math.sin(a2), 0.0))
            L2 = L * rng.uniform(0.3, 0.6)
            tube(mb, [q + d2 * (L2 * t) + Vector((0, 0, 0.004 * t)) for t in np.linspace(0, 1, 3)],
                 [r0 * 0.6 * (1 - 0.6 * t) for t in np.linspace(0, 1, 3)], 4, CHAR, CHAR_B)
    return mb


def _cinders(rng, n=None, size=(0.005, 0.02), col=CHAR):
    mb = MB()
    for k in range(n or int(rng.integers(5, 12))):
        r = rng.uniform(*size)
        c = (rng.normal(0, 0.09), rng.normal(0, 0.09), r * 0.3)
        _ball(mb, c, r, _scale_c(col, rng.uniform(0.7, 1.8)), col, rng, elong=rng.uniform(0.5, 0.8), spikes=0.6,
              rings=3, seg=5)
    return mb


def _shrub(rng):
    """A dead burnt bush: bare black branching stems 0.3-0.8 m (recursive forks), thin twig tips."""
    mb = MB()
    H = rng.uniform(0.3, 0.8)

    def branch(p, d, L, r, depth):
        pts = [p]
        q = Vector(p)
        dd = Vector(d)
        for i in range(4):
            dd = (dd + Vector(rng.normal(0, 0.25, 3)) * 0.4 + Vector((0, 0, 0.12))).normalized()
            q = q + dd * (L / 4)
            pts.append(q.copy())
        tube(mb, pts, [r * (1 - 0.7 * t) for t in np.linspace(0, 1, 5)], 4 if depth > 0 else 3, CHAR,
             _scale_c(CHAR_B, 1.1))
        if depth < 3:
            for k in range(int(rng.integers(1, 3)) + (1 if depth == 0 else 0)):
                i = int(rng.integers(2, 5))
                nd = (dd + Vector(rng.normal(0, 0.7, 3))).normalized()
                nd.z = abs(nd.z) * 0.8 + 0.2
                branch(pts[i], nd.normalized(), L * rng.uniform(0.45, 0.75), r * 0.55, depth + 1)

    for k in range(int(rng.integers(3, 6))):
        a = rng.uniform(0, TAU)
        d = Vector((math.cos(a) * 0.45, math.sin(a) * 0.45, 1.0)).normalized()
        branch(Vector((rng.normal(0, 0.03), rng.normal(0, 0.03), -0.02)), d, H * rng.uniform(0.5, 0.8),
               rng.uniform(0.008, 0.016), 0)
    return mb


def _branch_log(rng):
    """A charred fallen branch / small log lying in the ash (stubs, a crooked line)."""
    mb = MB()
    L = rng.uniform(0.8, 2.4)
    r = rng.uniform(0.035, 0.09)
    a = rng.uniform(0, TAU)
    d = Vector((math.cos(a), math.sin(a), 0.0))
    side = Vector((-d.y, d.x, 0))
    pts = [d * (L * (t - 0.5)) + side * (0.06 * math.sin(t * 5 + a)) + Vector((0, 0, r * 0.7)) for t in np.linspace(0, 1, 9)]
    tube(mb, pts, [r * (1 - 0.35 * t) for t in np.linspace(0, 1, 9)], 8, CHAR, CHAR, jitter=0.08, rng=rng)
    for k in range(int(rng.integers(2, 5))):
        i = int(rng.integers(1, 8))
        q = pts[i]
        sd = (side * rng.choice((-1, 1)) + d * rng.normal(0, 0.4) + Vector((0, 0, rng.uniform(0.0, 0.8)))).normalized()
        Ls = rng.uniform(0.08, 0.35)
        tube(mb, [q, q + sd * Ls * 0.5, q + sd * Ls], [r * 0.45, r * 0.3, r * 0.12], 5, CHAR, CHAR_B)
    return mb


def _rock_proto(name, coll, m, seed, size=1.0, squash=0.55, strata=True):
    """A small angular strata stone (unit ~1 m, scaled per instance): faceted, bedded, chipped."""
    from .mountain import facet_rock_mesh
    rng = np.random.default_rng(seed)
    sz = (rng.uniform(0.9, 1.3), rng.uniform(0.7, 1.0), squash)
    v, q = facet_rock_mesh(sz, seed, planes=int(rng.integers(7, 12)), res=10 if strata else 6,
                           strata=0.12 if strata else 9.0, groove=0.012 if strata else 0.0, bevel=0.02)
    v[:, 2] -= squash * 0.25
    ob = terrain.mesh_from(name, v * size, q, coll, m)
    try:
        ob.data.set_sharp_from_angle(angle=math.radians(24))
    except Exception:
        pass
    me = ob.data
    att = me.color_attributes.new("col", "FLOAT_COLOR", "POINT")
    att.data.foreach_set("color", np.ones(len(me.vertices) * 4))
    me.uv_layers.new(name="UVMap")
    return ob


# ===================================================================== prototype builders: bloom
def _grass_clump(rng, n, h_rng, w_rng, rc, segs=5, tilt=(0.05, 0.45), bend=(0.2, 1.1), pal="emerald"):
    mb = MB()
    nf = _dome_nf((0, 0, -0.5 * h_rng[1] - rc * 2.0))
    root, tip = GRASS_PAL[pal]
    for b in range(n):
        r = rc * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        base = (r * math.cos(a), r * math.sin(a), -0.01)
        az = a + rng.normal(0, 0.6)
        h = rng.uniform(*h_rng) * (1 - 0.3 * r / max(rc, 1e-3))
        k = rng.uniform(0.85, 1.15)
        c1 = tuple(min(1.0, x * k * rng.uniform(0.95, 1.05)) for x in tip)
        _blade(mb, base, h, rng.uniform(*w_rng), az, rng.uniform(*tilt) * (0.4 + 0.6 * r / max(rc, 1e-3)),
               rng.uniform(*bend), segs, root, c1, nf, (rng.random() * 0.9, rng.random() * 0.6),
               side_rot=rng.normal(0, 0.35))
    return mb


def _moss(rng):
    """A moss cushion: a low lumpy dome of tiny bright tufts."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.15))
    R = rng.uniform(0.08, 0.16)
    for k in range(int(rng.integers(40, 70))):
        r = R * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        hh = 0.035 * (1 - (r / R) ** 2) + 0.005
        c = _lerp((0.10, 0.30, 0.03), (0.35, 0.55, 0.05), rng.random())
        _blade(mb, (r * math.cos(a), r * math.sin(a), hh * 0.5), rng.uniform(0.015, 0.03), rng.uniform(0.006, 0.012),
               rng.uniform(0, TAU), rng.uniform(0.3, 1.2), 0.8, 2, _scale_c(c, 0.5), c, nf, (0.5, 0.2), bulge=0.5)
    return mb


def _petal(mb, c, dvec, n, L, W, col0, col1, lift=0.2, bend=0.0, cup=0.25, shape="strap", segs=4, teeth=0,
           twist=0.0, rng=None):
    """One real petal: a curved, cupped strip (segs along x 3 across) from c along dvec (n = the flower's facing).
    shape: 'strap' (daisy: narrow, rounded/notched tip), 'round' (obovate: buttercup, blossom, cosmos),
    'fan' (cornflower floret: narrow base flaring to a toothed tip). teeth > 0 cuts teeth into the tip."""
    dvec = Vector(dvec).normalized()
    n = Vector(n).normalized()
    side = n.cross(dvec).normalized()
    rows = []
    for i in range(segs + 1):
        sp = i / segs
        if shape == "strap":
            w = W * (0.35 + 0.65 * math.sin(math.pi * min(1.0, 0.18 + sp * 0.95)) ** 0.5) * (1 - 0.25 * sp ** 6)
        elif shape == "fan":
            w = W * (0.18 + 0.82 * sp ** 0.8)
        else:
            w = W * math.sin(math.pi * min(1.0, 0.05 + sp * 0.78)) ** 0.8 * (1.0 - 0.15 * sp)
        ang = lift + bend * sp * sp
        q = c + (dvec * math.cos(ang) + n * math.sin(ang)) * (L * sp)
        row = []
        for t in (-1.0, -0.5, 0.0, 0.5, 1.0):
            off = side * (t * w * 0.5) + n * (cup * (t * t) * w * 0.5) + n * (twist * t * w * 0.5 * sp)
            ql = q + off
            if i == segs:
                if shape == "strap":
                    ql = ql - (dvec * math.cos(ang)) * (L * 0.06 * (1 - abs(t)) * (1 if teeth else -0.6))
                elif teeth or shape == "fan":
                    k = int(round((t + 1) * 2))
                    ql = ql + (dvec * math.cos(ang)) * (L * (0.09 if k % 2 == 0 else -0.05))
            colv = _lerp(col0, col1, sp ** 0.8)
            row.append(mb.vert(ql, (0.5 + 0.5 * t, sp), colv, n * 0.85 + dvec * 0.25 + side * (t * 0.15), (0.5 + 0.5 * t, sp)))
        rows.append(row)
    for i in range(segs):
        for j in range(4):
            mb.face(rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j])


def _whorl(mb, c, u, v, n, count, r0, L, W, col0, col1, rng, lift=(0.0, 0.3), bend=(-0.2, 0.1), cup=0.25,
           shape="strap", start=0.0, jitter=0.12, teeth=0, segs=4, Lvar=0.12):
    for k in range(count):
        a = start + TAU * k / count + rng.normal(0, jitter)
        dvec = u * math.cos(a) + v * math.sin(a)
        _petal(mb, c + dvec * r0, dvec, n, L * rng.uniform(1 - Lvar, 1 + Lvar), W * rng.uniform(0.85, 1.15),
               _scale_c(col0, rng.uniform(0.92, 1.05)), _scale_c(col1, rng.uniform(0.92, 1.06)),
               lift=rng.uniform(*lift), bend=rng.uniform(*bend), cup=cup, shape=shape, teeth=teeth, segs=segs,
               twist=rng.normal(0, 0.25), rng=rng)


def _bumpy_disc(mb, c, u, v, n, r, h, col, col2, rng, seg=12, rings=3):
    """A flower's centre: a domed disc of florets (bumpy), darker at the rim."""
    ci = mb.vert(c + n * h, (0.5, 0.5), col, n)
    prev = [ci]
    for ri in range(1, rings + 1):
        rr = r * ri / rings
        row = []
        for k in range(seg):
            a = TAU * k / seg + (0.5 * TAU / seg if ri % 2 else 0)
            d = u * math.cos(a) + v * math.sin(a)
            hh = h * (1 - (ri / rings) ** 2) + r * 0.12 * (rng.random() - 0.5)
            row.append(mb.vert(c + d * rr + n * hh, (0.5, 0.5), _lerp(col, col2, ri / rings), n + d * (ri / rings)))
        if len(prev) == 1:
            for k in range(seg):
                mb.face(prev[0], row[k], row[(k + 1) % seg])
        else:
            for k in range(seg):
                mb.face(prev[k], row[k], row[(k + 1) % seg], prev[(k + 1) % seg])
        prev = row
    bi = mb.vert(c - n * h * 0.5, (0.5, 0.5), _scale_c(col2, 0.6), -n)
    for k in range(seg):
        mb.face(bi, prev[(k + 1) % seg], prev[k])


def _basal(mb, rng, nf, n=(3, 6), L=(0.05, 0.11), W=(0.008, 0.014), col=STEM):
    for k in range(int(rng.integers(*n))):
        a = rng.uniform(0, TAU)
        _blade(mb, (0, 0, -0.005), rng.uniform(*L), rng.uniform(*W), a, rng.uniform(0.5, 0.95), 0.9, 3,
               (0.02, 0.08, 0.02), col, nf, (rng.random() * 0.9, 0.0))


def _daisy(rng, heads=2, petal=WHITE, centre=DAISY_C, tip=None):
    """Ox-eye daisy: a ring of 18-24 slim notched white petals (gaps between them), a domed golden centre."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.35))
    _basal(mb, rng, nf)
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(0.2, 0.42), a,
                    rng.uniform(0.03, 0.2), rng.uniform(0.1, 0.4), nf)
        c, u, v, n = _head_frame(pts, rng, 0.65)
        R = rng.uniform(0.024, 0.034)
        t = tip or _lerp(petal, (1.0, 0.82, 0.86), rng.uniform(0.0, 0.5))
        _whorl(mb, c, u, v, n, int(rng.integers(18, 25)), R * 0.26, R * 0.82, R * 0.17, _scale_c(petal, 0.88), t, rng,
               lift=(-0.05, 0.25), bend=(-0.35, 0.05), cup=0.35, shape="strap", teeth=1, segs=4)
        _bumpy_disc(mb, c + n * 0.002, u, v, n, R * 0.3, R * 0.18, (1.0, 0.72, 0.08), (0.75, 0.42, 0.03), rng)
    return mb


def _cosmos(rng, heads=2, col=PINK):
    """Cosmos: 8 broad petals with toothed tips, a gold button centre, tall thin stems."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.35))
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(0.3, 0.55), a,
                    rng.uniform(0.05, 0.25), rng.uniform(0.1, 0.4), nf, w=0.003)
        c, u, v, n = _head_frame(pts, rng, 0.6)
        R = rng.uniform(0.03, 0.042)
        _whorl(mb, c, u, v, n, 8, R * 0.16, R * 0.95, R * 0.62, _lerp(col, (0.55, 0.05, 0.25), 0.4), col, rng,
               lift=(0.0, 0.25), bend=(-0.25, 0.1), cup=0.3, shape="round", teeth=1, segs=4, jitter=0.06)
        _bumpy_disc(mb, c + n * 0.002, u, v, n, R * 0.2, R * 0.14, (1.0, 0.72, 0.1), (0.55, 0.35, 0.05), rng, seg=10, rings=2)
    return mb


def _cornflower(rng, heads=2, col=BLUE):
    """Cornflower: 8-11 frilly trumpet florets flaring from a scaly green bract cup, toothed tips, a dark centre."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.35))
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        h = rng.uniform(0.28, 0.5)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), h, a, rng.uniform(0.04, 0.22),
                    rng.uniform(0.1, 0.5), nf, col=(0.08, 0.24, 0.06))
        for k in range(2):
            q = pts[int(rng.integers(1, 3))]
            _blade(mb, q, rng.uniform(0.05, 0.09), 0.006, rng.uniform(0, TAU), 0.7, 0.6, 3, STEM, (0.12, 0.3, 0.1), nf,
                   (rng.random() * 0.9, 0.0))
        c, u, v, n = _head_frame(pts, rng, 0.55)
        R = rng.uniform(0.022, 0.03)
        _ball(mb, c - n * R * 0.25, R * 0.32, (0.10, 0.20, 0.07), (0.05, 0.12, 0.04), rng, n=n, elong=1.1, spikes=0.35,
              rings=4, seg=8)
        deep = _lerp(col, (0.05, 0.05, 0.4), 0.45)
        _whorl(mb, c, u, v, n, int(rng.integers(8, 12)), R * 0.12, R * 0.95, R * 0.42, deep, _scale_c(col, 1.1), rng,
               lift=(0.25, 0.6), bend=(-0.5, -0.1), cup=0.45, shape="fan", teeth=1, segs=3)
        _whorl(mb, c + n * R * 0.1, u, v, n, 6, R * 0.05, R * 0.45, R * 0.25, deep, col, rng, lift=(0.7, 1.0),
               bend=(-0.2, 0.0), cup=0.4, shape="fan", teeth=1, segs=2, start=0.4)
        _bumpy_disc(mb, c + n * R * 0.12, u, v, n, R * 0.14, R * 0.1, (0.22, 0.08, 0.4), (0.1, 0.04, 0.22), rng, seg=8, rings=2)
    return mb


def _violet(rng, heads=3, col=(0.55, 0.40, 0.88)):
    """Lavender wood-violets: heart leaves, five rounded petals (two up, three down) with a pale throat."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.2))
    for k in range(int(rng.integers(4, 7))):
        _leaflet(mb, Vector((0, 0, 0.005)), rng.uniform(0, TAU), rng.uniform(0.018, 0.03), rng.uniform(0.2, 0.6),
                 (0.05, 0.2, 0.04), nf)
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.008 * math.cos(a), 0.008 * math.sin(a), -0.01), rng.uniform(0.07, 0.14), a,
                    rng.uniform(0.2, 0.5), 1.2, nf, w=0.0025)
        c, u, v, n = _head_frame(pts, rng, 0.3)
        R = rng.uniform(0.016, 0.022)
        _whorl(mb, c, u, v, n, 5, R * 0.08, R, R * 0.8, (0.95, 0.92, 0.95), col, rng, lift=(0.05, 0.3), bend=(-0.2, 0.1),
               cup=0.3, shape="round", start=math.pi / 2, jitter=0.15, segs=3)
        _bumpy_disc(mb, c + n * 0.001, u, v, n, R * 0.15, R * 0.12, (1.0, 0.85, 0.3), (0.9, 0.7, 0.2), rng, seg=6, rings=1)
    return mb


def _pink_clover(rng, heads=3, col=MAGENTA, col2=(0.95, 0.85, 0.9), r_head=(0.013, 0.018), h=(0.14, 0.32)):
    """Red clover: trefoil leaves, round pom-pom heads of many slim upturned florets (pale base, magenta tips)."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.25))
    for k in range(int(rng.integers(3, 6))):
        a = rng.uniform(0, TAU)
        base = Vector((0.02 * math.cos(a), 0.02 * math.sin(a), 0.0))
        pts = _blade(mb, base, rng.uniform(0.03, 0.07), 0.002, a, 0.3, 0.3, 2, STEM, STEM, nf, (0.5, 0.2))
        for j in range(3):
            _leaflet(mb, pts[-1], a + j * TAU / 3 + rng.normal(0, 0.2), rng.uniform(0.01, 0.015), 0.25,
                     (0.06, 0.24, 0.05), nf, heart=False)
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(*h), a,
                    rng.uniform(0.05, 0.3), rng.uniform(0.2, 0.6), nf, w=0.003)
        c, u, v, n = _head_frame(pts, rng, 0.8)
        r = rng.uniform(*r_head)
        cc = c + n * r * 0.7
        _ball(mb, cc, r * 0.55, _scale_c(col, 0.7), (0.4, 0.05, 0.2), rng, n=n, elong=1.0, spikes=0.1, rings=4, seg=8)
        nfl = int(rng.integers(34, 46))
        for k in range(nfl):
            # florets over the upper ~2/3 of a sphere, pointing out and a little up
            zc = 1.0 - 1.6 * (k + 0.5) / nfl
            ph = k * 2.39996
            rr = math.sqrt(max(0.0, 1 - zc * zc))
            d = (u * (rr * math.cos(ph)) + v * (rr * math.sin(ph)) + n * zc).normalized()
            up = (n - d * d.dot(n))
            up = up.normalized() if up.length > 1e-4 else u
            _petal(mb, cc + d * r * 0.4, d, up, r * rng.uniform(0.6, 0.85), r * 0.24, col2, _scale_c(col, rng.uniform(0.9, 1.1)),
                   lift=0.35, bend=0.3, cup=0.2, shape="strap", segs=2)
    return mb


def _buttercup(rng, heads=3, col=YELLOW):
    """Buttercup: five glossy cupped round petals, a green boss ringed with stamens."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.35))
    for hh in range(heads):
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(0.22, 0.42), a,
                    rng.uniform(0.05, 0.3), rng.uniform(0.2, 0.7), nf, w=0.0028)
        c, u, v, n = _head_frame(pts, rng, 0.8)
        R = rng.uniform(0.014, 0.02)
        _whorl(mb, c, u, v, n, 5, R * 0.1, R, R * 0.95, (0.95, 0.5, 0.02), col, rng, lift=(0.45, 0.75), bend=(-0.2, 0.0),
               cup=0.6, shape="round", jitter=0.08, segs=4)
        _bumpy_disc(mb, c + n * R * 0.15, u, v, n, R * 0.22, R * 0.2, (0.45, 0.6, 0.12), (0.3, 0.42, 0.08), rng, seg=8, rings=2)
        for k in range(10):
            ang = TAU * k / 10
            d = u * math.cos(ang) + v * math.sin(ang)
            _ball(mb, c + n * R * 0.3 + d * R * 0.28, R * 0.06, (1.0, 0.8, 0.1), (0.9, 0.6, 0.05), rng, elong=1.0,
                  spikes=0.0, rings=2, seg=4)
    return mb


def _seed_grass(rng, stems=2, h_rng=(0.45, 0.8)):
    """Seed-head grass: basal blades + tall stems with drooping panicles of spikelets (silvery straw)."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.5))
    for b in range(int(rng.integers(4, 8))):
        a = rng.uniform(0, TAU)
        _blade(mb, (0.01 * math.cos(a), 0.01 * math.sin(a), -0.01), rng.uniform(0.12, 0.28), rng.uniform(0.006, 0.01),
               a, rng.uniform(0.2, 0.5), rng.uniform(0.6, 1.3), 4, (0.02, 0.07, 0.02), (0.14, 0.34, 0.06), nf,
               (rng.random() * 0.9, 0.0))
    for st in range(stems):
        a = rng.uniform(0, TAU)
        h = rng.uniform(*h_rng)
        pts = _blade(mb, (0.012 * math.cos(a), 0.012 * math.sin(a), -0.01), h, 0.0045, a, rng.uniform(0.02, 0.16),
                     rng.uniform(0.1, 0.45), 7, (0.08, 0.2, 0.05), (0.42, 0.44, 0.22), nf, (rng.random() * 0.9, 0.5),
                     wshape=3.0, bulge=0.0)
        nseeds = int(rng.integers(12, 20))
        for k in range(nseeds):
            t = 0.74 + 0.26 * k / nseeds
            i = min(int(t * (len(pts) - 1)), len(pts) - 2)
            q = pts[i].lerp(pts[i + 1], t * (len(pts) - 1) - i)
            sa = a + (k * 2.4) + rng.normal(0, 0.3)
            L = rng.uniform(0.012, 0.022) * (1.15 - 0.5 * (t - 0.74) / 0.26)
            tipc = _lerp((0.5, 0.48, 0.3), (0.8, 0.78, 0.66), rng.uniform(0.3, 1.0))
            _blade(mb, q, L, 0.0045, sa, rng.uniform(0.5, 1.1), 0.4, 2, (0.45, 0.44, 0.25), tipc, nf, (0.5, 0.5),
                   wshape=1.0, bulge=0.5)
    return mb


def _green_bush(rng, R=0.55, cols=((0.02, 0.09, 0.025), (0.10, 0.28, 0.05))):
    """A dark-green leafy shrub (darker value notes in the meadow): domed mass of leaves, normals out of the dome."""
    mb = MB()
    nf = _dome_nf((0, 0, -R * 0.2))
    n = int(110 * (R / 0.55) ** 2)
    for k in range(n):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * 0.9 + 0.05
        d = d.normalized()
        p = Vector((d.x * R, d.y * R, d.z * R * 0.8 + R * 0.25)) * rng.uniform(0.55, 1.0)
        out = (d + Vector(rng.normal(0, 0.4, 3))).normalized()
        up = (Vector((0, 0, 1)) - out * out.z).normalized() if abs(out.z) < 0.95 else Vector((1, 0, 0))
        shade = min(1.0, max(0.0, 0.25 + 0.6 * d.z + rng.normal(0, 0.15)))
        c1 = _lerp(cols[0], cols[1], shade)
        L = rng.uniform(0.07, 0.12)
        _leaf(mb, p, out, up, L, L * 0.45, _scale_c(c1, 0.7), c1, nf)
    return mb


def _fern(rng, fronds=7, L_rng=(0.32, 0.6)):
    mb = MB()
    nf = _dome_nf((0, 0, -0.45))
    for f in range(fronds):
        a = TAU * f / fronds + rng.normal(0, 0.25)
        L = rng.uniform(*L_rng)
        pts = _blade(mb, (0.015 * math.cos(a), 0.015 * math.sin(a), -0.01), L, 0.006, a, rng.uniform(0.45, 0.95),
                     rng.uniform(0.9, 1.6), 10, (0.03, 0.1, 0.02), (0.10, 0.30, 0.05), nf, (rng.random() * 0.9, 0.0),
                     wshape=3.0, bulge=0.0)
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
                c0 = (0.05, 0.17, 0.03)
                c1 = _scale_c((0.20, 0.48, 0.07), rng.uniform(0.85, 1.15))
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
        colv = _lerp((0.05, 0.20, 0.04), (0.14, 0.40, 0.08), rng.random())
        for j in range(3):
            _leaflet(mb, pts[-1], base_az + j * TAU / 3, rng.uniform(0.008, 0.012), rng.uniform(0.0, 0.3), colv, nf)
    for k in range(flowers):
        rr = r * 0.8 * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        pts = _stem(mb, rng, (rr * math.cos(a), rr * math.sin(a), -0.005), rng.uniform(0.06, 0.12), a, 0.1, 0.3, nf,
                    w=0.0022)
        _ball(mb, pts[-1] + Vector((0, 0, 0.006)), rng.uniform(0.007, 0.009), (0.95, 0.92, 0.88), (0.75, 0.6, 0.55),
              rng, elong=1.0, spikes=0.5, rings=6, seg=11)
    return mb


def _flower_far(rng, col):
    """Distance flowers: a few simple upward-facing five-petal heads on short stems (a splash of one colour)."""
    mb = MB()
    nf = _dome_nf((0, 0, -0.3))
    U, V, N = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
    for k in range(int(rng.integers(4, 8))):
        r = 0.12 * math.sqrt(rng.random())
        a = rng.uniform(0, TAU)
        h = rng.uniform(0.1, 0.3)
        c = Vector((r * math.cos(a), r * math.sin(a), h))
        R = rng.uniform(0.028, 0.045)
        _whorl(mb, c, U, V, (N + Vector(rng.normal(0, 0.25, 3))).normalized(), 5, R * 0.1, R, R * 0.85,
               _scale_c(col, 0.8), col, rng, lift=(0.05, 0.25), cup=0.25, shape="round", segs=2)
        _blade(mb, (c.x * 0.8, c.y * 0.8, -0.01), h, 0.01, a, 0.1, 0.2, 2, (0.03, 0.1, 0.02), STEM, nf, (0.5, 0.2))
    return mb


def _leaf_cluster(rng, n=60, R=0.45, cols=((0.04, 0.17, 0.03), (0.22, 0.48, 0.07))):
    """Spring foliage clump: overlapping leaves on a flattened dome round a twig tip (layered, ragged edge)."""
    mb = MB()
    nf = _dome_nf((0, 0, -R * 0.8))
    for k in range(n):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * 0.8 + 0.12 * rng.normal()
        d = d.normalized()
        p = d * R * rng.uniform(0.3, 1.0) ** 0.7 * Vector((1.0, 1.0, 0.65))
        L = rng.uniform(0.06, 0.11)
        out = (d + Vector(rng.normal(0, 0.45, 3))).normalized()
        up = (Vector((0, 0, 1)) - out * out.z).normalized() if abs(out.z) < 0.95 else Vector((1, 0, 0))
        shade = min(1.0, max(0.0, 0.3 + 0.55 * d.z + rng.normal(0, 0.18)))
        c1 = _lerp(cols[0], cols[1], shade)
        _leaf(mb, p, out, up, L, L * 0.45, _scale_c(c1, 0.75), c1, nf)
    for k in range(3):
        d = Vector((rng.normal(0, 0.5), rng.normal(0, 0.5), -1.0)).normalized()
        tube(mb, [Vector((0, 0, 0)), d * R * 0.9], [0.008, 0.004], 4, (0.08, 0.05, 0.03), (0.12, 0.08, 0.05), cap=False)
    return mb


def _blossom_cluster(rng, col=(1.0, 0.56, 0.72), n=36, R=0.42, leaves=16, heart=(0.85, 0.25, 0.45)):
    """Blossom clump: five-petal blossoms (rounded petals, darker hearts, gold stamens) over fresh leaves."""
    mb = MB()
    nf = _dome_nf((0, 0, -R * 0.8))
    for k in range(leaves):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * 0.5
        p = d.normalized() * R * rng.uniform(0.3, 0.85)
        out = (d + Vector(rng.normal(0, 0.4, 3))).normalized()
        L = rng.uniform(0.06, 0.1)
        _leaf(mb, p, out, Vector((0, 0, 1)), L, L * 0.45, (0.08, 0.26, 0.04), (0.26, 0.5, 0.08), nf)
    for k in range(n):
        d = Vector(rng.normal(0, 1, 3)).normalized()
        d.z = abs(d.z) * 0.85 + 0.15
        d = d.normalized()
        c = d * R * rng.uniform(0.45, 1.0) * Vector((1.0, 1.0, 0.7))
        nn = (d + Vector(rng.normal(0, 0.3, 3))).normalized()
        u = nn.cross(Vector((0.31, 0.77, 0.12))).normalized()
        v = nn.cross(u).normalized()
        r = rng.uniform(0.02, 0.032)
        cc = _scale_c(col, rng.uniform(0.9, 1.08))
        _whorl(mb, c, u, v, nn, 5, r * 0.12, r, r * 0.9, _lerp(cc, heart, 0.45), cc, rng, lift=(0.1, 0.4), cup=0.35,
               shape="round", jitter=0.1, segs=2)
        _ball(mb, c + nn * 0.003, r * 0.14, (1.0, 0.85, 0.35), (0.9, 0.6, 0.2), rng, elong=0.6, spikes=0.3, rings=2, seg=5)
    return mb


def _blob(rng, R=0.55, col=(0.18, 0.40, 0.06), col2=(0.05, 0.16, 0.03)):
    """Distance foliage: a lumpy painted blob (a few overlapping balls)."""
    mb = MB()
    for k in range(4):
        c = Vector(rng.normal(0, R * 0.3, 3)) * Vector((1, 1, 0.6))
        _ball(mb, c, R * rng.uniform(0.55, 0.8), col, col2, rng, elong=0.75, spikes=0.25, rings=4, seg=7)
    return mb


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
    from . import envmat
    M = {}
    M["grass"] = bpy.data.materials.get("CoverGrass") or mat.painterly(
        "CoverGrass", (1, 1, 1), stroke="strokes_vert", scale=1.0, coord="UV", tex_amt=0.8, hue_jit=0.06, bump=0.0,
        breakup=1.3, wrap=0.3, translucent=0.35, albedo_fn=_inst_albedo(), backface=True, snow=0.0)
    M["grass_hero"] = bpy.data.materials.get("CoverGrassHero") or mat.painterly(
        "CoverGrassHero", (1, 1, 1), stroke="strokes_vert", scale=1.0, coord="UV", tex_amt=0.8, hue_jit=0.06, bump=0.0,
        breakup=1.3, wrap=0.3, translucent=0.35, albedo_fn=_inst_albedo(), backface=True, snow=0.0, alpha_tex=_fray)
    M["flower"] = bpy.data.materials.get("CoverFlower") or mat.painterly(
        "CoverFlower", (1, 1, 1), stroke="strokes_fine", scale=1.5, coord="UV", tex_amt=0.45, hue_jit=0.04, bump=0.0,
        breakup=1.0, wrap=0.35, translucent=0.3, albedo_fn=_inst_albedo(), backface=True, snow=0.0)
    if bpy.data.materials.get("CoverLeaf") is None:
        m = mat.painterly("CoverLeaf", (1, 1, 1), stroke="strokes_fine", scale=2.0, coord="UV", tex_amt=0.6,
                          hue_jit=0.05, bump=0.0, breakup=1.3, wrap=0.2, translucent=0.4, albedo_fn=_inst_albedo(),
                          backface=True, snow=0.0)
        envmat.canopy_normals(m)
    M["leaf"] = bpy.data.materials.get("CoverLeaf")
    M["char"] = bpy.data.materials.get("CoverChar") or mat.painterly(
        "CoverChar", (1, 1, 1), stroke="strokes_fine", scale=3.0, coord="Object", tex_amt=0.9, hue_jit=0.02,
        bump=0.25, breakup=1.3, spec=0.5, rough=0.3, spec_col=(0.5, 0.52, 0.58), albedo_fn=_inst_albedo(), snow=0.0)
    M["stone"] = envmat.rock("CoverStone", base=(0.31, 0.295, 0.30), scale=3.0)
    M["coal"] = _coal_mat()
    M["log"] = envmat.char_bark("CharLog", cell=30.0, base_glow=False, glow_k=0.25)
    return M


def _coal_mat():
    """Glowing coal: charcoal with bright orange cracks (keyed by LU_Env Ember, flickering)."""
    from . import envmat
    m = bpy.data.materials.get("CoverCoal")
    if m:
        return m
    S = {}

    def alb(nb, co):
        v = nb.n("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE", voronoi_dimensions="3D")
        v.inputs["Scale"].default_value = 60.0
        nb.link(co, v.inputs["Vector"])
        S["crack"] = nb.mapr(v.outputs["Distance"], 0.08, 0.02)
        return nb.mix(S["crack"], (0.03, 0.025, 0.022), (0.01, 0.006, 0.004))

    m = mat.painterly("CoverCoal", (1, 1, 1), stroke="strokes_fine", scale=8.0, coord="Object", tex_amt=0.7,
                      spec=0.4, rough=0.3, spec_col=(0.5, 0.5, 0.55), albedo_fn=alb, snow=0.0)

    def glow(nb):
        E = envmat.env(nb)
        oi = nb.n("ShaderNodeObjectInfo")
        tn = nb.n("ShaderNodeTexNoise", inputs={"Scale": 1.0, "Detail": 0.0}, noise_dimensions="2D")
        cv = nb.n("ShaderNodeCombineXYZ")
        nb.inp(cv, "X", nb.mul(E.outputs["Time"], 1.3))
        nb.inp(cv, "Y", nb.mul(oi.outputs["Random"], 50.0))
        nb.link(cv.outputs[0], tn.inputs["Vector"])
        fl = nb.mapr(tn.outputs["Fac"], 0.3, 0.7, 0.35, 1.3)
        e = nb.mul(nb.mul(nb.add(nb.mul(S["crack"], 1.0), 0.12), fl), nb.mul(E.outputs["Ember"], nb.sub(1.0, E.outputs["Wet"])))
        c = nb.mix(nb.mapr(S["crack"], 0.2, 1.0), (0.9, 0.12, 0.01), (1.0, 0.55, 0.12))
        return envmat._scale(nb, c, nb.mul(e, 6.0))

    envmat._patch_emission(m, glow)
    return m


# ===================================================================== prototype library
_LIB = None


def protos():
    """Build (once per scene) the prototype collection; returns dict kind -> list of proto indices (+ 'lod')."""
    global _LIB
    coll = bpy.data.collections.get(PROTO_COLL)
    if coll is not None and _LIB is not None and _LIB.get("_coll") == coll:
        return _LIB
    coll = bpy.data.collections.new(PROTO_COLL)
    bpy.context.scene.collection.children.link(coll)
    M = cover_mats()
    rng = np.random.default_rng(101)
    lib = {"_coll": coll, "lod": {}}
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

    # ---- ash phase
    for i in range(4):
        add("tuft", _burnt_tuft(rng), M["char"])
    for i in range(3):
        add("twigs", _twigs(rng), M["char"])
    for i in range(3):
        add("cinders", _cinders(rng), M["char"])
    for i in range(2):
        add("coal", _cinders(rng, n=int(rng.integers(3, 6)), size=(0.015, 0.04)), M["coal"])
    for i in range(2):
        add("crumb", _cinders(rng, n=int(rng.integers(5, 9)), size=(0.006, 0.02), col=(0.06, 0.04, 0.025)), M["char"])
    for i in range(3):
        add("shrub", _shrub(rng), M["char"])
    for i in range(3):
        add("branch", _branch_log(rng), M["log"])
    for i in range(6):
        add("stone", _rock_proto("stone", coll, M["stone"], seed=300 + i, squash=rng.uniform(0.4, 0.7)), None)
    for i in range(3):
        add("pebble", _rock_proto("pebble", coll, M["stone"], seed=400 + i, squash=0.5, strata=False), None)
    # ---- bloom
    pals = ["emerald", "chart", "yellow", "blue"]
    for i in range(4):
        add("grass_s", _grass_clump(rng, 16, (0.07, 0.16), (0.010, 0.016), 0.06, segs=4, pal=pals[i]), M["grass"])
    for i in range(4):
        add("grass_m", _grass_clump(rng, 18, (0.16, 0.34), (0.012, 0.02), 0.08, segs=5, pal=pals[i]), M["grass"])
    for i in range(2):
        add("grass_t", _grass_clump(rng, 12, (0.32, 0.55), (0.012, 0.02), 0.07, segs=6, bend=(0.5, 1.5),
                                    pal=pals[i * 2 + 1]), M["grass"])
    for i in range(4):
        add("grass_far", _grass_clump(rng, 9, (0.18, 0.38), (0.03, 0.045), 0.13, segs=3, pal=pals[i]), M["grass"])
    for i in range(2):
        add("moss", _moss(rng), M["grass"])
    for i in range(2):
        add("fern", _fern(rng, fronds=int(rng.integers(5, 8))), M["grass"])
    add("clover", _clover_patch(rng, leaves=26, flowers=3), M["grass"])
    for i in range(3):
        add("seed", _seed_grass(rng, stems=int(rng.integers(1, 4))), M["grass"])
    for i, (R, cols) in enumerate(((0.45, ((0.015, 0.07, 0.02), (0.08, 0.24, 0.05))),
                                   (0.6, ((0.02, 0.08, 0.03), (0.12, 0.28, 0.06))),
                                   (0.75, ((0.015, 0.06, 0.03), (0.06, 0.22, 0.09))))):
        add("bush", _green_bush(rng, R=R, cols=cols), M["leaf"])
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
    add("cosmos", _cosmos(rng, heads=2), M["flower"])
    add("cosmos", _cosmos(rng, heads=2, col=(0.98, 0.9, 0.92)), M["flower"])
    add("cosmos", _cosmos(rng, heads=1, col=(0.85, 0.12, 0.45)), M["flower"])
    for c in (MAGENTA, PINK, WHITE, YELLOW, BLUE, VIOLET):
        add("flower_far", _flower_far(rng, c), M["flower"])
    # ---- tree foliage: fresh leaves in four greens, pink / deep-pink / white blossom
    LEAF_COLS = (((0.03, 0.15, 0.03), (0.16, 0.42, 0.06)),       # spring green
                 ((0.02, 0.11, 0.04), (0.07, 0.32, 0.09)),       # emerald
                 ((0.05, 0.15, 0.02), (0.30, 0.44, 0.07)),       # yellow-green (young)
                 ((0.015, 0.09, 0.05), (0.06, 0.26, 0.15)))      # blue-green
    for cols in LEAF_COLS:
        add("leaf", _leaf_cluster(rng, cols=cols), M["leaf"])
    add("blossom_p", _blossom_cluster(rng, col=(1.0, 0.55, 0.72)), M["leaf"])
    add("blossom_p", _blossom_cluster(rng, col=(0.95, 0.38, 0.62), heart=(0.7, 0.12, 0.35)), M["leaf"])
    add("blossom_w", _blossom_cluster(rng, col=(0.97, 0.94, 0.93), heart=(0.9, 0.6, 0.65)), M["leaf"])
    add("blossom_w", _blossom_cluster(rng, col=(1.0, 0.86, 0.88), heart=(0.9, 0.45, 0.55)), M["leaf"])
    # ---- LOD map (hi -> lo), used by cull() for far instances (grass and flowers only: canopies keep their
    # clusters, thinned and scaled up with distance, so trees never become blobs)
    for kind in ("grass_s", "grass_m", "grass_t"):
        for j, i in enumerate(lib[kind]):
            lib["lod"][i] = lib["grass_far"][[1, 3][j % 2] if kind == "grass_t" else j % 4]
    fl_far = {"daisy": 2, "corn": 4, "violet": 5, "pclover": 0, "butter": 3, "cosmos": 1}
    for k, j in fl_far.items():
        for i in lib[k]:
            lib["lod"][i] = lib["flower_far"][j]
    lib["lod"][lib["cosmos"][1]] = lib["flower_far"][2]
    lib["lod"][lib["cosmos"][2]] = lib["flower_far"][0]
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

    def time(self):
        return self.n("GeometryNodeInputSceneTime").outputs["Seconds"]


def wind_lean(G, pos, flex, rnd):
    """World-space lean vector for breeze + gusts, read from the LU_Wind empty (see foliage.wind)."""
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
    t = G.time()
    s = G.vm("DOT_PRODUCT", pos, dirv)
    ph = G.mul(rnd, TAU)
    w1 = G.math("SINE", G.add(G.sub(G.mul(t, 1.9), G.mul(s, 0.55)), ph))
    drift = G.vm("SUBTRACT", G.vm("SCALE", pos, scale=0.22), G.vm("SCALE", dirv, scale=G.mul(t, 0.8)))
    n1 = G.mul(G.sub(G.noise(drift, 1.0, 1.0), 0.5), 3.0)
    n2 = G.mul(G.sub(G.noise(G.vm("ADD", drift, (13.1, 7.7, 3.3)), 1.0, 1.0), 0.5), 3.0)
    bz = G.mul(breeze, flex)
    b_amt = G.mul(bz, G.add(G.add(0.045, G.mul(w1, 0.04)), G.mul(n1, 0.06)))
    u = G.sub(front, s)
    mask = G.mapr(u, -0.4, 2.5)
    band = G.math("POWER", G.add(0.5, G.mul(G.math("COSINE", G.math("DIVIDE", G.mul(u, TAU), G.math("MAXIMUM", lam, 0.5))), 0.5)), 2.0)
    gz = G.mul(G.mul(gust, flex), mask)
    g_amt = G.mul(gz, G.add(0.3, G.mul(band, 0.55)))
    flutter = G.mul(gz, G.mul(0.07, G.math("SINE", G.add(G.add(G.mul(t, 13.0), G.mul(s, 6.0)), ph))))
    along = G.add(G.add(b_amt, g_amt), flutter)
    across = G.mul(n2, G.add(G.mul(bz, 0.035), G.mul(gz, 0.09)))
    return G.vm("ADD", G.vm("SCALE", dirv, scale=along), G.vm("SCALE", perp, scale=across))


def bloom_dist_gn(G, pos):
    """terrain.bloom_dist in geometry nodes."""
    x, y, _z = G.sep(pos)
    px, py = layout.PEAK_SOIL
    dx, dy = G.sub(x, px), G.sub(y, py)
    d = G.math("SQRT", G.add(G.mul(dx, dx), G.mul(dy, dy)))
    w = None
    for (A, k1x, k1y, p1, k2x, k2y, p2) in terrain.BLOOM_WARP:
        s1 = G.math("SINE", G.add(G.add(G.mul(x, k1x), G.mul(y, k1y)), p1))
        s2 = G.math("SINE", G.add(G.add(G.mul(x, k2x), G.mul(y, k2y)), p2))
        t = G.mul(G.mul(s1, s2), A)
        w = t if w is None else G.add(w, t)
    return G.add(d, G.mul(w, G.mapr(d, terrain.BLOOM_WARP_R[0], terrain.BLOOM_WARP_R[1])))


def bloom_radius_gn(G):
    from . import envmat
    oi = G.n("GeometryNodeObjectInfo", transform_space="ORIGINAL")
    oi.inputs["Object"].default_value = envmat.bloom_empty()
    return G.sep(oi.outputs["Location"])[0]


def growth_gn(G, pos, gmode, bdel, glen):
    """Scale factor from the bloom wave: grow (+1) springy 0 -> 1 (slight overshoot), wither (-1) 1 -> 0."""
    R = bloom_radius_gn(G)
    x = G.sub(G.sub(R, bloom_dist_gn(G, pos)), bdel)
    g = G.math("DIVIDE", G.math("MAXIMUM", x, 0.0), G.math("MAXIMUM", glen, 0.1))
    spring = G.sub(1.0, G.mul(G.math("EXPONENT", G.mul(g, -6.0)), G.math("COSINE", G.mul(G.math("MINIMUM", g, 3.0), 7.0))))
    grow = G.mul(spring, G.math("GREATER_THAN", x, 0.0))
    wither = G.sub(1.0, G.mapr(g, 0.0, 0.6))
    isg = G.math("GREATER_THAN", gmode, 0.5)
    isw = G.math("LESS_THAN", gmode, -0.5)
    f = G.add(1.0, G.add(G.mul(isg, G.sub(grow, 1.0)), G.mul(isw, G.sub(wither, 1.0))))
    return f


def cover_group(coll_name=PROTO_COLL, name="LU_CoverGN", wind=True, bloom=True):
    g = bpy.data.node_groups.get(name)
    if g:
        return g
    coll = bpy.data.collections[coll_name]
    g = bpy.data.node_groups.new(name, "GeometryNodeTree")
    g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
    g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
    G = GB(g)
    gi = G.n("NodeGroupInput")
    go = G.n("NodeGroupOutput")
    pos = G.n("GeometryNodeInputPosition").outputs[0]
    pts = gi.outputs[0]
    sc = G.attr("scale", "FLOAT")
    if bloom:
        f = growth_gn(G, pos, G.attr("gmode"), G.attr("bdel"), G.attr("glen"))
        sc = G.mul(sc, f)
        # stable ids (motion blur matches instances across frames even as some appear / vanish)
        sid = G.n("GeometryNodeStoreNamedAttribute", data_type="INT", domain="POINT")
        G.set(sid, "Geometry", pts)
        sid.inputs["Name"].default_value = "id"
        G.set(sid, 3, G.n("GeometryNodeInputIndex").outputs[0])
        pts = sid.outputs[0]
        # drop instances that are (still / already) invisible
        dl = G.n("GeometryNodeDeleteGeometry", domain="POINT")
        G.set(dl, "Geometry", pts)
        G.set(dl, "Selection", G.math("LESS_THAN", sc, 1e-4))
        pts = dl.outputs[0]
        sp = G.n("GeometryNodeSetPosition")
        G.set(sp, "Geometry", pts)
        sink = G.mul(G.math("LESS_THAN", G.attr("gmode"), -0.5), G.mul(G.sub(1.0, f), -0.04))
        G.set(sp, "Offset", G.xyz(0.0, 0.0, sink))
        pts = sp.outputs[0]
    ci = G.n("GeometryNodeCollectionInfo", transform_space="ORIGINAL")
    ci.inputs["Collection"].default_value = coll
    ci.inputs["Separate Children"].default_value = True
    ci.inputs["Reset Children"].default_value = True
    iop = G.n("GeometryNodeInstanceOnPoints")
    G.set(iop, "Points", pts)
    G.set(iop, "Instance", ci.outputs[0])
    iop.inputs["Pick Instance"].default_value = True
    G.set(iop, "Instance Index", G.attr("proto", "INT"))
    e2r = G.n("FunctionNodeEulerToRotation")
    G.set(e2r, 0, G.attr("rot", "FLOAT_VECTOR"))
    G.set(iop, "Rotation", e2r.outputs[0])
    G.set(iop, "Scale", G.xyz(sc, sc, sc))
    out = iop.outputs[0]
    pos2 = G.n("GeometryNodeInputPosition").outputs[0]
    lean = G.attr("lean", "FLOAT_VECTOR")
    if wind:
        lean = G.vm("ADD", wind_lean(G, pos2, G.attr("flex", "FLOAT"), G.rand(0, 1, 11)), lean)
    lx, ly, _ = G.sep(lean)
    axis = G.vm("NORMALIZE", G.xyz(G.sub(-1e-5, ly), lx, 0.0))
    ang = G.vm("LENGTH", G.xyz(lx, ly, 0.0))
    aa = G.n("FunctionNodeAxisAngleToRotation")
    G.set(aa, "Axis", axis)
    G.set(aa, "Angle", ang)
    ri = G.n("GeometryNodeRotateInstances")
    G.set(ri, "Instances", out)
    G.set(ri, "Rotation", aa.outputs[0])
    G.set(ri, "Pivot Point", pos2)
    ri.inputs["Local Space"].default_value = False
    G.set(go, 0, ri.outputs[0])
    return g


# ===================================================================== point clouds
ATTRS = (("proto", "INT", 1), ("rot", "FLOAT_VECTOR", 3), ("scale", "FLOAT", 1), ("tint", "FLOAT_COLOR", 4),
         ("flex", "FLOAT", 1), ("lean", "FLOAT_VECTOR", 3), ("gmode", "FLOAT", 1), ("bdel", "FLOAT", 1),
         ("glen", "FLOAT", 1), ("cn", "FLOAT_VECTOR", 3))


def _cloud(name, P, collection=None, group=None):
    col = collection or geo.coll("Cover")
    n = len(P["co"])
    P = _defaults(P)
    me = bpy.data.meshes.new(name)
    me.vertices.add(n)
    me.vertices.foreach_set("co", np.asarray(P["co"], dtype=np.float32).ravel())
    _write_attrs(me, P, n)
    me.update()
    ob = bpy.data.objects.new(name, me)
    col.objects.link(ob)
    mod = ob.modifiers.new("Cover", "NODES")
    mod.node_group = group or cover_group()
    return ob


def _defaults(P):
    n = len(P["co"])
    P = dict(P)
    P.setdefault("gmode", np.zeros(n))
    P.setdefault("bdel", np.zeros(n))
    P.setdefault("glen", np.full(n, 8.0))
    P.setdefault("lean", np.zeros((n, 3)))
    P.setdefault("flex", np.zeros(n))
    P.setdefault("tint", np.ones((n, 3)))
    P.setdefault("cn", np.zeros((n, 3)))
    return P


def _write_attrs(me, P, n):
    for an, at, k in ATTRS:
        a = me.attributes.new(an, at, "POINT")
        v = np.asarray(P[an])
        if an == "tint":
            v = np.concatenate([v[:, :3], np.ones((n, 1))], 1)
        key = "value" if k == 1 else ("color" if at == "FLOAT_COLOR" else "vector")
        a.data.foreach_set(key, v.astype(np.int32 if at == "INT" else np.float32).ravel())


def _read(ob):
    me = ob.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float32)
    me.vertices.foreach_get("co", co)
    P = {"co": co.reshape(-1, 3)}
    for an, at, k in ATTRS:
        a = me.attributes.get(an)
        if a is None:
            continue
        kk = 4 if at == "FLOAT_COLOR" else k
        buf = np.empty(n * kk, dtype=np.int32 if at == "INT" else np.float32)
        a.data.foreach_get("value" if k == 1 else ("color" if at == "FLOAT_COLOR" else "vector"), buf)
        P[an] = buf.reshape(-1, kk)[:, :3] if kk > 1 else buf
    return P


def _write(ob, P, keep=None):
    if keep is not None:
        P = {k: v[keep] for k, v in P.items()}
    me = ob.data
    nm = me.name
    new = bpy.data.meshes.new(nm + "_")
    n = len(P["co"])
    new.vertices.add(n)
    new.vertices.foreach_set("co", np.asarray(P["co"], dtype=np.float32).ravel())
    _write_attrs(new, _defaults(P), n)
    new.update()
    ob.data = new
    bpy.data.meshes.remove(me)
    new.name = nm


def clouds(prefix=("Cover", "Forest", "Leaves")):
    return [o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith(tuple(prefix))
            and o.modifiers.get("Cover")]


# ===================================================================== scatter helpers
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
    pool = np.array(sum((lib[k] for k in kinds), []))
    return pool[rng.integers(0, len(pool), n)]


def _tints(x, y, rng, n, val=0.14, hue=0.5, seed=0):
    nv = 0.65 * terrain.fbm(x, y, 40 + seed, 3.0, 2) + 0.35 * terrain.fbm(x, y, 45 + seed, 0.7, 2)
    nh = terrain.fbm(x, y, 50 + seed, 4.5, 2)
    v = 1.0 + val * nv * 1.6 + rng.normal(0, 0.06, n)
    warm = np.clip(nh, 0, 1)[:, None] * hue
    cool = np.clip(-nh, 0, 1)[:, None] * hue
    t = np.ones((n, 3)) * v[:, None]
    t = t * (1 + warm * 0.45 * (np.array([1.35, 1.1, 0.55]) - 1))
    t = t * (1 + cool * 0.45 * (np.array([0.75, 0.98, 1.3]) - 1))
    return np.clip(t, 0.3, 1.7)


def surface(x, y):
    """Ground height for instances: the hero patches' micro relief where they exist, else the base heightfield."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    z = terrain.height(x, y)
    active = getattr(terrain, "ACTIVE_HERO", ())
    if not active:
        return z
    inside = np.zeros(x.shape, dtype=bool)
    for h in active:
        H = terrain.HERO[h]
        if H["kind"] == "rect":
            x0, x1, y0, y1 = H["rect"]
            inside |= (x > x0 + 0.7) & (x < x1 - 0.7) & (y > y0 + 0.7) & (y < y1 - 0.7)
        else:
            box = (x > -6) & (x < 56) & (y > 64) & (y < 172)
            if box.any():
                dd = np.full(x.shape, 1e9)
                dd[box] = terrain.dist_to_path(x[box], y[box])
                inside |= dd < H["half"] - 0.7
    if inside.any():
        z = z.copy()
        z[inside] = terrain.height_micro(x[inside], y[inside]) + 0.012
    return z


def _pack(X, Y, protos_, scale, flex, tint, rng, tilt=0.08, zoff=0.0, gmode=0.0, bdel=None, glen=8.0):
    n = len(X)
    Z = surface(X, Y) + zoff
    rot = np.stack([rng.normal(0, tilt, n), rng.normal(0, tilt, n), rng.uniform(0, TAU, n)], 1)
    return dict(co=np.stack([X, Y, Z], 1), proto=np.asarray(protos_).astype(np.int32), rot=rot,
                scale=np.asarray(scale, dtype=float), tint=tint, flex=np.asarray(flex, dtype=float) * np.ones(n),
                lean=np.zeros((n, 3)), gmode=np.full(n, float(gmode)),
                bdel=np.zeros(n) if bdel is None else np.asarray(bdel, dtype=float),
                glen=np.full(n, float(glen)))


def _cat(parts):
    parts = [p for p in parts if p is not None and len(p["co"])]
    if not parts:
        return None
    return {k: np.concatenate([p[k] for p in parts], 0) for k in parts[0]}


AREAS = {   # name -> (bbox x0, x1, y0, y1, density weight fn)
    "stump": (-13.0, 13.0, -13.0, 11.0),
    "summit": (layout.PEAK[0] - 17.0, layout.PEAK[0] + 17.0, layout.PEAK[1] - 18.0, layout.PEAK[1] + 14.0),
    "climb": (-6.0, 56.0, 64.0, 172.0),
    "valley": (-190.0, 200.0, -170.0, 240.0),
}
KEEP = []          # [(x, y, r)] bare circles (the stump, the ledge rock, props): set by world


def _area_mask(name, X, Y):
    if isinstance(name, tuple):
        cx, cy, r = name
        return np.hypot(X - cx, Y - cy) < r
    x0, x1, y0, y1 = AREAS[name]
    m = (X > x0) & (X < x1) & (Y > y0) & (Y < y1)
    if name == "climb":
        dd = np.full(X.shape, 1e9)
        dd[m] = terrain.dist_to_path(X[m], Y[m])
        m &= dd < 11.0
    return m


def _bbox(name):
    if isinstance(name, tuple):
        cx, cy, r = name
        return (cx - r, cx + r, cy - r, cy + r)
    return AREAS[name]


def _keep_ok(X, Y, extra=()):
    ok = np.ones(X.shape, dtype=bool)
    for (kx, ky, kr) in list(KEEP) + list(extra):
        ok &= np.hypot(X - kx, Y - ky) > kr
    return ok


def _spacing(area, near, far):
    return near if area in ("stump", "summit", "climb") or isinstance(area, tuple) else far


def _sample(area, spacing, rng, extra_keep=()):
    x0, x1, y0, y1 = _bbox(area)
    X, Y = _grid(x0, x1, y0, y1, spacing, rng)
    m = _area_mask(area, X, Y) & _keep_ok(X, Y, extra_keep)
    if area == "valley":           # the hero areas get their own (denser, full-detail) scatter
        for h in ("stump", "summit", "climb"):
            m &= ~_area_mask(h, X, Y)
    return X[m], Y[m]


def _slope_ok(X, Y, lim=0.75):
    return terrain.slope(X, Y) < lim


# ===================================================================== ash cover
def ash_cover(areas=("stump", "climb", "summit", "valley"), seed=7, density=1.0, wither=True, name="CoverAsh",
              collection=None):
    """The burnt valley's dressing: burnt grass stubble, charred twigs and cinders, glowing coals (embers), dead burnt
    shrubs, charred fallen branches, strata stones and pebbles. Dense in the hero areas, sparse in the valley.
    wither=True: it withers into the ground behind the bloom wave."""
    lib = protos()
    rng = np.random.default_rng(seed)
    parts = []
    gm = -1.0 if wither else 0.0
    for area in areas:
        hero = area != "valley"
        k = density * (1.0 if hero else 0.3)
        # tufts + cinders + twigs: fine scatter
        sp = 0.22 if hero else 0.9
        X, Y = _sample(area, sp, rng)
        ok = _slope_ok(X, Y, 0.85)
        X, Y = X[ok], Y[ok]
        nz = terrain.fbm(X, Y, 71, 3.0, 2)
        dens = k * (6.0 + 9.0 * _ss(-0.3, 0.5, nz))
        if area == "stump":
            dens = dens * 1.8
        if not hero:
            dens = dens * 2.2
        X, Y = _thin(X, Y, dens, sp, rng)
        n = len(X)
        r = rng.random(n)
        pr = np.where(r < 0.5, _choose(rng, ["tuft"], lib, n),
                      np.where(r < 0.72, _choose(rng, ["cinders"], lib, n),
                               np.where(r < 0.9, _choose(rng, ["twigs"], lib, n), _choose(rng, ["pebble"], lib, n))))
        sc = rng.uniform(0.7, 1.4, n) * np.where(pr == lib["pebble"][0], 0.04, 1.0)
        sc = np.where(np.isin(pr, lib["pebble"]), rng.uniform(0.015, 0.05, n), sc)
        tint = np.clip(1 + rng.normal(0, 0.12, (n, 1)) * np.ones((1, 3)), 0.6, 1.5)
        parts.append(_pack(X, Y, pr, sc, 0.25, tint, rng, tilt=0.15, gmode=gm, bdel=rng.uniform(0, 6, n), glen=10.0))
        # glowing coals (valley floor + stump area; not on the mountain)
        sp = 0.6 if hero else 3.0
        X, Y = _sample(area, sp, rng)
        zm = terrain._mountain(X, Y)
        X, Y = X[zm < 4.0], Y[zm < 4.0]
        X, Y = _thin(X, Y, k * 0.9 * _ss(0.1, 0.6, terrain.fbm(X, Y, 72, 6.0, 2)) * (1.0 if hero else 2.5), sp, rng)
        n = len(X)
        parts.append(_pack(X, Y, _choose(rng, ["coal"], lib, n), rng.uniform(0.7, 1.3, n), 0.0, np.ones((n, 3)), rng,
                           tilt=0.3, zoff=-0.01, gmode=gm, glen=6.0))
        # dead shrubs + fallen branches
        sp = 1.2 if hero else 4.0
        X, Y = _sample(area, sp, rng)
        ok = _slope_ok(X, Y, 0.65)
        X, Y = X[ok], Y[ok]
        X, Y = _thin(X, Y, k * 0.32 * (1.0 if hero else 3.0), sp, rng)
        n = len(X)
        isb = rng.random(n) < 0.45
        pr = np.where(isb, _choose(rng, ["branch"], lib, n), _choose(rng, ["shrub"], lib, n))
        sc = np.where(isb, rng.uniform(0.7, 1.5, n), rng.uniform(0.6, 1.4, n))
        parts.append(_pack(X, Y, pr, sc, np.where(isb, 0.0, 0.15), np.ones((n, 3)), rng, tilt=0.06, zoff=-0.01,
                           gmode=gm, bdel=rng.uniform(0, 4, n), glen=14.0))
        # strata stones: more on the mountain, clustered
        sp = 0.9 if hero else 3.0
        X, Y = _sample(area, sp, rng)
        zm = terrain._mountain(X, Y)
        cl = _ss(0.0, 0.6, terrain.fbm(X, Y, 73, 5.0, 2))
        dens = k * (0.25 + 1.6 * cl * _ss(3.0, 12.0, zm)) * (1.0 if hero else 1.5)
        X, Y = _thin(X, Y, dens, sp, rng)
        n = len(X)
        zm = terrain._mountain(X, Y)
        sc = rng.uniform(0.06, 0.32, n) * (1 + 1.5 * _ss(5, 20, zm) * rng.random(n))
        parts.append(_pack(X, Y, _choose(rng, ["stone"], lib, n), sc, 0.0, _tints(X, Y, rng, n, 0.12, 0.2, 4), rng,
                           tilt=0.2, zoff=-0.03))
    P = _cat(parts)
    return _cloud(name, P, collection) if P is not None else None


# ===================================================================== bloom meadow
def meadow(areas=("stump", "climb", "summit", "valley"), seed=11, density=1.0, grow=True, lush=1.0, name="CoverMeadow",
           collection=None):
    """Spring meadow, art-directed: grass in palette patches with height zones (short turf, mid grass, tall grass and
    seed-head drifts), wildflowers in single-species drifts with negative space between them (magenta clover, pink
    cosmos, white daisies, butter-yellow buttercups, cornflower blue, lavender violets), dark-green shrubs and moss
    cushions as low value notes, ferns in the damp hollows. grow=True: grows in behind the bloom wave (springy; the
    flowers open after the grass). lush scales density (the coda is denser)."""
    lib = protos()
    rng = np.random.default_rng(seed)
    parts = []
    gm = 1.0 if grow else 0.0
    kinds = ["pclover", "cosmos", "daisy", "butter", "corn", "violet"]
    for area in areas:
        hero = area != "valley"
        k = density * lush
        # ---------------- grass (height zones: turf / meadow / tall; palette patches)
        sp = 0.16 if hero else 0.8
        X, Y = _sample(area, sp, rng)
        sl = terrain.slope(X, Y)
        X, Y, sl = X[sl < 0.8], Y[sl < 0.8], sl[sl < 0.8]
        nz = terrain.fbm(X, Y, 81, 4.0, 2)
        dens = k * (11.0 + 24.0 * _ss(-0.4, 0.4, nz)) * (1 - _ss(0.5, 0.8, sl)) * (1.0 if hero else 0.55)
        X, Y = _thin(X, Y, dens, sp, rng)
        n = len(X)
        palsel = np.clip(((terrain.fbm(X, Y, 82, 9.0, 2) * 0.5 + 0.5) * 4 + rng.normal(0, 0.35, n)).astype(int), 0, 3)
        zone = terrain.fbm(X, Y, 83, 7.0, 3) + 0.25 * terrain.fbm(X, Y, 87, 1.5, 2)
        pr = np.where(zone < -0.2, np.array(lib["grass_s"])[palsel], np.array(lib["grass_m"])[palsel])
        tallz = zone > 0.3
        pr = np.where(tallz & (rng.random(n) < 0.55), _choose(rng, ["grass_t"], lib, n), pr)
        pr = np.where(tallz & (rng.random(n) < 0.12), _choose(rng, ["seed"], lib, n), pr)
        if not hero:
            pr = np.array([lib["lod"].get(int(i), int(i)) for i in pr])
        sc = rng.uniform(0.75, 1.25, n) * (1 + 0.35 * np.clip(zone, -0.6, 0.8))
        bd = rng.uniform(0, 8, n)
        parts.append(_pack(X, Y, pr, sc, rng.uniform(0.8, 1.2, n), _tints(X, Y, rng, n, 0.2, 0.55, 0), rng, tilt=0.07,
                           gmode=gm, bdel=bd, glen=26.0))
        # ---------------- wildflowers: single-species drifts, negative space between them
        sp = 0.11 if hero else 0.65
        X, Y = _sample(area, sp, rng)
        sl = terrain.slope(X, Y)
        ok = sl < 0.7
        X, Y = X[ok], Y[ok]
        fields = np.stack([terrain.fbm(X, Y, 90 + i, 6.5 + i * 0.8, 3) + 0.35 * terrain.fbm(X, Y, 100 + i, 1.3, 2)
                           for i in range(len(kinds))], 1)
        bias = np.array([0.0, -0.08, 0.06, 0.04, 0.02, -0.02])
        fields = fields + bias[None, :]
        # the summit (B17-B20 close-ups): white, butter-yellow and blue drifts round the soil, pink further out
        near = 1 - _ss(4.0, 14.0, np.hypot(X - layout.PEAK_SOIL[0], Y - layout.PEAK_SOIL[1]))
        fields = fields + near[:, None] * np.array([-0.3, -0.3, 0.3, 0.22, 0.24, 0.08])[None, :]
        si = np.argmax(fields, 1)
        best = fields[np.arange(len(X)), si]
        drift = _ss(0.12, 0.45, best)                       # inside a drift; most of the meadow is just grass
        scatter = 0.06                                       # a few strays everywhere
        dens = k * (scatter + 30.0 * drift) * (1.0 if hero else 0.55)
        keep = rng.random(len(X)) < np.clip(dens * sp * sp, 0, 1)
        X, Y, si, drift = X[keep], Y[keep], si[keep], drift[keep]
        n = len(X)
        stray = rng.random(n) < 0.12
        si = np.where(stray, rng.integers(0, len(kinds), n), si)
        pr = np.zeros(n, dtype=np.int32)
        for i, kk in enumerate(kinds):
            sel = si == i
            pr[sel] = _choose(rng, [kk], lib, int(sel.sum()))
        if not hero:
            pr = np.array([lib["lod"].get(int(i), int(i)) for i in pr])
        sc = rng.uniform(0.8, 1.25, n) * (0.85 + 0.3 * drift) * (1.0 if hero else 1.4)
        tint = np.clip(1 + rng.normal(0, 0.07, (n, 1)) * np.ones((1, 3)), 0.7, 1.3)
        parts.append(_pack(X, Y, pr, sc, 0.85, tint, rng, tilt=0.12, gmode=gm, bdel=6.0 + rng.uniform(0, 14, n),
                           glen=30.0))
        # ---------------- dark-green shrubs (value notes), moss cushions on rocky ground, ferns in hollows, clover
        sp = 0.4 if hero else 2.0
        X, Y = _sample(area, sp, rng)
        zm = terrain._mountain(X, Y)
        sl = terrain.slope(X, Y)
        dn = terrain._dunes(X, Y)
        mossd = (0.6 + 2.2 * _ss(4, 14, zm)) * _ss(0.1, 0.7, terrain.fbm(X, Y, 86, 3.0, 2)) * (sl < 1.0)
        bushd = 0.18 * _ss(0.2, 0.7, terrain.fbm(X, Y, 88, 14.0, 2)) * (sl < 0.6) * (1 - _ss(14, 25, zm))
        dens = k * (mossd + bushd) * (1.0 if hero else 0.7)
        keep = rng.random(len(X)) < np.clip(dens * sp * sp, 0, 1)
        X, Y = X[keep], Y[keep]
        mossd, bushd, dn = mossd[keep], bushd[keep], dn[keep]
        n = len(X)
        isb = rng.random(n) < bushd / np.maximum(bushd + mossd, 1e-6)
        r = rng.random(n)
        hollow = dn < 0.08
        pr = np.where(isb, _choose(rng, ["bush"], lib, n),
                      np.where(r < 0.55, _choose(rng, ["moss"], lib, n),
                               np.where((r < 0.8) | hollow, _choose(rng, ["fern"], lib, n), _choose(rng, ["clover"], lib, n))))
        sc = np.where(isb, rng.uniform(0.7, 1.5, n), rng.uniform(0.8, 1.6, n))
        parts.append(_pack(X, Y, pr, sc, np.where(isb, 0.12, 0.3), _tints(X, Y, rng, n, 0.15, 0.4, 2), rng, tilt=0.1,
                           gmode=gm, bdel=rng.uniform(0, 10, n), glen=20.0))
    P = _cat(parts)
    return _cloud(name, P, collection) if P is not None else None


def patch(center, radius, kind="meadow", density=1.0, seed=5, name=None, grow=True):
    """Extra-dense hero cover around a spot (close-ups). kind 'meadow' or 'ash'."""
    fn = meadow if kind == "meadow" else ash_cover
    kw = dict(grow=grow) if kind == "meadow" else dict(wither=grow)
    return fn(areas=((center[0], center[1], radius),), seed=seed, density=density * 1.6,
              name=name or f"CoverPatch{seed}", **kw)


# ===================================================================== per-shot culling + LOD
def cull(f0=None, f1=None, cams=None, margin=0.12, far=400.0, step=4, keep_radius=2.0, lod_dist=28.0,
         thin_ref=45.0, prefix=("Cover", "Forest", "Leaves"), min_keep=0.06):
    """For every Cover/Forest/Leaves cloud: drop instances outside every sampled camera frustum (with a margin) or
    beyond `far`; swap far instances (> lod_dist) to their LOD prototype; thin small far cover so its screen density
    stays roughly constant (probability (thin_ref / d)^2, scale compensated). Trees are never thinned (silhouettes).
    Call at the end of a shot's make(), after the camera is animated (render_shot does it)."""
    sc = bpy.context.scene
    f0 = sc.frame_start if f0 is None else f0
    f1 = sc.frame_end if f1 is None else f1
    if cams is None:
        cams = {sc.camera} if sc.camera else set()
        cams |= {m.camera for m in sc.timeline_markers if m.camera}
        cams = [c for c in cams if c]
    if not cams:
        return 0
    lib = protos() if bpy.data.collections.get(PROTO_COLL) else {"lod": {}}
    lod = lib.get("lod", {})
    cur = sc.frame_current
    views = []
    for f in list(range(f0, f1 + 1, step)) + [f1]:
        sc.frame_set(f)
        for c in cams:
            views.append((c.matrix_world.copy(), c.data.lens, c.data.sensor_width, c.data.shift_x, c.data.shift_y))
    sc.frame_set(cur)
    aspect = sc.render.resolution_y / sc.render.resolution_x
    removed = 0
    rng = np.random.default_rng(5)
    for ob in clouds(prefix):
        P = _read(ob)
        co = P["co"].astype(np.float64)
        n = len(co)
        if n == 0:
            continue
        is_tree = ob.name.startswith("Forest")
        vis = np.zeros(n, dtype=bool)
        dmin = np.full(n, 1e9)
        homo = np.concatenate([co, np.ones((n, 1))], 1)
        rad = np.asarray(P["scale"]) * (12.0 if is_tree else 1.0)
        for (mw, lens, sw, sx, sy) in views:
            pc = homo @ np.array(mw.inverted()).T
            z = -pc[:, 2]
            d = np.linalg.norm(pc[:, :3], axis=1)
            fx = lens / sw
            with np.errstate(divide="ignore", invalid="ignore"):
                u = pc[:, 0] / np.maximum(z, 1e-3) * fx - sx
                v = pc[:, 1] / np.maximum(z, 1e-3) * fx - sy
            mg = margin + rad * fx / np.maximum(z, 1e-3)
            ok = (z > -rad - 0.5) & (np.abs(u) < 0.5 + mg) & (np.abs(v) < aspect * 0.5 + mg) & (d < far)
            ok |= d < keep_radius
            vis |= ok
            dmin = np.minimum(dmin, np.where(ok, d, 1e9))
        keep = vis.copy()
        is_leaf = ob.name.startswith("Leaves")
        if not is_tree:
            ref, mk, comp = (thin_ref * 2.4, 0.6, -0.5) if is_leaf else (thin_ref, min_keep, -0.3)
            p = np.clip((ref / np.maximum(dmin, 1e-3)) ** 2, mk, 1.0)
            keep &= rng.random(n) < p
            P["scale"] = np.asarray(P["scale"]) * np.where(p < 1.0, p ** comp, 1.0)
        if lod:
            pr = np.asarray(P["proto"])
            far_ = dmin > (lod_dist * (2.5 if ob.name.startswith("Leaves") else 1.0))
            sw = np.array([lod.get(int(i), int(i)) for i in pr])
            P["proto"] = np.where(far_, sw, pr).astype(np.int32)
        removed += int((~keep).sum())
        _write(ob, P, keep)
    return removed


# ===================================================================== edits
def mow(center, radius, prefix=("Cover",), keep_stones=False):
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


def flatten(center, radius, angle=1.25, prefix=("Cover",)):
    """Lay cover flat, radially outward from center (impact, a body lying in it), up to radius."""
    c = np.array(center[:2], dtype=float)
    for ob in clouds(prefix):
        P = _read(ob)
        dx = P["co"][:, 0] - c[0]
        dy = P["co"][:, 1] - c[1]
        d = np.hypot(dx, dy)
        sel = d < radius
        if not sel.any():
            continue
        f = (1 - _ss(radius * 0.45, radius, d)) * (np.asarray(P["flex"]) > 0)
        ux, uy = dx / np.maximum(d, 1e-4), dy / np.maximum(d, 1e-4)
        P["lean"][:, 0] = np.where(sel, ux * angle * f, P["lean"][:, 0])
        P["lean"][:, 1] = np.where(sel, uy * angle * f, P["lean"][:, 1])
        P["flex"] = np.where(sel, P["flex"] * (1 - 0.8 * f), P["flex"])
        _write(ob, P)
