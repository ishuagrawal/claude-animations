"""Animation toolkit: keyed pose tracks with per-key easing, procedural layers (breath, blinks, saccades,
tremble, walk cycles, springs) and camera tracks. Everything is a pure function of shot-local time t
(seconds) so shots are deterministic and re-timeable from the cue sheet."""
import math
import numpy as np

FPS = 24


# ---------------------------------------------------------------- easing
def ease(name, u):
    u = min(max(u, 0.0), 1.0)
    if name == "linear":
        return u
    if name == "in":
        return u * u * u
    if name == "out":
        return 1 - (1 - u) ** 3
    if name == "inout":
        return 4 * u ** 3 if u < 0.5 else 1 - (-2 * u + 2) ** 3 / 2
    if name == "smooth":
        return u * u * (3 - 2 * u)
    if name == "soft":     # gentle sine in/out
        return 0.5 - 0.5 * math.cos(math.pi * u)
    if name == "back":     # overshoot then settle
        c1, c3 = 1.70158, 2.70158
        return 1 + c3 * (u - 1) ** 3 + c1 * (u - 1) ** 2
    if name == "backin":   # anticipation (dips first)
        c1, c3 = 1.70158, 2.70158
        return c3 * u ** 3 - c1 * u ** 2
    if name == "elastic":
        if u in (0, 1):
            return u
        return 2 ** (-10 * u) * math.sin((u * 10 - 0.75) * (2 * math.pi) / 3) + 1
    if name == "step":
        return 1.0 if u >= 1 else 0.0
    if name == "snap":     # fast start, long settle
        return 1 - (1 - u) ** 5
    raise ValueError(name)


# ---------------------------------------------------------------- noise
def snoise(t, seed=0, freq=1.0):
    """Smooth 1-D noise in [-1, 1] (sum of incommensurate sines)."""
    r = np.random.default_rng(seed)
    ph = r.random(4) * 6.283
    f = np.array([1.0, 1.618, 2.414, 3.303]) * freq
    a = np.array([0.5, 0.25, 0.15, 0.1])
    return float(np.sum(a * np.sin(t * f * 6.283 + ph)))


# ---------------------------------------------------------------- pose track
class Track:
    """keys: track.key(t, ease='inout', **params). Each param interpolates only between keys that set it."""

    def __init__(self, defaults=None):
        self.defaults = dict(defaults or {})
        self.keys = []
        self.layers = []
        self._cache = None

    def key(self, t, ease="inout", **params):
        self.keys.append((float(t), params, ease))
        self._cache = None
        return self

    def pose(self, t, pose, ease="inout", **extra):
        p = dict(pose)
        p.update(extra)
        return self.key(t, ease, **p)

    def hold(self, t, *names):
        """Re-key the current values of names (or all keyed params) at time t (holds until then)."""
        cur = self.base(t)
        ps = names or {k for (_, p, _) in self.keys for k in p}
        self.keys.append((float(t), {k: cur[k] for k in ps if k in cur}, "linear"))
        self._cache = None
        return self

    def layer(self, fn):
        """fn(t, params) -> None (mutates params). Applied in order after key interpolation."""
        self.layers.append(fn)
        return self

    def _chan(self):
        if self._cache is None:
            ch = {}
            for (t, p, e) in sorted(self.keys, key=lambda k: k[0]):
                for k, v in p.items():
                    ch.setdefault(k, []).append((t, v, e))
            self._cache = ch
        return self._cache

    def base(self, t):
        out = dict(self.defaults)
        for k, ks in self._chan().items():
            if t <= ks[0][0]:
                out[k] = ks[0][1]
                continue
            if t >= ks[-1][0]:
                out[k] = ks[-1][1]
                continue
            for i in range(len(ks) - 1):
                t0, v0, _ = ks[i]
                t1, v1, e1 = ks[i + 1]
                if t0 <= t <= t1:
                    u = ease(e1, (t - t0) / (t1 - t0) if t1 > t0 else 1.0)
                    out[k] = v0 + (v1 - v0) * u
                    break
        return out

    def at(self, t):
        p = self.base(t)
        for fn in self.layers:
            fn(t, p)
        return p


# ---------------------------------------------------------------- procedural layers
def breathe(amp=0.012, rate=0.28, seed=0):
    def f(t, p):
        p["squash"] = p.get("squash", 0.0) + amp * math.sin(2 * math.pi * rate * t + seed)
    return f


def blinks(times=None, seed=0, every=(2.2, 4.5), dur=0.16, t_end=60.0, start=0.4, skip=None):
    """Auto blinks (multiplies eye_open). times: explicit blink start times; else random intervals.
    skip(t) -> True suppresses auto blinks (e.g. while eyes are already closed)."""
    if times is None:
        r = np.random.default_rng(seed)
        times, t = [], start
        while t < t_end:
            t += r.uniform(*every)
            times.append(t)
            if r.random() < 0.18:      # occasional double blink
                times.append(t + 0.26)

    def f(t, p):
        for b in times:
            if b <= t < b + dur:
                if skip and skip(b):
                    return
                u = (t - b) / dur
                close = 1 - (u / 0.35 if u < 0.35 else (0 if u < 0.5 else (u - 0.5) / 0.5))
                p["eye_open"] = p.get("eye_open", 1.0) * (1 - 0.97 * max(0.0, min(1.0, close)))
                return
    return f


def blink_at(t0, dur=0.32, depth=1.0):
    """A deliberate slow blink (used for the 'blink twice' ritual)."""
    def f(t, p):
        if t0 <= t < t0 + dur:
            u = (t - t0) / dur
            c = math.sin(math.pi * u) ** 0.7
            p["eye_open"] = p.get("eye_open", 1.0) * (1 - depth * c)
    return f


def saccades(seed=0, amp=0.18, every=(0.6, 1.8), t_end=60.0):
    r = np.random.default_rng(seed)
    pts, t = [(0.0, 0.0, 0.0)], 0.0
    while t < t_end:
        t += r.uniform(*every)
        pts.append((t, r.normal(0, amp), r.normal(0, amp * 0.6)))

    def f(t, p):
        dx = dy = 0.0
        for i in range(len(pts) - 1, -1, -1):
            if pts[i][0] <= t:
                t0, x1, y1 = pts[i]
                x0, y0 = pts[i - 1][1:] if i > 0 else (0, 0)
                u = ease("out", (t - t0) / 0.06)
                dx, dy = x0 + (x1 - x0) * u, y0 + (y1 - y0) * u
                break
        p["look_x"] = p.get("look_x", 0.0) + dx
        p["look_y"] = p.get("look_y", 0.0) + dy
    return f


def tremble(t0, t1, amp=1.5, freq=18.0, seed=0, ramp=0.15):
    def f(t, p):
        if t0 <= t <= t1:
            w = min(1.0, (t - t0) / ramp, (t1 - t) / ramp)
            p["roll"] = p.get("roll", 0.0) + amp * w * math.sin(2 * math.pi * freq * t + seed)
            p["x"] = p.get("x", 0.0) + 0.002 * amp * w * math.sin(2 * math.pi * freq * 1.3 * t)
    return f


def wobble(param, t0, t1, amp, freq=2.0, decay=3.0):
    """Damped oscillation on a param starting at t0 (follow-through after an impact)."""
    def f(t, p):
        if t0 <= t <= t1:
            u = t - t0
            p[param] = p.get(param, 0.0) + amp * math.exp(-decay * u) * math.sin(2 * math.pi * freq * u)
    return f


def fn_layer(func):
    return func


# ---------------------------------------------------------------- paths & walking
class Path:
    """Piecewise path through (t, x, y) keys, eased per segment. Gives position, heading, distance."""

    def __init__(self, pts, ease_="inout"):
        self.pts = [(float(t), float(x), float(y)) for (t, x, y) in pts]
        self.e = ease_
        ts = np.linspace(self.pts[0][0], self.pts[-1][0], max(2, int((self.pts[-1][0] - self.pts[0][0]) * 96)))
        xy = np.array([self._pos(t) for t in ts])
        d = np.concatenate([[0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))])
        self._ts, self._d = ts, d

    def _pos(self, t):
        P = self.pts
        if t <= P[0][0]:
            return P[0][1], P[0][2]
        if t >= P[-1][0]:
            return P[-1][1], P[-1][2]
        for i in range(len(P) - 1):
            if P[i][0] <= t <= P[i + 1][0]:
                u = ease(self.e, (t - P[i][0]) / (P[i + 1][0] - P[i][0]))
                return P[i][1] + (P[i + 1][1] - P[i][1]) * u, P[i][2] + (P[i + 1][2] - P[i][2]) * u

    def pos(self, t):
        return self._pos(t)

    def dist(self, t):
        return float(np.interp(t, self._ts, self._d))

    def speed(self, t, dt=1 / 48):
        return (self.dist(t + dt) - self.dist(t - dt)) / (2 * dt)

    def heading(self, t, dt=0.1):
        x0, y0 = self._pos(t - dt)
        x1, y1 = self._pos(t + dt)
        if math.hypot(x1 - x0, y1 - y0) < 1e-5:
            return None
        # character faces -Y at heading 0: heading = angle from -Y to travel direction
        return math.degrees(math.atan2(x1 - x0, -(y1 - y0)))


def walk(path, stride=0.16, swing=28.0, knee=30.0, bob=0.022, sway=3.0, z_fn=None, face=True,
         heading_offset=0.0, t_turn=0.25):
    """Layer: moves the character along path with a 4-leg trot (legs 0&2 / 1&3 alternate)."""
    last_h = [None]

    def f(t, p):
        x, y = path.pos(t)
        p["x"], p["y"] = x, y
        if z_fn:
            p["z"] = z_fn(x, y)
        if face:
            h = path.heading(t)
            if h is not None:
                p["heading"] = h + heading_offset
            elif "heading" not in p:
                p["heading"] = heading_offset
        v = path.speed(t)
        amt = min(1.0, v / 0.25)
        ph = path.dist(t) / stride * math.pi
        for i in range(4):
            off = 0.0 if i in (0, 2) else math.pi
            s = math.sin(ph + off)
            p[f"leg{i}_swing"] = p.get(f"leg{i}_swing", 0.0) + swing * s * amt
            p[f"leg{i}_knee"] = p.get(f"leg{i}_knee", 0.0) + knee * max(0.0, math.cos(ph + off)) * amt
        p["hop"] = p.get("hop", 0.0) + bob * abs(math.sin(ph)) * amt
        p["roll"] = p.get("roll", 0.0) + sway * math.sin(ph) * amt
        p["lean"] = p.get("lean", 0.0) + 4.0 * amt
        for side in ("L", "R"):
            sg = 1 if side == "L" else -1
            p[f"arm{side}_fwd"] = p.get(f"arm{side}_fwd", 0.0) + 12 * math.sin(ph + (0 if side == "L" else math.pi)) * amt
    return f


def hop_arc(t0, t1, height, squash=0.12):
    """A jump: anticipation squash, airborne arc (stretch), landing squash."""
    def f(t, p):
        pre = 0.12
        if t0 - pre <= t < t0:
            u = (t - (t0 - pre)) / pre
            p["squash"] = p.get("squash", 0.0) - squash * math.sin(math.pi * u * 0.5)
        elif t0 <= t <= t1:
            u = (t - t0) / (t1 - t0)
            p["hop"] = p.get("hop", 0.0) + height * 4 * u * (1 - u)
            p["squash"] = p.get("squash", 0.0) + squash * 0.8 * math.sin(math.pi * u) * (1 - u)
        elif t1 < t <= t1 + 0.25:
            u = (t - t1) / 0.25
            p["squash"] = p.get("squash", 0.0) - squash * math.sin(math.pi * u) * (1 - u * 0.5)
    return f


def spring_follow(src, dst, gain=1.0, freq=3.0, damp=0.35, fps=FPS, t0=0.0, t1=30.0):
    """Secondary motion: dst += gain * (spring response - src) for the src param signal. Pre-simulated."""
    state = {}

    def prepare(track_base):
        n = int((t1 - t0) * fps) + 2
        w = 2 * math.pi * freq
        y = track_base(t0).get(src, 0.0)
        v = 0.0
        out = []
        dt = 1 / fps
        for i in range(n):
            t = t0 + i * dt
            x = track_base(t).get(src, 0.0)
            a = w * w * (x - y) - 2 * damp * w * v
            v += a * dt
            y += v * dt
            out.append(y - x)
        state["lag"] = np.array(out)

    def f(t, p):
        if "lag" not in state:
            return
        i = int(round((t - t0) * fps))
        i = min(max(i, 0), len(state["lag"]) - 1)
        p[dst] = p.get(dst, 0.0) + gain * float(state["lag"][i])
    f.prepare = prepare
    return f


def prepare_layers(track):
    for fn in track.layers:
        if hasattr(fn, "prepare"):
            fn.prepare(track.base)


# ---------------------------------------------------------------- camera
CAM_DEFAULT = dict(cx=0.0, cy=-5.0, cz=1.0, tx=0.0, ty=0.0, tz=0.5, lens=35.0, focus=0.0, fstop=0.0, roll=0.0,
                   shake=0.0)


def bake_camera(cam, track, f0, f1, seed=0):
    import bpy
    from mathutils import Vector, Matrix
    prepare_layers(track)
    cd = cam.data
    for f in range(f0, f1 + 1):
        t = (f - f0) / FPS
        p = track.at(t)
        sh = p.get("shake", 0.0)
        loc = Vector((p["cx"] + sh * snoise(t, seed, 0.7) * 0.02, p["cy"] + sh * snoise(t, seed + 1, 0.6) * 0.02,
                      p["cz"] + sh * snoise(t, seed + 2, 0.8) * 0.015))
        tgt = Vector((p["tx"], p["ty"], p["tz"]))
        d = tgt - loc
        q = d.to_track_quat("-Z", "Y")
        roll = p.get("roll", 0.0) + sh * snoise(t, seed + 3, 0.5) * 0.3
        cam.rotation_mode = "QUATERNION"
        cam.rotation_quaternion = q @ Matrix.Rotation(math.radians(roll), 4, "Z").to_quaternion()
        cam.location = loc
        cd.lens = p["lens"]
        cam.keyframe_insert("location", frame=f)
        cam.keyframe_insert("rotation_quaternion", frame=f)
        cd.keyframe_insert("lens", frame=f)
        if p.get("fstop", 0) > 0:
            cd.dof.use_dof = True
            cd.dof.aperture_fstop = p["fstop"]
            cd.dof.focus_distance = p["focus"] if p.get("focus", 0) > 0 else d.length
            cd.dof.keyframe_insert("focus_distance", frame=f)
            cd.dof.keyframe_insert("aperture_fstop", frame=f)
