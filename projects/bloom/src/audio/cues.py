"""Sound cue sheet for BLOOM (58.75 s, 96 BPM): the ONE place that holds event times for score sync, foley, ambience
and mix automation.

Every time is absolute seconds, written as at(SHOT, local) = shot start (from src/timeline.py) + shot-local seconds,
so re-timing a shot moves its sounds with it. Named picture events are read from the shots' own constants
(src/shots/bNN.py: T_SIGH, T_PULSE, T_CRACK, ...) through K(); the defaults are the director's script values, so sync
holds before and after the shot files exist and is re-read on every render. Times marked (*) are sound-side guesses
for actions the script does not time.

Sections:
  SYNC            named sync points (absolute s) read by score.py and the foley below
  go(k), set_(k)  the two metric grids of the score: the DRIVE is anchored on B07 T_GO, the return on B15 T_SET
  FOLEY           (t, kind, params) one-shot / ranged effects rendered by foley.py
  BEDS            ambience bed segments (t0, t1, kind, level_db RMS)
  SPACE           acoustic space per shot (foley reverb)
  DUCK            music ducking under key effects (t, depth_db, attack, hold, release)
  MUSIC_CUTS      the score (reverb tails included) stops dead here: t, or (t, fade_before, fade_after)
  MUTE            hard music mutes in the mix: (t0, t1, fade_s)
  HARD_CUTS       foley (reverb included) stops dead here
  SECTIONS        report sections (label, t0, t1, intent); SILENCE_CHECKS (label, t0, t1, bus)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))          # src/ (timeline)

from timeline import SHOT, SHOTS, BEAT, BAR, DURATION as _DUR  # noqa: E402,F401

DURATION = _DUR                                      # 94 beats = 1410 frames = 58.75 s (2,820,000 samples)
FADE_OUT = 2.0                                       # end-of-film fade (mix), under the title


def at(shot, local):
    return round(SHOT[shot][0] + local, 4)


def start(shot):
    return SHOT[shot][0]


def end(shot):
    return SHOT[shot][1]


# ------------------------------------------------------------------------------------------- shot constants
_cache = {}


def _consts(shot):
    """Module-level literal constants of src/shots/<shot>.py (AST only: nothing is imported or executed)."""
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
            if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name) and node.value is not None:
                targets, value = [node.target], node.value
            elif isinstance(node, ast.Assign):
                targets, value = node.targets, node.value
            else:
                continue
            try:
                val = ast.literal_eval(value)
            except Exception:
                continue
            for tgt in targets:
                if isinstance(tgt, ast.Name):
                    out[tgt.id] = val
                elif isinstance(tgt, ast.Tuple) and isinstance(val, tuple):
                    out.update({e.id: v for e, v in zip(tgt.elts, val) if isinstance(e, ast.Name)})
    _cache[shot] = out
    return out


def K(shot, name, default):
    """A shot's named timing constant (shot-local seconds), falling back to the script value."""
    v = _consts(shot).get(name, default)
    if isinstance(default, (tuple, list)):
        try:
            v = tuple(float(x) for x in (v if isinstance(v, (tuple, list)) else (v,)))
        except (TypeError, ValueError):
            v = tuple(default)
        return v or tuple(default)
    try:
        return float(v)
    except (TypeError, ValueError):
        return float(default)


B02_SIGH = K("B02", "T_SIGH", 2.0)
B03_PULSE = K("B03", "T_PULSE", (0.6, 1.5))
B03_NOTICE = K("B03", "T_NOTICE", 1.6)
B04_CRACK = K("B04", "T_CRACK", 1.2)
B04_CURL = K("B04", "T_CURL", 3.0)
B05_THUNDER = K("B05", "T_THUNDER", 0.3)
B05_FLASH = K("B05", "T_FLASH", 1.2)
B05_SHIVER = K("B05", "T_SHIVER", 1.6)
B06_BACK = K("B06", "T_BACK", 1.4)
B06_RESOLVE = K("B06", "T_RESOLVE", 2.0)
B07_GO = K("B07", "T_GO", 0.7)
B09_SLIP = K("B09", "T_SLIP", 0.4)
B09_STOP = K("B09", "T_STOP", 1.6)
B10_CHECK = K("B10", "T_CHECK", 0.7)
B10_UP = K("B10", "T_UP", 1.4)
B11_BOLT = K("B11", "T_BOLT", 1.5)
B12_HAIL = K("B12", "T_HAIL", 0.2)
B12_CHIPS = K("B12", "T_CHIPS", (0.7, 1.2, 1.8, 2.2))
B13_BOLT = K("B13", "T_BOLT", 1.0)
B14_STOP = K("B14", "T_STOP", 0.3)
B14_REVEAL = K("B14", "T_REVEAL", 1.2)
B14_TEAR = K("B14", "T_TEAR", 2.4)
B15_TOUCH = K("B15", "T_TOUCH", 0.8)
B15_SET = K("B15", "T_SET", 2.0)
B16_BEAM = K("B16", "T_BEAM", 1.6)
B17_PLANT = K("B17", "T_PLANT", 0.6)
B17_SURGE = K("B17", "T_SURGE", 1.4)
B18_WAVE = K("B18", "T_WAVE", 0.3)
B18_WAVE_END = K("B18", "T_WAVE_END", 4.4)
B19_LEAN = K("B19", "T_LEAN", 1.2)
B20_PAT = K("B20", "T_PAT", 1.6)
B20_TITLE = K("B20", "T_TITLE", 2.2)

SYNC = {
    "sigh": at("B02", B02_SIGH),
    "pulse": [at("B03", t) for t in B03_PULSE],
    "notice": at("B03", B03_NOTICE),
    "crack": at("B04", B04_CRACK),
    "curl": at("B04", B04_CURL),
    "thunder": at("B05", B05_THUNDER),
    "flash": at("B05", B05_FLASH),
    "shiver": at("B05", B05_SHIVER),
    "back": at("B06", B06_BACK),
    "resolve": at("B06", B06_RESOLVE),
    "go": at("B07", B07_GO),
    "slip": at("B09", B09_SLIP),
    "stop9": at("B09", B09_STOP),
    "check": at("B10", B10_CHECK),
    "up": at("B10", B10_UP),
    "bolt11": at("B11", B11_BOLT),
    "hail": at("B12", B12_HAIL),
    "chips": [at("B12", t) for t in B12_CHIPS],
    "bolt13": at("B13", B13_BOLT),
    "stop14": at("B14", B14_STOP),
    "reveal": at("B14", B14_REVEAL),
    "tear": at("B14", B14_TEAR),
    "touch": at("B15", B15_TOUCH),
    "set": at("B15", B15_SET),
    "beam": at("B16", B16_BEAM),
    "plant": at("B17", B17_PLANT),
    "surge": at("B17", B17_SURGE),
    "wave": at("B18", B18_WAVE),
    "wave_end": at("B18", B18_WAVE_END),
    "lean": at("B19", B19_LEAN),
    "pat": at("B20", B20_PAT),
    "title": at("B20", B20_TITLE),
}
# keep the order of events sane even if a shot file is re-timed oddly
SYNC["notice"] = max(SYNC["notice"], SYNC["pulse"][-1] + 0.02)
SYNC["curl"] = max(SYNC["curl"], SYNC["crack"] + 1.0)
SYNC["stop9"] = max(SYNC["stop9"], SYNC["slip"] + 0.4)
SYNC["up"] = max(SYNC["up"], SYNC["check"] + 0.2)
SYNC["surge"] = max(SYNC["surge"], SYNC["plant"] + 0.2)
SYNC["wave_end"] = max(SYNC["wave_end"], SYNC["wave"] + 2.5)


def go(k):
    """The DRIVE grid: beat k (fractional) after B07 T_GO (the run launches on its downbeat)."""
    return SYNC["go"] + k * BEAT


def set_(k):
    """The RETURN grid: beat k after B15 T_SET (Claude turns to the summit)."""
    return SYNC["set"] + k * BEAT


def beat_of(t):
    """Position of absolute time t on the drive grid (beats after T_GO)."""
    return (t - SYNC["go"]) / BEAT


# ------------------------------------------------------------------------------------------- foley events
def _foley():
    F = []

    def add(t, kind, **p):
        F.append((round(t, 4), kind, p))

    S = SYNC
    # ---- B01: EWS, the burnt valley: tiny Claude trudging left to right, far away; an ember pop or two
    for i, t in enumerate((0.9, 1.45, 2.05, 2.6, 3.2, 3.75, 4.35)):
        add(t, "ash_step", gain=-44, soft=True, pan=-0.55 + 0.17 * i, dist=2.0, seed=10 + i)
    add(1.7, "ember_pop", gain=-42, pan=-0.4, seed=18)
    add(3.9, "ember_pop", gain=-45, pan=0.5, seed=19)
    # ---- B02: the stump: the charred swing creaks on its burnt rope; Claude sifts the ash; the sigh puffs ash
    for i, t in enumerate((0.25, 1.85, 3.0)):
        add(at("B02", t), "swing_creak", gain=-35 - 2 * i, mood="sad", pan=-0.35, seed=20 + i)
    add(at("B02", 0.15), "ash_sift", dur=max(0.5, S["sigh"] - start("B02") - 0.3), gain=-38, seed=24)
    add(S["sigh"] - 0.05, "breath", mood="sigh", gain=-34, seed=25)
    add(S["sigh"] + 0.12, "ash_puff", gain=-37, seed=26)
    add(S["sigh"] + 0.6, "ash_sift", dur=max(0.5, end("B03") - S["sigh"] - 1.5), gain=-42, seed=27)
    add(at("B02", 1.1), "ember_pop", gain=-43, pan=0.3, seed=28)
    # ---- B03: ECU the ash: the faint green pulses under it; Claude's eyes widen (a glint)
    for i, t in enumerate(S["pulse"]):
        add(t - 0.12, "seed_pulse", gain=-33 + 2 * i, seed=30 + i)
    add(S["notice"], "glint", gain=-36, seed=33)
    # ---- B04: the seed: brushing the ash away, the glow humming; the crack; the sprout unfurls, blinks, looks up;
    #      the leaf curls round Claude's finger
    for i, t in enumerate((0.12, 0.48, 0.85)):                                     # (*) brushing
        add(at("B04", t), "brush", gain=-35 - i, seed=40 + i)
    add(start("B04") + 0.3, "seed_hum", dur=S["thunder"] - start("B04") - 0.3, gain=-38, seed=43)
    add(S["crack"], "shell_crack", gain=-24, seed=44)
    add(S["crack"] + 0.08, "unfurl", dur=1.1, gain=-34, seed=45)
    add(S["crack"] + 0.85, "sprout_voice", mood="curious", gain=-31, seed=46)       # (*) eyes open, looks up
    add(S["curl"] - 0.18, "leaf_rustle", dur=0.45, gain=-38, seed=47)
    add(S["curl"] + 0.3, "sprout_voice", mood="happy", gain=-30, seed=48)
    # ---- B05: thunder; a cold gust whips the ash sideways; Claude's head snaps up; lightning inside the wall;
    #      the sprout shivers
    add(S["thunder"], "thunder", dur=4.2, dist=0.6, gain=-18, seed=50)
    add(S["thunder"] + 0.1, "gust", dur=1.9, gain=-25, seed=51)
    add(S["thunder"] + 0.22, "body_whoosh", dur=0.25, gain=-36, seed=52)
    add(S["flash"], "lightning_far", gain=-28, seed=53)
    add(S["shiver"], "sprout_voice", mood="shiver", gain=-30, seed=54)
    add(S["shiver"] + 0.05, "leaf_rustle", dur=0.6, gain=-41, tremble=True, seed=55)
    # ---- B06: the peak far off, the storm's edge advancing: rolling thunder; back on Claude: resolve
    add(at("B06", 0.35), "thunder", dur=3.0, dist=1.6, gain=-27, seed=60)
    add(S["back"] - 0.1, "gust", dur=1.3, gain=-30, seed=61)
    add(S["resolve"] - 0.05, "body_rustle", dur=0.35, gain=-40, seed=62)
    # ---- B07: cup the sprout to the chest, crouch, LAUNCH (an ash burst at the feet)
    add(at("B07", 0.08), "body_rustle", dur=0.4, gain=-36, seed=70)
    add(S["go"] - 0.28, "ash_step", gain=-34, heavy=True, seed=71)                  # (*) the crouch
    add(S["go"], "ash_burst", gain=-22, seed=72)
    # ---- B07-B09: the run up the ash slope: four-legged gallop on the music's eighths, ash kicking up
    k, t = 1, go(0.5)
    while t < S["slip"] - 0.05:
        wide = t >= start("B08")
        g = -31 if not wide else -34
        add(t, "ash_step", gain=g, run=True, pan=0.15 * ((k % 2) * 2 - 1), seed=100 + 2 * k)
        add(t + 0.075, "ash_step", gain=g - 3, run=True, pan=-0.1, seed=101 + 2 * k)
        if k % 3 == 0:
            add(t + 0.03, "ash_kick", gain=g - 4, seed=300 + k)
        k += 1
        t = go(0.5 * k)
    for i, tt in enumerate((at("B08", 0.35), at("B08", 1.5))):                        # (*) wind streaking past
        add(tt, "wind_streak", dur=0.9, gain=-31, direction=(-1) ** i, seed=80 + i)
    add(at("B08", 0.9), "thunder", dur=3.2, dist=1.3, gain=-26, seed=82)
    # ---- B09: the slope collapses: crack, scree slide, the tumble (body thuds), the stop
    add(S["slip"] - 0.03, "ground_crack", gain=-22, seed=90)
    add(S["slip"] + 0.02, "rockfall", dur=S["stop9"] - S["slip"] + 1.1, gain=-22, seed=91)
    span = S["stop9"] - S["slip"]
    for i, u in enumerate((0.28, 0.52, 0.74)):                                       # (*) the tumble
        add(S["slip"] + u * span, "body_thud", gain=-29 + 2 * i, seed=92 + i)
        add(S["slip"] + u * span + 0.02, "body_whoosh", dur=0.2, gain=-36, seed=95 + i)
    add(S["stop9"], "body_thud", gain=-22, heavy=True, seed=98)
    add(S["stop9"] + 0.03, "ash_puff", gain=-32, seed=99)
    # ---- B10: face down in the ash; it lifts its head (ash falling off), checks the sprout, exhales, pushes up
    add(at("B10", 0.15), "ash_sift", dur=0.6, gain=-38, seed=120)
    add(S["check"] + 0.05, "seed_pulse", gain=-38, seed=121)
    add(S["check"] + 0.25, "sprout_voice", mood="weak", gain=-35, seed=122)
    add(S["up"] - 0.5, "breath", mood="determined", gain=-31, seed=123)
    add(S["up"], "ash_step", gain=-29, heavy=True, seed=124)
    add(S["up"] + 0.05, "body_rustle", dur=0.4, gain=-35, seed=125)
    # ---- B11: rain begins; Claude hauls itself up the ledge one-armed; lightning silhouettes it
    for i, t in enumerate((0.3, 0.95)):                                              # (*) hand on rock, scrape
        add(at("B11", t), "hand_slap", gain=-26, seed=130 + i)
        add(at("B11", t) + 0.08, "rock_scrape", dur=0.45, gain=-33, seed=132 + i)
    add(S["bolt11"] - 0.02, "lightning_crack", gain=-18, seed=134)
    add(S["bolt11"] + 0.08, "thunder", dur=3.5, dist=0.25, gain=-21, seed=135)
    # ---- B12: HAIL: stones smash into the rock and bounce; hits on Claude's body; chips fly off its edges
    add(S["hail"], "hail_burst", gain=-21, seed=140)
    add(S["hail"] + 0.05, "hail_body", dur=S["stop14"] - S["hail"] - 0.05, gain=-27, seed=141)
    for i, t in enumerate(S["chips"]):
        add(t, "chip", gain=-15 + (i % 2), seed=150 + i)
    # ---- B13: wide: tiny Claude under a curtain of hail; the storm enormous; lightning branches across the sky
    add(S["bolt13"] - 0.02, "lightning_crack", gain=-19, far=True, seed=160)
    add(S["bolt13"] + 0.25, "thunder", dur=4.0, dist=0.5, gain=-19, seed=161)
    # ---- B14: the hail stops (hard cut); silence + room tone; Claude uncurls; the reveal; the tear
    for i, t in enumerate((0.1, 0.27, 0.5)):                                       # the last stones, bouncing
        add(S["stop14"] + t, "hail_stone", gain=-37 - 3 * i, seed=170 + i)
    add(S["stop14"] + 0.35, "uncurl", dur=max(0.4, S["reveal"] - S["stop14"] - 0.2), gain=-38, seed=173)
    add(S["reveal"], "body_rustle", dur=0.5, gain=-42, seed=174)
    add(S["reveal"] + 0.1, "seed_hum", dur=1.6, weak=True, gain=-46, seed=175)
    add(S["tear"], "tear", gain=-31, seed=176)
    add(at("B14", 2.9), "thunder", dur=3.0, dist=3.0, gain=-41, seed=177)
    # ---- B15: the sprout's leaf weakly touches Claude's cheek; eyes open; wipes them; turns to the summit
    add(S["touch"] - 0.1, "leaf_rustle", dur=0.35, gain=-41, seed=180)
    add(S["touch"] + 0.05, "sprout_voice", mood="weak", gain=-34, seed=181)
    add(S["set"] - 0.5, "body_rustle", dur=0.45, gain=-39, seed=182)              # (*) the arm wipe
    add(S["set"], "gravel_step", gain=-33, seed=183)
    add(S["set"] + 0.12, "body_whoosh", dur=0.3, gain=-38, seed=184)
    # ---- B16: crawling and limping up the last metres; the clouds tear open; the sunbeam; it kneels in the light
    for i, t in enumerate((0.1, 0.45, 0.95, 1.25)):                                # (*) limping
        add(at("B16", t), "gravel_step", gain=-34 + (i % 2) * 3, seed=190 + i)
    add(at("B16", 0.6), "rock_scrape", dur=0.5, gain=-38, seed=194)
    add(S["beam"] - 0.75, "cloud_tear", dur=1.25, gain=-19, seed=195)
    add(S["beam"] - 0.05, "beam_shimmer", dur=S["plant"] - S["beam"] + 0.5, gain=-30, seed=196)
    add(S["beam"] + 0.8, "gravel_step", gain=-36, heavy=True, seed=197)            # (*) kneels
    # ---- B17: plants the sprout in the soil (a hushed breath); it drinks the light; the glow surges
    add(S["plant"] - 0.35, "breath", mood="inhale", gain=-40, seed=200)
    add(S["plant"], "soil_plant", gain=-31, seed=201)
    add(S["surge"] - 0.15, "glow_surge", dur=S["wave"] - S["surge"] + 0.35, gain=-23, seed=202)
    add(S["surge"] + 0.35, "sprout_voice", mood="happy_again", gain=-30, seed=203)
    # ---- B18: THE BLOOM: a rushing wave of growth across the valley; leaves, blossoms popping; birds arrive
    wl = S["wave_end"] - S["wave"]
    add(S["wave"] - 0.08, "bloom_wave", dur=wl + 0.9, gain=-19, seed=210)
    add(S["wave"] + 0.1, "blossom_pops", dur=wl, gain=-29, seed=211)
    add(S["wave"] + 0.3, "leaf_rustle", dur=wl, gain=-33, wide=True, seed=212)
    add(S["wave_end"] - 0.5, "birds", dur=end("B19") - S["wave_end"] + 0.6, gain=-33, density=0.9, seed=213)
    # ---- B19: colour and petals wash over Claude; it laughs through tears; the sapling leans against it
    add(at("B19", 0.1), "petal_swirl", dur=2.2, gain=-36, seed=220)
    add(S["lean"] - 0.1, "leaf_rustle", dur=0.6, gain=-37, seed=221)
    add(S["lean"] + 0.25, "sprout_voice", mood="happy", gain=-34, seed=222)
    # ---- B20: years later: the new swing rocking gently, birds, a breeze; a leaf lands on Claude's head (a pat)
    for i, t in enumerate((0.25, 2.05, 3.85)):
        add(at("B20", t), "swing_creak", gain=-40 - i, mood="happy", pan=0.2, seed=230 + i)
    add(start("B20") - 0.1, "birds", dur=end("B20") - start("B20") + 0.3, gain=-36, density=0.6, seed=233)
    add(S["pat"] - 0.02, "leaf_land", gain=-29, seed=234)
    return sorted(F, key=lambda e: e[0])


FOLEY = _foley()

# ------------------------------------------------------------------------------------------- ambience beds
# kinds (foley.bed): ash_wind (desolate valley wind + falling-ash hush + ember crackle), ash_close (the same, close
# and quiet), storm_wind (gusting, the storm rolling in), storm_run (wind streaming past + rumble), storm_rain,
# storm_hail (hail roar on rock + rain + howl), hush (after the hail: drips, faint wind), summit_wind (thin high
# wind), summit_light (the wind settling in the beam), meadow (breeze, leaves, distant birds), coda (warm afternoon)
BEDS = sorted([
    (start("B01"), end("B01"), "ash_wind", -36),
    (start("B02"), end("B03"), "ash_close", -41),
    (start("B04"), SYNC["thunder"], "ash_close", -47),
    (SYNC["thunder"], end("B05"), "storm_wind", -37),
    (start("B06"), end("B06"), "storm_wind", -35),
    (start("B07"), end("B07"), "storm_wind", -37),
    (start("B08"), end("B09"), "storm_run", -34),
    (start("B10"), end("B10"), "storm_run", -38),
    (start("B11"), SYNC["hail"], "storm_rain", -32),
    (SYNC["hail"], end("B12"), "storm_hail", -33),
    (start("B13"), SYNC["stop14"], "storm_hail", -32),
    (SYNC["stop14"], end("B15"), "hush", -52),
    (start("B16"), SYNC["beam"], "summit_wind", -40),
    (SYNC["beam"], end("B17"), "summit_light", -47),
    (start("B18"), end("B19"), "meadow", -43),
    (start("B20"), DURATION, "coda", -45),
])

SPACE = {}
for _s, *_r in SHOTS:
    _i = int(_s[1:])
    SPACE[_s] = ("valley" if _i <= 10 else "storm" if _i <= 13 else "rock" if _i <= 15 else
                 "summit" if _i <= 17 else "meadow")

# ------------------------------------------------------------------------------------------- mix automation
DUCK = [   # (t, depth_db, attack_s, hold_s, release_s)
    (SYNC["crack"], -2.0, 0.03, 0.15, 0.3),
    (SYNC["sigh"], -1.5, 0.15, 0.4, 0.5),
    (SYNC["tear"], -1.5, 0.03, 0.2, 0.4),
    (SYNC["pat"], -1.5, 0.03, 0.2, 0.4),
] + [(t, -3.0, 0.01, 0.12, 0.25) for t in SYNC["chips"]] + [
    (SYNC["thunder"], -3.0, 0.05, 0.8, 1.2),
    (SYNC["slip"], -2.0, 0.03, 0.8, 0.6),
    (SYNC["bolt11"], -2.0, 0.02, 0.3, 0.6),
    (SYNC["bolt13"], -1.5, 0.02, 0.3, 0.6),
]

# the thunder kills the hope cue; the hail stop kills the drive; the beam's chord (and its hall tail) falls away in
# 0.4 s into the hushed breath of the planting
MUSIC_CUTS = [SYNC["thunder"], SYNC["stop14"], (SYNC["plant"], 0.06, 0.34)]

MUTE = [(SYNC["stop14"], SYNC["reveal"] - 0.02, 0.01)]   # nothing but room tone until the reveal

HARD_CUTS = [SYNC["stop14"]]                   # the hail (and its reverb) stops dead

# Playback-range ride (whole mix, before the master): lifts the quiet passages so the film reads on laptop and phone
# speakers (target LRA ~11-12 LU) while B14's stop -> reveal stays the quietest stretch and B18 the loudest.
# (t0, t1, gain_db, ramp_s): ramps are centred on t0 / t1; segments may abut (the gain then crossfades).
RIDE = [
    (0.0, start("B04"), 4.5, 0.05),
    (start("B04"), SYNC["thunder"] - 0.12, 3.0, 0.3),         # back to 0 just before the thunder smashes in
    (start("B06"), SYNC["resolve"], 2.0, 0.4),
    (SYNC["stop14"] + 0.08, SYNC["reveal"] - 0.1, 2.0, 0.15),  # room tone: present but soft
    (SYNC["reveal"] - 0.1, end("B15") - 0.2, 4.5, 0.2),       # the lone piano, the touch, the ostinato's return
    (start("B19") + 0.3, start("B20"), 2.0, 0.6),
    (start("B20"), DURATION + 1.0, 4.0, 0.4),
]

SECTIONS = [   # (label, t0, t1, intent)
    ("I. ash B01-B03", start("B01"), end("B03"), "near silence: wind, one low note, grief"),
    ("hope B04", start("B04"), end("B04"), "the Bloom theme on celesta, peak on T_CURL"),
    ("threat B05-B06", start("B05"), end("B06"), "thunder, dissonance, horn head on T_RESOLVE"),
    ("drive B07-B10", start("B07"), end("B10"), "ostinato from T_GO; slip/stop hits"),
    ("climb B11-B13", start("B11"), SYNC["stop14"], "rain, hail, chips: max tension"),
    ("LOW POINT B14 (after stop)", SYNC["stop14"], end("B14"), "music out; lone broken piano; QUIETEST"),
    ("resolve B15", start("B15"), end("B15"), "celesta echo of the curl; ostinato returns"),
    ("beam B16-B17", start("B16"), end("B17"), "swell to the beam, choir; hush; surge"),
    ("BLOOM B18", start("B18"), end("B18"), "the theme, full orchestra: LOUDEST"),
    ("joy B19", start("B19"), end("B19"), "warm, the theme in strings"),
    ("coda B20", start("B20"), DURATION, "music box, title chord, fade"),
]

SILENCE_CHECKS = [   # (label, t0, t1, bus)
    ("B14: music silent after the stop", SYNC["stop14"] + 0.05, SYNC["reveal"] - 0.05, "music"),
    ("B14: room tone only (mix)", SYNC["stop14"] + 0.6, SYNC["reveal"] - 0.05, "mix"),
    ("B14: lone piano to the B15 cut (music)", SYNC["reveal"], end("B14"), "music"),
    ("B17: the hushed breath (music)", SYNC["plant"] + 0.15, SYNC["surge"] - 0.05, "music"),
    ("film start (mix, first 0.3 s)", 0.0, 0.3, "mix"),
]
