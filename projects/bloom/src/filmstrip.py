"""Tile frames of a rendered shot into a labelled filmstrip for motion review.
python3 src/filmstrip.py out/frames_anim/S02 [step] [cols] [out.png]"""
import sys, os, glob, subprocess
d = sys.argv[1]
step = int(sys.argv[2]) if len(sys.argv) > 2 else 4
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
out = sys.argv[4] if len(sys.argv) > 4 else os.path.join(d, "filmstrip.png")
files = sorted(glob.glob(os.path.join(d, "f_*.png")))[::step]
w = 320
args, fc = [], ""
for i, f in enumerate(files):
    args += ["-i", f]
    n = os.path.basename(f)[2:-4]
    fc += f"[{i}:v]scale={w}:-1[v{i}];"
rows = (len(files) + cols - 1) // cols
pad = rows * cols - len(files)
for k in range(pad):
    fc += f"color=black:s={w}x{int(w*816/1920)}[p{k}];"
inputs = "".join(f"[v{i}]" for i in range(len(files))) + "".join(f"[p{k}]" for k in range(pad))
lay = "|".join(f"{'+'.join(['w0']*(i%cols)) or '0'}_{'+'.join(['h0']*(i//cols)) or '0'}" for i in range(rows*cols))
fc += f"{inputs}xstack=inputs={rows*cols}:layout={lay}"
subprocess.run(["ffmpeg", "-v", "error", "-y"] + args + ["-filter_complex", fc, "-frames:v", "1", out], check=True)
print(out)
