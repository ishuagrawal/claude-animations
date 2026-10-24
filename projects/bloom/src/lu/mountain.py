"""The mountain's hero dressing: strata rock outcrops, the LEDGE, the rock band at HAIL_SPOT, the summit crown with
its soil patch, and the scree slope that gives way under Claude (B09).

  build(detail=1.0) -> dict(rocks (instanced outcrops cloud), ledge=dict(obj, top, lip, foot, face_n),
                            hail=dict(obj, wall_base, spot), crown=dict(objs, soil, soil_top), scree=dict(plates,
                            stones, rest), keep_clear [(x, y, r)])
  scree_slide(M, f_slip, dur=1.6, run=7.0, seed=3)   B09: the ash sheet at SCREE breaks into plates that slide and
                            tumble down the slope with its stones; returns the dust puffs to spawn (list of (pos, frame)).
  strata_rock(name, size, seed, ...) -> a rock mesh object (blocky, layered, jointed) using envmat.rock.

All rock uses envmat.rock: strata bands, horizontal strokes, lichen, ash on top faces; moss behind the bloom wave.
"""
import math
import bpy
import numpy as np
from mathutils import Vector, Matrix

from . import geo, layout, terrain, envmat
from .terrain import ss, fbm, mesh_from

TAU = 2 * math.pi
ROCK_COLL = "LU_Rocks"


# ===================================================================== rock geometry
def _cube_dirs(res):
    """Unit directions from a subdivided cube (even-ish sampling of the sphere) + quads."""
    g = np.linspace(-1, 1, res + 1)
    U, V = np.meshgrid(g, g)
    verts, quads = [], []
    faces = [(0, 1, 2, 1), (0, 1, 2, -1), (1, 2, 0, 1), (1, 2, 0, -1), (2, 0, 1, 1), (2, 0, 1, -1)]
    off = 0
    for (ia, ib, ic, sgn) in faces:
        P = np.zeros((res + 1, res + 1, 3))
        P[..., ia] = U * sgn
        P[..., ib] = V
        P[..., ic] = sgn
        verts.append(P.reshape(-1, 3))
        j = np.arange(res)[:, None]
        i = np.arange(res)[None, :]
        a = off + j * (res + 1) + i
        q = np.stack([a, a + 1, a + res + 2, a + res + 1], -1).reshape(-1, 4)
        if sgn < 0:
            q = q[:, ::-1]
        quads.append(q)
        off += (res + 1) ** 2
    V3 = np.concatenate(verts, 0)
    Q = np.concatenate(quads, 0)
    # weld duplicate edge vertices
    key = np.round(V3 * 1e4).astype(np.int64)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    first = np.zeros(len(uniq), dtype=np.int64)
    first[inv[::-1]] = np.arange(len(V3))[::-1]
    V3u = V3[first]
    Q = inv.reshape(-1)[Q]
    D = V3u / np.linalg.norm(V3u, axis=1, keepdims=True)
    return D, Q.astype(np.int32)


def facet_rock_mesh(size=(2.0, 1.4, 1.2), seed=0, planes=8, res=22, strata=0.34, groove=0.03, bevel=0.03,
                    flat_top=False, top_tilt=0.0, beds=0.035):
    """An angular sedimentary block: the intersection of jittered half-spaces (crisp planar facets, softened by a
    small bevel), cut by horizontal bedding grooves (strata), each bed set in or out a little, with fine chipping.
    Local coords, base at z = 0 (bury the lower part)."""
    rng = np.random.default_rng(seed)
    D, Q = _cube_dirs(res)
    hs = np.array(size) * 0.5
    N, Dd = [], []
    # columnar block: 5-7 near-vertical side faces round an ellipse, a broken angular top, a flat base,
    # a few corner chamfers (Wild Robot's basalt-like blocks), then bedding grooves
    ns = int(rng.integers(5, 8))
    th0 = rng.uniform(0, TAU)
    for i in range(ns):
        th = th0 + TAU * i / ns + rng.normal(0, 0.18)
        n = np.array([math.cos(th), math.sin(th), rng.normal(0, 0.12)])
        n /= np.linalg.norm(n)
        rad = 1.0 / math.sqrt((math.cos(th) / hs[0]) ** 2 + (math.sin(th) / hs[1]) ** 2)
        N.append(n)
        Dd.append(rad * rng.uniform(0.86, 1.0))
    ntop = 1 if flat_top else int(rng.integers(2, 4))
    for i in range(ntop):
        if flat_top:
            n = np.array([top_tilt, 0.0, 1.0])
        else:
            a_ = rng.uniform(0, TAU)
            t_ = rng.uniform(0.15, 0.55)
            n = np.array([math.cos(a_) * t_, math.sin(a_) * t_, 1.0])
        n /= np.linalg.norm(n)
        N.append(n)
        Dd.append(hs[2] * (1.0 if i == 0 else rng.uniform(0.82, 0.97)))
    N.append(np.array([0.0, 0.0, -1.0]))
    Dd.append(hs[2])
    for k in range(planes // 3):
        a_ = rng.uniform(0, TAU)
        n = np.array([math.cos(a_), math.sin(a_), rng.uniform(0.35, 0.9) if not flat_top else rng.uniform(-0.6, -0.1)])
        n /= np.linalg.norm(n)
        ext = np.sqrt(((n * hs) ** 2).sum())
        N.append(n)
        Dd.append(ext * rng.uniform(0.7, 0.88))
    N = np.array(N)
    Dd = np.array(Dd)
    dots = D @ N.T                                          # (V, P)
    with np.errstate(divide="ignore"):
        ri = np.where(dots > 1e-4, Dd[None, :] / dots, 1e6)
    k = max(bevel, 1e-3)
    m = ri.min(1, keepdims=True)
    r = m[:, 0] - k * np.log(np.exp(-(ri - m) / k).sum(1))   # soft-min: bevelled edges
    P = D * r[:, None]
    # strata: horizontal bedding grooves + beds set in/out
    z = P[:, 2] + hs[2]
    tilt = rng.normal(0, 0.05, 2)
    s_ = z + tilt[0] * P[:, 0] + tilt[1] * P[:, 1]
    kk = np.floor(s_ / strata)
    f = s_ / strata - kk
    dist = np.minimum(f, 1 - f) * strata
    side = np.clip(1 - np.abs(D[:, 2]) * 1.4, 0, 1)
    g = groove * (1 - ss(0.0, 0.02, dist)) * side
    bed = ((np.sin(kk * 12.9898 + seed * 78.233) * 43758.5453) % 1.0 - 0.5) * beds * side
    nrm = P / (np.linalg.norm(P, axis=1, keepdims=True) + 1e-9)
    horiz = nrm * np.array([1.0, 1.0, 0.25])
    P = P - horiz * g[:, None] + horiz * bed[:, None] * min(hs[0], hs[1])
    # chipping / weathering
    n1 = fbm(P[:, 0] * 3 + P[:, 2] * 1.7 + seed, P[:, 1] * 3 - P[:, 2] * 2.1, seed + 300, 1.0, 3)
    P = P + nrm * (n1 * 0.006 * min(size))[:, None]
    P[:, 2] += hs[2]
    return P, Q


def facet_rock(name, size=(2.0, 1.4, 1.2), seed=0, collection=None, res=22, material=None, **kw):
    v, q = facet_rock_mesh(size, seed, res=res, **kw)
    ob = mesh_from(name, v, q, collection or geo.coll("Rocks"), material or envmat.rock("StrataRock"))
    try:
        ob.data.set_sharp_from_angle(angle=math.radians(22))
    except Exception:
        pass
    return ob


def strata_rock(name, size=(2.0, 1.4, 1.2), seed=0, collection=None, res=(72, 36), material=None, strata=0.2,
                blocky=4.5, inset=0.05, flat_top=0.0, **kw):
    """(compat) -> facet_rock."""
    return facet_rock(name, size, seed, collection, res=max(12, res[0] // 4), material=material, strata=strata,
                      flat_top=flat_top > 0, **kw)


def rock_protos():
    coll = bpy.data.collections.get(ROCK_COLL)
    if coll is not None and coll.get("built"):
        return coll
    coll = bpy.data.collections.new(ROCK_COLL)
    bpy.context.scene.collection.children.link(coll)
    m = envmat.rock("StrataRock")
    rng = np.random.default_rng(77)
    for i in range(10):
        sz = (rng.uniform(1.6, 2.6), rng.uniform(1.0, 1.8), rng.uniform(0.7, 1.5))
        facet_rock(f"r{i:03d}", sz, seed=900 + i, collection=coll, res=18, material=m,
                   strata=rng.uniform(0.28, 0.45), planes=int(rng.integers(8, 16)))
    coll["built"] = True
    lc = bpy.context.view_layer.layer_collection.children.get(ROCK_COLL)
    if lc:
        lc.exclude = True
    return coll


def _place(ob, x, y, sink=0.3, yaw=0.0, follow=0.5, dz=0.0):
    """Sit a rock on the slope: base at the terrain (sunk), tilted part-way to the slope."""
    z = float(terrain.height(x, y))
    gx, gy = terrain.grad(np.array([x]), np.array([y]))
    gx, gy = float(gx[0]), float(gy[0])
    tx, ty = math.atan(gy) * follow, -math.atan(gx) * follow
    ob.matrix_world = Matrix.Translation((x, y, z - sink + dz)) @ Matrix.Rotation(tx, 4, "X") @ \
        Matrix.Rotation(ty, 4, "Y") @ Matrix.Rotation(yaw, 4, "Z")
    return ob


# ===================================================================== the mountain's outcrops (instanced)
def outcrops(seed=21, density=1.0):
    """Strata outcrops on the mountain's rock bands: dense along the climb (holds, ledges, framing), sparser and
    bigger elsewhere for the silhouette."""
    from . import dress
    coll = rock_protos()
    rng = np.random.default_rng(seed)
    X, Y = dress._grid(-40, 105, 85, 215, 2.0, rng)
    zm = terrain._mountain(X, Y)
    sl = terrain.slope(X, Y)
    _, terr = terrain._terrace(zm, X, Y)
    dd = terrain.dist_to_path(X, Y)
    band = ss(0.4, 1.4, np.abs(terr)) * ss(0.35, 0.6, sl)
    near = 1 - ss(5.0, 16.0, dd)
    dpk = np.hypot(X - layout.PEAK[0], Y - layout.PEAK[1])
    crownring = np.exp(-((dpk - 10.0) / 4.0) ** 2)
    dens = (0.05 + 0.5 * band + 0.35 * crownring) * ss(6.0, 14.0, zm) * (0.35 + 0.65 * near) * density
    dens = dens * ss(1.5, 3.5, dd)                     # never on the route itself
    dens = dens * ss(5.5, 7.5, dpk)
    dens = dens * (1 - terrain.scree_mask(X, Y)) * ss(5.5, 9.0, np.hypot(X - layout.SCREE[0], Y - layout.SCREE[1]))
    dens = dens * ss(3.0, 5.0, np.hypot(X - layout.LEDGE[0], Y - layout.LEDGE[1]))
    keep = rng.random(X.size) < np.clip(dens, 0, 1)
    X, Y = X[keep], Y[keep]
    n = len(X)
    zm = terrain._mountain(X, Y)
    gx, gy = terrain.grad(X, Y)
    yaw = np.arctan2(gy, gx) + math.pi / 2 + rng.normal(0, 0.3, n)
    sc = rng.uniform(0.35, 1.3, n) * (1 + 1.6 * rng.random(n) ** 4)
    Z = terrain.height(X, Y) - 0.35 * sc
    rot = np.stack([np.arctan(gy) * 0.4, -np.arctan(gx) * 0.4, yaw], 1)
    names = sorted(o.name for o in coll.objects)
    P = dict(co=np.stack([X, Y, Z], 1), proto=rng.integers(0, len(names), n).astype(np.int32), scale=sc, rot=rot)
    g = dress.cover_group(ROCK_COLL, name="LU_RockGN", wind=False, bloom=False)
    return dress._cloud("ForestRocks", P, geo.coll("Rocks"), group=g)


# ===================================================================== hero rocks
def ledge(collection=None):
    """The rock ledge at LEDGE: a strata block buried in the slope whose flat top is the bench at LEDGE and whose
    ~1.1 m face drops to the south (Claude hauls itself up it, B11)."""
    col = collection or geo.coll("Rocks")
    lx, ly = layout.LEDGE
    ztop = float(terrain.height(lx, ly))
    ob = facet_rock("Ledge", (4.4, 2.8, 2.9), seed=11, collection=col, res=30, strata=0.38, flat_top=True,
                    planes=10)
    me = ob.data
    co = np.empty(len(me.vertices) * 3)
    me.vertices.foreach_get("co", co)
    co = co.reshape(-1, 3)
    top_local = co[:, 2].max()
    ob.matrix_world = Matrix.Translation((lx, ly - 0.25, ztop - top_local + 0.04)) @ Matrix.Rotation(0.06, 4, "Z")
    face_y = ly - 0.25 - 1.3
    fy = ly - terrain.LEDGE_FOOT_DY
    foot_z = float(terrain.height(lx, fy))
    return dict(obj=ob, top=Vector((lx, ly, ztop + 0.04)), lip=Vector((lx, face_y + 0.05, ztop + 0.04)),
                foot=Vector((lx, fy, foot_z)), face_n=Vector((0, -1, 0)), step=ztop + 0.04 - foot_z)


def hail_wall(collection=None):
    """A strata rock band rising behind (uphill of) HAIL_SPOT: Claude curls on the little bench in front of it."""
    col = collection or geo.coll("Rocks")
    hx, hy = layout.HAIL_SPOT
    gx, gy = terrain.grad(np.array([hx]), np.array([hy]))
    up = Vector((float(gx[0]), float(gy[0]), 0.0))
    up = up.normalized() if up.length > 1e-3 else Vector((0, 1, 0))
    c = Vector((hx, hy, 0)) + up * 2.6
    ob = facet_rock("HailWall", (5.2, 2.4, 3.4), seed=23, collection=col, res=30, strata=0.42, planes=14)
    yaw = math.atan2(up.y, up.x) - math.pi / 2
    _place(ob, c.x, c.y, sink=1.1, yaw=yaw, follow=0.25)
    for k, (dx, dy, s, sd) in enumerate(((-2.8, 1.2, (2.2, 1.6, 1.4), 31), (2.9, 0.6, (1.8, 1.4, 1.2), 32),
                                         (1.6, -1.6, (0.9, 0.8, 0.6), 33))):
        side = Vector((-up.y, up.x, 0))
        p = Vector((hx, hy, 0)) + side * dx + up * dy
        o = facet_rock(f"HailRock{k}", s, seed=sd, collection=col, res=20, planes=12)
        _place(o, p.x, p.y, sink=0.35 * s[2], yaw=yaw + k, follow=0.4)
    zs = float(terrain.height(hx, hy))
    return dict(obj=ob, spot=Vector((hx, hy, zs)), wall_base=Vector((c.x, c.y, float(terrain.height(c.x, c.y)))),
                uphill=up)


def crown(collection=None):
    """The summit's small rocky crown: a ring of strata rocks (two tall ones framing the view down the valley)
    around the patch of dark soil at PEAK_SOIL."""
    col = collection or geo.coll("Rocks")
    px, py = layout.PEAK
    sx, sy = layout.PEAK_SOIL
    objs = []
    rng = np.random.default_rng(55)
    ring = [(20, 3.6, (2.8, 2.0, 1.6)), (75, 4.3, (2.0, 1.6, 1.0)), (130, 3.8, (3.0, 2.0, 1.4)),
            (175, 4.5, (1.8, 1.4, 0.8)), (215, 3.5, (2.6, 1.9, 1.7)), (300, 3.9, (1.6, 1.3, 0.7)),
            (330, 4.7, (2.4, 1.7, 1.2)), (250, 5.3, (1.4, 1.1, 0.6)), (100, 5.7, (1.2, 1.0, 0.5))]
    for k, (az, r, s) in enumerate(ring):
        a = math.radians(az)
        x, y = sx + r * math.cos(a), sy + r * math.sin(a)
        o = facet_rock(f"Crown{k}", s, seed=60 + k, collection=col, res=24, strata=0.32 + 0.05 * (k % 3),
                       planes=int(rng.integers(10, 16)))
        _place(o, x, y, sink=0.25 * s[2], yaw=a + math.pi / 2 + rng.normal(0, 0.3), follow=0.6)
        objs.append(o)
    # the soil patch: a small (sprout-sized, ~1.1 m) mound of rich dark loam with a ragged crumbly edge, crumbs and
    # pebbles scattered round it (the last living ground on the mountain)
    zs = float(terrain.height(sx, sy))
    nr, na = 7, 36
    verts, faces = [(0.0, 0.0, 0.05)], []
    for i in range(1, nr + 1):
        t = i / nr
        for j in range(na):
            a = TAU * j / na
            rr = 0.55 * t * (1 + 0.16 * math.sin(a * 3 + 1.1) + 0.1 * math.sin(a * 7 + 0.4) + 0.06 * rng.normal())
            z = 0.05 * (1 - t ** 2) + 0.012 * rng.normal() - 0.035 * t ** 6
            verts.append((rr * math.cos(a), rr * math.sin(a), z))
    for j in range(na):
        faces.append((0, 1 + j, 1 + (j + 1) % na))
    for i in range(nr - 1):
        b0, b1 = 1 + i * na, 1 + (i + 1) * na
        for j in range(na):
            j2 = (j + 1) % na
            faces.append((b0 + j, b1 + j, b1 + j2, b0 + j2))
    soil = geo.obj_from("SummitSoil", verts, faces, col, envmat.soil())
    soil.location = (sx, sy, zs + 0.01)
    geo.displace_noise(soil, 0.012, 0.05, seed=4)
    # crumbs + small pebbles (one static cover cloud)
    from . import dress
    lib = dress.protos()
    n = 220
    r = 0.62 * np.sqrt(rng.random(n)) ** 0.7
    a = rng.uniform(0, TAU, n)
    X, Y = sx + r * np.cos(a), sy + r * np.sin(a)
    isp = rng.random(n) < 0.18
    pr = np.where(isp, dress._choose(rng, ["pebble"], lib, n), dress._choose(rng, ["crumb"], lib, n))
    scl = np.where(isp, rng.uniform(0.02, 0.05, n), rng.uniform(0.5, 1.1, n))
    Z = dress.surface(X, Y) + 0.04 * np.clip(1 - (r / 0.55) ** 2, 0, 1)
    P = dict(co=np.stack([X, Y, Z], 1), proto=pr.astype(np.int32), scale=scl,
             rot=np.stack([rng.normal(0, 0.3, n), rng.normal(0, 0.3, n), rng.uniform(0, TAU, n)], 1))
    dress._cloud("CoverSoil", P, col)
    return dict(objs=objs, soil=soil, soil_top=Vector((sx, sy, zs + 0.02)))


# ===================================================================== scree
SCREE_SIZE = (5.5, 9.0)        # across, along the slope (m)


def _scree_frame():
    cx, cy = layout.SCREE
    gx, gy = terrain.grad(np.array([cx]), np.array([cy]))
    down = Vector((-float(gx[0]), -float(gy[0]), 0.0))
    down = down.normalized() if down.length > 1e-4 else Vector((0, -1, 0))
    side = Vector((-down.y, down.x, 0.0))
    return Vector((cx, cy, 0.0)), down, side


def scree(seed=3, collection=None, plates=26, stones=40):
    """The scree slope at SCREE: an ash sheet in irregular plates (looks like the ground until it slides) and loose
    stones. The terrain under it is painted as a dark scar (exposed when the plates go)."""
    col = collection or geo.coll("Scree")
    rng = np.random.default_rng(seed)
    c, down, side = _scree_frame()
    W, L = SCREE_SIZE
    # plate seeds (jittered grid) and a fine grid assigned to the nearest seed
    seeds = []
    na, nl = 4, 7
    for i in range(na):
        for j in range(nl):
            seeds.append(((i + 0.5 + rng.uniform(-0.35, 0.35)) / na - 0.5, (j + 0.5 + rng.uniform(-0.35, 0.35)) / nl - 0.5))
    seeds = np.array(seeds[:plates]) * np.array([W, L])
    st = 0.12
    us = np.arange(-W / 2, W / 2 + 1e-6, st)
    vs = np.arange(-L / 2, L / 2 + 1e-6, st)
    UU, VV = np.meshgrid(us, vs)
    pts = np.stack([UU.ravel(), VV.ravel()], 1)
    d = np.linalg.norm(pts[:, None, :] - seeds[None, :, :], axis=2)
    own = np.argmin(d, 1)
    ell = (UU.ravel() / (W / 2)) ** 2 + (VV.ravel() / (L / 2)) ** 2
    inside = ell < 1.0 + 0.15 * np.sin(np.arctan2(VV.ravel(), UU.ravel()) * 5)
    out = []
    m = envmat.ground()
    for k in range(len(seeds)):
        sel = (own == k) & inside
        if sel.sum() < 6:
            continue
        # quads of the grid whose 4 corners all belong to plate k
        ny, nx = UU.shape
        idx = np.full(ny * nx, -1)
        ids = np.nonzero(sel)[0]
        idx[ids] = np.arange(len(ids))
        quads = []
        for jj in range(ny - 1):
            for ii in range(nx - 1):
                a = jj * nx + ii
                q = (a, a + 1, a + nx + 1, a + nx)
                if all(idx[t] >= 0 for t in q):
                    quads.append(tuple(idx[t] for t in q))
        if not quads:
            continue
        P = pts[ids]
        wx = c.x + side.x * P[:, 0] + down.x * P[:, 1]
        wy = c.y + side.y * P[:, 0] + down.y * P[:, 1]
        wz = terrain.height_micro(wx, wy) + 0.035
        cen = Vector((wx.mean(), wy.mean(), wz.mean()))
        verts = np.stack([wx - cen.x, wy - cen.y, wz - cen.z], 1)
        Q = np.array(quads, dtype=np.int32)
        # a skirt hanging 6 cm under the boundary so the plate reads as a crust when it moves
        from collections import Counter
        ecount = Counter()
        for q in Q:
            for a_, b_ in zip(q, np.roll(q, -1)):
                ecount[(min(a_, b_), max(a_, b_))] += 1
        nv0 = len(verts)
        low = {}
        extra_v, extra_q = [], []
        for q in Q:
            for a_, b_ in zip(q, np.roll(q, -1)):
                if ecount[(min(a_, b_), max(a_, b_))] == 1:
                    for vv in (a_, b_):
                        if vv not in low:
                            low[vv] = nv0 + len(extra_v)
                            extra_v.append(verts[vv] - np.array([0, 0, 0.07]))
                    extra_q.append((b_, a_, low[a_], low[b_]))
        if extra_v:
            verts = np.concatenate([verts, np.array(extra_v)], 0)
            Q = np.concatenate([Q, np.array(extra_q, dtype=np.int32)], 0)
        ob = mesh_from(f"ScreePlate{k:02d}", verts, Q, col, m)
        ob.location = cen
        wx = np.concatenate([wx, wx[list(low.keys())]]) if extra_v else wx
        wy = np.concatenate([wy, wy[list(low.keys())]]) if extra_v else wy
        wz = np.concatenate([wz, wz[list(low.keys())] - 0.07]) if extra_v else wz
        ashc, grnc, msk = terrain.paint(wx, wy, wz, scar=False)
        ashc[:, :3] *= 1.05
        for nm, arr in (("ashc", ashc), ("grnc", grnc), ("msk", msk)):
            at = ob.data.color_attributes.new(nm, "FLOAT_COLOR", "POINT")
            at.data.foreach_set("color", arr.astype(np.float32).ravel())
        out.append(ob)
    # loose stones on the sheet (instanced as real objects so they can tumble)
    from . import dress
    lib = dress.protos()
    pcoll = bpy.data.collections[dress.PROTO_COLL]
    stone_protos = [o for o in pcoll.objects if "_stone" in o.name]
    sts = []
    for k in range(stones):
        u, v = rng.uniform(-W / 2, W / 2), rng.uniform(-L / 2, L / 2)
        if (u / (W / 2)) ** 2 + (v / (L / 2)) ** 2 > 1.0:
            continue
        p = c + side * u + down * v
        src = stone_protos[k % len(stone_protos)]
        o = bpy.data.objects.new(f"ScreeStone{k:02d}", src.data)
        col.objects.link(o)
        s = rng.uniform(0.08, 0.32)
        o.scale = (s, s, s)
        o.location = (p.x, p.y, float(terrain.height_micro(p.x, p.y)) + 0.01)
        o.rotation_euler = (rng.normal(0, 0.2), rng.normal(0, 0.2), rng.uniform(0, TAU))
        sts.append(o)
    return dict(plates=out, stones=sts, center=c, down=down, side=side,
                rest=[(o, o.location.copy(), o.rotation_euler.copy()) for o in out + sts])


def scree_slide(M, f_slip, dur=1.6, run=7.0, seed=3, origin=None):
    """B09: from absolute frame f_slip the scree sheet breaks up: plates nearest `origin` (default the sheet's upper
    middle, where Claude steps) go first, then the rest; they slide `run` m downhill (accelerating, then braking at
    the foot) following the terrain, tilting and spinning a little; stones tumble faster and further, bouncing.
    Returns [(world pos, frame)] for dust puffs (fx.dust_puff / fx.slide_dust)."""
    S = M["scree"] if "scree" in M else M
    rng = np.random.default_rng(seed)
    fps = bpy.context.scene.render.fps
    c, down = S["center"], S["down"]
    org = Vector(origin) if origin is not None else c - down * (SCREE_SIZE[1] * 0.3)
    puffs = []
    for (o, p0, r0) in S["rest"]:
        stone = o.name.startswith("ScreeStone")
        dist = (Vector((p0.x, p0.y, 0)) - Vector((org.x, org.y, 0))).length
        t0 = f_slip + int(dist * 0.06 * fps + rng.uniform(0, 0.12) * fps)
        T = dur * rng.uniform(0.8, 1.15) * (0.85 if stone else 1.0)
        R = run * rng.uniform(0.75, 1.2) * (1.35 if stone else 1.0)
        spin = Vector(rng.normal(0, 1, 3)) * (9.0 if stone else 0.5)
        lat = rng.normal(0, 0.6)
        frames = list(range(f_slip - 1, t0 + int(T * fps) + 2))
        for f in frames:
            t = max(0.0, (f - t0) / fps)
            u = min(t / T, 1.0)
            e = u * u * (3 - 2 * u)
            q = p0 + down * (R * e) + Vector((-down.y, down.x, 0)) * (lat * e)
            zg = float(terrain.height_micro(q.x, q.y))
            hop = (abs(math.sin(u * math.pi * 3.0)) * 0.25 * (1 - u)) if stone else 0.0
            o.location = (q.x, q.y, zg + (0.03 if not stone else 0.02) + hop)
            if stone:
                o.rotation_euler = (r0.x + spin.x * t, r0.y + spin.y * t, r0.z + spin.z * t)
            else:
                o.rotation_euler = (r0.x + spin.x * e * 0.3 - 0.15 * math.sin(u * math.pi),
                                    r0.y + spin.y * e * 0.3, r0.z + spin.z * e)
            o.keyframe_insert("location", frame=f)
            o.keyframe_insert("rotation_euler", frame=f)
        if not stone:
            puffs.append((Vector(o.location), t0 + 2))
            q = p0 + down * (R * 0.95)
            puffs.append((Vector((q.x, q.y, float(terrain.height(q.x, q.y)))), t0 + int(T * fps * 0.85)))
    return puffs


def build(detail=1.0, scree_on=True):
    out = {}
    out["rocks"] = outcrops(density=detail)
    out["ledge"] = ledge()
    out["hail"] = hail_wall()
    out["crown"] = crown()
    if scree_on:
        out["scree"] = scree()
    lx, ly = layout.LEDGE
    hx, hy = layout.HAIL_SPOT
    out["keep_clear"] = [(lx, ly - 0.4, 2.3), (layout.PEAK_SOIL[0], layout.PEAK_SOIL[1], 0.5)]
    return out
