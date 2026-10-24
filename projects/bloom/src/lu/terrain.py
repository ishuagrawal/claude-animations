"""The burnt valley and the mountain: one deterministic heightfield + LOD meshes painted per vertex.

  height(x, y)            vectorised terrain height (m). The valley floor is ~0 at the stump; the summit ~55 m.
  height_micro(x, y)      + close-range relief (ash ripples, lumps) used by the hero patches.
  slope(x, y)             slope angle (rad).
  bloom_dist(x, y)        distance of the bloom wave from PEAK_SOIL (same analytic warp as the shaders and GN).
  build(hero=...)         base terrain (1 m in the valley/mountain, coarser outside) + high-res hero patches:
                          "stump" (7 cm), "climb" (a 14 cm strip along SLOPE_START..PEAK), "summit" (7 cm).
                          The patches sit a hair above the base, whose surface dips under them, so they never crack.
  ridges()                the layered far ridges ringing the valley (silhouettes fading into the haze).

Geography: the valley runs north from the stump (0, 0) between east and west walls (~45 m high, 120-180 m out); a
low rim closes it to the south; the mountain rises out of its north end (summit at layout.PEAK, 55 m) with strata
benches on its south face (the climb); shoulders run WNW-ESE through the summit. Ash dunes with wind ripples
(the wind blows from the west-north-west, like the storm) cover the floor; rock shows on steep risers.

Vertex attributes (all FLOAT_COLOR, POINT): ashc = ash-phase albedo, grnc = bloom-phase albedo (A = flower density),
msk = (rock, crack, ember, dune crest). The ground shader (envmat.ground) paints from these."""
import math
import bpy
import numpy as np

from . import geo, layout

PZ = 55.0                               # summit height
WIND = np.array([1.0, -0.35]) / math.hypot(1.0, 0.35)    # the prevailing wind blows toward (ESE)


# ====================================================================== noise
def _hash(ix, iy, seed):
    h = np.sin(ix * 127.1 + iy * 311.7 + seed * 74.7 + 0.5) * 43758.5453
    return h - np.floor(h)


def vnoise(x, y, seed=0):
    """Smooth value noise in [-1, 1] on a unit lattice (vectorised, deterministic)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    ix, iy = np.floor(x), np.floor(y)
    fx, fy = x - ix, y - iy
    ux = fx * fx * (3 - 2 * fx)
    uy = fy * fy * (3 - 2 * fy)
    a = _hash(ix, iy, seed)
    b = _hash(ix + 1, iy, seed)
    c = _hash(ix, iy + 1, seed)
    d = _hash(ix + 1, iy + 1, seed)
    return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2.0 - 1.0


def fbm(x, y, seed=0, wl=10.0, octaves=4, gain=0.5, lac=2.03):
    """Fractal value noise ~[-1, 1] with base wavelength wl (m); each octave rotated (no lattice alignment)."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    acc = np.zeros(np.broadcast(x, y).shape)
    amp, tot = 1.0, 0.0
    for i in range(octaves):
        a = 0.6 + i * 1.31 + seed * 0.37
        ca, sa = math.cos(a), math.sin(a)
        xr = (x * ca - y * sa) / wl + i * 17.3 + seed * 3.1
        yr = (x * sa + y * ca) / wl - i * 9.7 - seed * 1.7
        acc = acc + amp * vnoise(xr, yr, seed * 13 + i)
        tot += amp
        amp *= gain
        wl /= lac
    return acc / tot


def ridged(x, y, seed=0, wl=10.0, octaves=4):
    return 1.0 - np.abs(fbm(x, y, seed, wl, octaves))


def ss(e0, e1, x):
    t = np.clip((np.asarray(x, dtype=float) - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def _smax(a, b, k):
    h = np.clip(0.5 + 0.5 * (a - b) / k, 0, 1)
    return a * h + b * (1 - h) + k * h * (1 - h)


# ====================================================================== bloom wave distance
# d = |p - PEAK_SOIL| + w(d) * sum A sin(k1.p + p1) sin(k2.p + p2): organic lobes racing ahead along the valley.
# The SAME formula is built in shader nodes (envmat) and geometry nodes (dress/foliage) so every system agrees.
BLOOM_WARP = ((16.0, 0.031, 0.012, 1.3, -0.008, 0.027, 0.4),
              (9.0, -0.019, 0.044, 2.1, 0.051, 0.006, 5.2),
              (4.0, 0.083, -0.061, 0.7, 0.035, 0.092, 3.3))
BLOOM_WARP_R = (6.0, 45.0)             # the warp fades in between these radii (the start is a clean circle)


def bloom_dist(x, y):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    d = np.hypot(x - layout.PEAK_SOIL[0], y - layout.PEAK_SOIL[1])
    w = np.zeros_like(d)
    for (A, k1x, k1y, p1, k2x, k2y, p2) in BLOOM_WARP:
        w = w + A * np.sin(k1x * x + k1y * y + p1) * np.sin(k2x * x + k2y * y + p2)
    return d + w * ss(BLOOM_WARP_R[0], BLOOM_WARP_R[1], d)


# ====================================================================== the heightfield
def _ang(th, k, seed):
    """Smooth periodic noise around a circle (k lobes-ish), ~[-1, 1]."""
    rng = np.random.default_rng(seed)
    acc = np.zeros_like(th)
    tot = 0.0
    for i in range(4):
        n = int(k * (1.7 ** i)) + int(rng.integers(0, 2))
        a = 1.0 / (1 + i)
        acc = acc + a * np.sin(n * th + rng.uniform(0, TAU_))
        tot += a
    return acc / tot


TAU_ = 2 * math.pi
PROFILE = (np.array([0.0, 3.0, 6.0, 10.0, 15.0, 20.0, 28.0, 36.0, 45.0, 55.0, 65.0, 80.0, 120.0]),
           np.array([55.0, 54.4, 52.6, 48.8, 43.2, 37.6, 29.0, 20.5, 12.8, 6.4, 2.6, 0.4, 0.0]))


def _mountain(x, y):
    """The peak: a steep strata horn on a broad talus apron, spurs and gullies radiating from the summit, a lower
    sub-peak to the east-south-east and a long shoulder running down toward the storm side (WNW)."""
    px, py = layout.PEAK
    dx, dy = x - px, y - py
    th = np.arctan2(dy, dx)
    sy = np.where(dy < 0, 0.92, 1.18)
    d = np.hypot(dx, dy * sy)
    sp = 1.0 + (0.12 * _ang(th, 5, 1) + 0.05 * _ang(th, 13, 2) + 0.08 * fbm(x, y, 4, 26.0, 2)) * ss(5.0, 22.0, d)
    de = d / sp
    de = np.sqrt(de * de + 2.6 ** 2) - 2.6
    z = np.interp(de, PROFILE[0], PROFILE[1])
    # sub-peak ESE + the WNW shoulder
    d2 = np.hypot(x - (px + 40.0), (y - (py - 10.0)) * 1.1)
    z = _smax(z, 33.0 * np.exp(-np.power(d2 / 20.0, 1.7)), 5.0)
    u = (dx * -0.94 + dy * 0.33)
    v = (dx * 0.33 + dy * 0.94) - 4.0
    sh = 30.0 * np.exp(-(v / 18.0) ** 2) * np.exp(-np.maximum(u, 0.0) / 85.0) * ss(-5.0, 20.0, u)
    z = _smax(z, sh * (1 + 0.25 * fbm(x, y, 3, 30.0, 3)), 6.0)
    # back ridge to the north-east (joins the north rim)
    u2 = (dx * 0.5 + dy * 0.87)
    v2 = (dx * -0.87 + dy * 0.5)
    z = _smax(z, 26.0 * np.exp(-(v2 / 22.0) ** 2) * ss(0.0, 25.0, u2) * np.exp(-np.maximum(u2 - 30, 0) / 120.0), 6.0)
    # rocky relief: crags on the flanks, gentler at the crown and on the apron
    w = ss(4.0, 12.0, z) * (1 - ss(49.0, 54.0, z))
    z = z + w * (3.0 * fbm(x, y, 7, 20.0, 4) + 1.8 * ridged(x, y, 8, 9.0, 3) - 0.9)
    return z


def _terrace(z, x, y):
    """Sedimentary strata: benches + steep risers (gently dipping, wavy), on the mountain's flanks."""
    s = z + 0.05 * x - 0.035 * y + 1.6 * fbm(x, y, 21, 24.0, 3)
    h = 5.2
    k = np.floor(s / h)
    f = s / h - k
    g = f * 0.32 + 0.68 * ss(0.52, 0.86, f)
    s2 = (k + g) * h
    th = np.arctan2(y - layout.PEAK[1], x - layout.PEAK[0])
    w = ss(7.0, 13.0, z) * (1 - ss(47.0, 52.5, z)) * (0.35 + 0.65 * ss(-0.3, 0.4, _ang(th, 4, 9)))
    return z + (s2 - s) * w, (s2 - s) * w


def _valley(x, y):
    ax = 0.10 * y + 8.0 * np.sin(y / 70.0)
    dxa = np.abs(x - ax) + 14.0 * fbm(x, y, 5, 70.0, 2)
    # east / west walls: a ridge crest ~150-190 m out (burnt forest on its skyline), falling away behind
    walls = 31.0 * np.power(ss(50.0, 168.0, dxa), 1.2) * (1 - 0.55 * ss(205.0, 330.0, dxa))
    walls = walls * (1 + 0.38 * fbm(x, y, 6, 85.0, 3)) + 6.0 * ridged(x, y, 9, 45.0, 3) * ss(70.0, 150.0, dxa)
    sy = y + 10.0 * fbm(x, y, 12, 60.0, 2)
    south = 24.0 * np.power(ss(-55.0, -170.0, sy), 1.2) * (1 - 0.5 * ss(-215.0, -300.0, sy)) * \
        (1 + 0.3 * fbm(x, y, 13, 70.0, 2))
    north = 30.0 * ss(205.0, 320.0, y) * (1 + 0.3 * fbm(x, y, 14, 60.0, 2))
    floor = 0.9 * fbm(x, y, 11, 55.0, 3) + 1.6 * ss(40.0, 95.0, y) * (0.5 + 0.5 * fbm(x, y, 15, 30.0, 2))
    # knolls on the valley floor (rocky tops) and a shallow dry gully winding down the valley's east side
    for (kx, ky, kr, kh) in KNOLLS:
        floor = floor + kh * np.exp(-((x - kx) ** 2 + (y - ky) ** 2) / (kr * kr)) * (1 + 0.3 * fbm(x, y, 16, 8.0, 2))
    gx_ = 38.0 + 14.0 * np.sin(y / 45.0) + 6.0 * fbm(x, y, 17, 30.0, 2)
    floor = floor - 1.3 * np.exp(-((x - gx_) / 4.5) ** 2) * ss(-140.0, -60.0, y) * (1 - ss(60.0, 85.0, y))
    return floor + walls + south + north


KNOLLS = ((-48.0, 30.0, 16.0, 5.5), (62.0, -38.0, 13.0, 4.0), (-70.0, -55.0, 18.0, 7.0), (75.0, 60.0, 15.0, 5.0),
          (-30.0, 95.0, 12.0, 4.5), (110.0, 120.0, 20.0, 6.0))


def _dunes(x, y):
    """Ash dunes: asymmetric crests across the wind (gentle windward, steep lee), patchy, 0.1-0.6 m."""
    s = (x * WIND[0] + y * WIND[1]) / 8.5 + 0.9 * fbm(x, y, 31, 22.0, 2) + 0.25 * fbm(x, y, 32, 6.0, 2)
    f = s - np.floor(s)
    prof = np.where(f < 0.78, ss(0.0, 0.78, f), 1.0 - ss(0.78, 1.0, f))
    amp = 0.12 + 0.42 * ss(-0.3, 0.6, fbm(x, y, 33, 40.0, 2))
    hum = 0.35 * fbm(x, y, 34, 14.0, 3)
    return prof * amp + hum


def _bench(x, y, z, at, r0, r1, dz=0.0):
    """Flatten a small bench into the slope around `at` (the marks where Claude stops)."""
    z0 = float(_raw(np.array([at[0]]), np.array([at[1]]))[0]) + dz
    w = 1 - ss(r0, r1, np.hypot(x - at[0], y - at[1]))
    return z * (1 - w) + z0 * w


def _pads(x, y, z):
    """Flatten the stump's surroundings (a gentle mound under the old tree) and benches at the climb's marks."""
    sx, sy = layout.STUMP
    d = np.hypot(x - sx, y - sy)
    z0 = 0.18
    w = 1 - ss(6.0, 15.0, d)
    z = z * (1 - w) + (z0 + 0.08 * fbm(x, y, 35, 6.0, 2) + 0.25 * (1 - ss(1.0, 4.0, d))) * w
    z = _bench(x, y, z, layout.HAIL_SPOT, 1.6, 3.6)
    z = _bench(x, y, z, layout.LEDGE, 1.0, 2.6)     # the tread on top of the ledge (its rock face drops south)
    lx, ly = layout.LEDGE
    ztop = float(_raw(np.array([lx]), np.array([ly]))[0])
    w = 1 - ss(0.9, 2.2, np.hypot(x - lx, (y - (ly - LEDGE_FOOT_DY)) * 1.4))
    z = z * (1 - w) + (ztop - LEDGE_STEP) * w          # a landing at the ledge's foot: the step is ~1.15 m
    return z


LEDGE_STEP = 1.15
LEDGE_FOOT_DY = 2.3


def _raw(x, y):
    zm = _mountain(x, y)
    zm, _ = _terrace(zm, x, y)
    zv = _valley(x, y)
    dunes = _dunes(x, y) * (1 - ss(2.0, 7.0, zm)) * (1 - ss(14.0, 30.0, zv))
    return _smax(zv, zm, 4.0) + dunes


def height(x, y):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    return _pads(x, y, _raw(x, y))


def height_micro(x, y):
    """height + close-range relief: wind ripples in the ash (~0.3 m, 1-1.5 cm), lumps and drifts."""
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    z = height(x, y)
    s = (x * WIND[0] + y * WIND[1]) / 0.31 + 2.2 * fbm(x, y, 41, 2.6, 3)
    f = s - np.floor(s)
    rip = np.where(f < 0.7, ss(0.0, 0.7, f), 1.0 - ss(0.7, 1.0, f)) - 0.5
    sl = slope(x, y)
    amp = 0.016 * (0.4 + 0.6 * ss(-0.4, 0.5, fbm(x, y, 42, 5.0, 2))) * (1 - ss(0.45, 0.75, sl))
    lumps = 0.018 * fbm(x, y, 43, 0.9, 3) + 0.006 * fbm(x, y, 44, 0.18, 2)
    # rocky, stony ground on the mountain (broken crust, embedded rock, small ledges)
    zm = _mountain(x, y)
    rocky = ss(5.0, 14.0, zm) * ss(1.6, 3.2, np.hypot(x - layout.PEAK_SOIL[0], y - layout.PEAK_SOIL[1]))
    crust = 0.07 * ridged(x, y, 45, 1.3, 3) + 0.035 * fbm(x, y, 46, 0.45, 2)
    return z + rip * amp * (1 - 0.7 * rocky) + lumps + crust * rocky


def slope(x, y, e=0.6):
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    gx = (height(x + e, y) - height(x - e, y)) / (2 * e)
    gy = (height(x, y + e) - height(x, y - e)) / (2 * e)
    return np.arctan(np.hypot(gx, gy))


def grad(x, y, e=0.6):
    gx = (height(x + e, y) - height(x - e, y)) / (2 * e)
    gy = (height(x, y + e) - height(x, y - e)) / (2 * e)
    return gx, gy


# ====================================================================== painting (vertex attributes)
ASH_BONE = np.array([0.44, 0.43, 0.405])
ASH_GREY = np.array([0.25, 0.243, 0.236])
ASH_WARM = np.array([0.245, 0.222, 0.198])
CHARCOAL = np.array([0.028, 0.025, 0.024])
SOOT = np.array([0.075, 0.056, 0.042])
SCORCH = np.array([0.15, 0.08, 0.045])
ROCK = np.array([0.15, 0.145, 0.155])
ROCK_WARM = np.array([0.22, 0.18, 0.15])
G_EMER = np.array([0.025, 0.12, 0.04])
G_CHART = np.array([0.08, 0.22, 0.045])
G_YEL = np.array([0.20, 0.25, 0.06])
G_BLUE = np.array([0.02, 0.11, 0.08])
SOIL = np.array([0.075, 0.05, 0.032])


SCAR = np.array([0.055, 0.042, 0.034])


def scree_mask(x, y):
    """The scar under the scree sheet at SCREE (fresh dark charcoal-earth, exposed when the sheet slides, B09)."""
    cx, cy = layout.SCREE
    gx, gy = grad(np.array([cx]), np.array([cy]))
    dv = np.array([-float(gx[0]), -float(gy[0])])
    dv = dv / (np.linalg.norm(dv) + 1e-9)
    sv = np.array([-dv[1], dv[0]])
    u = (x - cx) * sv[0] + (y - cy) * sv[1]
    v = (x - cx) * dv[0] + (y - cy) * dv[1]
    e = (u / 2.6) ** 2 + (v / 4.3) ** 2 + 0.15 * fbm(x, y, 91, 1.5, 2)
    return 1 - ss(0.75, 1.0, e)


def paint(x, y, z, scar=True):
    """Per-vertex colours/masks for the ground shader. Returns (ashc, grnc, msk) arrays (n, 4)."""
    n = len(x)
    sl = slope(x, y)
    zm = _mountain(x, y)
    _, terr = _terrace(zm, x, y)
    n1 = fbm(x, y, 51, 9.0, 3)
    n2 = fbm(x, y, 52, 2.2, 3)
    n3 = fbm(x, y, 53, 30.0, 2)
    # dune crests (pale fresh ash) vs hollows (charcoal debris collects)
    dn = _dunes(x, y) * (1 - ss(2.0, 7.0, zm))
    crest = ss(0.18, 0.5, dn + 0.15 * n2)
    hollow = ss(0.12, -0.05, dn + 0.08 * n2)
    rock = np.clip(ss(0.62, 0.92, sl + 0.12 * n1) + ss(0.6, 1.6, np.abs(terr)) * ss(0.35, 0.6, sl), 0, 1)
    rock = rock * ss(1.5, 4.0, zm + 2.0 * n3) + ss(0.85, 1.05, sl) * (1 - ss(1.5, 4.0, zm))
    rock = np.clip(rock, 0, 1)
    # ash phase albedo
    a = ASH_GREY[None, :] * np.ones((n, 1))
    a = a + (ASH_WARM - ASH_GREY)[None, :] * ss(-0.3, 0.6, n3)[:, None]
    a = a + (ASH_BONE - a) * (crest * (0.6 + 0.4 * ss(-0.5, 0.5, n1)))[:, None]
    a = a + (SOOT - a) * (0.55 * ss(0.15, 0.7, n1 * 0.7 + n2 * 0.5))[:, None]
    a = a + (CHARCOAL - a) * (0.75 * hollow * ss(-0.2, 0.4, n2))[:, None]
    crack = ss(0.25, 0.6, fbm(x, y, 54, 16.0, 3) + 0.25 * n2) * (1 - crest) * (1 - ss(0.5, 0.8, sl))
    a = a + (SCORCH - a) * (0.65 * crack)[:, None]
    rc0 = ROCK + (ROCK_WARM - ROCK) * ss(-0.4, 0.6, fbm(x, y, 55, 7.0, 2))[:, None]
    tread = ss(0.55, 0.3, sl)                     # ash dusts the benches of the rock bands
    rc = rc0 + (ASH_BONE * 1.05 - rc0) * (0.7 * tread)[:, None]
    a = a * (1 - rock[:, None]) + rc * rock[:, None]
    a = a * (0.9 + 0.2 * (0.5 + 0.5 * n2))[:, None]
    n4 = fbm(x, y, 56, 55.0, 3)
    burn = ss(0.05, 0.45, n4) * (1 - rock)
    drift_ = ss(-0.1, -0.5, n4) * (1 - rock)
    a = a * (1 - 0.55 * burn)[:, None] + (ASH_BONE * 1.1 - a) * (0.45 * drift_)[:, None]
    # bloom albedo
    gsel = 0.5 + 0.5 * fbm(x, y, 61, 18.0, 3)
    g = G_EMER[None, :] + (G_CHART - G_EMER)[None, :] * ss(0.35, 0.75, gsel)[:, None]
    g = g + (G_YEL - g) * (0.6 * ss(0.62, 0.9, gsel + 0.15 * n2))[:, None]
    g = g + (G_BLUE - g) * (0.7 * ss(0.4, 0.1, gsel))[:, None]
    g = g * (0.85 + 0.3 * (0.5 + 0.5 * n2))[:, None]
    rg = rc0 * 0.5 + np.array([0.05, 0.13, 0.03]) * 0.5 * (1 + 0.6 * tread)[:, None]
    g = g * (1 - rock[:, None] * 0.6) + rg * (rock[:, None] * 0.6)
    flowers = np.clip(ss(0.1, 0.55, fbm(x, y, 62, 11.0, 3)) * (1 - rock) * (1 - ss(0.6, 0.85, sl)), 0, 1)
    # summit soil patch: dark loam
    ps = np.hypot(x - layout.PEAK_SOIL[0], y - layout.PEAK_SOIL[1])
    soil = 1 - ss(0.42, 0.75, ps + 0.08 * n2)
    a = a * (1 - soil[:, None]) + SOIL[None, :] * soil[:, None]
    g = g * (1 - soil[:, None]) + SOIL[None, :] * 1.1 * soil[:, None]
    rock = rock * (1 - soil)
    # inside the hollow stump: dark charcoal floor (seen through the door)
    dst = np.hypot(x - layout.STUMP[0], y - layout.STUMP[1])
    ins = 1 - ss(layout.STUMP_R * 1.3, layout.STUMP_R * 1.45, dst)
    dth = np.angle(np.exp(1j * (np.arctan2(y - layout.STUMP[1], x - layout.STUMP[0]) - math.radians(layout.DOOR_AZ))))
    ins = np.maximum(ins, (1 - ss(0.3, 0.5, np.abs(dth))) * (1 - ss(2.2, 2.7, dst)) * 0.85)     # the door's threshold
    a = a * (1 - ins[:, None]) + CHARCOAL[None, :] * 1.4 * ins[:, None]
    if scar:
        sc_ = scree_mask(x, y)
        a = a * (1 - sc_[:, None]) + SCAR[None, :] * (0.85 + 0.3 * (0.5 + 0.5 * n2))[:, None] * sc_[:, None]
        rock = rock * (1 - sc_)
    # embers: in charcoal hollows and the valley floor (not on the mountain), sparse
    ember = hollow * ss(0.2, 0.6, n1 + 0.5 * n2) * (1 - ss(3.0, 8.0, zm))
    ashc = np.concatenate([np.clip(a, 0, 1), np.ones((n, 1))], 1)
    grnc = np.concatenate([np.clip(g, 0, 1), flowers[:, None]], 1)
    msk = np.stack([rock, crack, ember, crest], 1)
    return ashc, grnc, msk


# ====================================================================== meshes
def mesh_grid(name, X, Y, Z, collection=None, material=None):
    """Fast quad-grid mesh from (ny, nx) arrays."""
    ny, nx = X.shape
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1).astype(np.float32)
    i = (np.arange(ny - 1)[:, None] * nx + np.arange(nx - 1)[None, :]).ravel()
    quads = np.stack([i, i + 1, i + nx + 1, i + nx], 1).astype(np.int32)
    return mesh_from(name, verts, quads, collection, material)


def mesh_from(name, verts, quads, collection=None, material=None):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(verts))
    me.vertices.foreach_set("co", np.asarray(verts, dtype=np.float32).ravel())
    me.loops.add(quads.size)
    me.loops.foreach_set("vertex_index", quads.ravel().astype(np.int32))
    me.polygons.add(len(quads))
    me.polygons.foreach_set("loop_start", np.arange(0, quads.size, quads.shape[1], dtype=np.int32))
    me.update(calc_edges=True)
    me.shade_smooth()
    ob = bpy.data.objects.new(name, me)
    (collection or bpy.context.scene.collection).objects.link(ob)
    if material is not None:
        me.materials.append(material)
    return ob


def _attrs(ob, x, y, z):
    ashc, grnc, msk = paint(x, y, z)
    me = ob.data
    for nm, arr in (("ashc", ashc), ("grnc", grnc), ("msk", msk)):
        a = me.color_attributes.new(nm, "FLOAT_COLOR", "POINT")
        a.data.foreach_set("color", arr.astype(np.float32).ravel())


def _axis(spans):
    out = []
    for (a, b, step) in spans:
        n = max(2, int(round((b - a) / step)) + 1)
        v = np.linspace(a, b, n)
        if out:
            v = v[1:]
        out.append(v)
    return np.concatenate(out)


def path_points(step=0.5):
    """The climb route (smooth Catmull-Rom through the marks, from below SLOPE_START to just past the summit)."""
    P = [(10.5, 80.0), layout.SLOPE_START, layout.SCREE, layout.LEDGE, layout.HAIL_SPOT, layout.PEAK,
         (layout.PEAK[0] + 1.0, layout.PEAK[1] + 6.0)]
    P = [np.array(p, dtype=float) for p in P]
    pts = []
    for i in range(len(P) - 1):
        p0 = P[max(i - 1, 0)]
        p1, p2 = P[i], P[i + 1]
        p3 = P[min(i + 2, len(P) - 1)]
        L = np.linalg.norm(p2 - p1)
        n = max(2, int(L / step))
        for k in range(n):
            t = k / n
            t2, t3 = t * t, t * t * t
            q = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            pts.append(q)
    pts.append(P[-1])
    return np.array(pts)


def dist_to_path(x, y, pts=None):
    pts = path_points() if pts is None else pts
    x = np.asarray(x, dtype=float)
    y = np.asarray(y, dtype=float)
    d = np.full(np.shape(x), 1e9)
    for a, b in zip(pts[:-1], pts[1:]):
        ab = b - a
        L2 = float(ab @ ab) + 1e-12
        t = np.clip(((x - a[0]) * ab[0] + (y - a[1]) * ab[1]) / L2, 0, 1)
        d = np.minimum(d, np.hypot(x - (a[0] + t * ab[0]), y - (a[1] + t * ab[1])))
    return d


HERO = {
    "stump": dict(kind="rect", rect=(-13.0, 13.0, -13.0, 11.0), step=0.07),
    "summit": dict(kind="rect", rect=(layout.PEAK[0] - 17.0, layout.PEAK[0] + 17.0, layout.PEAK[1] - 18.0,
                                       layout.PEAK[1] + 14.0), step=0.09),
    "climb": dict(kind="strip", half=11.0, step=0.15),
}
EDGE = 0.7         # blend band (m) where a hero patch dives under the base terrain
ACTIVE_HERO = ()   # the hero patches built in this scene (dress.surface puts instances on them)


def _rect_inside(x, y, rect, edge):
    x0, x1, y0, y1 = rect
    d = np.minimum.reduce([x - x0, x1 - x, y - y0, y1 - y])
    return np.clip(d / edge, 0, 1)


def build(hero=("stump", "climb", "summit"), collection=None, material=None):
    """Base terrain + hero patches. Returns dict(base=obj, hero={name: obj})."""
    global ACTIVE_HERO
    from . import envmat
    ACTIVE_HERO = tuple(hero)
    col = collection or geo.coll("Terrain")
    m = material or envmat.ground()
    xs = _axis([(-340.0, -95.0, 4.0), (-95.0, 115.0, 1.0), (115.0, 350.0, 4.0)])
    ys = _axis([(-250.0, -55.0, 4.0), (-55.0, 215.0, 1.0), (215.0, 370.0, 4.0)])
    X, Y = np.meshgrid(xs, ys)
    Z = height(X, Y)
    # dip the base under the hero patches, and cut it away where a hero patch fully covers it (a 1 m chord surface
    # can rise above the true one in hollows and poke through)
    pts = path_points()
    dip = np.zeros_like(Z)
    deep = np.zeros(Z.shape, dtype=bool)
    for h in hero:
        H = HERO[h]
        if H["kind"] == "rect":
            dip = np.maximum(dip, _rect_inside(X, Y, H["rect"], EDGE * 1.4))
            x0, x1, y0, y1 = H["rect"]
            deep |= (X > x0 + 1.5) & (X < x1 - 1.5) & (Y > y0 + 1.5) & (Y < y1 - 1.5)
        else:
            box = (X > -6) & (X < 56) & (Y > 64) & (Y < 172)
            dd = np.full(X.shape, 1e9)
            dd[box] = dist_to_path(X[box], Y[box], pts)
            dip = np.maximum(dip, np.clip((H["half"] - dd) / (EDGE * 1.4), 0, 1))
            deep |= dd < H["half"] - 1.5
    Z = Z - 0.25 * dip
    ny, nx = X.shape
    verts = np.stack([X.ravel(), Y.ravel(), Z.ravel()], 1).astype(np.float32)
    i = (np.arange(ny - 1)[:, None] * nx + np.arange(nx - 1)[None, :]).ravel()
    quads = np.stack([i, i + 1, i + nx + 1, i + nx], 1).astype(np.int32)
    dv = deep.ravel()
    quads = quads[~(dv[quads[:, 0]] & dv[quads[:, 1]] & dv[quads[:, 2]] & dv[quads[:, 3]])]
    base = mesh_from("Terrain", verts, quads, col, m)
    _attrs(base, X.ravel(), Y.ravel(), Z.ravel())
    out = dict(base=base, hero={})
    for h in hero:
        H = HERO[h]
        if H["kind"] == "rect":
            x0, x1, y0, y1 = H["rect"]
            hx = np.linspace(x0, x1, int((x1 - x0) / H["step"]) + 1)
            hy = np.linspace(y0, y1, int((y1 - y0) / H["step"]) + 1)
            HX, HY = np.meshgrid(hx, hy)
            inside = _rect_inside(HX, HY, H["rect"], EDGE)
        else:
            # curvilinear strip along the climb route
            P = path_points(step=H["step"])
            T = np.gradient(P, axis=0)
            T /= np.linalg.norm(T, axis=1, keepdims=True)
            Nn = np.stack([-T[:, 1], T[:, 0]], 1)
            v = np.linspace(-H["half"], H["half"], int(2 * H["half"] / H["step"]) + 1)
            HX = P[:, 0][:, None] + Nn[:, 0][:, None] * v[None, :]
            HY = P[:, 1][:, None] + Nn[:, 1][:, None] * v[None, :]
            lat = np.clip((H["half"] - np.abs(v)) / EDGE, 0, 1)[None, :] * np.ones((len(P), 1))
            along = np.minimum(np.arange(len(P)), np.arange(len(P))[::-1]) * H["step"]
            inside = lat * np.clip(along / EDGE, 0, 1)[:, None]
        HZ = height_micro(HX, HY) + 0.012 * inside - 0.14 * (1 - inside)
        ob = mesh_grid(f"TerrainHero_{h}", HX, HY, HZ, col, m)
        _attrs(ob, HX.ravel(), HY.ravel(), HZ.ravel())
        out["hero"][h] = ob
    return out


# ====================================================================== far ridges
RIDGE_LAYERS = (  # (distance m, height m, roughness wavelength m, seed): rings around the valley
    (560.0, 115.0, 160.0, 1),
    (900.0, 175.0, 240.0, 2),
    (1450.0, 250.0, 330.0, 3),
    (2300.0, 360.0, 480.0, 4),
)
RIDGE_CENTER = (20.0, 60.0)


def ridge_profile(az, layer):
    """Crest height of a ridge layer at azimuth az (rad) around RIDGE_CENTER."""
    dist, hgt, wl, seed = RIDGE_LAYERS[layer]
    u = az * dist
    c = 0.55 + 0.45 * ridged(u, np.full_like(u, 3.7 * seed), seed + 70, wl, 4)
    c = c * (0.7 + 0.3 * fbm(u, np.full_like(u, 1.3), seed + 80, wl * 3.0, 2))
    return hgt * c


def ridges(collection=None, layers=(0, 1, 2, 3)):
    """Layered far ridges (rings around the valley). Each is a strip from its foot (well below the near walls)
    up to its crest. Material: envmat.far_ridge (haze by distance in the shader)."""
    from . import envmat
    col = collection or geo.coll("Ridges")
    out = []
    cx, cy = RIDGE_CENTER
    for li in layers:
        dist, hgt, wl, seed = RIDGE_LAYERS[li]
        na = int(2 * math.pi * dist / (6.0 + li * 6.0))
        az = np.linspace(0, 2 * math.pi, na, endpoint=False)
        crest = ridge_profile(az, li)
        rows = 14
        t = np.linspace(0, 1, rows)
        R = dist + (t[:, None] - 0.5) * (90.0 + 60 * li) + 0 * az[None, :]
        R = R - 25.0 * t[:, None] * np.sin(az * 3 + seed)[None, :]
        Zr = crest[None, :] * np.power(t[:, None], 0.65) - 30.0 + 18.0 * (1 - t[:, None]) * \
            fbm(az[None, :] * dist, t[:, None] * 50, seed + 90, wl * 0.5, 3)
        X = cx + R * np.cos(az)[None, :]
        Y = cy + R * np.sin(az)[None, :]
        X = np.concatenate([X, X[:, :1]], 1)
        Y = np.concatenate([Y, Y[:, :1]], 1)
        Zr = np.concatenate([Zr, Zr[:, :1]], 1)
        ob = mesh_grid(f"Ridge{li}", X, Y, Zr, col, envmat.far_ridge(li))
        me = ob.data
        a = me.attributes.new("crest", "FLOAT", "POINT")
        a.data.foreach_set("value", np.repeat(t, X.shape[1]).astype(np.float32))
        ob.visible_shadow = False
        ob["layer"] = li
        out.append(ob)
    return out
