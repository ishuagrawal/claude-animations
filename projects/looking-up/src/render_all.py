"""Render every shot at final quality (skips shots whose frames are complete unless --force).
python3 src/render_all.py [--force] [--samples 24] [shots...]"""
import os, sys, subprocess, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline as TL

BL = "/Applications/Blender.app/Contents/MacOS/Blender"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
force = "--force" in args
samples = args[args.index("--samples") + 1] if "--samples" in args else "24"
names = [a for a in args if a in TL.SHOT] or TL.ORDER
env = dict(os.environ, LU_SAMPLES=samples)
t0 = time.time()
for n in names:
    f0, f1 = TL.shot_frames(n)
    d = os.path.join(ROOT, "out", "frames", n)
    have = all(os.path.exists(os.path.join(d, f"f_{g:04d}.png")) for g in range(f0, f1)) if os.path.isdir(d) else False
    if have and not force:
        print(n, "complete, skipping", flush=True)
        continue
    t = time.time()
    r = subprocess.run([BL, "-b", "--python", os.path.join(ROOT, "src", "render_shot.py"), "--", n], env=env,
                       capture_output=True, text=True)
    lines = [l for l in r.stdout.splitlines() if l.startswith(("RENDER", "BUILD", "CAMFIX")) or "Error" in l or "Traceback" in l]
    print(n, f"{time.time() - t:.0f}s", " | ".join(lines[-3:]), flush=True)
print("ALL DONE", f"{(time.time() - t0) / 3600:.2f} h", flush=True)
