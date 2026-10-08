"""Procedural painterly textures (numpy only, deterministic, tileable, cached as PNG).

Everything the painterly look needs as texture comes from here:
  strokes()  — a tileable field of oil/gouache brush strokes (value, hue-jitter, height, coverage)
  dabs()     — an atlas of individual brush dabs with alpha (foliage, grass, splatter)
  stipple()  — dappled cirrus / sponge texture
Textures are generated once and cached in cache/tex/<name>.png.
"""
import os, struct, zlib
import numpy as np

from .paths import CACHE

TEX_DIR = os.path.join(CACHE, "tex")


# ---------------------------------------------------------------- io
def png_write(path, arr):
    arr = np.ascontiguousarray(arr)
    if arr.ndim == 2:
        arr = arr[:, :, None]
    h, w, c = arr.shape
    ct = {1: 0, 3: 2, 4: 6}[c]
    if arr.dtype != np.uint8:
        arr = (np.clip(arr, 0, 1) * 255 + 0.5).astype(np.uint8)
    raw = b"".join(b"\x00" + arr[y].tobytes() for y in range(h))
    def chunk(t, d):
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, ct, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def cached(name, fn, *a, **k):
    """Return the path of cache/tex/<name>.png, generating it with fn(*a, **k) if missing."""
    path = os.path.join(TEX_DIR, name + ".png")
    if not os.path.exists(path):
        png_write(path, fn(*a, **k))
    return path


# ---------------------------------------------------------------- helpers
def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def fnoise(n, freq, seed, octaves=1, gain=0.5, aniso=(1.0, 1.0)):
    """Tileable band-limited noise in [0,1] (FFT-filtered white noise; periodic by construction)."""
    rng = np.random.default_rng(seed)
    acc = np.zeros((n, n))
    amp, f, tot = 1.0, freq, 0.0
    ky = np.fft.fftfreq(n)[:, None] * n
    kx = np.fft.fftfreq(n)[None, :] * n
    for _ in range(octaves):
        wn = rng.standard_normal((n, n))
        r = np.sqrt((kx / aniso[0]) ** 2 + (ky / aniso[1]) ** 2)
        filt = np.exp(-(r / max(f, 1e-6)) ** 2)
        filt[0, 0] = 0
        layer = np.real(np.fft.ifft2(np.fft.fft2(wn) * filt))
        layer /= layer.std() + 1e-9
        acc += amp * layer
        tot += amp
        amp *= gain
        f *= 2
    acc /= tot
    return np.clip(acc * 0.22 + 0.5, 0, 1)


def blur(img, sigma):
    n0, n1 = img.shape[:2]
    ky = np.fft.fftfreq(n0)[:, None]
    kx = np.fft.fftfreq(n1)[None, :]
    g = np.exp(-2 * (np.pi * sigma) ** 2 * (kx ** 2 + ky ** 2))
    if img.ndim == 2:
        return np.real(np.fft.ifft2(np.fft.fft2(img) * g))
    return np.stack([np.real(np.fft.ifft2(np.fft.fft2(img[..., c]) * g)) for c in range(img.shape[2])], -1)


class _Bristles:
    """1-D smooth noise used for bristle streaks across a stroke."""
    def __init__(self, rng):
        self.v = rng.random(512)

    def __call__(self, x):
        x = np.mod(x, 511.0)
        i = np.floor(x).astype(int)
        f = x - i
        f = f * f * (3 - 2 * f)
        return self.v[i] * (1 - f) + self.v[i + 1] * f


# ---------------------------------------------------------------- brush strokes
def strokes(n=1024, count=9000, length=(40, 110), width=(10, 26), flow_freq=2.5, flow_amt=1.4,
            base_angle=0.0, curve=0.25, bristle_freq=0.55, dry=0.35, value_sigma=0.16, seed=1,
            layers=2):
    """Tileable brush-stroke field.

    R = paint value (0.5 mean), G = per-stroke random (hue jitter), B = paint height, A = coverage.
    Strokes follow a smooth flow field (base_angle + noise), are slightly curved, tapered and dry at
    the tail, with bristle streaks along their length. Several layers are laid wet-on-wet.
    """
    rng = np.random.default_rng(seed)
    bris = _Bristles(rng)
    flow = (fnoise(n, flow_freq, seed + 11) - 0.5) * 2 * np.pi * flow_amt + base_angle
    val = np.full((n, n), 0.5)
    jit = rng.random((n, n)) * 0 + 0.5
    hgt = np.zeros((n, n))
    cov = np.zeros((n, n))
    # base tone: a few very broad soft strokes so there are no holes
    val += (fnoise(n, 3, seed + 3) - 0.5) * value_sigma * 1.2
    per_layer = count // layers
    for layer in range(layers):
        lscale = 1.0 - 0.35 * layer  # later layers: smaller, more detailed strokes
        for _ in range(per_layer):
            cx, cy = rng.random() * n, rng.random() * n
            a = flow[int(cy) % n, int(cx) % n] + rng.normal(0, 0.12)
            L = rng.uniform(*length) * lscale
            W = rng.uniform(*width) * lscale
            c = rng.normal(0, curve)
            R = int(L / 2 + W) + 2
            xs = np.arange(int(cx) - R, int(cx) + R + 1)
            ys = np.arange(int(cy) - R, int(cy) + R + 1)
            dx = xs[None, :] - cx
            dy = ys[:, None] - cy
            ca, sa = np.cos(a), np.sin(a)
            u = dx * ca + dy * sa
            v = -dx * sa + dy * ca
            along = u / (L / 2)
            v = v - c * (along ** 2) * W
            across = v / (W / 2)
            # width profile: rounded head (-1), tapering dry tail (+1)
            prof = np.sqrt(np.clip(1 - np.clip(-along, 0, None) ** 4, 0, 1)) * (1 - 0.55 * smoothstep(0.2, 1.0, along))
            prof = np.maximum(prof, 1e-3)
            inside = smoothstep(1.0, 0.82, np.abs(across) / prof) * smoothstep(1.02, 0.9, np.abs(along))
            b = bris(across * 9 * bristle_freq * W / 10 + rng.random() * 400)
            dryness = dry * smoothstep(-0.2, 1.0, along) + rng.uniform(0, 0.15)
            m = inside * smoothstep(dryness - 0.12, dryness + 0.12, b)
            if not m.any():
                continue
            sv = 0.5 + rng.normal(0, value_sigma)
            streak = (b - 0.5) * 0.10 - 0.06 * smoothstep(-1, 1, along)  # paint load fades along stroke
            sval = sv + streak
            op = rng.uniform(0.65, 1.0)
            iy = np.mod(ys, n)[:, None]
            ix = np.mod(xs, n)[None, :]
            mm = m * op
            val[iy, ix] = val[iy, ix] * (1 - mm) + sval * mm
            jit[iy, ix] = jit[iy, ix] * (1 - mm) + rng.random() * mm
            h = (0.55 + 0.45 * b) * inside
            hgt[iy, ix] = np.maximum(hgt[iy, ix] * (1 - 0.6 * mm), h * m)
            cov[iy, ix] = np.maximum(cov[iy, ix], m)
    hgt = blur(hgt, 0.8)
    out = np.stack([np.clip(val, 0, 1), jit, np.clip(hgt, 0, 1), np.clip(cov, 0, 1)], -1)
    return out


# ---------------------------------------------------------------- dab atlas (foliage / grass / splatter)
def dabs(cell=256, grid=4, kind="leaf", seed=2):
    """Atlas of grid x grid brush dabs with alpha. kind: 'leaf' (rounded loaded dab), 'blade'
    (tall grass stroke), 'needle' (conifer flick clump), 'splat' (paint splatter)."""
    rng = np.random.default_rng(seed)
    bris = _Bristles(rng)
    n = cell * grid
    out = np.zeros((n, n, 4))
    yy, xx = np.mgrid[0:cell, 0:cell].astype(float)
    for gy in range(grid):
        for gx in range(grid):
            acc_a = np.zeros((cell, cell))
            acc_v = np.zeros((cell, cell))
            if kind == "leaf":
                strokes_n = rng.integers(3, 6)
                specs = []
                for _ in range(strokes_n):
                    specs.append((cell * (0.5 + rng.normal(0, 0.09)), cell * (0.52 + rng.normal(0, 0.09)),
                                  rng.uniform(0, np.pi), cell * rng.uniform(0.35, 0.6), cell * rng.uniform(0.16, 0.26)))
            elif kind == "blade":
                strokes_n = rng.integers(2, 4)
                specs = [(cell * (0.5 + rng.normal(0, 0.12)), cell * 0.55, -np.pi / 2 + rng.normal(0, 0.25),
                          cell * rng.uniform(0.6, 0.85), cell * rng.uniform(0.06, 0.1)) for _ in range(strokes_n)]
            elif kind == "needle":
                strokes_n = rng.integers(6, 11)
                specs = [(cell * (0.5 + rng.normal(0, 0.14)), cell * (0.5 + rng.normal(0, 0.1)),
                          rng.normal(0, 0.35), cell * rng.uniform(0.35, 0.65), cell * rng.uniform(0.05, 0.09))
                         for _ in range(strokes_n)]
            else:  # splat
                strokes_n = rng.integers(8, 16)
                specs = [(cell * (0.5 + rng.normal(0, 0.18)), cell * (0.5 + rng.normal(0, 0.18)),
                          rng.uniform(0, np.pi), cell * rng.uniform(0.05, 0.25), cell * rng.uniform(0.04, 0.12))
                         for _ in range(strokes_n)]
            for (cx, cy, a, L, W) in specs:
                ca, sa = np.cos(a), np.sin(a)
                dx, dy = xx - cx, yy - cy
                u = dx * ca + dy * sa
                v = -dx * sa + dy * ca
                along = u / (L / 2)
                across = v / (W / 2)
                prof = np.sqrt(np.clip(1 - np.clip(-along, 0, None) ** 4, 0, 1)) * (1 - 0.7 * smoothstep(0.1, 1.0, along))
                prof = np.maximum(prof, 1e-3)
                ins = smoothstep(1.0, 0.75, np.abs(across) / prof) * smoothstep(1.02, 0.85, np.abs(along))
                b = bris(across * 6 + rng.random() * 300)
                m = ins * smoothstep(0.25 * smoothstep(-0.3, 1, along) - 0.1, 0.25 * smoothstep(-0.3, 1, along) + 0.15, b)
                sv = 0.5 + rng.normal(0, 0.15) + (b - 0.5) * 0.15
                acc_v = acc_v * (1 - m) + sv * m
                acc_a = np.maximum(acc_a, m)
            # keep away from cell borders
            edge = smoothstep(0, cell * 0.06, np.minimum(np.minimum(xx, cell - 1 - xx), np.minimum(yy, cell - 1 - yy)))
            acc_a *= edge
            sl = (slice(gy * cell, (gy + 1) * cell), slice(gx * cell, (gx + 1) * cell))
            out[sl[0], sl[1], 0] = np.clip(acc_v, 0, 1)
            out[sl[0], sl[1], 1] = rng.random()
            out[sl[0], sl[1], 2] = np.clip(yy / cell, 0, 1)[:, :] * 0 + (1 - yy / cell)  # vertical gradient (root dark)
            out[sl[0], sl[1], 3] = np.clip(acc_a, 0, 1)
    return out


# ---------------------------------------------------------------- stipple / sponge
def stipple(n=1024, freq=18, thresh=0.56, soft=0.05, seed=5, aniso=(1.0, 1.0)):
    """Dappled sponge texture (cirrus stipple, lichen, splatter fields). R=mask value, A=mask."""
    a = fnoise(n, freq, seed, octaves=3, gain=0.55, aniso=aniso)
    b = fnoise(n, freq * 3.0, seed + 1, octaves=2)
    m = smoothstep(thresh - soft, thresh + soft, a * 0.8 + b * 0.2)
    v = 0.5 + (b - 0.5) * 0.6
    return np.stack([v, b, a, m], -1)


def ensure_all():
    """Generate the standard texture set; returns dict name -> path."""
    T = {}
    T["strokes_fine"] = cached("strokes_fine2", strokes, n=1024, count=12000, length=(26, 70), width=(8, 18),
                               flow_freq=2.0, flow_amt=0.45, base_angle=0.5, curve=0.15, value_sigma=0.11, seed=11)
    T["strokes_broad"] = cached("strokes_broad2", strokes, n=1024, count=6000, length=(60, 160), width=(16, 40),
                                flow_freq=1.6, flow_amt=0.4, base_angle=0.25, curve=0.18, seed=12)
    T["strokes_vert"] = cached("strokes_vert", strokes, n=1024, count=9000, length=(50, 140), width=(8, 20),
                               flow_freq=2.0, flow_amt=0.15, base_angle=np.pi / 2, curve=0.1, seed=13)
    T["strokes_horiz"] = cached("strokes_horiz", strokes, n=1024, count=9000, length=(70, 180), width=(8, 22),
                                flow_freq=2.0, flow_amt=0.12, base_angle=0.0, curve=0.15, seed=14)
    T["dab_leaf"] = cached("dab_leaf", dabs, cell=256, grid=4, kind="leaf", seed=21)
    T["dab_blade"] = cached("dab_blade", dabs, cell=256, grid=4, kind="blade", seed=22)
    T["dab_needle"] = cached("dab_needle", dabs, cell=256, grid=4, kind="needle", seed=23)
    T["dab_splat"] = cached("dab_splat", dabs, cell=256, grid=4, kind="splat", seed=24)
    T["stipple"] = cached("stipple", stipple, n=1024, freq=14, seed=31, aniso=(2.2, 1.0))
    T["sponge"] = cached("sponge", stipple, n=1024, freq=26, thresh=0.6, seed=32)
    T["cloudmass"] = cached("cloudmass", cloudmass, n=2048, seed=41)
    T["page_comet"] = cached("page_comet", book_page, n=1024, seed=51, kind="comet")
    T["page_notes"] = cached("page_notes", book_page, n=1024, seed=52, kind="notes")
    T["strokes_soft"] = cached("strokes_soft", strokes, n=1024, count=2600, length=(70, 180), width=(24, 56),
                               flow_freq=1.4, flow_amt=0.3, base_angle=0.3, curve=0.2, bristle_freq=0.35, dry=0.15,
                               value_sigma=0.07, seed=15, layers=1)
    return T


def cloudmass(n=2048, seed=41, freq=2.6, cover=0.56):
    """Tileable painted cumulus masses: R = mask (brushed edges), G = thickness (for lit/shade), B = brush value."""
    base = fnoise(n, freq, seed, octaves=5, gain=0.55, aniso=(1.6, 1.0))
    st = strokes(n=n, count=int(n * n / 260), length=(40, 140), width=(14, 40), flow_freq=1.5, flow_amt=0.35,
                 base_angle=0.0, curve=0.25, value_sigma=0.18, seed=seed + 1, layers=1)[..., 0]
    v = base + (st - 0.5) * 0.10
    mask = smoothstep(cover - 0.035, cover + 0.035, v)
    thick = blur(mask, n / 160.0)
    thick = np.clip((thick - 0.3) / 0.7, 0, 1) * mask
    return np.stack([mask, thick, st, np.ones_like(mask)], -1)


def book_page(n=1024, seed=51, kind="comet"):
    """Parchment page with ink drawings. kind='comet': a comet arcing over a little peak with a windmill, three
    moons in a row (three nights), a few stars; kind='notes': star charts and scribbles."""
    rng = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:n, 0:n].astype(float) / n
    paper = 0.86 + (fnoise(n, 6, seed, octaves=3) - 0.5) * 0.12
    edge = np.clip(np.minimum(np.minimum(xx, 1 - xx), np.minimum(yy, 1 - yy)) / 0.08, 0, 1)
    paper = paper * (0.8 + 0.2 * edge)
    ink = np.zeros((n, n))

    def stroke_line(p0, p1, w=0.004, k=0.9):
        nonlocal ink
        p0, p1 = np.array(p0), np.array(p1)
        d = p1 - p0
        L2 = (d ** 2).sum() + 1e-9
        t = np.clip(((xx - p0[0]) * d[0] + (yy - p0[1]) * d[1]) / L2, 0, 1)
        dist = np.hypot(xx - (p0[0] + t * d[0]), yy - (p0[1] + t * d[1]))
        ink = np.maximum(ink, k * smoothstep(w, w * 0.4, dist))

    def circle(c, r, w=0.004, fill=False, k=0.9):
        nonlocal ink
        dist = np.hypot(xx - c[0], yy - c[1])
        if fill:
            ink = np.maximum(ink, k * smoothstep(r, r * 0.85, dist))
        else:
            ink = np.maximum(ink, k * smoothstep(w, w * 0.3, np.abs(dist - r)))

    def poly(pts, w=0.004, k=0.9):
        for a, b in zip(pts[:-1], pts[1:]):
            stroke_line(a, b, w, k)

    if kind == "comet":
        # mountain peak + windmill at the bottom
        poly([(0.08, 0.86), (0.3, 0.7), (0.42, 0.62), (0.55, 0.66), (0.72, 0.78), (0.92, 0.88)], 0.005)
        poly([(0.45, 0.63), (0.465, 0.53), (0.505, 0.53), (0.52, 0.64)], 0.004)
        for ang in (0.4, 1.97, 3.54, 5.11):
            cx, cy = 0.485, 0.52
            stroke_line((cx, cy), (cx + 0.07 * np.cos(ang), cy + 0.07 * np.sin(ang)), 0.003)
        # comet: head + curving tail lines
        hx, hy = 0.7, 0.24
        circle((hx, hy), 0.018, fill=True)
        for k in range(6):
            pts = []
            for i in range(30):
                u = i / 29
                pts.append((hx - 0.5 * u + 0.02 * k * u, hy + 0.12 * u * u - 0.03 * k * u + 0.02 * np.sin(u * 3 + k)))
            poly(pts, 0.0025, 0.7)
        # dotted arc path of the comet
        for i in range(14):
            u = i / 13
            circle((0.2 + 0.5 * u, 0.42 - 0.2 * np.sin(np.pi * u * 0.9)), 0.004, fill=True, k=0.7)
        # three moons in a row (three nights)
        for j, x in enumerate((0.2, 0.32, 0.44)):
            circle((x, 0.12), 0.03, 0.004)
            dist2 = np.hypot(xx - (x + 0.012), yy - 0.115)
            ink = np.where((np.hypot(xx - x, yy - 0.12) < 0.03) & (dist2 > 0.026), np.maximum(ink, 0.85), ink)
        # stars
        for _ in range(14):
            sx, sy = rng.uniform(0.05, 0.95), rng.uniform(0.05, 0.5)
            r = rng.uniform(0.006, 0.012)
            stroke_line((sx - r, sy), (sx + r, sy), 0.002)
            stroke_line((sx, sy - r), (sx, sy + r), 0.002)
    else:
        for _ in range(9):
            sx, sy = rng.uniform(0.1, 0.9), rng.uniform(0.1, 0.9)
            circle((sx, sy), 0.006, fill=True)
        for j in range(16):
            y = 0.1 + j * 0.05
            xs = 0.08
            while xs < 0.9:
                w = rng.uniform(0.02, 0.07)
                stroke_line((xs, y), (xs + w, y + rng.normal(0, 0.002)), 0.0025, 0.55)
                xs += w + 0.015
    ink = blur(ink, 0.6)
    col = np.stack([paper * 0.98, paper * 0.9, paper * 0.74], -1) * (1 - ink[..., None]) + \
        np.array([0.12, 0.09, 0.08]) * ink[..., None]
    return np.concatenate([np.clip(col, 0, 1), np.ones((n, n, 1))], -1)
