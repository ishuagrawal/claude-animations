"""Sound cue sheet — the ONE place that holds event times for score sync, foley, ambience and mix automation.

Every time is absolute seconds, written as at(SHOT, local) = shot start (from src/timeline.py) + shot-local
seconds, so re-timing a shot in the timeline moves its sounds with it. Named picture events come from the shots'
own T_*/BL_* constants (see K below).

Sections:
  SYNC      named music sync points (blinks, hits, cuts) read by score.py
  FOLEY     (t, kind, params) one-shot / ranged effects rendered by foley.py
  BEDS      ambience bed segments (t0, t1, kind, level_db)
  SPACE     acoustic space per shot (reverb choice for foley)
  DUCK      music ducking under key effects (t, depth_db, attack, hold, release)
  MUTE      hard music mutes (smash cuts): (t0, t1, fade_in_out_s)
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))          # src/ (timeline, lu.anim)

from timeline import SHOT, SHOTS, bar  # noqa: E402,F401  (bar is re-exported for foley/report)

DURATION = 240.0


def at(shot, local):
    return round(SHOT[shot][0] + local, 4)


def start(shot):
    return SHOT[shot][0]


def end(shot):
    return SHOT[shot][1]


# ------------------------------------------------------------------------------------------- shot constants
# read straight from the module-level T_*/BL_* constants in src/shots/*.py, so picture and sound can't drift apart
def _consts(shot):
    import ast
    src = open(os.path.join(os.path.dirname(HERE), "shots", shot.lower() + ".py")).read()
    out = {}
    for node in ast.parse(src).body:
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
    return out


def K(shot, name, default):
    return _consts(shot).get(name, default)


S07_HIT = K("S07", "T_HIT", 2.55)
S08_BURST, S08_LAND = K("S08", "T_BURST", 0.12), K("S08", "T_LAND", 0.42)
S09_FLARE = K("S09", "T_FLARE", 2.4)
S11_HISS = K("S11", "T_HISS", 2.05)
M02_TAPS = (0.53, 1.13, 1.73)          # hammer impacts: key times 0.35/0.95/1.55 + 0.18 snap
M02_HOP, M02_IN = K("M02", "T_HOP", 2.55), K("M02", "T_IN", 3.05)
M03_FALLS, M03_LIFT = (1.05, 2.25), 3.4
M06_BLINK_C, M06_BLINK_S = K("M06", "BLINKS_C", (0.85, 1.35)), K("M06", "BLINKS_S", (2.55, 3.05))
M07_YANK, M07_SNEEZE = K("M07", "T_YANK", 1.0), 1.9
M09_THROW, M09_MELT = K("M09", "T_THROW", 1.0), K("M09", "T_MELT", 1.6)
M10_DROOP, M10_SCOOP = K("M10", "T_DROOP", 2.3), K("M10", "T_SCOOP", 3.0)
H03_CLOSE, H03_TOP = K("H03", "T_CLOSE", (0.5, 1.6)), K("H03", "T_TOP", 2.3)
H05_TRY = K("H05", "T_TRY", (1.0, 2.2))
L04_TELESCOPE = K("L04", "T_DROP", 6.2)
L06_BLINK_C, L06_BLINK_S = K("L06", "BL_C", (4.0, 4.5)), K("L06", "BL_S", (5.6, 6.1))
L07_IGNITE = K("L07", "T_IGNITE", 2.1)
L08_BEAM, L08_LAND = K("L08", "T_BEAM", 2.7), K("L08", "T_LAND", 6.0)
C02_BLINK_C, C02_BLINK_S = K("C02", "BL_C", (4.0, 4.5)), K("C02", "BL_S", (6.0, 6.5))

SYNC = {
    "S04_thunk": at("S04", 2.26),
    "S05_lamp_out": at("S05", 1.05),
    "S06_flicker": [at("S06", t) for t in (0.6, 1.5, 2.1, 2.75)],
    "S07_hero": at("S07", 0.95),
    "S07_hit": at("S07", S07_HIT),
    "S08_burst": at("S08", S08_BURST),
    "S08_land": at("S08", S08_LAND),
    "S09_flare": at("S09", S09_FLARE),
    "S10_look_up": at("S10", 2.0),
    "S11_hiss": at("S11", S11_HISS),
    "S12_bowl": at("S12", 1.3),
    "M02_taps": [at("M02", t) for t in M02_TAPS],
    "M02_in": at("M02", M02_IN),
    "M03_falls": [at("M03", t) for t in M03_FALLS],
    "M03_lift": at("M03", M03_LIFT),
    "M04_dizzy": at("M04", 3.0),
    "M06_blink_claude": [at("M06", t) for t in M06_BLINK_C],
    "M06_blink_star": [at("M06", t) for t in M06_BLINK_S],
    "M07_yank": at("M07", M07_YANK),
    "M07_sneeze": at("M07", M07_SNEEZE),
    "M07_peek": at("M07", 3.0),
    "M09_throw": at("M09", M09_THROW),
    "M09_melt": at("M09", M09_MELT),
    "M10_droop": at("M10", M10_DROOP),
    "M10_scoop": at("M10", M10_SCOOP),
    "D02_brave": at("D02", 1.25),
    "D02_slip": at("D02", 3.2),
    "D03_eyepiece": at("D03", 1.9),
    "D03_turn": at("D03", 3.7),
    "D04_lamp": at("D04", 1.0),
    "H02_flicker": [at("H02", t) for t in (0.3, 1.0, 1.7, 2.3, 2.9, 3.5)],
    "H03_shut": at("H03", H03_CLOSE[1]),
    "H03_top": at("H03", 2.55),
    "H05_drop": at("H05", H05_TRY[1]),
    "L04_telescope": at("L04", L04_TELESCOPE),
    "L06_blink_claude": [at("L06", t) for t in L06_BLINK_C],
    "L06_blink_star": [at("L06", t) for t in L06_BLINK_S],
    "L07_ignite": at("L07", L07_IGNITE),
    "L08_beam": at("L08", L08_BEAM),
    "L08_land": at("L08", L08_LAND),
    "C02_blink_claude": [at("C02", t) for t in C02_BLINK_C],
    "C02_blink_star": [at("C02", t) for t in C02_BLINK_S],
}


# ------------------------------------------------------------------------------------------- footsteps
def _footfalls(shot, pts, stride, t_from=0.0, t_to=None, every=1):
    """Footfall times from a shot's walk path (same Path + stride the animation uses: a foot pair lands every
    `stride` metres travelled). pts are the shot's (t, x, y) path keys (world offsets don't matter)."""
    from lu.anim import Path
    import numpy as np
    p = Path(pts, ease_="inout" if shot != "S02" else "smooth")
    t_to = pts[-1][0] if t_to is None else t_to
    ts = np.arange(t_from, t_to, 1 / 240)
    d = np.array([p.dist(t) for t in ts])
    k = np.floor(d / stride).astype(int)
    hits = ts[1:][np.diff(k) > 0]
    return [at(shot, float(t)) for i, t in enumerate(hits) if i % every == 0]


def _s02_steps():
    import math
    a = math.radians(112)
    pile = (math.cos(a) * 2.35, math.sin(a) * 2.35)
    stop = (pile[0] + 0.55, pile[1] - 0.95)
    return _footfalls("S02", [(0.0, 0.15, -1.95), (1.25, -0.2, -0.35), (2.5, stop[0], stop[1])], 0.11, every=2)


def _s09_steps():
    return _footfalls("S09", [(0.0, -1.75, -0.45), (1.9, -1.3, 0.25), (2.4, -1.22, 0.36), (2.9, -1.3, 0.25),
                              (5.0, -0.95, 0.82)], 0.07, every=2)


def _s12_steps():
    far, near = 1.45, 0.72                 # distances from the crater along `toward`
    return _footfalls("S12", [(0.0, 0.0, far), (1.0, 0.0, near), (1.6, 0.0, near), (2.8, 0.0, far + 0.1)], 0.08,
                      every=2)


# ------------------------------------------------------------------------------------------- foley events
def _foley():
    F = []

    def add(t, kind, **p):
        F.append((round(t, 4), kind, p))

    # S01 — dusk: slow sail creaks
    for t in (0.9, 3.4, 5.6, 7.7):
        add(at("S01", t), "sail_creak", gain=-24, dist=1.0, seed=int(t * 10))
    # S02 — sack haul
    add(at("S02", 0.0), "sack_drag", dur=2.6, gain=-25, seed=2)
    for i, t in enumerate(_s02_steps()):
        add(t, "footstep", gain=-34, surface="wood", seed=200 + i)
    add(at("S02", 2.75), "cloth_whoosh", dur=0.45, gain=-32, seed=21)
    add(at("S02", 3.45), "sack_thump", gain=-17, seed=22)
    add(at("S02", 3.47), "dust_poof", gain=-31, seed=23)
    add(at("S02", 3.8), "cloth_rustle", dur=0.45, gain=-36, seed=24)
    add(at("S02", 4.6), "cloth_rustle", dur=0.6, gain=-38, seed=25)
    # S03 — tea alone
    add(at("S03", 0.7), "cup_clink", gain=-33, seed=31)
    add(at("S03", 2.0), "cup_set", gain=-28, seed=32)
    add(at("S03", 0.0), "candle", dur=5.0, gain=-44, seed=33)
    add(at("S03", 3.9), "cloth_rustle", dur=0.5, gain=-40, seed=34)
    # S04 — shutters (two leaves, slightly staggered), heard from outside
    add(at("S04", 1.45), "shutter_creak", dur=0.8, gain=-29, seed=41)
    add(at("S04", 1.55), "shutter_creak", dur=0.75, gain=-32, seed=42, pitch=1.15)
    add(at("S04", 2.26), "shutter_thunk", gain=-21, seed=43)
    add(at("S04", 2.33), "shutter_thunk", gain=-24, seed=44)
    # S05 — lamp blown out
    add(at("S05", 0.95), "lamp_blow", gain=-34, seed=51)
    # S06 — sleeping, meteors outside (muffled)
    add(at("S06", 0.0), "breathing", dur=3.4, gain=-49, rate=0.22, seed=61)
    for i, t in enumerate((0.6, 1.5, 2.1, 2.75)):
        add(at("S06", t - 0.1), "meteor_swish", dur=0.6, gain=-41, muffled=True, seed=62 + i)
    # S07 — meteor shower, the hero streak, impact on the cap
    for i, t in enumerate((0.15, 0.55, 1.3, 1.75, 2.1, 2.9)):
        add(at("S07", t), "meteor_swish", dur=0.7, gain=-30 - 3 * (i % 3), pan=(-0.6 + 0.25 * i), seed=70 + i)
    add(at("S07", 0.95), "meteor_whistle", dur=S07_HIT - 0.95, gain=-18, seed=77)
    add(at("S07", S07_HIT), "impact_boom", gain=-9, seed=78)
    add(at("S07", S07_HIT + 0.01), "wood_crack", gain=-15, seed=79)
    add(at("S07", S07_HIT + 0.05), "sparks", dur=0.9, gain=-28, seed=80)
    # S08 — crash through the ceiling
    add(at("S08", S08_BURST), "wood_crack", gain=-10, big=True, seed=81)
    add(at("S08", S08_BURST), "fall_whoosh", dur=S08_LAND - S08_BURST, gain=-17, seed=82)
    add(at("S08", S08_LAND), "flour_thud", gain=-8, seed=83)
    add(at("S08", S08_LAND + 0.02), "flour_poof", gain=-22, seed=84)
    add(at("S08", S08_LAND + 0.05), "star_sizzle", dur=2.0, gain=-30, seed=85)
    add(at("S08", 0.6), "quilt_rustle", dur=0.5, gain=-28, seed=86)
    add(at("S08", 0.5), "splinter_clatter", dur=1.0, gain=-24, seed=87)
    add(at("S08", 1.4), "quilt_rustle", dur=1.0, gain=-42, seed=88, tremble=True)
    # S09 — creeping toward the glow
    for i, t in enumerate(_s09_steps()):
        add(t, "footstep", gain=-40, surface="wood", soft=True, seed=900 + i)
    add(at("S09", 1.1), "floor_creak", gain=-36, seed=91)
    add(at("S09", 0.0), "star_hum", dur=5.0, gain=-33, flicker=True, seed=92)
    add(at("S09", S09_FLARE), "flare_whoomph", gain=-16, seed=93)
    add(at("S09", S09_FLARE + 0.12), "cloth_whoosh", dur=0.25, gain=-31, seed=94)
    # S10 — the reveal
    add(at("S10", 0.0), "star_hum", dur=4.2, gain=-31, flicker=True, seed=101)
    add(at("S10", 0.0), "tremble_tinkle", dur=4.2, gain=-37, seed=102)
    add(at("S10", 0.0), "smoke_hiss", dur=3.5, gain=-41, seed=103)
    add(at("S10", 2.3), "straw_rustle", dur=1.6, gain=-38, seed=104)
    # S11 — the hiss
    add(at("S11", 0.3), "broom_clack", gain=-27, seed=111)
    add(at("S11", 0.0), "star_hum", dur=S11_HISS - 0.05, gain=-34, flicker=True, seed=112)
    add(at("S11", S11_HISS), "hiss_crackle", gain=-12, seed=113)
    add(at("S11", S11_HISS + 0.1), "yank_whoosh", gain=-22, seed=114)
    add(at("S11", S11_HISS + 0.45), "arm_flaps", dur=0.85, gain=-28, rate=6.0, seed=115)
    add(at("S11", S11_HISS + 0.3), "smoke_hiss", dur=1.4, gain=-40, seed=116)
    add(at("S11", S11_HISS + 0.2), "star_hum", dur=4.2 - S11_HISS - 0.2, gain=-32, flicker=True, seed=117)
    # S12 — the offering
    for i, t in enumerate(_s12_steps()):
        add(t, "footstep", gain=-40, surface="wood", soft=True, seed=1200 + i)
    add(at("S12", 1.3), "bowl_clunk", gain=-24, seed=121)
    add(at("S12", 1.33), "water_slosh", gain=-33, seed=122)
    add(at("S12", 1.35), "blanket_slide", dur=0.4, gain=-33, seed=123)
    add(at("S12", 2.85), "quilt_rustle", dur=0.5, gain=-36, seed=124)
    add(at("S12", 0.0), "star_hum", dur=2.85, gain=-38, seed=125)
    # S13 — dawn
    add(at("S13", 0.0), "stove", dur=5.0, gain=-34, seed=131)
    add(at("S13", 0.0), "star_breath", dur=2.4, gain=-36, rate=2.1, seed=132)
    add(at("S13", 2.6), "quilt_rustle", dur=0.6, gain=-36, seed=133)
    add(at("S13", 3.9), "quilt_rustle", dur=0.5, gain=-38, seed=134)
    # M01
    add(at("M01", 0.05), "cloth_rustle", dur=0.4, gain=-36, seed=141)
    add(at("M01", 0.0), "star_hum", dur=4.2, gain=-40, seed=142)
    add(at("M01", 2.8), "cloth_rustle", dur=0.5, gain=-40, seed=143)
    # M02 — lantern
    for i, t in enumerate(M02_TAPS):
        add(at("M02", t), "hammer_tap", gain=-21, seed=150 + i)
    add(at("M02", 2.1), "lantern_door", gain=-32, seed=154)
    add(at("M02", M02_HOP), "hop_whoosh", gain=-34, seed=155)
    add(at("M02", M02_IN), "glass_tinkle", gain=-24, seed=156)
    add(at("M02", 0.0), "stove", dur=5.0, gain=-40, seed=157)
    # M03 — flying lessons
    for i, t in enumerate((0.35, 1.55, 2.85)):
        add(at("M03", t), "hop_whoosh", gain=-32, seed=160 + i)
    for i, t in enumerate(M03_FALLS):
        add(at("M03", t), "flower_thump", gain=-25, seed=163 + i)
    add(at("M03", M03_LIFT), "sparkle", gain=-27, seed=165)
    for i, t in enumerate((3.55, 3.9, 4.25, 4.6)):
        add(at("M03", t), "footstep", gain=-36, surface="grass", seed=166 + i)
    # M04 — the loop round the sails
    add(at("M04", 0.0), "sparkle_whoosh", dur=3.2, gain=-26, seed=170)
    for t in (0.6, 2.4):
        add(at("M04", t), "sail_creak", gain=-30, dist=0.6, seed=171 + int(t))
    for i in range(10):
        add(at("M04", 0.2 + 0.3 * i), "footstep", gain=-42, surface="grass", soft=True, seed=175 + i)
    # M05 — mending canvas at night
    for i, t in enumerate((0.4, 1.2, 2.0, 2.6)):
        add(at("M05", t), "stitch", gain=-34, seed=180 + i)
    add(at("M05", 0.0), "star_hum", dur=4.2, gain=-42, seed=185)
    # M06 — goodnight
    add(at("M06", 0.2), "quilt_rustle", dur=0.5, gain=-42, seed=190)
    add(at("M06", 4.1), "quilt_rustle", dur=0.8, gain=-42, seed=191)
    # M07 — the telescope
    add(at("M07", M07_YANK - 0.05), "sheet_whoosh", gain=-19, seed=200)
    add(at("M07", M07_YANK + 0.05), "dust_poof", gain=-28, big=True, seed=201)
    add(at("M07", M07_SNEEZE), "sneeze_puff", gain=-24, seed=202)
    add(at("M07", 2.0), "hop_whoosh", gain=-33, seed=203)
    add(at("M07", 2.42), "metal_tink", gain=-34, seed=204)
    # M08 — the gallery
    add(at("M08", 0.4), "cloth_rustle", dur=0.5, gain=-40, seed=210)
    add(at("M08", 2.9), "cloth_rustle", dur=0.4, gain=-42, seed=211)
    # M09 — snowball
    add(at("M09", 0.55), "snow_crunch", gain=-34, seed=220)
    add(at("M09", M09_THROW), "throw_whoosh", gain=-24, seed=221)
    add(at("M09", M09_MELT), "steam_sizzle", gain=-21, seed=222)
    for i, t in enumerate((2.0, 2.3, 2.62, 2.95, 3.3, 3.62)):
        add(at("M09", t), "snow_crunch", gain=-36, seed=223 + i)
    # M10 — fireflies
    add(at("M10", 0.0), "fireflies", dur=4.2, gain=-40, seed=230)
    add(at("M10", 0.05), "hop_whoosh", gain=-36, seed=231)
    add(at("M10", 0.85), "hop_whoosh", gain=-37, seed=232)
    add(at("M10", M10_SCOOP), "cloth_rustle", dur=0.6, gain=-33, seed=233)
    # M11 — the cliff edge
    add(at("M11", 4.1), "cloth_rustle", dur=0.8, gain=-42, seed=240)
    # D01-D04 — dimming
    add(at("D01", 1.8), "cloth_rustle", dur=0.4, gain=-44, seed=300)
    add(at("D01", 0.0), "star_hum", dur=5.0, gain=-44, seed=301)
    add(at("D02", 0.0), "stove", dur=5.0, gain=-36, seed=310)
    for i, t in enumerate((0.15, 0.45, 2.95, 3.3, 3.62, 4.0, 4.4)):
        add(at("D02", t), "bench_tap", gain=-33, seed=311 + i)
    add(at("D02", 0.9), "hop_whoosh", gain=-38, seed=320)
    add(at("D03", 0.0), "candle", dur=6.6, gain=-44, seed=330)
    add(at("D03", 0.5), "telescope_squeak", gain=-38, seed=331)
    add(at("D03", 4.0), "cloth_rustle", dur=0.8, gain=-42, seed=332)
    add(at("D04", 1.0), "lamp_clink", gain=-25, seed=340)
    add(at("D04", 1.3), "footstep", gain=-38, surface="wood", soft=True, seed=341)
    add(at("D04", 1.62), "footstep", gain=-39, surface="wood", soft=True, seed=342)
    # H01-H05 — holding on
    for i in range(10):
        add(at("H01", 0.1 + 0.33 * i), "meteor_swish", dur=0.7, gain=-33 - 2 * (i % 3), pan=-0.7 + 0.15 * i, seed=400 + i)
    for i, t in enumerate((0.3, 1.0, 1.7, 2.3, 2.9, 3.5)):
        add(at("H02", t - 0.1), "meteor_swish", dur=0.6, gain=-37, muffled=True, seed=410 + i)
    add(at("H02", 1.6), "star_rise", dur=2.6, gain=-30, seed=420)
    add(at("H02", 2.4), "chair_scrape", gain=-33, seed=421)
    add(at("H03", 0.15), "footstep", gain=-34, surface="wood", seed=430)
    add(at("H03", H03_CLOSE[0]), "shutter_creak", dur=1.1, gain=-27, seed=431)
    add(at("H03", H03_CLOSE[0] + 0.1), "shutter_creak", dur=1.0, gain=-30, seed=432, pitch=1.12)
    add(at("H03", H03_CLOSE[1] - 0.04), "shutter_thunk", gain=-18, seed=433)
    add(at("H03", H03_CLOSE[1] + 0.03), "shutter_thunk", gain=-21, seed=434)
    add(at("H03", 2.05), "footstep", gain=-31, surface="wood", seed=435)
    add(at("H03", 2.55), "top_flick", gain=-29, seed=436)
    add(at("H03", 2.56), "top_whir", dur=2.45, gain=-31, seed=437)
    for i in range(18):
        add(at("H04", 0.05 + 0.18 * i), "meteor_swish", dur=0.7, gain=-30 - 2 * (i % 4), pan=-0.8 + 0.09 * i, seed=440 + i)
    add(at("H05", 1.4), "tremble_tinkle", dur=0.8, gain=-35, seed=460)
    add(at("H05", H05_TRY[1]), "drop_thud", gain=-26, seed=461)
    add(at("H05", 4.45), "cloth_rustle", dur=0.9, gain=-42, seed=462)
    # L01-L08 — letting go
    add(at("L01", 0.6), "page_turn", gain=-32, seed=500)
    add(at("L01", 2.6), "cloth_rustle", dur=0.6, gain=-36, seed=501)
    add(at("L01", 4.2), "footstep", gain=-30, surface="wood", seed=502)
    for i, t in enumerate((0.5, 1.7, 2.6, 4.3)):
        add(at("L02", t), "canvas_rip", dur=0.7, gain=-22, seed=510 + i)
    for i in range(6):
        add(at("L02", 3.6 + 0.42 * i), "stitch", gain=-30, seed=520 + i)
    for i, t in enumerate((0.2, 1.1, 2.3, 3.4, 4.4)):
        add(at("L03", t), "rope_creak", gain=-28, seed=530 + i)
    add(at("L03", 0.3), "canvas_fill", dur=1.6, gain=-24, seed=536)
    for i, (t, g) in enumerate(((0.3, -16), (2.9, -20), (5.0, -17), (7.2, -21))):
        add(at("L04", t), "thunder", gain=g, seed=540 + i)
    for i, t in enumerate((1.6, 4.0)):
        add(at("L04", t), "canvas_rip", dur=0.9, gain=-20, seed=550 + i)
    add(at("L04", 0.0), "canvas_flap", dur=8.33, gain=-33, seed=552)
    add(at("L04", L04_TELESCOPE), "telescope_toss", gain=-20, seed=553)
    add(at("L05", 0.0), "canvas_flap", dur=3.33, gain=-29, seed=560)
    add(at("L05", 1.2), "thunder", gain=-20, seed=561)
    add(at("L07", L07_IGNITE - 0.3), "ignition", gain=-17, seed=570)
    add(at("L08", L08_BEAM - 0.2), "beam_shimmer", dur=3.0, gain=-30, seed=580)
    add(at("L08", L08_LAND), "landing_thump", gain=-17, seed=581)
    add(at("L08", L08_LAND + 0.05), "rope_creak", gain=-30, seed=582)
    # C01-C03 — coda
    for t in (0.8, 3.4, 6.0):
        add(at("C01", t), "sail_creak", gain=-30, dist=0.8, seed=600 + int(t))
    add(at("C01", 4.5), "metal_tink", gain=-38, seed=605)
    return sorted(F, key=lambda e: e[0])


FOLEY = _foley()

# ------------------------------------------------------------------------------------------- ambience beds
# kinds: room_day, room_night, ext_dusk, ext_day, ext_night, ext_winter, storm, high_wind, meadow_night
_BED_BY_SHOT = {   # (bed kind, level dB RMS before the master gain)
    "S01": ("ext_dusk", -41), "S02": ("room_day", -47), "S03": ("room_day", -48), "S04": ("ext_dusk", -41),
    "S05": ("ext_night", -43), "S06": ("room_night", -54), "S07": ("ext_night", -43), "S08": ("room_night", -50),
    "S09": ("room_night", -51), "S10": ("room_night", -52), "S11": ("room_night", -52), "S12": ("room_night", -52),
    "S13": ("room_dawn", -46),
    "M01": ("room_day", -49), "M02": ("room_day", -49), "M03": ("ext_day", -40), "M04": ("ext_day", -40),
    "M05": ("ext_night", -44), "M06": ("room_night", -54), "M07": ("room_winter", -48), "M08": ("ext_night", -45),
    "M09": ("ext_winter", -41), "M10": ("meadow_night", -42), "M11": ("ext_autumn", -42),
    "D01": ("room_night", -52), "D02": ("room_day", -49), "D03": ("room_night", -52), "D04": ("room_dawn", -48),
    "H01": ("ext_night", -43), "H02": ("room_night", -51), "H03": ("room_night", -51), "H04": ("ext_night", -42),
    "H05": ("room_cold", -50),
    "L01": ("room_night", -50), "L02": ("ext_night", -42), "L03": ("ext_wind", -37), "L04": ("storm", -32),
    "L05": ("storm", -31), "L06": ("high_wind", -50), "L07": ("high_wind", -48), "L08": ("storm_dark", -35),
    "C01": ("ext_day", -40), "C02": ("ext_night", -47), "C03": ("ext_night", -48),
}
BEDS = [(start(s), end(s), *_BED_BY_SHOT[s]) for s, *_ in SHOTS if s != "L08"]
# L08 splits: the dark storm until the beam finds them, then the weather falls away as they are guided home
BEDS += [(start("L08"), at("L08", L08_BEAM + 0.8), "storm_dark", -35),
         (at("L08", L08_BEAM + 0.8), end("L08"), "ext_wind", -45)]
BEDS.sort()

# acoustic space per shot -> foley reverb ("room" = small wooden interior, "open" = mountain exterior,
# "storm" = dense weather, "sky" = above the clouds)
SPACE = {s: ("room" if _BED_BY_SHOT[s][0].startswith("room") else
             "storm" if _BED_BY_SHOT[s][0].startswith("storm") else
             "sky" if _BED_BY_SHOT[s][0] == "high_wind" else "open") for s, *_ in SHOTS}

# ------------------------------------------------------------------------------------------- mix automation
DUCK = [   # (t, depth_db, attack_s, hold_s, release_s): music dips under these effects
    (SYNC["S07_hit"], -5, 0.02, 0.3, 0.6),
    (SYNC["S08_burst"], -4, 0.02, 0.3, 0.5),
    (SYNC["S09_flare"], -3, 0.03, 0.2, 0.5),
    (SYNC["S11_hiss"], -4, 0.02, 0.25, 0.5),
    (SYNC["M07_yank"], -2, 0.05, 0.3, 0.5),
    (SYNC["M09_melt"], -2, 0.05, 0.3, 0.5),
    (SYNC["H03_shut"], -3, 0.02, 0.2, 0.4),
] + [(t, -2.5, 0.05, 0.8, 1.2) for t in (at("L04", 0.3), at("L04", 2.9), at("L04", 5.0), at("L04", 7.2), at("L05", 1.2))]

HARD_CUTS = [   # smash cuts: every foley tail / bed from before the cut is cut dead here (10 ms fade)
    end("H04"),
    end("L05"),
]

MUSIC_CUTS = [   # the score (reverb tails included) stops dead at these instants; what follows starts clean
    SYNC["H03_shut"],
    end("H04"),
    end("L05"),
]

MUTE = [   # hard music mutes (smash cuts): music bus forced to silence in [t0, t1], fades of `f` seconds
    (end("H04"), SYNC["H05_drop"] + 4.0, 0.012),        # H05 silence (the closing low note enters after)
    (end("L05"), end("L05") + 1.6, 0.010),               # L06 smash to silence
]
