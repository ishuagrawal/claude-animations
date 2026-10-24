"""Render one (or more) key preview still per shot and tile them into film-wide contact sheets.
python3 src/review_all.py [shots...]   (keys: KEYS dict, seconds into each shot)"""
import sys, os, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline as TL
BL = "/Applications/Blender.app/Contents/MacOS/Blender"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
names = sys.argv[1:] or TL.ORDER
for n in names:
    a, b, _ = TL.SHOT[n]
    t = round((b - a) * 0.6, 2)
    r = subprocess.run([BL, "-b", "--python", os.path.join(ROOT, "src/render_shot.py"), "--", n, "--preview", "--still", str(t)],
                       capture_output=True, text=True)
    err = [l for l in r.stdout.splitlines() + r.stderr.splitlines() if "Error" in l or "Traceback" in l or "CAMFIX" in l]
    print(n, t, err[:3])
