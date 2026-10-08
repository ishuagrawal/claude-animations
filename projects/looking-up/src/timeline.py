"""Cue sheet: the single source of timing for picture and sound.

Music: 90 BPM, 4/4 -> one beat = 16 frames at 24 fps, one bar = 2.667 s. Shots are laid out on beats (every cut
lands on a beat); every event time inside a shot is shot-local seconds, and the sound reads the same table
(absolute = SHOT[name][0] + local)."""
FPS = 24
BPM = 90
BEAT = 60.0 / BPM          # 0.6667 s = 16 frames
BAR = 4 * BEAT             # 2.6667 s


def beat_t(b):
    """Start time (s) of beat b (0-based from the film start)."""
    return b * BEAT


def bar(n):
    """Start time (s) of bar n (1-based)."""
    return (n - 1) * BAR


def frame(t):
    return int(round(t * FPS))


# (name, start_beat, end_beat, one-line description)   — beats are 0-based from the film start
SHOTS = [
    # ---- ONCE UPON A TIME / EVERY DAY: alone on the peak; its only friend is a constellation shaped like itself
    ("SH01", 0, 7, "EWS twilight: crane up out of the flowers - the windmill on its peak above the sea of clouds; "
                   "the Claude-shaped constellation faint above"),
    ("SH02", 7, 12, "Claude small at the north gallery rail with its lantern, looking up at the constellation"),
    ("SH03", 12, 16, "CU Claude, lantern-lit: wistful; blinks twice, slowly (the ritual)"),
    # ---- UNTIL ONE DAY: the eye falls
    ("SH04", 16, 23, "The constellation: its eye twinkles twice back ... then flickers, breaks loose and FALLS; "
                     "tilt down with the streak toward the meadow"),
    ("SH05", 23, 26, "CU Claude: eyes snap wide, head whips down after it; impact flash; Claude bolts"),
    ("SH06", 26, 31, "Meadow, low through the flowers: a smoking glowing crater; Claude skids in, lantern swinging, "
                     "slows, creeps closer"),
    ("SH07", 31, 35, "CU the tiny star in the crater: dim, trembling, huge scared eyes look up"),
    # ---- BECAUSE OF THAT: Claude saves it; they bond
    ("SH08", 35, 40, "Claude sets the lantern down, lowers itself, offers its arms; the star hesitates, hops in - "
                     "its glow comes back, lighting Claude's face; both smile"),
    ("SH09", 40, 44, "Play: the star zips loops around Claude through the fireflies; Claude spins after it, laughing"),
    ("SH10", 44, 48, "The star swoops in, Claude lunges - they tumble together into the flowers"),
    ("SH11", 48, 52, "Top-down: lying side by side in the flowers, content, looking up"),
    # ---- BECAUSE OF THAT: it is fading away from home
    ("SH12", 52, 56, "CU the star: looking up, longing; its glow sputters and dims; it shivers"),
    ("SH13", 56, 58, "Insert: the constellation with its empty, dark eye"),
    ("SH14", 58, 63, "Claude looks from the sky to the fading star - understands; hugs it close; then resolve"),
    # ---- UNTIL FINALLY: Claude takes it as high as it can go
    ("SH15", 63, 69, "The windmill: Claude climbs onto the low sail tip, the star in its arms; a gust - the sail "
                     "lifts Claude up in a great arc against the stars"),
    ("SH16", 69, 73, "The apex, high above the cloud sea: one last look; Claude lifts the star and lets it go"),
    ("SH17", 73, 77, "The star streaks up into the empty eye and IGNITES - the constellation is whole"),
    # ---- AND EVER SINCE: it shines for Claude
    ("SH18", 77, 81, "CU Claude on the sail tip, starlit: blinks twice"),
    ("SH19", 81, 88, "Bookend wide: the windmill, Claude tiny on the top sail tip; the constellation blinks twice "
                     "back; title"),
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
