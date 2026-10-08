"""Cue sheet: the single source of timing for picture and sound.

Music: 72 BPM, 4/4 -> one beat = 20 frames at 24 fps, one bar = 3.333 s. Shots are laid out on bars;
every event time inside a shot is expressed relative to its shot start (shot-local seconds) and the
sound reads the same table (absolute = SHOT_START[name] + local)."""
FPS = 24
BPM = 72
BEAT = 60.0 / BPM          # 0.8333 s
BAR = 4 * BEAT             # 3.3333 s


def bar(n):
    """Start time (s) of bar n (1-based)."""
    return (n - 1) * BAR


def beat(n, b):
    """Start time (s) of beat b (1-based) in bar n."""
    return bar(n) + (b - 1) * BEAT


def frame(t):
    return int(round(t * FPS))


# (name, start_bar, end_bar, one-line description)   — bars may be fractional (quarter = 0.25)
SHOTS = [
    # ---- ACT 1: lonely routine (solo piano)
    ("S01", 1.0, 3.5, "EWS dusk: sea of clouds, the peak, the windmill, warm window; title"),
    ("S02", 3.5, 5.0, "INT: Claude hauls a flour sack, plops it on the pile, wipes its brow"),
    ("S03", 5.0, 6.5, "INT: tea alone at the little table; the second stool tucked away"),
    ("S04", 6.5, 7.75, "INT: Claude closes the shutters out of habit; the sheeted telescope beside the window"),
    ("S05", 7.75, 9.5, "EXT night: window light goes out; tilt up to the Claude-shaped constellation missing an eye"),
    # ---- ACT 1b: the fall
    ("S06", 9.5, 10.5, "INT dark: Claude asleep; flickers of light through the shutter slats"),
    ("S07", 10.5, 11.5, "EXT: meteor shower; one streak curves down toward the windmill"),
    ("S08", 11.5, 12.25, "INT: crash through the ceiling; Claude jolts awake"),
    ("S09", 12.25, 13.75, "INT: Claude creeps forward with a broom raised; glow behind the flour pile"),
    ("S10", 13.75, 15.0, "INT: reveal - the little star in a crater of flour, trembling"),
    ("S11", 15.0, 16.25, "INT: Claude reaches out; the star hisses sparks; Claude jerks back, shaking its arm"),
    ("S12", 16.25, 17.5, "INT: Claude leaves a bowl of water and a blanket, backs away, peeks"),
    ("S13", 17.5, 19.0, "INT dawn: the star asleep by the stove; Claude's eyes soften"),
    # ---- ACT 2: montage (full theme)
    ("M01", 19.0, 20.25, "INT: scorched sack with a star-shaped hole; star looks away, sheepish"),
    ("M02", 20.25, 21.75, "INT: Claude builds a lantern; the star climbs in and fits perfectly"),
    ("M03", 21.75, 23.25, "EXT spring: flying lessons - the star tumbles in the flowers; Claude cheers"),
    ("M04", 23.25, 24.5, "EXT: the star loops around the turning sails; Claude spins to follow, dizzy"),
    ("M05", 24.5, 25.75, "EXT night: repairing sail canvas by starlight; a fond glance"),
    ("M06", 25.75, 27.25, "INT night: the goodnight ritual - Claude blinks twice, the star blinks back"),
    ("M07", 27.25, 28.5, "INT winter: Claude pulls the sheet off the telescope; dust; the star peeks in"),
    ("M08", 28.5, 30.5, "EXT night gallery: mapping the sky; the constellation's empty eye"),
    ("M09", 30.5, 31.75, "EXT winter: snowball fight - the star melts it midair"),
    ("M10", 31.75, 33.0, "EXT summer night: fireflies; the star chases them, droops; Claude scoops it up"),
    ("M11", 33.0, 35.0, "EXT autumn golden hour: side by side at the cliff edge; the star leans in"),
    # ---- ACT 2b: dimming (minor)
    ("D01", 35.0, 36.5, "INT night: the star can't light the whole room; Claude notices"),
    ("D02", 36.5, 38.0, "INT: the star hides its dimming by the stove; droops when Claude turns away"),
    ("D03", 38.0, 40.0, "INT night: the telescope on the empty eye; the dim star in its lantern; realisation"),
    ("D04", 40.0, 41.5, "INT day: Claude surrounds the star with lamps in the sunny window"),
    # ---- ACT 2c: holding on
    ("H01", 41.5, 42.5, "EXT night: the meteor shower returns"),
    ("H02", 42.5, 43.75, "INT: the star feels the pull, drifts to the window, brightening"),
    ("H03", 43.75, 45.25, "INT: Claude closes the shutters; distracts the star with a game"),
    ("H04", 45.25, 46.25, "EXT: the shuttered windmill under a blazing sky, unseen"),
    ("H05", 46.25, 48.5, "INT grey dawn: the star can't fly; Claude can't meet its eyes"),
    # ---- ACT 3: letting go
    ("L01", 48.5, 50.0, "INT: the comet drawing in the star book; Claude straightens"),
    ("L02", 50.0, 52.0, "EXT/INT night: cutting the canvas from the sails; sewing the balloon"),
    ("L03", 52.0, 53.5, "EXT night: the balloon lifts off the peak; comet overhead"),
    ("L04", 53.5, 56.0, "STORM: lightning, ice, shredding canvas; overboard - the telescope"),
    ("L05", 56.0, 57.0, "STORM: the star's last light lifts them through the cloud tops"),
    ("L06", 57.0, 60.0, "ABOVE: silence and stars; the star won't leave; blink twice; it rises"),
    ("L07", 60.0, 61.5, "SKY: the star ignites into the constellation's eye"),
    ("L08", 61.5, 63.5, "STORM: falling in the dark; a beam of starlight guides the balloon home"),
    # ---- CODA
    ("C01", 63.5, 66.0, "EXT spring morning: patched mismatched sails; Claude on the gallery with a new telescope"),
    ("C02", 66.0, 69.0, "EXT night: Claude blinks twice at the sky; one star blinks back"),
    ("C03", 69.0, 73.0, "EXT night: pull back - the windmill under the Claude-shaped constellation; title"),
]

SHOT = {n: (bar(a), bar(b), d) for (n, a, b, d) in SHOTS}
ORDER = [s[0] for s in SHOTS]
DURATION = bar(SHOTS[-1][2])


def shot_frames(name):
    a, b, _ = SHOT[name]
    return frame(a), frame(b)


def local(name, t_abs):
    return t_abs - SHOT[name][0]


def absolute(name, t_local):
    return SHOT[name][0] + t_local


if __name__ == "__main__":
    for n, a, b, d in SHOTS:
        print(f"{n}  {bar(a):6.2f}-{bar(b):6.2f}  ({bar(b) - bar(a):4.1f}s)  {d}")
    print("TOTAL", round(DURATION, 2), "s", frame(DURATION), "frames")
