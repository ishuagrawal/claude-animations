""""Looking Up" — original score, written as data and rendered at 48 kHz stereo to out/audio/score.wav.

Material (all original):
  THEME "Looking Up" (8 bars + pickup, C major). Each phrase opens with an upward sixth — the leap up is the act of
    looking up — and the second half climbs to the high A before coming home:
      pickup G4 | E5 . . D5 C5 | D5 . . A4 | F5 . . E5 D5 | E5 . D5 G4 | E5 . . D5 C5 | D5 . . G5 | A5 . . G5 E5 |
      D5 . E5 C5 ||   (harmony C | G/B | F/A | Gsus-G | C | G/B | F | G7sus-C, bass walking C-B-A-G)
    first heard as its two opening notes (S01), as unresolved fragments (S02-S04), complete from S13.
  STAR motif: four celesta notes stacked in fifths G-D-A-E. In the sky (constellation without its eye) the last note
    is missing; it is completed when the star ignites into the empty eye (L07).
  BLINK-BLINK: falling major third E-C, two soft celesta notes exactly on the two blinks (Claude low, star an octave
    higher).
Sections follow src/timeline.py bars; sync points come from cues.py.
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
from cues import SYNC, DURATION, MUSIC_CUTS, at  # noqa: E402
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


# THEME (beats relative to the downbeat of theme bar 1; the pickup is at -1)
THEME = [(-1, "G4", 1), (0, "E5", 3), (3, "D5", .5), (3.5, "C5", .5), (4, "D5", 3), (7, "A4", 1),
         (8, "F5", 3), (11, "E5", .5), (11.5, "D5", .5), (12, "E5", 2), (14, "D5", 1), (15, "G4", 1),
         (16, "E5", 3), (19, "D5", .5), (19.5, "C5", .5), (20, "D5", 3), (23, "G5", 1),
         (24, "A5", 3), (27, "G5", .5), (27.5, "E5", .5), (28, "D5", 1.5), (29.5, "E5", .5), (30, "C5", 2)]
STAR = ["G6", "D7", "A6", "E7"]          # the star motif (sky version omits the last note)


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
    def star(self, t, octave=0, vel=52, step=0.25, sky=False, track="celesta", n=4):
        notes = STAR[:3] if sky else STAR[:n]
        for i, p in enumerate(notes):
            self.ev(track, t + i * step * BEAT, track, m=m(p) + 12 * octave,
                    vel=vel + (6 if i == len(notes) - 1 else 0) - 3 * (i % 2))

    def blink(self, times, high=False, vel=50):
        """Blink-blink: falling third E-C exactly on the two blinks (star = an octave higher, with glock halo)."""
        a, b = ("E6", "C6") if high else ("E5", "C5")
        self.ev("celesta", times[0], "celesta", m=m(a), vel=vel)
        self.ev("celesta", times[1], "celesta", m=m(b), vel=vel - 5)
        if high:
            self.ev("glock", times[0], "glock", m=m(a) + 12, vel=vel - 22)
            self.ev("glock", times[1], "glock", m=m(b) + 12, vel=vel - 26)


# ======================================================================================================== THE SCORE
def compose():
    S = Score()
    act1(S)
    montage(S)
    dimming(S)
    holding(S)
    letting_go(S)
    coda(S)
    return S


# ------------------------------------------------------------------------------------------------- ACT 1
def act1(S):
    # ---- S01 (bars 1-3.5): dusk. Open fifths, then only the theme's first two notes; strings from bar 2.
    S.n("piano", B(1, 2), "C2", 3 * BEAT, 40)
    S.n("piano", B(1, 2), "G2", 3 * BEAT, 36)
    S.n("piano", B(1, 3), "G3", 2 * BEAT, 30)
    S.n("piano", B(1, 3), "D4", 2 * BEAT, 28)
    S.n("piano", B(2, 1), "C3", 2 * BEAT, 32)
    S.n("piano", B(2, 1), "G4", 1 * BEAT, 46)
    S.n("piano", B(2, 2), "E5", 3 * BEAT, 54)
    S.n("piano", B(3, 1), "F2", 2 * BEAT, 36)
    S.n("piano", B(3, 1), "C3", 2 * BEAT, 32)
    S.n("piano", B(3, 1), "G3", 2 * BEAT, 28)
    S.peds([B(1, 2), B(3, 1), B(3, 3)])
    S.strings(B(2, 1), B(3, 1) + 0.25, "C3 G3 E4", [(B(2, 1), 0.02), (B(2, 4), 0.2), (B(3, 1), 0.18)])
    S.strings(B(3, 1), B(4, 1), "F2 C3 A3", [(B(3, 1), 0.18), (B(3, 3), 0.12), (B(4, 1), 0.06)])

    # ---- S02-S04 (bars 3.5-7.75): the walking routine; fragments that never resolve
    walk = [(B(3, 3), "A2"), (B(3, 4), "E3"),
            (B(4, 1), "F2"), (B(4, 2), "C3"), (B(4, 3), "A3"), (B(4, 4), "C3"),
            (B(5, 1), "C3"), (B(5, 2), "G3"), (B(5, 3), "E3"), (B(5, 4), "G3"),
            (B(6, 1), "A2"), (B(6, 2), "E3"), (B(6, 3), "C4"), (B(6, 4), "E3"),
            (B(7, 1), "G2")]
    for i, (t, p) in enumerate(walk):
        S.n("piano", t, p, 0.72 * BEAT if i < len(walk) - 1 else 1.6, 38 + (5 if i % 4 == 0 else 0))
    S.n("piano", B(7, 1), "D3", 1.6, 30)
    # S02: theme opening again ... stops on D5 (no pickup to bar 3)
    S.seq("piano", B(3, 4), "G4:1@44 E5:3@50 D5:.5@44 C5:.5@40 D5:2.5@46", hold=0.95)
    # S03: lower, in the minor (E4 -> C5: the empty stool), B4 A4 ... B4 left hanging as the shutters close
    S.seq("piano", B(6, 1), "E4:1@40 C5:2.5@46 B4:.25@38 A4:.25@36 B4:3@42", hold=0.95)
    S.ped(B(7, 1), SYNC["S04_thunk"] + 0.6)
    # a very soft cello line underneath
    for (b, p) in ((4, "F2"), (5, "C3"), (6, "A2")):
        S.strings(B(b, 1), B(b + 1, 1) + 0.15, [p], [(B(b, 1), 0.05), (B(b, 2.5), 0.1), (B(b + 1, 1), 0.07)])
    S.strings(B(7, 1), B(7, 1) + 1.9, ["G2"], [(B(7, 1), 0.07), (B(7, 1) + 1.9, 0.0)])

    # ---- S05 (bars 7.75-9.5): lamp out, tilt up — strings swell (Fmaj9 -> Gsus), the star motif without its eye
    S.strings(B(8, 2), B(9, 1) + 0.3, "F2 C3 A3 E4 G4", [(B(8, 2), 0.0), (B(8, 4), 0.3), (B(9, 1), 0.38)])
    S.strings(B(9, 1), B(9, 3) + 0.3, "G2 D3 C4 D4 A4", [(B(9, 1), 0.38), (B(9, 2), 0.28), (B(9, 3) - 0.3, 0.1),
                                                       (B(9, 3) + 0.3, 0.0)], release=0.4)
    harp_up = "F3 A3 C4 E4 G4 A4 C5 E5 G5 A5 C6 E6".split()
    for i, p in enumerate(harp_up):
        S.ev("harp", SYNC["S05_lamp_out"] + 0.55 + i * 0.17, "pluck", m=m(p), vel=34 + i, kind="harp")
    S.star(B(8, 4) + 0.1, octave=0, vel=46, sky=True)
    S.star(B(9, 2) + 0.05, octave=-1, vel=36, sky=True)

    # ---- S06 (bars 9.5-10.5): near-silence, cold harmonics, meteor glints through the slats
    S.ev("harmonic", B(9.5), "harmonic", m=m("D6"), dur=3.6, vel=12)
    S.ev("harmonic", B(9.5) + 0.4, "harmonic", m=m("A6"), dur=3.2, vel=9, seed=2)
    for i, t in enumerate(SYNC["S06_flicker"]):
        for j, p in enumerate(("E7", "B6", "F#6")):
            S.ev("celesta", t + 0.05 + j * 0.07, "celesta", m=m(p), vel=12 - 1.5 * j)
        S.ev("crotale", t, "crotale_bow", m=m("B6") - 2 * (i % 2), dur=0.35, vel=11, attack=0.15, release=0.6)

    # ---- S07 (bars 10.5-11.5): the hero meteor — rising string glissando, timpani roll, cymbal swell
    hero, hit = SYNC["S07_hero"], SYNC["S07_hit"]
    gl = hit - hero
    bend = lambda tt, _g=gl: 9.0 * smooth(tt / _g) ** 1.3
    S.strings(hero, hit + 0.05, "C4 D4 G4 A4", [(hero, 0.12), (hit - 0.3, 0.8), (hit, 0.9)], bend=bend,
              release=0.08)
    S.strings(hero + 0.4, hit + 0.05, "C3 G3", [(hero + 0.4, 0.1), (hit, 0.75)], trem=True, release=0.08)
    S.ev("swell", hit - 1.5, "cymbal_swell", dur=1.5, vel=95, choke=True)
    roll(S, hero + 0.3, hit, "C2", 40, 100)
    stab(S, hit, "C2 G2 C3", ["C3", "G3"], ["C4", "Db4"], vel=96, piano=False)

    # ---- S08 (bars 11.5-12.25): the crash — BIG hit on the landing, then ringing
    land = SYNC["S08_land"]
    S.ev("swell", SYNC["S08_burst"], "cymbal_swell", dur=land - SYNC["S08_burst"], vel=80, choke=True)
    S.ev("boom", land, "boom", vel=124)
    S.ev("timpani", land, "timpani", m=m("C2"), vel=124)
    S.ev("timpani", land + 0.01, "timpani", m=m("G2"), vel=112)
    S.ev("cymbal", land, "cymbal", vel=112, decay=4.0)
    stab(S, land, "C1 G1 C2 Db2 G2", ["C3", "G3"], ["C4", "Db4", "G4"], vel=112, piano=True)
    S.strings(land, land + 0.3, "C3 G3 C4 Db4", [(land, 0.95), (land + 0.3, 0.6)], release=0.6)
    S.ped(land - 0.04, land + 2.0)
    S.ev("harmonic", land + 0.25, "harmonic", m=m("C7"), dur=1.4, vel=30, attack=0.05, release=0.8)

    # ---- S09 (bars 12.25-13.75): creeping — tiptoe pizzicato over a low tremolo; stinger on the flare
    flare = SYNC["S09_flare"]
    S.strings(B(12.25), B(13.75) + 0.3, "E2 B2", [(B(12.25), 0.1), (flare - 0.1, 0.2), (flare + 0.4, 0.14),
                                                 (B(13.75), 0.2)], trem=True)
    tiptoe = [(B(12, 2), "E3", 62), (B(12, 3), "F3", 58), (B(12, 4), "E3", 60), (B(12, 4.5), "D#3", 64),
              (B(13, 1.5), "E3", 52), (B(13, 2.5), "F3", 56), (B(13, 3), "E3", 54), (B(13, 3.5), "F#3", 60),
              (B(13, 4) - 0.05, "G3", 64)]
    for t, p, v in tiptoe:
        S.ev("pizz", t, "pluck", m=m(p), vel=v, kind="pizz")
    for t in (B(12, 2), B(12, 4), B(13, 2.5)):
        S.ev("pizz", t, "pluck", m=m("E2"), vel=58, kind="pizz", seed=3)
    S.strings(flare, flare + 0.28, "E3 B3 F4 C5", [(flare, 0.85), (flare + 0.28, 0.4)], release=0.25)
    S.n("horns_stac", flare, "B3", 0.3, 100, layer="f")
    S.n("horns_stac", flare, "C4", 0.3, 96, layer="f")
    S.ev("timpani", flare, "timpani", m=m("E2"), vel=100)

    # ---- S10 (bars 13.75-15): the reveal — the star's own motif, complete but fragile (slow, trembling)
    t0 = B(13.75)
    S.strings(t0, B(15) + 0.6, "C3", [(t0, 0.0), (t0 + 1.0, 0.1), (B(15), 0.06), (B(15) + 0.6, 0.0)])
    S.ev("harmonic", t0 + 0.2, "harmonic", m=m("E6"), dur=3.6, vel=34)
    S.ev("harmonic", t0 + 0.5, "harmonic", m=m("B5"), dur=3.3, vel=30, seed=5)
    for i, p in enumerate(STAR):
        t = t0 + 0.45 + i * 0.5 * BEAT
        S.ev("celesta", t, "celesta", m=m(p) - 12, vel=44)
        S.ev("celesta", t + 0.075, "celesta", m=m(p) - 12, vel=20)        # the tremble
    S.star(SYNC["S10_look_up"] - 0.05, octave=0, vel=40, step=0.25)
    S.strings(SYNC["S10_look_up"], B(15) + 0.4, "E4 G4 B4", [(SYNC["S10_look_up"], 0.0), (SYNC["S10_look_up"] + 0.8, 0.16),
                                                          (B(15), 0.08), (B(15) + 0.4, 0.0)])

    # ---- S11 (bars 15-16.25): silence before the reach; HISS stab; comic shaking (bassoon-ish clarinet + pizz)
    hiss = SYNC["S11_hiss"]
    S.strings(hiss, hiss + 0.22, "C5 C#5 G5", [(hiss, 0.9), (hiss + 0.22, 0.5)], release=0.15)
    for p in ("C6", "C#6", "F#6"):
        S.n("piano", hiss, p, 0.15, 86)
    S.n("horns_stac", hiss, "F#4", 0.25, 92, layer="f")
    S.n("horns_stac", hiss, "G4", 0.25, 88, layer="f")
    S.ev("pizz", hiss, "pluck", m=m("C#5"), vel=96, kind="pizz")
    shake = hiss + 0.45
    for i, p in enumerate(("D3", "F3", "D3", "F3", "D3", "F3")):
        S.n("clarinet_stac", shake + i * 0.15, p, 0.12, 74 - 2 * i, layer="mp")
        if i % 2 == 0:
            S.ev("pizz", shake + i * 0.15, "pluck", m=m(p) + 12, vel=60, kind="pizz")
    S.seq("clarinet", hiss + 1.55, "C4:.6@70 B3:1.1@62", legato=True)
    S.n("flute_stac", hiss + 2.25, "G5", 0.1, 60, layer="mp")
    S.n("flute_stac", hiss + 2.42, "G5", 0.1, 52, layer="mp")

    # ---- S12 (bars 16.25-17.5): the offering — tender piano
    S.n("piano", B(16, 2), "A2", 2.5, 38)
    S.arp(B(16, 2.5), "E3 B3 C4 E4 r", vel=34, accent=0)
    S.seq("piano", B(16, 4), "E5:.5@44 D5:.5@40", hold=1.0)
    S.n("piano", B(17, 1), "F2", 2.0, 36)
    S.n("piano", B(17, 1), "C3", 2.0, 30)
    S.n("piano", B(17, 1), "A3", 2.0, 30)
    S.seq("piano", B(17, 1), "C5:1@44 A4:1@38", hold=1.0)
    S.peds([B(16, 2), B(17, 1), B(17, 3)])
    S.strings(B(16.5), B(17.5) + 0.4, "A2 E3", [(B(16.5), 0.0), (B(17), 0.1), (B(17.5), 0.06)])


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


# ------------------------------------------------------------------------------------------------- MONTAGE
def montage(S):
    T1 = B(18)          # statement 1: theme bar 1 downbeat (pickup in S13)
    T2 = B(27)          # statement 2 (no pickup: grows out of the goodnight)
    # ---- S13 dawn (bars 17.5-19): first complete statement begins — piano + warm strings, soft
    S.n("piano", B(17.5), "C2", 1.6 * BEAT, 34)
    S.n("piano", B(17.5), "G2", 1.6 * BEAT, 30)
    S.theme("piano", T1, -1, 16, vel=56)
    S.arp(B(18), "C3 G3 E4 G3", vel=34, step=1.0, dur=1.0, accent=4)
    S.arp(B(19), "B2 G3 D4 G3", vel=34, step=1.0, dur=1.0, accent=4)
    S.strings(B(17.5), B(19) + 0.2, "C3 G3 E4", [(B(17.5), 0.0), (B(18), 0.22), (B(19), 0.25)])
    S.strings(B(18), B(19) + 0.2, "D4", [(B(18), 0.0), (B(18.5), 0.15), (B(19), 0.15)])
    S.strings(B(19), B(20) + 0.2, "B2 D3 G3 B3", 0.26)
    # M01 -> M02: the 8th-note accompaniment starts to flow
    S.arp(B(20), "A1 F2 C3 F3 A3 F3 C3 F2", vel=40)
    S.arp(B(21), "G1 D2 G2 C3 G1 D2 G2 B2", vel=40)
    S.strings(B(20), B(21) + 0.2, "A2 F3 C4", 0.28)
    S.strings(B(21), B(21, 3) + 0.2, "G2 D3 C4", 0.28)
    S.strings(B(21, 3), B(22) + 0.2, "G2 D3 B3", 0.3)
    for t in SYNC["M02_taps"]:           # the hammer taps, picked up by pizz + glock ticks
        S.ev("pizz", t, "pluck", m=m("C5"), vel=50, kind="pizz")
        S.ev("glock", t, "glock", m=m("C7"), vel=30)
    S.star(SYNC["M02_in"], vel=46, step=0.2)          # fits perfectly
    S.strings(SYNC["M02_in"], B(22) + 0.2, "E5", [(SYNC["M02_in"], 0.0), (SYNC["M02_in"] + 0.8, 0.22), (B(22), 0.18)])
    S.peds([B(17.5), B(18), B(19), B(20), B(21), B(21, 3), B(22)])

    # ---- M03-M05 (bars 21.75-25.75): phrase B — playful & building, the loop, the night resolution
    S.theme("piano", T1, 15, 32, vel=62)
    S.arp(B(22), "C2 G2 E3 G3 C4 G3 E3 G2", vel=46)
    S.arp(B(23), "B1 G2 D3 G3 B3 G3 D3 G2", vel=48)
    S.arp(B(24), "F1 C2 A2 E3 A3 E3 C3 A2", vel=52)
    S.arp(B(25), "G1 D2 F2 C3 C2 G2 D3 E3", vel=42)
    S.peds([B(22), B(23), B(24), B(25), B(25, 3), B(25.75)])
    for (b, p) in ((22, "C2"), (22.5, "G2"), (23, "B1"), (23.5, "G2")):          # bouncing bass
        S.n("bass", B(b), p, 0.5 * BEAT, 78)
    # star tumbles (falling flute figures) and the lift (rising run)
    for t in SYNC["M03_falls"]:
        S.seq("flute_stac", t - 0.3, "C6:.125 A5:.125 F5:.125 D5:.125", vel=70, layer="mp")
    S.seq("flute", SYNC["M03_lift"] - 0.55, "G5:.125 A5:.125 B5:.125 C6:.125 D6:.125 E6:1.4", vel=78, legato=True)
    S.seq("clarinet", B(22, 2), "G4:.5@60 A4:.5@62 C5:1@66 | r:1 B4:1@62 A4:.5@58 G4:.5@56", legato=True)
    S.strings(B(22), B(23) + 0.2, "C3 G3 E4", [(B(22), 0.3), (B(23), 0.36)])
    S.strings(B(23), B(24) + 0.2, "B2 G3 D4", [(B(23), 0.36), (B(24), 0.5)])
    # M04 the loop: flute circles, swell to the peak A5 (bar 24)
    S.seq("flute", B(23.25), "E6:.5 D6:.5 C6:.5 D6:.5 E6:.5 G6:.5", vel=64, legato=True)
    S.seq("flute", B(24), "A5:3 G5:.5 E5:.5", vel=70, legato=True)
    S.strings(B(24), B(25) + 0.2, "F2 C3 A3 E4", [(B(24), 0.58), (B(24, 3), 0.45), (B(25), 0.32)])
    S.theme_strings(T1, 24, 28, [(B(24), 0.5), (B(25), 0.35)])
    S.n("clarinet", SYNC["M04_dizzy"] + 0.05, "A4", 1.0, 62, bend=lambda tt: 0.9 * np.sin(2 * np.pi * 2.2 * tt))
    # M05 night: softer, the resolution lands with the fond look
    S.strings(B(25), B(25, 3) + 0.2, "G2 F3 C4", [(B(25), 0.3), (B(25, 3), 0.25)])
    S.strings(B(25, 3), B(25.75) + 0.5, "C3 G3 E4", [(B(25, 3), 0.25), (B(25.75) + 0.5, 0.0)])
    S.seq("clarinet", B(25), "E4:2@56 D4:.5@52 C4:1.5@48", legato=True)

    # ---- M06 (bars 25.75-27.25): the goodnight ritual — solo piano, blink-blink
    S.n("piano", B(25.75), "A2", 2.2, 34)
    for p in ("E3", "G3", "C4"):
        S.n("piano", B(25.75) + 0.05, p, 2.0, 28)
    S.blink(SYNC["M06_blink_claude"], high=False, vel=48)
    S.n("piano", B(26.5), "F2", 2.0, 32)
    for p in ("C3", "E3", "A3"):
        S.n("piano", B(26.5) + 0.05, p, 1.8, 27)
    S.blink(SYNC["M06_blink_star"], high=True, vel=46)
    S.peds([B(25.75), B(26.5), B(27)])

    # ---- statement 2 (bars 27-34): winter bells, longing, snowball, fireflies, the cliff
    S.theme("piano", T2, 0, 15, vel=58)
    S.arp(B(27), "C2 G2 D3 E3 G3 E3 D3 G2", vel=40)
    S.arp(B(28), "B1 E2 G2 D3 G3 D3 G2 E2", vel=40)
    S.peds([B(27), B(28), B(29), B(30), B(30, 3), B(31)])
    # M07 winter: glockenspiel doubles, sleigh-bell shimmer, dust sparkle on the yank
    for (o, p, d) in theme_slice(0, 8):
        S.ev("glock", T2 + o * BEAT, "glock", m=m(p) + 12, vel=38)
    S.ev("sleigh", B(27.25), "sleigh", dur=4.0, vel=40)
    for i, p in enumerate(("E7", "D7", "B6", "A6", "G6", "E6", "D6")):
        S.ev("celesta", SYNC["M07_yank"] + i * 0.06, "celesta", m=m(p), vel=44 - 3 * i)
    S.n("clarinet_stac", SYNC["M07_sneeze"] + 0.02, "C3", 0.1, 72, layer="mp")
    S.star(SYNC["M07_peek"], vel=40)
    S.strings(B(27.25), B(28.5) + 0.3, "B4 E5 G5", [(B(27.25), 0.0), (B(27.75), 0.2), (B(28.5), 0.22)])
    # M08 longing: full strings swell; Dm9 under the minor-sixth leap, the borrowed Bbmaj7(#11) ache
    S.arp(B(29), "D2 A2 F3 C4 E4 C4 F3 A2", vel=44)
    S.arp(B(30), "Bb1 F2 D3 A3 G1 D2 B2 F3", vel=44)
    S.strings(B(28.5), B(29) + 0.2, "E3 B3 G4", [(B(28.5), 0.22), (B(29), 0.32)])
    S.strings(B(29), B(30) + 0.25, "D2 A2 F3 C4 E4", [(B(29), 0.32), (B(29, 3), 0.62), (B(30), 0.5)])
    S.strings(B(30), B(30, 3) + 0.25, "Bb1 F2 D3 A3 E4", [(B(30), 0.55), (B(30, 3), 0.42)])
    S.strings(B(30, 3), B(31) + 0.2, "G2 D3 B3 F4", [(B(30, 3), 0.42), (B(31), 0.2)])
    S.string_line(B(29), "D3:2 C3:2 | Bb2:2 B2:2", [(B(29), 0.3), (B(29, 3), 0.55), (B(31), 0.3)])
    S.theme_strings(T2, 7, 15, [(B(28.75), 0.25), (B(29, 3), 0.55), (B(30), 0.5), (B(30, 3), 0.35)])
    # M09 playful: staccato woodwinds, pizz bass, giggles
    S.theme("piano", T2, 15, 23, vel=60)
    S.arp(B(31), "C2 r G2 r E3 r G2 r", vel=48, dur=0.4)
    S.peds([B(31), B(31, 3), B(32)])
    for (b, p) in ((31, "C2"), (31.5, "G2")):
        S.n("bass", B(b), p, 0.5 * BEAT, 80)
    S.seq("clarinet_stac", B(31, 2), "C5:.5 E5:.5 G5:.5 E5:.5", vel=64, layer="mp")
    S.seq("flute_stac", SYNC["M09_melt"] + 0.6, "E6:.25 D6:.25 E6:.25 D6:.25 C6:.5", vel=66, layer="mp")
    S.ev("pizz", SYNC["M09_melt"], "pluck", m=m("G5"), vel=70, kind="pizz")
    # M10 fireflies: celesta twinkles that stop when the star droops; warm swell when Claude scoops it up
    r = np.random.default_rng(10)
    pent = [m(p) for p in ("G6", "A6", "B6", "D7", "E7", "G7")]
    t = at("M10", 0.1)
    while t < SYNC["M10_droop"] - 0.2:
        S.ev("celesta", t, "celesta", m=int(r.choice(pent)), vel=float(r.uniform(26, 40)))
        t += float(r.uniform(0.18, 0.42))
    S.arp(B(32), "B1 G2 D3 G3 E2 B2 D3 G3", vel=40)
    S.peds([B(32), B(32, 3), B(33)])
    S.strings(B(31.75), SYNC["M10_droop"] + 0.3, "G3 D4 B4", [(B(31.75), 0.15), (SYNC["M10_droop"], 0.22)])
    S.strings(SYNC["M10_droop"], SYNC["M10_scoop"] + 0.2, "E3 B3 G4", [(SYNC["M10_droop"], 0.2), (SYNC["M10_scoop"], 0.15)])
    S.strings(SYNC["M10_scoop"], B(33) + 0.2, "G2 D3 B3 F4", [(SYNC["M10_scoop"], 0.15), (B(33), 0.62)])
    S.theme_strings(T2, 23, 24, [(B(32, 4), 0.5), (B(33), 0.7)])
    S.ev("swell", SYNC["M10_scoop"], "cymbal_swell", dur=B(33) - SYNC["M10_scoop"], vel=86, ring=2.4)

    # ---- M11 (bars 33-35): montage climax — full strings + horn, theme high and warm, then settle
    S.theme("piano", T2, 23, 32, vel=80)
    S.theme("piano", T2, 24, 32, vel=68, octave=-1)
    S.theme_strings(T2, 24, 32, [(B(33), 0.92), (B(34), 0.86), (B(34, 3), 0.66), (B(35), 0.4)])
    S.theme_strings(T2, 24, 32, [(B(33), 0.8), (B(34), 0.74), (B(34, 3), 0.55), (B(35), 0.3)], octave=-1)
    S.strings(B(33), B(34) + 0.25, "F2 C3 A3 C4 F4", [(B(33), 0.88), (B(34), 0.76)])
    S.strings(B(34), B(34, 3) + 0.25, "G2 D3 F3 C4", [(B(34), 0.72), (B(34, 3), 0.62)])
    S.strings(B(34, 3), B(35) + 1.2, "C2 G2 E3 D4 G4", [(B(34, 3), 0.62), (B(35), 0.32), (B(35) + 1.2, 0.0)])
    S.seq("horn", B(33), "A4:3@106 G4:.5@98 E4:.5@96 | D4:1.5@98 E4:.5@94 C4:1@92", legato=True, layer="f")
    S.seq("horns", B(33), "C4+F4:4@96 | D4+G4:2@90 C4+E4:2@84", legato=False, layer="f")
    S.seq("flute", B(33), "A5:3@76 G5:.5@72 E5:.5@70 | D5:1.5@72 E5:.5@70 C5:2@66", legato=True)
    S.seq("horn", B(34, 4), "G3:1@66 E4:2@68", legato=True, layer="mf")       # the looking-up echo
    S.arp(B(33), "F1 C2 A2 C3 F3 C3 A2 C2", vel=58)
    S.arp(B(34), "G1 D2 F2 C3 C2 G2 E3 G3", vel=54)
    S.n("piano", B(34, 3), "C2", 2.0, 50)
    S.peds([B(33), B(34), B(34, 3), B(35)])
    S.ev("timpani", B(33), "timpani", m=m("F2"), vel=90)
    S.ev("timpani", B(34, 3), "timpani", m=m("C2"), vel=66)


# ------------------------------------------------------------------------------------------------- DIMMING (A minor)
def dimming(S):
    # D01-D02: the theme in A minor, slow and sparse; a lamenting bass A - G# - F - E
    S.n("piano", B(35), "A2", 3.2, 34)
    S.n("piano", B(35), "E3", 3.2, 28)
    S.seq("piano", B(35), "E4:1@42 C5:3@48 | B4:3@44 F4:1@38 | D5:3@46 C5:.5@40 B4:.5@38 | C5:2@42 B4:2@38", hold=0.97)
    S.n("piano", B(36), "G#2", 3.2, 32)
    S.n("piano", B(37), "F2", 3.2, 32)
    S.n("piano", B(37), "C3", 3.0, 26)
    S.peds([B(35), B(36), B(37), B(38)])
    S.strings(B(35), B(36) + 0.3, "A2", [(B(35), 0.0), (B(35, 2), 0.2), (B(36), 0.2)])
    S.strings(B(36), B(37) + 0.3, "G#2", 0.2)
    S.strings(B(37), B(38) + 0.3, "F2", [(B(37), 0.2), (B(38), 0.22)])
    S.strings(B(35.5), B(36.5) + 0.3, "E3 C4", [(B(35.5), 0.0), (B(36), 0.12), (B(36.5), 0.1)])
    # D02: the brave face (a forced bright sparkle on E) ... the mask slips (the motif sinks)
    for i, p in enumerate(("E6", "B6", "E7", "B6")):
        S.ev("celesta", SYNC["D02_brave"] + i * 0.12, "celesta", m=m(p), vel=44 - 2 * i)
    for i, p in enumerate(("A6", "E6", "D6", "A5")):
        S.ev("celesta", SYNC["D02_slip"] + i * 0.42, "celesta", m=m(p), vel=40 - 4 * i)
    # D03 (bars 38-40): realisation — a held E7sus4 that never resolves; the sky motif still has no eye
    S.strings(B(38), B(40) + 0.6, "E2 B2 A3 D4 E4", [(B(38), 0.2), (SYNC["D03_turn"], 0.24),
                                                    (SYNC["D03_turn"] + 2.0, 0.34), (B(40), 0.22),
                                                    (B(40) + 0.6, 0.0)])
    S.star(SYNC["D03_eyepiece"], octave=0, vel=36, sky=True, step=0.5)
    S.n("piano", B(38), "E2", 3.0, 36)
    S.n("piano", SYNC["D03_turn"], "E1", 3.5, 40)
    S.peds([B(38), SYNC["D03_turn"], B(40) - 0.1])
    # D04 (bars 40-41.5): hope — the theme tries the major ... and the borrowed minor iv takes it away
    S.n("piano", B(40), "C3", 3.0, 36)
    S.n("piano", B(40), "G3", 3.0, 30)
    S.n("piano", B(40), "E4", 3.0, 30)
    S.seq("piano", B(40), "G4:1@46 E5:2@52 D5:.5@44 C5:.5@42 | D5:1@44 C5:2.5@40", hold=0.97)
    S.n("piano", B(41), "Ab2", 3.0, 34)
    S.n("piano", B(41), "F3", 2.8, 28)
    S.n("piano", B(41), "C4", 2.8, 26)
    S.peds([B(40), B(41), B(41.5) + 0.4])
    S.strings(B(40), B(41) + 0.3, "C3 G3 E4", [(B(40), 0.05), (B(40, 3), 0.18), (B(41), 0.16)])
    S.strings(B(41), B(41.5) + 0.8, "Ab2 F3 C4", [(B(41), 0.16), (B(41.5), 0.12), (B(41.5) + 0.8, 0.04)])


# ------------------------------------------------------------------------------------------------- HOLDING ON
def holding(S):
    h1 = B(41.5)
    # H01: the meteors return — low drone on C, shimmering lydian glints
    S.strings(h1, B(43.75) + 0.2, "C2 G2", [(h1, 0.05), (h1 + 1.5, 0.22), (B(42.5), 0.25), (B(43.75), 0.35)])
    S.ev("sub", h1, "sub", m=m("C2"), dur=B(43.75) - h1 + 1.6, vel=70)
    S.ev("crotale", h1 + 0.3, "crotale_bow", m=m("E6"), dur=2.6, vel=46)
    S.ev("crotale", h1 + 0.9, "crotale_bow", m=m("B6"), dur=2.0, vel=40)
    r = np.random.default_rng(41)
    for t in np.arange(h1 + 0.2, B(42.5), 0.55):
        trip = [("E7", "B6", "F#6"), ("D7", "A6", "E6"), ("F#7", "C#7", "G#6")][int(r.integers(0, 2))]
        for j, p in enumerate(trip):
            S.ev("celesta", t + float(r.uniform(0, 0.12)) + j * 0.06, "celesta", m=m(p), vel=float(36 - 4 * j))
    # H02: the pull — a rising lydian line over the pedal; the star motif climbs with every streak
    line = [(B(42.5), "E5", "E4 B4"), (B(42.75), "F#5", "D4 F#4 A4"), (B(43), "G5", "E4 G4 B4"),
            (B(43.25), "A5", "D4 F#4 A4"), (B(43.5), "B5", "G4 B4 D5"), (B(43.62), "C6", "G4 B4 D5"),
            (B(43.75), "D6", "D5 F#5 A5")]
    for i, (t, top, ch) in enumerate(line):
        t_end = line[i + 1][0] + 0.1 if i + 1 < len(line) else SYNC["H03_shut"]
        d0 = 0.25 + 0.06 * i
        S.strings(t, t_end, [top] + ch.split(), [(t, d0), (t_end, d0 + 0.05)], offset=0.06 if i else None,
                  attack=0.06 if i else None, release=0.12 if i + 1 == len(line) else 0.3)
    for i, t in enumerate(SYNC["H02_flicker"]):
        S.star(t, octave=-1 + (i % 3) // 2, vel=36 + 3 * i, step=0.2)
    roll(S, B(43.25), SYNC["H03_shut"] - 0.05, "C2", 30, 70, rate=12)
    # H03: shutters close — the music cuts to almost nothing; only a thin, ironic music box while the top spins
    top = SYNC["H03_top"]
    box = [(0, "G5"), (.25, "E6"), (.75, "D6"), (1.0, "C6"), (1.25, "D6"), (1.75, "A5"), (2.0, "F6"), (2.5, "E6"),
           (2.75, "D6")]
    for o, p in box:
        S.ev("musicbox", top + 0.15 + o * BEAT, "musicbox", m=m(p), vel=70, detune_seed=3)
    for o, p in ((0, "C5"), (1, "G4"), (2, "F4")):
        S.ev("musicbox", top + 0.15 + o * BEAT, "musicbox", m=m(p), vel=52, detune_seed=4)
    S.ev("harmonic", SYNC["H03_shut"] + 0.05, "harmonic", m=m("E6"), dur=B(45.25) - SYNC["H03_shut"] - 0.9, vel=10,
         attack=0.3, release=0.6)                                     # the 'almost' in almost nothing
    # H04 (bars 45.25-46.25): the sky everyone ignores — a huge shimmering swell, cut dead at H05
    h4, h5 = B(45.25), B(46.25)
    S.strings(h4, h5 + 0.05, "C2 G2 E3 B3 F#4 A4 D5 E5 B5 F#6", [(h4, 0.24), (h5 - 0.6, 0.72), (h5, 0.75)], trem=True,
              release=0.05)
    S.seq("horns", h4 + 0.4, "C4+E4+G4+B4:3.4", vel=84, layer="f")
    S.ev("swell", h4, "cymbal_swell", dur=h5 - h4, vel=96, choke=True)
    roll(S, h4, h5, "C2", 42, 96)
    for k in range(6):
        t = h4 + 0.2 + k * 0.5
        for j, p in enumerate(("F#7", "E7", "B6", "A6", "F#6", "E6", "B5")):
            S.ev("celesta", t + j * 0.045, "celesta", m=m(p), vel=float(40 + 6 * k - 2 * j))
            S.ev("glock", t + 0.02 + j * 0.045, "glock", m=m(p), vel=float(30 + 7 * k - 2 * j))
    for k in range(3):
        for j, p in enumerate("C3 E3 G3 B3 D4 F#4 A4 C5 E5 G5 B5 D6".split()):
            S.ev("harp", h4 + 0.1 + k * 1.05 + j * 0.06, "pluck", m=m(p), vel=float(50 + 15 * k), kind="harp")
    # H05: silence ... one low piano note at the very end
    t_low = B(48.25)
    S.n("piano", t_low, "A0", 4.0, 50)
    S.n("piano", t_low, "A1", 4.0, 42)
    S.ped(t_low - 0.05, t_low + 4.2)


# ------------------------------------------------------------------------------------------------- LETTING GO
def letting_go(S):
    # L01-L02: determination — a low string ostinato, building with toms
    def ostinato(b0, b1, pat, dyn, octave_down=True):
        t = B(b0)
        names = pat.split()
        i = 0
        while t < B(b1) - 1e-6:
            p = names[i % len(names)]
            tt = t
            # short bows from the sustain samples: start just past the slow bow attack for a spiccato bite
            S.strings(tt, tt + 0.2, [p], dyn, release=0.1, offset=0.07, attack=0.006)
            if octave_down:
                S.strings(tt, tt + 0.2, [m(p) - 12], dyn, release=0.1, offset=0.07, attack=0.006)
            t += 0.5 * BEAT
            i += 1
    ost_dyn = [(B(48.5), 0.3), (B(50), 0.42), (B(52), 0.6), (B(53.5), 0.72)]
    ostinato(48.5, 50, "A2 A2 E2 A2 C3 A2 E2 A2", ost_dyn)
    ostinato(50, 50.5, "A2 A2 E2 A2", ost_dyn)
    ostinato(50.5, 51, "F2 F2 C3 F2", ost_dyn)
    ostinato(51, 51.5, "C3 C3 G2 C3", ost_dyn)
    ostinato(51.5, 52, "G2 G2 D3 G2", ost_dyn)
    S.strings(B(49.5), B(50) + 0.2, "E3", [(B(49.5), 0.0), (B(50), 0.3)])
    S.seq("horn", B(49.5), "A3:2@62 E4:2@68", legato=True, layer="mf")
    # upper strings join (L02)
    for (b, ch) in ((50, "A3 C4 E4"), (50.5, "F3 A3 C4"), (51, "G3 C4 E4"), (51.5, "G3 B3 D4")):
        S.strings(B(b), B(b + 0.5) + 0.15, ch, [(B(b), 0.3 + 0.05 * (b - 50)), (B(b + 0.5), 0.36 + 0.06 * (b - 50))])
    for b, beats, v in ((50, (1, 3), 62), (51, (1, 2.5, 3, 4), 80)):
        for bt in beats:
            S.ev("toms", B(b, bt), "tom", f0=72.0 if bt in (1, 3) else 96.0, vel=v + (6 if bt == 1 else 0),
                 seed=b * 10 + int(bt * 2))
    S.ev("timpani", B(51), "timpani", m=m("C2"), vel=80)
    S.ev("swell", B(51, 2), "cymbal_swell", dur=B(52) - B(51, 2), vel=86, ring=2.5)
    # L03 (bars 52-53.5): the launch — the theme in major on horns, uplifting
    S.seq("horns", B(51, 4), "G4:1@96 E5:3@104 D5:.5@96 C5:.5@94 | D5:2.2@100", legato=True, layer="f")
    S.seq("horn", B(51, 4), "G3:1@88 E4:3@96 D4:.5@90 C4:.5@88 | D4:2.2@92", legato=True, layer="f")
    S.strings(B(52), B(53) + 0.2, "C2 G2 E3 G3 C4 E4", [(B(52), 0.62), (B(53), 0.66)])
    S.strings(B(53), B(53.5) + 0.1, "B1 D3 G3 B3 D4", [(B(53), 0.66), (B(53.5), 0.72)])
    S.theme_strings(B(52), -1, 7, [(B(51, 4), 0.55), (B(52), 0.72)])
    ostinato(52, 53, "C3 C3 G2 C3 E3 C3 G2 C3", ost_dyn)
    ostinato(53, 53.5, "B2 B2 G2 B2", ost_dyn)
    S.ev("timpani", B(52), "timpani", m=m("C2"), vel=100)
    S.ev("timpani", B(53), "timpani", m=m("G2"), vel=96)
    S.ev("cymbal", B(52), "cymbal", vel=84)
    for bt in (1, 2, 3, 3.5, 4):
        S.ev("toms", B(52, bt), "tom", f0=70.0 if bt in (1, 3) else 92.0, vel=86, seed=int(bt * 10))
    # L04 (bars 53.5-56): the storm — drums, low-brass clusters, tremolo, dissonance under the thunder
    st0, st1 = B(53.5), B(56)
    S.strings(st0, st1, "C2 G2", [(st0, 0.6), (st1, 0.8)], trem=True)
    S.strings(st0, SYNC["L04_telescope"], "Db5 C5 G5", [(st0, 0.4), (SYNC["L04_telescope"] - 0.4, 0.7),
                                                        (SYNC["L04_telescope"], 0.5)], trem=True, seed=4)
    S.seq("trombones", st0, "C3+Db3+Gb3:4@90 | C3+Eb3+Ab3:4@100", layer="ff")
    S.seq("tuba", st0, "C2:4@96 | Ab1:4@100", vel=96)
    S.seq("horns", st0 + 1.0 * BEAT, "G4:1@96 E5:2@104 Eb5:2@100", legato=True, layer="f")   # the leap, crushed
    pattern = [(1, 72, 120), (1.5, 96, 90), (2, 96, 96), (2.5, 72, 108), (3, 72, 116), (3.5, 96, 92), (4, 96, 100),
               (4.5, 120, 96)]
    t = st0
    k = 0
    while t < st1 - 1e-6:
        for bt, f0, v in pattern:
            tt = t + (bt - 1) * BEAT
            if tt >= st1 or abs(tt - SYNC["L04_telescope"]) < 0.9 or (SYNC["L04_telescope"] < tt < SYNC["L04_telescope"] + 1.7):
                continue
            S.ev("toms", tt, "tom", f0=f0, vel=v, seed=k)
            k += 1
        t += 4 * BEAT
    for b in (54, 55):
        S.ev("timpani", B(b), "timpani", m=m("C2"), vel=110)
    # the telescope goes overboard: the drums drop out, one high violin note and a falling celesta line
    tel = SYNC["L04_telescope"]
    S.strings(tel, tel + 1.9, "E6", [(tel, 0.0), (tel + 0.5, 0.55), (tel + 1.9, 0.3)])
    for i, p in enumerate(STAR + ["D6", "A5", "E5"]):
        S.ev("celesta", tel + 0.1 + i * 0.16, "celesta", m=m(p) - (12 if i > 3 else 0), vel=50 - 3 * i)
    S.strings(tel + 0.6, st1, "C5 Db5 G5 Ab5", [(tel + 0.6, 0.3), (st1, 0.8)], trem=True, seed=7)
    # L05 (bars 56-57): the last light lifts them — rising crescendo into the smash cut
    l5, l6 = B(56), B(57)
    rise = lambda tt, _d=l6 - l5: 7.0 * smooth(tt / _d)
    S.strings(l5, l6 + 0.02, "G2 D3 G3 B3 D4 G4 B4 D5", [(l5, 0.55), (l6, 0.88)], bend=rise, trem=True, release=0.02)
    S.seq("trombones", l5, "G2+D3+G3:4", vel=98, layer="ff")
    S.seq("horns", l5, "B3+D4+G4:4", vel=96, layer="f")
    S.ev("swell", l5, "cymbal_swell", dur=l6 - l5, vel=104, choke=True)
    roll(S, l5, l6 - 0.03, "G2", 60, 108)
    for k in range(int((l6 - l5) / (0.25 * BEAT))):
        S.ev("toms", l5 + k * 0.25 * BEAT, "tom", f0=88.0 + 2 * k, vel=min(100, 64 + 2.5 * k), seed=900 + k)

    # L06 (bars 57-60): above the storm. Silence, then solo piano; the blinks; the star rises
    S.n("piano", B(57, 3), "A2", 1.8, 34)
    for p in ("E3", "G3", "C4"):
        S.n("piano", B(57, 3) + 0.04, p, 1.7, 28)
    S.n("piano", B(57, 4), "G4", BEAT, 44)
    S.n("piano", B(58), "E5", 3.2, 52)
    S.n("piano", B(58), "F2", 1.7, 34)
    for p in ("C3", "E3", "A3"):
        S.n("piano", B(58) + 0.04, p, 1.6, 27)
    S.blink(SYNC["L06_blink_claude"], high=False, vel=46)
    S.n("piano", B(58, 3), "E2", 1.7, 32)
    for p in ("C3", "G3"):
        S.n("piano", B(58, 3) + 0.04, p, 1.6, 27)
    S.blink(SYNC["L06_blink_star"], high=True, vel=44)
    S.n("piano", B(59), "B1", 1.7, 36)
    for p in ("G2", "D3", "G3"):
        S.n("piano", B(59) + 0.04, p, 1.6, 30)
    S.n("piano", B(59), "D5", 2.4, 50)
    S.n("piano", B(59, 3), "G1", 1.6, 38)
    for p in ("F2", "D3", "B3"):
        S.n("piano", B(59, 3) + 0.04, p, 1.4, 32)
    S.n("piano", B(59, 4), "G5", BEAT, 56)
    S.peds([B(57, 3), B(58), B(58, 3), B(59), B(59, 3), B(60)])
    S.strings(B(59), B(60) + 0.2, "G2 D3 B3 F4", [(B(59), 0.0), (B(59, 3), 0.3), (B(60), 0.62)])
    S.ev("swell", B(59, 2), "cymbal_swell", dur=B(60) - B(59, 2), vel=100, ring=3.0)
    roll(S, B(59, 3), B(60) - 0.04, "F2", 40, 96)
    for j, p in enumerate("F3 A3 C4 E4 G4 A4 C5 E5 G5 A5 C6".split()):
        S.ev("harp", B(59, 4) + j * 0.065, "pluck", m=m(p), vel=float(56 + 3 * j), kind="harp")

    # L07 (bars 60-61.5): ignition — the theme's climax, full orchestra; the star motif finally complete
    T = B(60) - 24 * BEAT                      # theme-bar-1 reference so that theme bar 7 lands on bar 60
    ig = SYNC["L07_ignite"]
    S.theme("piano", T, 24, 29.5, vel=82)
    S.theme("piano", T, 24, 29.5, vel=72, octave=-1)
    S.theme_strings(T, 24, 29.5, [(B(60), 0.42), (ig - 0.06, 0.8), (ig, 1.0), (B(61), 0.92), (B(61.5), 0.85)])
    S.theme_strings(T, 24, 29.5, [(B(60), 0.38), (ig - 0.06, 0.72), (ig, 0.9), (B(61), 0.85), (B(61.5), 0.8)], octave=-1)
    S.strings(B(60), B(61) + 0.25, "F1 F2 C3 A3 C4 F4", [(B(60), 0.35), (ig - 0.06, 0.7), (ig, 0.95), (B(61), 0.88)])
    S.strings(B(61), B(61.5) + 0.05, "G1 G2 D3 C4 D4", [(B(61), 0.88), (B(61.5), 0.85)], release=0.08)
    # the star climbs while the theme builds; the tutti hit lands on the ignition (L07 T_IGNITE, a beat of bar 60)
    bi = (ig - B(60)) / BEAT                   # beats from the bar line to the ignition
    S.seq("horn", B(60), "A4:3@70 G4:.5@84 E4:.5@96 | D4:2@108", legato=True, layer="mf")
    S.seq("horns", ig, f"C4+F4+A4:{4 - bi:g}@110 | D4+G4:2@104", layer="f")
    S.seq("trombones", ig, f"F2+C3+A3:{4 - bi:g}@102 | G2+D3:2@96", layer="ff")
    S.seq("tuba", ig, f"F1:{4 - bi:g}@100 | G1:2@96", vel=96)
    S.seq("flute", B(60), "A5:3@80 G5:.5@88 E5:.5@92 | D5:2@88", legato=True)
    S.ev("swell", B(60) + 0.3, "cymbal_swell", dur=ig - B(60) - 0.3, vel=96, ring=0.5)
    roll(S, B(60) + 0.4, ig - 0.03, "F2", 46, 108)
    S.ev("cymbal", ig, "cymbal", vel=118, decay=4.5)
    S.ev("timpani", ig, "timpani", m=m("F2"), vel=120)
    S.ev("timpani", B(61), "timpani", m=m("G2"), vel=104)
    S.arp(B(60), "F1 C2 A2 C3 F3 C3 A2 C2", vel=78)
    S.arp(B(61), "G1 D2 G2 C3", vel=74)
    S.peds([B(60), B(61), B(61.5)])
    for k, oct_ in enumerate((0, -1, 1)):
        for i, p in enumerate(STAR):
            if m(p) + 12 * oct_ <= m("C8"):
                S.ev("celesta", ig + k * 0.04 + i * 0.12, "celesta", m=m(p) + 12 * oct_, vel=68 - 8 * k)
                S.ev("glock", ig + k * 0.04 + i * 0.12, "glock", m=m(p) + 12 * min(oct_, 0), vel=60 - 8 * k)

    # L08 (bars 61.5-63.5): falling in the dark ... the beam; the interrupted cadence finally completes
    l8 = B(61.5)
    beam = SYNC["L08_beam"]
    S.strings(l8, beam + 1.2, "A1 E2", [(l8, 0.42), (beam, 0.3), (beam + 1.2, 0.2)])
    S.ev("sub", l8, "sub", m=m("A1"), dur=beam - l8 + 0.5, vel=80, attack=0.05)
    S.n("piano", l8, "A0", 3.0, 64)
    S.ped(l8, beam - 0.2)
    S.ev("harmonic", beam, "harmonic", m=m("E6"), dur=B(63.5) - beam, vel=46, attack=0.8)
    S.strings(beam, B(63.5) + 0.5, "E6", [(beam, 0.0), (beam + 1.2, 0.36), (B(63), 0.4), (B(63.5) + 0.5, 0.0)])
    S.star(beam + 0.3, octave=-1, vel=40, step=0.3)
    S.strings(beam + 0.8, B(62.75) + 0.2, "A2 F3 C4 G4", [(beam + 0.8, 0.2), (B(62.75), 0.4)])
    S.strings(B(62.75), B(63) + 0.2, "B1 G2 D3 G3", [(B(62.75), 0.4), (B(63), 0.45)])
    S.strings(B(63), B(63.5) + 0.6, "C2 G2 E3 C4 E4", [(B(63), 0.45), (B(63.5), 0.25), (B(63.5) + 0.6, 0.05)])
    S.n("piano", B(62.75), "B1", 1.0, 44)
    S.n("piano", B(62.75), "G2", 1.0, 40)
    S.seq("piano", B(62, 4), "D5:.5@52 E5:.5@54 | C5:2@56", hold=1.0)
    S.n("piano", B(63), "C2", 2.0, 48)
    S.n("piano", B(63), "G2", 2.0, 42)
    S.n("piano", B(63), "E3", 2.0, 40)
    S.peds([B(62.75), B(63), B(63.5) + 0.4])
    S.seq("horn", B(62, 4), "D4:.5@70 E4:.5@72 | C4:2@70", legato=True, layer="mf")


# ------------------------------------------------------------------------------------------------- CODA
def coda(S):
    # C01 (bars 63.5-66): spring morning — flute takes the theme, pizz and light piano
    T = B(64)
    S.theme("flute", T, -1, 8, vel=72, legato=True)
    S.theme("piano", T, -1, 7, vel=48)
    S.arp(B(64), "C3 G3 E4 G3 C4 G3 E4 G3", vel=36)
    S.arp(B(65), "B2 G3 D4 G3 B3 G3 D4 G3", vel=36)
    S.peds([B(63.75), B(64), B(65), B(66)])
    for (b, p) in ((64, "C3"), (64.5, "G2"), (65, "B2"), (65.5, "G2")):
        S.ev("pizz", B(b), "pluck", m=m(p), vel=62, kind="pizz")
        S.ev("pizz", B(b) + 0.5 * BEAT, "pluck", m=m(p) + 12, vel=46, kind="pizz")
    S.strings(B(64), B(65) + 0.2, "C3 G3 E4", [(B(63.5), 0.0), (B(64), 0.2), (B(65), 0.22)])
    S.strings(B(65), B(66) + 0.2, "B2 G3 D4", [(B(65), 0.22), (B(66), 0.12)])
    S.ev("glock", B(64), "glock", m=m("E6"), vel=34)
    # C02 (bars 66-69): night — solo piano; the blinks; one star blinks back; the theme resumes
    S.n("piano", B(66), "A2", 3.0, 36)
    S.n("piano", B(66), "F3", 3.0, 30)
    S.n("piano", B(66), "C4", 3.0, 28)
    S.seq("piano", B(65, 4), "A4:1@46 F5:3@54 E5:.5@46 D5:.5@44", hold=1.0)
    S.n("piano", B(67), "E2", 3.4, 34)
    S.n("piano", B(67), "C3", 3.4, 28)
    S.n("piano", B(67), "G3", 3.4, 26)
    S.n("piano", B(67), "E4", 2.0, 34)
    S.blink(SYNC["C02_blink_claude"], high=False, vel=48)
    S.blink(SYNC["C02_blink_star"], high=True, vel=46)
    S.n("piano", B(68), "C3", 3.0, 34)
    S.n("piano", B(68), "G3", 3.0, 28)
    S.seq("piano", B(68), "G4:1@46 E5:3@54", hold=1.0)
    S.peds([B(66), B(67), B(68), B(69)])
    # C03 (bars 69-73): the final statement with warm strings, home to C add9, fading
    T3 = B(69) - 20 * BEAT                     # theme bar 6 lands on bar 69
    S.theme("piano", T3, 20, 32, vel=58)
    S.theme_strings(T3, 20, 32, [(B(69), 0.35), (B(70), 0.55), (B(71), 0.45), (B(71, 3), 0.38)])
    S.strings(B(69), B(70) + 0.2, "B1 G2 D3 G3 B3", [(B(69), 0.25), (B(70), 0.42)])
    S.strings(B(70), B(71) + 0.2, "F2 C3 A3 C4 F4", [(B(70), 0.48), (B(71), 0.42)])
    S.strings(B(71), B(71, 3) + 0.2, "G2 D3 F3 C4", [(B(71), 0.42), (B(71, 3), 0.4)])
    S.strings(B(71, 3), DURATION + 0.5, "C2 G2 E3 D4 G4 E5", [(B(71, 3), 0.42), (B(72), 0.36), (DURATION - 3.0, 0.3),
                                                             (DURATION, 0.15)])
    S.arp(B(69), "B1 G2 D3 G3 B3 G3 D3 G2", vel=38)
    S.arp(B(70), "F1 C2 A2 C3 F3 C3 A2 C2", vel=40)
    S.arp(B(71), "G1 D2 F2 C3 C2 G2 D3 E3", vel=38)
    S.n("piano", B(72), "C2", 5.0, 40)
    for p in ("G2", "E3", "D4", "G4", "C5"):
        S.n("piano", B(72) + 0.05, p, 5.0, 32)
    S.peds([B(69), B(70), B(71), B(71, 3), B(72), DURATION + 0.5])
    S.seq("horn", B(70), "C4:3@62 D4:1@58 | B3:2@58 C4:2@56", legato=True, layer="mf")
    S.seq("clarinet", B(71, 3), "E4:2@52 | D4:2@48 E4:3@46", legato=True)
    S.star(B(72, 2), octave=0, vel=36, step=0.3)          # the eye is there now: the motif complete
    S.ev("harmonic", B(71, 3), "harmonic", m=m("D6"), dur=DURATION - B(71, 3), vel=34, attack=1.5)


# ======================================================================================================== RENDER
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
    "swell": (-6.0, 0.35), "sleigh": (-8.0, 0.3), "sub": (-6.0, 0.0),
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
              "perc": ["timpani", "toms", "boom", "cymbal", "swell", "sleigh", "sub"]}
    for gname, trs in groups.items():
        acc = sum((stems[t] * dsp.db(TRACKS[t][0]) for t in trs if t in stems), np.zeros((1, 2), np.float32))
        if np.ndim(acc) == 2 and len(acc) > 1:
            dsp.save_stem(os.path.join(SM.CACHE, "stems", f"{gname}.npy"), acc[:len(mix)])
    print(f"wrote {os.path.join(OUT, 'score.wav')}  peak {dsp.to_db(pk):.1f} dBFS (pre-trim)")


if __name__ == "__main__":
    main()
