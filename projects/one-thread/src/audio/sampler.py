"""Sampler: Apple EXS24 (.exs) instrument parser + sample loader + note renderer.

EXS24 layout (reverse-engineered; little-endian 'TBOS'/'JBOS' files, the big-endian variant is 'SOBT'/'SOBJ'):
every chunk is an 84-byte header followed by `size` bytes of data
    u32 signature   bytes 01 01 00 TT: TT & 0x0F = chunk type (0 instrument, 1 zone, 2 group, 3 sample,
                    4 params); TT & 0x40 / 0x80 are format-generation flags
    u32 size        data size (newer files set bit 0x8000, which is masked off)
    u32 id, u32 flags, char[4] magic, char[64] name
Zone data:  u8 options, u8 root key, i8 fine (cents), i8 pan, i8 volume (dB), u8 scale, u8 key lo, u8 key hi,
            u8 -, u8 vel lo, u8 vel hi, u8 -, i32 sample start, i32 sample end, i32 loop start, i32 loop end,
            i32 loop crossfade, u8 loop tune, u8 loop options (bit 0 = loop on), u8 loop direction, ...,
            @0x58 i32 group index, @0x5C i32 sample index; 128-byte zones of *consolidated* instruments also carry
            @0x74/0x78 i32 start/end of a streamed tail segment (the first ~4 s live at [start, end), the rest of
            the note continues seamlessly at [tail start, tail end); loop points are absolute file positions).
Group data: i8 volume, i8 pan, u8 polyphony, u8 options, u8 exclusive, u8 vel lo, u8 vel hi, ...,
            @0x54.. 'select' info: u8 kind, u8 controller, u8 lo, u8 hi (e.g. CC64 0-63 = pedal up), u8 key lo/hi.
Sample data: u32 data offset, u32 frames, u32 rate, u32 bits, u32 channels, ..., char[256] folder @0x50,
             char[256] file name @0x150.

Rendered audio is float32 stereo at SR (48 kHz). Decoded zone audio is cached as .npy under cache/audio/.
"""
import hashlib
import math
import os
import re
import struct
import subprocess
from dataclasses import dataclass, field

import numpy as np

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.normpath(os.path.join(HERE, "..", ".."))
CACHE = os.path.join(PROJECT, "cache", "audio")

LOGIC = "/Library/Application Support/Logic"
GB = "/Library/Application Support/GarageBand/Instrument Library/Sampler"
EXS = {
    "piano": f"{LOGIC}/Sampler Instruments/01 Acoustic Pianos/Steinway Piano 2.exs",
    "strings": f"{LOGIC}/Sampler Instruments/09 Orchestral/09 Strings/String Ensemble.exs",
    "flute": f"{LOGIC}/Sampler Instruments/09 Orchestral/01 Woodwinds/Flute Solo Legato.exs",
    "flute_stac": f"{LOGIC}/Sampler Instruments/09 Orchestral/01 Woodwinds/Flute Solo Staccato.exs",
    "clarinet": f"{LOGIC}/Sampler Instruments/09 Orchestral/01 Woodwinds/Clarinet Solo Legato.exs",
    "clarinet_stac": f"{LOGIC}/Sampler Instruments/09 Orchestral/01 Woodwinds/Clarinet Solo Staccato.exs",
    "horn": f"{LOGIC}/Sampler Instruments/09 Orchestral/02 Brass/French Horn Solo Legato.exs",
    "horns": f"{LOGIC}/Sampler Instruments/09 Orchestral/02 Brass/French Horns Legato.exs",
    "horns_stac": f"{LOGIC}/Sampler Instruments/09 Orchestral/02 Brass/French Horns Staccato.exs",
    "trombones_stac": f"{LOGIC}/Sampler Instruments/09 Orchestral/02 Brass/Trombones Staccato.exs",
    "trombones": f"{LOGIC}/Sampler Instruments/09 Orchestral/02 Brass/Trombones Legato.exs",
    "tuba": f"{LOGIC}/Sampler Instruments/09 Orchestral/02 Brass/Tuba Solo Legato.exs",
    "bass": f"{LOGIC}/Sampler Instruments/02 Bass/01 Acoustic Bass/Upright Jazz Bass.exs",
}
SAMPLE_DIRS = [f"{LOGIC}/EXS Factory Samples", f"{GB}/Sampler Files"]


# ----------------------------------------------------------------------------------------------- EXS parsing
@dataclass
class Zone:
    idx: int
    name: str
    key: int
    fine: int
    pan: int
    vol: int
    klo: int
    khi: int
    vlo: int
    vhi: int
    start: int
    end: int
    loop_on: bool
    loop_start: int
    loop_end: int
    group: int
    sample: int
    tail: tuple = None          # (start, end) of the streamed continuation in consolidated files


@dataclass
class Group:
    idx: int
    name: str
    vol: int
    pan: int
    vlo: int
    vhi: int
    cc: int = -1                # select controller (64 = sustain pedal), -1 none
    cc_lo: int = 0
    cc_hi: int = 127


@dataclass
class SampleRef:
    name: str
    folder: str
    frames: int
    rate: int
    channels: int

    def path(self):
        p = os.path.join(self.folder, self.name)
        if os.path.exists(p):
            return p
        for root in SAMPLE_DIRS:          # fall back: search the libraries by file name
            for dp, _, fs in os.walk(root):
                if self.name in fs:
                    return os.path.join(dp, self.name)
        raise FileNotFoundError(self.name)


@dataclass
class ExsInstrument:
    name: str
    path: str
    zones: list = field(default_factory=list)
    groups: list = field(default_factory=list)
    samples: list = field(default_factory=list)


def _cstr(b):
    return b.split(b"\0")[0].decode("latin1")


def parse_exs(path):
    data = open(path, "rb").read()
    magic = data[16:20]
    if magic in (b"SOBT", b"SOBJ"):
        raise NotImplementedError("big-endian EXS")
    inst = ExsInstrument(os.path.basename(path), path)
    off = 0
    while off + 84 <= len(data):
        sig, size, cid, _flags = struct.unpack_from("<IIII", data, off)
        if size & 0x8000 and size < 0x10000:
            size &= 0x7FFF
        name = _cstr(data[off + 20:off + 84])
        d = data[off + 84:off + 84 + size]
        typ = (sig >> 24) & 0x0F
        if typ == 1:
            opt, key, fine, pan, vol, _sc, klo, khi, _u, vlo, vhi, _u2 = struct.unpack_from("<BBbbbBBBBBBB", d, 0)
            s, e, ls, le, _xf = struct.unpack_from("<iiiii", d, 12)
            _lt, lopt, _ld = struct.unpack_from("<BBB", d, 32)
            grp, smp = struct.unpack_from("<ii", d, 0x58)
            tail = None
            if len(d) >= 0x7C:
                t0, t1 = struct.unpack_from("<ii", d, 0x74)
                if t1 > t0 > 0:
                    tail = (t0, t1)
            inst.zones.append(Zone(len(inst.zones), name, key, fine, pan, vol, klo, khi, vlo, vhi, s, e,
                                   bool(lopt & 1), ls, le, grp, smp, tail))
        elif typ == 2:
            vol, pan, _poly, _opt, _ex, vlo, vhi = struct.unpack_from("<bbBBBBB", d, 0)
            g = Group(len(inst.groups), name, vol, pan, vlo, vhi)
            if len(d) >= 0x5C:
                kind, cc, lo, hi = struct.unpack_from("<BBBB", d, 0x54)
                if kind == 3 and (lo, hi) != (0, 127):
                    g.cc, g.cc_lo, g.cc_hi = cc, lo, hi
            inst.groups.append(g)
        elif typ == 3:
            _ds, frames, rate, _bits, ch = struct.unpack_from("<IIIII", d, 0)
            folder = _cstr(d[0x50:0x150])
            fname = _cstr(d[0x150:0x250]) or name
            inst.samples.append(SampleRef(fname, folder, frames, rate, ch))
        off += 84 + size
    return inst


# ----------------------------------------------------------------------------------------------- decoding
def _read_caf_lpcm(path):
    """Memory-map an uncompressed CAF file -> (array (frames, ch) int view, rate)."""
    with open(path, "rb") as f:
        hdr = f.read(1 << 16)
    assert hdr[:4] == b"caff"
    pos = 8
    rate = ch = bits = None
    flags = 0
    while pos + 12 <= len(hdr):
        ctype = hdr[pos:pos + 4]
        csize = struct.unpack(">q", hdr[pos + 4:pos + 12])[0]
        body = pos + 12
        if ctype == b"desc":
            rate, fmt, flags, _bpp, _fpp, ch, bits = struct.unpack(">d4sIIIII", hdr[body:body + 32])
            assert fmt == b"lpcm"
        if ctype == b"data":
            dt = np.dtype(("<" if flags & 2 else ">") + {16: "i2", 24: "V3", 32: "i4"}[bits])
            assert bits == 16, "only 16-bit CAF supported"
            mm = np.memmap(path, dtype=dt, mode="r", offset=body + 4)
            return mm.reshape(-1, ch), int(rate)
        pos = body + csize
    raise ValueError("no data chunk")


def _ffmpeg_decode(path):
    """Decode any audio file to float32 stereo at its native rate."""
    info = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries",
                           "stream=sample_rate", "-of", "csv=p=0", path], capture_output=True, text=True, check=True)
    rate = int(info.stdout.strip().split(",")[0])
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-f", "f32le", "-ac", "2", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2), rate


_caf_cache = {}


def zone_audio(inst, z):
    """float32 (n, 2) audio of zone z at the sample's native rate (cached as .npy)."""
    os.makedirs(CACHE, exist_ok=True)
    tag = hashlib.md5(f"{inst.path}|{z.idx}|{z.start}|{z.end}|{z.tail}".encode()).hexdigest()[:12]
    fn = os.path.join(CACHE, f"z_{re.sub('[^A-Za-z0-9]+', '_', inst.name)}_{z.idx}_{tag}.npy")
    if os.path.exists(fn):
        return np.load(fn, mmap_mode="r")
    sref = inst.samples[z.sample]
    p = sref.path()
    if p.lower().endswith(".caf"):
        if p not in _caf_cache:
            _caf_cache[p] = _read_caf_lpcm(p)
        mm, _rate = _caf_cache[p]
        segs = [mm[z.start:z.end]]
        if z.tail:
            segs.append(mm[z.tail[0]:z.tail[1]])
        x = np.concatenate(segs).astype(np.float32) / 32768.0
        if x.shape[1] == 1:
            x = np.repeat(x, 2, axis=1)
    else:
        full, _rate = _ffmpeg_decode(p)
        e = z.end if z.end > z.start else len(full)
        x = np.ascontiguousarray(full[z.start:e + 1])
    np.save(fn, x.astype(np.float32))
    return np.load(fn, mmap_mode="r")


def zone_loop(z):
    """Loop (start, end) in zone-audio coordinates, or None."""
    if not z.loop_on or z.loop_end <= z.loop_start:
        return None
    if z.tail:
        head = z.end - z.start
        if z.tail[0] <= z.loop_start < z.loop_end <= z.tail[1]:
            return head + z.loop_start - z.tail[0], head + z.loop_end - z.tail[0]
        return None
    return z.loop_start - z.start, z.loop_end - z.start


_tuning = None


def pitch_cents(x, f_ref, rate):
    """Pitch of a (possibly ensemble) tone relative to f_ref, in cents: power-weighted frequency centroid of the
    spectrum within +-40 cents of each of the first harmonics (2-4 for low notes, where they carry the pitch),
    combined across harmonics by power. Robust to chorus/vibrato, unlike a single-peak pick."""
    x = np.asarray(x, np.float64)
    x = (x - x.mean()) * np.hanning(len(x))
    N = 1 << 20
    P = np.abs(np.fft.rfft(x, N)) ** 2
    df = rate / N
    num = den = 0.0
    for h in ((2, 3, 4) if f_ref < 150 else (1, 2, 3)):
        lo, hi = int(h * f_ref * 2 ** (-40 / 1200) / df), int(h * f_ref * 2 ** (40 / 1200) / df) + 1
        if hi >= len(P):
            break
        f = np.arange(lo, hi) * df / h
        w = P[lo:hi]
        if w.sum() <= 0:
            continue
        c = 1200 * np.log2(np.sum(w * f) / w.sum() / f_ref)
        num += c * w.sum()
        den += w.sum()
    return num / den if den > 0 else None


def zone_detune_cents(inst, z):
    """Measured pitch deviation (cents) of a zone's raw sample from its root key at A=440 (sustain window
    0.15-2.15 s), or None if unreliable. Cached in cache/audio/tuning.json."""
    import json
    global _tuning
    fn = os.path.join(CACHE, "tuning.json")
    if _tuning is None:
        _tuning = json.load(open(fn)) if os.path.exists(fn) else {}
    k = f"v5|{inst.name}|{z.idx}|{z.key}|{z.start}"
    if k not in _tuning:
        x = np.asarray(zone_audio(inst, z)).mean(axis=1)
        rate = inst.samples[z.sample].rate or 44100
        a = int(min(0.15 * rate, len(x) * 0.25))
        seg = x[a:a + int(2.0 * rate)]
        val = None
        if len(seg) > 4096:
            c = pitch_cents(seg, 440.0 * 2 ** ((z.key - 69) / 12), rate)
            val = c if c is not None and abs(c) < 35 else None
        _tuning[k] = val
        os.makedirs(CACHE, exist_ok=True)
        json.dump(_tuning, open(fn, "w"), indent=0)
    return _tuning[k]


# ----------------------------------------------------------------------------------------------- resampling
_KTAPS = 16
_KPHASES = 1024
_ktables = {}


def _kernel(cut):
    """Polyphase windowed-sinc table (phases, taps) with normalised cutoff `cut` (1 = Nyquist)."""
    key = round(cut, 3)
    if key not in _ktables:
        half = _KTAPS // 2
        fr = np.arange(_KPHASES)[:, None] / _KPHASES
        t = np.arange(-half + 1, half + 1)[None, :] - fr          # tap offsets relative to the read position
        w = np.kaiser(2 * 4096 + 1, 7.0)
        wi = np.clip(((t / half) * 4096 + 4096).round().astype(int), 0, 2 * 4096)
        k = key * np.sinc(key * t) * w[wi]
        k /= k.sum(axis=1, keepdims=True)
        _ktables[key] = k.astype(np.float32)
    return _ktables[key]


def resample_read(x, pos0, step, n, loop=None):
    """Read n output frames from x (m, 2) starting at fractional position pos0, advancing `step` source frames
    per output frame (scalar, or per-frame array for pitch bends). Loops [ls, le) are unrolled. Windowed-sinc
    interpolation (16 taps), anti-aliased when step > 1."""
    if np.ndim(step) == 0:
        pos = pos0 + float(step) * np.arange(n, dtype=np.float64)
        smax = float(step)
    else:
        st = np.asarray(step, np.float64)[:n]
        pos = pos0 + np.concatenate([[0.0], np.cumsum(st[:-1])])
        smax = float(st.max())
    m = len(x)
    end_pos = (pos[-1] if n else pos0) + _KTAPS
    if loop is not None and end_pos > loop[1]:
        ls, le = loop
        reps = int(math.ceil((end_pos - le) / max(1, le - ls))) + 1
        x = np.concatenate([np.asarray(x[:le])] + [np.asarray(x[ls:le])] * reps)
        m = len(x)
    else:
        last = int(min(m, end_pos + 2))
        x = np.asarray(x[:last])
        m = len(x)
    half = _KTAPS // 2
    xp = np.zeros((m + _KTAPS + 2, 2), np.float32)
    xp[half:half + m] = x
    valid = pos < m - 1
    nv = int(valid.sum())
    out = np.zeros((n, 2), np.float32)
    if nv == 0:
        return out
    pos = pos[:nv]
    i = np.floor(pos).astype(np.int64)
    ph = ((pos - i) * _KPHASES).astype(np.int64)
    K = _kernel(min(1.0, 0.97 / smax) if smax > 1 else 1.0)[ph]          # (nv, taps)
    acc = np.zeros((nv, 2), np.float32)
    for k in range(_KTAPS):
        acc += xp[i + k + 1] * K[:, k:k + 1]                # tap k <-> source index i - half + 1 + k
    out[:nv] = acc
    return out


# ----------------------------------------------------------------------------------------------- instruments
def layer_tag(group_name):
    """'STRINGS SUS mf' -> 'mf', 'HO-L_oV_nA_sus_f' -> 'f', 'FL1_stac_mp' -> 'mp'."""
    return re.split(r"[_ ]", group_name.strip())[-1]


def db(x):
    return 10.0 ** (x / 20.0)


def pan_gains(p):
    """Equal-power pan, p in [-1, 1]."""
    a = (p + 1) * math.pi / 4
    return math.cos(a) * math.sqrt(2), math.sin(a) * math.sqrt(2)


class Sampled:
    """A playable instrument built from an EXS file.

    release: seconds of release fade after note-off (damper / bow lift)
    vel_db:  dB range of velocity scaling inside a layer (vel 127 = 0 dB, vel 1 = -vel_db)
    attack:  seconds of fade-in (0 = keep the recorded attack); offset: seconds skipped at the sample start
    groups:  optional predicate on Group to restrict the zone set
    """

    def __init__(self, key, release=0.3, vel_db=18.0, attack=0.0, offset=0.0, gain_db=0.0, groups=None,
                 pedal_groups=False, undamped_from=128, max_len=None, tune=0.0, autotune=True):
        self.key = key
        self.tune = tune
        self.autotune = autotune
        self.exs = parse_exs(EXS[key])
        self.release = release
        self.vel_db = vel_db
        self.attack = attack
        self.offset = offset
        self.gain = db(gain_db)
        self.groups = groups
        self.pedal_groups = pedal_groups
        self.undamped_from = undamped_from
        self.max_len = max_len

    def _group_ok(self, g, pedal):
        if g is None:
            return True
        if "NOTE OFF" in g.name or "Dummy" in g.name:
            return False
        if self.groups and not self.groups(g):
            return False
        if g.cc == 64:
            want_down = g.cc_lo >= 64
            return want_down == (pedal and self.pedal_groups)
        return True

    def pick(self, note, vel, pedal=False, layer=None):
        """Zone for (note, vel). layer: substring of a group name selecting a dynamic layer explicitly
        (velocity then only scales the gain); otherwise zone and group velocity ranges select the layer."""
        best = None
        for z in self.exs.zones:
            g = self.exs.groups[z.group] if 0 <= z.group < len(self.exs.groups) else None
            if not self._group_ok(g, pedal):
                continue
            if layer is not None:
                if g is None or layer_tag(g.name) != layer:
                    continue
            else:
                full = (z.vlo, z.vhi) == (0, 127)
                if not (z.vlo <= vel <= z.vhi):
                    continue
                if g is not None and full and not (g.vlo <= vel <= g.vhi):
                    continue
            d = abs(z.key - note) + (0 if z.klo <= note <= z.khi else 100)
            if best is None or d < best[0]:
                best = (d, z, g)
        if best is None:
            raise ValueError(f"{self.key}: no zone for note {note} vel {vel} layer {layer}")
        return best[1], best[2]

    def render(self, note, vel, dur, pedal_end=None, pan=0.0, offset=None, attack=None, release=None,
               detune=0.0, env=None, layer=None, bend=None, pedal_down=None):
        """Render one note -> float32 (n, 2) at SR.
        dur: seconds the key is held; pedal_end: time (rel. to onset) the sustain pedal lifts (None = no pedal);
        env: optional callable t(seconds array) -> gain multiplier (dynamics automation);
        layer: dynamic-layer tag (e.g. 'mf', 'f'); bend: callable t -> semitones (glissandi)."""
        vel = int(max(1, min(127, round(vel))))
        if pedal_down is None:
            pedal_down = pedal_end is not None
        z, g = self.pick(note, vel, pedal=pedal_down, layer=layer)
        x = zone_audio(self.exs, z)
        rate = self.exs.samples[z.sample].rate or 44100
        fine = z.fine
        if self.autotune:
            dc = zone_detune_cents(self.exs, z)
            fine = -dc if dc is not None else z.fine
        semis = note - z.key + (fine + self.tune + detune) / 100.0
        step = 2.0 ** (semis / 12.0) * rate / SR
        rel = self.release if release is None else release
        if note >= self.undamped_from:
            rel = max(rel, 1.5)
        off_t = self.offset if offset is None else offset
        sound_end = dur
        if pedal_end is not None:
            sound_end = max(dur, pedal_end)
        total = sound_end + rel
        if self.max_len:
            total = min(total, self.max_len)
        loop = zone_loop(z)
        n_avail = (len(x) - 2) / step if loop is None else 1e12
        n = int(min(total * SR, n_avail - off_t * rate / step))
        if n <= 0:
            return np.zeros((1, 2), np.float32)
        t = np.arange(n) / SR
        if bend is not None:          # pitch bend in semitones over note time
            step = step * 2.0 ** (np.asarray(bend(t), np.float64) / 12.0)
            if loop is None:
                lim = len(x) - 2 - off_t * rate
                n = int(min(n, np.searchsorted(np.cumsum(step), lim)))
                step, t = step[:n], t[:n]
        y = resample_read(x, off_t * rate, step, n, loop)
        e = np.ones(n, np.float32)
        att = self.attack if attack is None else attack
        att = max(att, 0.0015 if off_t > 0 else 0.0)
        if att > 0:
            e *= np.clip(t / att, 0, 1) ** (1.0 if att < 0.02 else 1.6)
        r0 = int(sound_end * SR)
        if r0 < n:
            u = (t[r0:] - sound_end) / max(rel, 1e-3)
            e[r0:] *= np.clip(np.exp(-5.0 * u) - np.exp(-5.0) * u, 0, 1)
        if env is not None:
            e *= env(t).astype(np.float32)
        tail = min(n, int(0.004 * SR))
        e[n - tail:] *= np.linspace(1, 0, tail)
        gain = self.gain * db(z.vol + (g.vol if g else 0)) * db(-self.vel_db * (1 - vel / 127.0) ** 1.4)
        zp = (z.pan + (g.pan if g else 0)) / 64.0
        gl, gr = pan_gains(max(-1.0, min(1.0, pan + zp * 0.5)))
        y *= e[:, None] * gain
        y[:, 0] *= gl
        y[:, 1] *= gr
        return y


_registry = {}


def instrument(key):
    """Shared, lazily-built instrument presets."""
    if key not in _registry:
        presets = {
            # Steinway: 5 velocity layers x 4 string groups (+ pedal-down resonance groups used under pedal)
            # A=442 concert tuning in the recording -> -8 cents, keep its natural stretch (no per-zone autotune)
            "piano": dict(release=0.22, vel_db=14.0, pedal_groups=True, undamped_from=89, tune=-8.0, autotune=False),
            "strings": dict(release=0.55, vel_db=10.0, attack=0.0),
            "flute": dict(release=0.25, vel_db=9.0),
            "flute_stac": dict(release=0.12, vel_db=9.0),
            "clarinet": dict(release=0.25, vel_db=9.0),
            "clarinet_stac": dict(release=0.1, vel_db=9.0),
            "horn": dict(release=0.35, vel_db=10.0),
            "horns": dict(release=0.4, vel_db=10.0),
            "trombones": dict(release=0.35, vel_db=10.0),
            "tuba": dict(release=0.35, vel_db=10.0),
            "bass": dict(release=0.12, vel_db=14.0),
            "horns_stac": dict(release=0.15, vel_db=10.0),
            "trombones_stac": dict(release=0.15, vel_db=10.0),
        }
        _registry[key] = Sampled(key, **presets[key])
    return _registry[key]


# ----------------------------------------------------------------------------------------------- note lists
@dataclass
class Note:
    t: float            # onset (s, absolute)
    pitch: int          # MIDI (60 = middle C)
    dur: float          # held (s)
    vel: float = 80
    pan: float = 0.0
    kw: dict = field(default_factory=dict)


def humanize(notes, seed, t_ms=7.0, vel=4.0, keep_first=False):
    """Deterministic small timing/velocity jitter (no rubato): Gaussian, clipped."""
    rng = np.random.default_rng(seed)
    out = []
    for i, n in enumerate(notes):
        dt = 0.0 if (keep_first and i == 0) else float(np.clip(rng.normal(0, t_ms / 1000), -2.5 * t_ms / 1000, 2.5 * t_ms / 1000))
        dv = float(np.clip(rng.normal(0, vel), -2.5 * vel, 2.5 * vel)) if vel > 0 else 0.0
        out.append(Note(max(0.0, n.t + dt), n.pitch, n.dur, max(1, min(127, n.vel + dv)), n.pan, dict(n.kw)))
    return out


def render_notes(inst, notes, length_s, pedal=None):
    """Mix a note list into a stereo buffer. pedal: list of (down, up) absolute times (piano sustain pedal).
    Dampers fall when both the key and the pedal are up: a key released while the pedal is down rings on until
    that pedal lifts. Notes struck with the pedal down use the instrument's pedal-down (resonance) samples."""
    buf = np.zeros((int(round(length_s * SR)) + SR, 2), np.float32)
    pedal = pedal or []
    for n in notes:
        key_up = n.t + n.dur
        pe = None
        for (a, b) in pedal:
            if a <= key_up < b:
                pe = b - n.t
                break
        down = any(a <= n.t < b for (a, b) in pedal)
        y = inst.render(n.pitch, n.vel, n.dur, pedal_end=pe, pan=n.pan, pedal_down=down, **n.kw)
        i0 = int(round(n.t * SR))
        i1 = min(len(buf), i0 + len(y))
        if i1 > i0:
            buf[i0:i1] += y[:i1 - i0]
    return buf[:int(round(length_s * SR))]


NOTE_NAMES = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}


def m(name):
    """'C4' -> 60, 'F#3' -> 54, 'Bb2' -> 46 (scientific pitch, C4 = middle C)."""
    mm = re.fullmatch(r"([A-G])([#b]?)(-?\d)", name)
    k = NOTE_NAMES[mm.group(1)] + {"#": 1, "b": -1, "": 0}[mm.group(2)]
    return 12 * (int(mm.group(3)) + 1) + k


# ----------------------------------------------------------------------------------------------- validation
def validate(instruments=("piano", "strings", "flute", "clarinet", "horn", "tuba", "bass"), verbose=True):
    """Render a C major scale on each instrument (one buffer; piano/bass notes 0.6 s apart, sustained sections 2 s)
    and check every note's pitch with an FFT. Returns the worst absolute error in cents."""
    scale = {"piano": 60, "strings": 60, "flute": 72, "clarinet": 60, "horn": 53, "tuba": 36, "bass": 36}
    steps = [0, 2, 4, 5, 7, 9, 11, 12]
    worst = 0.0
    for key in instruments:
        inst = instrument(key)
        layer = "mf" if key in ("strings", "horn") else None
        dt = 0.6 if key in ("piano", "bass") else 2.0          # sustained sections: judge the held pitch
        notes = [Note(i * dt, scale[key] + s, dt - 0.05, 90, 0.0, dict(layer=layer) if layer else {})
                 for i, s in enumerate(steps)]
        buf = render_notes(inst, notes, len(steps) * dt + 1.0)
        errs = []
        for i, s in enumerate(steps):
            n = scale[key] + s
            f_exp = 440.0 * 2 ** ((n - 69) / 12)
            seg = buf[int((i * dt + 0.12) * SR):int(((i + 1) * dt - 0.05) * SR)].mean(axis=1)
            errs.append(pitch_cents(seg, f_exp, SR))
        worst = max(worst, max(abs(e) for e in errs))
        if verbose:
            print(f"  {key:9s} C major scale from MIDI {scale[key]}: cents " + " ".join(f"{e:+5.1f}" for e in errs))
    return worst


if __name__ == "__main__":
    print("EXS parse:", {k: (len(parse_exs(p).zones), len(parse_exs(p).groups)) for k, p in EXS.items()})
    w = validate()
    print(f"worst pitch error {w:.1f} cents (piano keeps its natural stretch tuning)")
