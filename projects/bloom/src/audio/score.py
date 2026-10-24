"""BLOOM: original score for the 58.75 s short (96 BPM, 4/4), written as data and rendered at 48 kHz stereo to
out/audio/score.wav. Every sync point comes from cues.SYNC (read from the shot files), so the score follows re-timed
picture.

THE "BLOOM" THEME (original): a pentatonic, singable tune that climbs like a stem and curls back like a leaf.
    scale degrees   5 | 1 . . 2 3 | 6 . . 5 3 . 2 . | 1
    rhythm          8th | dotted-quarter 8th 8th | dotted-quarter 8th quarter quarter | half
    in D            A | D . . E F# | B . . A F# . E . | D        (B04: the seed; celesta + flute)
    in E            B | E . . F# G# | C# . . B G# . F# . | E     (B18: the bloom; horns, trumpets, strings, choir)
  cells: the SEED CALL (5 -> 1, a rising fourth: the two pulses under the ash), the STEM (2 3, rising), the CURL (the
  peak, the 6th, then falling back). THE PEAK NOTE IS ALWAYS A TOUCH: the leaf curling round the finger (B04 T_CURL),
  the leaf touching the cheek (B15 T_TOUCH, celesta), the sapling's hug (B19 T_LEAN, strings), the leaf's pat (B20).
  The cadence (2 -> 1) is withheld: the thunder cuts the B04 statement on its 3rd, the broken minor version in B14
  (A D . E F) never reaches the peak, and the theme only completes at the bloom (T_WAVE_END), in E major, a step
  above where it was first heard.
  The DRIVE turns the head (5 1 2 3) into a minor battle-cry that climbs a fourth per bar (A-D-E-F | D-G-A-Bb |
  E-A-Bb-C#) over a 3+3+2 string ostinato anchored on T_GO.
Harmony: ash D minor -> hope D major -> storm D minor / A7(b9) -> silence -> D major -> G-A-B (the beam: B major, the
dominant of E) -> E major (the bloom, the coda).
"""
import math
import os
import sys
from collections import defaultdict

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
sys.path.insert(0, os.path.dirname(HERE))

import dsp  # noqa: E402
import sampler as SM  # noqa: E402
import synth as SY  # noqa: E402
from cues import SYNC, DURATION, MUSIC_CUTS, start, end, go, set_, beat_of, BEAT  # noqa: E402

SR = dsp.SR
OUT = os.path.join(SM.PROJECT, "out", "audio")
m = SM.m

# (theme beat, semitones above the tonic, length in beats)
THEME = [(0.0, -5, 0.5), (0.5, 0, 1.5), (2.0, 2, 0.5), (2.5, 4, 0.5), (3.0, 9, 1.5), (4.5, 7, 0.5), (5.0, 4, 1.0),
         (6.0, 2, 1.0), (7.0, 0, 2.0)]
PEAK = 3.0


def theme(tonic, minor=False, b0=-1.0, b1=99.0):
    """Theme notes [(beat, midi, beats)] with beat in [b0, b1); minor: the 3rd and 6th flattened."""
    tonic = m(tonic) if isinstance(tonic, str) else tonic
    out = []
    for (b, s, d) in THEME:
        if b0 <= b < b1:
            if minor:
                s = {4: 3, 9: 8}.get(s, s)
            out.append((b, tonic + s, d))
    return out


class Warp:
    """Theme beats -> absolute seconds: piecewise linear through [(beat, t), ...], linearly extrapolated."""

    def __init__(self, pts):
        pts = sorted(pts)
        if len(pts) == 1:
            pts = [pts[0], (pts[0][0] + 1.0, pts[0][1] + BEAT)]
        self.x = np.array([p[0] for p in pts], float)
        self.y = np.array([p[1] for p in pts], float)

    def __call__(self, b):
        x, y = self.x, self.y
        if b <= x[0]:
            return float(y[0] + (b - x[0]) * (y[1] - y[0]) / (x[1] - x[0]))
        if b >= x[-1]:
            return float(y[-1] + (b - x[-1]) * (y[-1] - y[-2]) / (x[-1] - x[-2]))
        return float(np.interp(b, x, y))


def smooth(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


def dyn_fn(dyn):
    """Dynamics: constant d or [(t_abs, d), ...] -> f(t_abs array)."""
    if np.isscalar(dyn):
        return lambda t: np.full(np.shape(t), float(dyn))
    xs = np.array([p[0] for p in dyn], float)
    ys = np.array([p[1] for p in dyn], float)
    o = np.argsort(xs, kind="stable")
    xs, ys = xs[o], ys[o]
    return lambda t: np.interp(t, xs, ys)


def amp_of(d):
    """Dynamic level d in [0, 1] (0 ~ ppp, 0.5 ~ mf, 1 ~ ff) -> linear gain."""
    return 10 ** (-30.0 * (1 - np.asarray(d)) / 20)


def ramp(T, a, b, power=1.0):
    """Note-relative gain envelope a -> b over T seconds (then held)."""
    return lambda tt: a + (b - a) * np.clip(np.asarray(tt) / max(T, 1e-3), 0, 1) ** power


def boost(gain_db):
    """Constant note gain (dB) as an env (sampled notes may be pushed above their velocity's level)."""
    g = 10 ** (gain_db / 20)
    return lambda tt: np.full(np.shape(tt), g)


def swell_env(T_up, T_down, a=0.3, peak=1.0, b=0.4):
    return lambda tt: np.interp(np.asarray(tt), [0, T_up, T_up + T_down], [a, peak, b])


class Score:
    def __init__(self):
        self.notes = defaultdict(list)       # sampled tracks
        self.events = defaultdict(list)      # synth tracks: (t, fn, kwargs)
        self.pedal = defaultdict(list)       # per-track sustain pedal (down, up)

    # ------------------------------------------------------------------ primitives
    def n(self, track, t, pitch, dur, vel=64, pan=0.0, **kw):
        p = m(pitch) if isinstance(pitch, str) else int(pitch)
        self.notes[track].append(SM.Note(float(t), p, float(dur), float(max(1, min(127, vel))), pan, kw))

    def chord(self, track, t, pitches, dur, vel=64, spread=0.0, **kw):
        for i, p in enumerate(pitches.split() if isinstance(pitches, str) else pitches):
            self.n(track, t + i * spread, p, dur, vel, **kw)

    def ev(self, track, t, fn, **kw):
        self.events[track].append((float(t), fn, kw))

    def ped(self, track, t0, t1):
        self.pedal[track].append((t0 + 0.04, t1 + 0.01))

    # ------------------------------------------------------------------ strings with dynamics
    def strings(self, t0, t1, pitches, dyn, trem=False, offset=None, attack=None, release=None, bend=None, pan=0.0,
                seed=0, track="strings"):
        """Sustained string notes [t0, t1) with a dynamic curve; crossfades the mf and f sample layers."""
        f = dyn_fn(dyn)
        dmax = float(np.max(f(np.linspace(t0, t1, 64))))
        for k, p in enumerate(pitches.split() if isinstance(pitches, str) else pitches):
            pm = m(p) if isinstance(p, str) else int(p)
            rate = 13.0 + 1.7 * ((seed + k) % 3)

            def env_for(layer, _t0=t0, _rate=rate, _k=k):
                def e(tt):
                    d = f(_t0 + tt)
                    wf = smooth((d - 0.45) / 0.4)
                    w = wf * 10 ** (1.5 / 20) if layer == "f" else (1 - wf)
                    g = amp_of(d) * w
                    if trem:      # bowed tremolo: irregular ~13-16 Hz re-articulation
                        ph = 2 * np.pi * (_rate * tt + 0.35 * np.sin(2 * np.pi * 0.7 * tt + _k)) + _k
                        g = g * (1 - 0.4 * (0.5 + 0.5 * np.sin(ph)) ** 1.5)
                    return g
                return e
            kw = dict(layer="mf", env=env_for("mf"))
            for key, val in (("offset", offset), ("attack", attack), ("release", release), ("bend", bend)):
                if val is not None:
                    kw[key] = val
            self.notes[track].append(SM.Note(t0, pm, t1 - t0, 127, pan, kw))
            if dmax > 0.45:
                self.notes[track].append(SM.Note(t0, pm, t1 - t0, 127, pan, dict(kw, layer="f", env=env_for("f"))))

    def spic(self, t, pitch, d, length=0.13):
        """One short (spiccato-like) bow from the sustain samples at dynamic d."""
        self.strings(t, t + length, [pitch], d, offset=0.075, attack=0.004, release=0.07, track="ost")

    def sline(self, notes, warp, dyn, octave=0, release=0.35, until=None):
        """A legato string melody (later notes skip the bow attack and cross-fade)."""
        for i, (b, p, d) in enumerate(notes):
            ts = warp(b)
            te = warp(b + d) + 0.09
            if until is not None:
                te = min(te, until)
            leg = i > 0 and abs(notes[i - 1][0] + notes[i - 1][2] - b) < 1e-6
            self.strings(ts, te, [p + 12 * octave], dyn, offset=0.09 if leg else None, attack=0.07 if leg else None,
                         release=release)

    def line(self, track, notes, warp, vel, octave=0, legato=True, hold=1.0, until=None, **kw):
        """A melody on a sampled instrument: long notes leaned on, 8ths lighter."""
        for i, (b, p, d) in enumerate(notes):
            t = warp(b)
            dur = (warp(b + d) - t) * hold + (0.06 if legato else 0.0)
            if until is not None:
                dur = min(dur, until - t)
            v = (vel(b) if callable(vel) else vel) + (4 if d >= 1.5 else (-5 if d <= 0.5 else 0))
            extra = dict(kw)
            if legato and i > 0 and abs(notes[i - 1][0] + notes[i - 1][2] - b) < 1e-6:
                extra.update(offset=0.07, attack=0.05)
            if dur > 0.02:
                self.n(track, t, p + 12 * octave, dur, v, **extra)

    def bells(self, track, notes, warp, vel, octave=0, fn=None, **kw):
        """A melody on a synth bell (celesta, glock, music box)."""
        for (b, p, d) in notes:
            v = (vel(b) if callable(vel) else vel) + (5 if b == PEAK else 0)
            self.ev(track, warp(b), fn or track, m=p + 12 * octave, vel=v, **kw)


# ======================================================================================================== helpers
def harp_gliss(S, t0, t1, names, v0=40, v1=60):
    ps = names.split() if isinstance(names, str) else names
    for j, p in enumerate(ps):
        u = j / max(1, len(ps) - 1)
        S.ev("harp", t0 + u * (t1 - t0), "pluck", m=m(p) if isinstance(p, str) else p, vel=v0 + (v1 - v0) * u,
             kind="harp", seed=j)


def cascade(S, t0, names, vel=50, step=0.09, track="celesta", fn=None, octave=0):
    for i, p in enumerate(names.split()):
        S.ev(track, t0 + i * step, fn or track, m=m(p) + 12 * octave, vel=vel - 1.5 * i)


def roll(S, t0, t1, pitch, v0, v1, rate=15.0, track="timpani"):
    """Timpani roll (single strokes at ~rate Hz with crescendo v0 -> v1)."""
    n = max(1, int((t1 - t0) * rate))
    r = np.random.default_rng(int(t0 * 100))
    for i in range(n):
        u = i / max(1, n - 1)
        S.ev(track, t0 + i / rate + r.normal(0, 0.005), "timpani", m=m(pitch),
             vel=float(np.clip(v0 + (v1 - v0) * u ** 1.5 + r.normal(0, 3), 1, 127)), seed=i)


def snare_roll(S, t0, t1, v0, v1, rate=17.0):
    n = max(1, int((t1 - t0) * rate))
    r = np.random.default_rng(int(t0 * 1000) + 7)
    for i in range(n):
        u = i / max(1, n - 1)
        S.n("snare", t0 + i / rate + r.normal(0, 0.004), 38, 0.6, float(v0 + (v1 - v0) * u ** 1.3 + r.normal(0, 3)))


def taiko(S, t, vel=100, size=1.0, kit=True):
    """A big drum: synth taiko membrane + the kit's floor tom pitched down (a real stick attack)."""
    S.ev("taiko", t, "tom", f0=62.0 / size, vel=vel, decay=1.0 * size, drop=1.28, seed=int(t * 997) % 9973)
    if kit:
        S.n("toms", t, 43, 2.0, vel * 0.95, detune=-450.0 - 250.0 * (size - 1.0))


def tom(S, t, which, vel):
    """Kit toms tuned down (bigger, 'concert' toms): which 0 = floor, 1 = mid, 2 = high."""
    key, det = ((43, -300.0), (47, -350.0), (48, -300.0))[which]
    S.n("toms", t, key, 1.5, vel, detune=det)


def crash(S, t, vel=110, both=True):
    S.n("crash", t, 49, 6.0, vel)
    if both:
        S.n("crash", t + 0.012, 57, 6.0, vel - 8)


def stab(S, t, low, high, vel=110, trumpets=None):
    """Short brass hit: trombones (low) + horns (high) [+ trumpets]."""
    for p in low.split():
        S.n("trombones_stac", t, p, 0.4, vel, layer="ff" if vel > 100 else "mf")
    for p in high.split():
        S.n("horns_stac", t, p, 0.4, vel, layer="f" if vel > 90 else "mf")
    if trumpets:
        for p in trumpets.split():
            S.n("trumpets_stac", t, p, 0.35, vel - 4, layer="f" if vel > 95 else "mf")


# ======================================================================================================== THE SCORE
def compose():
    S = Score()
    ash(S)
    hope(S)
    threat(S)
    drive(S)
    low_point(S)
    the_beam(S)
    the_bloom(S)
    coda(S)
    return S


# ------------------------------------------------------------------------------------------------- B01-B03
def ash(S):
    """I. Ash: near silence. One low felt-piano note tolls under the wind; cold string harmonics; grief: a solo
    clarinet sighs (Bb -> A lands on T_SIGH); the seed's call (A -> D, the theme's first two notes) answers the two
    green pulses; on T_NOTICE the first major third (F#) blooms."""
    b2, b3, sigh = start("B02"), start("B03"), SYNC["sigh"]
    # B01: the toll
    S.n("felt", 0.35, "D1", 6.0, 54)
    S.n("felt", 0.37, "D2", 6.0, 44)
    S.ped("felt", 0.3, b2 - 0.05)
    S.ev("harmonic", 1.3, "harmonic", m=m("A5"), dur=3.5, vel=26, attack=1.4, release=1.4, seed=1)
    S.ev("harmonic", 2.5, "harmonic", m=m("E6"), dur=2.4, vel=19, attack=1.1, release=1.2, seed=2)
    S.strings(0.6, b2 + 0.5, "D2 A2", [(0.6, 0.0), (2.2, 0.11), (4.6, 0.12), (b2 + 0.5, 0.0)])
    # B02: grief: felt piano Dm, the clarinet's sigh
    for p, v in (("D2", 44), ("A2", 36), ("F3", 33)):
        S.n("felt", b2 + 0.03, p, sigh - b2 - 0.7, v)
    S.ped("felt", b2 + 0.02, sigh - 0.72)
    S.strings(b2, sigh - 0.6, "D3 A3 F4", [(b2, 0.0), (b2 + 0.7, 0.15), (sigh - 0.6, 0.16)])
    S.n("clarinet", b2 + 0.45, "A4", sigh - 0.7 - (b2 + 0.45) + 0.06, 60, env=swell_env(0.8, 0.8, 0.5, 1.0, 0.8))
    S.n("clarinet", sigh - 0.7, "Bb4", 0.76, 66, offset=0.07, attack=0.06)
    S.n("clarinet", sigh, "A4", 1.15, 56, offset=0.07, attack=0.06, env=ramp(1.15, 1.0, 0.25, 1.4))
    for p, v in (("G2", 40), ("Bb2", 34), ("D3", 30)):
        S.n("felt", sigh - 0.7, p, 0.7, v)
    S.strings(sigh - 0.7, sigh + 0.1, "G3 Bb3 D4", [(sigh - 0.7, 0.16), (sigh, 0.18)])
    S.ped("felt", sigh - 0.68, sigh - 0.02)
    for p, v in (("D2", 42), ("A2", 34), ("F3", 32)):
        S.n("felt", sigh, p, b3 - sigh + 0.3, v)
    S.strings(sigh, b3 + 0.6, "D3 A3 F4", [(sigh, 0.18), (sigh + 0.6, 0.13), (b3 + 0.6, 0.0)])
    S.ped("felt", sigh + 0.02, b3 + 0.6)
    # B03: the seed's call: two celesta notes on the two pulses (the theme's first two notes), a crotale breath
    pulses, notice = SYNC["pulse"], SYNC["notice"]
    S.n("felt", b3 + 0.05, "D1", 2.5, 40)
    for t, p, v in zip(pulses, ("A5", "D6"), (46, 52)):
        S.ev("celesta", t, "celesta", m=m(p), vel=v)
        S.ev("crotale", t, "crotale_bow", m=m(p) + 12, dur=0.35, vel=v - 22, attack=0.05, release=1.0)
    # T_NOTICE: the eyes widen: D minor turns to D MAJOR (the first warm colour)
    S.strings(notice - 0.1, start("B04") + 0.4, "D3 A3 F#4", [(notice - 0.1, 0.0), (notice + 0.7, 0.2),
                                                             (start("B04") + 0.4, 0.22)])
    S.ev("harmonic", notice, "harmonic", m=m("F#6"), dur=start("B04") - notice + 0.3, vel=30, attack=0.4,
         release=1.2, seed=3)
    S.ev("celesta", notice + 0.04, "celesta", m=m("F#6"), vel=38)
    S.ev("glock", notice + 0.04, "glock", m=m("F#7"), vel=24)


# ------------------------------------------------------------------------------------------------- B04
def hope(S):
    """The seed: the Bloom theme enters on celesta (flute an octave below, warm strings, harp), unfurling from the
    crack and peaking (the 6th, over IV) exactly on the leaf curling round Claude's finger. The thunder cuts it on its
    3rd: the cadence is withheld until the bloom."""
    b4, crack, curl, th = start("B04"), SYNC["crack"], SYNC["curl"], SYNC["thunder"]
    W = Warp([(0.0, crack), (PEAK, curl)])
    # brushing the ash away: a warm D major pad, a harp roll
    S.strings(b4, crack + 0.1, "D2 A2 D3 F#3 A3", [(b4, 0.2), (crack, 0.27)])
    harp_gliss(S, b4 + 0.05, b4 + 0.9, "D3 A3 D4 F#4 A4 D5", 30, 42)
    S.n("felt", b4 + 0.05, "D2", crack - b4, 34)
    S.ped("felt", b4 + 0.03, crack - 0.02)
    # the theme
    mel = theme("D6", b1=6.0)
    S.bells("celesta", mel, W, lambda b: 70 + 6 * min(b, PEAK) / PEAK)
    S.line("flute", theme("D5", b1=6.0), W, lambda b: 52 + 6 * min(b, PEAK) / PEAK, until=th)
    S.ev("glock", W(PEAK), "glock", m=m("B7"), vel=40)
    S.ev("crotale", W(PEAK), "crotale_bow", m=m("B6"), dur=0.6, vel=40, attack=0.04, release=1.4)
    S.ev("glock", W(0.5), "glock", m=m("D7"), vel=26)
    # harmony: D | A/C# | G (the peak: the 6th over IV) | D/F# ... (cut by the thunder)
    dyn = [(crack, 0.24), (W(2.0), 0.32), (curl, 0.48), (W(4.5), 0.42), (th, 0.38)]
    S.strings(crack, W(2.0) + 0.15, "D2 D3 A3 F#4", dyn)
    S.strings(W(2.0), curl + 0.15, "C#3 E3 A3 E4", dyn, offset=0.08, attack=0.08)
    S.strings(curl, W(5.0) + 0.15, "G2 D3 G3 B3 D4", dyn, offset=0.06, attack=0.1)
    S.strings(W(5.0), th + 0.3, "F#2 D3 A3 F#4 A4", dyn, offset=0.08, attack=0.1)
    for t, ps in ((crack, "D2"), (W(2.0), "C#2"), (curl, "G1 G2"), (W(5.0), "F#2")):
        for p in ps.split():
            S.n("felt", t, p, 1.6, 36)
    S.ped("felt", crack, W(2.0) - 0.02)
    S.ped("felt", W(2.0), curl - 0.02)
    S.ped("felt", curl, W(5.0) - 0.02)
    S.ped("felt", W(5.0), th)
    harp_gliss(S, crack - 0.02, crack + 0.4, "D3 A3 D4 F#4 A4", 34, 46)
    harp_gliss(S, curl - 0.12, curl + 0.38, "G2 D3 G3 B3 D4 G4 B4 D5", 40, 58)     # the curl
    S.ev("harmonic", curl, "harmonic", m=m("B6"), dur=th - curl, vel=26, attack=0.3, release=0.8, seed=4)


# ------------------------------------------------------------------------------------------------- B05-B07
def threat(S):
    """The storm: low brass and a semitone cluster swell from the thunder to the flash (stab); the hope note F# sinks
    to F as the sprout shivers; a low pulse on the drive's grid, the last gold on the peak a fragile high A; back on
    Claude a crescendo to T_RESOLVE, where the horns cry the theme's head (A -> D) defiantly into the launch."""
    th, fl, sh, back, res, g0 = (SYNC[k] for k in ("thunder", "flash", "shiver", "back", "resolve", "go"))
    S.n("tuba", th, "D2", fl - th + 0.5, 100, env=ramp(fl - th, 0.3, 1.0, 1.5))
    S.n("trombones", th + 0.04, "A2", fl - th + 0.45, 96, layer="mf", env=ramp(fl - th, 0.25, 1.0, 1.5))
    S.n("trombones", th + 0.07, "Eb3", fl - th + 0.4, 92, layer="mf", env=ramp(fl - th, 0.2, 1.0, 1.6))
    S.strings(th, fl + 0.3, "D1 D2 Eb2 A2", [(th, 0.3), (fl, 0.7), (fl + 0.3, 0.5)], trem=True, seed=11)
    S.ev("timpani", th, "timpani", m=m("D2"), vel=96)
    roll(S, th + 0.25, fl - 0.02, "D2", 38, 96)
    S.ev("swell", fl - 0.7, "cymbal_swell", dur=0.7, vel=78, choke=True)
    # the flash: a stab
    stab(S, fl, "D2 A2 Eb3", "Bb3 Eb4 A4", vel=112)
    crash(S, fl, 104)
    S.ev("boom", fl, "boom", vel=96, f_hi=72.0, f_lo=36.0, decay=2.2)
    S.ev("timpani", fl, "timpani", m=m("D2"), vel=110)
    for p in ("D1", "Eb1", "A1"):
        S.n("piano", fl, p, 1.0, 96)
    S.strings(fl, sh + 0.4, "D2 A2 Eb3 D4", [(fl, 0.62), (sh, 0.35), (sh + 0.4, 0.2)], trem=True, seed=12)
    # the shiver: the hope note F# trembles and sinks to F
    t, k = sh, 0
    while t < sh + 0.9:
        u = (t - sh) / 0.9
        S.ev("celesta", t, "celesta", m=m("F#6") - (k % 2), vel=48 - 26 * u)
        t += 0.065
        k += 1
    S.strings(sh, start("B06") + 0.3, ["F#5"], [(sh, 0.24), (start("B06") + 0.3, 0.06)],
              bend=lambda tt: -1.0 * smooth(tt / 0.8), release=0.4)
    S.strings(sh + 0.2, start("B06") + 0.2, "D3 A3 F4", [(sh + 0.2, 0.18), (start("B06") + 0.2, 0.24)])
    # B06: the storm advancing; the last gold on the peak: a fragile high A over a low pulse on the drive grid
    b6 = start("B06")
    S.ev("harmonic", b6 + 0.1, "harmonic", m=m("A6"), dur=back - b6, vel=30, attack=0.5, release=0.6, seed=5)
    S.n("horn", b6 + 0.15, "A4", back - b6, 56, layer="mf", env=swell_env(0.8, back - b6 - 0.8, 0.4, 1.0, 0.6))
    S.strings(b6, res + 0.1, "D2 A2 D3 Eb3", [(b6, 0.3), (back, 0.42), (res, 0.62)], trem=True, seed=13)
    S.n("trombones", b6, "D2", res - b6, 80, layer="mf", env=ramp(res - b6, 0.35, 1.0, 1.5))
    S.n("trombones", b6 + 0.03, "Eb3", res - b6, 76, layer="mf", env=ramp(res - b6, 0.3, 1.0, 1.5))
    k0 = math.ceil(beat_of(b6) + 0.05)
    for k in range(k0, 0):
        tk = go(k)
        S.ev("timpani", tk, "timpani", m=m("D2"), vel=60 + 6 * (k - k0))
        S.spic(tk, "D2", 0.4 + 0.04 * (k - k0))
        S.spic(tk, "D3", 0.36 + 0.04 * (k - k0))
        if tk > back:            # back on Claude: eighths
            S.spic(go(k + 0.5), "D2", 0.45 + 0.04 * (k - k0))
            S.spic(go(k + 0.5), "D3", 0.4 + 0.04 * (k - k0))
    S.ev("swell", back, "cymbal_swell", dur=res - back, vel=84, ring=0.8)
    # T_RESOLVE: the horns' defiant head (A -> D), the orchestra rising into the launch
    S.n("horns", res, "A3", BEAT / 2 + 0.05, 104, layer="f")
    S.n("horns", res + BEAT / 2, "D4", g0 - res - BEAT / 2 + 0.25, 110, layer="f", offset=0.07, attack=0.05,
        env=ramp(g0 - res - BEAT / 2, 0.85, 1.2))
    S.n("horn", res, "A3", BEAT / 2 + 0.05, 100, layer="f")
    S.n("horn", res + BEAT / 2, "D4", g0 - res - BEAT / 2 + 0.25, 106, layer="f", offset=0.07, attack=0.05)
    for p in ("D3", "F3", "A3"):
        S.n("trombones", res, p, g0 - res - 0.04, 92, layer="mf", env=ramp(g0 - res, 0.5, 0.85), release=0.05)
    S.n("tuba", res, "D2", g0 - res - 0.04, 92, env=ramp(g0 - res, 0.5, 0.85), release=0.05)
    S.strings(res, g0 - 0.035, "D2 D3 A3 D4 F4", [(res, 0.5), (g0, 0.72)], trem=True, seed=14, release=0.04)
    S.ev("timpani", res, "timpani", m=m("D2"), vel=100)
    snare_roll(S, res + 0.35, g0 - 0.06, 26, 78)
    for i, k in enumerate((-0.75, -0.5, -0.25)):
        taiko(S, go(k), 70 + 10 * i, size=0.85)
    S.ev("swell", res + 0.2, "cymbal_swell", dur=g0 - res - 0.2, vel=88, choke=True)
    # strings rush upward into the launch
    for j, p in enumerate("D4 E4 F4 G4 A4 Bb4 C5 D5".split()):
        S.spic(g0 - 0.45 + j * 0.055, p, 0.6 + 0.03 * j, length=0.1)


# ------------------------------------------------------------------------------------------------- B07-B13
DRIVE_DYN = None


def drive(S):
    """THE CLIMB. Anchored on T_GO: a 3+3+2 string ostinato (16ths), taiko and toms, rising harmony bar by bar
    (Dm | Bb | [tumble] | Dm/F | Gm-Eb | A7(b9)), the theme's head as a battle-cry climbing a fourth per bar, hits on
    the slip and stop, the bolts and the chips, relentless percussion in the hail, and a dead stop at the B14 cut."""
    g0, slip, stop9, check, up = (SYNC[k] for k in ("go", "slip", "stop9", "check", "up"))
    bslip, bstop, bcheck, bup = beat_of(slip), beat_of(stop9), beat_of(check), beat_of(up)
    bolt1, bolt2, hail, end_b = beat_of(SYNC["bolt11"]), beat_of(SYNC["bolt13"]), beat_of(SYNC["hail"]), \
        beat_of(SYNC["stop14"])
    chips = [beat_of(t) for t in SYNC["chips"]]
    dpts = [(0, 0.68), (4, 0.7), (bslip, 0.72), (12, 0.72), (16, 0.74), (20, 0.77), (end_b, 0.81)]

    def D(b):
        return float(np.interp(b, [p[0] for p in dpts], [p[1] for p in dpts]))

    def dyn_abs(b0, b1, extra=0.0):
        return [(go(b0), D(b0) + extra), (go(b1), D(b1) + extra)]

    # harmony: (b0, b1, bass, ostinato chord tones low->high)
    segs = [(0, 4, "D2", ("D3", "F3", "A3")), (4, bslip, "Bb1", ("Bb2", "D3", "F3")),
            (12, 16, "F2", ("D3", "F3", "A3")), (16, 18, "G1", ("G2", "Bb2", "D3")),
            (18, 20, "Eb2", ("Eb3", "G3", "Bb3")), (20, end_b, "A1", ("A2", "C#3", "E3"))]
    ACC = (0, 3, 6)                  # 3+3+2 accents in each half bar of 16ths
    for (b0, b1, bass, (r, t3, t5)) in segs:
        R, T3, T5 = m(r), m(t3), m(t5)
        bs = m(bass)
        i = 0
        b = b0
        while b < b1 - 1e-6:
            pos = i % 8
            acc = pos in ACC
            d = D(b) + (0.07 if acc else -0.05)
            t = go(b)
            # celli + basses: the repeated root in octaves
            S.spic(t, bs + 12, d)
            S.spic(t, bs, d - 0.04)
            if acc:
                S.ev("pizz", t, "pluck", m=bs + 12, vel=70 + 30 * (D(b) - 0.6), kind="pizz", seed=i)
            # violas from bar 2: broken chord
            if b >= 4:
                up_ = (R + 12, T5, T3 + 12, T5)[i % 4]
                S.spic(t, up_, d - 0.06)
            # violins from the ledge: high broken chord
            if b >= 12:
                hi = (R + 24, T5 + 12, T3 + 24, T5 + 12)[(i + 2) % 4]
                S.spic(t, hi, d - 0.04 if b >= 16 else d - 0.1)
            i += 1
            b += 0.25
        # sustained pads: trombones / tuba / horns
        t0, t1 = go(b0), go(b1)
        low = "%s %s" % (bass, r) if b0 < 12 else "%s %s %s" % (bass, r, t5)
        for j, p in enumerate(low.split()):
            if m(p) >= 40:
                S.n("trombones", t0 + 0.01 * j, p, t1 - t0 + 0.05, 80 + 25 * (D(b0) - 0.6), layer="mf",
                    env=ramp(t1 - t0, 0.75, 1.0))
            else:
                S.n("tuba", t0, p, t1 - t0 + 0.05, 84 + 25 * (D(b0) - 0.6), env=ramp(t1 - t0, 0.8, 1.0))
        if b0 < 12:
            for p in (t3, t5):
                S.n("horns", t0 + 0.02, m(p) + 12, t1 - t0 + 0.05, 52 + 20 * (D(b0) - 0.6), layer="mf",
                    env=ramp(t1 - t0, 0.45, 1.0))
        S.ev("timpani", t0, "timpani", m=bs + 12 if bs + 12 <= m("A2") else bs, vel=86 + 30 * (D(b0) - 0.6))

    # ---- percussion
    def bar_taiko(b0, b1, vel, dense=False):
        b = b0
        while b < b1 - 1e-6:
            off = (b - b0) % 2.0
            for a in (0.0, 0.75, 1.5):
                if abs(off - a) < 1e-6:
                    taiko(S, go(b), vel + (8 if a == 0 else 0), size=1.15 if a == 0 else 1.0)
            if dense and abs(off - 1.75) < 1e-6:
                taiko(S, go(b), vel - 14, size=0.9)
            b += 0.25

    crash(S, g0, 116)
    S.ev("boom", g0, "boom", vel=100, f_hi=70.0, f_lo=38.0, decay=1.8)
    stab(S, g0, "D2 A2 D3", "F4 A4 D5", vel=118, trumpets="D5 F5")
    S.chord("piano", g0, "D1 D2 A2", 0.8, 100)
    bar_taiko(0, 4, 100)
    bar_taiko(4, bslip, 104, dense=True)
    for b in np.arange(5.0, min(6.0, bslip), 0.25):                       # tom fill into the slip
        tom(S, go(b), int((b * 4) % 3), 70 + 10 * (b - 5.0))
    # the SLIP: a diminished stab, the floor falls away
    stab(S, slip, "E2 Bb2", "Db4 G4", vel=116, trumpets="Bb4 E5")
    crash(S, slip, 110, both=False)
    taiko(S, slip, 112, size=1.25)
    S.ev("timpani", slip, "timpani", m=m("E2"), vel=110)
    span = stop9 - slip
    S.strings(slip, stop9, "A4 E5 Bb5", [(slip, 0.7), (stop9, 0.45)], trem=True, seed=21,
              bend=lambda tt, _s=span: -13.0 * (np.asarray(tt) / _s) ** 1.3, release=0.1)
    S.strings(slip, stop9, "E2 Bb2 E3", [(slip, 0.72), (stop9, 0.5)], trem=True, seed=22,
              bend=lambda tt, _s=span: -5.0 * (np.asarray(tt) / _s), release=0.1)
    for p in ("Db4", "G4"):
        S.n("horns", slip + 0.05, p, span * 0.8, 100, layer="f",
            bend=lambda tt, _s=span: -7.0 * (np.asarray(tt) / (_s * 0.8)) ** 1.5, env=ramp(span * 0.8, 1.0, 0.4))
    r = np.random.default_rng(5)
    t, k = slip + 0.12, 0
    while t < stop9 - 0.08:                      # the tumble: toms and low piano clusters rolling downhill
        u = (t - slip) / span
        tom(S, t, 2 - min(2, int(u * 3)), 96 - 20 * u)
        if k % 3 == 1:
            S.chord("piano", t, "C1 Db1 E1 G1", 0.4, 80 - 20 * u, spread=0.012)
        t += 0.09 + 0.12 * u + r.uniform(0, 0.05)
        k += 1
    # the STOP: a thud ... then the low point inside the climb: a pedal, a heartbeat, the sprout's glint
    taiko(S, stop9, 118, size=1.35)
    S.ev("boom", stop9, "boom", vel=104, f_hi=64.0, f_lo=32.0, decay=2.0)
    S.n("tuba", stop9, "D1", 0.5, 110)
    S.n("trombones_stac", stop9, "D2", 0.4, 110, layer="ff")
    S.ev("timpani", stop9, "timpani", m=m("D2"), vel=112)
    S.strings(stop9 + 0.05, go(12) + 0.05, "D1 D2", [(stop9 + 0.05, 0.4), (stop9 + 0.6, 0.22), (up, 0.24),
                                                   (go(12), 0.62)], trem=True, seed=23)
    for k in range(int(math.ceil(bstop + 0.3)), int(math.floor(bup)) + 1):
        taiko(S, go(k), 58, size=1.2, kit=False)
    # grit: the celli pick the pulse back up under the check (eighths), sixteenths from T_UP into the ledge
    b = math.ceil((bstop + 0.6) * 2) / 2
    while b < 12 - 1e-6:
        step = 0.25 if b >= bup else 0.5
        d = float(np.interp(b, [bstop, bup, 12], [0.42, 0.6, 0.72])) + (0.05 if (b % 1) == 0 else -0.03)
        S.spic(go(b), "D3", d)
        S.spic(go(b), "D2", d - 0.05)
        b += step
    S.ev("celesta", check, "celesta", m=m("A6"), vel=52)
    S.ev("celesta", check + BEAT / 2, "celesta", m=m("D7"), vel=56)
    S.ev("glock", check + BEAT / 2, "glock", m=m("D7"), vel=30)
    S.ev("crotale", check, "crotale_bow", m=m("D7"), dur=0.5, vel=36, attack=0.05, release=1.2)
    S.ev("harmonic", check, "harmonic", m=m("A6"), dur=0.9, vel=24, attack=0.2, release=0.8, seed=6)
    # T_UP: push up: snare + timpani rolls, a rising swell into the ledge
    snare_roll(S, up, go(12) - 0.03, 34, 96)
    roll(S, up + 0.05, go(12) - 0.02, "A1", 40, 100)
    S.ev("swell", up, "cymbal_swell", dur=go(12) - up, vel=90, choke=True)
    taiko(S, go(11.5), 96)
    taiko(S, go(11.75), 104)
    # ---- the ledge (B11), the hail (B12), the storm (B13): full drive
    crash(S, go(12), 116)
    bar_taiko(12, 16, 104)
    bar_taiko(16, 20, 108, dense=True)
    bar_taiko(20, end_b, 112, dense=True)
    for b in np.arange(12.0, end_b, 0.25):                               # toms: 16th fills, denser as it climbs
        q = int(round(b * 4)) % 16
        if (b >= 16 or q >= 12) and not (q % 4 == 0):
            tom(S, go(b), (q // 2) % 3, 72 + 18 * (b - 12) / (end_b - 12))
    # the HAIL: relentless snare/tom sixteenths (stones on rock)
    rr = np.random.default_rng(9)
    for b in np.arange(math.ceil(hail * 4) / 4, end_b, 0.25):
        q = int(round(b * 4)) % 8
        v = 66 + 26 * ((b - hail) / (end_b - hail)) + (16 if q in ACC else 0) + rr.normal(0, 4)
        S.n("snare", go(b), 38, 0.5, v)
        if rr.random() < 0.35:
            S.n("snare", go(b + 0.125), 38, 0.4, v - 22)
    # the bolts and the chips
    for tb, v in ((SYNC["bolt11"], 116), (SYNC["bolt13"], 122)):
        crash(S, tb, v)
        S.ev("boom", tb, "boom", vel=v - 10, f_hi=74.0, f_lo=34.0, decay=2.4)
        taiko(S, tb, v, size=1.3)
        S.ev("timpani", tb, "timpani", m=m("D2") if tb < go(20) else m("A1"), vel=v - 4)
    stab(S, SYNC["bolt11"], "F2 C3 A3", "A3 D4 F4", vel=118, trumpets="D5 F5")
    stab(S, SYNC["bolt13"], "A2 E3 Bb3", "C#4 E4 Bb4", vel=124, trumpets="Bb4 C#5 E5")
    for i, tc in enumerate(SYNC["chips"]):
        b = beat_of(tc)
        low, high = ("G2 D3", "Bb3 D4 G4") if b < 18 else ("Eb3 Bb3", "G4 Bb4 Eb5")
        stab(S, tc, low, high, vel=110 + 3 * i)
        taiko(S, tc, 110 + 3 * i, size=1.15)
        S.ev("timpani", tc, "timpani", m=m("G1") if b < 18 else m("Eb2"), vel=104)
        S.chord("piano", tc, "G1 D2 Ab2" if b < 18 else "Eb1 Bb1 E2", 0.5, 104)
    # ---- the battle-cry: the theme's head in minor, climbing a fourth per bar (horns; trumpets at the top)
    heads = [(11.5, "D4"), (15.5, "G4"), (19.5, "A4")]
    for k, (hb, ton) in enumerate(heads):
        notes = theme(ton, minor=True, b0=-1, b1=3.0)
        if k == 2:                                   # A: phrygian dominant (Bb, C#): the most tense
            notes = [(b, p + (1 if (p - m(ton)) % 12 == 3 else 0), d) for (b, p, d) in notes]
        W = Warp([(0.0, go(hb)), (1.0, go(hb + 1.0))])
        last_end = go(hb + 4.0) if k < 2 else SYNC["stop14"] + 0.05
        notes = [(b, p, d if i < len(notes) - 1 else (beat_of(last_end) - hb - b)) for i, (b, p, d) in
                 enumerate(notes)]
        vel = 100 + 6 * k
        S.line("horns", notes, W, vel, octave=-1 if k < 2 else 0, layer="f")
        S.line("horn", notes, W, vel - 4, octave=-1 if k < 2 else 0, layer="f")
        if k >= 1:
            S.sline(notes, W, dyn_abs(hb, hb + 4.5, 0.08), octave=0 if k == 1 else 0)
        if k == 2:
            S.line("trumpets", notes, W, 108, layer="f", until=SYNC["stop14"] + 0.05)
    # the top of the storm: A7(b9) held, timpani roll and cymbal swell to the dead stop
    t22 = go(22)
    for p in ("A2", "E3", "G3", "Bb3"):
        S.n("trombones", t22, p, SYNC["stop14"] - t22 + 0.1, 104, layer="ff", env=ramp(SYNC["stop14"] - t22, 0.7, 1.1))
    S.n("tuba", t22, "A1", SYNC["stop14"] - t22 + 0.1, 108, env=ramp(SYNC["stop14"] - t22, 0.7, 1.0))
    roll(S, t22, SYNC["stop14"], "A1", 60, 118)
    S.ev("swell", t22, "cymbal_swell", dur=SYNC["stop14"] - t22, vel=104, choke=True)
    S.strings(t22, SYNC["stop14"] + 0.05, "A3 C#4 E4 G4 Bb4", [(t22, 0.72), (SYNC["stop14"], 0.95)], trem=True, seed=24)


# ------------------------------------------------------------------------------------------------- B14
def low_point(S):
    """Everything cuts out on the hail's stop (cues.MUSIC_CUTS). Room tone. On T_REVEAL a lone felt piano tries the
    theme in D minor and breaks: A . D . . E F (on the tear) ... the peak never comes."""
    rev, tear = SYNC["reveal"], SYNC["tear"]
    S.n("felt", rev, "D2", 2.6, 26)
    S.n("felt", rev, "A4", 0.5, 36)
    S.n("felt", rev + 0.55, "D5", 0.9, 38)
    S.n("felt", tear - 0.42, "E5", 0.4, 32)
    S.n("felt", tear, "F5", 1.2, 36)
    S.n("felt", tear + 0.02, "D4", 1.2, 24)
    S.ped("felt", rev - 0.02, end("B14") + 0.6)


# ------------------------------------------------------------------------------------------------- B15-B17
def the_beam(S):
    """B15: the leaf's touch is answered by the celesta playing the missing peak, in MAJOR (B A F#: the B04 curl);
    strings rise. T_SET: the ostinato returns, quiet, climbing G -> A -> the BEAM: B major (choir, strings, horns,
    crash, harp), the theme's head building over it. T_PLANT: a hushed breath. T_SURGE: lift-off to the bloom."""
    touch, st, beam, plant, surge, wave = (SYNC[k] for k in ("touch", "set", "beam", "plant", "surge", "wave"))
    # the touch: the curl in major
    for i, (p, v) in enumerate((("B6", 62), ("A6", 52), ("F#6", 54))):
        S.ev("celesta", touch + i * 0.3, "celesta", m=m(p), vel=v)
    S.ev("glock", touch, "glock", m=m("B7"), vel=26)
    S.ev("crotale", touch, "crotale_bow", m=m("B6"), dur=0.7, vel=38, attack=0.06, release=1.4)
    S.strings(touch, st + 0.2, "D2 A2 F#3 D4 A4", [(touch, 0.0), (touch + 0.5, 0.24), (st, 0.4)])
    S.ev("harmonic", touch + 0.1, "harmonic", m=m("F#6"), dur=st - touch, vel=26, attack=0.4, release=0.8, seed=7)
    S.n("felt", touch, "D2", 1.6, 34)
    S.ped("felt", touch - 0.02, st)
    # T_SET -> T_BEAM: the ostinato returns, climbing G -> A -> B
    mid = st + (beam - st) / 2
    ost_dyn = [(st, 0.34), (mid, 0.52), (beam, 0.8)]
    f = dyn_fn(ost_dyn)
    b = 0.0
    i = 0
    while set_(b) < beam - 0.02:
        t = set_(b)
        bass = "G2" if t < mid else "A2"
        d = float(f(t)) + (0.06 if (i % 8) in (0, 3, 6) else -0.04)
        S.spic(t, bass, d)
        S.spic(t, m(bass) - 12, d - 0.06)
        if t >= mid:
            S.spic(t, ("A3", "E4", "C#4", "E4")[i % 4], d - 0.08)
        else:
            S.spic(t, ("G3", "D4", "B3", "D4")[i % 4], d - 0.1)
        i += 1
        b += 0.25
    S.strings(st, mid + 0.1, "G2 D3 B3 D4 G4", [(st, 0.3), (mid, 0.46)])
    S.strings(mid, beam - 0.03, "A2 E3 C#4 E4 A4", [(mid, 0.44), (beam - 0.1, 0.68)], release=0.06)
    S.n("horns", st, "B3", mid - st + 0.05, 74, layer="mf", env=ramp(mid - st, 0.6, 1.0))
    S.n("horns", st + 0.02, "D4", mid - st + 0.05, 72, layer="mf", env=ramp(mid - st, 0.6, 1.0))
    S.n("horns", mid, "C#4", beam - mid + 0.05, 88, layer="f", env=ramp(beam - mid, 0.6, 1.0))
    S.n("horns", mid + 0.02, "E4", beam - mid + 0.05, 86, layer="f", env=ramp(beam - mid, 0.6, 1.0))
    S.n("choir", mid - 0.2, "E4", beam - mid + 0.25, 92, attack=0.5, env=ramp(beam - mid, 0.4, 1.0))
    S.n("choir", mid - 0.2, "A4", beam - mid + 0.25, 90, attack=0.5, env=ramp(beam - mid, 0.4, 1.0))
    S.n("choir", mid - 0.2, "C#5", beam - mid + 0.25, 88, attack=0.5, env=ramp(beam - mid, 0.4, 1.0))
    for t, p in ((st, "G1"), (mid, "A1")):
        S.ev("timpani", t, "timpani", m=m(p) + 12, vel=70 if t == st else 84)
    roll(S, mid + 0.1, beam - 0.06, "A1", 36, 88)
    S.ev("swell", beam - 1.3, "cymbal_swell", dur=1.3, vel=100, ring=3.0)
    harp_gliss(S, beam - 0.55, beam - 0.02, "A2 C#3 E3 A3 C#4 E4 A4 C#5 E5 A5", 40, 68)
    # THE BEAM: B major, the dominant of E: choir, strings, horns, crash, harp, sparkle
    rel = plant - 0.06                                            # everything releases into the hushed breath
    crash(S, beam, 116)
    stab(S, beam, "B1 F#2 B2", "D#4 F#4 B4", vel=114, trumpets="F#5 B5")
    S.ev("timpani", beam, "timpani", m=m("B1"), vel=112)
    taiko(S, beam, 108, size=1.3)
    S.ev("boom", beam, "boom", vel=80, f_hi=66.0, f_lo=40.0, decay=2.4)
    beam_dyn = [(beam, 0.9), (beam + 0.7, 0.8), (rel, 0.74)]
    S.strings(beam, rel, "B1 B2 F#3 B3 D#4 F#4 B4 D#5", beam_dyn, release=0.25)
    S.strings(beam, rel, "F#5", beam_dyn, release=0.25)
    for p, v in (("F#4", 104), ("B4", 104), ("D#5", 100), ("B3", 100)):
        S.n("choir", beam - 0.05, p, rel - beam + 0.05, v, attack=0.18, release=0.35)
    S.n("tuba", beam, "B1", rel - beam, 96, env=ramp(rel - beam, 1.0, 0.8))
    for p in ("B2", "F#3"):
        S.n("trombones", beam, p, rel - beam, 96, layer="mf", env=ramp(rel - beam, 1.0, 0.8))
    for p in ("D#4", "F#4"):
        S.n("horns", beam, p, rel - beam, 102, layer="f", env=ramp(rel - beam, 1.0, 0.75))
    harp_gliss(S, beam, beam + 0.6, "B2 D#3 F#3 B3 D#4 F#4 B4 D#5 F#5 B5", 60, 80)
    cascade(S, beam + 0.02, "B6 F#6 D#6 B5 F#5 D#5", vel=58, step=0.08)
    cascade(S, beam + 0.04, "B6 F#6 D#6 B5 F#5", vel=44, step=0.08, track="glock", octave=1)
    for k, p in enumerate(("D#6", "F#6", "B6")):
        S.ev("crotale", beam + 0.1 + 0.2 * k, "crotale_bow", m=m(p), dur=0.8, vel=50, attack=0.08, release=1.6)
    # the ostinato keeps climbing on the B pedal ...
    b = 0.0
    i = 0
    while beam + b * BEAT < rel - 0.05:
        t = beam + b * BEAT
        d = 0.66 + (0.06 if (i % 8) in (0, 3, 6) else -0.04)
        S.spic(t, "B2", d)
        S.spic(t, ("F#3", "B3", "D#4", "B3")[i % 4], d - 0.08)
        i += 1
        b += 0.25
    # ... and the theme's head builds over it, in E (B -> E . F# G#): the G# becomes the hush
    W = Warp([(0.0, beam + 0.42), (2.5, plant - 0.06)])
    head = theme("E4", b1=3.0)
    S.line("horns", head[:-1], W, 108, layer="f", until=rel)
    S.line("horn", head[:-1], W, 104, layer="f", until=rel)
    S.sline(head[:-1], W, [(beam, 0.78), (rel, 0.8)], octave=1, until=rel)
    # T_PLANT: the hushed breath (choir and harmonics only, the head's G# held pp, the seed call on celesta)
    S.n("choir", plant, "G#4", surge - plant + 0.2, 32, attack=0.25, release=0.5)
    S.n("choir", plant, "B3", surge - plant + 0.2, 24, attack=0.25, release=0.5)
    S.n("choir", plant, "D#4", surge - plant + 0.2, 24, attack=0.25, release=0.5)
    S.n("horn", plant + 0.02, "G#4", surge - plant + 0.15, 34, layer="mf", attack=0.15, env=boost(-6.0))
    S.ev("harmonic", plant, "harmonic", m=m("B6"), dur=surge - plant + 0.2, vel=30, attack=0.15, release=0.6, seed=8)
    S.ev("celesta", plant + 0.15, "celesta", m=m("B5"), vel=40)
    S.ev("celesta", plant + 0.15 + BEAT / 2, "celesta", m=m("E6"), vel=44)
    # T_SURGE: lift-off: everything rises into the bloom (B7)
    L = wave - surge
    roll(S, surge, wave - 0.05, "B1", 28, 96, rate=17.0)
    S.ev("swell", surge, "cymbal_swell", dur=L, vel=110, ring=1.0, choke=True)
    S.strings(surge, wave - 0.035, "B1 B2 F#3 A3 D#4 F#4 A4", [(surge, 0.3), (wave, 0.84)], trem=True, seed=25,
              release=0.03)
    for p in ("B3", "D#4", "F#4", "A4"):
        S.n("choir", surge, p, L - 0.03, 104, attack=L * 0.7, release=0.06, env=ramp(L, 0.3, 1.0, 1.6))
    for p in ("D#4", "F#4", "A4"):
        S.n("horns", surge + 0.1, p, L - 0.14, 108, layer="f", env=ramp(L - 0.1, 0.2, 0.9, 1.6), release=0.05)
    for p in ("B2", "F#3", "A3"):
        S.n("trombones", surge + 0.1, p, L - 0.14, 106, layer="ff", env=ramp(L - 0.1, 0.2, 0.9, 1.6), release=0.05)
    S.n("tuba", surge + 0.1, "B1", L - 0.14, 104, env=ramp(L - 0.1, 0.3, 0.9, 1.6), release=0.05)
    run = "B3 C#4 D#4 E4 F#4 G#4 A4 B4 C#5 D#5"
    for j, p in enumerate(run.split()):                       # the strings' run up into the theme's first note
        S.spic(wave - 0.62 + j * 0.06, p, 0.7 + 0.025 * j, length=0.1)
        S.spic(wave - 0.62 + j * 0.06, m(p) + 12, 0.66 + 0.025 * j, length=0.1)
    harp_gliss(S, wave - 0.85, wave - 0.04, "B2 D#3 F#3 A3 B3 D#4 F#4 A4 B4 D#5 F#5 A5 B5", 46, 84)
    snare_roll(S, wave - 0.8, wave - 0.07, 34, 86)


# ------------------------------------------------------------------------------------------------- B18-B19
def the_bloom(S):
    """THE BLOOM. The theme in its grandest form, in E major (a step above where it was born): horns and cellos,
    trumpets and violins in octaves, flute and glockenspiel on top, the choir singing it; the bass walks E G# A G# F#
    B E; timpani, crashes, harp glissandi and a celesta/glockenspiel cascade. It lands on the tonic at T_WAVE_END.
    The violins' last note becomes the first of a tender restatement (B19: strings alone, peak on the sapling's
    lean) whose cadence the music box completes on the leaf's pat in B20."""
    wave, wend, lean, pat = SYNC["wave"], SYNC["wave_end"], SYNC["lean"], SYNC["pat"]
    W = Warp([(0.5, wave), (7.0, wend)])
    mel = theme("E5")
    full = [(b, p, d) for (b, p, d) in mel if b < 7.0]
    # melody
    S.line("trumpets", full, W, 112, layer="f", env=boost(5.0))
    S.line("horns", full, W, 118, octave=-1, layer="f", env=boost(5.0))
    S.line("horn", full, W, 114, octave=-1, layer="f", env=boost(4.0))
    S.line("flute", full, W, 100, octave=1)
    S.line("choir", full, W, 118, octave=-1, legato=False, attack=0.08, release=0.25)
    S.line("trombones", [(b, p, d) for (b, p, d) in full if b >= 0.5], W, 108, octave=-2, layer="ff")
    cdyn = [(W(0.0), 0.88), (wave, 0.95), (W(3.0), 0.97), (W(6.0), 0.9), (wend, 0.95)]
    S.sline(full, W, cdyn)
    S.sline(full, W, [(b_, d_ - 0.04) for (b_, d_) in cdyn], octave=-1)
    S.bells("glock", [(b, p, d) for (b, p, d) in full if b >= 0.5], W, 52, octave=1, fn="glock")
    # harmony: E | E/G# | A (the peak) | E/G# | F#m7 B7 | E
    H = [(0.5, 2.0, "E1", "E2 B2 E3 G#3 B3"), (2.0, 3.0, "G#1", "G#2 B2 E3 G#3 B3"),
         (3.0, 5.0, "A1", "A2 E3 A3 C#4 E4"), (5.0, 6.0, "G#1", "G#2 B2 E3 G#3 B3"),
         (6.0, 6.5, "F#1", "F#2 C#3 E3 A3 C#4"), (6.5, 7.0, "B1", "B2 F#3 A3 D#4 F#4")]
    for (b0, b1, bass, ch) in H:
        t0, t1 = W(b0), W(b1)
        S.strings(t0, t1 + 0.06, [bass] + ch.split(), [(t0, 0.8), (t1, 0.8)], offset=0.06 if b0 > 0.5 else None,
                  attack=0.06 if b0 > 0.5 else None, release=0.3)
        S.n("tuba", t0, m(bass) + 12, t1 - t0 + 0.05, 112)
        S.chord("trombones", t0, ch.split()[1:4], t1 - t0 + 0.05, 106, layer="ff", env=boost(2.0))
        S.chord("piano", t0, [m(bass), m(bass) + 12], 0.9, 84)
        S.ev("timpani", t0, "timpani", m=m(bass) + 12 if m(bass) + 12 <= m("A2") else m(bass), vel=108)
        for p in ch.split()[2:]:
            S.n("choir", t0, p, t1 - t0 + 0.1, 92, attack=0.08, release=0.3)
        # the bass walks in driving eighths (celli + basses)
        nb = int(round((b1 - b0) * 2))
        for j in range(nb):
            tb = W(b0 + 0.5 * j)
            S.spic(tb, m(bass) + 12, 0.88 if j % 2 == 0 else 0.8, length=0.2)
    stab(S, wave, "E2 B2 E3", "G#3 B3 E4", vel=120, trumpets="B4 E5")
    stab(S, wend, "E2 B2 E3", "G#3 B3 E4", vel=118, trumpets="G#4 E5")
    S.chord("piano", wave, "E1 E2 B2", 1.2, 104)
    # percussion: the downbeat, the peak, the arrival
    for b_, v in ((0.5, 122), (3.0, 116), (7.0, 120)):
        crash(S, W(b_), v)
        taiko(S, W(b_), v, size=1.3)
    S.ev("boom", wave, "boom", vel=96, f_hi=60.0, f_lo=34.0, decay=2.6)
    S.ev("sub", wave, "sub", m=m("E1"), dur=W(2.0) - wave, vel=90, attack=0.02, release=0.5)
    for b_ in (1.5, 2.5, 4.0, 5.5, 6.5):
        taiko(S, W(b_), 96, size=1.0)
    harp_gliss(S, wave, wave + 0.9, "E3 G#3 B3 E4 G#4 B4 E5 G#5 B5 E6 G#6", 70, 92)
    harp_gliss(S, W(3.0), W(3.0) + 0.8, "C#7 A6 E6 C#6 A5 E5 C#5 A4 E4 C#4", 86, 64)
    harp_gliss(S, W(6.0), wend - 0.03, "F#3 A3 B3 D#4 F#4 A4 B4 D#5 F#5", 62, 84)
    cascade(S, wave + 0.03, "E7 B6 G#6 E6 B5 G#5 E5", vel=76, step=0.075)
    cascade(S, wave + 0.06, "E7 B6 G#6 E6 B5 G#5", vel=58, step=0.075, track="glock")
    cascade(S, W(3.0) + 0.02, "C#7 A6 E6 C#6 A5", vel=64, step=0.08)
    for k, p in enumerate(("E6", "G#6", "B6", "E7")):
        S.ev("crotale", wave + 0.08 + 0.15 * k, "crotale_bow", m=m(p), dur=1.0, vel=56, attack=0.06, release=2.0)
    # THE ARRIVAL (T_WAVE_END): E major, held, dying away into B19
    arr_end = start("B19") + 0.6
    S.strings(wend, arr_end, "E1 E2 B2 E3 G#3 B3 E4 G#4 B4", [(wend, 0.98), (wend + 0.5, 0.72), (arr_end, 0.4)],
              offset=0.06, attack=0.05, release=0.6)
    S.n("tuba", wend, "E2", 0.9, 110, env=ramp(0.9, 1.0, 0.5))
    S.chord("trombones", wend, "E3 G#3 B3", 1.0, 104, layer="ff", env=ramp(1.0, 1.0, 0.45))
    S.chord("horns", wend, "B3 E4 G#4", 1.1, 112, layer="f", env=ramp(1.1, 1.6, 0.6))
    S.n("trumpets", wend, "E5", 0.9, 106, layer="f", env=ramp(0.9, 1.6, 0.5))
    for p in ("E4", "G#4", "B4"):
        S.n("choir", wend, p, arr_end - wend + 0.3, 104, attack=0.06, release=0.9,
            env=lambda tt: np.interp(tt, [0, 0.5, 1.5], [1.0, 0.6, 0.25]))
    S.chord("piano", wend, "E1 E2 B2 E3 G#3 B3 E4", 2.5, 80, spread=0.01)
    S.ped("piano", wend - 0.02, start("B19") + 0.25)
    S.ev("timpani", wend, "timpani", m=m("E2"), vel=112)
    S.ev("sub", wend, "sub", m=m("E1"), dur=0.8, vel=80, attack=0.01, release=1.0)
    harp_gliss(S, wend + 0.1, wend + 0.9, "E3 B3 E4 G#4 B4 E5 G#5 B5 E6", 72, 50)
    cascade(S, wend + 0.05, "B6 G#6 E6 B5 G#5 E5 B4", vel=54, step=0.1)
    # B19: the tender restatement: strings alone, softly; the peak on the sapling's lean
    W2 = Warp([(0.5, wend), (3.0, lean), (7.0, pat)])
    tender = [(b, p, d) for (b, p, d) in theme("E5") if 2.0 <= b < 5.0]
    tdyn = [(W2(2.0), 0.5), (lean, 0.6), (W2(4.5), 0.5), (start("B20"), 0.36)]
    S.strings(wend + 0.02, W2(2.0) + 0.1, ["E5"], [(wend, 0.62), (start("B19"), 0.42), (W2(2.0), 0.4)],
              offset=0.08, attack=0.05, release=0.3)
    S.sline(tender, W2, tdyn, until=start("B20") + 0.15)
    S.sline(tender, W2, [(t, d - 0.1) for (t, d) in tdyn], octave=-1, until=start("B20") + 0.15)
    S.strings(W2(2.0), lean + 0.1, "C#3 G#3 B3 E4", [(W2(2.0), 0.32), (lean, 0.36)], offset=0.08, attack=0.1)
    S.strings(lean, W2(5.0) + 0.1, "A2 E3 A3 C#4", [(lean, 0.38), (W2(5.0), 0.26)], offset=0.08, attack=0.1)
    for p in ("E4", "G#4", "B4"):
        S.n("choir", start("B19") + 0.3, p, lean - start("B19"), 30, attack=0.6, release=0.8)
    for p in ("C#4", "E4", "A4"):
        S.n("choir", lean - 0.1, p, start("B20") - lean + 0.3, 28, attack=0.4, release=1.0)
    harp_gliss(S, lean - 0.05, lean + 0.6, "A2 E3 A3 C#4 E4 A4 C#5", 44, 56)
    S.ev("celesta", lean, "celesta", m=m("C#7"), vel=46)
    S.ev("glock", lean, "glock", m=m("C#7"), vel=26)
    S.ev("crotale", lean, "crotale_bow", m=m("C#6"), dur=0.6, vel=34, attack=0.06, release=1.4)


# ------------------------------------------------------------------------------------------------- B20
def coda(S):
    """Years later. The music box takes the theme from the strings and completes its cadence on the leaf's pat; a
    warm E major (add 9) chord under the title; the music box plays the seed call one last time; fade."""
    wend, lean, pat, title, b20 = SYNC["wave_end"], SYNC["lean"], SYNC["pat"], SYNC["title"], start("B20")
    W2 = Warp([(0.5, wend), (3.0, lean), (7.0, pat)])
    box = [(b, p, d) for (b, p, d) in theme("E6") if b >= 5.0]
    S.bells("musicbox", box, W2, 66, fn="musicbox", detune_seed=3, cents_sd=1.2)
    S.bells("celesta", box, W2, 34)
    # the strings' pad under the box: E/G# -> A/B -> E (on the pat)
    S.strings(b20, W2(6.0) + 0.1, "G#2 B2 E3 G#3", [(b20, 0.3), (W2(6.0), 0.24)], offset=0.08, attack=0.15)
    S.strings(W2(6.0), pat + 0.1, "B2 E3 A3 F#4", [(W2(6.0), 0.24), (pat, 0.22)], offset=0.08, attack=0.15)
    S.strings(pat, DURATION + 0.5, "E2 B2 E3 G#3 B3 F#4", [(pat, 0.24), (title, 0.3), (DURATION, 0.22)],
              offset=0.06, attack=0.3)
    S.n("felt", b20 + 0.02, "G#2", 1.0, 28)
    S.n("felt", W2(6.0), "B1", 0.8, 28)
    S.ped("felt", b20, W2(6.0) - 0.02)
    S.ped("felt", W2(6.0), pat - 0.02)
    # the pat: the cadence; a glint
    S.ev("glock", pat, "glock", m=m("E7"), vel=28)
    S.ev("crotale", pat, "crotale_bow", m=m("E7"), dur=0.4, vel=30, attack=0.03, release=1.2)
    # the title chord: E major add 9, harp, a soft horn, felt piano; the music box's seed call, once more
    harp_gliss(S, title - 0.05, title + 1.1, "E2 B2 E3 G#3 B3 E4 F#4 G#4 B4 E5", 42, 54)
    for p, v in (("E2", 24), ("B2", 22), ("G#3", 22), ("F#4", 22), ("B4", 22)):
        S.n("felt", title, p, DURATION - title + 0.5, v)
    S.ped("felt", pat, DURATION + 0.6)
    S.n("horn", title + 0.05, "E4", DURATION - title, 50, layer="mf", attack=0.4,
        env=ramp(DURATION - title, 1.0, 0.5))
    for p in ("G#4", "B4", "E5"):
        S.n("choir", title, p, DURATION - title + 0.3, 34, attack=0.9, release=1.2)
    W3 = Warp([(0.0, title + 0.25), (1.0, title + 0.25 + 0.42)])
    seed_call = theme("E6", b1=3.0)
    S.bells("musicbox", seed_call, W3, 58, fn="musicbox", detune_seed=9, cents_sd=1.2)
    S.ev("harmonic", title, "harmonic", m=m("B6"), dur=DURATION - title, vel=20, attack=1.0, release=1.0, seed=9)


# ======================================================================================================== rendering
TRACK_INST = {"felt": "piano", "toms": "kit", "crash": "kit", "snare": "kit", "ost": "strings"}

PANS = {   # stage position (balance) of each track; sampled sections already carry their own stereo image
    "celesta": 0.25, "glock": -0.25, "harp": -0.35, "pizz": 0.3, "crotale": 0.15, "musicbox": 0.1, "flute": -0.2,
    "clarinet": 0.15, "horn": -0.15, "horns": -0.25, "horns_stac": -0.25, "trombones": 0.25,
    "trombones_stac": 0.25, "tuba": 0.35, "trumpets": 0.2, "trumpets_stac": 0.2, "timpani": -0.1, "harmonic": -0.1,
    "toms": 0.1, "taiko": -0.05, "snare": 0.15,
}

TRACKS = {   # track: (gain_db, hall send)
    "piano": (-2.0, 0.22), "felt": (2.0, 0.30), "strings": (3.0, 0.30), "ost": (12.0, 0.22), "flute": (-7.0, 0.32),
    "clarinet": (-3.0, 0.32), "horn": (-3.0, 0.34), "horns": (-3.0, 0.34), "horns_stac": (-2.0, 0.3),
    "trombones": (-4.0, 0.3), "trombones_stac": (-3.0, 0.3), "tuba": (-4.0, 0.25), "trumpets": (-5.0, 0.32),
    "trumpets_stac": (-4.0, 0.3), "choir": (2.0, 0.45),
    "celesta": (3.0, 0.38), "glock": (-6.0, 0.38), "musicbox": (5.0, 0.28), "crotale": (-5.0, 0.45),
    "harmonic": (-6.0, 0.42), "pizz": (-6.0, 0.25), "harp": (-4.0, 0.35),
    "timpani": (-4.0, 0.3), "taiko": (1.0, 0.26), "toms": (2.0, 0.26), "snare": (3.0, 0.3), "boom": (-1.0, 0.12),
    "crash": (7.0, 0.3), "swell": (-9.0, 0.32), "sub": (-8.0, 0.0),
}


def felt(y):
    """Felt-piano colour: soft hammers (12 dB/oct above ~1.6 kHz), a little body."""
    y = dsp.lp(y, 1600, order=2)
    return dsp.eq(y, [("lowshelf", 250, 0.7, 2.0)]) * 1.25


TRACK_FX = {"felt": felt}


def render_tracks(S, length=DURATION + 4.0):
    out = {}
    for k, (tr, notes) in enumerate(sorted(S.notes.items())):
        inst = SM.instrument(TRACK_INST.get(tr, tr))
        notes = SM.humanize(sorted(notes, key=lambda n: n.t), seed=100 + k, t_ms=5.0,
                            vel=0.0 if tr in ("strings", "ost", "choir") else 3.0)
        y = SM.render_notes(inst, notes, length, pedal=sorted(S.pedal.get(tr, [])) or None)
        out[tr] = TRACK_FX[tr](y) if tr in TRACK_FX else y
    for tr, evs in S.events.items():
        buf = np.zeros((int(length * SR), 2), np.float32)
        for (t, fn, kw) in evs:
            dsp.place(buf, getattr(SY, fn)(**kw), t)
        out[tr] = buf
    return out


def mixdown(stems, length=DURATION + 4.0):
    n = int(length * SR)
    dry = np.zeros((n, 2), np.float32)
    send = np.zeros((n, 2), np.float32)
    for tr, y in stems.items():
        g, s = TRACKS.get(tr, (0.0, 0.25))
        y = y[:n] * dsp.db(g)
        if tr in ("piano", "felt"):      # the spaced-pair Steinway is very wide: focus it a little (M/S, side x0.75)
            mid, side = (y[:, 0] + y[:, 1]) / 2, (y[:, 0] - y[:, 1]) / 2 * 0.75
            y = np.stack([mid + side, mid - side], axis=1)
        p = PANS.get(tr, 0.0)
        if p:
            y = y * np.array([np.sqrt(1 - p), np.sqrt(1 + p)], np.float32)
        dry[:len(y)] += y
        send[:len(y)] += y * s
    dry = dsp.eq(dry, [("hp", 30, 0.7, 0), ("hp", 30, 0.7, 0), ("peak", 280, 0.9, -1.5), ("highshelf", 9000, 0.7, 1.0)])
    hall = dsp.make_ir(2.6, predelay=0.026, seed=7, er=dict(n=14, spread=0.06, gain=0.45), hf_damp=0.5, width=1.0)
    wet = dsp.convolve(dsp.hp(send, 140), hall)[:n]
    return dry + 0.55 * wet


def split(S, t0, t1):
    """Sub-score with the notes/events that start in [t0, t1)."""
    P = Score()
    P.pedal = S.pedal
    for tr, notes in S.notes.items():
        sel = [n for n in notes if t0 <= n.t < t1]
        if sel:
            P.notes[tr] = sel
    for tr, evs in S.events.items():
        sel = [e for e in evs if t0 <= e[0] < t1]
        if sel:
            P.events[tr] = sel
    return P


def render_segmented(S, length=DURATION + 4.0, fade=0.03):
    """Render between MUSIC_CUTS: each segment (with its hall reverb) is cut at the next cut point, so a cut is a real
    cut instead of a reverb tail. A cut is t (dead stop, 30 ms fade) or (t, fade_before, fade_after) for a fast
    fade that straddles t (the hushed breath)."""
    n = int(length * SR)
    cuts = sorted(c if isinstance(c, (tuple, list)) else (c, fade, 0.0) for c in MUSIC_CUTS)
    bounds = [0.0] + [c[0] for c in cuts] + [length]
    mix = np.zeros((n, 2), np.float32)
    stems_all = {}
    for i, (t0, t1) in enumerate(zip(bounds[:-1], bounds[1:])):
        stems = render_tracks(split(S, t0, t1), length)
        seg = mixdown(stems, length)
        g = np.ones(n, np.float32)
        if i < len(cuts):
            a0, a1 = int(max(0.0, t1 - cuts[i][1]) * SR), int((t1 + cuts[i][2]) * SR)
            a1 = max(a1, a0 + 1)
            g[a0:a1] = (0.5 + 0.5 * np.cos(np.linspace(0, np.pi, a1 - a0))).astype(np.float32)
            g[a1:] = 0.0
        mix += seg[:n] * g[:, None]
        for tr, y in stems.items():
            y = y[:n] * g[:len(y), None]
            stems_all[tr] = stems_all.get(tr, 0) + y
    return mix, stems_all


GROUPS = {"piano": ["piano", "felt"], "strings": ["strings", "ost"], "winds": ["flute", "clarinet"],
          "brass": ["horn", "horns", "horns_stac", "trombones", "trombones_stac", "tuba", "trumpets",
                    "trumpets_stac"],
          "choir": ["choir"],
          "bells": ["celesta", "glock", "musicbox", "crotale", "harmonic", "harp", "pizz"],
          "perc": ["timpani", "taiko", "toms", "snare", "boom", "crash", "swell", "sub"]}


def main():
    S = compose()
    n_notes = sum(len(v) for v in S.notes.values()) + sum(len(v) for v in S.events.values())
    print(f"score: {n_notes} notes/events in {len(S.notes) + len(S.events)} tracks")
    mix, stems = render_segmented(S)
    mix = mix[:int(DURATION * SR) + int(2.0 * SR)]
    pk = float(np.max(np.abs(mix)))
    target = dsp.db(-3.0)
    trim = min(1.0, target / pk) if pk > 0 else 1.0
    mix *= trim
    os.makedirs(OUT, exist_ok=True)
    dsp.write_wav(os.path.join(OUT, "score.wav"), mix)
    for gname, trs in GROUPS.items():
        acc = sum((stems[t] * dsp.db(TRACKS[t][0]) for t in trs if t in stems), np.zeros((1, 2), np.float32))
        if np.ndim(acc) == 2 and len(acc) > 1:
            dsp.save_stem(os.path.join(SM.CACHE, "stems", f"{gname}.npy"), acc[:len(mix)] * trim)
    for tr, y in stems.items():          # per-track stems (at track gain, before the hall) for balance checks
        if np.ndim(y) == 2:
            dsp.save_stem(os.path.join(SM.CACHE, "stems", "tracks", f"{tr}.npy"),
                          y[:len(mix)] * dsp.db(TRACKS.get(tr, (0.0,))[0]) * trim)
    print(f"wrote {os.path.join(OUT, 'score.wav')}  peak {dsp.to_db(pk):.1f} dBFS (pre-trim)")


if __name__ == "__main__":
    main()
