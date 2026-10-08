"""Sound cue sheet for "Looking Up" v2 (58.667 s, 90 BPM) — the ONE place that holds event times for score sync,
foley, ambience and mix automation.

Every time is absolute seconds, written as at(SHOT, local) = shot start (from src/timeline.py) + shot-local
seconds, so re-timing a shot moves its sounds with it. Named picture events are read from the shots' own constants
(src/shots/shNN.py: BLINKS, TWINKLES, T_FALL, ...) through K(); the defaults are the director's script values, so
sync holds before and after the shot files exist. Times marked (*) are sound-side guesses for actions the script
does not time.

Sections:
  SYNC            named sync points read by score.py
  FOLEY           (t, kind, params) one-shot / ranged effects rendered by foley.py
  BEDS            ambience bed segments (t0, t1, kind, level_db)
  SPACE           acoustic space per shot (reverb choice for foley)
  DUCK            music ducking under key effects (t, depth_db, attack, hold, release)
  MUSIC_CUTS      the score (reverb tails included) stops dead here
  MUTE            hard music mutes in the mix: (t0, t1, fade_s)
  SECTIONS        report sections (label, t0, t1, intent); SILENCE_CHECKS (label, t0, t1, bus)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))          # src/ (timeline)

from timeline import SHOT, SHOTS, BEAT, BAR, DURATION as _DUR  # noqa: E402

DURATION = _DUR                                      # 88 beats = 1408 frames = 58.6667 s (2,816,000 samples)
FADE_OUT = 2.5                                       # end-of-film fade (mix): after the twinkles + title


def at(shot, local):
    return round(SHOT[shot][0] + local, 4)


def start(shot):
    return SHOT[shot][0]


def end(shot):
    return SHOT[shot][1]


def bar(n, beat=1.0):
    """Absolute time of bar n (1-based, may be fractional) + beat (1-based)."""
    return (n - 1) * BAR + (beat - 1.0) * BEAT


# ------------------------------------------------------------------------------------------- shot constants
_cache = {}


def _consts(shot):
    """Module-level literal constants of src/shots/<shot>.py (AST only — nothing is imported or executed)."""
    import ast
    if shot in _cache:
        return _cache[shot]
    out = {}
    path = os.path.join(os.path.dirname(HERE), "shots", shot.lower() + ".py")
    if os.path.exists(path):
        try:
            tree = ast.parse(open(path).read())
        except SyntaxError:
            tree = None
        for node in (tree.body if tree else []):
            if not isinstance(node, ast.Assign):
                continue
            try:
                val = ast.literal_eval(node.value)
            except Exception:
                continue
            for tgt in node.targets:
                if isinstance(tgt, ast.Name):
                    out[tgt.id] = val
                elif isinstance(tgt, ast.Tuple) and isinstance(val, tuple):
                    out.update({e.id: v for e, v in zip(tgt.elts, val) if isinstance(e, ast.Name)})
    _cache[shot] = out
    return out


def K(shot, name, default):
    """A shot's named timing constant (shot-local seconds), falling back to the script value."""
    return _consts(shot).get(name, default)


SH03_BLINKS = K("SH03", "BLINKS", (0.9, 1.75))
SH04_TWINKLES = K("SH04", "TWINKLES", (0.35, 1.0))
SH04_FLICKER = K("SH04", "T_FLICKER", 1.9)
SH04_FALL = K("SH04", "T_FALL", 2.67)
SH04_GONE = K("SH04", "T_GONE", 4.3)
SH05_FLASH = K("SH05", "T_FLASH", 0.67)
SH05_BOLT = K("SH05", "T_BOLT", 1.3)
SH06_SKID = K("SH06", "T_SKID", 0.67)
SH07_FLINCH = K("SH07", "T_FLINCH", 1.3)          # (*) the lantern light lands on the star
SH08_HOP = K("SH08", "T_HOP", 2.0)
SH08_GLOW = K("SH08", "T_GLOW", 2.67)
SH10_TUMBLE = K("SH10", "T_TUMBLE", 2.0)
SH11_FLICKER = K("SH11", "T_FLICKER", 2.3)        # (*) the tiny flicker at the end of SH11
SH12_DIM = K("SH12", "T_DIM", 1.6)
SH14_HUG = K("SH14", "T_HUG", 1.6)
SH14_RESOLVE = K("SH14", "T_RESOLVE", 2.8)
SH15_GUST = K("SH15", "T_GUST", 1.33)
SH15_LIFT = K("SH15", "T_LIFT", 2.0)
SH16_RELEASE = K("SH16", "T_RELEASE", 2.0)
SH17_IGNITE = K("SH17", "T_IGNITE", 1.33)
SH18_BLINKS = K("SH18", "BLINKS", (0.9, 1.75))
SH19_TWINKLES = K("SH19", "TWINKLES", (0.9, 1.55))
SH19_TITLE = K("SH19", "T_TITLE", 1.6)

SYNC = {
    "blink_1": [at("SH03", t) for t in SH03_BLINKS],
    "twinkle_1": [at("SH04", t) for t in SH04_TWINKLES],
    "flicker": at("SH04", SH04_FLICKER),
    "fall": at("SH04", SH04_FALL),
    "gone": at("SH04", SH04_GONE),
    "flash": at("SH05", SH05_FLASH),
    "bolt": at("SH05", SH05_BOLT),
    "skid": at("SH06", SH06_SKID),
    "flinch": at("SH07", SH07_FLINCH),
    "hop": at("SH08", SH08_HOP),
    "glow": at("SH08", SH08_GLOW),
    "tumble": at("SH10", SH10_TUMBLE),
    "flicker_2": at("SH11", SH11_FLICKER),
    "dim": at("SH12", SH12_DIM),
    "hug": at("SH14", SH14_HUG),
    "resolve": at("SH14", SH14_RESOLVE),
    "gust": at("SH15", SH15_GUST),
    "lift": at("SH15", SH15_LIFT),
    "release": at("SH16", SH16_RELEASE),
    "ignite": at("SH17", SH17_IGNITE),
    "blink_2": [at("SH18", t) for t in SH18_BLINKS],
    "twinkle_2": [at("SH19", t) for t in SH19_TWINKLES],
    "title": at("SH19", SH19_TITLE),
}


# ------------------------------------------------------------------------------------------- foley events
def _foley():
    F = []

    def add(t, kind, **p):
        F.append((round(t, 4), kind, p))

    S = SYNC
    # SH01 — crane up out of the flowers: fireflies close, the sails turning slowly far off
    add(at("SH01", 0.0), "fireflies", dur=3.2, gain=-38, seed=11)
    add(at("SH01", 0.2), "grass_rustle", dur=1.6, gain=-38, seed=12)
    for i, t in enumerate((1.4, 3.6)):
        add(at("SH01", t), "sail_creak", gain=-33, dist=2.0, seed=13 + i)
    # SH02-SH03 — the gallery: the lantern swaying on its hook, old wood settling
    add(at("SH02", 0.3), "lantern_creak", gain=-36, seed=21)
    add(at("SH02", 2.2), "lantern_creak", gain=-38, seed=22)
    add(at("SH02", 1.2), "floor_creak", gain=-40, seed=23)
    add(at("SH03", 0.4), "lantern_creak", gain=-40, seed=31)
    # SH04 — the eye: tiny bell twinkles, the flicker, then the fall (a long descending whoosh) and the hush
    for i, t in enumerate(S["twinkle_1"]):
        add(t, "sparkle_ting", gain=-36, seed=41 + i)
    add(S["flicker"], "sputter", dur=0.7, gain=-32, seed=43)
    add(S["fall"] - 0.05, "streak_whoosh", dur=S["gone"] - S["fall"] + 0.25, gain=-16, direction="down", seed=44)
    # SH05 — impact flash: a distant boom from the meadow; Claude grabs the lantern and bolts
    add(S["flash"], "impact_boom", gain=-15, seed=51)
    add(S["flash"] + 0.02, "sparks", dur=1.0, gain=-30, seed=52)
    add(S["bolt"] - 0.08, "lantern_grab", gain=-27, seed=53)
    add(S["bolt"], "cloth_whoosh", dur=0.3, gain=-30, seed=54)
    for i in range(4):
        add(S["bolt"] + 0.08 + 0.12 * i, "footstep", gain=-31, surface="wood", seed=55 + i)
    # SH06 — the run, the skid, the cautious creep toward the smoking crater
    for i in range(6):
        add(at("SH06", 0.0) + 0.105 * i, "footstep", gain=-30, surface="grass", seed=60 + i)
    for i, t in enumerate((0.0, 0.33)):
        add(at("SH06", t), "lantern_creak", gain=-33, fast=True, seed=66 + i)
    add(S["skid"] - 0.05, "skid", gain=-25, seed=68)
    add(at("SH06", 0.0), "crater", dur=end("SH08") - start("SH06"), gain=-31, seed=69)
    for i, t in enumerate((1.35, 1.8, 2.3, 2.75, 3.25, 3.8, 4.3)):
        add(at("SH06", t), "footstep", gain=-39, surface="grass", soft=True, seed=70 + i)
    add(at("SH06", 1.6), "lantern_creak", gain=-39, seed=78)
    # SH07 — the star in the crater: trembling, a frightened little bell voice, the flinch, a weak flicker
    add(at("SH07", 0.0), "tremble_tinkle", dur=2.6, gain=-38, seed=80)
    add(at("SH07", 0.55), "star_voice", mood="scared", gain=-30, seed=81)
    add(S["flinch"], "star_voice", mood="flinch", gain=-28, seed=82)
    add(S["flinch"] + 0.04, "grass_rustle", dur=0.25, gain=-40, seed=83)
    add(at("SH07", 2.1), "sputter", dur=0.4, gain=-38, seed=84)
    # SH08 — the offer: lantern down, Claude lowers itself, the star asks, hops in, the glow returns
    add(at("SH08", 0.45), "lantern_set", gain=-29, seed=90)
    add(at("SH08", 0.8), "grass_rustle", dur=0.7, gain=-38, seed=91)
    add(at("SH08", 1.35), "star_voice", mood="ask", gain=-30, seed=92)
    add(S["hop"] - 0.05, "hop_whoosh", gain=-31, seed=93)
    add(S["hop"] + 0.22, "soft_pat", gain=-33, seed=94)
    add(S["glow"] - 0.15, "glow_swell", dur=1.2, gain=-29, seed=95)
    add(S["glow"] + 0.35, "star_voice", mood="happy", gain=-29, seed=96)
    # SH09 — play: loops of sparkle, fireflies swirling, Claude spinning and hopping
    add(at("SH09", 0.0), "sparkle_whoosh", dur=2.6, gain=-27, seed=100)
    add(at("SH09", 0.0), "fireflies", dur=2.67, gain=-36, seed=101)
    for i, t in enumerate((0.5, 0.85, 1.2, 1.55, 1.9, 2.25)):
        add(at("SH09", t), "footstep", gain=-37, surface="grass", seed=102 + i)
    for i, t in enumerate((0.9, 2.0)):
        add(at("SH09", t), "star_voice", mood="giggle", gain=-30, seed=110 + i)
    # SH10 — the swoop, the lunge, the catch, the tumble into the flowers
    add(at("SH10", 0.5), "throw_whoosh", gain=-27, seed=120)
    add(S["tumble"] - 0.35, "cloth_whoosh", dur=0.35, gain=-30, seed=121)
    add(S["tumble"] - 0.12, "soft_pat", gain=-32, seed=122)
    add(S["tumble"], "flower_thump", gain=-22, seed=123)
    add(S["tumble"] + 0.03, "petal_burst", gain=-29, seed=124)
    add(S["tumble"] + 0.35, "star_voice", mood="giggle", gain=-31, seed=125)
    # SH11 — lying in the flowers: fireflies, the end flicker
    add(at("SH11", 0.0), "fireflies", dur=2.67, gain=-39, seed=130)
    add(S["flicker_2"], "sputter", dur=0.3, gain=-40, seed=131)
    # SH12-SH14 — the turn: the glow sputters and drains; the shiver; the hug; resolve
    add(S["dim"] - 0.1, "sputter", dur=1.0, gain=-33, seed=140)
    add(S["dim"] + 0.2, "tremble_tinkle", dur=1.0, gain=-41, seed=141)
    add(S["dim"] + 0.5, "star_voice", mood="sad", gain=-32, seed=142)
    add(at("SH13", 0.3), "sputter", dur=0.9, gain=-46, seed=143)
    add(S["hug"] - 0.1, "cloth_rustle", dur=0.6, gain=-35, seed=144)
    add(S["hug"] + 0.25, "star_voice", mood="sad", gain=-38, seed=145)
    add(S["resolve"], "cloth_rustle", dur=0.5, gain=-37, seed=146)
    # SH15 — the sail: Claude climbs on, the gust, the sails groan and lift it in a great arc
    for i, t in enumerate((0.2, 0.55, 0.9)):
        add(at("SH15", t), "footstep", gain=-34, surface="wood", seed=150 + i)
    add(S["gust"] - 0.6, "gust", dur=2.6, gain=-14, seed=153)
    add(S["gust"] + 0.1, "petal_burst", gain=-33, seed=154)
    add(S["lift"] - 0.15, "sail_groan", dur=end("SH15") - S["lift"] + 0.6, gain=-23, seed=155)
    # SH16 — the apex, wind dropped: the nuzzle, the release
    add(at("SH16", 0.8), "star_voice", mood="tender", gain=-32, seed=160)
    add(at("SH16", 0.85), "cloth_rustle", dur=0.4, gain=-42, seed=161)
    add(S["release"] - 0.05, "star_rise", dur=1.6, gain=-27, seed=162)
    # SH17 — the streak home and the ignition
    add(start("SH17") - 0.1, "streak_whoosh", dur=S["ignite"] - start("SH17") + 0.15, gain=-21, direction="up",
        seed=170)
    add(S["ignite"] - 0.3, "ignition", gain=-15, seed=171)
    add(S["ignite"], "sparkle_cascade", dur=2.2, gain=-26, seed=172)
    # SH18-SH19 — quiet at the top; the twinkles answering
    add(at("SH18", 0.2), "sail_creak", gain=-42, dist=0.7, seed=180)
    for i, t in enumerate(SYNC["twinkle_2"]):
        add(t, "sparkle_ting", gain=-34, seed=181 + i)
    add(at("SH19", 2.4), "fireflies", dur=3.5, gain=-42, seed=183)
    return sorted(F, key=lambda e: e[0])


FOLEY = _foley()

# ------------------------------------------------------------------------------------------- ambience beds
# kinds (foley.bed): night_meadow (crickets close + soft wind), night_gallery (higher: breeze, crickets distant),
# night_hush (the crickets stop: wind only), high_air (thin wind high above the clouds), gust_wind (rising wind)
BEDS = sorted([
    (start("SH01"), end("SH01"), "night_meadow", -46),
    (end("SH01"), SYNC["fall"], "night_gallery", -45),
    (SYNC["fall"], SYNC["flash"], "night_hush", -50),
    (SYNC["flash"], end("SH05"), "night_gallery", -47),
    (start("SH06"), end("SH07"), "night_meadow", -50),           # the crickets creep back in
    (start("SH08"), end("SH11"), "night_meadow", -45),
    (start("SH12"), end("SH14"), "night_meadow", -49),
    (start("SH15"), end("SH15"), "gust_wind", -41),
    (start("SH16"), end("SH18"), "high_air", -49),
    (start("SH19"), DURATION, "night_meadow", -46),
])

SPACE = {s: ("sky" if s in ("SH16", "SH17", "SH18") else "open") for s, *_ in SHOTS}

# ------------------------------------------------------------------------------------------- mix automation
DUCK = [   # (t, depth_db, attack_s, hold_s, release_s)
    (SYNC["gust"], -2.5, 0.3, 0.6, 0.8),
    (SYNC["skid"], -2.0, 0.02, 0.2, 0.4),
]

MUSIC_CUTS = [SYNC["fall"]]                    # the music drops out as the eye breaks loose

MUTE = [(SYNC["fall"], SYNC["flash"] - 0.01, 0.01)]   # ... and stays out until the impact

HARD_CUTS = []                                 # (foley: no smash cuts in v2)

SECTIONS = [   # (label, t0, t1, intent)
    ("intro SH01-SH03", start("SH01"), end("SH03"), "lonely, tender"),
    ("twinkle SH04", start("SH04"), SYNC["fall"], "warm, then the flicker"),
    ("the fall (music out)", SYNC["fall"], SYNC["flash"], "whoosh only"),
    ("impact SH05", SYNC["flash"], end("SH05"), "boom"),
    ("suspense SH06-SH07", start("SH06"), end("SH07"), "cautious"),
    ("warmth SH08", start("SH08"), end("SH08"), "harp + strings bloom"),
    ("play SH09-SH10", start("SH09"), end("SH10"), "bright, bouncy"),
    ("flowers SH11", start("SH11"), end("SH11"), "tender cadence"),
    ("the turn SH12-SH14", start("SH12"), end("SH14"), "minor, sparse"),
    ("rising SH15-SH16", start("SH15"), end("SH16"), "building to the release"),
    ("ignition SH17", start("SH17"), end("SH17"), "LOUDEST"),
    ("resolution SH18-SH19", start("SH18"), DURATION, "warm, blink + twinkle, fade"),
]

SILENCE_CHECKS = [   # (label, t0, t1, bus)
    ("music silent under the fall", SYNC["fall"] + 0.05, SYNC["flash"] - 0.05, "music"),
    ("held breath (gone -> flash), mix", SYNC["gone"] + 0.3, SYNC["flash"] - 0.05, "mix"),
    ("SH13 empty-eye insert, mix", start("SH13"), end("SH13"), "mix"),
]
