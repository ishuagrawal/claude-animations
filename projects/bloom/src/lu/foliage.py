"""The charred forest (and its spring), plus the scene wind.

Trunks are procedural prototypes in the hidden collection LU_Trunks (hi + lo LOD of each), instanced by the shared
cover instancer (dress.cover_group) from the point cloud "Forest":
  snag     a burnt conifer: tapering trunk with root buttresses, a fire-hollowed base on some, whorls of broken branch
           stubs pointing down, a few longer dead limbs up high, a splintered broken (or charred spike) top, curled
           flakes of bark peeling off the lower trunk
  dead     a burnt broadleaf: a short trunk forking into bare crooked limbs and twigs (the classic dead-tree shape)
  stub     a short broken trunk (1.5-3 m), splintered
  log      a big charred fallen log (lying), stubs
Material: envmat.char_bark (alligator checks, ember cracks near the base, silver sheen); it turns into living bark
behind the bloom wave, climbing from the base.

Spring: "Leaves" is a second cloud of leaf / pink and white blossom clusters on every bud point of every trunk (stub
tips, limb ends, along the upper trunk) with gmode=+1: they burst out behind the bloom wave (staggered, bottom-up).

API
  forest(areas=..., seed, density, leaves=False)    the trunks (+ leaves when the bloom is in the shot)
  hero_trunks(spots)                                 hand-placed trunks [(x, y, kind, height, yaw), ...]
  wind(heading, breeze) / breeze(s, frame) / gust(f0, f1, strength, ...)    the LU_Wind controller (read by GN)
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, mat, terrain, layout

TRUNK_COLL = "LU_Trunks"
TAU = 2 * math.pi
_TLIB = None


# ===================================================================== trunk prototypes
def _snag(rng, H=10.0, r0=0.24, segs=14, detail=True, broken=True, hollow=False, kind="snag"):
    """Returns (MB, buds) where buds = [(pos, dir)] leaf attach points (local coords, trunk base at origin)."""
    from .dress import MB, tube
    mb = MB()
    buds = []
    nroots = int(rng.integers(4, 7))
    rph = rng.uniform(0, TAU)
    lean = Vector((rng.normal(0, 0.04), rng.normal(0, 0.04), 1.0)).normalized()
    curve = Vector((rng.normal(0, 0.02), rng.normal(0, 0.02), 0.0))
    top_h = H * (rng.uniform(0.62, 0.9) if broken else 1.0)
    zs = list(np.concatenate([np.linspace(-0.4, 1.2, 9 if detail else 4), np.linspace(1.2, top_h, max(4, int(top_h / (0.5 if detail else 1.5))))[1:]]))
    rings = []
    char = (1.0, 1.0, 1.0)
    for i, z in enumerate(zs):
        t = max(z, 0.0) / H
        c = lean * z + curve * (z * z / H)
        r = r0 * (1 - 0.55 * t ** 1.2) + 0.012
        ring = []
        for k in range(segs):
            a = TAU * k / segs
            flare = 1 + 0.45 * math.exp(-max(z, 0) / (r0 * 1.8)) * (0.3 + max(0.0, math.cos(nroots * a + rph)) ** 2)
            wob = 1 + 0.07 * math.sin(3 * a + z * 1.3 + rph) + 0.04 * math.sin(7 * a - z * 2.1)
            if hollow and z < 1.1:
                cav = max(0.0, math.cos(a - rph * 0.5)) ** 3 * (1 - z / 1.1) * 0.55
                wob *= 1 - cav
            rr = r * flare * wob
            q = Vector(c) + Vector((math.cos(a) * rr, math.sin(a) * rr, 0.0))
            q.z = z
            if i == len(zs) - 1 and broken:
                q.z += rng.uniform(-0.25, 0.35) * r0 * 3 * (0.5 + 0.5 * math.sin(a * 3 + rph))
                q = Vector(c) + (q - Vector(c)) * Vector((0.75, 0.75, 1.0))
                q.z = z + rng.uniform(-0.3, 0.45) * r0 * 2.5
            n = Vector((math.cos(a), math.sin(a), 0.15))
            ring.append(mb.vert(q, (k / segs, z / H), char, n))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for k in range(segs):
            k2 = (k + 1) % segs
            mb.face(a[k], a[k2], b[k2], b[k])
    if not broken:
        tip = mb.vert(lean * H * 1.04, (0.5, 1.0), char, (0, 0, 1))
        for k in range(segs):
            mb.face(rings[-1][k], rings[-1][(k + 1) % segs], tip)
    # branch stubs (whorls, pointing out and down), longer dead limbs up high
    nwh = int(top_h / 0.9)
    for w in range(nwh):
        z = 1.6 + (top_h - 2.0) * (w + rng.uniform(0, 0.6)) / max(nwh, 1)
        if z > top_h - 0.3:
            continue
        t = z / H
        rz = r0 * (1 - 0.55 * t ** 1.2) + 0.012
        nst = int(rng.integers(1, 4))
        for s in range(nst):
            a = rng.uniform(0, TAU)
            d = Vector((math.cos(a), math.sin(a), rng.uniform(-0.55, -0.1) if t < 0.65 else rng.uniform(-0.3, 0.35))).normalized()
            L = rng.uniform(0.12, 0.45) * (1.0 + 2.5 * t * (rng.random() < 0.35)) * (H / 10.0) ** 0.5
            base = lean * z + curve * (z * z / H) + Vector((math.cos(a), math.sin(a), 0)) * rz * 0.7
            if not detail and L < 0.3:
                continue
            br = max(0.012, rz * rng.uniform(0.12, 0.25))
            pts = [base, base + d * L * 0.5 + Vector((0, 0, -0.03 * L)), base + d * L]
            tube(mb, pts, [br, br * 0.7, br * 0.35], 6 if detail else 4, char, char)
            buds.append((tuple(base + d * L), tuple(d)))
            if L > 0.6 and detail:
                q = pts[1]
                d2 = (d + Vector(rng.normal(0, 0.5, 3)) + Vector((0, 0, 0.3))).normalized()
                L2 = L * rng.uniform(0.3, 0.55)
                tube(mb, [q, q + d2 * L2], [br * 0.5, br * 0.2], 4, char, char)
                buds.append((tuple(q + d2 * L2), tuple(d2)))
    # buds along the upper trunk (foliage hugging the trunk) and at the top
    for k in range(int(top_h * 0.9)):
        z = top_h * (0.5 + 0.48 * rng.random() ** 0.7)
        a = rng.uniform(0, TAU)
        rz = r0 * (1 - 0.55 * (z / H) ** 1.2)
        p = lean * z + Vector((math.cos(a), math.sin(a), 0)) * rz
        buds.append((tuple(p), (math.cos(a), math.sin(a), 0.3)))
    for k in range(5):
        a = rng.uniform(0, TAU)
        p = lean * top_h * rng.uniform(0.9, 1.02) + Vector((math.cos(a), math.sin(a), 0.0)) * rng.uniform(0.3, 0.9)
        buds.append((tuple(p), (math.cos(a), math.sin(a), 0.6)))
    buds.append((tuple(lean * top_h), (0, 0, 1)))
    # curled bark flakes on the lower trunk
    if detail:
        for k in range(int(rng.integers(14, 30))):
            z = rng.uniform(0.3, min(3.5, top_h * 0.6))
            a = rng.uniform(0, TAU)
            rz = r0 * (1 - 0.55 * (z / H) ** 1.2) * 1.02
            p = lean * z + Vector((math.cos(a), math.sin(a), 0)) * rz
            n = Vector((math.cos(a), math.sin(a), 0.0))
            tg = Vector((-math.sin(a), math.cos(a), 0.0))
            w, h = rng.uniform(0.04, 0.1), rng.uniform(0.06, 0.16)
            curl = rng.uniform(0.01, 0.04)
            ids = []
            for (u, v) in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
                q = p + tg * (u * w * 0.5) + Vector((0, 0, v * h * 0.5)) + n * (curl * (1 + v) + 0.004)
                ids.append(mb.vert(q, (0.5 + u * 0.5, 0.5 + v * 0.5), (1.15, 1.1, 1.05), n))
            mb.face(*ids)
    return mb, buds


def _dead_tree(rng, H=7.0, r0=0.2, segs=12, detail=True):
    """A burnt broadleaf: trunk forking into crooked bare limbs with twigs. Buds at limb/twig ends (blossom)."""
    from .dress import MB, tube
    mb = MB()
    buds = []
    char = (1.0, 1.0, 1.0)
    fork_h = H * rng.uniform(0.3, 0.45)

    def limb(p, d, L, r, depth):
        pts = [Vector(p)]
        q = Vector(p)
        dd = Vector(d)
        n = 5 if depth < 2 else 3
        for i in range(n):
            dd = (dd + Vector(rng.normal(0, 0.22, 3)) + Vector((0, 0, 0.08))).normalized()
            q = q + dd * (L / n)
            pts.append(q.copy())
        rr = [r * (1 - 0.6 * i / n) for i in range(n + 1)]
        tube(mb, pts, rr, max(4, segs // (2 + depth)) if detail else 4, char, char, jitter=0.05, rng=rng)
        if depth >= (3 if detail else 2):
            buds.append((tuple(pts[-1]), tuple(dd)))
            return
        nk = int(rng.integers(2, 4))
        for k in range(nk):
            i = int(rng.integers(max(1, n - 3), n + 1))
            nd = (dd + Vector(rng.normal(0, 0.75, 3))).normalized()
            nd.z = abs(nd.z) * 0.7 + 0.25
            limb(pts[min(i, n)], nd.normalized(), L * rng.uniform(0.5, 0.72), rr[min(i, n)] * 0.62, depth + 1)
        buds.append((tuple(pts[-1]), tuple(dd)))

    # trunk with flare
    zs = np.linspace(-0.3, fork_h, 8)
    pts = [Vector((rng.normal(0, 0.02), rng.normal(0, 0.02), z)) for z in zs]
    rr = [r0 * (1 + 0.6 * math.exp(-max(z, 0) / 0.35)) * (1 - 0.15 * z / fork_h) for z in zs]
    tube(mb, pts, rr, segs, char, char, cap=False, jitter=0.04, rng=rng)
    for k in range(int(rng.integers(2, 4))):
        a = rng.uniform(0, TAU)
        d = Vector((math.cos(a) * 0.55, math.sin(a) * 0.55, 1.0)).normalized()
        limb(pts[-1], d, (H - fork_h) * rng.uniform(0.55, 0.8), r0 * 0.7, 0)
    return mb, buds


def _log_proto(rng, L=5.0, r0=0.28, segs=14, detail=True):
    from .dress import MB, tube
    mb = MB()
    char = (1.0, 1.0, 1.0)
    n = 10 if detail else 5
    pts = [Vector((L * (t - 0.5), 0.06 * math.sin(t * 6), r0 * 0.85)) for t in np.linspace(0, 1, n)]
    rr = [r0 * (1 - 0.3 * t) * (1 + 0.5 * math.exp(-t * 12)) for t in np.linspace(0, 1, n)]
    tube(mb, pts, rr, segs, char, char, jitter=0.06, rng=rng)
    buds = []
    for k in range(int(rng.integers(3, 7))):
        i = int(rng.integers(1, n - 1))
        a = rng.uniform(-1.2, 1.2) + (math.pi if rng.random() < 0.5 else 0)
        d = Vector((rng.normal(0, 0.3), math.cos(a), abs(math.sin(a)) + 0.2)).normalized()
        Ls = rng.uniform(0.2, 0.7)
        tube(mb, [pts[i], pts[i] + d * Ls], [rr[i] * 0.3, rr[i] * 0.1], 5, char, char)
        buds.append((tuple(pts[i] + d * Ls), tuple(d)))
    for t in (0.2, 0.5, 0.8):
        buds.append((tuple(Vector((L * (t - 0.5), 0, r0 * 1.7))), (0, 0, 1)))
    return mb, buds


def trunk_protos():
    """Build the trunk library once: lib[kind] -> [indices of hi protos], lib['lod'] hi -> lo, lib['buds'][i]."""
    global _TLIB
    coll = bpy.data.collections.get(TRUNK_COLL)
    if coll is not None and _TLIB is not None and _TLIB.get("_coll") == coll:
        return _TLIB
    from . import envmat
    coll = bpy.data.collections.new(TRUNK_COLL)
    bpy.context.scene.collection.children.link(coll)
    m = envmat.char_bark("CharBark", cell=24.0)
    lib = {"_coll": coll, "lod": {}, "buds": {}, "height": {}}
    idx = [0]

    def add(kind, mb, buds, h):
        i = idx[0]
        ob = mb.build(f"t{i:03d}_{kind}", coll, m)
        lib.setdefault(kind, []).append(i)
        lib["buds"][i] = buds
        lib["height"][i] = h
        idx[0] += 1
        return i

    specs = []
    for s in range(9):
        specs.append(("snag", dict(H=float(np.random.default_rng(500 + s).uniform(9, 18)),
                                   r0=float(np.random.default_rng(600 + s).uniform(0.13, 0.24)),
                                   broken=s % 3 != 2, hollow=s in (1, 5))))
    for s in range(3):
        specs.append(("dead", dict(H=float(np.random.default_rng(700 + s).uniform(5, 8)), r0=0.2 + 0.04 * s)))
    for s in range(3):
        specs.append(("stub", dict(H=float(np.random.default_rng(800 + s).uniform(2.0, 3.5)), r0=0.25 + 0.05 * s,
                                   broken=True, hollow=s == 1)))
    for s in range(3):
        specs.append(("log", dict(L=float(np.random.default_rng(900 + s).uniform(3.5, 7.0)), r0=0.2 + 0.06 * s)))
    his = []
    for j, (kind, kw) in enumerate(specs):
        seed = 1000 + j
        fn = {"snag": _snag, "stub": _snag, "dead": _dead_tree, "log": _log_proto}[kind]
        mb, buds = fn(np.random.default_rng(seed), detail=True, **kw)
        h = kw.get("H", 1.0)
        his.append((kind, add(kind, mb, buds, h), seed, kw, fn))
    for (kind, i, seed, kw, fn) in his:
        segs = 6 if kind != "dead" else 5
        mb, buds = fn(np.random.default_rng(seed), segs=segs, detail=False, **kw)
        lo = add(kind + "_lo", mb, buds, kw.get("H", 1.0))
        lib["lod"][i] = lo
    lc = bpy.context.view_layer.layer_collection.children.get(TRUNK_COLL)
    if lc:
        lc.exclude = True
    _TLIB = lib
    return lib


def tree_group():
    from . import dress
    trunk_protos()
    return dress.cover_group(TRUNK_COLL, name="LU_TreeGN", wind=False, bloom=False)


# ===================================================================== forest scatter
FOREST_AREAS = {"valley": (-235.0, 245.0, -215.0, 275.0), "stump": (-30.0, 30.0, -30.0, 30.0)}
CLEAR = [(layout.STUMP[0], layout.STUMP[1], 7.5)]


def _forest_points(rng, bbox, spacing, density_fn):
    from .dress import _grid, _thin
    x0, x1, y0, y1 = bbox
    X, Y = _grid(x0, x1, y0, y1, spacing, rng)
    return _thin(X, Y, density_fn(X, Y), spacing, rng)


def forest_density(X, Y):
    """Trunks per m2: dense on the floor and the walls, thinning up the mountain (none on its rocky upper half),
    clearings, a bare circle around the stump, none on the climb route itself."""
    zm = terrain._mountain(X, Y)
    sl = terrain.slope(X, Y)
    base = 1.0 / 48.0
    clump = 0.25 + 1.1 * terrain.ss(-0.3, 0.55, terrain.fbm(X, Y, 201, 35.0, 3))
    d = base * clump * (1 - terrain.ss(10.0, 24.0, zm)) * (1 - terrain.ss(0.7, 0.95, sl))
    for (cx, cy, r) in CLEAR:
        d = d * terrain.ss(r, r + 6.0, np.hypot(X - cx, Y - cy))
    # an open burnt plain south of the stump (B01 / B02 look across it), scattered trunks only
    d = d * (0.25 + 0.75 * terrain.ss(16.0, 34.0, np.hypot((X - 2.0) * 0.8, (Y + 18.0) * 0.6)))
    m = (X > -6) & (X < 56) & (Y > 64) & (Y < 172)
    if m.any():
        dd = np.full(X.shape, 1e9)
        dd[m] = terrain.dist_to_path(X[m], Y[m])
        d = d * terrain.ss(3.0, 7.0, dd)
        d = d * terrain.ss(6.0, 10.0, np.hypot(X - layout.SCREE[0], Y - layout.SCREE[1]))
    # thicker on the valley walls (the skyline is a fringe of black needles)
    ax = 0.10 * Y + 8.0 * np.sin(Y / 70.0)
    d = d * (1 + 0.8 * terrain.ss(90.0, 160.0, np.abs(X - ax)))
    return d


def forest(seed=17, density=1.0, leaves=False, spacing=4.0, extra=(), name="Forest", grow_leaves=True,
           leaf_density=1.0):
    """Scatter the charred forest over the valley (+ hero trunks in `extra`). leaves=True also builds the spring
    foliage cloud ("Leaves"), growing in behind the bloom wave (grow_leaves) or already grown."""
    from . import dress
    lib = trunk_protos()
    rng = np.random.default_rng(seed)
    X, Y = _forest_points(rng, FOREST_AREAS["valley"], spacing, lambda x, y: forest_density(x, y) * density)
    n = len(X)
    r = rng.random(n)
    kinds = np.where(r < 0.72, 0, np.where(r < 0.86, 1, np.where(r < 0.95, 2, 3)))
    pools = [lib["snag"], lib["dead"], lib["stub"], lib["log"]]
    pr = np.array([pools[k][int(rng.integers(0, len(pools[k])))] for k in kinds], dtype=np.int32)
    sc = rng.uniform(0.75, 1.3, n)
    lean = rng.normal(0, 0.035, (n, 2))
    lean[rng.random(n) < 0.08] *= 4.0
    rot = np.stack([lean[:, 0], lean[:, 1], rng.uniform(0, TAU, n)], 1)
    rot[kinds == 3, 0] = 0.0
    rot[kinds == 3, 1] = 0.0
    pts = [(float(x), float(y), int(p), float(s), tuple(rr)) for x, y, p, s, rr in zip(X, Y, pr, sc, rot)]
    for (x, y, kind, h, yaw) in extra:
        pool = lib[kind]
        p = pool[int(abs(hash((x, y))) % len(pool))]
        s = h / lib["height"][p] if kind != "log" else h
        pts.append((x, y, p, s, (rng.normal(0, 0.02), rng.normal(0, 0.02), math.radians(yaw))))
    X = np.array([p[0] for p in pts])
    Y = np.array([p[1] for p in pts])
    Z = terrain.height(X, Y) - 0.05
    P = dict(co=np.stack([X, Y, Z], 1), proto=np.array([p[2] for p in pts], dtype=np.int32),
             scale=np.array([p[3] for p in pts]), rot=np.array([p[4] for p in pts]),
             tint=np.ones((len(pts), 3)), flex=np.zeros(len(pts)))
    tg = tree_group()
    ob = dress._cloud(name, P, geo.coll("Forest"), group=tg)
    out = dict(trunks=ob)
    if leaves:
        out["leaves"] = forest_leaves(P, seed=seed + 1, grow=grow_leaves, density=leaf_density)
    return out


def forest_leaves(P, seed=18, grow=True, density=1.0, name="Leaves"):
    """Leaf and blossom clusters on the bud points of every trunk instance in P (the Forest cloud's data). Each tree
    gets one identity - fresh green (four greens), pink blossom, deep-pink or white blossom (with some young leaves
    among the flowers) - and its clusters carry a canopy normal ('cn': out of the crown's centre) so the whole crown
    shades as one layered mass: lit top, cool shadowed underside."""
    from . import dress
    lib = trunk_protos()
    clib = dress.protos()
    rng = np.random.default_rng(seed)
    co, pr, sc, rot = P["co"], P["proto"], P["scale"], P["rot"]
    L_co, L_pr, L_sc, L_rot, L_del, L_cn = [], [], [], [], [], []
    leaf, bp, bw = clib["leaf"], clib["blossom_p"], clib["blossom_w"]
    for i in range(len(co)):
        buds = lib["buds"].get(int(pr[i]), [])
        if not buds:
            continue
        M = Matrix.Translation(Vector(co[i])) @ Matrix.Rotation(rot[i][2], 4, "Z") @ \
            Matrix.Rotation(rot[i][1], 4, "Y") @ Matrix.Rotation(rot[i][0], 4, "X") @ Matrix.Scale(sc[i], 4)
        kind = "dead" if int(pr[i]) in lib["dead"] else ("log" if int(pr[i]) in lib.get("log", []) else "other")
        r = rng.random()
        if kind == "dead":
            ident = "pink" if r < 0.45 else ("white" if r < 0.75 else "green")
        else:
            ident = "green" if r < 0.62 else ("pink" if r < 0.82 else "white")
        gpal = int(rng.integers(0, len(leaf)))
        hmax = max(b[0][2] for b in buds) + 1e-3
        k = max(1, int(len(buds) * density))
        sel = rng.choice(len(buds), size=min(k, len(buds)), replace=False)
        ccw = M @ Vector((0.0, 0.0, hmax * (0.72 if kind == "dead" else 0.68)))
        # synthetic crown points fill out a real canopy silhouette round the bud points (an oval crown for
        # broadleaves, a tall tapering one for the conifer snags; biased to the outer shell)
        extra = []
        if kind != "log":
            ne = int((26 if kind == "dead" else 24) * min(1.6, max(0.6, hmax / 9.0)))
            for e_ in range(ne):
                t = rng.uniform(0.0, 1.0)
                if kind == "dead":
                    zc, rz, rxy = hmax * 0.74, hmax * 0.3, hmax * 0.42
                    dvec = Vector(rng.normal(0, 1, 3)).normalized()
                    rr = rng.uniform(0.55, 1.0) ** 0.5
                    q_ = Vector((dvec.x * rxy * rr, dvec.y * rxy * rr, zc + dvec.z * rz * rr))
                else:
                    z_ = hmax * (0.42 + 0.58 * t)
                    rxy = (0.26 * hmax) * (1 - t) ** 0.85 + 0.4
                    a_ = rng.uniform(0, TAU)
                    rr = rng.uniform(0.6, 1.0) ** 0.5
                    q_ = Vector((math.cos(a_) * rxy * rr, math.sin(a_) * rxy * rr, z_))
                extra.append((tuple(q_), (0, 0, 1)))
        allb = [buds[j] for j in sel] + extra
        for (p, d) in allb:
            if p[2] < hmax * (0.25 if kind == "dead" else 0.4) and kind != "log" and rng.random() < 0.85:
                continue                        # keep the lower trunk mostly bare: crowns, not columns
            q = M @ Vector(p)
            L_co.append(tuple(q))
            rr = rng.random()
            if ident == "green":
                c = [leaf[gpal]] if rr < 0.8 else leaf
            elif ident == "pink":
                c = bp if rr < 0.78 else [leaf[gpal]]
            else:
                c = bw if rr < 0.78 else [leaf[gpal]]
            L_pr.append(c[int(rng.integers(0, len(c)))])
            up = p[2] / hmax
            crownf = 1.0 - abs(up - 0.72) * 1.2
            hk = min(1.6, max(0.8, hmax / 8.0))
            L_sc.append(sc[i] * hk * rng.uniform(0.9, 1.4) * (1.45 if kind == "dead" else 1.3) * (0.8 + 0.9 * max(crownf, 0.2)))
            L_rot.append((rng.normal(0, 0.3), rng.normal(0, 0.3), rng.uniform(0, TAU)))
            L_del.append(3.0 * p[2] / hmax * 4.0 + rng.uniform(0, 10.0))
            nv = (q - ccw) * Vector((1.0, 1.0, 1.35))
            nv = nv.normalized() if nv.length > 1e-3 else Vector((0, 0, 1))
            L_cn.append(tuple(nv))
    n = len(L_co)
    if n == 0:
        return None
    Pl = dict(co=np.array(L_co), proto=np.array(L_pr, dtype=np.int32), scale=np.array(L_sc), rot=np.array(L_rot),
              tint=np.clip(1 + rng.normal(0, 0.1, (n, 1)) * np.ones((1, 3)), 0.7, 1.3), flex=np.full(n, 0.25),
              gmode=np.full(n, 1.0 if grow else 0.0), bdel=np.array(L_del), glen=np.full(n, 34.0), cn=np.array(L_cn))
    return dress._cloud(name, Pl, geo.coll("Forest"))


# ===================================================================== wind
WIND = "LU_Wind"
WIND_HEADING = math.degrees(math.atan2(-0.35, 1.0))     # blows toward the ESE (the storm comes from the WNW)


def wind(heading=None, breeze=None):
    """The scene's wind controller (an Empty read by the cover geometry nodes):
      location.x = gust strength (0 = none, 1 = strong), location.y = gust front position along the wind axis (m),
      location.z = breeze strength (1 = default gentle sway), rotation z = direction the wind blows toward,
      scale.x = gust band wavelength (m). Time driven (Scene Time) and keyable, so every frame is deterministic."""
    o = bpy.data.objects.get(WIND)
    if o is None:
        o = bpy.data.objects.new(WIND, None)
        bpy.context.scene.collection.objects.link(o)
        o.empty_display_type = "SINGLE_ARROW"
        o.location = (0.0, -1000.0, 1.0)
        o.rotation_euler = (0.0, 0.0, math.radians(WIND_HEADING))
        o.scale = (4.0, 1.0, 1.0)
        o.hide_render = True
    if heading is not None:
        o.rotation_euler.z = math.radians(heading)
    if breeze is not None:
        o.location.z = breeze
    return o


def breeze(strength=1.0, frame=None):
    """Set (or key at `frame`) the constant gentle breeze. 0 = still air."""
    o = wind()
    o.location.z = strength
    if frame is not None:
        o.keyframe_insert("location", index=2, frame=frame)
    return o


def _set_interp(o, data_path, index, kind):
    ad = o.animation_data
    if not ad or not ad.action:
        return
    from bpy_extras import anim_utils
    try:
        fcs = anim_utils.action_get_channelbag_for_slot(ad.action, ad.action_slot).fcurves
    except Exception:
        fcs = getattr(ad.action, "fcurves", [])
    for fc in fcs:
        if fc.data_path == data_path and fc.array_index == index:
            for kp in fc.keyframe_points:
                kp.interpolation = kind


def gust(f0, f1, strength=1.0, speed=11.0, start=None, ramp=0.35, wavelength=4.0, heading=None):
    """A gust: rolling bands of motion through the cover. The front enters at f0 at `start` (world (x, y) or a
    distance along the wind axis; default the scene camera) and travels at `speed` m/s; strength ramps in over `ramp`
    s, holds, and dies out by f1."""
    o = wind(heading=heading)
    fps = bpy.context.scene.render.fps
    h = o.rotation_euler.z
    d = (math.cos(h), math.sin(h))
    if start is None:
        cam = bpy.context.scene.camera
        start = (cam.location.x, cam.location.y) if cam else (0.0, -20.0)
    s0 = start[0] * d[0] + start[1] * d[1] if isinstance(start, (tuple, list)) else float(start)
    s0 -= 1.0
    o.scale.x = wavelength
    fr = max(1, int(round(ramp * fps)))
    for f, g in ((f0 - 1, 0.0), (f0 + fr, strength), (max(f0 + fr, f1 - 2 * fr), strength * 0.85), (f1, 0.0)):
        o.location.x = g
        o.keyframe_insert("location", index=0, frame=f)
    for f, s in ((f0, s0), (f1, s0 + speed * (f1 - f0) / fps)):
        o.location.y = s
        o.keyframe_insert("location", index=1, frame=f)
    _set_interp(o, "location", 1, "LINEAR")
    return o
