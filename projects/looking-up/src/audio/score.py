""""Looking Up" v2 — original score for the 58.7 s short (90 BPM, 4/4, D major), written as data and rendered at
48 kHz stereo to out/audio/score.wav.

Material (all original):
  THEME "Looking Up": four two-bar units, each opening with an upward SIXTH (the act of looking up), each starting
    one step higher than the last, so the tune itself climbs (A->F#, B->G, C#->A, D->B):
      A4 F#5 . . | G5 F#5 E5 C#5 D5 .  ||  B4 G5 . . | A5 G5 F#5 D5 E5 .  ||
      C#5 A5 . . | B5 A5 G5 E5 F#5 .   ||  D5 B5 . . | A5 G5 F#5 E5 D5 .
    (harmony D | A7-D || G | D/F#-A || F#m | G-D/F# || G | A7sus-A7-D)
  BLINK motif = the theme's first two notes, A4 -> F#5, on celesta exactly on Claude's two blinks; the star's
    TWINKLE answers with the same sixth two octaves up (A5 -> F#6, celesta + glockenspiel) on its two twinkles.
  The minor turn uses the same head in B minor (F#4 -> D5); the climb of sixths drives the sail ride; the fourth
    sixth (D -> B, the theme's peak) lands on the release and, an octave higher, on the ignition.
Sections follow src/timeline.py (bar n starts at (n-1) * 2.667 s); sync points come from cues.py.
"""
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
from cues import SYNC, DURATION, MUSIC_CUTS, start, end  # noqa: E402
from timeline import BEAT, bar as _bar  # noqa: E402

SR = dsp.SR
OUT = os.path.join(SM.PROJECT, "out", "audio")
m = SM.m


def B(b, beat=1.0):
    """Absolute time of bar b (may be fractional) + beat (1-based, fractional)."""
    return _bar(b) + (beat - 1.0) * BEAT


def _num(s):
    if "/" in s:
        a, b = s.split("/")
        return float(a) / float(b)
    return float(s)


def parse(spec):
    """'G4:1 E5:3@70 C4+E4:.5 r:1 | ...' -> [(beat, [pitches], beats, vel|None)], total beats."""
    out, beat = [], 0.0
    for tok in spec.replace("|", " ").split():
        p, _, d = tok.partition(":")
        d = d or "1"
        vel = None
        if "@" in d:
            d, v = d.split("@")
            vel = float(v)
        dur = _num(d)
        if p != "r":
            out.append((beat, [m(x) for x in p.split("+")], dur, vel))
        beat += dur
    return out, beat


def smooth(u):
    u = np.clip(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


def dyn_fn(dyn):
    """Dynamics: constant d or [(t_abs, d), ...] -> f(t_abs array)."""
    if np.isscalar(dyn):
        return lambda t: np.full(np.shape(t), float(dyn))
    xs = np.array([p[0] for p in dyn], float)
    ys = np.array([p[1] for p in dyn], float)
    return lambda t: np.interp(t, xs, ys)


def amp_of(d):
    """Dynamic level d in [0, 1] (0 ~ ppp, 0.5 ~ mf, 1 ~ ff) -> linear gain."""
    return 10 ** (-30.0 * (1 - np.asarray(d)) / 20)


# THEME (beats relative to the downbeat of theme bar 1)
THEME = [(0, "A4", 1), (1, "F#5", 3), (4, "G5", .5), (4.5, "F#5", .5), (5, "E5", .5), (5.5, "C#5", .5), (6, "D5", 2),
         (8, "B4", 1), (9, "G5", 3), (12, "A5", .5), (12.5, "G5", .5), (13, "F#5", .5), (13.5, "D5", .5), (14, "E5", 2),
         (16, "C#5", 1), (17, "A5", 3), (20, "B5", .5), (20.5, "A5", .5), (21, "G5", .5), (21.5, "E5", .5),
         (22, "F#5", 2),
         (24, "D5", 1), (25, "B5", 3), (28, "A5", .5), (28.5, "G5", .5), (29, "F#5", .5), (29.5, "E5", .5), (30, "D5", 2)]
BLINK = ("A4", "F#5")            # Claude
TWINKLE = ("A5", "F#6")          # the star


def theme_slice(b0, b1):
    """Theme notes with beat offset in [b0, b1)."""
    return [(o, p, d) for (o, p, d) in THEME if b0 <= o < b1]


class Score:
    def __init__(self):
        self.notes = defaultdict(list)       # sampled tracks
        self.events = defaultdict(list)      # synth tracks: (t, fn, kwargs)
        self.pedal = []

    # ------------------------------------------------------------------ primitives
    def n(self, track, t, pitch, dur, vel=64, pan=0.0, **kw):
        p = m(pitch) if isinstance(pitch, str) else int(pitch)
        self.notes[track].append(SM.Note(float(t), p, float(dur), float(vel), pan, kw))

    def ev(self, track, t, fn, **kw):
        self.events[track].append((float(t), fn, kw))

    def ped(self, t0, t1):
        self.pedal.append((t0 + 0.05, t1 + 0.01))

    def peds(self, times):
        """Legato pedalling: change at each time in the list."""
        for a, b in zip(times[:-1], times[1:]):
            self.ped(a, b)

    def seq(self, track, t0, spec, vel=64, hold=1.0, legato=False, **kw):
        """Place a parsed sequence; hold = fraction of the written length the key is held."""
        evs, total = parse(spec)
        for i, (bt, ps, d, v) in enumerate(evs):
            dur = d * BEAT * hold
            extra = {}
            if legato and i > 0 and abs(evs[i - 1][0] + evs[i - 1][2] - bt) < 1e-6:
                extra = dict(offset=kw.get("leg_offset", 0.07), attack=kw.get("leg_attack", 0.06))
            if legato:
                dur += 0.06
            for p in ps:
                kk = {k: v2 for k, v2 in kw.items() if k not in ("leg_offset", "leg_attack")}
                kk.update(extra)
                self.notes[track].append(SM.Note(t0 + bt * BEAT, p, dur, v if v else vel, 0.0, kk))
        return t0 + total * BEAT

    def arp(self, t0, names, vel=44, step=0.5, dur=0.9, accent=8, track="piano"):
        """Broken-chord figure: one note per `step` beats (default 8ths), first note accented."""
        for i, nm in enumerate(names.split()):
            if nm == "r":
                continue
            v = vel + (accent if i % 8 == 0 else (2 if i % 2 == 0 else -3))
            self.n(track, t0 + i * step * BEAT, nm, dur * BEAT, v)

    def theme(self, track, t_bar1, b0=-1, b1=32, vel=60, octave=0, legato=False, **kw):
        """Place part of the theme (beats [b0, b1)) with natural phrasing: long notes leaned on, 8ths lighter."""
        sl = theme_slice(b0, b1)
        for i, (o, p, d) in enumerate(sl):
            v = vel + (4 if d >= 2 else (-6 if d <= 0.5 else 0))
            pitch = m(p) + 12 * octave
            extra = dict(kw)
            dur = d * BEAT + (0.06 if legato else 0.0)
            if legato and i > 0 and abs(sl[i - 1][0] + sl[i - 1][2] - o) < 1e-6:
                extra.update(offset=0.07, attack=0.06)
            self.notes[track].append(SM.Note(t_bar1 + o * BEAT, pitch, dur, v, 0.0, extra))

    # ------------------------------------------------------------------ strings with dynamics
    def strings(self, t0, t1, pitches, dyn, trem=False, offset=None, attack=None, release=None, bend=None, pan=0.0,
                seed=0):
        """Sustained string notes [t0, t1) with a dynamic curve; crossfades the mf and f sample layers."""
        f = dyn_fn(dyn)
        dmax = float(np.max(f(np.linspace(t0, t1, 64))))
        for k, p in enumerate(pitches.split() if isinstance(pitches, str) else pitches):
            pm = m(p) if isinstance(p, str) else p
            rate = 13.0 + 1.7 * ((seed + k) % 3)

            def env_for(layer, _t0=t0, _rate=rate, _k=k):
                def e(tt):
                    d = f(_t0 + tt)
                    wf = smooth((d - 0.45) / 0.4)
                    w = wf * 10 ** (1.5 / 20) if layer == "f" else (1 - wf)
                    g = amp_of(d) * w
                    if trem:      # bowed tremolo: irregular ~13-16 Hz re-articulation, not a clean LFO
                        ph = 2 * np.pi * (_rate * tt + 0.35 * np.sin(2 * np.pi * 0.7 * tt + _k)) + _k
                        g = g * (1 - 0.4 * (0.5 + 0.5 * np.sin(ph)) ** 1.5)
                    return g
                return e
            kw = dict(layer="mf", env=env_for("mf"))
            for key, val in (("offset", offset), ("attack", attack), ("release", release), ("bend", bend)):
                if val is not None:
                    kw[key] = val
            self.notes["strings"].append(SM.Note(t0, pm, t1 - t0, 127, pan, kw))
            if dmax > 0.45:
                kw2 = dict(kw, layer="f", env=env_for("f"))
                self.notes["strings"].append(SM.Note(t0, pm, t1 - t0, 127, pan, kw2))

    def string_line(self, t0, spec, dyn, octave=0, legato=True):
        """A melodic string line (legato: later notes skip the bow attack and cross-fade)."""
        evs, total = parse(spec)
        for i, (bt, ps, d, v) in enumerate(evs):
            ts = t0 + bt * BEAT
            te = ts + d * BEAT + (0.08 if legato else 0.0)
            leg = legato and i > 0 and abs(evs[i - 1][0] + evs[i - 1][2] - bt) < 1e-6
            for p in ps:
                self.strings(ts, te, [p + 12 * octave], dyn, offset=0.09 if leg else None,
                             attack=0.07 if leg else None, release=0.35)
        return t0 + total * BEAT

    def theme_strings(self, t_bar1, b0, b1, dyn, octave=0):
        sl = theme_slice(b0, b1)
        for i, (o, p, d) in enumerate(sl):
            ts = t_bar1 + o * BEAT
            leg = i > 0 and abs(sl[i - 1][0] + sl[i - 1][2] - o) < 1e-6
            self.strings(ts, ts + d * BEAT + 0.08, [m(p) + 12 * octave], dyn, offset=0.09 if leg else None,
                         attack=0.07 if leg else None, release=0.4)

    # ------------------------------------------------------------------ motifs
    def blink(self, times, vel=48):
        """Claude's blink-blink: the theme's opening sixth, one celesta note on each blink (soft piano under)."""
        for t, p, v in zip(times, BLINK, (vel, vel + 4)):
            self.ev("celesta", t, "celesta", m=m(p), vel=v)
            self.n("piano", t, p, 1.2, v - 16)

    def twinkle(self, times, vel=50):
        """The star's answer: the same sixth two octaves up, celesta + glockenspiel + a breath of crotale."""
        for t, p, v in zip(times, TWINKLE, (vel, vel + 4)):
            self.ev("celesta", t, "celesta", m=m(p), vel=v)
            self.ev("glock", t, "glock", m=m(p) + 12, vel=v - 14)
            self.ev("crotale", t, "crotale_bow", m=m(p), dur=0.25, vel=v - 18, attack=0.02, release=0.9)

    def cascade(self, t0, notes, vel=50, step=0.12, track="celesta"):
        for i, p in enumerate(notes.split()):
            self.ev(track, t0 + i * step, track, m=m(p), vel=vel - 1.5 * i)


# ======================================================================================================== THE SCORE
def compose():
    S = Score()
    intro(S)
    the_fall(S)
    suspense(S)
    warmth_and_play(S)
    the_turn(S)
    the_ascent(S)
    resolution(S)
    return S


def box(S, t0, notes, vel=32, step=0.5, seed=1):
    """Music-box twinkle bed (in tune: a fine box, not a toy)."""
    for i, p in enumerate(notes.split()):
        S.ev("musicbox", t0 + i * step * BEAT, "musicbox", m=m(p), vel=vel - (i % 2) * 4, detune_seed=seed + i,
             cents_sd=1.5)


# ------------------------------------------------------------------------------------------------- SH01-SH03
def intro(S):
    """Lonely, tender: a music-box twinkle bed, the theme's first unit on solo piano, then the ritual."""
    S.n("piano", B(1, 2), "D2", 4 * BEAT, 36)
    S.n("piano", B(1, 2) + 0.02, "A2", 4 * BEAT, 31)
    S.strings(0.25, B(2) + 0.3, "D3 A3 F#4", [(0.25, 0.0), (B(1, 3), 0.15), (B(2), 0.19)])
    box(S, B(1, 2), "A5 E6 F#6 E6 D6 A5", vel=34)
    box(S, B(2), "D6 A5 E6 A5 F#6 A5 E6 A5", vel=27, seed=20)
    box(S, B(3), "E6 A5 C#6 A5", vel=24, seed=40)
    # bar 2-3 (SH01 -> SH02): the theme's first unit, solo piano
    S.theme("piano", B(2), 0, 8, vel=52)
    S.n("piano", B(2), "D3", 4 * BEAT, 34)
    S.n("piano", B(2, 2), "A3", 3 * BEAT, 27)
    S.n("piano", B(3), "A2", 2 * BEAT, 34)
    for p in ("G3", "C#4"):
        S.n("piano", B(3) + 0.03, p, 2 * BEAT, 26)
    S.n("piano", B(3, 3), "D3", 2 * BEAT, 33)
    for p in ("F#3", "A3"):
        S.n("piano", B(3, 3) + 0.03, p, 2 * BEAT, 26)
    S.strings(B(2), B(3) + 0.25, "D3 A3 D4 F#4", [(B(2), 0.19), (B(3), 0.21)])
    S.strings(B(3), B(3, 3) + 0.25, "A2 E3 G3 C#4", [(B(3), 0.21), (B(3, 3), 0.19)])
    S.strings(B(3, 3), B(4) + 0.3, "D3 A3 F#4", [(B(3, 3), 0.19), (B(4), 0.15)])
    # bar 4 (SH03): the ritual — Gmaj7 held, Claude's blink-blink
    S.n("piano", B(4), "G2", 4 * BEAT, 33)
    for p in ("D3", "B3"):
        S.n("piano", B(4) + 0.03, p, 4 * BEAT, 26)
    S.strings(B(4), B(5) + 0.3, "G2 D3 B3 F#4", [(B(4), 0.14), (B(4, 3), 0.18), (B(5), 0.15)])
    S.blink(SYNC["blink_1"])
    S.peds([B(1, 2), B(2), B(3), B(3, 3), B(4), B(5)])


# ------------------------------------------------------------------------------------------------- SH04-SH05
def the_fall(S):
    """The answer (twinkle), a warm beat, the flicker; the music drops out at the fall (cues.MUSIC_CUTS); impact."""
    tw = SYNC["twinkle_1"]
    fl, fall = SYNC["flicker"], SYNC["fall"]
    S.n("piano", B(5), "D2", 3.0, 32)
    S.n("piano", B(5) + 0.02, "A2", 3.0, 27)
    S.ped(B(5), fall)
    S.strings(B(5), fl + 0.2, "D3 A3 F#4 A4", [(B(5), 0.15), (tw[1], 0.3), (fl, 0.26)])
    S.twinkle(tw)
    for j, p in enumerate("D4 F#4 A4 D5 F#5".split()):
        S.ev("harp", tw[1] + 0.12 + j * 0.07, "pluck", m=m(p), vel=34 + 2 * j, kind="harp")
    # the flicker: an unstable, trembling chord and a shivering celesta — then nothing
    S.strings(fl, fall + 0.2, "D2 F3 Bb3 D4", [(fl, 0.16), (fall, 0.34)], trem=True, seed=3)
    t, k = fl, 0
    while t < fall:
        S.ev("celesta", t, "celesta", m=m("A6") + (k % 2), vel=24 + 10 * (t - fl) / max(0.1, fall - fl))
        t += 0.085
        k += 1
    # SH05: the impact flash — the one big hit before the climax
    hit = SYNC["flash"]
    S.ev("boom", hit, "boom", vel=104)
    S.ev("timpani", hit, "timpani", m=m("D2"), vel=104)
    S.ev("timpani", hit + 0.01, "timpani", m=m("A2"), vel=92)
    S.ev("cymbal", hit, "cymbal", vel=88, decay=3.5)
    stab(S, hit, "D1 A1 D2 Eb2", ["D3", "A3"], ["D4", "Eb4"], vel=92)
    S.strings(hit, hit + 0.3, "D3 A3 D4 Eb4", [(hit, 0.9), (hit + 0.3, 0.6)], release=0.5)
    S.ped(hit - 0.03, hit + 1.25)
    # the bolt: a quick upward rush, then the run in low tremolo and pizzicato, cut short by the skid
    bolt, skid = SYNC["bolt"], SYNC["skid"]
    for i, p in enumerate("B4 C#5 D5 E5 F#5 G5 A5 B5".split()):
        S.n("flute_stac", bolt + i * 0.075, p, 0.07, 58 + 2 * i, layer="mp")
        S.n("clarinet_stac", bolt + i * 0.075, m(p) - 12, 0.07, 56 + 2 * i, layer="mp")
    S.strings(start("SH06") - 0.15, skid + 0.02, "B1 F#2", [(start("SH06") - 0.15, 0.2), (skid, 0.45)], trem=True,
              release=0.05, seed=5)
    t = start("SH06")
    while t < skid - 0.05:
        S.ev("pizz", t, "pluck", m=m("B2"), vel=72, kind="pizz", seed=int(t * 100))
        S.ev("pizz", t + BEAT / 4, "pluck", m=m("F#3"), vel=62, kind="pizz", seed=int(t * 100) + 1)
        t += BEAT / 2


# ------------------------------------------------------------------------------------------------- SH06-SH07
def suspense(S):
    """Cautious: heartbeat, tiptoe pizzicato over a low tremolo; then pity for the tiny star."""
    skid, flinch = SYNC["skid"], SYNC["flinch"]
    t0 = skid + 0.45
    S.strings(t0, end("SH07") + 0.3, "B1 F#2", [(t0, 0.06), (start("SH07"), 0.16), (flinch, 0.13),
                                               (end("SH07"), 0.05), (end("SH07") + 0.3, 0.0)], trem=True, seed=7)
    t = B(8)
    k = 0
    while t < flinch - 0.15:
        S.ev("heart", t, "heartbeat", vel=60 + 2.5 * k, seed=k)
        t += BEAT
        k += 1
    for (b, bt, p, v) in ((8, 1, "B3", 56), (8, 2, "D4", 50), (8, 3, "C#4", 54), (8, 3.5, "D4", 46), (8, 4, "F#3", 52)):
        S.ev("pizz", B(b, bt), "pluck", m=m(p), vel=v, kind="pizz")
    # SH07: the flinch, then pity — the theme's head in B minor, tiny and fragile
    S.ev("pizz", flinch, "pluck", m=m("F#5"), vel=52, kind="pizz")
    S.strings(flinch + 0.05, end("SH07") + 0.4, "B3 D4 F#4 C#5", [(flinch + 0.05, 0.0), (flinch + 0.7, 0.17),
                                                                (end("SH07"), 0.14), (end("SH07") + 0.4, 0.1)])
    S.ev("celesta", flinch + 0.45, "celesta", m=m("F#5"), vel=36)
    S.ev("celesta", flinch + 1.1, "celesta", m=m("D6"), vel=40)


# ------------------------------------------------------------------------------------------------- SH08-SH11
def warmth_and_play(S):
    hop, glow, tumble = SYNC["hop"], SYNC["glow"], SYNC["tumble"]
    t = start("SH08")
    # the offer: hesitant open chords
    S.strings(t, hop + 0.15, "G2 D3 B3 A4", [(t, 0.12), (hop, 0.24)])
    S.n("piano", t, "G2", 1.4, 33)
    for p in ("D3", "B3"):
        S.n("piano", t + 0.03, p, 1.3, 26)
    S.n("piano", B(10, 2), "A2", 1.3, 31)
    for p in ("E3", "B3"):
        S.n("piano", B(10, 2) + 0.03, p, 1.2, 25)
    S.peds([t, B(10, 2), hop])
    # the hop and the glow: a harp glissando and the theme's leap in the strings (A on the hop, F# on the glow)
    for j, p in enumerate("D4 E4 F#4 A4 B4 D5 E5 F#5 A5 B5 D6".split()):
        S.ev("harp", hop - 0.1 + j * 0.065, "pluck", m=m(p), vel=40 + 2 * j, kind="harp")
    S.strings(hop, glow + 0.08, ["A4"], [(hop, 0.3), (glow, 0.42)], release=0.3)
    S.strings(glow, B(11) + 0.1, ["F#5"], [(glow, 0.5), (B(11), 0.55)], offset=0.09, attack=0.07, release=0.3)
    S.strings(hop, glow + 0.1, "D3 A3 E4", [(hop, 0.22), (glow, 0.35)])
    S.strings(glow, B(11) + 0.2, "D3 A3 F#4 D4", [(glow, 0.35), (B(11), 0.45)])
    S.seq("horn", hop, "A3:1@62 F#4:1.1@70", legato=True, layer="mf")
    S.cascade(glow, "D6 F#6 A6 D7", vel=44, step=0.09)
    S.n("piano", glow, "D2", 1.0, 40)
    # SH09 play (bar 11): the cascade, bright and bouncy
    S.string_line(B(11), "G5:.5 F#5:.5 E5:.5 C#5:.5 D5:2", [(B(11), 0.55), (B(12), 0.5)])
    S.seq("flute", B(11), "G5:.5 F#5:.5 E5:.5 C#5:.5 D5:2", vel=74, legato=True)
    S.seq("flute_stac", B(11, 3), "D6:.25 E6:.25 F#6:.25 A6:.25 D7:.5", vel=64, layer="mp")
    S.seq("bass", B(11), "A2:.5 E2:.5 A2:.5 E2:.5 D2:.5 A2:.5 D2:.5 A2:.5", vel=82, hold=0.5)
    S.seq("clarinet_stac", B(11, 1.5), "C#4+G4:1 C#4+G4:1 D4+F#4:1 D4+F#4:.5", vel=62, hold=0.3, layer="mp")
    for (bt, p) in ((2, "A6"), (4, "F#6")):
        S.ev("glock", B(11, bt), "glock", m=m(p), vel=34)
    for (bt, ch, v) in ((1, "A3 C#4 G4", 46), (2, "A3 C#4 G4", 38), (3, "D4 F#4 A4", 46), (4, "D4 F#4 A4", 38)):
        for p in ch.split():
            S.n("piano", B(11, bt), p, 0.22, v)
    # SH10 (bar 12): the swoop (the second sixth, B -> G) ... the tumble into the flowers
    S.string_line(B(12), "B4:1 G5:3", [(B(12), 0.5), (B(12, 4), 0.55), (B(13), 0.42)])
    S.seq("flute", B(12), "B4:1@68 G5:1.6@72", legato=True)
    S.seq("bass", B(12), "G2:.5 D2:.5 G2:.5 D2:.5 G2:.5 D2:.5", vel=82, hold=0.5)
    S.seq("clarinet_stac", B(12, 1.5), "B3+G4:1 B3+G4:1", vel=60, hold=0.3, layer="mp")
    S.strings(B(12), tumble + 0.1, "G2 D3", [(B(12), 0.3), (tumble, 0.36)], release=0.2)
    S.ev("glock", B(12, 2), "glock", m=m("B6"), vel=32)
    for i, p in enumerate("G6 D6 B5 G5 D5".split()):
        S.n("flute_stac", tumble - 0.42 + i * 0.084, p, 0.08, 70 - 3 * i, layer="mp")
        S.ev("glock", tumble - 0.42 + i * 0.084, "glock", m=m(p) + 12, vel=34 - 3 * i)
    for p in ("G2", "D3", "B3"):
        S.ev("pizz", tumble, "pluck", m=m(p), vel=86, kind="pizz", seed=m(p))
    S.ev("timpani", tumble, "timpani", m=m("G2"), vel=72)
    S.n("bass", tumble, "G1", 0.5, 92)
    for i, p in enumerate("B5 C#6 B5 C#6 B5".split()):
        S.n("flute_stac", tumble + 0.35 + i * 0.075, p, 0.07, 52 - 2 * i, layer="mp")
    # SH11 (bar 13): lying in the flowers — a tender cadence home
    S.string_line(B(13), "A5:.5 G5:.5 F#5:.5 E5:.5 D5:2", [(B(13), 0.32), (B(13, 3), 0.3), (B(14), 0.18)])
    S.arp(B(13), "A2 E3 G3 C#4 D2 A2 F#3 A3", vel=36)
    S.strings(B(13), B(13, 3) + 0.25, "A2 E3 G3", [(B(13), 0.24), (B(13, 3), 0.22)])
    S.strings(B(13, 3), B(14) + 0.25, "D3 A3 F#4", [(B(13, 3), 0.22), (B(14), 0.16)])
    S.ev("celesta", B(13, 2), "celesta", m=m("F#6"), vel=26)
    S.ev("celesta", B(13, 4), "celesta", m=m("A6"), vel=24)
    S.ev("celesta", SYNC["flicker_2"], "celesta", m=m("G#6"), vel=30)          # the first sour note
    S.peds([B(13), B(13, 3), B(14)])


# ------------------------------------------------------------------------------------------------- SH12-SH14
def the_turn(S):
    dim, hug, res = SYNC["dim"], SYNC["hug"], SYNC["resolve"]
    b14 = B(14)
    # SH12: the head in B minor, sparse piano over sustained strings; the glow drains
    S.n("piano", b14, "B1", 4 * BEAT, 38)
    S.n("piano", b14 + 0.02, "F#2", 4 * BEAT, 32)
    S.seq("piano", b14, "F#4:1@46 D5:3@52", hold=1.0)
    S.peds([b14, B(15)])
    S.strings(b14, B(15) + 0.3, "B2 F#3 D4", [(b14, 0.2), (dim, 0.2), (dim + 0.7, 0.08), (B(15), 0.06)])
    S.ev("harmonic", b14 + 0.2, "harmonic", m=m("F#6"), dur=dim - b14, vel=26)
    S.cascade(dim + 0.05, "D6 B5 G5 F#5", vel=32, step=0.33)
    # SH13: the empty eye — the star's twinkle note alone, unanswered
    S.strings(B(15), B(15, 3) + 0.3, "G2 D3 B3 F#4", [(B(15), 0.1), (B(15, 3), 0.12)])
    S.ev("celesta", B(15) + 0.35, "celesta", m=m(TWINKLE[0]), vel=40)
    S.ev("glock", B(15) + 0.35, "glock", m=m(TWINKLE[0]) + 12, vel=20)
    # SH14: understanding (Em) ... the hug (B minor swells, the falling cascade in minor) ... resolve
    S.strings(B(15, 3), B(16) + 0.25, "E2 B2 G3 F#4", [(B(15, 3), 0.12), (B(16), 0.32)])
    S.string_line(B(15, 3), "E3:1 F#3:1", [(B(15, 3), 0.2), (B(16), 0.3)])
    S.strings(B(16), B(16, 3) + 0.25, "B1 F#2 D3 C#4 F#4", [(B(16), 0.32), (hug + 0.25, 0.58), (B(16, 3), 0.45)])
    S.string_line(B(16), "E5:.5 D5:.5 C#5:.5 A#4:.5 B4:1", [(B(16), 0.45), (B(16, 3), 0.36)])
    S.n("piano", B(16), "B1", 2.0, 40)
    for p in ("F#2", "D4", "F#4"):
        S.n("piano", B(16) + 0.03, p, 1.9, 32)
    S.peds([B(16), B(16, 3)])
    # resolve: G -> the horn takes the theme's sixth in major (A on the resolve, F# as the ascent begins)
    S.strings(B(16, 3), start("SH15") + 0.2, "G2 D3 B3 D4", [(B(16, 3), 0.36), (start("SH15"), 0.4)])
    S.n("horn", res, "A3", start("SH15") - res + 0.06, 74, layer="mf")
    S.n("horn", start("SH15"), "F#4", BEAT * 1.2, 80, layer="mf", offset=0.07, attack=0.06)


# ------------------------------------------------------------------------------------------------- SH15-SH17
def the_ascent(S):
    gust, lift, rel, ign = SYNC["gust"], SYNC["lift"], SYNC["release"], SYNC["ignite"]
    t0 = start("SH15")
    ost_dyn = [(t0, 0.3), (lift, 0.42), (start("SH16"), 0.52), (rel, 0.68)]
    segs = [(t0, gust + BEAT * 2, "D", "D3 D3 A2 D3 F#3 D3 A2 D3", "A3 D4 F#4"),
            (gust + BEAT * 2, start("SH16"), "G", "G2 G2 D3 G2 B2 G2 D3 G2", "B3 D4 G4"),
            (start("SH16"), rel - BEAT, "F#m", "F#2 F#2 C#3 F#2 A2 F#2 C#3 F#2", "A3 C#4 F#4"),
            (rel - BEAT, rel, "G", "G2 G2 D3 G2", "B3 D4 G4")]
    for k, (a, b, _name, pat, chord) in enumerate(segs):
        names = pat.split()
        t, i = a, 0
        while t < b - 1e-3:            # short bows from the sustain samples, celli + basses in octaves
            p = names[i % len(names)]
            S.strings(t, t + 0.2, [p], ost_dyn, release=0.1, offset=0.07, attack=0.006)
            S.strings(t, t + 0.2, [m(p) - 12], ost_dyn, release=0.1, offset=0.07, attack=0.006)
            t += BEAT / 2
            i += 1
        S.strings(a, b + 0.15, chord, [(a, 0.3 + 0.09 * k), (b, 0.36 + 0.09 * k)])
    # the climbing sixths on the horns: each lands on a picture beat (lift, ..., the release)
    pairs = [(gust, "A3", "F#4"), (gust + 2 * BEAT, "B3", "G4"), (start("SH16"), "C#4", "A4"), (rel - BEAT, "D4", "B4")]
    for k, (t, lo, hi) in enumerate(pairs):
        lay = "f" if k >= 2 else "mf"
        S.n("horns", t, lo, BEAT + 0.06, 78 + 8 * k, layer=lay)
        S.n("horns", t + BEAT, hi, (BEAT if k < 3 else 2.2 * BEAT) + 0.06, 84 + 8 * k, layer=lay, offset=0.07,
            attack=0.06)
    S.ev("timpani", gust, "timpani", m=m("D2"), vel=74)
    S.ev("timpani", lift, "timpani", m=m("D2"), vel=80)
    S.ev("swell", gust - 0.65, "cymbal_swell", dur=0.65, vel=72, ring=1.6)
    S.ev("swell", rel - 1.1, "cymbal_swell", dur=1.1, vel=92, ring=2.0)
    roll(S, start("SH16") + BEAT, rel, "G2", 36, 96)
    S.n("trombones", start("SH16"), "D3", rel - start("SH16") + 0.3, 92, layer="mf",
        env=lambda tt: np.clip(0.25 + 0.75 * tt / 2.0, 0, 1) ** 2)
    S.n("trombones", start("SH16"), "A3", rel - start("SH16") + 0.3, 90, layer="mf",
        env=lambda tt: np.clip(0.25 + 0.75 * tt / 2.0, 0, 1) ** 2)
    # the release: a bittersweet Em9, held high ... then the streak home
    S.strings(rel, start("SH17") + 0.2, "E2 B2 G3 D4 F#4 B4", [(rel, 0.7), (start("SH17"), 0.56)])
    S.n("piano", rel, "E1", 1.5, 56)
    S.n("piano", rel + 0.02, "E2", 1.5, 50)
    S.ped(rel - 0.04, start("SH17"))
    s17 = start("SH17")
    S.strings(s17, ign + 0.03, "A2 E3 A3 D4 E4", [(s17, 0.5), (ign - 0.2, 0.86), (ign, 0.9)], trem=True, release=0.06)
    rise = lambda tt, _d=ign - s17: 5.0 * smooth(tt / _d) ** 1.5
    S.strings(s17, ign + 0.03, "A4 D5", [(s17, 0.4), (ign, 0.8)], bend=rise, release=0.06)
    for j, p in enumerate("E4 A4 B4 D5 E5 A5 B5 D6 E6 A6 B6 D7".split()):
        S.ev("harp", s17 + 0.05 + j * (ign - s17 - 0.15) / 12, "pluck", m=m(p), vel=48 + 3 * j, kind="harp")
    roll(S, s17 + 0.05, ign - 0.03, "A2", 46, 116)
    S.ev("swell", ign - 1.2, "cymbal_swell", dur=1.2, vel=108, choke=True)
    # IGNITION: tutti on the theme's peak note (B over G), celesta + glockenspiel + chimes cascading
    S.strings(ign, B(20) + 0.1, "G1 G2 D3 B3 D4 G4", [(ign, 0.9), (B(20), 0.84)])
    for p, dyn in (("B5", 0.95), ("B4", 0.84)):
        S.strings(ign, B(20) + 0.08, [p], [(ign, dyn), (B(20), dyn - 0.04)], release=0.3)
    S.n("flute", ign, "B5", BEAT + 0.06, 96)
    S.n("horn", ign, "B4", BEAT + 0.06, 112, layer="f")
    S.seq("horns", ign, "G4+B4+D5:1.1", vel=108, layer="f")
    S.seq("trombones", ign, "G2+D3+B3:1.1", vel=108, layer="ff")
    S.n("tuba", ign, "G1", BEAT + 0.1, 104)
    for p in ("G1", "G2", "B4", "B5"):
        S.n("piano", ign, p, BEAT, 86)
    S.ev("timpani", ign, "timpani", m=m("G2"), vel=108)
    S.ev("cymbal", ign, "cymbal", vel=106, decay=4.5)
    S.ev("boom", ign, "boom", vel=84, f_hi=70.0, f_lo=45.0, decay=1.8)
    for k, (oct_, v) in enumerate(((0, 72), (-1, 62))):
        notes = "D7 B6 A6 F#6 E6 D6 B5 A5 F#5".split()
        for i, p in enumerate(notes):
            S.ev("celesta", ign + 0.02 + k * 0.05 + i * 0.07, "celesta", m=m(p) + 12 * oct_, vel=v - 2 * i)
            S.ev("glock", ign + 0.03 + k * 0.05 + i * 0.07, "glock", m=m(p) + 12 * oct_, vel=v - 8 - 2 * i)
    for i, p in enumerate(("D6", "A6", "F#6", "B6")):
        S.ev("crotale", ign + 0.1 + i * 0.15, "crotale_bow", m=m(p), dur=0.4, vel=62, attack=0.01, release=1.6)


# ------------------------------------------------------------------------------------------------- SH18-SH19
def resolution(S):
    b20 = B(20)
    # the theme's cadence completes: A G F# E -> D (over A7sus - A7 - D)
    line = "A5:.5 G5:.5 F#5:.5 E5:.5 D5:2"
    S.string_line(b20, line, [(b20, 0.82), (B(20, 3), 0.6), (B(20, 3) + 0.4, 0.34), (B(21), 0.26)])
    S.string_line(b20, line, [(b20, 0.72), (B(20, 3), 0.52), (B(20, 3) + 0.4, 0.3), (B(21), 0.22)], octave=-1)
    S.seq("flute", b20, "A5:.5@88 G5:.5@84 F#5:.5@80 E5:.5@76 D5:2@64", legato=True)
    S.seq("horn", b20, "A4:.5@100 G4:.5@96 F#4:.5@92 E4:.5@88 D4:2@76", legato=True, layer="f")
    S.strings(b20, B(20, 2) + 0.15, "A1 A2 E3 D4 G4", [(b20, 0.76), (B(20, 2), 0.72)])
    S.strings(B(20, 2), B(20, 3) + 0.15, "A2 E3 C#4 G4", [(B(20, 2), 0.72), (B(20, 3), 0.64)])
    S.strings(B(20, 3), B(21) + 0.25, "D2 A2 F#3 D4 A4", [(B(20, 3), 0.7), (B(20, 3) + 0.4, 0.34), (B(21), 0.26)])
    S.seq("trombones", b20, "A2+E3:2@96", layer="mf")
    S.arp(b20, "A1 E2 A2 C#3 D2 A2 F#3 A3", vel=56, accent=6)
    S.ev("timpani", B(20, 3), "timpani", m=m("D2"), vel=84)
    S.peds([b20, B(20, 2), B(20, 3), B(21)])
    # Claude's blink-blink, now lit gold
    S.blink(SYNC["blink_2"], vel=46)
    # SH19: the bookend — the star twinkles back; a last warm chord under the title; fade
    S.strings(B(21), B(21, 3) + 0.25, "G2 D3 B3 F#4 A4", [(B(21), 0.24), (B(21, 3), 0.22)])
    S.n("piano", B(21), "G2", 1.4, 34)
    for p in ("D3", "B3"):
        S.n("piano", B(21) + 0.03, p, 1.3, 27)
    S.strings(B(21, 3), B(22) + 0.25, "D2 A2 F#3 E4 A4", [(B(21, 3), 0.22), (B(22), 0.24)])
    S.twinkle(SYNC["twinkle_2"], vel=52)
    for j, p in enumerate("D3 A3 D4 F#4 A4 E5".split()):
        S.ev("harp", SYNC["title"] + j * 0.09, "pluck", m=m(p), vel=40 + 2 * j, kind="harp")
    S.strings(B(22), DURATION + 0.5, "D2 A2 F#3 C#4 E4 A4", [(B(22), 0.26), (DURATION, 0.16)])
    S.n("piano", B(22), "D1", DURATION - B(22) + 0.5, 40)
    for p in ("D2", "A3", "C#4", "E4", "F#4"):
        S.n("piano", B(22) + 0.04, p, DURATION - B(22) + 0.5, 30)
    S.peds([B(21), B(21, 3), B(22), DURATION + 0.5])
    S.seq("horn", B(22), "A3:1@60 F#4:3@64", legato=True, layer="mf")       # one last look up
    S.ev("celesta", B(22, 3) + 0.2, "celesta", m=m("A6"), vel=22)


def roll(S, t0, t1, pitch, v0, v1, rate=14.0, track="timpani"):
    """Timpani roll (single strokes at ~rate Hz with crescendo v0 -> v1)."""
    n = int((t1 - t0) * rate)
    r = np.random.default_rng(int(t0 * 100))
    for i in range(n):
        u = i / max(1, n - 1)
        S.ev(track, t0 + i / rate + r.normal(0, 0.006), "timpani", m=m(pitch), vel=float(v0 + (v1 - v0) * u ** 1.5 +
                                                                                          r.normal(0, 3)), seed=i)


def stab(S, t, piano_low, trb, hrn, vel=110, piano=True):
    """Short orchestral hit."""
    if piano:
        for p in piano_low.split():
            S.n("piano", t, p, 1.2, vel)
    for p in trb:
        S.n("trombones_stac", t, p, 0.35, vel, layer="ff" if vel > 100 else "mf")
    for p in hrn:
        S.n("horns_stac", t, p, 0.35, vel, layer="f" if vel > 90 else "mf")


PANS = {   # stage position (balance) of each track; sampled sections already carry their own stereo image
    "celesta": 0.25, "glock": -0.25, "harp": -0.35, "pizz": 0.3, "crotale": 0.15, "musicbox": 0.1, "flute": -0.2,
    "flute_stac": -0.2, "clarinet": 0.2, "clarinet_stac": 0.2, "horn": -0.15, "horns": -0.2, "horns_stac": -0.2,
    "trombones": 0.25, "trombones_stac": 0.25, "tuba": 0.35, "bass": 0.3, "timpani": -0.1, "harmonic": -0.1,
}

TRACKS = {   # track: (gain_db, hall send)
    "piano": (0.0, 0.20), "strings": (3.0, 0.30), "flute": (-9.0, 0.32), "flute_stac": (-8.0, 0.3),
    "clarinet": (-2.0, 0.3), "clarinet_stac": (-3.0, 0.28), "horn": (-2.0, 0.34), "horns": (-3.0, 0.34),
    "horns_stac": (-2.0, 0.3), "trombones": (-4.0, 0.3), "trombones_stac": (-3.0, 0.3), "tuba": (-4.0, 0.25),
    "bass": (-6.0, 0.15), "celesta": (-1.0, 0.38), "glock": (-6.0, 0.38), "musicbox": (-10.0, 0.12),
    "crotale": (-4.0, 0.45), "harmonic": (-6.0, 0.4), "pizz": (-3.0, 0.3), "harp": (-4.0, 0.35),
    "timpani": (-7.0, 0.3), "toms": (-5.0, 0.28), "boom": (-6.0, 0.12), "cymbal": (-10.0, 0.35),
    "swell": (-6.0, 0.35), "sleigh": (-8.0, 0.3), "sub": (-6.0, 0.0), "heart": (-3.0, 0.06),
}


def render_tracks(S, length=DURATION + 4.0):
    out = {}
    for k, (tr, notes) in enumerate(sorted(S.notes.items())):
        inst = SM.instrument(tr)
        # humanised (deterministic): ~6 ms timing, +-3 velocity; no rubato. Strings carry dynamics in curves.
        notes = SM.humanize(sorted(notes, key=lambda n: n.t), seed=100 + k, t_ms=6.0, vel=0.0 if tr == "strings" else 3.0)
        out[tr] = SM.render_notes(inst, notes, length, pedal=sorted(S.pedal) if tr == "piano" else None)
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
        if tr == "piano":           # the spaced-pair Steinway is very wide: focus it a little (M/S, side x0.75)
            mid, side = (y[:, 0] + y[:, 1]) / 2, (y[:, 0] - y[:, 1]) / 2 * 0.75
            y = np.stack([mid + side, mid - side], axis=1)
        p = PANS.get(tr, 0.0)
        if p:
            y = y * np.array([np.sqrt(1 - p), np.sqrt(1 + p)], np.float32)
        dry[:len(y)] += y
        send[:len(y)] += y * s
    # stage EQ: tame low-mid mud a little, a touch of air
    dry = dsp.eq(dry, [("hp", 34, 0.7, 0), ("hp", 34, 0.7, 0), ("peak", 280, 0.9, -1.5), ("highshelf", 9000, 0.7, 1.0)])
    hall = dsp.make_ir(2.4, predelay=0.024, seed=7, er=dict(n=14, spread=0.06, gain=0.45), hf_damp=0.5, width=1.0)
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


def render_segmented(S, length=DURATION + 4.0, fade=0.04):
    """Render between MUSIC_CUTS: each segment (with its hall reverb) is cut dead at the next cut point, so a cut is
    a real cut (shutters closing, smash cuts) instead of a reverb tail."""
    n = int(length * SR)
    bounds = [0.0] + sorted(MUSIC_CUTS) + [length]
    mix = np.zeros((n, 2), np.float32)
    stems_all = {}
    k = int(fade * SR)
    for t0, t1 in zip(bounds[:-1], bounds[1:]):
        stems = render_tracks(split(S, t0, t1), length)
        seg = mixdown(stems, length)
        j = int(t1 * SR)
        if j < n:
            seg[j:] = 0.0
            seg[max(0, j - k):j] *= np.linspace(1, 0, min(k, j))[:, None]
        mix += seg[:n]
        for tr, y in stems.items():
            if j < n:
                y[j:] = 0.0
            stems_all[tr] = stems_all.get(tr, 0) + y
    return mix, stems_all


def main():
    S = compose()
    n_notes = sum(len(v) for v in S.notes.values()) + sum(len(v) for v in S.events.values())
    print(f"score: {n_notes} notes/events in {len(S.notes) + len(S.events)} tracks")
    mix, stems = render_segmented(S)
    mix = mix[:int(DURATION * SR) + int(2.0 * SR)]
    pk = float(np.max(np.abs(mix)))
    target = dsp.db(-3.0)
    if pk > target:
        mix *= target / pk
    os.makedirs(OUT, exist_ok=True)
    dsp.write_wav(os.path.join(OUT, "score.wav"), mix)
    groups = {"piano": ["piano"], "strings": ["strings"],
              "winds": ["flute", "flute_stac", "clarinet", "clarinet_stac"],
              "brass": ["horn", "horns", "horns_stac", "trombones", "trombones_stac", "tuba"],
              "mallets": ["celesta", "glock", "musicbox", "crotale", "harmonic", "harp", "pizz", "bass"],
              "perc": ["timpani", "toms", "boom", "cymbal", "swell", "sleigh", "sub", "heart"]}
    for gname, trs in groups.items():
        acc = sum((stems[t] * dsp.db(TRACKS[t][0]) for t in trs if t in stems), np.zeros((1, 2), np.float32))
        if np.ndim(acc) == 2 and len(acc) > 1:
            dsp.save_stem(os.path.join(SM.CACHE, "stems", f"{gname}.npy"), acc[:len(mix)])
    print(f"wrote {os.path.join(OUT, 'score.wav')}  peak {dsp.to_db(pk):.1f} dBFS (pre-trim)")


if __name__ == "__main__":
    main()
