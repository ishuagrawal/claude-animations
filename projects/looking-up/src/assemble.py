"""Assemble the film: all shot frames (global numbering) -> letterboxed 1920x1080 (2.35:1 picture), the end title
over the bookend shot with fades, soundtrack muxed. python3 src/assemble.py [--frames-dir out/frames] [--audio ...]
Writes out/looking-up.mp4."""
import os, sys, glob, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import timeline as TL

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
args = sys.argv[1:]
fdir = args[args.index("--frames-dir") + 1] if "--frames-dir" in args else os.path.join(ROOT, "out", "frames")
audio = args[args.index("--audio") + 1] if "--audio" in args else os.path.join(ROOT, "out", "audio", "soundtrack.wav")
out = args[args.index("--out") + 1] if "--out" in args else os.path.join(ROOT, "out", "looking-up.mp4")
allf = os.path.join(ROOT, "out", "frames_all")
os.makedirs(allf, exist_ok=True)
for f in glob.glob(os.path.join(allf, "*.png")):
    os.remove(f)
n_total = TL.frame(TL.DURATION)
missing = []
for name in TL.ORDER:
    f0, f1 = TL.shot_frames(name)
    for g in range(f0, f1):
        src = os.path.join(fdir, name, f"f_{g:04d}.png")
        if not os.path.exists(src):
            missing.append((name, g))
            continue
        os.symlink(src, os.path.join(allf, f"f_{g:04d}.png"))
if missing:
    print(f"MISSING {len(missing)} frames, e.g. {missing[:5]}")
    # fill gaps with the previous frame so the edit still plays
    prev = None
    for g in range(n_total):
        p = os.path.join(allf, f"f_{g:04d}.png")
        if os.path.exists(p):
            prev = p
        elif prev:
            os.symlink(os.path.realpath(prev), p)
title = os.path.join(ROOT, "out", "title", "title.png")
if not os.path.exists(title):
    subprocess.run([sys.executable, os.path.join(ROOT, "src", "title.py")], check=True)


def shot_const(shot, name, default):
    """Read a module-level constant from a shot file without importing Blender."""
    import ast
    try:
        tree = ast.parse(open(os.path.join(ROOT, "src", "shots", shot.lower() + ".py")).read())
    except OSError:
        return default
    for node in tree.body:
        if isinstance(node, ast.Assign) and any(getattr(t, "id", None) == name for t in node.targets):
            return ast.literal_eval(node.value)
    return default


# the title fades in over the bookend wide (SH19) and stays until the fade to black
last = TL.ORDER[-1]
t_in = TL.SHOT[last][0] + shot_const(last, "T_TITLE", 1.6)
fade_out = 1.6
fc = ("[0:v]pad=1920:1080:0:132:black,format=rgba[v];"
      f"[1:v]format=rgba,fade=t=in:st={t_in:.3f}:d=1.2:alpha=1[t];"
      "[v][t]overlay=0:0:enable='gte(t,%f)'[v1];" % t_in +
      f"[v1]fade=t=in:st=0:d=0.8,fade=t=out:st={TL.DURATION - fade_out:.3f}:d={fade_out},format=yuv420p[vout]")
cmd = ["ffmpeg", "-y", "-v", "error", "-framerate", "24", "-i", os.path.join(allf, "f_%04d.png"),
       "-loop", "1", "-framerate", "24", "-i", title]
amap = []
if os.path.exists(audio):
    cmd += ["-i", audio]
    amap = ["-map", "2:a", "-c:a", "aac", "-b:a", "256k", "-af", "alimiter=limit=0.7:level=0:attack=1:release=40"]
cmd += ["-filter_complex", fc, "-map", "[vout]"] + amap + ["-c:v", "libx264", "-preset", "slow", "-crf", "16",
                                                           "-t", f"{TL.DURATION:.3f}", "-movflags", "+faststart", out]
print(" ".join(cmd[:8]), "...")
subprocess.run(cmd, check=True)
print("WROTE", out)
