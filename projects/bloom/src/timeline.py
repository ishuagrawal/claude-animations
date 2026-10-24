"""Cue sheet: the single source of timing for picture and sound.

Music: 96 BPM, 4/4 -> one beat = 15 frames at 24 fps (0.625 s), one bar = 2.5 s. Shots are laid out on beats (cuts
land on beats); every event time inside a shot is shot-local seconds, and the sound reads the same table
(absolute = SHOT[name][0] + local)."""
FPS = 24
BPM = 96
BEAT = 60.0 / BPM          # 0.625 s = 15 frames
BAR = 4 * BEAT             # 2.5 s


def beat_t(b):
    """Start time (s) of beat b (0-based from the film start)."""
    return b * BEAT


def frame(t):
    return int(round(t * FPS))


# (name, start_beat, end_beat, one-line description)   — beats are 0-based from the film start
SHOTS = [
    # ---- I. ASH: the burnt valley; the old home tree is a stump (fall)
    ("B01", 0, 8, "EWS grey burnt valley, ash falling like snow, charred trunks; tiny orange Claude walks; far off a "
                  "single peak with a patch of sun"),
    ("B02", 8, 13, "MS at the stump of Claude's burnt home tree (a charred swing hangs from it): Claude sifts the ash, "
                   "grieving; a sigh puffs ash"),
    ("B03", 13, 17, "ECU the ash under Claude's hand: a faint green glow pulses; Claude's eyes widen, green in them"),
    ("B04", 17, 24, "CU the last seed of the old tree, glowing; it cracks and sprouts; a leaf curls round Claude's "
                    "finger; Claude's first smile"),
    # ---- II. THE CLOCK: a storm is coming; the only sun is on the peak (rise -> threat)
    ("B05", 24, 28, "Thunder: Claude looks up; a violet storm wall rolls over the ridge, lightning inside; the sprout "
                    "shivers and dims"),
    ("B06", 28, 32, "Claude's POV: the far peak, the last patch of sun on its summit, shrinking as the storm advances; "
                    "back on Claude: resolve"),
    ("B07", 32, 35, "Claude cups the sprout to its chest and RUNS; ash kicks up"),
    # ---- III. THE CLIMB: escalation (faster cuts)
    ("B08", 35, 39, "Tracking wide: Claude races up the ash slope, the storm swallowing the valley behind it"),
    ("B09", 39, 42, "The slope gives way: Claude slides and tumbles down the scree, holding the sprout up"),
    ("B10", 42, 45, "CU face down in ash; Claude lifts its head, checks the sprout (still glowing), gets up"),
    ("B11", 45, 49, "Low angle: Claude hauls itself up a rock ledge one-armed in the rain; lightning silhouettes it"),
    ("B12", 49, 53, "HAIL: Claude curls over the sprout, eyes squeezed shut, taking every hit; chips fly off its body"),
    ("B13", 53, 57, "Wide: tiny Claude curled on the mountainside under a curtain of hail, the storm enormous"),
    ("B14", 57, 62, "The low point: the hail stops; battered, cracked Claude opens its arms: the sprout is dim and "
                    "limp; Claude's face crumples"),
    ("B15", 62, 66, "The sprout's leaf weakly lifts and touches Claude's cheek (the B04 gesture); Claude sets its jaw"),
    # ---- IV. THE BLOOM (rise)
    ("B16", 66, 71, "Claude crawls the last ledge to the summit; the clouds tear open and one golden sunbeam strikes it"),
    ("B17", 71, 75, "CU Claude presses the sprout into the soil in the light; it drinks the light, glows, its leaves "
                    "spread"),
    ("B18", 75, 83, "THE BLOOM: a wave of colour races out from the summit - grass, flowers, leaves bursting on the "
                    "charred trees - down the mountain and across the whole valley; the storm parts into gold"),
    ("B19", 83, 87, "CU Claude, colour washing over its face, laughing through tears; the sapling leans against it"),
    # ---- CODA
    ("B20", 87, 94, "Years later: a great blossoming tree on the summit, a new swing; Claude, its cracks mended with "
                    "gold, naps on the swing; a leaf pats its head; title"),
]

SHOT = {n: (beat_t(a), beat_t(b), d) for (n, a, b, d) in SHOTS}
ORDER = [s[0] for s in SHOTS]
DURATION = beat_t(SHOTS[-1][2])


def shot_frames(name):
    a, b, _ = SHOT[name]
    return frame(a), frame(b)


def local(name, t_abs):
    return t_abs - SHOT[name][0]


def absolute(name, t_local):
    return SHOT[name][0] + t_local


if __name__ == "__main__":
    for n, a, b, d in SHOTS:
        print(f"{n}  {beat_t(a):6.2f}-{beat_t(b):6.2f}  ({beat_t(b) - beat_t(a):4.2f}s)  {d}")
    print("TOTAL", round(DURATION, 2), "s", frame(DURATION), "frames")
